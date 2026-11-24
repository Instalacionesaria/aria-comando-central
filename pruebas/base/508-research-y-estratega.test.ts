// RESEARCH Y ESTRATEGA EN LA TABLA DE RESPUESTAS (la migración 124). Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (reunión del 23/11 y decisiones del usuario del 2026-11-24)
//
// Research (5) y Estratega (6) pasan al modelo de la 118: un output cada uno, en su columna de
// negocio.respuestas_de_los_agentes (research_market_research y estratega_oferta). El documento no entra entero en una
// respuesta del agente: el agente manda sus secciones con agentes.guardar_secciones y la base arma el HTML con la
// envoltura de la columna y, si la hay, su plantilla. Research lee además la ficha de cliente 2 (la del Brief, en
// public.aria_cc_icp_oferta, la tabla del flujo de Walter) con agentes.leer_ficha_de_cliente_2.
//
//   1 · cada agente escribe sólo su columna: Research la del market research, Estratega la de la oferta; Research no
//       escribe la de la oferta ni una ficha, y el Sales Assistant no escribe la del research — mutación:
//       _salida_del_agente sin mirar el agente (guardar_secciones escribiría la p_columna que le pidan);
//   2 · sin plantilla, el documento es la envoltura + una <section id> por sección EN EL ORDEN RECIBIDO + </body></html>,
//       con las puntas de cada sección sin espacios; la salida de la corrida guarda las secciones y el documento, la
//       procedencia los ids y con_plantilla false, y queda el evento — mutaciones: el cuerpo ordenado por id, sin la
//       envoltura de la columna, o sin las secciones en la salida;
//   3 · lo que no es una sección se rechaza diciendo qué falló (no es arreglo, vacío, más de 40, un id inválido o
//       repetido, el html vacío, con <style>, <body> o <!DOCTYPE>, con el marcador de la plantilla, con un <script>), y
//       ningún rechazo deja fila — mutaciones: sin la validación de cada sección, y el documento final sin pasar por
//       _reglas_del_html (el <script> de una sección quedaría guardado);
//   4 · con plantilla, el documento sale en el orden de la plantilla aunque las secciones lleguen en otro, un marcador
//       sin sección queda vacío, una sección que la plantilla no tiene y la obligatoria que falta se rechazan, y
//       guardar_respuesta no puede saltearse la plantilla; el catálogo no acepta obligatorias sin plantilla ni una
//       plantilla sin marcador — mutaciones: pegar las secciones en el orden recibido aunque haya plantilla,
//       guardar_respuesta sin el rechazo de la columna con plantilla, y sin los CHECK del catálogo;
//   5 · una segunda corrida del Research reemplaza la columna (versión 2), la versión 1 queda en la salida de su corrida
//       y las demás columnas no cambian — mutación: _escribir_respuesta que no suma la versión o pisa otra columna;
//   6 · leer_secciones: el Estratega lee las secciones del research de SU lead (las de la corrida que escribió la
//       columna) y queda en lo leído; desde otro lead no ve las del primero; una columna guardada entera (guardar_
//       respuesta) no tiene secciones y lo dice — mutación: leer_secciones sin el filtro por lead;
//   7 · leer_ficha_de_cliente_2: la más reciente del correo del lead con el Brief completo ('SI'), sin mayúsculas ni
//       espacios, con org_id NULL o el de la corrida y nunca la de otra organización; sin correo, sin ficha o sin la
//       tabla devuelve el motivo y no un error; lo leído queda anotado — mutaciones: sin el form_completo = 'SI', sin el
//       filtro de org_id, sin lower/btrim, y sin el to_regclass (en local fallaría por la tabla que no está);
//   8 · abrir_corrida: el «siguiente» de Research y de Estratega nombra lo que leen y guardar_secciones; el Funnel
//       Builder, sin salida, no abre (22023); el catálogo tiene las dos salidas en el orden del flujo — mutaciones: el
//       «siguiente» viejo (leer_research) y abrir_corrida sin el rechazo del agente sin salida;
//   9 · leer_brief sigue dando las fuentes del Brief Agent (formulario, llamada de venta, públicas) y lo que falta, sin
//       las preguntas del Brief ni lo ya respondido (borrados) — mutación: el leer_brief de la 117, que creaba un
//       entregable y leía catalogo.preguntas_del_brief.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';

let admin: Client;
let aria: { org: string; cuenta: string };
let ENV_RESEARCH = '';
let ENV_ESTRATEGA = '';
const LOC = 'loc-508';
const FIN = '\n</body></html>';
/** La plantilla de prueba del caso 4: dos marcadores, y el resumen obligatorio. */
const PLANTILLA = '<div class="hoja"><h1>R</h1>{{seccion:resumen}}<hr>{{seccion:fuentes}}</div>';

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
  const e = await unaFila<{ research: string; estratega: string }>(admin,
    `select (select envoltura from catalogo.salidas_de_los_agentes where clave = 'research_market_research') as research,
            (select envoltura from catalogo.salidas_de_los_agentes where clave = 'estratega_oferta') as estratega`);
  assert.ok(e?.research && e.estratega, 'faltan las salidas de Research y Estratega (124)');
  ENV_RESEARCH = e.research;
  ENV_ESTRATEGA = e.estratega;
});

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

/** Una transacción que siempre se deshace, con la preparación como superusuario y el trabajo como el MCP. */
async function enUnEnsayo(comoElMcp: () => Promise<void>): Promise<void> {
  await admin.query('begin');
  try {
    await admin.query(`do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'mcp_simulado') then
        create role mcp_simulado nologin nosuperuser bypassrls;
      end if; end $$`);
    await admin.query('grant agente_mcp, pg_read_all_data to mcp_simulado');
    await admin.query(`update identidad.cuentas set crm_cuenta_id = $2 where id = $1`, [aria.cuenta, LOC]);
    // Este archivo defiende el mecanismo de la 124 sin plantilla; la plantilla provisoria del Research (125) y las
    // tandas los defiende la 509. Se quita dentro de la transacción (se deshace al final).
    await admin.query(`update catalogo.salidas_de_los_agentes set plantilla = null, secciones_obligatorias = null
                        where clave = 'research_market_research'`);
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

const abrir = (agente: string, ghl: string, sujeto: object = {}) =>
  j(`select agentes.abrir_corrida($1, $2, $3, $4, '{}'::jsonb, null, $5) as r`,
    [agente, LOC, ghl, `${agente}:${ghl}:${randomUUID()}`, sujeto]);

/** Las secciones van como texto JSON: pg convertiría un arreglo de JS en un arreglo de Postgres, no en jsonb. */
const guardarSecciones = (corrida: string, secciones: unknown, columna: string | null = null) =>
  j(`select agentes.guardar_secciones($1, $2::jsonb, $3) as r`,
    [corrida, secciones === null ? null : JSON.stringify(secciones), columna]);

const guardar = (corrida: string, html: string, columna: string | null = null) =>
  j(`select agentes.guardar_respuesta($1, $2, $3) as r`, [corrida, html, columna]);

const leerSecciones = (corrida: string, columna: string) => j(`select agentes.leer_secciones($1, $2) as r`, [corrida, columna]);

const leerFicha2 = (corrida: string) => j(`select agentes.leer_ficha_de_cliente_2($1) as r`, [corrida]);

/** El documento que arma guardar_secciones sin plantilla: una <section> por sección, en el orden en que llegaron. */
function documento(envoltura: string, secciones: Seccion[]): string {
  return `${envoltura}\n${secciones.map((s) => `<section id="${s.id}">\n${s.html}\n</section>`).join('\n')}${FIN}`;
}

/** Un lead con correo (por omisión, uno único); con null, sin correo. */
async function unLead(marca: string, correo?: string | null): Promise<{ ghl: string; id: string; correo: string | null }> {
  const ghl = `ghl-508-${marca}-${randomUUID().slice(0, 8)}`;
  const email = correo === undefined ? `${ghl}@ejemplo.pe` : correo;
  const c = await comoAdmin(() => unaFila<{ id: string }>(admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente, email)
     values ($1, $2, $3, $4, 'meta', $5) returning id`, [aria.org, aria.cuenta, ghl, `Lead ${marca}`, email]));
  return { ghl, id: c!.id, correo: email };
}

const fila = (contacto: string) => comoAdmin(() => unaFila<Record<string, any>>(admin,
  `select * from negocio.respuestas_de_los_agentes where contacto_id = $1`, [contacto]));

const estado = (corrida: string) => comoAdmin(() => unaFila<{ estado: string; salida: any; leido: any }>(admin,
  `select estado, salida, leido from negocio.corridas_de_agente where id = $1`, [corrida]));

test('1 · cada agente escribe sólo su columna: Research el market research, Estratega la oferta', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('a');
    const resumen: Seccion[] = [{ id: 'resumen', html: '<p>Research de A</p>' }];

    // Research: no escribe la oferta ni una ficha (dos rechazos), y sí su columna.
    const re = await abrir('research', a.ghl);
    const ajena = await guardarSecciones(re.corrida_id, resumen, 'estratega_oferta');
    assert.equal(ajena.ok, false, 'el Research escribió la columna del Estratega');
    assert.match(JSON.stringify(ajena.errores), /el agente research no guarda un documento en «estratega_oferta»/);
    const ficha = await guardarSecciones(re.corrida_id, resumen, 'sales_assistant_ficha_de_lead_1');
    assert.equal(ficha.ok, false, 'el Research escribió una ficha');
    assert.match(JSON.stringify(ficha.errores), /no guarda un documento en «sales_assistant_ficha_de_lead_1»/);
    const rre = await guardarSecciones(re.corrida_id, resumen);
    assert.equal(rre.ok, true, JSON.stringify(rre));
    assert.equal(rre.columna, 'research_market_research');
    assert.equal(rre.version, 1);
    assert.equal(rre.con_plantilla, false);
    assert.equal((await estado(re.corrida_id))!.estado, 'lista');

    // Estratega: no escribe el research, y sí la oferta.
    const es = await abrir('estratega', a.ghl);
    const noResearch = await guardarSecciones(es.corrida_id, [{ id: 'oferta', html: '<p>x</p>' }], 'research_market_research');
    assert.equal(noResearch.ok, false, 'el Estratega escribió la columna del Research');
    assert.match(JSON.stringify(noResearch.errores), /el agente estratega no guarda un documento en «research_market_research»/);
    const res = await guardarSecciones(es.corrida_id, [{ id: 'oferta', html: '<p>Oferta de A</p>' }]);
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.columna, 'estratega_oferta');

    // El Sales Assistant no escribe la columna del Research, ni por secciones ni entera.
    const sa = await abrir('sales_assistant', a.ghl);
    const saSec = await guardarSecciones(sa.corrida_id, resumen, 'research_market_research');
    assert.equal(saSec.ok, false);
    assert.match(JSON.stringify(saSec.errores), /el agente sales_assistant no guarda un documento en «research_market_research»/);
    const saEntera = await guardar(sa.corrida_id, '<p>research</p>', 'research_market_research');
    assert.equal(saEntera.ok, false);
    assert.match(JSON.stringify(saEntera.errores), /no guarda una ficha en «research_market_research»/);

    const f = await fila(a.id);
    assert.equal(f!.research_market_research, documento(ENV_RESEARCH, resumen));
    assert.equal(f!.estratega_oferta, documento(ENV_ESTRATEGA, [{ id: 'oferta', html: '<p>Oferta de A</p>' }]));
    assert.equal(f!.sales_assistant_ficha_de_lead_1, null, 'un rechazo escribió la ficha 1');
    assert.deepEqual(Object.keys(f!.procedencia).sort(), ['estratega_oferta', 'research_market_research']);
    assert.equal(f!.procedencia.research_market_research.corrida_id, re.corrida_id);
    assert.equal(f!.procedencia.estratega_oferta.corrida_id, es.corrida_id);
  });
});

test('2 · sin plantilla: la envoltura + una <section> por sección en el orden recibido, y la salida guarda las secciones', async () => {
  assert.match(ENV_RESEARCH, /^<!DOCTYPE html>/);
  assert.match(ENV_RESEARCH, /<title>Market research · ARIA IA<\/title>/);
  assert.match(ENV_RESEARCH, /<\/style><\/head><body>$/);
  assert.match(ENV_ESTRATEGA, /<title>Oferta · ARIA IA<\/title>/);
  await enUnEnsayo(async () => {
    const a = await unLead('b');
    const re = await abrir('research', a.ghl);
    // Llegan «b» antes que «a»: el documento respeta ese orden (no el alfabético). Las puntas no cuentan.
    const r = await guardarSecciones(re.corrida_id, [
      { id: 'b', html: '\n  <h2>Segmentos</h2><p>Med spas &amp; clínicas</p>  \n' },
      { id: 'a', html: ' <h2>Fuentes</h2><ul><li><a href="https://ejemplo.pe/estudio">estudio</a></li></ul>' },
    ]);
    assert.equal(r.ok, true, JSON.stringify(r));
    const limpias: Seccion[] = [
      { id: 'b', html: '<h2>Segmentos</h2><p>Med spas &amp; clínicas</p>' },
      { id: 'a', html: '<h2>Fuentes</h2><ul><li><a href="https://ejemplo.pe/estudio">estudio</a></li></ul>' },
    ];
    const esperado = `${ENV_RESEARCH}\n<section id="b">\n${limpias[0]!.html}\n</section>\n`
      + `<section id="a">\n${limpias[1]!.html}\n</section>${FIN}`;
    assert.equal(documento(ENV_RESEARCH, limpias), esperado);
    assert.deepEqual(r.secciones, ['b', 'a']);
    assert.equal(r.bytes, Buffer.byteLength(esperado, 'utf8'));

    const f = await fila(a.id);
    assert.equal(f!.research_market_research, esperado, 'la celda no tiene el documento armado');
    assert.equal((f!.research_market_research.match(/<style>/g) ?? []).length, 1);
    const p = f!.procedencia.research_market_research;
    assert.deepEqual([p.secciones, p.con_plantilla, p.version, p.corrida_id], [['b', 'a'], false, 1, re.corrida_id]);

    const s = await estado(re.corrida_id);
    assert.equal(s!.estado, 'lista');
    assert.deepEqual(s!.salida.secciones, limpias, 'la salida de la corrida no guardó las secciones');
    assert.equal(s!.salida.html, esperado, 'la salida de la corrida no guardó el documento');
    assert.deepEqual([s!.salida.columna, s!.salida.version, s!.salida.con_plantilla], ['research_market_research', 1, false]);

    // El evento, como en las demás columnas (el MCP simulado ve los eventos: bypassrls).
    const ev = await filas<{ datos: any }>(admin,
      `select datos from negocio.eventos where contacto_id = $1 and tipo = 'respuesta_de_agente_guardada'
          and fuente = 'ghl_managed_agents'`, [a.id]);
    assert.equal(ev.length, 1, 'no quedó el evento respuesta_de_agente_guardada');
    assert.deepEqual([ev[0]!.datos.columna, ev[0]!.datos.version, ev[0]!.datos.corrida_id],
      ['research_market_research', 1, re.corrida_id]);
  });
});

test('3 · lo que no es una sección se rechaza diciendo qué falló, y ningún rechazo deja fila', async () => {
  const SOLO_CONTENIDO = /sección «a»: sólo el contenido, sin <!DOCTYPE>, <html>, <head>, <body>, <title> ni <style>/;
  const malos: Array<[string, unknown, RegExp]> = [
    ['nulo', null, /secciones: un arreglo/],
    ['no es un arreglo', { id: 'resumen', html: '<p>x</p>' }, /secciones: un arreglo/],
    ['arreglo vacío', [], /al menos una \(sólo la última tanda puede ir vacía/],
    ['más de 40', Array.from({ length: 41 }, (_, i) => ({ id: `s${i}`, html: '<p>x</p>' })), /secciones: hasta 40/],
    ['no es un objeto', ['<p>x</p>'], /cada sección es un objeto/],
    ['id con mayúscula', [{ id: 'Resumen', html: '<p>x</p>' }], /el id va en minúsculas/],
    ['id que empieza con número', [{ id: '1resumen', html: '<p>x</p>' }], /empieza con una letra/],
    ['id de 61 caracteres', [{ id: 'a'.repeat(61), html: '<p>x</p>' }], /hasta 60 caracteres/],
    ['id repetido', [{ id: 'a', html: '<p>1</p>' }, { id: 'a', html: '<p>2</p>' }], /«a» está repetida/],
    ['html vacío', [{ id: 'a', html: ' \n  ' }], /sección «a»: está vacía/],
    ['con <style>', [{ id: 'a', html: '<style>.x{color:red}</style><p>x</p>' }], SOLO_CONTENIDO],
    ['con <body>', [{ id: 'a', html: '<body><p>x</p></body>' }], SOLO_CONTENIDO],
    ['con <!DOCTYPE>', [{ id: 'a', html: '<!DOCTYPE html><p>x</p>' }], SOLO_CONTENIDO],
    ['con el marcador', [{ id: 'a', html: '<p>{{seccion:x}}</p>' }], /no puede traer el texto «\{\{seccion:»/],
    // La sección no mira el <script>: lo atrapa _reglas_del_html sobre el documento entero.
    ['con <script>', [{ id: 'a', html: '<p>x</p><script>alert(1)</script>' }], /sin <script>/],
  ];
  await enUnEnsayo(async () => {
    const a = await unLead('c');
    // Una corrida por caso, para no gastar los cinco intentos.
    for (const [caso, secciones, error] of malos) {
      const x = await abrir('research', a.ghl);
      const r = await guardarSecciones(x.corrida_id, secciones);
      assert.equal(r.ok, false, `debió rechazar: ${caso}`);
      assert.match(JSON.stringify(r.errores), error, caso);
      assert.equal((await estado(x.corrida_id))!.salida, null, `un rechazo cerró la corrida: ${caso}`);
    }
    assert.equal(await fila(a.id), undefined, 'un rechazo dejó una fila');

    // Los controles: un id de 60 caracteres y palabras parecidas (<header>, «estilo», «cuerpo») pasan.
    const bien = await abrir('research', a.ghl);
    const r = await guardarSecciones(bien.corrida_id, [{ id: 'x'.repeat(60), html: '<header><b>El estilo y el cuerpo</b></header>' }]);
    assert.equal(r.ok, true, JSON.stringify(r));
  });
});

test('4 · con plantilla: el orden es el de la plantilla, y ni guardar_respuesta ni el catálogo la saltean', async () => {
  await enUnEnsayo(async () => {
    const puesta = await comoAdmin(() => admin.query(
      `update catalogo.salidas_de_los_agentes set plantilla = $1, secciones_obligatorias = '{resumen}'
        where clave = 'research_market_research'`, [PLANTILLA]));
    assert.equal(puesta.rowCount, 1);
    const a = await unLead('d');

    // Llegan fuentes y después resumen: el documento va como dice la plantilla.
    const r1 = await abrir('research', a.ghl);
    const g1 = await guardarSecciones(r1.corrida_id, [{ id: 'fuentes', html: '<p>F</p>' }, { id: 'resumen', html: '<p>R1</p>' }]);
    assert.equal(g1.ok, true, JSON.stringify(g1));
    assert.equal(g1.con_plantilla, true);
    assert.equal((await fila(a.id))!.research_market_research,
      `${ENV_RESEARCH}\n<div class="hoja"><h1>R</h1><p>R1</p><hr><p>F</p></div>${FIN}`, 'no siguió el orden de la plantilla');
    assert.deepEqual((await fila(a.id))!.procedencia.research_market_research.secciones, ['fuentes', 'resumen']);
    assert.equal((await fila(a.id))!.procedencia.research_market_research.con_plantilla, true);
    assert.deepEqual((await estado(r1.corrida_id))!.salida.secciones,
      [{ id: 'fuentes', html: '<p>F</p>' }, { id: 'resumen', html: '<p>R1</p>' }]);

    // Un marcador sin sección queda vacío.
    const r2 = await abrir('research', a.ghl);
    assert.equal((await guardarSecciones(r2.corrida_id, [{ id: 'resumen', html: '<p>R2</p>' }])).ok, true);
    assert.equal((await fila(a.id))!.research_market_research,
      `${ENV_RESEARCH}\n<div class="hoja"><h1>R</h1><p>R2</p><hr></div>${FIN}`, 'el marcador sin sección no quedó vacío');

    // Una sección que la plantilla no tiene, y la obligatoria que falta: rechazos (cada uno con su corrida).
    const r3 = await abrir('research', a.ghl);
    const extra = await guardarSecciones(r3.corrida_id, [{ id: 'resumen', html: '<p>R</p>' }, { id: 'extra', html: '<p>E</p>' }]);
    assert.equal(extra.ok, false);
    assert.match(JSON.stringify(extra.errores), /sección «extra»: la plantilla no la tiene \(son: resumen, fuentes\)/);
    const r4 = await abrir('research', a.ghl);
    const falta = await guardarSecciones(r4.corrida_id, [{ id: 'fuentes', html: '<p>F</p>' }]);
    assert.equal(falta.ok, false);
    assert.match(JSON.stringify(falta.errores), /falta la sección obligatoria «resumen»/);

    // guardar_respuesta no se saltea la plantilla.
    const r5 = await abrir('research', a.ghl);
    const entera = await guardar(r5.corrida_id, '<p>el research entero, sin secciones</p>');
    assert.equal(entera.ok, false, 'guardar_respuesta escribió una columna con plantilla');
    assert.match(JSON.stringify(entera.errores), /usa agentes\.guardar_secciones/);
    assert.equal((await fila(a.id))!.procedencia.research_market_research.version, 2, 'un rechazo cambió la columna');

    // El catálogo: obligatorias sin plantilla, y una plantilla sin marcador (o con contenido activo), no.
    await comoAdmin(async () => {
      await fallaCon('23514', `update catalogo.salidas_de_los_agentes set secciones_obligatorias = '{oferta}'
                                 where clave = 'estratega_oferta'`);
      await fallaCon('23514', `update catalogo.salidas_de_los_agentes set plantilla = '<div class="hoja">sin marcador</div>'
                                 where clave = 'estratega_oferta'`);
      await fallaCon('23514', `update catalogo.salidas_de_los_agentes
                                  set plantilla = '<div>{{seccion:oferta}}<script>alert(1)</script></div>'
                                 where clave = 'estratega_oferta'`);
    });
  });
});

test('5 · una segunda corrida del Research reemplaza la columna; la primera queda en su corrida y lo demás no cambia', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('e');
    const sa = await abrir('sales_assistant', a.ghl);
    assert.equal((await guardar(sa.corrida_id, '<p>ficha 1</p>')).ok, true);
    const r1 = await abrir('research', a.ghl);
    const v1: Seccion[] = [{ id: 'resumen', html: '<p>versión 1</p>' }];
    assert.equal((await guardarSecciones(r1.corrida_id, v1)).ok, true);
    const es = await abrir('estratega', a.ghl);
    assert.equal((await guardarSecciones(es.corrida_id, [{ id: 'oferta', html: '<p>la oferta</p>' }])).ok, true);
    const antes = await fila(a.id);

    const r2 = await abrir('research', a.ghl);
    const v2: Seccion[] = [{ id: 'resumen', html: '<p>versión 2</p>' }, { id: 'fuentes', html: '<p>más fuentes</p>' }];
    const g2 = await guardarSecciones(r2.corrida_id, v2);
    assert.equal(g2.ok, true, JSON.stringify(g2));
    assert.equal(g2.version, 2);

    const f = await fila(a.id);
    assert.equal(f!.research_market_research, documento(ENV_RESEARCH, v2));
    assert.deepEqual([f!.procedencia.research_market_research.version, f!.procedencia.research_market_research.corrida_id],
      [2, r2.corrida_id]);
    const s1 = (await estado(r1.corrida_id))!.salida;
    assert.equal(s1.html, documento(ENV_RESEARCH, v1), 'la versión 1 se perdió');
    assert.equal(s1.version, 1);
    assert.deepEqual(s1.secciones, v1);
    // Las demás columnas, y su procedencia, como estaban.
    assert.equal(f!.sales_assistant_ficha_de_lead_1, antes!.sales_assistant_ficha_de_lead_1, 'el research pisó la ficha 1');
    assert.equal(f!.estratega_oferta, antes!.estratega_oferta, 'el research pisó la oferta');
    assert.deepEqual(f!.procedencia.estratega_oferta, antes!.procedencia.estratega_oferta);
    assert.deepEqual(f!.procedencia.sales_assistant_ficha_de_lead_1, antes!.procedencia.sales_assistant_ficha_de_lead_1);
    // Y quien lee las secciones, lee las de la versión vigente.
    const es2 = await abrir('estratega', a.ghl);
    assert.deepEqual((await leerSecciones(es2.corrida_id, 'research_market_research')).secciones, v2);
  });
});

test('6 · leer_secciones: el Estratega lee las secciones del research de su lead, y sólo de su lead', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('f');
    const b = await unLead('g');
    const deA: Seccion[] = [{ id: 'resumen', html: '<p>SECRETO-DE-A</p>' }, { id: 'fuentes', html: '<p>fuentes de A</p>' }];
    const deB: Seccion[] = [{ id: 'resumen', html: '<p>lo de B</p>' }];
    const ra = await abrir('research', a.ghl);
    assert.equal((await guardarSecciones(ra.corrida_id, deA)).ok, true);
    const rb = await abrir('research', b.ghl);
    assert.equal((await guardarSecciones(rb.corrida_id, deB)).ok, true);

    // A: las de la corrida que escribió la columna, y quedan en lo leído.
    const ea = await abrir('estratega', a.ghl);
    const la = await leerSecciones(ea.corrida_id, 'research_market_research');
    assert.equal(la.ok, true, JSON.stringify(la));
    assert.deepEqual(la.secciones, deA);
    assert.deepEqual([la.corrida_id, la.version, la.columna], [ra.corrida_id, 1, 'research_market_research']);
    assert.ok(Object.keys((await estado(ea.corrida_id))!.leido.fuentes).includes(`secciones:research_market_research@${ra.corrida_id}`),
      'la lectura de las secciones no quedó en lo leído del Estratega');
    // También lo puede leer entero, con leer_respuesta.
    assert.equal((await j(`select agentes.leer_respuesta($1, 'research_market_research') as r`, [ea.corrida_id])).valor,
      documento(ENV_RESEARCH, deA));

    // B: las suyas, nunca las de A.
    const eb = await abrir('estratega', b.ghl);
    const lb = await leerSecciones(eb.corrida_id, 'research_market_research');
    assert.deepEqual(lb.secciones, deB);
    assert.equal(lb.corrida_id, rb.corrida_id);
    assert.ok(!JSON.stringify(lb).includes('SECRETO-DE-A'), 'desde el lead B se leyeron las secciones de A');
    // Un lead sin research: nada, y lo dice.
    const c = await unLead('h');
    const lc = await leerSecciones((await abrir('estratega', c.ghl)).corrida_id, 'research_market_research');
    assert.equal(lc.secciones, null);
    assert.match(lc.motivo, /todavía no hay nada guardado/);

    // Una columna guardada entera (guardar_respuesta) no tiene secciones: lo dice y apunta a leer_respuesta.
    const sa = await abrir('sales_assistant', a.ghl);
    assert.equal((await guardar(sa.corrida_id, '<p>ficha 1</p>')).ok, true);
    const lf = await leerSecciones(ea.corrida_id, 'sales_assistant_ficha_de_lead_1');
    assert.equal(lf.secciones, null);
    assert.equal(lf.corrida_id, sa.corrida_id);
    assert.match(lf.motivo, /no se guardó por secciones/);
    // Una columna que no existe no se lee.
    assert.match(await fallaCon('22023', `select agentes.leer_secciones($1, 'contactos')`, [ea.corrida_id]), /no es una columna/);

    // La segunda barrera: aunque la procedencia de B apuntara a la corrida de A (un UPDATE directo), las secciones se
    // buscan sólo en las corridas de B.
    await comoAdmin(() => admin.query(
      `update negocio.respuestas_de_los_agentes
          set procedencia = jsonb_set(procedencia, '{research_market_research,corrida_id}', to_jsonb($2::text))
        where contacto_id = $1`, [b.id, ra.corrida_id]));
    const eb2 = await abrir('estratega', b.ghl);
    const lb2 = await leerSecciones(eb2.corrida_id, 'research_market_research');
    assert.ok(!JSON.stringify(lb2).includes('SECRETO-DE-A'), 'leer_secciones siguió una procedencia hacia la corrida de otro lead');
    assert.equal(lb2.secciones, null);
  });
});

/** La tabla del flujo de Walter, como está en producción (en local no existe). */
const CREAR_FICHA_2 = `create table if not exists public.aria_cc_icp_oferta (
  id uuid default gen_random_uuid(), name text, email text, company_name text, telefono text, pais_ciudad text,
  website text, chat_history jsonb, html text, creado_el timestamptz not null default now(), org_id uuid,
  created_at timestamptz, form_completo text)`;

test('7 · leer_ficha_de_cliente_2: la más reciente del correo del lead con el Brief completo, nunca de otra organización', async () => {
  await enUnEnsayo(async () => {
    // El MCP simulado la lee con pg_read_all_data, como el MCP de producción la lee como postgres: sin grant aparte.
    await comoAdmin(() => admin.query(CREAR_FICHA_2));
    const correo = `ficha2-${randomUUID().slice(0, 8)}@ejemplo.pe`;
    // El correo del lead con mayúsculas y espacios: se compara sin ellos, de los dos lados.
    const a = await unLead('i', `  ${correo.toUpperCase()} `);
    const fila2 = (email: string, html: string, hace: string, completo: string, org: string | null) => comoAdmin(() => admin.query(
      `insert into public.aria_cc_icp_oferta (name, email, html, org_id, created_at, form_completo)
       values ('Lead i', $1, $2, $3, now() - $4::interval, $5)`, [email, html, org, hace, completo]));
    await fila2(correo, '<p>VIEJA</p>', '3 days', 'SI', null);
    await fila2(` ${correo.replace('ficha2', 'Ficha2')}  `, '<p>NUEVA</p>', '2 days', 'SI', null);
    await fila2(correo, '<p>NO-CUENTA</p>', '1 day', 'NO', null);
    await fila2(correo, '<p>DE-OTRA-ORG</p>', '0 seconds', 'SI', randomUUID());

    const re = await abrir('research', a.ghl);
    const r = await leerFicha2(re.corrida_id);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.valor, '<p>NUEVA</p>', `no trajo la más reciente con el Brief completo: ${JSON.stringify(r)}`);
    assert.ok(r.encontrada_el, 'no dice de cuándo es');
    assert.ok(!JSON.stringify(r).includes('DE-OTRA-ORG'), 'trajo la ficha de otra organización');
    assert.equal((await estado(re.corrida_id))!.leido.fuentes.ficha_de_cliente_2, '<p>NUEVA</p>', 'no quedó en lo leído');

    // Con el org_id de la corrida también vale.
    const d = await unLead('j');
    await fila2(d.correo!, '<p>DE-ARIA</p>', '1 day', 'SI', aria.org);
    assert.equal((await leerFicha2((await abrir('research', d.ghl)).corrida_id)).valor, '<p>DE-ARIA</p>');

    // Otro correo: nada, con el motivo; y no se anota.
    const b = await unLead('k');
    const rb = await abrir('research', b.ghl);
    const sinFicha = await leerFicha2(rb.corrida_id);
    assert.equal(sinFicha.valor, null);
    assert.match(sinFicha.motivo, /no hay una ficha de cliente 2 con el Brief completo/);
    assert.ok(!('ficha_de_cliente_2' in ((await estado(rb.corrida_id))!.leido.fuentes ?? {})));

    // Sin correo: nada, con el motivo.
    const c = await unLead('l', null);
    const sinCorreo = await leerFicha2((await abrir('research', c.ghl)).corrida_id);
    assert.equal(sinCorreo.valor, null);
    assert.match(sinCorreo.motivo, /el lead no tiene correo/);

    // Las filas sin org_id son del Brief de ARIA: otra organización, con un lead del mismo correo, no las ve (no lee el
    // Brief de un cliente de ARIA). La otra organización, con su cuenta y su location, dentro de la transacción.
    const otra = await comoAdmin(async () => {
      const o = await unaFila<{ id: string }>(admin, `insert into identidad.organizaciones (nombre, slug) values ('Otra 508', $1) returning id`,
        [`otra-508-${randomUUID().slice(0, 8)}`]);
      let cta = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [o!.id]);
      if (!cta) {
        cta = await unaFila<{ id: string }>(admin, `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Otra 508', $2) returning id`,
          [o!.id, `otra-508-${randomUUID().slice(0, 8)}`]);
      }
      await admin.query(`update identidad.cuentas set crm = 'ghl', crm_cuenta_id = 'loc-508-otra', estado = 'activa' where id = $1`, [cta!.id]);
      const ghl = `ghl-508-otra-${randomUUID().slice(0, 8)}`;
      await admin.query(`insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente, email) values ($1, $2, $3, 'Otra', 'meta', $4)`,
        [o!.id, cta!.id, ghl, correo]);
      return { ghl };
    });
    const deOtra = await j(`select agentes.abrir_corrida('research', 'loc-508-otra', $1, $2) as r`, [otra.ghl, `research:${otra.ghl}`]);
    const r2 = await leerFicha2(deOtra.corrida_id);
    assert.equal(r2.valor, null, 'otra organización leyó una ficha sin org_id (el Brief de un cliente de ARIA)');
    assert.ok(!JSON.stringify(r2).includes('NUEVA') && !JSON.stringify(r2).includes('VIEJA'));
  });
});

test('7c · leer_ficha_de_cliente_2 con la tabla de Walter cambiada (sin una columna): el motivo, no un error', async () => {
  await enUnEnsayo(async () => {
    await comoAdmin(() => admin.query(CREAR_FICHA_2));
    await comoAdmin(() => admin.query(`alter table public.aria_cc_icp_oferta rename column created_at to creada_otra`));
    const a = await unLead('q');
    const r = await leerFicha2((await abrir('research', a.ghl)).corrida_id);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.valor, null);
    assert.match(r.motivo, /no se pudo leer la ficha de cliente 2 \(42703/);
  });
});

test('7b · leer_ficha_de_cliente_2 sin la tabla: el motivo, no un error', async () => {
  await enUnEnsayo(async () => {
    // En local no existe; si alguien la creó, se aparta dentro de la transacción (se deshace al final).
    await comoAdmin(() => admin.query(`do $$ begin
      if to_regclass('public.aria_cc_icp_oferta') is not null then
        alter table public.aria_cc_icp_oferta rename to aria_cc_icp_oferta_fuera_508;
      end if; end $$`));
    const a = await unLead('m');
    const r = await leerFicha2((await abrir('research', a.ghl)).corrida_id);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.valor, null);
    assert.match(r.motivo, /no está la tabla de la ficha de cliente 2/);
  });
});

test('8 · abrir_corrida: el «siguiente» de Research y Estratega, el Funnel Builder sin salida no abre, y el catálogo', async () => {
  // (La plantilla del Research, desde la 125, la mira la 509.)
  const salidas = await filas<{ clave: string; agente: string; orden: number; tipo: string; por_secciones: boolean }>(admin,
    `select clave, agente, orden, tipo, por_secciones from catalogo.salidas_de_los_agentes
      where clave in ('research_market_research', 'estratega_oferta') order by orden`);
  assert.deepEqual(salidas, [
    { clave: 'research_market_research', agente: 'research', orden: 5, tipo: 'html', por_secciones: true },
    { clave: 'estratega_oferta', agente: 'estratega', orden: 6, tipo: 'html', por_secciones: true },
  ]);
  const vista = await filas<{ column_name: string }>(admin,
    `select column_name from information_schema.columns where table_schema = 'negocio' and table_name = 'respuestas_por_lead'
      order by ordinal_position`);
  const nombres = vista.map((c) => c.column_name);
  assert.deepEqual(nombres.slice(nombres.indexOf('brief_ficha_de_cliente_1'), nombres.indexOf('brief_ficha_de_cliente_1') + 3),
    ['brief_ficha_de_cliente_1', 'research_market_research', 'estratega_oferta'], 'la vista no sigue el orden del flujo');

  await enUnEnsayo(async () => {
    const a = await unLead('n');
    const re = await abrir('research', a.ghl);
    assert.equal(re.ok, true, JSON.stringify(re));
    assert.match(re.siguiente, new RegExp(`agentes\\.leer_respuesta\\('${re.corrida_id}', 'sales_coach_ficha_de_lead_2'\\)`));
    assert.match(re.siguiente, new RegExp(`agentes\\.leer_ficha_de_cliente_2\\('${re.corrida_id}'\\)`));
    assert.match(re.siguiente, new RegExp(`agentes\\.guardar_secciones\\('${re.corrida_id}'`));
    assert.doesNotMatch(re.siguiente, /leer_research|guardar_respuesta/);
    const es = await abrir('estratega', a.ghl);
    assert.match(es.siguiente, new RegExp(`agentes\\.leer_respuesta\\('${es.corrida_id}', 'research_market_research'\\)`));
    assert.match(es.siguiente, new RegExp(`agentes\\.guardar_secciones\\('${es.corrida_id}'`));
    assert.doesNotMatch(es.siguiente, /leer_estratega|guardar_respuesta/);
    // El Funnel Builder: todavía sin salida, no abre.
    const m = await fallaCon('22023', `select agentes.abrir_corrida('funnel_builder', $1, $2, $3)`, [LOC, a.ghl, `fb:${a.ghl}`]);
    assert.match(m, /el agente funnel_builder todavía no tiene salida definida/);
  });
});

test('9 · leer_brief da las fuentes del Brief Agent y lo que falta, sin las preguntas ni lo ya respondido', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('o');
    await comoAdmin(() => admin.query(
      `insert into negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, pregunta, origen_clave, valor_texto, proveedor, obtenida_por, observada_el)
       values ($1, $2, $3, 'facturacion_mensual', 'contact.facturacion', 'factura 8 mil', 'ghl', 'formulario', now())`,
      [aria.org, aria.cuenta, a.id]));
    const ll = await j(`select agentes.registrar_llamada($1, $2, $3, 'venta', 'fathom', 'Closer: ¿cuánto facturas? Lead: 8 mil.') as r`,
      [LOC, a.ghl, `grab-508-${randomUUID().slice(0, 8)}`]);
    const br = await abrir('brief', a.ghl);
    const pub = await j(`select agentes.registrar_fuente_publica($1, 'web', 'Su web: clínica estética en Lima') as r`, [br.corrida_id]);

    const l = await j(`select agentes.leer_brief($1) as r`, [br.corrida_id]);
    assert.deepEqual(Object.keys(l).sort(), ['agente', 'contrato', 'corrida_id', 'faltantes', 'fuentes'],
      'leer_brief devuelve otra forma (¿preguntas, ya_respondido o version_del_brief?)');
    assert.deepEqual([l.corrida_id, l.agente], [br.corrida_id, 'brief']);
    assert.equal(l.fuentes['formulario:facturacion_mensual'], 'factura 8 mil');
    assert.match(l.fuentes[`llamada_venta:${ll.llamada_id}`], /8 mil/);
    assert.equal(l.fuentes[pub.fuente], 'Su web: clínica estética en Lima');
    assert.deepEqual(l.faltantes, []);
    assert.match(l.contrato, /guardar_respuesta/);
    // Lo leído queda en la corrida.
    const leido = Object.keys((await estado(br.corrida_id))!.leido.fuentes);
    assert.ok(leido.includes(`llamada_venta:${ll.llamada_id}`) && leido.includes('formulario:facturacion_mensual'));

    // Sin llamada de venta: lo dice en faltantes.
    const b = await unLead('p');
    const lb = await j(`select agentes.leer_brief($1) as r`, [(await abrir('brief', b.ghl)).corrida_id]);
    assert.deepEqual(lb.faltantes, ['transcripcion_de_venta']);

    // Nada de otro lead: B con su respuesta, su llamada y su fuente pública; A no ve ninguna.
    await comoAdmin(() => admin.query(
      `insert into negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, pregunta, origen_clave, valor_texto, proveedor, obtenida_por, observada_el)
       values ($1, $2, $3, 'tipo_de_negocio', 'contact.tipo', 'SECRETO-B-FORM', 'ghl', 'formulario', now())`,
      [aria.org, aria.cuenta, b.id]));
    await j(`select agentes.registrar_llamada($1, $2, $3, 'venta', 'fathom', 'SECRETO-B-LLAMADA') as r`,
      [LOC, b.ghl, `grab-508b-${randomUUID().slice(0, 8)}`]);
    const brB = await abrir('brief', b.ghl);
    await j(`select agentes.registrar_fuente_publica($1, 'web', 'SECRETO-B-WEB') as r`, [brB.corrida_id]);
    const br2 = await abrir('brief', a.ghl);
    const la2 = await j(`select agentes.leer_brief($1) as r`, [br2.corrida_id]);
    assert.ok(!JSON.stringify(la2).includes('SECRETO-B'), `leer_brief de A trajo algo del lead B: ${JSON.stringify(la2).slice(0, 300)}`);
  });
});

test('10 · cada salida con su forma de guardar: las fichas enteras, Research y Estratega por secciones, y nada se arma partido', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('r');
    // Una ficha no se guarda por secciones (la 2 se saltaría la ficha 1 que la base le pone delante).
    const sa = await abrir('sales_assistant', a.ghl);
    const r1 = await guardarSecciones(sa.corrida_id, [{ id: 'resumen', html: '<p>x</p>' }]);
    assert.equal(r1.ok, false);
    assert.match(JSON.stringify(r1.errores), /no se guarda por secciones: usa agentes\.guardar_respuesta/);
    // El research no entra entero, aunque no tenga plantilla.
    const re = await abrir('research', a.ghl);
    const r2 = await guardar(re.corrida_id, '<p>el research entero</p>');
    assert.equal(r2.ok, false);
    assert.match(JSON.stringify(r2.errores), /se guarda por secciones: usa agentes\.guardar_secciones/);
    assert.equal(await fila(a.id), undefined, 'un rechazo dejó una fila');
    // El catálogo: por secciones sólo una salida HTML que no incluye otra.
    await comoAdmin(async () => {
      await fallaCon('23514', `update catalogo.salidas_de_los_agentes set por_secciones = true
                                 where clave = 'sales_coach_ficha_de_lead_2'`);
      // Y una plantilla no puede traer el estilo (lo pone la envoltura).
      await fallaCon('23514', `update catalogo.salidas_de_los_agentes
                                  set plantilla = '<style>p{}</style>{{seccion:a}}' where clave = 'research_market_research'`);
    });

    // Con plantilla, una etiqueta partida entre dos secciones se rearma en el cuerpo: se rechaza igual.
    await comoAdmin(() => admin.query(`update catalogo.salidas_de_los_agentes
        set plantilla = '<div class="hoja">{{seccion:a}}{{seccion:b}}{{seccion:c}}</div>', secciones_obligatorias = null
      where clave = 'research_market_research'`));
    const re2 = await abrir('research', a.ghl);
    const r3 = await guardarSecciones(re2.corrida_id, [{ id: 'a', html: '<sty' }, { id: 'b', html: 'le>*{display:none}</sty' }, { id: 'c', html: 'le>' }]);
    assert.equal(r3.ok, false, 'el <style> partido entre secciones pasó');
    assert.match(JSON.stringify(r3.errores), /no partas etiquetas entre secciones/);

    // Un catálogo mal armado (una obligatoria que la plantilla no tiene) es un error de la base, no un intento del agente.
    await comoAdmin(() => admin.query(`update catalogo.salidas_de_los_agentes set secciones_obligatorias = '{zzz}'
      where clave = 'research_market_research'`));
    const re3 = await abrir('research', a.ghl);
    const m = await fallaCon('22023', `select agentes.guardar_secciones($1, $2::jsonb)`,
      [re3.corrida_id, JSON.stringify([{ id: 'a', html: '<p>a</p>' }])]);
    assert.match(m, /pide secciones que su plantilla no tiene/);
    assert.equal((await comoAdmin(() => unaFila<{ intentos: number }>(admin,
      `select intentos from negocio.corridas_de_agente where id = $1`, [re3.corrida_id])))!.intentos, 0, 'le gastó un intento al agente');
  });
});
