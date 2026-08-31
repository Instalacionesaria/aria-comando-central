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
   * `true` = la pantalla **solo la ve quien es de la organización principal**, además de tener
   * su capacidad.
   *
   * ── POR QUÉ ESTE EJE EXISTE Y NO SE PUEDE EXPRESAR CON UNA CAPACIDAD ───────
   *
   * Los roles del sistema son globales: `identidad.roles` los reparte con `org_id is null`, así
   * que ningún rol sabe de qué empresa es quien lo tiene. Una capacidad tampoco — o la tienen
   * los de todas las empresas, o los de ninguna.
   *
   * Y hay una pantalla que necesita justo esa distinción: el Panel de Monitoreo mira el consumo
   * de TODAS las empresas. Su capacidad la lleva un rol que se asigna persona por persona
   * (`monitoreo`), y ahí está el agujero que esta bandera tapa: **asignar ese rol a la persona
   * equivocada es un error de UNA fila**, hecho desde la pantalla de Usuarios, que nadie revisa.
   * Sin la bandera, esa persona vería los números de sus competidores y **no fallaría nada** —
   * se vería como una pantalla que funciona.
   *
   * O sea que no es la barrera principal: es la red debajo de la barrera principal. Las dos
   * hacen falta, y por motivos distintos.
   *
   * ── LA REGLA SE MIDE SOBRE LA ORGANIZACIÓN PROPIA, NO SOBRE LA EFECTIVA ────
   *
   * Es lo que la separa del encierro que ya se pagó con la pestaña Empresas: allá la condición
   * miraba dónde estabas parado, así que conmutar a un cliente **quitaba de la pantalla el
   * control con el que se volvía** (ver `components/views/AjustesView.jsx`). Acá se mira a qué
   * organización PERTENECÉS, que no cambia al conmutar: el panel no aparece y desaparece.
   *
   * Quien lo evalúa es `esDeLaPrincipal(contexto)`, en este mismo archivo.
   */
  soloDesdeLaPrincipal?: true;
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
    // ── Etapa 11 · la pantalla de administración que la Etapa 5 anticipó ───────────
    //
    // El comentario de `SIN_PANTALLA` decía, desde entonces: *"la pantalla de administración,
    // cuando exista, va a tener su GET propio, y ÉSE sí entra a `SECCIONES`"*. Es éste.
    //
    // Sin `menu`: no es una entrada del menú lateral, es una PESTAÑA dentro de Ajustes. Lo
    // mismo que `usuarios`, arriba. La sección existe igual porque es lo que hace que sus
    // operaciones tengan una pantalla que declarar y que `ADR-0304` pueda compararlas.
    //
    // `organizaciones.listar` la tiene SOLO el rol de plataforma — la migración 003 se la
    // niega al administrador con `not like 'organizaciones.%'`. Esa es la barrera; la regla de
    // "solo desde la principal" es de coherencia y se comprueba aparte, en el manejador.
    clave: 'empresas',
    nombre: 'Empresas',
    capacidadRequerida: 'organizaciones.listar',
  },
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
  {
    // ── Tools ──
    //
    // Nació vacía y con la bandera puesta. Duró poco: la primera herramienta —Prospección en
    // Frío, traída de la fase Growth de ARIA-brain— le dio sus dos operaciones, así que la
    // bandera se cayó. Es el mismo camino que hizo `icp` en la Etapa 9.
    //
    // **Capacidades PROPIAS y no `fundaciones.*`.** Reusarlas era la salida barata y estaba mal:
    // `tools` no es Fundaciones —sus herramientas no son parte del método, son lo que se hace
    // después—, y unificarlas significaría que darle Tools a alguien le da también ICP & Oferta.
    // Sin que nadie lo decida y sin que nada falle.
    //
    // NO va en `scripts/paridad.mjs`: esa comparación es contra `aios-command-center_1.html`,
    // y esta pantalla no existe en el prototipo. Compararla daría un rojo permanente, y un
    // rojo permanente no se arregla — se ignora, y con él se ignoran los demás.
    clave: 'tools',
    nombre: 'Tools',
    capacidadRequerida: 'tools.ver',
    menu: { grupo: 'Operación', icono: '#i-tools' },
  },
  {
    // ── El Panel de Monitoreo ──────────────────────────────────────────────
    //
    // La pantalla con la que ARIA mira a sus clientes: cuántos scrapeos hizo cada empresa y con
    // qué scraper. Viene del «Panel de Control» de ARIA-brain, que leía el hub y quedaba fuera
    // de este sistema; acá lee las tablas del scraper que la migración `006_aria_cc_scraper.sql`
    // trajo a esta base, y el eje pasó de `cliente_id` a `org_id`.
    //
    // **Es la primera sección con `soloDesdeLaPrincipal`.** Su capacidad no la da ningún rol de
    // puesto: la tienen `superadministrador` y un rol propio, `monitoreo`, que se asigna persona
    // por persona — se pidió que el panel lo vean tres personas de ARIA, y `administrador` es el
    // mismo rol en cada empresa cliente. La bandera es la red debajo de eso: si alguien le
    // asignara ese rol a una persona de una empresa cliente —un error de UNA fila— vería el
    // consumo de sus competidores, y la pantalla se vería perfecta.
    //
    // NO va en `scripts/paridad.mjs`, por el mismo motivo que `tools`: esta pantalla no existe
    // en `aios-command-center_1.html`, así que compararla daría un rojo permanente — y un rojo
    // permanente no se arregla, se ignora, y con él se ignoran los demás.
    //
    // Va en «Operación» y no en el pie: el pie solo dibuja `enElPie[0]` (`components/Nav.jsx`),
    // así que una segunda sección ahí **no se vería y nada fallaría**.
    clave: 'monitoreo',
    nombre: 'Panel de Monitoreo',
    capacidadRequerida: 'monitoreo.ver',
    soloDesdeLaPrincipal: true,
    menu: { grupo: 'Operación', icono: '#i-monitoreo' },
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
  /* El tema de quien pide. No pertenece a ninguna pantalla porque el botón vive en el ARMAZÓN, que
     se dibuja en todas — y tiene que funcionar también en la de contraseña temporal, donde todavía
     no hay ninguna sección concedida. Atarlo a una pantalla sería exactamente lo que impediría eso. */
  'app/api/auth/tema/route.ts',
  // La sonda del aislamiento. Existe para la prueba de la Etapa 2 y la sonda de la 8, no
  // para una pantalla (10 § 1).
  'app/api/control/route.ts',
  // Las tareas programadas. No muestra nada y su único lector es el disparador de la plataforma:
  // declarar una `PANTALLA` la metería en la comparación de conjuntos de `ADR-0304` contra las
  // operaciones de una pantalla real, y ahí la única salida sería igualar capacidades — que es la
  // escalada silenciosa que esa regla existe para impedir.
  'app/api/cron/route.ts',
  /* ── EL AVISO DEL CRM ───────────────────────────────────────────
     No muestra nada y su único cliente es GoHighLevel. Declarar una `PANTALLA` la metería en la
     comparación de conjuntos de `ADR-0304` contra las operaciones de una pantalla real —y ahí la
     única salida sería igualar capacidades, que es la escalada silenciosa que esa regla impide—.
     Es el mismo motivo, palabra por palabra, por el que el cron está en esta lista. */
  'app/api/avisos/crm/route.ts',
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
  /* ── ACÁ ESTABA `app/api/admin/organizaciones/route.ts`, Y ERA UNA ENTRADA MUERTA ──
   *
   * Ese archivo declara `PANTALLA = 'empresas'` (route.ts:58) **y** estaba en esta lista. La prueba
   * que las cruza solo consulta `SIN_PANTALLA` en la rama `if (!pantalla)`, así que la entrada no
   * la veía nadie: ni servía ni fallaba.
   *
   * No es un detalle de prolijidad. Esta lista pasó a decidir algo —qué operaciones quedan fuera
   * del alcance por sección— y una lista que miente en una fila es una lista en la que no se puede
   * apoyar una decisión de permisos. La comprobación de entradas muertas que `ESTADOS` ya tenía
   * ahora la tiene ésta también.
   */
  'app/api/admin/usuarios/route.ts',
  'app/api/admin/usuarios/[id]/route.ts',
  'app/api/admin/usuarios/[id]/desactivar/route.ts',
  'app/api/admin/usuarios/[id]/restablecer-password/route.ts',
  'app/api/admin/usuarios/[id]/roles/route.ts',
  // ── Etapa 12 · el resto del ciclo de vida ────────────────────────────────────
  //
  // Reactivar, y editar o borrar una empresa. Van acá por el mismo motivo que las seis de arriba:
  // no muestran nada, y sus capacidades son distintas entre sí (`usuarios.desactivar`,
  // `organizaciones.editar`, `organizaciones.borrar`), así que declarar una pantalla común las
  // pondría en conflicto con `ADR-0304`.
  'app/api/admin/usuarios/[id]/activar/route.ts',
  'app/api/admin/organizaciones/[id]/route.ts',
  // ── Etapa 8 ──────────────────────────────────────────────────────────────────
  // La sonda de aislamiento. La llama una tarea programada cada hora: no hay pantalla, no hay
  // persona, y su resultado va al registro de la tarea y al canal de avisos.
  'app/api/sonda/route.ts',
  // ── Etapa 11 ──────────────────────────────────────────────────────────
  //
  // Traer los contactos de GoHighLevel. La llaman LAS DOS pestañas, así que no puede declarar
  // ni `closer` ni `setter` sin mentir sobre una — y `ADR-0304` exige que las operaciones de
  // una pantalla pidan el mismo conjunto de capacidades.
  //
  // No es una excusa para no decidir: pide `contactos.ver`, que es la capacidad de la ficha y
  // la tienen los dos roles. Lo que trae no es de una pantalla, es de un contacto.
  'app/api/contactos/sincronizar/route.ts',
  // ── Etapa 13 · la ficha del contacto ─────────────────────────────────────────
  //
  // La ficha se abre desde las tres pantallas del closer, desde las del setter y desde la
  // auditoria. Declarar `PANTALLA = 'closer'` afirmaria que es de una pestaña, y `ADR-0304`
  // cruzaria su capacidad contra las de esa pantalla sin coincidir.
  //
  // Pide `contactos.ver`, que es la capacidad de la ficha y la tienen los dos roles operativos.
  'app/api/contactos/[id]/route.ts',
  // Y sus cinco pestanas. Van todas aca por el mismo motivo que la ficha: son de UNA pantalla que
  // no es ni la del closer ni la del setter, es la ficha, y la ficha no tiene entrada de menu
  // propia. Las cinco piden `contactos.ver`; escribir una nota pide `contactos.comentar`.
  'app/api/contactos/[id]/mensajes/route.ts',
  'app/api/contactos/[id]/llamadas/route.ts',
  'app/api/contactos/[id]/perfil/route.ts',
  'app/api/contactos/[id]/historial/route.ts',
  'app/api/contactos/[id]/notas/route.ts',
  // Avanzar. Va acá por el mismo motivo que la ficha entera: se abre desde las tres pantallas del
  // closer, desde las del setter y desde la auditoría, así que declarar `PANTALLA = 'closer'`
  // afirmaría que es de una pestaña. Y no muestra nada — es una mutación.
  //
  // Pide `contactos.avanzar`, que es su propia capacidad y está catalogada: el `03` § 2 separa
  // MIRAR una ficha de REGISTRAR un resultado a propósito, porque existe un rol plausible que
  // necesite lo primero y no lo segundo.
  'app/api/contactos/[id]/avanzar/route.ts',
  /* Resolver una intervención del auditor. Va acá por el mismo motivo que Avanzar, y con una razón
     más: **la cola roja está en las DOS pestañas**. Con `PANTALLA = 'closer'`, un setter resolviendo
     desde su propia cola recibiría un 403 sobre un contacto suyo.

     Pide `contactos.resolver`, que es propia y no `contactos.avanzar`: avanzar registra un RESULTADO
     —cambia la etapa, alimenta la comisión— y esto cierra un aviso. Con una sola capacidad,
     conceder lo primero concedería lo segundo en silencio. */
  'app/api/contactos/[id]/resolver/route.ts',
  // El ciclo de ingesta de mensajes. No lo abre una pantalla: lo pide un reloj, y lo va a pedir
  // también una tarea programada. No muestra nada, así que el defecto que `ADR-0304` previene
  // —una pantalla con secciones en blanco— no lo puede producir.
  //
  // Pide `contactos.ver`, la misma capacidad que las cinco pestañas de la ficha, y a propósito:
  // es lo que hace que la ficha tenga qué leer.
  'app/api/mensajes/ingesta/route.ts',
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
 * Las claves de sección que existen. Para validar lo que llega de una petición.
 *
 * Se deriva de `SECCIONES` y no se escribe a mano: una segunda lista es una lista que va a quedar
 * corta el día que se agregue una pantalla, y el síntoma sería una sección que no se puede conceder.
 */
/**
 * Las secciones OFRECIBLES como alcance para un conjunto de capacidades, **agrupadas y en orden**.
 *
 * Es lo que el formulario de alta dibuja como casillas. Se agrupa acá y no en el componente por el
 * mismo motivo que `menuVisible`, que está escrito en `app/api/auth/sesion/route.ts`: *"si el
 * componente supiera el orden de los grupos, tendríamos otra vez dos listas que se pueden desordenar
 * una respecto de la otra"*.
 *
 * ── LA DIFERENCIA CON `menuVisible`, Y ES LA QUE IMPORTA ────────────────────
 *
 * Incluye las secciones **sin `menu`** —`usuarios` y `empresas`, que son pestañas dentro de Ajustes—
 * en un grupo propio. Si quedaran afuera serían secciones que el portero puede negar y que la
 * interfaz no puede conceder: nadie podría restringirlas nunca, y el que las tenga las tendría para
 * siempre sin que nada lo diga.
 */
export function alcanceOfrecible(
  permisos: ReadonlySet<string>,
): readonly { grupo: { clave: string; etiqueta: string | null }; secciones: readonly Seccion[] }[] {
  const alcanzables = seccionesVisibles(permisos);
  const conMenu = GRUPOS_DEL_MENU.map((grupo) => ({
    grupo,
    secciones: alcanzables.filter((s) => s.menu?.grupo === grupo.clave),
  }));
  // Las que no están en ningún grupo del menú, juntas y con nombre. Sin etiqueta serían casillas
  // huérfanas al final de la lista y nadie sabría qué son.
  const sueltas = alcanzables.filter((s) => !s.menu);
  return [
    ...conMenu,
    { grupo: { clave: 'Ajustes', etiqueta: 'Ajustes' }, secciones: sueltas },
  ].filter((g) => g.secciones.length > 0);
}

export function clavesDeSeccion(): readonly string[] {
  return SECCIONES.map((s) => s.clave);
}

/**
 * Las secciones que una persona ve: lo que su ROL habilita, cortado por su ALCANCE personal.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ESTO PARECE VIOLAR UNA REGLA ESCRITA DEL PROYECTO, Y HAY QUE DECIRLO ENTERO
 *
 * `db/migraciones/003_roles_y_permisos.sql:114-118` dice, sobre los permisos efectivos:
 *
 *   *"SOLO SUMA, NUNCA RESTA: no hay permisos negativos. Un modelo con «permitir» y «denegar»
 *   necesita reglas de precedencia, y esas reglas se vuelven imposibles de razonar en cuanto un
 *   usuario tiene tres roles. Si hace falta que alguien tenga CASI un rol, la respuesta es un rol
 *   nuevo — que con este modelo cuesta una fila."*
 *
 * Y un alcance por persona **parece** exactamente eso: el rol da diez pestañas y el alcance deja
 * tres. Tres razones por las que no es lo mismo, y si alguna de las tres deja de ser cierta hay que
 * volver a discutir esto:
 *
 *   1 · **No toca ninguna capacidad.** Dos personas con el mismo rol y alcances distintos tienen el
 *       MISMO conjunto de capacidades. El alcance no habilita nada que el rol no habilite —es una
 *       intersección, nunca una unión— así que no existe la pregunta «¿gana el permiso o la
 *       negación?».
 *   2 · **No hay precedencia que razonar**, que es el problema concreto que la regla nombra. El
 *       alcance es UNO por persona, no uno por rol: no se combinan tres alcances, no hay orden.
 *   3 · **La alternativa que la regla propone no puede expresar esto.** Siete secciones —executive,
 *       contacts, acquisition, creative, conversion, conversation, sales— comparten la capacidad
 *       `tablero.ver`. Un rol nuevo por combinación no las separa: **ninguna combinación de
 *       capacidades puede**, porque la capacidad no distingue esas siete pantallas. O se agrega un
 *       eje nuevo, o el pedido es imposible.
 *
 * Y una consecuencia que hay que respetar en todos los llamadores: el alcance se comprueba
 * **ADEMÁS** de la capacidad, nunca en su lugar. Un alcance que conceda `credenciales` a un rol que
 * no tiene `credenciales.ver` no concede nada.
 *
 * ── CERO FILAS: DOS HECHOS DISTINTOS, Y NO LOS SEPARA LA PRESENCIA DE FILAS ──
 *
 * La primera versión de esto decía: «si la persona tiene filas, solo esas secciones; si no tiene, sin
 * restricción». **Falla ABIERTO**, y el camino es un clic normal: `POST /api/admin/usuarios/{id}/roles`
 * reemplaza los roles y no toca nada más, así que degradar a alguien de `administrador` a `usuario` lo
 * dejaba con cero filas — o sea con las diez pestañas. Y al revés era peor: promover dejaba un
 * administrador restringido a una pestaña **sin ninguna operación para arreglarlo**.
 *
 * Lo que separa los dos ceros es un hecho AFIRMADO en el rol, `secciones_restringidas`:
 *
 *   · rol no restringido → sin alcance, y las filas se ignoran. Es lo que expresa «el administrador
 *     está desbloqueado» sin escribir el nombre de ningún rol (`ADR-0302`).
 *   · rol restringido → solo las concedidas, y cero filas son **cero pestañas**. Falla CERRADO.
 *
 * Por eso el parámetro es una unión discriminada y no un `Set | null`: con el nulo, «restringido con
 * conjunto indefinido» era expresable, y era justamente el estado que abre la puerta.
 */
/**
 * «Esta operación no pertenece a ninguna pantalla» es un VALOR CON NOMBRE, no una ausencia.
 *
 * Mismo argumento que `NINGUNA` en `capacidades.ts`: *"una lista vacía se puede pasar por accidente y
 * ABRIRÍA la operación. Un valor con nombre tiene que escribirse a propósito."* Acá el accidente
 * sería un `undefined` que dejara la operación fuera del alcance sin que nadie lo decidiera.
 *
 * Y es válido **solo** para las rutas listadas en `SIN_PANTALLA`, que ahora tiene comprobación de
 * entradas muertas en las dos direcciones. Escribirlo deja de ser una decisión que se toma sola y
 * pasa a ser una línea en una lista que alguien revisa.
 */
export const SIN_SECCION = 'sin_seccion' as const;

/** Qué pantalla pide una operación: una sección, o ninguna con nombre. */
export type Pantalla = string | typeof SIN_SECCION;

export type Alcance =
  | { readonly restringido: false }
  | { readonly restringido: true; readonly concedidas: ReadonlySet<string> };

/**
 * ¿Esta persona es de la organización principal? **Se pregunta sobre la SUYA, no sobre la que
 * está mirando.**
 *
 * ── LA FÓRMULA, Y POR QUÉ NO HACE FALTA UNA CONSULTA MÁS ───────────────────
 *
 * `contexto.organizacion` describe `orgEfectiva`, no `orgPropia`, así que su `esPrincipal` no
 * responde directamente la pregunta. Las dos ramas la responden entre las dos, y cada una se
 * apoya en un hecho que ya está garantizado en otro lado:
 *
 *   · `esRolDePlataforma` → la bandera `solo_principal` del rol, que el 03 § 3 llama *"LA
 *     BARRERA contra la escalada entre inquilinos"* y que un disparador de la base hace
 *     cumplir: **un rol de plataforma solo puede vivir en la organización principal**. O sea
 *     que para el superadministrador `orgPropia` ES la principal, esté mirando lo que esté
 *     mirando. Sin esta rama, conmutarse a una empresa cliente le apagaría el panel — el
 *     encierro exacto que la pestaña Empresas ya pagó una vez.
 *
 *   · Para todos los demás, `orgEfectiva === orgPropia` **por construcción**: la fórmula del
 *     04 § 8 solo respeta `sesiones.org_activa` si el rol es de plataforma. Así que para un
 *     administrador o un usuario, `organizacion.esPrincipal` sí habla de su propia empresa.
 *
 * Lo que está PROHIBIDO acá es la tercera vía, la que aparece sola: comparar el nombre de la
 * organización con la cadena `'ARIA'`. Es lo que `Contexto.organizacion` ya advierte — *"el día
 * que alguien renombre la organización, la pantalla cambia de comportamiento sin que nadie
 * toque una línea"*.
 */
export function esDeLaPrincipal(contexto: {
  esRolDePlataforma: boolean;
  organizacion: { esPrincipal: boolean };
}): boolean {
  return contexto.esRolDePlataforma || contexto.organizacion.esPrincipal;
}

/**
 * Las secciones que sobreviven a la regla de la organización principal.
 *
 * Está separada de `puede(` a propósito, y no es cosmética: `puede(` responde *"¿el rol lo
 * habilita?"* y la usan el formulario de alcance y las pruebas del catálogo, donde no hay
 * ninguna organización de la que hablar. Mezclarlas obligaría a inventar un valor para ese
 * parámetro en lugares donde la pregunta no tiene sentido, y un valor inventado en una función
 * de permisos es cómo se abre una puerta sin que nadie lo decida.
 */
function filtrarPorOrganizacion(
  secciones: readonly Seccion[],
  desdeLaPrincipal: boolean,
): readonly Seccion[] {
  if (desdeLaPrincipal) return secciones;
  return secciones.filter((s) => !s.soloDesdeLaPrincipal);
}

/**
 * @param desdeLaPrincipal lo que devuelve `esDeLaPrincipal(contexto)`. Va OBLIGATORIO y no
 *   opcional por el mismo motivo que el alcance (ver `menuVisible`): opcional deja que un
 *   llamador nuevo se lo olvide y muestre de más **sin fallar**; obligatorio rompe la
 *   compilación en cada llamador, que es el resultado buscado.
 */
export function seccionesConAlcance(
  permisos: ReadonlySet<string>,
  alcance: Alcance,
  desdeLaPrincipal: boolean,
): readonly Seccion[] {
  const delRol = filtrarPorOrganizacion(seccionesVisibles(permisos), desdeLaPrincipal);
  if (!alcance.restringido) return delRol;
  return delRol.filter((s) => alcance.concedidas.has(s.clave));
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
  alcance: Alcance,
  desdeLaPrincipal: boolean,
): readonly { grupo: { clave: string; etiqueta: string | null }; secciones: readonly Seccion[] }[] {
  /* El alcance va OBLIGATORIO, no opcional, y la diferencia es todo: opcional deja que un llamador
     nuevo se lo olvide y muestre el menú entero **sin fallar**. Obligatorio rompe la compilación en
     cada llamador, que es el resultado buscado.

     Y el corte se aplica ACÁ, antes de agrupar. Aplicarlo afuera sobre el menú ya agrupado dejaría
     grupos con título y nada adentro — un título flotando sobre el vacío, que es lo que la regla de
     abajo prohíbe. */
  const visibles = seccionesConAlcance(permisos, alcance, desdeLaPrincipal).filter((s) => s.menu);
  return GRUPOS_DEL_MENU.map((grupo) => ({
    grupo,
    secciones: visibles.filter((s) => s.menu!.grupo === grupo.clave),
  })).filter((g) => g.secciones.length > 0);
}

/**
 * La pantalla con la que se abre la aplicación, y el grupo que la encabeza.
 *
 * ── POR QUÉ ESTO ES UNA FUNCIÓN Y NO TRES `[0]` REPETIDOS ────────────────────
 *
 * Porque ya eran dos, el tercero faltaba, y el que faltaba es el que se vio. `Nav.jsx` marcaba la
 * fila activa con `grupos[0]?.secciones[0]`, `CommandCenter.jsx` dibujaba la vista activa con
 * `i === 0`, y cada uno llevaba un comentario diciendo que el otro «usa la misma regla sobre el
 * mismo orden». Eso es una lista paralela escrita en prosa: mientras nadie la rompa, funciona.
 *
 * **El tercer lugar no tenía ni comentario ni regla: la miga de pan.** `TopBar.jsx` traía
 * `Executive` escrito a mano —del prototipo— y `AskBar.jsx` lo mismo. Medido en el navegador con
 * una persona restringida a Closer y Tools: el menú mostraba las dos pestañas correctas, la vista
 * abierta era Closer, y arriba decía **«AIOS / Executive»**. La miga nombraba una pantalla que esa
 * persona no puede ver Y que no era la que estaba abierta.
 *
 * No es una fuga —`Executive` es el nombre de una pestaña, no el dato de nadie— pero sí es la
 * interfaz afirmando algo falso en el único lugar cuyo trabajo es decir dónde estás.
 *
 * ── EL CUERPO ANTES QUE EL PIE, Y NO ES UN DETALLE ───────────────────────────
 *
 * Alguien con pestañas de trabajo **no puede** abrir en la configuración. Al revés sí: si su única
 * sección fuera Ajustes, abrir en Ajustes es lo correcto. Es la regla que `Nav.jsx` ya aplicaba;
 * acá queda escrita una vez.
 *
 * Devuelve el `clave` del GRUPO y no su `etiqueta`, a propósito: es lo que muestra la miga hoy
 * —`irALaVista` hace `GROUP[clave]`— y el primer grupo tiene `etiqueta: null`, así que con la
 * etiqueta la miga de un ejecutivo quedaría vacía. La rareza de que el pie diga «Pie» se hereda de
 * `lib/aios/shell.js`, donde ya está anotada como trabajo aparte; lo que no puede pasar es que este
 * lugar y el clic en el menú muestren cosas distintas para la misma pantalla.
 *
 * @param menu lo que devuelve `menuVisible`, con el alcance ya aplicado.
 * @returns `null` cuando no hay ninguna sección. No se inventa una: quien llama tiene que poder
 *   distinguir «abre en Closer» de «no hay nada que abrir» — un estado alcanzable, un rol
 *   restringido sin secciones concedidas, que hoy no tiene pantalla propia.
 */
export function seccionDeArranque(
  menu: readonly { grupo: { clave: string }; secciones: readonly Seccion[] }[],
): { seccion: Seccion; grupo: string } | null {
  const esPie = (clave: string) => GRUPOS_DEL_MENU.find((g) => g.clave === clave)?.pie === true;
  const enOrden = [...menu.filter((g) => !esPie(g.grupo.clave)), ...menu.filter((g) => esPie(g.grupo.clave))];
  for (const g of enOrden) {
    const seccion = g.secciones[0];
    if (seccion) return { seccion, grupo: g.grupo.clave };
  }
  return null;
}
