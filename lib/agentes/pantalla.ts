// Lo que la pantalla del cerebro necesita saber del servidor sin pedírselo: a qué ruta preguntar desde cada
// sección, y cómo se dice cada rechazo (`docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-40 y AG-52).

/** La ruta del chat del Inicio. */
export const RUTA_DEL_INICIO = '/api/executive';

/**
 * La ruta de la caja del pie de cada sección: la carpeta de la API de esa sección más `/cerebro` (AG-40).
 * La clave es la de la sección, que es la `PANTALLA` de la ruta; Conversation, Leads › De GHL e ICP & Oferta
 * viven en carpetas con otro nombre. Una sección que no está acá no tiene caja que pregunte.
 */
export const RUTA_DE_LA_CAJA: Readonly<Record<string, string>> = {
  acquisition: '/api/acquisition/cerebro',
  creative: '/api/creative/cerebro',
  conversion: '/api/conversion/cerebro',
  conversation: '/api/auditoria/cerebro',
  sales: '/api/sales/cerebro',
  contacts: '/api/leads-portal/cerebro',
  setter: '/api/setter/cerebro',
  closer: '/api/closer/cerebro',
  analizadores: '/api/analizadores/cerebro',
  tools: '/api/tools/cerebro',
  icp: '/api/fundaciones/cerebro',
};

/** La ruta de la caja de esa sección, o `null` si no tiene. */
export function rutaDeLaCaja(seccion: string | null): string | null {
  return seccion !== null && Object.hasOwn(RUTA_DE_LA_CAJA, seccion) ? RUTA_DE_LA_CAJA[seccion]! : null;
}

/** El estado del cerebro como lo manda el GET (`lib/agentes/executive/estado.ts`). */
export type EstadoDelCerebro =
  | { tipo: 'listo' }
  | { tipo: 'sin_permiso' }
  | { tipo: 'delegacion' }
  | { tipo: 'sin_datos' }
  | { tipo: 'sin_llave'; puedeCargarla: boolean }
  | { tipo: 'llave_ilegible'; puedeCargarla: boolean }
  | { tipo: 'tope'; tope: number; de: 'persona' | 'empresa'; renuevaEl: string };

/**
 * Qué decirle a la persona cuando el cerebro no está `listo`, o `null` si lo está. La tabla de AG-52: lo que
 * la caja promete es lo que la ruta cumple, porque los dos salen del mismo estado. `ajustes` es el nombre
 * de la sección donde se carga la llave, del dato de la sesión: no se escribe (`pruebas/codigo/102-*`).
 */
export function textoDelEstado(estado: EstadoDelCerebro, zona: string, ajustes: string): string | null {
  switch (estado.tipo) {
    case 'listo':
      return null;
    case 'sin_permiso':
      return 'No tienes acceso al cerebro. Lo concede quien administra la empresa.';
    case 'delegacion':
      return 'Estás mirando otra empresa: el cerebro no responde aquí.';
    case 'sin_datos':
      return 'Con las pestañas que ves no hay datos que el cerebro pueda leer.';
    case 'sin_llave':
      return estado.puedeCargarla
        ? `El cerebro necesita la llave de IA de tu empresa. Se carga en ${ajustes}.`
        : 'El cerebro necesita la llave de IA de tu empresa. Pídesela a quien administra.';
    case 'llave_ilegible':
      return estado.puedeCargarla
        ? `La llave de IA de tu empresa está cargada, pero no se puede leer: hay que volver a cargarla en ${ajustes}.`
        : 'La llave de IA de tu empresa no se puede leer. Pídele a quien administra que la vuelva a cargar.';
    case 'tope': {
      const hora = new Intl.DateTimeFormat('es', { timeZone: zona, hour: '2-digit', minute: '2-digit' }).format(new Date(estado.renuevaEl));
      return estado.de === 'persona'
        ? `Llegaste al tope de hoy (${estado.tope} preguntas). Se renueva a las ${hora}.`
        : `Tu empresa llegó al tope de hoy (${estado.tope} preguntas). Se renueva a las ${hora}.`;
    }
  }
}

/** Si conviene ofrecer el camino a Ajustes: sólo a quien puede cargar la llave. */
export function puedeIrAAjustes(estado: EstadoDelCerebro): boolean {
  return (estado.tipo === 'sin_llave' || estado.tipo === 'llave_ilegible') && estado.puedeCargarla;
}

/**
 * Cómo se dice un rechazo del POST. El detalle del servidor manda cuando lo trae: ya está escrito para la
 * persona (`lib/agentes/executive/caja.ts`). `modelo_no_disponible` trae «situación · ref · técnico», y a la
 * persona le sirven la situación y la referencia, no lo técnico.
 */
export function textoDelRechazo(codigo: string, detalle: string | null | undefined): string {
  if (codigo === 'modelo_no_disponible') {
    const [situacion, ref] = (detalle ?? '').split(' · ');
    const conRef = ref ? ` (${situacion}, ${ref})` : situacion ? ` (${situacion})` : '';
    return `El cerebro no pudo responder ahora${conRef}. Vuelve a intentarlo en un momento.`;
  }
  if (detalle) return detalle;
  switch (codigo) {
    case 'sin_llave_de_ia':
      return 'El cerebro necesita la llave de IA de tu empresa.';
    case 'llave_de_ia_ilegible':
      return 'La llave de IA de tu empresa no se puede leer: hay que volver a cargarla.';
    case 'no_encontrado':
      return 'Esa conversación ya no está.';
    case 'seccion_no_concedida':
      return 'No tienes acceso a esta pestaña.';
    case 'base_no_disponible':
      return 'No se pudo guardar la pregunta ahora. Vuelve a intentarlo en un momento.';
    default:
      return 'El cerebro no pudo responder ahora. Vuelve a intentarlo en un momento.';
  }
}
