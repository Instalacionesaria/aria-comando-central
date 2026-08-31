// El color de cada etapa del Pipeline: que exista, que sea distinto, y que no informe solo. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE PUEDE SALIR MAL ACÁ, Y NINGUNA DE LAS TRES COSAS FALLA SOLA
//
// 1 · **Una etapa nueva sin color.** `ETAPAS` es una lista de siete en `lib/negocio/etapas.ts`. El
//     día que alguien agregue la octava, su sección se dibuja sin canto de color — y como el resto
//     sí lo tiene, se lee como si esa columna fuera de otra clase. Nada falla.
// 2 · **Dos etapas con el mismo color.** Copiar el bloque de una y olvidarse de cambiarle el tono
//     deja dos columnas indistinguibles. Nada falla, y encima parece intencional.
// 3 · **Que el color sea la ÚNICA señal.** Medido con la matriz de Machado sobre los siete tonos:
//     el verde de «Ganado» y el coral de «Descalificado» quedan a distancia **24 en deuteranopia**
//     —contra 195 en visión normal—, o sea casi el mismo color para cerca del 8 % de los varones. Y
//     son el mejor y el peor desenlace: el par más caro de confundir que tiene esta pantalla.
//     Ningún ajuste de tono lo arregla, porque son opuestos en el eje que falta. Por eso el punto
//     cambia de FORMA, y eso también se comprueba acá.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ETAPAS_DEL_SETTER } from '../../lib/negocio/etapasDelSetter.ts';
import { ETAPAS } from '../../lib/negocio/etapas.ts';

const RAIZ = new URL('../../', import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, RAIZ), 'utf8');

/** El cuerpo de un bloque `:root[data-tema='…']`, sin comentarios. */
function bloqueDelTema(css: string, tema: string): string {
  const abre = css.indexOf(`:root[data-tema='${tema}']`);
  assert.ok(abre >= 0, `no está el bloque del tema «${tema}»`);
  return css.slice(css.indexOf('{', abre) + 1, css.indexOf('}', abre)).replace(/\/\*[\s\S]*?\*\//g, '');
}

/** El nombre del token de una clave de etapa. `no_show` → `--etapa-no-show`. */
const tokenDe = (clave: string) => `--etapa-${clave.replace(/_/g, '-')}`;

/* Los DOS embudos. Las tres claves que comparten —`agendado`, `nurture`, `descalificado`— se
   cuentan una sola vez: son la misma columna vista desde los dos lados, y exigirles dos colores
   distintos sería pedir que el traspaso cambie de color. */
const TODAS = [...ETAPAS, ...ETAPAS_DEL_SETTER].filter(
  (e, i, todas) => todas.findIndex((o) => o.clave === e.clave) === i,
);

test('las SIETE etapas tienen color, en los DOS temas', () => {
  // Se recorre `ETAPAS`, no una lista escrita acá: así una etapa nueva rompe esta prueba en vez de
  // salir a producción sin color. Es la misma razón por la que la migración 018 existe — el `check`
  // de las secciones obligó a declarar `tools` cuando alguien la agregó.
  const css = leer('app/temas.css');
  for (const tema of ['oscuro', 'claro']) {
    const bloque = bloqueDelTema(css, tema);
    for (const e of TODAS) {
      const t = tokenDe(e.clave);
      assert.match(bloque, new RegExp(`${t}\\s*:`), `falta ${t} en el tema ${tema}`);
      // Y su canal, que es lo que permite teñir el fondo con opacidad.
      assert.match(bloque, new RegExp(`--c-etapa-${e.clave.replace(/_/g, '-')}\\s*:`),
        `falta el canal de «${e.nombre}» en el tema ${tema}`);
    }
  }
});

test('ninguna etapa comparte su color con otra, en ninguno de los dos temas', () => {
  // El defecto 2 del encabezado. Dos columnas del mismo color se leen como una sola categoría, y
  // «Ganado» junto a «Descalificado» del mismo verde sería el peor caso posible.
  const css = leer('app/temas.css');
  for (const tema of ['oscuro', 'claro']) {
    const bloque = bloqueDelTema(css, tema);
    const valores = new Map<string, string>();
    for (const e of TODAS) {
      const v = new RegExp(`${tokenDe(e.clave)}\\s*:\\s*([^;]+);`).exec(bloque)?.[1]?.trim();
      assert.ok(v, `no se pudo leer el color de «${e.nombre}» en ${tema}`);
      const yaEsta = valores.get(v!);
      assert.equal(
        yaEsta,
        undefined,
        `en el tema ${tema}, «${e.nombre}» y «${yaEsta}» tienen el mismo color (${v}): dos columnas ` +
          'indistinguibles, y nada falla',
      );
      valores.set(v!, e.nombre);
    }
    assert.equal(valores.size, TODAS.length, 'faltan colores o hay uno repetido');
  }
});

test('el canal de cada etapa coincide con su color: el tinte y el texto son el MISMO tono', () => {
  // El texto del conteo va en `--etapa-x` y su píldora en `rgb(var(--c-etapa-x) / .16)`. Si los dos
  // se separan, queda un número de un color sobre un tinte de otro — se ve sucio y no se sabe por
  // qué. Se comprueba convirtiendo el hexadecimal a canales y comparando.
  const css = leer('app/temas.css');
  for (const tema of ['oscuro', 'claro']) {
    const bloque = bloqueDelTema(css, tema);
    for (const e of TODAS) {
      const guion = e.clave.replace(/_/g, '-');
      const hex = new RegExp(`--etapa-${guion}\\s*:\\s*#([0-9a-fA-F]{6})\\s*;`).exec(bloque)?.[1];
      const canal = new RegExp(`--c-etapa-${guion}\\s*:\\s*([\\d\\s]+);`).exec(bloque)?.[1];
      assert.ok(hex && canal, `«${e.nombre}» no declara las dos formas en ${tema}`);
      const delHex = [0, 2, 4].map((i) => parseInt(hex!.slice(i, i + 2), 16));
      const delCanal = canal!.trim().split(/\s+/).map(Number);
      assert.deepEqual(
        delCanal,
        delHex,
        `«${e.nombre}» en ${tema}: el canal (${delCanal.join(' ')}) no es el mismo color que ` +
          `#${hex} (${delHex.join(' ')})`,
      );
    }
  }
});

test('cada etapa tiene su regla en el CSS, y el estilo se escribe UNA vez', () => {
  // Las siete reglas por etapa hacen una sola cosa: definir `--etapa` y `--c-etapa`. Todo lo demás
  // —canto, banda, punto, píldora— se escribe una vez contra esas dos variables.
  //
  // La alternativa era siete bloques completos con el borde y el tinte repetidos. Con eso, cambiar
  // el grosor del canto son siete ediciones y la séptima se olvida: el defecto queda como una etapa
  // que se ve distinta de las otras seis sin que nada falle.
  const css = leer('app/closer.css');
  for (const e of TODAS) {
    assert.match(
      css,
      new RegExp(`\\.md-sec\\[data-etapa='${e.clave}'\\]\\s*\\{`),
      `«${e.nombre}» no tiene su regla de color`,
    );
  }
  // Y el canto, la banda y la píldora se escriben una sola vez, contra el selector genérico.
  assert.equal(
    [...css.matchAll(/\.md-sec\[data-etapa\]\s*\{\s*border-left/g)].length,
    1,
    'el canto de color se escribe más de una vez: siete copias es una que se va a olvidar',
  );
});

test('el color NO es la única señal: el punto también cambia de forma', () => {
  // El defecto 3 del encabezado, y el único que no se puede arreglar con tonos. Los dos pares que
  // colapsan bajo daltonismo son `ganado`/`descalificado` (24 en deuteranopia) y `no_show`/`nurture`
  // (32 en protanopia), así que cada uno de esos cuatro necesita una forma que lo separe de su par.
  const css = leer('app/closer.css');
  const forma = (clave: string) => {
    const sel = `.md-sec[data-etapa='${clave}'] .md-h::before`;
    const i = css.indexOf(sel);
    return i < 0 ? null : css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
  };
  // `descalificado` es un cuadrado y `ganado` un círculo: es lo que los separa cuando el rojo y el
  // verde se vuelven el mismo color.
  assert.match(forma('descalificado') ?? '', /border-radius:\s*2px/, '«Descalificado» perdió su forma propia');
  assert.equal(forma('ganado'), null, '«Ganado» tiene forma propia: tendría que ser el círculo por omisión');
  // `no_show` rombo, `nurture` anillo.
  assert.match(forma('no_show') ?? '', /rotate\(45deg\)/, '«No-show» perdió el rombo');
  assert.match(forma('nurture') ?? '', /background:\s*transparent/, '«Nurture» perdió el anillo');
});

test('la pantalla NO elige tonos: pasa la clave del servidor', () => {
  // El color sale del CSS a partir de `data-etapa`, así que el componente no tiene ni un color
  // adentro. Si eligiera tonos, habría dos lugares que definen el mismo color y uno quedaría viejo —
  // y encima el tema claro no lo seguiría, porque un literal no cambia con el tema.
  const jsx = leer('components/closer/Pipeline.jsx');
  assert.match(jsx, /data-etapa=\{col\.clave\}/, 'el Pipeline dejó de marcar la etapa de cada sección');
  const codigo = jsx.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(
    !/#[0-9a-fA-F]{3,6}\b/.test(codigo) && !/rgba?\(/.test(codigo),
    'el Pipeline volvió a tener colores adentro: van en `app/closer.css`, por `data-etapa`',
  );
});

test('ningún JSX de la superficie trae un color escrito a mano', () => {
  // ESTE ERA EL HUECO DE MI PROPIA GUARDA, Y SE ABRIÓ DOS VECES.
  //
  // `104-temas.test.ts` prohíbe los literales y barre las cinco HOJAS DE ESTILO — no el JSX. Así
  // que cuatro colores se colaron por el único camino que no mira: un atributo de SVG y tres
  // `style={{ background: 'rgba(...)' }}`. Se agregó este barrido con una LISTA de once archivos, la
  // de la superficie del Closer.
  //
  // Y la lista fue el segundo hueco. `components/views/` no estaba, y ahí había cinco más: el
  // degradado `#16202f → #0c1220` que pintaba las tarjetas del organigrama —el defecto que se vio
  // en pantalla: seis tarjetas negras con su texto negro en tema claro—, dos halos y dos tintes
  // ámbar. Una lista escrita a mano sólo cubre lo que alguien se acordó de escribir.
  //
  // Por eso ahora se RECORRE el árbol. Un archivo nuevo queda cubierto el día que se crea, sin que
  // nadie tenga que acordarse de nada — que es la misma razón por la que las siete etapas se
  // recorren desde `ETAPAS` y no desde una lista de siete claves.
  const archivos: string[] = [];
  const bajar = (dir: string) => {
    for (const e of readdirSync(new URL(dir, RAIZ), { withFileTypes: true })) {
      if (e.isDirectory()) bajar(`${dir}${e.name}/`);
      else if (e.name.endsWith('.jsx')) archivos.push(`${dir}${e.name}`);
    }
  };
  bajar('components/');
  bajar('app/');
  assert.ok(archivos.length > 20, `sólo ${archivos.length} archivos: el recorrido se quedó corto`);

  const colados: string[] = [];
  for (const archivo of archivos.sort()) {
    // Sin comentarios: los de este repositorio CITAN colores a propósito para contar qué se cambió.
    const codigo = leer(archivo)
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const m of codigo.matchAll(/rgba?\(\s*\d[^)]*\)/g)) colados.push(`${archivo}: ${m[0]}`);
    for (const m of codigo.matchAll(/#[0-9a-fA-F]{3,8}/g)) colados.push(`${archivo}: ${m[0]}`);
  }
  assert.deepEqual(
    colados,
    [],
    'hay colores escritos a mano en el JSX. Un literal no cambia con el tema, así que se va a ver ' +
      'bien en oscuro y va a desaparecer —o quedar negro sobre negro— en claro, sin que nada falle: ' +
      colados.join(' · '),
  );
});
