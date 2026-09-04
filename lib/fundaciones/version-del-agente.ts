// La versión del agente conversacional, en un módulo propio.
//
// Vive acá y no en `conversacion.ts` por lo mismo que `tieneAgente` vive en el catálogo: el navegador la
// necesita —para saber si la conversación que trae guardada es anterior y pedir que se reabra— y
// `conversacion.ts` es el módulo que le habla a Anthropic. Importarlo desde un componente arrastraría
// al paquete del navegador la URL, el esquema y las instrucciones enteras para leer un número.
//
// Qué significa cada número está documentado en `conversacion.ts`, junto a su re-export.
export const VERSION_DEL_AGENTE = 2;
