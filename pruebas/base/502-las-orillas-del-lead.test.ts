// LAS ORILLAS DEL LEAD (la migración 115, lo que la 501 no cubre; sin lo que borró la 124). Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (MANAGED-AGENTS-CORRECCION-DATOS-POR-LEAD.md, decisiones del usuario del 2026-11-11 y del
// 2026-11-24)
//
// La 501 prueba el centro: lo que producen los agentes es del lead. Éste prueba las orillas, donde un lead todavía se
// puede colar en el de otro: la clave de idempotencia, la cita y la llamada del sujeto, las fuentes citables, el
// comportamiento, el lead que llega tarde, el borrado y la llamada con el id de otro. (El modo sombra, la venta, el
// closer y las rutas se borraron en la 119; los entregables, el Brief estructurado, el kickoff y las piezas, en la 124.)
// Con dos leads A y B en la cuenta de ARIA, y lo que dejan los agentes de la fase 1 (118 a 124):
//
//   1 · la clave de idempotencia es de UN lead: con otro lead (o con un lead que no estaba y ahora sí) es 42501, y con
//       el mismo se reutiliza — mutación: volver a la condición vieja (sólo contacto_id distinto y no nulo);
//   2 · la cita de otro lead no reemplaza la corrida de A, y la llamada de otro lead no abre el Sales Coach de A —
//       mutación: quitar `ci.contacto_id = v_contacto.id` de abrir_corrida;
//   3 · en las claves de fuente que arma la base (llamada_venta:, publica:) gana lo leído y la entrada no las inventa;
//       la entrada sólo aporta sus propias claves (ghl:…) — mutación: _texto_de_la_fuente con coalesce(entrada, leido);
//   (4, 5 y 6 · el Triage en sombra y la venta propuesta y confirmada: se borraron en la 119.)
//   (7 · la etapa previa aprobada en el mismo lead: se borró en la 124, con los entregables.)
//   8 · el comportamiento del expediente es lo que hizo el lead, no lo que anotaron los agentes
//       (agente_corrida_lista, respuesta_de_agente_guardada) ni Comando Central — mutación: quitar de la vista el filtro
//       `ev.fuente not in ('ghl_managed_agents', 'comando_central')`;
//   9 · vincular_lo_del_agente como el inquilino: el lead que llega vincula su corrida, su evidencia y su acción, y no
//       las de otro lead pendiente; el inquilino lee el expediente — mutaciones: la versión de la 111 (sin evidencia ni
//       acciones), y la evidencia sin el filtro `corrida_id = any (v_corridas)`;
//  10 · borrar un lead se lleva todo lo suyo de cada tabla de los agentes (transcripciones, fuentes públicas, corridas y
//       respuestas), y nada de B — mutación: quitar la clave foránea respuestas_misma_cuenta_que_el_contacto;
//  (10b · el referente que cita una evidencia pública: se borró en la 124, con los referentes.)
//  10c · las corridas del lead borrado no quedan huérfanas con lo que leyeron y escribieron de él — mutación: la clave
//       de la corrida al contacto con ON DELETE SET NULL (contacto_id), como en la 110;
//  11 · registrar_llamada con el id externo de la llamada de A, para B: 42501, y la de A queda igual — mutación: el
//       update sin `contacto_id = v_contacto`;
//  (12 y 13 · registrar_brief con otro lead y las citas de una pieza: se borraron en la 124.)
//  (14 · las rutas de la cuenta: se borraron en la 119.)
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { unResearchCompleto } from '../apoyo/research.ts';

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

const idDe = async (ghl: string) => (await unaFila<{ id: string }>(admin, `select id from negocio.contactos where ghl_contact_id = $1`, [ghl]))!.id;

/** Un Triage de la fase 1 (118/119): su cuadrante y la razón, en su columna. */
async function unTriage(ghl: string, clave: string, cuadrante = 'prioriza'): Promise<Record<string, any>> {
  const c = await j(`select agentes.abrir_corrida('triage', $1, $2, $3) as r`, [LOC, ghl, clave]);
  const t = await j(`select agentes.registrar_cuadrante($1, $2, 'factura 8 mil') as r`, [c.corrida_id, cuadrante]);
  assert.equal(t.ok, true, JSON.stringify(t));
  return { ...t, corrida_id: c.corrida_id };
}

/** Todo lo que los agentes de la fase 1 dejan de un lead, de punta a punta y como el MCP: el cuadrante del Triage, la
 *  ficha del Sales Assistant con una evidencia pública, una llamada de venta con su transcripción, la ficha del Sales
 *  Coach y el market research del Research por secciones (124). La marca va en cada texto. Devuelve el id del lead. */
async function expedienteCompleto(ghl: string, marca: string): Promise<string> {
  const lead = await idDe(ghl);
  await unTriage(ghl, `tr-${ghl}`);
  const sa = await abrir('sales_assistant', ghl, `sa-${ghl}`);
  const pub = await j(`select agentes.registrar_fuente_publica($1, 'web', $2) as r`, [sa.corrida_id, `Su web ${marca}`]);
  assert.equal(pub.ok, true, JSON.stringify(pub));
  const f1 = await j(`select agentes.guardar_respuesta($1, $2) as r`,
    [sa.corrida_id, `<section id="resumen"><h1>Ficha ${marca}</h1></section>`]);
  assert.equal(f1.ok, true, JSON.stringify(f1));
  const ll = await j(`select agentes.registrar_llamada($1, $2, $3, 'venta', 'ghl', $4) as r`,
    [LOC, ghl, `llamada-${ghl}`, `Lead ${marca}: lo pienso.`]);
  const sc = await abrir('sales_coach', ghl, `sc-${ghl}`, { llamada_id: ll.llamada_id });
  const f2 = await j(`select agentes.guardar_respuesta($1, $2) as r`,
    [sc.corrida_id, `<section id="analisis_de_llamada">Ficha 2 ${marca}</section>`]);
  assert.equal(f2.ok, true, JSON.stringify(f2));
  const mr = await abrir('research', ghl, `mr-${ghl}`);
  const r = await j(`select agentes.guardar_secciones($1, $2::jsonb) as r`,
    [mr.corrida_id, JSON.stringify(unResearchCompleto(`<h2>Market research ${marca}</h2>`))]);
  assert.equal(r.ok, true, JSON.stringify(r));
  return lead;
}

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

test('3 · las claves que arma la base no se inventan en la entrada: gana lo leído', async () => {
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
    },
  );
});

test('8 · el comportamiento del expediente es lo que hizo el lead, no lo que anotaron los agentes ni Comando Central', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
      await unLead('ghl-502-b', 'b@502.test');
    },
    async () => {
      const a = await expedienteCompleto('ghl-502-a', 'MARCA_A');
      const comportamiento = async () => (await unaFila<{ c: Record<string, number> | null }>(admin,
        `select comportamiento as c from negocio.expediente_del_lead where contacto_id = $1`, [a]))!.c ?? {};
      const delAgente = ['agente_corrida_lista', 'respuesta_de_agente_guardada'];
      // Control: los agentes sí los anotaron (si no, que falten no probaría nada).
      const anotados = await admin.query<{ tipo: string }>(
        `select distinct tipo from negocio.eventos where contacto_id = $1 and fuente = 'ghl_managed_agents'`, [a]);
      for (const t of delAgente) assert.ok(anotados.rows.some((x) => x.tipo === t), `ningún agente anotó ${t}`);
      const antes = await comportamiento();
      for (const t of delAgente) assert.ok(!(t in antes), `el comportamiento de A trae ${t}: ${JSON.stringify(antes)}`);
      const evento = (contacto: string, fuente: string, actor: string, ext: string) => comoAdmin(() => admin.query(
        `insert into negocio.eventos (org_id, cuenta_id, ocurrio_el, tipo, contacto_id, actor_tipo, fuente, id_externo)
         values ($1, $2, now(), 'vsl_visto', $3, $4, $5, $6)`, [aria.org, aria.cuenta, contacto, actor, fuente, ext]));
      // Lo que anota Comando Central tampoco es lo que hizo el lead, aunque sea del mismo tipo.
      await evento(a, 'comando_central', 'sistema', 'vsl:502-cc');
      const conElDeComando = await comportamiento();
      assert.ok(!('vsl_visto' in conElDeComando), `el comportamiento de A trae lo que anotó Comando Central: ${JSON.stringify(conElDeComando)}`);
      // Lo que hizo el lead, sí.
      await evento(a, 'ghl', 'lead', 'vsl:502-a');
      const conVsl = await comportamiento();
      assert.equal(conVsl.vsl_visto, 1);
      // Lo que hizo B no cambia el de A.
      await evento(await idDe('ghl-502-b'), 'ghl', 'lead', 'vsl:502-b');
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
      const a = await expedienteCompleto('ghl-502-a', 'MARCA_A');
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
      const ex = await admin.query(`select * from negocio.expediente_del_lead where contacto_id = $1`, [a]);
      await admin.query(`select set_config('app.org_id', '', true), set_config('app.cuentas', '', true),
                                set_config('app.toda_la_organizacion', '', true)`);
      await admin.query('reset role');
      await admin.query('set local role mcp_simulado');

      assert.deepEqual(await vinculos(tarde), { corrida: nuevo!.id, fuente: nuevo!.id, accion: nuevo!.id });
      assert.deepEqual(await vinculos(otra), { corrida: null, fuente: null, accion: null }, 'se vinculó lo de otro lead');
      assert.equal(ex.rows.length, 1);
      const fila = ex.rows[0] as Record<string, any>;
      assert.match(JSON.stringify(fila.formulario), /factura 8 mil \(ghl-502-a\)/);
      assert.match(JSON.stringify(fila.evidencia_publica), /Su web MARCA_A/);
      assert.equal(fila.respuestas_de_los_agentes?.triage_cuadrante_de_clasificacion, 'prioriza');
    },
  );
});

/** Las filas de un lead en cada tabla de los agentes. */
const TABLAS_DEL_LEAD = ['transcripciones', 'fuentes_publicas', 'corridas_de_agente', 'respuestas_de_los_agentes'];
async function filasDe(lead: string): Promise<Record<string, number>> {
  const r = await unaFila<Record<string, string>>(admin,
    `select ${TABLAS_DEL_LEAD.map((t) => `(select count(*) from negocio.${t} where contacto_id = $1) as ${t}`).join(', ')}`, [lead]);
  return Object.fromEntries(Object.entries(r!).map(([k, v]) => [k, Number(v)]));
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

test('10c · borrar un lead no deja sus corridas huérfanas con lo que leyeron y escribieron de él', async () => {
  await enUnEnsayo(
    async () => {
      await unLead('ghl-502-a', 'a@502.test');
    },
    async () => {
      const a = await expedienteCompleto('ghl-502-a', 'MARCA_A');
      // Control: las corridas de A tienen sus datos adentro (si no, que no queden no probaría nada).
      const antes = await unaFila<{ con_datos: string }>(admin,
        `select count(*) filter (where (leido::text || coalesce(salida::text, '')) like '%MARCA_A%') as con_datos
           from negocio.corridas_de_agente where ghl_contact_id = 'ghl-502-a'`);
      assert.ok(Number(antes!.con_datos) > 0, 'las corridas de A no guardaron nada de A');
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
