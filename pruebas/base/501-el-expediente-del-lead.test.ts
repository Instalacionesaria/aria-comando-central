// EL EXPEDIENTE DEL LEAD (la migración 115; la 119 y la 124 le quitan secciones). Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (MANAGED-AGENTS-CORRECCION-DATOS-POR-LEAD.md § 6, decisiones del usuario del 2026-11-11 y
// del 2026-11-24)
//
// Todo pasa en la cuenta de ARIA, sobre leads que NO compraron. Lo que producen los agentes es del lead, y guardarlo no
// dispara nada. Con dos leads A y B:
//
//   (1, 2, 3, 6, 6b, 7 y 9 · los entregables, el Brief estructurado, el Research, el Estratega y el Funnel Builder viejos
//    y el kickoff: se borraron en la 124. 4, 5 y 8 · el conocimiento de la cuenta: se borró en la 119.)
//  10 · el expediente de A es UNA fila con las secciones que quedan (identidad, formulario, comportamiento, atribución,
//       conversación, agenda, llamadas, triaje, resultado, evidencia pública, corridas y respuestas de los agentes) y
//       ninguna de las borradas (brief, research, kickoff, icp_del_lead, categoria_y_oferta, precio_y_process_map,
//       embudo); trae lo que dejaron los agentes de la fase 1 (la llamada, el Triage con su fuente pública, las fichas 1
//       y 2) sin el HTML de las fichas, y nada de B (tampoco lo que B trae de GHL: el mensaje y la cita), ni por la vista
//       ni por agentes.expediente — mutaciones: quitar el filtro por contacto en una sección de expediente_del_lead (las
//       llamadas, la evidencia pública o el comportamiento, que sólo cuenta), y volver a crear la vista con una sección
//       borrada;
//  11 · el Triage sin el contacto todavía se vincula al llegar, con su fuente pública y su acción externa (también en
//       la 505); el Brief no abre sin el lead en la base;
//   y agentes.buscar_contacto: una coincidencia, ninguna, varias; la corrida guarda identificado_por;
//  12 · lo del barrido: la transcripción no se cuelga de otro lead, y el Sales Coach lee sólo la llamada del suyo.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';

let admin: Client;
let aria: { org: string; cuenta: string };
const LOC = 'loc-501';

/** Las columnas de negocio.expediente_del_lead desde la 124: las claves del lead y una por sección. */
const CLAVES = ['org_id', 'cuenta_id', 'contacto_id', 'ghl_contact_id'];
const SECCIONES = ['identidad', 'formulario', 'comportamiento', 'atribucion', 'conversacion', 'agenda', 'llamadas', 'triaje',
  'resultado', 'evidencia_publica', 'corridas', 'respuestas_de_los_agentes'];
/** Las que se borraron en la 124 (sus salidas están ahora en respuestas_de_los_agentes). */
const BORRADAS = ['brief', 'research', 'kickoff', 'icp_del_lead', 'categoria_y_oferta', 'precio_y_process_map', 'embudo'];

before(async () => {
  admin = await conectar('admin');
  const a = await unaFila<{ org: string; cuenta: string }>(
    admin,
    `select o.id as org, c.id as cuenta from identidad.organizaciones o
       join identidad.cuentas c on c.org_id = o.id and c.es_por_omision where o.es_principal`,
  );
  assert.ok(a, 'falta el sembrado');
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

/** Lo que dejan sobre un lead los agentes de la fase 1, como el MCP (118 a 121): una llamada de venta con su
 *  transcripción, el Triage (una fuente pública y su cuadrante), la ficha 1 del Sales Assistant y la ficha 2 del Sales
 *  Coach. La marca va en cada texto para buscarla después. */
async function armarExpediente(ghl: string, marca: string): Promise<{ lead: string; triage: string }> {
  const lead = (await unaFila<{ id: string }>(admin, `select id from negocio.contactos where ghl_contact_id = $1`, [ghl]))!.id;
  const abrir = (agente: string, clave: string, sujeto: object = {}) =>
    j(`select agentes.abrir_corrida($1, $2, $3, $4, '{}', null, $5) as r`, [agente, LOC, ghl, `${clave}-${ghl}`, sujeto]);

  const l = await j(`select agentes.registrar_llamada($1, $2, $3, 'venta', 'ghl', $4) as r`,
    [LOC, ghl, `llamada-${marca}`, `Lead ${marca}: me interesa, pero lo pienso.`]);
  assert.ok(l.llamada_id && l.transcripcion_id, JSON.stringify(l));

  // El Triage: lo que investigó afuera (mientras la corrida está abierta) y su cuadrante, en su columna.
  const t = await abrir('triage', 't');
  const fp = await j(`select agentes.registrar_fuente_publica($1, 'web', $2) as r`, [t.corrida_id, `Su web dice que factura 8 mil ${marca}`]);
  assert.equal(fp.ok, true, JSON.stringify(fp));
  const tr = await j(`select agentes.registrar_cuadrante($1, 'valida', $2) as r`, [t.corrida_id, `factura 8 mil ${marca}`]);
  assert.equal(tr.ok, true, JSON.stringify(tr));

  const sa = await abrir('sales_assistant', 'sa');
  const f1 = await j(`select agentes.guardar_respuesta($1, $2) as r`, [sa.corrida_id, `<section id="resumen"><p>Ficha 1 ${marca}</p></section>`]);
  assert.equal(f1.ok, true, JSON.stringify(f1));

  const sc = await abrir('sales_coach', 'sc', { llamada_id: l.llamada_id });
  const ll = await j(`select agentes.leer_llamada($1) as r`, [sc.corrida_id]);
  assert.equal(ll.llamada_id, l.llamada_id, JSON.stringify(ll));
  const f2 = await j(`select agentes.guardar_respuesta($1, $2) as r`, [sc.corrida_id, `<p>Ficha 2 ${marca}: llamar de nuevo</p>`]);
  assert.equal(f2.ok, true, JSON.stringify(f2));
  return { lead, triage: t.corrida_id };
}

/** Los ids y marcas de un lead: lo que no puede aparecer en lo que se lee del otro. El ghl_contact_id también va en su
 *  formulario («factura 8 mil (ghl-…)»), así que un expediente que traiga el formulario del otro lead se delata. */
async function huellasDe(lead: string, marca: string, ghl: string): Promise<string[]> {
  const r = await admin.query<{ id: string }>(
    `select id::text from negocio.corridas_de_agente where contacto_id = $1
     union all select id::text from negocio.fuentes_publicas where contacto_id = $1
     union all select id::text from negocio.llamadas where contacto_id = $1
     union all select id::text from negocio.transcripciones where contacto_id = $1
     union all select id::text from negocio.mensajes where contacto_id = $1
     union all select id::text from negocio.citas where contacto_id = $1`,
    [lead],
  );
  return [lead, marca, ghl, ...r.rows.map((x) => x.id)];
}

/** Lo que GHL trae de un lead, además de lo de los agentes: un mensaje y una cita. Los escribe el superusuario (en la
 *  preparación). */
async function mensajeYCita(lead: string, marca: string): Promise<void> {
  await admin.query(
    `insert into negocio.mensajes (org_id, cuenta_id, contacto_id, ghl_mensaje_id, canal, direccion, autor, cuerpo, enviado_el)
     values ($1, $2, $3, $4, 'whatsapp', 'entrante', 'contacto', $5, now() - interval '1 hour')`,
    [aria.org, aria.cuenta, lead, `msg-${marca}`, `Hola, quiero saber el precio ${marca}`]);
  await admin.query(
    `insert into negocio.citas (org_id, cuenta_id, contacto_id, ghl_evento_id, titulo, inicio_el)
     values ($1, $2, $3, $4, $5, now() + interval '1 day')`,
    [aria.org, aria.cuenta, lead, `ev-${marca}`, `Llamada ${marca}`]);
}

test('10 · el expediente: una fila del lead con las secciones que quedan, lo que llenaron los agentes, nada de B, y null en lo que falta', async () => {
  await enUnEnsayo(
    async () => {
      await mensajeYCita(await unLead('ghl-501-a', 'a@501.test'), 'MARCA_A');
      await mensajeYCita(await unLead('ghl-501-b', 'b@501.test'), 'MARCA_B');
    },
    async () => {
      const b = await armarExpediente('ghl-501-b', 'MARCA_B');
      const a = await armarExpediente('ghl-501-a', 'MARCA_A');
      const deB = await huellasDe(b.lead, 'MARCA_B', 'ghl-501-b');
      // El lead, la marca y el ghl, y al menos las 3 corridas, la fuente pública, la llamada, su transcripción, el mensaje
      // y la cita: si faltaran, que no estén en el expediente de A no probaría nada.
      assert.ok(deB.length >= 11, `faltan huellas de B (${deB.length})`);

      const r = await admin.query(`select * from negocio.expediente_del_lead where contacto_id = $1`, [a.lead]);
      assert.equal(r.rows.length, 1);
      const fila = r.rows[0] as Record<string, any>;
      assert.deepEqual(Object.keys(fila).sort(), [...CLAVES, ...SECCIONES].sort(), 'las secciones del expediente desde la 124');
      for (const c of BORRADAS) assert.ok(!(c in fila), `la sección ${c} se borró en la 124`);
      for (const c of ['identidad', 'formulario', 'conversacion', 'agenda', 'llamadas', 'evidencia_publica', 'corridas', 'respuestas_de_los_agentes']) {
        assert.ok(fila[c] !== null, `la sección ${c} está vacía`);
      }
      assert.equal(fila.resultado, null, 'la sección resultado debería ser null');
      // El comportamiento sólo cuenta eventos (no lleva ids): la transcripción de B (fuente ghl) también sería un
      // transcripcion_lista, así que un 2 delata que la sección no filtra por contacto.
      assert.equal(fila.comportamiento?.transcripcion_lista, 1, JSON.stringify(fila.comportamiento));
      assert.equal(fila.respuestas_de_los_agentes.triage_cuadrante_de_clasificacion, 'valida');
      assert.deepEqual(Object.keys(fila.respuestas_de_los_agentes.procedencia).sort(),
        ['sales_assistant_ficha_de_lead_1', 'sales_coach_ficha_de_lead_2', 'triage_cuadrante_de_clasificacion']);
      assert.deepEqual(fila.corridas.map((c: { agente: string }) => c.agente).sort(), ['sales_assistant', 'sales_coach', 'triage']);

      // Lo mismo por la vista y por agentes.expediente (lo que leen los agentes): lo de A sí, lo de B no.
      const exp = await j(`select agentes.expediente($1) as r`, [a.triage]);
      for (const [como, leido] of [['la vista', fila], ['agentes.expediente', exp]] as const) {
        const texto = JSON.stringify(leido);
        for (const h of deB) assert.ok(!texto.includes(h), `el expediente de A (${como}) contiene «${h}» de B`);
        // Control positivo: trae lo de A (si viniera vacío, la ausencia de B no probaría nada).
        for (const deA of ['factura 8 mil (ghl-501-a)', 'Hola, quiero saber el precio MARCA_A', 'Lead MARCA_A: me interesa',
          'Su web dice que factura 8 mil MARCA_A']) {
          assert.ok(texto.includes(deA), `el expediente de A (${como}) no trae «${deA}»`);
        }
        assert.ok(!texto.includes('a@501.test'), `el expediente (${como}) no lleva el correo`);
        // Las fichas se leen con agentes.leer_respuesta: el expediente sólo dice qué dejó cada agente y cuándo.
        assert.ok(!texto.includes('Ficha 1 MARCA_A') && !texto.includes('Ficha 2 MARCA_A'), `el expediente (${como}) no lleva el HTML de las fichas`);
      }
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

test('12 · lo del barrido: transcripciones y la llamada del Sales Coach no cruzan de lead', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-501-a', 'a@501.test');
      await unLead('ghl-501-b', 'b@501.test');
    },
    async () => {
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

      // El Sales Coach lee sólo la llamada de su lead (leer_llamada, 119): la de B no se la da ni pidiéndola.
      await admin.query('set local role mcp_simulado');
      const c = await j(`select agentes.abrir_corrida('sales_coach', $1, 'ghl-501-a', 'sc', '{}', null, $2) as r`, [LOC, { llamada_id: la.llamada_id }]);
      const propia = await j(`select agentes.leer_llamada($1) as r`, [c.corrida_id]);
      assert.equal(propia.llamada_id, la.llamada_id);
      assert.match(propia.transcripcion, /Lead A/);
      const ajena = await j(`select agentes.leer_llamada($1, $2) as r`, [c.corrida_id, lb.llamada_id]);
      assert.equal(ajena.llamada_id, null, JSON.stringify(ajena));
      assert.match(ajena.motivo, /no es de este lead/);
    },
  );
});
