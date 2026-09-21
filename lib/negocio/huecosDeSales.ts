// Lo que la pantalla de Sales NO puede medir, dicho con su medición y su fecha.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ACÁ EL HUECO ES EL HECHO CENTRAL DEL DEPARTAMENTO, NO UNA NOTA AL PIE
//
// En Creative y en Conversion los huecos son cosas de los bordes: el mapa de calor, la retención del
// VSL. **En Sales el hueco es la venta**, que es lo único que el documento le pide al departamento.
//
// Y no es que falte maquinaria. Medido el 2026-09-21: `negocio.resultados` tiene **7 filas en toda
// la base** —`seguimiento` 4, `no_show` 2, `no_interesa` 1— con **cero ventas, cero montos y cero
// `cita_id`**. El catálogo tiene seis salidas y dos piden monto (`salidas.ts:84,96`), el escritor
// funciona y está probado, y la columna existe con `numeric(12,2)`. **No falta nada técnico: falta
// que alguien registre.**
//
// ── POR QUÉ ESTO VIAJA Y NO ESTÁ ESCRITO EN EL PANEL ───────────────────────
//
// Es la regla de `calidadDeLaAtribucion.ts:69`: los huecos *«viajan para que nadie los rehaga»*.
// Escritos en el JSX serían literales en el navegador, que es justo lo que esta pantalla vino a
// borrar — tenía 23.
//
// Y hay un motivo propio de Sales: **la maqueta que se va dibujaba estas cosas con números
// inventados.** «Revenue reportado $55.200», «Tasa de cierre 24 %», «Ventas 18» y cuatro motivos de
// pérdida. Quien conozca esa pantalla los va a buscar, y si no están ni se dice por qué, la lectura
// razonable es que se rompió.
//
// ── LO QUE NO ESTÁ ACÁ, A PROPÓSITO ────────────────────────────────────────
//
// La asistencia **no** es un hueco entero: `citas.asistio` está nulo en las 327, pero el calendario
// marca 15 plantones y eso se publica como conteo en la tabla por closer. Un hueco que dijera «no
// hay dato de asistencia» sería más fácil de escribir y contradiría la columna de al lado.
// ═══════════════════════════════════════════════════════════════════════════════

/** Una cosa que la pantalla no puede decir, y por qué. */
export interface HuecoDeSales {
  punto: string;
  porque: string;
}

/**
 * La fecha de la medición, que viaja con la lista.
 *
 * Sin ella, «no hay ventas registradas» se lee como un hecho permanente del producto y no como el
 * estado de un día. Es la corrección que Creative tuvo que hacer cuando sus cifras de encabezado
 * quedaron vencidas el mismo día.
 */
export const MEDIDO_EL = '21 de septiembre de 2026';

export const HUECOS: readonly HuecoDeSales[] = [
  {
    punto: 'La venta',
    porque:
      'No hay ninguna venta registrada en toda la base: los 7 resultados que existen son 4 de ' +
      'seguimiento, 2 de no-show y 1 de no interesa. No es que la pantalla no sepa sumarlas — es que ' +
      'no hay ninguna que sumar. La maquinaria está entera: el catálogo tiene la salida, el ' +
      'formulario pide el monto y la columna existe',
  },
  {
    punto: 'El revenue y la tasa de cierre',
    porque:
      'Salen de los montos de las ventas, y hay cero montos cargados. Un «$0» acá afirmaría que no ' +
      'se vendió nada, que es distinto de que nadie lo haya registrado',
  },
  {
    punto: 'El pago verificado',
    porque:
      'No hay ninguna integración de pagos: la credencial existe en 0 de 5 organizaciones y nadie ' +
      'la consume salvo el formulario que la guarda. Lo único que este sistema puede publicar es la ' +
      'venta REPORTADA POR EL CLOSER, y por eso el bloque de dinero lo dice al lado de la cifra',
  },
  {
    punto: 'Los motivos de pérdida',
    porque:
      'El catálogo real de «no interesa» es Precio · No es el momento · Competencia · No califica · ' +
      'Otro, y en toda la base hay 1 sola fila, con el detalle «Otro». La maqueta dibujaba otros ' +
      'cuatro motivos y uno de ellos —«Pidió tiempo»— ni siquiera es de esa salida: es de nurture, ' +
      'así que el gráfico mezclaba dos salidas en una torta',
  },
  {
    punto: 'La atribución de la cita al resultado',
    porque:
      'Ninguno de los 7 resultados tiene la cita enganchada, y 5 de ellos SÍ tenían una cita ' +
      'ofrecible cuando se guardaron. Sin ese vínculo no hay denominador para un show rate: un ' +
      'resultado es un intento del closer, que no es el conjunto de las citas',
  },
];
