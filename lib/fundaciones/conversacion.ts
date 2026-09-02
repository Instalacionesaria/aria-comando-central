// El agente que hace las preguntas del formulario del Research, conversando.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ES ESTO Y QUÉ NO ES
//
// La pantalla del Research tiene DOS caminos hasta el mismo lugar: el formulario de cinco campos, y
// este agente. Lo que el agente hace es UNA cosa —llegar a esos cinco valores hablando— y lo que
// **no** hace es generar nada: cuando los tiene, arrancan los cinco pasos por la ruta de siempre
// (`/api/fundaciones/generar`), encadenados en el servidor como si los hubiera disparado el botón.
//
// Esa frontera es la decisión de diseño de todo el archivo. Un agente que además generara el
// research tendría su propia copia de la cadena de cinco pasos, y esa copia es donde volvería a
// aparecer el defecto que `PanelResearch` documenta en su encabezado: el paso 5 armado sobre una
// lista vacía, con el documento saliendo igual de bien.
//
// ── LAS PREGUNTAS NO ESTÁN ESCRITAS ACÁ, Y ESO ES EL PUNTO ───────────────────
//
// Se DERIVAN del catálogo (`camposDe(herramienta)`): la etiqueta del campo es la pregunta, el
// marcador es el ejemplo, la bandera `opcional` dice si se puede dejar pasar, y `valorPorOmision`
// dice qué vale cuando la persona no lo dice.
//
// Escritas a mano serían la *lista paralela* que este repositorio persigue con nombre propio, y acá
// el modo de falla es especialmente feo: alguien agrega un sexto criterio al formulario, el agente
// sigue preguntando cinco, y el research que sale del chat se genera sin ese dato **con las dos
// pantallas viéndose perfectas**. Nada falla. Simplemente son dos investigaciones distintas según
// por qué botón entraste.
//
// ── EL ESQUEMA ES EL CONTRATO, Y LA HERRAMIENTA SE FUERZA ────────────────────
//
// Mismo mecanismo que `lib/auditor/modelo.ts`, y por el mismo motivo: sin `tool_choice` el modelo
// puede contestar texto libre, y ahí no hay criterios que leer — habría que sacarlos del texto con
// una expresión regular, que es adivinar. Con la herramienta forzada, cada turno devuelve el mensaje
// para la persona Y el estado completo de los cinco criterios, o no devuelve nada.
//
// Los dos módulos arman su cuerpo por separado a propósito. Ver la nota de `modelo.ts`: compartir
// el armado obliga a que dos llamadas con formas distintas —una con búsqueda web y sin herramienta,
// otra con herramienta forzada y sin búsqueda— coincidan para siempre.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedirExterno } from '../http/cliente.ts';
import { camposDe, claveCorta, obligatoriosQueFaltan } from './campos.ts';
import { MODELO } from './generacion.ts';
import type { Campo, Herramienta } from './herramientas.ts';
import type { ChatDeResearch, MensajeDeChat } from './estado.ts';

const API = 'https://api.anthropic.com/v1/messages';
const VERSION_API = '2023-06-01';

/** El nombre de la herramienta forzada. Se comprueba al leer la respuesta, no solo el tipo. */
export const NOMBRE_DE_LA_HERRAMIENTA = 'registrar_criterios';

/**
 * El techo de tokens de un turno.
 *
 * Un turno es un párrafo corto más cinco cadenas cortas. Mil quinientos sobran, y el número importa
 * al revés que en la generación: acá **no** se quiere un techo generoso. El agente que se pone a
 * explicar el método en tres pantallas no ayuda a nadie a contestar cuál es su nicho, y un techo
 * bajo es lo único que lo impide de verdad — pedirle brevedad en las instrucciones lo mejora, no lo
 * garantiza.
 */
export const TECHO_DE_TOKENS = 1_500;

/**
 * Cuántos turnos de la conversación se le mandan al modelo.
 *
 * La conversación entera se GUARDA —la persona la ve completa al volver— y al modelo se le manda
 * la cola. Con veinte turnos ya se juntaron los cinco criterios diez veces; lo que sigue creciendo
 * es lo que se paga en cada llamada.
 *
 * Y el recorte no pierde nada, que es lo que lo hace aceptable: **el estado no vive en la
 * conversación, vive en `criteria`**, y eso viaja entero en las instrucciones de cada turno. Un
 * agente que dependiera del historial para saber qué ya preguntó empezaría a repreguntar el nicho
 * en el turno veintiuno.
 */
export const TURNOS_QUE_VE_EL_MODELO = 20;

/** Lo que devuelve un turno que salió bien. */
export interface Turno {
  /** Lo que la persona lee. */
  mensaje: string;
  /** Los cinco criterios con claves cortas. Cadena vacía = todavía no se sabe. */
  criterios: Record<string, string>;
  /** El agente afirma que ya se puede arrancar. **Se comprueba antes de creerle** — ver `arranca`. */
  listo: boolean;
}

export type FalloDeConversacion =
  | { tipo: 'rechazado'; estado: number; codigo: string; motivo: string | null }
  | { tipo: 'sin_respuesta'; causa: string }
  | { tipo: 'truncado' }
  | { tipo: 'declino' }
  | { tipo: 'sin_estructura' };

export type ResultadoDeConversacion = { tipo: 'datos'; datos: Turno } | FalloDeConversacion;

interface BloqueDeRespuesta {
  type?: string;
  name?: string;
  input?: unknown;
}

interface RespuestaDeAnthropic {
  content?: BloqueDeRespuesta[];
  stop_reason?: string;
}

// ─── Lo que se deriva del catálogo ──────────────────────────────────────────

/** Cómo se nombra un campo cuando se le habla al modelo: su clave corta. */
function claves(h: Herramienta): readonly string[] {
  return camposDe(h).map((c) => claveCorta(c.id));
}

/**
 * El esquema de la herramienta forzada.
 *
 * ── LOS CINCO CRITERIOS SON TODOS OBLIGATORIOS, Y LA CADENA VACÍA ES UN VALOR ──
 *
 * Tienta hacerlos opcionales y que el modelo mande solo los que averiguó. Con eso, cada turno
 * devuelve un pedazo y el servidor tiene que MEZCLARLO con lo anterior — y una mezcla no sabe
 * distinguir «no lo repetí» de «lo borré». La persona que dice *"mejor sacá lo del contrato"* deja
 * un criterio que ya no se puede vaciar nunca.
 *
 * Con los cinco obligatorios, cada turno trae el estado COMPLETO: lo que hay, lo que no hay, y lo
 * que se acaba de corregir. No hay mezcla, hay reemplazo. Es la misma razón por la que las salidas
 * del research las manda el servidor enteras en vez de que el navegador agregue la última.
 */
export function esquemaDeCriterios(h: Herramienta): Record<string, unknown> {
  const propiedades: Record<string, unknown> = {};
  for (const campo of camposDe(h)) {
    propiedades[claveCorta(campo.id)] = {
      type: 'string',
      description:
        `${campo.etiqueta}. Cadena vacía si la persona todavía no lo dijo. ` +
        'NO lo inventes ni lo deduzcas de lo que contó: si no lo dijo, va vacío.',
    };
  }

  return {
    type: 'object',
    properties: {
      mensaje: {
        type: 'string',
        description:
          'Lo que la persona va a leer. Una sola pregunta, o el resumen final. En español ' +
          'rioplatense, corto, sin viñetas salvo en el resumen final.',
      },
      criterios: {
        type: 'object',
        properties: propiedades,
        required: [...claves(h)],
        additionalProperties: false,
      },
      listo: {
        type: 'boolean',
        description:
          'true SOLO si en el turno anterior ya resumiste los criterios y la persona acaba de ' +
          'confirmar que arranque. Nunca en el mismo turno en que pedís la confirmación.',
      },
    },
    required: ['mensaje', 'criterios', 'listo'],
    additionalProperties: false,
  };
}

/** La línea de una pregunta, tal como el agente la ve. Sale entera del catálogo. */
function lineaDePregunta(campo: Campo, n: number): string {
  const partes = [`${n}. [${claveCorta(campo.id)}] ${campo.etiqueta}`];
  if (campo.marcador) partes.push(`   Ejemplo de respuesta: ${campo.marcador}`);
  if (campo.opcional) {
    partes.push('   OPCIONAL: preguntala una vez; si no la sabe o no le interesa, seguí de largo.');
  } else if (campo.valorPorOmision) {
    partes.push(
      `   Si no tiene una preferencia, vale "${campo.valorPorOmision}" y se sigue. No insistas.`,
    );
  } else {
    partes.push('   OBLIGATORIA: sin esto el research sale genérico. No se puede saltear.');
  }
  return partes.join('\n');
}

/**
 * Las instrucciones del entrevistador.
 *
 * Se arman en CADA llamada, y por eso el `system` no se guarda con la conversación: corregir una
 * regla acá tiene que corregir también las conversaciones que ya están abiertas. Guardarlo dejaría
 * a cada chat corriendo con las instrucciones del día que empezó — y como el chat sigue
 * funcionando, nadie se enteraría de que la corrección no llegó a nadie.
 */
export function instruccionesDeEntrevista(
  h: Herramienta,
  criterios: Record<string, string>,
): string {
  const campos = camposDe(h);
  const preguntas = campos.map((c, i) => lineaDePregunta(c, i + 1)).join('\n');
  const estado = campos
    .map((c) => {
      const v = criterios[claveCorta(c.id)];
      return `  ${claveCorta(c.id)}: ${v && v.trim() !== '' ? v : '(todavía no)'}`;
    })
    .join('\n');

  return (
    'Sos el entrevistador del Market Research de ARIA. Hablás en español rioplatense, tuteando, ' +
    'corto y sin adornos.\n\n' +
    'TU ÚNICO TRABAJO es llegar a los criterios de abajo conversando, y registrarlos con la ' +
    'herramienta. No hacés el research, no proponés segmentos, no analizás el mercado: eso lo hace ' +
    'otro proceso después, con estos criterios. Si te piden análisis, decí que primero necesitás ' +
    'los criterios y seguí preguntando.\n\n' +
    `LAS PREGUNTAS, EN ORDEN:\n${preguntas}\n\n` +
    `LO QUE YA SABÉS:\n${estado}\n\n` +
    'CÓMO PREGUNTAR:\n' +
    '· Una pregunta por turno. La que sigue sin responder, en el orden de arriba.\n' +
    '· Si en una sola respuesta te contesta varias, tomalas todas y no las vuelvas a preguntar.\n' +
    '· Si la respuesta es vaga ("empresas", "gente con plata"), pedí que la concrete UNA vez; si ' +
    'la segunda sigue vaga, tomá lo que dijo y seguí. No la interrogues.\n' +
    '· Si te pide cambiar algo que ya contestó, cambialo en `criterios` y confirmalo en una línea.\n' +
    '· NO inventes valores. Un criterio que no dijo va vacío, aunque puedas deducirlo de lo que ' +
    'contó: un dato deducido se ve idéntico a uno dicho, y el research se construye sobre él.\n\n' +
    'CÓMO TERMINAR (y esto no se saltea):\n' +
    '1. Cuando tengas las obligatorias, mostrale los criterios en una lista corta y preguntale si ' +
    'arranca. En ese turno `listo` va en false.\n' +
    '2. Recién cuando confirme, `listo` va en true y tu mensaje es una línea avisando que arranca.\n' +
    'Arrancar cuesta cinco búsquedas web y varios minutos, así que la confirmación es lo que ' +
    'separa un research útil de cinco documentos sobre el nicho equivocado.'
  );
}

/**
 * El primer mensaje del agente. **Lo arma el código, no el modelo.**
 *
 * Dos motivos, y el primero es de plata: abrir el chat no puede costar una inferencia. La pantalla
 * se abre sola cuando alguien toca la pestaña, y con el saludo generado cada apertura por
 * curiosidad se le cobra a la organización.
 *
 * El segundo es que este mensaje es el único que se puede escribir sin ambigüedad: si ya hay
 * criterios guardados, se muestran y se pregunta si van; si no, es la primera pregunta del
 * formulario, con su etiqueta EXACTA. Que la primera pantalla del chat y la primera etiqueta del
 * formulario digan lo mismo, palabra por palabra, es lo que hace evidente que son dos caminos a lo
 * mismo y no dos herramientas.
 */
export function mensajeDeApertura(h: Herramienta, criterios: Record<string, string>): string {
  const campos = camposDe(h);
  const conValor = campos.filter((c) => {
    const v = criterios[claveCorta(c.id)];
    return v !== undefined && v.trim() !== '';
  });

  if (conValor.length > 0) {
    const lista = conValor
      .map((c) => `· ${c.etiqueta} ${criterios[claveCorta(c.id)]}`)
      .join('\n');
    return (
      'Hola. Veo que ya tenés criterios guardados:\n\n' +
      `${lista}\n\n` +
      '¿Seguimos con estos o querés cambiar alguno?'
    );
  }

  const primera = campos[0];
  return (
    'Hola. Te voy a hacer las mismas preguntas del formulario, de a una, y cuando las tengamos ' +
    'arranco el research solo.\n\n' +
    `Empecemos: ${primera ? primera.etiqueta : ''}`
  );
}

/**
 * ¿Se puede arrancar el research? **La respuesta del modelo es un dato, no una orden.**
 *
 * ── LO QUE SE COMPRUEBA, Y LO QUE NO SE PUEDE COMPROBAR ──────────────────────
 *
 * Dos condiciones, y ninguna de las dos le cree al `listo` sola:
 *
 *   1. **No falta ningún criterio obligatorio.** Es la misma función que decide si el botón del
 *      formulario está habilitado, así que los dos caminos exigen exactamente lo mismo. Un `listo`
 *      en true con el trasfondo vacío arrancaría cinco generaciones que salen genéricas.
 *
 *   2. **El agente ya tenía los obligatorios ANTES de este turno.** Esto es lo que hace que la
 *      confirmación sea estructural y no una regla de buena voluntad en el prompt: si el último
 *      criterio se completó recién en este turno, entonces este es el turno en el que el agente
 *      recién puede resumir — no puede ser también el turno en que la persona ya confirmó. El
 *      modelo puede equivocarse con la regla del prompt; con esta comprobación, equivocarse cuesta
 *      un turno más, no cinco generaciones.
 *
 * Lo que NO se puede comprobar acá es que la persona haya dicho que sí: eso está en un texto libre,
 * y leerlo con una expresión regular sería adivinar en el único lugar donde adivinar cuesta plata.
 * Queda del lado del modelo, con la condición 2 poniéndole el piso.
 */
export function arranca(
  h: Herramienta,
  turno: Turno,
  criteriosPrevios: Record<string, string>,
): boolean {
  if (!turno.listo) return false;
  if (faltanObligatorios(h, turno.criterios)) return false;
  if (faltanObligatorios(h, criteriosPrevios)) return false;
  return true;
}

/** ¿Falta alguno de los criterios sin los que el research sale genérico? */
export function faltanObligatorios(h: Herramienta, criterios: Record<string, string>): boolean {
  return obligatoriosQueFaltan(h, porIdDeCampo(h, criterios)).length > 0;
}

/**
 * Claves cortas → identificadores de campo.
 *
 * `obligatoriosQueFaltan` trabaja con los valores del FORMULARIO (`mr-niche`) y el agente con los
 * del ALMACÉN (`niche`), que es la misma traducción que `campos.ts` ya hace en las dos direcciones.
 * Se convierte acá, en una función con nombre, en vez de tener dos versiones de la regla.
 */
function porIdDeCampo(h: Herramienta, criterios: Record<string, string>): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const campo of camposDe(h)) {
    const v = criterios[claveCorta(campo.id)];
    if (v !== undefined) salida[campo.id] = v;
  }
  return salida;
}

// ─── La llamada ─────────────────────────────────────────────────────────────

/**
 * Un turno de la conversación.
 *
 * `mensajes` llega ya cerrado por el servidor —el navegador manda UNA línea, no el historial— y esto
 * solo lo recorta a los últimos turnos y lo manda. Ver `operaciones.ts`: que el historial no viaje
 * por el navegador es lo que impide que alguien le arme al modelo una conversación en la que la
 * persona ya confirmó.
 */
export async function conversar(opciones: {
  claveIa: string;
  herramienta: Herramienta;
  mensajes: readonly MensajeDeChat[];
  criterios: Record<string, string>;
}): Promise<ResultadoDeConversacion> {
  const cola = opciones.mensajes.slice(-TURNOS_QUE_VE_EL_MODELO);

  const cuerpo: Record<string, unknown> = {
    model: MODELO,
    max_tokens: TECHO_DE_TOKENS,
    system: instruccionesDeEntrevista(opciones.herramienta, opciones.criterios),
    messages: cola.map((m) => ({ role: m.role, content: m.content })),
    tools: [
      {
        name: NOMBRE_DE_LA_HERRAMIENTA,
        description:
          'Registrá tu mensaje y el estado de los criterios. Es la única forma de responder: no ' +
          'escribas texto suelto.',
        input_schema: esquemaDeCriterios(opciones.herramienta),
      },
    ],
    tool_choice: { type: 'tool', name: NOMBRE_DE_LA_HERRAMIENTA },
  };

  const r = await pedirExterno<RespuestaDeAnthropic>(API, {
    metodo: 'POST',
    cabeceras: { 'x-api-key': opciones.claveIa, 'anthropic-version': VERSION_API },
    cuerpo,
  });

  if (r.tipo === 'rechazado') {
    return {
      tipo: 'rechazado',
      estado: r.estado,
      codigo: r.codigo,
      motivo: r.detalle === undefined ? null : r.detalle,
    };
  }
  if (r.tipo === 'sin_respuesta') return { tipo: 'sin_respuesta', causa: r.causa };

  /* El corte por techo se mira ANTES de leer la estructura, igual que en el auditor: una salida
     truncada leída como estructura inválida manda a revisar el esquema en vez de subir el techo. */
  if (r.datos.stop_reason === 'max_tokens') return { tipo: 'truncado' };
  if (r.datos.stop_reason === 'refusal') return { tipo: 'declino' };

  const bloques = Array.isArray(r.datos.content) ? r.datos.content : [];
  const usada = bloques.find((b) => b.type === 'tool_use' && b.name === NOMBRE_DE_LA_HERRAMIENTA);
  if (usada === undefined || usada.input === null || typeof usada.input !== 'object') {
    return { tipo: 'sin_estructura' };
  }

  const leido = leerTurno(opciones.herramienta, usada.input as Record<string, unknown>);
  return leido === null ? { tipo: 'sin_estructura' } : { tipo: 'datos', datos: leido };
}

/**
 * La entrada de la herramienta → un turno, o `null` si no se puede leer.
 *
 * Un mensaje vacío devuelve `null` y no una cadena vacía: la pantalla mostraría una burbuja en
 * blanco del agente y la persona no tendría a qué contestar. Es la misma decisión que
 * `generacion.ts` toma con un 200 sin texto — una respuesta que no sirve no es una respuesta vacía.
 */
function leerTurno(h: Herramienta, entrada: Record<string, unknown>): Turno | null {
  const mensaje = typeof entrada['mensaje'] === 'string' ? entrada['mensaje'].trim() : '';
  if (mensaje === '') return null;

  const crudos =
    entrada['criterios'] !== null && typeof entrada['criterios'] === 'object'
      ? (entrada['criterios'] as Record<string, unknown>)
      : {};

  /* Se recorre el CATÁLOGO y no las claves que vinieron: una clave que el modelo inventó no entra
     al almacén, y un criterio que no mandó queda como cadena vacía en vez de desaparecer. Lo que se
     guarda tiene la forma del formulario, siempre, venga como venga la respuesta. */
  const criterios: Record<string, string> = {};
  for (const clave of claves(h)) {
    const v = crudos[clave];
    criterios[clave] = typeof v === 'string' ? v.trim() : '';
  }

  return { mensaje, criterios, listo: entrada['listo'] === true };
}

/** La conversación vacía, con los criterios que ya estuvieran guardados. */
export function chatVacio(criterios: Record<string, string>): ChatDeResearch {
  return { messages: [], criteria: { ...criterios } };
}
