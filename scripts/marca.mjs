/* Genera `app/brand/tokens-scope.css` desde `brand/tokens.json`.
 *
 * ── POR QUÉ EXISTE ESTE GUION ─────────────────────────────────────────────
 *
 * `public/brand/tokens.css` declara sus tokens en `:root`, y SEIS de sus nombres ya existen en
 * esta aplicación con otro valor y otro significado: `--bg`, `--line`, `--line-strong`,
 * `--accent`, `--font-sans` y `--font-mono`. Importarlo sin más no agrega tokens: repinta la
 * aplicación entera a medias, porque `:root[data-tema='oscuro']` de `temas.css` le gana por
 * especificidad a unos y no a otros. Un repintado parcial es peor que uno completo: nadie puede
 * predecir qué pantalla quedó mitad y mitad.
 *
 * La Etapa de marca decidió NO migrar todavía (una pantalla por vez, más adelante). Entonces los
 * valores de marca tienen que poder verse en algún lado sin tocar la aplicación, y ese lado es
 * `/brand` con `data-marca="v2"`.
 *
 * ── POR QUÉ SE GENERA Y NO SE ESCRIBE A MANO ──────────────────────────────
 *
 * `BRAND.md` dice que `tokens.css` es generado y no se edita a mano, y que `tokens.json` es la
 * fuente para herramientas. Copiar los hex a mano a un archivo con scope crearía una SEGUNDA
 * copia de cada valor, que se desincroniza en el próximo export del brandbook sin que nada avise.
 * Acá la única fuente sigue siendo `tokens.json`.
 *
 * Correr: `node scripts/marca.mjs`
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const tokens = JSON.parse(readFileSync(join(RAIZ, 'brand/tokens.json'), 'utf8'));

const SCOPE = '[data-marca="v2"]';

function bloque(selector, pares) {
  const cuerpo = pares.map(([n, v]) => `  --${n}: ${v};`).join('\n');
  return `${selector} {\n${cuerpo}\n}`;
}

/* Color: un par por tema. El oscuro va en el scope base porque ARIA vive en oscuro.
 *
 * OJO con la forma de `value`: la mayoría son `{dark, light}`, pero los cinco `lesson-*` son una
 * CADENA suelta, porque valen lo mismo en los dos temas (son los colores de documento impreso).
 * Leer `.dark` sobre una cadena da `undefined` y emite `--lesson-paper: undefined`, que el
 * navegador descarta en silencio: la variable queda sin definir y lo que la use cae al respaldo
 * sin que nada avise. */
const porTema = (valor, tema) => (typeof valor === 'string' ? valor : valor[tema]);
const colorOscuro = tokens.color.tokens.map((t) => [t.name, porTema(t.value, 'dark')]);
const colorClaro = tokens.color.tokens
  .filter((t) => typeof t.value !== 'string')
  .map((t) => [t.name, porTema(t.value, 'light')]);

// Lo que no depende del tema.
const escalas = [
  ...tokens.spacing.tokens.map((t) => [t.name, t.value]),
  ...tokens.radius.tokens.map((t) => [t.name, t.value]),
  ...tokens.shadow.tokens.map((t) => [t.name, t.value]),
  ['font-sans', tokens.type.families.sans],
  ['font-mono', tokens.type.families.mono],
  ['font-lesson', tokens.type.families.lesson],
];

const salida = [
  `/* GENERADO por scripts/marca.mjs desde brand/tokens.json (v${tokens.version}). No editar a mano.`,
  ` * Cambia el brandbook, vuelve a exportar tokens.json y corre el guion. El porqué, en su encabezado. */`,
  '',
  bloque(SCOPE, [...colorOscuro, ...escalas]),
  '',
  `/* El tema claro del brandbook es para documentos, PDF e impresión. Se activa cuando el tema de la`,
  ` * aplicación es claro: \`app/tema.ts\` escribe \`data-theme\` en sincronía con \`data-tema\`. */`,
  bloque(`${SCOPE}:is([data-theme="light"], [data-theme="light"] *)`, colorClaro),
  '',
].join('\n');

mkdirSync(join(RAIZ, 'app/brand'), { recursive: true });
writeFileSync(join(RAIZ, 'app/brand/tokens-scope.css'), salida);
console.log(`app/brand/tokens-scope.css — ${colorOscuro.length} colores por tema, ${escalas.length} escalas`);
