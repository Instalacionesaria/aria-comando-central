// El gasto de TODA la cuenta (`076`) y si el gasto por anuncio cuadra con él: lo que comparten Acquisition, la economía
// y los detectores para saber si una ventana tiene el gasto entero, y por qué no.
//
// ═══════════════════════════════════════════════════════════════════════════════
// «COMPLETO» QUIERE DECIR «CUADRA CON LA CUENTA», NO «EL DÍA TIENE FILAS»
//
// Hasta el 2026-10-07 un día de gasto estaba completo si tenía alguna fila de métricas. Así se escondió la
// fuga: el colector de GoHighLevel pedía 13 de las 61 campañas, y la única que gastó —una campaña de mensajes,
// sin contactos atribuidos— no entraba nunca. La app decía 0 en 7 días y el Administrador de anuncios 200,19.
//
// La referencia es el total diario de la cuenta (`gasto_de_la_cuenta`). Un día está completo cuando tiene su total,
// releído después de terminar, y la suma por anuncio lo explica.
//
// Desde Meta directo (M3) las dos mitades salen de la misma pasada de la Marketing API —el total por cuenta
// publicitaria y el detalle por anuncio—, así que un día que Meta devolvió llega con las dos. El cuadre queda como
// control: un día que no cuadra es un anuncio que Meta no dio en el detalle, y la pantalla lo dice en vez de mostrar
// un gasto corto. Lo que hacía el colector de GoHighLevel para cuadrar —pedir por campaña, por rango y por día,
// redescubrir y declarar residuos (`lecturas_de_gasto`)— se retiró con su lectura (M5); `residuo_el` sólo queda en
// los días que declaró antes.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql, type RawBuilder } from 'kysely';
import { datos } from '../datos/contexto.ts';

/**
 * Cuánto puede diferir, en un día, la suma por anuncio del total de la cuenta y seguir contando como igual.
 *
 * Medido el 2026-10-07: la campaña de mensajes del 30-sep al 6-oct suma 200,19 por anuncio y la serie 200,19
 * para la cuenta; del 7-sep al 6-oct la serie suma 2.234,55, igual al Administrador de anuncios. Al centavo.
 * Lo que queda es el redondeo: Meta manda el gasto de cada anuncio con dos decimales, así que la suma de N
 * anuncios puede alejarse medio centavo por anuncio del total redondeado. Diez centavos cubren veinte anuncios
 * con entrega en un día.
 */
export const TOLERANCIA_DEL_CUADRE = 0.1;

// ─── Las lecturas de cobertura ───────────────────────────────────────────────

/** Por qué el gasto de una ventana no está entero. */
export type MotivoDelGasto =
  /** La serie de la cuenta no se lee hace más de 26 horas, o su último día cerrado quedó más de tres días atrás. */
  | 'colector_atrasado'
  /** A algún día de la ventana le falta el total de la cuenta, o no se releyó después de terminar. */
  | 'dias_sin_leer'
  /** Todos los días tienen su total, y en alguno el detalle por campaña no lo explica todavía. */
  | 'no_cuadra';

/**
 * Cómo está la serie de la cuenta: lo que necesita el borde de las ventanas cerradas.
 *
 *   · `ultimoCerrado`: el último día anterior a hoy cuyo total se releyó después de la medianoche siguiente de
 *     la empresa. Es la misma regla que antes se medía sobre las métricas, ahora sobre la serie;
 *   · `atrasado`: la serie no se lee hace más de 26 horas —una pasada diaria perdida, con dos de margen—, o su
 *     último día cerrado tiene más de tres días;
 *   · `primerDato`: el día más viejo de la serie o de las métricas.
 *
 * Una empresa con métricas guardadas y sin serie es una que todavía no corrió la pasada nueva: cuenta como
 * atrasada, porque sus métricas solas ya no dicen si el día está completo.
 *
 * Con varios clientes (el nivel 3), cada uno tiene su cuenta de Meta y su serie: el último día cerrado es el del
 * cliente más atrasado —el borde que valen TODOS—, y la serie está atrasada si la de alguno lo está, o si alguno tiene
 * métricas y ninguna serie. **Sólo los clientes ACTIVOS**, como la frescura (el peor activo): uno en pausa o de baja
 * deja de leerse, y su serie vieja dejaba a la empresa entera atrasada —y la ventana clavada en su último día— para
 * siempre. Con un solo cliente es lo de siempre: el principal está siempre activo (`085`).
 */
export async function estadoDeLaSerie(zona: string): Promise<{
  hayDatos: boolean;
  ultimoCerrado: string | null;
  atrasado: boolean;
  primerDato: string | null;
}> {
  const r = await sql<{
    hay_serie: boolean;
    hay_metricas: boolean;
    ultimo_cerrado: string | null;
    serie_atrasada: boolean;
    metricas_sin_serie: boolean;
    primer_dato: string | null;
  }>`
    with activos as (
      select id from identidad.cuentas where estado = 'activa'
    ),
    por_cliente as (
      select cuenta_id,
             max(fecha) filter (where fecha < current_date
                                  and leido_el >= ((fecha + 1)::timestamp at time zone ${zona})) as ultimo_cerrado,
             max(leido_el) as ultima_lectura
        from negocio.gasto_de_la_cuenta
       where cuenta_id in (select id from activos)
       group by cuenta_id
    )
    select exists (select 1 from negocio.gasto_de_la_cuenta) as hay_serie,
           exists (select 1 from negocio.metricas_de_anuncio) as hay_metricas,
           to_char((select min(ultimo_cerrado) from por_cliente), 'YYYY-MM-DD') as ultimo_cerrado,
           coalesce((select bool_or(ultima_lectura < now() - interval '26 hours'
                                    or coalesce(ultimo_cerrado < current_date - 3, false))
                       from por_cliente), false) as serie_atrasada,
           exists (select 1 from activos a
                    where exists (select 1 from negocio.metricas_de_anuncio m where m.cuenta_id = a.id)
                      and not exists (select 1 from negocio.gasto_de_la_cuenta g where g.cuenta_id = a.id)) as metricas_sin_serie,
           to_char(least((select min(fecha) from negocio.gasto_de_la_cuenta),
                         (select min(fecha) from negocio.metricas_de_anuncio)), 'YYYY-MM-DD') as primer_dato`.execute(
    datos(),
  );
  const f = r.rows[0]!;
  const hayDatos = f.hay_serie || f.hay_metricas;
  return {
    hayDatos,
    ultimoCerrado: f.hay_serie ? f.ultimo_cerrado : null,
    atrasado: hayDatos && (f.serie_atrasada || f.metricas_sin_serie),
    primerDato: f.primer_dato,
  };
}

/**
 * Si el gasto de una ventana `[desde, hasta]` de `dias` días está entero, y cuánto dice la cuenta.
 *
 * Entero es: cada día tiene su total, releído después de terminar en la zona de la empresa, y el detalle por
 * campaña lo explica —cuadra, o es un residuo declarado—. Los tres ceros se distinguen así: el medido (la cuenta
 * dijo 0), el no pedido (no hay fila de la cuenta: `dias_sin_leer`) y el parcial (la cuenta dice 200 y por
 * campaña se leyó 0: `no_cuadra`).
 *
 * `deLaCuenta` es la suma de la serie cuando TODOS los días tienen fila, aunque alguno no esté cerrado o no
 * cuadre: es lo que Meta cobró, y es mejor cifra que la suma de lo que se alcanzó a leer por campaña.
 *
 * Con varios clientes (el nivel 3), todo es POR CLIENTE: su serie se cuadra con el detalle de SUS anuncios, y la
 * ventana está entera cuando lo está la de cada cliente con serie. Cruzado sólo por fecha, el total de un cliente se
 * comparaba con el detalle de todos y ningún día cuadraba nunca.
 *
 * A un cliente que ya no está ACTIVO —en pausa o de baja: deja de leerse, como en `estadoDeLaSerie`— se le pide la
 * serie sólo hasta su último día cerrado: lo que tenga después —el día de la pausa, leído a medias— se suma a
 * `deLaCuenta`, como lo suman sus campañas, pero no se le exige. Si no, la serie que se corta a mitad de la ventana
 * dejaba a la empresa sin el gasto entero —sin costos ni flechas, y lo que sólo lee Meta sin medir— hasta que la
 * ventana dejara atrás ese día: una semana en «7 días», un mes en «30 días». Con un solo cliente es lo de siempre: el
 * principal está siempre activo (`085`).
 */
export async function coberturaDelGasto(
  desde: string,
  hasta: string,
  dias: number,
  zona: string,
): Promise<{ entero: boolean; motivo: MotivoDelGasto | null; deLaCuenta: number | null }> {
  const r = await sql<{ con_serie: boolean; faltan_filas: boolean; faltan_cerrados: boolean; faltan_enteros: boolean; de_la_cuenta: string | null }>`
    with detalle as (
      select m.cuenta_id, m.fecha, sum(m.gasto) as detalle
        from negocio.metricas_de_anuncio m
        join negocio.anuncios a on a.org_id = m.org_id and a.meta_anuncio_id = m.meta_anuncio_id
       where m.fecha between ${desde}::date and ${hasta}::date
         and a.meta_campana_id is not null
       group by m.cuenta_id, m.fecha
    ),
    serie as (
      select s.cuenta_id, s.fecha, s.gasto, s.residuo_el,
             s.leido_el >= ((s.fecha + 1)::timestamp at time zone ${zona}) as cerrado,
             abs(round(coalesce(s.gasto, 0) * 100) - round(coalesce(d.detalle, 0) * 100))
               <= ${Math.round(TOLERANCIA_DEL_CUADRE * 100)} as cuadra
        from negocio.gasto_de_la_cuenta s
        left join detalle d on d.cuenta_id = s.cuenta_id and d.fecha = s.fecha
       where s.fecha between ${desde}::date and ${hasta}::date
    ),
    /* Hasta dónde se le pide la serie a cada cliente: a uno activo, la ventana entera; a uno que ya no lo está, hasta
       su último día cerrado (de toda su serie, no sólo de la ventana). */
    tope as (
      select g.cuenta_id, coalesce(c.estado, 'activa') = 'activa' as activo,
             case when coalesce(c.estado, 'activa') = 'activa' then ${hasta}::date
                  else least(${hasta}::date,
                             max(g.fecha) filter (where g.leido_el >= ((g.fecha + 1)::timestamp at time zone ${zona})))
             end as hasta
        from negocio.gasto_de_la_cuenta g
        left join identidad.cuentas c on c.id = g.cuenta_id
       where g.cuenta_id in (select cuenta_id from serie)
       group by g.cuenta_id, c.estado
    ),
    por_cliente as (
      select count(*) filter (where s.fecha <= t.hasta) as con_serie,
             count(*) filter (where s.fecha <= t.hasta and cerrado) as cerrados,
             count(*) filter (where s.fecha <= t.hasta and cerrado and (cuadra or residuo_el is not null)) as enteros,
             sum(gasto) as gasto,
             -- Los días que se le piden: todos a uno activo; a uno que ya no lo está, del primero de la ventana a su tope.
             case when t.activo then ${dias}::int
                  else least(${dias}::int, greatest(0, coalesce(t.hasta - ${desde}::date + 1, 0))) end as pedidos
        from serie s
        join tope t on t.cuenta_id = s.cuenta_id
       group by s.cuenta_id, t.activo, t.hasta
    )
    select count(*) > 0 as con_serie,
           coalesce(bool_or(con_serie < pedidos), false) as faltan_filas,
           coalesce(bool_or(cerrados < pedidos), false) as faltan_cerrados,
           coalesce(bool_or(enteros < pedidos), false) as faltan_enteros,
           sum(gasto) as de_la_cuenta
      from por_cliente`.execute(datos());
  const f = r.rows[0]!;
  /* `dias > 0`: una ventana de cero días —«Completo» con el primer dato de hoy, que todavía no tiene ningún día
     cerrado— daría cero de cero y pasaría sin haber mirado nada. Sin ninguna fila en la ventana, falta todo. */
  const motivo: MotivoDelGasto | null =
    dias <= 0 || !f.con_serie || f.faltan_filas || f.faltan_cerrados
      ? 'dias_sin_leer'
      : f.faltan_enteros
        ? 'no_cuadra'
        : null;
  return {
    entero: motivo === null,
    motivo,
    deLaCuenta: dias > 0 && f.con_serie && !f.faltan_filas ? Math.round(Number(f.de_la_cuenta ?? 0) * 100) / 100 : null,
  };
}

/**
 * Cuántos días de una ventana tienen el total de la cuenta y un detalle por campaña que no lo explica, sin estar
 * declarados residuo. La ventana la da quien llama, con su propio predicado sobre `fecha`: Creative usa una
 * ventana móvil hasta hoy (`ventanaDeMetricas`) y no días cerrados, y una segunda copia de su predicado acá
 * podría separarse de la que imprime su encabezado.
 *
 * Un día sin total no cuenta: de él no se puede decir que no cuadre. Lo dice el aviso de la ventana incompleta.
 *
 * Por cliente (el nivel 3): cada serie con el detalle de sus anuncios, y un día cuenta una vez aunque no cuadre en
 * dos clientes.
 */
export async function diasSinCuadrar(enLaVentana: (alias: string) => RawBuilder<boolean>): Promise<number> {
  const r = await sql<{ n: string }>`
    with detalle as (
      select m.cuenta_id, m.fecha, sum(m.gasto) as detalle
        from negocio.metricas_de_anuncio m
        join negocio.anuncios a on a.org_id = m.org_id and a.meta_anuncio_id = m.meta_anuncio_id
       where ${enLaVentana('m')}
         and a.meta_campana_id is not null
       group by m.cuenta_id, m.fecha
    )
    select count(distinct g.fecha) as n
      from negocio.gasto_de_la_cuenta g
      left join detalle d on d.cuenta_id = g.cuenta_id and d.fecha = g.fecha
     where ${enLaVentana('g')}
       and g.residuo_el is null
       and abs(round(coalesce(g.gasto, 0) * 100) - round(coalesce(d.detalle, 0) * 100))
           > ${Math.round(TOLERANCIA_DEL_CUADRE * 100)}`.execute(datos());
  return Number(r.rows[0]?.n ?? 0);
}

/**
 * QUIÉNES dejan el gasto de una ventana `[desde, hasta]` sin entero (el nivel 3, C6): los ids de los clientes cuya serie
 * está atrasada o falta —con las reglas de `estadoDeLaSerie`: sólo los ACTIVOS, sin leer hace más de 26 horas, con su
 * último día cerrado de hace más de tres, o con métricas y ninguna serie— y los que tienen algún día de la ventana sin
 * su total cerrado, con las reglas de `coberturaDelGasto` (a uno que ya no está activo, sólo hasta su último cerrado).
 *
 * Es la lista hermana de esas dos, que dicen SI el gasto está entero para toda la empresa; ésta dice de quién es lo que
 * falta, para que la nota lo nombre. Un cliente que vincula Meta y lo pierde deja de escribir su serie: a las 26 horas
 * la empresa queda con el colector atrasado, pero en la ventana todavía tiene días de su serie, así que
 * `pautaSinLeerEn` no lo lista y sólo esta lista lo encuentra; lo mismo uno con métricas viejas y ninguna serie, que deja
 * la ventana entera y la empresa atrasada. El que no cuadra (`no_cuadra`) no está: su total está, y lo que falta lo
 * relee la pasada diaria de Meta, que vuelve sobre los últimos 28 días. Corre dentro de `conOrganizacion`.
 */
export async function clientesConLaSerieIncompleta(desde: string, hasta: string, dias: number, zona: string): Promise<string[]> {
  const r = await sql<{ cuenta_id: string }>`
    with activos as (
      select id from identidad.cuentas where estado = 'activa'
    ),
    atrasados as (
      select cuenta_id
        from negocio.gasto_de_la_cuenta
       where cuenta_id in (select id from activos)
       group by cuenta_id
      having max(leido_el) < now() - interval '26 hours'
          or coalesce(max(fecha) filter (where fecha < current_date
                                           and leido_el >= ((fecha + 1)::timestamp at time zone ${zona})) < current_date - 3,
                      false)
    ),
    metricas_sin_serie as (
      select a.id as cuenta_id from activos a
       where exists (select 1 from negocio.metricas_de_anuncio m where m.cuenta_id = a.id)
         and not exists (select 1 from negocio.gasto_de_la_cuenta g where g.cuenta_id = a.id)
    ),
    serie as (
      select s.cuenta_id, s.fecha, s.leido_el >= ((s.fecha + 1)::timestamp at time zone ${zona}) as cerrado
        from negocio.gasto_de_la_cuenta s
       where s.fecha between ${desde}::date and ${hasta}::date
    ),
    tope as (
      select g.cuenta_id, coalesce(c.estado, 'activa') = 'activa' as activo,
             case when coalesce(c.estado, 'activa') = 'activa' then ${hasta}::date
                  else least(${hasta}::date,
                             max(g.fecha) filter (where g.leido_el >= ((g.fecha + 1)::timestamp at time zone ${zona})))
             end as hasta
        from negocio.gasto_de_la_cuenta g
        left join identidad.cuentas c on c.id = g.cuenta_id
       where g.cuenta_id in (select cuenta_id from serie)
       group by g.cuenta_id, c.estado
    ),
    faltan as (
      select s.cuenta_id
        from serie s
        join tope t on t.cuenta_id = s.cuenta_id
       group by s.cuenta_id, t.activo, t.hasta
      having count(*) filter (where s.fecha <= t.hasta and s.cerrado)
             < case when t.activo then ${dias}::int
                    else least(${dias}::int, greatest(0, coalesce(t.hasta - ${desde}::date + 1, 0))) end
    )
    select cuenta_id::text as cuenta_id from atrasados
    union select cuenta_id::text from metricas_sin_serie
    union select cuenta_id::text from faltan`.execute(datos());
  return r.rows.map((f) => f.cuenta_id);
}
