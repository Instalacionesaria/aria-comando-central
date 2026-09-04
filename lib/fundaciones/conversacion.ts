// El agente que hace las preguntas del formulario de una herramienta, conversando.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ES ESTO Y QUÉ NO ES
//
// Cada herramienta de Fundaciones tiene DOS caminos hasta el mismo lugar: su formulario, y este
// agente. Lo que el agente hace es UNA cosa —llegar a los valores de ESOS campos hablando— y lo que
// **no** hace es generar nada: cuando los tiene, se genera por la ruta de siempre
// (`/api/…/generar`), con el mismo cuerpo que manda el botón.
//
// Esa frontera es la decisión de diseño de todo el archivo. Un agente que además generara tendría su
// propia copia de la metodología —los `SKILL.md`, la herencia entre herramientas, los techos de
// tokens— y esa copia es donde aparecería el defecto que este repositorio persigue: el documento
// sale, se ve bien, y está construido sobre otra cosa.
//
// ── UN SOLO AGENTE PARA LAS NUEVE, Y ESO NO ES UN AHORRO ────────────────────
//
// Empezó siendo el agente del Research y se generalizó a las nueve en el cambio siguiente. Podría
// haber sido un módulo por herramienta —cada una con sus preguntas escritas—, y eso es exactamente
// lo que no se hizo: **nueve copias de las mismas seis reglas** que divergen en la primera
// corrección, con ocho pantallas que se ven perfectas mientras una junta los datos de otra manera.
//
// Lo que varía entre herramientas ya está escrito en un solo lugar —el catálogo de
// `herramientas.ts`— y de ahí sale todo:
//
//   · la etiqueta del campo ES la pregunta;
//   · el marcador es el ejemplo;
//   · `opcional` dice si se puede dejar pasar;
//   · `valorPorOmision` dice qué vale cuando la persona no lo dice;
//   · `opciones` (los desplegables del VSL) son los ÚNICOS valores que el esquema acepta;
//   · `titulo` y `etiquetaSalida` son de qué se está hablando.
//
// Un campo nuevo en cualquier formulario aparece solo en su chat. Y al revés: no hay forma de que el
// agente pregunte algo que el formulario no tiene, porque no hay dónde escribirlo.
//
// ── EL ESQUEMA ES EL CONTRATO, Y LA HERRAMIENTA SE FUERZA ───────────────────
//
// Mismo mecanismo que `lib/auditor/modelo.ts`, y por el mismo motivo: sin `tool_choice` el modelo
// puede contestar texto libre, y ahí no hay respuestas que leer — habría que sacarlas del texto con
// una expresión regular, que es adivinar. Con la herramienta forzada, cada turno devuelve el mensaje
// para la persona Y el estado completo de las respuestas, o no devuelve nada.
//
// Los dos módulos arman su cuerpo por separado a propósito. Ver la nota de `modelo.ts`: compartir el
// armado obliga a que dos llamadas con formas distintas —una con búsqueda web y sin herramienta,
// otra con herramienta forzada y sin búsqueda— coincidan para siempre.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedirExterno } from '../http/cliente.ts';
import { VERSION_DEL_AGENTE } from './version-del-agente.ts';
import { camposDe, claveCorta, obligatoriosQueFaltan } from './campos.ts';
import { MODELO } from './generacion.ts';
import type { Campo, Herramienta } from './herramientas.ts';
import type { ChatDeHerramienta, MensajeDeChat } from './estado.ts';

const API = 'https://api.anthropic.com/v1/messages';
const VERSION_API = '2023-06-01';

/** El nombre de la herramienta forzada. Se comprueba al leer la respuesta, no solo el tipo. */
export const NOMBRE_DE_LA_HERRAMIENTA = 'registrar_respuestas';

/**
 * La versión del agente. **Se sube cuando cambia lo que el agente sabe hacer**, no con cada retoque
 * de redacción.
 *
 * Una conversación guardada con una versión menor se reabre una vez al entrar —conservando lo
 * contestado— porque sus turnos viejos ya no son ciertos y el modelo se los cree: la del 2026-09-03
 * tenía al agente diciendo «eso todavía no existe» con el avatar generado debajo, y preguntando de a
 * una cosas que hoy propone desde la ficha y el research. Kevin: «me preguntó de todo».
 *
 *   1 · el cuestionario ciego (implícita: las conversaciones sin versión).
 *   2 · recibe el contexto heredado y su propio entregable; abre proponiendo.
 */
export { VERSION_DEL_AGENTE };

/**
 * El techo de tokens de un turno.
 *
 * Un turno es un párrafo corto más las respuestas, que son cadenas cortas. Mil quinientos sobran, y
 * el número importa al revés que en la generación: acá **no** se quiere un techo generoso. El agente
 * que se pone a explicar el método en tres pantallas no ayuda a nadie a contestar cuál es su nicho,
 * y un techo bajo es lo único que lo impide de verdad — pedirle brevedad en las instrucciones lo
 * mejora, no lo garantiza.
 */
export const TECHO_DE_TOKENS = 1_500;

/**
 * Cuántos turnos de la conversación se le mandan al modelo.
 *
 * La conversación entera se GUARDA —la persona la ve completa al volver— y al modelo se le manda la
 * cola. Con veinte turnos ya se juntaron las respuestas varias veces; lo que sigue creciendo es lo
 * que se paga en cada llamada.
 *
 * Y el recorte no pierde nada, que es lo que lo hace aceptable: **el estado no vive en la
 * conversación, vive en `answers`**, y eso viaja entero en las instrucciones de cada turno. Un
 * agente que dependiera del historial para saber qué ya preguntó empezaría a repreguntar en el turno
 * veintiuno.
 */
export const TURNOS_QUE_VE_EL_MODELO = 20;

/** Lo que devuelve un turno que salió bien. */
export interface Turno {
  /** Lo que la persona lee. */
  mensaje: string;
  /** Las respuestas con claves cortas. Cadena vacía = todavía no se sabe. */
  respuestas: Record<string, string>;
  /** El agente afirma que ya se puede generar. **Se comprueba antes de creerle** — ver `arranca`. */
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
 * El esquema de UN campo.
 *
 * ── LOS DESPLEGABLES VAN COMO `enum`, Y ESO NO ES PROLIJIDAD ────────────────
 *
 * `PanelHerramienta` ya explica por qué esos campos son un `select` y no un cuadro de texto: sus
 * valores NO son etiquetas, son el texto que entra al prompt, y el `SKILL.md` del VSL deriva de
 * ellos booleanos que encienden ramas enteras del framework. Un valor escrito a mano —«b2c», «si»—
 * apaga la rama y el documento sale igual, con el molde equivocado.
 *
 * El chat tiene la misma puerta abierta y más grande: acá el valor lo escribe un modelo a partir de
 * lo que alguien dijo en prosa. El `enum` es lo que hace que solo existan los valores que el
 * framework entiende, del mismo modo que allá lo hace el desplegable.
 */
function esquemaDeCampo(campo: Campo): Record<string, unknown> {
  const comun =
    `${campo.etiqueta}. Cadena vacía si la persona todavía no lo dijo. ` +
    'NO lo inventes ni lo deduzcas de lo que contó: si no lo dijo, va vacío.';

  if (campo.tipo === 'lista' && campo.opciones && campo.opciones.length > 0) {
    return {
      type: 'string',
      /* La cadena vacía es parte del `enum`: sin ella, «todavía no lo sé» sería un valor inválido y
         el modelo tendría que elegir una opción cualquiera para poder contestar. */
      enum: ['', ...campo.opciones.map((o) => o.valor)],
      description:
        `${comun} Solo uno de los valores permitidos, tal cual: ` +
        campo.opciones.map((o) => `"${o.valor}" (${o.etiqueta})`).join(', ') +
        '.',
    };
  }

  return { type: 'string', description: comun };
}

/**
 * El esquema de la herramienta forzada.
 *
 * ── LAS RESPUESTAS SON TODAS OBLIGATORIAS, Y LA CADENA VACÍA ES UN VALOR ────
 *
 * Tienta hacerlas opcionales y que el modelo mande solo las que averiguó. Con eso, cada turno
 * devuelve un pedazo y el servidor tiene que MEZCLARLO con lo anterior — y una mezcla no sabe
 * distinguir «no lo repetí» de «lo borré». La persona que dice *"mejor sacá lo del contrato"* deja
 * un dato que ya no se puede vaciar nunca.
 *
 * Con todas obligatorias, cada turno trae el estado COMPLETO: lo que hay, lo que no hay, y lo que se
 * acaba de corregir. No hay mezcla, hay reemplazo. Es la misma razón por la que las salidas del
 * research las manda el servidor enteras en vez de que el navegador agregue la última — y es lo que
 * hace comprobable la regla de `arranca`.
 */
export function esquemaDeCampos(h: Herramienta): Record<string, unknown> {
  const propiedades: Record<string, unknown> = {};
  for (const campo of camposDe(h)) propiedades[claveCorta(campo.id)] = esquemaDeCampo(campo);
  return {
    type: 'object',
    properties: propiedades,
    required: [...claves(h)],
    additionalProperties: false,
  };
}

export function esquemaDeRespuestas(h: Herramienta): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      mensaje: {
        type: 'string',
        description:
          'Lo que la persona va a leer. Una sola pregunta, o el resumen final. En español ' +
          'rioplatense, corto, sin viñetas salvo en el resumen final.',
      },
      /* El MISMO bloque que usa el relleno desde el contexto heredado (`lib/fundaciones/relleno.ts`).
         Compartirlo no es ahorro: son dos caminos que llenan los mismos campos del mismo formulario,
         y con dos esquemas uno aceptaría un campo que el otro rechaza — el defecto se vería como
         «por el chat sí se guarda y por el relleno no». */
      respuestas: esquemaDeCampos(h),
      listo: {
        type: 'boolean',
        description:
          'true SOLO si en el turno anterior ya resumiste las respuestas y la persona acaba de ' +
          'confirmar. Nunca en el mismo turno en que pedís la confirmación, y nunca en un turno ' +
          'en el que además anotaste un dato nuevo.',
      },
    },
    required: ['mensaje', 'respuestas', 'listo'],
    additionalProperties: false,
  };
}

/** La línea de una pregunta, tal como el agente la ve. Sale entera del catálogo. */
function lineaDePregunta(campo: Campo, n: number): string {
  const partes = [`${n}. [${claveCorta(campo.id)}] ${campo.etiqueta}`];

  if (campo.tipo === 'lista' && campo.opciones && campo.opciones.length > 0) {
    partes.push(
      '   ELEGIR UNA, y anotar el valor tal cual: ' +
        campo.opciones.map((o) => `"${o.valor}" = ${o.etiqueta}`).join(' · '),
    );
  } else if (campo.marcador) {
    partes.push(`   Ejemplo de respuesta: ${campo.marcador}`);
  }

  if (campo.opcional) {
    partes.push('   OPCIONAL: preguntala una vez; si no la sabe o no le interesa, seguí de largo.');
  } else if (campo.valorPorOmision) {
    partes.push(
      `   Si no tiene una preferencia, vale "${campo.valorPorOmision}" y se sigue. No insistas.`,
    );
  } else {
    partes.push('   Si no la sabe, se deja vacía: el entregable la marca como pendiente.');
  }
  return partes.join('\n');
}

/**
 * Las instrucciones del entrevistador.
 *
 * Se arman en CADA llamada, y por eso el `system` no se guarda con la conversación: corregir una
 * regla acá tiene que corregir también las conversaciones que ya están abiertas. Guardarlo dejaría a
 * cada chat corriendo con las instrucciones del día que empezó — y como el chat sigue funcionando,
 * nadie se enteraría de que la corrección no llegó a nadie.
 */
export function instruccionesDeEntrevista(
  h: Herramienta,
  respuestas: Record<string, string>,
  /**
   * Lo que las herramientas anteriores ya produjeron, en texto. Es el MISMO contexto que lee el
   * prompt de generación (`contextoHeredado`), y viaja en cada turno.
   *
   * Sin esto el agente era un cuestionario ciego: a «¿cuál es mi ICP?» respondía «todavía no tengo
   * datos» con la ficha y el research a un paso. Kevin lo llamó, con razón, una estupidez.
   */
  contexto = '',
  /**
   * El entregable que ESTA herramienta ya generó, si existe. Reportado con captura: a «¿cuál es mi
   * ICP?» el agente contestaba «eso todavía no existe» con el Avatar Buyer Profile a diez centímetros,
   * debajo del chat. Recibía la ficha y el research —lo heredado— pero no lo suyo.
   */
  entregable = '',
): string {
  const campos = camposDe(h);
  const preguntas = campos.map((c, i) => lineaDePregunta(c, i + 1)).join('\n');
  const estado = campos
    .map((c) => {
      const v = respuestas[claveCorta(c.id)];
      return `  ${claveCorta(c.id)}: ${v && v.trim() !== '' ? v : '(todavía no)'}`;
    })
    .join('\n');

  /* Lo que hay que decirle al modelo sobre la herramienta sale del catálogo, incluida la explicación
     larga (`detalle`) cuando existe: es la misma que lee la persona en «¿Cómo funciona?», así que
     los dos entienden lo mismo de lo que están por hacer. */
  const queEs = h.detalle ? `${h.bajada}\n${h.detalle}` : h.bajada;

  return (
    `Sos el entrevistador de «${h.titulo}», una herramienta de Fundaciones de ARIA. Hablás en ` +
    'español rioplatense, tuteando, corto y sin adornos.\n\n' +
    `DE QUÉ SE TRATA: ${queEs}\n\n` +
    'TU ÚNICO TRABAJO es llegar a las respuestas de abajo conversando, y registrarlas con la ' +
    `herramienta. No escribís el entregable: «${h.etiquetaSalida}» lo genera otro proceso después, ` +
    'con estas respuestas y con la metodología completa. Si te piden el entregable, decí que ' +
    'primero necesitás las respuestas y seguí preguntando.\n\n' +
    `LAS PREGUNTAS, EN ORDEN:\n${preguntas}\n\n` +
    `LO QUE YA SABÉS:\n${estado}\n\n` +
    (contexto.trim() !== ''
      ? 'LO QUE LA PERSONA YA CONSTRUYÓ EN LAS HERRAMIENTAS ANTERIORES (usalo: de acá salen la ' +
        'mayoría de las respuestas, y con esto respondés cualquier pregunta que te haga sobre su ' +
        `negocio o su mercado):\n${contexto}\n\n`
      : '') +
    (entregable.trim() !== ''
      ? `EL ENTREGABLE DE ESTA HERRAMIENTA («${h.etiquetaSalida}») YA EXISTE. Ésta es su versión más ` +
        'reciente. Si en esta conversación dijiste antes que no existía, eso quedó viejo: ahora existe. ' +
        'Si te preguntan por él, respondé CON ÉL —resumilo, citá sus partes—, nunca digas que falta ' +
        'armarlo. Si te piden un cambio, anotalo en `respuestas` y preguntá si regenerás con ese cambio; ' +
        `con la confirmación, \`listo\` en true regenera.\n${entregable}\n\n`
      : '') +
    'SI TE PREGUNTA ALGO —«¿cuál es mi ICP?», «¿qué dolor tiene mi cliente?»— RESPONDÉ con lo que ' +
    'el contexto de arriba dice, corto y concreto, citando de dónde lo sacaste (su research, su ' +
    'ficha). No contestes «todavía no tengo datos» si los datos están arriba. Si pregunta por el ' +
    'entregable completo y todavía no existe, resumile lo que ya tenés para armarlo y preguntale ' +
    'si genera: el documento completo lo produce otro proceso cuando confirme.\n\n' +
    'CÓMO PREGUNTAR:\n' +
    '· Los «Ejemplo de respuesta» de arriba son FORMATO, no datos. Nunca los anotes como respuesta.\n' +
    '· Antes de preguntar algo, mirá si el contexto ya lo contesta. Si lo contesta, ANOTALO y ' +
    'confirmalo en una línea en vez de preguntarlo.\n' +
    '· Una pregunta por turno. La que sigue sin responder, en el orden de arriba.\n' +
    '· Si en una sola respuesta te contesta varias, tomalas todas y no las vuelvas a preguntar.\n' +
    '· Si la respuesta es vaga, pedí que la concrete UNA vez; si la segunda sigue vaga, tomá lo que ' +
    'dijo y seguí. No la interrogues.\n' +
    '· Si te pide cambiar algo que ya contestó, cambialo en `respuestas` y confirmalo en una línea.\n' +
    '· NO inventes valores. Un dato que no dijo va vacío, aunque puedas deducirlo de lo que contó: ' +
    'un dato deducido se ve idéntico a uno dicho, y el entregable se construye sobre él.\n\n' +
    'CÓMO TERMINAR (y esto no se saltea):\n' +
    '1. Cuando hayas preguntado TODAS, mostrale las respuestas en una lista corta y preguntale si ' +
    'genera. En ese turno `listo` va en false.\n' +
    '2. Recién cuando confirme, `listo` va en true y tu mensaje es una línea avisando que arranca. ' +
    'Si en ese mismo turno además te corrigió un dato, NO pongas `listo`: anotá el cambio, volvé a ' +
    'mostrar el resumen y esperá el sí.\n' +
    'Generar le cuesta plata a la organización y varios minutos, así que la confirmación es lo que ' +
    'separa un entregable útil de uno hecho sobre un dato mal entendido.'
  );
}

/**
 * El primer mensaje del agente. **Lo arma el código, no el modelo.**
 *
 * Dos motivos, y el primero es de plata: abrir el chat no puede costar una inferencia. La pantalla
 * se abre sola cuando alguien toca la pestaña, y con el saludo generado cada apertura por curiosidad
 * se le cobra a la organización.
 *
 * El segundo es que este mensaje es el único que se puede escribir sin ambigüedad: si ya hay
 * respuestas guardadas, se muestran y se pregunta si van; si no, es la primera pregunta del
 * formulario, con su etiqueta EXACTA. Que la primera pantalla del chat y la primera etiqueta del
 * formulario digan lo mismo, palabra por palabra, es lo que hace evidente que son dos caminos a lo
 * mismo y no dos herramientas.
 */
export function mensajeDeApertura(h: Herramienta, respuestas: Record<string, string>): string {
  const campos = camposDe(h);
  const conValor = campos.filter((c) => {
    const v = respuestas[claveCorta(c.id)];
    return v !== undefined && v.trim() !== '';
  });

  if (conValor.length > 0) {
    const lista = conValor.map((c) => `· ${c.etiqueta} ${respuestas[claveCorta(c.id)]}`).join('\n');
    return (
      `Hola. Vamos con «${h.titulo}». Veo que ya tenés esto guardado:\n\n` +
      `${lista}\n\n` +
      '¿Seguimos con eso o querés cambiar algo?'
    );
  }

  const primera = campos[0];
  return (
    `Hola. Vamos con «${h.titulo}». Te voy a hacer las mismas preguntas del formulario, de a una, ` +
    `y cuando las tengamos genero tu ${h.etiquetaSalida}.\n\n` +
    `Empecemos: ${primera ? primera.etiqueta : ''}`
  );
}

/**
 * El primer mensaje cuando el agente abre CON propuestas: lo que ya estaba guardado, lo que dedujo
 * de las herramientas anteriores, y lo que todavía le falta.
 *
 * ── ESTO ES LO QUE REEMPLAZA AL FORMULARIO EN «ICP & OFERTA» ─────────────────
 *
 * Sin campos a la vista, la única forma de que la persona sepa con qué se va a generar es que el
 * agente lo DIGA antes de generar. Por eso el saludo enumera cada dato con su etiqueta de catálogo y
 * marca cuáles propuso él (para que se lean como lo que son: una deducción, no algo que alguien
 * dijo), y cierra pidiendo dos cosas concretas: confirmar lo listado y contestar lo que falta.
 *
 * Y `arranca` se encarga del resto: con las obligatorias presentes y un turno que no cambie nada, un
 * «sí» genera. Con un «cambiá el país», el agente anota y vuelve a mostrar. */
export function mensajeDeAperturaConPropuesta(
  h: Herramienta,
  guardadas: Record<string, string>,
  propuestas: Record<string, string>,
): string {
  const lineas: string[] = [];
  const faltan: string[] = [];
  for (const c of camposDe(h)) {
    const k = claveCorta(c.id);
    const g = (guardadas[k] ?? '').trim();
    const p = (propuestas[k] ?? '').trim();
    if (g !== '') lineas.push(`· ${c.etiqueta} ${g}`);
    else if (p !== '') lineas.push(`· ${c.etiqueta} ${p} (lo deduje de lo anterior)`);
    else if (!c.opcional) faltan.push(c.etiqueta);
  }

  const cabeza = `Hola. Vamos con «${h.titulo}». Con lo que ya construiste antes, esto es lo que tengo:\n\n${lineas.join('\n')}`;
  const pie =
    faltan.length > 0
      ? `\n\nMe falta: ${faltan.join(' · ')}. Contame eso, y decime si lo de arriba va bien o cambio algo.`
      : `\n\n¿Va bien así? Si confirmás, genero tu ${h.etiquetaSalida}. Si querés cambiar algo, decime qué.`;
  return cabeza + pie;
}

/**
 * El primer mensaje cuando el paso se ARMA solo: se llegó por «Continuar al paso N», la herramienta
 * no tiene entregable, y con lo heredado alcanza. No pregunta: avisa qué usa y arranca.
 *
 * Es lo que Kevin pidió del botón del método, con todas las letras: *«debe armar el ICP con los datos
 * de Tu ficha y de Research»*. Proponer y esperar un «sí» era quedarse a un paso.
 */
export function mensajeDeArranque(h: Herramienta, respuestas: Record<string, string>): string {
  const lineas = camposDe(h)
    .filter((c) => (respuestas[claveCorta(c.id)] ?? '').trim() !== '')
    .map((c) => `· ${c.etiqueta} ${respuestas[claveCorta(c.id)]}`);
  return (
    `Vamos con «${h.titulo}». Con tu ficha y tu research ya tengo lo que hace falta, así que lo armo ` +
    `ahora con esto:\n\n${lineas.join('\n')}\n\n` +
    `Generando tu ${h.etiquetaSalida}. Cuando termine, si algo no va, decímelo y lo regenero con el cambio.`
  );
}

/**
 * ¿Se puede generar? **La respuesta del modelo es un dato, no una orden.**
 *
 * ── LO QUE SE COMPRUEBA, Y LO QUE NO SE PUEDE COMPROBAR ────────────────────
 *
 * Tres condiciones, y ninguna le cree al `listo` sola:
 *
 *   1. **El agente dice que sí.** Es necesario y no alcanza.
 *
 *   2. **No falta ninguna respuesta obligatoria.** Es la misma función que decide si el botón del
 *      formulario está habilitado, así que los dos caminos exigen exactamente lo mismo. En las ocho
 *      genéricas no hay obligatorias —el formulario deja generar con campos vacíos y el entregable
 *      los marca como pendientes— y en el Research son el nicho y el trasfondo.
 *
 *   3. **Este turno no agregó información.** Ésta es la que hace que la confirmación sea
 *      estructural y no una regla de buena voluntad en el prompt: un turno que cambia una respuesta
 *      es un turno en el que la persona estaba contestando, no confirmando. El agente recién puede
 *      resumir DESPUÉS de anotarlo, así que no puede haber recibido el sí todavía.
 *
 *      Y cubre el caso que más se paga: *«dale, pero cambiá el precio a 5.000»*. Ahí hay un sí y hay
 *      un dato nuevo, y generar con el resumen viejo produce el entregable con el precio anterior.
 *      Con esto, el agente anota, vuelve a mostrar y espera — un turno más contra un entregable
 *      equivocado ya pagado.
 *
 * Lo que NO se puede comprobar acá es que la persona haya dicho que sí: eso está en un texto libre,
 * y leerlo con una expresión regular sería adivinar en el único lugar donde adivinar cuesta plata.
 * Queda del lado del modelo, con las condiciones 2 y 3 poniéndole el piso.
 */
export function arranca(
  h: Herramienta,
  turno: Turno,
  previas: Record<string, string>,
): boolean {
  if (!turno.listo) return false;
  if (faltanObligatorias(h, turno.respuestas)) return false;
  return !cambiaron(h, turno.respuestas, previas);
}

/** ¿Alguna respuesta cambió en este turno? Se compara por CATÁLOGO, con el vacío como valor. */
function cambiaron(
  h: Herramienta,
  ahora: Record<string, string>,
  antes: Record<string, string>,
): boolean {
  for (const clave of claves(h)) {
    const a = ahora[clave] ?? '';
    const b = antes[clave] ?? '';
    if (a.trim() !== b.trim()) return true;
  }
  return false;
}

/** ¿Falta alguna respuesta sin la que el entregable no se sostiene? */
export function faltanObligatorias(h: Herramienta, respuestas: Record<string, string>): boolean {
  return obligatoriosQueFaltan(h, porIdDeCampo(h, respuestas)).length > 0;
}

/**
 * Claves cortas → identificadores de campo.
 *
 * `obligatoriosQueFaltan` trabaja con los valores del FORMULARIO (`mr-niche`) y el agente con los del
 * ALMACÉN (`niche`), que es la misma traducción que `campos.ts` ya hace en las dos direcciones. Se
 * convierte acá, en una función con nombre, en vez de tener dos versiones de la regla.
 */
function porIdDeCampo(h: Herramienta, respuestas: Record<string, string>): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const campo of camposDe(h)) {
    const v = respuestas[claveCorta(campo.id)];
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
  respuestas: Record<string, string>;
  /** El contexto heredado, en texto. Ver `instruccionesDeEntrevista`. */
  contexto?: string;
  /** El entregable ya generado de esta herramienta, si existe. Ver `instruccionesDeEntrevista`. */
  entregable?: string;
}): Promise<ResultadoDeConversacion> {
  const cola = opciones.mensajes.slice(-TURNOS_QUE_VE_EL_MODELO);

  const cuerpo: Record<string, unknown> = {
    model: MODELO,
    max_tokens: TECHO_DE_TOKENS,
    system: instruccionesDeEntrevista(
      opciones.herramienta,
      opciones.respuestas,
      opciones.contexto ?? '',
      opciones.entregable ?? '',
    ),
    messages: cola.map((m) => ({ role: m.role, content: m.content })),
    tools: [
      {
        name: NOMBRE_DE_LA_HERRAMIENTA,
        description:
          'Registrá tu mensaje y el estado de las respuestas. Es la única forma de responder: no ' +
          'escribas texto suelto.',
        input_schema: esquemaDeRespuestas(opciones.herramienta),
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

  const crudas =
    entrada['respuestas'] !== null && typeof entrada['respuestas'] === 'object'
      ? (entrada['respuestas'] as Record<string, unknown>)
      : {};

  /* Se recorre el CATÁLOGO y no las claves que vinieron: una clave que el modelo inventó no entra al
     almacén, y una respuesta que no mandó queda como cadena vacía en vez de desaparecer. Lo que se
     guarda tiene la forma del formulario, siempre, venga como venga la respuesta. */
  const respuestas: Record<string, string> = {};
  for (const campo of camposDe(h)) {
    const v = crudas[claveCorta(campo.id)];
    const texto = typeof v === 'string' ? v.trim() : '';
    /* Y un desplegable solo acepta sus propios valores. El `enum` del esquema ya lo pide, y esto lo
       hace cierto: un valor inventado en un campo que enciende ramas del framework (`_isB2C`,
       `_hasProof`) no falla en ninguna parte — apaga la rama y el documento sale con otro molde. */
    if (campo.tipo === 'lista' && campo.opciones && campo.opciones.length > 0) {
      respuestas[claveCorta(campo.id)] = campo.opciones.some((o) => o.valor === texto) ? texto : '';
      continue;
    }
    respuestas[claveCorta(campo.id)] = texto;
  }

  return { mensaje, respuestas, listo: entrada['listo'] === true };
}

/** La conversación vacía, con las respuestas que ya estuvieran guardadas. */
export function chatVacio(respuestas: Record<string, string>): ChatDeHerramienta {
  return { messages: [], answers: { ...respuestas }, agent_version: VERSION_DEL_AGENTE };
}

/**
 * El primer mensaje cuando el entregable YA existe. No propone ni pregunta: ofrece.
 *
 * Abrir una herramienta ya generada con un cuestionario es lo que se vio en pantalla: el agente pidiendo
 * ingresos y edad con el avatar terminado debajo. Acá el trabajo cambió de «armarlo» a «usarlo».
 */
export function mensajeDeAperturaConEntregable(h: Herramienta, fecha: string): string {
  return (
    `Tu ${h.etiquetaSalida} ya está generado${fecha ? ` (versión del ${fecha})` : ''} — lo tenés debajo.\n\n` +
    'Preguntame lo que quieras sobre él, o decime qué cambiarle y lo regenero con el cambio.'
  );
}
