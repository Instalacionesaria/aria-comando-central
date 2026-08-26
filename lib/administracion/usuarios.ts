// La consulta del listado de personas. Vive en `lib/` y no junto al manejador.
//
// Por la misma regla que `organizaciones.ts`: **bajo `app/api/` solo hay manejadores de ruta**, y
// un archivo suelto ahí es una ruta que nadie declaró.
//
// Y por una razón propia, más fuerte: **acá vive una frontera de autorización**, y dentro del
// manejador no había forma de probarla sin levantar un servidor. Una frontera que solo se puede
// comprobar mirando el código es una frontera que se rompe en el primer refactor.

import type { Trx } from '../datos/capa.ts';

/** Una persona, como la ve quien administra. */
export interface PersonaListada {
  id: string;
  nombre: string;
  email: string | null;
  activo: boolean;
  es_admin_principal: boolean;
  /** Las claves de sus roles. **Nunca `null`**: sin roles es una lista vacía. */
  roles: string[];
  /**
   * De qué empresa es.
   *
   * Viaja SIEMPRE, no solo cuando la lista cruza empresas. Mandarla a veces sí y a veces no
   * obligaría a la pantalla a adivinar, y una lista donde la mitad de las filas dicen de dónde son
   * y la otra mitad no es peor que una donde no lo dice ninguna.
   */
  organizacion: { id: string; nombre: string; esPrincipal: boolean };
}

/**
 * Las personas que quien pregunta puede administrar.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * DOS ALCANCES, Y LA DIFERENCIA LA DECIDE UNA CAPACIDAD
 *
 * **Con alcance de plataforma** la lista trae a **todo el mundo, de todas las empresas**. Sin eso,
 * quien administra la plataforma no puede hacer su trabajo: para ver a alguien de otra empresa
 * había que **conmutar a esa empresa primero**, y una lista de personas que cambia según dónde
 * estés parado no se lee como un filtro — se lee como que esa persona no existe.
 *
 * **Sin él**, la lista es la de `orgId` y nada más. Es el administrador de una empresa, y su
 * frontera es exactamente ésta. Ensancharla por comodidad sería abrirla para todos.
 *
 * ── EL ALCANCE ES UN PARÁMETRO OBLIGATORIO, NO UNA OPCIÓN ──────────────────
 *
 * `todasLasEmpresas` no tiene valor por omisión a propósito. Con uno, olvidarse de pasarlo
 * elegiría solo — y el `03` § 5 ya cerró de qué lado cae ese olvido: *"una operación nueva nace
 * cerrada"*. Un valor por omisión abierto sería una fuga silenciosa; uno cerrado sería un listado
 * incompleto que nadie reporta. Obligar a decirlo evita las dos.
 *
 * Y `orgId` se pide **siempre**, incluso con alcance de plataforma: el manejador no puede llamar a
 * esto sin saber en qué empresa está parado, y tenerlo a mano hace que agregar un filtro futuro no
 * requiera cambiar la firma.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Corre con el rol de IDENTIDAD, donde `usuarios_identidad` es `using (true)`: **no hay política
 * que ponga el filtro**. Lo pone esta consulta, a mano y a la vista.
 */
export async function personasQuePuedeAdministrar(
  db: Trx,
  orgId: string,
  todasLasEmpresas: boolean,
): Promise<PersonaListada[]> {
  let q = db
    .selectFrom('usuarios as u')
    .innerJoin('organizaciones as o', 'o.id', 'u.org_id');

  if (!todasLasEmpresas) {
    q = q.where('u.org_id', '=', orgId);
  }

  const filas = await q
    // La principal primero, y dentro de cada empresa por nombre. Sin el orden por empresa, una
    // lista de varias empresas queda entreverada y no se puede leer de un vistazo.
    .orderBy('o.es_principal', 'desc')
    .orderBy('o.nombre')
    .orderBy('u.nombre')
    .select((eb) => [
      'u.id',
      'u.nombre',
      'u.email',
      'u.activo',
      'u.es_admin_principal',
      'u.org_id as org_id',
      'o.nombre as org_nombre',
      'o.es_principal as org_es_principal',
      // ── LOS ROLES ────────────────────────────────────────────────────────
      //
      // Sin ellos, asignar roles sería **destructivo a ciegas**: `POST .../roles` REEMPLAZA el
      // conjunto completo, no suma. Sin saber el conjunto actual, editar el rol de alguien le
      // quitaba los otros sin que nadie lo viera venir.
      //
      // Como subconsulta y no como `join` + `group by`: un `join` a `usuarios_roles` multiplica
      // las filas de usuario por sus roles, y el `left join` con cero roles hace que el agregado
      // devuelva `[null]` en vez de `[]`. Las dos cosas se arreglan después en el código, y
      // arreglarlas es donde se cuela el error.
      eb
        .selectFrom('usuarios_roles as ur')
        .innerJoin('roles as r', 'r.id', 'ur.rol_id')
        .whereRef('ur.usuario_id', '=', 'u.id')
        .select(({ fn, ref }) => fn.agg<string[]>('array_agg', [ref('r.clave')]).as('claves'))
        .as('roles'),
    ])
    .execute();

  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    email: f.email,
    activo: f.activo,
    es_admin_principal: f.es_admin_principal,
    // `?? []` porque la subconsulta devuelve `null` cuando la persona no tiene ningún rol. Un nulo
    // acá obligaría a cada consumidor a acordarse, y el que se olvide dibuja "undefined" donde
    // debería decir que no tiene ninguno.
    roles: f.roles ?? [],
    organizacion: { id: f.org_id, nombre: f.org_nombre, esPrincipal: f.org_es_principal },
  }));
}
