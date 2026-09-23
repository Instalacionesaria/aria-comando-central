// ── NÚCLEO PORTADO DE ARIA BRAIN · los identificadores siguen en inglés a propósito ──
// Son el contrato con el motor portado (`engine.ts` los importa por nombre). Ver docs/ANALIZADORES.md.
//
// Origen: aria-ia-brain lib/analyzer/anthropic.ts. **REESCRITO**, no copiado: del origen quedan el
// cuerpo de las dos peticiones —idéntico, porque es el que produjo el historial— y `extractJson`, con
// una sola guarda de índice que `noUncheckedIndexedAccess` exige. Lo que cambió, cada cosa por un
// defecto concreto:
//
//   · `fetch(` → `pedirExterno(`. ADR-0305 restringe `fetch` a `lib/http/cliente.ts`, y esa lista es
//     una igualdad: un cuarto archivo la pone en rojo.
//   · El modelo es una constante, no `process.env.ANALYZER_*`. Un comportamiento gobernado por una
//     variable de entorno cambia solo en el entorno donde la variable no está, y ahí una empresa
//     queda analizando con otro modelo sin que nadie lo haya decidido (`lib/auditor/modelo.ts:44-50`).
//   · La llave es OBLIGATORIA en el tipo. El origen la tenía opcional y la validaba adentro; acá sin
//     ella la función no se puede llamar (ADR-0908: la llave es por organización, sin respaldo).
//   · `usage` devuelve los CUATRO contadores. El sistema del análisis se marca para cachear, y el
//     origen tiraba la escritura y la lectura del caché: se cobraban sin quedar en ningún lado.
//   · La espera la pone quien llama, y el fallo sale con su TIPO (`AnalyzerCallError.kind`) en vez de
//     un mensaje armado a mano: quien corre en un presupuesto de tiempo necesita distinguir «la llave
//     no sirve» de «tardó demasiado» sin leer texto.
//
// ── EL CUERPO NO LLEVA `tool_choice`, AL REVÉS QUE EL AUDITOR ────────────────
//
// El análisis pide pensamiento adaptativo, y pensamiento con una herramienta forzada es incompatible
// (el auditor, que fuerza la herramienta, por eso no piensa: `lib/auditor/modelo.ts:196-209`). Acá el
// JSON sale del contrato escrito en el system más `extractJson`, que es como se produjeron los 107
// análisis del historial. Cambiarlo cambiaría el juicio.

import { pedirExterno } from '../../http/cliente.ts';
import type { TokenUsage } from './pricing.ts';

/** El modelo del análisis y de la ficha. El mismo que usa el origen por omisión. */
export const ANALYSIS_MODEL = 'claude-sonnet-5';

/** El clasificador barato: decide HT / OB / OTRO mirando el inicio de la transcripción. */
export const CLASSIFY_MODEL = 'claude-haiku-4-5';

/**
 * Las esperas del origen. El análisis tardaba minutos y la clasificación segundos; quien corre dentro
 * de un presupuesto puede pasar una menor, nunca una mayor que la que le queda.
 */
export const ANALYSIS_WAIT_MS = 270_000;
export const CLASSIFY_WAIT_MS = 60_000;

/** Techo de tokens del análisis. Cubre pensamiento y texto: el del origen, que no truncó nunca. */
export const ANALYSIS_MAX_TOKENS = 20_000;
export const CLASSIFY_MAX_TOKENS = 400;

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

// Extrae el objeto JSON del texto del modelo de forma robusta: quita vallas
// markdown (```json … ```) y recorta a la primera "{" … última "}". Idéntico a
// platform2/src/agent/analyze.ts.
export function extractJson(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = (fence[1] ?? '').trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) t = t.slice(first, last + 1);
  return t;
}

/**
 * Por qué una llamada al modelo no dio texto utilizable. **Cada tipo pide otra reacción**:
 *
 *   · `rechazado`: el servicio contestó que no. `status` dice cuál: 401 es la llave, 400 con «credit
 *     balance» es el saldo, 429 es el ritmo.
 *   · `sin_respuesta`: red, DNS o la espera agotada. No se sabe si el modelo llegó a cobrar.
 *   · `truncado`: se cortó en el techo de tokens, con la inferencia ya pagada. Se sube el techo.
 *   · `declino`: el modelo se negó por políticas. Llega con HTTP 200: si no se mira `stop_reason`,
 *     un rechazo se lee como una respuesta vacía.
 *   · `sin_texto`: un 200 sin ningún bloque de texto.
 */
export type AnalyzerCallFailure = 'rechazado' | 'sin_respuesta' | 'truncado' | 'declino' | 'sin_texto';

export class AnalyzerCallError extends Error {
  readonly kind: AnalyzerCallFailure;
  readonly status: number | null;
  constructor(kind: AnalyzerCallFailure, message: string, status: number | null = null) {
    super(message);
    this.name = 'AnalyzerCallError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * ¿La llave ya no sirve para NADA de lo que venga después? 401 y 403 son la llave; un 400 con «credit
 * balance» es la cuenta sin saldo. En los tres casos, seguir intentando con la próxima llamada solo
 * produce el mismo rechazo —y, en un drenado, deja FAILED a cada pendiente que toca—.
 */
export function isUnusableKey(e: unknown): boolean {
  if (!(e instanceof AnalyzerCallError) || e.kind !== 'rechazado') return false;
  return e.status === 401 || e.status === 403 || (e.status === 400 && /credit balance/i.test(e.message));
}

/** ¿El servicio está saturado? 429 y 529: se arregla esperando, no reintentando en bucle. */
export function isOverloaded(e: unknown): boolean {
  return e instanceof AnalyzerCallError && e.kind === 'rechazado' && (e.status === 429 || e.status === 529);
}

/**
 * Saca la llave de un texto de error. `fetch` pone el valor de una cabecera inválida adentro de su
 * mensaje —«"<la llave entera>" is an invalid header value»—, y ese mensaje termina guardado en la
 * llamada y devuelto por la API. Una llave cargada con un salto de línea en el medio basta.
 */
export function redactKey(texto: string, apiKey: string): string {
  return apiKey.length >= 8 ? texto.split(apiKey).join('[llave]') : texto;
}

interface AnthropicBlock {
  type?: string;
  text?: string;
}
interface AnthropicResponse {
  content?: AnthropicBlock[];
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export interface AnalyzerCallResult {
  text: string;
  model: string;
  usage: TokenUsage;
}

function joinText(data: AnthropicResponse): string {
  return (Array.isArray(data.content) ? data.content : [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text || '')
    .join('');
}

/** Un contador ausente es un cero de ESE contador, no un análisis gratis: el total lo decide la tarifa. */
function usageOf(data: AnthropicResponse): TokenUsage {
  const u = data.usage ?? {};
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    input: n(u.input_tokens),
    output: n(u.output_tokens),
    cacheWrite: n(u.cache_creation_input_tokens),
    cacheRead: n(u.cache_read_input_tokens),
  };
}

async function postAnthropic(body: Record<string, unknown>, apiKey: string, waitMs: number): Promise<AnthropicResponse> {
  const r = await pedirExterno<AnthropicResponse>(API_URL, {
    metodo: 'POST',
    cabeceras: { 'x-api-key': apiKey, 'anthropic-version': API_VERSION },
    cuerpo: body,
    espera: waitMs,
  });
  if (r.tipo === 'rechazado') {
    throw new AnalyzerCallError('rechazado', redactKey(`Anthropic ${r.estado}: ${r.detalle ?? r.codigo}`, apiKey), r.estado);
  }
  if (r.tipo === 'sin_respuesta') {
    throw new AnalyzerCallError('sin_respuesta', redactKey(`Anthropic no respondió: ${r.causa}`, apiKey));
  }
  return r.datos;
}

/** El cuerpo del análisis, aparte para que una prueba lo mida sin gastar. */
export function analyzerBody(system: string, userText: string): Record<string, unknown> {
  return {
    model: ANALYSIS_MODEL,
    max_tokens: ANALYSIS_MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userText }],
  };
}

/** El cuerpo de la clasificación: sin pensamiento, techo corto. */
export function classifierBody(system: string, userText: string): Record<string, unknown> {
  return {
    model: CLASSIFY_MODEL,
    max_tokens: CLASSIFY_MAX_TOKENS,
    system,
    messages: [{ role: 'user', content: userText }],
  };
}

// Llamada de ANÁLISIS: sonnet-5, pensamiento adaptativo y esfuerzo bajo, system cacheado.
export async function callAnalyzer(
  system: string,
  userText: string,
  apiKey: string,
  waitMs: number = ANALYSIS_WAIT_MS,
): Promise<AnalyzerCallResult> {
  const data = await postAnthropic(analyzerBody(system, userText), apiKey, waitMs);

  /* El motivo de corte se mira ANTES de leer el texto. Un truncado leído como «JSON roto» manda a
     revisar el esquema en vez de subir el techo, y un rechazo por políticas llega con HTTP 200. */
  if (data.stop_reason === 'max_tokens') {
    throw new AnalyzerCallError('truncado', `El modelo ${ANALYSIS_MODEL} truncó la salida (max_tokens); el análisis quedó incompleto.`);
  }
  if (data.stop_reason === 'refusal') {
    throw new AnalyzerCallError('declino', 'El modelo rechazó procesar esta transcripción por políticas de seguridad.');
  }
  const text = joinText(data);
  if (!text.trim()) {
    throw new AnalyzerCallError('sin_texto', `El modelo ${ANALYSIS_MODEL} no devolvió texto (stop_reason: ${data.stop_reason}).`);
  }
  return { text, model: ANALYSIS_MODEL, usage: usageOf(data) };
}

// Llamada de CLASIFICACIÓN: haiku barato, sin pensamiento. Que un fallo no escriba nada lo decide
// quien llama (`classifyCallType` devuelve null).
export async function callClassifier(
  system: string,
  userText: string,
  apiKey: string,
  waitMs: number = CLASSIFY_WAIT_MS,
): Promise<AnalyzerCallResult> {
  const data = await postAnthropic(classifierBody(system, userText), apiKey, waitMs);
  return { text: joinText(data), model: CLASSIFY_MODEL, usage: usageOf(data) };
}
