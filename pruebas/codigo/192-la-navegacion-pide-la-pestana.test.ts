// La navegación pide la pestaña, y la pantalla la toma una vez. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/OTROS/nueva-estructura/02-DONDE-VA-CADA-PANTALLA.md, NE-19 y NE-20)
//
// Tools y Analizadores son una sección cada uno, y sus pestañas viven en departamentos distintos:
// abrir «Research › Espía de anuncios» es abrir `tools` PIDIÉNDOLE `espia`. El pedido lo deja
// `irALaVista` (`lib/aios/shell.js`), la pantalla lo recibe con `usarPedidoDeVista` (`lib/vista.ts`)
// y lo atiende en su render. Tres formas de romperlo no fallan:
//
//   · guardar el pedido DESPUÉS de avisar: la pantalla pregunta y recibe el anterior, y abre la
//     pestaña de la vez pasada;
//   · comparar por pestaña y no por número, o dejar que el número se repita: pedir otra vez la misma
//     pestaña, con un clic a mano en el medio, no la vuelve a abrir;
//   · traducir mal la clave: `Fundaciones.jsx` guarda la abierta como el `id` de una herramienta, y
//     con la clave cae a la primera sin marcar ninguna.
//
// Lo que se EJECUTA: el almacén de `shell.js` (con un documento mínimo), la decisión del hook
// (`siguientePedido`) y la traducción (`activaDeLaPestana`). El hook y las dos pantallas que atienden
// se leen del fuente: no hay un renderizador de React en las pruebas.
//
// Y desde esta etapa las filas del menú son botones de React: el armazón ya no ata clics al arrancar
// (dejaba sin oyente toda fila dibujada después, y el teclado no llegaba a ninguna).
//
// Las mutaciones que la ponen en rojo: guardar el pedido después del aviso, o entre dos oyentes; un
// número que no sube o que se reinicia; dejar pedido cuando la pantalla no existe; que el hook compare
// por pestaña, escuche otra pantalla o deje de escuchar; volver a atar clics en el armazón; marcar la
// fila desde `irALaVista`; una fila que no es un botón, o sin su `onClick`; devolver la clave de la
// herramienta en vez de su `id`; no aplicar lo traducido; atender el pedido después de la pantalla de
// carga o dentro de un efecto; que ICP lea pedidos; no cerrar el detalle de la otra pestaña; y que el
// Scraper sondee por su cuenta, reciba una flecha nueva en cada dibujo o se dibuje sin permiso.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { TOOLS, activaDeLaPestana } from '../../lib/fundaciones/herramientas.ts';
import { siguientePedido } from '../../lib/vista.ts';
import { alCambiarDeVista, irALaVista, pedidoDeVista } from '../../lib/aios/shell.js';

const fuente = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = (t: string): string =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/**
 * El cuerpo de una función declarada en `codigo`, con sus llaves balanceadas. Empieza en el `{` que
 * sigue al `)` de los parámetros: los de `irALaVista` traen sus propias llaves.
 */
function cuerpo(codigo: string, firma: string): string {
  const i = codigo.indexOf(firma);
  assert.notEqual(i, -1, `no se encontró \`${firma}\``);
  let nivel = 0;
  for (let j = codigo.indexOf(') {', i) + 2; j < codigo.length; j += 1) {
    if (codigo[j] === '{') nivel += 1;
    else if (codigo[j] === '}' && --nivel === 0) return codigo.slice(i, j + 1);
  }
  return codigo.slice(i);
}

/** La etiqueta de apertura que empieza en `desde`: recorre las llaves, así el `>` de un `=>` no la cierra. */
function etiqueta(codigo: string, desde: number): string {
  let nivel = 0;
  for (let i = desde; i < codigo.length; i += 1) {
    const c = codigo[i];
    if (c === '{') nivel += 1;
    else if (c === '}') nivel -= 1;
    else if (c === '>' && nivel === 0) return codigo.slice(desde, i + 1);
  }
  return codigo.slice(desde);
}

/** Un documento mínimo: lo que `irALaVista` toca, y nada más. */
function documentoDePrueba(vistas: string[]) {
  const clases = () => {
    const s = new Set<string>();
    return { add: (c: string) => s.add(c), remove: (c: string) => s.delete(c), contains: (c: string) => s.has(c) };
  };
  const nodos = new Map(vistas.map((v) => [`v-${v}`, { id: `v-${v}`, classList: clases() }]));
  return {
    querySelector: (s: string) => (s === '.app' ? { classList: clases() } : null),
    getElementById: (id: string) => nodos.get(id) ?? null,
    querySelectorAll: (s: string) => (s === '.view' ? [...nodos.values()] : []),
  };
}

type Pedido = { clave: string; pestana: string | null; secuencia: number };

test('el pedido se guarda antes de avisar a TODOS, con un número que sube siempre', () => {
  const g = globalThis as { document?: unknown };
  const antes = g.document;
  g.document = documentoDePrueba(['tools', 'analizadores']);
  // Dos oyentes: un pedido guardado entre el aviso al primero y al segundo se ve en el primero.
  const vistos: [Pedido, Pedido][] = [];
  let primero: Pedido | null = null;
  const bajas = [
    alCambiarDeVista(() => { primero = pedidoDeVista(); }),
    alCambiarDeVista(() => { vistos.push([primero!, pedidoDeVista()]); }),
  ];
  try {
    assert.equal(irALaVista('tools', 'Tools', { pestana: 'espia' }), true);
    assert.equal(irALaVista('tools', 'Tools', { pestana: 'espia' }), true);
    assert.equal(irALaVista('analizadores', 'Analizadores'), true);
    assert.equal(irALaVista('tools', 'Tools', { pestana: 'landing' }), true);
    for (const [uno, otro] of vistos) assert.deepEqual(uno, otro, 'dos oyentes del mismo aviso ven pedidos distintos');
    const [a, b, c, d] = vistos.map(([p]) => p);
    assert.deepEqual([a!.clave, a!.pestana, b!.clave, b!.pestana], ['tools', 'espia', 'tools', 'espia']);
    assert.deepEqual([c!.clave, c!.pestana, d!.clave, d!.pestana], ['analizadores', null, 'tools', 'landing']);
    /* Sube SIEMPRE, también al pasar por otra pantalla: si se reiniciara, el pedido de `landing`
       repetiría un número que Tools ya atendió, y no se aplicaría. */
    assert.ok(a!.secuencia < b!.secuencia && b!.secuencia < c!.secuencia && c!.secuencia < d!.secuencia, 'el número del pedido no sube siempre');
    // Una pantalla que no existe no deja pedido ni avisa.
    assert.equal(irALaVista('setter', 'Setter', { pestana: 'x' }), false);
    assert.equal(vistos.length, 4, 'una pantalla que no existe avisó');
    assert.deepEqual(pedidoDeVista(), d, 'una pantalla que no existe dejó un pedido');
  } finally {
    for (const baja of bajas) baja();
    g.document = antes;
  }
});

test('el hook guarda un pedido nuevo de SU pantalla, aunque repita la pestaña, y nada más', () => {
  const p = (clave: string, pestana: string | null, secuencia: number): Pedido => ({ clave, pestana, secuencia });
  const nuevo = siguientePedido(null, p('tools', 'espia', 1), 'tools');
  assert.deepEqual(nuevo, { pestana: 'espia', secuencia: 1 });
  // La misma pestaña con otro número es otro pedido: entre los dos pudo haber un clic a mano.
  assert.deepEqual(siguientePedido(nuevo, p('tools', 'espia', 2), 'tools'), { pestana: 'espia', secuencia: 2 });
  // El mismo número no vuelve a dibujar: devuelve el MISMO objeto.
  assert.equal(siguientePedido(nuevo, p('tools', 'espia', 1), 'tools'), nuevo);
  // Un pedido a otra pantalla no le toca.
  assert.equal(siguientePedido(nuevo, p('analizadores', 'OB', 3), 'tools'), nuevo);
  assert.equal(siguientePedido(null, p('analizadores', 'OB', 3), 'tools'), null);
  // Sin clave (ICP & Oferta) no escucha nada, y sin pedido todavía, tampoco.
  assert.equal(siguientePedido(null, p('tools', 'espia', 4), null), null);
  assert.equal(siguientePedido(nuevo, null, 'tools'), nuevo);

  // Y los dos hooks escuchan de verdad: sin el `return alCambiarDeVista(leer)`, sólo leerían al montar.
  const vista = sinComentarios(fuente('lib/vista.ts'));
  assert.equal((vista.match(/return alCambiarDeVista\(leer\);/g) ?? []).length, 2, 'un hook de `lib/vista.ts` dejó de escuchar los cambios de pantalla');
  assert.match(vista, /setVisto\(\(antes\) => siguientePedido\(antes, pedidoDeVista\(\), clave\)\)/, '`usarPedidoDeVista` decide sin `siguientePedido`');
  assert.match(vista, /return usarUbicacion\(\) === clave;/, '`estaALaVista` dejó de salir de la ubicación');
});

test('el armazón no ata clics ni marca filas: las filas son botones de React', () => {
  const shell = sinComentarios(fuente('lib/aios/shell.js'));
  assert.doesNotMatch(cuerpo(shell, 'export function initShell()'), /addEventListener|nav-item|data-view/, '`initShell` vuelve a atar clics a las filas del menú');
  assert.doesNotMatch(cuerpo(shell, 'export function irALaVista('), /nav-item|data-view/, '`irALaVista` vuelve a marcar la fila del menú desde el DOM');
  // El único clic que el armazón escucha es el del conmutador del cajón.
  assert.equal((shell.match(/addEventListener\('click'/g) ?? []).length, 1, 'el armazón escucha un clic que no es el del conmutador del cajón');
  assert.match(shell, /boton\.addEventListener\('click'/, 'el conmutador del cajón dejó de escuchar su clic');

  const nav = sinComentarios(fuente('components/Nav.jsx'));
  const filas = [...nav.matchAll(/<(\w+)\b/g)]
    .map((m) => etiqueta(nav, m.index!))
    .filter((t) => /className=\{[^}]*'nav-item/.test(t));
  assert.ok(filas.length > 0, 'no se encontró la fila del menú');
  for (const fila of filas) {
    // Un botón, y el que navega: el `onClick` en otro elemento dejaría a Enter sin efecto.
    assert.match(fila, /^<button\b/, `una fila del menú no es un botón: el teclado no llega (${fila.slice(0, 40)}…)`);
    assert.match(fila, /\stype="button"/, 'la fila no declara `type="button"`');
    assert.match(fila, /\sonClick=\{\(\) => irALaVista\(s\.clave, s\.nombre\)\}/, 'la fila no abre su pantalla al apretarla');
    assert.match(fila, /\saria-current=\{s\.clave === abierta \? 'page' : undefined\}/, 'la fila abierta no se anuncia como la actual');
    assert.match(fila, /className=\{s\.clave === abierta \? 'nav-item on' : 'nav-item'\}/, 'la fila no marca la pantalla abierta');
  }
  assert.match(nav, /const abierta = usarUbicacion\(\) \?\? primera;/, 'la fila marcada no sale de la pantalla abierta');

  /* El aspecto: SÓLO en la capa `base`, que pierde contra `aios`. En `components`, el hover y la fila
     marcada de `aios.css` perderían su fondo. */
  const globals = fuente('app/globals.css').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(globals, /@layer base \{\s*button\.nav-item \{[^}]*background: none;/, 'el botón de la fila no pierde el aspecto del navegador en la capa `base`');
  assert.equal((globals.match(/\bnav-item\b/g) ?? []).length, 1, '`globals.css` le da estilo a la fila fuera de la capa `base`');
});

test('la clave de la pestaña se traduce a lo que la pantalla guarda', () => {
  const vistas = [{ clave: 'espia' }, { clave: 'scraper' }, { clave: 'mis-leads' }];
  const id = (clave: string) => TOOLS.find((h) => h.clave === clave)!.id;
  assert.equal(activaDeLaPestana(TOOLS, vistas, 'vsl'), id('vsl'));
  assert.equal(activaDeLaPestana(TOOLS, vistas, 'landing'), id('landing'));
  assert.equal(activaDeLaPestana(TOOLS, vistas, 'prospeccion'), id('prospeccion'));
  assert.equal(activaDeLaPestana(TOOLS, vistas, 'scraper'), 'scraper');
  assert.equal(activaDeLaPestana(TOOLS, vistas, 'nada'), null, 'una pestaña desconocida abre otra');
  assert.equal(activaDeLaPestana(TOOLS, vistas, null), null);
  // Una clave repetida entre herramientas y vistas abriría siempre la herramienta.
  const enTools = [...sinComentarios(fuente('components/views/ToolsView.jsx')).matchAll(/clave: '([\w-]+)'/g)].map((m) => m[1]);
  const claves = [...TOOLS.map((h) => h.clave), ...enTools];
  assert.equal(new Set(claves).size, claves.length, `una clave de Tools está repetida: ${claves.join(', ')}`);
});

test('Tools y Analizadores toman la pestaña pedida una vez por número, en el render; ICP no la lee', () => {
  const fundaciones = sinComentarios(fuente('components/fundaciones/Fundaciones.jsx'));
  const carga = fundaciones.indexOf('if (!estado && !problema)');
  assert.ok(carga > 0, 'no se encontró la pantalla de carga de Fundaciones');
  /* Antes de la pantalla de carga: un hook después de un `return` temprano cambia el orden de los
     hooks entre un dibujo y otro, y React lo rechaza. Y fuera de un efecto: el primer dibujo después
     de abrir ya tiene que ser el de la pestaña pedida. */
  const bloque = /const pedido = usarPedidoDeVista\(catalogo\.seccion \?\? null\);\s*const \[atendido, setAtendido\] = useState\(0\);\s*if \(pedido && pedido\.secuencia !== atendido\) \{\s*setAtendido\(pedido\.secuencia\);\s*const destino = activaDeLaPestana\(catalogo\.herramientas, vistas, pedido\.pestana\);\s*if \(destino !== null\) \{\s*setActiva\(destino\);/.exec(fundaciones);
  assert.ok(bloque, 'Fundaciones no atiende el pedido una vez por número, ni aplica la pestaña traducida');
  assert.ok(bloque.index < carga, 'Fundaciones atiende el pedido después de la pantalla de carga');
  assert.doesNotMatch(fundaciones.slice(Math.max(0, bloque.index - 40), bloque.index), /useEffect\(/, 'Fundaciones atiende el pedido dentro de un efecto');
  assert.match(sinComentarios(fuente('components/views/ToolsView.jsx')), /seccion: 'tools',/, 'Tools no declara su sección: no atiende pedidos');
  // El catálogo de ICP & Oferta es el de omisión, y vive en el mismo archivo.
  const icp = /const CATALOGO_ICP = \{[\s\S]*?\n\};/.exec(fundaciones);
  assert.ok(icp, 'no se encontró el catálogo de ICP & Oferta');
  assert.doesNotMatch(icp[0], /\bseccion:/, 'ICP & Oferta declara una sección: sus siete pasos quedarían a merced de la navegación');

  const analizadores = sinComentarios(fuente('components/analizadores/PanelDeAnalizadores.jsx'));
  const bloqueAz = /const pedidoDeNavegacion = usarPedidoDeVista\('analizadores'\);\s*const \[atendido, setAtendido\] = useState\(0\);\s*if \(pedidoDeNavegacion && pedidoDeNavegacion\.secuencia !== atendido\) \{\s*setAtendido\(pedidoDeNavegacion\.secuencia\);\s*const pedida = PESTANAS\.find\(\(p\) => p\.clave === pedidoDeNavegacion\.pestana\)\?\.clave;\s*if \(pedida && pedida !== pestana\) \{\s*setPestana\(pedida\);\s*setLista\(null\);\s*\}\s*if \(pedida && detalle !== null && detalle\.tipo !== pedida\) setDetalle\(null\);/.exec(analizadores);
  assert.ok(bloqueAz, 'Analizadores no atiende el pedido una vez por número, no cambia de pestaña y de lista, o deja abierto el detalle de la otra');
  assert.ok(bloqueAz.index < analizadores.indexOf('if (detalle !== null)'), 'Analizadores atiende el pedido después del `return` del detalle');
  // El formulario a mano sigue a la pestaña: si no, «Analizador OB» analizaría como venta.
  assert.match(analizadores, /if \(pestana !== pestanaVista\) \{\s*setPestanaVista\(pestana\);\s*setTipo\(pestana\);/, 'el formulario a mano no sigue a la pestaña');
});

test('la pestaña Scraper envuelve el buscador de siempre, sin copiarlo', () => {
  const tools = sinComentarios(fuente('components/views/ToolsView.jsx'));
  assert.match(tools, /clave: 'scraper',[\s\S]{0,120}?render: \(\{ puedeEditar \}\) => <VistaDelScraper puedeEditar=\{puedeEditar\} \/>/, 'Tools no tiene la pestaña Scraper');
  const vista = sinComentarios(fuente('components/tools/VistaDelScraper.jsx'));
  assert.match(vista, /import Scraper, \{ TablaDeLeads \} from '\.\/Scraper(\.jsx)?';/, 'la vista no reúsa el buscador');
  // El sondeo y la retoma viven en el buscador: un segundo reloj acá lo prohíbe la `123`.
  assert.doesNotMatch(vista, /useTrabajo|iniciarScraping|consultarTrabajo|leerTrabajosEnVuelo|usarReloj|setTimeout|setInterval/, 'la vista del Scraper sondea por su cuenta');
  // Un solo buscador, dentro de la rama con permiso: sus botones gastan saldo.
  assert.equal((vista.match(/<Scraper\b/g) ?? []).length, 1, 'la vista dibuja más de un buscador');
  assert.match(vista, /\{puedeEditar \? \(\s*<Scraper\b/, 'la vista dibuja el buscador sin `tools.editar`');
  // `setLeads` directo: una flecha nueva en cada dibujo vuelve a disparar los efectos del buscador.
  assert.match(etiqueta(vista, vista.indexOf('<Scraper')), /\sonLeads=\{setLeads\}/, 'la vista le pasa al buscador otra cosa que `setLeads`');
});
