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
import {
  SEGMENTOS,
  TABLAS_DEL_ANALIZADOR as TABLAS,
  delModelo,
  instalarRedFalsa,
  json,
  quitarRedFalsa,
  red,
  unaReunion,
} from '../apoyo/analizador.ts';

let esc: Escenario;

async function limpiar(): Promise<void> {
  for (const t of TABLAS) await esc.admin.query(`delete from negocio.${t} where org_id = any($1)`, [[esc.org, esc.otraOrg]]);
}

before(async () => {
  esc = await montar('analizador-pipeline');
  instalarRedFalsa();
});
beforeEach(async () => {
  await limpiar();
  red.reiniciar();
});
after(async () => {
  await limpiar();
  quitarRedFalsa();
  await cerrarClientes();
  await cerrarTodo();
});

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

/** Lo que Anthropic contesta cuando dice que no, con la forma de su cuerpo de error. */
const rechazoDeAnthropic = (status: number, message: string) => () =>
  json({ type: 'error', error: { type: 'x', message } }, status);

async function filaDe(id: string): Promise<{ estado: string; error: string | null; tomada_el: Date | null }> {
  const r = await esc.admin.query('select estado, error, tomada_el from negocio.analizador_llamadas where id = $1', [id]);
  return r.rows[0];
}

test('una llave rechazada A MITAD del análisis devuelve la llamada a PENDING: no es un fallo de ella', async () => {
  /* El defecto que encontró la revisión: el 401 caía en el mismo `catch` que un JSON roto y dejaba la
     llamada FAILED. El drenado seguía con la siguiente —y con la otra, y con la otra—, cada una
     FAILED por una llave que no es culpa de ninguna, y la corrida terminaba como si nada. */
  const id = await unaHtPendiente();
  red.analisis.push(rechazoDeAnthropic(401, 'invalid x-api-key'));
  assert.deepEqual(await analizarLlamada(esc.org, id, 'ia-falsa', conTiempo()), { tipo: 'rechazo', que: 'llave_de_ia_rechazada' });
  assert.deepEqual(await filaDe(id), { estado: 'PENDING', error: null, tomada_el: null });
});

test('una cuenta sin saldo es una llave que no sirve, y una FAILED reintentada conserva su error de antes', async () => {
  /* El saldo llega como un 400 cualquiera; lo único que lo distingue es la frase. Y la FAILED que se
     reintenta con la cuenta sin saldo no pierde el error que tenía: el análisis no ocurrió. */
  const id = await unaHtPendiente();
  await esc.admin.query(`update negocio.analizador_llamadas set estado = 'FAILED', error = 'el error de antes' where id = $1`, [id]);
  red.analisis.push(rechazoDeAnthropic(400, 'Your credit balance is too low to access the Anthropic API.'));
  const r = await analizarLlamada(esc.org, id, 'ia-falsa', conTiempo(), 'FAILED');
  assert.deepEqual(r, { tipo: 'rechazo', que: 'llave_de_ia_rechazada' });
  assert.deepEqual(await filaDe(id), { estado: 'FAILED', error: 'el error de antes', tomada_el: null });
});

test('el servicio saturado tampoco es un fallo de la llamada: vuelve a PENDING y se dice', async () => {
  const id = await unaHtPendiente();
  red.analisis.push(rechazoDeAnthropic(529, 'Overloaded'));
  assert.deepEqual(await analizarLlamada(esc.org, id, 'ia-falsa', conTiempo()), { tipo: 'rechazo', que: 'modelo_saturado' });
  assert.equal((await filaDe(id)).estado, 'PENDING');
});

test('una llamada que cambió de estado desde que se la vio no se analiza: una DONE no se paga dos veces', async () => {
  /* El drenado de la pantalla recorre una lista que leyó al empezar. Si otra corrida la analizó
     mientras tanto, pedirla como PENDING NO la reanaliza. */
  const id = await unaHtPendiente();
  await analizarLlamada(esc.org, id, 'ia-falsa', conTiempo());
  const antes = red.llamadasAlAnalisis;
  assert.deepEqual(await analizarLlamada(esc.org, id, 'ia-falsa', conTiempo()), { tipo: 'rechazo', que: 'llamada_cambio' });
  assert.equal(red.llamadasAlAnalisis, antes, 'se pagó un segundo análisis');
  assert.equal((await filaDe(id)).estado, 'DONE');
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

test('una llave rechazada en la ficha NO deja una ficha FAILED: no hubo ficha que fallara', async () => {
  /* Una FAILED guardada ya no la reintenta la tarea —solo genera las que nunca se generaron—, así que
     guardar una por la llave rota dejaba a esa llamada sin ficha para siempre. */
  const id = await unaHtAnalizada();
  red.analisis.push(rechazoDeAnthropic(401, 'invalid x-api-key'));
  assert.deepEqual(await generarFicha(esc.org, id, 'ia-falsa', conTiempo()), { tipo: 'rechazo', que: 'llave_de_ia_rechazada' });
  const f = await esc.admin.query('select 1 from negocio.analizador_fichas where llamada_id = $1', [id]);
  assert.equal(f.rowCount, 0);
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
