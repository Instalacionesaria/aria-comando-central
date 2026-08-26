// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
// ADR-0305 — Un rechazo por permiso no se muestra como "no hay datos".
//
// La Agenda del closer. **Cero llamadas al CRM.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// UNA REGLA DEL DOCUMENTO QUE NO SE IMPLEMENTA, Y POR QUÉ
//
// El documento de la Agenda pide una red de seguridad: *"si el rango pedido está vacío en la caché
// y hay credenciales configuradas, se refresca una sola vez, solo"*. Y explica para qué:
//
//   *"Sin eso, el closer abre la Agenda, la ve vacía, y no tiene forma de saber si no tiene citas o
//   si el sistema todavía no las cargó."*
//
// **El problema es real y acá se resuelve de otra manera: la respuesta trae `falta`**, que distingue
// los tres estados —nunca se barrió, se barrió a medias, se barrió completo y no hay nada— y en los
// dos primeros dice qué hacer. Quien abre la pantalla no queda ante una ambigüedad, que es lo que la
// red de seguridad venía a evitar.
//
// Y así se evita algo peor: **un `GET` que escribe.** Una lectura con efecto secundario es la clase
// de cosa que después nadie espera — un tablero abierto en tres pestañas dispararía tres barridos, y
// una precarga del navegador dispararía uno sin que nadie mire. El botón cuesta un clic; el `GET`
// silencioso cuesta confianza en que leer no cambia nada.
//
// Si el cron del bloque siguiente hace que esto no se note nunca, mejor: el estado «nunca se barrió»
// dejará de existir en la práctica.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { agendaDelCloser, DIAS_DE_LA_AGENDA } from '../../../../lib/negocio/agenda.ts';
import { DIAS_ADELANTE } from '../../../../lib/negocio/citas.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'closer';

/**
 * El tope de la ventana. Sin él, un `dias=100000` sería una consulta sin acotar.
 *
 * **Es `DIAS_ADELANTE`, el mismo número que el barrido le pide al CRM, y eso es el arreglo.** Estaba
 * en 90 mientras el barrido trae 45: los días 46 a 90 volvían vacíos porque nunca se preguntaron, y
 * `falta` no se encendía —solo corre si la ventana ENTERA está vacía—. O sea un cero sin medir
 * presentado como «no hay citas», que es exactamente lo que la regla 1 del `11` § 9 prohíbe.
 *
 * Que las dos constantes sean la misma no es prolijidad: el día que el barrido mire más lejos, esto
 * lo sigue solo.
 */
const TOPE_DE_DIAS = DIAS_ADELANTE;

export async function GET(peticion: Request): Promise<Response> {
  // `closer.ver` como las otras tres sub-pestañas: son una sola pantalla y `ADR-0304` exige el
  // mismo conjunto. Si Agenda pidiera algo distinto, se vería vacía para alguien que ve Inicio,
  // Mi Día y Pipeline — y no habría forma de darse cuenta mirando.
  const contexto = await exigir(peticion, ['closer.ver']);
  if (contexto instanceof Response) return contexto;

  const url = new URL(peticion.url);
  const pedidos = Number(url.searchParams.get('dias') ?? DIAS_DE_LA_AGENDA);
  const dias = Number.isFinite(pedidos)
    ? Math.min(TOPE_DE_DIAS, Math.max(1, Math.trunc(pedidos)))
    : DIAS_DE_LA_AGENDA;

  // El mismo endpoint sirve a los tres consumidores que el documento nombra —el widget de Mi Día
  // con `dias=1`, la pestaña Agenda con quince, y quien quiera más— y **la forma de la respuesta no
  // cambia**. Eso es lo que permitió que el origen de los datos cambiara sin tocar el frontend.
  const agenda = await conOrganizacion(contexto.orgEfectiva, () =>
    agendaDelCloser(contexto.organizacion.zonaHoraria, {
      dias,
      incluirCanceladas: url.searchParams.get('canceladas') === 'si',
    }),
  );

  return ok(agenda);
}
