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

import { pedir } from '../http/cliente.ts';

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

export type FuenteDeScraping = 'maps' | 'linkedin' | 'facebook-ads' | 'facebook-pages';

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

export interface EstadoDeTrabajo {
  status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | string;
  results?: { data?: Lead[] };
}

/** Consulta el estado de un trabajo. El backend devuelve `results.data` recién al terminar. */
export async function consultarTrabajo(id: string): Promise<EstadoDeTrabajo | null> {
  const r = await pedir<EstadoDeTrabajo>(`${RUTA}?trabajo=${encodeURIComponent(id)}`);
  return r.tipo === 'datos' ? r.datos : null;
}
