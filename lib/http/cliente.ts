// ADR-0305 — Un rechazo por permiso no se muestra como "no hay datos".
//
// El ÚNICO cliente HTTP del proyecto.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL PEOR DEFECTO DE LA LISTA, Y POR QUÉ
//
// El `07` § 2 lo dice así:
//
//   "Si el cliente HTTP convierte cualquier error en una lista vacía para no romper la
//    pantalla, un `403` se muestra como 'no hay nada acá'. El usuario no sabe que le falta un
//    permiso: CREE QUE EL SISTEMA ESTÁ VACÍO."
//
// Ocurrió con una pantalla de cinco secciones donde un rol estaba autorizado en **una**:
// quien la abría veía una sección con datos y cuatro en blanco, **sin ningún error**.
//
// Y la frase que explica por qué es el peor de todos: *"nadie reporta un bug de algo que
// 'simplemente no tiene datos'"*.
//
// ── LA DEFENSA NO ES DISCIPLINA, ES LA FORMA DEL TIPO ────────────────────────
//
// Tres cosas distintas tienen que ser tres valores distintos (`07` § 0, regla 2: *"un valor
// nulo significa una sola cosa. Nunca 'no hay' Y 'no pude averiguarlo' a la vez"*):
//
//     hay datos (que pueden ser una lista vacía LEGÍTIMA)
//     te lo rechazaron          (con CUÁL de los seis rechazos)
//     no pude preguntar         (red, tiempo de espera, cuerpo ilegible)
//
// `Respuesta<T>` no tiene rama nula ni booleano `ok`, y eso es deliberado: **no se puede
// escribir `await pedir(…) ?? []`**, porque no hay nada que sea nulo. La línea que ya destruyó
// esta regla una vez no se puede volver a escribir.
//
// Lo que este tipo NO alcanza a proteger, y hay que decirlo: `tsconfig.json` tiene
// `checkJs: false` y solo incluye `.ts`/`.tsx`, así que los consumidores que existen hoy —16
// módulos `.js` y 17 componentes `.jsx`— quedan **fuera de `tsc`**. Para ellos el peso lo
// lleva entero el análisis estático de `ADR-0305`.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * El resultado de una petición. Tres ramas, ninguna nula.
 *
 * `datos` puede ser una lista vacía y eso es una respuesta legítima: "no hay filas" es un
 * hecho medido, distinto de "no me dejaron ver" y de "no pude preguntar".
 */
export type Respuesta<T> =
  | { readonly tipo: 'datos'; readonly datos: T }
  | { readonly tipo: 'rechazado'; readonly estado: number; readonly codigo: string }
  | { readonly tipo: 'sin_respuesta'; readonly causa: string };

/** Cuánto se espera antes de decir "no pude preguntar". */
const ESPERA_MS = 15_000;

/**
 * Pide algo al API. **La única función del proyecto que hace una petición HTTP.**
 *
 * La unicidad no está escrita en la especificación —el `07` § 4 describe el defecto de tener
 * dos con manejo opuesto, no la regla— y se adopta por simetría con `ADR-0203`
 * (*"un solo lugar crea el cliente de base"*). El defecto que evita está medido: *"si en el
 * mismo frontend hay uno que lanza (y manda al login ante un `401`) y otro que devuelve nulo
 * para seguir con datos de ejemplo, UN `401` POR EL SEGUNDO CAMINO NO ECHA A NADIE: la sesión
 * está vencida y la pantalla sigue como si nada."*
 *
 * Nótese que no hay excepción para el arranque de sesión. El `02` pide que esa llamada *"sea
 * la excepción"* dentro del cliente, pero el `03` § 5 resolvió el mismo problema en el
 * servidor —`GET /api/auth/sesion` responde 200 `{ autenticado: false }` y **nunca** 401—, así
 * que el bucle es imposible por construcción y la excepción no hace falta. Gana el `03` por
 * número más alto, y el `07` § 4 lo refuerza.
 */
export async function pedir<T>(
  camino: string,
  opciones: { metodo?: string; cuerpo?: unknown } = {},
): Promise<Respuesta<T>> {
  const { metodo = 'GET', cuerpo } = opciones;

  let respuesta: Response;
  try {
    respuesta = await fetch(camino, {
      method: metodo,
      // `no-store` en la petición además de en la respuesta: `EJECUCION` § 2 prohíbe
      // cualquier primitiva de caché en rutas del API, y el caché del propio `fetch` es una.
      cache: 'no-store',
      credentials: 'same-origin',
      headers: cuerpo === undefined ? {} : { 'content-type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(ESPERA_MS),
    });
  } catch (e) {
    // Red caída, DNS, tiempo de espera, petición cancelada. NO es "no hay datos" y NO es
    // "no tenés permiso": es la tercera cosa.
    return { tipo: 'sin_respuesta', causa: e instanceof Error ? e.message : 'desconocida' };
  }

  // Se lee el cuerpo SIEMPRE, y antes de mirar el estado. Un rechazo trae su `codigo` en el
  // cuerpo, y ese código es lo único que distingue los cinco 403 entre sí.
  let cuerpoLeido: unknown;
  try {
    cuerpoLeido = await respuesta.json();
  } catch {
    // Un 403 emitido por un proxy o por la plataforma antes de llegar al manejador devuelve
    // HTML. No se puede fingir que se entendió.
    if (!respuesta.ok) {
      return { tipo: 'rechazado', estado: respuesta.status, codigo: 'sin_codigo' };
    }
    return { tipo: 'sin_respuesta', causa: 'el cuerpo no es JSON' };
  }

  if (!respuesta.ok) {
    const codigo = (cuerpoLeido as { codigo?: unknown } | null)?.codigo;
    return {
      tipo: 'rechazado',
      estado: respuesta.status,
      codigo: typeof codigo === 'string' ? codigo : 'sin_codigo',
    };
  }

  return { tipo: 'datos', datos: cuerpoLeido as T };
}

/**
 * ¿Este rechazo significa que hay que volver al login?
 *
 * Solo el 401. Los cinco 403 **no** son "volvé a entrar":
 *
 *   · `sin_permiso` — la pantalla lo dice, y NO como "no hay datos".
 *   · los tres de estado — el frontend rutea al paso que falta. Mostrarlos como "no tenés
 *     permiso" deja a quien está en `debe_cambiar_password` sin encontrar la salida, que es
 *     justo cambiar la contraseña (03 § 5).
 *   · `organizacion_inactiva` — no es del usuario, es del inquilino.
 */
export function hayQueVolverAEntrar(r: Respuesta<unknown>): boolean {
  return r.tipo === 'rechazado' && r.estado === 401;
}
