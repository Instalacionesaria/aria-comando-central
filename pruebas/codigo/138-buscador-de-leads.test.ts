// El buscador de leads del Pipeline. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO MIDE, Y QUÉ DEFECTO MATA CADA COSA
//
// **1 · Buscar sin tildes encuentra a quien las tiene.** La cartera está llena de «Martín»,
// «Sofía» y «Benítez», y nadie escribe las tildes en un buscador. Sin normalizar, buscar «martin»
// devuelve cero — y el peor resultado posible de un buscador no es no encontrar: es **afirmar que
// no existe alguien que está a tres renglones de distancia, a la vista**.
//
// **2 · El teléfono se compara por dígitos.** Los números vienen del CRM escritos de seis formas
// —`+54 9 11 5523-8841`, `+595981334210`— así que comparar el texto tal cual sólo encuentra a quien
// escriba los espacios y los guiones exactamente igual.
//
// **3 · Y hacen falta TRES dígitos.** Con uno o dos, casi todo número contiene la consulta, así que
// el buscador devuelve la lista entera **y parece que filtró**. Es la clase de defecto que no
// falla: quien lo usa concluye que su lead no está en ninguna etapa en particular.
//
// **4 · El conteo de cada columna se recalcula.** `cuantos` lo trae el servidor y es el total de la
// etapa. Dejarlo con un filtro puesto da un encabezado que dice «Agendado 12» con dos filas debajo,
// que es un defecto que este proyecto ya pagó: *«el encabezado del buzón decía 25 con siete filas
// debajo»* (`components/views/CloserView.jsx`).
//
// **5 · `fuente` NO se busca.** Es la inclusión tentadora y la que rompe el buscador: la mitad de
// la cartera tiene `Meta Ads`, así que «meta» devolvería doscientas filas.
//
// **6 · Un tablero TRUNCADO lo dice.** El Pipeline trae todo hoy —268 filas contra un tope de
// 5.000— pero el día que corte, un «ninguno coincide» pasa a significar «no está entre los que
// llegaron», que se lee como «no existe». Ese es el único caso en que filtrar en la pantalla
// dejaría de ser honesto, y por eso viaja `parcial`.
//
// **7 · La pantalla distingue los dos vacíos.** Es la mitad visible de todo lo de arriba: con un
// solo mensaje, siete columnas diciendo «Nadie en esta etapa» hacen ver una cartera vacía cuando lo
// que hay es un filtro puesto.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buscar,
  coincide,
  DIGITOS_MINIMOS,
  normalizar,
  soloDigitos,
} from '../../lib/negocio/buscarLead.ts';

const RAIZ = new URL('../../', import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, RAIZ), 'utf8');

/**
 * El archivo SIN sus comentarios. **Y es la séptima vez que hace falta en este repositorio.**
 *
 * El arnés de mutación lo cazó: cambiar `type="search"` por `type="text"` en el JSX dejaba esta
 * prueba en verde, porque el comentario que explica el botón de limpiar **cita** `type="search"`
 * para contar que en Firefox no dibuja ninguno. La prueba encontraba su propia explicación.
 *
 * Es el mismo defecto que `107-sin-sombras` y `104-temas` ya documentan del otro lado: los
 * comentarios de este proyecto CITAN lo que quitaron o lo que hay que evitar, así que cualquier
 * prueba que lea código fuente tiene que leerlo sin ellos. Un guardia satisfecho por su propia
 * prosa no falla nunca, que es la peor forma de estar roto.
 */
const sinComentarios = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** Una fila con lo que el buscador mira. El resto de `Fila` no le hace falta. */
const fila = (nombre: string, telefono: string | null = null, email: string | null = null) => ({
  nombre,
  telefono,
  email,
});

// ─── 1 · Las tildes ──────────────────────────────────────────────────────────

test('buscar sin tildes encuentra a quien las tiene, y al revés', () => {
  assert.equal(normalizar('Martín BENÍTEZ'), 'martin benitez');
  assert.equal(normalizar('  Sofía Cardozo  '), 'sofia cardozo');
  // La diéresis también, que es por lo que se usa `NFD` y no una tabla de reemplazos.
  assert.equal(normalizar('Agüero'), 'aguero');

  const martin = fila('Martín Aguirre');
  for (const q of ['martin', 'Martin', 'MARTÍN', 'martín', 'aguirre', 'tín agu']) {
    assert.ok(coincide(martin, q), `«${q}» no encontró a Martín Aguirre`);
  }
  // Y al revés: quien escribe la tilde encuentra a quien está guardado sin ella.
  assert.ok(coincide(fila('Martin Aguirre'), 'Martín'), 'con la tilde no encontró al que no la tiene');
});

// ─── 2 y 3 · El teléfono ─────────────────────────────────────────────────────

test('el teléfono se compara por dígitos, y hacen falta tres', () => {
  assert.equal(soloDigitos('+54 9 11 5523-8841'), '5491155238841');

  const k = fila('Valentina Rojas', '+54 9 11 5523-8841');
  // Un trozo del número, escrito de las formas en que alguien lo copia.
  for (const q of ['5523', '5523-8841', '55 23 88', '+5491155238841', '911']) {
    assert.ok(coincide(k, q), `«${q}» no encontró el teléfono`);
  }
  assert.ok(!coincide(k, '9999'), 'encontró un número que no está');

  /* EL MÍNIMO DE TRES. Con dos dígitos, este número contiene «55», «91», «11», «23»… así que sin
     el mínimo el buscador devolvería la fila para casi cualquier par de dígitos. */
  assert.equal(DIGITOS_MINIMOS, 3);
  assert.ok(!coincide(k, '55'), 'dos dígitos ya filtran: el buscador devuelve casi todo');
  assert.ok(coincide(k, '552'), 'tres dígitos tienen que buscar');

  // Y el mínimo NO alcanza a los nombres: «An» sigue encontrando a Ana.
  assert.ok(coincide(fila('Ana Torres'), 'An'), 'el mínimo de dígitos se comió la búsqueda por nombre');
});

test('el correo también se busca, pero la fuente NO', () => {
  const k = { nombre: 'Camila Duarte', telefono: null, email: 'camila@clinicaduarte.com' };
  assert.ok(coincide(k, 'clinicaduarte'), 'no buscó en el correo');
  assert.ok(coincide(k, 'CAMILA@'), 'el correo no se normalizó');

  /* La fuente no está en lo que el buscador mira, y se comprueba desde afuera: `coincide` recibe un
     objeto con nombre, teléfono y correo, así que un campo de más no tiene por dónde entrar. Es la
     forma de la función la que lo impide, no una lista de exclusión que alguien pueda ampliar. */
  const conFuente = { ...k, fuente: 'Meta Ads' } as unknown as typeof k;
  assert.ok(
    !coincide(conFuente, 'Meta Ads'),
    'la fuente entró a la búsqueda: la mitad de la cartera la comparte, así que tres letras ' +
      'comunes devolverían doscientas filas y parecería que filtró',
  );
});

// ─── 4 · El filtro sobre el tablero ──────────────────────────────────────────

/** Un tablero de tres etapas, con el `cuantos` que traería el servidor. */
function tablero() {
  return [
    {
      clave: 'agendado',
      nombre: 'Agendado',
      cuantos: 3,
      filas: [
        fila('Martín Aguirre', '+52 1 55 4012 7734'),
        fila('Camila Duarte', '+595 981 334 210'),
        fila('Lucas Benítez', '+57 310 662 0187'),
      ],
    },
    {
      clave: 'seguimiento',
      nombre: 'Seguimiento',
      cuantos: 2,
      filas: [fila('Sofía Cardozo'), fila('Tomás Villalba')],
    },
    { clave: 'ganado', nombre: 'Ganado', cuantos: 0, filas: [] },
  ];
}

test('con la consulta vacía el tablero sale entero y sin marcar como filtrado', () => {
  const b = buscar(tablero(), '   ');
  assert.equal(b.filtrando, false, 'espacios en blanco cuentan como filtro: la pantalla diría que filtró');
  assert.equal(b.coincidencias, 5);
  assert.equal(b.deCuantas, 5);
  assert.deepEqual(
    b.columnas.map((c) => [c.clave, c.cuantos, c.filas.length]),
    [
      ['agendado', 3, 3],
      ['seguimiento', 2, 2],
      ['ganado', 0, 0],
    ],
    'sin filtro el tablero tiene que salir igual que entró, conteos incluidos',
  );
});

test('EL CONTEO DE CADA COLUMNA SE RECALCULA con el filtro puesto', () => {
  const b = buscar(tablero(), 'benitez');

  assert.equal(b.filtrando, true);
  assert.equal(b.coincidencias, 1);
  assert.equal(b.deCuantas, 5, 'se perdió sobre cuántas se buscó: «1 coincidencia» no dice de cuántas');

  assert.deepEqual(
    b.columnas.map((c) => [c.clave, c.cuantos, c.filas.length]),
    [
      ['agendado', 1, 1],
      ['seguimiento', 0, 0],
      ['ganado', 0, 0],
    ],
    'el encabezado seguiría mostrando el total de la etapa con dos filas debajo, que es el ' +
      'defecto que el buzón ya tuvo: «25» con siete filas',
  );

  // Y el tablero de entrada NO se toca: dos búsquedas seguidas tienen que ver lo mismo.
  const t = tablero();
  buscar(t, 'benitez');
  assert.equal(t[0]!.filas.length, 3, 'el filtro mutó el tablero de entrada');
  assert.equal(t[0]!.cuantos, 3);
});

test('las SIETE columnas siguen estando con un filtro que no coincide con nada', () => {
  /* La invariante de esta pantalla: una columna que desaparece hace que nadie note que está vacía.
     Un filtro no puede romperla — si al buscar se cayeran las columnas sin coincidencias, el
     tablero pasaría de siete secciones a una y se leería como si el embudo se hubiera vaciado. */
  const b = buscar(tablero(), 'nadie-se-llama-asi');
  assert.equal(b.coincidencias, 0);
  assert.equal(b.columnas.length, 3, 'el filtro se llevó columnas enteras');
  assert.ok(
    b.columnas.every((c) => c.cuantos === 0 && c.filas.length === 0),
    'quedó una columna con filas que no coinciden',
  );
});

// ─── 6 · El tablero truncado ─────────────────────────────────────────────────

test('sobre un tablero TRUNCADO, la búsqueda lo declara', () => {
  /* Es la única condición que hace honesto filtrar en la pantalla: que la pantalla tenga todo. Hoy
     la tiene —el Pipeline pide `todas: true` con un tope de 5.000 y la cartera real son 268— pero el
     día que corte, un cero significa «no está entre los que llegaron». */
  assert.equal(buscar(tablero(), 'benitez', { hayMas: true }).parcial, true);
  assert.equal(buscar(tablero(), 'benitez', { hayMas: false }).parcial, false);
  assert.equal(buscar(tablero(), 'benitez').parcial, false, 'sin el dato se asume truncado');

  /* Y SIN filtro no se declara, aunque el tablero esté truncado: el aviso de que los conteos están
     incompletos ya lo dibuja el tablero, y dos carteles para el mismo hecho es cómo se aprende a
     ignorar los dos. */
  assert.equal(buscar(tablero(), '', { hayMas: true }).parcial, false);
});

// ─── 7 · Y la pantalla, que es donde se ve ───────────────────────────────────

test('la pantalla distingue los dos vacíos y usa la función compartida', () => {
  /* SIN comentarios: ver `sinComentarios`. Sin esto, esta prueba encuentra su propia explicación
     y una mutación real la deja en verde — medido. */
  const jsx = sinComentarios(leer('components/closer/Pipeline.jsx'));

  assert.match(
    jsx,
    /import \{ buscar \} from '\.\.\/\.\.\/lib\/negocio\/buscarLead\.ts'/,
    'el Pipeline no usa la función compartida: un filtro escrito a mano en el JSX no se puede probar',
  );

  /* LOS DOS VACÍOS. Se comprueba que el mensaje de «no hay» **esté condicionado** y que exista el
     otro: con un solo texto, alguien con algo escrito lee «Nadie en esta etapa» en las siete
     columnas y concluye que su cartera está vacía.

     Se busca la forma y no el texto exacto —`b.filtrando ?` seguido de los dos— porque una prueba
     que persiga la frase se satisface cambiándole una coma. */
  assert.match(
    jsx,
    /b\.filtrando[\s\S]{0,200}coincide[\s\S]{0,200}Nadie en esta etapa/,
    'el vacío de una etapa no distingue «no hay contactos» de «el filtro los tapó»',
  );

  /* Y las columnas que se dibujan son las FILTRADAS. Sin esto el buscador cuenta bien y dibuja el
     tablero entero, que es lo mismo que no filtrar — con un contador que dice que sí. */
  assert.match(jsx, /\{b\.columnas\.map\(/, 'el Pipeline dibuja las columnas sin filtrar');
  assert.ok(
    !/\{datos\.columnas\.map\(/.test(jsx),
    'quedaron las columnas sin filtrar dibujándose: el filtro no tendría efecto',
  );

  /* El campo es un `type="search"` de verdad y tiene etiqueta. No es prolijidad: sin `<label>`
     asociado, un lector de pantalla anuncia «cuadro de edición» sin decir de qué. */
  assert.match(jsx, /type="search"/, 'el buscador no es un campo de búsqueda');
  assert.match(jsx, /htmlFor="pipe-q"/, 'el campo del buscador no tiene etiqueta asociada');
  assert.match(jsx, /id="pipe-q"/);

  /* ── Y EL VERBO CONCUERDA CON CERO ──────────────────────────────────────
   *
   * La primera versión escribió `coincidencias === 1 ? 'coincide' : 'coinciden'`, y la pantalla
   * decía **«Ninguno coinciden»** justo cuando la búsqueda no encontraba nada — que es el único
   * caso en que alguien se queda leyendo el mensaje. Con cero el sujeto es «Ninguno», singular.
   *
   * Se afirma la AUSENCIA del defecto y no la presencia de la línea que lo arregla: pegar la
   * expresión exacta ataría esta prueba a una forma de escribirla, y el día que alguien la mueva a
   * una función el guardia fallaría sin que nada esté mal. */
  assert.ok(
    !/coincidencias === 1 \? 'coincide'/.test(jsx),
    'el plural se decide contra 1, así que con CERO coincidencias la pantalla dice «Ninguno ' +
      'coinciden». Con cero el verbo va en singular',
  );
});

test('el buscador tiene forma en las DOS estéticas, porque el componente es compartido', () => {
  /* `components/closer/Pipeline.jsx` es el mismo en el Closer y en el Setter, y
     `closer-estetica.css` cuelga de `#v-closer`. Con el estilo sólo ahí, el Setter estrenaría el
     `<input>` crudo del navegador —blanco, cuadrado— en medio de un tablero oscuro. */
  const base = leer('app/closer.css');
  const nueva = leer('app/closer-estetica.css');

  for (const clase of ['.pipe-buscar', '.pipe-q', '.pipe-q-x', '.pipe-q-n']) {
    assert.ok(
      base.includes(clase),
      `\`${clase}\` no tiene forma en \`closer.css\`: en el Setter se vería el control crudo`,
    );
  }
  assert.ok(nueva.includes('.pipe-q'), 'la estética nueva no refina el buscador');

  /* Y LOS 16 px EN MÓVIL, que es el único valor de esta pantalla que SUBE en pantalla angosta.
     No es una preferencia: con menos, el navegador de un teléfono hace acercamiento al enfocar el
     campo y deja la pantalla corrida. Está en las dos hojas y en las dos tiene que quedar. */
  for (const [nombre, hoja] of [['closer.css', base], ['closer-estetica.css', nueva]] as const) {
    const i = hoja.indexOf('.pipe-q {');
    assert.ok(i > 0, `no está la regla del campo en ${nombre}`);
    const regla = hoja.slice(i, hoja.indexOf('}', i));
    assert.match(
      regla,
      /font-size:\s*16px/,
      `el campo de ${nombre} no arranca en 16 px: en un teléfono, enfocarlo hace acercamiento`,
    );
  }
});
