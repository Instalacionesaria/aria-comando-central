// La lectura de Conversation y sus tres piezas nuevas, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, CN-1)
//
// La mitad pura la cuida `pruebas/codigo/250-lectura-de-conversation.test.ts`. Acá se mira lo que sólo se ve con filas:
//
//   · el ICP de quienes agendaron: la cohorte de la ventana con CUALQUIER cita —con o sin calendario, pasada o
//     futura, como el `agendaron` de `indicadoresDelLead`—, por `tramoDelPuntaje` —el cero es sin calificar— —
//     mutaciones: sacar la ventana, sacar la cita, filtrar por calendario o por fecha, cortar con otros umbrales;
//   · la asistencia por tramo: las citas de la ventana, ocurridas, alcanzables y de contactos no descartados, cada
//     una en el tramo de su contacto — mutaciones: sacar cualquiera de las cuatro, o mandar todo a un tramo;
//   · los patrones abiertos: uno por código, como los agrupa Auditoría, y sólo los que no se resolvieron — mutación:
//     contar hallazgos, contar por agente y código, o contar los resueltos;
//   · la lectura entera: arma la pantalla con lo leído, y sin auditoría no cuenta patrones y el sentimiento lo dice.
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
  icpDeLosAgendados,
  patronesAbiertos,
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

test('el ICP de quienes agendaron: la cohorte de la ventana con cualquier cita, por tramo, y el cero es sin calificar', async () => {
  await limpiar();
  const antes = await enAlfa(() => icpDeLosAgendados(30));
  for (const score of [80, 75, 60, 10, 0, null]) await unaCita(await unContacto({ score }));
  // También cuentan: una cita sin calendario y una futura, como en el `agendaron` del panel de al lado.
  await unaCita(await unContacto({ score: 85 }), { sinCalendario: true });
  await unaCita(await unContacto({ score: 55 }), { haceHoras: -48 });
  // Lo que no cuenta: sin cita, y con cita pero dado de alta antes de la ventana.
  await unContacto({ score: 90 });
  await unaCita(await unContacto({ score: 90, haceDias: 40 }));
  const despues = await enAlfa(() => icpDeLosAgendados(30));
  await limpiar();
  const delta = Object.fromEntries((['alto', 'medio', 'bajo', 'sin_calificar'] as const).map((k) => [k, despues[k] - antes[k]]));
  assert.deepEqual(
    delta,
    { alto: 3, medio: 2, bajo: 1, sin_calificar: 2 },
    'contó a alguien sin cita o fuera de la ventana, dejó afuera una cita sin calendario o futura, o cortó con otros umbrales',
  );
});

test('la asistencia por tramo: citas de la ventana, ocurridas, alcanzables y de contactos no descartados', async () => {
  await limpiar();
  const antes = await enAlfa(() => asistenciaPorTramo(30));
  const alto = await unContacto({ score: 80 });
  await unaCita(alto, { asistio: true });
  await unaCita(alto, { asistio: false });
  await unaCita(alto, { asistio: null });
  // Lo que no cuenta: una futura, una sin calendario, una de un contacto descartado y una de antes de la ventana.
  await unaCita(alto, { haceHoras: -48, asistio: true });
  await unaCita(alto, { sinCalendario: true, asistio: true });
  await unaCita(await unContacto({ score: 80, etiquetas: ['Rechazado'] }), { asistio: true });
  await unaCita(alto, { haceHoras: 40 * 24, asistio: true });
  // Y otro tramo, para ver que cada cita va al de su contacto.
  await unaCita(await unContacto({ score: 60 }), { asistio: false });
  const despues = await enAlfa(() => asistenciaPorTramo(30));
  await limpiar();
  const delta = (t: 'alto' | 'medio') => [despues[t].conAsistencia - antes[t].conAsistencia, despues[t].sePresentaron - antes[t].sePresentaron];
  assert.deepEqual(
    [delta('alto'), delta('medio')],
    [[2, 1], [1, 0]],
    'contó una cita futura, sin calendario, de un descartado o de antes de la ventana, o mandó una cita a otro tramo',
  );
});

test('los patrones abiertos: uno por código, como Auditoría, de los hallazgos que no se resolvieron', async () => {
  await limpiar();
  const antes = await enAlfa(() => patronesAbiertos());
  const k = await unContacto();
  const a = await esc.admin.query<{ id: string }>(
    `insert into negocio.analisis_del_agente (org_id, contacto_id, agente, auditable, intervencion, motivo, nivel, resumen, disparo, mensajes_del_agente)
     values ($1, $2, 'chat_post_agenda', true, false, null, 'amarillo', 'C250', 'debounce', 4) returning id`,
    [esc.org, k],
  );
  /* Dos hallazgos abiertos del mismo patrón —uno de cada agente: en Auditoría son UN patrón—, uno de otro patrón, y un
     patrón que sólo tiene un hallazgo resuelto. */
  for (const [agente, patron, resuelto] of [
    ['chat_post_agenda', 'c250_patron', false],
    ['chat_pre_agenda', 'c250_patron', false],
    ['chat_post_agenda', 'c250_otro', false],
    ['chat_post_agenda', 'c250_resuelto', true],
  ] as const) {
    await esc.admin.query(
      `insert into negocio.hallazgos (org_id, contacto_id, analisis_id, agente, titulo, patron, correccion, evidencia_agente, severidad, categoria, resuelto_el)
       values ($1, $2, $3, $4, 'C250', $5, 'Una corrección.', 'Una línea.', 'amarillo', 'comportamiento', $6)`,
      [esc.org, k, a.rows[0]!.id, agente, patron, resuelto ? new Date() : null],
    );
  }
  const despues = await enAlfa(() => patronesAbiertos());
  await limpiar();
  assert.equal(despues - antes, 2, 'contó hallazgos en vez de patrones, por agente y código, o un patrón resuelto');
});

test('la lectura entera arma la pantalla con lo leído, y sin auditoría no cuenta patrones', async () => {
  await limpiar();
  const l = await enAlfa(() => lecturaDeConversation(30, true));
  assert.equal(l.pantalla.paneles.leadFlow.contactos.valor, l.lead.cohorte, 'el panel no es la cohorte que se leyó');
  assert.equal(l.pantalla.paneles.appointmentFlow.citas.valor, l.citas.citas);
  assert.deepEqual(l.pantalla.agentes.map((a) => a.clave), ['leadflow_texto', 'leadflow_voz', 'appflow_texto', 'appflow_voz']);
  assert.deepEqual(l.pantalla.porCorregir, { valor: await enAlfa(() => patronesAbiertos()), motivo: null });
  const sinAuditar = await enAlfa(() => lecturaDeConversation(30, false));
  // El «audita» llega a la mitad pura: lo dicen el contador y el sentimiento, no sólo un cero.
  assert.deepEqual(sinAuditar.pantalla.porCorregir, { valor: null, motivo: 'no_audita' });
  assert.equal(sinAuditar.pantalla.agentes[0]!.motivoDelSentimiento, 'no_audita');
});
