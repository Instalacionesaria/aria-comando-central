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
// decir y su aviso escrito — `lecturaDeConversion` es la que decide, con `recorridoDelLead` y
// `embudoDelFormulario` adentro, y las tres tienen pruebas verificadas por mutación contra la base.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedir } from '../http/cliente.ts';
import type { ClaveDePeriodo } from './periodo.ts';
import type { ClaveDePaso, PasosDeConversion } from './pasosDeConversion.ts';
import type { RecorridoDeLosLeads } from './recorridoDelLead.ts';
import type { EmbudoDelFormulario } from './embudoDelFormulario.ts';
import type { Frescura } from './frescura.ts';
import type { PlanDeConversion } from '../agentes/plan/conversion.ts';
import type { PuedeConSenales, SenalesDelDepartamento } from './vistaDeSenales.ts';

const RUTA = '/api/conversion';

export interface PantallaDeConversion {
  periodo: ClaveDePeriodo;
  /** La tira y las cinco tarjetas del prototipo, en días cerrados (CV15-04). Todo de 0 a 1. */
  pasos: PasosDeConversion;
  /** Por dónde entró la gente, para el cajón de Landing: una fila por familia, que **no se suman entre sí**. */
  recorrido: RecorridoDeLosLeads;
  /** El formulario de la landing, para el cajón de Formulario. Su `finalizacion` viaja en %. */
  formulario: EmbudoDelFormulario;
  /** La lectura de contactos, para el punto del chip «GoHighLevel» (CV15-03), con la frase de la cabecera. */
  frescura: { contactos: { estado: Frescura['estado']; aviso: string | null } };
  /**
   * Las señales del detector (AG14 de los agentes): las vivas de la ventana, el último plan y las reglas, y los ids
   * de las de cada paso (CV15-19).
   */
  senales: SenalesDelDepartamento<PlanDeConversion> & { porPaso: Record<ClaveDePaso, string[]> };
  /** Lo que esta sesión puede hacer con ellas. Todo `false` bajo delegación. */
  puedeConSenales: PuedeConSenales;
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
