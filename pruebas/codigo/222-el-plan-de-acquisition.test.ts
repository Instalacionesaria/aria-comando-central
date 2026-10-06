// EL PLAN DE ACCIÓN DE ACQUISITION: SUS GRUPOS EN ORDEN, SU VENTANA Y SUS FRASES. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/plan/acquisition.ts` (AG9 de los agentes; `docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md`,
// A6-06, A6-07, A6-11, A6-17, A6-22 y A6-23):
//
//   · los cuatro grupos en su orden, y «Requiere validación ejecutiva» aparte, también vacíos;
//   · lo de presupuesto va a validación ejecutiva y a ningún otro grupo;
//   · el plan dice sobre qué ventana se calculó, cuánto quedó bajo el piso y qué no se pudo medir;
//   · dentro de un grupo, primero lo que más gente pierde; lo que no tiene pérdida, después;
//   · cada frase lleva la métrica, el valor y la base, con el verbo de un período o de una entidad.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { armarPlanDeAcquisition, GRUPOS_DEL_PLAN_DE_ACQUISITION, paraUnaPersona } from '../../lib/agentes/plan/acquisition.ts';
import { ACQ } from '../../lib/agentes/detectores/acquisition.ts';
import type { Deteccion } from '../../lib/agentes/senales/tipos.ts';

function deteccion(regla: string, id: string, cambios: Partial<Deteccion> = {}): Deteccion {
  return {
    regla,
    entidad: { tipo: 'campana', id },
    metrica: 'x',
    lineaBase: 50,
    valorActual: 70,
    cambioPct: 0.4,
    muestra: 14,
    periodo: { desde: '2026-09-05', hasta: '2026-10-04' },
    datosDesde: null,
    gravedad: 'media',
    causasPosibles: [],
    revisionRecomendada: 'Revisa.',
    perdidaContactos: null,
    destino: null,
    requiereValidacionEjecutiva: false,
    umbral: { valor: 0.3, provisional: true },
    evidencia: {},
    ...cambios,
  };
}

const plan = (vigentes: Deteccion[], extra: { sinMedicion?: string[]; debajo?: number } = {}) =>
  armarPlanDeAcquisition({
    ventana: '30d',
    dia: '2026-10-05',
    periodo: { desde: '2026-09-05', hasta: '2026-10-04' },
    detecciones: vigentes,
    vigentes,
    sinMedicion: extra.sinMedicion ?? [],
    debajoDelPiso: Array.from({ length: extra.debajo ?? 0 }, (_, i) => ({ regla: ACQ.cplSostenido, entidad: { tipo: 'campana' as const, id: `b${i}` }, muestra: 5 })),
  });

test('los cuatro grupos en orden y la validación ejecutiva aparte, también vacíos', () => {
  const p = plan([]);
  assert.deepEqual(
    p.grupos.map((g) => g.titulo),
    ['Lo que dice la data', 'Ajusta o pausa esto', 'Haz más de esto', 'Para otras áreas', 'Requiere validación ejecutiva'],
  );
  assert.deepEqual(GRUPOS_DEL_PLAN_DE_ACQUISITION.map((g) => g.clave), p.grupos.map((g) => g.clave));
  assert.ok(p.grupos.every((g) => g.renglones.length === 0));
});

test('lo de presupuesto va a validación ejecutiva, y a ningún otro grupo', () => {
  const p = plan([
    deteccion(ACQ.concentracion, '1', { requiereValidacionEjecutiva: true, valorActual: 0.67, evidencia: { campanas: [1, 2, 3] } }),
    deteccion(ACQ.escalaPorCalificado, '2', { requiereValidacionEjecutiva: true, gravedad: 'info', cambioPct: -0.3 }),
    deteccion(ACQ.cplSostenido, '3'),
  ]);
  const donde = Object.fromEntries(p.grupos.flatMap((g) => g.renglones.map((r) => [r.regla, g.clave])));
  assert.deepEqual(donde, { [ACQ.concentracion]: 'validacion', [ACQ.escalaPorCalificado]: 'validacion', [ACQ.cplSostenido]: 'ajusta' });
});

test('el plan dice su ventana, lo que quedó bajo el piso y lo que no se pudo medir', () => {
  const p = plan([], { sinMedicion: [ACQ.sinEntrega], debajo: 2 });
  assert.deepEqual([p.ventana, p.periodo], ['30d', { desde: '2026-09-05', hasta: '2026-10-04' }]);
  assert.equal(p.debajoDelPiso, 2);
  assert.deepEqual(p.sinMedicion, ['si alguna campaña dejó de entregar: falta algún día cerrado de los anuncios']);
});

test('dentro de un grupo, primero lo que más gente pierde; sin pérdida, después', () => {
  const p = plan([
    deteccion(ACQ.cplSostenido, 'sin-perdida', { gravedad: 'alta' }),
    deteccion(ACQ.cplSostenido, 'pierde-4', { perdidaContactos: 4 }),
    deteccion(ACQ.cplSostenido, 'pierde-9', { perdidaContactos: 9 }),
  ]);
  assert.deepEqual(p.grupos.find((g) => g.clave === 'ajusta')!.renglones.map((r) => r.entidad.id), ['pierde-9', 'pierde-4', 'sin-perdida']);
});

test('cada frase lleva la métrica, el valor y la base, con el verbo de un período o de una entidad', () => {
  const p = plan([
    deteccion(ACQ.cplSostenido, '1', { lineaBase: 50, valorActual: 70, cambioPct: 0.4, muestra: 14 }),
    deteccion(ACQ.icpEntreCampanas, '2', { lineaBase: 60, valorActual: 40, muestra: 10 }),
  ]);
  const textos = p.grupos.flatMap((g) => g.renglones.map((r) => r.texto));
  // Entre períodos: «subió … contra los 30 días anteriores».
  assert.ok(textos.includes('El costo por contacto subió 40 % contra los 30 días anteriores: de 50 a 70, sobre 14 contactos.'), textos.join('\n'));
  // Entre entidades: «está … por debajo de».
  assert.ok(textos.includes('Su ICP promedio está 20 puntos por debajo del de su funnel: 40 contra 60, sobre 10 calificados con puntaje.'), textos.join('\n'));
});

test('la consecuencia del monitor llega sin acentos graves ni citas a secciones', () => {
  /* La primera evaluación real de la redacción dejó pasar «el § 18.12» tal cual: es una referencia de la
     arquitectura de producto, no algo que quien decide la pauta pueda leer. */
  assert.equal(
    paraUnaPersona('`utmCampaign` no llega en NINGUNA: un enlace que manda algunas UTM pierde el corte por creativo, que es el que el § 18.12 necesita.'),
    'utmCampaign no llega en NINGUNA: un enlace que manda algunas UTM pierde el corte por creativo.',
  );
  assert.equal(
    paraUnaPersona('el costo por venta por anuncio no se puede calcular con esta cobertura. Y el § 18.6 ya dice que ese cálculo es de Business Intelligence, no de acá.'),
    'el costo por venta por anuncio no se puede calcular con esta cobertura.',
  );
  assert.equal(paraUnaPersona('Sin nada que limpiar.'), 'Sin nada que limpiar.');
});

test('cada renglón lleva las hipótesis de su regla, para que la redacción no invente otras', () => {
  const p = plan([deteccion(ACQ.cplSostenido, '1', { causasPosibles: ['puede deberse a la fatiga del creativo'] })]);
  assert.deepEqual(p.grupos.find((g) => g.clave === 'ajusta')!.renglones[0]!.causas, ['puede deberse a la fatiga del creativo']);
});
