// Avanzar: el ÚNICO lugar donde se registra un resultado.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ES EL ÚNICO, Y QUÉ SE ROMPE SI DEJA DE SERLO
//
// De acá salen tres cosas que hoy están en cero o vacías:
//
//   · los números de Inicio —cobrado, ventas, acuerdos— que hoy dicen `—`;
//   · las siete columnas del Pipeline, porque la etapa la escribe esto;
//   · la píldora de cada fila, que es *"un hecho, no una inferencia"*, justamente porque la
//     registró una persona.
//
// Con dos caminos que escriban resultados, los tres divergen sin que nada falle. El `04` § 4 ya
// pagó esa factura con las notas: *"la nota se escribía en otra tabla según por qué camino se
// registrara, así que aparecía en un lado y no en el otro"*, y de trece resultados con nota solo
// dos llegaron a la tabla.
//
// ── LO QUE ESTA FUNCIÓN GARANTIZA, Y LO QUE NO PUEDE ────────────────────────
//
// **Garantiza** que el resultado, la etapa, la nota y la tarea de seguimiento entran juntos o no
// entran: una transacción, un dominio, una base. Ésa es la parte que se puede hacer atómica.
//
// **No puede** garantizar que la etiqueta llegue al CRM, porque eso es otro sistema. Así que el
// orden es deliberado: **primero la base, después el CRM**, y la respuesta dice si la segunda
// mitad salió. Al revés —etiqueta primero— un fallo de la base dejaría al CRM disparando
// automatismos por un resultado que acá no existe, y eso no se repara solo.
// ═══════════════════════════════════════════════════════════════════════════════

import { datos } from '../datos/contexto.ts';
import type { SalidaResultado, Territorio } from '../datos/esquema.ts';
import { ETAPA_DE_LA_SALIDA } from './etapas.ts';
import type { SalidaDelCloser } from './salidas.ts';

export interface LoQueSeRegistra {
  salida: SalidaDelCloser;
  rol: Territorio;
  /** La subcategoría. `null` cuando la salida no tiene, o cuando no se eligió ninguna. */
  detalle: string | null;
  /** Solo en una venta. Es la subcategoría de esa salida y tiene su propia columna. */
  formaPago: string | null;
  /** `null` cuando la salida no pide monto. **Nunca cero**: cero es un monto medido. */
  monto: string | null;
  /** La nota, opcional. Va a `negocio.notas`, la MISMA tabla que la pestaña Notas. */
  nota: string | null;
  /**
   * El seguimiento, opcional: cuándo volver. **Un DÍA en `YYYY-MM-DD`, no un instante.**
   *
   * ── POR QUÉ TEXTO Y NO `Date`, Y SE APRENDIÓ FALLANDO ─────────────────────
   *
   * `tareas.vence_el` es una columna `date`. Pasando un `Date`, el controlador manda un instante
   * con zona y **PostgreSQL lo convierte a día usando la zona del servidor**: medido, un
   * `2026-12-01T12:00:00Z` volvió como `2026-12-01T05:00:00Z`, y con una hora cercana a la
   * medianoche el día habría cambiado directamente. Una tarea que aparece vencida el día que se
   * creó, y nada falla.
   *
   * Con el día como texto no hay ninguna zona en el camino: `'2026-12-01'` es el 1 de diciembre en
   * cualquier lado. Es lo que el comentario de la columna ya pedía — *"vence UN DÍA, no a una hora:
   * la frontera la calcula la consulta con la zona"*.
   */
  volverEl: string | null;
  quien: string;
}

export interface Registrado {
  resultadoId: string;
  etapa: string;
  /** `true` = se guardó la nota. `false` = se pidió y NO se pudo. Ver abajo. */
  nota: boolean;
  tarea: boolean;
  /**
   * Cuántos seguimientos abiertos de este contacto se cerraron con este resultado.
   *
   * Casi siempre 0 o 1. Puede ser más si alguien registró dos fechas sin cerrar la primera, que era
   * lo único que se podía hacer antes de que esta columna tuviera un escritor.
   */
  seguimientosCerrados: number;
}

/**
 * Registra el resultado. **Corre dentro de `conOrganizacion(` y de UNA transacción.**
 *
 * ── LAS CUATRO ESCRITURAS VAN JUNTAS, Y NO ES COMODIDAD ─────────────────────
 *
 * El resultado, la etapa, la nota y la tarea describen **un solo hecho**: cómo terminó esta
 * conversación. Sueltas, la que falle deja las otras tres afirmando algo incompleto — y el caso
 * concreto está documentado: *"una nota que no se guardó y una operación que responde éxito es
 * exactamente un éxito que no ocurrió"*.
 *
 * Kysely corre esto dentro de la transacción que `conOrganizacion(` abre, así que una excepción en
 * cualquiera de las cuatro revierte las anteriores. Es lo que hace que `nota: true` en la respuesta
 * sea verdad y no una intención.
 */
export async function registrarResultado(
  contactoId: string,
  lo: LoQueSeRegistra,
): Promise<Registrado> {
  const etapa = ETAPA_DE_LA_SALIDA[lo.salida as SalidaResultado];

  const resultado = await datos()
    .insertInto('resultados')
    .values({
      contacto_id: contactoId,
      salida: lo.salida,
      rol: lo.rol,
      monto: lo.monto,
      forma_pago: lo.formaPago,
      detalle: lo.detalle,
      // La nota se guarda TAMBIÉN acá, junto al resultado, además de en `notas`. No es
      // duplicación por descuido: `resultados.nota` es lo que se dijo AL registrar este
      // resultado y viaja con él para siempre; `notas` es el hilo del contacto, donde la
      // persona la va a buscar. Borrar una de `notas` no debe cambiar lo que se registró.
      nota: lo.nota,
      registrado_por: lo.quien,
    } as never)
    .returning('id')
    .executeTakeFirstOrThrow();

  // ── LA ETAPA, que es lo que mueve el Pipeline ─────────────────────────────
  //
  // Se escribe en NUESTRA base y no se espera nada del CRM: `lib/negocio/etapas.ts` explica por
  // qué la fuente de verdad es ésta. Sin esta línea el resultado quedaría registrado y el
  // contacto seguiría en la misma columna — el defecto sería «registré y no se movió».
  await datos()
    .updateTable('contactos')
    .set({ etapa } as never)
    .where('id', '=', contactoId)
    .execute();

  let nota = false;
  if (lo.nota !== null) {
    await datos()
      .insertInto('notas')
      .values({
        contacto_id: contactoId,
        cuerpo: lo.nota,
        // QUIÉN la escribió. `null` en esta columna significa «la importó el sistema», así que
        // dejarla vacía haría pasar la nota de una persona por una importación.
        autor_id: lo.quien,
        origen: 'plataforma',
      } as never)
      .execute();
    nota = true;
  }

  /* ── CERRAR LOS SEGUIMIENTOS ABIERTOS, Y ESTE ES SU PRIMER ESCRITOR ────────
   *
   * `negocio.tareas.completada_el` existía desde la migración 011, con su índice parcial
   * `tareas_completadas_hoy` y un comentario largo que la justifica, y **no la escribía nadie**. Dos
   * consultas la leían; cero la escribían.
   *
   * Consecuencia, que no da ningún error: un seguimiento creado acá no se podía cerrar NUNCA. Se
   * quedaba en la cola de Mi Día para siempre y mantenía el ícono ⏱ encendido para siempre. El
   * índice parcial no indexaba jamás ninguna fila.
   *
   * ── POR QUÉ LO CIERRA AVANZAR, Y NO RESPONDER UN MENSAJE ──────────────────
   *
   * Un seguimiento manual dice «volvé a esta persona el día X». Registrar un resultado es la prueba
   * de que se volvió y de que la conversación llegó a alguna parte — es literalmente la acción que
   * el seguimiento pedía. Responder un mensaje es más débil: se puede estar contestando otra cosa,
   * y cerrar el recordatorio por eso lo haría desaparecer sin que nadie decidiera nada.
   *
   * ── Y VA ANTES DEL `insert`, QUE NO ES INDIFERENTE ────────────────────────
   *
   * Si fuera después, un Avanzar con fecha nueva cerraría **la tarea que acaba de crear**: el
   * `update` no tiene forma de distinguirla de las viejas, porque las dos están abiertas. El
   * síntoma sería «puse una fecha y el seguimiento no aparece», sin ningún error.
   *
   * Va en la MISMA transacción que el resto: o se registra el resultado y se cierra el seguimiento,
   * o no pasa ninguna de las dos. */
  const cerradas = await datos()
    .updateTable('tareas')
    .set({ completada_el: new Date() } as never)
    .where('contacto_id', '=', contactoId)
    .where('completada_el', 'is', null)
    .executeTakeFirst();

  let tarea = false;
  if (lo.volverEl !== null) {
    await datos()
      .insertInto('tareas')
      .values({
        // El día tal cual, sin convertir. Ver `volverEl` arriba.
        vence_el: lo.volverEl,
        contacto_id: contactoId,
        situacion: 'seguimiento',
        // `manual` y no `automatico`: la creó una persona eligiendo una fecha. De esa distinción
        // depende el contador de Mi Día, que *"cuenta lo que necesita una persona, no las series
        // automáticas"*.
        modo: 'manual',
        nota: lo.nota,
        creada_por: lo.quien,
      } as never)
      .execute();
    tarea = true;
  }

  /* `cerradas` viaja en la respuesta por la misma regla que `nota` y `tarea`: **la respuesta cuenta
     efecto por efecto**. Cerrar un recordatorio de otra persona es un efecto visible — desaparece de
     su Mi Día — y colapsarlo en un «listo» es esconder lo que pasó. */
  return {
    resultadoId: resultado.id,
    etapa,
    nota,
    tarea,
    seguimientosCerrados: Number(cerradas?.numUpdatedRows ?? 0),
  };
}
