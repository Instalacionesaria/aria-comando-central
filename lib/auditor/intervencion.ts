// LA COLA ROJA: marcar una intervención, y resolverla.
//
// ═══════════════════════════════════════════════════════════════════════════════
// MARCAR SON DOS ESCRITURAS, Y EL ORDEN NO ES UN DETALLE
//
//     veredicto rojo
//        ├─ 1 · la NOTA en la ficha        «[IA] <el motivo de esta conversación>»
//        └─ 2 · la ETIQUETA en el CRM      → el CRM pausa el agente
//
// **La nota va primero.** Es la etiqueta la que dispara el automatismo del CRM y la que —cuando el
// barrido relee los contactos— mete al contacto en la cola roja. Al revés existiría una ventana en la
// que el vendedor abre la ficha de una urgencia **y no encuentra el motivo adentro**.
//
// Y coincide con la regla que `lib/negocio/avanzar.ts` ya sigue por otro camino: *«primero la base,
// después el CRM»*. Al revés, un fallo de la base dejaría al CRM disparando automatismos por algo que
// acá no existe, y eso no se repara solo.
//
// ── LA NOTA NO ES EL MOTIVO DE LA COLA, Y SON DOS COSAS ────────────────────
//
// La cola roja lee su frase de `analisis_del_agente.motivo`. La nota es otra cosa: queda **en la
// ficha del contacto**, junto a las que escriben las personas, y sobrevive a que el análisis se
// resuelva. Es el rastro de que el agente falló acá, para quien abra esa ficha dentro de un mes.
//
// ═══════════════════════════════════════════════════════════════════════════════
// RESOLVER: «SE HIZO» Y «SALIÓ BIEN» SE REPORTAN SEPARADOS
//
//     1 · los hallazgos abiertos → resueltos     (nuestra base)
//     2 · el análisis            → resuelto      (nuestra base)
//     3 · las tres etiquetas     → quitadas      (el CRM)
//
// Los dos primeros pasos son una transacción. El tercero es otro sistema y **puede fallar**, y cuando
// falla la respuesta NO es un error: la resolución ya ocurrió. Devolver un error haría que el vendedor
// apretara el botón otra vez sobre algo que ya está hecho.
//
// Lo que sí hace falta es decirlo, porque tiene una consecuencia real: **con la etiqueta puesta, el
// CRM mantiene el agente pausado.** Eso es lo que la respuesta separa — `resuelto: true` y
// `etiquetasQuitadas: false` significan «tu parte está hecha, y el bot sigue apagado».
//
// ── «RESUELTO POR UN HUMANO» ≠ «EL PATRÓN ESTÁ ARREGLADO» ──────────────────
//
// Son dos estados distintos y ninguno implica al otro. Un vendedor toma la conversación, la salva, y
// **la falla del agente sigue exactamente donde estaba**: el prompt no cambió. Por eso resolver cierra
// el caso y no toca el patrón, que es lo que la pantalla del técnico mira.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { conOrganizacion, datos } from '../datos/contexto.ts';
import { ponerEtiquetas, quitarEtiquetas } from '../ghl/cliente.ts';
import { FALLOS_DEL_AUDITOR } from '../negocio/colas.ts';
import { sePuedeMandar } from '../ghl/contrato.ts';
import { TERRITORIO_DEL_AGENTE, type Agente } from './veredicto.ts';

/** El prefijo de la nota. **Se ve de un vistazo que no la escribió una persona.** */
export const PREFIJO_DE_LA_NOTA = '[IA]';

/**
 * La etiqueta que se le pone al contacto cuando el auditor pide intervención.
 *
 * ── UNA POR TERRITORIO, Y NO LA LEGADA ─────────────────────────────────────
 *
 * `FALLOS_DEL_AUDITOR` tiene dos por territorio, y la segunda —`bot_pausado_fallo`— es **legado**: era
 * el tag único antes de separarlos, y el contrato dice que *«ya no se aplica, y se sigue leyendo
 * porque quedaron contactos con él puesto»*.
 *
 * Así que se LEEN las dos y se ESCRIBE una: la primera de la lista, que es la específica del
 * territorio. Escribir la legada haría que un contacto marcado hoy fuera indistinguible de uno marcado
 * por la plataforma anterior, y ya no habría forma de saber cuál agente falló.
 */
export function etiquetaQueMarca(agente: Agente): string {
  const [especifica] = FALLOS_DEL_AUDITOR[TERRITORIO_DEL_AGENTE[agente]];
  return especifica as string;
}

/** Qué pasó al marcar. Las dos mitades se reportan por separado. */
export interface LoMarcado {
  /** La nota quedó escrita en la ficha. Es nuestra base: si esto es falso, algo se rompió. */
  nota: boolean;
  /** El CRM aceptó la etiqueta. **`false` no es un error del que marca**: es otro sistema. */
  etiqueta: boolean;
  /** Qué falló en el CRM, cuando falló. */
  porque?: string;
}

/**
 * Marca una intervención: la nota y la etiqueta. **Corre FUERA de un contexto de organización.**
 *
 * @param motivo La frase concreta del veredicto. `null` cuando el modelo pidió intervención y no dejó
 *   una: ahí **no se escribe la nota**, porque una nota que dice «[IA]» y nada más es peor que ninguna
 *   — ocupa el lugar del motivo en la ficha y no dice nada.
 */
export async function marcarLaIntervencion(o: {
  orgId: string;
  contactoId: string;
  ghlContactId: string;
  agente: Agente;
  motivo: string | null;
  acceso: { token: string };
}): Promise<LoMarcado> {
  // ── 1 · LA NOTA, PRIMERO Y EN NUESTRA BASE ────────────────────────────────
  let nota = false;
  if (o.motivo !== null && o.motivo.trim() !== '') {
    await conOrganizacion(o.orgId, async () => {
      await datos()
        .insertInto('notas')
        .values({
          contacto_id: o.contactoId,
          cuerpo: `${PREFIJO_DE_LA_NOTA} ${o.motivo?.trim()}`,
          /* Sin autor **y** con origen `auditor`. Los dos juntos: el nulo solo no alcanza —significa
             «importada del CRM»— y el origen es lo que hace que ese nulo no mienta. Ver la 031. */
          autor_id: null,
          origen: 'auditor',
        } as never)
        .execute();
    });
    nota = true;
  }

  // ── 2 · LA ETIQUETA, DESPUÉS Y EN EL CRM ──────────────────────────────────
  const etiqueta = etiquetaQueMarca(o.agente);
  /* `sePuedeMandar` va ANTES de llamar, no adentro del cliente: una etiqueta que no existe en la
     subcuenta se acepta con un 200 y no hace nada, que el contrato llama el defecto más caro de su
     lista *«porque es invisible»*. Acá no puede pasar —las dos están confirmadas— y la comprobación
     está igual, porque el día que alguien cambie `FALLOS_DEL_AUDITOR` esto es lo que lo frena. */
  if (!sePuedeMandar(etiqueta)) {
    return { nota, etiqueta: false, porque: 'la etiqueta no está confirmada en el contrato' };
  }

  const r = await ponerEtiquetas(o.acceso, o.ghlContactId, [etiqueta]);
  if (r.tipo !== 'datos') return { nota, etiqueta: false, porque: r.fallo.tipo };
  return { nota, etiqueta: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESOLVER
// ═══════════════════════════════════════════════════════════════════════════════

/** Qué pasó al resolver. **`resuelto` y `etiquetasQuitadas` son dos hechos distintos.** */
export interface LoResuelto {
  /** Se cerró en nuestra base. `false` = no había nada abierto que cerrar. */
  resuelto: boolean;
  /** Cuántas intervenciones se cerraron. Normalmente una. */
  intervenciones: number;
  /** Cuántos hallazgos se cerraron. Puede ser cero: un rojo no siempre trae hallazgos. */
  hallazgos: number;
  /** El CRM aceptó el borrado. **`false` NO es un error de la resolución.** */
  etiquetasQuitadas: boolean;
  /** Qué falló en el CRM, cuando falló. */
  porque?: string;
}

/**
 * Resuelve la intervención de un contacto. **Corre FUERA de un contexto de organización.**
 *
 * ── LOS DOS PASOS DE LA BASE VAN EN UNA TRANSACCIÓN, Y EL CRM DESPUÉS ──────
 *
 * Al revés —el CRM primero— un fallo de la base dejaría al contacto sin etiqueta en el CRM y con la
 * intervención abierta acá: el agente vuelve a atender **y la cola sigue pidiendo que alguien lo
 * tome**. Los dos estados que no queremos, a la vez.
 *
 * Y las tres etiquetas se quitan juntas, no solo la del territorio: `FALLOS_DEL_AUDITOR` es la lista
 * de lo que mete a un contacto en la cola, y dejar una puesta lo deja adentro. **La lista de las que
 * se quitan es la MISMA que la de las que hacen entrar**, y por eso sale de ahí y no se escribe acá.
 */
/**
 * La escritura al CRM, **inyectable**. Es la firma de `quitarEtiquetas`.
 *
 * ── POR QUÉ ESTA COSTURA, Y QUÉ NO SE PODÍA COMPROBAR SIN ELLA ────────────
 *
 * **Qué etiquetas se piden borrar.** Sin la costura, una prueba solo puede ver que el CRM rechazó —
 * el token de una prueba siempre es falso— y eso es cierto tanto si se mandó la lista completa como
 * si se mandó una sola.
 *
 * Y ahí está el defecto que no se ve: **una etiqueta de menos no se nota**. Quitando solo la del
 * closer, un contacto del setter sale de nuestra cola —la resolución es nuestra— y en el CRM se
 * queda con `bot_desactivado_leadflow` puesta **para siempre**, o sea con su agente pausado y sin
 * nadie que vuelva a mirarlo. Una mutación que borraba media lista sobrevivía a todo el archivo.
 */
export type QuitarEtiquetas = typeof quitarEtiquetas;

export async function resolverLaIntervencion(
  o: {
    orgId: string;
    contactoId: string;
    ghlContactId: string;
    quien: string;
    acceso: { token: string };
  },
  quitar: QuitarEtiquetas = quitarEtiquetas,
): Promise<LoResuelto> {
  const cerrado = await conOrganizacion(o.orgId, async () => {
    const a = await datos()
      .updateTable('analisis_del_agente')
      .set({ resuelto_el: sql`now()`, resuelto_por: o.quien } as never)
      .where('contacto_id', '=', o.contactoId)
      .where('intervencion', '=', true)
      .where('resuelto_el', 'is', null)
      .executeTakeFirst();

    const h = await datos()
      .updateTable('hallazgos')
      .set({ resuelto_el: sql`now()`, resuelto_por: o.quien } as never)
      .where('contacto_id', '=', o.contactoId)
      .where('resuelto_el', 'is', null)
      .executeTakeFirst();

    return {
      intervenciones: Number(a.numUpdatedRows ?? 0),
      hallazgos: Number(h.numUpdatedRows ?? 0),
    };
  });

  /* ── LAS ETIQUETAS SE QUITAN AUNQUE NO HUBIERA NADA QUE CERRAR ────────────
   *
   * Es el caso que la cola roja hace posible: un contacto con la etiqueta puesta **sin análisis
   * nuestro** —lo marcó la plataforma anterior, o el CRM— entra igual a la cola con el texto de
   * reserva. Ése es justo el que necesita que el botón funcione, y con la condición al revés sería el
   * único al que no le hace nada. */
  const todas = FALLOS_DEL_AUDITOR.closer
    .concat(FALLOS_DEL_AUDITOR.setter)
    .filter((e, i, l) => l.indexOf(e) === i)
    .filter(sePuedeMandar);

  const r = await quitar(o.acceso, o.ghlContactId, todas);
  const resuelto = cerrado.intervenciones > 0 || cerrado.hallazgos > 0;

  if (r.tipo !== 'datos') {
    return { resuelto, ...cerrado, etiquetasQuitadas: false, porque: r.fallo.tipo };
  }
  return { resuelto, ...cerrado, etiquetasQuitadas: true };
}
