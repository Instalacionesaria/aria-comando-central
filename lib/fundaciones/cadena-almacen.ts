// Leer y escribir el estado de «Construir el método» de una organización. Ver `cadena.ts`.
//
// Una fila por organización en `negocio.cadena_del_metodo` (migración 068). Las dos funciones
// corren DENTRO del contexto de la organización, que abre la ruta (`app/api/fundaciones/cadena`):
// es la ruta la que muestra el `exigir(` y el `conOrganizacion(`, como pide `ADR-0202`. Solo el
// servidor importa este módulo.

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { leerRegistro, type RegistroDeCadena } from './cadena.ts';

/** El registro guardado y cuánto hace que se escribió, medido por la base. */
export interface CadenaGuardada {
  registro: RegistroDeCadena | null;
  edadMs: number;
}

export async function leerCadena(orgId: string): Promise<CadenaGuardada> {
  const fila = await datos()
    .selectFrom('cadena_del_metodo')
    .select(['registro', sql<number>`(extract(epoch from (now() - actualizado_el)) * 1000)::float8`.as('edad')])
    .where('org_id', '=', orgId)
    .executeTakeFirst();
  if (!fila) return { registro: null, edadMs: 0 };
  return { registro: leerRegistro(fila.registro), edadMs: Number(fila.edad) || 0 };
}

/** Guarda el estado de la cadena, o lo borra con `null` (terminó, o la persona la cerró). */
export async function guardarCadena(orgId: string, registro: RegistroDeCadena | null): Promise<void> {
  const db = datos();
  if (registro === null) {
    await db.deleteFrom('cadena_del_metodo').where('org_id', '=', orgId).execute();
    return;
  }
  const json = JSON.stringify(registro);
  await db
    .insertInto('cadena_del_metodo')
    .values({ org_id: orgId, registro: json } as never)
    // `now()` de la base y no la hora de este servidor: la edad se mide con el mismo reloj (`leerCadena`).
    .onConflict((oc) => oc.column('org_id').doUpdateSet({ registro: json, actualizado_el: sql`now()` } as never))
    .execute();
}
