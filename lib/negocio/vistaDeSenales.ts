// Las señales de un departamento desde el navegador: lo que llega en el GET de su pantalla y las dos escrituras
// (`docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`, AG-24 a AG-34). Lo comparten Acquisition y Creative
// Insights; cada uno tiene sus rutas (`app/api/<departamento>/senales` y `…/umbrales`), que vuelven a comprobar
// la capacidad y la delegación.

import { pedir } from '../http/cliente.ts';
import type { SenalParaMostrar } from '../agentes/senales/lectura.ts';
import type { PlanDelDepartamento } from '../agentes/plan/comun.ts';

/** Los departamentos con pantalla de señales, y la ruta de cada uno. */
export const RUTAS_DE_LAS_SENALES = { acquisition: '/api/acquisition', creative: '/api/creative' } as const;
export type DepartamentoConPantalla = keyof typeof RUTAS_DE_LAS_SENALES;

export interface ReglaDelDepartamento {
  codigo: string;
  unidad: 'proporcion' | 'puntos_porcentuales' | 'puntos' | 'dias' | 'veces';
  denominador: string | null;
  gravedad: string;
  porque: string;
  valorProvisional: number;
  valor: number;
  provisional: boolean;
}

export interface SenalesDelDepartamento<P = PlanDelDepartamento> {
  /** `null` con «hoy» o «completo»: las señales son de 7 o de 30 días. */
  ventana: '7d' | '30d' | null;
  lista: SenalParaMostrar[];
  estado: 'crit' | 'warn' | 'ok';
  plan: {
    dia: string;
    plan: P;
    /** La redacción del modelo, ya validada: una frase por renglón (`grupo:índice`). `null` sin llave o sin respuesta. */
    redaccion: { renglones: Record<string, string>; quitadas: { cifra: number; superlativo: number; otras: number } } | null;
    bajoElPiso: number;
    actualizado: string;
  } | null;
  reglas: ReglaDelDepartamento[];
}

/** Lo que esta sesión puede hacer con las señales. Todo `false` bajo delegación. */
export interface PuedeConSenales {
  resolver: boolean;
  validar: boolean;
  firmar: boolean;
}

/** Lo que devuelve una decisión sobre una señal o una firma: listo, o el motivo del servidor. */
export type ResultadoDeUnaSenal = { tipo: 'listo' } | { tipo: 'fallo'; mensaje: string };

/**
 * Marcar vista, resolver o descartar (`POST /api/<departamento>/senales`). Resolver y descartar llevan motivo;
 * quién y cuándo los pone el servidor.
 */
export async function decidirSenal(
  departamento: DepartamentoConPantalla,
  id: string,
  accion: 'vista' | 'resolver' | 'descartar',
  motivo?: string,
): Promise<ResultadoDeUnaSenal> {
  const r = await pedir<unknown>(`${RUTAS_DE_LAS_SENALES[departamento]}/senales`, { metodo: 'POST', cuerpo: { id, accion, ...(motivo ? { motivo } : {}) } });
  if (r.tipo === 'datos') return { tipo: 'listo' };
  if (r.tipo === 'rechazado') return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo guardar la decisión.' };
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para guardar la decisión.' };
}

/** Firmar el umbral de una regla (`PUT /api/<departamento>/umbrales`): pasa de provisional a firme. */
export async function firmarUmbral(departamento: DepartamentoConPantalla, regla: string, valor: number): Promise<ResultadoDeUnaSenal> {
  const r = await pedir<unknown>(`${RUTAS_DE_LAS_SENALES[departamento]}/umbrales`, { metodo: 'PUT', cuerpo: { regla, valor } });
  if (r.tipo === 'datos') return { tipo: 'listo' };
  if (r.tipo === 'rechazado') return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo firmar el umbral.' };
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para firmar el umbral.' };
}
