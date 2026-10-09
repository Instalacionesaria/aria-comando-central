// Las piezas de los pasos de Conversion: calificó, canceló, confirmó. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// TRES PREGUNTAS SOBRE UNA PERSONA, CADA UNA EN UN SOLO LUGAR
//
// El front del prototipo de Conversion (`docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`) dibuja en
// la Agenda cuántos de la cohorte calificaron, cuántos cancelaron todo lo que reservaron y cuántos confirmaron
// (CV15-09, CV15-15, CV15-18). Las tres preguntas ya se hacían en otro lado —«calificado» en Acquisition,
// «confirmó» en la tarjeta de citas— o no se hacían, y CV-1 las sacó a predicados compartidos para que
// ninguna pantalla haga una copia que diverja.
//
// Lo que cada prueba atrapa, con su mutación:
//
//   · calificado es agendó y no descartado — mutación: sacar el `not contactoDescartado`;
//   · a una edad, la cita reservada después no cuenta — mutación: ignorar `reservadaHaceDias`;
//   · la negación niega las dos condiciones — mutación: sacar los paréntesis de afuera;
//   · cancelar todo no es cancelar una — mutación: sacar `alcanzable` de la cita viva, o el «tuvo alguna»;
//   · sin el campo, ni confirmó ni respondió, y su negación no es nula — mutación: sacar el `coalesce`.
//
// Y la invariante de CV15-21: con los días cerrados de `bordesDelPeriodo`, la cohorte de Conversion es la
// misma gente que el `cobertura.sobre` de Acquisition — mutación: cortar Conversion con los días hasta hoy.
//
// Lo que estos predicados miden sobre una COHORTE —la ventana, la anterior a la misma edad— se prueba con el
// módulo de los pasos, en CV-2.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { esCalificado, todasSusCitasCanceladas } from '../../lib/negocio/citasAlcanzables.ts';
import { confirmoElAgendamiento, respondioLaConfirmacion } from '../../lib/negocio/indicadoresDeCitas.ts';
import { bordesDelPeriodo } from '../../lib/negocio/diasCerrados.ts';
import { embudosDeAcquisition } from '../../lib/negocio/embudosDeAcquisition.ts';
import { periodoDe } from '../../lib/negocio/periodo.ts';
import { recorridoDelLead } from '../../lib/negocio/recorridoDelLead.ts';

let esc: Escenario;

const CONTACTO = 'pasos246-';
/** El identificador del campo de confirmación. Los predicados lo reciben ya resuelto, sin el catálogo. */
const CAMPO = 'campo-confirmacion-246';

async function limpiar(): Promise<void> {
  await esc.admin.query(
    'delete from negocio.citas where contacto_id in (select id from negocio.contactos where ghl_contact_id like $1)',
    [`${CONTACTO}%`],
  );
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${CONTACTO}%`]);
}

interface Cita {
  /** `false`: congelada, sin calendario, como las anteriores a la `038`. */
  calendario?: boolean;
  estado?: string;
  /** SQL relativo a `now()`. */
  reservada?: string;
}

/** Un contacto, con sus citas. Devuelve su marca, que es la clave con la que se lee. */
async function unContacto(o: { etiquetas?: string[]; citas?: Cita[]; confirmacion?: string }): Promise<string> {
  const ghl = `${CONTACTO}${randomUUID().slice(0, 8)}`;
  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, etiquetas, campos_del_crm)
     values ($1, $2, 'Lead de prueba', 'setter', now() - interval '3 days', $3, $4::jsonb)
     returning id`,
    [esc.org, ghl, o.etiquetas ?? [], JSON.stringify(o.confirmacion === undefined ? {} : { [CAMPO]: o.confirmacion })],
  );
  for (const c of o.citas ?? []) {
    await esc.admin.query(
      `insert into negocio.citas
         (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl, reservada_el)
       values ($1, $2, $3, $4, now() + interval '1 day', now() + interval '1 day 30 minutes', $5,
               ${c.reservada ?? `now() - interval '5 days'`})`,
      [esc.org, r.rows[0]!.id, `ev246-${randomUUID()}`, c.calendario === false ? null : 'cal-246', c.estado ?? 'confirmed'],
    );
  }
  return ghl;
}

interface Respuestas {
  calificado: boolean;
  calificado_a_dos_dias: boolean;
  no_calificado: boolean;
  cancelo: boolean;
  no_cancelo: boolean;
  confirmo: boolean;
  no_confirmo: boolean;
  respondio: boolean;
}

/** Las preguntas, contra cada contacto de esta prueba. Bajo la RLS de la empresa, como las lee la pantalla. */
async function leer(): Promise<Map<string, Respuestas>> {
  return conOrganizacion(esc.org, async () => {
    const r = await sql<Respuestas & { marca: string }>`
      select c.ghl_contact_id as marca,
             ${esCalificado('c')} as calificado,
             ${esCalificado('c', 2)} as calificado_a_dos_dias,
             not ${esCalificado('c')} as no_calificado,
             ${todasSusCitasCanceladas('c')} as cancelo,
             not ${todasSusCitasCanceladas('c')} as no_cancelo,
             ${confirmoElAgendamiento('c', CAMPO)} as confirmo,
             not ${confirmoElAgendamiento('c', CAMPO)} as no_confirmo,
             ${respondioLaConfirmacion('c', CAMPO)} as respondio
        from negocio.contactos c
       where c.ghl_contact_id like ${`${CONTACTO}%`}`.execute(datos());
    return new Map(r.rows.map((f) => [f.marca, f]));
  });
}

before(async () => {
  esc = await montar('PasosDeConversion');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

// ─── CALIFICÓ ─────────────────────────────────────────────────────────────────

test('calificado es quien agendó y no está descartado; la etiqueta se lee en cualquier caja', async () => {
  await limpiar();
  const califica = await unContacto({ citas: [{}] });
  const descartado = await unContacto({ etiquetas: ['ICP_Rechazado'], citas: [{}] });
  const sinCita = await unContacto({});
  const congelada = await unContacto({ citas: [{ calendario: false }] });
  const r = await leer();

  assert.equal(r.get(califica)?.calificado, true);
  assert.equal(r.get(descartado)?.calificado, false, 'el descartado se contó como calificado');
  assert.equal(r.get(sinCita)?.calificado, false);
  assert.equal(r.get(congelada)?.calificado, false, 'una cita congelada contó como agendada');
});

test('a una edad, quien reservó después de ella todavía no calificó', async () => {
  /* La ventana anterior cuenta a sus contactos a la MISMA edad que los de la actual (A14-11). La cita de este
     contacto se reservó hace un día: a dos días de edad todavía no existía. */
  await limpiar();
  const reciente = await unContacto({ citas: [{ reservada: `now() - interval '1 day'` }] });
  const vieja = await unContacto({ citas: [{ reservada: `now() - interval '5 days'` }] });
  const r = await leer();

  assert.equal(r.get(reciente)?.calificado, true);
  assert.equal(r.get(reciente)?.calificado_a_dos_dias, false, 'la edad no cortó la cita reservada después');
  assert.equal(r.get(vieja)?.calificado_a_dos_dias, true);
});

test('la negación de «calificado» niega las dos condiciones a la vez', async () => {
  /* Sin los paréntesis de afuera, `not ${esCalificado(…)}` sería `not agendó and not descartado`: el
     descartado que agendó no saldría «no calificado», y la resta de la tarjeta dejaría de cuadrar. */
  await limpiar();
  const descartado = await unContacto({ etiquetas: ['rechazado'], citas: [{}] });
  const califica = await unContacto({ citas: [{}] });
  const r = await leer();

  assert.equal(r.get(descartado)?.no_calificado, true, 'la negación de «calificado» negó sólo una condición');
  assert.equal(r.get(califica)?.no_calificado, false);
});

// ─── CANCELÓ ──────────────────────────────────────────────────────────────────

test('canceló quien canceló TODAS sus citas vivas; volver a reservar no es cancelar', async () => {
  await limpiar();
  const una = await unContacto({ citas: [{ estado: 'cancelled' }] });
  const enMayuscula = await unContacto({ citas: [{ estado: 'Cancelled' }] });
  const volvio = await unContacto({ citas: [{ estado: 'cancelled' }, { estado: 'confirmed' }] });
  const viva = await unContacto({ citas: [{ estado: 'confirmed' }] });
  const r = await leer();

  assert.equal(r.get(una)?.cancelo, true);
  assert.equal(r.get(enMayuscula)?.cancelo, true, 'el estado del CRM se comparó con la caja');
  assert.equal(r.get(volvio)?.cancelo, false, 'quien canceló y volvió a reservar se contó como cancelado');
  assert.equal(r.get(viva)?.cancelo, false);
});

test('las citas congeladas no cuentan para cancelar ni para no cancelar', async () => {
  /* Su estado es una foto que el CRM ya no actualiza. Una congelada «confirmada» no rescata a quien canceló la
     única viva, y una congelada «cancelada» sola no es haber cancelado: no tuvo ninguna cita alcanzable. */
  await limpiar();
  const conCongeladaViva = await unContacto({ citas: [{ estado: 'cancelled' }, { estado: 'confirmed', calendario: false }] });
  const soloCongelada = await unContacto({ citas: [{ estado: 'cancelled', calendario: false }] });
  const sinCitas = await unContacto({});
  const viva = await unContacto({ citas: [{ estado: 'confirmed' }] });
  const r = await leer();

  assert.equal(r.get(conCongeladaViva)?.cancelo, true, 'una cita congelada contó como viva');
  assert.equal(r.get(soloCongelada)?.cancelo, false, 'quien sólo tiene una congelada se contó como cancelado');
  assert.equal(r.get(sinCitas)?.cancelo, false, 'quien nunca reservó se contó como cancelado');
  /* Y la negación niega todo el predicado. Sin los paréntesis de afuera, `not ${todasSusCitasCanceladas(…)}`
     sería `not tuvo alguna and not hay una viva`, y quien tiene una cita viva saldría «canceló o no se sabe». */
  assert.equal(r.get(viva)?.no_cancelo, true, 'la negación de «canceló» negó sólo una condición');
  assert.equal(r.get(soloCongelada)?.no_cancelo, true);
  assert.equal(r.get(conCongeladaViva)?.no_cancelo, false);
});

// ─── CONFIRMÓ ─────────────────────────────────────────────────────────────────

test('confirmó es el campo en `Si`, tal cual viene del CRM; sin el campo no confirmó ni respondió', async () => {
  await limpiar();
  const si = await unContacto({ confirmacion: 'Si' });
  const no = await unContacto({ confirmacion: 'No' });
  const sinCampo = await unContacto({});
  const r = await leer();

  assert.deepEqual([r.get(si)?.confirmo, r.get(si)?.respondio], [true, true]);
  assert.deepEqual([r.get(no)?.confirmo, r.get(no)?.respondio], [false, true]);
  assert.deepEqual([r.get(sinCampo)?.confirmo, r.get(sinCampo)?.respondio], [false, false]);
  /* Sin el `coalesce`, «no confirmó» de quien no tiene el campo sería nulo, y un `filter (where not …)` lo
     dejaría afuera: la resta de confirmados no cuadraría con la población. */
  assert.equal(r.get(sinCampo)?.no_confirmo, true, 'la negación de «confirmó» es nula sin el campo');
});

// ─── LA MISMA GENTE QUE ACQUISITION ───────────────────────────────────────────

test('con los días cerrados de `bordesDelPeriodo`, la cohorte de Conversion es el `cobertura.sobre` de Acquisition', async () => {
  /* La invariante de CV15-21: las dos pantallas cortan los mismos días y cuentan a la misma gente. Los cuatro
     contactos están en los bordes de cada ventana: entran la medianoche de `desde` y el último segundo de `hasta`;
     no entran el segundo anterior ni la medianoche siguiente.
     *
     * Mutaciones: que Conversion corte con los días que terminan hoy (`ventanaDeLaCohorte`) en vez de con la
     * ventana de `bordesDelPeriodo`, o que Acquisition vuelva a escribir su propia expresión con un borde
     * distinto: en las dos la cohorte y el `cobertura.sobre` dejan de coincidir. */
  await limpiar();
  const zona = (
    await esc.admin.query<{ z: string }>('select zona_horaria as z from identidad.organizaciones where id = $1', [esc.org])
  ).rows[0]!.z;

  for (const clave of ['7d', '30d'] as const) {
    const periodo = periodoDe(clave)!;
    const { ventana } = await conOrganizacion(esc.org, () => bordesDelPeriodo(periodo, zona, null));
    const instantes = (
      await esc.admin.query<{ a: string; b: string; c: string; d: string }>(
        `select ($1::date)::timestamptz::text as a,
                (($1::date)::timestamptz - interval '1 second')::text as b,
                (($2::date + 1)::timestamptz - interval '1 second')::text as c,
                ($2::date + 1)::timestamptz::text as d`,
        [ventana.desde, ventana.hasta],
      )
    ).rows[0]!;
    for (const alta of [instantes.a, instantes.b, instantes.c, instantes.d]) {
      await esc.admin.query(
        `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm)
         values ($1, $2, 'Lead de prueba', 'setter', $3::timestamptz)`,
        [esc.org, `${CONTACTO}${randomUUID().slice(0, 8)}`, alta],
      );
    }

    const conversion = await conOrganizacion(esc.org, () => recorridoDelLead(periodo.dias, ventana));
    const acquisition = await conOrganizacion(esc.org, () => embudosDeAcquisition(periodo, zona));
    assert.deepEqual(acquisition.ventana, ventana, `${clave}: Acquisition cortó otros días que \`bordesDelPeriodo\``);
    assert.equal(
      conversion.cohorte,
      acquisition.cobertura.sobre,
      `${clave}: con la misma ventana, Conversion y Acquisition contaron a gente distinta`,
    );
  }
});
