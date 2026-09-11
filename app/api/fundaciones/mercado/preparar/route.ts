// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0604 — Sin credencial, la organización no opera y lo dice.
//
// La mirada al mercado real del Research, primera punta: QUÉ buscar.
//
// Devuelve el rubro (el primer segmento del paso 1, pedido al modelo como nombre corto) y la
// ubicación (el sexto criterio), o por qué no se puede mirar: sin ubicación, o sin paso 1. El
// navegador muestra la confirmación con eso y, si la persona acepta, arranca los scrapers con las
// funciones de la pantalla Tools.
//
// Gasta una inferencia corta de la llave de IA de la organización, así que resuelve la credencial
// como `generar` y pide `fundaciones.editar`. Está en `ARCHIVOS_AUTORIZADOS` por la escotilla de la
// llave, igual que sus tres hermanas; el estado lo lee el almacén con su propia transacción.

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { resolverAccesoAFundaciones } from '../../../../../lib/credenciales/resolver.ts';
import { prepararMercado } from '../../../../../lib/fundaciones/operaciones.ts';

export const PANTALLA = 'icp';

/** Una inferencia corta, pero contra el modelo: el techo se declara igual que en las demás. */
export const maxDuration = 300;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['fundaciones.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const acceso = await conIdentidad(async (db) =>
    resolverAccesoAFundaciones(db, contexto.orgEfectiva),
  );
  if (acceso.tipo === 'falta') return rechazo(acceso.que);

  return prepararMercado(acceso);
}
