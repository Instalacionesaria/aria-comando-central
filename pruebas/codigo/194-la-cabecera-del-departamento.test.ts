// La cabecera del departamento dice dónde estás, con las pestañas que la persona ve. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/OTROS/nueva-estructura/01-LA-ESTRUCTURA.md, NE-17 y NE-19)
//
// La etapa E11 pone arriba de cada pantalla de un departamento la ceja, el nombre de la entrada abierta
// y la fila de pestañas, y se lleva las barras propias de Tools y de Analizadores, cuyas pestañas pasaron
// a ser entradas de departamentos distintos. Cinco formas de romperla no fallan:
//
//   · que la cabecera escriba a mano la ceja, el título o las pestañas, o decida quién ve qué: dos
//     definiciones de lo mismo, que se separan en la primera sección nueva;
//   · que una «Próximamente» de la fila navegue, que la marcada no sea la que se ve, o que quede fuera
//     de la vista;
//   · que vaya dentro de `.main` —las pantallas de operación se estiran sobre su relleno, y les cortaría
//     el pie—, detrás de `<main>` —se leería después del contenido— o envuelta en otra cosa, que la deja
//     sin su área en la rejilla y sin la regla que oculta los títulos (`.app:has(> .cd)`);
//   · que una regla oculte un control —las pestañas de Closer, los períodos de Acquisition— o deje el
//     título en una de las dos formas de cabecera, o que oculte títulos donde no hay cabecera (el
//     Inicio), en cualquier hoja; en lo del engranaje, que se oculte algo más que el `h2`;
//   · que vuelva una barra propia, o un texto que mande a «Tools →», un lugar que ya no existe.
//
// Lo que se EJECUTA: `lugarDe` y la tabla de departamentos. El componente, el armazón y las hojas se
// leen del fuente: no hay un renderizador de React en las pruebas.
//
// Las mutaciones que la ponen en rojo: una ceja, un título o una pestaña escritos como texto, entre
// comillas o entre etiquetas; leer de la sesión otra cosa que `navegacion` y `arranque`, o por otro
// camino; usar la tabla de departamentos en vez de la navegación; un `return` antes de la guarda; una
// «Próximamente» con botón, `onClick`, `role`, `tabIndex`, `data-view` o `href`; marcar otra pestaña;
// navegar sin la pestaña; no traer la abierta o la del foco a la vista; dibujar la fila con una sola
// entrada; la cabecera dentro de `.main`, detrás de `<main>` o envuelta; otra raíz o sin su nombre; sin
// su área en la rejilla; ocultar títulos, pestañas o períodos con otra regla en cualquier hoja; dejar la
// cabecera vacía en el flujo; volver a dibujar la barra de Tools o la de HT/OB, con cualquier forma; las
// acciones de Analizadores a la izquierda; «Tools →», «Tools ›» o «Tools >» en `app/`, `lib/` o
// `components/`, o «en Tools» en un texto; y una fila que se desliza en la computadora, el foco por
// fuera, el nombre de una «Próximamente» fuera de la línea, dos líneas en Closer y una cabecera que no
// sigue al cuerpo en una pantalla ancha. Desde la segunda edición (`NE-45`, `NE-52`): la fila del grupo
// sin grupo, dentro de la de arriba, con otra llamada que navega, con su «Próximamente» como botón o
// con otra marcada; un grupo o una sección escritos a mano; el hover que borra la letra de la píldora
// abierta, su foco por dentro, la fila del teléfono sin deslizarse o recortando el foco; cualquier regla
// que esconda la fila del grupo, también en el teléfono; y un texto que escriba a mano dónde están los
// leads, o que vuelva a decir «Mis Leads» o «Research › Mis Leads». Y de lo del engranaje (`NE-49`):
// que no tenga cabecera, que su ceja se escriba a mano, que lleve fila de pestañas o no se marque; que
// se lleve la bajada, que la saque del flujo, que deje el `h2` debajo de la cabecera o que la bajada
// se dibuje como un segundo título.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { DEPARTAMENTOS, ENTRADAS, lugarDe } from '../../lib/autorizacion/departamentos.ts';
import { SECCIONES } from '../../lib/autorizacion/secciones.ts';

const fuente = (r: string): string => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (t: string): string =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CABECERA = () => sinComentarios(fuente('components/CabeceraDeDepartamento.jsx'));
const sinComentariosCss = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, ' ');

/** El bloque que empieza en `desde`, con sus llaves o paréntesis balanceados. */
function bloque(codigo: string, desde: number, abre = '{', cierra = '}'): string {
  let nivel = 0;
  for (let i = codigo.indexOf(abre, desde); i < codigo.length; i += 1) {
    if (codigo[i] === abre) nivel += 1;
    else if (codigo[i] === cierra && --nivel === 0) return codigo.slice(desde, i + 1);
  }
  return codigo.slice(desde);
}

/** Las reglas de una hoja con su cuerpo, también las de dentro de una consulta de medios (sin el envoltorio). */
function reglas(css: string): { selector: string; cuerpo: string }[] {
  return [...sinComentariosCss(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1]!.trim(), cuerpo: m[2]! }));
}

/** Un selector compuesto, partido por las comas de primer nivel: `:not(:has(a, b))` no se corta. */
function partir(selector: string): string[] {
  const partes: string[] = [];
  let nivel = 0;
  let actual = '';
  for (const c of selector) {
    if (c === '(') nivel += 1;
    if (c === ')') nivel -= 1;
    if (c === ',' && nivel === 0) {
      partes.push(actual.replace(/\s+/g, ' ').trim());
      actual = '';
    } else actual += c;
  }
  if (actual.trim()) partes.push(actual.replace(/\s+/g, ' ').trim());
  return partes;
}

/** Las hojas que pueden ocultar algo de una pantalla: `aios.css` y las de la capa `components`. */
function hojas(): string[] {
  const globales = fuente('app/globals.css');
  const deComponentes = [...globales.matchAll(/@import\s+"\.\/([\w./-]+\.css)"\s+layer\(components\)/g)].map((m) => `app/${m[1]}`);
  assert.ok(deComponentes.includes('app/departamentos.css'), 'no se pudieron leer las hojas de la capa `components`');
  return ['app/aios.css', ...deComponentes];
}

test('la cabecera lee de la sesión `navegacion` y `arranque`, y no escribe nada a mano', () => {
  const c = CABECERA();
  assert.match(c, /const navegacion = sesion\?\.navegacion \?\? SIN_NAVEGACION;/, 'la cabecera no lee la navegación del servidor');
  const leidos = new Set([...c.matchAll(/\bsesion\??\.(\w+)/g)].map((m) => m[1]));
  assert.deepEqual([...leidos].sort(), ['arranque', 'navegacion'], 'la cabecera decide algo con otra cosa de la sesión');
  assert.doesNotMatch(c, /\bsesion\??\.?\[|\}\s*=\s*(sesion|useSesion\(\))|\bpermisos\b|esRolDePlataforma|\bcapacidad|\bpedir\(|\bfetch\(/, 'la cabecera lee la sesión por otro camino o le pide algo al servidor');
  assert.equal((c.match(/useSesion\(/g) ?? []).length, 1, 'la cabecera pide la sesión más de una vez');
  assert.match(c, /const sesion = useSesion\(\);/);
  // Lo que ve sale de la navegación del servidor, no de la tabla: con la tabla vería de más.
  assert.doesNotMatch(c, /\b(DEPARTAMENTOS|ENTRADAS|FUERA|menuPorDepartamentos|menuVisible)\b|\.\.\./, 'la cabecera arma lo que ve con la tabla de departamentos, o lo rehace');
  assert.match(c, /const departamento = abierta \? navegacion\.departamentos\.find\(\(d\) => d\.clave === abierta\.departamento\) : null;/);
  assert.doesNotMatch(c, /\bceja\s*:/, 'la cabecera escribe su ceja');
  // La entrada abierta, con la misma cuenta que la barra lateral: lo que se DIBUJA, no el último pedido.
  assert.match(c, /const vista = usarUbicacion\(\) \?\? sesion\?\.arranque\?\.seccion\.clave \?\? null;\s*const pestana = usarPestanaDibujada\(vista\);\s*const abierta = entradaAbierta\(navegacion, vista, pestana\);/);
  assert.doesNotMatch(c, /pedidoDeVista|usarPedidoDeVista/, 'la cabecera marca con el último pedido');
  /* Sin entrada abierta ni destino del engranaje —el Inicio— no dibuja nada, y nada se dibuja antes de
     esa guarda. Lo del engranaje sale de la navegación, como lo demás (`NE-49`). */
  assert.match(c, /const delEngranaje = abierta \? null : \(navegacion\.engranaje\.find\(\(e\) => e\.seccion === vista\) \?\? null\);/, 'la cabecera del engranaje no sale de lo que el servidor dejó ver');
  const desde = c.indexOf('export default function CabeceraDeDepartamento');
  const guarda = c.indexOf('if (!(abierta && departamento) && !delEngranaje) return null;');
  assert.ok(desde > 0 && guarda > desde, 'la cabecera se dibuja donde no hay departamento ni engranaje: el Inicio');
  assert.doesNotMatch(c.slice(desde, guarda), /\breturn\b/, 'la cabecera devuelve algo antes de saber qué hay abierto');
  // La ceja, el título y las pestañas salen del dato, y ninguno está escrito como texto.
  assert.match(c, /const ceja = departamento\?\.ceja \?\? delEngranaje\.ceja;/, 'la ceja no sale del modelo');
  assert.match(c, /const nombre = departamento \? abierta\.nombre : delEngranaje\.nombre;/, 'el título no es la entrada abierta ni el destino del engranaje');
  assert.match(c, /<span className="cd-ceja">\{ceja\}<\/span>/, 'la cabecera no dibuja la ceja que sale del modelo');
  assert.match(c, /<h1 className="cd-nombre" id="cdNombre">\s*\{nombre\}\s*<\/h1>/, 'la cabecera no dibuja el nombre que sale del modelo');
  assert.match(c, /departamento\.entradas\.map\(\(e\) =>/, 'las pestañas no son las entradas del departamento');
  /* También los nombres de los grupos —«Radar» escrito a mano sería una segunda tabla (`NE-45`)— y los
     de las secciones, que son el nombre de las entradas sin nombre propio: «Closing», «Creative Insights». */
  const nombres = [
    ...DEPARTAMENTOS.flatMap((d) => [d.nombre, d.ceja]),
    ...ENTRADAS.flatMap((e) => [e.nombre, e.grupo].filter((n): n is string => Boolean(n))),
    ...SECCIONES.map((s) => s.nombre),
  ];
  for (const n of nombres) {
    for (const forma of [`>${n}<`, `'${n}'`, `"${n}"`, `\`${n}\``]) {
      assert.ok(!c.includes(forma), `la cabecera escribe a mano «${n}»`);
    }
  }
  assert.doesNotMatch(c, /SE INSTALA|irALaVista\(\s*['"`]/, 'la cabecera escribe a mano una ceja o una pantalla');
});

test('las pestañas: la marcada es la que se ve y queda a la vista, navegan con su pestaña, y las «Próximamente» no', () => {
  const c = CABECERA();
  // Las dos ramas «Próximamente», la de la fila y la del grupo: ninguna navega.
  const ramas = [...c.matchAll(/if \((e\.proximamente|s\.proximamente|'proximamente' in [es])\)/g)];
  assert.equal(ramas.length, 2, 'no se encontraron las dos ramas de las «Próximamente», la de la fila y la del grupo');
  for (const m of ramas) {
    const rama = bloque(c, m.index!);
    assert.match(rama, /Próximamente/, 'una «Próximamente» de la cabecera no lo dice');
    assert.doesNotMatch(rama, /<button|<a\b|onClick|onFocus|onKey|tabIndex|role=|irALaVista|abrir\(|data-view|href=|aria-current/, 'una «Próximamente» de la cabecera navega, o se ofrece como algo que navega');
  }
  assert.match(c, /const marcada = abierta\.nombre === e\.nombre;/, 'la pestaña marcada no es la entrada abierta');
  assert.match(c, /className=\{marcada \? 'cd-pestana on' : 'cd-pestana'\}/);
  assert.match(c, /aria-current=\{marcada \? 'page' : undefined\}/, 'la pestaña marcada no se anuncia');
  /* Las dos filas navegan con UNA función, con la sección y la pestaña de lo que tocan: «Tu landing»
     sin su pestaña abriría la última de Tools, y «De GHL» es otra pantalla que la abierta (`NE-46`). */
  assert.match(c, /const abrir = \(e\) => irALaVista\(e\.seccion, \{ pestana: e\.pestana \}\);/, 'una pestaña no abre su pestaña: «Tu landing» abriría la última de Tools');
  assert.equal((c.match(/irALaVista\(/g) ?? []).length, 1, 'la cabecera navega desde otro lugar además de sus pestañas');
  assert.match(c, /onClick=\{\(\) => abrir\(e\)\}/, 'una pestaña de la fila no navega');
  assert.match(c, /onClick=\{\(\) => abrir\(s\)\}/, 'una sub-pestaña del grupo no navega');
  assert.equal((c.match(/onClick=/g) ?? []).length, 2, 'la cabecera navega con otro botón');

  // La fila del grupo: sólo con un grupo abierto, sus sub-pestañas, y marcada la que se ve (`NE-45`).
  assert.match(c, /const subs = !departamento \|\| abierta\.sub === null \? null : \(departamento\.entradas\.find\(\(e\) => e\.nombre === abierta\.nombre\)\?\.subs \?\? null\);/, 'la fila del grupo no sale de las sub-pestañas de la entrada abierta');
  assert.match(c, /\{subs \? \(\s*<nav className="cd-subs" ref=\{filaDelGrupo\} aria-label=\{`Pestañas de \$\{abierta\.nombre\}`\}>\s*\{subs\.map\(\(s\) =>/, 'la fila del grupo no es una navegación con nombre, o se dibuja sin grupo');
  // Y va DEBAJO de la línea: fuera de la fila de arriba, que es la que lleva la línea.
  assert.match(c, /<\/nav>\s*\) : null\}\s*<\/div>\s*\{subs \? \(/, 'la fila del grupo no va justo después de cerrar la de arriba: dentro, la línea queda debajo de las píldoras');
  assert.match(c, /const marcada = abierta\.sub === s\.nombre;/, 'la sub-pestaña marcada no es la abierta');
  assert.match(c, /className=\{marcada \? 'cd-sub on' : 'cd-sub'\}/);
  assert.equal((c.match(/aria-current=\{marcada \? 'page' : undefined\}/g) ?? []).length, 2, 'la sub-pestaña marcada no se anuncia');
  // Con una sola entrada no hay fila: una sola pestaña no es una pestaña, como en Ajustes.
  assert.match(c, /const conPestanas = departamento \? departamento\.entradas\.length > 1 : false;/, 'la fila se dibuja con una sola entrada');
  assert.match(c, /\{conPestanas \? \(\s*<nav className="cd-pestanas" ref=\{fila\} aria-label=\{`Pestañas de \$\{departamento\.nombre\}`\}>/, 'la fila de pestañas no es una navegación con nombre');
  /* La abierta, y la que recibe el foco, a la vista dentro de la fila: en el teléfono la fila se
     desliza, y la abierta de Sales quedaba afuera. Los dos ganchos van antes de la guarda. */
  assert.match(c, /useLayoutEffect\(\(\) => \{\s*traerALaVista\(fila\.current, fila\.current\?\.querySelector\('\.cd-pestana\.on'\)\);\s*traerALaVista\(filaDelGrupo\.current, filaDelGrupo\.current\?\.querySelector\('\.cd-sub\.on'\)\);\s*\}, \[nombreAbierto, subAbierta\]\);/, 'cambia la entrada o la sub-pestaña abierta y puede quedar fuera de la vista');
  assert.ok(c.indexOf('useLayoutEffect(') < c.indexOf('if (!(abierta && departamento) && !delEngranaje) return null;'), 'el gancho va después de un `return`: rompe las reglas de los ganchos');
  assert.match(c, /onFocus=\{\(ev\) => traerALaVista\(fila\.current, ev\.currentTarget\)\}/, 'una pestaña con el foco puede quedar a medias fuera de la vista');
  assert.match(c, /onFocus=\{\(ev\) => traerALaVista\(filaDelGrupo\.current, ev\.currentTarget\)\}/, 'una sub-pestaña con el foco puede quedar a medias fuera de la vista');
  const traer = bloque(c, c.indexOf('function traerALaVista'));
  assert.match(traer, /fila\.scrollLeft [-+]=/, 'traer a la vista mueve otra cosa que la fila');
  assert.doesNotMatch(traer, /scrollIntoView|window\.scroll/, 'traer la pestaña a la vista mueve la página');
});

test('la cabecera va en su propia área, antes de `<main>`, y es una región con nombre', () => {
  const c = CABECERA();
  // La raíz es la `.cd`: de esa clase, hija directa de `.app`, cuelgan su área y la regla de los títulos.
  assert.match(c, /return \(\s*<section className=\{`cd\$\{conPestanas \? '' : ' sin-pestanas'\}\$\{delEngranaje \? ' cd-engranaje' : ''\}`\} aria-labelledby="cdNombre">/, 'la raíz de la cabecera no es la `.cd`, no marca la del engranaje, o no es una región con el nombre de la pantalla');
  const centro = sinComentarios(fuente('components/CommandCenter.jsx'));
  assert.match(
    centro,
    /<div className="app">\s*<TopBar \/>\s*<Nav \/>\s*<CabeceraDeDepartamento \/>\s*<main className="main">/,
    'la cabecera no va entre la barra y `<main>`, hija directa de `.app`: dentro de `.main` corta el pie de las pantallas de operación, detrás se lee después del contenido, y envuelta pierde su área y la regla de los títulos',
  );
  assert.equal((centro.match(/<CabeceraDeDepartamento \/>/g) ?? []).length, 1);
  // Y su área existe en las dos rejillas: un `grid-area` sin declarar manda el elemento fuera de la rejilla.
  assert.match(reglas(fuente('app/departamentos.css')).find((r) => r.selector === '.cd')?.cuerpo ?? '', /grid-area:\s*cabecera;/, 'la cabecera no ocupa su área');
  const areas = [...sinComentariosCss(fuente('app/armazon.css')).matchAll(/grid-template-areas:\s*([^;]+);/g)].map((x) => x[1]!.replace(/\s+/g, ' ').trim());
  assert.ok(areas.includes('"nav cabecera" "nav main"'), 'la rejilla de la computadora no tiene el área de la cabecera');
  assert.ok(areas.includes('"top" "cabecera" "main"'), 'la rejilla del teléfono no tiene el área de la cabecera');
  // La hoja entra en la capa `components`, antes de `temas.css`, que va última.
  const globales = fuente('app/globals.css');
  const i = globales.indexOf('@import "./departamentos.css" layer(components);');
  assert.ok(i > 0 && i < globales.indexOf('@import "./temas.css" layer(components);'), 'la hoja de la cabecera no entra en la capa `components`, antes de `temas.css`');
});

test('lo que se oculta de las pantallas es el título y nada más, sólo con cabecera, en todas las hojas', () => {
  /* Toda regla de `aios.css` o de la capa `components` que oculte algo de la cabecera de una pantalla
     —`display: none`, `visibility: hidden`, un recorte, opacidad cero— es una de éstas, y ninguna
     más. Otra se llevaría las pestañas de Closer o los períodos de Acquisition, el título de una
     pantalla sin cabecera (el Inicio) o la bajada de lo del engranaje, sin que nada falle. */
  const ocultan: string[] = [];
  for (const hoja of hojas()) {
    for (const r of reglas(fuente(hoja))) {
      if (!/display:\s*none|visibility:\s*hidden|clip-path|opacity:\s*0(?![.\d])/.test(r.cuerpo)) continue;
      for (const s of partir(r.selector)) if (/cre-head|\.ch-|cl-sub|cre-desc|\bh2\b/.test(s)) ocultan.push(`${hoja}: ${s}`);
    }
  }
  assert.deepEqual(
    ocultan.sort(),
    [
      'app/armazon.css: .cl-sub::-webkit-scrollbar',
      'app/departamentos.css: .app:has(> .cd:not(.cd-engranaje)) .main .cre-head .ch-title',
      'app/departamentos.css: .app:has(> .cd:not(.cd-engranaje)) .main .cre-head > .ch-l:not(.stack)',
      'app/departamentos.css: .app:has(> .cd-engranaje) .main .cre-head .ch-title > h2',
      'app/departamentos.css: .app:has(> .cd:not(.cd-engranaje)) .main .cre-head:not(:has(.cl-sub, .ch-r))',
    ].sort(),
    'una regla oculta algo de la cabecera de una pantalla que no es su título, lo oculta donde no hay cabecera, o se lleva la bajada de lo del engranaje',
  );
  /* La cabecera de la pantalla que queda vacía sale del flujo: `display: none` no gana contra el
     `!important` de `aios.css`. Sin esto, 38 px vacíos con su línea. En lo del engranaje no queda
     vacía: le queda la bajada, y la de Ajustes dice de qué empresa es la configuración (`NE-49`). */
  const vacia = reglas(fuente('app/departamentos.css')).find((r) => r.selector.replace(/\s+/g, ' ') === '.app:has(> .cd:not(.cd-engranaje)) .main .cre-head:not(:has(.cl-sub, .ch-r))');
  assert.ok(vacia, 'la cabecera vacía de la pantalla queda en el flujo');
  assert.match(vacia.cuerpo, /position:\s*absolute;/);
  /* La bajada que queda en lo del engranaje es una descripción: la estética de operación la dibuja como
     título (24 px, negrita), y debajo del nombre de la cabecera se leían dos títulos. */
  const bajada = reglas(fuente('app/departamentos.css')).find((r) => r.selector.replace(/\s+/g, ' ') === '.app:has(> .cd-engranaje) .main :is(#v-closer, .estetica-op) .cre-head .cre-desc');
  assert.ok(bajada, 'la bajada de lo del engranaje se dibuja como un segundo título');
  assert.match(bajada.cuerpo, /font-size:\s*14px;[\s\S]*font-weight:\s*400;/, 'la bajada de lo del engranaje se dibuja como un segundo título');
  // Y el marcado no se borró: la estética de operación lo exige, y así el título vuelve sin cabecera.
  for (const v of ['ToolsView', 'AnalizadoresView', 'CloserView', 'IcpView']) {
    assert.match(fuente(`components/views/${v}.jsx`), /className="ch-title"/, `${v} perdió su título propio: sin cabecera no tendría ninguno`);
  }
});

test('Tools y Analizadores no tienen barra propia; ICP & Oferta conserva la suya', () => {
  const f = sinComentarios(fuente('components/fundaciones/Fundaciones.jsx'));
  // La barra se dibuja sólo para la pantalla que no reparte sus pestañas en la navegación.
  assert.match(f, /\{catalogo\.seccion \? null : \(\s*<div className="cl-sub fd-sub" role="tablist">/, 'Tools vuelve a dibujar su barra propia: dos filas de pestañas que dicen lo mismo');
  assert.doesNotMatch(f, /vistas\.map\(|fd-vista|fd-sep/, 'vuelven las pestañas de vista de la barra de Tools');
  assert.equal((f.match(/onClick=\{\(\) => setActiva\(h\.id\)\}/g) ?? []).length, 1, 'ICP & Oferta perdió su barra de pasos, o Tools tiene otra');
  // El catálogo de ICP & Oferta vive en `Fundaciones.jsx`: si declarara `seccion`, perdería su barra.
  const icp = /const CATALOGO_ICP = \{[\s\S]*?\n\};/.exec(f);
  assert.ok(icp, 'no se encontró el catálogo de ICP & Oferta');
  assert.doesNotMatch(icp[0], /\bseccion:/, 'ICP & Oferta declara `seccion`: perdería su barra de pasos');
  assert.match(fuente('components/views/ToolsView.jsx'), /seccion: 'tools',/);
  // Ni Tools ni Analizadores dibujan una fila de pestañas, con ninguna forma.
  for (const r of ['components/views/ToolsView.jsx', 'components/analizadores/PanelDeAnalizadores.jsx']) {
    assert.doesNotMatch(sinComentarios(fuente(r)), /cl-sub|irALaVista/, `\`${r}\` vuelve a dibujar una fila de pestañas`);
  }

  const a = sinComentarios(fuente('components/analizadores/PanelDeAnalizadores.jsx'));
  assert.doesNotMatch(a, /PESTANAS\.map\(/, 'vuelve la barra HT/OB de Analizadores');
  assert.doesNotMatch(a.slice(0, a.indexOf('function Manual')), /\['HT', 'OB'\]\.map\(/, 'vuelve la barra HT/OB de Analizadores');
  // La pestaña cambia sólo por el pedido de la navegación: no hay otro `setPestana`.
  assert.equal((a.match(/setPestana\(/g) ?? []).length, 1, 'Analizadores cambia de pestaña por otro camino que la navegación');
  // Y las acciones que vivían al lado de las pestañas siguen ahí, a la derecha.
  assert.match(a, /<div className="az-barra">\s*<div className="az-acciones">/, 'se fueron «Sincronizar con tl;dv» y «Analizar transcripción» con la barra');
  assert.match(reglas(fuente('app/closer.css')).find((r) => r.selector === '#v-analizadores .az-acciones')?.cuerpo ?? '', /margin-left:\s*auto;/, 'las acciones de Analizadores se corrieron a la izquierda');
});

test('ningún texto manda a «Tools», un lugar que ya no existe', () => {
  // `lugarDe` dice dónde vive una pestaña, con la tabla de departamentos y no a mano.
  // Con el grupo en el medio, como la barra (`NE-45`).
  assert.equal(lugarDe('tools', 'vsl'), 'Marketing › Funnel › Tu VSL');
  assert.equal(lugarDe('tools', 'mis-leads'), 'Sales › Leads › De Radar');
  assert.equal(lugarDe('analizadores', 'OB'), 'Client Success › Llamadas de onboarding');
  assert.equal(lugarDe('tools', 'inexistente'), null);
  const barra = sinComentarios(fuente('components/fundaciones/BarraDePasos.jsx'));
  assert.match(barra, /<b>\{lugarDe\(siguiente\.pantalla, siguiente\.herramienta\.clave\) \?\? 'otra pantalla'\}<\/b>/, 'la barra de pasos no dice dónde vive el paso siguiente');
  assert.doesNotMatch(barra, /<b>\{?['"`]?Tools/, 'la barra de pasos vuelve a mandar a «Tools»');

  /* Ningún archivo de `app/`, `lib/` ni `components/` manda a «Tools → …», ni en un comentario: un
     comentario que dice «Tools → …» es el que alguien copia al texto siguiente. Y ningún texto —fuera
     de los comentarios— dice «en Tools» o «a Tools»: en un comentario sí, porque es el nombre de la
     sección. */
  /* Tampoco a «Research › Mis Leads», ni en un comentario: Mis Leads se mudó a Sales › Leads › De Radar
     en la segunda edición (`NE-52`), y el agente de ICP mandaba a la persona a buscar sus leads ahí. */
  const flecha = /Tools\s*(→|›|->|>|\/)|Research\s*(→|›|>)\s*Mis Leads/;
  const lugar = /\b(?:en|a) Tools\b/;
  const malos: string[] = [];
  const recorrer = (dir: string) => {
    for (const n of readdirSync(join(RAIZ, dir))) {
      const ruta = `${dir}/${n}`;
      if (statSync(join(RAIZ, ruta)).isDirectory()) {
        if (n !== 'node_modules') recorrer(ruta);
      } else if (/\.(jsx?|tsx?|mjs)$/.test(n)) {
        const texto = fuente(ruta);
        if (flecha.test(texto) || lugar.test(sinComentarios(texto))) malos.push(ruta);
      }
    }
  };
  for (const d of ['app', 'lib', 'components']) recorrer(d);
  assert.deepEqual(malos, [], `estos archivos mandan a «Tools»: ${malos.join(', ')}`);

  /* Y los textos que dicen dónde están los leads del scraper sacan el lugar de la tabla, no lo escriben
     (`NE-52`): escrito a mano, el día que Mis Leads se mudó quedaron mandando al lugar viejo. Fuera de
     los comentarios, «Mis Leads» no aparece en ningún texto: es el nombre del componente, no un lugar. */
  const mercado = sinComentarios(fuente('lib/fundaciones/mercado.ts'));
  assert.match(mercado, /export const DONDE_ESTAN_LOS_LEADS = lugarDe\('tools', 'mis-leads'\)/);
  assert.match(mercado, /`Los negocios completos están en \$\{DONDE_ESTAN_LOS_LEADS\}\.`/, 'el resumen del mercado escribe a mano dónde están los negocios');
  assert.match(mercado, /`Las páginas completas están en \$\{DONDE_ESTAN_LOS_LEADS\}\.`/, 'el resumen del mercado escribe a mano dónde están las páginas');
  assert.match(sinComentarios(fuente('lib/fundaciones/herramientas.ts')), /`\$\{DONDE_ESTAN_LOS_LEADS\}; y que lo que se vio en el mercado/, 'la guía del agente de ICP escribe a mano dónde quedan los leads');
  const panel = sinComentarios(fuente('components/fundaciones/PanelResearch.jsx'));
  assert.equal((panel.match(/están en \$\{DONDE_ESTAN_LOS_LEADS\}/g) ?? []).length, 4, 'el panel de Research escribe a mano dónde están los leads');
  const scraper = sinComentarios(fuente('components/tools/VistaDelScraper.jsx'));
  assert.match(scraper, /const LOS_LEADS = lugarDe\('tools', 'mis-leads'\)/);
  assert.match(scraper, /queda también en\{' '\}\s*\{LOS_LEADS\}\./, 'la bajada del Scraper escribe a mano dónde quedan los leads');
  const misLeads = sinComentarios(fuente('components/tools/MisLeads.jsx'));
  assert.match(misLeads, /Los que extraigas en \$\{lugarDe\('tools', 'scraper'\)/, 'el vacío de Mis Leads escribe a mano de dónde llegan los leads');
  assert.match(misLeads, /lugarDe\('tools', 'prospeccion'\)/, 'el vacío de Mis Leads no nombra el Plan de prospección');
  assert.match(misLeads, /`Todavía no scrapeaste ningún lead\. \$\{DE_DONDE_LLEGAN\}`/, 'el vacío de Mis Leads no dice de dónde llegan');
  const sueltos: string[] = [];
  const buscar = (dir: string) => {
    for (const n of readdirSync(join(RAIZ, dir))) {
      const ruta = `${dir}/${n}`;
      if (statSync(join(RAIZ, ruta)).isDirectory()) {
        if (n !== 'node_modules') buscar(ruta);
      } else if (/\.(jsx?|tsx?|mjs)$/.test(n) && /\bMis Leads\b/.test(sinComentarios(fuente(ruta)))) sueltos.push(ruta);
    }
  };
  for (const d of ['app', 'lib', 'components']) buscar(d);
  assert.deepEqual(sueltos, [], `estos archivos dicen «Mis Leads» en un texto, un lugar que la barra ya no tiene: ${sueltos.join(', ')}`);
});

test('la fila y la cabecera se ven: nada queda fuera de la vista, ni recortado, ni doble', () => {
  const sinMedios = sinComentariosCss(fuente('app/departamentos.css')).replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ' ');
  const regla = (selector: string) => reglas(sinMedios).find((r) => r.selector.replace(/\s+/g, ' ') === selector)?.cuerpo ?? '';
  // En la computadora la fila se parte en renglones: deslizable, la abierta de Marketing quedaba afuera a 1280 px.
  assert.match(regla('.cd-pestanas'), /flex-wrap:\s*wrap;/, 'la fila de la computadora no se parte: una pestaña queda fuera de la vista');
  assert.doesNotMatch(regla('.cd-pestanas'), /overflow/, 'la fila de la computadora se desliza: una pestaña queda fuera de la vista');
  // El foco, por dentro: una fila que se desliza recorta lo que sale de ella.
  assert.match(regla('.cd .cd-pestanas button.cd-pestana:focus-visible'), /outline-offset:\s*-2px;/, 'el foco de una pestaña se dibuja por fuera y la fila lo recorta');
  // El nombre de una «Próximamente» en la línea de los demás, con la palabra colgada debajo.
  assert.match(regla('.cd-proxima .nb-proximamente'), /position:\s*absolute;/, 'el nombre de una «Próximamente» no queda en la línea de los demás');
  // La cápsula de Closer y Setter sin su línea: con la de la cabecera quedaban dos.
  assert.match(regla('.app:has(> .cd) .main :is(#v-closer, .estetica-op) .cre-head'), /border-bottom:\s*0;/, 'debajo de la cabecera quedan dos líneas en Closer y Setter');
  /* Y los costados siguen al cuerpo centrado de una pantalla ancha, en las dos filas: la `.cd` va de
     borde a borde para que la línea cruce entera, y el relleno lo llevan la de arriba y la del grupo. */
  assert.match(regla('.cd'), /--cd-costado:\s*max\(40px, calc\(\(100% - 1600px\) \/ 2 \+ 24px\)\);/, 'en una pantalla ancha la cabecera no queda alineada con el cuerpo');
  assert.doesNotMatch(regla('.cd'), /padding/, 'la `.cd` tiene relleno: la línea no cruza de borde a borde');
  assert.match(regla('.cd-arriba'), /padding:\s*28px var\(--cd-costado\) 0;/, 'la fila de arriba no sigue al cuerpo');
  assert.match(regla('.cd-arriba'), /border-bottom:\s*1px solid var\(--line\);/, 'la línea no va debajo de la fila de pestañas');
  assert.match(regla('.cd-subs'), /padding:\s*14px var\(--cd-costado\) 0;/, 'la fila del grupo no sigue al cuerpo');
  // La fila del grupo, como la de arriba: se parte en la computadora.
  assert.match(regla('.cd-subs'), /flex-wrap:\s*wrap;/, 'la fila del grupo no se parte en la computadora: una sub-pestaña queda fuera de la vista');
  assert.doesNotMatch(regla('.cd-subs'), /overflow/, 'la fila del grupo se desliza en la computadora');
  /* El foco de una píldora va por FUERA: por dentro, en la abierta caía sobre su propio fondo invertido
     y sólo cambiaba el color de un canto. En el teléfono, donde la fila se desliza y recorta, la fila
     deja abajo el lugar del anillo, y se desliza en vez de salirse del ancho. */
  assert.match(regla('.cd .cd-subs button.cd-sub:focus-visible'), /outline-offset:\s*2px;/, 'el foco de la sub-pestaña abierta cae sobre su propio fondo');
  const telefono = /@media \(max-width: 760px\) \{([\s\S]*)\}\s*$/.exec(sinComentariosCss(fuente('app/departamentos.css')))?.[1] ?? '';
  const subsDelTelefono = reglas(telefono).find((r) => r.selector === '.cd-subs')?.cuerpo ?? '';
  assert.match(subsDelTelefono, /overflow-x:\s*auto;/, 'la fila del grupo del teléfono se sale del ancho en vez de deslizarse');
  assert.match(subsDelTelefono, /padding-bottom:\s*4px;/, 'la fila del grupo del teléfono recorta el foco');
  // Bajo el puntero, la abierta conserva su letra: con el color del hover, quedaba del color de su fondo.
  assert.ok(regla('button.cd-sub:not(.on):hover'), 'el hover de las píldoras alcanza a la abierta: su nombre desaparece bajo el puntero');
  assert.ok(!reglas(sinMedios).some((r) => partir(r.selector).some((s) => /cd-sub[^s]*:hover/.test(s) && !s.includes(':not(.on)'))), 'otra regla de hover alcanza a la píldora abierta');

  /* Y ninguna hoja, ni dentro de una consulta de medios, esconde la fila del grupo: es el único camino
     al Scraper, a Tu VSL, a De Radar y al Plan de prospección. */
  const escondenElGrupo: string[] = [];
  for (const hoja of hojas()) {
    for (const r of reglas(fuente(hoja))) {
      if (!/display:\s*none|visibility:\s*hidden|clip-path|opacity:\s*0(?![.\d])/.test(r.cuerpo)) continue;
      for (const s of partir(r.selector)) if (/\.cd-subs?\b/.test(s) && !/::-webkit-scrollbar/.test(s)) escondenElGrupo.push(`${hoja}: ${s}`);
    }
  }
  assert.deepEqual(escondenElGrupo, [], 'una regla esconde la fila de sub-pestañas o una píldora');
});
