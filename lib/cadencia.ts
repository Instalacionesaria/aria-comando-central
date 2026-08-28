// Las cadencias oficiales del navegador. Un solo lugar, y **isomorfo a propósito**.
//
// ════════════════════════════════════════════════════════════════════════════
// POR QUÉ NO VIVEN EN `lib/reloj.ts`, QUE ES QUIEN LAS USA
//
// Porque el SERVIDOR también necesita el número, y `lib/reloj.ts` lleva `'use client'`: importarlo
// desde `lib/negocio/pulso.ts` mete un módulo de cliente en el paquete del servidor.
//
// Y el servidor lo necesita por una razón concreta, no por simetría. El antirrebete del candado
// —`ANTIRREBOTE_MS` en `pulso.ts`— **solo tiene sentido en relación con esta cadencia**, y cuando
// eran dos números escritos a mano en dos archivos ya habían quedado desalineados: la ventana era de
// 8 segundos contra un ciclo de 10, así que dos pestañas desfasadas más de 8 segundos producían DOS
// corridas por ciclo en vez de una. Medido: el techo subía de 360 a 450 llamadas por hora.
//
// Con la relación declarada, mover la perilla de la cadencia mueve la ventana con ella.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Las cadencias oficiales, en un solo lugar para que nadie invente la suya.
 *
 * Que el chat sea de 5 segundos **no es el límite de llamadas al CRM**: el candado del servidor
 * garantiza que la ingesta corra como mucho una vez por ciclo sin importar cuántas pestañas ni con
 * qué frecuencia pregunten. Esta perilla se puede mover sin tocar el presupuesto del proveedor.
 */
export const CADENCIA = {
  /** El chat con la ficha abierta. Lee de la caché: **cero llamadas al proveedor**. */
  chat: 5_000,
  /**
   * EL tic de la operación: dispara la ingesta y recarga las colas.
   *
   * Que sean 10 segundos **no es el límite de llamadas al CRM**. El candado de
   * `lib/negocio/pulso.ts` garantiza que la ingesta corra como mucho una vez por ciclo sin importar
   * cuántas pestañas ni con qué frecuencia pidan, y medido contra la cuenta real un ciclo en
   * régimen cuesta **una** llamada. Esta perilla se puede mover sin tocar ese presupuesto.
   *
   * Y solo corre con el Closer A LA VISTA — ver `components/views/CloserView.jsx`. Antes corría para
   * cualquiera que tuviera la sección en su menú: 360 llamadas por hora y por empresa sin que nadie
   * abriera la pestaña.
   */
  operacion: 10_000,
} as const;
