// LA PUERTA DE LOS AGENTES DESPUÉS DE LA LIMPIEZA (la migración 119). Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (decisiones del usuario del 2026-11-20; 28-LIMPIEZA-DE-NEGOCIO.md, etapa 1)
//
// La 119 borró lo que Triage, Sales Assistant, Sales Coach y Brief dejaron sin uso con la fase 1 (118). La 500 probaba
// eso y se borró con ello; acá queda lo que la 500 cubría de la puerta que sigue:
//
//   1 · abrir_corrida: la misma clave reutiliza la corrida, la misma clave para otro lead es 42501, una corrida nueva
//       del mismo sujeto reemplaza a la abierta; el modo sombra ya no existe; «siguiente» apunta a lo de la fase 1
//       (registrar_cuadrante, guardar_respuesta) y, en los demás agentes, a su leer_ — mutaciones: la sombra permitida
//       de nuevo y el «siguiente» viejo;
//   2 · leer_llamada: la llamada de venta más reciente del lead con su transcripción ENTERA, y nunca la de otro lead,
//       ni pidiéndola por su id; sin llamada, lo dice; lo leído queda en la corrida — mutación: sin el filtro por lead;
//   3 · el lead que llega después vincula su corrida, su evidencia y su acción (el disparador sin triajes: un alta de
//       contacto no falla) — mutación: el disparador sin vincular la evidencia;
//   4 · lo borrado no existe: las 10 tablas, sus vistas, sus funciones, las columnas del comprador y los catálogos
//       huérfanos; ninguna función de la puerta es de PUBLIC;
//   5 · el expediente sigue dando su fila al inquilino, sin las secciones borradas.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';

let admin: Client;
let aria: { org: string; cuenta: string };
const LOC = 'loc-505';

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

const abrir = (agente: string, ghl: string, clave: string, sujeto: object = {}, modo = 'activo') =>
  j(`select agentes.abrir_corrida($1, $2, $3, $4, '{}'::jsonb, null, $5, null, null, $6) as r`, [agente, LOC, ghl, clave, sujeto, modo]);

async function unLead(marca: string): Promise<{ ghl: string; id: string }> {
  const ghl = `ghl-505-${marca}-${randomUUID().slice(0, 8)}`;
  const c = await comoAdmin(() => unaFila<{ id: string }>(admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente) values ($1, $2, $3, $4, 'meta') returning id`,
    [aria.org, aria.cuenta, ghl, `Lead ${marca}`]));
  return { ghl, id: c!.id };
}

test('1 · abrir_corrida: reutiliza, rechaza la clave de otro lead, reemplaza la abierta, sin sombra, y «siguiente» de la fase 1', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('a');
    const b = await unLead('b');
    const c1 = await abrir('sales_assistant', a.ghl, 'clave-a');
    assert.equal(c1.ok, true, JSON.stringify(c1));
    assert.ok(!('cliente_id' in c1), 'abrir_corrida todavía devuelve cliente_id');
    const otra = await abrir('sales_assistant', a.ghl, 'clave-a');
    assert.deepEqual([otra.corrida_id, otra.reutilizada], [c1.corrida_id, true]);
    await fallaCon('42501', `select agentes.abrir_corrida('sales_assistant', $1, $2, 'clave-a')`, [LOC, b.ghl]);
    // Una corrida nueva del mismo sujeto reemplaza a la abierta.
    const c2 = await abrir('sales_assistant', a.ghl, 'clave-a-2');
    assert.deepEqual(c2.reemplazo_a, [c1.corrida_id]);
    // El modo sombra era del Triage estructurado: ya no existe.
    const m = await fallaCon('22023', `select agentes.abrir_corrida('triage', $1, $2, 'sombra', '{}', null, '{}', null, null, 'sombra')`, [LOC, a.ghl]);
    assert.match(m, /ningún agente corre en modo sombra/);
    // «Siguiente»: los de la fase 1 apuntan a su función de guardar; los demás, a su leer_.
    const t = await abrir('triage', a.ghl, 'sig-t');
    assert.match(t.siguiente, /registrar_cuadrante/);
    assert.match(c2.siguiente, /guardar_respuesta/);
    const br = await abrir('brief', a.ghl, 'sig-b');
    assert.match(br.siguiente, /guardar_respuesta/);
    const re = await abrir('research', a.ghl, 'sig-r', { paso: 'mr_segmentos' });
    assert.match(re.siguiente, /leer_research/);
  });
});

test('2 · leer_llamada: la de venta más reciente del lead, entera; nunca la de otro lead', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('a');
    const b = await unLead('b');
    const larga = `Closer: cuéntame. Lead A: ${'mucho detalle '.repeat(600)}FIN-DE-A`;
    const vieja = await j(`select agentes.registrar_llamada($1, $2, 'grab-a-1', 'venta', 'fathom', 'Lead A: la primera llamada.', '[]', now() - interval '2 days') as r`,
      [LOC, a.ghl]);
    const nueva = await j(`select agentes.registrar_llamada($1, $2, 'grab-a-2', 'venta', 'fathom', $3, '[]', now() - interval '1 hour') as r`,
      [LOC, a.ghl, larga]);
    const deB = await j(`select agentes.registrar_llamada($1, $2, 'grab-b', 'venta', 'fathom', 'Lead B: SECRETO-DE-B.', '[]', now()) as r`,
      [LOC, b.ghl]);
    const sc = await abrir('sales_coach', a.ghl, 'sc-a');
    const l = await j(`select agentes.leer_llamada($1) as r`, [sc.corrida_id]);
    assert.equal(l.llamada_id, nueva.llamada_id, 'no trajo la más reciente');
    assert.ok(l.transcripcion.length > 4000 && l.transcripcion.endsWith('FIN-DE-A'), 'la transcripción no vino entera');
    assert.ok(!JSON.stringify(l).includes('SECRETO-DE-B'));
    // La indicada, si es del lead; la de otro lead, no, aunque se la pida por su id.
    assert.equal((await j(`select agentes.leer_llamada($1, $2) as r`, [sc.corrida_id, vieja.llamada_id])).llamada_id, vieja.llamada_id);
    const ajena = await j(`select agentes.leer_llamada($1, $2) as r`, [sc.corrida_id, deB.llamada_id]);
    assert.equal(ajena.llamada_id, null);
    assert.match(ajena.motivo, /no es de este lead/);
    // Lo leído queda en la corrida, con su clave citable.
    const leido = await unaFila<{ k: string[] }>(admin,
      `select array(select jsonb_object_keys(leido -> 'fuentes')) as k from negocio.corridas_de_agente where id = $1`, [sc.corrida_id]);
    assert.ok(leido!.k.includes(`llamada_venta:${nueva.llamada_id}`));
    // Un lead sin llamadas: lo dice.
    const c = await unLead('c');
    const sin = await j(`select agentes.leer_llamada($1) as r`, [(await abrir('sales_coach', c.ghl, 'sc-c')).corrida_id]);
    assert.equal(sin.llamada_id, null);
    assert.match(sin.motivo, /no tiene una llamada de venta/);
  });
});

test('3 · el lead que llega después vincula su corrida, su evidencia y su acción (el alta de contacto no falla)', async () => {
  await enUnEnsayo(async () => {
    const ghl = `ghl-505-tarde-${randomUUID().slice(0, 8)}`;
    const t = await abrir('triage', ghl, 'tarde');
    assert.equal(t.contacto_id, null);
    await j(`select agentes.registrar_fuente_publica($1, 'web', 'Su web') as r`, [t.corrida_id]);
    await j(`select agentes.registrar_accion_externa($1, 'campo_del_crm', 'contact.cuadrante_de_clasificacion') as r`, [t.corrida_id]);
    const nuevo = await comoAdmin(() => unaFila<{ id: string }>(admin,
      `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente) values ($1, $2, $3, 'Tarde', 'meta') returning id`,
      [aria.org, aria.cuenta, ghl]));
    const v = await unaFila<{ corrida: string; fuente: string; accion: string }>(admin,
      `select (select contacto_id from negocio.corridas_de_agente where id = $1)::text as corrida,
              (select contacto_id from negocio.fuentes_publicas where corrida_id = $1)::text as fuente,
              (select contacto_id from negocio.acciones_externas where corrida_id = $1)::text as accion`, [t.corrida_id]);
    assert.deepEqual(v, { corrida: nuevo!.id, fuente: nuevo!.id, accion: nuevo!.id });
    // Y ahora el Triage guarda su cuadrante sobre el lead que llegó.
    const t2 = await abrir('triage', ghl, 'tarde-2');
    assert.equal((await j(`select agentes.registrar_cuadrante($1, 'valida', 'llegó') as r`, [t2.corrida_id])).ok, true);
  });
});

test('4 · lo borrado no existe, y ninguna función de la puerta es de PUBLIC', async () => {
  const tablas = ['triajes', 'fichas_del_lead', 'resultados_propuestos', 'evaluaciones_de_llamada', 'objeciones_de_llamada',
    'borradores_de_mensaje', 'rutas_de_la_cuenta', 'conocimiento_de_la_cuenta', 'clientes', 'pagos',
    'triaje_vigente', 'ficha_vigente', 'conocimiento_vigente'];
  const quedan = await filas<{ t: string }>(admin,
    `select t from unnest($1::text[]) t where to_regclass('negocio.' || t) is not null`, [tablas]);
  assert.deepEqual(quedan, [], 'quedan tablas o vistas borradas');
  const catalogos = await filas<{ t: string }>(admin,
    `select t from unnest(array['tipos_de_conocimiento', 'clases_de_ruta']) t where to_regclass('catalogo.' || t) is not null`);
  assert.deepEqual(catalogos, []);
  const funciones = await filas<{ f: string }>(admin,
    `select p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'agentes' and p.proname in ('registrar_triage', 'leer_triage', 'registrar_sales_assistant',
        'leer_sales_assistant', 'marcar_ficha_leida', 'registrar_sales_coach', 'leer_sales_coach', 'decidir_borrador',
        'confirmar_resultado', 'alta_del_comprador', 'registrar_pago', 'registrar_contrato', 'cargar_rutas',
        'cargar_conocimiento', 'leer_conocimiento', '_conocimiento')`);
  assert.deepEqual(funciones, [], 'quedan funciones borradas');
  const columnas = await filas<{ c: string }>(admin,
    `select table_name || '.' || column_name as c from information_schema.columns
      where table_schema = 'negocio' and ((table_name = 'corridas_de_agente' and column_name in ('cliente_id', 'vendedor_org_id',
        'vendedor_cuenta_id', 'vendedor_contacto_id')) or (table_name = 'fuentes_publicas' and column_name = 'cliente_id'))`);
  assert.deepEqual(columnas, [], 'quedan las columnas del comprador');
  // Ninguna función que queda nombra lo borrado (una que lo nombrara fallaría recién al llamarla).
  const nombran = await filas<{ f: string }>(admin,
    `select p.oid::regprocedure::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('agentes', 'negocio')
        and p.prosrc ~ ('(negocio\\.)?(triajes|fichas_del_lead|resultados_propuestos|evaluaciones_de_llamada|objeciones_de_llamada|'
                        || 'borradores_de_mensaje|rutas_de_la_cuenta|conocimiento_de_la_cuenta|triaje_vigente|ficha_vigente|conocimiento_vigente|'
                        || 'tipos_de_conocimiento|clases_de_ruta)\\y|negocio\\.(clientes|pagos)\\y|\\.(cliente_id|vendedor_org_id|vendedor_cuenta_id|vendedor_contacto_id)\\y|'
                        || 'agentes\\.(registrar_triage|leer_triage|registrar_sales_assistant|leer_sales_assistant|marcar_ficha_leida|'
                        || 'registrar_sales_coach|leer_sales_coach|decidir_borrador|confirmar_resultado|alta_del_comprador|registrar_pago|'
                        || 'registrar_contrato|cargar_rutas|cargar_conocimiento|leer_conocimiento|_conocimiento)\\(')`);
  assert.deepEqual(nombran, [], 'una función que queda nombra algo borrado');
  const publicas = await filas<{ f: string }>(admin,
    `select p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'agentes' and (has_function_privilege('public', p.oid, 'execute')
        or not has_function_privilege('agente_mcp', p.oid, 'execute'))`);
  assert.deepEqual(publicas, [], 'nada para PUBLIC y todo para el rol de los agentes');
});

test('5 · el expediente sigue dando su fila al inquilino, sin las secciones borradas', async () => {
  await enUnEnsayo(async () => {
    const a = await unLead('e');
    await comoAdmin(async () => {
      await admin.query('set local role app_inquilino');
      await admin.query(`select set_config('app.org_id', $1, true), set_config('app.cuentas', '*', true),
                                set_config('app.toda_la_organizacion', 'si', true)`, [aria.org]);
      const r = await admin.query(`select * from negocio.expediente_del_lead where contacto_id = $1`, [a.id]);
      await admin.query(`select set_config('app.org_id', '', true), set_config('app.cuentas', '', true),
                                set_config('app.toda_la_organizacion', '', true)`);
      await admin.query('reset role');
      assert.equal(r.rows.length, 1, 'el inquilino no ve el expediente: ¿perdió security_invoker?');
      const columnas = Object.keys(r.rows[0] as object);
      for (const c of ['ficha', 'evaluacion', 'objeciones', 'seguimientos']) assert.ok(!columnas.includes(c), `queda la sección ${c}`);
      for (const c of ['identidad', 'formulario', 'triaje', 'resultado', 'respuestas_de_los_agentes', 'brief', 'research']) {
        assert.ok(columnas.includes(c), `falta la sección ${c}`);
      }
    });
  });
});
