// LA CONEXIÓN DE CADA CLIENTE: SUS CREDENCIALES, SU AVISO Y SU SUBCUENTA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Bloque C, Paso C3)
//
// Una empresa con tres clientes: P (el principal, por omisión), X (activo, con su propia subcuenta) y Z (activo, sin
// conexión propia). Con las credenciales de la empresa cargadas:
//
//   · P y quien pide `'la_de_la_empresa'` leen las de la empresa; X y Z, sólo las suyas — sin conexión propia,
//     FALTAN, y nunca caen a la de la empresa — mutación: `esDeLaEmpresa` que devuelva siempre `true`;
//   · la conexión de un cliente se lee por (organización, cliente): el id de X con otra organización falta —
//     mutación: sacar el `where('c.org_id')` de `credencialesDelCliente`;
//   · el auditor de X usa el agente de X y la llave de la empresa;
//   · la ruta de la Conexión: guarda cifrado y nunca devuelve un valor; el principal es 409, un cliente de otra
//     empresa es 404, sin la capacidad es 403; todo queda auditado;
//   · el secreto del aviso de X sale una vez, y el aviso firmado con él entra en X y compara con la subcuenta de X;
//     con X en pausa es el mismo 403 que un secreto desconocido — mutación: sacar `estado = 'activa'`;
//   · el vínculo no toca la subcuenta del principal (409) ni acepta la location de una empresa (409);
//   · Ajustes › Credenciales no acepta la location de otro cliente (409) ni una sin forma de location (400);
//   · las rutas de un contacto y la lista de usuarios del CRM (`?cuenta=`) usan la conexión del cliente del contacto
//     — mutación: `'la_de_la_empresa'` en `app/api/contactos/[id]/mensajes/route.ts`.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { hashDeToken } from '../../lib/autorizacion/sesion.ts';
import {
  dominioDeReservasDe,
  resolverAccesoAGhl,
  resolverAccesoAlAuditor,
  resolverAccesoAMeta,
  TEXTO_DE_FALTA_GHL,
} from '../../lib/credenciales/resolver.ts';
import { GET as verConexion, PUT as cargarConexion, POST as generarAviso } from '../../app/api/admin/cuentas/[id]/conexion/route.ts';
import { PATCH as vincular } from '../../app/api/admin/cuentas/[id]/vinculo/route.ts';
import { PUT as cargarDeLaEmpresa, POST as generarAvisoDeLaEmpresa } from '../../app/api/admin/credenciales/route.ts';
import { POST as recibirAviso } from '../../app/api/avisos/crm/route.ts';
import { GET as verContacto } from '../../app/api/contactos/[id]/route.ts';
import { POST as escribir } from '../../app/api/contactos/[id]/mensajes/route.ts';
import { GET as usuariosDelCrm } from '../../app/api/admin/closer/usuarios-crm/route.ts';

const SLUG = 'gamma-276';
const PIMIENTA = 'pimienta-276';
const EMPRESA = {
  crmToken: 'token-empresa-276',
  crmCuentaId: 'loc-empresa-276',
  crmDominioReservas: 'reservas.empresa.ejemplo',
  crmAgenteUsuarioId: 'agente-empresa-276',
  iaClave: 'llave-ia-276',
  metaToken: 'meta-empresa-276',
  metaCuentaId: 'act_1002760001',
};
const DE_X = {
  crmToken: 'token-x-276',
  crmCalendarioId: 'cal-x-276',
  crmDominioReservas: 'reservas.x.ejemplo',
  crmAgenteUsuarioId: 'agente-x-276',
  metaToken: 'meta-x-276',
  metaCuentaId: 'act_2762760002',
};

let admin: Client;
let org: string;
let beta: string;
let deBeta: string;
let p: string;
let x: string;
let z: string;
let tokenAdmin: string;
let tokenUsuario: string;
let tokenAria: string;
let pimientaPrevia: string | undefined;
const fetchOriginal = globalThis.fetch;
/** Lo que el GoHighLevel falso recibió: el token de cada llamada. */
const llamadas: string[] = [];

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const clienteX = () => ({ id: x, esPorOmision: false });
const clienteZ = () => ({ id: z, esPorOmision: false });

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['avisos_del_crm', 'mensajes', 'contactos']) await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.organizaciones_credenciales where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

async function persona(nombre: string, rol: string): Promise<string> {
  const u = await unaFila<{ id: string }>(admin, `insert into identidad.usuarios (org_id, nombre) values ($1, $2) returning id`, [org, nombre]);
  assert.ok(u);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = $2 and org_id is null`,
    [u.id, rol],
  );
  return u.id;
}

async function cliente(nombre: string, slug: string): Promise<string> {
  const c = await unaFila<{ id: string }>(admin, `insert into identidad.cuentas (org_id, nombre, slug) values ($1, $2, $3) returning id`, [org, nombre, slug]);
  assert.ok(c);
  return c.id;
}

/** Un contacto del cliente, que escribió hace un rato (la ventana de respuesta está abierta). */
async function contactoDe(cuenta: string, ghlId: string): Promise<string> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, ultimo_entrante_el)
     values ($1, $2, $3, 'Contacto 276', 'setter', now(), now() - interval '1 hour') returning id`,
    [org, cuenta, ghlId],
  );
  assert.ok(c);
  return c.id;
}

/** Un aviso del CRM firmado con una cabecera, con un evento que no se interpreta (no llama al CRM). */
function aviso(cabecera: string, cuerpo: Record<string, unknown>): Request {
  return new Request(`https://${DOMINIO}/api/avisos/crm?evento=no-existe-276`, {
    method: 'POST',
    headers: { 'x-webhook-secret': cabecera, 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  pimientaPrevia = process.env.AVISO_PIMIENTA;
  process.env.AVISO_PIMIENTA = PIMIENTA;
  // GoHighLevel falso: anota el token y responde vacío. Ninguna prueba de acá sale a la red.
  globalThis.fetch = (async (_entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const auth = new Headers(opciones?.headers).get('authorization') ?? '';
    llamadas.push(auth.replace(/^Bearer /, ''));
    return new Response(JSON.stringify({ users: [], contacts: [], messages: [] }), { status: 200 });
  }) as typeof globalThis.fetch;

  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 276', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  const b = await unaFila<{ id: string; cuenta: string }>(
    admin,
    `select o.id, c.id as cuenta from identidad.organizaciones o join identidad.cuentas c on c.org_id = o.id where o.slug = 'beta' limit 1`,
  );
  const aria = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email = 'fundadora@principal.ejemplo'`);
  assert.ok(o && b && aria, 'falta el sembrado');
  org = o.id;
  beta = b.id;
  deBeta = b.cuenta;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  assert.ok(principal);
  p = principal.id;
  x = await cliente('Segunda 276', 'segunda-276');
  z = await cliente('Tercera 276', 'tercera-276');
  tokenAdmin = await sesionDe(await persona('Admin 276', 'administrador'));
  tokenUsuario = await sesionDe(await persona('Usuario 276', 'usuario'));
  tokenAria = await sesionDe(aria.id);

  const r = await cargarDeLaEmpresa(pedirComo('/api/admin/credenciales', tokenAdmin, { metodo: 'PUT', cuerpo: EMPRESA }));
  assert.equal(r.status, 200, await r.clone().text());
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  if (pimientaPrevia === undefined) delete process.env.AVISO_PIMIENTA;
  else process.env.AVISO_PIMIENTA = pimientaPrevia;
  try {
    await admin.query(`delete from identidad.sesiones where token_hash = $1`, [hashDeToken(tokenAria)]);
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('el cliente principal y quien pide la de la empresa leen la de la empresa', async () => {
  for (const quien of [{ id: p, esPorOmision: true }, 'la_de_la_empresa'] as const) {
    const ghl = await conIdentidad((db) => resolverAccesoAGhl(db, org, quien));
    assert.deepEqual(ghl, { tipo: 'listo', token: EMPRESA.crmToken, locationId: EMPRESA.crmCuentaId });
    assert.equal(await conIdentidad((db) => dominioDeReservasDe(db, org, quien)), EMPRESA.crmDominioReservas);
  }
});

test('un cliente sin conexión propia FALTA: no cae a la de la empresa', async () => {
  assert.deepEqual(
    await conIdentidad((db) => resolverAccesoAGhl(db, org, clienteZ())),
    { tipo: 'falta', que: 'sin_token' },
    'el cliente sin token leyó el de la empresa: sus contactos no existen en esa subcuenta',
  );
  assert.equal((await conIdentidad((db) => resolverAccesoAMeta(db, org, clienteZ()))).tipo, 'falta');
  assert.equal(await conIdentidad((db) => dominioDeReservasDe(db, org, clienteZ())), null, 'el enlace de reservas salió con el dominio de otro negocio');
  assert.deepEqual(await conIdentidad((db) => resolverAccesoAlAuditor(db, org, clienteZ())), { tipo: 'falta', que: 'sin_id_del_agente' });
});

test('la conexión de un cliente se carga por su ruta, cifrada, y la respuesta no trae ningún valor', async () => {
  const r = await leerRespuesta<{ crm: { cargado: boolean; estado: string }; meta: { cargado: boolean }; crmCalendarioId: string }>(
    await cargarConexion(pedirComo(`/api/admin/cuentas/${x}/conexion`, tokenAdmin, { metodo: 'PUT', cuerpo: DE_X }), ctx(x)),
  );
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.crm.cargado, true);
  assert.equal(r.cuerpo.crm.estado, 'activa');
  assert.equal(r.cuerpo.meta.cargado, true);
  assert.equal(r.cuerpo.crmCalendarioId, DE_X.crmCalendarioId);
  for (const secreto of [DE_X.crmToken, DE_X.metaToken]) {
    assert.doesNotMatch(JSON.stringify(r.cuerpo), new RegExp(secreto), 'la respuesta trajo un secreto');
  }
  const fila = await unaFila<{ crm: string; meta: string; org_id: string }>(
    admin,
    `select crm_token_cifrado as crm, meta_token_cifrado as meta, org_id from identidad.cuentas_credenciales where cuenta_id = $1`,
    [x],
  );
  assert.ok(fila);
  assert.equal(fila.org_id, org);
  assert.notEqual(fila.crm, DE_X.crmToken, 'el token quedó en claro');
  assert.notEqual(fila.meta, DE_X.metaToken, 'el token de Meta quedó en claro');
  const auditado = await unaFila<{ n: number }>(
    admin,
    `select count(*)::int as n from identidad.auditoria_accesos where accion = 'credenciales_cargadas' and detalle->>'objetivo' = $1`,
    [x],
  );
  assert.equal(auditado?.n, 1, 'la carga no quedó en la auditoría');

  // Sin subcuenta vinculada, el CRM de X todavía falta; la vincula ARIA.
  assert.deepEqual(await conIdentidad((db) => resolverAccesoAGhl(db, org, clienteX())), { tipo: 'falta', que: 'sin_subcuenta' });
  const v = await vincular(
    pedirComo(`/api/admin/cuentas/${x}/vinculo`, tokenAria, { metodo: 'PATCH', cuerpo: { orgId: org, crmCuentaId: 'loc-x-276' } }),
    ctx(x),
  );
  assert.equal(v.status, 200, await v.clone().text());
});

test('cada cliente lee lo suyo, y sólo dentro de su organización', async () => {
  assert.deepEqual(await conIdentidad((db) => resolverAccesoAGhl(db, org, clienteX())), {
    tipo: 'listo',
    token: DE_X.crmToken,
    locationId: 'loc-x-276',
  });
  assert.deepEqual(await conIdentidad((db) => resolverAccesoAMeta(db, org, clienteX())), {
    tipo: 'listo',
    token: DE_X.metaToken,
    cuentaId: DE_X.metaCuentaId,
  });
  assert.equal(await conIdentidad((db) => dominioDeReservasDe(db, org, clienteX())), DE_X.crmDominioReservas);
  // El auditor de X: el agente de X, la llave de la empresa.
  assert.deepEqual(await conIdentidad((db) => resolverAccesoAlAuditor(db, org, clienteX())), {
    tipo: 'listo',
    claveIa: EMPRESA.iaClave,
    idDelAgente: DE_X.crmAgenteUsuarioId,
  });
  // El principal sigue con lo de la empresa.
  assert.equal(
    ((await conIdentidad((db) => resolverAccesoAGhl(db, org, { id: p, esPorOmision: true }))) as { token?: string }).token,
    EMPRESA.crmToken,
  );
  // El id de X con OTRA organización no encuentra nada.
  assert.deepEqual(
    await conIdentidad((db) => resolverAccesoAGhl(db, beta, clienteX())),
    { tipo: 'falta', que: 'sin_token' },
    'la conexión de un cliente se leyó desde otra organización',
  );
});

test('la ruta de la Conexión: el principal es 409, otra empresa es 404, sin la capacidad es 403', async () => {
  const principal = await leerRespuesta<{ codigo: string }>(
    await cargarConexion(pedirComo(`/api/admin/cuentas/${p}/conexion`, tokenAdmin, { metodo: 'PUT', cuerpo: { crmToken: 'otro' } }), ctx(p)),
  );
  assert.deepEqual({ estado: principal.estado, codigo: principal.cuerpo.codigo }, { estado: 409, codigo: 'cliente_principal' });
  const delPrincipal = await unaFila<{ n: number }>(admin, `select count(*)::int as n from identidad.cuentas_credenciales where cuenta_id = $1 and crm_token_cifrado is not null and actualizado_el > now() - interval '1 minute'`, [p]);
  assert.equal(delPrincipal?.n, 0, 'se escribió una conexión para el cliente principal');

  const ajena = await verConexion(pedirComo(`/api/admin/cuentas/${deBeta}/conexion`, tokenAdmin), ctx(deBeta));
  assert.equal(ajena.status, 404, 'se vio la conexión de un cliente de otra empresa');
  const sinCapacidad = await leerRespuesta<{ codigo: string }>(await verConexion(pedirComo(`/api/admin/cuentas/${x}/conexion`, tokenUsuario), ctx(x)));
  assert.deepEqual({ estado: sinCapacidad.estado, codigo: sinCapacidad.cuerpo.codigo }, { estado: 403, codigo: 'sin_permiso' });
  const vista = await leerRespuesta<{ cuentaId: string; esPorOmision: boolean; crmCuentaId: string }>(
    await verConexion(pedirComo(`/api/admin/cuentas/${x}/conexion`, tokenAdmin), ctx(x)),
  );
  assert.equal(vista.estado, 200);
  assert.deepEqual([vista.cuerpo.cuentaId, vista.cuerpo.esPorOmision, vista.cuerpo.crmCuentaId], [x, false, 'loc-x-276']);
});

test('el aviso firmado con el secreto de un cliente entra en ese cliente; en pausa, el mismo 403', async () => {
  const generado = await leerRespuesta<{ avisoCabecera: string; avisoSecretoConfigurado: boolean }>(
    await generarAviso(pedirComo(`/api/admin/cuentas/${x}/conexion`, tokenAdmin, { metodo: 'POST' }), ctx(x)),
  );
  assert.equal(generado.estado, 200, JSON.stringify(generado.cuerpo));
  assert.equal(generado.cuerpo.avisoSecretoConfigurado, true);
  const cabeceraX = generado.cuerpo.avisoCabecera;
  const secretoX = cabeceraX.slice(PIMIENTA.length + 1);
  const hash = await unaFila<{ h: string }>(admin, `select aviso_secreto_hash as h from identidad.cuentas_credenciales where cuenta_id = $1`, [x]);
  assert.equal(hash?.h, createHash('sha256').update(secretoX).digest('hex'));

  const r = await leerRespuesta<{ procesado: boolean; porque: string }>(await recibirAviso(aviso(cabeceraX, { locationId: 'loc-x-276', n: 1 })));
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  // Y el de la empresa entra en el principal.
  const deLaEmpresa = await leerRespuesta<{ avisoCabecera: string }>(
    await generarAvisoDeLaEmpresa(pedirComo('/api/admin/credenciales', tokenAdmin, { metodo: 'POST' })),
  );
  assert.equal(deLaEmpresa.estado, 200);
  const r2 = await recibirAviso(aviso(deLaEmpresa.cuerpo.avisoCabecera, { locationId: EMPRESA.crmCuentaId, n: 2 }));
  assert.equal(r2.status, 200);

  const avisos = await filas<{ cuenta_id: string; atribucion: string }>(
    admin,
    `select cuenta_id, atribucion from negocio.avisos_del_crm where org_id = $1 order by recibido_el, id`,
    [org],
  );
  assert.deepEqual(
    avisos,
    [
      { cuenta_id: x, atribucion: 'coincide' },
      { cuenta_id: p, atribucion: 'coincide' },
    ],
    'el aviso no entró en el cliente de su secreto, o no se comparó con SU subcuenta',
  );

  // Con X en pausa, su secreto es el mismo 403 que uno desconocido.
  await admin.query(`update identidad.cuentas set estado = 'pausada' where id = $1`, [x]);
  try {
    const pausado = await recibirAviso(aviso(cabeceraX, { locationId: 'loc-x-276', n: 3 }));
    const desconocido = await recibirAviso(aviso(`${PIMIENTA}.no-es-de-nadie-276`, { n: 4 }));
    assert.equal(pausado.status, 403, 'el aviso de un cliente en pausa entró');
    assert.deepEqual(await pausado.json(), await desconocido.json());
  } finally {
    await admin.query(`update identidad.cuentas set estado = 'activa' where id = $1`, [x]);
  }
});

test('el secreto del aviso de un cliente es único', async () => {
  const indice = await unaFila<{ unico: boolean; definicion: string }>(
    admin,
    `select i.indisunique as unico, pg_get_indexdef(i.indexrelid) as definicion
       from pg_index i join pg_class c on c.oid = i.indexrelid where c.relname = 'cuentas_credenciales_aviso_secreto_unico'`,
  );
  assert.equal(indice?.unico, true, 'falta el índice único del secreto del aviso de los clientes (091)');
  assert.match(indice!.definicion, /\(aviso_secreto_hash\) WHERE \(aviso_secreto_hash IS NOT NULL\)/);
});

test('el vínculo no toca la subcuenta del principal ni acepta la location de una empresa', async () => {
  const principal = await leerRespuesta<{ codigo: string }>(
    await vincular(
      pedirComo(`/api/admin/cuentas/${p}/vinculo`, tokenAria, { metodo: 'PATCH', cuerpo: { orgId: org, crmCuentaId: 'loc-p-276' } }),
      ctx(p),
    ),
  );
  assert.deepEqual({ estado: principal.estado, codigo: principal.cuerpo.codigo }, { estado: 409, codigo: 'cliente_principal' });
  // La marca de prueba del principal sí se toca.
  const prueba = await vincular(
    pedirComo(`/api/admin/cuentas/${p}/vinculo`, tokenAria, { metodo: 'PATCH', cuerpo: { orgId: org, esPrueba: false } }),
    ctx(p),
  );
  assert.equal(prueba.status, 200, await prueba.clone().text());

  const deEmpresa = await leerRespuesta<{ codigo: string }>(
    await vincular(
      pedirComo(`/api/admin/cuentas/${z}/vinculo`, tokenAria, { metodo: 'PATCH', cuerpo: { orgId: org, crmCuentaId: EMPRESA.crmCuentaId } }),
      ctx(z),
    ),
  );
  assert.deepEqual({ estado: deEmpresa.estado, codigo: deEmpresa.cuerpo.codigo }, { estado: 409, codigo: 'subcuenta_en_uso' });
  const z1 = await unaFila<{ loc: string | null }>(admin, `select crm_cuenta_id as loc from identidad.cuentas where id = $1`, [z]);
  assert.equal(z1?.loc, null);
});

test('Ajustes › Credenciales no toma la location de otro cliente', async () => {
  const tomada = await leerRespuesta<{ codigo: string }>(
    await cargarDeLaEmpresa(pedirComo('/api/admin/credenciales', tokenAdmin, { metodo: 'PUT', cuerpo: { crmCuentaId: 'loc-x-276' } })),
  );
  assert.deepEqual({ estado: tomada.estado, codigo: tomada.cuerpo.codigo }, { estado: 409, codigo: 'subcuenta_en_uso' });
  const sinForma = await cargarDeLaEmpresa(pedirComo('/api/admin/credenciales', tokenAdmin, { metodo: 'PUT', cuerpo: { crmCuentaId: 'no es una location' } }));
  assert.equal(sinForma.status, 400);
  const fila = await unaFila<{ loc: string }>(admin, `select crm_cuenta_id as loc from identidad.organizaciones_credenciales where org_id = $1`, [org]);
  assert.equal(fila?.loc, EMPRESA.crmCuentaId, 'un rechazo cambió la subcuenta de la empresa');
  const misma = await cargarDeLaEmpresa(pedirComo('/api/admin/credenciales', tokenAdmin, { metodo: 'PUT', cuerpo: { crmCuentaId: EMPRESA.crmCuentaId } }));
  assert.equal(misma.status, 200, await misma.clone().text());
});

test('las rutas de un contacto usan la conexión del cliente del contacto', async () => {
  const deZ = await contactoDe(z, 'c276-z-1');
  const deX = await contactoDe(x, 'c276-x-1');

  // La ficha de un contacto de Z: Z no tiene token, así que el refresco lo dice — con el de la empresa habría llamado.
  llamadas.length = 0;
  const ficha = await leerRespuesta<{ refresco: { porque: string | null } }>(await verContacto(pedirComo(`/api/contactos/${deZ}`, tokenAdmin), ctx(deZ)));
  assert.equal(ficha.estado, 200, JSON.stringify(ficha.cuerpo));
  assert.match(ficha.cuerpo.refresco.porque ?? '', new RegExp(TEXTO_DE_FALTA_GHL.sin_token.slice(0, 30)));
  assert.deepEqual(llamadas, [], 'la ficha de un contacto de Z llamó al CRM con otro token');

  // Escribirle a un contacto de Z: falta su credencial.
  const mensaje = await leerRespuesta<{ codigo: string }>(
    await escribir(pedirComo(`/api/contactos/${deZ}/mensajes`, tokenAdmin, { metodo: 'POST', cuerpo: { texto: 'Hola' } }), ctx(deZ)),
  );
  assert.deepEqual(
    { estado: mensaje.estado, codigo: mensaje.cuerpo.codigo },
    { estado: 409, codigo: 'credenciales_incompletas' },
    'se le escribió a un contacto de Z con la subcuenta de la empresa',
  );

  // La ficha de un contacto de X llama al CRM con el token de X.
  llamadas.length = 0;
  const fichaX = await verContacto(pedirComo(`/api/contactos/${deX}`, tokenAdmin), ctx(deX));
  assert.equal(fichaX.status, 200);
  assert.ok(llamadas.length > 0 && llamadas.every((t) => t === DE_X.crmToken), `la ficha de X llamó con: ${llamadas.join(', ')}`);
});

test('la lista de usuarios del CRM de un cliente usa su conexión, y uno de otra empresa es 404', async () => {
  const deZ = await leerRespuesta<{ codigo: string }>(await usuariosDelCrm(pedirComo(`/api/admin/closer/usuarios-crm?cuenta=${z}`, tokenAdmin)));
  assert.deepEqual({ estado: deZ.estado, codigo: deZ.cuerpo.codigo }, { estado: 409, codigo: 'credenciales_incompletas' });
  llamadas.length = 0;
  const deX = await leerRespuesta<{ agenteId: string | null }>(await usuariosDelCrm(pedirComo(`/api/admin/closer/usuarios-crm?cuenta=${x}`, tokenAdmin)));
  assert.equal(deX.estado, 200, JSON.stringify(deX.cuerpo));
  assert.equal(deX.cuerpo.agenteId, DE_X.crmAgenteUsuarioId);
  assert.deepEqual([...new Set(llamadas)], [DE_X.crmToken]);
  const deLaEmpresa = await leerRespuesta<{ agenteId: string | null }>(await usuariosDelCrm(pedirComo('/api/admin/closer/usuarios-crm', tokenAdmin)));
  assert.equal(deLaEmpresa.cuerpo.agenteId, EMPRESA.crmAgenteUsuarioId);
  const ajena = await usuariosDelCrm(pedirComo(`/api/admin/closer/usuarios-crm?cuenta=${deBeta}`, tokenAdmin));
  assert.equal(ajena.status, 404);
});
