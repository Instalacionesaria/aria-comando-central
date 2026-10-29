// EL RELLENO DEL CUADRANTE para los calificados viejos (la `109` y `lib/negocio/rellenoDelCuadrante.ts`). Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (decisión del usuario, 2026-10-29)
//
//   · a quién: agendó, sin etiqueta de descarte, sin cuadrante, con la PRIMERA reserva antes del corte — mutaciones:
//     sin el corte, `max` en vez de `min`, sin el descarte, sin el `cuadrante is null`;
//   · el valor por el puntaje viejo: 75 → Prioriza, 74 → Valida, 50 → Valida, 49 y nulo → Descarta — mutaciones: `>`
//     en vez de `>=`, el nulo a Valida (los bordes con decimales están en `pruebas/codigo/337`);
//   · la escritura: el PUT lleva SÓLO el campo, nunca `tags`; no pisa un campo que el CRM ya llenó; saltea 404 y bajas;
//     corta con 401 y 429; respeta el tope; un 200 que no escribe no cuenta como «quedó» — mutaciones: tags en el cuerpo,
//     sin la precondición, sin el corte, sin el tope;
//   · la historia (la `109`): la clasificación con origen `persona` y el evento con actor `persona`; la respuesta del
//     campo del cuadrante con `obtenida_por = 'persona'` y los otros campos de la misma relectura con `crm`; la foto
//     inicial de un congelado sin historia, `crm` — mutaciones: el origen fijo, la vía fija, sin la restricción del
//     campo, sin `comoPersona`;
//   · un `recalcularLosCuadrantes` posterior no lo revierte, y una escritura posterior vuelve a ser del CRM;
//   · el deshacer vacía SÓLO donde el CRM todavía tiene nuestro valor — mutación: sin esa comparación;
//   · el seco (el guion, en otro proceso) imprime conteos, nunca nombres, y no escribe nada.
//
// El GoHighLevel falso intercepta `globalThis.fetch` (como la `336`): GET y PUT de `/contacts/{id}`. La organización
// es propia (`relleno-337`), con su cliente por omisión y el campo del cuadrante en su catálogo.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { RAIZ } from '../apoyo/fuente.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';
import { recalcularLosCuadrantes } from '../../lib/negocio/camposDelCrm.ts';
import { CLAVE_DEL_CUADRANTE, ETIQUETAS_DE_DESCARTE } from '../../lib/ghl/contrato.ts';
import {
  candidatosDelRelleno,
  corteDe,
  correrElDeshacer,
  correrElRelleno,
  escritosDelDiario,
  porQueNoEsCandidato,
  resumenDelRelleno,
  type Candidato,
  type LineaDelDiario,
} from '../../lib/negocio/rellenoDelCuadrante.ts';

const SLUG = 'relleno-337';
const CAMPO = 'q337';
const OTRO = 'otro337';
const CARPETA = 'cp337';
const NOMBRE = 'Nombre337';
const GHL = 'https://services.leadconnectorhq.com';
const ACCESO = { token: 't337', locationId: 'loc337' };
const CORTE = corteDe('2026-10-26');

let admin: Client;
let org: string;
let cuenta: string;
const fetchOriginal = globalThis.fetch;
const ambito = () => ambitoDeUnCliente(org, cuenta);

/** El CRM falso: por id, sus etiquetas y sus campos; `get`/`put` fuerzan un estado, `put: 'ignora'` contesta 200 sin escribir. */
interface ContactoFalso {
  tags: string[];
  campos: Record<string, string>;
  get?: number;
  put?: number | 'ignora';
}
let crm: Record<string, ContactoFalso> = {};
let pedidos: { metodo: string; id: string; cuerpo: unknown; version: string | null }[] = [];

function instalarCrm(): void {
  globalThis.fetch = (async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : String(entrada);
    const metodo = opciones?.method ?? 'GET';
    const cuerpo = typeof opciones?.body === 'string' ? JSON.parse(opciones.body) : undefined;
    const version = new Headers(opciones?.headers).get('Version');
    const m = url.startsWith(`${GHL}/contacts/`) ? url.slice(`${GHL}/contacts/`.length) : null;
    const id = m === null ? url : decodeURIComponent(m);
    pedidos.push({ metodo, id, cuerpo, version });
    const responder = (estado: number, c: unknown) =>
      new Response(JSON.stringify(c), { status: estado, headers: { 'content-type': 'application/json' } });
    if (m === null || m.includes('/')) return responder(500, { message: 'no previsto' });
    const c = crm[id];
    if (!c) return responder(404, { message: 'Contact not found' });
    if (metodo === 'GET') {
      if (c.get) return responder(c.get, { message: 'forzado' });
      return responder(200, {
        contact: {
          id,
          firstName: NOMBRE,
          lastName: id,
          tags: c.tags,
          customFields: Object.entries(c.campos).map(([k, value]) => ({ id: k, value })),
        },
      });
    }
    if (metodo === 'PUT') {
      if (typeof c.put === 'number') return responder(c.put, { message: 'forzado' });
      if (c.put !== 'ignora') {
        for (const f of (cuerpo as { customFields: { id: string; field_value: string }[] }).customFields) {
          if (f.field_value === '') delete c.campos[f.id];
          else c.campos[f.id] = f.field_value;
        }
      }
      return responder(200, { succeded: true, contact: { id } });
    }
    return responder(500, { message: 'no previsto' });
  }) as typeof globalThis.fetch;
}

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['eventos', 'clasificaciones', 'respuestas_del_lead', 'citas', 'contactos', 'campos_del_crm', 'carpetas_del_crm', 'ingesta_pulso']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Un contacto como lo dejó una sincronización anterior. Su id del CRM es `r337-<corto>`. */
async function contacto(
  corto: string,
  c: { score?: number | null; territorio?: string | null; etiquetas?: string[]; cuadrante?: string | null; campos?: Record<string, string>; sinHistoria?: boolean; baja?: boolean } = {},
): Promise<{ id: string; ghl: string }> {
  const ghl = `r337-${corto}`;
  const f = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, etiquetas, score, cuadrante,
                                    campos_del_crm, alta_en_el_crm, sincronizado_el, historia_desde, baja_en_el_crm)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, '2026-09-01', now() - interval '2 hours',
             case when $10 then null else now() end, case when $11 then now() end) returning id`,
    [
      org,
      cuenta,
      ghl,
      `${NOMBRE} ${corto}`,
      c.territorio === undefined ? 'closer' : c.territorio,
      c.etiquetas ?? ['zona_closer'],
      c.score === undefined ? null : c.score,
      c.cuadrante ?? null,
      JSON.stringify(c.campos ?? { [OTRO]: 'uno' }),
      c.sinHistoria === true,
      c.baja === true,
    ],
  );
  assert.ok(f);
  return { id: f.id, ghl };
}

/** Una cita del contacto. `reservada` nula = sincronizada antes de la `043`: se mide por su inicio. */
async function cita(contactoId: string, c: { reservada: string | null; inicio: string; calendario?: boolean; estado?: string }): Promise<void> {
  await admin.query(
    `insert into negocio.citas (org_id, cuenta_id, contacto_id, ghl_evento_id, inicio_el, reservada_el, ghl_calendario_id, estado_ghl)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [org, cuenta, contactoId, `r337-ev-${Math.random().toString(36).slice(2, 10)}`, c.inicio, c.reservada, c.calendario === false ? null : 'cal-337', c.estado ?? 'confirmed'],
  );
}

/** Un contacto que agendó una vez, el 2026-10-01. */
async function agendado(corto: string, c: Parameters<typeof contacto>[1] = {}): Promise<{ id: string; ghl: string }> {
  const k = await contacto(corto, c);
  await cita(k.id, { reservada: '2026-10-01T12:00:00Z', inicio: '2026-10-05T12:00:00Z' });
  return k;
}

const enElCrm = (campos: Record<string, string> = { [OTRO]: 'uno' }, tags = ['zona_closer']): ContactoFalso => ({ tags, campos: { ...campos } });

async function cuadranteDe(ghl: string): Promise<{ cuadrante: string | null; territorio: string | null }> {
  return (await unaFila<{ cuadrante: string | null; territorio: string | null }>(
    admin,
    `select cuadrante, territorio from negocio.contactos where org_id = $1 and ghl_contact_id = $2`,
    [org, ghl],
  ))!;
}

async function clasificaciones(contactoId: string) {
  return filas<{ cuadrante: string | null; cuadrante_anterior: string | null; origen: string; primera_vez: boolean; evento_id: string }>(
    admin,
    `select cuadrante, cuadrante_anterior, origen, primera_vez, evento_id from negocio.clasificaciones
      where org_id = $1 and contacto_id = $2 order by clasificado_el, id`,
    [org, contactoId],
  );
}

/** Las respuestas registradas desde `desde` (las del alta de la prueba quedan antes). */
async function respuestas(contactoId: string, desde: Date) {
  return filas<{ origen_clave: string; valor_texto: string | null; vaciada: boolean; obtenida_por: string }>(
    admin,
    `select origen_clave, valor_texto, vaciada, obtenida_por
       from negocio.respuestas_del_lead where org_id = $1 and contacto_id = $2 and registrada_el >= $3
      order by observada_el, origen_clave`,
    [org, contactoId, desde],
  );
}

async function ahora(): Promise<Date> {
  return (await unaFila<{ t: Date }>(admin, `select clock_timestamp() as t`))!.t;
}

async function candidatos(opciones: { sinSoloCanceladas?: boolean } = {}): Promise<Candidato[]> {
  return conOrganizacion(ambito(), () => candidatosDelRelleno({ antesDe: CORTE, ...opciones }));
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Relleno 337', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  cuenta = (await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]))!.id;
  await admin.query(
    `insert into negocio.carpetas_del_crm (org_id, cuenta_id, carpeta_id, nombre, grupo) values ($1, $2, $3, 'Contact', 'calificacion')`,
    [org, cuenta, CARPETA],
  );
  await admin.query(
    `insert into negocio.campos_del_crm (org_id, cuenta_id, campo_id, nombre, carpeta_id, tipo, clave, visto_el)
     values ($1, $2, $3, 'Cuadrante de Clasificacion', $4, 'RADIO', $5, now()),
            ($1, $2, $6, 'Otro campo', $4, 'TEXT', null, now())`,
    [org, cuenta, CAMPO, CARPETA, CLAVE_DEL_CUADRANTE, OTRO],
  );
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

async function sinContactos(): Promise<void> {
  for (const t of ['eventos', 'clasificaciones', 'respuestas_del_lead', 'citas', 'contactos']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [org]);
  }
  crm = {};
  pedidos = [];
}

test('a quién: agendó, sin descarte por etiqueta, sin cuadrante, con la primera reserva antes del corte; y con qué valor', async () => {
  await sinContactos();
  await agendado('p80', { score: 80 });
  await agendado('p75', { score: 75 });
  await agendado('v74', { score: 74 });
  await agendado('v50', { score: 50 });
  await agendado('d49', { score: 49 });
  await agendado('dnulo', { score: null, territorio: null, etiquetas: [] });
  // La primera reserva justo en el corte: afuera. Y una con dos citas, la primera antes: adentro (es la MENOR).
  const enElCorte = await contacto('corte', { score: 90 });
  await cita(enElCorte.id, { reservada: '2026-10-26T00:00:00Z', inicio: '2026-10-27T12:00:00Z' });
  const dos = await contacto('dos', { score: 90 });
  await cita(dos.id, { reservada: '2026-10-28T12:00:00Z', inicio: '2026-10-29T12:00:00Z' });
  await cita(dos.id, { reservada: '2026-10-10T12:00:00Z', inicio: '2026-10-12T12:00:00Z' });
  // Sin reserva (anterior a la 043): se mide por el inicio.
  const sinReserva = await contacto('sinres', { score: 60 });
  await cita(sinReserva.id, { reservada: null, inicio: '2026-10-20T12:00:00Z' });
  // Reservó después del corte para una cita de antes (imposible en el CRM, pero dice que manda la reserva): afuera.
  const reservaTarde = await contacto('restarde', { score: 60 });
  await cita(reservaTarde.id, { reservada: '2026-10-27T12:00:00Z', inicio: '2026-10-20T12:00:00Z' });
  // La primera reserva es la de sus citas ALCANZABLES: una vieja sin calendario no lo mete antes del corte.
  const viejaSinCal = await contacto('viejasincal', { score: 90 });
  await cita(viejaSinCal.id, { reservada: '2026-09-01T12:00:00Z', inicio: '2026-09-05T12:00:00Z', calendario: false });
  await cita(viejaSinCal.id, { reservada: '2026-10-27T12:00:00Z', inicio: '2026-10-29T12:00:00Z' });
  // Afuera: descartado por etiqueta (en mayúsculas), ya clasificado, sin cita alcanzable.
  await agendado('etiq', { score: 90, etiquetas: ['zona_closer', ETIQUETAS_DE_DESCARTE[1]!.toUpperCase()] });
  await agendado('clasif', { score: 90, cuadrante: 'valida' });
  const sinCal = await contacto('sincal', { score: 90 });
  await cita(sinCal.id, { reservada: '2026-10-01T12:00:00Z', inicio: '2026-10-05T12:00:00Z', calendario: false });
  // Sólo con una cita cancelada, escrita con la variante `canceled`: adentro por omisión, afuera si se pide.
  const cancelo = await contacto('cancelo', { score: 30 });
  await cita(cancelo.id, { reservada: '2026-10-01T12:00:00Z', inicio: '2026-10-05T12:00:00Z', estado: 'canceled' });

  const lista = await candidatos();
  const por = Object.fromEntries(lista.map((c) => [c.ghlContactId.replace('r337-', ''), c.valor]));
  assert.deepEqual(por, {
    p80: 'Prioriza',
    p75: 'Prioriza',
    v74: 'Valida',
    v50: 'Valida',
    d49: 'Descarta',
    dnulo: 'Descarta',
    dos: 'Prioriza',
    sinres: 'Valida',
    cancelo: 'Descarta',
  });
  // La más vieja primero.
  assert.equal(lista[lista.length - 1]!.ghlContactId, 'r337-sinres');
  assert.equal(lista.find((c) => c.ghlContactId === 'r337-cancelo')!.soloCanceladas, true);

  const sinCanceladas = await candidatos({ sinSoloCanceladas: true });
  assert.equal(sinCanceladas.some((c) => c.ghlContactId === 'r337-cancelo'), false, 'la variante «canceled» no se reconoció como cancelada');
  assert.equal(sinCanceladas.length, 8);

  const r = await conOrganizacion(ambito(), () => resumenDelRelleno({ antesDe: CORTE }));
  assert.deepEqual(
    { ...r, porValor: { ...r.porValor } },
    {
      agendaron: 14,
      yaClasificados: 1,
      descartadosPorEtiqueta: 1,
      desdeElCorte: 3,
      soloCanceladasExcluidos: 0,
      candidatos: 9,
      porValor: { Prioriza: 3, Valida: 3, Descarta: 3 },
      congelados: 1,
      soloCanceladas: 1,
      conBaja: 0,
    },
  );

  const motivo = (id: string) => conOrganizacion(ambito(), () => porQueNoEsCandidato(id, { antesDe: CORTE }));
  assert.equal(await motivo('r337-p80'), null);
  assert.equal(await motivo('r337-corte'), 'su primera reserva es del corte o después');
  assert.equal(await motivo('r337-viejasincal'), 'su primera reserva es del corte o después');
  assert.equal(await motivo('r337-etiq'), 'está descartado por una etiqueta');
  assert.equal(await motivo('r337-clasif'), 'ya tiene cuadrante');
  assert.equal(await motivo('r337-sincal'), 'no tiene ninguna cita alcanzable');
  assert.equal(await motivo('r337-nadie'), 'no está en la base de este cliente');
});

/** Las líneas que anota una corrida. */
function diario(): { lineas: LineaDelDiario[]; anotar: (l: LineaDelDiario) => void } {
  const lineas: LineaDelDiario[] = [];
  return { lineas, anotar: (l) => lineas.push(l) };
}

test('escribe SÓLO el campo, relee como persona, no pisa lo que el CRM ya llenó, y anota cada escritura', async () => {
  await sinContactos();
  const a = await agendado('a', { score: 90, campos: { [OTRO]: 'uno' } });
  const c = await agendado('c', { score: 60 });
  // Congelado y sin historia: la relectura lo descongela (el CRM le devolvió la zona) y guarda su foto inicial.
  const f = await agendado('f', { score: null, territorio: null, etiquetas: [], sinHistoria: true, campos: { [OTRO]: 'viejo' } });
  const p = await agendado('p', { score: 90 });
  await agendado('q', { score: 90 });
  await agendado('r', { score: 90, baja: true });
  crm = {
    'r337-a': enElCrm({ [OTRO]: 'dos' }),
    'r337-c': enElCrm(),
    'r337-f': enElCrm({ [OTRO]: 'viejo' }),
    'r337-p': enElCrm({ [OTRO]: 'uno', [CAMPO]: 'Financia' }),
  };
  instalarCrm();
  const desde = await ahora();
  const d = diario();
  const t = await correrElRelleno({ ambito: ambito(), acceso: ACCESO, campoId: CAMPO, candidatos: await candidatos(), tope: 100, pausaMs: 0, anotar: d.anotar });

  // Cada PUT: a /contacts/{id}, con la versión de contactos, y un cuerpo con el campo y NADA más.
  const puts = pedidos.filter((x) => x.metodo === 'PUT');
  assert.deepEqual(
    puts.map((x) => [x.id, x.cuerpo]).sort((x, y) => String(x[0]).localeCompare(String(y[0]))),
    [
      ['r337-a', { customFields: [{ id: CAMPO, field_value: 'Prioriza' }] }],
      ['r337-c', { customFields: [{ id: CAMPO, field_value: 'Valida' }] }],
      ['r337-f', { customFields: [{ id: CAMPO, field_value: 'Descarta' }] }],
    ],
  );
  for (const x of puts) {
    assert.equal(x.version, '2021-07-28');
    assert.equal(Object.hasOwn(x.cuerpo as object, 'tags'), false, 'el PUT llevó tags: reemplazaría todas las etiquetas');
  }
  assert.equal(pedidos.some((x) => x.id === 'r337-r'), false, 'se le pidió al CRM un contacto con baja');
  assert.equal(crm['r337-p']!.campos[CAMPO], 'Financia', 'se pisó un cuadrante que el CRM ya tenía');

  assert.deepEqual(
    { escritos: t.escritos, quedaron: t.quedaron, descongelados: t.descongelados, porValor: t.porValor, salteados: t.salteados, cortada: t.cortada },
    {
      escritos: 3,
      quedaron: 3,
      descongelados: 1,
      porValor: { Prioriza: 1, Valida: 1, Descarta: 1 },
      salteados: { ya_tiene_valor_en_el_crm: 1, no_esta_en_el_crm: 1, baja_en_el_crm: 1 },
      cortada: null,
    },
  );
  assert.deepEqual(await cuadranteDe('r337-a'), { cuadrante: 'prioriza', territorio: 'closer' });
  assert.deepEqual(await cuadranteDe('r337-c'), { cuadrante: 'valida', territorio: 'closer' });
  assert.deepEqual(await cuadranteDe('r337-f'), { cuadrante: 'descarta', territorio: 'closer' });
  // El que el CRM ya tenía, alcanzado por la relectura normal: es del CRM.
  assert.deepEqual(await cuadranteDe('r337-p'), { cuadrante: 'financia', territorio: 'closer' });

  // El diario: una línea por PUT, con lo necesario para deshacer.
  assert.deepEqual(
    d.lineas.map((l) => [l.accion, l.ghlContactId, l.campoId, l.valorAnterior, l.valorNuevo, l.territorioAntes, l.territorioDespues, l.cuadranteDespues, l.relectura, l.cuentaId]).sort(),
    [
      ['escrito', 'r337-a', CAMPO, '', 'Prioriza', 'closer', 'closer', 'prioriza', 'listo', cuenta],
      ['escrito', 'r337-c', CAMPO, '', 'Valida', 'closer', 'closer', 'valida', 'listo', cuenta],
      ['escrito', 'r337-f', CAMPO, '', 'Descarta', null, 'closer', 'descarta', 'listo', cuenta],
    ],
  );

  // La historia: una persona, no el CRM.
  const ka = await clasificaciones(a.id);
  assert.deepEqual(ka.map((k) => [k.cuadrante, k.cuadrante_anterior, k.origen, k.primera_vez]), [['prioriza', null, 'persona', true]]);
  const ev = await unaFila<{ actor_tipo: string; origen: string }>(admin, `select actor_tipo, datos ->> 'origen' as origen from negocio.eventos where org_id = $1 and id = $2`, [org, ka[0]!.evento_id]);
  assert.deepEqual(ev, { actor_tipo: 'persona', origen: 'persona' });
  assert.deepEqual((await clasificaciones(p.id)).map((k) => k.origen), ['crm']);
  // El campo del cuadrante, de la persona; el otro campo que cambió en la misma relectura, del CRM.
  const ra = await respuestas(a.id, desde);
  assert.deepEqual(
    ra.map((x) => [x.origen_clave, x.valor_texto, x.obtenida_por]).sort(),
    [
      [OTRO, 'dos', 'crm'],
      [CAMPO, 'Prioriza', 'persona'],
    ],
  );
  // El congelado sin historia: su foto inicial (lo que ya tenía) es del CRM; el cuadrante, de la persona.
  const rf = await respuestas(f.id, desde);
  assert.deepEqual(
    rf.map((x) => [x.origen_clave, x.valor_texto, x.obtenida_por]).sort(),
    [
      [OTRO, 'viejo', 'crm'],
      [CAMPO, 'Descarta', 'persona'],
    ],
  );
  assert.deepEqual((await clasificaciones(c.id)).map((k) => k.origen), ['persona']);

  // Un recálculo posterior no lo revierte (sale de los mismos campos) ni deja historia nueva.
  const antes = (await filas(admin, `select 1 from negocio.clasificaciones where org_id = $1`, [org])).length;
  await conOrganizacion(ambito(), () => recalcularLosCuadrantes());
  assert.deepEqual(await cuadranteDe('r337-a'), { cuadrante: 'prioriza', territorio: 'closer' });
  assert.deepEqual(await cuadranteDe('r337-f'), { cuadrante: 'descarta', territorio: 'closer' });
  assert.equal((await filas(admin, `select 1 from negocio.clasificaciones where org_id = $1`, [org])).length, antes);

  // Y las variables eran de esa transacción: una escritura posterior vuelve a ser del CRM.
  await conOrganizacion(ambito(), async () => {
    await datos().updateTable('contactos').set({ cuadrante: 'valida' }).where('ghl_contact_id', '=', 'r337-a').execute();
  });
  assert.deepEqual((await clasificaciones(a.id)).map((k) => k.origen), ['persona', 'crm']);

  // El deshacer, con este diario: el CRM todavía tiene lo nuestro en `a`; en `c` alguien puso Financia después; en `f`
  // ya está vacío. Sólo `a` se vacía.
  crm['r337-c']!.campos[CAMPO] = 'Financia';
  delete crm['r337-f']!.campos[CAMPO];
  pedidos = [];
  const dd = diario();
  const lineas = escritosDelDiario(d.lineas.map((l) => JSON.stringify(l)).join('\n') + '\n{roto\n').lineas;
  const td = await correrElDeshacer({ ambito: ambito(), acceso: ACCESO, campoId: CAMPO, lineas, tope: 100, pausaMs: 0, anotar: dd.anotar });
  assert.deepEqual(
    pedidos.filter((x) => x.metodo === 'PUT').map((x) => [x.id, x.cuerpo]),
    [['r337-a', { customFields: [{ id: CAMPO, field_value: '' }] }]],
  );
  assert.deepEqual({ escritos: td.escritos, quedaron: td.quedaron, salteados: td.salteados }, { escritos: 1, quedaron: 1, salteados: { cambiado_despues: 1, ya_vacio: 1 } });
  assert.equal(crm['r337-c']!.campos[CAMPO], 'Financia', 'el deshacer pisó lo que el CRM puso después');
  assert.equal((await cuadranteDe('r337-a')).cuadrante, null);
  assert.deepEqual(dd.lineas.map((l) => [l.accion, l.ghlContactId, l.valorAnterior, l.valorNuevo, l.cuadranteDespues]), [['deshecho', 'r337-a', 'Prioriza', '', null]]);
  const ultima = (await clasificaciones(a.id)).at(-1)!;
  assert.deepEqual([ultima.cuadrante, ultima.origen], [null, 'persona']);
  const vaciada = (await respuestas(a.id, desde)).filter((x) => x.origen_clave === CAMPO && x.vaciada);
  assert.deepEqual(vaciada.map((x) => x.obtenida_por), ['persona']);

  // El diario no decide qué se vacía. Una línea con otro campo se saltea sin escribir; una de otro cliente ni se mira;
  // un valor que el relleno no escribe no es una línea; y un contacto cuyo último registro es `deshecho` no se vuelve a
  // deshacer, aunque el CRM tenga otra vez ese valor (lo puso alguien después).
  crm['r337-a']!.campos[CAMPO] = 'Prioriza';
  crm['r337-c']!.campos[OTRO] = 'Prioriza';
  const deC = d.lineas.find((l) => l.ghlContactId === 'r337-c')!;
  const texto = [
    ...d.lineas,
    ...dd.lineas,
    { ...deC, campoId: OTRO, valorNuevo: 'Prioriza' },
    { ...deC, ghlContactId: 'r337-f', cuentaId: '00000000-0000-4000-8000-000000000337' },
    { ...deC, ghlContactId: 'r337-p', valorNuevo: 'Sí' },
  ]
    .map((l) => JSON.stringify(l))
    .join('\n');
  const leidas = escritosDelDiario(texto);
  assert.equal(leidas.ilegibles, 1, 'un valor que el relleno no escribe se leyó como línea');
  assert.deepEqual(
    leidas.lineas.map((l) => [l.cuentaId === cuenta, l.ghlContactId, l.campoId]).sort(),
    [
      [false, 'r337-f', CAMPO],
      [true, 'r337-c', OTRO],
      [true, 'r337-f', CAMPO],
    ],
    'el deshecho no sacó al contacto del diario',
  );
  pedidos = [];
  const td2 = await correrElDeshacer({ ambito: ambito(), acceso: ACCESO, campoId: CAMPO, lineas: leidas.lineas, tope: 100, pausaMs: 0, anotar: () => {} });
  assert.deepEqual(pedidos.filter((x) => x.metodo === 'PUT'), [], 'el deshacer vació algo que no era el cuadrante nuestro');
  assert.deepEqual(pedidos.map((x) => [x.metodo, x.id]), [['GET', 'r337-f']], 'el deshacer miró una línea de otro cliente o de otro campo');
  assert.deepEqual({ escritos: td2.escritos, salteados: td2.salteados }, { escritos: 0, salteados: { otro_campo: 1, ya_vacio: 1 } });
  assert.equal(crm['r337-c']!.campos[OTRO], 'Prioriza');
});

test('corta con 401 y con 429, respeta el tope, y un 200 que no escribe no cuenta como «quedó»', async () => {
  await sinContactos();
  await agendado('t1', { score: 90 });
  await agendado('t2', { score: 90 });
  await agendado('t3', { score: 90 });
  crm = { 'r337-t1': enElCrm(), 'r337-t2': enElCrm(), 'r337-t3': enElCrm() };
  instalarCrm();

  // El tope cuenta los PUT aceptados.
  let t = await correrElRelleno({ ambito: ambito(), acceso: ACCESO, campoId: CAMPO, candidatos: await candidatos(), tope: 1, pausaMs: 0, anotar: () => {} });
  assert.equal(t.escritos, 1);
  assert.equal(pedidos.filter((x) => x.metodo === 'PUT').length, 1);

  // Un 401 en el PUT corta: no se pide nada más.
  pedidos = [];
  const quedan = await candidatos();
  assert.equal(quedan.length, 2);
  crm[quedan[0]!.ghlContactId]!.put = 401;
  t = await correrElRelleno({ ambito: ambito(), acceso: ACCESO, campoId: CAMPO, candidatos: quedan, tope: 100, pausaMs: 0, anotar: () => {} });
  assert.match(t.cortada ?? '', /401/);
  assert.equal(t.escritos, 0);
  assert.deepEqual(pedidos.map((x) => [x.metodo, x.id]), [['GET', quedan[0]!.ghlContactId], ['PUT', quedan[0]!.ghlContactId]]);

  // Un 429 en el GET de precondición corta también.
  pedidos = [];
  delete crm[quedan[0]!.ghlContactId]!.put;
  crm[quedan[0]!.ghlContactId]!.get = 429;
  t = await correrElRelleno({ ambito: ambito(), acceso: ACCESO, campoId: CAMPO, candidatos: quedan, tope: 100, pausaMs: 0, anotar: () => {} });
  assert.match(t.cortada ?? '', /429/);
  assert.equal(pedidos.length, 1);

  // Un 200 que no escribe: se anota (por si hay que deshacer) pero no «quedó».
  delete crm[quedan[0]!.ghlContactId]!.get;
  crm[quedan[0]!.ghlContactId]!.put = 'ignora';
  const d = diario();
  t = await correrElRelleno({ ambito: ambito(), acceso: ACCESO, campoId: CAMPO, candidatos: [quedan[0]!], tope: 100, pausaMs: 0, anotar: d.anotar });
  assert.deepEqual([t.escritos, t.quedaron], [1, 0]);
  assert.equal(d.lineas[0]!.cuadranteDespues, null);
});

test('el seco: el guion imprime conteos, nunca nombres, y no escribe nada', async () => {
  await sinContactos();
  await agendado('s1', { score: 90 });
  await agendado('s2', { score: 55 });
  await agendado('s3', { score: null });
  const foto = async () =>
    JSON.stringify(
      await filas(
        admin,
        `select (select json_agg(c order by ghl_contact_id) from (select ghl_contact_id, cuadrante, territorio, campos_del_crm, sincronizado_el from negocio.contactos where org_id = $1) c) as contactos,
                (select count(*) from negocio.clasificaciones where org_id = $1) as clasif,
                (select count(*) from negocio.respuestas_del_lead where org_id = $1) as resp`,
        [org],
      ),
    );
  const antes = await foto();
  const entorno = { ...process.env };
  delete entorno.NODE_TEST_CONTEXT;
  const correr = (...args: string[]) =>
    spawnSync(process.execPath, ['scripts/clasificar-calificados-viejos.mjs', '--org', SLUG, ...args], { cwd: RAIZ, env: entorno, encoding: 'utf8', timeout: 120_000 });

  const r = correr();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /EN SECO \(no escribe nada\)/);
  assert.match(r.stdout, /CANDIDATOS:\s+3/);
  assert.match(r.stdout, /Prioriza\s+1/);
  assert.match(r.stdout, /Valida\s+1/);
  assert.match(r.stdout, /Descarta\s+1/);
  assert.doesNotMatch(r.stdout + r.stderr, new RegExp(NOMBRE), 'el seco imprimió un nombre');
  assert.doesNotMatch(r.stdout, /r337-/, 'el seco imprimió ids sin --muestra');

  // Con --muestra, ids del CRM y su valor; nombres, nunca.
  const m = correr('--muestra', '2');
  assert.equal(m.status, 0, m.stderr);
  assert.equal((m.stdout.match(/id del CRM r337-s\d → /g) ?? []).length, 2);
  assert.doesNotMatch(m.stdout, new RegExp(NOMBRE));

  // Una bandera desconocida o --seco con --escribir: no corre.
  assert.equal(correr('--escribri').status, 1);
  assert.equal(correr('--seco', '--escribir').status, 1);

  assert.equal(await foto(), antes, 'el seco escribió en la base');
});
