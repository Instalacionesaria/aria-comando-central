// FATHOM Y GOHIGHLEVEL · después de recibir una grabación (la 123; decisiones del usuario del 2026-11-24).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS DOS COSAS QUE HACE
//
//   1. TRAER AL LEAD QUE FALTA. Si el correo del lead no está todavía en nuestra base (la llamada quedó «sin_lead»),
//      lo busca en GHL por correo, en el orden de los candidatos (los externos primero, como decide `participantes.ts`).
//      El primero que GHL tenga se trae a negocio.contactos con `refrescarUnContacto` (la misma lectura que usa la
//      ficha), y la ruta vuelve a procesar la grabación: ahora el lead ya está y la llamada se guarda.
//   2. PONER LA ETIQUETA. Cuando la transcripción quedó guardada, le pone al contacto, en GHL, la etiqueta «asistio»,
//      para que el equipo sepa desde GHL que ese lead tiene su transcripción en Supabase. `ponerEtiquetas` SUMA: no
//      borra las que el contacto ya tiene.
//
// Sólo para la subcuenta de ARIA, con su token de la Private Integration (`resolverAccesoAGhl`, lo pide la ruta).
// Nada de esto puede tumbar el webhook: la transcripción ya está guardada. Cada resultado se anota en
// `recepciones_de_fathom.resultado_en_ghl` y la ruta responde 200 igual.
//
// ── LA ETIQUETA TIENE QUE EXISTIR EN LA SUBCUENTA ───────────────────────────
//
// GHL acepta con un 200 una etiqueta que la subcuenta no tiene y no hace nada (lo dice `ponerEtiquetas`). «asistio» la
// creó el equipo en la subcuenta de ARIA; si algún día se renombra allá, hay que cambiarla acá.
// ═══════════════════════════════════════════════════════════════════════════════

import { conOrganizacion, datos } from '../datos/contexto.ts';
import { contactoPorCorreo, ponerEtiquetas, type FalloDeGhl } from '../ghl/cliente.ts';
import type { AmbitoDeUnCliente } from '../negocio/ambitoDelCliente.ts';
import { refrescarUnContacto } from '../negocio/sincronizar.ts';

/** La etiqueta que dice «este contacto tiene su transcripción de Fathom en Supabase». Es la etapa estándar «Asistió». */
export const ETIQUETA_DE_LA_TRANSCRIPCION = 'asistio';

export interface AccesoListo {
  token: string;
  locationId: string;
}

/** Un fallo de GHL en una línea, sin el token. */
export function textoDelFallo(f: FalloDeGhl): string {
  if (f.tipo === 'sin_respuesta') return `GHL no respondió (${f.causa})`;
  if (f.tipo === 'no_autorizado') return `GHL rechazó el token (${f.estado})`;
  if (f.tipo === 'demasiadas_peticiones') return `GHL pidió esperar (${f.estado})`;
  return `GHL respondió ${f.estado} (${f.codigo})`;
}

export type LeadTraido =
  | { tipo: 'traido'; correo: string; ghlContactId: string }
  | { tipo: 'no_esta' }
  | { tipo: 'fallo'; texto: string };

/**
 * Busca en GHL, por correo y en orden, al primer candidato que exista, y lo trae a negocio.contactos.
 * Un fallo de GHL corta la búsqueda: no se sigue probando correos con un GHL que no responde.
 */
export async function traerElLeadDeGhl(
  acceso: AccesoListo,
  ambito: AmbitoDeUnCliente,
  candidatos: readonly string[],
): Promise<LeadTraido> {
  for (const correo of candidatos) {
    const r = await contactoPorCorreo(acceso, correo);
    if (r.tipo === 'fallo') return { tipo: 'fallo', texto: textoDelFallo(r.fallo) };
    const id = r.datos?.id;
    if (!id) continue;
    const refresco = await conOrganizacion(ambito, () => refrescarUnContacto(acceso, id));
    if (refresco.tipo === 'listo') return { tipo: 'traido', correo, ghlContactId: id };
    if (refresco.tipo === 'fallo') return { tipo: 'fallo', texto: textoDelFallo(refresco.fallo) };
    if (refresco.tipo === 'salteado') return { tipo: 'fallo', texto: `GHL lo tiene pero no se pudo guardar: ${refresco.motivo}` };
    // 'no_esta_en_el_crm': lo borraron entre la búsqueda y la lectura. Se sigue con el siguiente correo.
  }
  return { tipo: 'no_esta' };
}

/** Le pone «asistio» en GHL al contacto de la base. Devuelve lo que se anota en la recepción. */
export async function etiquetarElLead(acceso: AccesoListo, ambito: AmbitoDeUnCliente, contactoId: string): Promise<string> {
  const fila = await conOrganizacion(ambito, () =>
    datos().selectFrom('contactos').select('ghl_contact_id').where('id', '=', contactoId).executeTakeFirst(),
  );
  if (!fila?.ghl_contact_id) return 'etiqueta_fallo: el contacto no tiene id de GHL';
  const r = await ponerEtiquetas(acceso, fila.ghl_contact_id, [ETIQUETA_DE_LA_TRANSCRIPCION]);
  return r.tipo === 'datos' ? `etiqueta_puesta: ${ETIQUETA_DE_LA_TRANSCRIPCION}` : `etiqueta_fallo: ${textoDelFallo(r.fallo)}`;
}

/** Anota en la recepción lo que pasó en GHL (se suma a lo que ya decía, separado por « · »). */
export async function anotarResultadoEnGhl(ambito: AmbitoDeUnCliente, recordingId: string, texto: string): Promise<void> {
  await conOrganizacion(ambito, async () => {
    const previa = await datos()
      .selectFrom('recepciones_de_fathom')
      .select(['id', 'resultado_en_ghl'])
      .where('recording_id', '=', recordingId)
      .executeTakeFirst();
    if (!previa) return;
    const nuevo = [previa.resultado_en_ghl, texto].filter(Boolean).join(' · ').slice(0, 1000);
    await datos().updateTable('recepciones_de_fathom').set({ resultado_en_ghl: nuevo }).where('id', '=', previa.id).execute();
  });
}
