// LAS RESPUESTAS Y LOS TOQUES: los campos del CRM y la atribución, con historia. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (la `106`: `negocio.registrar_respuestas_del_crm` y `negocio.registrar_toques_del_crm`)
//
// La sincronización PISA `contactos.campos_del_crm` y la atribución en cada pasada. Los disparadores guardan cada
// cambio, en la misma transacción, como el inquilino que escribe (bajo su RLS):
//
//   · respuestas: un alta deja una fila por campo con valor (sin pregunta, con el id del campo y la etapa del lead);
//     un cambio deja una fila por campo que cambió, nada por los que siguen igual; un campo que se vacía o desaparece
//     deja una fila vaciada sin valor — mutaciones: el disparador sin cuerpo, sin el `is distinct from`, sin el
//     `full join` (los que desaparecen);
//   · toques: un alta con atribución deja el primer y el último toque con sus campos separados, y el contacto apunta a
//     los dos; cambiar la última deja un toque nuevo y mueve sólo su puntero; reescribir la misma no deja nada —
//     mutaciones: el disparador sin cuerpo, sin el update del puntero, sin el `is distinct from`;
//   · un contacto de ANTES de la 106 (campos, atribución y etiquetas ya guardados, `historia_desde` nula): su primera
//     escritura guarda lo que ya tenía con la hora en que se vio (`sincronizado_el`), aunque traiga los mismos valores,
//     y después el cambio; la segunda no repite la foto — mutaciones: sin la foto de las respuestas, de los toques o
//     de las etiquetas, los disparadores sin `or old.historia_desde is null`, sin el disparador que fija
//     `historia_desde`, la foto con la hora de ahora;
//   · las etiquetas: cada una que aparece deja un etiqueta_agregada y cada una que se va un etiqueta_quitada; reordenar
//     no deja nada; los datos tienen la forma de su tipo — mutaciones: el disparador sin cuerpo, sin el de la alta;
//   · la pregunta estándar se resuelve AL LEER (negocio.respuestas_del_lead_traducidas): un mapeo «campo» cargado
//     después traduce las filas viejas, por fieldKey (con o sin «contact.») o por el id del campo; la de la fila gana,
//     después la cuenta y después el snapshot; un mapeo a «ignorar» la descarta y la trayectoria no la muestra —
//     mutaciones: sin el mapeo de la cuenta, el snapshot antes que la cuenta, sin «ignorar»;
//   · el contacto se borra con sus toques y sus respuestas (las claves en los dos sentidos no lo traban).
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';

const SLUG = 'respuestas-321';

let admin: Client;
let org: string;
let cuenta: string;

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  await admin.query(`delete from negocio.contactos where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Respuestas 321', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  cuenta = (await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]))!.id;
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

const enElCliente = <T>(trabajo: () => Promise<T>) => conOrganizacion(ambitoDeUnCliente(org, cuenta), trabajo);

async function alta(ghl: string, v: { campos?: Record<string, string>; primera?: Record<string, string>; ultima?: Record<string, string>; etapa?: string }) {
  return enElCliente(async () =>
    (
      await datos()
        .insertInto('contactos')
        .values({
          org_id: org,
          ghl_contact_id: ghl,
          nombre: `Contacto ${ghl}`,
          etapa_estandar: v.etapa ?? null,
          campos_del_crm: JSON.stringify(v.campos ?? {}),
          atribucion_primera: JSON.stringify(v.primera ?? {}),
          atribucion_ultima: JSON.stringify(v.ultima ?? {}),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id,
  );
}

const respuestas = (id: string) =>
  filas<{ origen_clave: string; valor_texto: string | null; vaciada: boolean; pregunta: string | null; etapa: string | null; proveedor: string; obtenida_por: string }>(
    admin,
    `select origen_clave, valor_texto, vaciada, pregunta, etapa, proveedor, obtenida_por from negocio.respuestas_del_lead
      where org_id = $1 and contacto_id = $2 order by registrada_el, origen_clave`,
    [org, id],
  );

test('un alta deja una respuesta por campo con valor, sin pregunta y con la etapa del lead', async () => {
  const id = await alta('r1', { campos: { cf_a: 'Clínica dental', cf_b: '12', cf_c: '  ' }, etapa: 'conversacion' });
  assert.deepEqual(await respuestas(id), [
    { origen_clave: 'cf_a', valor_texto: 'Clínica dental', vaciada: false, pregunta: null, etapa: 'conversacion', proveedor: 'ghl', obtenida_por: 'crm' },
    { origen_clave: 'cf_b', valor_texto: '12', vaciada: false, pregunta: null, etapa: 'conversacion', proveedor: 'ghl', obtenida_por: 'crm' },
  ]);
});

test('un cambio deja una fila por campo que cambió; los iguales nada; el que se vacía o desaparece, una vaciada', async () => {
  const id = await alta('r2', { campos: { cf_a: 'Uno', cf_b: 'Dos', cf_c: 'Tres' } });
  assert.equal((await respuestas(id)).length, 3);

  // cf_a cambia, cf_b sigue igual, cf_c se vacía y aparece cf_d.
  await enElCliente(() =>
    datos().updateTable('contactos').set({ campos_del_crm: JSON.stringify({ cf_a: 'Uno bis', cf_b: 'Dos', cf_c: '', cf_d: 'Cuatro' }) }).where('id', '=', id).execute(),
  );
  const despues = (await respuestas(id)).slice(3);
  assert.deepEqual(
    despues.map((r) => [r.origen_clave, r.valor_texto, r.vaciada]),
    [['cf_a', 'Uno bis', false], ['cf_c', null, true], ['cf_d', 'Cuatro', false]],
  );

  // El mismo objeto otra vez: nada. Y un campo que desaparece del objeto también se vacía.
  await enElCliente(() =>
    datos().updateTable('contactos').set({ campos_del_crm: JSON.stringify({ cf_a: 'Uno bis', cf_b: 'Dos', cf_c: '', cf_d: 'Cuatro' }) }).where('id', '=', id).execute(),
  );
  assert.equal((await respuestas(id)).length, 6, 'reescribir los mismos campos dejó respuestas');
  await enElCliente(() =>
    datos().updateTable('contactos').set({ campos_del_crm: JSON.stringify({ cf_a: 'Uno bis', cf_b: 'Dos', cf_c: '' }) }).where('id', '=', id).execute(),
  );
  const ultima = (await respuestas(id)).slice(6);
  assert.deepEqual(ultima.map((r) => [r.origen_clave, r.valor_texto, r.vaciada]), [['cf_d', null, true]]);
});

interface Toque {
  id: string;
  posicion: string;
  campana_id_externo: string | null;
  conjunto_id_externo: string | null;
  anuncio_id_externo: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  session_source: string | null;
  fbclid: string | null;
  url: string | null;
  ig_sid: string | null;
  proveedor: string;
}
const toques = (id: string) =>
  filas<Toque>(
    admin,
    `select id, posicion, campana_id_externo, conjunto_id_externo, anuncio_id_externo, utm_source, utm_campaign, utm_content,
            session_source, fbclid, url, ig_sid, proveedor
       from negocio.toques_de_marketing where org_id = $1 and contacto_id = $2 order by registrado_el, posicion`,
    [org, id],
  );
const punteros = async (id: string) =>
  (await unaFila<{ primero: string | null; ultimo: string | null }>(
    admin,
    `select primer_toque_de_marketing_id as primero, ultimo_toque_de_marketing_id as ultimo from negocio.contactos where id = $1`,
    [id],
  ))!;

test('un alta con atribución deja el primer y el último toque, con sus campos separados, y el contacto apunta a los dos', async () => {
  const id = await alta('t1', {
    primera: { campaignId: '120200', utmTerm: '120201', adId: '120202', utmSource: 'facebook', campaign: 'TOFU dolor', utmContent: 'ad 1', sessionSource: 'Paid Social', fbclid: 'IwAR', url: 'https://landing.example/?x=1' },
    ultima: { sessionSource: 'Instagram DM', medium: 'instagram', mediumId: '17841400' },
  });
  const t = await toques(id);
  assert.equal(t.length, 2, 'el alta no dejó sus dos toques');
  const primera = t.find((x) => x.posicion === 'primera')!;
  const ultima = t.find((x) => x.posicion === 'ultima')!;
  assert.deepEqual(
    {
      campana: primera.campana_id_externo, conjunto: primera.conjunto_id_externo, anuncio: primera.anuncio_id_externo,
      source: primera.utm_source, campaign: primera.utm_campaign, content: primera.utm_content,
      session: primera.session_source, fbclid: primera.fbclid, url: primera.url, ig: primera.ig_sid, proveedor: primera.proveedor,
    },
    {
      campana: '120200', conjunto: '120201', anuncio: '120202', source: 'facebook', campaign: 'TOFU dolor', content: 'ad 1',
      session: 'Paid Social', fbclid: 'IwAR', url: 'https://landing.example/?x=1', ig: null, proveedor: 'ghl',
    },
  );
  assert.equal(ultima.ig_sid, '17841400', 'el IGSID de una atribución de Instagram no quedó');
  assert.deepEqual(await punteros(id), { primero: primera.id, ultimo: ultima.id });

  const sin = await alta('t0', {});
  assert.deepEqual(await toques(sin), [], 'un alta sin atribución dejó toques');
  assert.deepEqual(await punteros(sin), { primero: null, ultimo: null });
});

test('cambiar la última atribución deja un toque nuevo y mueve sólo su puntero; reescribir la misma no deja nada', async () => {
  const id = await alta('t2', { primera: { adId: '9001' }, ultima: { adId: '9001' } });
  const antes = await punteros(id);
  await enElCliente(() =>
    datos()
      .updateTable('contactos')
      .set({ atribucion_primera: JSON.stringify({ adId: '9001' }), atribucion_ultima: JSON.stringify({ adId: '9002' }) })
      .where('id', '=', id)
      .execute(),
  );
  const t = await toques(id);
  assert.equal(t.length, 3, 'el cambio de la última no dejó un toque, o la primera igual dejó otro');
  const nuevo = t.find((x) => x.anuncio_id_externo === '9002')!;
  const despues = await punteros(id);
  assert.deepEqual(despues, { primero: antes.primero, ultimo: nuevo.id }, 'el puntero no siguió al toque nuevo');

  await enElCliente(() =>
    datos()
      .updateTable('contactos')
      .set({ atribucion_primera: JSON.stringify({ adId: '9001' }), atribucion_ultima: JSON.stringify({ adId: '9002' }) })
      .where('id', '=', id)
      .execute(),
  );
  assert.equal((await toques(id)).length, 3, 'reescribir la misma atribución dejó un toque');
});

test('el upsert de varias filas de la sincronización (insert … on conflict do update) deja sus toques y respuestas', async () => {
  // La forma en que escribe sincronizar.ts: un alta nueva y una existente que cambia, en la misma sentencia.
  const existente = await alta('u1', { campos: { cf_a: 'viejo' }, ultima: { adId: '1' } });
  const fila = (ghl: string, valor: string, anuncio: string) => ({
    org_id: org,
    ghl_contact_id: ghl,
    nombre: `Contacto ${ghl}`,
    campos_del_crm: JSON.stringify({ cf_a: valor }),
    atribucion_ultima: JSON.stringify({ adId: anuncio }),
  });
  await enElCliente(() =>
    datos()
      .insertInto('contactos')
      .values([fila('u1', 'nuevo', '2'), fila('u2', 'primero', '3')])
      .onConflict((oc) =>
        oc.columns(['org_id', 'ghl_contact_id']).doUpdateSet((eb) => ({
          campos_del_crm: eb.ref('excluded.campos_del_crm'),
          atribucion_ultima: eb.ref('excluded.atribucion_ultima'),
        })),
      )
      .execute(),
  );
  const nuevo = (await unaFila<{ id: string }>(admin, `select id from negocio.contactos where org_id = $1 and ghl_contact_id = 'u2'`, [org]))!.id;
  assert.deepEqual((await respuestas(existente)).map((r) => r.valor_texto), ['viejo', 'nuevo']);
  assert.deepEqual((await respuestas(nuevo)).map((r) => r.valor_texto), ['primero']);
  assert.deepEqual((await toques(existente)).map((t) => t.anuncio_id_externo), ['1', '2']);
  const ultimo = (await toques(existente)).find((t) => t.anuncio_id_externo === '2')!;
  assert.equal((await punteros(existente)).ultimo, ultimo.id, 'el upsert no movió el puntero del último toque');
  assert.equal((await toques(nuevo)).length, 1);
});

/**
 * Un contacto «de antes de la 106»: sus campos, su atribución y sus etiquetas ya estaban (039, 048), sin historia y con
 * `historia_desde` nula. Se inserta sin disparadores de usuario (session_replication_role), como en la 257.
 */
async function deAntes(ghl: string, v: { campos?: Record<string, string>; primera?: Record<string, string>; ultima?: Record<string, string>; etiquetas?: string[] }, vistoEl: Date) {
  await admin.query(`set session_replication_role = replica`);
  try {
    return (await unaFila<{ id: string }>(
      admin,
      `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, campos_del_crm, atribucion_primera, atribucion_ultima,
                                      etiquetas, alta_en_el_crm, sincronizado_el, historia_desde)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, null) returning id`,
      [org, cuenta, ghl, `Contacto ${ghl}`, JSON.stringify(v.campos ?? {}), JSON.stringify(v.primera ?? {}), JSON.stringify(v.ultima ?? {}), v.etiquetas ?? [], vistoEl],
    ))!.id;
  } finally {
    await admin.query(`set session_replication_role = origin`);
  }
}

/** La pasada de la sincronización: pisa los campos, la atribución y las etiquetas, como el inquilino. */
const sincronizar = (id: string, v: { campos: Record<string, string>; primera: Record<string, string>; ultima: Record<string, string>; etiquetas: string[] }) =>
  enElCliente(() =>
    datos()
      .updateTable('contactos')
      .set({
        campos_del_crm: JSON.stringify(v.campos),
        atribucion_primera: JSON.stringify(v.primera),
        atribucion_ultima: JSON.stringify(v.ultima),
        etiquetas: v.etiquetas,
      })
      .where('id', '=', id)
      .execute(),
  );

const historiaDe = async (id: string) => ({
  respuestas: await filas<{ campo: string; valor: string | null; el: Date }>(
    admin,
    `select origen_clave as campo, valor_texto as valor, observada_el as el from negocio.respuestas_del_lead
      where org_id = $1 and contacto_id = $2 order by observada_el, origen_clave`,
    [org, id],
  ),
  toques: await filas<{ posicion: string; anuncio: string | null; el: Date }>(
    admin,
    `select posicion, coalesce(anuncio_id_externo, campana_id_externo) as anuncio, ocurrio_el as el from negocio.toques_de_marketing
      where org_id = $1 and contacto_id = $2 order by ocurrio_el, posicion`,
    [org, id],
  ),
  etiquetas: await filas<{ tipo: string; etiqueta: string; foto: boolean | null; el: Date }>(
    admin,
    `select tipo, datos ->> 'etiqueta' as etiqueta, (datos ->> 'foto_inicial')::boolean as foto, ocurrio_el as el from negocio.eventos
      where org_id = $1 and contacto_id = $2 and tipo in ('etiqueta_agregada', 'etiqueta_quitada') order by ocurrio_el, tipo, datos ->> 'etiqueta'`,
    [org, id],
  ),
});

test('un contacto de antes de la 106: la primera pasada guarda lo que ya tenía, con la hora en que se vio, y la segunda nada', async () => {
  const visto = new Date(Date.now() - 2 * 86_400_000);
  const v = {
    campos: { cf_a: 'Valor viejo', cf_b: '10' },
    primera: { campaignId: '111', utmSource: 'facebook' },
    ultima: { adId: '222', utmSource: 'facebook' },
    etiquetas: ['asistio', 'dm_cta'],
  };
  const id = await deAntes('legado1', v, visto);
  assert.deepEqual(await historiaDe(id), { respuestas: [], toques: [], etiquetas: [] });

  // La primera pasada después de subir escribe LOS MISMOS valores.
  await sincronizar(id, v);
  const h = await historiaDe(id);
  assert.deepEqual(
    h.respuestas.map((r) => [r.campo, r.valor, r.el.getTime()]),
    [['cf_a', 'Valor viejo', visto.getTime()], ['cf_b', '10', visto.getTime()]],
    'la primera pasada no guardó los campos que el contacto ya tenía, o no con la hora en que se vieron',
  );
  assert.deepEqual(h.toques.map((t) => [t.posicion, t.anuncio]), [['primera', '111'], ['ultima', '222']], 'no quedaron sus dos toques');
  const p = await punteros(id);
  assert.ok(p.primero && p.ultimo, 'el contacto no apunta a sus toques de antes');
  assert.deepEqual(
    h.etiquetas.map((e) => [e.tipo, e.etiqueta, e.foto, e.el.getTime()]),
    [['etiqueta_agregada', 'asistio', true, visto.getTime()], ['etiqueta_agregada', 'dm_cta', true, visto.getTime()]],
    'no quedaron las etiquetas que ya tenía',
  );

  // La segunda pasada, igual: nada nuevo (la foto se toma una sola vez).
  await sincronizar(id, v);
  assert.deepEqual(await historiaDe(id), h, 'la segunda pasada volvió a tomar la foto inicial');

  // Y después el CRM cambia un campo: el valor viejo queda en la historia, antes del nuevo.
  await sincronizar(id, { ...v, campos: { cf_a: 'Valor nuevo', cf_b: '10' } });
  assert.deepEqual(
    (await historiaDe(id)).respuestas.filter((r) => r.campo === 'cf_a').map((r) => r.valor),
    ['Valor viejo', 'Valor nuevo'],
  );
});

test('un contacto de antes de la 106 cuya primera pasada ya trae cambios: primero lo que tenía, después lo nuevo', async () => {
  const visto = new Date(Date.now() - 86_400_000);
  const id = await deAntes('legado2', { campos: { cf_a: 'Uno' }, ultima: { adId: '1' }, etiquetas: ['a'] }, visto);
  await sincronizar(id, { campos: { cf_a: 'Dos' }, primera: {}, ultima: { adId: '2' }, etiquetas: ['b'] });
  const h = await historiaDe(id);
  assert.deepEqual(h.respuestas.map((r) => r.valor), ['Uno', 'Dos'], 'el valor que tenía antes de la 106 se perdió');
  assert.ok(h.respuestas[0]!.el < h.respuestas[1]!.el, 'la foto inicial no quedó antes del cambio');
  assert.deepEqual(h.toques.map((t) => t.anuncio), ['1', '2']);
  const ultimo = await unaFila<{ anuncio: string }>(
    admin,
    `select t.anuncio_id_externo as anuncio from negocio.contactos c join negocio.toques_de_marketing t on t.org_id = c.org_id and t.id = c.ultimo_toque_de_marketing_id where c.id = $1`,
    [id],
  );
  assert.equal(ultimo?.anuncio, '2', 'el puntero quedó en la atribución vieja');
  assert.deepEqual(h.etiquetas.map((e) => [e.tipo, e.etiqueta, e.foto]), [
    ['etiqueta_agregada', 'a', true],
    ['etiqueta_agregada', 'b', null],
    ['etiqueta_quitada', 'a', null],
  ]);
});

test('las etiquetas: cada una que aparece es un etiqueta_agregada y cada una que se va un etiqueta_quitada; repetir no deja nada', async () => {
  const id = await enElCliente(async () =>
    (
      await datos()
        .insertInto('contactos')
        .values({ org_id: org, ghl_contact_id: 'e1', nombre: 'Contacto e1', etiquetas: ['dm_cta', 'noshow', ' '] })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id,
  );
  const poner = (etiquetas: string[]) =>
    enElCliente(() => datos().updateTable('contactos').set({ etiquetas }).where('id', '=', id).execute());
  assert.deepEqual((await historiaDe(id)).etiquetas.map((e) => [e.tipo, e.etiqueta]), [
    ['etiqueta_agregada', 'dm_cta'],
    ['etiqueta_agregada', 'noshow'],
  ]);
  await poner(['noshow', 'asistio']);
  await poner(['asistio', 'noshow']);
  const h = (await historiaDe(id)).etiquetas;
  assert.deepEqual(h.slice(2).map((e) => [e.tipo, e.etiqueta]), [
    ['etiqueta_agregada', 'asistio'],
    ['etiqueta_quitada', 'dm_cta'],
  ], 'el cambio de etiquetas no quedó, o reordenarlas dejó eventos');

  // Los datos tienen la forma de su tipo.
  const esquemas = await filas<{ clave: string; e: { required?: string[]; properties: Record<string, unknown> } }>(
    admin,
    `select clave, esquema_de_datos as e from catalogo.tipos_de_evento where clave in ('etiqueta_agregada', 'etiqueta_quitada') and version = 1`,
  );
  const todos = await filas<{ tipo: string; datos: Record<string, unknown> }>(
    admin,
    `select tipo, datos from negocio.eventos where org_id = $1 and tipo in ('etiqueta_agregada', 'etiqueta_quitada')`,
    [org],
  );
  for (const { tipo, datos: d } of todos) {
    const e = esquemas.find((x) => x.clave === tipo)!.e;
    for (const r of e.required ?? []) assert.ok(r in d, `${tipo}: falta ${r}`);
    for (const k of Object.keys(d)) assert.ok(k in e.properties, `${tipo}: ${k} no está en el esquema`);
  }
});

test('la pregunta estándar se resuelve al leer: un mapeo cargado después traduce las filas viejas, la cuenta gana al snapshot e ignorar descarta', async () => {
  // Todo en una transacción del admin que se deshace: el snapshot, los mapeos y el catálogo de campos son de prueba.
  await admin.query('begin');
  try {
    await admin.query(
      `insert into negocio.carpetas_del_crm (org_id, cuenta_id, carpeta_id, nombre, grupo) values ($1, $2, 'cp321', 'Contact', 'calificacion')`,
      [org, cuenta],
    );
    await admin.query(
      `insert into negocio.campos_del_crm (org_id, cuenta_id, campo_id, nombre, carpeta_id, tipo, visto_el, clave) values
         ($1, $2, 'cf321neg', 'Tipo de negocio', 'cp321', 'TEXT', now(), 'contact.tipo_negocio'),
         ($1, $2, 'cf321fact', 'Facturación', 'cp321', 'TEXT', now(), 'contact.facturacion'),
         ($1, $2, 'cf321dec', 'Decisor', 'cp321', 'TEXT', now(), 'contact.decisor'),
         ($1, $2, 'cf321ruido', 'Ruido', 'cp321', 'TEXT', now(), 'contact.ruido')`,
      [org, cuenta],
    );
    // Las filas VIEJAS: el lead respondió antes de que existiera ningún mapeo.
    const id = (
      await unaFila<{ id: string }>(
        admin,
        `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, campos_del_crm)
         values ($1, $2, 'r321map', 'Contacto Mapeado', $3::jsonb) returning id`,
        [org, cuenta, JSON.stringify({ cf321neg: 'Clínica', cf321fact: '5000', cf321dec: 'Yo', cf321ruido: 'x', cf321sin: 'y' })],
      )
    )!.id;
    const leer = () =>
      filas<{ origen_clave: string; pregunta: string | null; pregunta_por: string | null; ignorada: boolean }>(
        admin,
        `select origen_clave, pregunta, pregunta_por, ignorada from negocio.respuestas_del_lead_traducidas
          where org_id = $1 and contacto_id = $2 order by origen_clave`,
        [org, id],
      );
    assert.deepEqual(
      (await leer()).map((r) => [r.origen_clave, r.pregunta, r.pregunta_por, r.ignorada]),
      [
        ['cf321dec', null, null, false],
        ['cf321fact', null, null, false],
        ['cf321neg', null, null, false],
        ['cf321ruido', null, null, false],
        ['cf321sin', null, null, false],
      ],
    );

    // Los mapeos llegan DESPUÉS. El snapshot del cliente, por fieldKey (con «contact.» o sin él); la cuenta corrige el
    // del decisor y descarta el ruido por el id del campo.
    const v = (
      await unaFila<{ id: string }>(
        admin,
        `insert into catalogo.snapshot_versiones (snapshot, version, publicada_el) values ('s0_core', 'v321', current_date) returning id`,
      )
    )!.id;
    await admin.query(`update identidad.cuentas set snapshot_version_id = $1 where id = $2`, [v, cuenta]);
    await admin.query(
      `insert into catalogo.mapeos_de_snapshot (snapshot_version_id, tipo, campo, valor_origen, destino_catalogo, destino_clave) values
         ($1, 'campo', '', 'contact.tipo_negocio', 'preguntas_estandar', 'tipo_de_negocio'),
         ($1, 'campo', '', 'facturacion', 'preguntas_estandar', 'facturacion_mensual'),
         ($1, 'campo', '', 'contact.decisor', 'preguntas_estandar', 'meta_a_6_meses'),
         ($1, 'campo', '', 'contact.ruido', 'preguntas_estandar', 'ejemplo_real')`,
      [v],
    );
    await admin.query(
      `insert into negocio.mapeos_de_cuenta (org_id, cuenta_id, tipo, campo, valor_origen, destino_catalogo, destino_clave) values
         ($1, $2, 'campo', '', 'contact.decisor', 'preguntas_estandar', 'quien_decide'),
         ($1, $2, 'campo', '', 'cf321ruido', 'ignorar', null)`,
      [org, cuenta],
    );
    // Una respuesta de quien YA sabe la pregunta (un formulario): la suya gana sobre cualquier mapeo.
    await admin.query(
      `insert into negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, pregunta, origen_clave, valor_texto, proveedor, obtenida_por, observada_el)
       values ($1, $2, $3, 'clientes_activos', 'contact.facturacion', '12', 'landing', 'formulario', now())`,
      [org, cuenta, id],
    );
    assert.deepEqual(
      (await leer()).map((r) => [r.origen_clave, r.pregunta, r.pregunta_por, r.ignorada]),
      [
        ['cf321dec', 'quien_decide', 'cuenta', false],
        ['cf321fact', 'facturacion_mensual', 'snapshot', false],
        ['cf321neg', 'tipo_de_negocio', 'snapshot', false],
        ['cf321ruido', null, null, true],
        ['cf321sin', null, null, false],
        ['contact.facturacion', 'clientes_activos', 'fila', false],
      ],
      'el mapeo no tradujo las filas viejas, o la precedencia no es fila > cuenta > snapshot',
    );

    // La trayectoria lee la vista: la pregunta como dato, y lo ignorado no sale.
    const t = (await unaFila<{ t: { respuestas: { dato: string; pregunta: string | null; valor: string }[] } }>(
      admin,
      `select negocio.trayectoria_del_lead($1) as t`,
      [id],
    ))!.t;
    assert.deepEqual(
      t.respuestas.map((r) => [r.dato, r.pregunta, r.valor]).sort(),
      [
        ['clientes_activos', 'clientes_activos', '12'],
        ['facturacion_mensual', 'facturacion_mensual', '5000'],
        ['quien_decide', 'quien_decide', 'Yo'],
        ['tipo_de_negocio', 'tipo_de_negocio', 'Clínica'],
      ],
    );
  } finally {
    await admin.query('rollback');
  }
});

test('el contacto se borra con sus toques y sus respuestas', async () => {
  const id = await alta('b1', { campos: { cf_a: 'x' }, primera: { adId: '1' }, ultima: { adId: '2' } });
  await enElCliente(() => datos().deleteFrom('contactos').where('id', '=', id).execute());
  const quedan = await unaFila<{ t: number; r: number }>(
    admin,
    `select (select count(*)::int from negocio.toques_de_marketing where contacto_id = $1) as t,
            (select count(*)::int from negocio.respuestas_del_lead where contacto_id = $1) as r`,
    [id],
  );
  assert.deepEqual(quedan, { t: 0, r: 0 });
});
