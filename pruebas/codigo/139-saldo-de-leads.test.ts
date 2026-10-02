// La empresa ve cuántos leads le quedan.
//
// Kevin, logueado como Allpa (2026-09-13): «quisiera saber si las empresas tienen dónde ver cuántos
// leads les queda para scrapear, cuántos leads les habíamos regalado». No tenían: el monedero solo
// lo veía Monitoreo. Aprobado sobre mockup: una franja arriba de Tools con el desglose, y la misma
// cifra en la confirmación de la mirada del Research.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ, archivosFuente, sinComentarios } from '../apoyo/fuente.ts';
import { desglosarSaldo } from '../../lib/tools/saldo.ts';
import { MINIMO_LEADS_MAPS } from '../../lib/tools/scrapers.ts';

const codigo = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

test('el desglose sale del monedero: regalo, usados y comprados, con lo gratis consumido primero', () => {
  // Allpa hoy: 500 de regalo, 100 usados (páginas de Facebook), nada comprado.
  const allpa = desglosarSaldo({
    numero_leads_scrapeados: 100,
    leads_base_gratuitos: 400,
    leads_adicionales_pagados: 0,
    leads_disponibles_en_total: 400,
    leads_regalados: 500,
    sin_limite: false,
  });
  assert.deepEqual(allpa, { disponibles: 400, regalados: 500, usados: 100, comprados: 0, estado: 'normal' });

  // Se acabó el regalo, compró 200 y ya usó 50 de esos: comprados = 150 que quedan + 50 usados.
  const compro = desglosarSaldo({
    numero_leads_scrapeados: 550,
    leads_base_gratuitos: 0,
    leads_adicionales_pagados: 150,
    leads_disponibles_en_total: 150,
    leads_regalados: 500,
    sin_limite: false,
  });
  assert.deepEqual(compro, { disponibles: 150, regalados: 500, usados: 550, comprados: 200, estado: 'normal' });

  // Bajo: no alcanza para una búsqueda de Maps. Agotado: cero. La casa: sin límite.
  assert.equal(desglosarSaldo({ numero_leads_scrapeados: 440, leads_base_gratuitos: 60, leads_adicionales_pagados: 0, leads_disponibles_en_total: 60, leads_regalados: 500, sin_limite: false }).estado, 'bajo');
  assert.ok(60 < MINIMO_LEADS_MAPS);
  assert.equal(desglosarSaldo({ numero_leads_scrapeados: 500, leads_base_gratuitos: 0, leads_adicionales_pagados: 0, leads_disponibles_en_total: 0, leads_regalados: 500, sin_limite: false }).estado, 'agotado');
  assert.equal(desglosarSaldo({ numero_leads_scrapeados: 9000, leads_base_gratuitos: 0, leads_adicionales_pagados: 0, leads_disponibles_en_total: 0, leads_regalados: 0, sin_limite: true }).estado, 'sin_limite');

  // Un monedero de antes de la 018 (regalados en 0) no muestra un regalo menor que lo que le queda.
  assert.equal(desglosarSaldo({ numero_leads_scrapeados: 0, leads_base_gratuitos: 100, leads_adicionales_pagados: 0, leads_disponibles_en_total: 100, leads_regalados: 0, sin_limite: false }).regalados, 100);
});

test('la ruta lee el monedero dentro de la organización, con la capacidad de Tools y sin `where`', () => {
  const ruta = sinComentarios(codigo('app/api/tools/saldo/route.ts'));
  assert.match(ruta, /exigir\(peticion, \['tools\.ver'\], PANTALLA\)/);
  assert.match(ruta, /conOrganizacion\(contexto\.orgEfectiva/);
  assert.match(ruta, /selectFrom\('public\.aria_cc_scraper_monedero'\)/);
  assert.ok(!/\.where\(/.test(ruta), 'la fila propia la elige la política de RLS, no un where');
  assert.match(ruta, /'leads_regalados'/);
  assert.match(ruta, /desglosarSaldo\(/);
});

test('la franja vive arriba de las dos pestañas que gastan saldo, y la confirmación del Research dice cuánto queda', () => {
  /* Desde la etapa E11 Tools no tiene barra propia: la franja va arriba de Prospección y del Scraper,
     que son las que gastan el saldo con el mismo buscador, y no arriba de todo (`NE-20`). Se monta con
     Tools a la vista y con una `key` por pestaña: Tools no se desmonta nunca, y sin las dos cosas el
     saldo quedaba el de la primera lectura, también al volver de un scraping. */
  const vista = sinComentarios(codigo('components/views/ToolsView.jsx'));
  assert.match(vista, /const GASTAN_SALDO = \['prospeccion', 'scraper'\];/, 'la franja se ve en una pestaña que no gasta saldo, o falta en una que sí');
  assert.match(vista, /const pestana = usarPestanaDibujada\('tools'\);/, 'la franja no sigue a la pestaña que Tools dibuja');
  assert.match(vista, /const aLaVista = estaALaVista\('tools'\);/);
  assert.match(vista, /\{GASTAN_SALDO\.includes\(pestana\) && aLaVista \? <SaldoDeLeads key=\{pestana\} \/> : null\}\s*<Fundaciones catalogo=\{CATALOGO_TOOLS\} \/>/, 'la franja no se vuelve a montar en cada visita: muestra el saldo de la primera lectura');
  // Y en ningún otro lado: otra copia de la franja dentro de una pestaña la mostraría donde no se gasta.
  const montajes = archivosFuente(['components'])
    .filter((a) => /\.(jsx?|tsx?)$/.test(a.ruta))
    .flatMap((a) => [...sinComentarios(a.contenido).matchAll(/<SaldoDeLeads\b/g)].map(() => a.ruta));
  assert.deepEqual(montajes, ['components/views/ToolsView.jsx'], 'la franja del saldo se monta en otro lugar además de `ToolsView`');

  const franja = codigo('components/tools/SaldoDeLeads.jsx');
  assert.match(franja, /leads disponibles/);
  assert.match(franja, /de regalo/);
  assert.match(franja, /usados/);
  assert.match(franja, /comprados/);
  assert.match(franja, /Se acabaron los leads de regalo\. Hablá con tu coach para cargar más\./);
  assert.match(franja, /Una búsqueda de Google Maps necesita al menos \{MINIMO_LEADS_MAPS\}\./);
  assert.match(franja, /¿Cómo se descuentan\?/);
  // La casa no ve franja: su saldo no se mira.
  assert.match(sinComentarios(franja), /if \(s\.estado === 'sin_limite'\) return null;/);

  const panel = sinComentarios(codigo('components/fundaciones/PanelResearch.jsx'));
  assert.match(panel, /const saldo = await leerSaldo\(\);/);
  assert.match(panel, /Tenés \$\{mirada\.disponibles\} disponibles; después de esta mirada te quedarían al menos/);
});
