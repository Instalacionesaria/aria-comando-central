// La medición de Acquisition armada a mano, para probar el detector sin base. La comparten la 221 y la 285.
//
// Vivía dentro de la 221; la 285 (los detectores por cliente, el nivel 3) necesita la misma, y una copia en cada
// archivo se separaría el primer día que la medición gane un campo. Arma los embudos con la misma función pura de la
// pantalla (`armarEmbudos`), así que lo que el detector recibe tiene la forma de verdad.
//
// Lo del nivel 3 tiene los valores de un solo cliente por omisión: `clienteDe` vacío, y los dos frenos de Meta
// iguales a los de la pantalla (`faltanDiasDeMeta` cuando la pantalla dice `faltan_dias`; `anteriorDeMeta`, su
// `anterior`). Así la 221 mide lo de siempre sin nombrarlos. Lo de C6 · D3 —el monitor de cada cliente, el cliente de
// cada conjunto y el principal— va vacío por omisión: lo usa la 294.

import type { MedidaDeAcquisition } from '../../lib/agentes/detectores/acquisition.ts';
import type { PuntoDeAtribucion } from '../../lib/negocio/calidadDeLaAtribucion.ts';
import {
  armarEmbudos,
  CIFRAS_VACIAS,
  type CampanaConocida,
  type Cifras,
  type SinComparacion,
  type SinCostos,
} from '../../lib/negocio/embudosDeAcquisition.ts';

/** Por omisión la campaña trae contactos atribuidos: toda su inversión paga los costos de personas (A14-19). */
export const cifras = (c: Partial<Cifras>): Cifras => ({ ...CIFRAS_VACIAS, inversionConContactos: c.inversion ?? 0, ...c });

export const campana = (id: string, funnel: CampanaConocida['funnel'], estado = 'ACTIVE'): CampanaConocida => ({
  campana: id,
  nombre: `Nombre visible ${id}`,
  estado,
  conocida: true,
  conContactos: true,
  funnel,
});

export function medida(e: {
  campanas: CampanaConocida[];
  actual: [string, Partial<Cifras>][];
  previa?: [string, Partial<Cifras>][] | null;
  entrega?: [string, number][];
  sinComparacion?: SinComparacion | null;
  sinCostos?: SinCostos | null;
  ventana?: '7d' | '30d';
  impresiones?: [string, { gasto: number; impresiones: number; gastoAntes: number; impresionesAntes: number }][];
  conjuntos?: [string, { gasto: number; contactos: number; gastoAntes: number; contactosAntes: number }][];
  /** Los puntos del monitor. Por omisión, todos con la cobertura entera: no publican nada. */
  puntos?: Partial<Record<PuntoDeAtribucion['clave'], [number, number]>>;
  /** El cliente de cada campaña (el nivel 3). Por omisión, vacío: un solo cliente. */
  clienteDe?: [string, string][];
  /** El freno de Meta. Por omisión, el de la pantalla: `faltan_dias` o el gasto incompleto. */
  faltanDiasDeMeta?: boolean;
  /** (C6 · D3) Los puntos del monitor de cada cliente activo. Por omisión, ninguno. */
  atribucionPorCliente?: [string, Partial<Record<PuntoDeAtribucion['clave'], [number, number]>>][];
  /** (C6 · D3) El cliente de cada conjunto. Por omisión, ninguno. */
  clienteDelConjunto?: [string, string][];
  /** (C6 · D3) El cliente por omisión. Por omisión, ninguno: con varios clientes, todo lleva su cliente adelante. */
  principal?: string | null;
}): MedidaDeAcquisition {
  const actual = new Map(e.actual.map(([id, c]) => [id, cifras(c)]));
  const previa = e.previa === null ? null : new Map((e.previa ?? []).map(([id, c]) => [id, cifras(c)]));
  const embudos = armarEmbudos({
    ventana: { desde: '2026-09-05', hasta: '2026-10-04' },
    anterior: previa ? { desde: '2026-08-06', hasta: '2026-09-04' } : null,
    sinComparacion: e.sinComparacion ?? (previa ? null : 'sin_historia'),
    campanas: e.campanas,
    actual,
    previa,
    cobertura: { conCampana: 0, sobre: 0 },
    sinCostos: e.sinCostos ?? null,
  });
  const faltanDiasDeMeta = e.faltanDiasDeMeta ?? (e.sinComparacion === 'faltan_dias' || e.sinCostos === 'gasto_incompleto');
  const claves: PuntoDeAtribucion['clave'][] = ['leads_con_anuncio', 'citas_con_anuncio', 'ventas_con_anuncio', 'utm_incompletas', 'sin_campana'];
  const monitor = (puntos: Partial<Record<PuntoDeAtribucion['clave'], [number, number]>> | undefined) => ({
    dias: 30,
    puntos: claves.map((clave) => {
      // UTM cuenta lo roto: por omisión, ninguna incompleta.
      const [cuantos, sobre] = puntos?.[clave] ?? (clave === 'utm_incompletas' ? [0, 100] : [100, 100]);
      return { clave, titulo: `Título de ${clave}`, cuantos, sobre, proporcion: null, consecuencia: `consecuencia de ${clave}` };
    }),
    fueraDeAlcance: [],
    aviso: null,
  });
  return {
    ventana: e.ventana ?? '30d',
    embudos,
    actual,
    previa,
    entrega: new Map((e.entrega ?? []).map(([id, dias]) => [id, { diasSinEntregar: dias, ultimaEntrega: '2026-09-19' }])),
    impresiones: previa ? new Map(e.impresiones ?? []) : null,
    conjuntos: previa && (e.ventana ?? '30d') === '7d' ? new Map(e.conjuntos ?? []) : null,
    atribucion: monitor(e.puntos),
    clienteDe: new Map(e.clienteDe ?? []),
    faltanDiasDeMeta,
    anteriorDeMeta: faltanDiasDeMeta ? null : embudos.anterior,
    atribucionPorCliente: new Map((e.atribucionPorCliente ?? []).map(([cliente, puntos]) => [cliente, monitor(puntos)])),
    clienteDelConjunto: new Map(e.clienteDelConjunto ?? []),
    principal: e.principal ?? null,
  };
}
