// EL USO DE LA IA, CONTRA LA BASE. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `negocio.uso_de_ia` (`069`) y su único escritor, `registrarUso` (`lib/agentes/uso.ts`). Sus defectos no
// se ven en ninguna pantalla: se ven en los topes de otra empresa o en un consumo que nadie puede explicar.
//
//   · La fila guarda sus cuatro contadores, cada uno en su columna, y otra empresa no la ve.
//   · Se escribe en SU transacción: con una abierta afuera avisa, y el rollback de afuera no se la lleva.
//   · Un error de la base no sale de `registrarUso`: deja su línea y sigue.
//   · El transporte deja UNA fila por llamada, con la referencia del incidente cuando falla; y con
//     `los_agrega_quien_llama` deja el uso sin escribir incidentes.
//   · La forma: estas columnas, ninguna con texto del modelo, y el juego de agentes del código es el de
//     la base.
//
// Contra la base local, con las dos empresas del sembrado. La red es falsa: nada gasta.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { AGENTES_DE_USO, registrarUso } from '../../lib/agentes/uso.ts';
import { type Costuras, type PedidoAlModelo, leerJson, llamarAlModelo } from '../../lib/agentes/llamada.ts';

/** La marca: va en `modelo`, que es texto libre, y en el `donde` de los incidentes. Se borra sólo lo marcado. */
const MARCA = 'prueba-200';
let esc: Escenario;

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.uso_de_ia where modelo like $1', [`${MARCA}%`]);
  await esc.admin.query('delete from negocio.incidentes where donde = $1', [MARCA]);
}

before(async () => {
  esc = await montar('UsoDeIa');
  await limpiar();
});

after(async () => {
  await limpiar();
  // La sesión que `montar` abre para `quien`: este archivo no la usa, y no tiene por qué quedar.
  await esc.admin.query('delete from identidad.sesiones where token_hash = $1', [hashDeToken(esc.token)]);
  await cerrarClientes();
  await cerrarTodo();
});

const USO = { input: 1000, output: 200, cacheWrite: 50, cacheRead: 3000 };

/** Lo que el registro dijo mientras corría `trabajo`, sin ensuciar la salida de la suite. */
async function callado<T>(trabajo: () => Promise<T>): Promise<{ salida: T; lineas: string[] }> {
  const lineas: string[] = [];
  const error = console.error;
  const aviso = console.warn;
  console.error = (...p: unknown[]) => void lineas.push(p.map(String).join(' '));
  console.warn = (...p: unknown[]) => void lineas.push(p.map(String).join(' '));
  try {
    return { salida: await trabajo(), lineas };
  } finally {
    console.error = error;
    console.warn = aviso;
  }
}

/** Las filas de la marca, leídas como las lee la aplicación: por el inquilino, dentro de un contexto. */
const delUso = (org: string) =>
  conOrganizacion(org, () =>
    datos()
      .selectFrom('uso_de_ia')
      .select([
        'agente',
        'modelo',
        'tokens_entrada',
        'tokens_salida',
        'tokens_escritura_cache',
        'tokens_lectura_cache',
        'duracion_ms',
        'resultado',
        'usuario_id',
        'ref',
      ])
      .where('modelo', 'like', `${MARCA}%`)
      .orderBy('modelo')
      .execute(),
  );

test('la fila guarda sus cuatro contadores, cada uno en su columna, y otra empresa no la ve', async () => {
  await limpiar();
  /* FUERA de todo contexto, como la llama el transporte (AG-05). Dentro de uno, el contexto de quien
     llama salvaría a un `registrarUso` que se olvidó del suyo. Cuatro valores distintos: dos columnas
     cruzadas no pasan. */
  await registrarUso({ orgId: esc.org, agente: 'brief', modelo: `${MARCA}-a`, uso: USO, duracionMs: 1234, resultado: 'ok', usuarioId: esc.quien, ref: 'hilo-a' });
  await registrarUso({
    orgId: esc.otraOrg,
    agente: 'executive',
    modelo: `${MARCA}-b`,
    uso: { input: 1, output: 2, cacheWrite: 3, cacheRead: 4 },
    duracionMs: 10,
    resultado: 'IA-SATURADO',
    usuarioId: null,
    ref: null,
  });

  const deA = await delUso(esc.org);
  assert.equal(deA.length, 1, 'la empresa A no ve su fila: ¿se escribió fuera de su contexto?');
  assert.deepEqual(deA[0], {
    agente: 'brief',
    modelo: `${MARCA}-a`,
    tokens_entrada: 1000,
    tokens_salida: 200,
    tokens_escritura_cache: 50,
    tokens_lectura_cache: 3000,
    duracion_ms: 1234,
    resultado: 'ok',
    usuario_id: esc.quien,
    ref: 'hilo-a',
  });
  // La otra mitad: la otra empresa ve la suya, y sólo la suya. Sin esto, una lectura vacía pasaría la de arriba.
  const deB = await delUso(esc.otraOrg);
  assert.deepEqual(
    deB.map((f) => [f.modelo, f.resultado, f.tokens_lectura_cache]),
    [[`${MARCA}-b`, 'IA-SATURADO', 4]],
  );
});

test('con una transacción abierta, avisa y escribe en la SUYA: el rollback de afuera no se la lleva', async () => {
  await limpiar();
  const { lineas } = await callado(() =>
    assert.rejects(
      conOrganizacion(esc.org, async () => {
        await registrarUso({ orgId: esc.org, agente: 'plan', modelo: `${MARCA}-dentro`, uso: USO, duracionMs: 1, resultado: 'ok', usuarioId: null, ref: null });
        throw new Error('la operación de afuera se revierte');
      }),
      /se revierte/,
    ),
  );
  const { rows } = await esc.admin.query<{ n: string }>('select count(*) as n from negocio.uso_de_ia where modelo = $1', [`${MARCA}-dentro`]);
  assert.equal(Number(rows[0]?.n), 1, 'el consumo ya se pagó: la fila tiene que sobrevivir al rollback de quien la llamó');
  assert.equal(lineas.filter((l) => l.startsWith('uso: registrarUso con una transacción abierta')).length, 1);
});

test('un error de la base no sale de `registrarUso`: deja su línea y la llamada sigue', async () => {
  await limpiar();
  // Un agente fuera del juego: la base lo rechaza con `23514`. El tipo no deja escribirlo; acá se fuerza.
  const { lineas } = await callado(() =>
    registrarUso({ orgId: esc.org, agente: 'copywriter' as never, modelo: `${MARCA}-roto`, uso: USO, duracionMs: 1, resultado: 'ok', usuarioId: null, ref: null }),
  );
  assert.equal(lineas.filter((l) => l.startsWith('uso: no se pudo guardar el de copywriter')).length, 1);
  assert.deepEqual(await delUso(esc.org), []);
});

// ── El transporte, con la red falsa y la base de verdad ───────────────────────

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
const buena = () =>
  json({
    content: [{ type: 'text', text: '{"ok":true}' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 50, cache_read_input_tokens: 3000 },
  });
const rechazada = (estado: number, tipo: string) => () => json({ type: 'error', error: { type: tipo, message: 'x' } }, estado);

/** Sin pausa de verdad: el reintento no tiene por qué costarle tres segundos a la suite. */
const SIN_PAUSA: Costuras = { ahora: () => Date.now(), pausa: async () => {} };

async function llamar(modelo: string, respuestas: (() => Response)[], extra: Partial<PedidoAlModelo<unknown>> = {}) {
  let llamadas = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    const r = respuestas[Math.min(llamadas, respuestas.length - 1)]!;
    llamadas++;
    return r();
  }) as typeof globalThis.fetch;
  const pedido: PedidoAlModelo<unknown> = {
    agente: 'brief',
    modelo,
    llave: 'sk-de-prueba',
    orgId: esc.org,
    usuarioId: esc.quien,
    ref: 'hilo-t',
    donde: MARCA,
    techo: 100,
    instrucciones: 'x',
    mensajes: [{ role: 'user', content: 'y' }],
    leer: leerJson,
    ...extra,
  };
  try {
    const { salida } = await callado(() => llamarAlModelo(pedido, SIN_PAUSA));
    return { salida, llamadas };
  } finally {
    globalThis.fetch = original;
  }
}

const filasDe = async (modelo: string) =>
  (
    await esc.admin.query<Record<string, unknown>>(
      `select tokens_entrada, tokens_salida, tokens_escritura_cache, tokens_lectura_cache, resultado, usuario_id, ref
         from negocio.uso_de_ia where org_id = $1 and modelo = $2`,
      [esc.org, modelo],
    )
  ).rows;

test('el transporte deja UNA fila por llamada: la buena con sus contadores, la fallida con la referencia de su incidente', async () => {
  await limpiar();

  const bien = await llamar(`${MARCA}-bien`, [buena]);
  assert.equal(bien.salida.tipo, 'datos');
  assert.deepEqual(await filasDe(`${MARCA}-bien`), [
    { tokens_entrada: 1000, tokens_salida: 200, tokens_escritura_cache: 50, tokens_lectura_cache: 3000, resultado: 'ok', usuario_id: esc.quien, ref: 'hilo-t' },
  ]);

  // La llave rechazada: no contestó, así que no se sabe qué consumió; y la fila apunta a SU incidente.
  const mal = await llamar(`${MARCA}-mal`, [rechazada(401, 'authentication_error')]);
  assert.ok(mal.salida.tipo === 'fallo');
  assert.deepEqual(await filasDe(`${MARCA}-mal`), [
    { tokens_entrada: null, tokens_salida: null, tokens_escritura_cache: null, tokens_lectura_cache: null, resultado: 'IA-LLAVE', usuario_id: esc.quien, ref: mal.salida.ref },
  ]);
  const incidente = await esc.admin.query(
    'select situacion, origen, salvado from negocio.incidentes where org_id = $1 and ref = $2 and donde = $3',
    [esc.org, mal.salida.ref, MARCA],
  );
  assert.deepEqual(incidente.rows, [{ situacion: 'IA-LLAVE', origen: 'brief', salvado: false }]);

  // Saturado y después bien: dos pedidos, UNA fila del uso, y el incidente salvado.
  const salvada = await llamar(`${MARCA}-salvada`, [rechazada(529, 'overloaded_error'), buena]);
  assert.equal(salvada.llamadas, 2);
  assert.equal(salvada.salida.tipo, 'datos');
  assert.deepEqual((await filasDe(`${MARCA}-salvada`)).map((f) => f['resultado']), ['ok']);
  const salvados = await esc.admin.query('select situacion from negocio.incidentes where org_id = $1 and donde = $2 and salvado', [esc.org, MARCA]);
  assert.deepEqual(salvados.rows, [{ situacion: 'IA-SATURADO' }]);
});

test('con `los_agrega_quien_llama`, las fallidas y la salvada dejan su fila de uso y ningún incidente', async () => {
  /* Es lo que va a hacer una tarea del cron (AG-98): el uso de cada llamada queda, y los incidentes los
     agrega la tarea por corrida y situación. La fila apunta a lo que se pidió, no a un incidente que no existe. */
  await limpiar();
  for (const n of [1, 2]) {
    const r = await llamar(`${MARCA}-cron-${n}`, [rechazada(401, 'authentication_error')], {
      incidentes: 'los_agrega_quien_llama',
      ref: `analisis-${n}`,
    });
    assert.ok(r.salida.tipo === 'fallo' && r.salida.situacion === 'IA-LLAVE');
  }
  const filas = await esc.admin.query<{ resultado: string; ref: string }>(
    'select resultado, ref from negocio.uso_de_ia where org_id = $1 and modelo like $2 order by modelo',
    [esc.org, `${MARCA}-cron-%`],
  );
  assert.deepEqual(filas.rows, [
    { resultado: 'IA-LLAVE', ref: 'analisis-1' },
    { resultado: 'IA-LLAVE', ref: 'analisis-2' },
  ]);
  // Y el reintento salvado tampoco escribe su incidente: una fila `ok`, dos pedidos, ningún incidente.
  const salvada = await llamar(`${MARCA}-cron-salvada`, [rechazada(529, 'overloaded_error'), buena], { incidentes: 'los_agrega_quien_llama' });
  assert.equal(salvada.llamadas, 2);
  assert.ok(salvada.salida.tipo === 'datos' && salvada.salida.salvadoDe === 'IA-SATURADO');
  assert.deepEqual((await filasDe(`${MARCA}-cron-salvada`)).map((f) => f['resultado']), ['ok']);

  const incidentes = await esc.admin.query('select count(*)::int as n from negocio.incidentes where org_id = $1 and donde = $2', [esc.org, MARCA]);
  assert.deepEqual(incidentes.rows, [{ n: 0 }]);
});

test('la forma: estas columnas y ninguna con texto del modelo, y el juego de agentes del código es el de la base', async () => {
  await limpiar();
  const columnas = await esc.admin.query<{ column_name: string }>(
    `select column_name from information_schema.columns
      where table_schema = 'negocio' and table_name = 'uso_de_ia' order by ordinal_position`,
  );
  assert.deepEqual(
    columnas.rows.map((c) => c.column_name),
    ['org_id', 'id', 'creado_el', 'agente', 'modelo', 'tokens_entrada', 'tokens_salida', 'tokens_escritura_cache', 'tokens_lectura_cache', 'duracion_ms', 'resultado', 'usuario_id', 'ref'],
    'una columna nueva en esta tabla es una decisión: «ningún texto» (AG-94)',
  );

  const { rows } = await esc.admin.query<{ def: string }>(
    `select pg_get_constraintdef(oid) as def from pg_constraint
      where conrelid = 'negocio.uso_de_ia'::regclass and conname = 'uso_de_ia_agente_check'`,
  );
  assert.equal(rows.length, 1, 'no está el check del juego cerrado de agentes');
  const enLaBase = [...rows[0]!.def.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]).sort();
  assert.deepEqual(enLaBase, [...AGENTES_DE_USO].sort());

  // Y lo de afuera del juego lo rechaza la base, no sólo el tipo: `23514` es un `check`.
  await assert.rejects(
    esc.admin.query(
      `insert into negocio.uso_de_ia (org_id, agente, modelo, duracion_ms, resultado) values ($1, 'copywriter', $2, 1, 'ok')`,
      [esc.org, `${MARCA}-x`],
    ),
    { code: '23514' },
  );
});
