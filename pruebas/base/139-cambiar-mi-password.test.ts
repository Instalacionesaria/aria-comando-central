// Cambiar la PROPIA contraseña: las tres propiedades que nadie estaba midiendo. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO APARECE AHORA, Y NO CUANDO SE ESCRIBIÓ EL ENDPOINT
//
// `POST /api/auth/sesion` existe desde la Etapa 3 y hace cuatro cosas: verifica la contraseña
// actual, exige el largo mínimo, recalcula el estado de la sesión y **cierra todas las demás
// sesiones del usuario**. De esas cuatro, `43-segundo-factor` medía **una**: el recálculo del
// estado, porque era lo que rompía el `ADR-0413`.
//
// Las otras tres no tenían prueba, y hasta ahora eso era casi teórico: a este endpoint solo se
// llegaba desde `app/entrar/page.tsx`, o sea **con una contraseña temporal recién puesta por un
// administrador**. Un camino que recorrían las cuentas nuevas una vez y nadie más.
//
// Desde que el menú de la cuenta tiene su botón «Cambiar contraseña», lo puede usar **cualquiera,
// cuando quiera y cuantas veces quiera**. Las tres propiedades sin medir pasaron de ser un detalle
// del alta a ser el camino normal de todo el mundo, y dos de las tres son de seguridad:
//
// **1 · La contraseña ACTUAL se verifica, aunque la sesión ya esté abierta.** Sin eso, una sesión
// robada —una computadora que quedó sin bloquear, una cookie filtrada— alcanza para cambiar la
// contraseña y **quedarse con la cuenta**: el dueño queda afuera y el intruso adentro. Es la
// diferencia entre una sesión comprometida —que se cierra— y una cuenta perdida.
//
// **2 · Las demás sesiones se cierran, y SOLO las del mismo usuario.** Lo primero es el sentido de
// la operación: cambiar la contraseña es lo que hace alguien que sospecha que le entraron, y dejar
// vivas las otras sesiones lo vuelve inútil. Lo segundo es el `where` que lo acota — sin él, una
// persona cambiando su contraseña echaría del sistema a **toda la empresa**, y el síntoma sería
// «se cayó todo» sin nada que lo explique.
//
// **3 · Queda auditado.** Es la única forma de responder «¿cuándo cambió esta contraseña, y
// cambió?» después. El `ADR-0809` ya nombra el defecto general: una acción que no emite su señal
// deja un cero indistinguible de «nadie cableó el punto de emisión».
//
// Y una cuarta, que es la que hace que el botón pueda existir:
//
// **4 · NO exige ninguna capacidad** (`ADR-0406`). Un usuario sin permisos para nada tiene que
// poder cambiar su propia contraseña — si exigiera una capacidad, alguien con contraseña temporal
// y sin ella quedaría encerrado sin salida.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import type { Client } from 'pg';
import { POST as cambiarPassword } from '../../app/api/auth/sesion/route.ts';
import { POST as login } from '../../app/api/auth/login/route.ts';
import { conIdentidad, cerrarClientes } from '../../lib/datos/capa.ts';
import { conectar, cerrarTodo, filas, unaFila } from '../apoyo/conexiones.ts';
import { hashear, verificar } from '../../lib/datos/hash.ts';
import { MINIMO_PASSWORD } from '../../lib/autenticacion/politica.ts';
import { COOKIE_SESION } from '../../lib/autorizacion/sesion.ts';

const DOMINIO = 'ejemplo.test';
const PASSWORD = 'la-contrasena-de-prueba';
const EMAIL = 'cambiomipassword@principal.ejemplo';
/** Otro usuario, para comprobar que el cierre de sesiones NO se lo lleva puesto. */
const EMAIL_VECINO = 'vecinodelpassword@principal.ejemplo';

let admin: Client;

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await borrar();
});

after(async () => {
  await borrar();
  await cerrarTodo();
  await cerrarClientes();
});

async function borrar(): Promise<void> {
  await admin.query(
    `with objetivo as (select id from identidad.usuarios where lower(email) = any($1)),
          s as (delete from identidad.sesiones where usuario_id in (select id from objetivo)),
          r as (delete from identidad.usuarios_roles where usuario_id in (select id from objetivo))
     delete from identidad.usuarios where id in (select id from objetivo)`,
    [[EMAIL.toLowerCase(), EMAIL_VECINO.toLowerCase()]],
  );
}

/**
 * Crea el usuario y su vecino. **Sin ningún rol**, y es a propósito: es lo que mide el `ADR-0406`
 * —cambiar la propia contraseña no depende de ninguna capacidad— y con un rol encima esa mitad de
 * la prueba pasaría por casualidad.
 */
async function crear(): Promise<{ id: string; vecino: string }> {
  await borrar();
  return conIdentidad(async (db) => {
    const org = await db
      .selectFrom('organizaciones')
      .select('id')
      .where('slug', '=', 'principal')
      .executeTakeFirstOrThrow();
    const uno = await db
      .insertInto('usuarios')
      .values({
        org_id: org.id,
        nombre: 'Cambia su password',
        email: EMAIL,
        password_hash: hashear(PASSWORD),
        debe_cambiar_password: false,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const dos = await db
      .insertInto('usuarios')
      .values({
        org_id: org.id,
        nombre: 'El vecino',
        email: EMAIL_VECINO,
        password_hash: hashear(PASSWORD),
        debe_cambiar_password: false,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { id: uno.id, vecino: dos.id };
  });
}

/** Entra de verdad, por la ruta de login, y devuelve la cookie. */
async function entrar(): Promise<string> {
  const r = await login(
    new Request(`https://${DOMINIO}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: `https://${DOMINIO}` },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    }),
  );
  assert.equal(r.status, 200, `el login falló: ${await r.clone().text()}`);
  return /__Host-sesion=([^;]+)/.exec(r.headers.get('set-cookie') ?? '')?.[1] ?? '';
}

/** Una sesión más del usuario, escrita directo: representa otro dispositivo ya conectado. */
async function otraSesionDe(usuarioId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  await admin.query(
    `insert into identidad.sesiones (usuario_id, token_hash, estado, expira_el)
     values ($1, $2, 'activa', now() + interval '7 days')`,
    [usuarioId, createHash('sha256').update(token).digest('hex')],
  );
}

function pedido(token: string, cuerpo: unknown): Request {
  return new Request(`https://${DOMINIO}/api/auth/sesion`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: `https://${DOMINIO}`,
      cookie: `${COOKIE_SESION}=${token}`,
    },
    body: JSON.stringify(cuerpo),
  });
}

const hashDe = async (id: string) =>
  (
    await unaFila<{ password_hash: string }>(
      admin,
      'select password_hash from identidad.usuarios where id = $1',
      [id],
    )
  )?.password_hash ?? '';

const cuantasSesiones = async (id: string) =>
  Number(
    (
      await unaFila<{ n: number }>(
        admin,
        'select count(*)::int as n from identidad.sesiones where usuario_id = $1',
        [id],
      )
    )?.n ?? -1,
  );

// ─── 1 · La contraseña actual se verifica ────────────────────────────────────

test('con la contraseña actual EQUIVOCADA no cambia nada, aunque la sesión sea válida', async () => {
  const { id } = await crear();
  const token = await entrar();
  await otraSesionDe(id);
  const antes = await hashDe(id);
  const sesionesAntes = await cuantasSesiones(id);

  const r = await cambiarPassword(
    pedido(token, { actual: 'esta-no-es-mi-contrasena', nueva: 'una-nueva-bien-larga' }),
  );

  /* 401 y no 403, y el propio `respuesta.ts` explica la distinción: `credenciales_invalidas` NO es
     `sin_sesion`. Acá importa además del lado del cliente — un 401 podría hacer que algo global
     mandara a la pantalla de entrada, y entonces escribir mal la contraseña actual te sacaría del
     sistema. Verificado: **nadie** reacciona globalmente a un 401 en este proyecto, así que el
     rechazo se queda dentro de la ventana. Si algún día se agrega ese manejo, esta línea es donde
     va a doler. */
  assert.equal(r.status, 401, `tenía que rechazar: ${await r.clone().text()}`);
  assert.equal(((await r.json()) as { codigo: string }).codigo, 'credenciales_invalidas');

  /* Y NADA se movió. Es la mitad que importa: un rechazo que igual escribe es peor que ninguno.
     Con la sesión abierta y sin esta verificación, quien se hizo de una cookie cambia la
     contraseña y se queda con la cuenta — el dueño afuera y el intruso adentro. */
  assert.equal(await hashDe(id), antes, 'el rechazo IGUAL cambió la contraseña');
  assert.ok(verificar(PASSWORD, await hashDe(id)), 'la contraseña de siempre dejó de servir');
  assert.equal(
    await cuantasSesiones(id),
    sesionesAntes,
    'el rechazo IGUAL cerró sesiones: una contraseña mal escrita echaría a la persona de sus ' +
      'otros dispositivos',
  );
});

// ─── 2 · Las demás sesiones se cierran, y solo las suyas ─────────────────────

test('cambiarla cierra las DEMÁS sesiones propias y deja la actual; la del vecino no se toca', async () => {
  const { id, vecino } = await crear();
  const token = await entrar();
  /* Dos dispositivos más de la misma persona, y uno del vecino. El del vecino es lo que distingue
     «cerrar mis sesiones» de «cerrar las sesiones»: sin el `where usuario_id`, una persona
     cambiando su contraseña echaría del sistema a la empresa entera, y el síntoma sería «se cayó
     todo» sin nada que lo explique. */
  await otraSesionDe(id);
  await otraSesionDe(id);
  await otraSesionDe(vecino);

  assert.equal(await cuantasSesiones(id), 3, 'no arrancó con tres sesiones propias');
  assert.equal(await cuantasSesiones(vecino), 1);

  const NUEVA = 'otra-contrasena-bien-larga';
  const r = await cambiarPassword(pedido(token, { actual: PASSWORD, nueva: NUEVA }));
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal(((await r.json()) as { cambiada: boolean }).cambiada, true);

  assert.equal(
    await cuantasSesiones(id),
    1,
    'quedaron sesiones abiertas con la contraseña vieja: cambiarla es lo que hace alguien que ' +
      'sospecha que le entraron, y dejarlas vivas lo vuelve inútil',
  );
  assert.equal(
    await cuantasSesiones(vecino),
    1,
    'se cerró la sesión de OTRA persona: el cierre no está acotado al usuario',
  );

  /* Y la que sobrevive es LA ACTUAL, no una cualquiera. Sin esto, quien cambia su contraseña se
     queda afuera en el acto — y el estado siguiente es alguien que no sabe si el cambio se
     aplicó. */
  const viva = await filas<{ token_hash: string }>(
    admin,
    'select token_hash from identidad.sesiones where usuario_id = $1',
    [id],
  );
  assert.equal(
    viva[0]?.token_hash,
    createHash('sha256').update(token).digest('hex'),
    'sobrevivió una sesión que no es la que hizo el cambio',
  );

  // La contraseña quedó cambiada de verdad: la nueva sirve y la vieja no.
  const hash = await hashDe(id);
  assert.ok(verificar(NUEVA, hash), 'la contraseña nueva no verifica');
  assert.ok(!verificar(PASSWORD, hash), 'la contraseña VIEJA sigue sirviendo');
});

// ─── 3 · Queda auditado ──────────────────────────────────────────────────────

test('el cambio deja su fila en la auditoría, y el rechazo NO', async () => {
  const { id } = await crear();
  const token = await entrar();

  const cuantas = async () =>
    Number(
      (
        await unaFila<{ n: number }>(
          admin,
          `select count(*)::int as n from identidad.auditoria_accesos
            where accion = 'password_cambiada' and usuario_id = $1`,
          [id],
        )
      )?.n ?? -1,
    );

  assert.equal(await cuantas(), 0, 'la auditoría no arrancó limpia');

  // Un rechazo NO se audita como cambio: sería una fila que afirma algo que no pasó.
  await cambiarPassword(pedido(token, { actual: 'equivocada', nueva: 'una-nueva-bien-larga' }));
  assert.equal(await cuantas(), 0, 'un rechazo dejó una fila de «contraseña cambiada»');

  await cambiarPassword(pedido(token, { actual: PASSWORD, nueva: 'una-nueva-bien-larga' }));
  assert.equal(
    await cuantas(),
    1,
    'el cambio no dejó rastro: no habría forma de responder «¿cuándo cambió esta contraseña?»',
  );
});

// ─── El largo mínimo, y que tampoco escriba ──────────────────────────────────

test('una contraseña más corta que el mínimo se rechaza SIN tocar nada', async () => {
  const { id } = await crear();
  const token = await entrar();
  const antes = await hashDe(id);

  /* Se construye a partir de `MINIMO_PASSWORD` y no con un literal: el día que alguien suba el
     mínimo, esta prueba lo sigue sin editarse. Es el mismo criterio que `43-segundo-factor`
     escribió para su propia comprobación del número. */
  const corta = 'a'.repeat(MINIMO_PASSWORD - 1);
  const r = await cambiarPassword(pedido(token, { actual: PASSWORD, nueva: corta }));

  assert.equal(r.status, 400, await r.clone().text());
  assert.equal(((await r.json()) as { motivo: string }).motivo, 'demasiado_corta');
  assert.equal(await hashDe(id), antes, 'el rechazo por largo IGUAL cambió la contraseña');
});

// ─── 4 · Sin ninguna capacidad ───────────────────────────────────────────────

test('ADR-0406 · un usuario SIN ningún rol puede cambiar su propia contraseña', async () => {
  /* Los usuarios de este archivo se crean sin rol, así que esto ya está cubierto por las pruebas
     de arriba — y aun así se afirma por separado, porque es la propiedad que hace posible el botón
     del menú de la cuenta: si el endpoint exigiera una capacidad, ese botón sería una puerta que
     responde 403 a quien más lo necesita. Y es la única salida de `debe_cambiar_password`: con una
     capacidad de por medio, una cuenta nueva sin permisos quedaría encerrada sin salida. */
  const { id } = await crear();
  const roles = await unaFila<{ n: number }>(
    admin,
    'select count(*)::int as n from identidad.usuarios_roles where usuario_id = $1',
    [id],
  );
  assert.equal(Number(roles?.n), 0, 'el usuario de esta prueba tiene un rol: no mide lo que dice');

  const token = await entrar();
  const r = await cambiarPassword(pedido(token, { actual: PASSWORD, nueva: 'una-nueva-bien-larga' }));
  assert.equal(r.status, 200, `un usuario sin roles no pudo cambiar su contraseña: ${await r.clone().text()}`);
});
