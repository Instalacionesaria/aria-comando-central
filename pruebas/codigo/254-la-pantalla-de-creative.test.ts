// Creative dibuja el front del prototipo, con sus clases y sin capas encima. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, CF-3)
//
// El 2026-10-11 la pestaña volvió al marcado de `aios-command-center_1.html:2746-2804`, con la estética al 100 %, y se
// llena con `lecturaDeCreative`. Volver atrás es fácil sin darse cuenta: pegar `estetica-op` en la sección, cambiar un
// rótulo, escribir un cero donde va «—», partir la biblioteca en el navegador, dibujar otra vez un párrafo o cambiar
// una frase de la lista cerrada sin pasar por el documento. Cada prueba dice cuál de esas cosas mira, y la mutación
// que la pone en rojo:
//
//   · la sección no lleva `estetica-op` y su envoltorio es el del prototipo — mutación: volver a ponerla;
//   · el encabezado es el del prototipo, con el plan real y el segmentado — mutación: cambiar la bajada;
//   · la tira, el orden y la tarjeta llevan los rótulos del prototipo, con los desvíos declarados — mutación: cambiar
//     uno, o intercambiar dos cifras;
//   · los grupos y su orden son los del servidor, para el criterio elegido — mutación: leer otro grupo;
//   · las frases son las de CF1-02, en las dos direcciones, y cada motivo del servidor tiene la suya — mutación:
//     cambiar una, o intercambiar dos;
//   · las etapas, los estados y los criterios son los del servidor — mutación: sacar uno;
//   · la miniatura no manda el `referrer`, carga perezosa y, si falla, cae al fondo — mutación: sacar una de las tres;
//   · la ficha es el cajón del prototipo, en un portal, con sus secciones en orden — mutación: mover una; y la ficha
//     y la tarjeta dicen el nombre y el cliente, nunca la `clave` (el nivel 3) — mutación: dibujar la clave;
//   · no vuelven «Personalizado», la clave `mes`, la curva, el guion ni los nombres de la maqueta;
//   · la carga: la última lectura gana, la recarga no pisa a la primera y la primera se apaga;
//   · se multiplica por 100 en un solo lugar, y el panel no divide ni ordena;
//   · sin párrafos: el panel no dibuja la cobertura, los avisos ni lo que falta para medir;
//   · lo nuevo vive en `app/creative.css`, acotado, y la estética de Inteligencia ya no existe;
//   · los formatos, ejecutados: un cero es un cero, una tasa chica lleva su decimal, el mes es el que es (CF-4);
//   · el teclado: el menú cerrado no se alcanza, el foco vuelve, la ficha lo retiene (CF-4).
//
// La revisión de CF-4 encontró 43 mutaciones vivas en el panel, la ficha y los formatos: las pruebas de abajo del todo
// las cierran, y varias de arriba se apretaron (los períodos, el grupo, la fila de abajo, los oyentes del menú).
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { RAIZ } from '../apoyo/fuente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = (t: string): string =>
  t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{\s*\}/g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const VISTA = 'components/views/CreativeView.jsx';
const PANEL = 'components/creative/PanelDeCreative.jsx';
const FICHA = 'components/creative/FichaDelCreativo.jsx';
const MINIATURA = 'components/creative/Miniatura.jsx';
const COMUN = 'components/creative/comun.jsx';
const LECTURA = 'lib/negocio/lecturaDeCreative.ts';
const panel = () => sinComentarios(leer(PANEL));
const ficha = () => sinComentarios(leer(FICHA));
const comun = () => sinComentarios(leer(COMUN));

/** El cuerpo de una función de un archivo, hasta la próxima función de primer nivel. */
function funcion(fuente: string, nombre: string): string {
  const i = fuente.search(new RegExp(`\\nfunction ${nombre}\\(|\\nexport (default )?function ${nombre}\\(`));
  assert.notEqual(i, -1, `no está la función ${nombre}`);
  const j = fuente.slice(i + 1).search(/\n(export (default )?)?function \w+\(/);
  return j === -1 ? fuente.slice(i) : fuente.slice(i, i + 1 + j);
}

/** El marcado de Creative en el prototipo, y su JS. */
function prototipo(): { html: string; js: string } {
  const todo = leer('aios-command-center_1.html');
  const i = todo.indexOf('<section class="view" id="v-creative">');
  assert.notEqual(i, -1, 'no está la sección de Creative en el prototipo');
  const j = todo.indexOf('// ===== módulo Creative =====');
  assert.notEqual(j, -1, 'no está el JS de Creative en el prototipo');
  return { html: todo.slice(i, todo.indexOf('</section>\n', todo.indexOf('id="badGrid"'))), js: todo.slice(j, todo.indexOf('})();', j)) };
}

/** Las claves de un objeto exportado de `comun.jsx`. */
function claves(nombre: string): string[] {
  const c = comun();
  const i = c.indexOf(`export const ${nombre} = {`);
  assert.notEqual(i, -1, `no está ${nombre}`);
  return [...c.slice(i, c.indexOf('\n};', i)).matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]!);
}

/** Las cadenas de una unión de tipos del servidor. */
function union(fuente: string, expresion: RegExp): string[] {
  return [...(expresion.exec(fuente)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1]!);
}

test('la sección no lleva la estética de operación, y su envoltorio es el del prototipo', () => {
  const vista = sinComentarios(leer(VISTA));
  assert.match(vista, /id="v-creative"/);
  assert.doesNotMatch(vista, /estetica-op/, 'volvió `estetica-op` a la sección: es la capa que había cambiado el look (CF1-01)');
  assert.match(vista, /className=\{activa \? 'view on' : 'view'\}/);
  assert.match(vista, /<div className="view-scroll cre-scroll">\s*<PanelDeCreative \/>/, 'el envoltorio del prototipo es `view-scroll cre-scroll`');
  assert.doesNotMatch(panel() + ficha(), /estetica-op|cl-page/, 'la estética de operación volvió por el panel');
  assert.match(funcion(panel(), 'PanelDeCreative'), /return \(\s*<div className="cre-wrap">/, 'el panel no abre con el `cre-wrap` del prototipo');
});

test('el encabezado es el del prototipo: el título, la bajada, el plan y el segmentado', () => {
  const { html } = prototipo();
  const bajada = /<span class="cre-desc">([^<]+)<\/span>/.exec(html)?.[1];
  assert.equal(bajada, 'Qué funciona, qué no, y por qué', 'cambió la bajada del prototipo');
  const cabeza = funcion(panel(), 'PanelDeCreative');
  assert.match(cabeza, /<div className="cre-head">\s*<div className="ch-l">\s*<h2>Creative<\/h2>\s*<span className="cre-desc">([^<]+)<\/span>/);
  assert.equal(/<span className="cre-desc">([^<]+)<\/span>/.exec(cabeza)?.[1], bajada, 'la bajada no es la del prototipo (CF1-03)');
  const derecha = cabeza.slice(cabeza.indexOf('<div className="ch-r">'), cabeza.indexOf('{error ?'));
  assert.match(derecha, /<BotonDelPlan departamento="creative" senales=\{pantalla\.senales\} \/>/, 'el plan no es el real del detector (CF1-14)');
  assert.match(derecha, /<div className="ch-period">[\s\S]*<Periodos valor=\{pantalla\?\.periodo \?\? periodo\} alElegir=\{setPeriodo\} \/>/, 'el segmentado enciende lo pedido y no lo contestado');
  assert.match(
    funcion(panel(), 'Periodos'),
    /PERIODOS\.map[\s\S]*className=\{valor === p\.clave \? 'on' : undefined\}\s*aria-pressed=\{valor === p\.clave\}\s*title=\{p\.matiz \?\? undefined\}\s*onClick=\{\(\) => alElegir\(p\.clave\)\}/,
    'el segmentado no enciende el período, o no lo elige',
  );
  // El encabezado va siempre, antes de la carga y del error.
  assert.ok(cabeza.indexOf('className="cre-head"') < cabeza.indexOf('{error ?'), 'el encabezado se dibuja después del error');
});

test('la tira lleva las seis cifras del prototipo en su orden, con «Impresiones» por «Alcance»', () => {
  const { js } = prototipo();
  const delPrototipo = [...(/const items = \[(.+?)\];/.exec(js)?.[1] ?? '').matchAll(/\['([^']+)','(\w+)','(\w+)'\]/g)].map((m) => m[1]!);
  assert.deepEqual(delPrototipo, ['Calificados', 'Agendas', 'Hook rate', 'Retención', 'Alcance', 'Frecuencia'], 'no se leyó la tira del prototipo');
  const tira = funcion(panel(), 'Tira');
  const celdas = [...tira.matchAll(/\['(\w+)', '([^']+)', o\(c\.(\w+)\.valor, (\w+)\), '(\w+)'\]/g)].map((m) => [m[1], m[2], m[3], m[4], m[5]]);
  assert.deepEqual(
    celdas,
    [
      ['calificados', 'Calificados', 'calificados', 'miles', 'total'],
      ['agendas', 'Agendas', 'agendas', 'miles', 'total'],
      ['hookRate', 'Hook rate', 'hookRate', 'pf', 'promedio'],
      ['retencion', 'Retención', 'retencion', 'pf', 'promedio'],
      ['impresiones', 'Impresiones', 'impresiones', 'corto', 'total'],
      ['frecuencia', 'Frecuencia', 'frecuencia', 'veces', 'promedio'],
    ],
    'la tira no es la del prototipo, o una celda lee otra cifra (CF1-06)',
  );
  assert.deepEqual(celdas.map((c) => c[1]), delPrototipo.map((r) => (r === 'Alcance' ? 'Impresiones' : r)), 'el único desvío declarado es «Impresiones» (CF1-02)');
  assert.match(tira, /<section className="cre-stats">/);
  assert.match(tira, /className=\{clave === criterio \? 'cre-stat hi' : 'cre-stat'\}/, 'la celda del criterio elegido no lleva `.hi`');
  // Donde el prototipo decía «total» o «promedio», un «—» dice su frase.
  assert.match(tira, /\{motivo\(c\[clave\]\) \?\? sub\}/);
});

test('«Ordenar por» ofrece los criterios del servidor, y elegir uno no reordena nada en el navegador', () => {
  const lectura = leer(LECTURA);
  const delServidor = union(lectura, /export const CRITERIOS = \[([^\]]+)\]/);
  assert.deepEqual(claves('CRITERIO'), delServidor, 'un criterio del servidor no tiene rótulo, o cambió el orden (CF1-07)');
  for (const par of ["calificados: { rotulo: 'Calificados'", "agendas: { rotulo: 'Agendas'", "hookRate: { rotulo: 'Hook rate'", "impresiones: { rotulo: 'Impresiones'"]) {
    assert.ok(comun().includes(par), `cambió el rótulo \`${par}\``);
  }
  const orden = funcion(panel(), 'Orden');
  assert.match(orden, /className=\{abierto \? 'pill-wrap open' : 'pill-wrap'\}/);
  assert.match(orden, /<span className="pk">Ordenar por<\/span>\s*<span className="pv">\{CRITERIO\[valor\]\.rotulo\}<\/span>/);
  assert.match(orden, /<div className="pm-list">/);
  // Se cierra al elegir, al tocar afuera y con Escape.
  assert.match(orden, /alElegir\(clave\);\s*cerrar\(\);/);
  assert.match(orden, /e\.key === 'Escape'/);
  assert.match(orden, /!caja\.current\.contains\(e\.target\)/);
  for (const [evento, oyente] of [['click', 'afuera'], ['keydown', 'tecla']]) {
    assert.match(orden, new RegExp(`document\\.addEventListener\\('${evento}', ${oyente}\\);`), `el menú no escucha ${evento}`);
    assert.match(orden, new RegExp(`document\\.removeEventListener\\('${evento}', ${oyente}\\);`), `el menú deja suelto el oyente de ${evento}`);
  }
  assert.match(orden, /\{abierto \? \(\s*<div className="pm-list">/, 'el menú cerrado sigue en el orden del tabulador');
  assert.match(orden, /const cerrar = \(\) => \{\s*setAbierto\(false\);\s*pildora\.current\?\.focus\(\);/, 'al cerrar, el foco no vuelve a la píldora');
  assert.match(orden, /if \(e\.key === 'Escape'\) cerrar\(\);/);
  assert.match(funcion(panel(), 'PanelDeCreative'), /const CRITERIO_POR_OMISION = 'agendas';|useState\(CRITERIO_POR_OMISION\)/);
  assert.match(panel(), /const CRITERIO_POR_OMISION = 'agendas';/, 'la pantalla no abre en el criterio del prototipo');
});

test('los dos grupos son los del servidor para el criterio elegido, con los rótulos del prototipo', () => {
  const { html, js } = prototipo();
  assert.ok(html.includes('<span class="gt">Funciona</span>') && html.includes('<span class="gt">No funciona</span>'));
  const bajoElPromedio = /getElementById\('badSub'\)\.textContent = '([^']+)'/.exec(js)?.[1];
  assert.equal(bajoElPromedio, 'bajo el promedio — pausar o iterar');
  const t = funcion(panel(), 'Tablero');
  assert.match(t, /const \{ cifras, piezas, criterios, loDemas \} = p\.pantalla;/);
  assert.match(t, /const grupos = criterios\[criterio\];/, 'los grupos no son los del criterio elegido');
  assert.match(
    t,
    /<div className="ghead good">\s*<span className="gdot" \/>\s*<span className="gt">Funciona<\/span>\s*<span className="gsub">\{sinPromedio \? 'sin datos en este periodo' : 'sobre el promedio de su etapa'\}<\/span>\s*<span className="gn">\{`\$\{miles\(grupos\.funciona\.length\)\} piezas`\}<\/span>\s*<\/div>\s*<Grupo claves=\{grupos\.funciona\} gana /,
    '«Funciona» no es el del prototipo con el desvío declarado, o lee otro grupo (CF1-08)',
  );
  assert.match(
    t,
    new RegExp(`<div className="ghead bad">\\s*<span className="gdot" />\\s*<span className="gt">No funciona</span>\\s*<span className="gsub">${bajoElPromedio}</span>\\s*<span className="gn">\\{\`\\$\\{miles\\(grupos\\.noFunciona\\.length\\)\\} piezas\`\\}</span>\\s*</div>\\s*<Grupo claves=\\{grupos\\.noFunciona\\} gana=\\{false\\} `),
    '«No funciona» no es el del prototipo, o lee otro grupo',
  );
  assert.match(t, /<span className="db-info">\s*<b>\{miles\(piezas\.length\)\}<\/b> piezas · \{PERIODO_EN_LA_BARRA\[p\.periodo\]\}/);
  assert.match(comun(), /hoy: 'hoy',\s*'7d': 'últimos 7 días',\s*'30d': 'últimos 30 días',\s*completo: 'histórico',/);
  // Vacío, la frase del prototipo; con piezas, en el orden del servidor.
  const g = funcion(panel(), 'Grupo');
  assert.match(g, /<div className="dw-empty cr-vacio">\{FRASE\.grupoVacio\}<\/div>/);
  assert.match(g, /claves\.map\(\(clave\) => <Tarjeta key=\{clave\} pieza=\{porClave\.get\(clave\)\} gana=\{gana\} unica=\{unicas\.has\(clave\)\} alAbrir=\{alAbrir\} \/>\)/);
  assert.match(t, /const unicas = new Set\(grupos\.unicas\);/);
  // Sin promedio en ninguna etapa, el subtítulo del prototipo (`goodSub`).
  assert.match(t, /const sinPromedio = Object\.values\(grupos\.promedioPorEtapa\)\.every\(\(v\) => v === null\);/);
  assert.match(t, /\{sinPromedio \? 'sin datos en este periodo' : 'sobre el promedio de su etapa'\}/);
  // La ficha recibe el veredicto del mismo grupo.
  assert.match(t, /gana=\{grupos\.funciona\.includes\(pieza\.clave\)\}/);
  assert.match(t, /unica=\{unicas\.has\(pieza\.clave\)\}/);
});

test('la tarjeta es la `cc` del prototipo: el estado, el nombre, la etapa y las seis métricas en su orden', () => {
  const { js } = prototipo();
  const grilla = [...(/const DIRECTA_GRID = \[[^\n]*\n([\s\S]+?)\];/.exec(js)?.[1] ?? '').matchAll(/\['([^']+)','\w+'/g)].map((m) => m[1]!);
  assert.deepEqual(grilla, ['Calificados', 'Agendas', 'Hook rate', 'Retención', 'Alcance', 'Frecuencia'], 'no se leyó la tarjeta del prototipo');
  const tarjeta = funcion(panel(), 'Tarjeta');
  const metricas = [...tarjeta.matchAll(/\['([^']+)', c\.(\w+), (\w+)\]/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(metricas, [
    ['Calificados', 'calificados', 'miles'],
    ['Agendas', 'agendas', 'miles'],
    ['Hook rate', 'hookRate', 'pf'],
    ['Retención', 'retencion', 'pf'],
    ['Impresiones', 'impresiones', 'corto'],
    ['Frecuencia', 'frecuencia', 'veces'],
  ]);
  assert.deepEqual(metricas.map((m) => m[0]), grilla.map((r) => (r === 'Alcance' ? 'Impresiones' : r)));
  assert.match(tarjeta, /className=\{gana \? 'cc win' : 'cc lose'\}/);
  assert.match(tarjeta, /tabIndex=\{0\}\s*role="button"/);
  assert.match(tarjeta, /e\.key === 'Enter' \|\| e\.key === ' '/, 'la tarjeta no se abre con el teclado');
  assert.match(tarjeta, /<Miniatura url=\{pieza\.miniatura\} clase="cc-media">/);
  assert.match(tarjeta, /<span className=\{pieza\.estado === 'entregando' \? 'cc-status act' : 'cc-status pau'\}>\{ESTADO\[pieza\.estado\]\}<\/span>/);
  assert.match(tarjeta, /\{pieza\.perdiendoGancho === true \? <span className="cr-gancho">Perdiendo gancho<\/span> : null\}/, 'la fatiga no es la marca de la tarjeta (CF1-09)');
  // Se dibuja el nombre, no la `clave`, que en la pieza de otro cliente lleva su id (el nivel 3); el `title`, con el cliente.
  assert.match(tarjeta, /const rotulo = rotuloDeLaPieza\(pieza\.nombre, pieza\.cliente\);/);
  assert.match(tarjeta, /<div className="cc-name" title=\{rotulo\}>\s*\{pieza\.nombre\}/);
  assert.match(tarjeta, /\{pieza\.cliente \? \(\s*<div className="cr-cliente" title=\{pieza\.cliente\}>\s*\{pieza\.cliente\}\s*<\/div>\s*\) : null\}/, 'el cliente no tiene su línea');
  assert.match(tarjeta, /aria-label=\{`Pieza \$\{rotulo\}`\}/, 'el lector de pantalla no oye el cliente de la pieza');
  assert.doesNotMatch(tarjeta, /\{pieza\.clave\}/, 'la tarjeta dibuja la clave, que en la pieza de otro cliente es su uuid');
  assert.match(tarjeta, /<div className="cc-qual">\s*<span className="tag fmt">\{ETAPA\[pieza\.etapa\]\}<\/span>\s*\{unica \? <span className="tag ang">\{FRASE\.unica\}<\/span> : null\}/, 'la etiqueta no es la etapa (CF1-02), o la única no se marca');
  assert.match(tarjeta, /\{o\(cifra\.valor, formato\)\}/, 'la celda no dibuja con el formato de su cifra');
  assert.match(tarjeta, /<div className=\{i < 2 \? 'pm' : undefined\}/, 'las dos de resultado no van resaltadas, como en el prototipo');
  assert.match(tarjeta, /title=\{motivo\(cifra\) \?\? undefined\}/, 'una cifra en «—» de la tarjeta no dice por qué');
});

test('las frases son las de CF1-02, ni una más ni una menos', () => {
  const c = comun();
  const bloque = c.slice(c.indexOf('export const FRASE = {'), c.indexOf('};', c.indexOf('export const FRASE = {')));
  const delPanel = [...bloque.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]!).sort();
  assert.ok(delPanel.length >= 10, 'no se leyeron las frases del panel');
  const doc = leer('docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md');
  const seccion = doc.slice(doc.indexOf('### CF1-02'), doc.indexOf('**Los desvíos de rótulo'));
  const delDoc = [...seccion.matchAll(/^\|[^|]+\|\s*«([^»]+)»\s*\|\r?$/gm)].map((m) => m[1]!).sort();
  assert.deepEqual(delPanel, delDoc, 'la lista del panel y la de CF1-02 no coinciden: una frase nueva entra primero al documento');
});

test('cada motivo de una cifra sin valor tiene SU frase, y son los del servidor', () => {
  const delServidor = union(leer(LECTURA), /export type MotivoDeLaCifra =([^;]+);/).sort();
  assert.equal(delServidor.length, 7, 'no se leyeron los motivos del servidor');
  const c = comun();
  const frases = c.slice(c.indexOf('export const FRASE = {'), c.indexOf('};', c.indexOf('export const FRASE = {')));
  const texto = Object.fromEntries([...frases.matchAll(/(\w+): '([^']+)'/g)].map((m) => [m[1], m[2]]));
  const bloque = c.slice(c.indexOf('export const FRASE_DEL_MOTIVO = {'), c.indexOf('};', c.indexOf('export const FRASE_DEL_MOTIVO = {')));
  const mapa = Object.fromEntries([...bloque.matchAll(/(\w+): FRASE\.(\w+)/g)].map((m) => [m[1], texto[m[2]!]]));
  assert.deepEqual(Object.keys(mapa).sort(), delServidor);
  /* Y cada uno con la frase de su situación en CF1-02: dos intercambiadas pasarían una comparación de conjuntos. */
  assert.deepEqual(mapa, {
    sin_contactos: 'Sin contactos en este período',
    sin_puntaje: 'El CRM no tiene el puntaje.',
    sin_entrega: 'Sin entrega en esta ventana.',
    bajo_el_piso: 'Pocos casos para una tasa.',
    pocas_impresiones: 'Pocas impresiones para una tasa.',
    sin_reporte: 'GoHighLevel no lo reportó.',
    sin_fuente: 'GoHighLevel no lo entrega.',
  });
  assert.match(c, /export const motivo = \(c\) => \(c\.valor === null \? \(FRASE_DEL_MOTIVO\[c\.motivo\] \?\? null\) : null\);/);
  const demas = [...funcion(panel(), 'LoDemas').matchAll(/\['([^']+)', o\(c\.(\w+)\.valor, (\w+)\), motivo\(c\.(\w+)\)\]/g)].map((m) => [m[1], m[2], m[3], m[4]]);
  assert.deepEqual(demas, [['Gasto', 'gasto', 'plata', 'gasto'], ['CTR', 'ctr', 'pf', 'ctr'], ['Link CTR', 'linkCtr', 'pf', 'linkCtr'], ['Landing', 'landing', 'pf', 'landing']], 'la fila de abajo lee otra cifra, o con otro formato (CF1-13)');
  assert.match(comun(), /export const FORMATO_DEL_CRITERIO = \{\s*calificados: miles,\s*agendas: miles,\s*hookRate: pf,\s*impresiones: corto,\s*\};/);
  // La fatiga sin veredicto dice la suya, y no un cero.
  assert.match(funcion(panel(), 'LoDemas'), /gancho\.sobre === 0 \? FRASE\.guion : `\$\{miles\(gancho\.con\)\} de \$\{miles\(gancho\.sobre\)\}`, gancho\.sobre === 0 \? FRASE\.sinGancho : null/);
});

test('las etapas, los estados y las redes son los del servidor, cada uno con su rótulo', () => {
  const lectura = leer(LECTURA);
  assert.match(lectura, /export const CLAVES_DE_ETAPA: readonly ClaveDeEtapa\[\] = \[\.\.\.ETAPAS, 'sin_etapa'\];/);
  const etapas = union(leer('lib/negocio/creativo.ts'), /export const ETAPAS = \[([^\]]+)\]/);
  assert.deepEqual(claves('ETAPA'), [...etapas, 'sin_etapa'], 'una etapa del servidor no tiene etiqueta');
  assert.match(comun(), /sin_etapa: 'Sin etapa',/);
  assert.deepEqual(claves('ESTADO'), union(lectura, /estado: ('entregando'[^;]+);/), 'un estado del servidor no tiene rótulo');
  assert.match(comun(), /entregando: 'Entregando',\s*sin_entrega: 'Sin entrega',/, 'cambió el desvío de «Activo» / «Pausado» (CF1-02)');
  assert.deepEqual(Object.keys({ facebook: 1, instagram: 1 }), union(leer('lib/negocio/urlExterna.ts'), /export type Red = ([^;]+);/));
  assert.match(comun(), /export const VER_EN = \{ facebook: 'Ver en Facebook', instagram: 'Ver en Instagram' \};/);
});

test('la miniatura no manda el `referrer`, carga perezosa y, si no carga, cae al fondo del prototipo', () => {
  const m = sinComentarios(leer(MINIATURA));
  assert.match(m, /<img className="cr-imagen" src=\{url\} alt="" loading="lazy" referrerPolicy="no-referrer" onError=\{\(\) => setFallo\(true\)\} \/>/);
  assert.match(m, /\{url && !fallo \? \(/, 'una imagen que falló se sigue dibujando');
  assert.match(m, /\) : url \? null : \(\s*<span className="cr-sin-imagen">/, 'una imagen caída dice «Sin miniatura todavía.», y sí la hay');
  assert.match(m, /<span className="cr-sin-imagen">\{FRASE\.sinMiniatura\}<\/span>/, 'sin miniatura no dice por qué (CF1-12)');
  assert.match(m, /useEffect\(\(\) => setFallo\(false\), \[url\]\);/, 'una miniatura nueva hereda el fallo de la anterior');
  assert.match(m, /<div className=\{`\$\{clase\} cr-fondo`\}>/);
  assert.match(ficha(), /<Miniatura url=\{pieza\.miniatura\} clase="dw-video" \/>/, 'la ficha no dibuja la miniatura grande');
});

test('la ficha es el cajón del prototipo: en un portal, con sus secciones en orden y el veredicto contra la etapa', () => {
  const f = funcion(ficha(), 'FichaDelCreativo');
  assert.match(f, /createPortal\([\s\S]*document\.body,\s*\);/, 'la ficha no se monta en `document.body`');
  assert.match(f, /<aside className="drawer on cr-ficha" ref=\{cajon\} role="dialog" aria-modal="true"/);
  /* La pieza es (cliente, nombre) (el nivel 3): la ficha dibuja el nombre y, con piezas de dos clientes, el cliente, en
     la cabecera y en «Qué es». La `clave` no se dibuja en ningún lado: en la pieza de otro cliente es `<uuid>:<nombre>`. */
  assert.match(f, /aria-label=\{`Pieza \$\{rotuloDeLaPieza\(pieza\.nombre, pieza\.cliente\)\}`\}>/, 'el cajón no se anuncia con el rótulo de la pieza');
  assert.match(f, /<h3 className="cr-titulo">\{pieza\.nombre\}<\/h3>/, 'el título de la ficha no es el nombre de la pieza');
  assert.match(
    f,
    /<div className="m">\{`\$\{ESTADO\[pieza\.estado\]\} · \$\{ETAPA\[pieza\.etapa\]\}\$\{pieza\.cliente \? ` · \$\{pieza\.cliente\}` : ''\}`\}<\/div>/,
    'la cabecera no dice el cliente',
  );
  assert.match(f, /<Caja rotulo="Pieza" valor=\{pieza\.nombre\} ancha \/>/, '«Qué es» no dice el nombre de la pieza');
  assert.match(f, /\{pieza\.cliente \? <Caja rotulo="Cliente" valor=\{pieza\.cliente\} ancha \/> : null\}/, '«Qué es» no dice el cliente');
  assert.doesNotMatch(ficha(), /pieza\.clave/, 'la ficha usa la clave, que en la pieza de otro cliente es su uuid');
  assert.match(f, /if \(e\.key === 'Escape' && e\.target\?\.tagName !== 'INPUT'\) alCerrarRef\.current\(\);/, 'Escape no cierra la ficha, o la cierra escribiendo el link');
  assert.match(f, /document\.addEventListener\('keydown', alTeclear\);/, 'la ficha no escucha el teclado');
  assert.match(f, /const origen = document\.activeElement;[\s\S]*if \(origen instanceof HTMLElement && origen\.isConnected\) origen\.focus\(\);/, 'al cerrar, el foco no vuelve a la tarjeta');
  assert.match(f, /e\.preventDefault\(\);\s*ultimo\.focus\(\);[\s\S]*e\.preventDefault\(\);\s*primero\.focus\(\);/, 'el tabulador sale del cajón');
  // «Ver en…»: el manual de ahora; si se sacó el del servidor, nada hasta la recarga.
  assert.match(f, /const enlace = manual \? \{ url: manual\.url, red: manual\.red \} : manualDelServidor \? null : pieza\.enlace;/);
  const secciones = [...f.matchAll(/<div className="dw-sec-t">([^<]+)<\/div>/g)].map((m) => m[1]);
  assert.deepEqual(secciones, ['La pieza', 'Qué es', 'Datos de la pieza', 'Retención y guion', 'Los anuncios de la pieza'], 'las secciones no son las de CF1-10, o cambiaron de orden');
  assert.match(f, /<span className="dw-verdict good">/);
  assert.match(f, /<span className="dw-verdict bad">\{`✕ Bajo en \$\{CRITERIO\[criterio\]\.rotulo\.toLowerCase\(\)\}/);
  assert.match(f, /unica \? FRASE\.unica :/, 'la única de su etapa no lo dice (CF1-08)');
  assert.match(f, /\{motivo\(valor\) \? <div className="cr-motivo">\{motivo\(valor\)\}<\/div> : null\}/, 'un «—» del veredicto no dice por qué');
  // Lo que GoHighLevel no entrega queda en «—» con su frase, y no se inventa una curva ni un guion.
  for (const rotulo of ['Formato', 'Ángulo', 'Duración', 'Dolor que ataca']) {
    assert.match(f, new RegExp(`<Caja rotulo="${rotulo}" valor=\\{FRASE\\.guion\\} porque=\\{FRASE\\.sinFuente\\}`), `«${rotulo}» no está en «—» con su frase`);
  }
  assert.match(f, /<div className="dw-empty">\{FRASE\.sinFuente\}<\/div>/);
  assert.match(f, /<Caja rotulo="Primer día con entrega" valor=\{fechaCorta\(f\.primerDia\) \?\? FRASE\.guion\} porque=\{f\.primerDia \? null : FRASE\.sinEntrega\} ancha \/>/, '«Publicado» es «Primer día con entrega» (CF1-02)');
  assert.match(f, /<Caja rotulo="Último día con entrega" valor=\{fechaCorta\(f\.ultimoDia\) \?\? FRASE\.guion\} porque=\{f\.ultimoDia \? null : FRASE\.sinEntrega\} ancha \/>/);
  // Los datos de la pieza: las seis de la tira y las cinco de la subasta.
  const datos = [...f.matchAll(/<Dato rotulo="([^"]+)" c=\{(\w)\.(\w+)\} formato=\{(\w+)\}/g)].map((m) => `${m[1]}=${m[2]}.${m[3]}:${m[4]}`);
  assert.deepEqual(datos, [
    'Calificados=c.calificados:miles', 'Agendas=c.agendas:miles', 'Hook rate=c.hookRate:pf', 'Retención=c.retencion:pf',
    'Impresiones=c.impresiones:corto', 'Frecuencia=c.frecuencia:veces', 'Gasto=f.gasto:plata', 'CTR=f.ctr:pf',
    'Link CTR=f.linkCtr:pf', 'Landing=f.landing:pf', 'Click-to-landing=f.clickToLanding:pf',
  ]);
  assert.match(funcion(ficha(), 'Dato'), /\{porque \? <div className="cr-motivo">\{porque\}<\/div> : null\}/, 'un «—» de la ficha no lleva su línea');
  // El link se abre afuera, sin `referrer`, y el editor sólo para quien puede.
  assert.match(f, /target="_blank" rel="noopener noreferrer"/);
  // El link es el de la pieza en SU cliente (el nivel 3).
  assert.match(f, /\{puedeEditar \? <EditorDelEnlace cuentaId=\{pieza\.cuentaId\} pieza=\{pieza\.nombre\} enlace=\{manual\} alCambiarEnlaces=\{alCambiarEnlaces\} \/> : null\}/);
  const editor = funcion(ficha(), 'EditorDelEnlace');
  assert.match(
    editor,
    /accion === 'sacar' \? await borrarEnlaceDeLaPieza\(cuentaId, pieza\) : await guardarEnlaceDeLaPieza\(cuentaId, pieza, url\.trim\(\)\)/,
    'el editor cruza guardar y sacar, o pierde el cliente',
  );
  assert.match(editor, /if \(r\.tipo === 'datos'\) \{\s*alCambiarEnlaces\(r\.enlaces\);/, 'el editor no avisa al panel de la lista nueva');
  // Y el panel, al recibirla, también recarga: la pieza puede cambiar de enlace.
  assert.match(funcion(panel(), 'Tablero'), /alCambiarEnlaces=\{\(lista\) => \{\s*setEnlaces\(lista\);\s*alCambiar\(\);/);
});

test('no vuelven «Personalizado», la clave `mes`, la curva, el guion ni los nombres de la maqueta', () => {
  const fuente = sinComentarios(leer(VISTA)) + panel() + ficha() + comun() + sinComentarios(leer(MINIATURA));
  for (const [pieza, motivo] of [
    ['Personalizado', '«Personalizado» abría un rango que ninguna otra pantalla reproduce (CF1-03)'],
    ['data-datepick', '«Personalizado» (CF1-03)'],
    ["'mes'", 'la clave `mes` no es un período (CF1-04)'],
    ['data-leads', 'abría un cajón con personas inventadas (CF1-17)'],
    ['retentionCurve', 'la curva de retención no tiene fuente (CF1-10)'],
    ['tr-line', 'el guion no tiene fuente (CF1-10)'],
    ['clickTimeline', 'los clics en el tiempo no tienen fuente'],
    ['Alcance', 'el alcance diario no se suma: es «Impresiones» (CF1-02)'],
    ['Activo', 'es «Entregando» (CF1-02)'],
    ['PISO_DE_', 'el navegador no calcula tasas: llegan del servidor (CF1-15)'],
    ['crv-', 'las tablas de la pantalla anterior (CF1-05)'],
  ] as const) {
    assert.ok(!fuente.includes(pieza), `volvió \`${pieza}\`: ${motivo}`);
  }
  /* Los nombres, los formatos, los ángulos y los dolores de las ocho piezas de la maqueta se leen del prototipo, sin
     copiarlos acá. */
  const { js } = prototipo();
  const inventado = [...js.matchAll(/name:'([^']+)', format:'([^']+)', angle:'([^']+)', pain:'([^']+)'/g)].flatMap((m) => [m[1]!, m[2]!, m[3]!, m[4]!]);
  assert.ok(inventado.length >= 32, 'no se leyeron las piezas de la maqueta');
  for (const pieza of inventado) assert.ok(!fuente.includes(`'${pieza}'`) && !fuente.includes(`>${pieza}<`), `volvió «${pieza}» de la maqueta (CF1-17)`);
});

test('la carga: la última lectura gana, la recarga no pisa a la primera, y la primera se apaga', () => {
  const p = funcion(panel(), 'PanelDeCreative');
  assert.match(p, /if \(esRecarga && primeraEnVuelo\.current\) return;/, 'una recarga del reloj deja sin efecto a la carga primera');
  assert.match(p, /const esta = \+\+ultima\.current;[\s\S]*const r = await leerCreative\(periodoVigente\.current\);\s*if \(esta !== ultima\.current\) return;/, 'una respuesta tardía pisa a la nueva');
  assert.match(p, /if \(!esRecarga\) primeraEnVuelo\.current = false;/, 'la primera carga nunca se apaga: el reloj deja de recargar');
  assert.match(p, /<Tablero key=\{pantalla\.periodo\} /, 'la ficha abierta sobrevive al cambio de ventana');
  assert.match(p, /const r = await leerCreative\(periodoVigente\.current\);/, 'una recarga atrasada pide el período de cuando se creó');
  assert.match(p, /periodoVigente\.current = periodo;/);
  assert.match(p, /setError\(r\.mensaje\);\s*if \(!esRecarga\) setPantalla\(null\);/, 'un fallo al cambiar de ventana deja las cifras de la anterior');
  assert.match(funcion(panel(), 'Tablero'), /if \(abierta !== null && !piezas\.some\(\(x\) => x\.clave === abierta\)\) setAbierta\(null\);/, 'una ficha cerrada por una recarga se reabriría sola');
  // Una respuesta sin la pantalla armada es un fallo con su aviso, no un panel que se cae.
  assert.match(leer('lib/negocio/vistaDeCreative.ts'), /if \(r\.tipo === 'datos' && !r\.datos\?\.pantalla\?\.criterios\) return \{ tipo: 'fallo'/);
  assert.match(p, /usarReloj\(aLaVista \? 'creative:tic' : null, recargar, CADENCIA\.inteligencia\);/);
});

test('el navegador no calcula: se multiplica por 100 en un solo lugar, y el panel no divide ni ordena', () => {
  const todo = panel() + ficha() + comun();
  assert.equal([...todo.matchAll(/\*\s*100\b/g)].length, 1, 'hay otra multiplicación por 100: todo viaja de 0 a 1 y se convierte una vez (CF1-15)');
  assert.match(comun(), /export const cien = \(v\) => v \* 100;/);
  for (const [nombre, fuente] of [['panel', panel()], ['ficha', ficha()]] as const) {
    const sinImports = fuente.replace(/^import .*$/gm, '').replace(/'[^'\n]*'|`[^`\n]*`|"[^"\n]*"/g, "''");
    assert.doesNotMatch(sinImports, /[\w)\]]\s*\/\s*[\w(]/, `el ${nombre} divide: una tasa se calculó en el navegador`);
    assert.doesNotMatch(fuente, /\.(sort|toSorted|reverse|toReversed|splice)\(|reduce\(/, `el ${nombre} reordena o suma lo que llega`);
  }
});

test('sin párrafos: el panel no dibuja la cobertura, los avisos ni lo que falta para medir (CF1-05)', () => {
  const t = panel() + ficha();
  assert.doesNotMatch(t, /\.aviso\b|fueraDeAlcance|\.puente\b|desdeElDesglose|\.titulos\b|<details|cs-fuera|cs-grave/, 'el panel volvió a dibujar un aviso, la cobertura o lo que falta');
  // El panel lee sólo la pantalla armada, no los bloques de antes: lo que dibuja lo decide el servidor (CF1-05, CF1-15).
  assert.doesNotMatch(t, /p\.calidad|p\.rendimiento|p\.fatiga/, 'el panel lee los bloques de antes y no la pantalla armada');
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

test('lo nuevo vive en `app/creative.css`, acotado; la estética de Inteligencia ya no existe', () => {
  assert.match(leer('app/globals.css'), /@import "\.\/creative\.css" layer\(components\);/, 'la hoja no está importada en la capa `components`');
  const propia = sinComentarios(leer('app/creative.css'));
  const selectores = [...propia.matchAll(/([^{}@]+)\{/g)]
    .map((m) => m[1]!.trim())
    .filter((s) => s && !s.startsWith('media') && !/^\(max-width/.test(s));
  assert.ok(selectores.length > 20, 'no se leyeron los selectores de la hoja');
  for (const s of selectores) {
    for (const parte of partes(s)) assert.match(parte, /^(#v-creative |\.cr-ficha[ .])/, `\`${parte}\` no está acotado a #v-creative ni a la ficha`);
  }
  // Las reglas del prototipo que se habían retirado de `aios.css` vuelven acá (CF1-01).
  for (const regla of ['.cre-stat {', '.cg {', '.cc {', '.cc-media {', '.cc-mx {', '.cc-status {', '.dw-verdict {', '.qb {']) {
    assert.ok(propia.includes(regla), `falta la regla del prototipo \`${regla}\``);
  }
  assert.doesNotMatch(panel() + ficha(), /style=\{\{ (color|background)/, 'un color en línea: va por una clase de `app/creative.css`');
  /* La píldora de estado y el piso de la media los pone `temas.css`, con el velo que garantiza el contraste sobre
     cualquier imagen. Una regla de acá le gana por especificidad —misma capa— y vuelve el 1,01:1. */
  assert.doesNotMatch(propia, /\.cc-status\.(act|pau)\b/, '`app/creative.css` pisa el velo de la píldora de estado que pone `temas.css`');
  assert.doesNotMatch(propia, /\.cr-fondo \{ background:/, 'el fondo de la miniatura pisa el piso de la media de `temas.css`: va sólo `background-image`');
  assert.match(propia, /#v-creative \.cr-gancho \{[^}]*background: var\(--velo-medio\); color: var\(--warn-medio\);/, '«Perdiendo gancho» sin el velo, o en un color que el tema claro oscurece');
  assert.match(leer('app/temas.css'), /--warn-medio: {2}#e0c073;/);

  /* La estética de Inteligencia repintaba la pestaña, y se quedó sin nadie que la usara: se borró, con su import. */
  assert.equal(existsSync(join(RAIZ, 'app/inteligencia-estetica.css')), false, 'volvió `app/inteligencia-estetica.css`');
  assert.doesNotMatch(sinComentarios(leer('app/globals.css')), /inteligencia-estetica/);
  for (const nombre of readdirSync(join(RAIZ, 'app')).filter((n) => n.endsWith('.css'))) {
    if (['aios.css', 'creative.css', 'senales.css'].includes(nombre)) continue;
    assert.doesNotMatch(sinComentarios(leer(`app/${nombre}`)), /#v-creative\b/, `app/${nombre} tiene una regla para #v-creative`);
  }
});

/** Los formatos de `comun.jsx`, ejecutados: el archivo es JavaScript plano. */
function formatos() {
  const fuente = leer(COMUN).replace(/^export /gm, '');
  return runInNewContext(`${fuente}\n;({ o, pf, miles, corto, veces, plata, fechaCorta, FORMATO_DEL_CRITERIO, motivo })`, { Intl, Date, Math, Number, String }) as {
    o: (v: unknown, f: (x: number) => string) => string;
    pf: (v: number) => string;
    miles: (n: number) => string;
    corto: (n: number) => string;
    veces: (n: number) => string;
    plata: (n: number) => string;
    fechaCorta: (iso: string | null) => string | null;
    FORMATO_DEL_CRITERIO: Record<string, (x: number) => string>;
    motivo: (c: { valor: number | null; motivo: string | null }) => string | null;
  };
}

test('los formatos, ejecutados: un cero es un cero, una tasa chica lleva su decimal, el mes es el que es', () => {
  const f = formatos();
  assert.equal(f.o(0, f.miles), '0', 'un cero medido se dibujó como «—»');
  assert.equal(f.o(null, f.miles), '—');
  assert.equal(f.o(undefined, f.pf), '—');
  // Las tasas: enteras desde el 10 %, con un decimal debajo, y el cero es cero.
  assert.equal(f.pf(0.64), '64%');
  assert.equal(f.pf(0.0237), '2.4%');
  assert.equal(f.pf(0.0211), '2.1%', 'dos CTR distintos se leen iguales');
  assert.equal(f.pf(0.0019), '0.2%', 'una landing chica se leyó «0 %»');
  assert.equal(f.pf(0), '0%');
  assert.equal(f.corto(41200), '41.2K');
  assert.equal(f.corto(950), '950');
  assert.equal(f.corto(123600), '124K');
  assert.equal(f.veces(2), '2.0');
  assert.equal(f.plata(2412.5), '$2,413');
  // El mes, el que es; y el año sólo cuando no es el de hoy.
  const esteAno = new Date().getFullYear();
  assert.equal(f.fechaCorta(`${esteAno}-10-05`), '5 oct');
  assert.equal(f.fechaCorta(`${esteAno - 1}-01-31`), `31 ene ${esteAno - 1}`);
  assert.equal(f.fechaCorta(null), null);
  assert.equal(f.FORMATO_DEL_CRITERIO.hookRate!(0.2), '20%', 'el veredicto del hook rate no sale en porcentaje');
  assert.equal(f.motivo({ valor: null, motivo: 'sin_entrega' }), 'Sin entrega en esta ventana.');
  assert.equal(f.motivo({ valor: 0, motivo: null }), null);
});

