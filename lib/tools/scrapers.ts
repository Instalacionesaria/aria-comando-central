// El vocabulario del motor de scraping: qué fuentes hay, qué devuelven y cómo se llama cada campo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTO NO ES UNA HERRAMIENTA DE IA, Y ESA ES LA DIFERENCIA QUE IMPORTA
//
// Las nueve de Fundaciones y el plan de Prospección le piden un documento a un modelo. Esto no:
// **llama a un tercer sistema que cobra por lead extraído**. El backend de scraping (EasyPanel,
// actores de Apify) lleva un monedero por cliente en su propia base — `usuarios_scraper` — con
// saldo, auto-provisión de leads gratis y un 403 cuando se acaba.
//
// Dos consecuencias que hay que tener presentes al leer lo de abajo:
//
//   1. **Un scraping mal disparado gasta plata de verdad**, no tokens. Por eso las validaciones de
//      los formularios están del lado del cliente ADEMÁS de en el backend: no son cosméticas, son
//      lo que evita quemar 72 leads en una búsqueda con la localización mal escrita.
//   2. **La identidad es la del hub.** El backend indexa por `usuarios_scraper.cliente_id`, que es
//      `aria_brain_clientes.id`. Este proyecto lo resuelve desde `fundaciones_cliente_id`, igual
//      que Fundaciones — y con la misma carencia: una organización sin vínculo no puede scrapear.
//      Ver `app/api/tools/scrape/route.ts`.
//
// Puerto de `ARIA-brain/app-next/lib/scrapers.ts`. Los NOMBRES DE CAMPO del cable —`businessType`,
// `job_title`, `number_of_leads`— son los que espera el backend y no se traducen: son datos ajenos,
// igual que las llaves del almacén.
// ═══════════════════════════════════════════════════════════════════════════════

import { ESPERA_DE_RUTA_LARGA_MS, pedir } from '../http/cliente.ts';
import { SIN_RESPUESTA, mensajeDeRechazo } from '../fundaciones/mensajes.ts';

/** Un lead como lo devuelve el backend. Los campos varían según la fuente. */
export interface Lead {
  title?: string;
  categoryName?: string;
  address?: string;
  phone?: string;
  website?: string;
  email?: string;
  // De la biblioteca de anuncios de Facebook (el paso de descubrimiento).
  page_name?: string;
  page_profile_uri?: string;
  page_id?: string;
  [clave: string]: unknown;
}

export type FuenteDeScraping =
  | 'maps'
  | 'linkedin'
  | 'facebook-ads'
  | 'facebook-pages'
  /* El Espía de Anuncios. Va en esta lista porque arranca y se sondea igual que las otras cuatro
     —mismo proxy, misma tabla de trabajos, mismo `results.data`— y NO porque traiga leads: no trae.
     Sus resultados son anuncios y viven en el trabajo. Ver `AnuncioEspiado`. */
  | 'ad-spy';

/**
 * El mínimo de leads por búsqueda de Google Maps.
 *
 * No es un número redondo ni una preferencia: el actor de Apify tiene un piso de $0,50 por corrida
 * y cada lead cuesta ~$0,007, así que por debajo de 72 se paga lo mismo por menos. El backend lo
 * valida de forma definitiva; acá está para decirlo ANTES de gastar.
 */
export const MINIMO_LEADS_MAPS = 72;

/** Cómo se llama cada columna en la tabla de resultados. Superset de todas las fuentes. */
export const ETIQUETAS_DE_COLUMNA: Readonly<Record<string, string>> = {
  title: 'Nombre',
  categoryName: 'Categoría',
  address: 'Dirección',
  neighborhood: 'Barrio',
  street: 'Calle',
  website: 'Sitio web',
  phone: 'Teléfono',
  phoneUnformatted: 'Tel. sin formato',
  fullName: 'Nombre completo',
  jobTitle: 'Cargo',
  email: 'Email',
  emails: 'Emails',
  linkedinProfile: 'LinkedIn',
  mobileNumber: 'Celular',
  companyName: 'Empresa',
  companyWebsite: 'Web empresa',
  companyLinkedin: 'LinkedIn empresa',
  companyPhoneNumber: 'Tel. empresa',
  companySize: 'Tamaño empresa',
  industry: 'Industria',
  city: 'Ciudad',
  businessModel: 'Modelo de negocio',
  page_name: 'Página',
  page_profile_uri: 'URL de página',
  likes: 'Likes',
  followers: 'Seguidores',
};

/** Las columnas que se pintan como enlace en vez de como texto. */
export const COLUMNAS_ENLACE: readonly string[] = [
  'website',
  'companyWebsite',
  'companyLinkedin',
  'linkedinProfile',
  'page_profile_uri',
];

const RUTA = '/api/tools/scrape';

export type ResultadoDeInicio =
  | { tipo: 'trabajo'; id: string }
  | { tipo: 'fallo'; mensaje: string };

/**
 * Arranca un scraping y devuelve el identificador del trabajo para poder consultarlo.
 *
 * Los tres fallos posibles se colapsan en un mensaje legible A PROPÓSITO: acá el que mira la
 * pantalla es el alumno, y la distinción entre "no hay saldo", "el backend no contesta" y "la
 * sesión venció" ya la hace el proxy — que devuelve el detalle del backend tal cual para que se
 * pueda mostrar. Lo que no se hace es inventar un mensaje cuando el backend mandó el suyo.
 */
export async function iniciarScraping(
  fuente: FuenteDeScraping,
  parametros: Record<string, unknown>,
): Promise<ResultadoDeInicio> {
  const r = await pedir<{ jobId?: string; job_id?: string }>(RUTA, {
    metodo: 'POST',
    cuerpo: { fuente, ...parametros },
  });
  if (r.tipo === 'datos') {
    const id = r.datos.jobId ?? r.datos.job_id;
    return id ? { tipo: 'trabajo', id: String(id) } : { tipo: 'fallo', mensaje: 'El motor no devolvió un trabajo.' };
  }
  if (r.tipo === 'rechazado') {
    return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo iniciar el scraping.' };
  }
  return { tipo: 'fallo', mensaje: 'No se pudo conectar con el motor de scraping.' };
}

/**
 * El estado de un trabajo. Genérico en lo que trae `results.data`, y no por elegancia: cuatro
 * fuentes devuelven leads y el Espía devuelve anuncios, que no comparten un solo campo. Con `Lead`
 * fijo, el panel del Espía tendría que castear cada tarjeta —o peor, se escribiría una segunda
 * función de sondeo idéntica con otro tipo de retorno.
 */
export interface EstadoDeTrabajo<T = Lead> {
  status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | string;
  results?: { data?: T[] };
}

/** Consulta el estado de un trabajo. El backend devuelve `results.data` recién al terminar. */
export async function consultarTrabajo<T = Lead>(id: string): Promise<EstadoDeTrabajo<T> | null> {
  const r = await pedir<EstadoDeTrabajo<T>>(`${RUTA}?trabajo=${encodeURIComponent(id)}`);
  return r.tipo === 'datos' ? r.datos : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOS TRABAJOS EN VUELO
//
// Un scraping tarda minutos, y durante esos minutos el alumno se va a otra pantalla. Antes eso
// mataba el sondeo: el identificador vivía en `useState` y el reloj en un `useRef`, así que
// desmontar la pestaña dejaba el trabajo corriendo en Apify sin nadie mirándolo.
//
// Con esto el sondeo deja de depender de que una pestaña siga abierta: al montar se pregunta
// qué hay en vuelo y se retoma. La fuente de verdad es la tabla, no la memoria del navegador.
// ═══════════════════════════════════════════════════════════════════════════════

/** Un scraping que todavía no terminó. */
export interface TrabajoEnVuelo {
  id: string;
  fuente: string;
  status: string;
  business_type: string | null;
  location: string | null;
  created_at: string;
}

/**
 * Qué está corriendo para esta organización.
 *
 * Devuelve lista vacía ante cualquier fallo, y eso es deliberado: esta consulta alimenta un
 * indicador, no una decisión. Un error de red no tiene que pintar «error» en el menú de alguien
 * que está trabajando en otra pantalla — como mucho, el puntito tarda un ciclo más en aparecer.
 */
export async function leerTrabajosEnVuelo(): Promise<TrabajoEnVuelo[]> {
  const r = await pedir<{ enCurso: TrabajoEnVuelo[] }>('/api/tools/trabajos');
  return r.tipo === 'datos' ? (r.datos.enCurso ?? []) : [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// EL ESPÍA DE ANUNCIOS
//
// Puerto de `ARIA-brain/app-next/components/AdSpyPanel.tsx` + su mitad de `lib/scrapers.ts`.
//
// Arranca y se sondea como cualquier otra fuente —el proxy, la tabla de trabajos, `results.data`—
// y se diferencia en dos cosas que conviene tener presentes:
//
//   1. **No gasta saldo de leads.** El backend lo dice con todas las letras: *"es investigación de
//      competencia, no generación de leads"*. Abre el monedero de la organización para provisionarla
//      y no valida saldo. Sí gasta una corrida de Apify, que se cobra en la factura.
//   2. **Sus resultados no son leads y no van a «Mis Leads».** Viven en el `results_data` del
//      trabajo. Por eso el filtro «Espía» de esa pantalla no va a mostrar filas — está en la lista
//      porque la columna lo admite, no porque el backend escriba ahí.
// ═══════════════════════════════════════════════════════════════════════════════

/** Un anuncio espiado, ya normalizado por el backend (`build_ad_spy_items`). */
export interface AnuncioEspiado {
  ad_archive_id?: string;
  page_name?: string;
  page_id?: string;
  /**
   * La URL de la página de Facebook que puso el anuncio.
   *
   * **No es para la tarjeta: es lo que hace que el Espía pueda alimentar el paso 2 de Prospección.**
   * `apify/facebook-pages-scraper` —el que saca teléfono, email y web— no acepta otra cosa como
   * entrada, así que sin este campo se pueden descubrir anunciantes y no se les puede sacar nada.
   *
   * Puede venir vacía, y por dos motivos distintos que la pantalla tiene que saber distinguir: un
   * anuncio suelto al que el actor no le resolvió la página, o un backend viejo —`build_ad_spy_items`
   * la tiró hasta el 2026-09-02—. En los dos casos ese anunciante no se puede procesar, y decirlo
   * antes vale una corrida que se cobra igual aunque procese cero.
   */
  page_profile_uri?: string;
  is_active?: boolean;
  days_active?: number;
  start_date_formatted?: string;
  media_type?: string;
  thumbnail_url?: string;
  body_text?: string;
  title?: string;
  caption?: string;
  cta_text?: string;
  link_url?: string;
  ad_library_url?: string;
}

/** Cómo se nombra el tipo de anuncio en la tarjeta. Las claves las escribe el backend. */
export const TIPO_DE_ANUNCIO: Readonly<Record<string, string>> = {
  video: 'Video',
  imagen: 'Imagen',
  carrusel: 'Carrusel',
};

/**
 * Los países donde se puede espiar.
 *
 * La persona elige un NOMBRE y por el cable viaja el código ISO que espera la Meta Ad Library. La
 * lista es la del hub y se conserva entera: es la que Jorge armó, con los países donde están los
 * alumnos, y recortarla acá haría que una búsqueda que allá se puede hacer, acá no.
 */
export const PAISES: readonly { codigo: string; etiqueta: string }[] = [
  { codigo: 'ALL', etiqueta: '🌎 Todos los países' },
  { codigo: 'PE', etiqueta: 'Perú' },
  { codigo: 'MX', etiqueta: 'México' },
  { codigo: 'CO', etiqueta: 'Colombia' },
  { codigo: 'AR', etiqueta: 'Argentina' },
  { codigo: 'CL', etiqueta: 'Chile' },
  { codigo: 'EC', etiqueta: 'Ecuador' },
  { codigo: 'BO', etiqueta: 'Bolivia' },
  { codigo: 'VE', etiqueta: 'Venezuela' },
  { codigo: 'UY', etiqueta: 'Uruguay' },
  { codigo: 'PY', etiqueta: 'Paraguay' },
  { codigo: 'CR', etiqueta: 'Costa Rica' },
  { codigo: 'PA', etiqueta: 'Panamá' },
  { codigo: 'GT', etiqueta: 'Guatemala' },
  { codigo: 'DO', etiqueta: 'Rep. Dominicana' },
  { codigo: 'ES', etiqueta: 'España' },
  { codigo: 'US', etiqueta: 'Estados Unidos' },
  { codigo: 'BR', etiqueta: 'Brasil' },
];

/**
 * El prefijo con el que el backend guarda la búsqueda en `business_type`, para poder recuperar qué
 * se estaba espiando al retomar un trabajo en vuelo.
 *
 * Es un dato ajeno —lo escribe `start_ad_spy` como `f"AdSpy: {query}"`— y por eso está acá con su
 * nombre: leerlo con un `slice(7)` suelto en el componente sería un número mágico que nadie puede
 * atar a su origen.
 */
export const PREFIJO_DE_BUSQUEDA = 'AdSpy: ';

/**
 * Cuántos anuncios trae una búsqueda, según para qué se busca. **Son dos números y no uno.**
 *
 * Espiar es mirar: sesenta anuncios ordenados por longevidad ya muestran los patrones del nicho, y
 * son sesenta tarjetas que alguien puede leer.
 *
 * Prospectar es cosechar anunciantes, y ahí el número que importa es el de PÁGINAS distintas — que
 * es mucho menor que el de anuncios, porque un anunciante que va en serio tiene varios corriendo.
 * Mil es el número que el paso 1 de Prospección usa desde siempre (`facebook_ads_scraper` lo tiene
 * escrito en su `run_input`), y se conserva a propósito: si los dos caminos de la pestaña Facebook
 * trajeran cantidades distintas, cambiar de camino cambiaría lo que se paga y lo que se encuentra
 * sin que nadie lo haya pedido.
 */
export const ANUNCIOS_PARA_ESPIAR = 60;
export const ANUNCIOS_PARA_PROSPECTAR = 1000;

/** Arranca una búsqueda de anuncios. Devuelve el identificador del trabajo, como las otras cuatro. */
export async function espiarAnuncios(
  consulta: string,
  pais: string,
  cuantos: number = ANUNCIOS_PARA_ESPIAR,
): Promise<ResultadoDeInicio> {
  return iniciarScraping('ad-spy', { query: consulta, country: pais, count: cuantos });
}

/** Un anunciante: la página de Facebook detrás de uno o varios anuncios. */
export interface Anunciante {
  page_name: string;
  page_profile_uri: string;
  page_id: string;
  /** Cuántos anuncios suyos trajo la búsqueda. */
  anuncios: number;
  /** Los días del anuncio suyo que lleva más tiempo corriendo. */
  diasMax: number;
}

/**
 * Los anunciantes detrás de una lista de anuncios, sin repetir.
 *
 * ── POR QUÉ ESTO NO ES UN DETALLE DE PRESENTACIÓN ───────────────────────────
 *
 * Una búsqueda devuelve ANUNCIOS y el paso 2 procesa PÁGINAS. Un anunciante que va en serio tiene
 * cinco o diez anuncios corriendo, así que «trescientos anuncios» pueden ser cuarenta anunciantes.
 * Mandarlos sin agrupar no rompe nada —el backend deduplica por `page_profile_uri` antes de llamar
 * al actor— pero deja a la pantalla diciendo «300 páginas listas» cuando son cuarenta, y a quien
 * elige sin poder elegir: vería el mismo anunciante diez veces.
 *
 * Se agrupa por la URL y no por el nombre: dos páginas distintas pueden llamarse igual, y una misma
 * página puede cambiarse el nombre entre anuncios.
 *
 * Los que vienen sin URL **no se descartan acá**. Se cuentan y se muestran apagados, porque «este
 * anunciante no se puede procesar» es información: descartarlos en silencio haría que la lista
 * mostrara menos anunciantes de los que la búsqueda encontró, sin decir por qué.
 */
export function anunciantesDe(anuncios: readonly AnuncioEspiado[]): Anunciante[] {
  const porPagina = new Map<string, Anunciante>();

  for (const [i, a] of anuncios.entries()) {
    const uri = (a.page_profile_uri ?? '').trim();
    /* Sin URL, cada anuncio es su propia fila: no hay con qué saber si dos son del mismo. La llave
       lleva la POSICIÓN y no un número al azar —`ADR-0507` prohíbe `Math.random` en todo el
       proyecto, y acá además sería peor: una llave distinta en cada render haría que la lista se
       reordenara sola entre dibujos. */
    const llave = uri !== '' ? uri : `sin-url:${a.ad_archive_id ?? ''}:${i}`;
    const previo = porPagina.get(llave);
    const dias = a.days_active ?? 0;

    if (previo) {
      previo.anuncios += 1;
      if (dias > previo.diasMax) previo.diasMax = dias;
      continue;
    }
    porPagina.set(llave, {
      page_name: (a.page_name ?? '').trim(),
      page_profile_uri: uri,
      page_id: (a.page_id ?? '').trim(),
      anuncios: 1,
      diasMax: dias,
    });
  }

  /* Por longevidad, que es la señal de la herramienta: el anunciante cuyo anuncio más viejo sigue
     corriendo es el que más probablemente esté convirtiendo. Los sin URL caen al final solos, no por
     una regla aparte: son los que menos se pueden aprovechar. */
  return [...porPagina.values()].sort((a, b) => {
    if ((a.page_profile_uri === '') !== (b.page_profile_uri === '')) {
      return a.page_profile_uri === '' ? 1 : -1;
    }
    return b.diasMax - a.diasMax;
  });
}

export type ResultadoDelAnalisis =
  | { tipo: 'datos'; texto: string; cortado: boolean }
  | { tipo: 'fallo'; mensaje: string };

/**
 * Le pide al modelo los patrones de una búsqueda ya hecha.
 *
 * Viaja el identificador del TRABAJO y no los anuncios: ver `lib/tools/espia.ts`. Acá eso se nota en
 * que esta función no recibe la lista aunque la pantalla la tenga en la mano.
 */
export async function analizarAnuncios(trabajo: string): Promise<ResultadoDelAnalisis> {
  const r = await pedir<{ texto?: string; cortado?: boolean }>('/api/tools/espia', {
    metodo: 'POST',
    cuerpo: { trabajo },
    espera: ESPERA_DE_RUTA_LARGA_MS,
  });
  if (r.tipo === 'datos') {
    return { tipo: 'datos', texto: r.datos.texto ?? '', cortado: r.datos.cortado === true };
  }
  if (r.tipo === 'rechazado') {
    return { tipo: 'fallo', mensaje: mensajeDeRechazo(r.codigo, r.estado, r.detalle) };
  }
  return { tipo: 'fallo', mensaje: SIN_RESPUESTA };
}
