// ADR-0501 — Un administrador no opera sobre usuarios de otra organización. INNEGOCIABLE.
//
// El usuario sobre el que se opera. **UN solo lugar lo resuelve.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// HAY DOS MECANISMOS DE 404, Y EN DOS DE LAS CINCO OPERACIONES EL FILTRO LO PONE LA BASE
//
// Esto es lo primero que hay que entender de la Etapa 5, y lo escribe el `09` § 2 —que
// `EJECUCION` § 4 llama *"el más importante"*— justo después del bloque de credenciales:
//
//   "Con los permisos y la política de arriba, **editar y desactivar recuperan la red de la
//    base.** Quedan en el dominio de identidad solo las tres operaciones que tocan credenciales:
//    el alta (genera el hash de la temporal), el restablecimiento y la asignación de roles."
//
// Y su lista de verificación, § 7 punto 16, lo repite como tarea: *"editar y desactivar usuarios
// **desde el dominio del inquilino**, con su política. Y para las tres operaciones que quedan en
// identidad —alta, restablecimiento y roles—, la prueba de la operación cruzada entre
// organizaciones, que responde 404 y no 403."*
//
//   ┌─────────────────────────┬──────────────────────┬──────────────────────────────────────┐
//   │ operación               │ dominio              │ de dónde sale el 404                 │
//   ├─────────────────────────┼──────────────────────┼──────────────────────────────────────┤
//   │ editar                  │ INQUILINO            │ la política: cero filas actualizadas │
//   │ desactivar              │ INQUILINO            │ la política: cero filas actualizadas │
//   │ alta                    │ identidad            │ esta función                          │
//   │ restablecer contraseña  │ identidad            │ esta función                          │
//   │ asignar roles           │ identidad            │ esta función                          │
//   └─────────────────────────┴──────────────────────┴──────────────────────────────────────┘
//
// La migración 002 ya puso lo que hace falta para las dos primeras: `grant update (nombre,
// activo) on identidad.usuarios to app_inquilino` y la política `usuarios_edita_inquilino`. Así
// que `app/api/admin/usuarios/[id]/route.ts` **no va** en `ARCHIVOS_AUTORIZADOS`, y hay una
// prueba que se rompe si alguien lo agrega por costumbre.
//
// ── POR QUÉ 404 Y NO 403 ─────────────────────────────────────────────────────
//
// `PRUEBAS.md`: *"404, nunca 200 — y 404 y no 403, porque **un 403 confirma que ese identificador
// existe**."* Un 403 sobre el id de un usuario de otra organización es un oráculo: quien pregunta
// no puede ver la fila, pero el código de respuesta le dice que está.
// ═══════════════════════════════════════════════════════════════════════════════

// Recibe la transacción; NO la abre. Por eso este archivo no está —y no puede estar— en
// `ARCHIVOS_AUTORIZADOS`: la comprobación de entradas muertas de esa lista lo rechaza, y tiene
// razón. Quien abre la escotilla es el manejador de ruta, y ése sí está en la lista.
import type { Trx } from '../datos/capa.ts';

/** Lo que toda operación de administración necesita saber del usuario objetivo. */
export interface Objetivo {
  id: string;
  org_id: string;
  activo: boolean;
  es_admin_principal: boolean;
}

/**
 * El usuario objetivo, **acotado a la organización efectiva**. `undefined` si no existe o es de
 * otra organización — las dos cosas se responden igual, que es el punto.
 *
 * ESTE ES EL ÚNICO `where('org_id', ...)` DEL DOMINIO DE IDENTIDAD, y por eso está en su propio
 * archivo con su propio nombre. La política de `identidad.usuarios` para `app_identidad` es
 * `using (true)`: acá no hay red abajo. Olvidarse de esa línea en una de las tres operaciones
 * devuelve el usuario de otra organización, y la operación funciona.
 *
 * Hay una prueba de código que afirma que ningún archivo de `app/api/admin/**` consulta
 * `usuarios` por su cuenta. Es la misma familia que el `07` § 1 llama *"lo único que lo agarra:
 * una prueba que lea el código fuente de cada operación"*.
 */
export async function usuarioObjetivo(
  db: Trx,
  id: string,
  orgEfectiva: string,
): Promise<Objetivo | undefined> {
  // Un id que no es un uuid no es "no encontrado": es una petición mal formada. Pero se
  // responde igual —404— porque distinguirlos también es un oráculo, más débil pero gratis de
  // cerrar. Sin esta guarda, la consulta lanza `invalid input syntax for type uuid` y el 500 que
  // sale de ahí dice más que un 404.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return undefined;
  }

  return db
    .selectFrom('usuarios')
    .where('id', '=', id)
    // ── LA LÍNEA ────────────────────────────────────────────────────────────
    .where('org_id', '=', orgEfectiva)
    .select(['id', 'org_id', 'activo', 'es_admin_principal'])
    .executeTakeFirst();
}
