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
// El armado es el de todos los departamentos (`./comun.ts`); acá vive el formato de Acquisition. Cuando haya
// llave, el modelo sólo redacta dentro de estos renglones (AG-32); si no llega, queda esto.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ParaElPlan } from '../detectores/correr.ts';
import { ACQ, DIAS_DE_HISTORIA_DE_LA_ENTREGA } from '../detectores/acquisition.ts';
import type { FaltaDelGasto, FaltaDelGastoDeUnCliente } from '../../negocio/faltaDeLosClientes.ts';
import type { Deteccion } from '../senales/tipos.ts';
import { anteriores, armarPlan, numero, porcentaje, puntos, type FormatoDelPlan, type PlanDelDepartamento } from './comun.ts';

export type { RenglonDelPlan } from './comun.ts';

export const GRUPOS_DEL_PLAN_DE_ACQUISITION = [
  { clave: 'data', titulo: 'Lo que dice la data' },
  { clave: 'ajusta', titulo: 'Ajusta o pausa esto' },
  { clave: 'haz_mas', titulo: 'Haz más de esto' },
  { clave: 'otras_areas', titulo: 'Para otras áreas' },
  { clave: 'validacion', titulo: 'Requiere validación ejecutiva' },
] as const;
export type GrupoDelPlan = (typeof GRUPOS_DEL_PLAN_DE_ACQUISITION)[number]['clave'];

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

/** La frase de cada regla: métrica, valor y base juntas (A6-06), con el verbo que corresponde (A6-07). */
export function textoDe(d: Deteccion, ventana: ParaElPlan['ventana']): string {
  const ev = (d.evidencia ?? {}) as Record<string, unknown>;
  switch (d.regla) {
    case ACQ.sinEntrega: {
      const n = (ev.campanas as unknown[] | undefined)?.length ?? 0;
      if (d.entidad.tipo === 'empresa')
        return `Ninguna de las ${numero(n)} campañas activas que entregaban en los últimos ${DIAS_DE_HISTORIA_DE_LA_ENTREGA} días entrega desde hace ${numero(d.valorActual)} días cerrados.`;
      // Con varios clientes (el nivel 3), la crítica es de un cliente: su cuenta publicitaria entera.
      if (d.entidad.tipo === 'cliente')
        return `Ninguna de las ${numero(n)} campañas activas de este cliente que entregaban en los últimos ${DIAS_DE_HISTORIA_DE_LA_ENTREGA} días entrega desde hace ${numero(d.valorActual)} días cerrados.`;
      // Con varios clientes sigue siendo cierto: la alta sale sólo si a su cliente le queda alguna campaña entregando.
      return `No entrega desde hace ${numero(d.valorActual)} días cerrados; otras campañas activas sí.`;
    }
    case ACQ.cplSostenido:
      return `El costo por contacto subió ${porcentaje(d.cambioPct)} contra ${anteriores(ventana)}: de ${numero(d.lineaBase)} a ${numero(d.valorActual)}, sobre ${numero(d.muestra)} contactos.`;
    case ACQ.gastoSinCrecimiento: {
      const ahora = ev.ahora as { contactos?: number } | undefined;
      const antes = ev.antes as { contactos?: number } | undefined;
      return `La inversión subió ${porcentaje(d.cambioPct)} contra ${anteriores(ventana)} (de ${numero(d.lineaBase)} a ${numero(d.valorActual)}) y los contactos no subieron: ${numero(antes?.contactos)} antes y ${numero(ahora?.contactos)} ahora.`;
    }
    case ACQ.concentracion:
      // Medida dentro de su cliente (el nivel 3), la evidencia lo nombra.
      return `Se lleva el ${porcentaje(d.valorActual)} del gasto ${ev.cliente ? 'de su cliente en' : 'de'} la ventana, entre ${numero((ev.campanas as unknown[] | undefined)?.length)} campañas con gasto.`;
    case ACQ.icpEntreCampanas:
      // Medido contra su funnel en su cliente (C6 · D3), la evidencia lo nombra.
      return `Su ICP promedio está ${numero((d.lineaBase ?? 0) - (d.valorActual ?? 0))} puntos por debajo del de su funnel${ev.cliente ? ' en su cliente' : ''}: ${numero(d.valorActual)} contra ${numero(d.lineaBase)}, sobre ${numero(d.muestra)} calificados con puntaje.`;
    case ACQ.escalaPorCalificado:
      return `Su costo por calificado está ${porcentaje(d.cambioPct)} por debajo del ${ev.cliente ? 'de su cliente' : 'de la empresa'}: ${numero(d.valorActual)} contra ${numero(d.lineaBase)}, sobre ${numero(d.muestra)} calificados.`;
    case ACQ.fugaEntreEtapas:
      return `El paso de contacto a agendado está ${puntos((d.lineaBase ?? 0) - (d.valorActual ?? 0))} puntos por debajo del de los otros funnels${ev.cliente ? ' de su cliente' : ''}: ${porcentaje(d.valorActual)} contra ${porcentaje(d.lineaBase)}, sobre ${numero(d.muestra)} contactos.`;
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
      const consecuencia = typeof ev.consecuencia === 'string' ? `; ${paraUnaPersona(ev.consecuencia)}` : '.';
      const cuantos = Number(ev.cuantos ?? 0);
      const sobre = Number(ev.sobre ?? 0);
      // El de un cliente (C6 · D3): la entidad es él, y la frase dice que la cifra es suya.
      const deEste = d.entidad.tipo === 'cliente';
      return d.regla === ACQ.atribucionUtm
        ? `${numero(cuantos)} de ${numero(sobre)} contactos con UTM${deEste ? ' de este cliente' : ''} traen algunas y no las cinco (${porcentaje(1 - (d.valorActual ?? 0))})${consecuencia}`
        : `${String(ev.titulo ?? d.metrica)}${deEste ? ' en este cliente' : ''}: ${porcentaje(d.valorActual)}, ${numero(cuantos)} de ${numero(sobre)}${consecuencia}`;
    }
    default:
      return `${d.metrica}: ${numero(d.valorActual)}.`;
  }
}

/**
 * La consecuencia del monitor, escrita para su pantalla: marca los campos con acentos graves y cita las
 * secciones de la arquitectura de producto (`§ 18.12`). En el plan va sin las dos cosas —la primera
 * evaluación real de la redacción las dejó pasar tal cual—: sin los acentos, y sin la oración o la cláusula que
 * cita una sección.
 */
export function paraUnaPersona(consecuencia: string): string {
  const oraciones = consecuencia.replace(/`/g, '').split(/(?<=\.)\s+/)
    // Una oración que cita una sección antes de su primera coma es la cita misma: «Y el § 18.6 ya dice…».
    .filter((o) => !/^[^,]*§/.test(o));
  return oraciones
    .map((o) => o.replace(/,\s*que es el que el\s*§\s*[\d.]+\s*necesita/g, '').replace(/\s*§\s*[\d.]+/g, ''))
    .join(' ')
    .trim();
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

/**
 * Por qué falta el gasto de un cliente, en la frase de la nota de la pantalla (`components/acquisition/PanelDeAcquisition.jsx`,
 * `FRASE`): la misma, para que el plan y la pantalla no digan dos cosas. Va en minúscula y sin el punto, porque el plan
 * la suma a una lista.
 */
export const FRASE_DE_LA_FALTA: Readonly<Record<FaltaDelGasto, string>> = {
  meta_sin_vincular: 'el GoHighLevel de {cliente} no tiene Meta vinculado: vincúlalo en GoHighLevel',
  sin_conexion: 'la conexión de {cliente} con GoHighLevel no está lista. {detalle}',
  no_activo: '{cliente} ya no está activo: su gasto no se lee',
};

/** Las reglas que el gasto incompleto de un cliente deja sin medir: las de los costos de la empresa. */
const LAS_DE_LOS_COSTOS: readonly string[] = [ACQ.cplSostenido, ACQ.gastoSinCrecimiento, ACQ.escalaPorCalificado];

/**
 * De qué cliente falta el gasto y qué hacer, cuando eso deja sin medir alguna regla de los costos (el nivel 3, C6 · D3):
 * los porqués genéricos del plan —«falta el gasto de algún día cerrado»— no decían de quién. Sale de lo que ya dice la
 * pantalla (`gasto.faltaPorCliente`), que sólo nombra a alguien con más de un cliente: con uno, vacío. Pura.
 */
export function porQueFaltaElGasto(sinMedicion: readonly string[], falta: readonly FaltaDelGastoDeUnCliente[] | undefined): string[] {
  if (!falta?.length || !sinMedicion.some((r) => LAS_DE_LOS_COSTOS.includes(r))) return [];
  return falta.map((f) =>
    FRASE_DE_LA_FALTA[f.falta]
      .replace(/\{(\w+)\}/g, (_, k: string) => String((f as unknown as Record<string, unknown>)[k] ?? ''))
      .trim()
      .replace(/\.$/, ''),
  );
}

/** El formato de Acquisition: sus cuatro grupos y la validación ejecutiva (A6-17, A6-22). */
export const FORMATO_DE_ACQUISITION: FormatoDelPlan<GrupoDelPlan> = {
  departamento: 'acquisition',
  grupos: GRUPOS_DEL_PLAN_DE_ACQUISITION,
  grupoDe,
  textoDe,
  noSeMidio: NO_SE_MIDIO,
};

export type PlanDeAcquisition = PlanDelDepartamento<GrupoDelPlan>;

export function armarPlanDeAcquisition(p: ParaElPlan): PlanDeAcquisition {
  return armarPlan(FORMATO_DE_ACQUISITION, p);
}
