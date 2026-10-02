// La maqueta de Leads Portal se fue, y lo que la reemplaza no la trae de vuelta. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA
//
// `lib/aios/leads-portal.js` dibujaba quince personas inventadas, con teléfono, correo y ventas
// —dos atribuidas al nombre de un closer real—, y publicaba `window.AIOSLeadCard`, que abría una
// ficha por NOMBRE y, si no la encontraba, rellenaba con la de otra persona. Se borró el 2026-09-26.
//
// Borrar un módulo es fácil de deshacer sin darse cuenta: una rama vieja, un «restaurar» del
// editor, un botón que alguien vuelve a pegar desde el prototipo. Esta prueba dice qué se fue y por
// qué, y se pone roja si vuelve cualquier pieza.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, archivosFuente } from '../apoyo/fuente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const VISTA = 'components/views/ContactsView.jsx';
const PANEL = 'components/leads-portal/PanelDeLeadsPortal.jsx';
const FICHA = 'components/leads-portal/FichaDelLead.jsx';

test('el módulo de la maqueta ya no existe, y el arranque no lo carga', () => {
  assert.equal(existsSync(join(RAIZ, 'lib/aios/leads-portal.js')), false, 'volvió `lib/aios/leads-portal.js`');
  const arranque = sinComentarios(leer('lib/aios/index.js'));
  assert.doesNotMatch(arranque, /initLeadsPortal\b/, 'el arranque volvió a cargar la maqueta de Leads Portal');
  assert.doesNotMatch(arranque, /leads-portal/, 'el arranque importa algo de la maqueta');
});

test('nadie define ni llama `window.AIOSLeadCard`: la ficha se abre por id, nunca por nombre', () => {
  /* La puerta global buscaba por el nombre visible y, sin coincidencia, copiaba la ficha del primer
     contacto con otro nombre: el teléfono y el recorrido de una persona bajo el nombre de otra. */
  const hallados = archivosFuente(['components', 'lib'])
    .filter((a) => /AIOSLeadCard/.test(a.limpio))
    .map((a) => a.ruta);
  assert.deepEqual(hallados, [], 'volvió la puerta global que abría la ficha por nombre');
});

test('la vista no trae el Plan de acción, la píldora del calendario ni `data-leads`', () => {
  const vista = sinComentarios(leer(VISTA)) + sinComentarios(leer(PANEL));
  for (const [pieza, motivo] of [
    ['lpPlanBtn', 'el «Plan de acción» eran cuatro frases escritas a mano, ninguna sostenible'],
    ['data-datepick', 'la píldora «Personalizado» abría un calendario que no filtraba nada'],
    ['data-leads', 'las tarjetas abrían el cajón con otra lista inventada; la lista está en la pantalla'],
    ['data-p="mes"', 'el tercer botón mandaba una clave de período que no existe'],
  ] as const) {
    assert.ok(!vista.includes(pieza), `volvió \`${pieza}\`: ${motivo}`);
  }
  /* Y su manejador, que vivía en `lib/aios/period-controls.js`: ese módulo se fue con la maqueta del
     Executive (2026-10-01), así que se busca en todo el código y no en un archivo. */
  const conPlan = archivosFuente(['components', 'lib']).filter((a) => /lpPlanBtn/.test(sinComentarios(a.contenido))).map((a) => a.ruta);
  assert.deepEqual(conPlan, [], 'volvió el manejador del Plan de acción de Leads Portal');
});

test('el cajón «Grupo de contactos» se fue con la maqueta del Executive, y no vuelve', () => {
  /* Hasta el 2026-10-01 se exigía que el cajón no abriera fichas ni buscara el segmentado de la maqueta
     de Leads Portal, y que siguiera publicándose: era de Executive y su texto se comparaba con el
     prototipo. Lo abría sólo el embudo de la maqueta del Executive, y se fue con ella (`NE-30`). */
  assert.equal(existsSync(join(RAIZ, 'lib/aios/leads-group.js')), false, 'volvió `lib/aios/leads-group.js`');
  const conCajon = archivosFuente(['components', 'lib'])
    /* Con el `sinComentarios` de este archivo y no con `limpio`, que corta cada línea desde `--`. */
    .filter((a) => /window\.AIOSLeads\b|id="lgPanel"/.test(sinComentarios(a.contenido)))
    .map((a) => a.ruta);
  assert.deepEqual(conCajon, [], 'volvió el cajón «Grupo de contactos»');
});

test('el panel y la ficha no traen montos ni fechas escritos a mano', () => {
  /* Un monto con dígitos en el JSX es una afirmación sobre el dinero de alguien. Las cifras llegan
     del servidor; lo único que el panel escribe es el signo delante. */
  for (const archivo of [VISTA, PANEL, FICHA]) {
    const fuente = sinComentarios(leer(archivo));
    assert.deepEqual(fuente.match(/\$\s?\d[\d.,]{2,}/g) ?? [], [], `${archivo} trae un monto escrito a mano`);
    assert.deepEqual(fuente.match(/hace \d+ (h|día|días)\b/g) ?? [], [], `${archivo} trae un «hace N» inventado`);
  }
});

test('la ruta de la ficha sólo lee: no importa la sincronización ni cruza a las credenciales', () => {
  /* La ficha del closer refresca contra el CRM al abrirse; ésta no. Si importara la sincronización,
     abrir una ficha gastaría presupuesto del proveedor y podría mover el territorio de alguien. */
  for (const archivo of ['app/api/leads-portal/[id]/route.ts', 'lib/negocio/fichaDelLeadDelPortal.ts']) {
    const fuente = sinComentarios(leer(archivo));
    assert.doesNotMatch(fuente, /sincronizar(\.ts)?['"]/, `${archivo} importa la sincronización`);
    assert.doesNotMatch(fuente, /refrescarUnContacto/, `${archivo} refresca el contacto contra el CRM`);
    assert.doesNotMatch(fuente, /credenciales\//, `${archivo} cruza al dominio de las credenciales`);
  }
});

test('la vista monta el panel y la ficha tiene su propio cajón, no `#drawer`', () => {
  assert.match(leer(VISTA), /<PanelDeLeadsPortal \/>/, 'la vista no monta el panel');
  const ficha = sinComentarios(leer(FICHA));
  assert.match(ficha, /id="lpFicha"/, 'la ficha perdió su cajón propio');
  assert.doesNotMatch(ficha, /getElementById\('drawer'\)|id="drawer"|dwBody/, 'la ficha volvió a escribir en el `#drawer` de la maqueta');
});
