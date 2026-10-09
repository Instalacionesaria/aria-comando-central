// Los bordes de una ventana del sistema en DÍAS CERRADOS: la regla de Acquisition, compartida.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO VIVE APARTE
//
// La regla nació en Acquisition, decidida por el usuario el 2026-09-30 (A14-10 de
// `docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`), y vivía dentro de `lecturaDeAcquisition`. El
// 2026-10-08 se tomó por defecto que Conversion pase a la misma regla (CV15-04, CV15-21 y `CV15-P01` de
// `docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`), y la condición es que las dos pantallas corten
// **los mismos días**: con la misma ventana, la cohorte de Conversion es exactamente el `cobertura.sobre` de
// Acquisition. Una copia de este cálculo divergiría el primer día que alguien arregle un borde en una sola, y
// las dos pantallas dirían «30 días» sobre gente distinta. Por eso se mudó, y no se copió.
//
// ── LO QUE DICE CADA PERÍODO ────────────────────────────────────────────────
//
//   · **«7 días» y «30 días» son días CERRADOS**: los `dias` días completos hasta el último día cerrado de la
//     serie de gasto de la cuenta (`estadoDeLaSerie`): el último anterior a hoy cuyo total se releyó después
//     de la medianoche siguiente de la empresa. El colector lee la serie a las 06:17 UTC, así que hasta esa
//     pasada ayer todavía es la foto de la madrugada; en una empresa al oeste de UTC−6 ni la pasada del día
//     siguiente lo cierra —su medianoche cae después de las 06:17 UTC—, y el último cerrado es anteayer o el
//     anterior: la ventana termina ahí;
//   · **«Hoy» es hoy**, a medias;
//   · **«Completo»** empieza en el dato más viejo —el primer día de gasto guardado o el que aporte la pantalla
//     (`primerDatoPropio`)— y termina hoy.
//
// **El colector atrasado** —la serie sin leer hace más de 26 horas, o su último día cerrado de hace más de
// tres— no deja cerrar ningún día: en «7 días» y «30 días» la ventana termina ayer igual, y cada pantalla decide
// qué deja de comparar.
// Sin gasto guardado no hay nada que esperar: ayer está cerrado.
//
// Las fechas salen de la base y viajan como texto: `current_date` es el de la base, y un `date` que pasa por
// un `Date` de JavaScript se corre un día al este de Greenwich (ver `comoDiaLocal` en
// `recolectarAnuncios.ts`).
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { estadoDeLaSerie } from './gastoDeLaCuenta.ts';
import type { ClaveDePeriodo } from './periodo.ts';

/** Días de calendario `[desde, hasta]`, los dos incluidos, como texto `YYYY-MM-DD`. */
export interface DiasDeCalendario {
  desde: string;
  hasta: string;
}

export interface BordesDelPeriodo {
  /** La ventana del período. */
  ventana: DiasDeCalendario;
  /**
   * La del mismo largo, justo antes. **Candidata**: existe para todos los períodos, y si se compara contra
   * ella lo decide cada pantalla, que sabe qué datos tiene que estar enteros.
   */
  anteriorCandidata: DiasDeCalendario;
  /**
   * El último día cerrado, recortado al final de la ventana. En «7 días» y «30 días» es `hasta`; en «Completo»,
   * ayer o antes, porque hoy a medias no cuenta; en «Hoy» cae ANTES de la ventana: adentro no hay ningún día
   * cerrado.
   */
  cierre: string;
  /** Cuántos días van del comienzo de la ventana al `cierre`, los dos incluidos. En «Hoy», cero o menos. */
  diasHastaElCierre: number;
  /** Cuántos días tiene la ventana. En «Completo» depende del primer dato. */
  dias: number;
  /** `true` en «7 días» y «30 días». */
  cerrados: boolean;
  /**
   * La serie de gasto no se lee o no cierra días. En «7 días» y «30 días» la ventana termina ayer igual; en «Hoy»
   * y «Completo», que terminan hoy, el `cierre` queda en ayer.
   */
  colectorAtrasado: boolean;
}

/**
 * Los bordes de un período, con la regla de los días cerrados. Corre dentro de `conOrganizacion`.
 *
 * @param zona La de la empresa (`identidad.organizaciones.zona_horaria`): cuándo termina su día.
 * @param primerDatoPropio El primer día que la pantalla misma tiene guardado —en Acquisition, el primer
 *   contacto con campaña; en Conversion, el primer contacto—. Sólo mueve el comienzo de «Completo».
 */
export async function bordesDelPeriodo(
  periodo: { clave: ClaveDePeriodo; dias: number },
  zona: string,
  primerDatoPropio: string | null,
): Promise<BordesDelPeriodo> {
  const d = periodo.dias;
  const cerrados = periodo.clave === '7d' || periodo.clave === '30d';
  const completo = periodo.clave === 'completo';

  const serie = await estadoDeLaSerie(zona);
  const primerDato =
    [serie.primerDato, primerDatoPropio].filter((x): x is string => x !== null).sort()[0] ?? null;
  const colectorAtrasado = serie.atrasado;
  const ultimoCerrado = !serie.hayDatos || colectorAtrasado ? null : serie.ultimoCerrado;

  const bordes = await sql<{
    desde: string;
    hasta: string;
    ant_desde: string;
    ant_hasta: string;
    cierre: string;
    dias_hasta_el_cierre: number;
    dias: number;
  }>`
    select to_char(x.desde, 'YYYY-MM-DD') as desde,
           to_char(x.hasta, 'YYYY-MM-DD') as hasta,
           to_char(x.desde - (x.hasta - x.desde + 1), 'YYYY-MM-DD') as ant_desde,
           to_char(x.desde - 1, 'YYYY-MM-DD') as ant_hasta,
           to_char(least(x.hasta, x.cierre), 'YYYY-MM-DD') as cierre,
           (least(x.hasta, x.cierre) - x.desde + 1)::int as dias_hasta_el_cierre,
           (x.hasta - x.desde + 1)::int as dias
      from (select case when ${completo} then coalesce(${primerDato}::date, current_date)
                        when ${cerrados} then coalesce(${ultimoCerrado}::date, current_date - 1) - ${d - 1}::int
                        else current_date end as desde,
                   case when ${cerrados} then coalesce(${ultimoCerrado}::date, current_date - 1)
                        else current_date end as hasta,
                   coalesce(${ultimoCerrado}::date, current_date - 1) as cierre) as x`.execute(datos());
  const b = bordes.rows[0]!;
  return {
    ventana: { desde: b.desde, hasta: b.hasta },
    anteriorCandidata: { desde: b.ant_desde, hasta: b.ant_hasta },
    cierre: b.cierre,
    diasHastaElCierre: Number(b.dias_hasta_el_cierre),
    dias: Number(b.dias),
    cerrados,
    colectorAtrasado,
  };
}
