// Geist es la letra de la aplicación, y ninguna hoja la esquiva. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// TRES FORMAS DE VER OTRA LETRA SIN QUE NADA FALLE (docs/OTROS/nueva-estructura/03-LA-MARCA.md, NE-24)
//
// Antes de la nueva estructura la aplicación tenía tres letras a la vez, y ninguna era un error:
//
//   · **el orden de la pila**: `--font-ui` ponía `-apple-system` antes de Inter, copiado del <link>
//     del prototipo. En una Mac se veía San Francisco y en Windows Inter: la misma pantalla con dos
//     letras según la máquina de quien la mira;
//   · **una pila propia**: las doce pantallas de operación declaraban su `font-family` del sistema en
//     `app/operacion-estetica.css`, así que se veían con otra letra que el resto;
//   · **un token que no existe**: Incidentes escribía `var(--mono, ui-monospace, monospace)`. `--mono`
//     no existe, el respaldo lo tapaba y se veía la monoespaciada del sistema. La `121` no lo puede
//     ver, porque un `var()` con respaldo es legítimo.
//
// Las mutaciones que la ponen en rojo: devolver la pila del sistema a `operacion-estetica.css`;
// volver a `var(--mono, …)` en Incidentes; poner `-apple-system` antes de Geist en `--font-ui`; y
// volver a cargar Geist con el paquete `geist`.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { RAIZ, archivosFuente } from '../apoyo/fuente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const sinComentariosCss = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, ' ');
/* Propio y no el `sinComentarios` de `apoyo/fuente.ts`: aquél borra desde `--` hasta el final de la
   línea, por los comentarios de SQL, y se comería `'--font-geist-sans'`, que es justo lo que se mira. */
const sinComentariosJs = (t: string): string =>
  t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

test('el layout carga Geist y Geist Mono con el cargador de Next, cada una con su variable', () => {
  const layout = sinComentariosJs(leer('app/layout.js'));
  assert.match(layout, /import\s*\{\s*Geist\s*,\s*Geist_Mono\s*\}\s*from\s*'next\/font\/google'/);
  assert.match(layout, /Geist\(\{[^}]*variable:\s*'--font-geist-sans'/, 'Geist no declara `--font-geist-sans`');
  assert.match(layout, /Geist_Mono\(\{[^}]*variable:\s*'--font-geist-mono'/, 'Geist Mono no declara `--font-geist-mono`');
  assert.match(layout, /className=\{`\$\{geist\.variable\} \$\{geistMono\.variable\}`\}/, 'el `<html>` no lleva las dos variables');
  /* Sin el paquete: sus variables no pasan por un `variable:` de este archivo, y la `121` no las
     podría dar por definidas. Y sin las letras de antes, que serían 200 KB que nadie usa. */
  assert.doesNotMatch(layout, /geist\/font|\bInter\b|IBM_Plex/, 'vuelven el paquete `geist` o las letras de antes');
  const paquete = JSON.parse(leer('package.json')) as Record<string, Record<string, string> | undefined>;
  assert.ok(!paquete.dependencies?.geist && !paquete.devDependencies?.geist, '`geist` volvió a `package.json`');
});

test('la primera familia es Geist, y las del sistema quedan de respaldo', () => {
  const globals = sinComentariosCss(leer('app/globals.css'));
  // Sin capa: si estas dos líneas quedaran dentro de un `@layer`, la definición de `aios.css` —la
  // pila del prototipo, en la capa `aios`— podría ganarles según el orden. Otros bloques de capa sí
  // pueden existir (el de las filas-botón del menú, en `base`, desde la etapa E9 de la nueva
  // estructura): lo que no puede es que uno de ellos contenga estas definiciones.
  const bloquesDeCapa = [...globals.matchAll(/@layer\s+[\w-]+\s*\{/g)].map((m) => {
    let nivel = 0;
    for (let j = m.index! + m[0].length - 1; j < globals.length; j += 1) {
      if (globals[j] === '{') nivel += 1;
      else if (globals[j] === '}' && --nivel === 0) return globals.slice(m.index!, j + 1);
    }
    return globals.slice(m.index!);
  });
  for (const bloque of bloquesDeCapa) {
    assert.doesNotMatch(bloque, /--font-(ui|mono):\s*var\(--font-geist/, '`app/globals.css` define la letra dentro de un bloque `@layer`: revisá quién gana');
  }
  assert.match(globals, /--font-ui:\s*var\(--font-geist-sans\)\s*,/, '`--font-ui` no empieza por Geist');
  assert.match(globals, /--font-mono:\s*var\(--font-geist-mono\)\s*,/, '`--font-mono` no empieza por Geist Mono');
});

test('toda hoja dibuja con una variable de letra, nunca con una pila propia', () => {
  const hojas = readdirSync(join(RAIZ, 'app'), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.css'))
    .map((e) => relative(RAIZ, join(e.parentPath, e.name)).split(sep).join('/'));
  const vistas: string[] = [];
  const propias: string[] = [];
  for (const hoja of hojas) {
    for (const m of sinComentariosCss(leer(hoja)).matchAll(/(?:^|[;{\s])font-family:\s*([^;}]+)/g)) {
      const valor = m[1]!.trim();
      vistas.push(valor);
      /* `var(--font-…)` es la letra de la aplicación o la de la marca dentro de `/brand`; `inherit` la
         toma del padre. Un respaldo dentro del `var()` está bien —la guarda de sesión lo usa—, pero
         el token tiene que ser uno de letra: así se ve `var(--mono, …)`, que la `121` deja pasar. */
      if (!/^(inherit|var\(--font-[\w-]+\s*[,)])/.test(valor)) propias.push(`${hoja}: ${valor}`);
    }
  }
  // La lectura se afirma también: un patrón que no encontrara nada pasaría en verde.
  assert.ok(vistas.length > 30, `sólo se leyeron ${vistas.length} declaraciones de \`font-family\``);
  assert.deepEqual(propias, [], 'estas hojas eligen su propia letra en vez de la de la aplicación');
});

test('ningún componente escribe una letra en línea', () => {
  // La misma regla en el JSX: `style={{ fontFamily: '…' }}` con una familia escrita a mano. El valor
  // se lee hasta la próxima coma o llave FUERA de una cadena, porque una pila trae comas adentro.
  const leidos = archivosFuente(['app', 'components', 'lib'])
    .filter((a) => /\.(jsx|tsx)$/.test(a.ruta))
    .flatMap((a) =>
      [...sinComentariosJs(a.contenido).matchAll(/fontFamily:((?:'[^'\n]*'|"[^"\n]*"|`[^`\n]*`|[^,}\n'"`])+)/g)]
        .map((m) => ({ ruta: a.ruta, valor: m[1]!.trim() })),
    );
  // La de `/brand` existe y es legítima: si la lectura no la encuentra, no está mirando nada.
  assert.ok(leidos.some((l) => l.ruta === 'app/brand/page.tsx'), 'no se leyó el `fontFamily` de `/brand`: la lectura falló');
  const enLinea = leidos
    .filter(({ valor }) => {
      /* Lo que se COMPARA no es una letra: `/brand` elige con `g.family === 'mono' ? … : …`, y
         `'mono'` es el operando. Se quita antes de mirar las cadenas que quedan. */
      const sinComparar = valor
        .replace(/[!=]==?\s*('[^']*'|"[^"]*")/g, ' ')
        .replace(/('[^']*'|"[^"]*")\s*[!=]==?/g, ' ');
      return [...sinComparar.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)]
        .some((s) => !(s[1] ?? s[2] ?? s[3] ?? '').startsWith('var(--font-'));
    })
    .map(({ ruta, valor }) => `${ruta}: fontFamily: ${valor}`);
  assert.deepEqual(enLinea, [], 'estos componentes eligen su propia letra en línea');
});
