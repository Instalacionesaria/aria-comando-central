// Cómo se llaman las cinco fases de un análisis HT en pantalla, y cuándo hay que adivinarlo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ HACE FALTA UNA FUNCIÓN Y NO UN MAPA
//
// Los análisis v8 del historial copiado de ARIA Brain dicen `apertura_rapport` en las cinco fases: el
// origen comparaba en mayúsculas contra una lista en minúsculas (`nucleo/ht.ts`, `asPhase`). Rotular
// por el campo ahí mostraría «Apertura» cinco veces.
//
// Y rotular SIEMPRE por posición tampoco es cierto: el esquema no obliga a devolver las fases en orden
// —la rúbrica las enumera del 1 al 5, y nada más— y, medido el 2026-09-23, 3 de las 37 HT de
// producción no tienen exactamente cinco. Así que:
//
//   · fases distintas (v8.1 en adelante) → por el campo, que ya viene bien;
//   · cinco y todas iguales (el defecto v8) → por posición, con una nota que lo dice;
//   · cualquier otra cosa → «Fase N», porque no hay forma honesta de saber cuál es cuál.
//
// Vive acá y no en el componente para poder probarla: Node no importa JSX.
// ═══════════════════════════════════════════════════════════════════════════════

export const FASES = [
  'Apertura y conexión',
  'Descubrimiento',
  'Presentación de la oferta',
  'Manejo de objeciones',
  'Cierre',
] as const;

const NOMBRE_DE_LA_FASE: Readonly<Record<string, string>> = {
  apertura_rapport: FASES[0],
  descubrimiento: FASES[1],
  presentacion_oferta: FASES[2],
  manejo_objeciones: FASES[3],
  cierre: FASES[4],
};

export function rotulosDeLasFases(fases: readonly { phase?: unknown }[]): { rotulos: string[]; nota: string | null } {
  const campos = fases.map((f) => String(f.phase ?? ''));
  if (new Set(campos).size === campos.length) {
    return { rotulos: campos.map((c, i) => NOMBRE_DE_LA_FASE[c] ?? `Fase ${i + 1}`), nota: null };
  }
  if (fases.length === FASES.length) {
    return {
      rotulos: [...FASES],
      nota: 'Análisis v8: las fases se rotulan por su posición, porque ese análisis las guardó a todas como «apertura».',
    };
  }
  return {
    rotulos: fases.map((_, i) => `Fase ${i + 1}`),
    nota: 'Este análisis v8 no permite saber qué fase es cada una: se guardaron todas como «apertura».',
  };
}
