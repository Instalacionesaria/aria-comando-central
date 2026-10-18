// LAS RUTAS DE LAS PANTALLAS DEL CLIENTE ABREN SU ÁMBITO. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Paso 5)
//
// Las pantallas del cliente (Leads y Sales) las ve el cliente final y las enfoca la empresa. Sus rutas tienen que leer
// con el ámbito de la petición (`ambitoDe`), no con la organización a secas: con `conOrganizacion(contexto.orgEfectiva)`
// el cliente final recibiría un `'*'`… que la base le negaría (la `086`) y la pantalla fallaría; y la empresa enfocada
// en un cliente vería la empresa entera sin enterarse.
//
//   · toda ruta de una pantalla del cliente abre `conOrganizacion(ambitoDe(…))`, nunca la organización a secas, y
//     usa la zona del ámbito, no la de la organización — mutación: devolver una ruta a `contexto.orgEfectiva`;
//   · el cerebro abre cada transacción de la pregunta con su ámbito, y la caja se lo pasa — mutación: devolver una
//     transacción de `preguntar.ts` a `p.orgId`.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, archivosFuente, sinComentarios } from '../apoyo/fuente.ts';
import { SECCIONES_DEL_CLIENTE } from '../../lib/autorizacion/cliente.ts';

test('toda ruta de una pantalla del cliente abre su ámbito y usa su zona', () => {
  const mal: string[] = [];
  let rutas = 0;
  for (const a of archivosFuente(['app'])) {
    if (!a.ruta.endsWith('/route.ts')) continue;
    const pantalla = a.limpio.match(/export const PANTALLA = '([^']+)'/)?.[1];
    if (!pantalla || !SECCIONES_DEL_CLIENTE.has(pantalla)) continue;
    rutas += 1;
    for (const m of a.limpio.matchAll(/conOrganizacion\(\s*([^,]+),/g)) {
      if (!m[1]!.trim().startsWith('ambitoDe(')) mal.push(`${a.ruta}: conOrganizacion(${m[1]!.trim()}, …)`);
    }
    if (/contexto\.organizacion\.zonaHoraria/.test(a.limpio)) mal.push(`${a.ruta}: usa la zona de la organización`);
  }
  assert.ok(rutas >= 5, `encontré ${rutas} rutas de las pantallas del cliente: la búsqueda no está mirando nada`);
  assert.deepEqual(mal, []);
});

test('el cerebro abre cada transacción de la pregunta con su ámbito, y la caja se lo pasa', () => {
  const preguntar = sinComentarios(readFileSync(join(RAIZ, 'lib/agentes/executive/preguntar.ts'), 'utf8'));
  const aSecas = [...preguntar.matchAll(/conOrganizacion\(\s*([^,]+),/g)].map((m) => m[1]!.trim()).filter((x) => x !== 'p.ambito');
  assert.deepEqual(aSecas, [], 'una transacción del cerebro no abre el ámbito de la pregunta');
  const caja = sinComentarios(readFileSync(join(RAIZ, 'lib/agentes/executive/caja.ts'), 'utf8'));
  assert.match(caja, /ambito: ambitoDe\(contexto, pantalla\)/);
  assert.match(caja, /const zona = zonaDe\(contexto, pantalla\)/);
});
