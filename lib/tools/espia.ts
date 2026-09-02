// El análisis con IA del Espía de Anuncios: qué se le manda al modelo y qué se hace con lo que vuelve.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL NAVEGADOR MANDA UN IDENTIFICADOR, NO LOS ANUNCIOS
//
// Tienta que la pantalla —que YA tiene los anuncios en la mano, los está mostrando— los suba en el
// cuerpo de la petición. El hub hace exactamente eso, y ahí es coherente: allá el prompt entero
// también se arma en el navegador.
//
// Acá no, por la regla que `operaciones.ts` ya nombra para las herramientas de Fundaciones:
// *"mandarlos al navegador para que los devuelva es dejar que el navegador elija con qué contexto se
// genera"*. Con el identificador del trabajo, el servidor le pregunta al backend —con el `org_id` de
// la sesión, que es lo que además impide leer el trabajo de otra organización— y analiza lo que
// realmente se espió.
//
// Y de paso ahorra subir doscientos kilobytes de anuncios por cada clic en un botón.
//
// ── LO QUE ESTO CUESTA, Y POR QUÉ NO ES LO MISMO QUE ESPIAR ─────────────────
//
// Espiar gasta una corrida de Apify. Esto gasta TOKENS de la llave de IA de la organización. Son dos
// gastos distintos y dos operaciones distintas a propósito: se puede espiar veinte veces y analizar
// una, o volver a analizar sin volver a espiar. Encadenarlos habría hecho que cada búsqueda pagara
// las dos cosas.
// ═══════════════════════════════════════════════════════════════════════════════

import { ok, rechazo } from '../autorizacion/respuesta.ts';
import { generar } from '../fundaciones/generacion.ts';
import { pedirExterno } from '../http/cliente.ts';

/**
 * Cuántos anuncios entran al prompt, y cuánto de cada uno.
 *
 * Los números son los del hub y se conservan. Lo que importa de ellos: una búsqueda trae hasta
 * sesenta anuncios y el copy de un anuncio puede ser larguísimo, así que mandarlos todos enteros es
 * un prompt de decenas de miles de tokens **por cada clic**, para una salida que resume patrones.
 *
 * Y van los PRIMEROS veinticinco, que no es un recorte arbitrario: el backend los devuelve ordenados
 * por longevidad (`build_ad_spy_items` ordena por `days_active` descendente), o sea que los primeros
 * son los que llevan más tiempo corriendo — que es justamente la señal por la que esta herramienta
 * existe. Recortar por el otro extremo tiraría los que más importan.
 */
export const ANUNCIOS_QUE_SE_ANALIZAN = 25;
export const CARACTERES_POR_ANUNCIO = 500;

/** El techo de la salida. Un resumen de patrones, no un documento. */
export const TOKENS_DEL_ANALISIS = 2_000;

/** Un anuncio espiado, tal como lo normaliza el backend (`build_ad_spy_items`). */
export interface AnuncioEspiado {
  ad_archive_id?: string;
  page_name?: string;
  is_active?: boolean;
  days_active?: number;
  media_type?: string;
  thumbnail_url?: string;
  body_text?: string;
  title?: string;
  ad_library_url?: string;
}

/**
 * El prompt del análisis.
 *
 * Vive acá y no en un `SKILL.md` como las metodologías de Fundaciones, y la diferencia es real: esos
 * archivos son copias byte a byte de los de ARIA-brain y su fidelidad es el punto —cuando Jorge
 * corrige un framework, el diff entre los dos árboles tiene que ser legible—. Éste no existe en
 * ningún `SKILL.md`: en el hub está escrito dentro de `lib/scrapers.ts`, del lado del navegador. Se
 * porta a donde tiene que estar, que es el servidor.
 */
export function promptDelAnalisis(anuncios: readonly AnuncioEspiado[]): string {
  const lista = anuncios
    .slice(0, ANUNCIOS_QUE_SE_ANALIZAN)
    .map((a, i) => {
      const dias = a.days_active ?? 0;
      const copy = (a.body_text || a.title || '').slice(0, CARACTERES_POR_ANUNCIO);
      return `#${i + 1} [${dias} días activo · ${a.media_type ?? ''}] ${a.page_name ?? ''}\n${copy}`;
    })
    .join('\n\n');

  return (
    'Eres un estratega de ads de respuesta directa. Analiza estos anuncios de la competencia ' +
    '(ordenados por longevidad; los que llevan más tiempo corriendo suelen ser los que convierten). ' +
    'Extrae los PATRONES que se repiten y entrega, en español y en markdown:\n' +
    '1. **Hooks/ganchos** más usados (primeras líneas que detienen el scroll).\n' +
    '2. **Ofertas y ángulos** recurrentes.\n' +
    '3. **Estructuras** de copy que se repiten.\n' +
    '4. **3-5 ideas accionables** para crear anuncios en este nicho.\n\n' +
    `ANUNCIOS:\n${lista}`
  );
}

/** Lo que devuelve el backend al preguntar por un trabajo. */
interface TrabajoDelBackend {
  status?: string;
  results?: { data?: AnuncioEspiado[] };
}

/**
 * Los anuncios de un trabajo, leídos del backend con el `org_id` de la sesión.
 *
 * El filtro por organización lo pone el backend: un trabajo de otra organización responde 404. Por
 * eso el identificador puede llegar del navegador sin que eso sea una fuga — conocerlo no alcanza.
 */
async function anunciosDelTrabajo(
  backend: string,
  trabajo: string,
  orgId: string,
): Promise<{ tipo: 'datos'; anuncios: AnuncioEspiado[] } | Response> {
  const camino =
    `${backend}/job/${encodeURIComponent(trabajo)}?org_id=${encodeURIComponent(orgId)}`;

  const r = await pedirExterno<TrabajoDelBackend>(camino, {});
  if (r.tipo === 'sin_respuesta') {
    return rechazo('motor_no_disponible', 'No se pudo conectar con el motor de scraping.');
  }
  if (r.tipo === 'rechazado') {
    return rechazo('motor_rechazo', r.detalle ?? `El motor respondió ${r.estado}.`);
  }

  const anuncios = Array.isArray(r.datos.results?.data) ? r.datos.results.data : [];
  return { tipo: 'datos', anuncios };
}

/**
 * Analiza los anuncios de un trabajo y devuelve el texto.
 *
 * Recibe la llave ya resuelta y el `org_id` ya sacado de la sesión: la ruta se queda con el portero y
 * con la credencial, igual que las de Fundaciones.
 */
export async function analizarLosAnuncios(
  peticion: Request,
  opciones: { claveIa: string; orgId: string; backend: string },
): Promise<Response> {
  let cuerpo: { trabajo?: unknown };
  try {
    cuerpo = (await peticion.json()) as { trabajo?: unknown };
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON');
  }

  const trabajo = typeof cuerpo.trabajo === 'string' ? cuerpo.trabajo.trim() : '';
  if (trabajo === '') return rechazo('peticion_invalida', 'Falta el identificador del trabajo.');

  const leidos = await anunciosDelTrabajo(opciones.backend, trabajo, opciones.orgId);
  if (leidos instanceof Response) return leidos;

  /* Un trabajo sin anuncios NO se manda al modelo. El prompt saldría con la lista vacía, el modelo
     inventaría patrones de la nada y el resultado se vería igual de convincente — con la inferencia
     pagada. Es el mismo criterio que `pasoDeResearchListo`: la comprobación va del lado del
     servidor porque el navegador no es quien decide si hay con qué generar. */
  if (leidos.anuncios.length === 0) {
    return rechazo('peticion_invalida', 'Ese trabajo no tiene anuncios para analizar.');
  }

  const salida = await generar({
    claveIa: opciones.claveIa,
    prompt: promptDelAnalisis(leidos.anuncios),
    tokens: TOKENS_DEL_ANALISIS,
  });

  if (salida.tipo !== 'datos') {
    /* Se registra con el mismo formato que las generaciones de Fundaciones —`ADR-0407` prohíbe
       registrar cuerpos; un código y un motivo no son un cuerpo— y a la pantalla va el detalle del
       proveedor, que es lo único accionable: si dice que el saldo es insuficiente, hay que recargar
       la cuenta de IA. */
    if (salida.tipo === 'rechazado') {
      console.error(
        `espia: el modelo rechazó el análisis · ${salida.estado} ${salida.codigo} · ` +
          (salida.motivo === null ? 'sin motivo' : salida.motivo),
      );
      return rechazo(
        'modelo_no_disponible',
        salida.motivo === null ? salida.codigo : `${salida.codigo}: ${salida.motivo}`,
      );
    }
    return rechazo(
      'modelo_no_disponible',
      salida.tipo === 'sin_texto' ? 'respuesta sin texto' : 'sin respuesta',
    );
  }

  return ok({
    texto: salida.datos.texto,
    cortado: salida.datos.cortado,
    milisegundos: salida.datos.milisegundos,
    tokens: salida.datos.tokens,
    anuncios: Math.min(leidos.anuncios.length, ANUNCIOS_QUE_SE_ANALIZAN),
  });
}
