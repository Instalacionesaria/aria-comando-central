// LO QUE USABA LAS CREDENCIALES DE LA EMPRESA USA LAS DEL CLIENTE. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C6 · D2)
//
// Una empresa con P (el principal, con las credenciales de la empresa), X (activo, con su token y su subcuenta), Z
// (activo, sin conexión), W (en pausa) y B (de baja); otra con un solo cliente activo y uno en pausa. Un n8n y un
// GoHighLevel falsos anotan qué token y qué subcuenta recibió cada pedido:
//
//   · «Subir a HighLevel» de Tools manda a n8n el token y la location del cliente ELEGIDO (sin elegir, el principal) y
//     dice a cuál fue sólo con más de un cliente activo — mutaciones: `'la_de_la_empresa'` de vuelta; `cliente` con
//     uno solo; `varios` sobre los visibles y no sobre los activos; el principal mal resuelto;
//   · a uno sin conexión le dice qué falta con el texto DEL CLIENTE y no llama a nadie; uno en pausa es 400; uno de otra
//     empresa, de baja o que no es un id, 404; el cliente final no llega — mutaciones: el texto de la empresa; aceptar
//     uno en pausa; caer al principal con uno desconocido;
//   · la lista de usuarios del CRM: sin `?cuenta=`, el principal con lo de la empresa; uno de baja es 404; al que no
//     tiene conexión, o cuyo token rechaza GoHighLevel, el texto del cliente — mutaciones: sin el filtro de baja; el
//     texto de la empresa; el principal mal resuelto;
//   · las cuatro rutas de un contacto dicen el texto del cliente del contacto: el de la empresa para el principal, el
//     del cliente para los demás — mutación: el texto de la empresa en cualquiera de las cuatro.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { crearTablasDePublic, quitarTablasDePublic } from '../apoyo/tablas-de-public.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { TEXTO_DE_FALTA_GHL, TEXTO_DE_FALTA_GHL_DEL_CLIENTE } from '../../lib/credenciales/resolver.ts';
import { POST as enviar } from '../../app/api/tools/leads/enviar/route.ts';
import { GET as usuariosDelCrm } from '../../app/api/admin/closer/usuarios-crm/route.ts';
import { GET as verContacto } from '../../app/api/contactos/[id]/route.ts';
import { POST as resolver } from '../../app/api/contactos/[id]/resolver/route.ts';
import { POST as escribir } from '../../app/api/contactos/[id]/mensajes/route.ts';
import { POST as avanzar } from '../../app/api/contactos/[id]/avanzar/route.ts';

const SLUG = 'gamma-292';
const SLUG_UNO = 'gamma-292-uno';
const N8N = 'https://n8n.ejemplo.test/webhook/292';
const EMPRESA = { token: 'tok-empresa-292', location: 'locE292', agente: 'ag-empresa-292' };
const DE_X = { token: 'tok-x-292', location: 'locX292', agente: 'ag-x-292' };
const UNO = { token: 'tok-uno-292', location: 'locU292' };
const MANANA = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);

let admin: Client;
let org: string;
let p: string;
let nombreP: string;
let x: string;
let z: string;
let w: string;
let b: string;
let deBeta: string;
let tokenAdmin: string;
let tokenClienteFinal: string;
let orgUno: string;
let pUno: string;
let tokenUno: string;
let leads: string[] = [];
let leadsUno: string[] = [];
let webhookPrevio: string | undefined;
/** Las tablas de `public` del scraper no existen en la base local: las crea esta prueba (si no estaban). */
let creadas: string[] = [];
const fetchOriginal = globalThis.fetch;

/** Lo que recibió n8n: el token y la location del cuerpo, y cuántos leads. */
const aN8n: { apiToken: string; locationId: string; leads: number }[] = [];
/** Lo que recibió GoHighLevel: el token de cada llamada. */
const aGhl: string[] = [];
/** Los tokens que GoHighLevel rechaza con un 401. */
const rechazados = new Set<string>();

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

function falsos(): typeof globalThis.fetch {
  return (async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : String((entrada as Request).url ?? entrada);
    if (url === N8N) {
      const c = JSON.parse(String(opciones?.body)) as { apiToken: string; locationId: string; leads: unknown[] };
      aN8n.push({ apiToken: c.apiToken, locationId: c.locationId, leads: c.leads.length });
      return json({ ok: true });
    }
    const token = new Headers(opciones?.headers).get('authorization')?.replace(/^Bearer /, '') ?? '';
    aGhl.push(token);
    if (rechazados.has(token)) return json({ message: 'no' }, 401);
    return json({ users: [], contacts: [], messages: [] });
  }) as typeof globalThis.fetch;
}

async function limpiar(slug: string): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [slug]);
  if (!o) return;
  for (const t of ['resultados', 'notas', 'tareas', 'mensajes', 'contactos']) await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  await admin.query(`delete from public.aria_cc_scraper_leads where org_id = $1`, [o.id]);
  await admin.query(`delete from public.aria_cc_scraper_trabajos where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.organizaciones_credenciales where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Una persona de la organización con un rol de sistema; con cuentas, es un cliente final. */
async function persona(orgId: string, nombre: string, rol: string, cuentas: string[], secciones: string[]): Promise<string> {
  const u = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.usuarios (org_id, nombre, limitado_a_cuentas) values ($1, $2, $3) returning id`,
    [orgId, nombre, cuentas.length > 0],
  );
  assert.ok(u);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = $2 and org_id is null`,
    [u.id, rol],
  );
  for (const s of secciones) await admin.query(`insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, $2)`, [u.id, s]);
  for (const c of cuentas) {
    await admin.query(`insert into identidad.usuarios_cuentas (org_id, usuario_id, cuenta_id) values ($1, $2, $3)`, [orgId, u.id, c]);
  }
  return u.id;
}

async function cliente(orgId: string, nombre: string, slug: string, extra: { location?: string; estado?: string } = {}): Promise<string> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, crm_cuenta_id, estado, baja_el)
     values ($1, $2, $3, $4, $5, case when $5 = 'baja' then now() end) returning id`,
    [orgId, nombre, slug, extra.location ?? null, extra.estado ?? 'activa'],
  );
  assert.ok(c);
  return c.id;
}

/** Un trabajo del scraper y dos leads, como los escribiría el backend de Python. */
async function dosLeads(orgId: string): Promise<string[]> {
  const trabajo = randomUUID();
  await admin.query(
    `insert into public.aria_cc_scraper_trabajos (org_id, id, fuente, status, business_type, location, results_data)
       values ($1, $2, 'maps', 'COMPLETED', 'clínicas 292', 'PE', '{}'::jsonb)`,
    [orgId, trabajo],
  );
  const ids: string[] = [];
  for (const n of ['uno', 'dos']) {
    const l = await unaFila<{ id: string }>(
      admin,
      `insert into public.aria_cc_scraper_leads (org_id, trabajo_id, source, name, email) values ($1, $2, 'maps', $3, $4) returning id`,
      [orgId, trabajo, `Clínica sintética ${n} 292`, `${n}@leads-292.test`],
    );
    assert.ok(l);
    ids.push(l.id);
  }
  return ids;
}

/** Un contacto del cliente, del closer, que escribió hace un rato (la ventana de respuesta está abierta). */
async function contactoDe(cuenta: string, ghlId: string): Promise<string> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, ultimo_entrante_el)
     values ($1, $2, $3, 'Contacto 292', 'closer', now(), now() - interval '1 hour') returning id`,
    [org, cuenta, ghlId],
  );
  assert.ok(c);
  return c.id;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const subir = (token: string, cuerpo: Record<string, unknown>) =>
  enviar(pedirComo('/api/tools/leads/enviar', token, { metodo: 'POST', cuerpo }));

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  webhookPrevio = process.env.N8N_HIGHLEVEL_WEBHOOK;
  process.env.N8N_HIGHLEVEL_WEBHOOK = N8N;
  admin = await conectar('admin');
  creadas = await crearTablasDePublic(admin);
  await limpiar(SLUG);
  await limpiar(SLUG_UNO);

  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 292', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  const principal = await unaFila<{ id: string; nombre: string }>(admin, `select id, nombre from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  const beta = await unaFila<{ id: string }>(
    admin,
    `select c.id from identidad.cuentas c join identidad.organizaciones o on o.id = c.org_id where o.slug = 'beta' and c.es_por_omision`,
  );
  assert.ok(principal && beta, 'falta el sembrado');
  p = principal.id;
  nombreP = principal.nombre;
  deBeta = beta.id;
  x = await cliente(org, 'Segunda 292', 'segunda-292', { location: DE_X.location });
  z = await cliente(org, 'Tercera 292', 'tercera-292');
  w = await cliente(org, 'En pausa 292', 'pausa-292', { estado: 'pausada' });
  b = await cliente(org, 'De baja 292', 'baja-292', { estado: 'baja' });

  const o1 = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 292 uno', $1, 'America/Lima') returning id`,
    [SLUG_UNO],
  );
  assert.ok(o1);
  orgUno = o1.id;
  const p1 = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [orgUno]);
  assert.ok(p1);
  pUno = p1.id;
  // Un activo y uno en pausa: para Tools, sigue siendo una empresa de un solo cliente.
  await cliente(orgUno, 'En pausa 292 uno', 'pausa-292-uno', { estado: 'pausada' });

  // Las credenciales, acá y no en el sembrado: la 60 vacía `organizaciones_credenciales` sin filtro.
  await conIdentidad(async (db) => {
    await db
      .insertInto('organizaciones_credenciales')
      .values({
        org_id: org,
        crm_token_cifrado: cifrar(EMPRESA.token),
        crm_estado: 'activa',
        crm_cuenta_id: EMPRESA.location,
        crm_agente_usuario_id: EMPRESA.agente,
      } as never)
      .execute();
    await db
      .insertInto('cuentas_credenciales')
      .values({ org_id: org, cuenta_id: x, crm_token_cifrado: cifrar(DE_X.token), crm_estado: 'activa', crm_agente_usuario_id: DE_X.agente } as never)
      .execute();
    await db
      .insertInto('organizaciones_credenciales')
      .values({ org_id: orgUno, crm_token_cifrado: cifrar(UNO.token), crm_estado: 'activa', crm_cuenta_id: UNO.location } as never)
      .execute();
  });

  leads = await dosLeads(org);
  leadsUno = await dosLeads(orgUno);
  tokenAdmin = await sesionDe(await persona(org, 'Admin 292', 'administrador', [], []));
  tokenClienteFinal = await sesionDe(await persona(org, 'Cliente final 292', 'usuario', [x], ['contacts']));
  tokenUno = await sesionDe(await persona(orgUno, 'Admin 292 uno', 'administrador', [], []));
  globalThis.fetch = falsos();
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  if (webhookPrevio === undefined) delete process.env.N8N_HIGHLEVEL_WEBHOOK;
  else process.env.N8N_HIGHLEVEL_WEBHOOK = webhookPrevio;
  try {
    await limpiar(SLUG);
    await limpiar(SLUG_UNO);
    await quitarTablasDePublic(admin, creadas);
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('con un solo cliente activo, Tools sube como siempre: lo de la empresa y la respuesta de siempre', async () => {
  for (const cuerpo of [{ ids: leadsUno }, { ids: leadsUno, cuentaId: pUno }, { ids: leadsUno, cuentaId: '' }]) {
    aN8n.length = 0;
    const r = await leerRespuesta<Record<string, unknown>>(await subir(tokenUno, cuerpo));
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    // Exactamente el cuerpo de antes: con uno activo (y otro en pausa) no hay a quién nombrar.
    assert.deepEqual(r.cuerpo, { enviados: 2, etiqueta: 'ARIA' }, `con ${JSON.stringify(cuerpo)} la respuesta cambió`);
    assert.deepEqual(aN8n, [{ apiToken: UNO.token, locationId: UNO.location, leads: 2 }], 'n8n no recibió lo de la empresa');
  }
});

test('con varios, sin elegir va al principal con lo de la empresa, y la respuesta lo nombra', async () => {
  aN8n.length = 0;
  const r = await leerRespuesta<Record<string, unknown>>(await subir(tokenAdmin, { ids: leads, etiqueta: 'Lote 292' }));
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  assert.deepEqual(r.cuerpo, { enviados: 2, etiqueta: 'Lote 292', cliente: nombreP });
  assert.deepEqual(aN8n, [{ apiToken: EMPRESA.token, locationId: EMPRESA.location, leads: 2 }]);
});

test('el cliente elegido recibe los leads con SU token y SU subcuenta', async () => {
  aN8n.length = 0;
  const r = await leerRespuesta<Record<string, unknown>>(await subir(tokenAdmin, { ids: leads, cuentaId: x }));
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  assert.deepEqual(r.cuerpo, { enviados: 2, etiqueta: 'ARIA', cliente: 'Segunda 292' });
  assert.deepEqual(aN8n, [{ apiToken: DE_X.token, locationId: DE_X.location, leads: 2 }], 'los leads de X fueron a otra subcuenta');
});

test('un cliente sin conexión: qué le falta, con el texto del cliente, y n8n no recibe nada', async () => {
  aN8n.length = 0;
  const r = await leerRespuesta<{ codigo: string; detalle: string }>(await subir(tokenAdmin, { ids: leads, cuentaId: z }));
  assert.deepEqual(
    r,
    { estado: 409, cuerpo: { codigo: 'credenciales_incompletas', detalle: TEXTO_DE_FALTA_GHL_DEL_CLIENTE.sin_token } },
    'a Z le faltan sus credenciales: no las de la empresa, ni se cae a ellas',
  );
  assert.deepEqual(aN8n, [], 'se subieron leads de Z a otra subcuenta');
});

test('uno en pausa es 400; uno de otra empresa, de baja o que no es un id, 404; nadie recibe nada', async () => {
  aN8n.length = 0;
  const enPausa = await leerRespuesta<{ codigo: string }>(await subir(tokenAdmin, { ids: leads, cuentaId: w }));
  assert.deepEqual({ estado: enPausa.estado, codigo: enPausa.cuerpo.codigo }, { estado: 400, codigo: 'peticion_invalida' }, 'se le subieron leads a uno en pausa');
  for (const ajeno of [deBeta, b, 'no-es-un-id', 292]) {
    const r = await leerRespuesta<{ codigo: string }>(await subir(tokenAdmin, { ids: leads, cuentaId: ajeno }));
    assert.deepEqual({ estado: r.estado, codigo: r.cuerpo.codigo }, { estado: 404, codigo: 'no_encontrado' }, `con ${String(ajeno)} se subió igual`);
  }
  assert.deepEqual(aN8n, [], 'un destino que no es de la empresa recibió leads');
});

test('el cliente final no llega a Tools', async () => {
  aN8n.length = 0;
  const r = await leerRespuesta<{ codigo: string }>(await subir(tokenClienteFinal, { ids: leads, cuentaId: x }));
  assert.deepEqual({ estado: r.estado, codigo: r.cuerpo.codigo }, { estado: 403, codigo: 'fuera_de_su_cuenta' });
  assert.deepEqual(aN8n, []);
});

test('la lista de usuarios del CRM: el principal sin elegir, uno de baja es 404 y la falta de un cliente con su texto', async () => {
  aGhl.length = 0;
  const empresa = await leerRespuesta<{ agenteId: string | null }>(await usuariosDelCrm(pedirComo('/api/admin/closer/usuarios-crm', tokenAdmin)));
  assert.equal(empresa.estado, 200, JSON.stringify(empresa.cuerpo));
  assert.equal(empresa.cuerpo.agenteId, EMPRESA.agente);
  assert.deepEqual(aGhl, [EMPRESA.token], 'sin `?cuenta=`, la lista no es la de la subcuenta de la empresa');

  const deBaja = await usuariosDelCrm(pedirComo(`/api/admin/closer/usuarios-crm?cuenta=${b}`, tokenAdmin));
  assert.equal(deBaja.status, 404, 'se leyeron los usuarios de un cliente dado de baja');

  const deZ = await leerRespuesta<{ codigo: string; detalle: string }>(await usuariosDelCrm(pedirComo(`/api/admin/closer/usuarios-crm?cuenta=${z}`, tokenAdmin)));
  assert.deepEqual(deZ, { estado: 409, cuerpo: { codigo: 'credenciales_incompletas', detalle: TEXTO_DE_FALTA_GHL_DEL_CLIENTE.sin_token } });

  // El token rechazado: el de un cliente se vuelve a cargar en SU Conexión; el de la empresa, como siempre.
  rechazados.add(DE_X.token);
  rechazados.add(EMPRESA.token);
  try {
    const deX = await leerRespuesta<{ detalle: string }>(await usuariosDelCrm(pedirComo(`/api/admin/closer/usuarios-crm?cuenta=${x}`, tokenAdmin)));
    assert.equal(deX.cuerpo.detalle, 'GoHighLevel rechazó el token de este cliente. Hay que volver a cargarlo en Ajustes › Clientes › Conexión.');
    const deP = await leerRespuesta<{ detalle: string }>(await usuariosDelCrm(pedirComo(`/api/admin/closer/usuarios-crm?cuenta=${p}`, tokenAdmin)));
    assert.equal(deP.cuerpo.detalle, 'GoHighLevel rechazó el token. Hay que volver a cargarlo en Integraciones.');
  } finally {
    rechazados.clear();
  }
});

test('las cuatro rutas de un contacto dicen el texto de su cliente: el de la empresa sólo para el principal', async () => {
  const deP = await contactoDe(p, 'c292p');
  const deZ = await contactoDe(z, 'c292z');
  // La conexión de la empresa, revocada: el principal recibe el texto de la empresa; Z, el suyo.
  await admin.query(`update identidad.organizaciones_credenciales set crm_estado = 'revocada' where org_id = $1`, [org]);
  try {
    const casos = [
      { contacto: deP, esperado: TEXTO_DE_FALTA_GHL.token_revocado },
      { contacto: deZ, esperado: TEXTO_DE_FALTA_GHL_DEL_CLIENTE.sin_token },
    ];
    for (const { contacto, esperado } of casos) {
      const quien = contacto === deP ? 'P' : 'Z';
      const ficha = await leerRespuesta<{ refresco: { porque: string | null } }>(await verContacto(pedirComo(`/api/contactos/${contacto}`, tokenAdmin), ctx(contacto)));
      assert.equal(ficha.estado, 200, JSON.stringify(ficha.cuerpo));
      assert.ok(ficha.cuerpo.refresco.porque?.endsWith(` ${esperado}`), `la ficha de ${quien} dice: ${ficha.cuerpo.refresco.porque}`);

      const resuelto = await leerRespuesta<{ codigo: string; detalle: string }>(
        await resolver(pedirComo(`/api/contactos/${contacto}/resolver`, tokenAdmin, { metodo: 'POST' }), ctx(contacto)),
      );
      assert.deepEqual(resuelto, { estado: 503, cuerpo: { codigo: 'servicio_externo_no_disponible', detalle: esperado } }, `resolver de ${quien}`);

      const escrito = await leerRespuesta<{ codigo: string; detalle: string }>(
        await escribir(pedirComo(`/api/contactos/${contacto}/mensajes`, tokenAdmin, { metodo: 'POST', cuerpo: { texto: 'Hola' } }), ctx(contacto)),
      );
      assert.deepEqual(escrito, { estado: 409, cuerpo: { codigo: 'credenciales_incompletas', detalle: esperado } }, `mensajes de ${quien}`);

      const avanzado = await leerRespuesta<{ crm: { avisado: boolean; porque: string | null } }>(
        await avanzar(
          pedirComo(`/api/contactos/${contacto}/avanzar`, tokenAdmin, {
            metodo: 'POST',
            cuerpo: { claveDeIntento: randomUUID(), salida: 'no_show', detalle: 'Plantón sin aviso', nota: 'no apareció', volverEl: MANANA },
          }),
          ctx(contacto),
        ),
      );
      assert.equal(avanzado.estado, 201, JSON.stringify(avanzado.cuerpo));
      assert.deepEqual(avanzado.cuerpo.crm, { avisado: false, etiquetas: [], porque: esperado }, `avanzar de ${quien}`);
    }
  } finally {
    await admin.query(`update identidad.organizaciones_credenciales set crm_estado = 'activa' where org_id = $1`, [org]);
  }
});
