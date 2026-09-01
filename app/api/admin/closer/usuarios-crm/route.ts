// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
// ADR-0305 — Un rechazo por permiso no se muestra como "no hay datos".
//
// Los usuarios de la subcuenta de GoHighLevel, para vincular a cada closer con el suyo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO ES UNA RUTA APARTE Y NO UN CAMPO MÁS DE `GET /api/admin/closer`
//
// Porque **toca el CRM y aquélla no**. `GET /api/admin/closer` lee dos tablas y responde en
// milisegundos; el panel del closer la llama cada vez que se guarda algo. Meterle una llamada
// externa la volvería tan lenta como el peor día del proveedor, y un fallo de red del CRM dejaría
// sin panel a quien solo quería ver los porcentajes.
//
// Separadas, la lista de usuarios puede fallar sola: el panel se dibuja, los closers se ven, y el
// desplegable del CRM dice qué pasó. Es la misma regla de admisión que `app/api/closer/mi-dia`
// defiende en su encabezado — *«como mucho UNA mitad que toque el CRM»*— aplicada partiendo en dos.
//
// ── `PANTALLA = 'credenciales'`, IGUAL QUE SU HERMANA ──────────────────────
//
// Y por el mismo motivo que `app/api/admin/closer/route.ts` deja escrito: con `'closer'`,
// `ADR-0304` exigiría que este `GET` pidiera `closer.ver` —el conjunto de las cinco operaciones de
// esa pantalla— y esto no es una operación del closer: es configuración, y la hace quien administra.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { resolverAccesoAGhl, TEXTO_DE_FALTA_GHL } from '../../../../../lib/credenciales/resolver.ts';
import { usuariosDelCrm } from '../../../../../lib/ghl/cliente.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'credenciales';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* El acceso al CRM y, en la MISMA lectura, cuál de esos usuarios es el del agente de IA.

     Sirve para avisar al vincular. Medido en producción el 2026-09-01: los 87 contactos de
     `zona_closer` están asignados a `0peGoq7VvFqnDGA7gxtX`, que es exactamente el identificador
     cargado como `crm_agente_usuario_id` para el auditor. O sea que quien vincule a un closer con
     ese usuario se lleva TODOS los leads — no es un error, pero hay que saberlo antes de elegir. */
  const { acceso, agenteId } = await conIdentidad(async (db) => ({
    acceso: await resolverAccesoAGhl(db, contexto.orgEfectiva),
    agenteId:
      (
        await db
          .selectFrom('organizaciones_credenciales')
          .select('crm_agente_usuario_id')
          .where('org_id', '=', contexto.orgEfectiva)
          .executeTakeFirst()
      )?.crm_agente_usuario_id ?? null,
  }));
  if (acceso.tipo === 'falta') {
    /* Los cinco motivos de falta de credencial se dicen con su texto, que nombra la acción: cargar
       el token, cargar la subcuenta, volver a cargarlo porque no se puede descifrar. Un «no se pudo»
       genérico mandaría a mirar la red cuando lo que falta es una casilla de Integraciones. */
    return rechazo('credenciales_incompletas', TEXTO_DE_FALTA_GHL[acceso.que]);
  }

  const r = await usuariosDelCrm(acceso);
  if (r.tipo === 'fallo') {
    /* Se distingue «el token no sirve» del resto, que es la única causa que quien mira la pantalla
       puede arreglar. Lo demás —sin respuesta, demasiadas peticiones, un rechazo del proveedor— es
       esperar y reintentar, y decir lo contrario manda a rotar un token que estaba bien. */
    const detalle =
      r.fallo.tipo === 'no_autorizado'
        ? 'GoHighLevel rechazó el token. Hay que volver a cargarlo en Integraciones.'
        : 'No se pudo leer la lista de usuarios de GoHighLevel. Probá de nuevo en un momento.';
    return rechazo('credenciales_incompletas', detalle);
  }

  /* `agenteId` viaja aunque sea nulo: nulo significa «esta empresa no cargó el usuario del agente»,
     y con eso la pantalla sabe que no puede avisar nada — distinto de «ninguno de estos es el
     agente», que sería afirmar algo que no se midió. */
  return ok({ usuarios: r.datos, agenteId });
}
