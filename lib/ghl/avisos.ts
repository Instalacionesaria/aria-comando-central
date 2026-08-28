// EL catálogo de los eventos del aviso del CRM. Una sola lista, y de ella sale todo lo demás.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ES UNA LISTA Y NO TRES
//
// El archivo equivalente de la plataforma anterior abre explicando el defecto que este archivo
// evita, y vale copiarlo entero porque ya se pagó allá:
//
//   *«Acá vivían DOS copias de los 8 strings —el tipo y el array— sin nada que las comparara, y el
//   panel de Ajustes › Webhooks necesitaba una tercera para mostrar las URLs completas.»*
//
// Tres listas del mismo hecho divergen en silencio: alguien agrega un evento al `switch` y no al
// panel, y la URL nunca se configura; o al panel y no al `switch`, y el panel ofrece una URL que
// responde 200 y no hace nada. Los dos síntomas son «el webhook no funciona» sin nada que mirar.
//
// Acá `EVENTOS_DEL_AVISO` es la única lista. El tipo, el guard y las URLs se DERIVAN de ella.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL EVENTO VIAJA EN LA URL, Y NO ES UNA PREFERENCIA
//
// La acción **Webhook estándar** de GoHighLevel —la gratuita, la que se usa— manda su payload nativo
// y **no permite editar el cuerpo JSON**. La URL sí se puede editar. Así que cada workflow se
// distingue por su parámetro:
//
//     https://<nuestro dominio>/api/avisos/crm?evento=mensaje.entrante
//
// Lo que SÍ se puede editar son las cabeceras, y de ahí sale la autenticación: `X-Webhook-Secret`.
// Está medido y fechado en la plataforma anterior (2026-08-07) y confirmado por la captura del
// workflow real que se usó para escribir esto.
//
// ── LA TRAMPA, y es el único error silencioso que la referencia documentó ────
//
// Si alguien pega la URL **sin** el `?evento=`, GoHighLevel entrega, nosotros guardamos el cuerpo,
// respondemos 200, y el aviso queda sin interpretar para siempre. No hay error, no hay reintento, y
// la pantalla no dibuja nada. Por eso el panel **nunca ofrece la URL base** y el monitor de frescura
// tiene un estado propio para «llega y no se procesa».
//
// ═══════════════════════════════════════════════════════════════════════════════
// SIETE EVENTOS, Y NO LOS NUEVE DE LA REFERENCIA
//
// Quedan afuera `serie.toque` y `serie.agotada`: piden el módulo de seguimientos automáticos, que acá
// está a medias —la etiqueta se escribe, la serie la corre el CRM y nosotros no la seguimos paso a
// paso—. Ofrecer sus URLs sería ofrecer dos puertas que guardan y no interpretan.
//
// Cuando el módulo exista, se agregan a esta lista y la prueba de paridad exige su `case`.
// ═══════════════════════════════════════════════════════════════════════════════

/** Un evento del aviso, con lo que el panel necesita para explicarlo. */
export interface EventoDelAviso {
  /** El valor del `?evento=`. Es NUESTRO vocabulario, no de GoHighLevel. */
  readonly evento: string;
  /** Cómo se llama para una persona que está configurando el workflow. */
  readonly titulo: string;
  /** Qué workflow de GoHighLevel le corresponde, y qué hace de nuestro lado. */
  readonly descripcion: string;
}

/**
 * LA lista. Todo lo demás de este archivo se deriva de acá.
 *
 * Los nombres son los de la plataforma anterior, a propósito: los workflows de la subcuenta real ya
 * apuntan a URLs con estos valores, así que cambiarlos obligaría a reconfigurar a mano cada workflow
 * de cada empresa — y el síntoma de olvidarse uno es un evento que se guarda y no se interpreta.
 */
export const EVENTOS_DEL_AVISO: readonly EventoDelAviso[] = [
  {
    evento: 'mensaje.entrante',
    titulo: 'El cliente escribió',
    descripcion:
      'Workflow con el disparador «El cliente ha respondido». Es el más importante: mueve el ' +
      'contacto al Buzón de Mi Día en segundos, en vez de esperar el próximo ciclo.',
  },
  {
    evento: 'mensaje.saliente',
    titulo: 'Se le escribió al cliente',
    descripcion:
      'Cuando el agente o alguien del equipo responde desde el CRM. Es lo que saca al contacto del ' +
      'Buzón sin esperar el ciclo: el Buzón es «el último mensaje es de ellos».',
  },
  {
    evento: 'contacto.zona_closer',
    titulo: 'Pasó a la zona del closer',
    descripcion:
      'Workflow que dispara al ponerle la etiqueta de zona del closer. Relee sus etiquetas y lo ' +
      'mueve de territorio.',
  },
  {
    evento: 'contacto.zona_setter',
    titulo: 'Pasó a la zona del setter',
    descripcion: 'Lo mismo, para la etiqueta de zona del setter.',
  },
  {
    evento: 'contacto.actualizado',
    titulo: 'Cambió algo del contacto',
    descripcion:
      'Cualquier cambio de etiquetas o de datos. Relee el contacto y recalcula su territorio, así ' +
      'que también cubre el caso de que PIERDA sus dos etiquetas de zona.',
  },
  {
    evento: 'cita.agendada',
    titulo: 'Agendó una cita',
    descripcion: 'Trae la cita a la Agenda y enciende el ícono de cita de la fila.',
  },
  {
    evento: 'cita.cancelada',
    titulo: 'Canceló la cita',
    descripcion:
      'Apaga el ícono de cita. Importa tanto como agendarla: el ícono es lo que alguien mira ' +
      'ANTES de llamar, y una cita cancelada que sigue encendida hace que no llame.',
  },
] as const;

/** Los valores válidos del `?evento=`, derivados de la lista. */
export const EVENTOS_CONOCIDOS: readonly string[] = EVENTOS_DEL_AVISO.map((e) => e.evento);

/** El tipo, derivado también: no hay una segunda lista literal que pueda divergir. */
export type EventoDelCrm = (typeof EVENTOS_DEL_AVISO)[number]['evento'];

/**
 * ¿Este `?evento=` es uno de los nuestros?
 *
 * Es un PREDICADO DE TIPO (`valor is string`) y no un `boolean`, y no es cosmética: sin eso, quien lo
 * use sigue viendo `string | null` después del guard y termina poniendo un `as string` o un `?? ''`
 * para callar al compilador — que es exactamente el lugar donde un nulo se cuela sin que nadie lo
 * note. Acá el compilador hace el trabajo.
 */
export function esEventoConocido(valor: string | null | undefined): valor is string {
  return typeof valor === 'string' && EVENTOS_CONOCIDOS.includes(valor);
}

/**
 * La URL completa que hay que pegar en el workflow de GoHighLevel.
 *
 * `encodeURIComponent` sobre el evento aunque los siete valores sean seguros: el día que alguien
 * agregue uno con un carácter raro, la URL sigue siendo válida en vez de romperse de una forma que
 * solo se ve del lado del proveedor.
 */
export function urlDelEvento(base: string, evento: string): string {
  const limpia = base.replace(/\/+$/, '');
  return `${limpia}/api/avisos/crm?evento=${encodeURIComponent(evento)}`;
}

/**
 * El identificador de la SUBCUENTA en un cuerpo de GoHighLevel, en sus tres formas.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LAS TRES FORMAS ESTÁN MEDIDAS, NO ADIVINADAS
 *
 * Contadas sobre los cuerpos reales del buzón de la plataforma anterior (1.192 filas, muestra de
 * 1.000, el 2026-08-28):
 *
 *   · **`location.id` ANIDADO** en 720 de 720 eventos de contacto y 104 de 104 de cita. **Nunca
 *     plano.** Es la forma normal, y es la que uno NO escribiría por analogía con `contactId`.
 *   · **`location_id` plano, con guion bajo** en los eventos de la plataforma de voz.
 *   · `locationId` plano se acepta porque es la forma documentada, aunque en la muestra no apareció.
 *
 * **Un lector que busque solo `payload.locationId` no encuentra el identificador en NINGUNA de las
 * tres formas.** Ése es el error concreto que esta función evita.
 *
 * ── Y NO HAY RESPALDO A `contact.id` ────────────────────────────────────────
 *
 * La plataforma anterior lo tuvo en su primera versión y lo quitó con este motivo: *«ese es el id de
 * la persona, no el de la subcuenta. Buscar una empresa por él no encuentra nada hoy, pero es la
 * clase de coincidencia que un día encuentra la empresa equivocada»*.
 *
 * ── PARA QUÉ SE USA ACÁ, QUE ES DISTINTO DE ALLÁ ────────────────────────────
 *
 * Allá esto RUTEABA: decidía de qué empresa era el evento. Acá **solo se compara**. La empresa la
 * pone el secreto de la cabecera, así que el aislamiento no depende de que el cuerpo diga la verdad;
 * este valor sirve para darse cuenta de un workflow apuntando a la URL equivocada.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export function locationIdDelCuerpo(cuerpo: unknown): string | null {
  if (cuerpo === null || typeof cuerpo !== 'object') return null;
  const o = cuerpo as Record<string, unknown>;
  const anidado = (o.location as Record<string, unknown> | undefined)?.id;
  const crudo = o.locationId ?? o.location_id ?? anidado;
  const valor = typeof crudo === 'string' || typeof crudo === 'number' ? String(crudo).trim() : '';
  return valor === '' ? null : valor;
}

/**
 * El identificador del CONTACTO, en sus formas.
 *
 * Tres, y las tres se vieron: `contactId`, `contact_id` y `contact.id`. La plataforma anterior las
 * acepta las tres con este motivo escrito: *«el día que GHL cambie de payload —ya pasó con
 * `contactId`— no quiero que se corte la ingesta entera»*.
 */
export function contactIdDelCuerpo(cuerpo: unknown): string | null {
  if (cuerpo === null || typeof cuerpo !== 'object') return null;
  const o = cuerpo as Record<string, unknown>;
  const anidado = (o.contact as Record<string, unknown> | undefined)?.id;
  const crudo = o.contactId ?? o.contact_id ?? anidado;
  const valor = typeof crudo === 'string' || typeof crudo === 'number' ? String(crudo).trim() : '';
  return valor === '' ? null : valor;
}

/**
 * El texto del mensaje, con los respaldos del payload NATIVO.
 *
 * `message` viene **objeto `{id, body}` o cadena suelta** — las dos formas se vieron, y está en el
 * manejador de la referencia con ese comentario exacto. Sin los dos respaldos, la mitad de los
 * mensajes entra con el cuerpo vacío y el chat muestra burbujas en blanco.
 *
 * El tope de 500 caracteres es el de la referencia. No es por espacio: un mensaje de WhatsApp más
 * largo que eso es una pegada de texto, y el chat lo dibuja completo desde la ingesta igual.
 */
export function textoDelMensaje(cuerpo: unknown): string {
  if (cuerpo === null || typeof cuerpo !== 'object') return '';
  const o = cuerpo as Record<string, unknown>;
  const nativo = o.message;
  const candidatos = [
    o.mensaje,
    o.body,
    typeof nativo === 'string' ? nativo : (nativo as Record<string, unknown> | undefined)?.body,
  ];
  const texto = candidatos.find((c) => typeof c === 'string' && c.trim() !== '');
  return typeof texto === 'string' ? texto.slice(0, 500) : '';
}
