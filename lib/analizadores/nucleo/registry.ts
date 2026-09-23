// ── NÚCLEO PORTADO DE ARIA BRAIN · los identificadores siguen en inglés a propósito ──
// Son el contrato con el modelo (los nombres de campo del esquema van en el prompt) y con el JSON
// guardado en el historial copiado: traducirlos cambiaría los prompts. Ver docs/ANALIZADORES.md.
// Origen: aria-ia-brain lib/analyzer/registry.ts, copiado byte a byte. Única edición: `.ts` en los imports.
//
// Registro de analizadores por tipo. Fase 1: solo OB. Fase 2 agrega HT aquí
// (importar HT_DEF y sumarlo) — el clasificador y el engine se adaptan solos.
import type { TipoLlamada } from './types.ts';
import type { AnalyzerDef } from './defs.ts';
import { OB_DEF } from './ob.ts';
import { HT_DEF } from './ht.ts';

export const ANALYZERS: Partial<Record<TipoLlamada, AnalyzerDef>> = {
  OB: OB_DEF,
  HT: HT_DEF,
};

export function getAnalyzer(tipo: string): AnalyzerDef | null {
  return (ANALYZERS as Record<string, AnalyzerDef | undefined>)[tipo] ?? null;
}

export function enabledAnalyzers(): AnalyzerDef[] {
  return Object.values(ANALYZERS).filter(Boolean) as AnalyzerDef[];
}
