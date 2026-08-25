// ADR-0501 — Un administrador no opera sobre usuarios de otra organización. INNEGOCIABLE.
// ADR-0502 — Nadie se borra, desactiva ni degrada a sí mismo.
// ADR-0503 — No se puede dejar una organización sin administrador activo.
// ADR-0504 — Un administrador no puede otorgar el rol de plataforma.
// ADR-0505 — Restablecer una contraseña cierra las sesiones.
// ADR-0508 — Una organización nueva no hereda credenciales.
// Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES EL CRITERIO DE CIERRE DE LA ETAPA 5
//
// `EJECUCION` § 5: *"un administrador del cliente A que opere sobre un usuario del cliente B
// recibe **404** en las cinco operaciones. Y una organización nueva nace sin credenciales, no
// opera, y la respuesta lo dice."*
//
// Y la fila ⛔ agrega el por qué del número: *"404, nunca 200 — y **404 y no 403**, porque un 403
// confirma que ese identificador existe."*
//
// La prueba recorre las cinco con el id de un usuario de otra organización y afirma **el código
// exacto**. Un 403 pasaría un `assert.notEqual(200)` y sería el defecto entero.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Client } from 'pg';
import { POST as crearOrg } from '../../app/api/admin/organizaciones/route.ts';
import { POST as crearUsuario } from '../../app/api/admin/usuarios/route.ts';
import { PATCH as editar } from '../../app/api/admin/usuarios/[id]/route.ts';
import { POST as desactivar } from '../../app/api/admin/usuarios/[id]/desactivar/route.ts';
import { POST as restablecer } from '../../app/api/admin/usuarios/[id]/restablecer-password/route.ts';
import { POST as asignarRoles } from '../../app/api/admin/usuarios/[id]/roles/route.ts';
import { POST as login } from '../../app/api/auth/login/route.ts';
import { conIdentidad, cerrarClientes } from '../../lib/datos/capa.ts';
import { conectar, cerrarTodo } from '../apoyo/conexiones.ts';
import { hashear } from '../../lib/datos/hash.ts';
import { COOKIE_SESION, hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { exigir } from '../../lib/autorizacion/portero.ts';

const DOMINIO = 'ejemplo.test';
const PASSWORD = 'una-contrasena-de-prueba-larga';
const MARCA = 'Usuario de administracion';

let admin: Client;

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  // También al ENTRAR: una corrida que falló a mitad de camino no puede envenenar la siguiente.
  await limpiarTodo();
});

after(async () => {
  await limpiarTodo();
  await cerrarTodo();
  await cerrarClientes();
});

/**
 * Deja la base como la dejó el sembrado: los TRES usuarios sembrados y las tres organizaciones.
 *
 * Va por el superusuario porque `app_identidad` no tiene `delete` sobre `usuarios` —se desactivan,
 * no se borran (05 § 6)— y anula `creado_por` antes de borrar, porque esa columna **referencia
 * `usuarios(id)`**: un usuario creado por el endpoint apunta a quien lo creó, y borrar primero al
 * creador viola la clave foránea. La primera corrida de este archivo murió exactamente ahí.
 *
 * Se borra por lo que NO es del sembrado, en vez de por una marca de nombre: así un usuario que el
 * endpoint creó con cualquier nombre también se limpia, y una corrida que falla a mitad de camino
 * no envenena la siguiente.
 */
const SEMBRADOS = [
  'fundadora@principal.ejemplo',
  'ana@alfa.ejemplo',
  'bruno@beta.ejemplo',
];

async function limpiarTodo(): Promise<void> {
  const marcador = SEMBRADOS.map((_, i) => `$${i + 1}`).join(',');
  const donde = `where email is null or lower(email) not in (${marcador})`;
  // El orden importa, y cada paso tiene su motivo.
  await admin.query(`update identidad.usuarios set creado_por = null ${donde}`, SEMBRADOS);
  await admin.query(
    `delete from identidad.usuarios_segundo_factor where usuario_id in
       (select id from identidad.usuarios ${donde})`,
    SEMBRADOS,
  );
  await admin.query(
    `delete from identidad.sesiones where usuario_id in
       (select id from identidad.usuarios ${donde})`,
    SEMBRADOS,
  );
  await admin.query(
    `delete from identidad.usuarios_roles where usuario_id in
       (select id from identidad.usuarios ${donde})`,
    SEMBRADOS,
  );
  await admin.query(`delete from identidad.usuarios ${donde}`, SEMBRADOS);
  // Y las sesiones de los sembrados, que las pruebas abren.
  await admin.query('delete from identidad.sesiones');
  // Los sembrados vuelven a estar ACTIVOS —alguna prueba los desactiva a propósito— y **nada más**.
  //
  // La primera versión también ponía `debe_cambiar_password = false`, y eso rompió
  // `pruebas/base/11-sembrado.test.ts`, que afirma que los tres sembrados nacen debiendo cambiarla.
  // Es el mismo error que ya se cometió en la Etapa 2: una limpieza que muta estado sembrado que
  // OTRA prueba verifica. Una limpieza tiene que devolver la base a donde estaba, no a donde le
  // conviene a este archivo.
  await admin.query('update identidad.usuarios set activo = true where not activo');
  await admin.query(`delete from identidad.organizaciones where slug like 'sonda-%'`);
  // Y el rol privado de prueba. Sin esto sobrevive entre corridas, y una prueba que lo cree con
  // OTRAS capacidades lo reusaria tal cual: pasaria en verde midiendo el rol de la corrida
  // anterior.
  //
  // Las asignaciones se borran PRIMERO, y eso lo enseño un fallo: `usuarios_roles.rol_id` es
  // `no action`, no cascada. Borrar el rol fallaba con `23503` en cuanto una usuaria del sembrado
  // lo tenia puesto —el sembrado no lleva la marca, asi que la limpieza de usuarios no la toca— y
  // el error subia desde el gancho `after`, donde no se lee.
  await admin.query(
    `delete from identidad.usuarios_roles
      where rol_id in (select id from identidad.roles where clave like 'gestor-%')`,
  );
  await admin.query(`delete from identidad.roles where clave like 'gestor-%'`);
}

/** Un usuario con roles, en la organización que se pida. */
async function usuario(opciones: {
  email: string;
  orgSlug: string;
  roles?: string[];
}): Promise<{ id: string; orgId: string }> {
  return conIdentidad(async (db) => {
    const org = await db
      .selectFrom('organizaciones')
      .select('id')
      .where('slug', '=', opciones.orgSlug)
      .executeTakeFirstOrThrow();
    const u = await db
      .insertInto('usuarios')
      .values({
        org_id: org.id,
        nombre: MARCA,
        email: opciones.email,
        password_hash: hashear(PASSWORD),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const clave of opciones.roles ?? []) {
      const rol = await db
        .selectFrom('roles')
        .select('id')
        .where('clave', '=', clave)
        .executeTakeFirstOrThrow();
      await db.insertInto('usuarios_roles').values({ usuario_id: u.id, rol_id: rol.id }).execute();
    }
    return { id: u.id, orgId: org.id };
  });
}

/**
 * EL ROL DE PRUEBA QUE SI ADMINISTRA PERSONAS.
 *
 * Hasta la Etapa 12 estas pruebas usaban el rol `administrador`, que tenia las cinco capacidades.
 * Se le quitaron a pedido: en una empresa cliente, administrar personas es del rol de plataforma,
 * y dejarselas hacia que la frontera viviera solo en la interfaz.
 *
 * Y `superadministrador` no sirve como reemplazo: su bandera `solo_principal` lo ata a la
 * organizacion principal —el disparador `rol_de_plataforma_acotado` rechaza asignarlo fuera— y
 * estas pruebas necesitan un actor DENTRO de una empresa cliente. Es lo unico que demuestra el 404
 * entre organizaciones.
 *
 * Asi que se crea un rol PRIVADO de la organizacion, con las capacidades y con un nombre que **no
 * es** «administrador». Eso no es un parche para que la suite pase: prueba algo mas fuerte que
 * antes. Las cinco operaciones dependen de las CAPACIDADES y no de como se llame el rol, que es
 * exactamente lo que dice `ADR-0302` y lo que ninguna prueba estaba demostrando.
 */
const CAPACIDADES_DEL_GESTOR = [
  'usuarios.ver',
  'usuarios.crear',
  'usuarios.editar',
  'usuarios.desactivar',
  'usuarios.borrar',
  // `roles.asignar` SI, y `organizaciones.listar` NO: es la combinacion que hace falta para
  // `ADR-0504` — puede asignar roles y no puede otorgar el de plataforma.
  'roles.asignar',
] as const;

/** Crea (o reusa) el rol privado que administra personas en esa organizacion. */
async function rolQueAdministraPersonas(orgSlug: string): Promise<string> {
  const clave = `gestor-${orgSlug}`;
  await conIdentidad(async (db) => {
    const org = await db
      .selectFrom('organizaciones')
      .select('id')
      .where('slug', '=', orgSlug)
      .executeTakeFirstOrThrow();
    const ya = await db
      .selectFrom('roles')
      .select('id')
      .where('clave', '=', clave)
      .executeTakeFirst();
    if (ya) return;
    const rol = await db
      .insertInto('roles')
      .values({ clave, org_id: org.id, nombre: `Gestor de ${orgSlug}`, es_sistema: false })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('roles_permisos')
      .values(CAPACIDADES_DEL_GESTOR.map((permiso) => ({ rol_id: rol.id, permiso })))
      .execute();
  });
  return clave;
}

/** Le da un rol a alguien que ya existe. Para los usuarios del sembrado. */
async function darRol(usuarioId: string, clave: string): Promise<void> {
  await conIdentidad(async (db) => {
    const rol = await db
      .selectFrom('roles')
      .select('id')
      .where('clave', '=', clave)
      .executeTakeFirstOrThrow();
    await db
      .insertInto('usuarios_roles')
      .values({ usuario_id: usuarioId, rol_id: rol.id })
      .execute();
  });
}

/** Una sesión activa, y su token. */
async function sesion(usuarioId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await conIdentidad(async (db) => {
    await db
      .insertInto('sesiones')
      .values({
        usuario_id: usuarioId,
        token_hash: hashDeToken(token),
        estado: 'activa',
        expira_el: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      })
      .execute();
  });
  return token;
}

function pedir(camino: string, token: string, cuerpo?: unknown, metodo = 'POST'): Request {
  return new Request(`https://${DOMINIO}${camino}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      origin: `https://${DOMINIO}`,
      cookie: `${COOKIE_SESION}=${token}`,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

async function codigoDe(r: Response): Promise<{ estado: number; codigo?: string }> {
  const cuerpo = (await r.clone().json().catch(() => ({}))) as { codigo?: string };
  return { estado: r.status, codigo: cuerpo.codigo };
}

// ─── ADR-0501 · el criterio de cierre ───────────────────────────────────────

test('ADR-0501 · las CINCO operaciones responden 404 con un usuario de otra organización', async () => {
  await limpiarTodo();
  // El administrador de alfa, con las cinco capacidades.
  const admAlfa = await usuario({
    email: 'adm-alfa@alfa.ejemplo',
    orgSlug: 'alfa',
    roles: [await rolQueAdministraPersonas('alfa')],
  });
  const token = await sesion(admAlfa.id);
  // Y la víctima: un usuario de BETA.
  const ajeno = await usuario({ email: 'ajeno@beta.ejemplo', orgSlug: 'beta' });

  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  const casos: [string, () => Promise<Response>][] = [
    [
      'crear (con el orgId ajeno)',
      () =>
        crearUsuario(
          pedir('/api/admin/usuarios', token, {
            nombre: 'X',
            email: 'nuevo-ajeno@beta.ejemplo',
            orgId: ajeno.orgId,
          }),
        ),
    ],
    [
      'editar',
      () =>
        editar(
          pedir(`/api/admin/usuarios/${ajeno.id}`, token, { nombre: 'Pisado' }, 'PATCH'),
          ctx(ajeno.id) as never,
        ),
    ],
    [
      'desactivar',
      () =>
        desactivar(
          pedir(`/api/admin/usuarios/${ajeno.id}/desactivar`, token, {}),
          ctx(ajeno.id) as never,
        ),
    ],
    [
      'restablecer',
      () =>
        restablecer(
          pedir(`/api/admin/usuarios/${ajeno.id}/restablecer-password`, token, {}),
          ctx(ajeno.id) as never,
        ),
    ],
    [
      'asignar rol',
      () =>
        asignarRoles(
          pedir(`/api/admin/usuarios/${ajeno.id}/roles`, token, { roles: ['administrador'] }),
          ctx(ajeno.id) as never,
        ),
    ],
  ];

  for (const [nombre, correr] of casos) {
    const r = await codigoDe(await correr());
    // EL CÓDIGO EXACTO. Un 403 pasaría un `notEqual(200)` y sería el defecto entero: le
    // confirmaría al administrador de alfa que ese identificador existe.
    assert.deepEqual(
      r,
      { estado: 404, codigo: 'no_encontrado' },
      `${nombre}: respondió ${r.estado} ${r.codigo ?? ''} en vez de 404 no_encontrado`,
    );
  }

  // Y NADA CAMBIÓ en la organización ajena. Sin esto, un 404 devuelto DESPUÉS de escribir pasaría
  // las cinco afirmaciones de arriba — que es exactamente la clase de defecto que este proyecto
  // existe para evitar: la respuesta dice una cosa y la base dice otra.
  const intacto = await conIdentidad(async (db) =>
    db
      .selectFrom('usuarios')
      .select(['nombre', 'activo', 'password_hash'])
      .where('id', '=', ajeno.id)
      .executeTakeFirstOrThrow(),
  );
  assert.equal(intacto.nombre, MARCA, 'la edición ajena SÍ ocurrió, y devolvió 404');
  assert.equal(intacto.activo, true, 'la desactivación ajena SÍ ocurrió, y devolvió 404');
  assert.equal(
    intacto.password_hash,
    (await conIdentidad(async (db) =>
      db
        .selectFrom('usuarios')
        .select('password_hash')
        .where('id', '=', ajeno.id)
        .executeTakeFirstOrThrow(),
    )).password_hash,
    'el hash cambió',
  );
  const rolesAjenos = await conIdentidad(async (db) =>
    db.selectFrom('usuarios_roles').select('rol_id').where('usuario_id', '=', ajeno.id).execute(),
  );
  assert.equal(rolesAjenos.length, 0, 'la asignación de roles ajena SÍ ocurrió, y devolvió 404');
});

test('ADR-0501 · y sobre un usuario PROPIO las cinco funcionan', async () => {
  // LA GUARDA que hace que la prueba de arriba signifique algo: sin ésta, un manejador que
  // devolviera 404 SIEMPRE pasaría las cinco afirmaciones.
  await limpiarTodo();
  const adm = await usuario({
    email: 'adm2@alfa.ejemplo',
    orgSlug: 'alfa',
    roles: [await rolQueAdministraPersonas('alfa')],
  });
  const token = await sesion(adm.id);
  const propio = await usuario({ email: 'propio@alfa.ejemplo', orgSlug: 'alfa' });
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  const creado = await crearUsuario(
    pedir('/api/admin/usuarios', token, { nombre: 'Nuevo', email: 'nuevo@alfa.ejemplo' }),
  );
  assert.equal(creado.status, 201, `crear: ${await creado.clone().text()}`);

  const editado = await editar(
    pedir(`/api/admin/usuarios/${propio.id}`, token, { nombre: 'Editado' }, 'PATCH'),
    ctx(propio.id) as never,
  );
  assert.equal(editado.status, 200, `editar: ${await editado.clone().text()}`);

  const rol = await asignarRoles(
    pedir(`/api/admin/usuarios/${propio.id}/roles`, token, { roles: ['administrador'] }),
    ctx(propio.id) as never,
  );
  assert.equal(rol.status, 200, `roles: ${await rol.clone().text()}`);

  const reset = await restablecer(
    pedir(`/api/admin/usuarios/${propio.id}/restablecer-password`, token, {}),
    ctx(propio.id) as never,
  );
  assert.equal(reset.status, 200, `restablecer: ${await reset.clone().text()}`);

  const baja = await desactivar(
    pedir(`/api/admin/usuarios/${propio.id}/desactivar`, token, {}),
    ctx(propio.id) as never,
  );
  assert.equal(baja.status, 200, `desactivar: ${await baja.clone().text()}`);
});

// ─── ADR-0502 · nadie se opera a sí mismo ───────────────────────────────────

test('ADR-0502 · desactivarse y degradarse a sí mismo se rechazan', async () => {
  await limpiarTodo();
  const adm = await usuario({
    email: 'adm3@alfa.ejemplo',
    orgSlug: 'alfa',
    roles: [await rolQueAdministraPersonas('alfa')],
  });
  const token = await sesion(adm.id);
  const ctx = { params: Promise.resolve({ id: adm.id }) };

  const baja = await desactivar(
    pedir(`/api/admin/usuarios/${adm.id}/desactivar`, token, {}),
    ctx as never,
  );
  assert.deepEqual(await codigoDe(baja), { estado: 409, codigo: 'sobre_si_mismo' });

  const roles = await asignarRoles(
    pedir(`/api/admin/usuarios/${adm.id}/roles`, token, { roles: [] }),
    ctx as never,
  );
  assert.deepEqual(await codigoDe(roles), { estado: 409, codigo: 'sobre_si_mismo' });

  // Y sigue activo con sus roles: el rechazo ocurrió ANTES de escribir.
  const despues = await conIdentidad(async (db) => ({
    fila: await db
      .selectFrom('usuarios')
      .select('activo')
      .where('id', '=', adm.id)
      .executeTakeFirstOrThrow(),
    roles: await db
      .selectFrom('usuarios_roles')
      .select('rol_id')
      .where('usuario_id', '=', adm.id)
      .execute(),
  }));
  assert.equal(despues.fila.activo, true);
  assert.equal(despues.roles.length, 1, 'se quitó su propio rol');
});

// ─── ADR-0503 · el último administrador ─────────────────────────────────────

test('ADR-0503 · desactivar al ÚLTIMO administrador activo se rechaza', async () => {
  await limpiarTodo();
  // El montaje más corto que llega al caso, y llegar ahí cuesta pensarlo: el operador NO puede ser
  // de la organización, porque el último administrador desactivándose a sí mismo lo frena
  // `sobre_si_mismo` antes y la prueba pasaría por el motivo equivocado.
  //
  // Así que opera el ROL DE PLATAFORMA con su organización activa puesta en alfa. Tiene todas las
  // capacidades, no pertenece a alfa, y por lo tanto no cuenta como administrador de alfa.
  const fundadora = await conIdentidad(async (db) =>
    db
      .selectFrom('usuarios')
      .select('id')
      .where('email', '=', 'fundadora@principal.ejemplo')
      .executeTakeFirstOrThrow(),
  );
  const alfa = await conIdentidad(async (db) =>
    db.selectFrom('organizaciones').select('id').where('slug', '=', 'alfa').executeTakeFirstOrThrow(),
  );
  const token = await sesion(fundadora.id);
  await conIdentidad(async (db) => {
    await db
      .updateTable('sesiones')
      .set({ org_activa: alfa.id })
      .where('token_hash', '=', hashDeToken(token))
      .execute();
  });

  // Alfa tiene ahora DOS administradores: `ana`, del sembrado, y `extra`.
  const extra = await usuario({
    email: 'extra@alfa.ejemplo',
    orgSlug: 'alfa',
    roles: [await rolQueAdministraPersonas('alfa')],
  });
  const ana = await conIdentidad(async (db) =>
    db
      .selectFrom('usuarios')
      .select('id')
      .where('email', '=', 'ana@alfa.ejemplo')
      .executeTakeFirstOrThrow(),
  );
  // `ana` viene del sembrado con el rol `administrador`, que desde la Etapa 12 **no tiene**
  // `usuarios.crear`. Y esta regla define «administrador» por esa capacidad, no por el nombre del
  // rol, asi que sin esto `ana` no contaria y desactivar a `extra` ya seria desactivar al ultimo:
  // la primera mitad de la prueba daria 409 y la segunda pasaria por el motivo equivocado.
  await darRol(ana.id, await rolQueAdministraPersonas('alfa'));
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  // Con dos, desactivar a `extra` TIENE que dejar. Sin esta mitad, un manejador que rechazara
  // siempre pasaría la afirmación de abajo.
  const conDos = await desactivar(
    pedir(`/api/admin/usuarios/${extra.id}/desactivar`, token, {}),
    ctx(extra.id) as never,
  );
  assert.equal(conDos.status, 200, `con dos administradores: ${await conDos.clone().text()}`);

  // Ahora `ana` es la ÚNICA administradora activa de alfa. Y ahí se rechaza.
  const ultima = await desactivar(
    pedir(`/api/admin/usuarios/${ana.id}/desactivar`, token, {}),
    ctx(ana.id) as never,
  );
  assert.deepEqual(
    await codigoDe(ultima),
    { estado: 409, codigo: 'ultimo_administrador' },
    'se pudo dejar la organización sin ningún administrador activo',
  );

  // Y sigue activa: el rechazo ocurrió ANTES de escribir. Sin esta afirmación, un manejador que
  // desactivara y después respondiera 409 pasaría la de arriba.
  const sigue = await conIdentidad(async (db) =>
    db.selectFrom('usuarios').select('activo').where('id', '=', ana.id).executeTakeFirstOrThrow(),
  );
  assert.equal(sigue.activo, true, 'la desactivación ocurrió y devolvió 409');
});

test('ADR-0503 · un usuario SIN la capacidad no cuenta como administrador', async () => {
  // La guarda del criterio: "administrador" para esta regla es **quien tiene `usuarios.crear`**, no
  // quien tiene un rol llamado `administrador`. Comparar la clave del rol es exactamente lo que
  // `ADR-0302` prohíbe.
  //
  // Así que desactivar a alguien SIN esa capacidad nunca es "el último administrador", ni cuando es
  // el único usuario que queda.
  await limpiarTodo();
  const ana = await conIdentidad(async (db) =>
    db
      .selectFrom('usuarios')
      .select('id')
      .where('email', '=', 'ana@alfa.ejemplo')
      .executeTakeFirstOrThrow(),
  );
  // El rol del sembrado ya no administra personas, asi que `ana` necesita el que si.
  await darRol(ana.id, await rolQueAdministraPersonas('alfa'));
  const token = await sesion(ana.id);
  const comun = await usuario({ email: 'comun@alfa.ejemplo', orgSlug: 'alfa' });

  const r = await desactivar(
    pedir(`/api/admin/usuarios/${comun.id}/desactivar`, token, {}),
    { params: Promise.resolve({ id: comun.id }) } as never,
  );
  assert.equal(r.status, 200, `un usuario sin capacidades no es administrador: ${await r.clone().text()}`);
});

// ─── ADR-0504 · el rol de plataforma ────────────────────────────────────────

test('ADR-0504 · un administrador no puede otorgar el rol de plataforma — endpoint', async () => {
  await limpiarTodo();
  // Un administrador DE LA ORGANIZACIÓN PRINCIPAL: la base lo dejaría (el rol es de ahí), así que
  // el único que puede frenarlo es el endpoint. Es el caso que el `03` § 3 nombra: *"un
  // administrador no lo puede otorgar. NI SIQUIERA dentro de la organización principal."*
  const adm = await usuario({
    email: 'adm-principal@principal.ejemplo',
    orgSlug: 'principal',
    roles: [await rolQueAdministraPersonas('principal')],
  });
  const token = await sesion(adm.id);
  const objetivo = await usuario({ email: 'obj@principal.ejemplo', orgSlug: 'principal' });
  const ctx = { params: Promise.resolve({ id: objetivo.id }) };

  const r = await asignarRoles(
    pedir(`/api/admin/usuarios/${objetivo.id}/roles`, token, { roles: ['superadministrador'] }),
    ctx as never,
  );
  assert.equal(r.status, 403, `respondió ${r.status}: ${await r.clone().text()}`);
  assert.equal((await codigoDe(r)).codigo, 'sin_permiso');

  const asignados = await conIdentidad(async (db) =>
    db.selectFrom('usuarios_roles').select('rol_id').where('usuario_id', '=', objetivo.id).execute(),
  );
  assert.equal(asignados.length, 0, 'el rol de plataforma se otorgó');
});

test('ADR-0504 · y en la BASE: el disparador lo rechaza aunque el endpoint no exista', async () => {
  // La otra mitad de la fila. *"Cuando dudes, ponela en la base: un condicional del backend se
  // saltea con un script de mantenimiento, una consola, un endpoint nuevo o una sentencia a mano
  // un domingo."* (05 § 4)
  await limpiarTodo();
  const enCliente = await usuario({ email: 'cliente@alfa.ejemplo', orgSlug: 'alfa' });

  await admin.query('begin');
  let error: string | null = null;
  try {
    await admin.query(
      `insert into identidad.usuarios_roles (usuario_id, rol_id)
       select $1, id from identidad.roles where clave = 'superadministrador'`,
      [enCliente.id],
    );
  } catch (e) {
    error = String((e as Error).message);
  } finally {
    await admin.query('rollback');
  }
  assert.ok(error !== null, 'la base dejó asignar el rol de plataforma a un usuario de un cliente');
  assert.match(error, /solo existe en la organización principal/);
});

// ─── ADR-0505 · el restablecimiento cierra las sesiones ─────────────────────

test('ADR-0505 · restablecer cierra TODAS las sesiones del usuario', async () => {
  await limpiarTodo();
  const adm = await usuario({
    email: 'adm4@alfa.ejemplo',
    orgSlug: 'alfa',
    roles: [await rolQueAdministraPersonas('alfa')],
  });
  const token = await sesion(adm.id);
  const victima = await usuario({ email: 'victima@alfa.ejemplo', orgSlug: 'alfa' });
  // Dos sesiones abiertas: *"si el motivo del restablecimiento es que le robaron la cuenta, dejar
  // las sesiones vivas no arregla nada."* (05 § 5)
  const t1 = await sesion(victima.id);
  const t2 = await sesion(victima.id);

  const antes = await exigir(
    new Request(`https://${DOMINIO}/api/control`, {
      headers: { cookie: `${COOKIE_SESION}=${t1}` },
    }),
    'ninguna',
  );
  assert.ok(!(antes instanceof Response), 'la sesión tendría que valer antes del restablecimiento');

  const r = await restablecer(
    pedir(`/api/admin/usuarios/${victima.id}/restablecer-password`, token, {}),
    { params: Promise.resolve({ id: victima.id }) } as never,
  );
  assert.equal(r.status, 200);
  const cuerpo = (await r.json()) as { temporal: string; sesionesCerradas: number };
  assert.equal(cuerpo.sesionesCerradas, 2, 'no cerró las dos sesiones');

  // Y las dos dejaron de valer, por el camino real del portero.
  for (const t of [t1, t2]) {
    const despues = await exigir(
      new Request(`https://${DOMINIO}/api/control`, {
        headers: { cookie: `${COOKIE_SESION}=${t}` },
      }),
      'ninguna',
    );
    assert.ok(despues instanceof Response, 'una sesión sobrevivió al restablecimiento');
    assert.equal(despues.status, 401);
  }

  // Y la temporal nueva SÍ entra, con `debe_cambiar_password`.
  const entrada = await login(
    new Request(`https://${DOMINIO}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: `https://${DOMINIO}` },
      body: JSON.stringify({ email: 'victima@alfa.ejemplo', password: cuerpo.temporal }),
    }),
  );
  assert.equal(entrada.status, 200, 'la temporal nueva no sirve');
  assert.equal(((await entrada.json()) as { estado: string }).estado, 'debe_cambiar_password');
});

test('ADR-0505 · y desactivar invalida la sesión SIN borrar ninguna fila', async () => {
  // La propiedad que reemplaza al borrado de sesiones en la desactivación, y que resuelve un
  // conflicto: el `05` § 6 pide que *"sus sesiones abiertas se cierren al desactivarlo"*, pero el
  // `09` § 7.16 manda que desactivar corra por el dominio del inquilino, que **no puede tocar
  // `identidad.sesiones`** — y hacerlo desde identidad sería una escritura que cruza los dos
  // dominios, prohibida por `EJECUCION` § 2.
  //
  // La propiedad se cumple por otro camino, y más fuerte: `resolverSesion()` filtra con
  // `u.activo = true`, así que la sesión deja de valer **sin depender de una escritura que puede
  // fallar**. La fila sobrevive y vence sola.
  await limpiarTodo();
  const adm = await usuario({
    email: 'adm5@alfa.ejemplo',
    orgSlug: 'alfa',
    roles: [await rolQueAdministraPersonas('alfa')],
  });
  const token = await sesion(adm.id);
  const objetivo = await usuario({ email: 'baja@alfa.ejemplo', orgSlug: 'alfa' });
  const suToken = await sesion(objetivo.id);

  const r = await desactivar(
    pedir(`/api/admin/usuarios/${objetivo.id}/desactivar`, token, {}),
    { params: Promise.resolve({ id: objetivo.id }) } as never,
  );
  assert.equal(r.status, 200, await r.clone().text());

  const despues = await exigir(
    new Request(`https://${DOMINIO}/api/control`, {
      headers: { cookie: `${COOKIE_SESION}=${suToken}` },
    }),
    'ninguna',
  );
  assert.ok(despues instanceof Response, 'el usuario desactivado sigue teniendo sesión válida');
  assert.equal(despues.status, 401);

  // Y la fila SIGUE ahí: la invalidación no viene de borrarla.
  const filas = await conIdentidad(async (db) =>
    db.selectFrom('sesiones').select('id').where('usuario_id', '=', objetivo.id).execute(),
  );
  assert.equal(filas.length, 1, 'la fila se borró: entonces la defensa no es la que se cree');
});

// ─── ADR-0508 · una organización nueva no hereda nada ───────────────────────

test('ADR-0508 · una organización nueva nace SIN credenciales, no opera, y lo dice', async () => {
  await limpiarTodo();
  const fundadora = await conIdentidad(async (db) =>
    db
      .selectFrom('usuarios')
      .select('id')
      .where('email', '=', 'fundadora@principal.ejemplo')
      .executeTakeFirstOrThrow(),
  );
  const token = await sesion(fundadora.id);
  const slug = `sonda-${randomBytes(4).toString('hex')}`;

  const r = await crearOrg(
    pedir('/api/admin/organizaciones', token, { nombre: 'Sonda', slug }),
  );
  assert.equal(r.status, 201, await r.clone().text());
  const cuerpo = (await r.json()) as {
    id: string;
    opera: boolean;
    credenciales: string[];
    motivo: string;
    detalle: string;
  };

  // LA RESPUESTA LO DICE. Es la mitad del criterio de cierre, y la que se olvida.
  assert.equal(cuerpo.opera, false, 'la respuesta no dice que no opera');
  assert.deepEqual(cuerpo.credenciales, []);
  assert.equal(cuerpo.motivo, 'sin_credenciales');
  assert.match(cuerpo.detalle, /no hereda/i, 'el detalle no dice que no hereda');

  // Y en la BASE no hay ni una fila de credenciales. El `05` § 2 lo cuenta como lección pagada:
  // una organización nueva heredaba el token de la principal *"por un valor por defecto que
  // parecía inofensivo"*, y escribía en la cuenta externa de otra empresa. *"Nada falló — el token
  // era válido, la API respondía 200."*
  const credenciales = await conIdentidad(async (db) =>
    db
      .selectFrom('organizaciones_credenciales')
      .select('org_id')
      .where('org_id', '=', cuerpo.id)
      .execute(),
  );
  assert.equal(credenciales.length, 0, 'la organización nueva nació con credenciales');

  // Ni usuarios, ni datos de ejemplo: *"¿qué crear junto con la organización? NADA MÁS."*
  const usuarios = await conIdentidad(async (db) =>
    db.selectFrom('usuarios').select('id').where('org_id', '=', cuerpo.id).execute(),
  );
  assert.equal(usuarios.length, 0, 'la organización nueva nació con usuarios');
});
