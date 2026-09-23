// LA COPIA ÚNICA DEL HISTORIAL DE LOS ANALIZADORES. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `scripts/copias/historial-analizador.sql` corre UNA vez, contra producción, como `postgres`. No
// hay prueba Base que la ejerza: las tablas de Brain no existen en la base local. Se ensayó a mano
// el 2026-09-23 dentro de una transacción con ROLLBACK —con sus trampas sembradas: un correo que ya
// existía, una reunión ya descubierta, una manual sin marcas— y la verificación de pares abortó el
// mutante que no copiaba las fichas.
//
// Lo que esta prueba fija es lo que no puede cambiar sin que se note en el texto:
//
//   · **ninguna llave**: ni la tabla de tl;dv de Brain ni la de sus llaves de IA;
//   · **una sola cuenta de origen y una sola organización destino**, y la guarda que comprueba que
//     el destino es `aria` antes de escribir;
//   · **un solo bloque `do`**, que es lo que la hace atómica;
//   · **el costo nulo**: Brain lo calculó con una tarifa sin confirmar.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';

const crudo = readFileSync(join(RAIZ, 'scripts/copias/historial-analizador.sql'), 'utf8');
/** El SQL sin los comentarios `--`: el encabezado NOMBRA las tablas prohibidas para decir que no se leen. */
const sql = crudo.replace(/--[^\n]*/g, '');

test('la copia no lee ninguna llave', () => {
  for (const prohibida of ['aria_brain_analyzer_tldv', 'aria_brain_client_keys', 'api_key']) {
    assert.ok(!sql.includes(prohibida), `la copia nombra \`${prohibida}\`: las llaves no se copian nunca`);
  }
});

test('una sola cuenta de origen, una sola organización destino, y la guarda antes de escribir', () => {
  const uuids = new Set(sql.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) ?? []);
  assert.deepEqual(
    [...uuids].sort(),
    ['57e90f8a-cc6d-4837-8f71-fb5f52c82b38', '610049a9-74e7-4397-83f9-33d797c4a054'],
    'la copia nombra otro identificador: una cuenta de Brain o una empresa que no se decidió',
  );
  assert.match(sql, /where id = v_org and slug = 'aria'/, 'falta la guarda que comprueba que el destino es `aria`');
  /* La guarda tiene que ir ANTES del primer `insert`: después, un destino equivocado ya escribió. */
  assert.ok(sql.indexOf("slug = 'aria'") < sql.indexOf('insert into'), 'la guarda del destino va después de escribir');
});

test('es UN solo bloque `do`, que es lo que la hace atómica', () => {
  const bloques = sql.match(/\bdo\s+\$copia\$/g) ?? [];
  assert.equal(bloques.length, 1);
  // Todo `insert` vive dentro del bloque: uno afuera se confirmaría aunque la verificación lance.
  const dentro = sql.slice(sql.indexOf('do $copia$'), sql.lastIndexOf('$copia$'));
  assert.equal((sql.match(/insert into/g) ?? []).length, (dentro.match(/insert into/g) ?? []).length);
  assert.ok((dentro.match(/raise exception/g) ?? []).length >= 6, 'la verificación de pares no cubre las seis tablas');
});

test('el costo del historial queda nulo, y cada insert se salta lo que ya está', () => {
  assert.ok(!/cost_usd/.test(sql), 'la copia trae `cost_usd` de Brain: se calculó con una tarifa sin confirmar');
  const inserts = sql.match(/insert into[\s\S]*?;/g) ?? [];
  assert.equal(inserts.length, 6);
  for (const i of inserts) assert.match(i, /on conflict do nothing;$/, `un insert no es idempotente: ${i.slice(0, 60)}`);
});
