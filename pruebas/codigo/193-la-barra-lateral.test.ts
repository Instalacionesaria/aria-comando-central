// La barra lateral reparte lo que el servidor dejó ver, marca lo que se ve y no promete. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/OTROS/nueva-estructura/01-LA-ESTRUCTURA.md, NE-11 a NE-18)
//
// La barra de la etapa E10 dibuja los departamentos de `sesion.navegacion`. Cinco formas de romperla
// no fallan:
//
//   · que vuelva a decidir quién ve qué —leer el menú agrupado, los permisos, un rol— en vez de
//     repartir lo que `menuVisible()` ya dejó pasar: dos definiciones de lo mismo;
//   · que una «Próximamente» navegue, o que la Reunión de hoy muestre un contador: una puerta a nada,
//     o una cifra sin reglas detrás (`NE-05`, `NE-13`);
//   · que la entrada marcada salga del último PEDIDO y no de lo que la pantalla DIBUJA: Tools cambia
//     de pestaña por dentro, y la barra marcaría una entrada que no está abierta, en otro departamento;
//   · que el rótulo ADMIN/USUARIO salga de otra cosa que `restringido` (`NE-15`);
//   · que lo que está cerrado siga en el tabulador: los menús, la píldora sin permiso.
//
// Lo que se EJECUTA: `entradaAbierta`, `pestanaDeLaActiva`, `pestanaQueLoRetoma`, el almacén de la
// pestaña dibujada de `shell.js` (con un pedido real de por medio, sobre un documento mínimo) y la
// expresión del rótulo. La barra, el pie, la píldora y la hoja se leen del fuente: no hay un
// renderizador de React en las pruebas.
//
// Las mutaciones que la ponen en rojo: que la barra lea otra cosa de la sesión que `navegacion` y
// `arranque`, la desestructure, la pida otra vez o pida algo al servidor; destinos del engranaje
// filtrados o escritos a mano; darle un botón, un `onClick`, un `data-view`, un `role`, un `tabIndex`
// o un `onKeyDown` a una «Próximamente»; un contador en la Reunión de hoy, adentro o al lado; marcar
// por `pedidoDeVista`, por la sección sola o sin abrir el departamento en uso; que `entradaAbierta`
// ignore la pestaña o adivine; que la barra escuche la pestaña después de pintar, o no la escuche; que
// anunciar avise antes de guardar, avise dos veces, toque el pedido o avise a los oyentes de la vista;
// que las pantallas no anuncien, anuncien en un efecto común o sin la pestaña en las dependencias; el
// acordeón sin `aria-expanded`, sin `aria-controls` o sin esconder lo cerrado; el rótulo desde otra
// cosa que `restringido`, o sin dibujarlo; el engranaje sin nombre o sin estado; los menús cerrados en
// el tabulador, o cerrar sin devolver el foco; la ventana de la contraseña dentro de la barra, o abierta
// con el cajón puesto; la píldora sin la frase entera, o como botón sin permiso; el foco del cajón en
// la píldora; el punto adentro del nombre del botón, con texto al lado o fuera de su lugar; su región
// viva dentro de la barra o montada a medias; y una barra que encoge lo suyo en vez de desplazarse.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { entradaAbierta, menuPorDepartamentos } from '../../lib/autorizacion/departamentos.ts';
import { SECCIONES, menuVisible } from '../../lib/autorizacion/secciones.ts';
import { TOOLS, pestanaDeLaActiva } from '../../lib/fundaciones/herramientas.ts';
import { pestanaQueLoRetoma } from '../../lib/tools/scrapers.ts';
import {
  alCambiarDePestana,
  alCambiarDeVista,
  anunciarPestana,
  irALaVista,
  pedidoDeVista,
  pestanaDibujada,
} from '../../lib/aios/shell.js';

const fuente = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = (t: string): string =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const NAV = () => sinComentarios(fuente('components/Nav.jsx'));
const PIE = () => sinComentarios(fuente('components/MenuDeUsuario.jsx'));
const PILDORA = () => sinComentarios(fuente('components/SelectorDeEmpresa.jsx'));
const HOJA = () => fuente('app/armazon.css').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, ' ');

/** El bloque que empieza en `desde`, con sus llaves o paréntesis balanceados. */
function bloque(codigo: string, desde: number, abre = '{', cierra = '}'): string {
  let nivel = 0;
  for (let i = codigo.indexOf(abre, desde); i < codigo.length; i += 1) {
    if (codigo[i] === abre) nivel += 1;
    else if (codigo[i] === cierra && --nivel === 0) return codigo.slice(desde, i + 1);
  }
  return codigo.slice(desde);
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

/** La etiqueta que lleva `marca` (una clase, un id): empieza en el `<` anterior. */
function etiquetaCon(codigo: string, marca: string): string {
  const i = codigo.indexOf(marca);
  assert.ok(i > 0, `no se encontró ${marca}`);
  return etiqueta(codigo, codigo.lastIndexOf('<', i));
}

/** El cuerpo de una regla de la hoja, por su selector exacto (los espacios cuentan como cualquiera). */
function regla(css: string, selector: string): string {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
  const m = new RegExp(`(?:^|[{}])\\s*${escapado}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(m, `la hoja no tiene la regla \`${selector}\``);
  return m[1]!;
}

/** Un documento mínimo: lo que `irALaVista` toca, y nada más (el mismo de la 192). */
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

test('la barra lee `navegacion` y nada más', () => {
  const nav = NAV();
  assert.match(nav, /const navegacion = sesion\?\.navegacion \?\? SIN_NAVEGACION;/, 'la barra no lee la navegación del servidor');
  /* Una lista BLANCA de lo que la barra lee de la sesión: la navegación y la pantalla de arranque.
     Ni el menú agrupado, ni permisos, ni roles, ni la organización: quién ve qué ya lo decidió
     `menuVisible()`, y la regla de qué va en el engranaje (`NE-14`) vive en el servidor. */
  const leidos = new Set([...nav.matchAll(/\bsesion\??\.(\w+)/g)].map((m) => m[1]));
  assert.deepEqual([...leidos].sort(), ['arranque', 'navegacion'], 'la barra vuelve a decidir quién ve qué con otra cosa de la sesión');
  assert.doesNotMatch(nav, /\bsesion\??\.?\[|\}\s*=\s*sesion\b|\bpermisos\b|esRolDePlataforma|\bcapacidad/, 'la barra lee la sesión por otro camino, o mira permisos');
  assert.equal((nav.match(/useSesion\(/g) ?? []).length, 1, 'la barra pide la sesión más de una vez');
  assert.match(nav, /const sesion = useSesion\(\);/);
  assert.doesNotMatch(nav, /\bpedir\(|\bfetch\(/, 'la barra le pide algo al servidor por su cuenta');
  // Las entradas, los departamentos y el engranaje salen del dato, nunca de una lista escrita acá.
  assert.match(nav, /departamentos\.map\(\(d\) =>/, 'la barra dejó de recorrer los departamentos');
  assert.match(nav, /d\.entradas\.map\(\(e\) =>/, 'la barra dejó de recorrer las entradas');
  assert.match(nav, /<MenuDeUsuario sesion=\{sesion\} engranaje=\{engranaje\}/, 'el engranaje no recibe lo que el servidor dejó ver');

  // El engranaje muestra TODOS sus destinos, sin filtrarlos ni sumarle uno a mano.
  const pie = PIE();
  assert.match(pie, /const destinos = engranaje \?\? \[\];/, 'el engranaje filtra o rehace lo que el servidor dejó ver');
  const i = pie.indexOf('destinos.map((destino) =>');
  assert.ok(i > 0, 'el engranaje dejó de recorrer sus destinos');
  const recorrido = bloque(pie, i, '(', ')');
  assert.equal((pie.match(/alIrALaSeccion\??\.?\(/g) ?? []).length, 1, 'el pie navega desde otro lugar además de sus destinos: un destino escrito a mano');
  assert.match(recorrido, /alIrALaSeccion\?\.\(destino\.seccion\)/, 'un destino del engranaje no navega a su sección');
});

test('las «Próximamente» no navegan, y la Reunión de hoy no cuenta nada', () => {
  const nav = NAV();
  const m = /if \((e\.proximamente|'proximamente' in e)\)/.exec(nav);
  assert.ok(m, 'no se encontró la rama de las «Próximamente»');
  const rama = bloque(nav, m.index);
  assert.match(rama, /Próximamente/, 'una «Próximamente» no lo dice');
  assert.doesNotMatch(rama, /<button|<a\b|onClick|onKey|tabIndex|role=|irALaVista|data-view|nav-item|href=/, 'una «Próximamente» navega, o se ofrece como algo que navega');

  // La Reunión: todo lo que va dentro de su `{inicio ? ( … )}`, y nada al lado.
  const r = nav.indexOf('<div className="nb-reunion">');
  assert.ok(r > 0, 'no se encontró la Reunión de hoy');
  const antes = nav.slice(0, r);
  assert.match(antes, /\{inicio \? \(\s*$/, 'la Reunión de hoy se dibuja aunque la persona no vea el Inicio (`NE-16`)');
  const abre = antes.lastIndexOf('(');
  const reunion = bloque(nav, abre, '(', ')');
  assert.match(reunion, /Reunión de hoy/);
  assert.match(reunion, /Próximamente/, 'la Reunión de hoy dejó de decir «Próximamente»');
  const sinIconos = reunion.replace(/<svg[\s\S]*?<\/svg>/g, '');
  assert.doesNotMatch(sinIconos, /\d|\{/, 'la Reunión de hoy muestra un contador o un dato');
  const etiquetas = [...sinIconos.matchAll(/<([A-Za-z][\w.]*)[^>]*>/g)].map((e) => e[0]);
  assert.deepEqual(etiquetas, ['<div className="nb-reunion">', '<span className="n">', '<span className="nb-proximamente">'], 'la Reunión de hoy lleva algo más que su nombre y la palabra');
  assert.match(nav.slice(abre + reunion.length), /^\s*:\s*null\}\s*\{departamentos\.length > 0 \?/, 'al lado de la Reunión de hoy se dibuja otra cosa');
});

test('la entrada abierta sale de la pantalla y de la pestaña que DIBUJA', () => {
  const navegacion = menuPorDepartamentos(
    menuVisible(new Set(SECCIONES.map((s) => s.capacidadRequerida)), { restringido: false }, true),
  );
  const en = (seccion: string | null, pestana: string | null) => entradaAbierta(navegacion, seccion, pestana);
  assert.deepEqual(en('tools', 'espia'), { departamento: 'research', nombre: 'Espía de anuncios' });
  assert.deepEqual(en('tools', 'prospeccion'), { departamento: 'sales', nombre: 'Prospección en frío' });
  assert.deepEqual(en('tools', 'landing'), { departamento: 'marketing', nombre: 'Tu página' });
  assert.deepEqual(en('analizadores', 'OB'), { departamento: 'client-success', nombre: 'Analizador OB' });
  assert.deepEqual(en('acquisition', null), { departamento: 'systems', nombre: 'Acquisition' });
  // Una sección repartida sin pestaña, o con una que no es de nadie, no se adivina; el Inicio y el
  // engranaje no son de ningún departamento.
  assert.equal(en('tools', null), null);
  assert.equal(en('tools', 'inexistente'), null);
  assert.equal(en('executive', null), null);
  assert.equal(en('credenciales', null), null);
  assert.equal(en(null, null), null);

  // La barra la arma con lo que se DIBUJA, no con el último pedido, y la USA para marcar y para abrir.
  const nav = NAV();
  assert.match(nav, /const pestana = usarPestanaDibujada\(vista\);\s*const abierta = entradaAbierta\(navegacion, vista, pestana\);/, 'la barra no marca con la pestaña dibujada');
  assert.doesNotMatch(nav, /pedidoDeVista|usarPedidoDeVista/, 'la barra marca con el último pedido: miente cuando la pestaña cambia por dentro');
  assert.match(nav, /const marcada = abierta\?\.departamento === d\.clave && abierta\.nombre === e\.nombre;/, 'la entrada marcada no sale de la entrada abierta: con la sección sola se marcan las seis de Tools');
  assert.match(nav, /const enUso = abierta\?\.departamento \?\? null;/, 'el departamento en uso no sale de la entrada abierta');
  assert.match(nav, /if \(enUso !== enUsoVisto\) \{\s*setEnUsoVisto\(enUso\);\s*setDesplegado\(enUso\);\s*\}/, 'el acordeón no sigue al departamento en uso');

  // El acordeón: la cabecera dice si está abierto y qué abre, y lo cerrado sale del tabulador.
  const cabecera = etiquetaCon(nav, 'nb-cabecera');
  assert.match(cabecera, /aria-expanded=\{desplegadoEste\}/, 'la cabecera del departamento no dice si está abierto');
  assert.match(cabecera, /aria-controls=\{`nbDepartamento-\$\{d\.clave\}`\}/, 'la cabecera del departamento no dice qué abre');
  const entradas = etiquetaCon(nav, 'className="nb-entradas"');
  assert.match(entradas, /id=\{`nbDepartamento-\$\{d\.clave\}`\}/);
  assert.match(entradas, /hidden=\{!desplegadoEste\}/, 'un departamento cerrado deja sus entradas a la vista y en el tabulador');

  /* La barra escucha la pestaña en un efecto de DISEÑO: con `useSyncExternalStore`, que se suscribe
     después de pintar, quien arrancaba en Tools veía un cuadro con todo cerrado. Lee el almacén en el
     dibujo: escuchar sin leer, o leer sin escuchar, deja la marca vieja cuando Tools cambia de pestaña
     por dentro. Y al suscribirse vuelve a leer: quien está por encima de la pantalla (`ToolsView`)
     escucha DESPUÉS de que ella anunció, y sin esa segunda lectura se perdía el aviso. */
  const vista = sinComentarios(fuente('lib/vista.ts'));
  const hook = bloque(vista, vista.indexOf('export function usarPestanaDibujada'));
  assert.match(hook, /const \[, redibujar\] = useReducer\(/);
  assert.match(hook, /const leida = clave === null \? null : pestanaDibujada\(clave\);/, 'la barra no lee la pestaña dibujada');
  /* Con cada aviso, y una vez al suscribirse, mira si cambió la pestaña de SU pantalla, y sólo
     entonces redibuja: un anuncio de otra pantalla no la vuelve a dibujar entera. */
  assert.match(hook, /const mirar = \(\) => \{\s*if \(\(clave === null \? null : pestanaDibujada\(clave\)\) !== leida\) redibujar\(\);\s*\};/, 'el oyente redibuja con cualquier aviso, o no compara contra lo que dibujó');
  assert.match(hook, /useLayoutEffect\(\(\) => \{\s*const mirar[\s\S]*?const baja = alCambiarDePestana\(mirar\);\s*mirar\(\);\s*return baja;\s*\}, \[clave, leida\]\);/, 'la barra no escucha la pestaña dibujada, la escucha después de pintar, o al suscribirse no vuelve a leer: quien escucha después del aviso se lo pierde');
  assert.match(hook, /return leida;/);
  assert.doesNotMatch(hook, /useSyncExternalStore|useEffect\(/, 'la barra escucha la pestaña después de pintar');
});

test('las pantallas anuncian la pestaña que dibujan, sin pedirse nada a sí mismas', () => {
  /* La inversa de la traducción: lo que se ve. Con un `id` que no es del catálogo, el panel dibuja la
     primera herramienta (`find ?? herramientas[0]`), y eso es lo que se anuncia: la barra dice lo que
     se ve. Que un chip «Hereda de» lleve a un `id` de ICP es otro defecto, anotado en
     `docs/OTROS/estado actual/09-DEUDA-ABIERTA.md`; esto no lo da por bueno. */
  const vistas = [{ clave: 'espia' }, { clave: 'scraper' }, { clave: 'mis-leads' }];
  for (const h of TOOLS) assert.equal(pestanaDeLaActiva(TOOLS, vistas, h.id), h.clave);
  for (const v of vistas) assert.equal(pestanaDeLaActiva(TOOLS, vistas, v.clave), v.clave);
  assert.equal(pestanaDeLaActiva(TOOLS, vistas, 3), TOOLS[0]!.clave, 'con un `id` ajeno no se anuncia lo que el panel dibuja');

  /* El almacén, con un pedido de verdad de por medio: anunciar lo mismo no avisa; quien escucha lee
     la pestaña NUEVA dentro del aviso; y anunciar no toca el pedido ni su número, ni avisa a los
     oyentes de la vista. Si tocara el pedido, Tools se lo atendería a sí misma cada vez que cambia de
     pestaña por dentro. */
  const g = globalThis as { document?: unknown };
  const documento = g.document;
  g.document = documentoDePrueba(['tools']);
  const avisos: string[] = [];
  const bajas: (() => void)[] = [];
  try {
    assert.equal(irALaVista('tools', { pestana: 'prospeccion' }), true);
    const pedido = pedidoDeVista();
    assert.ok(pedido, 'no quedó el pedido de prueba');
    const numero = pedido.secuencia;
    bajas.push(
      alCambiarDePestana(() => avisos.push(String(pestanaDibujada('tools')))),
      alCambiarDeVista(() => avisos.push('vista')),
    );
    anunciarPestana('tools', 'espia');
    anunciarPestana('tools', 'espia');
    anunciarPestana('tools', 'scraper');
    assert.deepEqual(avisos, ['espia', 'scraper'], 'anunciar avisa antes de guardar, avisa dos veces lo mismo, o avisa a los oyentes de la vista');
    assert.equal(pestanaDibujada('tools'), 'scraper');
    assert.equal(pestanaDibujada('analizadores-que-no-existe'), null);
    assert.equal(pedidoDeVista(), pedido, 'anunciar una pestaña cambió el pedido: la pantalla se lo atendería a sí misma');
    assert.equal(pedidoDeVista()!.secuencia, numero, 'anunciar una pestaña subió el número del pedido');
  } finally {
    for (const baja of bajas) baja();
    g.document = documento;
  }

  /* Y las dos pantallas anuncian ANTES de pintar —con un efecto común, el primer cuadro marcaría otra
     entrada— y cada vez que cambia lo que dibujan: sin la pestaña en las dependencias, anuncian sólo
     al montar. */
  const fundaciones = sinComentarios(fuente('components/fundaciones/Fundaciones.jsx'));
  assert.match(
    fundaciones,
    /const seccion = catalogo\.seccion \?\? null;\s*useLayoutEffect\(\(\) => \{\s*if \(seccion !== null\) anunciarPestana\(seccion, pestanaDeLaActiva\(catalogo\.herramientas, vistas, activa\)\);\s*\}, \[seccion, catalogo\.herramientas, vistas, activa\]\);/,
    'Tools no anuncia la pestaña que dibuja, la anuncia después de pintar o sólo al montar',
  );
  assert.ok(fundaciones.indexOf('anunciarPestana(') < fundaciones.indexOf('if (!estado && !problema)'), 'Tools anuncia después de la pantalla de carga');
  const analizadores = sinComentarios(fuente('components/analizadores/PanelDeAnalizadores.jsx'));
  // Con un detalle abierto, la del detalle: un informe OB abierto desde «Analizador HT» es de Client Success.
  assert.match(analizadores, /const dibujada = detalle\?\.tipo === 'HT' \|\| detalle\?\.tipo === 'OB' \? detalle\.tipo : pestana;\s*useLayoutEffect\(\(\) => \{\s*anunciarPestana\('analizadores', dibujada\);\s*\}, \[dibujada\]\);/, 'Analizadores no anuncia la pestaña que dibuja, o no la del detalle abierto');
  assert.ok(analizadores.indexOf("anunciarPestana('analizadores'") < analizadores.indexOf('if (detalle !== null)'), 'Analizadores anuncia después del `return` del detalle');
});

test('el rótulo sale de `restringido`, y el engranaje abre el único menú de la cuenta', () => {
  const pie = PIE();
  /* El rótulo se EJECUTA: la expresión del fuente, con sesiones de prueba. Un permiso o un rol de
     plataforma no lo cambian; sólo `restringido`, y sin sesión no promete nada. */
  const m = /const rol = ([^;]+);/.exec(pie);
  assert.ok(m, 'no se encontró el rótulo ADMIN/USUARIO');
  const rotulo = new Function('sesion', `return ${m[1]};`) as (s: unknown) => string;
  assert.equal(rotulo({ restringido: false }), 'ADMIN');
  assert.equal(rotulo({ restringido: false, puedeConfigurarComisiones: false, permisos: [] }), 'ADMIN', 'el rótulo sale de un permiso');
  assert.equal(rotulo({ restringido: true, puedeConfigurarComisiones: true, esRolDePlataforma: true }), 'USUARIO', 'el rótulo sale de un permiso o del rol');
  assert.equal(rotulo(null), 'USUARIO', 'sin sesión, el rótulo promete ADMIN');
  assert.equal(rotulo({}), 'USUARIO', 'sin `restringido`, el rótulo promete ADMIN');
  assert.equal((pie.match(/'ADMIN'|'USUARIO'/g) ?? []).length, 2, 'el rótulo se decide en otro lugar además de `restringido`');
  assert.match(pie, /<span className="nb-rol">\{rol\}<\/span>/, 'el pie no dibuja el rótulo');
  assert.doesNotMatch(pie, /esRolDePlataforma|permisos|puede(Configurar|Borrar|Cambiar)/, 'el pie decide algo con permisos o con el rol');

  // El engranaje: se nombra por lo que abre, y dice si está abierto.
  const engranaje = etiquetaCon(pie, 'className="nb-engranaje"');
  for (const atributo of [/aria-label="Menú de la cuenta"/, /aria-haspopup="menu"/, /aria-expanded=\{abierto\}/, /ref=\{engranajeRef\}/]) {
    assert.match(engranaje, atributo, 'el engranaje no se anuncia como lo que abre, o no dice si está abierto');
  }
  assert.match(etiquetaCon(pie, 'className="menu-pop"'), /role="menu" aria-label="Menú de la cuenta"/, 'el menú de la cuenta no tiene nombre');

  /* Cerrado, el menú se esconde del todo, y cerrar con el foco adentro lo devuelve al engranaje. Sin
     eso, tras el engranaje el tabulador recorría cinco botones invisibles. */
  const hoja = HOJA();
  const cerrado = regla(hoja, '.menu-wrap .menu-pop');
  assert.match(cerrado, /visibility:\s*hidden;/, 'un menú cerrado sigue en el tabulador');
  assert.match(cerrado, /visibility 0s linear \.18s/, 'un menú cerrado se esconde antes de terminar de desvanecerse');
  const abierto = regla(hoja, '.menu-wrap.open .menu-pop');
  assert.match(abierto, /visibility:\s*visible;/, 'un menú abierto no se ve');
  assert.doesNotMatch(abierto, /visibility\s+[\d.]+s/, 'un menú abierto se ve con retraso');
  const cerrar = bloque(pie, pie.indexOf('const cerrar = useCallback('), '(', ')');
  assert.match(cerrar, /contains\(document\.activeElement\)\) engranajeRef\.current\?\.focus\(\);/, 'cerrar el menú deja el foco en un botón escondido');

  /* La ventana de la contraseña, en el `body`: dentro del cajón con `transform` quedaría encerrada. Y
     antes de abrirla, el foco al engranaje y el cajón cerrado: con el cajón puesto, tocar un campo de
     la ventana cerraba el cajón detrás, y al cerrarla el foco volvía al menú escondido. */
  assert.match(pie, /createPortal\(<CambiarPassword alCerrar=\{\(\) => setCambiando\(false\)\} \/>, document\.body\)/, 'la ventana de la contraseña se dibuja dentro de la barra');
  assert.match(pie, /setAbierto\(false\);\s*engranajeRef\.current\?\.focus\(\);\s*cerrarElMenu\(\);\s*setCambiando\(true\);/, 'la ventana de la contraseña se abre con el cajón puesto o con el foco en el menú escondido');
});

test('la píldora dice en qué empresa estás, entera, y sin permiso no es un botón', () => {
  const pildora = PILDORA();
  /* Mirando otra organización, la frase entera va al lector de pantalla y el nombre a la vista: con
     «Mirando · » delante, en 150 px quedaban seis letras de la empresa. */
  assert.match(pildora, /const mirando = Boolean\(sesion\?\.mirandoOtraOrganizacion\);/);
  assert.match(pildora, /\{mirando \? <span className="para-lectores">Mirando otra organización: <\/span> : null\}\s*\{nombre\}/, 'mirando otra organización, la píldora no lo dice entero');
  assert.doesNotMatch(pildora, /Mirando · /, 'la píldora vuelve a gastar su ancho en el prefijo');
  // Sin la capacidad, un `span`: un botón que no hace nada es una parada del tabulador que no cumple.
  assert.match(pildora, /\{puede \? \(\s*<button\s+className=\{mirando \? 'acct mirando' : 'acct'\}/, 'la píldora es un botón aunque no se pueda abrir');
  assert.match(pildora, /\) : \(\s*<span className=\{mirando \? 'acct mirando' : 'acct'\} title=\{titulo\}>/, 'sin permiso, la píldora deja de dibujarse');
  assert.match(etiquetaCon(pildora, 'className="acct-chev"'), /aria-hidden="true"/, 'el galón de la píldora entra a su nombre');
  assert.match(etiquetaCon(pildora, 'className="menu-pop"'), /role="menu" aria-label="Cambiar de empresa"/, 'el menú de las empresas no tiene nombre');
  const cerrar = bloque(pildora, pildora.indexOf('const cerrar = useCallback('), '(', ')');
  assert.match(cerrar, /contains\(document\.activeElement\)\) disparador\.current\?\.focus\(\);/, 'cerrar el menú de las empresas deja el foco en un botón escondido');
  // Y el tope de ancho va en el envoltorio, que encoge con la cabeza: con el tope en la píldora, asomaba.
  assert.match(regla(HOJA(), '.acct-wrap'), /max-width:\s*150px;/);
  assert.match(regla(HOJA(), '.acct-wrap .acct'), /max-width:\s*100%;/, 'la píldora se sale de su envoltorio');

  // Al abrir el cajón, el foco no cae en la píldora: va a la entrada marcada o al primer control de navegación.
  const shell = sinComentarios(fuente('lib/aios/shell.js'));
  const lateral = bloque(shell, shell.indexOf('function initMenuLateral'));
  assert.match(lateral, /querySelector\('\.nb-entradas:not\(\[hidden\]\) \.nav-item\[aria-current="page"\]'\)/, 'al abrir el cajón, el foco no va a la entrada marcada');
  assert.match(lateral, /\(marcada \?\? menu\.querySelector\('\.nb-nueva, \.nb-cabecera'\)\)\?\.focus\?\.\(\)/, 'sin entrada marcada, el foco no va a «Nueva conversación» ni a la primera cabecera');
  assert.doesNotMatch(lateral, /querySelector\('(button|\.nav-item)'\)/, 'al abrir el cajón, el foco vuelve al primer botón o a la primera entrada a secas');
});

test('el punto va donde el trabajo se vuelve a ver, y se anuncia fuera del botón', () => {
  assert.equal(pestanaQueLoRetoma('ad-spy'), 'espia');
  for (const fuenteDeScraping of ['maps', 'linkedin', 'facebook-ads', 'facebook-pages']) {
    assert.equal(pestanaQueLoRetoma(fuenteDeScraping), 'scraper', `un trabajo de ${fuenteDeScraping} encendería el punto del Espía`);
  }
  const nav = NAV();
  // El punto es visual: dos, uno en la entrada y otro en la cabecera, los dos mudos y sin nada al lado.
  const puntos = [...nav.matchAll(/className="nav-scrapeando"/g)];
  assert.equal(puntos.length, 2, 'el punto se dibuja en otro lugar, o en otra forma');
  for (const p of puntos) {
    const desde = nav.lastIndexOf('<', p.index);
    const tag = etiqueta(nav, desde);
    assert.match(tag, /^<span\b/);
    assert.match(tag, /aria-hidden="true"/, 'el punto entra al nombre del botón');
    assert.match(tag, /\/>$/, 'el punto lleva contenido adentro');
    assert.doesNotMatch(tag, /role=|aria-label|aria-live/, 'el punto vuelve a ser una región dentro del botón');
    assert.match(nav.slice(desde + tag.length), /^\s*:\s*null\}/, 'el punto lleva texto al lado, adentro del botón');
  }
  assert.match(nav, /const punto = e\.seccion === 'tools' && e\.pestana !== null && enVuelo\[e\.pestana\] > 0;/, 'el punto de la entrada no sale de los trabajos en vuelo de su pestaña');
  // Con su departamento cerrado, el punto va en la cabecera: si no, desde otro departamento no se ve.
  assert.match(
    nav,
    /const puntoEnLaCabecera =\s*!desplegadoEste &&\s*d\.entradas\.some\(\(e\) => e\.seccion === 'tools' && e\.pestana !== null && enVuelo\[e\.pestana\] > 0\);/,
    'el punto no se ve con su departamento cerrado',
  );
  const c = nav.indexOf('className={desplegadoEste ?');
  assert.match(nav.slice(c, nav.indexOf('</button>', c)), /\{puntoEnLaCabecera \? <span className="nav-scrapeando"/, 'el punto de la cabecera no va dentro de la cabecera');
  // El reloj no redibuja la barra si nada cambió.
  assert.match(nav, /setEnVuelo\(\(antes\) => \(antes\.espia === cuenta\.espia && antes\.scraper === cuenta\.scraper \? antes : cuenta\)\);/, 'cada vuelta del reloj redibuja la barra entera');

  /* El texto va a una región viva SIEMPRE montada y FUERA de la barra: en el teléfono el cajón cerrado
     lleva `visibility: hidden`, y una región que aparece de golpe no se anuncia. */
  const fin = nav.indexOf('</nav>');
  assert.ok(fin > 0, 'la barra dejó de ser un `<nav>`');
  const region = etiquetaCon(nav, 'id="navScrapeando"');
  const r = nav.indexOf(region);
  assert.ok(r > fin, 'la región viva del punto está dentro de la barra: en el teléfono cerrado no se anuncia');
  assert.match(nav.slice(fin + '</nav>'.length, r), /^\s*$/, 'la región viva del punto se monta a medias: una región que aparece no se anuncia');
  assert.match(region, /role="status"/, 'la región del punto no es una región viva');
  assert.match(region, /className="para-lectores"/, 'la región del punto se ve');
});

test('la barra no aplasta lo suyo: se desplaza entera', () => {
  const hoja = HOJA();
  /* Cuando la lista no entra, se desplaza la barra entera. Si sus bloques encogen, «Nueva
     conversación» queda en 20 px y el pie sale de la vista antes de que la barra se desplace. */
  assert.match(regla(hoja, '.nav > *'), /flex-shrink:\s*0;/, 'los bloques de la barra encogen en vez de desplazarse');
  // Y la barra de desplazamiento aparece en su canal, sin angostar las filas al abrir un departamento.
  assert.match(regla(hoja, '.nav'), /scrollbar-gutter:\s*stable both-edges;/, 'las filas saltan cuando aparece la barra de desplazamiento');
  // La Reunión, con «Próximamente» debajo: al lado partía el nombre en dos renglones.
  assert.match(regla(hoja, '.nb-reunion .nb-ico'), /grid-row:\s*1 \/ span 2;/, '«Próximamente» va al lado del nombre de la Reunión');
  assert.match(regla(hoja, '.nb-reunion .n, .nb-reunion .nb-proximamente'), /grid-column:\s*2;/, '«Próximamente» va al lado del nombre de la Reunión');
});
