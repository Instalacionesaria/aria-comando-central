// Cómo se nombran en pantalla los estados de una llamada y los valores del informe OB.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ VIVE ACÁ Y NO EN LOS COMPONENTES
//
// Por lo mismo que `fases.ts`: Node no importa JSX, y estas reglas se pueden equivocar sin que nada
// falle. Un valor del esquema sin rótulo se dibuja como la clave en mayúsculas del modelo
// («SUBCUENTA_ARIA»); un momento clave fuera de orden cuenta la llamada salteada; un vacío que no se
// reconoce como vacío deja un título sin nada debajo.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * El rótulo del estado de una llamada. Una reunión que el análisis vetó **no desaparece**: queda en
 * Descartadas de su pestaña diciendo qué NO es. Decidido el 2026-09-23: antes decía «No corresponde»
 * para todas, y no se leía de qué pestaña se había caído.
 */
export function rotuloDelEstado(estado: string, tipo: string): string {
  if (estado === 'NOT_MATCH') return tipo === 'HT' ? 'No es HT' : tipo === 'OB' ? 'No es OB' : 'No es HT ni OB';
  return (
    ({ PENDING: 'Pendiente', ANALYZING: 'Analizando', DONE: 'Analizada', FAILED: 'Falló' } as Record<string, string>)[estado] ??
    estado
  );
}

/**
 * Lo mismo, para ir DENTRO de una frase («Por qué no es HT: …»). No sale de `rotuloDelEstado` con
 * `.toLowerCase()`: eso baja también las siglas, y la pantalla decía «no es ht ni ob».
 */
export function fraseDelVeto(tipo: string): string {
  return tipo === 'HT' ? 'no es HT' : tipo === 'OB' ? 'no es OB' : 'no es HT ni OB';
}

/**
 * Los valores de los campos-enumeración del informe OB, con el nombre de su propiedad en el esquema
 * (`OB_DEF.jsonSchema`). Una prueba recorre el esquema y exige un rótulo para cada valor.
 *
 * Ninguno dice «no se habló»: el esquema OB no tiene un valor DESCONOCIDO y `normalizeOb` pone uno por
 * omisión (PARCIAL, MEDIO, NINGUNA, NO…). Así que un «No» en Slack puede ser «no se tocó el tema».
 * Arreglarlo es cambiar la rúbrica, y se decidió que no (docs/ANALIZADORES.md § «OB-1»).
 */
export const ROTULOS_OB: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  readiness: { LISTO: 'Listo', PARCIAL: 'Parcial', BLOQUEADO: 'Bloqueado' },
  commitmentLevel: { ALTO: 'Alto', MEDIO: 'Medio', BAJO: 'Bajo' },
  agencyExperience: { NINGUNA: 'Ninguna', ALGUNA: 'Alguna', EXPERIMENTADO: 'Con experiencia' },
  adsExperience: { NINGUNA: 'Ninguna', ALGUNA: 'Alguna', EXPERIMENTADO: 'Con experiencia' },
  goHighLevelLevel: { NINGUNO: 'Ninguno', BASICO: 'Básico', INTERMEDIO: 'Intermedio', AVANZADO: 'Avanzado' },
  slack: { OK: 'Listo', PENDIENTE: 'Pendiente', NO: 'No' },
  school: { OK: 'Listo', PENDIENTE: 'Pendiente', NO: 'No' },
  goHighLevel: {
    PROPIA: 'Cuenta propia',
    AFILIADO: 'Con enlace de afiliado',
    TRIAL: 'En prueba',
    SUBCUENTA_ARIA: 'Subcuenta de ARIA',
    NINGUNA: 'Ninguna',
  },
  owner: { CLIENTE: 'Cliente', ARIA: 'ARIA', AMBOS: 'Ambos' },
};

/** El rótulo de un valor OB; si el modelo mandó algo fuera del esquema, el valor tal cual. */
export function rotuloOb(campo: string, valor: unknown): string {
  const v = String(valor ?? '');
  return ROTULOS_OB[campo]?.[v] ?? v;
}

/**
 * ¿Hay algo que mostrar? `normalizeOb` deja un vacío de tres formas —`''`, `null` y `[]`— según el
 * campo, y la pantalla tiene que tratarlas igual: con «No consta», nunca con un título solo.
 */
export function consta(valor: unknown): boolean {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === 'string') return valor.trim().length > 0;
  if (Array.isArray(valor)) return valor.length > 0;
  return true;
}

/**
 * Los momentos clave en el orden de la llamada. Medido en las 7 OB copiadas de Brain: en 4 no vienen
 * ordenados por `startSec`, y la lista contaba la llamada salteada. Copia; no toca el arreglo guardado.
 */
export function momentosEnOrden<T extends { startSec?: unknown }>(momentos: readonly T[] | null | undefined): T[] {
  return [...(momentos ?? [])].sort((a, b) => Number(a.startSec ?? 0) - Number(b.startSec ?? 0));
}
