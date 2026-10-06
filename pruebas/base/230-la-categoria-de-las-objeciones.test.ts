// LA CATEGORÍA DE CADA OBJECIÓN: UNA VEZ, EN LA TAREA, Y POR RECONCILIACIÓN. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/analizadores/objeciones.ts` y su paso en la tarea del analizador (AG11 de los agentes; `T-18`), con la
// red falsa de los Analizadores:
//
//   · la tarea clasifica lo que falta, una pedida por llamada, y la corrida siguiente no vuelve a pedir;
//   · lo que el modelo no devolvió, o devolvió mal, queda sin categoría y se pide otra vez, sólo eso;
//   · si la llamada se vuelve a analizar y el texto de una objeción cambia, se clasifica de nuevo;
//   · el uso queda con el agente `objeciones`; con la llave rechazada se corta, y sin tiempo no se pide.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { correrAnalizadores } from '../../lib/analizadores/tarea.ts';
import { ESPERA_DE_LA_CLASIFICACION_MS, clasificarObjeciones, objecionesSinClasificar } from '../../lib/analizadores/objeciones.ts';
import { MARGEN_MS, relojDe } from '../../lib/analizadores/pipeline.ts';
import { TABLAS_DEL_ANALIZADOR, delModelo, instalarRedFalsa, quitarRedFalsa, red } from '../apoyo/analizador.ts';

let esc: Escenario;
const ACCESO = { tipo: 'listo' as const, claveIa: 'ia-falsa', claveTldv: 'tldv-falsa' };

async function limpiar(): Promise<void> {
  for (const t of TABLAS_DEL_ANALIZADOR) await esc.admin.query(`delete from negocio.${t} where org_id = any($1)`, [[esc.org, esc.otraOrg]]);
  await esc.admin.query(`delete from negocio.tareas_programadas where tarea in ('analizadores', 'reintentos')`);
  await esc.admin.query(`delete from negocio.uso_de_ia where org_id = any($1) and (agente like 'analizador%' or agente = 'objeciones')`, [[esc.org, esc.otraOrg]]);
  await esc.admin.query(`delete from negocio.incidentes where org_id = any($1) and origen = 'analizador'`, [[esc.org, esc.otraOrg]]);
}

before(async () => {
  esc = await montar('objeciones-230');
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

/** Una HT analizada con esas objeciones. Devuelve su id. */
async function unaAnalizada(objeciones: string[]): Promise<string> {
  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.analizador_llamadas (org_id, tipo, proveedor, estado) values ($1, 'HT', 'MANUAL', 'DONE') returning id`,
    [esc.org],
  );
  const id = r.rows[0]!.id;
  await esc.admin.query(
    `insert into negocio.analizador_analisis (org_id, llamada_id, tipo, coincide, analisis, modelo, version_de_rubrica)
     values ($1, $2, 'HT', true, $3, 'claude-sonnet-5', 'rubric.es.md@v8.1')`,
    [esc.org, id, JSON.stringify({ seller: { objections: objeciones.map((objection) => ({ objection, howHandled: '', howToRespond: '' })) } })],
  );
  return id;
}

async function categorias(): Promise<[string, number, string][]> {
  const r = await esc.admin.query<{ llamada_id: string; indice: number; categoria: string }>(
    'select llamada_id, indice, categoria from negocio.objeciones_clasificadas where org_id = $1 order by llamada_id, indice',
    [esc.org],
  );
  return r.rows.map((f) => [f.llamada_id, f.indice, f.categoria]);
}

test('la tarea clasifica lo que falta, una pedida por llamada, y la corrida siguiente no vuelve a pedir', async () => {
  const a = await unaAnalizada(['Me parece alto el precio.', 'Lo tengo que hablar con mi socio.']);
  const b = await unaAnalizada(['El precio no me cierra.']);
  const r = await correrAnalizadores(esc.org, ACCESO, relojDe(300_000));
  assert.deepEqual([r.objeciones, r.pedidasDeObjeciones, red.llamadasALasObjeciones], [3, 2, 2]);
  assert.deepEqual(
    (await categorias()).sort(),
    [[a, 0, 'precio'], [a, 1, 'otra'], [b, 0, 'precio']].sort() as [string, number, string][],
  );
  const otra = await correrAnalizadores(esc.org, ACCESO, relojDe(300_000));
  assert.deepEqual([otra.pedidasDeObjeciones, red.llamadasALasObjeciones], [0, 2]);
  // Una fila de uso por pedida, con el agente nuevo.
  const uso = await esc.admin.query<{ n: string }>(`select count(*)::text as n from negocio.uso_de_ia where org_id = $1 and agente = 'objeciones'`, [esc.org]);
  assert.equal(uso.rows[0]!.n, '2');
});

test('lo que el modelo no devolvió, o devolvió mal, queda sin categoría y se pide otra vez, sólo eso', async () => {
  const a = await unaAnalizada(['Es caro el precio.', 'No es el momento.']);
  red.objeciones.push(() => delModelo(JSON.stringify({ categorias: [{ indice: 0, categoria: 'precio' }, { indice: 5, categoria: 'otra' }] })));
  await correrAnalizadores(esc.org, ACCESO, relojDe(300_000));
  assert.deepEqual(await categorias(), [[a, 0, 'precio']]);
  const faltan = await objecionesSinClasificar(esc.org, 10);
  assert.deepEqual(faltan.map((l) => [l.llamadaId, l.objeciones.map((o) => o.indice)]), [[a, [1]]]);
  await correrAnalizadores(esc.org, ACCESO, relojDe(300_000));
  assert.deepEqual(await categorias(), [[a, 0, 'precio'], [a, 1, 'otra']]);
});

test('si la llamada se vuelve a analizar y el texto de una objeción cambia, se clasifica de nuevo', async () => {
  const a = await unaAnalizada(['Es caro el precio.']);
  await correrAnalizadores(esc.org, ACCESO, relojDe(300_000));
  assert.deepEqual(await categorias(), [[a, 0, 'precio']]);
  await esc.admin.query(
    `update negocio.analizador_analisis set analisis = $3 where org_id = $1 and llamada_id = $2`,
    [esc.org, a, JSON.stringify({ seller: { objections: [{ objection: 'Tengo que consultarlo.', howHandled: '', howToRespond: '' }] } })],
  );
  assert.equal((await objecionesSinClasificar(esc.org, 10)).length, 1, 'la categoría vieja seguía valiendo para otro texto');
  await correrAnalizadores(esc.org, ACCESO, relojDe(300_000));
  assert.deepEqual(await categorias(), [[a, 0, 'otra']]);
});

test('con la llave rechazada se corta, y sin tiempo no se pide', async () => {
  await unaAnalizada(['Es caro el precio.']);
  await unaAnalizada(['No es el momento.']);
  red.estadoDeAnthropic = 401;
  const r = await correrAnalizadores(esc.org, ACCESO, relojDe(300_000));
  assert.equal(r.llaveRechazada, 'ia');
  // Una sola pedida, rechazada, con su fila de uso: la segunda llamada no se pidió.
  const uso = await esc.admin.query<{ n: string }>(`select count(*)::text as n from negocio.uso_de_ia where org_id = $1 and agente = 'objeciones'`, [esc.org]);
  assert.deepEqual([r.pedidasDeObjeciones, uso.rows[0]!.n, (await categorias()).length], [1, '1', 0]);

  red.estadoDeAnthropic = 200;
  const corto = await clasificarObjeciones(esc.org, 'ia-falsa', relojDe(ESPERA_DE_LA_CLASIFICACION_MS + MARGEN_MS - 1));
  assert.deepEqual([corto.pedidas, corto.sinTiempo], [0, 2]);
});
