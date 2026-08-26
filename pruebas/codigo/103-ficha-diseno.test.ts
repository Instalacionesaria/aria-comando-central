// El diseño de la ficha: la colisión de clases que rompió el chat, y lo que la deja volver. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTO CUBRE NO ERA UN ERROR: ERA UNA COINCIDENCIA DE NOMBRES
//
// Una burbuja saliente se dibujaba `class="msgw out"`. Y `app/aios.css` define `.out` para otra cosa
// por completo —las fichas de indicador de Fundaciones— con `height:38px` y `display:flex`. `.msgw`
// no declara ninguna de las dos, así que la burbuja saliente las heredaba:
//
//   · el texto de un mensaje de 87 caracteres se dibujaba en una caja de 38 px de alto, y salía;
//   · la hora dejaba de ir DEBAJO del mensaje y se ponía al lado, estrujada contra el borde.
//
// Nada falló. Ninguna prueba se puso roja. El síntoma que llegó fue una frase: «los mensajes no
// están bien alineados».
//
// Y es un defecto HEREDADO: `aios-command-center_1.html` tiene las dos reglas y el mismo choque, así
// que el port fue fiel y copió el defecto. Por eso el arreglo no puede ser un `display:block`
// defensivo sobre `.msgw.out` — eso tapa ESTA colisión y deja viva la mecánica que la produjo.
//
// Las pruebas de abajo cubren las formas de que vuelva, y de paso fijan lo demás que se enderezó:
// la columna del chat, el descenso al último mensaje, la semántica de las pestañas y los colores de
// las seis salidas de Avanzar.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const RAIZ = new URL('../../', import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, RAIZ), 'utf8');

const HOJAS = ['app/aios.css', 'app/fundaciones.css', 'app/ajustes.css', 'app/armazon.css', 'app/closer.css'];

/** Las clases que una hoja define SOLAS, en su propio selector: `.out{…}`, `.mal{…}`. */
function clasesSueltas(css: string): Set<string> {
  const fuera = new Set<string>();
  // Sin comentarios: `/* .algo */` no define nada.
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of limpio.matchAll(/(^|[,{}])\s*\.([a-z][a-z0-9_-]*)\s*(?=[,{])/gim)) {
    fuera.add(m[2]!);
  }
  return fuera;
}

/**
 * Las cinco palabras que este repositorio usa como MODIFICADOR sobre otra clase.
 *
 * `fd-aviso mal`, `msgw mal`, `nav-item on`, `fd-aviso falta`, `fd-aviso bien`, `ld-dot ok`. Son
 * y no se van a renombrar; lo que se protege es que ninguna gane jamás una regla propia — el día que
 * alguien escriba `.mal{…}`, TODO elemento que la lleve hereda esa regla, que es exactamente lo que
 * `.out` le hizo al chat.
 */
const MODIFICADORES_DE_ESTADO = ['on', 'mal', 'bien', 'falta', 'ok'];

test('ninguna palabra suelta que la ficha use como modificador tiene regla propia', () => {
  // El corazón del asunto, y hay que decir por qué el guardia es éste y no «buscá colisiones».
  // «Colisión» significa *dos componentes distintos comparten un nombre*, y eso una máquina no lo
  // puede saber: `.cw-body` tiene su propia regla y está perfecto, porque es SU dueño quien la
  // escribió. Lo que sí es mecánico es la condición que lo hace posible: una palabra corta y genérica
  // usada como modificador, sobre una hoja global de 2452 líneas, es un nombre que cualquiera puede
  // reclamar sin enterarse de que ya estaba en uso.
  const sueltas = new Set<string>();
  for (const hoja of HOJAS) for (const c of clasesSueltas(leer(hoja))) sueltas.add(c);

  const reclamadas = MODIFICADORES_DE_ESTADO.filter((c) => sueltas.has(c));
  assert.deepEqual(
    reclamadas,
    [],
    `alguien le dio regla propia a ${reclamadas.join(', ')}, que este repositorio usa como ` +
      'modificador sobre otras clases. Todo elemento que la lleve va a heredar esa regla sin pedirla ' +
      '— es lo que `.out` le hizo al chat. Ver el encabezado de `app/closer.css`.',
  );
});

test('la ficha no compone modificadores de una palabra fuera de los cinco conocidos', () => {
  // Y la otra mitad: que no aparezca un SEXTO modificador genérico. Se miran los tokens que el
  // JSX escribe DESPUÉS del primero de cada `className`, que es donde vive un modificador.
  const jsx = leer('components/negocio/Ficha.jsx');
  const nuevos = new Set<string>();
  for (const m of jsx.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const crudo = (m[1] ?? m[2] ?? '').replace(/\$\{[^}]*\}/g, ' ');
    const trozos = crudo.split(/\s+/).filter((t) => /^[a-z][a-z0-9-]*$/i.test(t));
    for (const t of trozos.slice(1)) {
      if (!t.includes('-') && !MODIFICADORES_DE_ESTADO.includes(t)) nuevos.add(t);
    }
  }
  assert.deepEqual(
    [...nuevos],
    [],
    `la ficha compone modificadores nuevos de una sola palabra: ${[...nuevos].join(', ')}. ` +
      'Poneles prefijo (`msgw-…`, `cw-…`) antes de que otra hoja reclame el nombre.',
  );
});

test('los modificadores de la burbuja llevan prefijo y NO son `in` / `out`', () => {
  // La forma concreta en que este defecto ya ocurrió una vez. Se comprueba por nombre porque el
  // guardia de arriba sólo atrapa la colisión que EXISTE hoy: `in` no tiene regla suelta ahora
  // mismo, y volver a usarlo sería quedar a la espera de que alguien defina `.in{…}`.
  const jsx = leer('components/negocio/Ficha.jsx');
  for (const malo of ["'out'", "'in'", '"out"', '"in"']) {
    assert.ok(
      !jsx.includes(`? ${malo}`) && !jsx.includes(`: ${malo}`),
      `la burbuja volvió a usar ${malo} como modificador: en una hoja global de 2452 líneas eso es ` +
        'una colisión esperando. Ver el encabezado de `app/closer.css`.',
    );
  }
  assert.match(jsx, /msgw-sale/, 'falta el modificador del mensaje saliente');
  assert.match(jsx, /msgw-entra/, 'falta el modificador del mensaje entrante');
});

test('la burbuja mide lo que mide su texto: la columna del chat es flex', () => {
  // La otra mitad. `max-width` sobre un bloque no encoge nada: el bloque ocupa todo el ancho y el
  // tope sólo lo recorta. Medido antes del arreglo: las nueve burbujas de una conversación medían
  // 419,3 px, la de «ok» igual que la de 193 caracteres.
  const css = leer('app/closer.css');
  assert.match(
    css,
    /\.cw-chat\s*\{[^}]*display:\s*flex/,
    '`.cw-chat` dejó de ser una columna flex: sin eso las burbujas vuelven a medir todas igual',
  );
  assert.match(css, /\.cw-chat\s+\.msgw-sale\s*\{[^}]*align-self:\s*flex-end/, 'el saliente no se alinea a la derecha');
  assert.match(css, /\.cw-chat\s+\.msgw-entra\s*\{[^}]*align-self:\s*flex-start/, 'el entrante no se alinea a la izquierda');

  // Y el contenedor tiene que existir en el JSX, o el CSS no le pega a nada.
  assert.match(leer('components/negocio/Ficha.jsx'), /className="cw-chat"/, 'el chat perdió su contenedor');
});

test('la ficha no lleva ni un estilo en línea', () => {
  // Había siete, con números crudos —`fontSize: 12.5`, `padding: '11px 13px'`, `marginTop: 9`— y dos
  // de ellos peleaban contra la rejilla `.kv`: apagaban su alineación sin tocar sus COLUMNAS, así que
  // los seis valores del Perfil arrancaban a 272, 400, 142, 472, 311 y 497 px. Seis renglones, seis
  // márgenes. Un estilo en línea en un repositorio con hojas de estilo es una regla que nadie
  // encuentra cuando busca por qué algo se ve así.
  const jsx = leer('components/negocio/Ficha.jsx');
  const enLinea = [...jsx.matchAll(/style=\{\{/g)].length;
  assert.equal(enLinea, 0, `la ficha volvió a tener ${enLinea} estilo(s) en línea: van a \`app/closer.css\``);
});

test('el chat baja al último mensaje, y NO se lo arranca a quien subió a leer', () => {
  // La `ref` del cuerpo estuvo declarada y atada al div desde el primer día **sin que nadie la
  // leyera**: medido, el chat abría en `scrollTop: 0` con 604 px de conversación por debajo del
  // borde, y la burbuja que uno acababa de mandar aparecía fuera de la vista.
  //
  // Las dos mitades importan igual. Bajar siempre es tan malo como no bajar nunca: el reloj recarga
  // cada pocos segundos, así que un desplazamiento forzado en cada ciclo le arranca la vista a quien
  // subió a leer algo viejo, y no hay forma de ganarle.
  const jsx = leer('components/negocio/Ficha.jsx');
  assert.match(jsx, /cuerpo\.current/, 'la referencia al cuerpo volvió a no leerse nunca');
  assert.match(jsx, /scrollTop\s*=\s*\w+\.scrollHeight/, 'el chat no baja al último mensaje');
  /* Y la CONDICIÓN, no la mera presencia de la constante. La primera versión de esta prueba pedía
     sólo que `PEGADO_AL_FONDO` apareciera en el archivo, y una mutación la pasó por arriba: cambiar
     el guardia por `if (true)` deja la constante declarada, sin usar, y la prueba seguía en verde
     mientras el chat le arrancaba la vista a quien lee en cada ciclo del reloj. */
  assert.match(
    jsx,
    /alFondo\s*<=\s*PEGADO_AL_FONDO/,
    'el descenso perdió su condición: bajar en cada ciclo del reloj le arranca la vista a quien lee',
  );
  assert.match(
    jsx,
    /scrollHeight\s*-\s*\w+\.scrollTop\s*-\s*\w+\.clientHeight/,
    'ya no se mira dónde está el desplazamiento antes de moverlo',
  );
});

test('las cinco pestañas se anuncian como pestañas', () => {
  const jsx = leer('components/negocio/Ficha.jsx');
  assert.match(jsx, /role="tablist"/, 'la barra de pestañas no dice que lo es');
  assert.match(jsx, /aria-selected=\{activa === p\.clave\}/, 'no se anuncia cuál pestaña está abierta');
  assert.match(jsx, /role="tabpanel"/, 'el cuerpo no dice que es el panel de la pestaña');
});

test('el modal de resultado inerte del prototipo ya no se monta', () => {
  // `#resModal` vivía en `Overlays.jsx` con `opacity:0`, sin una sola línea de JavaScript que lo
  // abriera, duplicando el título del modal real de `Avanzar.jsx`. Y `opacity:0` **no** saca un
  // elemento del árbol de accesibilidad: un lector de pantalla anunciaba un diálogo «¿Cómo terminó?»
  // que no existe en la pantalla.
  // Sin los comentarios: el que explica POR QUÉ se borró nombra los cuatro identificadores, y
  // buscarlos en crudo hacía que la prueba se pusiera roja por su propia explicación.
  const overlays = leer('components/Overlays.jsx')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const id of ['resModal', 'resOpts', 'resClose', 'resScrim']) {
    assert.ok(!overlays.includes(id), `\`${id}\` volvió a montarse inerte`);
  }
});

test('las seis salidas de Avanzar tienen su color, y no seis grises iguales', () => {
  // Las tarjetas escriben `class="ic win|money|next|lost"` esperando la pastilla de color del
  // prototipo, que nunca se portó: las seis salían transparentes y del mismo gris. En una pantalla
  // que se resuelve de un clic, el color ES la señal — «Venta» y «No le interesa» no pueden verse
  // igual.
  const css = leer('app/closer.css');
  const salidas = leer('lib/negocio/salidas.ts');
  const clases = [...new Set([...salidas.matchAll(/clase:\s*'([a-z]+)'/g)].map((m) => m[1]!))];
  assert.ok(clases.length >= 4, 'no se leyeron las clases de `SALIDAS`');
  for (const c of clases) {
    assert.match(
      css,
      new RegExp(`\\.res-o \\.ic\\.${c}\\s*\\{[^}]*color:`),
      `la salida «${c}» no tiene color propio: se ve igual que las otras cinco`,
    );
  }
});
