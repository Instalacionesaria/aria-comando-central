// Lo que comparten los adaptadores del cerebro: el contexto, la forma de una herramienta y las piezas de
// las proyecciones. Aparte de `../herramientas.ts` para que los adaptadores no importen el catálogo que los
// importa a ellos.

import { PERIODOS, periodoDe } from '../../../negocio/periodo.ts';

/** Lo que una herramienta necesita saber de quién pregunta. Nada de identidad: eso se resolvió en la ruta. */
export interface ContextoDeHerramienta {
  /** La zona de la empresa: cuándo termina su día. */
  zona: string;
  usuarioId: string;
}

export interface DefinicionDeHerramienta {
  nombre: string;
  descripcion: string;
  /** Las secciones que la habilitan: con cualquiera de ellas, o con todas si `todas`. */
  secciones: readonly string[];
  todas?: boolean;
  /** JSON Schema estricto de los argumentos. */
  esquema: Record<string, unknown>;
  /** Corre dentro de la `conOrganizacion` que abre quien llama. Devuelve la proyección. */
  ejecutar: (argumentos: Record<string, unknown>, contexto: ContextoDeHerramienta) => Promise<unknown>;
}

/** El argumento `periodo` de las herramientas que lo usan: las cuatro claves, nada más. */
export const ARGUMENTO_PERIODO = {
  type: 'object',
  additionalProperties: false,
  required: ['periodo'],
  properties: {
    periodo: {
      type: 'string',
      enum: PERIODOS.map((p) => p.clave),
      description: 'hoy (las últimas 24 horas), 7d o 30d (días cerrados), completo (toda la historia).',
    },
  },
} as const;

/** Sin argumentos: un objeto vacío, que el modo estricto exige igual. */
export const SIN_ARGUMENTOS = { type: 'object', additionalProperties: false, required: [], properties: {} } as const;

/** El período pedido, o `null` si no es una de las cuatro claves. */
export function periodoPedido(argumentos: Record<string, unknown>) {
  return typeof argumentos.periodo === 'string' ? periodoDe(argumentos.periodo) : null;
}

/** Las primeras `n` filas de una lista, con cuántas había. «Mostrando X de N» (A7-29). */
export function primeras<T>(lista: readonly T[], n = 20): { filas: T[]; total: number } {
  return { filas: lista.slice(0, n), total: lista.length };
}

/** Exactamente esas claves del objeto, y ninguna otra. La lista blanca de `AG-45`. */
export function tomar<T extends object, K extends keyof T>(objeto: T, claves: readonly K[]): Pick<T, K> {
  const salida = {} as Pick<T, K>;
  for (const k of claves) salida[k] = objeto[k];
  return salida;
}

