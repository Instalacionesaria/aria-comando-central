// ¿ES UNA LLAMADA DE VENTA? · por el título, y sólo por el título.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA (decisión del usuario del 2026-11-24; reemplaza la del «HT» al comienzo, del 2026-11-13)
//
// GHL titula las citas con plantillas fijas:
//
//   · la llamada de venta (HT):  «{{contact.name}} - ARIA»                   → «Juan Pérez - ARIA»;
//   · el onboarding (OB):         «Fase 0: Onboarding Quantum - {{contact.name}}»;
//   · cualquier otra (internas, coaching…), sin plantilla.
//
// Sólo la primera es venta. Todo lo demás se ignora (queda `no_es_venta`, sin transcripción).
//
// «Es la plantilla de venta» quiere decir: el título TERMINA en un guion (o raya) seguido de «ARIA», con o sin espacios
// alrededor del guion, y antes hay un nombre (al menos una letra). Además, por las dudas, nada que diga «Onboarding» es
// venta, aunque termine en «- ARIA». Así:
//
//   · venta:    «Juan Pérez - ARIA», «juan pérez - aria», «Juan–ARIA» (raya), «María José Díaz - ARIA »;
//   · no venta: «Fase 0: Onboarding Quantum - Juan», «Onboarding - ARIA», «- ARIA», «Juan - MARIA», «ARIA - Juan»,
//               «Reunión ARIA», «Juan - ARIA IA», «HT_Juan» (la regla vieja ya no vale).
//
// Se mira primero el TÍTULO DEL CALENDARIO (`meeting_title`, el que puso GHL al agendar) y después el de la grabación
// (`title`), que se puede editar en Fathom sin que el webhook se vuelva a disparar.
//
// La normalización es NFKD (lleva los caracteres de ancho completo a los comunes), sin marcas diacríticas y en mayúsculas.
// ═══════════════════════════════════════════════════════════════════════════════

/** «<algo con una letra> - ARIA» al final: guion, guion corto o raya, con espacios opcionales; nada después salvo blancos. */
const PLANTILLA_DE_VENTA = /^(.*\p{L}.*?)\s*[-‐-―−]\s*ARIA[\s\p{Cf}]*$/u;

/** La plantilla del onboarding («Fase 0: Onboarding Quantum - …») y cualquier otra que lo nombre. */
const ES_ONBOARDING = /ONBOARDING/u;

/** El título sin tildes, en mayúsculas y con los caracteres de ancho completo llevados a los comunes. */
export function normalizarTitulo(titulo: string): string {
  return titulo.normalize('NFKD').replace(/\p{M}/gu, '').toUpperCase();
}

/** ¿Este título, solo, es de una llamada de venta («{{contact.name}} - ARIA»)? */
export function tituloDeVenta(titulo: string | null | undefined): boolean {
  if (typeof titulo !== 'string' || titulo.trim() === '') return false;
  const t = normalizarTitulo(titulo);
  if (ES_ONBOARDING.test(t)) return false;
  return PLANTILLA_DE_VENTA.test(t);
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
