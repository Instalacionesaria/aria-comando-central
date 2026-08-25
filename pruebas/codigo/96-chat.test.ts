// La fusión del chat, la ventana de 24 horas y el vocabulario de entrega. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS TRES DEFECTOS QUE ESTE ARCHIVO VIGILA, Y LOS TRES OCURRIERON
//
//   1 · **Un mensaje se mandó, se dio por enviado, y nunca llegó.** La llamada devolvió éxito y el
//       canal lo rechazó después. De ahí sale que un saliente nazca en curso y no entregado.
//   2 · **El reloj de 5 segundos borraba de la pantalla lo recién escrito**, porque pisaba la lista
//       entera con la respuesta del servidor. Y el caso peor: un envío fallido desaparecía sin
//       rastro, que es justo el único que había que ver.
//   3 · **Días distintos pegados sin separador**, así que el orden correcto se leía como desorden.
//
// Ninguno de los tres da error. Los tres se ven bien mirando la pantalla un segundo. Por eso se
// comprueban acá, sin red y sin base.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTADOS_DE_ENTREGA,
  NO_SON_MENSAJES,
  esUnMensaje,
  familiaDeEntrega,
  type FamiliaDeEntrega,
} from '../../lib/ghl/entrega.ts';
import {
  conSeparadores,
  diaEnZona,
  etiquetaDeDia,
  fusionarMensajes,
  type MensajeFusionable,
} from '../../lib/negocio/chat.ts';
import { duracionCorta, VENTANA_MS, ventanaDeRespuesta } from '../../lib/negocio/ventana.ts';
import {
  aInstante,
  leerConversacion,
  leerMensaje,
  sobreDeLaLista,
  sobreDelMensaje,
} from '../../lib/ghl/conversaciones.ts';

// ─── Ayudantes ──────────────────────────────────────────────────────────────

const delServidor = (cuerpo: string, saliente = true): MensajeFusionable => ({
  id: `srv:${cuerpo}:${saliente}`,
  cuerpo,
  direccion: saliente ? 'saliente' : 'entrante',
  entrega: 'entregado',
});
const enviando = (cuerpo: string, n = 0): MensajeFusionable => ({
  id: `local:${n}`,
  cuerpo,
  direccion: 'saliente',
  envio: 'enviando',
});
const noSalio = (cuerpo: string, n = 0): MensajeFusionable => ({
  id: `local:${n}`,
  cuerpo,
  direccion: 'saliente',
  envio: 'fallido',
});
const cuerpos = (ms: MensajeFusionable[]) => ms.map((m) => m.cuerpo);

// ═══ 1 · El vocabulario de entrega ══════════════════════════════════════════

test('familiaDeEntrega es TOTAL: ningún valor la hace fallar ni devolver nulo', () => {
  // Es lo que hace segura la asimetría de la base: `estado_entrega` sin `check` y
  // `estado_entrega_familia` con `check`. Si esto pudiera devolver algo fuera de las cuatro
  // familias, el `insert` sería rechazado y eso **aborta la transacción y con ella el ciclo entero
  // de ingesta**: un valor nuevo del proveedor sería una caída de nuestro sistema.
  const FAMILIAS: FamiliaDeEntrega[] = ['en_curso', 'entregado', 'fallido', 'desconocido'];
  const raros: unknown[] = [
    null,
    undefined,
    '',
    '   ',
    'DELIVERED',
    'un_estado_que_meta_invente_manana',
    '{"json":true}',
    '../../etc/passwd',
    'a'.repeat(5000),
  ];
  for (const r of raros) {
    const f = familiaDeEntrega(r as string | null | undefined);
    assert.ok(FAMILIAS.includes(f), `«${String(r).slice(0, 20)}» devolvió ${f}`);
  }
});

test('ausente es EN CURSO y desconocido es lo que no supimos leer: no son lo mismo', () => {
  // La diferencia decide si la tercera pasada vuelve a preguntar. Ausente = todavía no nos
  // dijeron, hay que repreguntar. Desconocido = nos dijeron algo que no entendemos, y repreguntar
  // por eso es gastar llamadas para siempre.
  assert.equal(familiaDeEntrega(null), 'en_curso');
  assert.equal(familiaDeEntrega(''), 'en_curso');
  assert.equal(familiaDeEntrega('   '), 'en_curso');
  assert.equal(familiaDeEntrega('esto_no_esta_en_el_catalogo'), 'desconocido');
});

test('los cuatro estados MEDIDOS caen donde tienen que caer', () => {
  // Medidos contra la subcuenta real, 65 mensajes: delivered 43 · ausente 12 · read 9 ·
  // completed 2 · sent 1. Y `KaTK5MV9Gbp7GV8LUQtR` midió `delivered` por el endpoint de a uno.
  assert.equal(familiaDeEntrega('delivered'), 'entregado');
  assert.equal(familiaDeEntrega('read'), 'entregado');
  assert.equal(familiaDeEntrega('completed'), 'entregado');
  // `sent` NO es entregado: el canal lo aceptó, todavía no dijo que llegó. Clasificarlo como
  // entregado es exactamente el defecto original — dar por llegado lo que solo salió.
  assert.equal(familiaDeEntrega('sent'), 'en_curso');
});

test('un contacto dado de baja es FALLIDO y no queda pendiente para siempre', () => {
  // `opt_out` no va a cambiar por más que se repregunte, y mostrarlo en curso haría creer que
  // todavía puede salir.
  assert.equal(familiaDeEntrega('opt_out'), 'fallido');
  assert.equal(familiaDeEntrega('failed'), 'fallido');
  assert.equal(familiaDeEntrega('undelivered'), 'fallido');
});

test('el catálogo cubre los doce estados que la especificación enumera', () => {
  // La lista sale de `GET /conversations/messages/{id}`. Que esté completa importa porque cada
  // ausencia es un mensaje real clasificado como «desconocido», o sea: nunca más revisado.
  const DOCUMENTADOS = [
    'connected',
    'delivered',
    'failed',
    'opened',
    'pending',
    'read',
    'scheduled',
    'sent',
    'undelivered',
    'clicked',
    'opt_out',
    'queued',
  ];
  for (const e of DOCUMENTADOS) {
    assert.notEqual(
      familiaDeEntrega(e),
      'desconocido',
      `«${e}» está documentado y el catálogo no lo tiene`,
    );
  }
});

test('ningún estado del catálogo está repetido ni escrito con mayúsculas', () => {
  const vistos = new Set<string>();
  for (const e of ESTADOS_DE_ENTREGA) {
    assert.equal(e.estado, e.estado.toLowerCase(), `«${e.estado}» tiene mayúsculas`);
    assert.equal(e.estado, e.estado.trim(), `«${e.estado}» tiene espacios`);
    assert.ok(!vistos.has(e.estado), `«${e.estado}» está dos veces`);
    vistos.add(e.estado);
  }
});

// ═══ 2 · Lo que no es un mensaje ════════════════════════════════════════════

test('los registros de ACTIVIDAD no son mensajes — el 15 % de lo que llega', () => {
  // Medido: de 65 resultados del endpoint de mensajes, 10 eran actividades. Y traen `body`: uno
  // decía `"Iiliana Diaz - ARIA "`, el título de una cita. Sin filtrarlos, el chat mostraría el
  // nombre de una cita **como si el contacto lo hubiera escrito**.
  //
  // Y hay conversaciones enteras que son SOLO actividades: `kuKa80sm1lhVq8fBcwde` tiene cuatro
  // registros y ningún mensaje.
  assert.equal(esUnMensaje('TYPE_ACTIVITY_OPPORTUNITY'), false);
  assert.equal(esUnMensaje('TYPE_ACTIVITY_APPOINTMENT'), false);
  assert.equal(esUnMensaje('TYPE_ACTIVITY_EMPLOYEE_ACTION_LOG'), false);
});

test('una actividad que todavía no existe también queda afuera, por el prefijo', () => {
  assert.equal(esUnMensaje('TYPE_ACTIVITY_ALGO_QUE_INVENTEN'), false);
});

test('un comentario interno NO se dibuja como mensaje: nunca salió del edificio', () => {
  // Es la única excepción a «ante la duda, se muestra», y la razón es que no hay duda: dibujarlo
  // como burbuja saliente diría que le dijimos al contacto algo que no le dijimos.
  assert.equal(esUnMensaje('TYPE_INTERNAL_COMMENT'), false);
  assert.ok(NO_SON_MENSAJES.includes('TYPE_INTERNAL_COMMENT'));
});

test('un canal DESCONOCIDO sí se muestra: la lista es de exclusión y no de inclusión', () => {
  // Con una lista de permitidos, el día que se active un canal nuevo desaparecería del chat en
  // silencio. Un mensaje que falta es peor que un renglón de más.
  assert.equal(esUnMensaje('TYPE_TELEGRAM_QUE_NO_EXISTE_TODAVIA'), true);
  assert.equal(esUnMensaje(null), true);
  assert.equal(esUnMensaje(''), true);
  // Medido: un WhatsApp real llega con este tipo.
  assert.equal(esUnMensaje('TYPE_CUSTOM_SMS'), true);
});

// ═══ 3 · Las fechas del proveedor ═══════════════════════════════════════════

test('las dos formas de fecha conviven, y las dos se leen', () => {
  // Medido: `lastMessageDate` de una conversación viene como época en milisegundos y `dateAdded`
  // de un mensaje como texto ISO. Un lector que asuma una sola devuelve fechas de 1970 en la
  // mitad del código.
  const iso = aInstante('2025-07-30T15:40:09.000Z');
  assert.equal(iso?.toISOString(), '2025-07-30T15:40:09.000Z');

  const ms = aInstante(1753890009000);
  assert.equal(ms?.toISOString(), '2025-07-30T15:40:09.000Z');

  // Y en segundos, que es el otro formato de época que circula.
  const seg = aInstante(1753890009);
  assert.equal(seg?.toISOString(), '2025-07-30T15:40:09.000Z');
});

test('una fecha ilegible es nula y no 1970', () => {
  // 1970 se ordena antes que todo y se vería como «el mensaje más viejo de la conversación»:
  // aparecería arriba de todo en vez de ausentarse.
  assert.equal(aInstante(null), null);
  assert.equal(aInstante(''), null);
  assert.equal(aInstante('no es una fecha'), null);
  assert.equal(aInstante({}), null);
  assert.equal(aInstante(Number.NaN), null);
});

// ═══ 4 · La fusión ══════════════════════════════════════════════════════════

test('una burbuja en vuelo sobrevive al ciclo que todavía no la trae', () => {
  const r = fusionarMensajes(
    [delServidor('Hola'), delServidor('¿Cómo estás?', false)],
    [enviando('Te mando el enlace')],
  );
  assert.deepEqual(cuerpos(r), ['Hola', '¿Cómo estás?', 'Te mando el enlace']);
});

test('y se suelta en cuanto el servidor la devuelve — sin duplicarse', () => {
  const r = fusionarMensajes(
    [delServidor('Hola'), delServidor('Te mando el enlace')],
    [enviando('Te mando el enlace')],
  );
  assert.deepEqual(cuerpos(r), ['Hola', 'Te mando el enlace']);
  assert.equal(r.filter((m) => m.cuerpo === 'Te mando el enlace').length, 1);
});

test('un envío que NO salió no se borra: es lo único que dice que no llegó', () => {
  // El caso peor del defecto viejo. El servidor nunca lo tuvo, así que el reemplazo lo borraba: se
  // veía el error un segundo y después nada.
  const r = fusionarMensajes([delServidor('Hola')], [noSalio('Esto no salió')]);
  assert.deepEqual(cuerpos(r), ['Hola', 'Esto no salió']);
  assert.equal(r[1]?.envio, 'fallido');
});

test('se cuentan COPIAS y no presencia: dos «ok» seguidos son normales', () => {
  // Con un conjunto, la segunda burbuja se daba por confirmada apenas llegaba la primera del
  // servidor y desaparecía **habiendo salido de verdad**.
  const r = fusionarMensajes([delServidor('ok')], [enviando('ok', 1), enviando('ok', 2)]);
  assert.deepEqual(cuerpos(r), ['ok', 'ok']);
  assert.equal(r.filter((m) => m.envio === 'enviando').length, 1);
});

test('y cuando llegan las dos copias, no queda ninguna en vuelo', () => {
  const r = fusionarMensajes(
    [delServidor('ok'), { ...delServidor('ok'), id: 'srv:ok:2' }],
    [enviando('ok', 1), enviando('ok', 2)],
  );
  assert.equal(r.length, 2);
  assert.equal(
    r.some((m) => m.envio === 'enviando'),
    false,
  );
});

test('el espaciado no impide reconocer la burbuja: el canal normaliza el texto', () => {
  // Sin esto, un salto de línea de más al devolverlo dejaría la burbuja optimista en vuelo para
  // siempre y el mensaje se vería dos veces.
  const r = fusionarMensajes([delServidor('Hola  Marco')], [enviando('Hola\n Marco')]);
  assert.equal(r.length, 1);
});

test('un saliente ya confirmado NO se arrastra de la lista vieja', () => {
  // Duplicarlo sería lo obvio; lo peor es que dejaría en pantalla un estado viejo — un mensaje que
  // el servidor daba por en curso y que el canal rechazó después seguiría diciendo «en curso».
  const r = fusionarMensajes(
    [delServidor('Hola')],
    [delServidor('Hola'), delServidor('Algo viejo')],
  );
  assert.deepEqual(cuerpos(r), ['Hola']);
});

test('un entrante local tampoco: nunca está «en vuelo»', () => {
  const r = fusionarMensajes(
    [delServidor('Hola', false)],
    [{ id: 'x', cuerpo: 'fantasma', direccion: 'entrante', envio: 'enviando' }],
  );
  assert.deepEqual(cuerpos(r), ['Hola']);
});

test('con el servidor vacío conserva lo que está viajando', () => {
  // Conversación nueva: si esto devolviera vacío, el chat se vería en blanco justo después de
  // escribir el primer mensaje.
  assert.deepEqual(cuerpos(fusionarMensajes([], [enviando('primero')])), ['primero']);
});

test('la fusión no muta las listas que recibe', () => {
  const servidor = [delServidor('a')];
  const previos = [enviando('b')];
  fusionarMensajes(servidor, previos);
  assert.equal(servidor.length, 1);
  assert.equal(previos.length, 1);
});

// ═══ 5 · Los separadores de día ═════════════════════════════════════════════

test('el día se calcula en la zona de la EMPRESA, no en la del navegador', () => {
  // Un mensaje de las 22:00 en Lima son las 03:00 del día siguiente en UTC. Sin la zona, el
  // separador diría un día distinto del que ve quien escribió el mensaje.
  const instante = '2026-08-25T03:30:00.000Z';
  assert.equal(diaEnZona(instante, 'UTC'), '2026-08-25');
  assert.equal(diaEnZona(instante, 'America/Lima'), '2026-08-24');
});

test('una zona inválida cae a UTC en vez de tirar abajo el chat', () => {
  assert.equal(diaEnZona('2026-08-25T03:30:00.000Z', 'Marte/Olympus'), '2026-08-25');
});

test('hoy y ayer se dicen con palabras; más atrás, con la fecha', () => {
  const HOY = '2026-08-25';
  assert.equal(etiquetaDeDia('2026-08-25', HOY), 'HOY');
  assert.equal(etiquetaDeDia('2026-08-24', HOY), 'AYER');
  const vieja = etiquetaDeDia('2026-08-12', HOY);
  assert.match(vieja, /12/);
  assert.match(vieja, /2026/);
  assert.notEqual(vieja, 'HOY');
  assert.notEqual(vieja, 'AYER');
});

test('«ayer» cruza el fin de mes y el fin de año', () => {
  // Los dos bordes donde un cálculo de días a mano se equivoca.
  assert.equal(etiquetaDeDia('2026-07-31', '2026-08-01'), 'AYER');
  assert.equal(etiquetaDeDia('2025-12-31', '2026-01-01'), 'AYER');
});

test('una fecha rota se muestra cruda: inventar un día sería peor que no saberlo', () => {
  assert.equal(etiquetaDeDia('no-es-fecha', '2026-08-25'), 'no-es-fecha');
});

test('el separador aparece UNA vez por día y encabeza el primer mensaje de ese día', () => {
  // El defecto: dos días pegados sin nada en el medio, así que el orden correcto se lee como
  // desorden porque la hora «retrocede».
  const ms = [
    { id: 'a', enviadoEl: '2026-08-24T20:14:00.000Z' },
    { id: 'b', enviadoEl: '2026-08-24T22:40:00.000Z' },
    { id: 'c', enviadoEl: '2026-08-25T12:09:00.000Z' },
  ];
  const r = conSeparadores(ms, 'UTC', '2026-08-25T15:00:00.000Z');
  assert.deepEqual(
    r.map((x) => (x.tipo === 'dia' ? `[${x.texto}]` : x.mensaje.id)),
    ['[AYER]', 'a', 'b', '[HOY]', 'c'],
  );
});

test('un mensaje con fecha ilegible se dibuja igual, sin separador', () => {
  // El `03` § 7: cuando un mensaje se descartaba, «para el auditor ese mensaje no existió y el
  // turno anterior parecía sin respuesta».
  const r = conSeparadores([{ id: 'roto', enviadoEl: 'x' }], 'UTC', '2026-08-25T00:00:00.000Z');
  assert.deepEqual(
    r.map((x) => x.tipo),
    ['mensaje'],
  );
});

test('cada renglón tiene una clave distinta', () => {
  // Sin esto, React reordena burbujas al llegar un mensaje nuevo.
  const ms = [
    { id: 'a', enviadoEl: '2026-08-24T20:14:00.000Z' },
    { id: 'b', enviadoEl: '2026-08-25T12:09:00.000Z' },
  ];
  const claves = conSeparadores(ms, 'UTC', '2026-08-25T15:00:00.000Z').map((x) => x.clave);
  assert.equal(new Set(claves).size, claves.length);
});

// ═══ 6 · La ventana de 24 horas ═════════════════════════════════════════════

const AHORA = Date.parse('2026-08-25T12:00:00.000Z');

test('dentro de las 24 horas la ventana está abierta y no da motivo', () => {
  const v = ventanaDeRespuesta(new Date(AHORA - 3 * 60 * 60 * 1000), AHORA);
  assert.equal(v.abierta, true);
  assert.equal(v.motivo, null);
  assert.equal(v.restanteMs, 21 * 60 * 60 * 1000);
});

test('pasadas las 24 horas está cerrada y el motivo dice qué hacer', () => {
  // El defecto original: la aplicación mandaba igual, el CRM aceptaba, y el canal rechazaba
  // después. Este corte evita gastar la llamada y **explica** en vez de solo bloquear.
  const v = ventanaDeRespuesta(new Date(AHORA - 30 * 60 * 60 * 1000), AHORA);
  assert.equal(v.abierta, false);
  assert.ok(v.motivo && v.motivo.length > 40);
  assert.match(v.motivo, /24 horas/);
  assert.ok(v.restanteMs !== null && v.restanteMs < 0);
});

test('el borde exacto: un milisegundo antes abre, en el borde cierra', () => {
  // Un `>=` acá dejaría pasar el mensaje justo en el instante en que el canal empieza a
  // rechazarlo.
  assert.equal(ventanaDeRespuesta(new Date(AHORA - VENTANA_MS + 1), AHORA).abierta, true);
  assert.equal(ventanaDeRespuesta(new Date(AHORA - VENTANA_MS), AHORA).abierta, false);
});

test('si el contacto NUNCA escribió, la ventana está cerrada y lo dice distinto', () => {
  // No es lo mismo «venció» que «nunca hubo». La segunda necesita una plantilla aprobada, y el
  // texto tiene que mandar a hacer algo distinto.
  const v = ventanaDeRespuesta(null, AHORA);
  assert.equal(v.abierta, false);
  assert.equal(v.venceEl, null);
  assert.equal(v.restanteMs, null);
  assert.match(String(v.motivo), /todavía no escribió/);
});

test('una fecha ilegible cierra la ventana: ante la duda NO se manda', () => {
  // Dejarla abierta sería exactamente el «parece que salió» que todo esto existe para evitar.
  const v = ventanaDeRespuesta('no es una fecha', AHORA);
  assert.equal(v.abierta, false);
  assert.ok(v.motivo);
});

test('acepta la fecha como texto y como fecha, y dan lo mismo', () => {
  // La base devuelve `Date` y la respuesta HTTP devuelve texto: el mismo hecho por dos caminos.
  const comoFecha = ventanaDeRespuesta(new Date(AHORA - 60_000), AHORA);
  const comoTexto = ventanaDeRespuesta(new Date(AHORA - 60_000).toISOString(), AHORA);
  assert.deepEqual(comoTexto, comoFecha);
});

test('la duración se dice en minutos, horas y días según cuánto sea', () => {
  assert.equal(duracionCorta(45 * 60_000), '45 min');
  assert.equal(duracionCorta(3 * 3_600_000 + 20 * 60_000), '3 h 20 min');
  assert.equal(duracionCorta(3 * 3_600_000), '3 h');
  assert.equal(duracionCorta(50 * 3_600_000), '2 días');
  // Negativo = hace cuánto venció; se dice igual, sin el signo.
  assert.equal(duracionCorta(-45 * 60_000), '45 min');
});

// ═══ 7 · Los sobres del proveedor, contra respuestas REALES grabadas ════════
//
// Los tres lectores de abajo son el punto donde la especificación y la realidad no coinciden. Lo
// que los vuelve peligrosos es que equivocarse **no rompe nada**: devuelven vacío o nulo, y el
// síntoma es una pantalla sin datos que nadie reporta (`lib/http/cliente.ts`, `07` § 2).

/** Copiada tal cual de `GET /conversations/messages/KaTK5MV9Gbp7GV8LUQtR`, 2026-08-25. */
const RESPUESTA_REAL_DE_UN_MENSAJE = {
  message: {
    attachments: [],
    body: 'Hola Pity, gracias por tu interés.',
    contactId: 'VK79brZp3UdT2zkCpsAD',
    contentType: 'text/plain',
    conversationId: 'dE7ZaAlPv5ffjdBD3aWX',
    conversationProviderId: '628f88b07cf43a7641c58089',
    dateAdded: '2025-07-30T15:40:09.000Z',
    dateUpdated: '2025-07-30T15:40:12.578Z',
    direction: 'outbound',
    from: 'WhatsApp',
    id: 'KaTK5MV9Gbp7GV8LUQtR',
    locationId: 'DbWG5cimcumPcKk5p3xC',
    messageType: 'TYPE_CUSTOM_SMS',
    source: 'workflow',
    status: 'delivered',
    to: '+13053025689',
    type: 20,
    userId: 'ryxDLpnsr1ERnlFNeSfz',
  },
  traceId: '498074fd-a728-4d89-8831-7695b4609bd0',
};

test('el mensaje suelto viene ENVUELTO, y leerlo de la raíz no falla: devuelve todo nulo', () => {
  // Éste es el defecto más caro de este bloque y estuvo escrito. Leyendo la raíz, la pasada de
  // entregas vería «estado desconocido» en TODOS los salientes: no resolvería ni uno, y seguiría
  // gastando dos llamadas por ciclo para siempre.
  const mal = leerMensaje(RESPUESTA_REAL_DE_UN_MENSAJE);
  assert.equal(mal.estado, null, 'la raíz no tiene el mensaje — si esto cambia, el sobre cambió');

  const bien = leerMensaje(sobreDelMensaje(RESPUESTA_REAL_DE_UN_MENSAJE));
  assert.equal(bien.id, 'KaTK5MV9Gbp7GV8LUQtR');
  assert.equal(bien.estado, 'delivered');
  assert.equal(familiaDeEntrega(bien.estado), 'entregado');
  assert.equal(bien.direccion, 'outbound');
  assert.equal(bien.conversacionId, 'dE7ZaAlPv5ffjdBD3aWX');
  assert.equal(bien.enviadoEl?.toISOString(), '2025-07-30T15:40:09.000Z');
});

test('el CANAL sale de `from`, no del tipo: un WhatsApp llega como TYPE_CUSTOM_SMS', () => {
  // Medido, y sorprende. Deducir el canal del tipo pondría todos los WhatsApp en la columna de SMS.
  const m = leerMensaje(sobreDelMensaje(RESPUESTA_REAL_DE_UN_MENSAJE));
  assert.equal(m.tipo, 'TYPE_CUSTOM_SMS');
  assert.equal(m.canal, 'WhatsApp');
});

test('si el proveedor algún día se alinea con su papel, el sobre sigue andando', () => {
  const plano = { ...RESPUESTA_REAL_DE_UN_MENSAJE.message };
  assert.equal(leerMensaje(sobreDelMensaje(plano)).estado, 'delivered');
});

test('la lista de mensajes viene anidada DOS veces', () => {
  const real = {
    messages: { messages: [{ id: 'a' }, { id: 'b' }], lastMessageId: 'b', nextPage: false },
  };
  const sobre = sobreDeLaLista(real);
  assert.equal((sobre.messages as unknown[]).length, 2);
  assert.equal(sobre.lastMessageId, 'b');

  // Y la forma del papel también se lee.
  const papel = { messages: [{ id: 'a' }], lastMessageId: 'a', nextPage: false };
  assert.equal((sobreDeLaLista(papel).messages as unknown[]).length, 1);
});

test('un `userId` vacío es AUSENCIA, no un identificador', () => {
  // Medido: viene vacío cuando no hay nadie asignado. Sin esto, «lo mandó una persona» sería
  // cierto para todos los mensajes automáticos, y el chat atribuiría a alguien lo que hizo un
  // flujo del CRM.
  assert.equal(leerMensaje({ id: 'x', userId: '' }).usuarioId, null);
  assert.equal(
    leerMensaje({ id: 'x', userId: 'ryxDLpnsr1ERnlFNeSfz' }).usuarioId,
    'ryxDLpnsr1ERnlFNeSfz',
  );
});

test('la conversación trae el último texto y su dirección: eso es lo que ahorra una llamada', () => {
  // Copiado de `GET /conversations/search`, 2026-08-25. `lastMessageDate` es época en
  // milisegundos mientras que el mensaje trae texto ISO: las dos formas en la misma familia.
  const c = leerConversacion({
    id: 'dE7ZaAlPv5ffjdBD3aWX',
    contactId: 'VK79brZp3UdT2zkCpsAD',
    lastMessageDate: 1753890010748,
    lastMessageBody: 'Hola Pity, Gracias por tu interés',
    lastMessageDirection: 'outbound',
    lastMessageType: 'TYPE_CUSTOM_SMS',
  });
  assert.equal(c.id, 'dE7ZaAlPv5ffjdBD3aWX');
  assert.equal(c.contactId, 'VK79brZp3UdT2zkCpsAD');
  assert.equal(c.ultimaDireccion, 'outbound');
  assert.match(String(c.ultimoTexto), /Gracias por tu interés/);
  assert.equal(c.ultimaEl?.toISOString(), '2025-07-30T15:40:10.748Z');
});

test('una conversación que es SOLO actividad se reconoce sin pedir sus mensajes', () => {
  // Medido: `kuKa80sm1lhVq8fBcwde` tiene cuatro registros y ningún mensaje. En la búsqueda llega
  // con el texto y la dirección ausentes — que es lo que permite verlo sin gastar la llamada.
  const c = leerConversacion({
    id: 'kuKa80sm1lhVq8fBcwde',
    contactId: 'algo',
    lastMessageDate: 1749692000692,
    lastMessageType: 'TYPE_ACTIVITY_OPPORTUNITY',
  });
  assert.equal(c.ultimoTexto, null);
  assert.equal(c.ultimaDireccion, null);
  assert.equal(esUnMensaje(c.ultimoTipo), false);
});
