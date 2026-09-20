// Quién cierra los dos overlays compartidos, y por qué no puede ser un módulo de pantalla. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTO IMPIDE NO SE VE, NO LANZA Y SÓLO SE ARREGLA RECARGANDO
//
// `#drawer` y `#recoModal` viven en `components/Overlays.jsx`, hermanos de las vistas y no hijos de
// ninguna. Los abrían cinco módulos —`creative.js`, `conversion.js`, `leads-portal.js`,
// `executive-panel.js` y `period-controls.js`— y hasta el 2026-09-19 los CERRABA uno solo:
// `creative.js` registraba los cinco oyentes al final de su propio módulo.
//
// Los dos primeros ya no existen: se fueron con sus pantallas, el 2026-09-19 y el 2026-09-20. **Y el
// cierre no se movió con ninguno de los dos**, que es exactamente lo que estas pruebas compran. Por
// eso ninguna nombra un módulo: barren `lib/aios/` entero, y siguen midiendo algo después de que su
// caso original desapareció.
//
// O sea que borrar la maqueta de Creative —que es exactamente lo que el plan de Creative dice que
// hay que hacer— dejaba a las OTRAS CUATRO pantallas con un modal que se abre sobre toda la
// aplicación y no se puede cerrar: sin botón, sin velo y sin `Escape`. Sólo recargando.
//
// **Y no hay ninguna llamada que falle**, así que no aparece nada en consola: simplemente no hay
// nadie escuchando. `executive-panel.js:64` lo deja más a la vista todavía, porque hace
// `getElementById('dwClose').click()` — depende del oyente que registraba otro módulo de otra
// pantalla.
//
// Acquisition no pasó por esto porque `acquisition.js` no era dueño de esos oyentes. Es la única
// diferencia entre las dos migraciones que podía romper pantallas ajenas.
//
// Las dos pruebas cubren las dos formas de que vuelva: que el armazón deje de registrarlos, y que
// alguien los devuelva a un módulo de pantalla «porque ahí ya estaban».
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const RAIZ = new URL('../../', import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, RAIZ), 'utf8');

/** Los cuatro disparadores de cierre de los dos overlays compartidos. */
const CIERRES = ['scrim', 'dwClose', 'recoScrim', 'recoClose'] as const;

test('el armazón registra los cuatro cierres y el Escape', () => {
  const shell = leer('lib/aios/shell.js');

  for (const id of CIERRES) {
    assert.match(
      shell,
      new RegExp(`getElementById\\('${id}'\\)\\??\\.addEventListener\\('click'`),
      `\`shell.js\` dejó de cerrar \`#${id}\`: los overlays quedan abiertos sin forma de cerrarlos`,
    );
  }

  // El Escape cierra los DOS, y es el único camino de teclado que tienen.
  assert.match(shell, /addEventListener\('keydown'/, 'el armazón no escucha el teclado');
  assert.match(shell, /cerrarElCajon\(\);\s*\n?\s*cerrarElModal\(\);/, 'el Escape no cierra los dos');
});

test('ningún módulo de PANTALLA registra el cierre de un overlay compartido', () => {
  /* La regla es de propiedad, no de estilo: los cinco módulos que los abren son de pantallas
     distintas, así que ninguno puede ser el dueño del cierre sin que borrarlo rompa a los otros
     cuatro. Abrirlos sí pueden — eso es suyo.
     *
     * Se mira el ARCHIVO y no el comportamiento porque el defecto no tiene comportamiento
     * observable desde una prueba: el síntoma es un oyente que no existe. */
  const dir = new URL('lib/aios/', RAIZ);
  const modulos = readdirSync(dir).filter((n) => n.endsWith('.js') && n !== 'shell.js');
  assert.ok(modulos.length >= 5, 'no se encontraron los módulos de pantalla');

  for (const nombre of modulos) {
    const fuente = leer(`lib/aios/${nombre}`);
    for (const id of CIERRES) {
      assert.doesNotMatch(
        fuente,
        new RegExp(`getElementById\\('${id}'\\)\\??\\.addEventListener`),
        `\`${nombre}\` volvió a registrar el cierre de \`#${id}\`. Los overlays son compartidos: ` +
          'el día que se borre ese módulo, las otras pantallas se quedan sin poder cerrarlos. ' +
          'El dueño es `lib/aios/shell.js`.',
      );
    }
  }
});

test('el que ABRE un overlay compartido lo cierra con el del armazón, no con un nombre propio', () => {
  /* ── LA TERCERA FORMA DE ROMPER ESTO, Y ES LA QUE ESTABA ROTA ──────────────
   *
   * Las dos pruebas de arriba cubren que el armazón registre los cierres y que ningún módulo de
   * pantalla se los apropie. Falta la tercera: que un módulo LLAME a un cierre que no existe.
   *
   * `lib/aios/conversion.js:618` hacía:
   *
   *     el.onclick = ()=>{ closeReco(); openStep(el.dataset.goto); };
   *
   * y `closeReco` **no estaba definida en ningún archivo de la aplicación** — sólo era una función
   * global del prototipo HTML, que no se carga. Los módulos de `lib/aios/` son `.js`, así que
   * `tsc --noEmit` no los mira, y ninguno tenía imports: nada lo detectaba.
   *
   * El síntoma no era una excepción visible sino una ausencia: clicar una de las tres filas del
   * plan de acción lanzaba `ReferenceError`, **el `openStep()` de al lado nunca se ejecutaba**, y
   * el modal se quedaba encima con su velo. Es el mismo modo de fallo que las otras dos pruebas
   * impiden, en la tercera dirección: allá faltaba el cierre, acá la llamada apuntaba a un nombre
   * fantasma.
   *
   * Medido el 2026-09-20 sobre los nueve módulos de `lib/aios/`: era el único caso. */
  const dir = new URL('lib/aios/', RAIZ);
  const modulos = readdirSync(dir).filter((n) => n.endsWith('.js'));

  /** Los nombres que el prototipo HTML usaba y que la aplicación NO define. */
  const DEL_PROTOTIPO = ['closeReco', 'closeDrawer', 'openReco', 'openDrawer'] as const;

  for (const nombre of modulos) {
    const fuente = leer(`lib/aios/${nombre}`);
    const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

    for (const fantasma of DEL_PROTOTIPO) {
      assert.doesNotMatch(
        sinComentarios,
        new RegExp(String.raw`(?<![\w.$])` + fantasma + String.raw`\s*\(`),
        `\`${nombre}\` llama a \`${fantasma}()\`, que es del prototipo HTML y no existe en la ` +
          'aplicación. Lanza `ReferenceError` y lo que venga después en ese manejador no corre. ' +
          'Los cierres se importan de `lib/aios/shell.js`: `cerrarElCajon` y `cerrarElModal`.',
      );
    }

    /* ── Y LA MISMA FORMA DE FALLO EN SU VERSIÓN CALLADA ───────────────────
     *
     * Esta mitad estaba clavada a `conversion.js`: comprobaba que ESE archivo importara
     * `cerrarElModal`. Al borrarse el módulo, la comprobación se quedó sin sujeto —y una prueba
     * que lee un archivo que no existe no falla por lo que medía, falla por `ENOENT`—. Así que se
     * generalizó a la regla que el caso particular ilustraba, y al generalizarla apareció un
     * segundo caso que estaba vivo.
     *
     * `executive-panel.js` hacía:
     *
     *     el.onclick = ()=>{ document.getElementById('dwClose').click(); ... };
     *
     * Sintetizar un clic sobre el botón de cierre depende de dos cosas de OTRO módulo: que el nodo
     * exista con ese id, y que `shell.js` ya le haya registrado su oyente. Si cualquiera de las
     * dos falla, `.click()` **no lanza nada**: no pasa nada y el cajón se queda abierto mientras
     * la vista salta por detrás. Es `closeReco()` en su forma silenciosa —allá el nombre no
     * existía y lanzaba `ReferenceError`; acá el nombre existe y no hace nada—.
     *
     * Medido el 2026-09-20 sobre los ocho módulos de `lib/aios/`: era el único que quedaba. */
    for (const id of CIERRES) {
      assert.doesNotMatch(
        sinComentarios,
        new RegExp(String.raw`getElementById\('${id}'\)\??\.click\(`),
        `\`${nombre}\` cierra un overlay sintetizando un clic sobre \`#${id}\`. Eso depende del ` +
          'nodo y del oyente de OTRO módulo, y cuando falla no lanza nada: el overlay se queda ' +
          'abierto en silencio. Los cierres se importan de `lib/aios/shell.js`: `cerrarElCajon` y ' +
          '`cerrarElModal`.',
      );
    }
  }

  /* Y el candado de la generalización: si algún día nadie importa ninguno de los dos cierres, estos
     dos barridos quedan vacíos y en verde sobre nada. Alguien tiene que seguir llamándolos. */
  const importadores = modulos.filter((n) =>
    /import \{[^}]*cerrarEl(Cajon|Modal)[^}]*\} from '\.\/shell'/.test(leer(`lib/aios/${n}`)),
  );
  assert.ok(
    importadores.length >= 1,
    'ningún módulo importa los cierres del armazón. O todos dejaron de cerrar overlays —y entonces ' +
      'estas comprobaciones ya no miden nada— o alguien volvió a cerrarlos por su cuenta.',
  );
});
