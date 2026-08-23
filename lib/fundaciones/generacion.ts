// La llamada al modelo. Un solo lugar, con la llave de la organización que pidió.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ HTTP CRUDO Y NO EL SDK DE ANTHROPIC
//
// El SDK sería lo normal en cualquier otro proyecto. Acá no entra por `ADR-0305`: el proyecto
// afirma que `fetch(` existe en **exactamente dos archivos**, y esa afirmación es lo que impide que
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
// Ver `MODELO`. No es el más capaz disponible: es el mismo que usa ARIA-brain, porque estas siete
// herramientas van a convivir con las del hub durante meses y un alumno tiene que poder comparar su
// avatar de acá con el de allá. Un modelo distinto sobre el mismo prompt da un documento distinto, y
// la diferencia se leería como un error del port.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedirExterno } from '../http/cliente.ts';

/**
 * El modelo. **Uno solo, y con su motivo al lado.**
 *
 * `claude-sonnet-4-6` es el que usa ARIA-brain hoy. Mantenerlo es lo que hace comparables los
 * entregables de los dos sistemas mientras los dos estén en pie. Cuando el hub se apague, esta línea
 * es el único lugar que hay que cambiar — y conviene cambiarla ahí, no antes, porque subir de modelo
 * mientras hay comparación en curso convierte "el port genera distinto" en un diagnóstico imposible.
 */
export const MODELO = 'claude-sonnet-4-6';

const API = 'https://api.anthropic.com/v1/messages';
const VERSION_API = '2023-06-01';

/**
 * La herramienta de búsqueda web, para el Research.
 *
 * Es la variante con filtrado dinámico, disponible en Sonnet 4.6. **No se declara `code_execution`
 * junto a ella**: la búsqueda ya ejecuta código por dentro, y un segundo entorno de ejecución
 * declarado confunde al modelo sobre dónde correr las cosas.
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
}

/** Por qué no se pudo generar. Cada rama lleva lo que hace falta para decidir qué hacer. */
export type FalloDeGeneracion =
  | { tipo: 'rechazado'; estado: number; codigo: string }
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
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Genera un documento.
 *
 * `claveIa` viene resuelta por organización (ver `lib/credenciales/resolver.ts`) y no tiene valor
 * por omisión: sin llave propia esta función no se llama.
 */
export async function generar(opciones: {
  claveIa: string;
  prompt: string;
  tokens: number;
  conBusquedaWeb?: boolean;
}): Promise<ResultadoDeGeneracion> {
  const desde = Date.now();

  const cuerpo: Record<string, unknown> = {
    model: MODELO,
    max_tokens: opciones.tokens,
    messages: [{ role: 'user', content: opciones.prompt }],
  };
  if (opciones.conBusquedaWeb) cuerpo['tools'] = [BUSQUEDA_WEB];

  const r = await pedirExterno<RespuestaDeAnthropic>(API, {
    metodo: 'POST',
    cabeceras: { 'x-api-key': opciones.claveIa, 'anthropic-version': VERSION_API },
    cuerpo,
  });

  if (r.tipo === 'rechazado') return { tipo: 'rechazado', estado: r.estado, codigo: r.codigo };
  if (r.tipo === 'sin_respuesta') return { tipo: 'sin_respuesta', causa: r.causa };

  const bloques = Array.isArray(r.datos.content) ? r.datos.content : [];
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

  const uso = r.datos.usage;
  const entrada = uso && uso.input_tokens ? uso.input_tokens : 0;
  const salida = uso && uso.output_tokens ? uso.output_tokens : 0;
  const tokens = entrada + salida;

  return {
    tipo: 'datos',
    datos: {
      texto,
      cortado: r.datos.stop_reason === 'max_tokens',
      citas,
      milisegundos: Date.now() - desde,
      tokens: tokens > 0 ? tokens : null,
    },
  };
}
