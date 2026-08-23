// ADR-0303 — Todo rol asignable tiene al menos una pantalla.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// El mapa pantalla → capacidad. UNA sola fuente de verdad.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL ESTADO HONESTO DE ESTE ARCHIVO — ACTUALIZADO EN LA ETAPA 9
//
// Hasta la Etapa 8 este archivo decía que sus dos filas de `PRUEBAS.md` no podían verificar nada
// real, porque ninguna de las diez pantallas del prototipo tenía una sola operación de servidor:
// las trece capacidades del catálogo eran de identidad y administración, y las diez pantallas eran
// de producto. Una pantalla sin operaciones no puede filtrar nada.
//
// **Eso dejó de ser cierto.** La Etapa 9 le dio a `icp` (ICP & Oferta) sus tres primeras
// operaciones y sus dos capacidades propias (`fundaciones.ver`, `fundaciones.editar`), así que hoy
// hay una pantalla de producto que se decide por capacidad y `ADR-0303` verifica algo real. Las
// otras nueve siguen en `SIN_OPERACIONES_TODAVIA`, con el mismo cable trampa esperándolas.
//
// Se conserva el párrafo de arriba en vez de borrarlo porque explica QUÉ estaba esperando la lista,
// y la próxima pantalla que reciba una operación va a necesitar leerlo.
//
// ── LA TRAMPA QUE ESTE ARCHIVO PODRÍA SER ────────────────────────────────────
//
// El defecto natural acá es **la lista paralela**: declarar `SECCIONES` y dejar el menú
// renderizándose de otra lista. Las dos pruebas quedan verdes para siempre verificando un
// arreglo que ningún píxel de la pantalla usa, mientras el menú real muestra las diez
// secciones a todo el mundo. Es la forma exacta del `07` § 0: *"un éxito reportado que no
// ocurrió"*.
//
// Hoy el repo tiene la clave de cada pantalla repetida **en cuatro lugares**:
// `components/Nav.jsx` (JSX literal con `data-view`), el mapa `GROUP` de
// `lib/aios/shell.js`, los `id="v-…"` de `components/views/*View.jsx`, y `const VISTAS` de
// `scripts/paridad.mjs`. Unificarlos exige reescribir `Nav.jsx` como un `.map()` que
// produzca un DOM **idéntico** al del prototipo, o `npm run paridad` —la única compuerta que
// compara el port con el original— empieza a fallar y se termina desactivando. Eso es
// trabajo de la etapa que le dé interfaz a la primera pantalla administrada, no de ésta.
// Queda escrito en `docs/ETAPA-3.md` como deuda, con su riesgo nombrado.
//
// La Etapa 9 NO pagó esa deuda, y conviene decirlo con precisión: `icp` sigue apareciendo en los
// cuatro lugares, y el menú sigue mostrando las diez entradas a cualquiera con sesión. Lo que sí
// cambió es que ahora hay UNA pantalla donde la lista paralela tiene consecuencia visible —quien no
// tenga `fundaciones.ver` entra a la pestaña y sus operaciones responden `sin_permiso`, en vez de
// ver la pantalla vacía—, porque el componente distingue el rechazo del vacío (`ADR-0305`).
// ═══════════════════════════════════════════════════════════════════════════════

import type { Capacidad } from './capacidades.ts';

/** Una sección del menú: una pantalla, y la capacidad que hace falta para verla. */
export interface Seccion {
  clave: string;
  nombre: string;
  /**
   * La capacidad que habilita la pantalla. **Singular**, como la escribe el 03 § 7
   * (`s.capacidadRequerida`).
   *
   * Que sea una y no una lista es lo que hace comprobable `ADR-0304`: si una pantalla
   * pudiera declarar varias, "el mismo conjunto de capacidades" tendría dos definiciones
   * —la de la pantalla y la de sus operaciones— y ninguna sería el contrato.
   */
  capacidadRequerida: Capacidad;
}

/**
 * Las pantallas que tienen al menos una operación de servidor.
 *
 * Cada `clave` tiene que aparecer en el marcador `PANTALLA` de sus manejadores de ruta, y
 * `ADR-0304` verifica que todas las operaciones de una misma pantalla pidan el **mismo
 * conjunto** de capacidades.
 */
export const SECCIONES: readonly Seccion[] = [
  { clave: 'usuarios', nombre: 'Usuarios', capacidadRequerida: 'usuarios.ver' },
  { clave: 'credenciales', nombre: 'Integraciones', capacidadRequerida: 'credenciales.ver' },
  // ── Etapa 9 · el cable trampa DISPARÓ, y esta línea es la decisión que pedía ──
  //
  // `icp` es la PRIMERA pantalla del prototipo que recibe operaciones de servidor
  // (`GET/POST /api/fundaciones/estado`, `POST /api/fundaciones/generar`). El comentario de arriba
  // decía que el día que pasara, alguien tenía que decidir *"catalogar su capacidad y ponerla en
  // `SECCIONES`, o justificar por qué no"*. Se catalogó.
  //
  // Con esto `ADR-0303` deja de estar inerte: hay una pantalla real cuya visibilidad se decide por
  // una capacidad del catálogo, y `ADR-0304` compara de verdad los conjuntos de sus operaciones.
  { clave: 'icp', nombre: 'ICP & Oferta', capacidadRequerida: 'fundaciones.ver' },
];

/**
 * Las diez pantallas del prototipo, que **todavía no tienen ninguna operación**.
 *
 * Está escrita a mano y no derivada de los archivos, y eso es a propósito: es la lista que
 * alguien tiene que **editar** el día que una de estas pantallas reciba su primera
 * operación. Una lista derivada se actualizaría sola y nadie decidiría nada.
 */
export const SIN_OPERACIONES_TODAVIA: readonly string[] = [
  'executive',
  'leads',
  // `icp` SALIÓ de esta lista en la Etapa 9: ya tiene operaciones y vive en `SECCIONES`.
  'acquisition',
  'creative',
  'conversion',
  'conversation',
  'sales',
  'setter',
  'closer',
];

/**
 * Las operaciones que **no pertenecen a ninguna pantalla**, nombradas una por una.
 *
 * No puede ser el valor por omisión: por la lógica del 03 § 5, *"una operación nueva nace
 * cerrada"*, y una operación sin pantalla que no esté declarada acá es una operación que se
 * escapó de `ADR-0304` sin que nadie lo decida.
 */
export const SIN_PANTALLA: readonly string[] = [
  // La comprobación de salud: pública, sin sesión, sin datos.
  'app/api/salud/route.ts',
  // Las tres operaciones de la propia sesión. No son de una pantalla: son de la aplicación.
  'app/api/auth/sesion/route.ts',
  // La sonda del aislamiento. Existe para la prueba de la Etapa 2 y la sonda de la 8, no
  // para una pantalla (10 § 1).
  'app/api/control/route.ts',
  // El login. No pertenece a una pantalla: es la puerta.
  'app/api/auth/login/route.ts',
  // El segundo factor: son trámites de la propia cuenta, no de una pantalla del producto.
  'app/api/auth/2fo/configurar/route.ts',
  'app/api/auth/2fo/confirmar/route.ts',
  'app/api/auth/2fo/verificar/route.ts',
  // ── Etapa 5 ──────────────────────────────────────────────────────────────────
  //
  // Las seis operaciones de administración van acá, y es una decisión con motivo. `ADR-0304` exige
  // que las operaciones de una misma pantalla pidan el MISMO conjunto de capacidades, y estas seis
  // piden cinco conjuntos distintos: `organizaciones.crear`, `usuarios.crear`, `usuarios.editar`,
  // `usuarios.desactivar`, `roles.asignar`.
  //
  // Igualarlos pidiendo las cinco en las seis sería una ESCALADA SILENCIOSA introducida para que
  // una prueba pase: el portero usa `contieneAlguna`, así que alguien con solo `usuarios.desactivar`
  // podría crear usuarios.
  //
  // Y el defecto que `ADR-0304` previene es de LECTURAS —*"veía una sección con datos y cuatro en
  // blanco, sin ningún error"* (07 § 2)—, no de mutaciones: una pantalla que se ve a medias es un
  // problema de lo que se muestra, y estas seis no muestran nada. La pantalla de administración,
  // cuando exista, va a tener su `GET` propio, y ÉSE sí entra a `SECCIONES`.
  'app/api/admin/organizaciones/route.ts',
  'app/api/admin/usuarios/route.ts',
  'app/api/admin/usuarios/[id]/route.ts',
  'app/api/admin/usuarios/[id]/desactivar/route.ts',
  'app/api/admin/usuarios/[id]/restablecer-password/route.ts',
  'app/api/admin/usuarios/[id]/roles/route.ts',
  // ── Etapa 8 ──────────────────────────────────────────────────────────────────
  // La sonda de aislamiento. La llama una tarea programada cada hora: no hay pantalla, no hay
  // persona, y su resultado va al registro de la tarea y al canal de avisos.
  'app/api/sonda/route.ts',
];

/**
 * ¿Este conjunto de permisos habilita esta sección?
 *
 * El 03 § 7 nombra `puede(` y pide que el frontend use **la misma función** que el
 * servidor, *"para que las dos mitades no divergan"*. Y aclara lo que hay que repetir cada
 * vez que alguien mire este archivo: *"eso es comodidad, NO SEGURIDAD. Cualquiera puede
 * llamar a la API con su sesión y una herramienta de línea de comandos; el menú solo evita
 * que la gente vea puertas que no puede abrir."*
 *
 * La tentación que el documento nombra es fuerte y hay que resistirla: *"si el menú ya
 * oculta la sección, PARECE que la operación no necesita validar. Necesita."*
 */
export function puede(permisos: ReadonlySet<string>, seccion: Seccion): boolean {
  return permisos.has(seccion.capacidadRequerida);
}

/** Las secciones visibles para un conjunto de permisos (03 § 7). */
export function seccionesVisibles(permisos: ReadonlySet<string>): readonly Seccion[] {
  return SECCIONES.filter((s) => puede(permisos, s));
}
