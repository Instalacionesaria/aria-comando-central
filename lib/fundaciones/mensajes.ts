// ADR-0305 — Un rechazo por permiso no se muestra como "no hay datos".
//
// El texto que ve una persona cuando algo se rechazó, uno por código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTE ARCHIVO ES LA MITAD DE `ADR-0305` QUE VIVE EN LA INTERFAZ
//
// La otra mitad es la forma del tipo `Respuesta<T>`: el cliente HTTP no puede colapsar "hay datos",
// "te lo rechazaron" y "no pude preguntar" porque no tiene rama nula. Pero eso solo garantiza que la
// distinción LLEGUE hasta acá; que se MUESTRE distinta depende de este mapa.
//
// El defecto que evita es el del `07` § 2, y es concreto: sin este mapa, la pantalla de Fundaciones
// pintaría siete formularios en blanco cuando el problema real es que a la organización le falta un
// permiso, o que el almacén no contestó. *"Nadie reporta un bug de algo que simplemente no tiene
// datos."*
//
// Los textos dicen QUÉ HACER y QUIÉN puede hacerlo, no solo qué pasó. Un "no tenés permiso" a secas
// deja a alguien esperando que se arregle solo.
// ═══════════════════════════════════════════════════════════════════════════════

/** Los textos por código de rechazo. */
const TEXTOS: Readonly<Record<string, string>> = {
  // Del portero.
  sin_sesion: 'Tu sesión venció. Volvé a entrar y seguimos donde estabas — el trabajo está guardado.',
  sin_permiso:
    'Tu rol no incluye Fundaciones. No es que esté vacío: no lo podés ver. Pedile a quien administra la organización la capacidad correspondiente.',
  organizacion_inactiva: 'Esta organización está desactivada, así que Fundaciones no opera.',
  origen_no_permitido: 'La petición no se aceptó por seguridad. Recargá la página e intentá de nuevo.',
  pendiente_2fo: 'Falta confirmar tu segundo factor antes de seguir.',
  debe_cambiar_password: 'Tenés que cambiar tu contraseña antes de seguir.',
  debe_configurar_2fo: 'Tenés que configurar tu segundo factor antes de seguir.',

  // De la configuración de la organización. Son 409 y no 403 a propósito: quien los recibe TIENE el
  // permiso, y lo que falta es una configuración. Cada uno nombra a quién le toca.
  sin_llave_de_ia:
    'Esta organización todavía no tiene su llave de IA cargada. Se carga en Integraciones, y sin ella no se puede generar (lo ya generado sí se ve).',
  llave_de_ia_ilegible:
    'La llave de IA está cargada pero el servidor no puede leerla — pasa cuando cambia la clave maestra. Hay que volver a cargarla.',
  // De los dos servicios externos. Están separados a propósito: son dos sistemas distintos y
  // confundirlos hace que se revise el que anda.
  /* El detalle que sigue a este texto viene DEL PROVEEDOR y dice qué estuvo mal. Se nombran las dos
     causas que no se arreglan probando de nuevo, porque «probá de nuevo en un momento» a secas manda
     a esperar a alguien que tiene que ir a hacer algo — y esperar no recarga una cuenta. Mismo
     encuadre que `motor_rechazo`, que ya resolvía esto para el motor de scraping. */
  modelo_no_disponible:
    'El modelo no respondió, y el detalle de abajo viene de él. No se perdió nada de lo que ' +
    'escribiste. Si dice que el saldo es insuficiente, hay que recargar la cuenta de IA; si nombra ' +
    'un límite o un campo de la petición, es nuestro y hay que corregirlo. Cualquier otra cosa suele ' +
    'ser pasajera: probá de nuevo en un momento.',
  almacen_no_disponible:
    'No se pudo leer tu trabajo guardado. Esto NO significa que esté vacío — significa que no se pudo preguntar. Probá de nuevo en un momento.',

  // Del motor de scraping. Ver `respuesta.ts`: son tres porque mandan a tres personas distintas.
  motor_no_configurado:
    'El motor de scraping no está configurado en este servidor. Es un problema del despliegue, no de tus datos.',
  motor_no_disponible:
    'No se pudo hablar con el motor de scraping. No se gastó ningún lead: la petición no llegó.',
  motor_rechazo:
    'El motor de scraping rechazó la petición. El detalle de abajo viene de él — lo más común es que se te haya acabado el saldo de leads.',

  // Nuestros.
  metodologia_ilegible:
    'Falta el archivo de metodología de esta herramienta en el servidor. Es un problema del despliegue, no de tus datos.',
  base_no_disponible: 'La base no está respondiendo. No es tu sesión: es el servidor.',
  peticion_invalida: 'La petición no se entendió. Recargá la página e intentá de nuevo.',
  no_encontrado: 'Esa herramienta no existe.',
};

// ── LOS FALLOS DEL MODELO, UNO POR SITUACIÓN ─────────────────────────────────
//
// El servidor los clasifica en `lib/fundaciones/fallo-del-modelo.ts` y manda el detalle con la forma
// `IA-XXX · ref ABC123 · lo técnico`. Cada texto termina diciendo A QUIÉN le toca, que es lo que
// faltaba: con el párrafo único de antes, la única salida de quien lo leía era escribir «falló otra
// vez». Tres finales, y solo tres:

const LO_ARREGLA_NADIE = 'Esto no lo tiene que arreglar nadie: probá de nuevo en unos minutos.';
const LO_ARREGLA_LA_CUENTA = 'Lo arregla quien administra la cuenta de IA de la organización.';
const LO_ARREGLAMOS = 'Si vuelve a pasar, mandale este código al equipo de ARIA.';

const TEXTOS_DEL_MODELO: Readonly<Record<string, string>> = {
  'IA-CONEXION': `Se cortó la conexión con el modelo antes de que terminara. No se perdió nada de lo que escribiste. Probá de nuevo. ${LO_ARREGLAMOS}`,
  'IA-TIEMPO': `La generación tardó más de 9 minutos y la cortamos. Probá de nuevo. ${LO_ARREGLAMOS}`,
  'IA-SIN-SALDO': `La cuenta de IA de esta organización se quedó sin saldo; esperar no lo arregla. ${LO_ARREGLA_LA_CUENTA}`,
  'IA-LLAVE': `Anthropic no acepta la llave de IA de esta organización: hay que cargar una nueva en Integraciones. ${LO_ARREGLA_LA_CUENTA}`,
  'IA-PERMISO': `La llave de IA no tiene permiso para usar este modelo: hay que revisar a qué workspace de Anthropic pertenece. ${LO_ARREGLA_LA_CUENTA}`,
  'IA-LIMITE': `Anthropic está limitando cuántas peticiones acepta de esta cuenta. Esperá un minuto y probá de nuevo.`,
  'IA-SATURADO': `Anthropic está saturado en este momento. No es tu cuenta ni tus datos. ${LO_ARREGLA_NADIE}`,
  'IA-MODELO': `El modelo que pedimos no está disponible para esta llave. Es un error de configuración nuestro. ${LO_ARREGLAMOS}`,
  'IA-PETICION': `Anthropic rechazó la petición por cómo la armamos. Es un error nuestro, no tuyo. ${LO_ARREGLAMOS}`,
  'IA-GRANDE': `Lo que le mandamos al modelo es demasiado largo. Acortá lo que escribiste en este paso y probá de nuevo. ${LO_ARREGLAMOS}`,
  'IA-VACIO': `El modelo contestó pero sin ningún texto. Probá de nuevo. ${LO_ARREGLAMOS}`,
  'IA-TRUNCADO': `La respuesta del modelo llegó cortada. Probá de nuevo. ${LO_ARREGLAMOS}`,
  'IA-DECLINO': `El modelo no quiso seguir con esta conversación. Reformulá lo último que escribiste y probá de nuevo.`,
  'IA-ESTRUCTURA': `El modelo devolvió una respuesta que no pudimos leer. Probá de nuevo. ${LO_ARREGLAMOS}`,
  'IA-OTRO': `El modelo devolvió un error que no conocemos. ${LO_ARREGLAMOS}`,
};

/** Lee el detalle de un fallo del modelo. `null` si no tiene la forma (un servidor viejo, digamos). */
export function leerFalloDelModelo(
  detalle: string,
): { situacion: string; ref: string; tecnico: string } | null {
  const m = /^(IA-[A-Z-]+) · ref ([A-Z0-9]+) · ([\s\S]*)$/.exec(detalle);
  if (!m || !TEXTOS_DEL_MODELO[m[1]!]) return null;
  return { situacion: m[1]!, ref: m[2]!, tecnico: m[3]! };
}

/** Cuando no se pudo preguntar: red, tiempo de espera, cuerpo ilegible. */
export const SIN_RESPUESTA =
  'No se pudo llegar al servidor. Puede ser la conexión. Nada de esto significa que tu trabajo se haya perdido.';

/**
 * El texto de un código de rechazo.
 *
 * Un código que no está en el mapa NO se muestra como un error genérico vacío: se muestra con el
 * código a la vista. Alguien lo puede buscar; "algo salió mal" no se puede buscar.
 */
export function mensajeDeRechazo(codigo: string, estado: number, detalle?: string | null): string {
  const texto = TEXTOS[codigo];
  if (!texto) {
    return `El servidor rechazó la operación (${estado} · ${codigo}). Pasale este código a quien administra el sistema.`;
  }

  /* ── EL DETALLE SE MUESTRA, Y ANTES SE PERDÍA ─────────────────────────
   *
   * Esta función devolvía solo el texto amable y **tiraba el `detalle`**. El servidor sí lo manda —
   * `rechazoDeModelo` pasa el código de Anthropic a propósito, con su motivo escrito— y la pantalla lo
   * descartaba.
   *
   * El costo fue concreto: `not_found_error` (modelo inválido), `authentication_error` (clave mal) y
   * `overloaded_error` (el proveedor saturado) mostraban **el mismo mensaje**. Con un modelo cuyo
   * identificador no existía, quien lo leía revisó la clave — que estaba bien guardada.
   *
   * Son tres investigaciones distintas y ahora se distinguen. El código y no el mensaje del proveedor,
   * que es texto que no controlamos: el mismo criterio que ya usa el servidor. */
  if (codigo === 'modelo_no_disponible' && detalle) {
    const f = leerFalloDelModelo(detalle);
    if (f) {
      // En una segunda línea, para que se lea de un vistazo en una captura.
      return `${TEXTOS_DEL_MODELO[f.situacion]}\nCódigo ${f.situacion} · ref ${f.ref} — ${f.tecnico}`;
    }
  }
  return detalle ? `${texto} (${detalle})` : texto;
}
