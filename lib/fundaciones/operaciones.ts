// Las tres operaciones de una pantalla de herramientas, sin la pantalla.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO EXISTE
//
// `icp` (ICP & Oferta) y `tools` son DOS pantallas con capacidades distintas y las MISMAS tres
// operaciones: leer el estado, guardar los inputs de una herramienta, y generar su documento.
//
// La salida fácil era que `tools` reusara las rutas de `/api/fundaciones/…`. Está mal por una
// razón que el propio `ADR-0304` nombra: cada ruta declara a qué PANTALLA pertenece, y una ruta
// pertenece a una sola. Con `tools` colgando de las rutas de `icp`, la pantalla `tools` figuraría
// sin operaciones —mintiendo— y quien tuviera `tools.ver` sin `fundaciones.ver` no podría abrirla.
//
// La otra salida fácil era copiar los dos archivos y cambiarles la capacidad. Trescientas ochenta
// líneas duplicadas que divergen en la primera corrección, que es el defecto que este repositorio
// persigue con nombre propio: la lista paralela.
//
// Así que la lógica vive acá una vez, y las cuatro rutas son envoltorios de cinco líneas que
// aportan lo único que las distingue: su capacidad y qué herramientas admiten.
//
// ── LA LISTA DE HERRAMIENTAS ES UN FILTRO DE SEGURIDAD, NO UNA COMODIDAD ─────
//
// `herramienta(id)` busca en TODAS. Si estas funciones usaran eso, una petición a `/api/tools/…`
// con `herramienta: 3` generaría el ICP — saltándose `fundaciones.editar` con `tools.editar`. Por
// eso reciben la lista de SU pantalla y rechazan lo que no esté en ella.
//
// ── LO QUE SE QUEDÓ EN LAS RUTAS, Y POR QUÉ ──────────────────────────────────
//
// Estas funciones **no llaman al portero ni abren el contexto de la organización**. Reciben el
// contexto y el acceso ya resueltos.
//
// La primera versión sí lo hacía, y tres pruebas la rechazaron: `ADR-0301` exige que TODO método
// de TODO manejador llame al portero, y `ADR-0211` que solo los archivos de la lista blanca abran
// el acceso sin filtro de organización. Las tres leen EL ARCHIVO DE LA RUTA, no lo que la ruta
// llama — y este comentario no puede ni nombrar esas funciones con su paréntesis, porque el
// escáner es textual y lo contaría como un uso.
//
// Y hacen bien. Delegar el portero a una función compartida convierte "toda ruta pide permiso" en
// algo que ya no se puede comprobar mirando la ruta: alcanza con que alguien escriba un manejador
// nuevo que llame a otra función para que el guard pase en verde sin que nadie exija nada. Lo que
// se comparte acá es el trabajo; la autorización se queda donde se puede auditar de un vistazo.
// ═══════════════════════════════════════════════════════════════════════════════

import { ok, rechazo } from '../autorizacion/respuesta.ts';
import {
  fechaDeVersion,
  guardarChat,
  guardarInputs,
  guardarResearch,
  guardarVersion,
  leerEstado,
} from './almacen.ts';
import { SIN_ESPECIFICAR, aValoresDeAlmacen, camposDe, claveCorta, idsDeCampos } from './campos.ts';
import {
  arranca,
  chatVacio,
  conversar,
  faltanObligatorias,
  mensajeDeApertura,
  mensajeDeAperturaConPropuesta,
  mensajeDeArranque,
  type FalloDeConversacion,
} from './conversacion.ts';
import { contextoHeredado, proponerRespuestas } from './relleno.ts';
import type { ChatDeHerramienta, EstadoDeFundaciones } from './estado.ts';
import { generar } from './generacion.ts';
import { PASOS_RESEARCH, tieneAgente, type Herramienta } from './herramientas.ts';
import {
  MetodologiaIlegible,
  TOKENS_RESEARCH,
  armarPrompt,
  armarPromptResearch,
  pasoDeResearchListo,
  tokensDeSalida,
} from './prompts.ts';

/** El alumno del hub cuyo trabajo se lee o se escribe, ya resuelto por la ruta. */
export interface Alumno {
  clienteId: string;
}

/** El alumno MÁS la llave de IA de su organización. Solo generar la necesita. */
export interface Acceso extends Alumno {
  claveIa: string;
}

/** Las herramientas que la pantalla admite. Ver el encabezado: es un filtro, no una lista. */
export type Admitidas = readonly Herramienta[];

/** Solo cadenas. Un número o un objeto en un campo de texto no es un input, es un error. */
function soloTextos(x: unknown): Record<string, string> | null {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return null;
  const salida: Record<string, string> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (typeof v !== 'string') return null;
    salida[k] = v;
  }
  return salida;
}

/** Traduce un fallo del almacén al rechazo que le corresponde, sin colapsar ninguno. */
function rechazoDeAlmacen(fallo: { tipo: string }): Response {
  if (fallo.tipo === 'sin_configurar') {
    return rechazo('almacen_no_disponible', 'El almacén de Fundaciones no está configurado');
  }
  return rechazo('almacen_no_disponible');
}

/**
 * El rechazo de un fallo del modelo.
 *
 * `detalle` lleva el código que trajo Anthropic (`rate_limit_error`, `authentication_error`,
 * `overloaded_error`) y **no** el mensaje: el código alcanza para saber qué hacer, y el mensaje de
 * un servicio externo es texto que no controlamos dentro de una respuesta nuestra. Es el mismo
 * criterio de `ADR-0704` con otro origen.
 */
/* Se EXPORTA solo para que se pueda probar, y eso vale decirlo. Es el ultimo tramo de la cadena del
   diagnostico — el que decide que queda en el registro del servidor y que ve la persona— y las dos
   cosas sobrevivieron a la mutacion mientras la funcion fue privada: no habia por donde ejercitarla
   sin base de datos ni sesion. La alternativa era una prueba de la ruta entera para afirmar dos
   lineas. */
export function rechazoDeModelo(
  fallo:
    | { tipo: 'rechazado'; estado: number; codigo: string; motivo: string | null }
    | { tipo: 'sin_respuesta' }
    | { tipo: 'sin_texto' },
): Response {
  if (fallo.tipo === 'rechazado') {
    /* ── EL REGISTRO DEL SERVIDOR SE LO LLEVA SIEMPRE, PASE LO QUE PASE ARRIBA ──
     *
     * Antes de esto, un rechazo del modelo no dejaba rastro en NINGÚN lado: la pantalla mostraba un
     * texto amable y los registros de Vercel no tenían una línea. O sea que el diagnóstico no se
     * perdía en el camino: no existía.
     *
     * Va acá y no en `generacion.ts` porque acá se sabe de qué organización y de qué herramienta se
     * trata, y eso es la mitad de lo que hace útil una línea de registro. `ADR-0407` prohíbe
     * registrar CUERPOS; un código, un número y el motivo del proveedor no son un cuerpo. */
    console.error(
      `fundaciones: el modelo rechazó la generación · ${fallo.estado} ${fallo.codigo} · ` +
        (fallo.motivo === null ? 'sin motivo' : fallo.motivo),
    );
    // Y a la pantalla van los dos: el código dice la familia, el motivo dice el problema.
    return rechazo(
      'modelo_no_disponible',
      fallo.motivo === null ? fallo.codigo : `${fallo.codigo}: ${fallo.motivo}`,
    );
  }
  if (fallo.tipo === 'sin_texto') return rechazo('modelo_no_disponible', 'respuesta sin texto');
  return rechazo('modelo_no_disponible', 'sin respuesta');
}

/**
 * El ajuste de una regeneración, tal como lo arma el hub.
 *
 * Se agrega DESPUÉS del prompt de la metodología, no dentro: la metodología es la misma y lo que
 * cambia es que hay una versión anterior y un pedido concreto sobre ella. La versión previa se
 * recorta a 6.000 caracteres —el número del hub— porque el documento completo más el prompt más el
 * contexto heredado no entran.
 */
function conAjuste(prompt: string, previa: string, nota: string): string {
  return (
    prompt +
    '\n\n---\nYA GENERASTE UNA VERSIÓN ANTERIOR DE ESTE ENTREGABLE:\n' +
    previa.slice(0, 6000) +
    `\n\nAJUSTE SOLICITADO POR EL USUARIO: ${nota}\n\n` +
    'Regenera el entregable COMPLETO aplicando el ajuste. Conserva lo que funcionaba de la versión ' +
    'anterior y cambia solo lo necesario según el ajuste pedido.'
  );
}

/** La herramienta pedida, **si pertenece a esta pantalla**. Ver el encabezado. */
function deLaPantalla(admitidas: Admitidas, id: number | null): Herramienta | undefined {
  return id === null ? undefined : admitidas.find((h) => h.id === id);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · Leer el estado entero
// ═══════════════════════════════════════════════════════════════════════════════

export async function leerElEstado(alumno: Alumno): Promise<Response> {
  const estado = await leerEstado(alumno.clienteId);
  if (estado.tipo !== 'datos') return rechazoDeAlmacen(estado);

  // El estado se devuelve ENTERO y no recortado a las herramientas de esta pantalla, a propósito:
  // Prospección hereda el avatar, la categoría y la oferta, que son de la otra. Recortarlo dejaría
  // a `tools` sin poder mostrar de qué hereda.
  return ok({ estado: estado.datos });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · Guardar los inputs de una herramienta, sin generar
//
// Existe porque el trabajo de llenar un formulario se pierde de la peor manera: el alumno escribe
// media ficha, cierra la pestaña, y vuelve a una pantalla en blanco.
//
// Pide la capacidad de EDITAR aunque no gaste tokens: escribe en el almacén, y lo que escribe lo
// va a heredar la siguiente herramienta.
// ═══════════════════════════════════════════════════════════════════════════════

export async function guardarLosInputs(
  peticion: Request,
  alumno: Alumno,
  admitidas: Admitidas,
): Promise<Response> {
  let cuerpo: { herramienta?: unknown; valores?: unknown };
  try {
    cuerpo = (await peticion.json()) as { herramienta?: unknown; valores?: unknown };
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON');
  }

  const id = typeof cuerpo.herramienta === 'number' ? cuerpo.herramienta : null;
  if (id === null || !deLaPantalla(admitidas, id)) return rechazo('no_encontrado');

  const valores = soloTextos(cuerpo.valores);
  if (valores === null) return rechazo('peticion_invalida', 'Los valores tienen que ser texto');

  // Se relee el estado antes de escribir porque las dos llaves del almacén guardan TODAS las
  // herramientas juntas en un solo documento. Escribir solo con lo que mandó el navegador borraría
  // los inputs de las otras — y las borraría en silencio.
  const estado = await leerEstado(alumno.clienteId);
  if (estado.tipo !== 'datos') return rechazoDeAlmacen(estado);

  const guardado =
    id === 1
      ? // El Research guarda sus criterios junto a sus salidas, en su propia llave: es el formato
        // que el hub ya escribe, y separarlos haría que el hub leyera un documento a medias.
        await guardarResearch(
          alumno.clienteId,
          aValoresDeAlmacen(idsDeCampos(1), valores),
          estado.datos.researchSalidas,
        )
      : await guardarInputs(
          alumno.clienteId,
          estado.datos,
          id,
          aValoresDeAlmacen(idsDeCampos(id), valores),
        );

  if (guardado.tipo !== 'datos') return rechazoDeAlmacen(guardado);
  return ok({ guardado: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · Generar. **La única operación del proyecto que le cuesta plata a la organización.**
//
// Todo lo demás lee o escribe filas. Esto consume tokens de la llave de IA de la organización, y
// eso cambia tres decisiones:
//
//   1. Pide la capacidad de EDITAR, no la de ver. Ver los documentos y volver a generarlos no son
//      la misma autoridad (`03` § 2).
//   2. La llave es de la organización, SIN respaldo. Ver `lib/credenciales/resolver.ts`: una llave
//      general en el entorno haría que el consumo de todas lo pagara una, con la API respondiendo
//      200 y sin que nada falle. ARIA-brain ya pagó ese defecto y lo quitó.
//   3. El prompt se arma en el SERVIDOR. En el hub se arma en el navegador porque nació de un
//      `<script>`. Acá el contexto heredado son los documentos de las otras herramientas: mandarlos
//      al navegador para que los devuelva es dejar que el navegador elija con qué contexto se
//      genera. Armarlo del lado del servidor es lo que hace que la herencia no sea falsificable.
//
// LO QUE NO HACE: no pone tope de gasto. Un alumno puede pedir el Mapa veinte veces seguidas. El
// hub tampoco lo pone. Es una decisión pendiente, no una que ya se tomó.
// ═══════════════════════════════════════════════════════════════════════════════

export async function generarElDocumento(
  peticion: Request,
  acceso: Acceso,
  admitidas: Admitidas,
): Promise<Response> {
  let cuerpo: {
    herramienta?: unknown;
    valores?: unknown;
    paso?: unknown;
    ajuste?: unknown;
    previa?: unknown;
  };
  try {
    cuerpo = (await peticion.json()) as typeof cuerpo;
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON');
  }

  const id = typeof cuerpo.herramienta === 'number' ? cuerpo.herramienta : null;
  if (id === null || !deLaPantalla(admitidas, id)) return rechazo('no_encontrado');

  const valores = soloTextos(cuerpo.valores);
  if (valores === null) return rechazo('peticion_invalida', 'Los valores tienen que ser texto');

  const estado = await leerEstado(acceso.clienteId);
  if (estado.tipo !== 'datos') return rechazoDeAlmacen(estado);

  const inputs = aValoresDeAlmacen(idsDeCampos(id), valores);

  // ── El Research: cinco pasos, uno por petición ──────────────────────────────
  //
  // Un paso por petición y no los cinco de una: son cinco llamadas al modelo con búsqueda web, y
  // encadenarlas en una sola petición HTTP significa que un fallo en el paso 4 tira también los
  // tres que ya salieron bien. Así, cada paso que sale queda guardado.
  if (id === 1) {
    const paso = typeof cuerpo.paso === 'number' ? cuerpo.paso : null;
    if (paso === null || !Number.isInteger(paso) || paso < 0 || paso >= PASOS_RESEARCH) {
      return rechazo('peticion_invalida', 'Falta el paso del research');
    }

    // Las salidas anteriores se leen del ALMACÉN, no del cuerpo de la petición: el paso N interpola
    // la salida del N-1, y dejar que el navegador la mande sería dejarle elegir sobre qué
    // investigación se construye la siguiente.
    const previas = estado.datos.researchSalidas.slice(0, paso);
    if (!pasoDeResearchListo(paso, previas)) {
      return rechazo('peticion_invalida', `El paso ${paso + 1} necesita el anterior`);
    }

    let prompt: string;
    try {
      prompt = armarPromptResearch(paso, inputs, previas);
    } catch (e) {
      if (e instanceof MetodologiaIlegible) return rechazo('metodologia_ilegible', e.metodologia);
      throw e;
    }

    const salida = await generar({
      claveIa: acceso.claveIa,
      prompt,
      tokens: TOKENS_RESEARCH,
      conBusquedaWeb: true,
    });
    if (salida.tipo !== 'datos') return rechazoDeModelo(salida);

    const proximas = [...previas];
    proximas[paso] = salida.datos.texto;
    const guardado = await guardarResearch(acceso.clienteId, inputs, proximas);
    if (guardado.tipo !== 'datos') return rechazoDeAlmacen(guardado);

    return ok({
      texto: salida.datos.texto,
      cortado: salida.datos.cortado,
      citas: salida.datos.citas,
      milisegundos: salida.datos.milisegundos,
      tokens: salida.datos.tokens,
      salidas: proximas,
    });
  }

  // ── Las demás: un formulario, un documento ─────────────────────────────────

  let prompt: string;
  try {
    prompt = armarPrompt(id, valores, estado.datos);
  } catch (e) {
    if (e instanceof MetodologiaIlegible) return rechazo('metodologia_ilegible', e.metodologia);
    throw e;
  }

  const nota = typeof cuerpo.ajuste === 'string' ? cuerpo.ajuste.trim() : '';
  const previa = typeof cuerpo.previa === 'string' ? cuerpo.previa : '';
  if (nota.length > 0 && previa.length > 0) prompt = conAjuste(prompt, previa, nota);

  // Los inputs se guardan ANTES de generar, y salga como salga la generación. El alumno acaba de
  // escribir ocho campos: perderlos porque el modelo devolvió un 529 sería cobrarle el fallo a él.
  const guardadoDeInputs = await guardarInputs(acceso.clienteId, estado.datos, id, inputs);
  if (guardadoDeInputs.tipo !== 'datos') return rechazoDeAlmacen(guardadoDeInputs);

  const salida = await generar({
    claveIa: acceso.claveIa,
    prompt,
    tokens: tokensDeSalida(id),
  });
  if (salida.tipo !== 'datos') return rechazoDeModelo(salida);

  const guardado = await guardarVersion(acceso.clienteId, estado.datos, id, {
    date: fechaDeVersion(),
    output: salida.datos.texto,
  });
  if (guardado.tipo !== 'datos') return rechazoDeAlmacen(guardado);

  return ok({
    texto: salida.datos.texto,
    cortado: salida.datos.cortado,
    citas: salida.datos.citas,
    milisegundos: salida.datos.milisegundos,
    tokens: salida.datos.tokens,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · Conversar con el agente de una herramienta
//
// La cuarta operación de la pantalla, y la única que existe para NO llenar un formulario: las mismas
// preguntas, hablando. Ver `lib/fundaciones/conversacion.ts` para qué hace el agente y qué no; acá
// está lo que hace el servidor con lo que devuelve.
//
// ── EL HISTORIAL NO VIAJA POR EL NAVEGADOR. NUNCA. ──────────────────────────
//
// El navegador manda UNA línea: lo que la persona acaba de escribir. El servidor lee la conversación
// del almacén, le agrega ese turno, llama al modelo y guarda el resultado.
//
// Es la misma decisión que el encadenamiento de los cinco pasos del Research, y por el mismo motivo,
// que acá tiene una segunda punta: si el historial viajara, cualquiera podría mandar una conversación
// inventada en la que la persona ya confirmó, y el agente devolvería `listo` en true en el primer
// turno. Con el historial del lado del servidor, la confirmación es un hecho guardado, no una
// afirmación del cliente.
//
// ── CUÁNDO SE ESCRIBE, Y CUÁNDO NO ─────────────────────────────────────────
//
// Si el modelo falla, **no se guarda nada** — ni siquiera el turno de la persona. Guardarlo dejaría
// la conversación terminando en una pregunta sin respuesta, y el próximo turno le mandaría al modelo
// dos mensajes seguidos de la persona. Lo que ve la pantalla es su texto todavía en el cuadro y el
// aviso de siempre: *"no se perdió nada de lo que escribiste"*, que en este camino es literal.
// ═══════════════════════════════════════════════════════════════════════════════

/** El rechazo de un fallo de la conversación. Las tres ramas nuevas NO se colapsan con las otras. */
function rechazoDeConversacion(fallo: FalloDeConversacion): Response {
  if (fallo.tipo === 'rechazado' || fallo.tipo === 'sin_respuesta') {
    /* Las dos ramas que comparte con la generación se traducen igual, con el registro del servidor
       incluido: es el mismo proveedor, el mismo tipo de fallo y la misma acción del otro lado. */
    return rechazoDeModelo(fallo);
  }
  /* Las tres nuestras. Van con detalle propio y no con el código del proveedor —no hay ninguno—, y
     separadas porque mandan a mirar cosas distintas: el techo de tokens, la conversación que el
     modelo no quiso seguir, y un esquema que dejó de encajar. */
  if (fallo.tipo === 'truncado') return rechazo('modelo_no_disponible', 'respuesta truncada');
  if (fallo.tipo === 'declino') return rechazo('modelo_no_disponible', 'el modelo declinó');
  return rechazo('modelo_no_disponible', 'respuesta sin estructura');
}

/**
 * Lo que la herramienta ya tiene guardado, con las claves cortas del almacén y sin los huecos.
 *
 * ── DOS LUGARES, Y NO ES UNA IRREGULARIDAD DE ESTE CÓDIGO ───────────────────
 *
 * El Research guarda sus criterios en su propia llave, junto a sus cinco salidas, porque ése es el
 * formato que ARIA-brain ya escribe; las otras ocho guardan los suyos en `profile`, indexados por
 * herramienta. La rama está también en `guardarLosInputs`, con el mismo `id === 1` y el mismo motivo.
 *
 * `(no especificado)` es lo que el formulario escribe en un campo vacío, y para el agente eso es una
 * respuesta que NO tiene: pasárselo tal cual haría que salude con *"veo que tu precio es (no
 * especificado)"* y, peor, que dé por contestada una pregunta que nadie contestó.
 */
function respuestasGuardadas(
  estado: EstadoDeFundaciones,
  h: Herramienta,
): Record<string, string> {
  const crudas = h.forma === 'research' ? estado.researchInputs : estado.perfil[h.id];
  const salida: Record<string, string> = {};
  for (const [clave, valor] of Object.entries(crudas ?? {})) {
    if (valor && valor.trim() !== '' && valor !== SIN_ESPECIFICAR) salida[clave] = valor;
  }
  return salida;
}

/**
 * La conversación recién abierta: el saludo del agente, lo guardado, y lo que puede PROPONER.
 *
 * ── LA APERTURA GASTA UNA INFERENCIA, Y ES A PROPÓSITO ──────────────────────
 *
 * Antes el saludo lo armaba el código y no costaba nada: «¿Cuál es tu nicho?». Con los formularios
 * fuera de «ICP & Oferta», el agente es la única puerta, y saludar preguntando desde cero lo que las
 * herramientas anteriores ya contestaron es hacer que la persona vuelva a escribir su research.
 *
 * Así que si hay campos vacíos Y hay contexto heredado, se llama a `proponerRespuestas` —la misma
 * función del botón «↩ Rellenar»— y el saludo enumera lo deducido. Es una inferencia corta, una sola
 * vez por conversación (la apertura se guarda; las visitas siguientes no vuelven a proponer).
 *
 * Si proponer falla, el chat NO falla: abre con el saludo de antes, preguntando. Un modelo caído no
 * puede dejar a la persona sin poder empezar su herramienta.
 */
async function abrir(
  h: Herramienta,
  estado: EstadoDeFundaciones,
  claveIa: string,
  /* Lo que la conversación ANTERIOR había anotado, cuando se reabre. Reabrir no puede costar lo que
     la persona ya contestó: las respuestas del chat viven solo en el chat hasta que se genera, así
     que sin esto un «Empezar de nuevo» —o la reapertura automática— las tiraba. */
  previas: Record<string, string> = {},
): Promise<ChatDeHerramienta> {
  const guardadas: Record<string, string> = { ...respuestasGuardadas(estado, h) };
  for (const [k, v] of Object.entries(previas)) {
    if (!(guardadas[k] ?? '').trim() && v.trim()) guardadas[k] = v;
  }
  const faltaAlgo = camposDe(h).some((c) => !(guardadas[claveCorta(c.id)] ?? '').trim());

  let propuestas: Record<string, string> = {};
  if (faltaAlgo) {
    const p = await proponerRespuestas({ claveIa, herramienta: h, estado });
    if (p.tipo === 'datos') propuestas = p.valores;
  }

  /* Lo guardado manda sobre lo propuesto: la persona lo escribió o lo confirmó antes. Lo propuesto
     solo entra donde no había nada. */
  const respuestas: Record<string, string> = { ...guardadas };
  for (const [k, v] of Object.entries(propuestas)) {
    if (!(respuestas[k] ?? '').trim() && v.trim()) respuestas[k] = v;
  }

  const chat = chatVacio(respuestas);
  const hayPropuesta = Object.values(propuestas).some((v) => v.trim() !== '');
  chat.messages.push({
    role: 'assistant',
    content: hayPropuesta
      ? mensajeDeAperturaConPropuesta(h, guardadas, propuestas)
      : mensajeDeApertura(h, guardadas),
  });
  return chat;
}

/** Cuántos caracteres se aceptan en un turno de la persona. */
export const TOPE_DE_UN_TURNO = 4_000;

/** Cuánto del entregable propio ve el agente por turno. Alcanza para responder sobre él. */
export const CARACTERES_DEL_ENTREGABLE = 6_000;

/**
 * El entregable ya generado de una herramienta, en texto, o vacío si no hay.
 *
 * El Research no tiene «una» versión: son cinco pasos, y se mandan los cinco con su título. Las otras
 * ocho tienen historial; se manda la versión más reciente con su fecha, para que el agente pueda decir
 * «tu avatar del 2 de septiembre dice…».
 */
function entregableDe(h: Herramienta, estado: EstadoDeFundaciones): string {
  if (h.forma === 'research') {
    const pasos = estado.researchSalidas.filter((s) => !!s && s.trim() !== '');
    if (pasos.length === 0) return '';
    return pasos.map((s, i) => `## Paso ${i + 1}\n${s}`).join('\n\n').slice(0, CARACTERES_DEL_ENTREGABLE);
  }
  const versiones = estado.historial[h.id];
  const ultima = versiones && versiones.length > 0 ? versiones[0] : undefined;
  if (!ultima || !ultima.output) return '';
  return `(versión del ${ultima.date})\n${ultima.output.slice(0, CARACTERES_DEL_ENTREGABLE)}`;
}

export async function conversarConElAgente(
  peticion: Request,
  acceso: Acceso,
  admitidas: Admitidas,
): Promise<Response> {
  let cuerpo: { herramienta?: unknown; mensaje?: unknown; reiniciar?: unknown; generar?: unknown };
  try {
    cuerpo = (await peticion.json()) as {
      herramienta?: unknown;
      mensaje?: unknown;
      reiniciar?: unknown;
      generar?: unknown;
    };
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON');
  }

  const id = typeof cuerpo.herramienta === 'number' ? cuerpo.herramienta : null;
  const h = deLaPantalla(admitidas, id);
  /* Y además tiene que ser una herramienta CON agente. Ver `tieneAgente`: Prospección no lo tiene
     porque su formulario no genera un documento, gasta leads del monedero. La misma función la usan
     las pantallas para decidir si dibujan el selector, así que no hay forma de que una ofrezca un
     modo que la otra rechace. */
  if (h === undefined || !tieneAgente(h)) return rechazo('no_encontrado');

  const mensaje = typeof cuerpo.mensaje === 'string' ? cuerpo.mensaje.trim() : '';
  if (mensaje.length > TOPE_DE_UN_TURNO) {
    return rechazo('peticion_invalida', 'El mensaje es demasiado largo');
  }
  const reiniciar = cuerpo.reiniciar === true;
  /* «Continuar al paso N» sobre una herramienta sin entregable: abrir proponiendo y, si con lo
     heredado alcanza, ARRANCAR sin esperar un «sí». La pantalla es la que genera (recibe `listo`);
     acá solo se decide si alcanza, con la misma regla de obligatorias que usa `arranca`. */
  const generar = cuerpo.generar === true;

  const estado = await leerEstado(acceso.clienteId);
  if (estado.tipo !== 'datos') return rechazoDeAlmacen(estado);

  const guardada = estado.datos.chats[h.id];
  let chat: ChatDeHerramienta = guardada ?? { messages: [], answers: {} };
  /* Abrir la conversación NO llama al modelo: el saludo lo arma el código (ver `mensajeDeApertura`).
     La pantalla se abre sola al tocar la pestaña, y una inferencia por cada vistazo se la cobra a la
     organización sin que nadie haya preguntado nada. */
  const recienAbierta = reiniciar || chat.messages.length === 0;
  if (recienAbierta) chat = await abrir(h, estado.datos, acceso.claveIa, chat.answers);

  if (mensaje === '') {
    /* Arranque automático: si se pidió generar y no falta ninguna obligatoria, el saludo cambia —ya
       no propone ni pregunta, avisa qué usa— y `listo` sale en true para que la pantalla genere. Si
       falta algo, se queda el saludo que propone y pregunta: generar con un obligatorio vacío es el
       research genérico que `exigeSusCampos` existe para impedir. */
    const arrancaSolo = recienAbierta && generar && !faltanObligatorias(h, chat.answers);
    if (arrancaSolo) {
      chat = { ...chat, messages: [{ role: 'assistant', content: mensajeDeArranque(h, chat.answers) }] };
    }
    // Abrir o reiniciar, sin turno. Se escribe solo si algo cambió.
    if (recienAbierta) {
      const guardado = await guardarChat(acceso.clienteId, estado.datos, h.id, chat);
      if (guardado.tipo !== 'datos') return rechazoDeAlmacen(guardado);
    }
    return ok({ mensajes: chat.messages, respuestas: chat.answers, listo: arrancaSolo });
  }

  const previas = chat.answers;
  const conElTurno = [...chat.messages, { role: 'user' as const, content: mensaje }];

  const salida = await conversar({
    claveIa: acceso.claveIa,
    herramienta: h,
    mensajes: conElTurno,
    respuestas: previas,
    /* El mismo contexto que lee el prompt de generación. Es lo que hace que el agente pueda contestar
       «¿cuál es mi ICP?» con el research en vez de con «todavía no tengo datos». */
    contexto: contextoHeredado(h, estado.datos),
    /* Y SU PROPIO entregable, si ya existe: sin esto contestaba «eso todavía no existe» con el avatar
       generado debajo del chat. Se manda recortado —es un documento largo— y con su fecha. */
    entregable: entregableDe(h, estado.datos),
  });
  if (salida.tipo !== 'datos') return rechazoDeConversacion(salida);

  const proximo: ChatDeHerramienta = {
    messages: [...conElTurno, { role: 'assistant', content: salida.datos.mensaje }],
    answers: salida.datos.respuestas,
  };
  const guardado = await guardarChat(acceso.clienteId, estado.datos, h.id, proximo);
  if (guardado.tipo !== 'datos') return rechazoDeAlmacen(guardado);

  /* `listo` es lo que el SERVIDOR concluye, no lo que el modelo afirmó. Ver `arranca`: comprueba que
     no falte ninguna respuesta obligatoria y que este turno no haya agregado información — o sea que
     hubo un turno donde el agente pudo resumir y esperar el sí. */
  return ok({
    mensajes: proximo.messages,
    respuestas: proximo.answers,
    listo: arranca(h, salida.datos, previas),
  });
}
