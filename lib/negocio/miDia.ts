// Las cinco colas de Mi Día. UNA llamada, CERO al CRM.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA QUE GOBIERNA LAS CINCO
//
// El `01` la pone como la decisión más importante de la pantalla:
//
//   **"Ninguna cola es un campo guardado. Las cinco son consultas."**
//
// No existe una columna «está en el buzón» ni un `es_urgente`. Cada cola se calcula en el
// momento a partir de datos que ya están ahí por otro motivo, y da dos cosas gratis:
//
//   1. **Un estado guardado se desincroniza; una consulta no puede.** Con una bandera, cada
//      mensaje entrante habría que acordarse de encenderla y cada respuesta de apagarla. El día
//      que un camino se olvide, el contacto queda en la cola para siempre o no entra nunca.
//   2. **A medianoche se vacía sola.** «Completadas hoy» y «Agenda de hoy» filtran por fecha:
//      cuando cambia el día, la lista cambia sin que nadie corra nada.
//
// ── CERO LLAMADAS AL CRM, Y POR ESO PUEDE CORRER CADA 10 SEGUNDOS ───────────
//
// Todo sale de la base propia. El `04` § 8 lo pone en su tabla de presupuesto: *"Mi Día,
// Pipeline, Agenda, Inicio, Chat → 0 llamadas — todo sale de la caché"*. Las cuatro pantallas
// que el closer mira todo el día no gastan nada; el presupuesto se gasta en TRAER los datos,
// una vez, cuando cambian.
//
// ── UN CONTACTO EN UNA SOLA COLA ────────────────────────────────────────────
//
// Urgentes gana sobre Buzón. El `01`: *"dos colas para la misma persona hacen que atender una
// no cierre la otra, y el closer termina trabajando el mismo caso dos veces sin saberlo"*.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { noCancelada } from './citas.ts';
import { nucleoDeColas, type CasoDeSeguimiento, type EnLaCola } from './colas.ts';

/* `CasoDeSeguimiento` y `EnLaCola` se reexportan: viven en `colas.ts` porque las usan las dos
   composiciones, y este archivo sigue siendo la puerta por la que entra la pantalla del closer. */
export type { CasoDeSeguimiento, EnLaCola };

export interface MiDia {
  urgentes: EnLaCola[];
  agenda: EnLaCola[];
  buzon: EnLaCola[];
  seguimientos: EnLaCola[];
  completadas: EnLaCola[];
  /**
   * El contador de tareas pendientes.
   *
   * ── EL DETALLE QUE «CASI SIEMPRE SE IMPLEMENTA MAL» ───────────────────────
   *
   * Cuenta los seguimientos que PIDEN MANOS, no todos los de la lista. Los
   * `automatico_en_curso` **se muestran** —el closer quiere ver que la serie está corriendo—
   * pero **no suman**.
   *
   * El `01` explica el costo de sumarlos: *"haría que el badge diga «12 tareas pendientes»
   * cuando nueve de esas doce las está haciendo un robot. El closer abre la pantalla, ve nueve
   * filas que no requieren nada, y a la tercera vez deja de creerle al contador"*.
   *
   * Y la Agenda tampoco suma: una cita no es una tarea pendiente, es un evento.
   */
  tareasPendientes: number;
  /** `true` si el territorio no cupo entero. Ver `TOPE_SIN_PAGINAR`. */
  truncado: boolean;
}

/**
 * Las CINCO colas del closer. **Corre dentro de `conOrganizacion(`.**
 *
 * Cuatro salen del núcleo compartido y la agenda se arma acá: es la única propia, y el setter no
 * la tiene porque trabaja **antes** de que exista una cita. Ver `lib/negocio/colas.ts`.
 */
export async function colasDelDia(zonaHoraria: string): Promise<MiDia> {
  const nucleo = await nucleoDeColas('closer', zonaHoraria);
  const { porId } = nucleo;

  const resultado: MiDia = {
    urgentes: nucleo.urgentes,
    agenda: [],
    buzon: nucleo.buzon,
    seguimientos: nucleo.seguimientos,
    completadas: nucleo.completadas,
    tareasPendientes: 0,
    truncado: nucleo.truncado,
  };

  // ── LA ÚNICA COLA PROPIA DEL CLOSER: LA AGENDA DE HOY ────────────────────────────────────────────────
  //
  // Las citas de hoy en la zona de la ORGANIZACIÓN, sin las canceladas.
  //
  // Y las VENCIDAS SÍ VAN, que es lo que sorprende: *"una cita cuya hora ya pasó y que nadie
  // cerró con Avanzar sigue en la lista, marcada como vencida y ordenada abajo. NO desaparece.
  // Si desapareciera, el closer perdería de vista exactamente la cita que tiene pendiente de
  // registrar"*.
  const citas = await datos()
    .selectFrom('citas')
    .select(['contacto_id', 'inicio_el', 'estado_ghl', 'sala_url'])
    // El día en la zona de la organización. `timezone(zona, now())` da el ahora local, y
    // `date_trunc('day', …)` su medianoche. Comparar contra `current_date` usaría la zona del
    // SERVIDOR, que no es la de nadie.
    .where('inicio_el', '>=', sql<Date>`date_trunc('day', timezone(${zonaHoraria}, now())) at time zone ${zonaHoraria}`)
    .where('inicio_el', '<', sql<Date>`(date_trunc('day', timezone(${zonaHoraria}, now())) + interval '1 day') at time zone ${zonaHoraria}`)
    /* Las canceladas se excluyen en la CONSULTA, y el filtro es `noCancelada()` —la misma
       definición que usan los íconos 📹 y 📅 de la fila—. Antes esta lista estaba escrita a mano acá
       y en ningún lado allá: los íconos contaban las canceladas y esta cola no, así que la misma
       cita estaba y no estaba según dónde se la mirara. */
    .where(noCancelada('estado_ghl'))
    .orderBy('inicio_el', 'asc')
    .execute();

  /* ── EL MISMO RELOJ QUE LA CONSULTA, Y ANTES ERAN DOS ──────────────────────
   *
   * Esto era `Date.now()`, el reloj de la aplicación, mientras la ventana de arriba y los íconos de
   * `fila.ts` usan `now()`, el de la base. Son dos procesos distintos y no están sincronizados: la
   * misma cita podía estar vencida acá y pendiente en su ícono.
   *
   * Se trae de la base y funciona por una propiedad que conviene nombrar: **`now()` devuelve el
   * instante en que empezó la TRANSACCIÓN**, no el de cada sentencia. Como `conOrganizacion()`
   * envuelve todo esto en una, es literalmente el mismo instante que ya usó la consulta. */
  const reloj = await datos().selectNoFrom(sql<Date>`now()`.as('ahora')).executeTakeFirstOrThrow();
  const ahora = reloj.ahora.getTime();
  for (const c of citas) {
    const fila = porId.get(c.contacto_id);
    // Sin el contacto en la caché no hay fila que dibujar. No se inventa una: el `03` pide
    // "ninguna fila sin nombre", y una fila con el nombre de la cita es trabajo de la Agenda,
    // no de esta cola.
    if (!fila) continue;
    resultado.agenda.push({
      fila,
      cita: {
        inicioEl: c.inicio_el,
        estado: c.estado_ghl,
        salaUrl: c.sala_url,
        vencida: c.inicio_el !== null && new Date(c.inicio_el).getTime() < ahora,
      },
    });
  }
  // Las vencidas ABAJO, no fuera. El orden dentro de cada grupo sigue siendo por hora.
  resultado.agenda.sort((a, b) => Number(a.cita?.vencida) - Number(b.cita?.vencida));

  /* ── EL CONTADOR SE SUMA EXPLÍCITO, Y NO SE DERIVA DE LAS COLAS ────────
   *
   * Tres de las cinco. La AGENDA no suma —una cita es un evento, no una tarea— y las COMPLETADAS
   * tampoco, porque ya no son trabajo pendiente.
   *
   * Un `Object.values(colas).flat().length` haría que agregar una cola cambie el número sin que
   * nadie lo decida. Y en los seguimientos se filtra por `pideManos` en vez de sumar `.length` por
   * lo mismo: el campo sigue viajando a la pantalla, y el día que vuelva a haber una fila que no
   * pida nada, sumar el largo la contaría igual. */
  resultado.tareasPendientes =
    resultado.urgentes.length +
    resultado.buzon.length +
    resultado.seguimientos.filter((s) => s.pideManos).length;

  return resultado;
}
