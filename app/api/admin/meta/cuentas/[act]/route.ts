// `PUT /api/admin/meta/cuentas/[act]` — asigna una cuenta publicitaria de Meta a un cliente, o la suelta.
//
// Asignar cambia de quién es el gasto de esa cuenta: desde la próxima pasada, sus campañas y su gasto entran en ese
// cliente. Por eso se audita. La base cumple la regla que la pantalla no puede saltar: una cuenta que conectó un cliente
// con su propio portfolio sólo va a ese cliente (`cuenta_de_meta_en_su_cliente`, 101), y acá ese caso es un 409.
import { exigir } from '../../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../../lib/autorizacion/respuesta.ts';
import { auditarAdministracion } from '../../../../../../lib/autenticacion/auditoria.ts';
import { conIdentidad } from '../../../../../../lib/datos/capa.ts';
import { vistaDeMeta } from '../../../../../../lib/meta/conexiones.ts';

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
      if (cuentaId !== null) {
        const cliente = await db
          .selectFrom('cuentas')
          .select('id')
          .where('org_id', '=', contexto.orgEfectiva)
          .where('id', '=', cuentaId)
          .where('estado', '<>', 'baja')
          .executeTakeFirst();
        if (!cliente) return rechazo('no_encontrado');
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
