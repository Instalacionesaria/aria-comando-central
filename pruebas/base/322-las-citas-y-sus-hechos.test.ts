// LAS CITAS Y SUS HECHOS: el cuadrante al agendar y los eventos de la cita, con disparadores. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (la `106`: `negocio.fijar_cuadrante_al_agendar` y `negocio.registrar_hechos_de_la_cita`)
//
//   · al insertar una cita se fijan cuadrante_al_agendar (el vigente del lead) y calificada; volver a sincronizarla
//     (el upsert de citas.ts) después de que el lead cambió de cuadrante NO lo cambia — mutaciones: el disparador sin
//     cuerpo, o calificada para cualquier cuadrante;
//   · un alta deja UN cita_agendada (el upsert repetido no deja otro) — mutación: sin el disparador del alta;
//   · TODO cambio del estado del CRM deja un cita_estado_cambiado con el anterior (también new → confirmed), y el
//     repetido no deja otro; cancelled deja además cita_cancelada, noshow no_show y showed asistio (actor sistema,
//     fuente ghl); los ids llevan la hora — mutaciones: sin el `when … is distinct from`, sin el cita_estado_cambiado,
//     showed sin su asistio;
//   · un cambio de hora deja cita_reagendada {para_el, antes_para_el}; la misma hora otra vez no — mutación: sin el
//     disparador de la hora;
//   · el tipo de cita es una clave de catalogo.tipos_de_cita (uno desconocido da 23503, uno nuevo es un INSERT); sólo
//     la de venta, o la de tipo nulo, es calificada; el cita_agendada lleva el tipo y el calendario — mutaciones:
//     calificada sin mirar el tipo, el alta sin el tipo;
//   · un tipo que llega DESPUÉS (su calendario se mapeó tarde) rehace calificada con el cuadrante al agendar: nula si no
//     es de venta, la de ese cuadrante si lo es; un update que no toca el tipo no la rehace — mutación: sin el
//     disparador del cambio de tipo;
//   · una cita que se ve por primera vez ya cancelada, en no-show o atendida deja también ese hecho (id `…:alta`), una
//     sola vez — mutación: el alta sin el hecho del estado;
//   · marcar la asistencia deja asistio, de una persona y desde Comando Central; marcarla otra vez no — mutación: sin
//     el `when new.asistio is true and old.asistio is not true`;
//   · ninguno de estos hechos mueve la etapa del lead (la mueve GoHighLevel);
//   · los datos de cada evento tienen la forma de su tipo.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';

const SLUG = 'citas-322';

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
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Citas 322', $1, 'America/Lima') returning id`,
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

async function contacto(ghl: string, cuadrante: string | null): Promise<string> {
  return (
    await unaFila<{ id: string }>(
      admin,
      `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, cuadrante) values ($1, $2, $3, 'Contacto 322', $4) returning id`,
      [org, cuenta, ghl, cuadrante],
    )
  )!.id;
}

/** La hora de cada cita: fija, como la devuelve el CRM mientras nadie la mueva. */
const MANANA = new Date(Date.now() + 86_400_000);

/** El upsert de lib/negocio/citas.ts: el estado y la hora se pisan; cuadrante_al_agendar, calificada y asistio, no. */
async function sincronizarCita(
  contactoId: string,
  ghl: string,
  estado: string,
  reservadaEl: Date | null = null,
  v: { inicio?: Date; tipo?: string | null; calendario?: string } = {},
): Promise<void> {
  await enElCliente(() =>
    datos()
      .insertInto('citas')
      .values({
        ghl_evento_id: ghl,
        contacto_id: contactoId,
        inicio_el: v.inicio ?? MANANA,
        estado_ghl: estado,
        reservada_el: reservadaEl,
        tipo: v.tipo ?? null,
        ghl_calendario_id: v.calendario ?? null,
      } as never)
      .onConflict((oc) =>
        oc.columns(['org_id', 'ghl_evento_id']).doUpdateSet((eb) => ({ estado_ghl: eb.ref('excluded.estado_ghl'), inicio_el: eb.ref('excluded.inicio_el') }) as never),
      )
      .execute(),
  );
}

const cita = (ghl: string) =>
  unaFila<{ id: string; cuadrante_al_agendar: string | null; calificada: boolean | null }>(
    admin,
    `select id, cuadrante_al_agendar, calificada from negocio.citas where org_id = $1 and ghl_evento_id = $2`,
    [org, ghl],
  );

const hechos = (contactoId: string) =>
  filas<{ tipo: string; actor_tipo: string; fuente: string; id_externo: string; datos: Record<string, unknown> }>(
    admin,
    `select tipo, actor_tipo, fuente, id_externo, datos from negocio.eventos
      where org_id = $1 and contacto_id = $2 and tipo <> 'cuadrante_cambiado' order by registrado_el, tipo`,
    [org, contactoId],
  );

test('al insertar se fijan el cuadrante al agendar y calificada, y volver a sincronizarla no los cambia', async () => {
  const valida = await contacto('c1', 'valida');
  await sincronizarCita(valida, 'cita-322-1', 'confirmed');
  assert.deepEqual({ ...(await cita('cita-322-1')), id: undefined }, { id: undefined, cuadrante_al_agendar: 'valida', calificada: true });

  // El lead pasa a Descarta después de agendar, y el barrido vuelve a leer la cita: el cuadrante AL AGENDAR queda.
  await admin.query(`update negocio.contactos set cuadrante = 'descarta' where id = $1`, [valida]);
  await sincronizarCita(valida, 'cita-322-1', 'confirmed');
  assert.deepEqual({ ...(await cita('cita-322-1')), id: undefined }, { id: undefined, cuadrante_al_agendar: 'valida', calificada: true });

  const descarta = await contacto('c2', 'descarta');
  await sincronizarCita(descarta, 'cita-322-2', 'confirmed');
  assert.equal((await cita('cita-322-2'))?.calificada, false, 'una cita de Descarta quedó calificada');
  const sin = await contacto('c3', null);
  await sincronizarCita(sin, 'cita-322-3', 'confirmed');
  assert.deepEqual({ ...(await cita('cita-322-3')), id: undefined }, { id: undefined, cuadrante_al_agendar: null, calificada: null });
});

test('un alta deja un cita_agendada, y el upsert repetido no deja otro', async () => {
  const id = await contacto('c4', 'prioriza');
  const reservada = new Date(Date.now() - 3_600_000);
  await sincronizarCita(id, 'cita-322-4', 'confirmed', reservada);
  await sincronizarCita(id, 'cita-322-4', 'confirmed', reservada);
  const h = await hechos(id);
  assert.deepEqual(h.map((x) => [x.tipo, x.actor_tipo, x.fuente, x.id_externo]), [['cita_agendada', 'sistema', 'ghl', 'cita:cita-322-4']]);
  assert.equal(h[0]!.datos.cita_id, (await cita('cita-322-4'))!.id);
  const ocurrio = await unaFila<{ ok: boolean }>(
    admin,
    `select abs(extract(epoch from ocurrio_el - $2::timestamptz)) < 1 as ok from negocio.eventos where org_id = $1 and id_externo = 'cita:cita-322-4'`,
    [org, reservada],
  );
  assert.equal(ocurrio?.ok, true, 'cita_agendada no ocurrió cuando se reservó');
});

test('el estado del CRM: todo cambio deja cita_estado_cambiado; cancelled, noshow y showed dejan además su hecho', async () => {
  const id = await contacto('c5', 'financia');
  await sincronizarCita(id, 'cita-322-5', 'new');
  await sincronizarCita(id, 'cita-322-5', 'confirmed');
  await sincronizarCita(id, 'cita-322-5', 'showed');
  await sincronizarCita(id, 'cita-322-5', 'noshow');
  await sincronizarCita(id, 'cita-322-5', 'noshow');
  await sincronizarCita(id, 'cita-322-5', 'cancelled');
  const h = await hechos(id);
  // Cada cambio, en orden, con el estado de antes: también new → confirmed, que no es ningún hecho del flujo.
  assert.deepEqual(
    h.filter((x) => x.tipo === 'cita_estado_cambiado').map((x) => [x.datos.estado_anterior, x.datos.estado]),
    [['new', 'confirmed'], ['confirmed', 'showed'], ['showed', 'noshow'], ['noshow', 'cancelled']],
    'un cambio de estado no quedó, o el repetido dejó otro',
  );
  assert.deepEqual(
    h.filter((x) => x.tipo !== 'cita_estado_cambiado').map((x) => [x.tipo, x.actor_tipo, x.fuente, x.datos.estado ?? null]),
    [
      ['cita_agendada', 'sistema', 'ghl', null],
      ['asistio', 'sistema', 'ghl', 'showed'],
      ['no_show', 'sistema', 'ghl', 'noshow'],
      ['cita_cancelada', 'sistema', 'ghl', 'cancelled'],
    ],
  );
  const noShow = h.find((x) => x.tipo === 'no_show')!;
  assert.deepEqual([noShow.datos.estado, noShow.datos.estado_anterior], ['noshow', 'showed']);
  // Los ids externos llevan la hora: deterministas, y uno por hecho.
  for (const x of h.filter((y) => y.tipo !== 'cita_agendada')) {
    assert.match(x.id_externo, /^cita:cita-322-5:(estado|asistio|no_show|cita_cancelada):\d{20}$/);
  }
});

test('una cita que cambia de hora deja cita_reagendada con la de antes; la misma hora otra vez no deja nada', async () => {
  const id = await contacto('c9', 'valida');
  const antes = new Date(Date.UTC(2026, 10, 3, 15));
  const despues = new Date(Date.UTC(2026, 10, 5, 18));
  await sincronizarCita(id, 'cita-322-9', 'confirmed', null, { inicio: antes });
  await sincronizarCita(id, 'cita-322-9', 'confirmed', null, { inicio: antes });
  await sincronizarCita(id, 'cita-322-9', 'confirmed', null, { inicio: despues });
  await sincronizarCita(id, 'cita-322-9', 'confirmed', null, { inicio: despues });
  const h = (await hechos(id)).filter((x) => x.tipo === 'cita_reagendada');
  assert.equal(h.length, 1, 'el cambio de hora no quedó, o la misma hora dejó otro');
  assert.deepEqual(
    [new Date(h[0]!.datos.antes_para_el as string).toISOString(), new Date(h[0]!.datos.para_el as string).toISOString()],
    [antes.toISOString(), despues.toISOString()],
  );
  assert.match(h[0]!.id_externo, /^cita:cita-322-9:cita_reagendada:\d{20}$/);
});

test('el tipo de cita: sólo la de venta (o la de tipo desconocido) es calificada; el tipo es una clave del catálogo', async () => {
  const id = await contacto('c10', 'prioriza');
  await sincronizarCita(id, 'cita-322-10', 'confirmed', null, { tipo: 'onboarding', calendario: 'cal-onb' });
  await sincronizarCita(id, 'cita-322-11', 'confirmed', null, { tipo: 'venta', calendario: 'cal-venta' });
  assert.deepEqual({ ...(await cita('cita-322-10')), id: undefined }, { id: undefined, cuadrante_al_agendar: 'prioriza', calificada: null });
  assert.equal((await cita('cita-322-11'))?.calificada, true);
  // El cita_agendada lleva el tipo y el calendario: «Agendan» puede contar sólo las de venta.
  const agendadas = (await hechos(id)).filter((x) => x.tipo === 'cita_agendada').map((x) => [x.datos.tipo, x.datos.ghl_calendario_id]);
  assert.deepEqual(agendadas.sort(), [['onboarding', 'cal-onb'], ['venta', 'cal-venta']]);

  // Un tipo que no está en el catálogo no entra (23503); uno nuevo es un INSERT en catalogo.tipos_de_cita.
  await admin.query('begin');
  try {
    await admin.query('savepoint s');
    await assert.rejects(
      admin.query(`update negocio.citas set tipo = 'upsell_322' where org_id = $1 and ghl_evento_id = 'cita-322-10'`, [org]),
      (e: { code?: string }) => e.code === '23503',
      'entró un tipo de cita que no está en el catálogo',
    );
    await admin.query('rollback to savepoint s');
    await admin.query(`insert into catalogo.tipos_de_cita (clave, nombre, descripcion, es_de_venta) values ('upsell_322', 'Upsell', 'Prueba 322.', true)`);
    await admin.query(`update negocio.citas set tipo = 'upsell_322' where org_id = $1 and ghl_evento_id = 'cita-322-10'`, [org]);
  } finally {
    await admin.query('rollback');
  }
});

test('el tipo que llega después rehace calificada con el cuadrante AL AGENDAR: onboarding la anula, venta la vuelve a dar', async () => {
  const id = await contacto('c30', 'prioriza');
  await sincronizarCita(id, 'cita-322-30', 'confirmed');
  assert.equal((await cita('cita-322-30'))?.calificada, true, 'con el tipo nulo, la de un Prioriza es calificada');
  // El lead pasa a Descarta: lo que vale es el cuadrante al agendar, no el de hoy.
  await admin.query(`update negocio.contactos set cuadrante = 'descarta' where id = $1`, [id]);
  const tipo = (t: string | null) =>
    admin.query(`update negocio.citas set tipo = $2 where org_id = $1 and ghl_evento_id = 'cita-322-30'`, [org, t]);
  await tipo('onboarding');
  assert.deepEqual(
    { ...(await cita('cita-322-30')), id: undefined },
    { id: undefined, cuadrante_al_agendar: 'prioriza', calificada: null },
    'una cita que resultó de onboarding siguió calificada: tipo y calificada se contradicen',
  );
  await tipo('venta');
  assert.equal((await cita('cita-322-30'))?.calificada, true, 'al volver a venta no se rehízo con el cuadrante al agendar');
  // Un update que no toca el tipo no la rehace (la sincronización pisa el estado y la hora).
  await admin.query(`update negocio.citas set calificada = false where org_id = $1 and ghl_evento_id = 'cita-322-30'`, [org]);
  await sincronizarCita(id, 'cita-322-30', 'cancelled');
  assert.equal((await cita('cita-322-30'))?.calificada, false);
});

test('una cita que se ve por primera vez ya cancelada o en no-show deja también ese hecho, y el upsert repetido no otro', async () => {
  const id = await contacto('c7', 'valida');
  await sincronizarCita(id, 'cita-322-7', 'cancelled');
  await sincronizarCita(id, 'cita-322-7', 'cancelled');
  await sincronizarCita(id, 'cita-322-8', 'noshow');
  await sincronizarCita(id, 'cita-322-12', 'showed');
  const h = await hechos(id);
  assert.deepEqual(
    h.map((x) => [x.tipo, x.id_externo]).sort(),
    [
      ['asistio', 'cita:cita-322-12:asistio:alta'],
      ['cita_agendada', 'cita:cita-322-12'],
      ['cita_agendada', 'cita:cita-322-7'],
      ['cita_agendada', 'cita:cita-322-8'],
      ['cita_cancelada', 'cita:cita-322-7:cita_cancelada:alta'],
      ['no_show', 'cita:cita-322-8:no_show:alta'],
    ],
    'una cita que llegó cancelada, en no-show o atendida dejó sólo su cita_agendada',
  );
  const cancelada = h.find((x) => x.tipo === 'cita_cancelada')!;
  assert.deepEqual([cancelada.datos.estado, cancelada.datos.estado_anterior], ['cancelled', null]);
});

test('marcar la asistencia deja asistio, de una persona y desde Comando Central; marcarla otra vez no', async () => {
  const id = await contacto('c6', 'prioriza');
  await sincronizarCita(id, 'cita-322-6', 'confirmed');
  const c = (await cita('cita-322-6'))!;
  for (let i = 0; i < 2; i += 1) {
    await enElCliente(() => datos().updateTable('citas').set({ asistio: true }).where('id', '=', c.id).execute());
  }
  const h = await hechos(id);
  assert.deepEqual(h.map((x) => [x.tipo, x.actor_tipo, x.fuente]), [['cita_agendada', 'sistema', 'ghl'], ['asistio', 'persona', 'comando_central']]);

  // Ninguno de los hechos de la cita mueve la etapa: la mueve GoHighLevel.
  const etapa = await unaFila<{ etapa_estandar: string | null }>(admin, `select etapa_estandar from negocio.contactos where id = $1`, [id]);
  assert.equal(etapa?.etapa_estandar, null);
});

test('los datos de cada evento de la cita tienen la forma de su tipo', async () => {
  const todos = await filas<{ tipo: string; datos: Record<string, unknown>; e: { required?: string[]; properties: Record<string, unknown> } }>(
    admin,
    `select ev.tipo, ev.datos, t.esquema_de_datos as e from negocio.eventos ev
       join catalogo.tipos_de_evento t on t.clave = ev.tipo and t.version = ev.tipo_version
      where ev.org_id = $1 and ev.tipo like any (array['cita_%', 'no_show', 'asistio'])`,
    [org],
  );
  assert.deepEqual(
    [...new Set(todos.map((x) => x.tipo))].sort(),
    ['asistio', 'cita_agendada', 'cita_cancelada', 'cita_estado_cambiado', 'cita_reagendada', 'no_show'],
  );
  for (const { tipo, datos: d, e } of todos) {
    for (const r of e.required ?? []) assert.ok(r in d, `${tipo}: falta ${r}`);
    for (const k of Object.keys(d)) assert.ok(k in e.properties, `${tipo}: ${k} no está en el esquema`);
  }
});
