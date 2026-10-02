// La caja del cerebro al pie y CONVERSACIONES son «Próximamente»: no mandan ni prometen nada. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/OTROS/nueva-estructura/09-LA-SEGUNDA-EDICION.md, NE-50)
//
// La segunda edición devuelve, como «Próximamente», dos piezas del cerebro que la primera no dibujaba:
// la caja «Pregúntale al cerebro sobre …» al pie de cada pantalla de un departamento
// (`components/ConsultaAlCerebro.jsx`) y CONVERSACIONES en la barra (`components/Nav.jsx`). El cerebro
// no existe, así que cuatro formas de romperlas no fallan:
//
//   · que la caja mande algo, se pueda usar, traiga algo escrito o finja una respuesta: alguien
//     escribe y espera, o lee una respuesta que nadie dio;
//   · que nombre a mano la pantalla sobre la que se pregunta, o lea de la sesión algo más que la
//     navegación: una segunda tabla de lugares;
//   · que vaya dentro de `.main` —les taparía el pie a las pantallas de operación—, antes del cuerpo
//     o en el teléfono (`NE-18`), o que se dibuje en el Inicio, que tiene la suya;
//   · que CONVERSACIONES liste algo, navegue o la vea quien no ve el Inicio.
//
// El componente y la barra se leen del fuente: no hay un renderizador de React en las pruebas.
//
// Las mutaciones que la ponen en rojo: quitarle el `disabled` al campo o al botón, o escribirlo
// `disabled={false}`; un valor escrito en el campo o un párrafo de respuesta en la caja; volver a un
// `textarea`, que corta el nombre, o dejar la palabra «Próximamente» en una pantalla mediana; un
// `onSubmit`, un `onChange`, un `onKeyDown` o un `onClick`; un `pedir(` o un `fetch(`; quitarles la descripción del porqué; el nombre de una entrada escrito a mano; leer otra cosa
// de la sesión; dibujarla sin entrada abierta; montarla dentro de `.main` o antes; sin su área; visible
// en el teléfono; y CONVERSACIONES con un botón, una lista, un `onClick`, fuera de `{inicio ? (` o fuera
// de su lugar en la barra.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { DEPARTAMENTOS, ENTRADAS } from '../../lib/autorizacion/departamentos.ts';
import { SECCIONES } from '../../lib/autorizacion/secciones.ts';

const fuente = (r: string): string => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (t: string): string =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const sinComentariosCss = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, ' ');
const CAJA = () => sinComentarios(fuente('components/ConsultaAlCerebro.jsx'));

/** Las etiquetas de apertura de un elemento: recorre las llaves, así el `>` de un `=>` no la cierra. */
function etiquetas(codigo: string, nombre: string): string[] {
  const salida: string[] = [];
  for (const m of codigo.matchAll(new RegExp(`<${nombre}\\b`, 'g'))) {
    let nivel = 0;
    for (let i = m.index!; i < codigo.length; i += 1) {
      if (codigo[i] === '{') nivel += 1;
      else if (codigo[i] === '}') nivel -= 1;
      else if (codigo[i] === '>' && nivel === 0) {
        salida.push(codigo.slice(m.index!, i + 1));
        break;
      }
    }
  }
  return salida;
}

/** El bloque que empieza en `desde`, con sus paréntesis balanceados. */
function bloque(codigo: string, desde: number, abre = '(', cierra = ')'): string {
  let nivel = 0;
  for (let i = codigo.indexOf(abre, desde); i < codigo.length; i += 1) {
    if (codigo[i] === abre) nivel += 1;
    else if (codigo[i] === cierra && --nivel === 0) return codigo.slice(desde, i + 1);
  }
  return codigo.slice(desde);
}

test('la caja no manda nada, no se puede usar y dice por qué', () => {
  const c = CAJA();
  assert.doesNotMatch(c, /\bpedir\(|\bfetch\(/, 'la caja le pide algo al servidor: no tiene a quién preguntarle');
  assert.doesNotMatch(c, /\bon(Submit|Change|KeyDown|KeyUp|Input|Click)\b/, 'la caja reacciona a algo: no tiene qué hacer todavía');
  const deshabilitado = (tag: string) => /\sdisabled(?=[\s/>])/.test(tag) || /\sdisabled=\{\s*true\s*\}/.test(tag);
  const controles = [...etiquetas(c, 'textarea'), ...etiquetas(c, 'input'), ...etiquetas(c, 'button')];
  // Un campo de un renglón: el texto de muestra de un `textarea` no se corta con puntos suspensivos.
  assert.equal(etiquetas(c, 'input').length, 1, 'la caja perdió su campo');
  assert.equal(etiquetas(c, 'textarea').length, 0, 'la caja volvió a un `textarea`: a 768 px parte el nombre de la entrada');
  assert.equal(etiquetas(c, 'button').length, 1, 'la caja perdió el botón de enviar, o tiene otro');
  assert.doesNotMatch(c, /\b(value|defaultValue)=/, 'el campo trae algo escrito');
  // Y la sección lleva eso y nada más: ningún párrafo con una respuesta de muestra.
  const desde = c.indexOf('<section className="cc-consulta"');
  const seccion = c.slice(desde, c.indexOf('</section>', desde));
  const tags = [...seccion.matchAll(/<([a-z][\w]*)\b/g)].map((m) => m[1]);
  assert.deepEqual(tags, ['section', 'div', 'input', 'span', 'button', 'svg', 'path', 'span'], 'la caja lleva algo más que el campo, la palabra, el botón y su descripción');
  for (const tag of controles) {
    assert.ok(deshabilitado(tag), `un control de la caja se puede usar: ${tag}`);
    assert.match(tag, /aria-describedby="consultaEnCamino"/, `un control de la caja no dice por qué está deshabilitado: ${tag}`);
  }
  assert.match(c, /id="consultaEnCamino">\s*El cerebro llega en una próxima etapa/, 'la caja dejó de decir que el cerebro todavía no llegó');
  assert.match(c, /<span className="nb-proximamente" aria-hidden="true">\s*Próximamente\s*<\/span>/, 'la caja no dice «Próximamente» a la vista');
});

test('la caja nombra la entrada abierta con el dato, y sólo con un departamento abierto', () => {
  const c = CAJA();
  assert.match(c, /const navegacion = sesion\?\.navegacion \?\? SIN_NAVEGACION;/);
  const leidos = new Set([...c.matchAll(/\bsesion\??\.(\w+)/g)].map((m) => m[1]));
  assert.deepEqual([...leidos].sort(), ['arranque', 'navegacion'], 'la caja lee otra cosa de la sesión');
  assert.match(c, /const vista = usarUbicacion\(\) \?\? sesion\?\.arranque\?\.seccion\.clave \?\? null;\s*const pestana = usarPestanaDibujada\(vista\);\s*const abierta = entradaAbierta\(navegacion, vista, pestana\);/, 'la caja no sale de la misma cuenta que la cabecera');
  // Sin entrada abierta —el Inicio, lo del engranaje— no hay caja, y nada se dibuja antes de saberlo.
  const desde = c.indexOf('export default function ConsultaAlCerebro');
  const guarda = c.indexOf('if (!abierta) return null;');
  assert.ok(desde > 0 && guarda > desde, 'la caja se dibuja sin un departamento abierto');
  assert.doesNotMatch(c.slice(desde, guarda), /\breturn\b/);
  assert.match(c, /const sobre = `Pregúntale al cerebro sobre \$\{abierta\.nombre\}`;/, 'la caja no pregunta sobre la entrada abierta');
  assert.match(c, /placeholder=\{`\$\{sobre\}…`\}/);
  // Ningún nombre de la navegación escrito a mano.
  const nombres = [
    ...DEPARTAMENTOS.flatMap((d) => [d.nombre, d.ceja]),
    ...ENTRADAS.flatMap((e) => [e.nombre, e.grupo].filter((n): n is string => Boolean(n))),
    ...SECCIONES.map((s) => s.nombre),
  ];
  for (const n of nombres) {
    for (const forma of [`>${n}<`, `'${n}'`, `"${n}"`, `\`${n}\``, `sobre ${n}`]) assert.ok(!c.includes(forma), `la caja escribe a mano «${n}»`);
  }
});

test('la caja va en su área, después de `<main>`, y no en el teléfono', () => {
  const centro = sinComentarios(fuente('components/CommandCenter.jsx'));
  assert.match(centro, /<\/main>\s*<ConsultaAlCerebro \/>\s*<\/div>/, 'la caja no va justo después de `<main>`, hija directa de `.app`: dentro les tapa el pie a las pantallas de operación, y antes se lee antes del contenido');
  assert.equal((centro.match(/<ConsultaAlCerebro \/>/g) ?? []).length, 1);
  const hoja = sinComentariosCss(fuente('app/departamentos.css'));
  const regla = (sel: string, css: string) => new RegExp(`(?:^|[{}])\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  assert.match(regla('.cc-consulta', hoja.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ' ')), /grid-area:\s*consulta;/, 'la caja no ocupa su área');
  const telefono = /@media \(max-width: 760px\) \{([\s\S]*)\}\s*$/.exec(hoja)?.[1] ?? '';
  assert.match(regla('.cc-consulta', telefono), /display:\s*none;/, 'la caja se dibuja en el teléfono, donde la rejilla no tiene su área');
  /* En una pantalla mediana el nombre de la entrada se corta con puntos suspensivos y no a la mitad de
     una palabra, y la palabra «Próximamente» le deja el lugar: a 768 px «Llamadas de onboarding» quedaba
     en «Llamadas de o». */
  assert.match(regla('.cc-campo', hoja), /text-overflow:\s*ellipsis;/, 'el nombre de la entrada se corta a la mitad de una palabra');
  const mediana = /@media \(max-width: 1000px\) \{([^{}]*\{[^{}]*\})\s*\}/.exec(hoja)?.[1] ?? '';
  assert.match(regla('.cc-caja .nb-proximamente', mediana), /display:\s*none;/, 'en una pantalla mediana la palabra le quita al campo el lugar del nombre');
  // Y no se llama como la barra de la maqueta (`162` prohíbe `.ask`).
  assert.doesNotMatch(CAJA(), /className="[^"]*\bask\b/, 'la caja se llama como la barra de la maqueta');
});

test('CONVERSACIONES es un rótulo con «Próximamente»: no lista, no navega, y sólo con el Inicio', () => {
  const nav = sinComentarios(fuente('components/Nav.jsx'));
  const i = nav.indexOf('<div className="nb-conversaciones">');
  assert.ok(i > 0, 'la barra no dibuja CONVERSACIONES');
  const antes = nav.slice(0, i);
  assert.match(antes, /\{inicio \? \(\s*$/, 'CONVERSACIONES se dibuja aunque la persona no vea el Inicio');
  const abre = antes.lastIndexOf('(');
  const pieza = bloque(nav, abre);
  const tags = [...pieza.matchAll(/<([A-Za-z][\w.]*)[^>]*>/g)].map((e) => e[0]);
  assert.deepEqual(tags, ['<div className="nb-conversaciones">', '<span className="nb-rotulo">', '<span className="nb-proximamente">'], 'CONVERSACIONES lleva algo más que su rótulo y la palabra');
  assert.match(pieza, />CONVERSACIONES<\/span>\s*<span className="nb-proximamente">Próximamente<\/span>/);
  assert.doesNotMatch(pieza, /\{|\.map\(|onClick|data-view|role=|tabIndex|href=/, 'CONVERSACIONES lista algo o navega');
  // Debajo de los departamentos y antes del pie, como en el diseño.
  assert.ok(nav.indexOf('nb-departamentos') < i && i < nav.indexOf('className="nav-foot"'), 'CONVERSACIONES no va entre los departamentos y el pie');
});
