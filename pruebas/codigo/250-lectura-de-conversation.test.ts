// La mitad pura de la lectura de Conversation: los paneles, las tarjetas, los agentes y la fila de cifras. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, CN-1)
//
// `armarConversation` decide qué número va en cada lugar del prototipo y, cuando no hay número, por qué. Cada prueba
// dice qué mira y la mutación que la pone en rojo:
//
//   · toda tasa lleva el piso de 10, también las que el módulo publica sin él — mutación: sacar el piso;
//   · la asistencia sin citas y sin respuestas son dos «—» distintos — mutación: confundir los motivos;
//   · el ICP de quienes agendaron, en su orden y con su porción — mutación: dividir por la cohorte;
//   · la cadena de Lead Flow tiene cinco pasos y el de la landing no tiene dato — mutación: inventarle un valor;
//   · la confirmación es sobre quienes la respondieron, no sobre las citas — mutación: dividir por las citas;
//   · las salidas son sobre las citas y el origen sobre quienes agendaron — mutación: cruzar las bases;
//   · los cuatro agentes, en su orden, con los de voz en «—» — mutación: darle una cifra a la voz;
//   · el sentimiento con su piso, sin análisis y sin auditoría — mutación: publicarlo bajo el piso;
//   · la asistencia por calidad, por tramo — mutación: tomar la de toda la empresa;
//   · la fila de abajo: la respuesta con su piso, fuera de horario, el precall y el molesto de los dos flujos —
//     mutación: tomar el molesto de un solo flujo.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import type { SentimientoDelFlujo } from '../../lib/auditor/sentimiento.ts';
import type { ConsumoDelPrecall } from '../../lib/negocio/consumoDelPrecall.ts';
import type { IndicadoresDelLead } from '../../lib/negocio/indicadoresDelLead.ts';
import type { Cancelacion } from '../../lib/negocio/indicadoresDeCitas.ts';
import { armarConversation, type EntradaDeConversation } from '../../lib/negocio/lecturaDeConversation.ts';

const sent = (positivo: number, neutral: number, molesto: number) =>
  ({ dias: 30, juzgadas: positivo + neutral + molesto, porValor: { positivo, neutral, molesto }, molestos: null, aviso: null }) as SentimientoDelFlujo;

function entrada(o: {
  lead?: Partial<IndicadoresDelLead>;
  citas?: Partial<Cancelacion>;
  icp?: Partial<EntradaDeConversation['icp']>;
  asistenciaPorTramo?: Partial<EntradaDeConversation['asistenciaPorTramo']>;
  fueraDeHorario?: { contactos: number; sobre: number } | null;
  precall?: Partial<ConsumoDelPrecall>;
  sentimiento?: Record<string, SentimientoDelFlujo>;
  porCorregir?: number;
  audita?: boolean;
} = {}): EntradaDeConversation {
  return {
    lead: {
      cohorte: 58, escritos: 52, respondieron: 35, agendaron: 35, agendaronTrasResponder: 30, agendaronSinResponder: 5,
      hastaLaPrimeraRespuesta: { p50: 6, p90: 370, sobre: 30 }, ...o.lead,
    } as IndicadoresDelLead,
    citas: {
      citas: 56, canceladas: 15, reagendadas: 7, conAsistencia: 0, sePresentaron: 0, conConfirmacion: 20, confirmaron: 15, ...o.citas,
    } as Cancelacion,
    icp: { alto: 7, medio: 7, bajo: 6, sin_calificar: 15, ...o.icp },
    asistenciaPorTramo: {
      alto: { conAsistencia: 0, sePresentaron: 0 }, medio: { conAsistencia: 0, sePresentaron: 0 },
      bajo: { conAsistencia: 0, sePresentaron: 0 }, sin_calificar: { conAsistencia: 0, sePresentaron: 0 }, ...o.asistenciaPorTramo,
    },
    atribucion: { fueraDeHorario: o.fueraDeHorario === undefined ? { contactos: 12, sobre: 40 } : o.fueraDeHorario },
    precall: { sobre: 40, registraron: 10, ...o.precall } as ConsumoDelPrecall,
    sentimiento: o.sentimiento ?? { leadflow: sent(0, 0, 0), appflow: sent(1, 6, 1) },
    porCorregir: o.porCorregir ?? 27,
    audita: o.audita ?? true,
  };
}

test('toda tasa lleva el piso de 10: bajo el piso, «—» con su motivo', () => {
  const nueve = armarConversation(entrada({ lead: { cohorte: 9, agendaron: 4 } }));
  assert.deepEqual(nueve.paneles.leadFlow.bookingRate, { valor: null, motivo: 'bajo_el_piso' }, 'el booking rate se publicó con 9 contactos');
  assert.deepEqual(nueve.paneles.leadFlow.agendaron, { valor: 4, motivo: null }, 'el conteo se publica aunque la tasa no');
  const doce = armarConversation(entrada({ lead: { cohorte: 12, agendaron: 6 } }));
  assert.deepEqual(doce.leadFlow.kpi, { valor: 0.5, motivo: null });
  const vacia = armarConversation(entrada({ lead: { cohorte: 0, escritos: 0, respondieron: 0, agendaron: 0 } }));
  assert.deepEqual(vacia.paneles.leadFlow.agendaron, { valor: null, motivo: 'sin_contactos' });
  assert.deepEqual(vacia.paneles.leadFlow.bookingRate, { valor: null, motivo: 'sin_contactos' });
  // La cancelación, que el módulo publica sin piso: con 8 citas no hay tasa.
  const ocho = armarConversation(entrada({ citas: { citas: 8, canceladas: 4 } }));
  assert.deepEqual(ocho.appointmentFlow.salidas.cancelaron.porcion, { valor: null, motivo: 'bajo_el_piso' });
});

test('la asistencia: sin citas no hubo a quién; con citas y sin respuestas, nadie la marcó', () => {
  assert.deepEqual(armarConversation(entrada()).paneles.appointmentFlow.asistieron, { valor: null, motivo: 'sin_asistencia' });
  assert.deepEqual(armarConversation(entrada({ citas: { citas: 0, canceladas: 0, reagendadas: 0 } })).paneles.appointmentFlow.asistieron, { valor: null, motivo: 'sin_citas' });
  const marcada = armarConversation(entrada({ citas: { conAsistencia: 12, sePresentaron: 6 } }));
  assert.deepEqual(marcada.paneles.appointmentFlow.asistieron, { valor: 6, motivo: null });
  assert.deepEqual(marcada.appointmentFlow.kpi, { valor: 0.5, motivo: null });
});

test('el ICP de quienes agendaron, de alto a sin calificar, con su porción sobre los que agendaron', () => {
  const p = armarConversation(entrada());
  assert.equal(p.paneles.icp.agendaron, 35);
  assert.deepEqual(p.paneles.icp.tramos.map((t) => [t.clave, t.n, t.porcion]), [
    ['alto', 7, 7 / 35], ['medio', 7, 7 / 35], ['bajo', 6, 6 / 35], ['sin_calificar', 15, 15 / 35],
  ]);
  const nadie = armarConversation(entrada({ icp: { alto: 0, medio: 0, bajo: 0, sin_calificar: 0 } }));
  assert.ok(nadie.paneles.icp.tramos.every((t) => t.porcion === null), 'una porción sobre cero agendados');
});

test('la cadena de Lead Flow: cinco pasos sobre la cohorte, y la landing sin dato', () => {
  const c = armarConversation(entrada()).leadFlow.cadena;
  assert.deepEqual(c.map((x) => x.clave), ['entraron', 'escritos', 'respondieron', 'abrieron', 'agendaron']);
  assert.deepEqual(c[1]!.porcion, { valor: 52 / 58, motivo: null });
  assert.deepEqual(c[3], { clave: 'abrieron', valor: { valor: null, motivo: 'sin_enlace' }, porcion: { valor: null, motivo: 'sin_enlace' } });
});

test('Appointment Flow: la confirmación sobre quienes la respondieron; las salidas sobre las citas; el origen sobre quienes agendaron', () => {
  const a = armarConversation(entrada()).appointmentFlow;
  assert.deepEqual(a.cadena.map((x) => x.clave), ['citas', 'confirmaron', 'asistieron']);
  assert.deepEqual(a.cadena[1]!.porcion, { valor: 15 / 20, motivo: null }, 'la confirmación se dividió por las citas');
  assert.deepEqual(a.salidas.reprogramaron.porcion, { valor: 7 / 56, motivo: null });
  assert.deepEqual(a.salidas.cancelaron.porcion, { valor: 15 / 56, motivo: null });
  assert.deepEqual(a.origen.conversaronAntes.porcion, { valor: 30 / 35, motivo: null });
  assert.deepEqual(a.origen.solos.porcion, { valor: 5 / 35, motivo: null });
});

test('los cuatro agentes, en el orden del prototipo; los de voz en «—»', () => {
  const g = armarConversation(entrada()).agentes;
  assert.deepEqual(g.map((x) => x.clave), ['leadflow_texto', 'leadflow_voz', 'appflow_texto', 'appflow_voz']);
  assert.deepEqual(g[0]!.cifra, { valor: 35 / 52, motivo: null }, 'la cifra de Lead Flow es la respuesta');
  assert.deepEqual(g[2]!.cifra, { valor: 15 / 20, motivo: null }, 'la de Appointment Flow es la confirmación');
  for (const voz of [g[1]!, g[3]!]) {
    assert.deepEqual([voz.cifra, voz.desglose, voz.sentimiento, voz.motivoDelSentimiento], [{ valor: null, motivo: 'sin_llamadas' }, [], null, 'sin_llamadas']);
  }
});

test('el sentimiento de cada agente: con su piso, sin análisis y sin auditoría', () => {
  const bajo = armarConversation(entrada()).agentes;
  assert.deepEqual([bajo[0]!.sentimiento, bajo[0]!.motivoDelSentimiento], [null, 'sin_analisis']);
  assert.deepEqual([bajo[2]!.sentimiento, bajo[2]!.motivoDelSentimiento], [null, 'bajo_el_piso'], '8 análisis no alcanzan');
  const diez = armarConversation(entrada({ sentimiento: { leadflow: sent(0, 0, 0), appflow: sent(2, 6, 2) } })).agentes[2]!;
  assert.deepEqual(diez.sentimiento, { positivo: 0.2, neutral: 0.6, molesto: 0.2 });
  const sinAuditar = armarConversation(entrada({ audita: false }));
  assert.deepEqual([sinAuditar.agentes[2]!.motivoDelSentimiento, sinAuditar.porCorregir], ['no_audita', 0]);
});

test('la asistencia por calidad es la de cada tramo, no la de la empresa', () => {
  const p = armarConversation(entrada({
    citas: { conAsistencia: 22, sePresentaron: 12 },
    asistenciaPorTramo: { alto: { conAsistencia: 12, sePresentaron: 9 }, bajo: { conAsistencia: 10, sePresentaron: 3 } },
  }));
  assert.deepEqual(p.appointmentFlow.calidad.map((x) => [x.clave, x.asistencia]), [
    ['alto', { valor: 9 / 12, motivo: null }],
    ['medio', { valor: null, motivo: 'sin_asistencia' }],
    ['bajo', { valor: 3 / 10, motivo: null }],
    ['sin_calificar', { valor: null, motivo: 'sin_asistencia' }],
  ]);
});

test('la fila de abajo: la respuesta con su piso, fuera de horario, el precall y el molesto de los dos flujos', () => {
  const p = armarConversation(entrada({ sentimiento: { leadflow: sent(1, 2, 1), appflow: sent(1, 4, 1) } })).cifras;
  assert.deepEqual(p.respuesta, { valor: 6, motivo: null });
  assert.deepEqual(p.fueraDeHorario, { valor: 12 / 40, motivo: null });
  assert.deepEqual(p.precall, { valor: 10 / 40, motivo: null });
  assert.deepEqual(p.molestos, { valor: 2 / 10, motivo: null }, 'el molesto no junta los dos flujos');
  const pocas = armarConversation(entrada({ lead: { hastaLaPrimeraRespuesta: { p50: 6, p90: 10, sobre: 4 } }, fueraDeHorario: null })).cifras;
  assert.deepEqual([pocas.respuesta, pocas.fueraDeHorario], [{ valor: null, motivo: 'bajo_el_piso' }, { valor: null, motivo: 'sin_contactos' }]);
});
