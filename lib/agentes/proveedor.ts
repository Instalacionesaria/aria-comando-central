// Lo que todo pedido a Anthropic comparte: a dónde va y con qué versión de la API.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ UN ARCHIVO PARA DOS CONSTANTES
//
// Hasta AG1 eran cinco copias privadas, una por módulo que llama al modelo (la generación, la
// conversación y el relleno de Fundaciones, el auditor y el núcleo de los Analizadores), y dos pruebas
// comparaban pares de ellas. El transporte de los agentes nuevos (`llamada.ts`) no suma una sexta: las
// importa de acá. Las cinco que quedan las ata `pruebas/codigo/171-transporte-del-analizador.test.ts`:
// tienen que decir exactamente esto, y nadie más puede escribir la dirección.
//
// Va aparte de `llamada.ts` a propósito: este archivo no importa nada. El día que esos cinco dejen su
// copia, importarlo no les arrastra la base, el uso ni los incidentes, y el auditor y el núcleo de los
// Analizadores se siguen probando sin base. Y no va en `modelos.ts`: la 199 exige que cada constante de
// ese archivo sea un modelo válido, y una dirección no lo es.
// ═══════════════════════════════════════════════════════════════════════════════

/** El punto de la API que usan todos los agentes: Messages. */
export const DIRECCION_DE_LA_API = 'https://api.anthropic.com/v1/messages';

/** La cabecera `anthropic-version`. Cambiarla cambia el contrato de las respuestas: la 171 exige las seis a la vez. */
export const VERSION_DE_LA_API = '2023-06-01';
