// Qué URL externa puede dibujar Creative, y como qué. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PRUEBA DE UN VALIDADOR ES SOBRE LO QUE RECHAZA
//
// `lib/negocio/urlExterna.ts` decide qué link manual se acepta como «Ver en Facebook / Instagram» y
// qué miniatura o video puede cargar el navegador solo (docs/creative/15, C15-06 y C15-07). Aceptar lo
// bueno es fácil; lo que esta prueba vigila son los disfraces de un host: el sufijo sin punto, el
// usuario delante de la arroba, el protocolo, el puerto. Cada uno tiene su mutación en el encabezado
// de su caso.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';

import { archivosFuente } from '../apoyo/fuente.ts';
import { enlaceDePublicacion, LARGO_MAXIMO_DE_URL, medioPermitido } from '../../lib/negocio/urlExterna.ts';

test('los links de publicación de Facebook e Instagram pasan, con su red', () => {
  assert.deepEqual(enlaceDePublicacion('https://www.facebook.com/reel/123'), {
    url: 'https://www.facebook.com/reel/123',
    red: 'facebook',
  });
  assert.deepEqual(enlaceDePublicacion('https://www.instagram.com/p/AbC123/'), {
    url: 'https://www.instagram.com/p/AbC123/',
    red: 'instagram',
  });
  // El link «Compartir vista previa» del Administrador de anuncios sale por el acortador de Meta.
  assert.equal(enlaceDePublicacion('https://fb.me/2abcXyZ')?.red, 'facebook');
  // `new URL` baja el host a minúsculas: lo que se guarda es lo que el navegador va a abrir.
  assert.equal(enlaceDePublicacion('https://WWW.Facebook.com/x')?.url, 'https://www.facebook.com/x');
});

test('un host que sólo se PARECE no pasa', () => {
  /* Mutación: comparar con `endsWith('facebook.com')` en vez de por igualdad deja pasar el primero;
     buscar la palabra en la URL deja pasar el segundo. */
  for (const url of [
    'https://evilfacebook.com/reel/1',
    'https://facebook.com.evil.com/reel/1',
    'https://evil.com/?r=https://www.facebook.com/reel/1',
    'https://instagram.co/p/1',
  ]) {
    assert.equal(enlaceDePublicacion(url), null, `aceptó ${url}`);
  }
});

test('el usuario delante de la arroba es el disfraz del host, y se rechaza', () => {
  /* `https://www.facebook.com@evil.com/` abre `evil.com`: lo de antes de la arroba es un usuario.
     El primero ya lo frena la lista (su host es `evil.com`). Mutación: quitar el chequeo de
     `username`/`password` deja pasar los otros dos, cuyo host SÍ es de la lista. */
  assert.equal(enlaceDePublicacion('https://www.facebook.com@evil.com/reel/1'), null);
  assert.equal(enlaceDePublicacion('https://usuario:clave@www.facebook.com/reel/1'), null);
  assert.equal(enlaceDePublicacion('https://usuario@www.facebook.com/reel/1'), null);
});

test('sólo https, sin puerto, y con un tope de largo', () => {
  // Mutación: aceptar `http:` deja pasar el primero; no mirar el puerto, el cuarto.
  assert.equal(enlaceDePublicacion('http://www.facebook.com/reel/1'), null);
  assert.equal(enlaceDePublicacion('javascript:alert(1)'), null);
  assert.equal(enlaceDePublicacion('www.facebook.com/reel/1'), null);
  assert.equal(enlaceDePublicacion('https://www.facebook.com:8443/reel/1'), null);
  assert.equal(enlaceDePublicacion(`https://www.facebook.com/${'a'.repeat(LARGO_MAXIMO_DE_URL)}`), null);
  assert.equal(enlaceDePublicacion(''), null);
  assert.equal(enlaceDePublicacion(undefined), null);
  assert.equal(enlaceDePublicacion(42), null);
});

test('los medios aceptan el CDN de Meta por sufijo, siempre con el punto adelante', () => {
  assert.equal(medioPermitido('https://scontent-ord5-1.xx.fbcdn.net/v/t45/abc.jpg?oe=6700ABCD'), true);
  assert.equal(medioPermitido('https://video.xx.fbcdn.net/v/abc.mp4'), true);
  assert.equal(medioPermitido('https://scontent.cdninstagram.com/v/abc.jpg'), true);
  // Mutación: el sufijo sin punto (`endsWith('fbcdn.net')`) deja pasar el primero.
  assert.equal(medioPermitido('https://evilfbcdn.net/abc.jpg'), false);
  assert.equal(medioPermitido('https://fbcdn.net/abc.jpg'), false);
  assert.equal(medioPermitido('https://fbcdn.net.evil.com/abc.jpg'), false);
  assert.equal(medioPermitido('http://scontent.xx.fbcdn.net/abc.jpg'), false);
});

test('las dos listas no se cruzan: un post no es un medio, y un medio no es un post', () => {
  /* Un link del CDN guardado como link manual sería una URL firmada —una llave del archivo— en la
     base; un post en un `<img>` no dibuja nada. Mutación: unir las dos listas. */
  assert.equal(medioPermitido('https://www.facebook.com/reel/1'), false);
  assert.equal(enlaceDePublicacion('https://scontent.xx.fbcdn.net/v/abc.jpg'), null);
});

test('`negocio.enlaces_de_pieza` tiene UN solo escritor', () => {
  /* Mismo criterio que `111-un-solo-escritor`: se busca la FORMA de la escritura y no una convención.
     Mutación: un `insertInto('enlaces_de_pieza')` en la ruta. */
  const ESCRITOR = 'lib/negocio/enlaceDeLaPieza.ts';
  const escritura = /(insertInto|updateTable|deleteFrom)\(\s*['"`]enlaces_de_pieza['"`]\s*\)/;
  const culpables = archivosFuente(['app', 'lib'])
    .filter((a) => a.ruta !== ESCRITOR && escritura.test(a.limpio))
    .map((a) => a.ruta);
  assert.deepEqual(culpables, [], 'otro archivo escribe los links manuales de las piezas');

  const escritor = archivosFuente(['lib']).find((a) => a.ruta === ESCRITOR);
  assert.ok(escritor, `no se encontró ${ESCRITOR}`);
  assert.match(escritor.limpio, escritura, 'el escritor dejó de escribir: la aserción de arriba pasaría en vacío');
});
