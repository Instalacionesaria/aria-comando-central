// ADR-0413 — Un usuario con un rol que exige segundo factor no obtiene sesión habilitada.
//            INNEGOCIABLE.
//
// Las cuatro ramas que deciden el estado de una sesión. **UN solo lugar.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// "EL SIGUIENTE QUE CORRESPONDA", NO "ACTIVA"
//
// El `02` § 5 lo dice a propósito: *"quien entra con contraseña temporal Y un rol que exige
// segundo factor pasa por DOS estados, no por uno. Cada transición recalcula el estado con las
// mismas cuatro ramas del login, en vez de asumir que ya no queda nada pendiente."*
//
// Por eso esto vive acá y no dentro del login: lo usan el login, el cambio de contraseña y la
// verificación del segundo factor. Tres copias divergen.
//
// ── EL ORDEN DE LAS RAMAS NO ES EL OBVIO ─────────────────────────────────────
//
// El `03` § 5, y la segunda mitad es la que casi siempre se pone al revés:
//
//   "Si el segundo factor ya está configurado y falta verificarlo, GANA SIEMPRE: todavía no se
//    probó la identidad y nada más puede pasar antes. Pero si falta CONFIGURARLO y además hay
//    contraseña temporal, gana LA CONTRASEÑA TEMPORAL — porque la temporal la conoce quien creó
//    la cuenta, y dejar configurar el segundo factor primero le permitiría a esa persona
//    INSCRIBIR SU DISPOSITIVO EN LA CUENTA DE OTRO."
//
// Ése es el ataque completo: el administrador que da de alta a alguien conoce su contraseña
// temporal, entra antes que el dueño, e inscribe su propio teléfono. Invertir las ramas 2 y 3
// lo habilita, y **nada falla**.
//
// ── UNA CONTRADICCIÓN DEL `02` § 5 CONSIGO MISMO, RESUELTA ───────────────────
//
// Su tabla de transiciones dice que `confirmar` lleva a `activa`, y el párrafo siguiente dice
// que **toda** transición recalcula con las cuatro ramas. Aplicado a `confirmar`, el recálculo
// devuelve `pendiente_2fo` por la rama 1 —acaba de confirmarse el factor— y la cuenta queda en
// un bucle: quien acaba de probar el código con el que se inscribió tendría que probarlo otra
// vez.
//
// Gana la tabla para `confirmar`, porque escribe el destino literal y porque el recálculo
// produce un bucle. Para eso está `yaProboElFactor`: salta la rama 1.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Trx } from '../datos/capa.ts';
import type { EstadoSesion } from '../autorizacion/sesion.ts';

/**
 * El estado que le corresponde a una sesión de este usuario, ahora.
 *
 * @param yaProboElFactor `true` cuando quien llama acaba de validar un código, así que la
 *   rama 1 no aplica. Lo usan `confirmar` y `verificar`; el login **nunca**.
 */
export async function estadoQueCorresponde(
  db: Trx,
  usuarioId: string,
  opciones: { yaProboElFactor?: boolean } = {},
): Promise<EstadoSesion> {
  const u = await db
    .selectFrom('usuarios')
    .select('debe_cambiar_password')
    .where('id', '=', usuarioId)
    .executeTakeFirstOrThrow();

  // 1 · Segundo factor CONFIRMADO y sin verificar en esta sesión: gana siempre.
  //
  // Se pregunta por `confirmado_el is not null`, NO por la existencia de la fila. El comentario
  // de la migración 006 lo dice: *"el login pregunta si el segundo factor está CONFIRMADO, no
  // si existe la fila"*. Un alta empezada y abandonada dejaría la cuenta en `pendiente_2fo`
  // para siempre, con un secreto que nadie confirmó.
  if (!opciones.yaProboElFactor) {
    const confirmado = await db
      .selectFrom('usuarios_segundo_factor')
      .select('usuario_id')
      .where('usuario_id', '=', usuarioId)
      .where('confirmado_el', 'is not', null)
      .executeTakeFirst();
    if (confirmado) return 'pendiente_2fo';
  }

  // 2 · Contraseña temporal. ANTES de configurar el segundo factor. Ver el encabezado.
  if (u.debe_cambiar_password) return 'debe_cambiar_password';

  // 3 · ¿Algún rol le EXIGE segundo factor, y todavía no lo configuró?
  //
  // Si esta consulta devolviera cero filas por falta de permiso en vez de por ausencia de rol,
  // el superadministrador obtendría una sesión `activa`. Los permisos están puestos y hay una
  // prueba que lo afirma con el rol real de la aplicación, nunca con el propietario.
  const exige = await db
    .selectFrom('usuarios_roles as ur')
    .innerJoin('roles as r', 'r.id', 'ur.rol_id')
    .where('ur.usuario_id', '=', usuarioId)
    .where('r.exige_segundo_factor', '=', true)
    .select('r.id')
    .executeTakeFirst();
  if (exige) {
    // Si ya lo configuró y confirmó, la rama 1 lo habría atrapado (o `yaProboElFactor` lo
    // saltó a propósito). Así que llegar acá con el factor confirmado significa que acaba de
    // probarlo: no hay nada pendiente.
    if (opciones.yaProboElFactor) return 'activa';
    return 'debe_configurar_2fo';
  }

  // 4 · Todo en orden.
  return 'activa';
}
