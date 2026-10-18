// LA SESIÓN DEL CLIENTE FINAL: SUS CUENTAS, SUS PANTALLAS, Y NADA MÁS. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Paso 4, `087`)
//
// El cliente final es una persona limitada a sus cuentas (`usuarios.limitado_a_cuentas`). La sesión lo traduce:
//
//   · ve sus cuentas y sólo ésas, conserva sólo las capacidades del cliente (sin el cerebro) y sólo sus pantallas —
//     mutación: no intersecar los permisos o el alcance;
//   · sin filas en `usuarios_cuentas` no ve NINGUNA cuenta, no todas — mutación: la regla de la Fase 0 («sin filas,
//     todas»), o sea no filtrar por sus filas;
//   · una cuenta de baja no aparece;
//   · un cliente enfocado de otra organización, escrito a mano, se ignora — mutación: no comprobar que esté entre las
//     visibles;
//   · no es «de la principal» aunque su organización lo sea — mutación: `esDeLaPrincipal` sin mirar el límite;
//   · la base sostiene el límite: `usuarios_cuentas` sólo para limitados; un limitado no tiene roles sin restringir ni
//     de plataforma; no se le quita el límite con cuentas asignadas — mutación: quitar cada disparador.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { sesionDe } from '../apoyo/closer.ts';
import { resolverSesion } from '../../lib/autorizacion/sesion.ts';
import { esDeLaPrincipal } from '../../lib/autorizacion/secciones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';

const SLUG = 'gamma-263';

let admin: Client;
let org: string;
let cuentaA: string;
let cuentaB: string;
let cliente: string;
let token: string;

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug) values ('Gamma 263', $1) returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  const a = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1`, [org]);
  const b = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, zona_horaria) values ($1, 'B 263', 'b-263', 'America/Bogota') returning id`,
    [org],
  );
  const u = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.usuarios (org_id, nombre, limitado_a_cuentas) values ($1, 'Cliente final 263', true) returning id`,
    [org],
  );
  assert.ok(a && b && u);
  cuentaA = a.id;
  cuentaB = b.id;
  cliente = u.id;
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'usuario' and org_id is null`,
    [cliente],
  );
  // Tres pestañas concedidas: dos son del cliente, la tercera (executive) no y tiene que caerse.
  await admin.query(
    `insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, 'contacts'), ($1, 'sales'), ($1, 'executive')`,
    [cliente],
  );
  await admin.query(`insert into identidad.usuarios_cuentas (org_id, usuario_id, cuenta_id) values ($1, $2, $3)`, [org, cliente, cuentaA]);
  token = await sesionDe(cliente);
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('el cliente final ve su cuenta, sólo las capacidades del cliente y sólo sus pantallas', async () => {
  const s = await resolverSesion(token);
  assert.ok(s);
  assert.equal(s.cuentas.limitado, true);
  assert.deepEqual(s.cuentas.visibles.map((c) => c.id), [cuentaA]);
  assert.deepEqual([...s.permisos].sort(), ['tablero.ver'], 'el cliente final conservó capacidades que no son del cliente');
  assert.ok(s.alcance.restringido);
  assert.deepEqual([...s.alcance.concedidas].sort(), ['contacts', 'sales']);
});

test('sin filas en usuarios_cuentas no ve ninguna cuenta, no todas', async () => {
  await admin.query('begin');
  try {
    await admin.query(`delete from identidad.usuarios_cuentas where usuario_id = $1`, [cliente]);
    await admin.query('commit');
    const s = await resolverSesion(token);
    assert.deepEqual(s?.cuentas.visibles, [], 'un cliente final sin cuentas vio las de su empresa');
  } finally {
    await admin.query(`insert into identidad.usuarios_cuentas (org_id, usuario_id, cuenta_id) values ($1, $2, $3)
                         on conflict do nothing`, [org, cliente, cuentaA]);
  }
});

test('una cuenta de baja no aparece', async () => {
  await admin.query(`insert into identidad.usuarios_cuentas (org_id, usuario_id, cuenta_id) values ($1, $2, $3)`, [org, cliente, cuentaB]);
  try {
    const antes = await resolverSesion(token);
    assert.deepEqual(antes?.cuentas.visibles.map((c) => c.id).sort(), [cuentaA, cuentaB].sort());
    await admin.query(`update identidad.cuentas set estado = 'baja', baja_el = now() where id = $1`, [cuentaB]);
    const despues = await resolverSesion(token);
    assert.deepEqual(despues?.cuentas.visibles.map((c) => c.id), [cuentaA], 'una cuenta de baja siguió a la vista');
  } finally {
    await admin.query(`update identidad.cuentas set estado = 'activa', baja_el = null where id = $1`, [cuentaB]);
    await admin.query(`delete from identidad.usuarios_cuentas where usuario_id = $1 and cuenta_id = $2`, [cliente, cuentaB]);
  }
});

test('un cliente enfocado de otra organización, escrito a mano, se ignora', async () => {
  const ajena = await unaFila<{ id: string }>(
    admin,
    `select c.id from identidad.cuentas c join identidad.organizaciones o on o.id = c.org_id where o.slug = 'beta'`,
  );
  assert.ok(ajena);
  await admin.query(`update identidad.sesiones set cuenta_activa = $1 where usuario_id = $2`, [ajena.id, cliente]);
  const s = await resolverSesion(token);
  assert.equal(s?.cuentas.activa, null, 'la sesión enfocó una cuenta de otra organización');
  await admin.query(`update identidad.sesiones set cuenta_activa = $1 where usuario_id = $2`, [cuentaA, cliente]);
  const propia = await resolverSesion(token);
  assert.equal(propia?.cuentas.activa, cuentaA);
  await admin.query(`update identidad.sesiones set cuenta_activa = null where usuario_id = $1`, [cliente]);
});

test('el cliente final no es «de la principal», aunque su organización lo sea', () => {
  assert.equal(
    esDeLaPrincipal({ esRolDePlataforma: false, organizacion: { esPrincipal: true }, cuentas: { limitado: true } }),
    false,
  );
  assert.equal(esDeLaPrincipal({ esRolDePlataforma: false, organizacion: { esPrincipal: true }, cuentas: { limitado: false } }), true);
});

test('la base sostiene el límite: cuentas sólo para limitados, sin roles de administración, sin quitarlo con cuentas', async () => {
  const otra = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.usuarios (org_id, nombre) values ($1, 'Persona 263') returning id`,
    [org],
  );
  assert.ok(otra);
  await assert.rejects(
    admin.query(`insert into identidad.usuarios_cuentas (org_id, usuario_id, cuenta_id) values ($1, $2, $3)`, [org, otra.id, cuentaA]),
    /no está limitada a sus cuentas/,
    'una persona sin el límite recibió cuentas',
  );
  await assert.rejects(
    admin.query(
      `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'administrador' and org_id is null`,
      [cliente],
    ),
    /sólo puede tener roles restringidos/,
    'un cliente final recibió el rol de administrador',
  );
  await assert.rejects(
    admin.query(`update identidad.usuarios set limitado_a_cuentas = false where id = $1`, [cliente]),
    /primero hay que quitarle sus cuentas/,
    'a un cliente final con cuentas se le quitó el límite',
  );
});
