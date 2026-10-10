// Una cifra que la pantalla DIBUJA no puede estar en la lista de «lo que falta». Tipo: Código.
//
// ══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTO IMPIDE, Y YA SE PAGÓ UNA VEZ
//
// Hasta el 2026-10-10, `components/conversation/PanelDeConversation.jsx` tenía dos cosas que hablaban del mismo
// tema y no se conocían entre sí: las tarjetas con las cifras, y el objeto `FLUJOS[x].falta`, que enumeraba en
// prosa lo que ese flujo todavía no podía medir.
//
// Cuando la migración `049` le dio a la cita su columna `asistio`, la tarjeta «Se presentaron» apareció — y el
// renglón que decía *«La asistencia: el CRM tiene los campos… y están casi vacíos»* **se quedó tres centímetros más
// abajo**. La pantalla mostraba un número y debajo afirmaba que ese número no se podía saber. Un cartel que se
// contradice con la pantalla enseña a no leer los carteles: se pierde la credibilidad de los que sí son ciertos.
//
// ── DÓNDE VIVE HOY LA LISTA, Y POR QUÉ LA PRUEBA LA SIGUIÓ ──────────────────
//
// Desde CN-3 la pantalla no dibuja párrafos (docs/conversation/01, CN1-05): cada lugar sin dato va en «—» con una
// línea, y lo que haría falta para medirlo vive en `docs/OTROS/futuro/lo-que-conversation-no-mide.md`, que el
// agente de Conversation puede citar. El defecto puede volver ahí: una sección que declare faltante una cifra que la
// pantalla dibuja con su valor. Así que la relación se sigue declarando acá, a mano, un renglón por cifra publicada.
// ══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const PANEL = 'components/conversation/PanelDeConversation.jsx';
const LECTURA = 'lib/negocio/lecturaDeConversation.ts';
const FUTURO = 'docs/OTROS/futuro/lo-que-conversation-no-mide.md';

/** Las cifras que la pantalla dibuja con valor, el campo de la lectura que las da y el título que las negaría. */
const YA_SE_MIDE: readonly { cifra: string; campo: string; prohibido: RegExp }[] = [
  { cifra: 'la confirmación del agendamiento', campo: "paso('confirmaron'", prohibido: /^la confirmación\b/i },
  { cifra: 'la respuesta del contacto', campo: "paso('respondieron'", prohibido: /^la (tasa de )?respuesta\b/i },
  { cifra: 'la cancelación y el reagendamiento', campo: "paso('cancelaron'", prohibido: /^(la cancelación|el reagendamiento)\b/i },
  { cifra: 'el ICP de quienes agendaron', campo: 'icpDeLosAgendados(dias)', prohibido: /^el icp\b/i },
  { cifra: 'el sentimiento', campo: 'sentimientoDe(', prohibido: /^el sentimiento\b/i },
];

test('el panel no tiene su propia lista de lo que falta: vive en el documento de futuro', () => {
  const panel = leer(PANEL);
  assert.ok(!/const FLUJOS|\.falta\b/.test(panel), 'el panel volvió a escribir su lista de lo que falta: es un párrafo, y vive en el documento');
  const futuro = leer(FUTURO);
  const secciones = futuro.split(/^## /m).slice(1);
  assert.ok(secciones.length >= 5, 'no se leyeron las secciones del documento de futuro');
  for (const s of secciones) {
    const titulo = s.split('\n')[0]!.trim();
    assert.match(s, /\*\*Dónde se dibujaría\*\*/, `«${titulo}» no dice en qué lugar de la pantalla va su «—»`);
    assert.match(s, /\*\*Por qué no hay dato\*\*/, `«${titulo}» no dice por qué falta`);
  }
});

test('una cifra que la pantalla dibuja NO puede estar declarada como faltante', () => {
  const lectura = leer(LECTURA);
  const titulos = [...leer(FUTURO).matchAll(/^## \d+ · (.+)$/gm)].map((m) => m[1]!.trim());
  assert.ok(titulos.length > 0, 'no se leyó ningún título: la prueba dejó de poder leer el documento, y pasaría siempre');
  for (const { cifra, campo, prohibido } of YA_SE_MIDE) {
    /* La entrada muerta: si la lectura dejara de calcularla, la prueba pasaría por el motivo equivocado. */
    assert.ok(
      lectura.includes(campo),
      `la lectura dejó de calcular ${cifra} («${campo}»). Si se quitó a propósito, sacá su renglón de esta tabla Y ` +
        'declarala faltante en el documento',
    );
    const choca = titulos.find((t) => prohibido.test(t));
    assert.equal(choca, undefined, `«${choca}» está en lo que Conversation no mide, y ${cifra} SÍ se dibuja`);
  }
});
