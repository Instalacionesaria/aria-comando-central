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
  // La preferencia de tema de quien pide. Escribe UNA columna de `identidad.usuarios` y el `where`
  // es `contexto.usuarioId`, que sale de la cookie de sesión y no del cuerpo: no hay parámetro que
  // pueda nombrar a otra persona. No abre contexto de organización porque no toca ni una fila de
  // negocio — es una preferencia de quien mira, sobre sí mismo, y el rol del inquilino ni siquiera
  // tiene `select` sobre esa columna (sus privilegios en `usuarios` son POR COLUMNA).
  'app/api/auth/tema/route.ts',
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
  // ── Las dos rutas de la pantalla `tools` ────────────────────────────────────
  //
  // Mismo caso que las de Fundaciones, y por el mismo motivo: el estado de las herramientas no
  // está en esta base —vive en el almacén de ARIA-brain—, y de acá se lee UNA fila, la de
  // credenciales, que el rol del inquilino no puede ni mirar. Así que el filtro por organización
  // lo pone la consulta a mano con `contexto.orgEfectiva`, y eso es lo que necesita lista blanca.
  'app/api/tools/estado/route.ts',
  'app/api/tools/generar/route.ts',
  // Subir leads seleccionados al CRM. Lee el Private Integration Token de GoHighLevel por
  // identidad —`organizaciones_credenciales` es inalcanzable desde el rol del inquilino— con
  // `resolverAccesoAGhl`, exactamente como la ruta de mensajes. El filtro por organización lo
  // pone la propia función con `contexto.orgEfectiva`.
  'app/api/tools/leads/enviar/route.ts',
  //
  // ── EL PROXY DEL SCRAPER SALIÓ DE ESTA LISTA, Y VALE DECIR POR QUÉ ──────────
  //
  // `app/api/tools/scrape/route.ts` estuvo acá mientras el monedero de leads vivía en una base
  // ajena indexada por `fundaciones_cliente_id`: para saber de quién era el saldo había que
  // leer la fila de credenciales de la organización, que el rol del inquilino no puede mirar.
  //
  // Con `006_aria_cc_scraper.sql` el monedero pasó a esta base y su llave es `org_id`, que el
  // portero ya entrega en `contexto.orgEfectiva`. La ruta dejó de necesitar identidad, así que
  // la entrada quedó MUERTA — y la comprobación de entradas muertas de
  // `10-arquitectura.test.ts` la habría delatado, que es exactamente para lo que está: *"una
  // autorización que ya no hace falta queda habilitando algo que nadie va a volver a mirar"*.
  //
  // Lo mismo va a pasar con las dos de arriba cuando Fundaciones lea de `aria_cc_foundations`
  // por `org_id`. Si alguien vuelve a agregar el proxy acá, es señal de que algo se reatipó al
  // hub y hay que preguntar por qué.
  // ── Etapa 13 · el chat ───────────────────────────────────────────────────────
  //
  // Mandar un mensaje. Lee el token de GoHighLevel por identidad, exactamente como las dos de
  // arriba, y escribe la fila del mensaje por `conOrganizacion(` y la política de fila.
  'app/api/contactos/[id]/mensajes/route.ts',
  // Los PORCENTAJES DE COMISIÓN. Lee `identidad.usuarios` para comprobar que la persona a la que se
  // le fija el porcentaje es de esta empresa, y tiene que ser por identidad y no por el inquilino:
  // `usuarioObjetivo(` selecciona `es_admin_principal`, y el rol del inquilino tiene concedidas cinco
  // columnas de esa tabla y ésa no es una. Medido a golpes: la versión anterior falló con
  // «permission denied for table usuarios».
  //
  // La escritura va entera por `conOrganizacion(`, incluida la fila de auditoría — que puede ir por el
  // inquilino porque la migración 005 le da `insert` con una política que exige que `org_id` sea el de
  // la sesión. Eso es mejor que auditar por identidad: **la comisión y su rastro van en la misma
  // transacción**, así que no existe el estado «se cambió el porcentaje y no quedó registrado quién».
  'app/api/admin/comisiones/route.ts',
  // QUIÉN ES EL CLOSER. Lee de identidad **quiénes pueden serlo**, y ahí no hay alternativa: la
  // condición son capacidades y secciones concedidas, y las tres fuentes que lo dicen —la vista
  // `usuarios_permisos`, `usuarios_roles` y `usuarios_secciones`— solo las alcanza `app_identidad`.
  // El rol del inquilino no las tiene concedidas.
  //
  // Y esa lectura no es una comodidad: es la que hace cumplir la regla de que un administrador no
  // pueda ser closer. Sin ella el endpoint solo podría comprobar que el usuario existe, y un
  // administrador existe — mandaría su propio identificador en el cuerpo y quedaría designado.
  //
  // La escritura va entera por `conOrganizacion(`, incluida la auditoría, por el mismo motivo que
  // arriba: la designación y su rastro en la misma transacción.
  'app/api/admin/closer/route.ts',
  // Avanzar. Lee el token para avisarle al CRM qué resultado se registró, y esa era la ÚNICA
  // escritura al CRM de todo el sistema hasta que apareció la de abajo. Todo lo que escribe en la
  // base va por `conOrganizacion(`.
  'app/api/contactos/[id]/avanzar/route.ts',
  /* ── Etapa 13 · resolver una intervención ─────────────────────────────
   *
   * Lee el token por el mismo motivo que Avanzar y para la operación simétrica: **quitarle al CRM
   * las etiquetas que tienen pausado al agente**. Es la segunda escritura al CRM del sistema.
   *
   * Y la lectura es la mínima: `resolverAccesoAGhl` de SU propia organización, la que el portero ya
   * resolvió. No hay ninguna consulta sin filtro. Todo lo que escribe en la base va por
   * `conOrganizacion(`, dentro de `resolverLaIntervencion`. */
  /* ── Etapa 13 · la pantalla del técnico ───────────────────────────────
   *
   * Lee `resolverAccesoAlAuditor` de SU propia organización —la que el portero ya resolvió— para
   * saber si esta empresa audita, que es el primero de los tres estados de las tarjetas. No hay
   * ninguna consulta sin filtro, y **la pantalla no escribe nada**: es un `GET`. */
  'app/api/auditoria/route.ts',
  'app/api/contactos/[id]/resolver/route.ts',
  /* ── Etapa 5.5 · el aviso del CRM ───────────────────────────────────
   *
   * Usa `conIdentidad(` para DOS lecturas, y ninguna es un descuido:
   *
   *   1. buscar la empresa por el **hash de su secreto**. Es la llave de atribución: sin esta
   *      lectura no hay forma de saber de quién es el aviso, y la alternativa —sacarla del cuerpo
   *      del webhook— es la fuga que la plataforma anterior tenía, porque el cuerpo lo controla
   *      quien manda el evento;
   *   2. resolver su acceso al CRM, para poder releer el contacto y su territorio.
   *
   * Las dos son de solo lectura y las dos van ANTES de escribir nada. */
  'app/api/avisos/crm/route.ts',
  // Traer las citas del calendario. Mismo motivo para el token, y **no llama a `conOrganizacion(`
  // en el manejador**: es una cáscara que delega en `lib/negocio/citas.ts`, que lo abre para cada
  // una de sus escrituras. Estar acá lo exime también de `ADR-0202`, así que queda dicho dónde vive
  // el contexto: en `barrerCitas(`, que recibe la organización por parámetro y nunca la deduce.
  //
  // La cáscara existe por lo mismo que la de la ingesta: el barrido hace diez llamadas contra un
  // servicio ajeno, y sostener una transacción mientras tanto retendría una conexión del agrupador
  // todo ese rato.
  'app/api/closer/agenda/refrescar/route.ts',
  // Las TAREAS PROGRAMADAS. Mismo motivo para el token, y uno propio además: necesita **la lista de
  // organizaciones**, que es la única consulta del sistema que cruza organizaciones a propósito.
  //
  // Las dos cosas viven en identidad: `identidad.organizaciones_credenciales` es una tabla sobre la
  // que el rol del inquilino no tiene ni `select`, y la lista de empresas por definición no puede
  // filtrarse por una organización. Estar acá lo exime también de `ADR-0202`, así que queda dicho
  // dónde vive el contexto de inquilino: en `ingerirMensajes(` y `barrerCitas(`, que reciben la
  // organización por parámetro y nunca la deducen, y en el bucle de `barrerTodo(`, que abre
  // `conOrganizacion(` una vez por empresa y una vez por sello.
  //
  // `resolverAccesoAGhl` se llama UNA VEZ POR EMPRESA, no con una consulta que traiga todas las
  // credenciales juntas. Esa consulta sería más rápida y sumaría un cuarto lugar donde el filtro por
  // organización lo pone una consulta escrita a mano — y olvidarse un `where` ahí entrega el token de
  // una empresa a otra sin ningún error.
  'app/api/cron/route.ts',
  // El ciclo de ingesta. Mismo motivo para el token, y **no llama a `conOrganizacion(` en el
  // manejador**: es una cáscara que delega en `lib/negocio/ingesta.ts`, que lo abre para cada una
  // de sus tres transacciones cortas. Está acá por el token, y estar acá lo exime también de
  // `ADR-0202` — así que queda dicho dónde vive el contexto: en `ingerirMensajes(`, que recibe la
  // organización por parámetro y nunca la deduce.
  //
  // La cáscara existe porque el candado NO puede vivir en una sola transacción: un ciclo hace
  // hasta trece llamadas contra un servicio ajeno, y sostener la transacción mientras tanto
  // retendría una conexión del agrupador todo ese rato.
  'app/api/mensajes/ingesta/route.ts',
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
  // ── Etapa 12 · el alta de los Clientes High Ticket ───────────────────────────
  //
  // Crea organizaciones y usuarios, así que corre SIN contexto de organización — el mismo caso que
  // `scripts/arranque.mjs` y que el alta de organizaciones de arriba, y el `05` § 2 lo nombra
  // literal: *"es una de las pocas operaciones que legítimamente corre SIN contexto de
  // organización: la está creando."*
  //
  // No es un endpoint: `EJECUCION` § 3 cerró que el alta de administradores es *"script contra la
  // base, no endpoint HTTP"*, así que nunca está expuesto. Corre a mano, y por omisión no escribe.
  'scripts/altas-high-ticket.mjs',
  // ── El Panel de Monitoreo ────────────────────────────────────────────────────
  //
  // Lee la LISTA de organizaciones y nada más. Es literalmente el caso que el 04 § 4 nombra como
  // legítimo —*"necesitan la lista de organizaciones, y después trabajar de una en una, abriendo
  // el contexto en cada vuelta como una petición normal"*— y es exactamente lo que hace: el
  // consumo de cada empresa sale por `conOrganizacion(`, o sea por la misma política de RLS que
  // pasaría una petición de esa empresa.
  //
  // Lo que NO hace, y es la mitad que importa: **no lee ni una fila de negocio por esta puerta.**
  // Si lo intentara, el rol de identidad no tiene el privilegio y fallaría fuerte y a la vista,
  // que es la propiedad que hace que esta escotilla sea aceptable.
  'app/api/monitoreo/route.ts',
  // El detalle de UNA empresa del panel. Lee identidad para UNA cosa: comprobar que el
  // identificador pedido corresponde a una empresa real —y no a una de las dos organizaciones de
  // control de la sonda—. Todo lo demás sale por `conOrganizacion(`. Usa `listarOrganizaciones`,
  // la misma función que la tabla, para que la exclusión de las de control sea la MISMA: dos
  // listas que tienen que coincidir son dos listas que se desincronizan.
  'app/api/monitoreo/[orgId]/route.ts',
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
  // Subir leads al CRM. **Qué queda a medias si la segunda mitad falla: NADA.** Es el caso más
  // benigno de esta lista, porque NINGUNA de las dos mitades escribe en nuestra base: la primera
  // LEE el token de identidad, la segunda LEE los leads de negocio, y la única escritura es a un
  // sistema externo, después de que las dos lecturas salieron bien. No hay confirmación parcial
  // posible.
  //
  // Lo que sí puede quedar a medias es la escritura EXTERNA: si n8n crea los contactos y la
  // respuesta se pierde en el camino, quien mira la pantalla ve un fallo y va a reintentar,
  // duplicando contactos en el CRM. No es un problema de atomicidad entre dominios —el que esta
  // lista vigila— y no se arregla con una transacción; haría falta una llave de idempotencia del
  // lado del flujo. Queda dicho acá porque es la pregunta que alguien va a hacerse al leer esto.
  'app/api/tools/leads/enviar/route.ts',
  // Los porcentajes de comisión. **Qué queda a medias si la segunda mitad falla: nada**, porque la
  // primera no escribe — se lee de identidad quién es la persona y se escribe en negocio su
  // porcentaje. Es la misma forma y la misma justificación que la ingesta de mensajes.
  'app/api/admin/comisiones/route.ts',
  // Quién es el closer. **Qué queda a medias si la segunda mitad falla: nada.** El `GET` solo lee
  // —identidad para los candidatos, negocio para el porcentaje y la designación— y el `PUT` lee de
  // identidad ANTES de escribir: si la lectura falla no se escribió nada, y si la escritura falla la
  // lectura no dejó rastro. Es la misma forma y la misma justificación que los porcentajes.
  'app/api/admin/closer/route.ts',
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
  // ── Etapa 13 ─────────────────────────────────────────────────────────────────
  //
  // Mandar un mensaje: lee la credencial por identidad y escribe la fila por el inquilino.
  //
  // Y ACÁ SÍ HAY UN ESTADO A MEDIAS POSIBLE, así que se dice de frente: si el alta de la fila
  // falla después de que el canal aceptó el mensaje, **el contacto lo recibió y nosotros no
  // tenemos registro**. No es una hipótesis cómoda: es el orden inevitable, porque el
  // identificador que se guarda lo devuelve el envío.
  //
  // Lo que lo hace aceptable es que **se repara solo, y sin intervención**: ese mensaje existe en
  // la conversación del CRM, así que la ingesta lo trae en el ciclo siguiente con su
  // identificador de verdad. La ventana de inconsistencia es de un ciclo, y lo único que se
  // pierde en el medio es la atribución a la persona que lo escribió — la fila reconstruida dice
  // `agente` en vez de su nombre.
  'app/api/contactos/[id]/mensajes/route.ts',
  // Avanzar: escribe el resultado por el inquilino y le avisa al CRM por identidad.
  //
  // ── EL ORDEN ES LA RESPUESTA A ESTA PREGUNTA ────────────────────────────────
  //
  // Qué queda a medias si la segunda mitad falla: **el CRM no disparó sus automatismos**. El
  // resultado está registrado, los números de Inicio ya lo cuentan y el contacto ya se movió de
  // columna; lo único que falta es el aviso. Se puede reintentar, y **la respuesta lo dice** en su
  // propio campo `crm` en vez de colapsarlo en el éxito general.
  //
  // Al revés —CRM primero— un fallo de la base dejaría al CRM disparando flujos por un resultado
  // que acá no existe: nadie sabría que pasó, no habría fila que reintentar, y no se repara solo.
  // Por eso el orden no es preferencia, y está escrito en el encabezado del manejador.
  'app/api/contactos/[id]/avanzar/route.ts',
  /* ── Etapa 13 · resolver una intervención ─────────────────────────────
   *
   * Qué queda a medias si falla la segunda mitad: **la etiqueta sigue puesta en el CRM, así que el
   * agente sigue pausado**. El aviso está cerrado acá, el contacto ya salió de la cola roja y quedó
   * el rastro de quién lo tomó; lo único que falta es reactivar el agente, y hay que hacerlo a mano
   * en el CRM. **La respuesta lo dice en su propio campo `crm`** en vez de colapsarlo en el éxito.
   *
   * Y NO se devuelve un error: la resolución ya ocurrió. Un 502 haría que el vendedor apretara el
   * botón otra vez sobre algo que ya está hecho, y a la tercera dejaría de leer la respuesta.
   *
   * Al revés —CRM primero— un fallo de la base dejaría al contacto sin etiqueta y con la
   * intervención abierta: el agente vuelve a atender **y la cola sigue pidiendo que alguien lo
   * tome**. Los dos estados que no queremos, a la vez. */
  /* ── Etapa 13 · la pantalla del técnico ───────────────────────────────
   *
   * Qué queda a medias si falla la segunda mitad: **NADA**, y sale de que este archivo NO ESCRIBE.
   * Es un `GET` con dos lecturas: si esta empresa audita (identidad) y qué encontró el auditor
   * (negocio). La única escritura que hay en el camino es ajena y ya está resuelta —
   * `resolverAccesoAlAuditor` registra `credencial_ilegible` **en su propia transacción de
   * identidad**, que es lo que `ADR-0809` exige.
   *
   * Está en la lista igual porque la comprobación es sintáctica —cruza `conIdentidad(` con
   * `conOrganizacion(`— y **así tiene que ser**: distinguir lectura de escritura leyendo el código
   * es justo lo que una prueba no puede hacer bien, y el lado por el que conviene equivocarse es
   * pedir que alguien escriba estas cinco líneas. */
  'app/api/auditoria/route.ts',
  'app/api/contactos/[id]/resolver/route.ts',
  /* ── Etapa 5.5 · el aviso del CRM ───────────────────────────────────
   *
   * Esta lista exige responder qué queda A MEDIAS si falla la segunda mitad. La respuesta es
   * **NADA**, y sale del orden:
   *
   *   1. IDENTIDAD, y solo LEE: la empresa por el hash de su secreto, y su acceso al CRM. Dos
   *      `select`, cero escrituras.
   *   2. NEGOCIO, y ahí sí escribe: la fila de cuarentena, y después el contacto y el mensaje.
   *
   * Si falla la primera no hay nada escrito y se responde 503 — el proveedor reintenta, y el sondeo
   * lo trae igual. Si falla la segunda, identidad no se tocó.
   *
   * Y el orden inverso no es «peor» sino imposible: sin la lectura de identidad no se sabe de qué
   * empresa es el evento, así que no hay contexto de inquilino que abrir. */
  'app/api/avisos/crm/route.ts',
  // El Panel de Monitoreo: identidad para la lista de empresas, negocio por un bucle de
  // `conOrganizacion()`. **Qué queda a medias si la segunda mitad falla: nada, porque NO
  // ESCRIBE.** Las dos mitades son lecturas, así que el "éxito reportado que no ocurrió" del
  // 09 § 6 —que necesita dos escrituras— no es alcanzable acá. Es la misma forma y la misma
  // justificación que la fase `verificar` de `db.mjs`, que recorre las organizaciones igual.
  //
  // Y la lectura de cada empresa está envuelta en su propio `try`: una que falle deja su fila
  // marcada `ilegible` en vez de tumbar el panel entero. Eso NO es tolerancia a la falta de
  // atomicidad —no hay nada que deshacer— es que un tablero que desaparece por una empresa con
  // problemas es un tablero que no sirve justo el día que hace falta.
  'app/api/monitoreo/route.ts',
  // El detalle de una empresa: identidad para resolver cuál es, negocio por `conOrganizacion()`.
  // **Qué queda a medias si la segunda mitad falla: nada, porque NO ESCRIBE.** Las dos mitades
  // son lecturas, así que el "éxito reportado que no ocurrió" del 09 § 6 —que necesita dos
  // escrituras— no es alcanzable. Y la lectura de identidad va PRIMERO a propósito: si la empresa
  // no existe se responde 404 sin haber abierto ningún contexto de inquilino.
  'app/api/monitoreo/[orgId]/route.ts',
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
 * Las mutaciones que se autorizan con una capacidad de LECTURA, y por qué cada una.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA REGLA QUE ESTA LISTA EXIME, Y EL DEFECTO QUE LA REGLA ATRAPA
 *
 * Un método que modifica no puede quedar satisfecho por una capacidad `.ver`: eso deja a un rol de
 * consulta —uno con `.ver` y sin `.editar`, que `ADR-0304` defiende explícitamente que pueda
 * existir— ejecutando escrituras.
 *
 * Se descubrió mutando el `POST` que genera el secreto del aviso del CRM: cambiar su
 * `credenciales.editar` por `credenciales.ver` dejaba la suite entera en verde, y habilitaba que
 * alguien con permiso de solo mirar **rotara el secreto** — lo que invalida el anterior en el acto,
 * corta las siete entregas de GoHighLevel, y no se puede deshacer porque el secreto viejo no queda
 * guardado en ninguna parte.
 *
 * ── POR QUÉ HAY EXCEPCIONES, Y POR QUÉ SE DECLARAN UNA POR UNA ─────────────
 *
 * «Modifica» por método HTTP y «modifica algo que quien lee no tiene derecho a cambiar» no son lo
 * mismo. Las cuatro de abajo son `POST`/`PATCH` porque escriben, pero lo que escriben es (a) nuestra
 * propia caché con datos que la persona ya puede ver, o (b) una columna de su propia fila. Ninguna
 * decide quién puede ver qué, y ninguna destruye nada.
 *
 * Esa distinción es un juicio, no un patrón — así que se ejerce una vez por ruta y queda escrita,
 * igual que `RUTAS_PUBLICAS` y `SIN_PANTALLA`. Lo que importa es que la trampa sigue armada para la
 * quinta: agregar una ruta así sin pensarlo pone la prueba en rojo.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const MUTACIONES_CON_CAPACIDAD_DE_LECTURA: readonly string[] = [
  /* Traer las citas del calendario de GoHighLevel a nuestra caché. No decide territorio y no crea
     nada: reescribe con lo que el CRM dice, y lo que trae es exactamente lo que la Agenda ya muestra
     a quien tiene `closer.ver`. El `POST` es por el costo —diez llamadas al proveedor— y porque un
     `GET` con efectos no se puede poner detrás de una caché, no porque cambie autoridad. */
  'app/api/closer/agenda/refrescar/route.ts',

  /* La meta del mes de la propia persona, y su encabezado ya lo argumenta: *«se escribe una columna
     de la fila de quien está pidiendo, y de ninguna otra»*. Exigir una capacidad de administración
     acá sería MÁS estricto y estaría mal — el anillo diría «cargá tu meta» y el botón fallaría para
     todo el equipo salvo quien administra. */
  'app/api/closer/meta/route.ts',

  /* Y la del setter, por lo mismo. Es la misma operación sobre la misma tabla —una columna de la
     fila de quien pide— con una diferencia que **no cambia la autoridad**: son dos filas en vez de
     una, porque el `tipo` está en la clave primaria y el setter tiene dos tramos.
     El `tramo` llega del navegador y se valida contra una lista de DOS, no contra las tres de la
     base: dejar pasar `'closer'` le permitiría a un setter escribirle la meta al closer, y el `check`
     de la base no lo impediría porque ese tipo es válido. Esa guarda está en la ruta y probada. */
  'app/api/setter/meta/route.ts',

  /* Traer los contactos del CRM. Mismo caso que refrescar la agenda: trae las dos zonas y el
     territorio se decide en el servidor al LEER, no acá. */
  'app/api/contactos/sincronizar/route.ts',

  /* Un ciclo de ingesta de mensajes. Escribe mensajes que vienen del CRM —no los inventa— y son los
     mismos que la conversación ya muestra a quien tiene `contactos.ver`. */
  'app/api/mensajes/ingesta/route.ts',
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
export const RUTAS_CON_SECRETO_PROPIO: readonly string[] = [
  'app/api/sonda/route.ts',
  // ── Etapa 13 · las tareas programadas ──────────────────────────────────────
  //
  // La segunda entrada, y el comentario de arriba pide que sea un acto deliberado. Lo es, y por el
  // mismo par de razones que la sonda:
  //
  //   · **No puede pasar por el portero**: no hay sesión. La llama el disparador de la plataforma, y
  //     `exigir()` respondería 401 a CADA corrida — o sea que la ingesta de mensajes y el barrido de
  //     citas no correrían nunca, y el síntoma sería «el chat tiene dos días de atraso», no un error.
  //   · **No puede ser pública**: dispararía la ingesta y el barrido de todas las empresas para
  //     cualquiera en internet, con su coste en llamadas al proveedor.
  //
  // Su autenticación es `Authorization: Bearer CRON_SECRET`, comparada con `timingSafeEqual`, y con
  // el guardia de «la variable no está definida» ANTES de la comparación: sin él se compara contra
  // el literal `'Bearer undefined'`, que cualquiera puede mandar.
  //
  // La diferencia con la sonda —y es la que hace que no se pueda copiar— es que Vercel manda el
  // prefijo `Bearer ` COMO PARTE DEL VALOR de la cabecera. La sonda compara la cabecera entera; acá
  // hay que quitar el prefijo antes, o son 403 en todas las corridas para siempre.
  'app/api/cron/route.ts',
  // ── Etapa 5.5 · el aviso del CRM ────────────────────────────────────
  //
  // La TERCERA entrada, y el comentario de arriba pide que sea deliberada. Lo es, y es la primera de
  // las tres que **recibe datos** en vez de disparar trabajo nuestro — así que las dos razones son
  // las mismas y la superficie es mayor:
  //
  //   · **No puede pasar por el portero**: no hay sesión. La llama un workflow de GoHighLevel, y
  //     `exigir()` respondería 401 a CADA entrega. El síntoma no sería un error visible sino
  //     «el CRM no nos avisa nada», y encima GoHighLevel desactiva un workflow ante fallos repetidos.
  //   · **No puede ser pública**: cualquiera podría inyectar mensajes y contactos falsos en la base
  //     de una empresa, y disparar llamadas al CRM a nuestra cuenta.
  //
  // Su autenticación tiene DOS mitades en una cabecera —`X-Webhook-Secret: <pimienta>.<secreto>`— y
  // esa forma no se puede copiar de las otras dos:
  //
  //   · la mitad izquierda se compara contra `AVISO_PIMIENTA` **antes de tocar la base**, porque el
  //     agrupador de `identidad` es `max: 5` y lo comparte con el login de todos los inquilinos: sin
  //     ese portón, cualquiera que descubra la URL deja sin sesión a todo el mundo con un bucle;
  //   · la derecha identifica la EMPRESA por el hash de su secreto, y eso es lo que hace que el
  //     aislamiento no dependa de que el cuerpo del webhook diga la verdad.
  //
  // Y también con el guardia de «la variable no está definida» ANTES de comparar, igual que el cron.
  'app/api/avisos/crm/route.ts',
];

/**
 * Las rutas que NO abren contexto de organización porque **no tocan la base de datos**.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * POR QUÉ ESTA LISTA ES NUEVA Y NO UNA ENTRADA MÁS EN `ARCHIVOS_AUTORIZADOS`
 *
 * `ADR-0202` exige que todo manejador de ruta abra el contexto de su organización, y tiene
 * razón: *"olvidarse no falla — la operación funciona y lee los datos de la organización
 * equivocada"*. Las exenciones que existían eran dos, y ninguna describe este caso:
 *
 *   · `RUTAS_PUBLICAS` — no hay sesión. Acá sí la hay, y el portero corre.
 *   · `ARCHIVOS_AUTORIZADOS` — usan `conIdentidad(`, el acceso sin filtro. Acá no se usa, y
 *     meterlo ahí habría hecho fallar la comprobación de entradas muertas de esa misma lista.
 *
 * El caso real es un tercero: **un proxy autenticado que no lee ni escribe una sola fila**.
 * `tools/scrape` valida la sesión, saca `org_id` del contexto del portero y se lo pasa al
 * backend de scraping por HTTP. No hay contexto que abrir porque no hay consulta que aislar.
 *
 * Antes esta ruta SÍ tocaba la base —resolvía `fundaciones_cliente_id` con `conIdentidad(`— y
 * por eso vivía en la otra lista. La migración `006_aria_cc_scraper.sql` le quitó esa lectura:
 * `org_id` ya viene del portero. Ver el comentario en `ARCHIVOS_AUTORIZADOS`.
 *
 * ── LA EXENCIÓN SE VERIFICA, NO SE CREE ────────────────────────────────────────
 *
 * Una lista blanca cuya condición nadie comprueba es un permiso permanente. La prueba de
 * `ADR-0202` no sólo salta estas rutas: **afirma que de verdad no tocan la base**. Si alguien
 * agrega una consulta acá, la exención deja de valer y la prueba lo dice — en vez de dejar
 * pasar en silencio la consulta sin aislar que la exención prometía que no existía.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export const RUTAS_SIN_BASE: readonly string[] = [
  // El proxy del motor de scraping. Ver el bloque de arriba.
  'app/api/tools/scrape/route.ts',
];
