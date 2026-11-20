// LA EVIDENCIA DE UNA CORRIDA DESCARTADA (la migración 117). Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (docs/3-agentes/MANAGED-AGENTS-RESEARCH.md, revisión del 2026-11-17)
//
// El Research falló tres corridas por registrar fuentes sin resultado de herramienta, y esas fuentes seguían
// llegando como citables a los pasos siguientes. Con un lead A en la cuenta de ARIA y una fuente en cada estado de
// corrida (fallida, reemplazada, cancelada, abierta y esperando aprobación):
//
//   1 · leer_research (vía _leer_del_cliente) no entrega las de corridas fallidas, reemplazadas ni canceladas, y sí
//       las de una corrida abierta o que espera aprobación — mutación: _leer_del_cliente de la 115;
//   2 · por eso una cita del Research a la fuente de la corrida fallida se rechaza («no es una evidencia registrada»),
//       y a la buena se acepta;
//   3 · leer_brief tampoco las entrega — mutación: su versión de la 115 (leer_sales_assistant se borró en la 119);
//   4 · la sección evidencia_publica del expediente tampoco — mutación: la vista de la 115;
//   5 · la fuente que una corrida registra sigue siendo citable por ella misma;
//   6 · los tipos de fuente nuevos (tiktok, youtube, facebook, empleo, google_trends) se aceptan;
//   7 · lo que una corrida leyó de otra mientras ésta estaba abierta, y que después se descartó, ya no se puede citar
//       (aunque siga en lo leído) ni atar a un referente — mutaciones: _texto_de_la_fuente y registrar_research de la
//       115.
// Los controles: la evidencia de corridas abiertas, en espera, listas, rechazadas o aprobadas, y la que quedó sin
// corrida, se sigue entregando.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';

let admin: Client;
let aria: { org: string; cuenta: string; persona: string };
const LOC = 'loc-503';

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

const abrir = (agente: string, ghl: string, clave: string, sujeto: object = {}) =>
  j(`select agentes.abrir_corrida($1, $2, $3, $4, '{}'::jsonb, null, $5) as r`, [agente, LOC, ghl, clave, sujeto]);

const fuente = async (corrida: string, extracto: string, tipo = 'web'): Promise<string> =>
  (await j(`select agentes.registrar_fuente_publica($1, $2, $3, 'https://ejemplo.pe/' || $4) as r`,
    [corrida, tipo, extracto, randomUUID()])).fuente as string;

/** El lead A con su Brief prellenado, y una fuente en cada estado de corrida. */
async function preparar(): Promise<{ ghl: string; contacto: string; f: Record<string, string> }> {
  const ghl = `ghl-503-${randomUUID().slice(0, 8)}`;
  const c = await comoAdmin(() => unaFila<{ id: string }>(admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, fuente, email)
     values ($1, $2, $3, 'Lead 503', 'meta', $4) returning id`, [aria.org, aria.cuenta, ghl, `${ghl}@ejemplo.pe`]));
  const b = await abrir('brief', ghl, `brief:${ghl}`);
  const rb = await j(`select agentes.registrar_brief($1, '{"respuestas": [{"pregunta": "nicho_detalle", "estado": "vacio"}]}'::jsonb) as r`,
    [b.corrida_id]);
  assert.equal(rb.ok, true, JSON.stringify(rb));

  const f: Record<string, string> = {};
  // fallida
  const x1 = await abrir('research', ghl, `r:${ghl}:fallida`, { paso: 'mr_segmentos' });
  f.fallida = await fuente(x1.corrida_id, 'MARCA-FALLIDA inmobiliarias sin respaldo');
  await admin.query(`select agentes.fallar_corrida($1, 'fuentes sin respaldo')`, [x1.corrida_id]);
  // reemplazada: otra corrida del mismo paso la reemplaza
  const x2 = await abrir('research', ghl, `r:${ghl}:reemplazada`, { paso: 'mr_precio' });
  f.reemplazada = await fuente(x2.corrida_id, 'MARCA-REEMPLAZADA precio sin respaldo');
  const x2b = await abrir('research', ghl, `r:${ghl}:reemplaza`, { paso: 'mr_precio' });
  assert.ok((x2b.reemplazo_a ?? []).includes(x2.corrida_id), 'la segunda corrida reemplaza a la primera');
  // cancelada
  const x3 = await abrir('research', ghl, `r:${ghl}:cancelada`, { paso: 'mr_referentes' });
  f.cancelada = await fuente(x3.corrida_id, 'MARCA-CANCELADA referente sin respaldo');
  await admin.query(`select agentes.cancelar_corrida($1, 'prueba')`, [x3.corrida_id]);
  // abierta (otro paso, sigue trabajando)
  const x4 = await abrir('research', ghl, `r:${ghl}:abierta`, { paso: 'mr_dolores' });
  f.abierta = await fuente(x4.corrida_id, 'MARCA-ABIERTA «nunca me llamaron» de una reseña', 'google_resena');
  // esperando aprobación: un paso guardado
  const x5 = await abrir('research', ghl, `r:${ghl}:guardada`, { paso: 'mr_segmentos' });
  f.guardada = await fuente(x5.corrida_id, 'MARCA-GUARDADA hay 75 inmobiliarias en Lima', 'google_maps');
  const r5 = await j(`select agentes.registrar_research($1, $2::jsonb) as r`, [x5.corrida_id, JSON.stringify({
    texto: '# Segmentos', segmentos: [{ nombre: 'Inmobiliarias' }],
    citas: [{ texto: 'hay 75 inmobiliarias', fuente: f.guardada, segmento: 'Inmobiliarias' }],
  })]);
  assert.equal(r5.ok, true, JSON.stringify(r5));
  // lista, rechazada y aprobada: corridas que terminaron bien o que una persona decidió; su evidencia sigue valiendo.
  const terminar = async (paso: string, marca: string, estado: string, agente = 'research') => {
    const x = await abrir(agente, ghl, `r:${ghl}:${marca}`, agente === 'research' ? { paso } : {});
    const fu = await fuente(x.corrida_id, `MARCA-${marca.toUpperCase()} evidencia de una corrida ${estado}`);
    await comoAdmin(() => admin.query(`update negocio.corridas_de_agente set estado = $2, terminada_el = now() where id = $1`,
      [x.corrida_id, estado]));
    return fu;
  };
  f.lista = await terminar('prediagnostico', 'lista', 'lista');
  f.rechazada = await terminar('mr_decision', 'rechazada', 'rechazada');
  f.aprobada = await terminar('', 'aprobada', 'aprobada', 'brief');
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
    'MARCA-ABIERTA': 'abierta', 'MARCA-GUARDADA': 'esperando_aprobacion',
    'MARCA-LISTA': 'lista', 'MARCA-RECHAZADA': 'rechazada', 'MARCA-APROBADA': 'aprobada',
  }, 'control: una fuente en cada estado de corrida');
  return { ghl, contacto: c!.id, f };
}

const SIN = ['fallida', 'reemplazada', 'cancelada'];
const CON = ['abierta', 'guardada', 'lista', 'rechazada', 'aprobada', 'sin_corrida'];

test('1 y 2 · leer_research no entrega la evidencia de corridas descartadas, y no se puede citar', async () => {
  await enUnEnsayo(async () => {
    const { ghl, f } = await preparar();
    const y = await abrir('research', ghl, `r:${ghl}:nueva`, { paso: 'mr_referentes' });
    const leido = await j(`select agentes.leer_research($1) as r`, [y.corrida_id]);
    const claves = Object.keys(leido.fuentes ?? {});
    for (const k of SIN) assert.ok(!claves.includes(f[k]!), `no entrega la fuente de la corrida ${k}`);
    for (const k of CON) assert.ok(claves.includes(f[k]!), `entrega la fuente de la corrida ${k} (control)`);

    const mala = await j(`select agentes.registrar_research($1, $2::jsonb) as r`, [y.corrida_id, JSON.stringify({
      texto: '# Referentes', referentes: [{ nombre: 'X', segmento: 'Inmobiliarias', tipo: 'proveedor' }],
      citas: [{ texto: 'sin respaldo', fuente: f.fallida }],
    })]);
    assert.equal(mala.ok, false, 'la cita a la fuente de la corrida fallida se rechaza');
    assert.match(JSON.stringify(mala.errores), /no es una evidencia registrada/);

    const buena = await j(`select agentes.registrar_research($1, $2::jsonb) as r`, [y.corrida_id, JSON.stringify({
      texto: '# Referentes', referentes: [{ nombre: 'X', segmento: 'Inmobiliarias', tipo: 'proveedor' }],
      citas: [{ texto: 'nunca me llamaron', fuente: f.abierta }],
    })]);
    assert.equal(buena.ok, true, JSON.stringify(buena));
    assert.equal(buena.citas_verificadas, 1);
  });
});

test('3 · leer_brief tampoco las entrega', async () => {
  await enUnEnsayo(async () => {
    const { ghl, f } = await preparar();
    const b = await abrir('brief', ghl, `brief:${ghl}:2`);
    const lb = await j(`select agentes.leer_brief($1) as r`, [b.corrida_id]);
    const kb = Object.keys(lb.fuentes ?? {});
    for (const k of SIN) assert.ok(!kb.includes(f[k]!), `leer_brief no entrega la de la corrida ${k}`);
    for (const k of CON) assert.ok(kb.includes(f[k]!), `leer_brief entrega la de la corrida ${k} (control)`);
    // (leer_sales_assistant se borró en la 119: el Sales Assistant lee el expediente, que cubre el caso 4.)
  });
});

test('4 · el expediente no muestra la evidencia de corridas descartadas', async () => {
  await enUnEnsayo(async () => {
    const { contacto } = await preparar();
    const e = await unaFila<{ ev: unknown }>(admin,
      `select evidencia_publica as ev from negocio.expediente_del_lead where contacto_id = $1`, [contacto]);
    const texto = JSON.stringify(e?.ev ?? null);
    for (const k of SIN) assert.ok(!texto.includes(`MARCA-${k.toUpperCase()}`), `el expediente no muestra la de la corrida ${k}`);
    for (const k of CON) assert.ok(texto.includes(`MARCA-${k.toUpperCase()}`), `el expediente muestra la de la corrida ${k} (control)`);
  });
});

test('7 · lo que una corrida leyó de otra que después se descartó ya no se puede citar ni atar a un referente', async () => {
  await enUnEnsayo(async () => {
    const { ghl } = await preparar();
    // X (mr_precio) registra evidencia y sigue abierta; Y (mr_referentes) lee mientras tanto y la tiene en lo leído.
    const x = await abrir('research', ghl, `r:${ghl}:x7`, { paso: 'mr_precio' });
    const fx = await fuente(x.corrida_id, 'MARCA-X7 el precio promedio es 500');
    const y = await abrir('research', ghl, `r:${ghl}:y7`, { paso: 'mr_referentes' });
    const leido = await j(`select agentes.leer_research($1) as r`, [y.corrida_id]);
    assert.ok(Object.keys(leido.fuentes ?? {}).includes(fx), 'control: Y leyó la evidencia de X mientras X estaba abierta');
    await admin.query(`select agentes.fallar_corrida($1, 'fuentes sin respaldo')`, [x.corrida_id]);

    const cita = await j(`select agentes.registrar_research($1, $2::jsonb) as r`, [y.corrida_id, JSON.stringify({
      texto: '# Referentes', referentes: [{ nombre: 'X', segmento: 'Inmobiliarias', tipo: 'proveedor' }],
      citas: [{ texto: 'el precio promedio es 500', fuente: fx }],
    })]);
    assert.equal(cita.ok, false, 'la cita a la evidencia de X (ya fallida) se rechaza');
    assert.match(JSON.stringify(cita.errores), /no es una evidencia registrada/);

    const ref = await j(`select agentes.registrar_research($1, $2::jsonb) as r`, [y.corrida_id, JSON.stringify({
      texto: '# Referentes', referentes: [{ nombre: 'Proveedor X7', segmento: 'Inmobiliarias', tipo: 'proveedor', fuente: fx }],
    })]);
    assert.equal(ref.ok, true, JSON.stringify(ref));
    const fila = await comoAdmin(() => unaFila<{ fuente: string | null }>(admin,
      `select fuente_publica_id::text as fuente from negocio.referentes_del_mercado where nombre = 'Proveedor X7'`));
    assert.equal(fila?.fuente, null, 'el referente no queda atado a la evidencia descartada');
  });
});

test('5 y 6 · la fuente propia sigue citable, y los tipos nuevos se aceptan', async () => {
  await enUnEnsayo(async () => {
    const { ghl } = await preparar();
    const y = await abrir('research', ghl, `r:${ghl}:propia`, { paso: 'mr_decision' });
    const nuevas: string[] = [];
    for (const tipo of ['tiktok', 'youtube', 'facebook', 'empleo', 'google_trends']) {
      nuevas.push(await fuente(y.corrida_id, `PROPIA ${tipo}: el rubro crece`, tipo));
    }
    const r = await j(`select agentes.registrar_research($1, $2::jsonb) as r`, [y.corrida_id, JSON.stringify({
      texto: '# Decisión', segmento_elegido: 'Inmobiliarias',
      citas: nuevas.map((fuente) => ({ texto: 'el rubro crece', fuente })),
    })]);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.citas_verificadas, 5);
  });
});
