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
      .selectFrom('usuarios as u')
      // EL FILTRO, a mano y a la vista. Con el rol de identidad no hay política que lo
      // ponga: `usuarios_identidad` es `using (true)`.
      .where('u.org_id', '=', contexto.orgEfectiva)
      .orderBy('u.nombre')
      .select((eb) => [
        'u.id',
        'u.nombre',
        'u.email',
        'u.activo',
        'u.es_admin_principal',
        // ── LOS ROLES, agregados en la Etapa 11 ──────────────────────────────
        //
        // Hasta ahora esta lista no decía qué rol tiene cada persona, y eso hacía que
        // asignar roles fuera **destructivo a ciegas**: `POST .../roles` REEMPLAZA el
        // conjunto completo, no suma. Sin saber el conjunto actual, editar el rol de
        // alguien le quitaba los otros sin que nadie lo viera venir.
        //
        // Como subconsulta y no como `join` + `group by`: un `join` a `usuarios_roles`
        // multiplica las filas de usuario por sus roles, y el `left join` con cero roles
        // hace que el agregado devuelva `[null]` en vez de `[]`. Las dos cosas se arreglan
        // después en el código, y arreglarlas es donde se cuela el error.
        eb
          .selectFrom('usuarios_roles as ur')
          .innerJoin('roles as r', 'r.id', 'ur.rol_id')
          .whereRef('ur.usuario_id', '=', 'u.id')
          .select(({ fn, ref }) => fn.agg<string[]>('array_agg', [ref('r.clave')]).as('claves'))
          .as('roles'),
      ])
      .execute(),
  );

  return ok({
    usuarios: usuarios.map((u) => ({
      ...u,
      // `?? []` porque la subconsulta devuelve `null` cuando la persona no tiene ningún rol.
      // Un nulo acá obligaría a cada consumidor a acordarse, y el que se olvide dibuja
      // "undefined" donde debería decir que no tiene ninguno.
      roles: u.roles ?? [],
    })),
  });
}
