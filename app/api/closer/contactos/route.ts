// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
// ADR-0305 — Un rechazo por permiso no se muestra como "no hay datos".
//
// La lista de contactos de la pestaña Closer: las filas con sus seis íconos (`11` § 7).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS TRES LÍNEAS QUE DIFERENCIAN ESTE ARCHIVO DEL DEL SETTER
//
// `PANTALLA`, la capacidad y el `TERRITORIO`. Todo lo demás está en `lib/negocio/fila.ts`, y
// el motivo está escrito ahí: el § 9 regla 3 —*"si dos pantallas muestran el mismo número,
// comparten la función que lo calcula"*— y una divergencia concreta que sería invisible (el
// tercer ícono cuenta llamadas CONTESTADAS, no hechas).
//
// ── POR QUÉ `closer.ver` Y NO `contactos.ver` ───────────────────────────────
//
// Porque de esta línea depende lo único que se pidió en voz alta: *"un closer solo ve su
// pestaña"*. Si las dos pestañas pidieran la misma capacidad de lectura, los dos roles verían
// las dos — y `seccionesVisibles` seguiría filtrando bien, con el criterio equivocado. No
// fallaría nada.
//
// `contactos.ver` existe y es de la FICHA, que se abre desde las dos pestañas y por eso no
// puede pedir la capacidad de una sola.
//
// ── Y EL FILTRO POR TERRITORIO NO ES UN PERMISO ─────────────────────────────
//
// El `11` § 8 lo decide: *"sea cual sea la respuesta, no es un permiso: es un filtro de
// negocio que vive en la consulta. Si fuera una capacidad, haría falta un rol nuevo por cada
// variante y el modelo de permisos se llenaría de casos particulares."*
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { filasDeTerritorio } from '../../../../lib/negocio/fila.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'closer';

/** El filtro de negocio: la etiqueta `zona_closer` de GoHighLevel, ya traducida. */
const TERRITORIO = 'closer' as const;

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['closer.ver']);
  if (contexto instanceof Response) return contexto;

  const url = new URL(peticion.url);
  // `Number.parseInt` de un parámetro que no vino da `NaN`, y `Math.max(0, NaN)` es `NaN`,
  // que en un `offset` de PostgreSQL es un error de tipo. El `|| 0` lo tapa antes.
  const pagina = Number.parseInt(url.searchParams.get('pagina') ?? '0', 10) || 0;

  // `orgEfectiva`, no `orgPropia`. Es la línea que decide si un usuario de plataforma ve lo
  // que cree estar viendo. El aislamiento lo pone la política de fila con este valor.
  const { filas, hayMas } = await conOrganizacion(contexto.orgEfectiva, async () =>
    filasDeTerritorio(TERRITORIO, { pagina }),
  );

  // `ok` siempre, incluso con cero filas — y de eso depende que el frontend distinga *"no hay
  // datos"* de *"no pude averiguarlo"* (`11` § 8). Un error que se ve como lista vacía es un
  // error que nadie reporta.
  return ok({ filas, pagina, hayMas });
}
