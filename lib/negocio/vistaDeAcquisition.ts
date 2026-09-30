// La LECTURA de la pantalla de Acquisition desde el navegador.
//
// ═══════════════════════════════════════════════════════════════════════════════
// NO CALCULA NADA, Y ESO ES TODO LO QUE HACE FALTA DECIR DE ESTE ARCHIVO
//
// El que se va con este cambio —`lib/aios/acquisition.js`, 302 líneas— calculaba **en el navegador**
// las tasas de paso de tres embudos, el costo por calificado, los umbrales de las alertas y el tope
// del 94 %, todo sobre 58 literales inventados. Nada de eso venía del servidor porque no había
// servidor: la pestaña se dibujaba sola.
//
// Acá el cliente pide y dibuja. Cada cifra ya llega con su piso aplicado y su nulo donde no se puede
// decir. `costoDelAnuncio` y `calidadDeLaAtribucion` traen además su aviso escrito; desde AQ-3,
// `embudosDeAcquisition` trae las tasas, los costos, las variaciones y los motivos como claves, y el
// texto lo pone el front con su lista cerrada de frases (docs/acquisition/14, A14-02). Los tres tienen
// pruebas verificadas por mutación contra la base de verdad.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedir } from '../http/cliente.ts';
import type { ClaveDePeriodo } from './periodo.ts';
import type { CostoDeLosAnuncios } from './costoDelAnuncio.ts';
import type { CalidadDeLaAtribucion } from './calidadDeLaAtribucion.ts';
import type { EmbudosDeAcquisition } from './embudosDeAcquisition.ts';
import type { Funnel, FunnelDeCampana } from './funnelDeLaCampana.ts';

const RUTA = '/api/acquisition';

export interface PantallaDeAcquisition {
  periodo: ClaveDePeriodo;
  costo: CostoDeLosAnuncios;
  calidad: CalidadDeLaAtribucion;
  /** Los tres funnels, ya calculados: tasas, costos y variaciones (`embudosDeAcquisition.ts`). */
  embudos: EmbudosDeAcquisition;
  /** Si esta sesión puede asignar el funnel de una campaña (`credenciales.editar`). */
  puedeAsignar: boolean;
}

export type ResultadoDeAcquisition =
  | { tipo: 'datos'; pantalla: PantallaDeAcquisition }
  | { tipo: 'fallo'; mensaje: string };

export async function leerAcquisition(periodo: ClaveDePeriodo): Promise<ResultadoDeAcquisition> {
  /* El período es OBLIGATORIO acá aunque el servidor tenga uno por omisión, y es a propósito: con un
     argumento opcional, una llamada que se olvide de pasarlo compila, pide treinta días y enciende el
     botón que diga el estado local. Los dos se ven bien y no coinciden. */
  const r = await pedir<PantallaDeAcquisition>(`${RUTA}?periodo=${encodeURIComponent(periodo)}`);
  if (r.tipo === 'datos') return { tipo: 'datos', pantalla: r.datos };
  /* Los dos fallos se distinguen: «el servidor dijo que no» y «no se pudo llegar al servidor» mandan
     a mirar dos cosas distintas. */
  if (r.tipo === 'rechazado') {
    return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo leer Acquisition.' };
  }
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para leer Acquisition.' };
}

/** El resultado de asignar o quitar un funnel: la lista que quedó, o el motivo del servidor. */
export type ResultadoDelFunnel = { tipo: 'datos'; funnels: FunnelDeCampana[] } | { tipo: 'fallo'; mensaje: string };

async function escribirFunnel(metodo: 'PUT' | 'DELETE', camino: string, cuerpo?: unknown): Promise<ResultadoDelFunnel> {
  const r = await pedir<{ funnels: FunnelDeCampana[] }>(camino, { metodo, cuerpo });
  if (r.tipo === 'datos') return { tipo: 'datos', funnels: r.datos.funnels };
  // El motivo del servidor se muestra tal cual: dice qué funnels existen, o que la campaña no está.
  if (r.tipo === 'rechazado') return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo guardar el funnel.' };
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para guardar el funnel.' };
}

/** Asigna o reemplaza el funnel de una campaña (`PUT /api/acquisition/funnel`). */
export function guardarFunnelDeLaCampana(campana: string, funnel: Funnel): Promise<ResultadoDelFunnel> {
  return escribirFunnel('PUT', '/api/acquisition/funnel', { campana, funnel });
}

/** Quita el funnel de una campaña: vuelve a «Sin funnel». */
export function sacarFunnelDeLaCampana(campana: string): Promise<ResultadoDelFunnel> {
  return escribirFunnel('DELETE', `/api/acquisition/funnel?campana=${encodeURIComponent(campana)}`);
}
