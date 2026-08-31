// LA LLAMADA AL MODELO del auditor. Salida estructurada, y tres finales declarados.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO Y NO `lib/fundaciones/generacion.ts`
//
// `generacion.ts` ya llama al mismo proveedor, y lo que comparte con esto es **el transporte**: la
// misma dirección, la misma cabecera de versión, el mismo `pedirExterno`, las mismas tres ramas de
// fallo. Lo que **no** comparte es todo lo demás:
//
//   · Fundaciones pide **texto markdown libre** y lee bloques `type: 'text'`.
//   · El auditor pide **una forma estricta** y lee un bloque `type: 'tool_use'`.
//
// Y ahí está el detalle que decide: `generacion.ts:150` filtra por `type === 'text'`, así que **un
// bloque `tool_use` se descartaría en silencio** y la respuesta caería en `sin_texto`. Reusar esa
// función exigía cambiarle el parseo, y su cuerpo está fijado por una prueba que afirma sus claves
// exactas — con motivo: esa prueba existe porque un campo de más produjo un 400 en producción.
//
// **Así que se escribe el cuerpo acá y el transporte se mantiene idéntico a propósito.** Una prueba
// de código afirma que los dos archivos coinciden en la dirección, la versión y el nombre de la
// cabecera de autenticación: es duplicación acotada y medida, no dos módulos que se van a separar.
//
// Y `fetch(` no aparece: `ADR-0305` lo restringe a tres archivos exactos y la lista es una igualdad,
// así que la salida es por `pedirExterno(` — el mismo camino que ya usan Fundaciones y el cliente del
// CRM.
//
// ── LA LLAVE VA EXPLÍCITA, Y ESO YA ES UN ADR ACÁ ───────────────────────────
//
// `ADR-0908`: *«la llave de IA es por organización, sin respaldo al entorno. No hay
// `ANTHROPIC_API_KEY`.»* El diseño de origen llama a esto *«la fuga más silenciosa que tuvo este
// módulo»*: su cliente leía la llave del entorno, así que durante un tiempo **todas las auditorías se
// le facturaban a la empresa principal, las de sus clientes también**. No era una fuga de datos: era
// una fuga de plata, del tipo que no se nota hasta la factura.
//
// Acá el parámetro no tiene valor por omisión, y sin él esta función no se llama.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedirExterno } from '../http/cliente.ts';
import { NOMBRE_DE_LA_HERRAMIENTA, esquemaDelVeredicto, type VeredictoDelModelo } from './esquema.ts';
import type { Agente } from './veredicto.ts';

/**
 * El modelo del auditor. **Constante del código, igual para todas las empresas.**
 *
 * ── POR QUÉ NO ES CONFIGURABLE, Y POR QUÉ ES SU PROPIA CONSTANTE ────────────
 *
 * En el diseño de origen esto era una variable de entorno más dos columnas por empresa, y se quitó
 * por una lección de este mismo producto: **un comportamiento gobernado por una variable de entorno
 * se vuelve a encender solo** en cualquier entorno donde la variable no esté. Con el modelo pasaba al
 * revés y era peor: *«una empresa podía quedar auditando con otro modelo sin que nadie lo hubiera
 * decidido y sin que apareciera en ningún diff»*.
 *
 * Y es **su propia constante** y no la de `lib/fundaciones/generacion.ts`, aunque hoy valgan lo
 * mismo. Compartirla haría que cambiar el modelo de los documentos de un alumno cambie en silencio
 * **cuánto cuesta auditar y cómo se juzga a los agentes** — dos decisiones distintas con un solo
 * interruptor.
 *
 * El modelo real con el que se juzgó **se guarda en cada análisis**: si mañana cambia, los análisis
 * viejos siguen diciendo con qué se produjeron.
 */
export const MODELO_DEL_AUDITOR = 'claude-sonnet-5';

/** La dirección y la versión. Idénticas a las de `generacion.ts`, y una prueba lo afirma. */
const API = 'https://api.anthropic.com/v1/messages';
const VERSION_API = '2023-06-01';

/**
 * El techo de tokens. **Cubre pensamiento + texto.**
 *
 * El diseño de origen dice que este número **ya se rompió dos veces** por no tenerlo presente: cuando
 * quedó corto, la salida vino truncada y **el análisis se perdió entero con la inferencia ya pagada**
 * — y el error se reportaba como «sin veredicto», sin decir por qué.
 *
 * De ahí la regla operativa que hay que heredar: **cuando se agregan campos de texto libre al
 * veredicto, el techo sube en el mismo cambio.** Dejarlo igual es volver a pagar el mismo error a
 * sabiendas.
 */
export const TECHO_DE_TOKENS = 16_000;

/**
 * Lo que sale bien.
 *
 * `tokens` se devuelve y hoy **nadie lo persiste**, igual que en Fundaciones. Queda dicho para que la
 * ausencia sea una decisión visible y no un olvido: un tablero de gasto es trabajo aparte, y sin él no
 * hay forma de saber cuánto cuesta auditar de verdad.
 */
export interface Veredicto {
  veredicto: VeredictoDelModelo;
  milisegundos: number;
  tokens: number | null;
  modelo: string;
}

/**
 * Los cuatro finales que no son un veredicto. **Cada uno lleva lo que hace falta para decidir.**
 *
 * `declino` está aparte de los demás a propósito: **no es un fallo del agente auditado y no se marca
 * nada.** Si cayera en el mismo cajón que un rechazo del servicio, la pantalla lo mostraría como un
 * problema del auditor — y el barrido de respaldo volvería a intentarlo para siempre.
 */
export type FalloDelAuditor =
  | { tipo: 'rechazado'; estado: number; codigo: string; motivo: string | null }
  | { tipo: 'sin_respuesta'; causa: string }
  | { tipo: 'declino' }
  | { tipo: 'truncado' }
  | { tipo: 'sin_estructura' };

export type ResultadoDelAuditor = { tipo: 'datos'; datos: Veredicto } | FalloDelAuditor;

interface BloqueDeRespuesta {
  type?: string;
  name?: string;
  input?: unknown;
}

interface RespuestaDeAnthropic {
  content?: BloqueDeRespuesta[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Le pide un veredicto al modelo.
 *
 * @param claveIa La llave de **esa** empresa. Sin valor por omisión: ver `ADR-0908`.
 * @param agente Qué auditor es. Decide el enumerado de criterios del esquema.
 * @param instrucciones El bloque estable: el contexto del agente, su prompt y la rúbrica. **Va como
 *   `system`** y no como parte del mensaje, y esa separación es la que un día permite marcarlo para
 *   cachear sin tocar nada más.
 * @param patrones Los códigos ya detectados. Van **aparte del bloque estable** porque cambian con cada
 *   hallazgo: pegados al prefijo, cada hallazgo nuevo invalidaría el caché entero de esa empresa.
 * @param conversacion Los hechos medidos y el transcript. Es el mensaje.
 */
export async function pedirVeredicto(opciones: {
  claveIa: string;
  agente: Agente;
  instrucciones: string;
  patrones: readonly string[];
  conversacion: string;
}): Promise<ResultadoDelAuditor> {
  const desde = Date.now();

  /* ── EL PREFIJO ESTABLE Y LO QUE CAMBIA, SEPARADOS ────────────────────────
   *
   * Dos bloques de `system`: primero lo que no cambia entre análisis de la misma empresa, después los
   * patrones conocidos.
   *
   * ── Y EL CACHÉ NO SE MARCA TODAVÍA, CON SU MOTIVO ────────────────────────
   *
   * El diseño de origen marca el primer bloque para cachear con una vida de una hora, y las cuentas
   * le cierran: escribir el caché cuesta 2× la entrada y leerlo 0,1×, así que **se paga sola con UNA
   * lectura por hora**. También dice dónde va el corte —en la rúbrica, con los patrones AFUERA—
   * porque tenerlo en los patrones hacía que cada hallazgo nuevo invalidara el caché y **se pagaba la
   * escritura una y otra vez sin llegar a cobrar una sola lectura**.
   *
   * Acá el corte ya está puesto —es esta separación— y la marca **no**. La vida de una hora necesita
   * una cabecera de vista previa del proveedor que **no se puede comprobar sin gastar plata de la
   * cuenta de la empresa**, y una cabecera mal puesta es un 400: perdería TODOS los análisis, no uno.
   * Agregarla cuando se pueda medir es una línea. */
  const cuerpo: Record<string, unknown> = {
    model: MODELO_DEL_AUDITOR,
    max_tokens: TECHO_DE_TOKENS,
    system: [
      { type: 'text', text: opciones.instrucciones },
      { type: 'text', text: textoDeLosPatrones(opciones.patrones) },
    ],
    messages: [{ role: 'user', content: opciones.conversacion }],
    tools: [
      {
        name: NOMBRE_DE_LA_HERRAMIENTA,
        description:
          'Registrá el veredicto de esta conversación. Es la única forma de responder: no escribas ' +
          'texto suelto.',
        input_schema: esquemaDelVeredicto(opciones.agente),
      },
    ],
    /* ── LA HERRAMIENTA SE FUERZA, Y NO SE PIDE PENSAMIENTO EXTENDIDO ────────
     *
     * Forzarla es lo que hace que **el esquema sea el contrato**: sin esto el modelo puede contestar
     * con texto libre, y ahí no hay forma de leer un veredicto — cae en `sin_estructura` y la
     * inferencia se paga igual.
     *
     * Y el pensamiento extendido **no se pide**, aunque el diseño de origen pida «esfuerzo alto». El
     * motivo es el mismo que el del caché: la compatibilidad entre pensamiento extendido y una
     * herramienta forzada **no se puede comprobar sin gastar plata de la cuenta de la empresa**, y si
     * no son compatibles la respuesta es un 400 que pierde todos los análisis.
     *
     * El techo de 16.000 queda igual y sobra para una salida sin pensamiento — lo que NO se hace es
     * bajarlo: la regla operativa dice que este número sube cuando se agregan campos, nunca al
     * revés, y el día que se agregue el pensamiento ya está cubierto. */
    tool_choice: { type: 'tool', name: NOMBRE_DE_LA_HERRAMIENTA },
  };

  const r = await pedirExterno<RespuestaDeAnthropic>(API, {
    metodo: 'POST',
    cabeceras: { 'x-api-key': opciones.claveIa, 'anthropic-version': VERSION_API },
    cuerpo,
  });

  /* Las dos ramas de `pedirExterno` se traducen sin colapsarlas. `motivo` es la frase que el servicio
     manda, y es el único campo que dice QUÉ estuvo mal: sin él, `invalid_request_error` cubre por
     igual un techo fuera de rango, un campo de más y una cuenta sin saldo. */
  if (r.tipo === 'rechazado') {
    return {
      tipo: 'rechazado',
      estado: r.estado,
      codigo: r.codigo,
      motivo: r.detalle === undefined ? null : r.detalle,
    };
  }
  if (r.tipo === 'sin_respuesta') return { tipo: 'sin_respuesta', causa: r.causa };

  /* ── EL MOTIVO DE CORTE SE MIRA EXPLÍCITAMENTE ────────────────────────────
   *
   * Y va ANTES de leer la respuesta, no en el `catch` del lector. El diseño de origen lo pide con la
   * historia detrás: cuando el techo quedó corto, la salida vino truncada y **el análisis se perdió
   * entero con la inferencia ya pagada**, reportado como «sin veredicto» y sin decir por qué. Un
   * truncado leído como estructura inválida manda a revisar el esquema en vez de subir el techo. */
  if (r.datos.stop_reason === 'max_tokens') return { tipo: 'truncado' };

  /* El modelo se negó a responder. **No es un fallo del agente auditado**: no se marca nada, no se
     escribe un análisis, y el barrido de respaldo no tiene que reintentarlo como si fuera un error
     nuestro. Es su propia rama por eso. */
  if (r.datos.stop_reason === 'refusal') return { tipo: 'declino' };

  const bloques = Array.isArray(r.datos.content) ? r.datos.content : [];
  const usada = bloques.find(
    (b) => b.type === 'tool_use' && b.name === NOMBRE_DE_LA_HERRAMIENTA,
  );

  /* Un 200 sin el bloque de la herramienta no es un veredicto vacío: es una respuesta que no sirve. Se
     comprueba el NOMBRE y no solo el tipo — con una sola herramienta ofrecida no debería hacer falta,
     y hace falta igual: el día que se ofrezca una segunda, leer «el primer tool_use» tomaría la
     equivocada y el veredicto saldría de otra forma. */
  if (usada === undefined || usada.input === null || typeof usada.input !== 'object') {
    return { tipo: 'sin_estructura' };
  }

  const uso = r.datos.usage;
  const entrada = uso && uso.input_tokens ? uso.input_tokens : 0;
  const salida = uso && uso.output_tokens ? uso.output_tokens : 0;
  const tokens = entrada + salida;

  return {
    tipo: 'datos',
    datos: {
      /* El esquema estricto ya garantizó la forma, así que acá no se revalida campo por campo: eso
         sería una tercera capa que se desincroniza de las otras dos. Lo que SÍ se hace después es
         normalizar los vocabularios y descartar por partes lo que no sobreviva — y eso vive en
         `lib/auditor/veredicto.ts`, no acá. */
      veredicto: usada.input as VeredictoDelModelo,
      milisegundos: Date.now() - desde,
      tokens: tokens > 0 ? tokens : null,
      modelo: MODELO_DEL_AUDITOR,
    },
  };
}

/**
 * Los patrones conocidos, como texto para el segundo bloque de `system`.
 *
 * ── LA ORDEN VA EN MAYÚSCULAS, Y ES LO QUE HACE ÚTIL LA PANTALLA ────────────
 *
 * El código de patrón **agrupa casos iguales bajo un mismo nombre**, así el técnico ve «×15 casos» en
 * vez de quince problemas sueltos. Eso solo funciona si el modelo reusa el código existente cuando el
 * hallazgo es el mismo, aunque él lo hubiera nombrado distinto.
 *
 * Sin patrones conocidos **se dice que la lista está vacía**, en vez de omitir el bloque: un bloque
 * ausente y uno vacío se leen distinto, y el segundo le dice al modelo que puede nombrar libremente.
 */
function textoDeLosPatrones(patrones: readonly string[]): string {
  if (patrones.length === 0) {
    return (
      'PATRONES YA DETECTADOS EN ESTA EMPRESA: ninguno todavía. Nombrá el código del patrón como ' +
      'creas mejor, siguiendo el formato.'
    );
  }
  return (
    'PATRONES YA DETECTADOS EN ESTA EMPRESA:\n' +
    patrones.map((p) => `  · ${p}`).join('\n') +
    '\n\nSI TU HALLAZGO ES EL MISMO PATRÓN QUE UNO DE ARRIBA, REUSÁ ESE CÓDIGO EXACTO, aunque vos lo ' +
    'hubieras nombrado distinto. Es lo que permite ver «×15 casos» en vez de quince problemas sueltos.'
  );
}
