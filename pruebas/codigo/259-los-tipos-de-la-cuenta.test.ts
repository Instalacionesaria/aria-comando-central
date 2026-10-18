// LOS TIPOS DICEN DE QUIÉN ES CADA TABLA, IGUAL QUE LA BASE. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// La Fase 0 del modelo de datos puso `cuenta_id` en las tablas de negocio (082 y 083), y por un tiempo los tipos de
// `lib/datos/esquema.ts` no lo supieron: el código no podía nombrar la cuenta de una fila sin mentirle al compilador.
// El nivel 3 (los clientes de cada empresa) empieza por ahí.
//
// La base ya tiene su lista: `pruebas/apoyo/regimenes-de-negocio.ts`, que la 257 compara con las columnas y las
// políticas reales. Esta prueba compara la MISMA lista con los tipos:
//   · de una cuenta → `cuenta_id: ColumnaCuenta` (obligatoria);
//   · de una cuenta o de la organización → `cuenta_id: ColumnaCuentaOpcional` (nula = de la organización);
//   · de la organización → sin `cuenta_id`.
// Así una tabla que cambia de régimen en la base y no en los tipos (o al revés) pone la suite en rojo.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import {
  DE_LA_ORGANIZACION,
  DE_UNA_CUENTA,
  DE_UNA_CUENTA_O_DE_LA_ORGANIZACION,
} from '../apoyo/regimenes-de-negocio.ts';

const ESQUEMA = readFileSync(join(RAIZ, 'lib/datos/esquema.ts'), 'utf8').replace(/\r\n/g, '\n');

/** La tabla → su interfaz, leído de `BaseDeDatos`. */
function interfaces(): Map<string, string> {
  const base = ESQUEMA.match(/export interface BaseDeDatos \{([\s\S]*?)\n\}/);
  assert.ok(base, 'no encontré `BaseDeDatos` en lib/datos/esquema.ts');
  return new Map([...(base[1] ?? '').matchAll(/^\s+'?([\w.]+)'?: (\w+);/gm)].map((m) => [m[1] ?? '', m[2] ?? '']));
}

/** El tipo de `cuenta_id` en la interfaz de esa tabla, o `null` si no la tiene. */
function columnaDeCuenta(tabla: string): string | null {
  const interfaz = interfaces().get(tabla);
  assert.ok(interfaz, `la tabla «${tabla}» no tiene tipo en BaseDeDatos`);
  const cuerpo = ESQUEMA.match(new RegExp(`export interface ${interfaz}\\b[^{]*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(cuerpo, `no encontré la interfaz ${interfaz}`);
  return (cuerpo[1] ?? '').match(/^\s+cuenta_id: (\w+);/m)?.[1] ?? null;
}

test('toda tabla DE UNA CUENTA tiene `cuenta_id: ColumnaCuenta` en los tipos', () => {
  const mal = DE_UNA_CUENTA.filter((t) => columnaDeCuenta(t) !== 'ColumnaCuenta');
  assert.deepEqual(mal, [], 'estas tablas son de una cuenta en la base y sus tipos no lo dicen');
});

test('toda tabla DE UNA CUENTA O DE LA ORGANIZACIÓN tiene `cuenta_id: ColumnaCuentaOpcional`', () => {
  const mal = DE_UNA_CUENTA_O_DE_LA_ORGANIZACION.filter((t) => columnaDeCuenta(t) !== 'ColumnaCuentaOpcional');
  assert.deepEqual(mal, [], 'estas tablas admiten una cuenta nula en la base y sus tipos no lo dicen');
});

test('ninguna tabla DE LA ORGANIZACIÓN tiene `cuenta_id` en los tipos', () => {
  const mal = DE_LA_ORGANIZACION.filter((t) => columnaDeCuenta(t) !== null);
  assert.deepEqual(mal, [], 'estas tablas no tienen cuenta en la base y sus tipos dicen que sí');
});

test('las dos columnas no se pueden actualizar: una fila no se muda de cuenta', () => {
  assert.match(ESQUEMA, /type ColumnaCuenta = ColumnType<string, string \| undefined, never>;/);
  assert.match(ESQUEMA, /type ColumnaCuentaOpcional = ColumnType<string \| null, string \| null \| undefined, never>;/);
});
