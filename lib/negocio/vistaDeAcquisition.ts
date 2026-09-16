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
// Acá el cliente pide y dibuja. Cada cifra ya llega con su piso aplicado, su nulo donde no se puede
// decir y su aviso escrito — `costoDelAnuncio` y `calidadDeLaAtribucion` son los que deciden, y son
// los que tienen pruebas verificadas por mutación contra la base de verdad.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedir } from '../http/cliente.ts';
import type { ClaveDePeriodo } from './periodo.ts';
import type { CostoDeLosAnuncios } from './costoDelAnuncio.ts';
import type { CalidadDeLaAtribucion } from './calidadDeLaAtribucion.ts';

const RUTA = '/api/acquisition';

export interface PantallaDeAcquisition {
  periodo: ClaveDePeriodo;
  costo: CostoDeLosAnuncios;
  calidad: CalidadDeLaAtribucion;
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
    return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo leer el costo de los anuncios.' };
  }
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para leer el costo de los anuncios.' };
}
