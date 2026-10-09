// El Plan de acción de Conversion, armado con plantillas (`docs/OTROS/agentes/fichas/F04-CONVERSION.md`;
// `docs/conversion/06`, CV6-02 a CV6-08). Puro.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL FORMATO
//
//   · **«Qué hacer primero»**: las tres fricciones que más gente pierden, y sólo tres (CV6-02, CV6-03). El
//     criterio de corte va en el título del grupo; las demás siguen en la tarjeta de Señales y el plan dice
//     cuántas quedaron afuera (`fueraDelTope`).
//   · **«Lo que dice la data»**: el formulario que dejó de llegar.
//   · **«Requiere validación ejecutiva»**: el cambio de ruta, que mueve a dónde va el presupuesto.
//   · **«No tocar»**: las familias que agendan igual o mejor que la cohorte (CV6-04). No son señales: llegan como
//     renglones informativos del detector.
//   · Cada fricción dice **a quién le toca** (CV6-05), y la pérdida es lo medido (CV6-06). Ningún nombre de
//     persona (CV6-08): las entidades son familias de entrada y el formulario.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ParaElPlan } from '../detectores/correr.ts';
import { CNV, LE_TOCA, NO_TOCAR } from '../detectores/conversion.ts';
import { ROTULOS, type Familia } from '../../negocio/recorrido.ts';
import type { Deteccion } from '../senales/tipos.ts';
import { anteriores, armarPlan, numero, porcentaje, puntos, type FormatoDelPlan, type PlanDelDepartamento } from './comun.ts';

/** Cuántas fricciones van en «Qué hacer primero». */
export const PRIMERAS = 3;

export const GRUPOS_DEL_PLAN_DE_CONVERSION = [
  { clave: 'primero', titulo: `Qué hacer primero · las ${PRIMERAS} que más gente pierden` },
  { clave: 'data', titulo: 'Lo que dice la data' },
  { clave: 'validacion', titulo: 'Requiere validación ejecutiva' },
  { clave: 'no_tocar', titulo: 'No tocar' },
] as const;
export type GrupoDelPlanDeConversion = (typeof GRUPOS_DEL_PLAN_DE_CONVERSION)[number]['clave'];

function grupoDe(d: Deteccion): GrupoDelPlanDeConversion {
  if (d.regla === NO_TOCAR) return 'no_tocar';
  if (d.requiereValidacionEjecutiva) return 'validacion';
  if (d.regla === CNV.formularioSinDatos) return 'data';
  return 'primero';
}

const AREA: Record<string, string> = { conversion: 'Conversion', acquisition: 'Acquisition', conversation: 'Conversation' };
const titulo = (d: Deteccion) => ROTULOS[d.entidad.id as Familia]?.titulo ?? d.entidad.id;

interface EvidenciaDeFamilia {
  contactos?: number;
  agendaron?: number;
  cohorte?: number;
  agendaronEnLaCohorte?: number;
  ahora?: { contactos: number; cohorte: number };
  antes?: { contactos: number; cohorte: number };
  con?: number;
  sobre?: number;
  empezaron?: number;
}

export function textoDeConversion(d: Deteccion, ventana: ParaElPlan['ventana']): string {
  const ev = (d.evidencia ?? {}) as EvidenciaDeFamilia;
  switch (d.regla) {
    case CNV.familiaQueNoAgenda: {
      const leToca = LE_TOCA[d.entidad.id as Familia];
      return `«${titulo(d)}» agenda el ${porcentaje(d.valorActual)} de sus ${numero(ev.contactos)} contactos, ${puntos((d.lineaBase ?? 0) - (d.valorActual ?? 0))} puntos por debajo de la cohorte (${porcentaje(d.lineaBase)} de ${numero(ev.cohorte)}).${leToca ? ` Le toca a ${AREA[leToca]}.` : ''}`;
    }
    case CNV.cambioDeRuta:
      return `«${titulo(d)}» es ahora el ${porcentaje(d.valorActual)} de la cohorte, contra el ${porcentaje(d.lineaBase)} en ${anteriores(ventana)} (${numero(ev.ahora?.contactos)} de ${numero(ev.ahora?.cohorte)}, antes ${numero(ev.antes?.contactos)} de ${numero(ev.antes?.cohorte)}).`;
    case CNV.formularioAbandono:
      return `De ${numero(ev.empezaron)} que empezaron el formulario, lo terminó el ${porcentaje(d.valorActual)}. Le toca a Conversion.`;
    case CNV.formularioSinDatos:
      return `Sólo ${numero(ev.con)} de ${numero(ev.sobre)} contactos de la cohorte traen el formulario (${porcentaje(d.valorActual)}): lo que la pantalla dice de él no vale para esta ventana.`;
    case NO_TOCAR:
      return `«${titulo(d)}» agenda el ${porcentaje(d.valorActual)} de sus ${numero(ev.contactos)} contactos, igual o mejor que la cohorte (${porcentaje(d.lineaBase)}).`;
    default:
      return `${d.metrica}: ${numero(d.valorActual)}.`;
  }
}

const NO_SE_MIDIO: Record<string, string> = {
  [CNV.familiaQueNoAgenda]: 'cuánto agenda cada recorrido: la lectura de contactos no está al día',
  /* Desde el CV-3 de Conversion (2026-10-08) el cambio de ruta también queda sin medir con los contactos al día: si
     la historia no cubre la ventana anterior, o si la lectura de citas está atrasada, la lectura de la pantalla no da
     anterior. El texto nombra las tres causas, porque el código de la regla no dice cuál fue. */
  [CNV.cambioDeRuta]:
    'el cambio de ruta: no hay una ventana anterior que comparar (historia corta, o la lectura de contactos o de citas atrasada)',
  [CNV.formularioAbandono]: 'cuánta gente termina el formulario: el campo del formulario no está en el CRM',
  [CNV.formularioSinDatos]: 'si el formulario sigue llegando: el campo del formulario no está en el CRM',
};

export const FORMATO_DE_CONVERSION: FormatoDelPlan<GrupoDelPlanDeConversion> = {
  departamento: 'conversion',
  grupos: GRUPOS_DEL_PLAN_DE_CONVERSION,
  grupoDe,
  textoDe: textoDeConversion,
  noSeMidio: NO_SE_MIDIO,
  tope: { primero: PRIMERAS },
};

export type PlanDeConversion = PlanDelDepartamento<GrupoDelPlanDeConversion>;

export function armarPlanDeConversion(p: ParaElPlan): PlanDeConversion {
  return armarPlan(FORMATO_DE_CONVERSION, p);
}
