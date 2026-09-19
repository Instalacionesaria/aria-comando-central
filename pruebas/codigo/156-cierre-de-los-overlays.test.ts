// Quién cierra los dos overlays compartidos, y por qué no puede ser un módulo de pantalla. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTO IMPIDE NO SE VE, NO LANZA Y SÓLO SE ARREGLA RECARGANDO
//
// `#drawer` y `#recoModal` viven en `components/Overlays.jsx`, hermanos de las vistas y no hijos de
// ninguna. Cinco módulos los ABREN —`creative.js`, `conversion.js`, `leads-portal.js`,
// `executive-panel.js` y `period-controls.js`— y hasta el 2026-09-19 los CERRABA uno solo:
// `creative.js` registraba los cinco oyentes al final de su propio módulo.
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
