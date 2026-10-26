// Lo que se hace cuando Meta avisa que quitaron la app o que piden borrar los datos (Meta directo, M6).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS DOS AVISOS
//
//   · **Desautorización** (`/api/meta/desautorizado`): el negocio quitó la integración en su Business Manager. Sus
//     conexiones quedan `revocada`, igual que cuando Meta responde 190 en una pasada (`marcarConexionesCaidas`): dejan
//     de leerse y el cliente ve «la conexión con Meta se cayó». No se borra nada: puede volver a conectar.
//   · **Borrado de datos** (`/api/meta/borrado`): se anota el pedido, se borra lo leído con esas conexiones en cada
//     cliente (`borrarLoLeidoDeMeta`) y después las conexiones, con su token y sus cuentas. La constancia
//     (`pedidos_de_borrado_de_meta`) lleva un código que Meta le muestra a quien lo pidió, y con el que la página
//     `/meta/borrado/<código>` dice en qué quedó.
//
// Los dos encuentran las conexiones por el id en la app de quien firmó (`usuario_de_meta_id`, `104`), que puede tenerlas
// en varias organizaciones: por eso no filtran por una. Uno que no tiene ninguna es una respuesta válida: se contesta
// igual, porque Meta reintenta lo que no recibe un 200.
//
// Las funciones reciben la transacción de identidad: la abre la ruta (o la página), como el canje y el cron.
// ═══════════════════════════════════════════════════════════════════════════════
import { createHash, randomBytes } from 'node:crypto';
import type { Trx } from '../datos/capa.ts';

/** El sha256 en hexadecimal de un código de confirmación: lo único que se guarda de él. */
export function hashDelCodigo(codigo: string): string {
  return createHash('sha256').update(codigo).digest('hex');
}

/** Marca `revocada` toda conexión activa de ese usuario de Meta. Devuelve cuántas. */
export async function desautorizar(db: Trx, usuarioDeMeta: string): Promise<number> {
  const r = await db
    .updateTable('conexiones_de_meta')
    .set({ estado: 'revocada', ultimo_error: 'El negocio quitó la app de Meta', ultimo_error_el: new Date() })
    .where('usuario_de_meta_id', '=', usuarioDeMeta)
    .where('estado', '=', 'activa')
    .executeTakeFirst();
  return Number(r.numUpdatedRows);
}

/** Un pedido de borrado ya anotado: qué hay que borrar en cada organización, y con qué cerrarlo. */
export interface PedidoDeBorrado {
  /** El código en claro: sólo para la respuesta a Meta. */
  codigo: string;
  codigoHash: string;
  conexiones: string[];
  /** Por organización, sus cuentas publicitarias de esas conexiones y TODOS sus clientes: lo leído de una cuenta queda en
      el cliente al que estaba asignada al leerse, que puede no ser el de hoy. */
  porOrganizacion: { orgId: string; acts: string[]; clientes: string[] }[];
}

/**
 * Anota el pedido —así uno que se corta a la mitad queda visible como «en curso»— y junta lo que hay que borrar.
 */
export async function anotarPedidoDeBorrado(db: Trx, usuarioDeMeta: string): Promise<PedidoDeBorrado> {
  const codigo = randomBytes(16).toString('hex');
  const codigoHash = hashDelCodigo(codigo);
  const conexiones = await db.selectFrom('conexiones_de_meta').select(['id', 'org_id']).where('usuario_de_meta_id', '=', usuarioDeMeta).execute();
  const ids = conexiones.map((c) => c.id);
  const cuentas = ids.length === 0 ? [] : await db.selectFrom('cuentas_publicitarias_de_meta').select(['org_id', 'act_id']).where('conexion_id', 'in', ids).execute();
  await db
    .insertInto('pedidos_de_borrado_de_meta')
    .values({ codigo_hash: codigoHash, usuario_de_meta_id: usuarioDeMeta, conexiones: ids.length, cuentas: cuentas.length })
    .execute();

  const orgs = [...new Set(cuentas.map((c) => c.org_id))];
  const clientes = orgs.length === 0 ? [] : await db.selectFrom('cuentas').select(['org_id', 'id']).where('org_id', 'in', orgs).execute();
  return {
    codigo,
    codigoHash,
    conexiones: ids,
    porOrganizacion: orgs.map((orgId) => ({
      orgId,
      acts: cuentas.filter((c) => c.org_id === orgId).map((c) => c.act_id),
      clientes: clientes.filter((c) => c.org_id === orgId).map((c) => c.id),
    })),
  };
}

/** Borra las conexiones (con sus cuentas, en cascada) y marca el pedido como hecho. */
export async function cerrarPedidoDeBorrado(db: Trx, pedido: PedidoDeBorrado): Promise<void> {
  if (pedido.conexiones.length > 0) await db.deleteFrom('conexiones_de_meta').where('id', 'in', pedido.conexiones).execute();
  await db.updateTable('pedidos_de_borrado_de_meta').set({ borrado_el: new Date() }).where('codigo_hash', '=', pedido.codigoHash).execute();
}

/** En qué quedó un pedido, por su código. `null` si no hay ninguno con ese código. */
export async function estadoDelBorrado(db: Trx, codigo: string): Promise<{ pedidoEl: Date; borradoEl: Date | null } | null> {
  if (!/^[0-9a-f]{32}$/.test(codigo)) return null;
  const fila = await db
    .selectFrom('pedidos_de_borrado_de_meta')
    .select(['pedido_el', 'borrado_el'])
    .where('codigo_hash', '=', hashDelCodigo(codigo))
    .executeTakeFirst();
  return fila ? { pedidoEl: fila.pedido_el, borradoEl: fila.borrado_el } : null;
}
