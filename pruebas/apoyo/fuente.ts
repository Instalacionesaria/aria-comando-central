// Lectura del código fuente para las pruebas de tipo "Código".
//
// El 04 § 7 lo dice en una línea: "Quitá los comentarios antes de buscar en el
// código fuente, o un comentario que mencione la escotilla hace fallar la prueba."
//
// Y no es teórico. La prueba arquitectónica del sistema de referencia se comió su
// propio anzuelo: la comprobación daba verde POR UN COMENTARIO. Por eso acá se
// quitan comentarios, y por eso `pruebas/` está excluido por omisión — este mismo
// archivo nombra las cadenas que busca.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

/** Los directorios que contienen código del proyecto. `pruebas/` NO está. */
export const DIRS_FUENTE = ['app', 'components', 'lib', 'db', 'scripts'] as const;

const EXTENSIONES = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sql'];

// Nunca se entra acá, pase lo que pase. Sin este filtro, un `archivosFuente(['.'])`
// —fácil de escribir por accidente— se pone a leer `node_modules` archivo por archivo:
// medido, 127 segundos en una sola prueba. Una prueba lenta se termina salteando, así
// que el costo real no es el tiempo sino la suite que alguien deja de correr.
const NUNCA = new Set(['node_modules', '.next', '.git', 'graphify-out', 'dist']);

export interface Archivo {
  /** Ruta relativa a la raíz, siempre con `/` — en Windows y en Linux. */
  ruta: string;
  contenido: string;
  /** Sin comentarios y con los finales de línea normalizados. */
  limpio: string;
}

/**
 * Quita comentarios de línea y de bloque, y normaliza CRLF.
 *
 * No es un analizador: no distingue un `//` dentro de una cadena de texto. Para lo
 * que se usa —buscar la presencia de un identificador— errar del lado de quitar
 * demasiado produce un falso negativo visible, no un falso verde.
 */
export function sinComentarios(texto: string): string {
  return texto
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/(^|\s)\/\/.*$/, '$1').replace(/--.*$/, ''))
    .join('\n');
}

// El árbol se lee UNA vez por combinación de directorios.
//
// Sin esto, cada prueba de tipo Código relee y re-limpia todos los archivos del
// proyecto: medido, la suite pasó de 6 a 71 segundos al agregar las pruebas
// arquitectónicas de la Etapa 2. El contenido no cambia durante una corrida —los
// archivos son de entrada, no de salida— así que la caché no puede quedar vieja.
//
// Y el motivo por el que vale arreglarlo en vez de aceptarlo: una suite lenta se termina
// salteando, y una suite que nadie corre es exactamente lo que estas pruebas existen
// para evitar.
const cache = new Map<string, Archivo[]>();

export function archivosFuente(dirs: readonly string[] = DIRS_FUENTE): Archivo[] {
  const clave = [...dirs].sort().join('|');
  const enCache = cache.get(clave);
  if (enCache) return enCache;

  const salida: Archivo[] = [];
  for (const dir of dirs) {
    const abs = join(RAIZ, dir);
    if (!existsSync(abs)) continue;
    for (const e of readdirSync(abs, { recursive: true, withFileTypes: true })) {
      if (!e.isFile()) continue;
      if (!EXTENSIONES.some((x) => e.name.endsWith(x))) continue;
      const rutaAbs = join(e.parentPath, e.name);
      if (relative(RAIZ, rutaAbs).split(sep).some((seg) => NUNCA.has(seg))) continue;
      const contenido = readFileSync(rutaAbs, 'utf8');
      salida.push({
        // Normalizar el separador es obligatorio: una lista blanca escrita con `/`
        // coincide en Linux y falla en Windows si no se normaliza.
        ruta: relative(RAIZ, rutaAbs).split(sep).join('/'),
        contenido,
        limpio: sinComentarios(contenido),
      });
    }
  }
  salida.sort((a, b) => a.ruta.localeCompare(b.ruta));
  cache.set(clave, salida);
  return salida;
}

/** Los archivos cuyo contenido SIN COMENTARIOS coincide con el patrón. */
export function archivosQueContienen(patron: RegExp, dirs?: readonly string[]): string[] {
  return archivosFuente(dirs)
    .filter((a) => patron.test(a.limpio))
    .map((a) => a.ruta);
}
