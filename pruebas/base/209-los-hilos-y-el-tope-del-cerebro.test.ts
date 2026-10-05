// LOS HILOS DEL CEREBRO SON DE SU AUTOR, Y EL TOPE SE CUENTA BAJO CANDADO. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/executive/conversaciones.ts` y `topes.ts` (AG5 de los agentes), por la ruta del Inicio:
//
//   · `D-14`: un hilo es de quien lo escribió. Otra persona de la misma empresa no lo ve, no lo lee y no lo
//     borra: recibe 404, como si no existiera. La RLS separa empresas, no personas.
//   · `AG-96`: el tope se cuenta y se reserva en la misma transacción, bajo `select … for update`. La prueba
//     provoca la carrera de verdad —un candado aparte retiene la fila mientras llegan dos preguntas— y con
//     el tope en 1 sólo una pasa.
//   · Una pregunta que falla queda `fallida` y no cuenta.
//   · `D-17`: bajo delegación el cerebro no responde, y lo rechaza el servidor.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { cerrarTodo, conectar } from '../apoyo/conexiones.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { leerRespuesta, montar, pedirComo, sesionDe, type Escenario } from '../apoyo/closer.ts';
import { escribe, instalarModeloFalso, pideHerramienta, respuestaDelModelo, respuestaMinima, type ModeloFalso } from '../apoyo/cerebro.ts';
import { DELETE as borrar, GET as mirar, POST as preguntarAlCerebro } from '../../app/api/executive/route.ts';

const NOMBRE_DE_PERSONA = 'Persona de la 209';
let esc: Escenario;
let modelo: ModeloFalso | null = null;
const sesionesPropias: string[] = [];

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.conversaciones_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.topes_del_executive where org_id = $1', [esc.org]);
  // El registro del tope no cae con los hilos (a propósito): se limpia aparte.
  await esc.admin.query('delete from negocio.preguntas_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query(`delete from negocio.uso_de_ia where org_id = $1 and agente = 'executive'`, [esc.org]);
  await esc.admin.query(`delete from negocio.incidentes where org_id = $1 and origen = 'executive'`, [esc.org]);
  await esc.admin.query('delete from identidad.usuarios where nombre = $1', [NOMBRE_DE_PERSONA]);
  await esc.admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [esc.org]);
  for (const t of sesionesPropias.splice(0)) await esc.admin.query('delete from identidad.sesiones where token_hash = $1', [hashDeToken(t)]);
}

/** Otra persona de `alfa`, administradora: ve todo lo que ve Ana. */
async function otraPersona(): Promise<string> {
  const r = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash) values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [esc.org, NOMBRE_DE_PERSONA, `cerebro-209-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
  );
  await esc.admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'administrador' and org_id is null`,
    [r.rows[0]!.id],
  );
  const token = await sesionDe(r.rows[0]!.id);
  sesionesPropias.push(token);
  return token;
}

const preguntar = (cuerpo: unknown, token = esc.token) => preguntarAlCerebro(pedirComo('/api/executive', token, { metodo: 'POST', cuerpo }));
const contesta = (conclusion = 'Hecho.') => respuestaDelModelo([pideHerramienta('responder', respuestaMinima(conclusion))]);

async function preguntasDeHoy(): Promise<{ estado: string }[]> {
  const r = await esc.admin.query<{ estado: string }>(
    `select estado from negocio.mensajes_del_executive where org_id = $1 and rol = 'persona' order by creado_el`,
    [esc.org],
  );
  return r.rows;
}

before(async () => {
  esc = await montar('Cerebro209');
});
beforeEach(async () => {
  modelo?.quitar();
  modelo = null;
  await limpiar();
  await esc.admin.query('insert into identidad.organizaciones_credenciales (org_id, ia_clave_cifrada) values ($1, $2)', [esc.org, cifrar('sk-de-prueba-209')]);
});
after(async () => {
  modelo?.quitar();
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

test('un hilo ajeno no se ve, no se lee, no se continúa y no se borra: 404 como si no existiera', async () => {
  modelo = instalarModeloFalso([contesta()]);
  const p = await leerRespuesta<{ hiloId: string }>(await preguntar({ pregunta: 'Una pregunta de Ana' }));
  const otra = await otraPersona();

  const lista = await leerRespuesta<{ hilos: unknown[] }>(await mirar(pedirComo('/api/executive', otra)));
  assert.deepEqual(lista.cuerpo.hilos, []);
  assert.equal((await mirar(pedirComo(`/api/executive?hilo=${p.cuerpo.hiloId}`, otra))).status, 404);
  assert.equal((await preguntar({ pregunta: 'Me cuelgo del hilo de Ana', hilo: p.cuerpo.hiloId }, otra)).status, 404);
  assert.equal((await borrar(pedirComo(`/api/executive?hilo=${p.cuerpo.hiloId}`, otra, { metodo: 'DELETE' }))).status, 404);
  // Y el hilo de Ana sigue entero.
  const deAna = await leerRespuesta<{ mensajes: unknown[] }>(await mirar(pedirComo(`/api/executive?hilo=${p.cuerpo.hiloId}`, esc.token)));
  assert.equal(deAna.cuerpo.mensajes.length, 2);
});

test('el tope se cuenta bajo candado: con el tope en 1, de dos preguntas en carrera pasa una', async () => {
  await esc.admin.query('insert into negocio.topes_del_executive (org_id, por_persona, por_empresa) values ($1, 1, 300)', [esc.org]);
  modelo = instalarModeloFalso([contesta(), contesta()]);

  // El candado aparte retiene la fila de topes mientras llegan las dos preguntas.
  const candado = await conectar('admin');
  await candado.query('begin');
  await candado.query('select 1 from negocio.topes_del_executive where org_id = $1 for update', [esc.org]);
  const primera = preguntar({ pregunta: 'La primera' });
  const segunda = preguntar({ pregunta: 'La segunda' });
  try {
    await esperarBloqueadas(2, 'topes_del_executive');
  } finally {
    await candado.query('commit');
    await candado.end();
  }
  const estados = (await Promise.all([primera, segunda])).map((r) => r.status).sort();
  assert.deepEqual(estados, [200, 429]);
  assert.deepEqual((await preguntasDeHoy()).map((m) => m.estado), ['respondida']);
  assert.equal(modelo.quedan(), 1, 'la pregunta que no tenía lugar llamó al modelo');
});

test('una pregunta que falla sin que el proveedor conteste queda fallida y no cuenta: con el tope en 1, la siguiente pasa', async () => {
  await esc.admin.query('insert into negocio.topes_del_executive (org_id, por_persona, por_empresa) values ($1, 1, 300)', [esc.org]);
  modelo = instalarModeloFalso([
    new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'algo del pedido' } }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }),
    contesta(),
  ]);
  const fallo = await leerRespuesta<{ codigo: string; detalle: string }>(await preguntar({ pregunta: 'La que falla' }));
  assert.equal(fallo.estado, 502);
  assert.match(fallo.cuerpo.detalle, /^IA-PETICION · ref [A-Z0-9]+ · /);
  assert.deepEqual((await preguntasDeHoy()).map((m) => m.estado), ['fallida']);

  assert.equal((await preguntar({ pregunta: 'La siguiente' })).status, 200);
  assert.deepEqual((await preguntasDeHoy()).map((m) => m.estado), ['fallida', 'respondida']);
});

test('bajo delegación el cerebro no responde: lo rechaza el servidor, sin llamar al modelo', async () => {
  modelo = instalarModeloFalso([]);
  const fundadora = (await esc.admin.query<{ id: string }>(`select id from identidad.usuarios where email = 'fundadora@principal.ejemplo'`)).rows[0]!.id;
  const token = randomBytes(32).toString('base64url');
  sesionesPropias.push(token);
  await conIdentidad(async (db) => {
    await db
      .insertInto('sesiones')
      .values({
        usuario_id: fundadora,
        token_hash: hashDeToken(token),
        estado: 'activa',
        org_activa: esc.org,
        expira_el: sql<Date>`now() + interval '7 days'`,
        expira_absoluto: sql<Date>`now() + interval '30 days'`,
      })
      .execute();
  });
  const r = await leerRespuesta<{ codigo: string }>(await preguntar({ pregunta: '¿Cómo va?' }, token));
  assert.deepEqual([r.estado, r.cuerpo.codigo], [409, 'cerebro_bajo_delegacion']);
  assert.equal(modelo.cuerpos.length, 0);
  const g = await leerRespuesta<{ estado: { tipo: string } }>(await mirar(pedirComo('/api/executive', token)));
  assert.equal(g.cuerpo.estado.tipo, 'delegacion');
});

// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ENCONTRÓ LA REVISIÓN DE AG5
// ═══════════════════════════════════════════════════════════════════════════════

const conTopeUno = () => esc.admin.query('insert into negocio.topes_del_executive (org_id, por_persona, por_empresa) values ($1, 1, 300)', [esc.org]);

test('borrar el hilo no devuelve el lugar: el tope se cuenta en un registro que no cuelga de los hilos', async () => {
  await conTopeUno();
  modelo = instalarModeloFalso([contesta()]);
  const p = await leerRespuesta<{ hiloId: string }>(await preguntar({ pregunta: 'La primera' }));
  assert.equal(p.estado, 200);
  assert.equal((await borrar(pedirComo(`/api/executive?hilo=${p.cuerpo.hiloId}`, esc.token, { metodo: 'DELETE' }))).status, 200);
  const r = await leerRespuesta<{ codigo: string }>(await preguntar({ pregunta: 'Con el hilo borrado' }));
  assert.deepEqual([r.estado, r.cuerpo.codigo], [429, 'tope_del_cerebro']);
  assert.equal(modelo.quedan(), 0);
});

test('una reserva de hace más de diez minutos no ocupa lugar: es de una función que la plataforma cortó', async () => {
  await conTopeUno();
  await esc.admin.query(
    `insert into negocio.preguntas_del_executive (org_id, usuario_id, estado, creada_el) values ($1, $2, 'reservada', now() - interval '11 minutes')`,
    [esc.org, esc.quien],
  );
  modelo = instalarModeloFalso([contesta()]);
  assert.equal((await preguntar({ pregunta: 'Pasa igual' })).status, 200);
  // Y una de hace un minuto sí ocupa: la otra pregunta puede estar en curso.
  await esc.admin.query('delete from negocio.preguntas_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query(
    `insert into negocio.preguntas_del_executive (org_id, usuario_id, estado, creada_el) values ($1, $2, 'reservada', now() - interval '1 minute')`,
    [esc.org, esc.quien],
  );
  assert.equal((await preguntar({ pregunta: 'No pasa' })).status, 429);
});

test('una fallida que se pagó cuenta: una respuesta truncada consumió y no se puede repetir sin límite', async () => {
  await conTopeUno();
  modelo = instalarModeloFalso([respuestaDelModelo([escribe('Una respuesta larguísima…')], 'max_tokens')]);
  const fallo = await leerRespuesta<{ detalle: string }>(await preguntar({ pregunta: 'Escríbeme todo' }));
  assert.equal(fallo.estado, 502);
  assert.match(fallo.cuerpo.detalle, /^IA-TRUNCADO/);
  const estado = await esc.admin.query<{ estado: string }>('select estado from negocio.preguntas_del_executive where org_id = $1', [esc.org]);
  assert.deepEqual(estado.rows.map((f) => f.estado), ['fallida_pagada']);
  assert.equal((await preguntar({ pregunta: 'Otra vez' })).status, 429);
});

test('si guardar falla después de responder, la respuesta llega igual, lo dice, y la pregunta cuenta', async () => {
  await conTopeUno();
  /* El hilo se borra mientras el modelo contesta (otra pestaña): guardar la respuesta choca con la clave
     foránea. Antes era un 500 pelado y la pregunta quedaba `reservada` para siempre. */
  modelo = instalarModeloFalso([
    async () => {
      await esc.admin.query('delete from negocio.conversaciones_del_executive where org_id = $1', [esc.org]);
      return contesta('Se responde igual.');
    },
  ]);
  const r = await leerRespuesta<{ tipo: string; respuesta: { conclusion: string; avisos: string[] } }>(await preguntar({ pregunta: 'Pregunta huérfana' }));
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.respuesta.conclusion, 'Se responde igual.');
  assert.match(r.cuerpo.respuesta.avisos.join(' '), /no se pudo guardar en el hilo/);
  const estado = await esc.admin.query<{ estado: string }>('select estado from negocio.preguntas_del_executive where org_id = $1', [esc.org]);
  assert.deepEqual(estado.rows.map((f) => f.estado), ['respondida']);
});

async function esperarBloqueadas(cuantas: number, tabla: string): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    const r = await esc.admin.query<{ n: number }>(
      `select count(*)::int as n from pg_stat_activity where wait_event_type = 'Lock' and query ilike $1`,
      [`%${tabla}%`],
    );
    if ((r.rows[0]?.n ?? 0) >= cuantas) return;
    await new Promise((listo) => setTimeout(listo, 25));
  }
  assert.fail(`no llegaron ${cuantas} transacciones a esperar el candado de ${tabla}`);
}
