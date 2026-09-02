// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0604 — Sin credencial, la organización no opera y lo dice.
// ADR-0704 — Las respuestas de error no revelan estructura.
//
// Extraer los hooks y ángulos de una búsqueda del Espía de Anuncios, con IA.
//
// ── POR QUÉ ES UNA RUTA APARTE DE `/api/tools/scrape` ───────────────────────
//
// Porque son dos gastos distintos y dos sistemas distintos. Espiar lanza un actor de Apify por el
// proxy del motor; esto le pide un resumen al modelo con la llave de IA de la organización. Meterlas
// en el mismo manejador obligaría a ramificar por el cuerpo de la petición para saber cuál de las
// dos credenciales resolver — y ahí el portero deja de poder auditarse de un vistazo.
//
// ── Y POR QUÉ NO USA `resolverAccesoAFundaciones` ──────────────────────────
//
// Porque ésa exige además el vínculo con el alumno del hub, y el Espía no tiene nada que ver con
// Fundaciones. Reusarla haría que una organización sin ese vínculo —un cliente High Ticket recién
// creado— viera `sin_alumno_vinculado` al apretar un botón de la pantalla `tools`. Ese error ya se
// pagó una vez acá: el scraper estuvo atado a ese vínculo hasta la migración 006.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { resolverLlaveDeIa } from '../../../../lib/credenciales/resolver.ts';
import { analizarLosAnuncios } from '../../../../lib/tools/espia.ts';

export const PANTALLA = 'tools';

/** Dos mil tokens tardan menos que un documento, pero el techo se declara igual. */
export const maxDuration = 300;

/**
 * De dónde sale el backend. Sin valor por omisión, por lo mismo que en `scrape/route.ts`: una URL
 * de reserva es la forma de que un despliegue mal configurado apunte en silencio a otro entorno.
 */
function backend(): string | null {
  const url = process.env.SCRAPER_BACKEND_URL;
  return url && url.trim().length > 0 ? url.replace(/\/+$/, '') : null;
}

/**
 * Pide `tools.editar` y no `tools.ver`, y esa es LA decisión de esta ruta: analizar **gasta tokens
 * de la llave de la organización**. Mirar los anuncios ya espiados no cuesta nada; pedirle a un
 * modelo que los resuma, sí.
 */
export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tools.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const url = backend();
  if (!url) return rechazo('motor_no_configurado', 'Falta SCRAPER_BACKEND_URL.');

  const llave = await conIdentidad(async (db) => resolverLlaveDeIa(db, contexto.orgEfectiva));
  if (llave.tipo === 'falta') return rechazo(llave.que);

  return analizarLosAnuncios(peticion, {
    claveIa: llave.claveIa,
    orgId: contexto.orgEfectiva,
    backend: url,
  });
}
