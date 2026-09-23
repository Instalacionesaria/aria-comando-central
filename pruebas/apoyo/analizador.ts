// La red falsa de los Analizadores: tl;dv por URL y Anthropic por modelo. Para las pruebas Base.
//
// tl;dv responde el listado y las transcripciones de las reuniones que la prueba siembra en
// `red.reuniones`; Anthropic contesta al clasificador según el TÍTULO que viaja en su encabezado, y
// al análisis con lo que la prueba encole en `red.analisis`. **Cada llamada al modelo se cuenta**:
// es lo que permite afirmar dónde se paga y dónde no.
//
// Cualquier otro pedido LANZA: una prueba que sale a la red de verdad es un error de la prueba, y un
// `fetch` real desde acá gastaría la llave de alguien.

export const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

const USO = { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 50, cache_read_input_tokens: 3000 };

/** Una respuesta del modelo con este texto y los cuatro contadores. */
export const delModelo = (texto: string) => json({ content: [{ type: 'text', text: texto }], stop_reason: 'end_turn', usage: USO });

export interface Reunion {
  id: string;
  name: string;
  happenedAt?: string;
  transcripcion?: unknown;
}

export const SEGMENTOS = [
  { startTime: '00:05', endTime: '00:09', speaker: 'Valeria', text: 'hola' },
  { startTime: '00:10', endTime: '00:20', speaker: 'Rubén', text: 'quiero vender más' },
];

export const red = {
  reuniones: [] as Reunion[],
  /** Qué contesta el clasificador para cada título. Sin entrada, basura (no se puede clasificar). */
  clasificacion: {} as Record<string, string>,
  /** Qué contesta el análisis (Sonnet), en orden. Sin nada encolado, un análisis HT neutro. */
  analisis: [] as (() => Response)[],
  estadoDeTldv: 200,
  estadoDeAnthropic: 200,
  llamadasAlClasificador: 0,
  llamadasAlAnalisis: 0,
  cuerposDelAnalisis: [] as Record<string, unknown>[],
  reiniciar() {
    this.reuniones = [];
    this.clasificacion = {};
    this.analisis = [];
    this.estadoDeTldv = 200;
    this.estadoDeAnthropic = 200;
    this.llamadasAlClasificador = 0;
    this.llamadasAlAnalisis = 0;
    this.cuerposDelAnalisis = [];
  },
};

/** Siembra una reunión en tl;dv y, si se da, lo que el clasificador va a decir de ella. */
export function unaReunion(id: string, tipo: string | null, extra: Partial<Reunion> = {}): Reunion {
  const reciente = new Date(Date.now() - 3 * 3_600_000).toISOString();
  const r: Reunion = { id, name: `Reunión ${id}`, happenedAt: reciente, transcripcion: SEGMENTOS, ...extra };
  if (tipo) red.clasificacion[r.name] = tipo;
  red.reuniones.push(r);
  return r;
}

const falsa = (async (url: RequestInfo | URL, init?: RequestInit) => {
  const u = String(url);
  if (u.startsWith('https://pasta.tldv.io/v1alpha1/meetings')) {
    if (red.estadoDeTldv !== 200) return json({ message: 'no' }, red.estadoDeTldv);
    const m = u.match(/meetings\/([^/]+)\/transcript$/);
    if (m) {
      const r = red.reuniones.find((x) => x.id === decodeURIComponent(m[1]!));
      if (!r || r.transcripcion === undefined) return json({ message: 'not found' }, 404);
      return json({ data: r.transcripcion });
    }
    return json({
      results: red.reuniones.map((r) => ({
        id: r.id,
        name: r.name,
        happenedAt: r.happenedAt,
        duration: 1800,
        organizer: { name: 'Valeria', email: 'valeria@ejemplo-agencia.test' },
        invitees: [{ name: 'Rubén', email: `ruben-${r.id}@ejemplo-cliente.test` }],
      })),
    });
  }
  if (u === 'https://api.anthropic.com/v1/messages') {
    const cuerpo = JSON.parse(String(init?.body)) as { model: string; messages: { content: string }[] };
    if (red.estadoDeAnthropic !== 200) {
      return json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, red.estadoDeAnthropic);
    }
    if (cuerpo.model === 'claude-haiku-4-5') {
      red.llamadasAlClasificador++;
      const texto = cuerpo.messages[0]!.content;
      const titulo = Object.keys(red.clasificacion).find((t) => texto.includes(`TÍTULO DE LA REUNIÓN: ${t}`));
      return delModelo(titulo ? JSON.stringify({ tipo: red.clasificacion[titulo], reason: `porque ${titulo}` }) : 'no sé');
    }
    red.llamadasAlAnalisis++;
    red.cuerposDelAnalisis.push(cuerpo as unknown as Record<string, unknown>);
    const siguiente = red.analisis.shift();
    return siguiente ? siguiente() : delModelo('{"score": 6, "outcome": "INDETERMINADO"}');
  }
  throw new Error(`la prueba no esperaba un pedido a ${u}`);
}) as typeof globalThis.fetch;

let original: typeof globalThis.fetch | null = null;

/** Reemplaza `fetch` por la red falsa. Llamar en el `before` de la prueba. */
export function instalarRedFalsa(): void {
  if (original === null) original = globalThis.fetch;
  globalThis.fetch = falsa;
}

/** Devuelve el `fetch` de verdad. Llamar en el `after`. */
export function quitarRedFalsa(): void {
  if (original !== null) globalThis.fetch = original;
  original = null;
}

/** Las seis tablas de los Analizadores, en el orden en que se pueden vaciar. */
export const TABLAS_DEL_ANALIZADOR = [
  'analizador_lapidas',
  'analizador_fichas',
  'analizador_analisis',
  'analizador_transcripciones',
  'analizador_llamadas',
  'analizador_prospectos',
] as const;
