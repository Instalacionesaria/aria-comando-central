// Editar, reactivar y eliminar — y lo que NO se puede tocar. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE PIDIÓ, Y LO QUE LA BASE PERMITE
//
// *"se pueden hacer todas las operaciones a los usuarios excepto al primer y principal superadmin
// (corporativo@ariaia.com), igual que a la primera y principal empresa (ARIA); a los demás se puede
// editar, eliminar, crear y ver."*
//
// Medido antes de escribir una línea: **casi todas las claves foráneas del negocio hacia
// `identidad.usuarios` y hacia `identidad.organizaciones` son `no action`**. O sea que un borrado
// real falla en cuanto la persona escribió una nota, registró un resultado o dio de alta a alguien;
// y una empresa con un solo contacto no se puede borrar.
//
// Eso no es un obstáculo a sortear: es la trazabilidad, y por eso «eliminar» quedó definido como
// **desactivar** —reversible, funciona siempre— más un borrado real que la base solo permite cuando
// no queda rastro. Lo que este archivo verifica es que el rechazo **diga qué lo impide**, porque un
// `23503` con el nombre de una restricción no le sirve a nadie y `ADR-0704` lo prohíbe.
//
// ── Y LAS PROTECCIONES NO SE IMPLEMENTARON: YA ESTABAN ──────────────────────
//
// Los cinco disparadores de `007_invariantes.sql` ya rechazaban borrar, degradar, desactivar y
// cambiarle el correo al administrador principal, y borrar, desmarcar y desactivar la organización
// principal. No hay ni un `if (es_principal)` en la aplicación, a propósito: *"un condicional se
// saltea con una sentencia a mano un domingo. Un disparador no."*
//
// Lo que faltaba era **comprobarlo desde afuera**: que la operación de la aplicación reciba el
// rechazo y lo devuelva legible. Sin esta prueba, la protección existe y nadie sabe si el camino
// que la gente usa de verdad llega hasta ella.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Client } from 'pg';
import { POST as crearUsuario } from '../../app/api/admin/usuarios/route.ts';
import { PATCH as editarUsuario, DELETE as borrarUsuario } from '../../app/api/admin/usuarios/[id]/route.ts';
import { POST as desactivar } from '../../app/api/admin/usuarios/[id]/desactivar/route.ts';
import { POST as activar } from '../../app/api/admin/usuarios/[id]/activar/route.ts';
import { POST as asignarRoles } from '../../app/api/admin/usuarios/[id]/roles/route.ts';
import { PATCH as editarOrg, DELETE as borrarOrg } from '../../app/api/admin/organizaciones/[id]/route.ts';
import { conIdentidad, cerrarClientes } from '../../lib/datos/capa.ts';
import { conectar, cerrarTodo } from '../apoyo/conexiones.ts';
import { hashear } from '../../lib/datos/hash.ts';
import { COOKIE_SESION, hashDeToken } from '../../lib/autorizacion/sesion.ts';

const DOMINIO = 'ejemplo.test';
const PASSWORD = 'una-contrasena-de-prueba-larga';
const MARCA = 'Usuario de la etapa 12';

let admin: Client;

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

/** Deja la base como la dejó el sembrado. También al ENTRAR: una corrida a medias no envenena. */
async function limpiar(): Promise<void> {
  await admin.query(
    `delete from identidad.sesiones where usuario_id in
      (select id from identidad.usuarios where nombre = $1)`,
    [MARCA],
  );
  await admin.query(
    `delete from identidad.usuarios_roles where usuario_id in
      (select id from identidad.usuarios where nombre = $1)`,
    [MARCA],
  );
  // El orden importa: `creado_por` apunta a usuarios con `no action`, así que borrar en dos pasos
  // —primero quien fue creado, después quien creó— evitaría el 23503. Se hace en bucle porque la
  // cadena puede tener más de dos eslabones.
  for (let i = 0; i < 4; i += 1) {
    await admin.query(
      `delete from identidad.usuarios where nombre = $1 and id not in
        (select creado_por from identidad.usuarios where creado_por is not null)`,
      [MARCA],
    );
  }
  await admin.query(
    `delete from identidad.usuarios_roles where rol_id in
      (select id from identidad.roles where clave like 'e12-%')`,
  );
  await admin.query(`delete from identidad.roles where clave like 'e12-%'`);
  await admin.query(`delete from identidad.organizaciones where slug like 'e12-%'`);
  // Las sesiones de los usuarios del sembrado, que estas pruebas conmutan de organización.
  await admin.query(
    `delete from identidad.sesiones where usuario_id in
      (select id from identidad.usuarios where email like '%@principal.ejemplo')`,
  );
  await admin.query('update identidad.usuarios set activo = true where not activo');
}

async function idDe(email: string): Promise<string> {
  const r = await admin.query<{ id: string }>('select id from identidad.usuarios where email = $1', [
    email,
  ]);
  assert.ok(r.rows[0], `no existe ${email}`);
  return r.rows[0].id;
}

async function orgDe(slug: string): Promise<string> {
  const r = await admin.query<{ id: string }>(
    'select id from identidad.organizaciones where slug = $1',
    [slug],
  );
  assert.ok(r.rows[0], `no existe la organización ${slug}`);
  return r.rows[0].id;
}

/** Una sesión activa, opcionalmente mirando otra organización. */
async function sesion(usuarioId: string, orgActiva?: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await conIdentidad(async (db) => {
    await db
      .insertInto('sesiones')
      .values({
        usuario_id: usuarioId,
        token_hash: hashDeToken(token),
        estado: 'activa',
        expira_el: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        ...(orgActiva ? { org_activa: orgActiva } : {}),
      })
      .execute();
  });
  return token;
}

/** Un rol privado con las capacidades que se pidan, en la organización que se pida. */
async function rolCon(orgSlug: string, capacidades: string[]): Promise<string> {
  const clave = `e12-${orgSlug}`;
  await conIdentidad(async (db) => {
    const org = await db
      .selectFrom('organizaciones')
      .select('id')
      .where('slug', '=', orgSlug)
      .executeTakeFirstOrThrow();
    const ya = await db.selectFrom('roles').select('id').where('clave', '=', clave).executeTakeFirst();
    if (ya) return;
    const rol = await db
      .insertInto('roles')
      .values({ clave, org_id: org.id, nombre: `Rol de prueba ${orgSlug}`, es_sistema: false })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('roles_permisos')
      .values(capacidades.map((permiso) => ({ rol_id: rol.id, permiso })))
      .execute();
  });
  return clave;
}

/** Un usuario, con roles opcionales. */
async function usuario(email: string, orgSlug: string, roles: string[] = []): Promise<string> {
  return conIdentidad(async (db) => {
    const org = await db
      .selectFrom('organizaciones')
      .select('id')
      .where('slug', '=', orgSlug)
      .executeTakeFirstOrThrow();
    const u = await db
      .insertInto('usuarios')
      .values({ org_id: org.id, nombre: MARCA, email, password_hash: hashear(PASSWORD) })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const clave of roles) {
      const rol = await db
        .selectFrom('roles')
        .select('id')
        .where('clave', '=', clave)
        .executeTakeFirstOrThrow();
      await db.insertInto('usuarios_roles').values({ usuario_id: u.id, rol_id: rol.id }).execute();
    }
    return u.id;
  });
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

const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

async function codigoDe(r: Response): Promise<{ estado: number; codigo?: string; detalle?: string }> {
  const cuerpo = (await r.clone().json().catch(() => ({}))) as { codigo?: string; detalle?: string };
  return { estado: r.status, codigo: cuerpo.codigo, detalle: cuerpo.detalle };
}

// ─── El alta: la empresa se elige, y solo el rol de plataforma puede ─────────

test('el rol de plataforma crea en OTRA empresa sin conmutarse, y en una sola llamada', async () => {
  await limpiar();
  const fundadora = await idDe('fundadora@principal.ejemplo');
  const token = await sesion(fundadora.valueOf() as string);
  const alfa = await orgDe('alfa');

  const r = await crearUsuario(
    pedir('/api/admin/usuarios', token, {
      nombre: MARCA,
      email: 'nuevo-en-alfa@e12.ejemplo',
      orgId: alfa,
      rol: 'usuario',
      /* Las pestañas, y esta línea es nueva: el rol `usuario` se restringe por sección, así que un
         alta sin ellas ahora se RECHAZA. Antes esta prueba pasaba sin pedirlas y creaba a alguien
         que —con la semántica vieja— veía las diez. El caso contrario está en la prueba de abajo. */
      secciones: ['closer'],
    }),
  );
  assert.equal(r.status, 201, await r.clone().text());
  const datos = (await r.json()) as { id: string; temporal: string; rol: string };
  assert.equal(datos.rol, 'usuario');
  assert.ok(datos.temporal?.length === 14, 'la temporal no vino, o no tiene el largo del 05 § 3');

  // Quedó en ALFA, no en la organización de la sesión. Es la mitad que importa: sin ella, la
  // pantalla diría «creado en Alfa» sobre alguien que quedó en la principal.
  const fila = await admin.query<{ org_id: string; email: string }>(
    'select org_id, email from identidad.usuarios where id = $1',
    [datos.id],
  );
  assert.equal(fila.rows[0]?.org_id, alfa, 'la persona no quedó en la empresa elegida');

  // Y el rol quedó puesto EN LA MISMA operación. Antes eran dos llamadas y entre ellas la persona
  // existía sin ninguna capacidad.
  const roles = await admin.query<{ clave: string }>(
    `select r.clave from identidad.usuarios_roles ur
       join identidad.roles r on r.id = ur.rol_id where ur.usuario_id = $1`,
    [datos.id],
  );
  assert.deepEqual(roles.rows.map((f) => f.clave), ['usuario']);

  // Y LAS PESTAÑAS también quedaron en la misma operación. Sin esto, la persona tendría el rol
  // restringido y cero secciones: entraría y no vería nada.
  const secciones = await admin.query<{ seccion: string }>(
    'select seccion from identidad.usuarios_secciones where usuario_id = $1',
    [datos.id],
  );
  assert.deepEqual(secciones.rows.map((f) => f.seccion), ['closer']);
});

test('y quien NO es rol de plataforma sigue recibiendo 404 con una empresa ajena', async () => {
  await limpiar();
  // Un actor con `usuarios.crear` y SIN `organizaciones.listar`: es la combinación que decide.
  const rol = await rolCon('alfa', ['usuarios.ver', 'usuarios.crear']);
  const actor = await usuario('gestor-alfa@e12.ejemplo', 'alfa', [rol]);
  const token = await sesion(actor);
  const beta = await orgDe('beta');

  const r = await crearUsuario(
    pedir('/api/admin/usuarios', token, {
      nombre: MARCA,
      email: 'no-deberia@e12.ejemplo',
      orgId: beta,
    }),
  );
  assert.deepEqual(
    await codigoDe(r),
    { estado: 404, codigo: 'no_encontrado', detalle: undefined },
    'un actor sin alcance pudo nombrar otra empresa: 404 y nunca 403, porque un 403 confirma ' +
      'que ese identificador existe',
  );

  // Y NO se creó nada. Sin esto, un manejador que creara y después respondiera 404 pasaría arriba.
  const hay = await admin.query('select 1 from identidad.usuarios where email = $1', [
    'no-deberia@e12.ejemplo',
  ]);
  assert.equal(hay.rowCount, 0, 'el alta ocurrió y devolvió 404');
});

// ─── Reactivar: el estado sin salida que existía ─────────────────────────────

test('desactivar y REACTIVAR: la vuelta no existía y era un estado sin salida', async () => {
  await limpiar();
  const fundadora = await idDe('fundadora@principal.ejemplo');
  const alfa = await orgDe('alfa');
  const token = await sesion(fundadora, alfa);
  const victima = await usuario('ida-y-vuelta@e12.ejemplo', 'alfa');

  const baja = await desactivar(pedir(`/api/admin/usuarios/${victima}/desactivar`, token, {}), ctx(victima));
  assert.equal(baja.status, 200, await baja.clone().text());
  let fila = await admin.query<{ activo: boolean }>(
    'select activo from identidad.usuarios where id = $1',
    [victima],
  );
  assert.equal(fila.rows[0]?.activo, false);

  const alta = await activar(pedir(`/api/admin/usuarios/${victima}/activar`, token, {}), ctx(victima));
  assert.equal(alta.status, 200, await alta.clone().text());
  fila = await admin.query('select activo from identidad.usuarios where id = $1', [victima]);
  assert.equal(fila.rows[0]?.activo, true, 'reactivar no devolvió el acceso');
});

// ─── El correo ──────────────────────────────────────────────────────────────

test('editar el correo funciona, y un duplicado se rechaza sin decir de quién', async () => {
  await limpiar();
  const fundadora = await idDe('fundadora@principal.ejemplo');
  const alfa = await orgDe('alfa');
  const token = await sesion(fundadora, alfa);
  const quien = await usuario('mal-escrito@e12.ejemplo', 'alfa');
  // La víctima del choque vive en OTRA organización: es lo que hace que el mensaje de la base sea
  // un canal —confirmaría una fila que quien pregunta no puede ver— y por eso no se devuelve.
  await usuario('ocupado@e12.ejemplo', 'beta');

  const bien = await editarUsuario(
    pedir(`/api/admin/usuarios/${quien}`, token, { nombre: MARCA, email: 'bien-escrito@e12.ejemplo' }, 'PATCH'),
    ctx(quien),
  );
  assert.equal(bien.status, 200, await bien.clone().text());
  const fila = await admin.query<{ email: string }>(
    'select email from identidad.usuarios where id = $1',
    [quien],
  );
  assert.equal(fila.rows[0]?.email, 'bien-escrito@e12.ejemplo', 'el correo no se guardó');

  const choque = await editarUsuario(
    pedir(`/api/admin/usuarios/${quien}`, token, { nombre: MARCA, email: 'ocupado@e12.ejemplo' }, 'PATCH'),
    ctx(quien),
  );
  const dicho = await codigoDe(choque);
  assert.equal(dicho.estado, 409);
  assert.equal(dicho.codigo, 'email_duplicado');
  assert.equal(
    /beta|identidad\.|constraint|duplicate key/i.test(String(dicho.detalle ?? '')),
    false,
    'el rechazo del correo duplicado filtró el mensaje de la base o la organización ajena',
  );
});

// ─── Borrar: solo si no queda rastro, y diciendo qué lo impide ───────────────

test('borrar a alguien CON historial se rechaza, y el rechazo dice qué lo impide', async () => {
  await limpiar();
  const fundadora = await idDe('fundadora@principal.ejemplo');
  const alfa = await orgDe('alfa');
  const token = await sesion(fundadora, alfa);

  // `usuarios.creado_por` es una de las claves foráneas `no action`, y la más fácil de montar: la
  // persona A dio de alta a B, así que borrar A dejaría a B firmada por nadie.
  const quienCreo = await usuario('creo-a-otro@e12.ejemplo', 'alfa');
  await conIdentidad(async (db) => {
    const org = await db
      .selectFrom('organizaciones')
      .select('id')
      .where('slug', '=', 'alfa')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('usuarios')
      .values({
        org_id: org.id,
        nombre: MARCA,
        email: 'creado-por-otro@e12.ejemplo',
        password_hash: hashear(PASSWORD),
        creado_por: quienCreo,
      })
      .execute();
  });

  const r = await borrarUsuario(
    pedir(`/api/admin/usuarios/${quienCreo}`, token, undefined, 'DELETE'),
    ctx(quienCreo),
  );
  const dicho = await codigoDe(r);
  assert.equal(dicho.estado, 409);
  assert.equal(dicho.codigo, 'rechazo_de_la_base');
  // El mensaje tiene que estar en palabras del negocio y decir la alternativa.
  assert.match(String(dicho.detalle), /dio de alta a otras personas/);
  assert.match(String(dicho.detalle), /desactivar/);
  // Y NO puede nombrar la estructura: `ADR-0704`.
  assert.doesNotMatch(String(dicho.detalle), /usuarios|fkey|constraint|identidad\./i);

  // Sigue ahí. Sin esto, un manejador que borrara y después respondiera 409 pasaría arriba.
  const sigue = await admin.query('select 1 from identidad.usuarios where id = $1', [quienCreo]);
  assert.equal(sigue.rowCount, 1, 'el borrado ocurrió y devolvió 409');
});

test('borrar a alguien SIN historial funciona', async () => {
  await limpiar();
  const fundadora = await idDe('fundadora@principal.ejemplo');
  const alfa = await orgDe('alfa');
  const token = await sesion(fundadora, alfa);
  // Con una sesión abierta y un rol puesto: las dos caen en cascada, y ninguna es historia.
  const rol = await rolCon('alfa', ['contactos.ver']);
  const sobra = await usuario('de-mas@e12.ejemplo', 'alfa', [rol]);
  await sesion(sobra);

  const r = await borrarUsuario(pedir(`/api/admin/usuarios/${sobra}`, token, undefined, 'DELETE'), ctx(sobra));
  assert.equal(r.status, 200, await r.clone().text());
  const hay = await admin.query('select 1 from identidad.usuarios where id = $1', [sobra]);
  assert.equal(hay.rowCount, 0, 'la persona sigue ahí');
});

test('y nadie se borra a sí mismo', async () => {
  await limpiar();
  const fundadora = await idDe('fundadora@principal.ejemplo');
  const token = await sesion(fundadora);
  const r = await borrarUsuario(
    pedir(`/api/admin/usuarios/${fundadora}`, token, undefined, 'DELETE'),
    ctx(fundadora),
  );
  assert.deepEqual((await codigoDe(r)).codigo, 'sobre_si_mismo');
});

// ─── El administrador principal: las CUATRO operaciones rechazadas ───────────

test('al administrador principal no se lo puede desactivar, borrar, degradar ni renombrar el correo', async () => {
  await limpiar();
  // Hace falta un SEGUNDO usuario con el rol de plataforma: sobre sí misma, la fundadora recibiría
  // `sobre_si_mismo` antes de llegar al disparador, y la prueba pasaría por el motivo equivocado.
  const otro = await usuario('otro-plataforma@e12.ejemplo', 'principal', ['superadministrador']);
  const token = await sesion(otro);
  const fundadora = await idDe('fundadora@principal.ejemplo');

  const casos: [string, () => Promise<Response>][] = [
    [
      'desactivar',
      () => desactivar(pedir(`/api/admin/usuarios/${fundadora}/desactivar`, token, {}), ctx(fundadora)),
    ],
    [
      'borrar',
      () => borrarUsuario(pedir(`/api/admin/usuarios/${fundadora}`, token, undefined, 'DELETE'), ctx(fundadora)),
    ],
    [
      'quitarle el rol',
      () => asignarRoles(pedir(`/api/admin/usuarios/${fundadora}/roles`, token, { roles: [] }), ctx(fundadora)),
    ],
    [
      'cambiarle el correo',
      () =>
        editarUsuario(
          pedir(`/api/admin/usuarios/${fundadora}`, token, { nombre: 'Fundadora', email: 'otro@e12.ejemplo' }, 'PATCH'),
          ctx(fundadora),
        ),
    ],
  ];

  for (const [que, correr] of casos) {
    const r = await correr();
    assert.equal(r.status, 409, `${que}: tendría que rechazarse, y respondió ${r.status}`);
    const dicho = await codigoDe(r);
    // El mensaje del disparador sube tal cual porque está escrito para leerse. Se comprueba que
    // llegue: sin eso, la pantalla mostraría «Rechazado (409)» y nadie sabría por qué.
    assert.ok(
      dicho.detalle && dicho.detalle.length > 10,
      `${que}: el rechazo llegó sin explicación (${JSON.stringify(dicho)})`,
    );
  }

  // Y sigue intacta: activa, con su correo y con su rol.
  const fila = await admin.query<{ activo: boolean; email: string; n: string }>(
    `select u.activo, u.email, (select count(*) from identidad.usuarios_roles ur
        where ur.usuario_id = u.id)::text as n
       from identidad.usuarios u where u.id = $1`,
    [fundadora],
  );
  assert.equal(fila.rows[0]?.activo, true);
  assert.equal(fila.rows[0]?.email, 'fundadora@principal.ejemplo');
  assert.notEqual(fila.rows[0]?.n, '0', 'le quedó cero roles: la degradación ocurrió');
});

// ─── La organización principal ───────────────────────────────────────────────

test('a la empresa principal no se la puede desactivar ni eliminar', async () => {
  await limpiar();
  const fundadora = await idDe('fundadora@principal.ejemplo');
  const principal = await orgDe('principal');
  const alfa = await orgDe('alfa');
  // La sesión mira ALFA, no la principal. Es lo que hace que el borrado llegue a la base: la ruta
  // rechaza antes borrar «la empresa que estás administrando», y ese rechazo es otro.
  const token = await sesion(fundadora, alfa);

  const apagar = await editarOrg(
    pedir(`/api/admin/organizaciones/${principal}`, token, { activa: false }, 'PATCH'),
    ctx(principal),
  );
  assert.equal(apagar.status, 409, `desactivar la principal: ${await apagar.clone().text()}`);

  const borrar = await borrarOrg(
    pedir(`/api/admin/organizaciones/${principal}`, token, undefined, 'DELETE'),
    ctx(principal),
  );
  assert.equal(borrar.status, 409, `borrar la principal: ${await borrar.clone().text()}`);

  const fila = await admin.query<{ activa: boolean; es_principal: boolean }>(
    'select activa, es_principal from identidad.organizaciones where id = $1',
    [principal],
  );
  assert.equal(fila.rows[0]?.activa, true, 'la principal quedó desactivada');
  assert.equal(fila.rows[0]?.es_principal, true);
});

test('una empresa cliente SÍ se puede renombrar, desactivar y reactivar', async () => {
  await limpiar();
  const fundadora = await idDe('fundadora@principal.ejemplo');
  const token = await sesion(fundadora);
  const nueva = await conIdentidad(async (db) =>
    db
      .insertInto('organizaciones')
      .values({ nombre: 'Cliente de prueba', slug: 'e12-cliente' })
      .returning('id')
      .executeTakeFirstOrThrow(),
  );

  const nombre = await editarOrg(
    pedir(`/api/admin/organizaciones/${nueva.id}`, token, { nombre: 'Cliente renombrado' }, 'PATCH'),
    ctx(nueva.id),
  );
  assert.equal(nombre.status, 200, await nombre.clone().text());

  const apagar = await editarOrg(
    pedir(`/api/admin/organizaciones/${nueva.id}`, token, { activa: false }, 'PATCH'),
    ctx(nueva.id),
  );
  assert.equal(apagar.status, 200, await apagar.clone().text());

  const prender = await editarOrg(
    pedir(`/api/admin/organizaciones/${nueva.id}`, token, { activa: true }, 'PATCH'),
    ctx(nueva.id),
  );
  assert.equal(prender.status, 200, await prender.clone().text());

  const fila = await admin.query<{ nombre: string; activa: boolean }>(
    'select nombre, activa from identidad.organizaciones where id = $1',
    [nueva.id],
  );
  assert.equal(fila.rows[0]?.nombre, 'Cliente renombrado');
  assert.equal(fila.rows[0]?.activa, true);

  // Y se puede borrar, porque está vacía.
  const borrada = await borrarOrg(
    pedir(`/api/admin/organizaciones/${nueva.id}`, token, undefined, 'DELETE'),
    ctx(nueva.id),
  );
  assert.equal(borrada.status, 200, await borrada.clone().text());
});

test('pero una empresa CON datos no se borra, y el rechazo dice por qué', async () => {
  await limpiar();
  const fundadora = await idDe('fundadora@principal.ejemplo');
  const token = await sesion(fundadora);
  const conGente = await conIdentidad(async (db) => {
    const org = await db
      .insertInto('organizaciones')
      .values({ nombre: 'Cliente con gente', slug: 'e12-con-gente' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('usuarios')
      .values({
        org_id: org.id,
        nombre: MARCA,
        email: 'alguien@e12.ejemplo',
        password_hash: hashear(PASSWORD),
      })
      .execute();
    return org.id;
  });

  const r = await borrarOrg(
    pedir(`/api/admin/organizaciones/${conGente}`, token, undefined, 'DELETE'),
    ctx(conGente),
  );
  const dicho = await codigoDe(r);
  assert.equal(dicho.estado, 409);
  assert.match(String(dicho.detalle), /todavía tiene personas dadas de alta/);
  assert.match(String(dicho.detalle), /desactivar/);
  assert.doesNotMatch(String(dicho.detalle), /fkey|constraint|identidad\./i);
});

// ─── El diccionario que traduce el rechazo ──────────────────────────────────

test('las claves de `QUE_LO_IMPIDE` son nombres de restricciones que EXISTEN', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // POR QUÉ ESTO NECESITA UNA PRUEBA
  //
  // `lib/administracion/borrado.ts` traduce el nombre de la restricción que bloqueó el borrado a
  // palabras del negocio: `notas_org_id_autor_id_fkey` → *"escribió notas en fichas de contactos"*.
  //
  // El modo de falla es SILENCIOSO en las dos direcciones:
  //
  //   · Si una migración renombra una restricción, la clave deja de coincidir y el mensaje cae al
  //     genérico. Nada falla; solo se pierde precisión, y nadie lo nota porque el borrado sigue
  //     rechazándose.
  //   · Si una clave está mal escrita desde el principio, nunca aplicó — y eso es indistinguible
  //     de «esa restricción no se dispara nunca».
  //
  // Así que se cruza contra `pg_constraint`. Es la única forma de saber si el diccionario habla de
  // la base que existe o de la que existía.
  // ═══════════════════════════════════════════════════════════════════════════
  const { QUE_LO_IMPIDE } = await import('../../lib/administracion/borrado.ts');
  const claves = Object.keys(QUE_LO_IMPIDE);
  assert.ok(claves.length > 0, 'el diccionario está vacío: la traducción no existe');

  const reales = await admin.query<{ conname: string }>(
    `select conname from pg_constraint where contype = 'f'
       and connamespace in ('identidad'::regnamespace, 'negocio'::regnamespace)`,
  );
  const existentes = new Set(reales.rows.map((f) => f.conname));

  const fantasmas = claves.filter((c) => !existentes.has(c));
  assert.deepEqual(
    fantasmas,
    [],
    'el diccionario traduce restricciones que no existen: esas entradas nunca se aplican, y el ' +
      'mensaje cae al genérico sin que nada falle',
  );

  // Y la comprobación de entradas MUERTAS al revés: toda clave foránea que apunte a `usuarios` o a
  // `organizaciones` tiene que tener su traducción. Sin esto, una tabla nueva del negocio bloquea
  // borrados con un mensaje genérico y nadie se enteraría.
  const apuntan = await admin.query<{ conname: string }>(
    `select conname from pg_constraint
      where contype = 'f'
        and confrelid in ('identidad.usuarios'::regclass, 'identidad.organizaciones'::regclass)
        and confdeltype = 'a'`,
  );
  const sinTraducir = apuntan.rows.map((f) => f.conname).filter((c) => !(c in QUE_LO_IMPIDE));
  assert.deepEqual(
    sinTraducir,
    [],
    'hay claves foráneas que pueden bloquear un borrado y no tienen traducción: el rechazo va a ' +
      'decir «tiene historial» sin decir cuál',
  );
});
