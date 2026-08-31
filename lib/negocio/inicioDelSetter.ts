// El cockpit del setter: ¿cómo voy este mes?
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL SUJETO ES QUIEN MIRA, Y ESO NO ES UNA VARIANTE DEL COCKPIT DEL CLOSER
//
// El del closer tiene un sujeto ÚNICO por empresa: `negocio.closer_asignado` tiene `org_id` como
// clave primaria entera, así que todos los que abren esa pantalla ven los números de la misma
// persona, y si nadie está designado no hay números y se dice.
//
// El setter es **multi-persona por construcción** — el disparador del sello existe justamente porque
// *«el segundo setter no le roba la atribución al primero»*. Así que acá no hay designación posible,
// no hace falta tabla nueva, y `usuarioId` **nunca es nulo**: es quien está mirando. Eso borra de
// este archivo el estado «nadie designado» que en el del closer ocupa media consulta.
//
// ── LO QUE ESTE COCKPIT **NO** CUENTA, Y ES LA DECISIÓN MÁS IMPORTANTE ──────
//
// No cuenta los estancados ni las oportunidades chicas, y no es un olvido: **son dos de las seis
// colas de Mi Día**, y los dos números llegan a la pantalla en la misma respuesta
// (`colas.estancadas` y `colas.oportunidades`). Contarlos otra vez acá crearía dos derivaciones del
// mismo hecho, y el `01` es terminante: *«si dos pantallas muestran el mismo número, comparten la
// función que lo calcula»*.
//
// Y el defecto que evita es concreto: las colas descuentan a los contactos CERRADOS y a los que ya
// están en otra cola; un `count` por etiqueta acá no lo haría. La pantalla mostraría «7 estancados»
// arriba y cinco tarjetas abajo, sin nada que lo explique.
//
// ── LOS DOS NÚMEROS QUE NO SE PUEDEN MEDIR VIAJAN NULOS, CON SU MOTIVO ─────
//
// Las **agendas automáticas** (las que hizo el agente) y el **porcentaje de asistencia**. Los dos
// están en el diseño de producto y los dos son estructuralmente imposibles hoy: `negocio.citas` no
// guarda quién creó la cita, y nadie marca la asistencia en ninguna parte.
//
// Van nulos y con su texto, y no en cero. El `11` § 4: *«un `$0` donde nadie cargó montos afirma «no
// vendiste nada». Es falso, y nadie reporta un panel que simplemente parece vacío»*. Con un cero, un
// setter cuyo agente agenda solo todo el día ve un tablero que dice que el agente no agendó nada.
// ═══════════════════════════════════════════════════════════════════════════════

import { datos } from '../datos/contexto.ts';
import { sql } from 'kysely';
import type { Indicador } from './inicio.ts';

export interface CockpitDelSetter {
  /** El mes al que corresponden los números, en la zona de la organización. */
  mes: string;
  /**
   * Lo cobrado en ventas chicas este mes. Cobrado real: `venta_chica` con monto cargado.
   *
   * Es la base del tramo DIRECTO de su comisión, y el mismo número que `comisionDelSetter` calcula
   * como `directo.base` — sale de la misma consulta a propósito, no de dos.
   */
  vendidoChico: Indicador;
  /** Cuántas ventas chicas registró. */
  ventasChicas: Indicador;
  /**
   * Citas que agendó **a mano**, o sea las que registró con la salida `agendo`.
   *
   * Dice «a mano» porque es lo único que este número puede decir con verdad: mide resultados que
   * esta persona registró. Las del agente no están acá ni se suman — ver `agendasDelAgente`.
   */
  agendas: Indicador;
  /**
   * Las que agendó el AGENTE. **Siempre nula**, con su motivo.
   *
   * `negocio.citas` no guarda quién creó la cita, así que no hay forma de separar las del agente de
   * las nuestras. Ponerlas en cero afirmaría que el agente no agendó nada.
   */
  agendasDelAgente: Indicador;
  /** Contactos que descalificó este mes: la salida `no_califica`. */
  descalificados: Indicador;
  /** Los que mandó a nurture este mes. */
  aNurture: Indicador;
  /**
   * El porcentaje de asistencia a las citas que agendó. **Siempre nula**, con su motivo.
   *
   * Hace falta saber quién asistió y sobre cuántas citas, y nadie lo marca. No se aproxima con los
   * no-shows: ese número dice cuántos faltaron, no sobre cuántos, y una tasa sin denominador no es
   * una tasa.
   */
  tasaDeAsistencia: Indicador;
  /** Cuántas tareas esperan en Mi Día. El puente a la otra pantalla. */
  tareasPendientes: Indicador;
}

/**
 * El cockpit del mes de quien mira. **Corre dentro de `conOrganizacion(`.**
 *
 * @param zonaHoraria La de la ORGANIZACIÓN. El mes de un setter en Lima no empieza cuando empieza el
 *   del servidor, y una métrica mensual calculada en otra zona corre el corte en los dos extremos.
 * @param tareasPendientes El contador que Mi Día ya calculó. **Se pasa, no se recalcula**: con dos
 *   implementaciones salen dos números para lo mismo.
 * @param usuarioId Quien mira. Sin valor por omisión: uno acá sería una persona real firmando los
 *   números de otra.
 */
export async function cockpitDelSetter(
  zonaHoraria: string,
  tareasPendientes: number,
  usuarioId: string,
): Promise<CockpitDelSetter> {
  const desdeElPrimero = sql<Date>`date_trunc('month', timezone(${zonaHoraria}, now())) at time zone ${zonaHoraria}`;

  /* Los cuatro números del mes en UNA pasada, con `filter`. Cuatro consultas para cuatro agregados
     del mismo origen es trabajo que no hace falta.

     Y el `where registrado_por` es la línea que hace honesto todo lo de abajo: la política de RLS
     aísla por ORGANIZACIÓN y no por persona, así que sin ella el tablero de cada setter muestra el
     trabajo de todos sus compañeros. El defecto se ve como un número plausible y más alto. */
  const r = await datos()
    .selectFrom('resultados')
    .where('creado_el', '>=', desdeElPrimero)
    .where('registrado_por', '=', usuarioId)
    .select(({ fn, eb }) => [
      fn
        .sum<string | null>(
          eb.case().when('salida', '=', 'venta_chica').then(eb.ref('monto')).else(null).end(),
        )
        .as('vendido'),
      fn.countAll<string>().filterWhere('salida', '=', 'venta_chica').as('ventas_chicas'),
      fn.countAll<string>().filterWhere('salida', '=', 'agendo').as('agendas'),
      fn.countAll<string>().filterWhere('salida', '=', 'no_califica').as('descalificados'),
      fn.countAll<string>().filterWhere('salida', '=', 'nurture').as('nurture'),
      fn.countAll<string>().as('total'),
    ])
    .executeTakeFirst();

  /* ¿Hubo ALGÚN resultado este mes? Es la pregunta que decide entre `—` y `0`.
   *
   * Sin ningún resultado registrado, «vendido» no es cero: es que esta persona no registró nada
   * todavía. Con resultados y sin ventas chicas, cero es un hecho — y es el caso normal de un setter
   * que agenda y no vende: cuarenta agendas y `$0` de venta chica es un tablero correcto. */
  const hubo = Number(r?.total ?? 0) > 0;
  const SIN_AVANZAR = 'Todavía no registraste ningún resultado este mes. Los números salen de Avanzar.';
  const medido = (n: string | number | null | undefined): Indicador =>
    hubo ? { valor: Number(n ?? 0) } : { valor: null, falta: SIN_AVANZAR };

  return {
    mes: new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: zonaHoraria }).format(
      new Date(),
    ),
    vendidoChico: medido(r?.vendido),
    ventasChicas: medido(r?.ventas_chicas),
    agendas: medido(r?.agendas),
    descalificados: medido(r?.descalificados),
    aNurture: medido(r?.nurture),

    /* ── LOS DOS QUE NO SE PUEDEN MEDIR ──────────────────────────────────────
     *
     * Van dentro del cockpit y no se omiten del tipo, y eso es a propósito: omitirlos haría que la
     * pantalla no tuviera dónde decir que faltan, y «no está en la pantalla» se lee como «no
     * existe». Están, con el nombre que van a tener el día que se puedan medir, y diciendo qué falta
     * para eso. */
    agendasDelAgente: {
      valor: null,
      falta:
        'Todavía no se pueden separar de las tuyas: el registro de citas no guarda quién la creó.',
    },
    tasaDeAsistencia: {
      valor: null,
      falta:
        'Todavía no se puede calcular: hace falta saber quién asistió a cada cita y sobre cuántas, ' +
        'y eso se registra al cerrar la cita.',
    },

    // Viene de Mi Día, calculado con su regla: suma las CINCO categorías del setter.
    tareasPendientes: { valor: tareasPendientes },
  };
}
