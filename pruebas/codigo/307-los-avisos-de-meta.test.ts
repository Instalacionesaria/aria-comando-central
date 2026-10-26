// LOS AVISOS DE META Y LAS PÁGINAS QUE SE VEN SIN SESIÓN. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (Meta directo, M6, 2026-10-26)
//
//   · `partirSolicitudFirmada` lee la solicitud que firma Meta y calcula la firma que debería traer: la de un secreto
//     distinto no coincide, unos datos tocados tampoco, y lo que no tiene su forma —otro algoritmo, sin `user_id`, tres
//     mitades, base64 roto— no se lee — mutaciones: firmar los datos decodificados; aceptar cualquier algoritmo;
//   · las dos rutas comparan las firmas en la ruta, con las longitudes antes de `timingSafeEqual`, y responden 403 sin
//     el secreto (la 30 exige la llamada; acá se exige la guarda del largo, que sin ella `timingSafeEqual` lanza);
//   · el proxy deja ver sin sesión las cuatro páginas que pide Meta y nada más: ni un camino que sólo empieza igual ni
//     el retorno del diálogo — mutación: comparar por prefijo suelto;
//   · las páginas públicas no leen la sesión.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { partirSolicitudFirmada } from '../../lib/meta/solicitudFirmada.ts';
import { CAMINOS_PUBLICOS, esCaminoPublico } from '../../lib/autorizacion/caminosPublicos.ts';
import { RAIZ } from '../apoyo/fuente.ts';

const SECRETO = 'secreto-de-prueba-307';

/** Firma como Meta: HMAC-SHA256 de la mitad de los datos, tal como viaja, con el secreto de la app. */
function firmar(datos: unknown, secreto = SECRETO): string {
  const carga = Buffer.from(JSON.stringify(datos)).toString('base64url');
  return `${createHmac('sha256', secreto).update(carga).digest('base64url')}.${carga}`;
}

const coincide = (s: ReturnType<typeof partirSolicitudFirmada>) => s !== null && s.recibida.equals(s.esperada);

test('una solicitud firmada con nuestro secreto coincide, y trae quién la pidió', () => {
  const s = partirSolicitudFirmada(firmar({ algorithm: 'HMAC-SHA256', issued_at: 1_790_000_000, user_id: '3070001' }), SECRETO);
  assert.ok(coincide(s));
  assert.equal(s?.usuario, '3070001');
  assert.equal(s?.emitida, 1_790_000_000);
  // Meta a veces manda el id como número.
  assert.equal(partirSolicitudFirmada(firmar({ algorithm: 'HMAC-SHA256', user_id: 3070002 }), SECRETO)?.usuario, '3070002');
});

test('con otro secreto, o con los datos tocados, no coincide', () => {
  assert.equal(coincide(partirSolicitudFirmada(firmar({ algorithm: 'HMAC-SHA256', user_id: '3070001' }, 'otro'), SECRETO)), false);
  const buena = firmar({ algorithm: 'HMAC-SHA256', user_id: '3070001' });
  const [firma] = buena.split('.');
  const tocada = `${firma}.${Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '3070999' })).toString('base64url')}`;
  const s = partirSolicitudFirmada(tocada, SECRETO);
  assert.ok(s, 'la forma es válida: se parte');
  assert.equal(coincide(s), false, 'unos datos cambiados con la firma de otros pasaron');
});

test('lo que no tiene la forma de una solicitud de Meta no se lee', () => {
  for (const valor of [
    null,
    '',
    'sin-punto',
    'a.b.c',
    'ab$.cd',
    firmar({ algorithm: 'HMAC-SHA1', user_id: '3070001' }),
    firmar({ user_id: '3070001' }),
    firmar({ algorithm: 'HMAC-SHA256' }),
    firmar({ algorithm: 'HMAC-SHA256', user_id: 'no-es-un-id' }),
    firmar('un texto'),
    `${'a'.repeat(5000)}.b`,
  ]) {
    assert.equal(partirSolicitudFirmada(valor, SECRETO), null, `se leyó ${String(valor).slice(0, 40)}`);
  }
});

test('las dos rutas: sin el secreto no hacen nada, y comparan los largos antes de timingSafeEqual', () => {
  for (const ruta of ['app/api/meta/desautorizado/route.ts', 'app/api/meta/borrado/route.ts']) {
    const fuente = readFileSync(join(RAIZ, ruta), 'utf8');
    assert.ok(fuente.indexOf('if (!secreto)') < fuente.indexOf('partirSolicitudFirmada('), `${ruta} lee el pedido antes de mirar el secreto`);
    assert.match(
      fuente,
      /solicitud\.recibida\.length !== solicitud\.esperada\.length \|\| !timingSafeEqual\(solicitud\.recibida, solicitud\.esperada\)/,
      `${ruta} no compara los largos antes de timingSafeEqual (que lanza con largos distintos)`,
    );
  }
});

test('el proxy deja ver sin sesión las páginas que pide Meta, y sólo ésas', () => {
  for (const camino of ['/privacidad', '/terminos', '/borrado-de-datos', '/meta/borrado/0123456789abcdef0123456789abcdef']) {
    assert.equal(esCaminoPublico(camino), true, camino);
  }
  for (const camino of ['/privacidadx', '/terminos-viejos', '/meta/retorno', '/meta/borradox', '/', '/ajustes', '/api/meta/borrado']) {
    assert.equal(esCaminoPublico(camino), false, `${camino} se vería sin sesión`);
  }
  assert.deepEqual([...CAMINOS_PUBLICOS].sort(), ['/borrado-de-datos', '/meta/borrado', '/privacidad', '/terminos']);
  // Y el proxy la usa ANTES de mirar la cookie (Node no importa `next/server`, así que se lee su fuente).
  const fuente = readFileSync(join(RAIZ, 'proxy.ts'), 'utf8');
  const usa = fuente.indexOf('if (esCaminoPublico(pathname)) return NextResponse.next();');
  assert.ok(usa > 0 && usa < fuente.indexOf('if (!hayCookie && !enEntrar)'), 'el proxy no deja pasar las páginas públicas antes de pedir sesión');
});

test('las páginas públicas no leen la sesión', () => {
  for (const pagina of ['app/privacidad/page.tsx', 'app/terminos/page.tsx', 'app/borrado-de-datos/page.tsx', 'app/meta/borrado/[codigo]/page.tsx', 'app/legal/hoja-legal.tsx']) {
    const fuente = readFileSync(join(RAIZ, pagina), 'utf8');
    for (const no of ['cookies(', 'exigir(', 'sesionOpcional(', 'conOrganizacion(']) {
      assert.ok(!fuente.includes(no), `${pagina} usa ${no}`);
    }
  }
});
