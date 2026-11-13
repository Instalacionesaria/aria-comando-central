// LA TRANSCRIPCIÓN DE FATHOM EN LA FORMA DE `negocio.transcripciones` (111).
//
// Fathom manda una línea por turno con su orador, su texto y SÓLO su inicio (`HH:MM:SS`, relativo al comienzo). La
// tabla guarda el texto entero y los turnos como `[{hablante, desde_seg, hasta_seg, texto}]`, que es lo que el Sales
// Coach usa para citar el momento exacto. El fin de cada turno es el inicio del siguiente; el del último, el fin de la
// grabación (o su propio inicio, si la duración no vino). Es la misma deducción que `fathomATranscripcion`, que queda
// para el analizador y no se toca.

import { segundosDeMarca, type FathomMeeting } from '../analizadores/nucleo/fathom.ts';

/** El tope de la columna `negocio.transcripciones.texto` (111). */
export const TOPE_DEL_TEXTO = 2_000_000;

export interface Turno {
  hablante: string;
  desde_seg: number;
  hasta_seg: number;
  texto: string;
}

export interface TranscripcionDeFathom {
  texto: string;
  segmentos: Turno[];
  idioma: string | null;
  /** El texto pasaba el tope de la columna y se cortó. */
  recortada: boolean;
}

/** La duración de la grabación en segundos, o `null` si no vino o no tiene sentido. */
export function duracionDe(reunion: FathomMeeting): number | null {
  if (!reunion.recording_start_time || !reunion.recording_end_time) return null;
  const s = (new Date(reunion.recording_end_time).getTime() - new Date(reunion.recording_start_time).getTime()) / 1000;
  return Number.isFinite(s) && s > 0 ? Math.round(s) : null;
}

/** La transcripción traducida, o `null` si no trae ninguna línea con texto. */
export function transcripcionDe(reunion: FathomMeeting): TranscripcionDeFathom | null {
  const lineas = (Array.isArray(reunion.transcript) ? reunion.transcript : []).filter(
    (t) => typeof t.text === 'string' && t.text.trim() !== '',
  );
  if (lineas.length === 0) return null;

  const fin = duracionDe(reunion);
  const segmentos: Turno[] = lineas.map((t, i) => {
    const desde = segundosDeMarca(t.timestamp);
    const siguiente = lineas[i + 1];
    const hasta = siguiente ? segundosDeMarca(siguiente.timestamp) : fin !== null && fin > desde ? fin : desde;
    return {
      hablante: t.speaker?.display_name?.trim() || 'Desconocido',
      desde_seg: desde,
      hasta_seg: Math.max(desde, hasta),
      texto: (t.text ?? '').trim(),
    };
  });

  const entero = segmentos.map((s) => `[${s.hablante}]: ${s.texto}`).join('\n');
  const recortada = entero.length > TOPE_DEL_TEXTO;
  return {
    texto: recortada ? entero.slice(0, TOPE_DEL_TEXTO) : entero,
    segmentos,
    idioma: typeof reunion.transcript_language === 'string' && reunion.transcript_language.trim() !== ''
      ? reunion.transcript_language.trim().slice(0, 20)
      : null,
    recortada,
  };
}
