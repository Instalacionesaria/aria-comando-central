// LOS TOPES DEL CEREBRO EN AJUSTES, POR EL MANEJADOR DE VERDAD. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `app/api/admin/cerebro/route.ts` (AG7 de los agentes; `docs/OTROS/agentes/06-MODELOS-USO-TOPES-E-INCIDENTES.md`,
// AG-96 y AG-97), con la regla 31: una ruta nueva nace con su prueba de base.
//
//   · Quién entra: el GET con `credenciales.ver`, el PUT con `credenciales.editar`; el rol `usuario` no
//     tiene ninguna de las dos.
//   · Lo que se valida: enteros entre 1 y el máximo, y el de una persona no pasa al de la empresa.
//   · Lo que se guarda: los dos topes, quién y cuándo; bajo delegación, sin autor.
//   · Que rigen: con el tope de una persona en 1, la segunda pregunta del día da `tope_del_cerebro`.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'kysely';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { leerRespuesta, montar, pedirComo, sesionDe, type Escenario } from '../apoyo/closer.ts';
import { instalarModeloFalso, pideHerramienta, respuestaDelModelo, respuestaMinima, type ModeloFalso } from '../apoyo/cerebro.ts';
import { GET as mirar, PUT as fijar } from '../../app/api/admin/cerebro/route.ts';
import { POST as preguntarAlCerebro } from '../../app/api/executive/route.ts';
import { TOPE_MAXIMO, TOPES_POR_OMISION } from '../../lib/agentes/executive/topes.ts';

const NOMBRE_DE_PERSONA = 'Persona de la 218';
let esc: Escenario;
let modelo: ModeloFalso | null = null;
const sesionesPropias: string[] = [];

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.conversaciones_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.topes_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.preguntas_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query(`delete from negocio.uso_de_ia where org_id = $1 and agente = 'executive'`, [esc.org]);
  await esc.admin.query('delete from identidad.usuarios where nombre = $1', [NOMBRE_DE_PERSONA]);
  await esc.admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [esc.org]);
  for (const t of sesionesPropias.splice(0)) await esc.admin.query('delete from identidad.sesiones where token_hash = $1', [hashDeToken(t)]);
}

const poner = (cuerpo: unknown, token = esc.token) => fijar(pedirComo('/api/admin/cerebro', token, { metodo: 'PUT', cuerpo }));

before(async () => {
  esc = await montar('Cerebro218');
});
beforeEach(async () => {
  modelo?.quitar();
  modelo = null;
  await limpiar();
});
after(async () => {
  modelo?.quitar();
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

test('el GET pide `credenciales.ver` y el PUT `credenciales.editar`', () => {
  const f = sinComentarios(readFileSync(join(RAIZ, 'app/api/admin/cerebro/route.ts'), 'utf8'));
  const pide = (metodo: string) => new RegExp(`function ${metodo}\\(peticion: Request\\)[^]*?exigir\\(peticion, \\[([^\\]]*)\\], PANTALLA\\)`).exec(f)?.[1];
  assert.deepEqual([pide('GET'), pide('PUT')], ["'credenciales.ver'", "'credenciales.editar'"]);
  assert.match(f, /export const PANTALLA = 'credenciales';/);
});

test('sin fijar: los de omisión, y lo usado hoy', async () => {
  const r = await leerRespuesta<{ porPersona: number; porEmpresa: number; porOmision: unknown; usadasPorEmpresa: number; maximo: number; actualizadoEl: string | null }>(
    await mirar(pedirComo('/api/admin/cerebro', esc.token)),
  );
  assert.equal(r.estado, 200);
  assert.deepEqual(
    [r.cuerpo.porPersona, r.cuerpo.porEmpresa, r.cuerpo.usadasPorEmpresa, r.cuerpo.maximo, r.cuerpo.actualizadoEl],
    [TOPES_POR_OMISION.porPersona, TOPES_POR_OMISION.porEmpresa, 0, TOPE_MAXIMO, null],
  );
  assert.deepEqual(r.cuerpo.porOmision, TOPES_POR_OMISION);
});

test('el rol `usuario` no los ve ni los fija', async () => {
  const r = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash)
       values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [esc.org, NOMBRE_DE_PERSONA, `cerebro-218-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
  );
  await esc.admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'usuario' and org_id is null`,
    [r.rows[0]!.id],
  );
  const token = await sesionDe(r.rows[0]!.id);
  sesionesPropias.push(token);
  assert.equal((await mirar(pedirComo('/api/admin/cerebro', token))).status, 403);
  assert.equal((await poner({ porPersona: 10, porEmpresa: 20 }, token)).status, 403);
});

test('se validan: enteros entre 1 y el máximo, y el de una persona no pasa al de la empresa', async () => {
  for (const cuerpo of [
    { porPersona: 0, porEmpresa: 10 },
    { porPersona: 5, porEmpresa: TOPE_MAXIMO + 1 },
    { porPersona: 2.5, porEmpresa: 10 },
    { porPersona: '5', porEmpresa: 10 },
    { porPersona: 20, porEmpresa: 10 },
    { porEmpresa: 10 },
  ]) {
    const r = await leerRespuesta<{ codigo: string }>(await poner(cuerpo));
    assert.deepEqual([r.estado, r.cuerpo.codigo], [400, 'peticion_invalida'], JSON.stringify(cuerpo));
  }
  const fila = await esc.admin.query('select 1 from negocio.topes_del_executive where org_id = $1', [esc.org]);
  assert.equal(fila.rowCount, 0, 'un pedido rechazado escribió los topes');
});

test('se guardan con quién y cuándo, y rigen: con 1 por persona, la segunda pregunta del día da el tope', async () => {
  assert.equal((await poner({ porPersona: 1, porEmpresa: 5 })).status, 200);
  const g = await leerRespuesta<{ porPersona: number; porEmpresa: number; actualizadoEl: string | null }>(await mirar(pedirComo('/api/admin/cerebro', esc.token)));
  assert.deepEqual([g.cuerpo.porPersona, g.cuerpo.porEmpresa], [1, 5]);
  assert.notEqual(g.cuerpo.actualizadoEl, null);
  const autor = await esc.admin.query<{ actualizado_por: string | null }>('select actualizado_por from negocio.topes_del_executive where org_id = $1', [esc.org]);
  const ana = await esc.admin.query<{ id: string }>(`select id from identidad.usuarios where email = 'ana@alfa.ejemplo'`);
  assert.equal(autor.rows[0]!.actualizado_por, ana.rows[0]!.id);

  await esc.admin.query('insert into identidad.organizaciones_credenciales (org_id, ia_clave_cifrada) values ($1, $2)', [esc.org, cifrar('sk-de-prueba-218')]);
  modelo = instalarModeloFalso([respuestaDelModelo([pideHerramienta('responder', respuestaMinima('La primera.'))])]);
  const preguntar = (texto: string) => preguntarAlCerebro(pedirComo('/api/executive', esc.token, { metodo: 'POST', cuerpo: { pregunta: texto } }));
  assert.equal((await preguntar('La primera')).status, 200);
  const segunda = await leerRespuesta<{ codigo: string; detalle: string }>(await preguntar('La segunda'));
  assert.deepEqual([segunda.estado, segunda.cuerpo.codigo], [429, 'tope_del_cerebro']);
  // El tope es el de la persona: el rechazo se lo dice a ella, no a la empresa.
  assert.match(segunda.cuerpo.detalle, /^Llegaste al tope de hoy \(1 preguntas\)/);
});

test('bajo delegación se pueden fijar, sin autor', async () => {
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
  assert.equal((await poner({ porPersona: 7, porEmpresa: 70 }, token)).status, 200);
  const fila = await esc.admin.query<{ por_persona: number; actualizado_por: string | null }>(
    'select por_persona, actualizado_por from negocio.topes_del_executive where org_id = $1',
    [esc.org],
  );
  assert.deepEqual([fila.rows[0]!.por_persona, fila.rows[0]!.actualizado_por], [7, null]);
});
