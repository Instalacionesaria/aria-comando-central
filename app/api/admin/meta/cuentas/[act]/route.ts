// `PUT /api/admin/meta/cuentas/[act]` — asigna una cuenta publicitaria de Meta a un cliente, o la suelta.
//
// Asignar cambia de quién es el gasto de esa cuenta: desde la próxima pasada, sus campañas y su gasto entran en ese
// cliente. Por eso se audita. La base cumple la regla que la pantalla no puede saltar: una cuenta que conectó un cliente
// con su propio portfolio sólo va a ese cliente (`cuenta_de_meta_en_su_cliente`, 101), y acá ese caso es un 409.
//
// ── Y UNA CUENTA CON DATOS EN OTRO CLIENTE NO SE MUEVE (M10, 2026-10-27) ───────────
//
// Las claves de lo que trae Meta no llevan el cliente (`campanas (org_id, meta_campana_id)`, `gasto_por_cuenta_publicitaria
// (org_id, act_id, fecha)`…). Si el `act_` ya tiene filas leídas en el cliente A y se asigna a B, la pasada de B choca en
// cada `upsert` con la fila de A —la política de UPDATE de B no la ve— y falla en todas las pasadas, sin que nada lo
// diga en la pantalla. Así que se responde 409 ANTES de tocar la asignación. Soltarla (`null`) sí se puede: no lee nada.
//
// La comprobación se hace CON la fila bloqueada (`for update`, dentro de la transacción que reasigna): dos cambios a la
// vez de la misma cuenta —otro PUT, o un canje de OAuth— no deciden los dos sobre lo que había antes. Y una pasada del
// recolector ya en curso escribe con la misma fila en `for share` (`escribirSiSigueAsignada`): este candado espera a
// que su escritura confirme y la ve, o confirma antes y la pasada ya no escribe.
import { exigir } from '../../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../../lib/autorizacion/respuesta.ts';
import { auditarAdministracion } from '../../../../../../lib/autenticacion/auditoria.ts';
import { conIdentidad } from '../../../../../../lib/datos/capa.ts';
import { conOrganizacion } from '../../../../../../lib/datos/contexto.ts';
import { vistaDeMeta } from '../../../../../../lib/meta/conexiones.ts';
import { clientesConLoLeidoDeMeta, tieneDatosEnOtroCliente } from '../../../../../../lib/meta/loLeidoDeMeta.ts';

export const PANTALLA = 'credenciales';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(peticion: Request, ctx: RouteContext<'/api/admin/meta/cuentas/[act]'>): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const { act } = await ctx.params;
  if (!/^act_\d{1,30}$/.test(act)) return rechazo('no_encontrado');

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo de la petición no es JSON válido.');
  }
  const cuentaId = ((cuerpo ?? {}) as { cuentaId?: unknown }).cuentaId;
  if (cuentaId !== null && (typeof cuentaId !== 'string' || !UUID.test(cuentaId))) {
    return rechazo('peticion_invalida', 'El cliente va como su id, o null para soltar la cuenta.');
  }

  try {
    return await conIdentidad(async (db) => {
      // La fila, bloqueada hasta el final: la comprobación de abajo y la reasignación ven lo mismo.
      const fila = await db
        .selectFrom('cuentas_publicitarias_de_meta')
        .select('act_id')
        .where('org_id', '=', contexto.orgEfectiva)
        .where('act_id', '=', act)
        .forUpdate()
        .executeTakeFirst();
      if (!fila) return rechazo('no_encontrado');
      if (cuentaId !== null) {
        const cliente = await db
          .selectFrom('cuentas')
          .select('id')
          .where('org_id', '=', contexto.orgEfectiva)
          .where('id', '=', cuentaId)
          .where('estado', '<>', 'baja')
          .executeTakeFirst();
        if (!cliente) return rechazo('no_encontrado');
        /* Lo leído, en negocio (otro agrupador) y CON el candado tomado: se mira después de comprobar el cliente —uno
           ajeno sigue siendo un 404, no un 409— y antes de tocar la asignación. Si la lectura falla, no se escribió
           nada: la transacción de identidad se revierte con el error. */
        const leido = await conOrganizacion(contexto.orgEfectiva, () => clientesConLoLeidoDeMeta([act]));
        if (tieneDatosEnOtroCliente(leido, act, cuentaId)) {
          return rechazo(
            'cuenta_de_meta_con_datos',
            'Esta cuenta publicitaria ya tiene campañas o gasto leídos en otro cliente. Para moverla, primero hay que borrar lo leído en ese cliente.',
          );
        }
      }
      const r = await db
        .updateTable('cuentas_publicitarias_de_meta')
        .set({
          cuenta_id: cuentaId,
          asignada_por: cuentaId === null ? null : contexto.usuarioId,
          asignada_el: cuentaId === null ? null : new Date(),
        })
        .where('org_id', '=', contexto.orgEfectiva)
        .where('act_id', '=', act)
        .executeTakeFirst();
      if (Number(r.numUpdatedRows) === 0) return rechazo('no_encontrado');
      await auditarAdministracion(db, {
        accion: 'meta_cuenta_asignada',
        actor: contexto.usuarioId,
        objetivo: cuentaId ?? contexto.orgEfectiva,
        orgId: contexto.orgEfectiva,
      });
      return ok(await vistaDeMeta(db, contexto.orgEfectiva));
    });
  } catch (e) {
    // La cuenta la conectó un cliente con su portfolio: sólo va a ese cliente.
    if ((e as { code?: string }).code === '23514') {
      return rechazo('rechazo_de_la_base', 'Esta cuenta la conectó un cliente con su propio Meta: sólo se asigna a ese cliente.');
    }
    throw e;
  }
}
