// ADR-0301 — Toda operación llama al portero.
//
// Editar un cliente de una empresa (el nivel 3): nombre, nicho, país, moneda, zona, estado.
//
// Por el inquilino, con la organización entera, como el alta (ver `app/api/admin/cuentas/route.ts`). Un cliente de
// otra empresa no se ve, así que el `update` toca cero filas y sale 404. El cliente principal de la empresa (la cuenta
// por omisión) no se pausa ni se da de baja: lo rechaza la base.

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { autorDelCambio } from '../../../../../lib/autorizacion/sesion.ts';
import { conOrganizacion, datos } from '../../../../../lib/datos/contexto.ts';
import { auditarAdministracion } from '../../../../../lib/autenticacion/auditoria.ts';
import { esZonaValida } from '../../../../../lib/negocio/zonas.ts';
import {
  editarCuenta,
  empresaDestino,
  leerDatosDeUnCliente,
  quienConfirma,
  rechazoDeLaBase,
} from '../../../../../lib/administracion/cuentas.ts';

export const PANTALLA = 'clientes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(peticion: Request, ctx: RouteContext<'/api/admin/cuentas/[id]'>): Promise<Response> {
  const contexto = await exigir(peticion, ['cuentas.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo de la petición no es JSON válido.');
  }
  if (cuerpo === null || typeof cuerpo !== 'object') return rechazo('peticion_invalida', 'Faltan los cambios.');
  const c = cuerpo as Record<string, unknown>;
  const cambios = leerDatosDeUnCliente(c, esZonaValida);
  if (typeof cambios === 'string') return rechazo('peticion_invalida', cambios);
  // Un cuerpo sin ningún cambio conocido se rechaza: un 200 sobre algo que no se entendió es un éxito que no ocurrió.
  if (Object.keys(cambios).length === 0) return rechazo('peticion_invalida', 'No hay ningún cambio que guardar.');

  const destino = empresaDestino(contexto, c.orgId);
  if (destino === null) return rechazo('no_encontrado');
  const quien = quienConfirma(destino === contexto.orgEfectiva ? autorDelCambio(contexto) : null);

  try {
    const encontrado = await conOrganizacion({ orgId: destino, todaLaOrganizacion: true, cuentas: '*' }, async () => {
      if (!(await editarCuenta(id, cambios, quien))) return false;
      await auditarAdministracion(datos(), { accion: 'cuenta_editada', actor: contexto.usuarioId, objetivo: id, orgId: destino });
      return true;
    });
    return encontrado ? ok({ editado: true }) : rechazo('no_encontrado');
  } catch (e) {
    return rechazoDeLaBase(e);
  }
}
