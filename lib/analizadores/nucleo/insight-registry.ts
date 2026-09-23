// ── NÚCLEO PORTADO DE ARIA BRAIN · los identificadores siguen en inglés a propósito ──
// Son el contrato con el modelo (los nombres de campo del esquema van en el prompt) y con el JSON
// guardado en el historial copiado: traducirlos cambiaría los prompts. Ver docs/ANALIZADORES.md.
// Origen: aria-ia-brain lib/analyzer/insight-registry.ts, copiado byte a byte. Única edición: `.ts` en los imports.
//
// Registro de análisis DERIVADOS (insights), SEPARADO de ANALYZERS a propósito.
//
// Invariante:
//   ANALYZERS (registry.ts) = tipos de LLAMADA. Alimenta el clasificador Haiku y
//     valida el `tipo` de las rutas. Añadir algo ahí lo vuelve una opción de
//     clasificación.
//   INSIGHTS (este archivo) = análisis derivados sobre una llamada ya clasificada
//     y analizada. NUNCA se clasifica nada como esto.
import type { InsightKind, TipoLlamada } from './types.ts';
import type { InsightDef } from './defs.ts';
import { PROSPECT_CARD_DEF } from './prospect-card.ts';

export const INSIGHTS: Record<InsightKind, InsightDef> = {
  PROSPECT_CARD: PROSPECT_CARD_DEF,
};

export function getInsightDef(kind: string): InsightDef | null {
  return (INSIGHTS as Record<string, InsightDef | undefined>)[kind] ?? null;
}

// Análisis derivados que corresponden a un tipo de llamada. HT → [ficha]; OB → [].
export function insightsFor(tipo: TipoLlamada): InsightDef[] {
  return Object.values(INSIGHTS).filter((d) => d.appliesTo === tipo);
}
