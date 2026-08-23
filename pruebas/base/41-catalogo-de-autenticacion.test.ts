// ADR-0403 — La búsqueda usa la misma expresión que el índice único. (la mitad de catálogo)
// ADR-0412 — Todo rol de plataforma exige segundo factor. INNEGOCIABLE.
// ADR-0414 — El estado de la sesión existe como dato.
// Tipo: Catálogo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS INVARIANTES DE LA AUTENTICACIÓN QUE VIVEN EN EL ESQUEMA
//
// Las tres filas de acá comparten una propiedad: **si el esquema no las sostiene, todo el
// mecanismo de arriba es decorativo**, y su ausencia no produce ningún error.
//
//   · sin la columna `estado` con su restricción, el encierro por contraseña temporal
//     desaparece y nada falla (08 § 10);
//   · sin la restricción de la bandera, un rol de plataforma sin segundo factor es una
//     escalada entre inquilinos que solo un condicional del backend detiene — y "un
//     condicional del backend se saltea con un script de mantenimiento" (03 § 3);
//   · sin el índice sobre `lower(email)`, la unicidad del correo depende de que todos los
//     caminos guarden en minúsculas.
//
// Se corre como **superusuario** a propósito: acá se prueban restricciones e índices, que
// existen para detener lo que saltea la aplicación. El rol con el que se conecta es parte de
// lo que se afirma — al revés que en `30-aislamiento`, donde conectarse con el rol
// propietario haría pasar todo sin que nada esté protegido.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas, unaFila } from '../apoyo/conexiones.ts';

let admin: Client;

before(async () => {
  admin = await conectar('admin');
});

after(async () => {
  await cerrarTodo();
});

// ─── ADR-0412 · el rol de plataforma y el segundo factor · RETIRADA ─────────
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTA FILA SE RETIRÓ, Y LAS PRUEBAS NO SE BORRARON: SE DIERON VUELTA
//
// `ADR-0412` decía que un rol de plataforma no puede existir sin exigir segundo factor, y lo
// hacía cumplir la restricción `roles_plataforma_exige_2fo` de la migración 003. Su comentario
// explicaba por qué era una invariante y no una convención:
//
//   "ese rol ve los datos de TODAS las organizaciones, y una contraseña filtrada sin segundo
//    factor es una brecha de todos los clientes a la vez."
//
// La migración 010 quita esa restricción, a pedido explícito de quien decide el producto.
//
// Borrar estas pruebas habría sido lo cómodo y lo peor: una invariante que desaparece sin
// dejar rastro es una invariante que nadie sabe que se fue. Invertidas, dicen dos cosas que la
// suite tiene que seguir sabiendo:
//
//   1. que la restricción YA NO ESTÁ, y que eso fue una decisión — si alguien la repone, esta
//      prueba falla y le cuenta que está volviendo atrás algo deliberado;
//   2. que la PERILLA sigue existiendo, así que volver a exigirlo por rol es cambiar una fila
//      más la rama 3 de `lib/autenticacion/estado.ts`, no rediseñar nada.
//
// Lo que se aceptó al retirarla está medido en la migración 010 y en `estado.ts`. En una línea:
// contra adivinar la contraseña no cambia nada —los dos frenos siguen—, y contra una contraseña
// ya filtrada el segundo factor era lo único que quedaba.
// ═══════════════════════════════════════════════════════════════════════════════

test('ADR-0412 · RETIRADA · la restricción del rol de plataforma ya no existe', async () => {
  const f = await unaFila<{ n: string }>(
    admin,
    `select count(*)::text as n from pg_constraint
      where conname = 'roles_plataforma_exige_2fo'`,
  );
  assert.equal(
    f?.n,
    '0',
    'volvió `roles_plataforma_exige_2fo`: si es a propósito, esta prueba y la rama 3 de ' +
      'lib/autenticacion/estado.ts tienen que volver con ella',
  );

  // LA GUARDA CONTRA EL FALSO VERDE, y acá no es teórica: si esta consulta buscara un nombre
  // mal escrito devolvería 0 igual, y la prueba pasaría sin verificar nada. Se comprueba que
  // el mecanismo funciona buscando una restricción que SÍ existe.
  const testigo = await unaFila<{ n: string }>(
    admin,
    `select count(*)::text as n from pg_constraint
      where conname = 'usuarios_credenciales_completas'`,
  );
  assert.equal(
    testigo?.n,
    '1',
    'la consulta de restricciones no encuentra una que sí existe: no está probando nada',
  );
});

test('ADR-0412 · RETIRADA · un rol de plataforma ya puede NO exigir segundo factor', async () => {
  // El complemento de la de arriba: que la restricción no esté en el catálogo es una cosa, y
  // que la base de verdad acepte la fila es otra. Todo en una transacción que se revierte.
  await admin.query('begin');
  let error: string | null = null;
  try {
    await admin.query(
      `insert into identidad.roles (clave, nombre, es_sistema, solo_principal, exige_segundo_factor)
       values ('sonda_plataforma', 'Sonda', false, true, false)`,
    );
  } catch (e) {
    error = String((e as Error).message);
  } finally {
    await admin.query('rollback');
  }
  assert.equal(error, null, `la base todavía lo rechaza: ${error}`);
});

test('ADR-0412 · RETIRADA · y APAGARLO en un rol existente tampoco falla', async () => {
  // El camino de la vida real: el rol ya existe y alguien lo edita. Antes lo cubría la misma
  // restricción `check` para `insert` y para `update`; ahora ninguno de los dos falla, y esto lo
  // demuestra en vez de suponerlo.
  await admin.query('begin');
  let error: string | null = null;
  try {
    await admin.query(
      `update identidad.roles set exige_segundo_factor = false where solo_principal`,
    );
  } catch (e) {
    error = String((e as Error).message);
  } finally {
    await admin.query('rollback');
  }
  assert.equal(error, null, `la base todavía lo rechaza: ${error}`);
});

test('ADR-0412 · RETIRADA · la PERILLA sigue existiendo: la columna no se borró', async () => {
  // Es la mitad que hace reversible la decisión. Borrar la columna habría sido una puerta de
  // una sola dirección: volver a exigir segundo factor por rol exigiría una migración que la
  // reponga y decidir de nuevo su valor para cada fila.
  //
  // Se afirma el TIPO además de la existencia: una columna que existiera como `text` no serviría
  // de perilla, y el síntoma sería un error de tipo en la consulta del login.
  const c = await unaFila<{ tipo: string; obligatoria: boolean }>(
    admin,
    `select format_type(a.atttypid, a.atttypmod) as tipo, a.attnotnull as obligatoria
       from pg_attribute a
      where a.attrelid = 'identidad.roles'::regclass
        and a.attname = 'exige_segundo_factor' and not a.attisdropped`,
  );
  assert.ok(c, 'se borró `exige_segundo_factor`: la decisión dejó de ser reversible');
  assert.equal(c.tipo, 'boolean');
  assert.equal(c.obligatoria, true, 'una perilla que admite nulos tiene tres estados, no dos');
});

// ─── ADR-0414 · el estado de la sesión existe como dato ─────────────────────

test('ADR-0414 · la columna `estado` existe, no admite nulos, y tiene su restricción', async () => {
  const col = await unaFila<{ tipo: string; nulos: string; omision: string | null }>(
    admin,
    `select data_type as tipo, is_nullable as nulos, column_default as omision
       from information_schema.columns
      where table_schema = 'identidad' and table_name = 'sesiones' and column_name = 'estado'`,
  );
  assert.ok(col, 'la columna `estado` no existe: todo el mecanismo de estados es decorativo');
  assert.equal(col.nulos, 'NO', '`estado` admite nulos: una sesión sin estado no está en ninguna lista');
  assert.ok(col.omision, '`estado` no tiene valor por omisión');

  // Los CUATRO valores, exactamente. No "al menos": si apareciera un quinto sin que nadie lo
  // agregue a `ESTADOS`, el portero lo trataría como estado desconocido —falla cerrado, que es
  // correcto— pero nadie podría entrar con él y el síntoma sería inexplicable.
  const restriccion = await unaFila<{ def: string }>(
    admin,
    `select pg_get_constraintdef(c.oid) as def
       from pg_constraint c
      where c.conrelid = 'identidad.sesiones'::regclass and c.contype = 'c'
        and pg_get_constraintdef(c.oid) like '%estado%'`,
  );
  assert.ok(restriccion, 'la columna `estado` no tiene restricción de valores');
  for (const valor of ['activa', 'pendiente_2fo', 'debe_cambiar_password', 'debe_configurar_2fo']) {
    assert.match(restriccion.def, new RegExp(`'${valor}'`), `falta el estado ${valor}`);
  }
});

test('ADR-0414 · un estado inventado se rechaza', async () => {
  // La restricción existe; esto demuestra que MUERDE. Una restricción declarada y no
  // ejercitada es una de las cosas que este proyecto no da por buena.
  const usuario = await unaFila<{ id: string }>(admin, 'select id from identidad.usuarios limit 1');
  assert.ok(usuario, 'no hay usuarios: ¿corrió el sembrado?');

  await admin.query('begin');
  let error: string | null = null;
  try {
    await admin.query(
      `insert into identidad.sesiones (usuario_id, token_hash, estado, expira_el)
       values ($1, 'sonda-de-estado', 'medio_activa', now() + interval '1 hour')`,
      [usuario.id],
    );
  } catch (e) {
    error = String((e as Error).message);
  } finally {
    await admin.query('rollback');
  }
  assert.ok(error !== null, 'se pudo crear una sesión con un estado inventado');
  assert.match(error, /estado/i, `rechazado por otro motivo: ${error}`);
});

// ─── ADR-0403 · la mitad de catálogo: el índice es sobre la EXPRESIÓN ───────

test('ADR-0403 · el índice único del correo es sobre `lower(email)`, no sobre la columna', async () => {
  // La otra mitad de esta fila —"un usuario guardado con mayúsculas puede entrar"— necesita el
  // login, que es de esta etapa. Ésta afirma la precondición: que el índice sea sobre la
  // expresión es lo que obliga a que la consulta use la misma.
  //
  // El 07 § 3: *"si el índice es `unique (lower(email))` y el login busca `where email = $1`,
  // funciona SOLO mientras todos los caminos guarden en minúsculas. El día que una carga
  // manual, una migración o un script meta una mayúscula, esa persona NO PUEDE ENTRAR y el
  // mensaje dice 'credenciales inválidas'."*
  const indices = await filas<{ nombre: string; def: string }>(
    admin,
    `select indexname as nombre, indexdef as def
       from pg_indexes
      where schemaname = 'identidad' and tablename = 'usuarios'
      order by 1`,
  );

  const delCorreo = indices.filter((i) => /email/i.test(i.def));
  assert.ok(delCorreo.length > 0, 'no hay ningún índice sobre el correo');

  const sobreLaExpresion = delCorreo.find((i) => /unique/i.test(i.def) && /lower\(/i.test(i.def));
  assert.ok(
    sobreLaExpresion,
    `ningún índice único usa lower(email): ${delCorreo.map((i) => i.def).join(' | ')}`,
  );
  // Y es PARCIAL: la especificación permite usuarios sin correo (01 § 3), y un único índice
  // total los haría chocar entre sí en el nulo… que en PostgreSQL no chocan, pero el índice
  // parcial lo deja explícito y más chico.
  assert.match(sobreLaExpresion.def, /where\s+\(?email\s+is\s+not\s+null/i);

  // Y la guarda que evita el falso verde por partida doble: que NO exista además un índice
  // único sobre la columna cruda. Si existiera, la unicidad estaría garantizada por los dos
  // lados y la consulta del login podría buscar por la columna sin que nada fallara — hasta
  // que alguien borrara el índice "redundante".
  const sobreLaColumna = delCorreo.filter(
    (i) => /unique/i.test(i.def) && !/lower\(/i.test(i.def),
  );
  assert.deepEqual(
    sobreLaColumna.map((i) => i.nombre),
    [],
    'hay un índice único sobre la columna cruda: enmascara si el login usa la expresión correcta',
  );
});
