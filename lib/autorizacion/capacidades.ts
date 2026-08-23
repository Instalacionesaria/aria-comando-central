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
