// La puerta que el sembrado NO usó, y que tiene que estar cerrada.
//
// El sembrado escribe por `conIdentidad()` porque las otras cinco opciones están
// eliminadas (ver la cabecera de `db/sembrado/organizaciones.ts`). Esta prueba
// afirma la eliminación nº 1: un `insert` desde una migración, como `migrador`,
// FALLA POR POLÍTICA.
//
// Doce líneas que impiden que alguien "simplifique" el sembrado moviéndolo a una
// migración — que funcionaría en desarrollo y crearía dos organizaciones cliente
// con credenciales conocidas en el servidor administrado, porque LAS MIGRACIONES
// CORREN TAMBIÉN EN PRODUCCIÓN.
//
// Y hay una asimetría que el 09 § 2 subraya y que esta prueba aprovecha: de las
// cuatro operaciones, el `insert` es LA ÚNICA QUE AVISA. `select` devuelve cero
// filas, y `update`/`delete` informan "cero filas afectadas" SIN ERROR — es
// literalmente un éxito reportado que no ocurrió. Por eso "la escritura falló" no
// sirve como criterio de aislamiento: hay que verificar el EFECTO.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';

let mig: Client;

before(async () => {
  mig = await conectar('migrador');
});

after(async () => {
  await cerrarTodo();
});

test('un insert de `migrador` en organizaciones falla por política', async () => {
  await assert.rejects(
    () =>
      mig.query(
        `insert into identidad.organizaciones (nombre, slug) values ('Colada', 'colada-migrador')`,
      ),
    /row-level security|violates row-level security policy/i,
    'el propietario tiene que ser rechazado: ninguna política lo nombra',
  );
});

test('un insert de `migrador` en usuarios falla por política', async () => {
  await assert.rejects(
    () =>
      mig.query(
        `insert into identidad.usuarios (org_id, nombre)
         values ('00000000-0000-0000-0000-000000000001', 'Colada')`,
      ),
    /row-level security|violates row-level security policy/i,
  );
});

test('un update de `migrador` NO falla: informa cero filas, sin error', async () => {
  // Ésta es la asimetría peligrosa, afirmada para que quede documentada como
  // comportamiento y no como sorpresa. Una migración de datos que "corre bien" y no
  // toca nada queda marcada como aplicada, el despliegue sigue, y la columna nueva
  // queda vacía en producción. Nadie se entera hasta que una pantalla muestra nulos.
  const r = await mig.query(`update identidad.organizaciones set nombre = 'pisado'`);
  assert.equal(r.rowCount, 0, 'si esto afectó filas, el forzado de RLS no está puesto');

  // Y nada cambió de verdad: se comprueba el EFECTO con el rol que sí ve.
  const ident = await conectar('identidad');
  const pisadas = await unaFila<{ n: number }>(
    ident,
    `select count(*)::int as n from identidad.organizaciones where nombre = 'pisado'`,
  );
  assert.equal(pisadas?.n, 0);
});

test('ninguna colada quedó en la base', async () => {
  const ident = await conectar('identidad');
  const colada = await unaFila<{ n: number }>(
    ident,
    `select count(*)::int as n from identidad.organizaciones where slug = 'colada-migrador'`,
  );
  assert.equal(colada?.n, 0);
});
