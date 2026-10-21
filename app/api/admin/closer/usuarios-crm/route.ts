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
import { agenteDelCrmDe, resolverAccesoAGhl, TEXTO_DE_FALTA_GHL, TEXTO_DE_FALTA_GHL_DEL_CLIENTE } from '../../../../../lib/credenciales/resolver.ts';
import { usuariosDelCrm } from '../../../../../lib/ghl/cliente.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'credenciales';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* El acceso al CRM y, en la MISMA lectura, cuál de esos usuarios es el del agente de IA.

     Sirve para avisar al vincular. Medido en producción el 2026-09-01: los **135** contactos de
     `zona_closer` con asignado —de 152— apuntan a `0peGoq7VvFqnDGA7gxtX`, que es el identificador
     cargado como `crm_agente_usuario_id` para el auditor. O sea que quien vincule a un closer con
     ese usuario se lleva TODOS los leads — no es un error, pero hay que saberlo antes de elegir. */
  /* `?cuenta=` (el nivel 3): los usuarios de la subcuenta de UN cliente, con SUS credenciales. Sólo un cliente de la
     organización efectiva que no esté de baja —uno de otra empresa o de baja es 404, como en `PUT /api/admin/closer`—;
     sin el parámetro, los del principal, que son los de la empresa (la `085` asegura uno por empresa). */
  const pedido = new URL(peticion.url).searchParams.get('cuenta');
  if (pedido !== null && !UUID.test(pedido)) return rechazo('no_encontrado');
  const leido = await conIdentidad(async (db) => {
    const vivos = db
      .selectFrom('cuentas')
      .select(['id', 'es_por_omision'])
      .where('org_id', '=', contexto.orgEfectiva)
      .where('estado', '<>', 'baja');
    const fila = await (pedido === null ? vivos.where('es_por_omision', '=', true) : vivos.where('id', '=', pedido))
      .executeTakeFirst();
    if (!fila) return null;
    const cliente = { id: fila.id, esPorOmision: fila.es_por_omision };
    return {
      cliente,
      acceso: await resolverAccesoAGhl(db, contexto.orgEfectiva, cliente),
      agenteId: await agenteDelCrmDe(db, contexto.orgEfectiva, cliente),
    };
  });
  if (!leido) return rechazo('no_encontrado');
  const { cliente, acceso, agenteId } = leido;
  if (acceso.tipo === 'falta') {
    /* Los cinco motivos de falta de credencial se dicen con su texto, que nombra la acción: cargar
       el token, cargar la subcuenta, volver a cargarlo porque no se puede descifrar. Un «no se pudo»
       genérico mandaría a mirar la red cuando lo que falta es una casilla de Integraciones. La de
       un cliente que no es el principal se carga en SU Conexión, y su subcuenta la vincula ARIA. */
    const textos = cliente.esPorOmision ? TEXTO_DE_FALTA_GHL : TEXTO_DE_FALTA_GHL_DEL_CLIENTE;
    return rechazo('credenciales_incompletas', textos[acceso.que]);
  }

  const r = await usuariosDelCrm(acceso);
  if (r.tipo === 'fallo') {
    /* Se distingue «el token no sirve» del resto, que es la única causa que quien mira la pantalla
       puede arreglar. Lo demás —sin respuesta, demasiadas peticiones, un rechazo del proveedor— es
       esperar y reintentar, y decir lo contrario manda a rotar un token que estaba bien. */
    const detalle =
      r.fallo.tipo !== 'no_autorizado'
        ? 'No se pudo leer la lista de usuarios de GoHighLevel. Probá de nuevo en un momento.'
        : cliente.esPorOmision
          ? 'GoHighLevel rechazó el token. Hay que volver a cargarlo en Integraciones.'
          : 'GoHighLevel rechazó el token de este cliente. Hay que volver a cargarlo en Ajustes › Clientes › Conexión.';
    return rechazo('credenciales_incompletas', detalle);
  }

  /* `agenteId` viaja aunque sea nulo: nulo significa «esta empresa no cargó el usuario del agente»,
     y con eso la pantalla sabe que no puede avisar nada — distinto de «ninguno de estos es el
     agente», que sería afirmar algo que no se midió. */
  return ok({ usuarios: r.datos, agenteId });
}
