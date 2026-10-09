// Los cinco pasos de Conversion, con los datos reales: lo que dibuja el front del prototipo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ES, Y DE DÓNDE SALE CADA CIFRA
//
// El front que vuelve el 2026-10-08 (`docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`) dibuja una
// tira de tres paneles y un recorrido de cinco tarjetas —Landing, VSL, Formulario, Agenda, Gracias—. Este
// módulo arma todo eso en el servidor, y **compone lo que ya se mide**: lo que otro módulo sabe, lo toma de él.
//
//   · la cohorte, por dónde entró y cuántos agendaron: `recorridoDelLead`, con la ventana de días cerrados; los
//     agendados de la tarjeta son la suma de sus filas (CV15-05, CV15-15);
//   · el formulario de la landing: `embudoDelFormulario`, con la misma ventana y su corte (CV15-14);
//   · calificó, confirmó, canceló y la cohorte hasta el corte: una sola pasada por la cohorte con los predicados
//     de `citasAlcanzables.ts` e `indicadoresDeCitas.ts` (CV15-09, CV15-18). En la ventana anterior esa pasada
//     cuenta la cohorte y los agendados a la misma edad, en la misma sentencia, para que la tasa no mezcle dos
//     fotos; la porción de la anterior sale de su `recorridoDelLead`;
//   · las vistas de landing: `landingPageView` de Meta, que no son personas y no llevan tasa (CV15-07);
//   · la ventana: `bordesDelPeriodo`, la función de Acquisition. En 7 y 30 días las dos pantallas cuentan a la
//     misma gente (CV15-21); «Completo» empieza en el primer dato de cada una —acá el primer contacto, allá el
//     primero con campaña— o en el primer día de gasto si fuera anterior (CV15-04).
//
// ── LO QUE COMPARA, Y LO QUE NUNCA ───────────────────────────────────────────
//
// La ventana anterior es la del mismo largo, justo antes, y sólo existe con 7 y 30 días (CV15-20). Las cifras
// de personas comparan si la historia de contactos empieza antes de la anterior y las lecturas de contactos y
// de citas están al día; **el gasto no las frena**: no lo dividen. Los agendados de la anterior se cuentan a la
// misma edad, y si alguno de sus contactos tiene una cita congelada no comparan: la anterior tendría agendados
// de menos y la flecha subiría en verde sin que nada cambie. Las porciones comparan con las dos cohortes en el
// piso. Las vistas de Meta no son personas y comparan por su cuenta: con el gasto entero y el desglose completo
// en las dos ventanas. Y nunca comparan el formulario —el campo murió el 2026-08-31—, ni los calificados, los
// confirmados o los que cancelaron: el descarte y la confirmación no tienen fecha.
//
// Todo lo de `PasosDeConversion` viaja de 0 a 1: la `finalizacion` del embudo llega en %, y se divide por 100 acá,
// una sola vez. El `formulario` que devuelve `lecturaDeConversion` es el del embudo, sin tocar: sigue en %.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { campoPorNombre } from './camposDelCrm.ts';
import { esCalificado, tieneCitaAlcanzable, todasSusCitasCanceladas } from './citasAlcanzables.ts';
import { bordesDelPeriodo, type DiasDeCalendario } from './diasCerrados.ts';
import { embudoDelFormulario, type EmbudoDelFormulario } from './embudoDelFormulario.ts';
import { type Sentido, tasa, type Variacion, variacion } from './embudosDeAcquisition.ts';
import { coberturaDelGasto, estadoDeLaSerie, type MotivoDelGasto } from './gastoDeLaCuenta.ts';
import {
  CAMPO_DE_CONFIRMACION,
  confirmoElAgendamiento,
  PISO_DE_UNA_TASA,
  respondioLaConfirmacion,
} from './indicadoresDeCitas.ts';
import type { ClaveDePeriodo } from './periodo.ts';
import { cohorteEntre } from './recorrido.ts';
import { recorridoDelLead, type RecorridoDeLosLeads } from './recorridoDelLead.ts';

// ─── Los tipos ──────────────────────────────────────────────────────────────

/** Los pasos, con las claves del prototipo (`STEPS`, `aios-command-center_1.html:3969-3975`) y en su orden. */
export const PASOS = ['sesiones', 'vsl', 'form', 'agenda', 'gracias'] as const;
export type ClaveDePaso = (typeof PASOS)[number];

/** `real`: medido. `historico`: medido hasta el corte del formulario. `hueco`: no hay fuente (CV15-13). */
export type EstadoDelPaso = 'real' | 'historico' | 'hueco';

/**
 * La variación de una PROPORCIÓN contra la ventana anterior, en puntos: `puntos` es una fracción, y 0,05 son
 * cinco puntos. Bajo medio punto, «=», como el `Math.round(now - before) === 0` del prototipo sobre porcentajes
 * enteros (`aios-command-center_1.html:4085-4086`). Los conteos varían en %, con `variacion` de Acquisition.
 */
export type VariacionEnPuntos =
  | { tipo: 'sin_comparacion' }
  | { tipo: 'igual' }
  | { tipo: 'sube' | 'baja'; puntos: number; lectura: 'buena' | 'mala' | 'neutra' };

/**
 * Por qué no compara nada de personas: `periodo` en «Hoy» y «Completo»; `sin_historia` si los contactos
 * empiezan después del comienzo de la anterior; `faltan_contactos` si la lectura de contactos o la de citas no
 * está al día, y la cohorte puede estar incompleta.
 */
export type SinComparacionDeConversion = 'periodo' | 'sin_historia' | 'faltan_contactos';

/**
 * Por qué las vistas de Meta no se publican o no comparan: los del gasto (`colector_atrasado`, `dias_sin_leer`,
 * `no_cuadra`), o `sin_desglose`: el desglose empezó después del comienzo de la ventana, o alguna fila que entregó
 * no lo trae, y la suma sería la de una parte.
 */
export type MotivoDeLasVistas = MotivoDelGasto | 'sin_desglose';

/** Las dos métricas de cada tarjeta (`keyMetrics`, `aios-command-center_1.html:4155-4166`), por su clave. */
export type ClaveDeMetrica =
  | 'vistas'
  | 'porLaLanding'
  | 'vistoPromedio'
  | 'llegaAlCta'
  | 'loCompletan'
  | 'tiempoMedio'
  | 'calificados'
  | 'confirmados'
  | 'dePlay'
  | 'videoVisto';

export interface MetricaDelPaso {
  clave: ClaveDeMetrica;
  /** Una proporción de 0 a 1, o un conteo si `unidad` es `conteo`. `null`: «—». */
  valor: number | null;
  unidad: 'proporcion' | 'conteo';
  /** Contada por Meta: no son personas («según Meta»). */
  deMeta: boolean;
  /** Los conteos en %, las proporciones en puntos. `null`: esta métrica no compara nunca. */
  variacion: Variacion | VariacionEnPuntos | null;
}

export interface Paso {
  clave: ClaveDePaso;
  estado: EstadoDelPaso;
  /** Personas en el paso. `null` en un hueco, y en el formulario si la ventana empieza después del corte. */
  valor: number | null;
  /**
   * Sobre la cohorte —el formulario, sobre la cohorte hasta el corte—. `null` en Landing, en un hueco, bajo el piso, y
   * en el formulario si la ventana empieza después del corte.
   */
  tasa: number | null;
  /** Landing: el conteo, en %. Agenda: la tasa, en puntos. `null`: el paso no compara nunca. */
  variacion: Variacion | VariacionEnPuntos | null;
  /**
   * Los de la cohorte que NO llegaron a este paso (CV15-16): en el formulario, de la cohorte hasta el corte, que es
   * su denominador. `null` en Landing, en los huecos y en el formulario sin valor.
   */
  caida: number | null;
  metricas: [MetricaDelPaso, MetricaDelPaso];
  /** Sólo el formulario: el último día con el campo escrito. */
  hastaElCorte: string | null;
}

export interface CifrasDeConversion {
  contactos: { valor: number; variacion: Variacion };
  vistas: { valor: number | null; variacion: Variacion; motivo: MotivoDeLasVistas | null };
  formulario: {
    /** Los que traen el campo. `null` si la ventana empieza después del corte o no hay campo. */
    valor: number | null;
    tasa: number | null;
    finalizacion: number | null;
    corte: string | null;
    laVentanaLoCruza: boolean;
  };
  agendados: {
    valor: number;
    tasa: number | null;
    variacion: Variacion;
    variacionDeLaTasa: VariacionEnPuntos;
    /** La anterior tiene citas congeladas: sus agendados no se pueden contar enteros. */
    congeladasEnLaAnterior: boolean;
  };
  calificados: { valor: number; tasa: number | null; deLaCohorte: number | null };
  noCalificados: { valor: number; tasa: number | null };
  /** `valor` nulo si el CRM no tiene el campo de confirmación. La tasa es sobre los calificados (`CV15-P10`). */
  confirmados: { valor: number | null; respondieron: number | null; tasa: number | null };
  cancelaron: { valor: number; tasa: number | null };
  porLaLanding: { porcion: number | null; variacion: VariacionEnPuntos };
}

export interface PasosDeConversion {
  ventana: DiasDeCalendario;
  anterior: DiasDeCalendario | null;
  sinComparacion: SinComparacionDeConversion | null;
  cifras: CifrasDeConversion;
  /** Los cinco, en el orden de `PASOS`. */
  pasos: Paso[];
  /** Cuántos de la cohorte traen por dónde entraron (CV15-10). */
  cobertura: { con: number; sobre: number };
  /** Sólo en «Completo»: los contactos sin fecha de alta, que no entran en ninguna ventana. */
  sinAlta: number | null;
}

/** Lo que una pasada por la cohorte cuenta, en personas. */
export interface PersonasDeLaCohorte {
  contactos: number;
  agendados: number;
  calificados: number;
  /** Calificados con el campo de confirmación respondido, con un valor u otro. */
  respondieron: number;
  confirmaron: number;
  cancelaron: number;
  /** Los dados de alta hasta el día del corte del formulario, inclusive. */
  hastaElCorte: number;
  /** Los que tienen alguna cita congelada, anterior a la `038`. */
  conCitasCongeladas: number;
}

// ─── Las cuentas, puras ─────────────────────────────────────────────────────

/** La variación de una proporción, en puntos. `null` en cualquiera de las dos: «sin comparación». */
export function variacionEnPuntos(actual: number | null, anterior: number | null, sentido: Sentido): VariacionEnPuntos {
  if (actual === null || anterior === null) return { tipo: 'sin_comparacion' };
  const d = actual - anterior;
  if (Math.abs(d) < 0.005) return { tipo: 'igual' };
  const tipo = d > 0 ? 'sube' : 'baja';
  const lectura = sentido === 'neutro' ? 'neutra' : tipo === 'sube' ? 'buena' : 'mala';
  return { tipo, puntos: Math.abs(d), lectura };
}

/**
 * En qué paso cae una señal, por su entidad (CV15-19). Las familias de entrada van a Landing, porque el reparto
 * vive en su cajón; el formulario, a Formulario. Ninguna regla apunta hoy a la Agenda.
 */
export function pasoDeLaSenal(entidad: { tipo: string; id: string }): ClaveDePaso | null {
  if (entidad.tipo === 'familia_de_entrada') return 'sesiones';
  if (entidad.tipo === 'funnel' && entidad.id === 'formulario') return 'form';
  return null;
}

const SIN: Variacion = { tipo: 'sin_comparacion' };
const SIN_PUNTOS: VariacionEnPuntos = { tipo: 'sin_comparacion' };

/** Una métrica que no tiene fuente: «—», sin flecha. */
const hueco = (clave: ClaveDeMetrica): MetricaDelPaso => ({ clave, valor: null, unidad: 'proporcion', deMeta: false, variacion: null });

/**
 * La porción de la familia `landing` en una cohorte, la que publica `recorridoDelLead`. Se publica sin piso: es un
 * conteo sobre otro (CV15-12). Sin la familia en la cohorte es cero; sin cohorte, no hay porción.
 */
function porcionDeLaLanding(r: Pick<RecorridoDeLosLeads, 'filas' | 'cohorte'> | null): number | null {
  if (r === null || r.cohorte === 0) return null;
  return r.filas.find((f) => f.familia === 'landing')?.porcion ?? 0;
}

export interface EntradaDeLosPasos {
  ventana: DiasDeCalendario;
  anterior: DiasDeCalendario | null;
  sinComparacion: SinComparacionDeConversion | null;
  actual: PersonasDeLaCohorte;
  /** La anterior, contada a la misma edad. `null` si no se compara. */
  previa: PersonasDeLaCohorte | null;
  recorrido: Pick<RecorridoDeLosLeads, 'filas' | 'cohorte' | 'cobertura'>;
  recorridoAnterior: Pick<RecorridoDeLosLeads, 'filas' | 'cohorte'> | null;
  formulario: Pick<EmbudoDelFormulario, 'cobertura' | 'finalizacion' | 'corte' | 'campoDelFormulario'>;
  hayCampoDeConfirmacion: boolean;
  /**
   * `anterior` nulo si no hay una anterior que sirva: en «Hoy» y «Completo», con la actual sin dato, o porque el gasto
   * o el desglose no lo permiten —el porqué va en `motivo` cuando se sabe—. Con la anterior en cero tampoco
   * hay flecha: no hay porcentaje contra cero. Comparan por su cuenta, aunque las personas no: no son personas, y lo
   * que las hace comparables es el gasto, no la lectura de contactos.
   */
  vistas: { actual: number | null; anterior: number | null; motivo: MotivoDeLasVistas | null };
  sinAlta: number | null;
}

/** Toda la pantalla, desde lo leído. Sin base: la prueba la arma con números a mano. */
export function armarPasos(e: EntradaDeLosPasos): PasosDeConversion {
  const cohorte = e.recorrido.cohorte;
  const compara = e.sinComparacion === null && e.previa !== null;
  const p = e.previa;

  /* Los agendados son la suma de las filas del reparto, no un segundo conteo: así la tarjeta suma exactamente
     lo que dice la tabla del cajón de Landing (CV15-15). */
  const agendados = e.recorrido.filas.reduce((s, f) => s + f.agendaron, 0);
  /* Los calificados salen de otra sentencia: si algo cambió entre las dos, que no aparezcan más calificados que
     agendados ni una resta negativa. */
  const calificados = Math.min(e.actual.calificados, agendados);
  const noCalificados = agendados - calificados;

  const comparaAgendados = compara && p !== null && p.conCitasCongeladas === 0;
  const tasaDeAgenda = tasa(agendados, cohorte);
  const variacionDeAgendados = comparaAgendados ? variacion(agendados, p!.agendados, 'mas_es_mejor') : SIN;
  const variacionDeLaTasa = comparaAgendados
    ? variacionEnPuntos(tasaDeAgenda, tasa(p!.agendados, p!.contactos), 'mas_es_mejor')
    : SIN_PUNTOS;

  const contactos = { valor: cohorte, variacion: compara ? variacion(cohorte, p!.contactos, 'mas_es_mejor') : SIN };

  const vistas = {
    valor: e.vistas.actual,
    variacion: e.vistas.anterior !== null ? variacion(e.vistas.actual, e.vistas.anterior, 'mas_es_mejor') : SIN,
    motivo: e.vistas.motivo,
  };

  /* La porción compara como toda proporción sobre la cohorte: con las dos cohortes en el piso (CV15-20). Se publica
     sin él, pero una flecha contra seis contactos se mueve diecisiete puntos con uno solo. */
  const porcion = porcionDeLaLanding(e.recorrido);
  const comparaLaPorcion =
    compara &&
    e.recorridoAnterior !== null &&
    e.recorrido.cohorte >= PISO_DE_UNA_TASA &&
    e.recorridoAnterior.cohorte >= PISO_DE_UNA_TASA;
  const porLaLanding = {
    porcion,
    variacion: comparaLaPorcion
      ? variacionEnPuntos(porcion, porcionDeLaLanding(e.recorridoAnterior), 'neutro')
      : SIN_PUNTOS,
  };

  /* El formulario (CV15-14). Sin campo, o sin ningún día escrito, es un hueco. Con la ventana después del corte
     no hay a quién medir. Con la ventana cruzando el corte, la tasa es sobre la cohorte ANTERIOR al corte: la
     regla 2 del departamento prohíbe mezclar las dos épocas en una cifra. Nunca compara. */
  const corte = e.formulario.corte;
  const sinCampo = e.formulario.campoDelFormulario === null || corte.fecha === null;
  const conElCampo = !sinCampo && corte.laVentanaLoCruza ? e.formulario.cobertura.con : null;
  const sobreElCorte = conElCampo === null ? null : e.actual.hastaElCorte;
  const formulario = {
    valor: conElCampo,
    tasa: conElCampo === null ? null : tasa(conElCampo, sobreElCorte),
    finalizacion:
      conElCampo === null || e.formulario.finalizacion === null ? null : e.formulario.finalizacion / 100,
    corte: corte.fecha,
    laVentanaLoCruza: corte.laVentanaLoCruza,
  };

  /* Confirmados, sobre los calificados (`CV15-P10`): sobre los que respondieron daría 100 % cuando sólo
     responden los que confirman, y la mitad de los calificados no respondió. */
  const confirmados = e.hayCampoDeConfirmacion
    ? { valor: e.actual.confirmaron, respondieron: e.actual.respondieron, tasa: tasa(e.actual.confirmaron, calificados) }
    : { valor: null, respondieron: null, tasa: null };

  const cifras: CifrasDeConversion = {
    contactos,
    vistas,
    formulario,
    agendados: {
      valor: agendados,
      tasa: tasaDeAgenda,
      variacion: variacionDeAgendados,
      variacionDeLaTasa,
      congeladasEnLaAnterior: compara && p !== null && p.conCitasCongeladas > 0,
    },
    calificados: { valor: calificados, tasa: tasa(calificados, agendados), deLaCohorte: tasa(calificados, cohorte) },
    noCalificados: { valor: noCalificados, tasa: tasa(noCalificados, agendados) },
    confirmados,
    cancelaron: { valor: e.actual.cancelaron, tasa: tasa(e.actual.cancelaron, calificados) },
    porLaLanding,
  };

  const pasos: Paso[] = [
    {
      clave: 'sesiones',
      estado: 'real',
      valor: cohorte,
      tasa: null,
      variacion: contactos.variacion,
      caida: null,
      metricas: [
        { clave: 'vistas', valor: vistas.valor, unidad: 'conteo', deMeta: true, variacion: vistas.variacion },
        { clave: 'porLaLanding', valor: porcion, unidad: 'proporcion', deMeta: false, variacion: porLaLanding.variacion },
      ],
      hastaElCorte: null,
    },
    {
      clave: 'vsl',
      estado: 'hueco',
      valor: null,
      tasa: null,
      variacion: null,
      caida: null,
      metricas: [hueco('vistoPromedio'), hueco('llegaAlCta')],
      hastaElCorte: null,
    },
    {
      clave: 'form',
      estado: sinCampo ? 'hueco' : 'historico',
      valor: formulario.valor,
      tasa: formulario.tasa,
      variacion: null,
      caida: conElCampo === null || sobreElCorte === null ? null : sobreElCorte - conElCampo,
      metricas: [
        { clave: 'loCompletan', valor: formulario.finalizacion, unidad: 'proporcion', deMeta: false, variacion: null },
        hueco('tiempoMedio'),
      ],
      hastaElCorte: sinCampo ? null : corte.fecha,
    },
    {
      clave: 'agenda',
      estado: 'real',
      valor: agendados,
      tasa: tasaDeAgenda,
      variacion: variacionDeLaTasa,
      caida: cohorte - agendados,
      metricas: [
        { clave: 'calificados', valor: cifras.calificados.tasa, unidad: 'proporcion', deMeta: false, variacion: null },
        { clave: 'confirmados', valor: confirmados.tasa, unidad: 'proporcion', deMeta: false, variacion: null },
      ],
      hastaElCorte: null,
    },
    {
      clave: 'gracias',
      estado: 'hueco',
      valor: null,
      tasa: null,
      variacion: null,
      caida: null,
      metricas: [hueco('dePlay'), hueco('videoVisto')],
      hastaElCorte: null,
    },
  ];

  return {
    ventana: e.ventana,
    anterior: compara ? e.anterior : null,
    sinComparacion: e.sinComparacion,
    cifras,
    pasos,
    cobertura: e.recorrido.cobertura,
    sinAlta: e.sinAlta,
  };
}

// ─── La lectura ─────────────────────────────────────────────────────────────

const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

/**
 * Una pasada por la cohorte de la ventana: agendó, calificó, confirmó, canceló, y las citas congeladas.
 *
 * @param edad Si se pide, agendó y calificó A ESA EDAD (`tieneCitaAlcanzable`): la ventana anterior.
 * @param corte El último día con el formulario escrito, para contar la cohorte hasta él. `null`: cero.
 * @param campoDeConfirmacion El identificador del campo en el CRM. `null`: sin campo, cero confirmados.
 */
export async function personasDeLaCohorte(
  ventana: DiasDeCalendario,
  edad: number | null,
  corte: string | null,
  campoDeConfirmacion: string | null,
): Promise<PersonasDeLaCohorte> {
  const calificado = esCalificado('c', edad);
  const respondio = campoDeConfirmacion === null ? sql<boolean>`false` : respondioLaConfirmacion('c', campoDeConfirmacion);
  const confirmo = campoDeConfirmacion === null ? sql<boolean>`false` : confirmoElAgendamiento('c', campoDeConfirmacion);
  const r = await sql<Record<string, string | null>>`
    select count(*) as contactos,
           count(*) filter (where ${tieneCitaAlcanzable('c', edad)}) as agendados,
           count(*) filter (where ${calificado}) as calificados,
           count(*) filter (where ${calificado} and ${respondio}) as respondieron,
           count(*) filter (where ${calificado} and ${confirmo}) as confirmaron,
           count(*) filter (where ${calificado} and ${todasSusCitasCanceladas('c')}) as cancelaron,
           count(*) filter (where ${corte}::date is not null and c.alta_en_el_crm < (${corte}::date + 1)) as hasta_el_corte,
           count(*) filter (where exists (
             select 1 from negocio.citas cc
              where cc.org_id = c.org_id and cc.contacto_id = c.id and cc.ghl_calendario_id is null)) as congeladas
      from negocio.contactos c
     where ${cohorteEntre('c', ventana)}`.execute(datos());
  const f = r.rows[0] ?? {};
  return {
    contactos: n(f.contactos),
    agendados: n(f.agendados),
    calificados: n(f.calificados),
    respondieron: n(f.respondieron),
    confirmaron: n(f.confirmaron),
    cancelaron: n(f.cancelaron),
    hastaElCorte: n(f.hasta_el_corte),
    conCitasCongeladas: n(f.congeladas),
  };
}

/** Lo que se guardó de Meta en una ventana, para decidir si sus vistas se pueden publicar. */
export interface VistasGuardadas {
  /** Las filas de métricas de la ventana. Sin ninguna, no se sabe si hubo vistas: decide la cuenta. */
  filas: number;
  /** Las filas que entregaron y no traen desglose: con alguna, la suma sería la de una parte. */
  sinDesglose: number;
  /** La suma de `landingPageView` de las filas con desglose. */
  vistas: number;
  /** El primer día con desglose guardado, de todas las métricas: si es posterior al comienzo, no cubre la ventana. */
  desgloseDesde: string | null;
}

/**
 * Las vistas de landing de la ventana, contadas por Meta (`landingPageView`), de todas las campañas. La clave es la
 * que lee Creative, y `omniLandingPageView`, que llega con el mismo valor, no se suma. Qué se publica lo decide
 * `vistasDeLaVentana`.
 */
export async function vistasDeLaLanding(ventana: DiasDeCalendario): Promise<VistasGuardadas> {
  const r = await sql<{ filas: string; sin_desglose: string; vistas: string | null; desglose_desde: string | null }>`
    select count(*) as filas,
           count(*) filter (where coalesce(m.impresiones, 0) > 0 and m.acciones is null) as sin_desglose,
           sum((m.acciones->>'landingPageView')::numeric) as vistas,
           (select to_char(min(fecha), 'YYYY-MM-DD') from negocio.metricas_de_anuncio where acciones is not null) as desglose_desde
      from negocio.metricas_de_anuncio m
      join negocio.anuncios a on a.org_id = m.org_id and a.meta_anuncio_id = m.meta_anuncio_id
     where m.fecha between ${ventana.desde}::date and ${ventana.hasta}::date
       and a.meta_campana_id is not null`.execute(datos());
  const f = r.rows[0]!;
  return { filas: n(f.filas), sinDesglose: n(f.sin_desglose), vistas: n(f.vistas), desgloseDesde: f.desglose_desde };
}

/**
 * Las vistas que se pueden publicar de una ventana. Es la regla de los clics de Acquisition (A14-05) con dos
 * diferencias, una para cada lado:
 *
 *   · **más estricta**: si el desglose no la cubre —empezó después, o alguna fila que entregó no lo trae—, no se
 *     publican (`sin_desglose`): serían las de una parte. Acquisition publica esa suma y cobra el clic sólo a las
 *     filas con desglose, porque el costo la acota; acá la cifra está sola;
 *   · con filas, la suma; si ninguna entregó, cero;
 *   · **menos estricta**: sin ninguna fila, Acquisition dice siempre «—»; acá, cero si la cuenta midió el cero esos
 *     días —todos cerrados y enteros, con el total en cero—. Con la cuenta entera y gasto —un día declarado residuo
 *     cuenta como entero, y sí gastó—, la cuenta cobró algo que ninguna campaña que tenemos explica: «—», con
 *     `no_cuadra`. Sin la cuenta entera, no se sabe: «Hoy» antes de la pasada de las 06:17 UTC, un día que el colector
 *     no leyó, o una empresa que nunca pautó; ese motivo depende del período y de si la empresa pautó alguna vez, y lo
 *     decide `lecturaDeConversion`.
 */
async function vistasDeLaVentana(
  ventana: DiasDeCalendario,
  dias: number,
  zona: string,
): Promise<{ valor: number | null; motivo: MotivoDeLasVistas | null }> {
  const g = await vistasDeLaLanding(ventana);
  if ((g.desgloseDesde !== null && g.desgloseDesde > ventana.desde) || g.sinDesglose > 0) {
    return { valor: null, motivo: 'sin_desglose' };
  }
  if (g.filas > 0) return { valor: g.vistas, motivo: null };
  const cuenta = await coberturaDelGasto(ventana.desde, ventana.hasta, dias, zona);
  if (!cuenta.entero) return { valor: null, motivo: null };
  return cuenta.deLaCuenta === 0 ? { valor: 0, motivo: null } : { valor: null, motivo: 'no_cuadra' };
}

/**
 * Lo que lee la pantalla, con lo que necesita quien compara contra la anterior. Los pasos los dibuja la
 * pantalla; el reparto y el formulario van en sus cajones. Corre dentro de `conOrganizacion`.
 */
export interface LecturaDeConversion {
  pasos: PasosDeConversion;
  recorrido: RecorridoDeLosLeads;
  formulario: EmbudoDelFormulario;
  /** El reparto de la ventana anterior. `null` si no se compara. */
  recorridoAnterior: RecorridoDeLosLeads | null;
  ventana: DiasDeCalendario;
  anterior: DiasDeCalendario | null;
}

export async function lecturaDeConversion(
  periodo: { clave: ClaveDePeriodo; dias: number },
  /** La zona de la empresa (`identidad.organizaciones.zona_horaria`): cuándo termina su día. */
  zona: string,
): Promise<LecturaDeConversion> {
  /* El primer dato propio es el primer contacto con fecha de alta: «Completo» empieza ahí, o en el primer día de
     gasto si fuera anterior (`bordesDelPeriodo`). */
  const primero = (
    await sql<{ desde: string | null }>`
      select to_char(min(alta_en_el_crm)::date, 'YYYY-MM-DD') as desde from negocio.contactos`.execute(datos())
  ).rows[0]?.desde ?? null;
  const b = await bordesDelPeriodo(periodo, zona, primero);

  const recorrido = await recorridoDelLead(periodo.dias, b.ventana);
  const formulario = await embudoDelFormulario(periodo.dias, b.ventana);
  const campoDeConfirmacion = await campoPorNombre(CAMPO_DE_CONFIRMACION);
  const actual = await personasDeLaCohorte(b.ventana, null, formulario.corte.fecha, campoDeConfirmacion);

  /* Si se compara (CV15-20). La frescura se importa al usarla, como en los detectores: con una importación
     estática, `frescura → barrido → correr → detectores` cerraría un ciclo el día que un detector use esto. */
  let sinComparacion: SinComparacionDeConversion | null = null;
  let anterior: DiasDeCalendario | null = null;
  if (!b.cerrados) {
    sinComparacion = 'periodo';
  } else {
    const { frescuraDe } = await import('./frescura.ts');
    const alDia = (await frescuraDe('contactos')).estado === 'al_dia' && (await frescuraDe('citas')).estado === 'al_dia';
    if (!alDia) sinComparacion = 'faltan_contactos';
    else if (primero !== null && primero > b.anteriorCandidata.desde) sinComparacion = 'sin_historia';
    else anterior = b.anteriorCandidata;
  }

  // La anterior, a la MISMA edad que la actual: sus contactos llevan `dias` días más en la base.
  const previa = anterior === null ? null : await personasDeLaCohorte(anterior, periodo.dias, null, campoDeConfirmacion);
  const recorridoAnterior = anterior === null ? null : await recorridoDelLead(periodo.dias, anterior);

  /* Las vistas (CV15-07). No son personas, así que comparan por su cuenta, contra la anterior del mismo largo, aunque
     las personas no comparen: con 7 y 30 días, el gasto entero en las dos ventanas —un día que cuadra con la cuenta
     prueba que se leyeron todas las campañas que gastaron, y las acciones viven en esas mismas filas— y el desglose
     completo en la anterior. */
  const va = await vistasDeLaVentana(b.ventana, b.dias, zona);
  const vistasActual = va.valor;
  let vistasAnterior: number | null = null;
  let motivo: MotivoDeLasVistas | null = va.motivo;
  if (b.cerrados && vistasActual !== null) {
    const candidata = b.anteriorCandidata;
    if (b.colectorAtrasado) {
      motivo = 'colector_atrasado';
    } else {
      const cuentaActual = await coberturaDelGasto(b.ventana.desde, b.ventana.hasta, b.dias, zona);
      const cuentaAnterior = await coberturaDelGasto(candidata.desde, candidata.hasta, b.dias, zona);
      if (cuentaActual.motivo !== null) motivo = cuentaActual.motivo;
      else if (cuentaAnterior.motivo !== null) motivo = cuentaAnterior.motivo;
      else {
        const vp = await vistasDeLaVentana(candidata, b.dias, zona);
        if (vp.motivo !== null) motivo = vp.motivo;
        else vistasAnterior = vp.valor;
      }
    }
  } else if (b.cerrados && vistasActual === null && motivo === null) {
    /* Sin ninguna fila y sin un cero medido: con el colector atrasado o con días sin leer, la nota lo dice (CV15-02).
       A una empresa que nunca pautó no le falta nada que leer, y no se le dice nada. */
    if (b.colectorAtrasado) motivo = 'colector_atrasado';
    else if ((await estadoDeLaSerie(zona)).hayDatos) {
      motivo = (await coberturaDelGasto(b.ventana.desde, b.ventana.hasta, b.dias, zona)).motivo;
    }
  }

  const sinAlta =
    periodo.clave === 'completo'
      ? n((await sql<{ n: string }>`select count(*) as n from negocio.contactos where alta_en_el_crm is null`.execute(datos())).rows[0]?.n)
      : null;

  const pasos = armarPasos({
    ventana: b.ventana,
    anterior,
    sinComparacion,
    actual,
    previa,
    recorrido,
    recorridoAnterior,
    formulario,
    hayCampoDeConfirmacion: campoDeConfirmacion !== null,
    vistas: { actual: vistasActual, anterior: vistasAnterior, motivo },
    sinAlta,
  });
  return { pasos, recorrido, formulario, recorridoAnterior, ventana: b.ventana, anterior };
}

/** Sólo los pasos, para quien no compara. Corre dentro de `conOrganizacion`. */
export async function pasosDeConversion(
  periodo: { clave: ClaveDePeriodo; dias: number },
  zona: string,
): Promise<PasosDeConversion> {
  return (await lecturaDeConversion(periodo, zona)).pasos;
}
