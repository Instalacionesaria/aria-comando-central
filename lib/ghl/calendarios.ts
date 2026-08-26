// Los calendarios de GoHighLevel y sus citas.
//
// ═══════════════════════════════════════════════════════════════════════════════
// TODO ESTE ARCHIVO SALE DE MEDIR LA SUBCUENTA REAL. NO HAY ESPECIFICACIÓN.
//
// A diferencia de contactos y conversaciones, **no existe especificación OpenAPI de calendarios**
// en el proyecto — se comprobó archivo por archivo. Así que el contrato de acá está medido, no
// leído, y cada número de abajo salió de una llamada de verdad el 2026-08-26.
//
// ── HALLAZGO 1 · NO HAY «EL CALENDARIO». HAY NUEVE ─────────────────────────
//
// La subcuenta tiene **9 calendarios activos**: cuatro de tipo `round_robin` y cinco `personal`.
// Y la distribución es muy desigual — uno solo concentra **1052 de las 1109 citas**:
//
//   ARIA IA Accelerator | Consultoría de Diagnóstico   1052
//   Llamada de Diagnostico - Agencia AI Native            25
//   Aria - Webinar | Llamada de Descubrimiento            10
//   JORGE QUIRÓZ - CALENDARIO PERSONAL                     3
//   Llamada 1 a 1 | Jorge Veramendi                        2
//   test de icp alto                                       1
//   …y tres con cero
//
// Quedarse con «el principal» perdería 41 citas de personas reales. Se barren los nueve.
//
// ── HALLAZGO 2 · `calendarId` ES OBLIGATORIO. NO SE PUEDE PEDIR LA SUBCUENTA ─
//
// Medido: `GET /calendars/events?locationId=…` sin más devuelve **422** con el mensaje
// *"Either of userId, calendarId or groupId is required"*. O sea que **el coste de un barrido es
// 1 + N llamadas**, siendo N la cantidad de calendarios. Con nueve, diez llamadas.
//
// Es una cota dura y conviene decirla: no crece con la cantidad de citas, crece con la cantidad de
// calendarios. Si mañana hay treinta, el barrido cuesta treinta y uno.
//
// ── HALLAZGO 3 · ESTE ENDPOINT RECHAZA FUERTE, Y ES UNA BUENA NOTICIA ──────
//
// Al contrario del de conversaciones —donde una `Version` equivocada devuelve otra forma sin
// error—, acá un parámetro que no existe da **422 nombrándolo**:
//
//   &limit=500     → 422 ["property limit should not exist"]
//   &numOfDays=30  → 422 ["property numOfDays should not exist"]
//   &pepino=1      → 422 ["property pepino should not exist"]
//
// O sea que **no acepta `limit`**, y que un error de tipeo en un parámetro se ve en el momento en
// vez de convertirse en una lista vacía. Es lo contrario del modo de falla que persigue
// `lib/http/cliente.ts`, y hay que aprovecharlo: no hace falta ninguna defensa contra el silencio.
//
// ── HALLAZGO 4 · NO HAY TRUNCAMIENTO, Y CASI REGISTRO LO CONTRARIO ─────────
//
// Una ventana de 545 días devolvió 1031 eventos, y sus dos mitades **1035**. Parecía un tope
// silencioso: el peor defecto posible en una lista sin `total` ni `nextPage`.
//
// **No lo era.** De-duplicando por `id`, las dos mitades tienen exactamente los mismos 1031
// identificadores: los 4 de más eran las citas del día del corte, contadas en las dos mitades.
// Queda anotado porque la comprobación —de-duplicar en vez de comparar cantidades— es la que hay
// que repetir la próxima vez.
//
// Lo que SÍ se confirmó de ahí: **el rango casa por SOLAPAMIENTO, no por hora de inicio.** Una
// ventana que arranca después del comienzo de una cita la trae igual. Consecuencia práctica: la
// misma cita aparece en dos ventanas contiguas, así que todo barrido tiene que de-duplicar por
// identificador — y el alta por conflicto ya lo hace.
//
// ── HALLAZGO 5 · LA FECHA VIENE CON SU DESFASE… POR ESTE CAMINO ────────────
//
//   `GET /calendars/events`            → `"2026-08-25T08:00:00-05:00"`  ← ISO con desfase
//   `GET /contacts/{id}/appointments`  → `"2026-08-25 08:00:00"`        ← sin zona, ambiguo
//
// **El mismo dato en dos formatos, en dos endpoints.** El segundo es una trampa: un instante sin
// zona se interpreta con la del servidor que lo lee, y una cita de las 22:00 se dibujaría al día
// siguiente. Por eso este módulo usa **solo** el de calendarios, y por eso el otro está nombrado
// acá — para que quien lo encuentre sepa que ya se descartó.
//
// ── HALLAZGO 6 · EL ESTADO TIENE UN CAMPO CON EL NOMBRE MAL ESCRITO ───────
//
// Cada cita trae **los dos**, con el mismo valor:
//
//   "appointmentStatus": "new",
//   "appoinmentStatus":  "new",     ← sin la segunda `t`
//
// Un lector que se quede con el segundo funciona perfecto hoy y devuelve `undefined` el día que el
// proveedor arregle su tipo. Se lee el correcto y se cae al otro, en ese orden.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedirExterno } from '../http/cliente.ts';
import type { FalloDeGhl, ResultadoDeGhl } from './cliente.ts';

const BASE = 'https://services.leadconnectorhq.com';

/** Medido: la familia de calendarios responde con esta versión. */
const VERSION = '2021-04-15';

function cabeceras(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Version: VERSION, Accept: 'application/json' };
}

/** Igual que en `cliente.ts` y `conversaciones.ts`. Doce líneas repetidas antes que un acople. */
function traducirFallo(
  r: { tipo: 'sin_respuesta'; causa: string } | { tipo: 'rechazado'; estado: number; codigo: string },
): FalloDeGhl {
  if (r.tipo === 'sin_respuesta') return { tipo: 'sin_respuesta', causa: r.causa };
  if (r.estado === 401 || r.estado === 403) return { tipo: 'no_autorizado', estado: r.estado };
  if (r.estado === 429) return { tipo: 'demasiadas_peticiones', estado: r.estado };
  return { tipo: 'rechazado', estado: r.estado, codigo: r.codigo };
}

// ─── Los calendarios ────────────────────────────────────────────────────────

export interface CalendarioDeGhl {
  id: string;
  nombre: string;
  /** `round_robin` o `personal`. No cambia nada del barrido; sirve para poder decir qué se barrió. */
  tipo: string | null;
  activo: boolean;
}

/**
 * Los calendarios de la subcuenta. **Una llamada, y es el paso 1 obligatorio de todo barrido.**
 */
export async function listarCalendarios(acceso: {
  token: string;
  locationId: string;
}): Promise<ResultadoDeGhl<CalendarioDeGhl[]>> {
  const r = await pedirExterno<{ calendars?: unknown }>(
    `${BASE}/calendars/?locationId=${encodeURIComponent(acceso.locationId)}`,
    { cabeceras: cabeceras(acceso.token) },
  );
  if (r.tipo !== 'datos') return { tipo: 'fallo', fallo: traducirFallo(r) };

  const lista = Array.isArray(r.datos?.calendars) ? r.datos.calendars : [];
  return {
    tipo: 'datos',
    datos: lista.map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        id: String(o.id ?? ''),
        nombre: typeof o.name === 'string' ? o.name : '(sin nombre)',
        tipo: typeof o.calendarType === 'string' ? o.calendarType : null,
        // ── `!== false` Y NO `=== true`, y la diferencia importa ────────────
        //
        // Un calendario sin la bandera se toma por ACTIVO. Tratar la ausencia como inactivo lo
        // sacaría del barrido y sus citas desaparecerían de la Agenda sin que nada falle — que es
        // peor que barrer uno de más, cuyo único costo es una llamada.
        activo: o.isActive !== false,
      };
    }),
  };
}

// ─── Las citas ──────────────────────────────────────────────────────────────

/**
 * Los estados MEDIDOS, con su cantidad sobre 1052 citas de la subcuenta.
 *
 * No es una lista de valores posibles: es un censo. Y dice dos cosas que el diseño necesita:
 *
 *   `confirmed`  656 · agendada y confirmada
 *   `cancelled`  411 · **el 39 %.** Una cita cancelada no es una cita de la agenda, y son muchas.
 *   `new`          2 · recién creada, sin confirmar
 *   `showed`       2 · asistió
 *   `noshow`       1 · no apareció
 *
 * **Los campos de asistencia existen y están casi vacíos: 3 de 1052, el 0,3 %.** De ahí sale que la
 * tasa de asistencia no se pueda tomar del CRM como si fuera un hecho — ver `lib/negocio/citas.ts`.
 */
export const ESTADOS_MEDIDOS = ['confirmed', 'cancelled', 'new', 'showed', 'noshow'] as const;

/** Los estados que significan que la cita ya no va a ocurrir. Comparación sin distinguir caja. */
export const ESTADOS_CANCELADOS = ['cancelled', 'canceled', 'cancelada'] as const;

/** Los dos que dicen si la persona apareció. Son los que la tasa de asistencia necesita. */
export const ESTADO_ASISTIO = 'showed';
export const ESTADO_NO_APARECIO = 'noshow';

export interface CitaDeGhl {
  id: string;
  calendarioId: string | null;
  contactId: string | null;
  titulo: string | null;
  /** El comienzo. **Nunca nulo en lo medido** (1052 de 1052), y aun así se admite. */
  inicioEl: Date | null;
  finEl: Date | null;
  /** El estado tal como lo manda el CRM, sin traducir. Ver `ESTADOS_MEDIDOS`. */
  estado: string | null;
  /** La sala o el lugar. Medido: presente en 1029 de 1052, y **puede venir vacío**. */
  sala: string | null;
  usuarioAsignadoId: string | null;
  /** `true` = el CRM la marcó como borrada y **la sigue devolviendo en la lista**. */
  borrada: boolean;
  /** Cuándo se reagendó, si se reagendó. */
  reagendadaEl: Date | null;
}

/**
 * Las citas de UN calendario en un rango.
 *
 * @param desde,hasta Instantes. Se mandan como **época en milisegundos**, que es lo que el endpoint
 *   acepta: el error de un rango ausente dice literalmente *"startTime must be a string"*, y la
 *   época en texto pasa. Una fecha ISO también se acepta, pero se manda época porque es la que no
 *   depende de ninguna zona.
 */
export async function citasDelCalendario(
  acceso: { token: string; locationId: string },
  calendarioId: string,
  desde: Date,
  hasta: Date,
): Promise<ResultadoDeGhl<CitaDeGhl[]>> {
  const q = new URLSearchParams({
    locationId: acceso.locationId,
    calendarId: calendarioId,
    startTime: String(desde.getTime()),
    endTime: String(hasta.getTime()),
  });
  // NO se agrega ningún otro parámetro. Medido: cualquiera que el endpoint no conozca —incluido
  // `limit`— devuelve 422 nombrándolo. No hay forma de pedir una página.

  const r = await pedirExterno<{ events?: unknown }>(
    `${BASE}/calendars/events?${q.toString()}`,
    { cabeceras: cabeceras(acceso.token) },
  );
  if (r.tipo !== 'datos') return { tipo: 'fallo', fallo: traducirFallo(r) };

  const lista = Array.isArray(r.datos?.events) ? r.datos.events : [];
  return { tipo: 'datos', datos: lista.map(leerCita) };
}

/** Exportada para poder probarla contra respuestas reales grabadas, sin red. */
export function leerCita(c: unknown): CitaDeGhl {
  const o = (c ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ''),
    calendarioId: texto(o.calendarId),
    contactId: texto(o.contactId),
    titulo: texto(o.title),
    inicioEl: aInstante(o.startTime),
    finEl: aInstante(o.endTime),
    // ── EL CAMPO BIEN ESCRITO PRIMERO, Y EL MAL ESCRITO DESPUÉS ─────────────
    //
    // El CRM manda los dos con el mismo valor: `appointmentStatus` y `appoinmentStatus`, el segundo
    // sin la `t`. Quedarse con el del error funciona hoy y devuelve `undefined` el día que lo
    // arreglen; quedarse solo con el correcto podría romperse si alguna respuesta trae solo el otro.
    // Los dos, en este orden.
    estado: texto(o.appointmentStatus) ?? texto(o.appoinmentStatus),
    sala: texto(o.address),
    usuarioAsignadoId: texto(o.assignedUserId),
    borrada: o.deleted === true,
    reagendadaEl: aInstante(o.rescheduledAt),
  };
}

/**
 * Instante desde lo que manda el endpoint de calendarios.
 *
 * Acá llega **ISO con desfase** —`"2026-08-25T08:00:00-05:00"`— así que `new Date` lo interpreta
 * sin ambigüedad y no hace falta saber la zona de nadie. Es exactamente la razón por la que este
 * módulo no usa `GET /contacts/{id}/appointments`, donde el mismo dato viene como
 * `"2026-08-25 08:00:00"`: ahí el instante depende de quién lo lea.
 */
function aInstante(v: unknown): Date | null {
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v < 1e11 ? v * 1000 : v);
  if (typeof v !== 'string' || v.trim() === '') return null;
  const d = new Date(v.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Texto o `null`. **La cadena vacía cuenta como ausencia**, y acá está medido: `address` viene
 * `""` en 23 de 1052 citas. Sin esto, la ficha dibujaría un botón de sala que no lleva a ninguna
 * parte — y el `11` § 5.4 dice que la ausencia de sala tiene tratamiento propio.
 */
function texto(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

/** `true` si el estado dice que la cita ya no va a ocurrir. Tolerante a la caja. */
export function estaCancelada(estado: string | null): boolean {
  if (estado === null) return false;
  return (ESTADOS_CANCELADOS as readonly string[]).includes(estado.trim().toLowerCase());
}
