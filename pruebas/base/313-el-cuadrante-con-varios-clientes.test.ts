// EL CUADRANTE DEL ICP CON VARIOS CLIENTES: CREATIVE CUENTA LOS DE CADA UNO Y NOMBRA AL QUE NO TIENE EL CAMPO. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (ICP en cuadrantes · Q3, la `105`)
//
// Lo que la 296 cuidaba del puntaje en Creative, ahora con el cuadrante. Una empresa propia con P (el principal) e Y,
// los dos con el campo del cuadrante; W, con catálogo y sin el campo; y Z, sin catálogo; más uno de baja y uno en pausa:
//
//   · los «Calificados» de cada pieza son los Prioriza, Valida y Financia de SU cliente, y la tira suma sólo a los
//     clientes con campo — mutación: contar Descarta;
//   · el cliente sin el campo no recibe un «Calificados: 0» falso: su pieza dice por qué no hay cifra — mutación:
//     publicar cero;
//   · el aviso nombra a cada cliente sin el campo y separa «no se leyó su catálogo» de «su CRM no tiene el campo»;
//     con un solo cliente a la vista, el aviso de siempre (lo exige la 157) — mutaciones: nombrar siempre, o nunca;
//   · quién cuenta como «un solo cliente»: el principal solo, también con uno de baja al lado; uno en pausa sí se nombra;
//   · el Perfil de la ficha dice la palabra en «Calificación» y no dibuja ni el puntaje viejo ni el campo crudo del
//     cuadrante — mutaciones: volver a poner `score`, o no sacar alguno de los dos campos.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { calidadDelCreativo } from '../../lib/negocio/calidadDelCreativo.ts';
import { lecturaDeCreative } from '../../lib/negocio/lecturaDeCreative.ts';
import { seNombranLosClientes } from '../../lib/negocio/faltaDeLosClientes.ts';
import { perfilDeLaFicha } from '../../lib/negocio/ficha.ts';
import { CAMPO_DEL_PUNTAJE, CLAVE_DEL_CUADRANTE, NOMBRE_DEL_PUNTAJE } from '../../lib/ghl/contrato.ts';

const SLUG = 'zeta-313';
let admin: Client;
let org: string;
let p: string;
let y: string;
let w: string;
let z: string;
let deBaja: string;
let pausada: string;

const foco = (cuenta: string) => ({ orgId: org, todaLaOrganizacion: true, cuentas: [cuenta] }) as const;
const varios = (cuentas: string[]) => ({ orgId: org, todaLaOrganizacion: false, cuentas }) as const;

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['citas', 'contactos', 'campos_del_crm', 'carpetas_del_crm']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

async function cliente(nombre: string, slug: string, estado = 'activa'): Promise<string> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, estado, baja_el)
     values ($1, $2, $3, $4, case when $4 = 'baja' then now() end) returning id`,
    [org, nombre, slug, estado],
  );
  assert.ok(c);
  return c.id;
}

/** Un campo en el catálogo del cliente; con `clave`, el del cuadrante. */
async function campo(cuenta: string, id: string, clave: string | null): Promise<void> {
  await admin.query(
    `insert into negocio.carpetas_del_crm (org_id, cuenta_id, carpeta_id, nombre) values ($1, $2, $3, 'Contact') on conflict do nothing`,
    [org, cuenta, `cp313-${cuenta}`],
  );
  await admin.query(
    `insert into negocio.campos_del_crm (org_id, cuenta_id, campo_id, nombre, carpeta_id, tipo, clave, visto_el)
     values ($1, $2, $3, 'Un campo', $4, 'RADIO', $5, now())`,
    [org, cuenta, id, `cp313-${cuenta}`, clave],
  );
}

/** Un contacto de una pieza, con su cuadrante ya guardado. */
async function contacto(cuenta: string, ghl: string, pieza: string, cuadrante: string | null): Promise<void> {
  await admin.query(
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera, cuadrante)
     values ($1, $2, $3, 'Contacto 313', 'closer', now() - interval '1 day', $4::jsonb, $5)`,
    [org, cuenta, ghl, JSON.stringify({ utmContent: pieza }), cuadrante],
  );
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Zeta 313', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o, 'falta el sembrado');
  org = o.id;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  assert.ok(principal);
  p = principal.id;
  y = await cliente('Segunda 313', 'segunda-313');
  w = await cliente('Tercera 313', 'tercera-313');
  z = await cliente('Cuarta 313', 'cuarta-313');
  deBaja = await cliente('De baja 313', 'baja-313', 'baja');
  pausada = await cliente('Pausada 313', 'pausada-313', 'pausada');

  await campo(p, 'q313p', CLAVE_DEL_CUADRANTE);
  await campo(y, 'q313y', CLAVE_DEL_CUADRANTE);
  // W: un catálogo sin el campo del cuadrante (con el OTRO «cuadrante», que no es éste).
  await campo(w, 'o313w', 'contact.cuadrante');

  for (let i = 0; i < 10; i += 1) {
    await contacto(p, `c313-p${i}`, 'pieza313p', i < 6 ? 'prioriza' : 'descarta');
    await contacto(y, `c313-y${i}`, 'pieza313y', ['prioriza', 'valida', 'financia', 'descarta', null][i % 5]!);
    await contacto(w, `c313-w${i}`, 'pieza313w', null);
  }
  for (let i = 0; i < 3; i += 1) await contacto(z, `c313-z${i}`, 'pieza313z', null);
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('los calificados de cada pieza son los de su cliente, y el que no tiene el campo no recibe un cero', async () => {
  const lectura = await conOrganizacion(org, () => lecturaDeCreative(30));
  const pieza = (cuenta: string, nombre: string) => lectura.pantalla.piezas.find((x) => x.cuentaId === cuenta && x.nombre === nombre);
  assert.deepEqual(pieza(p, 'pieza313p')?.cifras.calificados, { valor: 6, motivo: null }, 'contó los Descarta de P');
  // Y: dos Prioriza, dos Valida y dos Financia de diez —los Descarta y los sin cuadrante no—.
  assert.deepEqual(pieza(y, 'pieza313y')?.cifras.calificados, { valor: 6, motivo: null });
  assert.deepEqual(pieza(w, 'pieza313w')?.cifras.calificados, { valor: null, motivo: 'sin_clasificacion' }, 'el cliente sin campo recibió un cero de calificados');
  assert.equal(lectura.pantalla.cifras.calificados.valor, 12, 'la tira no sumó los calificados de los clientes con campo');
  assert.deepEqual([...lectura.calidad.cuentasSinCuadrante].sort(), [w, z].sort());

  const fila = (cuenta: string, nombre: string) => lectura.calidad.filas.find((f) => f.cuentaId === cuenta && f.creativo === nombre);
  assert.deepEqual([fila(p, 'pieza313p')?.clasificados, fila(p, 'pieza313p')?.porcionDeDescarta], [10, 0.4]);
});

test('el aviso nombra a cada cliente sin el campo, y separa el catálogo sin leer del campo que falta', async () => {
  const lectura = await conOrganizacion(org, () => lecturaDeCreative(30));
  assert.match(lectura.calidad.aviso ?? '', /El CRM de «Tercera 313» no tiene el campo del cuadrante del ICP/);
  assert.match(lectura.calidad.aviso ?? '', /Todavía no se leyó el catálogo de campos de «Cuarta 313»/, 'sin catálogo se dijo que no hay campo');
  assert.doesNotMatch(lectura.calidad.aviso ?? '', /«Cuarta 313» no tiene/);

  // Con el foco en un cliente con campo, nada de esto: el aviso de siempre (aquí, a lo sumo el de las piezas chicas).
  const deP = await conOrganizacion(foco(p), () => calidadDelCreativo(30));
  assert.doesNotMatch(deP.aviso ?? '', /cuadrante|catálogo/i, 'con un solo cliente con campo, el aviso habló de clientes');
  assert.deepEqual(deP.cuentasSinCuadrante, []);

  // Con ninguno a la vista con campo pero con el foco en uno que no es el principal, o con varios, tampoco el texto de la
  // empresa: «el CRM de esta empresa» no es el suyo, y diría «no tiene el campo» de uno cuyo catálogo ni se leyó.
  const deW = await conOrganizacion(foco(w), () => calidadDelCreativo(30));
  const deZ = await conOrganizacion(foco(z), () => calidadDelCreativo(30));
  const deLosDos = await conOrganizacion(varios([w, z]), () => calidadDelCreativo(30));
  assert.deepEqual([deW.campoDelCuadrante, deZ.campoDelCuadrante, deLosDos.campoDelCuadrante], [null, null, null]);
  for (const a of [deW.aviso, deZ.aviso, deLosDos.aviso]) {
    assert.doesNotMatch(a ?? '', /El CRM de esta empresa/, 'con otro cliente a la vista y ninguno con campo, el aviso habló de la empresa');
  }
  assert.match(deW.aviso ?? '', /El CRM de «Tercera 313» no tiene el campo del cuadrante/);
  assert.match(deZ.aviso ?? '', /Todavía no se leyó el catálogo de campos de «Cuarta 313»/);
  assert.match(deLosDos.aviso ?? '', /Todavía no se leyó el catálogo de campos de «Cuarta 313».*El CRM de «Tercera 313»/);
});

test('el Perfil dice la palabra en «Calificación», y no dibuja el puntaje viejo ni el campo crudo del cuadrante', async () => {
  /* Una carpeta de P que se muestra, con el campo del cuadrante de P (el único con su clave en la subcuenta: GoHighLevel
     no deja dos), el del puntaje viejo y una pregunta cualquiera. */
  await admin.query(
    `insert into negocio.carpetas_del_crm (org_id, cuenta_id, carpeta_id, nombre, grupo) values ($1, $2, 'cp313-perfil', 'Calificación', 'calificacion')`,
    [org, p],
  );
  await admin.query(`update negocio.campos_del_crm set carpeta_id = 'cp313-perfil' where org_id = $1 and campo_id = 'q313p'`, [org]);
  for (const [id, nombre, clave] of [
    [CAMPO_DEL_PUNTAJE, NOMBRE_DEL_PUNTAJE, null],
    ['r313perfil', 'Objetivo de facturación', null],
  ] as const) {
    await admin.query(
      `insert into negocio.campos_del_crm (org_id, cuenta_id, campo_id, nombre, carpeta_id, tipo, clave, visto_el)
       values ($1, $2, $3, $4, 'cp313-perfil', 'TEXT', $5, now())`,
      [org, p, id, nombre, clave],
    );
  }
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, campos_del_crm, score, cuadrante)
     values ($1, $2, 'c313-perfil', 'Contacto 313', 'closer', $3::jsonb, 87, 'financia') returning id`,
    [org, p, JSON.stringify({ q313p: 'Financia', [CAMPO_DEL_PUNTAJE]: '87', r313perfil: 'Más de 10 mil' })],
  );
  assert.ok(c);
  try {
    const perfil = await conOrganizacion(org, () => perfilDeLaFicha(c.id));
    const deCalificacion = perfil.filas.filter((f) => f.grupo === 'calificacion').map((f) => [f.etiqueta, f.valor]);
    assert.deepEqual(
      deCalificacion,
      [['Calificación', 'Financia'], ['Objetivo de facturación', 'Más de 10 mil']],
      'el Perfil volvió a dibujar el puntaje, o dibujó el cuadrante dos veces',
    );
    assert.doesNotMatch(JSON.stringify(perfil), /87/, 'un número del ICP llegó al Perfil');
  } finally {
    await admin.query(`delete from negocio.contactos where org_id = $1 and ghl_contact_id = 'c313-perfil'`, [org]);
    await admin.query(`update negocio.campos_del_crm set carpeta_id = $2 where org_id = $1 and campo_id = 'q313p'`, [org, `cp313-${p}`]);
    await admin.query(`delete from negocio.campos_del_crm where org_id = $1 and carpeta_id = 'cp313-perfil'`, [org]);
    await admin.query(`delete from negocio.carpetas_del_crm where org_id = $1 and carpeta_id = 'cp313-perfil'`, [org]);
  }
});

test('quién cuenta como «un solo cliente»: el principal solo, también con uno de baja; uno en pausa sí se nombra', async () => {
  const nombra = (cuentas: string[]) => conOrganizacion(varios(cuentas), () => seNombranLosClientes());
  assert.deepEqual(
    [await nombra([p]), await nombra([p, deBaja]), await nombra([p, pausada]), await conOrganizacion(foco(w), () => seNombranLosClientes()), await conOrganizacion(org, () => seNombranLosClientes())],
    [false, false, true, true, true],
    'el principal solo, con uno de baja, con uno en pausa, el foco en otro y la empresa entera',
  );
});
