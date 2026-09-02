// Las dos formas de descubrir anunciantes en la pestaña Facebook. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE PERSIGUE ACÁ, Y POR QUÉ NINGUNO DE ESTOS DEFECTOS SE VE
//
// La pestaña ofrece dos caminos hasta lo mismo —pegar la URL de la Ad Library, o buscar por
// nicho— y un solo paso 2 que le saca teléfono, email y web a las páginas descubiertas. Ese paso 2
// **lanza un actor de Apify que se cobra aunque procese cero**, y de ahí salen los modos de falla:
//
//   · Mandarle un anunciante sin `page_profile_uri` es pagar una corrida para procesar una página
//     que no existe. El actor no falla: devuelve nada.
//   · No agrupar los anuncios por página manda la MISMA página diez veces. El backend deduplica
//     antes de llamar al actor, así que tampoco falla: solo deja a la pantalla diciendo «300
//     páginas» cuando son cuarenta, y a quien elige eligiendo diez veces al mismo.
//   · Duplicar el paso 2 —uno por columna— es duplicar la única operación que gasta. El día que
//     uno se corrija, el otro sigue con el defecto y nadie lo nota, porque los dos «andan».
//
// No toca la base ni llama a ningún actor: ejercita el agrupador y lee la pantalla.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ } from '../apoyo/fuente.ts';
import {
  ANUNCIOS_PARA_ESPIAR,
  ANUNCIOS_PARA_PROSPECTAR,
  anunciantesDe,
  type AnuncioEspiado,
} from '../../lib/tools/scrapers.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
/** Sin comentarios: la lección de `110-monitoreo`, ya pagada dos veces en este repositorio. */
const codigo = (r: string): string =>
  leer(r).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const anuncio = (uri: string, dias: number, nombre = 'Anunciante'): AnuncioEspiado => ({
  ad_archive_id: `${uri}-${dias}`,
  page_name: nombre,
  page_id: 'p1',
  page_profile_uri: uri,
  days_active: dias,
});

// ─── El agrupador ──────────────────────────────────────────────────────────

test('los anuncios se agrupan por PÁGINA, no por anuncio ni por nombre', () => {
  /* Una búsqueda devuelve anuncios y el paso 2 procesa páginas. Un anunciante que va en serio tiene
     varios corriendo: sin agrupar, la pantalla ofrece diez veces al mismo. */
  const lista = anunciantesDe([
    anuncio('https://facebook.com/vera', 200, 'Clínica Vera'),
    anuncio('https://facebook.com/vera', 40, 'Clínica Vera'),
    anuncio('https://facebook.com/growth', 90, 'Growth Partners'),
  ]);

  assert.equal(lista.length, 2, 'no agrupó: dos anuncios de la misma página son dos filas');
  const vera = lista.find((a) => a.page_profile_uri.endsWith('/vera'))!;
  assert.equal(vera.anuncios, 2);
  // El más viejo manda: es la señal por la que se elige a quién procesar.
  assert.equal(vera.diasMax, 200, 'la longevidad no es la del anuncio más viejo');

  /* Se agrupa por URL y NO por nombre: dos páginas distintas pueden llamarse igual, y una misma
     página puede cambiarse el nombre entre un anuncio y otro. */
  const mismoNombre = anunciantesDe([
    anuncio('https://facebook.com/uno', 10, 'Marketing Studio'),
    anuncio('https://facebook.com/dos', 10, 'Marketing Studio'),
  ]);
  assert.equal(mismoNombre.length, 2, 'agrupó dos páginas distintas por tener el mismo nombre');
});

test('los anunciantes se ordenan por longevidad, y los que no se pueden procesar van al final', () => {
  const lista = anunciantesDe([
    anuncio('', 500, 'Sin página'),
    anuncio('https://facebook.com/nuevo', 12, 'Nuevo'),
    anuncio('https://facebook.com/viejo', 300, 'Viejo'),
  ]);

  assert.deepEqual(
    lista.map((a) => a.page_name),
    ['Viejo', 'Nuevo', 'Sin página'],
    'el orden no pone primero al que lleva más tiempo corriendo, ni último al que no se puede procesar',
  );
});

test('el anunciante sin URL NO se descarta: se cuenta y se muestra', () => {
  /* Descartarlo en silencio haría que la lista mostrara menos anunciantes de los que la búsqueda
     encontró, sin decir por qué. Y el motivo importa: puede ser un anuncio suelto sin página
     resuelta, o un backend viejo —`build_ad_spy_items` tiró `page_profile_uri` hasta el 2026-09-02—,
     y en el segundo caso la lista entera saldría sin URL. Verlo es lo que permite diagnosticarlo. */
  const lista = anunciantesDe([anuncio('', 5, 'Uno'), anuncio('', 9, 'Otro')]);
  assert.equal(lista.length, 2, 'los anuncios sin página se agruparon entre sí o se descartaron');
  assert.ok(lista.every((a) => a.page_profile_uri === ''));
});

test('las dos búsquedas piden cantidades distintas, y la de prospección es la de siempre', () => {
  /* Espiar es mirar sesenta tarjetas; prospectar es cosechar anunciantes. Y el número de
     prospección es el que el paso 1 clásico usa desde siempre (`facebook_ads_scraper` lo tiene
     escrito): si los dos caminos de la pestaña trajeran cantidades distintas, cambiar de camino
     cambiaría lo que se paga y lo que se encuentra sin que nadie lo pida. */
  assert.equal(ANUNCIOS_PARA_ESPIAR, 60);
  assert.equal(ANUNCIOS_PARA_PROSPECTAR, 1000);
});

// ─── La pantalla ───────────────────────────────────────────────────────────

test('el paso 2 es UNO solo para las dos opciones', () => {
  const scraper = codigo('components/tools/Scraper.jsx');
  const cuantos = (scraper.match(/useTrabajo\('facebook-pages'/g) || []).length;
  assert.equal(
    cuantos,
    1,
    'hay más de un paso 2: es la única operación que gasta, y duplicarla es duplicar el defecto ' +
      'que se corrija en uno solo de los dos',
  );
  // Y las dos formas de descubrir, cada una la suya.
  assert.match(scraper, /useTrabajo\('facebook-ads'/);
  assert.match(scraper, /useTrabajo\('ad-spy'/);
});

test('al paso 2 solo van anunciantes CON página', () => {
  /* El actor `apify/facebook-pages-scraper` no acepta otra cosa que la URL de la página. Mandarle
     una vacía es pagar una corrida para procesar cero — y no falla: devuelve nada. */
  const scraper = codigo('components/tools/Scraper.jsx');
  assert.match(
    scraper,
    /const procesables = useMemo\(\s*\(\) => anunciantes\.filter\(\(a\) => a\.page_profile_uri !== ''\)/,
    'la lista que alimenta el paso 2 no filtra a los que no tienen página',
  );
  // Lo que se manda son los MARCADOS, que salen de los procesables.
  assert.match(scraper, /pages: marcados\.map\(/);
  assert.match(scraper, /const marcados = procesables\.filter\(/);
});

test('el buscador y la tarjeta son los MISMOS que los del Espía de Tools', () => {
  /* Duplicarlos sería la lista paralela con forma de formulario: la pantalla en la que alguien
     agregue un país o corrija el marcador queda distinta de la otra, y las dos siguen llamando al
     mismo actor de Apify. */
  for (const pantalla of ['components/tools/Scraper.jsx', 'components/tools/EspiaDeAnuncios.jsx']) {
    const fuente = codigo(pantalla);
    assert.match(fuente, /from '\.\/anuncios'/, `${pantalla} no usa las piezas compartidas`);
    assert.ok(
      !/Meta Ad Library<\/option>/.test(fuente),
      `${pantalla} dibuja su propio selector de fuente: son dos copias del mismo buscador`,
    );
  }
});

test('las dos opciones no pueden dispararse a la vez', () => {
  /* Son dos corridas del mismo actor sobre la misma pestaña, y la segunda pisaría la lista de la
     primera con la corrida ya pagada. Cada botón se apaga mientras la otra opción trabaja. */
  const scraper = codigo('components/tools/Scraper.jsx');
  assert.match(scraper, /disabled=\{porUrl\.ocupado \|\| porNicho\.ocupado\}/);
  assert.match(scraper, /ocupado=\{porNicho\.ocupado \|\| porUrl\.ocupado\}/);
});
