// EL DETECTOR DE ACQUISITION ES PURO, Y CADA REGLA RESPETA SU PISO. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/detectores/acquisition.ts` (AG9 de los agentes; `docs/OTROS/agentes/fichas/F03-ACQUISITION.md`),
// sobre embudos armados con la misma función pura de la pantalla (`armarEmbudos`):
//
//   · debajo del piso de 10 no hay señal: se cuenta (A6-02);
//   · la entidad es un identificador, nunca un nombre (A6-05), y la fila sin funnel no compite (A6-04);
//   · lo de presupuesto —la concentración y la escala— va sólo a validación ejecutiva (A6-22);
//   · lo que la pantalla no puede medir —un día sin cerrar, el gasto incompleto— no se publica: va a
//     «sin medición» (AG-35, la falsa «sin entrega» de cada mañana);
//   · «sin entrega» es un estado: crítica si ninguna campaña activa entrega, alta por campaña si alguna sí, y
//     una pausada no cuenta.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { ACQ, detectarEnAcquisition, type MedidaDeAcquisition } from '../../lib/agentes/detectores/acquisition.ts';
import { CATALOGO_DE_REGLAS, umbralVigente } from '../../lib/agentes/senales/umbrales.ts';
import {
  armarEmbudos,
  CIFRAS_VACIAS,
  type CampanaConocida,
  type Cifras,
  type SinComparacion,
  type SinCostos,
} from '../../lib/negocio/embudosDeAcquisition.ts';

const cifras = (c: Partial<Cifras>): Cifras => ({ ...CIFRAS_VACIAS, ...c });
const campana = (id: string, funnel: CampanaConocida['funnel'], estado = 'ACTIVE'): CampanaConocida => ({
  campana: id,
  nombre: `Nombre visible ${id}`,
  estado,
  conocida: true,
  funnel,
});

function medida(e: {
  campanas: CampanaConocida[];
  actual: [string, Partial<Cifras>][];
  previa?: [string, Partial<Cifras>][] | null;
  entrega?: [string, number][];
  sinComparacion?: SinComparacion | null;
  sinCostos?: SinCostos | null;
}): MedidaDeAcquisition {
  const actual = new Map(e.actual.map(([id, c]) => [id, cifras(c)]));
  const previa = e.previa === null ? null : new Map((e.previa ?? []).map(([id, c]) => [id, cifras(c)]));
  const embudos = armarEmbudos({
    ventana: { desde: '2026-09-05', hasta: '2026-10-04' },
    anterior: previa ? { desde: '2026-08-06', hasta: '2026-09-04' } : null,
    sinComparacion: e.sinComparacion ?? (previa ? null : 'sin_historia'),
    campanas: e.campanas,
    actual,
    previa,
    cobertura: { conCampana: 0, sobre: 0 },
    sinCostos: e.sinCostos ?? null,
  });
  return {
    ventana: '30d',
    embudos,
    actual,
    previa,
    entrega: new Map((e.entrega ?? []).map(([id, dias]) => [id, { diasSinEntregar: dias, ultimaEntrega: '2026-09-19' }])),
  };
}

const umbral = (codigo: string) => umbralVigente(CATALOGO_DE_REGLAS.find((r) => r.codigo === codigo)!, new Map());
const detectar = (m: MedidaDeAcquisition) => detectarEnAcquisition(m, umbral);
const de = (r: ReturnType<typeof detectar>, regla: string) => r.detecciones.filter((d) => d.regla === regla);

test('el costo por contacto: +30 % es media, desde +60 % alta, y debajo de 10 contactos se cuenta', () => {
  const r = detectar(
    medida({
      campanas: [campana('1', 'leadform'), campana('2', 'leadform'), campana('3', 'leadform')],
      // 1: de 50 a 65 por contacto (+30 %). 2: de 50 a 80 (+60 %). 3: +60 %, con 9 contactos ahora.
      actual: [['1', { inversion: 650, contactos: 10 }], ['2', { inversion: 800, contactos: 10 }], ['3', { inversion: 720, contactos: 9 }]],
      previa: [['1', { inversion: 500, contactos: 10 }], ['2', { inversion: 500, contactos: 10 }], ['3', { inversion: 500, contactos: 10 }]],
    }),
  );
  assert.deepEqual(de(r, ACQ.cplSostenido).map((d) => [d.entidad.id, d.gravedad, d.muestra, d.lineaBase, d.valorActual]), [
    ['1', 'media', 10, 50, 65],
    ['2', 'alta', 10, 50, 80],
  ]);
  assert.deepEqual(r.debajoDelPiso, [{ regla: ACQ.cplSostenido, entidad: { tipo: 'campana', id: '3' }, muestra: 9 }]);
  // Los contactos que la inversión de hoy habría traído al costo de antes: 800 / 50 - 10.
  assert.equal(de(r, ACQ.cplSostenido)[1]!.perdidaContactos, 6);
});

test('la entidad es un identificador, nunca un nombre; la campaña sin funnel no compite por el ICP', () => {
  const r = detectar(
    medida({
      campanas: [campana('10', 'booking'), campana('11', 'booking'), campana('12', null)],
      actual: [
        // 10: ICP 40 sobre 10 puntajes; 11: ICP 80; el funnel queda en 60, y 10 está 20 puntos abajo.
        ['10', { inversion: 100, contactos: 20, agendados: 12, calificados: 10, conPuntaje: 10, sumaDePuntajes: 400 }],
        ['11', { inversion: 100, contactos: 20, agendados: 12, calificados: 10, conPuntaje: 10, sumaDePuntajes: 800 }],
        // 12, sin funnel y con el peor ICP: no se compara con nadie.
        ['12', { inversion: 100, contactos: 20, agendados: 12, calificados: 10, conPuntaje: 10, sumaDePuntajes: 100 }],
      ],
      previa: [],
    }),
  );
  assert.deepEqual(de(r, ACQ.icpEntreCampanas).map((d) => [d.entidad, d.lineaBase, d.valorActual]), [[{ tipo: 'campana', id: '10' }, 60, 40]]);
  assert.doesNotMatch(JSON.stringify(r), /Nombre visible/, 'un nombre de campaña viajó en una detección');
});

test('lo de presupuesto va sólo a validación ejecutiva', () => {
  const r = detectar(
    medida({
      campanas: [campana('20', 'leadform'), campana('21', 'booking'), campana('22', 'profile')],
      actual: [
        // 20 se lleva el 70 % del gasto, con calificados a 7 contra 10 de la empresa (0,7).
        ['20', { inversion: 700, contactos: 100, agendados: 100, calificados: 100 }],
        ['21', { inversion: 200, contactos: 10, agendados: 10, calificados: 0 }],
        ['22', { inversion: 100, contactos: 10, agendados: 10, calificados: 0 }],
      ],
      previa: [],
    }),
  );
  const presupuesto = r.detecciones.filter((d) => d.regla === ACQ.concentracion || d.regla === ACQ.escalaPorCalificado);
  assert.deepEqual(presupuesto.map((d) => [d.regla, d.entidad.id]).sort(), [[ACQ.concentracion, '20'], [ACQ.escalaPorCalificado, '20']]);
  assert.ok(presupuesto.every((d) => d.requiereValidacionEjecutiva), 'una regla de presupuesto no pide validación ejecutiva');
  assert.ok(
    r.detecciones.filter((d) => !presupuesto.includes(d)).every((d) => !d.requiereValidacionEjecutiva),
    'una regla que no es de presupuesto pide validación ejecutiva',
  );
});

test('lo que la pantalla no puede medir no se publica: va a «sin medición»', () => {
  const base = {
    campanas: [campana('30', 'leadform')],
    actual: [['30', { inversion: 0, contactos: 10 }]] as [string, Partial<Cifras>][],
    previa: [['30', { inversion: 500, contactos: 10 }]] as [string, Partial<Cifras>][],
    entrega: [['30', 15]] as [string, number][],
  };
  // Un día sin cerrar: ni «sin entrega» ni nada que compare el gasto.
  const sinCerrar = detectar(medida({ ...base, sinComparacion: 'faltan_dias', sinCostos: 'gasto_incompleto' }));
  assert.deepEqual(sinCerrar.detecciones, []);
  assert.deepEqual(
    [...sinCerrar.sinMedicion].sort(),
    [ACQ.concentracion, ACQ.cplSostenido, ACQ.escalaPorCalificado, ACQ.gastoSinCrecimiento, ACQ.sinEntrega].sort(),
  );
  // Con los días cerrados al día, la misma campaña parada sí es una señal.
  assert.deepEqual(de(detectar(medida(base)), ACQ.sinEntrega).map((d) => [d.entidad.tipo, d.gravedad]), [['empresa', 'critica']]);
});

test('«sin entrega»: crítica si no entrega ninguna activa, alta por campaña si alguna sí; la pausada no cuenta', () => {
  const campanas = [campana('40', 'leadform'), campana('41', 'leadform'), campana('42', 'leadform', 'PAUSED')];
  const actual: [string, Partial<Cifras>][] = [];
  // 40 lleva 3 días sin entregar, 41 entregó ayer, 42 está pausada: una alta, para 40.
  const parcial = detectar(medida({ campanas, actual, previa: [], entrega: [['40', 3], ['41', 0], ['42', 15]] }));
  assert.deepEqual(de(parcial, ACQ.sinEntrega).map((d) => [d.entidad.id, d.gravedad, d.valorActual]), [['40', 'alta', 3]]);
  // Las dos activas paradas: una sola crítica, de la empresa, aunque la pausada también esté parada.
  const todas = detectar(medida({ campanas, actual, previa: [], entrega: [['40', 3], ['41', 2], ['42', 15]] }));
  assert.deepEqual(de(todas, ACQ.sinEntrega).map((d) => [d.entidad.id, d.gravedad, d.valorActual]), [['empresa', 'critica', 2]]);
  // Un solo día sin entregar todavía no es una señal.
  assert.deepEqual(de(detectar(medida({ campanas, actual, previa: [], entrega: [['40', 1], ['41', 0]] })), ACQ.sinEntrega), []);
});

test('la fuga entre contacto y agendado se mide contra los otros funnels, con su pérdida en personas', () => {
  const campanas = [campana('50', 'leadform'), campana('51', 'booking'), campana('52', 'profile')];
  const r = detectar(
    medida({
      campanas,
      actual: [
        ['50', { contactos: 20, agendados: 12 }],
        ['51', { contactos: 20, agendados: 11 }],
        ['52', { contactos: 19, agendados: 0 }],
      ],
      previa: [],
    }),
  );
  // Los otros: 23 de 40 (57,5 %). Profile: 0 de 19. Habrían agendado 11.
  assert.deepEqual(de(r, ACQ.fugaEntreEtapas).map((d) => [d.entidad.id, d.muestra, d.perdidaContactos]), [['profile:contactos>agendados', 19, 11]]);
  const chico = detectar(medida({ campanas, actual: [['50', { contactos: 20, agendados: 12 }], ['51', { contactos: 20, agendados: 11 }], ['52', { contactos: 9, agendados: 0 }]], previa: [] }));
  assert.deepEqual(de(chico, ACQ.fugaEntreEtapas), []);
  assert.deepEqual(chico.debajoDelPiso.map((x) => [x.regla, x.muestra]), [[ACQ.fugaEntreEtapas, 9]]);
});
