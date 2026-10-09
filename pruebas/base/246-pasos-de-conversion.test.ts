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
// Lo que estos predicados miden sobre una COHORTE —la ventana, la anterior a la misma edad— se prueba al final
// de este archivo, con la lectura de los pasos (CV-2) en una empresa propia.
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
import { PERIODOS, type ClaveDePeriodo, periodoDe } from '../../lib/negocio/periodo.ts';
import { lecturaDeConversion, personasDeLaCohorte } from '../../lib/negocio/pasosDeConversion.ts';
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
  // La empresa propia de la lectura de los pasos, al final del archivo.
  await montarLaPropia();
});

after(async () => {
  await limpiar();
  if (propia) await borrarLaPropia(propia);
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

// ═══════════════════════════════════════════════════════════════════════════════
// LA LECTURA DE LOS PASOS (CV-2), EN UNA EMPRESA PROPIA
//
// Con su serie de gasto, sus vistas de Meta y sus lecturas al día, para que nada del sembrado de `alfa` mueva las
// cifras. La ventana de 7 días son los días cerrados de hace 7 a hace 1; la anterior, de hace 14 a hace 8. La
// historia de contactos empieza hace 26 días: cubre la anterior de 7, y no la de 30.
//
//   · los bordes son los de `bordesDelPeriodo`, y la anterior la del mismo largo — mutación: los días hasta hoy;
//   · la anterior se cuenta a la MISMA edad — mutación: sin la edad en la anterior;
//   · una cita congelada en la anterior apaga sólo la flecha de los agendados — mutación: sin la guarda;
//   · sin la lectura de contactos o la de citas al día, o sin historia, las personas no comparan — mutaciones:
//     ignorar la frescura, mirar una sola de las dos lecturas, o ignorar la historia;
//   · los que confirmaron, respondieron y cancelaron se cuentan entre los calificados — mutación: contar a todos;
//   · las vistas: comparan por su cuenta, con el gasto entero, y se apagan con un día sin cuenta, que no cuadra o
//     con el desglose incompleto; en «Completo» no se publican porque el desglose empieza después, y sin ninguna
//     fila ni cuenta que las mida son «—», no cero — mutaciones: ignorar la cobertura, el desglose o las filas;
//   · el formulario de «Completo» se mide sobre la cohorte hasta el corte — mutación: sobre la ventana entera;
//   · los contactos sin alta se dicen sólo en «Completo», y sin el campo de confirmación los confirmados son «—».
// ═══════════════════════════════════════════════════════════════════════════════

let propia: string;
const PREFIJO_DE_PASOS = 'pasos-246-';
/** Distinto del de arriba: `limpiar()` borra por prefijo y en todas las empresas. */
const CONTACTO_PROPIO = 'propia246-';
const CAMPANA = '246000001';
const ANUNCIO = '246000011';
const CAMPO_FORM = 'campo-form-246';
const CAMPO_CONF = 'campo-conf-246';
const CARPETA_246 = 'carpeta-246';

async function borrarLaPropia(org: string): Promise<void> {
  for (const tabla of [
    'citas', 'contactos', 'metricas_de_anuncio', 'anuncios', 'campanas', 'gasto_de_la_cuenta', 'lecturas_de_gasto',
    'tareas_programadas', 'campos_del_crm', 'carpetas_del_crm',
  ]) {
    await esc.admin.query(`delete from negocio.${tabla} where org_id = $1`, [org]);
  }
  await esc.admin.query('delete from identidad.organizaciones where id = $1', [org]);
}

const mediodia = (hace: number) => `(current_date - ${hace})::timestamptz + interval '12 hours'`;

/** Un contacto de la empresa propia. `alta` es SQL; `cita` siembra una cita con su reserva y su estado. */
async function enLaPropiaUnContacto(o: {
  alta: string | null;
  url?: string;
  etiquetas?: string[];
  campos?: Record<string, string>;
  cita?: { reservada?: string; estado?: string; calendario?: boolean };
}): Promise<string> {
  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos
       (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_ultima, etiquetas, campos_del_crm)
     values ($1, $2, 'Lead de prueba', 'setter', ${o.alta ?? 'null'}, $3::jsonb, $4, $5::jsonb) returning id`,
    [
      propia,
      `${CONTACTO_PROPIO}${randomUUID().slice(0, 8)}`,
      JSON.stringify(o.url ? { url: o.url } : { sessionSource: 'Paid Social' }),
      o.etiquetas ?? [],
      JSON.stringify(o.campos ?? {}),
    ],
  );
  const id = r.rows[0]!.id;
  if (o.cita) {
    await esc.admin.query(
      `insert into negocio.citas
         (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl, reservada_el)
       values ($1, $2, $3, $4, now() + interval '1 day', now() + interval '1 day 30 minutes', $5,
               ${o.cita.reservada ?? `now() - interval '1 hour'`})`,
      [propia, id, `ev246-${randomUUID()}`, o.cita.calendario === false ? null : 'cal-246', o.cita.estado ?? 'confirmed'],
    );
  }
  return id;
}

let hace: (n: number) => string;

/**
 * El gasto: el anuncio entregó cada día de hace 20 a hace 1, con su desglose y sus vistas de landing —`k` vistas el
 * día de hace `k`—, y el total de la cuenta igual a la suma, leído hoy: todos los días cerrados. Las vistas de la
 * ventana de 7 días suman 1+…+7 = 28; las de la anterior, 8+…+14 = 77.
 */
async function sembrarElGasto(): Promise<void> {
  for (let k = 1; k <= 20; k += 1) {
    await esc.admin.query(
      `insert into negocio.metricas_de_anuncio (org_id, meta_anuncio_id, fecha, gasto, impresiones, clics, acciones)
       values ($1, $2, current_date - $3::int, 10, 100, 5, $4::jsonb)`,
      [propia, ANUNCIO, k, JSON.stringify({ landingPageView: k, omniLandingPageView: k })],
    );
  }
  await esc.admin.query(
    `insert into negocio.gasto_de_la_cuenta (org_id, fecha, gasto, leido_el)
     select $1, m.fecha, sum(m.gasto), now() from negocio.metricas_de_anuncio m where m.org_id = $1 group by m.fecha`,
    [propia],
  );
}

/** La arma el `before` de arriba: dos `before` de primer nivel no garantizan su orden. */
async function montarLaPropia(): Promise<void> {
  const viejas = await esc.admin.query<{ id: string }>('select id from identidad.organizaciones where slug like $1', [
    `${PREFIJO_DE_PASOS}%`,
  ]);
  for (const v of viejas.rows) await borrarLaPropia(v.id);
  propia = (
    await esc.admin.query<{ id: string }>(
      `insert into identidad.organizaciones (nombre, slug) values ('Pasos 246', $1) returning id`,
      [`${PREFIJO_DE_PASOS}${randomUUID().slice(0, 8)}`],
    )
  ).rows[0]!.id;
  const fechas = await esc.admin.query<{ n: number; d: string }>(
    `select n, to_char(current_date - n, 'YYYY-MM-DD') as d from generate_series(0, 70) as n`,
  );
  const mapa = new Map(fechas.rows.map((f) => [Number(f.n), f.d]));
  hace = (k) => mapa.get(k)!;

  // Las lecturas automáticas al día: sin ellas las personas no comparan (`faltan_contactos`); las vistas, sí.
  for (const tarea of ['contactos', 'citas']) {
    await esc.admin.query(
      `insert into negocio.tareas_programadas (org_id, tarea, ultima_corrida_el, ultimo_estado) values ($1, $2, now(), 'corrio')`,
      [propia, tarea],
    );
  }

  // Los dos campos del CRM: el formulario de la landing y la confirmación.
  await esc.admin.query(
    `insert into negocio.carpetas_del_crm (org_id, carpeta_id, nombre, visto_el) values ($1, $2, 'Prueba', now())`,
    [propia, CARPETA_246],
  );
  await esc.admin.query(
    `insert into negocio.campos_del_crm (org_id, campo_id, nombre, carpeta_id, tipo, posicion, visto_el)
     values ($1, $2, $3, $5, 'SINGLE_OPTIONS', 1, now()), ($1, $4, $6, $5, 'SINGLE_OPTIONS', 2, now())`,
    [propia, CAMPO_FORM, 'Form Landing VSL', CAMPO_CONF, CARPETA_246, 'Confirmación Agendamiento'],
  );

  await esc.admin.query(`insert into negocio.campanas (org_id, meta_campana_id, nombre, estado) values ($1, $2, 'c', 'ACTIVE')`, [propia, CAMPANA]);
  await esc.admin.query(
    `insert into negocio.anuncios (org_id, meta_anuncio_id, meta_campana_id, nombre) values ($1, $2, $3, 'a')`,
    [propia, ANUNCIO, CAMPANA],
  );
  await sembrarElGasto();

  // La ventana de 7 días: catorce contactos.
  const LANDING = 'https://accelerator.ariaia.com/vsl';
  await enLaPropiaUnContacto({ alta: mediodia(2), url: LANDING, campos: { [CAMPO_CONF]: 'Si' }, cita: {} }); // calificado, confirmó
  await enLaPropiaUnContacto({ alta: mediodia(3), cita: { estado: 'cancelled' } }); // calificado, canceló todo
  await enLaPropiaUnContacto({ alta: mediodia(4), etiquetas: ['rechazado'], cita: {} }); // agendó, descartado
  for (let k = 0; k < 11; k += 1) await enLaPropiaUnContacto({ alta: mediodia(1 + (k % 7)) });
  // La anterior de 7 días: doce contactos; uno reservó antes de la edad de corte y otro después.
  await enLaPropiaUnContacto({ alta: mediodia(10), cita: { reservada: `now() - interval '9 days'` } }); // a la edad: sí
  await enLaPropiaUnContacto({ alta: mediodia(10), cita: { reservada: `now() - interval '5 days'` } }); // tarde: no
  for (let k = 0; k < 10; k += 1) await enLaPropiaUnContacto({ alta: mediodia(8 + (k % 7)) });
  /* La historia, hace 25 y 26 días: doce contactos, cinco con el formulario, todos de hace 26; uno más, de hace 25 y
     con el formulario incompleto, pone el corte en hace 25. Trece contactos hasta el corte, seis con el campo. */
  for (let k = 0; k < 12; k += 1) {
    await enLaPropiaUnContacto({ alta: mediodia(k < 6 ? 26 : 25), campos: k < 5 ? { [CAMPO_FORM]: 'Agendado' } : {} });
  }
  await enLaPropiaUnContacto({ alta: mediodia(25), campos: { [CAMPO_FORM]: 'Form incompleto sin agendar' } });
  // Uno sin fecha de alta: no entra en ninguna ventana.
  await enLaPropiaUnContacto({ alta: null });
}

const leerLosPasos = (clave: ClaveDePeriodo) =>
  conOrganizacion(propia, () => lecturaDeConversion(PERIODOS.find((p) => p.clave === clave)!, 'UTC'));

test('7 días: la ventana son los días cerrados de `bordesDelPeriodo`, y la anterior la del mismo largo justo antes', async () => {
  const l = await leerLosPasos('7d');
  assert.deepEqual(l.ventana, { desde: hace(7), hasta: hace(1) }, 'la ventana no son los días cerrados');
  assert.deepEqual(l.anterior, { desde: hace(14), hasta: hace(8) });
  assert.equal(l.pasos.sinComparacion, null);
  assert.equal(l.pasos.cifras.contactos.valor, 14);
  // Contra la anterior: catorce contra doce.
  assert.equal(l.pasos.cifras.contactos.variacion.tipo, 'sube');
  // Uno de los catorce entró por la landing, y ninguno de los doce de la anterior: la porción sube, sin color.
  const p = l.pasos.cifras.porLaLanding;
  assert.equal(p.porcion, 1 / 14, 'la porción por la landing no es la de la familia `landing` del reparto');
  assert.ok(p.variacion.tipo === 'sube' && p.variacion.lectura === 'neutra', `la porción no comparó: ${JSON.stringify(p.variacion)}`);
});

test('la anterior cuenta sus agendados a la MISMA edad: la cita reservada después del corte no cuenta', async () => {
  /* Tres agendados en la ventana; en la anterior, sólo el que reservó antes de `now() - 7 días`. Contada sin edad,
     la anterior tendría dos, y la flecha subiría la mitad. */
  const l = await leerLosPasos('7d');
  assert.equal(l.pasos.cifras.agendados.valor, 3);
  const v = l.pasos.cifras.agendados.variacion;
  assert.ok(v.tipo === 'sube' && v.porcentaje === 2, `la anterior no se contó a la misma edad: ${JSON.stringify(v)}`);
});

test('los agendados de la tarjeta son la suma del reparto, y la misma gente que la pasada por la cohorte', async () => {
  const l = await leerLosPasos('7d');
  const delReparto = l.recorrido.filas.reduce((s, f) => s + f.agendaron, 0);
  const personas = await conOrganizacion(propia, () => personasDeLaCohorte(l.ventana, null, null, null));
  assert.equal(delReparto, personas.agendados, 'el reparto y la pasada por la cohorte contaron agendados distintos');
  assert.equal(l.pasos.cifras.agendados.valor, delReparto);
});

test('calificados, no calificados, los que cancelaron y los que confirmaron, en personas', async () => {
  const c = (await leerLosPasos('7d')).pasos.cifras;
  assert.equal(c.calificados.valor, 2);
  assert.equal(c.noCalificados.valor, 1);
  assert.equal(c.cancelaron.valor, 1);
  assert.deepEqual([c.confirmados.valor, c.confirmados.respondieron], [1, 1]);

  /* Los tres se cuentan ENTRE LOS CALIFICADOS (CV15-18): un descartado que confirmó y canceló, y uno que respondió
     «No» sin haber agendado, no mueven ninguna de las tres cifras. */
  const ids = [
    await enLaPropiaUnContacto({ alta: mediodia(5), etiquetas: ['rechazado'], campos: { [CAMPO_CONF]: 'Si' }, cita: { estado: 'cancelled' } }),
    await enLaPropiaUnContacto({ alta: mediodia(6), campos: { [CAMPO_CONF]: 'No' } }),
  ];
  try {
    const d = (await leerLosPasos('7d')).pasos.cifras;
    assert.equal(d.cancelaron.valor, 1, 'contó a un descartado entre los que cancelaron');
    assert.equal(d.confirmados.valor, 1, 'contó a un descartado entre los que confirmaron');
    assert.equal(d.confirmados.respondieron, 1, 'contó a quien no calificó entre los que respondieron');
  } finally {
    for (const id of ids) {
      await esc.admin.query('delete from negocio.citas where contacto_id = $1', [id]);
      await esc.admin.query('delete from negocio.contactos where id = $1', [id]);
    }
  }
});

test('una cita congelada en la anterior apaga la flecha de los agendados, y sólo ésa', async () => {
  const id = await enLaPropiaUnContacto({ alta: mediodia(9), cita: { calendario: false, reservada: `now() - interval '9 days'` } });
  try {
    const c = (await leerLosPasos('7d')).pasos.cifras;
    assert.equal(c.agendados.congeladasEnLaAnterior, true);
    assert.deepEqual(c.agendados.variacion, { tipo: 'sin_comparacion' }, 'los agendados compararon contra una anterior con congeladas');
    assert.notEqual(c.contactos.variacion.tipo, 'sin_comparacion', 'la congelada apagó también los contactos');
  } finally {
    await esc.admin.query('delete from negocio.citas where contacto_id = $1', [id]);
    await esc.admin.query('delete from negocio.contactos where id = $1', [id]);
  }
});

test('sin la lectura de contactos o la de citas al día no compara; sin historia que cubra la anterior, tampoco', async () => {
  for (const tarea of ['contactos', 'citas']) {
    await esc.admin.query(`update negocio.tareas_programadas set ultimo_estado = 'fallo' where org_id = $1 and tarea = $2`, [propia, tarea]);
    try {
      const l = await leerLosPasos('7d');
      assert.equal(l.pasos.sinComparacion, 'faltan_contactos', `comparó con la lectura de ${tarea} fallando`);
      assert.equal(l.anterior, null);
      // Las vistas no son personas: comparan igual (CV15-07).
      assert.equal(l.pasos.cifras.vistas.variacion.tipo, 'baja', `las vistas dejaron de comparar por la lectura de ${tarea}`);
    } finally {
      await esc.admin.query(`update negocio.tareas_programadas set ultimo_estado = 'corrio' where org_id = $1 and tarea = $2`, [propia, tarea]);
    }
  }
  // La anterior de 30 días empieza hace 60, y el primer contacto es de hace 26.
  assert.equal((await leerLosPasos('30d')).pasos.sinComparacion, 'sin_historia');
});

test('las vistas de Meta: comparan con el gasto entero, y un día sin cuenta o que no cuadra las deja sin flecha', async () => {
  const entera = (await leerLosPasos('7d')).pasos.cifras.vistas;
  assert.equal(entera.valor, 28, 'las vistas no son la suma de `landingPageView` de la ventana (o se sumó `omni`)');
  assert.equal(entera.motivo, null);
  const v = entera.variacion;
  assert.ok(v.tipo === 'baja' && Math.abs(v.porcentaje - (77 - 28) / 77) < 1e-9, 'las vistas no compararon contra la anterior');

  await esc.admin.query(`delete from negocio.gasto_de_la_cuenta where org_id = $1 and fecha = current_date - 10`, [propia]);
  try {
    const sinUnDia = (await leerLosPasos('7d')).pasos.cifras.vistas;
    assert.equal(sinUnDia.valor, 28, 'sin un día de cuenta en la anterior, las vistas de la actual dejaron de publicarse');
    assert.equal(sinUnDia.motivo, 'dias_sin_leer');
    assert.deepEqual(sinUnDia.variacion, { tipo: 'sin_comparacion' }, 'las vistas compararon contra una anterior sin cuenta');
  } finally {
    // El día se vuelve a escribir con la fecha de la base, no con una que haya pasado por un `Date`.
    await esc.admin.query(
      `insert into negocio.gasto_de_la_cuenta (org_id, fecha, gasto, leido_el) values ($1, current_date - 10, 10, now())`,
      [propia],
    );
  }

  await esc.admin.query(`update negocio.gasto_de_la_cuenta set gasto = gasto + 50 where org_id = $1 and fecha = current_date - 3`, [propia]);
  try {
    const noCuadra = (await leerLosPasos('7d')).pasos.cifras.vistas;
    assert.equal(noCuadra.motivo, 'no_cuadra');
    assert.deepEqual(noCuadra.variacion, { tipo: 'sin_comparacion' });
  } finally {
    await esc.admin.query(`update negocio.gasto_de_la_cuenta set gasto = gasto - 50 where org_id = $1 and fecha = current_date - 3`, [propia]);
  }
});

test('con el desglose incompleto en la ventana o en la anterior, las vistas no se publican o no comparan', async () => {
  /* Una fila que entregó sin desglose: la suma sería la de una parte, aunque el gasto cuadre —el cuadre mira el
     gasto, no las acciones—. En la anterior, la flecha se apaga; en la actual, las vistas son «—». */
  const sinAcciones = (k: number) =>
    esc.admin.query(`update negocio.metricas_de_anuncio set acciones = null where org_id = $1 and fecha = current_date - $2::int`, [propia, k]);
  const conAcciones = (k: number) =>
    esc.admin.query(`update negocio.metricas_de_anuncio set acciones = $3::jsonb where org_id = $1 and fecha = current_date - $2::int`, [
      propia,
      k,
      JSON.stringify({ landingPageView: k, omniLandingPageView: k }),
    ]);
  await sinAcciones(9);
  try {
    const v = (await leerLosPasos('7d')).pasos.cifras.vistas;
    assert.equal(v.valor, 28);
    assert.equal(v.motivo, 'sin_desglose', 'comparó contra una anterior con una fila sin desglose');
    assert.deepEqual(v.variacion, { tipo: 'sin_comparacion' });
  } finally {
    await conAcciones(9);
  }
  await sinAcciones(3);
  try {
    const v = (await leerLosPasos('7d')).pasos.cifras.vistas;
    assert.deepEqual([v.valor, v.motivo], [null, 'sin_desglose'], 'publicó las vistas de una parte de la ventana');
  } finally {
    await conAcciones(3);
  }
});

test('sin ninguna fila de Meta, las vistas son «—» y no cero, salvo que la cuenta mida el cero', async () => {
  /* Sin filas no se sabe si hubo vistas, y un cero diría que no las hubo. La nota dice por qué faltan, salvo a una
     empresa que nunca pautó, a la que no le falta nada que leer. */
  const vistas = async () => (await leerLosPasos('7d')).pasos.cifras.vistas;
  const cuenta = (gasto: number, leido: string, extra = '') =>
    esc.admin.query(
      `insert into negocio.gasto_de_la_cuenta (org_id, fecha, gasto, leido_el${extra ? ', residuo_el' : ''})
       select $1, current_date - k, $2::numeric, ${leido}${extra} from generate_series(1, 20) as k`,
      [propia, gasto],
    );
  await esc.admin.query('delete from negocio.metricas_de_anuncio where org_id = $1', [propia]);
  await esc.admin.query('delete from negocio.gasto_de_la_cuenta where org_id = $1', [propia]);
  try {
    // 1 · Nunca pautó: ni filas ni cuenta. «—», y sin motivo.
    let v = await vistas();
    assert.deepEqual([v.valor, v.motivo], [null, null], `sin nada de Meta, las vistas dijeron ${JSON.stringify(v)}`);

    // 2 · La cuenta leída y en cero esos días: el cero es medido, nada entregó.
    await cuenta(0, 'now()');
    assert.equal((await vistas()).valor, 0, 'con la cuenta en cero, las vistas no dieron cero');

    // 3 · La cuenta en cero, pero sin leer en 27 horas: el colector está atrasado, y la nota lo dice.
    await esc.admin.query(`update negocio.gasto_de_la_cuenta set leido_el = now() - interval '27 hours' where org_id = $1`, [propia]);
    v = await vistas();
    assert.deepEqual([v.valor, v.motivo], [null, 'colector_atrasado'], `con el colector atrasado y sin filas: ${JSON.stringify(v)}`);

    // 4 · Al día, pero sin la cuenta de dos días de la ventana: faltan días.
    await esc.admin.query('update negocio.gasto_de_la_cuenta set leido_el = now() where org_id = $1', [propia]);
    await esc.admin.query('delete from negocio.gasto_de_la_cuenta where org_id = $1 and fecha in (current_date - 2, current_date - 4)', [propia]);
    v = await vistas();
    assert.deepEqual([v.valor, v.motivo], [null, 'dias_sin_leer'], `sin dos días de cuenta y sin filas: ${JSON.stringify(v)}`);

    // 5 · Todos los días declarados residuo: cuentan como enteros, y la cuenta gastó. No es un cero medido, y la nota
    //     dice que hay gasto que ninguna campaña explica.
    await esc.admin.query('delete from negocio.gasto_de_la_cuenta where org_id = $1', [propia]);
    await cuenta(50, 'now()', ', now()');
    v = await vistas();
    assert.deepEqual([v.valor, v.motivo], [null, 'no_cuadra'], `con la cuenta entera y gasto, sin filas: ${JSON.stringify(v)}`);
  } finally {
    await esc.admin.query('delete from negocio.gasto_de_la_cuenta where org_id = $1', [propia]);
    await sembrarElGasto();
  }
});

test('con el colector atrasado, las vistas dicen eso y no «faltan días»', async () => {
  /* Sin una lectura de la serie en 26 horas, ningún día cierra (`estadoDeLaSerie`), y la cobertura de la ventana
     también fallaría: el motivo que importa es el del colector, que manda a mirar la tarea y no los días. */
  await esc.admin.query(`update negocio.gasto_de_la_cuenta set leido_el = now() - interval '27 hours' where org_id = $1`, [propia]);
  try {
    const v = (await leerLosPasos('7d')).pasos.cifras.vistas;
    assert.equal(v.motivo, 'colector_atrasado', 'el colector atrasado se informó como días sin leer');
    assert.deepEqual(v.variacion, { tipo: 'sin_comparacion' });
  } finally {
    await esc.admin.query('update negocio.gasto_de_la_cuenta set leido_el = now() where org_id = $1', [propia]);
  }
});

test('«Completo»: sin vistas (el desglose empieza después), el formulario hasta el corte, y los sin alta dichos', async () => {
  const l = await leerLosPasos('completo');
  assert.equal(l.ventana.desde, hace(26), '«Completo» no empezó en el primer contacto');
  assert.equal(l.pasos.sinComparacion, 'periodo');
  assert.equal(l.pasos.cifras.vistas.valor, null, 'publicó vistas de una parte de la ventana');
  assert.equal(l.pasos.cifras.vistas.motivo, 'sin_desglose');

  /* El corte es hace 25. Hasta él hay trece contactos y seis traen el campo: la tasa es 6 de 13, y no 6 de los
     treinta y nueve de la ventana entera, que mezclaría las dos épocas. */
  const f = l.pasos.cifras.formulario;
  assert.equal(f.corte, hace(25));
  assert.equal(f.laVentanaLoCruza, true);
  assert.equal(f.valor, 6);
  assert.equal(f.tasa, 6 / 13, 'la tasa del formulario no es sobre la cohorte hasta el corte');
  assert.equal(l.pasos.sinAlta, 1);
  assert.equal((await leerLosPasos('7d')).pasos.sinAlta, null, 'los sin alta se dijeron fuera de «Completo»');
  // Y en 7 días el formulario no tiene a quién medir: la ventana empieza después del corte.
  const corto = (await leerLosPasos('7d')).pasos.cifras.formulario;
  assert.deepEqual([corto.valor, corto.tasa, corto.corte], [null, null, hace(25)]);
});

test('«Hoy» no compara; y sin el campo de confirmación en el CRM, los confirmados son «—»', async () => {
  const hoy = await leerLosPasos('hoy');
  assert.equal(hoy.pasos.sinComparacion, 'periodo');
  assert.equal(hoy.anterior, null);
  // Todavía no hay ninguna fila de Meta de hoy, y el día no está cerrado: «—», no cero, y sin motivo de días cerrados.
  assert.equal(hoy.pasos.cifras.vistas.valor, null, '«Hoy» publicó cero vistas antes de que el colector leyera el día');
  assert.equal(hoy.pasos.cifras.vistas.motivo, null, '«Hoy» dijo un motivo de los días cerrados');
  /* Con la foto de las 06:17 UTC: se publica, sin flecha y sin motivo, aunque el día no tenga la cuenta cerrada. */
  await esc.admin.query(
    `insert into negocio.metricas_de_anuncio (org_id, meta_anuncio_id, fecha, gasto, impresiones, clics, acciones)
     values ($1, $2, current_date, 4, 40, 2, '{"landingPageView": 3}'::jsonb)`,
    [propia, ANUNCIO],
  );
  try {
    const conFoto = (await leerLosPasos('hoy')).pasos.cifras.vistas;
    assert.deepEqual(
      [conFoto.valor, conFoto.motivo, conFoto.variacion],
      [3, null, { tipo: 'sin_comparacion' }],
      `«Hoy» con la foto del día: ${JSON.stringify(conFoto)}`,
    );
  } finally {
    await esc.admin.query('delete from negocio.metricas_de_anuncio where org_id = $1 and fecha = current_date', [propia]);
  }

  await esc.admin.query('update negocio.campos_del_crm set nombre = $2 where org_id = $1 and campo_id = $3', [
    propia,
    'Otro nombre',
    CAMPO_CONF,
  ]);
  try {
    const c = (await leerLosPasos('7d')).pasos.cifras;
    assert.deepEqual(c.confirmados, { valor: null, respondieron: null, tasa: null }, 'sin el campo, contó cero confirmados');
  } finally {
    await esc.admin.query('update negocio.campos_del_crm set nombre = $2 where org_id = $1 and campo_id = $3', [
      propia,
      'Confirmación Agendamiento',
      CAMPO_CONF,
    ]);
  }
});
