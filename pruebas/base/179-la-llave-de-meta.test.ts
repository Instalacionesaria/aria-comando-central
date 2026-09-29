// El token de Meta de Creative y su cuenta publicitaria: qué falta, y que nunca sale. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE AFIRMA, Y LA MUTACIÓN QUE CADA COSA TIENE QUE PONER EN ROJO
//
// El token lo genera una persona en el Business Manager y lo carga en Ajustes (docs/creative/15 § 4).
// Desde ahí, la aplicación no lo vuelve a mostrar nunca (`064`). Se vigila:
//
//   · el orden de lo que falta: el token antes que la cuenta — mutación: mirar la cuenta primero;
//   · un token cargado que no se puede leer es «ilegible», no «falta» — mutación: devolver «falta»;
//   · la cuenta se acepta con o sin `act_` y se normaliza — mutación: no normalizar;
//   · el `PUT` lo guarda CIFRADO y ni el `PUT` ni el `GET` lo devuelven — mutación: `secreto: false`.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Client } from 'pg';

import { GET as leerAjustes, PUT as guardarAjustes } from '../../app/api/admin/credenciales/route.ts';
import { conIdentidad, cerrarClientes } from '../../lib/datos/capa.ts';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { COOKIE_SESION, hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { cifrar, descifrar } from '../../lib/credenciales/cifrado.ts';
import { cuentaDeMeta, resolverAccesoAMeta } from '../../lib/credenciales/resolver.ts';

const DOMINIO = 'ejemplo.test';
let admin: Client;
let alfa: string;
let beta: string;
let usuarioAlfa: string;
let cookie: string;
/** La fila de credenciales de beta y las dos columnas de Meta de alfa, tal como estaban. */
let previaDeBeta: Record<string, unknown> | null;
let metaPreviaDeAlfa: { meta_token_cifrado: string | null; meta_cuenta_id: string | null } | null;
let habiaFilaDeAlfa = false;

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  const a = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'alfa'`);
  const b = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'beta'`);
  const u = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email = 'ana@alfa.ejemplo'`);
  assert.ok(a && b && u, 'falta el sembrado: corré `npm run db:reset`');
  alfa = a.id;
  beta = b.id;
  usuarioAlfa = u.id;

  previaDeBeta =
    (await admin.query('select * from identidad.organizaciones_credenciales where org_id = $1', [beta])).rows[0] ?? null;
  const deAlfa = await admin.query(
    'select meta_token_cifrado, meta_cuenta_id from identidad.organizaciones_credenciales where org_id = $1',
    [alfa],
  );
  metaPreviaDeAlfa = deAlfa.rows[0] ?? null;
  habiaFilaDeAlfa = deAlfa.rowCount === 1;

  const token = randomBytes(32).toString('base64url');
  await conIdentidad(async (db) => {
    await db
      .insertInto('sesiones')
      .values({
        usuario_id: usuarioAlfa,
        token_hash: hashDeToken(token),
        estado: 'activa',
        expira_el: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      })
      .execute();
  });
  cookie = token;
});

after(async () => {
  await admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [beta]);
  if (previaDeBeta) {
    const columnas = Object.keys(previaDeBeta);
    await admin.query(
      `insert into identidad.organizaciones_credenciales (${columnas.join(', ')})
       values (${columnas.map((_, i) => `$${i + 1}`).join(', ')})`,
      columnas.map((c) => previaDeBeta![c]),
    );
  }
  if (habiaFilaDeAlfa) {
    await admin.query(
      'update identidad.organizaciones_credenciales set meta_token_cifrado = $2, meta_cuenta_id = $3 where org_id = $1',
      [alfa, metaPreviaDeAlfa?.meta_token_cifrado ?? null, metaPreviaDeAlfa?.meta_cuenta_id ?? null],
    );
  } else {
    await admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [alfa]);
  }
  await admin.query('delete from identidad.sesiones where usuario_id = $1 and token_hash = $2', [
    usuarioAlfa,
    hashDeToken(cookie),
  ]);
  await cerrarTodo();
  await cerrarClientes();
});

/** Deja la fila de credenciales de beta con exactamente estas dos columnas de Meta. */
async function metaDeBeta(token: string | null, cuenta: string | null): Promise<void> {
  await admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [beta]);
  await admin.query(
    'insert into identidad.organizaciones_credenciales (org_id, meta_token_cifrado, meta_cuenta_id) values ($1, $2, $3)',
    [beta, token, cuenta],
  );
}

const resolver = () => conIdentidad((db) => resolverAccesoAMeta(db, beta));

test('sin fila de credenciales, lo que falta es el token: la empresa no conectó Meta', async () => {
  await admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [beta]);
  assert.deepEqual(await resolver(), { tipo: 'falta', que: 'sin_token_de_meta' });
});

test('sin token y con cuenta, falta el token — no «sin cuenta»', async () => {
  /* El orden es la prueba: mirar la cuenta primero reportaría como «sin cuenta» a una empresa a la
     que le falta todo, y el aviso de la que cargó el token y se olvidó la cuenta se perdería. */
  await metaDeBeta(null, 'act_1234567890');
  assert.deepEqual(await resolver(), { tipo: 'falta', que: 'sin_token_de_meta' });
});

test('con token y sin cuenta —o con una cuenta que no tiene forma de cuenta—, falta la cuenta', async () => {
  await metaDeBeta(cifrar('token-de-beta'), null);
  assert.deepEqual(await resolver(), { tipo: 'falta', que: 'sin_cuenta_de_meta' });
  await metaDeBeta(cifrar('token-de-beta'), 'la cuenta de la empresa');
  assert.deepEqual(await resolver(), { tipo: 'falta', que: 'sin_cuenta_de_meta' });
});

test('un token cargado que no se puede leer es «ilegible», no «falta»', async () => {
  await metaDeBeta('esto-no-es-un-cifrado', 'act_1234567890');
  assert.deepEqual(await resolver(), { tipo: 'falta', que: 'token_de_meta_ilegible' });
});

test('con los dos, devuelve el token descifrado y la cuenta normalizada', async () => {
  await metaDeBeta(cifrar('token-de-beta'), '1234567890');
  assert.deepEqual(await resolver(), { tipo: 'listo', token: 'token-de-beta', cuentaId: 'act_1234567890' });
});

test('la cuenta se acepta con o sin `act_`, y lo que no es una cuenta es `null`', () => {
  assert.equal(cuentaDeMeta('act_1234567890'), 'act_1234567890');
  assert.equal(cuentaDeMeta('ACT_1234567890'), 'act_1234567890');
  assert.equal(cuentaDeMeta(' 1234567890 '), 'act_1234567890');
  for (const malo of [null, undefined, '', 'act_', 'act_12ab', '1234', 'act_1234567890; drop']) {
    assert.equal(cuentaDeMeta(malo), null, `aceptó ${String(malo)}`);
  }
});

test('el token se guarda CIFRADO, y ni el PUT ni el GET lo devuelven; la cuenta sí va completa', async () => {
  const secreto = `meta-secreto-${randomBytes(6).toString('hex')}`;
  const pedido = (metodo: 'GET' | 'PUT', cuerpo?: unknown) =>
    new Request(`https://${DOMINIO}/api/admin/credenciales`, {
      method: metodo,
      headers: {
        'content-type': 'application/json',
        origin: `https://${DOMINIO}`,
        cookie: `${COOKIE_SESION}=${cookie}`,
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });

  const r = await guardarAjustes(pedido('PUT', { metaToken: secreto, metaCuentaId: 'act_1234567890' }));
  assert.equal(r.status, 200);
  assert.ok(!(await r.clone().text()).includes(secreto), 'la respuesta del PUT trae el token');

  const enLaBase = await admin.query(
    'select meta_token_cifrado, meta_cuenta_id from identidad.organizaciones_credenciales where org_id = $1',
    [alfa],
  );
  const guardado = enLaBase.rows[0]?.meta_token_cifrado as string;
  assert.notEqual(guardado, secreto, 'el token quedó en texto plano');
  assert.equal(descifrar(guardado), secreto);
  assert.equal(enLaBase.rows[0]?.meta_cuenta_id, 'act_1234567890');

  const g = await leerAjustes(pedido('GET'));
  assert.ok(!(await g.clone().text()).includes(secreto), 'el GET trae el token');
  const cuerpo = (await g.json()) as { meta?: { cargado: boolean; estado: string }; metaCuentaId?: string };
  assert.equal(cuerpo.meta?.cargado, true);
  assert.equal(cuerpo.meta?.estado, 'activa');
  assert.equal(cuerpo.metaCuentaId, 'act_1234567890', 'la cuenta no es un secreto: tiene que verse');
});
