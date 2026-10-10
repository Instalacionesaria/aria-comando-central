// La lectura de Conversation y sus tres piezas nuevas, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, CN-1)
//
// La mitad pura la cuida `pruebas/codigo/250-lectura-de-conversation.test.ts`. Acá se mira lo que sólo se ve con filas:
//
//   · el ICP de quienes agendaron: la cohorte de la ventana con alguna cita, por `tramoDelPuntaje` —el cero es sin
//     calificar— — mutaciones: sacar la ventana, sacar la cita, cortar con otros umbrales;
//   · la asistencia por tramo: las citas ocurridas, alcanzables y de contactos no descartados — mutaciones: sacar
//     cualquiera de las tres;
//   · los hallazgos abiertos: sólo los que no se resolvieron — mutación: contar los resueltos;
//   · la lectura entera: arma la pantalla con lo leído, y sin auditoría no cuenta hallazgos.
//
// La organización `alfa` la comparten otras pruebas: se mide antes y después de sembrar, y se compara la diferencia.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import {
  asistenciaPorTramo,
  hallazgosAbiertos,
  icpDeLosAgendados,
  lecturaDeConversation,
} from '../../lib/negocio/lecturaDeConversation.ts';

let esc: Escenario;
const CONTACTO = 'lectura-conversation-';

async function limpiar(): Promise<void> {
  const mios = 'select id from negocio.contactos where ghl_contact_id like $1';
  await esc.admin.query(`delete from negocio.hallazgos where contacto_id in (${mios})`, [`${CONTACTO}%`]);
  await esc.admin.query(`delete from negocio.analisis_del_agente where contacto_id in (${mios})`, [`${CONTACTO}%`]);
  await esc.admin.query(`delete from negocio.citas where contacto_id in (${mios})`, [`${CONTACTO}%`]);
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${CONTACTO}%`]);
}

/** Un contacto dado de alta hace `haceDias`, con su puntaje y sus etiquetas. */
async function unContacto(o: { score?: number | null; haceDias?: number; etiquetas?: string[] } = {}): Promise<string> {
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, score, etiquetas)
     values ($1, $2, 'Lead de prueba', 'closer', now() - make_interval(days => $3) - interval '1 hour', $4, $5::text[]) returning id`,
    [esc.org, `${CONTACTO}${randomUUID().slice(0, 8)}`, o.haceDias ?? 1, o.score ?? null, o.etiquetas ?? []],
  );
  return rows[0]!.id;
}

/** Una cita del contacto, hace `haceHoras` (negativo: en el futuro), con o sin calendario y con su asistencia. */
async function unaCita(contacto: string, o: { haceHoras?: number; sinCalendario?: boolean; asistio?: boolean | null } = {}): Promise<void> {
  await esc.admin.query(
    `insert into negocio.citas (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl, asistio)
     values ($1, $2, $3, $4, now() - make_interval(secs => $5::float8), now() - make_interval(secs => $5::float8) + interval '1 hour', 'confirmed', $6)`,
    [esc.org, contacto, `cita-${randomUUID().slice(0, 8)}`, o.sinCalendario ? null : 'cal-conversation', (o.haceHoras ?? 3) * 3600, o.asistio ?? null],
  );
}

const enAlfa = <T>(f: () => Promise<T>) => conOrganizacion(esc.org, f);

before(async () => {
  esc = await montar('LecturaDeConversation');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

test('el ICP de quienes agendaron: la cohorte de la ventana con alguna cita, por tramo, y el cero es sin calificar', async () => {
  await limpiar();
  const antes = await enAlfa(() => icpDeLosAgendados(30));
  for (const score of [80, 75, 60, 10, 0, null]) await unaCita(await unContacto({ score }));
  // Lo que no cuenta: sin cita, y con cita pero dado de alta antes de la ventana.
  await unContacto({ score: 90 });
  await unaCita(await unContacto({ score: 90, haceDias: 40 }));
  const despues = await enAlfa(() => icpDeLosAgendados(30));
  await limpiar();
  const delta = Object.fromEntries((['alto', 'medio', 'bajo', 'sin_calificar'] as const).map((k) => [k, despues[k] - antes[k]]));
  assert.deepEqual(delta, { alto: 2, medio: 1, bajo: 1, sin_calificar: 2 }, 'contó a alguien sin cita o fuera de la ventana, o cortó con otros umbrales');
});

test('la asistencia por tramo: citas ocurridas, alcanzables y de contactos no descartados', async () => {
  await limpiar();
  const antes = await enAlfa(() => asistenciaPorTramo(30));
  const alto = await unContacto({ score: 80 });
  await unaCita(alto, { asistio: true });
  await unaCita(alto, { asistio: false });
  await unaCita(alto, { asistio: null });
  // Lo que no cuenta: una futura, una sin calendario y una de un contacto descartado.
  await unaCita(alto, { haceHoras: -48, asistio: true });
  await unaCita(alto, { sinCalendario: true, asistio: true });
  await unaCita(await unContacto({ score: 80, etiquetas: ['Rechazado'] }), { asistio: true });
  const despues = await enAlfa(() => asistenciaPorTramo(30));
  await limpiar();
  assert.deepEqual(
    [despues.alto.conAsistencia - antes.alto.conAsistencia, despues.alto.sePresentaron - antes.alto.sePresentaron],
    [2, 1],
    'contó una cita futura, una sin calendario o una de un contacto descartado',
  );
});

test('los hallazgos abiertos son los que no se resolvieron', async () => {
  await limpiar();
  const antes = await enAlfa(() => hallazgosAbiertos());
  const k = await unContacto();
  const a = await esc.admin.query<{ id: string }>(
    `insert into negocio.analisis_del_agente (org_id, contacto_id, agente, auditable, intervencion, motivo, nivel, resumen, disparo, mensajes_del_agente)
     values ($1, $2, 'chat_post_agenda', true, false, null, 'amarillo', 'C250', 'debounce', 4) returning id`,
    [esc.org, k],
  );
  for (const resuelto of [false, true]) {
    await esc.admin.query(
      `insert into negocio.hallazgos (org_id, contacto_id, analisis_id, agente, titulo, patron, correccion, evidencia_agente, severidad, categoria, resuelto_el)
       values ($1, $2, $3, 'chat_post_agenda', 'C250', 'c250_patron', 'Una corrección.', 'Una línea.', 'amarillo', 'comportamiento', $4)`,
      [esc.org, k, a.rows[0]!.id, resuelto ? new Date() : null],
    );
  }
  const despues = await enAlfa(() => hallazgosAbiertos());
  await limpiar();
  assert.equal(despues - antes, 1, 'se contó un hallazgo resuelto');
});

test('la lectura entera arma la pantalla con lo leído, y sin auditoría no cuenta hallazgos', async () => {
  await limpiar();
  const l = await enAlfa(() => lecturaDeConversation(30, true));
  assert.equal(l.pantalla.paneles.leadFlow.contactos.valor, l.lead.cohorte, 'el panel no es la cohorte que se leyó');
  assert.equal(l.pantalla.paneles.appointmentFlow.citas.valor, l.citas.citas);
  assert.deepEqual(l.pantalla.agentes.map((a) => a.clave), ['leadflow_texto', 'leadflow_voz', 'appflow_texto', 'appflow_voz']);
  assert.equal(l.pantalla.porCorregir, await enAlfa(() => hallazgosAbiertos()));
  const sinAuditar = await enAlfa(() => lecturaDeConversation(30, false));
  assert.equal(sinAuditar.pantalla.porCorregir, 0);
});
