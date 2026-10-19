// LAS RUTAS MANUALES TRAEN A CADA CLIENTE, CON SU TOKEN Y EN SU ÁMBITO. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, G4)
//
// «Traer del calendario», el tic de la ingesta y «Traer de GoHighLevel» traían sólo al principal. Con un segundo
// cliente, ése quedaba sin leer por mucho que alguien apretara el botón, y el aviso de la agenda de la empresa —que
// mira el PEOR cliente activo— no se apagaba nunca. Una empresa con P (el principal), Y (activo, con su subcuenta) y Z
// (en pausa), y un GoHighLevel falso en el que cada token ve sólo su subcuenta (un token cruzado es 403):
//
//   · «Traer del calendario» lee a cada cliente activo con SU token y apaga el aviso de la agenda — mutaciones: volver
//     a `porOmisionDe`; darle a cada cliente el acceso de la empresa; sacar el filtro de estado de `clientesQueTrae`;
//   · con el foco en un cliente, igual trae a los dos: la Agenda es de la empresa entera — mutación: el foco sin
//     `ambitoDe`;
//   · la ingesta trae los mensajes de cada cliente en SU cliente, y un pedido enseguida frena sin ser un error, con el
//     nombre del cliente — mutaciones: abrir a todos con el ámbito del principal; 503 cuando ninguno corrió;
//   · la sincronización trae a los dos y la resta de uno no congela al otro — mutaciones: la empresa entera
//     (`exigirUnSoloCliente` lanza); `congelados` del primero;
//   · un cliente sin credenciales no tapa a los demás, y dice dónde se cargan las suyas; sin ninguna, de quién falta —
//     mutaciones: rechazar en cuanto falta uno; sin nombre delante; el texto de la empresa para un cliente;
//   · un cliente que falla no se lleva a los demás — mutación: cortar el bucle en el primer fallo;
//   · el cliente final no llega a ninguna, y queda en la auditoría — mutaciones: las rutas en `RUTAS_DEL_CLIENTE`;
//     sacar el paso 3b;
//   · con UN cliente, la respuesta de siempre — mutaciones: `clientes` o el nombre siempre;
//   · el presupuesto se mira antes de cada cliente, y el turno ROTA por el sello sin darle prioridad al atrasado —
//     mutaciones: sacar el turno; mirar el reloj una vez; mirarlo también antes del primero; priorizar `atrasado`;
//   · cada cliente tiene su agente del CRM — mutación: leer siempre el de la empresa.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import {
  agenteDelCrmDe,
  resolverAccesoAlAuditor,
  TEXTO_DE_FALTA_GHL,
  TEXTO_DE_FALTA_GHL_DEL_CLIENTE,
} from '../../lib/credenciales/resolver.ts';
import { agendaDelCloser } from '../../lib/negocio/agenda.ts';
import { cuentaDe, type AmbitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';
import { NO_CORRIO } from '../../lib/negocio/pulso.ts';
import {
  PRESUPUESTO_DE_LA_TRAIDA_MS,
  traerDeCadaCliente,
  type ClienteConAcceso,
  type DesenlaceDeUnCliente,
} from '../../lib/negocio/traerDeLosClientes.ts';
import { POST as refrescar } from '../../app/api/closer/agenda/refrescar/route.ts';
import { POST as ingesta } from '../../app/api/mensajes/ingesta/route.ts';
import { POST as sincronizar } from '../../app/api/contactos/sincronizar/route.ts';

const SLUG = 'gamma-282';
const SLUG_UNO = 'gamma-282-uno';
const GHL = 'https://services.leadconnectorhq.com';
type Quien = 'p' | 'y' | 'z' | 'u';
const TOKEN: Record<Quien, string> = { p: 'tok-p-282', y: 'tok-y-282', z: 'tok-z-282', u: 'tok-u-282' };
const LOCATION: Record<Quien, string> = { p: 'locP282', y: 'locY282', z: 'locZ282', u: 'locU282' };

let admin: Client;
let org: string;
let p: string;
let y: string;
let z: string;
let nombreP: string;
let tokenEmpresa: string;
let usuarioEmpresa: string;
let clienteFinal: string;
let tokenClienteFinal: string;
let orgUno: string;
let tokenUno: string;
const fetchOriginal = globalThis.fetch;

/** Lo que el GoHighLevel falso vio: el token, la location de cada pedido, y lo que rechazó. */
const vistos: { token: string; location: string | null; rechazo: number | null }[] = [];
/** Qué contactos tiene cada subcuenta para la búsqueda por etiqueta y las conversaciones. Las pruebas lo cambian. */
let contactosDe: Record<Quien, string[]> = { p: ['c282p1'], y: ['c282y1', 'c282y2'], z: [], u: [] };
/** Las subcuentas cuya búsqueda de contactos responde 429. */
const limitadas = new Set<string>();

const quienEs = (token: string): Quien | null =>
  (Object.keys(TOKEN) as Quien[]).find((q) => TOKEN[q] === token) ?? null;
/** De qué subcuenta es un contacto, por su nombre: `c282p1` es de P. */
const duenioDe = (contacto: string): Quien | null => (/^c282([pyzu])/.exec(contacto)?.[1] as Quien | undefined) ?? null;

function locationDe(url: string, cuerpo: unknown): string | null {
  const u = new URL(url);
  const enLaConsulta = u.searchParams.get('locationId');
  if (enLaConsulta) return enLaConsulta;
  const enElCamino = /\/locations\/([^/?]+)/.exec(u.pathname)?.[1];
  if (enElCamino) return decodeURIComponent(enElCamino);
  if (cuerpo && typeof cuerpo === 'object' && typeof (cuerpo as { locationId?: unknown }).locationId === 'string') {
    return (cuerpo as { locationId: string }).locationId;
  }
  return null;
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

/** Un GoHighLevel que se porta como el de verdad en lo que importa: cada token ve sólo su subcuenta. */
function ghlFalso(): typeof globalThis.fetch {
  return (async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : String((entrada as Request).url ?? entrada);
    if (!url.startsWith(GHL)) return json({}, 404);
    const token = new Headers(opciones?.headers).get('authorization')?.replace(/^Bearer /, '') ?? '';
    const cuerpo = typeof opciones?.body === 'string' ? (JSON.parse(opciones.body) as unknown) : null;
    const location = locationDe(url, cuerpo);
    const de = quienEs(token);
    // Lo que el pedido nombra de otra subcuenta: su location, su calendario o su conversación.
    const u = new URL(url);
    const calendario = u.searchParams.get('calendarId');
    const conversacion = /\/conversations\/conv-([^/]+)\/messages/.exec(u.pathname)?.[1] ?? null;
    const ajeno =
      (location !== null && location !== LOCATION[de ?? 'p']) ||
      (calendario !== null && calendario !== `cal-${de}`) ||
      (conversacion !== null && duenioDe(conversacion) !== de);
    const rechazo = de === null ? 401 : ajeno ? 403 : null;
    vistos.push({ token, location, rechazo });
    if (rechazo !== null) return json({ message: 'no' }, rechazo);
    const sufijo = de!;

    if (u.pathname === '/calendars/') {
      return json({ calendars: [{ id: `cal-${sufijo}`, name: `Calendario ${sufijo}`, isActive: true }] });
    }
    if (u.pathname === '/calendars/events') {
      // Una cita mañana de su primer contacto de siempre (c282p1, c282y1), con la forma que lee `leerCita`.
      const contacto = { p: 'c282p1', y: 'c282y1', z: 'c282z1', u: 'c282u1' }[sufijo];
      const inicio = new Date(Date.now() + 24 * 3600 * 1000);
      return json({
        events: [
          {
            id: `cita-${contacto}`,
            calendarId: `cal-${sufijo}`,
            contactId: contacto,
            title: 'Cita 282',
            startTime: inicio.toISOString(),
            endTime: new Date(inicio.getTime() + 3600 * 1000).toISOString(),
            appointmentStatus: 'confirmed',
            dateAdded: new Date().toISOString(),
          },
        ],
      });
    }
    if (url.includes('/contacts/search')) {
      if (limitadas.has(location ?? '')) return json({ message: 'despacio' }, 429);
      const etiqueta = (cuerpo as { filters?: { value?: string }[] } | null)?.filters?.[0]?.value;
      const ids = etiqueta === 'zona_closer' ? contactosDe[sufijo] : [];
      return json({
        contacts: ids.map((id) => ({ id, contactName: `Contacto ${id}`, tags: ['zona_closer'], dateAdded: new Date().toISOString() })),
        total: ids.length,
      });
    }
    if (url.includes('/conversations/search')) {
      return json({
        conversations: contactosDe[sufijo].map((c) => ({
          id: `conv-${c}`,
          contactId: c,
          lastMessageDate: new Date().toISOString(),
          lastMessageBody: 'hola',
          lastMessageDirection: 'inbound',
          lastMessageType: 'TYPE_WHATSAPP',
        })),
        total: contactosDe[sufijo].length,
      });
    }
    if (conversacion) {
      return json({
        messages: {
          messages: [
            {
              id: `m-${conversacion}`,
              conversationId: `conv-${conversacion}`,
              contactId: conversacion,
              body: 'hola',
              direction: 'inbound',
              messageType: 'TYPE_WHATSAPP',
              dateAdded: new Date().toISOString(),
            },
          ],
          lastMessageId: `m-${conversacion}`,
        },
      });
    }
    return json({});
  }) as typeof globalThis.fetch;
}

async function limpiar(slug: string): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [slug]);
  if (!o) return;
  for (const t of ['citas', 'mensajes', 'miniaturas_del_contacto', 'contactos', 'ingesta_pulso', 'tareas_programadas', 'campos_del_crm', 'carpetas_del_crm']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
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

const deCuenta = (c: string | null) => (c === p ? 'P' : c === y ? 'Y' : c === z ? 'Z' : String(c));
const POST = { metodo: 'POST' } as const;

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await limpiar(SLUG);
  await limpiar(SLUG_UNO);
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 282', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  const principal = await unaFila<{ id: string; nombre: string }>(
    admin,
    `select id, nombre from identidad.cuentas where org_id = $1 and es_por_omision`,
    [org],
  );
  const segunda = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, crm_cuenta_id) values ($1, 'Segunda 282', 'segunda-282', $2) returning id`,
    [org, LOCATION.y],
  );
  const pausada = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, crm_cuenta_id, estado) values ($1, 'Pausada 282', 'pausada-282', $2, 'pausada') returning id`,
    [org, LOCATION.z],
  );
  assert.ok(principal && segunda && pausada);
  p = principal.id;
  nombreP = principal.nombre;
  y = segunda.id;
  z = pausada.id;
  // Las credenciales, acá y no en el sembrado: la 60 vacía `organizaciones_credenciales` sin filtro.
  await conIdentidad(async (db) => {
    await db
      .insertInto('organizaciones_credenciales')
      .values({
        org_id: org,
        crm_token_cifrado: cifrar(TOKEN.p),
        crm_estado: 'activa',
        crm_cuenta_id: LOCATION.p,
        crm_agente_usuario_id: 'ag-p',
        ia_clave_cifrada: cifrar('sk-ant-282'),
      } as never)
      .execute();
    for (const [cuenta, quien, agente] of [[y, 'y', 'ag-y'], [z, 'z', 'ag-z']] as const) {
      await db
        .insertInto('cuentas_credenciales')
        .values({ org_id: org, cuenta_id: cuenta, crm_token_cifrado: cifrar(TOKEN[quien]), crm_estado: 'activa', crm_agente_usuario_id: agente } as never)
        .execute();
    }
  });
  for (const [cuenta, ghl] of [[p, 'c282p1'], [y, 'c282y1'], [y, 'c282y2']] as const) {
    await admin.query(
      `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm)
       values ($1, $2, $3, $4, 'closer', now() - interval '2 days')`,
      [org, cuenta, ghl, `Contacto ${ghl}`],
    );
  }
  usuarioEmpresa = await persona(org, 'Admin 282', 'administrador', [], []);
  tokenEmpresa = await sesionDe(usuarioEmpresa);
  clienteFinal = await persona(org, 'Cliente final 282', 'usuario', [y], ['contacts']);
  tokenClienteFinal = await sesionDe(clienteFinal);

  // La empresa de un solo cliente: su principal, con el token de la empresa.
  const uno = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 282 uno', $1, 'America/Lima') returning id`,
    [SLUG_UNO],
  );
  assert.ok(uno);
  orgUno = uno.id;
  await conIdentidad(async (db) => {
    await db
      .insertInto('organizaciones_credenciales')
      .values({ org_id: orgUno, crm_token_cifrado: cifrar(TOKEN.u), crm_estado: 'activa', crm_cuenta_id: LOCATION.u } as never)
      .execute();
  });
  tokenUno = await sesionDe(await persona(orgUno, 'Admin 282 uno', 'administrador', [], []));
  globalThis.fetch = ghlFalso();
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  try {
    await limpiar(SLUG);
    await limpiar(SLUG_UNO);
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

type Informe = { cuentaId: string; nombre: string; estado: string; codigo?: string; porque?: string; llamadas?: number };
const estados = (clientes: Informe[]) => clientes.map((c) => `${deCuenta(c.cuentaId)}:${c.estado}`);
const deEstaEmpresa = () => vistos.filter((v) => quienEs(v.token) !== 'u');
/** El aviso de la agenda de la empresa entera. El Setter no tiene citas: el aviso es el del barrido, haya citas o no. */
const avisoDeLaAgenda = async () => (await conOrganizacion(org, () => agendaDelCloser('setter', 'America/Lima', { dias: 3 }))).falta;

test('«Traer del calendario» lee a cada cliente activo con SU token y apaga el aviso de la agenda', async () => {
  assert.match(String(await avisoDeLaAgenda()), /Todavía no se leyó el calendario/);
  vistos.length = 0;
  const r = await leerRespuesta<{ corrio: boolean; calendarios: number; llamadas: number; clientes: Informe[] }>(
    await refrescar(pedirComo('/api/closer/agenda/refrescar', tokenEmpresa, POST)),
  );
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.corrio, true);
  assert.deepEqual(estados(r.cuerpo.clientes ?? []), ['P:corrio', 'Y:corrio'], 'no se trajo a cada cliente activo, o se trajo al que está en pausa');
  assert.equal(r.cuerpo.calendarios, 2);
  assert.equal(r.cuerpo.llamadas, 4);
  assert.deepEqual([...new Set(deEstaEmpresa().map((v) => v.token))].sort(), [TOKEN.p, TOKEN.y].sort(), 'un cliente se leyó con un token que no es el suyo');
  assert.deepEqual(deEstaEmpresa().filter((v) => v.rechazo !== null), [], 'un pedido cruzó tokens');

  const pulsos = await filas<{ cuenta: string }>(admin, `select cuenta_id as cuenta from negocio.ingesta_pulso where org_id = $1 and clave = 'citas'`, [org]);
  assert.deepEqual(pulsos.map((x) => deCuenta(x.cuenta)).sort(), ['P', 'Y']);
  const citas = await filas<{ ghl: string; cita: string; contacto: string }>(
    admin,
    `select k.ghl_contact_id as ghl, c.cuenta_id as cita, k.cuenta_id as contacto
       from negocio.citas c join negocio.contactos k on k.id = c.contacto_id where c.org_id = $1 order by 1`,
    [org],
  );
  assert.deepEqual(citas.map((c) => `${c.ghl}:${deCuenta(c.cita)}:${deCuenta(c.contacto)}`), ['c282p1:P:P', 'c282y1:Y:Y']);
  // Los dos clientes activos leídos: el aviso de la empresa entera se apaga.
  assert.doesNotMatch(String(await avisoDeLaAgenda()), /Todavía no se leyó el calendario|quedó incompleto/, 'el aviso de la agenda sigue prendido por un cliente sin leer');
});

test('con el foco en un cliente, «Traer del calendario» igual trae a los dos: la Agenda es de la empresa entera', async () => {
  await admin.query(`delete from negocio.ingesta_pulso where org_id = $1 and clave = 'citas'`, [org]);
  await admin.query(`update identidad.sesiones set cuenta_activa = $1 where usuario_id = $2`, [y, usuarioEmpresa]);
  try {
    const r = await refrescar(pedirComo('/api/closer/agenda/refrescar', tokenEmpresa, POST));
    assert.equal(r.status, 200, await r.clone().text());
  } finally {
    await admin.query(`update identidad.sesiones set cuenta_activa = null where usuario_id = $1`, [usuarioEmpresa]);
  }
  const pulsos = await filas<{ cuenta: string }>(admin, `select cuenta_id as cuenta from negocio.ingesta_pulso where org_id = $1 and clave = 'citas'`, [org]);
  assert.deepEqual(pulsos.map((x) => deCuenta(x.cuenta)).sort(), ['P', 'Y'], 'el foco decidió a quién trae la Agenda');
});

test('la ingesta trae los mensajes de cada cliente en SU cliente, y un pedido enseguida frena sin ser un error', async () => {
  vistos.length = 0;
  const r = await leerRespuesta<{ corrio: boolean; llamadas: number; clientes: Informe[] }>(
    await ingesta(pedirComo('/api/mensajes/ingesta', tokenEmpresa, POST)),
  );
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.corrio, true);
  assert.deepEqual(estados(r.cuerpo.clientes), ['P:corrio', 'Y:corrio']);
  assert.equal(r.cuerpo.llamadas, r.cuerpo.clientes.reduce((n, c) => n + (c.llamadas ?? 0), 0));
  assert.ok(r.cuerpo.llamadas > 0);
  assert.deepEqual(deEstaEmpresa().filter((v) => v.rechazo !== null), [], 'un pedido cruzó tokens');
  const mensajes = await filas<{ ghl: string; cuenta: string }>(
    admin,
    `select ghl_mensaje_id as ghl, cuenta_id as cuenta from negocio.mensajes where org_id = $1 order by 1`,
    [org],
  );
  assert.deepEqual(mensajes.map((m) => `${m.ghl}:${deCuenta(m.cuenta)}`), ['m-c282p1:P', 'm-c282y1:Y', 'm-c282y2:Y'], 'un mensaje quedó en otro cliente');

  // Enseguida: los dos frenan por el antirrebote, y es un 200 con el nombre del cliente delante.
  const otra = await leerRespuesta<{ corrio: boolean; porque: string; clientes: Informe[] }>(
    await ingesta(pedirComo('/api/mensajes/ingesta', tokenEmpresa, POST)),
  );
  assert.equal(otra.estado, 200, JSON.stringify(otra.cuerpo));
  assert.equal(otra.cuerpo.corrio, false);
  assert.equal(otra.cuerpo.porque, `${nombreP}: ${NO_CORRIO.reciente}`);
  assert.deepEqual(estados(otra.cuerpo.clientes), ['P:frenada', 'Y:frenada']);
});

test('la sincronización trae a los dos clientes, y la resta de uno no congela al otro', async () => {
  // Desde la última vez, la subcuenta de P ya no tiene a c282p1 y tiene a c282p2; la de Y ya no tiene a c282y2.
  contactosDe = { p: ['c282p2'], y: ['c282y1'], z: [], u: [] };
  vistos.length = 0;
  const r = await leerRespuesta<{ guardados: { closer: number }; congelados: number | null; clientes: Informe[] }>(
    await sincronizar(pedirComo('/api/contactos/sincronizar', tokenEmpresa, POST)),
  );
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  assert.deepEqual(estados(r.cuerpo.clientes), ['P:corrio', 'Y:corrio']);
  assert.equal(r.cuerpo.guardados.closer, 2);
  assert.equal(r.cuerpo.congelados, 2, 'la resta de los clientes no se sumó');
  assert.deepEqual(deEstaEmpresa().filter((v) => v.rechazo !== null), [], 'un pedido cruzó tokens');
  const territorios = await filas<{ ghl: string; territorio: string | null; cuenta: string }>(
    admin,
    `select ghl_contact_id as ghl, territorio, cuenta_id as cuenta from negocio.contactos where org_id = $1 order by 1`,
    [org],
  );
  assert.deepEqual(
    territorios.map((t) => `${t.ghl}:${deCuenta(t.cuenta)}:${t.territorio ?? 'congelado'}`),
    ['c282p1:P:congelado', 'c282p2:P:closer', 'c282y1:Y:closer', 'c282y2:Y:congelado'],
  );
});

test('un cliente sin credenciales no tapa a los demás y dice dónde se cargan; sin ninguna, de quién falta', async () => {
  await admin.query(`update identidad.cuentas_credenciales set crm_token_cifrado = null where cuenta_id = $1`, [y]);
  try {
    vistos.length = 0;
    const r = await leerRespuesta<{ clientes: Informe[] }>(await sincronizar(pedirComo('/api/contactos/sincronizar', tokenEmpresa, POST)));
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.deepEqual(estados(r.cuerpo.clientes), ['P:corrio', 'Y:saltada'], 'un cliente sin credenciales tapó a los demás');
    const deY = r.cuerpo.clientes[1]!;
    assert.equal(deY.codigo, 'credenciales_incompletas');
    // El suyo se carga en su Conexión, no en las credenciales de la empresa.
    assert.equal(deY.porque, TEXTO_DE_FALTA_GHL_DEL_CLIENTE.sin_token);
    assert.ok(!vistos.some((v) => v.token === TOKEN.y));

    await admin.query(`update identidad.organizaciones_credenciales set crm_token_cifrado = null where org_id = $1`, [org]);
    vistos.length = 0;
    const ninguno = await leerRespuesta<{ codigo: string; detalle: string }>(
      await sincronizar(pedirComo('/api/contactos/sincronizar', tokenEmpresa, POST)),
    );
    assert.equal(ninguno.estado, 409, JSON.stringify(ninguno.cuerpo));
    assert.equal(ninguno.cuerpo.codigo, 'credenciales_incompletas');
    assert.equal(ninguno.cuerpo.detalle, `${nombreP}: ${TEXTO_DE_FALTA_GHL.sin_token}`, 'el rechazo no dice de qué cliente falta');
    assert.deepEqual(vistos, []);
  } finally {
    await admin.query(`update identidad.cuentas_credenciales set crm_token_cifrado = $1 where cuenta_id = $2`, [cifrar(TOKEN.y), y]);
    await admin.query(`update identidad.organizaciones_credenciales set crm_token_cifrado = $1 where org_id = $2`, [cifrar(TOKEN.p), org]);
  }
});

test('un cliente que falla no se lleva a los demás', async () => {
  // P va primero (el principal): si el bucle cortara en su fallo, Y no se traería.
  limitadas.add(LOCATION.p);
  try {
    const r = await leerRespuesta<{ clientes: Informe[] }>(await sincronizar(pedirComo('/api/contactos/sincronizar', tokenEmpresa, POST)));
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.deepEqual(estados(r.cuerpo.clientes), ['P:fallo', 'Y:corrio'], 'el fallo de un cliente se llevó a los demás');
    assert.equal(r.cuerpo.clientes[0]!.codigo, 'servicio_externo_saturado');

    limitadas.add(LOCATION.y);
    const todos = await leerRespuesta<{ codigo: string; detalle: string }>(
      await sincronizar(pedirComo('/api/contactos/sincronizar', tokenEmpresa, POST)),
    );
    assert.equal(todos.estado, 429, JSON.stringify(todos.cuerpo));
    assert.match(todos.cuerpo.detalle, new RegExp(`^${nombreP}: GoHighLevel está limitando`));
  } finally {
    limitadas.clear();
  }
});

test('el cliente final no llega a ninguna de las tres, y el rechazo queda en la auditoría', async () => {
  vistos.length = 0;
  for (const [ruta, manejador] of [
    ['/api/closer/agenda/refrescar', refrescar],
    ['/api/mensajes/ingesta', ingesta],
    ['/api/contactos/sincronizar', sincronizar],
  ] as const) {
    const r = await leerRespuesta<{ codigo: string }>(await manejador(pedirComo(ruta, tokenClienteFinal, POST)));
    assert.deepEqual({ ruta, estado: r.estado, codigo: r.cuerpo.codigo }, { ruta, estado: 403, codigo: 'fuera_de_su_cuenta' });
  }
  assert.deepEqual(vistos, [], 'el cliente final llegó al CRM');
  const auditoria = await filas<{ ruta: string }>(
    admin,
    `select detalle->>'ruta' as ruta from identidad.auditoria_accesos where usuario_id = $1 and accion = 'fuera_de_su_cuenta' order by 1`,
    [clienteFinal],
  );
  assert.deepEqual(auditoria.map((a) => a.ruta), ['POST /api/closer/agenda/refrescar', 'POST /api/contactos/sincronizar', 'POST /api/mensajes/ingesta']);
});

test('con un solo cliente, la respuesta es la de siempre: sin `clientes` y sin nombre delante', async () => {
  const r = await leerRespuesta<Record<string, unknown>>(await refrescar(pedirComo('/api/closer/agenda/refrescar', tokenUno, POST)));
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  assert.deepEqual(Object.keys(r.cuerpo), ['corrio', 'calendarios', 'vistas', 'nuestras', 'guardadas', 'borradas', 'sinHora', 'canceladas', 'llamadas', 'atrasado']);
  const i = await leerRespuesta<Record<string, unknown>>(await ingesta(pedirComo('/api/mensajes/ingesta', tokenUno, POST)));
  assert.equal(i.estado, 200, JSON.stringify(i.cuerpo));
  assert.deepEqual(Object.keys(i.cuerpo), ['corrio', 'llamadas', 'miradas', 'nuestras', 'mensajesNuevos', 'sinFecha', 'atrasado', 'entregasRevisadas', 'entregasResueltas']);
  // Un pedido enseguida: el 200 de siempre, con el texto de siempre.
  const frenada = await leerRespuesta<Record<string, unknown>>(await ingesta(pedirComo('/api/mensajes/ingesta', tokenUno, POST)));
  assert.deepEqual(frenada.cuerpo, { corrio: false, porque: NO_CORRIO.reciente });

  await admin.query(`update identidad.organizaciones_credenciales set crm_token_cifrado = null where org_id = $1`, [orgUno]);
  const s = await leerRespuesta<{ codigo: string; detalle: string }>(await sincronizar(pedirComo('/api/contactos/sincronizar', tokenUno, POST)));
  assert.deepEqual({ estado: s.estado, codigo: s.cuerpo.codigo, detalle: s.cuerpo.detalle }, {
    estado: 409,
    codigo: 'credenciales_incompletas',
    detalle: TEXTO_DE_FALTA_GHL.sin_token,
  });
});

/** Los dos clientes, listos, para llamar al bucle directo. */
const listos = (): ClienteConAcceso[] => [
  { id: p, nombre: nombreP, esPorOmision: true, acceso: { tipo: 'listo', token: TOKEN.p, locationId: LOCATION.p } },
  { id: y, nombre: 'Segunda 282', esPorOmision: false, acceso: { tipo: 'listo', token: TOKEN.y, locationId: LOCATION.y } },
];
const SI_LANZA = { codigo: 'servicio_externo_no_disponible', porque: 'cayó' } as const;
const renglon = (x: { cuentaId: string; estado: string }) => `${deCuenta(x.cuentaId)}:${x.estado}`;

test('el presupuesto se mira antes de cada cliente salvo el primero, y el que nunca se trajo va primero', async () => {
  await admin.query(`delete from negocio.ingesta_pulso where org_id = $1`, [org]);
  await admin.query(
    `insert into negocio.ingesta_pulso (org_id, cuenta_id, clave, ultima_corrida_el, atrasado) values ($1, $2, 'citas', now() - interval '1 hour', false)`,
    [org, p],
  );
  // El reloj avanza sólo cuando Y trabaja: Y es lento.
  let t = 0;
  const llamados: string[] = [];
  const traer = async (ambito: AmbitoDeUnCliente): Promise<DesenlaceDeUnCliente<number>> => {
    llamados.push(deCuenta(cuentaDe(ambito)));
    if (cuentaDe(ambito) === y) t += PRESUPUESTO_DE_LA_TRAIDA_MS + 1;
    return { estado: 'corrio', resultado: 0, llamadas: 0 };
  };
  const r = await traerDeCadaCliente(org, listos(), traer, { presupuestoMs: PRESUPUESTO_DE_LA_TRAIDA_MS, pulso: 'citas', siLanza: SI_LANZA, ahora: () => t });
  assert.deepEqual(llamados, ['Y'], 'el que nunca se trajo no fue primero, o el presupuesto no se miró antes del segundo');
  assert.deepEqual(r.map(renglon), ['Y:corrio', 'P:sin_tiempo']);

  // Con el reloj vencido desde el principio, el primero corre igual: con un cliente, la ruta hace lo de siempre.
  llamados.length = 0;
  let n = 0;
  const vencido = () => (n++ === 0 ? 0 : PRESUPUESTO_DE_LA_TRAIDA_MS + 1);
  const r2 = await traerDeCadaCliente(org, listos(), async (ambito) => {
    llamados.push(deCuenta(cuentaDe(ambito)));
    return { estado: 'corrio', resultado: 0, llamadas: 0 };
  }, { presupuestoMs: PRESUPUESTO_DE_LA_TRAIDA_MS, siLanza: SI_LANZA, ahora: vencido });
  assert.deepEqual(r2.map(renglon), ['P:corrio', 'Y:sin_tiempo'], 'con el reloj vencido no corrió nadie');
});

test('el turno ROTA por el sello: un cliente atrasado y lento no deja sin traer a los demás', async () => {
  // Y está atrasado (un relleno inicial, o caído) pero se trajo hace un minuto; P está al día y lleva dos.
  await admin.query(`delete from negocio.ingesta_pulso where org_id = $1`, [org]);
  await admin.query(
    `insert into negocio.ingesta_pulso (org_id, cuenta_id, clave, ultima_corrida_el, atrasado)
     values ($1, $2, 'mensajes', now() - interval '2 minutes', false), ($1, $3, 'mensajes', now() - interval '1 minute', true)`,
    [org, p, y],
  );
  const llamados: string[] = [];
  let t = 0;
  // Como el reclamo de `conElPulso`: estampa el sello al empezar. Y es lento: se come el tic entero.
  const traer = async (ambito: AmbitoDeUnCliente): Promise<DesenlaceDeUnCliente<number>> => {
    const c = cuentaDe(ambito);
    llamados.push(deCuenta(c));
    await admin.query(`update negocio.ingesta_pulso set ultima_corrida_el = now() where org_id = $1 and cuenta_id = $2 and clave = 'mensajes'`, [org, c]);
    if (c === y) t += 10_001;
    return { estado: 'corrio', resultado: 0, llamadas: 0 };
  };
  const tic = () => traerDeCadaCliente(org, listos(), traer, { presupuestoMs: 10_000, pulso: 'mensajes', siLanza: SI_LANZA, ahora: () => t });

  // El que lleva más sin traerse va primero, aunque el otro esté atrasado.
  assert.deepEqual((await tic()).map(renglon), ['P:corrio', 'Y:corrio'], 'el turno le dio prioridad al cliente atrasado');
  // Ahora Y lleva más: va primero, es lento, y P se queda sin tiempo en este tic…
  await admin.query(`update negocio.ingesta_pulso set ultima_corrida_el = now() - interval '5 minutes' where org_id = $1 and cuenta_id = $2`, [org, y]);
  llamados.length = 0;
  assert.deepEqual((await tic()).map(renglon), ['Y:corrio', 'P:sin_tiempo']);
  // …pero en el siguiente le toca: el sello de Y quedó nuevo. Con «atrasado primero», P no se traería nunca.
  assert.deepEqual((await tic()).map(renglon), ['P:corrio', 'Y:corrio'], 'un cliente atrasado y lento dejó a los demás sin traer');
  assert.deepEqual(llamados, ['Y', 'P', 'Y']);
});

test('cada cliente tiene su agente del CRM', async () => {
  await conIdentidad(async (db) => {
    assert.equal(await agenteDelCrmDe(db, org, { id: p, esPorOmision: true }), 'ag-p');
    assert.equal(await agenteDelCrmDe(db, org, 'la_de_la_empresa'), 'ag-p');
    assert.equal(await agenteDelCrmDe(db, org, { id: y, esPorOmision: false }), 'ag-y', 'el agente de un cliente salió de la empresa');
    const auditor = await resolverAccesoAlAuditor(db, org, { id: y, esPorOmision: false });
    assert.equal(auditor.tipo === 'listo' ? auditor.idDelAgente : auditor.que, 'ag-y', 'el guion y el auditor no leen el mismo agente');
  });
  await admin.query(`update identidad.cuentas_credenciales set crm_agente_usuario_id = '  ' where cuenta_id = $1`, [y]);
  try {
    assert.equal(await conIdentidad((db) => agenteDelCrmDe(db, org, { id: y, esPorOmision: false })), null);
  } finally {
    await admin.query(`update identidad.cuentas_credenciales set crm_agente_usuario_id = 'ag-y' where cuenta_id = $1`, [y]);
  }
});
