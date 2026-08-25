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
  // ── Etapa 5 ──────────────────────────────────────────────────────────────────
  //
  // `lib/administracion/objetivo.ts` NO está en esta lista, y la comprobación de entradas muertas
  // lo demostró: la puse por costumbre y rompió la suite. No abre la escotilla — RECIBE la
  // transacción ya abierta. Que la lista rechace lo que no le corresponde es la mitad de su valor.
  //
  // El alta de organización. El 05 § 2 lo dice literal: *"es una de las pocas operaciones que
  // legítimamente corre SIN contexto de organización: la está creando. Si tu capa de aislamiento
  // lanza cuando no hay organización activa —y debería—, esta operación tiene que usar el acceso
  // sin filtro, y estar en la lista de autorizadas."*
  'app/api/admin/organizaciones/route.ts',
  // Las TRES operaciones que el 09 § 2 deja en identidad: *"quedan en el dominio de identidad solo
  // las tres operaciones que tocan credenciales: el alta (genera el hash de la temporal), el
  // restablecimiento y la asignación de roles."* Las tres filtran por `usuarioObjetivo()`.
  'app/api/admin/usuarios/route.ts',
  'app/api/admin/usuarios/[id]/restablecer-password/route.ts',
  'app/api/admin/usuarios/[id]/roles/route.ts',
  // Desactivar LEE identidad para contar administradores activos —`usuarios_roles` es inalcanzable
  // desde el inquilino— y ESCRIBE por el inquilino. Es una lectura en el otro dominio, no una
  // escritura: no hay una segunda mitad que pueda confirmar. La escritura sigue teniendo la red de
  // la política.
  'app/api/admin/usuarios/[id]/desactivar/route.ts',
  // El arranque del primer administrador. Corre SIN contexto de organización por el mismo motivo
  // que el alta de organización: es lo primero que existe. `EJECUCION` § 3 lo cerró como *"script
  // contra la base, no endpoint HTTP"*, así que nunca está expuesto.
  'scripts/arranque.mjs',
  // ── Etapa 6 ──────────────────────────────────────────────────────────────────
  // Las credenciales viven en `identidad.organizaciones_credenciales`, y el rol del inquilino no
  // tiene NINGÚN acceso a esa tabla —ni `select`—: es la tabla que guarda los secretos de todas las
  // organizaciones. El filtro por organización lo pone la consulta con `contexto.orgEfectiva`.
  'app/api/admin/credenciales/route.ts',
  // ── Etapa 8 ──────────────────────────────────────────────────────────────────
  // El portero, para emitir `permiso_denegado`. La auditoría es una tabla de identidad, y en el
  // paso 5 el portero ya resolvió la sesión — así que sabe de qué organización se trata y filtra
  // por ella. Y no puede ir por el dominio del inquilino: `auditoria_accesos` sí es alcanzable
  // desde ahí, pero el portero corre ANTES de que exista contexto de organización.
  'lib/autorizacion/portero.ts',
  // La sonda LEE identidad para obtener las dos organizaciones de control, y después abre el
  // contexto de cada una. Es el mismo caso que `scripts/db.mjs verificar`, y el 04 § 4 lo nombra
  // como legítimo: *"las tareas programadas necesitan la LISTA de organizaciones, y después
  // trabajar de una en una, abriendo el contexto en cada vuelta como una petición normal."*
  'lib/deteccion/sonda.ts',
  // Las dos organizaciones de control de la sonda. Escribe en `identidad.organizaciones`, que es el
  // mismo caso que el alta de organización (`app/api/admin/organizaciones/route.ts`) y que el
  // arranque: **está creando la organización**, así que no puede haber contexto de organización
  // todavía. El 05 § 2 lo nombra literal como uno de los casos que legítimamente corren sin él.
  //
  // No es un endpoint y nunca está expuesto: lo llaman `scripts/arranque.mjs` y el sembrado.
  'db/controles/sonda.ts',
  // La organización principal, contra el proveedor administrado. Mismo caso exacto que el alta
  // de organización y que el arranque: **está creando la primera organización**, así que no puede
  // haber contexto de organización todavía.
  //
  // Existe porque quedaba un hueco: las migraciones no pueden insertarla —`migrador` no tiene
  // política— y el sembrado, que sí sabe, se niega a correr contra un anfitrión remoto. Es un
  // guión, nunca un endpoint.
  'scripts/organizacion-principal.mjs',
  // ── Etapa 9 · Fundaciones ────────────────────────────────────────────────────
  //
  // Las dos operaciones de la pantalla `icp`. Es un caso NUEVO en esta lista y hay que leerlo
  // entero antes de tomarlo como precedente: no abren contexto de inquilino porque **los datos que
  // manejan no están en esta base**. El estado de Fundaciones vive en el almacén de ARIA-brain
  // (ver `lib/fundaciones/almacen.ts`), y de acá leen UNA fila: la de
  // `identidad.organizaciones_credenciales`, que trae la llave de IA de la organización y a qué
  // alumno del hub corresponde. Esa tabla es la que guarda los secretos de todas las
  // organizaciones y el rol del inquilino no tiene ni `select` sobre ella — es el mismo caso que
  // `app/api/admin/credenciales/route.ts`.
  //
  // Y por eso están acá y no en una exención cómoda: **el filtro por organización lo ponen estas
  // consultas a mano**, con `contexto.orgEfectiva`. Hay un segundo filtro que ninguna política de
  // esta base puede cubrir —el `cliente_id` con el que se le habla al almacén— y sale de esa misma
  // fila, nunca del navegador. Las dos rutas son, junto a `app/api/usuarios/route.ts`, los lugares
  // donde olvidarse un `where` devuelve datos de otra organización sin ningún error.
  'app/api/fundaciones/estado/route.ts',
  'app/api/fundaciones/generar/route.ts',
  // ── Etapa 11 ─────────────────────────────────────────────────────────────────
  // Traer los contactos de GoHighLevel. Usa la escotilla para UNA cosa: leer el token y el
  // Location ID de la organización, que viven en `identidad.organizaciones_credenciales` — una
  // tabla de identidad sobre la que el rol del inquilino no tiene ni `select`, y con razón:
  // guarda los secretos de todas las organizaciones.
  //
  // El filtro por organización lo pone esa llamada A MANO, con `contexto.orgEfectiva`, igual
  // que `app/api/fundaciones/estado/route.ts`. Todo lo que ESCRIBE va por el otro camino
  // —`conOrganizacion(` y la política de fila— así que la escotilla no toca datos de negocio.
  'app/api/contactos/sincronizar/route.ts',
  // La ficha del contacto. Lee la credencial de GoHighLevel para refrescar ese contacto al
  // abrirla, que es exactamente el mismo caso que la sincronizacion de al lado: el token vive en
  // `identidad.organizaciones_credenciales`, una tabla sobre la que el rol del inquilino no tiene
  // ni `select`. Todo lo que ESCRIBE va por `conOrganizacion(` y la politica de fila.
  'app/api/contactos/[id]/route.ts',
  // El listado de organizaciones. Es la ÚNICA consulta del sistema que cruza organizaciones A
  // PROPÓSITO. Lo que la hace aceptable no es un `where`: es `organizaciones.listar`, que solo
  // tiene el rol de plataforma, comprobada por el portero una línea antes.
  //
  // `lib/administracion/organizaciones.ts` NO está en esta lista, y no es un olvido: recibe la
  // transacción por parámetro y no llama a `conIdentidad(` ni una vez. La comprobación de
  // entradas muertas de esta lista lo atrapó, y tiene razón — una entrada de más acá enseña a
  // leer la lista como decorativa.
  'app/api/admin/organizaciones/route.ts',
  // El catálogo de roles. Lee `identidad.roles`, que es de ese dominio. No cruza nada: los
  // roles globales no pertenecen a ninguna organización.
  'app/api/admin/roles/route.ts',
  // ── Etapa 12 ─────────────────────────────────────────────────────────────────
  //
  // Editar y borrar una empresa. Es el caso simétrico del alta: la política del inquilino sobre
  // `identidad.organizaciones` es `id = app.org_id`, o sea que desde el inquilino solo se puede
  // tocar la organización PROPIA — y esto es exactamente lo contrario, el rol de plataforma
  // administrando una empresa que no es la suya.
  //
  // Lo que lo hace aceptable no es un `where`: es que `organizaciones.editar` y
  // `organizaciones.borrar` las tiene solo el rol de plataforma, comprobado por el portero una
  // línea antes. El reparto del catálogo le niega al administrador la familia entera.
  'app/api/admin/organizaciones/[id]/route.ts',
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
  // ── Etapa 5 ──────────────────────────────────────────────────────────────────
  // Desactivar: LEE identidad (contar administradores activos) y ESCRIBE por el inquilino
  // (`activo = false`). Aceptable porque **solo hay UNA escritura**: la falta de atomicidad entre
  // dominios del 09 § 6 necesita dos escrituras para producir el "éxito reportado que no ocurrió",
  // y acá la otra mitad es una lectura. Lo que sí queda es una CARRERA —entre el conteo y la
  // escritura, otro administrador podría desactivarse— y está aceptada a la vista en el propio
  // manejador, con su costo escrito.
  'app/api/admin/usuarios/[id]/desactivar/route.ts',
  // ── Etapa 8 ──────────────────────────────────────────────────────────────────
  // La sonda: LEE identidad (la lista de organizaciones de control) y LEE negocio por el contexto
  // de cada una. **No escribe en ninguno de los dos**, así que la falta de atomicidad entre dominios
  // del 09 § 6 no la afecta: no hay una mitad que pueda confirmar mientras la otra falla. Es
  // exactamente el mismo caso que `scripts/db.mjs`, y con el mismo comentario.
  'lib/deteccion/sonda.ts',
  // Los controles de la sonda: ESCRIBE en los dos —organizaciones por `conIdentidad()`, sus filas
  // de control por `conOrganizacion()`— y por lo tanto es el caso peligroso de verdad, no la
  // variante con una sola escritura de las dos entradas de arriba.
  //
  // Escribir el bloque que el 09 § 6 exige ENCONTRÓ UN DEFECTO, y vale dejarlo dicho acá: con la
  // primera mitad confirmada y la segunda fallada, quedaba una organización de control sin su fila,
  // y la sonda —que contaba organizaciones y no filas— devolvía "todo bien" habiendo revisado una
  // sola. El "éxito reportado que no ocurrió", en la única cosa que puede detectar la fuga misma.
  //
  // Aceptable ahora por tres propiedades, las tres escritas en el encabezado del archivo: se
  // DETECTA (la sonda avisa con gravedad máxima), se REPARA volviendo a correr el arranque
  // —idempotente por organización y por mitad—, y no hay datos de nadie que perder.
  'db/controles/sonda.ts',
  // ── Etapa 11 ─────────────────────────────────────────────────────────────────
  // Traer los contactos de GoHighLevel: LEE identidad (el token y el Location ID de la
  // organización) y ESCRIBE por el inquilino (`negocio.contactos`).
  //
  // ── QUÉ PASA SI LA SEGUNDA MITAD FALLA ──
  //
  // La mitad de identidad **no escribe en el camino de éxito**. `resolverAccesoAGhl` solo lee;
  // su única escritura posible es la fila de auditoría `credencial_ilegible`, y ésa ocurre
  // exactamente en la rama que devuelve `falta` — donde la segunda mitad NUNCA corre. Así que
  // el defecto del 09 § 6 —una mitad confirmada y la otra fallida produciendo un éxito
  // reportado— no se puede dar acá: hace falta que las dos escriban, y una no escribe.
  //
  // Lo que SÍ puede quedar a medias es dentro del dominio de negocio: los contactos se
  // escriben de a uno, no en una transacción, así que si GoHighLevel falla en la página tres
  // quedan guardados los de las dos primeras. Es aceptable y está sostenido por dos cosas
  // escritas en el código, no por suerte:
  //
  //   · el `insert … on conflict (org_id, ghl_contact_id) do update` es IDEMPOTENTE, así que
  //     volver a traer completa lo que faltó en vez de duplicar;
  //   · el manejador responde el FALLO, no un éxito parcial disfrazado — y cuando sí termina,
  //     devuelve el resumen con los salteados y el aviso de truncado, que son los dos casos en
  //     que la lista queda corta y parece completa.
  'app/api/contactos/sincronizar/route.ts',
  // La ficha: lee la credencial por identidad y escribe el contacto refrescado por el inquilino.
  //
  // Lo que queda a medias si la segunda mitad falla es NADA, y por eso es aceptable: la primera
  // solo LEE. Y el orden lo garantiza — la ficha se arma de la cache ANTES del refresco, asi que
  // un fallo del CRM no impide abrirla, solo deja el aviso de que no se actualizo.
  'app/api/contactos/[id]/route.ts',
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

/**
 * Las rutas con su PROPIA autenticación, que no es una sesión.
 *
 * Una sola, y es la única del sistema que no encaja en ninguna de las otras dos categorías. Eso hay
 * que resolverlo a la vista en vez de meterla en la lista que menos moleste:
 *
 *   · **no puede pasar por el portero**: no hay sesión. La llama una tarea programada, y `exigir()`
 *     respondería 401 a la única cosa que puede detectar una fuga en producción;
 *   · **no puede ser pública**: dejar que cualquiera la llame es dejar que cualquiera pregunte por el
 *     estado del aislamiento y consuma conexiones de la base sin autenticarse.
 *
 * Así que tiene un secreto compartido en una cabecera, comparado con `timingSafeEqual`. Sin el
 * secreto configurado la ruta responde 403 y **no corre la sonda**: no hay respaldo, porque una
 * sonda que corre sin autenticación es un punto de entrada abierto.
 *
 * Esta lista existe para que agregar una segunda entrada sea un acto deliberado. Un endpoint con
 * "su propia autenticación" es exactamente la forma que toma un portero saltado por comodidad.
 */
export const RUTAS_CON_SECRETO_PROPIO: readonly string[] = ['app/api/sonda/route.ts'];
