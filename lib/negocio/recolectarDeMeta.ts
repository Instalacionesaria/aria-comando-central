// Los anuncios, las campañas y el gasto de cada cliente, desde la Marketing API de Meta (Meta directo, M3).
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ HACE, Y QUÉ REEMPLAZA
//
// Hasta acá esto lo hacía `recolectarAnuncios` contra el Ad Manager de GoHighLevel: una llamada por campaña y por día,
// sólo los últimos tres días, y una maquinaria de cuadre y relleno para tapar lo que el proveedor cortaba. Con el token
// de la conexión de Meta de cada cliente (`resolverCuentasDeMeta`), una pasada por cuenta publicitaria trae:
//
//   · la estructura: campañas (con objetivo, presupuesto, fechas y estado efectivo), conjuntos y anuncios;
//   · lo de cada anuncio, cada día de los últimos 28 —Meta corrige la atribución hasta 28 días después—, con el video;
//   · el total de la cuenta por día (un día sin entrega es 0, no falta) y el total del cliente;
//   · los desgloses (ubicación, plataforma, edad y género, dispositivo, país) de los últimos días.
//
// Escribe en las MISMAS tablas y con las MISMAS claves que el recolector de GoHighLevel: los ids que traía GoHighLevel
// ya eran los de Meta, así que la atribución de los contactos (`adId`, `campaignId`, `utmTerm`) sigue cruzando y las
// pantallas leen donde leían. Las claves de las acciones se pasan a la forma que ya leen (`claveDeLaAccion`).
//
// ── LA HISTORIA ──────────────────────────────────────────────────────────────────
//
// La pasada `historia` (la tarea `anuncios_relleno`) trae los 12 meses anteriores, de a tramos de 30 días hacia
// atrás, desde el día más viejo que ya hay de esa cuenta (`gasto_por_cuenta_publicitaria`), hasta completar el año.
// No guarda dónde quedó: lo deduce de lo guardado, así que una corrida cortada sigue donde estaba.
//
// ── EL CUPO DE META ──────────────────────────────────────────────────────────────
//
// Cada respuesta trae el uso de la cuota de la cuenta y de la app en sus cabeceras. Pasado el 90 % la pasada deja esa
// cuenta para la próxima corrida: Meta bloquea por minutos a quien insiste, y la historia puede esperar.
// ═══════════════════════════════════════════════════════════════════════════════
import { sql } from 'kysely';
import { datos, conOrganizacion } from '../datos/contexto.ts';
import type { AmbitoDeUnCliente } from './ambitoDelCliente.ts';
import type { CuentaDeMetaDelCliente } from '../credenciales/resolver.ts';
import type { FallaDeMeta } from '../meta/graph.ts';
import {
  DESGLOSES,
  estructuraDeLaCuenta,
  insightsDeLaCuenta,
  insightsPorAnuncio,
  insightsPorDesglose,
  type AnuncioDeMeta,
  type CampanaDeMeta,
  type ConjuntoDeMeta,
  type Desglose,
  type FilaDeAnuncio,
  type FilaDeCuenta,
  type FilaDeDesglose,
  type LlaveDeMeta,
} from '../meta/insights.ts';

const DIA_MS = 86_400_000;
/** Cuántos días se releen cada día: Meta corrige la atribución hasta 28 días después. */
export const DIAS_QUE_SE_RELEEN = 28;
/** Cuántos días de desgloses se releen cada día: son pesados, y lo viejo casi no cambia. */
export const DIAS_DE_DESGLOSES = 3;
/** La historia que se trae al conectar: un año. */
export const DIAS_DE_HISTORIA = 365;
/** Cuánto de historia por cuenta en cada corrida. */
export const TRAMO_DE_HISTORIA = 30;
/** Pasado este uso de la cuota (en %), la cuenta espera a la próxima corrida. */
export const TOPE_DE_LA_CUOTA = 90;

export const diaUtc = (t: number): string => new Date(t).toISOString().slice(0, 10);
export const sumarDias = (dia: string, n: number): string => diaUtc(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS);

/** Lo que pasó con una cuenta publicitaria en la pasada. */
export interface ResultadoDeLaCuenta {
  act: string;
  desde: string | null;
  hasta: string | null;
  campanas: number;
  anuncios: number;
  metricas: number;
  dias: number;
  desgloses: number;
  /** Filas o acciones de Meta que no se pudieron leer: un cambio de forma se ve acá, no en silencio. */
  ilegibles: number;
  /** Por qué no se completó, si no se completó. `token` = la conexión se cayó; `cupo` = sigue en la próxima. */
  falla: FallaDeMeta | null;
  /** La historia de los 12 meses ya está completa (sólo la pasada `historia`). */
  historiaCompleta?: boolean;
}

export interface ResumenDeMeta {
  modo: 'diario' | 'historia';
  cuentas: ResultadoDeLaCuenta[];
  /** Las conexiones cuyo token Meta rechazó: la ruta del cron las marca `revocada`. */
  conexionesCaidas: string[];
  llamadas: number;
}

/** Las piezas que la prueba reemplaza. Sin ellas, Meta y la base de verdad. */
export interface PiezasDeMeta {
  ahora?: number;
  reloj?: () => number;
}

/** El uso de la cuota más alto que dicen las cabeceras de Meta, en %. */
export function usoDeLaCuota(cabeceras: Headers): number {
  let maximo = 0;
  const mirar = (v: unknown) => {
    if (typeof v === 'number' && Number.isFinite(v)) maximo = Math.max(maximo, v);
  };
  for (const nombre of ['x-business-use-case-usage', 'x-ad-account-usage', 'x-app-usage', 'x-fb-ads-insights-throttle']) {
    const crudo = cabeceras.get(nombre);
    if (!crudo) continue;
    try {
      const j = JSON.parse(crudo) as unknown;
      const recorrer = (o: unknown): void => {
        if (Array.isArray(o)) o.forEach(recorrer);
        else if (o && typeof o === 'object') {
          for (const [k, v] of Object.entries(o)) {
            if (['call_count', 'total_cputime', 'total_time', 'acc_id_util_pct', 'app_id_util_pct'].includes(k)) mirar(v);
            else recorrer(v);
          }
        }
      };
      recorrer(j);
    } catch {
      /* Una cabecera ilegible no frena nada. */
    }
  }
  return maximo;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOS ESCRITORES (cada uno dentro del ámbito del cliente: el puente pone su cuenta)
// ═══════════════════════════════════════════════════════════════════════════════

const json = (o: Record<string, number> | null): string | null => (o === null ? null : JSON.stringify(o));
const texto = (n: number | null): string | null => (n === null ? null : String(n));

/** El gasto en USD de un monto en `moneda` el `dia`, con el último tipo de cambio de ese día o anterior. */
const enUsd = (monto: number | null, moneda: string | null, dia: string) =>
  monto === null || moneda === null
    ? sql<string | null>`null`
    : moneda === 'USD'
      ? sql<string>`${monto}::numeric`
      : sql<string | null>`(select ${monto}::numeric * t.usd_por_unidad from catalogo.tipos_de_cambio t
                              where t.moneda = ${moneda} and t.dia <= ${dia}::date order by t.dia desc limit 1)`;

/** La estructura: campañas, conjuntos y anuncios. El nombre se protege con `coalesce`; el estado se pisa. */
export async function guardarEstructura(
  act: string,
  moneda: string | null,
  e: { campanas: CampanaDeMeta[]; conjuntos: ConjuntoDeMeta[]; anuncios: AnuncioDeMeta[] },
): Promise<void> {
  const ahora = new Date();
  for (const c of e.campanas) {
    await datos()
      .insertInto('campanas')
      .values({
        meta_campana_id: c.id,
        nombre: c.nombre,
        estado: c.estado,
        estado_efectivo: c.estadoEfectivo,
        objetivo: c.objetivo,
        presupuesto_diario: c.presupuestoDiario === null ? null : String(c.presupuestoDiario),
        presupuesto_total: c.presupuestoTotal === null ? null : String(c.presupuestoTotal),
        inicio: c.inicio,
        fin: c.fin,
        act_id: act,
        moneda,
        sincronizado_el: ahora,
      } as never)
      .onConflict((oc) =>
        oc.columns(['org_id', 'meta_campana_id']).doUpdateSet({
          nombre: sql`coalesce(excluded.nombre, campanas.nombre)`,
          estado: sql`excluded.estado`,
          estado_efectivo: sql`excluded.estado_efectivo`,
          objetivo: sql`excluded.objetivo`,
          presupuesto_diario: sql`excluded.presupuesto_diario`,
          presupuesto_total: sql`excluded.presupuesto_total`,
          inicio: sql`excluded.inicio`,
          fin: sql`excluded.fin`,
          act_id: sql`excluded.act_id`,
          moneda: sql`excluded.moneda`,
          sincronizado_el: ahora,
        } as never),
      )
      .execute();
  }
  for (const s of e.conjuntos) {
    await datos()
      .insertInto('conjuntos_de_anuncios')
      .values({
        meta_conjunto_id: s.id,
        meta_campana_id: s.campana,
        act_id: act,
        nombre: s.nombre,
        estado: s.estado,
        estado_efectivo: s.estadoEfectivo,
        presupuesto_diario: s.presupuestoDiario === null ? null : String(s.presupuestoDiario),
        presupuesto_total: s.presupuestoTotal === null ? null : String(s.presupuestoTotal),
        optimizacion: s.optimizacion,
        sincronizado_el: ahora,
      } as never)
      .onConflict((oc) =>
        oc.columns(['org_id', 'meta_conjunto_id']).doUpdateSet({
          meta_campana_id: sql`coalesce(excluded.meta_campana_id, conjuntos_de_anuncios.meta_campana_id)`,
          nombre: sql`coalesce(excluded.nombre, conjuntos_de_anuncios.nombre)`,
          estado: sql`excluded.estado`,
          estado_efectivo: sql`excluded.estado_efectivo`,
          presupuesto_diario: sql`excluded.presupuesto_diario`,
          presupuesto_total: sql`excluded.presupuesto_total`,
          optimizacion: sql`excluded.optimizacion`,
          act_id: sql`excluded.act_id`,
          sincronizado_el: ahora,
        } as never),
      )
      .execute();
  }
  const objetivo = new Map(e.campanas.map((c) => [c.id, c.objetivo]));
  for (const a of e.anuncios) {
    await guardarAnuncio({
      id: a.id,
      nombre: a.nombre,
      conjunto: a.conjunto,
      campana: a.campana,
      objetivo: a.campana ? (objetivo.get(a.campana) ?? null) : null,
      estado: a.estado,
      estadoEfectivo: a.estadoEfectivo,
      act,
    });
  }
}

/** Un anuncio en la dimensión. Lo conocido no se pierde por una lectura que no lo trae. */
async function guardarAnuncio(a: {
  id: string;
  nombre: string | null;
  conjunto: string | null;
  campana: string | null;
  objetivo: string | null;
  estado: string | null;
  estadoEfectivo: string | null;
  act: string;
}): Promise<void> {
  await datos()
    .insertInto('anuncios')
    .values({
      meta_anuncio_id: a.id,
      meta_conjunto_id: a.conjunto,
      meta_campana_id: a.campana,
      // `nombre` es not null: sin nombre de Meta se usa el id, y el próximo que traiga nombre lo reemplaza.
      nombre: a.nombre ?? a.id,
      objetivo: a.objetivo,
      estado: a.estado,
      estado_efectivo: a.estadoEfectivo,
      act_id: a.act,
      sincronizado_el: new Date(),
    } as never)
    .onConflict((oc) =>
      oc.columns(['org_id', 'meta_anuncio_id']).doUpdateSet({
        meta_conjunto_id: sql`coalesce(excluded.meta_conjunto_id, anuncios.meta_conjunto_id)`,
        meta_campana_id: sql`coalesce(excluded.meta_campana_id, anuncios.meta_campana_id)`,
        objetivo: sql`coalesce(excluded.objetivo, anuncios.objetivo)`,
        nombre: a.nombre === null ? sql`anuncios.nombre` : sql`excluded.nombre`,
        estado: sql`coalesce(excluded.estado, anuncios.estado)`,
        estado_efectivo: sql`coalesce(excluded.estado_efectivo, anuncios.estado_efectivo)`,
        act_id: sql`excluded.act_id`,
        sincronizado_el: new Date(),
      } as never),
    )
    .execute();
}

/** Lo de cada anuncio por día. Reescribe plano: Meta corrige hacia atrás y la lectura nueva es la buena. */
export async function guardarMetricas(act: string, filas: readonly FilaDeAnuncio[]): Promise<void> {
  const ahora = new Date();
  for (const f of filas) {
    await guardarAnuncio({
      id: f.anuncio,
      nombre: f.nombre,
      conjunto: f.conjunto,
      campana: f.campana,
      objetivo: null,
      estado: null,
      estadoEfectivo: null,
      act,
    });
    const valores = {
      meta_anuncio_id: f.anuncio,
      fecha: f.fecha,
      gasto: f.gasto,
      impresiones: f.impresiones,
      clics: f.clics,
      alcance: f.alcance,
      ctr: f.ctr,
      cpc: f.cpc,
      frecuencia: f.frecuencia,
      cpm: f.cpm,
      acciones: json(f.acciones),
      valores: json(f.valores),
      video: json(f.video),
      moneda: f.moneda,
      gasto_usd: enUsd(f.gasto, f.moneda, f.fecha),
      fuente: 'meta',
      sincronizado_el: ahora,
    };
    await datos()
      .insertInto('metricas_de_anuncio')
      .values(valores as never)
      .onConflict((oc) =>
        oc.columns(['org_id', 'meta_anuncio_id', 'fecha']).doUpdateSet({
          gasto: sql`excluded.gasto`,
          impresiones: sql`excluded.impresiones`,
          clics: sql`excluded.clics`,
          alcance: sql`excluded.alcance`,
          ctr: sql`excluded.ctr`,
          cpc: sql`excluded.cpc`,
          frecuencia: sql`excluded.frecuencia`,
          cpm: sql`excluded.cpm`,
          acciones: sql`excluded.acciones`,
          valores: sql`excluded.valores`,
          video: sql`excluded.video`,
          moneda: sql`excluded.moneda`,
          gasto_usd: sql`excluded.gasto_usd`,
          fuente: sql`excluded.fuente`,
          sincronizado_el: ahora,
        } as never),
      )
      .execute();
  }
}

/**
 * El total de una cuenta publicitaria por día, y después el total del cliente en esos días. Un día del rango que Meta
 * no devolvió no tuvo entrega: se escribe 0, porque el rango SE LEYÓ (un fallo nunca llega acá).
 */
export async function guardarDias(act: string, moneda: string | null, desde: string, hasta: string, filas: readonly FilaDeCuenta[]): Promise<number> {
  const porDia = new Map(filas.map((f) => [f.fecha, f]));
  const ahora = new Date();
  let dias = 0;
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
    const f = porDia.get(d);
    const m = f?.moneda ?? moneda;
    const gasto = f?.gasto ?? 0;
    await datos()
      .insertInto('gasto_por_cuenta_publicitaria')
      .values({
        act_id: act,
        fecha: d,
        gasto: String(gasto),
        moneda: m,
        gasto_usd: enUsd(gasto, m, d),
        // Un día que Meta no devolvió no tuvo entrega: sus conteos son 0. Uno que devolvió sin un campo, nulo.
        impresiones: f ? texto(f.impresiones) : '0',
        clics: f ? texto(f.clics) : '0',
        alcance: f ? texto(f.alcance) : '0',
        frecuencia: f ? texto(f.frecuencia) : null,
        cpm: f ? texto(f.cpm) : null,
        leido_el: ahora,
      } as never)
      .onConflict((oc) =>
        oc.columns(['org_id', 'act_id', 'fecha']).doUpdateSet({
          gasto: sql`excluded.gasto`,
          moneda: sql`excluded.moneda`,
          gasto_usd: sql`excluded.gasto_usd`,
          impresiones: sql`excluded.impresiones`,
          clics: sql`excluded.clics`,
          alcance: sql`excluded.alcance`,
          frecuencia: sql`excluded.frecuencia`,
          cpm: sql`excluded.cpm`,
          leido_el: ahora,
        } as never),
      )
      .execute();
    dias += 1;
  }
  await totalDelCliente(desde, hasta);
  return dias;
}

/**
 * El total del cliente por día (`gasto_de_la_cuenta`, lo que leen las pantallas): la suma de sus cuentas publicitarias.
 * Con una sola moneda, en esa moneda; con varias, en USD (y sin total si falta el tipo de alguna). El ámbito es el del
 * cliente, así que la suma ve sólo sus cuentas.
 */
async function totalDelCliente(desde: string, hasta: string): Promise<void> {
  await sql`
    insert into negocio.gasto_de_la_cuenta (org_id, fecha, gasto, impresiones, clics, alcance, frecuencia, cpm, moneda, gasto_usd, fuente, leido_el)
    select g.org_id, g.fecha,
           case when count(distinct g.moneda) <= 1 then sum(g.gasto) else sum(g.gasto_usd) end,
           sum(g.impresiones), sum(g.clics), sum(g.alcance),
           case when sum(g.alcance) > 0 then round(sum(g.impresiones)::numeric / sum(g.alcance), 4) end,
           case when sum(g.impresiones) > 0 and count(distinct g.moneda) <= 1 then round(sum(g.gasto) * 1000 / sum(g.impresiones), 4) end,
           case when count(distinct g.moneda) <= 1 then max(g.moneda) else 'USD' end,
           case when count(*) = count(g.gasto_usd) then sum(g.gasto_usd) end,
           'meta', now()
      from negocio.gasto_por_cuenta_publicitaria g
     where g.fecha between ${desde}::date and ${hasta}::date
     group by g.org_id, g.fecha
    on conflict (org_id, cuenta_id, fecha) do update set
      gasto = excluded.gasto, impresiones = excluded.impresiones, clics = excluded.clics, alcance = excluded.alcance,
      frecuencia = excluded.frecuencia, cpm = excluded.cpm, moneda = excluded.moneda, gasto_usd = excluded.gasto_usd,
      fuente = excluded.fuente, leido_el = excluded.leido_el,
      cambio_el = case when abs(coalesce(gasto_de_la_cuenta.gasto, 0) - coalesce(excluded.gasto, 0)) > 0.10 then now()
                       else gasto_de_la_cuenta.cambio_el end
  `.execute(datos());
}

/** Lo de cada anuncio por día y desglose. */
export async function guardarDesglose(desglose: Desglose, filas: readonly FilaDeDesglose[]): Promise<void> {
  const ahora = new Date();
  for (const f of filas) {
    await datos()
      .insertInto('metricas_por_desglose')
      .values({
        meta_anuncio_id: f.anuncio,
        fecha: f.fecha,
        desglose,
        valor: f.valor,
        gasto: f.gasto === null ? null : String(f.gasto),
        impresiones: f.impresiones === null ? null : String(f.impresiones),
        clics: f.clics === null ? null : String(f.clics),
        alcance: f.alcance === null ? null : String(f.alcance),
        acciones: json(f.acciones),
        moneda: f.moneda,
        leido_el: ahora,
      } as never)
      .onConflict((oc) =>
        oc.columns(['org_id', 'meta_anuncio_id', 'fecha', 'desglose', 'valor']).doUpdateSet({
          gasto: sql`excluded.gasto`,
          impresiones: sql`excluded.impresiones`,
          clics: sql`excluded.clics`,
          alcance: sql`excluded.alcance`,
          acciones: sql`excluded.acciones`,
          moneda: sql`excluded.moneda`,
          leido_el: ahora,
        } as never),
      )
      .execute();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LA PASADA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Una pasada por las cuentas publicitarias de UN cliente. `diario` = estructura + los últimos 28 días + desgloses;
 * `historia` = un tramo más de los 12 meses hacia atrás por cuenta, hasta completarlos.
 *
 * Una cuenta que falla no frena a las demás: su falla queda en su resultado. Si no anduvo ninguna, la tarea falla (un
 * sello en verde sobre una pasada que no escribió nada sería mentir). Un token rechazado deja su conexión en
 * `conexionesCaidas`, para que la ruta del cron la marque.
 */
export async function recolectarDeMeta(
  ambito: AmbitoDeUnCliente,
  cuentas: readonly CuentaDeMetaDelCliente[],
  modo: 'diario' | 'historia',
  fin: number,
  piezas: PiezasDeMeta = {},
): Promise<{ corrio: true; resultado: ResumenDeMeta; llamadas: number }> {
  const reloj = piezas.reloj ?? Date.now;
  const hoy = diaUtc(piezas.ahora ?? Date.now());
  const resumen: ResumenDeMeta = { modo, cuentas: [], conexionesCaidas: [], llamadas: 0 };
  const enAmbito = <T>(f: () => Promise<T>) => conOrganizacion(ambito, f);

  for (const c of cuentas) {
    const r: ResultadoDeLaCuenta = {
      act: c.act,
      desde: null,
      hasta: null,
      campanas: 0,
      anuncios: 0,
      metricas: 0,
      dias: 0,
      desgloses: 0,
      ilegibles: 0,
      falla: null,
    };
    resumen.cuentas.push(r);
    if (reloj() > fin) {
      r.falla = 'sin_respuesta';
      continue;
    }
    let cuota = 0;
    const llave: LlaveDeMeta = {
      token: c.token,
      conPrueba: c.conPrueba,
      alResponder: (h) => {
        cuota = Math.max(cuota, usoDeLaCuota(h));
      },
    };
    const caer = (motivo: FallaDeMeta, llamadas: number) => {
      r.falla = motivo;
      resumen.llamadas += llamadas;
      if (motivo === 'token' && !resumen.conexionesCaidas.includes(c.conexionId)) resumen.conexionesCaidas.push(c.conexionId);
    };

    // El rango: los últimos 28 días, o el tramo de la historia que sigue.
    let desde: string;
    let hasta: string;
    if (modo === 'diario') {
      desde = sumarDias(hoy, -(DIAS_QUE_SE_RELEEN - 1));
      hasta = hoy;
    } else {
      const masViejo = await enAmbito(async () =>
        (
          await datos()
            .selectFrom('gasto_por_cuenta_publicitaria')
            .select((eb) => eb.fn.min('fecha').as('d'))
            .where('act_id', '=', c.act)
            .executeTakeFirst()
        )?.d ?? null,
      );
      const limite = sumarDias(hoy, -(DIAS_DE_HISTORIA - 1));
      // Sin nada guardado, la historia arranca donde termina la pasada diaria.
      const tope = masViejo ? sumarDias(diaUtc(new Date(masViejo).getTime()), -1) : sumarDias(hoy, -DIAS_QUE_SE_RELEEN);
      if (tope < limite) {
        r.historiaCompleta = true;
        continue;
      }
      hasta = tope;
      const tramo = sumarDias(hasta, -(TRAMO_DE_HISTORIA - 1));
      desde = tramo < limite ? limite : tramo;
    }
    r.desde = desde;
    r.hasta = hasta;

    // 1 · La estructura (sólo en la diaria: la historia no cambia qué es cada anuncio hoy).
    if (modo === 'diario') {
      const decimales = c.moneda
        ? await enAmbito(async () =>
            (await sql<{ decimales: number }>`select decimales from catalogo.monedas where codigo = ${c.moneda}`.execute(datos())).rows[0]
              ?.decimales ?? 2,
          )
        : 2;
      const e = await estructuraDeLaCuenta(c.act, llave, decimales);
      if (e.tipo !== 'listo') {
        caer(e.motivo, e.llamadas);
        continue;
      }
      resumen.llamadas += e.llamadas;
      await enAmbito(() => guardarEstructura(c.act, c.moneda, e.datos));
      r.campanas = e.datos.campanas.length;
      r.anuncios = e.datos.anuncios.length;
    }

    // 2 · Lo de cada anuncio por día.
    const a = await insightsPorAnuncio(c.act, llave, desde, hasta);
    if (a.tipo !== 'listo') {
      caer(a.motivo, a.llamadas);
      continue;
    }
    resumen.llamadas += a.llamadas;
    r.ilegibles += a.datos.ilegibles;
    await enAmbito(() => guardarMetricas(c.act, a.datos.filas));
    r.metricas = a.datos.filas.length;

    // 3 · El total de la cuenta por día, y el del cliente.
    const d = await insightsDeLaCuenta(c.act, llave, desde, hasta);
    if (d.tipo !== 'listo') {
      caer(d.motivo, d.llamadas);
      continue;
    }
    resumen.llamadas += d.llamadas;
    r.dias = await enAmbito(() => guardarDias(c.act, c.moneda, desde, hasta, d.datos));

    // 4 · Los desgloses: de los últimos días en la diaria, del tramo entero en la historia. Con la cuota alta, esperan.
    const desdeDelDesglose = modo === 'diario' ? sumarDias(hoy, -(DIAS_DE_DESGLOSES - 1)) : desde;
    for (const g of Object.keys(DESGLOSES) as Desglose[]) {
      if (cuota >= TOPE_DE_LA_CUOTA || reloj() > fin) {
        r.falla = cuota >= TOPE_DE_LA_CUOTA ? 'cupo' : 'sin_respuesta';
        break;
      }
      const x = await insightsPorDesglose(c.act, llave, g, desdeDelDesglose, hasta);
      resumen.llamadas += x.llamadas;
      if (x.tipo !== 'listo') {
        r.falla = x.motivo;
        if (x.motivo === 'token' && !resumen.conexionesCaidas.includes(c.conexionId)) resumen.conexionesCaidas.push(c.conexionId);
        break;
      }
      await enAmbito(() => guardarDesglose(g, x.datos));
      r.desgloses += x.datos.length;
    }
  }

  // Ninguna cuenta anduvo (y había alguna que pedir): es la conexión o Meta, y la tarea falla.
  const pedidas = resumen.cuentas.filter((c) => !c.historiaCompleta);
  if (pedidas.length > 0 && pedidas.every((c) => c.falla !== null && c.metricas === 0 && c.dias === 0)) {
    const motivos = [...new Set(pedidas.map((c) => c.falla))].join(', ');
    const e = new Error(`Meta no devolvió nada de ninguna cuenta publicitaria (${motivos})`);
    Object.assign(e, { resumen });
    throw e;
  }
  return { corrio: true, resultado: resumen, llamadas: resumen.llamadas };
}
