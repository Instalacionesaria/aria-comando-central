// Rellenar el formulario de una herramienta con lo que las anteriores ya produjeron.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL PROBLEMA QUE RESUELVE, REPORTADO TRES VECES
//
// *«Los datos que extrajo el Research, ¿completan el formulario del ICP?»*. No: el research entra al
// PROMPT y el formulario queda en blanco. Funciona —el avatar sale bien— y aun así está mal, por dos
// motivos que se ven en pantalla:
//
//   1. **No se puede revisar lo que no se ve.** El research eligió un segmento, dijo sus dolores y
//      su lenguaje; si nada de eso aparece en los campos, la única forma de saber con qué se va a
//      generar es leer los cinco documentos otra vez.
//   2. **Invita a reescribirlo a mano**, y a mano sale distinto de como lo nombró la investigación.
//
// El puente que ARIA-brain tiene copia UN campo —el nicho— con una expresión regular sobre el texto
// del paso 5. Se portó, y su límite se vio enseguida: sobre un research real devolvió media oración
// del medio de un párrafo. Un extractor de texto no sabe qué es un segmento; un modelo que ya está
// leyendo ese mismo texto, sí.
//
// ── LO QUE ESTO NO HACE ─────────────────────────────────────────────────────
//
// **No genera el entregable y no guarda nada.** Devuelve valores para los campos; la pantalla los
// pone en el formulario y ahí quedan, editables, hasta que la persona guarde o genere. Es la
// diferencia entre proponer y decidir, y acá importa: un dato inventado dentro de un campo se ve
// idéntico a uno que alguien escribió, así que tiene que pasar por delante de sus ojos antes de
// convertirse en la fuente de todo lo que hereda.
//
// ── QUÉ SE PUEDE PROPONER Y QUÉ NO ──────────────────────────────────────────
//
// La herramienta se fuerza con el MISMO esquema que usa el agente conversacional. La primera versión
// le prohibía deducir: «lo que el contexto no diga textualmente va vacío». Resultado medido: edad,
// país y ocupación quedaban vacíos aunque el research describiera al dueño de una agencia PPC en
// LATAM — Kevin lo llamó «muy mecánico». Ahora se le pide completar lo que el contexto SOSTIENE
// (un país que es el mercado donde se buscó, un perfil de ocupación que se desprende del segmento)
// y dejar vacío lo que no se sostiene con nada (una cifra exacta que nadie mencionó). Los valores
// caen en el formulario a la vista, así que un dato propuesto pasa por delante de los ojos de la
// persona antes de convertirse en fuente de lo que hereda.
// ═══════════════════════════════════════════════════════════════════════════════

import { ok, rechazo } from '../autorizacion/respuesta.ts';
import { camposDe, claveCorta } from './campos.ts';
import { NOMBRE_DE_LA_HERRAMIENTA, esquemaDeCampos } from './conversacion.ts';
import type { EstadoDeFundaciones } from './estado.ts';
import type { Herramienta } from './herramientas.ts';
import { pedirExterno } from '../http/cliente.ts';
import { MODELO } from './generacion.ts';
import { datosDe } from './prompts.ts';

const API = 'https://api.anthropic.com/v1/messages';
const VERSION_API = '2023-06-01';

/**
 * El techo de tokens. Son ocho campos cortos, no un entregable.
 *
 * Y el recorte del contexto: de cada fuente entran 3.000 caracteres. El research completo son cinco
 * documentos largos, y mandarlos enteros por rellenar un formulario cuesta más que la generación
 * que viene después.
 */
export const TECHO_DE_TOKENS = 2_000;
export const CARACTERES_POR_FUENTE = 3_000;

/**
 * El contexto que esta herramienta hereda, en texto. **El MISMO que lee su prompt.**
 *
 * ── LA PRIMERA VERSIÓN LEÍA MENOS QUE LA GENERACIÓN, Y SE VIO EN PANTALLA ──
 *
 * Salía de `FUENTES_POR_HERRAMIENTA`, la lista que dibuja los chips de «Hereda de». Para el ICP esa
 * lista dice solo `marketResearch` — pero el prompt del ICP (`datosDeIcp`) lee ADEMÁS la ficha de
 * negocio (`_profileContext`). Así que el relleno completaba el nicho y los dolores, que están en el
 * research, y dejaba vacío lo que estaba en la ficha. Kevin lo describió exacto: *«esto es como un
 * dominó: el ICP debe usar la información de Tu ficha y de Research»*.
 *
 * Ahora el contexto se toma del mismo constructor de datos que arma el prompt —`datosDe(id)`— y se
 * quedan las claves de contexto que ese constructor produce (`_researchContext`, `_profileContext`,
 * `_crossContext`, `_icpContext`, `_pricingContext`, `_growthContext`, `_vslCommitments`). Lo que el
 * modelo lee para proponer los campos es, por construcción, lo que va a leer para generar el
 * entregable. No puede haber una fuente que una mitad use y la otra no.
 *
 * Los valores del formulario se pasan VACÍOS al constructor: acá se quiere el contexto heredado, no
 * lo que la persona ya escribió — eso ya está en el formulario y no hay que proponérselo de vuelta.
 */
export function contextoHeredado(h: Herramienta, estado: EstadoDeFundaciones): string {
  const datos = datosDe(h.id, {}, estado);
  const partes: string[] = [];

  for (const [clave, valor] of Object.entries(datos)) {
    if (!ES_CONTEXTO.test(clave)) continue;
    if (typeof valor !== 'string' || valor.trim() === '') continue;
    partes.push(valor.slice(0, CARACTERES_POR_FUENTE));
  }

  /* Los CRITERIOS del Research —lo que la persona escribió para buscar— no viajan en ningún
     `_…Context`: los prompts leen las SALIDAS del research, no sus entradas. Pero para llenar un
     formulario son oro: «¿Cuál es tu experiencia o trasfondo?» suele decir a quién le vende y dónde,
     y el nicho escrito es la mejor pista del país y del perfil del comprador. Kevin lo pidió así —
     *«con la información que ya tiene de las 2 primeras pestañas»*— y la ficha ya entraba por
     `_profileContext`; esto es la mitad que faltaba de la segunda. */
  const criterios = Object.entries(estado.researchInputs)
    .filter(([, v]) => v && v.trim() !== '' && v !== '(no especificado)')
    .map(([k, v]) => `${k}: ${v}`);
  if (criterios.length > 0 && partes.length > 0) {
    partes.push(`CRITERIOS CON LOS QUE SE HIZO EL RESEARCH:\n${criterios.join('\n')}`);
  }

  return partes.join('\n\n');
}

/**
 * Qué claves del constructor son CONTEXTO heredado y no derivados del formulario.
 *
 * Los constructores producen dos clases de claves con guion bajo: las de contexto (`…Context` y los
 * compromisos del VSL) y los derivados de lo que la persona eligió (`_isB2C`, `_hasProof`, `_tried`,
 * `_ghlNombre`…). Los segundos no son datos de donde sacar nada: son banderas del propio formulario.
 */
const ES_CONTEXTO = /^_([a-zA-Z]+Context|vslCommitments)$/;

/** Las instrucciones. Derivadas del catálogo, como las del agente conversacional. */
export function instruccionesDeRelleno(h: Herramienta, contexto: string): string {
  const preguntas = camposDe(h)
    .map((c, i) => {
      const linea = `${i + 1}. [${claveCorta(c.id)}] ${c.etiqueta}`;
      if (c.tipo === 'lista' && c.opciones && c.opciones.length > 0) {
        return `${linea}\n   Elegir uno de: ${c.opciones.map((o) => `"${o.valor}"`).join(', ')}`;
      }
      return c.marcador ? `${linea}\n   Ejemplo del formato esperado: ${c.marcador}` : linea;
    })
    .join('\n');

  return (
    `Estás llenando el formulario de «${h.titulo}» a partir del trabajo que esta persona YA generó ` +
    'en las herramientas anteriores. No estás escribiendo el entregable: solo completás campos.\n\n' +
    `LOS CAMPOS:\n${preguntas}\n\n` +
    'REGLAS:\n' +
    '· Completá TODOS los campos que el contexto sostenga, no solo los que dice textualmente. El ' +
    'research describe a quién se le vende, dónde y en qué situación: de ahí salen el país o región ' +
    '(el mercado donde se buscó), el rango de edad y la ocupación típicos del dueño de ese segmento, ' +
    'y el rango de ingresos que el propio research menciona. Proponelos.\n' +
    '· Lo que NO podés sostener con nada del contexto va VACÍO. La diferencia: «dueños de agencias ' +
    'PPC en LATAM» sostiene un país o región y un perfil de ocupación; no sostiene una cifra exacta ' +
    'de facturación que nadie mencionó. No inventes cifras ni nombres propios.\n' +
    '· Escribí como escribiría la persona en ese campo: corto, concreto, con el formato del ejemplo. ' +
    'No copies párrafos enteros del contexto ni pegues frases a medias.\n' +
    '· Usá el lenguaje exacto del contexto cuando nombre algo (el segmento, el mecanismo, los ' +
    'dolores): es el que la investigación eligió, y reescribirlo lo desalinea de todo lo demás.\n\n' +
    `CONTEXTO YA GENERADO:\n${contexto}`
  );
}

interface BloqueDeRespuesta {
  type?: string;
  name?: string;
  input?: unknown;
}

interface RespuestaDeAnthropic {
  content?: BloqueDeRespuesta[];
  stop_reason?: string;
}

/**
 * Rellena los campos de una herramienta con su contexto heredado.
 *
 * Devuelve los valores con CLAVES CORTAS, como los guarda el almacén: la pantalla los traduce a
 * identificadores de campo con la misma función de siempre.
 */
export async function rellenarLosCampos(
  peticion: Request,
  acceso: { claveIa: string; clienteId: string },
  admitidas: readonly Herramienta[],
  leerEstado: (clienteId: string) => Promise<
    { tipo: 'datos'; datos: EstadoDeFundaciones } | { tipo: string }
  >,
): Promise<Response> {
  let cuerpo: { herramienta?: unknown };
  try {
    cuerpo = (await peticion.json()) as { herramienta?: unknown };
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON');
  }

  const id = typeof cuerpo.herramienta === 'number' ? cuerpo.herramienta : null;
  const h = id === null ? undefined : admitidas.find((x) => x.id === id);
  if (h === undefined) return rechazo('no_encontrado');

  const estado = await leerEstado(acceso.clienteId);
  if (estado.tipo !== 'datos') return rechazo('almacen_no_disponible');

  const contexto = contextoHeredado(h, (estado as { datos: EstadoDeFundaciones }).datos);
  /* Sin contexto no se llama al modelo. El prompt saldría con la sección vacía, el modelo llenaría
     los campos con lo típico del rubro —que es exactamente lo que las reglas le prohíben— y la
     inferencia se paga igual. */
  if (contexto.trim() === '') {
    return rechazo('peticion_invalida', 'Todavía no hay nada generado de donde sacar los datos.');
  }

  const r = await pedirExterno<RespuestaDeAnthropic>(API, {
    metodo: 'POST',
    cabeceras: { 'x-api-key': acceso.claveIa, 'anthropic-version': VERSION_API },
    cuerpo: {
      model: MODELO,
      max_tokens: TECHO_DE_TOKENS,
      messages: [{ role: 'user', content: instruccionesDeRelleno(h, contexto) }],
      tools: [
        {
          name: NOMBRE_DE_LA_HERRAMIENTA,
          description:
            'Registrá los valores de los campos. Es la única forma de responder: no escribas texto ' +
            'suelto.',
          input_schema: esquemaDeCampos(h),
        },
      ],
      tool_choice: { type: 'tool', name: NOMBRE_DE_LA_HERRAMIENTA },
    },
  });

  if (r.tipo === 'rechazado') {
    console.error(
      `relleno: el modelo rechazó · ${r.estado} ${r.codigo} · ${r.detalle ?? 'sin motivo'}`,
    );
    return rechazo('modelo_no_disponible', r.detalle ?? r.codigo);
  }
  if (r.tipo === 'sin_respuesta') return rechazo('modelo_no_disponible', 'sin respuesta');
  if (r.datos.stop_reason === 'max_tokens') {
    return rechazo('modelo_no_disponible', 'respuesta truncada');
  }

  const bloques = Array.isArray(r.datos.content) ? r.datos.content : [];
  const usada = bloques.find((b) => b.type === 'tool_use' && b.name === NOMBRE_DE_LA_HERRAMIENTA);
  if (usada === undefined || usada.input === null || typeof usada.input !== 'object') {
    return rechazo('modelo_no_disponible', 'respuesta sin estructura');
  }

  /* Se recorre el CATÁLOGO y no lo que vino: una clave inventada no entra al formulario, y un campo
     que el modelo no mandó queda vacío en vez de desaparecer. Es la misma lectura que hace el agente
     conversacional, y por el mismo motivo. */
  const crudos = usada.input as Record<string, unknown>;
  const valores: Record<string, string> = {};
  for (const campo of camposDe(h)) {
    const v = crudos[claveCorta(campo.id)];
    const texto = typeof v === 'string' ? v.trim() : '';
    if (campo.tipo === 'lista' && campo.opciones && campo.opciones.length > 0) {
      valores[claveCorta(campo.id)] = campo.opciones.some((o) => o.valor === texto) ? texto : '';
      continue;
    }
    valores[claveCorta(campo.id)] = texto;
  }

  return ok({ valores });
}
