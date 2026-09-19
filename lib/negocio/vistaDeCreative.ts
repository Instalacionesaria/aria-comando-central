// La LECTURA de la pantalla de Creative desde el navegador.
//
// ═══════════════════════════════════════════════════════════════════════════════
// NO CALCULA NADA, Y ESO ES LA MITAD DE LO QUE ESTE CAMBIO ARREGLA
//
// El que se va —`lib/aios/creative.js`, 450 líneas— calculaba **en el navegador** el promedio que
// parte la biblioteca en dos, los siete puntos de la curva de retención, el umbral de las «caídas de
// atención» y las doce frases del plan de acción, todo sobre 201 literales inventados. Nada venía
// del servidor porque no había servidor.
//
// Acá el cliente pide y dibuja. Cada cifra llega con su piso aplicado, su nulo donde no se puede
// decir y su aviso escrito — `calidadDelCreativo`, `rendimientoDelCreativo` y `fatigaDelCreativo`
// son los que deciden, y son los que tienen pruebas verificadas por mutación contra la base.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedir } from '../http/cliente.ts';
import type { ClaveDePeriodo } from './periodo.ts';
import type { CalidadDeLosCreativos } from './calidadDelCreativo.ts';
import type { RendimientoDeLosCreativos } from './rendimientoDelCreativo.ts';
import type { FatigaDeLosCreativos } from './fatigaDelCreativo.ts';

const RUTA = '/api/creative';

export interface PantallaDeCreative {
  periodo: ClaveDePeriodo;
  /** Lo que dice el lead que llegó por cada pieza: ICP y agenda. No necesita nada de Meta. */
  calidad: CalidadDeLosCreativos;
  /** Lo que dice la subasta: hook rate, link CTR, vistas de la landing. */
  rendimiento: RendimientoDeLosCreativos;
  /** La caída del CTR contra el tiempo. */
  fatiga: FatigaDeLosCreativos;
}

export type ResultadoDeCreative =
  | { tipo: 'datos'; pantalla: PantallaDeCreative }
  | { tipo: 'fallo'; mensaje: string };

export async function leerCreative(periodo: ClaveDePeriodo): Promise<ResultadoDeCreative> {
  /* El período es OBLIGATORIO acá aunque el servidor tenga uno por omisión: con un argumento
     opcional, una llamada que se olvide de pasarlo compila, pide treinta días y enciende el botón
     que diga el estado local. Los dos se ven bien y no coinciden. */
  const r = await pedir<PantallaDeCreative>(`${RUTA}?periodo=${encodeURIComponent(periodo)}`);
  if (r.tipo === 'datos') return { tipo: 'datos', pantalla: r.datos };
  /* Los dos fallos se distinguen: «el servidor dijo que no» y «no se pudo llegar al servidor»
     mandan a mirar dos cosas distintas. */
  if (r.tipo === 'rechazado') {
    return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo leer el rendimiento de los creativos.' };
  }
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para leer el rendimiento de los creativos.' };
}
