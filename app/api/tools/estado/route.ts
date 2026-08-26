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
// Lo que NO se mudó es la autorización: el `exigir(` y el `conIdentidad(` se quedan acá. Tres
// pruebas lo exigen —`ADR-0301`, `ADR-0202`, `ADR-0211`— y leen ESTE archivo, no lo que llama. Y
// hacen bien: delegar el portero a una función compartida convierte *"toda ruta pide permiso"* en
// algo que ya no se puede comprobar mirando la ruta.
//
// ── POR QUÉ SIGUE EN `ARCHIVOS_AUTORIZADOS` ─────────────────────────────────
//
// Porque el estado de Fundaciones **no está en esta base**: está en el almacén de ARIA-brain, y de
// esta base se lee UNA cosa —a qué alumno del hub corresponde la organización de la sesión—. Esa
// tabla es de identidad y el rol del inquilino no tiene ni `select` sobre ella. Así que el filtro
// por organización lo pone la consulta de abajo a mano, con `contexto.orgEfectiva`.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { resolverAlumnoDeFundaciones } from '../../../../lib/credenciales/resolver.ts';
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

  // EL FILTRO, a mano y a la vista: con el rol de identidad no hay política que lo ponga.
  const alumno = await conIdentidad(async (db) =>
    resolverAlumnoDeFundaciones(db, contexto.orgEfectiva),
  );
  if (alumno.tipo === 'falta') return rechazo(alumno.que);

  return leerElEstado(alumno);
}

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tools.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const alumno = await conIdentidad(async (db) =>
    resolverAlumnoDeFundaciones(db, contexto.orgEfectiva),
  );
  if (alumno.tipo === 'falta') return rechazo(alumno.que);

  return guardarLosInputs(peticion, alumno, TOOLS);
}
