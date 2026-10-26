// La lectura de Creative: lo que dibuja el front del prototipo, hecho en el servidor.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ES (docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, CF1-15)
//
// La pestaña vuelve al front del prototipo: la tira de seis cifras, la biblioteca partida en «Funciona» y «No
// funciona» para el criterio elegido, la tarjeta de cada pieza con su miniatura, la ficha y, debajo, una fila de
// cifras. Este módulo compone lo que ya se mide —`calidadDelCreativo`, `rendimientoDelCreativo`, `fatigaDelCreativo`,
// el enlace manual— más dos lecturas nuevas: la entrega de cada pieza y su miniatura, que viene de Meta
// (`recolectarActivos.ts`, la `078`) y, si Meta no la tiene, de los contactos (`miniaturaDelContacto.ts`).
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
//   · **La pieza es (cliente, nombre)** (el nivel 3): el nombre del anuncio normalizado (`llaveDelCreativo`), la misma
//     llave de los tres módulos, en el cliente de sus anuncios o de sus contactos. Su `clave` es `idDeLaPieza`: con un
//     solo cliente, el nombre de siempre. Lo que se dibuja es el `nombre`, y con piezas de dos clientes o más, su
//     `cliente`.
//   · **«Funciona» es contra la etapa** (CF1-08): cada pieza contra el promedio de las piezas de su etapa; con piezas de
//     dos clientes o más, de su etapa en su cliente, como la señal del ICP.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { calidadDelCreativo, type CalidadDeLosCreativos } from './calidadDelCreativo.ts';
import { ventanaDeMetricas } from './costoDelAnuncio.ts';
import { ETAPAS, type Etapa, clientesDeCreative, etapaDelNombre, llaveDelCreativo } from './creativo.ts';
import { enlacesDeLasPiezas, type EnlaceDePieza } from './enlaceDeLaPieza.ts';
import { idDeLaPieza, llaveInterna, type ClientesDeCreative } from './idDeLaPieza.ts';
import { fatigaDelCreativo, type FatigaDeLosCreativos } from './fatigaDelCreativo.ts';
import { miniaturasDeLasPiezas } from './miniaturaDelContacto.ts';
import { activosDeLasPiezas, type ActivoDeLaPieza } from './recolectarActivos.ts';
import { PIEZA_SIN_NOMBRE, PISO_DE_IMPRESIONES, rendimientoDelCreativo, type RendimientoDeLosCreativos } from './rendimientoDelCreativo.ts';
import { LARGO_MAXIMO_DE_MINIATURA, enlaceDePublicacion, type Red } from './urlExterna.ts';

// ─── Los tipos ──────────────────────────────────────────────────────────────

/**
 * Por qué una cifra no tiene valor: `sin_contactos` —la pieza no trajo contactos en la ventana—, `sin_puntaje` —el CRM
 * de su cliente no tiene el campo del ICP—, `sin_entrega` —la pieza no tuvo impresiones en la ventana—, `bajo_el_piso` —menos de 10
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
  /**
   * El identificador de la pieza (`idDeLaPieza`): el nombre si es del principal —con un cliente, siempre—, y
   * `<cuentaId>:<nombre>` si es de otro. Es la llave de los criterios y de la ficha; no se dibuja.
   */
  clave: string;
  /** El nombre de la pieza, normalizado: lo que se dibuja. */
  nombre: string;
  /** El cliente de la pieza (el nivel 3), por su id de `identidad.cuentas`: con él se carga su link manual. */
  cuentaId: string;
  /** El nombre de su cliente cuando la lectura trae piezas de dos clientes o más; con uno, `null` y no se dibuja. */
  cliente: string | null;
  etapa: ClaveDeEtapa;
  /** Impresiones en alguno de los últimos 3 días del calendario, hoy incluido (CF1-09). */
  estado: 'entregando' | 'sin_entrega';
  cifras: CifrasDeLaPieza;
  /** `true`: la fatiga tiene veredicto y la pieza perdió gancho; `null`: no hay veredicto. */
  perdiendoGancho: boolean | null;
  /** La imagen del anuncio: la de Meta si está vigente, si no la de los contactos (CF1-12), o `null`. */
  miniatura: string | null;
  /** Adónde lleva «Ver en Facebook/Instagram»: el enlace manual, si no el post que dio Meta, si no el de la
   *  miniatura de los contactos. */
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
    /**
     * La curva del video (Meta directo, `102`): de cada 1 reproducción, cuántas llegaron al 25, 50, 75 y 100 %. `null`
     * sin video de Meta en la ventana (lo traído de GoHighLevel no lo tenía) o con menos reproducciones que el piso.
     */
    curvaDelVideo: { p25: number; p50: number; p75: number; p100: number; reproducciones: number } | null;
  };
}

export interface GruposDeUnCriterio {
  funciona: string[];
  noFunciona: string[];
  /** El promedio de cada etapa para este criterio, de 0 a 1 en las tasas. `null` = ninguna pieza con valor. */
  promedioPorEtapa: Record<ClaveDeEtapa, number | null>;
  /** Las piezas que son la única de su etapa con valor: «Funciona» sin contra quién compararse (CF1-08). */
  unicas: string[];
  /**
   * Con piezas de dos clientes o más (el nivel 3): el promedio de cada etapa EN CADA CLIENTE, que es contra el que se
   * comparó cada pieza; `promedioPorEtapa` queda como el de todas. Con un cliente no viaja.
   */
  promediosPorCliente?: { cuentaId: string; cliente: string | null; promedioPorEtapa: Record<ClaveDeEtapa, number | null> }[];
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
  /** El cliente de los anuncios de la pieza (el nivel 3). */
  cuentaId: string;
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
  /** Lo del video de Meta directo en la ventana: las sumas de cada cuartil y de las reproducciones. `null` sin video. */
  video: { p25: number; p50: number; p75: number; p100: number; reproducciones: number } | null;
}

/** Cuántas reproducciones hacen falta para dar la retención de una pieza: con menos, un video de 3 vistas manda. */
export const PISO_DE_REPRODUCCIONES = 100;

/** La retención y la curva del video de una pieza, con su piso. */
function retencionDe(v: EntregaDeLaPieza['video']): { cifra: Cifra; curva: PiezaDeCreative['ficha']['curvaDelVideo'] } {
  if (v === null || v.reproducciones === 0) return { cifra: sinValor('sin_fuente'), curva: null };
  if (v.reproducciones < PISO_DE_REPRODUCCIONES) return { cifra: sinValor('bajo_el_piso'), curva: null };
  const r = v.reproducciones;
  return {
    cifra: conValor(v.p100 / r),
    curva: { p25: v.p25 / r, p50: v.p50 / r, p75: v.p75 / r, p100: v.p100 / r, reproducciones: r },
  };
}

export interface EntradaDeCreative {
  calidad: CalidadDeLosCreativos;
  rendimiento: RendimientoDeLosCreativos;
  fatiga: FatigaDeLosCreativos;
  entrega: readonly EntregaDeLaPieza[];
  miniaturas: ReadonlyMap<string, string>;
  /** Lo leído de Meta por pieza (`078`). Vacío mientras la empresa no cargue su token. */
  activos: ReadonlyMap<string, ActivoDeLaPieza>;
  enlaces: readonly EnlaceDePieza[];
  /** Los clientes a la vista y el principal: con ellos se arma la `clave` de cada pieza y se nombra su cliente. */
  clientes: ClientesDeCreative;
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

/** El promedio de un criterio sobre unas piezas, y cuántas tienen valor. `null` = ninguna con valor. */
function promedioDe(piezas: readonly PiezaDeCreative[], entrega: ReadonlyMap<string, EntregaDeLaPieza>, criterio: Criterio) {
  const medidas = piezas
    .map((p) => medida(p, entrega.get(p.clave), criterio))
    .filter((m): m is { valor: number; num: number; den: number } => m !== null);
  if (medidas.length === 0) return { promedio: null, conValor: 0 };
  /* Las tasas, pesadas —la suma de numeradores sobre la de denominadores—; los conteos, el promedio simple. */
  const promedio =
    criterio === 'hookRate'
      ? medidas.reduce((s, m) => s + m.num, 0) / medidas.reduce((s, m) => s + m.den, 0)
      : medidas.reduce((s, m) => s + m.valor, 0) / medidas.length;
  return { promedio, conValor: medidas.length };
}

/** El promedio de cada etapa sobre unas piezas. */
function porEtapa(piezas: readonly PiezaDeCreative[], entrega: ReadonlyMap<string, EntregaDeLaPieza>, criterio: Criterio) {
  return Object.fromEntries(
    CLAVES_DE_ETAPA.map((etapa) => [etapa, promedioDe(piezas.filter((p) => p.etapa === etapa), entrega, criterio).promedio]),
  ) as Record<ClaveDeEtapa, number | null>;
}

/**
 * Los dos grupos de un criterio, contra el promedio de la etapa (CF1-08).
 *
 * Con piezas de dos clientes o más (`varios`, el nivel 3), cada pieza se compara con las de su etapa EN SU CLIENTE,
 * como la señal del ICP (`lib/agentes/detectores/creative.ts`): con el promedio de los dos, las piezas de un cliente
 * chico quedaban siempre en «No funciona», y la pantalla y la señal decían cosas distintas. La única es la única de
 * su etapa en su cliente. Con un cliente, lo de siempre.
 */
function agrupar(
  piezas: readonly PiezaDeCreative[],
  entrega: ReadonlyMap<string, EntregaDeLaPieza>,
  criterio: Criterio,
  varios: boolean,
): GruposDeUnCriterio {
  const promedioPorEtapa = porEtapa(piezas, entrega, criterio);
  const grupoDe = (p: PiezaDeCreative) => (varios ? `${p.cuentaId}·${p.etapa}` : p.etapa);
  const grupos = new Map<string, { promedio: number | null; conValor: number }>();
  for (const g of new Set(piezas.map(grupoDe))) {
    grupos.set(g, promedioDe(piezas.filter((p) => grupoDe(p) === g), entrega, criterio));
  }
  const funciona: PiezaDeCreative[] = [];
  const noFunciona: PiezaDeCreative[] = [];
  const unicas: string[] = [];
  for (const p of piezas) {
    const v = p.cifras[criterio].valor;
    const { promedio, conValor } = grupos.get(grupoDe(p))!;
    if (v === null || promedio === null) {
      noFunciona.push(p);
      continue;
    }
    if (conValor === 1) unicas.push(p.clave);
    (v >= promedio ? funciona : noFunciona).push(p);
  }
  /* De mayor a menor; sin valor al final; empate por nombre —y entre dos homónimos, por cliente—, para que el orden
     no dependa de la consulta. */
  const porNombre = (a: PiezaDeCreative, b: PiezaDeCreative) => a.nombre.localeCompare(b.nombre) || a.cuentaId.localeCompare(b.cuentaId);
  const orden = (a: PiezaDeCreative, b: PiezaDeCreative) => {
    const va = a.cifras[criterio].valor;
    const vb = b.cifras[criterio].valor;
    if (va === null && vb === null) return porNombre(a, b);
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va || porNombre(a, b);
  };
  /* Los promedios contra los que se comparó cada pieza, cliente por cliente, en el orden en que aparecen sus piezas. */
  const deCadaCliente = () =>
    [...new Map(piezas.map((p) => [p.cuentaId, p.cliente])).entries()].map(([cuentaId, cliente]) => ({
      cuentaId,
      cliente,
      promedioPorEtapa: porEtapa(piezas.filter((p) => p.cuentaId === cuentaId), entrega, criterio),
    }));
  return {
    funciona: funciona.sort(orden).map((p) => p.clave),
    noFunciona: noFunciona.sort(orden).map((p) => p.clave),
    promedioPorEtapa,
    unicas,
    ...(varios ? { promediosPorCliente: deCadaCliente() } : {}),
  };
}

/** Lo que dibuja la pantalla, desde lo leído. Sin base: la prueba lo arma con números a mano. */
export function armarCreative(e: EntradaDeCreative): PantallaDeCreativeArmada {
  const sinPuntaje = (cuentaId: string) => e.calidad.campoDeIcp === null || e.calidad.cuentasSinPuntaje.includes(cuentaId);
  /* La pieza es (cliente, nombre) (el nivel 3): cada lectura se indexa por la `clave` (`idDeLaPieza`), la misma de las
     miniaturas y los activos, y de las que traen piezas se anota de quién es cada una y cómo se llama. */
  const id = (cuentaId: string, nombre: string) => idDeLaPieza(cuentaId, nombre, e.clientes.principal);
  const deLaPieza = new Map<string, { cuentaId: string; nombre: string }>();
  const anotar = (cuentaId: string, nombre: string) => {
    const clave = id(cuentaId, nombre);
    if (!deLaPieza.has(clave)) deLaPieza.set(clave, { cuentaId, nombre });
    return clave;
  };
  const entrega = new Map(e.entrega.map((x) => [anotar(x.cuentaId, x.pieza), x]));
  const rendimiento = new Map(e.rendimiento.filas.map((f) => [anotar(f.cuentaId, f.creativo), f]));
  const fatiga = new Map(e.fatiga.filas.map((f) => [id(f.cuentaId, f.creativo), f]));
  const enlaces = new Map(e.enlaces.map((x) => [id(x.cuentaId, x.pieza), x]));

  /* La calidad viene por (pieza, etapa del contacto): se suma por pieza, y la etapa con más contactos es la de
     respaldo cuando la campaña de la pieza no dice su etapa —no tiene anuncios, o su campaña con más impresiones no
     trae TOFU, MOFU ni BOFU en el nombre—. Empate de contactos: la etapa que va antes en el embudo, para que la pieza no
     cambie de grupo según el orden en que la base devuelva las filas. */
  const calidad = new Map<string, { contactos: number; calificados: number; agendaron: number; etapa: Etapa | null; deLaEtapa: number }>();
  for (const f of e.calidad.filas) {
    if (f.creativo === null) continue;
    const clave = anotar(f.cuentaId, f.creativo);
    const ya = calidad.get(clave) ?? { contactos: 0, calificados: 0, agendaron: 0, etapa: null, deLaEtapa: -1 };
    ya.contactos += f.contactos;
    ya.calificados += f.calificados;
    ya.agendaron += f.agendaron;
    const antes = f.etapa !== null && (ya.etapa === null || ETAPAS.indexOf(f.etapa) < ETAPAS.indexOf(ya.etapa));
    if (f.contactos > ya.deLaEtapa || (f.contactos === ya.deLaEtapa && antes)) {
      ya.etapa = f.etapa;
      ya.deLaEtapa = f.contactos;
    }
    calidad.set(clave, ya);
  }

  /* Una pieza entra si hizo algo EN LA VENTANA: trajo contactos, tuvo impresiones o gastó. La entrega trae todas las
     piezas de la historia —sus días con entrega son de toda la historia—, y sin este filtro «7 días» listaba las 32
     piezas de siempre, 23 de ellas en «No funciona» con todo en «—». */
  const activa = (clave: string) =>
    calidad.has(clave) || (entrega.get(clave)?.impresiones ?? 0) > 0 || (rendimiento.get(clave)?.gasto ?? 0) > 0;
  /* Por nombre, y entre dos homónimos por cliente: con un cliente, el orden de siempre. */
  const claves = [...deLaPieza.keys()].filter(activa).sort((a, b) => {
    const x = deLaPieza.get(a)!;
    const y = deLaPieza.get(b)!;
    return x.nombre.localeCompare(y.nombre) || x.cuentaId.localeCompare(y.cuentaId);
  });
  /* El cliente se dibuja —y cada pieza se compara dentro del suyo— cuando las piezas de la lectura son de dos clientes
     o más. Con uno no hay nada que distinguir. */
  const varios = new Set(claves.map((k) => deLaPieza.get(k)!.cuentaId)).size >= 2;
  const piezas: PiezaDeCreative[] = claves.map((clave) => {
    const { cuentaId, nombre } = deLaPieza.get(clave)!;
    const q = calidad.get(clave);
    const r = rendimiento.get(clave);
    const x = entrega.get(clave);
    const f = fatiga.get(clave);
    const hayEntrega = (x?.impresiones ?? 0) > 0;
    /* Meta primero: tiene la imagen de todo anuncio, y la de los contactos llega sólo con los leads de un anuncio de
       Instagram que abre un DM (3 contactos de 526, medido el 2026-10-15). */
    const deMeta = e.activos.get(clave);
    const deLosContactos = e.miniaturas.get(clave) ?? null;
    const miniatura = deMeta?.miniatura ?? deLosContactos;
    const manual = enlaces.get(clave);
    // La miniatura de los contactos es un enlace de Facebook (`/ads/image/`); la del CDN de Meta no lleva a ningún post.
    const otro =
      (deMeta?.publicacion ? enlaceDePublicacion(deMeta.publicacion) : null) ??
      (deLosContactos === null ? null : enlaceDePublicacion(deLosContactos, LARGO_MAXIMO_DE_MINIATURA));
    return {
      clave,
      nombre,
      cuentaId,
      cliente: varios ? (e.clientes.nombres.get(cuentaId) ?? null) : null,
      etapa: x?.etapa ?? q?.etapa ?? 'sin_etapa',
      estado: x?.entregando ? 'entregando' : 'sin_entrega',
      cifras: {
        calificados: !q ? sinValor('sin_contactos') : sinPuntaje(cuentaId) ? sinValor('sin_puntaje') : conValor(q.calificados),
        agendas: !q ? sinValor('sin_contactos') : conValor(q.agendaron),
        hookRate: sobreImpresiones(x?.vistas ?? null, hayEntrega),
        // Meta directo: la parte de las reproducciones que llegó al final. Sin video de Meta, sin fuente.
        retencion: retencionDe(x?.video ?? null).cifra,
        impresiones: hayEntrega ? conValor(x!.impresiones) : sinValor('sin_entrega'),
        frecuencia: !hayEntrega ? sinValor('sin_entrega') : x!.frecuencia !== null ? conValor(x!.frecuencia) : sinValor('sin_reporte'),
      },
      perdiendoGancho: f?.fatigado ?? null,
      miniatura,
      enlace: manual ? { url: manual.url, red: manual.red } : otro ? { url: otro.url, red: otro.red } : null,
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
        curvaDelVideo: retencionDe(x?.video ?? null).curva,
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
    calificados: conCalidad.length === 0 ? sinValor('sin_contactos') : [...calidad.keys()].every((k) => sinPuntaje(deLaPieza.get(k)!.cuentaId)) ? sinValor('sin_puntaje') : conValor(conCalidad.reduce((s, q) => s + q.calificados, 0)),
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

  const criterios = Object.fromEntries(CRITERIOS.map((c) => [c, agrupar(piezas, entrega, c, varios)])) as Record<Criterio, GruposDeUnCriterio>;

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
 * sin nombre van en su pieza rotulada, como en `rendimientoDelCreativo`. La pieza es (cliente, nombre) (el nivel 3):
 * todo se agrupa también por el cliente de los anuncios. Corre dentro de `conOrganizacion`.
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
      'a.cuenta_id as cuentaId',
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
      // El video de Meta directo (`102`): sólo los anuncio-día que traen las reproducciones, para que los cuartiles y su
      // denominador sean de los mismos días.
      ...(['p25', 'p50', 'p75', 'p100', 'reproducciones'] as const).map((k) =>
        sql<string | null>`sum((m.video ->> ${k})::numeric) filter (where ${enVentana} and m.video ? 'reproducciones')`.as(`v_${k}`),
      ),
    ])
    .groupBy(['a.cuenta_id', pieza])
    .execute();

  /* La etapa: la de la campaña de la que más impresiones tuvo la pieza en toda la historia; empate, el id menor. En
     una consulta aparte y no como subconsulta correlacionada: con el `group by` de arriba, PostgreSQL rechaza la
     referencia a `a.nombre` desde adentro (`42803`), el mismo error que documenta `etapaDelNombre`. */
  const porCampana = await datos()
    .selectFrom('metricas_de_anuncio as m')
    .innerJoin('anuncios as a', (j) => j.onRef('a.org_id', '=', 'm.org_id').onRef('a.meta_anuncio_id', '=', 'm.meta_anuncio_id'))
    .leftJoin('campanas as cp', (j) => j.onRef('cp.org_id', '=', 'a.org_id').onRef('cp.meta_campana_id', '=', 'a.meta_campana_id'))
    .select([
      'a.cuenta_id as cuentaId',
      pieza.as('pieza'),
      'a.meta_campana_id as campana',
      etapaDelNombre('cp.nombre').as('etapa'),
      sql<string | null>`sum(m.impresiones)`.as('impresiones'),
    ])
    .groupBy(['a.cuenta_id', pieza, 'a.meta_campana_id', 'cp.nombre'])
    /* El orden decide cuál gana: la primera de cada pieza. Sin él, la que gana es la que la base devuelva primero. */
    .orderBy('a.cuenta_id')
    .orderBy(pieza)
    .orderBy(sql`sum(m.impresiones) desc nulls last`)
    .orderBy('a.meta_campana_id')
    .execute();
  const etapas = new Map<string, Etapa | null>();
  for (const c of porCampana) {
    const llave = llaveInterna(c.cuentaId, c.pieza);
    if (!etapas.has(llave)) etapas.set(llave, (c.etapa as Etapa | null) ?? null);
  }

  const parDe = (f: Record<string, unknown>, clave: string) =>
    f[`i_${clave}`] === null || f[`i_${clave}`] === undefined
      ? null
      : { cantidad: Number(f[`c_${clave}`] ?? 0), impresiones: Number(f[`i_${clave}`]) };

  const nombre = (pieza: string) => (pieza === '' ? PIEZA_SIN_NOMBRE : pieza);
  return filas.map((f) => ({
    pieza: nombre(f.pieza),
    cuentaId: f.cuentaId,
    impresiones: Number(f.impresiones ?? 0),
    clics: Number(f.clics ?? 0),
    vistas: parDe(f as Record<string, unknown>, 'videoView'),
    clicsAlEnlace: parDe(f as Record<string, unknown>, 'linkClick'),
    landing: parDe(f as Record<string, unknown>, 'landingPageView'),
    frecuencia: f.frecuencia === null ? null : Number(f.frecuencia),
    impresionesConFrecuencia: Number(f.impresionesConFrecuencia ?? 0),
    etapa: etapas.get(llaveInterna(f.cuentaId, f.pieza)) ?? null,
    primerDia: f.primerDia,
    ultimoDia: f.ultimoDia,
    entregando: Boolean(f.entregando),
    video: (() => {
      const v = f as unknown as Record<string, string | null>;
      if (v.v_reproducciones === null || v.v_reproducciones === undefined) return null;
      return {
        p25: Number(v.v_p25 ?? 0),
        p50: Number(v.v_p50 ?? 0),
        p75: Number(v.v_p75 ?? 0),
        p100: Number(v.v_p100 ?? 0),
        reproducciones: Number(v.v_reproducciones),
      };
    })(),
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
  // Una sola lectura de los clientes para la clave de toda la pantalla: las miniaturas y los activos la reciben.
  const clientes = await clientesDeCreative();
  const miniaturas = await miniaturasDeLasPiezas(clientes);
  const activos = await activosDeLasPiezas(clientes);
  return {
    calidad,
    rendimiento,
    fatiga,
    enlaces,
    pantalla: armarCreative({ calidad, rendimiento, fatiga, entrega, miniaturas, activos, enlaces, clientes }),
  };
}
