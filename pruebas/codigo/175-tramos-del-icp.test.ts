// Los tramos del puntaje ICP de Leads Portal: dónde se corta, cómo se llama, y que no arrastre nada.
// Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA
//
// Un corte mal puesto no falla: el 75 cae en «ICP medio», la tarjeta de arriba pierde una persona y
// la de al lado gana una, y las dos cifras se ven razonables. Por eso se prueban los bordes uno por
// uno —0, 1, 49, 50, 74, 75 y 100, los de LP14-05— y el reparto entero de 0 a 100.
//
// Y el cero: el usuario decidió el 2026-09-26 que un 0 del CRM es «Sin calificar», igual que el nulo,
// pero sin borrar la diferencia. Las dos cosas se prueban por separado, porque la mutación natural
// —quitar el `=== 0`— manda los 47 ceros al tramo bajo y no rompe nada más.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import {
  TRAMOS,
  UMBRAL_ALTO,
  UMBRAL_MEDIO,
  motivoSinCalificar,
  rotuloDelTramo,
  tramoDelPuntaje,
} from '../../lib/negocio/tramosDelIcp.ts';
import { ETIQUETAS_DE_DESCARTE } from '../../lib/ghl/contrato.ts';

const MODULO = 'lib/negocio/tramosDelIcp.ts';

test('los bordes del corte caen donde se decidió: 75 y 50 inclusive, el 0 y el nulo afuera', () => {
  /* Comparado como un mapa entero y no borde por borde: así el mensaje de un fallo muestra todos los
     bordes a la vez, y se ve si el corrimiento es de uno o de toda la escala. */
  const bordes = [null, undefined, 0, 1, 49, 50, 74, 75, 100];
  assert.deepEqual(
    Object.fromEntries(bordes.map((s) => [String(s), tramoDelPuntaje(s)])),
    {
      null: 'sin_calificar',
      undefined: 'sin_calificar',
      0: 'sin_calificar',
      1: 'bajo',
      49: 'bajo',
      50: 'medio',
      74: 'medio',
      75: 'alto',
      100: 'alto',
    },
  );
  assert.equal(UMBRAL_ALTO, 75, 'el corte alto es el de la maqueta, decidido el 2026-09-26');
  assert.equal(UMBRAL_MEDIO, 50, 'el corte medio es el de la maqueta, decidido el 2026-09-26');
});

test('de 0 a 100 cada puntaje cae en un solo tramo, y el reparto es el del corte', () => {
  /* El reparto de la escala entera atrapa lo que los bordes no: un tercer corte colado en el medio,
     o un tramo que se quedó sin ningún puntaje. 1 + 49 + 25 + 26 = 101. */
  const cuenta: Record<string, number> = {};
  for (let s = 0; s <= 100; s++) {
    const t = tramoDelPuntaje(s);
    cuenta[t] = (cuenta[t] ?? 0) + 1;
  }
  assert.deepEqual(cuenta, { sin_calificar: 1, bajo: 49, medio: 25, alto: 26 });
});

test('el motivo de «Sin calificar» separa el nulo del cero, y sólo existe dentro del tramo', () => {
  assert.equal(motivoSinCalificar(null), 'sin_puntaje');
  assert.equal(motivoSinCalificar(undefined), 'sin_puntaje');
  assert.equal(
    motivoSinCalificar(0),
    'en_cero',
    'el 0 cuenta como sin calificar, pero sigue siendo un 0: la tarjeta muestra «en 0» aparte',
  );
  /* Y la coherencia con el tramo, en toda la escala: un motivo fuera de «Sin calificar», o un «Sin
     calificar» sin motivo, haría que el pie de la tarjeta no sumara su cifra. */
  for (const s of [null, ...Array.from({ length: 101 }, (_, i) => i)]) {
    assert.equal(
      motivoSinCalificar(s) !== null,
      tramoDelPuntaje(s) === 'sin_calificar',
      `el puntaje ${s} tiene motivo y tramo que no coinciden`,
    );
  }
});

test('los tramos se dibujan en el orden fijo de la maqueta, con los rótulos decididos', () => {
  /* El orden no es por volumen: ordenar por volumen haría que la pantalla cambiara de forma cada
     semana. Y los rótulos son los del 2026-09-26, no los de la maqueta. */
  assert.deepEqual(
    TRAMOS.map((t) => [t.clave, t.rotulo]),
    [
      ['sin_calificar', 'Sin calificar'],
      ['alto', 'ICP alto'],
      ['medio', 'ICP medio'],
      ['bajo', 'ICP bajo'],
    ],
  );
  assert.equal(rotuloDelTramo('medio'), 'ICP medio');
});

test('ningún rótulo es una etiqueta de descarte del CRM', () => {
  /* La maqueta rotulaba el tramo bajo «No calificado», que es literalmente una de las etiquetas con
     que la casa DESCARTA un contacto: la tarjeta diría que 158 personas fueron descartadas, y 113 de
     ellas ni siquiera llevan `icp_rechazado` (medido el 2026-09-27). */
  const descarte = new Set(ETIQUETAS_DE_DESCARTE.map((e) => e.toLowerCase()));
  assert.deepEqual(
    TRAMOS.filter((t) => descarte.has(t.rotulo.toLowerCase())).map((t) => t.rotulo),
    [],
  );
});

test('el módulo de los tramos no importa nada', () => {
  /* Lo usan el servidor y el navegador. Lo que importe viaja al paquete del cliente, y si llega a la
     capa de datos arrastra el cliente de PostgreSQL: `next build` ya lo rechazó una vez, con
     `DIAS_DE_TODO` en `periodo.ts`. */
  const ts = readFileSync(join(RAIZ, MODULO), 'utf8');
  /* Los dos caminos: `import …` y el reexporte `export … from …`, que también arrastra el módulo. */
  const imports = [...ts.matchAll(/^\s*import\s[^;]+;|^\s*export\s[^;]*\sfrom\s[^;]+;/gm)].map(
    (m) => m[0],
  );
  assert.deepEqual(imports, [], 'los tramos importan algo: lo que arrastren va al navegador');
});
