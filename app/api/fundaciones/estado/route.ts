// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
// ADR-0305 — Un rechazo por permiso no se muestra como "no hay datos".
//
// El estado de Fundaciones del alumno: leerlo entero, y guardar los inputs de una herramienta.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO USA `conIdentidad(` Y NO `conOrganizacion(`
//
// Porque el estado de Fundaciones **no está en esta base**. Está en el almacén de ARIA-brain, y de
// esta base solo se lee UNA cosa: a qué alumno del hub corresponde la organización de la sesión
// (`identidad.organizaciones_credenciales.fundaciones_cliente_id`). Esa tabla es de identidad y el
// rol del inquilino no tiene ni `select` sobre ella — es la que guarda los secretos de todas las
// organizaciones.
//
// Así que este archivo está en `ARCHIVOS_AUTORIZADOS`, y con la misma responsabilidad que
// `app/api/usuarios/route.ts`: **el filtro por organización lo pone esta consulta a mano**, con
// `contexto.orgEfectiva`. Es lo que hace que la escotilla necesite lista blanca.
//
// Y hay un segundo filtro, fuera de esta base y por lo tanto fuera de todas sus políticas: el
// `cliente_id` con el que se habla al almacén. **Nunca llega del navegador.** Sale de la fila de
// credenciales de la organización de la sesión, igual que `orgEfectiva`. Un `cliente_id` que
// viajara en el cuerpo de la petición sería la fuga entera: cualquiera con sesión podría leer y
// sobrescribir el trabajo de cualquier alumno del hub.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { resolverAlumnoDeFundaciones } from '../../../../lib/credenciales/resolver.ts';
import { guardarInputs, guardarResearch, leerEstado } from '../../../../lib/fundaciones/almacen.ts';
import { aValoresDeAlmacen, idsDeCampos } from '../../../../lib/fundaciones/campos.ts';
import { herramienta } from '../../../../lib/fundaciones/herramientas.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'icp';

/**
 * Leer siete documentos del almacén tarda, y generar tarda mucho más.
 *
 * El valor por omisión de la plataforma corta la función antes de que una generación de 16.000
 * tokens termine, y el síntoma sería *"a veces no guarda"* — un fallo intermitente que se
 * diagnostica muy mal.
 */
export const maxDuration = 300;

/** Traduce un fallo del almacén al rechazo que le corresponde, sin colapsar ninguno. */
function rechazoDeAlmacen(fallo: { tipo: string }): Response {
  if (fallo.tipo === 'sin_configurar') {
    return rechazo('almacen_no_disponible', 'El almacén de Fundaciones no está configurado');
  }
  return rechazo('almacen_no_disponible');
}

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['fundaciones.ver']);
  if (contexto instanceof Response) return contexto;

  const alumno = await conIdentidad(async (db) =>
    // EL FILTRO, a mano y a la vista: con el rol de identidad no hay política que lo ponga.
    resolverAlumnoDeFundaciones(db, contexto.orgEfectiva),
  );
  if (alumno.tipo === 'falta') return rechazo(alumno.que);

  const estado = await leerEstado(alumno.clienteId);
  if (estado.tipo !== 'datos') return rechazoDeAlmacen(estado);

  return ok({ estado: estado.datos });
}

interface CuerpoDeGuardado {
  herramienta?: unknown;
  valores?: unknown;
}

/** Solo cadenas. Un número o un objeto en un campo de texto no es un input, es un error. */
function soloTextos(x: unknown): Record<string, string> | null {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return null;
  const salida: Record<string, string> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (typeof v !== 'string') return null;
    salida[k] = v;
  }
  return salida;
}

/**
 * Guarda los inputs de una herramienta. **No genera nada.**
 *
 * Existe porque el trabajo de llenar siete formularios se pierde de la peor manera: el alumno
 * escribe media ficha, cierra la pestaña, y vuelve a una pantalla en blanco. Guardar los inputs sin
 * generar es lo que hace que volver no cueste nada.
 *
 * Pide `fundaciones.editar` y no `fundaciones.ver`, aunque no gaste tokens: escribe en el almacén, y
 * lo que escribe lo va a heredar la siguiente herramienta.
 */
export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['fundaciones.editar']);
  if (contexto instanceof Response) return contexto;

  let cuerpo: CuerpoDeGuardado;
  try {
    cuerpo = (await peticion.json()) as CuerpoDeGuardado;
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON');
  }

  const id = typeof cuerpo.herramienta === 'number' ? cuerpo.herramienta : null;
  if (id === null || !herramienta(id)) return rechazo('no_encontrado');

  const valores = soloTextos(cuerpo.valores);
  if (valores === null) return rechazo('peticion_invalida', 'Los valores tienen que ser texto');

  const alumno = await conIdentidad(async (db) =>
    resolverAlumnoDeFundaciones(db, contexto.orgEfectiva),
  );
  if (alumno.tipo === 'falta') return rechazo(alumno.que);

  // Se relee el estado antes de escribir porque las dos llaves del almacén guardan TODAS las
  // herramientas juntas en un solo documento. Escribir solo con lo que mandó el navegador borraría
  // los inputs de las otras seis — y las borraría en silencio.
  const estado = await leerEstado(alumno.clienteId);
  if (estado.tipo !== 'datos') return rechazoDeAlmacen(estado);

  const guardado =
    id === 1
      ? // El Research guarda sus criterios junto a sus salidas, en su propia llave: es el formato
        // que el hub ya escribe, y separarlos haría que el hub leyera un documento a medias.
        await guardarResearch(
          alumno.clienteId,
          aValoresDeAlmacen(idsDeCampos(1), valores),
          estado.datos.researchSalidas,
        )
      : await guardarInputs(
          alumno.clienteId,
          estado.datos,
          id,
          aValoresDeAlmacen(idsDeCampos(id), valores),
        );

  if (guardado.tipo !== 'datos') return rechazoDeAlmacen(guardado);
  return ok({ guardado: true });
}
