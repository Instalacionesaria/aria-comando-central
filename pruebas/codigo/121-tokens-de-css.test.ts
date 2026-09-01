// Ningún `var(--x)` apunta a un token que nadie define. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTE ARCHIVO EXISTE PARA IMPEDIR, Y QUE ESTUVO EN PANTALLA SEIS VECES
//
// Llegó como una queja de producto: *«en el auditor donde dice rojo tiene un color blanco»*. La
// causa era una letra: `app/auditoria.css` escribía `var(--danger)` y el token del rojo se llama
// `--crit`.
//
// **Y esto no falla en ninguna parte.** Una propiedad personalizada que no existe deja la
// declaración «inválida en tiempo de valor computado», que el navegador trata como `unset`:
//
//   · en `color`, que SE HEREDA        → toma el color del padre. Acá, el texto casi blanco.
//   · en `background`, que NO se hereda → `initial`, o sea TRANSPARENTE.
//   · en `font-family`                 → la tipografía de la interfaz, no la monoespaciada.
//
// O sea que el síntoma nunca es un error: es una pantalla que se ve mal y nadie sabe por qué. El
// barrido encontró SEIS tokens inexistentes, no uno:
//
//   `--danger`  (auditoria, fundaciones) · el chip «rojo» y el aviso de error, en blanco
//   `--mono`    (auditoria) ×3           · el fragmento de prompt sin monoespaciada
//   `--bg-input` (auditoria)             · el campo del prompt TRANSPARENTE
//   `--bg-hover` (auditoria) ×2          · el hover de la fila y el fondo del bloque de código
//   `--mof`, `--mof-dim` (aios)          · una etiqueta de embudo sin fondo
//
// Cinco de los seis estaban en la pantalla de la que llegó la queja, y explican casi todo lo que se
// veía «sin terminar». `app/fundaciones.css` ya tenía este defecto documentado para un séptimo
// —`--bg-card`— con las palabras justas: *«una propiedad personalizada que no existe no falla en
// ninguna parte»*. Estaba escrito y volvió a pasar, que es la definición de lo que hace falta una
// prueba en vez de un comentario.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';

/** Las hojas de estilo de la aplicación. Se leen TODAS, no una lista escrita a mano. */
function hojas(): readonly string[] {
  return readdirSync(join(RAIZ, 'app'))
    .filter((f) => f.endsWith('.css'))
    .sort();
}

/**
 * El contenido de una hoja **sin comentarios**.
 *
 * No es un detalle: los dos tokens que el barrido reportó de más estaban dentro de comentarios que
 * explicaban por qué NO se usan —uno de ellos dice literalmente *«ese token nunca existió»*—. Sin
 * quitarlos, esta prueba obligaría a no poder nombrar en un comentario el token que se quitó, que es
 * lo contrario de lo que este repositorio quiere de un comentario.
 */
function sinComentarios(archivo: string): string {
  return readFileSync(join(RAIZ, 'app', archivo), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Los tokens que `next/font` inyecta en tiempo de ejecución, leídos de `app/layout.js`.
 *
 * `--font-inter` y `--font-plex-mono` no se definen en ninguna hoja y **están bien**: los define el
 * cargador de fuentes con el `variable:` de cada `next/font`, y llegan como una clase en el `<html>`.
 *
 * Se DERIVAN del layout en vez de escribirse acá. Una lista a mano quedaría corta el día que se
 * agregue una tercera fuente, y el síntoma sería esta prueba en rojo por algo que está bien — que es
 * como una prueba se vuelve un obstáculo y termina desactivada.
 */
function tokensDeFuente(): ReadonlySet<string> {
  const layout = readFileSync(join(RAIZ, 'app/layout.js'), 'utf8');
  const hallados = [...layout.matchAll(/variable:\s*'(--[a-zA-Z0-9-]+)'/g)].map((m) => m[1]!);
  assert.ok(
    hallados.length > 0,
    'no se pudo leer ningún `variable:` de `app/layout.js`: si las fuentes se cargan de otra forma, ' +
      'esta prueba va a reportar sus tokens como inexistentes',
  );
  return new Set(hallados);
}

test('ningún `var(--x)` apunta a un token que nadie define', () => {
  const definidos = new Set<string>(tokensDeFuente());
  /** Dónde se referencia cada token, para que el mensaje diga qué archivo tocar. */
  const referencias = new Map<string, Set<string>>();

  for (const archivo of hojas()) {
    const css = sinComentarios(archivo);

    // Lo que la hoja DEFINE. Cualquier selector cuenta, no solo `:root`: los temas redefinen los
    // mismos tokens bajo `:root[data-tema]`, y un token que solo existe en un tema igual existe.
    for (const m of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) definidos.add(m[1]!);

    /* Lo que la hoja USA, y **solo sin respaldo**. `var(--x, algo)` es legítimo aunque `--x` no
       exista: para eso está el segundo argumento, y hay un caso real en `app/globals.css`
       (`font-family: var(--font-ui, system-ui, sans-serif)`). Marcarlo obligaría a quitar respaldos
       que están puestos a propósito. */
    for (const m of css.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*([,)])/g)) {
      if (m[2] === ',') continue;
      const token = m[1]!;
      if (!referencias.has(token)) referencias.set(token, new Set());
      referencias.get(token)!.add(archivo);
    }
  }

  // La medición se afirma también, o una expresión regular que dejara de encontrar nada pasaría en
  // verde con el archivo entero roto.
  assert.ok(definidos.size > 50, `solo se leyeron ${definidos.size} tokens definidos: el barrido falló`);
  assert.ok(referencias.size > 50, `solo se leyeron ${referencias.size} referencias: el barrido falló`);

  const huerfanos = [...referencias.keys()]
    .filter((t) => !definidos.has(t))
    .sort()
    .map((t) => `${t} (en ${[...referencias.get(t)!].sort().join(', ')})`);

  assert.deepEqual(
    huerfanos,
    [],
    'hay `var(--x)` apuntando a tokens que ninguna hoja define. NO falla en ninguna parte: la ' +
      'declaración queda inválida y el navegador la trata como `unset` — `color` hereda (sale casi ' +
      'blanco), `background` cae a transparente y `font-family` pierde la monoespaciada. ' +
      'Si el token es correcto y lo inyecta algo en ejecución, tiene que poder derivarse ' +
      '(ver `tokensDeFuente`), no agregarse a una lista de excepciones:\n  ' +
      huerfanos.join('\n  '),
  );
});

test('el rojo de la auditoría sale del token del rojo, y NO de uno inventado', () => {
  /* La queja concreta, convertida en prueba: *«donde dice rojo tiene un color blanco»*.
   *
   * Se afirma sobre el archivo de la pantalla y no solo por el barrido de arriba, porque son dos
   * cosas distintas: el barrido dice «este token no existe» y esto dice «este chip usa el token del
   * rojo». Un `color: var(--txt)` en el chip pasaría el barrido perfecto y seguiría en blanco. */
  const css = sinComentarios('auditoria.css');
  const i = css.indexOf('.aud-chip-rojo');
  assert.ok(i > 0, 'se fue la regla del chip rojo');
  const regla = css.slice(i, css.indexOf('}', i));

  /* ── EL PATRÓN ESTABA MAL Y UNA MUTACIÓN LO ENCONTRÓ ────────────────────
   *
   * Decía `/color:\s*var\(--crit\)/` a secas, y eso también encuentra `border-**color**:`. O sea
   * que la mutación que deja `border-color: var(--crit); color: var(--txt)` —el chip blanco con
   * borde rojo, **que es exactamente el síntoma que se reportó**— pasaba esta prueba en verde.
   *
   * Se ancla al principio de la propiedad: principio de la cadena, `;`, `{` o espacio antes. */
  assert.match(regla, /(?:^|[;{\s])color:\s*var\(--crit\)/, 'el chip «rojo» no usa el token del rojo para su LETRA');
  assert.match(regla, /border-color:\s*var\(--crit\)/, 'ni para su borde');

  /* Y las tres del semáforo salen de los TRES tokens, cada una del suyo. Con dos iguales, dos
     niveles se dibujan del mismo color y la tarjeta miente sin que nada falle. */
  const del = (clase: string) => {
    const k = css.indexOf(clase);
    assert.ok(k > 0, `se fue la regla ${clase}`);
    /* Anclado por lo mismo que arriba: sin el ancla, esto devuelve el token del BORDE —que
       aparece primero en las tres reglas— y los tres niveles pasan aunque la letra esté mal. */
    return /(?:^|[;{\s])color:\s*var\((--[a-z-]+)\)/.exec(css.slice(k, css.indexOf('}', k)))?.[1];
  };
  assert.deepEqual(
    [del('.aud-chip-verde'), del('.aud-chip-amarillo'), del('.aud-chip-rojo')],
    ['--ok', '--warn', '--crit'],
    'los tres niveles del semáforo no salen de tres tokens distintos',
  );
});
