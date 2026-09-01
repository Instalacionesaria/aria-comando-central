// Los tres roles, y lo que cada uno puede. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ SE PIDIÓ, Y CUÁL DE ESAS COSAS NO ERA CIERTA
//
// *"superadmin, admin, closer y setter. closer y setter solo pueden ver sus pestañas y no pueden
// entrar a configuración porque no pueden ni administrar credenciales ni empresas ni usuarios. el
// admin está zonificado a su propia empresa y sí puede ver credenciales, pero no el menú de
// empresas y usuarios. el superadmin debe ser el único que puede ver empresas y usuarios."*
//
// Medido antes de tocar nada, **casi todo ya era cierto**: los cuatro roles existían, closer y
// setter tenían cinco capacidades cada uno sin la del otro y sin `credenciales.ver`, y el
// administrador no tenía `organizaciones.%`.
//
// Lo que NO era cierto: el administrador **sí tenía** `usuarios.crear`, `usuarios.editar`,
// `usuarios.desactivar`, `usuarios.ver` y `roles.asignar`. No veía la pestaña —se filtraba por
// `organizaciones.listar`— así que la regla parecía cumplida. Pero una petición a mano a
// `POST /api/admin/usuarios` funcionaba: **la frontera vivía en la pantalla, no en el servidor.**
//
// Este archivo afirma la frontera donde ahora vive. Y la afirma por CONJUNTO EXACTO y no por
// «no tiene tal cosa», porque la forma en que esto se rompe es por exceso: alguien agrega una
// capacidad al catálogo, el reparto derivado se la da al administrador sin que nadie lo note, y el
// síntoma es que funciona.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo } from '../apoyo/conexiones.ts';
import { CAPACIDADES } from '../../lib/autorizacion/capacidades.ts';
import {
  seccionesVisibles,
  seccionesConAlcance,
  menuVisible,
  type Alcance,
} from '../../lib/autorizacion/secciones.ts';

/* Esta prueba mide qué habilita cada ROL, así que el alcance por persona no interviene. Se pasa con
   nombre en vez de un objeto suelto: deja escrito que la medición es del rol y que el alcance es otra
   pregunta — la que mide `pruebas/base/31-alcance.test.ts`. */
const SIN_ALCANCE: Alcance = { restringido: false };
/* Desde la organización principal. Es el valor que hace que estas pruebas sigan midiendo lo que
   medían: sin él, las secciones `soloDesdeLaPrincipal` desaparecerían de todos los conjuntos de
   abajo y las afirmaciones pasarían por una razón distinta de la que dicen. La regla en sí tiene
   su propia prueba — no se comprueba de refilón acá. */
const DESDE_LA_PRINCIPAL = true;
import { personasQuePuedeAdministrar } from '../../lib/administracion/usuarios.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';

/* La conexión de IDENTIDAD y no la del migrador, y la diferencia la enseñó un fallo.
 *
 * `identidad.roles_permisos` tiene `force row level security`, que **alcanza también al dueño**, y
 * no hay ninguna política que nombre a `migrador`. Así que con esa conexión las consultas de abajo
 * devolvían CERO FILAS SIN ERROR, y las cinco pruebas fallaban diciendo «el administrador quedó sin
 * capacidades» sobre un reparto que estaba perfecto.
 *
 * Es exactamente el modo de falla que este repositorio persigue en todas partes —un cero que
 * significa «no se midió» leído como un hecho— y lo tuve en la prueba que vino a medirlo.
 *
 * `app_identidad` tiene la política `ALL … using (true)` sobre las tres tablas del catálogo. */
let mig: Client;

/* Los FIXTURES van por `admin` y no por `identidad`, y no es indiferente: `app_identidad`
   **no tiene `delete` sobre `identidad.usuarios`** —la migración 012 se lo dio al inquilino, y
   ese reparto es deliberado—. Usar el rol de la aplicación para limpiar dejaría la prueba
   fallando por un permiso que está bien que no tenga. Lo que se MIDE sí va por el camino real. */
let admin: Client;

before(async () => {
  mig = await conectar('identidad');
  admin = await conectar('admin');
});

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

/** Las capacidades de un rol de sistema, leídas de la base. */
async function capacidadesDe(clave: string): Promise<string[]> {
  const r = await mig.query<{ permiso: string }>(
    `select rp.permiso
       from identidad.roles r
       join identidad.roles_permisos rp on rp.rol_id = r.id
      where r.clave = $1 and r.org_id is null
      order by rp.permiso`,
    [clave],
  );
  return r.rows.map((f) => f.permiso);
}

// ─── El reparto ─────────────────────────────────────────────────────────────

test('el administrador NO administra personas, ni empresas, ni roles', async () => {
  const suyas = await capacidadesDe('administrador');
  assert.ok(suyas.length > 0, 'el administrador quedó sin capacidades: el reparto no corrió');

  const noLeToca = suyas.filter(
    (c) => c.startsWith('organizaciones.') || c.startsWith('usuarios.') || c.startsWith('roles.'),
  );
  assert.deepEqual(
    noLeToca,
    [],
    'el administrador conserva capacidades de administración de la plataforma. Si el reparto de ' +
      '`db/arranque/001_catalogo.sql` es correcto, lo que falta es el `delete` sobre ' +
      'roles_permisos: sin él el catálogo solo puede AGREGAR, y las filas viejas sobreviven',
  );
});

test('y SÍ tiene lo que se pidió que tuviera: credenciales y las dos pestañas', async () => {
  // La otra mitad, y la que se rompe por exceso de celo. Toda la pantalla de Ajustes cuelga de
  // `credenciales.ver` —es la única sección de Ajustes con entrada de menú— así que quitársela lo
  // deja sin ningún lugar donde cargar el token de su CRM, que es lo único que se pidió que sí
  // pudiera hacer.
  const suyas = new Set(await capacidadesDe('administrador'));
  for (const c of ['credenciales.ver', 'credenciales.editar', 'closer.ver', 'setter.ver', 'tablero.ver']) {
    assert.ok(suyas.has(c), `el administrador perdió \`${c}\`, que sí le corresponde`);
  }
});

test('la diferencia entre `usuario` y `administrador` es EXACTAMENTE las credenciales', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // ES LA ÚNICA DIFERENCIA, ASÍ QUE ES LA ÚNICA COSA QUE PUEDE ESTAR MAL SIN QUE SE VEA
  //
  // Se pidió con estas palabras: *"la diferencia entre administrador y usuario será que el
  // administrador sí puede modificar las credenciales de su empresa"*.
  //
  // Se comprueba en las DOS direcciones, porque se rompe de las dos y ninguna da error:
  //
  //   · **de más** — el usuario conserva credenciales, y entonces los dos roles son el mismo
  //     rol con dos nombres. La pantalla se dibuja igual para ambos y nada falla.
  //   · **de menos** — al usuario le falta algo que no son credenciales. Ahí la diferencia
  //     dejó de ser la que se pidió, y el síntoma es un 403 en una pantalla suelta que alguien
  //     va a reportar como «no me carga».
  //
  // Y se hace por DIFERENCIA DE CONJUNTOS y no enumerando: enumerar obligaría a editar esta
  // prueba cada vez que se agrega una capacidad, y olvidarse la dejaría pasando en verde sobre
  // un reparto que ya no es el que dice.
  // ═══════════════════════════════════════════════════════════════════════════
  const usuario = new Set(await capacidadesDe('usuario'));
  const admin = new Set(await capacidadesDe('administrador'));
  assert.ok(usuario.size > 0, 'el usuario quedó sin capacidades: el reparto no corrió');

  const soloDelAdmin = [...admin].filter((c) => !usuario.has(c)).sort();
  assert.deepEqual(
    soloDelAdmin,
    ['credenciales.editar', 'credenciales.ver'],
    'la diferencia entre administrador y usuario dejó de ser exactamente las credenciales',
  );

  /* ── Y LA ASIMETRÍA AL REVÉS, QUE ERA VACÍA Y AHORA TIENE UNA COSA ───────
   *
   * Esto afirmaba `[]`: el usuario era un subconjunto del administrador. Dejó de serlo al
   * retirarse el rol `monitoreo`, y **es la decisión, no una regresión**.
   *
   * `monitoreo.ver` cae en `usuario` por derivación y se le niega a `administrador` a mano. Parece
   * al revés y la razón es una sola bandera: `usuario` es el único rol con
   * `secciones_restringidas`, así que ahí la capacidad **no alcanza** —hace falta además la fila de
   * `identidad.usuarios_secciones`— y en `administrador`, que no restringe, la capacidad ES la
   * puerta. Dársela ahí se la daría al administrador de ARIA que se dé de alta mañana, que es
   * exactamente lo que se pidió evitar.
   *
   * El conjunto sigue CERRADO y no se afloja a «al menos éstas». Si mañana aparece una segunda
   * capacidad que el usuario tiene y el administrador no, esto se pone rojo — y eso es lo que se
   * quiere: la excepción se decidió una vez, con su motivo escrito, y la siguiente también tiene
   * que decidirse. Un `filter` que la deje pasar convertiría esta prueba en decorado. */
  const soloDelUsuario = [...usuario].filter((c) => !admin.has(c)).sort();
  assert.deepEqual(
    soloDelUsuario,
    ['monitoreo.ver'],
    'el usuario tiene algo que el administrador no, y no es `monitoreo.ver`',
  );
});

test('el `usuario` tampoco administra personas, ni empresas, ni roles', async () => {
  // Hereda la frontera del administrador: es su subconjunto, así que si el administrador está
  // bien acotado el usuario también. Se afirma igual y no por transitividad — el reparto son
  // dos `select` distintos, y uno puede quedar mal sin el otro.
  const suyas = await capacidadesDe('usuario');
  const noLeToca = suyas.filter(
    (c) =>
      c.startsWith('organizaciones.') ||
      c.startsWith('usuarios.') ||
      c.startsWith('roles.') ||
      c.startsWith('credenciales.'),
  );
  assert.deepEqual(noLeToca, [], 'el usuario conserva capacidades que no le corresponden');
});

test('los roles retirados NO existen, y nadie quedó sin rol por el camino', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // LO QUE DE VERDAD PODÍA SALIR MAL AL PASAR DE CUATRO ROLES A TRES
  //
  // `closer` y `setter` se retiraron. Lo que importa no es que desaparezcan: es que **nadie se
  // quede sin ningún rol** en el camino. Una persona sin rol puede entrar y no ve ninguna
  // pantalla, y eso lo descubre ella, no nosotros.
  //
  // `db/arranque/003_retiro_de_roles.sql` mueve a quien los tuviera a `usuario` ANTES de borrar
  // — el orden importa, porque `usuarios_roles.rol_id` es `no action` y borrar el rol con
  // asignaciones vivas falla.
  // ═══════════════════════════════════════════════════════════════════════════
  const r = await mig.query<{ clave: string }>(
    `select clave from identidad.roles where org_id is null and clave in ('closer','setter')`,
  );
  assert.deepEqual(r.rows, [], 'siguen existiendo roles que el retiro tenía que quitar');

  const huerfanos = await mig.query<{ email: string }>(
    `select u.email from identidad.usuarios u
      where u.email is not null
        and not exists (select 1 from identidad.usuarios_roles ur where ur.usuario_id = u.id)`,
  );
  assert.deepEqual(
    huerfanos.rows,
    [],
    'hay personas sin ningún rol: pueden entrar y no ven ninguna pantalla',
  );
});

test('el catálogo tiene EXACTAMENTE los roles de sistema que reparte', async () => {
  // Conjunto exacto, no «al menos éstos». La forma en que esto se rompe es por exceso: un rol
  // que se retiró a medias, o uno nuevo que alguien agrega sin repartirle nada, queda asignable
  // y no da ninguna pantalla.
  //
  // ── FUERON CUATRO POR UN RATO, Y VOLVIERON A SER TRES ────────────────────
  //
  // Los tres describen QUÉ HACE alguien —administra la plataforma, administra su empresa, opera—
  // y por eso sus capacidades se DERIVAN («todas», «todas menos N familias»).
  //
  // El cuarto era `monitoreo`, y no era un puesto: era UNA pantalla concedida a tres personas,
  // con su capacidad enumerada a mano. Se retiró —*«lo que debe ser es el rol de usuario con
  // acceso a monitoreo»*— porque «tres personas concretas» se dice mejor con tres filas de
  // `identidad.usuarios_secciones` que con un rol, y así se dice **en la pantalla de Usuarios**
  // en vez de en el catálogo. El retiro está en `db/arranque/003_retiro_de_roles.sql`.
  //
  // Si aparece un cuarto otra vez, la pregunta es la misma: ¿es un puesto, o es una pantalla que
  // se concede? Si es lo segundo, ya hay un eje para eso y no hace falta un rol.
  const r = await mig.query<{ clave: string }>(
    'select clave from identidad.roles where org_id is null and es_sistema order by clave',
  );
  assert.deepEqual(r.rows.map((f) => f.clave), ['administrador', 'superadministrador', 'usuario']);
});

test('el Panel de Monitoreo lo da `usuario` + la pestaña, y NUNCA `administrador`', async () => {
  /* ══════════════════════════════════════════════════════════════════════════
     LAS DOS MITADES DEL PERMISO, Y LA ASIMETRÍA QUE PARECE UN ERROR

     Al retirarse el rol `monitoreo`, su capacidad pasó a caer en `usuario` por derivación de
     prefijos. Eso deja a `usuario` con una capacidad que `administrador` NO tiene, que es al
     revés de lo que dice el resto de este archivo — y es la decisión, no un descuido.

     Lo que la hace segura es UNA bandera: `usuario` es el único rol con
     `secciones_restringidas`, así que ahí la capacidad **no alcanza** y hace falta además la
     fila de alcance. `administrador` no restringe, así que ahí la capacidad ES la puerta: se le
     abriría al administrador de ARIA que se dé de alta mañana, sin que nadie lo decida.

     Las tres afirmaciones se hacen juntas porque ninguna se puede leer sin las otras dos:
     quitar la bandera abre el panel a todos, quitar la capacidad deja una pestaña que nadie
     puede conceder, y agregarla al administrador es el defecto que se pidió evitar.
     ══════════════════════════════════════════════════════════════════════════ */
  const delUsuario = new Set(await capacidadesDe('usuario'));
  const delAdmin = new Set(await capacidadesDe('administrador'));

  assert.ok(
    delUsuario.has('monitoreo.ver'),
    'el rol `usuario` no tiene `monitoreo.ver`: nadie puede conceder la pestaña del panel',
  );
  assert.equal(
    delAdmin.has('monitoreo.ver'),
    false,
    'el administrador tiene `monitoreo.ver`, y su rol NO restringe por sección: todo ' +
      'administrador de la principal ve el consumo de todas las empresas sin que nadie lo decida',
  );

  const r = await mig.query<{ secciones_restringidas: boolean }>(
    `select secciones_restringidas from identidad.roles
      where org_id is null and clave = 'usuario'`,
  );
  assert.equal(
    r.rows[0]?.secciones_restringidas,
    true,
    'el rol `usuario` dejó de restringirse por sección, y tiene `monitoreo.ver`: la capacidad ' +
      'pasó a ser la puerta',
  );

  /* Y la mitad que se ve: con la capacidad y SIN la pestaña concedida, cero pantallas. Es el
     mismo camino que recorre la sesión, así que esto mide el sistema y no una lista al lado. */
  const conLaPestana = seccionesConAlcance(
    delUsuario,
    { restringido: true, concedidas: new Set(['monitoreo']) },
    DESDE_LA_PRINCIPAL,
  ).map((s) => s.clave);
  assert.deepEqual(conLaPestana, ['monitoreo']);

  const sinLaPestana = seccionesConAlcance(
    delUsuario,
    { restringido: true, concedidas: new Set(['closer']) },
    DESDE_LA_PRINCIPAL,
  ).map((s) => s.clave);
  assert.equal(
    sinLaPestana.includes('monitoreo'),
    false,
    'la capacidad sola muestra el panel: la fila de alcance dejó de ser necesaria',
  );
});

test('el superadministrador tiene TODAS, sin atajo en el portero', async () => {
  // El `03` § 2 lo pide sin atajo: el portero no tiene ningún `if (esRolDePlataforma) return`, así
  // que las capacidades tienen que estar cargadas en la tabla de verdad. Y se cruza contra el
  // catálogo EN CÓDIGO, no contra la tabla: así, agregar una capacidad a `capacidades.ts` y
  // olvidarse de cargarla también falla acá.
  const suyas = new Set(await capacidadesDe('superadministrador'));
  const faltan = CAPACIDADES.filter((c) => !suyas.has(c));
  assert.deepEqual(faltan, [], 'capacidades del catálogo que el rol de plataforma no tiene');
});

// ─── Lo que cada uno VE ─────────────────────────────────────────────────────

test('lo que cada rol ve en pantalla sale de su reparto, y es lo que se pidió', async () => {
  // Se leen las capacidades de LA BASE y se pasan por la MISMA función que decide el menú. Es lo
  // que hace que esta prueba mida el sistema y no una lista escrita al lado.
  const ve = async (rol: string) => new Set(await capacidadesDe(rol));

  // ── EL USUARIO: todo lo operativo, y NO Ajustes ──────────────────────────
  //
  // Toda la pantalla de Ajustes cuelga de `credenciales.ver` —es la única sección de Ajustes con
  // entrada de menú—, así que no tenerla es exactamente *"no entra a configuración"*.
  const delUsuario = await ve('usuario');
  const suyasUsuario = new Set(seccionesVisibles(delUsuario).map((s) => s.clave));
  assert.ok(suyasUsuario.has('closer'), 'el usuario no ve la pestaña Closer');
  assert.ok(suyasUsuario.has('setter'), 'el usuario no ve la pestaña Setter');
  assert.equal(suyasUsuario.has('credenciales'), false, 'el usuario llega a Ajustes');
  assert.equal(suyasUsuario.has('empresas'), false, 'el usuario ve la pestaña Empresas');
  assert.equal(suyasUsuario.has('usuarios'), false, 'el usuario ve la pestaña Usuarios');

  // El administrador: Ajustes SÍ, y sus dos pestañas de plataforma NO.
  const delAdmin = await ve('administrador');
  const claves = new Set(seccionesVisibles(delAdmin).map((s) => s.clave));
  assert.ok(claves.has('credenciales'), 'el administrador no llega a Ajustes');
  assert.equal(claves.has('empresas'), false, 'el administrador ve la pestaña Empresas');
  assert.equal(claves.has('usuarios'), false, 'el administrador ve la pestaña Usuarios');

  // El superadministrador: las dos.
  const delSuper = await ve('superadministrador');
  const suyas = new Set(seccionesVisibles(delSuper).map((s) => s.clave));
  assert.ok(suyas.has('empresas') && suyas.has('usuarios'), 'al superadministrador le falta una');

  // Y el menú del usuario NO es el del administrador. Sin esta comparación, un reparto que le
  // diera credenciales al usuario pasaría todas las afirmaciones de arriba menos una — y ésta es
  // la que lo dice con el nombre de lo que pasó.
  assert.notDeepEqual(
    [...suyasUsuario].sort(),
    [...claves].sort(),
    'el usuario y el administrador ven exactamente lo mismo: la diferencia se perdió',
  );
  assert.ok(
    menuVisible(delUsuario, SIN_ALCANCE, DESDE_LA_PRINCIPAL).length < menuVisible(delAdmin, SIN_ALCANCE, DESDE_LA_PRINCIPAL).length ||
      menuVisible(delUsuario, SIN_ALCANCE, DESDE_LA_PRINCIPAL).length > 0,
    'el usuario no ve ningún grupo de menú',
  );
});

test('la pestaña Usuarios se decide por `usuarios.ver`, no por `organizaciones.listar`', async () => {
  // ERA UN DEFECTO REAL, y silencioso en las dos direcciones.
  //
  // `AjustesView` preguntaba por la sección `empresas` para decidir si dibujaba Usuarios, o sea por
  // `organizaciones.listar`. La sección `usuarios` existe con su propia capacidad y nadie la
  // consultaba. Consecuencias medibles: un rol con `organizaciones.listar` y sin `usuarios.ver`
  // veía la pestaña y recibía 403 de las dos rutas que la llenan; y uno con `usuarios.ver` y sin la
  // otra no la veía teniéndola.
  //
  // Se afirma sobre las capacidades sueltas y no sobre un rol: es la propiedad de la sección.
  assert.deepEqual(
    seccionesVisibles(new Set(['usuarios.ver'])).map((s) => s.clave),
    ['usuarios'],
    'la sección `usuarios` no se decide por `usuarios.ver`',
  );
  assert.equal(
    seccionesVisibles(new Set(['organizaciones.listar'])).some((s) => s.clave === 'usuarios'),
    false,
    '`organizaciones.listar` sigue habilitando la pestaña Usuarios',
  );
});

// ─── El alcance del listado de personas ─────────────────────────────────────
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTO ARREGLA, Y EL QUE NO PUEDE INTRODUCIR
//
// **El que arregla:** la lista filtraba SIEMPRE por la organización efectiva, también para quien
// administra la plataforma. Se creaba a alguien en otra empresa y **no aparecía**; para verlo había
// que conmutarse a esa empresa. Una lista de personas que cambia según dónde estés parado no se lee
// como un filtro: se lee como que esa persona no se creó.
//
// **El que no puede introducir:** que el administrador de una empresa vea a los de otra. Esa es la
// frontera de la que depende todo el aislamiento del sistema, y ensancharla acá la abriría para
// todos de una sola vez.
//
// Las dos se afirman, y la segunda importa más que la primera.
// ═══════════════════════════════════════════════════════════════════════════════

/** Un usuario suelto, por el camino del rol de identidad. Devuelve su id. */
async function personaEn(org: string, nombre: string): Promise<string> {
  const r = await admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash, creado_por)
     values ($1, $2, $3, 'scrypt$16384$8$1$c2FsCg==$aGFzaAo=', null)
     returning id`,
    [org, nombre, `${nombre.toLowerCase().replace(/\s+/g, '.')}@alcance.ejemplo`],
  );
  return r.rows[0]!.id;
}

async function orgPorSlug(slug: string): Promise<{ id: string; nombre: string }> {
  const r = await admin.query<{ id: string; nombre: string }>(
    'select id, nombre from identidad.organizaciones where slug = $1',
    [slug],
  );
  assert.ok(r.rows[0], `falta la organización ${slug}`);
  return r.rows[0]!;
}

async function limpiarAlcance(): Promise<void> {
  await admin.query("delete from identidad.usuarios where email like '%@alcance.ejemplo'");
}

test('CON alcance de plataforma, la lista trae a todo el mundo y dice de qué empresa es', async () => {
  await limpiarAlcance();
  const alfa = await orgPorSlug('alfa');
  const beta = await orgPorSlug('beta');
  const enAlfa = await personaEn(alfa.id, 'Persona De Alfa');
  const enBeta = await personaEn(beta.id, 'Persona De Beta');

  try {
    const todos = await conIdentidad(async (db) =>
      personasQuePuedeAdministrar(db, alfa.id, true),
    );
    const ids = todos.map((u) => u.id);
    assert.ok(ids.includes(enAlfa), 'falta la persona de la empresa donde está parado');
    assert.ok(
      ids.includes(enBeta),
      'falta la persona de OTRA empresa: es justo el defecto que esto viene a arreglar',
    );

    // Y cada una dice de dónde es. Sin esto, dos personas con el mismo nombre en empresas
    // distintas son dos renglones idénticos, y administrar al que no era no da ningún error.
    const laDeBeta = todos.find((u) => u.id === enBeta);
    assert.equal(laDeBeta?.organizacion.id, beta.id);
    assert.equal(laDeBeta?.organizacion.nombre, beta.nombre);
    assert.equal(laDeBeta?.organizacion.esPrincipal, false);
  } finally {
    await limpiarAlcance();
  }
});

test('SIN alcance de plataforma, la lista se queda en su empresa — y esto es lo que no se puede romper', async () => {
  await limpiarAlcance();
  const alfa = await orgPorSlug('alfa');
  const beta = await orgPorSlug('beta');
  const enAlfa = await personaEn(alfa.id, 'Persona De Alfa');
  const enBeta = await personaEn(beta.id, 'Persona De Beta');

  try {
    const soloAlfa = await conIdentidad(async (db) =>
      personasQuePuedeAdministrar(db, alfa.id, false),
    );
    const ids = soloAlfa.map((u) => u.id);
    assert.ok(ids.includes(enAlfa));
    assert.equal(
      ids.includes(enBeta),
      false,
      'un administrador vio a alguien de otra empresa: el aislamiento se rompió por acá',
    );
    // Y NINGUNA fila de otra empresa, no solo la que sembramos: el `where` puede haberse caído
    // parcialmente y esta prueba tiene que verlo igual.
    assert.deepEqual(
      [...new Set(soloAlfa.map((u) => u.organizacion.id))],
      [alfa.id],
      'la lista trajo filas de más de una empresa sin alcance de plataforma',
    );
  } finally {
    await limpiarAlcance();
  }
});

test('la empresa viaja SIEMPRE, también sin alcance de plataforma', async () => {
  // Mandarla a veces sí y a veces no obligaría a la pantalla a adivinar, y una lista donde la mitad
  // de las filas dicen de dónde son y la otra mitad no es peor que una donde no lo dice ninguna.
  await limpiarAlcance();
  const alfa = await orgPorSlug('alfa');
  await personaEn(alfa.id, 'Persona De Alfa');
  try {
    const filas = await conIdentidad(async (db) =>
      personasQuePuedeAdministrar(db, alfa.id, false),
    );
    assert.ok(filas.length > 0, 'sin filas esta prueba pasaría en vacío');
    for (const u of filas) {
      assert.ok(u.organizacion?.nombre, `${u.nombre} vino sin empresa`);
    }
  } finally {
    await limpiarAlcance();
  }
});

test('quien no tiene rol viene con una lista VACÍA, nunca con un nulo', async () => {
  // Un nulo acá obligaría a cada consumidor a acordarse, y el que se olvide dibuja "undefined"
  // donde debería decir que no tiene ninguno.
  await limpiarAlcance();
  const alfa = await orgPorSlug('alfa');
  const sinRol = await personaEn(alfa.id, 'Persona Sin Rol');
  try {
    const filas = await conIdentidad(async (db) =>
      personasQuePuedeAdministrar(db, alfa.id, false),
    );
    const u = filas.find((x) => x.id === sinRol);
    assert.deepEqual(u?.roles, []);
  } finally {
    await limpiarAlcance();
  }
});

test('con alcance de plataforma, la lista viene AGRUPADA por empresa', async () => {
  /* Se afirma la AGRUPACIÓN y no «la principal primero», y el arnés de mutación es la razón.
     Sacar el `order by es_principal desc` no rompía nada: la empresa principal del sembrado se
     llama «ARIA IA (plataforma)» y las otras «Cliente Alfa» y «Cliente Beta», así que el orden
     alfabético la deja primera igual. La prueba pasaba por casualidad.

     La agrupación sí se puede medir con estos datos, y es la propiedad que de verdad importa:
     una lista de varias empresas entreverada no se puede leer de un vistazo, y ahí es donde se
     administra a la persona equivocada. Que la principal vaya primera es una comodidad; que las
     filas de una empresa estén juntas es lo que hace la lista legible. */
  await limpiarAlcance();
  const alfa = await orgPorSlug('alfa');
  const beta = await orgPorSlug('beta');
  await personaEn(alfa.id, 'Zzz Ultima De Alfa');
  await personaEn(beta.id, 'Aaa Primera De Beta');

  try {
    const todos = await conIdentidad(async (db) => personasQuePuedeAdministrar(db, alfa.id, true));
    assert.ok(
      new Set(todos.map((u) => u.organizacion.id)).size > 1,
      'todas las filas son de la misma empresa: el orden no se estaría midiendo',
    );

    /* Sin el orden por empresa, «Aaa Primera De Beta» se colaría entre las de Alfa: es un nombre
       que gana alfabéticamente contra todos los de la otra empresa. Por eso los nombres del
       fixture son ésos y no cualquiera. */
    const vistas: string[] = [];
    for (const u of todos) {
      if (vistas[vistas.length - 1] !== u.organizacion.id) vistas.push(u.organizacion.id);
    }
    assert.equal(
      vistas.length,
      new Set(vistas).size,
      'una empresa aparece en dos tramos: la lista está entreverada',
    );
  } finally {
    await limpiarAlcance();
  }
});
