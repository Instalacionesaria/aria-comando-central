// EL ERROR DE UN ANÁLISIS NO GUARDA TEXTO DEL MODELO. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// Cuando el modelo contestaba algo que no era JSON, el error del análisis llevaba los primeros 200
// caracteres de la respuesta (`text.slice(0, 200)`). Ese error se guarda en la llamada, se dibuja en la
// lista de los Analizadores y viaja en la respuesta de la API, y la respuesta de un análisis empieza por
// lo que dijo el cliente: su nombre, su negocio, cuánto factura. Desde AG2 de los agentes
// (`docs/OTROS/agentes/08-LAS-ETAPAS.md`) el error es `sin_estructura`, con el uso de lo que se pagó y
// sin una palabra de la respuesta.
//
// Y de paso, que ese error y los demás del transporte se traduzcan a las situaciones `IA-*` con los mismos
// datos que vio el proveedor (`falloDelModeloDe`): sin eso, el uso y el incidente dirían otra cosa que el
// registro. Lo mismo con los cortes de la clasificación (un truncado no es «sin estructura»), y la llave,
// que no viaja en el fallo del auditor ahora que ese fallo llega al incidente.
//
// Sin red: `globalThis.fetch` se reemplaza en cada prueba. Ninguna gasta.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalyzerCallError, falloDelModeloDe } from '../../lib/analizadores/nucleo/anthropic.ts';
import { classifyCallType, runAnalysis, runInsight, type LoQueCostoClasificar } from '../../lib/analizadores/nucleo/engine.ts';
import { parseTranscriptInput } from '../../lib/analizadores/nucleo/transcript.ts';
import { clasificarFallo } from '../../lib/fundaciones/fallo-del-modelo.ts';
import { pedirVeredicto } from '../../lib/auditor/modelo.ts';
import { archivosFuente } from '../apoyo/fuente.ts';

/** Lo que dijo el cliente, y por eso lo que la respuesta del modelo repite primero. */
const LO_QUE_DIJO_EL_CLIENTE = 'Me llamo Rubén, vendo cursos de cerámica y facturo cuatro mil al mes';

const USO = { input_tokens: 900, output_tokens: 120, cache_creation_input_tokens: 0, cache_read_input_tokens: 40 };

async function conElModeloDiciendo<T>(texto: string, correr: () => Promise<T>): Promise<T | Error> {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ content: [{ type: 'text', text: texto }], stop_reason: 'end_turn', usage: USO }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof globalThis.fetch;
  try {
    return await correr();
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e));
  } finally {
    globalThis.fetch = original;
  }
}

const TRANSCRIPCION = parseTranscriptInput(`[00:01] Prospecto: ${LO_QUE_DIJO_EL_CLIENTE}`, 'manual');
/** Un comienzo de respuesta que no cierra el JSON, como los que llegaban al registro. */
const RESPUESTA_ROTA = `Resumen: ${LO_QUE_DIJO_EL_CLIENTE}. {"score": 7, "outcome": `;

function comprobarElError(e: unknown, quePaso: string): void {
  assert.ok(e instanceof AnalyzerCallError, `${quePaso}: no es un AnalyzerCallError: ${String(e)}`);
  assert.equal(e.kind, 'sin_estructura');
  for (const pedazo of ['Rubén', 'cerámica', 'Resumen', '"score"']) {
    assert.ok(!e.message.includes(pedazo), `${quePaso}: el error guarda texto del modelo («${pedazo}»): ${e.message}`);
  }
  // Se pagó: los contadores viajan con el error para el uso.
  assert.deepEqual(e.detalle.uso, { input: 900, output: 120, cacheWrite: 0, cacheRead: 40 });
  assert.equal(clasificarFallo(falloDelModeloDe(e)!), 'IA-ESTRUCTURA');
}

test('el análisis que no es JSON falla con `sin_estructura`, sin el comienzo de la respuesta', async () => {
  const e = await conElModeloDiciendo(RESPUESTA_ROTA, () => runAnalysis('HT', TRANSCRIPCION, 'ia-falsa', 60_000));
  comprobarElError(e, 'el análisis');
  assert.equal((e as Error).message, 'El modelo no devolvió JSON parseable.');
});

test('la ficha que no es JSON tampoco guarda la respuesta', async () => {
  const e = await conElModeloDiciendo(RESPUESTA_ROTA, () => runInsight('PROSPECT_CARD', TRANSCRIPCION, { apiKey: 'ia-falsa', waitMs: 60_000 }));
  comprobarElError(e, 'la ficha');
});

test('la clasificación que no es JSON devuelve null, como siempre, y cuenta lo que costó', async () => {
  const costos: LoQueCostoClasificar[] = [];
  const r = await conElModeloDiciendo(`Creo que ${LO_QUE_DIJO_EL_CLIENTE}`, () =>
    classifyCallType(TRANSCRIPCION.fullText, { apiKey: 'ia-falsa', alTerminar: async (c) => void costos.push(c) }),
  );
  assert.equal(r, null);
  assert.equal(costos.length, 1);
  assert.equal(costos[0]!.modelo, 'claude-haiku-4-5');
  assert.deepEqual(costos[0]!.uso, { input: 900, output: 120, cacheWrite: 0, cacheRead: 40 });
  assert.deepEqual(costos[0]!.fallo, { tipo: 'sin_estructura' });
});

test('la clasificación que salió bien también cuenta, sin fallo', async () => {
  const costos: LoQueCostoClasificar[] = [];
  const r = await conElModeloDiciendo('{"tipo": "HT", "reason": "es una venta"}', () =>
    classifyCallType(TRANSCRIPCION.fullText, { apiKey: 'ia-falsa', alTerminar: async (c) => void costos.push(c) }),
  );
  assert.deepEqual(r, { tipo: 'HT', reason: 'es una venta' });
  assert.deepEqual(
    costos.map((c) => ({ fallo: c.fallo, uso: c.uso })),
    [{ fallo: null, uso: { input: 900, output: 120, cacheWrite: 0, cacheRead: 40 } }],
  );
});

test('los errores del transporte se traducen con lo que mandó el proveedor', () => {
  const casos: [AnalyzerCallError, string][] = [
    [new AnalyzerCallError('rechazado', 'Anthropic 401: invalid x-api-key', 401, { codigo: 'authentication_error', motivo: 'invalid x-api-key' }), 'IA-LLAVE'],
    [
      new AnalyzerCallError('rechazado', 'x', 400, {
        codigo: 'invalid_request_error',
        motivo: 'Your credit balance is too low to access the Anthropic API.',
      }),
      'IA-SIN-SALDO',
    ],
    [new AnalyzerCallError('rechazado', 'x', 529, { codigo: 'overloaded_error', motivo: 'Overloaded' }), 'IA-SATURADO'],
    // La causa tal cual, con su comienzo: es lo que separa el tiempo agotado de una conexión caída.
    [new AnalyzerCallError('sin_respuesta', 'x', null, { causa: 'se agotó el tiempo de espera a los 270 s (el tope es 270 s)' }), 'IA-TIEMPO'],
    [new AnalyzerCallError('truncado', 'x'), 'IA-TRUNCADO'],
    [new AnalyzerCallError('declino', 'x'), 'IA-DECLINO'],
    [new AnalyzerCallError('sin_texto', 'x'), 'IA-VACIO'],
  ];
  for (const [e, situacion] of casos) assert.equal(clasificarFallo(falloDelModeloDe(e)!), situacion, e.kind);
  // Lo que no es del modelo no se traduce: no deja uso ni incidente.
  assert.equal(falloDelModeloDe(new Error('la base rechazó la escritura')), null);
});

test('el núcleo no corta la respuesta del modelo para meterla en un error', () => {
  /* La forma que tenía el defecto. Un `slice` sobre `text` dentro de un `throw` vuelve a poner lo que
     dijo el cliente en la lista de los Analizadores. */
  const archivos = archivosFuente(['lib/analizadores']);
  assert.ok(archivos.some((a) => a.ruta === 'lib/analizadores/nucleo/engine.ts'), 'no se leyó el núcleo');
  for (const { ruta, limpio } of archivos) {
    for (const linea of limpio.split('\n')) {
      if (/throw\b/.test(linea)) {
        assert.ok(!/\btext\b[^;]*\.slice\(/.test(linea), `${ruta}: un error lleva un pedazo de la respuesta: ${linea.trim()}`);
      }
    }
  }
});

test('la clasificación nombra sus cortes: un truncado o un rechazo no se anotan como «sin estructura»', async () => {
  /* Con un techo de 400 tokens, un truncado leído como JSON roto mandaba a revisar el esquema en vez de
     subir el techo. Devuelve null igual: lo que cambia es lo que queda en el uso y en el incidente. */
  for (const [stop_reason, texto, tipo] of [
    ['max_tokens', '{"tipo": "HT", "reason": "es una ven', 'truncado'],
    ['refusal', '', 'declino'],
    ['end_turn', '   ', 'sin_texto'],
  ] as const) {
    const costos: LoQueCostoClasificar[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ content: [{ type: 'text', text: texto }], stop_reason, usage: USO }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof globalThis.fetch;
    try {
      const r = await classifyCallType(TRANSCRIPCION.fullText, { apiKey: 'ia-falsa', alTerminar: async (c) => void costos.push(c) });
      assert.equal(r, null, stop_reason);
    } finally {
      globalThis.fetch = original;
    }
    assert.deepEqual(costos.map((c) => c.fallo), [{ tipo }], stop_reason);
    assert.deepEqual(costos[0]!.uso, { input: 900, output: 120, cacheWrite: 0, cacheRead: 40 }, `${stop_reason}: se pagó`);
  }
});

test('el fallo del auditor no lleva la llave: desde AG2 su frase va al registro y al incidente', async () => {
  /* Una llave con un carácter que no puede ir en una cabecera hace que `fetch` la copie en su mensaje.
     Antes esa frase sólo llegaba al reporte de la corrida; ahora llega a `negocio.incidentes.tecnico`. */
  const llave = 'sk-ant-una-llave-de-pruebaé';
  for (const responder of [
    async () => {
      throw new TypeError(`Invalid header value: ${llave}`);
    },
    async () =>
      new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: `bad key ${llave}` } }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
  ]) {
    const original = globalThis.fetch;
    globalThis.fetch = responder as typeof globalThis.fetch;
    try {
      const r = await pedirVeredicto({ claveIa: llave, agente: 'chat_post_agenda', instrucciones: 'x', patrones: [], conversacion: 'x' });
      assert.ok(r.tipo === 'sin_respuesta' || r.tipo === 'rechazado', `vino ${r.tipo}`);
      assert.ok(!JSON.stringify(r).includes(llave), `la llave quedó en el fallo: ${JSON.stringify(r)}`);
    } finally {
      globalThis.fetch = original;
    }
  }
});
