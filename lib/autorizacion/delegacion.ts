// Qué roles puede OTORGAR quien otorga. Una sola regla, en un solo lugar.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL AGUJERO QUE ESTE ARCHIVO CIERRA
//
// `ADR-0504` ya impide otorgar un rol de plataforma: `solo_principal` exige `organizaciones.listar`,
// y eso mantiene al superadministrador fuera del alcance de cualquier otro. Lo que **no** había era
// nada que impidiera otorgar un rol IGUAL al propio.
//
// Mientras el administrador no administraba personas eso era teórico: nadie con `usuarios.crear`
// llegaba a la decisión salvo el superadministrador, que sí puede otorgar todo. Al darle a
// `administrador` la administración de SU empresa, deja de ser teórico: sin esto, el administrador
// de una empresa cliente puede crear otro administrador, y ése otro, sin que nadie de la plataforma
// se entere. Ninguna de las dos altas falla — el reparto de administradores simplemente crece.
//
// Y crece hacia arriba: cada administrador nuevo puede restablecer la contraseña de cualquiera de
// su empresa, incluida la del fundador. O sea que el eslabón no es «uno de más»: es una copia de la
// llave que se puede volver a copiar.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA: NO SE DELEGA LA FACULTAD DE ADMINISTRAR PERSONAS
//
// Un rol que confiere alguna capacidad de ESCRITURA sobre personas solo lo puede otorgar quien
// tiene `organizaciones.listar`. Con el reparto de hoy eso es exactamente lo que se pidió:
//
//   · el **superadministrador** —que la tiene— otorga superadministrador, administrador y usuario;
//   · el **administrador** —que no la tiene— otorga solo `usuario`.
//
// ── POR QUÉ `organizaciones.listar` Y NO OTRA COSA ─────────────────────────
//
// Porque es la MISMA capacidad con la que `ADR-0504` ya expresa «esto es de la plataforma», y su
// descripción en el catálogo es *«ver y cambiar entre todas las organizaciones»*. Dos reglas
// vecinas con dos capacidades distintas serían dos fronteras que hay que leer por separado, y la
// pregunta que las dos contestan es la misma: quién reparte poder.
//
// Y no es una comparación de nombre de rol, que es lo que `ADR-0302` prohíbe. Se pregunta por lo
// que el rol CONFIERE, así que un rol nuevo que administre personas queda cubierto sin tocar esto.
//
// ── LAS DOS ALTERNATIVAS QUE SE DESCARTARON, Y POR QUÉ ─────────────────────
//
// **1 · «Solo se otorga un subconjunto de lo propio».** Es la regla que suena obvia y no dice lo que
// se pidió: el conjunto de un administrador se contiene a sí mismo, así que un administrador podría
// otorgar `administrador`. Es literalmente el caso a evitar.
//
// **2 · «Solo se otorga un subconjunto ESTRICTO».** Arregla eso y rompe el otro extremo: el
// conjunto del superadministrador tampoco es un subconjunto estricto de sí mismo, así que **el
// superadministrador no podría crear otro superadministrador** — que es lo primero que se pidió, y
// que además ya está resuelto y argumentado en `components/ajustes/Usuarios.jsx`: *«una sola persona
// con la llave no es una regla de seguridad, es un punto único de falla»*.
//
// El pedido es asimétrico a propósito, y la asimetría real está en el eje plataforma/empresa. Por
// eso la regla se escribe sobre ese eje y no sobre el tamaño de los conjuntos.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Capacidad } from './capacidades.ts';

/**
 * Las capacidades que hacen que un rol ADMINISTRE personas.
 *
 * Son las de escritura, y `usuarios.ver` NO está: leer el panel de su propia empresa no reparte
 * poder — no crea a nadie, no cambia un rol y no restablece una contraseña. Meterla convertiría la
 * regla en «no se delega VER el panel», que es otra cosa y no la que se pidió.
 *
 * `roles.administrar` sí está aunque hoy ninguna ruta la exija: el día que exista la pantalla de
 * roles propios, quien la tenga podrá fabricar un rol con las capacidades que quiera. Dejarla fuera
 * sería dejar la puerta de al lado abierta esperando que nadie la construya.
 */
export const CAPACIDADES_QUE_ADMINISTRAN_PERSONAS: readonly Capacidad[] = [
  'usuarios.crear',
  'usuarios.editar',
  'usuarios.desactivar',
  'usuarios.borrar',
  'roles.asignar',
  'roles.administrar',
];

/** La capacidad que habilita a repartir la administración de personas. Ver el encabezado. */
export const CAPACIDAD_DE_LA_PLATAFORMA: Capacidad = 'organizaciones.listar';

/** ¿Este rol administra personas? Se pregunta por lo que CONFIERE, nunca por su nombre. */
export function administraPersonas(capacidadesDelRol: ReadonlySet<string>): boolean {
  return CAPACIDADES_QUE_ADMINISTRAN_PERSONAS.some((c) => capacidadesDelRol.has(c));
}

/**
 * ¿Puede esta persona otorgar un rol con estas capacidades?
 *
 * Contesta **solo** la regla de este archivo. La otra barrera —`solo_principal` de `ADR-0504`— vive
 * aparte y sigue haciendo falta: son dos ejes distintos. Uno pregunta si el rol alcanza otras
 * empresas; éste, si reparte poder sobre personas. Un rol podría ganar el segundo sin el primero.
 */
export function puedeOtorgar(
  capacidadesDelRol: ReadonlySet<string>,
  permisosDeQuienOtorga: ReadonlySet<string>,
): boolean {
  if (!administraPersonas(capacidadesDelRol)) return true;
  return permisosDeQuienOtorga.has(CAPACIDAD_DE_LA_PLATAFORMA);
}

/**
 * El texto del rechazo. **Uno solo**, para los dos caminos que otorgan un rol.
 *
 * Está acá y no escrito en cada ruta por lo mismo que `problemaDeLaNueva` en
 * `lib/autenticacion/politica.ts`: dos redacciones para el mismo rechazo es lo que pasa cuando el
 * texto se copia, y acá además serían dos explicaciones distintas de una regla que es una.
 *
 * Dice QUÉ falta y no solo que no se puede: quien lo lea tiene que poder entender que el camino es
 * pedírselo a la plataforma, no reintentar.
 */
export const MOTIVO_SIN_DELEGACION =
  'Ese rol administra personas, y otorgarlo requiere la capacidad organizaciones.listar: la ' +
  'administración de personas no se delega. Un administrador puede crear usuarios de su empresa, ' +
  'no otros administradores.';
