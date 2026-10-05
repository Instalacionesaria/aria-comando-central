// El modelo falso del cerebro: un guion de respuestas de Anthropic, una por ronda, para las pruebas.
//
// Reemplaza `globalThis.fetch`. Cada pedido a la API de mensajes toma la siguiente respuesta del guion y
// guarda el cuerpo que se mandó —serializado y vuelto a leer, como en la 171—, para que la prueba afirme
// qué viajó en cada ronda. Cualquier otro pedido LANZA: una prueba que sale a la red de verdad es un error,
// y desde acá gastaría la llave de alguien. Un guion que se acaba también lanza.

export interface BloqueFalso {
  type: string;
  [campo: string]: unknown;
}

/** Una respuesta de la API con estos bloques. `stop_reason` se deduce: `tool_use` si hay alguno. */
export function respuestaDelModelo(bloques: BloqueFalso[], stopReason?: string): Response {
  const usaHerramienta = bloques.some((b) => b.type === 'tool_use');
  return new Response(
    JSON.stringify({
      content: bloques,
      stop_reason: stopReason ?? (usaHerramienta ? 'tool_use' : 'end_turn'),
      usage: { input_tokens: 1200, output_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

let contador = 0;
/** Un pedido de herramienta del modelo, con un identificador único. */
export const pideHerramienta = (name: string, input: Record<string, unknown>): BloqueFalso => ({
  type: 'tool_use',
  id: `toolu_${(contador += 1)}`,
  name,
  input,
});
/** Un bloque de pensamiento, como los que `claude-sonnet-5-5` devuelve y hay que devolverle tal cual. */
export const piensa = (texto: string): BloqueFalso => ({ type: 'thinking', thinking: texto, signature: `firma-${texto.length}` });
export const escribe = (text: string): BloqueFalso => ({ type: 'text', text });

/** Una respuesta mínima y válida de `responder`. */
export function respuestaMinima(conclusion = 'Una conclusión.', extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    conclusion,
    cifras: [],
    confianza: { nivel: 'media', porque: 'Sintético.' },
    areas: [],
    recomendaciones: [],
    no_hay_dato: [],
    siguientes: [],
    ...extra,
  };
}

export interface ModeloFalso {
  /** Los cuerpos que se mandaron, en orden. */
  cuerpos: Record<string, unknown>[];
  /** Cuántas respuestas del guion quedan sin usar. */
  quedan: () => number;
  quitar: () => void;
}

/**
 * Instala el modelo falso. Cada paso del guion es la respuesta de una ronda, o una función que la arma —
 * puede esperar, para probar qué pasa mientras el modelo piensa—.
 */
export function instalarModeloFalso(guion: (Response | (() => Response | Promise<Response>))[]): ModeloFalso {
  const original = globalThis.fetch;
  const pendientes = [...guion];
  const cuerpos: Record<string, unknown>[] = [];
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u !== 'https://api.anthropic.com/v1/messages') throw new Error(`la prueba no esperaba un pedido a ${u}`);
    cuerpos.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const siguiente = pendientes.shift();
    if (siguiente === undefined) throw new Error('el guion del modelo falso se acabó');
    return typeof siguiente === 'function' ? siguiente() : siguiente;
  }) as typeof globalThis.fetch;
  return {
    cuerpos,
    quedan: () => pendientes.length,
    quitar: () => {
      globalThis.fetch = original;
    },
  };
}
