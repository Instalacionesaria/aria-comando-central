// ADR-0301 — Toda operación llama al portero.
//
// Vincular un cliente con su subcuenta del CRM, o marcarlo de prueba. **Sólo la plataforma.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ES APARTE, Y POR IDENTIDAD
//
// La subcuenta del CRM (`identidad.cuentas.crm_cuenta_id`) es única en toda la plataforma: una empresa que pudiera
// escribirla podría ocupar la location de otra, y cuando la ingesta se resuelva por location, los avisos de esa otra
// empresa llegarían a su cliente. La marca de prueba saca al cliente de toda métrica agregada y de los benchmarks.
// Las dos las escribe sólo ARIA: la capacidad `cuentas.vincular` no la tiene ningún rol de una empresa, y el
// inquilino no tiene permiso sobre esas columnas (`086`). Por eso esta ruta escribe por identidad.
//
// Una subcuenta que ya es de otro cliente —o de una empresa, que es la de su cliente principal— sale como
// `subcuenta_en_uso` (409), sin decir de quién. La del cliente principal es la de su empresa y se carga en Ajustes ›
// Credenciales: acá es `cliente_principal` (409), para que no haya dos lugares donde escribirla.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../../lib/autorizacion/respuesta.ts';
import { esDeLaPrincipal } from '../../../../../../lib/autorizacion/secciones.ts';
import { conIdentidad } from '../../../../../../lib/datos/capa.ts';
import { auditarAdministracion } from '../../../../../../lib/autenticacion/auditoria.ts';
import { vincularCuenta } from '../../../../../../lib/administracion/cuentas.ts';

export const PANTALLA = 'clientes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Una location de GoHighLevel: letras y números. No se interpreta, se guarda. */
const LOCATION = /^[A-Za-z0-9_-]{1,100}$/;
const DEL_PRINCIPAL = 'La subcuenta del cliente principal es la de la empresa: se carga en Ajustes › Credenciales.';
/* El puntaje y las carpetas del Perfil que se hayan elegido para este cliente (C6 · D4) son de los campos de su
   subcuenta anterior, y no se borran: sus leads nuevos quedarían «Sin calificar» sin que nada lo dijera. Esta ruta no
   los mira —están en negocio, y leerlos cruzaría los dos dominios—, así que lo dice siempre que cambia la subcuenta; la
   pantalla del puntaje lo marca después, cuando el catálogo nuevo se lee y el elegido no está. */
const REVISAR_LO_ELEGIDO =
  'Si este cliente tenía elegidos el puntaje o las carpetas del Perfil, eran de su subcuenta anterior: cuando se lea ' +
  'el catálogo de la nueva, revísalos en su Conexión.';

export async function PATCH(peticion: Request, ctx: RouteContext<'/api/admin/cuentas/[id]/vinculo'>): Promise<Response> {
  const contexto = await exigir(peticion, ['cuentas.vincular'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  // La capacidad sólo la tiene la plataforma; esto es la red por si un rol de empresa la recibiera por error.
  if (!esDeLaPrincipal(contexto)) return rechazo('no_encontrado');

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo de la petición no es JSON válido.');
  }
  const c = (cuerpo ?? {}) as Record<string, unknown>;
  const orgId = typeof c.orgId === 'string' && UUID.test(c.orgId) ? c.orgId : contexto.orgEfectiva;
  const cambios: { crmCuentaId?: string | null; esPrueba?: boolean } = {};
  if (c.crmCuentaId !== undefined) {
    if (c.crmCuentaId !== null && (typeof c.crmCuentaId !== 'string' || !LOCATION.test(c.crmCuentaId))) {
      return rechazo('peticion_invalida', 'Esa subcuenta no tiene forma de location del CRM.');
    }
    cambios.crmCuentaId = c.crmCuentaId;
  }
  if (c.esPrueba !== undefined) {
    if (typeof c.esPrueba !== 'boolean') return rechazo('peticion_invalida', '«De prueba» va como verdadero o falso.');
    cambios.esPrueba = c.esPrueba;
  }
  if (Object.keys(cambios).length === 0) return rechazo('peticion_invalida', 'No hay ningún cambio que guardar.');

  return conIdentidad(async (db) => {
    let resultado: Awaited<ReturnType<typeof vincularCuenta>>;
    try {
      resultado = await vincularCuenta(db, orgId, id, cambios);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') return rechazo('subcuenta_en_uso');
      throw e;
    }
    if (resultado === 'no_encontrado') return rechazo('no_encontrado');
    if (resultado === 'subcuenta_en_uso') return rechazo('subcuenta_en_uso');
    if (resultado === 'cliente_principal') return rechazo('cliente_principal', DEL_PRINCIPAL);
    await auditarAdministracion(db, { accion: 'cuenta_vinculada', actor: contexto.usuarioId, objetivo: id, orgId });
    return ok({ vinculado: true, ...(cambios.crmCuentaId !== undefined ? { aviso: REVISAR_LO_ELEGIDO } : {}) });
  });
}
