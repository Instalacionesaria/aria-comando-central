// La llamada al modelo. Un solo lugar, con la llave de la organización que pidió.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ HTTP CRUDO Y NO EL SDK DE ANTHROPIC
//
// El SDK sería lo normal en cualquier otro proyecto. Acá no entra por `ADR-0305`: el proyecto
// afirma que `fetch(` existe en **exactamente tres archivos**, y esa afirmación es lo que impide que
// aparezca un segundo cliente HTTP con el manejo de errores opuesto. Un SDK trae el suyo, con su
// propia política de reintentos y su propia forma de reportar un 429 — y desde afuera se vuelve
// invisible cuántos caminos de red tiene el sistema.
//
// Así que la petición sale por `pedirExterno(` como todas, y este archivo solo arma el cuerpo y lee
// la respuesta. El costo real es tener que escribir a mano la forma del cuerpo, que está acá abajo
// y es corta.
//
// ── EL MODELO ES EL DEL HUB, Y ESO ES UNA DECISIÓN ───────────────────────────
//
// Ver `MODELO`. La intención era usar el mismo que ARIA-brain, porque estas siete
// herramientas van a convivir con las del hub durante meses y un alumno tiene que poder comparar su
// avatar de acá con el de allá. Un modelo distinto sobre el mismo prompt da un documento distinto, y
// la diferencia se leería como un error del port.
// ═══════════════════════════════════════════════════════════════════════════════

import { ESPERA_DE_GENERACION_MS, pedirExterno } from '../http/cliente.ts';
import { type DondeFallo, clasificarFallo, esPasajero, nuevaReferencia, tecnico } from './fallo-del-modelo.ts';
import { registrarIncidente } from '../incidentes/registro.ts';
import { usageOf } from '../analizadores/nucleo/anthropic.ts';
import type { TokenUsage } from '../analizadores/nucleo/pricing.ts';

/**
 * El modelo. **Uno solo, y con su motivo al lado.**
 *
 * ══ CORRECCIÓN: EL COMENTARIO ANTERIOR AFIRMABA UNA COSA FALSA ═════════════
 *
 * Decía que `claude-sonnet-4-6` «no existe en la API de Anthropic». **Sí existe** — es un modelo
 * activo, con un millón de tokens de ventana. Lo afirmé sin comprobarlo, a partir de que la
 * generación fallaba, y lo escribí en tres lugares con seguridad: acá, en `docs/OTROS/capa-base/ETAPA-9.md` y en la
 * prueba que vigila esta línea.
 *
 * Y la diferencia no es anécdota, porque cambia el diagnóstico entero: si el identificador era
 * válido, el `404` de entonces no decía «ese modelo no existe» sino **«esta llave no alcanza ese
 * modelo»**. Que es una condición de la CUENTA de Anthropic detrás de la llave, no de este código — y
 * encaja con lo que pasó después: con `claude-sonnet-5` el modelo resuelve, y el rechazo se corrió a
 * un `400` sobre un cuerpo que está medido y es válido en todos sus campos.
 *
 * La lección, y es la razón por la que esto queda escrito: **«falla, entonces el valor es
 * inválido» no es una medición.** Un identificador válido que una cuenta no alcanza y uno inventado
 * dan el mismo `404`, y separarlos es una consulta a `GET /v1/models/<id>` que nadie hizo.
 *
 * ── Y EL OBJETIVO ORIGINAL SIGUE EN PIE ─────────────────────────────
 *
 * Igualar el modelo del hub para que un alumno pueda comparar su entregable de acá con el de allá.
 * Si el hub usa otro modelo hoy, esta línea es el único lugar que hay que cambiar — y conviene
 * comprobar primero que la llave de la organización LO ALCANCE, que es el paso que faltó.
 */
export const MODELO = 'claude-sonnet-5';

const API = 'https://api.anthropic.com/v1/messages';
const VERSION_API = '2023-06-01';

/**
 * La herramienta de búsqueda web, para el Research.
 *
 * Es la variante con filtrado dinámico. **No se declara `code_execution` junto a ella**: la
 * búsqueda ya ejecuta código por dentro, y un segundo entorno de ejecución declarado confunde al
 * modelo sobre dónde correr las cosas.
 *
 * El comentario decía «disponible en Sonnet 4.6», y `MODELO` dejó de ser ese modelo. El tipo sigue
 * siendo el correcto —la variante también corre en Sonnet 5— pero la justificación había quedado
 * apuntando a otro sitio, y un comentario que nombra la versión equivocada es peor que ninguno:
 * manda a comprobar la compatibilidad contra un modelo que no es el que se usa.
 *
 * Por eso la prueba no fija la cadena entera, sino su FORMA (`web_search_AAAAMMDD`): un tipo que la
 * API no conoce da 400 `invalid_request_error`, con el mismo texto amable de siempre en pantalla.
 */
const BUSQUEDA_WEB = { type: 'web_search_20260209', name: 'web_search' } as const;

/** Lo que devuelve una generación que salió bien. */
export interface Generacion {
  texto: string;
  /** El modelo llegó al techo de tokens: el documento está cortado a la mitad. */
  cortado: boolean;
  /** Las fuentes que citó la búsqueda web. Vacío cuando no hubo búsqueda. */
  citas: { url: string; titulo: string }[];
  milisegundos: number;
  tokens: number | null;
  /**
   * Los cuatro contadores, para `registrarUso`. `tokens` sigue siendo entrada más salida, que es lo
   * que muestra la pantalla; la caché no entra ahí.
   */
  uso: TokenUsage;
}

/**
 * Por qué no se pudo generar. Cada rama lleva lo que hace falta para decidir qué hacer.
 *
 * `motivo` es la frase que Anthropic manda en `error.message`, y es el único campo que dice QUÉ
 * estuvo mal. Sin él, `invalid_request_error` cubre por igual un `max_tokens` fuera de rango, un
 * campo de más y una cuenta sin saldo — tres investigaciones distintas con el mismo nombre. Es
 * `null` cuando el servicio no mandó ninguna, que es un hecho distinto de una cadena vacía.
 */
export type FalloDeGeneracion =
  | { tipo: 'rechazado'; estado: number; codigo: string; motivo: string | null }
  | { tipo: 'sin_respuesta'; causa: string }
  | { tipo: 'sin_texto' };

export type ResultadoDeGeneracion = { tipo: 'datos'; datos: Generacion } | FalloDeGeneracion;

interface BloqueDeRespuesta {
  type?: string;
  text?: string;
  citations?: { url?: string; title?: string }[];
}

interface RespuestaDeAnthropic {
  content?: BloqueDeRespuesta[];
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

/**
 * Rearma el mensaje completo a partir del flujo de eventos (SSE) de Anthropic.
 *
 * Devuelve la MISMA forma que daba la respuesta sin flujo, así que lo de abajo no cambia. Solo se
 * juntan los bloques de texto y sus citas: la búsqueda web (`server_tool_use`, sus resultados) no
 * se lee después, y rearmarla sería código que nadie usa.
 *
 * Un flujo que trae un evento `error` (p. ej. `overloaded_error` a mitad) o que termina sin
 * `message_stop` NO es un documento: es una respuesta que no llegó, y se dice así.
 */
export function mensajeDelFlujo(
  texto: string,
): { tipo: 'completo'; mensaje: RespuestaDeAnthropic } | { tipo: 'cortado'; causa: string } {
  const bloques: BloqueDeRespuesta[] = [];
  const mensaje: RespuestaDeAnthropic = { content: bloques, usage: {} };
  let terminado = false;

  for (const linea of texto.split(/\r?\n/)) {
    if (!linea.startsWith('data:')) continue;
    let ev: Record<string, any>;
    try {
      ev = JSON.parse(linea.slice(5)) as Record<string, any>;
    } catch {
      continue;
    }
    switch (ev['type']) {
      case 'message_start':
        Object.assign(mensaje.usage!, ev['message']?.usage ?? {});
        break;
      case 'content_block_start': {
        const b = ev['content_block'] ?? {};
        bloques[ev['index']] = {
          type: b.type,
          text: typeof b.text === 'string' ? b.text : '',
          citations: Array.isArray(b.citations) ? [...b.citations] : [],
        };
        break;
      }
      case 'content_block_delta': {
        const b = bloques[ev['index']];
        const d = ev['delta'] ?? {};
        if (!b) break;
        if (d.type === 'text_delta' && typeof d.text === 'string') b.text = (b.text ?? '') + d.text;
        if (d.type === 'citations_delta' && d.citation) b.citations!.push(d.citation);
        break;
      }
      case 'message_delta':
        if (ev['delta']?.stop_reason) mensaje.stop_reason = ev['delta'].stop_reason;
        Object.assign(mensaje.usage!, ev['usage'] ?? {});
        break;
      case 'message_stop':
        terminado = true;
        break;
      case 'error': {
        const e = ev['error'] ?? {};
        return { tipo: 'cortado', causa: `el modelo cortó a mitad: ${e.type ?? 'error'}${e.message ? ` · ${e.message}` : ''}` };
      }
    }
  }

  if (!terminado) return { tipo: 'cortado', causa: 'la respuesta llegó incompleta (el flujo terminó sin cerrar)' };
  // Huecos del arreglo (índices de bloques que no llegaron a abrirse) se descartan.
  mensaje.content = bloques.filter(Boolean);
  return { tipo: 'completo', mensaje };
}

/**
 * Genera un documento.
 *
 * `claveIa` viene resuelta por organización (ver `lib/credenciales/resolver.ts`) y no tiene valor
 * por omisión: sin llave propia esta función no se llama.
 */
export async function generar(opciones: OpcionesDeGeneracion): Promise<ResultadoDeGeneracion> {
  const desde = Date.now();
  const primero = await unIntento(opciones, ESPERA_DE_GENERACION_MS, desde);
  if (primero.tipo === 'datos' || !esPasajero(primero)) return primero;

  /* ── UN SEGUNDO INTENTO, Y SOLO UNO ──────────────────────────────────────
   *
   * Anthropic saturado o una conexión cortada se arreglan solos casi siempre, y antes la persona se
   * enteraba igual y escribía «falló otra vez». Solo si el fallo llegó TEMPRANO: el segundo intento
   * tiene que caber en lo que queda de `ESPERA_DE_GENERACION_MS`, y uno que falló a los cuatro minutos
   * no tiene dónde. Si el segundo también falla, se muestra ESE fallo, con su referencia. */
  const transcurrido = Date.now() - desde;
  if (transcurrido > VENTANA_DE_REINTENTO_MS) return primero;
  console.warn(`generacion: reintento tras un fallo pasajero a los ${Math.round(transcurrido / 1000)} s`);
  await new Promise((listo) => setTimeout(listo, PAUSA_ANTES_DE_REINTENTAR_MS));
  const segundo = await unIntento(opciones, ESPERA_DE_GENERACION_MS - (Date.now() - desde), desde);
  /* Si el segundo salió bien, la persona no vio nada, pero el Panel de Incidentes sí lo anota
     —en gris, como «salvado»—: un proveedor que falla seguido se ve aunque nadie se queje. Si
     salió mal, lo anota quien muestra el error (`rechazoDelModelo`), con su referencia. */
  if (segundo.tipo === 'datos' && opciones.donde?.orgId) {
    await registrarIncidente({
      orgId: opciones.donde.orgId,
      ref: nuevaReferencia(),
      situacion: clasificarFallo(primero),
      origen: opciones.donde.origen,
      ...(opciones.donde.donde ? { donde: opciones.donde.donde } : {}),
      usuarioId: opciones.donde.usuarioId ?? null,
      tecnico: tecnico(primero),
      salvado: true,
    });
  }
  return segundo;
}

/** Hasta cuándo un fallo pasajero merece un segundo intento. Ver `generar`. */
const VENTANA_DE_REINTENTO_MS = 90_000;
/** Un respiro: reintentar en el mismo milisegundo contra un servicio saturado no ayuda. */
const PAUSA_ANTES_DE_REINTENTAR_MS = 3_000;

interface OpcionesDeGeneracion {
  claveIa: string;
  prompt: string;
  tokens: number;
  conBusquedaWeb?: boolean;
  /** De dónde viene, para anotar en el Panel de Incidentes un reintento que salvó el fallo. */
  donde?: DondeFallo;
}

async function unIntento(
  opciones: OpcionesDeGeneracion,
  espera: number,
  desde: number,
): Promise<ResultadoDeGeneracion> {

  const cuerpo: Record<string, unknown> = {
    model: MODELO,
    max_tokens: opciones.tokens,
    messages: [{ role: 'user', content: opciones.prompt }],
    /* En flujo, y no por gusto: sin él Anthropic no manda ni una cabecera hasta terminar, y el
       `fetch` de Node abandona a los 300 s por su cuenta («fetch failed (tras 301 s)», 2026-10-01).
       Ver `ESPERA_DE_GENERACION_MS`. */
    stream: true,
  };
  if (opciones.conBusquedaWeb) cuerpo['tools'] = [BUSQUEDA_WEB];

  const r = await pedirExterno<string>(API, {
    metodo: 'POST',
    cabeceras: { 'x-api-key': opciones.claveIa, 'anthropic-version': VERSION_API },
    cuerpo,
    /* Una generación es la llamada más larga del proyecto —el paso 1 del Research busca en la web y
       escribe hasta 16.000 tokens— y el tope por omisión le quedaba corto con la función todavía
       viva. Ver `ESPERA_DE_GENERACION_MS`. */
    espera,
    lectura: 'texto',
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

  const flujo = mensajeDelFlujo(r.datos);
  if (flujo.tipo === 'cortado') return { tipo: 'sin_respuesta', causa: flujo.causa };
  const mensaje = flujo.mensaje;

  const bloques = Array.isArray(mensaje.content) ? mensaje.content : [];
  const texto = bloques
    .filter((b) => b.type === 'text')
    .map((b) => (b.text ? b.text : ''))
    .join('\n')
    .trim();

  // Un 200 sin una sola línea de texto NO es un documento vacío: es una respuesta que no sirve, y
  // guardarla como versión dejaría al alumno con un entregable en blanco en su historial.
  if (texto.length === 0) return { tipo: 'sin_texto' };

  const citas: { url: string; titulo: string }[] = [];
  for (const b of bloques) {
    if (b.type !== 'text' || !Array.isArray(b.citations)) continue;
    for (const c of b.citations) {
      if (c.url && !citas.some((x) => x.url === c.url)) {
        citas.push({ url: c.url, titulo: c.title ? c.title : c.url });
      }
    }
  }

  const uso = mensaje.usage;
  const entrada = uso && uso.input_tokens ? uso.input_tokens : 0;
  const salida = uso && uso.output_tokens ? uso.output_tokens : 0;
  const tokens = entrada + salida;

  return {
    tipo: 'datos',
    datos: {
      texto,
      cortado: mensaje.stop_reason === 'max_tokens',
      citas,
      milisegundos: Date.now() - desde,
      tokens: tokens > 0 ? tokens : null,
      uso: usageOf({ usage: uso }),
    },
  };
}
