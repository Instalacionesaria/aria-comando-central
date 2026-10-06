// LA REUNIÓN DE HOY EN EL INICIO: LO QUE VE CADA PERSONA, Y ABRIR UN TEMA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// AG15 de los agentes (`docs/OTROS/agentes/04-LA-REUNION-Y-LA-CABECERA.md`, AG-73, AG-74 y AG-76): el GET de
// `app/api/executive/route.ts` y la ruta nueva `app/api/executive/reunion/route.ts` (la regla 31: una ruta
// nueva nace con su prueba de base):
//
//   · el GET trae los tres primeros de las secciones que la persona ve —filtrados antes de tomar tres—, con la
//     hora local de la pasada; sin pasada, nada; leyendo un hilo, no la trae;
//   · abrir un tema arma la conversación sin modelo y sin tope; el mismo tema vuelve a su hilo; uno de una
//     sección que no se ve da 404, como uno que no existe; bajo delegación, ni se abre.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { leerRespuesta, montar, pedirComo, sesionDe, type Escenario } from '../apoyo/closer.ts';
import { GET as mirar } from '../../app/api/executive/route.ts';
import { POST as abrir } from '../../app/api/executive/reunion/route.ts';

const NOMBRE_DE_PERSONA = 'Persona de la 240';
let esc: Escenario;
const sesionesPropias: string[] = [];

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.reuniones_del_dia where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.conversaciones_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.preguntas_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query('delete from identidad.usuarios where nombre = $1', [NOMBRE_DE_PERSONA]);
  for (const t of sesionesPropias.splice(0)) await esc.admin.query('delete from identidad.sesiones where token_hash = $1', [hashDeToken(t)]);
}

before(async () => {
  esc = await montar('Reunion240');
});
beforeEach(limpiar);
after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

const tema = (clave: string, seccion: string, etiqueta: string, gravedad: string) => ({
  clave,
  regla: clave,
  etiqueta,
  seccion,
  origen: `Origen de ${seccion}`,
  gravedad,
  perdida: null,
  texto: `El tema ${clave}.`,
  evidencia: { cifra: 7 },
});
// En el orden de las reglas: los dos de Acquisition primero.
const TEMAS = [
  tema('A1', 'acquisition', 'SIN DATOS NUEVOS', 'critica'),
  tema('A2', 'acquisition', 'CADENA', 'alta'),
  tema('C1', 'closer', 'SIN REGISTRAR', 'media'),
  tema('L1', 'analizadores', 'SIN LECTOR', 'media'),
  tema('L2', 'analizadores', 'PATRÓN', 'media'),
];

/** La Reunión de hoy —o de hace `dias`—, corrida a las 06:23 de la zona de la empresa. */
async function sembrar(dias = 0): Promise<void> {
  await esc.admin.query(
    `with z as (select zona_horaria as zona from identidad.organizaciones where id = $1),
          hoy as (select (now() at time zone z.zona)::date - $3::int as d, z.zona from z)
     insert into negocio.reuniones_del_dia (org_id, dia, temas, corrio_el)
     select $1, hoy.d, $2::jsonb, (hoy.d + time '06:23') at time zone hoy.zona from hoy`,
    [esc.org, JSON.stringify(TEMAS), dias],
  );
}

async function unaPersona(secciones: readonly string[]): Promise<string> {
  const r = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash) values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [esc.org, NOMBRE_DE_PERSONA, `reunion-240-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
  );
  const id = r.rows[0]!.id;
  await esc.admin.query(`insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'usuario' and org_id is null`, [id]);
  for (const s of secciones) await esc.admin.query('insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, $2)', [id, s]);
  const token = await sesionDe(id);
  sesionesPropias.push(token);
  return token;
}

type Reunion = { dia: string; hora: string; deHoy: boolean; temas: { clave: string; etiqueta: string; origen: string; seccion: string; texto: string }[] } | null;
const reunionDe = async (token = esc.token, camino = '/api/executive') => {
  const r = await leerRespuesta<{ reunion?: Reunion }>(await mirar(pedirComo(camino, token)));
  assert.equal(r.estado, 200);
  return r.cuerpo.reunion;
};
const abrirComo = (cuerpo: unknown, token = esc.token) => abrir(pedirComo('/api/executive/reunion', token, { metodo: 'POST', cuerpo }));

test('el GET trae los tres primeros que la persona ve, filtrados antes de tomar tres, con la hora de la pasada', async () => {
  assert.equal(await reunionDe(), null, 'sin pasada, nada');
  // Antes de la pasada de hoy, la de ayer: con su día, y sin hacerse pasar por la de hoy.
  await sembrar(1);
  const ayer = await reunionDe();
  assert.equal(ayer!.deHoy, false, 'la Reunión de ayer se presenta como la de hoy');
  await sembrar();
  const todo = await reunionDe();
  assert.deepEqual([todo!.hora, todo!.deHoy, todo!.temas.map((t) => t.clave)], ['06:23', true, ['A1', 'A2', 'C1']]);
  // La tarjeta no lleva la evidencia: viaja al abrir el tema.
  assert.deepEqual(Object.keys(todo!.temas[0]!).sort(), ['clave', 'etiqueta', 'origen', 'seccion', 'texto']);

  // Quien ve el Inicio, Closer y las llamadas: los de Acquisition no son suyos, y aun así le quedan tres.
  const closer = await unaPersona(['executive', 'closer', 'analizadores']);
  assert.deepEqual((await reunionDe(closer))!.temas.map((t) => t.clave), ['C1', 'L1', 'L2']);
  const soloInicio = await unaPersona(['executive']);
  assert.deepEqual((await reunionDe(soloInicio))!.temas, [], 'corrió y no hay nada suyo: la lista vacía, no nula');
});

test('abrir un tema arma la conversación sin modelo ni tope, y el mismo tema vuelve a su hilo', async () => {
  await sembrar();
  const closer = await unaPersona(['executive', 'closer', 'analizadores']);
  const a = await leerRespuesta<{ hilo: string }>(await abrirComo({ tema: 'C1' }, closer));
  assert.equal(a.estado, 200);
  const otra = await leerRespuesta<{ hilo: string }>(await abrirComo({ tema: 'C1' }, closer));
  assert.equal(otra.cuerpo.hilo, a.cuerpo.hilo, 'el mismo tema abrió otra conversación');

  const h = await leerRespuesta<{
    hilos: { id: string; titulo: string; origen: string }[];
    mensajes: { rol: string; texto: string; estado: string | null; respuesta: { conclusion: string; confianza: { porque: string }; siguientes: { seccion: string }[] } | null; evidencia: { datos: unknown }[] | null }[];
  }>(await mirar(pedirComo(`/api/executive?hilo=${a.cuerpo.hilo}`, closer)));
  assert.deepEqual(h.cuerpo.hilos.map((x) => [x.titulo, x.origen]), [['El tema C1.', 'reunion']]);
  assert.equal('reunion' in h.cuerpo, false, 'leyendo un hilo, la Reunión viaja igual');
  const [tocado, respuesta, ...resto] = h.cuerpo.mensajes;
  assert.deepEqual(resto, []);
  assert.deepEqual([tocado!.rol, tocado!.texto, tocado!.estado], ['persona', 'SIN REGISTRAR · Origen de closer', 'respondida']);
  assert.deepEqual([respuesta!.rol, respuesta!.texto, respuesta!.respuesta!.conclusion], ['cerebro', 'El tema C1.', 'El tema C1.']);
  assert.deepEqual(respuesta!.respuesta!.siguientes.map((s) => s.seccion), ['closer']);
  // El día, como se lee: «la pasada del 6 de octubre», no la fecha de la base.
  assert.match(respuesta!.respuesta!.confianza.porque, /^Lo detectaron las reglas de la Reunión en la pasada del [1-9][0-9]? de [a-z]+\.$/);
  assert.deepEqual(respuesta!.evidencia!.map((e) => e.datos), [{ cifra: 7 }]);
  // No contó para el tope.
  assert.equal((await esc.admin.query('select 1 from negocio.preguntas_del_executive where org_id = $1', [esc.org])).rowCount, 0);
});

test('el tema de una sección que no ve da 404, como uno que no existe; bajo delegación, ni se abre', async () => {
  await sembrar();
  const closer = await unaPersona(['executive', 'closer']);
  for (const t of ['A1', 'NO-EXISTE']) {
    const r = await leerRespuesta<{ codigo: string }>(await abrirComo({ tema: t }, closer));
    assert.deepEqual([r.estado, r.cuerpo.codigo], [404, 'no_encontrado'], t);
  }
  assert.equal((await abrirComo({}, closer)).status, 400);

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
  const r = await leerRespuesta<{ codigo: string }>(await abrirComo({ tema: 'A1' }, token));
  assert.deepEqual([r.estado, r.cuerpo.codigo], [409, 'cerebro_bajo_delegacion']);
  // Leer sí: la Reunión se ve bajo delegación.
  assert.deepEqual((await reunionDe(token))!.temas.map((t) => t.clave), ['A1', 'A2', 'C1']);
  assert.equal((await esc.admin.query('select 1 from negocio.conversaciones_del_executive where org_id = $1', [esc.org])).rowCount, 0);
});
