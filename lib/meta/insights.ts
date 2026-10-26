// La Marketing API de Meta: la estructura de una cuenta publicitaria y lo que entregó cada día. SÓLO LECTURA.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ REEMPLAZA AL AD MANAGER DE GOHIGHLEVEL (Meta directo, M3)
//
// GoHighLevel daba 11 campos fijos, una llamada por campaña y por día, una serie que se cortaba en 25 filas, y nada de
// video, desgloses, presupuesto, moneda ni zona (`docs/creative/14`, `docs/acquisition/08`). Meta, con el token de la
// conexión del cliente, da todo eso por cuenta publicitaria: una consulta de insights por rango trae todos los anuncios
// de todos los días, paginada.
//
// ── LAS REGLAS ─────────────────────────────────────────────────────────────────────
//
//   · Todo por `pedirAMeta`: el token en la cabecera, con su `appsecret_proof` si es de nuestra app.
//   · Un pedido demasiado grande (Meta responde «reduce the amount of data», código 1 / subcódigo 1487534) se parte en
//     dos mitades del rango, hasta un día. Así no hace falta el modo asíncrono, que pide escribir.
//   · Los números de Meta llegan como texto: se leen con `numero()`, y lo que no se puede leer se CUENTA (`ilegibles`),
//     no se tira en silencio: un cambio de forma de Meta tiene que verse en el sello.
// ═══════════════════════════════════════════════════════════════════════════════
import type { Respuesta } from '../http/cliente.ts';
import { fallaDeMeta, pedirAMeta, type FallaDeMeta } from './graph.ts';

/** Cómo se habla con una cuenta: su token, si es de nuestra app, y quién recibe el uso de la cuota. */
export interface LlaveDeMeta {
  token: string;
  conPrueba: boolean;
  alResponder?: (cabeceras: Headers) => void;
}

export type Lectura<T> =
  | { tipo: 'listo'; datos: T; llamadas: number }
  /** `demasiado` = Meta pidió un pedido más chico: quien pidió un rango lo parte. */
  | { tipo: 'falla'; motivo: FallaDeMeta; llamadas: number; demasiado?: boolean };

/** Un número de Meta (llega como texto o número), o `null` si no se puede leer. */
export function numero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Cuántas páginas se leen como mucho por pedido. 50 × 500 filas: una cuenta con miles de anuncios activos. */
const PAGINAS = 50;

type Pagina<T> = { data?: T[]; paging?: { cursors?: { after?: string }; next?: string } };

/** Lee todas las páginas de un pedido de lista. */
async function todas<T>(ruta: string, llave: LlaveDeMeta, parametros: Record<string, string>): Promise<Lectura<T[]>> {
  const filas: T[] = [];
  let llamadas = 0;
  let despues: string | undefined;
  for (let i = 0; i < PAGINAS; i += 1) {
    const p: Record<string, string> = { ...parametros };
    if (despues) p.after = despues;
    const r: Respuesta<Pagina<T>> = await pedirAMeta<Pagina<T>>(ruta, llave.token, p, {
      conPrueba: llave.conPrueba,
      alResponder: llave.alResponder,
    });
    llamadas += 1;
    if (r.tipo !== 'datos') return { tipo: 'falla', motivo: fallaDeMeta(r), llamadas, ...(esDemasiado(r) ? { demasiado: true } : {}) };
    filas.push(...(r.datos.data ?? []));
    despues = r.datos.paging?.next ? r.datos.paging.cursors?.after : undefined;
    if (!despues) break;
  }
  return { tipo: 'listo', datos: filas, llamadas };
}

/** ¿Meta pidió un pedido más chico? Es el código 1 con el subcódigo 1487534, o el texto que lo dice. */
function esDemasiado(r: Exclude<Respuesta<unknown>, { tipo: 'datos' }>): boolean {
  if (r.tipo !== 'rechazado') return false;
  return r.subnumero === 1487534 || (r.numero === 1 && /reduce the amount of data/i.test(r.detalle ?? ''));
}

// ═══════════════════════════════════════════════════════════════════════════════
// LA ESTRUCTURA: CAMPAÑAS, CONJUNTOS Y ANUNCIOS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CampanaDeMeta {
  id: string;
  nombre: string | null;
  estado: string | null;
  estadoEfectivo: string | null;
  objetivo: string | null;
  presupuestoDiario: number | null;
  presupuestoTotal: number | null;
  inicio: Date | null;
  fin: Date | null;
}

export interface ConjuntoDeMeta {
  id: string;
  campana: string | null;
  nombre: string | null;
  estado: string | null;
  estadoEfectivo: string | null;
  presupuestoDiario: number | null;
  presupuestoTotal: number | null;
  optimizacion: string | null;
}

export interface AnuncioDeMeta {
  id: string;
  conjunto: string | null;
  campana: string | null;
  nombre: string | null;
  estado: string | null;
  estadoEfectivo: string | null;
}

const ID = /^\d{1,30}$/;
const texto = (v: unknown, tope = 500): string | null => (typeof v === 'string' && v.trim() !== '' ? v.slice(0, tope) : null);
const id = (v: unknown): string | null => (typeof v === 'string' && ID.test(v) ? v : null);
const fecha = (v: unknown): Date | null => {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Los presupuestos de Meta vienen en la unidad mínima de la moneda (centavos para las de dos decimales). Se guardan en
 * la unidad normal: el decimal de la moneda lo da `catalogo.monedas`; sin saberlo, se asume 2, que es el de casi todas.
 */
export function presupuesto(v: unknown, decimales = 2): number | null {
  const n = numero(v);
  return n === null ? null : n / 10 ** decimales;
}

/** La estructura de una cuenta publicitaria: sus campañas, conjuntos y anuncios (incluidos los pausados). */
export async function estructuraDeLaCuenta(
  act: string,
  llave: LlaveDeMeta,
  decimales = 2,
): Promise<Lectura<{ campanas: CampanaDeMeta[]; conjuntos: ConjuntoDeMeta[]; anuncios: AnuncioDeMeta[] }>> {
  let llamadas = 0;
  const c = await todas<Record<string, unknown>>(`${act}/campaigns`, llave, {
    fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time',
    limit: '200',
  });
  llamadas += c.llamadas;
  if (c.tipo !== 'listo') return { ...c, llamadas };
  const s = await todas<Record<string, unknown>>(`${act}/adsets`, llave, {
    fields: 'id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal',
    limit: '200',
  });
  llamadas += s.llamadas;
  if (s.tipo !== 'listo') return { ...s, llamadas };
  const a = await todas<Record<string, unknown>>(`${act}/ads`, llave, {
    fields: 'id,name,adset_id,campaign_id,status,effective_status',
    limit: '200',
  });
  llamadas += a.llamadas;
  if (a.tipo !== 'listo') return { ...a, llamadas };

  const campanas: CampanaDeMeta[] = [];
  for (const f of c.datos) {
    const i = id(f.id);
    if (!i) continue;
    campanas.push({
      id: i,
      nombre: texto(f.name),
      estado: texto(f.status, 40),
      estadoEfectivo: texto(f.effective_status, 40),
      objetivo: texto(f.objective, 60),
      presupuestoDiario: presupuesto(f.daily_budget, decimales),
      presupuestoTotal: presupuesto(f.lifetime_budget, decimales),
      inicio: fecha(f.start_time),
      fin: fecha(f.stop_time),
    });
  }
  const conjuntos: ConjuntoDeMeta[] = [];
  for (const f of s.datos) {
    const i = id(f.id);
    if (!i) continue;
    conjuntos.push({
      id: i,
      campana: id(f.campaign_id),
      nombre: texto(f.name),
      estado: texto(f.status, 40),
      estadoEfectivo: texto(f.effective_status, 40),
      presupuestoDiario: presupuesto(f.daily_budget, decimales),
      presupuestoTotal: presupuesto(f.lifetime_budget, decimales),
      optimizacion: texto(f.optimization_goal, 60),
    });
  }
  const anuncios: AnuncioDeMeta[] = [];
  for (const f of a.datos) {
    const i = id(f.id);
    if (!i) continue;
    anuncios.push({
      id: i,
      conjunto: id(f.adset_id),
      campana: id(f.campaign_id),
      nombre: texto(f.name),
      estado: texto(f.status, 40),
      estadoEfectivo: texto(f.effective_status, 40),
    });
  }
  return { tipo: 'listo', datos: { campanas, conjuntos, anuncios }, llamadas };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ENTREGÓ CADA DÍA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * La clave de una acción de Meta, en la forma que ya leen las pantallas (la de GoHighLevel): `link_click` →
 * `linkClick`, `landing_page_view` → `landingPageView`, `onsite_conversion.messaging_first_reply` →
 * `onsiteConversion.messagingFirstReply`. Cada tramo separado por punto se pasa a camelCase y los puntos se quedan.
 */
export function claveDeLaAccion(tipo: string): string {
  return tipo
    .split('.')
    .map((tramo) => tramo.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase()))
    .join('.');
}

/** `[{action_type, value}]` de Meta → `{clave: número}`, contando lo que no se pudo leer. */
export function accionesDe(v: unknown): { acciones: Record<string, number> | null; ilegibles: number } {
  if (!Array.isArray(v)) return { acciones: null, ilegibles: 0 };
  const salida: Record<string, number> = {};
  let ilegibles = 0;
  for (const a of v) {
    const tipo = (a as { action_type?: unknown })?.action_type;
    const n = numero((a as { value?: unknown })?.value);
    if (typeof tipo !== 'string' || n === null) {
      ilegibles += 1;
      continue;
    }
    salida[claveDeLaAccion(tipo)] = n;
  }
  return { acciones: salida, ilegibles };
}

/** El primer valor de una lista de acciones de video (`[{action_type:'video_view', value}]`). */
function primero(v: unknown): number | null {
  return Array.isArray(v) && v.length > 0 ? numero((v[0] as { value?: unknown })?.value) : null;
}

/** Lo del video de una fila de insights: cuartiles, thruplay, reproducciones y tiempo medio. */
export function videoDe(f: Record<string, unknown>): Record<string, number> | null {
  const salida: Record<string, number> = {};
  const pares: [string, string][] = [
    ['p25', 'video_p25_watched_actions'],
    ['p50', 'video_p50_watched_actions'],
    ['p75', 'video_p75_watched_actions'],
    ['p95', 'video_p95_watched_actions'],
    ['p100', 'video_p100_watched_actions'],
    ['thruplay', 'video_thruplay_watched_actions'],
    ['reproducciones', 'video_play_actions'],
    ['segundosEnPromedio', 'video_avg_time_watched_actions'],
  ];
  for (const [clave, campo] of pares) {
    const n = primero(f[campo]);
    if (n !== null) salida[clave] = n;
  }
  return Object.keys(salida).length > 0 ? salida : null;
}

/** Una fila de insights a nivel de anuncio y día. */
export interface FilaDeAnuncio {
  fecha: string;
  anuncio: string;
  nombre: string | null;
  conjunto: string | null;
  campana: string | null;
  gasto: number | null;
  impresiones: number | null;
  clics: number | null;
  alcance: number | null;
  frecuencia: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  acciones: Record<string, number> | null;
  valores: Record<string, number> | null;
  video: Record<string, number> | null;
  moneda: string | null;
}

/** Una fila de insights a nivel de cuenta y día. */
export interface FilaDeCuenta {
  fecha: string;
  gasto: number | null;
  impresiones: number | null;
  clics: number | null;
  alcance: number | null;
  frecuencia: number | null;
  cpm: number | null;
  moneda: string | null;
}

/** Una fila de un desglose, a nivel de anuncio y día. */
export interface FilaDeDesglose {
  fecha: string;
  anuncio: string;
  valor: string;
  gasto: number | null;
  impresiones: number | null;
  clics: number | null;
  alcance: number | null;
  acciones: Record<string, number> | null;
  moneda: string | null;
}

export type Desglose = 'ubicacion' | 'plataforma' | 'edad_genero' | 'dispositivo' | 'pais';

/** Qué le pide cada desglose a Meta, y cómo se arma su valor. */
export const DESGLOSES: Readonly<Record<Desglose, { breakdowns: string; valor: (f: Record<string, unknown>) => string | null }>> = {
  ubicacion: {
    breakdowns: 'publisher_platform,platform_position',
    valor: (f) => (texto(f.publisher_platform, 40) && texto(f.platform_position, 60) ? `${f.publisher_platform} · ${f.platform_position}` : null),
  },
  plataforma: { breakdowns: 'publisher_platform', valor: (f) => texto(f.publisher_platform, 60) },
  edad_genero: { breakdowns: 'age,gender', valor: (f) => (texto(f.age, 20) && texto(f.gender, 20) ? `${f.age} · ${f.gender}` : null) },
  dispositivo: { breakdowns: 'device_platform', valor: (f) => texto(f.device_platform, 60) },
  pais: { breakdowns: 'country', valor: (f) => texto(f.country, 10) },
};

const CAMPOS_DEL_ANUNCIO = [
  'date_start',
  'ad_id',
  'ad_name',
  'adset_id',
  'campaign_id',
  'spend',
  'impressions',
  'clicks',
  'reach',
  'frequency',
  'ctr',
  'cpc',
  'cpm',
  'actions',
  'action_values',
  'video_p25_watched_actions',
  'video_p50_watched_actions',
  'video_p75_watched_actions',
  'video_p95_watched_actions',
  'video_p100_watched_actions',
  'video_thruplay_watched_actions',
  'video_play_actions',
  'video_avg_time_watched_actions',
  'account_currency',
].join(',');

const CAMPOS_DE_LA_CUENTA = 'date_start,spend,impressions,clicks,reach,frequency,cpm,account_currency';
const CAMPOS_DEL_DESGLOSE = 'date_start,ad_id,spend,impressions,clicks,reach,actions,account_currency';

const DIA = 86_400_000;
const isoDe = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Insights de una cuenta en un rango de días (`AAAA-MM-DD`, cerrados), día por día. Si Meta pide un pedido más chico,
 * el rango se parte en dos mitades hasta un día. `ilegibles` cuenta las filas o acciones que no se pudieron leer.
 */
async function insights(
  act: string,
  llave: LlaveDeMeta,
  desde: string,
  hasta: string,
  parametros: Record<string, string>,
): Promise<Lectura<Record<string, unknown>[]>> {
  const r = await todas<Record<string, unknown>>(`${act}/insights`, llave, {
    ...parametros,
    time_increment: '1',
    time_range: JSON.stringify({ since: desde, until: hasta }),
    limit: '500',
  });
  if (r.tipo === 'listo' || !r.demasiado || desde === hasta) return r;
  const d0 = new Date(`${desde}T00:00:00Z`).getTime();
  const d1 = new Date(`${hasta}T00:00:00Z`).getTime();
  const medio = isoDe(new Date(d0 + Math.floor((d1 - d0) / DIA / 2) * DIA));
  const siguiente = isoDe(new Date(new Date(`${medio}T00:00:00Z`).getTime() + DIA));
  const a = await insights(act, llave, desde, medio, parametros);
  if (a.tipo !== 'listo') return { ...a, llamadas: a.llamadas + r.llamadas };
  const b = await insights(act, llave, siguiente, hasta, parametros);
  if (b.tipo !== 'listo') return { ...b, llamadas: a.llamadas + b.llamadas + r.llamadas };
  return { tipo: 'listo', datos: [...a.datos, ...b.datos], llamadas: a.llamadas + b.llamadas + r.llamadas };
}

/** Lo que entregó cada anuncio, cada día del rango. */
export async function insightsPorAnuncio(
  act: string,
  llave: LlaveDeMeta,
  desde: string,
  hasta: string,
): Promise<Lectura<{ filas: FilaDeAnuncio[]; ilegibles: number }>> {
  const r = await insights(act, llave, desde, hasta, { level: 'ad', fields: CAMPOS_DEL_ANUNCIO });
  if (r.tipo !== 'listo') return r;
  const filas: FilaDeAnuncio[] = [];
  let ilegibles = 0;
  for (const f of r.datos) {
    const anuncio = id(f.ad_id);
    const dia = typeof f.date_start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.date_start) ? f.date_start : null;
    if (!anuncio || !dia) {
      ilegibles += 1;
      continue;
    }
    const acc = accionesDe(f.actions);
    const val = accionesDe(f.action_values);
    ilegibles += acc.ilegibles + val.ilegibles;
    filas.push({
      fecha: dia,
      anuncio,
      nombre: texto(f.ad_name),
      conjunto: id(f.adset_id),
      campana: id(f.campaign_id),
      gasto: numero(f.spend),
      impresiones: numero(f.impressions),
      clics: numero(f.clicks),
      alcance: numero(f.reach),
      frecuencia: numero(f.frequency),
      ctr: numero(f.ctr),
      cpc: numero(f.cpc),
      cpm: numero(f.cpm),
      acciones: acc.acciones,
      valores: val.acciones,
      video: videoDe(f),
      moneda: typeof f.account_currency === 'string' && /^[A-Z]{3}$/.test(f.account_currency) ? f.account_currency : null,
    });
  }
  return { tipo: 'listo', datos: { filas, ilegibles }, llamadas: r.llamadas };
}

/** El total de la cuenta, cada día del rango. Un día sin entrega no viene: quien lo guarda lo sabe y escribe 0. */
export async function insightsDeLaCuenta(act: string, llave: LlaveDeMeta, desde: string, hasta: string): Promise<Lectura<FilaDeCuenta[]>> {
  const r = await insights(act, llave, desde, hasta, { level: 'account', fields: CAMPOS_DE_LA_CUENTA });
  if (r.tipo !== 'listo') return r;
  const filas: FilaDeCuenta[] = [];
  for (const f of r.datos) {
    if (typeof f.date_start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f.date_start)) continue;
    filas.push({
      fecha: f.date_start,
      gasto: numero(f.spend),
      impresiones: numero(f.impressions),
      clics: numero(f.clicks),
      alcance: numero(f.reach),
      frecuencia: numero(f.frequency),
      cpm: numero(f.cpm),
      moneda: typeof f.account_currency === 'string' && /^[A-Z]{3}$/.test(f.account_currency) ? f.account_currency : null,
    });
  }
  return { tipo: 'listo', datos: filas, llamadas: r.llamadas };
}

/** Lo de cada anuncio por día, partido por un desglose. */
export async function insightsPorDesglose(
  act: string,
  llave: LlaveDeMeta,
  desglose: Desglose,
  desde: string,
  hasta: string,
): Promise<Lectura<FilaDeDesglose[]>> {
  const d = DESGLOSES[desglose];
  const r = await insights(act, llave, desde, hasta, { level: 'ad', fields: CAMPOS_DEL_DESGLOSE, breakdowns: d.breakdowns });
  if (r.tipo !== 'listo') return r;
  const filas: FilaDeDesglose[] = [];
  for (const f of r.datos) {
    const anuncio = id(f.ad_id);
    const valor = d.valor(f);
    if (!anuncio || !valor || typeof f.date_start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f.date_start)) continue;
    filas.push({
      fecha: f.date_start,
      anuncio,
      valor: valor.slice(0, 120),
      gasto: numero(f.spend),
      impresiones: numero(f.impressions),
      clics: numero(f.clicks),
      alcance: numero(f.reach),
      acciones: accionesDe(f.actions).acciones,
      moneda: typeof f.account_currency === 'string' && /^[A-Z]{3}$/.test(f.account_currency) ? f.account_currency : null,
    });
  }
  return { tipo: 'listo', datos: filas, llamadas: r.llamadas };
}
