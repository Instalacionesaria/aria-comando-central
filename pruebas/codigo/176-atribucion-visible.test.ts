// La atribución que la ficha de Leads Portal muestra: por lista blanca, y de las direcciones sólo el
// sitio. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA
//
// `atribucion_primera` se guarda cruda. Medido el 2026-09-27 sobre los 593 contactos: `ip` en 331,
// `userAgent` en 331, `fbclid` en 286, y 286 direcciones con un token adentro. La ficha la muestra, y
// lo único que separa esos datos de la pantalla es `atribucionVisible`.
//
// El objeto de prueba trae TODO lo que no puede viajar —una IP de documentación, un navegador, un
// `fbclid`, un JWT dentro de la dirección, y una clave que el CRM podría empezar a mandar mañana—, y
// la prueba mira la salida entera serializada: si algo se cuela por cualquier campo, aparece.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { atribucionVisible, CLAVES_VISIBLES } from '../../lib/negocio/atribucionVisible.ts';

/** Un JWT de ejemplo: cabecera, cuerpo y firma inventados. Nunca fue un token de nadie. */
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwZXJzb25hLWRlLXBydWViYSJ9.firmaDePruebaQueNoValeNada';

const CRUDA = {
  sessionSource: 'Paid Social',
  utmSource: 'facebook',
  campaign: 'Campaña de prueba',
  utmMedium: 'Conjunto A',
  utmTerm: '120200000000000001',
  utmContent: 'Pieza 3 · video',
  adId: '120200000000000099',
  utmKeyword: 'mentoria',
  url: `https://accelerator.ariaia.com/vsl?token=${JWT}&fbclid=IwAR0dePrueba`,
  referrer: `https://l.facebook.com/l.php?u=algo&h=${JWT}`,
  ip: '203.0.113.9',
  userAgent: 'Mozilla/5.0 (Linux; Android 14) NavegadorDePrueba/1.0',
  fbclid: 'IwAR0dePrueba',
  fbp: 'fb.1.1700000000000.1234567890',
  fbc: 'fb.1.1700000000000.IwAR0dePrueba',
  gaClientId: '1234567890.1700000000',
  claveQueElCrmEmpezoAMandar: 'valor-desconocido',
};

const RESUELTA = {
  hostDeLaUrl: 'accelerator.ariaia.com',
  hostDelReferrer: 'l.facebook.com',
  nombreDelAnuncio: 'Anuncio de prueba',
};

test('ni la IP, ni el navegador, ni el fbclid, ni el JWT de la dirección viajan', () => {
  const salida = JSON.stringify(atribucionVisible(CRUDA, RESUELTA));
  for (const prohibido of ['203.0.113.9', 'NavegadorDePrueba', 'IwAR0dePrueba', 'eyJhbGci', 'fb.1.', '1700000000']) {
    assert.ok(!salida.includes(prohibido), `«${prohibido}» viajó en la atribución visible`);
  }
});

test('una clave que el CRM empiece a mandar mañana no aparece sola: la lista es blanca', () => {
  const salida = atribucionVisible(CRUDA, RESUELTA);
  assert.ok(!JSON.stringify(salida).includes('valor-desconocido'), 'una clave desconocida se coló');
  const permitidas = new Set([...CLAVES_VISIBLES.map((c) => c.clave), 'url', 'referrer']);
  assert.deepEqual(
    salida.map((p) => p.clave).filter((c) => !permitidas.has(c)),
    [],
  );
});

test('de la dirección y del referente viaja sólo el sitio, y lo trae la base, no el objeto', () => {
  const salida = atribucionVisible(CRUDA, RESUELTA);
  assert.equal(salida.find((p) => p.clave === 'url')?.valor, 'accelerator.ariaia.com');
  assert.equal(salida.find((p) => p.clave === 'referrer')?.valor, 'l.facebook.com');
  /* Sin el host resuelto, la dirección no aparece: la función no la lee del objeto crudo nunca, así
     que no tiene de dónde sacar un «sitio» que no sea el que calculó la base. */
  const sinHosts = atribucionVisible(CRUDA, { hostDeLaUrl: null, hostDelReferrer: null, nombreDelAnuncio: null });
  assert.equal(sinHosts.find((p) => p.clave === 'url'), undefined);
  assert.equal(sinHosts.find((p) => p.clave === 'referrer'), undefined);
});

test('las ocho claves de la lista viajan con su rótulo, en orden, y el anuncio con su nombre', () => {
  const salida = atribucionVisible(CRUDA, RESUELTA);
  assert.deepEqual(
    salida.map((p) => p.clave),
    ['sessionSource', 'utmSource', 'campaign', 'utmMedium', 'utmTerm', 'utmContent', 'adId', 'utmKeyword', 'url', 'referrer'],
  );
  assert.equal(salida.find((p) => p.clave === 'utmMedium')?.rotulo, 'Conjunto, por nombre');
  assert.equal(salida.find((p) => p.clave === 'adId')?.valor, 'Anuncio de prueba');
  const sinNombre = atribucionVisible(CRUDA, { ...RESUELTA, nombreDelAnuncio: null });
  assert.equal(sinNombre.find((p) => p.clave === 'adId')?.valor, CRUDA.adId);
  assert.match(String(sinNombre.find((p) => p.clave === 'adId')?.nota), /no está entre los anuncios/i);
});

test('un valor vacío no viaja: «Campaña: —» afirmaría algo', () => {
  const salida = atribucionVisible({ campaign: '   ', utmSource: '' }, { hostDeLaUrl: ' ', hostDelReferrer: null, nombreDelAnuncio: null });
  assert.deepEqual(salida, []);
  assert.deepEqual(atribucionVisible(null, RESUELTA).map((p) => p.clave), ['url', 'referrer']);
});

test('el módulo de la atribución visible no importa nada', () => {
  /* Es una función pura sobre un objeto. Si importara la capa de datos, esta prueba de código
     arrastraría la base; y si sacara el host por su cuenta, el sistema tendría dos ideas de qué es un
     host —la de acá y la de `recorrido.ts`—. */
  const ts = readFileSync(join(RAIZ, 'lib/negocio/atribucionVisible.ts'), 'utf8');
  assert.deepEqual([...ts.matchAll(/^\s*import\s[^;]+;|^\s*export\s[^;]*\sfrom\s[^;]+;/gm)].map((m) => m[0]), []);
});
