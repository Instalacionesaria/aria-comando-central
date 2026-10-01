// Un fallo del modelo se nombra: qué pasó, a quién le toca y una referencia para encontrarlo.
//
// Hasta el 2026-10-01 todos llegaban con el mismo párrafo, y quien lo leía solo podía escribir
// «falló otra vez». Ver el encabezado de `lib/fundaciones/fallo-del-modelo.ts`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { clasificarFallo, rechazoDelModelo } from '../../lib/fundaciones/fallo-del-modelo.ts';
import { mensajeDeRechazo } from '../../lib/fundaciones/mensajes.ts';
import { generar } from '../../lib/fundaciones/generacion.ts';

test('cada fallo cae en su situación, y la falta de saldo NO se confunde con un 400 nuestro', () => {
  const casos = [
    [{ tipo: 'rechazado', estado: 400, codigo: 'invalid_request_error', motivo: 'Your credit balance is too low' }, 'IA-SIN-SALDO'],
    [{ tipo: 'rechazado', estado: 400, codigo: 'invalid_request_error', motivo: 'max_tokens: 99999 > 64000' }, 'IA-PETICION'],
    [{ tipo: 'rechazado', estado: 401, codigo: 'authentication_error', motivo: 'invalid x-api-key' }, 'IA-LLAVE'],
    [{ tipo: 'rechazado', estado: 403, codigo: 'permission_error', motivo: null }, 'IA-PERMISO'],
    [{ tipo: 'rechazado', estado: 404, codigo: 'not_found_error', motivo: null }, 'IA-MODELO'],
    [{ tipo: 'rechazado', estado: 413, codigo: 'request_too_large', motivo: null }, 'IA-GRANDE'],
    [{ tipo: 'rechazado', estado: 429, codigo: 'rate_limit_error', motivo: null }, 'IA-LIMITE'],
    [{ tipo: 'rechazado', estado: 529, codigo: 'overloaded_error', motivo: null }, 'IA-SATURADO'],
    [{ tipo: 'rechazado', estado: 500, codigo: 'api_error', motivo: null }, 'IA-SATURADO'],
    [{ tipo: 'rechazado', estado: 418, codigo: 'sin_codigo', motivo: null }, 'IA-OTRO'],
    // El caso de Jorge del 2026-10-01.
    [{ tipo: 'sin_respuesta', causa: 'fetch failed (tras 301 s)' }, 'IA-CONEXION'],
    [{ tipo: 'sin_respuesta', causa: 'se agotó el tiempo de espera a los 580 s (el tope es 580 s)' }, 'IA-TIEMPO'],
    [{ tipo: 'sin_respuesta', causa: 'el modelo cortó a mitad: overloaded_error · Overloaded' }, 'IA-SATURADO'],
    [{ tipo: 'sin_texto' }, 'IA-VACIO'],
    [{ tipo: 'truncado' }, 'IA-TRUNCADO'],
    [{ tipo: 'declino' }, 'IA-DECLINO'],
    [{ tipo: 'sin_estructura' }, 'IA-ESTRUCTURA'],
  ] as const;
  for (const [fallo, esperada] of casos) {
    assert.equal(clasificarFallo(fallo), esperada, JSON.stringify(fallo));
  }
});

test('la pantalla dice a quién le toca, y la MISMA referencia queda en el registro', async () => {
  const lineas: string[] = [];
  const original = console.error;
  console.error = (...partes: unknown[]) => void lineas.push(partes.map(String).join(' '));
  let r: Response;
  try {
    r = await rechazoDelModelo(
      { tipo: 'sin_respuesta', causa: 'fetch failed (tras 301 s)' },
      { origen: 'generar', orgId: 'org-1', donde: 'Research paso 1' },
    );
  } finally {
    console.error = original;
  }
  const cuerpo = (await r.json()) as { codigo: string; detalle: string };
  assert.equal(r.status, 502);
  assert.equal(cuerpo.codigo, 'modelo_no_disponible');

  const ref = /ref ([A-Z0-9]{6})/.exec(cuerpo.detalle)?.[1];
  assert.ok(ref, 'el detalle no trae referencia');
  // El registro: buscable por la referencia, y con dónde y de quién.
  assert.equal(lineas.length, 1);
  assert.match(lineas[0]!, new RegExp(`^incidente IA-CONEXION · ref ${ref} · generar · Research paso 1 · org org-1 · `));

  const texto = mensajeDeRechazo(cuerpo.codigo, r.status, cuerpo.detalle);
  assert.match(texto, /^Se cortó la conexión con el modelo/);
  assert.match(texto, /mandale este código al equipo de ARIA/);
  assert.match(texto, new RegExp(`\\nCódigo IA-CONEXION · ref ${ref} — sin respuesta: fetch failed \\(tras 301 s\\)$`));
  // El párrafo genérico de antes ya no aparece.
  assert.doesNotMatch(texto, /Cualquier otra cosa suele ser pasajera/);
});

test('cada situación termina diciendo qué hacer: ninguna cae en el texto genérico', () => {
  for (const s of [
    'IA-CONEXION', 'IA-TIEMPO', 'IA-SIN-SALDO', 'IA-LLAVE', 'IA-PERMISO', 'IA-LIMITE', 'IA-SATURADO',
    'IA-MODELO', 'IA-PETICION', 'IA-GRANDE', 'IA-VACIO', 'IA-TRUNCADO', 'IA-DECLINO', 'IA-ESTRUCTURA', 'IA-OTRO',
  ]) {
    const texto = mensajeDeRechazo('modelo_no_disponible', 502, `${s} · ref ABC234 · algo`);
    assert.match(texto, new RegExp(`Código ${s} · ref ABC234`), `${s} no muestra su código`);
    assert.doesNotMatch(texto, /El modelo no respondió, y el detalle/, `${s} cae en el párrafo genérico`);
  }
  // Un detalle sin la forma nueva (un servidor viejo) sigue mostrándose como antes, no se pierde.
  assert.match(mensajeDeRechazo('modelo_no_disponible', 502, 'sin respuesta'), /\(sin respuesta\)$/);
});

// ── El reintento ──────────────────────────────────────────────────────────────

const flujoBueno = () =>
  new Response(
    [
      { type: 'message_start', message: { usage: { input_tokens: 1 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: 'listo' } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } },
      { type: 'message_stop' },
    ]
      .map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)
      .join(''),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );

const rechazo = (estado: number, tipo: string) => () =>
  new Response(JSON.stringify({ type: 'error', error: { type: tipo, message: 'x' } }), {
    status: estado,
    headers: { 'content-type': 'application/json' },
  });

async function conRespuestas(respuestas: (() => Response)[]) {
  let llamadas = 0;
  const original = globalThis.fetch;
  const avisoOriginal = console.warn;
  console.warn = () => {};
  globalThis.fetch = (async () => {
    const r = respuestas[Math.min(llamadas, respuestas.length - 1)]!;
    llamadas++;
    return r();
  }) as typeof globalThis.fetch;
  try {
    const salida = await generar({ claveIa: 'k', prompt: 'hola', tokens: 10 });
    return { salida, llamadas };
  } finally {
    globalThis.fetch = original;
    console.warn = avisoOriginal;
  }
}

test('Anthropic saturado se reintenta UNA vez, y la persona ni se entera', async () => {
  const { salida, llamadas } = await conRespuestas([rechazo(529, 'overloaded_error'), flujoBueno]);
  assert.equal(llamadas, 2);
  assert.equal(salida.tipo, 'datos');

  // Y si el segundo también falla, no hay tercero: se muestra ese fallo.
  const dos = await conRespuestas([rechazo(529, 'overloaded_error')]);
  assert.equal(dos.llamadas, 2);
  assert.equal(dos.salida.tipo, 'rechazado');
});

test('un fallo que NO es pasajero no se reintenta: reintentar sin saldo solo gasta tiempo', async () => {
  for (const r of [rechazo(400, 'invalid_request_error'), rechazo(401, 'authentication_error'), rechazo(429, 'rate_limit_error')]) {
    const { llamadas } = await conRespuestas([r, flujoBueno]);
    assert.equal(llamadas, 1);
  }
});

test('el Panel de Incidentes sabe a quién le toca CADA situación que la pantalla conoce', async () => {
  const { QUIEN_DE_LA_SITUACION } = await import('../../lib/incidentes/panel.ts');
  const { leerFalloDelModelo } = await import('../../lib/fundaciones/mensajes.ts');
  for (const s of Object.keys(QUIEN_DE_LA_SITUACION)) {
    assert.ok(leerFalloDelModelo(`${s} · ref ABC234 · x`), `${s} está en el panel y no tiene texto en pantalla`);
  }
  // Y al revés: toda situación que clasifica el servidor tiene su color en el panel.
  const casos = ['IA-CONEXION', 'IA-TIEMPO', 'IA-SIN-SALDO', 'IA-LLAVE', 'IA-PERMISO', 'IA-LIMITE', 'IA-SATURADO',
    'IA-MODELO', 'IA-PETICION', 'IA-GRANDE', 'IA-VACIO', 'IA-TRUNCADO', 'IA-DECLINO', 'IA-ESTRUCTURA', 'IA-OTRO'];
  assert.deepEqual(Object.keys(QUIEN_DE_LA_SITUACION).sort(), [...casos].sort());
});
