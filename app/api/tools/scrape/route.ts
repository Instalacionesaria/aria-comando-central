// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0704 — Las respuestas de error no revelan estructura.
//
// El proxy autenticado entre esta aplicación y el backend de scraping.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL NAVEGADOR NUNCA HABLA DIRECTO CON EL BACKEND, Y NO ES POR PROLIJIDAD
//
// El backend de scraping lleva **un monedero con saldo de leads por organización**. Si el
// navegador pudiera llamarlo, cualquiera podría mandar el identificador de otra organización y
// gastarle los leads. Así que ese identificador se resuelve ACÁ, del lado del servidor, desde
// la sesión — nunca llega del cuerpo de la petición.
//
// Es la misma regla que `lib/fundaciones/almacen.ts` aplica al `cliente_id` del almacén, y por
// el mismo motivo. Acá pesa más: allá lo que se protege es el trabajo del alumno; acá, su saldo.
//
// ── LA LLAVE ES `org_id`, Y ESO CAMBIÓ TODO ─────────────────────────────────
//
// Hasta la migración `006_aria_cc_scraper.sql` esta ruta resolvía
// `organizaciones_credenciales.fundaciones_cliente_id` —el identificador del alumno en el hub—
// porque el monedero vivía en una base ajena (`urxu…`) indexada por esa llave. De ahí salía el
// freno que este archivo documentaba en voz alta: *"una organización sin vínculo con el hub NO
// PUEDE SCRAPEAR"*, y el código `sin_alumno_vinculado` que llegaba a la pantalla como un cartel
// rojo que sólo se arreglaba corriendo SQL a mano.
//
// **Ese freno ya no existe.** Las tres tablas del scraper viven en la base de este proyecto y
// su llave es `org_id`, que toda organización tiene por existir. Un cliente High Ticket que
// nazca por Walter scrapea desde su primer minuto, sin que nadie lo vincule.
//
// Queda dicho para que no se reintroduzca: si algún día hace falta `fundaciones_cliente_id`
// acá, es señal de que algo volvió a atarse al hub. El vínculo sigue haciendo falta para
// Fundaciones — no para esto.
//
// ── LAS RESPUESTAS DEL BACKEND SE DEJAN PASAR ───────────────────────────────
//
// Su 403 por saldo agotado, su 404 de trabajo inexistente y su detalle de error viajan tal
// cual. Es una excepción deliberada a `ADR-0704`: ese texto no describe NUESTRA estructura —es
// el estado del monedero de la organización— y traducirlo a "no se pudo" dejaría a la pantalla
// sin poder decir la única cosa accionable, que es "se te acabaron los leads".
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { pedirExterno } from '../../../../lib/http/cliente.ts';

export const PANTALLA = 'tools';

/**
 * Cuántos anuncios pide una búsqueda del Espía.
 *
 * Es el número del hub, y el backend lo usa como valor por omisión si no llega. Se manda igual y
 * explícito: que el tamaño de una corrida —lo que se le pide a un actor que se cobra— dependa de un
 * valor por omisión del otro lado significa que cambiarlo allá cambia lo que gastamos acá sin que
 * nadie lo decida.
 */
const ANUNCIOS_POR_BUSQUEDA = 60;

/**
 * Un scraping tarda minutos, pero ESTA ruta no espera: arranca el trabajo y devuelve su
 * identificador. Lo que tarda es el sondeo, y cada sondeo es una petición corta. Aun así se sube
 * el tope, porque el backend a veces tarda en aceptar el arranque y cortar ahí dejaría un trabajo
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
  orgId: string,
): { camino: string; cuerpo: Record<string, unknown> } | null {
  // `org_id` va en el cuerpo de las cuatro, y sale de la sesión. Que esté acá y no en el
  // `switch` es deliberado: una fuente nueva que se agregue abajo lo hereda sin que nadie se
  // acuerde de ponerlo, y olvidarlo significaría gastarle el saldo a la organización equivocada.
  const base = { org_id: orgId, timestamp: new Date().toISOString() };

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
    /* El Espía de Anuncios. **Es la única fuente que NO gasta saldo de leads**, y así está escrito
       del otro lado: `start_ad_spy` abre el monedero de la organización —para que quede
       provisionada— y no valida saldo, porque espiar a la competencia es investigación y no
       produce leads. Sus resultados tampoco entran a `aria_cc_scraper_leads`: viven en el
       `results_data` del trabajo.

       Eso NO la saca de esta ruta ni de `tools.editar`. Sigue lanzando un actor de Apify que se
       cobra en la factura, y el trabajo queda en la misma tabla que los otros cuatro — que es de
       donde el Panel de Monitoreo cuenta los scrapeos y su costo. */
    case 'ad-spy':
      return {
        camino: '/start-ad-spy',
        cuerpo: {
          ...base,
          query: String(p.query ?? ''),
          country: String(p.country ?? 'ALL'),
          count: Number(p.count) || ANUNCIOS_POR_BUSQUEDA,
        },
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

  // La organización va en la consulta, y el backend FILTRA por ella: un trabajo de otra
  // organización responde 404. Antes bastaba conocer el identificador del trabajo para leer sus
  // resultados —con el proxy por delante no era alcanzable desde fuera, pero el backend no lo
  // impedía por sí mismo—. Ahora sí, y eso es lo que hace que el aislamiento no dependa de que
  // esta ruta esté bien escrita.
  const consulta =
    `${url}/job/${encodeURIComponent(trabajo)}` +
    `?org_id=${encodeURIComponent(contexto.orgEfectiva)}`;

  const r = await alBackend(consulta, {});
  if (r instanceof Response) return r;
  return ok(r.datos as Record<string, unknown>);
}

/**
 * Arrancar un scraping. Pide `tools.editar`, y esa es LA decisión de esta ruta.
 *
 * Es la segunda operación del proyecto que le cuesta plata a la organización —la otra es generar
 * un documento— y acá el gasto no es en tokens: son leads de un monedero con saldo. Pedir
 * `tools.ver` habría dejado que cualquiera con acceso de lectura vaciara el saldo.
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

  const arranque = construirArranque(
    String(cuerpo.fuente ?? ''),
    cuerpo,
    contexto.orgEfectiva,
  );
  if (!arranque) return rechazo('no_encontrado');

  const r = await alBackend(`${url}${arranque.camino}`, {
    metodo: 'POST',
    cuerpo: arranque.cuerpo,
  });
  if (r instanceof Response) return r;
  return ok(r.datos as Record<string, unknown>);
}
