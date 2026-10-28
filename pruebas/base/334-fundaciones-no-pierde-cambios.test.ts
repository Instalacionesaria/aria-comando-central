// Fundaciones no pierde lo que se guardó mientras el modelo pensaba. Tipo: Base.
//
// Hasta el 2026-10-28 cada guardado de Fundaciones reescribía la columna ENTERA con el estado leído al
// empezar. Generar y conversar leen, esperan al modelo segundos o minutos y recién después escriben: lo que
// otra herramienta (o la cadena «Construir el método») guardó en esa ventana se perdía sin ningún error,
// versiones pagadas incluidas (`docs/5-pendiente/investigacion-de-datos.md`, confirmado 1).
//
// Ahora cada guardado manda sólo su pedazo y la base lo mezcla con lo que hay al escribir
// (`lib/fundaciones/almacen.ts`, `fusionar` y `guardarVersion`). Estas pruebas repiten la carrera con un
// estado leído ANTES del otro guardado, que es exactamente lo que pasaba en producción.
//
// Mutaciones vistas en rojo: `fusionar` sin el `||` (reescribe la columna), `guardarVersion` sin la lista
// de la base, sin el tope de diez, y `guardarResearch` mandando siempre las tres partes.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { crearTablasDePublic, quitarTablasDePublic } from '../apoyo/tablas-de-public.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import {
  MAX_VERSIONES,
  guardarChat,
  guardarInputs,
  guardarMercado,
  guardarResearch,
  guardarVersion,
  leerEstado,
} from '../../lib/fundaciones/almacen.ts';
import type { EstadoDeFundaciones } from '../../lib/fundaciones/estado.ts';
import type { MercadoReal } from '../../lib/fundaciones/mercado.ts';

const SLUG = 'fundaciones-334';
let admin: Client;
let org: string;
let otra: string;
let creadas: string[] = [];

async function borrarOrganizaciones(): Promise<void> {
  for (const slug of [SLUG, `${SLUG}-otra`]) {
    const o = await unaFila<{ id: string }>(admin, 'select id from identidad.organizaciones where slug = $1', [slug]);
    if (!o) continue;
    if ((await admin.query(`select to_regclass('public.aria_cc_foundations') as r`)).rows[0].r !== null) {
      await admin.query('delete from public.aria_cc_foundations where org_id = $1', [o.id]);
    }
    await admin.query('delete from identidad.organizaciones where id = $1', [o.id]);
  }
}

async function organizacion(slug: string): Promise<string> {
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ($1, $2, 'America/Lima') returning id`,
    [`Fundaciones ${slug}`, slug],
  );
  assert.ok(o);
  return o.id;
}

/** La fila tal como está en la base, sin pasar por los lectores tolerantes. */
async function fila(enOrg = org): Promise<Record<string, any> | null> {
  return (await unaFila<Record<string, any>>(admin, 'select * from public.aria_cc_foundations where org_id = $1', [enOrg])) ?? null;
}

async function estadoDe(enOrg = org): Promise<EstadoDeFundaciones> {
  const e = await leerEstado(enOrg);
  assert.equal(e.tipo, 'datos');
  return (e as { tipo: 'datos'; datos: EstadoDeFundaciones }).datos;
}

async function vaciar(): Promise<void> {
  await admin.query('delete from public.aria_cc_foundations where org_id = any($1)', [[org, otra]]);
}

const ok = (r: { tipo: string }) => assert.equal(r.tipo, 'datos', JSON.stringify(r));

before(async () => {
  admin = await conectar('admin');
  creadas = await crearTablasDePublic(admin);
  await borrarOrganizaciones();
  org = await organizacion(SLUG);
  otra = await organizacion(`${SLUG}-otra`);
});

after(async () => {
  await borrarOrganizaciones();
  await quitarTablasDePublic(admin, creadas);
  await cerrarClientes();
  await cerrarTodo();
});

test('un chat guardado con un estado viejo no borra el chat que otra herramienta guardó mientras tanto', async () => {
  await vaciar();
  ok(await guardarChat(org, await estadoDe(), 4, { messages: [{ role: 'user', content: 'hola 4' }], answers: {} }));
  // Se lee el estado ANTES de que la herramienta 5 guarde: es lo que pasa mientras el modelo piensa.
  const viejo = await estadoDe();
  ok(await guardarChat(org, viejo, 5, { messages: [{ role: 'user', content: 'hola 5' }], answers: { nicho: 'clínicas' } }));
  ok(
    await guardarChat(org, viejo, 4, {
      messages: [
        { role: 'user', content: 'hola 4' },
        { role: 'assistant', content: 'respuesta 4' },
      ],
      answers: {},
    }),
  );
  const ahora = await estadoDe();
  assert.equal(ahora.chats[5]?.messages[0]?.content, 'hola 5', 'el chat de la herramienta 5 se perdió');
  assert.equal(ahora.chats[5]?.answers['nicho'], 'clínicas');
  assert.equal(ahora.chats[4]?.messages.length, 2, 'el turno nuevo de la herramienta 4 no quedó');
  assert.ok(ahora.chats[4]?.conversation_id, 'el chat se guardó sin su identificador');
});

test('los inputs de una herramienta no pisan los de otra ni las demás columnas', async () => {
  await vaciar();
  await admin.query(`insert into public.aria_cc_foundations (org_id, intake, cat_chat) values ($1, $2, $3)`, [
    org,
    JSON.stringify({ origen: 'formulario' }),
    JSON.stringify({ deliverable: 'categoría vieja' }),
  ]);
  ok(await guardarInputs(org, 0, { negocio: 'clínica' }));
  ok(await guardarInputs(org, 3, { avatar: 'dueño' }));
  ok(await guardarInputs(org, 0, { negocio: 'clínica dental' }));
  const f = await fila();
  assert.deepEqual(f?.['profile'], { '0': { negocio: 'clínica dental' }, '3': { avatar: 'dueño' } });
  assert.deepEqual(f?.['intake'], { origen: 'formulario' }, 'un guardado de Fundaciones tocó el onboarding');
  assert.deepEqual(f?.['cat_chat'], { deliverable: 'categoría vieja' });
});

test('dos versiones que terminan juntas quedan las dos, la más nueva adelante, con tope de diez', async () => {
  await vaciar();
  ok(await guardarVersion(org, 2, { date: 'd0', output: 'versión 0' }));
  ok(await guardarVersion(org, 7, { date: 'otra', output: 'de otra herramienta' }));
  await Promise.all([
    guardarVersion(org, 2, { date: 'd1', output: 'versión 1' }),
    guardarVersion(org, 2, { date: 'd2', output: 'versión 2' }),
  ]).then((rs) => rs.forEach(ok));
  let e = await estadoDe();
  assert.equal(e.historial[2]?.length, 3, 'una generación simultánea perdió su versión');
  assert.equal(e.historial[2]?.[2]?.output, 'versión 0');
  assert.deepEqual(new Set(e.historial[2]?.slice(0, 2).map((v) => v.output)), new Set(['versión 1', 'versión 2']));
  assert.equal(e.historial[7]?.[0]?.output, 'de otra herramienta', 'una versión de otra herramienta se perdió');

  for (let i = 3; i < 3 + MAX_VERSIONES; i++) ok(await guardarVersion(org, 2, { date: `d${i}`, output: `versión ${i}` }));
  e = await estadoDe();
  assert.equal(e.historial[2]?.length, MAX_VERSIONES);
  assert.equal(e.historial[2]?.[0]?.output, `versión ${2 + MAX_VERSIONES}`, 'la más nueva no quedó adelante');
  assert.equal(e.historial[2]?.at(-1)?.output, 'versión 3', 'no se conservaron las diez más nuevas');
});

test('el Research: guardar los criterios no borra los pasos ni el mercado, y un paso 1 nuevo sí borra el mercado', async () => {
  await vaciar();
  const mercado = { rubro: 'clínicas', ubicacion: 'Lima', miradoEl: '2026-10-28T00:00:00Z', maps: null, anuncios: null, paginas: null } as unknown as MercadoReal;
  ok(await guardarResearch(org, { inputs: { pais: 'PE' }, salidas: ['paso 1'], mercado: null }));
  ok(await guardarMercado(org, mercado));
  ok(await guardarResearch(org, { inputs: { pais: 'PE' }, salidas: ['paso 1', 'paso 2'] }));
  ok(await guardarResearch(org, { inputs: { pais: 'CL' } }));
  let r = (await fila())?.['market_research'];
  assert.deepEqual(r?.['outputs'], ['paso 1', 'paso 2'], 'guardar los criterios borró los pasos');
  assert.equal(r?.['mercado']?.['rubro'], 'clínicas', 'un paso o los criterios borraron la mirada al mercado');
  assert.deepEqual(r?.['inputs'], { pais: 'CL' });

  ok(await guardarResearch(org, { inputs: { pais: 'CL' }, salidas: ['paso 1 nuevo'], mercado: null }));
  r = (await fila())?.['market_research'];
  assert.equal(r?.['mercado'], null, 'un paso 1 nuevo no invalidó la mirada vieja');
  assert.deepEqual(r?.['outputs'], ['paso 1 nuevo']);
});

test('una columna que no es un objeto (documento roto) se reemplaza sin error, y la otra organización no se toca', async () => {
  await vaciar();
  await admin.query(`insert into public.aria_cc_foundations (org_id, profile, history) values ($1, '"roto"', '[1, 2]')`, [org]);
  await admin.query(`insert into public.aria_cc_foundations (org_id, profile) values ($1, $2)`, [otra, JSON.stringify({ '0': { x: 'de la otra' } })]);
  ok(await guardarInputs(org, 1, { a: 'b' }));
  ok(await guardarVersion(org, 0, { date: 'd', output: 'o' }));
  const f = await fila();
  assert.deepEqual(f?.['profile'], { '1': { a: 'b' } });
  assert.deepEqual(f?.['history'], { '0': [{ date: 'd', output: 'o' }] });
  assert.deepEqual((await fila(otra))?.['profile'], { '0': { x: 'de la otra' } }, 'un guardado tocó la fila de otra organización');
});
