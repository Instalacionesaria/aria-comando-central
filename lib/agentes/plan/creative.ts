// El Plan de acción de Creative Insights, armado con plantillas (`docs/OTROS/agentes/fichas/F06-CREATIVE-INSIGHTS.md`;
// `docs/creative/06-EL-PLAN-DE-ACCION.md`, C6-01 a C6-10). Puro.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL FORMATO
//
//   · Los grupos de Creative en su orden (C6-02): «Lo que dice la data», «Haz más de esto», «Ajusta o pausa
//     esto», y aparte «Requiere validación ejecutiva» para lo de presupuesto. «Ideas para producir» no va:
//     generar es de Copywriter, no de un detector (C6-07a).
//   · El verbo es el de la medición, no una orden (C6-10): «está … por debajo del promedio de su etapa», «bajó
//     … entre la primera y la segunda mitad». Creative propone; la persona decide en Meta.
//   · El ICP de una pieza contra su etapa es la frase de «Lo que dice la data» (C6-04a); la caída del CTR y la
//     frecuencia, de «Ajusta o pausa esto». «Haz más de esto» queda vacío mientras ninguna regla mida lo que
//     anda bien: un grupo vacío se guarda vacío y la pantalla lo dice.
//
// El armado, el orden y la ventana son los de todos los departamentos (`./comun.ts`).
// ═══════════════════════════════════════════════════════════════════════════════

import type { ParaElPlan } from '../detectores/correr.ts';
import { CRE } from '../detectores/creative.ts';
import type { Deteccion } from '../senales/tipos.ts';
import { armarPlan, numero, porcentaje, type FormatoDelPlan, type PlanDelDepartamento } from './comun.ts';

export const GRUPOS_DEL_PLAN_DE_CREATIVE = [
  { clave: 'data', titulo: 'Lo que dice la data' },
  { clave: 'haz_mas', titulo: 'Haz más de esto' },
  { clave: 'ajusta', titulo: 'Ajusta o pausa esto' },
  { clave: 'validacion', titulo: 'Requiere validación ejecutiva' },
] as const;
export type GrupoDelPlanDeCreative = (typeof GRUPOS_DEL_PLAN_DE_CREATIVE)[number]['clave'];

function grupoDe(d: Deteccion): GrupoDelPlanDeCreative {
  if (d.requiereValidacionEjecutiva) return 'validacion';
  switch (d.regla) {
    case CRE.caidaDeCtr:
    case CRE.frecuenciaAlta:
      return 'ajusta';
    default:
      return 'data';
  }
}

/** Un CTR que ya viene en porcentaje (2,76 es 2,76 %): no se multiplica. */
const enPorcentaje = (x: unknown) => (typeof x === 'number' ? `${numero(x)} %` : '—');

/** La frase de cada regla: métrica, valor y base juntas, con el verbo de la medición (C6-10). */
export function textoDeCreative(d: Deteccion): string {
  const ev = (d.evidencia ?? {}) as Record<string, unknown>;
  switch (d.regla) {
    case CRE.caidaDeCtr:
      return `Su CTR bajó ${porcentaje(d.cambioPct)} entre la primera y la segunda mitad de sus ${numero(ev.dias as number)} días con entrega: de ${enPorcentaje(d.lineaBase)} a ${enPorcentaje(d.valorActual)}, sobre ${numero(d.muestra)} impresiones.`;
    case CRE.concentracion:
      return `Se lleva el ${porcentaje(d.valorActual)} del gasto de la ventana, entre ${numero((ev.piezas as unknown[] | undefined)?.length)} piezas con gasto.`;
    case CRE.frecuenciaAlta:
      return `El anuncio se mostró ${numero(d.valorActual)} veces por persona en promedio en la semana, sobre ${numero(d.muestra)} impresiones.`;
    case CRE.icpPorPieza:
      return `Su ICP promedio está ${numero((d.lineaBase ?? 0) - (d.valorActual ?? 0))} puntos por debajo del promedio de las piezas de su etapa (${String(ev.etapa ?? '—')}): ${numero(d.valorActual)} contra ${numero(d.lineaBase)}, sobre ${numero(d.muestra)} calificados con puntaje.`;
    default:
      return `${d.metrica}: ${numero(d.valorActual)}.`;
  }
}

/** Lo que no se pudo medir, en palabras. */
const NO_SE_MIDIO: Record<string, string> = {
  [CRE.caidaDeCtr]: 'si el CTR de alguna pieza cae: la lectura de los anuncios no está al día',
  [CRE.concentracion]: 'el reparto del gasto entre piezas: la lectura de los anuncios no está al día',
  [CRE.frecuenciaAlta]: 'la frecuencia de los anuncios: la lectura de los anuncios no está al día',
  [CRE.icpPorPieza]: 'el ICP por pieza: el campo de ICP no está en el CRM',
};

export const FORMATO_DE_CREATIVE: FormatoDelPlan<GrupoDelPlanDeCreative> = {
  departamento: 'creative',
  grupos: GRUPOS_DEL_PLAN_DE_CREATIVE,
  grupoDe,
  textoDe: textoDeCreative,
  noSeMidio: NO_SE_MIDIO,
};

export type PlanDeCreative = PlanDelDepartamento<GrupoDelPlanDeCreative>;

export function armarPlanDeCreative(p: ParaElPlan): PlanDeCreative {
  return armarPlan(FORMATO_DE_CREATIVE, p);
}
