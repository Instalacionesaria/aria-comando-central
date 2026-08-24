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
// ── LA TRAMPA QUE ESTE ARCHIVO ERA, Y QUE LA ETAPA 11 PAGÓ ──────────────────
//
// El defecto era **la lista paralela**: `SECCIONES` declaraba tres pantallas y el menú se
// renderizaba de OTRA lista —diez entradas de JSX literal en `components/Nav.jsx`—. Las dos
// pruebas quedaban verdes para siempre verificando un arreglo que ningún píxel de la pantalla
// usaba, mientras el menú real mostraba las diez secciones a cualquiera con sesión. Es la
// forma exacta del `07` § 0: *"un éxito reportado que no ocurrió"*.
//
// La clave de cada pantalla estaba repetida **en cuatro lugares**: el JSX de `Nav.jsx`, el
// mapa `GROUP` de `lib/aios/shell.js`, los `id="v-…"` de `components/views/*View.jsx`, y
// `const VISTAS` de `scripts/paridad.mjs`. Este archivo decía que unificarlos era *"trabajo de
// la etapa que le dé interfaz a la primera pantalla administrada"*.
//
// **Esa etapa es la 11**, porque es la primera en que una pantalla que gana operaciones NO la
// ve todo el mundo: un closer no puede ver la pestaña del setter. Con el menú escrito a mano,
// "solo ve su pestaña" habría sido falso — vería las diez entradas y ocho le responderían 403.
//
// ── Y LO QUE APARECIÓ AL UNIFICAR, QUE ES EL ARGUMENTO ENTERO ───────────────
//
// `SIN_OPERACIONES_TODAVIA` tenía la clave **`leads`**. No existe. Las otras tres copias dicen
// `contacts`: el `data-view` del menú, el mapa `GROUP` del armazón y el `id="v-contacts"` de
// la vista. Así que la lista venía afirmando la pertenencia de una pantalla que la aplicación
// no tiene, y las dos pruebas que la miran pasaban en verde igual — comprobaban su LARGO y que
// `icp` no estuviera, nunca que sus claves existieran.
//
// Es la demostración de por qué la lista paralela es un defecto y no una molestia: no divergió
// en algo visible, divergió en un nombre, y nadie podía notarlo mirando la pantalla.
//
// ── CÓMO QUEDÓ: UNA LISTA, NO DOS ───────────────────────────────────────────
//
// `SECCIONES` es ahora la única, con las diez pantallas y las dos de administración.
// `SIN_OPERACIONES_TODAVIA` se DERIVA de la bandera `sinOperacionesTodavia`.
//
// Y el cable trampa sobrevive, que era la objeción a derivarla. La nota anterior decía: *"está
// escrita a mano y no derivada de los archivos, y eso es a propósito: es la lista que alguien
// tiene que EDITAR el día que una de estas pantallas reciba su primera operación. Una lista
// derivada se actualizaría sola y nadie decidiría nada."* Correcto — y sigue valiendo, porque
// esto no se deriva de los ARCHIVOS: se deriva de una bandera que hay que editar a mano. La
// prueba de `ADR-0304` exige que toda sección SIN la bandera tenga un manejador que la
// declare, así que agregarle una operación a una pantalla y no bajar la bandera es rojo.
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
  /**
   * `true` = la pantalla **todavía no tiene ninguna operación de servidor**.
   *
   * Es el cable trampa, y hay que editarlo a mano. `ADR-0304` verifica que toda sección SIN
   * esta bandera tenga al menos un manejador de ruta que la declare con `PANTALLA`, así que
   * darle su primera operación a una de éstas y olvidarse de bajar la bandera es rojo.
   *
   * Lo que la bandera NO significa: que la pantalla se vea sin permiso. Estas diez también
   * piden su capacidad para aparecer en el menú — lo que no tienen es qué proteger del lado
   * del servidor, porque no llaman a ninguna operación.
   */
  sinOperacionesTodavia?: true;
  /**
   * Cómo se dibuja en el menú lateral. **Ausente = no tiene entrada en el menú.**
   *
   * `usuarios` y `credenciales` son así: tienen operaciones y capacidad, y no tienen pantalla
   * en el prototipo todavía. Su ausencia acá es lo que impide que el menú invente una entrada
   * que no lleva a ningún lado.
   */
  menu?: {
    /** A qué grupo pertenece. Tiene que ser una clave de `GRUPOS_DEL_MENU`. */
    grupo: string;
    /** El `href` del `<use>` del sprite de iconos. */
    icono: string;
    /** ¿Lleva el galón `›` a la derecha? Cinco de las diez lo llevan en el prototipo. */
    galon?: true;
  };
}

/**
 * Los grupos del menú, **en orden**, con su etiqueta.
 *
 * El primero no tiene etiqueta visible y los otros dos sí — es así en el prototipo, y el
 * `null` lo dice en vez de dejarlo a que alguien se acuerde. La clave `'AIOS'` igual existe
 * porque `lib/aios/shell.js` la usa para la miga de pan.
 */
export const GRUPOS_DEL_MENU: readonly {
  clave: string;
  etiqueta: string | null;
  /**
   * `true` = va en el PIE del menú, no en el cuerpo.
   *
   * El prototipo ya tenía una fila «⚙ Ajustes» ahí abajo, decorativa. Ajustes va en ese lugar
   * y no en un cuarto grupo del cuerpo por una razón que no es estética: es donde la gente ya
   * lo busca, y mover un elemento que el prototipo puso en un lado obliga a que alguien
   * reaprenda dónde está algo que no cambió de significado.
   */
  pie?: true;
}[] = [
  { clave: 'AIOS', etiqueta: null },
  { clave: 'Inteligencia', etiqueta: 'Inteligencia' },
  { clave: 'Operación', etiqueta: 'Operación' },
  { clave: 'Pie', etiqueta: null, pie: true },
];

/**
 * Las pantallas que tienen al menos una operación de servidor.
 *
 * Cada `clave` tiene que aparecer en el marcador `PANTALLA` de sus manejadores de ruta, y
 * `ADR-0304` verifica que todas las operaciones de una misma pantalla pidan el **mismo
 * conjunto** de capacidades.
 */
export const SECCIONES: readonly Seccion[] = [
  // ── Las dos de administración. Sin `menu`: tienen operaciones y capacidad, y todavía no
  //    tienen pantalla en el prototipo. Ver el comentario de `Seccion.menu`.
  { clave: 'usuarios', nombre: 'Usuarios', capacidadRequerida: 'usuarios.ver' },
  {
    // ── Etapa 11 · Ajustes gana pantalla ──
    //
    // Esta sección existía desde la Etapa 6 con sus dos operaciones y su capacidad, y **sin
    // pantalla**: no había forma de que una empresa cargara su propio token de GoHighLevel ni
    // su propia llave de Anthropic. La columna `ia_clave_cifrada` estaba en la base desde la
    // migración 006 y nada la escribía, así que `icp` respondía `sin_llave_de_ia` para siempre
    // y el arreglo que se ve fácil era una variable de entorno global — la fuga que
    // `lib/credenciales/resolver.ts` documenta en su encabezado.
    //
    // Se llama «Ajustes» y no «Integraciones» porque es lo que se pidió y es lo que la fila
    // decorativa del prototipo ya decía. Guarda más que integraciones: es la configuración de
    // la empresa.
    clave: 'credenciales',
    nombre: 'Ajustes',
    capacidadRequerida: 'credenciales.ver',
    menu: { grupo: 'Pie', icono: '#i-ajustes' },
  },

  // ── Grupo 1 · AIOS ─────────────────────────────────────────────────────────
  {
    clave: 'executive',
    nombre: 'Executive',
    capacidadRequerida: 'tablero.ver',
    sinOperacionesTodavia: true,
    menu: { grupo: 'AIOS', icono: '#i-exec' },
  },
  {
    // `contacts`, NO `leads`. Ver el encabezado: la lista vieja decía `leads` y las otras tres
    // copias decían `contacts`. Se corrigió al nombre que usa la aplicación, que gana 3 a 1.
    clave: 'contacts',
    nombre: 'Leads Portal',
    capacidadRequerida: 'tablero.ver',
    sinOperacionesTodavia: true,
    menu: { grupo: 'AIOS', icono: '#i-leads', galon: true },
  },
  {
    // ── Etapa 9 · el cable trampa DISPARÓ por primera vez ──
    //
    // `icp` fue la PRIMERA pantalla del prototipo con operaciones de servidor
    // (`GET/POST /api/fundaciones/estado`, `POST /api/fundaciones/generar`), así que es la
    // única de las diez sin la bandera. Con esto `ADR-0303` dejó de estar inerte.
    clave: 'icp',
    nombre: 'ICP & Oferta',
    capacidadRequerida: 'fundaciones.ver',
    menu: { grupo: 'AIOS', icono: '#i-icp', galon: true },
  },

  // ── Grupo 2 · Inteligencia ─────────────────────────────────────────────────
  {
    clave: 'acquisition',
    nombre: 'Acquisition',
    capacidadRequerida: 'tablero.ver',
    sinOperacionesTodavia: true,
    menu: { grupo: 'Inteligencia', icono: '#i-acq' },
  },
  {
    clave: 'creative',
    nombre: 'Creative',
    capacidadRequerida: 'tablero.ver',
    sinOperacionesTodavia: true,
    menu: { grupo: 'Inteligencia', icono: '#i-creative', galon: true },
  },
  {
    clave: 'conversion',
    nombre: 'Conversion',
    capacidadRequerida: 'tablero.ver',
    sinOperacionesTodavia: true,
    menu: { grupo: 'Inteligencia', icono: '#i-conv', galon: true },
  },
  {
    clave: 'conversation',
    nombre: 'Conversation',
    capacidadRequerida: 'tablero.ver',
    sinOperacionesTodavia: true,
    menu: { grupo: 'Inteligencia', icono: '#i-chat' },
  },
  {
    clave: 'sales',
    nombre: 'Sales',
    capacidadRequerida: 'tablero.ver',
    sinOperacionesTodavia: true,
    menu: { grupo: 'Inteligencia', icono: '#i-sales', galon: true },
  },

  // ── Grupo 3 · Operación · Etapa 11 ─────────────────────────────────────────
  //
  // Las dos pestañas operativas, y las ÚNICAS dos con una capacidad de lectura propia. De eso
  // depende lo único que se pidió en voz alta: *"un closer solo ve su pestaña"*. Si las dos
  // pidieran la misma capacidad, los dos roles verían las dos — y este archivo seguiría
  // filtrando bien, con el criterio equivocado. No fallaría nada.
  //
  // Y las CUATRO sub-pestañas del closer piden `closer.ver`, no una cada una. El `11` § 8
  // listó `tablero.ver` para el Inicio y `agenda.ver` para la Agenda, y el mismo § 8 —y
  // `ADR-0304`— prohiben eso: dos llamadas de la misma pantalla con capacidades distintas
  // dejan *"esa parte vacía para alguien que ve el resto, y no hay forma de darse cuenta
  // mirando"*. El razonamiento completo está en `db/arranque/001_catalogo.sql`.
  {
    clave: 'setter',
    nombre: 'Setter',
    capacidadRequerida: 'setter.ver',
    menu: { grupo: 'Operación', icono: '#i-setter' },
  },
  {
    clave: 'closer',
    nombre: 'Closer',
    capacidadRequerida: 'closer.ver',
    menu: { grupo: 'Operación', icono: '#i-closer' },
  },
];

/**
 * Las pantallas del prototipo que **todavía no tienen ninguna operación**.
 *
 * DERIVADA, y el encabezado explica por qué eso no debilita el cable trampa: no se deriva de
 * los archivos —que se actualizaría sola y nadie decidiría nada— sino de una bandera que hay
 * que editar a mano en `SECCIONES`.
 *
 * Eran nueve hasta la Etapa 11, que se llevó `setter` y `closer` por el mismo camino que la 9
 * se llevó `icp`.
 */
export const SIN_OPERACIONES_TODAVIA: readonly string[] = SECCIONES.filter(
  (s) => s.sinOperacionesTodavia,
).map((s) => s.clave);

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

/**
 * Las secciones del MENÚ visibles, agrupadas y en el orden del prototipo.
 *
 * Existe para que `components/Nav.jsx` no tenga que saber nada de grupos ni de orden: si esa
 * lógica viviera en el componente, volveríamos a tener dos listas que se pueden desordenar
 * una respecto de la otra.
 *
 * Los grupos que quedan sin ninguna sección visible **no se devuelven**. Un `<div
 * class="nav-group">` con su etiqueta y nada adentro deja un título flotando sobre el vacío —
 * que le dice al usuario que ahí hay algo que no puede ver, cuando lo que corresponde es que
 * no sepa que existe.
 */
export function menuVisible(
  permisos: ReadonlySet<string>,
): readonly { grupo: { clave: string; etiqueta: string | null }; secciones: readonly Seccion[] }[] {
  const visibles = seccionesVisibles(permisos).filter((s) => s.menu);
  return GRUPOS_DEL_MENU.map((grupo) => ({
    grupo,
    secciones: visibles.filter((s) => s.menu!.grupo === grupo.clave),
  })).filter((g) => g.secciones.length > 0);
}
