// EL TABLERO DE NEGOCIOS, POR SU RUTA: QUIÉN LO VE Y QUÉ NO LLEVA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Paso 9)
//
// `GET /api/negocios` mira a todas las empresas y a sus clientes:
//
//   · el superadministrador, desde la principal, ve cada empresa con sus clientes: los nombres en vivo y las cifras
//     de la foto;
//   · un administrador —de una empresa cliente o de la misma ARIA— recibe 403: `negocios.ver` es sólo del
//     superadministrador — mutación: el reparto sin negar `negocios.%` al administrador;
//   · una persona de una empresa cliente con la capacidad dada por error recibe 403: el tablero es de la principal —
//     mutación: sin `esDeLaPrincipal`;
//   · la respuesta no lleva un token, un correo ni la subcuenta del CRM — mutación: la configuración con valores.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { leerLaConfiguracion } from '../../lib/cartera/configuracion.ts';
import { tomarLaFoto } from '../../lib/cartera/foto.ts';
import { GET as negocios } from '../../app/api/negocios/route.ts';

const SLUG = 'gamma-273';
const SECRETO = 'secreto-de-mentira-273';
const SUBCUENTA = 'subcuenta-273';

let admin: Client;
let org: string;
let principal: string;
let fundadora: string;
let tokenAria: string;
let adminDeGamma: string;
let adminDeAria: string;

async function limpiar(): Promise<void> {
  await admin.query(`delete from negocio.foto_de_las_cuentas`);
  await admin.query(`delete from negocio.foto_de_las_empresas`);
  await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where nombre like '% 273')`);
  await admin.query(`delete from identidad.usuarios_roles where usuario_id in (select id from identidad.usuarios where nombre like '% 273')`);
  await admin.query(`delete from identidad.usuarios where nombre like '% 273'`);
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  await admin.query(`delete from negocio.contactos where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones_credenciales where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

async function administrador(enOrg: string, nombre: string): Promise<string> {
  const u = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.usuarios (org_id, nombre) values ($1, $2) returning id`,
    [enOrg, nombre],
  );
  assert.ok(u);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'administrador' and org_id is null`,
    [u.id],
  );
  return u.id;
}

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 273', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  const p = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where es_principal`);
  const f = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email = 'fundadora@principal.ejemplo'`);
  assert.ok(o && p && f, 'falta el sembrado');
  org = o.id;
  principal = p.id;
  fundadora = f.id;
  const porOmision = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  assert.ok(porOmision);
  await admin.query(`update identidad.cuentas set crm_cuenta_id = $2 where id = $1`, [porOmision.id, SUBCUENTA]);
  await admin.query(`insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Segunda 273', 'segunda-273')`, [org]);
  await admin.query(
    `insert into identidad.organizaciones_credenciales (org_id, ia_clave_cifrada, crm_token_cifrado, crm_estado, crm_cuenta_id)
     values ($1, $2, $2, 'activa', $3)`,
    [org, SECRETO, SUBCUENTA],
  );
  await admin.query(
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, alta_en_el_crm)
       select $1, $2, 'c273-' || i, 'Contacto 273', now() - interval '2 days' from generate_series(1, 3) i`,
    [org, porOmision.id],
  );
  adminDeGamma = await administrador(org, 'Admin de gamma 273');
  adminDeAria = await administrador(principal, 'Admin de ARIA 273');
  tokenAria = await sesionDe(fundadora);
  await tomarLaFoto(await conIdentidad(leerLaConfiguracion));
});

after(async () => {
  try {
    // Las sesiones de la fundadora que abrió este archivo, y nada más.
    await admin.query(
      `delete from identidad.sesiones where usuario_id = $1 and creada_el > now() - interval '1 hour' and cuenta_activa is null`,
      [fundadora],
    );
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

interface Respuesta {
  foto: { dia: string | null };
  empresas: {
    id: string;
    nombre: string | null;
    detalle: { nombre: string | null; cifras: { contactos: number | null } | null }[];
    cifras: { contactos: number | null } | null;
  }[];
}

test('el superadministrador, desde la principal, ve cada empresa con sus clientes: los nombres en vivo, las cifras de la foto', async () => {
  const r = await leerRespuesta<Respuesta>(await negocios(pedirComo('/api/negocios', tokenAria)));
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  assert.ok(r.cuerpo.foto.dia, 'la foto no llegó');
  const g = r.cuerpo.empresas.find((e) => e.id === org);
  assert.ok(g, 'la empresa del archivo no está en el tablero');
  assert.equal(g.nombre, 'Gamma 273');
  assert.equal(g.cifras?.contactos, 3);
  assert.deepEqual(g.detalle.map((c) => c.nombre).sort(), ['Gamma 273', 'Segunda 273'].sort());
});

test('un administrador, de una empresa cliente o de ARIA, recibe 403', async () => {
  for (const quien of [adminDeGamma, adminDeAria]) {
    const token = await sesionDe(quien);
    const r = await leerRespuesta<{ codigo: string }>(await negocios(pedirComo('/api/negocios', token)));
    assert.deepEqual({ estado: r.estado, codigo: r.cuerpo.codigo }, { estado: 403, codigo: 'sin_permiso' });
  }
});

test('una persona de una empresa cliente con la capacidad dada por error recibe 403: el tablero es de la principal', async () => {
  // La red de `esDeLaPrincipal`, la misma de Monitoreo e Incidentes: un rol propio de la empresa con `negocios.ver` es
  // un error de una sola fila, y sin la red le mostraría a un cliente las empresas y los clientes de todos.
  const rol = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.roles (clave, nombre, org_id) values ('negocios_273', 'Negocios 273', $1) returning id`,
    [org],
  );
  assert.ok(rol);
  try {
    await admin.query(`insert into identidad.roles_permisos (rol_id, permiso) values ($1, 'negocios.ver')`, [rol.id]);
    await admin.query(`insert into identidad.usuarios_roles (usuario_id, rol_id) values ($1, $2)`, [adminDeGamma, rol.id]);
    const r = await leerRespuesta<{ codigo: string }>(await negocios(pedirComo('/api/negocios', await sesionDe(adminDeGamma))));
    assert.deepEqual({ estado: r.estado, codigo: r.cuerpo.codigo }, { estado: 403, codigo: 'sin_permiso' });
  } finally {
    await admin.query(`delete from identidad.usuarios_roles where rol_id = $1`, [rol.id]);
    await admin.query(`delete from identidad.roles where id = $1`, [rol.id]);
  }
});

test('la respuesta no lleva un token, un correo ni la subcuenta del CRM', async () => {
  const r = await negocios(pedirComo('/api/negocios', tokenAria));
  const texto = await r.text();
  assert.equal(r.status, 200);
  // El correo de la fundadora está en identidad, como el de cualquier persona con contraseña.
  for (const prohibido of [SECRETO, SUBCUENTA, 'fundadora@principal.ejemplo']) {
    assert.ok(!texto.includes(prohibido), `la respuesta lleva «${prohibido}»`);
  }
  assert.doesNotMatch(texto, /cifrad|_hash|password|email/i, 'la respuesta nombra un campo de credenciales o de personas');
});
