// Las cinco colas de Mi Día y el cockpit. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO PRUEBA, Y POR QUÉ CADA COSA
//
// Los documentos de Mi Día señalan, con nombre y apellido, los detalles que *"casi siempre se
// implementan mal"*. Cada uno de ellos tiene su prueba acá, porque todos comparten la misma
// forma de fallar: **la pantalla sigue funcionando y muestra un número equivocado.**
//
//   1. El filtro de Urgentes por PREFIJO. `bot_desactivado_postcall` empieza igual que los tags
//      de fallo y significa lo contrario. Con los datos reales, un filtro por prefijo mete 32
//      contactos a una cola roja que dice «la IA falló».
//   2. El contador que suma los seguimientos automáticos. *"Haría que el badge diga «12 tareas
//      pendientes» cuando nueve de esas doce las está haciendo un robot."*
//   3. Un contacto en DOS colas. Urgentes gana sobre Buzón; si no, atender una no cierra la otra.
//   4. Una IA activa generando tarea humana. Es *"la regla de fondo"* del Buzón.
//   5. Las citas vencidas desapareciendo. Es justo la que hay que atender.
//   6. Un cero NO MEDIDO dibujado como cero. Un `$0` donde nadie cargó montos afirma «no
//      vendiste nada».
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { colasDelDia } from '../../lib/negocio/miDia.ts';
import { cockpitDelMes } from '../../lib/negocio/inicio.ts';

const ZONA = 'America/Lima';

let admin: Client;
let alfa: string;

before(async () => {
  admin = await conectar('admin');
  const org = await unaFila<{ id: string }>(
    admin,
    `select id from identidad.organizaciones where slug = 'alfa'`,
  );
  assert.ok(org, 'falta la organización alfa del sembrado');
  alfa = org.id;
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

/** Se limpia ANTES de cada prueba: las colas se calculan sobre TODO el territorio, así que un
 *  contacto que dejó otra prueba cambia los conteos de ésta. */
async function limpiar(): Promise<void> {
  await admin.query('delete from negocio.contactos where org_id = $1', [alfa]);
}

async function contacto(
  ghl: string,
  etiquetas: string[] = [],
  extra: Record<string, unknown> = {},
): Promise<string> {
  return conOrganizacion(alfa, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({
        ghl_contact_id: ghl,
        nombre: `C ${ghl}`,
        territorio: 'closer',
        etiquetas,
        ...extra,
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.id;
  });
}

const colas = () => conOrganizacion(alfa, () => colasDelDia(ZONA));

// ─── 1 · Urgentes: los TRES tags, y no el que empieza igual ─────────────────

test('Urgentes lleva los tres tags de fallo, y NO `bot_desactivado_postcall`', async () => {
  // ES LA PRUEBA MÁS IMPORTANTE DEL ARCHIVO, y el contrato la pide con todas las letras: *"no
  // armes el workflow con un filtro «contiene `bot_desactivado`». `bot_desactivado_postcall` ya
  // existe y significa lo CONTRARIO — «esta persona ya pasó por la llamada», no «el bot falló»"*.
  //
  // Con los datos reales de la subcuenta, un filtro por prefijo mete 32 contactos a una cola
  // roja que dice que la IA falló. Y no falla nada: la cola se dibuja, con 32 filas plausibles.
  await limpiar();
  const marca = randomUUID().slice(0, 6);

  const conFalloApp = await contacto(`u1-${marca}`, ['bot_desactivado_appflow']);
  const conFalloLead = await contacto(`u2-${marca}`, ['bot_desactivado_leadflow']);
  const conLegado = await contacto(`u3-${marca}`, ['bot_pausado_fallo']);
  const yaPasoLaLlamada = await contacto(`u4-${marca}`, ['bot_desactivado_postcall']);
  const sinNada = await contacto(`u5-${marca}`, []);

  const c = await colas();
  const ids = c.urgentes.map((x) => x.fila.id).sort();

  assert.deepEqual(
    ids,
    [conFalloApp, conFalloLead, conLegado].sort(),
    'la cola de Urgentes no tiene exactamente los tres tags de fallo del auditor',
  );
  assert.ok(
    !ids.includes(yaPasoLaLlamada),
    '`bot_desactivado_postcall` entró a Urgentes: significa que YA PASÓ la llamada, no que el bot falló',
  );
  assert.ok(!ids.includes(sinNada));
});

test('ninguna fila de Urgentes queda sin motivo', async () => {
  // El `01`: *"si no hay motivo guardado, la fila muestra un texto de reserva —«requiere
  // intervención, revisar conversación»— **nunca queda vacía**"*.
  //
  // Una fila en una cola roja sin decir por qué es peor que no tenerla: quien la ve no sabe si
  // el motivo no se cargó o si la fila no debería estar.
  await limpiar();
  await contacto(`m-${randomUUID().slice(0, 6)}`, ['bot_desactivado_appflow']);
  const c = await colas();
  assert.equal(c.urgentes.length, 1);
  assert.ok(c.urgentes[0]!.motivo && c.urgentes[0]!.motivo.length > 0, 'la fila urgente no trae motivo');
});

// ─── 2 · Un contacto en UNA sola cola ──────────────────────────────────────

test('un contacto en Urgentes NO aparece en el Buzón, aunque cumpla sus condiciones', async () => {
  // El `01`: *"gana la cola más específica. Dos colas para la misma persona hacen que atender
  // una no cierre la otra, y el closer termina trabajando el mismo caso dos veces sin saberlo"*.
  await limpiar();
  const marca = randomUUID().slice(0, 6);

  // Cumple TODO lo del Buzón —escribió, el bot está apagado— y además tiene un tag de fallo.
  const enLasDos = await contacto(`d1-${marca}`, ['bot_desactivado_appflow'], {
    ultimo_entrante_el: new Date(),
    ultimo_entrante_texto: 'hola, sigo esperando',
  });
  // Y uno que solo cumple lo del Buzón, para que la prueba no pase por tener el buzón vacío.
  const soloBuzon = await contacto(`d2-${marca}`, [], {
    ultimo_entrante_el: new Date(),
    ultimo_entrante_texto: 'quiero avanzar',
  });

  const c = await colas();
  assert.deepEqual(c.urgentes.map((x) => x.fila.id), [enLasDos]);
  assert.deepEqual(
    c.buzon.map((x) => x.fila.id),
    [soloBuzon],
    'el contacto de Urgentes también entró al Buzón: gana la cola más específica',
  );
});

// ─── 3 · Una IA activa nunca genera tarea humana ───────────────────────────

test('con el bot ATENDIENDO, el contacto no entra al Buzón', async () => {
  // *"La regla de fondo: una IA activa nunca genera tarea humana."* Si el bot está contestando,
  // no hay nada que hacer a mano — y poner la fila igual manda a una persona a pisar una
  // conversación que ya está atendida.
  await limpiar();
  const marca = randomUUID().slice(0, 6);

  const atendidos = [];
  for (const tag of ['bot_activado_appflow', 'bot_activado_leadflow', 'bot_activado']) {
    atendidos.push(
      await contacto(`b-${tag}-${marca}`, [tag], {
        ultimo_entrante_el: new Date(),
        ultimo_entrante_texto: 'escribí algo',
      }),
    );
  }
  const apagado = await contacto(`b-off-${marca}`, ['bot_apagado_manual'], {
    ultimo_entrante_el: new Date(),
    ultimo_entrante_texto: 'y yo también',
  });

  const c = await colas();
  const enBuzon = c.buzon.map((x) => x.fila.id);
  assert.deepEqual(enBuzon, [apagado], 'un contacto con el bot atendiendo entró al Buzón');
  for (const a of atendidos) assert.ok(!enBuzon.includes(a));
});

test('el Buzón trae un fragmento del mensaje, y ordena por el más reciente', async () => {
  // El fragmento es *"para decidir sin abrir la ficha"*. Sin él, cada fila obliga a abrir el
  // panel para saber si vale la pena.
  await limpiar();
  const marca = randomUUID().slice(0, 6);
  const viejo = await contacto(`f1-${marca}`, [], {
    ultimo_entrante_el: new Date(Date.now() - 3600_000),
    ultimo_entrante_texto: 'escribí hace una hora',
  });
  const nuevo = await contacto(`f2-${marca}`, [], {
    ultimo_entrante_el: new Date(),
    ultimo_entrante_texto: 'x'.repeat(200),
  });

  const c = await colas();
  assert.deepEqual(
    c.buzon.map((x) => x.fila.id),
    [nuevo, viejo],
    'el Buzón no ordena por el mensaje más reciente primero',
  );
  assert.equal(c.buzon[0]!.fragmento!.length, 80, 'el fragmento no está acotado a 80 caracteres');
});

// ─── 4 · El contador que casi siempre se implementa mal ────────────────────

test('el contador NO suma los seguimientos automáticos en curso', async () => {
  // El `01` lo llama *"el detalle del contador que casi siempre se implementa mal"*: los
  // `automatico_en_curso` **se muestran** —el closer quiere ver que la serie está corriendo—
  // pero **no suman**.
  //
  // *"Sumarlos haría que el badge diga «12 tareas pendientes» cuando nueve de esas doce las
  // está haciendo un robot. El closer abre la pantalla, ve nueve filas que no requieren nada, y
  // a la tercera vez deja de creerle al contador."*
  await limpiar();
  const marca = randomUUID().slice(0, 6);

  // Tres con la serie automática corriendo: se muestran, no suman.
  for (let i = 0; i < 3; i += 1) {
    await contacto(`s${i}-${marca}`, ['seguimiento_recupero']);
  }
  // Y uno urgente, que SÍ suma.
  await contacto(`su-${marca}`, ['bot_desactivado_appflow']);

  const c = await colas();
  assert.equal(c.seguimientos.length, 3, 'los automáticos en curso no se están mostrando');
  assert.ok(
    c.seguimientos.every((s) => s.pideManos === false),
    'un automático en curso quedó marcado como que pide manos',
  );
  assert.equal(
    c.tareasPendientes,
    1,
    `el contador dice ${c.tareasPendientes}: sumó los automáticos, que no piden nada`,
  );
});

test('la Agenda tampoco suma al contador: una cita no es una tarea', async () => {
  // Una cita es un evento, no algo pendiente de hacer. Sumarla haría que el badge crezca por
  // tener agenda llena, que es lo contrario de tener trabajo atrasado.
  await limpiar();
  const marca = randomUUID().slice(0, 6);
  const id = await contacto(`ag-${marca}`, []);
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('citas')
      .values({ ghl_evento_id: `e-${marca}`, contacto_id: id, inicio_el: new Date() } as never)
      .execute();
  });

  const c = await colas();
  assert.equal(c.agenda.length, 1, 'la cita de hoy no entró a la Agenda');
  assert.equal(c.tareasPendientes, 0, 'la Agenda sumó al contador de tareas');
});

// ─── 5 · Las citas vencidas no desaparecen ─────────────────────────────────

test('una cita vencida sigue en la lista, marcada y ABAJO', async () => {
  // El `01`: *"una cita cuya hora ya pasó y que nadie cerró con Avanzar sigue en la lista,
  // marcada como vencida y ordenada abajo. **No desaparece.** Si desapareciera, el closer
  // perdería de vista exactamente la cita que tiene pendiente de registrar"*.
  await limpiar();
  const marca = randomUUID().slice(0, 6);
  const conVencida = await contacto(`v1-${marca}`, []);
  const conFutura = await contacto(`v2-${marca}`, []);

  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('citas')
      .values([
        // Hoy pero ya pasó: dos horas atrás.
        { ghl_evento_id: `ev-${marca}`, contacto_id: conVencida, inicio_el: new Date(Date.now() - 2 * 3600_000) },
        // Hoy y todavía no: en dos horas. (Si la prueba corre cerca de medianoche esta cita
        // podría caer en el día siguiente y salir de la cola; el rango es de HOY a propósito.)
        { ghl_evento_id: `ef-${marca}`, contacto_id: conFutura, inicio_el: new Date(Date.now() + 2 * 3600_000) },
      ] as never)
      .execute();
  });

  const c = await colas();
  const vencidas = c.agenda.filter((x) => x.cita?.vencida);
  assert.equal(vencidas.length >= 1, true, 'la cita vencida desapareció de la Agenda');
  // Y va DESPUÉS de las que no vencieron.
  const primeraVencida = c.agenda.findIndex((x) => x.cita?.vencida);
  const ultimaVigente = c.agenda.map((x) => Boolean(x.cita?.vencida)).lastIndexOf(false);
  if (ultimaVigente >= 0 && primeraVencida >= 0) {
    assert.ok(primeraVencida > ultimaVigente, 'las vencidas no quedaron abajo');
  }
});

test('una cita CANCELADA no entra a la Agenda', async () => {
  await limpiar();
  const marca = randomUUID().slice(0, 6);
  const id = await contacto(`ca-${marca}`, []);
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('citas')
      .values({
        ghl_evento_id: `ec-${marca}`,
        contacto_id: id,
        inicio_el: new Date(),
        // El estado lo pone GoHighLevel y es texto libre: se compara sin distinguir caja,
        // porque `Cancelled` y `cancelled` son el mismo hecho.
        estado_ghl: 'Cancelled',
      } as never)
      .execute();
  });

  const c = await colas();
  assert.equal(c.agenda.length, 0, 'una cita cancelada entró a la Agenda');
});

// ─── 6 · «Completadas hoy» y la fila huérfana ──────────────────────────────

test('«Completadas hoy» se devuelve SIEMPRE, vacía o no', async () => {
  // Es el ancla de la pantalla y lo único que le dice al closer «esto ya lo hiciste». Que la
  // clave exista siempre es lo que permite que la pantalla la dibuje sin condicionales.
  await limpiar();
  const c = await colas();
  assert.ok(Array.isArray(c.completadas), '`completadas` no vino como lista');
  assert.equal(c.completadas.length, 0);
});

test('un resultado de un contacto que YA NO ESTÁ sigue constando', async () => {
  // El `01`: *"si alguien registró un resultado sobre un contacto que ya no está en la caché
  // —lo borraron del pipeline después—, la fila SIGUE apareciendo, sin nombre y sin íconos, pero
  // apareciendo. Es deliberado: el trabajo se hizo y tiene que constar. Lo que **no** se hace es
  // inventarle datos."*
  await limpiar();
  const marca = randomUUID().slice(0, 6);
  const id = await contacto(`h-${marca}`, []);
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('resultados')
      .values({ contacto_id: id, salida: 'venta', rol: 'closer', monto: '1000.00' } as never)
      .execute();
  });
  // Y ahora el contacto sale del territorio: se congela. El resultado queda.
  await conOrganizacion(alfa, async () => {
    await datos().updateTable('contactos').set({ territorio: null }).where('id', '=', id).execute();
  });

  const c = await colas();
  assert.equal(c.completadas.length, 1, 'el resultado del contacto congelado desapareció');
  const fila = c.completadas[0]!.fila;
  assert.equal(c.completadas[0]!.completadaPor, 'venta', 'no dice qué la completó');
  // Y NO se le inventan datos: los íconos van como no medidos, no como ceros.
  assert.equal(fila.iconos.montoVenta, null);
  assert.equal(fila.score, null);
});

// ─── 7 · El cockpit: un cero medido y uno no medido ────────────────────────

test('sin ningún resultado, el cockpit devuelve NULO y no cero', async () => {
  // El `11` § 4: *"un `$0` donde nadie cargó montos afirma «no vendiste nada». Es falso, y nadie
  // reporta un panel que simplemente parece vacío"*.
  //
  // Es la prueba que impide el `?? 0` que se ve inofensivo.
  await limpiar();
  await contacto(`ck-${randomUUID().slice(0, 6)}`, ['cita_agendada', 'noshow']);

  const ck = await conOrganizacion(alfa, () => cockpitDelMes(ZONA, 0));

  assert.equal(ck.cobrado.valor, null, 'el cobrado devolvió un número sin ningún resultado cargado');
  assert.ok(ck.cobrado.falta, 'el cobrado nulo no dice qué falta');
  assert.equal(ck.ventas.valor, null);
  assert.equal(ck.acuerdos.valor, null);
  // La tasa de asistencia es nula SIEMPRE hoy: no hay fuente. Y lo dice.
  assert.equal(ck.tasaDeAsistencia.valor, null);
  assert.ok(ck.tasaDeAsistencia.falta);
  // Y los que SÍ tienen fuente traen su número medido.
  assert.equal(ck.conCitaAgendada.valor, 1);
  assert.equal(ck.noShows.valor, 1);
});

test('CON resultados y sin ventas, el cockpit devuelve CERO y no nulo', async () => {
  // La otra mitad, y es la que hace que la prueba anterior no sea "devolvé nulo siempre".
  //
  // Registrado un no-show, «cobrado» pasa a ser un cero MEDIDO: alguien trabajó este mes y no
  // cobró. Eso es un hecho, y se dibuja como `0`, no como `—`.
  await limpiar();
  const id = await contacto(`ck2-${randomUUID().slice(0, 6)}`, []);
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('resultados')
      .values({ contacto_id: id, salida: 'no_show', rol: 'closer' } as never)
      .execute();
  });

  const ck = await conOrganizacion(alfa, () => cockpitDelMes(ZONA, 0));
  assert.equal(ck.cobrado.valor, 0, 'con resultados registrados, el cobrado tiene que ser un cero medido');
  assert.equal(ck.cobrado.falta, undefined, 'un cero medido no lleva texto de "falta"');
  assert.equal(ck.ventas.valor, 0);
});

test('el cockpit recibe el contador de tareas, no lo recalcula', async () => {
  // El `01`: *"si dos pantallas muestran el mismo número, comparten la función que lo calcula"*.
  // El contador tiene una regla propia —los automáticos no suman— y recalcularlo acá sería una
  // segunda implementación de esa regla.
  await limpiar();
  const ck = await conOrganizacion(alfa, () => cockpitDelMes(ZONA, 7));
  assert.equal(ck.tareasPendientes.valor, 7, 'el cockpit recalculó el contador en vez de recibirlo');
});
