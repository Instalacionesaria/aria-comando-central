// El modelo de cada agente NUEVO. Una constante por agente, con su valor escrito: ni una variable de
// entorno ni una columna por empresa.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ UNA POR AGENTE, Y NO UNA «POR OMISIÓN» QUE COMPARTAN
//
// `D-15` (`docs/OTROS/agentes/06-MODELOS-USO-TOPES-E-INCIDENTES.md`, AG-90). Compartirla haría que cambiar
// el modelo de un agente cambie en silencio cuánto cuestan y cómo contestan los otros: es la razón por la
// que el auditor no importa el de Fundaciones (el comentario de `MODELO_DEL_AUDITOR`,
// `lib/auditor/modelo.ts`). Hoy cuatro valen lo mismo; cambiar uno es una línea y no arrastra a nadie.
//
// Y una constante y no el entorno, por la lección de ese mismo comentario: un comportamiento gobernado por
// una variable de entorno cambia solo donde la variable falta.
//
// ── LO QUE NO VIVE ACÁ ───────────────────────────────────────────────────────
//
// Los modelos de los agentes que ya existían se quedan donde están, con su valor: `MODELO`
// (`lib/fundaciones/generacion.ts`), `MODELO_DEL_AUDITOR` (`lib/auditor/modelo.ts`), `ANALYSIS_MODEL` y
// `CLASSIFY_MODEL` (`lib/analizadores/nucleo/anthropic.ts`). Se evalúan después (`D-15`).
//
// Y nada que no sea un identificador de modelo: la 199 exige que CADA constante de este archivo esté en
// `pruebas/apoyo/modelos-validos.ts`. Un identificador mal escrito no falla en ninguna prueba con la red
// falseada; falla en producción, con `IA-MODELO` en cada llamada.
//
// Copywriter no tiene constante: es sólo diseño (`D-05`). Entra acá el día que se construya; antes sería
// una entrada que la 199 vigila sin que nada la use.
//
// ── LO QUE ESTO NO GARANTIZA ─────────────────────────────────────────────────
//
// Que la llave de la organización principal alcance `claude-sonnet-5-5`. Un identificador válido que la
// cuenta no alcanza da el mismo 404 que uno inventado (el comentario de `MODELO`,
// `lib/fundaciones/generacion.ts`). Se comprueba con el OK del usuario antes de la primera llamada real
// (AG-92), con un `GET /v1/models/claude-sonnet-5-5` que no gasta tokens.
// ═══════════════════════════════════════════════════════════════════════════════

/** El cerebro (`executive` en el código): responde con herramientas. */
export const MODELO_DEL_EXECUTIVE = 'claude-sonnet-5-5';

/** La redacción del Plan de acción de cada departamento. */
export const MODELO_DEL_PLAN = 'claude-sonnet-5-5';

/** La Reunión de hoy: ordenar y redactar no es clasificar. */
export const MODELO_DE_LA_REUNION = 'claude-sonnet-5-5';

/** El Brief del closer: crear. */
export const MODELO_DEL_BRIEF = 'claude-sonnet-5-5';

/**
 * La categoría de cada objeción: clasificar, una vez por llamada analizada. El identificador CON fecha y no
 * el alias `claude-haiku-4-5` del clasificador de los Analizadores: un alias puede pasar a otra versión
 * sin que aparezca en ningún diff. Este modelo no acepta `esfuerzo` (`llamada.ts`): no se le manda.
 */
export const MODELO_DE_LAS_OBJECIONES = 'claude-haiku-4-5-20251001';
