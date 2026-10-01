// Acquisition dibuja el front del prototipo, con sus clases y sin capas encima. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/acquisition/14, AQ-4)
//
// El 2026-09-30 la pestaña volvió al marcado de `aios-command-center_1.html`, con la estética al
// 100 %, y se llena con `embudosDeAcquisition`. Volver atrás es fácil sin darse cuenta: pegar
// `estetica-op` en la sección, olvidar un funnel, mostrar el selector a quien no puede asignar, o
// cambiar una frase de la lista cerrada sin pasar por el documento. Cada prueba dice cuál de esas cosas
// mira, y la mutación que la pone en rojo:
//
//   · la sección no lleva `estetica-op` — mutación: volver a ponerla;
//   · los tres funnels, con los rótulos del prototipo — mutación: sacar uno, o cambiar un rótulo;
//   · el orden de los bloques es el del prototipo — mutación: la nota debajo de las tarjetas;
//   · el selector sólo con permiso y sin mirar otra empresa — mutación: sacar cualquiera de las dos;
//   · las frases de los huecos son las de A14-02, en las dos direcciones — mutación: cambiar una;
//   · no vuelven el Plan de acción, «Personalizado», el segmentado de tasa ni `data-leads`;
//   · la ruta ya no calcula la tabla por anuncio ni el monitor;
//   · lo nuevo vive en `app/acquisition.css`, acotado, y nada de la estética de operación alcanza
//     a `#v-acquisition`.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = (t: string): string =>
  t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{\s*\}/g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const VISTA = 'components/views/AcquisitionView.jsx';
const PANEL = 'components/acquisition/PanelDeAcquisition.jsx';
const panel = () => sinComentarios(leer(PANEL));

/** El cuerpo de una función del panel, hasta la próxima función de primer nivel. */
function funcion(nombre: string): string {
  const t = panel();
  const i = t.search(new RegExp(`\\nfunction ${nombre}\\(|\\nexport default function ${nombre}\\(`));
  assert.notEqual(i, -1, `no está la función ${nombre} en el panel`);
  const j = t.slice(i + 1).search(/\n(export default )?function \w+\(/);
  return j === -1 ? t.slice(i) : t.slice(i, i + 1 + j);
}

test('la sección no lleva la estética de operación: el look es el del prototipo', () => {
  const vista = sinComentarios(leer(VISTA));
  assert.match(vista, /id="v-acquisition"/);
  assert.doesNotMatch(vista, /estetica-op/, 'volvió `estetica-op`: es la capa que había cambiado el look (A14-01)');
  assert.match(vista, /className="view-scroll cre-scroll"/, 'el contenedor del prototipo es `view-scroll cre-scroll`');
});

test('los tres funnels, con el nombre y los rótulos de etapa y de costo del prototipo', () => {
  /* Del prototipo y no de una copia en esta prueba: la referencia es el HTML. */
  const html = leer('aios-command-center_1.html');
  const bloque = html.slice(html.indexOf('const FUNNELS = {'), html.indexOf('const CAMPS'));
  const delPrototipo = (clave: string) => {
    const m = new RegExp(`${clave}: \\{ name:'([^']+)',[\\s\\S]*?labels:\\{([^}]*)\\},[\\s\\S]*?costs:\\{([^}]*)\\}`).exec(bloque);
    assert.ok(m, `no se encontró el funnel ${clave} en el prototipo`);
    const pares = (t: string) => Object.fromEntries([...t.matchAll(/(\w+):'([^']*)'/g)].map((x) => [x[1], x[2]]));
    return { nombre: m[1], rotulos: pares(m[2]!), costos: pares(m[3]!) };
  };

  const t = panel();
  const i = t.indexOf('const FUNNELS = {');
  const j = t.indexOf('const SIN_FUNNEL');
  assert.ok(i !== -1 && j > i, 'el panel no declara sus FUNNELS');
  const delPanel = t.slice(i, j);
  for (const clave of ['leadform', 'profile', 'booking']) {
    const p = delPrototipo(clave);
    const m = new RegExp(`${clave}: \\{\\s*nombre: '([^']+)',\\s*rotulos: \\{([^}]*)\\},\\s*costos: \\{([^}]*)\\}`).exec(delPanel);
    assert.ok(m, `falta el funnel ${clave} en el panel`);
    const pares = (x: string) => Object.fromEntries([...x.matchAll(/(\w+): '([^']*)'/g)].map((y) => [y[1], y[2]]));
    assert.deepEqual({ nombre: m[1], rotulos: pares(m[2]!), costos: pares(m[3]!) }, p, `${clave} no se rotula como en el prototipo`);
  }
  // Y las tres tarjetas se dibujan: la lista que se recorre tiene las tres claves, en el orden del prototipo.
  assert.match(t, /const CLAVES = \['leadform', 'profile', 'booking'\];/, 'falta un funnel, o cambió el orden');
  assert.match(funcion('Cuerpo'), /CLAVES\.map\(\(k\) => \(\s*<Tarjeta/, 'las tarjetas no recorren los tres funnels');
});

test('los bloques van en el orden del prototipo: encabezado, cifras, nota, tarjetas, tablas', () => {
  const principal = funcion('PanelDeAcquisition');
  assert.ok(principal.indexOf('className="cre-head"') < principal.indexOf('<Cuerpo'), 'el encabezado no va primero');
  const cuerpo = funcion('Cuerpo');
  const orden = ['<Cifras', '<Nota', 'className="acq-fgrid"', '<Tablas'].map((x) => cuerpo.indexOf(x));
  assert.ok(orden.every((x) => x !== -1), `falta un bloque: ${JSON.stringify(orden)}`);
  assert.deepEqual([...orden].sort((a, b) => a - b), orden, 'los bloques no van en el orden del prototipo');
  assert.match(funcion('Cifras'), /className="acq-kpis"/);
  assert.match(funcion('Nota'), /className="acq-note"/);
  // «Sin funnel» es la última tabla, después de los tres funnels (A14-14).
  assert.match(funcion('Tablas'), /\.\.\.CLAVES\.map[\s\S]*\{ k: 'sin_funnel'/, '«Sin funnel» no va al final');
});

test('el selector de funnel, sólo para quien puede asignar y nunca mirando otra empresa', () => {
  assert.match(
    funcion('Cuerpo'),
    /const puedeAsignar = Boolean\(p\.puedeAsignar && !sesion\?\.mirandoOtraOrganizacion\);/,
    'el permiso del selector no combina lo que dijo el servidor con la empresa que se mira',
  );
  const pie = funcion('Pie');
  assert.match(pie, /if \(!puedeAsignar \|\| !c\.conocida\) return estado;/, 'el selector se dibuja sin permiso, o para una campaña que no se puede asignar');
  assert.ok(pie.indexOf('return estado;') < pie.indexOf('<select'), 'la guarda tiene que ir antes del selector');
  assert.match(pie, /guardarFunnelDeLaCampana\(c\.campana, valor\)/);
  assert.match(pie, /sacarFunnelDeLaCampana\(c\.campana\)/);
});

test('las frases de los huecos son las de A14-02, ni una más ni una menos', () => {
  const t = panel();
  const bloque = t.slice(t.indexOf('const FRASE = {'), t.indexOf('};', t.indexOf('const FRASE = {')));
  const delPanel = [...bloque.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]!).sort();
  assert.ok(delPanel.length >= 8, 'no se leyeron las frases del panel');

  const doc = leer('docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md');
  const seccion = doc.slice(doc.indexOf('### A14-02'), doc.indexOf('### A14-03'));
  const delDoc = [...seccion.matchAll(/^\|[^|]+\|\s*«([^»]+)»\s*\|$/gm)].map((m) => m[1]!).sort();
  assert.deepEqual(delPanel, delDoc, 'la lista del panel y la de A14-02 no coinciden: una frase nueva entra primero al documento');
});

test('no vuelven el Plan de acción, «Personalizado», el segmentado de tasa ni `data-leads`', () => {
  const fuente = sinComentarios(leer(VISTA)) + panel();
  for (const [pieza, motivo] of [
    ['reco-btn', 'el «Plan de acción» es para los agentes de IA (A14-16)'],
    ['Plan de acción', 'el «Plan de acción» es para los agentes de IA (A14-16)'],
    ['Señales', '«Señales detectadas» es para los agentes de IA (A14-16)'],
    ['data-datepick', '«Personalizado» abría un rango que ninguna otra pantalla reproduce (A14-10)'],
    ['Personalizado', '«Personalizado» abría un rango que ninguna otra pantalla reproduce (A14-10)'],
    ['Paso a paso', 'el segmentado de tasa no cambia nada hoy y el usuario decidió no dibujarlo (A14-09)'],
    ['Acumulada', 'el segmentado de tasa no cambia nada hoy y el usuario decidió no dibujarlo (A14-09)'],
    ['data-leads', 'abría un cajón con personas inventadas (A14-15)'],
    ['PISO_DE_UNA_TASA', 'el navegador no calcula tasas: llegan del servidor (A14-17)'],
  ] as const) {
    assert.ok(!fuente.includes(pieza), `volvió \`${pieza}\`: ${motivo}`);
  }
});

test('la ruta ya no calcula la tabla por anuncio ni el monitor de atribución', () => {
  const ruta = sinComentarios(leer('app/api/acquisition/route.ts'));
  assert.doesNotMatch(ruta, /costoDelAnuncio|calidadDeLaAtribucion/, 'la ruta volvió a calcular lo de la pantalla anterior (A14-15)');
  // Y el monitor sigue dormido, no borrado: el usuario decidió guardarlo (2026-09-30).
  assert.match(leer('lib/negocio/calidadDeLaAtribucion.ts'), /export async function calidadDeLaAtribucion/);
});

test('lo nuevo vive en `app/acquisition.css`, acotado; nada de la estética de operación alcanza a la vista', () => {
  const globals = leer('app/globals.css');
  assert.match(globals, /@import "\.\/acquisition\.css" layer\(components\);/, 'la hoja no está importada en la capa `components`');
  const propia = sinComentarios(leer('app/acquisition.css'));
  const selectores = [...propia.matchAll(/([^{}@]+)\{/g)]
    .map((m) => m[1]!.trim())
    .filter((s) => s && !s.startsWith('media') && !/^\(max-width/.test(s));
  assert.ok(selectores.length > 5, 'no se leyeron los selectores de la hoja');
  for (const s of selectores) {
    for (const parte of s.split(',')) {
      assert.match(parte.trim(), /^#v-acquisition /, `\`${parte.trim()}\` no está acotado a #v-acquisition`);
    }
  }

  /* Ninguna otra hoja, fuera de la del prototipo, tiene una regla para la vista: cualquier regla de la
     estética que la nombre pisaría el look del prototipo. */
  for (const nombre of readdirSync(join(RAIZ, 'app')).filter((n) => n.endsWith('.css'))) {
    if (nombre === 'aios.css' || nombre === 'acquisition.css') continue;
    const t = sinComentarios(leer(`app/${nombre}`));
    assert.doesNotMatch(t, /#v-acquisition/, `app/${nombre} tiene una regla para #v-acquisition`);
  }
});
