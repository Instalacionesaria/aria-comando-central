// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// Las personas que quien pregunta puede administrar.
//
// Es una operación del dominio de IDENTIDAD, así que va por `conIdentidad(` y este archivo está en
// `ARCHIVOS_AUTORIZADOS`. La consulta vive en `lib/administracion/usuarios.ts` —bajo `app/api/`
// solo hay manejadores— y ahí está escrito por qué el filtro va a mano.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL ALCANCE LO DECIDE UNA CAPACIDAD, Y ES LA MITAD DE UNA REGLA QUE YA EXISTÍA
//
// `organizaciones.listar` —cuya descripción en el catálogo es literalmente *"ver y cambiar entre
// todas las organizaciones"*— es la misma con la que
// `app/api/admin/usuarios/[id]/roles/route.ts` decide si se puede otorgar el rol de plataforma, con
// la regla escrita ahí: *"no se puede otorgar el alcance que uno no tiene"*.
//
// Acá es su otra mitad: **no se puede ver más allá del alcance que uno tiene.**
//
// Se pregunta por capacidad y nunca por el nombre del rol (`ADR-0302`), que es lo que permite mover
// el permiso de un rol a otro sin tocar este archivo.
//
// ── EL DEFECTO QUE ESTO ARREGLA ────────────────────────────────────────────
//
// La lista filtraba **siempre** por la organización efectiva, incluso para quien administra la
// plataforma. El síntoma: se creaba a alguien en una empresa y **no aparecía**; para verlo había
// que conmutarse a esa empresa. Una lista de personas que cambia según dónde estés parado no se
// lee como un filtro, se lee como que esa persona no se creó.
//
// ── LO QUE NO CAMBIA ───────────────────────────────────────────────────────
//
// El administrador de una empresa sigue viendo solo la suya. Ésa es la frontera de la que depende
// todo el aislamiento, y `pruebas/base/50-administracion.test.ts` la sostiene.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok } from '../../../lib/autorizacion/respuesta.ts';
import { personasQuePuedeAdministrar } from '../../../lib/administracion/usuarios.ts';
import { conIdentidad } from '../../../lib/datos/capa.ts';

/**
 * A qué pantalla pertenece esta operación.
 *
 * Es un `export`, no un comentario, y la diferencia importa: `sinComentarios()` de
 * `pruebas/apoyo/fuente.ts` quita los comentarios antes de buscar, así que un marcador en un
 * JSDoc desaparecería y la ruta parecería no declarar pantalla.
 */
export const PANTALLA = 'usuarios';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['usuarios.ver']);
  if (contexto instanceof Response) return contexto;

  const todasLasEmpresas = contexto.permisos.has('organizaciones.listar');

  const usuarios = await conIdentidad(async (db) =>
    personasQuePuedeAdministrar(db, contexto.orgEfectiva, todasLasEmpresas),
  );

  return ok({
    /**
     * `true` = esta lista cruza empresas.
     *
     * Lo dice el SERVIDOR y no lo deduce la pantalla contando empresas distintas, porque ese conteo
     * miente en el caso que importa: si la única empresa con gente es la principal, la pantalla
     * vería «una sola» y escondería de dónde es cada uno — y al día siguiente, con una persona
     * nueva en otra empresa, la columna aparecería sola sin que nadie tocara nada.
     */
    todasLasEmpresas,
    usuarios,
  });
}
