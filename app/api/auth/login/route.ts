// ADR-0401 — El mensaje único va con el tiempo único.
// ADR-0402 — El freno por intentos no se evade.
// ADR-0403 — La búsqueda usa la misma expresión que el índice único.
// ADR-0405 — La cookie lleva el prefijo y los atributos.
// ADR-0407 — Ninguna ruta de autenticación registra cuerpos. INNEGOCIABLE.
// ADR-0413 — Un usuario con un rol que exige segundo factor no obtiene sesión habilitada.
//            INNEGOCIABLE.
//
// El login. Es RUTA PÚBLICA —no llama al portero— y aun así verifica el origen.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ACÁ EL ORDEN DE LAS OPERACIONES **ES** LA SEGURIDAD
//
// Casi todas las líneas de abajo están donde están por un motivo, y moverlas no rompe nada
// visible. La lista de lo que se pierde al reordenar:
//
//  1. `if (!usuario) return 401` — la línea que parece obviamente correcta. Abre el canal de
//     tiempo entero: *"responder 'no existe' al instante y 'contraseña incorrecta' 100 ms
//     después DICE EXACTAMENTE LO QUE EL MENSAJE ÚNICO VENÍA A ESCONDER"* (`07` § 3). Por eso
//     el señuelo, y por eso las tres causas se juntan en UN solo `if`, después de derivar.
//  2. Consultar roles o segundo factor **antes** de verificar la contraseña. Agrega viajes a
//     la base solo cuando el usuario existe: canal de existencia y de tiempo, en la misma
//     ruta que el señuelo venía a cerrar.
//  3. Preguntar por la EXISTENCIA de la fila de segundo factor en vez de `confirmado_el is
//     not null`. Un alta empezada y abandonada dejaría la cuenta en `pendiente_2fo` para
//     siempre, con un secreto que nadie confirmó.
//  4. Invertir las ramas del estado inicial. Ver el comentario de `estadoInicial()`.
//
// ═══════════════════════════════════════════════════════════════════════════════

import { randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import { verificar } from '../../../../lib/datos/hash.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import type { Trx } from '../../../../lib/datos/capa.ts';
import { serializarCookieSesion } from '../../../../lib/autorizacion/cookie.ts';
import { verificarOrigen } from '../../../../lib/autorizacion/portero.ts';
import { hashDeToken, type EstadoSesion } from '../../../../lib/autorizacion/sesion.ts';
import {
  CREDENCIALES_INVALIDAS,
  ok,
  rechazo,
} from '../../../../lib/autorizacion/respuesta.ts';
import { SENUELO } from '../../../../lib/autenticacion/senuelo.ts';
import { direccionDeOrigen } from '../../../../lib/autenticacion/direccion.ts';
import { auditar } from '../../../../lib/autenticacion/auditoria.ts';
import {
  anotarFalloDeCuenta,
  frenadoPorOrigen,
  limpiarFallosDeCuenta,
  minutosDeBloqueo,
} from '../../../../lib/autenticacion/freno.ts';

/** Cuánto vive una sesión a medio autenticar: cinco minutos, en LOS DOS vencimientos. */
const MINUTOS_PENDIENTE = 5;

export async function POST(peticion: Request): Promise<Response> {
  // El login modifica —crea una sesión— así que verifica el origen. El `08` § 5.3 pone
  // `verificarOrigen` "en el portero", y el login no pasa por el portero; la fila de
  // `PRUEBAS` de la Etapa 3 pide que **toda** petición que modifica lo verifique. La
  // conclusión es clara aunque no esté escrita para esta ruta.
  const origenMal = verificarOrigen(peticion);
  if (origenMal) return origenMal;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('credenciales_invalidas', CREDENCIALES_INVALIDAS);
  }
  const email = (cuerpo as { email?: unknown } | null)?.email;
  const password = (cuerpo as { password?: unknown } | null)?.password;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return rechazo('credenciales_invalidas', CREDENCIALES_INVALIDAS);
  }

  const ip = direccionDeOrigen(peticion);

  return conIdentidad(async (db) => {
    // ── El freno por ORIGEN, antes de gastar 100 ms en scrypt ────────────────
    if (await frenadoPorOrigen(db, ip)) {
      // La acción es PROPIA, no `login_fallido`: el contador cuenta exactamente esa acción,
      // así que registrar el rechazo con ella lo haría alimentar su propio contador y el
      // registro dejaría de distinguir "intentó y falló" de "ni lo dejamos intentar".
      await auditar(db, { accion: 'freno_por_origen', ip });
      return rechazo('demasiados_intentos');
    }

    // ── La consulta, con LA MISMA EXPRESIÓN que el índice único ──────────────
    //
    // `lower(email) = lower($1)`, y el `lower` de la derecha lo ejecuta **Postgres**, no
    // JavaScript. `String.toLowerCase()` es Unicode puro y `lower()` depende de la colación
    // de la base: para un correo no ASCII pueden dar resultados distintos, y entonces el
    // índice único considera iguales dos filas que el login considera distintas. El usuario
    // existe, la consulta no lo encuentra, y el mensaje dice "Credenciales inválidas."
    //
    // `email is not null` está porque el índice es PARCIAL. Sin ese predicado el
    // planificador puede no usarlo y cada login recorre la tabla — no cambia el resultado,
    // así que ninguna prueba de comportamiento lo detecta.
    const usuario = await db
      .selectFrom('usuarios')
      .where(sql<string>`lower(email)`, '=', sql<string>`lower(${email})`)
      .where('email', 'is not', null)
      .select([
        'id',
        'org_id',
        'password_hash',
        'activo',
        'debe_cambiar_password',
        'bloqueado_hasta',
      ])
      .executeTakeFirst();

    // ── La excepción deliberada al mensaje único ─────────────────────────────
    //
    // El `02` § 4: *"cuando la cuenta está bloqueada, SE DICE. Rompe el mensaje único a
    // propósito — quien llegó hasta ahí ya sabe que la cuenta existe, porque la bloqueó él.
    // Ocultarlo solo confunde al dueño legítimo, que necesita saber que tiene que esperar."*
    //
    // Va antes de derivar porque no hay nada que esconder en este camino.
    const minutos = usuario ? minutosDeBloqueo(usuario.bloqueado_hasta, new Date()) : null;
    if (usuario && minutos !== null) {
      await auditar(db, { accion: 'freno_por_cuenta', usuarioId: usuario.id, ip });
      return rechazo('cuenta_bloqueada', `Esperá ${minutos} minuto(s).`);
    }

    // ── EL SEÑUELO. Los tres caminos derivan un hash. ────────────────────────
    const aComparar = usuario?.password_hash ?? SENUELO;
    const coincide = verificar(password, aComparar);

    // Y las tres causas en UN solo `if`, después de derivar. `!usuario.activo` está acá y no
    // arriba a propósito: el pseudocódigo del `02` § 4 lo pone junto a las otras dos porque
    // *"los tres caminos tardaron lo mismo"*.
    if (!usuario || !usuario.activo || !coincide) {
      const motivo = !usuario ? 'email_inexistente' : !usuario.activo ? 'cuenta_inactiva' : 'password';
      if (usuario) await anotarFalloDeCuenta(db, usuario.id);
      // `email` en el detalle, porque la señal 4 del `10` § 2 cuenta
      // `count(distinct detalle->>'email')` por dirección y sin él devuelve cero — y un cero
      // por falta de datos se lee como "no hay ataque". La CONTRASEÑA nunca: un registro de
      // contraseñas fallidas es un diccionario de contraseñas reales con sus correos al lado.
      await auditar(db, {
        accion: 'login_fallido',
        usuarioId: usuario?.id ?? null,
        orgId: usuario?.org_id ?? null,
        ip,
        detalle: { email, motivo },
      });
      return rechazo('credenciales_invalidas', CREDENCIALES_INVALIDAS);
    }

    // ── Recién acá se consulta el resto. Solo para usuarios que ya entraron. ─
    const estado = await estadoInicial(db, usuario.id, usuario.debe_cambiar_password);

    const token = randomBytes(32).toString('base64url');
    const pendiente = estado === 'pendiente_2fo' || estado === 'debe_configurar_2fo';

    await db
      .insertInto('sesiones')
      .values({
        usuario_id: usuario.id,
        token_hash: hashDeToken(token),
        // EL ESTADO, EXPLÍCITO. El valor por omisión de la tabla es `'activa'`, así que
        // omitir esta línea le da una sesión habilitada para todo a alguien con contraseña
        // temporal o con el segundo factor sin verificar. El `08` § 10: *"si el estado no se
        // persiste, el encierro por contraseña temporal desaparece y nada falla"*. Responde
        // 200, la cookie funciona, y ninguna prueba del login lo ve.
        estado,
        // Una sesión sin identidad probada vive CINCO MINUTOS, y el techo absoluto también.
        // Sin escribir `expira_absoluto` hereda los 30 días del valor por omisión de la
        // tabla y queda una sesión a medio autenticar viva un mes.
        expira_el: pendiente
          ? sql<Date>`now() + interval '${sql.lit(MINUTOS_PENDIENTE)} minutes'`
          : sql<Date>`now() + interval '7 days'`,
        ...(pendiente
          ? {
              expira_absoluto: sql<Date>`now() + interval '${sql.lit(MINUTOS_PENDIENTE)} minutes'`,
            }
          : {}),
        ip,
        user_agent: peticion.headers.get('user-agent'),
      })
      .execute();

    // El contador se limpia SOLO acá, y `ultimo_acceso_el` se sella SOLO acá. Una marca de
    // estado tiene un solo autor (`07` § 6).
    await limpiarFallosDeCuenta(db, usuario.id);

    // La auditoría va en la MISMA transacción que el `insert` de la sesión. Si fueran dos,
    // existiría el caso "respondí 200 y el acceso no quedó registrado", que es literalmente
    // un éxito reportado que no ocurrió (`07` § 0, regla 1).
    await auditar(db, {
      accion: 'login',
      usuarioId: usuario.id,
      orgId: usuario.org_id,
      ip,
      detalle: { estado },
    });

    const respuesta = ok({ autenticado: true, estado });
    // La cookie se serializa a mano, con los cuatro atributos. Con la API del framework sale
    // sin `Secure`, el navegador la RECHAZA por el prefijo `__Host-`, el login responde 200
    // con el cuerpo correcto y el usuario vuelve a la pantalla de login. Y como los
    // navegadores tratan `http://localhost` como origen seguro, puede funcionar en desarrollo
    // y fallar solo en producción. Ver `lib/autorizacion/cookie.ts`.
    respuesta.headers.append('set-cookie', serializarCookieSesion(token));
    return respuesta;
  });
}

/**
 * El estado con el que nace la sesión. **El orden de las ramas no es el obvio.**
 *
 * El `03` § 5 lo explica, y la segunda mitad es la que casi siempre se pone al revés:
 *
 *   "Si el segundo factor ya está configurado y falta verificarlo, GANA SIEMPRE: todavía no
 *    se probó la identidad y nada más puede pasar antes. Pero si falta CONFIGURARLO y además
 *    hay contraseña temporal, gana LA CONTRASEÑA TEMPORAL — porque la temporal la conoce
 *    quien creó la cuenta, y dejar configurar el segundo factor primero le permitiría a esa
 *    persona INSCRIBIR SU DISPOSITIVO EN LA CUENTA DE OTRO."
 *
 * Ese es el ataque completo: el administrador que da de alta a alguien conoce su contraseña
 * temporal, entra antes que el dueño, e inscribe su propio teléfono. Invertir las ramas 2 y 3
 * lo habilita, y **nada falla**.
 */
async function estadoInicial(
  db: Trx,
  usuarioId: string,
  debeCambiarPassword: boolean,
): Promise<EstadoSesion> {
  // ¿Tiene el segundo factor CONFIRMADO? No "¿existe la fila?": un alta empezada y
  // abandonada dejaría la cuenta en `pendiente_2fo` para siempre.
  const confirmado = await db
    .selectFrom('usuarios_segundo_factor')
    .select('usuario_id')
    .where('usuario_id', '=', usuarioId)
    .where('confirmado_el', 'is not', null)
    .executeTakeFirst();

  // 1 · Segundo factor configurado y sin verificar en esta sesión: gana siempre.
  if (confirmado) return 'pendiente_2fo';

  // 2 · Contraseña temporal. ANTES de configurar el segundo factor. Ver arriba.
  if (debeCambiarPassword) return 'debe_cambiar_password';

  // 3 · ¿Algún rol le EXIGE segundo factor, y todavía no lo configuró?
  //
  // Si esta consulta devolviera cero filas por falta de permiso en vez de por ausencia de
  // rol, el superadministrador obtendría una sesión `activa`. Los permisos están puestos y
  // hay una prueba que lo afirma con el rol real de la aplicación, nunca con el propietario.
  const exige = await db
    .selectFrom('usuarios_roles as ur')
    .innerJoin('roles as r', 'r.id', 'ur.rol_id')
    .where('ur.usuario_id', '=', usuarioId)
    .where('r.exige_segundo_factor', '=', true)
    .select('r.id')
    .executeTakeFirst();
  if (exige) return 'debe_configurar_2fo';

  // 4 · Todo en orden.
  return 'activa';
}
