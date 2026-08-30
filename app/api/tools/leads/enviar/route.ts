// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0305 — Toda petición externa sale por el cliente de la casa.
//
// Subir leads seleccionados a GoHighLevel, con una etiqueta.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL NAVEGADOR MANDA IDENTIFICADORES, NO LEADS
//
// La versión de ARIA-brain mandaba **los leads enteros** desde el navegador, junto con el token
// de HighLevel que el alumno pegaba en un formulario. Acá se manda `{ ids, etiqueta }` y nada
// más, y la diferencia no es de prolijidad:
//
//   1. **Los datos salen de la base, filtrados por RLS.** Un `id` que no sea de esta
//      organización simplemente no devuelve fila, así que no hay forma de subir al CRM de una
//      empresa un lead que no le pertenece — ni por error de código ni a propósito.
//
//   2. **El token nunca pasa por el navegador.** Sale cifrado de
//      `organizaciones_credenciales`, se descifra del lado del servidor y se usa. En ARIA-brain
//      el alumno lo pegaba en cada sesión y viajaba en cada envío.
//
//   3. **El contenido no se puede falsear.** Con los leads llegando del cliente, cualquiera con
//      la consola abierta podía inyectar contactos inventados en el CRM de su propia empresa.
//      Suena menor hasta que alguien lo usa para meter mil filas basura.
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
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../../../../lib/datos/contexto.ts';
import { pedirExterno } from '../../../../../lib/http/cliente.ts';
import {
  resolverAccesoAGhl,
  TEXTO_DE_FALTA_GHL,
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

export async function POST(peticion: Request): Promise<Response> {
  // `tools.editar` y no `tools.ver`: esto escribe en un sistema externo a nombre de la empresa.
  // Es la misma línea que separa sondear un scraping de arrancarlo.
  const contexto = await exigir(peticion, ['tools.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const url = webhook();
  if (!url) return rechazo('motor_no_configurado', 'Falta N8N_HIGHLEVEL_WEBHOOK.');

  let cuerpo: { ids?: unknown; etiqueta?: unknown };
  try {
    cuerpo = (await peticion.json()) as { ids?: unknown; etiqueta?: unknown };
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

  // ── 1 · Las credenciales, primero ──────────────────────────────────────────
  //
  // Antes de leer un solo lead: si falta el token, leerlos habría sido trabajo tirado. Y el
  // mensaje que llega a la pantalla dice QUÉ falta y dónde se carga, no "no se pudo".
  const acceso = await conIdentidad(async (db) =>
    resolverAccesoAGhl(db, contexto.orgEfectiva),
  );
  if (acceso.tipo === 'falta') {
    return rechazo('credenciales_incompletas', TEXTO_DE_FALTA_GHL[acceso.que]);
  }

  // ── 2 · Los leads, de la base y no del navegador ───────────────────────────
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
      `Seleccionaste ${ids.length} leads y sólo ${leads.length} siguen disponibles. Recargá la lista.`,
    );
  }

  // ── 3 · Al flujo de n8n ────────────────────────────────────────────────────
  //
  // Los nombres de campo son los que ese flujo ya espera —`apiToken`, `etiqueta`, `locationId`,
  // `leads`— y no se traducen: es el mismo webhook que usa ARIA-brain, y renombrarlos acá
  // significaría que el flujo reciba un objeto sin los campos que busca y cree cero contactos
  // reportando éxito.
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

  return ok({ enviados: leads.length, etiqueta });
}
