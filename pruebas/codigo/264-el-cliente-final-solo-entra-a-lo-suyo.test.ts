// EL CLIENTE FINAL SÓLO ENTRA A LO SUYO, Y LO SUYO ESTÁ ESCRITO. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Paso 4)
//
// `lib/autorizacion/cliente.ts` tiene tres listas cortas: las pantallas, las capacidades y las rutas sin pantalla del
// cliente final. Esta prueba las ata al código, en las dos direcciones:
//
//   · cada ruta de `RUTAS_DEL_CLIENTE` existe, con ese método, y es de las abiertas a cualquier sesión: una entrada
//     muerta o una que pida una capacidad no sirve para nada — mutación: una ruta que no existe;
//   · las pantallas del cliente existen, y todo GET de esas pantallas pide sólo capacidades del cliente: si no, el
//     cliente final tendría la pantalla en el menú y un 403 al abrirla — mutación: una pantalla más sin su capacidad;
//   · el cerebro no es del cliente: lo paga la empresa — mutación: sumar `cerebro.usar`;
//   · la regla: sus rutas de sesión pasan siempre, sus pantallas sólo con alguna cuenta, y nada más — mutación:
//     dejar pasar `SIN_SECCION`;
//   · en el portero, el paso del cliente va ANTES del atajo de las rutas abiertas (`NINGUNA`) — mutación: moverlo
//     después.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, archivosFuente, sinComentarios } from '../apoyo/fuente.ts';
import {
  CAPACIDADES_DEL_CLIENTE,
  RUTAS_DEL_CLIENTE,
  SECCIONES_DEL_CLIENTE,
  rechazoDelCliente,
} from '../../lib/autorizacion/cliente.ts';
import { SECCIONES, SIN_SECCION } from '../../lib/autorizacion/secciones.ts';
import { CAPACIDADES } from '../../lib/autorizacion/capacidades.ts';

/** Lo que pide cada manejador de un archivo de ruta: método → el primer argumento de `exigir(` (texto). */
function exigencias(fuente: string): Map<string, string> {
  const salida = new Map<string, string>();
  const partes = fuente.split(/export async function (GET|POST|PUT|PATCH|DELETE)\b/);
  for (let i = 1; i < partes.length; i += 2) {
    const m = (partes[i + 1] ?? '').match(/exigir\(\s*peticion\s*,\s*(\[[^\]]*\]|NINGUNA)/);
    if (m) salida.set(partes[i]!, m[1]!);
  }
  return salida;
}

test('cada ruta del cliente existe con ese método, y es de las abiertas a cualquier sesión', () => {
  const mal: string[] = [];
  for (const ruta of RUTAS_DEL_CLIENTE) {
    const [metodo, camino] = ruta.split(' ') as [string, string];
    const archivo = join(RAIZ, 'app', camino, 'route.ts');
    if (!existsSync(archivo)) {
      mal.push(`${ruta}: no existe ${archivo}`);
      continue;
    }
    const pide = exigencias(sinComentarios(readFileSync(archivo, 'utf8'))).get(metodo);
    if (pide !== 'NINGUNA') mal.push(`${ruta}: pide ${pide ?? 'nada (¿existe el método?)'}`);
  }
  assert.deepEqual(mal, []);
});

test('las pantallas del cliente existen, y todo GET de ellas pide sólo capacidades del cliente', () => {
  const claves = new Set(SECCIONES.map((s) => s.clave));
  assert.deepEqual([...SECCIONES_DEL_CLIENTE].filter((s) => !claves.has(s)), [], 'una pantalla del cliente no existe');
  const mal: string[] = [];
  let rutas = 0;
  for (const a of archivosFuente(['app'])) {
    if (!a.ruta.endsWith('/route.ts')) continue;
    const pantalla = a.limpio.match(/export const PANTALLA = '([^']+)'/)?.[1];
    if (!pantalla || !SECCIONES_DEL_CLIENTE.has(pantalla)) continue;
    rutas += 1;
    const pide = exigencias(a.limpio).get('GET');
    if (pide === undefined) continue;
    const capacidades = [...pide.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
    if (!capacidades.some((c) => CAPACIDADES_DEL_CLIENTE.has(c))) mal.push(`${a.ruta}: GET pide ${pide}`);
  }
  assert.ok(rutas >= 2, `encontré ${rutas} rutas de las pantallas del cliente: la búsqueda no está mirando nada`);
  assert.deepEqual(mal, []);
});

test('las capacidades del cliente existen, y el cerebro no es una de ellas', () => {
  const todas = new Set<string>(CAPACIDADES);
  assert.deepEqual([...CAPACIDADES_DEL_CLIENTE].filter((c) => !todas.has(c)), []);
  assert.equal(CAPACIDADES_DEL_CLIENTE.has('cerebro.usar'), false, 'el cliente final usaría el cerebro que paga la empresa');
});

test('la regla: sus rutas de sesión siempre, sus pantallas con alguna cuenta, nada más', () => {
  assert.equal(rechazoDelCliente('POST /api/auth/sesion', SIN_SECCION, 0), null);
  assert.equal(rechazoDelCliente('GET /api/leads-portal', 'contacts', 1), null);
  assert.equal(rechazoDelCliente('GET /api/leads-portal', 'contacts', 0), 'sin_cuentas');
  assert.equal(rechazoDelCliente('GET /api/control', SIN_SECCION, 3), 'fuera_de_su_cuenta');
  assert.equal(rechazoDelCliente('GET /api/tools', 'tools', 3), 'fuera_de_su_cuenta');
  assert.equal(rechazoDelCliente('POST /api/executive', 'executive', 3), 'fuera_de_su_cuenta');
});

test('en el portero, el paso del cliente va antes del atajo de las rutas abiertas', () => {
  const portero = sinComentarios(readFileSync(join(RAIZ, 'lib/autorizacion/portero.ts'), 'utf8'));
  const cliente = portero.indexOf('rechazoDelCliente(');
  const atajo = portero.indexOf('capacidadesRequeridas === NINGUNA');
  assert.ok(cliente > 0 && atajo > 0, 'no encontré los dos pasos en el portero');
  assert.ok(cliente < atajo, 'las rutas abiertas a cualquier sesión pasarían sin mirar si es un cliente final');
});
