// Sales dibuja el front del prototipo, con sus clases y sin capas encima. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, SA-3)
//
// El 2026-10-09 la pestaña volvió al marcado de `aios-command-center_1.html:2931-2995`, con la estética al 100 %,
// y se llena con `lecturaDeSales`. Volver atrás es fácil sin darse cuenta: pegar `estetica-op` en la sección,
// cambiar un rótulo, ordenar la tabla, escribir un cero donde va «—», calcular una tasa en el navegador o cambiar
// una frase de la lista cerrada sin pasar por el documento. Cada prueba dice cuál de esas cosas mira, y la
// mutación que la pone en rojo:
//
//   · la sección no lleva `estetica-op` y su envoltorio es el del prototipo — mutación: volver a ponerla;
//   · el encabezado es el del prototipo, sin «Plan de acción» ni «Personalizado» — mutación: cambiar la bajada;
//   · las cuatro cifras y las seis columnas llevan los rótulos del prototipo, en su orden — mutación: cambiar uno;
//   · cada cifra sale del lugar que le toca en `pantalla`, con su formato — mutación: intercambiar dos, o dibujar
//     una tasa con el formato de un conteo;
//   · los bloques van en el orden del prototipo, y debajo la cadena comercial — mutación: los motivos primero;
//   · las frases son las de S15-02, en las dos direcciones — mutación: cambiar una;
//   · cada motivo de una cifra sin valor tiene SU frase — mutación: una de más o de menos, o dos intercambiadas;
//   · la tabla no se ordena, no se filtra ni se recorta, en ningún lugar del panel — mutación: un `toSorted` o un
//     `slice`;
//   · no vuelven el plan, «Personalizado», la clave `mes`, los nombres de la maqueta ni «ICP alto asignado»;
//   · se multiplica por 100 en un solo lugar — mutación: un segundo `* 100`;
//   · sin párrafos: el panel no dibuja ningún aviso del servidor ni el texto de una ventana — mutación: volver a
//     dibujar la nota de la tabla;
//   · los motivos son las seis categorías del analizador y los eslabones los cinco del servidor, cada uno con su
//     rótulo — mutación: sacar una categoría;
//   · lo nuevo vive en `app/sales.css`, acotado, y ninguna otra hoja alcanza a la vista.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = (t: string): string =>
  t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{\s*\}/g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const VISTA = 'components/views/SalesView.jsx';
const PANEL = 'components/sales/PanelDeSales.jsx';
const COMUN = 'components/sales/comun.jsx';
const panel = () => sinComentarios(leer(PANEL));
const comun = () => sinComentarios(leer(COMUN));

/** El cuerpo de una función de un archivo, hasta la próxima función de primer nivel. */
function funcion(fuente: string, nombre: string): string {
  const i = fuente.search(new RegExp(`\\nfunction ${nombre}\\(|\\nexport (default )?function ${nombre}\\(`));
  assert.notEqual(i, -1, `no está la función ${nombre}`);
  const j = fuente.slice(i + 1).search(/\n(export (default )?)?function \w+\(/);
  return j === -1 ? fuente.slice(i) : fuente.slice(i, i + 1 + j);
}

/** El marcado de Sales en el prototipo. */
function prototipo(): string {
  const html = leer('aios-command-center_1.html');
  const i = html.indexOf('<section class="view" id="v-sales">');
  assert.notEqual(i, -1, 'no está la sección de Sales en el prototipo');
  return html.slice(i, html.indexOf('</section>', i));
}

test('la sección no lleva la estética de operación: el look es el del prototipo', () => {
  const vista = sinComentarios(leer(VISTA));
  assert.match(vista, /id="v-sales"/);
  assert.doesNotMatch(vista, /estetica-op/, 'volvió `estetica-op`: es la capa que había cambiado el look (S15-01)');
  assert.match(vista, /className=\{activa \? 'view on' : 'view'\}/);
  assert.match(vista, /className="view-scroll cre-scroll">\s*<PanelDeSales \/>/, 'el envoltorio del prototipo es `view-scroll cre-scroll`');
});

test('el encabezado es el del prototipo: el título, la bajada y en `.ch-r` sólo el segmentado', () => {
  const proto = prototipo();
  const bajada = /<span class="cre-desc">([^<]+)<\/span>/.exec(proto)?.[1];
  assert.equal(bajada, 'Cierre, closers y motivos de pérdida', 'cambió la bajada del prototipo');
  const cabeza = funcion(panel(), 'PanelDeSales');
  assert.match(cabeza, /<div className="cre-head">\s*<div className="ch-l">\s*<h2>Sales<\/h2>\s*<span className="cre-desc">([^<]+)<\/span>/);
  assert.equal(/<span className="cre-desc">([^<]+)<\/span>/.exec(cabeza)?.[1], bajada, 'la bajada no es la del prototipo (S15-03)');
  const derecha = cabeza.slice(cabeza.indexOf('<div className="ch-r">'), cabeza.indexOf('{error ?'));
  assert.match(derecha, /<div className="ch-period">\s*[\s\S]*<Periodos /);
  assert.doesNotMatch(derecha, /reco-btn|BotonDelPlan|className="pill"/, 'volvió algo al lado del segmentado: Sales no tiene plan (S15-03)');
  // El `title` de «Hoy» se conserva: acá las ventanas son rodantes y el matiz es cierto (S15-04).
  assert.match(funcion(panel(), 'Periodos'), /title=\{p\.matiz \?\? undefined\}/);
});

test('las cuatro cifras y las seis columnas llevan los rótulos del prototipo, en su orden', () => {
  const proto = prototipo();
  const delPrototipo = [...proto.matchAll(/<div class="s-l">([^<]+)<\/div>/g)].map((m) => m[1]!);
  assert.equal(delPrototipo.length, 4, 'no se leyeron las cuatro cifras del prototipo');
  const cuerpo = funcion(panel(), 'Cuerpo');
  const delPanel = [...cuerpo.matchAll(/<Cifra rotulo="([^"]+)"/g)].map((m) => m[1]!);
  assert.deepEqual(delPanel, delPrototipo, 'las cifras no llevan los rótulos del prototipo, o cambiaron de orden (S15-05 a S15-08)');

  const cabecera = /<div class="col-head"[^>]*>([\s\S]*?)<\/div>/.exec(proto)?.[1] ?? '';
  const columnas = [...cabecera.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]!);
  assert.equal(columnas.length, 6, 'no se leyeron las seis columnas del prototipo');
  const closers = funcion(panel(), 'Closers');
  const delPanelCol = [...closers.slice(closers.indexOf('col-head'), closers.indexOf('className="rows"')).matchAll(/<span role="columnheader">([^<]+)<\/span>/g)].map((m) => m[1]!);
  assert.deepEqual(delPanelCol, columnas, 'la tabla no lleva las columnas del prototipo (S15-09)');

  assert.match(proto, /<div class="card-head">Closers<\/div>/);
  assert.match(closers, /<div className="card-head">Closers<\/div>/);
  assert.match(proto, /<div class="card-head">Motivos de no venta <span class="hint">/);
  // El `hint` del prototipo, «56 llamadas sin cierre», con el número de verdad (S15-19).
  assert.match(proto, /<span class="hint">\d+ llamadas sin cierre<\/span>/);
  const motivos = funcion(panel(), 'Motivos');
  assert.match(motivos, /const hint = `\$\{miles\(m\.sinCierre\)\} \$\{m\.sinCierre === 1 \? 'llamada' : 'llamadas'\} sin cierre`;/, 'el `hint` no es «{N} llamadas sin cierre» (S15-19)');
  assert.match(motivos, /<div className="card-head">\s*Motivos de no venta <span className="hint">\{hint\}<\/span>/);
  assert.match(motivos, /nombre=\{MOTIVO_DE_LA_CATEGORIA\[f\.categoria\]\} n=\{f\.llamadas\} porcion=\{f\.porcion\}/, 'una fila no dibuja la categoría, las llamadas o la porción del servidor');
});

test('cada cifra y cada columna sale del lugar que le toca en `pantalla`', () => {
  const cuerpo = funcion(panel(), 'Cuerpo');
  assert.match(cuerpo, /const \{ cifras, closers, motivos, comercial \} = p\.pantalla;/);
  for (const [rotulo, clave, formato] of [
    ['Asistencias', 'asistencias', 'miles'],
    ['Tasa de cierre', 'tasaDeCierre', 'pf'],
    ['Ventas', 'ventas', 'miles'],
    ['Revenue reportado', 'revenue', 'plata'],
  ]) {
    assert.match(
      cuerpo,
      new RegExp(`<Cifra rotulo="${rotulo}" c=\\{cifras\\.${clave}\\} formato=\\{${formato}\\}`),
      `«${rotulo}» no dibuja \`cifras.${clave}\` con \`${formato}\``,
    );
  }
  const filas = funcion(panel(), 'Closers');
  const orden = [
    'o(f.agendadas, miles)',
    '<Celda c={f.asistieron} formato={miles} />',
    '<Celda c={f.ventas} formato={miles} />',
    '<Celda c={f.cierre} formato={pf} />',
    '<Celda c={f.revenue} formato={plata} rev />',
  ].map((x) => filas.indexOf(x));
  assert.ok(orden.every((x) => x !== -1), `falta una columna, o cambió su formato: ${JSON.stringify(orden)}`);
  assert.deepEqual([...orden].sort((a, b) => a - b), orden, 'las columnas cambiaron de orden');
  // La cancelación, con el decimal con que la publica `tasaDeCancelacion` y la dibuja Conversation.
  assert.match(funcion(panel(), 'LaCadenaComercial'), /<Stat rotulo="Cancelación" valor=\{o\(c\.cancelacion\.tasa, pf1\)\}/);
  assert.match(filas, /`\$\{miles\(f\.contactos\)\} contactos asignados`/, 'la subfila no es «{N} contactos asignados» (S15-02)');
});

test('los bloques van en el orden del prototipo, y debajo la cadena comercial', () => {
  const t = panel();
  const principal = funcion(t, 'PanelDeSales');
  assert.ok(principal.indexOf('className="cre-head"') < principal.indexOf('<Cuerpo'), 'el encabezado no va primero');
  const cuerpo = funcion(t, 'Cuerpo');
  assert.ok(!cuerpo.includes('className="cre-head"'), 'el encabezado se mudó al cuerpo: se reiniciaría con cada período');
  const orden = ['className="grid-4"', '<Closers', '<Motivos', '<LaCadenaComercial'].map((x) => cuerpo.indexOf(x));
  assert.ok(orden.every((x) => x !== -1), `falta un bloque: ${JSON.stringify(orden)}`);
  assert.deepEqual([...orden].sort((a, b) => a - b), orden, 'los bloques no van en el orden del prototipo (S15-12)');
  assert.match(funcion(t, 'Cifra'), /<div className="card">\s*<Stat /);
  assert.match(funcion(t, 'Stat'), /<div className="card-body stat">\s*<div className="s-l">\{rotulo\}<\/div>/);
  // La tarjeta de abajo, en cifras: las dos filas con el mismo vocabulario (S15-20).
  assert.match(funcion(t, 'LaCadenaComercial'), /<div className="sl-cifras sl-cinco">[\s\S]*<div className="sl-cifras sl-tres">/);
  assert.match(funcion(t, 'FilaDeMotivo'), /<div className="mini-bar">/);
});

test('las frases son las de S15-02, ni una más ni una menos', () => {
  const c = comun();
  const bloque = c.slice(c.indexOf('export const FRASE = {'), c.indexOf('};', c.indexOf('export const FRASE = {')));
  const delPanel = [...bloque.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]!).sort();
  assert.ok(delPanel.length >= 10, 'no se leyeron las frases del panel');

  const doc = leer('docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md');
  const seccion = doc.slice(doc.indexOf('### S15-02'), doc.indexOf('**Los desvíos de rótulo'));
  const delDoc = [...seccion.matchAll(/^\|[^|]+\|\s*«([^»]+)»\s*\|$/gm)].map((m) => m[1]!).sort();
  assert.deepEqual(delPanel, delDoc, 'la lista del panel y la de S15-02 no coinciden: una frase nueva entra primero al documento');
});

test('cada motivo de una cifra sin valor tiene SU frase, y son los del servidor', () => {
  const tipo = /export type MotivoDeLaCifra =([^;]+);/.exec(leer('lib/negocio/lecturaDeSales.ts'))?.[1] ?? '';
  const delServidor = [...tipo.matchAll(/'(\w+)'/g)].map((m) => m[1]!).sort();
  assert.equal(delServidor.length, 6, 'no se leyeron los motivos del servidor');
  const c = comun();
  const frases = c.slice(c.indexOf('export const FRASE = {'), c.indexOf('};', c.indexOf('export const FRASE = {')));
  const texto = Object.fromEntries([...frases.matchAll(/(\w+): '([^']+)'/g)].map((m) => [m[1], m[2]]));
  const bloque = c.slice(c.indexOf('export const FRASE_DEL_MOTIVO = {'), c.indexOf('};', c.indexOf('export const FRASE_DEL_MOTIVO = {')));
  const mapa = Object.fromEntries([...bloque.matchAll(/(\w+): FRASE\.(\w+)/g)].map((m) => [m[1], texto[m[2]!]]));
  assert.deepEqual(Object.keys(mapa).sort(), delServidor);
  /* Y cada uno con la frase de su situación en S15-02: dos frases intercambiadas pasarían una comparación de
     conjuntos y dirían «Pocos intentos» de una ventana sin un solo registro. */
  assert.deepEqual(mapa, {
    sin_closers: 'Sin closers configurados.',
    sin_citas: 'Sin citas en esta ventana.',
    sin_asistencia: 'Nadie marca la asistencia.',
    sin_registros: 'Nadie registró en esta ventana.',
    bajo_el_piso: 'Pocos intentos para una tasa.',
    venta_sin_monto: 'Hay ventas sin monto.',
  });
  assert.match(funcion(panel(), 'Celda'), /c\.valor === null \? \(FRASE_DEL_MOTIVO\[c\.motivo\] \?\? undefined\) : undefined/, 'la celda no dice el motivo de su «—»');
  // El color del revenue, sólo con un monto: un «—» va como los demás.
  assert.match(funcion(panel(), 'Celda'), /className=\{rev && c\.valor !== null \? 'num rev' : 'num'\}/, 'el «—» del revenue lleva el color de un monto');
  // Sin la nota de cada closer, ni a la vista ni en un `title`: la da el agente de Sales (S15-18).
  assert.doesNotMatch(funcion(panel(), 'Closers'), /aviso/, 'volvió la nota de la tabla o la de una fila');
  // Una cifra sin valor dice «—» y su motivo; la del revenue, con valor, «reportado por el closer».
  assert.match(funcion(panel(), 'Cifra'), /c\.valor === null \? \(FRASE_DEL_MOTIVO\[c\.motivo\] \?\? null\) : esRevenue \? FRASE\.reportado : null/);
});

test('la tabla no ordena, filtra ni recorta a nadie, y los motivos van en el orden del servidor', () => {
  /* En todo el panel y no sólo en las dos tarjetas: `Cuerpo` podría ordenar las filas antes de pasarlas. */
  assert.doesNotMatch(panel(), /\.(sort|toSorted|filter|reverse|toReversed|slice|splice)\(/, 'el panel reordena, filtra o recorta lo que llega (S15-09, S15-11)');
});

test('no vuelven el plan, «Personalizado», la clave `mes`, las cifras de la maqueta ni la regla de ICP', () => {
  const fuente = sinComentarios(leer(VISTA)) + panel() + comun();
  for (const [pieza, motivo] of [
    ['slPlanBtn', 'Sales no tiene detector, y el botón no abría nada (S15-03)'],
    ['Plan de acción', 'Sales no tiene detector (S15-03)'],
    ['Personalizado', '«Personalizado» abría un rango que ninguna otra pantalla reproduce (S15-03)'],
    ['data-datepick', '«Personalizado» (S15-03)'],
    ["data-p=\"mes\"", 'la clave `mes` no es un período (S15-04)'],
    ['ICP alto asignado', 'la asignación por ICP no existe (S15-02)'],
    ['ICP medio', 'la asignación por ICP no existe (S15-02)'],
    ['55,200', 'una cifra de la maqueta'],
    ['Sin necesidad clara', 'no es una categoría del analizador (S15-19)'],
    ['Pidió tiempo', 'no es una categoría del analizador (S15-19)'],
    ['data-leads', 'abría un cajón con personas inventadas (S15-15)'],
    ['detalle', 'el texto libre de un resultado no se dibuja (S15-15)'],
    ['PISO_DE_UNA_TASA', 'el navegador no calcula tasas: llegan del servidor (S15-13)'],
    ['estetica-op', 'es la capa que había cambiado el look (S15-01)'],
  ] as const) {
    assert.ok(!fuente.includes(pieza), `volvió \`${pieza}\`: ${motivo}`);
  }
});

test('el navegador no calcula: se multiplica por 100 en un solo lugar', () => {
  const todo = panel() + comun();
  assert.equal([...todo.matchAll(/\*\s*100\b/g)].length, 1, 'hay otra multiplicación por 100: todo viaja de 0 a 1 y se convierte una vez (S15-13)');
  assert.match(comun(), /export const cien = \(v, d = 0\) => Math\.round\(v \* 100 \* 10 \*\* d\) \/ 10 \*\* d;/);
  /* Ninguna división: las porciones llegan hechas. Sin las líneas de `import`, cuyas rutas tienen barras, y con
     o sin espacios alrededor. */
  const sinImports = panel().replace(/^import .*$/gm, '');
  assert.doesNotMatch(sinImports, /[\w)\]]\s*\/\s*[\w(]/, 'el panel divide: una porción se calculó en el navegador');
});

/** Las partes de un selector agrupado, partiendo sólo en las comas de afuera de los paréntesis. */
function partes(selector: string): string[] {
  const salida: string[] = [];
  let hondo = 0;
  let actual = '';
  for (const ch of selector) {
    if (ch === '(') hondo += 1;
    if (ch === ')') hondo -= 1;
    if (ch === ',' && hondo === 0) {
      salida.push(actual.trim());
      actual = '';
    } else actual += ch;
  }
  return [...salida, actual.trim()];
}

test('lo nuevo vive en `app/sales.css`, acotado; ninguna otra hoja alcanza a la vista', () => {
  const globals = leer('app/globals.css');
  assert.match(globals, /@import "\.\/sales\.css" layer\(components\);/, 'la hoja no está importada en la capa `components`');
  const propia = sinComentarios(leer('app/sales.css'));
  const selectores = [...propia.matchAll(/([^{}@]+)\{/g)]
    .map((m) => m[1]!.trim())
    .filter((s) => s && !s.startsWith('media') && !/^\(max-width/.test(s));
  assert.ok(selectores.length > 10, 'no se leyeron los selectores de la hoja');
  for (const s of selectores) {
    for (const parte of partes(s)) assert.match(parte, /^#v-sales /, `\`${parte}\` no está acotado a #v-sales`);
  }
  // El color del revenue, por una clase y no en línea (S15-08).
  assert.match(propia, /#v-sales \.stat \.s-v\.sl-rev \{ color: var\(--exec\); \}/);
  assert.doesNotMatch(panel(), /style=\{\{ color/, 'un color en línea: va por una clase de `app/sales.css`');

  /* Ninguna otra hoja, fuera de la del prototipo, tiene una regla para la vista: ni la estética de operación ni
     la de Inteligencia, que la repintaban. */
  for (const nombre of readdirSync(join(RAIZ, 'app')).filter((n) => n.endsWith('.css'))) {
    if (nombre === 'aios.css' || nombre === 'sales.css') continue;
    assert.doesNotMatch(sinComentarios(leer(`app/${nombre}`)), /#v-sales\b/, `app/${nombre} tiene una regla para #v-sales`);
  }
});

test('sin párrafos: el panel no dibuja avisos del servidor ni el texto de una ventana (S15-18)', () => {
  const t = panel();
  assert.doesNotMatch(t, /\.aviso\b|avisoDelTecho|\.falta\b|\.que\b|ventanas/, 'el panel volvió a dibujar un aviso, un motivo largo o el texto de una ventana');
  // Debajo de una cifra, una sola línea: la de la lista cerrada o un porcentaje.
  assert.match(funcion(t, 'Stat'), /\{debajo \? <div className="sl-motivo">\{debajo\}<\/div> : null\}/);
  assert.equal([...funcion(t, 'Stat').matchAll(/sl-motivo/g)].length, 1, 'una cifra lleva más de una línea debajo');
});

test('los motivos son las seis categorías del analizador, y los eslabones los cinco del servidor', () => {
  const c = comun();
  const claves = (nombre: string): string[] => {
    const i = c.indexOf(`export const ${nombre} = {`);
    assert.notEqual(i, -1, `no está ${nombre}`);
    return [...c.slice(i, c.indexOf('};', i)).matchAll(/(\w+): '[^']+'/g)].map((m) => m[1]!);
  };
  const categorias = /CATEGORIAS_DE_OBJECION = \[([^\]]+)\]/.exec(leer('lib/analizadores/categorias.ts'))?.[1] ?? '';
  assert.deepEqual(claves('MOTIVO_DE_LA_CATEGORIA'), [...categorias.matchAll(/'(\w+)'/g)].map((m) => m[1]!), 'una categoría del analizador no tiene rótulo, o sobra uno');
  const eslabones = /export const ESLABONES = \[([^\]]+)\]/.exec(leer('lib/negocio/cadenaDeCierre.ts'))?.[1] ?? '';
  assert.deepEqual(claves('ESLABON'), [...eslabones.matchAll(/'(\w+)'/g)].map((m) => m[1]!), 'un eslabón del servidor no tiene rótulo, o sobra uno');
  // Tres de las categorías son los motivos del prototipo, con sus palabras.
  const proto = prototipo();
  for (const motivo of ['Precio', 'No es quien decide']) assert.ok(proto.includes(`<div class="rn">${motivo}</div>`), `«${motivo}» no está en el prototipo`);
  assert.match(c, /precio: 'Precio',/);
  assert.match(c, /decisor: 'No es quien decide',/);
});

test('la tarjeta de abajo: cada «—» con su línea, y el cobrado con la del mes y no la de la ventana (S15-20)', () => {
  const c = funcion(panel(), 'LaCadenaComercial');
  assert.match(c, /debajo=\{c\.cancelacion\.tasa === null \? FRASE\.sinCitas : null\}/, 'la cancelación sin citas no dice por qué');
  assert.match(c, /debajo=\{c\.ciclo\.p50 === null \? FRASE\.pocosContactos : null\}/, 'la mediana bajo el piso no dice por qué');
  assert.match(c, /const cobradoFalta = sinClosers \? FRASE\.sinClosers : FRASE\.sinRegistrosDelMes;/, 'el cobrado es del mes, no de la ventana');
  assert.match(c, /debajo=\{dinero\.cobrado\.valor === null \? cobradoFalta : FRASE\.reportado\}/, 'el cobrado no dice «reportado por el closer»');
  assert.match(c, /rotulo=\{ESLABON\[e\.clave\]\}\s*valor=\{miles\(e\.contactos\)\}/, 'un eslabón no dibuja su cifra del servidor');
});
