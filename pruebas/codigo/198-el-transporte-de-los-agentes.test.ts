// EL TRANSPORTE DE LOS AGENTES NUEVOS. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/llamada.ts` y lo que lo rodea (AG1). Sus defectos no fallan solos: se ven en la factura, en
// una pantalla que dice «el modelo no respondió» por un error nuestro, o en un panel que no se entera de
// que el proveedor falla seguido.
//
//   · Sale sólo por `pedirExterno`, con un cuerpo que `claude-sonnet-5-5` acepta: sin herramienta forzada.
//   · Un reintento, sólo si el fallo es pasajero y llegó temprano. Nunca ante la falta de saldo.
//   · Cada final tiene su situación, y la referencia que ve la pantalla es la de la línea de registro.
//   · Las tareas del cron agregan sus incidentes: el transporte no los escribe uno por uno.
//   · Los cuatro contadores, y la llave fuera de todo texto.
//   · Cada tabla de los agentes tiene un solo escritor.
//
// Sin red y sin base: `globalThis.fetch` se reemplaza en cada prueba, y la organización es `org-1`, que no
// es un uuid, así que el uso y el incidente vuelven sin escribir (`lib/incidentes/registro.ts`). El reloj y
// la pausa entran por la costura: ningún caso espera de verdad.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente } from '../apoyo/fuente.ts';
import {
  PAUSA_ANTES_DE_REINTENTAR_MS,
  VENTANA_DE_REINTENTO_MS,
  type Costuras,
  type PedidoAlModelo,
  type ResultadoDeLlamada,
  leerHerramienta,
  leerJson,
  llamarAlModelo,
} from '../../lib/agentes/llamada.ts';
import { registrarUso } from '../../lib/agentes/uso.ts';
import { detalleDelFallo } from '../../lib/fundaciones/fallo-del-modelo.ts';
import { leerFalloDelModelo } from '../../lib/fundaciones/mensajes.ts';

// ═══ La red falsa, con un reloj que la red puede adelantar ═══════════════════

interface Peticion {
  url: string;
  cuerpo: Record<string, unknown>;
  cabeceras: Headers;
}

/** Una respuesta de la red falsa: devuelve un `Response`, o tira como tira `fetch`. */
type Respuesta = () => Response;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

const USO = { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 50, cache_read_input_tokens: 3000 };

/** Así empieza una respuesta de `claude-sonnet-5-5`: un pensamiento vacío antes del texto. */
const respuestaBuena =
  (extra: Record<string, unknown> = {}): Respuesta =>
  () =>
    json({
      content: [
        { type: 'thinking', thinking: '', signature: 'firma' },
        { type: 'text', text: '{"ok":true}' },
      ],
      stop_reason: 'end_turn',
      usage: USO,
      ...extra,
    });

const rechazo =
  (estado: number, tipo: string, mensaje = 'x'): Respuesta =>
  () =>
    json({ type: 'error', error: { type: tipo, message: mensaje } }, estado);

const sinRed =
  (mensaje = 'fetch failed'): Respuesta =>
  () => {
    throw new TypeError(mensaje);
  };

/** Lo que tira `AbortSignal.timeout` al cumplirse: un `TimeoutError`. */
const tiempoAgotado = (): Respuesta => () => {
  throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
};

const LLAVE = 'sk-de-prueba-que-no-sale';
const ESQUEMA = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false };

const PEDIDO: PedidoAlModelo<unknown> = {
  agente: 'brief',
  modelo: 'claude-sonnet-5-5',
  llave: LLAVE,
  orgId: 'org-1',
  usuarioId: null,
  techo: 2_000,
  instrucciones: 'LAS INSTRUCCIONES',
  mensajes: [{ role: 'user', content: 'EL PEDIDO' }],
  formato: ESQUEMA,
  leer: leerJson,
};

/**
 * Corre el transporte contra la red falsa. `adelanto` es lo que el reloj avanza en cada pedido: así un
 * fallo puede llegar «a los cien segundos» sin que la prueba espere uno.
 */
async function conLaRed(
  respuestas: readonly Respuesta[],
  pedido: Partial<PedidoAlModelo<unknown>> = {},
  adelanto = 0,
): Promise<{ salida: ResultadoDeLlamada<unknown>; peticiones: Peticion[]; errores: string[]; avisos: string[] }> {
  const peticiones: Peticion[] = [];
  const errores: string[] = [];
  const avisos: string[] = [];
  let reloj = 1_000_000;
  const costuras: Costuras = {
    ahora: () => reloj,
    pausa: async (ms) => {
      reloj += ms;
    },
  };
  const original = globalThis.fetch;
  const errorOriginal = console.error;
  const avisoOriginal = console.warn;
  console.error = (...partes: unknown[]) => {
    errores.push(partes.map(String).join(' '));
    /* Escribir la línea del incidente «cuesta» un minuto: así se ve que la duración de la llamada se midió
       ANTES de anotar, y no se le suma lo que tardan las escrituras. */
    reloj += 60_000;
  };
  console.warn = (...partes: unknown[]) => void avisos.push(partes.map(String).join(' '));
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    // Una cabecera inválida no puede romper la red falsa: el pedido tiene que quedar contado igual.
    let cabeceras: Headers;
    try {
      cabeceras = new Headers(init?.headers);
    } catch {
      cabeceras = new Headers();
    }
    peticiones.push({
      url: String(url),
      // Serializado y vuelto a leer A PROPÓSITO: es lo que viaja, no lo que se armó.
      cuerpo: JSON.parse(String(init?.body)) as Record<string, unknown>,
      cabeceras,
    });
    reloj += adelanto;
    return respuestas[Math.min(peticiones.length, respuestas.length) - 1]!();
  }) as typeof globalThis.fetch;
  try {
    const salida = await llamarAlModelo({ ...PEDIDO, ...pedido }, costuras);
    return { salida, peticiones, errores, avisos };
  } finally {
    globalThis.fetch = original;
    console.error = errorOriginal;
    console.warn = avisoOriginal;
  }
}

// ═══ 1 · El camino y el cuerpo ════════════════════════════════════════════════

test('sale por `pedirExterno`, con la llave en su cabecera y un cuerpo que `claude-sonnet-5-5` acepta', async () => {
  /* La herramienta forzada, que el auditor usa con `claude-sonnet-5`, en `claude-sonnet-5-5` es un 400
     (`tool_choice` de tipo `tool` o `any`): el mutante que «unifica» con el auditor pierde TODAS las
     llamadas, y ninguna otra prueba con la red falseada lo vería. Por eso el cuerpo se compara entero. */
  const { salida, peticiones } = await conLaRed([respuestaBuena()], {
    herramientas: [
      { nombre: 'uno', descripcion: 'la primera', esquema: ESQUEMA, estricta: true },
      // Sin `estricta` no viaja `strict`: el proveedor admite 20 estrictas por pedido.
      { nombre: 'dos', descripcion: 'la segunda', esquema: ESQUEMA, estricta: false },
    ],
  });
  assert.equal(salida.tipo, 'datos');
  assert.equal(peticiones.length, 1);
  const p = peticiones[0]!;
  assert.equal(p.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(p.cabeceras.get('x-api-key'), LLAVE);
  assert.equal(p.cabeceras.get('anthropic-version'), '2023-06-01');
  assert.deepEqual(p.cuerpo, {
    model: 'claude-sonnet-5-5',
    max_tokens: 2_000,
    system: [{ type: 'text', text: 'LAS INSTRUCCIONES', cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: 'EL PEDIDO' }],
    tools: [
      { name: 'uno', description: 'la primera', input_schema: ESQUEMA, strict: true },
      { name: 'dos', description: 'la segunda', input_schema: ESQUEMA, cache_control: { type: 'ephemeral' } },
    ],
    output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
  });

  /* Y en el código: nada en `lib/agentes` hace su propia petición ni entra a identidad. `ADR-0305` lo
     exige para todo el proyecto (`pruebas/codigo/30-portero.test.ts`); acá se repite para esta carpeta,
     como la 171 para la suya. */
  const propios = archivosFuente(['lib/agentes']);
  const transporte = propios.find((a) => a.ruta === 'lib/agentes/llamada.ts');
  assert.ok(transporte, 'no se encontró el transporte');
  for (const a of propios) {
    assert.doesNotMatch(a.limpio, /\bfetch\s*\(|XMLHttpRequest|axios|navigator\.sendBeacon|new\s+EventSource/, `${a.ruta} hace su propia petición`);
    assert.doesNotMatch(a.limpio, /\bconIdentidad\b/, `${a.ruta} entra a identidad sin filtro`);
  }
  assert.match(transporte.limpio, /\bpedirExterno\s*[<(]/);
});

test('con UNA herramienta y sin formato —la ronda del cerebro, la forma del auditor— tampoco se fuerza', async () => {
  /* El auditor fuerza su única herramienta (`tool_choice` `tool`); copiar eso acá es el 400 de todas las
     rondas del cerebro. Se compara el cuerpo entero, sin `tool_choice` y sin `output_config`. */
  const { peticiones } = await conLaRed(
    [() => json({ content: [{ type: 'tool_use', id: 't', name: 'responder', input: { ok: true } }], stop_reason: 'tool_use', usage: USO })],
    { herramientas: [{ nombre: 'responder', descripcion: 'la respuesta', esquema: ESQUEMA, estricta: true }], formato: undefined, leer: leerHerramienta('responder') },
  );
  assert.deepEqual(peticiones[0]!.cuerpo, {
    model: 'claude-sonnet-5-5',
    max_tokens: 2_000,
    system: [{ type: 'text', text: 'LAS INSTRUCCIONES', cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: 'EL PEDIDO' }],
    tools: [{ name: 'responder', description: 'la respuesta', input_schema: ESQUEMA, strict: true, cache_control: { type: 'ephemeral' } }],
  });
});

test('lo opcional viaja sólo cuando se pide: esfuerzo, `tool_choice` `none` y el caché de la conversación', async () => {
  /* El esfuerzo va DENTRO de `output_config`, junto al formato; `tool_choice` nunca fuerza; el caché de
     la cola es el `cache_control` de primer nivel. Sin pedirlos, el cuerpo de la prueba de arriba no los
     lleva: a Haiku 4.5 un `effort` lo rechaza. */
  const { peticiones } = await conLaRed([respuestaBuena()], {
    herramientas: [{ nombre: 'uno', descripcion: 'la primera', esquema: ESQUEMA, estricta: true }],
    esfuerzo: 'medium',
    herramientasPermitidas: 'none',
    cachearLaConversacion: true,
  });
  const c = peticiones[0]!.cuerpo;
  assert.deepEqual(c['output_config'], { format: { type: 'json_schema', schema: ESQUEMA }, effort: 'medium' });
  assert.deepEqual(c['tool_choice'], { type: 'none' });
  assert.deepEqual(c['cache_control'], { type: 'ephemeral' });

  // Sin herramientas, `tool_choice` no viaja aunque se pida: la API lo rechaza sin `tools`.
  const sinHerramientas = await conLaRed([respuestaBuena()], { herramientasPermitidas: 'none' });
  assert.ok(!('tool_choice' in sinHerramientas.peticiones[0]!.cuerpo));

  // Sin formato, el esfuerzo solo.
  const solo = await conLaRed([() => json({ content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn', usage: USO })], {
    formato: undefined,
    esfuerzo: 'low',
  });
  assert.deepEqual(solo.peticiones[0]!.cuerpo['output_config'], { effort: 'low' });

  // A Haiku 4.5 el esfuerzo no viaja aunque se pida: lo rechaza con un 400, y clasificar barato invita a pedirlo.
  const haiku = await conLaRed([respuestaBuena()], { modelo: 'claude-haiku-4-5-20251001', esfuerzo: 'low' });
  assert.deepEqual(haiku.peticiones[0]!.cuerpo['output_config'], { format: { type: 'json_schema', schema: ESQUEMA } });
});

// ═══ 2 · El reintento ═════════════════════════════════════════════════════════

test('un fallo pasajero se reintenta UNA vez, y si sale bien la persona no ve nada', async () => {
  for (const primero of [rechazo(529, 'overloaded_error'), rechazo(500, 'api_error'), sinRed()]) {
    const { salida, peticiones, errores, avisos } = await conLaRed([primero, respuestaBuena()]);
    assert.equal(peticiones.length, 2);
    assert.ok(salida.tipo === 'datos');
    assert.match(salida.salvadoDe ?? '', /^IA-(SATURADO|CONEXION)$/);
    // El segundo pedido es el MISMO cuerpo: un reintento no es otra pregunta.
    assert.deepEqual(peticiones[1]!.cuerpo, peticiones[0]!.cuerpo);
    // Ninguna línea de incidente: la persona no vio nada. Sí el aviso, con la referencia del salvado.
    assert.deepEqual(errores, []);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0]!, /^brief: reintento tras IA-(SATURADO|CONEXION) · ref [A-Z0-9]{6} a los 0 s$/);
  }
  /* Y si el segundo también falla, no hay tercero: se muestra ESE fallo, el segundo. Dos situaciones
     distintas, para que devolver o anotar el primero no pase. */
  const dos = await conLaRed([sinRed(), rechazo(529, 'overloaded_error')]);
  assert.equal(dos.peticiones.length, 2);
  assert.ok(dos.salida.tipo === 'fallo' && dos.salida.situacion === 'IA-SATURADO');
  assert.equal(dos.errores.length, 1);
  assert.match(dos.errores[0]!, /^incidente IA-SATURADO · ref /);
});

test('lo que no es pasajero no se reintenta: sin saldo, reintentar sólo gasta tiempo', async () => {
  const casos: [Respuesta, string][] = [
    [rechazo(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API.'), 'IA-SIN-SALDO'],
    [rechazo(401, 'authentication_error'), 'IA-LLAVE'],
    [rechazo(429, 'rate_limit_error'), 'IA-LIMITE'],
    [rechazo(400, 'invalid_request_error', 'tool_choice: type tool and any are not supported for this model.'), 'IA-PETICION'],
    [rechazo(404, 'not_found_error'), 'IA-MODELO'],
    [tiempoAgotado(), 'IA-TIEMPO'],
    [respuestaBuena({ stop_reason: 'max_tokens' }), 'IA-TRUNCADO'],
    // La ventana de contexto llena también es un corte: el JSON a medias no es un esquema mal escrito.
    [respuestaBuena({ stop_reason: 'model_context_window_exceeded' }), 'IA-TRUNCADO'],
    [respuestaBuena({ stop_reason: 'refusal' }), 'IA-DECLINO'],
  ];
  for (const [primera, situacion] of casos) {
    const { salida, peticiones } = await conLaRed([primera, respuestaBuena()]);
    assert.equal(peticiones.length, 1, `${situacion} se reintentó`);
    assert.ok(salida.tipo === 'fallo', `${situacion} no llegó como fallo`);
    assert.equal(salida.situacion, situacion);
  }
});

test('un fallo pasajero que llegó TARDE no se reintenta: el segundo no tendría dónde caber', async () => {
  const saturado = () => [rechazo(529, 'overloaded_error'), respuestaBuena()];
  assert.equal((await conLaRed(saturado(), {}, VENTANA_DE_REINTENTO_MS + 1)).peticiones.length, 1);
  // La entrada muerta: justo en la ventana SÍ se reintenta. Sin esto, uno que no reintentara nunca pasaría.
  assert.equal((await conLaRed(saturado(), {}, VENTANA_DE_REINTENTO_MS)).peticiones.length, 2);

  // Con una espera corta, «temprano» es la mitad de lo que deja la pausa: el segundo intento tiene al
  // menos tanto tiempo como el que se llevó el primero.
  const espera = 20_000;
  const limite = (espera - PAUSA_ANTES_DE_REINTENTAR_MS) / 2;
  assert.equal((await conLaRed(saturado(), { espera }, limite + 1)).peticiones.length, 1);
  assert.equal((await conLaRed(saturado(), { espera }, limite)).peticiones.length, 2);

  /* Y el segundo usa lo que QUEDA del tope, no uno entero (el criterio de `generar`). Se mide por lo que
     viaja: `pedirExterno` escribe el tope que recibió en la causa del tiempo agotado. El primer intento se
     lleva 10 s y la pausa 3: al segundo le quedan 227 s. «El tope entero» diría 240 y «el tope menos la
     pausa», 237. */
  const reintento = await conLaRed([rechazo(529, 'overloaded_error'), tiempoAgotado()], {}, 10_000);
  assert.equal(reintento.peticiones.length, 2);
  assert.ok(reintento.salida.tipo === 'fallo');
  assert.equal(reintento.salida.situacion, 'IA-TIEMPO');
  assert.match(reintento.salida.tecnico, /\(el tope es 227 s\)$/);
});

test('sin tiempo antes de empezar es un tiempo agotado, sin pedido y sin reintento', async () => {
  /* El cron calcula la espera con lo que le queda, y puede llegar en cero, negativa o sin número. Con cero
     el pedido cortaría antes de salir; negativa, el reloj del pedido tiraría y saldría como una conexión
     cortada, que culpa a la red. Nada de eso es la red. */
  for (const espera of [0, -5_000, Number.NaN, Number.NEGATIVE_INFINITY]) {
    const { salida, peticiones } = await conLaRed([respuestaBuena()], { espera });
    assert.equal(peticiones.length, 0, `con espera ${espera} se pidió igual`);
    assert.ok(salida.tipo === 'fallo');
    assert.equal(salida.situacion, 'IA-TIEMPO');
    assert.equal(salida.uso, null);
  }
  // Una espera con decimales se recorta a un entero y se pide: el reloj del pedido sólo acepta enteros.
  const decimal = await conLaRed([respuestaBuena()], { espera: 1_500.5 });
  assert.equal(decimal.peticiones.length, 1);
  assert.equal(decimal.salida.tipo, 'datos');
  // Y una infinita se recorta al tope: «sin límite propio» no es «sin tiempo».
  const infinita = await conLaRed([tiempoAgotado()], { espera: Number.POSITIVE_INFINITY });
  assert.equal(infinita.peticiones.length, 1);
  assert.ok(infinita.salida.tipo === 'fallo');
  assert.match(infinita.salida.tecnico, /\(el tope es 240 s\)$/);
});

test('una llave que no puede ir en una cabecera es IA-LLAVE, sin pedido y sin reintento', async () => {
  /* Un espacio de ancho cero pegado con la llave desde un documento: `fetch` tiraría antes de salir a la
     red y se leería como la conexión, con su reintento. Hay que volver a cargarla, no esperar. */
  const { salida, peticiones } = await conLaRed([respuestaBuena()], { llave: `${LLAVE}\u200B` });
  assert.equal(peticiones.length, 0);
  assert.ok(salida.tipo === 'fallo');
  assert.equal(salida.situacion, 'IA-LLAVE');
});

// ═══ 3 · Lo que vuelve ════════════════════════════════════════════════════════

test('se leen los CUATRO contadores; y una respuesta que llegó y no sirve también se pagó', async () => {
  const bien = await conLaRed([respuestaBuena()]);
  assert.ok(bien.salida.tipo === 'datos');
  assert.deepEqual(bien.salida.datos, { ok: true });
  assert.deepEqual(bien.salida.uso, { input: 1000, output: 200, cacheWrite: 50, cacheRead: 3000 });
  assert.equal(bien.salida.salvadoDe, null);

  // Sin los de caché: un cero de ESOS contadores, no una llamada gratis.
  const sinCache = await conLaRed([respuestaBuena({ usage: { input_tokens: 7, output_tokens: 8 } })]);
  assert.ok(sinCache.salida.tipo === 'datos');
  assert.deepEqual(sinCache.salida.uso, { input: 7, output: 8, cacheWrite: 0, cacheRead: 0 });

  const truncada = await conLaRed([respuestaBuena({ stop_reason: 'max_tokens' })]);
  assert.ok(truncada.salida.tipo === 'fallo');
  assert.equal(truncada.salida.uso?.cacheRead, 3000, 'la truncada se pagó: sus contadores tienen que quedar');

  const rechazada = await conLaRed([rechazo(401, 'authentication_error')]);
  assert.ok(rechazada.salida.tipo === 'fallo');
  assert.equal(rechazada.salida.uso, null, 'sin respuesta no se sabe qué consumió: nulo, no cero');
});

test('el lector decide si sirve: la herramienta por NOMBRE, y sin ella es IA-ESTRUCTURA', async () => {
  const con = (content: unknown[]): Respuesta => () => json({ content, stop_reason: 'tool_use', usage: USO });
  const leer = leerHerramienta('responder');

  const otra = await conLaRed([con([{ type: 'tool_use', id: 't1', name: 'otra', input: { a: 1 } }])], { leer, formato: undefined });
  assert.ok(otra.salida.tipo === 'fallo' && otra.salida.situacion === 'IA-ESTRUCTURA');

  const buena = await conLaRed(
    [con([{ type: 'thinking', thinking: '' }, { type: 'tool_use', id: 't2', name: 'responder', input: { conclusion: 'x' } }])],
    { leer, formato: undefined },
  );
  assert.ok(buena.salida.tipo === 'datos');
  assert.deepEqual(buena.salida.datos, { conclusion: 'x' });

  const vacia = await conLaRed([() => json({ content: [{ type: 'thinking', thinking: '' }], stop_reason: 'end_turn', usage: USO })]);
  assert.ok(vacia.salida.tipo === 'fallo' && vacia.salida.situacion === 'IA-VACIO');

  const rota = await conLaRed([() => json({ content: [{ type: 'text', text: 'no es json' }], stop_reason: 'end_turn', usage: USO })]);
  assert.ok(rota.salida.tipo === 'fallo' && rota.salida.situacion === 'IA-ESTRUCTURA');

  // Un lector que tropieza no tumba la llamada: es la misma situación.
  const tropieza = await conLaRed([respuestaBuena()], {
    leer: () => {
      throw new Error('el lector tropezó');
    },
  });
  assert.ok(tropieza.salida.tipo === 'fallo' && tropieza.salida.situacion === 'IA-ESTRUCTURA');
});

test('el fallo trae la referencia de su línea de registro, y la pantalla sabe leer su detalle', async () => {
  const { salida, errores, avisos } = await conLaRed([rechazo(401, 'authentication_error', 'invalid x-api-key')], {
    donde: 'herramienta 3',
  });
  assert.ok(salida.tipo === 'fallo');
  assert.match(salida.ref, /^[A-Z0-9]{6}$/);
  // La duración es la de la llamada: el minuto que «cuesta» escribir la línea del incidente no está.
  assert.equal(salida.milisegundos, 0);
  assert.deepEqual(avisos, []);
  assert.equal(errores.length, 1);
  assert.match(
    errores[0]!,
    new RegExp(`^incidente IA-LLAVE · ref ${salida.ref} · brief · herramienta 3 · org org-1 · 401 authentication_error: invalid x-api-key$`),
  );
  // El formato de `lib/fundaciones/mensajes.ts`: una ruta que arme el 502 con esto cae en el texto de su situación.
  assert.deepEqual(leerFalloDelModelo(detalleDelFallo(salida)), {
    situacion: 'IA-LLAVE',
    ref: salida.ref,
    tecnico: '401 authentication_error: invalid x-api-key',
  });
});

test('con `los_agrega_quien_llama`, el transporte clasifica y devuelve, pero no anota el incidente', async () => {
  /* Una tarea del cron llama muchas veces por corrida: con el proveedor caído, un incidente por llamada
     llenaría el panel (AG-98). La tarea agrega por corrida y situación; el transporte sólo le devuelve
     lo que necesita. */
  const fallida = await conLaRed([rechazo(401, 'authentication_error')], { incidentes: 'los_agrega_quien_llama', ref: 'analisis-7' });
  assert.ok(fallida.salida.tipo === 'fallo');
  assert.equal(fallida.salida.situacion, 'IA-LLAVE');
  assert.match(fallida.salida.ref, /^[A-Z0-9]{6}$/);
  assert.deepEqual(fallida.errores, [], 'la línea `incidente` la escribe la tarea, una por corrida');

  /* Y el salvado vuelve con su situación para que la tarea lo cuente. Que no escriba su incidente no se
     puede ver acá —con `org-1` ningún incidente se escribe—: lo afirma la 200, contra la base. */
  const salvada = await conLaRed([rechazo(529, 'overloaded_error'), respuestaBuena()], { incidentes: 'los_agrega_quien_llama' });
  assert.ok(salvada.salida.tipo === 'datos');
  assert.equal(salvada.salida.salvadoDe, 'IA-SATURADO');

  // La entrada muerta: sin la opción, el mismo fallo SÍ deja su línea.
  const cadaUna = await conLaRed([rechazo(401, 'authentication_error')]);
  assert.equal(cadaUna.errores.length, 1);
});

test('la llave no queda en el fallo, aunque un mensaje de la red o del proveedor la repita', async () => {
  /* Una llave que no puede ir en una cabecera ya no llega a `fetch` (la prueba de arriba). Esto es la
     defensa de atrás: un error de la red, de un intermediario o del proveedor que repita la llave no la
     lleva al registro, al Panel de Incidentes ni a la pantalla. Quitarla no toca lo que clasifica. */
  const red = await conLaRed([sinRed(`un intermediario devolvió: ${LLAVE} no es válida`)]);
  assert.ok(red.salida.tipo === 'fallo');
  assert.equal(red.salida.situacion, 'IA-CONEXION');
  assert.ok(!JSON.stringify(red.salida).includes(LLAVE), `la llave quedó en el resultado: ${red.salida.tecnico}`);
  assert.ok(red.errores.every((l) => !l.includes(LLAVE)), 'la llave quedó en el registro');

  // Y en un rechazo del proveedor, que sigue siendo IA-LLAVE.
  const rechazada = await conLaRed([rechazo(401, 'authentication_error', `invalid x-api-key ${LLAVE}`)]);
  assert.ok(rechazada.salida.tipo === 'fallo');
  assert.equal(rechazada.salida.situacion, 'IA-LLAVE');
  assert.ok(!JSON.stringify(rechazada.salida).includes(LLAVE), `la llave quedó en el resultado: ${rechazada.salida.tecnico}`);
  assert.ok(rechazada.errores.every((l) => !l.includes(LLAVE)), 'la llave quedó en el registro');
});

// ═══ 4 · El uso y los escritores ══════════════════════════════════════════════

/** Una escritura sobre la tabla, por Kysely o en SQL crudo, con o sin `negocio.` adelante. El molde de la 180. */
function escribe(tabla: string, fuente: string): boolean {
  const kysely = new RegExp(`(insertInto|updateTable|deleteFrom|mergeInto)\\(\\s*['"\`]${tabla}['"\`]\\s*\\)`);
  const crudo = new RegExp(`(insert\\s+into|update|delete\\s+from|merge\\s+into)\\s+(?:negocio\\.)?${tabla}\\b`, 'i');
  return kysely.test(fuente) || crudo.test(fuente);
}

/**
 * Las tablas de los agentes y su único escritor (`docs/OTROS/agentes/01-LA-ARQUITECTURA.md`, AG-08). La
 * 111 vigila sólo `negocio.mensajes`: cada etapa que crea una tabla de los agentes suma su fila acá.
 */
const ESCRITORES = [
  { tabla: 'uso_de_ia', escritor: 'lib/agentes/uso.ts' },
  // El cerebro (AG5, migración 071).
  { tabla: 'conversaciones_del_executive', escritor: 'lib/agentes/executive/conversaciones.ts' },
  { tabla: 'mensajes_del_executive', escritor: 'lib/agentes/executive/conversaciones.ts' },
  { tabla: 'topes_del_executive', escritor: 'lib/agentes/executive/topes.ts' },
  { tabla: 'preguntas_del_executive', escritor: 'lib/agentes/executive/topes.ts' },
];

for (const { tabla, escritor } of ESCRITORES) {
  test(`\`negocio.${tabla}\` tiene UN escritor, y es \`${escritor}\``, () => {
    const culpables = archivosFuente(['app', 'lib', 'scripts'])
      .filter((a) => a.ruta !== escritor)
      .filter((a) => escribe(tabla, a.limpio))
      .map((a) => a.ruta);
    assert.deepEqual(culpables, []);
    // La entrada muerta: el escritor SÍ escribe.
    const propio = archivosFuente(['lib']).find((a) => a.ruta === escritor);
    assert.ok(propio, `no se encontró ${escritor}`);
    assert.ok(escribe(tabla, propio.limpio), `${escritor} dejó de escribir ${tabla}`);
  });
}

test('`registrarUso` no lanza, y sin una organización de verdad vuelve sin tocar la base ni el registro', async () => {
  const errores: string[] = [];
  const original = console.error;
  console.error = (...partes: unknown[]) => void errores.push(partes.map(String).join(' '));
  try {
    await registrarUso({
      orgId: 'org-1',
      agente: 'brief',
      modelo: 'claude-sonnet-5-5',
      uso: null,
      duracionMs: 1,
      resultado: 'IA-CONEXION',
      usuarioId: null,
      ref: null,
    });
  } finally {
    console.error = original;
  }
  // Sin la guarda, `conOrganizacion('org-1')` lanzaría «no es un uuid» y el `catch` dejaría su línea.
  assert.deepEqual(errores, []);
});
