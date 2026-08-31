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
import { etapaDeLaSalida } from './etapas.ts';
import { modoDe } from './salidas.ts';
import { sellarSiEsDelSetter } from './sello.ts';
import type { ParDeResultado } from './salidas.ts';

/**
 * ── EL PAR (rol, salida) ES CORRECTO POR CONSTRUCCIÓN ───────────────────────
 *
 * Es una unión discriminada por `rol` y no dos campos sueltos, así que
 * `{ rol: 'closer', salida: 'agendo' }` **no compila**. Con dos campos independientes ese par
 * pasaría el compilador y llegaría a escribir una fila con el rol de un negocio y la salida del
 * otro — que después alimenta la comisión equivocada, con un número igual de plausible.
 *
 * Lo demás es común a los dos y por eso está aparte: son las mismas cuatro escrituras.
 */
export interface LoQueSeRegistra extends LoComunDeUnResultado {
  /**
   * El par (territorio, salida), ANIDADO y no como dos campos al mismo nivel.
   *
   * TypeScript **ensancha el esparcido de una unión**: con `rol` y `salida` sueltos, un
   * `{ ...par, ...resto }` en cualquier llamador devuelve el par ensanchado y la garantía se pierde
   * justo donde más importa. Anidado no hay nada que esparcir.
   */
  que: ParDeResultado;
}

interface LoComunDeUnResultado {
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
  /**
   * El modo, cuando la salida los tiene. Hoy solo `seguimiento`: `'manual'` o `'automatico'`.
   *
   * `null` = la salida no admite modos, que es el caso de cinco de las seis. La validación de que
   * el modo exista para esa salida la hace la ruta contra el catálogo, no este escritor: acuá
   * llega ya comprobado, igual que la salida.
   */
  modo: string | null;
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
  /* El mapa es el DEL ROL. Con el mapa único que había, un `venta_chica` del setter escribía
     `ganado` —una columna del closer— sobre un contacto del setter: una etapa que su Pipeline no
     dibuja, o sea un contacto que desaparece de todas sus columnas sin que nada falle. */
  const etapa = etapaDeLaSalida(lo.que.rol, lo.que.salida);
  if (etapa === undefined) {
    // Inalcanzable: el `Record` de cada embudo obliga a que estén todas sus salidas, y el par ya
    // pasó por la guarda. Se dice en vez de escribir `undefined` en la columna.
    throw new Error(`la salida «${lo.que.salida}» no tiene columna en el embudo de ${lo.que.rol}`);
  }

  const resultado = await datos()
    .insertInto('resultados')
    .values({
      contacto_id: contactoId,
      salida: lo.que.salida,
      rol: lo.que.rol,
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

  /* ── EL SELLO DE ATRIBUCIÓN, EN LA MISMA TRANSACCIÓN ──────────────────────
   *
   * Registrar un resultado es la intervención manual más fuerte que existe: alguien mira la
   * conversación y decide en qué terminó. Si el contacto es del setter y todavía no tenía sello, se
   * enciende con quien lo registró.
   *
   * Va DENTRO de la transacción y no después por el mismo motivo que la nota: si el sello falla, el
   * resultado tampoco queda. La alternativa —sellar afuera— dejaría resultados sin atribución y
   * comisión diferida que nadie puede reclamar, sin ningún error visible.
   *
   * `sellarSiEsDelSetter` decide sola si corresponde: mira el TERRITORIO del contacto y que el sello
   * esté vacío. Que no haga nada es el caso normal, no un fallo. */
  await sellarSiEsDelSetter(contactoId, lo.quien);

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

  /* ── QUIÉN PERSIGUE A ESTE CONTACTO, Y POR ESO NO SIEMPRE HAY TAREA ────────
   *
   * El modo `automatico` de un seguimiento significa que **lo persigue la secuencia de correos del
   * CRM**. Escribir también una fila en `negocio.tareas` pondría al contacto en Mi Día como algo que
   * una persona tiene que hacer, cuando no hay nada que hacer: es el defecto que se pidió evitar.
   *
   * Para las otras cinco salidas no hay modos, y una fecha sigue creando su recordatorio —es útil
   * después de un no-show, por ejemplo—. Así que la condición no es «es seguimiento» sino «alguien
   * de este lado lo va a retomar», que es lo que `exigeFecha` declara en el catálogo. */
  /* El rol sale de `lo`, que lo trae del TERRITORIO del contacto. No hace falta buscarlo: los dos
     catálogos tienen una salida `seguimiento` con modos distintos, y preguntarle al equivocado
     devolvería `undefined` — o sea que un seguimiento del setter escribiría tarea cuando no debe. */
  const laPersigueElCrm =
    lo.modo !== null && modoDe(lo.que.rol, lo.que.salida, lo.modo)?.exigeFecha === false;

  let tarea = false;
  if (lo.volverEl !== null && !laPersigueElCrm) {
    await datos()
      .insertInto('tareas')
      .values({
        // El día tal cual, sin convertir. Ver `volverEl` arriba.
        vence_el: lo.volverEl,
        contacto_id: contactoId,
        situacion: 'seguimiento',
        /* `manual` SIEMPRE, y ahora es una consecuencia y no un cableado.
           Antes esta línea decía `modo: 'manual'` con un comentario que afirmaba que de esa
           distinción dependía el contador de Mi Día — y era falso por dos lados: no existía el modo
           automático, y el contador nunca leía esta columna.
           Hoy es verdad por construcción: si llegamos acá, es porque nadie del CRM lo persigue. */
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
