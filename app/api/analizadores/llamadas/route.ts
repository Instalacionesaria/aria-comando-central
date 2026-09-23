// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0202 — Toda operación abre el contexto de su organización.
//
// La lista de una pestaña de los Analizadores: las llamadas de un tipo, filtradas, con sus conteos.
//
// ── `analizadores.ver`, LA MISMA QUE DECLARA LA SECCIÓN ─────────────────────
//
// Es la regla ADR-0304: el GET de una pantalla pide exactamente la capacidad de su sección, o el
// menú abre una puerta que los datos cierran — la entrada aparece y cada petición devuelve 403.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { contarPorFiltro, listarLlamadas } from '../../../../lib/analizadores/datos.ts';
import { filtroDe, pestanaDe } from '../../../../lib/analizadores/rutas.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'analizadores';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['analizadores.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const params = new URL(peticion.url).searchParams;
  const tipo = pestanaDe(params.get('tipo'));
  const filtro = filtroDe(params.get('filtro'));
  // Rechazar y no corregir: una pestaña que no existe devuelta como «HT» mostraría otra lista sin avisar.
  if (tipo === null) return rechazo('peticion_invalida', 'La pestaña tiene que ser HT u OB.');
  if (filtro === null) return rechazo('peticion_invalida', 'Ese filtro no existe.');

  const orgId = contexto.orgEfectiva;
  try {
    const { llamadas, cuenta } = await conOrganizacion(orgId, async () => ({
      llamadas: await listarLlamadas(orgId, tipo, filtro),
      cuenta: await contarPorFiltro(orgId, tipo),
    }));
    return ok({ tipo, filtro, llamadas, cuenta });
  } catch (e) {
    /* «No pude leer» NO es «no hay llamadas». Con un `ok([])` acá, una caída de la base se vería
       como una pestaña vacía —que es un estado normal— y nadie la reportaría. */
    console.error('analizadores: no se pudo leer la lista', e);
    return rechazo('base_no_disponible');
  }
}
