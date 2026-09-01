// El alcance por sección: los dos ceros, y que no sea cosmético. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PRUEBA MÁS IMPORTANTE DE ESTE ARCHIVO ES «LOS DOS CEROS»
//
// El primer diseño de esta función fallaba ABIERTO, y una revisión adversarial encontró el camino:
// `POST /api/admin/usuarios/{id}/roles` reemplaza los roles y no tocaba nada más, así que degradar a
// alguien de `administrador` a `usuario` lo dejaba con cero filas de alcance — que con la semántica
// de «filas = restringido» significaba **las diez pestañas**.
//
// Lo que separa los dos ceros es un hecho afirmado en el rol, y esta prueba es lo que convierte esa
// afirmación en algo comprobado en vez de un comentario:
//
//   · rol NO restringido + cero filas → ve todo lo que su capacidad habilita.
//   · rol SÍ restringido + cero filas → ve CERO. Falla cerrado.
//
// Y lo segundo que importa: **que no sea cosmético.** La lista de casillas esconde pestañas; si el
// portero no la hiciera cumplir, una petición a mano funcionaría igual. Es el defecto que este
// repositorio ya pagó dos veces —una frontera que vive solo en la interfaz— y está escrito en
// `db/arranque/001_catalogo.sql`.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { COOKIE_SESION, hashDeToken, resolverSesion } from '../../lib/autorizacion/sesion.ts';
import { exigir } from '../../lib/autorizacion/portero.ts';
/* `esDeLaPrincipal(c)` y no un `true` fijo: así estas pruebas recorren el MISMO camino que la
   sesión real, incluida la regla de la organización principal. Con un literal, una sección
   `soloDesdeLaPrincipal` quedaría fuera del alcance de esta prueba para siempre. */
import { esDeLaPrincipal, seccionesConAlcance, SIN_SECCION } from '../../lib/autorizacion/secciones.ts';
import { POST as crearUsuario } from '../../app/api/admin/usuarios/route.ts';
import { POST as asignarRoles } from '../../app/api/admin/usuarios/[id]/roles/route.ts';
import { personasQuePuedeAdministrar } from '../../lib/administracion/usuarios.ts';

const DOMINIO = 'ejemplo.test';

let admin: Client;
let alfa: string;
/* La principal, y hace falta porque hay una sección que solo existe ahí. Sin las DOS empresas, la
   comprobación del alcance se mediría en un solo lado y aceptaría lo que rechaza. */
let principal: string;

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  const a = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug='alfa'`);
  assert.ok(a);
  alfa = a.id;
  /* Se busca por la BANDERA y no por el slug `principal`: la bandera es lo que decide
     `soloDesdeLaPrincipal`, y `identidad.organizaciones_una_principal` garantiza que haya una sola.
     Buscándola por nombre, renombrar el sembrado dejaría esta prueba midiendo otra cosa. */
  const p = await unaFila<{ id: string }>(
    admin,
    `select id from identidad.organizaciones where es_principal`,
  );
  assert.ok(p, 'no hay organización principal en el sembrado');
  principal = p.id;
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

const MARCA = 'Alcance de prueba';

async function limpiar(): Promise<void> {
  await admin.query('delete from identidad.usuarios where nombre = $1', [MARCA]);
}

/** Una persona con su rol, y opcionalmente su alcance. Por el camino de la base, no del endpoint. */
async function persona(rol: string, secciones?: string[]): Promise<string> {
  const u = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.usuarios (org_id, nombre, email, password_hash)
       values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [alfa, MARCA, `a-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
  );
  assert.ok(u);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id)
       select $1, id from identidad.roles where clave = $2 and org_id is null`,
    [u.id, rol],
  );
  for (const s of secciones ?? []) {
    await admin.query(
      'insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, $2)',
      [u.id, s],
    );
  }
  return u.id;
}

async function sesionDe(usuarioId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await conIdentidad(async (db) => {
    await db
      .insertInto('sesiones')
      .values({
        usuario_id: usuarioId,
        token_hash: hashDeToken(token),
        estado: 'activa',
        expira_el: new Date(Date.now() + 3600_000),
      })
      .execute();
  });
  return token;
}

function pedir(camino: string, token: string, metodo = 'GET'): Request {
  return new Request(`https://${DOMINIO}${camino}`, {
    method: metodo,
    headers: { origin: `https://${DOMINIO}`, cookie: `${COOKIE_SESION}=${token}` },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LOS DOS CEROS
// ═══════════════════════════════════════════════════════════════════════════════

test('LOS DOS CEROS: cero filas con rol restringido es CERO; con rol no restringido es TODO', async () => {
  await limpiar();
  const restringido = await persona('usuario');
  const libre = await persona('administrador');

  const tokenR = await sesionDe(restringido);
  const tokenL = await sesionDe(libre);

  const cR = await resolverSesion(tokenR);
  const cL = await resolverSesion(tokenL);
  assert.ok(cR && cL);

  assert.equal(cR.alcance.restringido, true, 'el rol `usuario` tiene que estar restringido');
  assert.equal(cL.alcance.restringido, false, 'el rol `administrador` NO se restringe');

  // Y lo que se ve, que es lo que importa.
  assert.equal(
    seccionesConAlcance(cR.permisos, cR.alcance, esDeLaPrincipal(cR)).length,
    0,
    'un rol restringido sin ninguna sección concedida tendría que ver CERO pestañas',
  );
  assert.ok(
    seccionesConAlcance(cL.permisos, cL.alcance, esDeLaPrincipal(cL)).length > 5,
    'un rol no restringido tiene que ver todo lo que su capacidad habilita',
  );
});

test('con una sección concedida se ve ESA, y las filas de otro no cuentan', async () => {
  await limpiar();
  const uno = await persona('usuario', ['closer']);
  const otro = await persona('usuario', ['setter', 'icp']);

  for (const [id, esperadas] of [
    [uno, ['closer']],
    [otro, ['icp', 'setter']],
  ] as const) {
    const c = await resolverSesion(await sesionDe(id as string));
    assert.ok(c);
    const claves = seccionesConAlcance(c.permisos, c.alcance, esDeLaPrincipal(c))
      .map((s) => s.clave)
      .sort();
    assert.deepEqual(claves, [...esperadas].sort());
  }
});

test('una sección concedida que el ROL no habilita no concede nada', async () => {
  // `{ rol: 'usuario', secciones: ['credenciales'] }` pasa cualquier validación de lista y da CERO
  // pestañas. Por eso el endpoint valida sobre el RESULTADO — y por eso esto se comprueba: el
  // alcance es una intersección, nunca una unión.
  await limpiar();
  const p = await persona('usuario', ['credenciales', 'empresas', 'usuarios']);
  const c = await resolverSesion(await sesionDe(p));
  assert.ok(c);
  assert.deepEqual(seccionesConAlcance(c.permisos, c.alcance, esDeLaPrincipal(c)), []);
});

test('con DOS roles y uno sin restricción, NO hay restricción', async () => {
  // `bool_and` y no `bool_or`, y es una decisión: los roles solo SUMAN. Con `bool_or`, alguien que
  // tenga `administrador` y `usuario` quedaría restringido — o sea que el rol `usuario` le RESTARÍA
  // pestañas al de administrador, que es justo lo que la migración 003 prohíbe.
  await limpiar();
  const p = await persona('usuario', ['closer']);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id)
       select $1, id from identidad.roles where clave = 'administrador' and org_id is null`,
    [p],
  );
  const c = await resolverSesion(await sesionDe(p));
  assert.ok(c);
  assert.equal(c.alcance.restringido, false, 'un rol sin restricción tiene que ganar');
  assert.ok(seccionesConAlcance(c.permisos, c.alcance, esDeLaPrincipal(c)).length > 5);
});

test('el alcance NO se cachea: quitar una sección se ve en la petición siguiente', async () => {
  // Es la propiedad que hace que la restricción sirva para algo. Con la sesión cacheando, quitarle
  // una pestaña a alguien no tendría efecto hasta que volviera a entrar — que con sesiones de siete
  // días es una semana, y nadie lo reportaría porque la pestaña quitada ya no se usa.
  await limpiar();
  const p = await persona('usuario', ['closer', 'setter']);
  const token = await sesionDe(p);

  const antes = await resolverSesion(token);
  assert.ok(antes);
  assert.equal(seccionesConAlcance(antes.permisos, antes.alcance, esDeLaPrincipal(antes)).length, 2);

  await admin.query(
    `delete from identidad.usuarios_secciones where usuario_id = $1 and seccion = 'setter'`,
    [p],
  );

  const despues = await resolverSesion(token);
  assert.ok(despues);
  assert.deepEqual(
    seccionesConAlcance(despues.permisos, despues.alcance, esDeLaPrincipal(despues)).map((s) => s.clave),
    ['closer'],
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · QUE NO SEA COSMÉTICO: EL PORTERO
// ═══════════════════════════════════════════════════════════════════════════════

test('NO ES COSMÉTICO: una sección no concedida se RECHAZA en el portero', async () => {
  // La prueba que sostiene todo lo demás. Sin esto, la lista de casillas esconde pestañas y una
  // petición a mano funciona igual — el defecto que este repositorio ya pagó dos veces.
  await limpiar();
  const p = await persona('usuario', ['closer']);
  const token = await sesionDe(p);

  // La sección concedida pasa, y la capacidad es la misma en las dos.
  const suya = await exigir(pedir('/api/closer/mi-dia', token), ['closer.ver'], 'closer');
  assert.ok(!(suya instanceof Response), 'la sección concedida tendría que pasar');

  // La NO concedida se rechaza, aunque el rol tenga la capacidad.
  const ajena = await exigir(pedir('/api/setter/contactos', token), ['setter.ver'], 'setter');
  assert.ok(ajena instanceof Response, 'una sección no concedida tendría que rechazarse');
  assert.equal(ajena.status, 403);
  const cuerpo = (await ajena.json()) as { codigo?: string };
  assert.equal(
    cuerpo.codigo,
    'seccion_no_concedida',
    'el código tiene que ser propio: `sin_permiso` manda a mirar el catálogo de roles, y acá el rol' +
      ' tiene la capacidad',
  );
});

test('el rechazo por sección se AUDITA con su propia acción y su propio campo', async () => {
  // No reusa `permiso_denegado` porque esa señal agrupa por capacidad, y acá no hay capacidad que
  // culpar: la persona la tiene. Una señal que agrupe por sección contesta otra pregunta.
  await limpiar();
  const p = await persona('usuario', ['closer']);
  const token = await sesionDe(p);
  await admin.query('delete from identidad.auditoria_accesos where usuario_id = $1', [p]);

  await exigir(pedir('/api/setter/contactos', token), ['setter.ver'], 'setter');

  const registro = await filas<{ accion: string; detalle: { seccion?: string } }>(
    admin,
    'select accion, detalle from identidad.auditoria_accesos where usuario_id = $1',
    [p],
  );
  assert.equal(registro.length, 1, 'el rechazo por sección no quedó registrado');
  assert.equal(registro[0]?.accion, 'seccion_denegada');
  assert.equal(registro[0]?.detalle?.seccion, 'setter', 'falta la sección en el detalle');
});

test('un rol NO restringido pasa a cualquier sección que su capacidad habilite', async () => {
  // La mitad complementaria: sin ella, una implementación que rechaza siempre pasaría la de arriba.
  await limpiar();
  const p = await persona('administrador');
  const token = await sesionDe(p);
  for (const [camino, cap, pantalla] of [
    ['/api/closer/mi-dia', 'closer.ver', 'closer'],
    ['/api/setter/contactos', 'setter.ver', 'setter'],
  ] as const) {
    const r = await exigir(pedir(camino, token), [cap], pantalla);
    assert.ok(!(r instanceof Response), `un administrador fue rechazado en ${pantalla}`);
  }
});

test('EL ANTI-ENCIERRO: una persona SIN ninguna sección puede cambiar su contraseña', async () => {
  // Es la razón por la que el Paso 6 va DESPUÉS del Paso 4. Con cero secciones concedidas, si el
  // rechazo por sección ganara la carrera, esa persona no podría cambiar su contraseña temporal ni
  // configurar su segundo factor — o sea, quedaría encerrada necesitando un administrador.
  await limpiar();
  const p = await persona('usuario');
  await admin.query('update identidad.usuarios set debe_cambiar_password = true where id = $1', [p]);
  const token = await sesionDe(p);
  await admin.query(
    `update identidad.sesiones set estado = 'debe_cambiar_password' where usuario_id = $1`,
    [p],
  );

  /* La salida del estado es `POST /api/auth/sesion`, que es la ruta que `ESTADOS` habilita para
     `debe_cambiar_password` y que pide `NINGUNA` capacidad. `NINGUNA` se resuelve en el Paso 4 y
     vuelve **antes** del Paso 6, así que el alcance no la puede tocar. */
  const { NINGUNA } = await import('../../lib/autorizacion/capacidades.ts');
  const r = await exigir(pedir('/api/auth/sesion', token, 'POST'), NINGUNA, SIN_SECCION);
  assert.ok(!(r instanceof Response), 'la salida del estado quedó bloqueada por el alcance');

  // Y las dos del segundo factor, que son la otra salida.
  await admin.query(
    `update identidad.sesiones set estado = 'debe_configurar_2fo' where usuario_id = $1`,
    [p],
  );
  for (const camino of ['/api/auth/2fo/configurar', '/api/auth/2fo/confirmar']) {
    const r2 = await exigir(pedir(camino, token, 'POST'), NINGUNA, SIN_SECCION);
    assert.ok(!(r2 instanceof Response), `${camino} quedó bloqueada por el alcance`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LA TABLA
// ═══════════════════════════════════════════════════════════════════════════════

test('la base RECHAZA una sección que no existe', async () => {
  // El `check` no da contención —una clave inválida no concede nada, falla cerrado— sino
  // DIAGNÓSTICO: con él, renombrar una sección obliga a escribir la migración que mueve las filas.
  await limpiar();
  const p = await persona('usuario');
  await assert.rejects(
    () =>
      admin.query('insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, $2)', [
        p,
        'pantalla_inventada',
      ]),
    /usuarios_secciones_seccion_check|violates check/i,
  );
});

test('toda clave de `SECCIONES` es aceptada por el `check` de la base', async () => {
  // El cruce en la otra dirección, y se ITERA el catálogo en vez de repetir la lista: con trece
  // claves, repetirlas acá sería una segunda lista que se desincroniza — que es el defecto que
  // `secciones.ts` existe para cerrar.
  await limpiar();
  const p = await persona('usuario');
  const { SECCIONES } = await import('../../lib/autorizacion/secciones.ts');
  for (const s of SECCIONES) {
    await admin.query(
      'insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, $2)',
      [p, s.clave],
    );
  }
  const guardadas = await filas<{ n: string }>(
    admin,
    'select count(*)::text as n from identidad.usuarios_secciones where usuario_id = $1',
    [p],
  );
  assert.equal(Number(guardadas[0]?.n), SECCIONES.length, 'el `check` rechazó una clave del catálogo');
});

test('borrar a la persona se lleva su alcance', async () => {
  // Cascada, y no es preferencia: como el alta exige al menos una sección, sin ella TODA persona
  // nueva tendría filas y **ninguna volvería a ser borrable**.
  await limpiar();
  const p = await persona('usuario', ['closer']);
  await admin.query('delete from identidad.usuarios where id = $1', [p]);
  const quedan = await filas<{ n: string }>(
    admin,
    'select count(*)::text as n from identidad.usuarios_secciones where usuario_id = $1',
    [p],
  );
  assert.equal(Number(quedan[0]?.n), 0);
});

test('el rol del inquilino NO puede leer el alcance, y falla FUERTE', async () => {
  // Sin `grant`, el inquilino recibe «permission denied» en vez de un vacío. Un vacío se leería como
  // «esta persona no tiene restricciones», que es el peor error posible acá.
  const inquilino = await conectar('inquilino');
  try {
    await assert.rejects(
      () => inquilino.query('select 1 from identidad.usuarios_secciones limit 1'),
      /permission denied/i,
    );
  } finally {
    // La conexión la cierra `cerrarTodo` del `after`.
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LOS DOS ENDPOINTS QUE ESCRIBEN EL ALCANCE
// ═══════════════════════════════════════════════════════════════════════════════

/** Una petición con cuerpo, para los endpoints de administración. */
function conCuerpo(camino: string, token: string, cuerpo: unknown, metodo = 'POST'): Request {
  return new Request(`https://${DOMINIO}${camino}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      origin: `https://${DOMINIO}`,
      cookie: `${COOKIE_SESION}=${token}`,
    },
    body: JSON.stringify(cuerpo),
  });
}

/** El token de quien puede crear personas: el rol de plataforma del sembrado. */
async function tokenDeQuienAdministra(): Promise<string> {
  const f = await unaFila<{ id: string }>(
    admin,
    `select id from identidad.usuarios where email = 'fundadora@principal.ejemplo'`,
  );
  assert.ok(f, 'falta la fundadora del sembrado');
  const token = await sesionDe(f.id);
  /* Y se la conmuta a `alfa`, que es donde viven las personas de prueba.
     `usuarioObjetivo` filtra por `orgEfectiva`, así que sin esto todas las operaciones sobre alguien
     de otra empresa responden 404 — que es exactamente lo que `ADR-0501` pide y lo que esta prueba
     NO está midiendo. Es además el camino real: el superadministrador conmuta de empresa. */
  await admin.query(
    `update identidad.sesiones set org_activa = $1 where token_hash = $2`,
    [alfa, hashDeToken(token)],
  );
  return token;
}

test('el alta con `secciones: []` se RECHAZA: cero pestañas es un estado sin salida', async () => {
  // La lista vacía es lo que hay que rechazar, y es distinta de la ausencia: ausente puede significar
  // «este rol no se restringe», y `[]` solo puede significar «que no vea nada».
  await limpiar();
  const token = await tokenDeQuienAdministra();
  const r = await crearUsuario(
    conCuerpo('/api/admin/usuarios', token, {
      nombre: MARCA,
      email: `vacio-${randomUUID().slice(0, 8)}@alfa.ejemplo`,
      orgId: alfa,
      rol: 'usuario',
      secciones: [],
    }),
  );
  assert.equal(r.status, 400, await r.clone().text());
  const cuerpo = (await r.json()) as { detalle?: string };
  assert.match(cuerpo.detalle ?? '', /al menos una/i);
});

test('el alta con una sección que el ROL no alcanza se RECHAZA', async () => {
  // `credenciales` es una sección real, así que pasa cualquier validación de lista — y el rol
  // `usuario` no tiene `credenciales.ver`, así que el resultado son CERO pestañas. Por eso la
  // validación es sobre el RESULTADO y no sobre la lista.
  await limpiar();
  const token = await tokenDeQuienAdministra();
  const r = await crearUsuario(
    conCuerpo('/api/admin/usuarios', token, {
      nombre: MARCA,
      email: `ajena-${randomUUID().slice(0, 8)}@alfa.ejemplo`,
      orgId: alfa,
      rol: 'usuario',
      secciones: ['credenciales'],
    }),
  );
  assert.equal(r.status, 400, await r.clone().text());
  const cuerpo = (await r.json()) as { detalle?: string };
  assert.match(cuerpo.detalle ?? '', /no ver[íi]a|ninguna/i);
});

test('el alta con SOLO el Panel de Monitoreo: se acepta en ARIA y se RECHAZA en un cliente', async () => {
  /* ══════════════════════════════════════════════════════════════════════════
     EL AGUJERO QUE ABRIÓ EL RETIRO DEL ROL `monitoreo`, Y QUE ANTES NO PODÍA EXISTIR

     `monitoreo` es la única sección con `soloDesdeLaPrincipal`: no existe para quien no vive en la
     organización principal. Hasta el retiro de su rol, ningún rol que restringiera por sección
     tenía su capacidad, así que nadie podía concederla como alcance y esto era inalcanzable.

     Ahora `usuario` la tiene, y `{rol:'usuario', secciones:['monitoreo']}` para alguien de una
     empresa cliente **pasa toda validación de lista** —la sección existe, el rol la alcanza— y
     produce CERO pestañas. Es literalmente lo que `alcance_vacio` existe para impedir, por un eje
     nuevo: la comprobación pasaba `true` fijo como «desde la principal».

     Se afirman los DOS lados en la misma prueba a propósito. Solo con el rechazo, la corrección
     más simple que la hace pasar es rechazar `monitoreo` siempre — y eso rompería el caso real,
     que es el único motivo por el que el rol se retiró.
     ══════════════════════════════════════════════════════════════════════════ */
  await limpiar();
  const token = await tokenDeQuienAdministra();

  // 1 · En ARIA sí: es exactamente para lo que se hizo el cambio.
  const enLaPrincipal = await crearUsuario(
    conCuerpo('/api/admin/usuarios', token, {
      nombre: MARCA,
      email: `mon-si-${randomUUID().slice(0, 8)}@alfa.ejemplo`,
      orgId: principal,
      rol: 'usuario',
      secciones: ['monitoreo'],
    }),
  );
  assert.equal(enLaPrincipal.status, 201, await enLaPrincipal.clone().text());

  /* Y que la fila se haya guardado, no solo que la respuesta diga 201. Sin esto, un `insert` que
     no corre pasa igual — y el síntoma sería una persona con la casilla tildada y sin la pestaña. */
  const guardadas = await filas<{ seccion: string }>(
    admin,
    `select us.seccion from identidad.usuarios_secciones us
       join identidad.usuarios u on u.id = us.usuario_id
      where u.nombre = $1 and u.org_id = $2`,
    [MARCA, principal],
  );
  assert.deepEqual(
    guardadas.map((f) => f.seccion),
    ['monitoreo'],
  );

  // 2 · En una empresa cliente no: esa persona no vería NINGUNA pestaña.
  const enUnCliente = await crearUsuario(
    conCuerpo('/api/admin/usuarios', token, {
      nombre: MARCA,
      email: `mon-no-${randomUUID().slice(0, 8)}@alfa.ejemplo`,
      orgId: alfa,
      rol: 'usuario',
      secciones: ['monitoreo'],
    }),
  );
  assert.equal(enUnCliente.status, 400, await enUnCliente.clone().text());
  const cuerpo = (await enUnCliente.json()) as { detalle?: string };
  assert.match(cuerpo.detalle ?? '', /no ver[íi]a|ninguna/i);

  /* ── Y LA OTRA PUERTA, QUE ES LA MISMA COMPROBACIÓN EN OTRO ARCHIVO ──────
   *
   * `POST /api/admin/usuarios/{id}/roles` tiene su propia copia de esta validación. Sin medirla,
   * arreglar el alta y olvidarse del cambio de rol pasa en verde: alguien de una empresa cliente
   * queda degradado a `usuario` con solo esta pestaña, y su menú queda vacío.
   *
   * Acá el dato sale del contexto —`usuarioObjetivo(` filtra por la organización efectiva— y la
   * sesión está conmutada a `alfa`, así que la persona es de un cliente por construcción. */
  const deUnCliente = await persona('administrador');
  const degradar = await asignarRoles(
    conCuerpo(`/api/admin/usuarios/${deUnCliente}/roles`, token, {
      roles: ['usuario'],
      secciones: ['monitoreo'],
    }),
    { params: Promise.resolve({ id: deUnCliente }) },
  );
  assert.equal(degradar.status, 400, await degradar.clone().text());
  assert.equal(((await degradar.json()) as { motivo?: string }).motivo, 'alcance_vacio');

  // Y el rol NO cambió: se rechaza antes de tocar nada, igual que sin secciones.
  const roles = await filas<{ clave: string }>(
    admin,
    `select r.clave from identidad.usuarios_roles ur
       join identidad.roles r on r.id = ur.rol_id where ur.usuario_id = $1`,
    [deUnCliente],
  );
  assert.deepEqual(roles.map((x) => x.clave), ['administrador']);
});

test('PROMOVER a un rol sin restricción BORRA el alcance viejo', async () => {
  // No es seguridad —las filas ya se ignoran— es higiene: sin el borrado, promover y volver a
  // degradar **resucita** un alcance que nadie eligió.
  await limpiar();
  const p = await persona('usuario', ['closer']);
  const token = await tokenDeQuienAdministra();

  const r = await asignarRoles(
    conCuerpo(`/api/admin/usuarios/${p}/roles`, token, { roles: ['administrador'] }),
    { params: Promise.resolve({ id: p }) },
  );
  assert.equal(r.status, 200, await r.clone().text());

  const quedan = await filas<{ n: string }>(
    admin,
    'select count(*)::text as n from identidad.usuarios_secciones where usuario_id = $1',
    [p],
  );
  assert.equal(Number(quedan[0]?.n), 0, 'el alcance viejo sobrevivió a la promoción');
});

test('DEGRADAR a un rol restringido SIN pasar secciones se RECHAZA, y el rol no cambia', async () => {
  // Es el camino exacto que hacía fallar abierto el primer diseño: reemplazaba los roles y dejaba
  // cero filas, que con esa semántica se leía como «sin restricción».
  await limpiar();
  const p = await persona('administrador');
  const token = await tokenDeQuienAdministra();

  const sinSecciones = await asignarRoles(
    conCuerpo(`/api/admin/usuarios/${p}/roles`, token, { roles: ['usuario'] }),
    { params: Promise.resolve({ id: p }) },
  );
  assert.equal(sinSecciones.status, 400, await sinSecciones.clone().text());
  const cuerpo = (await sinSecciones.json()) as { motivo?: string };
  assert.equal(cuerpo.motivo, 'sin_secciones');

  // El rol NO cambió: se rechaza antes de tocar nada.
  const roles = await filas<{ clave: string }>(
    admin,
    `select r.clave from identidad.usuarios_roles ur
       join identidad.roles r on r.id = ur.rol_id where ur.usuario_id = $1`,
    [p],
  );
  assert.deepEqual(
    roles.map((x) => x.clave),
    ['administrador'],
    'el rol cambió aunque el alcance se rechazó: quedó restringido y sin pestañas',
  );

  // Y con secciones sí, en la misma operación.
  const conSecciones = await asignarRoles(
    conCuerpo(`/api/admin/usuarios/${p}/roles`, token, {
      roles: ['usuario'],
      secciones: ['closer', 'contacts'],
    }),
    { params: Promise.resolve({ id: p }) },
  );
  assert.equal(conSecciones.status, 200, await conSecciones.clone().text());
  const ahora = await filas<{ seccion: string }>(
    admin,
    'select seccion from identidad.usuarios_secciones where usuario_id = $1 order by seccion',
    [p],
  );
  assert.deepEqual(
    ahora.map((x) => x.seccion),
    ['closer', 'contacts'],
  );
});


// ═══════════════════════════════════════════════════════════════════════════════
// 8 · EL LISTADO TIENE QUE TRAER EL ALCANCE, O LA EDICIÓN NO PUEDE MANDARLO
// ═══════════════════════════════════════════════════════════════════════════════

test('el listado trae las secciones de cada persona, y `[]` cuando no tiene', async () => {
  // `POST .../roles` REEMPLAZA roles y alcance juntos. Sin este dato en el listado, la pantalla de
  // edición no tenía de dónde sacar el conjunto actual, así que el panel no podía mandarlo — y la
  // prueba de acá arriba dice qué pasa cuando no se manda: 400 `sin_secciones`. O sea que pasar a
  // alguien al rol `usuario` desde la interfaz era IMPOSIBLE, no incómodo.
  //
  // `[]` y no `null` por lo mismo que los roles: el nulo obliga a cada consumidor a acordarse, y el
  // que se olvide dibuja «undefined» donde tendría que decir que no tiene ninguna.
  await limpiar();
  const conAlcance = await persona('usuario', ['closer', 'tools']);
  const sinAlcance = await persona('administrador');

  const listado = await conIdentidad((db) => personasQuePuedeAdministrar(db, alfa, false));
  const a = listado.find((p) => p.id === conAlcance);
  const b = listado.find((p) => p.id === sinAlcance);
  assert.ok(a && b, 'las dos personas tienen que estar en el listado');
  assert.deepEqual([...a.secciones].sort(), ['closer', 'tools']);
  assert.deepEqual(b.secciones, [], 'sin filas de alcance tiene que ser una lista vacía');
});

test('CAMBIAR solo las pestañas, sin tocar el rol, reemplaza el conjunto', async () => {
  // El camino que la pantalla de edición usa ahora: mismo rol, otra lista. Es un REEMPLAZO y no una
  // suma — lo que se destilda se quita — y eso hay que poder comprobarlo, porque es la diferencia
  // entre «le saqué Tools» y «no pasó nada».
  await limpiar();
  const p = await persona('usuario', ['closer', 'tools']);
  const token = await tokenDeQuienAdministra();

  const r = await asignarRoles(
    conCuerpo(`/api/admin/usuarios/${p}/roles`, token, {
      roles: ['usuario'],
      secciones: ['closer'],
    }),
    { params: Promise.resolve({ id: p }) },
  );
  assert.equal(r.status, 200, await r.clone().text());

  const ahora = await filas<{ seccion: string }>(
    admin,
    'select seccion from identidad.usuarios_secciones where usuario_id = $1 order by seccion',
    [p],
  );
  assert.deepEqual(
    ahora.map((x) => x.seccion),
    ['closer'],
    'destildar una pestaña no se la quitó: el POST tiene que reemplazar el conjunto',
  );
});
