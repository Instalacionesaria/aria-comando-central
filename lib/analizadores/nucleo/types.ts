// ── NÚCLEO PORTADO DE ARIA BRAIN · los identificadores siguen en inglés a propósito ──
// Son el contrato con el modelo (los nombres de campo del esquema van en el prompt) y con el JSON
// guardado en el historial copiado: traducirlos cambiaría los prompts. Ver docs/ANALIZADORES.md.
// Origen: aria-ia-brain lib/analyzer/types.ts, copiado byte a byte. Única edición: `.ts` en los imports.
//
// Tipos base del subsistema Analizador (OB/HT), portados de platform/platform2
// (src/providers/types.ts). El brain los reutiliza sin cambios.

export type TipoLlamada = 'OB' | 'HT';

export interface NormalizedSegment {
  startSec: number;
  endSec: number;
  speaker: string;
  text: string;
}

export interface NormalizedTranscript {
  externalMeetingId: string;
  language: string;
  segments: NormalizedSegment[];
  fullText: string;
}

export interface MeetingPerson {
  name?: string;
  email?: string;
  role?: string;
}

export interface NormalizedMeeting {
  externalMeetingId: string;
  title?: string;
  organizer?: MeetingPerson;
  invitees?: MeetingPerson[];
  organizerEmail?: string;
  prospectName?: string;
  prospectEmail?: string;
  happenedAt?: string; // ISO (sin Date para serializar fácil)
  durationSec?: number;
  meetingUrl?: string; // link a la grabación en tl;dv (campo `url` de la API)
  providerMeta?: Record<string, unknown>; // extraProperties y lo que el proveedor sume
}

// Análisis DERIVADO: corre sobre una llamada YA analizada, con la misma
// transcripción, para extraer otra cosa. Hoy solo la ficha del prospecto (HT).
export type InsightKind = 'PROSPECT_CARD';
