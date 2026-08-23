// De qué anfitrión es una cadena de conexión, y cuándo eso importa.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE ESTE ARCHIVO
//
// La suite de pruebas de base BORRA. No es un efecto colateral: es su trabajo.
// `limpiarTodo()` en `50-administracion.test.ts` deja la base "como la dejó el
// sembrado", y para eso borra todo usuario que no sea uno de los tres de
// desarrollo. `60-credenciales.test.ts` vacía `organizaciones_credenciales`
// entera, en el `before` Y en el `after`. `12-la-ventana-del-sembrado-esta-cerrada`
// corre un `update identidad.organizaciones set nombre = 'pisado'` SIN `where`.
//
// Todo eso es correcto contra el contenedor efímero de la Etapa 0, y es
// exactamente lo que la suite tiene que hacer ahí.
//
// Contra un proveedor administrado con datos reales es una pérdida de datos, y en
// un caso es IRREVERSIBLE: las credenciales están cifradas con `CLAVE_MAESTRA`, así
// que lo que ese `delete` se lleva no se recupera de ningún lado. Cada organización
// habría que reconectarla a mano con su CRM, su pasarela y su proveedor de IA.
//
// Y la distancia entre las dos cosas era UN ARCHIVO: `.env.local` apuntando a
// Supabase y un `npm test`. Nada en el repositorio lo impedía.
//
// El sembrado ya se defendía así desde la Etapa 0 (`exigirBaseLocal()`), y era la
// única barrera efectiva del proyecto. Esto la generaliza en vez de copiarla: una
// cuarta copia de la misma lista de anfitriones es cómo una de las cuatro se queda
// vieja — es la deuda que `SECCIONES` ya tiene nombrada en `docs/ETAPA-3.md`.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Los anfitriones que cuentan como "la base de desarrollo de esta máquina".
 *
 * Lista blanca, no lista negra, y la diferencia es la que importa: con una lista
 * negra hay que acertar el nombre de cada proveedor administrado que exista y de
 * los que existan mañana. Con una lista blanca, cualquier cosa que no sea una de
 * estas cuatro está afuera sin que nadie la haya tenido que prever.
 *
 * Es un arreglo y no un `Set`, a propósito. `pruebas/codigo/70-publicacion.test.ts`
 * (ADR-0703) falla si un módulo del servidor declara una estructura mutable en el
 * nivel superior, porque en funciones sin servidor las instancias se reutilizan
 * entre peticiones de organizaciones distintas. Esta lista es constante y no guarda
 * nada de nadie, así que sería un falso positivo — pero el arreglo de la prueba
 * sería agregar una excepción, y esa prueba vale justamente por no tener ninguna.
 * Con cuatro elementos, `includes` y un `Set` son lo mismo.
 */
const LOCALES: readonly string[] = [
  'localhost',
  '127.0.0.1',
  '::1',
  // El contenedor hablando con el anfitrión: es local en el sentido que importa acá.
  'host.docker.internal',
];

/**
 * Proveedores administrados conocidos. NO es el mecanismo de defensa —la lista
 * blanca de arriba ya los excluye a todos— sino el límite de la escotilla.
 *
 * La escotilla existe porque un `throw` sin salida se termina comentando, y un
 * guard comentado no protege nada. Pero una escotilla que alcanza para apuntar la
 * suite a producción no es una escotilla, es el agujero con otro nombre. Así que la
 * escotilla puede saltear la lista blanca y NO puede saltear esta lista.
 */
const ADMINISTRADOS: readonly string[] = [
  'supabase.co',
  'supabase.com',
  'pooler.supabase.com',
  'neon.tech',
  'rds.amazonaws.com',
  'azure.com',
  'render.com',
  'railway.app',
  'planetscale.com',
];

/**
 * El anfitrión de una cadena de conexión, o `undefined` si no se puede leer.
 *
 * Los corchetes de IPv6 se quitan, y eso arregla un defecto que venía del guard
 * original del sembrado: `URL.hostname` devuelve `[::1]` CON corchetes, así que el
 * `'::1'` que estaba en su lista blanca no era alcanzable nunca. Fallaba del lado
 * seguro —rechazaba una dirección local en vez de aceptar una remota— y por eso
 * nadie lo vio. Se arregla acá porque una entrada de lista blanca que no puede
 * coincidir es peor que no tenerla: dice que un caso está cubierto y no lo está.
 */
export function anfitrionDe(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^\[(.*)\]$/, '$1');
  } catch {
    return undefined;
  }
}

/** Si el anfitrión de la cadena es la base local de esta máquina. */
export function esAnfitrionLocal(url: string): boolean {
  const anfitrion = anfitrionDe(url);
  return anfitrion !== undefined && LOCALES.includes(anfitrion);
}

/**
 * Si la cadena apunta a un proveedor administrado conocido.
 *
 * Se compara sobre la cadena COMPLETA y no solo sobre el anfitrión, a propósito:
 * una cadena que no se puede parsear como URL devuelve `undefined` en
 * `anfitrionDe()`, y el modo de fallar seguro es que igual la reconozcamos.
 */
export function esProveedorAdministrado(url: string): boolean {
  const texto = url.toLowerCase();
  return ADMINISTRADOS.some((p) => texto.includes(p));
}

/**
 * Si estamos corriendo dentro del corredor de pruebas.
 *
 * `NODE_TEST_CONTEXT` la pone **Node**, no nosotros, en el entorno de cada
 * subproceso de archivo de prueba. Eso es justo lo que hace falta: un marcador que
 * nadie se puede olvidar de poner, y que está presente igual si alguien corre
 * `node --test pruebas/base/60-credenciales.test.ts` directo salteando
 * `scripts/pruebas.mjs`.
 *
 * Un marcador propio (`ARIA_PRUEBAS=1` en el guion de npm) habría fallado
 * exactamente en ese caso — que es el camino que toma cualquiera depurando UNA
 * prueba, o sea el camino de la persona que más apurada está.
 */
export function enPruebas(): boolean {
  return process.env.NODE_TEST_CONTEXT !== undefined || process.env.NODE_ENV === 'test';
}

export interface OpcionesDeExigencia {
  /** Quién exige, para que el mensaje diga qué se estaba por hacer. */
  quien: string;
  /** Qué escribe o borra, para que el mensaje diga por qué importa. */
  porque: string;
  /**
   * La variable de entorno que saltea la lista blanca. Cada llamador trae la suya:
   * forzar el sembrado en un anfitrión local raro no tiene por qué desbloquear
   * además la suite de pruebas.
   */
  escotilla: string;
}

/**
 * Lanza si la cadena no apunta a la base local.
 *
 * El mensaje nombra las tres cosas que alguien necesita para entender qué pasó sin
 * leer este archivo: a dónde apuntaba, qué se estaba por hacer, y qué se habría
 * perdido.
 */
export function exigirAnfitrionLocal(url: string, o: OpcionesDeExigencia): void {
  if (esAnfitrionLocal(url)) return;

  const anfitrion = anfitrionDe(url) ?? '(cadena de conexión ilegible)';

  // La escotilla, y su límite. El orden importa: se comprueba el proveedor
  // administrado ANTES de honrar la escotilla, así que `ARIA_…_FORZADO=1` no puede
  // apuntar nada a Supabase.
  if (process.env[o.escotilla] === '1') {
    if (!esProveedorAdministrado(url)) {
      console.warn(
        `${o.quien}: ${o.escotilla}=1 — se omite la comprobación de anfitrión para ` +
          `"${anfitrion}".`,
      );
      return;
    }
    throw new Error(
      `${o.quien} se niega a correr contra "${anfitrion}", y ${o.escotilla}=1 NO lo ` +
        'habilita: es un proveedor administrado. Esa escotilla existe para un ' +
        `anfitrión local con otro nombre, no para apuntar a producción. ${o.porque}`,
    );
  }

  throw new Error(
    `${o.quien} se niega a correr contra "${anfitrion}": solo anfitriones locales. ` +
      `${o.porque} Para la base local: \`npm run db:reset\`.`,
  );
}
