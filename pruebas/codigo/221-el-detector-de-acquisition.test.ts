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
//     una pausada no cuenta;
//   · el costo por mil con su piso de mil impresiones; el conjunto sólo en 7 días, nombrando el cambio más
//     grande; y el monitor de atribución, con su cobertura bajo 0,9 y su denominador.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { ACQ, detectarEnAcquisition, type MedidaDeAcquisition } from '../../lib/agentes/detectores/acquisition.ts';
import type { PuntoDeAtribucion } from '../../lib/negocio/calidadDeLaAtribucion.ts';
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
  ventana?: '7d' | '30d';
  impresiones?: [string, { gasto: number; impresiones: number; gastoAntes: number; impresionesAntes: number }][];
  conjuntos?: [string, { gasto: number; contactos: number; gastoAntes: number; contactosAntes: number }][];
  /** Los puntos del monitor. Por omisión, todos con la cobertura entera: no publican nada. */
  puntos?: Partial<Record<PuntoDeAtribucion['clave'], [number, number]>>;
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
  const claves: PuntoDeAtribucion['clave'][] = ['leads_con_anuncio', 'citas_con_anuncio', 'ventas_con_anuncio', 'utm_incompletas', 'sin_campana'];
  return {
    ventana: e.ventana ?? '30d',
    embudos,
    actual,
    previa,
    entrega: new Map((e.entrega ?? []).map(([id, dias]) => [id, { diasSinEntregar: dias, ultimaEntrega: '2026-09-19' }])),
    impresiones: previa ? new Map(e.impresiones ?? []) : null,
    conjuntos: previa && (e.ventana ?? '30d') === '7d' ? new Map(e.conjuntos ?? []) : null,
    atribucion: {
      dias: 30,
      puntos: claves.map((clave) => {
        // UTM cuenta lo roto: por omisión, ninguna incompleta.
        const [cuantos, sobre] = e.puntos?.[clave] ?? (clave === 'utm_incompletas' ? [0, 100] : [100, 100]);
        return { clave, titulo: `Título de ${clave}`, cuantos, sobre, proporcion: null, consecuencia: `consecuencia de ${clave}` };
      }),
      fueraDeAlcance: [],
      aviso: null,
    },
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
    [ACQ.concentracion, ACQ.cplSostenido, ACQ.cpmAbrupto, ACQ.escalaPorCalificado, ACQ.gastoSinCrecimiento, ACQ.sinEntrega].sort(),
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

test('el costo por mil sube contra la anterior, con su piso de mil impresiones', () => {
  const r = detectar(
    medida({
      campanas: [campana('60', 'leadform'), campana('61', 'leadform')],
      actual: [],
      previa: [],
      impresiones: [
        // 60: de 10 a 15 por mil (+50 %), sobre 2.000 impresiones. 61: igual, sobre 900.
        ['60', { gasto: 30, impresiones: 2000, gastoAntes: 20, impresionesAntes: 2000 }],
        ['61', { gasto: 13.5, impresiones: 900, gastoAntes: 9, impresionesAntes: 900 }],
      ],
    }),
  );
  assert.deepEqual(de(r, ACQ.cpmAbrupto).map((d) => [d.entidad.id, d.lineaBase, d.valorActual, d.muestra]), [['60', 10, 15, 2000]]);
  assert.deepEqual(r.debajoDelPiso.map((x) => [x.regla, x.entidad.id, x.muestra]), [[ACQ.cpmAbrupto, '61', 900]]);
});

test('el conjunto se mira sólo en 7 días, y se nombra el cambio más grande', () => {
  const conjuntos: [string, { gasto: number; contactos: number; gastoAntes: number; contactosAntes: number }][] = [
    // 70: el gasto sube 60 % y el costo por contacto baja 20 %: manda el gasto.
    ['70', { gasto: 160, contactos: 20, gastoAntes: 100, contactosAntes: 10 }],
    // 71: el gasto igual y el costo por contacto se duplica (+100 %): manda el costo.
    ['71', { gasto: 100, contactos: 10, gastoAntes: 100, contactosAntes: 20 }],
    // 72: el gasto se triplica, con 9 contactos: bajo el piso.
    ['72', { gasto: 300, contactos: 9, gastoAntes: 100, contactosAntes: 10 }],
  ];
  const r = detectar(medida({ ventana: '7d', campanas: [], actual: [], previa: [], conjuntos }));
  assert.deepEqual(de(r, ACQ.cambioBruscoConjunto).map((d) => [d.entidad.id, d.metrica, d.cambioPct]), [
    ['70', 'inversion', 0.6],
    ['71', 'costo_por_contacto', 1],
  ]);
  assert.deepEqual(r.debajoDelPiso.map((x) => [x.entidad.id, x.muestra]), [['72', 9]]);
  // En 30 días la regla no se mira: ni señales ni «sin medición».
  const en30 = detectar(medida({ campanas: [], actual: [], previa: [], conjuntos }));
  assert.deepEqual(de(en30, ACQ.cambioBruscoConjunto), []);
  assert.ok(!en30.sinMedicion.includes(ACQ.cambioBruscoConjunto));
});

test('el monitor publica la cobertura bajo 0,9 con su denominador; sin denominador, no se mide', () => {
  const r = detectar(
    medida({
      campanas: [],
      actual: [],
      previa: [],
      puntos: {
        leads_con_anuncio: [80, 100], // 0,8: señal.
        citas_con_anuncio: [5, 9], // bajo el piso.
        ventas_con_anuncio: [0, 0], // ninguna venta: no se mide.
        utm_incompletas: [20, 100], // 20 rotas de 100: cobertura 0,8, señal.
        sin_campana: [95, 100], // 0,95: nada.
      },
    }),
  );
  assert.deepEqual(
    r.detecciones.filter((d) => d.regla.startsWith('ACQ-ATRIBUCION')).map((d) => [d.regla, d.entidad.tipo, d.valorActual, d.muestra]),
    [[ACQ.atribucionContactos, 'empresa', 0.8, 100], [ACQ.atribucionUtm, 'empresa', 0.8, 100]],
  );
  assert.deepEqual(r.debajoDelPiso.map((x) => [x.regla, x.muestra]), [[ACQ.atribucionCitas, 9]]);
  assert.ok(r.sinMedicion.includes(ACQ.atribucionVentas));
});
