// EL ESTILO DE LA FICHA DEL LEAD (la migración 120). Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (decisión del usuario del 2026-11-20)
//
// La ficha del lead aprobada pesa unos 23 KB y la mitad es el estilo. El Sales Assistant de GHL se cortaba por el
// largo máximo de su respuesta antes de guardar. Ahora el estilo vive en la base (catalogo.salidas_de_los_agentes.
// envoltura) y el agente manda sólo el contenido de <body>; la celda guarda el documento ENTERO, que n8n convierte en
// PDF tal cual.
//
//   1 · el contenido solo se guarda envuelto: <!DOCTYPE html> + el estilo + el contenido + </body></html>, en la misma
//       celda, en la salida de la corrida y con la marca en la procedencia; los espacios de las puntas no cuentan —
//       mutación: guardar_respuesta que no envuelve;
//   2 · un contenido que trae <!DOCTYPE>, <head>, <body>, <title> o <style> se rechaza diciendo qué mandar — mutación:
//       sin ese rechazo (quedaría un documento con dos estilos);
//   3 · un documento entero (con <html>) se guarda tal cual, como antes de la 120;
//   4 · las reglas del HTML valen para lo que se guarda: un <script> en el contenido se rechaza, y el vacío también;
//   5 · el Sales Coach no tiene envoltura: guarda lo que manda;
//   6 · la envoltura es sólo de columnas HTML y pasa las reglas del HTML (CHECK) — mutación: sin el CHECK.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';

let admin: Client;
let aria: { org: string; cuenta: string };
let ENVOLTURA = '';
const LOC = 'loc-507';
const FIN = '\n</body></html>';

/** Un contenido como el que manda el Sales Assistant: sólo lo de adentro de <body>. */
const CONTENIDO = `<div class="hoja">
  <section class="cabecera" id="cabecera"><div class="quien"><h1>Lead de prueba</h1><p>Agencia &amp; Co</p></div></section>
  <section class="caja" id="del-lead"><h2>Del lead</h2><ul class="intro">
    <li><span>Link de la reunión: <b><a href="https://meet.google.com/aaa-bbbb-ccc">abrir</a></b></span></li></ul></section>
  <section class="caja" id="solidez"><ul class="avance"><li><span>Detectado</span><span>1/1</span><span class="bar"><i style="width:100%"></i></span></li></ul></section>
  <nav class="tabs"><a class="tab on" href="#resumen">Resumen</a></nav>
  <section class="caja" id="resumen"><div class="contenido">Quiere crecer &lt;rápido&gt;.</div></section>
</div>`;

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
  assert.ok(e?.envoltura, 'la ficha 1 no tiene el estilo de la base');
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

async function j(sql: string, params: unknown[] = []): Promise<Record<string, any>> {
  const r = await admin.query<{ r: Record<string, any> }>(sql, params);
  return r.rows[0]!.r;
}

const abrir = (agente: string, ghl: string, sujeto: object = {}) =>
  j(`select agentes.abrir_corrida($1, $2, $3, $4, '{}'::jsonb, null, $5) as r`,
    [agente, LOC, ghl, `${agente}:${ghl}:${randomUUID()}`, sujeto]);

const guardar = (corrida: string, html: string) =>
  j(`select agentes.guardar_respuesta($1, $2) as r`, [corrida, html]);

async function unLead(marca: string): Promise<{ ghl: string; id: string }> {
  const ghl = `ghl-507-${marca}-${randomUUID().slice(0, 8)}`;
  const c = await comoAdmin(() => unaFila<{ id: string }>(admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente)
     values ($1, $2, $3, $4, 'meta') returning id`, [aria.org, aria.cuenta, ghl, `Lead ${marca}`]));
  return { ghl, id: c!.id };
}

const fila = (contacto: string) => comoAdmin(() => unaFila<Record<string, any>>(admin,
  `select * from negocio.respuestas_de_los_agentes where contacto_id = $1`, [contacto]));

const salida = (corrida: string) => comoAdmin(() => unaFila<{ estado: string; salida: any }>(admin,
  `select estado, salida from negocio.corridas_de_agente where id = $1`, [corrida]));

test('1 · el contenido solo se guarda envuelto con el estilo, en la misma celda, entero', async () => {
  assert.match(ENVOLTURA, /^<!DOCTYPE html>/);
  assert.match(ENVOLTURA, /<style>[\s\S]*--accent[\s\S]*<\/style><\/head><body>$/, 'la envoltura no es la plantilla aprobada');
  await enUnEnsayo(async () => {
    const a = await unLead('a');
    const c = await abrir('sales_assistant', a.ghl);
    const r = await guardar(c.corrida_id, `\n  ${CONTENIDO}  \n`);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.con_el_estilo_de_la_base, true);

    const esperado = `${ENVOLTURA}\n${CONTENIDO}${FIN}`;
    const f = await fila(a.id);
    assert.equal(f!.sales_assistant_ficha_de_lead_1, esperado, 'la celda no tiene el documento entero');
    assert.equal(r.bytes, Buffer.byteLength(esperado, 'utf8'));
    assert.equal((f!.sales_assistant_ficha_de_lead_1.match(/<style>/g) ?? []).length, 1);
    assert.equal(f!.procedencia.sales_assistant_ficha_de_lead_1.con_el_estilo_de_la_base, true);
    const s = await salida(c.corrida_id);
    assert.equal(s!.estado, 'lista');
    assert.equal(s!.salida.html, esperado, 'la salida de la corrida no guardó el documento entero');
    const reglas = await comoAdmin(() => unaFila<{ r: unknown }>(admin, `select agentes._reglas_del_html($1) as r`, [esperado]));
    assert.deepEqual(reglas!.r, []);
  });
});

test('2 · un contenido con <!DOCTYPE>, <head>, <body>, <title> o <style> se rechaza diciendo qué mandar', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('b');
    const malos = [
      `<style>.a{color:red}</style>${CONTENIDO}`,
      `<body>${CONTENIDO}</body>`,
      `<head><title>x</title></head>${CONTENIDO}`,
      `<!DOCTYPE html>${CONTENIDO}`,
      `${CONTENIDO}</BODY >`,
    ];
    for (const html of malos) {
      const c = await abrir('sales_assistant', a.ghl);
      const r = await guardar(c.corrida_id, html);
      assert.equal(r.ok, false, `debió rechazar: ${html.slice(0, 40)}`);
      assert.match(JSON.stringify(r.errores), /sólo lo que va dentro de <body>/);
    }
    assert.equal(await fila(a.id), undefined, 'un rechazo dejó una fila');
    // Palabras parecidas no cuentan: <header>, <b>, «estilo», «cuerpo».
    const c = await abrir('sales_assistant', a.ghl);
    const r = await guardar(c.corrida_id, '<header><b>El estilo y el cuerpo del mensaje</b></header>');
    assert.equal(r.ok, true, JSON.stringify(r));
  });
});

test('3 y 4 · un documento entero se guarda tal cual, y las reglas valen para lo que se guarda', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('c');
    const entero = '<!DOCTYPE html><html><head><style>.a{color:#333}</style></head><body><p>entera</p></body></html>';
    const c = await abrir('sales_assistant', a.ghl);
    const r = await guardar(c.corrida_id, entero);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.con_el_estilo_de_la_base, false);
    const f = await fila(a.id);
    assert.equal(f!.sales_assistant_ficha_de_lead_1, entero);
    assert.equal(f!.procedencia.sales_assistant_ficha_de_lead_1.con_el_estilo_de_la_base, undefined);

    const c2 = await abrir('sales_assistant', a.ghl);
    const r2 = await guardar(c2.corrida_id, `${CONTENIDO}<script>alert(1)</script>`);
    assert.equal(r2.ok, false);
    assert.match(JSON.stringify(r2.errores), /sin <script>/);
    const r3 = await guardar(c2.corrida_id, '  \n ');
    assert.equal(r3.ok, false);
    assert.match(JSON.stringify(r3.errores), /vacío/);
    assert.equal((await fila(a.id))!.sales_assistant_ficha_de_lead_1, entero, 'un rechazo pisó la ficha');
  });
});

test('5 · el Sales Coach no tiene envoltura: guarda lo que manda', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('d');
    const ll = await j(`select agentes.registrar_llamada($1, $2, $3, 'venta', 'ghl', 'Lead: lo pienso.') as r`,
      [LOC, a.ghl, `grab-${a.ghl}`]);
    const sc = await abrir('sales_coach', a.ghl, { llamada_id: ll.llamada_id });
    const r = await guardar(sc.corrida_id, '<section id="analisis">Ficha 2</section>');
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.con_el_estilo_de_la_base, false);
    assert.equal((await fila(a.id))!.sales_coach_ficha_de_lead_2, '<section id="analisis">Ficha 2</section>');
  });
});

test('6 · la envoltura es sólo de columnas HTML y pasa las reglas del HTML', async () => {
  const conEnvoltura = await unaFila<{ claves: string[] }>(admin,
    `select array_agg(clave::text order by orden) as claves from catalogo.salidas_de_los_agentes where envoltura is not null`);
  assert.deepEqual(conEnvoltura!.claves, ['sales_assistant_ficha_de_lead_1']);

  const intentar = async (sql: string): Promise<string | null> => {
    await admin.query('begin');
    try {
      await admin.query(sql);
      return null;
    } catch (e) {
      return (e as { code?: string }).code ?? 'sin código';
    } finally {
      await admin.query('rollback');
    }
  };
  assert.equal(await intentar(`update catalogo.salidas_de_los_agentes set envoltura = '<!DOCTYPE html><html><head></head><body>'
    where clave = 'triage_cuadrante_de_clasificacion'`), '23514', 'el cuadrante aceptó una envoltura');
  assert.equal(await intentar(`update catalogo.salidas_de_los_agentes
    set envoltura = '<!DOCTYPE html><html><head><script>alert(1)</script></head><body>'
    where clave = 'sales_assistant_ficha_de_lead_1'`), '23514', 'la envoltura aceptó un <script>');
  assert.equal(await intentar(`update catalogo.salidas_de_los_agentes set envoltura = '<p>no es un comienzo</p>'
    where clave = 'sales_assistant_ficha_de_lead_1'`), '23514', 'la envoltura aceptó algo que no es un comienzo de documento');
  assert.equal(await intentar(`update catalogo.salidas_de_los_agentes set envoltura = '<!DOCTYPE html><html><head></head><body>'
    where clave = 'sales_coach_ficha_de_lead_2'`), null, 'una envoltura buena no se pudo poner');
});
