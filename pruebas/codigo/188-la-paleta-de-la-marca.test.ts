// La paleta de la aplicación es la de la marca, y está medida. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// UN RECOLOR SE ROMPE EN VERDE (docs/OTROS/nueva-estructura/03-LA-MARCA.md, NE-25 a NE-27)
//
// La marca v2 entró cambiando VALORES de tokens, no pantallas, y casi todo lo que puede salir mal en
// eso no lo ve ninguna prueba anterior a esta:
//
//   · **un hex sin su canal**: `--accent: #8fe3ff` con `--c-acento` en el verde viejo deja cada texto
//     cian sobre un tinte verde. Nada falla;
//   · **un color que no es de la marca**: alguien pega un verde vivo porque «se ve mejor», y vuelve
//     a haber dos acentos;
//   · **un texto que no se lee**: `ink-4` es de la marca y da 2,6:1. Que esté en la marca no lo hace
//     texto;
//   · **dos etapas que se confunden**: la `106` exige doce valores distintos, pero `#8fe3ff` y
//     `#8fe3fe` son distintos y no se distinguen;
//   · **la paleta que vuelve por otra puerta**: un segundo bloque que redefine `--accent`, o las
//     pantallas de operación con un `--bg` propio, separan otra vez la aplicación de la marca sin que
//     nada se ponga rojo;
//   · **una capa que flota y no se ve**: sin sombras, un menú del mismo color que la tarjeta de atrás
//     desaparece, y un velo del color de la página no oscurece nada.
//
// Las cuentas (contraste WCAG 2.x, OKLab de Björn Ottosson) están escritas acá abajo, sin paquetes,
// para que la prueba diga con qué número falla.
//
// Las mutaciones que la ponen en rojo: cambiar `--accent` sin `--c-acento`; un `--ok` vivo
// (`#55eb8c`, más croma que el cian); `--txt-faint` en `ink-4`; dos etapas del closer casi iguales;
// un `--accent` en el bloque `:root[data-tema]` o en el bloque base de `operacion-estetica.css`;
// volver a poner `--bg` en el bloque de operación; `--bg-flota` igual al panel; el velo en el color
// de la página; un color en `hsl()`; `--c-nube` vivo; quitar la regla del fondo liso; el token del
// radio de tarjeta escrito a mano; y editar un valor de `public/brand/tokens.css` sin `brand/tokens.json`.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { ETAPAS } from '../../lib/negocio/etapas.ts';
import { ETAPAS_DEL_SETTER } from '../../lib/negocio/etapasDelSetter.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, ' ');
const espacios = (v: string): string => v.trim().replace(/\s+/g, ' ');

/** Las declaraciones `--x: valor;` del PRIMER bloque cuyo selector es exactamente `selector`. */
function bloque(css: string, selector: string): Map<string, string> {
  const abre = css.indexOf(`${selector} {`);
  assert.ok(abre >= 0, `no está el bloque \`${selector}\``);
  const cuerpo = css.slice(css.indexOf('{', abre) + 1, css.indexOf('}', abre));
  return new Map([...cuerpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, espacios(m[2]!).toLowerCase()]));
}

const TEMAS = sinComentarios(leer('app/temas.css'));
const OSCURO = bloque(TEMAS, ":root[data-tema='oscuro']");
const CLARO = bloque(TEMAS, ":root[data-tema='claro']");
const OP_OSCURO = bloque(TEMAS, ":root[data-tema='oscuro'] :is(#v-closer, .estetica-op)");
const OP_CLARO = bloque(TEMAS, ":root[data-tema='claro'] :is(#v-closer, .estetica-op)");
const SIN_TEMA = bloque(TEMAS, ':root[data-tema]');

interface TokenDeMarca { name: string; value: string | { dark: string; light: string }; usage?: string }
const JSON_MARCA = JSON.parse(leer('brand/tokens.json')) as {
  color: { tokens: TokenDeMarca[] };
  radius: { tokens: { name: string; value: string }[] };
  spacing: { tokens: { name: string; value: string }[] };
};
const porTema = (t: TokenDeMarca, tema: 'dark' | 'light'): string =>
  (typeof t.value === 'string' ? t.value : t.value[tema]).toLowerCase();
/** Los colores de la marca en su tema oscuro, que es el de la aplicación. */
const MARCA = new Map(JSON_MARCA.color.tokens.map((t) => [t.name, porTema(t, 'dark')]));
const marca = (nombre: string): string => {
  const v = MARCA.get(nombre);
  assert.ok(v, `\`brand/tokens.json\` ya no tiene \`${nombre}\``);
  return v;
};
/**
 * El borde «que se lee solo»: la marca lo da en la nota de `line-strong` («Subir a #3A4456 si el
 * borde debe leerse solo»), y `temas.css` lo usa como `--line-strong` porque sin sombras ése es
 * siempre el caso. Se lee de la nota para que, si la marca lo cambia, la prueba lo siga.
 */
const BORDE_DE_CONTROL = (() => {
  const nota = JSON_MARCA.color.tokens.find((t) => t.name === 'line-strong')?.usage ?? '';
  const m = /Subir a (#[0-9a-f]{6})/i.exec(nota);
  assert.ok(m, 'la nota de `line-strong` en `brand/tokens.json` ya no dice a qué valor subir el borde');
  return m[1]!.toLowerCase();
})();
const valor = (bloqueDe: Map<string, string>, token: string): string => {
  const v = bloqueDe.get(token);
  assert.ok(v, `el bloque no declara \`${token}\``);
  return v;
};

// ── Las cuentas ─────────────────────────────────────────────────────────────

type Rgb = [number, number, number];
const deHex = (hex: string): Rgb => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  assert.ok(m, `\`${hex}\` no es un hex de seis cifras`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const deCanal = (canal: string): Rgb => {
  const partes = canal.trim().split(/\s+/).map(Number);
  assert.ok(partes.length === 3 && partes.every((x) => Number.isInteger(x) && x >= 0 && x <= 255), `\`${canal}\` no es un canal \`r g b\``);
  return partes as Rgb;
};
const lineal = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminancia = ([r, g, b]: Rgb): number => 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
const contraste = (a: Rgb, b: Rgb): number => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};
/** sRGB → OKLab (Ottosson, 2020). */
const oklab = ([r, g, b]: Rgb): [number, number, number] => {
  const [lr, lg, lb] = [lineal(r), lineal(g), lineal(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const croma = (c: Rgb): number => Math.hypot(oklab(c)[1], oklab(c)[2]);
const distancia = (a: Rgb, b: Rgb): number => {
  const [p, q] = [oklab(a), oklab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};
/** `color` al `alfa` encima de `fondo`, compuesto en sRGB como lo hace el navegador. */
const sobre = (color: Rgb, alfa: number, fondo: Rgb): Rgb =>
  color.map((c, i) => alfa * c + (1 - alfa) * fondo[i]!) as Rgb;
/** El canal y la opacidad de un `rgb(r g b / a)` escrito a mano. */
const rgbDe = (rgb: string): { canal: Rgb; alfa: number } => {
  const m = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\s*\)$/.exec(rgb.trim());
  assert.ok(m, `\`${rgb}\` no es un \`rgb(r g b / a)\``);
  return { canal: [Number(m[1]), Number(m[2]), Number(m[3])], alfa: Number(m[4]) };
};
const igual = (a: Rgb, b: Rgb): boolean => a.every((x, i) => x === b[i]);
const clave = (c: Rgb): string => c.join(' ');

const tokenDeEtapa = (clave: string): string => `--etapa-${clave.replace(/_/g, '-')}`;
/** Las etapas y los colores con significado que la marca no trae: la «extensión sobria» de `NE-26`. */
const EXTENSION = ['--ok', '--cola-hecho', ...[...ETAPAS, ...ETAPAS_DEL_SETTER].map((e) => tokenDeEtapa(e.clave))];

/**
 * Los colores de la marca que la INTERFAZ puede usar: todos menos los del orb (`orb-*`, `ring`), que
 * la marca reserva para adentro del orb, y los de documento (`lesson-*`). Más el borde de control.
 */
const DE_LA_MARCA = new Set([
  ...JSON_MARCA.color.tokens.filter((t) => !/^(orb-|lesson-|ring$)/.test(t.name)).map((t) => porTema(t, 'dark')),
  BORDE_DE_CONTROL,
]);

// ── Las pruebas ─────────────────────────────────────────────────────────────

test('el tema oscuro vale lo que dice la marca, token por token', () => {
  /* El mapa de `NE-25`, más lo que decidió `NE-26` (atención en `signal`, dinero en `ink`), lo que la
     familia del acento tiene que valer para que haya UN acento, y las capas que flotan. */
  const MAPA: [string, string][] = [
    ['--bg', 'bg'], ['--bg-sunk', 'bg'], ['--bg-fondo', 'bg'],
    ['--bg-panel', 'bg-alt'], ['--bg-hondo', 'bg-alt'],
    ['--bg-raise', 'surface-raised'], ['--bg-float', 'surface-active'], ['--bg-flota', 'surface-active'], ['--bg-cajon', 'surface-active'],
    ['--line', 'line'], ['--carril-del-arco', 'line-strong'],
    ['--txt', 'ink'], ['--txt-dim', 'ink-2'], ['--txt-faint', 'ink-3'],
    ['--accent', 'accent'], ['--accent-alto', 'accent'], ['--accent-hondo', 'accent'], ['--fosforo', 'accent'],
    ['--sobre-acento', 'on-ink'], ['--sobre-lleno', 'on-ink'],
    ['--crit', 'alert'], ['--dev', 'accent-2'], ['--sobre-dev', 'accent-2'], ['--warn', 'signal'], ['--exec', 'ink'],
    ['--nodo-fondo', 'surface-raised'],
  ];
  const distintos = MAPA.filter(([token, nombre]) => valor(OSCURO, token) !== marca(nombre))
    .map(([token, nombre]) => `${token} vale ${OSCURO.get(token)} y \`${nombre}\` es ${marca(nombre)}`);
  assert.deepEqual(distintos, [], 'el tema oscuro se apartó de la marca');
  assert.equal(valor(OSCURO, '--line-strong'), BORDE_DE_CONTROL, '`--line-strong` no es el borde que la marca pide cuando el borde se lee solo');

  const OP: [string, string][] = [
    ['--negro-hero', 'bg-alt'], ['--ficha-fondo', 'bg-alt'], ['--icono', 'ink-3'], ['--sobre-ok-lleno', 'on-ink'],
    ['--oro', 'ink'], ['--oro-claro', 'ink'], ['--oro-hondo', 'ink'],
  ];
  const distintosOp = OP.filter(([token, nombre]) => valor(OP_OSCURO, token) !== marca(nombre))
    .map(([token, nombre]) => `${token} vale ${OP_OSCURO.get(token)} y \`${nombre}\` es ${marca(nombre)}`);
  assert.deepEqual(distintosOp, [], 'el bloque de operación se apartó de la marca');
  assert.equal(valor(OP_OSCURO, '--ok-lleno'), valor(OSCURO, '--ok'), 'el relleno de «Unirse» no es el verde de éxito');
  assert.equal(valor(SIN_TEMA, '--ok-medio'), valor(OSCURO, '--ok'), 'el verde de «activo» sobre la media no es el verde de éxito');
});

test('cada hex va con su canal, y cada tinte escrito a mano con el canal de su color', () => {
  const PARES: [string, string][] = [
    ['--accent', '--c-acento'], ['--crit', '--c-crit'], ['--ok', '--c-ok'], ['--warn', '--c-warn'],
    ['--exec', '--c-exec'], ['--dev', '--c-dev'], ['--dev', '--c-violeta'], ['--txt', '--c-txt'], ['--txt', '--c-brillo'],
  ];
  const sueltos = PARES.filter(([hex, canal]) => !igual(deHex(valor(OSCURO, hex)), deCanal(valor(OSCURO, canal))))
    .map(([hex, canal]) => `${hex} (${OSCURO.get(hex)}) y ${canal} (${OSCURO.get(canal)})`);
  assert.deepEqual(sueltos, [], 'hex y canal dicen dos colores distintos: el texto de un tono sobre el tinte de otro');

  /* Los tokens que repiten un canal adentro de un `rgb(… / a)`: no siguen a su `--c-*` solos. */
  const COPIAS: [string, string][] = [
    ['--accent-dim', '--c-acento'], ['--nodo-borde', '--c-acento'],
    ['--exec-dim', '--c-exec'], ['--nodo-nucleo-borde', '--c-exec'],
  ];
  const viejas = COPIAS.filter(([token, canal]) => !igual(rgbDe(valor(OSCURO, token)).canal, deCanal(valor(OSCURO, canal))))
    .map(([token, canal]) => `${token} (${OSCURO.get(token)}) no lleva el canal de ${canal} (${OSCURO.get(canal)})`);
  assert.deepEqual(viejas, [], 'un tinte quedó con el canal del color viejo');

  assert.ok(igual(deHex(valor(OP_OSCURO, '--oro')), deCanal(valor(OP_OSCURO, '--c-oro'))), '`--oro` y `--c-oro` dicen dos colores');
  assert.ok(igual(deHex(valor(OSCURO, '--txt')), deCanal(valor(OP_OSCURO, '--c-blanco'))), '`--c-blanco` no es el blanco de la marca');
  assert.ok(
    igual(deHex(valor(OSCURO, '--sobre-acento')), deCanal(valor(OP_OSCURO, '--c-sobre-acento'))),
    '`--c-sobre-acento` no es el canal de `--sobre-acento`: el contador de la pestaña activa queda de otro color',
  );

  /* `--c-nube` no copia a ningún hex, pero no es libre: la línea de la marca es un tinte suyo, y por
     eso sus 145 tintes son de la familia de las líneas. Un `--c-nube` de otro matiz pinta cada borde,
     hover y píldora de un color que no es de la marca, y ninguna otra comprobación lo ve. */
  const nube = deCanal(valor(OSCURO, '--c-nube'));
  const linea = deHex(marca('line'));
  let mejor = Infinity;
  for (let a = 0.02; a <= 0.3; a += 0.0025) mejor = Math.min(mejor, distancia(sobre(nube, a, deHex(marca('bg-alt'))), linea));
  assert.ok(mejor <= 0.01, `ningún tinte de \`--c-nube\` reproduce la línea de la marca (ΔE mínimo ${mejor.toFixed(3)})`);
});

test('las superficies: los degradados que se aplanan, las capas que flotan y el velo que oscurece', () => {
  // `NE-27` aplana sin tocar `aios.css`. Cada par es el principio y el final de un degradado real:
  // `.topbar`/`.nav`, `.side`, `.ask` y la segunda capa de `.graph-wrap`.
  const EXTREMOS: [string, string][] = [['--c-alto', '--c-hundido'], ['--c-panel', '--c-hondo'], ['--c-panel', '--c-base'], ['--bg-sunk', '--bg-fondo']];
  const curvos = EXTREMOS.filter(([a, b]) => valor(OSCURO, a) !== valor(OSCURO, b)).map(([a, b]) => `${a} / ${b}`);
  assert.deepEqual(curvos, [], 'un degradado de superficie volvió a tener dos colores');
  assert.equal(valor(OSCURO, '--c-alto'), clave(deHex(marca('bg-alt'))), 'las barras no son `bg-alt`');
  assert.equal(valor(OSCURO, '--c-panel'), clave(deHex(marca('surface-raised'))), 'las tarjetas translúcidas no son `surface-raised`');

  /* Sin sombras, una capa que flota se separa de lo de atrás por ser más clara. La cabecera de los
     menús (`--bg-flota`) y la del modal (`--bg-cajon`) tienen que serlo que la tarjeta. */
  const panel = luminancia(deHex(valor(OSCURO, '--bg-panel')));
  for (const token of ['--bg-flota', '--bg-cajon']) {
    assert.ok(luminancia(deHex(valor(OSCURO, token))) > panel, `\`${token}\` no es más claro que la tarjeta: el menú desaparece contra ella`);
  }
  // Y el velo de los modales oscurece: con el color de la página encima de la página, no tapa nada.
  assert.ok(luminancia(deCanal(valor(OSCURO, '--c-velo'))) < luminancia(deHex(marca('bg'))), 'el velo de los modales no es más oscuro que la página');
});

test('hay un solo acento: todo color es de la marca o de la extensión sobria, y la extensión es más apagada que el cian', () => {
  const extension = new Set(EXTENSION.map((t) => valor(OSCURO, t)));
  const canales = new Set([...DE_LA_MARCA, ...extension].map((h) => clave(deHex(h))));
  /* Los dos canales que no copian un color: `--c-nube` lo ata la prueba de arriba a la línea de la
     marca, y `--c-velo` es el negro del velo. */
  const LIBRES = new Set(['--c-nube', '--c-velo']);
  const ajenos: string[] = [];
  for (const [nombre, bloqueDe] of [['tema', OSCURO], ['operación', OP_OSCURO]] as const) {
    for (const [token, v] of bloqueDe) {
      /* El chat imita a WhatsApp y usa sus colores: la imitación es la función
         (`operacion-estetica.css`, el bloque del chat). Es la única excepción, y está escrita. */
      if (nombre === 'operación' && token.startsWith('--chat-')) continue;
      if (/^#[0-9a-f]{6}$/.test(v)) {
        if (!DE_LA_MARCA.has(v) && !extension.has(v)) ajenos.push(`${token}: ${v} (${nombre})`);
      } else if (v.startsWith('rgb(')) {
        if (!canales.has(clave(rgbDe(v).canal))) ajenos.push(`${token}: ${v} (${nombre})`);
      } else if (/^\d+ \d+ \d+$/.test(v)) {
        if (!LIBRES.has(token) && !canales.has(v)) ajenos.push(`${token}: ${v} (${nombre})`);
      } else if (/^#|^(hsla?|hwb|lab|lch|oklab|oklch|color|rgba)\(/.test(v)) {
        ajenos.push(`${token}: ${v} (${nombre}) — escribilo como hex de seis cifras, canal \`r g b\` o \`rgb(r g b / a)\``);
      }
    }
  }
  assert.deepEqual(ajenos, [], 'estos colores no son de la marca ni de la extensión sobria');

  const cian = croma(deHex(marca('accent')));
  const vivos = EXTENSION.filter((t) => croma(deHex(valor(OSCURO, t))) >= cian)
    .map((t) => `${t} ${OSCURO.get(t)}: croma ${croma(deHex(valor(OSCURO, t))).toFixed(3)} contra ${cian.toFixed(3)} del cian`);
  assert.deepEqual(vivos, [], 'estos colores saturan tanto o más que el cian: dejaría de ser el único que llama la atención');
});

test('todo color de texto pasa 4,5:1 sobre la superficie más clara, sobre su tinte, y todo relleno con lo que lleva encima', () => {
  /* `surface-active` es la más clara de las cuatro superficies: si un texto claro pasa ahí, pasa en
     las otras tres. `ink-4` es de la marca y NO está acá: es decorativo. Un token de texto nuevo se
     agrega a esta lista: la prueba no puede adivinar qué token es texto. */
  const fondo = deHex(marca('surface-active'));
  const TEXTOS = ['--txt', '--txt-dim', '--txt-faint', '--accent', '--ok', '--warn', '--crit', '--dev', '--exec', '--sobre-dev', ...EXTENSION];
  const ilegibles = [...new Set(TEXTOS)].filter((t) => contraste(deHex(valor(OSCURO, t)), fondo) < 4.5)
    .map((t) => `${t} ${OSCURO.get(t)}: ${contraste(deHex(valor(OSCURO, t)), fondo).toFixed(2)}:1`);
  assert.deepEqual(ilegibles, [], 'estos textos no llegan a 4,5:1 sobre `surface-active`');

  // El texto sobre el tinte de su propio color, que es como se escriben las píldoras: el tinte aclara.
  for (const [texto, tinte] of [['--accent', '--accent-dim'], ['--exec', '--exec-dim']]) {
    const { canal, alfa } = rgbDe(valor(OSCURO, tinte));
    const c = contraste(deHex(valor(OSCURO, texto)), sobre(canal, alfa, fondo));
    assert.ok(c >= 4.5, `${texto} sobre ${tinte} da ${c.toFixed(2)}:1`);
  }

  const RELLENOS: [Map<string, string>, string, string][] = [
    [OSCURO, '--sobre-acento', '--accent'],
    [OSCURO, '--sobre-lleno', '--crit'],
    [OSCURO, '--sobre-lleno', '--cola-hecho'],
    ...[...ETAPAS, ...ETAPAS_DEL_SETTER].map((e) => [OSCURO, '--sobre-lleno', tokenDeEtapa(e.clave)] as [Map<string, string>, string, string]),
    [OP_OSCURO, '--sobre-ok-lleno', '--ok-lleno'],
  ];
  const tapados = RELLENOS.filter(([b, texto, relleno]) => contraste(deHex(valor(b, texto)), deHex(valor(b, relleno))) < 4.5)
    .map(([b, texto, relleno]) => `${texto} sobre ${relleno}: ${contraste(deHex(valor(b, texto)), deHex(valor(b, relleno))).toFixed(2)}:1`);
  assert.deepEqual(tapados, [], 'lo que va encima de estos rellenos no se lee');
});

test('las etapas se distinguen dentro de cada embudo', () => {
  /* La `106` exige valores distintos como CADENA. Esto exige que se VEAN distintos: una distancia
     mínima en OKLab dentro de lo que se ve junto. La paleta se diseñó con 0,089 en los dos embudos;
     el piso es 0,08, el objetivo con que se buscó. */
  const PISO = 0.08;
  for (const [embudo, etapas] of [['closer', ETAPAS], ['setter', ETAPAS_DEL_SETTER]] as const) {
    const tokens = etapas.map((e) => tokenDeEtapa(e.clave));
    let peor = { d: Infinity, par: '' };
    for (let i = 0; i < tokens.length; i += 1) {
      for (let j = i + 1; j < tokens.length; j += 1) {
        const d = distancia(deHex(valor(OSCURO, tokens[i]!)), deHex(valor(OSCURO, tokens[j]!)));
        if (d < peor.d) peor = { d, par: `${tokens[i]} / ${tokens[j]}` };
      }
    }
    assert.ok(peor.d >= PISO, `en el embudo del ${embudo}, ${peor.par} están a ΔE ${peor.d.toFixed(3)}: no se distinguen`);
  }
  // Y sin mayúsculas de por medio: `#8FE3FF` y `#8fe3ff` son el mismo color.
  const todos = [...EXTENSION].map((t) => valor(OSCURO, t));
  assert.equal(new Set(todos).size, new Set(EXTENSION).size, 'dos colores de la extensión son el mismo');
});

test('nadie más redefine los tokens del tema: ni otro bloque, ni las pantallas de operación', () => {
  /* El tema vale lo que dicen sus dos bloques sólo si nada más declara esos nombres. Un
     `:root[data-tema]` con el mismo peso y más abajo, un segundo bloque oscuro, o el bloque base de
     `operacion-estetica.css`, ganan la cascada y la prueba de arriba no se entera. Las excepciones
     son tres, y cada una tiene su motivo escrito: el `:root` del prototipo (`aios.css`, en la capa
     que pierde siempre), el alcance de `/brand` (`app/brand/`) y la jerarquía de opacidades del
     héroe de Inicio (`.ck-hero`, documentada en `operacion-estetica.css`). */
  assert.equal(TEMAS.split(":root[data-tema='oscuro'] {").length - 1, 1, 'hay más de un bloque del tema oscuro');
  const nombres = new Set(OSCURO.keys());
  const hojas = readdirSync(join(RAIZ, 'app'), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.css'))
    .map((e) => relative(RAIZ, join(e.parentPath, e.name)).split(sep).join('/'))
    .filter((h) => !h.startsWith('app/brand/'));
  const ajenos: string[] = [];
  for (const hoja of hojas) {
    for (const m of sinComentarios(leer(hoja)).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = espacios(m[1]!);
      if (selector === ":root[data-tema='oscuro']" || selector === ":root[data-tema='claro']") continue;
      if (hoja === 'app/aios.css' && selector === ':root') continue;
      if (/\.ck-hero$/.test(selector)) continue;
      const pisados = [...m[2]!.matchAll(/(--[\w-]+)\s*:/g)].map((d) => d[1]!).filter((n) => nombres.has(n));
      if (pisados.length) ajenos.push(`${hoja}: \`${selector}\` redefine ${pisados.join(', ')}`);
    }
  }
  assert.deepEqual(ajenos, [], 'estos bloques redefinen tokens del tema, y la paleta deja de ser una sola');

  // Y los bloques con alcance de `temas.css`, del claro también.
  for (const [tema, op, global] of [['oscuro', OP_OSCURO, OSCURO], ['claro', OP_CLARO, CLARO]] as const) {
    const repetidos = [...op.keys()].filter((t) => global.has(t));
    assert.deepEqual(repetidos, [], `el bloque de operación del tema ${tema} redefine tokens del tema`);
  }
});

test('el fondo es liso, y los radios de las tarjetas y los campos son los de la marca', () => {
  assert.match(
    TEMAS,
    /:root\[data-tema\] body::before,\s*:root\[data-tema\] body::after\s*\{\s*content:\s*none;\s*\}/,
    'volvieron la grilla o la viñeta del fondo',
  );
  const RADIO = new Map(JSON_MARCA.radius.tokens.map((t) => [t.name, t.value]));
  assert.equal(RADIO.get('radius-sm'), '12px');
  assert.equal(RADIO.get('radius-lg'), '20px');
  const op = sinComentarios(leer('app/operacion-estetica.css'));
  assert.match(op, /--radio:\s*var\(--radius-sm\);/, 'el token del radio de los campos de operación no es el de la marca');
  assert.match(op, /--radio-tarjeta:\s*var\(--radius-lg\);/, 'el token del radio de las tarjetas de operación no es el de la marca');
});

test('`public/brand/tokens.css` dice lo mismo que `brand/tokens.json`', () => {
  /* La `184` compara la hoja generada de `/brand`; ésta es la otra copia, la que exporta el
     brandbook, y nadie la comparaba. Es la que alimenta la capa `marca`, de donde las pantallas de
     operación leen sus radios. */
  const css = sinComentarios(leer('public/brand/tokens.css'));
  for (const [selector, tema] of [[':root, [data-theme="dark"]', 'dark'], ['[data-theme="light"]', 'light']] as const) {
    const declarado = bloque(css, selector);
    const distintos = JSON_MARCA.color.tokens
      .filter((t) => tema === 'dark' || typeof t.value !== 'string')
      .filter((t) => declarado.get(`--${t.name}`) !== porTema(t, tema))
      .map((t) => `--${t.name}: ${declarado.get(`--${t.name}`)} en la hoja y ${porTema(t, tema)} en el json`);
    assert.deepEqual(distintos, [], `\`public/brand/tokens.css\` (${tema}) se apartó de \`brand/tokens.json\``);
  }
  const escalas = bloque(css, ':root');
  const escalasDistintas = [...JSON_MARCA.radius.tokens, ...JSON_MARCA.spacing.tokens]
    .filter((t) => escalas.get(`--${t.name}`) !== t.value.toLowerCase())
    .map((t) => `--${t.name}: ${escalas.get(`--${t.name}`)} en la hoja y ${t.value} en el json`);
  assert.deepEqual(escalasDistintas, [], '`public/brand/tokens.css` (escalas) se apartó de `brand/tokens.json`');
});
