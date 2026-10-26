// DESCARTA ES UN DESCARTE, Y CALIFICADO ES AGENDÓ CON PRIORIZA, VALIDA O FINANCIA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (ICP en cuadrantes · Q2, decidido por el usuario el 2026-10-26)
//
// Los dos predicados que todo el sistema usa para «descartado» y «calificado» viven en `citasAlcanzables.ts`: de ahí
// los toman Acquisition, Conversion, la cartera, la cadena de cierre de Sales, el cierre por closer, la asistencia de
// Conversation y Leads Portal. Si cambian acá, cambian en todas; si alguien los copia, divergen. Se prueba sobre siete
// personas que cubren cada combinación:
//
//   · el cuadrante Descarta descarta a la persona y a sus citas, como una etiqueta de descarte — mutación: sin el
//     `or … cuadrante`;
//   · un cuadrante nulo no descarta, también bajo un `not` — mutación: `=` en vez de `is not distinct from`;
//   · calificado es agendó + Prioriza/Valida/Financia + sin etiqueta de descarte — mutaciones: sin el cuadrante, con
//     Descarta en la lista, sin el `coalesce` (el nulo se volvería nulo bajo un `not`), sin el descarte por etiqueta;
//   · sin cita no hay calificado aunque el cuadrante sea Prioriza.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { contactoDescartado, descartado, esCalificado } from '../../lib/negocio/citasAlcanzables.ts';

const SLUG = 'epsilon-312';
let admin: Client;
let org: string;

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  await admin.query(`delete from negocio.citas where org_id = $1`, [o.id]);
  await admin.query(`delete from negocio.contactos where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Una persona con su cuadrante y sus etiquetas, y una cita alcanzable si `cita`. */
async function persona(nombre: string, cuadrante: string | null, o: { cita?: boolean; etiquetas?: string[] } = {}): Promise<void> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, cuadrante, etiquetas)
     values ($1, $2, $2, 'closer', now(), $3, $4) returning id`,
    [org, nombre, cuadrante, o.etiquetas ?? []],
  );
  assert.ok(c);
  if (o.cita === false) return;
  await admin.query(
    `insert into negocio.citas (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl)
     values ($1, $2, $3, 'cal-312', now() - interval '1 day', now() - interval '1 day' + interval '30 minutes', 'confirmed')`,
    [org, c.id, `ev312-${nombre}`],
  );
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Epsilon 312', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o, 'falta el sembrado');
  org = o.id;
  await persona('prioriza', 'prioriza');
  await persona('valida', 'valida');
  await persona('financia', 'financia');
  await persona('descarta', 'descarta');
  await persona('sin-clasificar', null);
  await persona('prioriza-con-etiqueta', 'prioriza', { etiquetas: ['ICP_Rechazado'] });
  await persona('prioriza-sin-cita', 'prioriza', { cita: false });
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

/** Lo que dicen los predicados de cada persona, por su nombre. */
const deCadaUna = () =>
  conOrganizacion(org, async () =>
    Object.fromEntries(
      (
        await datos()
          .selectFrom('contactos as c')
          .select([
            'c.nombre',
            sql<boolean>`${esCalificado('c')}`.as('calificado'),
            sql<boolean>`not ${esCalificado('c')}`.as('noCalificado'),
            sql<boolean>`${contactoDescartado('c')}`.as('descartado'),
            sql<boolean>`not ${contactoDescartado('c')}`.as('noDescartado'),
          ])
          .execute()
      ).map((f) => [f.nombre, { calificado: f.calificado, noCalificado: f.noCalificado, descartado: f.descartado, noDescartado: f.noDescartado }]),
    ),
  );

test('calificado es agendó con Prioriza, Valida o Financia, sin etiqueta de descarte; y los dos valores, también bajo un not', async () => {
  const p = await deCadaUna();
  const si = (calificado: boolean, descartado: boolean) => ({ calificado, noCalificado: !calificado, descartado, noDescartado: !descartado });
  assert.deepEqual(p, {
    prioriza: si(true, false),
    valida: si(true, false),
    financia: si(true, false),
    descarta: si(false, true),
    'sin-clasificar': si(false, false),
    'prioriza-con-etiqueta': si(false, true),
    'prioriza-sin-cita': si(false, false),
  });
});

test('las citas de un contacto en Descarta cuentan como descartadas, como las de uno con la etiqueta', async () => {
  const deLasCitas = await conOrganizacion(org, async () =>
    (
      await datos()
        .selectFrom('citas as ci')
        .innerJoin('contactos as c', (j) => j.onRef('c.id', '=', 'ci.contacto_id').onRef('c.org_id', '=', 'ci.org_id'))
        .select(['c.nombre', sql<boolean>`${descartado('ci')}`.as('descartada')])
        .orderBy('c.nombre')
        .execute()
    ).filter((f) => f.descartada).map((f) => f.nombre),
  );
  assert.deepEqual(deLasCitas, ['descarta', 'prioriza-con-etiqueta']);
  // Y la base tiene las siete: nada se perdió en el camino.
  assert.equal((await filas(admin, `select 1 from negocio.contactos where org_id = $1`, [org])).length, 7);
});
