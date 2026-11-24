// Las secciones que pide la plantilla provisoria del Research (la 125), para las pruebas que sólo necesitan un research
// guardado. El orden es el de la plantilla.

export const SECCIONES_DEL_RESEARCH = [
  'resumen', 'a_quien', 'dolores', 'quien_lo_resuelve', 'precio', 'segmentos', 'conclusiones', 'fuentes',
] as const;

/** Un research completo: cada sección con un párrafo; `resumen` con el html que se pida (la marca de la prueba). */
export function unResearchCompleto(resumen: string): { id: string; html: string }[] {
  return SECCIONES_DEL_RESEARCH.map((id) => ({ id, html: id === 'resumen' ? resumen : `<p>${id}</p>` }));
}
