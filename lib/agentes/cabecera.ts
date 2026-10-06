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
// Lo que falta en Fundaciones (la cuarta fuente del diseño) no está: Research y Marketing esperan la rama
// de ICP & Oferta, y sus pantallas no tienen todavía un GET que lo sirva. Tampoco Sales: sus pestañas piden
// cada una lo suyo, y la regla de las citas sin registrar es de la empresa entera, que no es lo que ve un
// closer con alcance propio (`10-LO-QUE-QUEDA-PARA-DESPUES.md`).
//
// **Corre dentro de `conOrganizacion(`**: lo llama el GET de cada pantalla, en su transacción.
// ═══════════════════════════════════════════════════════════════════════════════

import { enPalabras, frescuraDe, type Frescura } from '../negocio/frescura.ts';
import { diaEnZona } from '../negocio/tiempo.ts';
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
  const senales = [...(await senalesDeLaPantalla(departamento, '7d', de.texto)), ...(await senalesDeLaPantalla(departamento, '30d', de.texto))];
  const r = await ultimaReunion();
  const regla =
    r && r.dia === diaEnZona(new Date(), zona) ? (temasEnSuOrden(r).find((t) => t.seccion === de.seccion && t.regla.startsWith('REU-'))?.texto ?? null) : null;
  return comentarioDeLaCabecera({ falta: faltaConFrescura, senales, regla });
}
