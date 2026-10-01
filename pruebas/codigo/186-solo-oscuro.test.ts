// La aplicación es sólo oscura, y nada la devuelve al claro. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA TRAMPA DE SACAR UN BOTÓN (docs/OTROS/nueva-estructura/03-LA-MARCA.md, NE-23)
//
// Hasta el 2026-10-01 cada persona elegía oscuro o claro, y la elección se leía de DOS lugares: un
// guion de arranque leía la copia del navegador (`aios:tema` en `localStorage`) y la barra lateral
// aplicaba la de la base al llegar la sesión. Borrar sólo el botón dejaba a quien había elegido
// «claro» en claro para siempre: las dos lecturas le repetían su última elección y ya no quedaba con
// qué cambiarla. No falla nada, y nadie del equipo lo vería, porque todos usan el oscuro.
//
// Por eso esto no vigila el botón sino las LECTURAS: que el tema esté fijo en `app/tema.ts`, que
// nadie en el navegador lea la copia local ni el tema de la sesión, y que la ruta que lo guardaba
// quede sin llamador. La escritura del atributo del `<html>` la vigila la `104`.
//
// Las mutaciones que la ponen en rojo: `TEMA = 'claro'`; un guion que vuelva a leer `aios:tema`; la
// barra que vuelva a aplicar `sesion.tema`; y devolver `components/BotonDeTema.jsx`, que llamaba a
// `PUT /api/auth/tema`.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, archivosQueContienen, sinComentarios } from '../apoyo/fuente.ts';
import { TEMA, temaCss } from '../../app/tema.ts';

/** Todo lo que puede correr en el navegador. `app/api/` es del servidor: ahí vive la ruta dormida. */
const delNavegador = (patron: RegExp): string[] =>
  archivosQueContienen(patron, ['app', 'components', 'lib', 'public']).filter((r) => !r.startsWith('app/api/'));

test('el tema está fijo en oscuro', () => {
  assert.equal(TEMA, 'oscuro');
  assert.equal(temaCss(TEMA), 'dark', 'el nombre del brandbook no acompaña al de la aplicación');
});

test('nadie en el navegador lee la copia local del tema', () => {
  // La mitad de la trampa que sobrevive a borrar el botón: un guion que lea la copia antes del primer
  // pintado le devuelve el claro a quien lo eligió alguna vez. `\btema` y no `tema`, porque «sistema»
  // lo contiene.
  assert.deepEqual(
    delNavegador(/aios:tema|localStorage[\s\S]{0,120}\btema\b/),
    [],
    'leen el tema guardado en el navegador: a quien eligió «claro» lo vuelven a poner en claro',
  );
});

test('nadie en el navegador lee el tema de la sesión', () => {
  // La otra mitad: la ruta de sesión lo sigue mandando, dormido, y la guarda lo deja afuera con su
  // motivo (`185`, `FUERA`). Si una pantalla lo leyera, la base volvería a decidir el tema.
  assert.deepEqual(delNavegador(/sesion\??\.tema\b|datos\??\.tema\b/), [], 'leen el tema de la sesión');
  for (const archivo of ['app/sesion-contexto.tsx', 'app/guardia.tsx']) {
    const limpio = sinComentarios(readFileSync(join(RAIZ, archivo), 'utf8'));
    assert.doesNotMatch(limpio, /^\s*tema\??\s*:/m, `${archivo} volvió a declarar o copiar el tema de la sesión`);
  }
});

test('la ruta que guardaba el tema queda sin llamador', () => {
  // Dormida, no borrada: la columna sigue en la base y retirarla exige una migración. Lo que no puede
  // volver es un control que la llame, porque un tema guardado es un tema que alguien va a leer.
  assert.deepEqual(delNavegador(/['"`]\/api\/auth\/tema['"`?]/), [], 'algo vuelve a guardar el tema');
});
