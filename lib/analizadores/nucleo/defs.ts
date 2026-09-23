// ── NÚCLEO PORTADO DE ARIA BRAIN · los identificadores siguen en inglés a propósito ──
// Son el contrato con el modelo (los nombres de campo del esquema van en el prompt) y con el JSON
// guardado en el historial copiado: traducirlos cambiaría los prompts. Ver docs/ANALIZADORES.md.
// Origen: aria-ia-brain lib/analyzer/defs.ts, copiado byte a byte. Única edición: `.ts` en los imports.
//
// Contrato común de un "analizador" (OB/HT) + coercers para normalizar la salida
// del modelo sin zod (el brain no lo tiene). Cada tipo (ob.ts, ht.ts) exporta un
// AnalyzerDef; el registry los junta y el engine los ejecuta.
import type { InsightKind, TipoLlamada } from './types.ts';

export interface ListColumns {
  score?: number | null;
  outcome?: string | null;
  scoreColor?: string | null;
  readiness?: string | null;
  summary?: string | null;
}

export interface AnalyzerDef {
  tipo: TipoLlamada;
  rubricVersion: string;
  // Etiqueta corta para UI/clasificador (ej. "onboarding").
  label: string;
  // "una llamada de ONBOARDING de ARIA: la llamada de arranque tras la compra…"
  isDescription: string;
  // ejemplos de lo que NO es (para el segundo gate y el clasificador).
  isNotExamples: string;
  rubric: string; // rúbrica completa (system prompt base)
  jsonSchema: unknown; // objeto JSON Schema con los nombres de campo exactos
  normalize(obj: Record<string, unknown>): unknown; // rellena defaults
  listColumns(analysis: unknown): ListColumns; // columnas derivadas para el listado
}

// ── análisis DERIVADOS (insights) ──────────────────────────────────────────
// Corren DESPUÉS de un análisis principal ya emparejado, sobre la misma
// transcripción, para extraer otra cosa (hoy: la ficha del prospecto de HT).
// Viven en un registro APARTE de ANALYZERS a propósito: estar en ANALYZERS
// significa "ser un tipo de llamada" y alimenta al clasificador Haiku, que no
// debe conocerlos.
export interface InsightColumns {
  intent?: string | null;
  decisionMaker?: string | null;
  riskCount?: number | null;
  headline?: string | null;
}

export interface InsightDef {
  kind: InsightKind;
  appliesTo: TipoLlamada; // tipo de llamada al que se le genera
  rubricVersion: string;
  label: string;
  rubric: string;
  jsonSchema: unknown;
  normalize(obj: Record<string, unknown>): unknown;
  listColumns(insight: unknown): InsightColumns;
}

// Igual que buildAnalyzerSystem PERO SIN el bloque "PRIMER PASO" (gate
// match:false): la llamada ya pasó las dos compuertas (clasificador Haiku +
// gate del análisis principal). Un tercer gate solo produce falsos negativos.
export function buildInsightSystem(def: InsightDef): string {
  return `${def.rubric}

# CONTRATO DE SALIDA — OBLIGATORIO
Devuelve ÚNICAMENTE un objeto JSON que valide EXACTAMENTE contra este JSON Schema.
Usa los nombres de campo EXACTOS (no inventes, no renombres, no añadas campos extra).
Incluye TODOS los campos requeridos.
No añadas texto, comentarios ni vallas markdown alrededor del JSON.

JSON Schema:
${JSON.stringify(def.jsonSchema, null, 2)}`;
}

// system = rúbrica + PRIMER PASO (gate) + contrato de salida con el JSON Schema.
// Compatible con thinking (no usa tool_use). El gate usa {"match": false}.
export function buildAnalyzerSystem(def: AnalyzerDef): string {
  return `${def.rubric}

# PRIMER PASO — ¿ES ${def.isDescription}?
Antes de extraer o analizar nada, decide si esta transcripción es realmente ${def.isDescription}.
NO lo es (aunque hable de negocios o de ARIA): ${def.isNotExamples}, o texto que no es una transcripción real de una llamada.
Si NO lo es, devuelve ÚNICAMENTE este JSON y NADA más (no inventes ningún análisis):
{"match": false, "reason": "una frase breve explicando qué es en realidad"}

# CONTRATO DE SALIDA (solo si SÍ lo es) — OBLIGATORIO
Devuelve ÚNICAMENTE un objeto JSON que valide EXACTAMENTE contra este JSON Schema.
Usa los nombres de campo EXACTOS (no inventes, no renombres, no añadas campos extra).
Incluye TODOS los campos requeridos.
No añadas texto, comentarios ni vallas markdown alrededor del JSON.

JSON Schema:
${JSON.stringify(def.jsonSchema, null, 2)}`;
}

// ── coercers ────────────────────────────────────────────────────────────────
export function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : v == null ? fallback : String(v);
}
export function asStrOrNull(v: unknown): string | null {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.trim() ? s : null;
}
export function asArrStr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x : String(x))).filter((s) => s && s.trim());
}
export function asBool(v: unknown): boolean {
  return v === true || v === 'true';
}
export function asNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
export function asEnum(v: unknown, allowed: string[], fallback: string): string {
  const s = asStr(v).toUpperCase();
  return allowed.includes(s) ? s : fallback;
}
export function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
export function asArrObj(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => x && typeof x === 'object' && !Array.isArray(x)) as Record<string, unknown>[];
}
