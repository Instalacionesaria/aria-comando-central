// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
//
// Qué puede hacer esta empresa con los Analizadores: si tiene las dos llaves, y qué tipos se analizan
// en esta fase. Es lo que la pantalla necesita para no ofrecer un botón que no puede cumplir.
//
// ── POR QUÉ ES UNA RUTA APARTE DE LA LISTA ────────────────────────────────────
//
// Porque las llaves viven en identidad y las llamadas en negocio. Juntarlas en un solo GET cruzaría
// los dos dominios en un archivo (ADR-0209). Y el estado no devuelve NINGUNA llave: solo si está
// cargada, con los mismos cuatro estados que Ajustes › Credenciales.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { resolverCredenciales } from '../../../../lib/credenciales/resolver.ts';
import { TIPOS_QUE_SE_ANALIZAN } from '../../../../lib/analizadores/pipeline.ts';

export const PANTALLA = 'analizadores';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['analizadores.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const c = await conIdentidad((db) => resolverCredenciales(db, contexto.orgEfectiva));
  return ok({
    // El estado de cada llave, SIN la vista previa: esta pantalla no es la de Ajustes › Credenciales.
    llaveDeIa: { cargada: c.ia.cargado, estado: c.ia.estado },
    llaveDeTldv: { cargada: c.tldv.cargado, estado: c.tldv.estado },
    tiposQueSeAnalizan: TIPOS_QUE_SE_ANALIZAN,
  });
}
