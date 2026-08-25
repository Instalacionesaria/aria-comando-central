// El cliente de GoHighLevel. Solo lectura de contactos, por ahora.
//
// ═══════════════════════════════════════════════════════════════════════════════
// TODO LO DE ACÁ SALE DE LA DOCUMENTACIÓN OFICIAL, Y LO QUE NO ESTÁ CONFIRMADO SE DICE
//
// La API de GoHighLevel tiene dos generaciones vivas y documentación en migración, así que
// **nada de este archivo se escribió de memoria**. Las fuentes son el OpenAPI oficial
// (`apps/contacts.json` del repositorio `GoHighLevel/highlevel-api-docs`) y
// `marketplace.gohighlevel.com/docs`. Donde la documentación no alcanza, está dicho.
//
// La regla que sigue este archivo es la del `11` § 9 regla 1 llevada a una integración: **un
// campo que la fuente no da se guarda como nulo, no se infiere.** Un valor inventado acá se
// convierte en un número en la pantalla del closer, y ahí ya no se distingue de un dato.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedirExterno } from '../http/cliente.ts';

/** La base de la API v2. `public-api.gohighlevel.com` y `rest.gohighlevel.com/v1` son la v1, EOL. */
const BASE = 'https://services.leadconnectorhq.com';

/**
 * El valor de la cabecera `Version`, que es OBLIGATORIA.
 *
 * Hay dos válidas para la misma ruta: `2021-07-28` (por fecha) y `v3` (nombrada, la que los
 * documentos muestran por omisión). Se usa la de fecha porque es la que aparece en todos los
 * ejemplos oficiales de Private Integration Token.
 *
 * Está en una constante y no en cada llamada para que pasar a `v3` sea una línea. **Y no se
 * puede hacer sin revalidar**: no hay changelog oficial que documente las diferencias de este
 * endpoint entre las dos versiones, y en los dos OpenAPI el cuerpo figura como un esquema
 * vacío. O sea que un cambio de versión no falla — devuelve otra forma.
 */
const VERSION_CONTACTOS = '2021-07-28';

/**
 * Cuántos contactos por página. El máximo documentado es 500.
 *
 * Se piden 100 y no 500 a propósito: la paginación estándar tiene un tope de **10.000
 * registros en total** (`page` × `pageLimit`), y pasado eso hay que cambiar a `searchAfter`.
 * Con páginas de 100 el cambio ocurre en la página 100, que da mucho margen para notarlo; con
 * 500 ocurre en la 20.
 */
const POR_PAGINA = 100;

/**
 * El tope de páginas por sincronización.
 *
 * NO es una decisión de rendimiento: es que **la paginación por `page` no puede pasar de
 * 10.000 registros**, y este archivo todavía no implementa `searchAfter`. Con 100 páginas de
 * 100 se llega justo a ese techo.
 *
 * Cuando se alcanza, `sincronizar` lo INFORMA (`truncado: true`) en vez de devolver lo que
 * trajo como si fuera todo. Un corte silencioso acá se ve como "faltan contactos" y se
 * diagnostica como un problema de etiquetas.
 */
const TOPE_DE_PAGINAS = 100;

/** Un contacto tal como lo devuelve `POST /contacts/search`. Solo los campos que se usan. */
export interface ContactoDeGhl {
  id: string;
  locationId?: string;
  /**
   * OJO: `/contacts/search` devuelve las variantes EN MINÚSCULA. El ejemplo oficial trae
   * `firstNameLowerCase` / `lastNameLowerCase` con el comentario textual *"first name without
   * lowercase is not yet available"*. Las versiones con mayúsculas están confirmadas solo en
   * `GET /contacts/{id}`.
   */
  firstNameLowerCase?: string;
  lastNameLowerCase?: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  email?: string;
  tags?: string[];
  /** Texto libre que pone quien creó el contacto: `"Website"`, `"public api"`, `"xyz form"`. */
  source?: string;
  dateAdded?: string;
}

/** Lo que devuelve la búsqueda. */
export interface PaginaDeContactos {
  contactos: ContactoDeGhl[];
  total: number | null;
}

/** Por qué falló una llamada a GoHighLevel. Cada valor lleva a una acción distinta. */
export type FalloDeGhl =
  | { tipo: 'sin_respuesta'; causa: string }
  | { tipo: 'no_autorizado'; estado: number }
  | { tipo: 'demasiadas_peticiones'; estado: number }
  | { tipo: 'rechazado'; estado: number; codigo: string };

export type ResultadoDeGhl<T> = { tipo: 'datos'; datos: T } | { tipo: 'fallo'; fallo: FalloDeGhl };

/** Las cabeceras de toda llamada. El token va como Bearer: el PIT es un token OAuth fijo. */
function cabeceras(token: string, version: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Version: version,
    Accept: 'application/json',
  };
}

/**
 * Traduce el rechazo de `pedirExterno` a algo que la pantalla pueda decir.
 *
 * `401`/`403` se separan del resto porque son los únicos que significan **"el token no sirve"**
 * — y ésa es la única causa que quien mira la pantalla puede arreglar, cargando el token de
 * nuevo en Ajustes. Colapsarlos con un 500 de GoHighLevel mandaría a alguien a revisar sus
 * credenciales por una caída ajena.
 *
 * El `429` va aparte porque tampoco se arregla tocando nada: hay que esperar.
 */
function traducirFallo(r: { tipo: 'sin_respuesta'; causa: string } | { tipo: 'rechazado'; estado: number; codigo: string }): FalloDeGhl {
  if (r.tipo === 'sin_respuesta') return { tipo: 'sin_respuesta', causa: r.causa };
  if (r.estado === 401 || r.estado === 403) return { tipo: 'no_autorizado', estado: r.estado };
  // El código exacto que devuelve GoHighLevel al pasarse del límite NO está confirmado: su
  // página de Rate Limits detalla los límites y las cabeceras pero no dice qué situación
  // responde. Se trata el 429 como el caso conocido y el resto cae en `rechazado`.
  if (r.estado === 429) return { tipo: 'demasiadas_peticiones', estado: r.estado };
  return { tipo: 'rechazado', estado: r.estado, codigo: r.codigo };
}

/**
 * Los contactos de una subcuenta que tienen una etiqueta.
 *
 * ── POR QUÉ `eq` Y NUNCA `contains` ─────────────────────────────────────────
 *
 * Los dos operadores existen para el campo `tags`, y `contains` hace coincidencia por
 * SUBCADENA. Filtrar `contains "zona_closer"` traería también `"zona_closer_viejo"` o
 * `"ex_zona_closer"` — contactos de otro territorio, en la bandeja equivocada, **sin que nada
 * falle**. Además la documentación aclara que `contains` no admite caracteres especiales.
 *
 * ── Y POR QUÉ SE PAGINA CON `page` Y NO CON `searchAfter` ───────────────────
 *
 * `searchAfter` es el cursor que hace falta pasando los 10.000 registros, y **no se pueden
 * mezclar**: la documentación dice que con `searchAfter` no hay que mandar `page`. Con los
 * volúmenes de hoy —cientos de contactos— `page` alcanza, y el tope se informa en vez de
 * cortar en silencio. Implementar el cursor sin necesitarlo sería código sin forma de probar.
 */
export async function contactosPorEtiqueta(
  acceso: { token: string; locationId: string },
  etiqueta: string,
  opciones: { pagina?: number } = {},
): Promise<ResultadoDeGhl<PaginaDeContactos>> {
  const r = await pedirExterno<{ contacts?: unknown; total?: unknown }>(`${BASE}/contacts/search`, {
    metodo: 'POST',
    cabeceras: cabeceras(acceso.token, VERSION_CONTACTOS),
    cuerpo: {
      // Va SIEMPRE, aunque el token ya sea de esa subcuenta: es obligatorio, y un token que
      // abarque varias subcuentas sin decir cuál devolvería los contactos de otra empresa.
      locationId: acceso.locationId,
      page: opciones.pagina ?? 1,
      pageLimit: POR_PAGINA,
      filters: [{ field: 'tags', operator: 'eq', value: etiqueta }],
      // Por fecha de alta descendente: si algún día hay que cortar, que lo que se traiga sea lo
      // más nuevo y no una porción arbitraria.
      sort: [{ field: 'dateAdded', direction: 'desc' }],
    },
  });

  if (r.tipo !== 'datos') return { tipo: 'fallo', fallo: traducirFallo(r) };

  const contactos = Array.isArray(r.datos?.contacts) ? (r.datos.contacts as ContactoDeGhl[]) : [];
  // `total` puede no venir. Se devuelve `null` y no `0`: un cero acá se leería como "esta
  // etiqueta no tiene contactos", que es una afirmación distinta de "no me dijeron cuántos".
  const total = typeof r.datos?.total === 'number' ? r.datos.total : null;
  return { tipo: 'datos', datos: { contactos, total } };
}

/**
 * TODOS los contactos con una etiqueta, paginando.
 *
 * Devuelve `truncado: true` si se llegó al tope sin agotar la etiqueta. Quien llama tiene que
 * mirarlo: sin eso, una lista incompleta se ve exactamente igual que una completa.
 */
export async function todosLosContactosPorEtiqueta(
  acceso: { token: string; locationId: string },
  etiqueta: string,
): Promise<ResultadoDeGhl<{ contactos: ContactoDeGhl[]; truncado: boolean }>> {
  const juntos: ContactoDeGhl[] = [];

  for (let pagina = 1; pagina <= TOPE_DE_PAGINAS; pagina += 1) {
    const r = await contactosPorEtiqueta(acceso, etiqueta, { pagina });
    if (r.tipo === 'fallo') return r;

    juntos.push(...r.datos.contactos);

    // Una página incompleta significa que no hay más. Es el corte fiable: `total` puede no
    // venir, y contarlo contra `total` fallaría justo cuando falta ese campo.
    if (r.datos.contactos.length < POR_PAGINA) {
      return { tipo: 'datos', datos: { contactos: juntos, truncado: false } };
    }
  }

  return { tipo: 'datos', datos: { contactos: juntos, truncado: true } };
}

/**
 * El nombre de un contacto, con la fuente que haya.
 *
 * `/contacts/search` devuelve las variantes EN MINÚSCULA —lo dice la documentación oficial con
 * todas las letras— así que se prefieren las que conservan mayúsculas cuando vienen, y se cae
 * a las minúsculas cuando no.
 *
 * Y si no viene ninguna, devuelve `null` y **no** una cadena vacía ni `'Sin nombre'`: la
 * columna `nombre` es obligatoria en la base, así que un contacto sin nombre tiene que
 * saltearse con un motivo, no entrar con una etiqueta inventada que después alguien lee como
 * si fuera el nombre real.
 */
export function nombreDe(c: ContactoDeGhl): string | null {
  const crudo = [
    c.contactName,
    c.name,
    [c.firstName, c.lastName].filter(Boolean).join(' '),
    [c.firstNameLowerCase, c.lastNameLowerCase].filter(Boolean).join(' '),
  ]
    .map((n) => (typeof n === 'string' ? n.trim() : ''))
    .find((n) => n.length > 0);

  if (!crudo) return null;
  return conCaja(crudo);
}

/**
 * Le devuelve la mayúscula inicial a un nombre **solo si la fuente la perdió**.
 *
 * ── LA REGLA, Y POR QUÉ NO ES "CAPITALIZAR SIEMPRE" ─────────────────────────
 *
 * Se decide mirando el propio valor: **si no tiene NI UNA mayúscula, la caja se perdió**. Si
 * tiene alguna, se respeta tal cual, porque entonces alguien la escribió a propósito — y
 * capitalizar «McDonald» o «van der Berg» sería romper un nombre que estaba bien.
 *
 * ── POR QUÉ NO ALCANZABA CON PREFERIR LOS CAMPOS "CON CAJA" ─────────────────
 *
 * La primera versión elegía `contactName` / `name` / `firstName` antes que las variantes
 * `*LowerCase`, dando por sentado que las primeras traían mayúsculas. **Medido contra la
 * subcuenta real: no.** Después de resincronizar los 124 contactos seguían en minúscula, o sea
 * que GoHighLevel devuelve uno de esos campos y su contenido también viene en minúscula.
 *
 * Mirar el VALOR en vez del nombre del campo funciona sin importar cuál vino, y sigue
 * funcionando el día que la API cambie qué devuelve.
 *
 * ── Y ESTO NO ES INVENTAR UN DATO ───────────────────────────────────────────
 *
 * La distinción importa porque este proyecto no inventa ninguno: **la fuente perdió la CAJA, no
 * el nombre.** La persona se llama igual; lo que falta es una convención de presentación, y una
 * lista de trabajo entera en minúscula se lee como datos de prueba.
 *
 * Es APROXIMADO, y hay que decirlo: «de la cruz» sale «De La Cruz», que no es como se escribe.
 * La alternativa exacta es pedir `GET /contacts/{id}` por cada contacto —124 llamadas más
 * contra un límite de tasa ajeno, por una mayúscula— y no vale ese precio.
 */
function conCaja(nombre: string): string {
  // `\p{Lu}` y no `[A-Z]`: un nombre puede empezar con Á, Ñ o Ö y estar perfectamente escrito.
  if (/\p{Lu}/u.test(nombre)) return nombre;
  return nombre.replace(/(^|[\s'-])(\p{L})/gu, (_, antes, letra) => antes + letra.toUpperCase());
}


// ═══════════════════════════════════════════════════════════════════════════════
// EL CATÁLOGO DE ETIQUETAS — PARA QUE UN VACÍO DIGA POR QUÉ ESTÁ VACÍO
//
// Cuando una sincronización trae cero contactos hay exactamente dos causas, y desde afuera se
// ven idénticas:
//
//   1. la subcuenta no tiene contactos con esa etiqueta;
//   2. la etiqueta **se llama distinto** — `Zona Closer`, `zona-closer`, `ZONA_CLOSER`.
//
// La segunda es la frecuente, y la documentación oficial **no confirma** si GoHighLevel
// normaliza los tags al guardarlos ni si el filtro `eq` distingue mayúsculas. Así que no se
// adivina: se lee el catálogo real de la subcuenta y se muestra.
//
// Sin esto, el síntoma que llega es "no carga nada" y no hay dónde mirar. Con esto, la
// pantalla dice *"busqué `zona_closer` y tu cuenta tiene `Zona Closer`"*, que es un diagnóstico.
//
// ── Y SI EL TOKEN NO TIENE ESE PERMISO ──────────────────────────────────────
//
// Leer tags necesita el alcance `locations/tags.readonly`, que es DISTINTO del
// `contacts.readonly` que necesita la búsqueda. Un token que sirve para traer contactos puede
// no servir para esto. Por eso el catálogo es informativo y su fallo NO rompe la
// sincronización: se devuelve `null` y la pantalla dice que no pudo leerlo, en vez de convertir
// un permiso que falta en "la sincronización falló".
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Las etiquetas que existen en la subcuenta, o `null` si no se pudieron leer.
 *
 * `null` y `[]` significan cosas distintas y por eso no se colapsan: `[]` es "esta subcuenta
 * no tiene ninguna etiqueta" —un hecho— y `null` es "no pude preguntar", que manda a revisar
 * el alcance del token y no las etiquetas.
 */
export async function etiquetasDeLaSubcuenta(acceso: {
  token: string;
  locationId: string;
}): Promise<string[] | null> {
  const r = await pedirExterno<{ tags?: unknown }>(
    `${BASE}/locations/${encodeURIComponent(acceso.locationId)}/tags`,
    { cabeceras: cabeceras(acceso.token, VERSION_CONTACTOS) },
  );
  if (r.tipo !== 'datos') return null;
  if (!Array.isArray(r.datos?.tags)) return null;
  return (r.datos.tags as { name?: unknown }[])
    .map((t) => (typeof t?.name === 'string' ? t.name : null))
    .filter((n): n is string => n !== null);
}

/**
 * UN contacto por su identificador. `GET /contacts/{id}`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * PARA QUÉ EXISTE, Y POR QUÉ ES LA ÚNICA LLAMADA QUE CUESTA ABRIR UNA FICHA
 *
 * Todo lo que la ficha muestra sale de la caché: cero llamadas al CRM por pestaña, por mensaje y
 * por ícono. La excepción es la apertura, y es deliberada.
 *
 * El estado del agente, la cita agendada y el seguimiento automático **se derivan de las
 * etiquetas**, y las etiquetas las mantiene una sincronización que hoy corre cuando alguien
 * aprieta un botón. Sin refrescar al abrir, la ficha diría «el bot está apagado» leyendo una
 * etiqueta de hace días — y el bot es exactamente lo que la persona viene a mirar antes de
 * escribir.
 *
 * Una llamada por apertura, por acción explícita de una persona. Comparado con un reloj que
 * refresque, es gratis.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export async function contactoPorId(
  acceso: { token: string; locationId: string },
  ghlContactId: string,
): Promise<ResultadoDeGhl<ContactoDeGhl | null>> {
  const r = await pedirExterno<{ contact?: unknown }>(
    `${BASE}/contacts/${encodeURIComponent(ghlContactId)}`,
    { cabeceras: cabeceras(acceso.token, VERSION_CONTACTOS) },
  );

  if (r.tipo !== 'datos') {
    // UN 404 NO ES UN FALLO, y distinguirlo importa: significa que ese contacto ya no está en el
    // CRM —lo borraron— y la ficha tiene que poder decir eso en vez de «no se pudo consultar».
    // Se devuelve `datos: null`, que es un hecho medido, no un error.
    if (r.tipo === 'rechazado' && r.estado === 404) return { tipo: 'datos', datos: null };
    return { tipo: 'fallo', fallo: traducirFallo(r) };
  }

  // La respuesta envuelve el contacto en `contact`. Si no viene con esa forma se devuelve `null`
  // en vez de un objeto a medias: un contacto sin `id` ni `tags` haría que el refresco borre las
  // etiquetas que sí teníamos.
  const c = r.datos?.contact;
  if (!c || typeof c !== 'object') return { tipo: 'datos', datos: null };
  return { tipo: 'datos', datos: c as ContactoDeGhl };
}
