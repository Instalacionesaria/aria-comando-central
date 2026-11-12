// LAS ORILLAS DEL LEAD (la migración 115, lo que la 501 no cubre). Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (MANAGED-AGENTS-CORRECCION-DATOS-POR-LEAD.md, decisiones del usuario del 2026-11-11)
//
// La 501 prueba el centro: lo que producen los agentes es del lead. Éste prueba las orillas, donde un lead todavía se
// puede colar en el de otro: la clave de idempotencia, la cita y la llamada del sujeto, las fuentes citables, el modo
// sombra, la venta de una llamada, el closer, la etapa previa, el comportamiento, el lead que llega tarde, el borrado,
// la llamada con el id de otro, la salida que nombra otro correo, las citas de una pieza y las rutas de la cuenta.
// Con dos leads A y B en la cuenta de ARIA:
//
//   1 · la clave de idempotencia es de UN lead: con otro lead (o con un lead que no estaba y ahora sí) es 42501, y con
//       el mismo se reutiliza — mutación: volver a la condición vieja (sólo contacto_id distinto y no nulo);
//   2 · la cita de otro lead no reemplaza la corrida de A, y la llamada de otro lead no abre el Sales Coach de A —
//       mutación: quitar `ci.contacto_id = v_contacto.id` de abrir_corrida;
//   3 · en las claves de fuente que arma la base (llamada_venta:, publica:) gana lo leído y la entrada no las inventa;
//       la entrada sólo aporta sus propias claves (ghl:…). De punta a punta: una cita que sólo está en la transcripción
//       inventada no se verifica — mutación: _texto_de_la_fuente con coalesce(entrada, leido);
//   4 · el Triage en sombra no pide escribir en GHL y avisa; en activo, sí — mutación: quitar el caso del modo;
//   5 · una llamada, una venta: la propuesta nueva reemplaza a la vieja sin decidir, y una vez confirmada no se
//       confirma otra — mutación: sin el índice resultados_propuestos_una_venta_por_llamada y sin el reemplazo;
//   6 · la venta se acredita al closer de la llamada, no a quien confirma — mutación: closer_id = coalesce(p_closer, …);
//   7 · la etapa previa tiene que estar aprobada EN EL MISMO LEAD — mutación: _exigir_aprobado sin el contacto;
//   8 · el comportamiento del expediente es lo que hizo el lead, no lo que anotaron los agentes — mutación: quitar el
//       filtro `ev.fuente <> 'ghl_managed_agents'` de la vista;
//   9 · vincular_lo_del_agente como el inquilino: el lead que llega vincula su corrida, su evidencia y su acción, y no
//       las de otro lead pendiente; el inquilino lee el expediente — mutaciones: la versión de la 111 (sin evidencia ni
//       acciones), y la evidencia sin el filtro `corrida_id = any (v_corridas)`;
//  10 · borrar un lead se lleva todo lo suyo de cada tabla de los agentes, y nada de B — mutación: quitar la clave
//       foránea decisiones_de_kickoff_del_lead;
//  10b · borrar un lead cuyo referente cita una evidencia pública — mutación: la clave del referente a su evidencia con
//       ON DELETE SET NULL (fuente_publica_id), que actualiza un referente cuya versión ya se borró (23503);
//  10c · las corridas del lead borrado no quedan huérfanas con lo que leyeron y escribieron de él — mutación: la clave
//       de la corrida al contacto con ON DELETE SET NULL (contacto_id), como en la 110;
//  11 · registrar_llamada con el id externo de la llamada de A, para B: 42501, y la de A queda igual — mutación: el
//       update sin `contacto_id = v_contacto`;
//  12 · registrar_sales_coach rechaza una salida que nombra otro lead, también por «email» — mutación: _otro_lead sin
//       la clave «email»;
//  13 · las citas que usa una pieza son del mismo lead: las de otro se descartan al registrar y la base las rechaza —
//       mutaciones: quitar el disparador piezas_citas_del_mismo_lead, y registrar_funnel_builder sin
//       `cm.contacto_id = v.contacto_id`;
//  14 · las rutas de la cuenta no llegan a los agentes del cliente (sí al Triage) — mutación: sumar las rutas a
//       leer_funnel_builder.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';

let admin: Client;
let aria: { org: string; cuenta: string; persona: string };
const LOC = 'loc-502';

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

/** Una transacción que siempre se deshace, con la preparación como superusuario y el trabajo como el MCP. */
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

/** Lo que haga `fn`, como el superusuario; después vuelve a ser el MCP. Si `fn` falla, su error sale tal cual (la
 *  transacción ya está abortada y el rollback de enUnEnsayo la cierra). */
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
     values ($1, $2, $3, 'Lead 502', 'meta', $4) returning id`,
    [aria.org, aria.cuenta, ghl, correo],
  );
  await admin.query(
    `insert into negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, pregunta, origen_clave, valor_texto, proveedor, obtenida_por, observada_el)
     values ($1, $2, $3, 'facturacion_mensual', 'contact.facturacion', $4, 'ghl', 'formulario', now())`,
    [aria.org, aria.cuenta, c!.id, `factura 8 mil (${ghl})`],
  );
  return c!.id;
}

const abrir = (agente: string, ghl: string, clave: string, sujeto: object = {}, entrada: object = {}) =>
  j(`select agentes.abrir_corrida($1, $2, $3, $4, $5, null, $6) as r`, [agente, LOC, ghl, clave, entrada, sujeto]);

type Expediente = { lead: string; brief: string; seg: string; dec: string; icp: string; anuncios: string; fuente: string };

/** Todo lo de un lead, de punta a punta, como el MCP (igual que en la 501). La marca va en cada texto. */
async function armarExpediente(ghl: string, marca: string, aprobar = true): Promise<Expediente> {
  const lead = (await unaFila<{ id: string }>(admin, `select id from negocio.contactos where ghl_contact_id = $1`, [ghl]))!.id;
  const abrirE = (agente: string, clave: string, sujeto: object = {}) => abrir(agente, ghl, `${clave}-${ghl}`, sujeto);
  const aprobada = async (version: string) => {
    await j(`select agentes.decidir_entregable($1, 'aprobada', $2) as r`, [version, aria.persona]);
  };

  const b = await abrirE('brief', 'b');
  await j(`select agentes.leer_brief($1) as r`, [b.corrida_id]);
  const vb = await j(`select agentes.registrar_brief($1, $2) as r`, [b.corrida_id, {
    respuestas: [{ pregunta: 'facturacion_mensual', estado: 'detectado', valor: `8 mil ${marca}`, fuente: 'formulario:facturacion_mensual', cita: 'factura 8 mil' }],
  }]);
  assert.equal(vb.ok, true, JSON.stringify(vb));

  const s = await abrirE('research', 's', { paso: 'mr_segmentos' });
  await j(`select agentes.leer_research($1) as r`, [s.corrida_id]);
  const pub = await j(`select agentes.registrar_fuente_publica($1, 'foro', $2) as r`, [s.corrida_id, `Nadie me atiende rápido ${marca}`]);
  const vs = await j(`select agentes.registrar_research($1, $2) as r`, [s.corrida_id, {
    texto: `# Segmentos ${marca}`, segmentos: [{ nombre: `Segmento ${marca}` }],
    citas: [{ texto: `Nadie me atiende rápido ${marca}`, fuente: pub.fuente, segmento: `Segmento ${marca}` }],
  }]);
  assert.equal(vs.ok, true, JSON.stringify(vs));
  await aprobada(vs.version_id);

  const d = await abrirE('research', 'd', { paso: 'mr_decision' });
  await j(`select agentes.leer_research($1) as r`, [d.corrida_id]);
  const vd = await j(`select agentes.registrar_research($1, $2) as r`, [d.corrida_id, { texto: `# Decisión ${marca}`, segmento_elegido: `Segmento ${marca}` }]);
  await aprobada(vd.version_id);

  await j(`select agentes.registrar_decisiones_de_kickoff($1, $2, 'coach') as r`, [lead, JSON.stringify([{ sobre: 'segmento', decision: `Kickoff ${marca}` }])]);

  const e1 = await abrirE('estratega', 'e1', { etapa: 'icp' });
  await j(`select agentes.leer_estratega($1) as r`, [e1.corrida_id]);
  const vi = await j(`select agentes.registrar_estratega($1, $2) as r`, [e1.corrida_id, { texto: `# ICP ${marca}`, contenido: { a_quien_si: [{ criterio: `ICP ${marca}` }], a_quien_no: [] } }]);
  assert.equal(vi.ok, true, JSON.stringify(vi));
  await aprobada(vi.version_id);
  for (const [etapa, contenido] of [
    ['categoria_y_oferta', { categoria: { nombre: `Cat ${marca}` }, mecanismo: { nombre: 'm' }, oferta: { promesa: 'p' } }],
    ['precio_y_process_map', { precio: { monto: 2000, moneda: 'USD' }, metodo: { fases: [{ nombre: `Fase ${marca}` }] } }],
  ] as const) {
    const c = await abrirE('estratega', etapa, { etapa });
    await j(`select agentes.leer_estratega($1) as r`, [c.corrida_id]);
    const v = await j(`select agentes.registrar_estratega($1, $2) as r`, [c.corrida_id, { texto: `# ${etapa} ${marca}`, contenido }]);
    assert.equal(v.ok, true, JSON.stringify(v));
    await aprobada(v.version_id);
  }
  const f = await abrirE('funnel_builder', 'f', { pieza: 'anuncios' });
  await j(`select agentes.leer_funnel_builder($1) as r`, [f.corrida_id]);
  const va = await j(`select agentes.registrar_funnel_builder($1, $2) as r`, [f.corrida_id, {
    texto: `# Anuncios ${marca}`, variantes: [{ codigo_de_nomenclatura: `AD_${marca}`, titular: `Titular ${marca}` }],
  }]);
  assert.equal(va.ok, true, JSON.stringify(va));
  if (aprobar) await aprobada(va.version_id);
  return { lead, brief: vb.version_id, seg: vs.version_id, dec: vd.version_id, icp: vi.version_id, anuncios: va.version_id, fuente: pub.fuente_publica_id };
}

/** Un Triage que lee el formulario y lo cita. */
async function unTriage(ghl: string, clave: string, modo = 'activo'): Promise<Record<string, any>> {
  const c = await j(`select agentes.abrir_corrida('triage', $1, $2, $3, '{}', null, '{}', null, null, $4) as r`, [LOC, ghl, clave, modo]);
  await j(`select agentes.leer_triage($1) as r`, [c.corrida_id]);
  const t = await j(`select agentes.registrar_triage($1, $2) as r`, [c.corrida_id, {
    prioridad: 3, ruta_clase: 'alto_ticket', confianza: 'media',
    razones: [{ campo: 'facturacion_mensual', estado: 'detectado', valor: '8 mil', fuente: 'formulario:facturacion_mensual', cita: 'factura 8 mil' }],
  }]);
  assert.equal(t.ok, true, JSON.stringify(t));
  return { ...t, corrida_id: c.corrida_id };
}

const VENTA = {
  resultado: { compro: true, salida: 'venta', monto: 2000, moneda: 'USD', monto_usd: 2000, confianza: 'alta',
    next_steps: [{ accion: 'enviar contrato', responsable: 'closer' }] },
};

/** Una corrida del Sales Coach sobre la llamada, con su salida registrada. */
async function unSalesCoach(ghl: string, llamada: string, clave: string, salida: object = VENTA): Promise<Record<string, any>> {
  const c = await abrir('sales_coach', ghl, clave, { llamada_id: llamada });
  await j(`select agentes.leer_sales_coach($1) as r`, [c.corrida_id]);
  const s = await j(`select agentes.registrar_sales_coach($1, $2) as r`, [c.corrida_id, salida]);
  assert.equal(s.ok, true, JSON.stringify(s));
  return s;
}

const idDe = async (ghl: string) => (await unaFila<{ id: string }>(admin, `select id from negocio.contactos where ghl_contact_id = $1`, [ghl]))!.id;

test('1 · la clave de idempotencia es de un lead: con otro (o con uno que antes no estaba) es 42501; con el mismo se reutiliza', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
      await unLead('ghl-502-b', 'b@502.test');
    },
    async () => {
      // (a) La misma clave, el mismo agente, otro lead.
      const k = await j(`select agentes.abrir_corrida('triage', $1, 'ghl-502-a', 'k') as r`, [LOC]);
      assert.ok(k.contacto_id);
      await fallaCon('42501', `select agentes.abrir_corrida('triage', $1, 'ghl-502-b', 'k')`, [LOC]);
      // (b) Una corrida sin lead (el contacto todavía no llegó) y la misma clave para un lead que sí está.
      const z = await j(`select agentes.abrir_corrida('triage', $1, 'ghl-502-nadie', 'z') as r`, [LOC]);
      assert.equal(z.contacto_id, null);
      await fallaCon('42501', `select agentes.abrir_corrida('triage', $1, 'ghl-502-a', 'z')`, [LOC]);
      // (c) La misma clave y el mismo lead: la misma corrida.
      const otra = await j(`select agentes.abrir_corrida('triage', $1, 'ghl-502-a', 'k') as r`, [LOC]);
      assert.deepEqual([otra.reutilizada, otra.corrida_id], [true, k.corrida_id]);
      const sin = await j(`select agentes.abrir_corrida('triage', $1, 'ghl-502-nadie', 'z') as r`, [LOC]);
      assert.deepEqual([sin.reutilizada, sin.corrida_id], [true, z.corrida_id]);
    },
  );
});

test('2 · la cita de otro lead no reemplaza la corrida de A, y la llamada de otro lead no abre el Sales Coach de A', async () => {
  let citaA = '';
  await enUnEnsayo(
    async () => {
      const a = await unLead('ghl-502-a', 'a@502.test');
      await unLead('ghl-502-b', 'b@502.test');
      citaA = (await unaFila<{ id: string }>(admin,
        `insert into negocio.citas (org_id, cuenta_id, contacto_id, ghl_evento_id, inicio_el) values ($1, $2, $3, 'ev-502', now() + interval '1 day') returning id`,
        [aria.org, aria.cuenta, a]))!.id;
    },
    async () => {
      const a = await abrir('sales_assistant', 'ghl-502-a', 'sa-a', { ghl_evento_id: 'ev-502' });
      assert.equal(a.cita_id, citaA);
      // B con el mismo id de evento: la cita no es suya, no la ve, y no comparte el sujeto de A.
      const b = await abrir('sales_assistant', 'ghl-502-b', 'sa-b', { ghl_evento_id: 'ev-502' });
      assert.equal(b.cita_id, null);
      assert.ok((b.faltantes as string[]).includes('cita_en_la_base'), JSON.stringify(b));
      assert.equal(b.reemplazo_a, null, 'la corrida de B reemplazó otra');
      const estadoA = await unaFila<{ estado: string; reemplazada_por: string | null }>(admin,
        `select estado, reemplazada_por from negocio.corridas_de_agente where id = $1`, [a.corrida_id]);
      assert.deepEqual([estadoA!.estado, estadoA!.reemplazada_por], ['abierta', null]);
      // La llamada de B no abre el Sales Coach de A.
      const lb = await j(`select agentes.registrar_llamada($1, 'ghl-502-b', 'llamada-502-b', 'venta', 'ghl', 'Lead B: lo pienso.') as r`, [LOC]);
      await fallaCon('P0002', `select agentes.abrir_corrida('sales_coach', $1, 'ghl-502-a', 'sc-a', '{}', null, $2)`, [LOC, { llamada_id: lb.llamada_id }]);
    },
  );
});

test('3 · las claves que arma la base no se inventan en la entrada: gana lo leído, y una cita sólo inventada no se verifica', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
    },
    async () => {
      const la = await j(`select agentes.registrar_llamada($1, 'ghl-502-a', 'llamada-502-a', 'venta', 'ghl', 'Lead A: lo pienso, no tengo tiempo ahora.') as r`, [LOC]);
      const kLlamada = `llamada_venta:${la.llamada_id}`;
      const kPublica = `publica:${randomUUID()}`;
      const t = await j(`select agentes.abrir_corrida('triage', $1, 'ghl-502-a', 'fuentes') as r`, [LOC]);
      const textos = await comoAdmin(async () => {
        await admin.query(`update negocio.corridas_de_agente set entrada = $2, leido = $3 where id = $1`, [t.corrida_id,
          { fuentes: { [kLlamada]: 'inventado', [kPublica]: 'inventado', 'ghl:notas': 'propio' } },
          { fuentes: { [kLlamada]: 'real' } }]);
        const r = await admin.query<{ t: string | null }>(
          `select agentes._texto_de_la_fuente(c, k) as t from negocio.corridas_de_agente c, unnest($2::text[]) with ordinality u(k, n)
            where c.id = $1 order by n`, [t.corrida_id, [kLlamada, kPublica, 'ghl:notas']]);
        return r.rows.map((x) => x.t);
      });
      assert.deepEqual(textos, ['real', null, 'propio']);

      // De punta a punta: el agente pone en su entrada una transcripción inventada de la misma llamada.
      const c = await abrir('sales_coach', 'ghl-502-a', 'sc-inventado', { llamada_id: la.llamada_id },
        { fuentes: { [kLlamada]: 'Lead A: compro hoy y pago todo, el precio no me preocupa.' } });
      await j(`select agentes.leer_sales_coach($1) as r`, [c.corrida_id]);
      const s = await j(`select agentes.registrar_sales_coach($1, $2) as r`, [c.corrida_id, {
        resultado: { ...VENTA.resultado,
          evidencia: [{ campo: 'compro', estado: 'detectado', valor: true, fuente: kLlamada, cita: 'compro hoy y pago todo' }] },
        objeciones: [
          { categoria: 'precio', texto: 'el precio no me preocupa', resuelta: true },
          { categoria: 'momento', texto: 'no tengo tiempo ahora', resuelta: false },
        ],
      }]);
      assert.equal(s.ok, true, JSON.stringify(s));
      assert.equal(s.degradados, 1, 'la evidencia citada de la transcripción inventada no se degradó');
      const p = await unaFila<{ evidencia: Array<{ estado: string; degradado?: boolean }> }>(admin,
        `select evidencia from negocio.resultados_propuestos where id = $1`, [s.resultado_propuesto_id]);
      assert.deepEqual([p!.evidencia[0]!.estado, p!.evidencia[0]!.degradado], ['ambiguo', true]);
      const o = await admin.query<{ texto: string; v: boolean }>(
        `select texto, cita_verificada as v from negocio.objeciones_de_llamada where corrida_id = $1 order by texto`, [c.corrida_id]);
      // Control: lo que sí está en la transcripción real se verifica.
      assert.deepEqual(o.rows.map((x) => [x.texto, x.v]), [['el precio no me preocupa', false], ['no tengo tiempo ahora', true]]);
    },
  );
});

test('4 · el Triage en sombra no pide escribir en GHL y avisa; en activo, sí', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
    },
    async () => {
      const sombra = await unTriage('ghl-502-a', 'sombra', 'sombra');
      assert.equal(sombra.escribir_en_ghl, null);
      assert.match(String(sombra.aviso), /modo sombra/);
      const activo = await unTriage('ghl-502-a', 'activo', 'activo');
      assert.deepEqual(activo.escribir_en_ghl, { prioridad: 3, ruta: 'alto_ticket' });
      assert.equal(activo.aviso, null);
      const aplicados = await admin.query<{ aplicado: boolean }>(
        `select t.aplicado from negocio.triajes t where t.id = any ($1::uuid[]) order by t.aplicado`, [[sombra.triaje_id, activo.triaje_id]]);
      assert.deepEqual(aplicados.rows.map((x) => x.aplicado), [false, true]);
      // En sombra no se asigna la ruta.
      const rutas = await admin.query<{ id_externo: string }>(
        `select id_externo from negocio.eventos where tipo = 'ruta_asignada' and datos ->> 'corrida_id' = any ($1::text[])`,
        [[sombra.corrida_id, activo.corrida_id]]);
      assert.equal(rutas.rows.length, 1);
      assert.ok(rutas.rows[0]!.id_externo.includes(activo.corrida_id));
    },
  );
});

test('5 · una llamada, una venta: la propuesta nueva reemplaza a la vieja, y confirmada una no se confirma otra', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
    },
    async () => {
      const la = await j(`select agentes.registrar_llamada($1, 'ghl-502-a', 'llamada-502-a', 'venta', 'ghl', 'Lead A: lo tomo.') as r`, [LOC]);
      const p1 = await unSalesCoach('ghl-502-a', la.llamada_id, 'sc-1');
      const p2 = await unSalesCoach('ghl-502-a', la.llamada_id, 'sc-2');
      const viejo = await unaFila<{ estado: string; motivo_decision: string }>(admin,
        `select estado, motivo_decision from negocio.resultados_propuestos where id = $1`, [p1.resultado_propuesto_id]);
      assert.deepEqual([viejo!.estado, viejo!.motivo_decision], ['rechazado', `reemplazado por la corrida ${p2.corrida_id}`]);
      const c1 = await j(`select agentes.confirmar_resultado($1, 'confirmado', $2) as r`, [p1.resultado_propuesto_id, aria.persona]);
      assert.equal(c1.ok, false, JSON.stringify(c1));
      const c2 = await j(`select agentes.confirmar_resultado($1, 'confirmado', $2) as r`, [p2.resultado_propuesto_id, aria.persona]);
      assert.equal(c2.ok, true, JSON.stringify(c2));
      // Una tercera corrida después de la confirmación propone, pero no se confirma.
      const p3 = await unSalesCoach('ghl-502-a', la.llamada_id, 'sc-3');
      const e3 = await unaFila<{ estado: string }>(admin, `select estado from negocio.resultados_propuestos where id = $1`, [p3.resultado_propuesto_id]);
      assert.equal(e3!.estado, 'propuesto');
      const c3 = await j(`select agentes.confirmar_resultado($1, 'confirmado', $2) as r`, [p3.resultado_propuesto_id, aria.persona]);
      assert.equal(c3.ok, false);
      assert.match(JSON.stringify(c3.errores), /ya tiene un resultado confirmado/);
      const n = await unaFila<{ resultados: string; clientes: string }>(admin,
        `select (select count(*) from negocio.resultados where contacto_id = $1) as resultados,
                (select count(*) from negocio.clientes where contacto_id = $1) as clientes`, [await idDe('ghl-502-a')]);
      assert.deepEqual([Number(n!.resultados), Number(n!.clientes)], [1, 1]);
    },
  );
});

test('6 · la venta se acredita al closer de la llamada, no a quien la confirma', async () => {
  let closer = '';
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
      closer = (await unaFila<{ id: string }>(admin,
        `insert into identidad.usuarios (org_id, nombre) values ($1, 'Closer 502') returning id`, [aria.org]))!.id;
    },
    async () => {
      assert.notEqual(closer, aria.persona);
      const la = await j(`select agentes.registrar_llamada($1, 'ghl-502-a', 'llamada-502-a', 'venta', 'ghl', 'Lead A: lo tomo.',
                                                            '[]', null, null, null, $2) as r`, [LOC, closer]);
      const p = await unSalesCoach('ghl-502-a', la.llamada_id, 'sc-closer');
      const c = await j(`select agentes.confirmar_resultado($1, 'confirmado', $2) as r`, [p.resultado_propuesto_id, aria.persona]);
      assert.equal(c.ok, true, JSON.stringify(c));
      const r = await unaFila<{ closer_id: string; registrado_por: string }>(admin,
        `select closer_id, registrado_por from negocio.resultados where id = $1`, [c.resultado_id]);
      assert.deepEqual(r, { closer_id: closer, registrado_por: aria.persona });
    },
  );
});

test('7 · la etapa previa tiene que estar aprobada en el MISMO lead: lo aprobado de A no habilita a B', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
      await unLead('ghl-502-b', 'b@502.test');
    },
    async () => {
      await armarExpediente('ghl-502-a', 'MARCA_A');
      const intento = async (ghl: string, agente: string, sujeto: object, salida: object) => {
        const c = await abrir(agente, ghl, `previa-${agente}-${ghl}`, sujeto);
        return j(`select agentes.registrar_${agente}($1, $2) as r`, [c.corrida_id, salida]);
      };
      const icp = { texto: '# ICP', contenido: { a_quien_si: [{ criterio: 'clínicas' }], a_quien_no: [] } };
      const research = await intento('ghl-502-b', 'research', { paso: 'mr_segmentos' }, { texto: '# S', segmentos: [{ nombre: 'Clínicas' }] });
      assert.equal(research.ok, false);
      assert.match(JSON.stringify(research.errores), /Brief/);
      const estratega = await intento('ghl-502-b', 'estratega', { etapa: 'icp' }, icp);
      assert.equal(estratega.ok, false);
      assert.match(JSON.stringify(estratega.errores), /mr_decision/);
      const funnel = await intento('ghl-502-b', 'funnel_builder', { pieza: 'anuncios' },
        { texto: '# A', variantes: [{ codigo_de_nomenclatura: 'AD_B', titular: 't' }] });
      assert.equal(funnel.ok, false);
      assert.match(JSON.stringify(funnel.errores), /precio_y_process_map/);
      // Control: lo mismo sobre A, que tiene todo aprobado, pasa.
      const a = await intento('ghl-502-a', 'estratega', { etapa: 'icp' }, icp);
      assert.equal(a.ok, true, JSON.stringify(a));
    },
  );
});

test('8 · el comportamiento del expediente es lo que hizo el lead, no lo que anotaron los agentes', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
      await unLead('ghl-502-b', 'b@502.test');
    },
    async () => {
      const a = await armarExpediente('ghl-502-a', 'MARCA_A');
      await unTriage('ghl-502-a', 'tr');
      const comportamiento = async () => (await unaFila<{ c: Record<string, number> | null }>(admin,
        `select comportamiento as c from negocio.expediente_del_lead where contacto_id = $1`, [a.lead]))!.c ?? {};
      const delAgente = ['entregable_propuesto', 'triaje_registrado', 'agente_corrida_lista', 'ruta_asignada'];
      // Control: los agentes sí los anotaron (si no, que falten no probaría nada).
      const anotados = await admin.query<{ tipo: string }>(
        `select distinct tipo from negocio.eventos where contacto_id = $1 and fuente = 'ghl_managed_agents'`, [a.lead]);
      for (const t of delAgente) assert.ok(anotados.rows.some((x) => x.tipo === t), `ningún agente anotó ${t}`);
      const antes = await comportamiento();
      for (const t of delAgente) assert.ok(!(t in antes), `el comportamiento de A trae ${t}: ${JSON.stringify(antes)}`);
      // Lo que hizo el lead, sí.
      const deLead = (contacto: string, ext: string) => comoAdmin(() => admin.query(
        `insert into negocio.eventos (org_id, cuenta_id, ocurrio_el, tipo, contacto_id, actor_tipo, fuente, id_externo)
         values ($1, $2, now(), 'vsl_visto', $3, 'lead', 'ghl', $4)`, [aria.org, aria.cuenta, contacto, ext]));
      await deLead(a.lead, 'vsl:502-a');
      const conVsl = await comportamiento();
      assert.equal(conVsl.vsl_visto, 1);
      // Lo que hizo B no cambia el de A.
      await deLead(await idDe('ghl-502-b'), 'vsl:502-b');
      assert.deepEqual(await comportamiento(), conVsl);
    },
  );
});

test('9 · vincular_lo_del_agente como el inquilino: el lead que llega vincula lo suyo y no lo de otro; el inquilino lee el expediente', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
    },
    async () => {
      const a = await armarExpediente('ghl-502-a', 'MARCA_A');
      // Dos Triage pendientes (sin contacto), con su evidencia y lo que hicieron afuera.
      const pendiente = async (ghl: string) => {
        const t = await j(`select agentes.abrir_corrida('triage', $1, $2, $3) as r`, [LOC, ghl, `p-${ghl}`]);
        assert.equal(t.contacto_id, null);
        await j(`select agentes.registrar_fuente_publica($1, 'web', $2) as r`, [t.corrida_id, `Su web (${ghl})`]);
        await j(`select agentes.registrar_accion_externa($1, 'nota', 'ghl') as r`, [t.corrida_id]);
        return t.corrida_id as string;
      };
      const otra = await pendiente('ghl-502-otro');
      const tarde = await pendiente('ghl-502-tarde');
      const vinculos = (corrida: string) => unaFila<{ corrida: string | null; fuente: string | null; accion: string | null }>(admin,
        `select (select contacto_id from negocio.corridas_de_agente where id = $1)::text as corrida,
                (select contacto_id from negocio.fuentes_publicas where corrida_id = $1)::text as fuente,
                (select contacto_id from negocio.acciones_externas where corrida_id = $1)::text as accion`, [corrida]);

      // El contacto llega como lo escribe la aplicación: el inquilino, con su organización y sus cuentas.
      await admin.query('reset role');
      await admin.query('set local role app_inquilino');
      await admin.query(`select set_config('app.org_id', $1, true), set_config('app.cuentas', '*', true),
                                set_config('app.toda_la_organizacion', 'si', true)`, [aria.org]);
      const nuevo = await unaFila<{ id: string }>(admin,
        `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente) values ($1, $2, 'ghl-502-tarde', 'Tarde', 'meta') returning id`,
        [aria.org, aria.cuenta]);
      // Y el inquilino lee el expediente de A, entero.
      const ex = await admin.query(`select * from negocio.expediente_del_lead where contacto_id = $1`, [a.lead]);
      await admin.query(`select set_config('app.org_id', '', true), set_config('app.cuentas', '', true),
                                set_config('app.toda_la_organizacion', '', true)`);
      await admin.query('reset role');
      await admin.query('set local role mcp_simulado');

      assert.deepEqual(await vinculos(tarde), { corrida: nuevo!.id, fuente: nuevo!.id, accion: nuevo!.id });
      assert.deepEqual(await vinculos(otra), { corrida: null, fuente: null, accion: null }, 'se vinculó lo de otro lead');
      assert.equal(ex.rows.length, 1);
      const fila = ex.rows[0] as Record<string, unknown>;
      assert.match(JSON.stringify(fila.icp_del_lead), /ICP MARCA_A/);
      assert.match(JSON.stringify(fila.research), /Segmento MARCA_A/);
      assert.match(JSON.stringify(fila.formulario), /factura 8 mil \(ghl-502-a\)/);
    },
  );
});

/** Las filas de un lead en cada tabla de los agentes. */
const TABLAS_DEL_LEAD = ['entregables', 'versiones_de_entregable', 'respuestas_del_brief', 'segmentos_del_mercado', 'dolores_del_segmento',
  'referentes_del_mercado', 'citas_del_mercado', 'piezas_de_contenido', 'decisiones_de_kickoff', 'transcripciones', 'fuentes_publicas',
  'corridas_de_agente', 'triajes'];
async function filasDe(lead: string): Promise<Record<string, number>> {
  const r = await unaFila<Record<string, string>>(admin,
    `select ${TABLAS_DEL_LEAD.map((t) => `(select count(*) from negocio.${t} where contacto_id = $1) as ${t}`).join(', ')}`, [lead]);
  return Object.fromEntries(Object.entries(r!).map(([k, v]) => [k, Number(v)]));
}

/** Un expediente con todo: el de armarExpediente, los dolores con su cita, un anuncio sobre el dolor, los referentes (con
 *  su evidencia pública, si se pide), una llamada con transcripción y un Triage. */
async function expedienteCompleto(ghl: string, marca: string, referenteConEvidencia = false): Promise<string> {
  const e = await armarExpediente(ghl, marca);
  const dol = await abrir('research', ghl, `dol-${ghl}`, { paso: 'mr_dolores' });
  await j(`select agentes.leer_research($1) as r`, [dol.corrida_id]);
  const pub = await j(`select agentes.registrar_fuente_publica($1, 'foro', $2) as r`, [dol.corrida_id, `Me hacen esperar una hora ${marca}`]);
  const vd = await j(`select agentes.registrar_research($1, $2) as r`, [dol.corrida_id, {
    texto: `# Dolores ${marca}`, dolores: [{ segmento: `Segmento ${marca}`, descripcion: 'esperas', intensidad: 4, es_critico: true }],
    citas: [{ texto: 'me hacen esperar una hora', fuente: pub.fuente, dolor: 'esperas', segmento: `Segmento ${marca}` }],
  }]);
  assert.equal(vd.ok, true, JSON.stringify(vd));
  const ref = await abrir('research', ghl, `ref-${ghl}`, { paso: 'mr_referentes' });
  await j(`select agentes.leer_research($1) as r`, [ref.corrida_id]);
  const vr = await j(`select agentes.registrar_research($1, $2) as r`, [ref.corrida_id, {
    texto: `# Referentes ${marca}`,
    referentes: [{ nombre: `Referente ${marca}`, segmento: `Segmento ${marca}`, ...(referenteConEvidencia ? { fuente: pub.fuente } : {}) }],
  }]);
  assert.equal(vr.ok, true, JSON.stringify(vr));
  const f = await abrir('funnel_builder', ghl, `f-dolor-${ghl}`, { pieza: 'anuncios' });
  await j(`select agentes.leer_funnel_builder($1) as r`, [f.corrida_id]);
  const va = await j(`select agentes.registrar_funnel_builder($1, $2) as r`, [f.corrida_id, {
    texto: `# Anuncios del dolor ${marca}`, variantes: [{ codigo_de_nomenclatura: `AD_DOLOR_${marca}`, titular: 'Sin esperas', dolor: 'esperas' }],
  }]);
  assert.equal(va.ok, true, JSON.stringify(va));
  const conDolor = await unaFila<{ n: string }>(admin,
    `select count(*) as n from negocio.piezas_de_contenido where version_id = $1 and dolor_id is not null`, [va.version_id]);
  assert.equal(Number(conDolor!.n), 1, 'la pieza no quedó atada a su dolor');
  await j(`select agentes.registrar_llamada($1, $2, $3, 'venta', 'ghl', $4) as r`, [LOC, ghl, `llamada-${ghl}`, `Lead ${marca}: lo pienso.`]);
  await unTriage(ghl, `tr-${ghl}`);
  return e.lead;
}

test('10 · borrar un lead se lleva lo suyo de cada tabla de los agentes, y nada de B', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
      await unLead('ghl-502-b', 'b@502.test');
    },
    async () => {
      const a = await expedienteCompleto('ghl-502-a', 'MARCA_A');
      const b = await expedienteCompleto('ghl-502-b', 'MARCA_B');
      const deA = await filasDe(a);
      // Control: A tiene filas en todas (si no, que queden en cero no probaría nada).
      for (const [t, n] of Object.entries(deA)) assert.ok(n > 0, `${t}: A no tiene filas`);
      const deB = await filasDe(b);
      await comoAdmin(() => admin.query(`delete from negocio.contactos where id = $1`, [a]));
      assert.deepEqual(await filasDe(a), Object.fromEntries(TABLAS_DEL_LEAD.map((t) => [t, 0])));
      assert.deepEqual(await filasDe(b), deB, 'borrar a A cambió lo de B');
    },
  );
});

test('10b · borrar un lead cuyo referente cita una evidencia pública', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
    },
    async () => {
      const a = await expedienteCompleto('ghl-502-a', 'MARCA_A', true);
      const con = await unaFila<{ n: string }>(admin,
        `select count(*) as n from negocio.referentes_del_mercado where contacto_id = $1 and fuente_publica_id is not null`, [a]);
      assert.equal(Number(con!.n), 1, 'el referente no quedó con su evidencia');
      await comoAdmin(() => admin.query(`delete from negocio.contactos where id = $1`, [a]));
      assert.deepEqual(await filasDe(a), Object.fromEntries(TABLAS_DEL_LEAD.map((t) => [t, 0])));
    },
  );
});

test('10c · borrar un lead no deja sus corridas huérfanas con lo que leyeron y escribieron de él', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
    },
    async () => {
      const a = await expedienteCompleto('ghl-502-a', 'MARCA_A');
      await comoAdmin(() => admin.query(`delete from negocio.contactos where id = $1`, [a]));
      const r = await unaFila<{ n: string; con_datos: string }>(admin,
        `select count(*) as n, count(*) filter (where (leido::text || coalesce(salida::text, '')) like '%MARCA_A%'
                                                   or (leido::text || coalesce(salida::text, '')) like '%ghl-502-a%') as con_datos
           from negocio.corridas_de_agente where ghl_contact_id = 'ghl-502-a'`);
      assert.deepEqual([Number(r!.n), Number(r!.con_datos)], [0, 0], 'quedaron corridas del lead borrado');
    },
  );
});

test('11 · registrar_llamada con el id externo de la llamada de A, para B: 42501, y la de A queda igual', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
      await unLead('ghl-502-b', 'b@502.test');
    },
    async () => {
      const la = await j(`select agentes.registrar_llamada($1, 'ghl-502-a', 'llamada-502', 'venta', 'ghl', 'Lead A: me interesa.') as r`, [LOC]);
      const foto = () => unaFila<Record<string, unknown>>(admin,
        `select l.contacto_id, l.resumen, l.persona_id, l.duracion_segundos, l.url_de_la_grabacion,
                (select count(*) from negocio.transcripciones t where t.llamada_id = l.id) as transcripciones
           from negocio.llamadas l where l.id = $1`, [la.llamada_id]);
      const antes = await foto();
      await fallaCon('42501', `select agentes.registrar_llamada($1, 'ghl-502-b', 'llamada-502', 'venta', 'ghl', null, '[]', null, 99, null, $2, 'https://b.test/grabacion', 'Resumen de B')`,
        [LOC, aria.persona]);
      assert.deepEqual(await foto(), antes);
    },
  );
});

test('12 · registrar_sales_coach rechaza una salida que nombra otro lead, también por «email»', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
      await unLead('ghl-502-b', 'b@502.test');
    },
    async () => {
      const la = await j(`select agentes.registrar_llamada($1, 'ghl-502-a', 'llamada-502-a', 'venta', 'ghl', 'Lead A: lo tomo.') as r`, [LOC]);
      const c = await abrir('sales_coach', 'ghl-502-a', 'sc-otro', { llamada_id: la.llamada_id });
      await j(`select agentes.leer_sales_coach($1) as r`, [c.corrida_id]);
      // Tres intentos (al quinto la corrida fallaría): el correo, el contact_id de GHL y el id de la base de B.
      for (const otro of [{ email: 'b@502.test' }, { contact_id: 'ghl-502-b' }, { contacto_id: await idDe('ghl-502-b') }]) {
        const r = await j(`select agentes.registrar_sales_coach($1, $2) as r`, [c.corrida_id, { ...VENTA, ...otro }]);
        assert.equal(r.ok, false, JSON.stringify(otro));
        assert.match(JSON.stringify(r.errores), /nombra otro/, `rechazado por otra razón: ${JSON.stringify(r)}`);
      }
      const n = await unaFila<{ n: string }>(admin, `select count(*) as n from negocio.resultados_propuestos where corrida_id = $1`, [c.corrida_id]);
      assert.equal(Number(n!.n), 0, 'un intento rechazado escribió un resultado');
      // Control: el correo del mismo lead pasa.
      const mismo = await j(`select agentes.registrar_sales_coach($1, $2) as r`, [c.corrida_id, { ...VENTA, email: ' A@502.test' }]);
      assert.equal(mismo.ok, true, JSON.stringify(mismo));
    },
  );
});

test('13 · las citas que usa una pieza son de su lead: las de otro se descartan al registrar, y la base las rechaza', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
      await unLead('ghl-502-b', 'b@502.test');
    },
    async () => {
      const a = await armarExpediente('ghl-502-a', 'MARCA_A');
      const b = await armarExpediente('ghl-502-b', 'MARCA_B');
      const citaDe = async (lead: string) =>
        (await unaFila<{ id: string }>(admin, `select id from negocio.citas_del_mercado where contacto_id = $1 limit 1`, [lead]))!.id;
      const [citaA, citaB] = [await citaDe(a.lead), await citaDe(b.lead)];
      const f = await abrir('funnel_builder', 'ghl-502-a', 'f2', { pieza: 'anuncios' });
      await j(`select agentes.leer_funnel_builder($1) as r`, [f.corrida_id]);
      const v = await j(`select agentes.registrar_funnel_builder($1, $2) as r`, [f.corrida_id, {
        texto: '# Anuncios 2', variantes: [{ codigo_de_nomenclatura: 'AD_2', titular: 'Titular 2', citas_usadas: [citaA, citaB] }],
      }]);
      assert.equal(v.ok, true, JSON.stringify(v));
      const pieza = await unaFila<{ id: string; citas_usadas: string[] }>(admin,
        `select id, citas_usadas from negocio.piezas_de_contenido where version_id = $1`, [v.version_id]);
      assert.deepEqual(pieza!.citas_usadas, [citaA]);
      await comoAdmin(() => fallaCon('23503', `update negocio.piezas_de_contenido set citas_usadas = $2 where id = $1`, [pieza!.id, [citaB]]));
    },
  );
});

test('14 · las rutas de la cuenta no llegan a los agentes del cliente (sí al Triage)', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
      await admin.query(`select agentes.cargar_rutas($1, '[{"clave": "ruta_aria", "nombre": "RUTA_DE_ARIA", "clase": "alto_ticket"}]', $2)`,
        [aria.cuenta, aria.persona]);
    },
    async () => {
      await armarExpediente('ghl-502-a', 'MARCA_A');
      for (const [agente, sujeto] of [['brief', {}], ['research', { paso: 'mr_dolores' }], ['estratega', { etapa: 'precio_y_process_map' }],
        ['funnel_builder', { pieza: 'guion_vsl' }]] as const) {
        const c = await abrir(agente, 'ghl-502-a', `rutas-${agente}`, sujeto);
        const p = await j(`select agentes.leer_${agente}($1) as r`, [c.corrida_id]);
        const texto = JSON.stringify(p);
        assert.ok(texto.includes('MARCA_A'), `el paquete de ${agente} viene vacío`);
        assert.ok(!texto.includes('RUTA_DE_ARIA'), `${agente} leyó las rutas de la cuenta`);
      }
      const t = await j(`select agentes.abrir_corrida('triage', $1, 'ghl-502-a', 'rutas-triage') as r`, [LOC]);
      assert.match(JSON.stringify(await j(`select agentes.leer_triage($1) as r`, [t.corrida_id])), /RUTA_DE_ARIA/);
    },
  );
});
