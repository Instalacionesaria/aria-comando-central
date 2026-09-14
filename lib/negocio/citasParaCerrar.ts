// Las citas de un contacto sobre las que se puede decir si se presentó.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ NO SE REUSA `enlacesDeLaCita`, QUE TAMBIÉN LEE `citas`
//
// Porque contesta otra pregunta, y la diferencia no es de matiz: aquélla busca **la cita que viene**
// para ofrecer el link del meet, y devuelve `null` cuando ninguno de los dos enlaces existe. O sea
// que una cita que ya pasó y no tenía sala —23 de 1052 no la tienen— sale de ahí como si no
// existiera. Para preguntar «¿se presentó?» hace falta exactamente lo contrario: las que YA
// ocurrieron, tengan o no enlaces.
//
// Reusarla habría dado un panel que no ofrece la cita justo cuando hubo plantón, que es el caso que
// más importa registrar.
//
// ── LAS TRES CONDICIONES, Y CADA UNA POR UN DEFECTO CONCRETO ────────────────
//
// 1 · **Ya empezó.** Preguntar por una cita de mañana es pedir un pronóstico, y la respuesta
//     quedaría guardada como un hecho medido.
// 2 · **No está cancelada.** Una cita cancelada no tiene asistencia que medir: nadie faltó a algo
//     que no ocurrió. Contarla como plantón hundiría la tasa con las cancelaciones, que ya tienen
//     su propia cifra al lado.
// 3 · **Alcanzable** (`ghl_calendario_id is not null`). Es el mismo filtro que usa
//     `indicadoresDeCitas`, y tiene que ser el mismo: si el panel ofreciera citas congeladas, la
//     respuesta se guardaría en filas que la cifra no mira — trabajo registrado que no aparece en
//     ninguna parte, y sin ningún error.
//
// La ventana es la misma de la cifra por el mismo motivo. Ofrecer una cita de hace tres meses
// dejaría registrar asistencia fuera de todo período que alguien vaya a mirar.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { noCancelada } from './citas.ts';
import { DIAS_DE_LA_TASA } from './indicadoresDeCitas.ts';

/** Una cita que ya pasó y sobre la que se puede responder. */
export interface CitaParaCerrar {
  id: string;
  inicioEl: Date;
  titulo: string | null;
  /**
   * Lo que ya se respondió, si alguien respondió. **`null` = nadie dijo nada todavía.**
   *
   * Viaja para que el panel muestre la respuesta anterior en vez de preguntar de nuevo en blanco:
   * sin esto, reabrir Avanzar sobre un contacto ya cerrado pediría la asistencia otra vez y la
   * segunda respuesta —dada sin acordarse de la primera— pisaría a la primera.
   */
  asistio: boolean | null;
}

/**
 * Las citas del contacto sobre las que se puede registrar asistencia. **Corre dentro de
 * `conOrganizacion(`.**
 *
 * Vacío es lo normal y no un error: un contacto de zona setter no tiene ninguna, y uno de closer
 * tampoco si su cita todavía no ocurrió.
 */
export async function citasParaCerrar(
  contactoId: string,
  dias = DIAS_DE_LA_TASA,
): Promise<CitaParaCerrar[]> {
  const filas = await datos()
    .selectFrom('citas')
    .select(['id', 'inicio_el', 'titulo', 'asistio'])
    .where('contacto_id', '=', contactoId)
    .where(noCancelada('estado_ghl'))
    .where('ghl_calendario_id', 'is not', null)
    /* La ventana la calcula la BASE. Es el mismo recurso que `indicadoresDeCitas` y por el mismo
       motivo: el «ahora» tiene que ser el reloj que escribió las filas, no el del proceso. */
    .where(sql<boolean>`inicio_el < now()`)
    .where(sql<boolean>`inicio_el >= now() - make_interval(days => ${dias})`)
    /* La más reciente primero: es la que el closer acaba de tener, y la que va a elegir en el 99 %
       de los casos. El orden ES la propuesta por omisión del panel. */
    .orderBy('inicio_el', 'desc')
    .execute();

  return filas.map((f) => ({
    id: f.id,
    inicioEl: f.inicio_el,
    titulo: f.titulo,
    asistio: f.asistio,
  }));
}
