// LA PLANTILLA DEL ESTRATEGA (la migración 126). Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (decisiones del usuario del 2026-11-24)
//
// El Estratega corre una sola vez y guarda la página de estrategia de Jorge como HTML estático, con sus 12 pestañas,
// en tandas (guardar_secciones de la 125). La plantilla fija el orden y las doce son obligatorias.
//
//   1 · el catálogo: los doce marcadores en el orden de las pestañas, todos obligatorios, el índice con un enlace a
//       cada pestaña, y el estilo con su título y sin JavaScript — mutación: un marcador fuera de orden o una
//       obligatoria de menos;
//   2 · cuatro tandas (ICP; categoría y oferta; precio y process map; inicio y decisiones) arman el documento en el
//       orden de la plantilla, con <details> y barras con style, y la última sin una obligatoria se rechaza;
//   3 · una sección que la plantilla no tiene (la «oferta» de antes) se rechaza.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';

const SECCIONES = ['inicio', 'clienta_ideal', 'dolores', 'big_idea', 'mecanismo', 'formula', 'valor', 'precio', 'garantia',
  'auditoria', 'process_map', 'decisiones'];

let admin: Client;
let aria: { org: string; cuenta: string };
let ENV = '';
let PLANTILLA = '';
let OBLIG: string[] = [];
const LOC = 'loc-510';

type Seccion = { id: string; html: string };

before(async () => {
  admin = await conectar('admin');
  const a = await unaFila<{ org: string; cuenta: string }>(admin,
    `select o.id as org, c.id as cuenta from identidad.organizaciones o
       join identidad.cuentas c on c.org_id = o.id and c.es_por_omision where o.es_principal`);
  assert.ok(a, 'falta el sembrado');
  aria = a;
  const s = await unaFila<{ envoltura: string; plantilla: string; oblig: string[] }>(admin,
    `select envoltura, plantilla, secciones_obligatorias as oblig from catalogo.salidas_de_los_agentes where clave = 'estratega_oferta'`);
  assert.ok(s?.plantilla, 'el Estratega no tiene su plantilla (126)');
  ENV = s.envoltura;
  PLANTILLA = s.plantilla;
  OBLIG = s.oblig;
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

async function j(sql: string, params: unknown[] = []): Promise<Record<string, any>> {
  const r = await admin.query<{ r: Record<string, any> }>(sql, params);
  return r.rows[0]!.r;
}

const tanda = (corrida: string, secciones: Seccion[], terminar = false) =>
  j(`select agentes.guardar_secciones($1, $2::jsonb, null, $3) as r`, [corrida, JSON.stringify(secciones), terminar]);

test('1 · el catálogo: doce pestañas en orden, todas obligatorias, con su índice y sin JavaScript', () => {
  const marcas = [...PLANTILLA.matchAll(/\{\{seccion:([a-z][a-z0-9_]*)\}\}/g)].map((m) => m[1]);
  assert.deepEqual(marcas, SECCIONES, 'los marcadores no son las doce pestañas, en orden');
  assert.deepEqual(OBLIG, SECCIONES, 'las obligatorias no son las doce');
  for (const id of SECCIONES) {
    assert.ok(PLANTILLA.includes(`<a href="#${id}">`), `el índice no lleva a «${id}»`);
    assert.ok(PLANTILLA.includes(`<section id="${id}" class="pestana">`), `falta la pestaña «${id}»`);
  }
  assert.match(ENV, /^<!DOCTYPE html>/);
  assert.match(ENV, /<title>Oferta · ARIA IA<\/title>/);
  assert.match(ENV, /<\/style><\/head><body>$/);
  assert.doesNotMatch(ENV + PLANTILLA, /<script|onclick/i);
  for (const clase of ['h1.contraste', '.facts', 'details', 'ol.pasos', 'p.formula', '.palanca', 'ol.escalera', 'blockquote.cita']) {
    assert.ok(ENV.includes(clase), `el estilo no tiene ${clase}`);
  }
});

test('2 · cuatro tandas arman la página en el orden de las pestañas', async () => {
  await enUnEnsayo(async () => {
    const ghl = `ghl-510-${randomUUID().slice(0, 8)}`;
    await admin.query('reset role');
    const c = await unaFila<{ id: string }>(admin,
      `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente) values ($1, $2, $3, 'Lead 510', 'meta') returning id`,
      [aria.org, aria.cuenta, ghl]);
    await admin.query('set local role mcp_simulado');
    const es = await j(`select agentes.abrir_corrida('estratega', $1, $2, $3) as r`, [LOC, ghl, `estratega:${ghl}:${randomUUID()}`]);
    const html = (id: string): string => ({
      clienta_ideal: '<h2>CLIENTA</h2><details><summary><span class="n">1</span>Situación actual</summary><p>x</p></details>',
      valor: '<h2>VALOR</h2><div class="palanca baja"><span>Probabilidad percibida</span><div class="barra"><i style="width:30%"></i></div><b>La más débil</b></div>',
      inicio: '<p class="kicker">Negocio · noviembre</p><h1 class="contraste"><s>No vendemos un chatbot.</s><span>INICIO</span></h1>',
    } as Record<string, string>)[id] ?? `<h2>${id.toUpperCase()}</h2><p>${id}</p>`;
    const s = (ids: string[]) => ids.map((id) => ({ id, html: html(id) }));

    assert.equal((await tanda(es.corrida_id, s(['clienta_ideal', 'dolores']))).ok, true);
    assert.equal((await tanda(es.corrida_id, s(['big_idea', 'mecanismo', 'formula', 'valor']))).ok, true);
    assert.equal((await tanda(es.corrida_id, s(['precio', 'garantia', 'auditoria', 'process_map']))).ok, true);
    // La última sin «decisiones»: rechazo, y nada se pierde.
    const falta = await tanda(es.corrida_id, s(['inicio']), true);
    assert.equal(falta.ok, false);
    assert.match(JSON.stringify(falta.errores), /falta la sección obligatoria «decisiones»/);
    const fin = await tanda(es.corrida_id, s(['inicio', 'decisiones']), true);
    assert.equal(fin.ok, true, JSON.stringify(fin));
    assert.deepEqual([fin.columna, fin.tandas, fin.con_plantilla], ['estratega_oferta', 4, true]);

    await admin.query('reset role');
    const doc = (await unaFila<{ d: string }>(admin,
      `select estratega_oferta as d from negocio.respuestas_de_los_agentes where contacto_id = $1`, [c!.id]))!.d;
    await admin.query('set local role mcp_simulado');
    const esperado = `${ENV}\n${PLANTILLA.replace(/\{\{seccion:([a-z][a-z0-9_]*)\}\}/g, (_m, id: string) => html(id)).trim()}\n</body></html>`;
    assert.equal(doc, esperado, 'la página no salió en el orden de la plantilla');
    const pos = (t: string) => doc.indexOf(t);
    assert.ok(pos('INICIO') < pos('CLIENTA') && pos('CLIENTA') < pos('VALOR') && pos('VALOR') < pos('<h2>DECISIONES'));
  });
});

test('3 · una sección que la plantilla no tiene se rechaza', async () => {
  await enUnEnsayo(async () => {
    const ghl = `ghl-510b-${randomUUID().slice(0, 8)}`;
    await admin.query('reset role');
    await admin.query(`insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente) values ($1, $2, $3, 'Lead 510b', 'meta')`,
      [aria.org, aria.cuenta, ghl]);
    await admin.query('set local role mcp_simulado');
    const es = await j(`select agentes.abrir_corrida('estratega', $1, $2, $3) as r`, [LOC, ghl, `estratega:${ghl}:${randomUUID()}`]);
    const r = await tanda(es.corrida_id, [{ id: 'oferta', html: '<p>la oferta</p>' }]);
    assert.equal(r.ok, false);
    assert.match(JSON.stringify(r.errores), /sección «oferta»: la plantilla no la tiene/);
  });
});
