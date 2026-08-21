// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// Los usuarios de la organización efectiva.
//
// Es una operación del dominio de IDENTIDAD, así que va por `conIdentidad(` y este archivo
// está en `ARCHIVOS_AUTORIZADOS`. La política de `identidad.usuarios` para `app_inquilino`
// está acotada a `app.org_id`, pero acá se usa el rol de identidad —el que puede ver las diez
// tablas— así que **el filtro por organización lo pone esta consulta a mano**, con
// `contexto.orgEfectiva`.
//
// Que el filtro sea explícito acá es exactamente la razón por la que la escotilla necesita
// lista blanca: es el único lugar del sistema donde olvidarse un `where` devuelve filas de
// otra organización sin error.

import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok } from '../../../lib/autorizacion/respuesta.ts';
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

  const usuarios = await conIdentidad(async (db) =>
    db
      .selectFrom('usuarios')
      // EL FILTRO, a mano y a la vista. Con el rol de identidad no hay política que lo
      // ponga: `usuarios_identidad` es `using (true)`.
      .where('org_id', '=', contexto.orgEfectiva)
      .orderBy('nombre')
      .select(['id', 'nombre', 'email', 'activo', 'es_admin_principal'])
      .execute(),
  );

  return ok({ usuarios });
}
