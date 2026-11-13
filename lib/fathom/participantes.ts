// QUIÉNES ESTUVIERON EN LA LLAMADA, y quiénes pueden ser el lead.
//
// ═══════════════════════════════════════════════════════════════════════════════
// DE DÓNDE SALE CADA COSA
//
// Fathom manda los invitados del CALENDARIO (`calendar_invitees`), no quién entró de verdad. Cada uno trae su correo
// (puede ser nulo) y si es externo según Fathom (`is_external`). Además manda quién grabó (`recorded_by`) y, en cada
// línea de la transcripción, el correo del invitado con que casó el orador (`matched_calendar_invitee_email`), que es
// nulo si no hubo coincidencia exacta.
//
//   · `externo`: lo que dice Fathom (otro dominio que el de la organización en Fathom).
//   · `del_equipo`: quien grabó, o un correo que es de un usuario de la organización (un closer con Gmail personal
//     también es del equipo). NO se deduce del dominio: un lead con correo del mismo dominio que el equipo (la prueba
//     con mruiz@ariaia.com, 2026-11-13) es interno para Fathom y sigue pudiendo ser el lead.
//   · `hablo`: algún orador de la transcripción casó con su correo.
//
// LOS CANDIDATOS A LEAD son los invitados con correo que no son del equipo, sin repetir: primero los externos y después
// los internos. No se elige «el primero», como hace `prospectoDe` del analizador (que no se toca): con el lead y su socio
// en la llamada, el primero puede ser el socio. Quien busca el lead prueba todos contra los contactos, y si casa algún
// externo, los internos no cuentan.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FathomMeeting } from '../analizadores/nucleo/fathom.ts';

export interface Participante {
  nombre: string | null;
  email: string | null;
  externo: boolean;
  del_equipo: boolean;
  hablo: boolean;
}

/** Un correo comparable: sin espacios y en minúsculas. Vacío = sin correo. */
export function correoComparable(email: string | null | undefined): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * Los participantes y los correos candidatos a lead.
 *
 * @param correosDelEquipo Los correos de los usuarios de la organización, en cualquier caja.
 */
export function participantesDe(
  reunion: FathomMeeting,
  correosDelEquipo: readonly string[],
): { participantes: Participante[]; candidatos: string[]; externos: string[] } {
  const equipo = new Set(correosDelEquipo.map(correoComparable).filter(Boolean));
  const grabo = correoComparable(reunion.recorded_by?.email);
  if (grabo) equipo.add(grabo);

  const hablaron = new Set(
    (Array.isArray(reunion.transcript) ? reunion.transcript : [])
      .map((t) => correoComparable(t.speaker?.matched_calendar_invitee_email))
      .filter(Boolean),
  );

  const participantes: Participante[] = [];
  const vistos = new Set<string>();
  for (const i of Array.isArray(reunion.calendar_invitees) ? reunion.calendar_invitees : []) {
    const email = correoComparable(i.email);
    if (email && vistos.has(email)) continue;
    if (email) vistos.add(email);
    const externo = i.is_external === true;
    participantes.push({
      nombre: typeof i.name === 'string' && i.name.trim() !== '' ? i.name.trim() : null,
      email: email || null,
      externo,
      del_equipo: email !== '' && equipo.has(email),
      hablo: email !== '' && hablaron.has(email),
    });
  }

  // Quien grabó, si el calendario no lo trajo (una llamada sin agendar trae la lista vacía).
  if (grabo && !vistos.has(grabo)) {
    participantes.push({
      nombre: typeof reunion.recorded_by?.name === 'string' ? reunion.recorded_by.name : null,
      email: grabo,
      externo: false,
      del_equipo: true,
      hablo: hablaron.has(grabo),
    });
  }

  const posibles = participantes.filter((p) => !p.del_equipo && p.email);
  const externos = posibles.filter((p) => p.externo).map((p) => p.email as string);
  const internos = posibles.filter((p) => !p.externo).map((p) => p.email as string);
  return { participantes, candidatos: [...externos, ...internos], externos };
}
