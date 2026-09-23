// ── NÚCLEO PORTADO DE ARIA BRAIN · los identificadores siguen en inglés a propósito ──
// Son el contrato con el resto del núcleo (`NormalizedMeeting`, `NormalizedTranscript`). Ver
// docs/ANALIZADORES.md.
//
// Origen: aria-ia-brain lib/analyzer/tldv.ts. `toNormalizedMeeting` y `emailDomain` quedan como
// estaban —ahí vive la heurística que decide quién es el prospecto, y cambiarla cambia a quién se le
// arma la ficha—. **El transporte se reescribió**, por dos defectos del origen:
//
//   · `fetch(` crudo, que ADR-0305 restringe a `lib/http/cliente.ts`.
//   · **Todos los fallos eran el mismo `Error`**, y el pipeline del origen los tragaba con un
//     `catch {}`. Una llave revocada y «la transcripción todavía no está» se veían igual: la
//     reunión se retomaba en la siguiente corrida para siempre, y nadie se enteraba de que la llave
//     había dejado de servir. Acá el fallo sale con su TIPO (`TldvError.kind`), y la llave inválida
//     corta el descubrimiento entero en vez de repetirse reunión por reunión.
import { pedirExterno } from '../../http/cliente.ts';
import type { NormalizedMeeting, NormalizedSegment, NormalizedTranscript } from './types.ts';

const TLDV_BASE = 'https://pasta.tldv.io/v1alpha1';

/**
 * Cuánto se espera a tl;dv por pedido. El origen no ponía ninguna, y el descubrimiento hace hasta 41
 * pedidos en serie dentro de los 300 s de una función: uno colgado se comía el resto de la corrida.
 * Es un listado y un JSON, no una inferencia; si tarda más que esto, lo sano es retomarlo en la
 * próxima corrida.
 */
export const TLDV_WAIT_MS = 30_000;

/**
 * Lo que puede salir mal, cada cosa con su reacción:
 *   · `llave`: 401 o 403. La llave no sirve: se corta todo el descubrimiento y se avisa.
 *   · `no_lista`: la reunión existe pero tl;dv todavía no procesó el audio. NO es un fallo: se
 *     retoma en la siguiente corrida, y el descarte por identificador externo evita duplicarla.
 *   · `rechazado`: cualquier otro estado. `status` dice cuál.
 *   · `sin_respuesta`: red o espera agotada.
 */
export type TldvFailure = 'llave' | 'no_lista' | 'rechazado' | 'sin_respuesta';

export class TldvError extends Error {
  readonly kind: TldvFailure;
  readonly status: number | null;
  constructor(kind: TldvFailure, message: string, status: number | null = null) {
    super(message);
    this.name = 'TldvError';
    this.kind = kind;
    this.status = status;
  }
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map(Number);
  const [a = 0, b = 0, c = 0] = parts;
  if (parts.length === 3) return a * 3600 + b * 60 + c;
  if (parts.length === 2) return a * 60 + b;
  return Number(ts);
}

interface TldvPerson {
  name?: string;
  email?: string;
  isOrganizer?: boolean;
}

interface TldvMeetingData {
  id?: string;
  name?: string;
  title?: string;
  happenedAt?: string;
  startedAt?: string;
  duration?: number;
  organizer?: { name?: string; email?: string };
  invitees?: TldvPerson[];
  participants?: TldvPerson[];
  url?: string; // link a la grabación (verificado contra la API real)
  extraProperties?: Record<string, unknown>;
}

// Dominio de un email ('juan@acme.com' → 'acme.com'). Vacío si no parsea.
export function emailDomain(email?: string | null): string {
  const at = (email || '').trim().toLowerCase().split('@');
  return at.length === 2 ? (at[1] ?? '') : '';
}

export function toNormalizedMeeting(m: TldvMeetingData, externalMeetingId: string): NormalizedMeeting {
  const people = (m.invitees ?? m.participants ?? []).map((p) => ({ name: p.name, email: p.email }));
  const organizerEmail = m.organizer?.email;
  // El "dominio interno" es el del ORGANIZADOR (para ARIA: ariaia.com; generaliza
  // a cualquier subcuenta). El prospecto/cliente es el primer asistente cuyo
  // dominio de correo es DISTINTO; fallback: la heurística original por nombre.
  const orgDomain = emailDomain(organizerEmail);
  const prospect =
    (orgDomain ? people.find((i) => i.email && emailDomain(i.email) !== orgDomain) : undefined) ??
    people.find((i) => i.email && i.email !== organizerEmail && i.name) ??
    people.find((i) => i.name && i.name !== m.organizer?.name);
  const happenedAtRaw = m.happenedAt ?? m.startedAt;

  return {
    externalMeetingId,
    title: m.name ?? m.title,
    organizer: { name: m.organizer?.name, email: organizerEmail },
    invitees: people,
    organizerEmail,
    prospectName: prospect?.name,
    prospectEmail: prospect?.email,
    happenedAt: happenedAtRaw ? new Date(happenedAtRaw).toISOString() : undefined,
    durationSec: typeof m.duration === 'number' && m.duration > 0 ? Math.round(m.duration) : undefined,
    meetingUrl: m.url,
    providerMeta: m.extraProperties,
  };
}

/** Un pedido a tl;dv, con el fallo traducido a su tipo. */
async function getTldv<T>(path: string, apiKey: string, waitMs: number, notReadyOn404: boolean): Promise<T> {
  const r = await pedirExterno<T>(`${TLDV_BASE}${path}`, {
    cabeceras: { 'x-api-key': apiKey },
    espera: waitMs,
  });
  /* La llave se saca del texto: `fetch` la pone entera en su mensaje cuando no es un valor de cabecera
     válido, y ese texto llega hasta la respuesta del cron. */
  const sinLlave = (t: string) => (apiKey.length >= 8 ? t.split(apiKey).join('[llave]') : t);
  if (r.tipo === 'sin_respuesta') throw new TldvError('sin_respuesta', sinLlave(`tl;dv no respondió: ${r.causa}`));
  if (r.tipo === 'rechazado') {
    if (r.estado === 401 || r.estado === 403) {
      throw new TldvError('llave', `tl;dv rechazó la llave (${r.estado}).`, r.estado);
    }
    if (notReadyOn404 && r.estado === 404) {
      throw new TldvError('no_lista', 'tl;dv todavía no tiene la transcripción de esta reunión.', 404);
    }
    throw new TldvError('rechazado', sinLlave(`tl;dv ${r.estado}: ${r.detalle ?? r.codigo}`), r.estado);
  }
  return r.datos;
}

/**
 * El tamaño de una página del listado de tl;dv. Lo dice su documentación, y la primera corrida real
 * (2026-09-23) devolvió una página llena, así que la cuenta de ARIA ya tiene más. El origen no
 * pagina y descarta cualquier metadato de paginación.
 */
export const TLDV_PAGE_SIZE = 50;

// Lista las reuniones recientes de la cuenta (más nuevas primero: la primera corrida real trajo la
// reunión de esa misma tarde en una página llena). **Una sola página**, como el origen. Si vuelve
// llena y ninguna de sus reuniones sale de la ventana, puede haber reuniones que no se ven: el
// descubrimiento lo calcula (`paginaSinBorde`) y la tarea lo deja dicho en su sello.
export async function listRecentMeetings(apiKey: string, waitMs: number = TLDV_WAIT_MS): Promise<NormalizedMeeting[]> {
  const body = await getTldv<{ results?: TldvMeetingData[] }>('/meetings', apiKey, waitMs, false);
  return (Array.isArray(body.results) ? body.results : []).map((m) => toNormalizedMeeting(m, String(m.id)));
}

export async function fetchMeetingMetadata(
  apiKey: string,
  externalMeetingId: string,
  waitMs: number = TLDV_WAIT_MS,
): Promise<NormalizedMeeting> {
  const data = await getTldv<TldvMeetingData>(`/meetings/${encodeURIComponent(externalMeetingId)}`, apiKey, waitMs, false);
  return toNormalizedMeeting(data, externalMeetingId);
}

interface TldvApiSegment {
  startTime: string | number;
  endTime: string | number;
  speaker: string;
  text: string;
}

export async function fetchTranscript(
  apiKey: string,
  externalMeetingId: string,
  waitMs: number = TLDV_WAIT_MS,
): Promise<NormalizedTranscript> {
  // Los segmentos vienen en `data`, NO en `segments`.
  const body = await getTldv<{ data?: TldvApiSegment[]; segments?: TldvApiSegment[]; language?: string }>(
    `/meetings/${encodeURIComponent(externalMeetingId)}/transcript`,
    apiKey,
    waitMs,
    true,
  );
  const rawSegments = body.data ?? body.segments ?? [];
  /* Sin segmentos es «todavía no»: el origen lanzaba acá y el pipeline la retomaba en la corrida
     siguiente. Se conserva ese sentido, ahora con su tipo. */
  if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
    throw new TldvError('no_lista', `tl;dv devolvió una transcripción sin segmentos para la reunión ${externalMeetingId}.`);
  }

  const segments: NormalizedSegment[] = rawSegments.map((s) => ({
    startSec: typeof s.startTime === 'number' ? s.startTime : parseTimestamp(String(s.startTime)),
    endSec: typeof s.endTime === 'number' ? s.endTime : parseTimestamp(String(s.endTime)),
    speaker: s.speaker,
    text: s.text,
  }));

  return {
    externalMeetingId,
    language: body.language ?? 'es',
    segments,
    fullText: segments.map((s) => `[${s.speaker}]: ${s.text}`).join('\n'),
  };
}
