// LAS BAJAS DE LA REVISIÓN PARA PRODUCCIÓN: la cita con resultado se borra, y un alta no se cae por su cuenta. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (docs/modelo de datos/23-REVISION-PARA-PRODUCCION.md § 6, Bajas)
//
//   · la `083`: borrar una cita con resultado deja el resultado con cita_id nulo y su org_id intacto. La clave vieja de
//     la `049` (`resultados_cita_fk`, set null sin lista de columnas) intentaba poner org_id en nulo y el borrado
//     fallaba — mutación: volver a crear esa clave;
//   · la `085`: la organización nace con su cuenta aunque su nombre pase de 120, su slug quede vacío o su zona no
//     exista; y la location del CRM de la empresa llega a su cuenta por omisión al cargar las credenciales, si ninguna
//     otra cuenta la usa — mutaciones: el puente de la 085 de antes, sin el disparador de las credenciales.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';

let admin: Client;
let ident: Client;

before(async () => {
  admin = await conectar('admin');
  ident = await conectar('identidad');
});

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

test('borrar una cita con resultado deja el resultado sin cita y con su organización', async () => {
  const alfa = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'alfa'`);
  assert.ok(alfa, 'falta el sembrado');
  const vieja = await unaFila<{ n: number }>(admin, `select count(*)::int as n from pg_constraint where conname = 'resultados_cita_fk'`);
  assert.equal(vieja?.n, 0, 'sigue la clave de la 049, que pone org_id en nulo');

  const contacto = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre) values ($1, 'baja-325', 'Baja 325') returning id`,
    [alfa.id],
  );
  try {
    const cita = await unaFila<{ id: string }>(
      admin,
      `insert into negocio.citas (org_id, ghl_evento_id, contacto_id, inicio_el) values ($1, 'cita-325', $2, now()) returning id`,
      [alfa.id, contacto!.id],
    );
    const resultado = await unaFila<{ id: string }>(
      admin,
      `insert into negocio.resultados (org_id, contacto_id, cita_id, salida, rol) values ($1, $2, $3, 'seguimiento', 'closer') returning id`,
      [alfa.id, contacto!.id, cita!.id],
    );
    // Como el barrido de citas: el inquilino de la empresa borra la cita.
    await conOrganizacion(alfa.id, () => datos().deleteFrom('citas').where('id', '=', cita!.id).execute());
    const queda = await unaFila<{ org_id: string; cita_id: string | null }>(
      admin,
      `select org_id, cita_id from negocio.resultados where id = $1`,
      [resultado!.id],
    );
    assert.deepEqual(queda, { org_id: alfa.id, cita_id: null });
  } finally {
    await admin.query(`delete from negocio.contactos where id = $1`, [contacto!.id]);
  }
});

/** Corre `trabajo` dentro de una transacción de `ident` (el rol del alta) que se deshace siempre. */
async function deshaciendo(trabajo: () => Promise<void>): Promise<void> {
  await ident.query('begin');
  try {
    await trabajo();
  } finally {
    await ident.query('rollback');
  }
}

test('la organización nace con su cuenta aunque su nombre pase de 120, su slug quede vacío o su zona no exista', async () => {
  await deshaciendo(async () => {
    const largo = `Una agencia ${'muy '.repeat(40)}larga`;
    const org = await unaFila<{ id: string }>(
      ident,
      `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ($1, '---', 'Marte/Olimpo') returning id`,
      [largo],
    );
    const cuenta = await unaFila<{ nombre: string; slug: string; zona_horaria: string; es_por_omision: boolean }>(
      ident,
      `select nombre, slug, zona_horaria, es_por_omision from identidad.cuentas where org_id = $1`,
      [org!.id],
    );
    assert.ok(cuenta, 'la organización nació sin cuenta');
    assert.equal(cuenta.nombre, largo.trim().slice(0, 120));
    assert.match(cuenta.slug, /^cuenta-[0-9a-f]{12}$/);
    assert.equal(cuenta.zona_horaria, 'UTC');
    assert.equal(cuenta.es_por_omision, true);
  });
});

test('la location del CRM de la empresa llega a su cuenta por omisión al cargar las credenciales, si nadie la usa', async () => {
  await deshaciendo(async () => {
    const org = await unaFila<{ id: string }>(
      ident,
      `insert into identidad.organizaciones (nombre, slug) values ('Location 325', 'location-325') returning id`,
    );
    await ident.query(`insert into identidad.organizaciones_credenciales (org_id, crm_cuenta_id) values ($1, 'loc-325')`, [org!.id]);
    const cuenta = await unaFila<{ crm_cuenta_id: string | null }>(
      ident,
      `select crm_cuenta_id from identidad.cuentas where org_id = $1 and es_por_omision`,
      [org!.id],
    );
    assert.equal(cuenta?.crm_cuenta_id, 'loc-325', 'la location de la empresa no llegó a su cuenta');

    // Una location que ya es de otra cuenta no se copia (es única): la carga de credenciales no se cae por eso.
    const otra = await unaFila<{ id: string }>(
      ident,
      `insert into identidad.organizaciones (nombre, slug) values ('Otra 325', 'otra-325') returning id`,
    );
    await ident.query(`insert into identidad.organizaciones_credenciales (org_id, crm_cuenta_id) values ($1, 'loc-325')`, [otra!.id]);
    const suya = await unaFila<{ crm_cuenta_id: string | null }>(
      ident,
      `select crm_cuenta_id from identidad.cuentas where org_id = $1 and es_por_omision`,
      [otra!.id],
    );
    assert.equal(suya?.crm_cuenta_id, null, 'se copió una location que ya era de otra cuenta');

    // Y una cuenta que ya tiene su location no se pisa.
    await ident.query(`update identidad.organizaciones_credenciales set crm_cuenta_id = 'loc-325-b' where org_id = $1`, [org!.id]);
    const igual = await unaFila<{ crm_cuenta_id: string | null }>(
      ident,
      `select crm_cuenta_id from identidad.cuentas where org_id = $1 and es_por_omision`,
      [org!.id],
    );
    assert.equal(igual?.crm_cuenta_id, 'loc-325');
  });
});
