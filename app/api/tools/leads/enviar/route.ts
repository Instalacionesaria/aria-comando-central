// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0305 — Toda petición externa sale por el cliente de la casa.
//
// Subir leads seleccionados a GoHighLevel, con una etiqueta.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL NAVEGADOR MANDA IDENTIFICADORES, NO LEADS
//
// La versión de ARIA-brain mandaba **los leads enteros** desde el navegador, junto con el token
// de HighLevel que el alumno pegaba en un formulario. Acá se manda `{ ids, etiqueta, cuentaId? }`
// y nada más, y la diferencia no es de prolijidad:
//
//   1. **Los datos salen de la base, filtrados por RLS.** Un `id` que no sea de esta
//      organización simplemente no devuelve fila, así que no hay forma de subir al CRM de una
//      empresa un lead que no le pertenece — ni por error de código ni a propósito.
//
//   2. **El token nunca pasa por el navegador.** Sale cifrado de las credenciales del cliente
//      elegido —el principal, las de la empresa; los demás, las suyas—, se descifra del lado del
//      servidor y se usa. En ARIA-brain el alumno lo pegaba en cada sesión y viajaba en cada envío.
//
//   3. **El contenido no se puede falsear.** Con los leads llegando del cliente, cualquiera con
//      la consola abierta podía inyectar contactos inventados en el CRM de su propia empresa.
//      Suena menor hasta que alguien lo usa para meter mil filas basura.
//
// ── A QUÉ CLIENTE VA (el nivel 3) ────────────────────────────────────────────
//
// Al que dice el pedido (`cuentaId`), si es uno ACTIVO de la empresa; sin decirlo, al principal,
// que con un solo cliente es el único y es lo de siempre. No es el foco: Tools es de la empresa
// entera (la cabecera dice «Toda la empresa»), y que el foco eligiera el destino decidiría en
// silencio una escritura irreversible al CRM de otro negocio. Tampoco es «el cliente del lead»:
// un lead scrapeado no es un contacto del CRM y no tiene cliente. La pantalla muestra el selector
// con más de un cliente activo, y la respuesta nombra al cliente sólo entonces.
//
// ── POR QUÉ EL TOKEN YA ESTABA Y NO HIZO FALTA UNA COLUMNA NUEVA ────────────
//
// `crm_token_cifrado` **es el Private Integration Token** de la subcuenta —lo dice
// `resolver.ts` y lo confirma `lib/ghl/cliente.ts`: *"el PIT es un token OAuth fijo"*— y
// `crm_cuenta_id` **es el Location ID**. O sea que los dos datos que el flujo de n8n pide con
// los nombres `apiToken` y `locationId` ya viven en esta base, cifrado el primero, desde la
// migración 006. `resolverAccesoAGhl` los devuelve juntos.
//
// La pantalla, entonces, sólo pide la ETIQUETA. Lo demás lo carga un administrador una vez en
// Ajustes, que es donde corresponde: un secreto de la empresa no se pide en una pantalla de
// operación a cualquiera que tenga permiso de editar.
//
// ── Y POR QUÉ ESTA RUTA NO ABRE LOS DOS CONTEXTOS A LA VEZ ──────────────────
//
// Lee credenciales (identidad) y lee leads (negocio). Son dos transacciones, en ese orden, y
// primero la que puede fallar sin costo: si falta el token, no tiene sentido haber leído nada.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { clientesQueTrae, type ClienteQueSeTrae } from '../../../../../lib/autorizacion/ambito.ts';
import type { Contexto } from '../../../../../lib/autorizacion/sesion.ts';
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../../../../lib/datos/contexto.ts';
import { pedirExterno } from '../../../../../lib/http/cliente.ts';
import {
  resolverAccesoAGhl,
  TEXTO_DE_FALTA_GHL,
  TEXTO_DE_FALTA_GHL_DEL_CLIENTE,
} from '../../../../../lib/credenciales/resolver.ts';

export const PANTALLA = 'tools';

/**
 * Subir cien contactos a una API ajena por un flujo de n8n no es instantáneo. No tanto como un
 * scraping —no hay actor que arrancar— pero el tope por omisión de la plataforma es corto.
 */
export const maxDuration = 60;

/**
 * Cuántos leads se pueden subir de una vez.
 *
 * Es el tamaño de una página de la pantalla, y ése es el argumento: la selección se hace sobre
 * lo que se está viendo, así que un lote nunca puede ser más grande que una página. Un tope más
 * alto sólo habilitaría un cuerpo de petición armado a mano.
 */
const MAXIMO_POR_LOTE = 100;

/** Dónde vive el flujo que crea los contactos en GoHighLevel. */
function webhook(): string | null {
  const url = process.env.N8N_HIGHLEVEL_WEBHOOK;
  return url && url.trim().length > 0 ? url.trim() : null;
}

/**
 * El cliente del envío, entre los ACTIVOS de la empresa (`clientesQueTrae`, el principal primero): el del pedido o,
 * sin decirlo, el principal. Sin tocar la base: la lista es la de la sesión. Uno de otra empresa, de baja o que no es
 * un id es `'ajeno'` —el mismo 404 que uno que no existe (`ADR-0501`)—; uno en pausa, `'en_pausa'`, porque nadie lo
 * mira y su subcuenta puede ya no ser nuestra.
 */
function clienteDelEnvio(
  contexto: Contexto,
  activos: readonly ClienteQueSeTrae[],
  pedido: unknown,
): ClienteQueSeTrae | 'en_pausa' | 'ajeno' {
  if (pedido === undefined || pedido === null || pedido === '') return activos.find((c) => c.esPorOmision) ?? 'ajeno';
  if (typeof pedido !== 'string') return 'ajeno';
  const activo = activos.find((c) => c.id === pedido);
  if (activo) return activo;
  return contexto.cuentas.visibles.some((c) => c.id === pedido) ? 'en_pausa' : 'ajeno';
}

export async function POST(peticion: Request): Promise<Response> {
  // `tools.editar` y no `tools.ver`: esto escribe en un sistema externo a nombre de la empresa.
  // Es la misma línea que separa sondear un scraping de arrancarlo.
  const contexto = await exigir(peticion, ['tools.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const url = webhook();
  if (!url) return rechazo('motor_no_configurado', 'Falta N8N_HIGHLEVEL_WEBHOOK.');

  let cuerpo: { ids?: unknown; etiqueta?: unknown; cuentaId?: unknown };
  try {
    cuerpo = (await peticion.json()) as { ids?: unknown; etiqueta?: unknown; cuentaId?: unknown };
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON');
  }

  // Los identificadores se filtran a cadenas y se DEDUPLICAN: dos veces el mismo id crearía dos
  // contactos iguales en el CRM, y deshacer eso es a mano.
  const ids = Array.isArray(cuerpo.ids)
    ? [...new Set(cuerpo.ids.filter((v): v is string => typeof v === 'string' && v.length > 0))]
    : [];
  if (ids.length === 0) return rechazo('peticion_invalida', 'No seleccionaste ningún lead.');
  if (ids.length > MAXIMO_POR_LOTE) {
    return rechazo('peticion_invalida', `El máximo por envío es ${MAXIMO_POR_LOTE} leads.`);
  }

  /* La etiqueta es lo único que escribe la persona. Se recorta y se topea porque va a ser una
     etiqueta en el CRM de la empresa: una de mil caracteres queda ahí para siempre y no se
     puede filtrar por ella. Vacía se cae al valor que usaba ARIA-brain, así que un lote sin
     etiqueta sigue siendo identificable como nuestro. */
  const etiqueta = String(cuerpo.etiqueta ?? '').trim().slice(0, 60) || 'ARIA';

  // ── 0 · El cliente, antes que nada: un destino que no es de la empresa no lee ni el token ──
  const activos = clientesQueTrae(contexto, PANTALLA);
  const cliente = clienteDelEnvio(contexto, activos, cuerpo.cuentaId);
  if (cliente === 'ajeno') return rechazo('no_encontrado', 'Ese cliente no es de esta empresa.');
  if (cliente === 'en_pausa') {
    return rechazo('peticion_invalida', 'Ese cliente está en pausa: no se le suben leads hasta reactivarlo.');
  }
  // Con un solo cliente activo, la respuesta de siempre: el nombre sólo dice algo si hubo que elegir.
  const varios = activos.length > 1;

  // ── 1 · Las credenciales, primero ──────────────────────────────────────────
  //
  // Antes de leer un solo lead: si falta el token, leerlos habría sido trabajo tirado. Y el
  // mensaje que llega a la pantalla dice QUÉ falta y dónde se carga, no "no se pudo".
  const acceso = await conIdentidad(async (db) =>
    resolverAccesoAGhl(db, contexto.orgEfectiva, cliente),
  );
  if (acceso.tipo === 'falta') {
    // La del principal se carga en Ajustes › Credenciales; la de otro cliente, en su Conexión.
    const textos = cliente.esPorOmision ? TEXTO_DE_FALTA_GHL : TEXTO_DE_FALTA_GHL_DEL_CLIENTE;
    return rechazo('credenciales_incompletas', textos[acceso.que]);
  }

  // ── 2 · Los leads, de la base y no del navegador ───────────────────────────
  // Los leads son de la empresa (no tienen cliente): se leen con la organización entera.
  const leads = await conOrganizacion(contexto.orgEfectiva, async () =>
    datos()
      .selectFrom('public.aria_cc_scraper_leads')
      .select(['id', 'source', 'name', 'email', 'phone', 'website', 'location', 'category'])
      .where('id', 'in', ids)
      .execute(),
  );

  /* Menos filas que identificadores significa que algunos no son de esta organización o ya no
     existen. NO se sigue con los que sí: quien apretó "enviar 20" tiene que enterarse de que
     se subirían 14, porque el resto lo va a buscar en el CRM y no va a estar. */
  if (leads.length !== ids.length) {
    return rechazo(
      'peticion_invalida',
      `Seleccionaste ${ids.length} leads y sólo ${leads.length} siguen disponibles. Recarga la lista.`,
    );
  }

  // ── 3 · Al flujo de n8n ────────────────────────────────────────────────────
  //
  // Los nombres de campo son los que ese flujo ya espera —`apiToken`, `etiqueta`, `locationId`,
  // `leads`— y no se traducen: es el mismo webhook que usa ARIA-brain, y renombrarlos acá
  // significaría que el flujo reciba un objeto sin los campos que busca y cree cero contactos
  // reportando éxito. El token y la location son los del cliente elegido: viaja el token de
  // OTRO negocio a n8n, y lo que n8n guarde de cada ejecución es un riesgo dicho en el 07.
  const r = await pedirExterno<{ ok?: boolean; error?: string }>(url, {
    metodo: 'POST',
    cuerpo: {
      apiToken: acceso.token,
      locationId: acceso.locationId,
      etiqueta,
      leads,
    },
  });

  if (r.tipo === 'sin_respuesta') {
    return rechazo('motor_no_disponible', 'No se pudo conectar con HighLevel.');
  }
  if (r.tipo === 'rechazado') {
    // El detalle del flujo viaja tal cual, por lo mismo que en `scrape/route.ts`: describe el
    // estado del CRM de la empresa —un token sin permiso, una subcuenta equivocada— y no
    // nuestra estructura. Traducirlo a "no se pudo" deja a la pantalla sin nada accionable.
    return rechazo('motor_rechazo', r.detalle ?? `HighLevel respondió ${r.estado}.`);
  }

  return ok({ enviados: leads.length, etiqueta, ...(varios ? { cliente: cliente.nombre } : {}) });
}
