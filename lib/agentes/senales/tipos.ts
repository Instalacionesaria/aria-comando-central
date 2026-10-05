// Lo que un detector entrega y lo que la tabla común guarda (`docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`,
// AG-20 a AG-26). Sin base y sin red: lo usan el escritor, la pasada diaria y las pruebas.

import { PISO_DE_UNA_TASA } from '../../negocio/indicadoresDeCitas.ts';

/** Los departamentos que tienen detector (`D-01`). Sales y Leads no: lo suyo lo calcula el cerebro. */
export const DEPARTAMENTOS_CON_SENALES = ['acquisition', 'creative', 'conversion', 'conversation'] as const;
export type DepartamentoConSenales = (typeof DEPARTAMENTOS_CON_SENALES)[number];

/** Cada detector corre sobre 7 y 30 días cerrados, y cada señal es de una ventana (AG-28). */
export const VENTANAS_DE_LAS_SENALES = ['7d', '30d'] as const;
export type VentanaDeSenal = (typeof VENTANAS_DE_LAS_SENALES)[number];

/** El juego cerrado de entidades (AG-21). La entidad es siempre un identificador, nunca un nombre. */
export const ENTIDADES_DE_SENAL = [
  'campana', 'conjunto', 'anuncio', 'pieza', 'funnel', 'par_de_etapas', 'familia_de_entrada',
  'patron', 'agente', 'closer', 'llamada', 'empresa',
] as const;
export type EntidadDeSenal = (typeof ENTIDADES_DE_SENAL)[number];

/** De mayor a menor: el orden es el que dice si una gravedad «sube» (AG-22). */
export const GRAVEDADES = ['critica', 'alta', 'media', 'info'] as const;
export type Gravedad = (typeof GRAVEDADES)[number];

/** La taxonomía de la arquitectura de producto para Conversation (AG-37). */
export const ISSUE_SOURCES = [
  'prompt_design', 'agent_execution', 'missing_data', 'missing_tool', 'workflow_configuration', 'external_failure',
] as const;
export type IssueSource = (typeof ISSUE_SOURCES)[number];

/** El piso de todo el sistema (AG-26): debajo de 10 en el denominador no hay señal, se cuenta. */
export const PISO_DE_UNA_SENAL = PISO_DE_UNA_TASA;

/** Lo que detectó una regla sobre una entidad, en una ventana. Es la señal antes de tener vida. */
export interface Deteccion {
  /** El código del catálogo de umbrales (`ACQ-CPL-SOSTENIDO`). */
  regla: string;
  entidad: { tipo: EntidadDeSenal; id: string };
  metrica: string;
  lineaBase: number | null;
  valorActual: number | null;
  cambioPct: number | null;
  /** El denominador que declara la regla. Nulo sólo en una regla de ausencia («sin entrega»). */
  muestra: number | null;
  /** Días calendario de la empresa, `AAAA-MM-DD`. */
  periodo: { desde: string | null; hasta: string };
  datosDesde: string | null;
  gravedad: Gravedad;
  causasPosibles: readonly string[];
  revisionRecomendada: string;
  perdidaContactos: number | null;
  destino: string | null;
  requiereValidacionEjecutiva: boolean;
  /** En foto: el valor con que se calculó y si era provisional (AG-33). */
  umbral: { valor: number; provisional: boolean };
  /** En foto: lo que midió la función, con ids y cifras (AG-28). */
  evidencia: unknown;
  issueSource?: IssueSource | null;
}

/** Una detección que no llegó al piso: se cuenta en el plan, con su detalle (AG-27). */
export interface DebajoDelPiso {
  regla: string;
  entidad: { tipo: EntidadDeSenal; id: string };
  muestra: number;
}

/**
 * La confianza sale de la muestra (AG-26): alta con 30 o más, media de 10 a 29. Una regla de ausencia no
 * tiene denominador y mide un hecho —no hubo entrega—, no una proporción: alta.
 */
export function confianzaDe(muestra: number | null): 'alta' | 'media' {
  return muestra === null || muestra >= 30 ? 'alta' : 'media';
}

/** `departamento · regla · entidad_tipo · entidad_id · ventana` (AG-22). */
export function huellaDe(departamento: DepartamentoConSenales, d: Pick<Deteccion, 'regla' | 'entidad'>, ventana: VentanaDeSenal): string {
  return [departamento, d.regla, d.entidad.tipo, d.entidad.id, ventana].join('·');
}

/** ¿`nueva` es más grave que `anterior`? */
export function subeLaGravedad(anterior: Gravedad, nueva: Gravedad): boolean {
  return GRAVEDADES.indexOf(nueva) < GRAVEDADES.indexOf(anterior);
}
