// La lectura de Conversation: lo que dibuja el front del prototipo, hecho en el servidor.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ES (docs/2-departamentos/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, CN1-15)
//
// La pestaña vuelve al front del prototipo: tres paneles, el modo Estado con las dos tarjetas de flujo, el modo
// Agentes con las cuatro tarjetas y, debajo, una fila de cifras. Este módulo compone lo que ya se mide
// —`indicadoresDelLead`, `tasaDeCancelacion`, `atribucionDelLead`, `consumoDelPrecall`, `sentimientoPorFlujo`, los
// hallazgos del auditor— más el ICP de quienes agendaron, y arma con eso lo que la pantalla dibuja.
//
// Tiene dos mitades, como `lib/negocio/lecturaDeSales.ts`: `armarConversation`, pura y probada sin base, y
// `lecturaDeConversation`, que lee. La ruta y el cerebro leen la misma lectura (CN1-16).
//
// ── LAS REGLAS ─────────────────────────────────────────────────────────────
//
//   · **Todo de 0 a 1**, calculado acá desde los conteos: las tasas que los módulos publican de 0 a 100 las comparten
//     otras pantallas y no se tocan.
//   · **Toda tasa lleva el piso de 10** sobre su denominador (CN1-04), también las que los módulos publican sin él
//     —el booking rate, la respuesta, la cancelación, el reagendamiento—. Bajo el piso, «—» con su motivo.
//   · **Un «—» dice por qué**: el motivo viaja y la pantalla elige la frase de su lista cerrada (CN1-02).
//   · **Las tarjetas de agente son cifras del flujo**, no del agente: ningún mensaje dice qué agente lo escribió
//     (CN1-11). Las de voz no tienen dato: `negocio.llamadas` está vacía.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { alcanzable, descartado } from './citasAlcanzables.ts';
import { sentimientoPorFlujo, type SentimientoDelFlujo } from '../auditor/sentimiento.ts';
import { atribucionDelLead, type AtribucionDelLead } from './atribucionDelLead.ts';
import { consumoDelPrecall, type ConsumoDelPrecall } from './consumoDelPrecall.ts';
import { indicadoresDelLead, type IndicadoresDelLead } from './indicadoresDelLead.ts';
import { type Cancelacion, PISO_DE_UNA_TASA, tasaDeCancelacion } from './indicadoresDeCitas.ts';
import { CALIFICADOS, type ClaveDeCuadrante, claveDelCuadrante, LOS_CUATRO } from './cuadrantesDelIcp.ts';

// ─── Los tipos ──────────────────────────────────────────────────────────────

/**
 * Por qué una cifra no tiene valor: `sin_contactos` —la cohorte está vacía—, `sin_citas` —no hubo citas en la
 * ventana—, `sin_asistencia` —nadie marcó la asistencia—, `bajo_el_piso` —hay casos, pocos para una tasa—,
 * `sin_enlace` —el paso de la landing no tiene enlace con seguimiento—, `sin_llamadas` —un agente de voz—,
 * `sin_analisis` —el sentimiento sin análisis en la ventana—, `no_audita` —la empresa no audita sus agentes—,
 * `sin_campo` —hay citas o contactos, y el CRM no registra el dato: la confirmación, el precall o la zona horaria—,
 * `sin_agendados` —hay contactos y nadie agendó—, `sin_escritos` —hay contactos y a nadie se le escribió— o
 * `sin_respuestas` —se les escribió y nadie contestó—. Cada uno dice por qué falta ESA cifra: un «sin contactos» al
 * lado de «Contactos 50» es falso aunque la cifra no exista.
 */
export type MotivoDeLaCifra =
  | 'sin_contactos'
  | 'sin_citas'
  | 'sin_asistencia'
  | 'bajo_el_piso'
  | 'sin_enlace'
  | 'sin_llamadas'
  | 'sin_analisis'
  | 'no_audita'
  | 'sin_campo'
  | 'sin_agendados'
  | 'sin_escritos'
  | 'sin_respuestas';

export interface Cifra {
  /** Un conteo, una proporción de 0 a 1 o unos minutos. `null`: «—», y el motivo dice por qué. */
  valor: number | null;
  motivo: MotivoDeLaCifra | null;
}

/**
 * Un paso de una cadena: su conteo y su porción, de 0 a 1, sobre la base de ESE paso. En Lead Flow es la cohorte para
 * todos; en Appointment Flow la confirmación es sobre quienes respondieron el campo y la asistencia sobre las citas
 * con la asistencia marcada (CN1-10).
 */
export interface Paso {
  clave: string;
  valor: Cifra;
  porcion: Cifra;
}

/**
 * El ICP de quienes agendaron: el total y cada cuadrante con su conteo y su porción sobre ese total, sin clasificar
 * incluidos. Las porciones llevan el piso de 10 sobre el total; sin porción, `motivo` dice por qué.
 */
export interface IcpDeLosAgendados {
  agendaron: number;
  cuadrantes: { clave: ClaveDeCuadrante; n: number; porcion: number | null }[];
  motivo: MotivoDeLaCifra | null;
}

export interface TarjetaDeAgente {
  clave: 'leadflow_texto' | 'leadflow_voz' | 'appflow_texto' | 'appflow_voz';
  /** La cifra grande: la respuesta de Lead Flow, la confirmación de Appointment Flow. */
  cifra: Cifra;
  /** El desglose, en conteos del flujo. Vacío en los de voz. */
  desglose: { clave: string; n: number }[];
  /** El sentimiento del flujo, de 0 a 1. `null` con su motivo. */
  sentimiento: { positivo: number; neutral: number; molesto: number } | null;
  motivoDelSentimiento: MotivoDeLaCifra | null;
}

export interface PantallaDeConversationArmada {
  paneles: {
    leadFlow: { contactos: Cifra; agendaron: Cifra; bookingRate: Cifra };
    appointmentFlow: { citas: Cifra; asistieron: Cifra };
    icp: IcpDeLosAgendados;
  };
  leadFlow: { kpi: Cifra; cadena: Paso[] };
  appointmentFlow: {
    kpi: Cifra;
    cadena: Paso[];
    salidas: { reprogramaron: Paso; cancelaron: Paso };
    /**
     * La asistencia por cuadrante del ICP: «—» mientras nadie marque la asistencia. Sin Descarta: sus citas son de
     * descartados (la `105`) y la población de la tasa no los tiene.
     */
    calidad: { clave: ClaveDeCuadrante; asistencia: Cifra }[];
    origen: { conversaronAntes: Paso; solos: Paso };
  };
  agentes: TarjetaDeAgente[];
  /** Los patrones abiertos del auditor: «Qué corregir · {N} por resolver». Sin auditoría, «—» con su motivo. */
  porCorregir: Cifra;
  /** Lo que el prototipo no tenía (CN1-12). */
  cifras: { respuesta: Cifra; fueraDeHorario: Cifra; precall: Cifra; molestos: Cifra };
}

export interface EntradaDeConversation {
  lead: IndicadoresDelLead;
  citas: Cancelacion;
  icp: Record<ClaveDeCuadrante, number>;
  /** Las citas con la asistencia respondida y las que se presentaron, por cuadrante del ICP del contacto. */
  asistenciaPorCuadrante: Record<ClaveDeCuadrante, { conAsistencia: number; sePresentaron: number }>;
  atribucion: Pick<AtribucionDelLead, 'fueraDeHorario'>;
  precall: ConsumoDelPrecall;
  sentimiento: Record<string, SentimientoDelFlujo>;
  porCorregir: number;
  /** `false` cuando la empresa no audita sus agentes: el sentimiento y los hallazgos no existen. */
  audita: boolean;
}

// ─── Las cuentas, puras ─────────────────────────────────────────────────────

const conValor = (valor: number): Cifra => ({ valor, motivo: null });
const sinValor = (motivo: MotivoDeLaCifra | null): Cifra => ({ valor: null, motivo });

/** `n` sobre `sobre`, de 0 a 1, con el piso del denominador. `vacio` es el motivo cuando no hay ninguno. */
function tasa(n: number, sobre: number, vacio: MotivoDeLaCifra): Cifra {
  if (sobre === 0) return sinValor(vacio);
  if (sobre < PISO_DE_UNA_TASA) return sinValor('bajo_el_piso');
  return conValor(n / sobre);
}

function paso(clave: string, n: number, sobre: number, vacio: MotivoDeLaCifra): Paso {
  return { clave, valor: conValor(n), porcion: tasa(n, sobre, vacio) };
}

/** Los cuadrantes del panel, del mejor al peor y «Sin clasificar» al final, como estaban los tramos. */
const ORDEN_DE_CUADRANTES: readonly ClaveDeCuadrante[] = [...LOS_CUATRO, 'sin_clasificar'];
/** Los de la asistencia por calidad: sin Descarta, cuyas citas son de descartados y no están en la población. */
const ORDEN_DE_LA_CALIDAD: readonly ClaveDeCuadrante[] = [...CALIFICADOS, 'sin_clasificar'];

/** Cero por cuadrante, con las cinco claves. */
function porCuadrante<T>(cero: () => T): Record<ClaveDeCuadrante, T> {
  return Object.fromEntries(ORDEN_DE_CUADRANTES.map((k) => [k, cero()])) as Record<ClaveDeCuadrante, T>;
}

/** El sentimiento de un flujo, de 0 a 1, con el piso sobre los juzgados del vocabulario. */
function sentimientoDe(s: SentimientoDelFlujo | undefined, audita: boolean) {
  if (!audita) return { sentimiento: null, motivo: 'no_audita' as const };
  const total = s ? s.porValor.positivo + s.porValor.neutral + s.porValor.molesto : 0;
  if (total === 0) return { sentimiento: null, motivo: 'sin_analisis' as const };
  if (total < PISO_DE_UNA_TASA) return { sentimiento: null, motivo: 'bajo_el_piso' as const };
  return {
    sentimiento: { positivo: s!.porValor.positivo / total, neutral: s!.porValor.neutral / total, molesto: s!.porValor.molesto / total },
    motivo: null,
  };
}

/** Lo que dibuja la pantalla, desde lo leído. Sin base: la prueba lo arma con números a mano. */
export function armarConversation(e: EntradaDeConversation): PantallaDeConversationArmada {
  const l = e.lead;
  const c = e.citas;
  const sinCohorte = l.cohorte === 0;

  /* Sin la cohorte vacía, el motivo de lo que no se puede calcular sobre una base del lead es el de esa base. */
  const vacioDe = (motivo: MotivoDeLaCifra): MotivoDeLaCifra => (sinCohorte ? 'sin_contactos' : motivo);

  const totalIcp = ORDEN_DE_CUADRANTES.reduce((s, k) => s + (e.icp[k] ?? 0), 0);
  const conPiso = totalIcp >= PISO_DE_UNA_TASA;
  const icp: IcpDeLosAgendados = {
    agendaron: totalIcp,
    cuadrantes: ORDEN_DE_CUADRANTES.map((clave) => ({
      clave,
      n: e.icp[clave] ?? 0,
      porcion: conPiso ? (e.icp[clave] ?? 0) / totalIcp : null,
    })),
    motivo: totalIcp === 0 ? vacioDe('sin_agendados') : conPiso ? null : 'bajo_el_piso',
  };

  /* La asistencia: sin citas, no hubo a quién; con citas y ninguna marcada, nadie respondió la pregunta. */
  const asistieron =
    c.citas === 0 ? sinValor('sin_citas') : c.conAsistencia === 0 ? sinValor('sin_asistencia') : conValor(c.sePresentaron);
  const tasaDeAsistencia =
    c.citas === 0 ? sinValor('sin_citas') : c.conAsistencia === 0 ? sinValor('sin_asistencia') : tasa(c.sePresentaron, c.conAsistencia, 'sin_asistencia');

  /* La confirmación es un campo del CRM del contacto: con citas y nadie que lo haya respondido —o sin el campo—, el
     CRM no lo registra; no es que no haya citas. */
  const sinConfirmacion: MotivoDeLaCifra = c.citas === 0 ? 'sin_citas' : 'sin_campo';

  const sentLead = sentimientoDe(e.sentimiento['leadflow'], e.audita);
  const sentApp = sentimientoDe(e.sentimiento['appflow'], e.audita);
  const voz = (clave: 'leadflow_voz' | 'appflow_voz'): TarjetaDeAgente => ({
    clave,
    cifra: sinValor('sin_llamadas'),
    desglose: [],
    sentimiento: null,
    motivoDelSentimiento: 'sin_llamadas',
  });

  /* El sentimiento molesto de la fila de abajo es de los dos flujos juntos: la suma de sus juzgados, con el piso. */
  const molestos = (() => {
    const lf = e.sentimiento['leadflow']?.porValor;
    const af = e.sentimiento['appflow']?.porValor;
    const juntos: SentimientoDelFlujo['porValor'] = {
      positivo: (lf?.positivo ?? 0) + (af?.positivo ?? 0),
      neutral: (lf?.neutral ?? 0) + (af?.neutral ?? 0),
      molesto: (lf?.molesto ?? 0) + (af?.molesto ?? 0),
    };
    const s = sentimientoDe({ porValor: juntos } as SentimientoDelFlujo, e.audita);
    return s.sentimiento === null ? sinValor(s.motivo) : conValor(s.sentimiento.molesto);
  })();

  return {
    paneles: {
      leadFlow: {
        contactos: conValor(l.cohorte),
        agendaron: sinCohorte ? sinValor('sin_contactos') : conValor(l.agendaron),
        bookingRate: tasa(l.agendaron, l.cohorte, 'sin_contactos'),
      },
      appointmentFlow: { citas: conValor(c.citas), asistieron },
      icp,
    },
    leadFlow: {
      kpi: tasa(l.agendaron, l.cohorte, 'sin_contactos'),
      cadena: [
        paso('entraron', l.cohorte, l.cohorte, 'sin_contactos'),
        paso('escritos', l.escritos, l.cohorte, 'sin_contactos'),
        paso('respondieron', l.respondieron, l.cohorte, 'sin_contactos'),
        /* El paso del prototipo que no tiene dato: falta el enlace con seguimiento (CN1-09). */
        { clave: 'abrieron', valor: sinValor('sin_enlace'), porcion: sinValor('sin_enlace') },
        paso('agendaron', l.agendaron, l.cohorte, 'sin_contactos'),
      ],
    },
    appointmentFlow: {
      kpi: tasaDeAsistencia,
      cadena: [
        paso('citas', c.citas, c.citas, 'sin_citas'),
        /* La confirmación es un campo del CRM del contacto: su base son quienes lo respondieron, no las citas. */
        paso('confirmaron', c.confirmaron, c.conConfirmacion, sinConfirmacion),
        { clave: 'asistieron', valor: asistieron, porcion: tasaDeAsistencia },
      ],
      salidas: {
        reprogramaron: paso('reprogramaron', c.reagendadas, c.citas, 'sin_citas'),
        cancelaron: paso('cancelaron', c.canceladas, c.citas, 'sin_citas'),
      },
      calidad: ORDEN_DE_LA_CALIDAD.map((clave) => {
        const t = e.asistenciaPorCuadrante[clave] ?? { conAsistencia: 0, sePresentaron: 0 };
        return {
          clave,
          asistencia: c.citas === 0 ? sinValor('sin_citas') : tasa(t.sePresentaron, t.conAsistencia, 'sin_asistencia'),
        };
      }),
      origen: {
        conversaronAntes: paso('conversaron_antes', l.agendaronTrasResponder, l.agendaron, vacioDe('sin_agendados')),
        solos: paso('solos', l.agendaronSinResponder, l.agendaron, vacioDe('sin_agendados')),
      },
    },
    agentes: [
      {
        clave: 'leadflow_texto',
        cifra: tasa(l.respondieron, l.escritos, vacioDe('sin_escritos')),
        desglose: [
          { clave: 'escritos', n: l.escritos },
          { clave: 'respondieron', n: l.respondieron },
          { clave: 'agendaron', n: l.agendaron },
        ],
        sentimiento: sentLead.sentimiento,
        motivoDelSentimiento: sentLead.motivo,
      },
      voz('leadflow_voz'),
      {
        clave: 'appflow_texto',
        cifra: tasa(c.confirmaron, c.conConfirmacion, sinConfirmacion),
        desglose: [
          { clave: 'citas', n: c.citas },
          { clave: 'confirmaron', n: c.confirmaron },
          { clave: 'reprogramaron', n: c.reagendadas },
          { clave: 'cancelaron', n: c.canceladas },
        ],
        sentimiento: sentApp.sentimiento,
        motivoDelSentimiento: sentApp.motivo,
      },
      voz('appflow_voz'),
    ],
    porCorregir: e.audita ? conValor(e.porCorregir) : sinValor('no_audita'),
    cifras: {
      /* `null` es cero respuestas medidas: sin cohorte, sin escritos o sin nadie que contestara. */
      respuesta:
        l.hastaLaPrimeraRespuesta === null
          ? sinValor(vacioDe(l.escritos === 0 ? 'sin_escritos' : l.respondieron === 0 ? 'sin_respuestas' : 'bajo_el_piso'))
          : l.hastaLaPrimeraRespuesta.sobre < PISO_DE_UNA_TASA
            ? sinValor('bajo_el_piso')
            : conValor(l.hastaLaPrimeraRespuesta.p50),
      /* Los primeros mensajes que salieron fuera del horario del contacto (8 a 21 en su zona), sobre los contactos
         escritos que tienen zona. `null`: ninguno la tiene. */
      fueraDeHorario:
        e.atribucion.fueraDeHorario === null
          ? sinValor(vacioDe(l.escritos === 0 ? 'sin_escritos' : 'sin_campo'))
          : tasa(e.atribucion.fueraDeHorario.contactos, e.atribucion.fueraDeHorario.sobre, vacioDe('sin_escritos')),
      /* Sobre los contactos con el campo clasificado, como el módulo: los sin campo o sin rama no son «no lo vio». */
      precall: !e.precall.hayCampo
        ? sinValor('sin_campo')
        : e.precall.sobre === 0
          ? sinValor('sin_citas')
          : tasa(e.precall.registraron, e.precall.clasificados, 'sin_campo'),
      molestos,
    },
  };
}

// ─── La lectura ─────────────────────────────────────────────────────────────

/**
 * Quienes agendaron en la ventana, por cuadrante del ICP: la misma cohorte que `indicadoresDelLead` —el alta en el CRM
 * dentro de la ventana, con alguna cita— y la misma clave que Leads Portal, `claveDelCuadrante`. Corre dentro de
 * `conOrganizacion`.
 */
export async function icpDeLosAgendados(dias: number): Promise<Record<ClaveDeCuadrante, number>> {
  const filas = await datos()
    .selectFrom('contactos')
    .select(['cuadrante', sql<number>`count(*)`.as('n')])
    .where(sql<boolean>`alta_en_el_crm >= now() - make_interval(days => ${dias})`)
    .where(sql<boolean>`exists (select 1 from negocio.citas ci where ci.org_id = contactos.org_id and ci.contacto_id = contactos.id)`)
    .groupBy('cuadrante')
    .execute();
  const salida = porCuadrante(() => 0);
  for (const f of filas) salida[claveDelCuadrante(f.cuadrante)] += Number(f.n);
  return salida;
}

/**
 * La asistencia de las citas de la ventana por cuadrante del ICP del contacto: las respondidas y las presentes. La
 * misma población que `tasaDeCancelacion` —ocurridas, alcanzables y de contactos no descartados, y desde la `105`
 * Descarta es un descarte—, con sus predicados compartidos. Corre dentro de `conOrganizacion`.
 */
export async function asistenciaPorCuadrante(dias: number): Promise<Record<ClaveDeCuadrante, { conAsistencia: number; sePresentaron: number }>> {
  const filas = await datos()
    .selectFrom('citas')
    .innerJoin('contactos', (j) => j.onRef('contactos.id', '=', 'citas.contacto_id').onRef('contactos.org_id', '=', 'citas.org_id'))
    .select([
      'contactos.cuadrante as cuadrante',
      sql<number>`count(*) filter (where citas.asistio is not null)`.as('con'),
      sql<number>`count(*) filter (where citas.asistio is true)`.as('si'),
    ])
    .where(sql<boolean>`citas.inicio_el >= now() - make_interval(days => ${dias})`)
    .where(sql<boolean>`citas.inicio_el < now()`)
    .where(alcanzable('citas'))
    .where(sql<boolean>`not ${descartado('citas')}`)
    .groupBy('contactos.cuadrante')
    .execute();
  const salida = porCuadrante(() => ({ conAsistencia: 0, sePresentaron: 0 }));
  for (const f of filas) {
    const t = salida[claveDelCuadrante(f.cuadrante)];
    t.conAsistencia += Number(f.con);
    t.sePresentaron += Number(f.si);
  }
  return salida;
}

/**
 * Los patrones del auditor que siguen abiertos, de todos los agentes: uno por código, que es como los agrupa el modo
 * Auditoría (`agruparPorPatron`, `lib/auditor/vista.ts`) —contados por agente y código, un código con casos de los dos
 * agentes sumaría dos acá y se vería uno allá—. Sin ventana, como la pantalla del técnico (CN1-11).
 */
export async function patronesAbiertos(): Promise<number> {
  const fila = await datos()
    .selectFrom('hallazgos')
    .select(sql<number>`count(distinct patron)`.as('n'))
    .where('resuelto_el', 'is', null)
    .executeTakeFirst();
  return Number(fila?.n ?? 0);
}

export interface LecturaDeConversation {
  lead: IndicadoresDelLead;
  citas: Cancelacion;
  atribucion: AtribucionDelLead;
  precall: ConsumoDelPrecall;
  sentimiento: Record<string, SentimientoDelFlujo>;
  /** Lo que dibuja el front del prototipo. */
  pantalla: PantallaDeConversationArmada;
}

/**
 * Lo que lee la pantalla de Conversation en una ventana. Corre dentro de `conOrganizacion`.
 *
 * @param audita Lo que resolvió el portero del auditor: `false` cuando la empresa no audita sus agentes.
 */
export async function lecturaDeConversation(dias: number, audita: boolean): Promise<LecturaDeConversation> {
  const lead = await indicadoresDelLead(dias);
  const citas = await tasaDeCancelacion(dias);
  const atribucion = await atribucionDelLead(dias);
  const precall = await consumoDelPrecall(dias);
  const sentimiento = await sentimientoPorFlujo(dias);
  const icp = await icpDeLosAgendados(dias);
  const asistencia = await asistenciaPorCuadrante(dias);
  const porCorregir = audita ? await patronesAbiertos() : 0;
  return {
    lead,
    citas,
    atribucion,
    precall,
    sentimiento,
    pantalla: armarConversation({ lead, citas, icp, asistenciaPorCuadrante: asistencia, atribucion, precall, sentimiento, porCorregir, audita }),
  };
}
