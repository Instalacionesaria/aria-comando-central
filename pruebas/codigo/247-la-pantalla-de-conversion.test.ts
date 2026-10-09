// Conversion dibuja el front del prototipo, con sus clases y sin capas encima. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/conversion/15, CV-4)
//
// El 2026-10-09 la pestaña volvió al marcado de `aios-command-center_1.html`, con la estética al 100 %, y se
// llena con `lecturaDeConversion`. Volver atrás es fácil sin darse cuenta: pegar `estetica-op` en la sección,
// cambiar un rótulo, abrir un cajón que sólo diría «Sin dato», calcular una tasa en el navegador, o cambiar una
// frase de la lista cerrada sin pasar por el documento. Cada prueba dice cuál de esas cosas mira, y la mutación
// que la pone en rojo:
//
//   · la sección no lleva `estetica-op` y va dentro de `cv-wrap` — mutación: volver a ponerla;
//   · los cinco pasos, con las claves y los rótulos del prototipo — mutación: cambiar un rótulo;
//   · las métricas de cada tarjeta son las del servidor, cada una con su rótulo — mutación: intercambiar dos;
//   · el orden de los bloques es el del prototipo — mutación: la nota antes de la tira;
//   · las frases de los huecos son las de CV15-02, en las dos direcciones — mutación: cambiar una;
//   · no vuelven el dispositivo, «Personalizado», las bandas, `#cvWorst`, los chips sin integración, los
//     `data-leads` ni la dirección de una persona — mutación: volver a poner cualquiera;
//   · un solo chip, en el `.ch-l`, con el punto encendido sólo con los contactos al día — mutación: encenderlo
//     siempre;
//   · la alarma sólo con señales críticas, y la caída llega hecha — mutación: sacar el filtro;
//   · una cifra que no compara, con la ventana comparando, lo dice — mutación: que `Delta` calle;
//   · se multiplica por 100 en un solo lugar — mutación: un segundo `* 100`;
//   · sólo tres pasos abren cajón, y «sin observaciones» sólo donde apunta una regla, con 7 o 30 días y sin ninguna
//     señal — mutación: sumar un paso, o dibujar el pie sin mirar la ventana o las señales;
//   · el plan y las señales de Conversion se rotulan en días cerrados — mutación: `cerrados: false`;
//   · los avisos del servidor no dicen dónde están las cifras — mutación: volver a «de abajo»;
//   · lo nuevo vive en `app/conversion.css`, acotado, y nada de la estética de operación alcanza a la vista.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { PASOS as PASOS_DEL_SERVIDOR } from '../../lib/negocio/pasosDeConversion.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = (t: string): string =>
  t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{\s*\}/g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const VISTA = 'components/views/ConversionView.jsx';
const PANEL = 'components/conversion/PanelDeConversion.jsx';
const COMUN = 'components/conversion/comun.jsx';
const CAJON = 'components/conversion/CajonDelPaso.jsx';
const panel = () => sinComentarios(leer(PANEL));
const comun = () => sinComentarios(leer(COMUN));
const cajon = () => sinComentarios(leer(CAJON));

/** El cuerpo de una función de un archivo, hasta la próxima función de primer nivel. */
function funcion(fuente: string, nombre: string): string {
  const i = fuente.search(new RegExp(`\\nfunction ${nombre}\\(|\\nexport (default )?function ${nombre}\\(`));
  assert.notEqual(i, -1, `no está la función ${nombre}`);
  const j = fuente.slice(i + 1).search(/\n(export (default )?)?function \w+\(/);
  return j === -1 ? fuente.slice(i) : fuente.slice(i, i + 1 + j);
}

/** Un `new Set([...])` de claves, leído del archivo. */
function conjunto(fuente: string, nombre: string): string[] {
  const m = new RegExp(`export const ${nombre} = new Set\\(\\[([^\\]]*)\\]\\);`).exec(fuente);
  assert.ok(m, `no está el conjunto ${nombre}`);
  return [...m[1]!.matchAll(/'(\w+)'/g)].map((x) => x[1]!).sort();
}

test('la sección no lleva la estética de operación y va dentro de `cv-wrap`: el look es el del prototipo', () => {
  const vista = sinComentarios(leer(VISTA));
  assert.match(vista, /id="v-conversion"/);
  assert.doesNotMatch(vista, /estetica-op/, 'volvió `estetica-op`: es la capa que había cambiado el look (CV15-01)');
  assert.match(vista, /className=\{activa \? 'view on' : 'view'\}/);
  assert.match(vista, /className="view-scroll cre-scroll">\s*<div className="cv-wrap">\s*<PanelDeConversion \/>/, 'el envoltorio del prototipo es `view-scroll cre-scroll` y `cv-wrap`');
});

test('los cinco pasos, con las claves, los rótulos y las bajadas del prototipo', () => {
  /* Del prototipo y no de una copia en esta prueba: la referencia es el HTML. */
  const html = leer('aios-command-center_1.html');
  const bloque = html.slice(html.indexOf('const STEPS = ['), html.indexOf('];', html.indexOf('const STEPS = [')));
  const delPrototipo = [...bloque.matchAll(/\{k:'(\w+)',[^}]*?t:'([^']+)',\s*a:'([^']+)'(?:,\s*aShort:'([^']+)')?/g)].map((m) => ({
    k: m[1],
    t: m[2],
    a: m[3],
    aCorta: m[4],
  }));
  assert.equal(delPrototipo.length, 5, 'no se leyeron los cinco pasos del prototipo');

  const c = comun();
  const lista = c.slice(c.indexOf('export const PASOS = ['), c.indexOf('];', c.indexOf('export const PASOS = [')));
  const delPanel = [...lista.matchAll(/\{ k: '(\w+)', t: '([^']+)', a: '([^']+)'(?:, aCorta: '([^']+)')? \}/g)].map((m) => ({
    k: m[1],
    t: m[2],
    a: m[3],
    aCorta: m[4],
  }));

  assert.deepEqual(delPanel.map((p) => [p.k, p.t]), delPrototipo.map((p) => [p.k, p.t]), 'las claves o los títulos no son los del prototipo');
  // Y en el orden del servidor: la tarjeta de cada paso es la de su clave.
  assert.deepEqual(delPanel.map((p) => p.k), [...PASOS_DEL_SERVIDOR]);
  // Las bajadas, las del prototipo, salvo el desvío declarado de Landing (CV15-02).
  for (const [i, p] of delPanel.entries()) {
    const proto = delPrototipo[i]!;
    if (p.k === 'sesiones') {
      assert.equal(p.a, 'llegan como contacto', 'Landing perdió su desvío declarado: la familia sin página nunca abre una');
      continue;
    }
    assert.deepEqual([p.a, p.aCorta], [proto.a, proto.aCorta], `la bajada de ${p.t} no es la del prototipo`);
  }
});

test('las métricas de cada tarjeta son las que arma el servidor, con los rótulos del prototipo', () => {
  const tipo = /export type ClaveDeMetrica =([\s\S]*?);/.exec(leer('lib/negocio/pasosDeConversion.ts'))?.[1] ?? '';
  const delServidor = [...tipo.matchAll(/'(\w+)'/g)].map((m) => m[1]!).sort();
  assert.ok(delServidor.length >= 10, 'no se leyeron las métricas del servidor');

  const c = comun();
  const bloque = c.slice(c.indexOf('export const METRICAS = {'), c.indexOf('};', c.indexOf('export const METRICAS = {')));
  const rotulos = Object.fromEntries([...bloque.matchAll(/(\w+): '([^']+)'/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(Object.keys(rotulos).sort(), delServidor, 'una métrica que arma el servidor no tiene rótulo, o sobra uno');

  /* Cada métrica con SU rótulo: las claves de cada paso salen del servidor, en el orden en que las arma
     (`armarPasos`), y sus rótulos son los del prototipo (`keyMetrics`) en ese mismo orden. Las de Agenda van en
     personas y las de Landing son las de CV15-12: dos desvíos declarados. */
  const servidor = sinComentarios(leer('lib/negocio/pasosDeConversion.ts'));
  const armar = servidor.slice(servidor.indexOf('const pasos: Paso[] = ['), servidor.indexOf('return {', servidor.indexOf('const pasos: Paso[] = [')));
  const clavesDe = (paso: string): string[] => {
    const i = armar.indexOf(`clave: '${paso}',`);
    assert.notEqual(i, -1, `el servidor no arma el paso ${paso}`);
    const metricas = armar.slice(armar.indexOf('metricas: [', i), armar.indexOf('hastaElCorte', i));
    return [...metricas.matchAll(/(?:hueco\('(\w+)'\)|clave: '(\w+)')/g)].map((x) => (x[1] ?? x[2])!);
  };
  const html = leer('aios-command-center_1.html');
  const m = html.slice(html.indexOf('function keyMetrics('), html.indexOf('/* ---- recorrido ---- */'));
  const esperados: Record<string, [string, string]> = {
    sesiones: ['Vistas', 'Por la landing'],
    agenda: ['Calificados', 'Confirmados'],
  };
  for (const paso of ['vsl', 'form', 'gracias']) {
    const fila = new RegExp(`${paso}:\\s*\\[\\['([^']+)'[\\s\\S]*?\\],\\s*\\['([^']+)'`).exec(m);
    assert.ok(fila, `no se encontró ${paso} en keyMetrics`);
    esperados[paso] = [fila[1]!, fila[2]!];
  }
  for (const [paso, rotulosDelPaso] of Object.entries(esperados)) {
    const claves = clavesDe(paso);
    assert.equal(claves.length, 2, `el paso ${paso} no arma dos métricas`);
    assert.deepEqual(claves.map((k) => rotulos[k]), rotulosDelPaso, `las métricas de ${paso} no llevan sus rótulos`);
  }
});

test('los bloques van en el orden del prototipo: encabezado, tira, nota, recorrido, alarma, señales', () => {
  const t = panel();
  const principal = funcion(t, 'PanelDeConversion');
  const cabeza = principal.indexOf('className="cre-head"');
  const debajo = principal.indexOf('<Cuerpo');
  assert.ok(cabeza !== -1 && debajo !== -1, 'falta el encabezado o el cuerpo en el panel');
  assert.ok(cabeza < debajo, 'el encabezado no va primero');
  const cuerpo = funcion(t, 'Cuerpo');
  assert.ok(!cuerpo.includes('className="cre-head"'), 'el encabezado se mudó al cuerpo: se reiniciaría con cada período');
  const orden = ['<Tira', '<Nota', 'className="ghead"', 'className="journey"', '<Alarma', '<TarjetaDeSenales'].map((x) => cuerpo.indexOf(x));
  assert.ok(orden.every((x) => x !== -1), `falta un bloque: ${JSON.stringify(orden)}`);
  assert.deepEqual([...orden].sort((a, b) => a - b), orden, 'los bloques no van en el orden del prototipo');
  assert.match(funcion(t, 'Tira'), /className="cs-panels cv-panels"/);
  assert.match(funcion(t, 'Nota'), /className="cv-note"/);
  assert.match(funcion(t, 'Alarma'), /<div id="cvAlarmWrap">\s*<div className="ghead bad">/);
  // Cada tarjeta, sin banda: `jband empty` (CV15-11).
  assert.match(funcion(t, 'Tarjeta'), /<div className="jband empty" \/>/);
});

test('las frases de los huecos son las de CV15-02, ni una más ni una menos', () => {
  const c = comun();
  const bloque = c.slice(c.indexOf('export const FRASE = {'), c.indexOf('};', c.indexOf('export const FRASE = {')));
  const delPanel = [...bloque.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]!).sort();
  assert.ok(delPanel.length >= 20, 'no se leyeron las frases del panel');

  const doc = leer('docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md');
  const seccion = doc.slice(doc.indexOf('### CV15-02'), doc.indexOf('### CV15-03'));
  const delDoc = [...seccion.matchAll(/^\|[^|]+\|\s*«([^»]+)»\s*\|$/gm)].map((m) => m[1]!).sort();
  assert.deepEqual(delPanel, delDoc, 'la lista del panel y la de CV15-02 no coinciden: una frase nueva entra primero al documento');
});

test('no vuelven el dispositivo, «Personalizado», las bandas, `#cvWorst`, los chips sin integración ni los datos de una persona', () => {
  const fuente = sinComentarios(leer(VISTA)) + panel() + comun() + cajon();
  for (const [pieza, motivo] of [
    ['filterbar', 'el filtro por dispositivo: el `userAgent` está en menos de la mitad de los contactos (CV15-03)'],
    ['cvDevSeg', 'el filtro por dispositivo (CV15-03)'],
    ['Escritorio', 'el filtro por dispositivo (CV15-03)'],
    ['data-datepick', '«Personalizado» abría un rango que ninguna otra pantalla reproduce (CV15-04)'],
    ['Personalizado', '«Personalizado» abría un rango que ninguna otra pantalla reproduce (CV15-04)'],
    ['jb-zone', 'las bandas: no hay un umbral medido (CV15-11)'],
    ['jb-mark', 'las bandas: no hay un umbral medido (CV15-11)'],
    ['cvWorst', 'el contador afirmaría «todos los pasos en rango» sobre pasos que no se midieron (CV15-11)'],
    ['Clarity', 'era una cadena de texto sin integración (CV15-03)'],
    ['VTurb', 'era una cadena de texto sin integración (CV15-03)'],
    ['data-leads', 'abría un cajón con personas inventadas (CV15-24)'],
    ['referrer', 'la dirección de entrada puede llevar el nombre de la persona (CV15-24)'],
    ['.url', 'la dirección de entrada puede llevar el nombre de la persona (CV15-24)'],
    ['PISO_DE_UNA_TASA', 'el navegador no calcula tasas: llegan del servidor (CV15-22)'],
    ['estetica-op', 'es la capa que había cambiado el look (CV15-01)'],
  ] as const) {
    assert.ok(!fuente.includes(pieza), `volvió \`${pieza}\`: ${motivo}`);
  }
});

test('un solo chip, «GoHighLevel», en el `.ch-l`, con el punto encendido sólo con la lectura de contactos al día', () => {
  const t = panel();
  assert.equal([...t.matchAll(/className="src"/g)].length, 1, 'hay más de un chip de fuente');
  // En el `.ch-l`, como el prototipo: es el que `app/conversion.css` deja a la vista bajo la cabecera.
  assert.match(funcion(t, 'PanelDeConversion'), /<div className="ch-l">[\s\S]*?<span className="srcs">\s*<Fuente /, 'el chip salió del `.ch-l`');
  const fuente = funcion(t, 'Fuente');
  assert.match(fuente, /GoHighLevel/);
  assert.match(fuente, /const vivo = f\?\.estado === 'al_dia';/, 'el punto no depende de la frescura de los contactos');
  assert.match(fuente, /className=\{vivo \? 'dotx' : 'dotx apagado'\}/, 'el punto se enciende aunque la lectura esté atrasada');
  // La frescura la manda el servidor, de la tarea de contactos, con la frase de la cabecera para el `title`.
  const ruta = sinComentarios(leer('app/api/conversion/route.ts'));
  assert.match(ruta, /const f = await frescuraDe\('contactos'\);/);
  assert.match(ruta, /aviso: faltaPorFrescura\(f, LO_QUE_LEE\.conversion\.que\)/, 'el `title` del chip no es la frase de la cabecera');
});

test('una cifra que no compara lo dice, si la ventana compara (CV15-20)', () => {
  assert.match(
    comun(),
    /if \(v\.tipo === 'sin_comparacion'\) return conAnterior \? <span className="dlt flat">\{FRASE\.sinComparacion\}<\/span> : null;/,
    'una cifra que no compara queda sin nada al lado de las que llevan flecha',
  );
  const t = panel();
  assert.match(funcion(t, 'Cuerpo'), /<Tira c=\{p\.pasos\.cifras\} conAnterior=\{p\.pasos\.anterior !== null\} \/>/);
  assert.match(funcion(t, 'Cuerpo'), /conAnterior=\{p\.pasos\.anterior !== null\}\s*alAbrir/);
  /* Dónde lo dice y dónde no, decidido el 2026-10-09 (CV15-20): las celdas de personas de la tira y las métricas de
     las tarjetas, sí; la cifra grande de cada tarjeta, la celda de las vistas y la caja del cajón, no, porque ahí la
     frase no entra y la tira y la nota ya lo dicen. Una flecha nueva tiene que caer en una de las dos listas. */
  const conFrase = [...t.matchAll(/<Delta v=\{([^}]+)\} conAnterior=\{conAnterior\} \/>/g)].map((d) => d[1]!).sort();
  assert.deepEqual(conFrase, ['c.agendados.variacion', 'c.agendados.variacionDeLaTasa', 'c.contactos.variacion', 'm.variacion'], 'una cifra de la tira o una métrica no dice «sin comparación»');
  const sinFrase = [...(t + cajon()).matchAll(/<Delta v=\{([^}]+)\} \/>/g)].map((d) => d[1]!).sort();
  assert.deepEqual(sinFrase, ['c.agendados.variacion', 'c.vistas.variacion', 'paso.variacion'], 'una flecha nueva no decide si dice «sin comparación»');
  assert.equal([...(t + cajon()).matchAll(/<Delta /g)].length, conFrase.length + sinFrase.length, 'una flecha con otra forma');
});

test('la alarma sólo con señales críticas y con 7 o 30 días; la caída llega hecha', () => {
  const t = panel();
  const alarma = funcion(t, 'Alarma');
  assert.match(alarma, /if \(senales\.ventana === null\) return null;/, 'la alarma se dibuja con «Hoy» o «Completo», que no tienen señales');
  assert.match(alarma, /senales\.lista\.filter\(\(s\) => s\.gravedad === 'critica'\)/, 'la alarma muestra señales que no son críticas (CV15-19)');
  assert.match(alarma, /if \(criticas\.length === 0\) return null;/, 'la alarma se dibuja vacía');
  // El pie resta lo que mandó el servidor, contra la cohorte (CV15-16): el navegador no resta tarjetas.
  assert.match(funcion(t, 'Tarjeta'), /\{paso\.caida === null \? null : <em>−\{miles\(paso\.caida\)\}<\/em>\}/);
});

test('el navegador no calcula: se multiplica por 100 en un solo lugar', () => {
  const todo = panel() + comun() + cajon();
  assert.equal([...todo.matchAll(/\*\s*100\b/g)].length, 1, 'hay otra multiplicación por 100: todo viaja de 0 a 1 y se convierte una vez (CV15-22)');
  assert.match(comun(), /export const cien = \(v\) => Math\.round\(v \* 100\);/);
  // Si la ventana cruza el corte lo dice el servidor: la nota no compara fechas (CV15-22).
  const nota = funcion(panel(), 'Nota');
  assert.match(nota, /if \(c\.formulario\.corte !== null && c\.formulario\.laVentanaLoCruza\) \{/);
  assert.doesNotMatch(nota, /ventana\.(desde|hasta)\s*[<>]/, 'la nota decide en el navegador si la ventana cruza el corte');
  // Y una tasa bajo el piso dice «—» también en el cajón, como en su tarjeta (CV15-02).
  assert.match(cajon(), /\{tasa === undefined \? null : <span className="cv-tasa">\{o\(tasa, pf\)\}<\/span>\}/, 'la caja calla una tasa bajo el piso');
});

test('sólo Landing, Formulario y Agenda abren cajón, en un portal propio; «sin observaciones», sólo donde apunta una regla', () => {
  assert.deepEqual(conjunto(comun(), 'CON_CAJON'), ['agenda', 'form', 'sesiones'], 'VSL y Gracias no abren cajón: sólo diría «Sin dato» (CV15-13)');
  /* Los pasos con reglas son los que `pasoDeLaSenal` puede devolver, leídos de sus `return`: si mañana una regla
     apunta a la Agenda, esto se pone rojo y obliga a decirlo en la pantalla. */
  const servidor = sinComentarios(leer('lib/negocio/pasosDeConversion.ts'));
  const asignar = servidor.slice(servidor.indexOf('export function pasoDeLaSenal('), servidor.indexOf('\n}\n', servidor.indexOf('export function pasoDeLaSenal(')));
  const conReglas = [...new Set([...asignar.matchAll(/return '(\w+)';/g)].map((x) => x[1]!))].sort();
  assert.ok(conReglas.length > 0, 'no se leyeron los pasos de `pasoDeLaSenal`');
  assert.deepEqual(conjunto(comun(), 'CON_REGLAS'), conReglas, '«sin observaciones» se diría en un paso al que no apunta ninguna regla');
  /* Y se usa donde hay que usarlo (CV15-16): el pie la dice sólo con 7 o 30 días, en un paso con reglas y sin ninguna
     señal —también sin las que están sin medición—; el cajón dibuja sus Observaciones con la misma condición. */
  assert.match(
    funcion(panel(), 'Tarjeta'),
    /: senales\.length === 0 && conVentana && CON_REGLAS\.has\(s\.k\) \? \(\s*FRASE\.sinObservaciones\s*\) : null;/,
    '«sin observaciones» se dice sin mirar la ventana, la regla o las señales del paso',
  );
  assert.match(funcion(panel(), 'Cuerpo'), /conVentana=\{p\.senales\.ventana !== null\}/);
  assert.match(
    funcion(cajon(), 'Observaciones'),
    /if \(!CON_REGLAS\.has\(clave\) \|\| p\.senales\.ventana === null\) return null;/,
    'el cajón dibuja «Observaciones» en un paso sin reglas, o con «Hoy» o «Completo»',
  );

  const c = cajon();
  assert.match(c, /return createPortal\(/, 'el cajón no se monta en un portal');
  assert.match(c, /className="drawer on cv-cajon" id="cvCajon"/, 'el cajón comparte el `#drawer` del prototipo, o perdió su raíz');
  assert.match(funcion(panel(), 'Cuerpo'), /const abrir = \(clave\) => \(CON_CAJON\.has\(clave\) \? setAbierto\(clave\) : undefined\);/);
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

test('lo nuevo vive en `app/conversion.css`, acotado; nada de la estética de operación alcanza a la vista', () => {
  const globals = leer('app/globals.css');
  assert.match(globals, /@import "\.\/conversion\.css" layer\(components\);/, 'la hoja no está importada en la capa `components`');
  const propia = sinComentarios(leer('app/conversion.css'));
  const selectores = [...propia.matchAll(/([^{}@]+)\{/g)]
    .map((m) => m[1]!.trim())
    .filter((s) => s && !s.startsWith('media') && !/^\(max-width/.test(s));
  assert.ok(selectores.length > 10, 'no se leyeron los selectores de la hoja');
  for (const s of selectores) {
    for (const parte of partes(s)) {
      /* La vista, o la raíz del cajón: se monta en `document.body` y `#v-conversion` no lo alcanzaría. */
      assert.match(parte, /#v-conversion |\.cv-cajon\b/, `\`${parte}\` no está acotado a #v-conversion ni al cajón`);
    }
  }

  /* Ninguna otra hoja, fuera de la del prototipo, tiene una regla para la vista. La excepción es `senales.css`:
     la tarjeta de señales y el plan son un componente que comparten los departamentos con detector. */
  for (const nombre of readdirSync(join(RAIZ, 'app')).filter((n) => n.endsWith('.css'))) {
    if (nombre === 'aios.css' || nombre === 'conversion.css' || nombre === 'senales.css') continue;
    const t = sinComentarios(leer(`app/${nombre}`));
    assert.doesNotMatch(t, /#v-conversion\b/, `app/${nombre} tiene una regla para #v-conversion`);
  }

  /* Las cinco tarjetas coinciden línea por línea: cada métrica en dos renglones, tenga flecha o no. Sin esto, la
     única tarjeta con flechas —Landing— queda más alta y su pie corrido. */
  assert.match(propia, /#v-conversion \.jm \{ grid-template-rows: auto auto; \}/);
  assert.match(propia, /#v-conversion \.jm \.dlt,\s*#v-conversion \.jm b \{ grid-row: 2; \}/);
});

test('el plan y las señales de Conversion se rotulan en días cerrados, como se calculan desde CV-3', () => {
  const senales = sinComentarios(leer('components/senales/SenalesDelDepartamento.jsx'));
  assert.match(senales, /conversion: \{ nombre: 'Conversion', cerrados: true, conPerdida: true \},/, 'el plan dice «últimos 30 días» de unas señales en días cerrados');
});

test('los avisos del servidor no dicen dónde están las cifras: en los cajones van arriba de ellos', () => {
  for (const archivo of ['lib/negocio/embudoDelFormulario.ts', 'lib/negocio/recorridoDelLead.ts']) {
    assert.doesNotMatch(sinComentarios(leer(archivo)), /de abajo|de arriba/, `${archivo}: un aviso dice dónde están las cifras`);
  }
});
