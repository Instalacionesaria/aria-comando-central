// Quién es EL closer de la organización: leerlo, elegirlo, y quién puede ser elegido.
//
// ═══════════════════════════════════════════════════════════════════════════════
// «CLOSER» ES UNA DESIGNACIÓN, NO UN ROL — Y ESO CAMBIA DÓNDE VIVE CADA MITAD
//
// Se pidió así: *"ya no es un closer, ahora es un usuario con acceso a la pestaña closer"*, y
// *"el que configura a un usuario como closer no es un rol"*. La base ya estaba de acuerdo: los
// únicos roles sembrados son `superadministrador` y `administrador`, y el acceso a la pestaña sale
// de `identidad.usuarios_secciones`, que es un permiso.
//
// De ahí que las dos mitades vivan en dominios distintos, y hay que respetarlo:
//
//   · **quién PUEDE ser closer** → identidad. Depende de capacidades y de secciones concedidas, y
//     las dos tablas que lo dicen —la vista `usuarios_permisos` y `usuarios_secciones`— solo las
//     alcanza `app_identidad`. Por eso `candidatosAlCloser` recibe la transacción y no la abre.
//   · **quién ES el closer** → negocio. Es un dato de trabajo, y en `negocio` el aislamiento por
//     organización sale gratis y verificado por `aplicar_aislamiento`. Es el mismo razonamiento que
//     la migración 015 escribió para las comisiones.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA QUE DECIDE QUIÉN ENTRA A LA LISTA, Y POR QUÉ SE ESCRIBE CON CAPACIDADES
//
// Se pidió que **un administrador no pueda ser closer**. Escrito como `clave !== 'administrador'`
// eso funciona hoy y miente el día que exista un segundo rol que administre — que es exactamente lo
// que `ADR-0302` prohíbe buscar en el código: *"la comparación es la CAPACIDAD, nunca el nombre del
// rol"*.
//
// Así que la condición es `credenciales.editar`, y la elección no es cómoda sino significativa:
// **es la misma capacidad que habilita designar.** La regla queda en una frase que se puede
// comprobar leyéndola: *quien puede designar no puede ser designado.* Un rol nuevo que administre
// la empresa queda excluido solo, sin tocar este archivo.
//
// Y las otras dos condiciones son las que definen «tiene la pestaña», copiadas de la fórmula que
// `lib/autorizacion/sesion.ts` usa para una sola persona:
//
//   1 · su unión de capacidades incluye `closer.ver`;
//   2 · si TODOS sus roles tienen `secciones_restringidas`, además necesita la fila
//       `usuarios_secciones = 'closer'`. Basta un rol NO restringido para no estar restringido —
//       `bool_and`, no `bool_or`: los roles solo SUMAN, y con `bool_or` le estaríamos restando
//       pestañas al rol de administrador.
//
// El punto 2 es el que se hace mal solo. Con `bool_or`, alguien que tiene `administrador` y
// `usuario` quedaría restringido, y su acceso pasaría a depender de filas que nadie le cargó.
// ═══════════════════════════════════════════════════════════════════════════════

import { datos } from '../datos/contexto.ts';
import type { Trx } from '../datos/capa.ts';

/** La capacidad que habilita la pestaña del closer. La declara `lib/autorizacion/secciones.ts`. */
export const CAPACIDAD_CLOSER = 'closer.ver';

/**
 * La capacidad que EXCLUYE de la lista, y es la misma que habilita designar.
 *
 * No es `'administrador'` a propósito. Ver el encabezado.
 */
export const CAPACIDAD_QUE_EXCLUYE = 'credenciales.editar';

/** La sección cuya concesión hace falta cuando la persona está restringida por secciones. */
export const SECCION_CLOSER = 'closer';

/** Alguien que PODRÍA ser el closer de esta organización. */
export interface CandidatoACloser {
  usuarioId: string;
  nombre: string;
  email: string;
}

/**
 * Los usuarios de la organización que pueden ser designados closer.
 *
 * **Recibe la transacción de IDENTIDAD; no la abre.** Las tres tablas que consulta solo las alcanza
 * `app_identidad`: la vista `usuarios_permisos`, `usuarios_roles` y `usuarios_secciones`. Con la
 * conexión del inquilino esto falla con «permission denied», que es lo que le pasó a
 * `usuarioObjetivo` en la ruta de comisiones y quedó escrito ahí.
 *
 * El filtro por organización es explícito porque tiene que serlo: la política de `identidad.usuarios`
 * para `app_identidad` no acota por inquilino sola.
 */
/**
 * Por qué la lista de candidatos quedó vacía. `null` = no quedó vacía.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * EL DEFECTO QUE ESTO CIERRA, Y SE VIO CONTRA LA BASE DE PRODUCCIÓN
 *
 * La pantalla ya avisaba cuando la lista salía vacía, y el aviso era «hay que darle a alguien la
 * pestaña Closer desde Ajustes → Usuarios». Medido contra producción el 2026-08-28: los tres usuarios
 * que existen son administradores, y **los tres YA tienen la pestaña Closer** —`closer.ver` está
 * concedida a los tres roles del catálogo—. Lo que les falta es lo contrario: **no** administrar la
 * empresa, porque `credenciales.editar` excluye.
 *
 * O sea que el aviso mandaba a la acción equivocada. Un administrador va a Ajustes → Usuarios, ve que
 * todos tienen Closer, y queda trabado sin nada que mirar. Es la clase de defecto que no da error:
 * la pantalla avisa, el texto es amable, y no resuelve nada.
 *
 * Los cuatro motivos llevan a DOS acciones distintas, y por eso se distinguen:
 *
 *   · `sin_gente`     → no hay ni una persona activa con correo. Hay que crear usuarios.
 *   · `todos_admin`   → los hay, y todos administran la empresa. Hace falta alguien que NO administre.
 *   · `sin_capacidad` → los hay, no administran, y no tienen la pestaña Closer. Ahí sí: Ajustes → Usuarios.
 *   · `sin_seccion`   → tienen la capacidad por su rol pero la sección no está concedida.
 *
 * Se cuenta cuántos cayeron por cada motivo, y gana el que más explica — no el primero que aparece.
 */
export type PorqueNingunCandidato = 'sin_gente' | 'todos_admin' | 'sin_capacidad' | 'sin_seccion';

export interface Candidatos {
  candidatos: CandidatoACloser[];
  /** `null` cuando hay al menos uno. Nunca se rellena con un motivo de reserva. */
  porqueNinguno: PorqueNingunCandidato | null;
}

export async function candidatosAlCloser(db: Trx, orgId: string): Promise<Candidatos> {
  const filas = await db
    .selectFrom('usuarios as u')
    .where('u.org_id', '=', orgId)
    // Una persona desactivada no puede ser el closer del mes. Y no se la esconde de la lista por
    // prolijidad: designarla produciría un cockpit con el nombre de alguien que no puede entrar.
    .where('u.activo', '=', true)
    /* ── Y SIN EMAIL TAMPOCO, QUE LO ENCONTRÓ EL VERIFICADOR DE TIPOS ────────
     *
     * `usuarios.email` es `string | null`, y el nulo no es un descuido del esquema: su comentario
     * dice que existen *"usuarios SIN acceso, que solo sirven para atribuir trabajo"*, con un `check`
     * que obliga a que el email y el hash sean los dos nulos o los dos no nulos.
     *
     * O sea que una persona sin email **no puede entrar al sistema**. Designarla closer dejaría un
     * cockpit con su nombre, sus números y su comisión que ella no puede abrir nunca — y a un
     * administrador le parecería una designación hecha. Falla cerrado: no entra a la lista. */
    .where('u.email', 'is not', null)
    .select(['u.id', 'u.nombre', 'u.email'])
    .orderBy('u.nombre', 'asc')
    .execute();

  if (filas.length === 0) return { candidatos: [], porqueNinguno: 'sin_gente' };

  const ids = filas.map((f) => f.id);

  // Las capacidades de cada uno, de la vista de permisos efectivos.
  const permisos = await db
    .selectFrom('usuarios_permisos')
    .where('usuario_id', 'in', ids)
    .where('permiso', 'in', [CAPACIDAD_CLOSER, CAPACIDAD_QUE_EXCLUYE])
    .select(['usuario_id', 'permiso'])
    .execute();

  const tiene = new Map<string, Set<string>>();
  for (const p of permisos) {
    const suyas = tiene.get(p.usuario_id) ?? new Set<string>();
    suyas.add(p.permiso);
    tiene.set(p.usuario_id, suyas);
  }

  // ¿Están restringidos por secciones? `bool_and`: basta UN rol no restringido para no estarlo.
  const banderas = await db
    .selectFrom('usuarios_roles as ur')
    .innerJoin('roles as r', 'r.id', 'ur.rol_id')
    .where('ur.usuario_id', 'in', ids)
    .groupBy('ur.usuario_id')
    .select(({ fn }) => [
      'ur.usuario_id as usuario_id',
      fn<boolean | null>('bool_and', ['r.secciones_restringidas']).as('restringido'),
    ])
    .execute();
  const restringido = new Map(banderas.map((b) => [b.usuario_id, b.restringido === true]));

  // Y las secciones concedidas, que solo hacen falta para los restringidos.
  const restringidos = ids.filter((id) => restringido.get(id) === true);
  const concedida = new Set<string>();
  if (restringidos.length > 0) {
    const concedidas = await db
      .selectFrom('usuarios_secciones')
      .where('usuario_id', 'in', restringidos)
      .where('seccion', '=', SECCION_CLOSER)
      .select('usuario_id')
      .execute();
    for (const c of concedidas) concedida.add(c.usuario_id);
  }

  /* Se CUENTA por qué cayó cada uno, en vez de solo filtrar. El conteo es lo único que permite que el
     aviso de la pantalla nombre la acción que de verdad resuelve la situación — ver el tipo de arriba.
     El orden de los tres descartes es el mismo que antes y no es intercambiable: quien administra la
     empresa queda afuera aunque tenga todo lo demás. */
  const descartes = { todos_admin: 0, sin_capacidad: 0, sin_seccion: 0 };

  const candidatos = filas
    .filter((f) => {
      const suyas = tiene.get(f.id) ?? new Set<string>();
      // Quien puede designar no puede ser designado.
      if (suyas.has(CAPACIDAD_QUE_EXCLUYE)) {
        descartes.todos_admin += 1;
        return false;
      }
      if (!suyas.has(CAPACIDAD_CLOSER)) {
        descartes.sin_capacidad += 1;
        return false;
      }
      // Restringido sin la sección concedida = no ve la pestaña. Cero filas es cero secciones:
      // falla cerrado, igual que en `sesion.ts`.
      if (restringido.get(f.id) === true && !concedida.has(f.id)) {
        descartes.sin_seccion += 1;
        return false;
      }
      return true;
    })
    // El `?? ''` no puede ocurrir: el `where` de arriba ya descartó los nulos. Está para que el
    // tipo no mienta, no para cubrir un caso.
    .map((f) => ({ usuarioId: f.id, nombre: f.nombre, email: f.email ?? '' }));

  if (candidatos.length > 0) return { candidatos, porqueNinguno: null };

  /* Gana el motivo que MÁS GENTE explica, no el primero que apareció. Con dos administradores y una
     persona sin la sección concedida, la acción útil es «concedé la sección» y no «creá un usuario que
     no administre»: el segundo es más trabajo para el mismo resultado.
     Y el empate se rompe por el orden de esta lista, que va de la acción más barata a la más cara. */
  const porMotivo: [PorqueNingunCandidato, number][] = [
    ['sin_seccion', descartes.sin_seccion],
    ['sin_capacidad', descartes.sin_capacidad],
    ['todos_admin', descartes.todos_admin],
  ];
  const ganador = porMotivo.reduce((mejor, actual) => (actual[1] > mejor[1] ? actual : mejor));
  return { candidatos, porqueNinguno: ganador[1] > 0 ? ganador[0] : 'sin_gente' };
}

/** La designación vigente. `null` = **nadie designó a nadie**, que no es «designó a nadie». */
export interface Designacion {
  usuarioId: string;
  /** El nombre, para que la pantalla diga de quién son los números que muestra. */
  nombre: string;
  actualizadoEl: Date;
  actualizadoPor: string | null;
}

/**
 * Quién es el closer de la organización activa, o `null`.
 *
 * Va por la conexión del INQUILINO: la tabla está en `negocio` y su política de aislamiento acota
 * por organización sola, así que acá no hace falta —ni se debe— filtrar por `org_id` a mano.
 */
export async function closerAsignado(): Promise<Designacion | null> {
  /* El nombre se trae en la MISMA consulta, con un `join` a `usuarios`. Se puede desde la conexión
     del inquilino: ese rol tiene concedidas cinco columnas de esa tabla, y `nombre` es una de ellas
     —lo demuestra `porcentajesDeLaEmpresa`, que lee `u.id`, `u.nombre` y `u.email` por acá—. Lo que
     NO se puede leer por esta conexión es `es_admin_principal`, y eso ya está escrito en la ruta de
     comisiones.

     Y es un `innerJoin`, no un `leftJoin`: sin fila en `usuarios` la designación no existe, porque
     la clave foránea con `on delete cascade` se la lleva. Un `leftJoin` dejaría entrar una fila con
     el nombre nulo, o sea un estado que la base ya hace imposible. */
  const f = await datos()
    .selectFrom('closer_asignado as ca')
    .innerJoin('usuarios as u', 'u.id', 'ca.usuario_id')
    .select(['ca.usuario_id', 'u.nombre', 'ca.actualizado_el', 'ca.actualizado_por'])
    .executeTakeFirst();
  if (!f) return null;
  return {
    usuarioId: f.usuario_id,
    nombre: f.nombre,
    actualizadoEl: f.actualizado_el,
    actualizadoPor: f.actualizado_por,
  };
}

/**
 * Designa al closer. **Reemplaza al anterior en una sola sentencia.**
 *
 * El `on conflict (org_id)` es lo que hace que el cambio sea atómico: no existe el instante con dos
 * designados ni el instante con ninguno. Un `delete` seguido de un `insert` tendría los dos, y el
 * segundo es el que se ve —un cockpit en blanco— si algo falla en el medio.
 */
export async function asignarCloser(usuarioId: string, actor: string): Promise<void> {
  await datos()
    .insertInto('closer_asignado')
    .values({
      usuario_id: usuarioId,
      actualizado_el: new Date(),
      actualizado_por: actor,
    } as never)
    .onConflict((oc: any) =>
      oc.column('org_id').doUpdateSet({
        usuario_id: usuarioId,
        actualizado_el: new Date(),
        actualizado_por: actor,
      } as never),
    )
    .execute();
}

/**
 * Quita la designación: la organización queda **sin closer**.
 *
 * Existe por lo mismo que «Dejar sin configurar» existe para el porcentaje: hay que poder volver de
 * «es Ana» a «todavía nadie», y sin esta operación el único camino sería designar a otro. No es lo
 * mismo, y la pantalla lo dibuja distinto.
 */
export async function quitarCloser(): Promise<void> {
  await datos().deleteFrom('closer_asignado').execute();
}
