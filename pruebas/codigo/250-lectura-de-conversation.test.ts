// La mitad pura de la lectura de Conversation: los paneles, las tarjetas, los agentes y la fila de cifras. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/2-departamentos/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, CN-1 y CN-4)
//
// `armarConversation` decide qué número va en cada lugar del prototipo y, cuando no hay número, por qué. Cada prueba
// dice qué mira y la mutación que la pone en rojo:
//
//   · toda tasa lleva el piso de 10, también las que el módulo publica sin él y las porciones del ICP — mutación:
//     sacar el piso;
//   · la asistencia sin citas y sin respuestas son dos «—» distintos — mutación: confundir los motivos;
//   · el ICP de quienes agendaron, en su orden y con su porción sobre su propio total — mutación: dividir por la
//     cohorte o por los agendados del lead;
//   · la cadena de Lead Flow tiene cinco pasos sobre la cohorte y el de la landing no tiene dato — mutación: cambiar
//     la base de un paso o inventarle un valor a la landing;
//   · la confirmación es sobre quienes la respondieron, y sin respuestas con citas el CRM no la registra — mutación:
//     dividir por las citas, o decir «sin citas»;
//   · las salidas son sobre las citas y el origen sobre quienes agendaron — mutación: cruzar las bases;
//   · los cuatro agentes, en su orden, con sus conteos y los de voz en «—» — mutación: cruzar un conteo;
//   · el sentimiento con su piso, sin análisis y sin auditoría, con datos asimétricos — mutación: cruzar positivo y
//     molesto;
//   · cada «—» dice por qué falta ESA cifra: sin agendados, sin escritos, sin respuestas, sin campo — mutación:
//     decir «sin contactos» con contactos;
//   · la fila de abajo: la respuesta con su piso, fuera de horario, el precall sobre su base y el molesto de los dos
//     flujos — mutación: el precall sobre todos los contactos con cita.
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
  asistenciaPorCuadrante?: Partial<EntradaDeConversation['asistenciaPorCuadrante']>;
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
    // El total del ICP, 32, no es el `agendaron` del lead, 35: una porción sobre el lead se vería distinta.
    icp: { prioriza: 8, valida: 4, financia: 2, descarta: 5, sin_clasificar: 13, ...o.icp },
    asistenciaPorCuadrante: {
      prioriza: { conAsistencia: 0, sePresentaron: 0 }, valida: { conAsistencia: 0, sePresentaron: 0 },
      financia: { conAsistencia: 0, sePresentaron: 0 }, descarta: { conAsistencia: 0, sePresentaron: 0 },
      sin_clasificar: { conAsistencia: 0, sePresentaron: 0 }, ...o.asistenciaPorCuadrante,
    },
    atribucion: { fueraDeHorario: o.fueraDeHorario === undefined ? { contactos: 12, sobre: 40 } : o.fueraDeHorario },
    precall: { sobre: 40, registraron: 10, clasificados: 32, hayCampo: true, ...o.precall } as ConsumoDelPrecall,
    sentimiento: o.sentimiento ?? { leadflow: sent(0, 0, 0), appflow: sent(1, 6, 1) },
    porCorregir: o.porCorregir ?? 8,
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
  // Las porciones del ICP, también: con 9 agendados no hay porcentajes.
  const icp = armarConversation(entrada({ icp: { prioriza: 0, valida: 0, financia: 0, descarta: 0, sin_clasificar: 9 } })).paneles.icp;
  assert.ok(icp.cuadrantes.every((t) => t.porcion === null), 'una porción del ICP con 9 agendados');
  assert.equal(icp.motivo, 'bajo_el_piso');
});

test('la asistencia: sin citas no hubo a quién; con citas y sin respuestas, nadie la marcó', () => {
  assert.deepEqual(armarConversation(entrada()).paneles.appointmentFlow.asistieron, { valor: null, motivo: 'sin_asistencia' });
  assert.deepEqual(armarConversation(entrada({ citas: { citas: 0, canceladas: 0, reagendadas: 0 } })).paneles.appointmentFlow.asistieron, { valor: null, motivo: 'sin_citas' });
  const marcada = armarConversation(entrada({ citas: { conAsistencia: 12, sePresentaron: 6 } }));
  assert.deepEqual(marcada.paneles.appointmentFlow.asistieron, { valor: 6, motivo: null });
  assert.deepEqual(marcada.appointmentFlow.kpi, { valor: 0.5, motivo: null });
});

test('el ICP de quienes agendaron, de Prioriza a sin clasificar, con su porción sobre su propio total', () => {
  const p = armarConversation(entrada());
  assert.equal(p.paneles.icp.agendaron, 32, 'el total del ICP no es la suma de sus cuadrantes');
  assert.deepEqual(p.paneles.icp.cuadrantes.map((t) => [t.clave, t.n, t.porcion]), [
    ['prioriza', 8, 8 / 32], ['valida', 4, 4 / 32], ['financia', 2, 2 / 32], ['descarta', 5, 5 / 32], ['sin_clasificar', 13, 13 / 32],
  ]);
  assert.equal(p.paneles.icp.motivo, null);
  const nadie = armarConversation(entrada({ icp: { prioriza: 0, valida: 0, financia: 0, descarta: 0, sin_clasificar: 0 } }));
  assert.ok(nadie.paneles.icp.cuadrantes.every((t) => t.porcion === null), 'una porción sobre cero agendados');
  assert.equal(nadie.paneles.icp.motivo, 'sin_agendados', 'con contactos y nadie que agendara no es «sin contactos»');
  const vacia = armarConversation(entrada({ lead: { cohorte: 0 }, icp: { prioriza: 0, valida: 0, financia: 0, descarta: 0, sin_clasificar: 0 } }));
  assert.equal(vacia.paneles.icp.motivo, 'sin_contactos');
});

test('la cadena de Lead Flow: cinco pasos sobre la cohorte, y la landing sin dato', () => {
  const c = armarConversation(entrada()).leadFlow.cadena;
  assert.deepEqual(c.map((x) => x.clave), ['entraron', 'escritos', 'respondieron', 'abrieron', 'agendaron']);
  assert.deepEqual(
    c.map((x) => [x.valor.valor, x.porcion.valor]),
    [[58, 1], [52, 52 / 58], [35, 35 / 58], [null, null], [35, 35 / 58]],
    'un paso de la cadena no es sobre la cohorte',
  );
  assert.deepEqual(c[3], { clave: 'abrieron', valor: { valor: null, motivo: 'sin_enlace' }, porcion: { valor: null, motivo: 'sin_enlace' } });
});

test('Appointment Flow: la confirmación sobre quienes la respondieron; las salidas sobre las citas; el origen sobre quienes agendaron', () => {
  const a = armarConversation(entrada()).appointmentFlow;
  assert.deepEqual(a.cadena.map((x) => x.clave), ['citas', 'confirmaron', 'asistieron']);
  assert.deepEqual(a.cadena[1]!.porcion, { valor: 15 / 20, motivo: null }, 'la confirmación se dividió por las citas');
  assert.deepEqual(a.salidas.reprogramaron, { clave: 'reprogramaron', valor: { valor: 7, motivo: null }, porcion: { valor: 7 / 56, motivo: null } });
  assert.deepEqual(a.salidas.cancelaron, { clave: 'cancelaron', valor: { valor: 15, motivo: null }, porcion: { valor: 15 / 56, motivo: null } });
  assert.deepEqual(a.origen.conversaronAntes.porcion, { valor: 30 / 35, motivo: null });
  assert.deepEqual(a.origen.solos.porcion, { valor: 5 / 35, motivo: null });
  // Con citas y nadie que respondiera el campo, el CRM no lo registra: no es que no haya citas.
  const sinCampo = armarConversation(entrada({ citas: { conConfirmacion: 0, confirmaron: 0 } }));
  assert.deepEqual(sinCampo.appointmentFlow.cadena[1]!.porcion, { valor: null, motivo: 'sin_campo' });
  assert.deepEqual(sinCampo.agentes[2]!.cifra, { valor: null, motivo: 'sin_campo' });
  const sinCitas = armarConversation(entrada({ citas: { citas: 0, conConfirmacion: 0, confirmaron: 0 } }));
  assert.deepEqual(sinCitas.agentes[2]!.cifra, { valor: null, motivo: 'sin_citas' });
  // Sin agendados, el origen dice eso y no «sin contactos».
  const nadie = armarConversation(entrada({ lead: { agendaron: 0, agendaronTrasResponder: 0, agendaronSinResponder: 0 } })).appointmentFlow.origen;
  assert.deepEqual(nadie.solos.porcion, { valor: null, motivo: 'sin_agendados' });
});

test('los cuatro agentes, en el orden del prototipo, con sus conteos; los de voz en «—»', () => {
  const g = armarConversation(entrada()).agentes;
  assert.deepEqual(g.map((x) => x.clave), ['leadflow_texto', 'leadflow_voz', 'appflow_texto', 'appflow_voz']);
  assert.deepEqual(g[0]!.cifra, { valor: 35 / 52, motivo: null }, 'la cifra de Lead Flow es la respuesta');
  assert.deepEqual(g[2]!.cifra, { valor: 15 / 20, motivo: null }, 'la de Appointment Flow es la confirmación');
  assert.deepEqual(g[0]!.desglose, [{ clave: 'escritos', n: 52 }, { clave: 'respondieron', n: 35 }, { clave: 'agendaron', n: 35 }]);
  assert.deepEqual(g[2]!.desglose, [{ clave: 'citas', n: 56 }, { clave: 'confirmaron', n: 15 }, { clave: 'reprogramaron', n: 7 }, { clave: 'cancelaron', n: 15 }]);
  for (const voz of [g[1]!, g[3]!]) {
    assert.deepEqual([voz.cifra, voz.desglose, voz.sentimiento, voz.motivoDelSentimiento], [{ valor: null, motivo: 'sin_llamadas' }, [], null, 'sin_llamadas']);
  }
  // A nadie se le escribió: la respuesta no tiene base, y no es «sin contactos».
  const sinEscritos = armarConversation(entrada({ lead: { escritos: 0, respondieron: 0, hastaLaPrimeraRespuesta: null } })).agentes[0]!;
  assert.deepEqual(sinEscritos.cifra, { valor: null, motivo: 'sin_escritos' });
});

test('el sentimiento de cada agente: con su piso, sin análisis y sin auditoría', () => {
  const bajo = armarConversation(entrada()).agentes;
  assert.deepEqual([bajo[0]!.sentimiento, bajo[0]!.motivoDelSentimiento], [null, 'sin_analisis']);
  assert.deepEqual([bajo[2]!.sentimiento, bajo[2]!.motivoDelSentimiento], [null, 'bajo_el_piso'], '8 análisis no alcanzan');
  // Asimétrico: cruzar positivo y molesto se ve.
  const diez = armarConversation(entrada({ sentimiento: { leadflow: sent(0, 0, 0), appflow: sent(1, 3, 6) } })).agentes[2]!;
  assert.deepEqual(diez.sentimiento, { positivo: 0.1, neutral: 0.3, molesto: 0.6 });
  const sinAuditar = armarConversation(entrada({ audita: false }));
  assert.deepEqual(
    [sinAuditar.agentes[2]!.motivoDelSentimiento, sinAuditar.porCorregir, sinAuditar.cifras.molestos.motivo],
    ['no_audita', { valor: null, motivo: 'no_audita' }, 'no_audita'],
  );
  assert.deepEqual(armarConversation(entrada()).porCorregir, { valor: 8, motivo: null });
});

test('la asistencia por calidad es la de cada cuadrante calificado, sin Descarta, no la de la empresa', () => {
  const p = armarConversation(entrada({
    citas: { conAsistencia: 22, sePresentaron: 12 },
    asistenciaPorCuadrante: { prioriza: { conAsistencia: 12, sePresentaron: 9 }, financia: { conAsistencia: 10, sePresentaron: 3 } },
  }));
  // Descarta no tiene fila: sus citas son de descartados (la `105`) y la población de la tasa no las cuenta.
  assert.deepEqual(p.appointmentFlow.calidad.map((x) => [x.clave, x.asistencia]), [
    ['prioriza', { valor: 9 / 12, motivo: null }],
    ['valida', { valor: null, motivo: 'sin_asistencia' }],
    ['financia', { valor: 3 / 10, motivo: null }],
    ['sin_clasificar', { valor: null, motivo: 'sin_asistencia' }],
  ]);
  const sinCitas = armarConversation(entrada({ citas: { citas: 0 } })).appointmentFlow.calidad;
  assert.ok(sinCitas.every((x) => x.asistencia.motivo === 'sin_citas'), 'sin citas, la calidad culpa a quien no marca');
});

test('la fila de abajo: la respuesta con su piso, fuera de horario, el precall sobre su base y el molesto de los dos flujos', () => {
  const p = armarConversation(entrada({ sentimiento: { leadflow: sent(1, 2, 3), appflow: sent(1, 1, 2) } })).cifras;
  assert.deepEqual(p.respuesta, { valor: 6, motivo: null });
  assert.deepEqual(p.fueraDeHorario, { valor: 12 / 40, motivo: null });
  assert.deepEqual(p.precall, { valor: 10 / 32, motivo: null }, 'el precall no es sobre los contactos con el campo clasificado');
  assert.deepEqual(p.molestos, { valor: 5 / 10, motivo: null }, 'el molesto no junta los dos flujos');
  const pocas = armarConversation(entrada({ lead: { hastaLaPrimeraRespuesta: { p50: 6, p90: 10, sobre: 9 } } })).cifras;
  assert.deepEqual(pocas.respuesta, { valor: null, motivo: 'bajo_el_piso' });
  const diez = armarConversation(entrada({ lead: { hastaLaPrimeraRespuesta: { p50: 6, p90: 10, sobre: 10 } } })).cifras;
  assert.deepEqual(diez.respuesta, { valor: 6, motivo: null }, 'diez casos alcanzan para la mediana');
  // Cada «—» de la fila, con el motivo de SU base.
  const nadieContesto = armarConversation(entrada({ lead: { respondieron: 0, hastaLaPrimeraRespuesta: null }, fueraDeHorario: null })).cifras;
  assert.deepEqual([nadieContesto.respuesta.motivo, nadieContesto.fueraDeHorario.motivo], ['sin_respuestas', 'sin_campo']);
  const sinCohorte = armarConversation(entrada({ lead: { cohorte: 0, escritos: 0, respondieron: 0, agendaron: 0, hastaLaPrimeraRespuesta: null }, fueraDeHorario: null })).cifras;
  assert.deepEqual([sinCohorte.respuesta.motivo, sinCohorte.fueraDeHorario.motivo], ['sin_contactos', 'sin_contactos']);
  assert.deepEqual(armarConversation(entrada({ precall: { hayCampo: false, sobre: 0, clasificados: 0 } })).cifras.precall, { valor: null, motivo: 'sin_campo' });
  assert.deepEqual(armarConversation(entrada({ precall: { sobre: 0, clasificados: 0, registraron: 0 } })).cifras.precall, { valor: null, motivo: 'sin_citas' });
  assert.deepEqual(armarConversation(entrada({ precall: { clasificados: 0, registraron: 0 } })).cifras.precall, { valor: null, motivo: 'sin_campo' });
  assert.deepEqual(armarConversation(entrada({ precall: { clasificados: 6, registraron: 2 } })).cifras.precall, { valor: null, motivo: 'bajo_el_piso' });
});
