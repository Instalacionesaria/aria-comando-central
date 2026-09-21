// Qué POBLACIÓN mide cada ventana de la pantalla de Sales.
//
// ═══════════════════════════════════════════════════════════════════════════════
// SON TRES, Y DOS DE ELLAS DICEN LO MISMO DESCRIBIENDO COSAS DISTINTAS
//
// El plan de esta pantalla preveía dos ventanas: el mes calendario del dinero contra la ventana
// rodante del selector. **Al construirla aparecieron tres**, y la peligrosa es la diferencia entre
// la segunda y la tercera, porque las dos se dibujan bajo el mismo botón de «30 días»:
//
//   1 · MES CALENDARIO en la zona de la empresa — el dinero. El selector NO lo gobierna.
//   2 · CONTACTOS dados de alta en los últimos N días — la cadena y el ciclo. Son cohortes: se
//       pregunta por gente que ENTRÓ y hasta dónde llegó.
//   3 · CITAS que OCURRIERON en los últimos N días — la cancelación y la tabla por closer. Se
//       pregunta por reuniones que pasaron, sin importar cuándo entró la persona.
//
// Con la 2 y la 3 confundidas, la tabla por closer no cuadra contra la cadena y **nada falla**: las
// dos consultas están bien escritas y hablan de dos grupos de gente.
//
// ── POR QUÉ ESTE ARCHIVO EXISTE EN VEZ DE VIVIR EN LA RUTA ──────────────────
//
// Porque lo necesitan los dos lados. La ruta lo manda en la respuesta —el panel es `'use client'` y
// no puede importar nada del servidor— y `vistaDeSales.ts` lo necesita para el TIPO de lo que
// recibe. Declarado en la ruta, `lib/` tendría que importar de `app/` y la dependencia apuntaría
// hacia arriba.
//
// ── Y LOS TEXTOS NO ESCRIBEN LOS DÍAS ───────────────────────────────────────
//
// Los días ya viajan en el campo `dias` de cada bloque. Repetirlos en la prosa sería un segundo
// lugar donde pueden dejar de coincidir, y el que la gente lee es la prosa. Hay una prueba que lo
// exige.
// ═══════════════════════════════════════════════════════════════════════════════

/** Una ventana, como la pantalla la nombra y la explica. */
export interface VentanaDeSales {
  titulo: string;
  que: string;
}

export const VENTANAS = {
  mes: {
    titulo: 'Este mes',
    que: 'El mes del calendario en la zona horaria de la empresa. El selector de período no lo cambia: es la misma ventana con la que se calcula la comisión, y moverla haría que Sales y la pantalla del Closer publiquen dos ingresos distintos.',
  },
  cohorte: {
    titulo: 'Quiénes entraron',
    que: 'Las personas dadas de alta en el CRM dentro del período, y hasta dónde llegaron. Una persona que entró antes no cuenta, aunque su cita haya sido ayer.',
  },
  citas: {
    titulo: 'Qué reuniones hubo',
    que: 'Las citas que ocurrieron dentro del período, sin importar cuándo entró la persona. Una cita futura no entra: su cancelación todavía no es un hecho.',
  },
} as const satisfies Record<string, VentanaDeSales>;

export type ClaveDeVentana = keyof typeof VENTANAS;
