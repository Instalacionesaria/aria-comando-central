// Las métricas de Meta Ads, a través de GoHighLevel. Tipo: cliente de proveedor.
//
// ═══════════════════════════════════════════════════════════════════════════════
// NO HACE FALTA CONECTAR META, Y ESO CONTRADICE LO QUE ESTE REPOSITORIO CONCLUYÓ
//
// `docs/estado actual/01-ACQUISITION.md` cerraba así: *«conectar Meta es trabajo de integración —app
// de Meta, token de larga duración, revisión de app, un recolector diario— y no de diseño de
// datos»*, y `docs/acquisition/13-EL-CONTRASTE.md` ponía la credencial ausente como el único freno
// de veintiún KPI.
//
// **Es falso, y se comprobó llamando.** GoHighLevel expone una API de Ad Manager bajo el scope
// `adPublishing`, y el Private Integration Token que ya usa el barrido la alcanza. Medido contra la
// subcuenta real el 2026-09-16, con `Version: 2021-07-28`:
//
//     GET /ad-publishing/facebook/integration      200 · status connected · act_1349863156073553
//     GET /ad-publishing/facebook/ad-accounts      200 · 92 cuentas
//     GET /ad-publishing/facebook/reporting        200 · serie DIARIA con gasto real
//     GET /ad-publishing/facebook/entity           200 · 61 campañas, 200 ad sets, 100 anuncios
//     GET /ad-publishing/facebook/reporting/list   200 · métricas POR ANUNCIO, con el adId de Meta
//
// La conclusión vieja no salió de una medición: salió de buscar columnas de gasto en nuestra base y
// no encontrarlas. Es exactamente el error que la migración `048` ya había nombrado —*«un `grep`
// sobre nuestro código prueba qué pedimos, nunca qué manda el proveedor»*— repetido un nivel más
// arriba: buscar en nuestro esquema prueba qué guardamos, nunca qué se puede pedir.
//
// ── TRES COSAS QUE LA ESPECIFICACIÓN NO DICE Y LA SONDA FIJÓ ─────────────────
//
//   1 · **`type` decide si se ve algo.** `AD_MANAGER` son las campañas creadas DENTRO de
//       GoHighLevel y devuelve vacío acá; `INTEGRATION` es la cuenta publicitaria conectada y
//       devuelve todo. Esta empresa lanza desde Business Manager, así que siempre `INTEGRATION`.
//
//   2 · **El enum de `listType` es en minúscula y plural**: `campaigns`, `adsets`, `ads`. No está
//       documentado. `CAMPAIGN`, `campaign`, `CAMPAIGNS` y otros diez candidatos dan 422
//       «listType must be a valid enum value».
//
//   3 · **El grano diario por anuncio se pide un día a la vez.** `groupBy` existe en `/reporting` y
//       se IGNORA en `/reporting/list`: con rango de tres días devuelve una fila agregada por
//       anuncio. Medido: 2026-09-10→12 da `spend 24,3`; 2026-09-11→11 da `spend 6,23`.
//
// ── LO QUE ESTA VÍA NO PUEDE DAR, PARA NO VOLVER A BUSCARLO ──────────────────
//
// Ninguna métrica de video: reproducciones, cuartiles 25/50/75/100, tiempo medio visto, retención de
// tres y de seis segundos. Tampoco `link clicks`, `link CTR` ni `landing page views`, ni el activo
// creativo. Son las seis del § 18.7 «video y creativo» más dos de «interacción», y el día que hagan
// falta la única fuente es Meta directo.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedirExterno } from '../http/cliente.ts';
import type { FalloDeGhl, ResultadoDeGhl } from './cliente.ts';

const BASE = 'https://services.leadconnectorhq.com';

/**
 * Medido: la familia de anuncios responde con la versión de contactos, no con la de calendarios.
 *
 * Y vale la advertencia que `conversaciones.ts` ya escribió, porque acá aplica igual: una `Version`
 * equivocada en este proveedor **no devuelve un error**, devuelve otra forma de respuesta. El
 * síntoma sería una tabla de anuncios vacía sin ningún fallo.
 */
const VERSION = '2021-07-28';

/**
 * El origen de las campañas. **Siempre `INTEGRATION` para esta empresa**, y por eso no es un
 * parámetro de las funciones de abajo: `AD_MANAGER` devolvió `grouped: []` y `totals` en cero en la
 * medición del 2026-09-16, porque no se crea ninguna campaña dentro de GoHighLevel.
 *
 * Queda como constante nombrada y no como literal suelto para que el día que alguien cree una
 * campaña desde el CRM haya un solo lugar donde decidir qué hacer con las dos poblaciones.
 */
const ORIGEN = 'INTEGRATION';

function cabeceras(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Version: VERSION, Accept: 'application/json' };
}

/** Igual que en `cliente.ts`, `conversaciones.ts` y `calendarios.ts`. Doce líneas antes que un acople. */
function traducirFallo(
  r: { tipo: 'sin_respuesta'; causa: string } | { tipo: 'rechazado'; estado: number; codigo: string },
): FalloDeGhl {
  if (r.tipo === 'sin_respuesta') return { tipo: 'sin_respuesta', causa: r.causa };
  if (r.estado === 401 || r.estado === 403) return { tipo: 'no_autorizado', estado: r.estado };
  if (r.estado === 429) return { tipo: 'demasiadas_peticiones', estado: r.estado };
  return { tipo: 'rechazado', estado: r.estado, codigo: r.codigo };
}

// ─── El 429, que este repositorio no manejaba ───────────────────────────────

/**
 * Cuántas veces se reintenta una llamada que el proveedor limitó, y cuánto se espera.
 *
 * ── POR QUÉ ESTO EXISTE ACÁ Y NO EN `pedirExterno` ──────────────────────────
 *
 * `lib/http/cliente.ts` hace **un solo `fetch` sin reintento**, y hasta hoy eso alcanzaba: el
 * barrido pide catorce operaciones por ciclo sobre un piso medido de ~1.392 llamadas por día. Este
 * colector agrega otro orden de magnitud —una llamada por campaña y por día— así que es el primero
 * que puede tocar el límite.
 *
 * Meterlo en `pedirExterno` cambiaría el comportamiento de las catorce operaciones que hoy andan,
 * incluida la de ENVIAR UN MENSAJE, donde un reintento automático puede mandarle dos mensajes a una
 * persona. Acá abajo sólo hay lecturas, así que reintentar es seguro por construcción.
 *
 * Y una honestidad que el repositorio ya dejó escrita en `cliente.ts:264`: **el código exacto que
 * devuelve GoHighLevel al pasarse del límite no está confirmado.** Su página detalla los límites y
 * las cabeceras pero no dice qué situación responde. Se reintenta el 429 —el caso conocido— y nada
 * más: un 400 reintentado es una llamada mal escrita pedida tres veces.
 */
const REINTENTOS = 3;
const ESPERA_BASE_MS = 1_200;

/** Espera con retroceso: 1,2 s, 2,4 s, 4,8 s. */
function esperar(ms: number): Promise<void> {
  return new Promise((listo) => setTimeout(listo, ms));
}

/**
 * Una lectura con reintento ante 429. Devuelve lo mismo que `pedirExterno`.
 *
 * `Retry-After` **no se lee**, y hay que decir por qué: `pedirExterno` no expone las cabeceras de la
 * respuesta, y hacerlo cambiaría su contrato para las catorce operaciones que ya lo usan. El
 * retroceso fijo es más tosco y no miente sobre lo que sabe.
 */
async function leer<T>(url: string, token: string): Promise<ResultadoDeGhl<T>> {
  let ultimo: { tipo: 'sin_respuesta'; causa: string } | { tipo: 'rechazado'; estado: number; codigo: string } | null =
    null;

  for (let intento = 0; intento <= REINTENTOS; intento++) {
    const r = await pedirExterno<T>(url, { cabeceras: cabeceras(token) });
    if (r.tipo === 'datos') return { tipo: 'datos', datos: r.datos };
    ultimo = r;
    /* Sólo el 429 se reintenta. Un 401 no mejora esperando —falta un alcance en el token— y un 422
       tampoco: es la llamada la que está mal escrita. */
    if (r.tipo !== 'rechazado' || r.estado !== 429) break;
    if (intento < REINTENTOS) await esperar(ESPERA_BASE_MS * 2 ** intento);
  }

  return { tipo: 'fallo', fallo: traducirFallo(ultimo!) };
}

/** Un número que llega como texto. El proveedor manda `"216.44"` y `74063` en la misma respuesta. */
function numero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null;
}

// ─── La integración: existe o no existe ─────────────────────────────────────

export interface IntegracionDeAnuncios {
  /** `connected` cuando hay una cuenta publicitaria vinculada. */
  estado: string | null;
  /** La cuenta publicitaria de Meta, con el prefijo `act_`. `null` = no hay ninguna vinculada. */
  cuentaId: string | null;
  /** Cuántas páginas de Facebook trae la vinculación. Sirve para decir qué se conectó. */
  paginas: number;
}

/**
 * Si esta subcuenta tiene Meta vinculado, y a qué cuenta publicitaria.
 *
 * **Es el paso 0 de todo lo demás y vale una llamada**: sin integración, las otras tres devuelven
 * vacío sin fallar, que es el peor modo posible — una pantalla de adquisición en cero se lee como
 * «no se invirtió nada», no como «no está conectado».
 */
export async function integracionDeAnuncios(acceso: {
  token: string;
  locationId: string;
}): Promise<ResultadoDeGhl<IntegracionDeAnuncios>> {
  const r = await leer<Record<string, unknown>>(
    `${BASE}/ad-publishing/facebook/integration?locationId=${encodeURIComponent(acceso.locationId)}`,
    acceso.token,
  );
  if (r.tipo !== 'datos') return r;
  const o = r.datos ?? {};
  return {
    tipo: 'datos',
    datos: {
      estado: texto(o.status),
      cuentaId: texto(o.fbAdAccountId),
      paginas: Array.isArray(o.pages) ? o.pages.length : 0,
    },
  };
}

// ─── La estructura: campañas, ad sets y anuncios ────────────────────────────

/** Los tres niveles de la jerarquía de Meta que `/entity` sabe devolver. */
export type NivelDeAnuncio = 'CAMPAIGN' | 'ADSET' | 'AD';

export interface EntidadDeAnuncio {
  /** El identificador NATIVO de Meta. Es la llave con la que se cruza contra `atribucion_primera`. */
  id: string;
  nombre: string;
  /**
   * El estado de entrega (§ 18.7, «Delivery status»). Sólo las campañas lo traen como `status`; los
   * ad sets traen `effectiveStatus` y los anuncios no traen ninguno — medido el 2026-09-16.
   */
  estado: string | null;
  /** La cuenta publicitaria dueña. Viaja para poder detectar si un día cambia. */
  cuentaId: string | null;
}

/**
 * Cuántas páginas se piden como mucho. **Un tope explícito, no un `while (true)`.**
 *
 * Medido el 2026-09-16: la página trae 100 anuncios y la cuenta tiene más de 200. Veinte páginas
 * son 2.000 entidades, muy por encima de lo que esta cuenta mueve, y es el tope que impide que un
 * cursor que no avanza deje el barrido girando contra el proveedor.
 */
const PAGINAS_MAXIMAS = 20;

/**
 * Las campañas, los ad sets o los anuncios de la cuenta vinculada. **Paginado.**
 *
 * ── LA RESPUESTA NO ES UN ARREGLO, Y LA LISTA DE ANUNCIOS VIENE TRUNCADA ────
 *
 * Dos formas distintas conviven en la misma familia de endpoints, medidas el 2026-09-16:
 * `/reporting/list` devuelve un arreglo pelado y `/entity` devuelve `{ data, next, traceId }`. La
 * primera versión de esta función leía la respuesta como arreglo y devolvía **cero entidades sin
 * fallar** — el modo de error más caro que hay acá, porque una tabla de anuncios vacía se lee como
 * «no hay anuncios».
 *
 * Y el `next` no es decoración: con `entityType=AD` la primera página trae 100 anuncios y un cursor,
 * y pedir la siguiente devuelve **100 anuncios distintos**. Sin paginar, la estructura queda cortada
 * a la mitad y todo cruce contra la atribución pierde anuncios en silencio.
 *
 * El nombre del parámetro es `next` y **no** `after`: los dos devuelven 200, pero `after` reenvía la
 * misma página. Se descubrió comparando identificadores entre páginas, no leyendo documentación —
 * la especificación no declara ningún esquema de respuesta para este endpoint.
 *
 * Los identificadores son los de Meta —dieciocho dígitos— y son **los mismos** que llegan en la
 * atribución del contacto: el `campaignId` de acá aparece tal cual en
 * `negocio.contactos.atribucion_primera->>'campaignId'`.
 */
export async function estructuraDeAnuncios(
  acceso: { token: string; locationId: string },
  nivel: NivelDeAnuncio,
): Promise<ResultadoDeGhl<EntidadDeAnuncio[]>> {
  /* La clave del identificador cambia con el nivel, y eso NO es un capricho del proveedor: es la
     forma de Meta. Se normaliza acá para que quien consuma no tenga que saberlo. */
  const claveDelId: Record<NivelDeAnuncio, string> = {
    CAMPAIGN: 'campaignId',
    ADSET: 'adSetId',
    AD: 'adId',
  };

  const salida: EntidadDeAnuncio[] = [];
  /* Los identificadores ya vistos. El proveedor puede devolver el mismo cursor dos veces —`after` lo
     hace— y sin esta guarda el resultado tendría filas repetidas que después se cuentan dos veces. */
  const vistos = new Set<string>();
  let cursor: string | null = null;

  for (let pagina = 0; pagina < PAGINAS_MAXIMAS; pagina++) {
    const url =
      `${BASE}/ad-publishing/facebook/entity?locationId=${encodeURIComponent(acceso.locationId)}` +
      `&type=${ORIGEN}&entityType=${nivel}` +
      (cursor === null ? '' : `&next=${encodeURIComponent(cursor)}`);

    const r = await leer<Record<string, unknown>>(url, acceso.token);
    if (r.tipo !== 'datos') return r;

    const lista = Array.isArray(r.datos?.data) ? r.datos.data : [];
    let nuevas = 0;
    for (const x of lista) {
      const o = (x ?? {}) as Record<string, unknown>;
      const id = texto(o[claveDelId[nivel]]);
      /* Una entidad sin identificador no se puede cruzar con nada, así que no entra. Descartarla es
         mejor que guardarla con id vacío: esa fila después se une con todo. */
      if (id === null || vistos.has(id)) continue;
      vistos.add(id);
      nuevas++;
      salida.push({
        id,
        nombre: texto(o.name) ?? '(sin nombre)',
        estado: texto(o.status) ?? texto(o.effectiveStatus),
        cuentaId: texto(o.adAccountId),
      });
    }

    cursor = texto(r.datos?.next);
    /* Se corta cuando no hay cursor O cuando la página no trajo nada nuevo. Lo segundo es la guarda
       contra un cursor que no avanza: sin ella el bucle da las veinte vueltas del tope pidiéndole al
       proveedor la misma página. */
    if (cursor === null || nuevas === 0) break;
  }

  return { tipo: 'datos', datos: salida };
}

// ─── Las métricas ───────────────────────────────────────────────────────────

/**
 * Lo que el proveedor devuelve por anuncio y por día.
 *
 * **`leads` y `resultados` son de META, no nuestros.** Es el conteo que Meta reporta, y compararlo
 * contra nuestros contactos atribuidos es justamente el punto 4 del § 18.14 —«diferencia entre leads
 * de Meta y GHL»—. Publicarlos como si fueran la misma población es el defecto que Conversation ya
 * pagó dos veces.
 */
export interface MetricaDeAnuncio {
  anuncioId: string;
  adSetId: string | null;
  campanaId: string | null;
  nombre: string;
  /** El objetivo de la campaña, p. ej. `OUTCOME_LEADS`. Lo trae cada fila de anuncio. */
  objetivo: string | null;
  gasto: number | null;
  impresiones: number | null;
  clics: number | null;
  ctr: number | null;
  cpc: number | null;
  alcance: number | null;
  frecuencia: number | null;
  /** Lo que META cuenta como lead. Ver el aviso de arriba. */
  leadsDeMeta: number | null;
  resultadosDeMeta: number | null;
}

/**
 * Las métricas de los anuncios de UNA campaña en UN día.
 *
 * ── UN DÍA POR LLAMADA, Y ES UNA RESTRICCIÓN DEL PROVEEDOR ──────────────────
 *
 * `groupBy=day` funciona en `/reporting` y **se ignora acá**: con `startDate` y `endDate` distintos
 * devuelve UNA fila por anuncio con el total del rango. Medido el 2026-09-16 sobre la campaña
 * `120249590301010467`: el rango 09-10→09-12 da diez filas con `spend 24,3`, y 09-11→09-11 da diez
 * filas con `spend 6,23`. Por eso la firma pide `dia` y no un rango: es la única forma de guardar
 * por fecha, que es lo que el § 18.4 exige.
 *
 * El costo de llamadas sale de ahí y hay que tenerlo a la vista: una por campaña y por día.
 */
export async function metricasPorAnuncio(
  acceso: { token: string; locationId: string },
  campanaId: string,
  /** Un día, en `YYYY-MM-DD`. */
  dia: string,
): Promise<ResultadoDeGhl<MetricaDeAnuncio[]>> {
  const r = await leer<unknown>(
    `${BASE}/ad-publishing/facebook/reporting/list?locationId=${encodeURIComponent(acceso.locationId)}` +
      `&listType=ads&type=${ORIGEN}&campaignId=${encodeURIComponent(campanaId)}` +
      `&startDate=${dia}&endDate=${dia}`,
    acceso.token,
  );
  if (r.tipo !== 'datos') return r;

  const lista = Array.isArray(r.datos) ? r.datos : [];
  return {
    tipo: 'datos',
    datos: lista.flatMap((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const anuncioId = texto(o.adId);
      if (anuncioId === null) return [];
      return [
        {
          anuncioId,
          adSetId: texto(o.adsetId),
          campanaId: texto(o.campaignId) ?? campanaId,
          nombre: texto(o.name) ?? '(sin nombre)',
          objetivo: texto(o.objective),
          gasto: numero(o.spend),
          impresiones: numero(o.impressions),
          clics: numero(o.clicks),
          ctr: numero(o.ctr),
          cpc: numero(o.cpc),
          alcance: numero(o.reach),
          frecuencia: numero(o.frequency),
          leadsDeMeta: numero(o.leads),
          resultadosDeMeta: numero(o.results),
        },
      ];
    }),
  };
}

/** Una fila del reporte agregado de la CUENTA, un día. */
export interface DiaDeLaCuenta {
  dia: string;
  gasto: number | null;
  impresiones: number | null;
  clics: number | null;
  cpc: number | null;
  cpm: number | null;
  alcance: number | null;
  frecuencia: number | null;
}

/**
 * La serie diaria de toda la cuenta publicitaria.
 *
 * Es la única llamada que devuelve **CPM**, y es una sola para todo el período — contra una por
 * campaña y por día del desglose. Sirve para el total del encabezado y como comprobación: la suma
 * del gasto por anuncio no debería pasarse del gasto de la cuenta.
 *
 * `conversions` y `costPerConversion` vienen en la respuesta y **no se leen**: medidos en cero en
 * todo el período, porque dependen de una configuración de conversiones que esta cuenta no tiene.
 * Leerlos sería publicar un cero que no se distingue de «no hubo».
 */
export async function serieDeLaCuenta(
  acceso: { token: string; locationId: string },
  desde: string,
  hasta: string,
): Promise<ResultadoDeGhl<DiaDeLaCuenta[]>> {
  const campos = 'impressions,clicks,spend,cpc,cpm,reach,frequency';
  const r = await leer<Record<string, unknown>>(
    `${BASE}/ad-publishing/facebook/reporting?locationId=${encodeURIComponent(acceso.locationId)}` +
      `&groupBy=day&type=${ORIGEN}&startDate=${desde}&endDate=${hasta}` +
      `&fields=${encodeURIComponent(campos)}`,
    acceso.token,
  );
  if (r.tipo !== 'datos') return r;

  const lista = Array.isArray(r.datos?.grouped) ? r.datos.grouped : [];
  return {
    tipo: 'datos',
    datos: lista.flatMap((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const dia = texto(o.dateStart);
      if (dia === null) return [];
      return [
        {
          dia,
          gasto: numero(o.spend),
          impresiones: numero(o.impressions),
          clics: numero(o.clicks),
          cpc: numero(o.cpc),
          cpm: numero(o.cpm),
          alcance: numero(o.reach),
          frecuencia: numero(o.frequency),
        },
      ];
    }),
  };
}
