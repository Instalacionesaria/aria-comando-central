// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// Mi Día del Setter y su Inicio: seis colas, el cockpit y las dos comisiones. UNA llamada, cero CRM.
//
// ═══════════════════════════════════════════════════════════════════════════════
// UNA LLAMADA, Y NO UNA POR COLA
//
// El mismo argumento que el gemelo del closer: el contador de tareas pendientes se calcula con la
// regla de Mi Día, y con dos endpoints habría **dos implementaciones del mismo número**. Una sola
// función lo calcula y viaja con las colas.
//
// Y el territorio se escribe acá, en el servidor: no sale de la petición ni del cuerpo. Con una ruta
// parametrizada, el navegador elegiría de qué territorio son las colas que ve.
//
// ── POR QUÉ EL COCKPIT Y LAS COMISIONES VIAJAN ACÁ Y NO EN `/api/setter/inicio` ──
//
// Por lo mismo que en el closer, y hay dos motivos independientes:
//
// **1 · El contador de tareas.** El cockpit lo muestra y Mi Día lo calcula. Con dos endpoints habría
// dos implementaciones del mismo número, y el `01` es terminante: *«si dos pantallas muestran el
// mismo número, comparten la función que lo calcula»*. Acá el cockpit RECIBE el que ya se calculó,
// así que no puede discrepar.
//
// **2 · `ADR-0304`.** Un endpoint propio con `PANTALLA = 'setter'` tendría que pedir el mismo
// conjunto de capacidades que los otros tres y no ganaría nada; y con otra capacidad, alguien vería
// la pantalla con la mitad en blanco y sin ningún error — justo el defecto que esa regla previene.
//
// Y cabe en la regla de admisión del endpoint del reloj de diez segundos: *«como mucho UNA mitad que
// toque el CRM; todo lo demás tiene que ser más barato que un viaje de ida y vuelta»*. Esto son tres
// consultas más a nuestra base y **cero llamadas externas**.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { colasDelSetter } from '../../../../lib/negocio/miDiaDelSetter.ts';
import { cockpitDelSetter } from '../../../../lib/negocio/inicioDelSetter.ts';
import { comisionDelSetter } from '../../../../lib/negocio/comisionDelSetter.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'setter';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['setter.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* La zona horaria de la ORGANIZACIÓN, no la del navegador. Es lo que decide qué es «hoy» en las
     colas que filtran por día, y con una empresa en otro huso el corte cae en el momento equivocado. */
  const zona = contexto.organizacion.zonaHoraria;

  const { colas, cockpit, comision } = await conOrganizacion(contexto.orgEfectiva, async () => {
    const colas = await colasDelSetter(zona);

    /* ── DE QUIÉN SON LOS NÚMEROS DE ESTA PANTALLA: DE QUIEN MIRA ────────────
     *
     * Y no de un designado, que es la diferencia estructural con el closer. `closer_asignado` tiene
     * `org_id` como clave primaria entera —uno por empresa— y el setter es multi-persona por
     * construcción: el disparador del sello existe justamente porque *«el segundo setter no le roba
     * la atribución al primero»*.
     *
     * Así que el sujeto sale de `contexto.usuarioId` y **nunca es nulo**: no hay estado «nadie
     * designado» que manejar, y tampoco hay forma de que alguien vea los números de otro. */
    const quien = contexto.usuarioId;

    // El contador se le PASA al cockpit, no se recalcula. Ver el encabezado.
    const cockpit = await cockpitDelSetter(zona, colas.tareasPendientes, quien);
    const comision = await comisionDelSetter(quien, zona);
    return { colas, cockpit, comision };
  });

  return ok({
    colas,
    cockpit,
    /* Las DOS comisiones, cada una con su porcentaje, su meta y su motivo de ausencia. Viajan
       separadas porque son dos negocios distintos: las ventas chicas que cobró él, y el tramo sobre
       las ventas del closer en los leads que originó. */
    comision,
    // Viaja con las colas porque la pantalla la necesita para dibujar horas: sin ella tendría que
    // usar la del navegador, que es la de quien mira y no la de la empresa.
    zonaHoraria: zona,
    /* La pantalla lo necesita para NO ofrecerle a un superadministrador que configure su meta en la
       empresa de OTRO: su `usuarioId` no pertenece a esa empresa, así que la fila de `comisiones` es
       imposible por la clave foránea compuesta. Y sin esto los dos tramos le dirían «nadie cargó tu
       porcentaje» — mandándolo a cargar algo que no se puede guardar. */
    mirandoOtraOrganizacion: contexto.mirandoOtraOrganizacion,
    /* Se DECLARA que no costó nada. Es una afirmación verificable y no una promesa en un comentario:
       si mañana alguien mete una llamada al CRM en el camino de esta pantalla, este número deja de
       ser cero y se nota. */
    llamadasAlCrm: 0,
  });
}
