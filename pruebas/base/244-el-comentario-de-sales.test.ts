// EL COMENTARIO DE LA CABECERA EN SALES: LAS CITAS SIN REGISTRAR DE QUIEN MIRA, Y LAS LLAMADAS. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/cabecera.ts` en Sales (2026-10-07, después del cierre de los agentes; `docs/OTROS/agentes/04-LA-
// REUNION-Y-LA-CABECERA.md`, AG-77):
//
//   · las citas sin registrar son las que Avanzar ofrece cerrar —ya ocurrieron, no canceladas, con calendario,
//     de los últimos 14 días— y nadie respondió; con alcance propio, sólo las de los contactos del closer;
//   · el GET de Mi Día las trae como comentario, con la lectura del calendario al día; sin ella, lo que falta;
//   · el GET de la lista de Llamadas trae la regla de la Reunión de hoy de su sección.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { leerRespuesta, limpiar, montar, pedirComo, sesionDe, unaCita, unContacto, type Escenario } from '../apoyo/closer.ts';
import { hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { citasSinRegistrar, textoDeCitasSinRegistrar } from '../../lib/agentes/cabecera.ts';
import { GET as miDia } from '../../app/api/closer/mi-dia/route.ts';
import { GET as llamadas } from '../../app/api/analizadores/llamadas/route.ts';

let esc: Escenario;
const CRM_A = `crm-244-a-${randomUUID().slice(0, 8)}`;
const CRM_B = `crm-244-b-${randomUUID().slice(0, 8)}`;
/** Los sellos de las tareas como estaban antes: se devuelven al terminar. */
let sellos: { tarea: string; ultima_corrida_el: Date; ultimo_estado: string }[] = [];
const NOMBRE_DEL_CLOSER = 'Closer de la 244';
const sesionesPropias: string[] = [];

before(async () => {
  esc = await montar('Cabecera244');
  sellos = (
    await esc.admin.query<{ tarea: string; ultima_corrida_el: Date; ultimo_estado: string }>(
      `select tarea, ultima_corrida_el, ultimo_estado from negocio.tareas_programadas where org_id = $1 and tarea in ('citas', 'analizadores')`,
      [esc.org],
    )
  ).rows;
});
after(async () => {
  await esc.admin.query(`delete from negocio.tareas_programadas where org_id = $1 and tarea in ('citas', 'analizadores')`, [esc.org]);
  for (const s of sellos) {
    await esc.admin.query('insert into negocio.tareas_programadas (org_id, tarea, ultima_corrida_el, ultimo_estado) values ($1, $2, $3, $4)', [esc.org, s.tarea, s.ultima_corrida_el, s.ultimo_estado]);
  }
  await esc.admin.query('delete from negocio.reuniones_del_dia where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.closer_asignado where org_id = $1 and crm_usuario_id = $2', [esc.org, CRM_A]);
  for (const t of sesionesPropias) await esc.admin.query('delete from identidad.sesiones where token_hash = $1', [hashDeToken(t)]);
  await esc.admin.query('delete from identidad.usuarios where nombre = $1', [NOMBRE_DEL_CLOSER]);
  await limpiar(esc);
  await cerrarTodo();
  await cerrarClientes();
});

const DIA = 24 * 3600 * 1000;
const hace = (dias: number) => new Date(Date.now() - dias * DIA);

/** Una cita con calendario, como las que llegan del CRM; `asistio` y el estado, si se piden. */
async function cita(contactoId: string, inicioEl: Date, o: { asistio?: boolean; estado?: string; sinCalendario?: boolean } = {}): Promise<void> {
  const id = await unaCita(esc, contactoId, { inicioEl, estado: o.estado ?? 'booked' });
  await esc.admin.query('update negocio.citas set ghl_calendario_id = $2, asistio = $3 where id = $1', [id, o.sinCalendario ? null : 'cal-244', o.asistio ?? null]);
}

async function sellar(tarea: 'citas' | 'analizadores'): Promise<void> {
  await esc.admin.query(
    `insert into negocio.tareas_programadas (org_id, tarea, ultima_corrida_el, ultimo_estado) values ($1, $2, now(), 'corrio')
     on conflict (org_id, tarea) do update set ultima_corrida_el = now(), ultimo_estado = 'corrio'`,
    [esc.org, tarea],
  );
}

test('las citas sin registrar son las que Avanzar ofrece cerrar; con alcance propio, sólo las del closer', async () => {
  const antes = await conOrganizacion(esc.org, () => citasSinRegistrar({ tipo: 'todo' }));
  const a = await unContacto(esc, { crmAsignadoA: CRM_A });
  const b = await unContacto(esc, { crmAsignadoA: CRM_B });
  await cita(a.id, hace(2)); // cuenta
  await cita(a.id, hace(3), { estado: 'cancelled' }); // cancelada
  await cita(a.id, hace(4), { asistio: true }); // ya registrada
  await cita(a.id, hace(5), { asistio: false }); // también registrada: no se presentó
  await cita(a.id, new Date(Date.now() + DIA)); // todavía no ocurrió
  await cita(a.id, hace(20)); // fuera de los 14 días de Avanzar
  await cita(a.id, hace(1), { sinCalendario: true }); // sin calendario: Avanzar no la ofrece
  await cita(b.id, hace(2)); // de otro closer
  assert.equal(await conOrganizacion(esc.org, () => citasSinRegistrar({ tipo: 'mio', crmUsuarioId: CRM_A })), 1);
  assert.equal(await conOrganizacion(esc.org, () => citasSinRegistrar({ tipo: 'mio', crmUsuarioId: CRM_B })), 1);
  assert.equal(await conOrganizacion(esc.org, () => citasSinRegistrar({ tipo: 'todo' })), antes + 2);
});

test('Mi Día trae el comentario: lo que falta del calendario, y si no, las citas sin registrar de su alcance', async () => {
  await esc.admin.query(`delete from negocio.tareas_programadas where org_id = $1 and tarea = 'citas'`, [esc.org]);
  const sin = await leerRespuesta<{ comentario: { texto: string; fuente: string } | null }>(await miDia(pedirComo('/api/closer/mi-dia', esc.token)));
  assert.equal(sin.estado, 200);
  assert.equal(sin.cuerpo.comentario?.fuente, 'configurar');
  assert.match(sin.cuerpo.comentario!.texto, /^La lectura del calendario nunca corrió sola/);

  await sellar('citas');
  const todas = await conOrganizacion(esc.org, () => citasSinRegistrar({ tipo: 'todo' }));
  assert.ok(todas > 0, 'sin citas sin registrar, la prueba no miraría la regla');
  const con = await leerRespuesta<{ comentario: { texto: string; fuente: string } | null }>(await miDia(pedirComo('/api/closer/mi-dia', esc.token)));
  assert.deepEqual(con.cuerpo.comentario, { texto: textoDeCitasSinRegistrar(todas), fuente: 'regla' });

  // Un closer vinculado al CRM ve las suyas: una, y no las de la empresa.
  const r = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash) values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [esc.org, NOMBRE_DEL_CLOSER, `closer-244-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
  );
  const closer = r.rows[0]!.id;
  await esc.admin.query(`insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'usuario' and org_id is null`, [closer]);
  await esc.admin.query(`insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, 'closer')`, [closer]);
  await esc.admin.query(
    `insert into negocio.closer_asignado (org_id, usuario_id, crm_usuario_id, actualizado_el, actualizado_por) values ($1, $2, $3, now(), null)`,
    [esc.org, closer, CRM_A],
  );
  const token = await sesionDe(closer);
  sesionesPropias.push(token);
  const suyo = await leerRespuesta<{ comentario: { texto: string; fuente: string } | null }>(await miDia(pedirComo('/api/closer/mi-dia', token)));
  assert.equal(suyo.estado, 200);
  assert.deepEqual(suyo.cuerpo.comentario, { texto: textoDeCitasSinRegistrar(1), fuente: 'regla' });
});

test('la lista de Llamadas trae la regla de la Reunión de hoy de su sección', async () => {
  await sellar('analizadores');
  const pedir = async () =>
    (await leerRespuesta<{ comentario: { texto: string; fuente: string } | null }>(await llamadas(pedirComo('/api/analizadores/llamadas?tipo=HT&filtro=analizadas', esc.token)))).cuerpo
      .comentario;
  assert.equal(await pedir(), null, 'sin Reunión de hoy, nada');
  const tema = (clave: string, seccion: string) => ({ clave, regla: clave, etiqueta: 'SIN LECTOR', seccion, origen: 'x', gravedad: 'media', perdida: null, texto: `La regla ${clave}.`, evidencia: {} });
  await esc.admin.query(
    `insert into negocio.reuniones_del_dia (org_id, dia, temas)
     select $1, (now() at time zone o.zona_horaria)::date, $2::jsonb from identidad.organizaciones o where o.id = $1`,
    [esc.org, JSON.stringify([tema('REU-CITAS-SIN-REGISTRAR', 'closer'), tema('REU-LLAMADAS-SIN-VINCULO', 'analizadores')])],
  );
  assert.deepEqual(await pedir(), { texto: 'La regla REU-LLAMADAS-SIN-VINCULO.', fuente: 'regla' });
});
