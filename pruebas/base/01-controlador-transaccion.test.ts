// ADR-0001 — LA COMPUERTA de la Etapa 0.
//
// EJECUCION § 5: "Antes de nada, la prueba del controlador, que decide si el resto
// del diseño es implementable. Si eso no funciona con el controlador elegido, SE
// PARA Y SE AVISA: hay que cambiar de controlador antes de escribir una línea más."
//
// Corre contra un PostgreSQL DESNUDO, como el rol administrativo, antes de que
// existan los tres roles y los dos esquemas. Verifica la primitiva sobre la que se
// apoya TODO el aislamiento: una variable con alcance de transacción.
//
// Esta prueba NO verifica aislamiento. Verifica que la primitiva existe. La que
// verifica aislamiento —"sin organización en contexto no se ve nada"— es de la
// Etapa 2 y corre con app_inquilino contra tablas con políticas.

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';

const url = process.env.DATABASE_URL_ADMIN;
if (!url) {
  throw new Error(
    'DATABASE_URL_ADMIN no está definida. Copiá .env.example a .env.local y completala, ' +
      'o corré `npm run db:credenciales`. La compuerta necesita el rol administrativo porque ' +
      'en su primera ejecución los tres roles del diseño todavía no existen.',
  );
}

const db = new Kysely<Record<string, never>>({
  dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: url, max: 1 }) }),
});

test.after(async () => {
  await db.destroy();
});

test('la variable con alcance de transacción vive y muere con la transacción', async () => {
  const org = randomUUID();

  const despues = await db.connection().execute(async (conn) => {
    // TODO esto pasa en la MISMA conexión física. `db.connection()` entrega un
    // Kysely atado a un único proveedor de conexión. Sin esto la lectura de
    // después podría caer en otro backend del agrupador y la prueba no
    // verificaría absolutamente nada — pasaría por el motivo equivocado.
    const antes = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(conn);
    const pid = antes.rows[0]?.pid;
    assert.ok(pid, 'no se pudo leer el pid del backend');

    const dentro = await conn.transaction().execute(async (trx) => {
      const enTrx = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(trx);
      assert.equal(enTrx.rows[0]?.pid, pid, 'la transacción corrió en OTRA conexión');

      // `SET` NO ACEPTA PARÁMETROS (08 § 1). Escrito a mano obligaría a
      // interpolar el valor en el texto de la consulta, que es exactamente lo
      // que no se quiere hacer con un identificador que viene de una sesión.
      // `set_config` es una función normal y toma parámetros.
      const puesto = await sql<{ puesto: string }>`
        select set_config('app.org_id', ${org}, true) as puesto
      `.execute(trx);

      // La VERIFICACIÓN PROPIA que exige el 08 § 1: después de poner la variable,
      // leerla y confirmar que quedó. Es el contrato que va a usar la capa fina de
      // la Etapa 2, y también la única defensa contra un agrupador en modo
      // sentencia, que rompe el alcance de transacción sin avisar.
      assert.equal(puesto.rows[0]?.puesto, org, 'set_config no devolvió lo que dice haber puesto');

      const leida = await sql<{ v: string | null }>`
        select current_setting('app.org_id', true) as v
      `.execute(trx);
      return leida.rows[0]?.v ?? null;
    });

    assert.equal(dentro, org, 'la variable no se ve DENTRO de la transacción');

    const fuera = await sql<{ v: string | null }>`
      select current_setting('app.org_id', true) as v
    `.execute(conn);
    return fuera.rows[0]?.v ?? null;
  });

  // Cerrada la transacción: NULO la primera vez en esta conexión, CADENA VACÍA a
  // partir de ahí — "el valor de reposo del parámetro no vuelve a nulo: queda en
  // cadena vacía" (08 § 1, 09 § 1). Las DOS son correctas.
  //
  // Exigir exactamente una hace una prueba que pasa o falla según cuántas veces se
  // usó la conexión antes, y es el mismo motivo por el que toda política lleva
  // `nullif(btrim(...), '')` antes del casteo: `''::uuid` LANZA error de sintaxis.
  assert.ok(
    despues === null || despues === '',
    `quedó ${JSON.stringify(despues)} después de cerrar la transacción`,
  );
});

test('fuera de una transacción, set_config tiene éxito y NO HACE NADA, sin avisar', async () => {
  // 08 § 1: "Fuera de una transacción, `set local` al menos AVISA con una
  // advertencia de que no hizo nada. La forma parametrizable —set_config(…, true)—
  // NO AVISA NADA: tiene éxito y no hace nada."
  //
  // Por eso el diseño necesita la verificación propia del test anterior: no hay
  // advertencia que delate una operación que cree tener contexto y no lo tiene.
  const org = randomUUID();
  await db.connection().execute(async (conn) => {
    await sql`select set_config('app.org_id', ${org}, true)`.execute(conn);
    const leida = await sql<{ v: string | null }>`
      select current_setting('app.org_id', true) as v
    `.execute(conn);
    const v = leida.rows[0]?.v ?? null;
    assert.ok(v === null || v === '', `la variable SOBREVIVIÓ fuera de una transacción: ${v}`);
  });
});

test('el casteo desnudo de la variable lanza — por eso las políticas llevan nullif', async () => {
  // Justifica con una afirmación, y no con un comentario, la forma exacta que
  // tiene que tener CADA política del proyecto. Si esto dejara de lanzar, el
  // `nullif(btrim(...), '')` sería decorativo y alguien lo borraría.
  await db.connection().execute(async (conn) => {
    await sql`select set_config('app.org_id', '', true)`.execute(conn);
    await assert.rejects(
      () => sql`select current_setting('app.org_id', true)::uuid`.execute(conn),
      /invalid input syntax for type uuid/i,
      'castear la cadena vacía a uuid tendría que lanzar',
    );
    const conNullif = await sql<{ v: string | null }>`
      select nullif(btrim(current_setting('app.org_id', true)), '')::uuid as v
    `.execute(conn);
    assert.equal(conNullif.rows[0]?.v ?? null, null, 'con nullif tiene que dar nulo, no lanzar');
  });
});

test('has_table_privilege NO ve los permisos por columna — decide una fila ⛔ de la Etapa 1', async () => {
  // PRUEBAS Etapa 1 ⛔ dice: "la tabla es accesible para el rol que la usa —
  // has_table_privilege por tabla". Pero el 09 § 2 otorga `select (id, org_id,
  // nombre, email, activo)` sobre identidad.usuarios: un permiso POR COLUMNA.
  //
  // Si has_table_privilege no ve los permisos por columna, esa fila ⛔ FALLARÍA
  // SOBRE CÓDIGO CORRECTO — y una prueba que falla sobre lo correcto se termina
  // comentando. Se verifica acá, contra la versión real, antes de que algo
  // dependa de la respuesta.
  await db.connection().execute(async (conn) => {
    // Tabla TEMPORAL, no en `public`.
    //
    // Una sonda que crea un objeto global compite con la prueba de catálogo que
    // enumera los objetos globales — y el resultado es una falla que aparece y
    // desaparece según el orden, que es como se aprende a volver a correr la suite
    // hasta que da verde. Una tabla temporal vive en el esquema de la sesión y no la
    // ve nadie más.
    await sql`drop role if exists sonda_lector`.execute(conn);
    await sql`create role sonda_lector`.execute(conn);
    await sql`create temp table sonda_permisos (a int, b int)`.execute(conn);
    await sql`grant select (a) on sonda_permisos to sonda_lector`.execute(conn);

    const r = await sql<{ tabla: boolean; col_a: boolean; col_b: boolean }>`
      select has_table_privilege('sonda_lector', 'sonda_permisos', 'SELECT')  as tabla,
             has_column_privilege('sonda_lector', 'sonda_permisos', 'a', 'SELECT') as col_a,
             has_column_privilege('sonda_lector', 'sonda_permisos', 'b', 'SELECT') as col_b
    `.execute(conn);
    const f = r.rows[0];

    assert.equal(f?.col_a, true, 'has_column_privilege tendría que ver la columna otorgada');
    assert.equal(f?.col_b, false, 'has_column_privilege NO tendría que ver la columna no otorgada');
    // Ésta es la afirmación que decide el diseño de la prueba de la Etapa 1.
    assert.equal(
      f?.tabla,
      false,
      'has_table_privilege VE los permisos por columna en esta versión: revisar la ' +
        'prueba de catálogo de la Etapa 1, la premisa cambió',
    );

    await sql`drop table sonda_permisos`.execute(conn);
    await sql`drop role sonda_lector`.execute(conn);
  });
});
