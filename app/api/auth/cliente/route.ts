// ADR-0301 — Toda operación llama al portero.
//
// Cambiar de cliente: el foco de la sesión en un cliente de la empresa (el nivel 3), o en todos.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ CAMBIA
//
// `sesiones.cuenta_activa` (`087`). Con un cliente enfocado, las pantallas del cliente (Leads y Sales) leen sólo ese
// cliente, y la caja del cerebro también; el resto sigue siendo de la empresa entera (`lib/autorizacion/ambito.ts`).
//
// Sólo se puede enfocar un cliente que la sesión VE (`contexto.cuentas.visibles`): uno de otra empresa, de baja o —
// para un cliente final— que no es suyo, es 404. Y la sesión lo vuelve a comprobar al leerlo, así que una columna
// escrita por otra vía tampoco lo enfoca. Es de la propia sesión, sin pantalla, y la alcanza también el cliente final
// (`RUTAS_DEL_CLIENTE`): uno con dos cuentas elige cuál mira.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir, NINGUNA } from '../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../lib/autorizacion/secciones.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { auditar } from '../../../../lib/autenticacion/auditoria.ts';

export async function PATCH(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, NINGUNA, SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo de la petición no es JSON válido.');
  }
  const pedida = (cuerpo as { cuentaId?: unknown } | null)?.cuentaId;
  // `null` es un valor: «todos mis clientes».
  if (pedida !== null && typeof pedida !== 'string') return rechazo('peticion_invalida', 'Falta el cliente.');
  if (pedida !== null && !contexto.cuentas.visibles.some((c) => c.id === pedida)) return rechazo('no_encontrado');

  await conIdentidad(async (db) => {
    await db.updateTable('sesiones').set({ cuenta_activa: pedida }).where('id', '=', contexto.sesionId).execute();
    await auditar(db, {
      accion: 'cuenta_cambiada',
      usuarioId: contexto.usuarioId,
      orgId: contexto.orgEfectiva,
      detalle: { cuenta_destino: pedida },
    });
  });
  return ok({ cambiada: true, cuentaId: pedida });
}
