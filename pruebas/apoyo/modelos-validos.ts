// Los identificadores de modelo que este proyecto acepta usar. UNA lista, en UN lugar.
//
// La usan dos pruebas: la 90, que vigila el modelo de Fundaciones (`MODELO`), y la 199, que vigila cada
// constante de `lib/agentes/modelos.ts`. Vive acá y no adentro de la 90 porque una prueba no puede
// importar a otra sin registrar sus casos, y dos copias divergen: se suma un modelo en una, la otra sigue
// verde y el identificador nuevo nunca se comparó con nada. Es el argumento de `autorizados.ts`.
//
// No dice «los únicos que existen»: dice «los que este proyecto acepta usar». Un identificador mal
// escrito no falla en ninguna prueba con la red falseada; falla en producción, con `IA-MODELO` en cada
// llamada, y la pantalla manda a revisar una llave que está bien.
//
// Tampoco dice que la llave de una empresa ALCANCE cada uno: un modelo válido que la cuenta no alcanza
// da el mismo 404 que uno inventado (el comentario de `MODELO` en `lib/fundaciones/generacion.ts`). Eso
// se comprueba con `GET /v1/models/<id>` y el OK del usuario: es AG-92 del plan de los agentes.
//
// El alias `claude-haiku-4-5` del clasificador de los Analizadores no está y no hace falta: ninguna de
// las dos pruebas lo mira, y la 171 lo fija por igualdad.

export const MODELOS_VALIDOS: readonly string[] = [
  'claude-opus-5',
  'claude-sonnet-5',
  // AG1, 2026-10-04: el de los agentes nuevos (`lib/agentes/modelos.ts`).
  'claude-sonnet-5-5',
  'claude-fable-5',
  'claude-haiku-4-5-20251001',
];

/**
 * De los de arriba, los que rechazan con un 400 una herramienta FORZADA (`tool_choice` de tipo `tool` o
 * `any`), según la referencia de la API de Anthropic. El entrevistador de Fundaciones, el relleno y el
 * auditor fuerzan la suya: la 199 exige que su modelo no esté acá. Cambiar ese modelo es «una línea»
 * (el comentario de la 90), y sin esto esa línea sería un 400 en todas sus llamadas con las pruebas en verde.
 */
export const MODELOS_SIN_HERRAMIENTA_FORZADA: readonly string[] = ['claude-sonnet-5-5'];
