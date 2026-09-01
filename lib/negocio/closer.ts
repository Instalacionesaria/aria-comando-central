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
// LA REGLA QUE EXCLUÍA AL ADMINISTRADOR SE FUE, Y CONVIENE SABER QUÉ ERA
//
// Decía: *quien puede designar no puede ser designado.* Estaba escrita con la capacidad
// `credenciales.editar` y no con el nombre del rol —`ADR-0302`— y era una buena regla mientras
// hubo **un** closer: los números del cockpit eran de esa persona, así que designarse a uno mismo
// era escribirse el propio tablero.
//
// Se pidió sacarla con todas las letras: *«no te olvides de cambiar que ahora cualquiera puede ser
// configurado como closer, admin superadmin o usuario»*, y *«quitame esa alerta»* — la que decía
// que hacía falta dar de alta a alguien que NO fuera administrador.
//
// Y el argumento que la sostenía se cayó solo con el cambio a varios closers: lo que decide qué
// leads ve cada uno ya no es la designación, es **el vínculo con un usuario de GoHighLevel**, y eso
// lo reparte el CRM, no quien configura. Un administrador que se designa closer se da de alta a sí
// mismo en una lista; los leads que va a ver son los que el CRM ya le asignó.
//
// Medido, además, contra producción el 2026-08-28 y otra vez el 2026-09-01: **las tres personas de
// la empresa son administradoras**. La regla no protegía nada — dejaba la lista vacía y mandaba a
// crear un usuario que no administrara, que era trabajo para el mismo resultado.
//
// Lo que SÍ se conserva son las dos condiciones que definen «tiene la pestaña», copiadas de la
// fórmula que
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
 * Los TRES motivos que quedan llevan a acciones distintas, y por eso se distinguen:
 *
 *   · `sin_gente`     → no hay ni una persona activa con correo. Hay que crear usuarios.
 *   · `sin_capacidad` → los hay y no tienen la pestaña Closer. Ahí sí: Ajustes → Usuarios.
 *   · `sin_seccion`   → tienen la capacidad por su rol pero la sección no está concedida.
 *
 * **Eran cuatro.** El que se fue es `todos_admin` —*«todos administran la empresa, hace falta
 * alguien que NO administre»*— y se fue con la regla que lo producía, no por prolijidad: hoy
 * cualquier rol puede ser closer. Era además el motivo que MÁS se veía en producción, porque las
 * tres personas de la empresa son administradoras.
 *
 * Se cuenta cuántos cayeron por cada motivo, y gana el que más explica — no el primero que aparece.
 */
export type PorqueNingunCandidato = 'sin_gente' | 'sin_capacidad' | 'sin_seccion';

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
    .where('permiso', '=', CAPACIDAD_CLOSER)
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
     aviso de la pantalla nombre la acción que de verdad resuelve la situación — ver el tipo de arriba. */
  const descartes = { sin_capacidad: 0, sin_seccion: 0 };

  const candidatos = filas
    .filter((f) => {
      const suyas = tiene.get(f.id) ?? new Set<string>();
      /* Acá había un tercer descarte, el primero de los tres: quien tuviera `credenciales.editar`
         quedaba afuera. Se fue con la regla, y el motivo largo está en el encabezado. */
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
  ];
  const ganador = porMotivo.reduce((mejor, actual) => (actual[1] > mejor[1] ? actual : mejor));
  return { candidatos, porqueNinguno: ganador[1] > 0 ? ganador[0] : 'sin_gente' };
}

/**
 * El tope de closers por empresa. **Acá y no en la base**, y eso fue deliberado.
 *
 * Se pidió *«por ahora pongamos hasta un máximo de 3 closers»*, y «por ahora» es la palabra que
 * decide dónde vive el número. Como constante, subirlo es esta línea. Como `check` en la base, es
 * otra migración contra producción para un número que se sabe provisorio.
 */
export const TOPE_DE_CLOSERS = 3;

/** Por qué se rechazó una designación. `null` = se hizo. */
export type PorqueNoSeDesigno = 'tope' | 'crm_ya_vinculado';

/**
 * Designa a un closer, o le cambia el vínculo con el CRM si ya estaba.
 *
 * ── ERA UN REEMPLAZO ATÓMICO Y AHORA ES UN ALTA ────────────────────────────
 *
 * La versión de un solo closer hacía `on conflict (org_id) do update`, y su motivo escrito era
 * bueno: *«no existe el instante con dos designados ni el instante con ninguno»*. Con la clave
 * primaria en `(org_id, usuario_id)` desde la migración 034, ese conflicto ya no ocurre — designar
 * a otro **agrega**, no reemplaza. El `on conflict` que queda es por la clave nueva, y sirve para
 * lo que ahora se necesita: cambiarle el vínculo a quien ya es closer sin borrarlo y volver a
 * crearlo.
 *
 * ── LOS DOS RECHAZOS, Y POR QUÉ SE MIDEN ACÁ Y NO EN LA BASE ───────────────
 *
 *   · `tope` — ya hay `TOPE_DE_CLOSERS`. Se cuenta antes de insertar, dentro de la misma
 *     transacción del inquilino. No es una carrera que importe: dos altas simultáneas que pasen
 *     el conteo dejarían un cuarto closer, y el costo de eso es una fila de más que se puede
 *     borrar desde la misma pantalla. Un `check` en la base para cubrir eso sería una migración
 *     por un número provisorio.
 *   · `crm_ya_vinculado` — ese usuario del CRM ya es de otro. **Eso SÍ lo hace cumplir la base**,
 *     con el índice único parcial de la 034: dos personas vinculadas al mismo usuario partirían
 *     los mismos leads a las dos y nada fallaría. Acá se comprueba antes solo para devolver un
 *     motivo que la pantalla pueda decir, en vez de un `23505` que nombra un índice.
 */
export async function asignarCloser(
  usuarioId: string,
  crmUsuarioId: string | null,
  actor: string,
): Promise<PorqueNoSeDesigno | null> {
  const yaEs = await datos()
    .selectFrom('closer_asignado')
    .select(['usuario_id', 'crm_usuario_id'])
    .execute();

  const esNuevo = !yaEs.some((c) => c.usuario_id === usuarioId);
  if (esNuevo && yaEs.length >= TOPE_DE_CLOSERS) return 'tope';

  /* El vínculo, contra los OTROS. Sin excluirse a sí mismo, volver a guardar a alguien con el
     mismo usuario del CRM que ya tenía se rechazaría — y eso es guardar sin cambiar nada, que
     tiene que poder hacerse. */
  if (
    crmUsuarioId !== null &&
    yaEs.some((c) => c.crm_usuario_id === crmUsuarioId && c.usuario_id !== usuarioId)
  ) {
    return 'crm_ya_vinculado';
  }

  await datos()
    .insertInto('closer_asignado')
    .values({
      usuario_id: usuarioId,
      crm_usuario_id: crmUsuarioId,
      actualizado_el: new Date(),
      actualizado_por: actor,
    } as never)
    .onConflict((oc: any) =>
      oc.columns(['org_id', 'usuario_id']).doUpdateSet({
        crm_usuario_id: crmUsuarioId,
        actualizado_el: new Date(),
        actualizado_por: actor,
      } as never),
    )
    .execute();
  return null;
}

/**
 * Saca a UNA persona de la lista de closers.
 *
 * Antes borraba la fila de la organización sin nombrar a nadie, porque había una sola. Ahora el
 * identificador es obligatorio: sin él, `deleteFrom` sin `where` se lleva **a los tres**, y la
 * política de aislamiento no lo impediría — acota por organización, que es justo lo que este
 * borrado ya tiene.
 */
export async function quitarCloser(usuarioId: string): Promise<void> {
  await datos().deleteFrom('closer_asignado').where('usuario_id', '=', usuarioId).execute();
}
