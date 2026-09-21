// LOS INDICADORES DE APPOINTMENT FLOW: qué pasó con las citas. Una sola pasada, tres cifras.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA CIFRA QUE ESTE ARCHIVO EXISTE PARA NO DAR
//
// Medido el 2026-09-13 y reportado como «160 de 316 canceladas, el 50,6 %». **Ese número estaba
// sesgado a la baja**, y cómo apareció importa más que el número: la tasa subía hacia el presente
// —61,9 % a siete días, 60,1 % a catorce, 52,9 % a treinta, 50,6 % en total— y eso se parece a una
// tendencia. No lo era.
//
// Partiendo la población el 2026-09-14:
//
//     con calendario (el barrido todavía las alcanza)   199 citas   120 canceladas   60,3 %
//     congeladas (anteriores a la migración 038)        101 citas    31 canceladas   30,7 %
//
// Las 101 congeladas tienen `ghl_calendario_id` nulo, dejaron de sincronizarse el 2026-09-06 y el
// CRM ya no devuelve sus eventos — comprobado: catorce caen DENTRO de la ventana actual del barrido
// y aun así no se refrescan. Su estado quedó congelado en el de ese día.
//
// ── LA REGLA QUE SALE DE AHÍ, Y VALE PARA TODA CIFRA POR PERÍODO ────────────
//
// **Una ventana más vieja no es una muestra más grande.** Cuanto más atrás mira un número en este
// sistema, mayor es la proporción de citas que el sistema dejó de mirar. Así que se cuenta sobre lo
// que el barrido alcanza, y lo congelado se declara aparte — nunca se suma en silencio.
//
// Y desde el 2026-09-14 esa exclusión tiene además un motivo de producto, no sólo técnico:
// **decidido que sólo cuentan las citas agendadas desde que Comando Central existe** (la primera
// guardada es del 2026-08-26). Las anteriores no importan, así que excluirlas no es una pérdida que
// haya que compensar algún día — es el alcance.
//
// ── Y POR QUÉ LA VENTANA VA POR `inicio_el` Y NO POR `reservada_el` ─────────
//
// `reservada_el` es la fecha nueva y tentadora —contestaría «de las que se agendaron esta semana,
// cuántas se cayeron»— pero su cobertura es parcial y crece sola: las citas anteriores a la `043` no
// la tienen. Una tasa sobre una columna que se está llenando cambia cada día sin que cambie el
// negocio. `inicio_el` está en 316 de 316, así que la ventana es completa por construcción y la
// única incompletitud que queda es la que este archivo declara.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { campoPorNombre } from './camposDelCrm.ts';
/* `ESTADOS_CANCELADOS` y `ETIQUETAS_DE_DESCARTE` se dejaron de importar acá: los dos vocabularios
   los usa ahora `citasAlcanzables.ts`, que es quien arma los predicados. Dejar las importaciones
   «por si acaso» las vuelve invisibles: nadie que lea este archivo sabría que no se usan.
   *
   Se renombran al importar porque en el cuerpo de `tasaDeCancelacion` los tres nombres cortos ya
   están tomados por sus instancias, y `const alcanzable = alcanzable()` no compila. */
import {
  alcanzable as esAlcanzable,
  cancelada as esCancelada,
  descartado as esDescartado,
} from './citasAlcanzables.ts';
import { avisoDeLaCola } from './periodo.ts';

/**
 * La tasa de cancelación de una ventana, con lo que quedó afuera.
 *
 * `aviso` es `null` cuando no hay nada que decir, y entonces **la pantalla no dibuja nada**. Es la
 * misma regla de silencio que usa `Frescura`, y es la que hace que un aviso signifique algo: un
 * cartel que aparece siempre se aprende a ignorar.
 */
export interface Cancelacion {
  /** Citas alcanzables en la ventana. `0` = no hay base, y entonces `tasa` es `null`. */
  citas: number;
  canceladas: number;
  /** De 0 a 100, redondeada a un decimal. `null` cuando no hay citas: un 0 % sería una afirmación. */
  tasa: number | null;
  /** Cuántas citas de la ventana quedaron fuera del conteo por estar congeladas. */
  congeladas: number;
  /** El texto ya armado, o `null` si no hay nada que advertir. */
  aviso: string | null;
  dias: number;
  /**
   * La cita más vieja que la ventana llegó a alcanzar. **No es `now() - dias`, y ahí está el punto.**
   *
   * Con «completo» la ventana son diez años y la primera cita es de hace tres semanas. Publicar sólo
   * `dias` haría que la pantalla dijera «completo» sobre tres semanas de historia y que quien mira
   * creyera estar viendo un año. `desde` es lo único que distingue *«pedí todo»* de *«todo es esto»*.
   *
   * `null` cuando la ventana no alcanzó ninguna cita: no hay fecha que declarar, y una fecha
   * inventada acá sería peor que el hueco.
   *
   * **No viaja sola.** Ver `avisoDeLaVentana`.
   */
  desde: Date | null;
  /** La fecha en la que la ventana llegó a la MITAD de sus citas. Mediana, no promedio. */
  mitad: Date | null;
  /**
   * Qué decir cuando `desde` describe a una cita suelta y no a la ventana. **Hoy es `null` en los
   * cuatro períodos, y eso es lo correcto**, no un olvido: medido el 2026-09-16, la proporción de
   * las citas va de 0,81 a 0,46 y ninguna se acerca al umbral, porque su historia empieza el
   * 2026-08-24 y no tiene cola.
   *
   * Está igual porque el defecto que cierra ya ocurrió en la otra mitad de esta pantalla —Lead Flow
   * publicaba «desde el 8 de agosto de 2025» sobre un conjunto de agosto de 2026— y la única
   * diferencia entre las dos poblaciones es que a las citas todavía no les llegó una fila vieja. Es
   * la misma disciplina que la guarda `>= 0` de las latencias, que tampoco se enciende hoy.
   */
  avisoDeLaVentana: string | null;
  /**
   * Cuántas de las citas alcanzables se REAGENDARON, y su tasa.
   *
   * Es el indicador que la 042 habilitó: hasta entonces reagendar pisaba la hora sin dejar rastro.
   * Medido en la ventana el 2026-09-14: **11 de 151, el 7,3 %**.
   */
  reagendadas: number;
  tasaDeReagendamiento: number | null;
  /**
   * La MEDIANA de horas entre que la cita se reservó y que ocurre. Mediana y no promedio: una sola
   * cita reservada con dos meses de anticipación corre el promedio y no dice nada del resto.
   *
   * `null` cuando ninguna cita de la ventana tiene fecha de reserva — las anteriores a la `043` no
   * la tienen. Medido: dentro de la ventana la cobertura es de **150 de 151**, así que el nulo es un
   * caso de borde y no el estado normal.
   */
  horasHastaLaCita: number | null;
  /** Sobre cuántas citas se calculó lo de arriba. Viaja para que la pantalla no lo suponga. */
  conFechaDeReserva: number;
  /**
   * No-shows que **reportó una persona** al cerrar el intento, en la ventana.
   *
   * Es un CONTEO y no una tasa, y eso es deliberado: medido el 2026-09-14 hay **2 en catorce días**
   * sobre 6 resultados. Una tasa sobre dos eventos no es una tasa — es un número que se mueve
   * cincuenta puntos con el próximo registro. Y su denominador tampoco sería el de las citas: un
   * resultado es un intento del closer, que no es lo mismo.
   *
   * El CRM no sirve para esto: sus campos de asistencia están en 0 de 316.
   */
  noShowReportado: number;
  /**
   * Cuántas citas de la ventana tienen la asistencia RESPONDIDA, y de ésas cuántas se presentaron.
   *
   * El denominador no son las citas: son las citas sobre las que alguien contestó. La diferencia es
   * lo que impide el peor defecto posible acá — contar como plantón toda cita que nadie cerró
   * todavía, y anunciar que no viene nadie.
   *
   * `tasaDeAsistencia` es `null` hasta que haya suficientes respuestas. Ver `PISO_DE_UNA_TASA`:
   * es la misma disciplina por la que el no-show de arriba se declara como conteo.
   *
   * Arranca en cero y no tiene historia: la `049` es de hoy y una migración no puede rellenar. El
   * aviso lo dice.
   */
  conAsistencia: number;
  sePresentaron: number;
  tasaDeAsistencia: number | null;
  /**
   * Por qué la tasa de asistencia no está, o qué le falta. **Campo propio y no parte de `aviso`.**
   *
   * Mezclarlos rompería la regla del silencio justo donde más cuesta: `aviso` calla en el caso
   * normal, y eso es lo que hace que cuando aparece alguien lo lea. La asistencia va a estar por
   * debajo del piso durante semanas, así que un aviso compartido estaría SIEMPRE encendido — y un
   * aviso que siempre aparece es un aviso que nadie mira, incluido el de las citas congeladas.
   */
  avisoDeAsistencia: string | null;
  /**
   * Cuántos de los contactos con cita en la ventana **confirmaron** el agendamiento, según el campo
   * del CRM `Confirmación Agendamiento`.
   *
   * ── ES DEL CONTACTO Y NO DE LA CITA, Y ESO ACOTA LO QUE DICE ─────────────
   *
   * GoHighLevel lo guarda en el contacto, así que un contacto con dos citas tiene **un** valor: el
   * de la última vez que alguien tocó ese campo. Por eso el denominador son CONTACTOS con cita en la
   * ventana y no citas — contar citas repetiría el mismo valor dos veces y lo haría pesar doble.
   *
   * `null` en la tasa = el campo no existe en este CRM, o nadie lo respondió. Los dos casos los
   * distingue `avisoDeConfirmacion`.
   */
  conConfirmacion: number;
  confirmaron: number;
  tasaDeConfirmacion: number | null;
  avisoDeConfirmacion: string | null;
  /**
   * Las citas de contactos que **la empresa misma descartó**, apartadas del resto.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * ESTO CAMBIA LO QUE SIGNIFICA `tasa`, Y HAY QUE LEERLO ANTES DE USARLA
   *
   * `citas`, `canceladas` y `tasa` ya **no** cuentan a los contactos descartados. Antes sí, y el
   * número que salía era la mezcla de dos hechos opuestos. Medido el 2026-09-14:
   *
   *     descartados      72 citas   94,4 % cancelan   ← la automatización de la casa
   *     el resto         78 citas   33,3 % cancelan   ← el negocio
   *     las dos juntas  150 citas   62,7 %            ← lo que se publicaba
   *
   * Casi la mitad de las citas de la ventana son de contactos ya rechazados, y cancelan al 94 %
   * porque el flujo de descarte las cancela. Publicar 62,7 % como «tasa de cancelación» le atribuía
   * al negocio la mitad del trabajo de su propio filtro.
   *
   * **No se esconden**: van acá, con su conteo y su tasa. Lo que no se hace es sumarlas en
   * silencio, que es la misma disciplina que este archivo ya aplica con las citas congeladas.
   * ══════════════════════════════════════════════════════════════════════════
   */
  descartados: { citas: number; canceladas: number; tasa: number | null };
}

/**
 * El nombre EXACTO del campo del CRM que dice si el contacto confirmó.
 *
 * Va acá y no adentro de la consulta porque es un dato de configuración del cliente disfrazado de
 * constante: el día que haya una segunda empresa con otro nombre, esto se muda a una columna de
 * `organizaciones_credenciales` y este comentario dice por qué.
 *
 * Medido el 2026-09-14 contra la subcuenta real: 178 de 584 contactos lo traen, con exactamente dos
 * valores —`Si` (125) y `No` (53)—. Es un vocabulario del CRM y no nuestro, así que la comparación
 * es contra el texto tal cual viene.
 */
export const CAMPO_DE_CONFIRMACION = 'Confirmación Agendamiento';

/** El valor que significa «confirmó». El resto —`No`, o cualquier otro— no confirma. */
const CONFIRMO = 'Si';

/**
 * Cuántos confirmaron, entre los contactos con cita alcanzable en la ventana.
 *
 * ── POR QUÉ ES UNA CONSULTA APARTE Y NO ENTRA A LA PASADA GRANDE ───────────
 *
 * Porque el denominador es otro: las cuatro cifras de arriba cuentan CITAS y ésta cuenta CONTACTOS
 * con cita —el campo vive en el contacto, no en la cita—. Meterla en el mismo `select` obligaría a
 * un `distinct` dentro de un `filter`, y el resultado se leería como si hablara de las mismas filas
 * que sus vecinas cuando no lo hace.
 *
 * Corre en la misma transacción igual, por lo mismo que el no-show.
 */
async function confirmacionEnLaVentana(
  dias: number,
): Promise<{ conConfirmacion: number; confirmaron: number; conCita: number; hayCampo: boolean }> {
  const campoId = await campoPorNombre(CAMPO_DE_CONFIRMACION);
  /* Sin el campo en el catálogo no hay cifra, y **no es lo mismo que cero**: puede ser que esta
     empresa no use ese campo, o que alguien lo haya renombrado en el CRM. Se devuelve el hecho y lo
     dice el aviso; calcular sobre `null` daría 0 de 0 y la pantalla mostraría un hueco mudo. */
  if (campoId === null) {
    return { conConfirmacion: 0, confirmaron: 0, conCita: 0, hayCampo: false };
  }

  const f = await datos()
    .selectFrom('contactos as ct')
    .select([
      sql<number>`count(*)`.as('con_cita'),
      sql<number>`count(*) filter (where ct.campos_del_crm ? ${campoId})`.as('con_confirmacion'),
      sql<number>`count(*) filter (where ct.campos_del_crm ->> ${campoId} = ${CONFIRMO})`.as('confirmaron'),
    ])
    /* `exists` y no un `join`: con el `join`, un contacto con tres citas en la ventana contaría tres
       veces, y su única respuesta pesaría el triple que la de quien tuvo una sola. */
    .where(
      sql<boolean>`exists (
        select 1 from negocio.citas ci
        where ci.org_id = ct.org_id
          and ci.contacto_id = ct.id
          and ci.ghl_calendario_id is not null
          and ci.inicio_el >= now() - make_interval(days => ${dias})
          and ci.inicio_el < now()
      )`,
    )
    .executeTakeFirst();

  return {
    conConfirmacion: Number(f?.con_confirmacion ?? 0),
    confirmaron: Number(f?.confirmaron ?? 0),
    conCita: Number(f?.con_cita ?? 0),
    hayCampo: true,
  };
}

/**
 * Qué decir de la confirmación, y cuándo callarse. Los mismos tres estados que sus dos hermanas.
 *
 * El primero es el que la distingue de las otras: **el campo puede no existir**. Ése no es un
 * problema de volumen que se arregle esperando, así que el texto manda a mirar el CRM y no a
 * registrar más.
 */
function avisoDeLaConfirmacion(
  hayCampo: boolean,
  conCita: number,
  conConfirmacion: number,
): string | null {
  if (!hayCampo) {
    return `El CRM de esta empresa no tiene un campo «${CAMPO_DE_CONFIRMACION}», o cambió de ` +
      'nombre. Sin él no hay confirmación que contar: no es que nadie confirme.';
  }
  if (conCita === 0) return null; // Ya lo dijo `avisoDe`.
  if (conConfirmacion === 0) {
    return `Ninguno de los ${conCita} contactos con cita en este período tiene respondido el campo ` +
      `«${CAMPO_DE_CONFIRMACION}» en el CRM.`;
  }
  if (conConfirmacion < PISO_DE_UNA_TASA) {
    return `Sólo ${conConfirmacion} de ${conCita} contactos con cita tienen ese campo respondido en ` +
      `el CRM. Con menos de ${PISO_DE_UNA_TASA} no se muestra una tasa.`;
  }
  return null;
}

/**
 * Cuántos eventos hacen falta antes de mostrar CUALQUIER tasa de este sistema.
 *
 * Se llamaba `PISO_DE_ASISTENCIA` y lo usaban cuatro cifras: nombrar una constante compartida por
 * la primera que la necesitó invita a que la quinta se escriba su propio piso «porque aquélla es de
 * la asistencia», y dos pisos distintos para la misma regla divergen sin que nada falle.
 *
 * **Diez, y el número sale de un defecto ya pagado, no del gusto.** La tasa de no-show que hay más
 * arriba se declara como CONTEO justamente porque medía 2 eventos en catorce días: *«una tasa sobre
 * dos eventos no es una tasa — es un número que se mueve cincuenta puntos con el próximo
 * registro»*. Con diez, un registro mueve diez puntos, que sigue siendo mucho y ya no es absurdo.
 *
 * Y el piso es del DENOMINADOR, no del total de citas: con 151 citas y 3 respuestas la muestra son
 * 3, y quien contestó esas tres no es una muestra al azar de las 151 — el closer que cierra sus
 * intentos no es el mismo que no los cierra.
 */
export const PISO_DE_UNA_TASA = 10;

/**
 * Cuántos días mira la cifra.
 *
 * **Catorce y no treinta**, y el motivo es el sesgo de arriba: la ventana trasera del barrido son
 * catorce días, así que más allá de eso la proporción de citas congeladas crece y la tasa se
 * ensucia. Pedir una ventana más larga no trae más señal: trae más citas que el sistema dejó de
 * mirar.
 */
export const DIAS_DE_LA_TASA = 14;

export async function tasaDeCancelacion(dias = DIAS_DE_LA_TASA): Promise<Cancelacion> {
  /* Los tres salían de constantes locales de esta función, con este mismo motivo escrito: repetidos,
     el día que alguien agregue una cifra la escribe con un filtro apenas distinto, las dos conviven,
     y la tarjeta muestra números que no cuadran entre sí mientras cada uno se ve bien por separado.
     *
     El 2026-09-21 se midió que eso YA había pasado —`ghl_calendario_id is not null` en nueve
     módulos— así que se mudaron a `citasAlcanzables.ts`, que es de dónde los toma todo el mundo
     ahora. Acá se instancian con el alias de esta consulta, que es `citas` a secas. */
  const alcanzable = esAlcanzable();
  const cancelada = esCancelada();
  const descartado = esDescartado();

  const fila = await datos()
    .selectFrom('citas')
    .select([
      /* Alcanzables: las que el barrido todavía puede refrescar. Las de `ghl_calendario_id` nulo son
         anteriores a la `038` y el CRM ya no devuelve sus eventos, así que su estado no va a cambiar
         nunca más — contarlas es contar una foto vieja como si fuera de hoy. */
      sql<number>`count(*) filter (where ${alcanzable} and not ${descartado})`.as('citas'),
      sql<number>`count(*) filter (
        where ${alcanzable} and not ${descartado} and ${cancelada}
      )`.as('canceladas'),
      /* Los descartados, en la MISMA pasada y como su propio par de números. Dos consultas podrían
         ver estados distintos de la tabla —el barrido escribe cada hora— y entonces las dos
         poblaciones de la misma tarjeta no sumarían el total, sin que nada falle. */
      sql<number>`count(*) filter (where ${alcanzable} and ${descartado})`.as('desc_citas'),
      sql<number>`count(*) filter (
        where ${alcanzable} and ${descartado} and ${cancelada}
      )`.as('desc_canceladas'),
      sql<number>`count(*) filter (where ghl_calendario_id is null)`.as('congeladas'),
      /* Los otros dos, en la MISMA pasada. Tres consultas separadas podrían ver estados distintos de
         la tabla —el barrido escribe cada hora— y entonces las cifras de una misma tarjeta no
         cuadrarían entre sí, sin que nada falle. */
      sql<number>`count(*) filter (
        where ${alcanzable} and not ${descartado} and reagendada_el is not null
      )`.as('reagendadas'),
      sql<number>`count(reservada_el) filter (where ${alcanzable} and not ${descartado})`.as('con_reserva'),
      /* La MEDIANA, calculada por la base. `percentile_cont` interpola entre los dos centrales, que
         para horas es lo que se quiere. Las citas sin fecha de reserva no entran: `percentile_cont`
         ignora los nulos, así que el resultado es de las que sí la tienen — y por eso viaja
         `con_reserva`, para que la pantalla pueda decir sobre cuántas habla. */
      sql<number | null>`percentile_cont(0.5) within group (
        order by extract(epoch from (inicio_el - reservada_el)) / 3600
      ) filter (where ${alcanzable} and not ${descartado} and reservada_el is not null)`.as('horas'),
      /* ── LA ASISTENCIA, Y EL FILTRO QUE ES TODO EL INDICADOR ───────────────
       *
       * `asistio is not null` en el DENOMINADOR. Sin ese filtro la cuenta sería sobre todas las
       * citas alcanzables, y como el nulo es el caso normal —nadie cerró el intento todavía, y
       * ninguna cita anterior a la `049` lo va a tener nunca— la tasa diría que no se presenta casi
       * nadie. Sería una cifra plausible, alarmante y falsa.
       *
       * Y `is true` en el numerador y no `= true`: son equivalentes hoy porque el filtro ya excluyó
       * los nulos, y `is true` lo sigue siendo el día que alguien toque ese filtro. */
      sql<number>`count(*) filter (
        where ${alcanzable} and not ${descartado} and asistio is not null
      )`.as('con_asistencia'),
      sql<number>`count(*) filter (
        where ${alcanzable} and not ${descartado} and asistio is true
      )`.as('se_presentaron'),
      /* La cita más vieja que la ventana alcanzó, en la MISMA pasada. En una consulta aparte podría
         salir de un estado distinto de la tabla —el barrido escribe cada hora— y la pantalla diría
         «desde el 24 de agosto» sobre un conteo que ya no incluye esa cita. */
      sql<Date | null>`min(inicio_el) filter (where ${alcanzable} and not ${descartado})`.as('desde'),
      /* La mediana y la proporción contra `desde`, en la misma pasada y con el reloj de la base.
         Ver `avisoDeLaCola`: es lo que impide que una cita vieja suelta describa a la ventana. */
      sql<Date | null>`percentile_disc(0.5) within group (order by inicio_el)
        filter (where ${alcanzable} and not ${descartado})`.as('mitad'),
      sql<number | null>`
        extract(epoch from (now() - percentile_disc(0.5) within group (order by inicio_el)
          filter (where ${alcanzable} and not ${descartado})))
        / nullif(extract(epoch from (now() - min(inicio_el)
          filter (where ${alcanzable} and not ${descartado}))), 0)`.as('proporcion'),
    ])
    /* La ventana la calcula la BASE y no la aplicación: es la única forma de que el «ahora» sea el
       mismo reloj que escribió las filas. Es el mismo recurso que usa `frescuraDe`. */
    .where(sql<boolean>`inicio_el >= now() - make_interval(days => ${dias})`)
    .where(sql<boolean>`inicio_el < now()`)
    .executeTakeFirst();

  const citas = Number(fila?.citas ?? 0);
  const canceladas = Number(fila?.canceladas ?? 0);
  const congeladas = Number(fila?.congeladas ?? 0);
  const reagendadas = Number(fila?.reagendadas ?? 0);
  const conFechaDeReserva = Number(fila?.con_reserva ?? 0);
  const horas = fila?.horas ?? null;
  const conAsistencia = Number(fila?.con_asistencia ?? 0);
  const sePresentaron = Number(fila?.se_presentaron ?? 0);
  const descCitas = Number(fila?.desc_citas ?? 0);
  const descCanceladas = Number(fila?.desc_canceladas ?? 0);

  /* El no-show sale de OTRA tabla y por eso es una consulta aparte: lo reporta el closer al cerrar
     un intento, no el calendario. Va dentro de la misma transacción igual. */
  const ns = await datos()
    .selectFrom('resultados')
    .select(sql<number>`count(*)`.as('n'))
    .where('salida', '=', 'no_show')
    .where(sql<boolean>`creado_el >= now() - make_interval(days => ${dias})`)
    .executeTakeFirst();

  const conf = await confirmacionEnLaVentana(dias);

  return {
    citas,
    canceladas,
    congeladas,
    /* Sin citas NO hay tasa. Un `0 %` con cero citas se lee como «no se cancela ninguna», que es una
       afirmación sobre el negocio hecha con cero datos — el cero indistinguible que este proyecto
       persigue en todas partes. */
    tasa: citas === 0 ? null : Math.round((canceladas / citas) * 1000) / 10,
    aviso: avisoDe(citas, congeladas, dias),
    dias,
    desde: fila?.desde ?? null,
    mitad: fila?.mitad ?? null,
    avisoDeLaVentana: avisoDeLaCola(
      fila?.proporcion === null || fila?.proporcion === undefined
        ? null
        : Number(fila.proporcion),
      fila?.mitad ?? null,
      'la mitad de las citas ocurrió',
    ),
    reagendadas,
    tasaDeReagendamiento: citas === 0 ? null : Math.round((reagendadas / citas) * 1000) / 10,
    /* Sin ninguna cita con fecha de reserva no hay mediana, y se dice con `null`. Un cero acá
       significaría «se reservan y ocurren en el mismo instante», que es una afirmación. */
    horasHastaLaCita: horas === null ? null : Math.round(Number(horas) * 10) / 10,
    conFechaDeReserva,
    noShowReportado: Number(ns?.n ?? 0),
    conAsistencia,
    sePresentaron,
    /* Por debajo del piso NO hay tasa, y eso no es prudencia: es la diferencia entre decir «no sé
       todavía» y afirmar un porcentaje que el próximo registro mueve diez puntos. La pantalla
       dibuja el conteo mientras tanto. */
    tasaDeAsistencia:
      conAsistencia < PISO_DE_UNA_TASA
        ? null
        : Math.round((sePresentaron / conAsistencia) * 1000) / 10,
    avisoDeAsistencia: avisoDeLaAsistencia(citas, conAsistencia, dias),
    conConfirmacion: conf.conConfirmacion,
    confirmaron: conf.confirmaron,
    /* Mismo piso que la asistencia, y por el mismo motivo: no es el volumen de citas lo que decide,
       es el de RESPUESTAS. Con 139 citas y 3 campos respondidos la muestra son 3. */
    tasaDeConfirmacion:
      conf.conConfirmacion < PISO_DE_UNA_TASA
        ? null
        : Math.round((conf.confirmaron / conf.conConfirmacion) * 1000) / 10,
    avisoDeConfirmacion: avisoDeLaConfirmacion(conf.hayCampo, conf.conCita, conf.conConfirmacion),
    descartados: {
      citas: descCitas,
      canceladas: descCanceladas,
      /* Con el mismo piso que todo lo demás: si un día hay dos citas descartadas, un «100 %» al
         lado de la cifra buena invitaría a compararlas, y esta población no está para eso. */
      tasa:
        descCitas < PISO_DE_UNA_TASA
          ? null
          : Math.round((descCanceladas / descCitas) * 1000) / 10,
    },
  };
}

/**
 * Qué decir de la asistencia, y cuándo callarse. Mismos tres estados que `avisoDe`, otra pregunta.
 *
 * El primero es el que más importa y es el que va a estar encendido al principio: **nadie contestó
 * todavía**. Sin esa frase, una tarjeta vacía se lee como «no se presentó nadie», que es el mismo
 * cero indistinguible que este archivo persigue en la tasa de cancelación.
 *
 * Y dice de cuántas citas se está hablando, porque «0 respuestas» sobre 0 citas y sobre 151 citas
 * mandan a hacer cosas distintas: una es esperar y la otra es preguntarle al closer por qué no
 * cierra sus intentos.
 */
function avisoDeLaAsistencia(citas: number, conAsistencia: number, dias: number): string | null {
  if (citas === 0) return null; // Ya lo dijo `avisoDe`. Repetirlo con otras palabras es ruido.
  if (conAsistencia === 0) {
    return `Nadie registró todavía si el contacto se presentó, en ninguna de las ${citas} citas de ` +
      `los últimos ${dias} días. Se pregunta al cerrar el intento en Avanzar, y antes de eso no ` +
      'existía: el CRM tiene ese campo en 3 de 1052 citas.';
  }
  if (conAsistencia < PISO_DE_UNA_TASA) {
    return `Sólo ${conAsistencia} de ${citas} citas tienen la asistencia registrada. Con menos de ` +
      `${PISO_DE_UNA_TASA} no se muestra una tasa: cada registro nuevo la movería más de diez ` +
      'puntos, y quien contestó no es una muestra al azar de las demás.';
  }
  return null;
}

/**
 * Qué advertir, y **cuándo callarse**.
 *
 * Tres estados y no dos, en este orden:
 *
 *   1 · Sin citas alcanzables: no hay cifra, y hay que decir por qué o el vacío se lee como un cero.
 *   2 · Con citas congeladas en la ventana: la cifra vale, y hay que decir sobre cuántas NO se contó.
 *   3 · Todo lo demás: **`null`**, y la pantalla no dibuja nada.
 *
 * El tercero es el que hace que los otros dos signifiquen algo. Hoy hay congeladas y el aviso
 * aparece; el día que dejen de caer en la ventana —porque son todas anteriores al 2026-09-10— el
 * aviso desaparece solo, sin que nadie tenga que acordarse de sacarlo.
 */
function avisoDe(citas: number, congeladas: number, dias: number): string | null {
  if (citas === 0) {
    return congeladas > 0
      ? `No hay citas de los últimos ${dias} días que el sistema pueda seguir. Las ${congeladas} que ` +
          'hay quedaron congeladas: el CRM ya no devuelve sus eventos, así que su estado no cambia.'
      : `No hubo citas en los últimos ${dias} días, así que no hay tasa que calcular.`;
  }
  if (congeladas > 0) {
    return `No se cuentan ${congeladas} cita(s) de este período: quedaron congeladas y el CRM ya no ` +
      'devuelve sus eventos, así que contarlas mezclaría una foto vieja con el dato de hoy.';
  }
  return null;
}
