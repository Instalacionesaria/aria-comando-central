// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
//
// Las listas blancas de rutas: por estado de sesión, y las dos que funcionan sin sesión.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ES UNA LISTA BLANCA DE RUTAS Y NO "SALVO LAS QUE NO PIDEN CAPACIDADES"
//
// Es el cambio de fondo de todo el diseño del portero, y el 03 § 5 lo dice en una línea:
//
//   "UNA OPERACIÓN NUEVA NACE CERRADA. Es el cambio de fondo respecto de decidir por
//    capacidades: antes, no decidir dejaba la puerta abierta; ahora, no decidir la deja
//    cerrada."
//
// Con la variante que parece equivalente —"restringí todo salvo las operaciones que no
// piden ninguna capacidad"— una operación nueva que no pida capacidades **nace ABIERTA a
// todos los estados restringidos, sin que nadie lo decida**. El 09 § 5 la marca como la
// regla REEMPLAZADA.
//
// Y el modo de fallar de esa variante es FUTURO: el código de hoy queda correcto, y el
// defecto lo introduce quien escriba el endpoint número quince, sin tocar este archivo.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Una ruta, escrita como la compara el portero: `MÉTODO /camino`.
 *
 * DESVIACIÓN DELIBERADA de la especificación, y hay que decirla: el 03 § 5 y el 09 § 5
 * escriben estas rutas como `GET /auth/sesion`, sin el prefijo `/api`. En el App Router el
 * camino real de un `app/api/auth/sesion/route.ts` **es** `/api/auth/sesion`, y el portero
 * compara contra el camino real de la petición. Escribirlas sin el prefijo haría que
 * ninguna coincidiera nunca — y como el resultado de no coincidir es *rechazar*, el
 * síntoma sería que nadie puede salir de un estado restringido: falla cerrado, pero
 * bloquea a todo el mundo.
 */
export type Ruta = `${'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'} /${string}`;

/**
 * El conjunto que TODO estado habilita.
 *
 * Sin él no se puede salir de ningún estado ni saber en cuál se está. El 03 § 5 llama a
 * esto *"el error más fácil de cometer armando estas listas"*, y las dos razones:
 *
 *   - **consultar la sesión está en las cuatro.** Sin eso el frontend no puede saber en qué
 *     estado está y no sabe qué pantalla mostrar.
 *   - **cerrar sesión está en las cuatro.** De todo estado se tiene que poder salir; *"un
 *     estado sin salida es una cuenta bloqueada que necesita a un administrador"*.
 */
export const COMUN: readonly Ruta[] = ['GET /api/auth/sesion', 'DELETE /api/auth/sesion'];

/**
 * Las rutas habilitadas por cada estado de sesión.
 *
 * El nombre es `ESTADOS` y no `RUTAS_PERMITIDAS`: los dos documentos normativos usan
 * nombres distintos para el mismo diccionario —el 03 § 5 lo llama `RUTAS_PERMITIDAS`, el
 * 09 § 5 lo llama `ESTADOS`— con el MISMO contenido. Gana el 09 por número más alto
 * (`EJECUCION` § 4), y `EJECUCION` § 4 además dice del 09 que *"la lista blanca de la § 5
 * se aplica literalmente"*.
 *
 * `activa` es `null` y no una lista: "todas" no es un conjunto que se pueda enumerar, y
 * escribirlo como lista obligaría a mantener acá cada ruta nueva del sistema.
 */
export const ESTADOS: Readonly<Record<string, readonly Ruta[] | null>> = {
  pendiente_2fo: [...COMUN, 'POST /api/auth/2fo/verificar'],
  // Cambiar la contraseña es `POST /api/auth/sesion` en la especificación. Está acá
  // literal aunque la ruta todavía no exista: la Etapa 4 la escribe.
  debe_cambiar_password: [...COMUN, 'POST /api/auth/sesion'],
  debe_configurar_2fo: [
    ...COMUN,
    'POST /api/auth/2fo/configurar',
    'POST /api/auth/2fo/confirmar',
  ],
  activa: null,
};

/**
 * Las dos rutas que funcionan **sin sesión**, y por eso no pasan por el portero.
 *
 * El 03 § 5, paso 0, es explícito sobre por qué tienen su propia función y no un campo
 * opcional en el contexto del portero:
 *
 *   "Mezclarlas en esta función obliga a devolver dos formas distintas —el contexto, o un
 *    objeto con un campo que hay que recordar mirar— y en un lenguaje sin tipos eso es una
 *    fuente de defectos silenciosos: quien escriba `si no contexto: devolver` sobre la
 *    forma nueva NUNCA corta, porque un objeto siempre es verdadero."
 *
 * Y por qué cada una:
 *
 *   - `GET /api/auth/sesion` — *"'¿hay alguien?' es una pregunta legítima sin sesión, y
 *     responde 200 `{ autenticado: false }`. Si respondiera 401, el arranque del frontend
 *     entraría en bucle con el manejador que escucha ese código."*
 *   - `DELETE /api/auth/sesion` — *"tiene que borrar la cookie SIEMPRE, también cuando la
 *     sesión ya venció: es la única forma de que el navegador deje de mandarla."*
 */
export const SIN_SESION_REQUERIDA: readonly Ruta[] = [...COMUN];

/**
 * Las rutas exentas del paso 3 (¿la organización está activa?).
 *
 * Las dos de `SIN_SESION_REQUERIDA` por lo que dice el 03 § 5 —*"si no, alguien de una
 * organización desactivada no puede ni cerrar sesión ni saber qué le pasa"*— más una que
 * la especificación NO contempla y que descubrimos razonando el caso:
 *
 * `PATCH /api/auth/sesion` es la ruta con la que el rol de plataforma vuelve a su propia
 * organización. Si estuviera sujeta al paso 3, alguien que desactive la organización que
 * está mirando **queda encerrado**: toda ruta le contesta 403 `organizacion_inactiva`,
 * incluida la única con la que podría salir. Su salida sería cerrar sesión y volver a
 * entrar, y el `03` § 5 ya estableció que un estado sin salida es un defecto.
 *
 * El 04 § 8 solo cubre la organización BORRADA (`on delete set null` devuelve la sesión a
 * la propia). La organización que existe pero está INACTIVA no está escrita en ninguna
 * parte.
 */
export const EXENTAS_DE_ORGANIZACION_ACTIVA: readonly Ruta[] = [
  ...SIN_SESION_REQUERIDA,
  'PATCH /api/auth/sesion',
];

/**
 * Las rutas nombradas en las listas de arriba que **todavía no existen**.
 *
 * Existe para que la comprobación de entradas muertas de `ADR-0301` no falle sobre las
 * rutas que la Etapa 4 va a escribir, y —más importante— para que esas rutas tengan que
 * SALIR de acá cuando se escriban. Una lista blanca sin comprobación de entradas muertas
 * acumula rutas que ya no existen, y ahí deja de decir la verdad.
 */
export const AUN_NO_EXISTEN: readonly Ruta[] = [
  'POST /api/auth/sesion',
  'POST /api/auth/2fo/verificar',
  'POST /api/auth/2fo/configurar',
  'POST /api/auth/2fo/confirmar',
];

/** ¿Esta ruta está habilitada para este estado de sesión? */
export function estadoHabilita(estado: string, ruta: string): boolean {
  const permitidas = ESTADOS[estado];
  // Un estado que no está en el diccionario NO habilita nada. Falla cerrado: si algún día
  // la base admite un estado nuevo y nadie lo agrega acá, sus sesiones quedan sin poder
  // hacer nada en vez de con acceso total.
  if (permitidas === undefined) return false;
  if (permitidas === null) return true;
  return permitidas.includes(ruta as Ruta);
}
