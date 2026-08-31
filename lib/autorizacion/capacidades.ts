// ADR-0302 — El permiso se pregunta por CAPACIDAD, nunca por nombre de rol.
//
// El catálogo de capacidades, del lado del código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ HAY UNA COPIA EN TYPESCRIPT DE ALGO QUE VIVE EN LA BASE
//
// El catálogo verdadero es `identidad.permisos`, cargado por la migración 003. Esta
// lista NO lo reemplaza: existe para que el portero se llame con una clave que el
// compilador conoce, en vez de con una cadena suelta que puede tener una errata.
//
// Una errata en una capacidad NO FALLA COMO ERRATA. `exigir(['usuarios.vere'])` es una
// capacidad que nadie tiene, así que el portero rechaza a TODO EL MUNDO con 403
// `sin_permiso` — y ese 403 es justo el que el `07` § 2 dice que "se muestra muchas veces
// como 'no hay datos'". El síntoma que llega es "la pantalla está vacía", no "hay una
// errata".
//
// Y para que las dos listas no puedan divergir, hay una prueba de base que las cruza EN
// LAS DOS DIRECCIONES: ninguna clave de acá que no esté en la tabla, ninguna fila de la
// tabla que no esté acá. Sin la segunda mitad, agregar una fila a la migración y olvidar
// esta lista pasa desapercibido.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Las capacidades del catálogo, tal como las cargan
 * `db/migraciones/003_roles_y_permisos.sql` (las trece primeras) y
 * `db/migraciones/009_fundaciones.sql` (las dos de Fundaciones).
 *
 * El nombre es `recurso.accion` y es **estable para siempre** (03 § 2): es una clave que
 * está en filas de la base y en condicionales del código, así que renombrarla es una
 * migración.
 */
export const CAPACIDADES = [
  'organizaciones.crear',
  'organizaciones.editar',
  'organizaciones.listar',
  'roles.administrar',
  'usuarios.ver',
  'usuarios.crear',
  'usuarios.editar',
  'usuarios.desactivar',
  // Borrar NO es desactivar, y por eso es su propia capacidad en vez de reusar la de arriba.
  // Desactivar es reversible; esto no. Conceder «puede sacar a alguien de circulación» no puede
  // conceder de paso «puede hacer desaparecer su rastro», o ampliar la operación ampliaría en
  // silencio lo que ya se había autorizado. La tiene solo el rol de plataforma.
  'usuarios.borrar',
  'organizaciones.borrar',
  'roles.asignar',
  'credenciales.ver',
  'credenciales.editar',
  'configuracion.editar',
  'auditoria.ver',
  // ── Etapa 9 · Fundaciones (la pantalla `icp`) ────────────────────────────────
  //
  // Dos y no una, con el criterio del `03` § 2: *"¿existe un rol plausible que necesite A y no
  // B?"*. Sí, y es el caso normal — un coach mira el avatar y la oferta de un alumno para preparar
  // el kickoff, y no tiene por qué poder gastarle tokens generando de nuevo. Ver es leer siete
  // documentos; editar es gastar dinero de la organización.
  'fundaciones.ver',
  'fundaciones.editar',
  // ── Las dos de la pantalla `tools` ──
  //
  // DOS, con el criterio del `03` § 2: *"¿existe un rol plausible que necesite A y no B?"*. Sí,
  // y es el mismo caso que Fundaciones — ver un plan de prospección es leer un documento;
  // generarlo de nuevo gasta tokens de la organización.
  //
  // Y SEPARADAS de `fundaciones.*`, que era la salida barata: la pantalla `tools` no es
  // Fundaciones, va a tener tres herramientas que no son del método, y unificarlas significaría
  // que darle Tools a alguien le da también ICP & Oferta — sin que nadie lo decida y sin que
  // nada falle.
  'tools.ver',
  'tools.editar',
  // ── El Panel de Monitoreo ────────────────────────────────────────────────────
  //
  // UNA sola, y de LECTURA. El panel no tiene nada que escribir: mira cuántos scrapeos hizo cada
  // empresa y con qué scraper. Una capacidad de edición sería una capacidad sin puerta, que es lo
  // que este archivo le reprocha a `roles.administrar`.
  //
  // ── POR QUÉ UNA FAMILIA NUEVA Y NO `credenciales.%` ────────────────────────
  //
  // `credenciales.%` era la salida barata y tiene precedente escrito: `app/api/admin/comisiones`
  // la usa justamente porque es la única familia que ya excluye al rol `usuario` **sin tocar el
  // reparto**. Su propio encabezado dice el costo — *"la descripción de esa capacidad habla de
  // credenciales y ahora también gobierna sueldos"*— y colgarle una tercera cosa lo agrava: quien
  // lea «credenciales» en una fila de auditoría no va a adivinar que también concede ver el
  // consumo de todas las empresas.
  //
  // Así que es familia propia, y el costo se paga donde se ve: `db/arranque/001_catalogo.sql` le
  // niega `monitoreo.%` a mano a `usuario` **y a `administrador`**. Sin esas dos líneas la
  // capacidad cae SOLA en los tres roles —el reparto deriva por exclusión de prefijos— y el panel
  // que mide a todas las empresas se lo vería cualquier persona de cualquier empresa.
  //
  // ── QUIÉN LA TIENE: TRES PERSONAS, NO UN PUESTO ───────────────────────────
  //
  // `superadministrador`, y un rol propio llamado `monitoreo` que se asigna persona por persona.
  // Se pidió así —*"solo nosotros 3"*— y ningún rol de puesto puede expresarlo: `administrador`
  // es el mismo rol en ARIA y en cada empresa cliente, y el mismo para todos los administradores
  // de ARIA, así que dárselo a él se lo da también al que entre mañana.
  //
  // Y aun con el rol bien asignado falta una mitad: si alguien le diera ese rol a una persona de
  // una empresa cliente, esa persona vería los números de sus competidores. Eso lo atrapa
  // `Seccion.soloDesdeLaPrincipal`, que comprueba el manejador. Las dos mitades son necesarias;
  // ninguna se puede leer sin la otra.
  'monitoreo.ver',
  // ── Etapa 11 · Closer y Setter ────────────────────────────────────────
  //
  // UNA de lectura por PESTAÑA, y son dos porque de eso depende que un closer no vea la
  // pestaña del setter. Con una sola capacidad compartida, los dos roles verían las dos.
  //
  // El `11` § 8 listó además `tablero.ver` y `agenda.ver` para sub-pestañas del closer, y
  // NO se catalogan: el mismo § 8 prohibe que dos llamadas de la misma pantalla pidan
  // capacidades distintas, porque *"esa parte se ve vacía para alguien que ve el resto, y no
  // hay forma de darse cuenta mirando"*. Las dos mitades del documento no pueden valer a la
  // vez; gana la regla, que describe un defecto medido. El motivo completo está en
  // `db/arranque/001_catalogo.sql`.
  // Las SIETE pantallas del prototipo que todavía no tienen operaciones. Una capacidad
  // para las siete y no una cada una: no tienen nada que proteger del lado del servidor
  // —no llaman a ninguna operación— y lo que decide es si aparecen en el menú. Siete
  // capacidades para eso serían siete líneas de reparto por rol sin una decisión distinta
  // detrás de ninguna.
  //
  // La tiene el administrador y NO la tienen closer ni setter, y de eso depende que un
  // closer no vea los siete tableros de inteligencia además de su pestaña.
  'tablero.ver',
  'closer.ver',
  'setter.ver',
  // La ficha del contacto. De las DOS pestañas, así que no puede pedir la de una sola.
  'contactos.ver',
  // Las CUATRO de MUTACIÓN. Éstas sí pueden diferir de la lectura de la pantalla: el defecto
  // que esa regla previene es de lecturas —"una sección con datos y cuatro en blanco"— y un
  // botón deshabilitado no es un panel vacío.
  'contactos.avanzar',
  'contactos.comentar',
  'conversaciones.responder',
  // Resolver una intervención del auditor. **No se reusa `contactos.avanzar`**: avanzar registra
  // un RESULTADO —cambia la etapa, alimenta la comisión— y resolver cierra un aviso y le quita
  // etiquetas al CRM. Con una sola capacidad, conceder lo primero concedería lo segundo en
  // silencio, que es la lección que la Etapa 12 dejó escrita para borrar y desactivar.
  'contactos.resolver',
] as const;

export type Capacidad = (typeof CAPACIDADES)[number];

/**
 * "Ninguna capacidad" es un VALOR EXPLÍCITO, no una lista vacía.
 *
 * El 03 § 5 lo escribe así y explica por qué, y es la clase de detalle que decide si un
 * diseño falla abierto o cerrado: *"Una lista vacía se puede pasar por accidente (una
 * variable que llegó indefinida) y ABRIRÍA LA OPERACIÓN. Un valor con nombre —`ninguna`—
 * tiene que escribirse a propósito."*
 *
 * El tipo lo sostiene además del nombre: `exigir` acepta `Capacidad[]` o `NINGUNA`, y una
 * variable `undefined` no es ninguna de las dos, así que no compila.
 */
export const NINGUNA = 'ninguna' as const;
export type Ninguna = typeof NINGUNA;

/** Lo que se le puede pedir al portero. */
export type Exigencia = readonly Capacidad[] | Ninguna;

/**
 * ¿El conjunto de permisos contiene ALGUNA de las pedidas?
 *
 * `contieneAlguna` es el nombre que usa el 03 § 5 (`contexto.permisos.contieneAlguna`), y
 * la semántica es "alguna", no "todas": un rol con `usuarios.editar` pero sin
 * `usuarios.ver` pasa un `exigir(['usuarios.ver', 'usuarios.editar'])`.
 *
 * Esa semántica es la que hace que la fila `ADR-0304` importe tanto. Si dos operaciones de
 * la misma pantalla piden conjuntos DISTINTOS que se solapan, quien tenga solo una de las
 * dos capacidades pasa una operación y la otra le da 403 — y ve *"una sección con datos y
 * cuatro en blanco, sin ningún error"* (07 § 2). Por eso `ADR-0304` compara CONJUNTOS y no
 * solapamiento.
 */
export function contieneAlguna(
  permisos: ReadonlySet<string>,
  pedidas: readonly Capacidad[],
): boolean {
  return pedidas.some((c) => permisos.has(c));
}
