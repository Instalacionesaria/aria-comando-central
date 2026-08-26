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
  guardarInputs,
  guardarResearch,
  guardarVersion,
  leerEstado,
} from './almacen.ts';
import { aValoresDeAlmacen, idsDeCampos } from './campos.ts';
import { generar } from './generacion.ts';
import { PASOS_RESEARCH, type Herramienta } from './herramientas.ts';
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
function rechazoDeModelo(
  fallo: { tipo: 'rechazado'; codigo: string } | { tipo: 'sin_respuesta' } | { tipo: 'sin_texto' },
): Response {
  if (fallo.tipo === 'rechazado') return rechazo('modelo_no_disponible', fallo.codigo);
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
