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
  modelo_no_disponible:
    'El modelo no respondió. No se perdió nada de lo que escribiste: probá de nuevo en un momento.',
  almacen_no_disponible:
    'No se pudo hablar con el almacén donde vive tu trabajo. Esto NO significa que esté vacío — significa que no se pudo preguntar.',

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
export function mensajeDeRechazo(codigo: string, estado: number): string {
  const texto = TEXTOS[codigo];
  if (texto) return texto;
  return `El servidor rechazó la operación (${estado} · ${codigo}). Pasale este código a quien administra el sistema.`;
}
