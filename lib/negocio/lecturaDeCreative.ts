// La lectura de Creative: lo que dibuja el front del prototipo, hecho en el servidor.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ES (docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, CF1-15)
//
// La pestaña vuelve al front del prototipo: la tira de seis cifras, la biblioteca partida en «Funciona» y «No
// funciona» para el criterio elegido, la tarjeta de cada pieza con su miniatura, la ficha y, debajo, una fila de
// cifras. Este módulo compone lo que ya se mide —`calidadDelCreativo`, `rendimientoDelCreativo`, `fatigaDelCreativo`,
// el enlace manual— más dos lecturas nuevas: la entrega de cada pieza y su miniatura (`miniaturaDelContacto.ts`).
//
// Tiene dos mitades, como `lib/negocio/lecturaDeConversation.ts`: `armarCreative`, pura y probada sin base, y
// `lecturaDeCreative`, que lee. La ruta y el cerebro leen la misma lectura (CF1-16).
//
// ── LAS REGLAS ─────────────────────────────────────────────────────────────
//
//   · **Todo de 0 a 1**: los módulos publican sus tasas en porcentaje y las comparten otras pantallas; acá se
//     calculan desde los conteos.
//   · **Toda tasa lleva su piso**: 1000 sobre impresiones (`PISO_DE_IMPRESIONES`); el click-to-landing, el de 10 clics
//     al enlace que ya aplica su módulo. Bajo el piso, «—» con su motivo. La tira y las tarjetas no dibujan tasas sobre
//     contactos: Calificados y Agendas son conteos.
//   · **La pieza es el nombre del anuncio normalizado** (`llaveDelCreativo`), la misma llave de los tres módulos.
//   · **«Funciona» es contra la etapa** (CF1-08): cada pieza contra el promedio de las piezas de su etapa.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { calidadDelCreativo, type CalidadDeLosCreativos } from './calidadDelCreativo.ts';
import { ventanaDeMetricas } from './costoDelAnuncio.ts';
import { ETAPAS, type Etapa, etapaDelNombre, llaveDelCreativo } from './creativo.ts';
import { enlacesDeLasPiezas, type EnlaceDePieza } from './enlaceDeLaPieza.ts';
import { fatigaDelCreativo, type FatigaDeLosCreativos } from './fatigaDelCreativo.ts';
import { miniaturasDeLasPiezas } from './miniaturaDelContacto.ts';
import { PIEZA_SIN_NOMBRE, PISO_DE_IMPRESIONES, rendimientoDelCreativo, type RendimientoDeLosCreativos } from './rendimientoDelCreativo.ts';
import { LARGO_MAXIMO_DE_MINIATURA, enlaceDePublicacion, type Red } from './urlExterna.ts';

// ─── Los tipos ──────────────────────────────────────────────────────────────

/**
 * Por qué una cifra no tiene valor: `sin_contactos` —la pieza no trajo contactos en la ventana—, `sin_puntaje` —el CRM
 * no tiene el campo del ICP—, `sin_entrega` —la pieza no tuvo impresiones en la ventana—, `bajo_el_piso` —menos de 10
 * clics al enlace para el click-to-landing—, `pocas_impresiones` —menos de 1000 impresiones para una tasa—, `sin_reporte` —
 * GoHighLevel no reportó esa acción para la pieza en ningún anuncio-día de la ventana, por ejemplo vistas de video en
 * una imagen, o el gasto de días con impresiones— o `sin_fuente` — lo que GoHighLevel no entrega: la retención—.
 */
export type MotivoDeLaCifra =
  | 'sin_contactos'
  | 'sin_puntaje'
  | 'sin_entrega'
  | 'bajo_el_piso'
  | 'pocas_impresiones'
  | 'sin_reporte'
  | 'sin_fuente';

export interface Cifra {
  /** Un conteo, una proporción de 0 a 1, una frecuencia o un monto. `null`: «—», y el motivo dice por qué. */
  valor: number | null;
  motivo: MotivoDeLaCifra | null;
}

/** La etapa de la pieza; `sin_etapa` agrupa a las que no tienen una reconocible. */
export type ClaveDeEtapa = Etapa | 'sin_etapa';
export const CLAVES_DE_ETAPA: readonly ClaveDeEtapa[] = [...ETAPAS, 'sin_etapa'];

/** Los criterios de «Ordenar por» (CF1-07). Retención no ordena: no tiene dato. */
export const CRITERIOS = ['calificados', 'agendas', 'hookRate', 'impresiones'] as const;
export type Criterio = (typeof CRITERIOS)[number];

export interface CifrasDeLaPieza {
  calificados: Cifra;
  agendas: Cifra;
  hookRate: Cifra;
  retencion: Cifra;
  impresiones: Cifra;
  frecuencia: Cifra;
}

export interface PiezaDeCreative {
  /** El nombre de la pieza, normalizado. Es la llave y lo que se dibuja. */
  clave: string;
  etapa: ClaveDeEtapa;
  /** Impresiones en alguno de los últimos 3 días del calendario, hoy incluido (CF1-09). */
  estado: 'entregando' | 'sin_entrega';
  cifras: CifrasDeLaPieza;
  /** `true`: la fatiga tiene veredicto y la pieza perdió gancho; `null`: no hay veredicto. */
  perdiendoGancho: boolean | null;
  /** La imagen del anuncio (CF1-12), o `null`. */
  miniatura: string | null;
  /** Adónde lleva «Ver en Facebook/Instagram»: el enlace manual si lo hay, si no la miniatura. */
  enlace: { url: string; red: Red } | null;
  ficha: {
    anuncios: number;
    primerDia: string | null;
    ultimoDia: string | null;
    gasto: Cifra;
    ctr: Cifra;
    linkCtr: Cifra;
    landing: Cifra;
    clickToLanding: Cifra;
    anunciosDeLaPieza: { anuncioId: string; impresiones: number | null; gasto: number | null }[];
  };
}

export interface GruposDeUnCriterio {
  funciona: string[];
  noFunciona: string[];
  /** El promedio de cada etapa para este criterio, de 0 a 1 en las tasas. `null` = ninguna pieza con valor. */
  promedioPorEtapa: Record<ClaveDeEtapa, number | null>;
  /** Las piezas que son la única de su etapa con valor: «Funciona» sin contra quién compararse (CF1-08). */
  unicas: string[];
}

export interface PantallaDeCreativeArmada {
  cifras: CifrasDeLaPieza;
  piezas: PiezaDeCreative[];
  criterios: Record<Criterio, GruposDeUnCriterio>;
  loDemas: {
    gasto: Cifra;
    ctr: Cifra;
    linkCtr: Cifra;
    landing: Cifra;
    /** Las piezas que perdieron gancho, sobre las que tienen veredicto. */
    perdiendoGancho: { con: number; sobre: number };
  };
}

/** Lo que la lectura de entrega trae de una pieza. Conteos de la ventana; los días, de toda la historia. */
export interface EntregaDeLaPieza {
  pieza: string;
  impresiones: number;
  clics: number;
  /** Las acciones y las impresiones de los anuncio-día que TRAÍAN la clave; `null` si ninguno la trajo. */
  vistas: { cantidad: number; impresiones: number } | null;
  clicsAlEnlace: { cantidad: number; impresiones: number } | null;
  landing: { cantidad: number; impresiones: number } | null;
  /** Impresiones sobre alcance, pesada por impresiones; `null` sin alcance en la ventana. */
  frecuencia: number | null;
  /** Las impresiones de los días que traían frecuencia: el peso de esta pieza en la frecuencia de la tira. */
  impresionesConFrecuencia: number;
  /** La etapa de la campaña de la que más impresiones tuvo la pieza. */
  etapa: Etapa | null;
  primerDia: string | null;
  ultimoDia: string | null;
  entregando: boolean;
}

export interface EntradaDeCreative {
  calidad: CalidadDeLosCreativos;
  rendimiento: RendimientoDeLosCreativos;
  fatiga: FatigaDeLosCreativos;
  entrega: readonly EntregaDeLaPieza[];
  miniaturas: ReadonlyMap<string, string>;
  enlaces: readonly EnlaceDePieza[];
}

// ─── Las cuentas, puras ─────────────────────────────────────────────────────

const conValor = (valor: number): Cifra => ({ valor, motivo: null });
const sinValor = (motivo: MotivoDeLaCifra): Cifra => ({ valor: null, motivo });

/** Una tasa sobre impresiones con el piso de 1000; sin la clave en ningún anuncio-día, `sin_reporte`. */
function sobreImpresiones(par: { cantidad: number; impresiones: number } | null, hayEntrega: boolean): Cifra {
  if (!hayEntrega) return sinValor('sin_entrega');
  if (par === null) return sinValor('sin_reporte');
  if (par.impresiones < PISO_DE_IMPRESIONES) return sinValor('pocas_impresiones');
  return conValor(par.cantidad / par.impresiones);
}

/** Suma pares (cantidad, impresiones); `null` si ninguno tiene la clave. */
function sumarPares(pares: readonly ({ cantidad: number; impresiones: number } | null)[]) {
  const con = pares.filter((p): p is { cantidad: number; impresiones: number } => p !== null);
  if (con.length === 0) return null;
  return { cantidad: con.reduce((s, p) => s + p.cantidad, 0), impresiones: con.reduce((s, p) => s + p.impresiones, 0) };
}

/** Lo que vale el criterio para comparar: el valor de la cifra, y para las tasas también su numerador y denominador. */
function medida(p: PiezaDeCreative, entrega: EntregaDeLaPieza | undefined, criterio: Criterio) {
  const c = p.cifras[criterio];
  if (c.valor === null) return null;
  if (criterio === 'hookRate' && entrega?.vistas) return { valor: c.valor, num: entrega.vistas.cantidad, den: entrega.vistas.impresiones };
  return { valor: c.valor, num: c.valor, den: 1 };
}

/** Los dos grupos de un criterio, contra el promedio de la etapa (CF1-08). */
function agrupar(piezas: readonly PiezaDeCreative[], entrega: ReadonlyMap<string, EntregaDeLaPieza>, criterio: Criterio): GruposDeUnCriterio {
  const promedioPorEtapa = Object.fromEntries(CLAVES_DE_ETAPA.map((e) => [e, null])) as Record<ClaveDeEtapa, number | null>;
  const conValorPorEtapa = new Map<ClaveDeEtapa, number>();
  for (const etapa of CLAVES_DE_ETAPA) {
    const medidas = piezas
      .filter((p) => p.etapa === etapa)
      .map((p) => medida(p, entrega.get(p.clave), criterio))
      .filter((m): m is { valor: number; num: number; den: number } => m !== null);
    conValorPorEtapa.set(etapa, medidas.length);
    if (medidas.length === 0) continue;
    /* Las tasas, pesadas —la suma de numeradores sobre la de denominadores—; los conteos, el promedio simple. */
    promedioPorEtapa[etapa] =
      criterio === 'hookRate'
        ? medidas.reduce((s, m) => s + m.num, 0) / medidas.reduce((s, m) => s + m.den, 0)
        : medidas.reduce((s, m) => s + m.valor, 0) / medidas.length;
  }
  const funciona: PiezaDeCreative[] = [];
  const noFunciona: PiezaDeCreative[] = [];
  const unicas: string[] = [];
  for (const p of piezas) {
    const v = p.cifras[criterio].valor;
    const promedio = promedioPorEtapa[p.etapa];
    if (v === null || promedio === null) {
      noFunciona.push(p);
      continue;
    }
    if (conValorPorEtapa.get(p.etapa) === 1) unicas.push(p.clave);
    (v >= promedio ? funciona : noFunciona).push(p);
  }
  /* De mayor a menor; sin valor al final; empate por nombre, para que el orden no dependa de la consulta. */
  const orden = (a: PiezaDeCreative, b: PiezaDeCreative) => {
    const va = a.cifras[criterio].valor;
    const vb = b.cifras[criterio].valor;
    if (va === null && vb === null) return a.clave.localeCompare(b.clave);
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va || a.clave.localeCompare(b.clave);
  };
  return {
    funciona: funciona.sort(orden).map((p) => p.clave),
    noFunciona: noFunciona.sort(orden).map((p) => p.clave),
    promedioPorEtapa,
    unicas,
  };
}

/** Lo que dibuja la pantalla, desde lo leído. Sin base: la prueba lo arma con números a mano. */
export function armarCreative(e: EntradaDeCreative): PantallaDeCreativeArmada {
  const sinPuntaje = e.calidad.campoDeIcp === null;
  const entrega = new Map(e.entrega.map((x) => [x.pieza, x]));
  const rendimiento = new Map(e.rendimiento.filas.map((f) => [f.creativo, f]));
  const fatiga = new Map(e.fatiga.filas.map((f) => [f.creativo, f]));
  const enlaces = new Map(e.enlaces.map((x) => [x.pieza, x]));

  /* La calidad viene por (pieza, etapa del contacto): se suma por pieza, y la etapa con más contactos es la de
     respaldo cuando la campaña de la pieza no dice su etapa —no tiene anuncios, o su campaña con más impresiones no
     trae TOFU, MOFU ni BOFU en el nombre—. Empate de contactos: la etapa que va antes en el embudo, para que la pieza no
     cambie de grupo según el orden en que la base devuelva las filas. */
  const calidad = new Map<string, { contactos: number; calificados: number; agendaron: number; etapa: Etapa | null; deLaEtapa: number }>();
  for (const f of e.calidad.filas) {
    if (f.creativo === null) continue;
    const ya = calidad.get(f.creativo) ?? { contactos: 0, calificados: 0, agendaron: 0, etapa: null, deLaEtapa: -1 };
    ya.contactos += f.contactos;
    ya.calificados += f.calificados;
    ya.agendaron += f.agendaron;
    const antes = f.etapa !== null && (ya.etapa === null || ETAPAS.indexOf(f.etapa) < ETAPAS.indexOf(ya.etapa));
    if (f.contactos > ya.deLaEtapa || (f.contactos === ya.deLaEtapa && antes)) {
      ya.etapa = f.etapa;
      ya.deLaEtapa = f.contactos;
    }
    calidad.set(f.creativo, ya);
  }

  /* Una pieza entra si hizo algo EN LA VENTANA: trajo contactos, tuvo impresiones o gastó. La entrega trae todas las
     piezas de la historia —sus días con entrega son de toda la historia—, y sin este filtro «7 días» listaba las 32
     piezas de siempre, 23 de ellas en «No funciona» con todo en «—». */
  const activa = (clave: string) =>
    calidad.has(clave) || (entrega.get(clave)?.impresiones ?? 0) > 0 || (rendimiento.get(clave)?.gasto ?? 0) > 0;
  const claves = [...new Set([...calidad.keys(), ...rendimiento.keys(), ...entrega.keys()])].filter(activa).sort((a, b) => a.localeCompare(b));
  const piezas: PiezaDeCreative[] = claves.map((clave) => {
    const q = calidad.get(clave);
    const r = rendimiento.get(clave);
    const x = entrega.get(clave);
    const f = fatiga.get(clave);
    const hayEntrega = (x?.impresiones ?? 0) > 0;
    const miniatura = e.miniaturas.get(clave) ?? null;
    const manual = enlaces.get(clave);
    const deLaMiniatura = miniatura === null ? null : enlaceDePublicacion(miniatura, LARGO_MAXIMO_DE_MINIATURA);
    return {
      clave,
      etapa: x?.etapa ?? q?.etapa ?? 'sin_etapa',
      estado: x?.entregando ? 'entregando' : 'sin_entrega',
      cifras: {
        calificados: !q ? sinValor('sin_contactos') : sinPuntaje ? sinValor('sin_puntaje') : conValor(q.calificados),
        agendas: !q ? sinValor('sin_contactos') : conValor(q.agendaron),
        hookRate: sobreImpresiones(x?.vistas ?? null, hayEntrega),
        retencion: sinValor('sin_fuente'),
        impresiones: hayEntrega ? conValor(x!.impresiones) : sinValor('sin_entrega'),
        frecuencia: !hayEntrega ? sinValor('sin_entrega') : x!.frecuencia !== null ? conValor(x!.frecuencia) : sinValor('sin_reporte'),
      },
      perdiendoGancho: f?.fatigado ?? null,
      miniatura,
      enlace: manual ? { url: manual.url, red: manual.red } : deLaMiniatura ? { url: deLaMiniatura.url, red: deLaMiniatura.red } : null,
      ficha: {
        anuncios: r?.anuncios ?? 0,
        primerDia: x?.primerDia ?? null,
        ultimoDia: x?.ultimoDia ?? null,
        /* Sin gasto pero con impresiones no es «sin entrega»: GoHighLevel no reportó lo que costó. */
        gasto: r && r.gasto !== null ? conValor(r.gasto) : sinValor(hayEntrega ? 'sin_reporte' : 'sin_entrega'),
        ctr: !hayEntrega ? sinValor('sin_entrega') : x!.impresiones < PISO_DE_IMPRESIONES ? sinValor('pocas_impresiones') : conValor(x!.clics / x!.impresiones),
        linkCtr: sobreImpresiones(x?.clicsAlEnlace ?? null, hayEntrega),
        landing: sobreImpresiones(x?.landing ?? null, hayEntrega),
        /* La landing sobre los clics al enlace, con el piso de los eventos. Viene del módulo, en porcentaje. */
        clickToLanding: !r || !hayEntrega
          ? sinValor('sin_entrega')
          : r.clickToLanding.tasa !== null
            ? conValor(r.clickToLanding.tasa / 100)
            : sinValor(r.clickToLanding.anuncioDiasConLaClave === 0 ? 'sin_reporte' : 'bajo_el_piso'),
        anunciosDeLaPieza: (r?.anunciosDeLaPieza ?? []).map((a) => ({ anuncioId: a.anuncioId, impresiones: a.impresiones, gasto: a.gasto })),
      },
    };
  });

  /* La tira: las sumas de las piezas y las tasas pesadas, no el promedio de los promedios. */
  const conCalidad = [...calidad.values()];
  const entregas = [...entrega.values()];
  const impresiones = entregas.reduce((s, x) => s + x.impresiones, 0);
  const clics = entregas.reduce((s, x) => s + x.clics, 0);
  /* La frecuencia de cada pieza ya viene pesada por las impresiones de SUS días con frecuencia; la de la tira se pesa
     con esas mismas impresiones, no con todas las de la pieza —que darían más peso a la que reporta menos—. */
  const conFrecuencia = entregas.filter((x) => x.frecuencia !== null && x.impresionesConFrecuencia > 0);
  const impresionesConFrecuencia = conFrecuencia.reduce((s, x) => s + x.impresionesConFrecuencia, 0);
  const hay = impresiones > 0;
  const cifras: CifrasDeLaPieza = {
    calificados: conCalidad.length === 0 ? sinValor('sin_contactos') : sinPuntaje ? sinValor('sin_puntaje') : conValor(conCalidad.reduce((s, q) => s + q.calificados, 0)),
    agendas: conCalidad.length === 0 ? sinValor('sin_contactos') : conValor(conCalidad.reduce((s, q) => s + q.agendaron, 0)),
    hookRate: sobreImpresiones(sumarPares(entregas.map((x) => x.vistas)), hay),
    retencion: sinValor('sin_fuente'),
    impresiones: hay ? conValor(impresiones) : sinValor('sin_entrega'),
    frecuencia: !hay
      ? sinValor('sin_entrega')
      : impresionesConFrecuencia > 0
        ? conValor(conFrecuencia.reduce((s, x) => s + x.frecuencia! * x.impresionesConFrecuencia, 0) / impresionesConFrecuencia)
        : sinValor('sin_reporte'),
  };

  const criterios = Object.fromEntries(CRITERIOS.map((c) => [c, agrupar(piezas, entrega, c)])) as Record<Criterio, GruposDeUnCriterio>;

  return {
    cifras,
    piezas,
    criterios,
    loDemas: {
      gasto: e.rendimiento.gastoTotal !== null ? conValor(e.rendimiento.gastoTotal) : sinValor('sin_entrega'),
      ctr: !hay ? sinValor('sin_entrega') : impresiones < PISO_DE_IMPRESIONES ? sinValor('pocas_impresiones') : conValor(clics / impresiones),
      linkCtr: sobreImpresiones(sumarPares(entregas.map((x) => x.clicsAlEnlace)), hay),
      landing: sobreImpresiones(sumarPares(entregas.map((x) => x.landing)), hay),
      /* Sobre las que TIENEN veredicto (`conVeredicto.con`): `conVeredicto.sobre` son todas las piezas de la fatiga. */
      perdiendoGancho: { con: e.fatiga.filas.filter((f) => f.fatigado === true).length, sobre: e.fatiga.conVeredicto.con },
    },
  };
}

// ─── La lectura ─────────────────────────────────────────────────────────────

/**
 * La entrega de cada pieza: las impresiones, los clics y las tres acciones de la ventana —sobre los anuncio-día que
 * traían cada clave, como `rendimientoDelCreativo`—, la frecuencia pesada por impresiones —como `frecuenciaPorAnuncio`
 * del detector—, la etapa de la campaña con más impresiones y los días con entrega de toda la historia. Los anuncios
 * sin nombre van en su pieza rotulada, como en `rendimientoDelCreativo`. Corre dentro de `conOrganizacion`.
 */
export async function entregaDeLasPiezas(dias: number): Promise<EntregaDeLaPieza[]> {
  const enVentana = ventanaDeMetricas('m', dias);
  const acciones = (clave: string) => [
    sql<string | null>`sum((m.acciones ->> ${clave})::numeric) filter (where ${enVentana} and m.acciones ? ${clave})`.as(`c_${clave}`),
    sql<string | null>`sum(m.impresiones) filter (where ${enVentana} and m.acciones ? ${clave})`.as(`i_${clave}`),
  ];
  const pieza = llaveDelCreativo('a.nombre');
  const filas = await datos()
    .selectFrom('metricas_de_anuncio as m')
    .innerJoin('anuncios as a', (j) => j.onRef('a.org_id', '=', 'm.org_id').onRef('a.meta_anuncio_id', '=', 'm.meta_anuncio_id'))
    .select([
      pieza.as('pieza'),
      sql<string | null>`sum(m.impresiones) filter (where ${enVentana})`.as('impresiones'),
      sql<string | null>`sum(m.clics) filter (where ${enVentana})`.as('clics'),
      ...acciones('videoView'),
      ...acciones('linkClick'),
      ...acciones('landingPageView'),
      sql<string | null>`sum(m.frecuencia * m.impresiones) filter (where ${enVentana} and m.frecuencia is not null)
        / nullif(sum(m.impresiones) filter (where ${enVentana} and m.frecuencia is not null), 0)`.as('frecuencia'),
      sql<string | null>`sum(m.impresiones) filter (where ${enVentana} and m.frecuencia is not null)`.as('impresionesConFrecuencia'),
      sql<string | null>`min(m.fecha) filter (where m.impresiones > 0)::text`.as('primerDia'),
      sql<string | null>`max(m.fecha) filter (where m.impresiones > 0)::text`.as('ultimoDia'),
      /* Los últimos 3 días del calendario, hoy incluido: la convención de `ventanaDeMetricas`. */
      sql<boolean>`coalesce(max(m.fecha) filter (where m.impresiones > 0) > current_date - 3, false)`.as('entregando'),
    ])
    .groupBy(pieza)
    .execute();

  /* La etapa: la de la campaña de la que más impresiones tuvo la pieza en toda la historia; empate, el id menor. En
     una consulta aparte y no como subconsulta correlacionada: con el `group by` de arriba, PostgreSQL rechaza la
     referencia a `a.nombre` desde adentro (`42803`), el mismo error que documenta `etapaDelNombre`. */
  const porCampana = await datos()
    .selectFrom('metricas_de_anuncio as m')
    .innerJoin('anuncios as a', (j) => j.onRef('a.org_id', '=', 'm.org_id').onRef('a.meta_anuncio_id', '=', 'm.meta_anuncio_id'))
    .leftJoin('campanas as cp', (j) => j.onRef('cp.org_id', '=', 'a.org_id').onRef('cp.meta_campana_id', '=', 'a.meta_campana_id'))
    .select([
      pieza.as('pieza'),
      'a.meta_campana_id as campana',
      etapaDelNombre('cp.nombre').as('etapa'),
      sql<string | null>`sum(m.impresiones)`.as('impresiones'),
    ])
    .groupBy([pieza, 'a.meta_campana_id', 'cp.nombre'])
    /* El orden decide cuál gana: la primera de cada pieza. Sin él, la que gana es la que la base devuelva primero. */
    .orderBy(pieza)
    .orderBy(sql`sum(m.impresiones) desc nulls last`)
    .orderBy('a.meta_campana_id')
    .execute();
  const etapas = new Map<string, Etapa | null>();
  for (const c of porCampana) if (!etapas.has(c.pieza)) etapas.set(c.pieza, (c.etapa as Etapa | null) ?? null);

  const parDe = (f: Record<string, unknown>, clave: string) =>
    f[`i_${clave}`] === null || f[`i_${clave}`] === undefined
      ? null
      : { cantidad: Number(f[`c_${clave}`] ?? 0), impresiones: Number(f[`i_${clave}`]) };

  const nombre = (pieza: string) => (pieza === '' ? PIEZA_SIN_NOMBRE : pieza);
  return filas.map((f) => ({
    pieza: nombre(f.pieza),
    impresiones: Number(f.impresiones ?? 0),
    clics: Number(f.clics ?? 0),
    vistas: parDe(f as Record<string, unknown>, 'videoView'),
    clicsAlEnlace: parDe(f as Record<string, unknown>, 'linkClick'),
    landing: parDe(f as Record<string, unknown>, 'landingPageView'),
    frecuencia: f.frecuencia === null ? null : Number(f.frecuencia),
    impresionesConFrecuencia: Number(f.impresionesConFrecuencia ?? 0),
    etapa: etapas.get(f.pieza) ?? null,
    primerDia: f.primerDia,
    ultimoDia: f.ultimoDia,
    entregando: Boolean(f.entregando),
  }));
}

export interface LecturaDeCreative {
  calidad: CalidadDeLosCreativos;
  rendimiento: RendimientoDeLosCreativos;
  fatiga: FatigaDeLosCreativos;
  enlaces: EnlaceDePieza[];
  /** Lo que dibuja el front del prototipo. */
  pantalla: PantallaDeCreativeArmada;
}

/** Lo que lee la pantalla de Creative en una ventana. Corre dentro de `conOrganizacion`. */
export async function lecturaDeCreative(dias: number): Promise<LecturaDeCreative> {
  const calidad = await calidadDelCreativo(dias);
  const rendimiento = await rendimientoDelCreativo(dias);
  const fatiga = await fatigaDelCreativo(dias);
  const enlaces = await enlacesDeLasPiezas();
  const entrega = await entregaDeLasPiezas(dias);
  const miniaturas = await miniaturasDeLasPiezas();
  return {
    calidad,
    rendimiento,
    fatiga,
    enlaces,
    pantalla: armarCreative({ calidad, rendimiento, fatiga, entrega, miniaturas, enlaces }),
  };
}
