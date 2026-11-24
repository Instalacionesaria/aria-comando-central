// LA EVIDENCIA DE UNA CORRIDA DESCARTADA (la migración 117; sin lo que borró la 124). Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (docs/3-agentes/MANAGED-AGENTS-RESEARCH.md, revisión del 2026-11-17; la 124 del 2026-11-24)
//
// El Research falló tres corridas por registrar fuentes sin resultado de herramienta, y esas fuentes seguían
// llegando como citables a los pasos siguientes. La 124 borró las lecturas y los registros viejos del Research
// (leer_research, registrar_research, los referentes); lo que queda de la 117 es el filtro en lo que sigue leyendo la
// evidencia pública. Con un lead A en la cuenta de ARIA y una fuente en cada estado de corrida (fallida, reemplazada,
// cancelada, abierta, lista, esperando aprobación, rechazada, aprobada) y una sin corrida:
//
//   1 · leer_brief no entrega en sus fuentes la de corridas fallidas, reemplazadas ni canceladas — mutación: la
//       consulta de las fuentes públicas sin el `not exists (… estado in ('fallida', 'reemplazada', 'cancelada'))`;
//   2 · la sección evidencia_publica del expediente tampoco — mutación: la vista sin ese filtro (la de la 115);
//   3 · lo que una corrida leyó de otra mientras ésta estaba abierta, y que después se descartó, ya no se puede citar
//       aunque siga en lo leído (lo leído sólo crece) — mutación: _texto_de_la_fuente de la 115;
//   4 · los tipos de fuente nuevos de la 117 (tiktok, youtube, facebook, empleo, google_trends) se aceptan en
//       registrar_fuente_publica, y un tipo que no está en el catálogo no; la fuente que registra una corrida sigue
//       siendo citable por ella misma — mutación: sacarlos de catalogo.tipos_de_fuente_publica.
// Los controles: la evidencia de corridas abiertas, listas, en espera, rechazadas o aprobadas, y la que quedó sin
// corrida, se sigue entregando.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { unResearchCompleto } from '../apoyo/research.ts';

let admin: Client;
let aria: { org: string; cuenta: string };
const LOC = 'loc-503';

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

const abrir = (agente: string, ghl: string, clave: string, sujeto: object = {}) =>
  j(`select agentes.abrir_corrida($1, $2, $3, $4, '{}'::jsonb, null, $5) as r`, [agente, LOC, ghl, clave, sujeto]);

const fuente = async (corrida: string, extracto: string, tipo = 'web'): Promise<string> => {
  const r = await j(`select agentes.registrar_fuente_publica($1, $2, $3, 'https://ejemplo.pe/' || $4) as r`,
    [corrida, tipo, extracto, randomUUID()]);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.fuente as string;
};

/** Lo que _texto_de_la_fuente le deja citar a una corrida (null: no se puede citar). */
const citable = (corrida: string, clave: string) => comoAdmin(async () => (await unaFila<{ t: string | null }>(admin,
  `select agentes._texto_de_la_fuente(c, $2) as t from negocio.corridas_de_agente c where c.id = $1`, [corrida, clave]))!.t);

/** El lead A, y una fuente en cada estado de corrida (más una sin corrida). Cada agente tiene a lo más una corrida
 *  abierta por sujeto: la siguiente del mismo agente se abre cuando la anterior ya no lo está, salvo la que reemplaza. */
async function preparar(): Promise<{ ghl: string; contacto: string; f: Record<string, string> }> {
  const ghl = `ghl-503-${randomUUID().slice(0, 8)}`;
  const c = await comoAdmin(() => unaFila<{ id: string }>(admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente, email)
     values ($1, $2, $3, 'Lead 503', 'meta', $4) returning id`, [aria.org, aria.cuenta, ghl, `${ghl}@ejemplo.pe`]));

  const f: Record<string, string> = {};
  // fallida: el Research registra fuentes sin respaldo y falla.
  const x1 = await abrir('research', ghl, `r:${ghl}:fallida`);
  f.fallida = await fuente(x1.corrida_id, 'MARCA-FALLIDA inmobiliarias sin respaldo');
  await admin.query(`select agentes.fallar_corrida($1, 'fuentes sin respaldo')`, [x1.corrida_id]);
  // reemplazada: otra corrida del Estratega sobre el mismo lead la reemplaza.
  const x2 = await abrir('estratega', ghl, `e:${ghl}:reemplazada`);
  f.reemplazada = await fuente(x2.corrida_id, 'MARCA-REEMPLAZADA precio sin respaldo');
  const x2b = await abrir('estratega', ghl, `e:${ghl}:reemplaza`);
  assert.ok((x2b.reemplazo_a ?? []).includes(x2.corrida_id), 'la segunda corrida reemplaza a la primera');
  // cancelada
  const x3 = await abrir('brief', ghl, `b:${ghl}:cancelada`);
  f.cancelada = await fuente(x3.corrida_id, 'MARCA-CANCELADA referente sin respaldo');
  await admin.query(`select agentes.cancelar_corrida($1, 'prueba')`, [x3.corrida_id]);
  // abierta: sigue trabajando.
  const x4 = await abrir('sales_assistant', ghl, `sa:${ghl}:abierta`);
  f.abierta = await fuente(x4.corrida_id, 'MARCA-ABIERTA «nunca me llamaron» de una reseña', 'google_resena');
  // lista: el Research registra su evidencia y guarda el market research por secciones (124).
  const x5 = await abrir('research', ghl, `r:${ghl}:lista`);
  f.lista = await fuente(x5.corrida_id, 'MARCA-LISTA hay 75 inmobiliarias en Lima', 'google_maps');
  const r5 = await j(`select agentes.guardar_secciones($1, $2::jsonb) as r`, [x5.corrida_id,
    JSON.stringify(unResearchCompleto('<p>Hay 75 inmobiliarias en Lima.</p>'))]);
  assert.equal(r5.ok, true, JSON.stringify(r5));
  // esperando aprobación, rechazada y aprobada: estados que hoy ninguna función de la fase 1 deja, pero que la tabla
  // acepta; su evidencia sigue valiendo (el rechazo es del contenido, no de la evidencia).
  const terminar = async (marca: string, estado: string) => {
    const x = await abrir('triage', ghl, `t:${ghl}:${marca}`);
    const fu = await fuente(x.corrida_id, `MARCA-${marca.toUpperCase()} evidencia de una corrida ${estado}`);
    await comoAdmin(() => admin.query(`update negocio.corridas_de_agente set estado = $2, terminada_el = now() where id = $1`,
      [x.corrida_id, estado]));
    return fu;
  };
  f.esperando = await terminar('esperando', 'esperando_aprobacion');
  f.rechazada = await terminar('rechazada', 'rechazada');
  f.aprobada = await terminar('aprobada', 'aprobada');
  // sin corrida: la que queda cuando su corrida se borra (on delete set null).
  const sin = await comoAdmin(() => unaFila<{ id: string }>(admin,
    `insert into negocio.fuentes_publicas (org_id, cuenta_id, contacto_id, tipo, url, extracto, obtenida_por)
     values ($1, $2, $3, 'web', 'https://ejemplo.pe/sin', 'MARCA-SIN_CORRIDA evidencia sin corrida', 'prueba') returning id`,
    [aria.org, aria.cuenta, c!.id]));
  f.sin_corrida = `publica:${sin!.id}`;
  const estados = await comoAdmin(() => admin.query<{ marca: string; estado: string }>(
    `select split_part(p.extracto, ' ', 1) as marca, c.estado from negocio.fuentes_publicas p
       join negocio.corridas_de_agente c on c.id = p.corrida_id where p.contacto_id = $1`, [c!.id]));
  assert.deepEqual(Object.fromEntries(estados.rows.map((e) => [e.marca, e.estado])), {
    'MARCA-FALLIDA': 'fallida', 'MARCA-REEMPLAZADA': 'reemplazada', 'MARCA-CANCELADA': 'cancelada',
    'MARCA-ABIERTA': 'abierta', 'MARCA-LISTA': 'lista', 'MARCA-ESPERANDO': 'esperando_aprobacion',
    'MARCA-RECHAZADA': 'rechazada', 'MARCA-APROBADA': 'aprobada',
  }, 'control: una fuente en cada estado de corrida');
  return { ghl, contacto: c!.id, f };
}

const SIN = ['fallida', 'reemplazada', 'cancelada'];
const CON = ['abierta', 'lista', 'esperando', 'rechazada', 'aprobada', 'sin_corrida'];

test('1 · leer_brief no entrega la evidencia de corridas descartadas', async () => {
  await enUnEnsayo(async () => {
    const { ghl, f } = await preparar();
    const b = await abrir('brief', ghl, `b:${ghl}:lee`);
    const lb = await j(`select agentes.leer_brief($1) as r`, [b.corrida_id]);
    const kb = Object.keys(lb.fuentes ?? {});
    for (const k of SIN) assert.ok(!kb.includes(f[k]!), `leer_brief no entrega la de la corrida ${k}`);
    for (const k of CON) assert.ok(kb.includes(f[k]!), `leer_brief entrega la de la corrida ${k} (control)`);
  });
});

test('2 · el expediente no muestra la evidencia de corridas descartadas', async () => {
  await enUnEnsayo(async () => {
    const { contacto } = await preparar();
    const e = await unaFila<{ ev: unknown }>(admin,
      `select evidencia_publica as ev from negocio.expediente_del_lead where contacto_id = $1`, [contacto]);
    const texto = JSON.stringify(e?.ev ?? null);
    for (const k of SIN) assert.ok(!texto.includes(`MARCA-${k.toUpperCase()}`), `el expediente no muestra la de la corrida ${k}`);
    for (const k of CON) assert.ok(texto.includes(`MARCA-${k.toUpperCase()}`), `el expediente muestra la de la corrida ${k} (control)`);
  });
});

test('3 · lo que una corrida leyó de otra que después se descartó ya no se puede citar', async () => {
  await enUnEnsayo(async () => {
    const { ghl, f } = await preparar();
    // X (un Research) registra evidencia y sigue abierta; Y (un Brief) lee mientras tanto y la tiene en lo leído.
    const x = await abrir('research', ghl, `r:${ghl}:x3`);
    const fx = await fuente(x.corrida_id, 'MARCA-X3 el precio promedio es 500');
    const y = await abrir('brief', ghl, `b:${ghl}:y3`);
    const leido = await j(`select agentes.leer_brief($1) as r`, [y.corrida_id]);
    assert.ok(Object.keys(leido.fuentes ?? {}).includes(fx), 'control: Y leyó la evidencia de X mientras X estaba abierta');
    assert.equal(await citable(y.corrida_id, fx), 'MARCA-X3 el precio promedio es 500', 'control: mientras X está abierta, Y la cita');

    await admin.query(`select agentes.fallar_corrida($1, 'fuentes sin respaldo')`, [x.corrida_id]);
    assert.equal(await citable(y.corrida_id, fx), null, 'Y todavía cita la evidencia de X, ya fallida');
    // Control: lo demás que Y leyó se sigue citando.
    assert.equal(await citable(y.corrida_id, f.lista!), 'MARCA-LISTA hay 75 inmobiliarias en Lima');
  });
});

test('4 · los tipos de fuente nuevos de la 117 se aceptan, y uno fuera del catálogo no', async () => {
  await enUnEnsayo(async () => {
    const { ghl } = await preparar();
    const y = await abrir('research', ghl, `r:${ghl}:tipos`);
    const tipos = ['tiktok', 'youtube', 'facebook', 'empleo', 'google_trends'];
    const nuevas: string[] = [];
    for (const tipo of tipos) nuevas.push(await fuente(y.corrida_id, `PROPIA ${tipo}: el rubro crece`, tipo));
    const guardadas = await comoAdmin(() => admin.query<{ tipo: string }>(
      `select tipo from negocio.fuentes_publicas where id = any($1::uuid[]) order by tipo`,
      [nuevas.map((k) => k.slice('publica:'.length))]));
    assert.deepEqual(guardadas.rows.map((x) => x.tipo), [...tipos].sort());
    // La fuente propia de una corrida abierta se puede citar.
    for (const k of nuevas) assert.match((await citable(y.corrida_id, k)) ?? '', /el rubro crece/);
    // Control: un tipo que no está en el catálogo se rechaza (la clave foránea), así que aceptar los cinco dice algo.
    await fallaCon('23503', `select agentes.registrar_fuente_publica($1, 'inventado', 'no existe')`, [y.corrida_id]);
  });
});
