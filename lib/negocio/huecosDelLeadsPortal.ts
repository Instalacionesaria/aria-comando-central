// Lo que la ficha de Leads Portal NO puede mostrar, dicho con su medición y su fecha.
//
// ═══════════════════════════════════════════════════════════════════════════════
// CADA HUECO VA DONDE LA MAQUETA DIBUJABA EL DATO
//
// La maqueta llenaba la ficha entera: un porcentaje del VSL, un «Fit score», la ubicación del
// anuncio, el costo del lead, el dispositivo. Para catorce de sus quince personas lo fabricaba con
// aritmética sobre el puntaje. Nada de eso existe en la base, y quien conozca esa pantalla lo va a
// buscar: si el lugar desaparece sin decir por qué, la lectura razonable es que se rompió.
//
// Por eso cada hueco lleva `donde`, la sección de la ficha en la que se dibuja, y viaja con la
// respuesta en vez de estar escrito en el JSX —la regla de `huecosDeSales.ts`: los huecos *«viajan
// para que nadie los rehaga»*—.
//
// ── LO QUE NO ESTÁ ACÁ, A PROPÓSITO ────────────────────────────────────────
//
// **La venta, el cierre y el monto** son huecos de Sales y se consumen de `huecosDeSales.ts`, no se
// reescriben: dos textos del mismo hecho se corrigen por separado. **La asistencia** no es un hueco
// entero: es `sin_registrar` con su número, y el plantón del calendario aparte. Y **el video
// precall** sí tiene dato —una categoría escrita por el CRM—, así que no es hueco: se muestra.
// ═══════════════════════════════════════════════════════════════════════════════

/** La sección de la ficha en la que se dibuja cada hueco. */
export type SeccionDeLaFicha = 'recorrido' | 'vsl' | 'calificacion' | 'publicidad';

/** Una cosa que la ficha no puede decir, y por qué. */
export interface HuecoDelPortal {
  punto: string;
  porque: string;
  donde: SeccionDeLaFicha;
}

/**
 * La fecha de la medición, que viaja con la lista. Sin ella, «no reporta» se lee como un hecho
 * permanente del producto y no como el estado de un día.
 */
export const MEDIDO_EL = '27 de septiembre de 2026';

export const HUECOS: readonly HuecoDelPortal[] = [
  {
    punto: 'El VSL',
    porque:
      'Los dos campos del medidor del video valen 0 en todos los contactos que los tienen y no ' +
      'reportan desde el 30 de agosto de 2026, y no hay ningún historial de reproducción guardado. ' +
      'Un «0 %» acá sería el de un medidor apagado, no el de alguien que no vio el video. Por dónde ' +
      'llegó la persona lo dice «Llegó por»',
    donde: 'vsl',
  },
  {
    punto: 'Fit e intent',
    porque:
      'No existen en ninguna tabla ni en ningún campo del CRM. El único puntaje que hay es el ICP, y ' +
      'lo calcula el CRM, no Comando Central',
    donde: 'calificacion',
  },
  {
    punto: 'Ubicación y posición del anuncio',
    porque:
      'El placement no llega de ningún lado: ni la atribución del CRM ni la sincronización de Meta ' +
      'lo traen',
    donde: 'publicidad',
  },
  {
    punto: 'El costo del lead',
    porque:
      'El gasto se guarda por anuncio y por día. Repartirlo entre las personas que entraron ese día ' +
      'sería un modelo, no un dato',
    donde: 'publicidad',
  },
  {
    punto: 'El dispositivo y la ciudad',
    porque:
      'Sólo saldrían de la IP y del navegador, que están guardados en la atribución y no se muestran: ' +
      'son datos que identifican a la persona',
    donde: 'publicidad',
  },
];
