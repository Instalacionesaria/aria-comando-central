// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0604 — Sin credencial, la organización no opera y lo dice.
//
// Sincronizar ahora con tl;dv: descubrir las reuniones nuevas y clasificarlas. **No analiza**: eso es
// lo caro, y la pantalla lo pide después, de a una llamada por petición, para que cada análisis tenga
// su propia función de 300 s.
//
// Descubre HT y OB juntas, como el cron: una sincronización lanzada desde la pestaña OB trae también
// las HT.
//
// Mismo patrón que `llamadas/[id]/analizar/`: `conIdentidad(` solo para las llaves, el trabajo en `lib/`.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { resolverAccesoAlAnalizador } from '../../../../lib/credenciales/resolver.ts';
import { descubrir, relojDe } from '../../../../lib/analizadores/pipeline.ts';
import { TIEMPO_DE_LA_RUTA_MS } from '../../../../lib/analizadores/rutas.ts';

export const PANTALLA = 'analizadores';

export const maxDuration = 300;

/** Gasta la llave de IA —el clasificador cobra por reunión—, así que pide `.editar`. */
export async function POST(peticion: Request): Promise<Response> {
  const reloj = relojDe(TIEMPO_DE_LA_RUTA_MS);
  const contexto = await exigir(peticion, ['analizadores.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const acceso = await conIdentidad((db) => resolverAccesoAlAnalizador(db, contexto.orgEfectiva));
  if (acceso.tipo === 'falta') return rechazo(acceso.que);

  const r = await descubrir(contexto.orgEfectiva, { claveTldv: acceso.claveTldv, claveIa: acceso.claveIa, reloj });
  if (r.tipo === 'falta') {
    return r.que === 'llave_de_tldv_rechazada'
      ? rechazo('llave_de_tldv_rechazada', 'tl;dv rechazó la llave. Generá una nueva y cargala en Integraciones.')
      : rechazo('llave_de_ia_rechazada', 'Anthropic rechazó la llave de IA. Revisala en Integraciones.');
  }
  if (r.tipo === 'fallo') {
    // La causa va al REGISTRO y no al cuerpo (`ADR-0704`): puede traer la respuesta cruda del proveedor.
    console.error('analizadores: el descubrimiento falló', r.causa);
    return rechazo('servicio_externo_no_disponible', 'No se pudo hablar con tl;dv. Probá de nuevo en un rato.');
  }
  return ok(r);
}
