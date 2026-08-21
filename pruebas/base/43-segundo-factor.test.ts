// ADR-0413 — Un usuario con un rol que exige segundo factor no obtiene sesión habilitada.
//            INNEGOCIABLE.
// ADR-0601 — Nada cifrado se guarda sin autenticación. (adelantada de la Etapa 6)
// ADR-0602 — La clave maestra se valida al usarse, con un mensaje que dice qué hacer.
// Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL RECORRIDO COMPLETO, Y EL PRIMITIVO QUE LO SOSTIENE
//
// Dos cosas en un archivo porque una no existe sin la otra: el secreto del segundo factor es
// `text not null` y hay que cifrarlo. Las dos filas del cifrado son las únicas que se
// adelantaron de la Etapa 6, con la decisión registrada en `docs/ETAPA-4.md`.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Client } from 'pg';
import { POST as login } from '../../app/api/auth/login/route.ts';
import { POST as configurar } from '../../app/api/auth/2fo/configurar/route.ts';
import { POST as confirmar } from '../../app/api/auth/2fo/confirmar/route.ts';
import { POST as verificar, TOPE_DE_CODIGOS } from '../../app/api/auth/2fo/verificar/route.ts';
import { conIdentidad, cerrarClientes } from '../../lib/datos/capa.ts';
import { conectar, cerrarTodo } from '../apoyo/conexiones.ts';
import { hashear } from '../../lib/datos/hash.ts';
import { COOKIE_SESION, hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { cifrar, claveMaestra, descifrar } from '../../lib/credenciales/cifrado.ts';
import { codigoActual, DIGITOS, PERIODO_SEGUNDOS } from '../../lib/autenticacion/totp.ts';

const DOMINIO = 'ejemplo.test';
const PASSWORD = 'una-contrasena-de-prueba-larga';
const EMAIL = 'segundofactor@principal.ejemplo';

let admin: Client;

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
});

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

// ─── El primitivo de cifrado ────────────────────────────────────────────────

test('ADR-0601 · el nonce es ALEATORIO: dos cifrados del mismo texto son distintos', () => {
  // El `06` § 3 lo llama *"el error más fácil de cometer… y el más caro"*: *"reusar un nonce con
  // la misma clave en GCM ROMPE EL CIFRADO POR COMPLETO. No lo debilita: permite recuperar el
  // texto en claro"*. Y nombra la tentación exacta: derivarlo del identificador de la
  // organización *"para que sea determinista"*.
  const a = cifrar('el mismo texto');
  const b = cifrar('el mismo texto');
  assert.notEqual(a, b, 'dos cifrados iguales significan nonce determinista');
  // Y los dos descifran al mismo valor, o la aleatoriedad estaría rompiendo el dato.
  assert.equal(descifrar(a), 'el mismo texto');
  assert.equal(descifrar(b), 'el mismo texto');
  // El formato: tres partes en base64, con el nonce de 12 bytes.
  const partes = a.split(':');
  assert.equal(partes.length, 3);
  assert.equal(Buffer.from(partes[0] ?? '', 'base64').length, 12);
});

test('ADR-0601 · un valor MODIFICADO no descifra: falla, no devuelve basura', () => {
  // *"Con un modo sin autenticación, si alguien modifica el dato cifrado el descifrado DEVUELVE
  // BASURA QUE PARECE UN TOKEN. Ese 'token' sale hacia el servicio externo, falla con un error
  // de autenticación, y nadie entiende por qué."*
  const bueno = cifrar('un secreto');
  const [nonce, etiqueta, cifrado] = bueno.split(':');
  // Se cambia un byte del texto cifrado.
  const bytes = Buffer.from(cifrado ?? '', 'base64');
  bytes[0] = (bytes[0] ?? 0) ^ 0xff;
  const alterado = [nonce, etiqueta, bytes.toString('base64')].join(':');

  assert.throws(() => descifrar(alterado), /el valor fue modificado o la clave maestra cambió/);
  // Y el mensaje dice QUÉ HACER, que es lo que *"convierte media hora de depuración en diez
  // segundos"*.
  assert.throws(() => descifrar(alterado), /volver a cargar la credencial/);
});

test('ADR-0601 · con OTRA clave maestra falla, y nunca devuelve vacío', () => {
  // *"Pasa seguido: cada vez que alguien corre el proyecto en otra máquina, o restaura una copia
  // de la base en otro entorno, la clave maestra es otra y NINGUNA credencial se puede leer."*
  //
  // Y *"nunca devolver nulo ni un texto vacío en ese caso: un token vacío produce un error de
  // autenticación del servicio externo, tres capas más abajo, imposible de diagnosticar"*.
  const original = process.env.CLAVE_MAESTRA;
  const blob = cifrar('un secreto');
  try {
    process.env.CLAVE_MAESTRA = randomBytes(32).toString('base64');
    assert.throws(() => descifrar(blob), /la clave maestra cambió/);
  } finally {
    process.env.CLAVE_MAESTRA = original;
  }
  // Y con la clave correcta vuelve a funcionar: la prueba de arriba no rompió el dato.
  assert.equal(descifrar(blob), 'un secreto');
});

test('ADR-0602 · la clave maestra acepta base64 Y hexadecimal, y rechaza el resto', () => {
  // *"Aceptar los dos formatos evita el error de configuración más común, que es pegar la clave
  // en el formato que no era."*
  const original = process.env.CLAVE_MAESTRA;
  const crudo = randomBytes(32);
  try {
    process.env.CLAVE_MAESTRA = crudo.toString('base64');
    assert.ok(claveMaestra().equals(crudo), 'no aceptó base64');

    process.env.CLAVE_MAESTRA = crudo.toString('hex');
    assert.ok(claveMaestra().equals(crudo), 'no aceptó hexadecimal');

    // Y los tres casos que tienen que fallar con un mensaje que diga qué hacer.
    for (const malo of ['', 'demasiado-corta', randomBytes(16).toString('base64')]) {
      process.env.CLAVE_MAESTRA = malo;
      assert.throws(() => claveMaestra(), /32 bytes en base64 o hexadecimal|no está definida/);
    }
    delete process.env.CLAVE_MAESTRA;
    assert.throws(() => claveMaestra(), /no está definida/);
  } finally {
    process.env.CLAVE_MAESTRA = original;
  }
});

// ─── El código, y sus parámetros ────────────────────────────────────────────

test('el código tiene seis dígitos y cambia cada treinta segundos', () => {
  // Seis dígitos es lo ÚNICO que la especificación fija (tres veces). El período de treinta
  // segundos y HMAC-SHA1 son decisión propia, por compatibilidad con las aplicaciones de
  // autenticación: elegir SHA-256 "porque es mejor" produce códigos que el teléfono del usuario
  // **no genera**, y el síntoma es "el código nunca funciona".
  const secreto = 'JBSWY3DPEHPK3PXP';
  const base = 1_700_000_000_000;
  const a = codigoActual(secreto, base);
  assert.match(a, new RegExp(`^\\d{${DIGITOS}}$`));
  // Dentro de la misma ventana, el mismo código.
  assert.equal(codigoActual(secreto, base + 1000), a);
  // En la siguiente, otro.
  assert.notEqual(codigoActual(secreto, base + PERIODO_SEGUNDOS * 1000 * 2), a);
});

// ─── El recorrido completo ──────────────────────────────────────────────────

async function borrarUsuario(): Promise<void> {
  await admin.query(
    `with objetivo as (select id from identidad.usuarios where lower(email) = lower($1)),
          f as (delete from identidad.usuarios_segundo_factor where usuario_id in (select id from objetivo)),
          s as (delete from identidad.sesiones where usuario_id in (select id from objetivo)),
          r as (delete from identidad.usuarios_roles where usuario_id in (select id from objetivo))
     delete from identidad.usuarios where id in (select id from objetivo)`,
    [EMAIL],
  );
}

async function crearUsuario(): Promise<void> {
  await borrarUsuario();
  await conIdentidad(async (db) => {
    const org = await db
      .selectFrom('organizaciones')
      .select('id')
      .where('slug', '=', 'principal')
      .executeTakeFirstOrThrow();
    const u = await db
      .insertInto('usuarios')
      .values({
        org_id: org.id,
        nombre: 'Usuario de segundo factor',
        email: EMAIL,
        password_hash: hashear(PASSWORD),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const rol = await db
      .selectFrom('roles')
      .select('id')
      .where('clave', '=', 'superadministrador')
      .executeTakeFirstOrThrow();
    await db.insertInto('usuarios_roles').values({ usuario_id: u.id, rol_id: rol.id }).execute();
  });
}

async function entrar(): Promise<{ token: string; estado: string }> {
  const r = await login(
    new Request(`https://${DOMINIO}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: `https://${DOMINIO}` },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    }),
  );
  const cuerpo = (await r.json()) as { estado: string };
  const token = /__Host-sesion=([^;]+)/.exec(r.headers.get('set-cookie') ?? '')?.[1] ?? '';
  return { token, estado: cuerpo.estado };
}

function con(token: string, camino: string, cuerpo?: unknown): Request {
  return new Request(`https://${DOMINIO}${camino}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: `https://${DOMINIO}`,
      cookie: `${COOKIE_SESION}=${token}`,
    },
    body: JSON.stringify(cuerpo ?? {}),
  });
}

test('ADR-0413 · el recorrido completo: configurar, confirmar, y recién ahí `activa`', async () => {
  await crearUsuario();
  try {
    // 1 · El login da `debe_configurar_2fo`, no `activa`.
    const primera = await entrar();
    assert.equal(primera.estado, 'debe_configurar_2fo');

    // 2 · Configurar devuelve el secreto UNA vez, y lo guarda cifrado y SIN confirmar.
    const rConf = await configurar(con(primera.token, '/api/auth/2fo/configurar'));
    assert.equal(rConf.status, 200);
    const { secreto } = (await rConf.json()) as { secreto: string };
    assert.ok(secreto && secreto.length > 20, 'no devolvió un secreto');

    const guardado = await conIdentidad(async (db) =>
      db
        .selectFrom('usuarios_segundo_factor as f')
        .innerJoin('usuarios as u', 'u.id', 'f.usuario_id')
        .select(['f.secreto_cifrado', 'f.confirmado_el'])
        .where('u.email', '=', EMAIL)
        .executeTakeFirstOrThrow(),
    );
    // El secreto está CIFRADO, no en claro. Es la mitad que hace falta afirmar.
    assert.notEqual(guardado.secreto_cifrado, secreto, 'el secreto quedó en claro en la base');
    assert.equal(descifrar(guardado.secreto_cifrado), secreto);
    // Y `confirmado_el` en nulo: hasta que no se pruebe un código, este alta NO CUENTA. Es lo
    // que impide que un alta abandonada deje la cuenta en `pendiente_2fo` para siempre.
    assert.equal(guardado.confirmado_el, null);

    // 3 · Un código incorrecto no confirma.
    const malo = await confirmar(con(primera.token, '/api/auth/2fo/confirmar', { codigo: '000000' }));
    assert.equal(malo.status, 401);

    // 4 · El código correcto confirma, pasa a `activa`, y devuelve los respaldos UNA vez.
    const bien = await confirmar(
      con(primera.token, '/api/auth/2fo/confirmar', { codigo: codigoActual(secreto) }),
    );
    assert.equal(bien.status, 200, `no confirmó: ${await bien.clone().text()}`);
    const cuerpo = (await bien.json()) as { estado: string; respaldos: string[] };
    // ACÁ GANA LA TABLA DEL 02 § 5 SOBRE LA REGLA DEL RECÁLCULO: recalcular con las cuatro
    // ramas devolvería `pendiente_2fo` —el factor acaba de quedar confirmado— y la cuenta
    // entraría en un bucle.
    assert.equal(cuerpo.estado, 'activa');
    assert.ok(cuerpo.respaldos.length > 0, 'no devolvió códigos de respaldo');

    // 5 · Y el LOGIN SIGUIENTE da `pendiente_2fo`: ahora hay factor confirmado que verificar.
    const segunda = await entrar();
    assert.equal(segunda.estado, 'pendiente_2fo');

    // 6 · Verificar con el código lo pasa a `activa`… y arregla el plazo. Una sesión pendiente
    // nace con cinco minutos; sin extenderla acá, se vencería a los cinco minutos de haber
    // entrado bien y el síntoma sería "me echa todo el tiempo".
    const ver = await verificar(
      con(segunda.token, '/api/auth/2fo/verificar', { codigo: codigoActual(secreto) }),
    );
    assert.equal(ver.status, 200, `no verificó: ${await ver.clone().text()}`);
    assert.equal(((await ver.json()) as { estado: string }).estado, 'activa');

    const plazo = await conIdentidad(async (db) =>
      db
        .selectFrom('sesiones as s')
        .innerJoin('usuarios as u', 'u.id', 's.usuario_id')
        .select(['s.estado', 's.expira_el'])
        .where('u.email', '=', EMAIL)
        .executeTakeFirstOrThrow(),
    );
    assert.equal(plazo.estado, 'activa');
    // El plazo dejó de ser el de cinco minutos. Sin esta línea en el manejador, la sesión se
    // vencería a los cinco minutos de haber entrado bien.
    const faltanHoras = (plazo.expira_el.getTime() - Date.now()) / 3_600_000;
    assert.ok(
      faltanHoras > 24,
      `la sesión verificada quedó con ${faltanHoras.toFixed(1)} h: heredó el plazo de la pendiente`,
    );
  } finally {
    await borrarUsuario();
  }
});

test('ADR-0413 · un código de respaldo entra, y se CONSUME', async () => {
  await crearUsuario();
  try {
    const primera = await entrar();
    const { secreto } = (await (
      await configurar(con(primera.token, '/api/auth/2fo/configurar'))
    ).json()) as { secreto: string };
    const { respaldos } = (await (
      await confirmar(con(primera.token, '/api/auth/2fo/confirmar', { codigo: codigoActual(secreto) }))
    ).json()) as { respaldos: string[] };

    const segunda = await entrar();
    const uno = respaldos[0];
    assert.ok(uno);

    const ver = await verificar(con(segunda.token, '/api/auth/2fo/verificar', { codigo: uno }));
    assert.equal(ver.status, 200, `el respaldo no entró: ${await ver.clone().text()}`);
    assert.equal(((await ver.json()) as { porRespaldo: boolean }).porRespaldo, true);

    // Y el MISMO respaldo no sirve dos veces. Sin consumirlo, un código anotado en un papel es
    // una contraseña permanente.
    const tercera = await entrar();
    const otraVez = await verificar(con(tercera.token, '/api/auth/2fo/verificar', { codigo: uno }));
    assert.equal(otraVez.status, 401, 'el código de respaldo se pudo usar dos veces');

    const quedan = await conIdentidad(async (db) =>
      db
        .selectFrom('usuarios_segundo_factor as f')
        .innerJoin('usuarios as u', 'u.id', 'f.usuario_id')
        .select('f.respaldos_hash')
        .where('u.email', '=', EMAIL)
        .executeTakeFirstOrThrow(),
    );
    assert.equal(quedan.respaldos_hash.length, respaldos.length - 1);
  } finally {
    await borrarUsuario();
  }
});

test('ADR-0413 · tres códigos fallidos DESTRUYEN la sesión pendiente', async () => {
  // El `02` § 2: *"el código falla N veces → SE DESTRUYE. Si no, es un código de seis dígitos
  // con intentos infinitos."* La especificación no fija N; son tres.
  await crearUsuario();
  try {
    const primera = await entrar();
    const { secreto } = (await (
      await configurar(con(primera.token, '/api/auth/2fo/configurar'))
    ).json()) as { secreto: string };
    await confirmar(con(primera.token, '/api/auth/2fo/confirmar', { codigo: codigoActual(secreto) }));

    const segunda = await entrar();
    assert.equal(segunda.estado, 'pendiente_2fo');

    let ultima: Response | null = null;
    for (let i = 0; i < TOPE_DE_CODIGOS; i++) {
      ultima = await verificar(con(segunda.token, '/api/auth/2fo/verificar', { codigo: '000000' }));
    }
    assert.ok(ultima);
    assert.equal(ultima.status, 401);
    assert.equal(((await ultima.json()) as { codigo: string }).codigo, 'sin_sesion');

    // La fila de ESA sesión ya no existe: la persona vuelve al login.
    //
    // Se busca por el hash del token y no contando sesiones del usuario, y la primera versión
    // de esta prueba se equivocó justo ahí: la sesión del paso de configuración sigue viva —y
    // con razón, es una sesión legítima que quedó `activa`—, así que un conteo total daba 1 y
    // parecía que la destrucción no había ocurrido. La afirmación tiene que ser sobre la sesión
    // que se atacó, no sobre el usuario.
    const sigueViva = await conIdentidad(async (db) =>
      db
        .selectFrom('sesiones')
        .select('id')
        .where('token_hash', '=', hashDeToken(segunda.token))
        .executeTakeFirst(),
    );
    assert.equal(sigueViva, undefined, 'la sesión pendiente sobrevivió al tope de códigos');
  } finally {
    await borrarUsuario();
  }
});
