// EL PIPELINE DE LOS ANALIZADORES, con un modelo y un tl;dv falsos. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/analizadores/pipeline.ts` contra la base local, con la red reemplazada: tl;dv responde por
// URL y Anthropic por modelo, y cada llamada al modelo se CUENTA. Ninguna prueba gasta.
//
// Lo que se defiende es dónde se paga y dónde no:
//
//   · las tres salidas de cada reunión (HT/OB, OTRO, sin clasificar) y qué escribe cada una;
//   · que una OB se CLASIFIQUE como OB pero no se ANALICE en la fase HT;
//   · que una llave rechazada corte y lo diga, en vez de repetirse en silencio;
//   · que la guardia de reloj no arranque una inferencia que no cabe;
//   · que la ficha nunca tumbe la llamada.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import {
  TIPOS_QUE_SE_ANALIZAN,
  analizarLlamada,
  crearManual,
  descubrir,
  generarFicha,
  esperaDisponible,
  relojDe,
  tieneMarcasDeTiempo,
  type Reloj,
} from '../../lib/analizadores/pipeline.ts';
import { borrarLlamada } from '../../lib/analizadores/datos.ts';

let esc: Escenario;

const TABLAS = ['analizador_lapidas', 'analizador_fichas', 'analizador_analisis', 'analizador_transcripciones', 'analizador_llamadas', 'analizador_prospectos'];

async function limpiar(): Promise<void> {
  for (const t of TABLAS) await esc.admin.query(`delete from negocio.${t} where org_id = any($1)`, [[esc.org, esc.otraOrg]]);
}

before(async () => {
  esc = await montar('analizador-pipeline');
});
beforeEach(async () => {
  await limpiar();
  red.reiniciar();
});
after(async () => {
  await limpiar();
  globalThis.fetch = fetchOriginal;
  await cerrarClientes();
  await cerrarTodo();
});

// ═══════════════════════════════════════════════════════════════════════════════
// La red falsa
// ═══════════════════════════════════════════════════════════════════════════════

const fetchOriginal = globalThis.fetch;
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

const USO = { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 50, cache_read_input_tokens: 3000 };
const delModelo = (texto: string) => json({ content: [{ type: 'text', text: texto }], stop_reason: 'end_turn', usage: USO });

interface Reunion {
  id: string;
  name: string;
  happenedAt?: string;
  transcripcion?: unknown;
}

const red = {
  reuniones: [] as Reunion[],
  /** Qué contesta el clasificador para cada título. Sin entrada, basura (no se puede clasificar). */
  clasificacion: {} as Record<string, string>,
  /** Qué contesta el análisis (Sonnet), en orden. */
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

globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
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

const SEGMENTOS = [
  { startTime: '00:05', endTime: '00:09', speaker: 'Valeria', text: 'hola' },
  { startTime: '00:10', endTime: '00:20', speaker: 'Rubén', text: 'quiero vender más' },
];
const reciente = new Date(Date.now() - 3 * 3_600_000).toISOString();

function unaReunion(id: string, tipo: string | null, extra: Partial<Reunion> = {}): Reunion {
  const r: Reunion = { id, name: `Reunión ${id}`, happenedAt: reciente, transcripcion: SEGMENTOS, ...extra };
  if (tipo) red.clasificacion[r.name] = tipo;
  red.reuniones.push(r);
  return r;
}

/** Un reloj con cinco minutos por delante: sobra para todo. */
const conTiempo = (): Reloj => relojDe(300_000);
const LLAVES = { claveTldv: 'tldv-falsa', claveIa: 'ia-falsa' };

async function llamadas(): Promise<{ reunion_externa_id: string | null; tipo: string; estado: string; motivo: string | null }[]> {
  const r = await esc.admin.query(
    'select reunion_externa_id, tipo, estado, motivo from negocio.analizador_llamadas where org_id = $1 order by reunion_externa_id',
    [esc.org],
  );
  return r.rows;
}

async function idDe(externa: string): Promise<string> {
  const r = await esc.admin.query('select id from negocio.analizador_llamadas where reunion_externa_id = $1', [externa]);
  return r.rows[0].id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · DESCUBRIR
// ═══════════════════════════════════════════════════════════════════════════════

test('descubrir: HT y OB quedan PENDING; OTRO queda NOT_MATCH con su motivo; nada se analiza', async () => {
  unaReunion('m-ht', 'HT');
  unaReunion('m-ob', 'OB');
  unaReunion('m-otro', 'OTRO');
  const r = await descubrir(esc.org, { ...LLAVES, reloj: conTiempo() });
  assert.equal(r.tipo, 'hecho');
  if (r.tipo !== 'hecho') return;
  assert.deepEqual({ d: r.descubiertas, i: r.internas, s: r.sinClasificar }, { d: 2, i: 1, s: 0 });
  assert.deepEqual(await llamadas(), [
    { reunion_externa_id: 'm-ht', tipo: 'HT', estado: 'PENDING', motivo: null },
    { reunion_externa_id: 'm-ob', tipo: 'OB', estado: 'PENDING', motivo: null },
    { reunion_externa_id: 'm-otro', tipo: 'OTRO', estado: 'NOT_MATCH', motivo: 'porque Reunión m-otro' },
  ]);
  assert.equal(red.llamadasAlAnalisis, 0, 'descubrir no analiza: eso es lo caro');
  /* La OTRO guarda la transcripción: sin ella, reencaminarla obligaría a bajarla otra vez. */
  const t = await esc.admin.query('select count(*)::int as n from negocio.analizador_transcripciones where org_id = $1', [esc.org]);
  assert.equal(t.rows[0].n, 3);
});

test('una respuesta «OB» del clasificador es OB, no OTRO — aunque OB no se analice todavía', async () => {
  /* La trampa de la fase HT: si OB no estuviera registrado, esta reunión saldría OTRO y el descarte
     la sellaría para siempre. Cuando la fase OB llegue, no volvería a entrar. */
  assert.deepEqual([...TIPOS_QUE_SE_ANALIZAN], ['HT']);
  unaReunion('m-ob', 'OB');
  await descubrir(esc.org, { ...LLAVES, reloj: conTiempo() });
  const [ob] = await llamadas();
  assert.deepEqual({ tipo: ob?.tipo, estado: ob?.estado }, { tipo: 'OB', estado: 'PENDING' });

  const r = await analizarLlamada(esc.org, await idDe('m-ob'), 'ia-falsa', conTiempo());
  assert.deepEqual(r, { tipo: 'rechazo', que: 'analizador_no_disponible' });
  assert.equal(red.llamadasAlAnalisis, 0);
  assert.equal((await llamadas())[0]?.estado, 'PENDING', 'la OB espera, no queda tomada');
});

test('si el clasificador falla, no se escribe NADA: se retoma en la próxima corrida', async () => {
  unaReunion('m-basura', null);
  const r = await descubrir(esc.org, { ...LLAVES, reloj: conTiempo() });
  assert.equal(r.tipo === 'hecho' && r.sinClasificar, 1);
  assert.deepEqual(await llamadas(), []);
});

test('una transcripción que tl;dv todavía no tiene no crea fila y se cuenta aparte', async () => {
  unaReunion('m-sin', 'HT', { transcripcion: undefined });
  const r = await descubrir(esc.org, { ...LLAVES, reloj: conTiempo() });
  assert.equal(r.tipo === 'hecho' && r.pendientesDeTranscripcion, 1);
  assert.equal(red.llamadasAlClasificador, 0, 'sin transcripción no se paga el clasificador');
  assert.deepEqual(await llamadas(), []);
});

test('la segunda corrida no vuelve a pagar: lo guardado y lo borrado quedan fuera antes de clasificar', async () => {
  unaReunion('m-1', 'HT');
  unaReunion('m-2', 'HT');
  await descubrir(esc.org, { ...LLAVES, reloj: conTiempo() });
  assert.equal(red.llamadasAlClasificador, 2);
  assert.ok(await borrarLlamada(esc.org, await idDe('m-2')));

  const r = await descubrir(esc.org, { ...LLAVES, reloj: conTiempo() });
  assert.equal(red.llamadasAlClasificador, 2, 'la segunda corrida clasificó otra vez');
  assert.equal(r.tipo === 'hecho' && r.descubiertas, 0);
  assert.deepEqual((await llamadas()).map((l) => l.reunion_externa_id), ['m-1']);
});

test('la ventana: lo de hace más de 48 h no entra, y lo que no trae fecha sí', async () => {
  unaReunion('m-vieja', 'HT', { happenedAt: new Date(Date.now() - 49 * 3_600_000).toISOString() });
  unaReunion('m-sin-fecha', 'HT', { happenedAt: undefined });
  await descubrir(esc.org, { ...LLAVES, reloj: conTiempo() });
  assert.deepEqual((await llamadas()).map((l) => l.reunion_externa_id), ['m-sin-fecha']);
});

test('una llave de tl;dv rechazada CORTA el descubrimiento y lo dice', async () => {
  /* El origen lo contaba como «transcripción no lista» y cada corrida terminaba bien, con cero
     reuniones, para siempre. */
  unaReunion('m-1', 'HT');
  red.estadoDeTldv = 401;
  assert.deepEqual(await descubrir(esc.org, { ...LLAVES, reloj: conTiempo() }), { tipo: 'falta', que: 'llave_de_tldv_rechazada' });
  assert.deepEqual(await llamadas(), []);
});

test('una llave de IA rechazada en el clasificador CORTA y lo dice, sin escribir', async () => {
  unaReunion('m-1', 'HT');
  red.estadoDeAnthropic = 401;
  assert.deepEqual(await descubrir(esc.org, { ...LLAVES, reloj: conTiempo() }), { tipo: 'falta', que: 'llave_de_ia_rechazada' });
  assert.deepEqual(await llamadas(), []);
});

test('la guardia de reloj: sin tiempo para una reunión más, para y cuenta las que quedaron', async () => {
  /* Con 60 s por delante no cabe ni una espera de tl;dv más la del clasificador. La mutación que
     quita la guardia examina las tres y, en producción, se come la función entera. */
  unaReunion('m-1', 'HT');
  unaReunion('m-2', 'HT');
  unaReunion('m-3', 'HT');
  const r = await descubrir(esc.org, { ...LLAVES, reloj: relojDe(60_000) });
  assert.deepEqual(r.tipo === 'hecho' && { d: r.descubiertas, s: r.sinExaminar }, { d: 0, s: 3 });
  assert.equal(red.llamadasAlClasificador, 0);
});

test('el tope: nunca más de las que se piden por corrida', async () => {
  for (let i = 1; i <= 3; i++) unaReunion(`m-${i}`, 'HT');
  const r = await descubrir(esc.org, { ...LLAVES, reloj: conTiempo(), tope: 2 });
  assert.deepEqual(r.tipo === 'hecho' && { d: r.descubiertas, s: r.sinExaminar }, { d: 2, s: 1 });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · ANALIZAR
// ═══════════════════════════════════════════════════════════════════════════════

async function unaHtPendiente(): Promise<string> {
  unaReunion('m-ht', 'HT');
  await descubrir(esc.org, { ...LLAVES, reloj: conTiempo() });
  return idDe('m-ht');
}

test('analizar: PENDING → DONE con su análisis y sus cuatro contadores', async () => {
  const id = await unaHtPendiente();
  red.analisis.push(() => delModelo('{"score": 8, "outcome": "cerrada"}'));
  const r = await analizarLlamada(esc.org, id, 'ia-falsa', conTiempo());
  assert.deepEqual(r, { tipo: 'hecho', estado: 'DONE', motivo: null, error: null });
  const a = await esc.admin.query(
    'select puntaje, resultado, tokens_entrada, tokens_lectura_cache, version_de_rubrica from negocio.analizador_analisis where llamada_id = $1',
    [id],
  );
  assert.deepEqual(a.rows[0], { puntaje: 8, resultado: 'CERRADA', tokens_entrada: 1000, tokens_lectura_cache: 3000, version_de_rubrica: 'rubric.es.md@v8.1' });
});

test('analizar: el veto deja NOT_MATCH con el motivo del modelo', async () => {
  const id = await unaHtPendiente();
  red.analisis.push(() => delModelo('{"match": false, "reason": "es una sesión de coaching"}'));
  const r = await analizarLlamada(esc.org, id, 'ia-falsa', conTiempo());
  assert.deepEqual(r, { tipo: 'hecho', estado: 'NOT_MATCH', motivo: 'es una sesión de coaching', error: null });
});

test('analizar: un fallo del modelo deja FAILED con el error, recortado', async () => {
  const id = await unaHtPendiente();
  red.analisis.push(() => delModelo('esto no es JSON '.repeat(80)));
  const r = await analizarLlamada(esc.org, id, 'ia-falsa', conTiempo());
  assert.equal(r.tipo === 'hecho' && r.estado, 'FAILED');
  const l = await esc.admin.query('select estado, length(error) as largo from negocio.analizador_llamadas where id = $1', [id]);
  assert.equal(l.rows[0].estado, 'FAILED');
  assert.ok(l.rows[0].largo > 0 && l.rows[0].largo <= 500);
});

test('analizar sin tiempo NO llama al modelo y deja la llamada como estaba', async () => {
  /* Un análisis que arranca sin tiempo para terminar se paga y no se guarda, y la llamada queda en
     ANALYZING. La guardia lo rechaza antes del candado. */
  const id = await unaHtPendiente();
  const r = await analizarLlamada(esc.org, id, 'ia-falsa', relojDe(100_000));
  assert.deepEqual(r, { tipo: 'rechazo', que: 'sin_tiempo' });
  assert.equal(red.llamadasAlAnalisis, 0);
  assert.equal((await llamadas())[0]?.estado, 'PENDING');
});

test('analizar: la espera que se le da al modelo es la que queda, nunca más', async () => {
  /* Con 200 s por delante, la espera no puede ser la de 270 s por omisión: el modelo seguiría
     pensando cuando la función ya murió, y se pagaría sin guardarse. La mutación que pasa la espera
     fija no se ve en el resultado —se ve en la factura—, así que se mira el valor que llega al
     temporizador del pedido. */
  const id = await unaHtPendiente();
  const esperas: number[] = [];
  const original = AbortSignal.timeout;
  AbortSignal.timeout = ((ms: number) => {
    esperas.push(ms);
    return original.call(AbortSignal, ms);
  }) as typeof AbortSignal.timeout;
  try {
    const inicio = Date.now();
    await analizarLlamada(esc.org, id, 'ia-falsa', { ahora: () => Date.now(), fin: inicio + 200_000 });
  } finally {
    AbortSignal.timeout = original;
  }
  assert.equal(esperas.length, 1, 'se esperaba un solo pedido: el del análisis');
  assert.ok(esperas[0]! <= 185_000 && esperas[0]! > 180_000, `la espera fue ${esperas[0]} ms`);
});

test('esperaDisponible: lo que queda menos el margen, con techo y con piso', () => {
  const a = (restanteMs: number) => esperaDisponible({ ahora: () => 0, fin: restanteMs });
  assert.equal(a(400_000), 270_000, 'con tiempo de sobra, el techo del origen');
  assert.equal(a(200_000), 185_000);
  assert.equal(a(165_000), 150_000, 'justo el mínimo');
  assert.equal(a(164_999), null, 'por debajo del mínimo no se arranca');
});

test('analizar una llamada de otra empresa es «no encontrada», sin tocar nada', async () => {
  const id = await unaHtPendiente();
  assert.deepEqual(await analizarLlamada(esc.otraOrg, id, 'ia-falsa', conTiempo()), { tipo: 'rechazo', que: 'no_encontrada' });
  assert.equal(red.llamadasAlAnalisis, 0);
});

test('una OTRO no se analiza: primero hay que reencaminarla', async () => {
  unaReunion('m-otro', 'OTRO');
  await descubrir(esc.org, { ...LLAVES, reloj: conTiempo() });
  assert.deepEqual(await analizarLlamada(esc.org, await idDe('m-otro'), 'ia-falsa', conTiempo()), { tipo: 'rechazo', que: 'tipo_otro' });
});

test('sin transcripción se rechaza ANTES del candado: la llamada no queda tomada', async () => {
  const r = await esc.admin.query(
    `insert into negocio.analizador_llamadas (org_id, tipo, proveedor, estado) values ($1, 'HT', 'MANUAL', 'PENDING') returning id`,
    [esc.org],
  );
  const id = r.rows[0].id;
  assert.deepEqual(await analizarLlamada(esc.org, id, 'ia-falsa', conTiempo()), { tipo: 'rechazo', que: 'sin_transcripcion' });
  const l = await esc.admin.query('select estado from negocio.analizador_llamadas where id = $1', [id]);
  assert.equal(l.rows[0].estado, 'PENDING');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LA FICHA
// ═══════════════════════════════════════════════════════════════════════════════

async function unaHtAnalizada(): Promise<string> {
  const id = await unaHtPendiente();
  await analizarLlamada(esc.org, id, 'ia-falsa', conTiempo());
  return id;
}

test('la ficha se genera sobre una HT analizada, con la cabecera de quién es quién', async () => {
  const id = await unaHtAnalizada();
  red.cuerposDelAnalisis = [];
  red.analisis.push(() => delModelo('{"summary": "vende pan", "buyingIntent": {"level": {"state": "DETECTADO", "value": "ALTO", "quote": "quiero", "confidence": "ALTA"}}}'));
  assert.deepEqual(await generarFicha(esc.org, id, 'ia-falsa', conTiempo()), { tipo: 'hecho', estado: 'OK', error: null });
  const mensaje = (red.cuerposDelAnalisis[0]?.['messages'] as { content: string }[])[0]!.content;
  assert.ok(mensaje.startsWith('CONTEXTO (solo para que sepas quién habla; NO lo repitas en tu respuesta):\nEL CLOSER (nuestro lado) es: Valeria\nEL PROSPECTO es: Rubén'));
  const f = await esc.admin.query('select estado, intencion from negocio.analizador_fichas where llamada_id = $1', [id]);
  assert.deepEqual(f.rows[0], { estado: 'OK', intencion: 'ALTO' });
});

test('una ficha que falla queda FAILED, y la llamada sigue DONE con su análisis', async () => {
  const id = await unaHtAnalizada();
  red.analisis.push(() => delModelo('{"summary": "cortado a la mit'));
  const r = await generarFicha(esc.org, id, 'ia-falsa', conTiempo());
  assert.equal(r.tipo === 'hecho' && r.estado, 'FAILED');
  const l = await esc.admin.query(
    `select l.estado, a.puntaje from negocio.analizador_llamadas l join negocio.analizador_analisis a on a.llamada_id = l.id and a.org_id = l.org_id where l.id = $1`,
    [id],
  );
  assert.deepEqual(l.rows[0], { estado: 'DONE', puntaje: 6 });
});

test('la ficha es solo de HT, y solo de una HT ya analizada', async () => {
  unaReunion('m-ob', 'OB');
  await descubrir(esc.org, { ...LLAVES, reloj: conTiempo() });
  assert.deepEqual(await generarFicha(esc.org, await idDe('m-ob'), 'ia-falsa', conTiempo()), { tipo: 'rechazo', que: 'ficha_solo_ht' });
  const pendiente = await unaHtPendiente();
  assert.deepEqual(await generarFicha(esc.org, pendiente, 'ia-falsa', conTiempo()), { tipo: 'rechazo', que: 'sin_analisis' });
  assert.equal(red.llamadasAlAnalisis, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LA MANUAL
// ═══════════════════════════════════════════════════════════════════════════════

test('una manual sin [mm:ss] queda marcada: sus tiempos son números de línea', async () => {
  const sin = await crearManual(esc.org, { tipo: 'HT', nombre: 'Ana', email: 'ana@ejemplo.test', transcripcion: 'Closer: hola\nAna: hola' });
  const con = await crearManual(esc.org, { tipo: 'HT', nombre: 'Ana', email: 'ana@ejemplo.test', transcripcion: '[00:05] Closer: hola\n[00:09] Ana: hola' });
  const r = await esc.admin.query(
    'select llamada_id, con_marcas_de_tiempo from negocio.analizador_transcripciones where llamada_id = any($1)',
    [[sin, con]],
  );
  const marca = Object.fromEntries(r.rows.map((f) => [f.llamada_id, f.con_marcas_de_tiempo]));
  assert.deepEqual({ sin: marca[sin], con: marca[con] }, { sin: false, con: true });
  // Y las dos comparten prospecto: mismo correo.
  const p = await esc.admin.query('select count(distinct prospecto_id)::int as n from negocio.analizador_llamadas where id = any($1)', [[sin, con]]);
  assert.equal(p.rows[0].n, 1);
});

test('tieneMarcasDeTiempo reconoce el JSON de tl;dv y el texto con marcas', () => {
  assert.equal(tieneMarcasDeTiempo(JSON.stringify(SEGMENTOS)), true);
  assert.equal(tieneMarcasDeTiempo(JSON.stringify({ segments: [{ speaker: 'A', text: 'x' }] })), false);
  assert.equal(tieneMarcasDeTiempo('1:02:03 Ana: hola'), true);
  assert.equal(tieneMarcasDeTiempo('Ana: a las 10:30 nos vemos'), false);
});
