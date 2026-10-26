// EL CUADRANTE DEL ICP LLEGA DEL CRM: la clave del campo, la sincronización y el recálculo desde lo guardado. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (ICP en cuadrantes · Q1, la `105`)
//
// Una empresa propia con P (el principal: el campo del cuadrante y, al lado, el OTRO campo «cuadrante» que tiene la
// subcuenta de ARIA), Y (su catálogo es de antes de la `105`: sin claves), Z (sin claves y el CRM no deja leer su
// catálogo) y W (sin el campo):
//
//   · UNA normalización: el SQL (`cuadranteUsable`) dice lo mismo que la sincronización (`cuadranteDeUnValor`) de cada
//     valor de borde — mutaciones: otra lista de espacios, sin `translate`, sin `lower`;
//   · el campo se reconoce por su clave exacta, uno por subcuenta, y no por el otro «cuadrante» — mutación: buscar por
//     `like`;
//   · la sincronización escribe la clave del cuadrante, y lo que no es ninguna de las cuatro como nulo;
//   · un catálogo sin claves se relee aunque esté fresco, guarda las claves, y los contactos quedan clasificados en la
//     misma corrida, también el congelado que el CRM ya no trae — mutaciones: `estaFresco` sin mirar las claves, el
//     refresco sin guardar `clave`, la sincronización sin `recalcularLosCuadrantes`;
//   · sin los ids del campo, la sincronización no borra un cuadrante — mutación: escribir `null` cuando no se conocen;
//   · el recálculo no toca a un cliente sin el campo — mutación: sin el filtro por cliente;
//   · las cuatro claves son las de `catalogo.cuadrantes` (la `079`).
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { BORDES_DEL_CUADRANTE } from '../apoyo/cuadrantes.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';
import { camposDelCuadrante, cuadranteUsable, recalcularLosCuadrantes } from '../../lib/negocio/camposDelCrm.ts';
import { LOS_CUATRO, cuadranteDeUnValor } from '../../lib/negocio/cuadrantesDelIcp.ts';
import { sincronizarContactos } from '../../lib/negocio/sincronizar.ts';
import { CLAVE_DEL_CUADRANTE } from '../../lib/ghl/contrato.ts';

const SLUG = 'delta-311';
/** El campo del cuadrante en cada subcuenta, y el otro «cuadrante» de P. */
const QP = 'q311p';
const QY = 'q311y';
const QZ = 'q311z';
const OTRO = 'o311p';

let admin: Client;
let org: string;
let p: string;
let y: string;
let z: string;
let w: string;
const fetchOriginal = globalThis.fetch;

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['contactos', 'campos_del_crm', 'carpetas_del_crm', 'ingesta_pulso']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

async function cliente(nombre: string, slug: string): Promise<string> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, estado) values ($1, $2, $3, 'activa') returning id`,
    [org, nombre, slug],
  );
  assert.ok(c);
  return c.id;
}

async function campo(cuenta: string, id: string, nombre: string, clave: string | null): Promise<void> {
  await admin.query(
    `insert into negocio.carpetas_del_crm (org_id, cuenta_id, carpeta_id, nombre, grupo) values ($1, $2, $3, 'Contact', 'calificacion')
     on conflict do nothing`,
    [org, cuenta, `cp311-${cuenta}`],
  );
  await admin.query(
    `insert into negocio.campos_del_crm (org_id, cuenta_id, campo_id, nombre, carpeta_id, tipo, clave, visto_el)
     values ($1, $2, $3, $4, $5, 'RADIO', $6, now())`,
    [org, cuenta, id, nombre, `cp311-${cuenta}`, clave],
  );
}

/** Un contacto con sus campos ya guardados. `territorio` nulo = congelado: la sincronización ya no lo trae. */
async function contacto(
  cuenta: string,
  ghl: string,
  campos: Record<string, string>,
  o: { cuadrante?: string | null; territorio?: string | null } = {},
): Promise<void> {
  await admin.query(
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, campos_del_crm, cuadrante)
     values ($1, $2, $3, 'Contacto 311', $4, now(), $5::jsonb, $6)`,
    [org, cuenta, ghl, o.territorio === undefined ? 'closer' : o.territorio, JSON.stringify(campos), o.cuadrante ?? null],
  );
}

const cuadrantes = async (cuenta: string) =>
  Object.fromEntries(
    (
      await filas<{ ghl_contact_id: string; cuadrante: string | null }>(
        admin,
        `select ghl_contact_id, cuadrante from negocio.contactos where org_id = $1 and cuenta_id = $2 order by 1`,
        [org, cuenta],
      )
    ).map((f) => [f.ghl_contact_id, f.cuadrante]),
  );

/**
 * GoHighLevel falso: estos contactos en `zona_closer`; el catálogo de la subcuenta con estas definiciones (o un 500 si
 * `catalogo` es `null`). Devuelve cuántas veces se pidió el catálogo.
 */
async function sincronizar(
  cuenta: string,
  contactos: { id: string; campos: Record<string, unknown> }[],
  catalogo: { id: string; name: string; fieldKey: string }[] | null = [],
): Promise<number> {
  let pedidosDelCatalogo = 0;
  globalThis.fetch = (async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : String(entrada);
    const cuerpo = typeof opciones?.body === 'string' ? (JSON.parse(opciones.body) as { filters?: { value?: string }[] }) : {};
    if (url.includes('/contacts/search')) {
      const lista =
        cuerpo.filters?.[0]?.value === 'zona_closer'
          ? contactos.map((c) => ({
              id: c.id,
              contactName: `Contacto ${c.id}`,
              tags: ['zona_closer'],
              customFields: Object.entries(c.campos).map(([id, value]) => ({ id, value })),
            }))
          : [];
      return new Response(JSON.stringify({ contacts: lista, total: lista.length }), { status: 200 });
    }
    if (/\/customFields$/.test(url)) {
      pedidosDelCatalogo += 1;
      if (catalogo === null) return new Response('{}', { status: 500 });
      return new Response(
        JSON.stringify({
          customFields: catalogo.map((f) => ({ ...f, parentId: `cp311-${cuenta}`, dataType: 'RADIO', position: 1, documentType: 'field' })),
        }),
        { status: 200 },
      );
    }
    if (/\/customFields\/[^/?]+$/.test(url)) return new Response(JSON.stringify({ customField: { name: 'Contact' } }), { status: 200 });
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof globalThis.fetch;
  try {
    const s = await conOrganizacion(ambitoDeUnCliente(org, cuenta), () => sincronizarContactos({ token: 't311', locationId: `loc311-${cuenta}` }));
    assert.equal(s.tipo, 'listo');
  } finally {
    globalThis.fetch = fetchOriginal;
  }
  return pedidosDelCatalogo;
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Delta 311', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o, 'falta el sembrado');
  org = o.id;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  assert.ok(principal);
  p = principal.id;
  y = await cliente('Segunda 311', 'segunda-311');
  z = await cliente('Tercera 311', 'tercera-311');
  w = await cliente('Cuarta 311', 'cuarta-311');

  // P, como la subcuenta de ARIA: el campo del cuadrante y el otro «cuadrante», que no es éste.
  await campo(p, QP, 'Cuadrante de Clasificacion', CLAVE_DEL_CUADRANTE);
  await campo(p, OTRO, 'cuadrante', 'contact.cuadrante');
  // Y y Z: catálogos leídos antes de la `105`, sin claves (y frescos: se leyeron hace un rato).
  await campo(y, QY, 'Cuadrante de Clasificacion', null);
  await campo(z, QZ, 'Cuadrante de Clasificacion', null);
  // W: un catálogo sin el campo.
  await campo(w, 'txt311w', 'Algo', 'contact.algo');
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('una sola normalización: el SQL dice lo mismo que la sincronización de cada valor de borde', async () => {
  // El SQL recibe texto: los bordes que no son texto (un número, un arreglo) los prueba la 310 contra la sincronización.
  const textos = BORDES_DEL_CUADRANTE.filter(([v]) => typeof v === 'string' || v === null).map(([v]) => v as string | null);
  const enSql = await conOrganizacion(org, async () =>
    Promise.all(textos.map(async (v) => (await sql<{ c: string | null }>`select ${cuadranteUsable(sql`${v}::text`)} as c`.execute(datos())).rows[0]!.c)),
  );
  assert.deepEqual(enSql, textos.map((v) => cuadranteDeUnValor(v)), 'el SQL y la sincronización normalizan distinto');
});

test('las cuatro claves son las de catalogo.cuadrantes, sin el «rechazo» que el CRM no manda', async () => {
  const claves = await filas<{ clave: string }>(admin, `select clave from catalogo.cuadrantes where clave <> 'rechazo' order by orden`);
  assert.deepEqual(claves.map((f) => f.clave), [...LOS_CUATRO]);
});

test('el campo se reconoce por su clave exacta, uno por subcuenta, y no por el otro «cuadrante»', async () => {
  assert.deepEqual(await conOrganizacion(ambitoDeUnCliente(org, p), () => camposDelCuadrante()), [QP]);
  assert.deepEqual(await conOrganizacion(ambitoDeUnCliente(org, y), () => camposDelCuadrante()), [], 'sin claves no hay campo');
});

test('la sincronización escribe la clave del cuadrante, y lo que no es ninguna de las cuatro como nulo', async () => {
  await sincronizar(p, [
    { id: 'p1', campos: { [QP]: 'Prioriza ' } },
    { id: 'p2', campos: { [QP]: 'valida' } },
    { id: 'p3', campos: { [QP]: 'FINANCIA' } },
    { id: 'p4', campos: { [QP]: 'Descarta' } },
    { id: 'p5', campos: { [QP]: 'Prioridad' } },
    // Sólo el OTRO campo «cuadrante»: su «Prioridad» no es un Prioriza.
    { id: 'p6', campos: { [OTRO]: 'Prioridad' } },
    { id: 'p7', campos: {} },
  ]);
  assert.deepEqual(await cuadrantes(p), {
    p1: 'prioriza',
    p2: 'valida',
    p3: 'financia',
    p4: 'descarta',
    p5: null,
    p6: null,
    p7: null,
  });
});

test('un catálogo sin claves se relee ya, y los contactos quedan clasificados en la misma corrida, también el congelado', async () => {
  await contacto(y, 'y1', { [QY]: 'Financia' }, { cuadrante: 'financia' });
  // Congelado: el CRM ya no lo trae, y su valor sólo está en lo guardado.
  await contacto(y, 'y2', { [QY]: 'Valida' }, { territorio: null });

  const pedidos = await sincronizar(y, [{ id: 'y1', campos: { [QY]: 'Prioriza' } }], [
    { id: QY, name: 'Cuadrante de Clasificacion', fieldKey: CLAVE_DEL_CUADRANTE },
  ]);
  assert.equal(pedidos, 1, 'el catálogo sin claves estaba fresco y no se releyó');
  const clave = await unaFila<{ clave: string | null }>(admin, `select clave from negocio.campos_del_crm where org_id = $1 and campo_id = $2`, [org, QY]);
  assert.equal(clave?.clave, CLAVE_DEL_CUADRANTE, 'el refresco no guardó la clave');
  assert.deepEqual(await cuadrantes(y), { y1: 'prioriza', y2: 'valida' }, 'la corrida no reclasificó desde lo guardado');

  // Con las claves ya guardadas y el catálogo fresco, la corrida siguiente no lo vuelve a pedir.
  assert.equal(await sincronizar(y, [{ id: 'y1', campos: { [QY]: 'Prioriza' } }]), 0, 'un catálogo con claves y fresco se volvió a leer');
});

test('sin los ids del campo, la sincronización no borra el cuadrante que había', async () => {
  // Z: sin claves, y el CRM no deja leer su catálogo, así que en esta corrida nadie sabe cuál es el campo.
  await contacto(z, 'z1', { [QZ]: 'Prioriza' }, { cuadrante: 'prioriza' });
  await sincronizar(z, [{ id: 'z1', campos: { [QZ]: 'Prioriza' } }], null);
  assert.deepEqual(await cuadrantes(z), { z1: 'prioriza' });
});

test('el recálculo sólo toca a los clientes con el campo, y sólo las filas que cambian', async () => {
  // W no tiene el campo: lo que tenga su contacto no lo decide este recálculo.
  await contacto(w, 'w1', { txt311w: 'Prioriza' }, { cuadrante: 'valida' });
  // Un contacto de P cuyo cuadrante guardado ya no es el de sus campos (lo cambió el CRM mientras estaba congelado).
  await contacto(p, 'p8', { [QP]: 'Descarta' }, { cuadrante: 'prioriza', territorio: null });

  const cambiaron = await conOrganizacion(org, () => recalcularLosCuadrantes());
  assert.equal(cambiaron, 1, 'el recálculo reescribió filas que no cambiaban');
  assert.equal((await cuadrantes(p)).p8, 'descarta');
  assert.deepEqual(await cuadrantes(w), { w1: 'valida' }, 'el recálculo tocó a un cliente sin el campo');
});
