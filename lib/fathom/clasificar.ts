// ¿ES UNA LLAMADA DE VENTA? · por el título, y sólo por el título (decisión del usuario, 2026-11-13).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA
//
// Las llamadas de venta se titulan con «HT» antes del nombre del lead: «HT_Juan Pérez - ARIA». El resto de las sesiones
// (onboarding, coaching, internas) todavía no tiene nombre fijo, y no importa: sólo se guarda la venta.
//
// Se mira primero el TÍTULO DEL CALENDARIO (`meeting_title`) y después el de la grabación (`title`). El de la grabación
// se puede editar en Fathom, y editarlo no vuelve a disparar el webhook; el del calendario es el que puso GHL al agendar.
//
// «Empieza con HT» quiere decir: después de cualquier puntuación, símbolo, emoji o carácter invisible del comienzo, las
// letras H y T, y a continuación algo que NO sea letra ni número (o el final). Así:
//
//   · venta:    «HT_Juan - ARIA», «HT Juan», «ht - Juan», «HT–Juan» (raya), «[HT] Juan», «🔥 HT_Juan», «ＨＴ Juan»;
//   · no venta: «HTML…», «HT2», «HTJuan», «WhatsApp», «Onboarding HT», «Llamada HT_Juan».
//
// La normalización es NFKD (que lleva «ＨＴ» de ancho completo a «HT»), sin marcas diacríticas y en mayúsculas.
// ═══════════════════════════════════════════════════════════════════════════════

const EMPIEZA_CON_HT = /^[\s\p{P}\p{S}\p{Cf}]*HT(?![\p{L}\p{N}])/u;

/** El título sin tildes, en mayúsculas y con los caracteres de ancho completo llevados a los comunes. */
export function normalizarTitulo(titulo: string): string {
  return titulo.normalize('NFKD').replace(/\p{M}/gu, '').toUpperCase();
}

/** ¿Este título, solo, es de una llamada de venta? */
export function tituloDeVenta(titulo: string | null | undefined): boolean {
  if (typeof titulo !== 'string' || titulo.trim() === '') return false;
  return EMPIEZA_CON_HT.test(normalizarTitulo(titulo));
}

export type CualTitulo = 'calendario' | 'grabacion';

export interface Clasificacion {
  esVenta: boolean;
  /** Cuál de los dos títulos lo decidió. `null` si ninguno era de venta. */
  porTitulo: CualTitulo | null;
}

/** La llamada es de venta si el título del calendario lo es; si no, si lo es el de la grabación. */
export function esVentaPorTitulo(tituloDelCalendario: string | null | undefined, tituloDeLaGrabacion: string | null | undefined): Clasificacion {
  if (tituloDeVenta(tituloDelCalendario)) return { esVenta: true, porTitulo: 'calendario' };
  if (tituloDeVenta(tituloDeLaGrabacion)) return { esVenta: true, porTitulo: 'grabacion' };
  return { esVenta: false, porTitulo: null };
}
