// ── NÚCLEO PORTADO DE ARIA BRAIN · los identificadores siguen en inglés a propósito ──
// Son el contrato con el modelo (los nombres de campo del esquema van en el prompt) y con el JSON
// guardado en el historial copiado: traducirlos cambiaría los prompts. Ver docs/ANALIZADORES.md.
// Origen: aria-ia-brain lib/analyzer/score.ts, copiado byte a byte. Única edición: `.ts` en los imports.
//
// Helper puro, seguro para el cliente (no arrastra la rúbrica HT al bundle).
export function deriveScoreColor(score: number): 'VERDE' | 'AMARILLO' | 'ROJO' {
  if (score >= 7) return 'VERDE';
  if (score >= 4) return 'AMARILLO';
  return 'ROJO';
}
