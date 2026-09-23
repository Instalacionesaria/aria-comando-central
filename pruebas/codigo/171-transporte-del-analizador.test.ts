// EL TRANSPORTE DE LOS ANALIZADORES: Anthropic y tl;dv. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// Es la parte del porte que se reescribió, y sus defectos tienen la forma que ya conoce el auditor:
// **la inferencia se paga y el análisis se pierde**, o peor, **un fallo se lee como «no había
// nada»** y se repite en silencio corrida tras corrida.
//
// Cuatro grupos:
//   · los dos cuerpos, medidos serializados y vueltos a leer, contra el que produjo el historial;
//   · cada motivo de corte de Anthropic con su tipo, incluido el rechazo por políticas que llega con
//     HTTP 200;
//   · tl;dv, donde una llave revocada y «todavía no está» dejan de ser el mismo error;
//   · la espera, que un llamado colgado ya no se come la función entera.
//
// Sin red: `globalThis.fetch` se reemplaza en cada prueba, como en la 116. Ninguna gasta.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { archivosFuente } from '../apoyo/fuente.ts';
import { pedirExterno } from '../../lib/http/cliente.ts';
import {
  ANALYSIS_MODEL,
  CLASSIFY_MODEL,
  AnalyzerCallError,
  callAnalyzer,
  callClassifier,
  extractJson,
} from '../../lib/analizadores/nucleo/anthropic.ts';
import { TldvError, fetchTranscript, listRecentMeetings } from '../../lib/analizadores/nucleo/tldv.ts';
import { buildClassifierSystem, classifyCallType, runAnalysis } from '../../lib/analizadores/nucleo/engine.ts';
import { parseTranscriptInput } from '../../lib/analizadores/nucleo/transcript.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// La red falsa
// ═══════════════════════════════════════════════════════════════════════════════

interface Peticion {
  url: string;
  cuerpo: Record<string, unknown> | null;
  cabeceras: Headers;
}

async function interceptando<T>(
  respuesta: (p: Peticion) => Response | Promise<Response>,
  correr: () => Promise<T>,
): Promise<{ salida: T | Error; peticiones: Peticion[] }> {
  const peticiones: Peticion[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const p: Peticion = {
      url: String(url),
      // Serializado y vuelto a leer A PROPÓSITO: es la única forma de ver lo que `JSON.stringify` se comió.
      cuerpo: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null,
      cabeceras: new Headers(init?.headers),
    };
    peticiones.push(p);
    return respuesta(p);
  }) as typeof globalThis.fetch;
  try {
    try {
      return { salida: await correr(), peticiones };
    } catch (e) {
      return { salida: e instanceof Error ? e : new Error(String(e)), peticiones };
    }
  } finally {
    globalThis.fetch = original;
  }
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

const respuestaDelModelo = (texto: string, extra: Record<string, unknown> = {}) =>
  json({
    content: [{ type: 'thinking', thinking: 'pensando' }, { type: 'text', text: texto }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 1200, output_tokens: 300, cache_creation_input_tokens: 900, cache_read_input_tokens: 4000 },
    ...extra,
  });

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · extractJson — los dos casos del origen
// ═══════════════════════════════════════════════════════════════════════════════

test('extractJson · quita las vallas markdown', () => {
  assert.equal(extractJson('```json\n{"a":1}\n```'), '{"a":1}');
});

test('extractJson · recorta el prefacio y el sufijo al objeto', () => {
  assert.equal(extractJson('claro:\n{"a":1}\ngracias'), '{"a":1}');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LOS DOS CUERPOS
// ═══════════════════════════════════════════════════════════════════════════════

test('el cuerpo del análisis es el que produjo el historial, y no fuerza ninguna herramienta', async () => {
  /* Pensamiento adaptativo más una herramienta forzada es incompatible: el auditor fuerza la
     herramienta y por eso no piensa. Acá es al revés, y el JSON sale del contrato del system. El
     mutante que «unifica» con el auditor agregando `tool_choice` pierde todos los análisis con un 400. */
  const { peticiones } = await interceptando(
    () => respuestaDelModelo('{"ok":true}'),
    () => callAnalyzer('EL SYSTEM', 'LA TRANSCRIPCIÓN', 'sk-de-prueba'),
  );
  assert.equal(peticiones.length, 1);
  const p = peticiones[0]!;
  assert.equal(p.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(p.cabeceras.get('x-api-key'), 'sk-de-prueba');
  assert.equal(p.cabeceras.get('anthropic-version'), '2023-06-01');
  assert.deepEqual(p.cuerpo, {
    model: 'claude-sonnet-5',
    max_tokens: 20_000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: 'EL SYSTEM', cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: 'LA TRANSCRIPCIÓN' }],
  });
});

test('el cuerpo de la clasificación es corto y sin pensamiento', async () => {
  const { peticiones } = await interceptando(
    () => respuestaDelModelo('{"tipo":"HT","reason":"r"}'),
    () => callClassifier('EL SYSTEM', 'EL INICIO', 'sk-de-prueba'),
  );
  assert.deepEqual(peticiones[0]?.cuerpo, {
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    system: 'EL SYSTEM',
    messages: [{ role: 'user', content: 'EL INICIO' }],
  });
});

test('los modelos son constantes del código, y ningún archivo del analizador lee el entorno', () => {
  /* En el origen eran `process.env.ANALYZER_*`. Un comportamiento gobernado por una variable de
     entorno cambia solo donde la variable falta, y la llave de IA con respaldo al entorno es la fuga
     de plata que ADR-0908 cerró: todo se le factura a una sola empresa. */
  assert.equal(ANALYSIS_MODEL, 'claude-sonnet-5');
  assert.equal(CLASSIFY_MODEL, 'claude-haiku-4-5');
  const conEntorno = archivosFuente(['lib/analizadores'])
    .filter((a) => /process\s*\.\s*env/.test(a.limpio))
    .map((a) => a.ruta);
  assert.deepEqual(conEntorno, []);
});

test('el analizador comparte el TRANSPORTE con el auditor, y no llama a fetch directo', () => {
  /* La misma dirección, la misma versión, las mismas dos cabeceras y la salida por `pedirExterno`.
     Si un día el auditor cambia de versión de API y esto no, la divergencia aparece como «el
     analizador dejó de funcionar» meses después. */
  const fuente = (ruta: string) => {
    const a = archivosFuente(['lib']).find((x) => x.ruta === ruta);
    assert.ok(a, `no se encontró ${ruta}`);
    return a.limpio;
  };
  const delAuditor = fuente('lib/auditor/modelo.ts');
  const delAnalizador = fuente('lib/analizadores/nucleo/anthropic.ts');
  for (const compartido of ["'https://api.anthropic.com/v1/messages'", "'2023-06-01'", "'x-api-key'", "'anthropic-version'", 'pedirExterno']) {
    assert.ok(delAuditor.includes(compartido), `el auditor dejó de usar «${compartido}»`);
    assert.ok(delAnalizador.includes(compartido), `el analizador dejó de usar «${compartido}»`);
  }
  for (const a of archivosFuente(['lib/analizadores'])) {
    assert.ok(!/\bfetch\s*\(/.test(a.limpio), `${a.ruta} llama a \`fetch(\` directo`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · CADA MOTIVO DE CORTE, CON SU TIPO
// ═══════════════════════════════════════════════════════════════════════════════

async function fallaCon(respuesta: () => Response): Promise<AnalyzerCallError> {
  const { salida } = await interceptando(respuesta, () => callAnalyzer('s', 'u', 'sk'));
  assert.ok(salida instanceof AnalyzerCallError, `se esperaba un AnalyzerCallError, llegó ${String(salida)}`);
  return salida;
}

test('un rechazo por políticas llega con HTTP 200, y NO se lee como respuesta', async () => {
  /* El mutante que solo mira el estado HTTP lo toma por éxito, no encuentra texto útil, y el
     análisis sale como «JSON roto»: se manda a revisar el esquema en vez de la transcripción. */
  const e = await fallaCon(() => respuestaDelModelo('', { stop_reason: 'refusal' }));
  assert.equal(e.kind, 'declino');
});

test('una salida truncada se dice, y no se confunde con JSON inválido', async () => {
  const e = await fallaCon(() => respuestaDelModelo('{"a": [1, 2', { stop_reason: 'max_tokens' }));
  assert.equal(e.kind, 'truncado');
});

test('un 200 sin ningún bloque de texto es su propia rama', async () => {
  const e = await fallaCon(() => json({ content: [{ type: 'thinking', thinking: 'x' }], stop_reason: 'end_turn' }));
  assert.equal(e.kind, 'sin_texto');
});

test('un rechazo del servicio trae su ESTADO y su motivo', async () => {
  /* El estado es lo que separa «la llave no sirve» (401) de «no hay saldo» (400) sin leer texto. */
  const e = await fallaCon(() => json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401));
  assert.equal(e.kind, 'rechazado');
  assert.equal(e.status, 401);
  assert.ok(e.message.includes('invalid x-api-key'));
});

test('sin respuesta es su propia rama, sin estado', async () => {
  const e = await fallaCon(() => {
    throw new TypeError('fetch failed');
  });
  assert.equal(e.kind, 'sin_respuesta');
  assert.equal(e.status, null);
});

test('se leen los CUATRO contadores, caché incluida', async () => {
  /* El origen tiraba los de caché aunque marcaba el system para cachear: se cobraban sin quedar en
     ningún lado. */
  const { salida } = await interceptando(() => respuestaDelModelo('{"a":1}'), () => callAnalyzer('s', 'u', 'sk'));
  assert.ok(!(salida instanceof Error));
  assert.deepEqual(salida.usage, { input: 1200, output: 300, cacheWrite: 900, cacheRead: 4000 });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL MOTOR: el veto también deja tokens, y el clasificador no se traga una llave rechazada
// ═══════════════════════════════════════════════════════════════════════════════

const transcripcion = parseTranscriptInput('Closer: hola\nProspecto: hola');

test('un veto `match:false` deja su motivo, sus tokens y su versión', async () => {
  /* El origen devolvía solo los tokens de entrada y salida en el veto, y 43 llamadas a Sonnet del
     historial no dicen cuánto costaron. */
  const { salida } = await interceptando(
    () => respuestaDelModelo('{"match": false, "reason": "es una reunión interna"}'),
    () => runAnalysis('HT', transcripcion, 'sk'),
  );
  assert.ok(!(salida instanceof Error));
  assert.equal(salida.matched, false);
  if (salida.matched) return;
  assert.equal(salida.reason, 'es una reunión interna');
  assert.equal(salida.usage.cacheRead, 4000);
  assert.equal(salida.rubricVersion, 'rubric.es.md@v8.1');
  assert.equal(salida.costUsd, null);
});

test('un análisis que coincide sale normalizado, con sus columnas', async () => {
  const { salida } = await interceptando(
    () => respuestaDelModelo('```json\n{"score": 7, "outcome": "no_cerrada"}\n```'),
    () => runAnalysis('HT', transcripcion, 'sk'),
  );
  assert.ok(!(salida instanceof Error));
  assert.equal(salida.matched, true);
  if (!salida.matched) return;
  assert.deepEqual(salida.cols, { score: 7, outcome: 'NO_CERRADA', scoreColor: 'VERDE' });
});

test('el clasificador RELANZA una llave rechazada, y devuelve null para lo demás', async () => {
  /* null significa «dejala para la próxima corrida». Con la llave revocada, el origen lo repetía
     reunión por reunión para siempre y el descubrimiento terminaba «bien» con cero reuniones nuevas. */
  const conLlaveMala = await interceptando(
    () => json({ type: 'error', error: { type: 'authentication_error', message: 'invalid' } }, 401),
    () => classifyCallType('texto', { apiKey: 'sk' }),
  );
  assert.ok(conLlaveMala.salida instanceof AnalyzerCallError && conLlaveMala.salida.status === 401);

  const conFalloDelServicio = await interceptando(
    () => json({ type: 'error', error: { type: 'overloaded_error', message: 'x' } }, 529),
    () => classifyCallType('texto', { apiKey: 'sk' }),
  );
  assert.equal(conFalloDelServicio.salida, null);

  const conBasura = await interceptando(() => respuestaDelModelo('no sé'), () => classifyCallType('texto', { apiKey: 'sk' }));
  assert.equal(conBasura.salida, null);
});

test('el clasificador conoce HT y OB; cualquier otra respuesta es OTRO', async () => {
  for (const [dice, sale] of [['OB', 'OB'], ['ht', 'HT'], ['PROSPECT_CARD', 'OTRO'], ['OTRO', 'OTRO']] as const) {
    const { salida } = await interceptando(
      () => respuestaDelModelo(JSON.stringify({ tipo: dice, reason: 'r' })),
      () => classifyCallType('texto', { apiKey: 'sk' }),
    );
    assert.ok(salida !== null && !(salida instanceof Error));
    assert.equal(salida.tipo, sale, `«${dice}» tenía que salir ${sale}`);
  }
});

test('el prompt del clasificador es el del origen, carácter por carácter', () => {
  /* Con OB y HT registrados en ese orden, el texto es idéntico al que clasificó el historial. Sacar OB
     del registro —la tentación de la fase HT— cambia esta huella, y es exactamente el cambio que
     sella los onboardings como OTRO. */
  const huella = createHash('sha256').update(buildClassifierSystem(), 'utf8').digest('hex');
  assert.equal(huella, HUELLA_DEL_CLASIFICADOR);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · tl;dv
// ═══════════════════════════════════════════════════════════════════════════════

async function tldvFallaCon(respuesta: () => Response, correr: () => Promise<unknown>): Promise<TldvError> {
  const { salida } = await interceptando(respuesta, correr);
  assert.ok(salida instanceof TldvError, `se esperaba un TldvError, llegó ${String(salida)}`);
  return salida;
}

test('tl;dv · una llave rechazada es `llave`, en el listado y en la transcripción', async () => {
  for (const estado of [401, 403]) {
    const e1 = await tldvFallaCon(() => json({ message: 'unauthorized' }, estado), () => listRecentMeetings('k'));
    assert.equal(e1.kind, 'llave');
    const e2 = await tldvFallaCon(() => json({ message: 'unauthorized' }, estado), () => fetchTranscript('k', 'm1'));
    assert.equal(e2.kind, 'llave');
  }
});

test('tl;dv · una transcripción que todavía no está es `no_lista`, no un fallo', async () => {
  /* Se retoma en la siguiente corrida. El mutante que la trata como fallo la marcaría FAILED para
     siempre, aunque el audio se procese diez minutos después. */
  const e404 = await tldvFallaCon(() => json({ message: 'not found' }, 404), () => fetchTranscript('k', 'm1'));
  assert.equal(e404.kind, 'no_lista');
  const vacia = await tldvFallaCon(() => json({ data: [] }), () => fetchTranscript('k', 'm1'));
  assert.equal(vacia.kind, 'no_lista');
});

test('tl;dv · un 404 en el LISTADO no es «todavía no»', async () => {
  const e = await tldvFallaCon(() => json({ message: 'not found' }, 404), () => listRecentMeetings('k'));
  assert.equal(e.kind, 'rechazado');
  assert.equal(e.status, 404);
});

test('tl;dv · el listado normaliza y elige como prospecto al de otro dominio', async () => {
  const { salida, peticiones } = await interceptando(
    () =>
      json({
        results: [
          {
            id: 'mtg_1',
            name: 'Discovery',
            happenedAt: 'Thu Sep 17 2026 10:31:08 GMT-0500',
            duration: 2734.4,
            organizer: { name: 'Valeria', email: 'valeria@ejemplo-agencia.com' },
            invitees: [
              { name: 'Valeria', email: 'valeria@ejemplo-agencia.com' },
              { name: 'Rubén', email: 'ruben@ejemplo-panaderia.com' },
            ],
          },
        ],
      }),
    () => listRecentMeetings('k'),
  );
  assert.ok(!(salida instanceof Error));
  assert.equal(peticiones[0]?.url, 'https://pasta.tldv.io/v1alpha1/meetings');
  assert.equal(peticiones[0]?.cabeceras.get('x-api-key'), 'k');
  const m = salida[0]!;
  assert.equal(m.externalMeetingId, 'mtg_1');
  assert.equal(m.prospectEmail, 'ruben@ejemplo-panaderia.com');
  assert.equal(m.happenedAt, '2026-09-17T15:31:08.000Z');
  assert.equal(m.durationSec, 2734);
});

test('tl;dv · la transcripción lee `data`, con tiempos en texto o en número', async () => {
  const { salida } = await interceptando(
    () => json({ data: [{ startTime: '00:01:05', endTime: 70, speaker: 'A', text: 'hola' }], language: 'es' }),
    () => fetchTranscript('k', 'm 1'),
  );
  assert.ok(!(salida instanceof Error));
  assert.equal(salida.segments[0]?.startSec, 65);
  assert.equal(salida.segments[0]?.endSec, 70);
  assert.equal(salida.fullText, '[A]: hola');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · LA ESPERA
// ═══════════════════════════════════════════════════════════════════════════════

test('`pedirExterno` respeta la espera que le pasan', { timeout: 5_000 }, async () => {
  /* Un servicio que no contesta nunca. Con la espera ignorada, el mutante espera los 240 s por
     omisión y esta prueba muere por su propio tope de 5 s: es la llamada colgada que se come la
     función entera, pagada y sin guardar. */
  const original = globalThis.fetch;
  globalThis.fetch = ((_url: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('tiempo agotado', 'TimeoutError')));
    })) as typeof globalThis.fetch;
  try {
    const desde = Date.now();
    const r = await pedirExterno('https://ejemplo.invalid/', { espera: 50 });
    assert.equal(r.tipo, 'sin_respuesta');
    assert.ok(Date.now() - desde < 2_000, `tardó ${Date.now() - desde} ms`);
  } finally {
    globalThis.fetch = original;
  }
});

test('la espera llega hasta el pedido: el análisis y tl;dv la pasan', { timeout: 5_000 }, async () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((_url: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('tiempo agotado', 'TimeoutError')));
    })) as typeof globalThis.fetch;
  try {
    await assert.rejects(callAnalyzer('s', 'u', 'sk', 50), (e: unknown) => e instanceof AnalyzerCallError && e.kind === 'sin_respuesta');
    await assert.rejects(listRecentMeetings('k', 50), (e: unknown) => e instanceof TldvError && e.kind === 'sin_respuesta');
    await assert.rejects(fetchTranscript('k', 'm', 50), (e: unknown) => e instanceof TldvError && e.kind === 'sin_respuesta');
  } finally {
    globalThis.fetch = original;
  }
});

/* Sacada del prompt que arma `buildClassifierSystem` con OB y HT registrados, el 2026-09-22. El
   texto es el del anexo `engine.ts`, cuyo sha256 coincidió con el MANIFIESTO del paquete. */
const HUELLA_DEL_CLASIFICADOR = 'ad903cdbba0201955344e30d569d69f559e9cb7c3231fc7273db726d339d36cd';
