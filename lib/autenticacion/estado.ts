// ADR-0413 — Un usuario con un rol que exige segundo factor no obtiene sesión habilitada.
//            **YA NO SE CUMPLE, y hay que decirlo acá arriba.**
//
// Esa fila estaba marcada INNEGOCIABLE y se retiró a pedido explícito de quien decide el
// producto: obligar a dar de alta una aplicación de autenticación en el primer ingreso es
// demasiada fricción para este equipo. La rama que lo forzaba ya no está —ver la nota larga
// donde estaba, más abajo— y la migración 010 quitó la invariante de la base.
//
// Se deja el encabezado con el nombre de la fila y no se borra la referencia, porque una fila
// INNEGOCIABLE que se retira tiene que quedar visible como retirada. Un archivo que dijera
// simplemente "tres ramas" haría desaparecer la decisión.
//
// Lo que SÍ sigue en pie: quien active el segundo factor por su cuenta tiene que cumplirlo en
// cada ingreso. La rama 1 no se tocó.
//
// Las TRES ramas que deciden el estado de una sesión. **UN solo lugar.**
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
// temporal, entra antes que el dueño, e inscribe su propio teléfono.
//
// Se conserva escrito aunque la rama 3 ya no exista, por dos razones. La primera es que el
// orden de las dos ramas que QUEDAN sigue importando por lo mismo. La segunda es que el ataque
// no desapareció con la rama: **sigue siendo posible**, y ahora sin la rama que lo acotaba.
// Quien conozca una contraseña temporal puede entrar y activar el segundo factor con su propio
// dispositivo antes que el dueño. Lo que lo limita hoy es que el cambio de contraseña cierra
// TODAS las demás sesiones, así que el dueño lo expulsa al elegir su contraseña — pero el
// factor inscripto queda. Está anotado en `docs/DESPLIEGUE.md`.
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

  // ¿El segundo factor está CONFIRMADO?
  //
  // Se pregunta por `confirmado_el is not null`, NO por la existencia de la fila. El comentario
  // de la migración 006 lo dice: *"el login pregunta si el segundo factor está CONFIRMADO, no
  // si existe la fila"*. Un alta empezada y abandonada dejaría la cuenta en `pendiente_2fo`
  // para siempre, con un secreto que nadie confirmó.
  //
  // ── SE CONSULTA SIEMPRE, TAMBIÉN CON `yaProboElFactor` ──────────────────────
  //
  // Antes esta consulta estaba DENTRO del `if (!opciones.yaProboElFactor)`, y la rama 3 usaba
  // la bandera para decidir. Eso escondía un defecto: con la bandera puesta, la rama 3
  // devolvía `activa` **sin mirar si el factor existía**.
  //
  // No se notaba porque los dos únicos llamadores que la pasaban —`confirmar` y `verificar`—
  // escriben o ya tienen `confirmado_el`, así que "hay bandera" y "hay factor" coincidían
  // siempre. Dejó de coincidir cuando el cambio de contraseña pasó a llamar acá: ahí la bandera
  // significa *"el factor ya se probó en esta sesión, no vuelvas a pedirlo"*, y el factor bien
  // puede no estar configurado. La rama 3 devolvía `activa` y el segundo factor obligatorio se
  // salteaba entero — con una prueba nueva en rojo, que es como se encontró.
  //
  // Ahora la bandera hace UNA sola cosa: saltear la rama 1. Quién está configurado lo decide el
  // estado real de la fila, que es lo único que no puede mentir. Cuesta una consulta más en dos
  // caminos.
  const factorConfirmado = await db
    .selectFrom('usuarios_segundo_factor')
    .select('usuario_id')
    .where('usuario_id', '=', usuarioId)
    .where('confirmado_el', 'is not', null)
    .executeTakeFirst();

  // 1 · Confirmado y sin verificar en esta sesión: gana siempre.
  if (factorConfirmado && !opciones.yaProboElFactor) return 'pendiente_2fo';

  // 2 · Contraseña temporal. ANTES de configurar el segundo factor. Ver el encabezado.
  if (u.debe_cambiar_password) return 'debe_cambiar_password';

  // 3 · NO HAY RAMA 3. El segundo factor es OPCIONAL, y acá está lo que eso significa.
  //
  // ═══════════════════════════════════════════════════════════════════════════════
  // Acá había una consulta que preguntaba si algún rol del usuario tenía
  // `exige_segundo_factor` y, si lo tenía sin configurar, devolvía `debe_configurar_2fo`
  // — el estado que obliga a dar de alta un autenticador antes de poder trabajar.
  //
  // Se quitó a pedido explícito de quien decide el producto: obligar a configurar una
  // aplicación de autenticación en el primer ingreso es demasiada fricción para el tamaño
  // de este equipo.
  //
  // ── QUÉ SIGUE VALIENDO, PORQUE NO ES "SE FUE EL SEGUNDO FACTOR" ──────────────
  //
  // La rama 1 NO SE TOCÓ, y es la mitad que importa: quien tenga un factor confirmado y
  // sin verificar en esta sesión sigue recibiendo `pendiente_2fo` y sigue teniendo que
  // escribir su código. O sea que activar el segundo factor es opcional; **cumplirlo, una
  // vez activado, no lo es.**
  //
  // Y las tres rutas de `app/api/auth/2fo/` siguen enteras. Un usuario `activa` puede
  // llamarlas cuando quiera, porque `ESTADOS.activa` es `null` y habilita toda ruta. Así
  // que quien quiera protegerse puede, sin que nadie más quede encerrado.
  //
  // ── LO QUE SE ACEPTA, MEDIDO ─────────────────────────────────────────────────
  //
  // La restricción que la migración 010 quita decía —y sigue siendo cierto— que el rol de
  // plataforma *"ve los datos de TODAS las organizaciones, y una contraseña filtrada sin
  // segundo factor es una brecha de todos los clientes a la vez"*.
  //
  // Contra adivinar la contraseña por la puerta de entrada no cambia nada: el freno por
  // cuenta corta a los cinco intentos y bloquea quince minutos, el de origen a los veinte,
  // y el hash es `scrypt` con N=16384. Lo que se pierde es la defensa contra una contraseña
  // YA filtrada —correo, reuso, teclado capturado—, y ahí el segundo factor era lo único
  // que quedaba.
  //
  // El camino de vuelta es corto y está escrito: reponer esta rama y la restricción
  // `roles_plataforma_exige_2fo` de la migración 010.
  // ═══════════════════════════════════════════════════════════════════════════════

  // 4 · Todo en orden.
  //
  // `factorConfirmado` ya se consultó arriba y la rama 1 decidió con él. Si llegamos acá
  // con el factor confirmado es porque `yaProboElFactor` está puesto —quien llama acaba de
  // validar un código— y entonces no queda nada pendiente.
  return 'activa';
}
