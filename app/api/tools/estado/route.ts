// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
// ADR-0305 — Un rechazo por permiso no se muestra como "no hay datos".
//
// El estado de las herramientas de la pantalla `tools`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS DOS DIFERENCIAS CON `/api/fundaciones/estado`, Y LAS DOS IMPORTAN
//
//   1. **Pide `tools.ver`, no `fundaciones.ver`.** Reusar la de Fundaciones era la salida barata:
//      darle Tools a alguien le daría también ICP & Oferta, sin que nadie lo decida.
//   2. **Admite solo las herramientas de `TOOLS`.** Sin ese filtro, una petición acá con
//      `herramienta: 3` guardaría el ICP con la capacidad equivocada.
//
// El trabajo es el mismo y vive en `lib/fundaciones/operaciones.ts`.
//
// Lo que NO se mudó es la autorización: el `exigir(` y el `conOrganizacion(` se quedan acá. Tres
// pruebas lo exigen —`ADR-0301`, `ADR-0202`, `ADR-0211`— y leen ESTE archivo, no lo que llama. Y
// hacen bien: delegar el portero a una función compartida convierte *"toda ruta pide permiso"* en
// algo que ya no se puede comprobar mirando la ruta.
//
// ── ABRE EL CONTEXTO DE SU ORGANIZACIÓN, COMO CUALQUIER OTRA RUTA ──────────
//
// Hasta el 2026-09-07 estaba en `ARCHIVOS_AUTORIZADOS`: el estado vivía en el almacén de ARIA-brain
// y de esta base se leía UNA fila de identidad —a qué alumno del hub correspondía la organización—.
// Ahora el estado vive en `public.aria_cc_foundations`, con RLS y la política por `app.org_id`, así
// que esta ruta abre `conOrganizacion(` y el almacén reutiliza esa transacción. Leer y guardar
// inputs es corto; las rutas que generan no abren el contexto acá (ver `almacen.ts`).
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { TOOLS } from '../../../../lib/fundaciones/herramientas.ts';
import { guardarLosInputs, leerElEstado } from '../../../../lib/fundaciones/operaciones.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'tools';

/**
 * Leer el almacén tarda, y generar tarda mucho más.
 *
 * El valor por omisión de la plataforma corta la función antes de que una generación de 16.000
 * tokens termine, y el síntoma sería *"a veces no guarda"* — un fallo intermitente que se
 * diagnostica muy mal.
 */
export const maxDuration = 300;

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tools.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  // La organización sale del portero y va como llave del almacén. Nunca del navegador.
  const alumno = { orgId: contexto.orgEfectiva };
  return conOrganizacion(contexto.orgEfectiva, () => leerElEstado(alumno));
}

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tools.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const alumno = { orgId: contexto.orgEfectiva };
  return conOrganizacion(contexto.orgEfectiva, () => guardarLosInputs(peticion, alumno, TOOLS));
}
