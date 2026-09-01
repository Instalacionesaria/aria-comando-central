// Traer los contactos de GoHighLevel a `negocio.contactos`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS DOS ETIQUETAS, Y POR QUÉ EL CLOSER GANA
//
// Se pidió así: *"los que tengan zona closer se van para el closer, y los contactos que tengan
// la etiqueta de zona setter se van para el setter"*.
//
// Un contacto puede tener LAS DOS. Pasa de forma normal: el workflow WF 04.1 de GoHighLevel
// cambia la zona al agendar, y según cómo esté armado puede sumar la nueva sin sacar la vieja.
// Con las dos etiquetas hay que elegir, y **gana el closer**: un contacto que ya llegó a la
// agenda del closer no vuelve a la bandeja del setter. Que aparezca en las dos listas sería
// peor que elegir mal — dos personas trabajando el mismo lead sin saberlo, y atender una no
// cierra la otra.
//
// ── LO QUE NO SE INVENTA ────────────────────────────────────────────────────
//
// GoHighLevel **no documenta** una fecha de última actividad entrante ni saliente por contacto.
// Lo más cercano es `lastActivity`, que no distingue dirección, y los filtros de dirección
// están en `conversations/search` —otra versión de cabecera— cuyo esquema de respuesta
// documentado ni siquiera lista esos campos.
//
// Así que `ultimo_entrante_el`, `ultimo_entrante_texto` y `ultimo_saliente_el` **quedan nulos**.
// La consecuencia es visible y es correcta: la fila no muestra microtexto de actividad. Poner
// `dateAdded` ahí sería más fácil y diría "respondió hace 3 días" de alguien que nunca escribió.
//
// Lo mismo con `etapa` (GHL no expone un campo de etapa: la mueve un workflow) y `score` (nada lo
// calcula). Lo de `responsable_id` **dejó de ser cierto** y su lugar lo ocupa `crm_asignado_a`,
// que se explica abajo, en el `on conflict`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// TRAER NO ALCANZA: HAY QUE MIRAR LO QUE **YA NO** VINO
//
// La búsqueda es POR ETIQUETA. Un contacto que gana `zona_closer` aparece en la respuesta y se
// escribe; uno que pasa de setter a closer aparece en la otra etiqueta y se mueve. Los dos casos
// funcionaban.
//
// El que no: **el contacto que pierde las dos etiquetas**. Deja de aparecer en cualquier búsqueda,
// así que nadie vuelve a leerlo y su fila se queda con el territorio viejo **para siempre**. El
// estado «congelado» que este archivo describe —*«sigue visible y atenuado, no se borra, no entra
// a las colas»*— existía para exactamente eso y **no se alcanzaba nunca**, porque para congelarlo
// había que volver a mirarlo.
//
// Medido en producción el 2026-09-01: nuestra base tenía **157** contactos con `territorio =
// 'closer'` y GoHighLevel devolvía **152** con la etiqueta. Los cinco de más existen en el CRM y ya
// no la tienen. Cinco leads en el Pipeline de un closer que el CRM ya sacó de su zona.
//
// ── LA CORRECCIÓN NO CUESTA NI UNA LLAMADA MÁS ─────────────────────────────
//
// Y ésa era la condición: *«no haciendo más llamadas sino aprovechando las que ya hacemos»*.
//
// El bucle de abajo ya construye `vistos` —el conjunto de identificadores que HOY tienen alguna
// etiqueta de zona— porque lo necesita para que el closer gane sobre el setter. Ese conjunto es,
// sin pedir nada más, **la lista completa de quién sigue estando**. Lo que falta es la resta: todo
// lo que tenemos con territorio y no está ahí, lo perdió.
//
// Es una sentencia `update` sobre nuestra propia base. Cero peticiones a GoHighLevel.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import type { Territorio } from '../datos/esquema.ts';
import {
  contactoPorId,
  etiquetasDeLaSubcuenta,
  nombreDe,
  todosLosContactosPorEtiqueta,
  type ContactoDeGhl,
  type FalloDeGhl,
} from '../ghl/cliente.ts';

/**
 * Las etiquetas de GoHighLevel, y a qué territorio corresponde cada una.
 *
 * El orden ES la precedencia: el primero que coincida gana. Ver el encabezado.
 */
export const ETIQUETAS: readonly { etiqueta: string; territorio: Territorio }[] = [
  { etiqueta: 'zona_closer', territorio: 'closer' },
  { etiqueta: 'zona_setter', territorio: 'setter' },
];

/** Lo que pasó en una sincronización. */
export interface Resumen {
  /** Cuántos contactos trajo GoHighLevel, por etiqueta. */
  traidos: Record<string, number>;
  /** Cuántas filas quedaron escritas, por territorio. */
  guardados: Record<Territorio, number>;
  /**
   * Los que NO se guardaron, con el motivo. **Se informan uno por uno.**
   *
   * Un contacto salteado en silencio es la peor forma de esto: la lista queda corta, se ve
   * completa, y el síntoma que llega es "faltan contactos" sin nada que mirar.
   */
  salteados: { id: string; porque: string }[];
  /** `true` si se llegó al tope de páginas sin agotar una etiqueta. Ver `TOPE_DE_PAGINAS`. */
  truncado: boolean;
  /**
   * Cuántos contactos se CONGELARON: tenían territorio y ya no traen ninguna etiqueta de zona.
   *
   * Se informa como los salteados y por el mismo motivo: un contacto que sale de las colas en
   * silencio es indistinguible de uno que nunca estuvo. El closer ve bajar su cartera y no tiene
   * dónde mirar por qué.
   *
   * `null` = **no se pudo conciliar**, que no es lo mismo que cero. Pasa cuando la traída quedó
   * truncada o cuando no vino ningún contacto: en los dos casos `vistos` está incompleto, y una
   * resta contra un conjunto incompleto congelaría contactos que sí tienen la etiqueta. Ver
   * `congelarLosQueYaNoEstan`.
   */
  congelados: number | null;
  /**
   * Cuántas llamadas a GoHighLevel costó esta corrida.
   *
   * Se agregó cuando esta función pasó a correr desde el cron: el reporte del barrido informa las
   * llamadas por empresa y por tarea, y es la columna con la que se mira si el trabajo automático se
   * está comiendo el presupuesto del proveedor.
   *
   * Es una por página de cada etiqueta, más la consulta de etiquetas de la cuenta cuando se hace.
   */
  llamadas: number;
  /**
   * Las etiquetas que EXISTEN en la subcuenta. Solo se consulta cuando no vino ningún
   * contacto, que es cuando sirve para algo.
   *
   * `null` = no se preguntó, o no se pudo (el token puede no tener `locations/tags.readonly`,
   * que es un alcance distinto del que usa la búsqueda). `[]` = la subcuenta no tiene ninguna
   * etiqueta. Los dos NO son lo mismo: uno manda a revisar el token y el otro las etiquetas.
   */
  etiquetasDeLaCuenta: string[] | null;
}

export type ResultadoDeSincronizar =
  | { tipo: 'listo'; resumen: Resumen }
  | { tipo: 'fallo'; fallo: FalloDeGhl };

/**
 * Trae los contactos de las dos etiquetas y los deja en `negocio.contactos`.
 *
 * ── SE CORRE DENTRO DE `conOrganizacion(` ───────────────────────────────────
 *
 * No recibe `orgId` y no lo escribe: lo inyecta la capa fina, y la política de fila hace el
 * resto. Este archivo no nombra `org_id` ni una vez, que es la propiedad que se busca — un
 * `org_id` escrito a mano acá sería un lugar más donde equivocarse.
 */
export async function sincronizarContactos(acceso: {
  token: string;
  locationId: string;
}): Promise<ResultadoDeSincronizar> {
  const resumen: Resumen = {
    traidos: {},
    guardados: { closer: 0, setter: 0 },
    salteados: [],
    truncado: false,
    congelados: null,
    llamadas: 0,
    etiquetasDeLaCuenta: null,
  };

  // Se recorren las etiquetas en orden de precedencia y se queda el PRIMER territorio que le
  // toque a cada contacto. `vistos` es lo que hace que el closer gane sobre el setter.
  const vistos = new Set<string>();

  for (const { etiqueta, territorio } of ETIQUETAS) {
    const r = await todosLosContactosPorEtiqueta(acceso, etiqueta);
    if (r.tipo === 'fallo') return r;

    resumen.traidos[etiqueta] = r.datos.contactos.length;
    resumen.llamadas += r.datos.paginas;
    if (r.datos.truncado) resumen.truncado = true;

    for (const c of r.datos.contactos) {
      if (vistos.has(c.id)) continue;
      vistos.add(c.id);

      const guardado = await guardar(c, territorio);
      if (guardado === true) resumen.guardados[territorio] += 1;
      else resumen.salteados.push({ id: c.id, porque: guardado });
    }
  }

  /* ── LA RESTA, QUE ES LA MITAD QUE FALTABA ────────────────────────────────
   *
   * `vistos` ya está armado y no costó nada: es el mismo conjunto que hizo que el closer ganara
   * sobre el setter. Acá se usa para lo otro que sabe decir — quién sigue estando— y de ahí sale
   * quién no.
   *
   * Va DESPUÉS del bucle entero y no dentro de cada etiqueta: un contacto que perdió `zona_setter`
   * pero tiene `zona_closer` aparece en la segunda vuelta, y congelarlo al terminar la primera lo
   * sacaría de las colas hasta la sincronización siguiente. */
  resumen.congelados = await congelarLosQueYaNoEstan(vistos, resumen.truncado);

  // Si no vino NI UN contacto, la pregunta siguiente siempre es la misma: ¿estarán mal los
  // nombres de las etiquetas? Se contesta antes de que alguien la haga.
  //
  // Solo en ese caso: cuando vinieron contactos, el catálogo no aporta nada y sería una
  // llamada más contra el límite de tasa de GoHighLevel.
  const vinoAlgo = Object.values(resumen.traidos).some((n) => n > 0);
  if (!vinoAlgo) {
    resumen.etiquetasDeLaCuenta = await etiquetasDeLaSubcuenta(acceso);
  }

  return { tipo: 'listo', resumen };
}

/**
 * Congela los contactos que YA NO traen ninguna etiqueta de zona. **Cero llamadas al CRM.**
 *
 * @param vistos  Los identificadores de GoHighLevel que la búsqueda devolvió en esta corrida.
 * @param truncado `true` si alguna etiqueta se cortó por el tope de páginas.
 * @returns Cuántos se congelaron, o `null` si no se pudo conciliar.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LAS DOS GUARDAS, Y SIN ELLAS ESTO BORRA EL TRABAJO DE TODOS
 *
 * Esta función afirma algo muy fuerte: *«todo lo que no vino, ya no está»*. Es cierto **solo si la
 * traída fue completa**, y hay dos formas de que no lo sea. En las dos, correr la resta igual
 * dejaría a la empresa entera sin territorios — la lista de trabajo de todos, vacía, sin un solo
 * error en ninguna parte.
 *
 *   1 · **Truncado.** `todosLosContactosPorEtiqueta` corta a las 100 páginas y lo informa. Con la
 *       lista cortada, los que no entraron se ven exactamente igual que los que perdieron la
 *       etiqueta.
 *   2 · **Ningún contacto.** `vistos` vacío no significa «la empresa no tiene contactos»: también
 *       es lo que devuelve una etiqueta mal escrita o una subcuenta recién conectada. Restar
 *       contra el conjunto vacío congela TODO.
 *
 * En los dos casos se devuelve `null` —«no se pudo conciliar»— y no `0`. Un cero afirmaría que se
 * miró y no había ninguno que congelar, que es la clase de cero que este proyecto persigue en
 * todas partes.
 *
 * ── POR QUÉ CONGELAR Y NO BORRAR ──────────────────────────────────────────
 *
 * Lo dice el `01` § 2 y este archivo lo repite: el congelado *«sigue visible y atenuado, sigue
 * siendo movible, no se borra»*. Un contacto que sale de una zona no deja de haber existido —
 * tiene mensajes, resultados, quizá una comisión— y borrarlo se llevaría todo eso. Y se descongela
 * solo: si la etiqueta reaparece, la búsqueda lo devuelve y `guardar` le repone el territorio.
 *
 * ── LO QUE NO SE TOCA ─────────────────────────────────────────────────────
 *
 * Solo `territorio`. Ni las etiquetas —que son la última foto real que tuvimos y sirven para
 * diagnosticar por qué cayó donde cayó— ni `crm_asignado_a`, ni nada nuestro. Congelar es un
 * hecho sobre la ZONA, no sobre el contacto.
 *
 * Y no lleva `org_id`: la política de fila lo pone con lo que `conOrganizacion(` dejó en la
 * transacción. Este archivo no lo nombra ni una vez, que es la propiedad que se busca.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export async function congelarLosQueYaNoEstan(
  vistos: ReadonlySet<string>,
  truncado: boolean,
): Promise<number | null> {
  if (truncado || vistos.size === 0) return null;

  const r = await datos()
    .updateTable('contactos')
    .set({ territorio: null } as never)
    // Solo los que HOY tienen territorio. Sin esto, cada corrida reescribiría las filas ya
    // congeladas: el mismo resultado, y un contador que dice que congeló doscientos cada vez.
    .where('territorio', 'is not', null)
    .where('ghl_contact_id', 'not in', [...vistos])
    .executeTakeFirst();

  return Number(r?.numUpdatedRows ?? 0);
}

/**
 * Guarda un contacto. Devuelve `true`, o el motivo por el que se salteó.
 *
 * ── EL `on conflict` ES POR `(org_id, ghl_contact_id)` ──────────────────────
 *
 * Que es único POR ORGANIZACIÓN y no globalmente, y eso es lo que hace que traer de nuevo sea
 * idempotente entre inquilinos. Con un único global, el `insert` de una organización chocaría
 * con la fila INVISIBLE de otra y devolvería `23505` en vez de escribir — un error que además
 * confirma que ese contacto existe en otro cliente.
 *
 * ── Y LO QUE EL `do update` NO PISA ─────────────────────────────────────────
 *
 * `sello_setter_id`, `sello_setter_el`, `etapa`, `score` y `responsable_id` no están en el
 * `set`. Son datos NUESTROS, no de GoHighLevel: pisarlos en cada sincronización borraría la
 * atribución del setter y el trabajo hecho acá. El sello además tiene un disparador que lo
 * protege, así que esto es el cinturón además del tirante.
 *
 * ── Y `crm_asignado_a` SÍ ESTÁ, QUE ES LA OTRA MITAD DE LA MISMA REGLA ─────
 *
 * Es un hecho de GoHighLevel, no nuestro. Si allá reasignan un contacto a otro closer, acá
 * tiene que moverse — y si quedara fuera del `set`, el primer valor sería el definitivo: el
 * lead se quedaría para siempre con el closer que lo tuvo el día que se sincronizó por primera
 * vez, y ninguna reasignación en el CRM tendría efecto. Nada fallaría.
 *
 * La regla completa, entonces: **lo que decide GoHighLevel se pisa; lo que decidimos acá, no.**
 */
async function guardar(
  c: ContactoDeGhl,
  /**
   * `null` = **congelado**: el contacto no esta en ningun territorio.
   *
   * El `01` seccion 2 lo define asi y aclara que le pasa: sigue visible y atenuado, sigue siendo
   * movible, **no se borra**, y no entra a las colas de trabajo. Y se descongela solo si una
   * etiqueta de territorio reaparece.
   *
   * La definicion importa: la primera version de esa regla decia «perdio `zona_closer`», y con eso
   * **todo contacto del setter nacia congelado** -- nunca tuvo `zona_closer`, la gana recien al
   * agendar. El modulo del setter habria quedado inerte sin que nada fallara.
   */
  territorio: Territorio | null,
): Promise<true | string> {
  const nombre = nombreDe(c);
  // La columna `nombre` es obligatoria. Un contacto sin nombre se saltea CON MOTIVO en vez de
  // entrar como "Sin nombre", que después se lee como si fuera su nombre.
  if (!nombre) return 'el contacto no trae ningún nombre';
  if (!c.id) return 'el contacto no trae identificador';

  const valores = {
    ghl_contact_id: c.id,
    nombre,
    telefono: c.phone ?? null,
    email: c.email ?? null,
    // Las etiquetas completas, tal como vienen. Sirven para diagnosticar por qué un contacto
    // cayó donde cayó, que es la primera pregunta cuando alguien dice "éste no va acá".
    etiquetas: c.tags ?? [],
    territorio,
    // `source` es texto libre que pone quien creó el contacto. Cuando no viene se deja que la
    // base ponga su valor de reserva: el `11` § 7.1 exige que ninguna fila quede sin chip de
    // fuente, y la reserva vive en la base para que no dependa de este archivo.
    ...(c.source ? { fuente: c.source } : {}),
    /* A quién lo tiene asignado el CRM. Crudo, sin resolver a nuestro usuario: el motivo está
       en `db/migraciones/034_varios_closers.sql` y en el tipo. `null` cuando no viene, que son
       17 de los 152 medidos y no es un error. */
    crm_asignado_a: c.assignedTo ?? null,
    sincronizado_el: sql<Date>`now()`,
  };

  await datos()
    .insertInto('contactos')
    .values(valores as never)
    .onConflict((oc) =>
      // Por las DOS columnas, que es como está declarado el único. Nombrar solo
      // `ghl_contact_id` haría que PostgreSQL no encontrara el índice y el `insert` fallara
      // con `42P10` — un error de forma, no de datos, y por eso fácil de no ver hasta que se
      // corre contra una base real.
      oc.columns(['org_id', 'ghl_contact_id']).doUpdateSet({
        nombre: valores.nombre,
        telefono: valores.telefono,
        email: valores.email,
        etiquetas: valores.etiquetas,
        territorio: valores.territorio,
        crm_asignado_a: valores.crm_asignado_a,
        ...(c.source ? { fuente: c.source } : {}),
        sincronizado_el: valores.sincronizado_el,
      } as never),
    )
    .execute();

  return true;
}

/**
 * Refrescar UN contacto contra el CRM. Es la llamada que cuesta abrir la ficha.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL TERRITORIO SE RECALCULA, Y ES LA MITAD IMPORTANTE
 *
 * El refresco no es solo «traer el nombre nuevo»: **relee las etiquetas**, y de ellas dependen el
 * estado del agente, la cita agendada y el seguimiento automático — tres de los seis íconos.
 *
 * Y con las etiquetas viene el territorio. Un contacto que agendó pierde `zona_setter` y gana
 * `zona_closer`: es **el mismo contacto cambiando de dueño, sin resetear ningún dato**. Su
 * historial, sus notas y sus llamadas siguen ahí porque el `do update` de `guardar` no los toca.
 *
 * Si no tiene ninguna de las dos queda **congelado**, con `territorio` nulo — que es lo que el
 * `01` § 2 pide: se ve, se mueve, no cuesta llamadas, y se descongela solo cuando la etiqueta
 * reaparece.
 *
 * ── UN CONTACTO BORRADO EN EL CRM NO SE BORRA ACÁ ───────────────────────────
 *
 * `contactoPorId` devuelve `datos: null` para un 404, y acá eso se traduce a `no_esta_en_el_crm`
 * **sin tocar la fila**. Borrarla arrastraría en cascada sus mensajes, sus notas y sus resultados —
 * el historial de un trabajo que sí ocurrió. La ficha lo dice y nadie pierde nada.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export type ResultadoDeRefresco =
  | { tipo: 'listo'; territorio: Territorio | null }
  | { tipo: 'no_esta_en_el_crm' }
  | { tipo: 'salteado'; motivo: string }
  | { tipo: 'fallo'; fallo: FalloDeGhl };

export async function refrescarUnContacto(
  acceso: { token: string; locationId: string },
  ghlContactId: string,
): Promise<ResultadoDeRefresco> {
  const r = await contactoPorId(acceso, ghlContactId);
  if (r.tipo === 'fallo') return { tipo: 'fallo', fallo: r.fallo };
  if (!r.datos) return { tipo: 'no_esta_en_el_crm' };

  // El territorio, con la MISMA precedencia que la sincronización completa: el orden de `ETIQUETAS`
  // es el orden de prioridad y el closer gana. Se recorre esa lista y no se escribe otra
  // comparación — dos lugares que decidan el territorio es un lugar donde divergir, y el síntoma
  // sería un contacto que aparece en las dos pestañas o en ninguna.
  const etiquetas = r.datos.tags ?? [];
  const territorio = ETIQUETAS.find((e) => etiquetas.includes(e.etiqueta))?.territorio ?? null;

  const guardado = await guardar(r.datos, territorio);
  if (guardado !== true) return { tipo: 'salteado', motivo: guardado };
  return { tipo: 'listo', territorio };
}
