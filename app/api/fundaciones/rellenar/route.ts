// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0604 — Sin credencial, la organización no opera y lo dice.
//
// Rellenar el formulario de una herramienta con lo que las anteriores ya produjeron.
//
// Gasta la llave de IA de la organización —una inferencia corta— así que pide la capacidad de
// EDITAR, como generar. El trabajo vive en `lib/fundaciones/relleno.ts`, compartido con la otra
// pantalla; acá se quedan la capacidad, la credencial y la lista de herramientas admitidas, que es
// un filtro de seguridad y no una comodidad.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { resolverAccesoAFundaciones } from '../../../../lib/credenciales/resolver.ts';
import { leerEstado } from '../../../../lib/fundaciones/almacen.ts';
import { FUNDACIONES } from '../../../../lib/fundaciones/herramientas.ts';
import { rellenarLosCampos } from '../../../../lib/fundaciones/relleno.ts';

export const PANTALLA = 'icp';

/** Ver la nota de `estado/route.ts`: leer el almacén del hub ya tarda por sí solo. */
export const maxDuration = 300;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['fundaciones.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const acceso = await conIdentidad(async (db) =>
    resolverAccesoAFundaciones(db, contexto.orgEfectiva),
  );
  if (acceso.tipo === 'falta') return rechazo(acceso.que);

  return rellenarLosCampos(peticion, acceso, FUNDACIONES, leerEstado);
}
