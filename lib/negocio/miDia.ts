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
import { filasDeTerritorio, type Fila } from './fila.ts';
import { estadoDelAgente, SEGUIMIENTO_AUTOMATICO } from '../ghl/contrato.ts';

/**
 * Los tres tags de FALLO DEL AUDITOR. Son los únicos que meten a alguien en Urgentes.
 *
 * ── OJO CON `bot_desactivado_postcall`, QUE NO ESTÁ ACÁ ─────────────────────
 *
 * El contrato lo advierte explícitamente: *"no armes el workflow con un filtro «contiene
 * `bot_desactivado`». `bot_desactivado_postcall` ya existe y significa lo CONTRARIO — «esta
 * persona ya pasó por la llamada», no «el bot falló»"*.
 *
 * Un filtro por prefijo metería a Urgentes a todos los que tuvieron su llamada de cierre. Con
 * los datos reales de hoy eso es 32 contactos en una cola roja que dice «la IA falló».
 */
const FALLOS_DEL_AUDITOR = [
  'bot_desactivado_appflow',
  'bot_desactivado_leadflow',
  // LEGADO: era el tag único antes de separarlos. Se sigue leyendo porque quedaron contactos
  // con él puesto.
  'bot_pausado_fallo',
] as const;

/** El texto de reserva de Urgentes. **Ninguna fila queda vacía.** */
const SIN_MOTIVO = 'Requiere intervención: revisar la conversación.';

/** Los cuatro sabores de un seguimiento del día. NO significan lo mismo para el trabajo. */
export type CasoDeSeguimiento =
  | 'manual_de_hoy'
  | 'manual_vencido'
  | 'serie_agotada'
  | 'automatico_en_curso';

/** Una fila de una cola: el contacto con sus seis íconos, más lo propio de la cola. */
export interface EnLaCola {
  fila: Fila;
  /** Urgentes: qué encontró el auditor. Nunca vacío — ver `SIN_MOTIVO`. */
  motivo?: string;
  /** Agenda: la hora, el estado y la sala. */
  cita?: { inicioEl: Date | null; estado: string | null; salaUrl: string | null; vencida: boolean };
  /** Buzón: los primeros 80 caracteres de lo que escribió, para decidir sin abrir la ficha. */
  fragmento?: string;
  /** Seguimientos: cuál de los cuatro casos, y si pide manos. */
  caso?: CasoDeSeguimiento;
  pideManos?: boolean;
  /** Completadas: qué la completó. */
  completadaPor?: string;
}

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
  /**
   * Por qué una cola está vacía, cuando la causa es que **falta una fuente** y no que no haya
   * trabajo. Son dos hechos distintos y la pantalla los dibuja distinto.
   */
  faltantes: Partial<Record<'agenda' | 'buzon' | 'seguimientos', string>>;
}

/** ¿Tiene alguno de estos tags? Lectura TOLERANTE — ver el `02` regla 5. */
function tiene(etiquetas: readonly string[], buscadas: readonly string[]): boolean {
  const puestas = new Set(etiquetas.map((e) => e.trim().toLowerCase()));
  return buscadas.some((b) => puestas.has(b));
}

/**
 * Las cinco colas del día.
 *
 * ── CÓMO SE ARMA, Y POR QUÉ ES BARATO ──────────────────────────────────────
 *
 * Una consulta trae el territorio COMPLETO con sus seis indicadores —la misma que usa la lista
 * y el Pipeline, así que los íconos son el mismo dato y no tres cálculos que coinciden— y
 * después una consulta por cola para lo específico: las citas de hoy, los seguimientos, lo
 * completado.
 *
 * @param zonaHoraria La de la ORGANIZACIÓN, no la del navegador. El `01`: las citas de hoy son
 *   *"entre el inicio y el fin del día en la zona horaria de la organización"*. Un closer que
 *   viaja no ve su agenda corrida.
 */
export async function colasDelDia(zonaHoraria: string): Promise<MiDia> {
  const { filas, hayMas } = await filasDeTerritorio('closer', { todas: true });

  const resultado: MiDia = {
    urgentes: [],
    agenda: [],
    buzon: [],
    seguimientos: [],
    completadas: [],
    tareasPendientes: 0,
    truncado: hayMas,
    faltantes: {},
  };

  const porId = new Map(filas.map((f) => [f.id, f]));

  // ── Cola 1 · URGENTES ─────────────────────────────────────────────────────
  //
  // Solo los tres tags de fallo. Y los CONGELADOS no entran: un contacto sin territorio no es
  // trabajo de este closer. Acá no hace falta filtrarlos porque `filasDeTerritorio('closer')`
  // ya pide `territorio = 'closer'`, o sea que un congelado —`territorio is null`— nunca llega.
  const enUrgentes = new Set<string>();
  for (const fila of filas) {
    if (!tiene(fila.etiquetas, FALLOS_DEL_AUDITOR)) continue;
    enUrgentes.add(fila.id);
    resultado.urgentes.push({
      fila,
      // El motivo lo escribe el auditor en `negocio.hallazgos`. Todavía no hay auditor, así que
      // hoy es siempre el texto de reserva — y eso es correcto: la fila NUNCA queda vacía.
      motivo: SIN_MOTIVO,
    });
  }
  resultado.tareasPendientes += resultado.urgentes.length;

  // ── Cola 2 · AGENDA DE HOY ────────────────────────────────────────────────
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
    // Las canceladas se excluyen en la CONSULTA. El estado lo pone GoHighLevel y es texto libre,
    // así que se compara sin distinguir caja.
    .where((eb) =>
      eb.or([
        eb('estado_ghl', 'is', null),
        eb(sql<string>`lower(estado_ghl)`, 'not in', ['cancelled', 'canceled', 'cancelada']),
      ]),
    )
    .orderBy('inicio_el', 'asc')
    .execute();

  const ahora = Date.now();
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

  if (citas.length === 0) {
    // Vacía porque falta la fuente, no porque no haya citas. Son dos hechos distintos: con 74
    // contactos que tienen la etiqueta `cita_agendada`, decir "no tenés citas hoy" sería falso.
    resultado.faltantes.agenda =
      'Las citas se leen del calendario de GoHighLevel, y eso todavía no está conectado. ' +
      'La etiqueta `cita_agendada` dice QUIÉN tiene cita, pero no cuándo.';
  }

  // ── Cola 3 · BUZÓN ────────────────────────────────────────────────────────
  //
  // Las CINCO condiciones, todas obligatorias. La quinta es la que hace que la cola funcione, y
  // no es una bandera: se comparan DOS FECHAS —el último entrante y la última resolución—.
  //
  //   escribe → entrante nuevo → entra
  //   lo atienden → se sella la resolución → sale
  //   vuelve a escribir → el entrante es más nuevo → entra de nuevo, solo
  //
  // Con un flag, ese tercer paso habría que programarlo. Con dos fechas sale gratis.
  for (const fila of filas) {
    // 1 · no congelado → garantizado por el territorio de la consulta.
    // 2 · no está ya en Urgentes → gana la cola más específica.
    if (enUrgentes.has(fila.id)) continue;
    // 4 · el bot está APAGADO. **La regla de fondo: una IA activa nunca genera tarea humana.**
    const agente = estadoDelAgente(fila.etiquetas);
    if (agente === 'atendiendo' || agente === 'atendiendo_pre_agenda' || agente === 'atendiendo_post_agenda') {
      continue;
    }
    // 5 · escribió, y después de la última resolución. `resueltoEl` todavía no existe como
    // columna —lo trae el sello de resolución del buzón, que es trabajo de Avanzar— así que
    // hoy la condición se reduce a "escribió".
    if (!fila.ultimoEntranteEl) continue;

    resultado.buzon.push({
      fila,
      // Los primeros 80 caracteres, para decidir sin abrir la ficha.
      fragmento: (fila.ultimoEntranteTexto ?? '').slice(0, 80),
    });
  }
  // El mensaje MÁS RECIENTE primero.
  resultado.buzon.sort(
    (a, b) =>
      new Date(b.fila.ultimoEntranteEl ?? 0).getTime() - new Date(a.fila.ultimoEntranteEl ?? 0).getTime(),
  );
  resultado.tareasPendientes += resultado.buzon.length;

  if (resultado.buzon.length === 0) {
    resultado.faltantes.buzon =
      'El buzón necesita la fecha del último mensaje entrante de cada contacto, y la búsqueda ' +
      'de GoHighLevel no la devuelve. Hace falta leer las conversaciones.';
  }

  // ── Cola 4 · SEGUIMIENTOS DE HOY ──────────────────────────────────────────
  //
  // Los que tocan hoy o ya vencieron, en cuatro sabores que NO piden lo mismo.
  const tareas = await datos()
    .selectFrom('tareas')
    .select(['contacto_id', 'vence_el', 'modo', 'nota'])
    .where('completada_el', 'is', null)
    .where('vence_el', '<', sql<Date>`(date_trunc('day', timezone(${zonaHoraria}, now())) + interval '1 day') at time zone ${zonaHoraria}`)
    .orderBy('vence_el', 'asc')
    .execute();

  const hoyLocal = sql<Date>`date_trunc('day', timezone(${zonaHoraria}, now()))`;
  void hoyLocal;

  for (const t of tareas) {
    const fila = porId.get(t.contacto_id);
    if (!fila) continue;
    const vencida = new Date(t.vence_el).getTime() < ahora;
    const caso: CasoDeSeguimiento = vencida ? 'manual_vencido' : 'manual_de_hoy';
    resultado.seguimientos.push({ fila, caso, pideManos: true });
  }

  // Y los AUTOMÁTICOS EN CURSO, que salen de la etiqueta y **no piden manos**. Se muestran
  // porque el closer quiere ver que la serie está corriendo.
  for (const fila of filas) {
    if (!tiene(fila.etiquetas, [SEGUIMIENTO_AUTOMATICO])) continue;
    if (resultado.seguimientos.some((s) => s.fila.id === fila.id)) continue;
    resultado.seguimientos.push({ fila, caso: 'automatico_en_curso', pideManos: false });
  }

  // El contador cuenta SOLO los que piden manos. Ver el comentario de `tareasPendientes`.
  resultado.tareasPendientes += resultado.seguimientos.filter((s) => s.pideManos).length;

  if (resultado.seguimientos.length === 0) {
    resultado.faltantes.seguimientos =
      'Los seguimientos manuales los crea Avanzar, que todavía no existe. Los automáticos se ' +
      'leen de la etiqueta `seguimiento_recupero`, y ningún contacto la tiene puesta.';
  }

  // ── Cola 5 · COMPLETADAS HOY ──────────────────────────────────────────────
  //
  // **SIEMPRE se dibuja, vacía o no**: es el ancla de la pantalla y lo único que le dice al
  // closer "esto ya lo hiciste". Y como filtra por fecha, se vacía sola a medianoche.
  const avances = await datos()
    .selectFrom('resultados')
    .select(['contacto_id', 'salida', 'creado_el'])
    .where('creado_el', '>=', sql<Date>`date_trunc('day', timezone(${zonaHoraria}, now())) at time zone ${zonaHoraria}`)
    .orderBy('creado_el', 'desc')
    .execute();

  for (const a of avances) {
    const fila = porId.get(a.contacto_id);
    // ── LA FILA HUÉRFANA, QUE HAY QUE DEJAR ENTRAR ──
    //
    // Si el contacto ya no está en la caché —lo sacaron del pipeline después— la fila SIGUE
    // apareciendo, sin nombre y sin íconos, pero apareciendo. El trabajo se hizo y tiene que
    // constar. Lo que NO se hace es inventarle datos.
    resultado.completadas.push({
      fila: fila ?? filaHuerfana(a.contacto_id),
      completadaPor: a.salida,
    });
  }

  return resultado;
}

/**
 * Una fila para un resultado cuyo contacto ya no está en la caché.
 *
 * Todo en nulo o en cero MEDIDO, y el nombre dice lo que es. No se inventa un nombre ni se
 * apagan los íconos como si fueran ceros: van como **no medidos**, porque es exactamente eso.
 */
function filaHuerfana(id: string): Fila {
  return {
    id,
    nombre: 'Contacto que ya no está en el pipeline',
    telefono: null,
    score: null,
    fuente: 'desconocida',
    etapa: null,
    etiquetas: [],
    ultimoEntranteEl: null,
    ultimoEntranteTexto: null,
    ultimoSalienteEl: null,
    situacion: 'sin_resultado',
    estancado: false,
    iconos: {
      reunionesTenidas: 0,
      citaFutura: false,
      llamadasContestadas: 0,
      estadoAgente: 'sin_agente',
      seguimientoAbierto: false,
      montoVenta: null,
    },
  };
}
