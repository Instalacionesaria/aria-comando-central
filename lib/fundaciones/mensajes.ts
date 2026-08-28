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
  sin_alumno_vinculado:
    'Esta organización no está vinculada a una cuenta del hub, así que no hay dónde leer ni guardar el trabajo de Fundaciones.',

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
    'No se pudo hablar con el almacén donde vive tu trabajo. Esto NO significa que esté vacío — significa que no se pudo preguntar.',

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
  return detalle ? `${texto} (${detalle})` : texto;
}
