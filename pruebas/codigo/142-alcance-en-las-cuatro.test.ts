// Ninguna pantalla del Closer se olvida del alcance. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTE GUARDIA EXISTE PORQUE EL DEFECTO YA OCURRIÓ, Y ESTABA ANUNCIADO
//
// `lib/negocio/alcanceDelCloser.ts` escribió el modo de falla antes de que pasara:
//
//   *«Repetir los tres pasos en cada ruta es cómo se llega a que una de las tres se olvide de
//   aplicar el alcance: las otras dos filtran, ésa no, y el closer ve en Contactos los leads que Mi
//   Día le esconde. **No falla nada.**»*
//
// Y pasó: la Agenda —la cuarta pantalla— no lo aplicaba, así que con tres closers vinculados los
// tres veían las citas de los tres. El comportamiento lo cuida `141-agenda-de-quien-mira`; lo que
// ese archivo **no puede** cuidar es la QUINTA pantalla, la que todavía no existe.
//
// ── POR QUÉ UN GUARDIA DE CÓDIGO Y NO UNA PRUEBA MÁS DE COMPORTAMIENTO ─────
//
// Porque una prueba de comportamiento hay que acordarse de escribirla, y el defecto es justamente
// olvidarse. Este archivo falla el día que alguien agregue un `GET` bajo `app/api/closer/` sin
// decidir de quién son los datos que devuelve — y lo obliga a decidir, no a acertar.
//
// Es el mismo argumento que `pruebas/apoyo/autorizados.ts` hace para su lista: una lista explícita
// con su motivo al lado, y todo lo que no está en ella falla hasta que alguien lo mire.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

/**
 * El archivo sin sus comentarios.
 *
 * Obligatorio en este repositorio, y van ocho veces: los comentarios CITAN lo que hay que hacer, así
 * que una prueba que lea código fuente y no los saque encuentra su propia explicación y queda verde
 * sobre código roto. El caso más reciente está contado en `140-boton-de-mi-password`.
 */
const sinComentarios = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** Los `route.ts` de una carpeta y sus subcarpetas, con la ruta relativa al repositorio. */
function rutasBajo(dir: string): string[] {
  const salida: string[] = [];
  const caminar = (rel: string): void => {
    for (const e of readdirSync(join(RAIZ, rel))) {
      const rutaRel = `${rel}/${e}`;
      if (statSync(join(RAIZ, rutaRel)).isDirectory()) caminar(rutaRel);
      else if (e === 'route.ts') salida.push(rutaRel);
    }
  };
  caminar(dir);
  return salida.sort();
}

/**
 * Las rutas del Closer que devuelven LEADS o CITAS, y por eso tienen que decir de quién son.
 *
 * Se nombran una por una en vez de deducirse, por lo mismo que `agendaDelCloser` recibe el
 * territorio por parámetro: una lista escrita a mano se ve en el diff cuando cambia.
 */
const CON_ALCANCE = [
  'app/api/closer/mi-dia/route.ts',
  'app/api/closer/pipeline/route.ts',
  'app/api/closer/contactos/route.ts',
  'app/api/closer/agenda/route.ts',
];

/**
 * Las que NO llevan alcance, cada una con su motivo. **Ninguna es un `GET` de lista.**
 *
 *   · `agenda/refrescar` — un `POST` que trae el calendario de GoHighLevel y ESCRIBE en
 *     `negocio.citas`. Recorta lo que se guarda por territorio, no por closer: si cada uno trajera
 *     solo sus citas, la caché de la empresa dependería de quién apretó el botón último.
 *   · `meta` — un `PATCH` sobre la meta de comisión de quien la fija. No devuelve leads.
 */
const SIN_ALCANCE: Record<string, string> = {
  'app/api/closer/agenda/refrescar/route.ts': 'POST que escribe la caché de citas de la empresa',
  'app/api/closer/meta/route.ts': 'PATCH de la meta propia; no devuelve leads',
};

/**
 * La caja del cerebro del Closer (AG6 de los agentes). Su `GET` devuelve los hilos propios, no leads ni
 * citas; lo que lee leads o citas son las herramientas del cerebro, y ésas resuelven el alcance con la misma
 * función en `lib/agentes/executive/adaptadores/closer.ts`. Lo cuida la prueba de abajo.
 */
const CAJA_DEL_CEREBRO = 'app/api/closer/cerebro/route.ts';

/**
 * Las que resuelven el alcance PROPIO de quien pide, sin «ver como», cada una con su motivo.
 *
 *   · `brief` (AG12 de los agentes) — el Brief de UNA cita que quien pide abrió. Con «mío», sólo de sus
 *     contactos, y eso lo decide `entradaDelBrief` con el alcance. Desde el selector de closer de la cabecera
 *     (2026-10-29) también atiende `verComo`, como las pantallas: no es una lista, así que no está en
 *     `CON_ALCANCE`, y lo cuida su prueba de abajo.
 */
const ALCANCE_PROPIO: Record<string, string> = {
  'app/api/closer/brief/route.ts': 'el Brief de una cita abierta, con el alcance que eligió el selector',
};
const HERRAMIENTAS_DEL_CLOSER = 'lib/agentes/executive/adaptadores/closer.ts';

test('las CUATRO pantallas del Closer resuelven el alcance con la misma función', () => {
  for (const ruta of CON_ALCANCE) {
    const src = sinComentarios(leer(ruta));
    assert.match(
      src,
      /alcanceDeQuienMira\s*\(/,
      `\`${ruta}\` no resuelve el alcance: las otras filtran, ésta no, y el closer ve en una ` +
        'pantalla los leads que la otra le esconde. No falla nada.',
    );
    /* Y lo RESUELVE no alcanza: hay que pasárselo a la consulta. Una llamada cuyo resultado se
       descarta compila, pasa el guardia anterior, y devuelve exactamente lo que devolvía antes. */
    assert.match(
      src,
      /\balcance\b/,
      `\`${ruta}\` resuelve el alcance y no lo usa: la consulta sigue trayendo el territorio entero`,
    );
    // Y atiende «ver como», que es lo que hace que el selector de la cabecera no mienta en una pestaña.
    assert.match(
      src,
      /verComoDeLaUrl\s*\(/,
      `\`${ruta}\` ignora «ver como»: quien administra elige un closer y esta pantalla le sigue ` +
        'mostrando la empresa entera, sin decir que dejó de obedecer al selector',
    );
    /* Y le pasa a `alcanceDeQuienMira` si quien pide supervisa, calculado con la SESIÓN. Sin esto, un supervisor que
       además es closer elige en la cabecera y esta pantalla le sigue mostrando lo suyo. */
    assert.match(
      src,
      /alcanceDeQuienMira\(\s*contexto\.usuarioId,\s*(?:verComo|verComoDeLaUrl\(peticion\)),\s*(?:supervisa|puedeSupervisarClosers\(contexto\.permisos\)),?\s*\)/,
      `\`${ruta}\` no le pasa al alcance si quien pide supervisa: el selector no le sirve a quien es closer`,
    );
  }
});

test('no hay una QUINTA pantalla del Closer sin decidir de quién son sus datos', () => {
  /* La mitad que mira al futuro. Sin esto, el archivo entero es una foto de hoy: cuida las cuatro
     que ya existen y no dice nada de la que se agregue mañana — que es el defecto que ya ocurrió,
     con la Agenda, cuando había tres. */
  const todas = rutasBajo('app/api/closer');
  assert.ok(todas.length >= CON_ALCANCE.length, 'no se encontraron las rutas del Closer');

  for (const ruta of todas) {
    if (CON_ALCANCE.includes(ruta) || ruta === CAJA_DEL_CEREBRO || ruta in ALCANCE_PROPIO) continue;
    const motivo = SIN_ALCANCE[ruta];
    assert.ok(
      motivo,
      `\`${ruta}\` es una ruta nueva del Closer y nadie decidió de quién son sus datos. Si devuelve ` +
        'leads o citas, agregala a `CON_ALCANCE` y resolvé el alcance en la ruta. Si no, agregala a ' +
        '`SIN_ALCANCE` con el motivo escrito.',
    );

    /* Y la exención tiene que seguir siendo cierta: si una de esas dos gana un `GET`, pasa a ser
       una vitrina y el motivo escrito deja de aplicar. */
    const src = sinComentarios(leer(ruta));
    assert.ok(
      !/export\s+async\s+function\s+GET\b/.test(src),
      `\`${ruta}\` está exento del alcance por «${motivo}», y ahora exporta un GET: una lectura ` +
        'del Closer sin alcance devuelve los leads de todos',
    );
  }
});

test('la caja del cerebro del Closer no lee leads, y sus cuatro herramientas resuelven el alcance', () => {
  const caja = sinComentarios(leer(CAJA_DEL_CEREBRO));
  assert.doesNotMatch(caja, /lib\/negocio\//, 'la caja del cerebro lee de `lib/negocio`: dejó de ser sólo los hilos');
  assert.match(caja, /loDelPanel\(contexto, PANTALLA, hilo\)/);
  /* Cada herramienta resuelve el alcance, sin «ver como» (el cerebro mira lo que ve quien pregunta al abrir la
     pantalla), y se lo pasa a su consulta. */
  const herramientas = sinComentarios(leer(HERRAMIENTAS_DEL_CLOSER));
  assert.equal((herramientas.match(/alcanceDeQuienMira\(contexto\.usuarioId, null\)/g) ?? []).length, 4);
  // Cada llamada a las colas lleva el alcance: con un `match`, la otra llamada taparía la que no lo lleva.
  const colas = herramientas.match(/colasDelDia\(/g) ?? [];
  assert.equal(colas.length, 2);
  assert.equal((herramientas.match(/colasDelDia\(contexto\.zona, alcance\)/g) ?? []).length, colas.length);
  assert.match(herramientas, /agendaDelCloser\('closer', contexto\.zona, \{ dias: DIAS_DE_LA_AGENDA, alcance \}\)/);
  assert.match(herramientas, /pipelineDe\('closer', \{ conCongelados: true, alcance \}\)/);
});

test('la Agenda corta por asignación en SUS TRES consultas, no solo en la lista', () => {
  /* Son tres: la lista, y los dos conteos que explican un cero —«quedaron 12 citas de días
     anteriores» y «hay 3 citas más adelante»—. Los dos conteos ya tenían este cuidado por
     territorio, con el motivo escrito ahí: *«explicar un cero con un número de otra pantalla»*.

     Un conteo sin cortar no rompe ninguna lista: deja un mensaje correcto con un número ajeno, que
     manda a esa persona a buscar citas que su Agenda no le va a mostrar nunca. */
  /* El corte es `contactoDelCloser` (el nivel 3: por par cliente-usuario del CRM), y la columna ya no
     se nombra suelta en este archivo: un `crm_asignado_a` a mano sería un corte que no mira el cliente. */
  /* Desde el selector de closer (2026-10-29) el corte es `corteDelAlcance` —«mío» o «sin asignar»—, armado una vez
     por consulta con `corteDe` y aplicado con el mismo `q.where(corte)` en las tres. */
  const src = sinComentarios(leer('lib/negocio/agenda.ts'));
  assert.match(src, /corteDelAlcance\('k', alcance\)/, '`agenda.ts` dejó de armar el corte con `corteDelAlcance`');
  assert.equal((src.match(/const corte = corteDe\(/g) ?? []).length, 3, 'una consulta de la Agenda no arma el corte');
  const cortes = (src.match(/if \(corte !== null\) q = q\.where\(corte\);/g) ?? []).length;
  assert.equal(
    cortes,
    3,
    `\`agenda.ts\` corta por asignación en ${cortes} consultas y tiene TRES que lo necesitan: la ` +
      'lista y los dos conteos que explican un cero',
  );
  assert.doesNotMatch(src, /tipo === 'mio'/, '`agenda.ts` corta con un `tipo === \'mio\'` suelto: «sin asignar» pasaría como todo');
  assert.doesNotMatch(src, /crm_asignado_a/, '`agenda.ts` corta a mano por `crm_asignado_a`, sin el cliente del contacto');
});

test('el selector «ver como» viaja a las sub-pestañas que lo obedecen', () => {
  /* Antes lo mandaba solo Mi Día. Las cuatro rutas lo atendían, así que quien administra elegía a
     un closer, veía su día, cambiaba de sub-pestaña y el Pipeline y la Agenda volvían a la empresa
     entera — con el nombre elegido todavía anunciado arriba. */
  const vista = sinComentarios(leer('components/views/CloserView.jsx'));

  assert.match(
    vista,
    /<Agenda[^>]*verComo=/,
    'la Agenda no recibe «ver como»: el selector la deja mostrando la empresa entera',
  );
  assert.match(
    vista,
    /<Pipeline[\s\S]{0,200}?conVerComo\(/,
    'el Pipeline no recibe «ver como»: mismo defecto, otra sub-pestaña',
  );

  /* Y la Agenda lo mete DENTRO del camino que lee, porque el camino es la clave de `usarLectura`:
     afuera, cambiar de closer devolvería en el primer dibujo la agenda guardada del anterior. */
  const agenda = sinComentarios(leer('components/closer/Agenda.jsx'));
  assert.match(
    agenda,
    /usarLectura\(\s*[\s\S]{0,300}?verComo/,
    'la Agenda recibe «ver como» y no lo manda en el camino que lee, o lo manda fuera de la clave',
  );
});

test('el Brief resuelve el alcance elegido y se lo pasa a lo que lee, en el GET y en el POST', () => {
  for (const ruta of Object.keys(ALCANCE_PROPIO)) {
    const src = sinComentarios(leer(ruta));
    assert.equal((src.match(/alcanceDeQuienMira\s*\(/g) ?? []).length, 2, `\`${ruta}\` no resuelve el alcance en sus dos operaciones`);
    /* Con el selector de closer (2026-10-29) el Brief obedece la elección, con el candado de la sesión: antes pasaba
       `null` y un supervisor que era closer no podía abrir el Brief de la cita de otro. */
    assert.equal(
      (src.match(/alcanceDeQuienMira\(contexto\.usuarioId, verComoDeLaUrl\(peticion\), puedeSupervisarClosers\(contexto\.permisos\)\)/g) ?? []).length,
      2,
      `\`${ruta}\` no atiende el selector de closer en sus dos operaciones, o no le pasa el permiso de la sesión`,
    );
    assert.equal(
      (src.match(/entradaDelBrief\(\s*cita\s*,\s*alcance\s*\)/g) ?? []).length,
      2,
      `\`${ruta}\` resuelve el alcance y no se lo pasa a lo que lee: serviría el Brief de la cita de otro closer`,
    );
  }
});

test('el selector de closer vive en la cabecera del Closer, y ya no en Inicio', () => {
  /* El pedido (2026-10-29): «en el menú de dashboard de closer debe estar la parte para seleccionar el closer». Estaba
     dentro de Inicio, y sólo para quien ve todo: el administrador que además es closer no lo veía nunca, y en Mi Día,
     Pipeline y Agenda no estaba. */
  const vista = sinComentarios(leer('components/views/CloserView.jsx'));
  const cabecera = vista.slice(vista.indexOf('className="cre-head"'), vista.indexOf('className="cl-page"'));
  assert.ok(cabecera.length > 0, 'no se encontró la cabecera del Closer');
  assert.match(
    cabecera,
    /<div className="ch-r">\s*<SelectorDeCloser\b/,
    'el selector de closer no está en la cabecera (`.cre-head > .ch-r`): no se ve en todas las sub-pestañas',
  );
  // Lo ofrece el SERVIDOR, no la pantalla comparando identificadores.
  assert.match(cabecera, /datos\?\.puedeElegirCloser \?/, 'el selector no cuelga de `puedeElegirCloser`, que decide el servidor');
  // Y lo elegido viaja: el `todo` de arranque y el Brief, que lee por fuera de la vista.
  assert.match(vista, /useState\('todo'\)/, 'quien puede elegir no arranca en «Toda la empresa»');
  assert.match(vista, /<VerComoDelCloser\.Provider value=\{verComo\}>/, 'el Brief no recibe la elección del selector');

  const inicio = sinComentarios(leer('components/closer/Inicio.jsx'));
  assert.doesNotMatch(inicio, /<select\b|ck-vercomo|alVerComo/, 'Inicio volvió a dibujar su propio selector «ver como»');

  const brief = sinComentarios(leer('components/closer/BriefDeLaCita.jsx'));
  assert.equal(
    (brief.match(/conVerComo\(/g) ?? []).length,
    2,
    'el Brief no manda la elección del selector en sus dos pedidos (leer y generar)',
  );

  const selector = sinComentarios(leer('components/closer/SelectorDeCloser.jsx'));
  // La píldora del sistema, la del selector de cliente, y accesible: menú con su estado y el cierre con Escape.
  for (const pieza of [/className="acct"/, /className="menu-pop" role="menu"/, /className="mp-head"/, /role="menuitemradio"/, /aria-checked=/, /aria-expanded=\{abierto\}/, /usarCierreDeMenu\(abierto, caja, cerrar\)/]) {
    assert.match(selector, pieza, `al selector le falta ${pieza}`);
  }
  for (const opcion of ["'Lo mío'", "'Toda la empresa'", "'Sin asignar'"]) {
    assert.ok(selector.includes(opcion), `al selector le falta la opción ${opcion}`);
  }

  const midia = sinComentarios(leer('app/api/closer/mi-dia/route.ts'));
  assert.match(midia, /const supervisa = puedeSupervisarClosers\(contexto\.permisos\);/, 'Mi Día no calcula con la sesión quién supervisa');
  assert.match(midia, /puedeElegirCloser: puedeElegirCloser\(propio, closers, supervisa\)/, 'Mi Día no le dice a la pantalla si ofrecer el selector');
});

test('el selector de la cabecera usa sólo tokens del tema, y a 375 px va a todo el ancho', () => {
  const hoja = readFileSync(join(RAIZ, 'app/closer.css'), 'utf8');
  const i = hoja.indexOf('#v-closer .sc-closer .acct-wrap {');
  assert.ok(i > 0, 'no están las reglas del selector de closer en `app/closer.css`');
  const reglas = hoja.slice(i, hoja.indexOf('\n}', hoja.indexOf('@media (max-width: 760px)', i)) + 2);
  assert.doesNotMatch(reglas, /#[0-9a-f]{3,8}\b(?![\w-]*\s*\{)|rgb\(\d/i, 'el selector de closer tiene un color literal: no cambia con el tema');
  assert.match(reglas, /@media \(max-width: 760px\)[\s\S]*#v-closer \.cre-head \.ch-r \{\s*width: 100%;/, 'a 375 px la columna del selector no ocupa el ancho');
});

test('con «Sin asignar», el anillo de comisión lo dice y no habla de la suma de toda la empresa', () => {
  /* Revisión de la etapa 8a (2026-10-29): con «Sin asignar» en el selector, `comision` llega nula y el anillo decía
     «TODA LA EMPRESA · La comisión es de una persona, así que sumada no sería de nadie»: una suma que no se estaba
     mirando. Inicio le pasa la elección a `Comision`, y `Comision` tiene su texto. */
  const inicio = sinComentarios(leer('components/closer/Inicio.jsx'));
  assert.match(
    inicio,
    /sinComision=\{\s*\(closers \?\? \[\]\)\.length === 0 \? 'sin_closer' : eleccion === 'sin_asignar' \? 'sin_asignar' : 'toda_la_empresa'\s*\}/,
    'Inicio no le dice al anillo de comisión que se está mirando «Sin asignar»',
  );
  const comision = sinComentarios(leer('components/negocio/Comision.jsx'));
  assert.match(comision, /sinComision === 'sin_asignar'\s*\?\s*'SIN ASIGNAR'/, 'el anillo no rotula «SIN ASIGNAR»');
  assert.match(
    comision,
    /sinComision === 'sin_asignar'\s*\?\s*'Los contactos sin asignar no son de ningún closer/,
    'el anillo de «Sin asignar» no explica por qué no hay comisión',
  );
});

test('una respuesta de Mi Día pedida con la elección anterior no pisa la del closer elegido', () => {
  /* Revisión de la etapa 8a (2026-10-29): `cargar` no miraba si la elección había cambiado mientras esperaba. Un tic
     del reloj con el closer anterior que volvía tarde pisaba los datos: la píldora volvía a marcar al anterior, Pipeline
     y Agenda ya mostraban el nuevo, y elegirlo de nuevo no hacía nada. */
  const vista = sinComentarios(leer('components/views/CloserView.jsx'));
  assert.match(
    vista,
    /const elegirCloser = useCallback\(\(valor\) => \{\s*verComoVigente\.current = valor;\s*setVerComo\(valor\);/,
    'elegir un closer no marca cuál es la elección vigente antes de pedir',
  );
  assert.match(vista, /alElegir=\{elegirCloser\}/, 'el selector cambia la elección sin marcarla como vigente');
  assert.match(
    vista,
    /await pedir\(conVerComo\('\/api\/closer\/mi-dia', verComo\)\);\s*if \(verComo !== verComoVigente\.current\) return;\s*/,
    'Mi Día acepta una respuesta pedida con una elección que ya no es la vigente',
  );
});
