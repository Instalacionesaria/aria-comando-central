// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0704 — Las respuestas de error no revelan estructura.
//
// El proxy autenticado entre esta aplicación y el backend de scraping.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL NAVEGADOR NUNCA HABLA DIRECTO CON EL BACKEND, Y NO ES POR PROLIJIDAD
//
// El backend de scraping identifica al cliente por `usuarios_scraper.cliente_id`, y sobre esa
// llave lleva **un monedero con saldo de leads**. Si el navegador pudiera llamarlo, cualquiera
// podría mandar el `cliente_id` de otro y gastarle los leads. Así que ese identificador se
// resuelve ACÁ, del lado del servidor, desde la organización de la sesión — nunca llega del
// cuerpo de la petición.
//
// Es la misma regla que `lib/fundaciones/almacen.ts` aplica al `cliente_id` del almacén, y por el
// mismo motivo. Acá pesa más: allá lo que se protege es el trabajo del alumno; acá, su saldo.
//
// ── POR QUÉ ES EL ID DEL HUB Y NO EL `org_id` ───────────────────────────────
//
// Porque el monedero vive en la base del backend de scraping, que es un TERCER sistema y no lo
// controlamos desde acá: su llave es `aria_brain_clientes.id`. Este proyecto la obtiene de
// `identidad.organizaciones_credenciales.fundaciones_cliente_id`, igual que Fundaciones.
//
// Consecuencia que hay que decir en voz alta: **una organización sin vínculo con el hub no puede
// scrapear**, y eso NO se arregla mudando el almacén a `aria_cc_foundations` — el identificador
// vive afuera. Para los alumnos que nazcan por Walter hay que decidir aparte quién les abre el
// monedero. Responde `sin_alumno_vinculado`, que es exactamente lo que pasa.
//
// ── LAS RESPUESTAS DEL BACKEND SE DEJAN PASAR ───────────────────────────────
//
// Su 403 por saldo agotado, su 404 de cuenta inexistente y su detalle de error viajan tal cual. Es
// una excepción deliberada a `ADR-0704`: ese texto no describe NUESTRA estructura —es el estado
// del monedero del alumno— y traducirlo a "no se pudo" dejaría a la pantalla sin poder decir la
// única cosa accionable, que es "se te acabaron los leads".
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { pedirExterno } from '../../../../lib/http/cliente.ts';
import { resolverAlumnoDeFundaciones } from '../../../../lib/credenciales/resolver.ts';

export const PANTALLA = 'tools';

/**
 * Un scraping tarda minutos, pero ESTA ruta no espera: arranca el trabajo y devuelve su
 * identificador. Lo que tarda es el sondeo, y cada sondeo es una petición corta. Aun así se sube el
 * tope, porque el backend a veces tarda en aceptar el arranque y cortar ahí dejaría un trabajo
 * corriendo del que nadie sabe el identificador — leads pagados que no se pueden recuperar.
 */
export const maxDuration = 60;

/**
 * De dónde sale el backend. Sin valor por omisión escrito acá: una URL de reserva es la forma de
 * que un despliegue mal configurado apunte en silencio al backend equivocado — o al de otro
 * entorno, gastando leads de verdad. Ausente = se dice.
 */
function backend(): string | null {
  const url = process.env.SCRAPER_BACKEND_URL;
  return url && url.trim().length > 0 ? url.replace(/\/+$/, '') : null;
}

/** El `cliente_id` del alumno, resuelto desde la organización de la sesión. Nunca del navegador. */
async function alumnoDe(orgEfectiva: string) {
  return conIdentidad(async (db) => resolverAlumnoDeFundaciones(db, orgEfectiva));
}

/**
 * Fuente → ruta del backend y cuerpo con el formato que espera cada actor.
 *
 * Los nombres de campo son los del backend y NO se traducen: `businessType` en Maps, `job_title` y
 * `number_of_leads` en LinkedIn. La inconsistencia entre camello y guiones bajos es de ellos, y
 * "arreglarla" acá significa que el actor reciba un objeto sin los campos que espera y devuelva
 * cero resultados — cobrando la corrida igual.
 */
function construirArranque(
  fuente: string,
  p: Record<string, unknown>,
  clienteId: string,
): { camino: string; cuerpo: Record<string, unknown> } | null {
  const base = { cliente_id: clienteId, timestamp: new Date().toISOString() };

  switch (fuente) {
    case 'maps':
      return {
        camino: '/start-scraping',
        cuerpo: {
          ...base,
          businessType: String(p.businessType ?? ''),
          location: String(p.location ?? ''),
          getEmails: p.getEmails !== false,
          getBusinessModel: false,
          maxLeads: Number(p.maxLeads) || 100,
        },
      };
    case 'linkedin':
      return {
        camino: '/start-linkedin-scraping',
        cuerpo: {
          ...base,
          job_title: String(p.jobTitle ?? ''),
          country: String(p.country ?? ''),
          state: String(p.state ?? ''),
          number_of_leads: Number(p.numberOfLeads) || 100,
        },
      };
    case 'facebook-ads':
      return {
        camino: '/start-facebook-ads-scraping',
        cuerpo: { ...base, url: String(p.url ?? '') },
      };
    case 'facebook-pages':
      return {
        camino: '/start-facebook-pages-scraping',
        cuerpo: { ...base, pages: Array.isArray(p.pages) ? p.pages : [] },
      };
    default:
      return null;
  }
}

/**
 * Habla con el backend y traduce sus tres formas de fallar, sin colapsarlas.
 *
 * Por `pedirExterno` y no con `fetch` a mano: `ADR-0305` exige que TODA petición salga por el
 * cliente de la casa, y no es burocracia — ese cliente pone el tiempo de espera. Un `fetch` sin
 * plazo contra un backend colgado retiene la función hasta que la plataforma la corta, y el
 * síntoma es una pantalla que gira para siempre.
 */
async function alBackend(
  url: string,
  opciones: { metodo?: string; cuerpo?: unknown } = {},
): Promise<{ tipo: 'datos'; datos: unknown } | Response> {
  const r = await pedirExterno<unknown>(url, opciones);

  if (r.tipo === 'sin_respuesta') {
    return rechazo('motor_no_disponible', 'No se pudo conectar con el motor de scraping.');
  }
  if (r.tipo === 'rechazado') {
    // El detalle del backend viaja tal cual. Ver el encabezado: es el estado del monedero, no
    // nuestra estructura, y es lo único accionable que la pantalla puede mostrar.
    return rechazo('motor_rechazo', r.detalle ?? `El motor respondió ${r.estado}.`);
  }
  return { tipo: 'datos', datos: r.datos };
}

/**
 * Consultar un trabajo. Pide `tools.ver` y no `tools.editar`: sondear no gasta nada, y el sondeo
 * corre cada cinco segundos durante minutos.
 */
export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tools.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const url = backend();
  if (!url) return rechazo('motor_no_configurado', 'Falta SCRAPER_BACKEND_URL.');

  const trabajo = new URL(peticion.url).searchParams.get('trabajo');
  if (!trabajo) return rechazo('peticion_invalida', 'Falta el identificador del trabajo.');

  // El identificador del trabajo NO se usa para autorizar: el backend ya lo ata a su `cliente_id`.
  // Se resuelve el alumno igual, para que una organización sin vínculo reciba el mismo código acá
  // que al intentar arrancar — y no un sondeo que consulta el trabajo de otro.
  const alumno = await alumnoDe(contexto.orgEfectiva);
  if (alumno.tipo === 'falta') return rechazo(alumno.que);

  const r = await alBackend(`${url}/job/${encodeURIComponent(trabajo)}`, {});
  if (r instanceof Response) return r;
  return ok(r.datos as Record<string, unknown>);
}

/**
 * Arrancar un scraping. Pide `tools.editar`, y esa es LA decisión de esta ruta.
 *
 * Es la segunda operación del proyecto que le cuesta plata a la organización —la otra es generar
 * un documento— y acá el gasto no es en tokens: son leads de un monedero con saldo. Pedir
 * `tools.ver` habría dejado que cualquiera con acceso de lectura vaciara el saldo del alumno.
 */
export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tools.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const url = backend();
  if (!url) return rechazo('motor_no_configurado', 'Falta SCRAPER_BACKEND_URL.');

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await peticion.json()) as Record<string, unknown>;
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON');
  }

  const alumno = await alumnoDe(contexto.orgEfectiva);
  if (alumno.tipo === 'falta') return rechazo(alumno.que);

  const arranque = construirArranque(String(cuerpo.fuente ?? ''), cuerpo, alumno.clienteId);
  if (!arranque) return rechazo('no_encontrado');

  const r = await alBackend(`${url}${arranque.camino}`, {
    metodo: 'POST',
    cuerpo: arranque.cuerpo,
  });
  if (r instanceof Response) return r;
  return ok(r.datos as Record<string, unknown>);
}
