// Una cifra que la pantalla DIBUJA no puede estar en su lista de «lo que falta». Tipo: Código.
//
// ══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTO IMPIDE, Y YA SE PAGÓ UNA VEZ
//
// `components/conversation/PanelDeConversation.jsx` tiene dos cosas que hablan del mismo tema y no
// se conocen entre sí: las tarjetas con las cifras, y el objeto `FLUJOS[x].falta`, que enumera en
// prosa lo que ese flujo todavía no puede medir.
//
// Cuando la migración `049` le dio a la cita su columna `asistio`, la tarjeta «Se presentaron»
// apareció — y el renglón que decía *«La asistencia: el CRM tiene los campos… y están casi
// vacíos»* **se quedó tres centímetros más abajo**. La pantalla mostraba un número y debajo
// afirmaba que ese número no se podía saber.
//
// Eso no es una imprecisión de redacción. Los otros tres renglones de esa lista SÍ son ciertos, y
// un cartel que se contradice con la pantalla enseña a no leer los carteles: se pierde la
// credibilidad de los tres que había que leer. Es el mismo argumento que la regla del silencio de
// `indicadoresDeCitas.ts` — *un aviso que siempre aparece es un aviso que nadie mira*.
//
// ── POR QUÉ ESTO ES UNA TABLA Y NO UNA BÚSQUEDA POR PALABRAS ────────────────
//
// La tentación es buscar la raíz de cada título de tarjeta dentro de los títulos de `falta`. No
// sirve, y el contraejemplo está en el archivo: la tarjeta dice «Reagendadas» y un renglón legítimo
// de `falta` se llama «El historial de reagendamientos». **Son dos cosas distintas** —la tasa
// contra la cadena de movimientos— y la prosa del renglón lo explica. Una prueba por raíces se
// pondría roja sobre un estado correcto, y una prueba que falla cuando todo está bien es una prueba
// que alguien apaga.
//
// Así que la relación se declara acá, a mano, un renglón por cifra publicada. El costo es real y es
// el punto: **agregar una cifra a la pantalla obliga a pasar por este archivo**, que es exactamente
// el momento en que hay que releer la lista de al lado.
// ══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente } from '../apoyo/fuente.ts';

const PANEL = 'components/conversation/PanelDeConversation.jsx';

/**
 * Lo que la pantalla ya mide, y la frase que por lo tanto NO puede encabezar un renglón de `falta`.
 *
 * `campo` es la propiedad que el componente lee del servidor: es la prueba de que la cifra existe
 * de verdad y no es un rótulo suelto. `prohibido` es el título exacto que quedaría mintiendo.
 */
const YA_SE_MIDE: readonly { cifra: string; campo: string; prohibido: string }[] = [
  {
    cifra: 'la asistencia a la cita',
    campo: 'tasaDeAsistencia',
    prohibido: 'La asistencia',
  },
  {
    cifra: 'la confirmación del agendamiento',
    campo: 'tasaDeConfirmacion',
    prohibido: 'La confirmación',
  },
  {
    cifra: 'la respuesta del contacto',
    campo: 'tasa',
    prohibido: 'La tasa de respuesta',
  },
];

/** Los títulos de `FLUJOS[*].falta`: el primer elemento de cada par `['Título', 'prosa…']`. */
function titulosDeLoQueFalta(limpio: string): string[] {
  const i = limpio.indexOf('const FLUJOS');
  assert.notEqual(i, -1, 'el panel dejó de declarar `FLUJOS`: si se renombró, renombralo acá');
  const j = limpio.indexOf('export default function', i);
  assert.notEqual(j, -1, 'no se encontró el final del bloque de `FLUJOS`');
  /* Cada renglón es `['Título', 'prosa'],`. Se toma sólo el PRIMER literal de cada par: la prosa
     puede nombrar cualquier cosa —de hecho debe— y lo que miente es el título. */
  return [...limpio.slice(i, j).matchAll(/\[\s*'([^']+)'\s*,/g)].map((m) => m[1] as string);
}

test('una cifra que la pantalla dibuja NO puede estar declarada como faltante', () => {
  const panel = archivosFuente(['components']).find((a) => a.ruta === PANEL);
  assert.ok(panel, `${PANEL} no existe: si se movió, hay que moverlo acá también`);

  const titulos = titulosDeLoQueFalta(panel.limpio);
  assert.ok(
    titulos.length > 0,
    'no se encontró ningún renglón de `falta`: la prueba dejó de poder leer el archivo, que es ' +
      'peor que no tenerla — pasaría siempre',
  );

  for (const { cifra, campo, prohibido } of YA_SE_MIDE) {
    /* Primero se comprueba que la cifra EXISTE. Sin esto, borrar la tarjeta de la pantalla haría
       pasar la prueba en vez de fallarla, y el renglón de `falta` volvería a ser correcto por un
       motivo que nadie decidió. */
    assert.ok(
      panel.limpio.includes(campo),
      `la pantalla dejó de leer «${campo}», o sea que ${cifra} ya no se dibuja. Si se quitó a ` +
        'propósito, hay que sacar su renglón de esta tabla Y volver a declararla como faltante',
    );

    const choca = titulos.find((t) => t.trim().toLowerCase() === prohibido.toLowerCase());
    assert.equal(
      choca,
      undefined,
      `«${prohibido}» está en la lista de lo que falta, y ${cifra} SÍ se mide: el panel lee ` +
        `«${campo}». Una pantalla que dibuja un número y debajo afirma que ese número no se ` +
        'puede saber enseña a no leer los carteles, y se lleva puestos a los que sí son ciertos',
    );
  }
});
