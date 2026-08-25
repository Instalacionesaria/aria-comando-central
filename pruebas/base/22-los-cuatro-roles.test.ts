// Los cuatro roles, y lo que cada uno puede. Tipo: Base.
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
import { seccionesVisibles, menuVisible } from '../../lib/autorizacion/secciones.ts';

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

before(async () => {
  mig = await conectar('identidad');
});

after(async () => {
  await cerrarTodo();
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

test('closer y setter tienen su pestaña, no la del otro, y ninguna de administración', async () => {
  const closer = await capacidadesDe('closer');
  const setter = await capacidadesDe('setter');

  // Conjunto EXACTO. Con un `assert.ok(!incluye(...))` por capacidad, una capacidad nueva mal
  // repartida entraría sin que nada falle — y el síntoma sería una pestaña de más.
  assert.deepEqual(closer, [
    'closer.ver',
    'contactos.avanzar',
    'contactos.comentar',
    'contactos.ver',
    'conversaciones.responder',
  ]);
  assert.deepEqual(setter, [
    'contactos.avanzar',
    'contactos.comentar',
    'contactos.ver',
    'conversaciones.responder',
    'setter.ver',
  ]);
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

  const delCloser = await ve('closer');
  assert.deepEqual(
    seccionesVisibles(delCloser).map((s) => s.clave),
    ['closer'],
    'un closer ve algo más que su pestaña',
  );
  const delSetter = await ve('setter');
  assert.deepEqual(seccionesVisibles(delSetter).map((s) => s.clave), ['setter']);

  // Y NINGUNO llega a Ajustes. La pantalla entera cuelga de `credenciales.ver`, así que esto es
  // exactamente *"no pueden entrar a configuración"*.
  for (const [nombre, caps] of [['closer', delCloser], ['setter', delSetter]] as const) {
    assert.equal(
      seccionesVisibles(caps).some((s) => s.clave === 'credenciales'),
      false,
      `un ${nombre} llega a Ajustes`,
    );
    assert.equal(menuVisible(caps).length, 1, `un ${nombre} ve más de un grupo de menú`);
  }

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
