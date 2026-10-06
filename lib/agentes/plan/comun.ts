// Lo común del Plan de acción de cada departamento (`docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`, AG-32).
// Puro.
//
// Cada departamento pone su formato —sus grupos y su orden, a qué grupo va cada regla, la frase de cada una y
// qué decir de lo que no se pudo medir— y esto arma el plan igual para todos: sólo con lo vigente (A6-20),
// primero lo que más gente pierde y después lo más grave (A6-11, AG-29), con la ventana que dice mirar (A6-23),
// lo que quedó bajo el piso (AG-27) y lo que no se pudo medir.

import type { ParaElPlan } from '../detectores/correr.ts';
import { GRAVEDADES, type DepartamentoConSenales, type Deteccion, type VentanaDeSenal } from '../senales/tipos.ts';

export interface RenglonDelPlan {
  regla: string;
  entidad: Deteccion['entidad'];
  gravedad: Deteccion['gravedad'];
  perdidaContactos: number | null;
  muestra: number | null;
  texto: string;
  revision: string;
  /** Las hipótesis de la regla: la redacción sólo puede nombrar éstas como causa. */
  causas: readonly string[];
}

export interface PlanDelDepartamento<G extends string = string> {
  departamento: DepartamentoConSenales;
  ventana: VentanaDeSenal;
  dia: string;
  /** La ventana sobre la que se calculó (A6-23). Nula si no se pudo medir ninguna. */
  periodo: { desde: string; hasta: string } | null;
  grupos: { clave: G; titulo: string; renglones: RenglonDelPlan[] }[];
  debajoDelPiso: number;
  /** Lo que no se pudo medir en esta pasada, en palabras. */
  sinMedicion: string[];
  /** Cuántos renglones quedaron fuera por el tope de su grupo. Cero sin tope. */
  fueraDelTope: number;
}

export interface FormatoDelPlan<G extends string = string> {
  departamento: DepartamentoConSenales;
  /** Los grupos en el orden del departamento. Un grupo vacío se guarda vacío: la pantalla decide. */
  grupos: readonly { clave: G; titulo: string }[];
  grupoDe: (d: Deteccion) => G;
  /** La frase: métrica, valor y base juntas (A6-06), con el verbo de la medición (C6-10). */
  textoDe: (d: Deteccion, ventana: VentanaDeSenal) => string;
  /** Lo que no se pudo medir, en palabras, por regla. */
  noSeMidio: Readonly<Record<string, string>>;
  /**
   * El último criterio de orden, después de la pérdida y la gravedad: más alto, primero. Conversation ordena por
   * cuántas conversaciones toca cada patrón. Sin él, por la entidad.
   */
  desempate?: (d: Deteccion) => number;
  /**
   * Cuántos renglones muestra un grupo, como mucho, después de ordenar. Conversion muestra sólo las tres fugas con
   * más pérdida (CV6-02, CV6-03). Lo que queda afuera se cuenta en `fueraDelTope` y sigue en la tarjeta.
   */
  tope?: Partial<Record<G, number>>;
}

export function armarPlan<G extends string>(f: FormatoDelPlan<G>, p: ParaElPlan): PlanDelDepartamento<G> {
  const grupos = f.grupos.map((g) => ({ clave: g.clave, titulo: g.titulo, renglones: [] as RenglonDelPlan[] }));
  const peso = new Map<RenglonDelPlan, number>();
  // Lo vigente y, después, lo informativo (que no es señal y sólo vive en el plan).
  for (const d of [...p.vigentes, ...(p.informativas ?? [])]) {
    const renglon: RenglonDelPlan = {
      regla: d.regla,
      entidad: d.entidad,
      gravedad: d.gravedad,
      perdidaContactos: d.perdidaContactos,
      muestra: d.muestra,
      texto: f.textoDe(d, p.ventana),
      revision: d.revisionRecomendada,
      causas: d.causasPosibles,
    };
    peso.set(renglon, f.desempate?.(d) ?? 0);
    grupos.find((g) => g.clave === f.grupoDe(d))!.renglones.push(renglon);
  }
  // Primero lo que más gente pierde; lo que no tiene pérdida, después; a igual pérdida, lo más grave; y después, el
  // desempate del departamento.
  for (const g of grupos) {
    g.renglones.sort(
      (a, b) =>
        (b.perdidaContactos ?? -1) - (a.perdidaContactos ?? -1) ||
        GRAVEDADES.indexOf(a.gravedad) - GRAVEDADES.indexOf(b.gravedad) ||
        peso.get(b)! - peso.get(a)! ||
        a.entidad.id.localeCompare(b.entidad.id),
    );
  }
  let fueraDelTope = 0;
  for (const g of grupos) {
    const tope = f.tope?.[g.clave];
    if (tope !== undefined && g.renglones.length > tope) {
      fueraDelTope += g.renglones.length - tope;
      g.renglones = g.renglones.slice(0, tope);
    }
  }
  return {
    departamento: f.departamento,
    ventana: p.ventana,
    dia: p.dia,
    periodo: p.periodo ?? null,
    grupos,
    debajoDelPiso: p.debajoDelPiso.length,
    sinMedicion: p.sinMedicion.map((r) => f.noSeMidio[r] ?? r),
    fueraDelTope,
  };
}

// ─── Los números de las frases ──────────────────────────────────────────────

const NUMERO = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, useGrouping: 'always' } as Intl.NumberFormatOptions);
export const numero = (x: number | null | undefined) => (x === null || x === undefined ? '—' : NUMERO.format(x));
export const porcentaje = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${NUMERO.format(Math.round(Math.abs(x) * 100))} %`);
export const puntos = (x: number) => NUMERO.format(Math.round(x * 100));
/** Los días de la ventana, en palabras: «los 30 días anteriores». */
export const anteriores = (v: VentanaDeSenal) => `los ${v === '7d' ? 7 : 30} días anteriores`;
