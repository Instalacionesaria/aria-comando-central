// EL CLIENTE FINAL Y EL FOCO, DE PUNTA A PUNTA POR LAS RUTAS. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Paso 5)
//
// Lo mismo que la 262 y la 263, pero entrando por donde entra una persona: la ruta, con su sesión.
//
//   · el cliente final de A ve en Leads los contactos de A y no los de B — mutación: la ruta con
//     `conOrganizacion(contexto.orgEfectiva)` (la base le niega el `'*'` y la ruta falla);
//   · abre Sales;
//   · no entra a nada más: el control, el Inicio, el cerebro — mutación: sacar el paso 3b del portero;
//   · el rechazo queda en la auditoría;
//   · la empresa sin foco ve sus dos clientes; enfocada en B, sólo B — mutación: un `ambitoDe` que ignore el foco;
//   · su Sales tiene los closers de su cuenta, con un rótulo en vez del nombre — mutación: el `innerJoin` a las personas;
//   · su Leads sabe que el barrido corrió — mutación: sin la política de lectura de los sellos de la organización.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { GET as leads } from '../../app/api/leads-portal/route.ts';
import { GET as sales } from '../../app/api/sales/route.ts';
import { GET as control } from '../../app/api/control/route.ts';
import { GET as inicio, POST as preguntarAlInicio } from '../../app/api/executive/route.ts';
import { POST as preguntarALaCaja } from '../../app/api/leads-portal/cerebro/route.ts';

const SLUG = 'gamma-266';

let admin: Client;
let org: string;
let cuentaB: string;
let tokenCliente: string;
let tokenEmpresa: string;
let empresa: string;
let cliente: string;

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  await admin.query(`delete from negocio.contactos where org_id = $1`, [o.id]);
  await admin.query(`delete from negocio.closer_asignado where org_id = $1`, [o.id]);
  await admin.query(`delete from negocio.tareas_programadas where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Una persona de gamma con un rol de sistema; si se le pasan cuentas, es un cliente final. */
async function persona(nombre: string, rol: string, cuentas: string[], secciones: string[]): Promise<string> {
  const u = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.usuarios (org_id, nombre, limitado_a_cuentas) values ($1, $2, $3) returning id`,
    [org, nombre, cuentas.length > 0],
  );
  assert.ok(u);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = $2 and org_id is null`,
    [u.id, rol],
  );
  for (const s of secciones) {
    await admin.query(`insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, $2)`, [u.id, s]);
  }
  for (const c of cuentas) {
    await admin.query(`insert into identidad.usuarios_cuentas (org_id, usuario_id, cuenta_id) values ($1, $2, $3)`, [org, u.id, c]);
  }
  return u.id;
}

const universo = async (token: string): Promise<number> => {
  const r = await leerRespuesta<{ cohorte: { universo: number } }>(await leads(pedirComo('/api/leads-portal?periodo=completo', token)));
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  return r.cuerpo.cohorte.universo;
};

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 266', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  const a = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1`, [org]);
  const b = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, zona_horaria) values ($1, 'B 266', 'b-266', 'America/Lima') returning id`,
    [org],
  );
  assert.ok(a && b);
  cuentaB = b.id;
  await admin.query(
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, alta_en_el_crm)
       select $1, $2, 'ruta-266-a-' || i, 'Contacto A', now() - interval '1 day' from generate_series(1, 2) i`,
    [org, a.id],
  );
  await admin.query(
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, alta_en_el_crm)
       select $1, $2, 'ruta-266-b-' || i, 'Contacto B', now() - interval '1 day' from generate_series(1, 3) i`,
    [org, b.id],
  );
  cliente = await persona('Cliente final 266', 'usuario', [a.id], ['contacts', 'sales']);
  empresa = await persona('Empresa 266', 'administrador', [], []);
  tokenCliente = await sesionDe(cliente);
  tokenEmpresa = await sesionDe(empresa);
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('el cliente final ve en Leads los contactos de su cuenta, y no los de la otra', async () => {
  assert.equal(await universo(tokenCliente), 2);
});

test('el cliente final abre Sales', async () => {
  const r = await sales(pedirComo('/api/sales?periodo=30d', tokenCliente));
  assert.equal(r.status, 200, await r.clone().text());
});

test('el cliente final no entra a nada más, y el rechazo queda en la auditoría', async () => {
  const rechazos = [
    await control(pedirComo('/api/control', tokenCliente)),
    await inicio(pedirComo('/api/executive', tokenCliente)),
    await preguntarAlInicio(pedirComo('/api/executive', tokenCliente, { metodo: 'POST', cuerpo: { pregunta: 'hola' } })),
  ];
  for (const r of rechazos) {
    const { estado, cuerpo } = await leerRespuesta<{ codigo: string }>(r);
    assert.deepEqual({ estado, codigo: cuerpo.codigo }, { estado: 403, codigo: 'fuera_de_su_cuenta' });
  }
  // La caja del cerebro de su pantalla: la pantalla es suya, pero el cerebro no (no tiene `cerebro.usar`).
  const caja = await leerRespuesta<{ codigo: string }>(
    await preguntarALaCaja(pedirComo('/api/leads-portal/cerebro', tokenCliente, { metodo: 'POST', cuerpo: { pregunta: 'hola' } })),
  );
  assert.deepEqual({ estado: caja.estado, codigo: caja.cuerpo.codigo }, { estado: 403, codigo: 'sin_permiso' });
  const f = await unaFila<{ n: number }>(
    admin,
    `select count(*)::int as n from identidad.auditoria_accesos where usuario_id = $1 and accion = 'fuera_de_su_cuenta'`,
    [cliente],
  );
  assert.equal(f?.n, 3);
});

test('la empresa sin foco ve sus dos clientes; enfocada en uno, sólo ése', async () => {
  assert.equal(await universo(tokenEmpresa), 5);
  await admin.query(`update identidad.sesiones set cuenta_activa = $1 where usuario_id = $2`, [cuentaB, empresa]);
  try {
    assert.equal(await universo(tokenEmpresa), 3);
  } finally {
    await admin.query(`update identidad.sesiones set cuenta_activa = null where usuario_id = $1`, [empresa]);
  }
});

test('su Sales tiene los closers de su cuenta, con un rótulo en vez del nombre de la persona', async () => {
  // El cliente final no ve a las personas de la empresa (`086`). Con un `innerJoin`, sus closers desaparecían y Sales
  // salía en «—» con «no hay closers configurados».
  const closer = await persona('Closer 266', 'usuario', [], ['closer']);
  const a = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  assert.ok(a);
  await admin.query(
    `insert into negocio.closer_asignado (org_id, cuenta_id, usuario_id, crm_usuario_id, actualizado_por) values ($1, $2, $3, 'crm-266', $4)`,
    [org, a.id, closer, empresa],
  );
  const filas = async (token: string) => {
    const r = await leerRespuesta<{ pantalla: { closers: { filas: { nombre: string }[] } } }>(
      await sales(pedirComo('/api/sales?periodo=30d', token)),
    );
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    return r.cuerpo.pantalla.closers.filas.map((f) => f.nombre);
  };
  assert.deepEqual(await filas(tokenCliente), ['Closer 1'], 'el cliente final se quedó sin closers, o vio el nombre de la persona');
  assert.deepEqual(await filas(tokenEmpresa), ['Closer 266']);
});

test('su Leads sabe que el barrido corrió: los sellos de la organización se leen', async () => {
  await admin.query(
    `insert into negocio.tareas_programadas (org_id, tarea, ultima_corrida_el, ultimo_estado) values ($1, 'contactos', now(), 'corrio')
     on conflict (org_id, tarea) do update set ultima_corrida_el = now(), ultimo_estado = 'corrio'`,
    [org],
  );
  const r = await leerRespuesta<{ frescura: { contactos: { estado: string } } }>(
    await leads(pedirComo('/api/leads-portal?periodo=completo', tokenCliente)),
  );
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.frescura.contactos.estado, 'al_dia', 'el cliente final no ve el sello: Leads le dice que el barrido nunca corrió');
});
