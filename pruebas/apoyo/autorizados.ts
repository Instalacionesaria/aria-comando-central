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
 * Vacía hoy porque no hay ni un manejador de ruta. Cuando existan, acá van el login, la
 * comprobación de salud y el arranque.
 */
export const RUTAS_PUBLICAS: readonly string[] = [];
