// LAS RESPUESTAS DE LOS AGENTES (la migración 118, fase 1). Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (decisiones del usuario del 2026-11-20)
//
// Cada managed agent deja UN output en negocio.respuestas_de_los_agentes: una fila por lead y una columna por
// agente, en el orden del flujo (Triage, Sales Assistant, Sales Coach, Brief).
//
//   1 · cada agente escribe sólo su columna, y ninguno la de otro: el Sales Assistant no escribe la del Brief, el
//       Research no tiene columna, el Triage no guarda fichas y el Sales Assistant no registra cuadrantes — mutación:
//       _salida_del_agente sin mirar el agente;
//   2 · el Sales Coach lee la ficha 1 y el Brief la ficha 2 (leer_respuesta), y la lectura queda en lo leído;
//   3 · una corrida nueva del mismo agente reemplaza su columna, la anterior queda en la salida de su corrida y las
//       demás columnas no cambian;
//   4 · dos leads de la misma cuenta no se mezclan, y otra organización u otra cuenta no ven nada (RLS); 4b · por el
//       camino del inquilino (el futuro ARIA MCP) se guarda y se lee igual;
//   5 · el HTML con contenido activo se rechaza con un error que dice qué falló, también disfrazado (mayúsculas,
//       entidades, el evento pegado a la comilla, svg), y al quinto rechazo la corrida queda fallida — mutaciones:
//       _reglas_del_html que no rechaza nada, y la regla vieja que buscaba la palabra «javascript:»; 5b · la regla es un
//       CHECK de la tabla: un UPDATE directo por el MCP tampoco la saltea, y un INSERT sólo crea la fila vacía;
//   6 · registrar_cuadrante valida el cuadrante y la razón, y no toca contactos.cuadrante;
//   7 · sin lead en la base, guardar rechaza y leer devuelve vacío;
//   8 · nadie borra, y sólo se actualizan las columnas de las salidas;
//   9 · el expediente trae la sección nueva sin el HTML, y la vista para mirar tiene las columnas en el orden del
//       flujo y filas para el inquilino — mutación: respuestas_por_lead sin security_invoker.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';

let admin: Client;
let aria: { org: string; cuenta: string };
const LOC = 'loc-504';
const COLUMNAS = ['triage_cuadrante_de_clasificacion', 'sales_assistant_ficha_de_lead_1', 'sales_coach_ficha_de_lead_2',
  'brief_ficha_de_cliente_1'];

before(async () => {
  admin = await conectar('admin');
  const a = await unaFila<{ org: string; cuenta: string }>(
    admin,
    `select o.id as org, c.id as cuenta from identidad.organizaciones o
       join identidad.cuentas c on c.org_id = o.id and c.es_por_omision where o.es_principal`,
  );
  assert.ok(a, 'falta el sembrado');
  aria = a;
  const e = await unaFila<{ envoltura: string }>(admin,
    `select envoltura from catalogo.salidas_de_los_agentes where clave = 'sales_assistant_ficha_de_lead_1'`);
  assert.ok(e?.envoltura, 'la ficha 1 no tiene el estilo de la base (120)');
  ENVOLTURA = e.envoltura;
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

/** Lo mismo, pero como la aplicación: el inquilino con su organización y sus cuentas (todas, por omisión). */
async function comoInquilino<T>(org: string, fn: () => Promise<T>, cuentas = '*'): Promise<T> {
  await admin.query('reset role');
  await admin.query('set local role app_inquilino');
  await admin.query(`select set_config('app.org_id', $1, true), set_config('app.cuentas', $2, true),
                            set_config('app.toda_la_organizacion', $3, true)`, [org, cuentas, cuentas === '*' ? 'si' : '']);
  try {
    return await fn();
  } finally {
    await admin.query(`select set_config('app.org_id', '', true), set_config('app.cuentas', '', true),
                              set_config('app.toda_la_organizacion', '', true)`);
    await admin.query('reset role');
    await admin.query('set local role mcp_simulado');
  }
}

async function j(sql: string, params: unknown[] = []): Promise<Record<string, any>> {
  const r = await admin.query<{ r: Record<string, any> }>(sql, params);
  return r.rows[0]!.r;
}

const abrir = (agente: string, ghl: string, sujeto: object = {}) =>
  j(`select agentes.abrir_corrida($1, $2, $3, $4, '{}'::jsonb, null, $5) as r`,
    [agente, LOC, ghl, `${agente}:${ghl}:${randomUUID()}`, sujeto]);

const guardar = (corrida: string, html: string, columna: string | null = null) =>
  j(`select agentes.guardar_respuesta($1, $2, $3) as r`, [corrida, html, columna]);

const cuadrante = (corrida: string, valor: string, razon: string | null) =>
  j(`select agentes.registrar_cuadrante($1, $2, $3) as r`, [corrida, valor, razon]);

const leer = (corrida: string, columna: string) => j(`select agentes.leer_respuesta($1, $2) as r`, [corrida, columna]);

/** La ficha 1 se guarda con el estilo de la base (120): devuelve lo que mandó el agente y falla si no quedó envuelta. */
let ENVOLTURA = '';
function cuerpo(html: string | null | undefined): string {
  const fin = '\n</body></html>';
  assert.ok(html && html.startsWith(`${ENVOLTURA}\n`) && html.endsWith(fin), 'la ficha 1 no quedó con el estilo de la base');
  return html.slice(ENVOLTURA.length + 1, html.length - fin.length);
}

async function unLead(marca: string): Promise<{ ghl: string; id: string }> {
  const ghl = `ghl-504-${marca}-${randomUUID().slice(0, 8)}`;
  const c = await comoAdmin(() => unaFila<{ id: string }>(admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente, email)
     values ($1, $2, $3, $4, 'meta', $5) returning id`, [aria.org, aria.cuenta, ghl, `Lead ${marca}`, `${ghl}@ejemplo.pe`]));
  return { ghl, id: c!.id };
}

const fila = (contacto: string) => comoAdmin(() => unaFila<Record<string, any>>(admin,
  `select * from negocio.respuestas_de_los_agentes where contacto_id = $1`, [contacto]));

const estado = (corrida: string) => comoAdmin(() => unaFila<{ estado: string; salida: any; leido: any }>(admin,
  `select estado, salida, leido from negocio.corridas_de_agente where id = $1`, [corrida]));

/** Una llamada de venta del lead y la corrida del Sales Coach sobre ella. */
async function unSalesCoach(ghl: string): Promise<string> {
  const ll = await j(`select agentes.registrar_llamada($1, $2, $3, 'venta', 'ghl', 'Lead: lo pienso y te confirmo el lunes.') as r`,
    [LOC, ghl, `grab-${ghl}-${randomUUID().slice(0, 6)}`]);
  return (await abrir('sales_coach', ghl, { llamada_id: ll.llamada_id })).corrida_id as string;
}

test('1 y 2 · cada agente escribe sólo su columna de la fila del lead, y el siguiente lee la del anterior', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('a');

    // Triage: el cuadrante y su razón, en la primera columna.
    const t = await abrir('triage', a.ghl);
    const rt = await cuadrante(t.corrida_id, ' Prioriza ', 'factura 8 mil al mes y quiere empezar ya');
    assert.equal(rt.ok, true, JSON.stringify(rt));
    assert.equal(rt.cuadrante, 'prioriza');
    assert.equal((await estado(t.corrida_id))!.estado, 'lista');

    // Sales Assistant: la ficha 1. No puede escribir la del Brief, ni registrar un cuadrante.
    const sa = await abrir('sales_assistant', a.ghl);
    const ajena = await guardar(sa.corrida_id, '<h1>no es mía</h1>', 'brief_ficha_de_cliente_1');
    assert.equal(ajena.ok, false);
    assert.match(JSON.stringify(ajena.errores), /no guarda una ficha en «brief_ficha_de_cliente_1»/);
    const noTriage = await cuadrante(sa.corrida_id, 'valida', 'por probar');
    assert.equal(noTriage.ok, false);
    assert.match(JSON.stringify(noTriage.errores), /sólo el Triage/);
    const rsa = await guardar(sa.corrida_id, '<section id="resumen"><h1>Ficha 1 de A</h1></section>');
    assert.equal(rsa.ok, true, JSON.stringify(rsa));
    assert.equal(rsa.columna, 'sales_assistant_ficha_de_lead_1');
    assert.equal(rsa.version, 1);
    assert.equal((await estado(sa.corrida_id))!.estado, 'lista', 'en la fase 1 no espera aprobación');

    // El Triage no guarda fichas, y el Research no tiene columna.
    const t2 = await abrir('triage', a.ghl);
    const tFicha = await guardar(t2.corrida_id, '<p>ficha</p>');
    assert.equal(tFicha.ok, false);
    assert.match(JSON.stringify(tFicha.errores), /el agente triage no guarda una ficha/);
    const re = await abrir('research', a.ghl, { paso: 'mr_segmentos' });
    const rre = await guardar(re.corrida_id, '<p>research</p>');
    assert.equal(rre.ok, false);
    assert.match(JSON.stringify(rre.errores), /el agente research no guarda una ficha/);

    // Sales Coach: lee la ficha 1 y la anota en lo leído; guarda la ficha 2.
    const sc = await unSalesCoach(a.ghl);
    const l1 = await leer(sc, 'sales_assistant_ficha_de_lead_1');
    assert.equal(cuerpo(l1.valor), '<section id="resumen"><h1>Ficha 1 de A</h1></section>');
    assert.equal(l1.corrida_id, sa.corrida_id);
    assert.ok(Object.keys((await estado(sc))!.leido.fuentes).includes(`respuesta:sales_assistant_ficha_de_lead_1@${sa.corrida_id}`),
      'la lectura de la ficha 1 no quedó en lo leído del Sales Coach');
    assert.equal((await guardar(sc, '<section id="analisis_de_llamada">Ficha 2 de A</section>')).ok, true);

    // Brief: lee la ficha 2 y guarda la del cliente.
    const br = await abrir('brief', a.ghl);
    assert.equal((await leer(br.corrida_id, 'sales_coach_ficha_de_lead_2')).valor, '<section id="analisis_de_llamada">Ficha 2 de A</section>');
    assert.equal((await guardar(br.corrida_id, '<section id="enlace_brief"><a href="https://welcome.ariaia.com">Brief</a></section>')).ok, true);

    const f = await fila(a.id);
    assert.equal(f!.triage_cuadrante_de_clasificacion, 'prioriza');
    assert.equal(cuerpo(f!.sales_assistant_ficha_de_lead_1), '<section id="resumen"><h1>Ficha 1 de A</h1></section>');
    assert.equal(f!.sales_coach_ficha_de_lead_2, '<section id="analisis_de_llamada">Ficha 2 de A</section>');
    assert.match(f!.brief_ficha_de_cliente_1, /welcome\.ariaia\.com/);
    assert.deepEqual(Object.keys(f!.procedencia).sort(), [...COLUMNAS].sort());
    assert.equal(f!.procedencia.triage_cuadrante_de_clasificacion.razon, 'factura 8 mil al mes y quiere empezar ya');
    assert.equal(f!.procedencia.sales_coach_ficha_de_lead_2.corrida_id, sc);

    // El cuadrante del Triage NO es contactos.cuadrante: ése lo trae la sincronización desde GHL.
    const k = await comoAdmin(() => unaFila<{ cuadrante: string | null }>(admin,
      `select cuadrante from negocio.contactos where id = $1`, [a.id]));
    assert.equal(k!.cuadrante, null, 'registrar_cuadrante tocó contactos.cuadrante');
  });
});

test('3 · una corrida nueva reemplaza su columna, la anterior queda en su corrida y las demás no cambian', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('v');
    const t = await abrir('triage', a.ghl);
    assert.equal((await cuadrante(t.corrida_id, 'valida', 'no dijo cuánto factura')).ok, true);
    const s1 = await abrir('sales_assistant', a.ghl);
    assert.equal((await guardar(s1.corrida_id, '<p>versión 1</p>')).ok, true);
    const s2 = await abrir('sales_assistant', a.ghl);
    const r2 = await guardar(s2.corrida_id, '<p>versión 2 (reagendó)</p>');
    assert.equal(r2.ok, true, JSON.stringify(r2));
    assert.equal(r2.version, 2);

    const f = await fila(a.id);
    assert.equal(cuerpo(f!.sales_assistant_ficha_de_lead_1), '<p>versión 2 (reagendó)</p>');
    assert.equal(f!.procedencia.sales_assistant_ficha_de_lead_1.version, 2);
    assert.equal(f!.procedencia.sales_assistant_ficha_de_lead_1.corrida_id, s2.corrida_id);
    assert.equal(f!.triage_cuadrante_de_clasificacion, 'valida', 'la ficha nueva pisó la columna del Triage');
    assert.equal(cuerpo((await estado(s1.corrida_id))!.salida.html), '<p>versión 1</p>', 'la versión anterior se perdió');
  });
});

test('4 · dos leads de la misma cuenta no se mezclan, y otra organización no ve nada', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('a4');
    const b = await unLead('b4');
    const sa = await abrir('sales_assistant', a.ghl);
    assert.equal((await guardar(sa.corrida_id, '<p>de A</p>')).ok, true);
    const sb = await abrir('sales_assistant', b.ghl);
    assert.equal((await guardar(sb.corrida_id, '<p>de B</p>')).ok, true);

    assert.equal(cuerpo((await fila(a.id))!.sales_assistant_ficha_de_lead_1), '<p>de A</p>');
    assert.equal(cuerpo((await fila(b.id))!.sales_assistant_ficha_de_lead_1), '<p>de B</p>');
    // Una corrida del lead B lee lo de B, nunca lo de A.
    const scB = await unSalesCoach(b.ghl);
    assert.equal(cuerpo((await leer(scB, 'sales_assistant_ficha_de_lead_1')).valor), '<p>de B</p>');

    const deAria = await comoInquilino(aria.org, () => filas<{ contacto_id: string }>(admin,
      `select contacto_id from negocio.respuestas_por_lead where contacto_id = any($1::uuid[])`, [[a.id, b.id]]));
    assert.equal(deAria.length, 2, 'el inquilino de ARIA no ve sus filas: ¿la vista perdió security_invoker?');
    const deOtra = await comoInquilino(randomUUID(), () => filas<{ tabla: number; vista: number }>(admin,
      `select (select count(*)::int from negocio.respuestas_de_los_agentes where contacto_id = any($1::uuid[])) as tabla,
              (select count(*)::int from negocio.respuestas_por_lead where contacto_id = any($1::uuid[])) as vista`, [[a.id, b.id]]));
    assert.equal(deOtra[0]!.tabla, 0, 'otra organización ve las respuestas de ARIA');
    // Por la vista también: sin security_invoker leería como su dueño y se saltaría la RLS.
    assert.equal(deOtra[0]!.vista, 0, 'otra organización ve las respuestas de ARIA por la vista: ¿perdió security_invoker?');
    // Y otra cuenta de la MISMA organización tampoco (la política es de cuenta, no sólo de organización).
    const deOtraCuenta = await comoInquilino(aria.org, () => filas<{ n: number }>(admin,
      `select count(*)::int as n from negocio.respuestas_de_los_agentes where contacto_id = any($1::uuid[])`, [[a.id, b.id]]),
      randomUUID());
    assert.equal(deOtraCuenta[0]!.n, 0, 'otra cuenta de la organización ve las respuestas de esta cuenta');
  });
});

test('4b · por el camino del inquilino (el futuro ARIA MCP) se guarda y se lee igual, con la RLS puesta', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('i');
    const sa = await abrir('sales_assistant', a.ghl);
    const r = await comoInquilino(aria.org, () => guardar(sa.corrida_id, '<p>guardada por el inquilino</p>'));
    assert.equal(r.ok, true, JSON.stringify(r));
    const sc = await unSalesCoach(a.ghl);
    const l = await comoInquilino(aria.org, () => leer(sc, 'sales_assistant_ficha_de_lead_1'));
    assert.equal(cuerpo(l.valor), '<p>guardada por el inquilino</p>');
    const t = await abrir('triage', a.ghl);
    assert.equal((await comoInquilino(aria.org, () => cuadrante(t.corrida_id, 'prioriza', 'factura bien'))).ok, true);
  });
});

test('5 · el HTML con contenido activo se rechaza diciendo qué falló, y al quinto rechazo la corrida falla', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('h');
    const malos: Array<[string, RegExp]> = [
      ['<p>hola</p><script>alert(1)</script>', /sin <script>/],
      ['<img src="https://x.pe/a.png" onerror="alert(1)">', /atributos de evento/],
      ['<a href="javascript:alert(1)">clic</a>', /sólo con https/],
      ['<a href="data:text/html;base64,PHNjcmlwdD4=">clic</a>', /sólo con https/],
    ];
    const c = await abrir('sales_assistant', a.ghl);
    for (const [html, error] of malos) {
      const r = await guardar(c.corrida_id, html);
      assert.equal(r.ok, false, `debió rechazar: ${html}`);
      assert.match(JSON.stringify(r.errores), error);
    }
    const quinto = await guardar(c.corrida_id, '   ');
    assert.equal(quinto.ok, false);
    assert.match(JSON.stringify(quinto.errores), /vacío/);
    assert.equal((await estado(c.corrida_id))!.estado, 'fallida', 'al quinto rechazo la corrida tiene que fallar');
    assert.equal(await fila(a.id), undefined, 'un rechazo dejó una fila');

    // Más de 1 MB, y los controles: un HTML normal con estilo, enlaces y palabras parecidas pasa.
    const c2 = await abrir('sales_assistant', a.ghl);
    const grande = await guardar(c2.corrida_id, `<p>${'x'.repeat(1048577)}</p>`);
    assert.match(JSON.stringify(grande.errores), /máximo es 1048576/);
    const bueno = `<html><head><style>.a{color:#333}</style></head><body><section id="donde"><h2>Cuándo y dónde</h2>
      <p>Trabaja online=sí y responde en horario; usa formularios y metadatos. Stack: JavaScript: React y Node.</p>
      <a href="https://instagram.com/agencia" title="Instagram">Instagram</a><img src="https://cdn.ejemplo.pe/logo.png" alt="logo">
      <a href = 'HTTPS://ejemplo.pe/x'>web</a> <a href="mailto:hola@agencia.pe">correo</a> <a href="#fuentes">fuentes</a>
      </section></body></html>`;
    const rb = await guardar(c2.corrida_id, bueno);
    assert.equal(rb.ok, true, JSON.stringify(rb));

    // Lo disfrazado también se rechaza: mayúsculas, el evento pegado a la comilla, el esquema con entidades o con un
    // tabulador adentro, y el SVG con su onload. Una corrida por caso, para no gastar los cinco intentos.
    const disfrazados: Array<[string, RegExp]> = [
      ['<SCRIPT >alert(1)</SCRIPT>', /sin <script>/],
      ['<img src="https://x.pe/a.png"onerror="alert(1)">', /atributos de evento/],
      ['<a href="jav&#x61;script:alert(1)">clic</a>', /sólo con https/],
      ['<a href="java\tscript:alert(1)">clic</a>', /sólo con https/],
      ['<a href=javascript&colon;alert(1)>clic</a>', /sólo con https/],
      ['<svg><set attributeName="href" to="x"/></svg>', /<svg>/],
      ['<img src="/relativa.png">', /sólo con https/],
    ];
    for (const [html, error] of disfrazados) {
      const x = await abrir('sales_assistant', a.ghl);
      const r = await guardar(x.corrida_id, html);
      assert.equal(r.ok, false, `debió rechazar: ${html}`);
      assert.match(JSON.stringify(r.errores), error, html);
    }
  });
});

test('5b · el chequeo del HTML es de la tabla: un UPDATE o un INSERT directo por el MCP tampoco lo saltea', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('d');
    const sa = await abrir('sales_assistant', a.ghl);
    assert.equal((await guardar(sa.corrida_id, '<p>bien</p>')).ok, true);
    await admin.query('savepoint s');
    await assert.rejects(
      admin.query(`update negocio.respuestas_de_los_agentes set brief_ficha_de_cliente_1 = '<script>alert(1)</script>' where contacto_id = $1`, [a.id]),
      (e: { code?: string }) => e.code === '23514');
    await admin.query('rollback to savepoint s');
    // Insertar una fila con una salida adentro no se puede: sólo la fila vacía del lead.
    const b = await unLead('d2');
    await assert.rejects(
      admin.query(`insert into negocio.respuestas_de_los_agentes (org_id, cuenta_id, contacto_id, brief_ficha_de_cliente_1)
                   values ($1, $2, $3, '<p>x</p>')`, [aria.org, aria.cuenta, b.id]),
      (e: { code?: string }) => e.code === '42501');
    await admin.query('rollback to savepoint s');
  });
});

test('6 y 7 · registrar_cuadrante valida, y sin lead en la base no se guarda nada', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('c');
    const t = await abrir('triage', a.ghl);
    const malo = await cuadrante(t.corrida_id, 'urgente', '');
    assert.equal(malo.ok, false);
    assert.match(JSON.stringify(malo.errores), /«urgente» no es uno de prioriza/);
    assert.match(JSON.stringify(malo.errores), /razon: por qué ese cuadrante/);
    assert.equal(await fila(a.id), undefined);

    // Un lead que todavía no llegó a la base (el formulario se acaba de enviar).
    const ghl = `ghl-504-nuevo-${randomUUID().slice(0, 8)}`;
    const t2 = await abrir('triage', ghl);
    const r2 = await cuadrante(t2.corrida_id, 'prioriza', 'factura bien');
    assert.equal(r2.ok, false);
    assert.match(JSON.stringify(r2.errores), /todavía no está en la base/);
    const s = await abrir('sales_assistant', ghl);
    assert.match(JSON.stringify((await guardar(s.corrida_id, '<p>x</p>')).errores), /todavía no está en la base/);
    const l = await leer(s.corrida_id, 'triage_cuadrante_de_clasificacion');
    assert.equal(l.valor, null);
    assert.match(l.motivo, /todavía no está en la base/);
    // Una columna que no existe no se lee.
    await admin.query('savepoint s');
    await assert.rejects(admin.query(`select agentes.leer_respuesta($1, 'contactos')`, [s.corrida_id]), /no es una columna/);
    await admin.query('rollback to savepoint s');
  });
});

test('8 · nadie borra, y sólo se actualizan las columnas de las salidas', async () => {
  const salidas = [...COLUMNAS, 'actualizado_el', 'procedencia'].sort();
  for (const rol of ['agente_mcp', 'app_inquilino']) {
    const r = await unaFila<{ del: boolean; upd: boolean; ins: boolean; columnas: string[] | null; insertables: string[] | null }>(
      admin,
      `select has_table_privilege($1, 'negocio.respuestas_de_los_agentes', 'delete') as del,
              has_table_privilege($1, 'negocio.respuestas_de_los_agentes', 'update') as upd,
              has_table_privilege($1, 'negocio.respuestas_de_los_agentes', 'insert') as ins,
              (select array_agg(a.attname::text order by a.attname) from pg_attribute a
                where a.attrelid = 'negocio.respuestas_de_los_agentes'::regclass and a.attnum > 0 and not a.attisdropped
                  and has_column_privilege($1, a.attrelid, a.attname, 'UPDATE')) as columnas,
              (select array_agg(a.attname::text order by a.attname) from pg_attribute a
                where a.attrelid = 'negocio.respuestas_de_los_agentes'::regclass and a.attnum > 0 and not a.attisdropped
                  and has_column_privilege($1, a.attrelid, a.attname, 'INSERT')) as insertables`,
      [rol],
    );
    assert.equal(r!.del, false, `${rol} no borra`);
    assert.equal(r!.upd, false, `${rol} no actualiza la tabla entera`);
    assert.equal(r!.ins, false, `${rol} no inserta en la tabla entera`);
    assert.deepEqual(r!.columnas, salidas, `${rol} sólo actualiza las salidas`);
    assert.deepEqual(r!.insertables, ['contacto_id', 'cuenta_id', 'org_id'], `${rol} sólo inserta la fila vacía del lead`);
  }
  const publicas = await filas<{ f: string }>(admin,
    `select p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'agentes' and p.proname in ('guardar_respuesta', 'registrar_cuadrante', 'leer_respuesta')
        and (has_function_privilege('public', p.oid, 'execute') or not has_function_privilege('agente_mcp', p.oid, 'execute'))`);
  assert.deepEqual(publicas, [], 'las funciones nuevas: nada para PUBLIC y todo para el rol de los agentes');
});

test('9 · el expediente trae la sección sin el HTML, y la vista para mirar va en el orden del flujo', async () => {
  const orden = await filas<{ column_name: string }>(admin,
    `select column_name from information_schema.columns where table_schema = 'negocio' and table_name = 'respuestas_por_lead'
      order by ordinal_position`);
  const nombres = orden.map((c) => c.column_name);
  assert.deepEqual(nombres.filter((n) => COLUMNAS.includes(n)), COLUMNAS, 'las columnas no van en el orden del flujo');
  const delCatalogo = await filas<{ clave: string }>(admin, `select clave from catalogo.salidas_de_los_agentes order by orden`);
  assert.deepEqual(delCatalogo.map((c) => c.clave), COLUMNAS, 'el catálogo y la tabla no dicen el mismo orden');

  await enUnEnsayo(async () => {
    const a = await unLead('e');
    const t = await abrir('triage', a.ghl);
    assert.equal((await cuadrante(t.corrida_id, 'financia', 'quiere pero necesita financiamiento')).ok, true);
    const sa = await abrir('sales_assistant', a.ghl);
    assert.equal((await guardar(sa.corrida_id, '<section id="resumen">SECRETO-DEL-HTML</section>')).ok, true);

    const ex = await comoInquilino(aria.org, () => unaFila<{ s: any }>(admin,
      `select respuestas_de_los_agentes as s from negocio.expediente_del_lead where contacto_id = $1`, [a.id]));
    assert.ok(ex, 'el inquilino no ve el expediente: ¿la vista perdió security_invoker?');
    assert.equal(ex!.s.triage_cuadrante_de_clasificacion, 'financia');
    assert.deepEqual(Object.keys(ex!.s.procedencia).sort(), ['sales_assistant_ficha_de_lead_1', 'triage_cuadrante_de_clasificacion']);
    assert.ok(!JSON.stringify(ex!.s).includes('SECRETO-DEL-HTML'), 'el expediente trae el HTML entero');
    const porLead = await comoInquilino(aria.org, () => unaFila<Record<string, any>>(admin,
      `select * from negocio.respuestas_por_lead where contacto_id = $1`, [a.id]));
    assert.equal(porLead!.ghl_contact_id, a.ghl);
    assert.equal(cuerpo(porLead!.sales_assistant_ficha_de_lead_1), '<section id="resumen">SECRETO-DEL-HTML</section>');
  });
});
