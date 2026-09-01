// El cableado del mapa ejecutivo: cinco líneas, cinco puntos, y la recta que se calcula. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO EXISTE, Y QUÉ RED REEMPLAZA
//
// El organigrama de áreas es **lo primero que se ve al entrar**, y hasta ahora su única red era
// `scripts/paridad.mjs`: comparaba la vista `executive` contra `aios-command-center_1.html` nodo por
// nodo y caja por caja.
//
// Esa vista salió de la comparación al pulirse el mapa, y el motivo largo está escrito en
// `paridad.mjs`. En resumen: el prototipo tenía tres cosas que se decidió cambiar —dos colores de
// línea para cinco conexiones que dicen lo mismo, CUATRO puntos animados para cinco líneas, y la
// línea de Creative en una curva que arrancaba dentro de su propia tarjeta— y ninguna de las tres se
// puede cambiar sin mover la forma o las cajas del SVG.
//
// Así que la red se cambia de lugar, no se pierde. Y esta versión es mejor en dos cosas concretas:
// corre en cada `npm test` en vez de exigir un navegador y un `npm run dev`, y afirma **relaciones**
// —que la recta une los centros de las dos tarjetas, que los cinco puntos van a la misma
// velocidad— en vez de comparar coordenadas contra una copia. Una comparación contra copia dice
// «cambió»; esto dice QUÉ se rompió.
//
// Lo que se pierde, dicho con precisión: nadie comprueba más que el texto y las seis tarjetas de
// esta vista coincidan con el maquetado. Eso ya no es lo que se quiere de esta pantalla.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');

const VISTA = 'components/views/ExecutiveView.jsx';
/** Las cinco conexiones, en el orden en que están escritas. */
const LINEAS = ['e1', 'e2', 'e3', 'e4', 'e5'] as const;

/** El `d` y la clase de una conexión, leídos del JSX. */
function laLinea(jsx: string, id: string): { clase: string; d: string } {
  const m = new RegExp(`<path id="${id}" className="([^"]*)" d="([^"]*)"`).exec(jsx);
  assert.ok(m, `no está la línea \`${id}\`: el mapa perdió una conexión`);
  return { clase: m[1]!, d: m[2]! };
}

/** La caja de una tarjeta, leída de su `<rect className="body">`. */
function laTarjeta(jsx: string, ancla: string): { x: number; y: number; w: number; h: number } {
  const desde = jsx.indexOf(ancla);
  assert.ok(desde > 0, `no está la tarjeta \`${ancla}\``);
  const m = /<rect[^>]*?x="(\d+)"\s+y="(\d+)"\s+width="(\d+)"\s+height="(\d+)"/.exec(
    jsx.slice(desde, desde + 400),
  );
  assert.ok(m, `la tarjeta \`${ancla}\` no declara su caja`);
  return { x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) };
}

/* Cuántas veces se parte la curva para medirla. 256 tramos sobre una curva de 200 px dejan tramos de
   menos de un píxel, así que el error de la suma es despreciable frente a la banda que se compara
   más abajo — que es de 35 %. Subirlo no cambia ninguna afirmación. */
const TRAMOS = 256;

/** El largo de un `d`, en unidades del `viewBox`. Soporta las dos formas que usa el mapa. */
function largoDe(d: string): number {
  const n = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((x) => Number(x[0]));

  // Una recta: `M x0 y0 L x1 y1`.
  if (d.includes('L')) {
    assert.equal(n.length, 4, `la recta \`${d}\` no tiene cuatro números`);
    return Math.hypot(n[2]! - n[0]!, n[3]! - n[1]!);
  }

  /* Una cúbica: `M x0 y0 C x1 y1, x2 y2, x3 y3`. No hay fórmula cerrada para su longitud, así que se
     muestrea. Es la única forma de comparar velocidades entre una recta y cuatro curvas. */
  assert.equal(n.length, 8, `la curva \`${d}\` no tiene ocho números`);
  let total = 0;
  let px = n[0]!;
  let py = n[1]!;
  for (let i = 1; i <= TRAMOS; i++) {
    const t = i / TRAMOS;
    const u = 1 - t;
    const x = u * u * u * n[0]! + 3 * u * u * t * n[2]! + 3 * u * t * t * n[4]! + t * t * t * n[6]!;
    const y = u * u * u * n[1]! + 3 * u * u * t * n[3]! + 3 * u * t * t * n[5]! + t * t * t * n[7]!;
    total += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return total;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EL COLOR
// ═══════════════════════════════════════════════════════════════════════════════

test('las cinco conexiones se dibujan con la MISMA clase', () => {
  /* ── EL PEDIDO, Y POR QUÉ SE AFIRMA LA CLASE Y NO EL COLOR ─────────────────
   *
   * Eran dos colores: tres líneas en un gris de nube al 13 % y dos en el ámbar ejecutivo, por una
   * clase `hot` heredada del maquetado. Se pidió unificarlas, y el motivo se ve en pantalla: las
   * cinco expresan lo mismo —un área que reporta a la capa ejecutiva—, así que dos colores
   * prometían una distinción que no existe. Y con el gris al 13 %, tres de las cinco casi no se
   * veían: el mapa parecía tener dos áreas conectadas y tres sueltas.
   *
   * Se compara la CLASE y no el valor del color porque el valor vive en `app/aios.css` y depende del
   * tema. Lo que hay que impedir es que una de las cinco vuelva a tener una clase propia — que es la
   * forma en la que esto se rompió la primera vez. */
  const jsx = leer(VISTA);
  const clases = LINEAS.map((id) => laLinea(jsx, id).clase);

  assert.deepEqual(
    [...new Set(clases)],
    ['edge'],
    'alguna conexión tiene una clase propia: vuelven los dos colores, y el color pasa a prometer ' +
      'una diferencia que no existe',
  );
});

test('el color de las conexiones sale del TOKEN del núcleo, no de un literal', () => {
  /* Dos mitades. La primera: que sea el ámbar del núcleo —el mismo token que su borde y su rótulo
     «CAPA EJECUTIVA»— para que el color diga a dónde va el cable.

     La segunda: que sea un token. Un literal es el color del tema OSCURO escrito a mano, así que en
     tema claro las cinco líneas quedarían con el color del otro tema sobre blanco. Es exactamente el
     defecto que este mapa ya pagó con el relleno de sus tarjetas (`107-sin-sombras`). */
  const css = leer('app/aios.css');
  const i = css.indexOf('.edge { stroke:');
  assert.ok(i > 0, 'la regla `.edge` cambió de forma');
  const regla = css.slice(i, css.indexOf('}', i));

  assert.match(regla, /var\(--c-exec\)/, 'las conexiones dejaron de usar el ámbar del núcleo');
  assert.equal(/#[0-9a-f]{3,8}\b/i.test(regla), false, 'hay un color escrito a mano en `.edge`');
});

// ═══════════════════════════════════════════════════════════════════════════════
// LA ANIMACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

test('cada conexión tiene EXACTAMENTE un punto viajando', () => {
  /* ── EL DEFECTO QUE ESTA PRUEBA EXISTE PARA IMPEDIR, Y QUE ESTUVO EN PANTALLA ──
   *
   * Había cuatro puntos para cinco líneas: `e3`, la de Creative, era la única sin animación. En un
   * mapa donde el movimiento significa «esta área está reportando», una línea quieta se lee como que
   * Creative no manda nada — la única de las seis áreas apagada, sin que nada falle.
   *
   * Se cuenta por línea y no en total: cinco puntos repartidos como dos, dos, uno, cero, cero pasan
   * cualquier conteo global y dejan dos líneas muertas. */
  const jsx = leer(VISTA);
  for (const id of LINEAS) {
    const cuantos = (jsx.match(new RegExp(`<mpath href="#${id}" ?/>`, 'g')) ?? []).length;
    assert.equal(cuantos, 1, `la línea \`${id}\` tiene ${cuantos} puntos y le toca uno`);
  }
});

test('los cinco puntos van a la MISMA velocidad, no al mismo tiempo', () => {
  /* ══════════════════════════════════════════════════════════════════════════
     LA CUENTA QUE HACE HONESTO AL COMENTARIO DE LA VISTA

     Las cinco líneas miden distinto —132 px la recta de Creative, 168 y 202 las curvas—, así que
     darles la misma duración les da velocidades distintas: el punto de la corta se arrastraría al
     lado de los otros cuatro. El ojo compara VELOCIDADES, no tiempos.

     Es la forma en la que esto se rompe sin que nada falle: alguien agrega una línea, le copia la
     duración a la de al lado, y el punto nuevo va al ritmo equivocado. Ninguna otra prueba de este
     archivo lo vería — la línea existe, tiene su clase y tiene su punto.

     El tope es 1.5×, y sale de la medición: las cinco de hoy van de 31.1 a 42.1 px/s, o sea 1.35×.
     Deja aire para elegir duraciones redondas y mata el caso real —copiar 6 s a la recta de 132 px,
     que da 22 px/s y 1.91×—.
     ══════════════════════════════════════════════════════════════════════════ */
  const jsx = leer(VISTA);
  const TOPE = 1.5;

  const velocidades = LINEAS.map((id) => {
    /* La duración se busca por el `mpath`, no por orden de aparición: los cinco `<circle>` no están
       en el orden de las líneas, y emparejarlos por posición mentiría en silencio. */
    const bloque = new RegExp(
      `<animateMotion dur="([\\d.]+)s"[^>]*>\\s*<mpath href="#${id}" ?/>`,
    ).exec(jsx);
    assert.ok(bloque, `no se pudo leer la duración del punto de \`${id}\``);
    const dur = Number(bloque[1]);
    assert.ok(dur > 0, `la duración de \`${id}\` no es un número de segundos`);
    return { id, v: largoDe(laLinea(jsx, id).d) / dur };
  });

  const lento = velocidades.reduce((a, b) => (a.v < b.v ? a : b));
  const rapido = velocidades.reduce((a, b) => (a.v > b.v ? a : b));
  assert.ok(
    rapido.v / lento.v <= TOPE,
    `el punto de \`${rapido.id}\` va a ${rapido.v.toFixed(1)} px/s y el de \`${lento.id}\` a ` +
      `${lento.v.toFixed(1)}: ${(rapido.v / lento.v).toFixed(2)}× de diferencia, y el tope es ${TOPE}×. ` +
      'Uno de los dos se lee como que su área responde a otro ritmo.',
  );
});

test('los cinco puntos NO arrancan juntos', () => {
  /* Con los cinco en `begin` cero el mapa late en vez de fluir: los cinco puntos salen del borde de
     las tarjetas en el mismo instante y llegan casi juntos. Se afirma que los arranques sean
     distintos, no cuáles son — elegir los valores es diseño; que se pisen es el defecto. */
  const jsx = leer(VISTA);
  const arranques = LINEAS.map((id) => {
    const m = new RegExp(`<animateMotion [^>]*?begin="([\\d.]+)s"[^>]*>\\s*<mpath href="#${id}"`).exec(jsx);
    // La primera no lleva `begin`: su arranque es cero, y escribirlo sería ruido.
    return m ? Number(m[1]) : 0;
  });
  assert.equal(
    new Set(arranques).size,
    LINEAS.length,
    `dos puntos arrancan en el mismo instante (${arranques.join(', ')}): el mapa late en vez de fluir`,
  );
});

test('el punto se mueve TAMBIÉN con «reducir movimiento»', () => {
  /* ══════════════════════════════════════════════════════════════════════════
     ESTA PRUEBA AFIRMABA LO CONTRARIO, Y EL CAMBIO SE PAGÓ EN PANTALLA

     Decía que con «reducir movimiento» el punto tenía que ESCONDERSE, y el razonamiento parecía
     bueno: la regla del maquetado apagaba el `<animateMotion>`, que no deja el punto quieto en el
     borde sino ESTACIONADO donde estaba — cinco marcas clavadas a mitad de las líneas, que en un
     mapa donde todo significa algo se leen como información.

     Lo que faltaba en ese razonamiento es a quién le pasa. La preferencia está activa en más
     máquinas de las que uno supone —en Windows es «Mostrar animaciones: No»— y esconder el punto
     dejó el mapa sin lo único que dice «esta área está reportando». La queja llegó en una frase:
     *«falta que todas tengan esa animación de una bolita moviéndose en dirección al executive»*.

     Así que el punto se mueve siempre, y lo que se afirma es eso. `prefers-reduced-motion` existe
     por el movimiento que marea —superficies grandes, paralaje— y esto es un punto de 2.4 px sobre
     una línea de 130 a 200 px: más cerca de un indicador de carga, que nadie apaga.

     Se afirma sobre el CSS y no sobre el navegador porque el reloj de animación **no avanza en un
     panel que no pinta**: medido con `requestAnimationFrame`, cero cuadros en 900 ms. O sea que
     una prueba de navegador acá diría «no se mueve» siempre, para cualquier código.
     ══════════════════════════════════════════════════════════════════════════ */
  const css = leer('app/aios.css');
  const i = css.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.ok(i > 0, 'se fue el bloque de «reducir movimiento»');

  /* Se le quitan los COMENTARIOS antes de mirar, y eso lo encontró una mutación: el comentario de
     ese bloque cita las dos reglas que se quitaron —para que quien lea sepa qué había ahí— así que
     un patrón sobre el texto crudo las encuentra en la prosa y la prueba sobrevive a que vuelvan.
     Mismo error, el mismo día, que en `110-monitoreo`: el patrón que busca una regla tiene que
     quitar los comentarios primero.

     El corte va hasta la primera llave sola al principio de una línea, que es el cierre del
     `@media`. Cortar en la primera `}` a secas tomaría solo la primera regla de adentro. */
  const bloque = css
    .slice(i, css.indexOf('\n}', i) + 2)
    .replace(/\/\*[\s\S]*?\*\//g, '');

  /* Los dos patrones ESCRITOS, no armados con una plantilla. La primera versión los construía con
     `new RegExp(...)` y un `${}` que quedó escapado, así que el patrón nunca interpolaba: buscaba el
     texto literal `${regla...}` y no encontraba nada NUNCA. La prueba pasaba en vacío — verde con
     las dos reglas puestas y verde sin ellas.

     Y no se pisan entre sí: `\.pulse \{` exige la llave pegada a `.pulse`, así que no matchea
     `.pulse animateMotion {`. Son dos afirmaciones distintas y cada una tiene su mensaje. */
  const apagadas = [
    { regla: '.pulse', patron: /\.pulse \{[^}]*display:\s*none/ },
    { regla: '.pulse animateMotion', patron: /\.pulse animateMotion \{[^}]*display:\s*none/ },
  ];
  for (const { regla, patron } of apagadas) {
    assert.equal(
      patron.test(bloque),
      false,
      `\`${regla}\` volvió a apagarse con «reducir movimiento»: el mapa se queda sin lo único que ` +
        'dice qué área está reportando, y quien tiene la preferencia activa ve cinco líneas muertas',
    );
  }

  /* Y la otra mitad, que es la que justifica la de arriba: lo que SÍ se apaga sigue apagado. Sin
     esto, «el punto se mueve siempre» se lee como que la preferencia se ignora en general — y no:
     `.live::before` palpita cambiando de tamaño en el lugar, que es exactamente lo que la
     preferencia viene a callar. */
  assert.match(
    bloque,
    /\.live::before \{[^}]*animation:\s*none/,
    'se dejó de apagar el latido de `.live`: ahí la preferencia sí tiene razón',
  );
});
// ═══════════════════════════════════════════════════════════════════════════════
// LA GEOMETRÍA DE LA RECTA
// ═══════════════════════════════════════════════════════════════════════════════

test('la conexión de Creative es una RECTA que une las dos tarjetas', () => {
  /* ══════════════════════════════════════════════════════════════════════════
     SE CALCULA DESDE LAS TARJETAS, NO SE COPIA

     Creative está exactamente debajo del núcleo, así que su conexión tiene que ser una vertical del
     borde de arriba de la tarjeta al borde de abajo del núcleo. La que había era una curva con los
     dos extremos mal: arrancaba en (400,512) —DENTRO de la tarjeta, sobre su texto— y terminaba en
     (470,300), 10 px desalineada del centro. En pantalla se veía como una diagonal saliendo del
     texto.

     Lo que hace útil a esta prueba es de dónde saca el valor esperado: de las cajas de las DOS
     tarjetas, leídas del mismo archivo. Comparar contra `'M 480 440 L 480 308'` escrito acá sería
     una copia —pasaría en verde después de mover la tarjeta y dejar la línea flotando—. Así, mover
     cualquiera de las dos y no mover la línea pone esto rojo diciendo cuál es la vertical correcta.
     ══════════════════════════════════════════════════════════════════════════ */
  const jsx = leer(VISTA);
  const nucleo = laTarjeta(jsx, 'className="node-card core"');
  const creative = laTarjeta(jsx, 'data-node="creative"');

  /* La premisa de «recta»: los dos centros coinciden. Si dejan de coincidir, una vertical ya no une
     las tarjetas y la respuesta no es enderezar más — es volver a una curva. Por eso esto se afirma
     aparte, con su propio mensaje. */
  const centro = nucleo.x + nucleo.w / 2;
  assert.equal(
    creative.x + creative.w / 2,
    centro,
    'Creative dejó de estar centrada bajo el núcleo: una recta vertical ya no las une, así que esta ' +
      'conexión tiene que volver a ser una curva',
  );

  // Y la recta va de borde a borde: nada de tramo tapado, nada de tramo en el aire.
  assert.equal(
    laLinea(jsx, 'e3').d,
    `M ${centro} ${creative.y} L ${centro} ${nucleo.y + nucleo.h}`,
    'la conexión de Creative no es la vertical que une el borde de su tarjeta con el del núcleo',
  );
});

test('las seis áreas y el núcleo siguen en el mapa', () => {
  /* Lo que la comparación con el prototipo cubría y nadie más: que el mapa tenga sus siete tarjetas.
     Borrar una no rompe nada —el SVG se dibuja igual— y su línea queda saliendo del vacío.

     Se afirma el conjunto EXACTO. Con «al menos éstas», agregar un área y olvidarse de su conexión
     pasaría en verde, y son las conexiones lo que este archivo cuida. */
  const jsx = leer(VISTA);
  const areas = [...jsx.matchAll(/data-node="(\w+)"/g)].map((m) => m[1]!).sort();
  assert.deepEqual(areas, [
    'acquisition',
    'conversation',
    'conversion',
    'creative',
    'sales',
  ]);
  assert.ok(jsx.includes('className="node-card core"'), 'se fue el núcleo del mapa');

  /* Cinco áreas y cinco conexiones, y el núcleo no cuenta: es el destino de las cinco. La sexta
     tarjeta del mapa es él. */
  assert.equal(areas.length, LINEAS.length, 'hay un área sin conexión, o una conexión sin área');
});
