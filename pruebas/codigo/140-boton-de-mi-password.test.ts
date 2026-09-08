// La puerta al cambio de la propia contraseña, y la validación en un solo lugar. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL ENDPOINT ESTABA. FALTABA LA PUERTA.
//
// `POST /api/auth/sesion` cambia la propia contraseña desde la Etapa 3, y su comentario aclara que
// *«NO exige ninguna capacidad»* porque es la única salida de `debe_cambiar_password`. Pero el
// único formulario que lo llamaba vivía en `app/entrar/page.tsx`, y ahí se llega **solo con una
// contraseña temporal recién puesta por un administrador**.
//
// O sea que cambiar la propia contraseña, en la práctica, no se podía: había que pedirle a un
// administrador que la restableciera con `POST /api/admin/usuarios/{id}/restablecer-password`.
// Proteger tu cuenta dependía de que otra persona estuviera disponible.
//
// ── LO QUE ESTE ARCHIVO VIGILA, Y POR QUÉ CADA COSA ────────────────────────
//
// **1 · El botón existe, y SIN condición.** Un `if` sobre una capacidad o una sección lo
// convertiría en una puerta cerrada sobre algo que el servidor sí permite — y se la cerraría justo
// a quien no tiene permisos para nada, que es quien no puede pedirle el favor a nadie.
//
// **2 · Está ARRIBA de «Cerrar sesión».** Donde se pidió, y por la regla que el pie del menú
// lateral ya aplica: el destructivo va último. Debajo, el orden natural del clic pone el botón que
// te saca del sistema antes que el que querés apretar.
//
// **3 · La validación está en UN solo lugar.** Ahora hay dos pantallas que eligen una contraseña, y
// `politica.ts` existe justamente porque el mínimo estuvo escrito dos veces: su encabezado cuenta
// cómo se llega a *«un formulario que acepta una contraseña que el servidor rechaza — o peor, a uno
// que la rechaza cuando el servidor la habría aceptado, y nadie sabe por qué»*. Con la copia, las
// dos pantallas también habrían tenido dos redacciones para el mismo rechazo.
//
// **4 · Se pide la contraseña ACTUAL.** El servidor la verifica —lo mide
// `139-cambiar-mi-password`— pero sin el campo, el formulario manda una cadena vacía y el rechazo
// es indescifrable para quien lo usa. Y su `autocomplete` tiene que distinguir la actual de la
// nueva, o el gestor de contraseñas guarda la vieja como si fuera la nueva.
//
// **5 · Se avisa que se cierran las demás sesiones, ANTES.** El endpoint las cierra. Sin el aviso,
// alguien cambia la contraseña en la computadora, se encuentra afuera en el teléfono, y lo lee como
// que la aplicación se rompió — no como que hizo exactamente lo que pidió.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AVISO_DE_OTRAS_SESIONES,
  MINIMO_PASSWORD,
  problemaDeLaNueva,
} from '../../lib/autenticacion/politica.ts';

const RAIZ = new URL('../../', import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, RAIZ), 'utf8');

/**
 * El archivo sin sus comentarios.
 *
 * Es obligatorio en este repositorio y ya van siete veces: los comentarios CITAN lo que se quitó y
 * lo que hay que evitar, así que una prueba que lea código fuente y no los saque encuentra su
 * propia explicación. El caso más reciente está contado en `138-buscador-de-leads`, donde una
 * mutación real quedaba en verde porque el comentario nombraba el atributo que la mutación borraba.
 */
const sinComentarios = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const MENU = () => sinComentarios(leer('components/MenuDeUsuario.jsx'));

// ─── 1 y 2 · El botón, y su lugar ────────────────────────────────────────────

test('el menú de la cuenta ofrece cambiar la contraseña, ARRIBA de cerrar sesión', () => {
  const menu = MENU();

  const iCambiar = menu.indexOf('Cambiar contraseña');
  const iSalir = menu.indexOf('Cerrar sesión');
  assert.ok(iCambiar > 0, 'el menú de la cuenta no ofrece cambiar la contraseña');
  assert.ok(iSalir > 0, 'se fue «Cerrar sesión» del menú');
  assert.ok(
    iCambiar < iSalir,
    'el botón de cambiar la contraseña quedó DEBAJO de «Cerrar sesión»: el destructivo va último, ' +
      'porque el orden del clic pone primero el que te saca del sistema',
  );
});

test('el botón NO cuelga de ninguna capacidad ni de ninguna sección', () => {
  /* `ADR-0406`: el endpoint no exige capacidad, y `139-cambiar-mi-password` lo mide. Una condición
     acá sería una puerta cerrada sobre algo que el servidor sí permite — y cerrada justo para quien
     no tiene permisos para nada, o sea quien no le puede pedir el favor a un administrador.

     Se mide sobre el TROZO que va del botón hacia atrás hasta el control anterior: `seccion ?` sí
     existe en este archivo y es correcto —Ajustes solo aparece si la persona tiene la pantalla— así
     que buscar condiciones en todo el archivo daría un falso positivo. */
  const menu = MENU();
  const i = menu.indexOf('Cambiar contraseña');
  assert.ok(i > 0);
  const desdeElAnterior = menu.slice(menu.lastIndexOf('</button>', i), i);
  for (const condicion of [/\?\s*\(/, /&&/, /puede/i, /capacidad/i, /seccion/i]) {
    assert.ok(
      !condicion.test(desdeElAnterior),
      `el botón de cambiar la contraseña quedó detrás de una condición (${condicion}): es una ` +
        'puerta cerrada sobre algo que el servidor permite a todo el mundo',
    );
  }
});

// ─── 3 · La validación, en un solo lugar ─────────────────────────────────────

test('problemaDeLaNueva contesta las dos comprobaciones, y con el texto que se muestra', () => {
  /* La igualdad de las dos copias es la ÚNICA que el servidor no puede hacer: recibe una sola
     contraseña nueva. O sea que es la única de las dos sin segunda línea de defensa. */
  assert.equal(problemaDeLaNueva('unaBuenaContrasena', 'otraCosa'), 'Las dos contraseñas no coinciden.');

  // El largo, construido desde la constante: si alguien sube el mínimo, esto lo sigue sin editarse.
  const corta = 'a'.repeat(MINIMO_PASSWORD - 1);
  assert.equal(
    problemaDeLaNueva(corta, corta),
    `La contraseña nueva necesita al menos ${MINIMO_PASSWORD} caracteres.`,
  );

  // Y el orden: la que no coincide gana. Con dos problemas a la vez, decir el del largo mandaría a
  // alargar una contraseña que además está mal repetida.
  assert.equal(problemaDeLaNueva('abc', 'xyz'), 'Las dos contraseñas no coinciden.');

  const buena = 'a'.repeat(MINIMO_PASSWORD);
  assert.equal(problemaDeLaNueva(buena, buena), null, 'una contraseña válida dio un problema');
});

test('LAS DOS pantallas usan la misma validación, y ninguna se quedó con su copia', () => {
  const pantallas = ['components/MenuDeUsuario.jsx', 'app/entrar/page.tsx'];

  for (const ruta of pantallas) {
    const src = sinComentarios(leer(ruta));
    assert.match(
      src,
      /problemaDeLaNueva/,
      `\`${ruta}\` no usa la validación compartida: dos copias del mínimo en los dos lados de la ` +
        'red es cómo se llega a un formulario que acepta lo que el servidor rechaza',
    );

    /* Y no quedó la copia. Se persigue la FORMA del defecto —una comparación del largo contra el
       mínimo, o el texto de «no coinciden» escrito a mano— y no una frase exacta, que se satisface
       cambiando una coma. */
    assert.ok(
      !/nueva\.length\s*<\s*MINIMO_PASSWORD/.test(src),
      `\`${ruta}\` volvió a comparar el largo por su cuenta`,
    );
    assert.ok(
      !/no coinciden/i.test(src),
      `\`${ruta}\` escribió su propio texto de «no coinciden»: dos pantallas con dos redacciones ` +
        'para el mismo rechazo',
    );
  }
});

// ─── 4 y 5 · El formulario dice lo que tiene que decir ───────────────────────

test('el formulario pide la contraseña ACTUAL, y distingue los tres campos para el gestor', () => {
  const menu = MENU();

  /* Sin el campo, el formulario manda `actual: ''` y el servidor rechaza con
     `credenciales_invalidas` — o sea «tu contraseña es incorrecta» sobre algo que la persona nunca
     escribió. El servidor la verifica igual (`139-cambiar-mi-password`); esto es lo que hace que se
     pueda cumplir. */
  assert.match(menu, /autoComplete="current-password"/, 'el formulario no pide la contraseña actual');

  /* Y las dos nuevas van como `new-password`. Si la nueva llevara `current-password`, el gestor de
     contraseñas guardaría la vieja como si fuera la nueva y la próxima vez ofrecería la que ya no
     sirve. */
  assert.equal(
    (menu.match(/autoComplete="new-password"/g) ?? []).length,
    2,
    'las dos contraseñas nuevas tienen que declararse `new-password`: la nueva y su confirmación',
  );

  // Los tres son campos de contraseña de verdad, no de texto: nada se dibuja en claro.
  assert.equal(
    (menu.match(/type="password"/g) ?? []).length,
    3,
    'algún campo de contraseña no es `type="password"`, así que se ve al escribirlo',
  );
});

test('el aviso de que se cierran las demás sesiones se muestra ANTES de apretar', () => {
  const menu = MENU();

  /* El texto vive en `politica.ts` para que las dos pantallas lo digan igual, y acá se comprueba
     que esta pantalla lo USE — no que lo tenga escrito. */
  assert.match(
    menu,
    /AVISO_DE_OTRAS_SESIONES/,
    'la ventana no anuncia que se cierran las demás sesiones: alguien la cambia en la ' +
      'computadora, se encuentra afuera en el teléfono, y lo lee como que la aplicación se rompió',
  );

  /* Y va como SUBTÍTULO de la ventana, o sea antes del botón. Después del cambio ya es tarde: es
     una consecuencia de la acción, no un resultado.

     ── SE MIDE LA POLARIDAD, NO LA PRESENCIA ─────────────────────────────────
     La primera versión de esto solo pedía que `AVISO_DE_OTRAS_SESIONES` apareciera en el
     `subtitulo`, y una mutación real quedó en VERDE: darlo vuelta a
     `listo ? AVISO_DE_OTRAS_SESIONES : undefined` —o sea anunciarlo cuando ya pasó— seguía
     conteniendo el nombre. La prueba decía «ANTES» y no lo medía.

     Se aceptan las tres formas que sí lo muestran antes: sin condición, o cualquiera de las dos
     redacciones del mismo ternario. Lo que se rechaza es que el aviso viva en la rama de `listo`. */
  const sub = menu.match(/subtitulo=\{([^}]*)\}/)?.[1];
  assert.ok(sub, 'la ventana ya no lleva subtítulo');
  assert.ok(
    /listo\s*\?\s*undefined\s*:\s*AVISO_DE_OTRAS_SESIONES/.test(sub) ||
      /!\s*listo\s*\?\s*AVISO_DE_OTRAS_SESIONES\s*:/.test(sub) ||
      /^\s*AVISO_DE_OTRAS_SESIONES\s*$/.test(sub),
    'el aviso quedó del lado de `listo`: se anunciaría DESPUÉS de cambiar la contraseña, cuando ya ' +
      'no es un aviso sino la noticia de algo que pasó sin avisar',
  );

  // Y el texto nombra las dos mitades: que las otras se cierran y que ESTA no.
  assert.match(AVISO_DE_OTRAS_SESIONES, /demás dispositivos/i);
  assert.match(
    AVISO_DE_OTRAS_SESIONES,
    /esta no/i,
    'el aviso no aclara que la sesión actual sobrevive: sin eso se lee como «te vas a tener que ' +
      'volver a entrar», que es falso',
  );
});

test('las tres ramas de la respuesta no se colapsan (ADR-0305)', () => {
  const menu = MENU();

  /* Un corte de red y una contraseña equivocada mandan a lugares distintos: una se reintenta igual,
     la otra hay que corregirla. Con un solo mensaje, quien se equivocó al escribir la actual se
     queda mirando la red — y quien tuvo un corte cree que su contraseña está mal. */
  assert.match(menu, /tipo === 'sin_respuesta'/, 'la ventana no distingue un corte de red');
  assert.match(menu, /tipo === 'rechazado'/, 'la ventana no distingue un rechazo del servidor');
  assert.match(
    menu,
    /credenciales_invalidas/,
    'la ventana no traduce el único rechazo propio de este endpoint: el genérico diría «no se ' +
      'pudo» sobre algo que se arregla escribiendo bien la contraseña de ahora',
  );

  /* Y el corte de red dice que NO se cambió. Es la mitad que importa de ese mensaje: sin eso, la
     persona no sabe si tiene que volver a entrar con la vieja o con la nueva. */
  assert.match(menu, /NO se cambió/, 'el aviso de corte no dice qué quedó de la contraseña');
});
