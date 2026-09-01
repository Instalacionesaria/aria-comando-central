// De quién son los leads de quien está mirando la pantalla del Closer.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PREGUNTA QUE ESTE ARCHIVO CONTESTA YA ESTABA HECHA, Y SE HABÍA CONTESTADO AL REVÉS
//
// `lib/negocio/fila.ts` la deja planteada con las palabras del `11` § 8:
//
//   *«¿un closer ve solo sus contactos o los de toda la organización? Sea cual sea la respuesta,
//   **no es un permiso**: es un filtro de negocio que vive en la consulta. Si fuera una capacidad,
//   haría falta un rol nuevo por cada variante y el modelo de permisos se llenaría de casos
//   particulares.»*
//
// Y ahí mismo elige: *«por territorio. **No por responsable asignado, porque GHL no da
// asignación** — da zona»*.
//
// **Esa premisa dejó de ser cierta**, medida el 2026-09-01 contra la subcuenta real: `assignedTo`
// viene en la misma respuesta de `POST /contacts/search` que la aplicación ya pide, y 87 de cada
// 100 contactos de `zona_closer` lo traen. Así que la pregunta recibe su segunda respuesta —**por
// asignación**— sin cambiar la parte que sigue valiendo: esto es un filtro de negocio, vive en la
// consulta, y no toca el modelo de permisos ni una línea.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS DOS ALCANCES, Y POR QUÉ «SIN VINCULAR» CAE EN «TODO»
//
//   · `todo` — ve el territorio entero. Es quien NO está configurado como closer (un
//     administrador, un superadministrador, alguien en capacitación) **y también el closer que
//     está designado pero sin vincular a un usuario del CRM**.
//   · `mio` — ve solo los contactos que el CRM le asignó a su usuario de GoHighLevel.
//
// La segunda mitad de `todo` es la que hay que argumentar, porque la salida obvia es la contraria:
// un closer sin vínculo no tiene ningún lead que reclamar, así que «mostrarle lo suyo» sería
// mostrarle **cero**. Una pantalla vacía no dice «te falta vincularte»: dice «no hay trabajo», y
// esa persona se va a su casa. Fallar del lado de mostrar de más es visible y reparable; fallar del
// lado de mostrar de menos esconde el trabajo y nadie se entera.
//
// Los contactos **sin asignar** —13 de cada 100— quedan fuera de todo `mio` y dentro de `todo`. Fue
// la decisión de producto: *«solo quien no es closer»*, con un contador para que alguien los asigne
// en el CRM. Ningún lead desaparece, y dos closers nunca trabajan el mismo.
// ═══════════════════════════════════════════════════════════════════════════════

import { datos } from '../datos/contexto.ts';

/**
 * De quién son los leads que hay que mostrar.
 *
 * Es una unión discriminada y no un `string | null`, por lo mismo que el resto del proyecto usa
 * uniones para los estados: con `crmUsuarioId: string | null`, «ve todo» y «es closer y no tiene
 * vínculo» se escriben igual —los dos son `null`— y quien consuma tiene que acordarse de cuál era.
 */
export type AlcanceDelCloser =
  | { tipo: 'todo' }
  | { tipo: 'mio'; crmUsuarioId: string };

/** Un closer configurado, con su vínculo al CRM. */
export interface CloserConfigurado {
  usuarioId: string;
  /** El nombre, para que la pantalla diga de quién son los números que muestra. */
  nombre: string;
  /** `null` = designado y sin vincular. Esa persona ve todo. */
  crmUsuarioId: string | null;
  actualizadoEl: Date;
}

/**
 * Los closers de la organización activa, en orden estable.
 *
 * Reemplaza a `closerAsignado()`, que devolvía uno solo porque la clave primaria de la tabla era
 * `org_id` sola hasta la migración 034.
 *
 * Va por la conexión del INQUILINO: la tabla está en `negocio` y su política de aislamiento acota
 * por organización sola, así que acá no hace falta —ni se debe— filtrar por `org_id` a mano.
 *
 * El orden es por fecha de designación y desempata por identificador. No es cosmética: la pantalla
 * dibuja las filas en este orden y ofrece «ver como» con esta lista, así que un orden inestable
 * haría que las opciones del desplegable se movieran solas entre dos cargas.
 */
export async function closersDeLaEmpresa(): Promise<CloserConfigurado[]> {
  /* `innerJoin` y no `leftJoin`, igual que antes: sin fila en `usuarios` la designación no existe,
     porque la clave foránea con `on delete cascade` se la lleva. Un `leftJoin` dejaría entrar una
     fila con el nombre nulo, o sea un estado que la base ya hace imposible. */
  const filas = await datos()
    .selectFrom('closer_asignado as ca')
    .innerJoin('usuarios as u', 'u.id', 'ca.usuario_id')
    .select(['ca.usuario_id', 'u.nombre', 'ca.crm_usuario_id', 'ca.actualizado_el'])
    .orderBy('ca.actualizado_el', 'asc')
    .orderBy('ca.usuario_id', 'asc')
    .execute();

  return filas.map((f) => ({
    usuarioId: f.usuario_id,
    nombre: f.nombre,
    crmUsuarioId: f.crm_usuario_id,
    actualizadoEl: f.actualizado_el,
  }));
}

/**
 * El alcance de UNA persona, dados los closers de su empresa.
 *
 * ── SE CALCULA A PARTIR DE LA LISTA, NO CON UNA CONSULTA PROPIA ─────────────
 *
 * Quien llama ya necesita la lista completa —para el desplegable «ver como» y para poner el nombre
 * del asignado en cada fila—, así que una consulta más acá sería la misma pregunta dos veces por
 * carga de pantalla. Y peor: dos respuestas que pueden discrepar si algo cambia en el medio.
 *
 * La decisión la toma el SERVIDOR con la sesión, nunca la pantalla comparando identificadores. Es
 * la misma regla que ya gobierna `soyElCloser` en `app/api/closer/mi-dia/route.ts`.
 */
export function alcanceDe(
  usuarioId: string,
  closers: readonly CloserConfigurado[],
): AlcanceDelCloser {
  const suyo = closers.find((c) => c.usuarioId === usuarioId);
  // No es closer, o lo es y no está vinculado. Ver el encabezado: las dos ven todo.
  if (!suyo || suyo.crmUsuarioId === null) return { tipo: 'todo' };
  return { tipo: 'mio', crmUsuarioId: suyo.crmUsuarioId };
}

/**
 * El alcance que pidió quien administra con el selector «ver como».
 *
 * ── POR QUÉ ESTO NO ES UN AGUJERO ──────────────────────────────────────────
 *
 * Deja que una petición elija de quién ver los leads, que es exactamente la forma que tiene una
 * escalada. Lo que lo cierra son dos cosas, y hacen falta las dos:
 *
 *   1 · **Solo se atiende cuando el alcance propio es `todo`.** Un closer vinculado que mande
 *       `verComo` a mano recibe su propio alcance igual: la petición se ignora, no se rechaza. Se
 *       ignora y no se rechaza porque un 403 acá sería un oráculo — le confirmaría a quien prueba
 *       que ese identificador existe y es closer.
 *   2 · **El identificador pedido tiene que estar en la lista de SU empresa.** La lista sale de
 *       `closer_asignado` leída por la conexión del inquilino, así que ya viene acotada por la
 *       política de fila: un identificador de otra organización no está y cae en `todo`.
 *
 * Y lo que se pide es el identificador de NUESTRO usuario, no el del CRM. Con el del CRM, alguien
 * podría inventar uno que no esté vinculado a nadie y ver una lista que ninguna pantalla ofrece.
 */
export function alcancePedido(
  propio: AlcanceDelCloser,
  verComo: string | null,
  closers: readonly CloserConfigurado[],
): AlcanceDelCloser {
  if (propio.tipo !== 'todo' || !verComo) return propio;
  const elegido = closers.find((c) => c.usuarioId === verComo);
  if (!elegido || elegido.crmUsuarioId === null) return propio;
  return { tipo: 'mio', crmUsuarioId: elegido.crmUsuarioId };
}


/** Todo lo que una pantalla del Closer necesita saber sobre de quién son los leads. */
export interface QuienMira {
  /** Los closers configurados, para el desplegable y para poner el nombre en cada fila. */
  closers: CloserConfigurado[];
  /** El alcance que se va a aplicar: el propio, o el que pidió el selector «ver como». */
  alcance: AlcanceDelCloser;
  /** El alcance de la persona sin el selector. Es lo que decide si el selector se ofrece. */
  propio: AlcanceDelCloser;
}

/**
 * Resuelve las tres cosas de una vez. **Corre dentro de `conOrganizacion(`.**
 *
 * Existe para que las tres pantallas del Closer —Mi Día, Pipeline y Contactos— hagan la misma
 * pregunta con una sola llamada. Repetir los tres pasos en cada ruta es cómo se llega a que una
 * de las tres se olvide de aplicar el alcance: las otras dos filtran, ésa no, y el closer ve en
 * Contactos los leads que Mi Día le esconde. No falla nada.
 */
export async function alcanceDeQuienMira(
  usuarioId: string,
  verComo: string | null = null,
): Promise<QuienMira> {
  const closers = await closersDeLaEmpresa();
  const propio = alcanceDe(usuarioId, closers);
  return { closers, propio, alcance: alcancePedido(propio, verComo, closers) };
}

/**
 * El parámetro `verComo` de la URL, ya validado como forma.
 *
 * Un identificador mal formado no llega a la consulta: `alcancePedido` lo buscaría en la lista y
 * no lo encontraría —así que caería en `todo`, que es correcto— pero de paso evita que un valor
 * absurdo viaje por tres funciones. Se devuelve `null` y no se rechaza, por lo mismo que
 * `alcancePedido` ignora en vez de rechazar: un 400 acá sería un oráculo.
 */
export function verComoDeLaUrl(peticion: Request): string | null {
  const crudo = new URL(peticion.url).searchParams.get('verComo');
  if (!crudo) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(crudo)
    ? crudo
    : null;
}
