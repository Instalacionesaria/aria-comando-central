// ── NÚCLEO PORTADO DE ARIA BRAIN · los identificadores siguen en inglés a propósito ──
// Son el contrato con el modelo (los nombres de campo del esquema van en el prompt) y con el JSON
// guardado en el historial copiado: traducirlos cambiaría los prompts. Ver docs/ANALIZADORES.md.
// Origen: aria-ia-brain lib/analyzer/transcript.ts. Ediciones: `.ts` en los imports y guardas de índice
// en `toSec` y en el bucle de líneas, que `noUncheckedIndexedAccess` exige. Sin cambio de comportamiento.
//
// Parseo/normalización de transcripciones. Puerto directo de
// platform2/src/lib/transcript.ts (idéntico al de platform).
import type { NormalizedSegment, NormalizedTranscript } from './types.ts';

function toSec(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parts = value.split(':').map(Number);
    if (parts.every((n) => Number.isFinite(n))) {
      const [a = 0, b = 0, c = 0] = parts;
      if (parts.length === 3) return a * 3600 + b * 60 + c;
      if (parts.length === 2) return a * 60 + b;
      if (parts.length === 1) return a;
    }
  }
  return 0;
}

function buildFullText(segments: NormalizedSegment[]): string {
  return segments.map((s) => `[${s.speaker}]: ${s.text}`).join('\n');
}

/**
 * Parsea una transcripción pegada/subida a NormalizedTranscript.
 * Acepta:
 *  - JSON array de segmentos, o { segments: [...] } (estilo tl;dv)
 *  - Texto plano, una línea por turno, opcional "[mm:ss] Speaker: text"
 */
export function parseTranscriptInput(raw: string, externalMeetingId = 'manual'): NormalizedTranscript {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('La transcripción está vacía.');
  }

  // ── JSON ──────────────────────────────────────────────────────────────
  try {
    const json = JSON.parse(trimmed) as unknown;
    const arr = Array.isArray(json) ? json : (json as { segments?: unknown[] }).segments;

    if (Array.isArray(arr) && arr.length > 0) {
      const segments: NormalizedSegment[] = arr
        .map((item) => {
          const s = item as Record<string, unknown>;
          return {
            startSec: toSec(s.startTime ?? s.startSec ?? s.start ?? 0),
            endSec: toSec(s.endTime ?? s.endSec ?? s.end ?? 0),
            speaker: String(s.speaker ?? s.speakerName ?? s.name ?? 'Speaker'),
            text: String(s.text ?? s.content ?? '').trim(),
          };
        })
        .filter((s) => s.text);

      if (segments.length > 0) {
        return { externalMeetingId, language: 'es', segments, fullText: buildFullText(segments) };
      }
    }
  } catch {
    // no es JSON — cae a texto plano
  }

  // ── Texto plano ───────────────────────────────────────────────────────
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const segments: NormalizedSegment[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i] ?? '';
    let startSec = i;

    const tsMatch = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+/);
    if (tsMatch) {
      startSec = toSec(tsMatch[1]);
      line = line.slice(tsMatch[0].length);
    }

    let speaker = 'Locutor';
    let text = line;
    const spMatch = line.match(/^([^:]{1,40}):\s*(.*)$/);
    if (spMatch && spMatch[2]) {
      speaker = (spMatch[1] ?? '').trim();
      text = spMatch[2].trim();
    }

    if (text) segments.push({ startSec, endSec: startSec, speaker, text });
  }

  if (segments.length === 0) {
    return {
      externalMeetingId,
      language: 'es',
      segments: [{ startSec: 0, endSec: 0, speaker: 'Transcripción', text: trimmed }],
      fullText: trimmed,
    };
  }

  return { externalMeetingId, language: 'es', segments, fullText: buildFullText(segments) };
}

// Formatea la transcripción para el turno de usuario del modelo (idéntico a los
// originales): cabecera + líneas "[start s-end s] speaker: text".
export function formatTranscript(t: NormalizedTranscript): string {
  const lines = t.segments.map((s) => `[${s.startSec}s-${s.endSec}s] ${s.speaker}: ${s.text}`);
  return `MEETING_ID: ${t.externalMeetingId}\nLANGUAGE: ${t.language}\n\nTRANSCRIPT:\n${lines.join('\n')}`;
}
