// La LECTURA de la pantalla del técnico desde el navegador, y lo que el cliente agrupa.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL CLIENTE AGRUPA Y CUENTA. NO RECIBE UN CONTADOR.
//
// El servidor manda **un caso por hallazgo**, con el diagnóstico y la corrección de su patrón ya
// resueltos. Acá se agrupan por código y el contador de casos es `casos.length`.
//
// Con el conteo calculado del otro lado y la lista traída aparte, los dos pueden discrepar —un tope,
// un filtro de más— y la pantalla diría *«×15 casos»* mostrando tres. Agrupando acá, el número **no
// puede** dejar de coincidir con lo que se ve: es la misma lista.
//
// Y lo que el servidor sí decide es **qué texto gana**, porque eso es una decisión y no un dato: el
// diagnóstico y la corrección son del PATRÓN, y quince casos traen quince redacciones de lo mismo.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedir } from '../http/cliente.ts';
import type { CasoDelPatron, LaPantalla } from './pantalla.ts';
import type { Agente } from './veredicto.ts';

const RUTA = '/api/auditoria';

export type ResultadoDeLaPantalla =
  | { tipo: 'datos'; pantalla: LaPantalla & { prompts: PromptEnLaPantalla[] } }
  | { tipo: 'fallo'; mensaje: string };

export interface PromptEnLaPantalla {
  agente: Agente;
  /** `null` = esa empresa no le cargó prompt a ese agente. **Es un estado normal.** */
  texto: string | null;
  actualizadoEl: string | null;
}

export async function leerLaPantalla(): Promise<ResultadoDeLaPantalla> {
  const r = await pedir<LaPantalla & { prompts: PromptEnLaPantalla[] }>(RUTA);
  if (r.tipo === 'datos') return { tipo: 'datos', pantalla: r.datos };
  /* Los dos fallos se distinguen, igual que en el panel de monitoreo: «el servidor dijo que no» y «no
     se pudo llegar al servidor» mandan a mirar dos cosas distintas. */
  if (r.tipo === 'rechazado') {
    return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo leer la auditoría de los agentes.' };
  }
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para leer la auditoría de los agentes.' };
}

/** Guarda el prompt de un agente. **Un texto vacío lo BORRA.** */
export async function guardarElPrompt(
  agente: Agente,
  texto: string,
): Promise<{ tipo: 'ok'; que: string } | { tipo: 'fallo'; mensaje: string }> {
  const r = await pedir<{ que: string }>(`${RUTA}/prompts`, {
    metodo: 'PUT',
    cuerpo: { agente, texto },
  });
  if (r.tipo === 'datos') return { tipo: 'ok', que: r.datos.que };
  if (r.tipo === 'rechazado') {
    return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo guardar el prompt.' };
  }
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para guardar el prompt.' };
}

/** Un patrón: su código, sus casos, y el texto que gana. */
export interface PatronAgrupado {
  patron: string;
  agente: Agente;
  /** **El contador es esto.** No viaja un número al lado: es la longitud de la lista. */
  casos: CasoDelPatron[];
  /** Del caso más reciente, que es el que el servidor eligió como ganador del patrón. */
  diagnostico: string | null;
  correccion: string;
  fragmentoPrompt: string | null;
  promptSeccion: string | null;
  elPromptCambio: boolean;
  /** La severidad más grave entre sus casos. Un patrón con un rojo es un patrón rojo. */
  severidad: string | null;
}

/**
 * Agrupa los casos por código de patrón, **el de más casos primero**.
 *
 * ── EL ORDEN ES POR CANTIDAD Y NO POR FECHA, Y ES LA DECISIÓN DE LA PANTALLA ──
 *
 * Todo el sentido del código de patrón es que quince casos del mismo problema se vean como **una**
 * fila que dice «×15» en vez de quince filas sueltas. Ordenando por fecha, el problema que ocurre
 * quince veces queda mezclado entre los que ocurrieron una, y la pantalla vuelve a ser la lista que
 * el agrupamiento vino a reemplazar.
 *
 * El desempate es por el caso más reciente: entre dos patrones con un caso cada uno, primero el de
 * hoy.
 */
export function agruparPorPatron(casos: readonly CasoDelPatron[]): PatronAgrupado[] {
  const porCodigo = new Map<string, PatronAgrupado>();

  for (const c of casos) {
    const ya = porCodigo.get(c.patron);
    if (ya === undefined) {
      porCodigo.set(c.patron, {
        patron: c.patron,
        agente: c.agente,
        casos: [c],
        diagnostico: c.diagnostico,
        correccion: c.correccion,
        fragmentoPrompt: c.fragmentoPrompt,
        promptSeccion: c.promptSeccion,
        elPromptCambio: c.elPromptCambio,
        severidad: c.severidad,
      });
      continue;
    }
    ya.casos.push(c);
    /* La severidad del patrón es la MÁS GRAVE de sus casos, no la del primero. Un patrón con catorce
       amarillos y un rojo es un patrón rojo: lo que decide si el técnico lo mira hoy es el peor caso,
       no el más común. */
    if (c.severidad === 'rojo') ya.severidad = 'rojo';
  }

  return [...porCodigo.values()].sort((a, b) => {
    if (b.casos.length !== a.casos.length) return b.casos.length - a.casos.length;
    return (
      new Date(b.casos[0]!.detectadoEl).getTime() - new Date(a.casos[0]!.detectadoEl).getTime()
    );
  });
}

/** El nombre de cada agente para una persona. El interno no va a una pantalla. */
export const NOMBRE_DEL_AGENTE: Readonly<Record<Agente, string>> = {
  chat_post_agenda: 'Agente de post-agenda',
  chat_pre_agenda: 'Agente de pre-agenda',
};

/** Qué hace cada agente, en una línea. Es lo que vuelve legible una tarjeta sin datos. */
export const QUE_HACE_EL_AGENTE: Readonly<Record<Agente, string>> = {
  chat_post_agenda: 'Acompaña al contacto que ya agendó, hasta la llamada',
  chat_pre_agenda: 'Califica al contacto y consigue la cita',
};

/**
 * Por qué esta empresa no audita, en palabras y **con la acción que lo arregla**.
 *
 * Los tres textos dicen QUÉ hacer, no solo qué falta. Un estado sin salida —«no se puede auditar»— es
 * lo que el `03` § 5 prohíbe, y acá sería fácil de escribir porque las tres frases suenan completas
 * sin el segundo pedazo.
 */
export const POR_QUE_NO_AUDITA: Readonly<Record<string, string>> = {
  auditor_apagado:
    'El auditor está apagado para esta empresa. Se enciende en Integraciones; los análisis que ya ' +
    'hay se siguen viendo acá.',
  sin_clave_ia:
    'Falta la llave de IA de esta empresa. Se carga en Integraciones, y sin ella no se puede ' +
    'auditar ninguna conversación.',
  sin_id_del_agente:
    'Falta el identificador del agente de IA en el CRM. Se carga en Integraciones: sin él no se ' +
    'puede saber qué líneas de la conversación escribió el agente y cuáles una automatización.',
};
