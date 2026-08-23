// ADR-0401 — El mensaje único va con el tiempo único.
// ADR-0402 — El freno por intentos no se evade.
// ADR-0403 — La búsqueda usa la misma expresión que el índice único.
// ADR-0404 — La sesión tiene techo absoluto.
// ADR-0405 — La cookie lleva el prefijo y los atributos.
// ADR-0413 — Un usuario con un rol que exige segundo factor no obtiene sesión habilitada.
//            INNEGOCIABLE.
// Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL LOGIN, CONTRA LA BASE
//
// Se llama al manejador de ruta directamente, con una `Request` armada a mano. Es lo mismo
// que hace la plataforma y no necesita servidor: un manejador de ruta es una función de
// `Request` a `Response`.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import { POST as login } from '../../app/api/auth/login/route.ts';
import type { Client } from 'pg';
import { conIdentidad, cerrarClientes } from '../../lib/datos/capa.ts';
import { conectar, cerrarTodo } from '../apoyo/conexiones.ts';
import { hashear } from '../../lib/datos/hash.ts';
import { COOKIE_SESION } from '../../lib/autorizacion/sesion.ts';
import { exigir, NINGUNA } from '../../lib/autorizacion/portero.ts';
import type { Exigencia } from '../../lib/autorizacion/capacidades.ts';
import { ESTADOS } from '../../lib/autorizacion/estados.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { TOPE_POR_CUENTA, TOPE_POR_ORIGEN } from '../../lib/autenticacion/freno.ts';

const DOMINIO = 'ejemplo.test';
const CABECERA_IP = 'x-real-ip';
const PASSWORD = 'una-contrasena-de-prueba-larga';

/**
 * Una dirección de origen NUEVA en cada corrida. No es cosmético: es la única forma de que
 * el freno por origen cuente solo lo de esta corrida.
 *
 * `identidad.auditoria_accesos` es de SOLO INSERCIÓN, y no por permisos: el disparador
 * `identidad.evitar_mutacion()` de la migración 005 rechaza el `DELETE` **incluso al
 * superusuario** —*"La tabla auditoria_accesos es de solo inserción"*—. Así que no hay
 * limpieza posible, y una dirección fija haría que la segunda corrida de la suite arrancara ya
 * frenada, con quince minutos de espera para volver a poder correrla.
 *
 * La columna `ip` es `text`, así que el valor no tiene que parecer una dirección. Se usa un
 * prefijo distintivo para que nadie lo confunda con tráfico real al leer la auditoría.
 */
const CORRIDA = randomBytes(4).toString('hex');
const ip = (etiqueta: string) => `prueba-${CORRIDA}-${etiqueta}`;

/**
 * El superusuario, solo para armar y desarmar los fixtures.
 *
 * Nótese que la auditoría **no se limpia nunca**, y no por falta de ganas: la tabla es
 * inmutable de verdad. La migración 005 otorga solo `insert, select` a los dos roles de la
 * aplicación —*"y NUNCA `update` ni `delete`, para NADIE"*— y además tiene un disparador,
 * `identidad.evitar_mutacion()`, que rechaza el `DELETE` **incluso al superusuario**. Las dos
 * cosas se descubrieron corriendo esto: primero un `42501` desde `app_identidad`, después
 * *"La tabla auditoria_accesos es de solo inserción"* desde `postgres`.
 *
 * Por eso el freno por origen se prueba con una dirección nueva en cada corrida, y no
 * borrando filas.
 */
let admin: Client;

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  process.env.CABECERA_DIRECCION_REAL = CABECERA_IP;
  admin = await conectar('admin');
});

/**
 * Borra un usuario de prueba y lo que cuelga de él. Por el superusuario.
 *
 * NO borra sus filas de auditoría, y no hace falta: `auditoria_accesos.usuario_id` es un
 * `uuid` **sin clave foránea**, a propósito. El registro de accesos sobrevive al usuario, que
 * es lo que se espera de un registro de accesos.
 */
async function borrarUsuarioPorEmail(email: string): Promise<void> {
  await admin.query(
    `with objetivo as (select id from identidad.usuarios where lower(email) = lower($1)),
          s as (delete from identidad.sesiones where usuario_id in (select id from objetivo)),
          r as (delete from identidad.usuarios_roles where usuario_id in (select id from objetivo))
     delete from identidad.usuarios where id in (select id from objetivo)`,
    [email],
  );
}

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

function peticion(
  cuerpo: unknown,
  opciones: { ip?: string; falsificada?: string; origen?: string | null } = {},
): Request {
  const cabeceras = new Headers({ 'content-type': 'application/json' });
  if (opciones.origen !== null) cabeceras.set('origin', opciones.origen ?? `https://${DOMINIO}`);
  if (opciones.ip) cabeceras.set(CABECERA_IP, opciones.ip);
  // La cabecera que el CLIENTE controla. Nunca se lee.
  if (opciones.falsificada) cabeceras.set('x-forwarded-for', opciones.falsificada);
  return new Request(`https://${DOMINIO}/api/auth/login`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify(cuerpo),
  });
}

async function cuerpoDe(r: Response): Promise<Record<string, unknown>> {
  return (await r.clone().json()) as Record<string, unknown>;
}

/** Crea un usuario de prueba y devuelve una función para borrarlo. */
async function usuarioDePrueba(opciones: {
  email: string;
  password?: string;
  activo?: boolean;
  debeCambiarPassword?: boolean;
  rolClave?: string;
  /**
   * La organización. Por omisión `alfa`, un cliente.
   *
   * Para los roles `solo_principal` TIENE que ser `principal`, y eso no es un detalle del
   * fixture: lo hace cumplir un disparador de la Etapa 1. La primera versión de estas pruebas
   * asignaba `superadministrador` a un usuario de alfa y la base contestó *"Ese rol solo
   * existe en la organización principal"* — que es exactamente la invariante que la Etapa 1
   * escribió contra la escalada entre inquilinos, atrapando un error de la prueba.
   */
  orgSlug?: string;
}): Promise<{ id: string; orgId: string; limpiar: () => Promise<void> }> {
  // IDEMPOTENTE A PROPÓSITO. Una corrida que falla a mitad de camino deja usuarios sembrados,
  // y la siguiente moría con `duplicate key value violates unique constraint
  // "usuarios_email_unico"` — o sea que el diagnóstico dejaba de ser el defecto original y
  // pasaba a ser el residuo. Borrar antes de crear rompe esa cadena.
  await borrarUsuarioPorEmail(opciones.email);

  return conIdentidad(async (db) => {
    const org = await db
      .selectFrom('organizaciones')
      .select('id')
      .where('slug', '=', opciones.orgSlug ?? 'alfa')
      .executeTakeFirstOrThrow();
    const u = await db
      .insertInto('usuarios')
      .values({
        org_id: org.id,
        nombre: 'Usuario de prueba',
        email: opciones.email,
        password_hash: hashear(opciones.password ?? PASSWORD),
        activo: opciones.activo ?? true,
        debe_cambiar_password: opciones.debeCambiarPassword ?? false,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    if (opciones.rolClave) {
      const rol = await db
        .selectFrom('roles')
        .select('id')
        .where('clave', '=', opciones.rolClave)
        .executeTakeFirstOrThrow();
      await db.insertInto('usuarios_roles').values({ usuario_id: u.id, rol_id: rol.id }).execute();
    }

    return {
      id: u.id,
      orgId: org.id,
      // Por el superusuario, y no por `conIdentidad`: `app_identidad` tiene `insert`,
      // `select` y `update` sobre `identidad.usuarios` pero **no `delete`**. No es un olvido
      // de la migración: un usuario se DESACTIVA, no se borra (05 § 6), así que el rol de la
      // aplicación no tiene por qué poder borrarlo. La primera corrida de esto lo demostró
      // con un `42501`.
      limpiar: async () => borrarUsuarioPorEmail(opciones.email),
    };
  });
}

// ─── ADR-0403 · la misma expresión que el índice ────────────────────────────

test('ADR-0403 · un usuario guardado con MAYÚSCULAS puede entrar', async () => {
  // La otra mitad de la fila. El `07` § 3: *"si el índice es `unique (lower(email))` y el
  // login busca `where email = $1`, funciona SOLO mientras todos los caminos guarden en
  // minúsculas. El día que una carga manual, una migración o un script meta una mayúscula,
  // esa persona NO PUEDE ENTRAR y el mensaje dice 'credenciales inválidas'."*
  const u = await usuarioDePrueba({ email: 'MaYuScUlAs@Alfa.Ejemplo' });
  try {
    // Se intenta con el correo en minúsculas, que es como lo va a escribir la persona.
    const r = await login(peticion({ email: 'mayusculas@alfa.ejemplo', password: PASSWORD }));
    assert.equal(r.status, 200, `no pudo entrar: ${JSON.stringify(await cuerpoDe(r))}`);

    // Y al revés: guardado en minúsculas, se entra con mayúsculas.
    const r2 = await login(peticion({ email: 'MAYUSCULAS@ALFA.EJEMPLO', password: PASSWORD }));
    assert.equal(r2.status, 200);
  } finally {
    await u.limpiar();
  }
});

// ─── ADR-0405 · la cookie ───────────────────────────────────────────────────

test('ADR-0405 · la respuesta trae el prefijo y los CUATRO atributos', async () => {
  const u = await usuarioDePrueba({ email: 'cookie@alfa.ejemplo' });
  try {
    const r = await login(peticion({ email: 'cookie@alfa.ejemplo', password: PASSWORD }));
    assert.equal(r.status, 200);
    const cookie = r.headers.get('set-cookie');
    assert.ok(cookie, 'el login no emitió ninguna cookie');

    assert.match(cookie, new RegExp(`^${COOKIE_SESION}=`), 'falta el prefijo __Host-');
    // Los tres que NO tienen valor por omisión. `Path=/` lo agregaría el serializador del
    // framework aunque el código no lo pasara nunca, así que verificarlo en la respuesta no
    // demuestra nada sobre el código — pero acá la cookie se serializa a mano, así que sí.
    assert.match(cookie, /HttpOnly/, 'falta HttpOnly');
    assert.match(cookie, /Secure/, 'falta Secure: el navegador RECHAZA la cookie __Host- sin él');
    assert.match(cookie, /SameSite=Lax/, 'falta SameSite');
    assert.match(cookie, /Path=\//, 'falta Path=/');
    // Y NUNCA `Domain`: con el prefijo `__Host-` el navegador rechaza la cookie si lo declara.
    assert.doesNotMatch(cookie, /Domain=/i, '`Domain` hace que el navegador rechace la cookie');
    // Sin plazo: el 08 § 5.2 la escribe sin `Expires`. El único reloj es el de la base.
    assert.doesNotMatch(cookie, /Max-Age=|Expires=/i, 'la cookie de sesión no lleva plazo');

    // Y el token NO está en el cuerpo. Solo en la cookie.
    const cuerpo = await cuerpoDe(r);
    assert.ok(!('token' in cuerpo), 'el token no se devuelve en el cuerpo');
  } finally {
    await u.limpiar();
  }
});

// ─── ADR-0413 · el segundo factor obligatorio ───────────────────────────────
test('ADR-0413 · RETIRADA · un rol de plataforma SIN factor configurado entra directo', async () => {
  // ═════════════════════════════════════════════════════════════════════════
  // ESTA FILA SE RETIRÓ. LA PRUEBA SE DA VUELTA, NO SE BORRA.
  //
  // `ADR-0413` decía: *"un usuario con un rol que exige segundo factor no obtiene sesión
  // habilitada. INNEGOCIABLE"*. La rama 3 de `lib/autenticacion/estado.ts` la hacía cumplir y
  // se quitó a pedido explícito de quien decide el producto.
  //
  // Lo que se acepta está escrito en la migración 010 y en `estado.ts`. En una línea: contra
  // adivinar la contraseña no cambia nada —el freno por cuenta corta a los cinco intentos, el
  // de origen a los veinte— y contra una contraseña YA filtrada el segundo factor era lo único
  // que quedaba.
  //
  // La prueba invertida existe para que reponer la rama la haga fallar: una invariante que se
  // retira sin dejar rastro es una que nadie sabe que se fue.
  // ═════════════════════════════════════════════════════════════════════════
  const u = await usuarioDePrueba({
    email: 'plataforma@principal.ejemplo',
    rolClave: 'superadministrador',
    orgSlug: 'principal',
  });
  try {
    const r = await login(peticion({ email: 'plataforma@principal.ejemplo', password: PASSWORD }));
    assert.equal(r.status, 200);
    const cuerpo = await cuerpoDe(r);
    assert.equal(
      cuerpo.estado,
      'activa',
      'el segundo factor volvió a ser obligatorio: si es a propósito, esta prueba tiene que ' +
        'volver a su forma anterior junto con la rama 3 de lib/autenticacion/estado.ts',
    );

    // Y el portero DEJA PASAR. Es la otra mitad, y la que de verdad cambió: antes cortaba con
    // `debe_configurar_2fo`. Sin esta afirmación, un estado `activa` que el portero rechazara
    // por otro motivo pasaría la de arriba.
    const cookie = r.headers.get('set-cookie') ?? '';
    const token = /__Host-sesion=([^;]+)/.exec(cookie)?.[1] ?? '';
    const conSesion = new Request(`https://${DOMINIO}/api/usuarios`, {
      headers: { cookie: `${COOKIE_SESION}=${token}` },
    });
    const contexto = await exigir(conSesion, ['usuarios.ver']);
    assert.ok(
      !(contexto instanceof Response),
      `el portero cortó una sesión que tiene que estar habilitada: ${
        contexto instanceof Response ? JSON.stringify(await contexto.json()) : ''
      }`,
    );
  } finally {
    await u.limpiar();
  }
});

test('ADR-0413 · LO QUE SIGUE EN PIE · con el factor YA confirmado, el login NO habilita', async () => {
  // LA MITAD QUE NO SE RETIRÓ, y la razón por la que "opcional" no significa "no existe".
  //
  // Activar el segundo factor es opcional; cumplirlo, una vez activado, no lo es. La rama 1 de
  // `estadoQueCorresponde` no se tocó: un factor confirmado y sin verificar en ESTA sesión
  // devuelve `pendiente_2fo`, y el portero corta.
  //
  // Sin esta prueba, alguien podría "simplificar" la rama 1 junto con la 3 y el sistema
  // quedaría con las rutas del segundo factor intactas, sin que nadie las cumpla — el peor de
  // los dos mundos, porque la pantalla diría que está protegido.
  const u = await usuarioDePrueba({
    email: 'confactor@principal.ejemplo',
    rolClave: 'superadministrador',
    orgSlug: 'principal',
  });
  try {
    // El factor, confirmado a mano: lo que importa acá es el ESTADO de la fila, no cómo llegó.
    // El recorrido de alta tiene su propia prueba en `43-segundo-factor.test.ts`.
    await admin.query(
      `insert into identidad.usuarios_segundo_factor (usuario_id, secreto_cifrado, confirmado_el)
       values ($1, $2, now())`,
      [u.id, cifrar('JBSWY3DPEHPK3PXP')],
    );

    const r = await login(peticion({ email: 'confactor@principal.ejemplo', password: PASSWORD }));
    assert.equal(r.status, 200, 'el login tiene que tener éxito: lo que cambia es el ESTADO');
    assert.equal(
      (await cuerpoDe(r)).estado,
      'pendiente_2fo',
      'un factor confirmado dejó de exigirse: eso NO es parte de lo que se retiró',
    );

    const cookie = r.headers.get('set-cookie') ?? '';
    const token = /__Host-sesion=([^;]+)/.exec(cookie)?.[1] ?? '';
    const corte = await exigir(
      new Request(`https://${DOMINIO}/api/usuarios`, {
        headers: { cookie: `${COOKIE_SESION}=${token}` },
      }),
      ['usuarios.ver'],
    );
    assert.ok(corte instanceof Response, 'el portero dejó pasar una sesión sin verificar el factor');
    assert.equal(corte.status, 403);
    assert.equal((await corte.json()).codigo, 'pendiente_2fo');
  } finally {
    await admin.query('delete from identidad.usuarios_segundo_factor where usuario_id = $1', [u.id]);
    await u.limpiar();
  }
});

test('ADR-0413 · el ORDEN de las ramas: la contraseña temporal gana sobre configurar 2FO', async () => {
  // El error que el `09` § 5 llama *"el que casi siempre se pone al revés, con el argumento
  // razonable de que 'el segundo factor prueba quién es y va primero'"*.
  //
  // La consecuencia real de invertirlo: la contraseña temporal **la conoce quien creó la
  // cuenta**, así que dejar configurar el segundo factor primero le permitiría a esa persona
  // inscribir SU dispositivo en la cuenta de otro. Nada falla.
  const u = await usuarioDePrueba({
    email: 'ambos@principal.ejemplo',
    debeCambiarPassword: true,
    rolClave: 'superadministrador',
    orgSlug: 'principal',
  });
  try {
    const r = await login(peticion({ email: 'ambos@principal.ejemplo', password: PASSWORD }));
    const cuerpo = await cuerpoDe(r);
    assert.equal(
      cuerpo.estado,
      'debe_cambiar_password',
      'con contraseña temporal Y segundo factor sin configurar, gana la contraseña temporal',
    );
  } finally {
    await u.limpiar();
  }
});

// ─── ADR-0404 · el techo absoluto de una sesión a medio autenticar ──────────

test('ADR-0404 · `debe_configurar_2fo` lleva el vencimiento NORMAL, no cinco minutos', async () => {
  // Esta prueba nació afirmando lo contrario, y al releer el `02` § 2 quedó claro que el
  // código estaba mal:
  //
  //   "Los otros dos estados restringidos —contraseña temporal y segundo factor por
  //    configurar— SÍ llevan el vencimiento normal: ahí la identidad YA ESTÁ PROBADA, lo que
  //    falta es un trámite."
  //
  // Cinco minutos son SOLO para `pendiente_2fo`, que es *"una fila de sesión que existe sin
  // haber probado la identidad completa"*. Cortar los otros dos a cinco minutos le vence la
  // sesión a alguien mientras elige una contraseña nueva.
  //
  // ── Y POR QUÉ AHORA MIDE `debe_cambiar_password` Y NO `debe_configurar_2fo` ──
  //
  // Medía el segundo, y ese estado dejó de ser alcanzable desde el login cuando el segundo
  // factor pasó a ser opcional (migración 010). El estado cambia; **la propiedad que la fila
  // afirma no**: un estado restringido donde la identidad YA está probada lleva el plazo normal.
  // De los tres estados restringidos, el único que hoy se alcanza y cumple esa condición es la
  // contraseña temporal, así que la prueba se muda ahí en vez de borrarse.
  const u = await usuarioDePrueba({
    email: 'plazos@principal.ejemplo',
    debeCambiarPassword: true,
    orgSlug: 'principal',
  });
  try {
    await login(peticion({ email: 'plazos@principal.ejemplo', password: PASSWORD }));
    const s = await conIdentidad(async (db) =>
      db
        .selectFrom('sesiones')
        .select((eb) => [
          'estado',
          sql<number>`extract(epoch from (expira_el - now()))`.as('faltan_el'),
          sql<number>`extract(epoch from (expira_absoluto - now()))`.as('faltan_absoluto'),
        ])
        .where('usuario_id', '=', u.id)
        .executeTakeFirstOrThrow(),
    );
    assert.equal(s.estado, 'debe_cambiar_password');
    assert.ok(
      Number(s.faltan_el) > 6 * 24 * 3600,
      `expira_el a ${s.faltan_el}s: la identidad ya está probada, el plazo es el normal`,
    );
    // El techo absoluto también es el normal, y no los cinco minutos. Sin esta mitad, un login
    // que pusiera el plazo bien y el techo corto le vencería la sesión a alguien mientras elige
    // su contraseña — el síntoma exacto que la fila existe para impedir.
    assert.ok(
      Number(s.faltan_absoluto) > 6 * 24 * 3600,
      `expira_absoluto a ${s.faltan_absoluto}s: tendría que ser el techo normal`,
    );
  } finally {
    await u.limpiar();
  }
});

test('ADR-0404 · una sesión HABILITADA nace con siete días y techo de treinta', async () => {
  // La guarda de la de arriba: sin ésta, un login que pusiera cinco minutos a TODAS las
  // sesiones pasaría la anterior y haría el sistema inusable.
  const u = await usuarioDePrueba({ email: 'normal@alfa.ejemplo' });
  try {
    await login(peticion({ email: 'normal@alfa.ejemplo', password: PASSWORD }));
    const s = await conIdentidad(async (db) =>
      db
        .selectFrom('sesiones')
        .select((eb) => [
          'estado',
          sql<number>`extract(epoch from (expira_el - now()))`.as('faltan_el'),
          sql<number>`extract(epoch from (expira_absoluto - now()))`.as('faltan_absoluto'),
        ])
        .where('usuario_id', '=', u.id)
        .executeTakeFirstOrThrow(),
    );
    assert.equal(s.estado, 'activa');
    assert.ok(Number(s.faltan_el) > 6 * 24 * 3600, `expira_el a ${s.faltan_el}s`);
    assert.ok(Number(s.faltan_absoluto) > 29 * 24 * 3600, `techo a ${s.faltan_absoluto}s`);
  } finally {
    await u.limpiar();
  }
});

// ─── ADR-0402 · el freno ────────────────────────────────────────────────────

test('ADR-0402 · el freno POR CUENTA bloquea al quinto intento, y lo dice', async () => {
  const u = await usuarioDePrueba({ email: 'freno@alfa.ejemplo' });
  try {
    for (let i = 0; i < TOPE_POR_CUENTA; i++) {
      const r = await login(
        peticion({ email: 'freno@alfa.ejemplo', password: 'mal' }, { ip: ip('cuenta') }),
      );
      assert.equal(r.status, 401, `el intento ${i + 1} tendría que ser 401`);
    }
    // El sexto: bloqueado. Y ACÁ SE ROMPE EL MENSAJE ÚNICO A PROPÓSITO — el `02` § 4:
    // *"quien llegó hasta ahí ya sabe que la cuenta existe, porque la bloqueó él. Ocultarlo
    // solo confunde al dueño legítimo, que necesita saber que tiene que esperar."*
    const bloqueado = await login(
      peticion({ email: 'freno@alfa.ejemplo', password: PASSWORD }, { ip: ip('cuenta') }),
    );
    assert.equal(bloqueado.status, 429);
    assert.equal((await cuerpoDe(bloqueado)).codigo, 'cuenta_bloqueada');
    // Y la contraseña CORRECTA tampoco entra mientras está bloqueada.
    assert.notEqual(bloqueado.status, 200);
  } finally {
    await u.limpiar();
  }
});

test('ADR-0402 · el contador NO vuelve a cero al bloquear', async () => {
  // El `07` § 3: *"al bloquear, si el contador vuelve a cero, cuando el bloqueo vence el
  // atacante tiene OTRA TANDA LIMPIA."* Es una decisión, y ésta la afirma.
  const u = await usuarioDePrueba({ email: 'contador@alfa.ejemplo' });
  try {
    for (let i = 0; i < TOPE_POR_CUENTA; i++) {
      await login(peticion({ email: 'contador@alfa.ejemplo', password: 'mal' }, { ip: ip('contador') }));
    }
    const f = await conIdentidad(async (db) =>
      db
        .selectFrom('usuarios')
        .select(['intentos_fallidos', 'bloqueado_hasta'])
        .where('id', '=', u.id)
        .executeTakeFirstOrThrow(),
    );
    assert.equal(f.intentos_fallidos, TOPE_POR_CUENTA, 'el contador se reinició al bloquear');
    assert.ok(f.bloqueado_hasta, 'no se puso la fecha de bloqueo');
  } finally {
    await u.limpiar();
  }
});

test('ADR-0402 · un login exitoso SÍ limpia el contador y sella el último acceso', async () => {
  const u = await usuarioDePrueba({ email: 'limpia@alfa.ejemplo' });
  try {
    await login(peticion({ email: 'limpia@alfa.ejemplo', password: 'mal' }, { ip: ip('limpieza') }));
    await login(peticion({ email: 'limpia@alfa.ejemplo', password: PASSWORD }, { ip: ip('limpieza') }));
    const f = await conIdentidad(async (db) =>
      db
        .selectFrom('usuarios')
        .select(['intentos_fallidos', 'bloqueado_hasta', 'ultimo_acceso_el'])
        .where('id', '=', u.id)
        .executeTakeFirstOrThrow(),
    );
    assert.equal(f.intentos_fallidos, 0);
    assert.equal(f.bloqueado_hasta, null);
    // El `07` § 6: *"una columna 'última sincronización' que nadie actualiza es PEOR QUE NO
    // TENERLA: se lee como un hecho."*
    assert.ok(f.ultimo_acceso_el, '`ultimo_acceso_el` no se selló: se lee como un hecho y no lo es');
  } finally {
    await u.limpiar();
  }
});

test('ADR-0402 · una cabecera falsificada NO evade el freno por origen', async () => {
  // LA FILA, y el aviso que el `08` § 5.4 pone DENTRO del pseudocódigo de la prueba:
  //
  //   "Ojo con el umbral: si el freno por CUENTA salta antes que el por ORIGEN, la prueba
  //    pasa por el motivo equivocado y no verifica nada de lo que dice. Se usan cuentas
  //    DISTINTAS para que solo pueda saltar el freno por origen."
  //
  // Por eso cada intento va contra un correo inexistente distinto: no hay cuenta que
  // bloquear, así que lo único que puede saltar es el freno por dirección.
  //
  // Y la falsificación: cada intento manda un `x-forwarded-for` DISTINTO, que es lo que un
  // atacante controla. Si el freno leyera esa cabecera, cada intento contaría como una
  // dirección nueva y **nunca** se alcanzaría el tope.
  const desde = ip('origen');

  let ultimo: Response | null = null;
  for (let i = 0; i <= TOPE_POR_ORIGEN; i++) {
    ultimo = await login(
      peticion(
        { email: `inexistente${i}@ejemplo.test`, password: 'mal' },
        { ip: desde, falsificada: `1.2.3.${i}` },
      ),
    );
  }

  assert.ok(ultimo);
  assert.equal(
    ultimo.status,
    429,
    'el freno por origen no saltó: la cabecera falsificada lo evadió',
  );
  assert.equal((await cuerpoDe(ultimo)).codigo, 'demasiados_intentos');

  // Y el rechazo se registró con su PROPIA acción. Si se registrara como `login_fallido`,
  // alimentaría su propio contador y el registro dejaría de distinguir "intentó y falló" de
  // "ni lo dejamos intentar" (07 § 3).
  const acciones = await conIdentidad(async (db) =>
    db
      .selectFrom('auditoria_accesos')
      .select('accion')
      .where('ip', '=', desde)
      .where('accion', '=', 'freno_por_origen')
      .execute(),
  );
  assert.ok(acciones.length > 0, 'el rechazo por freno no se registró con su propia acción');

});

test('ADR-0402 · desde OTRA dirección el freno no aplica', async () => {
  // La guarda: sin ésta, un freno que rechazara siempre pasaría la prueba de arriba.
  const r = await login(
    peticion({ email: 'nadie@ejemplo.test', password: 'mal' }, { ip: ip('limpia') }),
  );
  assert.equal(r.status, 401, 'una dirección limpia no tiene que estar frenada');
  assert.equal((await cuerpoDe(r)).codigo, 'credenciales_invalidas');
});

// ─── ADR-0407 · lo que se registra, y lo que no ─────────────────────────────

test('ADR-0407 · la auditoría guarda el correo y el motivo, NUNCA la contraseña', async () => {
  const u = await usuarioDePrueba({ email: 'auditada@alfa.ejemplo' });
  const CONTRASENA_SECRETA = 'esta-cadena-no-puede-aparecer-en-la-auditoria';
  try {
    await login(
      peticion({ email: 'auditada@alfa.ejemplo', password: CONTRASENA_SECRETA }, { ip: ip('auditada') }),
    );
    const filas = await conIdentidad(async (db) =>
      db
        .selectFrom('auditoria_accesos')
        .select(['accion', 'detalle'])
        .where('usuario_id', '=', u.id)
        .execute(),
    );
    assert.ok(filas.length > 0, 'el intento no se registró');
    const f = filas[0];
    assert.equal(f?.accion, 'login_fallido');
    const detalle = f?.detalle as { email?: string; motivo?: string } | null;
    // El correo SÍ: la señal 4 del `10` § 2 cuenta `count(distinct detalle->>'email')` por
    // dirección, y sin él devuelve cero — que se lee como "no hay ataque".
    assert.equal(detalle?.email, 'auditada@alfa.ejemplo');
    assert.equal(detalle?.motivo, 'password');
    // Y la contraseña NO, en ningún campo. *"Un registro de contraseñas fallidas es un
    // diccionario de contraseñas reales de tus usuarios, con sus emails al lado."*
    assert.ok(
      !JSON.stringify(filas).includes(CONTRASENA_SECRETA),
      'la contraseña quedó escrita en la auditoría',
    );
  } finally {
    await u.limpiar();
  }
});

test('ADR-0407 · los tres motivos se distinguen en la auditoría y NO en la respuesta', async () => {
  // *"El motivo real sí se guarda en la auditoría, para poder investigar. La distinción
  // existe; lo que no existe es contársela a quien pregunta."* (02 § 4)
  const inactivo = await usuarioDePrueba({ email: 'inactivo@alfa.ejemplo', activo: false });
  try {
    const rInexistente = await login(
      peticion({ email: 'no-existe-nadie@ejemplo.test', password: 'x' }, { ip: ip('motivos') }),
    );
    const rInactivo = await login(
      peticion({ email: 'inactivo@alfa.ejemplo', password: PASSWORD }, { ip: ip('motivos') }),
    );

    // Las respuestas son IDÉNTICAS.
    assert.equal(rInexistente.status, rInactivo.status);
    assert.deepEqual(await cuerpoDe(rInexistente), await cuerpoDe(rInactivo));

    // Y los motivos en la auditoría son distintos.
    const motivos = await conIdentidad(async (db) =>
      db
        .selectFrom('auditoria_accesos')
        .select(sql<string>`detalle->>'motivo'`.as('motivo'))
        .where('ip', '=', ip('motivos'))
        .execute(),
    );
    const conjunto = new Set(motivos.map((m) => m.motivo));
    assert.ok(conjunto.has('email_inexistente'), `motivos vistos: ${[...conjunto].join(', ')}`);
    assert.ok(conjunto.has('cuenta_inactiva'), `motivos vistos: ${[...conjunto].join(', ')}`);
  } finally {
    await inactivo.limpiar();
  }
});

// ─── ADR-0401 · el tiempo único ─────────────────────────────────────────────

test('ADR-0401 · el correo inexistente y la contraseña incorrecta tardan LO MISMO', async () => {
  // El `07` § 3: *"responder 'no existe' al instante y 'contraseña incorrecta' 100 ms después
  // DICE EXACTAMENTE LO QUE EL MENSAJE ÚNICO VENÍA A ESCONDER. Con un cronómetro se enumeran
  // cuentas igual."*
  //
  // La tolerancia se elige MIDIENDO, no adivinando: el costo de `scrypt` con N=16384 son
  // ~100 ms, y el camino de la contraseña incorrecta hace UNA escritura más (el contador del
  // freno), que son milisegundos. Se comparan MEDIANAS de varias corridas para que una pausa
  // del recolector de basura no decida el resultado, y se admite hasta un 40 % de diferencia
  // — suficientemente ancho para no ser inestable, suficientemente angosto para detectar el
  // defecto real, que es un camino que NO deriva y termina en microsegundos.
  const u = await usuarioDePrueba({ email: 'tiempos@alfa.ejemplo' });
  const RONDAS = 7;
  try {
    const medir = async (email: string): Promise<number[]> => {
      const tiempos: number[] = [];
      for (let i = 0; i < RONDAS; i++) {
        const t = process.hrtime.bigint();
        await login(peticion({ email, password: 'contrasena-incorrecta' }, { ip: ip('tiempos') }));
        tiempos.push(Number(process.hrtime.bigint() - t) / 1e6);
      }
      return tiempos.sort((a, b) => a - b);
    };

    // El orden alternado no importa acá porque se toman medianas, pero medir el inexistente
    // primero evita que el bloqueo de la cuenta corte la segunda tanda.
    const inexistente = await medir('no-existe-nadie@ejemplo.test');
    // Se limpia el contador entre tandas para no llegar al bloqueo, que responde sin derivar.
    await conIdentidad(async (db) => {
      await db.updateTable('usuarios').set({ intentos_fallidos: 0, bloqueado_hasta: null }).where('id', '=', u.id).execute();
    });
    const malaPassword = await medir('tiempos@alfa.ejemplo');
    await conIdentidad(async (db) => {
      await db.updateTable('usuarios').set({ intentos_fallidos: 0, bloqueado_hasta: null }).where('id', '=', u.id).execute();
    });

    const mediana = (xs: number[]) => xs[Math.floor(xs.length / 2)] ?? 0;
    const a = mediana(inexistente);
    const b = mediana(malaPassword);
    const diferencia = Math.abs(a - b) / Math.max(a, b);

    // La guarda que hace que la comparación signifique algo: los DOS caminos tienen que
    // haber derivado un hash. Si los dos tardaran 2 ms, la diferencia relativa sería cero y
    // la prueba pasaría con el señuelo borrado.
    assert.ok(a > 20, `el camino del correo inexistente tardó ${a.toFixed(1)} ms: no derivó nada`);
    assert.ok(b > 20, `el camino de la contraseña mala tardó ${b.toFixed(1)} ms: no derivó nada`);

    assert.ok(
      diferencia < 0.4,
      `inexistente ${a.toFixed(1)} ms vs contraseña mala ${b.toFixed(1)} ms ` +
        `(${(diferencia * 100).toFixed(0)} % de diferencia): el canal de tiempo está abierto`,
    );
  } finally {
    await u.limpiar();
  }
});

// ─── ADR-0411 · la sesión a medio autenticar no llega a nada real ───────────

test('ADR-0411 · con una sesión pendiente, TODAS las rutas fuera de su lista rechazan', async () => {
  // Es la tercera mitad del criterio de cierre de `EJECUCION` § 5: *"una sesión en estado
  // restringido no alcanza ninguna ruta fuera de su lista."*
  //
  // Se recorren TODAS las rutas que llaman al portero, y se afirma que cada una devuelve el
  // código del ESTADO —no `sin_permiso`—, salvo las que su lista habilita. Los dos son 403 y
  // son cosas distintas: el de permiso *"se muestra muchas veces como 'no hay datos'"*, así
  // que confundirlos deja al usuario sin saber que le falta un paso (03 § 5).
  const u = await usuarioDePrueba({
    email: 'pendiente@principal.ejemplo',
    debeCambiarPassword: true,
    orgSlug: 'principal',
  });
  try {
    const r = await login(peticion({ email: 'pendiente@principal.ejemplo', password: PASSWORD }));
    const cuerpo = await cuerpoDe(r);
    assert.equal(cuerpo.estado, 'debe_cambiar_password');
    const token = /__Host-sesion=([^;]+)/.exec(r.headers.get('set-cookie') ?? '')?.[1] ?? '';
    assert.ok(token, 'el login no emitió cookie');

    const permitidas = ESTADOS['debe_cambiar_password'];
    assert.ok(permitidas, 'falta el estado');

    // Las rutas reales que llaman al portero, con su método.
    const objetivos: [string, string, Exigencia][] = [
      ['GET', '/api/usuarios', ['usuarios.ver']],
      ['GET', '/api/control', NINGUNA],
      ['PATCH', '/api/auth/sesion', ['organizaciones.listar']],
    ];

    let comprobadas = 0;
    for (const [metodo, camino, exigencia] of objetivos) {
      const ruta = `${metodo} ${camino}`;
      const p = new Request(`https://${DOMINIO}${camino}`, {
        method: metodo,
        headers: { cookie: `${COOKIE_SESION}=${token}`, origin: `https://${DOMINIO}` },
      });
      const resultado = await exigir(p, exigencia);

      if (permitidas.includes(ruta as never)) continue;

      assert.ok(resultado instanceof Response, `${ruta} dejó pasar una sesión a medio autenticar`);
      const c = (await resultado.json()) as { codigo?: string };
      assert.equal(
        c.codigo,
        'debe_cambiar_password',
        `${ruta} rechazó con "${c.codigo}" en vez del código del estado`,
      );
      comprobadas += 1;
    }

    // La guarda contra el bucle vacío: si `permitidas` habilitara todo, el bucle no
    // comprobaría nada y la prueba pasaría.
    assert.ok(comprobadas > 0, 'el bucle no comprobó ninguna ruta');

    // Y la salida SÍ funciona: `POST /api/auth/sesion` está en su lista, y no rechaza por
    // estado. Sin esta mitad, un portero que rechazara todo pasaría lo de arriba y encerraría
    // a la cuenta.
    const salida = new Request(`https://${DOMINIO}/api/auth/sesion`, {
      method: 'POST',
      headers: { cookie: `${COOKIE_SESION}=${token}`, origin: `https://${DOMINIO}` },
    });
    const puedeSalir = await exigir(salida, NINGUNA);
    assert.ok(
      !(puedeSalir instanceof Response),
      'la única salida del estado también rechaza: la cuenta queda encerrada',
    );
  } finally {
    await u.limpiar();
  }
});
