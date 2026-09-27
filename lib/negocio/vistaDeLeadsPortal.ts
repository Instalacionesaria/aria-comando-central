// La LECTURA de Leads Portal desde el navegador: la lista del período y la ficha de una persona.
//
// ═══════════════════════════════════════════════════════════════════════════════
// NO CALCULA NADA: PIDE Y DEVUELVE
//
// La maqueta que esta pantalla reemplaza calculaba todo en el navegador sobre quince personas
// inventadas: los tramos, las tasas, el cierre. Acá cada cifra llega del servidor con su piso
// aplicado, su nulo donde no se puede decir y su aviso escrito.
//
// ── EL TIPO ES EL CONTRATO, Y SE ESCRIBE UNA SOLA VEZ ───────────────────────
//
// Se importa con `import type` de los módulos que lo producen. Redeclararlo acá daría dos
// definiciones que compilan mientras coincidan y dejan de coincidir sin que nada falle. Y el
// `import type` no arrastra nada al navegador: se borra al compilar, así que `leadsDelPortal.ts` —que
// abre la base— no entra al paquete del cliente.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedir } from '../http/cliente.ts';
import type { ClaveDePeriodo } from './periodo.ts';
import type { CoherenciaConSales, LeadsDelPortal } from './leadsDelPortal.ts';
import type { FichaDelLead } from './fichaDelLeadDelPortal.ts';
import type { Frescura } from './frescura.ts';
import type { HuecoDeSales } from './huecosDeSales.ts';

const RUTA = '/api/leads-portal';

export interface PantallaDeLeadsPortal extends LeadsDelPortal {
  periodo: ClaveDePeriodo;
  coherenciaConSales: CoherenciaConSales;
  frescura: { contactos: Frescura; citas: Frescura };
  /** Los huecos de la venta, de Sales. **Lista vacía ⟹ no se dibujan.** */
  huecos: { medidoEl: string; lista: readonly HuecoDeSales[] };
}

export type ResultadoDeLeadsPortal =
  | { tipo: 'datos'; pantalla: PantallaDeLeadsPortal }
  | { tipo: 'fallo'; mensaje: string };

export type ResultadoDeLaFicha =
  | { tipo: 'datos'; ficha: FichaDelLead }
  /** 404: no existe o no es de esta empresa. Son indistinguibles a propósito. */
  | { tipo: 'no_esta' }
  | { tipo: 'fallo'; mensaje: string };

export async function leerLeadsPortal(periodo: ClaveDePeriodo): Promise<ResultadoDeLeadsPortal> {
  /* El período es OBLIGATORIO acá aunque el servidor tenga uno por omisión: con un argumento
     opcional, una llamada que se olvide de pasarlo pide treinta días y enciende el botón que diga el
     estado local, y los dos se ven bien sin coincidir. */
  const r = await pedir<PantallaDeLeadsPortal>(`${RUTA}?periodo=${encodeURIComponent(periodo)}`);
  if (r.tipo === 'datos') return { tipo: 'datos', pantalla: r.datos };
  /* «El servidor dijo que no» y «no se pudo llegar» mandan a mirar dos cosas distintas. */
  if (r.tipo === 'rechazado') {
    return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo leer la lista de leads.' };
  }
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para leer la lista de leads.' };
}

export async function leerLeadDelPortal(id: string): Promise<ResultadoDeLaFicha> {
  const r = await pedir<{ ficha: FichaDelLead }>(`${RUTA}/${encodeURIComponent(id)}`);
  if (r.tipo === 'datos') return { tipo: 'datos', ficha: r.datos.ficha };
  if (r.tipo === 'rechazado' && r.estado === 404) return { tipo: 'no_esta' };
  if (r.tipo === 'rechazado') {
    return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo leer la ficha.' };
  }
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para leer la ficha.' };
}
