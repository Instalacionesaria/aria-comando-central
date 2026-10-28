// La conexión con Meta: el cliente de lectura y «Probar conexión» en Ajustes. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/2-departamentos/creative/15-LA-MINIATURA-Y-EL-VIDEO.md, etapa M-1 del 2026-10-15)
//
// Que el encargado pueda cargar el token de Meta y saber en el momento si sirve. Cada prueba dice qué mira y la
// mutación que la pone en rojo:
//
//   · el error de Meta se traduce por su código numérico a un motivo cerrado — mutación: mandar el 190 a `otro`;
//   · `pedirExterno` deja pasar el `error.code` de Meta, y sólo si es un entero — mutación: no copiarlo;
//   · el token va en la cabecera `Authorization` y nunca en la URL — mutación: ponerlo como `access_token`;
//   · la prueba de conexión recorre token → cuenta → anuncios y dice en cuál falla — mutación: devolver el paso
//     equivocado, o seguir después de una falla;
//   · sólo cuentan las miniaturas de los hosts de Meta — mutación: contar cualquier URL;
//   · la ruta es `POST`, pide `credenciales.editar`, lee el token en identidad y no devuelve el mensaje de Meta.
//
// Meta se simula reemplazando `fetch`: ninguna prueba llama a Meta de verdad.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { pedirExterno } from '../../lib/http/cliente.ts';
import { fallaDeMeta, pedirAMeta, TEXTO_DE_FALLA_DE_META, VERSION_DE_GRAPH } from '../../lib/meta/graph.ts';
import { probarConexionConMeta } from '../../lib/meta/conexion.ts';

type Pedido = { url: string; cabeceras: Record<string, string> };

/** Reemplaza `fetch` por una lista de respuestas en orden, y guarda lo que se pidió. */
async function conMeta<T>(respuestas: { estado: number; cuerpo: unknown }[], f: (pedidos: Pedido[]) => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  const pedidos: Pedido[] = [];
  let i = 0;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    pedidos.push({ url: String(url), cabeceras: Object.fromEntries(Object.entries((init?.headers as Record<string, string>) ?? {})) });
    const r = respuestas[i++];
    if (!r) throw new Error(`pedido de más: ${String(url)}`);
    return new Response(JSON.stringify(r.cuerpo), { status: r.estado, headers: { 'content-type': 'application/json' } });
  }) as typeof globalThis.fetch;
  try {
    return await f(pedidos);
  } finally {
    globalThis.fetch = original;
  }
}

const errorDeMeta = (code: number, estado = 400) => ({ estado, cuerpo: { error: { message: 'Mensaje de Meta con act_123', type: 'OAuthException', code } } });

test('el error de Meta se traduce por su código: token, permiso, cupo, no existe', () => {
  const r = (numero: number | undefined, estado = 400) => fallaDeMeta({ tipo: 'rechazado', estado, codigo: 'OAuthException', ...(numero === undefined ? {} : { numero }) });
  assert.equal(r(190), 'token', 'un token vencido no se reconoce');
  assert.equal(r(102), 'token');
  assert.equal(r(10), 'permiso');
  assert.equal(r(200), 'permiso');
  assert.equal(r(294), 'permiso');
  assert.equal(r(4), 'cupo');
  assert.equal(r(17), 'cupo');
  assert.equal(r(613), 'cupo');
  assert.equal(r(100), 'no_existe');
  assert.equal(r(undefined, 401), 'token');
  assert.equal(r(undefined, 403), 'permiso');
  assert.equal(r(undefined, 429), 'cupo');
  assert.equal(r(1), 'otro');
  assert.equal(fallaDeMeta({ tipo: 'sin_respuesta', causa: 'x' }), 'sin_respuesta');
  // Cada motivo tiene su texto, y ninguno repite el mensaje de Meta.
  for (const [motivo, texto] of Object.entries(TEXTO_DE_FALLA_DE_META)) {
    assert.ok(texto.length > 20, `el motivo ${motivo} no tiene texto`);
    assert.doesNotMatch(texto, /OAuthException|act_\d/);
  }
});

test('pedirExterno deja pasar el código numérico del error, y sólo si es un entero', async () => {
  const conCodigo = await conMeta([errorDeMeta(190)], () => pedirExterno('https://graph.facebook.com/x'));
  assert.ok(conCodigo.tipo === 'rechazado');
  assert.equal(conCodigo.numero, 190);
  const sinCodigo = await conMeta([{ estado: 400, cuerpo: { error: { type: 'invalid_request_error', message: 'm' } } }], () =>
    pedirExterno('https://api.ejemplo.com/x'),
  );
  assert.ok(sinCodigo.tipo === 'rechazado');
  assert.equal('numero' in sinCodigo, false, 'apareció un número que el servicio no mandó');
  const codigoTexto = await conMeta([{ estado: 400, cuerpo: { error: { code: '190' } } }], () => pedirExterno('https://graph.facebook.com/x'));
  assert.ok(codigoTexto.tipo === 'rechazado');
  assert.equal('numero' in codigoTexto, false, 'un código que no es número se tomó como número');
});

test('el token va en la cabecera y nunca en la URL', async () => {
  await conMeta([{ estado: 200, cuerpo: { id: '1' } }], async (pedidos) => {
    await pedirAMeta('me', 'TOKEN-SECRETO', { fields: 'id' });
    assert.equal(pedidos[0]!.cabeceras.authorization, 'Bearer TOKEN-SECRETO');
    assert.doesNotMatch(pedidos[0]!.url, /TOKEN-SECRETO|access_token/);
    assert.ok(pedidos[0]!.url.startsWith(`https://graph.facebook.com/${VERSION_DE_GRAPH}/me?`));
  });
  await assert.rejects(pedirAMeta('me', 't', { access_token: 't' }), /cabecera/, 'se aceptó el token en la URL');
});

test('probar conexión: conectado, con la cuenta y las miniaturas que se pueden mostrar', async () => {
  const r = await conMeta(
    [
      { estado: 200, cuerpo: { id: '9' } },
      { estado: 200, cuerpo: { name: 'Cuenta de prueba', currency: 'USD', account_status: 1 } },
      {
        estado: 200,
        cuerpo: {
          data: [
            { creative: { thumbnail_url: 'https://scontent.xx.fbcdn.net/t.jpg' } },
            { creative: { image_url: 'https://evil.example.com/x.jpg' } },
            { creative: {} },
          ],
        },
      },
    ],
    async (pedidos) => {
      const res = await probarConexionConMeta('t', 'act_123');
      assert.match(pedidos[1]!.url, /\/act_123\?/);
      assert.match(pedidos[2]!.url, /\/act_123\/ads\?/);
      return res;
    },
  );
  assert.deepEqual(r, { estado: 'conectado', cuenta: { nombre: 'Cuenta de prueba', moneda: 'USD', activa: true }, anuncios: 3, conMiniatura: 1 });
});

test('probar conexión: dice en qué paso falla, y no sigue después', async () => {
  const token = await conMeta([errorDeMeta(190)], () => probarConexionConMeta('t', 'act_1'));
  assert.deepEqual([token.estado, token.estado === 'falla' && token.paso, token.estado === 'falla' && token.motivo], ['falla', 'token', 'token']);

  const cuenta = await conMeta([{ estado: 200, cuerpo: { id: '9' } }, errorDeMeta(100)], () => probarConexionConMeta('t', 'act_1'));
  assert.ok(cuenta.estado === 'falla');
  assert.deepEqual([cuenta.paso, cuenta.motivo], ['cuenta', 'no_existe']);
  assert.doesNotMatch(cuenta.texto, /Mensaje de Meta/, 'el mensaje de Meta llegó al resultado');

  const permiso = await conMeta(
    [{ estado: 200, cuerpo: { id: '9' } }, { estado: 200, cuerpo: { name: 'C', account_status: 2 } }, errorDeMeta(200)],
    () => probarConexionConMeta('t', 'act_1'),
  );
  assert.ok(permiso.estado === 'falla');
  assert.deepEqual([permiso.paso, permiso.motivo], ['anuncios', 'permiso']);
});

test('la ruta: POST, credenciales.editar, el token se lee en identidad y Meta se llama fuera de la transacción', () => {
  const f = readFileSync(join(RAIZ, 'app/api/admin/credenciales/meta/route.ts'), 'utf8');
  assert.match(f, /export async function POST\(/);
  assert.doesNotMatch(f, /export async function (GET|PUT|DELETE)\(/, 'probar la conexión no puede ser un GET');
  assert.match(f, /exigir\(peticion, \['credenciales\.editar'\], PANTALLA\)/);
  assert.match(f, /const acceso = await conIdentidad\(async \(db\) => resolverAccesoAMeta\(db, contexto\.orgEfectiva, 'la_de_la_empresa'\)\);/);
  // La llamada a Meta va DESPUÉS de cerrar la transacción, no adentro.
  assert.match(f, /return ok\(await probarConexionConMeta\(acceso\.token, acceso\.cuentaId\)\);/);
  const pantalla = readFileSync(join(RAIZ, 'components/ajustes/ConexionConMeta.jsx'), 'utf8');
  assert.match(pantalla, /pedir\('\/api\/admin\/credenciales\/meta', \{ metodo: 'POST', espera: ESPERA_DE_LA_PRUEBA_MS \}\)/);
  const espera = Number(/ESPERA_DE_LA_PRUEBA_MS = ([\d_]+)/.exec(pantalla)?.[1]?.replaceAll('_', ''));
  const maxima = Number(/export const maxDuration = (\d+)/.exec(f)?.[1]) * 1000;
  assert.ok(espera > maxima, 'el navegador corta la prueba antes que el servidor');
});
