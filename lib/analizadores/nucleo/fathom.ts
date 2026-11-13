// FATHOM COMO PROVEEDOR DE REUNIONES · el par de `tldv.ts`, escrito acá y no portado.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ES Y QUÉ TODAVÍA NO
//
// Traduce lo que manda Fathom —por su API o por su webhook— al MISMO idioma que ya habla el analizador
// (`NormalizedMeeting`, `NormalizedTranscript`), y comprueba la firma de sus webhooks. **Todavía no lo
// llama el pipeline**: existe para la prueba de `scripts/prueba-fathom/`, que mide con cuentas reales
// si Fathom sirve antes de decidir el cambio. Conectarlo es sumar `FATHOM` a `ProveedorDeReuniones` y
// al CHECK de la 056, y una ruta que reciba el webhook.
//
// Todo lo de acá sale del OpenAPI oficial (developers.fathom.ai/api-reference/openapi.yaml) y de su
// página de webhooks, leídos el 2026-11-10. Lo que dicen y que cambia el diseño:
//
//   · **La transcripción viene adentro de la reunión** (`include_transcript`), en el listado y en el
//     webhook. Con tl;dv eran dos pedidos por reunión; acá es uno por página de 10.
//   · **Cada línea trae sólo su inicio** (`timestamp`, HH:MM:SS). El fin se toma del inicio de la
//     siguiente, y el de la última, del fin de la grabación.
//   · **Cada invitado dice si es externo** (`is_external`). Eso reemplaza la adivinanza por dominio
//     de `tldv.ts`, que queda sólo como respaldo.
//   · **El resumen y los action items salen siempre en inglés** («Always displayed in English»). No se
//     usan: el analizador trabaja sobre la transcripción, que conserva el idioma de la llamada.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual } from 'node:crypto';
import { pedirExterno } from '../../http/cliente.ts';
import type { MeetingPerson, NormalizedMeeting, NormalizedSegment, NormalizedTranscript } from './types.ts';

export const FATHOM_BASE = 'https://api.fathom.ai/external/v1';

/** Lo mismo que `TLDV_WAIT_MS`: un listado con JSON, no una inferencia. */
export const FATHOM_WAIT_MS = 30_000;

/** El tamaño de página de `/meetings`. No se puede cambiar (FAQ de desarrolladores). */
export const FATHOM_PAGE_SIZE = 10;

// ── La forma de lo que manda Fathom (sólo los campos que se usan o se guardan) ──

export interface FathomInvitee {
  name?: string | null;
  email?: string | null;
  email_domain?: string | null;
  is_external?: boolean;
  matched_speaker_display_name?: string | null;
}

export interface FathomUser {
  name?: string;
  email?: string;
  email_domain?: string;
  team?: string | null;
}

export interface FathomTranscriptItem {
  speaker?: { display_name?: string; matched_calendar_invitee_email?: string | null };
  text?: string;
  timestamp?: string;
}

export interface FathomMeeting {
  title?: string;
  meeting_title?: string | null;
  meeting_type?: string | null;
  recording_id?: number;
  url?: string;
  share_url?: string;
  meeting_url?: string | null;
  created_at?: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  recording_start_time?: string;
  recording_end_time?: string;
  calendar_invitees_domains_type?: 'only_internal' | 'one_or_more_external';
  shared_with?: 'no_teams' | 'single_team' | 'multiple_teams' | 'all_teams';
  transcript_language?: string;
  transcript?: FathomTranscriptItem[] | null;
  default_summary?: { template_name?: string | null; markdown_formatted?: string | null } | null;
  action_items?: unknown[] | null;
  calendar_invitees?: FathomInvitee[];
  recorded_by?: FathomUser;
  crm_matches?: unknown;
}

// ── Los fallos, con su tipo (el mismo criterio que `TldvError`) ──

/**
 *   · `llave`: 401 o 403. La llave no sirve, o no le alcanza el permiso (`/users` es sólo de admin).
 *   · `limite`: 429. Fathom permite 60 pedidos por minuto, y 30 de los pesados (con transcripción).
 *   · `no_lista`: la reunión llegó sin transcripción. Se retoma más tarde.
 *   · `rechazado`: cualquier otro estado.
 *   · `sin_respuesta`: red o espera agotada.
 */
export type FathomFailure = 'llave' | 'limite' | 'no_lista' | 'rechazado' | 'sin_respuesta';

export class FathomError extends Error {
  readonly kind: FathomFailure;
  readonly status: number | null;
  /** Segundos que pide esperar un 429 (`Retry-After`), si los mandó. */
  readonly retryAfterSec: number | null;
  constructor(kind: FathomFailure, message: string, status: number | null = null, retryAfterSec: number | null = null) {
    super(message);
    this.name = 'FathomError';
    this.kind = kind;
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

// ── La traducción ──

/** 'HH:MM:SS' → segundos. Lo que no parsea es 0: una línea sin hora no rompe la transcripción. */
export function segundosDeMarca(ts: string | undefined): number {
  const partes = String(ts ?? '').split(':').map(Number);
  if (partes.some((n) => !Number.isFinite(n))) return 0;
  return partes.reduce((acc, n) => acc * 60 + n, 0);
}

function duracionEnSegundos(m: FathomMeeting): number | undefined {
  if (!m.recording_start_time || !m.recording_end_time) return undefined;
  const s = (new Date(m.recording_end_time).getTime() - new Date(m.recording_start_time).getTime()) / 1000;
  return Number.isFinite(s) && s > 0 ? Math.round(s) : undefined;
}

function dominio(email?: string | null): string {
  const partes = (email || '').trim().toLowerCase().split('@');
  return partes.length === 2 ? (partes[1] ?? '') : '';
}

/**
 * El prospecto es el primer invitado EXTERNO con correo, según Fathom. Si Fathom no marcó a nadie
 * externo (una reunión sin calendario, o todos del mismo dominio), se cae a la heurística de `tldv.ts`:
 * el primer correo de otro dominio que el de quien grabó.
 */
export function prospectoDe(m: FathomMeeting): FathomInvitee | undefined {
  const invitados = m.calendar_invitees ?? [];
  const grabo = (m.recorded_by?.email || '').toLowerCase();
  const dominioInterno = m.recorded_by?.email_domain?.toLowerCase() || dominio(grabo);
  return (
    invitados.find((i) => i.is_external === true && i.email) ??
    (dominioInterno ? invitados.find((i) => i.email && dominio(i.email) !== dominioInterno) : undefined) ??
    invitados.find((i) => i.email && i.email.toLowerCase() !== grabo && i.name)
  );
}

export function fathomAReunion(m: FathomMeeting): NormalizedMeeting {
  const prospecto = prospectoDe(m);
  const invitados: MeetingPerson[] = (m.calendar_invitees ?? []).map((i) => ({
    name: i.name ?? undefined,
    email: i.email ?? undefined,
    role: i.is_external ? 'externo' : 'interno',
  }));
  const fecha = m.recording_start_time ?? m.scheduled_start_time ?? m.created_at;
  return {
    externalMeetingId: String(m.recording_id ?? ''),
    title: m.title || m.meeting_title || undefined,
    organizer: { name: m.recorded_by?.name, email: m.recorded_by?.email },
    invitees: invitados,
    organizerEmail: m.recorded_by?.email,
    prospectName: prospecto?.name ?? undefined,
    prospectEmail: prospecto?.email ?? undefined,
    happenedAt: fecha ? new Date(fecha).toISOString() : undefined,
    durationSec: duracionEnSegundos(m),
    // `url` es el link interno de la grabación, como el `url` de tl;dv. El público va en la meta.
    meetingUrl: m.url,
    providerMeta: {
      share_url: m.share_url ?? null,
      meeting_url: m.meeting_url ?? null,
      meeting_type: m.meeting_type ?? null,
      shared_with: m.shared_with ?? null,
      calendar_invitees_domains_type: m.calendar_invitees_domains_type ?? null,
      transcript_language: m.transcript_language ?? null,
      recorded_by_team: m.recorded_by?.team ?? null,
    },
  };
}

/**
 * La transcripción en el formato del analizador. Sin líneas lanza `no_lista`, como `tldv.ts`: Fathom
 * puede mandar una reunión sin transcripción si se pidió sin `include_transcript` o si todavía no la
 * procesó, y en los dos casos lo sano es retomarla y no analizar un texto vacío.
 */
export function fathomATranscripcion(m: FathomMeeting): NormalizedTranscript {
  const id = String(m.recording_id ?? '');
  const lineas = Array.isArray(m.transcript) ? m.transcript.filter((t) => (t.text ?? '').trim() !== '') : [];
  if (lineas.length === 0) {
    throw new FathomError('no_lista', `Fathom mandó la reunión ${id} sin transcripción.`);
  }
  const fin = duracionEnSegundos(m);
  const segmentos: NormalizedSegment[] = lineas.map((t, i) => {
    const inicio = segundosDeMarca(t.timestamp);
    const siguiente = lineas[i + 1];
    const hasta = siguiente ? segundosDeMarca(siguiente.timestamp) : fin !== undefined && fin > inicio ? fin : inicio;
    return {
      startSec: inicio,
      endSec: Math.max(inicio, hasta),
      speaker: t.speaker?.display_name || 'Desconocido',
      text: (t.text ?? '').trim(),
    };
  });
  return {
    externalMeetingId: id,
    language: m.transcript_language || 'es',
    segments: segmentos,
    fullText: segmentos.map((s) => `[${s.speaker}]: ${s.text}`).join('\n'),
  };
}

// ── La firma del webhook ──

export type ResultadoDeLaFirma =
  | { ok: true }
  | { ok: false; motivo: 'faltan_cabeceras' | 'secreto_invalido' | 'fuera_de_tiempo' | 'firma_distinta' };

/**
 * Comprueba que un webhook lo mandó Fathom y no se tocó. Es el esquema de «Standard Webhooks»:
 * HMAC-SHA256 de `id.timestamp.cuerpo` con el secreto decodificado de base64 (lo que va después de
 * `whsec_`), comparado contra cada firma de la cabecera (`v1,<base64>`, separadas por espacio).
 *
 * `cuerpoCrudo` tiene que ser el texto TAL CUAL llegó: un `JSON.stringify` de lo ya parseado cambia
 * espacios y orden, y la firma deja de coincidir sin que nada esté mal.
 *
 * El ejemplo de Fathom usa `timingSafeEqual` sin mirar el largo, y esa función LANZA si los largos
 * difieren: una cabecera basura tiraría el receptor. Acá se compara el largo antes.
 */
export function verificarFirmaDeFathom(
  secreto: string,
  cabeceras: { id?: string | null; timestamp?: string | null; firma?: string | null },
  cuerpoCrudo: string,
  ahoraSeg: number = Math.floor(Date.now() / 1000),
  toleranciaSeg = 300,
): ResultadoDeLaFirma {
  const { id, timestamp, firma } = cabeceras;
  if (!id || !timestamp || !firma) return { ok: false, motivo: 'faltan_cabeceras' };
  if (!secreto.startsWith('whsec_') || secreto.length <= 'whsec_'.length) return { ok: false, motivo: 'secreto_invalido' };

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(ahoraSeg - ts) > toleranciaSeg) return { ok: false, motivo: 'fuera_de_tiempo' };

  const clave = Buffer.from(secreto.slice('whsec_'.length), 'base64');
  const esperada = Buffer.from(createHmac('sha256', clave).update(`${id}.${timestamp}.${cuerpoCrudo}`).digest('base64'));
  const coincide = firma
    .split(' ')
    .filter(Boolean)
    .map((f) => {
      const coma = f.indexOf(',');
      return Buffer.from(coma >= 0 ? f.slice(coma + 1) : f);
    })
    .some((f) => f.length === esperada.length && timingSafeEqual(f, esperada));
  return coincide ? { ok: true } : { ok: false, motivo: 'firma_distinta' };
}

/** Firma un cuerpo como lo haría Fathom. Para las pruebas y para simular un webhook en local. */
export function firmarComoFathom(secreto: string, id: string, timestamp: string, cuerpoCrudo: string): string {
  const clave = Buffer.from(secreto.slice('whsec_'.length), 'base64');
  return `v1,${createHmac('sha256', clave).update(`${id}.${timestamp}.${cuerpoCrudo}`).digest('base64')}`;
}

// ── El transporte ──

/**
 * Un pedido a Fathom, con el fallo traducido a su tipo. Exportado porque la prueba lo usa también
 * para `/users`, `/teams` y `/webhooks`, que el analizador no necesita.
 */
export async function pedirAFathom<T>(
  ruta: string,
  llave: string,
  /** `lectura: 'texto'` para lo que contesta sin cuerpo (el 204 de borrar un webhook). */
  opciones: { metodo?: string; cuerpo?: unknown; espera?: number; lectura?: 'json' | 'texto' } = {},
): Promise<T> {
  let retryAfter: number | null = null;
  const r = await pedirExterno<T>(`${FATHOM_BASE}${ruta}`, {
    metodo: opciones.metodo,
    cuerpo: opciones.cuerpo,
    lectura: opciones.lectura,
    cabeceras: { 'X-Api-Key': llave },
    espera: opciones.espera ?? FATHOM_WAIT_MS,
    alResponder: (h) => {
      const v = Number(h.get('retry-after'));
      retryAfter = Number.isFinite(v) && v > 0 ? v : null;
    },
  });
  // La llave fuera de cualquier texto, por la misma razón que en `tldv.ts`.
  const sinLlave = (t: string) => (llave.length >= 8 ? t.split(llave).join('[llave]') : t);
  if (r.tipo === 'sin_respuesta') throw new FathomError('sin_respuesta', sinLlave(`Fathom no respondió: ${r.causa}`));
  if (r.tipo === 'rechazado') {
    if (r.estado === 401 || r.estado === 403) throw new FathomError('llave', `Fathom rechazó la llave (${r.estado}).`, r.estado);
    if (r.estado === 429) throw new FathomError('limite', 'Fathom pidió esperar (429).', 429, retryAfter);
    throw new FathomError('rechazado', sinLlave(`Fathom ${r.estado}: ${r.detalle ?? r.codigo}`), r.estado);
  }
  return r.datos;
}

export interface FiltrosDeReuniones {
  /** ISO. Sólo las creadas después. */
  desde?: string;
  hasta?: string;
  cursor?: string | null;
  conTranscripcion?: boolean;
  /** Correos de quien grabó. Sin esto, Fathom deja afuera lo grabado por usuarios de fuera de la organización. */
  grabadoPor?: string[];
}

/** Una página de `/meetings` (10 reuniones) y el cursor de la siguiente. */
export async function listarReunionesDeFathom(
  llave: string,
  f: FiltrosDeReuniones = {},
): Promise<{ reuniones: FathomMeeting[]; siguiente: string | null }> {
  const q = new URLSearchParams();
  if (f.desde) q.set('created_after', f.desde);
  if (f.hasta) q.set('created_before', f.hasta);
  if (f.cursor) q.set('cursor', f.cursor);
  if (f.conTranscripcion) q.set('include_transcript', 'true');
  for (const e of f.grabadoPor ?? []) q.append('recorded_by[]', e);
  const qs = q.toString();
  const body = await pedirAFathom<{ items?: FathomMeeting[]; next_cursor?: string | null }>(
    `/meetings${qs ? `?${qs}` : ''}`,
    llave,
  );
  return { reuniones: Array.isArray(body.items) ? body.items : [], siguiente: body.next_cursor || null };
}
