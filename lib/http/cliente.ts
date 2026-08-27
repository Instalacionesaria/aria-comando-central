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
  | {
      readonly tipo: 'rechazado';
      readonly estado: number;
      readonly codigo: string;
      /**
       * El `detalle` del rechazo, si el servidor mandó uno. **Es texto para mostrar.**
       *
       * Se agregó porque descartarlo tiraba a la basura los únicos mensajes del sistema
       * escritos para que los lea una persona. Dos casos medidos:
       *
       *   · `cuenta_bloqueada` trae `"Esperá 15 minuto(s)."` — el número de minutos NO está
       *     en ningún otro campo, ni hay `Retry-After`. Sin `detalle`, lo mejor que puede
       *     decir una pantalla es "esperá unos minutos", que es peor y encima adivina.
       *   · `sin_sesion` desde la verificación del segundo factor trae *"Demasiados códigos
       *     incorrectos. Volvé a iniciar sesión."*, que explica por qué la sesión se cortó.
       *     Sin él, el usuario ve "la sesión venció" y no entiende qué hizo.
       *
       * `rechazo()` en `lib/autorizacion/respuesta.ts` ya garantiza qué puede ir acá:
       * *"`detalle` es opcional y **nunca** lleva nada que el cliente no deba saber"*. Así que
       * el campo ya estaba pensado para viajar; lo que faltaba era que llegara.
       *
       * Opcional y no cadena vacía: la mayoría de los rechazos no traen detalle, y un `''`
       * obligaría a cada consumidor a distinguir "no hay detalle" de "el detalle es vacío".
       */
      readonly detalle?: string;
    }
  | { readonly tipo: 'sin_respuesta'; readonly causa: string };

/**
 * Cuánto se espera antes de decir "no pude preguntar", cuando quien llama no dice otra cosa.
 *
 * Quince segundos es correcto para una lectura de la base, que es lo que hacen casi todas las rutas.
 * NO lo es para una ruta que llama a un servicio ajeno, y eso costó un defecto que llegó como una
 * queja: **«No se pudo contactar al servidor» al apretar "Traer del calendario"**.
 *
 * Lo que pasaba de verdad: ese barrido hace **diez llamadas secuenciales a GoHighLevel** —una para
 * listar los calendarios y una por cada uno— y su ruta declara `maxDuration = 300`. Contra la
 * subcuenta real tarda más de quince segundos, así que el navegador **abortaba la petición** y
 * mostraba el cartel de red caída… mientras el servidor seguía trabajando y terminaba bien.
 *
 * O sea: se reportaba un fallo sobre una operación que había salido bien. Medido contra producción
 * después de una de esas «fallas»: **118 citas escritas**, la última minutos antes.
 *
 * Por eso el tope pasa a ser un ARGUMENTO. La regla es una sola y hay que respetarla: **quien llama
 * a una ruta que declara `maxDuration` tiene que esperar al menos eso**, o está construyendo el
 * mismo defecto de nuevo.
 */
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
  opciones: { metodo?: string; cuerpo?: unknown; espera?: number } = {},
): Promise<Respuesta<T>> {
  const { metodo = 'GET', cuerpo, espera = ESPERA_MS } = opciones;

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
      signal: AbortSignal.timeout(espera),
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
    const detalle = (cuerpoLeido as { detalle?: unknown } | null)?.detalle;
    return {
      tipo: 'rechazado',
      estado: respuesta.status,
      codigo: typeof codigo === 'string' ? codigo : 'sin_codigo',
      // Se incluye solo si vino y es texto. Nunca se inventa uno a partir del código: el
      // texto de cada código es decisión de la pantalla, y un respaldo acá haría que dos
      // pantallas mostraran mensajes distintos para el mismo rechazo según cuál se acordó de
      // poner el suyo.
      ...(typeof detalle === 'string' && detalle.length > 0 ? { detalle } : {}),
    };
  }

  return { tipo: 'datos', datos: cuerpoLeido as T };
}

/**
 * ¿Este rechazo significa que hay que volver al login?
 *
 * **Se mira el CÓDIGO, no el estado**, y la diferencia importa: el login responde 401
 * `credenciales_invalidas` cuando la contraseña está mal, y eso NO es "se te venció la
 * sesión". Si esta función mirara `estado === 401`, una contraseña mal tipeada mandaría al
 * usuario al login que ya está mirando — o peor, dispararía el manejador global de sesión
 * vencida y le borraría el formulario.
 *
 * Solo `sin_sesion`. Los cinco 403 **no** son "volvé a entrar":
 *
 *   · `sin_permiso` — la pantalla lo dice, y NO como "no hay datos".
 *   · los tres de estado — el frontend rutea al paso que falta. Mostrarlos como "no tenés
 *     permiso" deja a quien está en `debe_cambiar_password` sin encontrar la salida, que es
 *     justo cambiar la contraseña (03 § 5).
 *   · `organizacion_inactiva` — no es del usuario, es del inquilino.
 */
export function hayQueVolverAEntrar(r: Respuesta<unknown>): boolean {
  return r.tipo === 'rechazado' && r.codigo === 'sin_sesion';
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAS PETICIONES SALIENTES, Y POR QUÉ VIVEN EN ESTE MISMO ARCHIVO
//
// `pedir(` habla con NUESTRO API desde el navegador. `pedirExterno(` habla desde el SERVIDOR con un
// servicio de terceros: la API de Anthropic y el almacén del hub (ver `lib/fundaciones/`).
//
// Son dos cosas distintas y comparten archivo por una razón concreta: `ADR-0305` afirma que
// `fetch(` aparece en **exactamente dos** archivos del proyecto, y esa afirmación es lo que impide
// que aparezca un segundo cliente HTTP con el manejo de errores opuesto. Un tercer archivo
// —`lib/fundaciones/anthropic.ts`, digamos— rompería la prueba, y la salida fácil sería agregarlo a
// la lista de exceptuados. Ahí se pierde la propiedad: la lista de excepciones crece y nadie vuelve
// a saber cuántos clientes HTTP hay.
//
// Lo que NO se comparte es el contrato. `pedirExterno` devuelve las MISMAS tres ramas, porque el
// motivo de las tres ramas no era el navegador: era que *"un valor significa una sola cosa"*. Un
// 402 de Anthropic ("esta organización no tiene saldo") y un tiempo de espera agotado no pueden
// llegar como el mismo `null`.
// ═══════════════════════════════════════════════════════════════════════════════

/** Cuánto se espera a un servicio externo. Una generación larga tarda minutos, no segundos. */
const ESPERA_EXTERNA_MS = 240_000;

/**
 * Pide algo a un servicio de terceros, desde el servidor.
 *
 * Diferencias con `pedir(`, todas obligadas por el destino:
 *   · el camino es una URL absoluta —el servicio está en otro dominio—;
 *   · las cabeceras las pone quien llama, porque cada servicio autentica distinto;
 *   · no manda credenciales del navegador (`credentials`): no hay navegador;
 *   · la espera es de minutos.
 *
 * `estado` viaja en la rama `rechazado` **además** del código, porque un servicio externo no
 * conoce nuestros seis códigos de rechazo: el número de situación es lo único que se puede
 * interpretar sin adivinar. `codigo` queda como `'sin_codigo'` salvo que el servicio traiga uno.
 */
export async function pedirExterno<T>(
  url: string,
  opciones: { metodo?: string; cabeceras?: Record<string, string>; cuerpo?: unknown } = {},
): Promise<Respuesta<T>> {
  const { metodo = 'GET', cabeceras = {}, cuerpo } = opciones;

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers: cuerpo === undefined ? cabeceras : { 'content-type': 'application/json', ...cabeceras },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(ESPERA_EXTERNA_MS),
    });
  } catch (e) {
    return { tipo: 'sin_respuesta', causa: e instanceof Error ? e.message : 'desconocida' };
  }

  let cuerpoLeido: unknown;
  try {
    cuerpoLeido = await respuesta.json();
  } catch {
    if (!respuesta.ok) {
      return { tipo: 'rechazado', estado: respuesta.status, codigo: 'sin_codigo' };
    }
    // Un 200 sin JSON es una respuesta que no se entendió, no un vacío legítimo.
    return { tipo: 'sin_respuesta', causa: 'el cuerpo no es JSON' };
  }

  if (!respuesta.ok) {
    const codigo = (cuerpoLeido as { error?: { type?: unknown } } | null)?.error?.type;
    return {
      tipo: 'rechazado',
      estado: respuesta.status,
      codigo: typeof codigo === 'string' ? codigo : 'sin_codigo',
    };
  }

  return { tipo: 'datos', datos: cuerpoLeido as T };
}
