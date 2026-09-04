// Volver a una sub-pestaña la encuentra como la dejaste: los pliegues y el scroll. Tipo: Código.
//
// ══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE SE PERSIGUE ACÁ NO ES QUE NO RECUERDE
//
// Es que recuerde MAL, que se ve peor. Dos formas concretas, y las dos dejan la pantalla
// plausible:
//
//   · **Replegar una sección abre todas las otras.** Un `...` que falta al guardar. Se repliegan
//     cuatro etapas del Pipeline, se repliega la quinta, y las cuatro se abren solas.
//   · **Los pliegues de una empresa aparecen en otra.** Los títulos de etapa son los mismos en dos
//     empresas, así que sin la empresa en la clave un superadmin que visita una cuenta ve lo que
//     plegó en la otra. Es la fila `ADR-0703`, y no distingue por gravedad.
//
// ────────────────────────── POR QUÉ ESTO SE PRUEBA LLAMANDO, Y NO MIRANDO EL CÓDIGO ──────────────────────────
//
// La parte que decide qué se guarda vive en `lib/memoriaDeVista.ts`, que **no importa React**, así
// que Node la puede llamar. Fue el motivo de partirla —el mismo que ya obligó a partir
// `lecturas.ts`— y acá se paga solo: una prueba que buscara tres puntos en el código la satisface
// un comentario que los contenga, y eso **ya pasó cinco veces en este proyecto**. Una que pliegue
// DOS secciones y mire la segunda, no.
//
// Los hooks sí se leen como fuente: están en `lib/usarMemoriaDeVista.ts`, que llega a la sesión por
// un `.tsx` que Node no importa.
// ══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { conPliegue, conScroll, estaPlegada, scrollDe } from '../../lib/memoriaDeVista.ts';
import { claveDeLectura, guardar, leerGuardado } from '../../lib/lecturas.ts';

const UNA = '11111111-1111-4111-8111-111111111111';
const OTRA = '22222222-2222-4222-8222-222222222222';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');

/** Sin comentarios: la lección de `110`, `120`, `123`, `127`, `128` y `129`, ya pagada seis veces. */
const codigo = (r: string): string =>
  leer(r)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/{\/\*[\s\S]*?\*\/}/g, '');

const HOOKS = 'lib/usarMemoriaDeVista.ts';
const PLEGABLE = 'components/negocio/SeccionPlegable.jsx';
const VISTAS = ['components/views/CloserView.jsx', 'components/views/SetterView.jsx'];

// ══════════════════════════════════════════════════════════════════════════════
// 1 · LOS PLIEGUES, LLAMANDO A LAS FUNCIONES
// ══════════════════════════════════════════════════════════════════════════════

test('replegar una sección NO abre las otras', () => {
  /* El defecto es un `...` que falta, y es el más fácil de escribir de los dos:

       guardar(clave, { [titulo]: ahora })

     compila, tipa, y hace que plegar la quinta etapa abra las cuatro anteriores. Se comprueba
     plegando DOS y mirando la primera, que es lo que un comentario no puede satisfacer. */
  let g = conPliegue(null, 'Nuevo', true);
  g = conPliegue(g, 'Contactado', true);
  g = conPliegue(g, 'Agendado', true);

  assert.equal(estaPlegada(g, 'Nuevo'), true, 'plegar una sección desplegó las anteriores');
  assert.equal(estaPlegada(g, 'Contactado'), true);
  assert.equal(estaPlegada(g, 'Agendado'), true);

  // Y desplegar UNA no toca a las demás, que es el mismo defecto en el otro sentido.
  const h = conPliegue(g, 'Contactado', false);
  assert.equal(estaPlegada(h, 'Contactado'), false);
  assert.equal(estaPlegada(h, 'Nuevo'), true, 'desplegar una sección desplegó las otras');
  assert.equal(estaPlegada(h, 'Agendado'), true);
});

test('una sección que nunca se tocó está ABIERTA — ausente no es lo mismo que `false`', () => {
  /* Se pidió con todas las letras: abiertas por omisión. Y no es gusto — nacen cerradas y la
     pantalla arranca mostrando siete renglones de títulos donde estaba el trabajo del día, o sea
     que se lee como que no hay datos.

     Lo que hace que se cumpla es que lo guardado liste solo las REPLEGADAS: una sección nueva —una
     cola que se agregue, una etapa del embudo— nace abierta sin que nadie se acuerde de nada. */
  assert.equal(estaPlegada(null, 'Nuevo'), false, 'sin nada guardado, la sección nace plegada');
  assert.equal(estaPlegada({}, 'Nuevo'), false);
  assert.equal(
    estaPlegada(conPliegue(null, 'Otra', true), 'Nuevo'),
    false,
    'plegar una sección plegó también a una que no existe en lo guardado',
  );
});

test('el pliegue de una empresa NO se lee desde la otra', () => {
  /* `ADR-0703`, por comportamiento. Los títulos de etapa son idénticos entre empresas, así que sin
     la empresa en la clave esto cruzaría — y como es un pliegue, nadie lo reportaría: la pantalla
     se ve bien, simplemente arranca con otras secciones cerradas. */
  const tablero = 'pliegues/closer/pipeline';
  guardar(claveDeLectura(UNA, tablero), conPliegue(null, 'Nuevo', true));

  const deLaOtra = leerGuardado<Record<string, boolean>>(claveDeLectura(OTRA, tablero));
  assert.equal(deLaOtra, null, 'la otra empresa lee los pliegues de la primera');

  const propios = leerGuardado<Record<string, boolean>>(claveDeLectura(UNA, tablero));
  assert.equal(estaPlegada(propios?.valor ?? null, 'Nuevo'), true, 'la empresa perdió su propio pliegue');
});

test('los pliegues de los CUATRO tableros no se pisan entre sí', () => {
  /* El motivo de que exista el `tablero`, y estaba escrito en el componente antes de que hubiera
     con qué arreglarlo: «Seguimientos de hoy» está en el Mi Día del closer Y en el del setter, y
     `MiDia` es EL MISMO componente en las dos pestañas. Sin el nombre adelante, replegar en una
     replegaría en la otra. */
  const titulo = 'Seguimientos de hoy';
  guardar(claveDeLectura(UNA, 'pliegues/closer/dia'), conPliegue(null, titulo, true));

  for (const otro of ['pliegues/setter/dia', 'pliegues/closer/pipeline', 'pliegues/setter/pipeline']) {
    const g = leerGuardado<Record<string, boolean>>(claveDeLectura(UNA, otro));
    assert.equal(
      estaPlegada(g?.valor ?? null, titulo),
      false,
      `replegar en \`closer/dia\` replegó también en \`${otro}\``,
    );
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 2 · EL SCROLL, LLAMANDO A LAS FUNCIONES
// ══════════════════════════════════════════════════════════════════════════════

test('el scroll de una sub-pestaña no pisa el de las otras, y ausente es arriba', () => {
  /* Mismo defecto del `...` y misma consecuencia invertida: ir a Contactos y volver dejaría el
     Pipeline en la posición de Contactos, que es peor que dejarlo arriba — la lista aparece
     empezada por el medio sin que nadie la haya movido. */
  let g = conScroll(null, 'contactos', 800);
  g = conScroll(g, 'pipeline', 120);

  assert.equal(scrollDe(g, 'contactos'), 800, 'guardar una sub-pestaña borró la otra');
  assert.equal(scrollDe(g, 'pipeline'), 120);
  assert.equal(scrollDe(g, 'inicio'), 0, 'una sub-pestaña sin nada guardado no empieza arriba');
  assert.equal(scrollDe(null, 'inicio'), 0);

  // Y volver a 0 se guarda como 0, no se pierde: subir a mano tiene que quedar guardado.
  assert.equal(scrollDe(conScroll(g, 'contactos', 0), 'contactos'), 0);
});

// ══════════════════════════════════════════════════════════════════════════════
// 3 · LOS HOOKS Y LAS PANTALLAS, LEYENDO LA FUENTE
// ══════════════════════════════════════════════════════════════════════════════

test('el pliegue sale de lo guardado en el PRIMER render, no de un efecto', () => {
  /* Con un efecto la sección se dibuja abierta y se cierra sola un instante después. Ese salto se
     ve peor que no recordar nada, porque parece que la pantalla se movió sola. */
  assert.match(
    codigo(HOOKS),
    /useState<boolean>\(\(\) => estaPlegada\(leer\(\), titulo\)\)/,
    'el pliegue inicial ya no sale de lo guardado en el primer render',
  );
});

test('los CUATRO tableros pasan su nombre, y ninguno se quedó sin él', () => {
  /* Sin `tablero` el componente funciona y **no recuerda nada**: es un modo de falla silencioso,
     así que los cuatro se afirman por nombre. */
  const cuatro = ['closer/dia', 'closer/pipeline', 'setter/dia', 'setter/pipeline'];
  const fuente = VISTAS.map(codigo).join('\n');
  for (const t of cuatro) {
    assert.ok(
      fuente.includes(`tablero="${t}"`),
      `ninguna vista pasa el tablero \`${t}\`: ese tablero dejó de recordar sus pliegues y nada falla`,
    );
  }

  /* Y los dos componentes lo BAJAN a la sección. Recibirlo y no pasarlo se ve igual desde las
     vistas, y es el mismo silencio. */
  for (const c of ['components/closer/MiDia.jsx', 'components/closer/Pipeline.jsx']) {
    assert.match(codigo(c), /tablero=\{tablero\}/, `${c} recibe el tablero y no lo baja a la sección`);
  }
});

test('TODO cambio de sub-pestaña anota el scroll antes de cambiar', () => {
  /* Hay DOS caminos a una sub-pestaña —los botones de la barra y el «ver mi día» de Inicio— y el
     que se saltee la anotación pierde el scroll sin que nada falle. Por eso se afirma que NO queda
     ningún `setSub(` fuera del envoltorio: es la forma que un camino nuevo no puede estrenar. */
  for (const v of VISTAS) {
    const fuente = codigo(v);

    assert.match(
      fuente,
      /anotarScroll\(\);\s*\n\s*setSub\(clave\);/,
      `${v} cambia de sub-pestaña sin anotar el scroll primero`,
    );

    const sueltos = fuente.match(/setSub\(/g) ?? [];
    assert.equal(
      sueltos.length,
      1,
      `${v} llama a \`setSub\` en ${sueltos.length} lugares: el que no pase por \`irASub\` pierde ` +
        'el scroll, y no falla nada',
    );

    assert.match(fuente, /className="view-scroll cre-scroll" ref=\{caja\}/, `${v} no engancha la caja`);
  }
});

test('el scroll se restaura ANTES de pintar, y no con un `useEffect`', () => {
  /* `useEffect` corre después del pintado: la lista aparece arriba y salta a los 800 un cuadro
     después. `useLayoutEffect` corre entre la mutación del DOM y el pintado.

     Y el cambio por entorno tiene que seguir estando: `useLayoutEffect` en el servidor avisa en
     cada render, y estas vistas SÍ se renderizan ahí. */
  const fuente = codigo(HOOKS);
  assert.match(
    fuente,
    /const usarEfectoDeDiseno =\s*\n?\s*typeof window === 'undefined' \? useEffect : useLayoutEffect;/,
    'el efecto de diseño dejó de elegirse por entorno: o avisa en el servidor, o salta al pintar',
  );
  assert.match(fuente, /usarEfectoDeDiseno\(\(\) => {/, 'la restauración ya no usa el efecto de diseño');
});

test('no hay un `onScroll` que anote, porque el recorte del navegador también dispara scroll', () => {
  /* Era el camino obvio y está descartado con motivo: cuando la sub-pestaña nueva trae contenido
     más corto, el navegador recorta el `scrollTop` y **eso emite un evento de scroll**. Un
     `onScroll` que anote pisaría el 800 de la persona con el 0 del recorte, en un momento que no se
     puede distinguir de un scroll de verdad.

     El límite de palabra no es adorno: sin él esta prueba fallaba por su propio arreglo, porque
     `conScroll` —la función que guarda— contiene `onScroll` adentro. Buscar el nombre suelto
     también habría tapado el caso al revés. */
  for (const a of [HOOKS, ...VISTAS]) {
    assert.doesNotMatch(
      codigo(a),
      /\bonScroll\b|addEventListener\('scroll'/,
      `${a} volvió a anotar el scroll por evento: el recorte del navegador lo pisa con 0`,
    );
  }
});

test('los hooks GUARDAN lo que recuerdan — o toda esta función no hace nada', () => {
  /* ────────────────────────── EL MISMO HUECO QUE YA APARECIÓ EN LA MEMORIA DE LECTURAS ──────────────────────────
   *
   * Ahí una mutación borró el `guardar(…)` del hook y **todo quedó verde**: la memoria nunca se
   * llena, cada visita vuelve a empezar de cero, y la función entera deja de existir sin que se
   * vea distinta de antes de escribirla. Acá pasó lo mismo, dos veces —el pliegue y el scroll—
   * porque se comprobaba que LEEN y no que ESCRIBAN.
   *
   * Se afirma la llamada completa, con sus argumentos: `guardar(clave, {…})` armando el objeto a
   * mano ahí mismo es exactamente el defecto del `...` que la sección 1 persigue, y pasaría una
   * aserción que solo buscara `guardar(`. */
  const fuente = codigo(HOOKS);

  assert.match(
    fuente,
    /guardar\(clave, conPliegue\(leer\(\), titulo, ahora\)\)/,
    'el pliegue no se guarda: se repliega una sección, se vuelve, y está abierta — como antes de ' +
      'que esto existiera, y sin que falle nada',
  );
  assert.match(
    fuente,
    /guardar\(clave, conScroll\(leer\(\), sub, el\.scrollTop\)\)/,
    'el scroll no se anota: cambiar de sub-pestaña lo pierde igual que antes',
  );
});

test('la clave lleva el TABLERO y la PESTAÑA, y recordar no está invertido', () => {
  /* Tres mutaciones sobrevivieron acá, y las tres dejan la pantalla plausible:

       · la clave del pliegue sin el tablero → los CUATRO tableros comparten un registro, así que
         replegar «Seguimientos de hoy» en el Closer lo repliega en el Setter;
       · la clave del scroll sin la pestaña → Closer y Setter comparten el scroll, y sus
         sub-pestañas se llaman igual (`inicio`, `dia`, `pipeline`);
       · el ternario invertido → con tablero no recuerda NADA, y sin tablero recuerda todo junto.

     La sección 1 no las ve porque llama a las funciones puras con claves armadas a mano: lo que
     se está comprobando acá es quién arma la clave de verdad. */
  const fuente = codigo(HOOKS);

  assert.match(
    fuente,
    /usarClaveDeLectura\(`pliegues\/\$\{tablero \?\? 'sin-tablero'}`\)/,
    'la clave del pliegue perdió el tablero: los cuatro tableros se pisan entre sí',
  );
  assert.match(
    fuente,
    /usarClaveDeLectura\(`scroll\/\$\{pestana}`\)/,
    'la clave del scroll perdió la pestaña: Closer y Setter comparten posición',
  );
  assert.match(
    fuente,
    /const clave = tablero === null \? null : claveDelTablero;/,
    'el ternario del tablero está invertido: con tablero no recuerda nada',
  );
});

test('`usarClaveDeLectura` se llama SIEMPRE, nunca dentro de un ternario', () => {
  /* ────────────────────────── LO QUE NO TIENE OTRO GUARDIA EN ESTE PROYECTO ──────────────────────────
   *
   * Llamar un hook dentro de un ternario cambia la CANTIDAD de hooks entre dos renders y React
   * tira «rendered fewer hooks than expected». Con los cuatro tableros constantes de hoy no
   * fallaría; el día que alguien pase un tablero condicional, sí — y es una pantalla en blanco,
   * no un pliegue mal recordado.
   *
   * Normalmente esto lo ata `react-hooks/rules-of-hooks`, y acá no: **el proyecto no tiene ESLint
   * instalado** —`package.json` no tiene ni script ni dependencia—, así que los
   * `eslint-disable-next-line` que hay en cinco archivos son convención, no una regla que corra.
   * Sin esta prueba, la regla no está comprobada en ninguna parte.
   *
   * Se afirma la forma POSITIVA —la llamada abre su propia sentencia— y no «que no haya un `?`
   * cerca»: escrito en negativo, cualquier reformateo lo esquiva. */
  const lineas = codigo(HOOKS)
    .split('\n')
    .filter((l) => l.includes('usarClaveDeLectura('));

  assert.equal(lineas.length, 2, 'cambió la cantidad de claves que se arman: revisar esta prueba');
  for (const linea of lineas) {
    assert.match(
      linea,
      /^\s*const \w+ = usarClaveDeLectura\(/,
      `un hook se llama en medio de una expresión: \`${linea.trim()}\` — con un tablero ` +
        'condicional, React deja la pantalla en blanco',
    );
  }
});

test('la parte pura NO importa React, que es lo que hace comprobable todo lo de arriba', () => {
  /* Es la mitad estructural de este archivo. Con las cuatro funciones dentro del módulo de hooks,
     Node no puede importarlas —la sesión llega por un `.tsx`— y las pruebas de las secciones 1 y 2
     tendrían que volver a mirar el código. */
  const puro = leer('lib/memoriaDeVista.ts');
  assert.doesNotMatch(puro, /from 'react'/, 'la parte pura importa React: deja de poder probarse llamando');
  assert.doesNotMatch(puro, /^'use client';/, 'la parte pura declaró `use client` sin tener estado que eximir');

  for (const f of ['estaPlegada', 'conPliegue', 'scrollDe', 'conScroll']) {
    assert.match(puro, new RegExp(`export function ${f}\\(`), `\`${f}\` se fue de la parte pura`);
  }
});

test('el componente no se quedó con su propio estado al lado del recordado', () => {
  /* Dos fuentes de verdad para el mismo pliegue es el defecto entero: una se guarda y la otra no,
     y la que gana depende de cuál lea el render. */
  const fuente = codigo(PLEGABLE);
  assert.doesNotMatch(fuente, /useState/, 'la sección conserva un estado propio al lado del recordado');
  assert.match(fuente, /usarPliegue\(tablero, titulo\)/, 'la sección dejó de usar la memoria');
});
