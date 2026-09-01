// Que no vuelva la profundidad, ni por la puerta que el barrido no puede cerrar. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// SE PIDIÓ SACAR TODA LA SOMBRA. HAY TRES FORMAS DE QUE VUELVA, Y DOS NO LAS TAPA EL BARRIDO
//
// `app/temas.css` apaga las sombras con tres movimientos: los cuatro tokens en `none`, un selector
// universal que gana por CAPA a todo `aios.css`, y tres reglas nombradas para su propia capa. Con
// eso quedan cubiertas las 89 declaraciones que había. Pero:
//
// 1 · **Un `style` en línea le gana a cualquier capa.** `style={{ boxShadow: … }}` en un JSX no lo
//     puede apagar ninguna hoja de estilo — no hay especificidad que alcance, porque el estilo en
//     línea no compite por especificidad, gana antes. Eran DOS (el punto «en vivo» de Conversación y
//     de Conversión) y el barrido no los tocaba: había que editarlos. El día que alguien agregue el
//     tercero, se va a ver una sombra que nadie puede explicar mirando el CSS.
// 2 · **Una utilidad de Tailwind también.** `tw:shadow-*` entra en la capa `utilities`, que va
//     DESPUÉS de `components` en `app/globals.css`. Hoy no hay ninguna; si aparece, gana.
// 3 · **Una regla nueva en la propia capa `components`.** `fundaciones.css`, `ajustes.css`,
//     `armazon.css` y `closer.css` están en la misma capa que el barrido, así que ahí manda la
//     especificidad y `.mi-clase` le gana a `*`. Las tres que había están nombradas; una cuarta no.
//
// Ninguna de las tres falla. Las tres se ven como una sombra que volvió sola.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const RAIZ = new URL('../../', import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, RAIZ), 'utf8');

/** Sin comentarios: los de este repositorio CITAN sombras y colores para contar qué se quitó. */
const sinComentarios = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** Todos los `.jsx` de la superficie, recorridos de verdad y no escritos a mano en una lista. */
function jsxDeLaSuperficie(): string[] {
  const salida: string[] = [];
  const bajar = (dir: string) => {
    for (const e of readdirSync(new URL(dir, RAIZ), { withFileTypes: true })) {
      if (e.isDirectory()) bajar(`${dir}${e.name}/`);
      else if (e.name.endsWith('.jsx')) salida.push(`${dir}${e.name}`);
    }
  };
  bajar('components/');
  bajar('app/');
  return salida.sort();
}

test('los cuatro tokens de sombra valen `none` en los DOS temas', () => {
  // El primer movimiento, y el que apaga 51 de las 89 de una sola vez. Se comprueba en los dos
  // bloques porque el pedido fue explícito: *«quita las sombras tanto en el modo claro como en el
  // oscuro»*. Un tema con los tokens en `none` y el otro no es exactamente la mitad del trabajo, y
  // es la mitad que no se nota hasta que alguien cambia de tema.
  const css = leer('app/temas.css');
  for (const tema of ['oscuro', 'claro']) {
    const abre = css.indexOf(`:root[data-tema='${tema}']`);
    assert.ok(abre >= 0, `no está el bloque del tema «${tema}»`);
    const bloque = css.slice(css.indexOf('{', abre) + 1, css.indexOf('}', abre)).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const token of ['--sh-1', '--sh-2', '--sh-3', '--hair']) {
      const v = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(bloque)?.[1]?.trim();
      assert.equal(v, 'none', `${token} en el tema ${tema} vale «${v}» y no «none»`);
    }
  }
});

test('el barrido universal existe y gana por CAPA, no por `!important`', () => {
  // El segundo movimiento. Se comprueban las dos mitades del mecanismo, porque cada una sola no
  // alcanza: la regla tiene que existir Y la hoja tiene que entrar en una capa posterior a `aios`.
  const css = leer('app/temas.css');
  assert.match(
    css,
    /:root\[data-tema\]\s*\*\s*,[\s\S]{0,160}?\{\s*box-shadow:\s*none;/,
    'se fue el barrido universal de `box-shadow`: vuelven las 38 sombras escritas a mano de `aios.css`',
  );

  // Y el orden de las capas, que es lo que hace que un `*` de especificidad 0-0-0 le gane a un
  // `.card` de 0-1-0. Si alguien reordena la declaración de `@layer`, el barrido deja de aplicar sin
  // que cambie una línea de `temas.css`.
  const globals = leer('app/globals.css');
  const orden = /@layer\s+([^;]+);/.exec(globals)?.[1]?.split(',').map((c) => c.trim()) ?? [];
  const iAios = orden.indexOf('aios');
  const iComp = orden.indexOf('components');
  assert.ok(iAios >= 0 && iComp >= 0, `las capas no son las esperadas: ${orden.join(', ')}`);
  assert.ok(
    iComp > iAios,
    'la capa `components` dejó de ir después de `aios`: el barrido pierde y vuelven todas las sombras',
  );
  // Y que `temas.css` siga entrando en `components`.
  assert.match(
    globals,
    /@import\s+"\.\/temas\.css"\s+layer\(components\)/,
    '`temas.css` cambió de capa: el barrido puede quedar antes de las reglas que tiene que ganar',
  );
});

test('ningún `style` en línea trae una sombra: es la puerta que el CSS no puede cerrar', () => {
  // EL DEFECTO 1 DEL ENCABEZADO, y el que de verdad hubo que editar a mano. Un `style` en línea no
  // pierde contra ninguna capa ni contra ninguna especificidad: gana antes de que esa comparación
  // ocurra. Así que el barrido de `temas.css` es ciego a esto, y esta prueba es lo único que lo ve.
  const colados: string[] = [];
  for (const archivo of jsxDeLaSuperficie()) {
    const codigo = sinComentarios(leer(archivo));
    for (const m of codigo.matchAll(/boxShadow\s*:/g)) colados.push(`${archivo}: boxShadow`);
    // `drop-shadow` es una sombra con otro nombre. Los demás filtros no se tocan.
    for (const m of codigo.matchAll(/drop-?[Ss]hadow/g)) colados.push(`${archivo}: ${m[0]}`);
  }
  assert.deepEqual(
    colados,
    [],
    'hay una sombra en un `style` en línea. Ninguna hoja de estilo la puede apagar — el estilo en ' +
      'línea gana antes de que se comparen capas — así que el barrido de `app/temas.css` no la ve: ' +
      colados.join(' · '),
  );
});

test('ninguna utilidad `tw:shadow-*` se cuela por la capa `utilities`', () => {
  // EL DEFECTO 2. Las utilidades de Tailwind entran en `utilities`, que va después de `components`,
  // así que una sola clase `tw:shadow-2` le gana al barrido. Y no es hipotético: `@theme inline` en
  // `app/globals.css` expone los cuatro tokens como `--shadow-1…3` y `--shadow-hair`, o sea que las
  // utilidades EXISTEN y están a un tipeo de distancia.
  //
  // Hoy el daño sería nulo porque los tokens valen `none`; pero `tw:shadow-lg` y compañía traen su
  // propio valor de Tailwind y no pasan por los tokens. Esa es la que vuelve.
  const colados: string[] = [];
  for (const archivo of jsxDeLaSuperficie()) {
    for (const m of sinComentarios(leer(archivo)).matchAll(/\btw:(?:inset-)?shadow-[a-z0-9-]+/g)) {
      colados.push(`${archivo}: ${m[0]}`);
    }
  }
  assert.deepEqual(
    colados,
    [],
    'hay una utilidad de sombra de Tailwind. Entra en la capa `utilities`, que va DESPUÉS de ' +
      '`components`, así que le gana al barrido: ' + colados.join(' · '),
  );
});

test('ninguna hoja de la capa `components` estrena una sombra sin nombrarla', () => {
  // EL DEFECTO 3. Las cuatro hojas propias comparten capa con el barrido, así que ahí `*` no manda:
  // `.mi-clase { box-shadow: … }` le gana. Las tres que había están nombradas en `temas.css`; esta
  // prueba exige que una cuarta se nombre también, en vez de aparecer en la pantalla.
  //
  // Se cuentan las declaraciones que PONEN una sombra. `box-shadow: none` no cuenta: apagarla es
  // justamente lo que se quiere.
  const HOJAS = ['app/fundaciones.css', 'app/ajustes.css', 'app/armazon.css', 'app/closer.css', 'app/monitoreo.css'];
  const puestas: string[] = [];
  for (const hoja of HOJAS) {
    const css = leer(hoja).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/box-shadow\s*:\s*([^;]+);/g)) {
      const valor = m[1]!.trim();
      if (valor === 'none') continue;
      // Las que pasan por token ya están apagadas en el origen: `var(--sh-2)` vale `none`.
      if (/^var\(--(sh-[123]|hair)\)$/.test(valor)) continue;
      puestas.push(`${hoja}: ${valor}`);
    }
  }
  // Las tres conocidas viven en `fundaciones.css` (el punto de «hecho» y el foco de los campos) y
  // en `ajustes.css` (el foco de los `select`), y las tres están nombradas en el barrido.
  const barrido = leer('app/temas.css');
  for (const clase of ['.fd-sub .fd-hecho', '.fd-campo input:focus', '.row-i select:focus']) {
    assert.ok(
      barrido.includes(clase),
      `\`${clase}\` salió de la lista nombrada de \`app/temas.css\`: su sombra vuelve a la pantalla`,
    );
  }
  assert.equal(
    puestas.length,
    3,
    'cambió la cantidad de sombras literales en la capa `components`. Son las que el barrido ' +
      'universal NO puede apagar —misma capa, y ahí manda la especificidad— así que cada una tiene ' +
      `que estar nombrada en el bloque de \`app/temas.css\`:\n  ${puestas.join('\n  ')}`,
  );
});

test('el foco NO se fue con las sombras: pasó a `outline`', () => {
  // LO QUE EL BARRIDO SE LLEVABA Y NO ERA ADORNO. Tres de las 38 eran el aviso de foco de los
  // campos, y `.cc:focus-visible` marcaba el suyo con sombra MÁS `outline: none` — o sea que ahí la
  // sombra era casi todo el aviso. Quitarlas sin reponer nada le saca a quien navega con teclado la
  // señal de dónde está parado, y eso no se pidió.
  //
  // Se comprueba el mecanismo, no la estética: que los controles reales tengan una regla de
  // `outline` sobre `:focus-visible`.
  //
  // Y se busca por SELECTOR, no por posición, después de dos intentos fallidos que valen como aviso:
  // la primera aparición de `:focus-visible` en la hoja está dentro de un COMENTARIO —que cuenta que
  // `.cc:focus-visible` marcaba su foco con sombra más `outline: none`—, y la primera aparición real
  // es la del botón del tema, que ya existía. Cualquiera de las dos hacía que esta prueba leyera un
  // bloque que no era el suyo y fallara sobre algo que estaba bien.
  const css = leer('app/temas.css').replace(/\/\*[\s\S]*?\*\//g, '');

  /** El cuerpo de la regla que contiene ese selector exacto. */
  const reglaCon = (selector: string): string | null => {
    const i = css.indexOf(selector);
    if (i < 0) return null;
    const abre = css.indexOf('{', i);
    // Que el selector pertenezca a ESTA regla y no a la anterior: no puede haber un `{` entre medio.
    if (abre < 0 || css.slice(i, abre).includes('}')) return null;
    return css.slice(abre + 1, css.indexOf('}', abre));
  };

  for (const control of ['input', 'select', 'textarea', 'button']) {
    const regla = reglaCon(`${control}:focus-visible`);
    assert.ok(regla, `los \`${control}\` quedaron sin aviso de foco`);
    assert.match(regla!, /outline:\s*\d/, `el foco de \`${control}\` no dibuja un \`outline\``);
    assert.match(
      regla!,
      /outline-offset/,
      `sin \`outline-offset\` el aviso de \`${control}\` se pega al borde del control`,
    );
  }
});

test('las tarjetas de inteligencia se pintan por TOKEN y no por literal', () => {
  // El defecto concreto que se vio en la pantalla: el relleno de las seis tarjetas del organigrama
  // salía de un degradado escrito a mano en el JSX (`#16202f → #0c1220`). Un literal no cambia con
  // el tema, así que en claro la tarjeta seguía siendo negra mientras su texto —que sí usa tokens—
  // se volvía casi negro: seis nombres de área ilegibles, sin que nada falle.
  const jsx = leer('components/views/ExecutiveView.jsx');
  assert.match(
    jsx,
    /id="nodeFill"[\s\S]{0,240}?stopColor="var\(--nodo-fondo\)"[\s\S]{0,120}?stopColor="var\(--nodo-fondo\)"/,
    'el relleno de las tarjetas volvió a un color escrito a mano, o dejó de ser plano',
  );

  // Los tres degradados siguen ahí aunque dos queden en nada. El motivo CAMBIÓ y conviene decirlo:
  // era que `scripts/paridad.mjs` comparaba esta vista contra el prototipo con una huella de
  // `tag + id + clases`, así que sacar un nodo del `<defs>` la dejaba en rojo permanente. Ese
  // motivo ya no aplica —`executive` salió de la comparación al pulirse el mapa de áreas— y se
  // conservan igual por uno más chico: `coreGlow` SÍ lo referencia un `fill`, y quitar los dos
  // muertos es una limpieza que no pertenece a este archivo.
  for (const id of ['coreGlow', 'nodeFill', 'dataGlow']) {
    assert.ok(jsx.includes(`id="${id}"`), `se borró \`${id}\` del \`<defs>\``);
  }

  /* Y acá había un `assert.ok(… || true)`: un recordatorio disfrazado de afirmación, que no podía
     fallar ni cuando lo que recordaba dejó de ser cierto. Ahora dice algo comprobable, y lo que
     dice es lo contrario de lo que decía — el motivo está en `scripts/paridad.mjs`. */
  const paridad = leer('scripts/paridad.mjs');
  const lista = paridad.slice(paridad.indexOf('const VISTAS = ['), paridad.indexOf('];', paridad.indexOf('const VISTAS = [')));
  assert.equal(
    lista.includes("'executive'"),
    false,
    '`executive` volvió a `VISTAS` de paridad: el mapa de áreas diverge del prototipo a propósito ' +
      '(cinco líneas de un color, cinco puntos, la de Creative recta) y la comparación queda en rojo',
  );

  // Y el fósforo, que es lo que se pidió: que las letras de adentro resalten.
  const css = leer('app/temas.css');
  const nombre = css.indexOf(':root[data-tema] .node-name');
  assert.ok(nombre >= 0, 'el nombre del área dejó de tener regla propia');
  assert.match(
    css.slice(nombre, css.indexOf('}', nombre)),
    /fill:\s*var\(--fosforo\)/,
    'el nombre del área ya no usa el fósforo',
  );
  // En los dos temas, y con valores DISTINTOS: un neón sobre blanco no resalta, se pierde.
  const valorDe = (tema: string) => {
    const abre = css.indexOf(`:root[data-tema='${tema}']`);
    const bloque = css.slice(css.indexOf('{', abre) + 1, css.indexOf('}', abre));
    return /--fosforo\s*:\s*([^;]+);/.exec(bloque)?.[1]?.trim();
  };
  const o = valorDe('oscuro');
  const c = valorDe('claro');
  assert.ok(o && c, 'falta `--fosforo` en alguno de los dos temas');
  assert.notEqual(o, c, '`--fosforo` vale lo mismo en los dos temas: uno de los dos está sin pensar');
});

test('los tokens de la MEDIA no tienen versión por tema, y eso es la afirmación', () => {
  // El barrido de contraste que se corrió para comprobar que reforzar la paleta no rompiera nada
  // destapó seis controles que se dibujan encima de la media de una pieza —el botón de reproducir,
  // el reloj de duración, la píldora de estado en sus dos estados, el reloj y la barra del
  // reproductor— y los seis fallaban en tema claro, el peor en **1,01:1**.
  //
  // La causa era siempre la misma: usaban tokens que se dan vuelta con el tema (`--c-brillo`,
  // `--txt-dim`, `--ok`) para pintarse sobre una superficie que NO se da vuelta, porque debajo hay
  // una imagen. Y una imagen puede ser de cualquier color, así que ningún token del tema puede
  // garantizar contraste contra ella.
  //
  // La cura fue un velo propio, un texto blanco y un piso oscuro bajo el contenedor, iguales en los
  // dos temas. ESTA PRUEBA DEFIENDE ESE «IGUALES»: el día que alguien, con toda la buena intención,
  // le dé a `--velo-medio` una versión clara para el tema claro, los seis controles vuelven a
  // depender de la foto — y vuelven a fallar sólo en un tema, que es la forma en que esto se coló
  // la primera vez.
  const css = leer('app/temas.css');
  const bloqueDe = (tema: string) => {
    const abre = css.indexOf(`:root[data-tema='${tema}']`);
    assert.ok(abre >= 0, `no está el bloque del tema «${tema}»`);
    return css.slice(css.indexOf('{', abre) + 1, css.indexOf('}', abre)).replace(/\/\*[\s\S]*?\*\//g, '');
  };
  for (const token of ['--velo-medio', '--sobre-medio', '--ok-medio', '--fondo-medio']) {
    // Existe, una sola vez, y FUERA de los dos bloques por tema.
    assert.ok(css.includes(`${token}:`), `falta ${token}`);
    for (const tema of ['oscuro', 'claro']) {
      assert.ok(
        !bloqueDe(tema).includes(`${token}:`),
        `${token} tiene una versión para el tema ${tema}. Estos cuatro van sobre la MEDIA, no sobre ` +
          'una superficie del tema: si se dan vuelta, el contraste del control vuelve a depender de ' +
          'la imagen que haya detrás, y vuelve a fallar en un solo tema',
      );
    }
  }
  // Y cada control apunta al token de la media en la PROPIEDAD que le toca.
  //
  // Se comprueba el par (selector, propiedad -> token) y no «la regla menciona algun token de la
  // media», que fue el primer intento y no muerde: con esa version, cambiar el COLOR del reloj a
  // `--txt-dim` seguia pasando, porque su `background` todavia nombraba `--velo-medio`. Dos
  // mutaciones sobrevivieron y por eso esta escrito asi.
  //
  // Y el selector se busca con su LLAVE, `.cc-media {`, no suelto: `.cc-media` aparece antes como
  // parte de `.cc-media .play`, y la primera version media el bloque equivocado — de ahi la segunda
  // mutacion sobreviviente.
  //
  // SIN COMENTARIOS, ademas: la prosa de `app/temas.css` nombra estos selectores para contar cuanto
  // media cada uno antes de arreglarlo, y esas menciones van ANTES que la regla. Es la cuarta vez en
  // este archivo que los comentarios del repositorio rompen una busqueda ingenua.
  const reglas = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const cuerpoDe = (selector: string): string => {
    const i = reglas.indexOf(selector);
    assert.ok(i >= 0, `no esta la regla \`${selector}\``);
    const abre = i + selector.length - 1;
    return reglas.slice(abre + 1, reglas.indexOf('}', abre));
  };
  const ESPERADO: Array<[string, string, string]> = [
    // selector con su llave                     propiedad          token que debe usar
    [':root[data-tema] .cc-dur {',                'color',           '--sobre-medio'],
    [':root[data-tema] .cc-dur {',                'background',      '--velo-medio'],
    [':root[data-tema] .cc-status.pau {',         'color',           '--sobre-medio'],
    [':root[data-tema] .cc-status.pau {',         'background',      '--velo-medio'],
    [':root[data-tema] .cc-status.act {',         'color',           '--ok-medio'],
    [':root[data-tema] .cc-status.act {',         'background',      '--velo-medio'],
    [':root[data-tema] .dw-scrub .t {',           'color',           '--sobre-medio'],
    [':root[data-tema] .cc-media {',              'background-color', '--fondo-medio'],
  ];
  // Las declaraciones se PARSEAN, sin expresiones regulares, y eso tambien sale de haberlo hecho
  // mal: la version anterior las armaba con `new RegExp(`...\s*...`)` dentro de una plantilla, y en
  // una plantilla `\s` no es un escape valido — JavaScript lo colapsa a `s`. El patron quedaba
  // `(?:^|;)s*colors*:` y no casaba con nada, asi que la prueba fallaba diciendo que la regla «ya no
  // declara color» cuando la declaraba. Partir por `;` y por `:` no se puede escapar mal.
  const declaraciones = (cuerpo: string): Map<string, string> => {
    const m = new Map<string, string>();
    for (const trozo of cuerpo.split(';')) {
      const corte = trozo.indexOf(':');
      if (corte < 0) continue;
      m.set(trozo.slice(0, corte).trim(), trozo.slice(corte + 1).trim());
    }
    return m;
  };
  for (const [selector, propiedad, token] of ESPERADO) {
    const valor = declaraciones(cuerpoDe(selector)).get(propiedad);
    assert.ok(valor, `\`${selector}\` ya no declara \`${propiedad}\``);
    assert.ok(
      valor!.includes(`var(${token})`),
      `\`${selector}\` usa \`${propiedad}: ${valor}\` en vez de \`var(${token})\`. Si vuelve a un token ` +
        'del tema, el contraste del control vuelve a depender de la imagen que haya detras — y a ' +
        'fallar en un solo tema',
    );
  }
  // Y el contenedor del reproductor comparte el piso con la miniatura: es lo que vuelve calculable
  // el contraste del reloj del reproductor, que no tiene velo propio.
  const pisoCompartido = reglas.indexOf('.dw-video,');
  assert.ok(pisoCompartido >= 0, 'el contenedor del video perdio su regla de piso');
  assert.ok(
    declaraciones(cuerpoDe(':root[data-tema] .cc-media {')).get('background-color') === 'var(--fondo-medio)',
    'el piso oscuro de la media se fue: el reloj del reproductor vuelve a quedar sobre el panel, ' +
      'que en tema claro es blanco — y ahi el texto blanco desaparece',
  );
});
