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

// ═══════════════════════════════════════════════════════════════════════════════
// «CONECTAR CON META» (M2): GUARDAR, LISTAR, ASIGNAR Y DESCONECTAR
// ═══════════════════════════════════════════════════════════════════════════════

/** Una cuenta que devolvió Meta al conectar (`cuentasDelToken`). */
export interface CuentaConectada {
  act: string;
  nombre: string | null;
  moneda: string | null;
  zonaHoraria: string | null;
  estado: number | null;
}

/**
 * Guarda una conexión por OAuth con sus cuentas. Volver a conectar el mismo negocio reemplaza el token (no suma una
 * conexión), y las cuentas que el negocio ya no le da a la app se sueltan.
 *
 * A qué cliente va cada cuenta:
 *   · si conectó un CLIENTE con su portfolio, todas van a ese cliente (son suyas);
 *   · si conectó la EMPRESA, una cuenta que ya estaba asignada sigue donde estaba; una nueva queda sin asignar, salvo
 *     que la empresa tenga un solo cliente activo, que la recibe sola (el caso de hoy: una empresa, un negocio).
 * Una cuenta que ya leía otra conexión (la manual de antes, u otro portfolio) pasa a leerse con ésta: el botón gana.
 */
export async function guardarConexionDeMeta(
  db: Trx,
  datos: {
    orgId: string;
    cuentaId: string | null;
    tokenCifrado: string;
    negocio: string | null;
    usuarioId: string;
    cuentas: readonly CuentaConectada[];
  },
): Promise<{ conexionId: string }> {
  const { orgId, cuentaId } = datos;
  const conexion = await db
    .insertInto('conexiones_de_meta')
    .values({
      org_id: orgId,
      cuenta_id: cuentaId,
      token_cifrado: datos.tokenCifrado,
      negocio_de_meta_id: datos.negocio,
      origen: 'oauth',
      estado: 'activa',
      conectada_por: datos.usuarioId,
    })
    .onConflict((oc) =>
      oc
        .columns(['org_id', 'cuenta_id', 'negocio_de_meta_id'])
        .where('origen', '=', 'oauth')
        .doUpdateSet({
          token_cifrado: datos.tokenCifrado,
          estado: 'activa',
          conectada_por: datos.usuarioId,
          conectada_el: new Date(),
          ultimo_error: null,
          ultimo_error_el: null,
        }),
    )
    .returning('id')
    .executeTakeFirstOrThrow();

  // El cliente que recibe sola una cuenta nueva de la empresa: el único activo, si hay uno solo.
  let unico: string | null = null;
  if (cuentaId === null) {
    const activos = await db
      .selectFrom('cuentas')
      .select('id')
      .where('org_id', '=', orgId)
      .where('estado', '=', 'activa')
      .limit(2)
      .execute();
    unico = activos.length === 1 ? activos[0]!.id : null;
  }

  const ahora = new Date();
  for (const c of datos.cuentas) {
    const asignada = cuentaId ?? unico;
    await db
      .insertInto('cuentas_publicitarias_de_meta')
      .values({
        org_id: orgId,
        act_id: c.act,
        conexion_id: conexion.id,
        nombre: c.nombre,
        moneda: c.moneda,
        zona_horaria: c.zonaHoraria,
        estado_en_meta: c.estado,
        cuenta_id: asignada,
        asignada_por: asignada ? datos.usuarioId : null,
        asignada_el: asignada ? ahora : null,
        vista_el: ahora,
      })
      .onConflict((oc) =>
        oc.columns(['org_id', 'act_id']).doUpdateSet((eb) => ({
          conexion_id: conexion.id,
          nombre: c.nombre,
          moneda: c.moneda,
          zona_horaria: c.zonaHoraria,
          estado_en_meta: c.estado,
          vista_el: ahora,
          // De un cliente: es suya. De la empresa: la que ya estaba asignada sigue donde estaba.
          cuenta_id: cuentaId !== null ? cuentaId : eb.fn.coalesce(eb.ref('cuentas_publicitarias_de_meta.cuenta_id'), eb.val(unico)),
        })),
      )
      .execute();
  }

  // Lo que el negocio ya no le da a la app (lo desmarcó en Meta) deja de leerse con esta conexión.
  const vigentes = datos.cuentas.map((c) => c.act);
  let soltar = db.deleteFrom('cuentas_publicitarias_de_meta').where('org_id', '=', orgId).where('conexion_id', '=', conexion.id);
  if (vigentes.length > 0) soltar = soltar.where('act_id', 'not in', vigentes);
  await soltar.execute();

  return { conexionId: conexion.id };
}

/** Lo que Ajustes muestra de Meta: las conexiones y sus cuentas, sin un solo token. */
export interface VistaDeMeta {
  conexiones: {
    id: string;
    cliente: string | null;
    origen: 'oauth' | 'manual';
    estado: 'activa' | 'revocada' | 'vencida';
    negocio: string | null;
    conectadaEl: Date;
    ultimoError: string | null;
  }[];
  cuentas: {
    act: string;
    nombre: string | null;
    moneda: string | null;
    zonaHoraria: string | null;
    estadoEnMeta: number | null;
    conexionId: string;
    cliente: string | null;
  }[];
  clientes: { id: string; nombre: string; esPorOmision: boolean }[];
}

export async function vistaDeMeta(db: Trx, orgId: string): Promise<VistaDeMeta> {
  const [conexiones, cuentas, clientes] = await Promise.all([
    db
      .selectFrom('conexiones_de_meta')
      .select(['id', 'cuenta_id', 'origen', 'estado', 'negocio_de_meta_id', 'conectada_el', 'ultimo_error'])
      .where('org_id', '=', orgId)
      .orderBy('conectada_el')
      .execute(),
    db
      .selectFrom('cuentas_publicitarias_de_meta')
      .select(['act_id', 'nombre', 'moneda', 'zona_horaria', 'estado_en_meta', 'conexion_id', 'cuenta_id'])
      .where('org_id', '=', orgId)
      .orderBy('act_id')
      .execute(),
    db
      .selectFrom('cuentas')
      .select(['id', 'nombre', 'es_por_omision'])
      .where('org_id', '=', orgId)
      .where('estado', '<>', 'baja')
      .orderBy('es_por_omision', 'desc')
      .orderBy('nombre')
      .execute(),
  ]);
  return {
    conexiones: conexiones.map((c) => ({
      id: c.id,
      cliente: c.cuenta_id,
      origen: c.origen,
      estado: c.estado,
      negocio: c.negocio_de_meta_id,
      conectadaEl: c.conectada_el,
      ultimoError: c.ultimo_error,
    })),
    cuentas: cuentas.map((c) => ({
      act: c.act_id,
      nombre: c.nombre,
      moneda: c.moneda,
      zonaHoraria: c.zona_horaria,
      estadoEnMeta: c.estado_en_meta,
      conexionId: c.conexion_id,
      cliente: c.cuenta_id,
    })),
    clientes: clientes.map((c) => ({ id: c.id, nombre: c.nombre, esPorOmision: c.es_por_omision })),
  };
}

/**
 * Marca `revocada` las conexiones cuyo token Meta rechazó (código 190: el negocio quitó la integración, o venció). Sólo
 * las que siguen activas: una que alguien volvió a conectar mientras corría el cron no se toca, porque su token es otro
 * y la fecha de la conexión es posterior. Corre en identidad (la ruta del cron).
 */
export async function marcarConexionesCaidas(db: Trx, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .updateTable('conexiones_de_meta')
    .set({ estado: 'revocada', ultimo_error: 'Meta rechazó el token: el negocio quitó la integración o venció', ultimo_error_el: new Date() })
    .where('id', 'in', ids)
    .where('estado', '=', 'activa')
    .where('conectada_el', '<', new Date(Date.now() - 60_000))
    .execute();
}
