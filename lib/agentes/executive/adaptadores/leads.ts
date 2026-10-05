// La herramienta de Leads › De GHL del cerebro: la cohorte del Leads Portal, con la misma función y la
// misma ventana que `app/api/leads-portal/route.ts`.
//
// Cada fila lleva exactamente las claves de `CLAVES_DE_LA_FILA` (`lib/negocio/leadsDelPortal.ts`), que ya
// excluyen teléfono y correo. El nombre viaja porque la fila se lee por él; en el hilo guardado no queda
// (`../conversaciones.ts` guarda la evidencia sin nombres).

import { CLAVES_DE_LA_FILA, leadsDelPortal } from '../../../negocio/leadsDelPortal.ts';
import { ARGUMENTO_PERIODO, type DefinicionDeHerramienta, periodoPedido, primeras, tomar } from './comun.ts';

const CLAVES_DEL_TRAMO = [
  'clave', 'rotulo', 'contactos', 'porcion', 'agendados', 'asistieron', 'vendidos', 'cierre', 'porQueSinCierre',
  'montoReportado', 'porQueSinMonto', 'ventasSinMonto', 'sinRegistrar', 'soloCongeladas',
] as const;

export const HERRAMIENTAS_DE_LEADS: readonly DefinicionDeHerramienta[] = [
  {
    nombre: 'cohorte_de_leads',
    descripcion:
      'Leads › De GHL: los contactos que entraron en la ventana, por tramo de ICP (alto, medio, bajo, sin calificar), ' +
      'con agendados, asistencia, ventas reportadas y monto; y las primeras filas de la cohorte.',
    secciones: ['contacts'],
    esquema: ARGUMENTO_PERIODO,
    async ejecutar(argumentos) {
      const r = await leadsDelPortal(periodoPedido(argumentos)!.dias);
      const leads = primeras(r.leads);
      return {
        ...tomar(r, ['dias', 'cohorte', 'sinCalificar', 'hayVentasRegistradas', 'piso', 'truncado', 'aviso'] as const),
        tramos: r.tramos.map((t) => tomar(t, CLAVES_DEL_TRAMO)),
        todos: tomar(r.todos, CLAVES_DEL_TRAMO),
        leads: { filas: leads.filas.map((l) => tomar(l, CLAVES_DE_LA_FILA)), total: leads.total },
      };
    },
  },
];
