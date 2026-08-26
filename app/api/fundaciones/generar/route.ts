// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0604 — Sin credencial, la organización no opera y lo dice.
// ADR-0704 — Las respuestas de error no revelan estructura.
//
// Generar un entregable de Fundaciones. Es la operación que gasta dinero.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA ÚNICA OPERACIÓN DEL PROYECTO QUE LE CUESTA PLATA A LA ORGANIZACIÓN
//
// Todo lo demás lee o escribe filas. Esto consume tokens de la llave de IA de la organización, y
// eso cambia tres decisiones:
//
//   1. **Pide `fundaciones.editar`, no `fundaciones.ver`.** Ver los siete documentos y volver a
//      generarlos no son la misma autoridad, y el `03` § 2 da el criterio: existe un rol plausible
//      que necesite lo primero y no lo segundo — un coach preparando un kickoff.
//   2. **La llave es de la organización, sin respaldo.** Ver `lib/credenciales/resolver.ts`: una
//      llave general en el entorno haría que el consumo de todas las organizaciones lo pagara una,
//      con la API respondiendo 200 y sin que nada falle. ARIA-brain ya pagó ese defecto y lo quitó.
//   3. **El prompt se arma acá y no en el navegador.** En el hub se arma en el cliente, porque el
//      hub nació de un `<script>`. Acá el contexto heredado son los documentos de las otras seis
//      herramientas: mandarlos al navegador para que los devuelva significa dejar que el navegador
//      elija con qué contexto se genera. Armarlo del lado del servidor, leyendo el estado del
//      almacén, es lo que hace que la herencia no sea falsificable.
//
// ── LO QUE ESTA RUTA NO HACE, Y HAY QUE DECIRLO ──────────────────────────────
//
// No pone tope de gasto. Un alumno puede pedir el Mapa veinte veces seguidas y son veinte
// generaciones de 16.000 tokens contra la llave de su organización. El hub tampoco lo pone. Está
// anotado en `docs/ETAPA-9.md` como lo que es: una decisión pendiente, no una que ya se tomó.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { resolverAccesoAFundaciones } from '../../../../lib/credenciales/resolver.ts';
import {
  fechaDeVersion,
  guardarInputs,
  guardarResearch,
  guardarVersion,
  leerEstado,
} from '../../../../lib/fundaciones/almacen.ts';
import { aValoresDeAlmacen, idsDeCampos } from '../../../../lib/fundaciones/campos.ts';
import { generar } from '../../../../lib/fundaciones/generacion.ts';
import { PASOS_RESEARCH, herramienta } from '../../../../lib/fundaciones/herramientas.ts';
import {
  MetodologiaIlegible,
  TOKENS_RESEARCH,
  armarPrompt,
  armarPromptResearch,
  pasoDeResearchListo,
  tokensDeSalida,
} from '../../../../lib/fundaciones/prompts.ts';

export const PANTALLA = 'icp';

/** Una generación de 16.000 tokens tarda minutos. Ver la nota en `estado/route.ts`. */
export const maxDuration = 300;

/**
 * El ajuste de una regeneración, tal como lo arma el hub.
 *
 * Se agrega DESPUÉS del prompt de la metodología, no dentro: la metodología es la misma y lo que
 * cambia es que hay una versión anterior y un pedido concreto sobre ella. La versión previa se
 * recorta a 6.000 caracteres — el número del hub — porque el documento completo más el prompt más el
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

interface CuerpoDeGeneracion {
  herramienta?: unknown;
  valores?: unknown;
  paso?: unknown;
  ajuste?: unknown;
  previa?: unknown;
}

function soloTextos(x: unknown): Record<string, string> | null {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return null;
  const salida: Record<string, string> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (typeof v !== 'string') return null;
    salida[k] = v;
  }
  return salida;
}

function rechazoDeAlmacen(fallo: { tipo: string }): Response {
  if (fallo.tipo === 'sin_configurar') {
    return rechazo('almacen_no_disponible', 'El almacén de Fundaciones no está configurado');
  }
  return rechazo('almacen_no_disponible');
}

/**
 * El rechazo de un fallo del modelo.
 *
 * `detalle` lleva el código que trajo Anthropic (`rate_limit_error`,
 * `authentication_error`, `overloaded_error`) y **no** el mensaje: el código alcanza para saber qué
 * hacer, y el mensaje de un servicio externo es texto que no controlamos dentro de una respuesta
 * nuestra. Es el mismo criterio de `ADR-0704` con otro origen.
 */
function rechazoDeModelo(
  fallo: { tipo: 'rechazado'; codigo: string } | { tipo: 'sin_respuesta' } | { tipo: 'sin_texto' },
): Response {
  if (fallo.tipo === 'rechazado') return rechazo('modelo_no_disponible', fallo.codigo);
  if (fallo.tipo === 'sin_texto') return rechazo('modelo_no_disponible', 'respuesta sin texto');
  return rechazo('modelo_no_disponible', 'sin respuesta');
}

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['fundaciones.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  let cuerpo: CuerpoDeGeneracion;
  try {
    cuerpo = (await peticion.json()) as CuerpoDeGeneracion;
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON');
  }

  const id = typeof cuerpo.herramienta === 'number' ? cuerpo.herramienta : null;
  const config = id === null ? undefined : herramienta(id);
  if (id === null || !config) return rechazo('no_encontrado');

  const valores = soloTextos(cuerpo.valores);
  if (valores === null) return rechazo('peticion_invalida', 'Los valores tienen que ser texto');

  const acceso = await conIdentidad(async (db) =>
    // EL FILTRO, a mano: `contexto.orgEfectiva`. Ver la nota de `estado/route.ts`.
    resolverAccesoAFundaciones(db, contexto.orgEfectiva),
  );
  if (acceso.tipo === 'falta') return rechazo(acceso.que);

  const estado = await leerEstado(acceso.clienteId);
  if (estado.tipo !== 'datos') return rechazoDeAlmacen(estado);

  const inputs = aValoresDeAlmacen(idsDeCampos(id), valores);

  // ── El Research: cinco pasos, uno por petición ──────────────────────────────
  //
  // Un paso por petición y no los cinco de una: son cinco llamadas al modelo con búsqueda web, y
  // encadenarlas en una sola petición HTTP significa que un fallo en el paso 4 tira también los tres
  // que ya salieron bien. Así, cada paso que sale queda guardado.
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

  // ── Las otras seis: un formulario, un documento ─────────────────────────────

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
