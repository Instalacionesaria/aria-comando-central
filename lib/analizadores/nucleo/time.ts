// ── NÚCLEO PORTADO DE ARIA BRAIN · los identificadores siguen en inglés a propósito ──
// Son el contrato con el modelo (los nombres de campo del esquema van en el prompt) y con el JSON
// guardado en el historial copiado: traducirlos cambiaría los prompts. Ver docs/ANALIZADORES.md.
// Origen: aria-ia-brain lib/analyzer/time.ts, copiado byte a byte. Única edición: `.ts` en los imports.
//
// Puerto de platform2/src/lib/time.ts — formatea segundos a HH:MM:SS.
export function formatSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => n.toString().padStart(2, '0')).join(':');
}
