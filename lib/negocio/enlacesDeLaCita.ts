// Los dos enlaces que salen de la cita de un contacto: la sala y el reagendado.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO NO SON LINKS CONFIGURADOS
//
// `lib/negocio/enlacesRapidos.ts` guarda los que carga la empresa: los de cobro del closer, los de
// calendario del setter. Son de la EMPRESA y no cambian por contacto.
//
// Estos dos son de la CITA, así que no hay nada que configurar y no puede haberlo: cambian con cada
// contacto y con cada reagendado. Se piden con la ficha y salen del último barrido de la agenda.
//
// ── QUÉ CITA, Y POR QUÉ NO ES «LA PRÓXIMA» ─────────────────────────────────
//
// Se pidió «la más cercana a ahora», y significa esto: **la próxima si hay una, y si no la última
// que pasó**. No es la más cercana en tiempo absoluto — con una cita de hace una hora y otra dentro
// de tres días, gana la de dentro de tres días.
//
// El caso pasado es el que obliga a incluirlo, y es el que motivó todo esto: alguien no se conectó
// al meet, y lo que hay que mandarle es el link para reagendar. Con «solo la próxima», después de
// que la cita pasa no habría link que mandar — que es exactamente el momento en que se necesita.
//
// ── SIN CANCELADAS, Y ESO NO ES UN DETALLE ─────────────────────────────────
//
// Medido en el primer barrido real: **411 de 1052 citas están canceladas, el 39 %**. Mandarle a
// alguien la sala de una cita cancelada lo hace entrar a una reunión que nadie va a atender, y el
// link de reagendar de una cancelada abre una cita que ya no existe.
//
// El filtro es `noCancelada()`, la MISMA función que usa la cola de Mi Día y el ícono de la fila. En
// este repositorio esa definición vive en un solo lugar a propósito: cuando estuvo en dos, un ícono
// contaba reuniones que nadie tuvo.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { enlaceDeReagendamiento } from '../ghl/agendar.ts';
import { noCancelada } from './citas.ts';

export interface EnlacesDeLaCita {
  /** Cuándo es o fue. La interfaz lo dibuja en la zona de la empresa. */
  inicioEl: Date;
  /** La sala del meet. `null` cuando el CRM no la trajo — medido: 23 de 1052. */
  meet: string | null;
  /** El link para reagendar ESA cita. `null` si falta el calendario o el evento. */
  reagendar: string | null;
}

/**
 * Los enlaces de la cita más relevante del contacto, o `null` si no tiene ninguna aprovechable.
 *
 * **Corre dentro de `conOrganizacion(`.**
 *
 * @param dominioDeReservas El de la empresa, o `null` para el de GoHighLevel.
 */
export async function enlacesDeLaCita(
  contactoId: string,
  dominioDeReservas: string | null,
): Promise<EnlacesDeLaCita | null> {
  const cita = await datos()
    .selectFrom('citas')
    .select(['inicio_el', 'sala_url', 'ghl_calendario_id', 'ghl_evento_id'])
    .where('contacto_id', '=', contactoId)
    .where(noCancelada('estado_ghl'))
    /* ── EL ORDEN ES LA REGLA, ESCRITO EN TRES LÍNEAS ──────────────────────
     *
     * 1 · Las futuras primero. `inicio_el >= now()` es un booleano, y `desc` pone `true` arriba.
     * 2 · Entre las futuras, la más próxima.
     * 3 · Si no hay ninguna futura, la última que pasó.
     *
     * Se hace en UNA consulta y no en dos con un `if`: con dos, el caso «no tiene futura» cuesta un
     * viaje más justo en la pantalla que se abre a cada rato, y la regla queda partida en el código
     * en vez de leerse de corrido acá. */
    .orderBy(sql`inicio_el >= now() desc`)
    .orderBy(sql`case when inicio_el >= now() then inicio_el end asc nulls last`)
    .orderBy('inicio_el', 'desc')
    .limit(1)
    .executeTakeFirst();

  if (!cita) return null;

  /* La cadena vacía cuenta como ausencia. Es la misma regla que todo el trato con este proveedor —y
     acá está medido: `address` viene `""` en 23 de 1052 citas—. Sin esto, el menú ofrecería un
     «Link del meet» que no lleva a ninguna parte. */
  const sala = (cita.sala_url ?? '').trim();
  const meet = sala === '' ? null : sala;
  const reagendar = enlaceDeReagendamiento(
    dominioDeReservas,
    cita.ghl_calendario_id,
    cita.ghl_evento_id,
  );

  /* Sin ninguno de los dos, no hay cita que ofrecer. Devolver el objeto con los dos en `null` haría
     que la interfaz tuviera que volver a decidir lo mismo, y en dos lugares eso divergiría. */
  if (meet === null && reagendar === null) return null;

  return { inicioEl: cita.inicio_el, meet, reagendar };
}
