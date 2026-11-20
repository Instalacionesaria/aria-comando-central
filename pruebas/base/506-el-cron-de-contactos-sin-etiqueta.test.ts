// EL CRON DE CONTACTOS SIN ETIQUETA: los leads nuevos del último mes, tengan zona o no. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (decidido por el usuario el 2026-11-20, `lib/negocio/contactosSinEtiqueta.ts`)
//
//   · la primera corrida pide los CREADOS en los últimos 30 días, sin filtro de etiqueta, por `dateUpdated` ascendente;
//     guarda a los que no tienen zona con `territorio = null` y deja la marca en el `dateUpdated` más nuevo — mutación:
//     filtrar por etiqueta, no mandar el filtro del alta, sacar la zona de las etiquetas de otro lado;
//   · la siguiente pide desde la marca menos el margen, y una página llena sigue con `searchAfter` y sin `page` —
//     mutación: no restar el margen, mandar `page` con el cursor;
//   · un fallo del CRM en la primera página se lanza y no mueve la marca; uno a mitad guarda lo traído y la marca llega
//     hasta ahí; sin tiempo no se pide nada — mutación: mover la marca con un fallo, no mirar el reloj;
//   · el barrido de diez minutos, con el interruptor: trae los nuevos y saltea `mensajes` con su motivo; sin él, la
//     búsqueda por etiqueta y la ingesta, como antes.
//
// El GoHighLevel falso intercepta `globalThis.fetch`, como `98-closer-sincronizar` y `336-la-baja-en-el-crm`.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';
import {
  DIAS_HACIA_ATRAS,
  MARGEN_MS,
  VARIABLE_DEL_INTERRUPTOR,
  sincronizarLosNuevos,
} from '../../lib/negocio/contactosSinEtiqueta.ts';
import { POR_PAGINA_SIN_ETIQUETA, type ContactoDeGhl } from '../../lib/ghl/cliente.ts';
import { barrerTodo, MOTIVO_SIN_CONVERSACIONES, type EmpresaParaBarrer } from '../../lib/negocio/barrido.ts';

const SLUG = 'sin-etiqueta-506';
const MARCA = 'r506';
const GHL = 'https://services.leadconnectorhq.com';
const ACCESO = { token: 'token-de-prueba', locationId: 'loc-506' };

let admin: Client;
let org: string;
let cuenta: string;
const fetchOriginal = globalThis.fetch;

/** Lo que contesta el GoHighLevel falso a `POST /contacts/search`, en orden. Sin más páginas, una vacía. */
let paginas: { estado: number; cuerpo: unknown }[] = [];
/** Los cuerpos de cada `POST /contacts/search`, en orden. */
let busquedas: Record<string, unknown>[] = [];
/** Las otras URLs que se pidieron. */
let otras: string[] = [];

const ambito = () => ambitoDeUnCliente(org, cuenta);
const plazo = (ms = 60_000) => ({ fin: Date.now() + ms, ahora: Date.now });

let secuencia = 0;
/** Un contacto como lo devuelve la búsqueda, con su cursor. */
function contacto(dateUpdated: Date, campos: { tags?: string[]; sinNombre?: boolean } = {}): ContactoDeGhl {
  const id = `${MARCA}-${++secuencia}`;
  return {
    id,
    ...(campos.sinNombre ? {} : { firstName: 'Lead', lastName: id }),
    tags: campos.tags ?? ['formulario'],
    dateAdded: new Date(dateUpdated.getTime() - 3600_000).toISOString(),
    dateUpdated: dateUpdated.toISOString(),
    searchAfter: [dateUpdated.getTime(), id],
    customFields: [],
  };
}

/** Una página llena de contactos sin zona, desde `desde`, de a un segundo. */
function paginaLlena(desde: Date): ContactoDeGhl[] {
  return Array.from({ length: POR_PAGINA_SIN_ETIQUETA }, (_, i) => contacto(new Date(desde.getTime() + i * 1000)));
}

const ok = (contacts: ContactoDeGhl[]) => ({ estado: 200, cuerpo: { contacts, total: contacts.length } });

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['tareas_programadas', 'avisos_del_crm', 'mensajes', 'contactos', 'ingesta_pulso', 'campos_del_crm', 'carpetas_del_crm']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Borra los contactos y la marca, para empezar de cero. */
async function deCero(): Promise<void> {
  await admin.query(`delete from negocio.contactos where org_id = $1`, [org]);
  await admin.query(`delete from negocio.ingesta_pulso where org_id = $1`, [org]);
  paginas = [];
  busquedas = [];
  otras = [];
}

/** Corre el antirrebote del pulso hacia atrás: la corrida siguiente de una prueba no espera diez segundos. */
async function sinAntirrebote(): Promise<void> {
  await admin.query(
    `update negocio.ingesta_pulso set ultima_corrida_el = now() - interval '1 hour' where org_id = $1`,
    [org],
  );
}

async function laMarca(): Promise<Date | null> {
  const f = await unaFila<{ marca_el: Date | null }>(
    admin,
    `select marca_el from negocio.ingesta_pulso where org_id = $1 and clave = 'contactos'`,
    [org],
  );
  return f?.marca_el ?? null;
}

/** El valor `gte` de un filtro de una búsqueda. */
function gte(cuerpo: Record<string, unknown> | undefined, campo: string): string | undefined {
  const f = (cuerpo?.filters as { field: string; value: { gte: string } }[] | undefined)?.find((x) => x.field === campo);
  return f?.value.gte;
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Sin etiqueta 506', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  const c = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  assert.ok(c);
  cuenta = c.id;
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : String((entrada as Request).url ?? entrada);
    if (url === `${GHL}/contacts/search`) {
      busquedas.push(JSON.parse(String(init?.body ?? '{}')));
      const r = paginas.shift() ?? ok([]);
      return new Response(JSON.stringify(r.cuerpo), { status: r.estado, headers: { 'content-type': 'application/json' } });
    }
    otras.push(url);
    return new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof globalThis.fetch;
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  delete process.env[VARIABLE_DEL_INTERRUPTOR];
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('la primera corrida pide los creados en el mes sin etiqueta, guarda a los sin zona y deja la marca', async () => {
  await deCero();
  const ahora = Date.now();
  const sinZona = contacto(new Date(ahora - 3 * 3600_000));
  const conZona = contacto(new Date(ahora - 2 * 3600_000), { tags: ['zona_setter', 'formulario'] });
  const sinNombre = contacto(new Date(ahora - 1 * 3600_000), { sinNombre: true });
  paginas = [ok([sinZona, conZona, sinNombre])];

  const r = await sincronizarLosNuevos(ambito(), ACCESO, plazo());

  assert.equal(r.corrio, true);
  if (!r.corrio) return;
  assert.deepEqual(r.resultado.guardados, { closer: 0, setter: 1, sinZona: 1 });
  assert.equal(r.resultado.salteadosEnTotal, 1, 'el contacto sin nombre no se informó como salteado');
  assert.equal(r.resultado.pendientes, false);
  assert.equal(r.llamadas >= 1, true);

  // Una sola búsqueda: los creados hace 30 días o menos, cambiados desde la misma fecha, sin etiqueta, ascendente.
  assert.equal(busquedas.length, 1);
  const [b] = busquedas;
  assert.ok(b);
  const alta = Date.parse(gte(b, 'dateAdded') ?? '');
  assert.ok(Math.abs(alta - (ahora - DIAS_HACIA_ATRAS * 24 * 3600_000)) < 60_000, 'el filtro del alta no es de hace 30 días');
  assert.equal(gte(b, 'dateUpdated'), gte(b, 'dateAdded'), 'la primera vez, el cambio no arranca en el mes');
  assert.ok(!JSON.stringify(b.filters).includes('tags'), 'la búsqueda sigue filtrando por etiqueta');
  assert.deepEqual(b.sort, [{ field: 'dateUpdated', direction: 'asc' }]);
  assert.equal(b.page, 1);
  assert.equal(b.searchAfter, undefined);
  assert.equal(b.pageLimit, POR_PAGINA_SIN_ETIQUETA);

  const guardados = await filas<{ ghl_contact_id: string; territorio: string | null }>(
    admin,
    `select ghl_contact_id, territorio from negocio.contactos where org_id = $1 order by ghl_contact_id`,
    [org],
  );
  assert.deepEqual(
    guardados,
    [
      { ghl_contact_id: sinZona.id, territorio: null },
      { ghl_contact_id: conZona.id, territorio: 'setter' },
    ].sort((a, b) => a.ghl_contact_id.localeCompare(b.ghl_contact_id)),
  );
  assert.equal((await laMarca())?.toISOString(), sinNombre.dateUpdated, 'la marca no quedó en el dateUpdated más nuevo');
});

test('la siguiente pide desde la marca menos el margen, y una página llena sigue con el cursor', async () => {
  const marca = await laMarca();
  assert.ok(marca, 'la prueba anterior no dejó la marca');
  await sinAntirrebote();
  busquedas = [];
  const llena = paginaLlena(new Date(marca.getTime() + 1000));
  const ultimo = contacto(new Date(marca.getTime() + 2000 * 1000));
  paginas = [ok(llena), ok([ultimo])];

  const r = await sincronizarLosNuevos(ambito(), ACCESO, plazo());

  assert.equal(r.corrio, true);
  if (!r.corrio) return;
  assert.equal(busquedas.length, 2);
  const [primera, segunda] = busquedas;
  assert.ok(primera && segunda);
  assert.equal(Date.parse(gte(primera, 'dateUpdated') ?? ''), marca.getTime() - MARGEN_MS, 'no se restó el margen');
  assert.deepEqual(segunda.searchAfter, llena.at(-1)?.searchAfter, 'la segunda página no usó el cursor del último');
  assert.equal(segunda.page, undefined, 'con el cursor se mandó `page`');
  assert.equal(r.resultado.guardados.sinZona, POR_PAGINA_SIN_ETIQUETA + 1);
  assert.equal((await laMarca())?.toISOString(), ultimo.dateUpdated);
});

test('un fallo en la primera página se lanza y no mueve la marca; a mitad, guarda lo traído', async () => {
  const antes = await laMarca();
  assert.ok(antes);
  await sinAntirrebote();
  busquedas = [];
  paginas = [{ estado: 502, cuerpo: { message: 'caído' } }];
  await assert.rejects(() => sincronizarLosNuevos(ambito(), ACCESO, plazo()), /el CRM respondió/);
  assert.equal((await laMarca())?.getTime(), antes.getTime(), 'un fallo movió la marca');

  await sinAntirrebote();
  const llena = paginaLlena(new Date(antes.getTime() + 1000));
  paginas = [ok(llena), { estado: 502, cuerpo: { message: 'caído' } }];
  const r = await sincronizarLosNuevos(ambito(), ACCESO, plazo());
  assert.equal(r.corrio, true);
  if (!r.corrio) return;
  assert.equal(r.resultado.pendientes, true);
  assert.equal(r.resultado.fallo, 'rechazado');
  assert.equal(r.resultado.guardados.sinZona, POR_PAGINA_SIN_ETIQUETA);
  assert.equal((await laMarca())?.toISOString(), llena.at(-1)?.dateUpdated, 'la marca no llegó hasta lo guardado');
});

test('sin tiempo no se pide nada y la marca no se mueve', async () => {
  const antes = await laMarca();
  await sinAntirrebote();
  busquedas = [];
  paginas = [ok([contacto(new Date())])];
  const r = await sincronizarLosNuevos(ambito(), ACCESO, { fin: Date.now() - 1, ahora: Date.now });
  assert.equal(r.corrio, true);
  if (!r.corrio) return;
  assert.equal(busquedas.length, 0, 'se pidió sin tiempo');
  assert.equal(r.resultado.pendientes, true);
  assert.equal((await laMarca())?.getTime(), antes?.getTime());
});

function laEmpresa(): EmpresaParaBarrer {
  return {
    org: {
      id: org,
      slug: SLUG,
      nombre: 'Sin etiqueta 506',
      activa: true,
      esPrincipal: false,
      tieneCredencialDeCrm: true,
      precioMensual: null,
      usuarios: 0,
      zonaHoraria: 'America/Lima',
      creadaEl: new Date(),
    },
    acceso: { tipo: 'falta', que: 'token_revocado' },
    auditor: { tipo: 'falta', que: 'auditor_apagado' },
    analizador: { tipo: 'falta', que: 'sin_llave_de_tldv' },
    clientes: [
      {
        cuenta: { id: cuenta, esPorOmision: true },
        acceso: { tipo: 'listo', ...ACCESO },
        auditor: { tipo: 'falta', que: 'sin_llave_de_ia' },
      },
    ],
  };
}

async function selloDe(tarea: string): Promise<{ estado: string; motivo: string | null } | undefined> {
  return unaFila<{ estado: string; motivo: string | null }>(
    admin,
    `select ultimo_estado as estado, ultimo_motivo as motivo from negocio.tareas_programadas
      where org_id = $1 and cuenta_id = $2 and tarea = $3`,
    [org, cuenta, tarea],
  );
}

test('el barrido de diez minutos con el interruptor trae los nuevos y saltea los mensajes; sin él, como antes', async () => {
  await deCero();
  process.env[VARIABLE_DEL_INTERRUPTOR] = `otra-cuenta, ${cuenta}`;
  paginas = [ok([contacto(new Date(Date.now() - 60_000))])];
  await barrerTodo('*/10 * * * *', [laEmpresa()], Date.now);

  assert.deepEqual(await selloDe('mensajes'), { estado: 'saltada', motivo: MOTIVO_SIN_CONVERSACIONES });
  assert.equal((await selloDe('contactos'))?.estado, 'corrio');
  assert.equal(busquedas.length, 1);
  assert.ok(gte(busquedas[0], 'dateAdded'), 'el barrido no usó la búsqueda de los nuevos');
  assert.ok(!otras.some((u) => u.includes('/conversations/')), 'con el interruptor se pidieron conversaciones');
  const n = await unaFila<{ n: number }>(admin, `select count(*)::int as n from negocio.contactos where org_id = $1`, [org]);
  assert.equal(n?.n, 1);

  // Sin el interruptor: la búsqueda por etiqueta y la ingesta de mensajes, como siempre.
  delete process.env[VARIABLE_DEL_INTERRUPTOR];
  await admin.query(`update negocio.ingesta_pulso set ultima_corrida_el = now() - interval '1 hour' where org_id = $1`, [org]);
  busquedas = [];
  otras = [];
  paginas = [];
  await barrerTodo('*/10 * * * *', [laEmpresa()], Date.now);
  assert.ok(
    busquedas.some((b) => JSON.stringify(b.filters ?? []).includes('zona_closer')),
    'sin el interruptor no se buscó por etiqueta',
  );
  assert.ok(!busquedas.some((b) => gte(b, 'dateAdded')), 'sin el interruptor se usó la búsqueda de los nuevos');
  assert.notEqual((await selloDe('mensajes'))?.motivo, MOTIVO_SIN_CONVERSACIONES, 'sin el interruptor se salteó la ingesta');
  assert.ok(otras.some((u) => u.includes('/conversations/')), 'sin el interruptor no se pidieron conversaciones');
});
