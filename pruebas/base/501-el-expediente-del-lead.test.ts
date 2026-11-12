// EL EXPEDIENTE DEL LEAD (la migración 115). Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (MANAGED-AGENTS-CORRECCION-DATOS-POR-LEAD.md § 6, decisiones del usuario del 2026-11-11)
//
// Todo pasa en la cuenta de ARIA, sobre leads que NO compraron. Lo que producen los agentes es del lead, y guardarlo no
// dispara nada. Con dos leads A y B (y 50 más generados):
//
//   1 · miles de entregables sin choque: registrar los de B no cambia ninguna versión vigente de A — mutación: volver a
//       «un entregable por cuenta»;
//   2 · lectura sólo del lead: ningún paquete leer_* de A (también el del Sales Coach) contiene un id o una marca de B,
//       aunque B tenga además lo que trae GHL (un mensaje, una cita, una llamada con transcripción, un Triage y un Sales
//       Coach) — mutación: quitar el filtro por contacto en _leer_del_cliente o en leer_brief;
//   3 · escritura sólo del lead: cada fila escrita sobre A lleva el contacto de A;
//   4 · el conocimiento de la cuenta (ICP de ARIA, matriz, script, manual, rutas) no cambia al aprobar el ICP de A y B —
//       mutación: volver a publicar el ICP en _al_aprobar;
//   5 · un conocimiento con origen «entregable» se rechaza en la base;
//   6 · aprobar y corregir las versiones de A no cambia ninguna fila de B ni de la cuenta;
//  6b · «desactualizado» se calcula al leer y sólo con lo que el entregable DEPENDE (depende_de), sin contarse a sí mismo
//       — mutación: quitar el join con depende_de o el `d.id <> e.id` de entregable_vigente;
//   7 · los cuatro agentes del cliente corren sobre leads que no compraron;
//   8 · los agentes del cliente no leen el conocimiento de la cuenta;
//   9 · una salida que nombra otro lead (contact_id o correo) se rechaza;
//  10 · el expediente de A es una fila con lo que llenaron los agentes y nada de B (tampoco lo que B trae de GHL);
//  11 · el Triage sin el contacto todavía se vincula al llegar (también en la 500);
//   y agentes.buscar_contacto: una coincidencia, ninguna, varias; la corrida guarda identificado_por.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';

let admin: Client;
let aria: { org: string; cuenta: string; persona: string };
const LOC = 'loc-501';

before(async () => {
  admin = await conectar('admin');
  const a = await unaFila<{ org: string; cuenta: string; persona: string }>(
    admin,
    `select o.id as org, c.id as cuenta, (select u.id from identidad.usuarios u where u.org_id = o.id order by u.id limit 1) as persona
       from identidad.organizaciones o join identidad.cuentas c on c.org_id = o.id and c.es_por_omision where o.es_principal`,
  );
  assert.ok(a && a.persona, 'falta el sembrado');
  aria = a;
});

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

async function enUnEnsayo(preparar: () => Promise<void>, comoElMcp: () => Promise<void>): Promise<void> {
  await admin.query('begin');
  try {
    await admin.query(`do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'mcp_simulado') then
        create role mcp_simulado nologin nosuperuser bypassrls;
      end if; end $$`);
    await admin.query('grant agente_mcp, pg_read_all_data to mcp_simulado');
    await admin.query(`update identidad.cuentas set crm_cuenta_id = $2 where id = $1`, [aria.cuenta, LOC]);
    await preparar();
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

async function fallaCon(codigo: string, sql: string, params: unknown[] = []): Promise<void> {
  await admin.query('savepoint s');
  try {
    await admin.query(sql, params);
    assert.fail(`debió fallar con ${codigo}: ${sql}`);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.message?.startsWith('debió fallar')) throw e;
    assert.equal(err.code, codigo, err.message);
  } finally {
    await admin.query('rollback to savepoint s');
  }
}

/** Un lead de ARIA que no compró, con su formulario y su correo. */
async function unLead(ghl: string, correo: string): Promise<string> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente, email)
     values ($1, $2, $3, 'Lead 501', 'meta', $4) returning id`,
    [aria.org, aria.cuenta, ghl, correo],
  );
  await admin.query(
    `insert into negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, pregunta, origen_clave, valor_texto, proveedor, obtenida_por, observada_el)
     values ($1, $2, $3, 'facturacion_mensual', 'contact.facturacion', $4, 'ghl', 'formulario', now())`,
    [aria.org, aria.cuenta, c!.id, `factura 8 mil (${ghl})`],
  );
  return c!.id;
}

type Expediente = { lead: string; brief: string; seg: string; dec: string; icp: string; anuncios: string; fuente: string };

/** Todo lo de un lead, de punta a punta, como el MCP. La marca va en cada texto para buscarla después. */
async function armarExpediente(ghl: string, marca: string, aprobar = true): Promise<Expediente> {
  const lead = (await unaFila<{ id: string }>(admin, `select id from negocio.contactos where ghl_contact_id = $1`, [ghl]))!.id;
  const abrir = (agente: string, clave: string, sujeto: object = {}) =>
    j(`select agentes.abrir_corrida($1, $2, $3, $4, '{}', null, $5) as r`, [agente, LOC, ghl, `${clave}-${ghl}`, sujeto]);
  // Las etapas previas se aprueban siempre (cada una exige la anterior DEL MISMO LEAD); con aprobar = false, la última
  // pieza (los anuncios) queda propuesta.
  const aprobada = async (version: string) => {
    await j(`select agentes.decidir_entregable($1, 'aprobada', $2) as r`, [version, aria.persona]);
  };

  const b = await abrir('brief', 'b');
  await j(`select agentes.leer_brief($1) as r`, [b.corrida_id]);
  const vb = await j(`select agentes.registrar_brief($1, $2) as r`, [b.corrida_id, {
    respuestas: [{ pregunta: 'facturacion_mensual', estado: 'detectado', valor: `8 mil ${marca}`, fuente: 'formulario:facturacion_mensual', cita: 'factura 8 mil' }],
  }]);
  assert.equal(vb.ok, true, JSON.stringify(vb));

  const s = await abrir('research', 's', { paso: 'mr_segmentos' });
  await j(`select agentes.leer_research($1) as r`, [s.corrida_id]);
  const pub = await j(`select agentes.registrar_fuente_publica($1, 'foro', $2) as r`, [s.corrida_id, `Nadie me atiende rápido ${marca}`]);
  const vs = await j(`select agentes.registrar_research($1, $2) as r`, [s.corrida_id, {
    texto: `# Segmentos ${marca}`, segmentos: [{ nombre: `Segmento ${marca}` }],
    citas: [{ texto: `Nadie me atiende rápido ${marca}`, fuente: pub.fuente, segmento: `Segmento ${marca}` }],
  }]);
  assert.equal(vs.ok, true, JSON.stringify(vs));
  await aprobada(vs.version_id);

  const d = await abrir('research', 'd', { paso: 'mr_decision' });
  await j(`select agentes.leer_research($1) as r`, [d.corrida_id]);
  const vd = await j(`select agentes.registrar_research($1, $2) as r`, [d.corrida_id, { texto: `# Decisión ${marca}`, segmento_elegido: `Segmento ${marca}` }]);
  await aprobada(vd.version_id);

  await j(`select agentes.registrar_decisiones_de_kickoff($1, $2, 'coach') as r`, [lead, JSON.stringify([{ sobre: 'segmento', decision: `Kickoff ${marca}` }])]);

  const e1 = await abrir('estratega', 'e1', { etapa: 'icp' });
  await j(`select agentes.leer_estratega($1) as r`, [e1.corrida_id]);
  const vi = await j(`select agentes.registrar_estratega($1, $2) as r`, [e1.corrida_id, { texto: `# ICP ${marca}`, contenido: { a_quien_si: [{ criterio: `ICP ${marca}` }], a_quien_no: [] } }]);
  assert.equal(vi.ok, true, JSON.stringify(vi));
  await aprobada(vi.version_id);
  for (const [etapa, contenido] of [
    ['categoria_y_oferta', { categoria: { nombre: `Cat ${marca}` }, mecanismo: { nombre: 'm' }, oferta: { promesa: 'p' } }],
    ['precio_y_process_map', { precio: { monto: 2000, moneda: 'USD' }, metodo: { fases: [{ nombre: `Fase ${marca}` }] } }],
  ] as const) {
    const c = await abrir('estratega', etapa, { etapa });
    await j(`select agentes.leer_estratega($1) as r`, [c.corrida_id]);
    const v = await j(`select agentes.registrar_estratega($1, $2) as r`, [c.corrida_id, { texto: `# ${etapa} ${marca}`, contenido }]);
    assert.equal(v.ok, true, JSON.stringify(v));
    await aprobada(v.version_id);
  }
  const f = await abrir('funnel_builder', 'f', { pieza: 'anuncios' });
  await j(`select agentes.leer_funnel_builder($1) as r`, [f.corrida_id]);
  const va = await j(`select agentes.registrar_funnel_builder($1, $2) as r`, [f.corrida_id, {
    texto: `# Anuncios ${marca}`, variantes: [{ codigo_de_nomenclatura: `AD_${marca}`, titular: `Titular ${marca}` }],
  }]);
  assert.equal(va.ok, true, JSON.stringify(va));
  if (aprobar) await aprobada(va.version_id);
  return { lead, brief: vb.version_id, seg: vs.version_id, dec: vd.version_id, icp: vi.version_id, anuncios: va.version_id, fuente: pub.fuente_publica_id };
}

/** Los ids y marcas de un expediente: lo que no puede aparecer en lo que se lee del otro. El ghl_contact_id también va
 *  en su formulario («factura 8 mil (ghl-…)»), así que un paquete que traiga el formulario del otro lead se delata. */
async function huellasDe(lead: string, marca: string, ghl: string): Promise<string[]> {
  const r = await admin.query<{ id: string }>(
    `select id::text from negocio.entregables where contacto_id = $1
     union all select id::text from negocio.versiones_de_entregable where contacto_id = $1
     union all select id::text from negocio.fuentes_publicas where contacto_id = $1
     union all select id::text from negocio.segmentos_del_mercado where contacto_id = $1
     union all select id::text from negocio.citas_del_mercado where contacto_id = $1
     union all select id::text from negocio.decisiones_de_kickoff where contacto_id = $1
     union all select id::text from negocio.corridas_de_agente where contacto_id = $1`,
    [lead],
  );
  return [lead, marca, ghl, ...r.rows.map((x) => x.id)];
}

/** Lo que GHL trae de un lead, además de lo de los agentes del cliente. El mensaje y la cita los escribe el superusuario
 *  (en la preparación); la llamada, el Triage y el Sales Coach, el MCP. Devuelven los ids, para sumarlos a sus huellas. */
async function mensajeYCita(lead: string, marca: string): Promise<string[]> {
  const m = await unaFila<{ id: string }>(admin,
    `insert into negocio.mensajes (org_id, cuenta_id, contacto_id, ghl_mensaje_id, canal, direccion, autor, cuerpo, enviado_el)
     values ($1, $2, $3, $4, 'whatsapp', 'entrante', 'contacto', $5, now() - interval '1 hour') returning id`,
    [aria.org, aria.cuenta, lead, `msg-${marca}`, `Hola, quiero saber el precio ${marca}`]);
  const c = await unaFila<{ id: string }>(admin,
    `insert into negocio.citas (org_id, cuenta_id, contacto_id, ghl_evento_id, titulo, inicio_el)
     values ($1, $2, $3, $4, $5, now() + interval '1 day') returning id`,
    [aria.org, aria.cuenta, lead, `ev-${marca}`, `Llamada ${marca}`]);
  return [m!.id, c!.id];
}

async function llamadaTriageYCoach(ghl: string, marca: string): Promise<string[]> {
  const l = await j(`select agentes.registrar_llamada($1, $2, $3, 'venta', 'ghl', $4) as r`,
    [LOC, ghl, `llamada-${marca}`, `Lead ${marca}: me interesa, pero lo pienso.`]);
  const t = await j(`select agentes.abrir_corrida('triage', $1, $2, $3) as r`, [LOC, ghl, `t-${marca}`]);
  await j(`select agentes.leer_triage($1) as r`, [t.corrida_id]);
  const tr = await j(`select agentes.registrar_triage($1, $2) as r`, [t.corrida_id, {
    prioridad: 4, ruta_clase: 'alto_ticket', confianza: 'media',
    razones: [{ campo: 'facturacion_mensual', estado: 'detectado', valor: `8 mil ${marca}`, fuente: 'formulario:facturacion_mensual', cita: 'factura 8 mil' }],
  }]);
  assert.equal(tr.ok, true, JSON.stringify(tr));
  const sc = await j(`select agentes.abrir_corrida('sales_coach', $1, $2, $3, '{}', null, $4) as r`, [LOC, ghl, `sc-${marca}`, { llamada_id: l.llamada_id }]);
  await j(`select agentes.leer_sales_coach($1) as r`, [sc.corrida_id]);
  const s = await j(`select agentes.registrar_sales_coach($1, $2) as r`, [sc.corrida_id, {
    resultado: { compro: false, salida: 'seguimiento', confianza: 'media', next_steps: [{ accion: `llamar de nuevo ${marca}`, responsable: 'closer' }] },
    objeciones: [{ categoria: 'momento', texto: 'lo pienso', resuelta: false }],
  }]);
  assert.equal(s.ok, true, JSON.stringify(s));
  return [l.llamada_id, l.transcripcion_id, tr.triaje_id, s.resultado_propuesto_id];
}

test('1 · miles de entregables sin choque: los de B no cambian ninguna versión vigente de A (y 50 leads más)', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-501-a', 'a@501.test');
      await unLead('ghl-501-b', 'b@501.test');
      for (let i = 0; i < 50; i += 1) await unLead(`ghl-501-n${i}`, `n${i}@501.test`);
    },
    async () => {
      const a = await armarExpediente('ghl-501-a', 'MARCA_A');
      const vigentesA = await admin.query(`select tipo, version_id from negocio.entregable_vigente where contacto_id = $1 order by tipo`, [a.lead]);
      await armarExpediente('ghl-501-b', 'MARCA_B');
      const despues = await admin.query(`select tipo, version_id from negocio.entregable_vigente where contacto_id = $1 order by tipo`, [a.lead]);
      assert.deepEqual(despues.rows, vigentesA.rows);
      assert.equal(vigentesA.rows.length, 7, 'brief, mr_segmentos, mr_decision, icp, categoria_y_oferta, precio_y_process_map, anuncios');
      for (let i = 0; i < 50; i += 1) {
        const c = await j(`select agentes.abrir_corrida('brief', $1, $2, $3) as r`, [LOC, `ghl-501-n${i}`, `bn${i}`]);
        await j(`select agentes.leer_brief($1) as r`, [c.corrida_id]);
        const v = await j(`select agentes.registrar_brief($1, '{"respuestas": [{"pregunta": "meta_a_6_meses", "estado": "vacio"}]}') as r`, [c.corrida_id]);
        assert.equal(v.ok, true);
      }
      const briefs = await unaFila<{ n: string; leads: string; v1: string }>(admin,
        `select count(*) as n, count(distinct contacto_id) as leads,
                count(*) filter (where (select numero from negocio.versiones_de_entregable v where v.id = e.version_vigente_id) = 1) as v1
           from negocio.entregables e where e.cuenta_id = $1 and e.tipo = 'brief'`, [aria.cuenta]);
      assert.deepEqual([Number(briefs!.n), Number(briefs!.leads), Number(briefs!.v1)], [52, 52, 52]);
    },
  );
});

test('2 y 3 · lectura y escritura sólo del lead: ningún paquete de A trae nada de B, y todo lo escrito sobre A es de A', async () => {
  let deGhlB: string[] = [];
  await enUnEnsayo(
    async () => {
      await unLead('ghl-501-a', 'a@501.test');
      deGhlB = await mensajeYCita(await unLead('ghl-501-b', 'b@501.test'), 'MARCA_B');
    },
    async () => {
      deGhlB.push(...await llamadaTriageYCoach('ghl-501-b', 'MARCA_B'));
      assert.equal(deGhlB.filter(Boolean).length, 6, 'faltan ids de lo que B trae de GHL');
      const b = await armarExpediente('ghl-501-b', 'MARCA_B');
      const a = await armarExpediente('ghl-501-a', 'MARCA_A', false);
      const deB = [...await huellasDe(b.lead, 'MARCA_B', 'ghl-501-b'), ...deGhlB];
      // El Sales Coach de A lee una llamada de A.
      const la = await j(`select agentes.registrar_llamada($1, 'ghl-501-a', 'llamada-a', 'venta', 'ghl', 'Lead A: me interesa.') as r`, [LOC]);
      const paquetes: [string, object][] = [];
      for (const [agente, clave, sujeto] of [
        ['brief', 'lb', {}], ['research', 'lr', { paso: 'mr_dolores' }], ['estratega', 'le', { etapa: 'categoria_y_oferta' }],
        ['funnel_builder', 'lf', { pieza: 'guion_vsl' }], ['triage', 'lt', {}], ['sales_assistant', 'ls', {}],
        ['sales_coach', 'lc', { llamada_id: la.llamada_id }],
      ] as const) {
        const c = await j(`select agentes.abrir_corrida($1, $2, 'ghl-501-a', $3, '{}', null, $4) as r`, [agente, LOC, clave, sujeto]);
        paquetes.push([agente, await j(`select agentes.leer_${agente}($1) as r`, [c.corrida_id])]);
      }
      const exp = await j(`select agentes.expediente((select id from negocio.corridas_de_agente where contacto_id = $1 limit 1)) as r`, [a.lead]);
      paquetes.push(['expediente', exp]);
      for (const [agente, paquete] of paquetes) {
        const texto = JSON.stringify(paquete);
        for (const h of deB) assert.ok(!texto.includes(h), `el paquete de ${agente} de A contiene «${h}» de B`);
        // Control positivo: el paquete SÍ trae lo de A (si viniera vacío, la ausencia de B no probaría nada).
        const deA = ['triage', 'sales_assistant', 'sales_coach'].includes(agente) ? 'factura 8 mil (ghl-501-a)' : 'MARCA_A';
        assert.ok(texto.includes(deA), `el paquete de ${agente} de A no trae «${deA}»`);
      }
      // P-1: el Sales Assistant ya no recibe el conteo de objeciones de toda la cuenta.
      const sa = paquetes.find(([agente]) => agente === 'sales_assistant')![1];
      assert.ok(!JSON.stringify(sa).includes('objeciones_frecuentes'), 'leer_sales_assistant trae objeciones_frecuentes');
      // 3 · cada fila escrita sobre las corridas de A es de A.
      for (const t of ['entregables', 'versiones_de_entregable', 'respuestas_del_brief', 'segmentos_del_mercado', 'citas_del_mercado',
        'decisiones_de_kickoff', 'piezas_de_contenido', 'fuentes_publicas']) {
        const r = await unaFila<{ de_a: string; ajenas: string }>(admin,
          `select count(*) filter (where contacto_id = $1) as de_a, count(*) filter (where contacto_id not in ($1, $2)) as ajenas from negocio.${t}`,
          [a.lead, b.lead]);
        assert.ok(Number(r!.de_a) > 0, `${t}: nada de A`);
        assert.equal(Number(r!.ajenas), 0, `${t}: filas que no son ni de A ni de B`);
      }
      const corridasA = await unaFila<{ n: string }>(admin,
        `select count(*) as n from negocio.versiones_de_entregable v join negocio.corridas_de_agente c on c.id = v.corrida_id
          where c.contacto_id = $1 and v.contacto_id <> $1`, [a.lead]);
      assert.equal(Number(corridasA!.n), 0);
      // Las referencias internas tampoco cruzan: una cita de A no puede apuntar al segmento ni a la evidencia de B.
      await admin.query('reset role');
      const segB = (await unaFila<{ id: string }>(admin, `select id from negocio.segmentos_del_mercado where contacto_id = $1 limit 1`, [b.lead]))!.id;
      await fallaCon('23503', `update negocio.citas_del_mercado set segmento_id = $2 where contacto_id = $1`, [a.lead, segB]);
      await fallaCon('23503', `update negocio.citas_del_mercado set fuente_publica_id = $2 where contacto_id = $1`, [a.lead, b.fuente]);
      await admin.query('set local role mcp_simulado');
    },
  );
});

test('4, 5 y 8 · el conocimiento de la cuenta no cambia, la base rechaza el de un entregable, y los agentes del cliente no lo leen', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-501-a', 'a@501.test');
      await unLead('ghl-501-b', 'b@501.test');
      for (const tipo of ['icp', 'matriz_de_scoring', 'script_de_ventas', 'manual_de_objeciones']) {
        await admin.query(`select agentes.cargar_conocimiento($1, $2, '{"de": "ARIA"}', $3, true, $4)`, [aria.cuenta, tipo, `# ${tipo} de ARIA`, aria.persona]);
      }
      await admin.query(`select agentes.cargar_rutas($1, '[{"clave": "accelerator", "nombre": "Accelerator", "clase": "alto_ticket"}]', $2)`, [aria.cuenta, aria.persona]);
    },
    async () => {
      const foto = async () => (await unaFila<{ h: string }>(admin,
        `select md5(coalesce((select string_agg(tipo || version || contenido::text || coalesce(contenido_texto, ''), '|' order by tipo)
                                from negocio.conocimiento_vigente where cuenta_id = $1), '') ||
                    coalesce((select string_agg(clave || nombre || clase, '|' order by clave) from negocio.rutas_de_la_cuenta where cuenta_id = $1), '')) as h`,
        [aria.cuenta]))!.h;
      const antes = await foto();
      await armarExpediente('ghl-501-a', 'MARCA_A');
      await armarExpediente('ghl-501-b', 'MARCA_B');
      assert.equal(await foto(), antes, 'el conocimiento de la cuenta cambió');
      // 5 · la base rechaza un conocimiento que venga de un entregable, aunque lo intente el superusuario.
      await admin.query('reset role');
      await fallaCon('23514', `insert into negocio.conocimiento_de_la_cuenta (org_id, cuenta_id, tipo, version, contenido, origen)
                               values ($1, $2, 'icp', 99, '{"x": 1}', 'entregable')`, [aria.org, aria.cuenta]);
      await admin.query('set local role mcp_simulado');
      // 8 · los paquetes de los agentes del cliente no traen conocimiento de la cuenta.
      for (const [agente, sujeto] of [['brief', {}], ['research', { paso: 'mr_precio' }], ['estratega', { etapa: 'icp' }], ['funnel_builder', { pieza: 'prompt_landing' }]] as const) {
        const c = await j(`select agentes.abrir_corrida($1, $2, 'ghl-501-a', $3, '{}', null, $4) as r`, [agente, LOC, `k-${agente}`, sujeto]);
        const p = await j(`select agentes.leer_${agente}($1) as r`, [c.corrida_id]);
        const claves = Object.keys(p.fuentes ?? {});
        assert.deepEqual(claves.filter((k) => k.startsWith('conocimiento:')), [], `${agente} leyó conocimiento de la cuenta`);
        assert.ok(!JSON.stringify(p).includes('de ARIA'), `${agente} trae el ICP o el script de ARIA`);
        // Y si lo pide directo, tampoco.
        const k = await j(`select agentes.leer_conocimiento($1) as r`, [c.corrida_id]);
        assert.deepEqual([k.conocimiento, k.fuentes], [{}, {}], `${agente} recibió conocimiento con leer_conocimiento`);
        // Aunque lo tuviera en lo leído, no le sirve como fuente de una cita.
        await admin.query('reset role');
        const t = await unaFila<{ t: string | null }>(admin,
          `select agentes._texto_de_la_fuente(c, 'conocimiento:icp') as t from negocio.corridas_de_agente c where c.id = $1`, [c.corrida_id]);
        await admin.query(`update negocio.corridas_de_agente set leido = jsonb_build_object('fuentes', jsonb_build_object('conocimiento:icp', '# icp de ARIA')) where id = $1`, [c.corrida_id]);
        const t2 = await unaFila<{ t: string | null }>(admin,
          `select agentes._texto_de_la_fuente(c, 'conocimiento:icp') as t from negocio.corridas_de_agente c where c.id = $1`, [c.corrida_id]);
        assert.deepEqual([t!.t, t2!.t], [null, null], `${agente} podría citar el conocimiento de la cuenta`);
        await admin.query('set local role mcp_simulado');
      }
      // Control: el Triage (agente de la cuenta) sí lo lee.
      const tr = await j(`select agentes.abrir_corrida('triage', $1, 'ghl-501-a', 'k-triage') as r`, [LOC]);
      const kt = await j(`select agentes.leer_conocimiento($1) as r`, [tr.corrida_id]);
      assert.match(JSON.stringify(kt), /icp de ARIA/);
    },
  );
});

test('6 · aprobar y corregir lo de A no cambia nada de B ni de la cuenta', async () => {
  await enUnEnsayo(
    async () => {
      // Los dos tienen su venta: así el envío del Brief de A tiene dónde copiar «a quién vende», y se ve que no toca la de B.
      for (const [ghl, correo, quien] of [['ghl-501-a', 'a@501.test', null], ['ghl-501-b', 'b@501.test', 'consumidores']] as const) {
        const id = await unLead(ghl, correo);
        await admin.query(`insert into negocio.clientes (org_id, cuenta_id, contacto_id, a_quien_vende) values ($1, $2, $3, $4)`,
          [aria.org, aria.cuenta, id, quien]);
      }
    },
    async () => {
      // B también queda con una pieza PROPUESTA: si una decisión sobre A se escapara de su lead, la aprobaría.
      const b = await armarExpediente('ghl-501-b', 'MARCA_B', false);
      const a = await armarExpediente('ghl-501-a', 'MARCA_A', false);
      const fotoDe = async () => (await unaFila<{ h: string }>(admin,
        `select md5(concat_ws('|',
           (select string_agg(id || estado || coalesce(version_aprobada_id::text, '') || coalesce(version_vigente_id::text, ''), ',' order by id) from negocio.entregables where contacto_id = $1),
           (select string_agg(id || estado, ',' order by id) from negocio.versiones_de_entregable where contacto_id = $1),
           (select string_agg(tipo || desactualizado::text, ',' order by tipo) from negocio.entregable_vigente where contacto_id = $1),
           (select string_agg(id || coalesce(elegido::text, ''), ',' order by id) from negocio.segmentos_del_mercado where contacto_id = $1),
           (select string_agg(id || estado, ',' order by id) from negocio.piezas_de_contenido where contacto_id = $1),
           (select string_agg(id || estado || coalesce(terminada_el::text, '') || coalesce(reemplazada_por::text, ''), ',' order by id) from negocio.corridas_de_agente where contacto_id = $1),
           (select string_agg(id || estado || coalesce(a_quien_vende, ''), ',' order by id) from negocio.clientes where contacto_id = $1),
           (select count(*)::text from negocio.clientes), (select count(*)::text from negocio.conocimiento_de_la_cuenta),
           (select count(*)::text from identidad.organizaciones), (select count(*)::text from identidad.cuentas))) as h`, [b.lead]))!.h;
      const antes = await fotoDe();
      await j(`select agentes.decidir_entregable($1, 'aprobada', $2) as r`, [a.anuncios, aria.persona]);
      await j(`select agentes.decidir_entregable($1, 'corregida', $2, 'x', '{"a_quien_si": [{"criterio": "otro"}], "a_quien_no": []}') as r`, [a.icp, aria.persona]);
      await j(`select agentes.decidir_entregable($1, 'corregida', $2, 'x', null, '# Segmentos corregidos') as r`, [a.seg, aria.persona]);
      const e = await j(`select agentes.responder_brief($1, '[{"pregunta": "facturacion_mensual", "valor": "9 mil"}, {"pregunta": "a_quien_vende", "valor": "negocios"}]', true, $2) as r`, [a.lead, aria.persona]);
      assert.equal(e.enviado, true, JSON.stringify(e));
      assert.equal(await fotoDe(), antes, 'lo de A cambió algo de B o de la cuenta');
      // Control positivo: lo de A sí cambió (la venta de A recibió «a quién vende» y su ICP corregido desactualiza la oferta).
      const deA = await unaFila<{ quien: string; oferta: boolean }>(admin,
        `select (select a_quien_vende from negocio.clientes where contacto_id = $1) as quien,
                (select desactualizado from negocio.entregable_vigente where contacto_id = $1 and tipo = 'categoria_y_oferta') as oferta`, [a.lead]);
      assert.deepEqual(deA, { quien: 'negocios', oferta: true });
    },
  );
});

test('6b · «desactualizado» sólo mira de qué depende: rehacer una pieza aprobada no la marca, y corregir algo ajeno tampoco', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-501-a', 'a@501.test');
    },
    async () => {
      const a = await armarExpediente('ghl-501-a', 'MARCA_A');
      const desact = async () => Object.fromEntries((await admin.query<{ tipo: string; d: boolean }>(
        `select tipo, desactualizado as d from negocio.entregable_vigente where contacto_id = $1`, [a.lead])).rows.map((r) => [r.tipo, r.d]));
      assert.ok(Object.values(await desact()).every((d) => d === false), 'recién armado, nada está desactualizado');
      // Corregir la decisión del Research. El Estratega LEE mr_decision en todas sus etapas, pero sólo el ICP depende de
      // ella (catalogo.tipos_de_entregable.depende_de): la oferta y el precio no quedan desactualizados.
      await j(`select agentes.decidir_entregable($1, 'corregida', $2, 'x', null, '# Decisión corregida') as r`, [a.dec, aria.persona]);
      let d = await desact();
      assert.deepEqual([d.icp, d.categoria_y_oferta, d.precio_y_process_map, d.anuncios], [true, false, false, false],
        'sólo lo que DEPENDE de mr_decision queda desactualizado');
      // Rehacer el ICP (la corrida lee el ICP aprobado anterior) y aprobar el nuevo: no queda desactualizado por su propia
      // versión anterior, y lo que depende de él, sí.
      const e = await j(`select agentes.abrir_corrida('estratega', $1, 'ghl-501-a', 'e1-bis', '{}', null, '{"etapa": "icp"}') as r`, [LOC]);
      await j(`select agentes.leer_estratega($1) as r`, [e.corrida_id]);
      const v2 = await j(`select agentes.registrar_estratega($1, $2) as r`, [e.corrida_id, {
        texto: '# ICP v2 MARCA_A', contenido: { a_quien_si: [{ criterio: 'ICP v2' }], a_quien_no: [] },
      }]);
      assert.equal(v2.ok, true, JSON.stringify(v2));
      const fuentesV2 = await unaFila<{ f: Record<string, string> }>(admin, `select fuentes as f from negocio.versiones_de_entregable where id = $1`, [v2.version_id]);
      assert.equal(fuentesV2!.f.icp, a.icp, 'la versión nueva del ICP registra que leyó la anterior (si no, esta prueba no prueba nada)');
      await j(`select agentes.decidir_entregable($1, 'aprobada', $2) as r`, [v2.version_id, aria.persona]);
      d = await desact();
      assert.deepEqual([d.icp, d.categoria_y_oferta, d.precio_y_process_map, d.anuncios], [false, true, true, true]);
    },
  );
});

test('7 y 9 · los cuatro agentes del cliente corren sobre leads que no compraron; una salida con otro lead se rechaza', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-501-a', 'a@501.test');
      await unLead('ghl-501-b', 'b@501.test');
    },
    async () => {
      const clientes = await unaFila<{ n: string }>(admin, `select count(*) as n from negocio.clientes`);
      assert.equal(Number(clientes!.n), 0);
      for (const [agente, sujeto] of [['brief', {}], ['research', { paso: 'mr_segmentos' }], ['estratega', { etapa: 'icp' }], ['funnel_builder', { pieza: 'anuncios' }]] as const) {
        const c = await j(`select agentes.abrir_corrida($1, $2, 'ghl-501-a', $3, '{}', null, $4) as r`, [agente, LOC, `s-${agente}`, sujeto]);
        assert.equal(c.ok, true, agente);
        assert.equal(c.cuenta_id, aria.cuenta, agente);
        assert.ok(c.contacto_id, agente);
      }
      const b = await j(`select agentes.abrir_corrida('brief', $1, 'ghl-501-a', 'otro-1') as r`, [LOC]);
      await j(`select agentes.leer_brief($1) as r`, [b.corrida_id]);
      const base = { respuestas: [{ pregunta: 'facturacion_mensual', estado: 'vacio' }] };
      const loDelOtro = [{ contact_id: 'ghl-501-b' }, { ghl_contact_id: 'ghl-501-b' }, { correo: 'b@501.test' }];
      for (const otro of loDelOtro) {
        const r = await j(`select agentes.registrar_brief($1, $2) as r`, [b.corrida_id, { ...base, ...otro }]);
        assert.equal(r.ok, false, JSON.stringify(otro));
        assert.match(JSON.stringify(r), /nombra otro/, `rechazado por otra razón: ${JSON.stringify(r)}`);
      }
      // 9 · lo mismo en los demás registrar_: el rechazo es POR el otro lead, no por otro error de la salida.
      const contactoB = (await unaFila<{ id: string }>(admin, `select id from negocio.contactos where ghl_contact_id = 'ghl-501-b'`))!.id;
      for (const [agente, sujeto] of [['research', { paso: 'mr_segmentos' }], ['estratega', { etapa: 'icp' }], ['funnel_builder', { pieza: 'anuncios' }],
        ['triage', {}], ['sales_assistant', {}]] as const) {
        const c = await j(`select agentes.abrir_corrida($1, $2, 'ghl-501-a', $3, '{}', null, $4) as r`, [agente, LOC, `o-${agente}`, sujeto]);
        await j(`select agentes.leer_${agente}($1) as r`, [c.corrida_id]);
        for (const otro of [...loDelOtro, { contacto_id: contactoB }]) {
          const r = await j(`select agentes.registrar_${agente}($1, $2) as r`, [c.corrida_id, { texto: 'x', ...otro }]);
          assert.equal(r.ok, false, `${agente} ${JSON.stringify(otro)}`);
          assert.match(JSON.stringify(r), /nombra otro/, `${agente}: rechazado por otra razón: ${JSON.stringify(r)}`);
        }
      }
      const mismo = await j(`select agentes.registrar_brief($1, $2) as r`, [b.corrida_id, { ...base, correo: 'A@501.test ' }]);
      assert.equal(mismo.ok, true, 'el correo del mismo lead, con otra capitalización, pasa');
    },
  );
});

test('10 · el expediente: una fila del lead con lo que llenaron los agentes, nada de B, y null en lo que falta', async () => {
  let deGhlB: string[] = [];
  await enUnEnsayo(
    async () => {
      await unLead('ghl-501-a', 'a@501.test');
      deGhlB = await mensajeYCita(await unLead('ghl-501-b', 'b@501.test'), 'MARCA_B');
    },
    async () => {
      deGhlB.push(...await llamadaTriageYCoach('ghl-501-b', 'MARCA_B'));
      assert.equal(deGhlB.filter(Boolean).length, 6, 'faltan ids de lo que B trae de GHL');
      const b = await armarExpediente('ghl-501-b', 'MARCA_B');
      const a = await armarExpediente('ghl-501-a', 'MARCA_A');
      const r = await admin.query(`select * from negocio.expediente_del_lead where contacto_id = $1`, [a.lead]);
      assert.equal(r.rows.length, 1);
      const fila = r.rows[0] as Record<string, unknown>;
      for (const c of ['identidad', 'formulario', 'brief', 'research', 'kickoff', 'icp_del_lead', 'categoria_y_oferta', 'precio_y_process_map', 'embudo', 'evidencia_publica', 'corridas']) {
        assert.ok(fila[c] !== null, `la sección ${c} está vacía`);
      }
      for (const c of ['ficha', 'resultado', 'evaluacion', 'objeciones', 'seguimientos', 'agenda', 'llamadas']) {
        assert.equal(fila[c], null, `la sección ${c} debería ser null`);
      }
      const texto = JSON.stringify(fila);
      for (const h of [...await huellasDe(b.lead, 'MARCA_B', 'ghl-501-b'), ...deGhlB]) assert.ok(!texto.includes(h), `el expediente de A contiene «${h}» de B`);
      assert.ok(!texto.includes('a@501.test'), 'el expediente no lleva el correo');
      // El ICP del lead es suyo, en su expediente.
      assert.match(JSON.stringify(fila.icp_del_lead), /ICP MARCA_A/);
    },
  );
});

test('11 y buscar_contacto · el Triage se vincula al llegar el lead; identificar por correo: una, ninguna o varias coincidencias', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-501-a', 'a@501.test');
      await unLead('ghl-501-c', 'repetido@501.test');
      await unLead('ghl-501-d', 'REPETIDO@501.test');
    },
    async () => {
      const una = await j(`select agentes.buscar_contacto($1, ' A@501.test') as r`, [LOC]);
      assert.equal(una.coincidencias, 1);
      assert.equal(una.contactos[0].ghl_contact_id, 'ghl-501-a');
      assert.ok(!JSON.stringify(una).includes('@501.test'), 'no devuelve el correo');
      const ninguna = await j(`select agentes.buscar_contacto($1, 'nadie@501.test') as r`, [LOC]);
      assert.equal(ninguna.coincidencias, 0);
      const varias = await j(`select agentes.buscar_contacto($1, 'repetido@501.test') as r`, [LOC]);
      assert.equal(varias.coincidencias, 2);
      await fallaCon('22023', `select agentes.buscar_contacto($1, 'sin-arroba')`, [LOC]);
      const c = await j(`select agentes.abrir_corrida('brief', $1, 'ghl-501-a', 'x', '{}', null, '{}', null, null, 'activo', null, null, 'correo') as r`, [LOC]);
      assert.equal(c.identificado_por, 'correo');
      const g = await unaFila<{ identificado_por: string }>(admin, `select identificado_por from negocio.corridas_de_agente where id = $1`, [c.corrida_id]);
      assert.equal(g!.identificado_por, 'correo');
      // El Brief no abre sin el lead en la base.
      await fallaCon('P0002', `select agentes.abrir_corrida('brief', $1, 'ghl-que-no-llego', 'y')`, [LOC]);
      // 11 · el Triage sí, y se vincula cuando el contacto llega.
      const t = await j(`select agentes.abrir_corrida('triage', $1, 'ghl-501-tarde', 'z') as r`, [LOC]);
      assert.equal(t.contacto_id, null);
      // Lo que el agente investigó y lo que hizo afuera antes de que llegara el lead también se vincula.
      const fp = await j(`select agentes.registrar_fuente_publica($1, 'web', 'Su web dice que factura 8 mil') as r`, [t.corrida_id]);
      const ax = await j(`select agentes.registrar_accion_externa($1, 'nota', 'ghl') as r`, [t.corrida_id]);
      assert.equal(fp.ok, true, JSON.stringify(fp));
      assert.equal(ax.ok, true, JSON.stringify(ax));
      await admin.query('reset role');
      const nuevo = await unaFila<{ id: string }>(admin,
        `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente) values ($1, $2, 'ghl-501-tarde', 'Tarde', 'meta') returning id`,
        [aria.org, aria.cuenta]);
      const v = await unaFila<{ corrida: string; fuente: string; accion: string }>(admin,
        `select (select contacto_id from negocio.corridas_de_agente where id = $1)::text as corrida,
                (select contacto_id from negocio.fuentes_publicas where corrida_id = $1)::text as fuente,
                (select contacto_id from negocio.acciones_externas where corrida_id = $1)::text as accion`, [t.corrida_id]);
      assert.deepEqual(v, { corrida: nuevo!.id, fuente: nuevo!.id, accion: nuevo!.id });
    },
  );
});

test('12 · lo del barrido: pago, versiones, transcripciones y la llamada del Sales Coach no cruzan de lead', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-501-a', 'a@501.test');
      await unLead('ghl-501-b', 'b@501.test');
    },
    async () => {
      // Un pago con el id externo de otro lead no lo toca.
      const pa = await j(`select agentes.registrar_pago($1, 'ghl-501-a', 'pasarela', 'pago-501', 1000, 'USD') as r`, [LOC]);
      await fallaCon('42501', `select agentes.registrar_pago($1, 'ghl-501-b', 'pasarela', 'pago-501', 1, 'USD', 'reembolsado', now())`, [LOC]);
      const pago = await unaFila<{ estado: string; monto: string; contacto: string }>(admin,
        `select estado, monto::text as monto, (select ghl_contact_id from negocio.contactos k where k.id = p.contacto_id) as contacto
           from negocio.pagos p where p.id = $1`, [pa.pago_id]);
      assert.deepEqual([pago!.estado, Number(pago!.monto), pago!.contacto], [pa.estado, 1000, 'ghl-501-a']);

      // La transcripción lleva el lead de su llamada, y no se puede colgar de otro.
      const la = await j(`select agentes.registrar_llamada($1, 'ghl-501-a', 'ga', 'venta', 'ghl', 'Lead A: me interesa.') as r`, [LOC]);
      const lb = await j(`select agentes.registrar_llamada($1, 'ghl-501-b', 'gb', 'venta', 'ghl', 'Lead B: lo pienso.') as r`, [LOC]);
      const ta = await unaFila<{ ok: boolean }>(admin,
        `select bool_and(t.contacto_id = l.contacto_id) and count(*) = 1 as ok from negocio.transcripciones t
           join negocio.llamadas l on l.id = t.llamada_id where t.llamada_id = $1`, [la.llamada_id]);
      assert.equal(ta!.ok, true);
      await admin.query('reset role');
      const contactoB = (await unaFila<{ id: string }>(admin, `select id from negocio.contactos where ghl_contact_id = 'ghl-501-b'`))!.id;
      await fallaCon('23503', `insert into negocio.transcripciones (org_id, cuenta_id, contacto_id, llamada_id, texto, proveedor)
                               values ($1, $2, $3, $4, 'ajena', 'ghl')`, [aria.org, aria.cuenta, contactoB, la.llamada_id]);

      // El Sales Coach no evalúa una llamada de otro lead aunque alguien cambie la de su corrida.
      await admin.query('set local role mcp_simulado');
      const c = await j(`select agentes.abrir_corrida('sales_coach', $1, 'ghl-501-a', 'sc', '{}', null, $2) as r`, [LOC, { llamada_id: la.llamada_id }]);
      await j(`select agentes.leer_sales_coach($1) as r`, [c.corrida_id]);
      await admin.query('reset role');
      await admin.query(`update negocio.corridas_de_agente set llamada_id = $2 where id = $1`, [c.corrida_id, lb.llamada_id]);
      await admin.query('set local role mcp_simulado');
      const s = await j(`select agentes.registrar_sales_coach($1, $2) as r`, [c.corrida_id, {
        resultado: { compro: false, salida: 'no_interesa', confianza: 'alta', next_steps: [{ accion: 'nada', responsable: 'sistema' }] },
      }]);
      assert.equal(s.ok, false, JSON.stringify(s));
      assert.match(JSON.stringify(s), /no es de este lead/);

      // El entregable de un lead no puede apuntar a la versión de otro.
      const a = await armarExpediente('ghl-501-a', 'MARCA_A');
      const b = await armarExpediente('ghl-501-b', 'MARCA_B');
      await admin.query('reset role');
      for (const col of ['version_vigente_id', 'version_aprobada_id']) {
        await fallaCon('23503', `update negocio.entregables set ${col} = $2 where contacto_id = $1 and tipo = 'icp'`, [a.lead, b.icp]);
      }
    },
  );
});
