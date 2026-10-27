// LA HISTORIA DEL CUADRANTE: cada cambio de contactos.cuadrante deja una clasificación y un evento. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (la `106`, el disparador `negocio.registrar_cambio_de_cuadrante`)
//
// El cuadrante se PISA en cada sincronización (la `105`); GoHighLevel no guarda su historia. Desde la `106` un
// disparador de la base la escribe en la misma transacción que la escritura, para todos los escritores:
//
//   · un alta con cuadrante deja la foto inicial: una clasificación con primera_vez y su evento cuadrante_cambiado,
//     cruzados por id; un alta sin cuadrante no deja nada — mutación: el disparador sin cuerpo, o sin el del alta;
//   · la sincronización (bajo el ámbito de un cliente) que cambia el cuadrante deja UNA clasificación y UN evento con
//     el anterior y el nuevo; la que no lo cambia, ninguno — mutación: sin el `when … is distinct from`;
//   · el recálculo (bajo la organización entera, como la ficha) deja una por fila que cambia — mutación: el
//     disparador sin cuerpo;
//   · vaciar el cuadrante también se registra (cuadrante nulo) — mutación: un `when new.cuadrante is not null`;
//   · una escritura que se revierte no deja historia — es la misma transacción;
//   · los datos del evento tienen la forma de su tipo (required ⊆ claves ⊆ properties del esquema sembrado).
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';
import { recalcularLosCuadrantes } from '../../lib/negocio/camposDelCrm.ts';
import { sincronizarContactos } from '../../lib/negocio/sincronizar.ts';
import { CLAVE_DEL_CUADRANTE } from '../../lib/ghl/contrato.ts';

const SLUG = 'historia-320';
const CAMPO = 'q320';
const CARPETA = 'cp320';

let admin: Client;
let org: string;
let cuenta: string;
const fetchOriginal = globalThis.fetch;

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['contactos', 'campos_del_crm', 'carpetas_del_crm', 'ingesta_pulso']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Un contacto guardado por la base (como lo dejó una sincronización anterior). */
async function contacto(ghl: string, campos: Record<string, string>, cuadrante: string | null, territorio: string | null = 'closer'): Promise<string> {
  const f = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, campos_del_crm, cuadrante)
     values ($1, $2, $3, 'Contacto 320', $4, now(), $5::jsonb, $6) returning id`,
    [org, cuenta, ghl, territorio, JSON.stringify(campos), cuadrante],
  );
  assert.ok(f);
  return f.id;
}

interface Clasificacion {
  id: string;
  cuadrante: string | null;
  cuadrante_anterior: string | null;
  origen: string;
  primera_vez: boolean;
  evento_id: string | null;
  cuenta_id: string;
}
interface Evento {
  id: string;
  id_externo: string;
  fuente: string;
  actor_tipo: string;
  cuenta_id: string;
  datos: Record<string, unknown>;
}

async function historia(contactoId: string): Promise<{ clasificaciones: Clasificacion[]; eventos: Evento[] }> {
  return {
    clasificaciones: await filas<Clasificacion>(
      admin,
      `select id, cuadrante, cuadrante_anterior, origen, primera_vez, evento_id, cuenta_id from negocio.clasificaciones
        where org_id = $1 and contacto_id = $2 order by clasificado_el, id`,
      [org, contactoId],
    ),
    eventos: await filas<Evento>(
      admin,
      `select id, id_externo, fuente, actor_tipo, cuenta_id, datos from negocio.eventos
        where org_id = $1 and contacto_id = $2 and tipo = 'cuadrante_cambiado' order by ocurrio_el, id`,
      [org, contactoId],
    ),
  };
}

const idDe = async (ghl: string) =>
  (await unaFila<{ id: string }>(admin, `select id from negocio.contactos where org_id = $1 and ghl_contact_id = $2`, [org, ghl]))!.id;

/** GoHighLevel falso: estos contactos en `zona_closer`, con sus campos. Corre bajo el ámbito del cliente. */
async function sincronizar(contactos: { id: string; campos: Record<string, string> }[]): Promise<void> {
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
      return new Response(
        JSON.stringify({
          customFields: [{ id: CAMPO, name: 'Cuadrante de Clasificacion', fieldKey: CLAVE_DEL_CUADRANTE, parentId: CARPETA, dataType: 'RADIO', position: 1, documentType: 'field' }],
        }),
        { status: 200 },
      );
    }
    if (/\/customFields\/[^/?]+$/.test(url)) return new Response(JSON.stringify({ customField: { name: 'Contact' } }), { status: 200 });
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof globalThis.fetch;
  try {
    const s = await conOrganizacion(ambitoDeUnCliente(org, cuenta), () => sincronizarContactos({ token: 't320', locationId: 'loc320' }));
    assert.equal(s.tipo, 'listo');
  } finally {
    globalThis.fetch = fetchOriginal;
  }
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Historia 320', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  cuenta = (await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]))!.id;
  await admin.query(
    `insert into negocio.carpetas_del_crm (org_id, cuenta_id, carpeta_id, nombre, grupo) values ($1, $2, $3, 'Contact', 'calificacion')`,
    [org, cuenta, CARPETA],
  );
  await admin.query(
    `insert into negocio.campos_del_crm (org_id, cuenta_id, campo_id, nombre, carpeta_id, tipo, clave, visto_el)
     values ($1, $2, $3, 'Cuadrante de Clasificacion', $4, 'RADIO', $5, now())`,
    [org, cuenta, CAMPO, CARPETA, CLAVE_DEL_CUADRANTE],
  );
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

test('un alta con cuadrante deja la foto inicial: una clasificación con primera_vez y su evento, cruzados', async () => {
  const id = await conOrganizacion(ambitoDeUnCliente(org, cuenta), async () =>
    (
      await datos()
        .insertInto('contactos')
        .values({ org_id: org, ghl_contact_id: 'a320', nombre: 'Alta 320', cuadrante: 'valida', campos_del_crm: JSON.stringify({ [CAMPO]: 'Valida' }) })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id,
  );
  const h = await historia(id);
  assert.equal(h.clasificaciones.length, 1, 'el alta con cuadrante no dejó su clasificación');
  assert.equal(h.eventos.length, 1, 'el alta con cuadrante no dejó su evento');
  const [k] = h.clasificaciones;
  const [e] = h.eventos;
  assert.deepEqual(
    { cuadrante: k!.cuadrante, anterior: k!.cuadrante_anterior, origen: k!.origen, primera: k!.primera_vez, cuenta: k!.cuenta_id },
    { cuadrante: 'valida', anterior: null, origen: 'crm', primera: true, cuenta },
  );
  // Cruzados sin ningún update: la clasificación nombra al evento y el evento a la clasificación.
  assert.equal(k!.evento_id, e!.id);
  assert.equal(e!.datos.clasificacion_id, k!.id);
  assert.equal(e!.id_externo, `cuadrante:${k!.id}`);
  assert.deepEqual(
    { fuente: e!.fuente, actor: e!.actor_tipo, cuenta: e!.cuenta_id, datos: e!.datos },
    {
      fuente: 'ghl',
      actor: 'sistema',
      cuenta,
      datos: { cuadrante: 'valida', cuadrante_anterior: null, clasificacion_id: k!.id, origen: 'crm', primera_vez: true },
    },
  );

  const sin = await contacto('b320', {}, null);
  assert.deepEqual(await historia(sin), { clasificaciones: [], eventos: [] }, 'un alta sin cuadrante dejó historia');
});

test('la sincronización que cambia el cuadrante deja una clasificación y un evento; la que no lo cambia, ninguno', async () => {
  const id = await contacto('s320', { [CAMPO]: 'Financia' }, 'financia');
  assert.equal((await historia(id)).clasificaciones.length, 1);

  await sincronizar([{ id: 's320', campos: { [CAMPO]: 'Prioriza' } }]);
  const h = await historia(id);
  assert.equal(h.clasificaciones.length, 2, 'el cambio de la sincronización no dejó una clasificación');
  assert.equal(h.eventos.length, 2, 'el cambio de la sincronización no dejó un evento');
  assert.deepEqual(
    { cuadrante: h.clasificaciones[1]!.cuadrante, anterior: h.clasificaciones[1]!.cuadrante_anterior, primera: h.clasificaciones[1]!.primera_vez },
    { cuadrante: 'prioriza', anterior: 'financia', primera: false },
  );
  assert.deepEqual(
    [h.eventos[1]!.datos.cuadrante, h.eventos[1]!.datos.cuadrante_anterior, h.eventos[1]!.datos.primera_vez],
    ['prioriza', 'financia', false],
  );

  // La misma pasada otra vez: el upsert reescribe el cuadrante con el mismo valor, y eso no es un cambio.
  await sincronizar([{ id: 's320', campos: { [CAMPO]: 'Prioriza' } }]);
  const otra = await historia(id);
  assert.equal(otra.clasificaciones.length, 2, 'una sincronización sin cambio dejó una clasificación');
  assert.equal(otra.eventos.length, 2, 'una sincronización sin cambio dejó un evento');
});

test('el recálculo bajo la organización entera deja una por fila que cambia, y vaciarlo también se registra', async () => {
  // Congelados (la sincronización ya no los trae): uno cuyo campo dice otra cosa, y otro al día.
  const cambia = await contacto('r320', { [CAMPO]: 'Descarta' }, 'prioriza', null);
  const igual = await contacto('i320', { [CAMPO]: 'Valida' }, 'valida', null);

  const cambiaron = await conOrganizacion(org, () => recalcularLosCuadrantes());
  assert.equal(cambiaron, 1);
  const h = await historia(cambia);
  assert.equal(h.clasificaciones.length, 2, 'el recálculo no dejó la clasificación del cambio');
  assert.deepEqual([h.clasificaciones[1]!.cuadrante, h.clasificaciones[1]!.cuadrante_anterior], ['descarta', 'prioriza']);
  assert.equal(h.eventos.length, 2);
  assert.equal((await historia(igual)).clasificaciones.length, 1, 'el recálculo dejó historia en una fila que no cambió');

  // El CRM vacía el campo: el lead queda sin clasificar, y eso también es un cambio.
  await conOrganizacion(org, () => datos().updateTable('contactos').set({ cuadrante: null }).where('id', '=', cambia).execute());
  const vacio = await historia(cambia);
  assert.equal(vacio.clasificaciones.length, 3, 'vaciar el cuadrante no se registró');
  assert.deepEqual([vacio.clasificaciones[2]!.cuadrante, vacio.clasificaciones[2]!.cuadrante_anterior], [null, 'descarta']);
  assert.equal(vacio.eventos[2]!.datos.cuadrante, null);
});

test('una escritura que se revierte no deja historia: es la misma transacción', async () => {
  const id = await contacto('t320', {}, 'financia');
  const antes = await historia(id);
  await assert.rejects(
    conOrganizacion(ambitoDeUnCliente(org, cuenta), async () => {
      await datos().updateTable('contactos').set({ cuadrante: 'descarta' }).where('id', '=', id).execute();
      throw new Error('la pasada se cae después de escribir');
    }),
    /la pasada se cae/,
  );
  assert.deepEqual(await historia(id), antes, 'quedó historia de una escritura revertida');
  const c = await unaFila<{ cuadrante: string }>(admin, `select cuadrante from negocio.contactos where id = $1`, [id]);
  assert.equal(c?.cuadrante, 'financia');
});

test('los datos de cuadrante_cambiado tienen la forma de su tipo: lo requerido está y nada sobra', async () => {
  const esquema = await unaFila<{ e: { required?: string[]; properties: Record<string, unknown> } }>(
    admin,
    `select esquema_de_datos as e from catalogo.tipos_de_evento where clave = 'cuadrante_cambiado' and version = 1`,
  );
  assert.ok(esquema);
  const todos = await filas<{ datos: Record<string, unknown> }>(
    admin,
    `select datos from negocio.eventos where org_id = $1 and tipo = 'cuadrante_cambiado'`,
    [org],
  );
  assert.ok(todos.length > 0, 'no hay eventos que comparar: la prueba pasaría en vacío');
  for (const { datos: d } of todos) {
    for (const r of esquema.e.required ?? []) assert.ok(r in d, `falta ${r} en los datos`);
    for (const k of Object.keys(d)) assert.ok(k in esquema.e.properties, `${k} no está en el esquema del tipo`);
  }
});
