// ADR-0001 — Las pruebas corren en cada cambio y pueden bloquear. INNEGOCIABLE.
//
// Envoltorio del corredor de pruebas. Es lo que corre `npm test`, y lo que corre
// la integración continua.
//
// Existe por un defecto verificado del corredor: `node --test` con un patrón que
// no coincide con ningún archivo **sale 0**. Un glob mal escrito —un directorio
// renombrado, una extensión cambiada— dejaría la integración VERDE con cero
// pruebas corridas. Y "una prueba que pasa en vacío es peor que ninguna"
// (09-ESCOTILLA-Y-ESTADOS § 4), porque viene con la confianza de haber corrido.
//
// Entonces: acá se enumeran los archivos, se ABORTA si la lista está vacía, y se
// le pasa la lista explícita al corredor.

import { readdirSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath` y no `new URL(...).pathname`: la ruta de este repo CONTIENE UN
// ESPACIO, y `pathname` lo deja percent-encoded como `%20`, así que la ruta
// resultante no existe. Es la misma clase de error que las listas blancas que
// comparan rutas con separadores distintos entre Windows y Linux.
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const DIR_PRUEBAS = join(RAIZ, 'pruebas');

// Los fixtures NO terminan en `.test.ts` a propósito, así que el sufijo ya los
// excluye. La exclusión por directorio es el segundo cinturón: si alguien alguna
// vez nombra un fixture `algo.test.ts`, el corredor lo levantaría como prueba y
// la suite fallaría siempre — que es como se aprende a ignorar una suite.
const SUFIJO = '.test.ts';
const DIRS_EXCLUIDOS = new Set(['fixtures']);

function enumerarPruebas() {
  if (!existsSync(DIR_PRUEBAS)) return [];
  return readdirSync(DIR_PRUEBAS, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(SUFIJO))
    .map((e) => join(e.parentPath, e.name))
    .filter((ruta) => !relative(DIR_PRUEBAS, ruta).split(sep).some((p) => DIRS_EXCLUIDOS.has(p)))
    .map((ruta) => relative(RAIZ, ruta).split(sep).join('/'))
    .sort();
}

const argv = process.argv.slice(2);

// Guard de recursión. La prueba de la fila ⛔ 1 invoca este mismo envoltorio como
// proceso hijo para verificar que sale 1. Si ese hijo expandiera el glob completo,
// se levantaría a sí mismo.
if (process.env.ARIA_CORREDOR_ANIDADO === '1' && argv.length === 0) {
  console.error(
    'pruebas.mjs: invocación anidada sin argumentos. Un hijo del corredor tiene que ' +
      'nombrar los archivos que corre, o se levanta a sí mismo.',
  );
  process.exit(1);
}

let objetivos;
if (argv.length > 0) {
  // Rutas explícitas: se usan tal cual (la compuerta y la prueba de la fila 1).
  // Un archivo o directorio inexistente es un error, no una suite vacía — es
  // exactamente el caso que este envoltorio existe para no dejar pasar.
  const faltantes = argv.filter((a) => !existsSync(join(RAIZ, a)));
  if (faltantes.length > 0) {
    console.error(`pruebas.mjs: no existe: ${faltantes.join(', ')}`);
    process.exit(1);
  }
  objetivos = argv.flatMap((a) => {
    const abs = join(RAIZ, a);
    if (statSync(abs).isDirectory()) {
      return readdirSync(abs, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(SUFIJO))
        .map((e) => relative(RAIZ, join(e.parentPath, e.name)).split(sep).join('/'))
        .sort();
    }
    return [a.split(sep).join('/')];
  });
  if (objetivos.length === 0) {
    console.error(`pruebas.mjs: los objetivos no contienen ningún ${SUFIJO}: ${argv.join(', ')}`);
    process.exit(1);
  }
} else {
  objetivos = enumerarPruebas();
  if (objetivos.length === 0) {
    console.error(
      `pruebas.mjs: cero archivos ${SUFIJO} bajo pruebas/. Se aborta en vez de salir 0: ` +
        'una suite vacía que reporta éxito es peor que ninguna suite.',
    );
    process.exit(1);
  }
}

console.log(`pruebas.mjs: ${objetivos.length} archivo(s)`);
for (const o of objetivos) console.log(`  ${o}`);

// `NODE_TEST_CONTEXT` se BORRA, no se hereda.
//
// Node se la pone a todo archivo de prueba que corre como subproceso, y un
// `node --test` que la hereda pasa a modo hijo y SALE 0 AUNQUE SUS PRUEBAS FALLEN
// —espera que un corredor padre agregue los resultados—. Este envoltorio se invoca
// desde dentro de una prueba (la fila ⛔ 1 lo hace), así que sin borrarla el
// resultado del hijo sería siempre 0. Es exactamente un éxito reportado que no
// ocurrió, la firma del defecto que todo este diseño existe para evitar.
const entorno = { ...process.env, ARIA_CORREDOR_ANIDADO: '1' };
delete entorno.NODE_TEST_CONTEXT;

// El entorno lo carga el HIJO, no el guion de npm.
//
// Así `node scripts/pruebas.mjs` funciona igual que `npm test`, en vez de dar
// dieciséis fallas crípticas de "DATABASE_URL_… no está definida" cuando alguien lo
// invoca directo y se olvida la bandera. Un solo lugar decide de dónde sale el
// entorno de las pruebas.
//
// UN archivo a la vez.
//
// Todas las pruebas de base comparten UNA base de datos, y varias enumeran objetos
// globales: los esquemas, las tablas de `public`, los roles del clúster. En paralelo,
// un objeto que otra prueba está creando y borrando aparece en esa enumeración y la
// falla depende del orden — que es exactamente como se aprende a volver a correr la
// suite hasta que da verde, y ahí la suite deja de significar algo.
//
// El costo es medible y chico: la suite completa tarda segundos. La alternativa
// —aislar por base de datos o por esquema— es infraestructura para un problema de
// escala que este proyecto no tiene (EJECUCION § 1).
const hijo = spawnSync(
  process.execPath,
  ['--env-file-if-exists=.env.local', '--test', '--test-concurrency=1', ...objetivos],
  { cwd: RAIZ, stdio: 'inherit', env: entorno },
);

if (hijo.error) {
  console.error('pruebas.mjs: no se pudo lanzar el corredor:', hijo.error.message);
  process.exit(1);
}
// `status` es null si el proceso murió por señal: eso NO es un éxito.
process.exit(hijo.status ?? 1);
