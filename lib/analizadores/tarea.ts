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
import { llamadasSinFicha, pendientesParaAnalizar } from './datos.ts';
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
  const out: ResultadoDeLaTarea = {
    descubrimiento: await descubrir(orgId, { claveTldv: acceso.claveTldv, claveIa: acceso.claveIa, reloj }),
    llaveRechazada: null,
    analizadas: 0,
    vetadas: 0,
    fallidas: 0,
    fichas: 0,
    fichasFallidas: 0,
    sinTiempo: 0,
  };
  if (out.descubrimiento.tipo === 'falta') {
    out.llaveRechazada = out.descubrimiento.que === 'llave_de_tldv_rechazada' ? 'tldv' : 'ia';
    /* Con la llave de IA rechazada no se analiza nada: cada intento fallaría con un 401 y dejaría la
       llamada FAILED. Con la de tl;dv rechazada sí se puede drenar lo que ya estaba guardado. */
    if (out.llaveRechazada === 'ia') return out;
  }

  const pendientes = await pendientesParaAnalizar(orgId, TIPOS_QUE_SE_ANALIZAN, PENDIENTES_POR_CORRIDA);
  for (const [i, id] of pendientes.entries()) {
    const r = await analizarLlamada(orgId, id, acceso.claveIa, reloj);
    if (r.tipo === 'rechazo') {
      if (r.que === 'sin_tiempo') {
        out.sinTiempo = pendientes.length - i;
        break;
      }
      continue; // otra corrida la tomó, o cambió de tipo mientras tanto: no es de esta vuelta
    }
    if (r.estado === 'DONE') out.analizadas++;
    else if (r.estado === 'NOT_MATCH') out.vetadas++;
    else out.fallidas++;
  }

  /* Las fichas, con lo que sobre. Incluye las de las HT que se acaban de analizar: `llamadasSinFicha`
     las encuentra solas, así que no hace falta un camino aparte para ellas. */
  for (const id of await llamadasSinFicha(orgId, PENDIENTES_POR_CORRIDA)) {
    const r = await generarFicha(orgId, id, acceso.claveIa, reloj);
    if (r.tipo === 'rechazo') {
      if (r.que === 'sin_tiempo') break;
      continue;
    }
    if (r.estado === 'OK') out.fichas++;
    else out.fichasFallidas++;
  }
  return out;
}

/** Cuántas veces se le habló a un proveedor en la corrida. Aproximado por arriba, y dicho así. */
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
