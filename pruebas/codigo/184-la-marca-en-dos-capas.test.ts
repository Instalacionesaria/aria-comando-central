// La marca v2 vive en dos capas, y la de la marca nunca le gana a la aplicación. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/OTROS/nueva-estructura/03-LA-MARCA.md, NE-22)
//
// El PR #2 instaló la marca sin cambiar un píxel; que la app siga mandando depende de dos cosas:
//
//   · **el orden de las capas**: `public/brand/tokens.css` declara en `:root` seis nombres que la
//     aplicación también usa —desde la marca v2, algunos con el mismo valor— (`--bg`, `--line`, `--line-strong`, `--accent`, `--font-sans`
//     y `--font-mono`). Va en la capa `marca`, la más baja, para que `aios.css` y `temas.css` le ganen
//     siempre; y el scope `[data-marca="v2"]` va en `marca-scope`, después de `components`, para que
//     dentro de /brand gane él. Con el orden cambiado, la aplicación entera se repinta a medias —
//     unas variables de la marca, otras de la app— y no hay error que lo avise;
//   · **el archivo generado**: `app/brand/tokens-scope.css` sale de `brand/tokens.json` con
//     `node scripts/marca.mjs`. Una edición a mano, o un `tokens.json` exportado sin volver a correr
//     el guion, deja dos copias del mismo valor que dicen cosas distintas.
//
// Las mutaciones que la ponen en rojo: invertir `marca` y `aios`, o `components` y `marca-scope`, en el
// `@layer` de `app/globals.css`; importar `tokens.css` en otra capa; y editar a mano un valor de
// `app/brand/tokens-scope.css`.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, ' ');

test('el orden de las capas deja a la marca debajo de la app, y su scope encima', () => {
  const globals = sinComentarios(leer('app/globals.css'));
  // La PRIMERA declaración de `@layer` es la que fija el orden; las demás sólo agregan reglas.
  const m = /@layer\s+([^;{]+);/.exec(globals);
  assert.ok(m, 'app/globals.css no declara el orden de las capas');
  const capas = m[1]!.split(',').map((c) => c.trim());
  const pos = (c: string) => {
    const i = capas.indexOf(c);
    assert.notEqual(i, -1, `falta la capa \`${c}\` en ${capas.join(', ')}`);
    return i;
  };
  assert.ok(pos('marca') < pos('aios'), 'la marca le ganaría a `aios.css`: la app se repinta a medias');
  assert.ok(pos('marca') < pos('components'), 'la marca le ganaría a `temas.css`');
  assert.ok(pos('components') < pos('marca-scope'), 'el scope de /brand perdería contra `temas.css` dentro de /brand');
});

test('cada hoja de la marca entra en su capa', () => {
  const globals = sinComentarios(leer('app/globals.css'));
  assert.match(globals, /@import\s+"\.\.\/public\/brand\/tokens\.css"\s+layer\(marca\);/, '`tokens.css` no entra en la capa `marca`');
  assert.match(globals, /@import\s+"\.\/brand\/tokens-scope\.css"\s+layer\(marca-scope\);/, '`tokens-scope.css` no entra en la capa `marca-scope`');
});

test('`app/brand/tokens-scope.css` es exactamente lo que genera `brand/tokens.json`', () => {
  const r = spawnSync(process.execPath, [join(RAIZ, 'scripts/marca.mjs'), '--comprobar'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stderr || r.stdout}`.trim());
});
