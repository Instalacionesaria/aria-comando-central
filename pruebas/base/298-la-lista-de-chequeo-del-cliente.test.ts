// LA LISTA DE CHEQUEO DEL CLIENTE: META CONECTADO, SUS CAMPAÑAS LEÍDAS, Y EN VIVO EN AJUSTES. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C6 · D5; desde Meta directo, M4)
//
// Desde Meta directo los costos de cada cliente salen de SU conexión con Meta, y la lista de chequeo lo exige: `meta`
// («Meta conectado», requerido, en vivo) y `meta_leido` («Campañas leídas de Meta», recomendado, medido). Con cuatro
// clientes de una empresa —P, el principal, conectado por la empresa y con su pasada que corrió; Y, sin Meta y con su
// pasada saltada; Z, conectado con su propio Meta, sin un sello que diga algo pero con gasto en la ventana; W, sin
// pasada, con un día de gasto de hace dos meses y sin ninguna conexión—, e Y y W con el sello de OTRA tarea:
//
//   · `medirLosPasos` mide si se leen sus campañas con el sello de SU pasada de anuncios —no con el de otra tarea—;
//     sin un sello que diga algo, con su gasto de los últimos 30 días; sin nada, no se sabe — mutaciones: ignorar el
//     motivo, sin el gasto, sin el filtro de la tarea, sin la ventana;
//   · el principal sin sello propio toma el sin cuenta, y sólo él — mutaciones: sin ese respaldo, el respaldo para
//     todos;
//   · la foto lo escribe por cliente (`meta_leido`, y `meta` conectado), con el contrato 3, y `configurada` y `faltan`
//     los usan: conectado es requerido, leído recomendado, y lo no medido no se acusa — mutaciones: la columna en nulo,
//     conectado como recomendado;
//   · Ajustes › Clientes trae la lista de cada cliente EN VIVO: un sello nuevo se ve sin esperar la foto — mutación:
//     sin lo medido;
//   · cada cliente con SU conexión: el principal, la de la empresa; los demás, la suya, y sin la suya falta; de
//     identidad se leen sólo los clientes de la empresa pedida — mutaciones: la de la empresa para todos, la de la
//     empresa de la sesión y no la pedida, sin la empresa en el `where`;
//   · la lista de la ruta usa el estado, la zona y el nicho de la fila de cada cliente: uno en pausa con todo no está
//     configurado — mutaciones: la ruta con el estado fijo, con el nicho confirmado fijo, con la zona fija;
//   · ningún valor de la conexión viaja: cada paso trae su clave, su nombre, si es requerido y su estado;
//   · la plataforma ve la lista de otra empresa con su `orgId`, la de esa empresa.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { leerLaConfiguracion, leerLosClientesDe } from '../../lib/cartera/configuracion.ts';
import { CONTRATO_DE_LA_FOTO } from '../../lib/cartera/contrato.ts';
import { tomarLaFoto } from '../../lib/cartera/foto.ts';
import { medirLosPasos } from '../../lib/cartera/medicion.ts';
import { PASOS_DEL_CLIENTE } from '../../lib/cartera/pasos.ts';
import { MOTIVO_META_RECHAZADA } from '../../lib/negocio/faltaDeLosClientes.ts';
import { TEXTO_DE_FALTA_CUENTAS_DE_META } from '../../lib/credenciales/resolver.ts';
import { GET as listar } from '../../app/api/admin/cuentas/route.ts';

const SLUG = 'gamma-298';
const ZONA = 'America/Lima';
/** Valores «cifrados» de mentira: si alguno aparece en una respuesta, salió un valor y no una presencia. */
const SECRETO = 'secreto-de-mentira-298';
const SECRETO_DE_Y = 'secreto-de-y-298';

let admin: Client;
let org: string;
let p: string;
let y: string;
let z: string;
let w: string;
let tokenAdmin: string;
let tokenAria: string;

interface Paso {
  clave: string;
  nombre: string;
  requerido: boolean;
  estado: 'ok' | 'falta' | 'sin_medir';
}
interface Listado {
  clientes: { id: string; listaDeChequeo: { configurado: boolean; pasos: Paso[] } }[];
}

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['ingesta_pulso', 'tareas_programadas', 'gasto_de_la_cuenta']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from negocio.foto_de_las_cuentas where organizacion_ref = $1`, [o.id]);
  await admin.query(`delete from negocio.foto_de_las_empresas where organizacion_ref = $1`, [o.id]);
  await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  await admin.query(`delete from identidad.organizaciones_credenciales where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Un cliente más de la empresa, con la zona elegida y el nicho confirmado por la plataforma. */
async function cliente(nombre: string, nicho: string): Promise<string> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, nicho, nicho_confirmado_el, nicho_confirmado_desde, zona_horaria)
     values ($1, $2, $3, $4, now(), 'plataforma', $5) returning id`,
    [org, nombre, nombre.toLowerCase().replace(/\s+/g, '-'), nicho, ZONA],
  );
  assert.ok(c);
  return c.id;
}

/** El sello de la pasada del gasto de un cliente (o el sin cuenta, con `null`), o el de otra tarea. */
async function sello(cuenta: string | null, estado: string, motivo: string | null, tarea = 'anuncios'): Promise<void> {
  await admin.query(
    `insert into negocio.tareas_programadas (org_id, cuenta_id, tarea, ultima_corrida_el, ultimo_estado, ultimo_motivo)
     values ($1, $2, $5, now(), $3, $4)
     on conflict (org_id, cuenta_id, tarea) do update
       set ultima_corrida_el = excluded.ultima_corrida_el, ultimo_estado = excluded.ultimo_estado, ultimo_motivo = excluded.ultimo_motivo`,
    [org, cuenta, estado, motivo, tarea],
  );
}

const listaDe = (l: Listado, id: string) => {
  const c = l.clientes.find((x) => x.id === id);
  assert.ok(c, 'falta un cliente en la lista');
  return c.listaDeChequeo;
};
const estadoDe = (l: Listado, id: string, clave: string) => listaDe(l, id).pasos.find((x) => x.clave === clave)?.estado;

async function comoLaEmpresa(): Promise<Listado> {
  const r = await leerRespuesta<Listado>(await listar(pedirComo('/api/admin/cuentas', tokenAdmin)));
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  return r.cuerpo;
}

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 298', $1, $2) returning id`,
    [SLUG, ZONA],
  );
  assert.ok(o);
  org = o.id;
  const n = await unaFila<{ clave: string }>(admin, `select clave from catalogo.nichos where nivel = 2 order by clave limit 1`);
  const aria = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email = 'fundadora@principal.ejemplo'`);
  assert.ok(n && aria, 'falta el sembrado');

  // P, el principal: su zona y su nicho, y la conexión de la empresa entera, con Meta directo y el aviso.
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  assert.ok(principal);
  p = principal.id;
  await admin.query(
    `update identidad.cuentas set nicho = $2, nicho_confirmado_el = now(), nicho_confirmado_desde = 'plataforma', zona_horaria = $3
      where id = $1`,
    [p, n.clave, ZONA],
  );
  await admin.query(
    `insert into identidad.organizaciones_credenciales
       (org_id, crm_token_cifrado, crm_estado, crm_calendario_id, meta_token_cifrado, meta_cuenta_id, aviso_secreto_hash)
     values ($1, $2, 'activa', 'calendario-298', $2, 'act_298', 'hash-298-p')`,
    [org, SECRETO],
  );

  // Y y Z con su conexión propia (sin Meta directo ni aviso); W sin ninguna.
  y = await cliente('Ye 298', n.clave);
  z = await cliente('Zeta 298', n.clave);
  w = await cliente('Uve 298', n.clave);
  for (const [cuenta, token] of [
    [y, SECRETO_DE_Y],
    [z, SECRETO],
  ] as const) {
    await admin.query(
      `insert into identidad.cuentas_credenciales (org_id, cuenta_id, crm_token_cifrado, crm_estado, crm_calendario_id)
       values ($1, $2, $3, 'activa', 'calendario-298')`,
      [org, cuenta, token],
    );
  }

  // Los cuatro con datos de la última hora.
  for (const cuenta of [p, y, z, w]) {
    await admin.query(`insert into negocio.ingesta_pulso (org_id, cuenta_id, clave, marca_el) values ($1, $2, 'contactos', now())`, [
      org,
      cuenta,
    ]);
  }

  /* Otra tarea que corrió sin motivo, para Y y W, y antes que la del gasto: no dice nada del vínculo. Sin el filtro de
     la tarea, W —sin pasada del gasto— saldría vinculado, e Y tomaría el primer sello que encuentra. */
  await sello(y, 'corrio', null, 'contactos');
  await sello(w, 'corrio', null, 'contactos');

  /* Meta conectado: P por la conexión de la EMPRESA, Z con su propio Meta. Y y W, nada. Sólo presencias: los tokens
     de estas filas no se leen nunca en esta prueba. */
  const deLaEmpresa = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.conexiones_de_meta (org_id, cuenta_id, token_cifrado, negocio_de_meta_id, origen) values ($1, null, $2, '2981111111111', 'oauth') returning id`,
    [org, SECRETO],
  );
  const deZ = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.conexiones_de_meta (org_id, cuenta_id, token_cifrado, negocio_de_meta_id, origen) values ($1, $2, $3, '2982222222222', 'oauth') returning id`,
    [org, z, SECRETO],
  );
  assert.ok(deLaEmpresa && deZ);
  await admin.query(
    `insert into identidad.cuentas_publicitarias_de_meta (org_id, act_id, conexion_id, cuenta_id) values ($1, 'act_2980000001', $2, $3), ($1, 'act_2980000002', $4, $5)`,
    [org, deLaEmpresa.id, p, deZ.id, z],
  );

  // La pasada de anuncios: P corrió; Y quedó saltada (sin Meta); Z sin un sello que diga algo, con gasto; W, nada.
  await sello(p, 'corrio', null);
  await sello(y, 'saltada', TEXTO_DE_FALTA_CUENTAS_DE_META.sin_cuentas_de_meta);
  await sello(z, 'sin_tiempo', 'se agotó el presupuesto de la corrida');
  await admin.query(`insert into negocio.gasto_de_la_cuenta (org_id, cuenta_id, fecha, gasto) values ($1, $2, current_date - 3, 40)`, [
    org,
    z,
  ]);
  // W pautó hace dos meses: fuera de la ventana, ese día no dice que hoy tenga Meta vinculado.
  await admin.query(`insert into negocio.gasto_de_la_cuenta (org_id, cuenta_id, fecha, gasto) values ($1, $2, current_date - 60, 25)`, [
    org,
    w,
  ]);

  const persona = await unaFila<{ id: string }>(admin, `insert into identidad.usuarios (org_id, nombre) values ($1, 'Admin 298') returning id`, [
    org,
  ]);
  assert.ok(persona);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'administrador' and org_id is null`,
    [persona.id],
  );
  tokenAdmin = await sesionDe(persona.id);
  tokenAria = await sesionDe(aria.id);
});

after(async () => {
  try {
    await admin.query(
      `delete from identidad.sesiones where usuario_id = (select id from identidad.usuarios where email = 'fundadora@principal.ejemplo')
         and creada_el > now() - interval '1 hour' and cuenta_activa is null and org_activa is null`,
    );
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('las campañas leídas de cada cliente salen del sello de SU pasada de anuncios, o de su gasto', async () => {
  const m = await conOrganizacion(org, medirLosPasos);
  assert.deepEqual(
    [p, y, z, w].map((c) => m.get(c)?.metaLeido),
    [true, false, true, null],
    'P corrió, Y quedó saltada, Z tiene su gasto y W no tiene nada: no se sabe —el sello de otra tarea o un gasto viejo lo dieron por sabido—',
  );
  assert.ok([p, y, z, w].every((c) => m.get(c)?.ultimaIngestaEl instanceof Date), 'la marca de la ingesta no es la de cada cliente');
});

test('el principal sin sello propio toma el sin cuenta, y sólo él', async () => {
  await admin.query(`delete from negocio.tareas_programadas where org_id = $1 and cuenta_id = $2 and tarea = 'anuncios'`, [org, p]);
  await sello(null, 'corrio', MOTIVO_META_RECHAZADA);
  try {
    const m = await conOrganizacion(org, medirLosPasos);
    assert.equal(m.get(p)?.metaLeido, false, 'el principal no tomó el sello de antes del barrido por cliente');
    assert.equal(m.get(w)?.metaLeido, null, 'otro cliente tomó el sello sin cuenta, que es del principal');
  } finally {
    await admin.query(`delete from negocio.tareas_programadas where org_id = $1 and cuenta_id is null and tarea = 'anuncios'`, [org]);
    await sello(p, 'corrio', null);
  }
});

test('la foto lo escribe por cliente, con el contrato 3, y la lista exige Meta conectado', async () => {
  const todas = await conIdentidad(leerLaConfiguracion);
  const config = { principal: todas.principal, empresas: todas.empresas.filter((e) => e.id === org) };
  const r = await tomarLaFoto(config, Date.now());
  const cs = await filas<{ cuenta_ref: string; meta_leido: boolean | null; configurada: boolean; faltan: string[]; contrato: number }>(
    admin,
    `select cuenta_ref, meta_leido, configurada, faltan, contrato from negocio.foto_de_las_cuentas where organizacion_ref = $1 and dia = $2`,
    [org, r.dia],
  );
  const de = new Map(cs.map((c) => [c.cuenta_ref, c]));
  assert.ok(cs.every((c) => c.contrato === CONTRATO_DE_LA_FOTO && CONTRATO_DE_LA_FOTO === 3), 'la foto no lleva el contrato 3');
  assert.deepEqual(
    [p, y, z, w].map((c) => de.get(c)?.meta_leido),
    [true, false, true, null],
    'la foto no guardó si se leen las campañas de cada cliente',
  );
  // P tiene todo; Y, todo menos Meta conectado, que es requerido: no está configurado.
  assert.deepEqual([de.get(p)?.configurada, de.get(p)?.faltan], [true, []]);
  assert.deepEqual([de.get(y)?.configurada, de.get(y)?.faltan], [false, ['meta', 'meta_leido', 'aviso']], 'Y sin Meta conectado quedó configurado');
  assert.deepEqual([de.get(z)?.configurada, de.get(z)?.faltan], [true, ['aviso']]);
  // W: sin su conexión falta el CRM y Meta; si se leen sus campañas no se sabe, y no se acusa.
  assert.equal(de.get(w)?.configurada, false);
  assert.deepEqual(de.get(w)?.faltan, ['crm', 'calendario', 'meta', 'aviso'], 'a W se le acusó lo que no se midió, o heredó la conexión de la empresa');
});

test('Ajustes › Clientes trae la lista de cada cliente en vivo, con su conexión, y sin ningún valor', async () => {
  const l = await comoLaEmpresa();
  assert.deepEqual(
    l.clientes.map((c) => c.id),
    [p, y, z, w],
  );
  assert.deepEqual(
    [p, y, z, w].map((c) => listaDe(l, c).configurado),
    [true, false, true, false],
  );
  // Cada paso, en el orden de la lista, con su nombre y si es requerido, y nada más.
  const deP = listaDe(l, p);
  assert.deepEqual(
    deP.pasos.map((x) => [x.clave, x.nombre, x.requerido]),
    PASOS_DEL_CLIENTE.map((x) => [x.clave, x.nombre, x.requerido]),
  );
  assert.ok(
    l.clientes.every((c) => c.listaDeChequeo.pasos.every((x) => Object.keys(x).sort().join() === 'clave,estado,nombre,requerido')),
    'un paso trae algo más que su clave, su nombre, si es requerido y su estado',
  );
  const texto = JSON.stringify(l);
  for (const s of [SECRETO, SECRETO_DE_Y, 'hash-298-p']) assert.ok(!texto.includes(s), `la lista trajo un valor de la conexión: «${s}»`);

  // El principal con la conexión de la empresa: Meta (por la empresa) y el aviso. Los demás con la suya, y W sin ninguna.
  assert.deepEqual(
    ['crm', 'calendario', 'meta', 'aviso'].map((k) => estadoDe(l, p, k)),
    ['ok', 'ok', 'ok', 'ok'],
  );
  assert.deepEqual(
    ['crm', 'calendario', 'meta', 'aviso'].map((k) => estadoDe(l, y, k)),
    ['ok', 'ok', 'falta', 'falta'],
  );
  assert.deepEqual(
    ['crm', 'calendario', 'datos', 'meta_leido'].map((k) => estadoDe(l, w, k)),
    ['falta', 'falta', 'ok', 'sin_medir'],
    'W heredó la conexión de la empresa, o se le acusó lo que no se midió',
  );
  assert.equal(estadoDe(l, y, 'meta_leido'), 'falta');
  assert.equal(estadoDe(l, z, 'meta_leido'), 'ok');

  // En vivo: Y conecta Meta y su pasada siguiente corre, y la lista lo dice sin esperar la foto de mañana.
  const deY = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.conexiones_de_meta (org_id, cuenta_id, token_cifrado, negocio_de_meta_id, origen) values ($1, $2, $3, '2983333333333', 'oauth') returning id`,
    [org, y, SECRETO_DE_Y],
  );
  assert.ok(deY);
  await admin.query(`insert into identidad.cuentas_publicitarias_de_meta (org_id, act_id, conexion_id, cuenta_id) values ($1, 'act_2980000003', $2, $3)`, [
    org,
    deY.id,
    y,
  ]);
  await sello(y, 'corrio', null);
  try {
    const despues = await comoLaEmpresa();
    assert.equal(estadoDe(despues, y, 'meta'), 'ok', 'la lista no es la de ahora');
    assert.equal(estadoDe(despues, y, 'meta_leido'), 'ok', 'la lista no es la de ahora');
    assert.equal(listaDe(despues, y).configurado, true);
    // Y Meta revoca su conexión: la cuenta sigue asignada, pero Meta ya no está conectado.
    await admin.query(`update identidad.conexiones_de_meta set estado = 'revocada' where id = $1`, [deY.id]);
    assert.equal(estadoDe(await comoLaEmpresa(), y, 'meta'), 'falta', 'una conexión revocada cuenta como Meta conectado');
  } finally {
    await admin.query(`delete from identidad.conexiones_de_meta where id = $1`, [deY.id]);
    await sello(y, 'saltada', TEXTO_DE_FALTA_CUENTAS_DE_META.sin_cuentas_de_meta);
  }
});

test('la lista de la ruta usa el estado, la zona y el nicho de la fila de cada cliente', async () => {
  // Z, que tiene todo, en pausa; W, sin elegir su zona (el `UTC` por omisión) y con el nicho sin confirmar.
  await admin.query(`update identidad.cuentas set estado = 'pausada' where id = $1`, [z]);
  await admin.query(
    `update identidad.cuentas set zona_horaria = 'UTC', nicho_confirmado_el = null, nicho_confirmado_desde = null where id = $1`,
    [w],
  );
  try {
    const l = await comoLaEmpresa();
    assert.ok(
      listaDe(l, z).pasos.every((x) => !x.requerido || x.estado === 'ok'),
      'Z dejó de tener todo: la prueba ya no mira sólo su estado',
    );
    assert.equal(listaDe(l, z).configurado, false, 'un cliente en pausa salió configurado: la ruta no usó su estado');
    assert.deepEqual(
      ['zona', 'nicho'].map((k) => estadoDe(l, w, k)),
      ['falta', 'falta'],
      'la ruta no usó la zona o el nicho de la fila de W',
    );
    assert.deepEqual(['zona', 'nicho'].map((k) => estadoDe(l, y, k)), ['ok', 'ok'], 'la zona o el nicho de W pasaron a otro cliente');
  } finally {
    await admin.query(`update identidad.cuentas set estado = 'activa' where id = $1`, [z]);
    await admin.query(
      `update identidad.cuentas set zona_horaria = $2, nicho_confirmado_el = now(), nicho_confirmado_desde = 'plataforma' where id = $1`,
      [w, ZONA],
    );
  }
});

test('de identidad se leen sólo los clientes de la empresa pedida', async () => {
  const leidos = await conIdentidad((db) => leerLosClientesDe(db, org));
  assert.deepEqual(
    leidos.map((c) => c.id),
    [p, y, z, w],
    'la lectura sin filtro de identidad trajo clientes de otras empresas',
  );
});

test('la plataforma ve la lista de otra empresa con su orgId, la de esa empresa', async () => {
  const r = await leerRespuesta<Listado>(await listar(pedirComo(`/api/admin/cuentas?orgId=${org}`, tokenAria)));
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  const deLaEmpresa = await comoLaEmpresa();
  assert.deepEqual(r.cuerpo.clientes.map((c) => c.listaDeChequeo), deLaEmpresa.clientes.map((c) => c.listaDeChequeo));
  assert.equal(estadoDe(r.cuerpo, p, 'crm'), 'ok', 'la plataforma leyó la conexión de su propia empresa y no la de la pedida');
});
