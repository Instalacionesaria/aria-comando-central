// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0302 — El permiso se pregunta por capacidad, nunca por nombre de rol.
//
// El catálogo de roles asignables.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO NO EXISTÍA, Y POR QUÉ HACE FALTA
//
// Asignar un rol se hace desde la Etapa 5 con `POST /api/admin/usuarios/{id}/roles` y un cuerpo
// `{"roles": ["<clave>"]}`. **Por clave, y sin ninguna forma de saber qué claves existen**: el
// único lugar del código que consulta la tabla `roles` lo hace para resolver claves que YA
// vinieron en la petición, no para ofrecerlas.
//
// O sea que hasta ahora, asignar un rol exigía conocer las cadenas de memoria. Una pantalla no
// tenía de dónde sacarlas, y una errata —`administrator`, `Closer`— devuelve `rol_inexistente`
// sin decir cuáles son los buenos.
//
// ── PIDE `usuarios.ver` Y NO `roles.asignar`, Y ES DELIBERADO ───────────────
//
// Leer los NOMBRES de los roles no es asignarlos. Es un catálogo: `administrador`, `closer`,
// `setter`. Quien puede ver la pantalla de usuarios necesita saber qué rol tiene cada uno, y
// eso ya implica conocer los nombres.
//
// Y hay una razón de `ADR-0304` además de la de sentido común: esta operación llena la MISMA
// pantalla que `GET /api/usuarios`, así que tiene que pedir el mismo conjunto. Pidiendo
// `roles.asignar`, alguien con `usuarios.ver` y sin ella vería la lista de personas y la
// columna de rol vacía, sin ningún error — el defecto exacto que `ADR-0304` existe para
// impedir.
//
// Asignar sigue exigiendo `roles.asignar`, y otorgar uno de plataforma exige además
// `organizaciones.listar`. Eso no cambia.
// ═══════════════════════════════════════════════════════════════════════════════

import { seccionesVisibles } from '../../../../lib/autorizacion/secciones.ts';
import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'usuarios';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['usuarios.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* ── LAS SECCIONES QUE ALCANZA CADA ROL ────────────────────────────────────
   *
   * Viajan con el rol para que el formulario de alta pueda ofrecer casillas de permisos por persona
   * **sin ofrecer las que no harían nada**. Un `usuario` no tiene `credenciales.ver`, así que darle
   * la sección Ajustes es tildar una casilla sin efecto — y eso es el `07` § 4: *un control que se ve
   * y no puede cumplir*.
   *
   * El mapeo lo hace el SERVIDOR con `seccionesVisibles`, que es la misma función que decide el menú.
   * La alternativa —mandarle al navegador las capacidades de cada rol y que él calcule— pondría una
   * segunda copia de esa regla en el cliente, y las dos se desordenarían la primera vez que se agregue
   * una sección.
   */
  const roles = await conIdentidad(async (db) => {
    const filas = await db
      .selectFrom('roles')
      // Los roles GLOBALES, que son los que sirven de plantilla para cualquier organización.
      // Un rol privado de otra organización no es asignable acá —lo impide el disparador
      // `usuarios_roles_no_cruzan`— así que ofrecerlo sería ofrecer algo que va a fallar.
      .where('org_id', 'is', null)
      .select(['id', 'clave', 'nombre', 'solo_principal', 'exige_segundo_factor'])
      .orderBy('solo_principal', 'desc')
      .orderBy('nombre', 'asc')
      .execute();

    // Las capacidades de todos los roles en UNA consulta, no una por rol.
    const reparto = await db
      .selectFrom('roles_permisos')
      .select(['rol_id', 'permiso'])
      .where(
        'rol_id',
        'in',
        filas.map((f) => f.id),
      )
      .execute();

    return filas.map((f) => {
      const capacidades = new Set(reparto.filter((r) => r.rol_id === f.id).map((r) => r.permiso));
      return { ...f, secciones: seccionesVisibles(capacidades).map((x) => x.clave) };
    });
  });

  return ok({
    roles: roles.map((r) => ({
      clave: r.clave,
      nombre: r.nombre,
      /**
       * `soloPrincipal` viaja porque la pantalla tiene que poder decirlo ANTES de intentar.
       *
       * Otorgar un rol de plataforma exige `organizaciones.listar` además de `roles.asignar`, y
       * sin este dato la única forma de enterarse es apretar y recibir un 403. Un formulario
       * que ofrece una opción que va a ser rechazada es la misma mentira que un botón que no
       * hace nada.
       */
      soloPrincipal: r.solo_principal,
      exigeSegundoFactor: r.exige_segundo_factor,
      /**
       * Las claves de las secciones que este rol puede alcanzar, en el orden del menú.
       *
       * Es lo que el formulario de alta usa para dibujar las casillas de permisos por persona. No es
       * «lo que la persona va a ver»: es el techo. Lo que ve es esto **cortado** por las secciones
       * que se le concedan.
       */
      secciones: r.secciones,
    })),
  });
}
