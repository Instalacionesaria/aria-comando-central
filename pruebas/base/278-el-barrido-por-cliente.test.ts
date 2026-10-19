// EL BARRIDO POR CLIENTE: CADA CLIENTE CON SUS CREDENCIALES, SU PRESUPUESTO Y SU SELLO. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Bloque C, Paso C4)
//
// Una empresa con tres clientes: P (el principal), Y (activo) y Z (en pausa). El cron corre las tareas de un cliente
// una vez por cliente activo, y las de la empresa una vez:
//
//   · los clientes que se barren son los activos, el principal primero — mutación: sacar `estado = 'activa'`;
//   · cada tarea de un cliente usa SUS credenciales y se sella con SU cuenta; las de la empresa, sin cuenta —
//     mutación: despachar con el acceso de la empresa (`empresa.acceso`) en vez del del cliente;
//   · el presupuesto se mira antes de CADA cliente: el que no entra se sella `sin_tiempo` con su cuenta, y la corrida
//     siguiente empieza por él — mutación: mirar el reloj una vez por empresa;
//   · sin la lista de clientes (el modo de antes), el principal, con su cuenta en el sello;
//   · la frescura de una tarea de un cliente es la suya; la de la empresa entera, la del PEOR cliente activo (uno que
//     falla gana); la del foco, la de su cliente — mutación: ordenar sin poner primero al que falla;
//   · el aviso y la ficha de un contacto son los del cliente del contacto — mutación: la ficha sin el cliente;
//   · el vacío de la agenda mira el PEOR pulso de los clientes — mutación: tomar el primero.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { barrerTodo, type EmpresaParaBarrer } from '../../lib/negocio/barrido.ts';
import { clientesParaBarrer } from '../../lib/administracion/cuentas.ts';
import { frescuraDe, frescuraDelAviso } from '../../lib/negocio/frescura.ts';
import { mensajesDeLaFicha } from '../../lib/negocio/ficha.ts';
import { agendaDelCloser } from '../../lib/negocio/agenda.ts';
import type { AccesoAlAnalizador, AccesoAlAuditor } from '../../lib/credenciales/resolver.ts';
import type { OrganizacionListada } from '../../lib/administracion/organizaciones.ts';

const SLUG = 'gamma-278';
const SIN_AUDITOR: AccesoAlAuditor = { tipo: 'falta', que: 'sin_llave_de_ia' };
const SIN_ANALIZADOR: AccesoAlAnalizador = { tipo: 'falta', que: 'sin_llave_de_tldv' };
// Las 12:00 de Lima: la hora no cambia nada de lo que se mide acá.
const DE_DIA = () => Date.parse('2026-10-05T17:00:00Z');

let admin: Client;
let org: string;
let p: string;
let y: string;
let z: string;

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['tareas_programadas', 'avisos_del_crm', 'mensajes', 'contactos', 'ingesta_pulso']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

function laOrg(): OrganizacionListada {
  return {
    id: org,
    slug: SLUG,
    nombre: 'Gamma 278',
    activa: true,
    esPrincipal: false,
    tieneCredencialDeCrm: true,
    precioMensual: null,
    usuarios: 0,
    zonaHoraria: 'America/Lima',
    creadaEl: new Date(),
  };
}

/** La empresa con P e Y, cada uno con una falta DISTINTA del CRM: así se ve de quién es la credencial usada. */
function conSusClientes(): EmpresaParaBarrer {
  return {
    org: laOrg(),
    // Las de la empresa: si alguna tarea de un cliente las usara, su motivo diría `token_revocado`.
    acceso: { tipo: 'falta', que: 'token_revocado' },
    auditor: SIN_AUDITOR,
    analizador: SIN_ANALIZADOR,
    clientes: [
      { cuenta: { id: p, esPorOmision: true }, acceso: { tipo: 'falta', que: 'token_vencido' }, auditor: SIN_AUDITOR },
      { cuenta: { id: y, esPorOmision: false }, acceso: { tipo: 'falta', que: 'sin_token' }, auditor: SIN_AUDITOR },
    ],
  };
}

async function sellos(): Promise<{ cuenta: string | null; tarea: string; estado: string; motivo: string | null }[]> {
  return filas(
    admin,
    `select t.cuenta_id as cuenta, t.tarea, t.ultimo_estado as estado, t.ultimo_motivo as motivo
       from negocio.tareas_programadas t left join identidad.cuentas c on c.id = t.cuenta_id
      where t.org_id = $1 order by t.tarea, t.cuenta_id is not null, c.es_por_omision desc`,
    [org],
  );
}

async function sellar(cuenta: string | null, tarea: string, estado: string, haceMinutos: number): Promise<void> {
  await admin.query(
    `insert into negocio.tareas_programadas (org_id, cuenta_id, tarea, ultima_corrida_el, ultimo_estado)
     values ($1, $2, $3, now() - make_interval(mins => $4), $5)
     on conflict (org_id, cuenta_id, tarea) do update
       set ultima_corrida_el = excluded.ultima_corrida_el, ultimo_estado = excluded.ultimo_estado`,
    [org, cuenta, tarea, haceMinutos, estado],
  );
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 278', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  assert.ok(principal);
  p = principal.id;
  const segunda = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Segunda 278', 'segunda-278') returning id`,
    [org],
  );
  const pausada = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, estado) values ($1, 'Pausada 278', 'pausada-278', 'pausada') returning id`,
    [org],
  );
  assert.ok(segunda && pausada);
  y = segunda.id;
  z = pausada.id;
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('se barren los clientes activos, el principal primero', async () => {
  const clientes = await conIdentidad((db) => clientesParaBarrer(db, org));
  assert.deepEqual(clientes, [
    { id: p, esPorOmision: true },
    { id: y, esPorOmision: false },
  ]);
  assert.ok(!clientes.some((c) => c.id === z), 'se barre un cliente en pausa');
});

test('cada tarea de un cliente usa SUS credenciales y se sella con SU cuenta; la de la empresa, sin cuenta', async () => {
  const r = await barrerTodo('*/10 * * * *', [conSusClientes()], DE_DIA);
  assert.deepEqual(
    r.renglones.map((x) => `${x.cuentaId === p ? 'P' : x.cuentaId === y ? 'Y' : '?'}:${x.tarea}:${x.estado}:${x.porque}`),
    [
      'P:contactos:saltada:token_vencido',
      'P:mensajes:saltada:token_vencido',
      `P:auditoria:saltada:${r.renglones[2]!.porque}`,
      'Y:contactos:saltada:sin_token',
      'Y:mensajes:saltada:sin_token',
      `Y:auditoria:saltada:${r.renglones[5]!.porque}`,
    ],
    'una tarea de un cliente se despachó con credenciales que no son las suyas',
  );
  assert.match(String(r.renglones[2]!.porque), /llave de IA/);

  // Las de la empresa: una vez, sin cuenta.
  await barrerTodo('41 * * * *', [conSusClientes()], DE_DIA);
  const s = await sellos();
  const quien = (c: string | null) => (c === p ? 'P' : c === y ? 'Y' : c === null ? '-' : '?');
  assert.deepEqual(
    s.map((x) => `${quien(x.cuenta)}:${x.tarea}`),
    ['-:analizadores', 'P:auditoria', 'Y:auditoria', 'P:contactos', 'Y:contactos', 'P:mensajes', 'Y:mensajes'],
    'un sello quedó sin su cliente, o una tarea de la empresa se selló por cliente',
  );
  assert.deepEqual(
    s.filter((x) => x.tarea !== 'analizadores' && x.tarea !== 'auditoria').map((x) => `${quien(x.cuenta)}:${x.motivo}`),
    ['P:token_vencido', 'Y:sin_token', 'P:token_vencido', 'Y:sin_token'],
  );
});

test('el presupuesto se mira antes de CADA cliente, y el que se quedó sin tiempo va primero la vez siguiente', async () => {
  await admin.query(`delete from negocio.tareas_programadas where org_id = $1`, [org]);
  // El reloj: la corrida arranca, P entra, y para Y ya pasaron más de los 180 s del presupuesto.
  const T0 = DE_DIA();
  let llamadas = 0;
  const reloj = () => (++llamadas <= 2 ? T0 : T0 + 181_000);
  const r = await barrerTodo('*/10 * * * *', [conSusClientes()], reloj);
  assert.deepEqual(
    r.renglones.map((x) => `${x.cuentaId === p ? 'P' : 'Y'}:${x.estado}`),
    ['P:saltada', 'P:saltada', 'P:saltada', 'Y:sin_tiempo', 'Y:sin_tiempo', 'Y:sin_tiempo'],
    'el presupuesto se miró una vez por empresa: el segundo cliente corrió sin tiempo',
  );
  const deY = (await sellos()).filter((s) => s.cuenta === y);
  assert.deepEqual([...new Set(deY.map((s) => s.estado))], ['sin_tiempo']);

  const otra = await barrerTodo('*/10 * * * *', [conSusClientes()], DE_DIA);
  assert.equal(otra.renglones[0]!.cuentaId, y, 'el cliente que se quedó sin tiempo no fue primero');
});

test('sin la lista de clientes, el principal, con su cuenta en el sello', async () => {
  await admin.query(`delete from negocio.tareas_programadas where org_id = $1`, [org]);
  const r = await barrerTodo(
    '*/10 * * * *',
    [{ org: laOrg(), acceso: { tipo: 'falta', que: 'sin_token' }, auditor: SIN_AUDITOR, analizador: SIN_ANALIZADOR }],
    DE_DIA,
  );
  assert.deepEqual([...new Set(r.renglones.map((x) => x.cuentaId))], [p]);
  assert.deepEqual([...new Set((await sellos()).map((s) => s.cuenta))], [p]);
});

test('la frescura: la de un cliente es la suya; la de la empresa, la del peor activo; la del foco, la de su cliente', async () => {
  await admin.query(`delete from negocio.tareas_programadas where org_id = $1`, [org]);
  // Y falla y es el MÁS NUEVO: el peor no es el más viejo, es el que falla.
  await sellar(p, 'mensajes', 'corrio', 2);
  await sellar(y, 'mensajes', 'fallo', 1);
  const toda = await conOrganizacion(org, () => frescuraDe('mensajes'));
  assert.equal(toda.estado, 'fallando', 'la empresa entera dijo «al día» con un cliente que falla');
  assert.equal((await conOrganizacion(org, () => frescuraDe('mensajes', p))).estado, 'al_dia');
  assert.equal((await conOrganizacion(org, () => frescuraDe('mensajes', y))).estado, 'fallando');
  const foco = { orgId: org, todaLaOrganizacion: true, cuentas: [p] } as const;
  assert.equal((await conOrganizacion(foco, () => frescuraDe('mensajes'))).estado, 'al_dia', 'el foco en P vio el fallo de Y');
  // Un cliente sin sello propio: nunca corrió. Y uno en pausa no cuenta para la empresa.
  assert.equal((await conOrganizacion(org, () => frescuraDe('citas', y))).estado, 'nunca');
  await admin.query(`update identidad.cuentas set estado = 'pausada' where id = $1`, [y]);
  try {
    assert.equal((await conOrganizacion(org, () => frescuraDe('mensajes'))).estado, 'al_dia', 'un cliente en pausa decidió la frescura');
  } finally {
    await admin.query(`update identidad.cuentas set estado = 'activa' where id = $1`, [y]);
  }
  // Sin sellos de clientes —los de antes del nivel 3—, el sin cuenta; y es también el del principal.
  await sellar(null, 'citas', 'fallo', 5);
  assert.equal((await conOrganizacion(org, () => frescuraDe('citas'))).estado, 'fallando');
  assert.equal((await conOrganizacion(org, () => frescuraDe('citas', p))).estado, 'fallando');
  assert.equal((await conOrganizacion(org, () => frescuraDe('citas', y))).estado, 'nunca');
});

test('la ficha y el aviso de un contacto son los de su cliente', async () => {
  // Los sellos de arriba siguen: P al día, Y falla.
  const contacto = async (cuenta: string, ghl: string) =>
    (
      await unaFila<{ id: string }>(
        admin,
        `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm)
         values ($1, $2, $3, 'Contacto 278', 'closer', now()) returning id`,
        [org, cuenta, ghl],
      )
    )!.id;
  const deP = await contacto(p, 'c278-p');
  const deY = await contacto(y, 'c278-y');
  assert.equal((await conOrganizacion(org, () => mensajesDeLaFicha(deP))).frescura.estado, 'al_dia', 'la ficha de P tomó el fallo de Y');
  assert.equal((await conOrganizacion(org, () => mensajesDeLaFicha(deY))).frescura.estado, 'fallando');

  // El aviso: P procesó uno hace un rato; a Y le llegan y no se procesan.
  await admin.query(
    `insert into negocio.avisos_del_crm (org_id, cuenta_id, huella, evento, cuerpo, bytes, atribucion, recibido_el, procesado_el, error)
     values ($1, $2, 'h278p', 'mensaje.entrante', '{}', 2, 'coincide', now(), now(), null),
            ($1, $3, 'h278y', 'mensaje.entrante', '{}', 2, 'coincide', now(), null, 'evento desconocido')`,
    [org, p, y],
  );
  assert.equal((await conOrganizacion(org, () => frescuraDelAviso(p))).estado, 'al_dia');
  assert.equal((await conOrganizacion(org, () => frescuraDelAviso(y))).estado, 'llega_sin_procesar');
  assert.equal((await conOrganizacion(org, () => mensajesDeLaFicha(deP))).aviso.estado, 'al_dia', 'la ficha de P vio el aviso de Y');
  assert.equal((await conOrganizacion(org, () => mensajesDeLaFicha(deY))).aviso.estado, 'llega_sin_procesar');
});

test('el vacío de la agenda mira el peor pulso de los clientes', async () => {
  // P leyó el calendario entero; Y quedó a medias. La agenda de la empresa entera no tiene citas, y su motivo es el
  // de Y: con el de P diría que el cero está medido.
  await admin.query(
    `insert into negocio.ingesta_pulso (org_id, cuenta_id, clave, ultima_corrida_el, atrasado)
     values ($1, $2, 'citas', now(), false), ($1, $3, 'citas', now(), true)`,
    [org, p, y],
  );
  const a = await conOrganizacion(org, () => agendaDelCloser('closer', 'America/Lima', { dias: 3 }));
  assert.equal(a.dias.length, 0);
  assert.match(String(a.falta), /quedó incompleto/, 'la agenda tomó el pulso de un cliente al día y escondió al otro');
  // Con el foco en P, el de P: no hay nada que aclarar del barrido.
  const foco = { orgId: org, todaLaOrganizacion: true, cuentas: [p] } as const;
  const deP = await conOrganizacion(foco, () => agendaDelCloser('closer', 'America/Lima', { dias: 3 }));
  assert.doesNotMatch(String(deP.falta), /quedó incompleto/);
});
