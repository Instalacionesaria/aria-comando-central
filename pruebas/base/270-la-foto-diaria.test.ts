// LA FOTO DIARIA DE LOS NEGOCIOS: QUÉ MIDE, DÓNDE LA GUARDA, Y QUIÉN NO LA VE. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Paso 8)
//
// La foto (`089`, `lib/cartera/*`) es lo que el tablero de Negocios dibuja y lo que un agente va a leer para sacar
// conclusiones. Una cifra mal atribuida acá es una conclusión falsa sobre un cliente:
//
//   · la configuración trae a todas las empresas menos las de control, y SÓLO presencias: ningún valor cifrado sale
//     de identidad — mutación: sin el filtro de `SLUGS_DE_CONTROL`, o la por omisión leída de `cuentas_credenciales`;
//   · la medida agrupa por cliente, y nulo no es cero: un cliente sin serie de gasto tiene gasto nulo — mutación: la
//     medida vacía con gasto `'0'`;
//   · los clientes de prueba no entran en los agregados de la empresa — mutación: sumar todos;
//   · se puede repetir el mismo día sin duplicar — mutación: el insert sin `on conflict`;
//   · una empresa que falla queda sin medir, con su motivo, y no frena a las demás — mutación: sin el try/catch;
//   · ninguna empresa cliente ve la foto ni puede escribir una — mutación: sin el disparador de la principal;
//   · el horario de la foto la toma y la sella bajo la principal, sin barrer empresas — mutación: sin el sello.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { leerLaConfiguracion, type ConfiguracionDeLosNegocios } from '../../lib/cartera/configuracion.ts';
import { COLUMNAS_DE_LAS_CUENTAS, COLUMNAS_DE_LAS_EMPRESAS } from '../../lib/cartera/contrato.ts';
import { tomarLaFoto } from '../../lib/cartera/foto.ts';
import { leerLaFoto } from '../../lib/cartera/lectura.ts';
import { medirLaEmpresa } from '../../lib/cartera/medicion.ts';
import { SLUGS_DE_CONTROL } from '../../lib/deteccion/sonda.ts';
import { barrerTodo } from '../../lib/negocio/barrido.ts';
import { GET as cron } from '../../app/api/cron/route.ts';

const SLUG = 'gamma-270';
/** Un valor «cifrado» de mentira: si aparece en la configuración, salió un valor y no una presencia. */
const SECRETO = 'secreto-de-mentira-270';
const DIA_MS = 24 * 3600_000;

let admin: Client;
let gamma: string;
let principal: string;
let porOmision: string;
let segunda: string;
let prueba: string;
let ahora: number;

async function limpiarLaFoto(): Promise<void> {
  await admin.query(`delete from negocio.foto_de_las_cuentas`);
  await admin.query(`delete from negocio.foto_de_las_empresas`);
  await admin.query(`delete from negocio.tareas_programadas where tarea = 'foto'`);
}

async function limpiar(): Promise<void> {
  await limpiarLaFoto();
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['resultados', 'contactos', 'gasto_de_la_cuenta', 'ingesta_pulso']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.organizaciones_credenciales where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

async function contacto(cuenta: string, id: string, diasAtras: number): Promise<string> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, alta_en_el_crm)
     values ($1, $2, $3, 'Contacto 270', now() - make_interval(days => $4)) returning id`,
    [gamma, cuenta, id, diasAtras],
  );
  assert.ok(c);
  return c.id;
}

const configuracion = (): Promise<ConfiguracionDeLosNegocios> => conIdentidad(leerLaConfiguracion);

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  ahora = Date.now();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 270', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  const p = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where es_principal`);
  assert.ok(o && p);
  gamma = o.id;
  principal = p.id;
  const c = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [gamma]);
  assert.ok(c, 'la empresa nueva no tiene su cliente por omisión');
  porOmision = c.id;
  const s = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Segunda 270', 'segunda-270') returning id`,
    [gamma],
  );
  const q = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, es_prueba) values ($1, 'Prueba 270', 'prueba-270', true) returning id`,
    [gamma],
  );
  assert.ok(s && q);
  segunda = s.id;
  prueba = q.id;

  // La empresa: llave de IA y el CRM de su cliente por omisión, en SU fila de credenciales (donde la escribe Ajustes).
  await admin.query(
    `insert into identidad.organizaciones_credenciales (org_id, ia_clave_cifrada, crm_token_cifrado, crm_estado, crm_calendario_id)
     values ($1, $2, $2, 'activa', 'calendario-270')`,
    [gamma, SECRETO],
  );

  // El por omisión: dos altas en la ventana, una en la anterior, una venta, gasto y la marca de su ingesta.
  const vendido = await contacto(porOmision, 'c270-1', 5);
  await contacto(porOmision, 'c270-2', 3);
  await contacto(porOmision, 'c270-3', 45);
  await admin.query(
    `insert into negocio.resultados (org_id, cuenta_id, contacto_id, salida, rol, monto) values ($1, $2, $3, 'venta', 'closer', 100)`,
    [gamma, porOmision, vendido],
  );
  await admin.query(`insert into negocio.gasto_de_la_cuenta (org_id, cuenta_id, fecha, gasto) values ($1, $2, current_date - 2, 50)`, [
    gamma,
    porOmision,
  ]);
  await admin.query(`insert into negocio.ingesta_pulso (org_id, cuenta_id, clave, marca_el) values ($1, $2, 'contactos', now())`, [
    gamma,
    porOmision,
  ]);
  // La segunda: dos altas, nada más. El de prueba: cuatro, que no tienen que aparecer en ningún agregado.
  await contacto(segunda, 'c270-4', 2);
  await contacto(segunda, 'c270-5', 1);
  for (const id of ['c270-6', 'c270-7', 'c270-8', 'c270-9']) await contacto(prueba, id, 1);
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('la configuración: todas menos las de control, la por omisión con lo de la empresa, y sólo presencias', async () => {
  const config = await configuracion();
  assert.equal(config.principal.id, principal);
  const slugs = config.empresas.map((e) => e.slug);
  for (const s of SLUGS_DE_CONTROL) assert.ok(!slugs.includes(s), `la organización de control «${s}» entró en la foto`);

  const g = config.empresas.find((e) => e.id === gamma);
  assert.ok(g, 'falta la empresa del archivo');
  assert.equal(g.llaveDeIa, true);
  assert.deepEqual(g.clientes.map((c) => c.id).sort(), [porOmision, segunda, prueba].sort());
  const de = new Map(g.clientes.map((c) => [c.id, c]));
  // El por omisión lee lo de la empresa (donde lo escribe Ajustes hoy); la segunda, lo suyo, que no tiene.
  assert.equal(de.get(porOmision)?.crmConectado, true, 'el por omisión no leyó el CRM de la empresa');
  assert.equal(de.get(porOmision)?.calendario, true);
  assert.equal(de.get(segunda)?.crmConectado, false, 'la segunda heredó el CRM de la empresa');
  assert.equal(de.get(segunda)?.calendario, false);
  assert.equal(de.get(prueba)?.esPrueba, true);

  assert.ok(!JSON.stringify(config).includes(SECRETO), 'salió un valor cifrado de identidad: tenía que ser una presencia');
});

test('la medida agrupa por cliente, y nulo no es cero', async () => {
  const m = await conOrganizacion(gamma, medirLaEmpresa);
  const p = m.porCliente.get(porOmision);
  const s = m.porCliente.get(segunda);
  assert.ok(p && s);
  assert.deepEqual(
    [p.contactos, p.contactosNuevos30d, p.contactosNuevos30dPrevios, p.ventas30d, p.compradores],
    [3, 2, 1, 1, 1],
    'el cliente por omisión',
  );
  assert.equal(Number(p.monto30d), 100);
  assert.equal(Number(p.gasto30d), 50);
  assert.ok(p.ultimaIngestaEl instanceof Date);
  assert.deepEqual([s.contactos, s.contactosNuevos30d, s.ventas30d, s.compradores], [2, 2, 0, 0], 'la segunda');
  // La segunda no tiene serie de gasto ni ingesta: nulo, que es «no hay», y no cero.
  assert.equal(s.gasto30d, null, 'un cliente sin serie de gasto salió con gasto');
  assert.equal(s.monto30d, null);
  assert.equal(s.ultimaIngestaEl, null);
});

test('la foto: una fila por empresa y por cliente, bajo la principal, sin nombres, y sin los de prueba', async () => {
  await limpiarLaFoto();
  const r = await tomarLaFoto(await configuracion(), ahora);
  assert.equal(r.sinMedir, 0);

  const e = await unaFila<Record<string, unknown>>(
    admin,
    `select * from negocio.foto_de_las_empresas where organizacion_ref = $1 and dia = $2`,
    [gamma, r.dia],
  );
  assert.ok(e, 'la empresa no quedó en la foto');
  assert.equal(e.org_id, principal, 'la foto quedó fuera de la principal');
  assert.equal(e.medida, true);
  // 3 + 2: los cuatro del cliente de prueba no cuentan.
  assert.equal(e.contactos, 5, 'los clientes de prueba entraron en los agregados de la empresa');
  assert.equal(e.ventas_30d, 1);
  assert.deepEqual([e.cuentas_activas, e.cuentas_de_prueba, e.llave_de_ia], [2, 1, true]);

  const cs = await filas<Record<string, unknown>>(
    admin,
    `select * from negocio.foto_de_las_cuentas where organizacion_ref = $1 and dia = $2`,
    [gamma, r.dia],
  );
  assert.equal(cs.length, 3);
  assert.ok(cs.every((c) => c.org_id === principal));
  const de = new Map(cs.map((c) => [c.cuenta_ref, c]));
  assert.equal(Number(de.get(porOmision)?.gasto_30d), 50);
  assert.equal(de.get(segunda)?.gasto_30d, null, 'nulo se escribió como cero');
  assert.equal(de.get(segunda)?.medida, true);
  // Sin calendario ni CRM, la segunda no está configurada, y lo dice.
  assert.equal(de.get(segunda)?.configurada, false);
  assert.ok((de.get(segunda)?.faltan as string[]).includes('crm'));

  const texto = JSON.stringify([e, cs]);
  for (const nombre of ['Gamma 270', 'Segunda 270', 'Prueba 270', 'Contacto 270']) {
    assert.ok(!texto.includes(nombre), `la foto guardó un nombre: «${nombre}»`);
  }
});

test('las columnas de la base son las del contrato, en su orden', async () => {
  for (const [tabla, contrato] of [
    ['foto_de_las_empresas', COLUMNAS_DE_LAS_EMPRESAS],
    ['foto_de_las_cuentas', COLUMNAS_DE_LAS_CUENTAS],
  ] as const) {
    const cols = await filas<{ c: string }>(
      admin,
      `select column_name as c from information_schema.columns where table_schema = 'negocio' and table_name = $1 order by ordinal_position`,
      [tabla],
    );
    assert.deepEqual(cols.map((x) => x.c), [...contrato], tabla);
  }
});

test('se puede repetir el mismo día: la segunda corrida actualiza, no duplica', async () => {
  await limpiarLaFoto();
  const config = await configuracion();
  const r = await tomarLaFoto(config, ahora);
  const antes = await unaFila<{ e: number; c: number }>(
    admin,
    `select (select count(*)::int from negocio.foto_de_las_empresas) as e, (select count(*)::int from negocio.foto_de_las_cuentas) as c`,
  );
  const nuevo = await contacto(segunda, 'c270-10', 1);
  try {
    await tomarLaFoto(config, ahora);
    const despues = await unaFila<{ e: number; c: number }>(
      admin,
      `select (select count(*)::int from negocio.foto_de_las_empresas) as e, (select count(*)::int from negocio.foto_de_las_cuentas) as c`,
    );
    assert.deepEqual(despues, antes, 'la segunda corrida del mismo día agregó filas');
    const s = await unaFila<{ contactos: number }>(
      admin,
      `select contactos from negocio.foto_de_las_cuentas where cuenta_ref = $1 and dia = $2`,
      [segunda, r.dia],
    );
    assert.equal(s?.contactos, 3, 'la segunda corrida no actualizó la fila');
  } finally {
    await admin.query(`delete from negocio.contactos where id = $1`, [nuevo]);
  }
});

test('una empresa que falla queda sin medir, con su motivo, y no frena a las demás', async () => {
  await limpiarLaFoto();
  const config = await configuracion();
  const r = await tomarLaFoto(config, ahora, async (orgId) => {
    if (orgId === gamma) throw new Error('una medida que falla, a propósito');
    return conOrganizacion(orgId, medirLaEmpresa);
  });
  assert.equal(r.sinMedir, 1);
  const es = await filas<{ organizacion_ref: string; medida: boolean; motivo_sin_medir: string | null; contactos: number | null }>(
    admin,
    `select organizacion_ref, medida, motivo_sin_medir, contactos from negocio.foto_de_las_empresas where dia = $1`,
    [r.dia],
  );
  assert.equal(es.length, config.empresas.length, 'faltan empresas: la que falló frenó a las demás');
  const g = es.find((x) => x.organizacion_ref === gamma);
  assert.deepEqual(g, { organizacion_ref: gamma, medida: false, motivo_sin_medir: 'no se pudo medir', contactos: null });
  assert.ok(es.filter((x) => x.organizacion_ref !== gamma).every((x) => x.medida), 'otra empresa quedó sin medir');
  const cs = await filas<{ medida: boolean; contactos: number | null }>(
    admin,
    `select medida, contactos from negocio.foto_de_las_cuentas where organizacion_ref = $1 and dia = $2`,
    [gamma, r.dia],
  );
  assert.ok(cs.length === 3 && cs.every((c) => !c.medida && c.contactos === null), 'un cliente sin medir salió con cifras');
});

test('ninguna empresa cliente ve la foto, ni puede escribir una', async () => {
  await limpiarLaFoto();
  await tomarLaFoto(await configuracion(), ahora);
  const alfa = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'alfa'`);
  assert.ok(alfa);
  const inq = await conectar('inquilino');
  try {
    for (const [org, espera] of [[alfa.id, 0], [principal, 1]] as const) {
      await inq.query('begin');
      await inq.query(
        `select set_config('app.org_id', $1, true), set_config('app.cuentas', '*', true), set_config('app.toda_la_organizacion', 'si', true)`,
        [org],
      );
      const n = await unaFila<{ n: number }>(inq, `select count(*)::int as n from negocio.foto_de_las_empresas where organizacion_ref = $1`, [gamma]);
      await inq.query('rollback');
      assert.equal(n?.n, espera, org === principal ? 'la principal no ve su foto' : 'una empresa cliente vio la foto');
    }

    await inq.query('begin');
    await inq.query(
      `select set_config('app.org_id', $1, true), set_config('app.cuentas', '*', true), set_config('app.toda_la_organizacion', 'si', true)`,
      [alfa.id],
    );
    await assert.rejects(
      inq.query(
        `insert into negocio.foto_de_las_empresas (org_id, dia, organizacion_ref, contrato, es_principal, activa, zona_horaria, alta_el,
           usuarios, usuarios_limitados, cuentas_activas, cuentas_pausadas, cuentas_de_baja, cuentas_de_prueba, cuentas_configuradas,
           llave_de_ia, configurada, medida)
         values ($1, current_date, $1, 1, true, true, 'UTC', now(), 0, 0, 0, 0, 0, 0, 0, false, false, true)`,
        [alfa.id],
      ),
      /sólo de la organización principal/,
      'una empresa cliente escribió una foto propia',
    );
    await inq.query('rollback');
  } finally {
    await inq.end();
  }
});

test('la lectura trae la última foto entera', async () => {
  await limpiarLaFoto();
  const config = await configuracion();
  const ayer = await tomarLaFoto(config, ahora - DIA_MS);
  const hoy = await tomarLaFoto(config, ahora);
  assert.notEqual(ayer.dia, hoy.dia);
  const f = await conOrganizacion(principal, leerLaFoto);
  assert.equal(f.dia, hoy.dia);
  assert.equal(f.empresas.length, config.empresas.length);
  assert.ok(f.empresas.every((e) => e.dia !== ayer.dia));
  assert.equal(f.empresas[0]?.es_principal, true, 'la principal va primero');
  assert.equal(f.cuentas.filter((c) => c.organizacion_ref === gamma).length, 3);
});

test('el horario de la foto la toma y la sella bajo la principal, sin barrer empresas', async () => {
  await limpiarLaFoto();
  process.env.CRON_SECRET = randomBytes(24).toString('hex');
  const r = await cron(
    new Request('https://ejemplo.test/api/cron', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, 'x-vercel-cron-schedule': '29 11 * * *' },
    }),
  );
  assert.equal(r.status, 200);
  const cuerpo = (await r.json()) as { tareas: string[]; renglones: unknown[]; foto: { estado: string; empresas?: number } };
  assert.deepEqual(cuerpo.tareas, ['foto']);
  assert.deepEqual(cuerpo.renglones, [], 'el horario de la foto barrió empresas');
  assert.equal(cuerpo.foto.estado, 'corrio');
  assert.ok((cuerpo.foto.empresas ?? 0) >= 3);
  const sellos = await filas<{ org_id: string; ultimo_estado: string }>(
    admin,
    `select org_id, ultimo_estado from negocio.tareas_programadas where tarea = 'foto'`,
  );
  assert.deepEqual(sellos, [{ org_id: principal, ultimo_estado: 'corrio' }], 'el sello de la foto no quedó en la principal');
});

test('sin la configuración, la foto sale `fallo` y lo dice', async () => {
  const r = await barrerTodo('29 11 * * *', []);
  assert.equal(r.foto.estado, 'fallo');
  assert.match(String(r.foto.porque), /configuración/);
});
