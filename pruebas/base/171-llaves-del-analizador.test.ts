// LAS LLAVES DE LOS ANALIZADORES: la de tl;dv y la de IA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// Dos cosas, y las dos tienen un modo de fallar silencioso:
//
//   · **El orden de las faltas.** Casi ninguna empresa carga tl;dv, y el cron tiene que saltearlas
//     sin decir nada. Una que cargó tl;dv y no la de IA sí quiso usarlo: ése es el aviso. Con el orden
//     al revés, todas las empresas saldrían «sin llave de IA» y el aviso que importa se perdería.
//   · **La llave de tl;dv no sale nunca.** Se guarda cifrada y la respuesta dice su estado, jamás el
//     valor. Una llave que sale en un GET queda en el historial del navegador de quien administra.
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
import { resolverAccesoAlAnalizador } from '../../lib/credenciales/resolver.ts';

const DOMINIO = 'ejemplo.test';
let admin: Client;
let beta: string;
let alfa: string;
let usuarioAlfa: string;
let cookie: string;
/** La fila de credenciales de beta y la columna de tl;dv de alfa, tal como estaban: se restauran al final. */
let previaDeBeta: Record<string, unknown> | null;
let tldvPreviaDeAlfa: string | null;
/* Si alfa tenía fila ANTES. El PUT de la última prueba la crea si no existía, y dejarla rompe a
   quien corre después suponiendo que no hay: `20-invariantes` inserta una y chocaba con el único
   —medido—, con un error que no menciona ni las credenciales ni este archivo. */
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

  const fila = await admin.query('select * from identidad.organizaciones_credenciales where org_id = $1', [beta]);
  previaDeBeta = fila.rows[0] ?? null;
  const deAlfa = await admin.query('select tldv_clave_cifrada from identidad.organizaciones_credenciales where org_id = $1', [alfa]);
  tldvPreviaDeAlfa = deAlfa.rows[0]?.tldv_clave_cifrada ?? null;
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
    await admin.query('update identidad.organizaciones_credenciales set tldv_clave_cifrada = $2 where org_id = $1', [alfa, tldvPreviaDeAlfa]);
  } else {
    await admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [alfa]);
  }
  await admin.query('delete from identidad.sesiones where usuario_id = $1 and token_hash = $2', [usuarioAlfa, hashDeToken(cookie)]);
  await cerrarTodo();
  await cerrarClientes();
});

/** Deja la fila de credenciales de beta con exactamente estas dos columnas. */
async function llavesDeBeta(tldv: string | null, ia: string | null): Promise<void> {
  await admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [beta]);
  await admin.query(
    'insert into identidad.organizaciones_credenciales (org_id, tldv_clave_cifrada, ia_clave_cifrada) values ($1, $2, $3)',
    [beta, tldv, ia],
  );
}

const resolver = () => conIdentidad((db) => resolverAccesoAlAnalizador(db, beta));

test('sin fila de credenciales, lo que falta es tl;dv: la empresa no usa el descubrimiento', async () => {
  await admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [beta]);
  assert.deepEqual(await resolver(), { tipo: 'falta', que: 'sin_llave_de_tldv' });
});

test('sin tl;dv y sin IA, la falta es tl;dv — no «sin IA»', async () => {
  /* El orden es la prueba. La mutación que mira la de IA primero reporta como «sin llave de IA» a
     todas las empresas que nunca quisieron descubrir, y el aviso de la que sí quiso se pierde. */
  await llavesDeBeta(null, null);
  assert.deepEqual(await resolver(), { tipo: 'falta', que: 'sin_llave_de_tldv' });
});

test('con tl;dv y sin IA, falta la de IA', async () => {
  await llavesDeBeta(cifrar('tldv-de-beta'), null);
  assert.deepEqual(await resolver(), { tipo: 'falta', que: 'sin_llave_de_ia' });
});

test('una llave cargada que no se puede leer es «ilegible», no «falta»', async () => {
  /* Decir «falta» mandaría a volver a cargar algo que está cargado, y el problema real —la clave
     maestra del servidor— quedaría sin diagnosticar. */
  await llavesDeBeta('esto-no-es-un-cifrado', cifrar('ia-de-beta'));
  assert.deepEqual(await resolver(), { tipo: 'falta', que: 'llave_de_tldv_ilegible' });
  await llavesDeBeta(cifrar('tldv-de-beta'), 'esto-tampoco');
  assert.deepEqual(await resolver(), { tipo: 'falta', que: 'llave_de_ia_ilegible' });
});

test('con las dos, devuelve las dos descifradas', async () => {
  await llavesDeBeta(cifrar('tldv-de-beta'), cifrar('ia-de-beta'));
  assert.deepEqual(await resolver(), { tipo: 'listo', claveIa: 'ia-de-beta', claveTldv: 'tldv-de-beta' });
});

test('la llave de tl;dv se guarda CIFRADA y el GET dice su estado, nunca su valor', async () => {
  const secreto = `tldv-secreto-${randomBytes(6).toString('hex')}`;
  const pedido = (metodo: 'GET' | 'PUT', cuerpo?: unknown) =>
    new Request(`https://${DOMINIO}/api/admin/credenciales`, {
      method: metodo,
      headers: { 'content-type': 'application/json', origin: `https://${DOMINIO}`, cookie: `${COOKIE_SESION}=${cookie}` },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });

  const r = await guardarAjustes(pedido('PUT', { tldvClave: secreto }));
  assert.equal(r.status, 200);
  assert.ok(!(await r.clone().text()).includes(secreto), 'la respuesta del PUT trae la llave');

  const enLaBase = await admin.query('select tldv_clave_cifrada from identidad.organizaciones_credenciales where org_id = $1', [alfa]);
  const guardada = enLaBase.rows[0]?.tldv_clave_cifrada as string;
  assert.notEqual(guardada, secreto, 'la llave quedó en texto plano');
  assert.equal(descifrar(guardada), secreto);

  const g = await leerAjustes(pedido('GET'));
  const texto = await g.clone().text();
  assert.ok(!texto.includes(secreto), 'el GET trae la llave');
  const cuerpo = (await g.json()) as { tldv?: { cargado: boolean; estado: string } };
  assert.equal(cuerpo.tldv?.cargado, true);
  assert.equal(cuerpo.tldv?.estado, 'activa');
});
