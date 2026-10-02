// La maqueta del Executive se fue, y el Inicio que la reemplaza no la trae de vuelta. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/OTROS/nueva-estructura/04-EL-INICIO.md, NE-29 y NE-30)
//
// La pantalla Executive era una maqueta: el mapa de departamentos, el embudo ejecutivo y la reunión
// tenían las cifras escritas a mano en tres módulos del navegador, el chat elegía entre respuestas
// fijas por palabras clave, y abajo de todas las pantallas una barra ofrecía «Pregúntale a Executive»
// con Cmd+K. Se fue el 2026-10-01 con nueve archivos, y su lugar lo tomó un Inicio honesto: la
// mascota, el saludo y una caja que dice que el cerebro todavía no llegó.
//
// Borrar es fácil de deshacer sin darse cuenta: una rama vieja, un «restaurar» del editor, una
// tarjeta de «Reunión de hoy» que alguien vuelve a pegar desde el diseño porque «ya está dibujada».
// Esta prueba dice qué se fue y por qué, y se pone roja si vuelve cualquier pieza.
//
// Las mutaciones que la ponen en rojo: devolver `components/SidePanel.jsx`; volver a cargar un módulo
// en el arranque; un atajo Cmd+K, se escriba como se escriba (la tecla antes o después del
// modificador, `KeyK`, el código 75, `mod+k`); un clic sintetizado sobre una fila del menú, con
// `.click()` o con `dispatchEvent`; una cifra o un monto en el Inicio, también dentro de una expresión,
// en un atributo o en un componente que el Inicio importe; «Reunión de hoy» en cualquier carpeta del
// código; quitarle el `disabled` a la caja o escribirlo `disabled={false}`; y que la mascota siga viva
// fuera de la vista o se salga del centro de su caja.
//
// ── LO QUE NO VE ────────────────────────────────────────────────────────────
//
// Lee el fuente, no lo ejecuta. Una cifra armada en tiempo de ejecución (`String(n)`) no la ve; lo que
// cubre son las formas en que la maqueta estaba escrita y las que traería una copia del diseño. Y el
// `>` de una comparación escrita sin espacios (`a>0`) se leería como el cierre de una etiqueta.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { RAIZ, archivosFuente } from '../apoyo/fuente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
/* Propio y no el `limpio` de `apoyo/fuente.ts`: aquél borra desde `--` hasta el final de la línea, y en
   JSX eso se come una línea entera de `style={{ color: 'var(--txt)' }}`, con lo que haya al lado. */
const sinComentarios = (t: string): string =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const INICIO = 'components/views/ExecutiveView.jsx';
const MASCOTA = 'components/marca/Mascota.jsx';

/**
 * La etiqueta de apertura que empieza en `desde`, hasta su `>`. Recorre las llaves: el `>` de un
 * `onChange={(e) => …}` o de una comparación adentro de un atributo no la cierra.
 */
function etiqueta(codigo: string, desde: number): string {
  assert.notEqual(desde, -1, 'no se encontró la etiqueta');
  let nivel = 0;
  for (let i = desde; i < codigo.length; i += 1) {
    const c = codigo[i];
    if (c === '{') nivel += 1;
    else if (c === '}') nivel -= 1;
    else if (c === '>' && nivel === 0) return codigo.slice(desde, i + 1);
  }
  return codigo.slice(desde);
}

/** Todas las etiquetas de apertura de un elemento. */
const etiquetas = (codigo: string, nombre: string): string[] =>
  [...codigo.matchAll(new RegExp(`<${nombre}\\b`, 'g'))].map((m) => etiqueta(codigo, m.index!));

/**
 * Las cifras escritas a mano en un componente: lo que el Inicio no puede llevar.
 *
 * · el texto del marcado con dígitos (el `>` que lo abre tiene que cerrar una etiqueta: pegado a una
 *   letra, una comilla, una llave o una barra, no a un espacio como el de `a > 0`);
 * · un número como hijo (`<b>{12}</b>`) o como atributo que no sea de forma (`cifra={12}`);
 * · una cadena con dígitos, en una expresión o en un atributo, salvo los de forma: el trazo y la caja
 *   de un SVG, una clase y un id;
 * · un monto, en la moneda que sea.
 */
function cifrasEscritas(codigo: string): string[] {
  const halladas: string[] = [];
  for (const m of codigo.matchAll(/(?<=[\w"'}/])>([^<>{}]*\d[^<>{}]*)</g)) halladas.push(m[1]!.trim());
  for (const m of codigo.matchAll(/>\s*\{\s*\d[\d.,]*\s*\}/g)) halladas.push(m[0]);
  for (const m of codigo.matchAll(/\b([\w-]+)=\{\s*\d[\d.,]*\s*\}/g)) {
    if (!['rows', 'diametro'].includes(m[1]!)) halladas.push(m[0]);
  }
  for (const m of codigo.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)) {
    if (!/\d/.test(m[2]!)) continue;
    if (/\b(d|viewBox|className|id)=$/.test(codigo.slice(Math.max(0, m.index! - 12), m.index))) continue;
    halladas.push(m[0]);
  }
  for (const m of codigo.matchAll(/(S\/|USD|US\$|€|\$)\s?\d/g)) halladas.push(m[0]);
  return halladas;
}

test('los nueve archivos de la maqueta no existen, y el centro de mando no los monta', () => {
  const SE_FUERON: [string, string][] = [
    ['lib/aios/executive.js', 'el mapa y el embudo, con las cifras escritas a mano'],
    ['lib/aios/executive-panel.js', 'la reunión y los cambios de la maqueta, también escritos a mano'],
    ['lib/aios/executive-chat.js', 'el chat que elegía entre respuestas fijas por palabras clave'],
    ['lib/aios/leads-group.js', 'el cajón «Grupo de contactos», que sólo abría el embudo de la maqueta'],
    ['lib/aios/datepicker.js', 'el calendario de una píldora de período escondida'],
    ['lib/aios/period-controls.js', 'los controles de esa misma píldora'],
    ['components/SidePanel.jsx', 'el panel lateral con la reunión de la maqueta'],
    ['components/AskBar.jsx', 'la barra «Pregúntale a Executive sobre …», un chat sin cerebro (`NE-09`)'],
    ['components/Overlays.jsx', 'los cajones y el modal que sólo abrían los módulos de arriba'],
  ];
  for (const [archivo, que] of SE_FUERON) {
    assert.equal(existsSync(join(RAIZ, archivo)), false, `volvió \`${archivo}\`: ${que}`);
  }
  assert.doesNotMatch(sinComentarios(leer('components/CommandCenter.jsx')), /\b(SidePanel|AskBar|Overlays)\b/, 'el centro de mando vuelve a montar una pieza de la maqueta');
});

test('el arranque carga un solo módulo: el armazón', () => {
  const arranque = sinComentarios(leer('lib/aios/index.js'));
  const importados = [...arranque.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/([\w-]+)'/g)].map((m) => [m[1]!.trim(), m[2]]);
  assert.deepEqual(importados, [['initShell', 'shell']], 'el arranque vuelve a cargar un módulo de pantalla');
  assert.match(arranque, /const MODULOS = \[\s*initShell\s*\];/, 'los módulos del arranque no son sólo el armazón');
  assert.match(arranque, /export function bootAios\(\)/, 'el centro de mando llama a `bootAios`, y ya no existe');
});

test('no hay atajo Cmd+K', () => {
  /* Abría el panel del chat de la maqueta. Un atajo de teclado que abre «el cerebro» sin cerebro es la
     misma promesa falsa que la barra, en otro lugar. Vuelve con el cerebro (`NE-09`).

     Las dos mitades se buscan por separado, en el mismo archivo y sin orden ni distancia: el
     modificador por un lado y la tecla por el otro. Pedirlas juntas, el modificador primero, dejaba
     pasar la forma más común, `e.key === 'k' && (e.metaKey || e.ctrlKey)`. */
  const MODIFICADOR = /\b(metaKey|ctrlKey)\b|getModifierState\(/;
  const TECLA = /\bkey\b[^;\n]{0,60}?['"`][kK]['"`]|['"`]KeyK['"`]|\bkeyCode\b[^;\n]{0,20}?\b75\b/;
  const ATAJO_ESCRITO = /['"`](mod|meta|ctrl|cmd)\+k['"`]|⌘|&#8984;|\\u2318/i;
  const conAtajo = archivosFuente(['app', 'components', 'lib'])
    .filter((a) => /\.(jsx?|tsx?)$/.test(a.ruta))
    .filter((a) => {
      const codigo = sinComentarios(a.contenido);
      return (MODIFICADOR.test(codigo) && TECLA.test(codigo)) || ATAJO_ESCRITO.test(codigo);
    })
    .map((a) => a.ruta);
  assert.deepEqual(conAtajo, [], 'volvió un atajo Cmd+K');
});

test('nadie navega haciendo clic en una fila del menú', () => {
  /* Los módulos de la maqueta navegaban sintetizando `.nav-item[data-view=…].click()`: dependían de que
     la fila existiera en el DOM y de que el armazón le hubiera enganchado su oyente. Se navega con
     `irALaVista` (`docs/OTROS/nueva-estructura/07-LO-QUE-SE-ROMPE-EN-SILENCIO.md`). Se marca cualquier
     clic sintetizado —`.click()` o `dispatchEvent` de un evento de clic— en un archivo que nombre las
     filas del menú, sin medir la distancia entre las dos cosas. */
  const CLIC = /\.click\(\s*\)|dispatchEvent\(\s*new\s+(Mouse|Pointer)?Event\(\s*['"`]click/;
  const MENU = /\[data-view|nav-item/;
  const conClic = archivosFuente(['app', 'components', 'lib'])
    .filter((a) => /\.(jsx?|tsx?)$/.test(a.ruta))
    .filter((a) => {
      const codigo = sinComentarios(a.contenido);
      return MENU.test(codigo) && CLIC.test(codigo);
    })
    .map((a) => a.ruta);
  assert.deepEqual(conClic, [], 'alguien vuelve a navegar con un clic sintetizado sobre el menú');
});

test('el Inicio no lleva cifras escritas, ni las tarjetas de la reunión, ni los ganchos de la maqueta', () => {
  const inicio = sinComentarios(leer(INICIO));
  // En el Inicio, un número escrito a mano es una afirmación inventada.
  assert.deepEqual(cifrasEscritas(inicio), [], 'el Inicio escribe cifras a mano');
  /* Y lo mismo en lo que el Inicio importe de `components/`: traer las tarjetas del diseño como un
     componente hijo es la forma natural de devolverlas. La mascota no escribe cifras para la persona:
     sus números son de forma. */
  for (const m of inicio.matchAll(/from\s+'(\.{1,2}\/[^']+)'/g)) {
    const ruta = posix.normalize(posix.join(dirname(INICIO).replace(/\\/g, '/'), m[1]!));
    if (!ruta.startsWith('components/') || ruta === MASCOTA) continue;
    assert.deepEqual(cifrasEscritas(sinComentarios(leer(ruta))), [], `\`${ruta}\`, que el Inicio importa, escribe cifras a mano`);
  }
  for (const gancho of ['exFunnel', 'deptGraph', 'exBrief', 'exChanges', 'exPeriod', 'exPill', 'data-leads', 'data-datepick']) {
    assert.ok(!inicio.includes(gancho), `volvió \`${gancho}\`, un gancho de la maqueta`);
  }
  /* La Reunión de hoy tiene que salir de reglas sobre datos reales, que no existen todavía (`NE-29`.4).
     La barra lateral sí la nombra desde la etapa E10, como «Próximamente» y sin contador (`NE-11`):
     eso lo vigila `193-la-barra-lateral.test.ts`, y por eso de `Nav.jsx` se saca SÓLO ese bloque antes
     de mirar. «Cambios en curso», la otra tarjeta de la maqueta, no tiene excepción en ningún archivo. */
  const sinLaFilaDeLaBarra = (a: { ruta: string; contenido: string }) =>
    a.ruta === 'components/Nav.jsx' ? a.contenido.replace(/<div className="nb-reunion">[\s\S]*?<\/div>/, '') : a.contenido;
  const conReunion = archivosFuente(['app', 'components', 'lib'])
    .filter((a) => /\.(jsx?|tsx?)$/.test(a.ruta))
    .filter((a) => /Reunión de hoy|Cambios en curso/.test(sinComentarios(sinLaFilaDeLaBarra(a))))
    .map((a) => a.ruta);
  assert.deepEqual(conReunion, [], 'volvieron las tarjetas de la reunión de la maqueta');
});

test('la caja del cerebro no manda nada ni finge una respuesta', () => {
  const inicio = sinComentarios(leer(INICIO));
  assert.doesNotMatch(inicio, /\bpedir\(|\bfetch\(/, 'el Inicio pide algo al servidor: la caja no tiene a quién preguntarle');
  /* El atributo de verdad: `disabled` solo, o `disabled={true}`. `disabled={false}` lo habilita, y
     `aria-disabled` no impide escribir. TODOS los campos y botones del Inicio: la caja no tiene nada
     que hacer todavía. */
  const deshabilitado = (tag: string) => /\sdisabled(?=[\s/>])/.test(tag) || /\sdisabled=\{\s*true\s*\}/.test(tag);
  const controles = [...etiquetas(inicio, 'textarea'), ...etiquetas(inicio, 'input'), ...etiquetas(inicio, 'button')];
  assert.ok(etiquetas(inicio, 'textarea').length > 0, 'el Inicio perdió el campo de la caja');
  assert.ok(etiquetas(inicio, 'button').some((t) => /className="inicio-enviar"/.test(t)), 'el Inicio perdió el botón de enviar');
  for (const tag of controles) {
    assert.ok(deshabilitado(tag), `un control del Inicio se puede usar: ${tag}`);
    // Y dice por qué, también al lector de pantalla.
    assert.match(tag, /aria-describedby="inicioEnCamino"/, `un control del Inicio no dice por qué está deshabilitado: ${tag}`);
  }
  assert.ok(!inicio.includes('@ agente'), 'volvió «@ agente», que no tiene a quién elegir');
  assert.match(inicio, /id="inicioEnCamino"[^>]*>\s*El cerebro llega en una próxima etapa/, 'la caja dejó de decir que el cerebro todavía no llegó');
});

test('la mascota sólo vive a la vista, y su orbe queda en el centro de su caja', () => {
  const inicio = sinComentarios(leer(INICIO));
  const mascota = sinComentarios(leer(MASCOTA));
  /* Todas las vistas siguen montadas a la vez (`NE-35`): sin esto la mascota del Inicio mira el cursor
     toda la tarde desde una pantalla escondida, con un bucle de cada cuadro y tres oyentes del
     documento. Y el saludo se recalcula con el mismo cambio. */
  assert.match(inicio, /const aLaVista = estaALaVista\('executive'\);/, 'el Inicio dejó de saber si está a la vista');
  const tag = etiqueta(inicio, inicio.indexOf('<Mascota'));
  assert.match(tag, /\sviva=\{aLaVista\}/, 'la mascota del Inicio sigue viva cuando la pantalla está escondida');
  assert.match(mascota, /\{\s*lista && viva \? <aria-mascot\b/, 'el envoltorio monta el elemento aunque no esté a la vista');
  /* El SVG mide más que la caja: sin `placeContent` la pista de la rejilla arranca en la esquina y el
     orbe cae 32 px a la derecha y 32 abajo, encima del saludo. Medido en Chrome, no deducido. */
  assert.match(mascota, /placeItems: 'center', placeContent: 'center'/, 'el orbe de la mascota no queda en el centro de su caja');
  // La cuenta de `NE-28`: un orbe de 88 es un `size` de 152.
  const orbe = /const ORBE = (\d+) \/ (\d+);/.exec(mascota);
  assert.ok(orbe, 'el envoltorio perdió la proporción del orbe');
  assert.match(mascota, /Math\.round\(diametro \/ ORBE\)/, 'el `size` ya no sale del diámetro');
  const diametro = Number(/\sdiametro=\{(\d+)\}/.exec(tag)?.[1]);
  assert.equal(diametro, 88, 'el orbe del Inicio no mide 88');
  assert.equal(Math.round(diametro / (Number(orbe[1]) / Number(orbe[2]))), 152, 'un orbe de 88 ya no es un `size` de 152');
});
