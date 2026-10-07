// El gasto de TODA la cuenta publicitaria (`076`) y qué falta leer para que el gasto por campaña cuadre con él.
//
// ═══════════════════════════════════════════════════════════════════════════════
// «COMPLETO» QUIERE DECIR «CUADRA CON LA CUENTA», NO «EL DÍA TIENE FILAS»
//
// Hasta el 2026-10-07 un día de gasto estaba completo si tenía alguna fila de métricas. Así se escondió la
// fuga: el colector pedía 13 de las 61 campañas, las 12 pausadas dejaban una fila nula por día, y la única que
// gastó —una campaña de mensajes, sin contactos atribuidos— no entraba nunca. La app decía 0 en 7 días y el
// Administrador de anuncios 200,19.
//
// Ahora la referencia es la serie diaria de la cuenta (`serieDeLaCuenta`), que coincide al centavo con el
// Administrador de anuncios. Un día está completo cuando la suma por anuncio cuadra con ella. Y un día que
// cuadra prueba, sin ninguna llamada, que no gastó ninguna campaña que no se leyó ese día: el gasto nunca es
// negativo.
//
// Este archivo tiene dos mitades:
//
//   · **Las decisiones del colector, puras**: qué día cuadra, qué lectura es final, qué consultas hacen falta.
//     Fechas como texto `YYYY-MM-DD` y el reloj de afuera, así que se prueban sin base y en cualquier zona.
//   · **Las lecturas de cobertura** que comparten Acquisition, la economía y los detectores: si una ventana
//     tiene el gasto entero, y por qué no.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql, type RawBuilder } from 'kysely';
import { datos } from '../datos/contexto.ts';

/**
 * Cuánto puede diferir, en un día, la suma por anuncio del total de la cuenta y seguir contando como igual.
 *
 * Medido el 2026-10-07: la campaña de mensajes del 30-sep al 6-oct suma 200,19 por anuncio y la serie 200,19
 * para la cuenta; del 7-sep al 6-oct la serie suma 2.234,55, igual al Administrador de anuncios. Al centavo.
 * Lo que queda es el redondeo: el proveedor manda el gasto de cada anuncio con dos decimales, así que la suma
 * de N anuncios puede alejarse medio centavo por anuncio del total redondeado. Diez centavos cubren veinte
 * anuncios con entrega en un día, el doble de lo que esta cuenta mueve.
 */
export const TOLERANCIA_DEL_CUADRE = 0.1;

const DIA_MS = 86_400_000;

/** Un instante, como su día en UTC. */
export function diaUtc(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Un `YYYY-MM-DD` corrido `n` días. Por UTC, así que no depende de la zona del proceso. */
export function sumarDias(dia: string, n: number): string {
  return diaUtc(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS);
}

/**
 * Desde cuándo una lectura de `dia` es FINAL: las 00:00 UTC de dos días después.
 *
 * Ahí el día terminó en cualquier huso —de UTC−12 a UTC+14—, así que nada que se lea después lo verá a medias.
 * No sabemos en qué zona está la cuenta publicitaria (la API no lo dice), y por eso la cota es la del peor caso.
 */
export function finSeguro(dia: string): number {
  return Date.parse(`${dia}T00:00:00Z`) + 2 * DIA_MS;
}

/** Si el detalle por anuncio de un día explica el total de la cuenta. Sin total, nunca. */
export function cuadra(cuenta: number | null, detalle: number): boolean {
  if (cuenta === null) return false;
  // En centavos, para que la suma de flotantes no deje un `0.1000000001` del lado equivocado de la cota.
  return Math.abs(Math.round(cuenta * 100) - Math.round(detalle * 100)) <= Math.round(TOLERANCIA_DEL_CUADRE * 100);
}

// ─── Lo que el colector sabe de un día y de un par ───────────────────────────

/** Una fila de `negocio.gasto_de_la_cuenta`, con los instantes en milisegundos. */
export interface DiaDeLaSerie {
  gasto: number | null;
  leidoEl: number;
  cambioEl: number | null;
  redescubiertoEl: number | null;
  residuoEl: number | null;
}

/** Una fila de `negocio.lecturas_de_gasto`. */
export interface LecturaDeGasto {
  gasto: number;
  leidoEl: number;
  porRango: boolean;
}

/** Todo lo que hace falta para decidir qué pedir. La arma el colector leyendo la base; acá no se lee nada. */
export interface FotoDelGasto {
  /** Las campañas de la cuenta (`negocio.campanas`) más las que tienen anuncios guardados. */
  universo: readonly string[];
  serie: ReadonlyMap<string, DiaDeLaSerie>;
  /** La suma por anuncio de cada día, con el mismo filtro que `cifrasPorCampana`: anuncios con campaña. */
  detalle: ReadonlyMap<string, number>;
  /** Por campaña, y adentro por día. */
  lecturas: ReadonlyMap<string, ReadonlyMap<string, LecturaDeGasto>>;
}

/**
 * Si una lectura de un par ya no va a cambiar.
 *
 *   · Leída antes de `finSeguro`, pudo ver el día a medias.
 *   · Con gasto, y leída antes de que el total del día cambiara (`cambio_el`): Meta corrigió hacia atrás, y lo
 *     que esa campaña gastó puede ser otra cifra. Un cero leído antes de una corrección se conserva: que la
 *     corrección le cree gasto a una campaña que no gastó termina en el residuo, que lo redescubre una vez.
 */
export function lecturaFinal(l: LecturaDeGasto, dia: string, serie: DiaDeLaSerie | undefined): boolean {
  if (l.leidoEl < finSeguro(dia)) return false;
  if (l.gasto > 0 && serie?.cambioEl != null && l.leidoEl < serie.cambioEl) return false;
  return true;
}

/**
 * En qué está un día, para el relleno:
 *
 *   · `sin_serie`: no tiene total de la cuenta, o el que tiene se leyó antes de que el día terminara;
 *   · `cuadra`: el detalle explica el total. Las campañas no leídas ese día no gastaron;
 *   · `pendiente`: no cuadra y a alguna campaña le falta una lectura final;
 *   · `por_redescubrir`: no cuadra con todas las campañas leídas, y es la primera vez. Sus ceros se borran y
 *     se vuelven a descubrir: un vacío del proveedor pudo ser un silencio y no un cero;
 *   · `nuevo_residuo`: lo mismo, después de redescubrirlo. Se declara residuo;
 *   · `residuo`: ya declarado. Gasto de la cuenta que ninguna campaña listada explica (una campaña borrada).
 */
export type EstadoDelDia = 'sin_serie' | 'cuadra' | 'pendiente' | 'por_redescubrir' | 'nuevo_residuo' | 'residuo';

export function estadoDelDia(foto: FotoDelGasto, dia: string): EstadoDelDia {
  const s = foto.serie.get(dia);
  if (!s || s.leidoEl < finSeguro(dia)) return 'sin_serie';
  if (cuadra(s.gasto, foto.detalle.get(dia) ?? 0)) return 'cuadra';
  if (s.residuoEl !== null) return 'residuo';
  const falta = foto.universo.some((c) => {
    const l = foto.lecturas.get(c)?.get(dia);
    return !l || !lecturaFinal(l, dia, s);
  });
  if (falta) return 'pendiente';
  return s.redescubiertoEl === null ? 'por_redescubrir' : 'nuevo_residuo';
}

// ─── Las consultas que faltan ────────────────────────────────────────────────

/**
 * Una llamada al proveedor:
 *
 *   · `dia`: las métricas por anuncio de una campaña en un día. Se guardan como métrica diaria;
 *   · `rango`: el total de una campaña en varios días. **Nunca se guarda como métrica**: sólo decide si esos
 *     días son ceros probados o si hay que bajar a semanas, y de las semanas a los días.
 */
export type Consulta =
  | { tipo: 'dia'; campana: string; dia: string }
  | {
      tipo: 'rango';
      campana: string;
      desde: string;
      hasta: string;
      /** Los días del rango que esta campaña tiene sin leer. Son los únicos que el resultado puede resolver. */
      dias: readonly string[];
      /** Lo que esta campaña ya tiene leído en el rango: el total del rango lo incluye. */
      conocido: number;
    };

/** Cuántos días tiene, como mucho, un rango que se resuelve pidiendo sus días de a uno. */
export const DIAS_POR_SEMANA = 7;

/**
 * Lo que una campaña tiene leído, y FINAL, en un rango. Una lectura que no es final no cuenta: su cifra puede
 * haber cambiado, y descontarla del total podría dejar en cero un día que gastó. Si el total la incluye, el
 * rango sale con gasto y se parte, que cuesta llamadas pero nunca escribe un cero falso.
 */
function conocidoEn(foto: FotoDelGasto, campana: string, desde: string, hasta: string): number {
  let suma = 0;
  for (const [dia, l] of foto.lecturas.get(campana) ?? []) {
    if (dia >= desde && dia <= hasta && lecturaFinal(l, dia, foto.serie.get(dia))) suma += l.gasto;
  }
  return suma;
}

/**
 * Las consultas que resuelven los días `pendiente` de la lista, antes de partir ningún rango.
 *
 * Por cada (campaña, día) sin lectura final:
 *   · si la lectura que tiene gastó, se vuelve a pedir ese día: ya se sabe que gastó, un rango no ahorra nada;
 *   · si no, entra en un rango de la campaña, del primero al último de sus días sin leer.
 *
 * Un rango puede cruzar días que ya cuadran, o en que la campaña ya está leída: el total los incluye, y por eso
 * viaja `conocido`. Lo que falta es el total menos lo conocido, y un día que cuadra no le suma nada a una campaña
 * sin leer, porque cuadrar prueba que no gastó.
 */
export function consultasIniciales(foto: FotoDelGasto, pendientes: readonly string[]): Consulta[] {
  const cola: Consulta[] = [];
  const sinLeer = new Map<string, string[]>();
  for (const dia of pendientes) {
    const s = foto.serie.get(dia);
    for (const campana of foto.universo) {
      const l = foto.lecturas.get(campana)?.get(dia);
      if (l && lecturaFinal(l, dia, s)) continue;
      if (l && l.gasto > 0) cola.push({ tipo: 'dia', campana, dia });
      else sinLeer.set(campana, [...(sinLeer.get(campana) ?? []), dia]);
    }
  }
  for (const [campana, dias] of sinLeer) {
    const orden = [...dias].sort();
    const desde = orden[0]!;
    const hasta = orden[orden.length - 1]!;
    cola.push({ tipo: 'rango', campana, desde, hasta, dias: orden, conocido: conocidoEn(foto, campana, desde, hasta) });
  }
  return ordenar(cola);
}

/**
 * Qué hacer con el total de un rango:
 *
 *   · si lo que falta —el total menos lo conocido— no pasa la tolerancia, los días sin leer son **ceros
 *     probados**;
 *   · si gastó y el rango es de una semana o menos, se piden sus días sin leer, de a uno;
 *   · si gastó y es más largo, se parte en semanas desde el final, y cada semana con días sin leer es un rango.
 */
export function partirRango(
  foto: FotoDelGasto,
  consulta: Extract<Consulta, { tipo: 'rango' }>,
  total: number,
): { ceros: readonly string[] } | { siguientes: Consulta[] } {
  if (Math.round((total - consulta.conocido) * 100) <= Math.round(TOLERANCIA_DEL_CUADRE * 100)) {
    return { ceros: consulta.dias };
  }
  const largo = (Date.parse(`${consulta.hasta}T00:00:00Z`) - Date.parse(`${consulta.desde}T00:00:00Z`)) / DIA_MS + 1;
  if (largo <= DIAS_POR_SEMANA) {
    return { siguientes: ordenar(consulta.dias.map((dia) => ({ tipo: 'dia' as const, campana: consulta.campana, dia }))) };
  }
  const siguientes: Consulta[] = [];
  for (let hasta = consulta.hasta; hasta >= consulta.desde; hasta = sumarDias(hasta, -DIAS_POR_SEMANA)) {
    const inicio = sumarDias(hasta, -(DIAS_POR_SEMANA - 1));
    const desde = inicio > consulta.desde ? inicio : consulta.desde;
    const dias = consulta.dias.filter((d) => d >= desde && d <= hasta);
    if (dias.length === 0) continue;
    siguientes.push({
      tipo: 'rango',
      campana: consulta.campana,
      desde,
      hasta,
      dias,
      conocido: conocidoEn(foto, consulta.campana, desde, hasta),
    });
  }
  return { siguientes: ordenar(siguientes) };
}

/**
 * El orden de la cola: **lo más nuevo primero**, y en el mismo final, lo más largo primero.
 *
 * Lo más nuevo primero porque es lo que la pantalla muestra: «7 días» se completa antes que agosto. Y en el
 * mismo final los rangos largos van antes que las semanas y los días, porque un rango que da cero resuelve de
 * una llamada lo que los días resolverían de a uno.
 */
export function ordenar(cola: readonly Consulta[]): Consulta[] {
  const fin = (c: Consulta) => (c.tipo === 'dia' ? c.dia : c.hasta);
  const inicio = (c: Consulta) => (c.tipo === 'dia' ? c.dia : c.desde);
  return [...cola].sort(
    (a, b) =>
      fin(b).localeCompare(fin(a)) ||
      inicio(a).localeCompare(inicio(b)) ||
      a.campana.localeCompare(b.campana),
  );
}

/**
 * Los pares que la pasada diaria pide SIEMPRE: hoy, ayer y anteayer de las campañas candidatas, en ese orden.
 *
 * Hoy primero porque es lo único que sólo esta pasada pide: anteayer lo cubre también el relleno, que nunca toca
 * un día más nuevo que hoy−2. Ayer y hoy quedan como foto a medias hasta que se releen.
 */
export function paresDelTramoFijo(hoy: string, candidatas: readonly string[]): { campana: string; dia: string }[] {
  return [0, 1, 2].flatMap((atras) => candidatas.map((campana) => ({ campana, dia: sumarDias(hoy, -atras) })));
}

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
    atrasado: boolean;
    primer_dato: string | null;
  }>`
    with cerrados as (
      select fecha from negocio.gasto_de_la_cuenta
       where fecha < current_date
         and leido_el >= ((fecha + 1)::timestamp at time zone ${zona})
    )
    select exists (select 1 from negocio.gasto_de_la_cuenta) as hay_serie,
           exists (select 1 from negocio.metricas_de_anuncio) as hay_metricas,
           to_char((select max(fecha) from cerrados), 'YYYY-MM-DD') as ultimo_cerrado,
           coalesce((select max(leido_el) from negocio.gasto_de_la_cuenta) < now() - interval '26 hours', true)
             or coalesce((select max(fecha) from cerrados) < current_date - 3, false) as atrasado,
           to_char(least((select min(fecha) from negocio.gasto_de_la_cuenta),
                         (select min(fecha) from negocio.metricas_de_anuncio)), 'YYYY-MM-DD') as primer_dato`.execute(
    datos(),
  );
  const f = r.rows[0]!;
  const hayDatos = f.hay_serie || f.hay_metricas;
  return {
    hayDatos,
    ultimoCerrado: f.hay_serie ? f.ultimo_cerrado : null,
    atrasado: hayDatos && (!f.hay_serie || f.atrasado),
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
 */
export async function coberturaDelGasto(
  desde: string,
  hasta: string,
  dias: number,
  zona: string,
): Promise<{ entero: boolean; motivo: MotivoDelGasto | null; deLaCuenta: number | null }> {
  const r = await sql<{ con_serie: string; cerrados: string; enteros: string; de_la_cuenta: string | null }>`
    with detalle as (
      select m.fecha, sum(m.gasto) as detalle
        from negocio.metricas_de_anuncio m
        join negocio.anuncios a on a.org_id = m.org_id and a.meta_anuncio_id = m.meta_anuncio_id
       where m.fecha between ${desde}::date and ${hasta}::date
         and a.meta_campana_id is not null
       group by m.fecha
    ),
    serie as (
      select s.fecha, s.gasto, s.residuo_el,
             s.leido_el >= ((s.fecha + 1)::timestamp at time zone ${zona}) as cerrado,
             abs(round(coalesce(s.gasto, 0) * 100) - round(coalesce(d.detalle, 0) * 100))
               <= ${Math.round(TOLERANCIA_DEL_CUADRE * 100)} as cuadra
        from negocio.gasto_de_la_cuenta s
        left join detalle d on d.fecha = s.fecha
       where s.fecha between ${desde}::date and ${hasta}::date
    )
    select count(*) as con_serie,
           count(*) filter (where cerrado) as cerrados,
           count(*) filter (where cerrado and (cuadra or residuo_el is not null)) as enteros,
           sum(gasto) as de_la_cuenta
      from serie`.execute(datos());
  const f = r.rows[0]!;
  const conSerie = Number(f.con_serie);
  /* `dias > 0`: una ventana de cero días —«Completo» con el primer dato de hoy, que todavía no tiene ningún día
     cerrado— daría cero de cero y pasaría sin haber mirado nada. */
  const motivo: MotivoDelGasto | null =
    dias <= 0 || conSerie < dias || Number(f.cerrados) < dias
      ? 'dias_sin_leer'
      : Number(f.enteros) < dias
        ? 'no_cuadra'
        : null;
  return {
    entero: motivo === null,
    motivo,
    deLaCuenta: dias > 0 && conSerie === dias ? Math.round(Number(f.de_la_cuenta ?? 0) * 100) / 100 : null,
  };
}

/**
 * Cuántos días de una ventana tienen el total de la cuenta y un detalle por campaña que no lo explica, sin estar
 * declarados residuo. La ventana la da quien llama, con su propio predicado sobre `fecha`: Creative usa una
 * ventana móvil hasta hoy (`ventanaDeMetricas`) y no días cerrados, y una segunda copia de su predicado acá
 * podría separarse de la que imprime su encabezado.
 *
 * Un día sin total no cuenta: de él no se puede decir que no cuadre. Lo dice el aviso de la ventana incompleta.
 */
export async function diasSinCuadrar(enLaVentana: (alias: string) => RawBuilder<boolean>): Promise<number> {
  const r = await sql<{ n: string }>`
    with detalle as (
      select m.fecha, sum(m.gasto) as detalle
        from negocio.metricas_de_anuncio m
        join negocio.anuncios a on a.org_id = m.org_id and a.meta_anuncio_id = m.meta_anuncio_id
       where ${enLaVentana('m')}
         and a.meta_campana_id is not null
       group by m.fecha
    )
    select count(*) as n
      from negocio.gasto_de_la_cuenta g
      left join detalle d on d.fecha = g.fecha
     where ${enLaVentana('g')}
       and g.residuo_el is null
       and abs(round(coalesce(g.gasto, 0) * 100) - round(coalesce(d.detalle, 0) * 100))
           > ${Math.round(TOLERANCIA_DEL_CUADRE * 100)}`.execute(datos());
  return Number(r.rows[0]?.n ?? 0);
}
