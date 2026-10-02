// Los overlays compartidos de la maqueta se fueron, y no vuelven. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO VIGILABA, Y POR QUÉ CAMBIÓ DE PREGUNTA
//
// `#drawer` y `#recoModal` vivían en `components/Overlays.jsx`, hermanos de las vistas y no hijos de
// ninguna. Los abrían cinco módulos imperativos, y hasta el 2026-09-19 los CERRABA
// uno solo de ellos: borrar esa pantalla dejaba a las otras con un modal abierto sobre toda la
// aplicación, sin botón, sin velo y sin `Escape`, y sin un error en consola. Esta prueba exigía que el
// dueño del cierre fuera el armazón (`lib/aios/shell.js`) y que nadie llamara a un cierre fantasma
// del prototipo (`closeReco()`, que no existía, o un clic sintetizado sobre `#dwClose`).
//
// El 2026-10-01 se fue el último que los abría, la maqueta del Executive, y con ella los overlays
// (`docs/OTROS/nueva-estructura/04-EL-INICIO.md`, `NE-30`). Los cajones que quedan son de React y cada
// uno trae su velo y su `Escape`. La pregunta pasó a ser la inversa: **que esa capa no vuelva**, ni
// el archivo, ni sus ids, ni un cierre que escuche a la nada.
//
// Se miran IDS y no clases: `.scrim` y `.drawer` siguen vivas en los cajones de React
// (`components/Ventana.jsx`, `negocio/Ficha.jsx`, `leads-portal/FichaDelLead.jsx`,
// `creative/FichaDelCreativo.jsx`).
//
// Las mutaciones que la ponen en rojo: devolver `components/Overlays.jsx`; dejar en `shell.js` un
// `getElementById('scrim')?.addEventListener(…)`, con comillas simples o dobles, o un
// `querySelector('#drawer')`; pegar `<aside id="drawer">` o `id={'drawer'}` en un componente;
// devolver un módulo a `lib/aios/`; y escribir `closeDrawer()` en `shell.js`.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, archivosFuente } from '../apoyo/fuente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/** Los ids de los overlays de la maqueta y de sus disparadores. */
const IDS = ['drawer', 'recoModal', 'scrim', 'recoScrim', 'dwClose', 'recoClose', 'dwBody', 'lgPanel', 'lgScrim', 'askPanel', 'askScrim', 'askTrigger'];

test('los overlays compartidos de la maqueta no vuelven', () => {
  assert.equal(existsSync(join(RAIZ, 'components/Overlays.jsx')), false, 'volvió `components/Overlays.jsx`');
  const ids = IDS.join('|');
  const quedan = archivosFuente(['app', 'components', 'lib'])
    .filter((a) => /\.(jsx?|tsx?)$/.test(a.ruta))
    .filter((a) =>
      new RegExp(
        `\\bid=\\{?['"\`](${ids})['"\`]\\}?|getElementById\\(\\s*['"\`](${ids})['"\`]|querySelector(All)?\\(\\s*['"\`]#(${ids})\\b`,
      ).test(sinComentarios(a.contenido)),
    )
    .map((a) => a.ruta);
  assert.deepEqual(quedan, [], 'estos archivos vuelven a declarar o a escuchar un overlay de la maqueta');

  // Y el armazón no conserva cierres que escuchan a la nada.
  assert.doesNotMatch(sinComentarios(leer('lib/aios/shell.js')), /cerrarEl(Cajon|Modal)\b/, '`shell.js` volvió a tener los cierres de los overlays');
});

test('en `lib/aios/` sólo quedan el arranque y el armazón', () => {
  /* Reemplaza al «hay al menos cinco módulos de pantalla» de antes, y cumple la misma función: el
     barrido de abajo no puede quedar vacío, porque estos dos archivos siempre están. Un módulo de
     pantalla nuevo en la capa imperativa es justamente lo que no tiene que volver. */
  assert.deepEqual(readdirSync(join(RAIZ, 'lib/aios')).sort(), ['index.js', 'shell.js']);
});

test('nadie llama a un cierre fantasma del prototipo', () => {
  /* La tercera forma del defecto, la callada: un módulo que llama a `closeReco()` —del prototipo HTML,
     que no se carga— lanza `ReferenceError` y lo que sigue en el manejador no corre; uno que sintetiza
     un clic sobre `#dwClose` depende del nodo y del oyente de otro, y cuando falta no hace nada. Pasó
     las dos veces (`conversion.js` y `executive-panel.js`, medido el 2026-09-20). */
  const DEL_PROTOTIPO = ['closeReco', 'closeDrawer', 'openReco', 'openDrawer'];
  for (const nombre of readdirSync(join(RAIZ, 'lib/aios')).filter((n) => n.endsWith('.js'))) {
    const fuente = sinComentarios(leer(`lib/aios/${nombre}`));
    for (const fantasma of DEL_PROTOTIPO) {
      assert.doesNotMatch(fuente, new RegExp(String.raw`(?<![\w.$])` + fantasma + String.raw`\s*\(`), `\`${nombre}\` llama a \`${fantasma}()\`, que no existe en la aplicación`);
    }
    assert.doesNotMatch(fuente, /getElementById\('[^']+'\)\??\.click\(/, `\`${nombre}\` cierra o abre algo sintetizando un clic: depende del nodo y del oyente de otro`);
  }
});
