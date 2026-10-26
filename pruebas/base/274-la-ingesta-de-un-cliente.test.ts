// LA INGESTA ES DE UN CLIENTE: EL ÁMBITO, LAS CLAVES CON CUENTA Y LA SINCRONIZACIÓN. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Bloque C, Paso C1)
//
// Lo que entra del CRM es de un cliente. Con una empresa de dos clientes activos (X, el por omisión, e Y):
//
//   · el cliente por omisión es X (`porOmisionDe`);
//   · las claves con el cliente existen DE VERDAD y son únicas — la `090` las crea con `if not exists`, y un nombre
//     ya tomado las saltearía en silencio (pasó: `<tabla>_por_cuenta` era de la `082`) — y las de la organización ya
//     no existen (la `092` las cerró);
//   · el pulso y el gasto que se escriben en el ámbito de X quedan en X;
//   · sincronizar con la empresa entera y dos clientes se rechaza, y no congela a nadie — mutación: sacar
//     `exigirUnSoloCliente`;
//   · sincronizar en el ámbito de X congela sólo a los contactos de X que la búsqueda no trajo; los de Y siguen.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { ambitoDeUnCliente, cuentaDe, porOmisionDe, type AmbitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';
import { conElPulso } from '../../lib/negocio/pulso.ts';
import { guardarDias } from '../../lib/negocio/recolectarDeMeta.ts';
import { sincronizarContactos } from '../../lib/negocio/sincronizar.ts';

const SLUG = 'gamma-274';
const ACCESO = { token: 'token-274', locationId: 'loc-274' };

let admin: Client;
let org: string;
let x: AmbitoDeUnCliente;
let y: string;

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['contactos', 'ingesta_pulso', 'gasto_por_cuenta_publicitaria', 'gasto_de_la_cuenta', 'campos_del_crm', 'carpetas_del_crm']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Un contacto con territorio, de un cliente. */
async function contacto(cuenta: string, ghlId: string): Promise<void> {
  await admin.query(
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm)
     values ($1, $2, $3, 'Contacto 274', 'closer', now())`,
    [org, cuenta, ghlId],
  );
}

const territorio = async (ghlId: string): Promise<string | null> =>
  (await unaFila<{ t: string | null }>(admin, `select territorio as t from negocio.contactos where org_id = $1 and ghl_contact_id = $2`, [org, ghlId]))
    ?.t ?? null;

/** GoHighLevel falso: la búsqueda por `zona_closer` trae un solo contacto; lo demás, vacío. */
function ghlQueTrae(ids: string[]): typeof globalThis.fetch {
  return (async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : String(entrada);
    const cuerpo = typeof opciones?.body === 'string' ? (JSON.parse(opciones.body) as { filters?: { value?: string }[] }) : {};
    if (url.includes('/contacts/search')) {
      const etiqueta = cuerpo.filters?.[0]?.value;
      const contactos = etiqueta === 'zona_closer' ? ids.map((id) => ({ id, contactName: 'Contacto 274', tags: ['zona_closer'] })) : [];
      return new Response(JSON.stringify({ contacts: contactos, total: contactos.length }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof globalThis.fetch;
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 274', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  const segunda = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Segunda 274', 'segunda-274') returning id`,
    [org],
  );
  assert.ok(segunda);
  y = segunda.id;
  x = await porOmisionDe(org);
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('el cliente por omisión es el marcado, y el ámbito de un cliente no se arma sin sus dos datos', async () => {
  const marcada = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  assert.equal(cuentaDe(x), marcada?.id);
  assert.notEqual(cuentaDe(x), y);
  assert.throws(() => ambitoDeUnCliente(org, ''), /hacen falta/);
});

test('las claves son las del cliente, y las de la organización ya no existen', async () => {
  // Las únicas de cada tabla, con sus columnas. La `092` cerró las de la organización: la clave primaria de
  // `ingesta_pulso` y `gasto_de_la_cuenta` se armó con el índice de la `090`, y el sello quedó con su `id`.
  const unicos = await filas<{ tabla: string; columnas: string; nulos: boolean }>(
    admin,
    `select t.relname as tabla,
            (select string_agg(a.attname, ',' order by k.n)
               from unnest(i.indkey) with ordinality as k(attnum, n)
               join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum) as columnas,
            i.indnullsnotdistinct as nulos
       from pg_index i join pg_class t on t.oid = i.indrelid join pg_namespace s on s.oid = t.relnamespace
      where s.nspname = 'negocio' and i.indisunique
        and t.relname in ('ingesta_pulso', 'gasto_de_la_cuenta', 'avisos_del_crm', 'tareas_programadas')
      order by 1, 2`,
  );
  assert.deepEqual(
    unicos.map((u) => `${u.tabla}(${u.columnas})${u.nulos ? ' nulls not distinct' : ''}`),
    [
      'avisos_del_crm(org_id,cuenta_id,huella)',
      'avisos_del_crm(org_id,id)',
      'gasto_de_la_cuenta(org_id,cuenta_id,fecha)',
      'ingesta_pulso(org_id,cuenta_id,clave)',
      'tareas_programadas(org_id,cuenta_id,tarea) nulls not distinct',
      'tareas_programadas(org_id,id)',
    ],
    'falta una clave con el cliente, o sigue una de la organización: dos clientes chocarían en ella',
  );
});

test('el pulso y el gasto que se escriben en el ámbito de un cliente quedan en ese cliente', async () => {
  const r = await conElPulso(x, 'mensajes', async () => ({
    cierre: { marcaEl: null, llamadas: 0, atrasado: false, fallo: null },
    resultado: null,
  }));
  assert.equal(r.corrio, true);
  // El escritor del gasto es el de Meta directo (M3): la cuenta publicitaria y, con ella, el total del cliente.
  await conOrganizacion(x, () =>
    guardarDias('act_274', 'PEN', '2026-10-01', '2026-10-01', [
      { fecha: '2026-10-01', gasto: 12.5, impresiones: 100, clics: 3, alcance: null, frecuencia: null, cpm: null, moneda: 'PEN' },
    ]),
  );
  const pulso = await filas<{ cuenta_id: string }>(admin, `select cuenta_id from negocio.ingesta_pulso where org_id = $1`, [org]);
  const gasto = await filas<{ cuenta_id: string }>(admin, `select cuenta_id from negocio.gasto_de_la_cuenta where org_id = $1`, [org]);
  assert.deepEqual(pulso, [{ cuenta_id: cuentaDe(x) }]);
  assert.deepEqual(gasto, [{ cuenta_id: cuentaDe(x) }]);
});

test('sincronizar con la empresa entera y dos clientes se rechaza, y no congela a nadie', async () => {
  await contacto(cuentaDe(x), 'c274-x-1');
  await contacto(y, 'c274-y-1');
  const original = globalThis.fetch;
  globalThis.fetch = ghlQueTrae(['c274-x-otro']);
  try {
    await assert.rejects(
      conOrganizacion(org, () => sincronizarContactos(ACCESO)),
      /varios clientes activos/,
      'la sincronización corrió con la empresa entera: su resta congela a los contactos de los demás clientes',
    );
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(await territorio('c274-y-1'), 'closer', 'se congeló el contacto de otro cliente');
  assert.equal(await territorio('c274-x-1'), 'closer');
});

test('sincronizar en el ámbito de un cliente congela sólo a los suyos', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = ghlQueTrae(['c274-x-otro']);
  try {
    const r = await conOrganizacion(x, () => sincronizarContactos(ACCESO));
    assert.equal(r.tipo, 'listo');
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(await territorio('c274-x-1'), null, 'el contacto de X que la búsqueda no trajo tenía que congelarse');
  assert.equal(await territorio('c274-y-1'), 'closer', 'se congeló un contacto de Y, que se busca con otro token');
  const nuevo = await unaFila<{ cuenta_id: string }>(admin, `select cuenta_id from negocio.contactos where org_id = $1 and ghl_contact_id = 'c274-x-otro'`, [org]);
  assert.equal(nuevo?.cuenta_id, cuentaDe(x), 'el contacto traído quedó en otro cliente');
});
