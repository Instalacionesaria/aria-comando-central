// LAS CIFRAS DE LA EMPRESA ENTERA CON VARIOS CLIENTES: LO DE CADA SUBCUENTA, CON LO SUYO. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, la revisión del Bloque C)
//
// Cada cliente trae lo de SU subcuenta y SU cuenta de Meta. Las pantallas de la empresa leen a todos juntos, y una
// lectura que suponía una sola subcuenta da una cifra equivocada en cuanto hay dos clientes con datos:
//
//   · el gasto de la cuenta se cuadra POR CLIENTE —su serie con el detalle de sus anuncios—: cruzado sólo por fecha,
//     el total de un cliente se comparaba con el detalle de todos y nada cuadraba nunca — mutación: el cruce por fecha;
//   · el borde de lo cerrado es el del cliente más atrasado — mutación: el `max` de todos;
//   · un campo del CRM por nombre es un id POR SUBCUENTA: los contactos de cada cliente se leen con el suyo —
//     mutación: `campoPorNombre` con `limit 1`;
//   · el puntaje de un lead de otro cliente sale del campo «Puntaje | ICP» de SU subcuenta, y una carpeta del Perfil
//     se reconoce por su nombre — mutación: el id fijo de la subcuenta de ARIA;
//   · «hay catálogo» es el de la subcuenta del contacto;
//   · los closers son de la empresa: con el foco en otro cliente se ven — mutación: sin la política de la `093`; el
//     cliente final ve los de SU cliente, no los designados sólo en otro (`100`);
//   · el último día del costo por anuncio es el del cliente más atrasado — mutación: el `max` de todos.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { coberturaDelGasto, diasSinCuadrar, estadoDeLaSerie } from '../../lib/negocio/gastoDeLaCuenta.ts';
import { campoPorNombre, grupoDeLaCarpeta, hayCatalogo, tieneElCampo, valorDelCampo } from '../../lib/negocio/camposDelCrm.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';
import { sincronizarContactos } from '../../lib/negocio/sincronizar.ts';
import { closersDeLaEmpresa } from '../../lib/negocio/alcanceDelCloser.ts';
import { costoDelAnuncio } from '../../lib/negocio/costoDelAnuncio.ts';
import { economiaDelNegocio } from '../../lib/negocio/economiaDelNegocio.ts';
import { NOMBRE_DEL_PUNTAJE } from '../../lib/ghl/contrato.ts';

const SLUG = 'gamma-281';
const ZONA = 'America/Lima';
const CAMPO = 'Campo de la prueba 281';

let admin: Client;
let org: string;
let p: string;
let y: string;
/** Los tres días cerrados de la ventana: anteayer y los dos anteriores, en UTC. */
let desde: string;
let hasta: string;

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['metricas_de_anuncio', 'anuncios', 'gasto_de_la_cuenta', 'contactos', 'campos_del_crm', 'carpetas_del_crm', 'closer_asignado', 'ingesta_pulso']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 281', $1, $2) returning id`,
    [SLUG, ZONA],
  );
  assert.ok(o);
  org = o.id;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  const segunda = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Segunda 281', 'segunda-281') returning id`,
    [org],
  );
  assert.ok(principal && segunda);
  p = principal.id;
  y = segunda.id;
  const d = await unaFila<{ desde: string; hasta: string }>(
    admin,
    `select to_char(current_date - 4, 'YYYY-MM-DD') as desde, to_char(current_date - 2, 'YYYY-MM-DD') as hasta`,
  );
  desde = d!.desde;
  hasta = d!.hasta;

  // Cada cliente con su anuncio, sus métricas y su serie: P gasta 100 por día, Y 50. Cada día cuadra en cada uno.
  for (const [cuenta, anuncio, gasto] of [
    [p, 'a281p', 100],
    [y, 'a281y', 50],
  ] as const) {
    await admin.query(
      `insert into negocio.anuncios (org_id, cuenta_id, meta_anuncio_id, meta_campana_id, nombre) values ($1, $2, $3, $4, $3)`,
      [org, cuenta, anuncio, `c-${anuncio}`],
    );
    await admin.query(
      `insert into negocio.metricas_de_anuncio (org_id, cuenta_id, meta_anuncio_id, fecha, gasto)
       select $1, $2, $3, f::date, $4 from generate_series($5::date, $6::date, interval '1 day') f`,
      [org, cuenta, anuncio, gasto, desde, hasta],
    );
    await admin.query(
      `insert into negocio.gasto_de_la_cuenta (org_id, cuenta_id, fecha, gasto, leido_el)
       select $1, $2, f::date, $3, now() from generate_series($4::date, $5::date, interval '1 day') f`,
      [org, cuenta, gasto, desde, hasta],
    );
  }
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('el gasto de dos clientes cuadra, cada uno con lo suyo, y la cuenta es la suma', async () => {
  const r = await conOrganizacion(org, () => coberturaDelGasto(desde, hasta, 3, ZONA));
  assert.deepEqual(r, { entero: true, motivo: null, deLaCuenta: 450 }, 'con dos clientes, el gasto de la empresa no cuadró');
  const sinCuadrar = await conOrganizacion(org, () =>
    diasSinCuadrar((alias) => sql<boolean>`${sql.ref(`${alias}.fecha`)} between ${desde}::date and ${hasta}::date`),
  );
  assert.equal(sinCuadrar, 0);
});

test('a un cliente le falta un día: la ventana no está entera, y el borde es el suyo', async () => {
  await admin.query(`delete from negocio.gasto_de_la_cuenta where org_id = $1 and cuenta_id = $2 and fecha = $3::date`, [org, y, hasta]);
  try {
    const r = await conOrganizacion(org, () => coberturaDelGasto(desde, hasta, 3, ZONA));
    assert.deepEqual(r, { entero: false, motivo: 'dias_sin_leer', deLaCuenta: null });
    const serie = await conOrganizacion(org, () => estadoDeLaSerie(ZONA));
    const anteayerDeHasta = await unaFila<{ d: string }>(admin, `select to_char($1::date - 1, 'YYYY-MM-DD') as d`, [hasta]);
    assert.equal(serie.ultimoCerrado, anteayerDeHasta!.d, 'el último día cerrado no es el del cliente más atrasado');
  } finally {
    await admin.query(
      `insert into negocio.gasto_de_la_cuenta (org_id, cuenta_id, fecha, gasto, leido_el) values ($1, $2, $3::date, 50, now())`,
      [org, y, hasta],
    );
  }
});

test('un campo del CRM por nombre es un id por subcuenta, y cada contacto se lee con el suyo', async () => {
  for (const [cuenta, campo, contacto] of [
    [p, 'campo281p', 'c281p'],
    [y, 'campo281y', 'c281y'],
  ] as const) {
    await admin.query(
      `insert into negocio.carpetas_del_crm (org_id, cuenta_id, carpeta_id, nombre) values ($1, $2, $3, 'Carpeta 281')`,
      [org, cuenta, `carpeta-${campo}`],
    );
    await admin.query(
      `insert into negocio.campos_del_crm (org_id, cuenta_id, campo_id, nombre, carpeta_id, tipo) values ($1, $2, $3, $4, $5, 'TEXT')`,
      [org, cuenta, campo, CAMPO, `carpeta-${campo}`],
    );
    await admin.query(
      `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, campos_del_crm)
       values ($1, $2, $3, 'Contacto 281', 'closer', now(), jsonb_build_object($4::text, 'Sí'))`,
      [org, cuenta, contacto, campo],
    );
  }
  const ids = await conOrganizacion(org, () => campoPorNombre(CAMPO));
  assert.deepEqual([...(ids ?? [])].sort(), ['campo281p', 'campo281y'], 'con la empresa entera hace falta el id de cada subcuenta');
  const leidos = await conOrganizacion(org, async () => {
    const campo = await campoPorNombre(CAMPO);
    assert.ok(campo);
    return datos()
      .selectFrom('contactos')
      .select([
        sql<number>`count(*) filter (where ${tieneElCampo(sql`campos_del_crm`, campo)})`.as('con'),
        sql<number>`count(*) filter (where ${valorDelCampo(sql`campos_del_crm`, campo)} = 'Sí')`.as('si'),
      ])
      .executeTakeFirstOrThrow();
  });
  assert.deepEqual({ con: Number(leidos.con), si: Number(leidos.si) }, { con: 2, si: 2 }, 'los contactos de un cliente se leyeron con el campo de otro');
  // Con el foco en Y, sólo el suyo.
  const foco = { orgId: org, todaLaOrganizacion: true, cuentas: [y] } as const;
  assert.deepEqual(await conOrganizacion(foco, () => campoPorNombre(CAMPO)), ['campo281y']);
});

test('el puntaje de un lead de otro cliente sale del campo de SU subcuenta, por su nombre', async () => {
  // El catálogo de Y, fresco: su «Puntaje | ICP» tiene otro id que el de la subcuenta de ARIA.
  await admin.query(
    `insert into negocio.carpetas_del_crm (org_id, cuenta_id, carpeta_id, nombre) values ($1, $2, 'carpeta281puntaje', 'Contact')`,
    [org, y],
  );
  await admin.query(
    `insert into negocio.campos_del_crm (org_id, cuenta_id, campo_id, nombre, carpeta_id, tipo, visto_el)
     values ($1, $2, 'puntaje281y', $3, 'carpeta281puntaje', 'NUMERICAL', now())`,
    [org, y, NOMBRE_DEL_PUNTAJE],
  );
  const original = globalThis.fetch;
  globalThis.fetch = (async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : String(entrada);
    const cuerpo = typeof opciones?.body === 'string' ? (JSON.parse(opciones.body) as { filters?: { value?: string }[] }) : {};
    if (url.includes('/contacts/search')) {
      const contactos =
        cuerpo.filters?.[0]?.value === 'zona_closer'
          ? [{ id: 'c281punt', contactName: 'Con puntaje', tags: ['zona_closer'], customFields: [{ id: 'puntaje281y', value: 77 }] }]
          : [];
      return new Response(JSON.stringify({ contacts: contactos, total: contactos.length }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof globalThis.fetch;
  try {
    const r = await conOrganizacion(ambitoDeUnCliente(org, y), () => sincronizarContactos({ token: 't281', locationId: 'loc281y' }));
    assert.equal(r.tipo, 'listo');
  } finally {
    globalThis.fetch = original;
  }
  const f = await unaFila<{ score: number | null; cuenta: string }>(
    admin,
    `select score, cuenta_id as cuenta from negocio.contactos where org_id = $1 and ghl_contact_id = 'c281punt'`,
    [org],
  );
  assert.deepEqual(f, { score: 77, cuenta: y }, 'el puntaje de un lead de otro cliente se buscó con el id de la subcuenta de ARIA');
});

test('una carpeta del Perfil se reconoce por su nombre en otra subcuenta, y «hay catálogo» es el del contacto', async () => {
  assert.equal(grupoDeLaCarpeta('otro-id-281', '📁 Score | ICP Nuevo'), 'calificacion');
  assert.equal(grupoDeLaCarpeta('otro-id-281', 'Una carpeta cualquiera'), null);
  assert.equal(grupoDeLaCarpeta('wl94HF4LeeVKSncXJd7n', null), 'calificacion', 'la de ARIA, por su id, dejó de reconocerse');
  // P no tiene catálogo propio; Y sí (las pruebas de arriba se lo cargaron).
  await admin.query(`delete from negocio.campos_del_crm where org_id = $1 and cuenta_id = $2`, [org, p]);
  assert.equal(await conOrganizacion(org, () => hayCatalogo(y)), true);
  assert.equal(await conOrganizacion(org, () => hayCatalogo(p)), false, 'el catálogo de otro cliente dijo que el de P se leyó');
});

test('los closers son de la empresa: con el foco en otro cliente se ven; el cliente final, los de su cliente', async () => {
  const u = await unaFila<{ id: string }>(admin, `insert into identidad.usuarios (org_id, nombre) values ($1, 'Closer 281') returning id`, [org]);
  assert.ok(u);
  // Se designa en el principal, como lo hace la pantalla (el puente pone la cuenta por omisión).
  await admin.query(`insert into negocio.closer_asignado (org_id, cuenta_id, usuario_id, crm_usuario_id) values ($1, $2, $3, 'crm281')`, [org, p, u.id]);
  const foco = { orgId: org, todaLaOrganizacion: true, cuentas: [y] } as const;
  const conFoco = await conOrganizacion(foco, () => closersDeLaEmpresa());
  assert.deepEqual(conFoco.map((c) => c.usuarioId), [u.id], 'con el foco en otro cliente, la empresa se quedó sin closers');
  /* El cliente final lee sólo las filas de SUS clientes (`100`): el de P lo ve, con un rótulo en vez de la persona; el
     de Y no, porque la designación es de P. Lo mide entero la 302. */
  const deP = await conOrganizacion({ orgId: org, todaLaOrganizacion: false, cuentas: [p] } as const, () => closersDeLaEmpresa());
  assert.deepEqual(deP.map((c) => c.nombre), ['Closer 1'], 'el cliente final no vio a los closers de su cliente, o vio a la persona');
  const deY = await conOrganizacion({ orgId: org, todaLaOrganizacion: false, cuentas: [y] } as const, () => closersDeLaEmpresa());
  assert.deepEqual(deY, [], 'el cliente final de Y leyó la designación de otro cliente');
});

test('el último día del costo por anuncio es el del cliente más atrasado', async () => {
  // Y deja de leerse el último día: el gasto mostrado llega hasta el día anterior.
  await admin.query(`delete from negocio.gasto_de_la_cuenta where org_id = $1 and cuenta_id = $2 and fecha = $3::date`, [org, y, hasta]);
  await admin.query(`delete from negocio.metricas_de_anuncio where org_id = $1 and cuenta_id = $2 and fecha = $3::date`, [org, y, hasta]);
  const r = await conOrganizacion(org, () => costoDelAnuncio(7));
  const anterior = await unaFila<{ d: string }>(admin, `select to_char($1::date - 1, 'YYYY-MM-DD') as d`, [hasta]);
  assert.equal(r.hasta, anterior!.d, 'el cliente al día tapó al que dejó de leerse');
});

test('el gasto del mes de dos clientes está entero cuando cada uno tiene todos sus días', async () => {
  // Cada cliente con su serie de todos los días del mes hasta ayer (en la zona de la empresa).
  for (const cuenta of [p, y]) {
    await admin.query(
      `insert into negocio.gasto_de_la_cuenta (org_id, cuenta_id, fecha, gasto, leido_el)
       select $1, $2, f::date, 10, now()
         from generate_series(date_trunc('month', timezone($3, now()))::date, timezone($3, now())::date - 1, interval '1 day') f
       on conflict (org_id, cuenta_id, fecha) do nothing`,
      [org, cuenta, ZONA],
    );
  }
  const e = await conOrganizacion(org, () => economiaDelNegocio(ZONA));
  assert.equal(e.gastoEntero, true, 'con dos clientes, cada día se contó dos veces y el gasto nunca estuvo entero');
  // Y si a uno le falta un día, no.
  await admin.query(
    `delete from negocio.gasto_de_la_cuenta
      where org_id = $1 and cuenta_id = $2 and fecha = (select min(fecha) from negocio.gasto_de_la_cuenta where org_id = $1 and cuenta_id = $2)`,
    [org, y],
  );
  const sinUnDia = await conOrganizacion(org, () => economiaDelNegocio(ZONA));
  const diasDelMes = await unaFila<{ n: number }>(admin, `select (timezone($1, now())::date - date_trunc('month', timezone($1, now()))::date)::int as n`, [ZONA]);
  if (diasDelMes!.n > 0) assert.equal(sinUnDia.gastoEntero, false, 'a un cliente le faltaba un día y el gasto se dio por entero');
});
