// ADR-0402 — El freno por intentos no se evade. Tipo: Código.
//
// Los DOS frenos: por cuenta y por origen.
//
// ═══════════════════════════════════════════════════════════════════════════════
// SON DOS Y HACEN COSAS DISTINTAS
//
//   · **por cuenta** — protege UNA cuenta de que le prueben contraseñas. Vive en las
//     columnas `intentos_fallidos` y `bloqueado_hasta` de `identidad.usuarios`.
//   · **por origen** — protege al SISTEMA de que le barran cuentas. Se cuenta sobre
//     `identidad.auditoria_accesos`, que ya tiene el índice `auditoria_por_ip_accion`
//     `(ip, accion, creado_el desc)` — sin ese índice, *"esa consulta hace un recorrido
//     completo EN CADA INTENTO DE LOGIN"* (`07` § 3).
//
// Y fallan en direcciones opuestas a propósito:
//
//   · el de cuenta falla **cerrado**: si no se puede leer, no se entra.
//   · el de origen falla **ABIERTO**: un error al contar dejaría afuera a todo el mundo a la
//     vez. Es la única excepción del sistema a "fallar cerrado", y es deliberada — un freno
//     que se rompe y bloquea a todos es peor que un freno que se rompe y no frena.
//
// ── EL CONTADOR NO VUELVE A CERO AL BLOQUEAR ─────────────────────────────────
//
// El `07` § 3: *"al bloquear, si el contador vuelve a cero, cuando el bloqueo vence el
// atacante tiene OTRA TANDA LIMPIA. Si no vuelve a cero, hay que decidir cuándo se limpia o
// el bloqueo se vuelve permanente. **Es una decisión, no un detalle.**"*
//
// La decisión: **el contador se limpia con un login exitoso, y solo con eso.** Al bloquear
// no se reinicia, así que el segundo bloqueo llega al primer fallo posterior al vencimiento
// del primero. Y no se vuelve permanente porque `bloqueado_hasta` es una fecha: pasado el
// plazo, la cuenta acepta intentos otra vez.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import type { Trx } from '../datos/capa.ts';

/** Cinco intentos, quince minutos. */
export const TOPE_POR_CUENTA = 5;
export const BLOQUEO_MINUTOS = 15;

/** Veinte fallos en quince minutos desde la misma dirección. */
export const TOPE_POR_ORIGEN = 20;
export const VENTANA_ORIGEN_MINUTOS = 15;

/**
 * ¿La cuenta está bloqueada? Devuelve los minutos que faltan, o `null`.
 *
 * El plazo se compara **en la base** y no en TypeScript, por lo mismo que los vencimientos
 * de la sesión: con varios procesos el reloj del proceso decidiría si un bloqueo sigue
 * valiendo, y eso es un problema intermitente.
 */
export function minutosDeBloqueo(bloqueadoHasta: Date | null, ahora: Date): number | null {
  if (!bloqueadoHasta) return null;
  const restan = bloqueadoHasta.getTime() - ahora.getTime();
  if (restan <= 0) return null;
  return Math.ceil(restan / 60_000);
}

/**
 * Registra un fallo contra la cuenta, y bloquea si llegó al tope.
 *
 * El incremento lo hace **la base** (`intentos_fallidos + 1` en el `set`), no TypeScript.
 * Con lectura-modificación-escritura en el lenguaje, dos peticiones simultáneas pierden
 * incrementos y el freno cuenta menos de lo que dice — y a esta escala eso no se va a
 * reproducir nunca en una prueba.
 */
export async function anotarFalloDeCuenta(trx: Trx, usuarioId: string): Promise<void> {
  await trx
    .updateTable('usuarios')
    .set({
      intentos_fallidos: sql<number>`intentos_fallidos + 1`,
      bloqueado_hasta: sql<Date | null>`case
        when intentos_fallidos + 1 >= ${sql.lit(TOPE_POR_CUENTA)}
        then now() + interval '${sql.lit(BLOQUEO_MINUTOS)} minutes'
        else bloqueado_hasta
      end`,
    })
    .where('id', '=', usuarioId)
    .execute();
}

/**
 * Limpia el contador. Se llama **solo** en el camino de éxito.
 *
 * `ultimo_acceso_el` se sella acá y en ningún otro lado. El `07` § 6: *"una columna 'última
 * sincronización' que nadie actualiza es PEOR QUE NO TENERLA: se lee como un hecho"* — y
 * *"toda marca de estado tiene un solo autor, y se sella solo cuando la operación de verdad
 * ocurrió"*.
 */
export async function limpiarFallosDeCuenta(trx: Trx, usuarioId: string): Promise<void> {
  await trx
    .updateTable('usuarios')
    .set({
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      ultimo_acceso_el: sql<Date>`now()`,
    })
    .where('id', '=', usuarioId)
    .execute();
}

/**
 * ¿Esta dirección pasó el tope de fallos en la ventana?
 *
 * Cuenta **solo** `login_fallido`. Si contara también `freno_por_origen`, el rechazo
 * alimentaría su propio contador y el bloqueo se sostendría solo mientras alguien golpee
 * (`07` § 3).
 *
 * **Falla abierto**: devuelve `false` si no puede contar. Ver el encabezado.
 */
export async function frenadoPorOrigen(trx: Trx, ip: string | null): Promise<boolean> {
  if (!ip) return false;
  try {
    const f = await trx
      .selectFrom('auditoria_accesos')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('ip', '=', ip)
      .where('accion', '=', 'login_fallido')
      .where(
        'creado_el',
        '>',
        sql<Date>`now() - interval '${sql.lit(VENTANA_ORIGEN_MINUTOS)} minutes'`,
      )
      .executeTakeFirst();
    return Number(f?.n ?? 0) >= TOPE_POR_ORIGEN;
  } catch {
    // La única excepción a "fallar cerrado" de todo el sistema, y es deliberada.
    return false;
  }
}
