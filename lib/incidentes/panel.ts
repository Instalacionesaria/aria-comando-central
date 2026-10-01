// El lado del navegador del Panel de Incidentes: pedir la lista, marcar revisado y decir a quién le
// toca cada situación.

import { pedir } from '../http/cliente.ts';

const RUTA = '/api/incidentes';

export interface Incidente {
  id: string;
  orgId: string;
  empresa: string;
  creadoEl: string;
  ref: string;
  situacion: string;
  origen: string;
  donde: string | null;
  usuario: string | null;
  tecnico: string;
  salvado: boolean;
  revisadoEl: string | null;
}

export type ResultadoDeIncidentes =
  | { tipo: 'datos'; incidentes: Incidente[]; ilegibles: string[] }
  | { tipo: 'fallo'; mensaje: string };

export async function leerIncidentes(dias: number): Promise<ResultadoDeIncidentes> {
  const r = await pedir<{ incidentes: Incidente[]; ilegibles: string[] }>(`${RUTA}?dias=${dias}`);
  if (r.tipo === 'datos') return { tipo: 'datos', incidentes: r.datos.incidentes, ilegibles: r.datos.ilegibles };
  if (r.tipo === 'rechazado') return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo leer el Panel de Incidentes.' };
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para leer el Panel de Incidentes.' };
}

export async function marcarRevisado(orgId: string, id: string): Promise<boolean> {
  const r = await pedir<{ revisado: boolean }>(`${RUTA}/revisar`, { metodo: 'POST', cuerpo: { orgId, id } });
  return r.tipo === 'datos';
}

/**
 * A quién le toca cada situación. Son los mismos tres finales que ve la persona en
 * `lib/fundaciones/mensajes.ts`, y la prueba 183 comprueba que las dos listas cubren las mismas
 * situaciones: si una se agrega en un lado y no en el otro, se pone roja.
 */
export type Quien = 'nuestro' | 'cuenta' | 'nadie';

export const QUIEN_DE_LA_SITUACION: Readonly<Record<string, Quien>> = {
  'IA-CONEXION': 'nuestro',
  'IA-TIEMPO': 'nuestro',
  'IA-MODELO': 'nuestro',
  'IA-PETICION': 'nuestro',
  'IA-GRANDE': 'nuestro',
  'IA-VACIO': 'nuestro',
  'IA-TRUNCADO': 'nuestro',
  'IA-ESTRUCTURA': 'nuestro',
  'IA-OTRO': 'nuestro',
  'IA-SIN-SALDO': 'cuenta',
  'IA-LLAVE': 'cuenta',
  'IA-PERMISO': 'cuenta',
  'IA-SATURADO': 'nadie',
  'IA-LIMITE': 'nadie',
  'IA-DECLINO': 'nadie',
};

export function quienDe(i: Pick<Incidente, 'situacion' | 'salvado'>): Quien {
  if (i.salvado) return 'nadie';
  return QUIEN_DE_LA_SITUACION[i.situacion] ?? 'nuestro';
}

/** Los cuatro números de arriba. «Hoy» es desde la medianoche del navegador. */
export function contadores(incidentes: readonly Incidente[]) {
  const medianoche = new Date();
  medianoche.setHours(0, 0, 0, 0);
  const vistos = incidentes.filter((i) => !i.salvado);
  return {
    hoy: vistos.filter((i) => new Date(i.creadoEl) >= medianoche).length,
    total: vistos.length,
    salvados: incidentes.length - vistos.length,
    nuestrosSinRevisar: vistos.filter((i) => quienDe(i) === 'nuestro' && i.revisadoEl === null).length,
  };
}
