// Los dos temas: que sigan siendo dos y no uno con manchas del otro. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// UN TEMA SE PUDRE DE UNA SOLA FORMA, Y ES SILENCIOSA
//
// Alguien escribe `rgba(148,197,255,.08)` en una regla nueva porque es lo que ve en las de al lado.
// En oscuro se ve bien —es el color de siempre— y **nadie lo prueba en claro**. Sobre blanco ese
// celeste al 8 % no se ve, así que el borde desaparece: no falla, no avisa, simplemente esa tarjeta
// deja de tener contorno para quien usa el tema claro.
//
// Lo mismo con un token: si el bloque del claro se olvida de redefinir uno, ese token conserva el
// valor del oscuro y queda **un color del tema oscuro colado en el claro**. Un solo token olvidado
// puede ser un fondo negro en medio de una pantalla blanca.
//
// Las pruebas de acá abajo son las dos mitades de eso: que no vuelvan los literales, y que los dos
// bloques declaren exactamente el mismo conjunto.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const RAIZ = new URL('../../', import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, RAIZ), 'utf8');

/** Las hojas donde un color literal es un defecto. `temas.css` es donde viven los valores. */
// `monitoreo.css` entra acá el día que se crea, y no después: una hoja fuera de esta lista puede
// escribir un color a mano y **la prueba sigue en verde** — que es exactamente el modo de falla
// que el encabezado describe, con el agravante de que nadie lo busca en una prueba que pasa.
const HOJAS = ['app/aios.css', 'app/fundaciones.css', 'app/ajustes.css', 'app/armazon.css', 'app/closer.css', 'app/monitoreo.css', 'app/auditoria.css'];

/** El cuerpo de una hoja sin comentarios y sin su bloque `:root`, que es donde SÍ van los valores. */
function cuerpo(css: string): string {
  const finRoot = css.includes(':root') ? css.indexOf('}', css.indexOf(':root')) + 1 : 0;
  return css.slice(finRoot).replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Los nombres de token que declara un bloque `:root[data-tema='…']`. */
function tokensDe(css: string, tema: string): Set<string> {
  const abre = css.indexOf(`:root[data-tema='${tema}']`);
  assert.ok(abre >= 0, `no está el bloque del tema «${tema}»`);
  const bloque = css.slice(css.indexOf('{', abre) + 1, css.indexOf('}', abre));
  return new Set([...bloque.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]!));
}

test('ninguna hoja vuelve a escribir un color a mano', () => {
  // Eran 402 y son cero. El paso mecánico que los convirtió está descrito en `app/temas.css`, y se
  // comprobó que el tema oscuro no se movió: la huella de estilos calculados de los 2.725 elementos
  // de la pantalla dio idéntica antes y después.
  const colados: string[] = [];
  for (const hoja of HOJAS) {
    const c = cuerpo(leer(hoja));
    for (const m of c.matchAll(/rgba?\(\s*\d[^)]*\)/g)) colados.push(`${hoja}: ${m[0]}`);
    for (const m of c.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) colados.push(`${hoja}: ${m[0]}`);
  }
  assert.deepEqual(
    colados,
    [],
    'hay colores escritos a mano fuera de los bloques de token. En oscuro se van a ver bien y en ' +
      `claro no van a existir, sin que nada falle:\n  ${colados.join('\n  ')}`,
  );
});

test('los dos temas declaran EXACTAMENTE el mismo conjunto de tokens', () => {
  // La otra mitad. Un token que sólo está en uno de los dos bloques conserva, en el otro, el valor
  // del que lo declaró — o sea un color del tema equivocado, en medio de la pantalla.
  const css = leer('app/temas.css');
  const oscuro = tokensDe(css, 'oscuro');
  const claro = tokensDe(css, 'claro');

  const faltanEnClaro = [...oscuro].filter((t) => !claro.has(t)).sort();
  const faltanEnOscuro = [...claro].filter((t) => !oscuro.has(t)).sort();
  assert.deepEqual(faltanEnClaro, [], `el tema claro no redefine: ${faltanEnClaro.join(', ')}`);
  assert.deepEqual(faltanEnOscuro, [], `el tema oscuro no redefine: ${faltanEnOscuro.join(', ')}`);
  assert.ok(oscuro.size > 25, `sólo ${oscuro.size} tokens por tema: la lista se quedó corta`);
});

test('el token que da vuelta el tema es DISTINTO en los dos', () => {
  // `--c-nube` aparece 101 veces como «una capa tenue sobre el fondo»: bordes, hover, píldoras. En
  // oscuro aclara y en claro tiene que oscurecer. Si alguien los iguala «para simplificar», el tema
  // claro pierde de golpe todos sus bordes y todos sus hover, sin un solo error.
  const css = leer('app/temas.css');
  const valor = (tema: string, token: string) => {
    const abre = css.indexOf(`:root[data-tema='${tema}']`);
    const bloque = css.slice(css.indexOf('{', abre) + 1, css.indexOf('}', abre));
    return new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(bloque)?.[1]?.trim();
  };
  for (const token of ['--c-nube', '--sobre-acento', '--accent', '--txt', '--bg']) {
    const o = valor('oscuro', token);
    const c = valor('claro', token);
    assert.ok(o && c, `falta ${token} en alguno de los dos temas`);
    assert.notEqual(o, c, `${token} vale lo mismo en los dos temas: uno de los dos está sin pensar`);
  }
});

test('el atributo del `<html>` lo escribe UN solo lugar', () => {
  // El guion de arranque y el botón escriben el mismo atributo, y con dos formas de nombrarlo una
  // puede quedar vieja: el guion pondría `data-tema` y el botón `data-theme`, y el tema se aplicaría
  // sólo hasta el primer clic. Los dos salen de `app/tema.ts`.
  const tema = leer('app/tema.ts');
  /* Cuántas veces se escribe DENTRO de `app/tema.ts` no importa —hay una en `aplicar` y dos en el
     guion de arranque, una de ellas en su `catch`— y fijar el número era una aserción sin
     contenido: cambiaba con cualquier reescritura del guion. Lo que importa es que exista ahí y en
     ningún otro lado. */
  assert.ok(/dataset\.tema\s*=/.test(tema), '`app/tema.ts` dejó de escribir el atributo');
  for (const archivo of ['components/BotonDeTema.jsx', 'components/Nav.jsx', 'app/layout.js']) {
    const f = leer(archivo);
    assert.ok(
      !/dataset\.tema\s*=|setAttribute\(\s*['"]data-tema/.test(f),
      `${archivo} escribe el atributo del tema por su cuenta: tiene que llamar a \`aplicar()\``,
    );
  }
});

test('la ruta del tema acepta los MISMOS dos valores que el `check` de la base', () => {
  // Dos listas que se pueden desordenar una respecto de la otra. Si la ruta acepta un valor que la
  // base rechaza, la escritura revienta con un error del motor que nombra una restricción —
  // `ADR-0704` dice que eso no puede salir en el cuerpo—; si la base acepta uno que la ruta no,
  // existe un tema al que no se puede llegar.
  const sql = leer('db/migraciones/019_tema_por_persona.sql');
  const enLaBase = [...(/tema in \(([^)]+)\)/.exec(sql)?.[1] ?? '').matchAll(/'([a-z]+)'/g)]
    .map((m) => m[1]!)
    .sort();
  const ruta = leer('app/api/auth/tema/route.ts');
  const enLaRuta = [...(/const TEMAS[^=]*=\s*\[([^\]]+)\]/.exec(ruta)?.[1] ?? '').matchAll(/'([a-z]+)'/g)]
    .map((m) => m[1]!)
    .sort();
  assert.deepEqual(enLaBase, ['claro', 'oscuro'], 'la migración no define los dos temas esperados');
  assert.deepEqual(enLaRuta, enLaBase, 'la ruta y el `check` de la base aceptan cosas distintas');
});

test('la preferencia se guarda en la BASE, no sólo en el navegador', () => {
  // Es lo que se pidió con todas las letras: que sobreviva a cerrar sesión y volver a entrar.
  // `localStorage` no lo hace —vive en un navegador y en un perfil—, así que es una CACHÉ para que
  // el primer pintado no destelle, y esta prueba es lo que impide que alguien la confunda con la
  // verdad y saque la columna «porque ya está en el navegador».
  const migracion = leer('db/migraciones/019_tema_por_persona.sql');
  assert.match(migracion, /alter table identidad\.usuarios/, 'la columna del tema no está en la base');

  const sesion = leer('lib/autorizacion/sesion.ts');
  assert.match(sesion, /u\.tema as tema/, 'la resolución de sesión dejó de traer el tema');

  const ruta = leer('app/api/auth/tema/route.ts');
  assert.match(ruta, /updateTable\('usuarios'\)/, 'la ruta ya no escribe la preferencia');
  // Sobre UNO MISMO: el identificador sale de la sesión y nunca del cuerpo.
  assert.match(ruta, /\.where\('id', '=', contexto\.usuarioId\)/, 'la ruta escribiría sobre otra persona');
  assert.ok(
    !/cuerpo as \{[^}]*usuarioId/.test(ruta),
    'la ruta acepta un identificador de usuario en el cuerpo: eso deja cambiarle el tema a otro',
  );
});

test('el Pipeline usa la MISMA fila que Mi Día', () => {
  // Antes dibujaba su propia tarjeta —nombre, píldora e íconos apilados— así que el mismo contacto
  // se veía de dos maneras en dos pestañas vecinas. Es lo que `components/negocio/Fila.jsx` dice en
  // su encabezado que existe para impedir: *"si se construyen por pantalla, divergen"*.
  const pipeline = leer('components/closer/Pipeline.jsx');
  assert.match(pipeline, /import Fila from '\.\.\/negocio\/Fila\.jsx'/, 'el Pipeline no usa la fila compartida');
  assert.match(pipeline, /<Fila\s/, 'el Pipeline no dibuja la fila compartida');
  for (const muerta of ['pipe-col', 'pipe-t', 'pipe-nm', 'pipe-h', 'pipe-b', '"pipe"']) {
    assert.ok(!pipeline.includes(muerta), `el Pipeline volvió a las columnas: usa \`${muerta}\``);
  }
  /* ── Y LAS SECCIONES SON LAS DE MI DÍA, AHORA POR UN COMPONENTE ─────────

     Esto comparó `className="md-sec"` en este archivo hasta que el botón de replegar entró: el
     molde —`.md-sec` + `.md-h` + su conteo— se mudó a `components/negocio/SeccionPlegable.jsx`,
     que es lo que hace que los CUATRO tableros lo compartan en vez de copiarlo.

     La afirmación no cambia, cambia dónde mirar: que el Pipeline use ESE componente y no una
     tarjeta propia. La clase se sigue comprobando —en el archivo donde ahora vive— porque el
     CSS de las etapas cuelga de ella.

     Y el conteo SIEMPRE, incluido el cero, que es la regla que el archivo defiende: «Ganado 0» es
     una afirmación y un Ganado ausente es una pregunta que nadie se hace. */
  assert.match(
    pipeline,
    /<SeccionPlegable/,
    'el Pipeline no usa el molde de secciones de Mi Día: volvió a dibujar el suyo',
  );
  assert.match(pipeline, /cuantos=\{col\.cuantos\}/, 'el Pipeline dejó de pasar el conteo de cada etapa');
  /* Y la clase se busca en su FORMA DE CÓDIGO, no como palabra suelta. Es la cuarta vez que este
     repositorio paga la misma leccioncita: una mutación que renombró la clase **sobrevivió**,
     porque `md-sec` sigue apareciendo en los comentarios de ese archivo, que la explican. */
  assert.match(
    leer('components/negocio/SeccionPlegable.jsx'),
    /className=\{`md-sec/,
    'el componente compartido dejó de dibujar `.md-sec`, que es de donde el CSS saca el tinte de ' +
      'cada etapa',
  );
});

test('el barrido manual espera lo que la ruta puede tardar', () => {
  // ES EL DEFECTO QUE LLEGÓ COMO QUEJA: «No se pudo contactar al servidor» al apretar «Traer del
  // calendario». El servidor no fallaba — hace diez llamadas secuenciales a GoHighLevel y declara
  // `maxDuration = 300`, y el cliente abortaba a los quince segundos. Se reportaba un fallo sobre
  // una operación que salía bien: medido contra producción después de una de esas «fallas», 118
  // citas escritas.
  //
  // La regla que esto fija: **quien llama a una ruta que declara `maxDuration` tiene que esperar al
  // menos eso.** Se comprueba comparando los dos números, no la presencia del argumento.
  const ruta = leer('app/api/closer/agenda/refrescar/route.ts');
  const segundos = Number(/maxDuration\s*=\s*(\d+)/.exec(ruta)?.[1]);
  assert.ok(segundos > 0, 'la ruta del barrido dejó de declarar `maxDuration`');

  const agenda = leer('components/closer/Agenda.jsx');
  const ms = Number(/ESPERA_DEL_BARRIDO_MS\s*=\s*([\d_]+)/.exec(agenda)?.[1]?.replace(/_/g, ''));
  assert.ok(ms > 0, 'la Agenda dejó de fijar cuánto espera el barrido');
  assert.ok(
    ms >= segundos * 1000,
    `la Agenda espera ${ms / 1000}s y la ruta puede tardar ${segundos}s: el navegador va a abortar ` +
      'y anunciar un fallo sobre un barrido que está saliendo bien',
  );
  assert.match(agenda, /espera: ESPERA_DEL_BARRIDO_MS/, 'la espera se declara y no se usa');
});

test('el calendario distingue un día SIN CITAS de uno SIN LEER', () => {
  // La regla que sostiene toda la pantalla, y el defecto más caro que puede tener una agenda: quien
  // mira un día del mes que viene, lo ve limpio, y se compromete a otra cosa. El servidor manda
  // `hasta` justamente para que la grilla no tenga que adivinar.
  const agenda = leer('components/closer/Agenda.jsx');
  assert.match(agenda, /leido:\s*dia >= datos\.hoy && dia <= datos\.hasta/, 'la grilla ya no acota lo leído');
  assert.match(agenda, /sin-leer/, 'las casillas sin leer perdieron su aspecto propio');
  // Y no se pueden abrir: abrir un día sin leer mostraría una lista vacía, que se lee como «no hay».
  assert.match(agenda, /disabled=\{!c\.leido \|\| c\.cuantas === 0\}/, 'una casilla sin leer se puede abrir');

  const servidor = leer('lib/negocio/agenda.ts');
  assert.match(servidor, /hasta,/, 'el servidor dejó de mandar hasta dónde llega su respuesta');
});

test('la Agenda pide los días que el barrido de verdad guardó', () => {
  // Pedir más devolvería días vacíos que nadie miró — un cero sin medir disfrazado de cero medido —
  // y pedir menos deja media grilla en gris sin motivo. El número es el del barrido.
  const citas = leer('lib/negocio/citas.ts');
  const guardados = Number(/DIAS_ADELANTE\s*=\s*(\d+)/.exec(citas)?.[1]);
  const agenda = leer('components/closer/Agenda.jsx');
  const pedidos = Number(/DIAS_QUE_SE_PIDEN\s*=\s*(\d+)/.exec(agenda)?.[1]);
  assert.equal(pedidos, guardados, 'la Agenda y el barrido no cubren la misma ventana');
});

test('el encabezado del día muestra la FECHA, no dos veces la etiqueta', () => {
  // Decía «HOY · HOY»: el rótulo grande y el subtítulo salían de las dos funciones que devuelven la
  // etiqueta relativa, así que el dato —qué día es— no aparecía en ningún lado. Se vio en el
  // navegador, no leyendo el código.
  const agenda = leer('components/closer/Agenda.jsx');
  assert.match(agenda, /className="ag-dia-s">\{actual \? fechaDelDia\(actual\.dia\)/, 'el subtítulo no muestra la fecha');
  /* Sin los comentarios: el que explica el arreglo NOMBRA `etiquetaDeDia`, y buscarlo en crudo hacía
     que la prueba se pusiera roja por su propia explicación. Es el mismo tropiezo que ya tuvo la
     prueba del modal inerte en `103-ficha-diseno`. */
  const sinComentarios = agenda
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!sinComentarios.includes('etiquetaDeDia'), 'volvió la etiqueta relativa al encabezado del día');

  // Y `fechaDelDia` NUNCA devuelve una etiqueta relativa: es lo único que la hace distinta.
  const tiempo = leer('lib/negocio/tiempo.ts');
  const cuerpo = tiempo.slice(tiempo.indexOf('export function fechaDelDia'));
  const hasta = cuerpo.indexOf('\nexport function', 1);
  const fn = hasta > 0 ? cuerpo.slice(0, hasta) : cuerpo;
  for (const relativa of ["'HOY'", "'AYER'", "'MAÑANA'"]) {
    assert.ok(!fn.includes(relativa), `\`fechaDelDia\` devuelve ${relativa}: entonces no es una fecha`);
  }
});
