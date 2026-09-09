// Quién puede crear a quién, y en qué empresa. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS DOS REGLAS QUE SE PIDIERON, Y LA TERCERA QUE HAY QUE AGREGARLES PARA QUE SEAN SEGURAS
//
//   1 · *«que los superadmins puedan crear superadmins, admins y usuarios»* — ya funcionaba.
//   2 · *«que los admins solo puedan crear usuarios»* — el administrador no podía crear NADA:
//       `db/arranque/001_catalogo.sql` le negaba `usuarios.%` y `roles.%` completos, y ni veía el
//       panel.
//   3 · Y la que no se pidió porque no hacía falta decirla: **un administrador no puede fabricar
//       otro administrador.** Sin ella, la regla 2 es una escalada — el administrador de una empresa
//       cliente se clona, el clon vuelve a clonarse, y cada uno puede restablecer la contraseña de
//       cualquiera de su empresa, incluida la del fundador. Ninguna de esas altas falla.
//
// ── POR QUÉ ESTE ARCHIVO Y NO SOLO `22-los-tres-roles` ─────────────────────
//
// Ése mide el REPARTO —qué capacidades tiene cada rol— leyendo la tabla. Esto mide las
// OPERACIONES: que con ese reparto el administrador efectivamente cree, y que efectivamente no
// pueda con los otros dos roles. Son dos cosas distintas y las dos pueden estar mal por separado:
// el reparto correcto con la barrera ausente da una escalada, y la barrera correcta con el reparto
// viejo da un panel que nadie ve.
//
// ── Y LAS DOS DIRECCIONES, PORQUE NINGUNA DA ERROR ─────────────────────────
//
//   · **de más** — la barrera no está: el administrador crea administradores. Nadie ve un error;
//     hay una persona más con la llave, y la llave se puede volver a copiar.
//   · **de menos** — la barrera se aplica a quien no debía: el superadministrador no puede crear
//     otro superadministrador, y eso es un punto único de falla —si pierde el acceso no queda
//     nadie que pueda devolvérselo—, que es el argumento que ya está escrito en
//     `components/ajustes/Usuarios.jsx`.
//
// Las dos reglas de subconjunto que se descartaron por esta asimetría están argumentadas en
// `lib/autorizacion/delegacion.ts`.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Client } from 'pg';
import { GET as verRoles } from '../../app/api/admin/roles/route.ts';
import { POST as crearUsuario } from '../../app/api/admin/usuarios/route.ts';
import { DELETE as borrar } from '../../app/api/admin/usuarios/[id]/route.ts';
import { POST as asignarRoles } from '../../app/api/admin/usuarios/[id]/roles/route.ts';
import { GET as verSesion } from '../../app/api/auth/sesion/route.ts';
import { GET as verUsuarios } from '../../app/api/usuarios/route.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { cerrarTodo, conectar } from '../apoyo/conexiones.ts';
import { COOKIE_SESION, hashDeToken } from '../../lib/autorizacion/sesion.ts';

const DOMINIO = 'ejemplo.test';
/** El sufijo de todo lo que siembra este archivo. `limpiar()` borra solo lo suyo. */
const MARCA = '@creadores.ejemplo';

/**
 * Un rol de plataforma que **no** administra personas. Ver la última prueba: existe para separar
 * los dos ejes, que hoy se solapan en los tres roles del catálogo.
 */
const ROL_DE_PLATAFORMA_INOCUO = 'mirador-de-plataforma-de-prueba';

let admin: Client;
/** Las tres organizaciones del sembrado. `alfa` y `beta` son clientes; `principal` es la nuestra. */
let orgs: { alfa: string; beta: string; principal: string };

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  const { rows } = await admin.query<{ slug: string; id: string; es_principal: boolean }>(
    'select slug, id, es_principal from identidad.organizaciones',
  );
  const principal = rows.find((o) => o.es_principal);
  const alfa = rows.find((o) => o.slug === 'alfa');
  const beta = rows.find((o) => o.slug === 'beta');
  assert.ok(principal && alfa && beta, 'falta el sembrado: corré `npm run db:reset`');
  orgs = { alfa: alfa.id, beta: beta.id, principal: principal.id };
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

/**
 * Borra lo sembrado por este archivo.
 *
 * `creado_por` se anula ANTES del borrado porque referencia `usuarios(id)`: una persona creada por
 * el endpoint apunta a quien la creó, y borrar primero al creador viola la clave foránea. Es el
 * mismo tropiezo que `50-administracion` documenta, y se hereda su solución en vez de volver a
 * descubrirla.
 *
 * Va por el superusuario porque `app_identidad` no tiene `delete` sobre `usuarios` — las personas
 * se desactivan, no se borran (`05` § 6).
 */
async function limpiar(): Promise<void> {
  const donde = `where email like '%${MARCA}'`;
  await admin.query(
    `update identidad.usuarios set creado_por = null
      where creado_por in (select id from identidad.usuarios ${donde})`,
  );
  for (const t of ['sesiones', 'usuarios_roles', 'usuarios_secciones']) {
    await admin.query(
      `delete from identidad.${t} where usuario_id in (select id from identidad.usuarios ${donde})`,
    );
  }
  /* ── LA AUDITORÍA NO SE LIMPIA, Y NO ES UN OLVIDO ─────────────────────────
   *
   * `identidad.auditoria_accesos` es de SOLO INSERCIÓN, y lo hace cumplir el disparador
   * `identidad.evitar_mutacion()` — ni el superusuario la puede borrar. Un registro que se puede
   * editar no es un registro.
   *
   * Se descubrió intentándolo: la primera versión de esta limpieza hacía el `delete`, el
   * disparador respondió *«La tabla auditoria_accesos es de solo inserción»*, y como el fallo
   * ocurría en el `after`, `cerrarTodo()` no llegaba a correr — el proceso se quedaba colgado con
   * las conexiones abiertas **sin mostrar el error**. Dos síntomas, una causa.
   *
   * Las filas quedan, y está bien que queden: `usuario_id` no tiene clave foránea contra
   * `usuarios`, así que borrar a la persona no las arrastra ni falla por ellas. Es la misma
   * decisión que ya toma `50-administracion`, que tampoco las toca. */
  await admin.query(`delete from identidad.usuarios ${donde}`);
  // Y el rol de prueba de la última prueba, si una corrida interrumpida lo dejó vivo. Un rol
  // global de más se ofrecería en el catálogo y rompería la prueba que compara la lista exacta.
  await admin.query(`delete from identidad.roles_permisos where rol_id in
    (select id from identidad.roles where clave = $1)`, [ROL_DE_PLATAFORMA_INOCUO]);
  await admin.query('delete from identidad.roles where clave = $1', [ROL_DE_PLATAFORMA_INOCUO]);
}

/** Una persona con su rol, en la empresa indicada. */
async function persona(
  nombre: string,
  orgId: string,
  rol: string | null,
  secciones: string[] = [],
): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash, creado_por)
     values ($1, $2, $3, 'scrypt$16384$8$1$c2FsCg==$aGFzaAo=', null) returning id`,
    [orgId, nombre, `${nombre.toLowerCase().replace(/\W+/g, '')}${MARCA}`],
  );
  const id = rows[0]!.id;
  if (rol) {
    await admin.query(
      `insert into identidad.usuarios_roles (usuario_id, rol_id, asignado_por)
       select $1, id, null from identidad.roles where clave = $2 and org_id is null`,
      [id, rol],
    );
  }
  for (const s of secciones) {
    await admin.query(
      'insert into identidad.usuarios_secciones (usuario_id, seccion, concedida_por) values ($1, $2, null)',
      [id, s],
    );
  }
  return id;
}

/** Una sesión activa, y su token. */
async function sesionDe(usuarioId: string): Promise<string> {
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
    method: cuerpo === undefined && metodo === 'POST' ? 'GET' : metodo,
    headers: {
      origin: `https://${DOMINIO}`,
      cookie: `${COOKIE_SESION}=${token}`,
      ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

const leer = async <T>(r: Response): Promise<{ estado: number; cuerpo: T }> => ({
  estado: r.status,
  cuerpo: (await r.clone().json()) as T,
});

/** Un alta, con el correo derivado del nombre para que `limpiar()` lo alcance. */
function alta(nombre: string, rol: string | null, extra: Record<string, unknown> = {}) {
  return {
    nombre,
    email: `${nombre.toLowerCase().replace(/\W+/g, '')}${MARCA}`,
    ...(rol ? { rol } : {}),
    ...extra,
  };
}

/** ¿Existe esa persona? Es lo que convierte un 403 en «y no escribió nada». */
async function existe(nombre: string): Promise<boolean> {
  const { rows } = await admin.query<{ n: string }>(
    'select count(*) as n from identidad.usuarios where email = $1',
    [`${nombre.toLowerCase().replace(/\W+/g, '')}${MARCA}`],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL ADMINISTRADOR VE EL PANEL, Y SOLO SU EMPRESA
// ═══════════════════════════════════════════════════════════════════════════════

test('un administrador ve el panel de usuarios', async () => {
  /* Era la mitad que faltaba y no daba error: sin `usuarios.ver`, la pestaña no aparecía en el menú
     —`secciones.ts` la cuelga de esa capacidad— así que crear personas no tenía puerta. */
  const quien = await persona('AdminAlfa', orgs.alfa, 'administrador');
  const { estado } = await leer(await verUsuarios(pedir('/api/usuarios', await sesionDe(quien))));
  assert.equal(estado, 200, 'el administrador no puede leer el panel de usuarios');
});

test('y la lista se queda en SU empresa, sin decir que hay otras', async () => {
  /* El corte lo hace `personasQuePuedeAdministrar` con `todasLasEmpresas`, que es
     `organizaciones.listar` — la capacidad que el administrador NO tiene y de la que dependen las
     dos reglas nuevas.

     Se comprueba con una persona real de la otra empresa, no con el largo de la lista: un filtro
     que devuelve menos filas puede estar filtrando por cualquier cosa. */
  const quien = await persona('AdminAlfa2', orgs.alfa, 'administrador');
  await persona('AjenoDeBeta', orgs.beta, 'usuario', ['closer']);

  /* La forma es `organizacion: {id, nombre, esPrincipal}` y **no** `org_id`, que fue lo que escribí
     primero. Lo dijo esta misma aserción: con un campo que no existe, `every` da falso y la prueba
     falla en vez de pasar en verde comparando `undefined` contra `undefined`. */
  const { cuerpo } = await leer<{
    todasLasEmpresas: boolean;
    usuarios: { nombre: string; organizacion: { id: string } }[];
  }>(await verUsuarios(pedir('/api/usuarios', await sesionDe(quien))));

  assert.equal(cuerpo.todasLasEmpresas, false, 'la lista del administrador cruza empresas');
  assert.ok(cuerpo.usuarios.length > 0, 'la lista salió vacía: no hay nada que comprobar');
  assert.equal(
    cuerpo.usuarios.some((u) => u.nombre === 'AjenoDeBeta'),
    false,
    'el administrador ve personas de otra empresa',
  );
  assert.ok(
    cuerpo.usuarios.every((u) => u.organizacion.id === orgs.alfa),
    'la lista trae personas de una empresa que no es la suya',
  );
});

test('quien tiene el rol `usuario` NO ve el panel', async () => {
  /* La otra dirección del reparto: lo que se ensanchó fue el administrador, no todo el mundo. Sin
     esta prueba, dar `usuarios.%` al rol equivocado pasaría todas las de arriba. */
  const quien = await persona('UsuarioLlano', orgs.alfa, 'usuario', ['closer']);
  const { estado, cuerpo } = await leer<{ codigo: string }>(
    await verUsuarios(pedir('/api/usuarios', await sesionDe(quien))),
  );
  assert.equal(estado, 403, 'un usuario llano llegó al panel de personas');
  assert.equal(cuerpo.codigo, 'sin_permiso');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · EL ADMINISTRADOR CREA USUARIOS, Y SOLO USUARIOS
// ═══════════════════════════════════════════════════════════════════════════════

test('un administrador CREA un usuario de su empresa', async () => {
  const quien = await persona('AdminCrea', orgs.alfa, 'administrador');
  const { estado, cuerpo } = await leer<{ creado: boolean; temporal: string; rol: string }>(
    await crearUsuario(
      pedir('/api/admin/usuarios', await sesionDe(quien), alta('NuevoDeAlfa', 'usuario', {
        secciones: ['closer'],
      })),
    ),
  );
  assert.equal(estado, 201, `el administrador no pudo crear: ${JSON.stringify(cuerpo)}`);
  assert.equal(cuerpo.rol, 'usuario');
  assert.ok(cuerpo.temporal, 'no devolvió la contraseña temporal');

  // Y en la empresa correcta, con la marca que hace temporal a la temporal.
  const { rows } = await admin.query<{ org_id: string; debe_cambiar_password: boolean }>(
    'select org_id, debe_cambiar_password from identidad.usuarios where email = $1',
    [`nuevodealfa${MARCA}`],
  );
  assert.equal(rows[0]?.org_id, orgs.alfa);
  assert.equal(rows[0]?.debe_cambiar_password, true, 'la persona nació sin la marca de cambio');
});

test('un administrador NO puede crear otro ADMINISTRADOR, y no queda nada escrito', async () => {
  /* ══════════════════════════════════════════════════════════════════════════
   * LA PRUEBA CENTRAL DE ESTE ARCHIVO
   *
   * Es el eslabón que convierte «los admins crean usuarios» en una escalada si falta: el
   * administrador de un cliente se clona y el clon vuelve a clonarse. Y no falla nada — el alta
   * responde 201 y hay una persona más con la llave.
   *
   * «Y no queda nada escrito» es la mitad que importa del rechazo: el alta escribe la persona, su
   * rol y sus pestañas en UNA transacción, así que un rechazo tardío —después del `insert` de
   * `usuarios`— dejaría a alguien creado sin rol. Un 403 con una persona a medias es peor que un
   * 201: nadie la ve en el panel con rol y nadie la borra.
   * ══════════════════════════════════════════════════════════════════════════ */
  const quien = await persona('AdminNoClona', orgs.alfa, 'administrador');
  const { estado, cuerpo } = await leer<{ codigo: string; detalle: string }>(
    await crearUsuario(
      pedir('/api/admin/usuarios', await sesionDe(quien), alta('ClonDelAdmin', 'administrador')),
    ),
  );
  assert.equal(estado, 403, `un administrador creó otro administrador: ${JSON.stringify(cuerpo)}`);
  assert.equal(cuerpo.codigo, 'sin_permiso');
  assert.match(
    cuerpo.detalle,
    /no se delega/i,
    'el rechazo no dice POR QUÉ, así que quien lo lea va a reintentar en vez de pedírselo a la plataforma',
  );
  assert.equal(await existe('ClonDelAdmin'), false, 'el 403 dejó la persona creada a medias');
});

test('un administrador NO puede crear un SUPERADMINISTRADOR (ADR-0504)', async () => {
  /* Esta barrera ya existía y su comentario decía *«hoy nadie llega acá sin la capacidad»*. Dejó de
     ser cierto: ahora el administrador tiene `usuarios.crear`, así que esta línea pasó de ser una
     precaución a ser la que trabaja. */
  const quien = await persona('AdminNoPlataforma', orgs.alfa, 'administrador');
  const { estado, cuerpo } = await leer<{ codigo: string }>(
    await crearUsuario(
      pedir(
        '/api/admin/usuarios',
        await sesionDe(quien),
        alta('SuperDeAlfa', 'superadministrador'),
      ),
    ),
  );
  assert.equal(estado, 403, 'un administrador creó un rol de plataforma');
  assert.equal(cuerpo.codigo, 'sin_permiso');
  assert.equal(await existe('SuperDeAlfa'), false, 'el 403 dejó la persona creada a medias');
});

test('un administrador NO puede ASCENDER a alguien que ya existe', async () => {
  /* El otro camino, y hacen falta los dos: con la barrera solo en el alta, el administrador crea
     un usuario y después le cambia el rol — dos peticiones, mismo resultado. */
  const quien = await persona('AdminNoAsciende', orgs.alfa, 'administrador');
  const victima = await persona('AscendidoDeAlfa', orgs.alfa, 'usuario', ['closer']);

  const { estado, cuerpo } = await leer<{ codigo: string; detalle: string }>(
    await asignarRoles(
      pedir(`/api/admin/usuarios/${victima}/roles`, await sesionDe(quien), {
        roles: ['administrador'],
      }),
      ctx(victima),
    ),
  );
  assert.equal(estado, 403, `un administrador ascendió a alguien: ${JSON.stringify(cuerpo)}`);
  assert.match(cuerpo.detalle, /no se delega/i);

  // Y el rol NO cambió. Sin esto, un rechazo después del `delete` de los roles viejos dejaría a la
  // persona sin ninguno — o sea degradada por un rechazo.
  const { rows } = await admin.query<{ clave: string }>(
    `select r.clave from identidad.usuarios_roles ur
       join identidad.roles r on r.id = ur.rol_id where ur.usuario_id = $1`,
    [victima],
  );
  assert.deepEqual(
    rows.map((f) => f.clave),
    ['usuario'],
    'el rechazo se llevó puesto el rol que la persona ya tenía',
  );
});

test('un administrador NO puede crear en OTRA empresa', async () => {
  /* «solo para su empresa». No lo cuida un condicional de pantalla: sin `organizaciones.listar`, un
     `orgId` ajeno es 404 —no 403— porque `ADR-0501` pide que una empresa que no se alcanza no se
     distinga de una que no existe. */
  const quien = await persona('AdminZonificado', orgs.alfa, 'administrador');
  const { estado } = await leer<{ codigo: string }>(
    await crearUsuario(
      pedir(
        '/api/admin/usuarios',
        await sesionDe(quien),
        alta('IntrusoEnBeta', 'usuario', { secciones: ['closer'], orgId: orgs.beta }),
      ),
    ),
  );
  assert.equal(estado, 404, 'un administrador creó una persona en otra empresa');
  assert.equal(await existe('IntrusoEnBeta'), false, 'la persona quedó creada en la otra empresa');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL SUPERADMINISTRADOR SÍ PUEDE CON LOS TRES
// ═══════════════════════════════════════════════════════════════════════════════

test('un superadministrador crea superadmins, admins y usuarios', async () => {
  /* La dirección que se rompe por exceso de celo, y es la peor de las dos: una regla que también
     frena al superadministrador deja la plataforma con una sola llave. El argumento está en
     `components/ajustes/Usuarios.jsx`: *«una sola persona con la llave no es una regla de
     seguridad, es un punto único de falla»*.
     El superadministrador va en la organización PRINCIPAL porque el disparador
     `rol_de_plataforma_acotado` exige que quien reciba ese rol viva ahí. */
  const quien = await persona('SuperCrea', orgs.principal, 'superadministrador');
  const token = await sesionDe(quien);

  for (const [nombre, rol, extra] of [
    ['SuperNuevo', 'superadministrador', {}],
    ['AdminNuevo', 'administrador', {}],
    ['UsuarioNuevo', 'usuario', { secciones: ['closer'] }],
  ] as const) {
    const { estado, cuerpo } = await leer<{ rol: string }>(
      await crearUsuario(pedir('/api/admin/usuarios', token, alta(nombre, rol, extra))),
    );
    assert.equal(estado, 201, `el superadministrador no pudo crear un ${rol}: ${JSON.stringify(cuerpo)}`);
    assert.equal(cuerpo.rol, rol);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · Y LA PANTALLA NO OFRECE LO QUE VA A SER RECHAZADO
// ═══════════════════════════════════════════════════════════════════════════════

test('el catálogo de roles dice cuáles puede otorgar QUIEN pregunta', async () => {
  /* Sin esto el formulario ofrece los tres roles al administrador y dos de ellos contestan 403 al
     apretar: el `07` § 4, *mostrar un control que no puede cumplir*. Lo calcula el servidor con la
     misma función que usan las dos rutas que otorgan, así que no hay dos definiciones. */
  const elAdmin = await persona('AdminCatalogo', orgs.alfa, 'administrador');
  const elSuper = await persona('SuperCatalogo', orgs.principal, 'superadministrador');

  const otorgables = async (usuarioId: string) => {
    const { cuerpo } = await leer<{ roles: { clave: string; otorgable: boolean }[] }>(
      await verRoles(pedir('/api/admin/roles', await sesionDe(usuarioId))),
    );
    return cuerpo.roles.filter((r) => r.otorgable).map((r) => r.clave).sort();
  };

  assert.deepEqual(
    await otorgables(elAdmin),
    ['usuario'],
    'el catálogo le ofrece al administrador roles que el servidor le va a rechazar',
  );
  assert.deepEqual(
    await otorgables(elSuper),
    ['administrador', 'superadministrador', 'usuario'],
    'el catálogo le esconde al superadministrador roles que sí puede otorgar',
  );
});

test('el administrador no puede ELIMINAR personas, y la sesión se lo dice antes', async () => {
  /* Se le niega `usuarios.borrar` a propósito: borrar no se deshace y no se pidió — desactivar sí
     puede, que es la operación reversible que cubre el caso real.
     Y la sesión lo anuncia para que el panel esconda el botón: si no, el administrador lee la
     advertencia de que no se puede deshacer, aprieta, y recibe un 403 sin explicación. */
  const elAdmin = await persona('AdminNoBorra', orgs.alfa, 'administrador');
  const elSuper = await persona('SuperBorra', orgs.principal, 'superadministrador');
  const victima = await persona('BorrableDeAlfa', orgs.alfa, 'usuario', ['closer']);

  const bandera = async (usuarioId: string) => {
    const { cuerpo } = await leer<{ puedeBorrarPersonas: boolean }>(
      await verSesion(pedir('/api/auth/sesion', await sesionDe(usuarioId))),
    );
    return cuerpo.puedeBorrarPersonas;
  };
  assert.equal(await bandera(elAdmin), false, 'la sesión le ofrece al administrador el borrado');
  assert.equal(await bandera(elSuper), true, 'la sesión le esconde el borrado al superadministrador');

  // Y el servidor es el que manda: la bandera es para la pantalla, no la barrera.
  const { estado } = await leer<{ codigo: string }>(
    await borrar(
      pedir(`/api/admin/usuarios/${victima}`, await sesionDe(elAdmin), undefined, 'DELETE'),
      ctx(victima),
    ),
  );
  assert.equal(estado, 403, 'un administrador eliminó a una persona');
  assert.equal(await existe('BorrableDeAlfa'), true, 'la persona se borró igual');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LOS DOS EJES SON DOS, Y HOY SE SOLAPAN
// ═══════════════════════════════════════════════════════════════════════════════

test('ADR-0504 en el ALTA: un rol de plataforma que NO administra personas también se rechaza', async () => {
  /* ══════════════════════════════════════════════════════════════════════════
   * ESTA PRUEBA EXISTE PORQUE UNA MUTACIÓN SOBREVIVIÓ
   *
   * Borrar la barrera de `solo_principal` del alta no rompía ninguna prueba: los tres roles del
   * catálogo que son de plataforma **también** administran personas, así que la regla nueva de
   * delegación los frenaba igual y el rechazo seguía llegando. Las dos barreras se tapaban una a
   * la otra, y cualquiera de las dos podía desaparecer sin que nada lo dijera.
   *
   * Son dos ejes distintos y `lib/autorizacion/delegacion.ts` lo dice: uno pregunta si el rol
   * alcanza otras empresas, el otro si reparte poder sobre personas. Para medirlos por separado hay
   * que construir el caso que el catálogo no tiene: un rol de plataforma **inocuo**, con una sola
   * capacidad de lectura de tablero.
   *
   * Se crea y se borra acá adentro. Un rol global de más se ofrecería en `GET /api/admin/roles` y
   * rompería la prueba que compara la lista exacta de otorgables.
   * ══════════════════════════════════════════════════════════════════════════ */
  await admin.query(
    `insert into identidad.roles (clave, org_id, nombre, es_sistema, solo_principal)
     values ($1, null, 'Mirador de plataforma (prueba)', false, true)`,
    [ROL_DE_PLATAFORMA_INOCUO],
  );
  await admin.query(
    `insert into identidad.roles_permisos (rol_id, permiso)
     select id, 'tablero.ver' from identidad.roles where clave = $1`,
    [ROL_DE_PLATAFORMA_INOCUO],
  );

  try {
    // La guarda que hace que esto signifique algo: este rol NO cae en la regla de delegación, así
    // que si el alta lo rechaza es por `solo_principal` y por nada más.
    const { rows } = await admin.query<{ permiso: string }>(
      `select rp.permiso from identidad.roles_permisos rp
         join identidad.roles r on r.id = rp.rol_id where r.clave = $1`,
      [ROL_DE_PLATAFORMA_INOCUO],
    );
    assert.deepEqual(
      rows.map((f) => f.permiso),
      ['tablero.ver'],
      'el rol de prueba administra personas, así que no separa los dos ejes',
    );

    const quien = await persona('AdminNoMirador', orgs.alfa, 'administrador');
    const { estado, cuerpo } = await leer<{ codigo: string; detalle: string }>(
      await crearUsuario(
        pedir(
          '/api/admin/usuarios',
          await sesionDe(quien),
          alta('MiradorDeAlfa', ROL_DE_PLATAFORMA_INOCUO),
        ),
      ),
    );
    assert.equal(estado, 403, 'el alta otorgó un rol de plataforma a quien no puede otorgarlo');
    assert.equal(cuerpo.codigo, 'sin_permiso');
    assert.match(
      cuerpo.detalle,
      /rol de plataforma/i,
      `el rechazo llegó por otra barrera, no por ADR-0504: «${cuerpo.detalle}»`,
    );
    assert.equal(await existe('MiradorDeAlfa'), false, 'el 403 dejó la persona creada a medias');
  } finally {
    await admin.query(
      `delete from identidad.roles_permisos where rol_id in
        (select id from identidad.roles where clave = $1)`,
      [ROL_DE_PLATAFORMA_INOCUO],
    );
    await admin.query('delete from identidad.roles where clave = $1', [ROL_DE_PLATAFORMA_INOCUO]);
  }
});
