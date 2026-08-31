// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// Mi Día del Setter: sus SEIS colas, en una sola llamada y sin tocar el CRM.
//
// ═══════════════════════════════════════════════════════════════════════════════
// UNA LLAMADA, Y NO UNA POR COLA
//
// El mismo argumento que el gemelo del closer: el contador de tareas pendientes se calcula con la
// regla de Mi Día, y con dos endpoints habría **dos implementaciones del mismo número**. Una sola
// función lo calcula y viaja con las colas.
//
// Y el territorio se escribe acá, en el servidor: no sale de la petición ni del cuerpo. Con una ruta
// parametrizada, el navegador elegiría de qué territorio son las colas que ve.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { colasDelSetter } from '../../../../lib/negocio/miDiaDelSetter.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'setter';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['setter.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* La zona horaria de la ORGANIZACIÓN, no la del navegador. Es lo que decide qué es «hoy» en las
     colas que filtran por día, y con una empresa en otro huso el corte cae en el momento equivocado. */
  const zona = contexto.organizacion.zonaHoraria;
  const colas = await conOrganizacion(contexto.orgEfectiva, () => colasDelSetter(zona));

  return ok({
    colas,
    // Viaja con las colas porque la pantalla la necesita para dibujar horas: sin ella tendría que
    // usar la del navegador, que es la de quien mira y no la de la empresa.
    zonaHoraria: zona,
    /* Se DECLARA que no costó nada. Es una afirmación verificable y no una promesa en un comentario:
       si mañana alguien mete una llamada al CRM en el camino de esta pantalla, este número deja de
       ser cero y se nota. */
    llamadasAlCrm: 0,
  });
}
