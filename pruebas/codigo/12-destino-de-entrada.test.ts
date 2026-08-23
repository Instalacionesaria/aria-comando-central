// El destino de la redirección después de entrar. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO EXISTE
//
// `destinoSeguro()` decide a dónde navega el navegador con un valor que **lo controla quien
// arma el enlace**: el `?volver=` de la pantalla de entrada. Si deja pasar un origen externo,
// la pantalla de login se convierte en un redirector abierto — la forma clásica de usar el
// login de alguien como trampolín de phishing: el usuario ve el dominio real en la barra,
// entra, y aterriza en una copia que le dice "tu sesión venció, volvé a entrar".
//
// Y no es hipotético: **la primera versión de esa función tenía el agujero.** Validaba por
// prefijos —empieza con una barra, y la que sigue no es barra ni contrabarra— y cuatro
// variantes con tab o salto de línea pasaban limpias. Esta prueba es la que faltaba.
//
// Es de tipo Código porque la función es pura: no hay base, no hay navegador. Por eso vive en
// `lib/autorizacion/destino.ts` y no adentro de la pantalla, que no se puede importar desde
// una prueba de Node.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { destinoSeguro } from '../../lib/autorizacion/destino.ts';
import { archivosQueContienen } from '../apoyo/fuente.ts';

const PROPIO = 'https://comando.aria';

/** A qué origen llevaría de verdad el navegador con este camino. */
function origenAlQueLleva(camino: string): string {
  try {
    return new URL(camino, PROPIO).origin;
  } catch {
    return '(ilegible)';
  }
}

// ── Lo que tiene que dejar pasar ─────────────────────────────────────────────

test('un camino interno pasa entero, con su consulta y su fragmento', () => {
  // La mitad que hace que la prueba no sea "devolvé siempre /". Sin esto, una función que
  // rechazara todo pasaría todas las afirmaciones de abajo y rompería la aplicación: nadie
  // volvería nunca a la pantalla que pidió.
  assert.equal(destinoSeguro('/panel', PROPIO), '/panel');
  assert.equal(destinoSeguro('/panel/ventas', PROPIO), '/panel/ventas');
  assert.equal(destinoSeguro('/panel?mes=3', PROPIO), '/panel?mes=3');
  assert.equal(destinoSeguro('/panel?mes=3#fila-7', PROPIO), '/panel?mes=3#fila-7');
});

test('vacío, nulo e indefinido dan la raíz', () => {
  assert.equal(destinoSeguro(null, PROPIO), '/');
  assert.equal(destinoSeguro(undefined, PROPIO), '/');
  assert.equal(destinoSeguro('', PROPIO), '/');
});

// ── Lo que tiene que rechazar ────────────────────────────────────────────────

test('LOS CUATRO CON TAB Y SALTO DE LÍNEA — el agujero que tenía la primera versión', () => {
  // Éstos son el motivo de este archivo. La cadena llega DECODIFICADA (`URLSearchParams.get()`
  // lo hace), así que el segundo carácter es un tab literal y las guardas por prefijo pasan.
  // Después el parser del navegador **borra todo tab y salto de línea ASCII antes de
  // resolver** —primer paso del algoritmo del estándar— y lo que queda es `//evil.com`.
  const BARRA_INVERSA = String.fromCharCode(92);
  const trampas = [
    '/\t/evil.com',
    '/\n/evil.com',
    '/\r/evil.com',
    '/\t' + BARRA_INVERSA + 'evil.com',
    '/\n' + BARRA_INVERSA + 'evil.com',
  ];

  for (const trampa of trampas) {
    // Primero se AFIRMA QUE LA TRAMPA ES REAL. Sin esto, la prueba de abajo podría estar
    // pasando porque el caso no lleva a ningún lado, no porque la función lo atrape — y el
    // día que el parser cambie, nadie se enteraría de que la prueba dejó de probar algo.
    assert.notEqual(
      origenAlQueLleva(trampa),
      PROPIO,
      `la trampa ${JSON.stringify(trampa)} ya no lleva afuera: esta prueba dejó de probar algo`,
    );
    assert.equal(
      destinoSeguro(trampa, PROPIO),
      '/',
      `${JSON.stringify(trampa)} lleva a ${origenAlQueLleva(trampa)} y no fue rechazado`,
    );
  }
});

test('las variantes de doble barra y contrabarra', () => {
  const BARRA_INVERSA = String.fromCharCode(92);
  for (const trampa of [
    '//evil.com',
    '/' + BARRA_INVERSA + 'evil.com',
    '/' + BARRA_INVERSA + BARRA_INVERSA + 'evil.com',
    '//evil.com/robar',
  ]) {
    assert.equal(destinoSeguro(trampa, PROPIO), '/', `${JSON.stringify(trampa)} no fue rechazado`);
  }
});

test('una URL absoluta a otro origen, en cualquier esquema', () => {
  for (const trampa of [
    'https://evil.com',
    'http://evil.com/robar',
    'https://evil.com/?a=1',
    // El mismo anfitrión con otro esquema es OTRO origen, y degradar el esquema es la mitad de
    // un ataque de intermediario. Por eso la comparación es por origen y no por anfitrión.
    'http://comando.aria/panel',
    // Un anfitrión que EMPIEZA con el nuestro. Una comparación con `startsWith` lo dejaría
    // pasar, y es un dominio que cualquiera puede registrar.
    'https://comando.aria.evil.com/panel',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
  ]) {
    assert.equal(destinoSeguro(trampa, PROPIO), '/', `${JSON.stringify(trampa)} no fue rechazado`);
  }
});

test('una URL absoluta al MISMO origen se acepta, reducida a su camino', () => {
  // No es una fuga y conviene que funcione: lo que se navega es el camino, no la URL que
  // entró. Que la salida sea siempre relativa es lo que hace que "lo que se navega es lo que
  // se validó" sea cierto carácter por carácter.
  assert.equal(destinoSeguro('https://comando.aria/panel?x=1', PROPIO), '/panel?x=1');
});

// ── Que la pantalla la use, y que no haya una segunda copia ──────────────────

test('la pantalla de entrada usa esta función y no una propia', () => {
  // La función vivía adentro de `app/entrar/page.tsx`, donde no se podía probar. Si alguien la
  // vuelve a escribir ahí, esta prueba no lo ve — pero sí ve que la pantalla dejó de importar
  // la única versión probada.
  const usan = archivosQueContienen(/\bdestinoSeguro\s*\(/, ['app', 'lib', 'components']);
  assert.deepEqual(
    usan.sort(),
    ['app/entrar/page.tsx', 'lib/autorizacion/destino.ts'].sort(),
    'la validación del destino tiene que estar en UN solo lugar, y la pantalla tiene que usarla',
  );
});

test('nadie navega a un destino sin validarlo', () => {
  // El otro modo de perder esto: alguien agrega un `window.location = ...` con el valor crudo
  // de un parámetro. Se busca la forma —asignar o reemplazar la ubicación— y se exige que solo
  // aparezca donde el destino ya pasó por la función.
  const navegan = archivosQueContienen(
    /window\.location\.(replace|assign|href)\s*[=(]/,
    ['app', 'lib', 'components'],
  );
  assert.deepEqual(
    navegan.sort(),
    // Los dos que navegan a un destino que viene de afuera. `guardia.tsx` manda a `/entrar` con
    // un camino que ARMA ella misma desde `window.location.pathname`, no de un parámetro.
    ['app/entrar/page.tsx', 'app/guardia.tsx'].sort(),
    'un archivo nuevo navega por su cuenta: si el destino viene de un parámetro, tiene que ' +
      'pasar por destinoSeguro()',
  );
});
