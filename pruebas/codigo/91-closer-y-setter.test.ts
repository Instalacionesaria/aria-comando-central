// La Etapa 11: las dos pestañas, y la deuda de la lista paralela. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ PRUEBA ESTE ARCHIVO, Y POR QUÉ NO ALCANZA CON LA SUITE QUE YA ESTABA
//
// `lib/autorizacion/secciones.ts` decía, desde la Etapa 3 y por escrito, que la clave de cada
// pantalla estaba repetida **en cuatro lugares**: el JSX de `components/Nav.jsx`, el mapa
// `GROUP` de `lib/aios/shell.js`, los `id="v-…"` de `components/views/*View.jsx` y
// `const VISTAS` de `scripts/paridad.mjs`. Y decía qué pasaba si divergían: nada visible.
//
// **Divergieron.** La lista tenía la clave `leads`, que no existe en ninguna de las otras tres
// —dicen `contacts`— así que venía afirmando la pertenencia de una pantalla que la aplicación
// no tiene. Las dos pruebas que la miraban pasaban en verde igual: comprobaban su LARGO y que
// `icp` no estuviera, nunca que sus claves existieran.
//
// La Etapa 11 unificó las listas. Este archivo es lo que impide que se vuelvan a separar, y la
// aserción que más importa es la última: **que `Nav.jsx` no pueda volver a tener una entrada
// escrita a mano.** Sin ella, la forma más natural de "arreglar" un menú que falta algo es
// agregar el `<div>` a mano — y con eso vuelve el defecto entero, con las pruebas en verde.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, archivosFuente } from '../apoyo/fuente.ts';
import {
  GRUPOS_DEL_MENU,
  SECCIONES,
  SIN_OPERACIONES_TODAVIA,
  menuVisible,
} from '../../lib/autorizacion/secciones.ts';
import { CAPACIDADES } from '../../lib/autorizacion/capacidades.ts';

const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

/** Las claves de las pantallas que tienen entrada en el menú. */
const CON_MENU = SECCIONES.filter((s) => s.menu).map((s) => s.clave);

// ─── Las cuatro copias, que ahora tienen que concordar ──────────────────────

test('las diez pantallas del menú tienen su vista en `CommandCenter`', () => {
  // La cuarta copia. Una clave del menú sin entrada en `VISTAS` produce una entrada clicable
  // que no dibuja nada: `shell.js` hace `document.getElementById('v-' + id).classList.add(…)`
  // sobre un nulo, tira una excepción en el manejador del clic, y el usuario ve que el menú
  // "no responde" en esa entrada. No hay error visible en ningún lado más.
  const cc = leer('components/CommandCenter.jsx');
  const mapa = cc.slice(cc.indexOf('const VISTAS = {'), cc.indexOf('};', cc.indexOf('const VISTAS = {')));
  const enElMapa = [...mapa.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]!);

  assert.deepEqual(
    [...enElMapa].sort(),
    [...CON_MENU].sort(),
    'el mapa `VISTAS` de CommandCenter.jsx no coincide con las secciones que tienen menú',
  );
});

test('los `id="v-…"` de las vistas son exactamente las claves con menú', () => {
  // La tercera copia. Se lee del disco y no de una lista, porque el defecto que busca es
  // justamente que alguien agregue un archivo de vista y no lo enganche a ninguna sección — o
  // al revés, que una sección apunte a una vista que no existe.
  const dir = join(RAIZ, 'components/views');
  const ids: string[] = [];
  for (const archivo of readdirSync(dir)) {
    if (!archivo.endsWith('View.jsx')) continue;
    const m = readFileSync(join(dir, archivo), 'utf8').match(/id="v-([a-z]+)"/);
    assert.ok(m, `${archivo} no tiene un \`id="v-…"\``);
    ids.push(m[1]!);
  }
  assert.deepEqual([...ids].sort(), [...CON_MENU].sort());
});

test('el mapa `GROUP` del armazón usa las mismas claves y los mismos grupos', () => {
  // La segunda copia, y la que divergía. `shell.js` la usa para la miga de pan: una clave que
  // no esté ahí deja la miga en blanco (`GROUP[id] || ''`) — **sin error**, que es la razón de
  // que nadie lo hubiera notado.
  const shell = leer('lib/aios/shell.js');
  const bloque = shell.slice(shell.indexOf('const GROUP = {'), shell.indexOf('};', shell.indexOf('const GROUP = {')));
  const pares = [...bloque.matchAll(/(\w+)\s*:\s*'([^']+)'/g)].map((m) => [m[1]!, m[2]!] as const);

  assert.deepEqual(
    pares.map(([k]) => k).sort(),
    [...CON_MENU].sort(),
    'las claves de `GROUP` no coinciden con las secciones que tienen menú',
  );

  // Y el GRUPO de cada una tiene que ser el mismo, no solo la clave. Si `secciones.ts` pone
  // `closer` en "Operación" y `shell.js` lo pone en "Inteligencia", la entrada aparece en un
  // grupo y la miga de pan dice el otro. Nada falla; el usuario deja de confiar en la miga.
  for (const [clave, grupo] of pares) {
    const s = SECCIONES.find((x) => x.clave === clave);
    assert.equal(s?.menu?.grupo, grupo, `\`${clave}\` está en un grupo distinto en shell.js`);
  }
});

test('las vistas de la comparación con el prototipo son claves reales', () => {
  // La primera copia. `leads` habría fallado acá: no es una sección.
  const paridad = leer('scripts/paridad.mjs');
  const bloque = paridad.slice(paridad.indexOf('const VISTAS = ['), paridad.indexOf('];', paridad.indexOf('const VISTAS = [')));
  const vistas = [...bloque.matchAll(/'([a-z]+)'/g)].map((m) => m[1]!);

  assert.ok(vistas.length > 0, 'no se pudo leer `VISTAS` de paridad.mjs');
  for (const v of vistas) {
    assert.ok(
      CON_MENU.includes(v),
      `paridad.mjs compara la vista "${v}", que no es una sección con menú`,
    );
  }
  // Y las dos que salieron en esta etapa NO pueden estar: dejaron de coincidir con el
  // prototipo a propósito, y compararlas daría un rojo permanente.
  assert.ok(!vistas.includes('closer'), '`closer` volvió a la comparación con el prototipo');
  assert.ok(!vistas.includes('setter'), '`setter` volvió a la comparación con el prototipo');
});

test('`Nav.jsx` NO tiene ninguna entrada escrita a mano', () => {
  // ES LA ASERCIÓN QUE SOSTIENE TODO EL RESTO.
  //
  // Las cuatro pruebas de arriba comprueban que las listas concuerdan. Ninguna impide que
  // alguien agregue un `<div className="nav-item" data-view="closer">` literal al JSX — y ése
  // es el arreglo que se ve natural cuando falta una entrada del menú. Con uno solo vuelve el
  // defecto entero: una entrada que se muestra sin mirar ninguna capacidad, con las cinco
  // pruebas anteriores en verde.
  // SIN COMENTARIOS. La regla es sobre entradas DIBUJADAS, y un comentario no dibuja nada:
  // leyendo el archivo crudo, la propia explicación de por qué no puede haber un
  // `data-view` literal hacía fallar la prueba. Un guardia que se dispara con su propia
  // documentación se termina desactivando.
  const nav = archivosFuente(['components']).find((a) => a.ruta === 'components/Nav.jsx')?.limpio;
  assert.ok(nav, 'no se encontró Nav.jsx');

  // El `data-view` tiene que venir de la variable, nunca de un literal.
  const literales = [...nav.matchAll(/data-view=["'][a-z]+["']/g)].map((m) => m[0]);
  assert.deepEqual(
    literales,
    [],
    `Nav.jsx tiene ${literales.length} entrada(s) escrita(s) a mano: ${literales.join(', ')}`,
  );
  // Y tiene que estar mapeando de verdad, no haber quedado vacío.
  assert.match(nav, /data-view=\{/, 'Nav.jsx dejó de poner `data-view` desde una variable');
  assert.match(nav, /\.map\(/, 'Nav.jsx dejó de recorrer las secciones');

  // Los dos nombres que estaban fijos. "ARIA High Ticket" es el caso peor: es el nombre de la
  // organización, justo el dato que el `03` § 3 exige mostrar bien —*"sin eso, alguien puede
  // mirar la pantalla, sacar una conclusión sobre 'los números' y estar viendo los de otro
  // cliente"*— y todos los inquilinos veían el del primero.
  assert.doesNotMatch(nav, /ARIA High Ticket/, 'volvió el nombre de organización escrito a mano');
  assert.doesNotMatch(nav, /Francisco/, 'volvió el nombre de usuario escrito a mano');
});

// ─── La separación entre las dos pestañas ───────────────────────────────────

test('un closer ve SU pestaña y nada más; un setter la suya', () => {
  // LA PRUEBA DE LA ETAPA, sobre el mecanismo real y no sobre la declaración.
  //
  // Los conjuntos de capacidades son los que `db/arranque/001_catalogo.sql` reparte. Se
  // escriben acá a mano y no se leen del SQL a propósito: si se leyeran, un error en el
  // reparto se copiaría a la expectativa y la prueba pasaría igual.
  const delCloser = new Set([
    'closer.ver',
    'contactos.ver',
    'contactos.avanzar',
    'contactos.comentar',
    'conversaciones.responder',
  ]);
  const delSetter = new Set([
    'setter.ver',
    'contactos.ver',
    'contactos.avanzar',
    'contactos.comentar',
    'conversaciones.responder',
  ]);

  const vistasDelCloser = menuVisible(delCloser).flatMap((g) => g.secciones.map((s) => s.clave));
  const vistasDelSetter = menuVisible(delSetter).flatMap((g) => g.secciones.map((s) => s.clave));

  assert.deepEqual(vistasDelCloser, ['closer'], 'un closer ve algo más que su pestaña');
  assert.deepEqual(vistasDelSetter, ['setter'], 'un setter ve algo más que su pestaña');

  // Y en particular NO ven los siete tableros del prototipo. Es lo que `tablero.ver` decide, y
  // sin esa capacidad el menú de un closer tendría ocho entradas en vez de una.
  for (const t of SIN_OPERACIONES_TODAVIA) {
    assert.ok(!vistasDelCloser.includes(t), `el closer ve el tablero "${t}"`);
    assert.ok(!vistasDelSetter.includes(t), `el setter ve el tablero "${t}"`);
  }
});

test('un grupo que queda sin secciones visibles NO se dibuja', () => {
  // Un `<div class="nav-group">` con su etiqueta y nada adentro deja un título flotando sobre
  // el vacío: le dice al usuario que ahí hay algo que no puede ver, cuando lo que corresponde
  // es que no sepa que existe.
  const soloCloser = menuVisible(new Set(['closer.ver']));
  assert.equal(soloCloser.length, 1, 'quedaron grupos vacíos en el menú');
  assert.equal(soloCloser[0]!.grupo.clave, 'Operación');

  // Y sin ninguna capacidad, ningún grupo. Ni uno vacío.
  assert.deepEqual(menuVisible(new Set()), []);
});

test('todas las capacidades del menú están en el catálogo, y el catálogo las carga', () => {
  // El cruce en las DOS direcciones. Una `capacidadRequerida` que no esté en `CAPACIDADES` es
  // un error de tipo, así que esa mitad la cubre el compilador; la que no cubre es la otra: que
  // el archivo que la carga en la base la tenga. Sin eso la capacidad no existe en la tabla, el
  // rol no la recibe y la pantalla responde 403 a todo el mundo.
  const catalogo = leer('db/arranque/001_catalogo.sql');
  const migracion003 = leer('db/migraciones/003_roles_y_permisos.sql');

  for (const s of SECCIONES) {
    const c = s.capacidadRequerida;
    assert.ok(CAPACIDADES.includes(c), `${c} no está en el catálogo de código`);
    assert.ok(
      catalogo.includes(`('${c}'`) || migracion003.includes(`('${c}'`),
      `la capacidad "${c}" de la pantalla "${s.clave}" no la carga NADIE en la base: ` +
        'ni `001_catalogo.sql` ni la migración 003. La pantalla responde 403 a todo el mundo.',
    );
  }
});

test('los grupos del menú declarados son los que las secciones usan', () => {
  // Una sección con un `grupo` que no esté en `GRUPOS_DEL_MENU` desaparece del menú SIN ERROR:
  // `menuVisible` recorre los grupos declarados, así que la sección simplemente no cae en
  // ninguno. Es un modo de falla silencioso de una errata de una letra.
  const declarados = new Set(GRUPOS_DEL_MENU.map((g) => g.clave));
  for (const s of SECCIONES) {
    if (!s.menu) continue;
    assert.ok(
      declarados.has(s.menu.grupo),
      `la sección "${s.clave}" usa el grupo "${s.menu.grupo}", que no está en GRUPOS_DEL_MENU`,
    );
  }
  // Y al revés: un grupo declarado que ninguna sección usa nunca se dibuja, así que es una
  // línea muerta que hace creer que el menú tiene una división que no tiene.
  const usados = new Set(SECCIONES.filter((s) => s.menu).map((s) => s.menu!.grupo));
  for (const g of GRUPOS_DEL_MENU) {
    assert.ok(usados.has(g.clave), `el grupo "${g.clave}" no lo usa ninguna sección`);
  }
});

// ─── Las dos rutas de las pestañas ──────────────────────────────────────────

test('el territorio se escribe en el SERVIDOR: no llega del navegador', () => {
  // Si el territorio viniera de la petición, un setter pediría el del closer y lo recibiría —
  // la capacidad que el portero comprobó sería la misma para los dos. La separación quedaría
  // dependiendo de que el cliente pida lo que le corresponde.
  for (const [ruta, esperado] of [
    ['app/api/closer/contactos/route.ts', 'closer'],
    ['app/api/setter/contactos/route.ts', 'setter'],
  ] as const) {
    const src = leer(ruta);
    assert.match(
      src,
      new RegExp(`const TERRITORIO = '${esperado}' as const`),
      `${ruta} no fija el territorio como constante del servidor`,
    );
    // Y no lo lee de ningún parámetro.
    assert.doesNotMatch(
      src,
      /searchParams\.get\(['"]territorio['"]\)/,
      `${ruta} lee el territorio de la petición`,
    );
    assert.doesNotMatch(src, /await peticion\.json\(\)/, `${ruta} lee un cuerpo que no necesita`);
  }
});

test('las dos rutas piden capacidades DISTINTAS, y son las de su pantalla', () => {
  const closer = leer('app/api/closer/contactos/route.ts');
  const setter = leer('app/api/setter/contactos/route.ts');
  assert.match(closer, /exigir\(peticion, \['closer\.ver'\]\)/);
  assert.match(setter, /exigir\(peticion, \['setter\.ver'\]\)/);
  assert.match(closer, /PANTALLA = 'closer'/);
  assert.match(setter, /PANTALLA = 'setter'/);
  // Y ninguna pide la de la otra, que es la forma en que la separación se rompería sin que
  // nada falle: las dos seguirían devolviendo su territorio, pero cualquiera de los dos roles
  // podría llamar a las dos.
  assert.doesNotMatch(closer, /setter\.ver/);
  assert.doesNotMatch(setter, /closer\.ver/);
});

// ─── Los datos inventados, que estuvieron en producción ─────────────────────
//
// Hasta la Etapa 11 las dos pestañas mostraban datos escritos a mano, y estuvieron
// desplegados: seis citas con nombres de personas, cinco meses de facturación, un diagnóstico
// atribuido a la IA que ninguna IA generó, y un encabezado con el nombre de un closer que no
// existe. Nada de eso fallaba.
//
// Estas pruebas no comprueban que la pantalla "esté bien". Comprueban que ESO no vuelva, que
// es distinto: el arreglo natural cuando una lista se ve vacía es poner una fila de ejemplo
// «para ver cómo queda», y esa fila se queda.

test('los dos módulos que pintaban datos inventados NO existen', async () => {
  // No es una prueba de organización de archivos. `lib/aios/closer.js` y
  // `closer-contact.js` existían SOLO para pintar literales, y mientras existan alguien puede
  // volver a engancharlos al arranque con una línea.
  const { existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  for (const muerto of ['lib/aios/closer.js', 'lib/aios/closer-contact.js']) {
    assert.equal(
      existsSync(join(RAIZ, muerto)),
      false,
      `volvió ${muerto}, que existía solo para dibujar datos escritos a mano`,
    );
  }
  // Y que el arranque no los nombre. Un import de un archivo que no existe rompe la
  // construcción, así que esto atrapa el caso en que alguien los recree.
  const arranque = leer('lib/aios/index.js');
  const sinComentar = arranque
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('/*') && !l.trimStart().startsWith('//'))
    .join('\n');
  assert.doesNotMatch(sinComentar, /initCloser\b/, 'el arranque volvió a cargar `initCloser`');
  assert.doesNotMatch(sinComentar, /initCloserContact\b/, 'el arranque volvió a cargar `initCloserContact`');
});

test('las dos vistas no traen NINGUNO de los nombres inventados que tenían', () => {
  // La lista es la del inventario real, no una invención de esta prueba. Son las personas que
  // la aplicación mostraba como si fueran contactos de la organización.
  //
  // Se busca en TODO el árbol de interfaz, no solo en las dos vistas: si alguien los mueve a
  // un archivo de datos de ejemplo, siguen llegando a la pantalla.
  const INVENTADOS = [
    'Luzma Carbajal',
    'Marcos Gabriel Juarez',
    'Rodrigo Wayar Cruz',
    'Andres Rendon',
    'Richie Brizuela',
    'Irma Perez',
    'Quiroz Prueba',
    'Angelica Moncada',
    'Claudia del Aguila',
    'Francisco Padilla',
    'Guillermo Martinez',
    'Isidro Ramirez',
    'Moises Ruiz Test',
    'David Silva',
    'Jorge Veramendi',
    'Andrea Salas',
  ];

  // ── EL ALCANCE, Y LA DEUDA QUE DEJA A LA VISTA ────────────────────────────
  //
  // Se revisan los archivos de ESTA etapa. Corrida sobre todo el árbol, esta misma prueba
  // encuentra los mismos nombres en `components/Overlays.jsx`, `components/views/SalesView.jsx`,
  // `lib/aios/leads-portal.js` y `lib/aios/leads-group.js` — o sea que **las otras siete
  // pantallas del prototipo siguen mostrando datos inventados**.
  //
  // No se amplía el alcance acá por una razón, no por comodidad: esas siete están en
  // `SIN_OPERACIONES_TODAVIA`, no tienen ninguna operación de servidor, y vaciarlas sin tener
  // de dónde traer datos las deja en siete carteles. Cuáles se conectan y en qué orden es una
  // decisión de producto, y no la toma una prueba.
  //
  // Queda anotado en `docs/ETAPA-11.md` con su nombre. Lo que esta prueba garantiza es que las
  // dos pestañas que SÍ se conectaron no vuelvan atrás.
  const AMBITO = (r: string) =>
    r === 'components/views/CloserView.jsx' ||
    r === 'components/views/SetterView.jsx' ||
    r.startsWith('components/negocio/');

  const sospechosos = [];
  for (const a of archivosFuente(['components'])) {
    if (!AMBITO(a.ruta)) continue;
    for (const nombre of INVENTADOS) {
      if (a.limpio.includes(nombre)) sospechosos.push(`${a.ruta}: ${nombre}`);
    }
  }
  assert.deepEqual(
    sospechosos,
    [],
    `volvieron nombres de personas inventados a la interfaz:\n  ${sospechosos.join('\n  ')}`,
  );
});

test('las dos vistas no traen montos ni porcentajes inventados', () => {
  // Un monto con dígitos es una AFIRMACIÓN sobre el dinero de un cliente. El umbral son tres
  // caracteres de cifra a propósito: `$0` aparece en el texto que explica por qué NO se
  // muestra un `$0`, y ese texto es correcto. `$24.800` no lo es.
  const MONTO = /\$\s?\d[\d.,]{2,}/g;

  // ── POR QUÉ NO SE REVISAN LOS PORCENTAJES ─────────────────────────────────
  //
  // Se escribió y se quitó. Un `50%` puede ser una métrica inventada o el ancho de una parada
  // de degradado en un estilo en línea, y desde el texto no hay forma de distinguirlos:
  // corrida sobre las vistas, marcaba once anchos de CSS legítimos de `ExecutiveView`.
  //
  // Una prueba que señala código correcto se desactiva, y con ella se pierde también la parte
  // que sí servía. Los montos sí se revisan, porque `$` no aparece en una medida de CSS.
  const ENFOQUE = (r: string) =>
    r === 'components/views/CloserView.jsx' ||
    r === 'components/views/SetterView.jsx' ||
    r.startsWith('components/negocio/');

  const hallados = [];
  for (const a of archivosFuente(['components'])) {
    if (!ENFOQUE(a.ruta)) continue;
    for (const m of a.limpio.matchAll(MONTO)) hallados.push(`${a.ruta}: ${m[0]}`);
  }
  assert.deepEqual(
    hallados,
    [],
    `volvieron cifras inventadas a la interfaz:\n  ${hallados.join('\n  ')}`,
  );
});

test('la fila y sus seis íconos son UN archivo para las dos pestañas', () => {
  // El `11` § 7: *"estos componentes se construyen una sola vez. Si se construyen por pantalla,
  // divergen"*. Y el § 9 regla 3 lo dice como regla.
  //
  // El defecto que previene es concreto y silencioso: el tercer ícono cuenta llamadas
  // CONTESTADAS. Dos implementaciones terminan con una contando todas, y las dos muestran un
  // número plausible.
  const closer = leer('components/views/CloserView.jsx');
  const setter = leer('components/views/SetterView.jsx');

  for (const [nombre, src] of [['CloserView', closer], ['SetterView', setter]] as const) {
    assert.match(
      src,
      /from '\.\.\/negocio\/ListaDeContactos\.jsx'/,
      `${nombre} no usa la lista compartida`,
    );
  }

  // Y que cada una pida SU ruta, con el territorio del lado del servidor.
  assert.match(closer, /camino="\/api\/closer\/contactos"/);
  assert.match(setter, /camino="\/api\/setter\/contactos"/);
  // Ninguna pide la de la otra: sería la forma de que un setter vea la zona del closer sin que
  // nada falle.
  assert.doesNotMatch(closer, /\/api\/setter\//);
  assert.doesNotMatch(setter, /\/api\/closer\//);

  // La fila existe una sola vez, y la usa la lista compartida — no cada vista por su lado.
  const lista = leer('components/negocio/ListaDeContactos.jsx');
  assert.match(lista, /from '\.\/Fila\.jsx'/);
  for (const [nombre, src] of [['CloserView', closer], ['SetterView', setter]] as const) {
    assert.doesNotMatch(src, /Fila\.jsx/, `${nombre} dibuja la fila por su cuenta`);
  }
});

test('los seis íconos distinguen "no medido" de "medido en cero"', () => {
  // El `11` § 9 regla 1: *"un cero medido y un cero no medido no son el mismo hecho"*, y el
  // § 7.2: *"los inactivos se atenúan; **nunca** se muestra un 0"*.
  //
  // Se comprueba en el código porque el defecto no se ve mirando: un `0` dibujado donde nadie
  // midió nada se lee como un hecho, y es el que nadie reporta.
  const fila = leer('components/negocio/Fila.jsx');

  // Las tres ramas tienen que existir por nombre.
  assert.match(fila, /sinMedir/, 'la fila dejó de distinguir "no medido"');
  assert.match(fila, /v === null \|\| v === undefined/, 'la distinción de "no medido" cambió de forma');

  // Y el número solo se dibuja si hay MÁS de uno. Un `+1` al lado de un ícono que ya dice
  // "tiene una" es ruido; un `0` es falso.
  assert.match(fila, /activo && v > 1/, 'la fila dibujaría un contador en cero o en uno');

  // Los seis, en el orden del § 7.2, y ninguno de más ni de menos.
  const bloque = fila.slice(fila.indexOf('const ICONOS = ['), fila.indexOf('];', fila.indexOf('const ICONOS = [')));
  const claves = [...bloque.matchAll(/clave: '(\w+)'/g)].map((m) => m[1]!);
  assert.deepEqual(claves, [
    'reunionesTenidas',
    'citaFutura',
    'llamadasContestadas',
    'estadoAgente',
    'seguimientoAbierto',
    'montoVenta',
  ]);
});

test('el vacío legítimo dice POR QUÉ está vacío', () => {
  // El `11` § 4: *"no hay datos cargados → `—`, con una línea que diga qué falta"*. Un panel
  // que simplemente parece vacío no se reporta, y con él se pierde el único síntoma de que la
  // conexión con GoHighLevel no está puesta.
  const lista = leer('components/negocio/ListaDeContactos.jsx');
  assert.match(lista, /filas\.length === 0/, 'la lista dejó de tratar el vacío como un caso');
  assert.match(lista, /Ajustes/, 'el vacío no dice dónde se configura la conexión');

  // Y las TRES ramas de `ADR-0305`, sin colapsar. Si se colapsan, un 403 se ve como una
  // bandeja de trabajo vacía.
  for (const rama of ['sin_respuesta', 'rechazado', 'cargando']) {
    assert.match(lista, new RegExp(`'${rama}'`), `la lista colapsó la rama ${rama}`);
  }
  // El rechazo por permiso NO ofrece reintentar: reintentar no cambia tus capacidades.
  assert.match(lista, /sinPermiso/, 'la lista no distingue el rechazo por permiso');
});

test('la consulta de la lista tiene un desempate ESTABLE en el orden', () => {
  // ── POR QUÉ ESTA PRUEBA ES DE CÓDIGO Y NO DE COMPORTAMIENTO ───────────────
  //
  // Escribí primero la de comportamiento: crear 101 contactos, pedir las dos páginas y
  // comprobar que la segunda no repite filas de la primera. **Y no sirve.** Se comprobó
  // quitando el `orderBy('c.id')` del código: la prueba SIGUIÓ PASANDO.
  //
  // El motivo es que un orden inestable no está obligado a ser distinto. Sin desempate,
  // PostgreSQL puede devolver las filas empatadas en cualquier orden — y "cualquiera" incluye
  // "el mismo dos veces seguidas". La prueba pasa por suerte, y el día que el planificador
  // cambie de estrategia —más filas, otra versión, otro índice— empieza a repetir gente sin
  // que nada falle.
  //
  // Así que el comportamiento se prueba donde se puede (que `hayMas` diga la verdad, que entre
  // las dos páginas esté todo) y el MECANISMO se prueba acá, que es determinista.
  //
  // Lo que hay que impedir: que la lista ordene SOLO por `ultimo_entrante_el`. Esa columna es
  // nula para la mayoría de los contactos recién traídos —GoHighLevel no da fecha de última
  // actividad entrante— así que casi todas las filas empatan, y el empate es justo donde la
  // paginación se rompe.
  const fila = archivosFuente(['lib']).find((a) => a.ruta === 'lib/negocio/fila.ts');
  assert.ok(fila, 'no se encontró la consulta de la lista');

  const ordenes = [...fila.limpio.matchAll(/\.orderBy\(\s*(?:'([^']+)'|sql`[^`]*`)/g)].map(
    (m) => m[1] ?? '(expresión)',
  );

  assert.ok(
    ordenes.length >= 2,
    `la lista ordena por ${ordenes.length} criterio(s): sin un segundo, las filas empatadas ` +
      'salen en cualquier orden y la paginación repite o se saltea gente',
  );
  assert.ok(
    ordenes.includes('c.id'),
    `el último criterio de orden tiene que ser único por fila. Hoy ordena por: ${ordenes.join(', ')}`,
  );
  // Y el desempate va ÚLTIMO: primero por actividad, que es lo que decide qué se ve arriba.
  assert.equal(ordenes[ordenes.length - 1], 'c.id', 'el desempate no está al final del orden');
});
