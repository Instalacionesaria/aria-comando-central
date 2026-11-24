// EL RESEARCH SE GUARDA EN TANDAS (la migración 125). Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (decisión del usuario del 2026-11-24)
//
// El Research corre una sola vez, pero su documento (unos 40 KB) no entra en una respuesta del agente en GHL. Manda sus
// secciones en tandas a la MISMA corrida (guardar_secciones con p_terminar = false), y la última tanda arma el HTML
// entero en la columna, con la plantilla provisoria que fija el orden.
//
//   1 · el catálogo: el Research tiene la plantilla provisoria con sus ocho marcadores en orden, todos obligatorios, y
//       «Cómo se hizo» fijo; el Estratega, sin plantilla; la firma vieja de tres argumentos ya no existe y la nueva no es
//       de PUBLIC — mutación: sin la plantilla, o con la firma vieja sin borrar;
//   2 · tres tandas: las dos primeras quedan en la corrida (abierta, la columna sin tocar) y dicen qué falta; la última
//       junta todo y escribe el documento en el orden de la plantilla, aunque las tandas lleguen en otro; una sección
//       que vuelve a llegar reemplaza a la anterior en su lugar; la salida, la procedencia y leer_secciones tienen todas
//       — mutaciones: la última tanda sin las anteriores, una tanda que escribe la columna, y el reemplazo que no
//       reemplaza;
//   3 · las obligatorias se exigen sólo al terminar: una tanda con una sola sección pasa; la última sin una obligatoria
//       se rechaza (gasta un intento) sin borrar lo guardado, y después termina bien — mutación: exigirlas en cada tanda;
//   4 · un rechazo en una tanda (un <style>, una sección que la plantilla no tiene) no borra las tandas anteriores — y
//       la última puede ir vacía si ya se mandó todo; vacía al principio, o una tanda vacía, no — mutación: el rechazo
//       que pisa la salida;
//   5 · cada corrida tiene sus tandas: una corrida nueva (la anterior queda reemplazada) no hereda las de la otra, y
//       una corrida terminada no acepta otra tanda — mutación: buscar las tandas por lead en vez de por corrida;
//   6 · sin plantilla (el Estratega), el orden es el de llegada, con el reemplazo en su lugar; y el tope de 40 cuenta
//       todas las tandas;
//   7 · una ficha no se guarda en tandas (por_secciones), y p_terminar null es «terminar».
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { SECCIONES_DEL_RESEARCH } from '../apoyo/research.ts';

let admin: Client;
let aria: { org: string; cuenta: string };
let ENV = '';
let PLANTILLA = '';
const LOC = 'loc-509';
const FIN = '\n</body></html>';

type Seccion = { id: string; html: string };

before(async () => {
  admin = await conectar('admin');
  const a = await unaFila<{ org: string; cuenta: string }>(
    admin,
    `select o.id as org, c.id as cuenta from identidad.organizaciones o
       join identidad.cuentas c on c.org_id = o.id and c.es_por_omision where o.es_principal`,
  );
  assert.ok(a, 'falta el sembrado');
  aria = a;
  const s = await unaFila<{ envoltura: string; plantilla: string }>(admin,
    `select envoltura, plantilla from catalogo.salidas_de_los_agentes where clave = 'research_market_research'`);
  assert.ok(s?.envoltura && s.plantilla, 'el Research no tiene su envoltura y su plantilla (125)');
  ENV = s.envoltura;
  PLANTILLA = s.plantilla;
});

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

async function enUnEnsayo(comoElMcp: () => Promise<void>): Promise<void> {
  await admin.query('begin');
  try {
    await admin.query(`do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'mcp_simulado') then
        create role mcp_simulado nologin nosuperuser bypassrls;
      end if; end $$`);
    await admin.query('grant agente_mcp, pg_read_all_data to mcp_simulado');
    await admin.query(`update identidad.cuentas set crm_cuenta_id = $2 where id = $1`, [aria.cuenta, LOC]);
    await admin.query('set local role mcp_simulado');
    await comoElMcp();
  } finally {
    await admin.query('rollback');
  }
}

async function comoAdmin<T>(fn: () => Promise<T>): Promise<T> {
  await admin.query('reset role');
  const r = await fn();
  await admin.query('set local role mcp_simulado');
  return r;
}

async function j(sql: string, params: unknown[] = []): Promise<Record<string, any>> {
  const r = await admin.query<{ r: Record<string, any> }>(sql, params);
  return r.rows[0]!.r;
}

async function fallaCon(codigo: string, sql: string, params: unknown[] = []): Promise<string> {
  await admin.query('savepoint s');
  try {
    await admin.query(sql, params);
    assert.fail(`debió fallar con ${codigo}: ${sql}`);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.message?.startsWith('debió fallar')) throw e;
    assert.equal(err.code, codigo, err.message);
    return err.message ?? '';
  } finally {
    await admin.query('rollback to savepoint s');
  }
}

const abrir = (agente: string, ghl: string) =>
  j(`select agentes.abrir_corrida($1, $2, $3, $4, '{}'::jsonb, null) as r`, [agente, LOC, ghl, `${agente}:${ghl}:${randomUUID()}`]);

/** Una tanda que no termina (p_terminar = false). */
const tanda = (corrida: string, secciones: Seccion[]) =>
  j(`select agentes.guardar_secciones($1, $2::jsonb, null, false) as r`, [corrida, JSON.stringify(secciones)]);

/** La última tanda: sin el cuarto argumento (por omisión, true). */
const ultima = (corrida: string, secciones: Seccion[]) =>
  j(`select agentes.guardar_secciones($1, $2::jsonb) as r`, [corrida, JSON.stringify(secciones)]);

async function unLead(marca: string): Promise<{ ghl: string; id: string }> {
  const ghl = `ghl-509-${marca}-${randomUUID().slice(0, 8)}`;
  const c = await comoAdmin(() => unaFila<{ id: string }>(admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente, email)
     values ($1, $2, $3, $4, 'meta', $5) returning id`, [aria.org, aria.cuenta, ghl, `Lead ${marca}`, `${ghl}@ejemplo.pe`]));
  return { ghl, id: c!.id };
}

const fila = (contacto: string) => comoAdmin(() => unaFila<Record<string, any>>(admin,
  `select * from negocio.respuestas_de_los_agentes where contacto_id = $1`, [contacto]));

const corrida = (id: string) => comoAdmin(() => unaFila<{ estado: string; salida: any; intentos: number }>(admin,
  `select estado, salida, intentos from negocio.corridas_de_agente where id = $1`, [id]));

/** El documento que arma la plantilla: cada marcador reemplazado por su sección (o vacío). */
function conLaPlantilla(secciones: Record<string, string>): string {
  const cuerpo = PLANTILLA.replace(/\{\{seccion:([a-z][a-z0-9_]*)\}\}/g, (_m, id: string) => secciones[id] ?? '');
  return `${ENV}\n${cuerpo.trim()}${FIN}`;
}

const s = (id: string, html: string): Seccion => ({ id, html });

test('1 · el catálogo: la plantilla provisoria del Research, el Estratega sin plantilla, y la firma nueva', async () => {
  const marcas = [...PLANTILLA.matchAll(/\{\{seccion:([a-z][a-z0-9_]*)\}\}/g)].map((m) => m[1]);
  assert.deepEqual(marcas, [...SECCIONES_DEL_RESEARCH], 'los marcadores no son los ocho, en orden');
  const cat = await unaFila<{ oblig: string[]; est_plantilla: string | null }>(admin,
    `select (select secciones_obligatorias from catalogo.salidas_de_los_agentes where clave = 'research_market_research') as oblig,
            (select plantilla from catalogo.salidas_de_los_agentes where clave = 'estratega_oferta') as est_plantilla`);
  assert.deepEqual(cat!.oblig, [...SECCIONES_DEL_RESEARCH]);
  assert.equal(cat!.est_plantilla, null, 'el Estratega tiene plantilla y todavía no se definió qué hace');
  assert.match(PLANTILLA, /<section id="metodo" class="bloque"><h2>Cómo se hizo<\/h2>/, 'falta «Cómo se hizo», fijo en la plantilla');
  assert.match(PLANTILLA, /las 4 R: Retorno, Repetible, Recursos y Rápido de encontrar/);
  assert.match(ENV, /^<!DOCTYPE html>/);
  assert.match(ENV, /<title>Market research · ARIA IA<\/title>/);
  assert.match(ENV, /<\/style><\/head><body>$/);
  for (const clase of ['.inv', '.sup', '.confirmado', '.hip', 'blockquote.cita', 'tr.ganador', '.cifra']) {
    assert.ok(ENV.includes(clase), `la envoltura no tiene la clase ${clase}`);
  }

  const firmas = await unaFila<{ vieja: string | null; nueva: string | null; publico: boolean; mcp: boolean; inq: boolean }>(admin,
    `select to_regprocedure('agentes.guardar_secciones(uuid, jsonb, text)')::text as vieja,
            to_regprocedure('agentes.guardar_secciones(uuid, jsonb, text, boolean)')::text as nueva,
            has_function_privilege('public', 'agentes.guardar_secciones(uuid, jsonb, text, boolean)', 'execute') as publico,
            has_function_privilege('agente_mcp', 'agentes.guardar_secciones(uuid, jsonb, text, boolean)', 'execute') as mcp,
            has_function_privilege('app_inquilino', 'agentes.guardar_secciones(uuid, jsonb, text, boolean)', 'execute') as inq`);
  assert.equal(firmas!.vieja, null, 'la firma de tres argumentos sigue (una llamada de dos argumentos sería ambigua)');
  assert.ok(firmas!.nueva);
  assert.deepEqual([firmas!.publico, firmas!.mcp, firmas!.inq], [false, true, true]);
});

test('2 · tres tandas: las primeras quedan en la corrida y la última arma el documento entero en el orden de la plantilla', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('a');
    const re = await abrir('research', a.ghl);

    // Tanda 1: llegan dolores y a_quien (al revés de la plantilla).
    const t1 = await tanda(re.corrida_id, [s('dolores', '<p>DOLORES-V1</p>'), s('a_quien', '<p>A-QUIEN</p>')]);
    assert.equal(t1.ok, true, JSON.stringify(t1));
    assert.deepEqual([t1.terminado, t1.tandas, t1.guardadas], [false, 1, ['dolores', 'a_quien']]);
    assert.deepEqual(t1.faltan, ['resumen', 'quien_lo_resuelve', 'precio', 'segmentos', 'conclusiones', 'fuentes']);
    let c = await corrida(re.corrida_id);
    assert.equal(c!.estado, 'abierta', 'una tanda cerró la corrida');
    assert.deepEqual(c!.salida, { en_curso: true, columna: 'research_market_research', tandas: 1,
      secciones: [s('dolores', '<p>DOLORES-V1</p>'), s('a_quien', '<p>A-QUIEN</p>')] });
    assert.equal(await fila(a.id), undefined, 'una tanda escribió la columna');

    // Tanda 2: quien_lo_resuelve y precio, y dolores corregido (reemplaza al de la tanda 1, en su lugar).
    const t2 = await tanda(re.corrida_id, [s('quien_lo_resuelve', '<p>QUIEN</p>'), s('dolores', '<p>DOLORES-V2</p>'),
      s('precio', '<table><tr><th>Setup</th></tr><tr><td>USD 1.500</td></tr></table>')]);
    assert.equal(t2.ok, true, JSON.stringify(t2));
    assert.deepEqual(t2.guardadas, ['dolores', 'a_quien', 'quien_lo_resuelve', 'precio']);
    c = await corrida(re.corrida_id);
    assert.equal(c!.salida.tandas, 2);
    assert.deepEqual(c!.salida.secciones.find((x: Seccion) => x.id === 'dolores'), s('dolores', '<p>DOLORES-V2</p>'));
    assert.equal(c!.salida.secciones.filter((x: Seccion) => x.id === 'dolores').length, 1, 'dolores quedó dos veces');
    assert.equal(await fila(a.id), undefined);

    // La última: el resto. El documento sale en el orden de la plantilla, con todo.
    const t3 = await ultima(re.corrida_id, [s('fuentes', '<ol><li id="f1">Google Maps</li></ol>'), s('resumen', '<p>RESUMEN</p>'),
      s('segmentos', '<p>SEGMENTOS</p>'), s('conclusiones', '<p>CONCLUSIONES</p>')]);
    assert.equal(t3.ok, true, JSON.stringify(t3));
    assert.deepEqual([t3.terminado, t3.tandas, t3.version, t3.con_plantilla, t3.columna], [true, 3, 1, true, 'research_market_research']);
    const esperado = conLaPlantilla({ resumen: '<p>RESUMEN</p>', a_quien: '<p>A-QUIEN</p>', dolores: '<p>DOLORES-V2</p>',
      quien_lo_resuelve: '<p>QUIEN</p>', precio: '<table><tr><th>Setup</th></tr><tr><td>USD 1.500</td></tr></table>',
      segmentos: '<p>SEGMENTOS</p>', conclusiones: '<p>CONCLUSIONES</p>', fuentes: '<ol><li id="f1">Google Maps</li></ol>' });
    const f = await fila(a.id);
    assert.equal(f!.research_market_research, esperado, 'el documento no tiene todas las tandas en el orden de la plantilla');
    assert.ok(!f!.research_market_research.includes('DOLORES-V1'), 'quedó el dolores de la tanda 1');
    assert.ok(f!.research_market_research.indexOf('RESUMEN') < f!.research_market_research.indexOf('A-QUIEN'));
    const p = f!.procedencia.research_market_research;
    assert.deepEqual([p.version, p.corrida_id, p.tandas, p.con_plantilla], [1, re.corrida_id, 3, true]);
    assert.deepEqual(p.secciones, ['dolores', 'a_quien', 'quien_lo_resuelve', 'precio', 'fuentes', 'resumen', 'segmentos', 'conclusiones']);

    c = await corrida(re.corrida_id);
    assert.equal(c!.estado, 'lista');
    assert.equal(c!.salida.en_curso, undefined, 'la salida final sigue marcada en curso');
    assert.equal(c!.salida.html, esperado);
    assert.equal(c!.salida.secciones.length, 8);

    // El Estratega lee las ocho.
    const es = await abrir('estratega', a.ghl);
    const l = await j(`select agentes.leer_secciones($1, 'research_market_research') as r`, [es.corrida_id]);
    assert.deepEqual(l.secciones.map((x: Seccion) => x.id).sort(), [...SECCIONES_DEL_RESEARCH].sort());
    assert.equal(l.secciones.find((x: Seccion) => x.id === 'dolores').html, '<p>DOLORES-V2</p>');
  });
});

test('3 · las obligatorias se exigen al terminar, y un rechazo ahí no borra lo guardado', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('b');
    const re = await abrir('research', a.ghl);
    // Una tanda con una sola sección pasa: todavía no se exige nada.
    assert.equal((await tanda(re.corrida_id, [s('resumen', '<p>R</p>')])).ok, true);
    const resto = SECCIONES_DEL_RESEARCH.filter((x) => x !== 'resumen' && x !== 'fuentes').map((x) => s(x, `<p>${x}</p>`));
    assert.equal((await tanda(re.corrida_id, resto)).ok, true);
    // La última sin fuentes: rechazo, gasta un intento, la corrida sigue abierta con sus tandas.
    const sin = await ultima(re.corrida_id, []);
    assert.equal(sin.ok, false);
    assert.match(JSON.stringify(sin.errores), /falta la sección obligatoria «fuentes»/);
    let c = await corrida(re.corrida_id);
    assert.deepEqual([c!.estado, c!.intentos, c!.salida.tandas, c!.salida.secciones.length], ['abierta', 1, 2, 7]);
    assert.equal(await fila(a.id), undefined, 'un rechazo escribió la columna');
    // Con fuentes, termina.
    const ok = await ultima(re.corrida_id, [s('fuentes', '<p>F</p>')]);
    assert.equal(ok.ok, true, JSON.stringify(ok));
    assert.equal(ok.tandas, 3, 'el intento rechazado contó como tanda');
    c = await corrida(re.corrida_id);
    assert.equal(c!.estado, 'lista');
    assert.match((await fila(a.id))!.research_market_research, /<p>R<\/p>[\s\S]*<p>a_quien<\/p>[\s\S]*<p>F<\/p>/);
  });
});

test('4 · un rechazo en una tanda no borra las anteriores; la última puede ir vacía, la primera no', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('c');
    const re = await abrir('research', a.ghl);
    // Vacía al principio (terminando o no): rechazo.
    const vacia = await ultima(re.corrida_id, []);
    assert.equal(vacia.ok, false);
    assert.match(JSON.stringify(vacia.errores), /sólo la última tanda puede ir vacía/);
    const vaciaT = await tanda(re.corrida_id, []);
    assert.equal(vaciaT.ok, false);

    const todas = SECCIONES_DEL_RESEARCH.map((x) => s(x, `<p>${x}</p>`));
    assert.equal((await tanda(re.corrida_id, todas.slice(0, 4))).ok, true);
    // Una tanda con un <style> y otra con una sección que la plantilla no tiene: rechazos que no tocan lo guardado.
    const estilo = await tanda(re.corrida_id, [s('segmentos', '<style>p{}</style>')]);
    assert.equal(estilo.ok, false);
    assert.match(JSON.stringify(estilo.errores), /sección «segmentos»: sólo el contenido/);
    const ajena = await tanda(re.corrida_id, [s('extra', '<p>x</p>')]);
    assert.equal(ajena.ok, false);
    assert.match(JSON.stringify(ajena.errores), /sección «extra»: la plantilla no la tiene/);
    const c = await corrida(re.corrida_id);
    assert.deepEqual(c!.salida.secciones, todas.slice(0, 4), 'un rechazo pisó las tandas guardadas');
    assert.equal(c!.salida.tandas, 1);

    assert.equal((await tanda(re.corrida_id, todas.slice(4))).ok, true);
    // Ya está todo: la última va vacía y cierra.
    const fin = await ultima(re.corrida_id, []);
    assert.equal(fin.ok, true, JSON.stringify(fin));
    assert.deepEqual([fin.tandas, fin.secciones.length], [3, 8]);
    assert.equal((await fila(a.id))!.research_market_research,
      conLaPlantilla(Object.fromEntries(todas.map((x) => [x.id, x.html]))));
  });
});

test('5 · cada corrida con sus tandas: la nueva no hereda las de la reemplazada, y una terminada no acepta otra', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('d');
    const r1 = await abrir('research', a.ghl);
    assert.equal((await tanda(r1.corrida_id, [s('dolores', '<p>DE-LA-CORRIDA-1</p>')])).ok, true);
    // Una corrida nueva del mismo lead reemplaza a la primera, y empieza de cero.
    const r2 = await abrir('research', a.ghl);
    assert.deepEqual(r2.reemplazo_a, [r1.corrida_id]);
    assert.equal((await corrida(r1.corrida_id))!.estado, 'reemplazada');
    const t = await tanda(r2.corrida_id, [s('resumen', '<p>R2</p>')]);
    assert.deepEqual(t.guardadas, ['resumen'], 'la corrida nueva heredó las tandas de la reemplazada');
    // La reemplazada no acepta más tandas.
    assert.match(await fallaCon('55000', `select agentes.guardar_secciones($1, '[{"id":"precio","html":"<p>x</p>"}]'::jsonb, null, false)`,
      [r1.corrida_id]), /no está abierta|ya no/);
    // Las tandas de otro lead tampoco cuentan.
    const b = await unLead('e');
    const rb = await abrir('research', b.ghl);
    const tb = await tanda(rb.corrida_id, [s('precio', '<p>de B</p>')]);
    assert.deepEqual(tb.guardadas, ['precio']);

    const resto = SECCIONES_DEL_RESEARCH.filter((x) => x !== 'resumen').map((x) => s(x, `<p>${x}</p>`));
    assert.equal((await ultima(r2.corrida_id, resto)).ok, true);
    const doc = (await fila(a.id))!.research_market_research;
    assert.ok(!doc.includes('DE-LA-CORRIDA-1') && !doc.includes('de B'), 'el documento trajo tandas de otra corrida');
    // Terminada: otra tanda ya no entra.
    assert.match(await fallaCon('55000', `select agentes.guardar_secciones($1, '[{"id":"precio","html":"<p>x</p>"}]'::jsonb, null, false)`,
      [r2.corrida_id]), /no está abierta|ya no/);
  });
});

test('6 · sin plantilla (el Estratega): el orden de llegada, el reemplazo en su lugar, y el tope de 40 entre tandas', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('f');
    const es = await abrir('estratega', a.ghl);
    assert.equal((await tanda(es.corrida_id, [s('clienta_ideal', '<p>C1</p>'), s('dolores', '<p>D</p>')])).ok, true);
    const fin = await ultima(es.corrida_id, [s('big_idea', '<p>B</p>'), s('clienta_ideal', '<p>C2</p>')]);
    assert.equal(fin.ok, true, JSON.stringify(fin));
    assert.equal(fin.con_plantilla, false);
    const env = (await comoAdmin(() => unaFila<{ e: string }>(admin,
      `select envoltura as e from catalogo.salidas_de_los_agentes where clave = 'estratega_oferta'`)))!.e;
    assert.equal((await fila(a.id))!.estratega_oferta,
      `${env}\n<section id="clienta_ideal">\n<p>C2</p>\n</section>\n<section id="dolores">\n<p>D</p>\n</section>\n`
      + `<section id="big_idea">\n<p>B</p>\n</section>${FIN}`);

    // 30 en una tanda y 15 en otra: el tope cuenta todas.
    const e2 = await abrir('estratega', a.ghl);
    const muchas = (desde: number, n: number) => Array.from({ length: n }, (_x, i) => s(`s${desde + i}`, `<p>${desde + i}</p>`));
    assert.equal((await tanda(e2.corrida_id, muchas(0, 30))).ok, true);
    const tope = await tanda(e2.corrida_id, muchas(30, 15));
    assert.equal(tope.ok, false);
    assert.match(JSON.stringify(tope.errores), /hasta 40 entre todas las tandas \(van 45\)/);
  });
});

test('7 · una ficha no se guarda en tandas, y p_terminar null es terminar', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('g');
    const sa = await abrir('sales_assistant', a.ghl);
    const r = await tanda(sa.corrida_id, [s('resumen', '<p>x</p>')]);
    assert.equal(r.ok, false);
    assert.match(JSON.stringify(r.errores), /no se guarda por secciones: usa agentes\.guardar_respuesta/);

    const es = await abrir('estratega', a.ghl);
    const n = await j(`select agentes.guardar_secciones($1, $2::jsonb, null, null) as r`,
      [es.corrida_id, JSON.stringify([s('oferta', '<p>O</p>')])]);
    assert.equal(n.ok, true, JSON.stringify(n));
    assert.equal(n.terminado, true);
    assert.equal((await corrida(es.corrida_id))!.estado, 'lista');
  });
});
