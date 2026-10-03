// El Research acepta negocios que venden a empresas (B2B) y a personas (B2C).
//
// Hasta el 2026-10-03 el paso 1 decía «quiero que le vendan a empresas (B2B)» con todas las letras, y
// el criterio se llamaba «LTV mínimo de SUS clientes». Ahora lo primero que se pregunta es a quién se
// le vende —el agente lo deduce de Tu ficha y lo confirma—, y eso cambia los segmentos (paso 1), el
// modelo de precios (paso 4) y la mirada al mercado real: en B2C no corren Google Maps ni las páginas
// de Facebook, solo el Espía de anuncios, que no gasta saldo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { camposDe, obligatoriosQueFaltan, respondido } from '../../lib/fundaciones/campos.ts';
import { estadoVacio } from '../../lib/fundaciones/estado.ts';
import { heredadosDe } from '../../lib/fundaciones/heredados.ts';
import { herramienta } from '../../lib/fundaciones/herramientas.ts';
import { esB2C, esPaisReconocido } from '../../lib/fundaciones/mercado.ts';
import { armarPromptResearch } from '../../lib/fundaciones/prompts.ts';

const codigo = (ruta: string): string => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));
const research = herramienta(1)!;
const campo = (id: string) => camposDe(research).find((c) => c.id === id)!;
const B2B = campo('mr-market').opciones!.find((o) => o.valor.startsWith('B2B'))!.valor;
const B2C = campo('mr-market').opciones!.find((o) => o.valor.startsWith('B2C'))!.valor;
const INPUTS = { niche: 'salud', buyers: '50,000+', ltv: '$3,000+', experience: 'nutricionista' };

test('lo primero que pregunta el Research es si le vende a empresas o a personas, y es obligatorio', () => {
  assert.equal(camposDe(research)[0]!.id, 'mr-market');
  assert.equal(campo('mr-market').etiqueta, '¿Le vendes a empresas o a personas?');
  assert.ok(obligatoriosQueFaltan(research, { 'mr-niche': 'x', 'mr-experience': 'y' }).some((c) => c.id === 'mr-market'));
  // Se deduce de la ficha pero se CONFIRMA: el relleno no la propone.
  assert.equal(campo('mr-market').confirmarEnElChat, true);
  assert.match(codigo('lib/fundaciones/relleno.ts'), /if \(campo\.confirmarEnElChat\) \{\s*valores\[claveCorta\(campo\.id\)\] = '';/);
  assert.match(campo('mr-market').guia!, /CONFÍRMALA en una línea antes de anotarla/);
  assert.equal(esB2C(B2C), true);
  assert.equal(esB2C(B2B), false);
  assert.equal(esB2C(''), false, 'un Research de antes del cambio sigue siendo B2B');
});

test('B2C cambia los segmentos del paso 1 y el modelo de precios del paso 4', () => {
  const b2b1 = armarPromptResearch(0, { ...INPUTS, market: B2B }, []);
  const b2c1 = armarPromptResearch(0, { ...INPUTS, market: B2C }, []);
  assert.match(b2b1, /Quiero que le vendan a empresas \(B2B\)/);
  assert.doesNotMatch(b2c1, /le vendan a empresas/);
  assert.match(b2c1, /directamente a PERSONAS \(consumidor final, B2C\)/);
  assert.match(b2c1, /me pague, en total, más de \$3,000\+ mientras sigue siendo mi cliente/);

  const previas = ['p1', 'p2', 'p3'];
  assert.match(armarPromptResearch(3, { ...INPUTS, market: B2B }, previas), /setup\/implementación/);
  const b2c4 = armarPromptResearch(3, { ...INPUTS, market: B2C }, previas);
  assert.match(b2c4, /pago único, programa por etapas y suscripción/);
  assert.doesNotMatch(b2c4, /retainer/);
});

test('sin jerga: el valor de un cliente se pregunta en palabras simples', () => {
  assert.doesNotMatch(campo('mr-ltv').etiqueta, /LTV/);
  assert.equal(campo('mr-ltv').etiqueta, '¿Cuánto debería valer, como mínimo, un cliente a lo largo del tiempo?');
  assert.match(campo('mr-ltv').guia!, /sin decir «LTV»/);
});

test('en B2C la ubicación es solo el país, y la mirada corre solo el Espía', () => {
  const ubicacion = campo('mr-location');
  const valores = (mercado: string, lugar: string) => ({ 'mr-market': mercado, 'mr-location': lugar });
  assert.equal(respondido(ubicacion, valores(B2C, 'Perú')), true, 'en B2C un país alcanza');
  assert.equal(respondido(ubicacion, valores(B2B, 'Perú')), false, 'en B2B sigue exigiendo zona, ciudad y país');
  assert.equal(respondido(ubicacion, valores(B2B, 'Cayma, Arequipa, Perú')), true);
  assert.equal(esPaisReconocido('Latinoamérica'), false);

  const operaciones = codigo('lib/fundaciones/operaciones.ts');
  assert.match(operaciones, /if \(esB2C\(estado\.datos\.researchInputs\['market'\]\)\) \{/);
  assert.match(operaciones, /topeDeNegocios: 0,\s*topeDePaginas: 0,\s*anuncios: ANUNCIOS_DE_LA_MIRADA,\s*soloAnuncios: true,/);

  const panel = codigo('components/fundaciones/PanelResearch.jsx');
  // En B2C solo se arranca el Espía, y sin la confirmación de gasto (no gasta).
  const b2c = panel.slice(panel.indexOf('if (prep.datos.soloAnuncios) {'), panel.indexOf('const saldo = await leerSaldo();'));
  assert.match(b2c, /iniciarScraping\('ad-spy'/);
  assert.doesNotMatch(b2c, /iniciarScraping\('maps'|iniciarScraping\('facebook-pages'|esperarDecision/);
  assert.match(b2c, /trabajoMaps: null, trabajoEspia: espiaB2C\.id, trabajoPaginas: null/);
});

test('el VSL hereda del Research si se vende a empresas o a personas, con SU opción', () => {
  const e = estadoVacio();
  e.researchInputs = { market: B2C };
  const vsl = herramienta(5)!;
  const opcionB2C = camposDe(vsl).find((c) => c.id === 't6-market')!.opciones!.find((o) => o.valor.startsWith('B2C'))!.valor;
  assert.equal(heredadosDe(vsl, e)['market']?.valor, opcionB2C);
});
