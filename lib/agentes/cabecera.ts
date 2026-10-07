// El comentario de la cabecera de un departamento: una línea, de reglas, sin modelo (AG15 de los agentes;
// `docs/OTROS/agentes/04-LA-REUNION-Y-LA-CABECERA.md`, AG-77 a AG-79; `fichas/F18-EL-COMENTARIO-DE-LA-CABECERA.md`).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PRIORIDAD, Y LA REGLA DEL SILENCIO
//
//   1. Lo que falta configurar, dicho por su consecuencia, con lo que la ruta de la pantalla ya resuelve: la
//      frescura de lo que la pantalla lee, o por qué el auditor no audita. La ruta no suma identidad sólo
//      para esto (AG-77.1).
//   2. La señal abierta más grave del departamento, si es crítica o alta: de las dos ventanas, la crítica
//      antes que la alta y, entre iguales, la que más contactos pierde.
//   3. Una regla medible de la Reunión de HOY de esa sección (las `REU-…`, no las señales que la Reunión ya
//      trae): sale de la fila que guardó la pasada, no se vuelve a medir.
//   4. Nada. Sin una de las anteriores no se dibuja nada (`docs/OTROS/estado actual/07-REGLAS-TRANSVERSALES.md`).
//
// ── SALES (2026-10-07) ───────────────────────────────────────────────────
//
// Sales no tiene señales. En Closer, la regla es la suya y no la de la Reunión: las citas que ya ocurrieron y
// nadie registró, con el MISMO alcance que las colas de Mi Día (las de los contactos asignados al closer que se
// mira, o las de la empresa) y la misma ventana y el mismo predicado con que Avanzar ofrece cerrarlas
// (`citaCerrable`, `DIAS_DE_LA_TASA`). La de la Reunión cuenta contactos de la empresa entera, y a un closer con
// alcance propio le diría lo de los demás. En Llamadas de venta, la regla de la Reunión de hoy de esa sección. El
// Setter no tiene nada medible: calla.
//
// Lo que falta en Fundaciones (la cuarta fuente del diseño) no está: Research y Marketing esperan la rama de ICP
// & Oferta, y sus pantallas no tienen todavía un GET que lo sirva (`10-LO-QUE-QUEDA-PARA-DESPUES.md`).
//
// **Corre dentro de `conOrganizacion(`**: lo llama el GET de cada pantalla, en su transacción.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { enPalabras, frescuraDe, type Frescura } from '../negocio/frescura.ts';
import { citaCerrable } from '../negocio/citasAlcanzables.ts';
import { DIAS_DE_LA_TASA } from '../negocio/indicadoresDeCitas.ts';
import type { AlcanceDelCloser } from '../negocio/alcanceDelCloser.ts';
import { diaEnZona } from '../negocio/tiempo.ts';
import { ventanaDeMetricas } from '../negocio/costoDelAnuncio.ts';
import { diasSinCuadrar } from '../negocio/gastoDeLaCuenta.ts';
import type { PorQueNoAudita } from '../auditor/pantalla.ts';
import { senalesDeLaPantalla, type SenalParaMostrar } from './senales/lectura.ts';
import type { DepartamentoConSenales } from './senales/tipos.ts';
import { temasEnSuOrden, ultimaReunion } from './reunion/guardar.ts';
import { DE_CADA_DEPARTAMENTO } from './reunion/temas.ts';

export type FuenteDelComentario = 'configurar' | 'senal' | 'regla';

export interface ComentarioDeLaCabecera {
  texto: string;
  fuente: FuenteDelComentario;
}

export interface FuentesDeLaCabecera {
  /** 1. Lo que falta configurar, ya dicho; `null` si no falta nada. */
  falta: string | null;
  /** 2. Las señales del departamento, de las dos ventanas. */
  senales: readonly Pick<SenalParaMostrar, 'gravedad' | 'estado' | 'nombre' | 'texto' | 'perdidaContactos'>[];
  /** 3. El texto de una regla de la Reunión de hoy de esa sección; `null` si no hay. */
  regla: string | null;
}

/** La línea de la cabecera, o `null`: la regla del silencio. Pura. */
export function comentarioDeLaCabecera(f: FuentesDeLaCabecera): ComentarioDeLaCabecera | null {
  if (f.falta) return { texto: f.falta, fuente: 'configurar' };
  const grave = f.senales
    .filter((s) => s.estado !== 'sin_medicion' && (s.gravedad === 'critica' || s.gravedad === 'alta'))
    .sort((a, b) => (a.gravedad === b.gravedad ? (b.perdidaContactos ?? -1) - (a.perdidaContactos ?? -1) : a.gravedad === 'critica' ? -1 : 1))[0];
  if (grave) return { texto: grave.nombre ? `${grave.nombre}: ${grave.texto}` : grave.texto, fuente: 'senal' };
  if (f.regla) return { texto: f.regla, fuente: 'regla' };
  return null;
}

/** Lo que falta por la frescura de lo que la pantalla lee, en una línea; `null` al día. Pura. */
export function faltaPorFrescura(f: Frescura, que: string): string | null {
  if (f.estado === 'nunca') return `${mayuscula(que)} nunca corrió sola en esta empresa: lo de esta pantalla no se renueva.`;
  if (f.estado === 'fallando') return `${mayuscula(que)} falló la última vez, hace ${enPalabras(f.minutos ?? 0)}: puede haber datos sin traer.`;
  if (f.estado === 'atrasada') return `Sin datos nuevos: ${que} no corre desde hace ${enPalabras(f.minutos ?? 0)}.`;
  return null;
}

/**
 * Lo que falta cuando la cuenta de Meta gastó más de lo que suman sus campañas leídas (`076`), en una línea;
 * `null` si todo cuadra. Pura. Va en la cabecera de Acquisition y de Creative con la prioridad de lo que falta
 * configurar: mientras el relleno busca qué campaña gastó, los costos y las partes del gasto salen cortos.
 */
export function faltaPorCuadre(diasSinCuadrar: number): string | null {
  if (diasSinCuadrar <= 0) return null;
  return (
    `En ${diasSinCuadrar === 1 ? 'un día' : `${diasSinCuadrar} días`} de la última semana la cuenta de Meta gastó más ` +
    'de lo que suman sus campañas leídas: el gasto que falta se está buscando cada hora.'
  );
}

/** Los días de la semana que mira la cabecera para el cuadre: la misma que la ventana corta de las pantallas. */
const DIAS_DEL_CUADRE = 7;

/** Por qué el auditor no audita, en una línea. La pantalla de Conversation ya lo dice en detalle. */
export const FALTA_DEL_AUDITOR: Readonly<Record<PorQueNoAudita, string>> = {
  auditor_apagado: 'El auditor está apagado: las conversaciones de los agentes no se revisan.',
  sin_clave_ia: 'El auditor no audita: falta la llave de IA de la empresa.',
  sin_id_del_agente: 'El auditor no audita: falta el identificador del agente que audita.',
};

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Lo que cada pantalla lee del barrido, para la frescura: la tarea y cómo se dice. */
export const LO_QUE_LEE: Readonly<Record<Exclude<DepartamentoConSenales, 'conversation'>, { tarea: 'anuncios' | 'contactos'; que: string }>> = {
  acquisition: { tarea: 'anuncios', que: 'la lectura del costo de los anuncios' },
  creative: { tarea: 'anuncios', que: 'la lectura del costo de los anuncios' },
  conversion: { tarea: 'contactos', que: 'la lectura de los contactos' },
};

/**
 * Junta las fuentes y devuelve la línea. `falta`, si la ruta ya la resolvió (el auditor); si no, la frescura de
 * lo que lee la pantalla.
 */
export async function comentarioDelDepartamento(
  departamento: DepartamentoConSenales,
  zona: string,
  falta: string | null = null,
): Promise<ComentarioDeLaCabecera | null> {
  const de = DE_CADA_DEPARTAMENTO[departamento];
  let faltaConFrescura = falta;
  if (faltaConFrescura === null && departamento !== 'conversation') {
    const lee = LO_QUE_LEE[departamento];
    faltaConFrescura = faltaPorFrescura(await frescuraDe(lee.tarea), lee.que);
  }
  // Y el gasto de las campañas contra el de la cuenta, en las dos pantallas que lo leen.
  if (faltaConFrescura === null && (departamento === 'acquisition' || departamento === 'creative')) {
    faltaConFrescura = faltaPorCuadre(await diasSinCuadrar((alias) => ventanaDeMetricas(alias, DIAS_DEL_CUADRE)));
  }
  const senales = [...(await senalesDeLaPantalla(departamento, '7d', de.texto)), ...(await senalesDeLaPantalla(departamento, '30d', de.texto))];
  return comentarioDeLaCabecera({ falta: faltaConFrescura, senales, regla: await reglaDeHoy(de.seccion, zona) });
}

/** El texto de una regla `REU-…` de la Reunión de HOY de esa sección, o `null`. La de ayer no habla. */
async function reglaDeHoy(seccion: string, zona: string): Promise<string | null> {
  const r = await ultimaReunion();
  if (!r || r.dia !== diaEnZona(new Date(), zona)) return null;
  return temasEnSuOrden(r).find((t) => t.seccion === seccion && t.regla.startsWith('REU-'))?.texto ?? null;
}

/** «3 citas que ya ocurrieron esperan…»: la regla del Closer, en una línea. Pura. */
export function textoDeCitasSinRegistrar(n: number): string | null {
  if (n <= 0) return null;
  return n === 1
    ? `Una cita de los últimos ${DIAS_DE_LA_TASA} días ya ocurrió y espera que se registre si el prospecto se presentó.`
    : `${n} citas de los últimos ${DIAS_DE_LA_TASA} días ya ocurrieron y esperan que se registre si el prospecto se presentó.`;
}

/**
 * Las citas que ya ocurrieron y nadie registró, con el alcance de quien mira: las mismas que Avanzar ofrece
 * cerrar, en su misma ventana.
 */
export async function citasSinRegistrar(alcance: AlcanceDelCloser): Promise<number> {
  const fila = await datos()
    .selectFrom('citas as ci')
    .innerJoin('contactos as c', 'c.id', 'ci.contacto_id')
    .select(sql<string>`count(*)::text`.as('n'))
    .where(citaCerrable('ci'))
    .where('ci.asistio', 'is', null)
    .where(sql<boolean>`ci.inicio_el >= now() - make_interval(days => ${DIAS_DE_LA_TASA})`)
    .$if(alcance.tipo === 'mio', (q) => q.where('c.crm_asignado_a', '=', (alcance as { crmUsuarioId: string }).crmUsuarioId))
    .executeTakeFirstOrThrow();
  return Number(fila.n);
}

/** El comentario de Closer: la lectura del calendario, y las citas sin registrar de su alcance. */
export async function comentarioDelCloser(alcance: AlcanceDelCloser): Promise<ComentarioDeLaCabecera | null> {
  return comentarioDeLaCabecera({
    falta: faltaPorFrescura(await frescuraDe('citas'), 'la lectura del calendario'),
    senales: [],
    regla: textoDeCitasSinRegistrar(await citasSinRegistrar(alcance)),
  });
}

/** El comentario de Llamadas de venta: el análisis de tl;dv, y la regla de la Reunión de hoy de su sección. */
export async function comentarioDeLasLlamadas(zona: string): Promise<ComentarioDeLaCabecera | null> {
  return comentarioDeLaCabecera({
    falta: faltaPorFrescura(await frescuraDe('analizadores'), 'el descubrimiento y el análisis de las llamadas de tl;dv'),
    senales: [],
    regla: await reglaDeHoy('analizadores', zona),
  });
}
