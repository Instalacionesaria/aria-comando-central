// La cohorte de Leads Portal, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO PROTEGE
//
// Una fila por persona, con cinco preguntas ya contestadas —tramo, cita, asistencia, plantón y
// venta—, y cinco tarjetas contadas sobre esas mismas filas. Los defectos que importan no fallan: dan
// un número más grande y creíble.
//
//   · **Contar citas y rotularlas personas.** Tres citas de una persona son una persona que agendó.
//   · **Colapsar el «no se sabe» en «no».** Una cita que ocurrió sin que nadie registrara nada no es
//     un «no asistió», un plantón del calendario no es nuestra asistencia, y cero ventas registradas
//     no es un cierre de 0 %.
//   · **Clasificar dos veces.** El tramo que la tarjeta cuenta y el que la fila muestra salen de la
//     misma columna; si el corte de SQL y el de TypeScript divergen, la prueba de los bordes lo ve.
//   · **Mandar al navegador lo que no va.** La fila tiene exactamente catorce claves.
//
// Todas las pruebas comparten la organización `alfa` con el resto de la suite. Por eso cada una
// siembra con el prefijo `portal-`, limpia antes, y lo que es de toda la empresa —los que no tienen
// alta, los ceros recientes— se mide contra una línea base tomada en la misma prueba.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import {
  CLAVES_DE_LA_FILA,
  DIAS_DE_LOS_CEROS_RECIENTES,
  leadsDelPortal,
  type LeadsDelPortal,
} from '../../lib/negocio/leadsDelPortal.ts';
import { PISO_DE_UNA_TASA } from '../../lib/negocio/indicadoresDeCitas.ts';
import { tramoDelPuntaje } from '../../lib/negocio/tramosDelIcp.ts';
import { DIAS_DE_TODO } from '../../lib/negocio/periodo.ts';

let esc: Escenario;

const PREFIJO = 'portal-';

async function limpiar(): Promise<void> {
  const deLaPrueba = 'select id from negocio.contactos where ghl_contact_id like $1';
  await esc.admin.query(`delete from negocio.resultados where contacto_id in (${deLaPrueba})`, [`${PREFIJO}%`]);
  await esc.admin.query(`delete from negocio.citas where contacto_id in (${deLaPrueba})`, [`${PREFIJO}%`]);
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${PREFIJO}%`]);
}

interface Cita {
  /** Negativo para el pasado. En horas, porque «cerrable» mira `inicio_el < now()`. */
  haceHoras: number;
  estado?: string;
  congelada?: boolean;
  asistio?: boolean | null;
}

/** Un contacto con lo que haga falta. Devuelve su id. */
async function unContacto(o: {
  nombre?: string;
  /** Días desde el alta. `null` = sin alta. Por omisión, dos. */
  altaHaceDias?: number | null;
  creadoHaceDias?: number;
  score?: number | null;
  etiquetas?: string[];
  territorio?: 'closer' | 'setter' | null;
  atribucion?: Record<string, string>;
  citas?: Cita[];
  resultados?: { salida: string; monto?: number | null }[];
}): Promise<string> {
  const ghl = `${PREFIJO}${randomUUID().slice(0, 8)}`;
  const alta = o.altaHaceDias === undefined ? 2 : o.altaHaceDias;
  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos
       (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, creado_el, score, etiquetas,
        atribucion_primera, telefono, email)
     values ($1, $2, $3, $4,
             case when $5::int is null then null else now() - make_interval(days => $5::int) end,
             now() - make_interval(days => $6::int), $7, $8::text[], $9::jsonb,
             '+51 999 000 000', 'persona@ejemplo.test')
     returning id`,
    [
      esc.org,
      ghl,
      o.nombre ?? 'Lead de prueba',
      o.territorio === undefined ? 'closer' : o.territorio,
      alta,
      o.creadoHaceDias ?? 1,
      o.score === undefined ? 60 : o.score,
      o.etiquetas ?? [],
      JSON.stringify(o.atribucion ?? {}),
    ],
  );
  const id = r.rows[0]!.id;
  for (const [i, c] of (o.citas ?? []).entries()) {
    const inicio = new Date(Date.now() + c.haceHoras * 3600_000);
    await esc.admin.query(
      `insert into negocio.citas
         (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl, asistio)
       values ($1, $2, $3, $4, $5::timestamptz, $5::timestamptz + interval '1 hour', $6, $7)`,
      [esc.org, id, `cita-${ghl}-${i}`, c.congelada ? null : 'cal-portal', inicio, c.estado ?? 'confirmed', c.asistio ?? null],
    );
  }
  for (const res of o.resultados ?? []) {
    await esc.admin.query(
      `insert into negocio.resultados (org_id, contacto_id, salida, rol, registrado_por, monto)
         values ($1, $2, $3, 'closer', $4, $5)`,
      [esc.org, id, res.salida, esc.quien, res.monto ?? null],
    );
  }
  return id;
}

const leer = (dias = 30, tope?: number): Promise<LeadsDelPortal> =>
  conOrganizacion(esc.org, () => leadsDelPortal(dias, tope));
const filaDe = (r: LeadsDelPortal, id: string) => r.leads.find((l) => l.id === id);
const tramo = (r: LeadsDelPortal, clave: string) => r.tramos.find((t) => t.clave === clave)!;

/**
 * La org de prueba no puede tener ventas de otra prueba: varias afirmaciones de acá dependen de que
 * la empresa no tenga NINGUNA. Si esto falla, alguna prueba anterior dejó una venta sembrada.
 */
async function sinVentasAjenas(): Promise<void> {
  const r = await esc.admin.query<{ n: number }>(
    `select count(*)::int as n from negocio.resultados where org_id = $1 and salida = 'venta'`,
    [esc.org],
  );
  assert.equal(r.rows[0]!.n, 0, 'la organización de prueba ya tiene una venta de otra prueba');
}

before(async () => {
  esc = await montar('LeadsDelPortal');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

// ─── EL TRAMO ────────────────────────────────────────────────────────────────

test('el tramo de SQL es el de `tramoDelPuntaje`, borde por borde', async () => {
  /* La consulta repite el corte en SQL porque la base no puede llamar a TypeScript. Ésta es la prueba
     que obliga a que las dos formas digan lo mismo: con `>` en vez de `>=` en una de las dos, el 75
     cae en «medio» y la fila no coincide con la función. */
  await limpiar();
  const bordes = [null, 0, 1, 49, 50, 74, 75, 100];
  const ids = new Map<string, number | null>();
  for (const s of bordes) ids.set(await unContacto({ score: s }), s);

  const r = await leer();
  for (const [id, s] of ids) {
    assert.equal(filaDe(r, id)?.tramo, tramoDelPuntaje(s), `el puntaje ${s} cae en otro tramo en SQL`);
    assert.equal(filaDe(r, id)?.puntaje, s, 'el puntaje de la fila no es el del CRM: el 0 tiene que llegar como 0');
  }
});

test('las cuatro tarjetas suman el total de la cohorte, y «Todos» es esa suma', async () => {
  await limpiar();
  for (const s of [null, 0, 20, 55, 80, 90]) await unContacto({ score: s });

  const r = await leer();
  const suma = r.tramos.reduce((a, t) => a + t.contactos, 0);
  assert.equal(r.cohorte.total, 6);
  assert.equal(suma, r.cohorte.total, 'los tramos no suman la cohorte: alguien cayó fuera de los cuatro');
  assert.equal(r.todos.contactos, suma);
  assert.deepEqual(
    r.tramos.map((t) => [t.clave, t.contactos]),
    [['sin_calificar', 2], ['alto', 2], ['medio', 1], ['bajo', 1]],
  );
  assert.equal(tramo(r, 'alto').porcion, 2 / 6);
});

test('«Sin calificar» se parte en sin puntaje y en 0, y las dos partes suman la tarjeta', async () => {
  await limpiar();
  await unContacto({ score: null });
  await unContacto({ score: null });
  await unContacto({ score: 0 });
  await unContacto({ score: 40 });

  const r = await leer();
  assert.equal(r.sinCalificar.sinPuntaje, 2);
  assert.equal(r.sinCalificar.enCero, 1, 'el 0 se contó como sin puntaje, o no se contó');
  assert.equal(r.sinCalificar.sinPuntaje + r.sinCalificar.enCero, tramo(r, 'sin_calificar').contactos);
});

test('el guardián de los ceros mira la EMPRESA y los últimos 14 días, no la ventana', async () => {
  /* Si se midiera dentro de la cohorte, el aviso se encendería con «30 días» y se apagaría con
     «7 días» para el mismo 0. La mutación que lo pone rojo es justamente ésa. */
  await limpiar();
  const base = (await leer(1)).sinCalificar.cerosRecientes;
  await unContacto({ score: 0, altaHaceDias: 10 });
  await unContacto({ score: 0, altaHaceDias: DIAS_DE_LOS_CEROS_RECIENTES + 6 });

  const hoy = await leer(1);
  const siete = await leer(7);
  const todo = await leer(DIAS_DE_TODO);
  assert.equal(hoy.sinCalificar.cerosRecientes, base + 1, 'con «Hoy» el 0 de hace diez días no encendió el guardián');
  assert.equal(siete.sinCalificar.cerosRecientes, base + 1);
  assert.equal(todo.sinCalificar.cerosRecientes, base + 1, 'el 0 de hace veinte días se contó como reciente');
  assert.equal(hoy.sinCalificar.enCero, 0, 'el 0 de hace diez días entró en la cohorte de hoy');
  assert.match(String(hoy.aviso), /puntaje del CRM en 0/, 'el guardián encendido no aparece en el aviso');
});

// ─── LA COHORTE ──────────────────────────────────────────────────────────────

test('la cohorte se arma con el alta en el CRM, no con cuándo lo vio el barrido', async () => {
  /* `creado_el` es la marca de nuestro barrido, y en la carga inicial es la misma para cientos: una
     cohorte por `creado_el` salta de golpe sin que entre nadie. */
  await limpiar();
  const reciente = await unContacto({ altaHaceDias: 2, creadoHaceDias: 90 });
  const viejo = await unContacto({ altaHaceDias: 60, creadoHaceDias: 1 });

  const r = await leer(30);
  assert.ok(filaDe(r, reciente), 'un alta de hace dos días no entró porque el barrido lo vio hace noventa');
  assert.equal(filaDe(r, viejo), undefined, 'un alta de hace sesenta días entró porque el barrido lo vio ayer');
  assert.equal(r.cohorte.total, 1);
});

test('los que no tienen alta no entran en ninguna ventana, y se declaran', async () => {
  await limpiar();
  const base = await leer(DIAS_DE_TODO);
  await unContacto({ altaHaceDias: null, territorio: null });

  const r = await leer(DIAS_DE_TODO);
  assert.equal(r.cohorte.total, base.cohorte.total, 'un contacto sin alta entró en «Completo»');
  assert.equal(r.cohorte.sinAlta, base.cohorte.sinAlta + 1);
  assert.equal(r.cohorte.universo, base.cohorte.universo + 1);
  assert.match(String(r.aviso), /no tienen fecha de alta/);
});

test('con la cohorte vacía la porción es nula, no 0 %, y el aviso lo dice', async () => {
  await limpiar();
  await unContacto({ altaHaceDias: 5 });

  const r = await leer(1);
  assert.equal(r.cohorte.total, 0);
  assert.equal(r.todos.porcion, null, 'un «0 %» sobre nadie afirma algo');
  assert.ok(r.tramos.every((t) => t.porcion === null));
  assert.match(String(r.aviso), /No entró ni un contacto/);
  assert.ok(r.cohorte.ultimaAlta, 'con la cohorte vacía, la última alta de la empresa es lo que dice cuándo entró alguien');
});

test('la lista viaja ordenada por alta, la más reciente primero', async () => {
  await limpiar();
  const vieja = await unContacto({ altaHaceDias: 20 });
  const nueva = await unContacto({ altaHaceDias: 1 });
  const media = await unContacto({ altaHaceDias: 10 });

  const r = await leer();
  assert.deepEqual(r.leads.map((l) => l.id), [nueva, media, vieja]);
});

test('con el tope, la lista se recorta y lo dice, y las tarjetas siguen contando a todos', async () => {
  await limpiar();
  for (let i = 0; i < 3; i += 1) await unContacto({});

  const r = await leer(30, 2);
  assert.equal(r.leads.length, 2);
  assert.equal(r.truncado, true, 'la lista llegó recortada sin decirlo');
  assert.equal(r.cohorte.total, 3);
  assert.equal(r.todos.contactos, 3, 'las tarjetas contaron sólo lo que llegó en la lista');
  assert.match(String(r.aviso), /recortada/);
  assert.equal((await leer(30)).truncado, false);
});

// ─── LA CITA ─────────────────────────────────────────────────────────────────

test('tres citas de una persona son una persona que agendó', async () => {
  await limpiar();
  await unContacto({ citas: [{ haceHoras: -3 }, { haceHoras: -30 }, { haceHoras: +30 }] });

  const r = await leer();
  assert.equal(r.leads.length, 1);
  assert.equal(r.todos.agendados, 1, 'se contaron citas y no personas');
});

test('una cita cancelada cuenta como agendó; una persona con sólo congeladas no, y se marca aparte', async () => {
  /* Es la definición del sistema (`tieneCitaAlcanzable`): la misma de Sales, Creative y Conversion. */
  await limpiar();
  const cancelo = await unContacto({ citas: [{ haceHoras: -3, estado: 'cancelled' }] });
  const congelado = await unContacto({ citas: [{ haceHoras: -3, congelada: true }] });
  const sinCita = await unContacto({});

  const r = await leer();
  assert.equal(filaDe(r, cancelo)?.cita, 'agendo', 'una cancelada dejó de contar como agendó');
  assert.equal(filaDe(r, congelado)?.cita, 'solo_congeladas');
  assert.equal(filaDe(r, sinCita)?.cita, 'sin_cita');
  assert.equal(r.todos.agendados, 1, 'la persona con sólo citas congeladas entró en «Agendados»');
  assert.equal(r.todos.soloCongeladas, 1);
  assert.match(String(r.aviso), /congeladas/);
});

// ─── LA ASISTENCIA ───────────────────────────────────────────────────────────

test('la asistencia: lo registrado gana, y sin registro sólo es «sin registrar» si la cita ya ocurrió', async () => {
  await limpiar();
  const fue = await unContacto({ citas: [{ haceHoras: -3, asistio: false }, { haceHoras: -30, asistio: true }] });
  const noFue = await unContacto({ citas: [{ haceHoras: -3, asistio: false }] });
  const sinRegistro = await unContacto({ citas: [{ haceHoras: -3 }] });
  const futura = await unContacto({ citas: [{ haceHoras: +30 }] });
  const cancelada = await unContacto({ citas: [{ haceHoras: -3, estado: 'cancelled' }] });
  const congelada = await unContacto({ citas: [{ haceHoras: -3, congelada: true }] });
  /* `asistio` lo escribe Avanzar, no el CRM: una cita congelada con la asistencia cargada sigue
     diciendo la verdad. */
  const congeladaQueFue = await unContacto({ citas: [{ haceHoras: -3, congelada: true, asistio: true }] });

  const r = await leer();
  assert.equal(filaDe(r, fue)?.asistencia, 'asistio', 'un «sí» en cualquier cita tiene que ganar');
  assert.equal(filaDe(r, noFue)?.asistencia, 'no_asistio');
  assert.equal(filaDe(r, sinRegistro)?.asistencia, 'sin_registrar');
  assert.equal(filaDe(r, futura)?.asistencia, null, 'preguntar por una cita de mañana es pedir un pronóstico');
  assert.equal(filaDe(r, cancelada)?.asistencia, null, 'nadie faltó a una cita que no ocurrió');
  assert.equal(filaDe(r, congelada)?.asistencia, null, 'una congelada sin registro no es «sin registrar»');
  assert.equal(filaDe(r, congeladaQueFue)?.asistencia, 'asistio');
  assert.equal(r.todos.asistieron, 2);
  assert.equal(r.todos.sinRegistrar, 1);
  assert.match(String(r.aviso), /nadie registró si se presentaron/);
});

test('el plantón del calendario viaja aparte y no se convierte en «no asistió»', async () => {
  /* Son dos fuentes de la misma pregunta y sólo una es nuestra. Una cita `noshow` que ya pasó sigue
     siendo una cita sin asistencia registrada. */
  await limpiar();
  const planton = await unContacto({ citas: [{ haceHoras: -3, estado: 'noshow' }] });

  const r = await leer();
  assert.equal(filaDe(r, planton)?.planton, true);
  assert.equal(filaDe(r, planton)?.asistencia, 'sin_registrar', 'el plantón del calendario se sumó a la asistencia');
  assert.equal(r.todos.asistieron, 0);
});

// ─── LA VENTA ────────────────────────────────────────────────────────────────

test('sin ninguna venta en la empresa, el cierre y el monto son nulos con su motivo, no 0 %', async () => {
  /* Es el caso de hoy en producción. Un «0 %» en cada tarjeta se leería como «ningún tramo compra»;
     lo cierto es que nadie registró una venta. */
  await limpiar();
  await sinVentasAjenas();
  for (let i = 0; i < PISO_DE_UNA_TASA + 2; i += 1) await unContacto({ score: 80 });

  const r = await leer();
  assert.equal(r.hayVentasRegistradas, false);
  for (const t of [...r.tramos, r.todos]) {
    assert.equal(t.cierre, null, `«${t.rotulo}» publicó un cierre sin ninguna venta registrada`);
    assert.equal(t.porQueSinCierre, 'sin_ventas_registradas');
    assert.equal(t.montoReportado, null, `«${t.rotulo}» publicó un monto sin ninguna venta`);
    assert.equal(t.porQueSinMonto, 'sin_ventas_registradas');
  }
});

test('un acuerdo sin pago no es una venta', async () => {
  await limpiar();
  await sinVentasAjenas();
  const acuerdo = await unContacto({ resultados: [{ salida: 'acuerdo_sin_pago', monto: 500 }] });

  const r = await leer();
  assert.equal(filaDe(r, acuerdo)?.vendio, false, 'un acuerdo sin pago contó como venta');
  assert.equal(filaDe(r, acuerdo)?.monto, null, 'el monto de un acuerdo sin pago se sumó como reportado');
  assert.equal(r.todos.vendidos, 0);
  assert.equal(r.hayVentasRegistradas, false);
});

test('con ventas en la empresa: el piso, el cero medido, y el monto reportado', async () => {
  await limpiar();
  await sinVentasAjenas();
  /* Tramo alto: once personas, dos venden (una con monto y otra sin). Pasa el piso. */
  await unContacto({ score: 90, resultados: [{ salida: 'venta', monto: 1000 }, { salida: 'venta', monto: 250.5 }] });
  const sinMonto = await unContacto({ score: 90, resultados: [{ salida: 'venta', monto: null }] });
  for (let i = 0; i < 9; i += 1) await unContacto({ score: 90 });
  /* Tramo medio: diez personas y ninguna venta. Pasa el piso: su 0 % es un hecho. */
  for (let i = 0; i < PISO_DE_UNA_TASA; i += 1) await unContacto({ score: 60 });
  /* Tramo bajo: tres personas, una vende. No pasa el piso. */
  await unContacto({ score: 20, resultados: [{ salida: 'venta', monto: 300 }] });
  await unContacto({ score: 20 });
  await unContacto({ score: 20 });

  const r = await leer();
  const alto = tramo(r, 'alto');
  const medio = tramo(r, 'medio');
  const bajo = tramo(r, 'bajo');
  assert.equal(r.hayVentasRegistradas, true);

  assert.equal(alto.vendidos, 2, 'dos ventas de la misma persona se contaron como dos personas');
  assert.equal(alto.cierre, 2 / 11);
  assert.equal(alto.montoReportado, 1250.5);
  assert.equal(alto.ventasSinMonto, 1);
  assert.equal(filaDe(r, sinMonto)?.monto, null, 'una venta sin monto se mostró como $0');
  assert.equal(filaDe(r, sinMonto)?.vendio, true);

  assert.equal(medio.cierre, 0, 'con ventas en la empresa, un tramo sobre el piso sin ventas es un 0 % medido');
  assert.equal(medio.porQueSinCierre, null);
  assert.equal(medio.montoReportado, 0, 'con ventas en la empresa, un tramo sin ventas reportó un nulo en vez de 0');

  assert.equal(bajo.cierre, null, 'con tres personas, una venta publicó un 33 %');
  assert.equal(bajo.porQueSinCierre, 'bajo_el_piso');
  assert.equal(bajo.montoReportado, 300, 'el monto no lleva piso: es una suma');

  assert.equal(r.todos.vendidos, 3);
  assert.equal(r.todos.montoReportado, 1550.5);
  assert.match(String(r.aviso), /no tienen el monto cargado/);
  assert.match(String(r.aviso), /no un pago verificado/);
});

test('un tramo con ventas y ningún monto cargado dice por qué, en vez de reportar $0', async () => {
  await limpiar();
  await sinVentasAjenas();
  await unContacto({ score: 90, resultados: [{ salida: 'venta', monto: null }] });

  const r = await leer();
  assert.equal(tramo(r, 'alto').montoReportado, null);
  assert.equal(tramo(r, 'alto').porQueSinMonto, 'ventas_sin_monto');
});

// ─── LA FILA ─────────────────────────────────────────────────────────────────

test('«ICP_Rechazado» marca al descartado aunque venga con otra caja, y no lo saca de la cohorte', async () => {
  await limpiar();
  const rechazado = await unContacto({ etiquetas: ['ICP_Rechazado'] });
  const otro = await unContacto({ etiquetas: ['vip'] });

  const r = await leer();
  assert.equal(filaDe(r, rechazado)?.descartado, true, 'la etiqueta con mayúsculas no se reconoció');
  assert.equal(filaDe(r, otro)?.descartado, false);
  assert.equal(r.cohorte.total, 2, 'el descartado salió de la cohorte: es un atributo de la fila, no un filtro');
});

test('la fila trae exactamente sus catorce claves: ni teléfono, ni correo, ni atribución cruda', async () => {
  /* «Exactamente» y no «no contiene»: una clave nueva tiene que poner esto en rojo aunque hoy no esté
     prohibida. El contacto sembrado TIENE teléfono, correo, atribución con IP y etiquetas: si alguna
     se colara, está ahí para colarse. */
  await limpiar();
  const id = await unContacto({
    etiquetas: ['vip'],
    atribucion: { campaign: 'Campaña X', utmContent: 'Pieza 3', ip: '203.0.113.9', fbclid: 'abc' },
  });

  const r = await leer();
  const fila = filaDe(r, id)!;
  assert.deepEqual(Object.keys(fila).sort(), [...CLAVES_DE_LA_FILA].sort());
  assert.equal(fila.campana, 'Campaña X');
  assert.equal(fila.creativo, 'Pieza 3');
  assert.equal(fila.territorio, 'closer');
  assert.ok(!JSON.stringify(r).includes('203.0.113.9'), 'la IP de la atribución viajó en la respuesta');
  assert.ok(!JSON.stringify(r).includes('ejemplo.test'), 'el correo viajó en la respuesta');
});

test('un origen vacío llega como nulo, y un congelado se dice congelado', async () => {
  await limpiar();
  const id = await unContacto({ territorio: null, atribucion: { campaign: '  ', utmContent: '' } });

  const r = await leer();
  assert.equal(filaDe(r, id)?.campana, null, 'un origen vacío no puede llegar como texto: la tarjeta lo dibuja como si hubiera');
  assert.equal(filaDe(r, id)?.creativo, null);
  assert.equal(filaDe(r, id)?.territorio, 'congelado');
});
