// LOS DETECTORES DEL GASTO, POR CLIENTE: LO DE UNA CUENTA PUBLICITARIA SE MIDE DENTRO DE SU CLIENTE. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C5, frente G3)
//
// `lib/agentes/detectores/acquisition.ts`, puro, con la medición armada a mano (`pruebas/apoyo/medida-de-acquisition.ts`,
// la misma de la 221). Cada cliente tiene su cuenta publicitaria; con `clienteDe` lleno:
//
//   · «sin entrega» es crítica del cliente cuyas campañas no entregan, aunque las de otro sí; alta por campaña si a SU
//     cliente le queda alguna — mutación: ignorar el cliente;
//   · los dos frenos: el de Meta apaga «sin entrega», la concentración y el costo por mil; el de los costos, lo que
//     divide el gasto por la gente — mutaciones: el freno de los costos en esas tres;
//   · la concentración es sobre el gasto de su cliente — mutación: el total de la empresa;
//   · la escala, contra el costo por calificado de su cliente — mutación: el de la empresa;
//   · el gasto sin crecimiento agregado es el de cada cliente — mutación: el de la empresa;
//   · las frases del plan nombran al cliente, y sin él son las de siempre, letra por letra;
//   · la Reunión dice qué cliente dejó de entregar — mutación: sin los clientes;
//   · la fila de la campaña en la pantalla dice su cliente cuando llega — mutación: no nombrarlo.
//
// Con `clienteDe` vacío —un solo cliente— cada regla da lo de siempre: lo mira la 221 con sus mismas aserciones.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACQ, detectarEnAcquisition, type MedidaDeAcquisition } from '../../lib/agentes/detectores/acquisition.ts';
import { CATALOGO_DE_REGLAS, umbralVigente } from '../../lib/agentes/senales/umbrales.ts';
import { textoDe } from '../../lib/agentes/plan/acquisition.ts';
import { temasDeLaReunion, type MedidaDeLaReunion } from '../../lib/agentes/reunion/temas.ts';
import type { Deteccion } from '../../lib/agentes/senales/tipos.ts';
import type { Cifras } from '../../lib/negocio/embudosDeAcquisition.ts';
import { campana, medida } from '../apoyo/medida-de-acquisition.ts';
import { RAIZ } from '../apoyo/fuente.ts';

const umbral = (codigo: string) => umbralVigente(CATALOGO_DE_REGLAS.find((r) => r.codigo === codigo)!, new Map());
const detectar = (m: MedidaDeAcquisition) => detectarEnAcquisition(m, umbral);
const de = (r: ReturnType<typeof detectar>, regla: string) => r.detecciones.filter((d) => d.regla === regla);
const entidades = (ds: Deteccion[]) => ds.map((d) => [d.entidad.tipo, d.entidad.id, d.gravedad, d.valorActual]);

test('«sin entrega»: crítica del cliente que no entrega, alta por campaña si a SU cliente le queda alguna', () => {
  const campanas = [campana('40', 'leadform'), campana('41', 'leadform'), campana('50', 'leadform'), campana('51', 'leadform')];
  const clienteDe: [string, string][] = [['40', 'X'], ['41', 'X'], ['50', 'Y'], ['51', 'Y']];
  // X no entrega en ninguna de las suyas; Y entrega en todas: una crítica de X, aunque la empresa sí entregue.
  const deX = detectar(medida({ campanas, actual: [], previa: [], clienteDe, entrega: [['40', 3], ['41', 2], ['50', 0], ['51', 0]] }));
  assert.deepEqual(entidades(de(deX, ACQ.sinEntrega)), [['cliente', 'X', 'critica', 2]], 'la cuenta de X entera no entrega: es una crítica de X');
  // Los dos parados: una crítica por cuenta publicitaria, y ninguna de la empresa.
  const losDos = detectar(medida({ campanas, actual: [], previa: [], clienteDe, entrega: [['40', 3], ['41', 2], ['50', 5], ['51', 4]] }));
  assert.deepEqual(entidades(de(losDos, ACQ.sinEntrega)), [
    ['cliente', 'X', 'critica', 2],
    ['cliente', 'Y', 'critica', 4],
  ]);
  // A X le queda una entregando: la alta es de su campaña; Y, entero parado, crítica.
  const mezcla = detectar(medida({ campanas, actual: [], previa: [], clienteDe, entrega: [['40', 3], ['41', 0], ['50', 5], ['51', 4]] }));
  assert.deepEqual(entidades(de(mezcla, ACQ.sinEntrega)), [
    ['campana', '40', 'alta', 3],
    ['cliente', 'Y', 'critica', 4],
  ]);
  // Con un solo cliente, la de siempre: de la empresa.
  const uno = detectar(medida({ campanas, actual: [], previa: [], entrega: [['40', 3], ['41', 2], ['50', 5], ['51', 4]] }));
  assert.deepEqual(entidades(de(uno, ACQ.sinEntrega)), [['empresa', 'empresa', 'critica', 2]]);
});

test('los dos frenos: un cliente sin Meta frena los costos, no lo que sólo lee Meta', () => {
  const base = {
    campanas: [campana('60', 'leadform'), campana('61', 'leadform'), campana('62', 'leadform')],
    actual: [['60', { inversion: 700, contactos: 10, calificados: 10 }], ['61', { inversion: 200 }], ['62', { inversion: 100 }]] as [string, Partial<Cifras>][],
    previa: [] as [string, Partial<Cifras>][],
    entrega: [['60', 4]] as [string, number][],
    impresiones: [['60', { gasto: 30, impresiones: 2000, gastoAntes: 20, impresionesAntes: 2000 }]] as [string, { gasto: number; impresiones: number; gastoAntes: number; impresionesAntes: number }][],
    // La pantalla no compara ni publica costos: a un cliente le falta su gasto.
    sinComparacion: 'faltan_dias' as const,
    sinCostos: 'gasto_incompleto' as const,
  };
  const sinMeta = detectar(medida({ ...base, faltanDiasDeMeta: false }));
  for (const regla of [ACQ.sinEntrega, ACQ.concentracion, ACQ.cpmAbrupto]) {
    assert.ok(!sinMeta.sinMedicion.includes(regla), `${regla} quedó sin medición por un cliente sin Meta`);
    assert.equal(de(sinMeta, regla).length, 1, `${regla} no se midió`);
  }
  for (const regla of [ACQ.cplSostenido, ACQ.gastoSinCrecimiento, ACQ.escalaPorCalificado]) {
    assert.ok(sinMeta.sinMedicion.includes(regla), `${regla} se midió sin el gasto de un cliente`);
  }
  // Con días de Meta sin leer, las tres se frenan también.
  const sinDias = detectar(medida({ ...base, faltanDiasDeMeta: true }));
  for (const regla of [ACQ.sinEntrega, ACQ.concentracion, ACQ.cpmAbrupto]) assert.ok(sinDias.sinMedicion.includes(regla), regla);
});

test('la concentración es sobre el gasto de SU cliente', () => {
  const campanas = ['1', '2', '3', '4'].map((c) => campana(c, 'leadform'));
  const actual: [string, { inversion: number }][] = [['1', { inversion: 3000 }], ['2', { inversion: 700 }], ['3', { inversion: 200 }], ['4', { inversion: 100 }]];
  const porCliente = de(detectar(medida({ campanas, actual, previa: [], clienteDe: [['1', 'X'], ['2', 'Y'], ['3', 'Y'], ['4', 'Y']] })), ACQ.concentracion);
  assert.deepEqual(porCliente.map((d) => [d.entidad.id, d.valorActual]), [['2', 0.7]], 'la única campaña de X «concentró» el gasto de la empresa');
  const ev = porCliente[0]!.evidencia as { cliente?: string; total: number; campanas: unknown[] };
  assert.deepEqual([ev.cliente, ev.total, ev.campanas.length], ['Y', 1000, 3]);

  const empresa = de(detectar(medida({ campanas, actual, previa: [] })), ACQ.concentracion);
  assert.deepEqual(empresa.map((d) => [d.entidad.id, d.valorActual]), [['1', 0.75]]);
  assert.ok(!('cliente' in (empresa[0]!.evidencia as object)), 'con un solo cliente, la evidencia nombra un cliente');
});

test('la escala, contra el costo por calificado de SU cliente', () => {
  const campanas = ['x1', 'x2', 'y1', 'y2'].map((c) => campana(c, 'leadform'));
  const actual: [string, { inversion: number; contactos: number; agendados: number; calificados: number }][] = [
    ['x1', { inversion: 1000, contactos: 10, agendados: 10, calificados: 10 }],
    ['x2', { inversion: 600, contactos: 10, agendados: 10, calificados: 10 }],
    ['y1', { inversion: 100, contactos: 10, agendados: 10, calificados: 10 }],
    ['y2', { inversion: 100, contactos: 10, agendados: 10, calificados: 10 }],
  ];
  const clienteDe: [string, string][] = [['x1', 'X'], ['x2', 'X'], ['y1', 'Y'], ['y2', 'Y']];
  const porCliente = de(detectar(medida({ campanas, actual, previa: [], clienteDe })), ACQ.escalaPorCalificado);
  // X: 1.600 / 20 = 80, y x2 cuesta 60. Y: 10, y sus dos cuestan 10.
  assert.deepEqual(porCliente.map((d) => [d.entidad.id, d.lineaBase, d.valorActual]), [['x2', 80, 60]]);
  const ev = porCliente[0]!.evidencia as Record<string, unknown>;
  assert.deepEqual([ev.cliente, ev.costoDelCliente, 'costoDeLaEmpresa' in ev], ['X', 80, false]);

  // Con un solo cliente, contra la empresa: 1.800 / 40 = 45, y las de 10 son baratas.
  const empresa = de(detectar(medida({ campanas, actual, previa: [] })), ACQ.escalaPorCalificado);
  assert.deepEqual(empresa.map((d) => [d.entidad.id, d.lineaBase]), [['y1', 45], ['y2', 45]]);
  assert.ok(empresa.every((d) => (d.evidencia as Record<string, unknown>).costoDeLaEmpresa === 45 && !('cliente' in (d.evidencia as object))));
});

test('el gasto sin crecimiento agregado es el de cada cliente', () => {
  const campanas = [campana('x', 'leadform'), campana('y', 'leadform')];
  const actual: [string, { inversion: number; contactos: number }][] = [['x', { inversion: 1500, contactos: 20 }], ['y', { inversion: 1000, contactos: 20 }]];
  const previa: [string, { inversion: number; contactos: number }][] = [['x', { inversion: 1000, contactos: 20 }], ['y', { inversion: 1000, contactos: 20 }]];
  const agregados = (ds: Deteccion[]) => ds.filter((d) => d.entidad.tipo !== 'campana').map((d) => [d.entidad.tipo, d.entidad.id, d.cambioPct]);
  const porCliente = de(detectar(medida({ campanas, actual, previa, clienteDe: [['x', 'X'], ['y', 'Y']] })), ACQ.gastoSinCrecimiento);
  assert.deepEqual(agregados(porCliente), [['cliente', 'X', 0.5]], 'el gasto de X quedó tapado por el de Y');
  const empresa = de(detectar(medida({ campanas, actual, previa })), ACQ.gastoSinCrecimiento);
  assert.deepEqual(agregados(empresa), [['empresa', 'empresa', 0.25]]);
});

test('las frases del plan nombran al cliente, y sin él son las de siempre', () => {
  const d = (regla: string, tipo: Deteccion['entidad']['tipo'], evidencia: object, extra: Partial<Deteccion> = {}): Deteccion => ({
    regla,
    entidad: { tipo, id: 'e' },
    metrica: 'm',
    lineaBase: 80,
    valorActual: 0.7,
    cambioPct: -0.25,
    muestra: 10,
    periodo: { desde: '2026-09-05', hasta: '2026-10-04' },
    datosDesde: null,
    gravedad: 'media',
    causasPosibles: [],
    revisionRecomendada: '',
    perdidaContactos: null,
    destino: null,
    requiereValidacionEjecutiva: false,
    umbral: { valor: 1, provisional: true },
    evidencia,
    ...extra,
  });
  const campanas = { campanas: [{}] };
  assert.equal(
    textoDe(d(ACQ.sinEntrega, 'cliente', campanas, { valorActual: 6 }), '7d'),
    'Ninguna de las 1 campañas activas de este cliente que entregaban en los últimos 60 días entrega desde hace 6 días cerrados.',
  );
  assert.equal(
    textoDe(d(ACQ.sinEntrega, 'empresa', campanas, { valorActual: 6 }), '7d'),
    'Ninguna de las 1 campañas activas que entregaban en los últimos 60 días entrega desde hace 6 días cerrados.',
  );
  assert.equal(textoDe(d(ACQ.sinEntrega, 'campana', campanas, { valorActual: 6 }), '7d'), 'No entrega desde hace 6 días cerrados; otras campañas activas sí.');
  const tres = { campanas: [{}, {}, {}] };
  assert.equal(textoDe(d(ACQ.concentracion, 'campana', { ...tres, cliente: 'X' }), '7d'), 'Se lleva el 70 % del gasto de su cliente en la ventana, entre 3 campañas con gasto.');
  assert.equal(textoDe(d(ACQ.concentracion, 'campana', tres), '7d'), 'Se lleva el 70 % del gasto de la ventana, entre 3 campañas con gasto.');
  assert.equal(
    textoDe(d(ACQ.escalaPorCalificado, 'campana', { cliente: 'X' }, { valorActual: 60 }), '7d'),
    'Su costo por calificado está 25 % por debajo del de su cliente: 60 contra 80, sobre 10 calificados.',
  );
  assert.equal(
    textoDe(d(ACQ.escalaPorCalificado, 'campana', {}, { valorActual: 60 }), '7d'),
    'Su costo por calificado está 25 % por debajo del de la empresa: 60 contra 80, sobre 10 calificados.',
  );
});

test('la Reunión dice qué cliente dejó de entregar, y sin clientes es la de siempre', () => {
  const NADA: MedidaDeLaReunion = {
    validacion: [],
    sinEntrega: [],
    entrada: { semana: 0, anterior: 0 },
    citas: { cerrables: 0, citasCerrables: 0, sinRegistrar: 0 },
    objeciones: { analizadas: 0, antes: null, top: null },
    vinculo: { analizadas: 0, sinVinculo: 0 },
  };
  const temas = (sinEntrega: MedidaDeLaReunion['sinEntrega']) =>
    temasDeLaReunion({ ...NADA, sinEntrega }, (c) => umbralVigente(CATALOGO_DE_REGLAS.find((r) => r.codigo === c)!, new Map()));
  const deX = { id: 's1', entidad: { tipo: 'cliente' as const, id: 'X' }, nombre: 'Cliente X', texto: 'x', gravedad: 'critica' as const };
  const webinar = { id: 's2', entidad: { tipo: 'campana' as const, id: 'c2' }, nombre: 'Webinar', texto: 'x', gravedad: 'alta' as const };
  const [t] = temas([deX, webinar]);
  assert.deepEqual(
    [t!.gravedad, t!.texto],
    ['critica', 'Un cliente dejó de entregar en todas sus campañas activas: Cliente X. Una campaña activa dejó de entregar mientras otras siguen: Webinar.'],
  );
  assert.equal(temas([deX])[0]!.texto, 'Un cliente dejó de entregar en todas sus campañas activas: Cliente X.');
  assert.deepEqual([temas([webinar])[0]!.gravedad, temas([webinar])[0]!.texto], ['alta', 'Una campaña activa dejó de entregar mientras otras siguen: Webinar.']);
});

test('la fila de una campaña en la pantalla dice su cliente cuando llega', () => {
  /* La pantalla no calcula: dibuja lo que llega. `cliente` llega sólo con campañas de más de un cliente
     (`universoDeCampanas`), así que la fila lo nombra si viene, antes de la guarda del selector. */
  const panel = readFileSync(join(RAIZ, 'components/acquisition/PanelDeAcquisition.jsx'), 'utf8');
  const pie = panel.slice(panel.indexOf('\nfunction Pie('));
  const estado = pie.indexOf('const estado = c.cliente ? `${c.cliente} · ${deMeta}` : deMeta;');
  assert.ok(estado > 0, 'el pie de la campaña no nombra a su cliente');
  assert.ok(estado < pie.indexOf('return estado;'), 'el cliente se nombra después de la guarda del selector');
});
