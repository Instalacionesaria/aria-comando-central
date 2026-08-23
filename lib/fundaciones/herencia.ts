// Qué hereda cada herramienta de las anteriores.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTE ARCHIVO ES LA RAZÓN POR LA QUE LAS SIETE VAN JUNTAS
//
// Puerto de `getInheritedSources` / `CHIPS_BY_TOOL` / `CRITICAL_DEPS` del hub. Sin él, las siete
// herramientas serían siete formularios independientes y el método dejaría de ser un método: la
// Oferta se construye SOBRE el avatar y el posicionamiento, y el Mapa hornea desde las cuatro
// fuentes a la vez.
//
// ── LA DIFERENCIA CON EL HUB, Y POR QUÉ ──────────────────────────────────────
//
// En ARIA-brain estas funciones leen variables globales mutables (`lib/legacy/state.ts`), porque el
// original era un `<script>` y el puerto conservó esa forma. Acá reciben el estado como argumento y
// no leen nada de afuera.
//
// No es prolijidad: la construcción del prompt corre en el SERVIDOR, y en el servidor una variable
// global de módulo se comparte entre peticiones de organizaciones distintas. Es la misma forma del
// defecto que `ADR-0703` prohíbe para las credenciales —*"las instancias se reutilizan entre
// peticiones de ORGANIZACIONES DISTINTAS"*—, y acá el valor filtrado sería el avatar y la oferta de
// otro cliente dentro del prompt del primero. Funciones puras hacen ese defecto inexpresable.
//
// ── LO QUE NO ESTÁ EN ESTA ENTREGA ───────────────────────────────────────────
//
// El hub permite EDITAR una fuente heredada solo para una herramienta (los `chipOverrides`, que
// viven en memoria y se pierden al recargar). Acá las fuentes son de solo lectura: se muestran, se
// puede ir a su herramienta y cambiarla ahí. Está anotado en `docs/ETAPA-9.md` como pendiente, no
// como olvido.
// ═══════════════════════════════════════════════════════════════════════════════

import { SIN_ESPECIFICAR } from './campos.ts';
import { ultimaVersion, type EstadoDeFundaciones } from './estado.ts';

/** Las fuentes que una herramienta puede heredar. Las claves son las del hub. */
export type ClaveDeFuente = 'niche' | 'perfil' | 'icp' | 'categoria' | 'oferta' | 'pricing' | 'marketResearch';

export interface Fuente {
  clave: ClaveDeFuente;
  /** Cómo se llama en la interfaz. */
  etiqueta: string;
  /** Una línea que dice QUÉ se heredó, para el indicador. Nunca el documento entero. */
  resumen: string;
  /** El texto que entra al prompt. Vacío cuando no hay nada. */
  completo: string;
  presente: boolean;
  /** A qué herramienta ir para producirla. */
  herramienta: number;
}

/**
 * Todas las fuentes, presentes o no.
 *
 * El nicho sale de los inputs del ICP y no de la ficha, igual que en el hub: es el nicho DEL AVATAR,
 * que puede ser más angosto que el nicho del negocio.
 */
export function fuentes(estado: EstadoDeFundaciones): Record<ClaveDeFuente, Fuente> {
  const inputsIcp = estado.perfil[3];
  const inputsOferta = estado.perfil[4];

  const docPerfil = ultimaVersion(estado, 0);
  const docIcp = ultimaVersion(estado, 3);
  const docOferta = ultimaVersion(estado, 4);
  const docPricing = ultimaVersion(estado, 10);
  const docCategoria = ultimaVersion(estado, 2) ?? estado.categoriaLegado;

  const nicho =
    inputsIcp && inputsIcp['niche'] && inputsIcp['niche'] !== SIN_ESPECIFICAR ? inputsIcp['niche'] : null;

  const nombreOferta =
    inputsOferta && inputsOferta['name'] && inputsOferta['name'] !== SIN_ESPECIFICAR
      ? inputsOferta['name'] +
        (inputsOferta['result'] && inputsOferta['result'] !== SIN_ESPECIFICAR ? ': ' + inputsOferta['result'] : '')
      : null;

  // El segmento ganador es el paso 5, y solo cuenta con los CINCO hechos: es lo que ICP consume.
  const salidas = estado.researchSalidas;
  const segmento = salidas.length >= 5 && salidas[4] ? salidas[4] : null;

  return {
    niche: {
      clave: 'niche',
      etiqueta: 'Nicho',
      resumen: nicho ?? '',
      completo: nicho ?? '',
      presente: !!nicho,
      herramienta: 3,
    },
    perfil: {
      clave: 'perfil',
      etiqueta: 'Tu ficha',
      resumen: 'Perfil de negocio',
      completo: docPerfil ?? '',
      presente: !!docPerfil,
      herramienta: 0,
    },
    marketResearch: {
      clave: 'marketResearch',
      etiqueta: 'Research',
      resumen: 'Segmento ganador',
      completo: segmento ?? '',
      presente: !!segmento,
      herramienta: 1,
    },
    icp: {
      clave: 'icp',
      etiqueta: 'ICP',
      resumen: 'Avatar generado',
      completo: docIcp ?? (inputsIcp ? JSON.stringify(inputsIcp) : ''),
      presente: !!docIcp,
      herramienta: 3,
    },
    categoria: {
      clave: 'categoria',
      etiqueta: 'Categoría',
      resumen: 'Posicionamiento',
      completo: docCategoria ?? '',
      presente: !!docCategoria,
      herramienta: 2,
    },
    oferta: {
      clave: 'oferta',
      etiqueta: 'Oferta',
      resumen: nombreOferta ?? 'Stack de valor',
      completo: docOferta ?? nombreOferta ?? '',
      presente: !!(docOferta || nombreOferta),
      herramienta: 4,
    },
    pricing: {
      clave: 'pricing',
      etiqueta: 'Tu precio',
      resumen: 'Precio y garantía',
      completo: docPricing ?? '',
      presente: !!docPricing,
      herramienta: 10,
    },
  };
}

/**
 * Qué fuentes muestra cada herramienta. Puerto de `CHIPS_BY_TOOL`, recortado a las siete.
 *
 * Tu ficha (0) y Research (1) no heredan nada: son la raíz. Tu precio (10) tampoco muestra
 * indicadores en el hub —hereda por dentro, en su constructor de prompt— y acá se conserva igual
 * para no inventar una diferencia de interfaz que no existe allá.
 */
export const FUENTES_POR_HERRAMIENTA: Readonly<Record<number, readonly ClaveDeFuente[]>> = {
  0: [],
  1: [],
  3: ['marketResearch'],
  2: ['niche', 'icp'],
  4: ['niche', 'icp', 'categoria'],
  10: [],
  26: ['icp', 'categoria', 'oferta', 'pricing'],
};

/**
 * Las fuentes que una herramienta necesita de verdad. Puerto de `CRITICAL_DEPS`.
 *
 * "Crítica" no significa que bloquee: significa que si falta, el documento sale con marcadores
 * `[COMPLETAR]` en vez de cifras, y la interfaz lo avisa ANTES de gastar la generación. Bloquear
 * sería peor: hay alumnos que llegan con el posicionamiento hecho fuera del sistema.
 */
export const FUENTES_CRITICAS: Readonly<Record<number, readonly ClaveDeFuente[]>> = {
  4: ['icp', 'categoria'],
  26: ['icp', 'categoria', 'oferta', 'pricing'],
};

/** Las fuentes críticas que faltan para esta herramienta. */
export function faltantes(estado: EstadoDeFundaciones, id: number): readonly ClaveDeFuente[] {
  const criticas = FUENTES_CRITICAS[id];
  if (!criticas) return [];
  const todas = fuentes(estado);
  return criticas.filter((c) => !todas[c].presente);
}
