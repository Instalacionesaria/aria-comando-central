// DE PUNTA A PUNTA: UNA EMPRESA CON DOS CLIENTES, CADA UNO CON SU SUBCUENTA, POR EL CRON DE VERDAD. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Bloque C, Paso C6)
//
// Las pruebas de cada paso miran una pieza. Ésta junta todas, por la ruta del cron (`GET /api/cron`), con un
// GoHighLevel falso que se comporta como el de verdad en lo único que importa acá: **cada token ve sólo su subcuenta**.
// Un pedido con el token de P a la location de Y es un 403, y uno con un token desconocido, un 401.
//
// Una empresa con P (el principal, con las credenciales de la empresa) e Y (con su propia subcuenta y su token):
//
//   · el cron lee los contactos y los mensajes de cada cliente con SU token, y cada fila queda en SU cliente;
//   · cada cliente tiene su pulso y sus sellos, y los de los dos dicen `corrio`;
//   · ningún pedido cruzó tokens: si uno lo hubiera hecho, el GoHighLevel falso lo habría rechazado y el sello lo diría;
//   · la sincronización manual (Setter › Contactos, «Traer de GoHighLevel») trae a cada cliente con SU token, y la
//     resta de uno no congela al otro (G4).
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { GET as cron } from '../../app/api/cron/route.ts';
import { POST as sincronizar } from '../../app/api/contactos/sincronizar/route.ts';

const SLUG = 'gamma-280';
const GHL = 'https://services.leadconnectorhq.com';
const TOKEN = { p: 'tok-p-280', y: 'tok-y-280' } as const;
const LOCATION = { p: 'locP280', y: 'locY280' } as const;

let admin: Client;
let org: string;
let p: string;
let y: string;
let secretoPrevio: string | undefined;
const fetchOriginal = globalThis.fetch;
/** Lo que el GoHighLevel falso vio: el token y la location de cada pedido, y lo que rechazó. */
const vistos: { token: string; location: string | null; rechazo: number | null }[] = [];
/** Qué contactos devuelve la búsqueda por etiqueta de cada subcuenta. Las pruebas lo cambian. */
let contactosDe: Record<'p' | 'y', string[]> = { p: ['c280p1'], y: ['c280y1'] };

/** De quién es un token, o `null` si no es de nadie. */
const quien = (token: string): 'p' | 'y' | null => (token === TOKEN.p ? 'p' : token === TOKEN.y ? 'y' : null);

/** La location de un pedido, donde sea que la lleve: en la consulta, en el camino o en el cuerpo. */
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

function ghlFalso(): typeof globalThis.fetch {
  return (async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : String((entrada as Request).url ?? entrada);
    if (!url.startsWith(GHL)) return json({}, 404);
    const token = new Headers(opciones?.headers).get('authorization')?.replace(/^Bearer /, '') ?? '';
    const cuerpo = typeof opciones?.body === 'string' ? (JSON.parse(opciones.body) as unknown) : null;
    const location = locationDe(url, cuerpo);
    const de = quien(token);
    const rechazo = de === null ? 401 : location !== null && location !== LOCATION[de] ? 403 : null;
    vistos.push({ token, location, rechazo });
    if (rechazo !== null) return json({ message: 'no' }, rechazo);
    const sufijo = de!;

    if (url.includes('/contacts/search')) {
      const etiqueta = (cuerpo as { filters?: { value?: string }[] } | null)?.filters?.[0]?.value;
      const ids = etiqueta === 'zona_closer' ? contactosDe[sufijo] : [];
      return json({ contacts: ids.map((id) => ({ id, contactName: `Contacto ${id}`, tags: ['zona_closer'], dateAdded: new Date().toISOString() })), total: ids.length });
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
    const conversacion = /\/conversations\/conv-([^/]+)\/messages/.exec(url)?.[1];
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

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['mensajes', 'miniaturas_del_contacto', 'contactos', 'ingesta_pulso', 'tareas_programadas', 'campos_del_crm', 'carpetas_del_crm']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.organizaciones_credenciales where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

const deCuenta = (c: string | null) => (c === p ? 'P' : c === y ? 'Y' : String(c));

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  secretoPrevio = process.env.CRON_SECRET;
  process.env.CRON_SECRET = randomBytes(24).toString('hex');
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 280', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  const segunda = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, crm_cuenta_id) values ($1, 'Segunda 280', 'segunda-280', $2) returning id`,
    [org, LOCATION.y],
  );
  assert.ok(principal && segunda);
  p = principal.id;
  y = segunda.id;
  // La empresa (o sea su principal) con su token y su subcuenta; Y con los suyos.
  await conIdentidad(async (db) => {
    await db
      .insertInto('organizaciones_credenciales')
      .values({ org_id: org, crm_token_cifrado: cifrar(TOKEN.p), crm_estado: 'activa', crm_cuenta_id: LOCATION.p } as never)
      .execute();
    await db
      .insertInto('cuentas_credenciales')
      .values({ org_id: org, cuenta_id: y, crm_token_cifrado: cifrar(TOKEN.y), crm_estado: 'activa' } as never)
      .execute();
  });
  globalThis.fetch = ghlFalso();
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  if (secretoPrevio === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = secretoPrevio;
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('el cron trae los contactos y los mensajes de cada cliente con SU token, y cada fila queda en SU cliente', async () => {
  vistos.length = 0;
  const r = await cron(
    new Request('https://ejemplo.test/api/cron', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, 'x-vercel-cron-schedule': '*/10 * * * *' },
    }),
  );
  assert.equal(r.status, 200, await r.clone().text());

  // Ningún pedido de esta empresa cruzó tokens.
  const deEstaEmpresa = vistos.filter((v) => quien(v.token) !== null);
  assert.ok(deEstaEmpresa.some((v) => v.token === TOKEN.p) && deEstaEmpresa.some((v) => v.token === TOKEN.y), 'no se usó el token de los dos clientes');
  assert.deepEqual(deEstaEmpresa.filter((v) => v.rechazo !== null), [], 'un pedido usó el token de un cliente con la subcuenta de otro');

  const contactos = await filas<{ ghl: string; cuenta: string }>(
    admin,
    `select ghl_contact_id as ghl, cuenta_id as cuenta from negocio.contactos where org_id = $1 order by 1`,
    [org],
  );
  assert.deepEqual(contactos.map((c) => `${c.ghl}:${deCuenta(c.cuenta)}`), ['c280p1:P', 'c280y1:Y']);
  const mensajes = await filas<{ ghl: string; cuenta: string }>(
    admin,
    `select ghl_mensaje_id as ghl, cuenta_id as cuenta from negocio.mensajes where org_id = $1 order by 1`,
    [org],
  );
  assert.deepEqual(mensajes.map((m) => `${m.ghl}:${deCuenta(m.cuenta)}`), ['m-c280p1:P', 'm-c280y1:Y']);
});

test('cada cliente tiene su pulso y sus sellos, y los dos corrieron', async () => {
  const pulsos = await filas<{ cuenta: string; clave: string }>(
    admin,
    `select cuenta_id as cuenta, clave from negocio.ingesta_pulso where org_id = $1 order by clave, cuenta_id`,
    [org],
  );
  assert.deepEqual(
    pulsos.map((x) => `${x.clave}:${deCuenta(x.cuenta)}`).sort(),
    ['mensajes:P', 'mensajes:Y'],
  );
  const sellos = await filas<{ cuenta: string | null; tarea: string; estado: string }>(
    admin,
    `select cuenta_id as cuenta, tarea, ultimo_estado as estado from negocio.tareas_programadas
      where org_id = $1 and tarea in ('contactos', 'mensajes')`,
    [org],
  );
  assert.deepEqual(
    sellos.map((s) => `${s.tarea}:${deCuenta(s.cuenta)}:${s.estado}`).sort(),
    ['contactos:P:corrio', 'contactos:Y:corrio', 'mensajes:P:corrio', 'mensajes:Y:corrio'],
  );
});

test('la sincronización manual trae a cada cliente con SU token, y la resta de uno no congela al otro', async () => {
  // Desde la última corrida, la subcuenta de P ya no tiene a c280p1 y tiene a c280p2.
  contactosDe = { p: ['c280p2'], y: ['c280y1'] };
  const u = await unaFila<{ id: string }>(admin, `insert into identidad.usuarios (org_id, nombre) values ($1, 'Admin 280') returning id`, [org]);
  assert.ok(u);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'administrador' and org_id is null`,
    [u.id],
  );
  vistos.length = 0;
  const r = await sincronizar(pedirComo('/api/contactos/sincronizar', await sesionDe(u.id), { metodo: 'POST' }));
  assert.equal(r.status, 200, await r.clone().text());
  assert.deepEqual([...new Set(vistos.map((v) => v.token))].sort(), [TOKEN.p, TOKEN.y].sort(), 'la sincronización manual no trajo a cada cliente con su token');
  assert.deepEqual(vistos.filter((v) => v.rechazo !== null), [], 'un pedido usó el token de un cliente con la subcuenta de otro');
  const cuerpo = (await r.json()) as { clientes: { estado: string }[]; guardados: { closer: number }; congelados: number | null };
  assert.deepEqual(cuerpo.clientes.map((c) => c.estado), ['corrio', 'corrio']);
  assert.equal(cuerpo.guardados.closer, 2);
  assert.equal(cuerpo.congelados, 1, 'la resta de un cliente no se sumó, o congeló a los del otro');

  const territorios = await filas<{ ghl: string; territorio: string | null; cuenta: string }>(
    admin,
    `select ghl_contact_id as ghl, territorio, cuenta_id as cuenta from negocio.contactos where org_id = $1 order by 1`,
    [org],
  );
  assert.deepEqual(
    territorios.map((t) => `${t.ghl}:${deCuenta(t.cuenta)}:${t.territorio ?? 'congelado'}`),
    ['c280p1:P:congelado', 'c280p2:P:closer', 'c280y1:Y:closer'],
    'la sincronización de un cliente congeló a un contacto del otro, que se busca con otro token',
  );
});
