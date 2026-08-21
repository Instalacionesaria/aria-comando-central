// La lista de archivos autorizados. UNA sola, UN solo nombre, en UN solo lugar.
//
// El 04 § 4 es explícito sobre por qué este archivo existe y no tres copias:
//
//   "UNA sola lista, UN solo nombre, y en UN solo lugar del código. Esta lista la usan
//    TRES pruebas distintas —la del portero, la del contexto y la del acceso sin
//    filtro—: si cada una tiene su propia copia, DIVERGEN y las tres pasan mientras el
//    archivo nuevo se escapa por la que no lo mira."
//
// El punto no es prohibir la escotilla —hace falta— sino que **agregarla sea un acto
// deliberado que aparece en un cambio que alguien revisa**, en vez de una decisión que
// se toma sola a las dos de la mañana con un "solo esta vez".

/**
 * Los archivos que pueden usar `conIdentidad(` — el acceso al dominio de identidad,
 * sin filtro de organización.
 *
 * El 04 § 4 nombra cuatro operaciones que legítimamente cruzan organizaciones, y
 * enseguida aclara que **hace falta menos de lo que parece**: de las cuatro, tres NO
 * necesitan leer datos de negocio sin filtro —las tareas programadas necesitan la
 * *lista* de organizaciones y después trabajan de una en una; el enrutador de eventos
 * consulta una tabla de identidad; el alta de organización escribe en `organizaciones`,
 * que tampoco es de negocio—. Queda solo el login.
 *
 * Rutas relativas a la raíz del repo, siempre con `/`.
 */
export const ARCHIVOS_AUTORIZADOS: readonly string[] = [
  // Define la función. Es el dominio de identidad entero.
  'lib/datos/capa.ts',
  // El sembrado de desarrollo escribe organizaciones y usuarios, que son identidad.
  // Está acá porque el propio 04 § 4 advierte que sin la exención "la prueba falla
  // sobre código correcto y se termina ignorando".
  'db/sembrado/organizaciones.ts',
  // La fase `verificar` lee las organizaciones para recorrerlas de una en una. Es
  // exactamente el caso que el 04 § 4 nombra como legítimo: las tareas programadas
  // "necesitan la LISTA de organizaciones, y después trabajar de una en una, abriendo el
  // contexto en cada vuelta como una petición normal". No lee datos de negocio sin
  // filtro.
  'scripts/db.mjs',
  // ── Etapa 3 ──────────────────────────────────────────────────────────────────
  // Resolver la sesión ES el dominio de identidad: `identidad.sesiones` no tiene columna de
  // organización, porque se busca por hash de token ANTES de saber quién es nadie. El rol
  // del inquilino no tiene ni `select` sobre esa tabla, así que esto no es una comodidad:
  // es el único camino que existe.
  'lib/autorizacion/sesion.ts',
  // Las tres operaciones de la propia sesión: leerla, borrarla, y cambiar la organización
  // activa del rol de plataforma. Las tres escriben o leen `identidad.sesiones`.
  'app/api/auth/sesion/route.ts',
  // La lista de usuarios de la organización efectiva. Es el caso que el 04 § 4 llama
  // legítimo y a la vez el más peligroso: acá el filtro por organización lo pone la consulta
  // A MANO (`where org_id = contexto.orgEfectiva`), porque la política de identidad para este
  // rol es `using (true)`. Es el único lugar del sistema donde olvidarse un `where` devuelve
  // filas de otra organización sin error — y por eso está en una lista que alguien revisa.
  'app/api/usuarios/route.ts',
  // ── Etapa 4 ──────────────────────────────────────────────────────────────────
  // El login. Es el caso que el 04 § 4 nombra como el ÚNICO que de verdad necesita la
  // escotilla: *"de las cuatro [operaciones que cruzan organizaciones], tres NO necesitan
  // leer datos de negocio sin filtro… Queda solo el login."* Y no puede ser de otra forma:
  // busca por correo, ANTES de saber a qué organización pertenece nadie.
  'app/api/auth/login/route.ts',
  // El registro de accesos. `auditarSuelto()` abre su propia transacción de identidad para
  // los caminos donde no hay nada más que escribir —un rechazo por freno, un intento contra
  // un correo inexistente—. `auditoria_accesos` es una tabla de identidad y la escritura no
  // tiene organización cuando el usuario no existe.
  'lib/autenticacion/auditoria.ts',
  // Las tres rutas del segundo factor. Escriben y leen `identidad.usuarios_segundo_factor`,
  // que es identidad pura: el secreto se busca por usuario, no por organización, y el rol del
  // inquilino no tiene ningún acceso a esa tabla.
  'app/api/auth/2fo/configurar/route.ts',
  'app/api/auth/2fo/confirmar/route.ts',
  'app/api/auth/2fo/verificar/route.ts',
];

/**
 * Los archivos que pueden tocar LOS DOS dominios en un mismo archivo.
 *
 * El 09 § 6 dice por qué esto necesita vigilancia: "una operación que escribe en los dos
 * dominios NO PUEDE SER ATÓMICA. Son dos transacciones distintas; una puede confirmar y
 * la otra fallar. Y si la segunda mitad falla, la respuesta —a menos que alguien lo haya
 * pensado— va a decir que todo salió bien, porque la primera mitad funcionó. Es
 * exactamente UN ÉXITO REPORTADO QUE NO OCURRIÓ."
 *
 * `PRUEBAS.md` dice que estos archivos "se revisan a mano". Eso no es una prueba, así que
 * acá está como lista blanca instantánea: un archivo nuevo en la intersección rompe la
 * suite hasta que alguien lo agregue a propósito. Es la misma forma que el 04 § 4
 * defiende para la escotilla.
 */
export const CRUZAN_LOS_DOS_DOMINIOS: readonly string[] = [
  // El sembrado: identidad por `conIdentidad()`, negocio por bucle de
  // `conOrganizacion()`. Aceptable porque es idempotente POR DESTRUCCIÓN —`db:reset`
  // tira la base primero, así que una falla a medias se arregla volviendo a correrlo— y
  // porque `db.mjs verificar` es una fase aparte que comprueba el EFECTO, no la ausencia
  // de error.
  'db/sembrado/organizaciones.ts',
  // La fase `verificar` de `db.mjs`: lee identidad para obtener la lista de
  // organizaciones y después abre el contexto de cada una para contar sus filas de
  // negocio. NO ESCRIBE EN NINGUNO DE LOS DOS — solo lee, así que la falta de atomicidad
  // entre dominios no la afecta: no hay una mitad que pueda confirmar mientras la otra
  // falla. Si algún día escribe, hay que volver a pensarlo acá.
  'scripts/db.mjs',
];

/**
 * Las rutas públicas: no exigen sesión y no abren contexto de organización.
 *
 * DOS ENTRADAS, NO TRES, y la diferencia está resuelta por precedencia. `PRUEBAS.md` dice
 * *"salvo las rutas públicas (login, salud, arranque)"*, pero `EJECUCION` § 3 cerró que el
 * arranque del primer administrador es un **script contra la base, no endpoint HTTP** — y el
 * 03 § 6 coincide con `EJECUCION`: su pseudocódigo dice *"(login, salud)"*, sin arranque. Una
 * tercera entrada rompería la comprobación de entradas muertas de abajo.
 *
 * El login es de la Etapa 4. Hoy está la salud, y nada más.
 */
export const RUTAS_PUBLICAS: readonly string[] = [
  'app/api/salud/route.ts',
  // El login. Es público por definición —no puede exigir sesión para crear una— y aun así
  // **verifica el origen**: el 08 § 5.3 pone `verificarOrigen` "en el portero", el login no
  // pasa por el portero, y la fila de PRUEBAS de la Etapa 3 pide que toda petición que
  // modifica lo verifique. Estar en esta lista lo exime del portero, NO de la verificación
  // de origen, y hay una prueba que lo afirma.
  'app/api/auth/login/route.ts',
];

/**
 * Las rutas que usan `sesionOpcional(` en vez del portero.
 *
 * NO son públicas y no son una excepción cómoda: tienen su propio contrato, definido en el
 * paso 0 del 03 § 5. `exigir(` LANZA si se lo llama con una de ellas, así que no es posible
 * pasar por el camino equivocado sin que reviente.
 *
 * Están separadas de `RUTAS_PUBLICAS` a propósito: una ruta pública no mira la sesión; éstas
 * la miran y **toleran que no haya**. Colapsar las dos listas convertiría "tolera que no
 * haya sesión" en "no mira la sesión", que es un permiso mucho más grande.
 */
export const RUTAS_CON_SESION_OPCIONAL: readonly string[] = ['app/api/auth/sesion/route.ts'];
