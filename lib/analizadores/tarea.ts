// La tarea programada de los Analizadores: descubrir, drenar y completar fichas, por empresa.
//
// ═══════════════════════════════════════════════════════════════════════════════
// DE DÓNDE VIENE, Y POR QUÉ CORRE CADA HORA Y NO UNA VEZ POR DÍA
//
// En ARIA Brain era `app/api/analyzer/cron/route.ts`: tres corridas diarias seguidas (10, 11 y 12
// UTC) con **800 s** de función, que analizaban todas las pendientes una por una. Acá la función del
// cron tiene **300 s**, así que en una corrida entra un descubrimiento y, con suerte, uno o dos
// análisis. Por eso corre cada hora en su propio horario: el volumen medido es de unas dos HT por día,
// y veinticuatro corridas cortas drenan lo que tres largas drenaban, sin compartir el tiempo con las
// tareas del CRM.
//
// ── EL ORDEN DE LOS TRES PASOS ────────────────────────────────────────────────
//
//   1. **Descubrir**, que es barato (tl;dv y Haiku) y es lo único que trae trabajo nuevo.
//   2. **Drenar** las pendientes de los tipos que se analizan, en orden de llegada, mientras quepa
//      un análisis entero. Lo que no entra queda PENDING para la corrida siguiente.
//   3. **Completar las fichas** que falten, con el tiempo que sobre.
//
// Cada paso mira el reloj por su cuenta (`pipeline.ts`): lo que no cabe no arranca, y nada queda
// tomado por una inferencia cortada a la mitad.
// ═══════════════════════════════════════════════════════════════════════════════

import type { AccesoAlAnalizador } from '../credenciales/resolver.ts';
import { contarReintento, llamadasSinFicha, paraReintentar, pendientesParaAnalizar } from './datos.ts';
import {
  TIPOS_QUE_SE_ANALIZAN,
  analizarLlamada,
  descubrir,
  generarFicha,
  type Reloj,
  type ResultadoDelDescubrimiento,
} from './pipeline.ts';

/** Cuántas pendientes se piden por corrida. Más de las que caben: el reloj es el que corta. */
const PENDIENTES_POR_CORRIDA = 10;

/** Lo que dejó la corrida de una empresa, para el sello y para la respuesta del cron. */
export interface ResultadoDeLaTarea {
  descubrimiento: ResultadoDelDescubrimiento;
  /**
   * Qué llave rechazó el proveedor, si alguna. **Es lo único que hay que ir a arreglar**: con la
   * llave rechazada no entra nada nuevo, y el sello lo tiene que decir aunque la tarea «corrió».
   */
  llaveRechazada: 'tldv' | 'ia' | null;
  /** Anthropic contestó 429 o 529: se cortó el drenado y lo que quedaba sigue PENDING. */
  saturado: boolean;
  /**
   * El listado de tl;dv volvió lleno y sin salir de la ventana: puede haber reuniones que no se ven.
   * Una página llena que cruza el borde de la ventana no cuenta (`paginaSinBorde`).
   */
  paginaLlena: boolean;
  analizadas: number;
  vetadas: number;
  fallidas: number;
  fichas: number;
  fichasFallidas: number;
  /** Pendientes que quedaron sin analizar porque no alcanzó el tiempo. Las toma la próxima corrida. */
  sinTiempo: number;
}

/**
 * Corre los tres pasos para UNA empresa. `acceso` ya llegó resuelto y `listo`: el bucle del cron
 * saltea antes a las que no tienen las dos llaves.
 */
export async function correrAnalizadores(
  orgId: string,
  acceso: Extract<AccesoAlAnalizador, { tipo: 'listo' }>,
  reloj: Reloj,
): Promise<ResultadoDeLaTarea> {
  const descubrimiento = await descubrir(orgId, { claveTldv: acceso.claveTldv, claveIa: acceso.claveIa, reloj });
  const out: ResultadoDeLaTarea = {
    /* Un fallo del descubrimiento va entero al REGISTRO y al resultado sin su causa: el resultado viaja
       en el cuerpo de la respuesta del cron, y la causa cruda de un proveedor no sale en una respuesta
       (ADR-0704). El sello lo dice igual, con `motivoDeLoIncompleto`. */
    descubrimiento:
      descubrimiento.tipo === 'fallo' ? { tipo: 'fallo', causa: 'tl;dv no respondió al listar las reuniones' } : descubrimiento,
    llaveRechazada: null,
    saturado: false,
    paginaLlena: descubrimiento.tipo === 'hecho' && descubrimiento.paginaSinBorde,
    analizadas: 0,
    vetadas: 0,
    fallidas: 0,
    fichas: 0,
    fichasFallidas: 0,
    sinTiempo: 0,
  };
  if (descubrimiento.tipo === 'fallo') console.error('analizadores: el descubrimiento falló', orgId, descubrimiento.causa);
  if (descubrimiento.tipo === 'falta') {
    out.llaveRechazada = descubrimiento.que === 'llave_de_tldv_rechazada' ? 'tldv' : 'ia';
    /* Con la llave de IA rechazada no se analiza nada: cada intento volvería a rechazarse. Con la de
       tl;dv rechazada sí se puede drenar lo que ya estaba guardado. */
    if (out.llaveRechazada === 'ia') return out;
  }

  /* Solo PENDING, y la toma lo exige (`esperado` por omisión): la lista es una foto, y si mientras
     tanto la pantalla o otra corrida terminó una, al llegar su turno se saltea en vez de pagarla dos
     veces. */
  const pendientes = await pendientesParaAnalizar(orgId, TIPOS_QUE_SE_ANALIZAN, PENDIENTES_POR_CORRIDA);
  for (const [i, id] of pendientes.entries()) {
    const r = await analizarLlamada(orgId, id, acceso.claveIa, reloj, 'PENDING');
    if (r.tipo === 'rechazo') {
      if (r.que === 'sin_tiempo') {
        out.sinTiempo = pendientes.length - i;
        break;
      }
      /* La llave dejó de servir a mitad del drenado: la llamada ya volvió a PENDING, y seguir solo
         repetiría el rechazo en cada una. Tampoco se arman fichas. */
      if (r.que === 'llave_de_ia_rechazada') {
        out.llaveRechazada = 'ia';
        return out;
      }
      if (r.que === 'modelo_saturado') {
        out.saturado = true;
        return out;
      }
      continue; // otra corrida la tomó, la terminó o la movió mientras tanto: no es de esta vuelta
    }
    if (r.estado === 'DONE') out.analizadas++;
    else if (r.estado === 'NOT_MATCH') out.vetadas++;
    else out.fallidas++;
  }

  /* Las fichas que NUNCA se generaron, con lo que sobre. Las de las HT recién analizadas no entran
     todavía: la pantalla ya las está pidiendo, y `llamadasSinFicha` espera unos minutos para no
     generarlas dos veces en paralelo. Las toma la corrida siguiente si nadie lo hizo. */
  for (const id of await llamadasSinFicha(orgId, PENDIENTES_POR_CORRIDA)) {
    const r = await generarFicha(orgId, id, acceso.claveIa, reloj);
    if (r.tipo === 'rechazo') {
      if (r.que === 'sin_tiempo') break;
      if (r.que === 'llave_de_ia_rechazada') {
        out.llaveRechazada = 'ia';
        break;
      }
      if (r.que === 'modelo_saturado') {
        out.saturado = true;
        break;
      }
      continue;
    }
    if (r.estado === 'OK') out.fichas++;
    else out.fichasFallidas++;
  }
  return out;
}

/**
 * Cuántas veces se le habló a un proveedor en la corrida. **Aproximado**, a partir de lo que dejó
 * rastro en el resultado: una corrida cortada por una llave rechazada, o una reunión que se clasificó
 * y perdió la carrera con el botón, cuentan de menos.
 */
export function llamadasDeLaTarea(r: ResultadoDeLaTarea): number {
  const d = r.descubrimiento;
  const descubrimiento =
    d.tipo === 'hecho'
      ? 1 + // el listado
        (d.descubiertas + d.internas + d.sinClasificar + d.pendientesDeTranscripcion) + // transcripciones
        (d.descubiertas + d.internas + d.sinClasificar) // clasificaciones
      : 1;
  return descubrimiento + r.analizadas + r.vetadas + r.fallidas + r.fichas + r.fichasFallidas;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EL REINTENTO DE LAS 5 DE LA MAÑANA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cuántas veces reintenta el barrido una misma llamada. Una que falla siempre igual se pagaría todos
 * los días; pasadas tres, queda FAILED para quien lea el error y apriete el botón.
 */
export const TOPE_DE_REINTENTOS = 3;

export interface ResultadoDelReintento {
  /** Las que se mandaron al modelo otra vez. */
  reintentadas: number;
  /** Las que esta vez terminaron DONE o «no es» su tipo. */
  recuperadas: number;
  /** Las que volvieron a fallar; cada una sumó un reintento. */
  siguenFallando: number;
  /** Las que otra corrida o la pantalla tomó antes: no se pagaron dos veces. */
  salteadas: number;
  llaveRechazada: 'ia' | null;
  saturado: boolean;
  /** Las que quedaron sin reintentar porque no alcanzó el tiempo. Las toma el barrido de mañana. */
  sinTiempo: number;
}

/**
 * Pedido el 2026-09-23: un barrido diario que reintente lo que falló, sin duplicar. Solo reintenta:
 * no descubre ni genera fichas —eso lo hace la tarea de cada hora— y no toca las PENDING.
 *
 * **No duplica** por la misma vía que todo lo demás: cada llamada se toma con el estado en que se vio
 * (`esperado`), así que una que la pantalla reintentó mientras tanto, o que ya terminó, se saltea.
 */
export async function reintentarAnalizadores(
  orgId: string,
  acceso: Extract<AccesoAlAnalizador, { tipo: 'listo' }>,
  reloj: Reloj,
): Promise<ResultadoDelReintento> {
  const out: ResultadoDelReintento = {
    reintentadas: 0,
    recuperadas: 0,
    siguenFallando: 0,
    salteadas: 0,
    llaveRechazada: null,
    saturado: false,
    sinTiempo: 0,
  };
  const candidatas = await paraReintentar(orgId, TIPOS_QUE_SE_ANALIZAN, TOPE_DE_REINTENTOS, PENDIENTES_POR_CORRIDA);
  for (const [i, c] of candidatas.entries()) {
    const r = await analizarLlamada(orgId, c.id, acceso.claveIa, reloj, c.estado);
    if (r.tipo === 'rechazo') {
      if (r.que === 'sin_tiempo') {
        out.sinTiempo = candidatas.length - i;
        break;
      }
      // La llave o el servicio: el análisis no ocurrió, la llamada volvió a su estado y no suma intento.
      if (r.que === 'llave_de_ia_rechazada') {
        out.llaveRechazada = 'ia';
        break;
      }
      if (r.que === 'modelo_saturado') {
        out.saturado = true;
        break;
      }
      out.salteadas++;
      continue;
    }
    out.reintentadas++;
    if (r.estado === 'FAILED') {
      out.siguenFallando++;
      await contarReintento(orgId, c.id);
    } else out.recuperadas++;
  }
  return out;
}

