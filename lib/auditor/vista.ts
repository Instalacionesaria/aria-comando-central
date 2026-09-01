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
import { AGENTES, type Agente } from './veredicto.ts';

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

/**
 * El nombre de cada agente **con el que la gente lo llama**, que es el del CRM.
 *
 * ── DECÍA «AGENTE DE POST-AGENDA», Y ESO NO SE USA EN NINGUNA CONVERSACIÓN ──
 *
 * `chat_pre_agenda` y `chat_post_agenda` son buenos nombres INTERNOS: dicen dónde del embudo
 * trabaja cada uno y por eso el código los usa. Pero nadie los dice en voz alta. En GoHighLevel las
 * etiquetas son `bot_activado_leadflow` y `bot_activado_appflow`, y así se pidió verlos acá.
 *
 * El mapeo no se adivina: sale del contrato del CRM (`lib/ghl/contrato.ts`), donde
 * `bot_activado_leadflow` da el estado `atendiendo_pre_agenda` y `bot_activado_appflow` da
 * `atendiendo_post_agenda`. O sea **LeadFlow = pre-agenda = zona del Setter** y **AppFlow =
 * post-agenda = zona del Closer**, que es exactamente como se pidió.
 *
 * Es un `Record` sobre el enumerado, así que un agente nuevo sin nombre no compila. Un objeto
 * suelto lo dibujaría con su clave interna en pantalla.
 */
export const NOMBRE_DEL_AGENTE: Readonly<Record<Agente, string>> = {
  chat_pre_agenda: 'LeadFlow',
  chat_post_agenda: 'AppFlow',
};

/**
 * La zona de trabajo que atiende cada agente.
 *
 * Va al lado del nombre y no es decoración: «LeadFlow» y «AppFlow» no dicen a quién le hablan, y
 * la pregunta que sigue siempre es la misma —*¿este es el de los que ya agendaron?*—. Con la zona
 * al lado, la tarjeta se lee sin preguntar.
 *
 * Y ata esta pantalla a las otras dos: quien mira los hallazgos de AppFlow sabe que las urgencias
 * que produce caen en la cola del **Closer**, no en la del Setter.
 */
export const ZONA_DEL_AGENTE: Readonly<Record<Agente, string>> = {
  chat_pre_agenda: 'Zona Setter',
  chat_post_agenda: 'Zona Closer',
};

/** Qué hace cada agente, en una línea. Es lo que vuelve legible una tarjeta sin datos. */
export const QUE_HACE_EL_AGENTE: Readonly<Record<Agente, string>> = {
  chat_pre_agenda: 'Califica al contacto y consigue la cita',
  chat_post_agenda: 'Acompaña al que ya agendó, hasta la llamada',
};

/**
 * En qué orden se dibujan los agentes: **el del embudo.** Primero el que consigue la cita, después
 * el que la acompaña.
 *
 * ── SE DERIVA DE `AGENTES`, Y ESO ES LO QUE LA HACE SEGURA ────────────────
 *
 * Escribir el arreglo a mano sería más corto y traería el defecto `4.1` del origen —*«la causa es
 * una lista escrita a mano»*—: un agente nuevo que alguien agregue a `AGENTES` **no aparecería en
 * esta pantalla**, sin que nada falle. Sus análisis existirían y nadie los vería.
 *
 * Así, el orden es un `Record` sobre el enumerado —un agente sin rango no compila— y la LISTA sale
 * de `AGENTES`, así que ninguno se puede quedar afuera.
 */
const RANGO_DEL_AGENTE: Readonly<Record<Agente, number>> = {
  chat_pre_agenda: 1,
  chat_post_agenda: 2,
};

export const ORDEN_DE_LOS_AGENTES: readonly Agente[] = [...AGENTES].sort(
  (a, b) => RANGO_DEL_AGENTE[a] - RANGO_DEL_AGENTE[b],
);

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
