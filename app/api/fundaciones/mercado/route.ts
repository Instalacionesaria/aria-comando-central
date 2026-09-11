// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0202 — Toda consulta de negocio corre dentro del contexto de su organización.
//
// La mirada al mercado real del Research, segunda punta: QUÉ se vio.
//
// Recibe los identificadores de los dos trabajos —Maps y Espía— que el navegador arrancó y sondeó
// con las funciones de Tools, cuenta lo que dejaron en la base y guarda el resumen en el documento
// del Research. Los números NO vienen del navegador: se leen de `aria_cc_scraper_leads` y de
// `aria_cc_scraper_trabajos` por identificador, dentro del contexto de la organización. Un
// identificador ajeno devuelve cero filas.
//
// No gasta tokens ni saldo, pero escribe en el Research: `fundaciones.editar`.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { resumirMercado } from '../../../../lib/fundaciones/operaciones.ts';

export const PANTALLA = 'icp';

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['fundaciones.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const alumno = { orgId: contexto.orgEfectiva };
  return conOrganizacion(contexto.orgEfectiva, () => resumirMercado(peticion, alumno));
}
