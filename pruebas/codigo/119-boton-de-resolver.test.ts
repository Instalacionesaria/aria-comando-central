// EL BOTÓN DE RESOLVER: que exista, que apunte bien, y que diga las tres cosas. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTE ARCHIVO EXISTE PARA IMPEDIR, Y QUE YA OCURRIÓ
//
// `app/api/contactos/[id]/resolver/route.ts` se escribió con su capacidad, su lista blanca, sus doce
// pruebas contra la base y su entrada en los dos registros de excepciones. Y **nadie la llamaba.**
//
// Todo verde, todo correcto, y un vendedor mirando una urgencia sin ninguna forma de cerrarla — el
// contacto se quedaba en la cola para siempre. Una ruta sin llamador no falla en ningún lado: es la
// forma más cara de estar completo.
//
// ── LAS TRES COSAS QUE SE AFIRMAN, Y POR QUÉ CADA UNA ──────────────────────
//
//   1 · **El camino existe.** Un error de tipeo en la URL da un 404, y el 404 se dibuja como «no se
//       pudo resolver» — indistinguible de un CRM caído. Se compara contra el archivo real.
//   2 · **Alguien lo llama.** Es el defecto de arriba, convertido en una prueba.
//   3 · **Las tres respuestas se dicen distinto.** La del medio es la que importa: resuelto acá y el
//       CRM no aceptó. Dibujada como éxito, nadie reactiva ese agente nunca.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { queDecir } from '../../lib/auditor/resolverDesdeLaCola.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');

test('el camino que arma el cliente CORRESPONDE a un archivo de ruta que existe', () => {
  /* Un error de tipeo acá no rompe nada visible: la petición sale, el servidor devuelve 404, y el
     cliente lo traduce a «no se pudo resolver esta intervención» — que es exactamente lo que diría si
     el CRM estuviera caído. El vendedor reintentaría durante días. */
  const fuente = leer('lib/auditor/resolverDesdeLaCola.ts');
  const m = /`\/api\/([a-z]+)\/\$\{[^}]+\}\/([a-z]+)`/.exec(fuente);
  assert.ok(m, 'no se pudo leer el camino que arma el cliente');

  const ruta = `app/api/${m[1]}/[id]/${m[2]}/route.ts`;
  assert.ok(
    existsSync(join(RAIZ, ruta)),
    `el cliente pide /api/${m[1]}/…/${m[2]} y no hay manejador en ${ruta}`,
  );
  // Y ese manejador tiene el método que el cliente usa.
  assert.match(leer(ruta), /export\s+async\s+function\s+POST/);
});

test('ALGUIEN llama a resolver: la ruta no puede quedar sin llamador', () => {
  /* ══════════════════════════════════════════════════════════════════════════
     LA PRUEBA QUE HABRÍA AHORRADO EL VIAJE

     La ruta existió una etapa entera sin que nada la llamara. Tenía capacidad, lista blanca, doce
     pruebas contra la base y dos entradas en los registros de excepciones — y era inalcanzable.

     Se comprueba sobre los COMPONENTES y no sobre `lib/`: que el lado del navegador exista tampoco
     alcanza, porque también puede quedarse sin llamador. Lo que cierra el circuito es que una pantalla
     lo monte.
     ══════════════════════════════════════════════════════════════════════════ */
  const midia = leer('components/closer/MiDia.jsx');

  /* Se afirma que el botón **SE DIBUJA**, no que la función se mencione. La diferencia la encontró
     una mutación: con solo buscar `resolverIntervencion`, un componente definido y jamás renderizado
     pasa la prueba — que es exactamente la forma del defecto original, código completo e
     inalcanzable. Lo que cierra el circuito es el `<BotonDeResolver` puesto en el JSX. */
  assert.match(
    midia,
    /<BotonDeResolver\s/,
    'el botón existe pero no se dibuja: la ruta queda sin llamador otra vez',
  );
  assert.match(midia, /resolverIntervencion\(/, 'el botón no llama a la ruta');

  // Y las DOS pantallas le pasan la recarga, o el botón no se dibuja en una de ellas.
  for (const vista of ['components/views/CloserView.jsx', 'components/views/SetterView.jsx']) {
    assert.match(leer(vista), /alResolver=\{/, `${vista} no le pasa \`alResolver\` a MiDia`);
  }
});

test('el botón se dibuja SOLO en urgentes', () => {
  /* Las otras cuatro colas no tienen nada que resolver: un contacto del buzón no está marcado por el
     auditor, y ofrecerle «Ya lo atendí» le quitaría al CRM tres etiquetas que nadie puso. */
  assert.match(leer('components/closer/MiDia.jsx'), /cola\.clave === 'urgentes' \?/);
});

test('sin forma de recargar, el botón NO se dibuja', () => {
  /* Resolver saca al contacto de la cola **en el servidor**. Sin recargar, la pantalla lo sigue
     mostrando y el vendedor aprieta el botón otra vez sobre algo ya hecho — y a la segunda deja de
     creerle a la pantalla.
     El lado por el que conviene fallar es no ofrecer el botón, no ofrecer uno que deja la vista
     mintiendo. */
  assert.match(leer('components/closer/MiDia.jsx'), /if \(!alResolver\) return null;/);
});

// ═══════════════════════════════════════════════════════════════════════════════
// LAS TRES RESPUESTAS
// ═══════════════════════════════════════════════════════════════════════════════

test('«resuelto y el CRM no aceptó» NO se dice como un éxito', () => {
  /* ── LA RESPUESTA DEL MEDIO, QUE ES LA QUE IMPORTA ─────────────────────────
   *
   * La resolución ya ocurrió: el aviso está cerrado y el contacto salió de la cola. **No es un error**
   * —devolver uno haría que el vendedor apretara el botón otra vez sobre algo hecho— pero la etiqueta
   * sigue puesta en el CRM, y mientras siga puesta **el agente sigue pausado**.
   *
   * Dibujado como «Resuelto.», nadie reactiva ese agente nunca: no hay ninguna otra pantalla que lo
   * diga, y el síntoma aparece cuando un contacto escribe y no le contesta nadie. */
  const dice = queDecir({ tipo: 'ok', resuelto: true, etiquetasQuitadas: false });
  assert.notEqual(dice, 'Resuelto.');
  assert.match(dice, /sigue pausado/);
  assert.match(dice, /a mano/, 'tiene que decir QUÉ hacer, no solo qué pasó');
});

test('las tres respuestas se dicen distinto', () => {
  const tres = new Set([
    queDecir({ tipo: 'ok', resuelto: true, etiquetasQuitadas: true }),
    queDecir({ tipo: 'ok', resuelto: true, etiquetasQuitadas: false }),
    queDecir({ tipo: 'fallo', mensaje: 'No se pudo conectar.' }),
  ]);
  assert.equal(tres.size, 3, 'dos respuestas distintas se están diciendo igual');
});

test('«no había nada abierto» tampoco es un error', () => {
  /* Pasa con un contacto marcado por la plataforma anterior: tiene la etiqueta y no tiene análisis
     nuestro. Se le quitan las etiquetas igual —es lo único que lo saca de la cola— y decirlo como un
     fallo mandaría a investigar algo que funcionó. */
  const dice = queDecir({ tipo: 'ok', resuelto: false, etiquetasQuitadas: true });
  assert.match(dice, /se quitaron las etiquetas/);
  assert.ok(!/no se pudo/i.test(dice));
});
