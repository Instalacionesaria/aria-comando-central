// La regla de delegación está en los DOS caminos, y la pantalla no ofrece lo que va a rechazar.
// Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO CUIDA, Y QUE `143` NO PUEDE CUIDAR
//
// `143-admin-crea-usuarios` mide el COMPORTAMIENTO de los dos caminos que existen hoy. Lo que no
// puede medir es el TERCERO: la ruta que alguien agregue mañana para otorgar un rol.
//
// Y el hueco es concreto, porque otorgar un rol se hace en dos lugares y por dos motivos distintos:
// el alta lo hace en la misma transacción que crea la persona —para que no quede creada sin rol— y
// `POST /api/admin/usuarios/{id}/roles` lo hace sobre alguien que ya existe. Con la barrera en uno
// solo, el otro es el camino libre: crear un usuario y después ascenderlo son dos peticiones y el
// mismo resultado.
//
// ── LA REGLA SE PREGUNTA, NO SE REESCRIBE ─────────────────────────────────
//
// Las dos rutas y el catálogo llaman a `puedeOtorgar` de `lib/autorizacion/delegacion.ts`. Una
// cuarta copia escrita a mano —un `permisos.has('organizaciones.listar')` suelto al lado de una
// lista de capacidades— funcionaría el día que se escribe y se quedaría vieja la primera vez que
// la lista cambie. Es el mismo argumento por el que `problemaDeLaNueva` vive en un solo lugar.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPACIDADES } from '../../lib/autorizacion/capacidades.ts';
import {
  administraPersonas,
  CAPACIDAD_DE_LA_PLATAFORMA,
  CAPACIDADES_QUE_ADMINISTRAN_PERSONAS,
  MOTIVO_SIN_DELEGACION,
  puedeOtorgar,
} from '../../lib/autorizacion/delegacion.ts';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

/**
 * El archivo sin sus comentarios.
 *
 * Obligatorio en este repositorio, y van nueve veces: los comentarios CITAN la regla que hay que
 * aplicar, así que una prueba que lea código fuente y no los saque encuentra su propia
 * explicación. El caso más reciente está contado en `140-boton-de-mi-password`.
 */
const sinComentarios = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** Los dos caminos que otorgan un rol, y el catálogo que los anticipa en la pantalla. */
const QUIENES_OTORGAN = [
  'app/api/admin/usuarios/route.ts',
  'app/api/admin/usuarios/[id]/roles/route.ts',
];

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LA REGLA, MEDIDA COMO FUNCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

test('la regla es asimétrica a propósito: la plataforma otorga todo, el resto solo lo inocuo', () => {
  /* Los dos casos que se pidieron, con conjuntos y no con nombres de rol.
     `DE_LA_PLATAFORMA` tiene la capacidad; `DE_LA_EMPRESA` administra personas y no la tiene, que es
     exactamente el administrador de un cliente. */
  const DE_LA_PLATAFORMA = new Set<string>([CAPACIDAD_DE_LA_PLATAFORMA, 'usuarios.crear']);
  const DE_LA_EMPRESA = new Set<string>(['usuarios.crear', 'usuarios.ver', 'roles.asignar']);
  const INOCUO = new Set<string>(['closer.ver', 'tablero.ver']);

  // La plataforma otorga un rol que administra personas — incluido uno igual al suyo. Es el primer
  // pedido, y la regla que lo rompería está argumentada en `delegacion.ts`: con «subconjunto
  // estricto», el superadministrador no podría crear otro superadministrador.
  assert.equal(puedeOtorgar(DE_LA_EMPRESA, DE_LA_PLATAFORMA), true);
  assert.equal(puedeOtorgar(DE_LA_PLATAFORMA, DE_LA_PLATAFORMA), true);

  // Y quien administra su empresa NO puede otorgar un rol que administre personas — tampoco uno
  // igual al suyo, que es el caso a evitar: clonarse.
  assert.equal(puedeOtorgar(DE_LA_EMPRESA, DE_LA_EMPRESA), false, 'un administrador puede clonarse');
  assert.equal(puedeOtorgar(DE_LA_PLATAFORMA, DE_LA_EMPRESA), false);

  // Pero sí puede otorgar lo que no reparte poder: si no, no podría crear a nadie.
  assert.equal(puedeOtorgar(INOCUO, DE_LA_EMPRESA), true, 'un administrador no puede crear usuarios');

  // Y un rol sin ninguna capacidad lo otorga cualquiera. `ADR-0406`: alguien sin rol es un estado
  // válido, y quitarle el rol a alguien es la forma documentada de dejarlo sin capacidades.
  assert.equal(puedeOtorgar(new Set(), DE_LA_EMPRESA), true);
});

test('cada capacidad de la lista, por separado, alcanza para que el rol NO se delegue', () => {
  /* Una por una y no el conjunto entero: con `some` mal escrito —un `every`, por ejemplo— un rol con
     UNA sola de las seis pasaría la barrera, y el conjunto completo la seguiría cumpliendo. La
     prueba del conjunto no vería la diferencia. */
  const SIN_PLATAFORMA = new Set<string>(['usuarios.crear']);
  for (const c of CAPACIDADES_QUE_ADMINISTRAN_PERSONAS) {
    assert.equal(administraPersonas(new Set([c])), true, `\`${c}\` dejó de contar como administrar personas`);
    assert.equal(
      puedeOtorgar(new Set([c]), SIN_PLATAFORMA),
      false,
      `un rol con solo \`${c}\` se puede delegar sin ser plataforma`,
    );
  }
});

test('la lista es EXACTAMENTE las seis capacidades que reparten poder sobre personas', () => {
  /* ══════════════════════════════════════════════════════════════════════════
   * ESTA PRUEBA EXISTE PORQUE UNA MUTACIÓN SOBREVIVIÓ
   *
   * Quitar `roles.asignar` de la lista no rompía nada, y por dos motivos que se suman:
   *
   *   1 · las pruebas de comportamiento usan el rol `administrador`, que además tiene
   *       `usuarios.crear` — así que `administraPersonas` seguía dando verdadero por otra vía;
   *   2 · la prueba de «cada capacidad por separado» **itera la lista misma**, así que una
   *       capacidad que se va de la lista deja de probarse. Una prueba que deriva sus casos de lo
   *       que mide no puede notar una ausencia.
   *
   * La lista es una DECISIÓN, no un derivado, así que se afirma entera. Cambiarla exige editar esta
   * línea, que es exactamente lo que se quiere: que alguien lo decida.
   * ══════════════════════════════════════════════════════════════════════════ */
  assert.deepEqual(
    [...CAPACIDADES_QUE_ADMINISTRAN_PERSONAS].sort(),
    [
      'roles.administrar',
      'roles.asignar',
      'usuarios.borrar',
      'usuarios.crear',
      'usuarios.desactivar',
      'usuarios.editar',
    ],
    'cambió qué cuenta como «administrar personas». Si se quitó una, un rol que la confiera pasa a ' +
      'ser delegable: un administrador podría otorgarlo y repartir ese poder',
  );
});

test('la lista nombra capacidades que EXISTEN, y no incluye `usuarios.ver`', () => {
  // Una errata acá no falla como errata: `administraPersonas` simplemente no la encuentra nunca y
  // la barrera deja pasar ese rol. Es el mismo modo de falla que el encabezado de `capacidades.ts`
  // le reprocha a los literales sueltos, y por eso se cruza contra el catálogo.
  for (const c of CAPACIDADES_QUE_ADMINISTRAN_PERSONAS) {
    assert.ok(
      (CAPACIDADES as readonly string[]).includes(c),
      `\`${c}\` no está en el catálogo de capacidades: la barrera no la va a encontrar nunca`,
    );
  }
  assert.ok(
    (CAPACIDADES as readonly string[]).includes(CAPACIDAD_DE_LA_PLATAFORMA),
    'la capacidad de la frontera no existe en el catálogo',
  );

  /* Y `usuarios.ver` NO está, a propósito: leer el panel de su propia empresa no reparte poder.
     Incluirla convertiría la regla en «no se delega VER el panel», y entonces un administrador no
     podría crear ni un `usuario` si ese rol algún día pudiera mirar la lista. */
  assert.equal(
    (CAPACIDADES_QUE_ADMINISTRAN_PERSONAS as readonly string[]).includes('usuarios.ver'),
    false,
    '`usuarios.ver` entró en la lista: leer no reparte poder, y con ella la regla frena de más',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · Y ESTÁ EN LOS DOS CAMINOS
// ═══════════════════════════════════════════════════════════════════════════════

test('LOS DOS caminos que otorgan un rol aplican la regla, con la misma función', () => {
  for (const ruta of QUIENES_OTORGAN) {
    const src = sinComentarios(leer(ruta));
    assert.match(
      src,
      /puedeOtorgar\s*\(/,
      `\`${ruta}\` otorga un rol y no aplica la regla de delegación: crear y después ascender son ` +
        'dos peticiones y el mismo resultado, así que la barrera en uno solo es la barrera en ninguno',
    );
    assert.match(
      src,
      /MOTIVO_SIN_DELEGACION/,
      `\`${ruta}\` no usa el texto compartido del rechazo: dos redacciones para la misma regla`,
    );
    // Y sigue la barrera de `ADR-0504`, que es el OTRO eje. Una no reemplaza a la otra: un rol
    // podría administrar personas sin ser de plataforma, y al revés.
    assert.match(
      src,
      /solo_principal/,
      `\`${ruta}\` perdió la barrera del rol de plataforma (ADR-0504)`,
    );
  }
});

test('ninguna ruta reescribe la regla a mano', () => {
  /* La cuarta copia. Funcionaría el día que se escribe y se quedaría vieja en cuanto la lista
     cambie — y el síntoma sería que una ruta deja pasar lo que las otras frenan.
     Se persigue la FORMA del defecto: una comparación contra la capacidad de la frontera al lado de
     una de las capacidades de la lista, en un archivo que otorga roles. */
  for (const ruta of QUIENES_OTORGAN) {
    /* ── SE SACA EL `exigir(…)`, Y ESTA PRUEBA LO DIJO ─────────────────────
     *
     * La primera versión escaneaba el archivo entero y falló al instante: el alta nombra
     * `usuarios.crear` porque es la capacidad que **exige** —`exigir(peticion,
     * ['usuarios.crear'], …)`— y eso no es una copia de la regla, es la puerta de la ruta. Que
     * coincidan las cadenas es casualidad de vocabulario.
     *
     * Lo mismo con `roles.asignar` en la otra. Así que se mide todo MENOS ese llamado, que es lo
     * único que legítimamente nombra una capacidad de esta familia. */
    const src = sinComentarios(leer(ruta)).replace(/exigir\([^)]*\)/g, '');
    for (const c of CAPACIDADES_QUE_ADMINISTRAN_PERSONAS) {
      assert.ok(
        !src.includes(`'${c}'`),
        `\`${ruta}\` nombra \`${c}\` a mano: la lista de qué administra personas vive en ` +
          '`lib/autorizacion/delegacion.ts` y tiene que estar escrita una sola vez',
      );
    }
  }
});

test('el rechazo dice qué falta, no solo que no se puede', () => {
  // Un «no tenés permiso» manda a reintentar. El camino real es pedírselo a la plataforma, y el
  // texto tiene que decirlo o nadie lo va a deducir.
  assert.match(MOTIVO_SIN_DELEGACION, /organizaciones\.listar/, 'el rechazo no nombra qué falta');
  assert.match(MOTIVO_SIN_DELEGACION, /no se delega/i);
  assert.match(
    MOTIVO_SIN_DELEGACION,
    /no otros administradores/i,
    'el rechazo no dice qué SÍ puede hacer, que es la mitad que evita el reintento',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · Y LA PANTALLA NO OFRECE LO QUE VA A SER RECHAZADO
// ═══════════════════════════════════════════════════════════════════════════════

test('el catálogo de roles manda `otorgable`, calculado en el SERVIDOR', () => {
  /* Sin este campo, el formulario ofrece los tres roles al administrador y dos contestan 403 al
     apretar: el `07` § 4. Y calcularlo en el navegador exigiría las capacidades de cada rol más las
     propias, o sea la regla entera duplicada del otro lado de la red. */
  const src = sinComentarios(leer('app/api/admin/roles/route.ts'));
  assert.match(src, /puedeOtorgar\s*\(/, 'el catálogo no calcula qué roles se pueden otorgar');
  assert.match(src, /otorgable/, 'el catálogo no manda `otorgable`');
});

test('el formulario de alta filtra por `otorgable`, y NO reimplementa la regla', () => {
  const panel = sinComentarios(leer('components/ajustes/Usuarios.jsx'));
  assert.match(
    panel,
    /otorgable/,
    'el selector de roles no filtra por `otorgable`: ofrece roles que el servidor va a rechazar',
  );
  // Y no calcula la regla por su cuenta. La pantalla no conoce las capacidades de ningún rol y no
  // tiene que conocerlas.
  assert.ok(
    !panel.includes(`'${CAPACIDAD_DE_LA_PLATAFORMA}'`),
    'la pantalla compara la capacidad de la frontera a mano: es la regla duplicada en el navegador',
  );
});

test('el botón de eliminar cuelga de la capacidad, y la manda el servidor', () => {
  /* El panel dejó de tener un solo público. Hasta ahora lo veía solo el superadministrador, que
     tiene las seis capacidades, así que ningún control por fila necesitaba condición. Un
     administrador administra las personas de su empresa **sin** `usuarios.borrar`. */
  const panel = sinComentarios(leer('components/ajustes/Usuarios.jsx'));
  assert.match(panel, /puedeBorrarPersonas/, 'el panel no pregunta si se puede eliminar');

  /* ── SE MIDE DÓNDE ESTÁ LA CONDICIÓN, NO QUE LA PALABRA EXISTA ─────────────
   *
   * Una mutación sobrevivió a la versión anterior de esto: quitar la guarda del botón deja el
   * `const puedeBorrarPersonas = …` intacto, así que buscar el nombre en el archivo lo encontraba
   * igual y la prueba seguía verde con el botón ofrecido a todo el mundo.
   *
   * Así que se mide el TROZO donde vive el botón: entre la rama del fundador y la confirmación de
   * borrado. Ahí la condición tiene que estar. */
  const desdeElFundador = panel.indexOf('esFundador ?');
  const hastaLaConfirmacion = panel.indexOf('confirmaBorrado ?', desdeElFundador);
  assert.ok(
    desdeElFundador > 0 && hastaLaConfirmacion > desdeElFundador,
    'el bloque de eliminar cambió de forma y esta prueba ya no lo mide',
  );
  assert.match(
    panel.slice(desdeElFundador, hastaLaConfirmacion),
    /puedeBorrarPersonas/,
    'el panel ofrece «Eliminar» sin preguntar si se puede: el administrador leería la advertencia ' +
      'de que no se puede deshacer, apretaría, y recibiría un 403 sin explicación',
  );
  // Lo decide el SERVIDOR, con la capacidad exacta del endpoint. No se deduce del rol en el cliente.
  const sesion = sinComentarios(leer('app/api/auth/sesion/route.ts'));
  assert.match(
    sesion,
    /puedeBorrarPersonas:\s*contexto\.permisos\.has\('usuarios\.borrar'\)/,
    'la bandera de borrado no sale de la capacidad exacta que exige `DELETE /api/admin/usuarios/{id}`',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL REPARTO DECLARATIVO SIGUE DICIENDO LO QUE HACE
// ═══════════════════════════════════════════════════════════════════════════════

test('el reparto le niega al administrador las dos capacidades que sostienen todo', () => {
  /* Se mide el ARCHIVO y no la base: `22-los-tres-roles` ya mide la base local, y este archivo es
     el que corre contra producción. Las dos negaciones son las que hacen que el resto se sostenga:
     `organizaciones.%` es la frontera que usa `delegacion.ts`, y `roles.administrar` sería la puerta
     de al lado —fabricar un rol con las capacidades que quiera y otorgarlo—. */
  const catalogo = leer('db/arranque/001_catalogo.sql');
  const reparto = catalogo.slice(catalogo.indexOf("('administrador', (select array_agg"));
  assert.ok(reparto.length > 0, 'el reparto del administrador cambió de forma y esto ya no lo mide');

  const suyo = reparto.slice(0, reparto.indexOf('))'));
  assert.match(suyo, /not like 'organizaciones\.%'/, 'el administrador dejó de tener negadas las empresas');
  assert.match(suyo, /<> 'roles\.administrar'/, 'el administrador puede fabricar roles propios');
  assert.match(suyo, /<> 'usuarios\.borrar'/, 'el administrador puede eliminar personas');
});
