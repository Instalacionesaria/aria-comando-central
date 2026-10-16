// La Fase 0 del modelo de datos multiempresa: las cuentas, el catálogo, la bandeja de entrada y los eventos.
// Tipo: Base + Catálogo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (plan de la Fase 0, 2026-10-16)
//
// Crece con cada paso de la Fase 0: cada prueba entra en el paso que crea lo que prueba, y dice la mutación que la
// pone en rojo. Hoy:
//
//   · toda tabla de `negocio` tiene su régimen escrito (`pruebas/apoyo/regimenes-de-negocio.ts`) — mutación: una
//     migración con una tabla nueva sin sumarla a la lista, o una tabla en dos listas.
//
// Corre como `migrador`: es una comprobación de catálogo, y el migrador ve la estructura aunque no vea las filas.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import {
  DE_LA_ORGANIZACION,
  DE_UNA_CUENTA,
  DE_UNA_CUENTA_O_DE_LA_ORGANIZACION,
} from '../apoyo/regimenes-de-negocio.ts';

let mig: Client;

before(async () => {
  mig = await conectar('migrador');
});

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

test('toda tabla de `negocio` tiene su régimen escrito, y uno solo', async () => {
  // Las tablas madre y las comunes; las particiones heredan el régimen de su madre.
  const enLaBase = (
    await filas<{ tabla: string }>(
      mig,
      `select c.relname as tabla
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'negocio' and c.relkind in ('r', 'p') and not c.relispartition
        order by 1`,
    )
  ).map((f) => f.tabla);

  const listas = [...DE_UNA_CUENTA, ...DE_UNA_CUENTA_O_DE_LA_ORGANIZACION, ...DE_LA_ORGANIZACION] as string[];
  const repetidas = listas.filter((t, i) => listas.indexOf(t) !== i);
  assert.deepEqual(repetidas, [], 'una tabla está en dos regímenes');

  const sinRegimen = enLaBase.filter((t) => !listas.includes(t));
  assert.deepEqual(sinRegimen, [], 'una tabla de negocio no tiene régimen: sumala a pruebas/apoyo/regimenes-de-negocio.ts');

  const queYaNoEstan = listas.filter((t) => !enLaBase.includes(t));
  assert.deepEqual(queYaNoEstan, [], 'la lista nombra una tabla que no existe en la base');
});
