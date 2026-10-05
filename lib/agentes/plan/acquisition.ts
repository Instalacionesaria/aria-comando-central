// El Plan de acción de Acquisition, armado con plantillas (`docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`,
// AG-32; `docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md`, A6-17 a A6-23). Puro.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL FORMATO
//
//   · Cuatro grupos en este orden —«Lo que dice la data», «Ajusta o pausa esto», «Haz más de esto», «Para
//     otras áreas»— y aparte «Requiere validación ejecutiva», adonde va lo de presupuesto sin cambiar de
//     redacción (A6-17, A6-22). Un grupo vacío se guarda vacío: la pantalla decide si lo dibuja.
//   · Cada renglón dice la métrica, el valor y la base en la misma frase (A6-06), con el verbo que dice si
//     compara períodos («subió … contra los 30 días anteriores») o entidades («está … por debajo de»)
//     (A6-07). La entidad viaja como identificador: el nombre se resuelve al mostrar (A6-05).
//   · Dentro de cada grupo, primero lo que más gente pierde (A6-11) y después lo más grave; lo que no tiene
//     pérdida calculable va después, y la pantalla lo dice.
//   · Sólo lo vigente: lo que una persona ya descartó o resolvió no vuelve a recomendarse (A6-20), y el plan
//     dice sobre qué ventana se calculó (A6-23).
//   · Lo que quedó bajo el piso se cuenta (AG-27) y lo que no se pudo medir se dice.
//
// Cuando haya llave, el modelo sólo redacta dentro de estos renglones (AG-32); si no llega, queda esto.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ParaElPlan } from '../detectores/correr.ts';
import { ACQ, DIAS_DE_HISTORIA_DE_LA_ENTREGA } from '../detectores/acquisition.ts';
import { GRAVEDADES, type Deteccion } from '../senales/tipos.ts';

export const GRUPOS_DEL_PLAN_DE_ACQUISITION = [
  { clave: 'data', titulo: 'Lo que dice la data' },
  { clave: 'ajusta', titulo: 'Ajusta o pausa esto' },
  { clave: 'haz_mas', titulo: 'Haz más de esto' },
  { clave: 'otras_areas', titulo: 'Para otras áreas' },
  { clave: 'validacion', titulo: 'Requiere validación ejecutiva' },
] as const;
export type GrupoDelPlan = (typeof GRUPOS_DEL_PLAN_DE_ACQUISITION)[number]['clave'];

export interface RenglonDelPlan {
  regla: string;
  entidad: Deteccion['entidad'];
  gravedad: Deteccion['gravedad'];
  perdidaContactos: number | null;
  muestra: number | null;
  texto: string;
  revision: string;
}

export interface PlanDeAcquisition {
  departamento: 'acquisition';
  ventana: ParaElPlan['ventana'];
  dia: string;
  /** La ventana sobre la que se calculó (A6-23). Nula si no se pudo medir ninguna. */
  periodo: { desde: string; hasta: string } | null;
  grupos: { clave: GrupoDelPlan; titulo: string; renglones: RenglonDelPlan[] }[];
  debajoDelPiso: number;
  /** Lo que no se pudo medir en esta pasada, en palabras. */
  sinMedicion: string[];
}

/** El grupo de cada regla. Lo de presupuesto, a validación ejecutiva (A6-22). */
function grupoDe(d: Deteccion): GrupoDelPlan {
  if (d.requiereValidacionEjecutiva) return 'validacion';
  if (d.destino !== null) return 'otras_areas';
  switch (d.regla) {
    case ACQ.cplSostenido:
    case ACQ.gastoSinCrecimiento:
    case ACQ.icpEntreCampanas:
      return 'ajusta';
    default:
      return 'data';
  }
}

const NUMERO = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, useGrouping: 'always' } as Intl.NumberFormatOptions);
const numero = (x: number | null | undefined) => (x === null || x === undefined ? '—' : NUMERO.format(x));
const porcentaje = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${NUMERO.format(Math.round(Math.abs(x) * 100))} %`);
const puntos = (x: number) => NUMERO.format(Math.round(x * 100));

/** Los días de la ventana, en palabras: «los 30 días anteriores». */
const anteriores = (v: ParaElPlan['ventana']) => `los ${v === '7d' ? 7 : 30} días anteriores`;

/** La frase de cada regla: métrica, valor y base juntas (A6-06), con el verbo que corresponde (A6-07). */
export function textoDe(d: Deteccion, ventana: ParaElPlan['ventana']): string {
  const ev = (d.evidencia ?? {}) as Record<string, unknown>;
  switch (d.regla) {
    case ACQ.sinEntrega: {
      const n = (ev.campanas as unknown[] | undefined)?.length ?? 0;
      return d.entidad.tipo === 'empresa'
        ? `Ninguna de las ${numero(n)} campañas activas que entregaban en los últimos ${DIAS_DE_HISTORIA_DE_LA_ENTREGA} días entrega desde hace ${numero(d.valorActual)} días cerrados.`
        : `No entrega desde hace ${numero(d.valorActual)} días cerrados; otras campañas activas sí.`;
    }
    case ACQ.cplSostenido:
      return `El costo por contacto subió ${porcentaje(d.cambioPct)} contra ${anteriores(ventana)}: de ${numero(d.lineaBase)} a ${numero(d.valorActual)}, sobre ${numero(d.muestra)} contactos.`;
    case ACQ.gastoSinCrecimiento: {
      const ahora = ev.ahora as { contactos?: number } | undefined;
      const antes = ev.antes as { contactos?: number } | undefined;
      return `La inversión subió ${porcentaje(d.cambioPct)} contra ${anteriores(ventana)} (de ${numero(d.lineaBase)} a ${numero(d.valorActual)}) y los contactos no subieron: ${numero(antes?.contactos)} antes y ${numero(ahora?.contactos)} ahora.`;
    }
    case ACQ.concentracion:
      return `Se lleva el ${porcentaje(d.valorActual)} del gasto de la ventana, entre ${numero((ev.campanas as unknown[] | undefined)?.length)} campañas con gasto.`;
    case ACQ.icpEntreCampanas:
      return `Su ICP promedio está ${numero((d.lineaBase ?? 0) - (d.valorActual ?? 0))} puntos por debajo del de su funnel: ${numero(d.valorActual)} contra ${numero(d.lineaBase)}, sobre ${numero(d.muestra)} calificados con puntaje.`;
    case ACQ.escalaPorCalificado:
      return `Su costo por calificado está ${porcentaje(d.cambioPct)} por debajo del de la empresa: ${numero(d.valorActual)} contra ${numero(d.lineaBase)}, sobre ${numero(d.muestra)} calificados.`;
    case ACQ.fugaEntreEtapas:
      return `El paso de contacto a agendado está ${puntos((d.lineaBase ?? 0) - (d.valorActual ?? 0))} puntos por debajo del de los otros funnels: ${porcentaje(d.valorActual)} contra ${porcentaje(d.lineaBase)}, sobre ${numero(d.muestra)} contactos.`;
    case ACQ.cpmAbrupto:
      return `El costo por mil impresiones subió ${porcentaje(d.cambioPct)} contra ${anteriores(ventana)}: de ${numero(d.lineaBase)} a ${numero(d.valorActual)}, sobre ${numero(d.muestra)} impresiones.`;
    case ACQ.cambioBruscoConjunto: {
      const que = d.metrica === 'costo_por_contacto' ? 'El costo por contacto del conjunto' : 'El gasto del conjunto';
      return `${que} ${(d.cambioPct ?? 0) >= 0 ? 'subió' : 'bajó'} ${porcentaje(d.cambioPct)} contra ${anteriores(ventana)}: de ${numero(d.lineaBase)} a ${numero(d.valorActual)}, sobre ${numero(d.muestra)} contactos.`;
    }
    case ACQ.atribucionContactos:
    case ACQ.atribucionCitas:
    case ACQ.atribucionVentas:
    case ACQ.atribucionUtm:
    case ACQ.atribucionSinCampana: {
      // La consecuencia es la del monitor, que marca los nombres de campo con acentos graves: acá van limpios.
      const consecuencia = typeof ev.consecuencia === 'string' ? `; ${ev.consecuencia.replace(/`/g, '')}` : '.';
      const cuantos = Number(ev.cuantos ?? 0);
      const sobre = Number(ev.sobre ?? 0);
      return d.regla === ACQ.atribucionUtm
        ? `${numero(cuantos)} de ${numero(sobre)} contactos con UTM traen algunas y no las cinco (${porcentaje(1 - (d.valorActual ?? 0))})${consecuencia}`
        : `${String(ev.titulo ?? d.metrica)}: ${porcentaje(d.valorActual)}, ${numero(cuantos)} de ${numero(sobre)}${consecuencia}`;
    }
    default:
      return `${d.metrica}: ${numero(d.valorActual)}.`;
  }
}

/** Lo que no se pudo medir, en palabras. */
const NO_SE_MIDIO: Record<string, string> = {
  [ACQ.sinEntrega]: 'si alguna campaña dejó de entregar: falta algún día cerrado de los anuncios',
  [ACQ.cplSostenido]: 'el costo por contacto contra la ventana anterior: falta el gasto de algún día cerrado',
  [ACQ.gastoSinCrecimiento]: 'el gasto contra los contactos: falta el gasto de algún día cerrado',
  [ACQ.concentracion]: 'el reparto del gasto: falta el gasto de algún día cerrado',
  [ACQ.escalaPorCalificado]: 'el costo por calificado: no hubo gasto o no hubo calificados en la ventana, o falta el gasto de algún día cerrado',
  [ACQ.cpmAbrupto]: 'el costo por mil impresiones contra la ventana anterior: falta el gasto de algún día cerrado',
  [ACQ.cambioBruscoConjunto]: 'los conjuntos contra la semana anterior: falta el gasto de algún día cerrado',
  [ACQ.atribucionContactos]: 'cuántos contactos conservan el anuncio: no entró ningún contacto en la ventana',
  [ACQ.atribucionCitas]: 'cuántas citas conservan el anuncio: no hubo citas en la ventana',
  [ACQ.atribucionVentas]: 'cuántas ventas conservan el anuncio: no hay ventas reportadas en la ventana',
  [ACQ.atribucionUtm]: 'las UTM incompletas: ningún contacto de la ventana trae UTM',
  [ACQ.atribucionSinCampana]: 'cuántos contactos conservan la campaña: no entró ningún contacto en la ventana',
};

export function armarPlanDeAcquisition(p: ParaElPlan): PlanDeAcquisition {
  const grupos = GRUPOS_DEL_PLAN_DE_ACQUISITION.map((g) => ({ clave: g.clave, titulo: g.titulo, renglones: [] as RenglonDelPlan[] }));
  for (const d of p.vigentes) {
    grupos.find((g) => g.clave === grupoDe(d))!.renglones.push({
      regla: d.regla,
      entidad: d.entidad,
      gravedad: d.gravedad,
      perdidaContactos: d.perdidaContactos,
      muestra: d.muestra,
      texto: textoDe(d, p.ventana),
      revision: d.revisionRecomendada,
    });
  }
  // Primero lo que más gente pierde; lo que no tiene pérdida, después; a igual pérdida, lo más grave.
  for (const g of grupos) {
    g.renglones.sort(
      (a, b) =>
        (b.perdidaContactos ?? -1) - (a.perdidaContactos ?? -1) ||
        GRAVEDADES.indexOf(a.gravedad) - GRAVEDADES.indexOf(b.gravedad) ||
        a.entidad.id.localeCompare(b.entidad.id),
    );
  }
  return {
    departamento: 'acquisition',
    ventana: p.ventana,
    dia: p.dia,
    periodo: p.periodo ?? null,
    grupos,
    debajoDelPiso: p.debajoDelPiso.length,
    sinMedicion: p.sinMedicion.map((r) => NO_SE_MIDIO[r] ?? r),
  };
}
