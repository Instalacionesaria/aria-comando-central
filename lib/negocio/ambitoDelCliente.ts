// El ámbito de la ingesta: UN cliente de una empresa, nunca la empresa entera (el nivel 3, Bloque C).
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ UN TIPO PROPIO, Y NO UN `orgId`
//
// Lo que entra del CRM o de Meta es de un cliente: su subcuenta, su cuenta publicitaria. Adentro de
// `conOrganizacion({ orgId, todaLaOrganizacion: true, cuentas: [X] })` la base hace dos cosas solas:
// las lecturas ven sólo las filas de X, y un insert en una tabla de una cuenta sin `cuenta_id` recibe X
// del puente (`negocio.completar_cuenta`, 085): la única cuenta activa a la vista.
//
// Con un `orgId` (o sea `'*'`) la base no se queja de nada y hace otra cosa: con dos clientes activos,
// el puente pone la cuenta POR OMISIÓN en todo lo que no tiene contacto. Un `conOrganizacion(orgId, …)`
// olvidado adentro de la ingesta de Y escribiría el gasto, las campañas o el pulso de Y en X, pisando
// los de X, sin ningún error. Por eso el código de la ingesta no recibe un `orgId`: recibe este tipo, que
// sólo se arma acá, y el compilador marca cada llamada que se haya quedado con el `orgId`.
//
// El cliente tiene que estar ACTIVO: con uno pausado no hay ninguna cuenta activa a la vista y el puente
// falla. El cron sólo barre clientes activos, y el por omisión siempre lo está (085).
// ═══════════════════════════════════════════════════════════════════════════════

import { conOrganizacion, datos, type Ambito } from '../datos/contexto.ts';

declare const DE_UN_CLIENTE: unique symbol;

/** El ámbito de un solo cliente, con la organización entera a la vista (para los ajustes de la empresa). */
export type AmbitoDeUnCliente = Ambito & {
  readonly todaLaOrganizacion: true;
  readonly cuentas: readonly [string];
  readonly [DE_UN_CLIENTE]: true;
};

/** El ámbito de un cliente ya conocido. Puro: no pregunta nada a la base. */
export function ambitoDeUnCliente(orgId: string, cuentaId: string): AmbitoDeUnCliente {
  if (!orgId || !cuentaId) throw new Error('ambitoDeUnCliente: hacen falta la organización y el cliente');
  return { orgId, todaLaOrganizacion: true, cuentas: [cuentaId] } as unknown as AmbitoDeUnCliente;
}

/** El cliente de un ámbito. */
export function cuentaDe(ambito: AmbitoDeUnCliente): string {
  return ambito.cuentas[0];
}

/**
 * El cliente POR OMISIÓN de una empresa: el que trae lo que entra con las credenciales de la empresa. Es lo que
 * usan los puntos de entrada que hoy son de la empresa —las rutas manuales, los scripts, el aviso del CRM de la
 * empresa— y, hasta el barrido por cliente, el cron.
 */
export async function porOmisionDe(orgId: string): Promise<AmbitoDeUnCliente> {
  const fila = await conOrganizacion(orgId, async () =>
    datos().selectFrom('cuentas').select('id').where('es_por_omision', '=', true).executeTakeFirst(),
  );
  if (!fila) throw new Error(`porOmisionDe: la organización ${orgId} no tiene cliente por omisión a la vista`);
  return ambitoDeUnCliente(orgId, fila.id);
}
