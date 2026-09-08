// El estado de entrega de un mensaje, y su clasificación.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTE MÓDULO EXISTE PARA IMPEDIR, Y OCURRIÓ
//
// Un mensaje se mandó, la aplicación lo dio por enviado, **y nunca llegó**. En el CRM estaba en
// rojo: *"pasaron más de 24 horas desde que el cliente respondió"*.
//
//   **La llamada había devuelto éxito.** El CRM acepta el mensaje, le crea su fila, y **recién
//   después** el canal lo rechaza. Un `si (falló)` no puede ver eso: para cuando el fallo existe,
//   la respuesta ya se contestó.
//
//   **El estado de entrega no es un valor de retorno: es un hecho que evoluciona.**
//
// De ahí sale todo: un saliente propio nace **pendiente**, no «enviado»; el estado real se guarda
// sobre la fila que ya existe; y hay una pasada que lo va a buscar, porque un mensaje que falla
// minutos después **no cambia la fecha de la conversación** y ninguna otra vía lo volvería a mirar.
//
// ── LOS VALORES SON DEL CRM, MEDIDOS ────────────────────────────────────────
//
// Contra la subcuenta real, 65 mensajes de cuatro conversaciones:
//
//   `delivered` 43 · ausente 12 · `read` 9 · `completed` 2 · `sent` 1
//
// Que 12 de 65 vengan **sin estado** es lo que hace que nulo sea el caso normal y no una
// excepción. Un mensaje sin estado no es un mensaje fallido: es uno del que el canal no dijo nada.
//
// El resto del vocabulario sale de la especificación de `GET /conversations/messages/{id}`, que
// enumera los doce valores posibles de `status`. **No se inventó ninguno**: el catálogo de abajo es
// esa lista, marcando cuáles se vieron de verdad.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Confianza } from './contrato.ts';

/**
 * Nuestra clasificación. Cuatro valores, y el `check` de la base los sostiene.
 *
 * `desconocido` no es un error: es «el CRM nos contestó algo que no sabemos clasificar». Y eso
 * cuenta como RESUELTO —ver `EN_CURSO`— porque seguir preguntando por un valor que no entendemos es
 * gastar llamadas para siempre.
 */
export type FamiliaDeEntrega = 'en_curso' | 'entregado' | 'fallido' | 'desconocido';

/**
 * El vocabulario del CRM y del canal, con su nivel de confianza.
 *
 * `confirmado` = visto en la subcuenta real. `sin_confirmar` = está en la documentación del canal y
 * nadie lo midió acá; se clasifica igual, y si el día que aparezca la clasificación estuviera mal,
 * lo peor que pasa es que la tercera pasada lo revise una vez de más.
 */
export const ESTADOS_DE_ENTREGA: readonly {
  estado: string;
  familia: FamiliaDeEntrega;
  confianza: Confianza;
}[] = [
  // ── Vistos en la subcuenta real ──
  { estado: 'delivered', familia: 'entregado', confianza: 'confirmado' },
  { estado: 'read', familia: 'entregado', confianza: 'confirmado' },
  { estado: 'sent', familia: 'en_curso', confianza: 'confirmado' },
  // `completed` se midió acá y **no está en la lista documentada**. Se conserva igual: descartar un
  // valor que el proveedor manda de verdad porque su documentación no lo nombra sería preferir el
  // papel a la medición.
  { estado: 'completed', familia: 'entregado', confianza: 'confirmado' },

  // ── Del resto de la lista documentada, todavía sin ver acá ──
  { estado: 'pending', familia: 'en_curso', confianza: 'sin_confirmar' },
  { estado: 'scheduled', familia: 'en_curso', confianza: 'sin_confirmar' },
  { estado: 'queued', familia: 'en_curso', confianza: 'sin_confirmar' },
  { estado: 'failed', familia: 'fallido', confianza: 'sin_confirmar' },
  { estado: 'undelivered', familia: 'fallido', confianza: 'sin_confirmar' },
  // Del correo: abierto y clicado son pruebas de que llegó, más fuertes que «entregado».
  { estado: 'opened', familia: 'entregado', confianza: 'sin_confirmar' },
  { estado: 'clicked', familia: 'entregado', confianza: 'sin_confirmar' },
  // De las llamadas: la comunicación se estableció.
  { estado: 'connected', familia: 'entregado', confianza: 'sin_confirmar' },
  // El contacto se dio de baja, así que el mensaje **no le llegó**. Es un fallo y no un «en curso»:
  // volver a preguntar por él no lo va a cambiar, y mostrarlo como pendiente para siempre haría
  // creer que todavía puede salir.
  { estado: 'opt_out', familia: 'fallido', confianza: 'sin_confirmar' },
];

/**
 * De estado a familia. **Es una función total: nunca lanza y nunca devuelve nulo.**
 *
 * Esa totalidad es lo que hace segura la asimetría de la base —`estado_entrega` sin `check` y
 * `estado_entrega_familia` con `check`—. Si esto pudiera fallar sobre un valor nuevo, el `check`
 * rechazaría el `insert`, y eso **aborta la transacción y con ella el ciclo entero de ingesta**: un
 * valor nuevo del proveedor sería una caída de nuestro sistema.
 *
 * Nulo o ausente → `en_curso` y no `desconocido`, y la diferencia importa: ausente significa que
 * todavía no nos dijeron, así que la tercera pasada **tiene que volver a preguntar**. `desconocido`
 * significa que nos dijeron algo que no entendimos, y ahí no hay nada más que preguntar.
 */
export function familiaDeEntrega(estado: string | null | undefined): FamiliaDeEntrega {
  if (estado === null || estado === undefined || estado.trim() === '') return 'en_curso';
  // ── SE BUSCA EN LA LISTA, SIN TABLA DERIVADA, Y NO ES DESCUIDO ──────────
  //
  // Un `Map` armado en el nivel superior sería más rápido y **lo prohíbe `ADR-0703`**, que
  // `pruebas/codigo/70-publicacion.test.ts` hace cumplir buscando la FORMA y no el nombre: *«una
  // estructura mutable en el nivel superior de un módulo del servidor se comparte entre peticiones
  // de organizaciones distintas»*. Acá el contenido no dependería de ninguna organización, pero la
  // regla mira la forma justamente porque la intención no se puede comprobar — y agregarle una
  // excepción a la regla por doce entradas sería pagar con la regla algo que no hace falta.
  //
  // El coste real: doce comparaciones por mensaje. La ingesta procesa cientos, no millones.
  const buscado = estado.trim().toLowerCase();
  return ESTADOS_DE_ENTREGA.find((e) => e.estado === buscado)?.familia ?? 'desconocido';
}

/**
 * Las familias que la tercera pasada tiene que volver a revisar.
 *
 * **Viene del código y no de un `check` de la base**, y por eso un estado que no está en el
 * catálogo se considera resuelto: el CRM nos contestó algo, aunque no sepamos clasificarlo, y
 * preguntar de nuevo por un valor que no entendemos es gastar llamadas indefinidamente.
 */
export const EN_CURSO: readonly FamiliaDeEntrega[] = ['en_curso'];

/**
 * Los tipos de mensaje que NO son mensajes.
 *
 * ── MEDIDO, Y HABRÍA LLEGADO MAL A PRODUCCIÓN ───────────────────────────────
 *
 * `GET /conversations/{id}/messages` devuelve registros de ACTIVIDAD mezclados con los mensajes.
 * En la muestra real, **10 de 65 (15 %)**: `TYPE_ACTIVITY_OPPORTUNITY` (6),
 * `TYPE_ACTIVITY_APPOINTMENT` (3), `TYPE_ACTIVITY_EMPLOYEE_ACTION_LOG` (1).
 *
 * Y traen `body`. Uno de ellos decía literalmente `"Iiliana Diaz - ARIA "` —el título de una cita—
 * así que sin filtrarlos el chat mostraría el nombre de una cita **como si el contacto lo hubiera
 * escrito**.
 *
 * ── ES UNA LISTA DE EXCLUSIÓN, NO DE INCLUSIÓN, Y ES DELIBERADO ─────────────
 *
 * Con una lista de tipos permitidos, un canal nuevo —el día que se active Telegram, o el que Meta
 * renombre algo— **desaparecería del chat en silencio**. Con una de exclusión, un tipo de actividad
 * nuevo aparecería como mensaje: confuso, pero visible.
 *
 * De los dos errores, el peor es el primero. El `03` § 7 lo dice de los mensajes sin texto y vale
 * igual acá: cuando se descartaban, *"para el auditor ese mensaje no existió y el turno anterior
 * parecía sin respuesta"*. Un mensaje que falta es peor que un renglón de más.
 */
export const NO_SON_MENSAJES: readonly string[] = [
  // Los siete `TYPE_ACTIVITY_*` de la lista documentada. Los tres primeros se midieron acá.
  'TYPE_ACTIVITY_OPPORTUNITY',
  'TYPE_ACTIVITY_APPOINTMENT',
  'TYPE_ACTIVITY_EMPLOYEE_ACTION_LOG',
  'TYPE_ACTIVITY_CONTACT',
  'TYPE_ACTIVITY_INVOICE',
  'TYPE_ACTIVITY_PAYMENT',
  'TYPE_ACTIVITY_WHATSAPP',

  // ── Y ÉSTE NO ES UNA ACTIVIDAD, ES EL CASO INVERSO ────────────────────────
  //
  // Un comentario interno **nunca salió del edificio**: lo escribió alguien del equipo para el
  // equipo. Dibujarlo como burbuja saliente diría que le dijimos al contacto algo que no le
  // dijimos, y sobre eso se toman decisiones — «ya se le avisó, no lo llames».
  //
  // Es la única excepción a «ante la duda, se muestra», y la razón es que acá no hay duda: no es
  // un mensaje que quizás no entendemos, es uno que con seguridad no se mandó. Ese texto tiene su
  // lugar propio, que es la pestaña Notas.
  'TYPE_INTERNAL_COMMENT',
];

/**
 * Los canales que el chat muestra. **WhatsApp y SMS, y nada más.**
 *
 * ── ES UNA LISTA DE INCLUSIÓN, Y ARRIBA DICE LO CONTRARIO ───────────────────
 *
 * `NO_SON_MENSAJES` es de EXCLUSIÓN a propósito, y su motivo sigue en pie: un tipo de actividad
 * nuevo aparece como renglón confuso en vez de desaparecer en silencio. Acá se hace al revés, y no
 * por inconsistencia — las dos listas contestan preguntas distintas:
 *
 *   · aquélla: «¿esto es un mensaje o es una entrada del registro del CRM?»
 *   · ésta:    «¿este mensaje viajó por un canal que esta aplicación puede contestar?»
 *
 * Y la segunda tiene una respuesta cerrada que no depende de lo que el proveedor invente: se puede
 * mandar por **WhatsApp o SMS**, y por nada más. Lo dice el tipo `CanalDeEnvio` de
 * `lib/ghl/conversaciones.ts`, que tiene exactamente esos dos valores.
 *
 * Por eso un canal nuevo tiene que quedar AFUERA hasta que alguien lo agregue: el compositor del
 * chat abre una caja de texto que sale por WhatsApp. Mostrar ahí un correo o un mensaje de Instagram
 * invita a contestar por un canal por el que el contacto no escribió — y el closer no tiene forma de
 * notarlo, porque la burbuja se ve igual que las demás.
 *
 * ── QUÉ SE VEÍA, MEDIDO ────────────────────────────────────────────────────
 *
 * Sobre 392 mensajes de nuestros contactos (2026-09-08): **17 correos** y **9 registros de llamada**
 * se dibujaban como burbujas. Los nueve de llamada traen `body: ""`, así que salían con el marcador
 * `[mensaje sin texto]` —el que existe para los audios y las imágenes— sobre algo que no fue un
 * mensaje. El detalle completo está en `db/migraciones/040_canal_del_mensaje.sql`.
 *
 * ── LOS TRES VALORES, Y CUÁL NO ESTÁ MEDIDO ────────────────────────────────
 *
 * `TYPE_WHATSAPP` y `TYPE_CUSTOM_SMS` se midieron en la cuenta real (167 y 110). `TYPE_SMS` está
 * por la especificación y **no se vio ni una vez**: va igual porque el enumerado documentado lo
 * declara y dejarlo afuera esconde SMS de verdad. Al revés —que sobre— no cuesta nada.
 */
export const CANALES_DEL_CHAT: readonly string[] = ['TYPE_WHATSAPP', 'TYPE_CUSTOM_SMS', 'TYPE_SMS'];

/**
 * `true` si el mensaje viajó por un canal que el chat muestra.
 *
 * **Sin tipo devuelve `false`**, y acá sí es al revés que en `esUnMensaje`. No es una contradicción:
 * esta función decide si una fila **se guarda**, y sin `messageType` no se sabe el canal — guardarla
 * sería meter a la tabla del chat algo que quizá es un correo. Medido: de 392 mensajes, **ninguno**
 * llegó sin `messageType`, así que el caso no ocurre y la decisión no le cuesta nada a nadie.
 *
 * Lo que sí ocurre es el otro lado: las filas guardadas ANTES de que existiera la columna no tienen
 * tipo. Ésas las decide `lib/negocio/ficha.ts` al leer, y ahí la respuesta es la contraria —se
 * muestran— porque de ellas no hay nada que averiguar y son casi todas WhatsApp. Las dos preguntas
 * son distintas y por eso las respuestas no coinciden.
 */
export function esDeUnCanalDelChat(messageType: string | null | undefined): boolean {
  const t = String(messageType ?? '').trim();
  if (t === '') return false;
  return CANALES_DEL_CHAT.includes(t);
}

/** `true` si esto es un mensaje de verdad y no un registro de actividad del CRM. */
export function esUnMensaje(messageType: string | null | undefined): boolean {
  const t = String(messageType ?? '').trim();
  // Sin tipo se considera mensaje, por la misma razón de arriba: ante la duda, se muestra.
  if (t === '') return true;
  if (NO_SON_MENSAJES.includes(t)) return false;
  // Y el prefijo, para los tipos de actividad que todavía no existen. Los dos juntos: la lista
  // nombra lo medido y el prefijo cubre a la familia.
  return !t.startsWith('TYPE_ACTIVITY_');
}
