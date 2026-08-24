// La consulta del listado de organizaciones. Vive en `lib/` y no junto al manejador.
//
// Primero por una regla del repositorio que atrapó el primer intento: **bajo `app/api/` solo
// hay manejadores de ruta**. Un archivo de apoyo ahí dentro rompe esa prueba, y con razón — el
// enrutador de Next resuelve por convención de nombres, así que un archivo suelto en esa
// carpeta es una ruta que nadie declaró.
//
// Y además porque esta consulta es la que **cruza organizaciones a propósito** —la única de
// todo el sistema que lo hace— y eso merece un archivo donde se vea sin buscarlo.

import type { Trx } from '../datos/capa.ts';

/** Una organización, como la ve quien administra la plataforma. */
export interface OrganizacionListada {
  id: string;
  slug: string;
  nombre: string;
  activa: boolean;
  esPrincipal: boolean;
  /**
   * ¿Tiene cargado el token de GoHighLevel?
   *
   * Es la diferencia entre una empresa que existe y una que **opera**. El alta responde
   * `opera: false` una sola vez y después ese dato no se podía consultar en ningún lado: había
   * que conmutar la sesión a cada empresa para averiguarlo de a una.
   *
   * NO se devuelve la credencial ni su vista previa. Solo si la hay: quien administra la
   * plataforma necesita saber qué empresas están sin conectar, no ver sus secretos.
   */
  tieneCredencialDeCrm: boolean;
  /** Cuántos usuarios tiene. Una empresa sin usuarios es una empresa a la que nadie puede entrar. */
  usuarios: number;
  creadaEl: Date;
}

/**
 * TODAS las organizaciones. **Sin filtro por inquilino, y es el punto.**
 *
 * ── ESTA ES LA ÚNICA CONSULTA DEL SISTEMA QUE CRUZA ORGANIZACIONES A PROPÓSITO ──
 *
 * Todo el resto del diseño existe para que eso no pase. Acá pasa, y lo que lo hace aceptable
 * no es este archivo: es la capacidad que el manejador exige antes de llamarlo,
 * `organizaciones.listar`, que **solo tiene el rol de plataforma** — la migración 003 se la
 * niega al administrador con `not like 'organizaciones.%'`.
 *
 * O sea que la barrera está en el portero, una línea antes, y no en un `where`. Por eso este
 * archivo no lleva ninguno: un `where org_id = …` acá daría la impresión de que hay un filtro,
 * y el día que alguien lo quitara para "arreglar" el listado no se notaría que la protección
 * era otra.
 */
export async function listarOrganizaciones(db: Trx): Promise<OrganizacionListada[]> {
  const filas = await db
    .selectFrom('organizaciones as o')
    .leftJoin('organizaciones_credenciales as c', 'c.org_id', 'o.id')
    .select((eb) => [
      'o.id',
      'o.slug',
      'o.nombre',
      'o.activa',
      'o.es_principal',
      'o.creada_el',
      // `is not null`, no el valor. Ver el comentario de `tieneCredencialDeCrm`.
      eb('c.crm_token_cifrado', 'is not', null).as('tiene_credencial'),
      eb
        .selectFrom('usuarios')
        .whereRef('usuarios.org_id', '=', 'o.id')
        .select(({ fn }) => fn.countAll<string>().as('n'))
        .as('usuarios'),
    ])
    // La principal primero, después por nombre. Quien administra la plataforma vuelve siempre
    // a la suya, y buscarla en orden alfabético entre veinte es trabajo que no hace falta.
    .orderBy('o.es_principal', 'desc')
    .orderBy('o.nombre', 'asc')
    .execute();

  return filas.map((f) => ({
    id: f.id,
    slug: f.slug,
    nombre: f.nombre,
    activa: f.activa,
    esPrincipal: f.es_principal,
    tieneCredencialDeCrm: Boolean(f.tiene_credencial),
    usuarios: Number(f.usuarios ?? 0),
    creadaEl: f.creada_el,
  }));
}
