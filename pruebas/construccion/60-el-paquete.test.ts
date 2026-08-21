// ADR-0601 — Ningún secreto llega al navegador. INNEGOCIABLE.
// Tipo: **Construcción** — inspecciona el artefacto de `next build`, no el código fuente.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES EL CRITERIO DE CIERRE DE LA ETAPA 6, Y EL ÚNICO DE SU TIPO EN TODO EL PROYECTO
//
// `EJECUCION` § 5: *"el paquete que se publica al navegador **no contiene los nombres ni los
// valores** de ninguna variable secreta."*
//
// El `08` § 4 dice por qué esta fila es innegociable y no una más:
//
//   "En un dominio público una filtración así es TOTAL, PERMANENTE Y PUBLICADA — queda en un
//    paquete que la gente ya descargó y en la caché de la red de distribución."
//
// No se puede rotar y ya está: hay que asumir que quien lo quiso ver, lo vio.
//
// ── POR QUÉ NO ALCANZA LA PRUEBA DE CÓDIGO QUE YA EXISTE ─────────────────────
//
// `pruebas/codigo/01-cadena-de-dependencias` busca el prefijo público en el código fuente. Mira
// cinco directorios, solo el prefijo, y solo NOMBRES. Se le escapan tres caminos enteros:
//
//   1. `env: {}` en `next.config` inyecta **siempre**, sin prefijo. La documentación del paquete
//      instalado usa esa palabra: *"will always be included in the JavaScript bundle"*. No deja
//      rastro en ningún nombre de variable ni en ningún `.env`, y este `next.config.mjs` de tres
//      líneas lo hace trivial de agregar.
//   2. Un componente de servidor que **renderice** un secreto al HTML. No hay prefijo, no hay
//      `env`, no hay nada que un barrido de nombres detecte. Solo la búsqueda de VALORES sobre
//      los payloads prerrenderizados lo agarra.
//   3. Cualquier cosa que el empaquetador arrastre desde una dependencia.
//
// ── QUÉ ES "EL PAQUETE QUE SE PUBLICA AL NAVEGADOR" ──────────────────────────
//
// **No es solo `.next/static`.** También son los payloads prerrenderizados —`.html`, `.rsc`,
// `.segments/*.rsc`— que se envían literalmente al cliente, y `public/` si existiera.
//
// Y hay dos conjuntos que **no** se barren, cada uno por su motivo:
//
//   · `.next/server/**` en general: el código de servidor menciona `process.env.CLAVE_MAESTRA`
//     legítimamente, y una prueba que falla siempre se relaja hasta dejar de significar algo.
//   · `.next/cache`: `next build` lo **preserva** entre corridas, así que contiene material de
//     builds anteriores. Un secreto de la semana pasada, ya arreglado, daría un rojo que no
//     corresponde al commit — el otro camino por el que una prueba se debilita.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { archivosFuente, RAIZ } from '../apoyo/fuente.ts';

const SALIDA = join(RAIZ, '.next');

/**
 * Las variables **secretas**: las que no pueden aparecer, ni por nombre ni por valor.
 *
 * Clasificar de más es tan malo como de menos, y por un camino que se ve venir: `DOMINIO_ESPERADO`
 * vale el dominio público de la aplicación y va a aparecer en cualquier enlace absoluto;
 * `CABECERA_DIRECCION_REAL` vale `x-real-ip`, que es corto y genérico y coincide por casualidad.
 * Buscar sus valores da **rojo permanente**, el rojo permanente produce excepciones, y las
 * excepciones son donde después se cuela lo que importa.
 */
const SECRETAS = [
  'DATABASE_URL_ADMIN',
  'DATABASE_URL_MIGRADOR',
  'DATABASE_URL_INQUILINO',
  'DATABASE_URL_IDENTIDAD',
  'CLAVE_MAESTRA',
] as const;

/** Públicas por naturaleza. Se vigila el NOMBRE igual —no tienen por qué estar— pero no el valor. */
const NO_SECRETAS = ['DOMINIO_ESPERADO', 'CABECERA_DIRECCION_REAL'] as const;

/** Todo archivo bajo un directorio, sin filtrar por extensión. */
function todoBajo(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name));
}

/**
 * Los archivos que llegan al navegador.
 *
 * Se barre TODO y se excluye a propósito, en vez de incluir por lista de extensiones: el paquete
 * real tiene `.css`, manifiestos `.js`, y 22 `.woff2`. Un secreto en una `url(data:…)` de un CSS
 * o el nombre de una variable en un manifiesto quedan fuera de cualquier lista de extensiones que
 * uno escriba de memoria.
 */
function archivosDelNavegador(): string[] {
  const estaticos = todoBajo(join(SALIDA, 'static'));
  // Los payloads PRERRENDERIZADOS: se envían literalmente al cliente.
  const prerrenderizados = todoBajo(join(SALIDA, 'server')).filter((f) =>
    /\.(html|rsc)$/.test(f),
  );
  const publicos = todoBajo(join(RAIZ, 'public'));
  return [...estaticos, ...prerrenderizados, ...publicos];
}

function leer(f: string): string {
  // `latin1` y no `utf8`: nunca lanza sobre binarios, y un secreto ASCII escondido en un `.woff2`
  // se sigue viendo. Con `utf8` los bytes inválidos se reemplazan y podrían partir la cadena.
  return readFileSync(f, 'latin1');
}

// ─── La guarda de frescura, que es la que decide si esta prueba vale algo ───

test('ADR-0601 · hay un paquete construido, y es MÁS NUEVO que el código', () => {
  // Sin esto, el modo de fallo por omisión es el peor: `.next` está en `.gitignore`, así que un
  // clon nuevo no lo tiene; y en una máquina de trabajo puede ser de hace una semana. La prueba
  // pasaría verde sobre un paquete anterior al commit que introduce la filtración.
  //
  // Y la reacción natural —`t.skip()` o `if (!existsSync) return`— convierte la fila innegociable
  // en cero pruebas corridas que reportan éxito. Es exactamente lo que `scripts/pruebas.mjs`
  // existe para impedir. Así que esto FALLA, y con el comando exacto.
  const marca = join(SALIDA, 'BUILD_ID');
  assert.ok(
    existsSync(marca),
    'no hay paquete construido. Esta fila es INNEGOCIABLE y no se puede saltear:\n' +
      '  npm run build\n' +
      'y volvé a correr la suite.',
  );

  const construido = statSync(marca).mtimeMs;
  const fuentes = archivosFuente(['app', 'components', 'lib']);
  assert.ok(fuentes.length > 0);
  const masNuevo = fuentes
    .map((a) => ({ ruta: a.ruta, t: statSync(join(RAIZ, a.ruta)).mtimeMs }))
    .sort((x, y) => y.t - x.t)[0];

  assert.ok(masNuevo);
  assert.ok(
    construido >= masNuevo.t,
    `el paquete es más viejo que ${masNuevo.ruta}: estarías inspeccionando un build anterior ` +
      'al cambio. Corré `npm run build`.',
  );

  // Y que el barrido tenga algo que barrer.
  assert.ok(
    archivosDelNavegador().length > 0,
    'el paquete no tiene ni un archivo de navegador: el barrido pasaría en vacío',
  );
});

// ─── Los NOMBRES ────────────────────────────────────────────────────────────

test('ADR-0601 · ningún NOMBRE de variable de entorno aparece en el paquete', () => {
  const archivos = archivosDelNavegador();
  const hallazgos: string[] = [];

  for (const f of archivos) {
    const contenido = leer(f);
    for (const nombre of [...SECRETAS, ...NO_SECRETAS]) {
      if (contenido.includes(nombre)) {
        hallazgos.push(`${relative(RAIZ, f).split(sep).join('/')} contiene el nombre ${nombre}`);
      }
    }
  }

  assert.deepEqual(
    hallazgos,
    [],
    'un nombre de variable en el paquete del navegador significa que el empaquetador la inlineó',
  );
});

// ─── Los VALORES ────────────────────────────────────────────────────────────

test('ADR-0601 · ningún VALOR secreto aparece en el paquete', () => {
  const archivos = archivosDelNavegador();
  const hallazgos: string[] = [];
  const sinValor: string[] = [];

  for (const nombre of SECRETAS) {
    const valor = process.env[nombre];

    // UNA VARIABLE SIN VALOR NO SE SALTEA EN SILENCIO.
    //
    // `''.includes` devuelve siempre `true`, así que el `if (!valor) continue` que todo el mundo
    // escribe para arreglarlo convierte la comprobación en cero. Y ese `continue` es justo el
    // agujero que hacía decorativa esta mitad de la fila: hasta la Etapa 6 la integración
    // construía SIN `CLAVE_MAESTRA`, así que un `NEXT_PUBLIC_CLAVE_MAESTRA` se inlineaba como
    // `undefined` —nada que encontrar, verde— y con la clave real en producción.
    if (!valor) {
      sinValor.push(nombre);
      continue;
    }

    // Las tres formas en que el mismo secreto puede aparecer, y las tres hacen falta:
    const formas = new Map<string, string>([[`${nombre} (valor)`, valor]]);
    // 1 · La contraseña sola, extraída de la cadena de conexión. Es lo que de verdad importa de
    //     una `DATABASE_URL_*`, y puede viajar sin el resto de la URL.
    try {
      const url = new URL(valor);
      if (url.password) {
        formas.set(`${nombre} (contraseña)`, decodeURIComponent(url.password));
        formas.set(`${nombre} (contraseña sin decodificar)`, url.password);
      }
    } catch {
      // No es una URL. Es lo esperable para `CLAVE_MAESTRA`.
    }
    // 2 · Percent-encoded, que es como puede terminar dentro de una cadena de consulta.
    formas.set(`${nombre} (percent-encoded)`, encodeURIComponent(valor));
    // 3 · Con las barras escapadas, que es lo que hace un minificador dentro de una cadena.
    if (valor.includes('/')) formas.set(`${nombre} (escapado)`, valor.replace(/\//g, '\\/'));

    for (const f of archivos) {
      const contenido = leer(f);
      for (const [etiqueta, forma] of formas) {
        // Una forma muy corta coincide por casualidad. Ocho caracteres es el piso.
        if (forma.length < 8) continue;
        if (contenido.includes(forma)) {
          hallazgos.push(`${relative(RAIZ, f).split(sep).join('/')} contiene ${etiqueta}`);
        }
      }
    }
  }

  assert.deepEqual(
    sinValor,
    [],
    'estas variables están clasificadas como SECRETAS y no tienen valor en este proceso, así que ' +
      'la búsqueda no busca nada. El build y la prueba tienen que compartir entorno: mirá ' +
      '`scripts/credenciales.mjs --github-env`.',
  );
  assert.deepEqual(hallazgos, [], 'un valor secreto llegó al paquete del navegador');
});

// ─── Los caminos que un barrido de nombres NO ve ────────────────────────────

test('ADR-0601 · `next.config` no inyecta variables al paquete', () => {
  // `env: {}` en la configuración inyecta **siempre**, sin prefijo y sin dejar rastro en ningún
  // nombre de variable. Es el camino que la prueba de código no ve.
  const config = archivosFuente(['.']).find((a) => a.ruta === 'next.config.mjs');
  const texto = config?.limpio ?? '';
  assert.ok(texto.length > 0, 'no se pudo leer next.config.mjs');

  assert.doesNotMatch(
    texto,
    /\benv\s*:/,
    '`env` en next.config inyecta SIEMPRE al paquete del navegador, sin prefijo',
  );
  // Eliminado en 16, pero la guarda es gratis y el día que alguien copie un ejemplo viejo el
  // mensaje va a decir por qué no sirve.
  assert.doesNotMatch(texto, /publicRuntimeConfig|serverRuntimeConfig/);
});

test('ADR-0601 · los mapas de origen del navegador están apagados', () => {
  // `productionBrowserSourceMaps: true` publica `.next/static/**/*.js.map` con el código fuente
  // completo del cliente, y Next los sirve solo. Ninguna búsqueda de nombres ni de valores lo
  // detecta si el secreto no está en el paquete: hay que afirmar la bandera aparte.
  const config = archivosFuente(['.']).find((a) => a.ruta === 'next.config.mjs');
  assert.doesNotMatch(config?.limpio ?? '', /productionBrowserSourceMaps\s*:\s*true/);

  // Y la comprobación sobre el artefacto, que es la que de verdad cierra: cero mapas servibles.
  const mapas = archivosDelNavegador().filter((f) => f.endsWith('.map'));
  assert.deepEqual(
    mapas.map((f) => relative(RAIZ, f).split(sep).join('/')),
    [],
    'hay mapas de origen en el paquete del navegador: reconstruyen el código fuente verbatim',
  );
});
