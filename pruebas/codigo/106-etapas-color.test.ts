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
  /* Y el canto, la banda y la píldora se escriben una sola vez.

     Se cuenta la DECLARACIÓN y no el selector pegado a su llave. Antes el patrón exigía
     `[data-etapa] {`, y desde que las colas de Mi Día usan el mismo mecanismo el selector es una
     lista de dos —`[data-etapa], [data-cola]`— y el patrón dejaba de coincidir. Lo que esta
     prueba defiende no cambió: que el canto esté escrito UNA vez, no siete. */
  assert.equal(
    [...css.matchAll(/border-left: 3px solid var\(--etapa\)/g)].length,
    1,
    'el canto de color se escribe más de una vez: copiarlo es cómo una etapa se queda distinta',
  );

  /* Y las dos pantallas comparten esas reglas en vez de tener cada una las suyas. Es la mitad que
     hace que agregar una cola cueste dos líneas y no un bloque. */
  for (const generica of [
    /border-left: 3px solid var\(--etapa\)/,
    /background: rgb\(var\(--c-etapa\)\s*\/\s*\.07\)/,
  ]) {
    const i = css.search(generica);
    assert.ok(i > 0, 'se fue una de las reglas genéricas de color');
    const selector = css.slice(css.lastIndexOf('}', i) + 1, i);
    assert.match(
      selector,
      /\[data-cola\]/,
      'las colas de Mi Día quedaron fuera de una regla genérica: heredan el color a medias, que se ' +
        've como un defecto de la pantalla',
    );
  }
});

test('cada COLA de Mi Día tiene su color, con el mismo mecanismo que las etapas', () => {
  /* ────────────────────────── LO QUE SE PIDIÓ, Y LO QUE HABÍA ──────────────────────────
   *
   * Se pidió que las colas de Mi Día tengan color como las columnas del Pipeline. Tenían una
   * versión pobre —un `tono` de tres valores que hacía tres cosas distintas— y **dos de las cinco
   * colas del closer no tenían ninguno**.
   *
   * Se afirman las SIETE claves: las cinco del closer y las dos propias del setter. Una cola sin
   * su regla no falla — hereda `--etapa` sin definir, o sea canto y banda transparentes. Se ve
   * como una sección a medio pintar, que es exactamente lo que pasaba con `agenda` y `buzon`. */
  const css = leer('app/closer.css');
  for (const cola of [
    'urgentes',
    'agenda',
    'buzon',
    'seguimientos',
    'completadas',
    'oportunidades',
    'estancadas',
  ]) {
    assert.match(
      css,
      new RegExp(`\\.\\md-sec\\[data-cola='${cola}'\\]\\s*\\{`),
      `la cola \`${cola}\` no tiene su regla de color: queda con el canto transparente`,
    );
  }

  /* ── Y ALGUIEN TIENE QUE ESCRIBIR EL ATRIBUTO ────────────────────────────
   *
   * Lo encontró una mutación: borrando el `data-cola` del componente, las catorce reglas de arriba
   * quedan perfectas y **ninguna se aplica**. La función entera no hace nada y el CSS se lee como
   * si funcionara — es el mismo hueco que ya apareció dos veces en esta sesión, con la memoria de
   * lecturas y con los enlaces de la cita.
   *
   * Y `Mi Día` tiene que pasar la CLAVE de la cola: pasando otra cosa —el título, por ejemplo—
   * ninguna regla coincide y el resultado se ve igual que no pasar nada. */
  assert.match(
    leer('components/negocio/SeccionPlegable.jsx'),
    /\{\.\.\.\(cola \? \{ 'data-cola': cola \} : \{\}\)\}/,
    'la sección no escribe `data-cola`: todas las reglas de color de las colas quedan muertas',
  );
  assert.match(
    leer('components/closer/MiDia.jsx'),
    /cola=\{cola\.clave\}/,
    'Mi Día no pasa la clave de la cola, así que ninguna regla de color coincide',
  );
});

test('el tono de «Completadas hoy» existe en los DOS temas', () => {
  /* Lo encontró otra mutación. Es el único color de este archivo que no sale de la paleta de etapas
     —porque esa cola no es una etapa— así que es el único que se puede olvidar en un tema. Faltando
     en el claro, el canto y la píldora de esa sección quedan transparentes: se ve como una sección
     a medio pintar, y solo en un tema. */
  const css = leer('app/temas.css');
  for (const tema of ['oscuro', 'claro']) {
    const bloque = bloqueDelTema(css, tema);
    assert.match(bloque, /--cola-hecho\s*:/, `falta --cola-hecho en el tema ${tema}`);
    assert.match(bloque, /--c-cola-hecho\s*:/, `falta su canal en el tema ${tema}`);

    // Y el canal es el MISMO color que el hex, igual que se exige de cada etapa más arriba.
    const hex = /--cola-hecho\s*:\s*#([0-9a-fA-F]{6})\s*;/.exec(bloque)?.[1];
    const canal = /--c-cola-hecho\s*:\s*([\d\s]+);/.exec(bloque)?.[1];
    assert.ok(hex && canal, `--cola-hecho no declara las dos formas en ${tema}`);
    assert.deepEqual(
      canal.trim().split(/\s+/).map(Number),
      [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)),
      `en ${tema}, el canal de --cola-hecho no es el mismo color que su hexadecimal`,
    );
  }
});

test('el color de una cola sale de la VARIABLE de su etapa gemela, no de un hex copiado', () => {
  /* Tres colas son el mismo concepto que una columna del embudo. Un contacto en «Seguimientos de
     hoy» ES uno de la columna Seguimiento, así que tienen que ser el mismo naranja — y para que
     siga siendo cierto cuando alguien ajuste la paleta, se reusa la VARIABLE.

     Con el hex copiado, cambiar el tono del embudo deja la cola en el color viejo y las dos
     pantallas empiezan a decir cosas distintas sobre lo mismo, sin que nada falle. */
  const css = leer('app/closer.css');
  for (const [cola, etapa] of [
    ['agenda', 'agendado'],
    ['seguimientos', 'seguimiento'],
    ['oportunidades', 'oferta-chica'],
  ]) {
    const i = css.indexOf(`.md-sec[data-cola='${cola}']`);
    assert.ok(i > 0, `no está la regla de \`${cola}\``);
    const bloque = css.slice(i, css.indexOf('}', i));
    assert.match(
      bloque,
      new RegExp(`var\\(--etapa-${etapa}\\)`),
      `la cola \`${cola}\` no usa la variable de \`${etapa}\`: con el hex copiado, las dos ` +
        'pantallas se separan el día que alguien ajuste la paleta',
    );
  }

  /* Y «Completadas hoy» NO usa el verde de `ganado`, que es el error tentador: esa cola junta lo
     ganado Y lo perdido del día, así que en verde una jornada de cinco pérdidas se vería como
     cinco victorias. Nadie lo reporta, porque el color dice algo agradable. */
  const i = css.indexOf(".md-sec[data-cola='completadas']");
  assert.ok(i > 0, 'no está la regla de `completadas`');
  const bloque = css.slice(i, css.indexOf('}', i));
  assert.doesNotMatch(
    bloque,
    /--etapa-ganado/,
    '«Completadas hoy» quedó en verde: esa cola junta las ventas y las pérdidas del día',
  );
  assert.match(bloque, /--cola-hecho/, 'perdió su tono neutro propio');
});

test('el `tono` viejo se fue del todo, y no quedó peleando con el nuevo', () => {
  /* Las reglas `.md-sec.crit/.warn/.done` vivían en `aios.css`, otra capa. Dejarlas conviviendo
     con `data-cola` era una pelea silenciosa por el mismo píxel: dos fuentes de verdad para el
     tinte de un encabezado, y cuál gana depende del orden de las hojas. */
  /* SIN COMENTARIOS, y la primera versión de esta prueba falló por eso: el único `.md-sec.crit`
     que quedaba en la hoja era el de MI PROPIO comentario, el que explica que las reglas se
     fueron. Es la sexta vez que este repositorio paga la misma lección —`110`, `120`, `123`,
     `127`, `128`— así que acá va explícito: lo que se afirma es el CÓDIGO. */
  const sinComentarios = (hoja: string) => leer(hoja).replace(/\/\*[\s\S]*?\*\//g, '');

  for (const hoja of ['app/aios.css', 'app/closer.css']) {
    assert.doesNotMatch(
      sinComentarios(hoja),
      /\.md-sec\.(crit|warn|done)\b/,
      `${hoja} conserva el color viejo de las colas: pelea con \`data-cola\` por el mismo píxel`,
    );
  }
  // Y ninguna pantalla lo sigue declarando: un tono que nada dibuja se lee como si funcionara.
  for (const jsx of ['components/closer/MiDia.jsx', 'components/views/SetterView.jsx']) {
    assert.doesNotMatch(leer(jsx), /tono:/, `${jsx} sigue declarando tonos que ya nadie dibuja`);
  }
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
  /* ── LA CLAVE VIAJA EN DOS SALTOS, Y LOS DOS SE COMPRUEBAN ────────────

     Esto buscaba `data-etapa={col.clave}` acá hasta que el botón de replegar entró y el molde de
     la sección se mudó a `SeccionPlegable`. Ahora el Pipeline le pasa la clave por propiedad y el
     componente la pone en el atributo.

     Se afirman LOS DOS saltos y no solo el primero: con el atributo suelto en el componente
     compartido y sin nadie que le pase la clave, las siete etapas se dibujarían sin su tinte y
     esta prueba pasaría igual. */
  assert.match(jsx, /etapa=\{col\.clave\}/, 'el Pipeline dejó de pasarle la etapa a la sección');
  assert.match(
    leer('components/negocio/SeccionPlegable.jsx'),
    /'data-etapa': etapa/,
    'la sección compartida dejó de marcar la etapa: el CSS no tiene de dónde sacar el tinte',
  );
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
    for (const m of codigo.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) colados.push(`${archivo}: ${m[0]}`);
  }
  assert.deepEqual(
    colados,
    [],
    'hay colores escritos a mano en el JSX. Un literal no cambia con el tema, así que se va a ver ' +
      'bien en oscuro y va a desaparecer —o quedar negro sobre negro— en claro, sin que nada falle: ' +
      colados.join(' · '),
  );
});
