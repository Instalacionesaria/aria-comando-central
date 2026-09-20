// La LECTURA de la pantalla de Conversion desde el navegador.
//
// ═══════════════════════════════════════════════════════════════════════════════
// NO CALCULA NADA, Y ESO ES LA MITAD DE LO QUE ESTE CAMBIO ARREGLA
//
// El que se va —`lib/aios/conversion.js`, 648 líneas— calculaba **en el navegador** los cinco pasos
// del recorrido, la banda de «lo esperado», la caída entre pasos, las once fricciones con su
// pérdida en personas y el plan de tres acciones con su 45 % de recuperación, todo sobre **538
// literales** y **47 frases escritas a mano**. Nada venía del servidor porque no había servidor:
// `conversion.js` no tenía una sola sentencia `import`, ni `fetch`, ni `await`.
//
// Acá el cliente pide y dibuja. Cada cifra llega con su piso aplicado, su nulo donde no se puede
// decir y su aviso escrito — `recorridoDelLead` y `embudoDelFormulario` son los que deciden, y son
// los que tienen pruebas verificadas por mutación contra la base.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedir } from '../http/cliente.ts';
import type { ClaveDePeriodo } from './periodo.ts';
import type { RecorridoDeLosLeads } from './recorridoDelLead.ts';
import type { EmbudoDelFormulario } from './embudoDelFormulario.ts';

const RUTA = '/api/conversion';

export interface PantallaDeConversion {
  periodo: ClaveDePeriodo;
  /** Por dónde entró la gente: una fila por familia de recorrido, que **no se suman entre sí**. */
  recorrido: RecorridoDeLosLeads;
  /** Cuántos abandonan el formulario de la landing, y los cinco huecos declarados. */
  formulario: EmbudoDelFormulario;
}

export type ResultadoDeConversion =
  | { tipo: 'datos'; pantalla: PantallaDeConversion }
  | { tipo: 'fallo'; mensaje: string };

export async function leerConversion(periodo: ClaveDePeriodo): Promise<ResultadoDeConversion> {
  /* El período es OBLIGATORIO acá aunque el servidor tenga uno por omisión: con un argumento
     opcional, una llamada que se olvide de pasarlo compila, pide treinta días y enciende el botón
     que diga el estado local. Los dos se ven bien y no coinciden. */
  const r = await pedir<PantallaDeConversion>(`${RUTA}?periodo=${encodeURIComponent(periodo)}`);
  if (r.tipo === 'datos') return { tipo: 'datos', pantalla: r.datos };
  /* Los dos fallos se distinguen: «el servidor dijo que no» y «no se pudo llegar al servidor»
     mandan a mirar dos cosas distintas. */
  if (r.tipo === 'rechazado') {
    return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo leer por dónde entra la gente.' };
  }
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para leer por dónde entra la gente.' };
}
