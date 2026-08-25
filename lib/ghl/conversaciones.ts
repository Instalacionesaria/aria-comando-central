// Las conversaciones y los mensajes de GoHighLevel.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA RESTRICCIÓN CENTRAL, MEDIDA: NO SE PUEDE FILTRAR, ASÍ QUE SE ORDENA
//
// `GET /conversations/search` **ignora el filtro por etiqueta**. Contra la subcuenta real devuelve
// `total: 15808` conversaciones — la cuenta entera— y nuestros contactos son 239.
//
// Traerlas todas para quedarse con el 1,5 % costaría 159 llamadas por ciclo. Así que el diseño no
// las filtra: **las ordena**.
//
//   `sortBy=last_message_date&sort=asc` + `startAfterDate=<marca de agua>`
//
// ── Y POR QUÉ `asc` Y NO `desc`, QUE ES LO QUE PARECE ───────────────────────
//
// Con `desc` la marca de agua **no se puede mantener**: si la página se llena sin llegar a la marca,
// queda un hueco por debajo de lo traído que ya no es alcanzable —la página siguiente sigue bajando,
// pero nada garantiza que se llegue antes de agotar el tope—. Ese hueco son mensajes que nunca se
// van a ingerir y **nada lo señala**.
//
// Con `asc` la marca **solo avanza sobre trabajo terminado**: se procesa en orden y se guarda la
// fecha de la última conversación completada. Truncar es gratis — lo que quedó se toma el ciclo que
// viene, desde exactamente donde se cortó.
//
// El territorio se filtra **en memoria** contra nuestros contactos: una consulta por ciclo, contra
// las 159 llamadas que costaría hacerlo del otro lado.
//
// ── `startAfterDate` ES EXCLUYENTE, Y ESO HAY QUE SABERLO ───────────────────
//
// Medido: pasando la fecha de una conversación conocida, **esa conversación no vuelve**. Es `>` y no
// `>=`. Bien: guardar la marca en la última procesada no la reprocesa. Y mal si alguien la usara
// como «desde», porque perdería el primer elemento — por eso `marca_el` se documenta como *«todo lo
// anterior o igual ya fue ingerido»* y no como «desde acá».
// ═══════════════════════════════════════════════════════════════════════════════

import { pedirExterno } from '../http/cliente.ts';
import type { FalloDeGhl, ResultadoDeGhl } from './cliente.ts';

const BASE = 'https://services.leadconnectorhq.com';

/**
 * La versión de la familia de conversaciones. La especificación la declara **obligatoria** y con un
 * único valor posible, así que no hay nada que elegir.
 *
 * Medido: el endpoint responde igual mandando la versión de contactos, pero eso no es una licencia
 * para mandar cualquiera. Una `Version` equivocada en este proveedor **no devuelve un error**:
 * devuelve otra forma de respuesta, y el síntoma sería un chat vacío sin ningún fallo.
 */
const VERSION = '2021-04-15';

/** El tope por página. La especificación dice que el valor por omisión es 20; se pide el máximo. */
const POR_PAGINA = 100;

function cabeceras(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Version: VERSION, Accept: 'application/json' };
}

/**
 * Traduce el fallo. Es la misma lógica que `cliente.ts`, y está repetida a propósito: exportarla de
 * allá para acá ataría dos módulos por su parte más volátil, y son doce líneas.
 */
function traducirFallo(
  r: { tipo: 'sin_respuesta'; causa: string } | { tipo: 'rechazado'; estado: number; codigo: string },
): FalloDeGhl {
  if (r.tipo === 'sin_respuesta') return { tipo: 'sin_respuesta', causa: r.causa };
  if (r.estado === 401 || r.estado === 403) return { tipo: 'no_autorizado', estado: r.estado };
  if (r.estado === 429) return { tipo: 'demasiadas_peticiones', estado: r.estado };
  return { tipo: 'rechazado', estado: r.estado, codigo: r.codigo };
}

/**
 * Instante desde lo que sea que haya mandado el proveedor.
 *
 * ── LAS DOS FORMAS CONVIVEN EN LA MISMA RESPUESTA, Y ESTÁ MEDIDO ────────────
 *
 * `lastMessageDate` de una conversación viene como **época en milisegundos** (número), y
 * `dateAdded` de un mensaje como **texto ISO**. Un lector que asuma una sola de las dos funciona
 * perfecto en la mitad del código y devuelve fechas de 1970 en la otra mitad.
 *
 * Los segundos se distinguen de los milisegundos por magnitud: 1e11 ms son 1973, así que cualquier
 * fecha real de este sistema en milisegundos está por encima y cualquiera en segundos por debajo.
 */
export function aInstante(v: unknown): Date | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return new Date(v < 1e11 ? v * 1000 : v);
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n) && v.trim() === String(n)) return new Date(n < 1e11 ? n * 1000 : n);
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ─── Conversaciones ─────────────────────────────────────────────────────────

export interface ConversacionDeGhl {
  id: string;
  contactId: string | null;
  /** Cuándo fue la última actividad. Es el valor que ordena y el que va a la marca de agua. */
  ultimaEl: Date | null;
  /**
   * El texto del último mensaje, **que la búsqueda ya trae**.
   *
   * No es un detalle: gracias a esto el Buzón y la ventana de 24 horas se pueden mantener con **una
   * sola llamada por ciclo**. Sin él, saber qué dice el último mensaje de cada conversación costaría
   * una llamada más por conversación tocada.
   */
  ultimoTexto: string | null;
  /** `inbound` / `outbound`. Es lo que decide si la ventana de 24 horas se reabre. */
  ultimaDireccion: string | null;
  ultimoTipo: string | null;
}

export interface PaginaDeConversaciones {
  conversaciones: ConversacionDeGhl[];
  /** Cuántas hay en total según el proveedor. `null` = no lo dijo, que no es lo mismo que cero. */
  total: number | null;
}

/**
 * Las conversaciones de la subcuenta, de la más vieja a la más nueva.
 *
 * @param desde La marca de agua. **Excluyente**: devuelve lo estrictamente posterior.
 */
export async function buscarConversaciones(
  acceso: { token: string; locationId: string },
  opciones: { desde?: Date | null; limite?: number; contactId?: string } = {},
): Promise<ResultadoDeGhl<PaginaDeConversaciones>> {
  const q = new URLSearchParams({
    locationId: acceso.locationId,
    sortBy: 'last_message_date',
    sort: 'asc',
    limit: String(opciones.limite ?? POR_PAGINA),
    // Todas, no solo las no leídas: que alguien las haya abierto en el CRM no cambia si nosotros
    // las ingerimos.
    status: 'all',
  });
  // La marca va en la misma unidad en la que viene `lastMessageDate` —época en milisegundos—,
  // porque la especificación dice que tiene que contener «el valor de ordenamiento del último».
  if (opciones.desde) q.set('startAfterDate', String(opciones.desde.getTime()));
  if (opciones.contactId) q.set('contactId', opciones.contactId);

  const r = await pedirExterno<{ conversations?: unknown; total?: unknown }>(
    `${BASE}/conversations/search?${q.toString()}`,
    { cabeceras: cabeceras(acceso.token) },
  );
  if (r.tipo !== 'datos') return { tipo: 'fallo', fallo: traducirFallo(r) };

  const crudas = Array.isArray(r.datos?.conversations) ? r.datos.conversations : [];
  return {
    tipo: 'datos',
    datos: {
      conversaciones: crudas.map(leerConversacion),
      total: typeof r.datos?.total === 'number' ? r.datos.total : null,
    },
  };
}

export function leerConversacion(c: unknown): ConversacionDeGhl {
  const o = (c ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    contactId: texto(o.contactId),
    ultimaEl: aInstante(o.lastMessageDate),
    ultimoTexto: texto(o.lastMessageBody),
    ultimaDireccion: texto(o.lastMessageDirection),
    ultimoTipo: texto(o.lastMessageType),
  };
}

// ─── Mensajes ───────────────────────────────────────────────────────────────

export interface MensajeDeGhl {
  id: string;
  conversacionId: string | null;
  contactId: string | null;
  cuerpo: string | null;
  /** `inbound` / `outbound`, tal cual lo manda el proveedor. */
  direccion: string | null;
  /** `TYPE_WHATSAPP`, `TYPE_SMS`, … o un `TYPE_ACTIVITY_*` que **no es un mensaje**. */
  tipo: string | null;
  /** Por dónde salió: `WhatsApp`, `SMS`, … Sale de `from`, no del tipo. Ver `leerMensaje`. */
  canal: string | null;
  estado: string | null;
  enviadoEl: Date | null;
  /** Quién lo mandó del lado del CRM. Medido: viene `''` y no nulo cuando no hay nadie. */
  usuarioId: string | null;
}

export interface PaginaDeMensajes {
  mensajes: MensajeDeGhl[];
  /** El identificador para pedir la página anterior, si el proveedor dijo que hay más. */
  ultimoId: string | null;
  hayMas: boolean;
}

/**
 * Los mensajes de una conversación.
 *
 * ── LA RESPUESTA VIENE ANIDADA DOS VECES, Y LA ESPECIFICACIÓN DICE OTRA COSA ─
 *
 * La especificación describe `{ messages: [...], lastMessageId, nextPage }`. Lo medido contra la
 * subcuenta real es `{ messages: { messages: [...], lastMessageId, nextPage } }`.
 *
 * Se leen **las dos formas**. Un lector escrito contra el papel devolvería una lista vacía sin que
 * nada falle, que es el peor modo de falla que tiene este proyecto: `lib/http/cliente.ts` existe
 * entero por eso — *"nadie reporta un error de algo que simplemente no tiene datos"*.
 */
export async function mensajesDeConversacion(
  acceso: { token: string },
  conversacionId: string,
  opciones: { limite?: number; anteriores_a?: string } = {},
): Promise<ResultadoDeGhl<PaginaDeMensajes>> {
  const q = new URLSearchParams({ limit: String(opciones.limite ?? POR_PAGINA) });
  if (opciones.anteriores_a) q.set('lastMessageId', opciones.anteriores_a);

  const r = await pedirExterno<Record<string, unknown>>(
    `${BASE}/conversations/${encodeURIComponent(conversacionId)}/messages?${q.toString()}`,
    { cabeceras: cabeceras(acceso.token) },
  );
  if (r.tipo !== 'datos') return { tipo: 'fallo', fallo: traducirFallo(r) };

  const interno = sobreDeLaLista(r.datos);
  const lista = Array.isArray(interno.messages) ? interno.messages : [];

  return {
    tipo: 'datos',
    datos: {
      mensajes: lista.map(leerMensaje),
      ultimoId: texto(interno.lastMessageId),
      hayMas: interno.nextPage === true,
    },
  };
}

/**
 * Abre el sobre de la lista de mensajes. **Exportada para poder probarla**: es el punto donde el
 * papel y la realidad no coinciden, y equivocarse acá no rompe nada — devuelve vacío.
 *
 * Medido: `{ messages: { messages: [...], lastMessageId, nextPage } }`.
 * Especificación: `{ messages: [...], lastMessageId, nextPage }`.
 *
 * Se aceptan las dos: si algún día el proveedor se alinea con su papel, esto sigue andando.
 */
export function sobreDeLaLista(raiz: unknown): Record<string, unknown> {
  const o = (raiz ?? {}) as Record<string, unknown>;
  return o.messages !== null && typeof o.messages === 'object' && !Array.isArray(o.messages)
    ? (o.messages as Record<string, unknown>)
    : o;
}

/**
 * El estado de UN mensaje. Es lo que usa la tercera pasada para descubrir que un envío que el CRM
 * aceptó terminó rechazado por el canal minutos después.
 */
/**
 * Los rechazos que significan **«ese mensaje no existe»** y no «no pude preguntar».
 *
 * ── MEDIDO, Y NO ES EL QUE PARECE ───────────────────────────────────────────
 *
 * Pidiendo un identificador inventado, el proveedor contesta **400**, no 404. Tratar solo el 404
 * como «no existe» dejaría los identificadores fabricados dando vueltas en la cola de entregas para
 * siempre: dos llamadas por ciclo, indefinidamente, sin que la cola se vacíe nunca — que es
 * exactamente el defecto que la columna `id_fabricado` existe para prevenir.
 *
 * Se incluye el 404 igual aunque no se haya visto: es la respuesta natural para este caso y
 * tratarla como «no existe» no puede hacer daño.
 */
const NO_EXISTE = [400, 404];

export async function estadoDeMensaje(
  acceso: { token: string },
  mensajeId: string,
): Promise<ResultadoDeGhl<MensajeDeGhl | null>> {
  const r = await pedirExterno<Record<string, unknown>>(
    `${BASE}/conversations/messages/${encodeURIComponent(mensajeId)}`,
    { cabeceras: cabeceras(acceso.token) },
  );
  if (r.tipo === 'rechazado' && NO_EXISTE.includes(r.estado)) {
    // Que el CRM no lo conozca es un HECHO medido, no un fallo: la fila nuestra existe y la suya
    // no. Devolver un fallo acá haría que la pasada lo reintentara para siempre.
    return { tipo: 'datos', datos: null };
  }
  if (r.tipo !== 'datos') return { tipo: 'fallo', fallo: traducirFallo(r) };

  // ── LA RESPUESTA VIENE ENVUELTA, Y LA ESPECIFICACIÓN DICE QUE NO ──────────
  //
  // El papel describe el mensaje en la raíz. Lo medido es `{ message: {…}, traceId }`.
  //
  // Leyendo la raíz **no falla nada**: devuelve un mensaje con todos los campos en nulo, o sea
  // «estado desconocido» para todos los salientes, para siempre. La pasada de entregas no
  // resolvería ni uno y seguiría gastando llamadas. Es el modo de falla del `07` § 2 otra vez:
  // *"nadie reporta un error de algo que simplemente no tiene datos"*.
  return { tipo: 'datos', datos: leerMensaje(sobreDelMensaje(r.datos)) };
}

/**
 * Abre el sobre de UN mensaje. Medido: `{ message: {…}, traceId }`; la especificación lo pone en la
 * raíz. **Exportada para poder probarla**, y es la que más lo necesita: leyendo la raíz no falla
 * nada — devuelve un mensaje con todos los campos nulos, o sea «estado desconocido» para todos los
 * salientes, para siempre.
 */
export function sobreDelMensaje(raiz: unknown): Record<string, unknown> {
  const o = (raiz ?? {}) as Record<string, unknown>;
  return o.message !== null && typeof o.message === 'object' && !Array.isArray(o.message)
    ? (o.message as Record<string, unknown>)
    : o;
}

export function leerMensaje(m: unknown): MensajeDeGhl {
  const o = (m ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    conversacionId: texto(o.conversationId),
    contactId: texto(o.contactId),
    cuerpo: texto(o.body),
    direccion: texto(o.direction),
    // `messageType` es el nombre en texto; `type` es un número interno del proveedor y no sirve.
    tipo: texto(o.messageType),
    // ── EL CANAL NO ESTÁ EN EL TIPO, Y ESO SORPRENDE ──────────────────────
    //
    // Medido: un WhatsApp llega con `messageType: "TYPE_CUSTOM_SMS"`. Quien quiera saber por dónde
    // salió tiene que mirar `from`, que en ese mismo mensaje dice `"WhatsApp"`. Deducir el canal
    // del tipo pondría todos los WhatsApp en la columna de SMS.
    canal: texto(o.from) ?? texto(o.messageType),
    estado: texto(o.status),
    enviadoEl: aInstante(o.dateAdded),
    usuarioId: texto(o.userId),
  };
}

/**
 * Texto o `null`. **La cadena vacía cuenta como ausencia**, y no es un capricho: medido, `userId`
 * viene `''` cuando no hay nadie asignado. Sin esto, «lo mandó un usuario del CRM» sería cierto para
 * todos los mensajes automáticos.
 */
function texto(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

// ─── Envío ──────────────────────────────────────────────────────────────────

/** Los canales por los que esta aplicación manda. Del enumerado documentado de `type`. */
export type CanalDeEnvio = 'WhatsApp' | 'SMS';

export interface EnvioAceptado {
  /** El identificador del mensaje en el CRM. **Puede no venir**, y por eso es anulable. */
  mensajeId: string | null;
  conversacionId: string | null;
}

/**
 * Manda un mensaje.
 *
 * ── LO QUE ESTA RESPUESTA **NO** SIGNIFICA ──────────────────────────────────
 *
 * Que devuelva bien significa que **el CRM lo aceptó**, no que el contacto lo recibió. El defecto
 * que originó todo este bloque es exactamente ése: la llamada devolvió éxito y el canal rechazó el
 * mensaje después. Por eso lo que se guarda acá nace `en_curso` y no «entregado», y por eso existe
 * la tercera pasada.
 *
 * ── EL IDENTIFICADOR PUEDE FALTAR ───────────────────────────────────────────
 *
 * `messageId` está declarado en la respuesta pero no es seguro que venga. Cuando falta, quien llama
 * fabrica uno y marca `id_fabricado`: sin esa marca, la pasada de entregas preguntaría por un
 * identificador inexistente **dos llamadas por ciclo para siempre**, y la cola no se vaciaría nunca.
 *
 * ── `sin_confirmar` ─────────────────────────────────────────────────────────
 *
 * Este endpoint **no se midió**: hacerlo manda un mensaje real a una persona real. Lo de acá sale de
 * la especificación. Se manda el conjunto mínimo —`type`, `contactId`, `message`—; la especificación
 * declara además `subType` y `status` como obligatorios, lo cual es dudoso para un envío (`status`
 * es el resultado, no una entrada) y mandar un `status` inventado sería afirmar una entrega que no
 * ocurrió. Si el proveedor los exige de verdad, el rechazo va a decirlo con su código y su detalle.
 */
export async function enviarMensaje(
  acceso: { token: string },
  envio: { contactId: string; texto: string; canal: CanalDeEnvio },
): Promise<ResultadoDeGhl<EnvioAceptado>> {
  const r = await pedirExterno<Record<string, unknown>>(`${BASE}/conversations/messages`, {
    metodo: 'POST',
    cabeceras: cabeceras(acceso.token),
    cuerpo: { type: envio.canal, contactId: envio.contactId, message: envio.texto },
  });
  if (r.tipo !== 'datos') return { tipo: 'fallo', fallo: traducirFallo(r) };

  const o = (r.datos ?? {}) as Record<string, unknown>;
  const ids = Array.isArray(o.messageIds) ? o.messageIds : [];
  return {
    tipo: 'datos',
    datos: {
      mensajeId: texto(o.messageId) ?? (ids.length > 0 ? texto(ids[0]) : null),
      conversacionId: texto(o.conversationId),
    },
  };
}
