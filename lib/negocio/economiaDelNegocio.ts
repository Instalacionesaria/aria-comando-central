// La economía del mes: lo vendido contra lo invertido en anuncios, con el retorno y el costo por venta.
// Para el cerebro (`docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-42; A7-08 la asigna a Executive).
//
// ═══════════════════════════════════════════════════════════════════════════════
// NO SE CALCULA NADA QUE NO EXISTA YA
//
// Las dos mitades salen de las funciones de sus pantallas, y ésa es la razón de este archivo:
//   · lo vendido, de `dineroDelMes` con el sujeto de Sales (`app/api/sales/route.ts`): los closers de
//     la empresa. Es **venta reportada** por el closer al cerrar la cita, no un pago verificado;
//   · lo invertido, de `cifrasPorCampana`, la misma lectura del gasto que los funnels de Acquisition
//     (C7-07): la suma de `metricas_de_anuncio` de las campañas, en los días del mes.
//
// Los dos hablan del MISMO mes: el calendario de la empresa, con la misma expresión que `dineroDelMes`
// (`date_trunc('month', timezone(zona, now()))`), calculada por la base y no por la aplicación.
//
// ── LO QUE NO SE PUEDE DECIR ─────────────────────────────────────────────────
//
// El retorno y el costo por venta se publican sólo si las dos mitades están enteras. Si no, son `null` y el
// aviso dice por qué (la revisión de AG6 encontró los tres casos):
//   · **cero ventas**: «no hay dato suficiente», y dónde se registran;
//   · **una venta sin monto**: el cobrado de `dineroDelMes` la suma como cero, así que el retorno saldría
//     más bajo —o en cero—, sin que nada lo dijera (`ventasDelContacto.ts` advierte contra ese mismo `?? 0`);
//   · **el gasto del mes incompleto**: un día del mes, antes de hoy, sin ninguna fila de métricas, o el
//     colector sin escribir hace más de 26 horas —el mismo umbral que Acquisition—. El colector escribe una
//     fila por anuncio y por día aunque no haya entregado, así que un día sin filas es un día que nadie pidió,
//     y su gasto faltaría en el denominador.
// Además, los últimos días leídos pueden estar a medias: el colector lee un día de madrugada y lo relee en la
// pasada siguiente, y al oeste de UTC−6 ni eso lo cierra (`embudosDeAcquisition.ts`, el último día cerrado).
// Eso va en la nota y no en el aviso: es cierto siempre, y un aviso que aparece siempre se aprende a ignorar.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { closersDeLaEmpresa } from './alcanceDelCloser.ts';
import { dineroDelMes, type Indicador } from './dineroDelMes.ts';
import { cifrasPorCampana } from './embudosDeAcquisition.ts';

export interface EconomiaDelNegocio {
  /** El mes, como lo escribe `dineroDelMes`. */
  mes: string;
  /** Los días del mes que se leyeron: del primero a hoy, en la zona de la empresa. */
  desde: string;
  hasta: string;
  cobrado: Indicador;
  ventas: Indicador;
  /** La inversión en anuncios del mes. `valor: null` si no hay ningún gasto guardado. */
  inversion: Indicador;
  /** El último día del mes con gasto leído, de las mismas filas que la inversión. `null` sin gasto. */
  gastoHasta: string | null;
  /** Ventas del mes registradas sin monto: con alguna, no hay retorno. */
  ventasSinMonto: number;
  /** Si el gasto del mes está entero hasta ayer y el colector está al día. */
  gastoEntero: boolean;
  /** Cobrado / inversión. `null` si falta cualquiera de las dos mitades, con el motivo en `aviso`. */
  retorno: number | null;
  /** Inversión / ventas. `null` en los mismos casos. */
  costoPorVenta: number | null;
  aviso: string | null;
  nota: string;
}

export const NOTA_DE_LA_ECONOMIA =
  'Mes calendario en curso. Las ventas son las que reportan los closers al cerrar la cita, no pagos ' +
  'verificados; la inversión es el gasto de los anuncios de Meta, como en Acquisition, hasta el último día ' +
  'leído (gastoHasta). Los últimos días leídos pueden estar a medias.';

const redondear = (v: number) => Math.round(v * 100) / 100;

/** **Corre dentro de `conOrganizacion(`.** */
export async function economiaDelNegocio(zona: string): Promise<EconomiaDelNegocio> {
  // El mismo sujeto que arma la ruta de Sales: los closers de la empresa, o nadie.
  const catalogo = await closersDeLaEmpresa();
  const sujeto =
    catalogo.length === 0 ? ({ tipo: 'nadie' } as const) : ({ tipo: 'empresa', usuarioIds: catalogo.map((k) => k.usuarioId) } as const);
  const dinero = await dineroDelMes(zona, sujeto);

  const bordes = await sql<{ desde: string; hasta: string }>`
    select to_char(date_trunc('month', timezone(${zona}, now()))::date, 'YYYY-MM-DD') as desde,
           to_char(timezone(${zona}, now())::date, 'YYYY-MM-DD') as hasta`.execute(datos());
  const { desde, hasta } = bordes.rows[0]!;

  const porCampana = await cifrasPorCampana(desde, hasta);
  const inversionTotal = redondear([...porCampana.values()].reduce((s, c) => s + c.inversion, 0));
  /* Las mismas filas que suma `cifrasPorCampana`: las de anuncios con campaña. Con otro filtro, `gastoHasta`
     podría tener fecha junto a una inversión de cero, y los dos se contradirían. */
  const gasto = await sql<{ dia: string | null; dias_con_filas: string; dias_previos: number; atrasado: boolean }>`
    select to_char(max(m.fecha) filter (where m.gasto is not null and a.meta_campana_id is not null), 'YYYY-MM-DD') as dia,
           (select count(distinct x.fecha) from negocio.metricas_de_anuncio x
             where x.fecha >= ${desde}::date and x.fecha < ${hasta}::date) as dias_con_filas,
           (${hasta}::date - ${desde}::date) as dias_previos,
           coalesce((select max(sincronizado_el) from negocio.metricas_de_anuncio) < now() - interval '26 hours', true) as atrasado
      from negocio.metricas_de_anuncio m
      join negocio.anuncios a on a.org_id = m.org_id and a.meta_anuncio_id = m.meta_anuncio_id
     where m.fecha between ${desde}::date and ${hasta}::date`.execute(datos());
  const g = gasto.rows[0]!;
  const gastoHasta = g.dia;
  const gastoEntero = !g.atrasado && Number(g.dias_con_filas) === Number(g.dias_previos);

  // Las ventas sin monto, con el mismo filtro que `dineroDelMes`: las del mes, de los closers de la empresa.
  const deQuien = sujeto.tipo === 'empresa' ? sujeto.usuarioIds : [];
  const sinMonto =
    deQuien.length === 0
      ? 0
      : Number(
          (
            await datos()
              .selectFrom('resultados')
              .where('creado_el', '>=', sql<Date>`date_trunc('month', timezone(${zona}, now())) at time zone ${zona}`)
              .where('registrado_por', 'in', deQuien)
              .where('salida', '=', 'venta')
              .where('monto', 'is', null)
              .select(sql<string>`count(*)`.as('n'))
              .executeTakeFirstOrThrow()
          ).n,
        );

  const inversion: Indicador =
    gastoHasta === null
      ? { valor: null, falta: 'No hay gasto de anuncios guardado este mes: se lee de Meta cada mañana, desde Integraciones.' }
      : { valor: inversionTotal };

  const ventas = dinero.ventas.valor;
  const cobrado = dinero.cobrado.valor;
  let aviso: string | null = null;
  let retorno: number | null = null;
  let costoPorVenta: number | null = null;
  if (ventas === null || ventas === 0) {
    aviso =
      'No hay dato suficiente para el retorno ni el costo por venta: este mes no hay ventas registradas. ' +
      'Se registran en Sales · Closer, cita por cita.';
  } else if (inversion.valor === null || inversion.valor === 0) {
    aviso = 'No hay inversión guardada este mes, así que no hay retorno ni costo por venta que calcular.';
  } else if (!gastoEntero) {
    aviso =
      'El gasto del mes no está entero (falta algún día, o la lectura de Meta está atrasada): no hay retorno ' +
      'ni costo por venta hasta que se complete. Se mira en Integraciones y en la frescura de los anuncios.';
  } else if (sinMonto > 0) {
    aviso =
      `${sinMonto === 1 ? 'Una venta del mes se registró' : `${sinMonto} ventas del mes se registraron`} sin monto: ` +
      'el cobrado está incompleto, así que no hay retorno ni costo por venta. El monto se carga en Sales · Closer.';
  } else {
    retorno = cobrado === null ? null : redondear(cobrado / inversion.valor);
    costoPorVenta = redondear(inversion.valor / ventas);
  }

  return {
    mes: dinero.mes,
    desde,
    hasta,
    cobrado: dinero.cobrado,
    ventas: dinero.ventas,
    inversion,
    gastoHasta,
    ventasSinMonto: sinMonto,
    gastoEntero,
    retorno,
    costoPorVenta,
    aviso,
    nota: NOTA_DE_LA_ECONOMIA,
  };
}
