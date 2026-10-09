// Las cuentas de los cinco pasos de Conversion, sin base. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE AFIRMA, Y LA MUTACIÓN QUE CADA COSA TIENE QUE PONER EN ROJO
//
// El front del prototipo (docs/conversion/15) dibuja lo que arma `armarPasos`: no calcula nada. Acá se prueba la
// mitad PURA —los huecos (CV15-13), la caída (CV15-16), las flechas (CV15-20), el formulario y su corte
// (CV15-14), los confirmados (CV15-18, `CV15-P10`) y el reparto de las señales (CV15-19)—. Lo que vive en el SQL
// —la ventana, la misma edad, las congeladas, las vistas de Meta— se prueba contra la base en
// `pruebas/base/246-pasos-de-conversion.test.ts`.
//
//   · VSL y Gracias son huecos: sin valor, sin caída, sin flecha — mutación: darles la cohorte;
//   · la caída se mide contra la cohorte, no contra la tarjeta de al lado — mutación: restar el paso anterior;
//   · las proporciones varían en puntos, con «=» bajo medio punto — mutación: ensanchar la banda del «=»;
//   · la porción por la landing se lee neutra, y compara sólo con las dos cohortes en el piso — mutaciones:
//     `mas_es_mejor`, y sacar el piso;
//   · la tasa de agenda compara sólo con las dos cohortes en el piso, y el conteo de agendados igual — mutación:
//     dividir la anterior sin el piso;
//   · las vistas comparan por su cuenta, aunque las personas no — mutación: atarlas a la comparación de personas;
//   · los cinco que nunca comparan no traen flecha — mutación: compararlos;
//   · con citas congeladas en la anterior, los agendados no comparan y el resto sí — mutación: ignorar la guarda;
//   · el formulario: con la ventana después del corte no hay valor; cruzándolo, la tasa es sobre la cohorte
//     hasta el corte — mutación: dividir por la cohorte entera;
//   · confirmados sobre los calificados, no sobre los que respondieron — mutación: dividir por `respondieron`;
//   · los agendados son la suma de las filas del reparto — mutación: tomarlos del conteo de personas;
//   · las señales van al paso de su entidad — mutación: mandar el formulario a Agenda.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  armarPasos,
  type EntradaDeLosPasos,
  pasoDeLaSenal,
  PASOS,
  type PersonasDeLaCohorte,
  variacionEnPuntos,
} from '../../lib/negocio/pasosDeConversion.ts';
import type { FilaDeRecorrido } from '../../lib/negocio/recorridoDelLead.ts';

const VENTANA = { desde: '2026-09-08', hasta: '2026-10-07' };
const ANTERIOR = { desde: '2026-08-09', hasta: '2026-09-07' };

function personas(p: Partial<PersonasDeLaCohorte>): PersonasDeLaCohorte {
  return {
    contactos: 0,
    agendados: 0,
    calificados: 0,
    respondieron: 0,
    confirmaron: 0,
    cancelaron: 0,
    hastaElCorte: 0,
    conCitasCongeladas: 0,
    ...p,
  };
}

/** Una fila del reparto con lo que importa acá, y su porción de la cohorte como la publica `recorridoDelLead`. */
function fila(familia: FilaDeRecorrido['familia'], contactos: number, agendaron: number, cohorte: number): FilaDeRecorrido {
  return { familia, titulo: familia, contactos, porcion: contactos / cohorte, agendaron, capturadaAlReservar: 0 };
}

/** Una cohorte de 100: 20 por la landing (10 agendaron), 80 por el widget (50 agendaron). */
function entrada(e: Partial<EntradaDeLosPasos> = {}): EntradaDeLosPasos {
  const filas = [fila('landing', 20, 10, 100), fila('widget', 80, 50, 100)];
  return {
    ventana: VENTANA,
    anterior: ANTERIOR,
    sinComparacion: null,
    actual: personas({ contactos: 100, agendados: 60, calificados: 40, respondieron: 20, confirmaron: 20, cancelaron: 8 }),
    previa: personas({ contactos: 200, agendados: 100, calificados: 70 }),
    recorrido: { filas, cohorte: 100, cobertura: { con: 90, sobre: 100 } },
    recorridoAnterior: { filas: [fila('landing', 60, 30, 200), fila('widget', 140, 70, 200)], cohorte: 200 },
    formulario: {
      cobertura: { con: 0, sobre: 100 },
      finalizacion: null,
      corte: { fecha: '2026-08-31', laVentanaLoCruza: false },
      campoDelFormulario: 'Form Landing VSL',
    },
    hayCampoDeConfirmacion: true,
    vistas: { actual: 462, anterior: null, motivo: 'dias_sin_leer' },
    sinAlta: null,
    ...e,
  };
}

const paso = (r: ReturnType<typeof armarPasos>, clave: string) => r.pasos.find((p) => p.clave === clave)!;

// ─── 1 · La forma ───────────────────────────────────────────────────────────

test('los cinco pasos llegan en el orden del prototipo', () => {
  assert.deepEqual(armarPasos(entrada()).pasos.map((p) => p.clave), [...PASOS]);
  assert.deepEqual([...PASOS], ['sesiones', 'vsl', 'form', 'agenda', 'gracias']);
});

test('VSL y Gracias son huecos: sin valor, sin caída, sin flecha y con sus dos métricas en «—»', () => {
  const r = armarPasos(entrada());
  for (const clave of ['vsl', 'gracias']) {
    const p = paso(r, clave);
    assert.equal(p.estado, 'hueco');
    assert.deepEqual([p.valor, p.tasa, p.variacion, p.caida], [null, null, null, null], `${clave} afirmó algo sin fuente`);
    assert.ok(p.metricas.every((m) => m.valor === null && m.variacion === null));
  }
});

test('la caída es contra la cohorte, no contra la tarjeta de al lado', () => {
  /* Los agendados no son un subconjunto de los que empezaron el formulario: el widget no pasa por él (CV2-13). */
  const r = armarPasos(entrada());
  assert.equal(paso(r, 'agenda').caida, 100 - 60, 'la caída de la Agenda no se midió contra la cohorte');
  assert.equal(paso(r, 'sesiones').caida, null, 'la Landing es la base: no tiene de dónde caer');
});

test('los agendados son la suma de las filas del reparto, no el conteo de personas', () => {
  // Si las dos sentencias vieran estados distintos, la tarjeta tiene que sumar lo que dice la tabla del cajón.
  const r = armarPasos(entrada({ actual: personas({ contactos: 100, agendados: 61, calificados: 40 }) }));
  assert.equal(r.cifras.agendados.valor, 60);
  assert.equal(paso(r, 'agenda').valor, 60);
  assert.equal(r.cifras.noCalificados.valor, 20);
});

// ─── 2 · Las flechas ────────────────────────────────────────────────────────

test('las proporciones varían en puntos, y bajo medio punto es «=»', () => {
  assert.deepEqual(variacionEnPuntos(0.6, 0.5, 'mas_es_mejor'), { tipo: 'sube', puntos: 0.6 - 0.5, lectura: 'buena' });
  assert.deepEqual(variacionEnPuntos(0.4, 0.5, 'mas_es_mejor'), { tipo: 'baja', puntos: 0.5 - 0.4, lectura: 'mala' });
  assert.deepEqual(variacionEnPuntos(0.504, 0.5, 'mas_es_mejor'), { tipo: 'igual' });
  assert.equal(variacionEnPuntos(0.506, 0.5, 'mas_es_mejor').tipo, 'sube', 'medio punto ya no es «=»');
  assert.deepEqual(variacionEnPuntos(null, 0.5, 'mas_es_mejor'), { tipo: 'sin_comparacion' });
  assert.deepEqual(variacionEnPuntos(0.5, null, 'mas_es_mejor'), { tipo: 'sin_comparacion' });
});

test('la tasa de agenda varía en puntos y el conteo de contactos en %', () => {
  const r = armarPasos(entrada());
  // 60 de 100 contra 100 de 200: diez puntos arriba.
  const agenda = paso(r, 'agenda').variacion;
  assert.ok(agenda && agenda.tipo === 'sube' && 'puntos' in agenda, 'la tasa de agenda no varió en puntos');
  assert.ok(Math.abs(agenda.puntos - 0.1) < 1e-9);
  const landing = paso(r, 'sesiones').variacion;
  assert.ok(landing && landing.tipo === 'baja' && 'porcentaje' in landing, 'los contactos no variaron en %');
  assert.equal(landing.porcentaje, 0.5);
});

test('la porción por la landing se lee neutra: que gane o pierda gente es un cambio de ruta', () => {
  const r = armarPasos(entrada());
  // 20 % contra 30 %: diez puntos abajo, sin color.
  const v = r.cifras.porLaLanding.variacion;
  assert.ok(v.tipo === 'baja' && Math.abs(v.puntos - 0.1) < 1e-9, 'la porción no varió diez puntos');
  assert.equal(v.lectura, 'neutra', 'la porción por la landing se pintó como buena o mala');
});

test('la porción compara sólo con las dos cohortes en el piso, y se publica igual', () => {
  /* Medido el 2026-10-08: 7 días cerrados con 12 contactos y 6 en la anterior. Contra seis, un contacto mueve la
     porción diecisiete puntos. */
  const anteriorChica = armarPasos(
    entrada({ recorridoAnterior: { filas: [fila('landing', 1, 0, 6), fila('widget', 5, 3, 6)], cohorte: 6 } }),
  );
  assert.deepEqual(anteriorChica.cifras.porLaLanding.variacion, { tipo: 'sin_comparacion' }, 'la porción comparó contra seis contactos');
  assert.equal(anteriorChica.cifras.porLaLanding.porcion, 0.2, 'la porción dejó de publicarse');
  const actualChica = armarPasos(
    entrada({ recorrido: { filas: [fila('landing', 2, 1, 9), fila('widget', 7, 4, 9)], cohorte: 9, cobertura: { con: 9, sobre: 9 } } }),
  );
  assert.deepEqual(actualChica.cifras.porLaLanding.variacion, { tipo: 'sin_comparacion' });
});

test('los que nunca comparan no traen flecha: formulario, calificados, no calificados, confirmados y cancelaron', () => {
  const r = armarPasos(entrada());
  assert.equal(paso(r, 'form').variacion, null);
  const agenda = paso(r, 'agenda');
  assert.ok(agenda.metricas.every((m) => m.variacion === null), 'calificados o confirmados trajeron flecha');
  assert.ok(!('variacion' in r.cifras.calificados) && !('variacion' in r.cifras.noCalificados));
  assert.ok(!('variacion' in r.cifras.confirmados) && !('variacion' in r.cifras.cancelaron));
  assert.ok(!('variacion' in r.cifras.formulario));
});

test('con citas congeladas en la anterior, sólo los agendados dejan de comparar', () => {
  const r = armarPasos(entrada({ previa: personas({ contactos: 200, agendados: 100, conCitasCongeladas: 3 }) }));
  assert.deepEqual(r.cifras.agendados.variacion, { tipo: 'sin_comparacion' }, 'los agendados compararon con congeladas');
  assert.deepEqual(r.cifras.agendados.variacionDeLaTasa, { tipo: 'sin_comparacion' });
  assert.equal(r.cifras.agendados.congeladasEnLaAnterior, true);
  assert.notEqual(r.cifras.contactos.variacion.tipo, 'sin_comparacion', 'las congeladas apagaron también los contactos');
});

test('sin comparación, nada compara y la anterior no viaja', () => {
  const r = armarPasos(entrada({ sinComparacion: 'periodo', previa: null, recorridoAnterior: null }));
  assert.equal(r.anterior, null);
  assert.deepEqual(r.cifras.contactos.variacion, { tipo: 'sin_comparacion' });
  assert.deepEqual(r.cifras.porLaLanding.variacion, { tipo: 'sin_comparacion' });
  assert.equal(r.cifras.agendados.congeladasEnLaAnterior, false);
});

test('la tasa de agenda compara sólo con las dos cohortes en el piso; el conteo de agendados, igual', () => {
  // Medido el 2026-10-08 en 7 días: 5 agendados de 6 en la anterior. La tasa no tiene con qué comparar; el conteo sí.
  const r = armarPasos(entrada({ previa: personas({ contactos: 6, agendados: 5 }) }));
  assert.deepEqual(r.cifras.agendados.variacionDeLaTasa, { tipo: 'sin_comparacion' }, 'la tasa de agenda comparó contra seis contactos');
  assert.deepEqual(paso(r, 'agenda').variacion, { tipo: 'sin_comparacion' });
  assert.equal(r.cifras.agendados.variacion.tipo, 'sube', 'el conteo de agendados dejó de comparar');
  // Y con la actual bajo el piso, tampoco.
  const chica = armarPasos(entrada({ recorrido: { filas: [fila('widget', 9, 5, 9)], cohorte: 9, cobertura: { con: 9, sobre: 9 } } }));
  assert.deepEqual(chica.cifras.agendados.variacionDeLaTasa, { tipo: 'sin_comparacion' });
});

test('las vistas comparan por su cuenta: aunque las personas no comparen, y nunca sin su anterior', () => {
  // Sin la lectura de contactos al día las personas no comparan; las vistas, que no son personas, sí.
  const r = armarPasos(entrada({ sinComparacion: 'faltan_contactos', previa: null, recorridoAnterior: null, vistas: { actual: 462, anterior: 2420, motivo: null } }));
  assert.equal(r.cifras.vistas.variacion.tipo, 'baja', 'las vistas se ataron a la comparación de las personas');
  assert.deepEqual(r.cifras.contactos.variacion, { tipo: 'sin_comparacion' });
});

test('las vistas comparan sólo si hay anterior de las vistas, y no llevan tasa', () => {
  const sin = armarPasos(entrada());
  assert.deepEqual(sin.cifras.vistas.variacion, { tipo: 'sin_comparacion' });
  assert.equal(sin.cifras.vistas.motivo, 'dias_sin_leer');
  const con = armarPasos(entrada({ vistas: { actual: 462, anterior: 2420, motivo: null } }));
  assert.equal(con.cifras.vistas.variacion.tipo, 'baja');
  const vistas = paso(con, 'sesiones').metricas[0];
  assert.deepEqual([vistas.clave, vistas.unidad, vistas.deMeta], ['vistas', 'conteo', true]);
});

// ─── 3 · El formulario y su corte ───────────────────────────────────────────

test('con la ventana después del corte, el formulario no tiene valor pero sí dice hasta cuándo hubo', () => {
  const p = paso(armarPasos(entrada()), 'form');
  assert.equal(p.estado, 'historico');
  assert.deepEqual([p.valor, p.tasa, p.caida], [null, null, null]);
  assert.equal(p.hastaElCorte, '2026-08-31');
});

test('cruzando el corte, la tasa del formulario es sobre la cohorte HASTA el corte, y la finalización va de 0 a 1', () => {
  /* La regla 2 del departamento: nunca mezclar las dos épocas. 30 de los 40 dados de alta hasta el corte lo
     empezaron; dividir por los 100 de la ventana mezclaría a 60 que no podían traer el campo. */
  const r = armarPasos(
    entrada({
      actual: personas({ contactos: 100, calificados: 40, hastaElCorte: 40 }),
      formulario: {
        cobertura: { con: 30, sobre: 100 },
        finalizacion: 64.8,
        corte: { fecha: '2026-08-31', laVentanaLoCruza: true },
        campoDelFormulario: 'Form Landing VSL',
      },
    }),
  );
  const p = paso(r, 'form');
  assert.equal(p.valor, 30);
  assert.equal(p.tasa, 30 / 40, 'la tasa del formulario mezcló las dos épocas');
  assert.equal(p.caida, 10);
  assert.equal(p.metricas[0].valor, 0.648, 'la finalización no se pasó de % a proporción');
});

test('sin el campo en el CRM, o sin ningún día escrito, el formulario es un hueco', () => {
  for (const formulario of [
    { cobertura: { con: 0, sobre: 100 }, finalizacion: null, corte: { fecha: null, laVentanaLoCruza: false }, campoDelFormulario: 'Form Landing VSL' },
    { cobertura: { con: 0, sobre: 100 }, finalizacion: null, corte: { fecha: '2026-08-31', laVentanaLoCruza: true }, campoDelFormulario: null },
  ]) {
    const p = paso(armarPasos(entrada({ formulario })), 'form');
    assert.equal(p.estado, 'hueco');
    assert.equal(p.valor, null);
    assert.equal(p.hastaElCorte, null);
  }
});

// ─── 4 · La Agenda ──────────────────────────────────────────────────────────

test('confirmados sobre los calificados, no sobre los que respondieron', () => {
  /* Con 20 de 20 que respondieron, «100 % confirmó» diría que todos los calificados confirmaron, y la mitad no
     respondió (`CV15-P10`, medido el 2026-10-08). */
  const r = armarPasos(entrada());
  assert.equal(r.cifras.confirmados.tasa, 20 / 40, 'los confirmados se midieron sobre los que respondieron');
  assert.equal(r.cifras.confirmados.respondieron, 20);
  assert.equal(paso(r, 'agenda').metricas[1].valor, 20 / 40);
  // Sin el campo en el CRM, «—»: no es que nadie haya confirmado.
  const sinCampo = armarPasos(entrada({ hayCampoDeConfirmacion: false }));
  assert.deepEqual(sinCampo.cifras.confirmados, { valor: null, respondieron: null, tasa: null });
});

test('los calificados y los que cancelaron se miden sobre los agendados y los calificados, con el piso', () => {
  const r = armarPasos(entrada());
  assert.equal(r.cifras.calificados.tasa, 40 / 60);
  assert.equal(r.cifras.calificados.deLaCohorte, 40 / 100);
  assert.equal(r.cifras.cancelaron.tasa, 8 / 40);
  // Bajo el piso del denominador, «—».
  const chica = armarPasos(entrada({ recorrido: { filas: [fila('widget', 9, 5, 9)], cohorte: 9, cobertura: { con: 9, sobre: 9 } } }));
  assert.equal(chica.cifras.agendados.tasa, null, 'publicó una tasa de agenda sobre nueve contactos');
  // Cinco agendados: ni la tasa de calificación ni la de cancelación tienen con qué publicarse.
  assert.equal(chica.cifras.calificados.tasa, null, 'publicó la tasa de calificación sobre cinco agendados');
  assert.equal(chica.cifras.cancelaron.tasa, null, 'publicó la tasa de cancelación sobre cinco calificados');
});

// ─── 5 · Las señales ────────────────────────────────────────────────────────

test('las señales van al paso de su entidad', () => {
  assert.equal(pasoDeLaSenal({ tipo: 'familia_de_entrada', id: 'widget' }), 'sesiones');
  assert.equal(pasoDeLaSenal({ tipo: 'funnel', id: 'formulario' }), 'form');
  assert.equal(pasoDeLaSenal({ tipo: 'funnel', id: 'leadform' }), null);
  assert.equal(pasoDeLaSenal({ tipo: 'campana', id: '123' }), null);
});
