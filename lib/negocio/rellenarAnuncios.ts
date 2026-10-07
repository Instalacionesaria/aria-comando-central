// El relleno del gasto: los días cerrados en que el detalle por campaña no cuadra con la cuenta (`076`).
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ HACE, Y POR QUÉ ES OTRA TAREA
//
// La pasada diaria (`recolectarAnuncios.ts`) pide la serie de la cuenta y los últimos tres días de las campañas
// que pueden estar gastando. Lo que otra campaña haya gastado lo dice la cuenta: el día no cuadra. Esta tarea
// busca quién fue.
//
// No puede ir en la pasada diaria porque no entra: buscar entre 61 campañas cuesta cientos de llamadas la
// primera vez, a unos 3 a 4,5 segundos cada una. Corre cada hora, sola en su horario, con su propio
// presupuesto, y cada corrida sigue desde donde quedó la anterior: lo pendiente se recalcula de la base, nada se
// encola. Cuando no queda nada pendiente no hace ninguna llamada.
//
// ── CÓMO BUSCA ─────────────────────────────────────────────────────────────
//
// `/reporting/list` suma cuando se le pide un rango. Así que por cada campaña sin leer pide UN rango que cubre
// sus días pendientes: si no gastó, son ceros probados, de una llamada; si gastó, el rango se parte en semanas y
// las semanas que gastaron, en días, y sólo los días se guardan como métricas. Lo más nuevo va primero.
//
// Nunca toca un día más nuevo que hoy−2 en UTC: hasta las 00:00 UTC de dos días después, el día de la cuenta
// puede no haber terminado en su huso, y un cero leído a medias no es un cero.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { conOrganizacion, datos } from '../datos/contexto.ts';
import {
  integracionDeAnuncios,
  metricasPorAnuncio,
  serieDeLaCuenta,
  totalDeLaCampana,
  type DiaDeLaCuenta,
  type MetricaDeAnuncio,
} from '../ghl/anuncios.ts';
import {
  consultasIniciales,
  diaUtc,
  estadoDelDia,
  ordenar,
  partirRango,
  sumarDias,
  type Consulta,
  type DiaDeLaSerie,
  type FotoDelGasto,
  type LecturaDeGasto,
} from './gastoDeLaCuenta.ts';
import {
  declararResiduo,
  DIAS_QUE_SE_RELEEN,
  guardar,
  guardarCeros,
  guardarSerie,
  redescubrir,
  sembrarLecturasDeLasMetricas,
} from './recolectarAnuncios.ts';

/**
 * Hasta cuándo puede llamar el relleno, desde que arranca el barrido.
 *
 * Corre solo en su horario, así que puede usar casi toda la función: el `maxDuration` del cron es de 300 s. Se
 * comprueba antes de cada llamada, y los 50 s que quedan cubren la última —medidas entre 0,2 y 4,6 s el
 * 2026-10-07— y el sello. No cubren una llamada colgada, que `pedirExterno` espera hasta 240 s; eso lo cubre la
 * reconciliación: lo pendiente sigue pendiente y la hora siguiente lo toma.
 */
export const FIN_DEL_RELLENO_MS = 250_000;

/** Qué pasó en una corrida del relleno. */
export interface ResumenDelRelleno {
  /** El tramo mirado: del primer día de la serie a hoy−2. `null` sin serie todavía. */
  desde: string | null;
  hasta: string | null;
  /** Cuántos días cerrados no cuadraban (o no tenían total) al empezar. */
  pendientes: number;
  /** Rangos y días pedidos. */
  consultas: number;
  /** Pares (campaña, día) que un rango probó en cero. */
  ceros: number;
  /** Filas de anuncio escritas por las lecturas de un día. */
  metricas: number;
  /** Las consultas que fallaron: quedan pendientes para la corrida siguiente. Un fallo nunca escribe un cero. */
  huecos: { campana: string; desde: string; hasta: string }[];
  /** `true` = se acabó el tiempo y quedaron consultas sin hacer. */
  atrasado: boolean;
  /** Días cuyos ceros se borraron para volver a descubrirlos, y días declarados residuo en esta corrida. */
  redescubiertos: string[];
  residuos: string[];
  vinculo: { estado: string | null; cuentaId: string | null } | null;
  cuenta: { tipo: 'leida'; desde: string; hasta: string } | { tipo: 'fallo'; porque: string } | null;
  ilegibles: number;
  accionesIlegibles: number;
  llamadas: number;
}

/** Lo que el relleno lee de la base: la foto, y el primer día con gasto guardado. */
export type FotoDelRelleno = FotoDelGasto & { inicio: string | null };

/** Un instante de la base, en milisegundos; `null` se queda `null`. */
const ms = (v: Date | string | null): number | null => (v === null ? null : new Date(v).getTime());

/**
 * La foto del gasto, del primer día con gasto guardado a `hasta`. **Corre dentro de `conOrganizacion(`.**
 *
 * El primer día es el más viejo de la serie **o de las métricas**. Las métricas cuentan por la transición: una
 * empresa con gasto del colector viejo y sin serie todavía tiene días sin total de la cuenta, y el relleno los
 * pide en su primera corrida en vez de esperar a la pasada diaria. Sin eso, desde el despliegue hasta las 06:17
 * UTC Acquisition diría que el colector está atrasado.
 *
 * Las fechas salen de la base como texto (`to_char`): un `date` que pasa por un `Date` de JavaScript se corre un
 * día al este de Greenwich. El universo son las campañas de la cuenta más las que tienen anuncios guardados: una
 * campaña borrada que la cuenta ya no lista sigue teniendo gasto viejo.
 */
export async function fotoDelRelleno(hasta: string): Promise<FotoDelRelleno> {
  const serie = await sql<{
    fecha: string;
    gasto: string | null;
    leido_el: Date;
    cambio_el: Date | null;
    redescubierto_el: Date | null;
    residuo_el: Date | null;
  }>`
    select to_char(fecha, 'YYYY-MM-DD') as fecha, gasto, leido_el, cambio_el, redescubierto_el, residuo_el
      from negocio.gasto_de_la_cuenta
     where fecha <= ${hasta}::date
     order by fecha`.execute(datos());
  const primero = await sql<{ inicio: string | null }>`
    select to_char(least((select min(fecha) from negocio.gasto_de_la_cuenta),
                         (select min(fecha) from negocio.metricas_de_anuncio)), 'YYYY-MM-DD') as inicio`.execute(datos());
  const inicio = primero.rows[0]?.inicio ?? null;
  if (inicio === null) return { inicio, universo: [], serie: new Map(), detalle: new Map(), lecturas: new Map() };

  const detalle = await sql<{ fecha: string; detalle: string | null }>`
    select to_char(m.fecha, 'YYYY-MM-DD') as fecha, sum(m.gasto) as detalle
      from negocio.metricas_de_anuncio m
      join negocio.anuncios a on a.org_id = m.org_id and a.meta_anuncio_id = m.meta_anuncio_id
     where m.fecha between ${inicio}::date and ${hasta}::date
       and a.meta_campana_id is not null
     group by m.fecha`.execute(datos());
  const lecturas = await sql<{ campana: string; fecha: string; gasto: string; por_rango: boolean; leido_el: Date }>`
    select meta_campana_id as campana, to_char(fecha, 'YYYY-MM-DD') as fecha, gasto, por_rango, leido_el
      from negocio.lecturas_de_gasto
     where fecha between ${inicio}::date and ${hasta}::date`.execute(datos());
  const universo = await sql<{ campana: string }>`
    select meta_campana_id as campana from negocio.campanas where meta_campana_id ~ '^[0-9]+$'
    union
    select meta_campana_id from negocio.anuncios where meta_campana_id ~ '^[0-9]+$'
    order by 1`.execute(datos());

  const porCampana = new Map<string, Map<string, LecturaDeGasto>>();
  for (const l of lecturas.rows) {
    const m = porCampana.get(l.campana) ?? new Map<string, LecturaDeGasto>();
    m.set(l.fecha, { gasto: Number(l.gasto), leidoEl: ms(l.leido_el)!, porRango: l.por_rango });
    porCampana.set(l.campana, m);
  }
  return {
    inicio,
    universo: universo.rows.map((u) => u.campana),
    serie: new Map(
      serie.rows.map((s): [string, DiaDeLaSerie] => [
        s.fecha,
        {
          gasto: s.gasto === null ? null : Number(s.gasto),
          leidoEl: ms(s.leido_el)!,
          cambioEl: ms(s.cambio_el),
          redescubiertoEl: ms(s.redescubierto_el),
          residuoEl: ms(s.residuo_el),
        },
      ]),
    ),
    detalle: new Map(detalle.rows.map((d) => [d.fecha, Number(d.detalle ?? 0)])),
    lecturas: porCampana,
  };
}

/** Las piezas que la prueba reemplaza. Ver `PiezasDelColector`: es la misma frontera. */
export interface PiezasDelRelleno {
  /** El día de hoy sale de acá; sin esto, del reloj del barrido. */
  ahora?: number;
  /** El cronómetro del presupuesto. Sin esto, el del barrido. */
  reloj?: () => number;
  foto?: (hasta: string) => Promise<FotoDelRelleno>;
  vinculo?: typeof integracionDeAnuncios;
  serie?: typeof serieDeLaCuenta;
  escribirSerie?: (dias: readonly DiaDeLaCuenta[]) => Promise<void>;
  pedir?: typeof metricasPorAnuncio;
  escribir?: (campana: string, dia: string, metricas: readonly MetricaDeAnuncio[]) => Promise<void>;
  total?: typeof totalDeLaCampana;
  escribirCeros?: (campana: string, dias: readonly string[]) => Promise<void>;
  redescubrir?: (dia: string) => Promise<void>;
  declararResiduo?: (dia: string) => Promise<void>;
}

/** Los días de `desde` a `hasta`, los dos incluidos. */
function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

/**
 * Una corrida del relleno para una organización.
 *
 * @param arranque Cuándo arrancó el barrido: el presupuesto se mide desde ahí (`FIN_DEL_RELLENO_MS`).
 * @param ahora El reloj del barrido.
 */
export async function rellenarAnuncios(
  orgId: string,
  acceso: { token: string; locationId: string },
  arranque: number,
  ahora: () => number,
  piezas: PiezasDelRelleno = {},
): Promise<{ corrio: true; resultado: ResumenDelRelleno; llamadas: number }> {
  const reloj = piezas.reloj ?? ahora;
  const instante = piezas.ahora ?? ahora();
  const hasta = sumarDias(diaUtc(instante), -DIAS_QUE_SE_RELEEN);
  const enOrg = <T>(f: () => Promise<T>) => conOrganizacion(orgId, f);
  // La foto de la base siembra antes las lecturas del colector viejo, una sola vez (ver la función).
  const leerFoto =
    piezas.foto ??
    ((h: string) =>
      enOrg(async () => {
        await sembrarLecturasDeLasMetricas();
        return fotoDelRelleno(h);
      }));
  const mirarElVinculo = piezas.vinculo ?? integracionDeAnuncios;
  const pedirSerie = piezas.serie ?? serieDeLaCuenta;
  const escribirSerie = piezas.escribirSerie ?? ((d: readonly DiaDeLaCuenta[]) => enOrg(() => guardarSerie(d)));
  const pedir = piezas.pedir ?? metricasPorAnuncio;
  const escribir =
    piezas.escribir ?? ((c: string, d: string, m: readonly MetricaDeAnuncio[]) => enOrg(() => guardar(c, d, m)));
  const pedirTotal = piezas.total ?? totalDeLaCampana;
  const escribirCeros = piezas.escribirCeros ?? ((c: string, d: readonly string[]) => enOrg(() => guardarCeros(c, d)));
  const borrarCeros = piezas.redescubrir ?? ((d: string) => enOrg(() => redescubrir(d)));
  const residuo = piezas.declararResiduo ?? ((d: string) => enOrg(() => declararResiduo(d)));
  const sinTiempo = () => reloj() - arranque > FIN_DEL_RELLENO_MS;

  const resumen: ResumenDelRelleno = {
    desde: null,
    hasta: null,
    pendientes: 0,
    consultas: 0,
    ceros: 0,
    metricas: 0,
    huecos: [],
    atrasado: false,
    redescubiertos: [],
    residuos: [],
    vinculo: null,
    cuenta: null,
    ilegibles: 0,
    accionesIlegibles: 0,
    llamadas: 0,
  };
  const listo = () => ({ corrio: true as const, resultado: resumen, llamadas: resumen.llamadas });

  let foto = await leerFoto(hasta);
  /* Sin serie ni métricas, la empresa nunca leyó gasto de Meta: no hay contra qué cuadrar, y preguntar por el
     vínculo cada hora a una empresa que no tiene Meta serían 24 llamadas por día para nada. */
  if (foto.inicio === null || foto.inicio > hasta) return listo();
  resumen.desde = foto.inicio;
  resumen.hasta = hasta;
  const dias = diasEntre(foto.inicio, hasta);
  const enEstado = (e: string) => dias.filter((d) => estadoDelDia(foto, d) === e);

  /* ── 1 · LO QUE SE RESUELVE SIN LLAMAR ──────────────────────────────────────
     Un día que sigue sin cuadrar después de redescubrirlo se declara residuo; uno que no cuadra por primera vez
     con todo leído pierde sus ceros, y vuelve a estar pendiente. */
  for (const d of enEstado('nuevo_residuo')) {
    await residuo(d);
    resumen.residuos.push(d);
  }
  const aRedescubrir = enEstado('por_redescubrir');
  for (const d of aRedescubrir) {
    await borrarCeros(d);
    resumen.redescubiertos.push(d);
  }
  if (aRedescubrir.length > 0 || resumen.residuos.length > 0) foto = await leerFoto(hasta);

  let sinSerie = enEstado('sin_serie');
  resumen.pendientes = sinSerie.length + enEstado('pendiente').length;
  if (resumen.pendientes === 0) return listo();

  /* ── 2 · EL VÍNCULO, COMO COMPUERTA ─────────────────────────────────────────
     Un rango que vuelve vacío suma cero, y sin vínculo el proveedor devuelve vacío sin fallar. */
  if (sinTiempo()) {
    resumen.atrasado = true;
    return listo();
  }
  const v = await mirarElVinculo(acceso);
  resumen.llamadas += 1;
  if (v.tipo !== 'datos') throw new Error(`no se pudo comprobar el vínculo con Meta: ${v.fallo.tipo}`);
  resumen.vinculo = { estado: v.datos.estado, cuentaId: v.datos.cuentaId };
  if (v.datos.estado !== 'connected') return listo();

  /* ── 3 · LOS DÍAS SIN TOTAL DE LA CUENTA ────────────────────────────────────
     Una pasada diaria perdida deja días sin total, o con uno leído antes de que terminaran. Una sola llamada por
     cada veinte días los resuelve, y sin el total no hay contra qué cuadrar. */
  let algoAnduvo = false;
  if (sinSerie.length > 0 && !sinTiempo()) {
    const s = await pedirSerie(acceso, sinSerie[0]!, sinSerie[sinSerie.length - 1]!);
    resumen.llamadas += s.llamadas;
    if (s.tipo === 'datos') {
      await escribirSerie(s.datos);
      algoAnduvo = true;
      resumen.cuenta = { tipo: 'leida', desde: sinSerie[0]!, hasta: sinSerie[sinSerie.length - 1]! };
      foto = await leerFoto(hasta);
      sinSerie = enEstado('sin_serie');
    } else {
      resumen.cuenta = { tipo: 'fallo', porque: s.fallo.tipo };
    }
  }

  /* ── 4 · LA BÚSQUEDA ─────────────────────────────────────────────────────────
     Las lecturas de la foto se actualizan a medida que se escriben, para que `partirRango` descuente lo recién
     leído: si no, una semana que ya se leyó de a días parecería seguir gastando. */
  const lecturas = new Map([...foto.lecturas].map(([c, m]) => [c, new Map(m)]));
  const viva: FotoDelGasto = { ...foto, lecturas };
  const anotar = (campana: string, dia: string, l: LecturaDeGasto) => {
    const m = lecturas.get(campana) ?? new Map<string, LecturaDeGasto>();
    m.set(dia, l);
    lecturas.set(campana, m);
  };

  let cola: Consulta[] = consultasIniciales(viva, enEstado('pendiente'));
  while (cola.length > 0) {
    if (sinTiempo()) {
      resumen.atrasado = true;
      break;
    }
    const c = cola.shift()!;
    resumen.consultas += 1;
    resumen.llamadas += 1;

    if (c.tipo === 'dia') {
      const r = await pedir(acceso, c.campana, c.dia);
      if (r.tipo !== 'datos') {
        resumen.huecos.push({ campana: c.campana, desde: c.dia, hasta: c.dia });
        continue;
      }
      algoAnduvo = true;
      resumen.ilegibles += r.ilegibles ?? 0;
      resumen.accionesIlegibles += r.accionesIlegibles ?? 0;
      await escribir(c.campana, c.dia, r.datos);
      resumen.metricas += r.datos.length;
      const gasto = r.datos.reduce((s, m) => s + Math.round((m.gasto ?? 0) * 100), 0) / 100;
      anotar(c.campana, c.dia, { gasto, leidoEl: instante, porRango: false });
      continue;
    }

    const r = await pedirTotal(acceso, c.campana, c.desde, c.hasta);
    // Un fallo nunca escribe un cero: los días siguen pendientes y la corrida siguiente los vuelve a buscar.
    if (r.tipo !== 'datos') {
      resumen.huecos.push({ campana: c.campana, desde: c.desde, hasta: c.hasta });
      continue;
    }
    algoAnduvo = true;
    resumen.ilegibles += r.ilegibles ?? 0;
    const p = partirRango(viva, c, r.datos.gasto);
    if ('ceros' in p) {
      await escribirCeros(c.campana, p.ceros);
      resumen.ceros += p.ceros.length;
      for (const dia of p.ceros) anotar(c.campana, dia, { gasto: 0, leidoEl: instante, porRango: true });
    } else {
      cola = ordenar([...cola, ...p.siguientes]);
    }
  }

  if (!algoAnduvo && resumen.consultas + (resumen.cuenta === null ? 0 : 1) > 0) {
    // El detalle va al registro y no al cuerpo (`ADR-0704`).
    throw new Error(`el CRM rechazó las ${resumen.consultas} consultas del relleno`);
  }
  return listo();
}
