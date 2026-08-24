// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
// ADR-0305 — Un rechazo por permiso no se muestra como "no hay datos".
//
// La lista de contactos de la pestaña Setter: las filas con sus seis íconos (`11` § 7).
//
// Es el gemelo de `app/api/closer/contactos/route.ts` y difiere en TRES líneas: `PANTALLA`, la
// capacidad y el `TERRITORIO`. El razonamiento de por qué el resto es compartido está en ese
// archivo y en `lib/negocio/fila.ts` — el § 9 regla 3, y una divergencia concreta que sería
// invisible si hubiera dos consultas.
//
// Y no, esto no es duplicación que convenga unificar en una ruta con un parámetro. Un
// `/api/contactos?territorio=…` haría que **el navegador elija el territorio**, y entonces un
// setter pediría `territorio=closer` y lo recibiría: la capacidad que el portero comprobó
// sería `contactos.ver`, la misma para los dos. Dos rutas con el territorio ESCRITO EN EL
// SERVIDOR es lo que hace que la separación no dependa de lo que mande el cliente.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { filasDeTerritorio } from '../../../../lib/negocio/fila.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'setter';

/** El filtro de negocio: la etiqueta `zona_setter` de GoHighLevel, ya traducida. */
const TERRITORIO = 'setter' as const;

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['setter.ver']);
  if (contexto instanceof Response) return contexto;

  const url = new URL(peticion.url);
  const pagina = Number.parseInt(url.searchParams.get('pagina') ?? '0', 10) || 0;

  const { filas, hayMas } = await conOrganizacion(contexto.orgEfectiva, async () =>
    filasDeTerritorio(TERRITORIO, { pagina }),
  );

  return ok({ filas, pagina, hayMas });
}
