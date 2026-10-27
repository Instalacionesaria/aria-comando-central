// Lo leído de Meta de cada cuenta publicitaria, y en qué cliente quedó (M10, 2026-10-27).
//
// Las claves de lo que trae Meta no llevan el cliente: `campanas (org_id, meta_campana_id)`, `gasto_por_cuenta_publicitaria
// (org_id, act_id, fecha)`… Si un `act_` ya tiene filas leídas en el cliente A y pasa a leerse en B, la pasada de B
// choca en cada `upsert` con la fila de A —la política de UPDATE de B no la ve— y falla en todas las pasadas, sin que
// nada lo diga en la pantalla. Así que ningún camino mueve un `act_` con datos en otro cliente:
//
//   · asignarlo a mano (`PUT /api/admin/meta/cuentas/[act]`) responde 409 `cuenta_de_meta_con_datos`;
//   · conectarlo por OAuth desde otro cliente (`guardarConexionDeMeta`, el canje) lo deja en su cliente y lo informa.
//
// Las dos comprueban CON la fila de `identidad.cuentas_publicitarias_de_meta` bloqueada (`for update`): dos cambios a
// la vez de la misma cuenta no pueden decidir los dos sobre lo que había antes.
//
// ── Y LA PASADA QUE YA ESTABA CORRIENDO (el cierre de la revisión, 2026-10-27) ─────────
//
// La pasada de Meta resuelve las cuentas de su cliente UNA vez al empezar y escribe durante minutos. Si mientras tanto
// el `act_` pasa de A a B y A todavía no tenía nada leído, la comprobación de arriba no ve nada y A escribe después:
// desde ahí B choca en todas sus pasadas. Así que cada escritura de la pasada va por `escribirSiSigueAsignada`: relee la
// asignación con la fila en `for share` y escribe en negocio SIN soltarla. El `for update` de la reasignación espera
// a que esa escritura confirme (y entonces ve lo escrito, y responde 409), o la reasignación confirma antes (y la
// pasada ve que el `act_` ya no es de A, y no escribe).

import { sql } from 'kysely';
import { conIdentidad } from '../datos/capa.ts';
import { conOrganizacion, datos } from '../datos/contexto.ts';
import { cuentaDe, type AmbitoDeUnCliente } from '../negocio/ambitoDelCliente.ts';

/** De cada `act_`, los clientes que tienen algo leído de Meta. Un `act_` sin nada leído no aparece. */
export type LoLeidoDeMeta = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * Los clientes con algo leído de cada `act_`: las cuatro tablas que llevan `act_id` (lo demás —las métricas por
 * desglose, los activos— cuelga de los anuncios). Corre DENTRO de un `conOrganizacion` con la organización entera a la
 * vista: quien llama lo abre, y con eso el cruce de dominios queda escrito en su archivo.
 */
export async function clientesConLoLeidoDeMeta(acts: readonly string[]): Promise<LoLeidoDeMeta> {
  const leido = new Map<string, Set<string>>();
  if (acts.length === 0) return leido;
  const lista = [...acts];
  const r = await sql<{ act_id: string; cuenta_id: string }>`
    select act_id, cuenta_id from negocio.campanas where act_id = any(${lista}::text[])
    union select act_id, cuenta_id from negocio.conjuntos_de_anuncios where act_id = any(${lista}::text[])
    union select act_id, cuenta_id from negocio.anuncios where act_id = any(${lista}::text[])
    union select act_id, cuenta_id from negocio.gasto_por_cuenta_publicitaria where act_id = any(${lista}::text[])`.execute(datos());
  for (const f of r.rows) {
    const clientes = leido.get(f.act_id) ?? new Set<string>();
    clientes.add(f.cuenta_id);
    leido.set(f.act_id, clientes);
  }
  return leido;
}

/** ¿El `act_` tiene algo leído en un cliente que NO es `cuentaId`? */
export function tieneDatosEnOtroCliente(leido: LoLeidoDeMeta, act: string, cuentaId: string): boolean {
  return [...(leido.get(act) ?? [])].some((c) => c !== cuentaId);
}

/**
 * Corre `trabajo` (una escritura de lo leído de Meta, en el ámbito del cliente) sólo si el `act_` SIGUE asignado a ese
 * cliente, con la fila de la asignación en `for share` hasta que la escritura confirma. `{ escrito: false }` = ya no es
 * suyo (se reasignó, se soltó o se borró su conexión): no se escribió nada.
 *
 * Cruza los dos dominios, y **si la segunda mitad falla no queda nada a medias**: de identidad sólo se LEE (y se
 * bloquea) la asignación; la única escritura es la de negocio, en su propia transacción. Si ésta falla, la de identidad
 * se revierte sin haber escrito nada y el error sube como antes.
 */
export async function escribirSiSigueAsignada<T>(
  ambito: AmbitoDeUnCliente,
  act: string,
  trabajo: () => Promise<T>,
): Promise<{ escrito: true; valor: T } | { escrito: false }> {
  return conIdentidad(async (db) => {
    const fila = await db
      .selectFrom('cuentas_publicitarias_de_meta')
      .select('cuenta_id')
      .where('org_id', '=', ambito.orgId)
      .where('act_id', '=', act)
      .forShare()
      .executeTakeFirst();
    if (!fila || fila.cuenta_id !== cuentaDe(ambito)) return { escrito: false as const };
    return { escrito: true as const, valor: await conOrganizacion(ambito, trabajo) };
  });
}
