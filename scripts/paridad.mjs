/* Compara la app contra el prototipo original aios-command-center_1.html.
 *
 *   npm run dev            # en otra terminal
 *   npm run paridad
 *
 * Sirve para reactificar vistas sin romper nada: reescribe un módulo de
 * lib/aios/ como componente React y vuelve a pasar esto. Comprueba tres
 * cosas por vista — forma del DOM, texto e geometría — y luego recorre las
 * capas que sólo aparecen al interactuar.
 *
 * Ruido conocido: los cuatro `circle.pulse` del mapa ejecutivo se mueven
 * por una animación SVG, así que su posición nunca coincide.
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';

const ORIGINAL = 'aios-command-center_1.html';
const DESTINO = process.env.PARIDAD_URL || 'http://localhost:3000/';

const VISTAS = ['executive', 'acquisition', 'creative', 'conversion', 'conversation',
                'sales', 'icp', 'contacts', 'setter', 'closer'];

/* Cada paso deja la página lista para el siguiente, así que el orden importa. */
const PASOS = [
  ['calendario',           p => p.click('#v-creative [data-datepick]'),          '.dp.on'],
  ['calendario · 7 días',  async p => { await p.click('.dp-side button[data-q="2"]');
                                        await p.click('.dp-f .go'); },           '#v-creative .cre-stats'],
  ['drawer de contenido',  p => p.click('#v-creative .cc[data-cre]'),            '#drawer.on'],
  ['plan de Creative',     async p => { await p.click('#dwClose');
                                        await p.click('#recoBtn'); },            '#recoModal.on'],
  ['plan de Acquisition',  async p => { await p.click('#recoClose');
                                        await p.click('.nav-item[data-view="acquisition"]');
                                        await p.click('#acqPlanBtn'); },         '#recoModal.on'],
  ['ficha de lead',        async p => { await p.click('#recoClose');
                                        await p.click('.nav-item[data-view="contacts"]');
                                        await p.click('#v-contacts .lc'); },     '#drawer.on'],
  ['grupo de contactos',   async p => { await p.click('#dwClose');
                                        await p.click('#v-contacts [data-leads]'); }, '.lg.on'],
  ['closer · Mi Día',      async p => { await p.keyboard.press('Escape');
                                        await p.click('.nav-item[data-view="closer"]');
                                        await p.click('#clNav button[data-c="dia"]'); }, '#clDia'],
  ['contacto del closer',  p => p.click('#clDia .md-r'),                         '.cw.on'],
  ['pestañas del contacto',p => p.click('#cwTabs button:nth-child(2)'),          '#cwBody'],
  ['Ask Executive',        async p => { await p.keyboard.press('Escape');
                                        await p.click('#askTrigger'); },         '.ask-panel.on'],
  ['menú de usuario',      async p => { await p.keyboard.press('Escape');
                                        await p.click('#userBtn'); },            '#userWrap.open'],
  ['funnel ejecutivo',     async p => { await p.keyboard.press('Escape');
                                        await p.click('.nav-item[data-view="executive"]');
                                        await p.click('#exMode button[data-m="funnel"]'); }, '#exFunnel'],
  ['nodo del organigrama', async p => { await p.click('#exMode button[data-m="map"]');
                                        await p.click('#deptGraph .node-card'); }, '.view.on'],
];

/* tag + id + clases de cada descendiente, en orden de documento */
function forma(raiz) {
  const out = [];
  (function walk(n) {
    for (const c of n.children) {
      const tag = c.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'link') continue;
      const cls = typeof c.className === 'string' ? c.className : (c.className.baseVal || '');
      out.push(tag + (c.id ? '#' + c.id : '') +
        (cls.trim() ? '.' + cls.trim().split(/\s+/).sort().join('.') : ''));
      walk(c);
    }
  })(raiz);
  return out;
}

function cajas(raiz) {
  const out = [];
  (function walk(n) {
    for (const c of n.children) {
      const r = c.getBoundingClientRect();
      out.push([c.tagName, Math.round(r.x), Math.round(r.y),
                Math.round(r.width), Math.round(r.height)].join(','));
      walk(c);
    }
  })(raiz);
  return out;
}

async function recorrer(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.setDefaultTimeout(6000);
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const vistas = {};
  for (const v of VISTAS) {
    await page.click(`.nav-item[data-view="${v}"]`);
    await page.waitForTimeout(450);
    vistas[v] = {
      forma: await page.$eval(`#v-${v}`, forma),
      texto: await page.$eval(`#v-${v}`, e => e.innerText.replace(/\s+/g, ' ').trim()),
      cajas: await page.$eval(`#v-${v}`, cajas),
    };
  }

  await page.click('.nav-item[data-view="creative"]');
  await page.waitForTimeout(450);

  const pasos = {};
  for (const [nombre, accion, testigo] of PASOS) {
    try {
      await accion(page);
      await page.waitForTimeout(550);
      pasos[nombre] = {
        abre: await page.$eval(testigo, e => getComputedStyle(e).display !== 'none'),
        texto: await page.$eval(testigo, e => e.innerText.replace(/\s+/g, ' ').trim()),
      };
    } catch (e) {
      pasos[nombre] = { abre: false, error: e.message.split('\n')[0].slice(0, 90) };
    }
  }

  await page.close();
  return { vistas, pasos, errores: [...new Set(errores)] };
}

if (!existsSync(ORIGINAL)) {
  console.error(`No encuentro ${ORIGINAL}: es la referencia contra la que se compara.`);
  process.exit(1);
}

const browser = await chromium.launch();
const orig = await recorrer(browser, pathToFileURL(ORIGINAL).href);
const port = await recorrer(browser, DESTINO);
await browser.close();

let fallos = 0;

console.log('\nVISTAS');
for (const v of VISTAS) {
  const a = orig.vistas[v], b = port.vistas[v];
  const mal = [];
  if (a.forma.join('\n') !== b.forma.join('\n')) mal.push('DOM');
  if (a.texto !== b.texto) mal.push('texto');
  /* los puntos animados del mapa no pueden coincidir: se descuentan.
     ojo, tagName en SVG llega en minúscula, al revés que en HTML */
  const cajasMal = a.cajas.filter((x, i) => x !== b.cajas[i] && !/^circle,/i.test(x));
  if (cajasMal.length) mal.push(`geometría (${cajasMal.length})`);

  if (!mal.length) { console.log(`  ✓ ${v.padEnd(13)} ${a.forma.length} nodos`); continue; }
  fallos++;
  console.log(`  ✗ ${v.padEnd(13)} ${mal.join(' · ')}`);
  const i = a.forma.findIndex((x, k) => x !== b.forma[k]);
  if (i >= 0) console.log(`      nodo #${i}\n        original: ${a.forma[i]}\n        app:      ${b.forma[i]}`);
  if (a.texto !== b.texto) {
    let j = 0; while (j < a.texto.length && a.texto[j] === b.texto[j]) j++;
    console.log(`      texto diverge en ${j}\n        original: …${a.texto.slice(j, j + 110)}\n        app:      …${b.texto.slice(j, j + 110)}`);
  }
  cajasMal.slice(0, 3).forEach(x => {
    const k = a.cajas.indexOf(x);
    console.log(`      caja #${k}\n        original: ${x}\n        app:      ${b.cajas[k]}`);
  });
}

console.log('\nINTERACCIONES');
for (const [nombre] of PASOS) {
  const a = orig.pasos[nombre], b = port.pasos[nombre];
  const igual = a.abre === b.abre && a.texto === b.texto;
  if (!igual) fallos++;
  const nota = x => x.abre ? 'abre' : (x.error ? `NO — ${x.error}` : 'NO');
  console.log(`  ${igual ? '✓' : '✗'} ${nombre.padEnd(22)} original: ${nota(a).padEnd(28)} app: ${nota(b)}`);
  if (!igual && a.texto !== b.texto) {
    console.log(`      original: ${(a.texto || '').slice(0, 130)}`);
    console.log(`      app:      ${(b.texto || '').slice(0, 130)}`);
  }
}

for (const [etq, r] of [['original', orig], ['app', port]]) {
  if (r.errores.length) {
    console.log(`\nERRORES DE CONSOLA (${etq})`);
    r.errores.slice(0, 10).forEach(e => console.log('  ' + e));
  }
}

console.log(fallos ? `\n${fallos} diferencia(s).` : '\nParidad completa con el prototipo.');
process.exit(fallos ? 1 : 0);
