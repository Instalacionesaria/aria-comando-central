// Las conexiones de Meta (101) y el token pegado a mano: el puente de la transición.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE (Meta directo, M1, 2026-10-26)
//
// Desde la `101` quien lee Meta es `resolverCuentasDeMeta`, sobre `identidad.conexiones_de_meta` y
// `identidad.cuentas_publicitarias_de_meta`. Pero Ajustes todavía deja pegar un token y un `act_…` (las columnas `meta_*`
// de `organizaciones_credenciales` y `cuentas_credenciales`), y mientras ese campo exista, lo que se pega tiene que
// llegar a las tablas nuevas: si no, la pantalla diría «cargado» y nadie lo leería. La fase
// `meta-manual-a-conexiones` copia lo que ya estaba; esto copia lo que se cambie después, en la misma transacción que
// el cambio.
//
// Las reglas son las de la fase (`db/arranque/007_meta_manual_a_conexiones.sql`): una conexión `manual` por cliente
// —el token de la empresa es la del cliente principal—, con su cuenta asignada a ese cliente. Una cuenta que ya tomó una
// conexión por OAuth no se pisa: el botón gana sobre el token pegado.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Trx } from '../datos/capa.ts';
import { cuentaDeMeta } from '../credenciales/resolver.ts';

/**
 * Deja la conexión manual de un cliente igual a lo que tienen hoy sus columnas `meta_*`: con token y cuenta válida la
 * crea o actualiza (y asigna la cuenta); sin alguno de los dos, la borra (y con ella, sus cuentas). `cuentaId` es el
 * cliente; para el principal, las columnas que cuentan son las de la empresa.
 */
export async function copiarMetaManual(db: Trx, orgId: string, cuentaId: string): Promise<void> {
  const cliente = await db
    .selectFrom('cuentas')
    .select(['id', 'es_por_omision'])
    .where('org_id', '=', orgId)
    .where('id', '=', cuentaId)
    .executeTakeFirst();
  if (!cliente) return;

  const fila = cliente.es_por_omision
    ? await db
        .selectFrom('organizaciones_credenciales')
        .select(['meta_token_cifrado', 'meta_cuenta_id'])
        .where('org_id', '=', orgId)
        .executeTakeFirst()
    : await db
        .selectFrom('cuentas_credenciales')
        .select(['meta_token_cifrado', 'meta_cuenta_id'])
        .where('org_id', '=', orgId)
        .where('cuenta_id', '=', cuentaId)
        .executeTakeFirst();

  const token = fila?.meta_token_cifrado?.trim() ? fila.meta_token_cifrado : null;
  const act = cuentaDeMeta(fila?.meta_cuenta_id);

  if (token === null || act === null) {
    await db
      .deleteFrom('conexiones_de_meta')
      .where('org_id', '=', orgId)
      .where('cuenta_id', '=', cuentaId)
      .where('origen', '=', 'manual')
      .execute();
    return;
  }

  const conexion = await db
    .insertInto('conexiones_de_meta')
    .values({ org_id: orgId, cuenta_id: cuentaId, token_cifrado: token, origen: 'manual', estado: 'activa' })
    .onConflict((oc) =>
      oc
        .columns(['org_id', 'cuenta_id'])
        .where('origen', '=', 'manual')
        .doUpdateSet({ token_cifrado: token, estado: 'activa', ultimo_error: null, ultimo_error_el: null }),
    )
    .returning('id')
    .executeTakeFirstOrThrow();

  // La cuenta vieja de esta conexión, si cambió el `act_`, se suelta: la manual tiene una sola cuenta.
  await db
    .deleteFrom('cuentas_publicitarias_de_meta')
    .where('org_id', '=', orgId)
    .where('conexion_id', '=', conexion.id)
    .where('act_id', '<>', act)
    .execute();

  await db
    .insertInto('cuentas_publicitarias_de_meta')
    .values({ org_id: orgId, act_id: act, conexion_id: conexion.id, cuenta_id: cuentaId, asignada_el: new Date() })
    .onConflict((oc) => oc.columns(['org_id', 'act_id']).doNothing())
    .execute();
}
