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
import { filaDeContacto } from '../../lib/negocio/fila.ts';
import { registrarResultado } from '../../lib/negocio/avanzar.ts';
import { cockpitDelMes } from '../../lib/negocio/inicio.ts';

const ZONA = 'America/Lima';

let admin: Client;
let alfa: string;
/* Quien registra Y a quien se designa closer. Antes no hacia falta: el cockpit sumaba las ventas de
   toda la empresa. Ahora tiene sujeto, asi que una prueba del cockpit sin usuario no puede afirmar
   nada — y eso es una mejora, no una molestia: es el defecto de la 015 hecho imposible de escribir. */
let quien: string;

before(async () => {
  admin = await conectar('admin');
  const org = await unaFila<{ id: string }>(
    admin,
    `select id from identidad.organizaciones where slug = 'alfa'`,
  );
  assert.ok(org, 'falta la organización alfa del sembrado');
  alfa = org.id;

  const u = await unaFila<{ id: string }>(
    admin,
    `select id from identidad.usuarios where org_id = $1 limit 1`,
    [alfa],
  );
  assert.ok(u, 'la organizacion alfa no tiene usuarios: ¿corrio el sembrado?');
  quien = u.id;
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

/**
 * Un mensaje REAL en `negocio.mensajes`, y el disparador de la 013 mueve los sellos del contacto.
 *
 * Se escribe la fila y no la columna a propósito. Los sellos `ultimo_entrante_el` y
 * `ultimo_saliente_el` los mantiene `negocio.marcar_actividad_del_contacto()`, así que tocarlos a
 * mano probaría la cola contra un estado que el sistema no produce. Por acá se prueba la cadena
 * entera: mensaje → disparador → sello → cola.
 */
async function mensaje(
  contactoId: string,
  direccion: 'entrante' | 'saliente',
  cuando: Date,
  cuerpo = 'hola',
): Promise<void> {
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('mensajes')
      .values({
        ghl_mensaje_id: `m-${randomUUID()}`,
        contacto_id: contactoId,
        direccion,
        // `contacto` cuando escribe él; `persona` cuando responde alguien de este lado. Es la
        // distinción que la 013 pide y no cambia nada de esta cola, pero una fila con el autor
        // equivocado es una fila que no describe lo que pasó.
        autor: direccion === 'entrante' ? 'contacto' : 'persona',
        cuerpo,
        enviado_el: cuando,
      } as never)
      .execute();
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

/** Registra un resultado sobre un contacto, con la antigüedad que se quiera. */
async function resultado(contactoId: string, salida: string, haceDias = 0): Promise<void> {
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('resultados')
      .values({
        contacto_id: contactoId,
        salida,
        rol: 'closer',
        creado_el: new Date(Date.now() - haceDias * 24 * 3600 * 1000),
      } as never)
      .execute();
  });
}

test('un contacto CERRADO sale de Urgentes, por más que el bot haya fallado', async () => {
  /* ══ LO REPORTÓ ALGUIEN MIRANDO SU PROPIA PANTALLA ════════════════════
   *
   * Descalificó un contacto y **siguió en «Intervenciones urgentes»**: tachado, con su píldora
   * `NO LE INTERESA` al lado, y la línea roja «revisar la conversación» debajo. O sea que la fila
   * probaba que el sistema sabía que estaba cerrado, y la cola lo listaba igual.
   *
   * La causa: esta cola solo mira las tres etiquetas del CRM, y **registrar un resultado nunca
   * quita una etiqueta** — `etiquetasDelResultado` solo agrega. Así que la etiqueta se queda para
   * siempre, y la fila también.
   *
   * No era solo ruido: esas filas SUMAN al contador de tareas del día. */
  await limpiar();
  const marca = randomUUID().slice(0, 6);

  const cerrado = await contacto(`c1-${marca}`, ['bot_desactivado_appflow']);
  await resultado(cerrado, 'no_interesa');

  /* El control, y sin él esta prueba no vale nada: MISMA etiqueta, sin resultado. Si desapareciera
     también, lo que se rompió es la cola entera y no habría forma de notarlo desde acá. */
  const sigueAbierto = await contacto(`c2-${marca}`, ['bot_desactivado_appflow']);

  const c = await colas();
  const ids = c.urgentes.map((x) => x.fila.id);

  assert.deepEqual(
    ids,
    [sigueAbierto],
    'un contacto con resultado `no_interesa` sigue en la cola que dice «requiere intervención», ' +
      'sobre alguien que ya se revisó y se cerró',
  );
  assert.equal(
    c.tareasPendientes,
    1,
    'el contacto cerrado sigue sumando al contador de tareas del día: el número miente',
  );
});

test('los cuatro que PARECEN cerrados y no lo están siguen en Urgentes', async () => {
  /* Es la mitad que hace que la regla no sea «vaciar la cola». Los cuatro tienen trabajo por
     delante, y cada uno por un motivo distinto que `lib/negocio/etapas.ts` ya tenía escrito:

       · `acuerdo_sin_pago` — hay plata comprometida y sin cobrar: es el que MÁS pide;
       · `nurture`          — *«frío, pero explícitamente reversible»*; un «no es ahora» no es un «no»;
       · `no_show`          — *«un hecho operativo, no una resolución: el contacto sigue vivo»*;
       · `seguimiento`      — el estado de trabajo activo por definición.

     Si alguno se colara en la lista de cerradas, un contacto con trabajo pendiente desaparecería
     de la única cola que lo estaba mostrando — y desaparecer no da error. */
  await limpiar();
  const marca = randomUUID().slice(0, 6);
  const abiertos: string[] = [];

  for (const salida of ['acuerdo_sin_pago', 'nurture', 'no_show', 'seguimiento']) {
    const id = await contacto(`a-${salida}-${marca}`, ['bot_desactivado_leadflow']);
    await resultado(id, salida);
    abiertos.push(id);
  }

  const c = await colas();
  assert.deepEqual(
    c.urgentes.map((x) => x.fila.id).sort(),
    [...abiertos].sort(),
    'alguno de los cuatro estados VIVOS se trató como cerrado y desapareció de Urgentes',
  );
});

test('y tampoco cae en el Buzón: arreglar una cola no puede ser MUDARLO a la otra', async () => {
  /* ══ EL ARREGLO A MEDIAS QUE HABRÍA PARECIDO UN ARREGLO ══════════════════
   *
   * El caso real era un contacto que había escrito hace trece días, sin respuesta, y que se
   * descalificó. Sacándolo solo de Urgentes cumple las cinco condiciones del Buzón y **aparece
   * ahí**: el mismo contacto en otra lista, sumando al mismo contador.
   *
   * Y la condición 3 del Buzón no lo cubre, aunque lo parezca: mira lo que se cerró HOY. Un
   * contacto cerrado hace trece días la pasa entera. Por eso el resultado de esta prueba es
   * VIEJO — si fuera de hoy, pasaría por el motivo equivocado y la prueba sería vacua. */
  await limpiar();
  const marca = randomUUID().slice(0, 6);

  const cerrado = await contacto(`b1-${marca}`, []);
  await mensaje(cerrado, 'entrante', new Date(Date.now() - 13 * 24 * 3600 * 1000), 'hola, me interesa');
  await resultado(cerrado, 'no_interesa', 13);

  // El control: mismo escenario exacto, pero con un resultado que NO cierra.
  const enSeguimiento = await contacto(`b2-${marca}`, []);
  await mensaje(enSeguimiento, 'entrante', new Date(Date.now() - 13 * 24 * 3600 * 1000), 'hola, me interesa');
  await resultado(enSeguimiento, 'seguimiento', 13);

  const c = await colas();
  assert.deepEqual(
    c.buzon.map((x) => x.fila.id),
    [enSeguimiento],
    'el contacto cerrado hace trece días aparece en el Buzón: sacarlo de Urgentes solo lo mudó',
  );
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

test('los seguimientos AUTOMÁTICOS no entran a Mi Día, y el ícono sigue encendido', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // ESTA PRUEBA AFIRMABA LO CONTRARIO, Y LA REGLA CAMBIÓ POR PEDIDO
  //
  // Antes exigía que los `automatico_en_curso` SE MOSTRARAN sin sumar al contador —era la regla
  // del documento `01`—. Se pidió al revés, y con el motivo: *«el automático solo pone la
  // etiqueta correspondiente para que se dispare una automatización preparada en GHL y entre en ese
  // flujo»*. O sea que no es trabajo de nadie en esta pantalla, y Mi Día contesta «qué tengo que
  // hacer ahora».
  //
  // ── Y LO QUE NO SE PUEDE PERDER AL SACARLOS ───────────────────────────────
  //
  // La señal de que la serie está corriendo. Si desapareciera del todo, el closer podría llamar
  // encima de un robot que ya está persiguiendo a esa persona. Sigue viva donde corresponde: el
  // ícono ⏱ de la fila, que es un HECHO del contacto y no una tarea. Por eso esta prueba comprueba
  // las dos mitades — fuera de la cola, presente en el ícono — y no solo la ausencia.
  // ═══════════════════════════════════════════════════════════════════════════
  await limpiar();
  const marca = randomUUID().slice(0, 6);

  const automaticos: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    automaticos.push(await contacto(`s${i}-${marca}`, ['seguimiento_recupero']));
  }
  // Y uno urgente, que SÍ suma: sin él, un contador en cero pasaría por casualidad.
  await contacto(`su-${marca}`, ['bot_desactivado_appflow']);

  const c = await colas();
  assert.deepEqual(
    c.seguimientos.map((s) => s.fila.id),
    [],
    'un seguimiento automático entró a la cola: eso lo corre el CRM, no es trabajo de esta pantalla',
  );
  assert.equal(
    c.tareasPendientes,
    1,
    `el contador dice ${c.tareasPendientes}: solo el urgente pide manos`,
  );

  // La otra mitad: el ícono del contacto lo sigue diciendo, en la fila, en cualquier cola.
  const urgente = c.urgentes[0];
  assert.ok(urgente, 'el urgente no llegó, así que no hay fila que mirar');
  const conSerie = await conOrganizacion(alfa, () => filaDeContacto(automaticos[0]!));
  assert.equal(
    conSerie?.iconos.seguimientoAbierto,
    true,
    'el ícono ⏱ se apagó junto con la cola: la señal de que la serie corre se perdió entera, y el ' +
      'closer puede llamar encima de un robot que ya está persiguiendo a esa persona',
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
  /* EL NOMBRE HUMANO, y esta aserción fijaba el enum crudo (`'venta'`). Lo cambió el arreglo de la
     jerga: la pantalla imprime este campo tal cual, así que acá decía «registrado como
     **acuerdo_sin_pago**» delante de un cliente. Sale de `SALIDAS`, el mismo catálogo que valida el
     servidor, para que no haya una segunda tabla de traducción que quede vieja. */
  assert.equal(c.completadas[0]!.completadaPor, 'Venta', 'no dice qué la completó, o volvió a la jerga');
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

  const ck = await conOrganizacion(alfa, () => cockpitDelMes(ZONA, 0, quien));

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
      /* CON AUTOR, y es lo que cambio: el cockpit ahora suma solo lo del closer designado, asi que
         un resultado sin `registrado_por` —que la 011 admite: *"Nulo = Sistema"*— no entra en el
         de nadie. Antes esta fila contaba igual porque la consulta no miraba de quien era. */
      .values({ contacto_id: id, salida: 'no_show', rol: 'closer', registrado_por: quien } as never)
      .execute();
  });

  const ck = await conOrganizacion(alfa, () => cockpitDelMes(ZONA, 0, quien));
  assert.equal(ck.cobrado.valor, 0, 'con resultados registrados, el cobrado tiene que ser un cero medido');
  assert.equal(ck.cobrado.falta, undefined, 'un cero medido no lleva texto de "falta"');
  assert.equal(ck.ventas.valor, 0);
});

test('el cockpit recibe el contador de tareas, no lo recalcula', async () => {
  // El `01`: *"si dos pantallas muestran el mismo número, comparten la función que lo calcula"*.
  // El contador tiene una regla propia —los automáticos no suman— y recalcularlo acá sería una
  // segunda implementación de esa regla.
  await limpiar();
  const ck = await conOrganizacion(alfa, () => cockpitDelMes(ZONA, 7, quien));
  assert.equal(ck.tareasPendientes.valor, 7, 'el cockpit recalculó el contador en vez de recibirlo');
});


// ─── 8 · El buzon se VACIA: la quinta condicion ─────────────────────────────

test('LA PRUEBA: al contacto que YA le respondimos, el buzón lo suelta', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // EL DEFECTO QUE ESTO CIERRA, Y NO HABÍA NINGUNA PRUEBA QUE LO MIRARA
  //
  // La quinta condición del buzón nunca se implementó. El comentario que estaba en `miDia.ts` lo
  // confesaba a media voz —*«`resueltoEl` todavía no existe como columna … así que hoy la condición
  // se reduce a "escribió"»*— mientras el encabezado de arriba seguía describiendo el mecanismo
  // completo de dos fechas.
  //
  // O sea que el buzón era ACUMULATIVO: un contacto que escribió una vez se quedaba ahí para
  // siempre y sumaba al contador de tareas pendientes en cada ciclo de diez segundos. No fallaba
  // nada. El badge simplemente crecía hasta dejar de significar algo.
  //
  // Se pidió así: *«solo debe estar cuando el último mensaje es de ellos y no nuestro»*.
  // ═══════════════════════════════════════════════════════════════════════════
  await limpiar();
  const id = await contacto(`bz-${randomUUID().slice(0, 6)}`, []);

  // 1 · Escribe él → entra.
  await mensaje(id, 'entrante', new Date(Date.now() - 60_000), 'hola, sigo interesado');
  let c = await colas();
  assert.equal(c.buzon.length, 1, 'un contacto que escribió y nadie atendió NO está en el buzón');
  assert.equal(c.buzon[0]?.fila.id, id);
  assert.equal(c.tareasPendientes, 1, 'el buzón no suma al contador');

  // 2 · Le respondemos → sale. **Es lo que antes no pasaba nunca.**
  await mensaje(id, 'saliente', new Date(), 'te escribo ahora');
  c = await colas();
  assert.deepEqual(
    c.buzon.map((b) => b.fila.id),
    [],
    'le respondimos y el contacto SIGUE en el buzón: la cola es acumulativa y el contador crece ' +
      'con cada persona que escribió alguna vez',
  );
  assert.equal(c.tareasPendientes, 0, 'sigue sumando al contador después de responder');

  // 3 · Vuelve a escribir → entra de nuevo, solo, sin que nadie lo reabra.
  await mensaje(id, 'entrante', new Date(Date.now() + 60_000), 'una cosa más');
  c = await colas();
  assert.equal(
    c.buzon.length,
    1,
    'volvió a escribir y no reapareció: con dos fechas eso sale gratis, y es la mitad de la regla',
  );
});

test('responder DESDE EL CRM también lo saca, y es la mitad del pedido', async () => {
  // *«respondidos por nuestra parte, o de nuestra plataforma y/o de cualquier lado»*.
  //
  // Ésta es la prueba que descarta el diseño alternativo. Un «sello de resolución» escrito por esta
  // plataforma —que es lo que el comentario viejo prometía— habría dejado en el buzón a TODO el que
  // se atendió desde el CRM, que es donde el equipo trabaja la mitad del tiempo.
  //
  // Funciona porque las dos vías escriben en `negocio.mensajes` con su dirección: el envío propio
  // por `app/api/contactos/[id]/mensajes/route.ts` y la respuesta del CRM por `lib/negocio/ingesta.ts`.
  // La cola no pregunta de dónde vino; pregunta de quién es el último mensaje.
  await limpiar();
  const id = await contacto(`crm-${randomUUID().slice(0, 6)}`, []);
  await mensaje(id, 'entrante', new Date(Date.now() - 120_000));
  assert.equal((await colas()).buzon.length, 1);

  // Un saliente con autor `agente`: así entra una respuesta hecha en el CRM por la ingesta.
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('mensajes')
      .values({
        ghl_mensaje_id: `crm-${randomUUID()}`,
        contacto_id: id,
        direccion: 'saliente',
        autor: 'agente',
        cuerpo: 'respondido desde el CRM',
        enviado_el: new Date(),
      } as never)
      .execute();
  });

  assert.deepEqual(
    (await colas()).buzon.map((b) => b.fila.id),
    [],
    'una respuesta hecha en el CRM no saca al contacto del buzón',
  );
});

test('un contacto NO está en el buzón y en «Completadas hoy» a la vez', async () => {
  // La regla «un contacto, una cola» estaba declarada en el encabezado de `miDia.ts` y sólo se
  // cumplía entre Urgentes y Buzón. El caso que la regla venía a evitar era justamente éste:
  // registrar un resultado lo pone en Completadas **y** lo deja en el buzón, así que atender una
  // cola no cierra la otra y el closer trabaja el mismo caso dos veces sin saberlo.
  await limpiar();
  const id = await contacto(`dos-${randomUUID().slice(0, 6)}`, []);
  await mensaje(id, 'entrante', new Date(Date.now() - 60_000));
  assert.equal((await colas()).buzon.length, 1, 'no entró al buzón, así que la prueba no prueba nada');

  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('resultados')
      .values({ contacto_id: id, salida: 'no_show', rol: 'closer', registrado_por: quien } as never)
      .execute();
  });

  const c = await colas();
  assert.equal(c.completadas.length, 1, 'el resultado de hoy no llegó a «Completadas hoy»');
  assert.deepEqual(
    c.buzon.map((b) => b.fila.id),
    [],
    'el contacto está en el buzón Y en completadas: atender una cola no cierra la otra',
  );
});

test('sin saliente nunca, el contacto se queda: no se sale por defecto', async () => {
  // La otra mitad, y la que impide que el arreglo se convierta en «el buzón siempre está vacío».
  // Un `null` en `ultimo_saliente_el` significa que nadie le escribió NUNCA, y eso tiene que dejarlo
  // adentro. Si `leRespondieron` devolviera `true` ante el nulo, la cola se vaciaría entera y el
  // síntoma sería idéntico a que funcione: una lista corta y sin errores.
  await limpiar();
  const id = await contacto(`nn-${randomUUID().slice(0, 6)}`, []);
  await mensaje(id, 'entrante', new Date(Date.now() - 60_000));

  const fila = await unaFila<{ ultimo_saliente_el: Date | null }>(
    admin,
    'select ultimo_saliente_el from negocio.contactos where id = $1',
    [id],
  );
  assert.equal(fila?.ultimo_saliente_el, null, 'el sello del saliente no está nulo: la prueba no aplica');
  assert.equal((await colas()).buzon.length, 1, 'un contacto al que nadie le respondió salió del buzón');
});

test('un seguimiento que vence HOY dice «le toca hoy», no «vencido»', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // `manual_de_hoy` ERA INALCANZABLE, Y NADIE LO NOTABA PORQUE NO FALLA
  //
  // `tareas.vence_el` es una columna `date`, así que su valor es la MEDIANOCHE de ese día. La cola
  // admite `vence_el < mañana`, o sea que toda tarea admitida tiene una medianoche que ya pasó — y
  // comparando ese instante contra `now()`, **todas salían `manual_vencido`**.
  //
  // Efecto en la pantalla: un seguimiento que toca justamente hoy se dibujaba con la píldora
  // «Vencido» en rojo. El closer lee que llegó tarde a algo a lo que no llegó tarde, todos los días.
  // Y la rama «Le toca hoy» del diccionario de la pantalla estaba escrita y muerta.
  //
  // Se compara el DÍA con el día. Esta prueba es el borde: hoy → `manual_de_hoy`; ayer → vencido.
  // ═══════════════════════════════════════════════════════════════════════════
  await limpiar();
  const marca = randomUUID().slice(0, 6);
  const hoy = await contacto(`hoy-${marca}`, []);
  const ayer = await contacto(`ayer-${marca}`, []);

  await conOrganizacion(alfa, async () => {
    // Las fechas se escriben como TEXTO `YYYY-MM-DD` y en la zona de la organización, que es lo que
    // hace `lib/negocio/avanzar.ts`. Pasar un `Date` mandaría un instante y el controlador lo
    // convertiría a UTC: en Lima, un `new Date()` de la tarde ya es el día siguiente en UTC.
    const dia = (d: number): string => {
      const f = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, dateStyle: 'short' });
      return f.format(new Date(Date.now() + d * 86_400_000));
    };
    for (const [id, cuando] of [
      [hoy, dia(0)],
      [ayer, dia(-1)],
    ] as const) {
      await datos()
        .insertInto('tareas')
        .values({ contacto_id: id, vence_el: cuando, situacion: 'seguimiento', modo: 'manual' } as never)
        .execute();
    }
  });

  const c = await colas();
  const deHoy = c.seguimientos.find((x) => x.fila.id === hoy);
  const deAyer = c.seguimientos.find((x) => x.fila.id === ayer);
  assert.ok(deHoy, 'el seguimiento que vence hoy no entró a la cola');
  assert.ok(deAyer, 'el seguimiento vencido no entró a la cola');

  assert.equal(
    deHoy.caso,
    'manual_de_hoy',
    'un seguimiento que vence HOY se marca como vencido: el closer lee que llegó tarde a algo a lo ' +
      'que no llegó tarde',
  );
  assert.equal(deAyer.caso, 'manual_vencido', 'uno de ayer dejó de contar como vencido');
  // Y los dos piden manos: el sabor cambia el color, no si hay trabajo.
  assert.ok(deHoy.pideManos && deAyer.pideManos);
});

test('un resultado del SETTER no entra a las «Completadas hoy» del closer', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // DOS AFIRMACIONES FALSAS EN UNA SOLA FILA
  //
  // La consulta filtraba solo por fecha, sin mirar el `rol` de la tabla. Así que un resultado del
  // setter de hoy —`agendo`, `venta_chica`— apareciía en las «Completadas hoy» del closer. Y como
  // su contacto vive en territorio setter, no está en el índice de esta pantalla: salía como fila
  // huérfana, o sea con la línea «Contacto que ya no está en el pipeline» encima de alguien que está
  // perfectamente en el pipeline del otro módulo.
  //
  // Falso que sea trabajo del closer, y falso que el contacto no esté. Y nada falla.
  // ═══════════════════════════════════════════════════════════════════════════
  await limpiar();
  const marca = randomUUID().slice(0, 6);

  // Uno del closer, para que la prueba no pase por una lista vacía.
  const mio = await contacto(`cl-${marca}`, []);
  // Y uno del setter, con su territorio, que es lo que lo vuelve huérfano acá.
  const ajeno = await contacto(`st-${marca}`, [], { territorio: 'setter' });

  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('resultados')
      .values({ contacto_id: mio, salida: 'no_show', rol: 'closer', registrado_por: quien } as never)
      .execute();
    await datos()
      .insertInto('resultados')
      .values({ contacto_id: ajeno, salida: 'agendo', rol: 'setter', registrado_por: quien } as never)
      .execute();
  });

  const c = await colas();
  assert.deepEqual(
    c.completadas.map((x) => x.fila.id),
    [mio],
    'un resultado del setter entró a las completadas del closer, y encima como fila huérfana',
  );
  // Y no queda ninguna fila huérfana por este camino.
  assert.ok(
    !c.completadas.some((x) => x.fila.nombre.includes('ya no está en el pipeline')),
    'quedó una fila huérfana: la que producía el resultado del setter',
  );
});

// ─── 9 · Responder cierra, y Avanzar cierra ─────────────────────────────────

test('responderle a alguien del buzón lo pasa a «Completadas hoy»', async () => {
  // Se pidió con estas palabras: *«cuando se envía el mensaje de aquí, se pasa directamente a la
  // casilla de completadas hoy»*.
  //
  // Antes no existía ese camino: «Completadas hoy» salía SOLO de `negocio.resultados`. Así que
  // responder sacaba al contacto del buzón —eso ya es nuevo— y no lo dejaba en ninguna parte: el
  // closer atendía a alguien y la pantalla no mostraba ni rastro de que lo hubiera hecho.
  await limpiar();
  const id = await contacto(`at-${randomUUID().slice(0, 6)}`, []);

  await mensaje(id, 'entrante', new Date(Date.now() - 120_000));
  let c = await colas();
  assert.equal(c.buzon.length, 1, 'no entró al buzón, así que la prueba no prueba nada');
  assert.equal(c.completadas.length, 0);

  await mensaje(id, 'saliente', new Date());
  c = await colas();
  assert.deepEqual(c.buzon.map((b) => b.fila.id), [], 'sigue en el buzón después de responderle');
  assert.deepEqual(
    c.completadas.map((x) => x.fila.id),
    [id],
    'le respondimos y no aparece en «Completadas hoy»: el trabajo se hizo y no consta en ninguna parte',
  );
  assert.equal(
    c.completadas[0]?.completadaPor,
    'Respondido',
    'no dice QUÉ la completó: un resultado de Avanzar y una respuesta cierran la fila por motivos ' +
      'distintos, y quien lee la columna quiere saber cuál fue',
  );
});

test('un mensaje PROACTIVO no completa nada: nunca estuvo en el buzón', async () => {
  // La condición que acota el pedido a lo que el pedido decía —*«el mensaje de AQUÍ»*, o sea del
  // buzón—. Sin ella, todo contacto al que se le escribió primero aparecería en «Completadas hoy», y
  // eso no es completar nada: es empezar una conversación.
  await limpiar();
  const id = await contacto(`pro-${randomUUID().slice(0, 6)}`, []);
  await mensaje(id, 'saliente', new Date(), 'hola, te escribo yo primero');

  const c = await colas();
  assert.deepEqual(
    c.completadas.map((x) => x.fila.id),
    [],
    'un mensaje proactivo cuenta como completado: nadie atendió nada, se empezó una conversación',
  );
  assert.deepEqual(c.buzon.map((b) => b.fila.id), [], 'y tampoco está en el buzón: no escribió él');
});

test('lo respondido AYER no queda en «Completadas hoy»: la sección se vacía a medianoche', async () => {
  // *«a medianoche se va solo»*. Sin la condición del día, «Completadas hoy» acumularía para siempre
  // a todo el que alguna vez se atendió — exactamente el defecto que tenía el buzón.
  await limpiar();
  const id = await contacto(`ay-${randomUUID().slice(0, 6)}`, []);
  await mensaje(id, 'entrante', new Date(Date.now() - 3 * 86_400_000));
  await mensaje(id, 'saliente', new Date(Date.now() - 2 * 86_400_000));

  const c = await colas();
  assert.deepEqual(
    c.completadas.map((x) => x.fila.id),
    [],
    'una respuesta de hace dos días sigue en «Completadas HOY»',
  );
  // Y tampoco volvió al buzón: le respondimos, aunque haya sido hace días.
  assert.deepEqual(c.buzon.map((b) => b.fila.id), []);
});

test('Avanzar CIERRA los seguimientos abiertos del contacto', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // `tareas.completada_el` NO TENÍA NI UN ESCRITOR EN TODO EL REPOSITORIO
  //
  // La columna existía desde la migración 011, con su índice parcial `tareas_completadas_hoy` y un
  // comentario largo que la justifica. Dos consultas la leían. Cero la escribían.
  //
  // Consecuencia, sin ningún error: un seguimiento creado por Avanzar **no se podía cerrar nunca**.
  // Se quedaba en la cola de Mi Día para siempre y mantenía el ícono ⏱ encendido para siempre. Y el
  // índice parcial no indexaba jamás ninguna fila.
  // ═══════════════════════════════════════════════════════════════════════════
  await limpiar();
  const id = await contacto(`cer-${randomUUID().slice(0, 6)}`, []);

  // Un seguimiento para hoy, como el que crea Avanzar.
  await conOrganizacion(alfa, async () => {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, dateStyle: 'short' });
    await datos()
      .insertInto('tareas')
      .values({
        contacto_id: id,
        vence_el: f.format(new Date()),
        situacion: 'seguimiento',
        modo: 'manual',
      } as never)
      .execute();
  });
  assert.equal((await colas()).seguimientos.length, 1, 'el seguimiento no entró a la cola');

  // Y ahora se registra un resultado: el seguimiento pedía «volvé a esta persona», y se volvió.
  const cerrados = await conOrganizacion(alfa, () =>
    registrarResultado(id, {
      salida: 'no_interesa',
      rol: 'closer',
      modo: null,
      detalle: 'Precio',
      monto: null,
      formaPago: null,
      nota: null,
      volverEl: null,
      quien,
    }),
  );

  assert.equal(
    cerrados.seguimientosCerrados,
    1,
    'la respuesta no dice que cerró el seguimiento: los efectos se cuentan uno por uno',
  );
  const c = await colas();
  assert.deepEqual(
    c.seguimientos.map((x) => x.fila.id),
    [],
    'el seguimiento sigue abierto después de registrar el resultado que pedía',
  );
  // Y el ícono se apaga con él, que es la mitad que se veía en todas las listas.
  const fila = await conOrganizacion(alfa, () => filaDeContacto(id));
  assert.equal(fila?.iconos.seguimientoAbierto, false, 'el ícono ⏱ quedó encendido para siempre');
});

test('un Avanzar CON fecha nueva no cierra la tarea que acaba de crear', async () => {
  // El orden dentro de la transacción, y es la clase de defecto que solo se ve pensándolo: si el
  // cierre corriera DESPUÉS del `insert`, el `update` no tendría forma de distinguir la tarea nueva
  // de las viejas —las dos están abiertas— y cerraría la que acaba de crear.
  //
  // El síntoma sería «puse una fecha y el seguimiento no aparece», sin ningún error.
  await limpiar();
  const id = await contacto(`ord-${randomUUID().slice(0, 6)}`, []);
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, dateStyle: 'short' });

  const r = await conOrganizacion(alfa, () =>
    registrarResultado(id, {
      salida: 'seguimiento',
      rol: 'closer',
      // La única salida con modos. `manual` es la que escribe la tarea en `negocio.tareas`.
      modo: 'manual',
      detalle: 'Muy interesado',
      monto: null,
      formaPago: null,
      nota: null,
      volverEl: f.format(new Date()),
      quien,
    }),
  );
  assert.equal(r.tarea, true, 'no se creó la tarea, así que la prueba no prueba nada');
  assert.equal(r.seguimientosCerrados, 0, 'no había ninguno abierto que cerrar');

  assert.equal(
    (await colas()).seguimientos.length,
    1,
    'el seguimiento que Avanzar acaba de crear se cerró solo: el cierre corre después del insert',
  );
});
