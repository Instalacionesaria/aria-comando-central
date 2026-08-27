// La Agenda del closer: lee de la caché, **cero llamadas al CRM**.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA CENTRAL, Y EL DEFECTO QUE PAGÓ POR ELLA
//
// El documento de la Agenda lo cuenta así: la pantalla *"pedía las citas al CRM en cada carga, y el
// frontend la pedía cada 10 segundos **desde tres vistas a la vez**. Eran cientos de llamadas por
// hora para mostrar una lista que casi nunca cambia"*.
//
// Ahora: **cero por omisión, y una acción explícita cuando alguien la pide.** Las citas las mantiene
// el barrido de `lib/negocio/citas.ts`, y esto solo lee.
//
// ── EL CONTEO Y LA LISTA SALEN DEL MISMO DATO ──────────────────────────────
//
// «Próximos días» muestra cuántas citas tiene cada día. Ese número **no se consulta aparte**: se
// cuenta sobre la misma lista que después se dibuja. El documento nombra por qué:
//
//   *"Cuando eran dos fuentes distintas, hubo un caso en que la tarjeta anunciaba seis llamadas que
//   no existían: el conteo venía de un lado y la lista del otro."*
//
// Un número y la lista que lo justifica se derivan del mismo dato, siempre.
//
// ── Y EL DÍA ES EL DE LA EMPRESA ───────────────────────────────────────────
//
// Agrupar por día se hace con `diaEnZona` de `lib/negocio/tiempo.ts`, la única definición del
// proyecto. Una cita de las 22:00 en Lima son las 03:00 del día siguiente en tiempo universal:
// agrupando por el instante crudo, la última cita de cada día aparecería en el día siguiente.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { estaCancelada } from '../ghl/calendarios.ts';
import { noCancelada } from './citas.ts';
import { frescuraDe, type Frescura } from './frescura.ts';
import { diaEnZona } from './tiempo.ts';
import type { Territorio } from '../datos/esquema.ts';

export interface CitaDeLaAgenda {
  id: string;
  contactoId: string;
  /** El nombre del contacto. **Nunca vacío** — ver el respaldo abajo. */
  nombre: string;
  telefono: string | null;
  inicioEl: Date;
  finEl: Date | null;
  titulo: string | null;
  estado: string | null;
  /** `null` = esta cita no tiene sala. **La pantalla atenúa el botón, no lo esconde.** */
  salaUrl: string | null;
  /** `true` = su hora ya pasó. Se calcula acá, con el reloj del SERVIDOR. */
  vencida: boolean;
  cancelada: boolean;
}

export interface DiaDeLaAgenda {
  /** `YYYY-MM-DD` en la zona de la empresa. */
  dia: string;
  citas: CitaDeLaAgenda[];
}

export interface Agenda {
  dias: DiaDeLaAgenda[];
  /**
   * El día de hoy en la zona de la empresa.
   *
   * Sale de **la misma consulta** que la ventana, y eso no es una optimización. Ver el encabezado de
   * `agendaDelCloser`: calcularlo con el reloj de la aplicación mientras la ventana usa el de la base
   * es tener dos relojes, y el minuto que cruza la medianoche local los separa.
   */
  hoy: string;
  /**
   * Hasta qué día llega esta respuesta, inclusive, en la zona de la empresa.
   *
   * ── ESTO NO ES UN ADORNO: ES LO QUE HACE HONESTO AL CALENDARIO ─────────────
   *
   * La pantalla dibuja un mes entero, y un mes tiene días que esta consulta **no miró**. Sin este
   * dato, la única forma de dibujarlos sería como días sin citas — y un día sin citas y un día que
   * nadie leyó son cosas distintas que llevan a decisiones opuestas: uno dice «tengo la mañana
   * libre» y el otro dice «no sé qué tengo».
   *
   * Es la misma regla que el `11` § 9: **un cero medido no se ve igual que un cero sin medir.**
   */
  hasta: string;
  total: number;
  /** La zona con la que se calculó todo. Viaja para que la pantalla no elija otra. */
  zonaHoraria: string;
  /**
   * `null` cuando la zona está configurada. Si no, **el aviso de que las horas pueden estar
   * corridas** — ver el encabezado.
   */
  avisoDeZona: string | null;
  /**
   * Hace cuánto que el barrido automático no pasa. `estado: 'al_dia'` = no hay nada que decir.
   *
   * Va acá y **no dentro de `falta`**, y la distinción no es de prolijidad: `falta` solo se calcula
   * cuando la ventana está vacía, así que un atraso metido ahí sería invisible en cuanto haya una
   * sola cita — que es justo el caso donde la agenda se ve completa y no lo está.
   */
  frescura: Frescura;
  /**
   * Por qué está vacía, cuando la causa es que falta una fuente y no que no haya citas.
   *
   * Es el `11` § 9 regla 1 otra vez: **un cero medido y un cero no medido no son el mismo hecho**.
   * Una agenda vacía sin motivo afirma «no tenés citas», y eso hace que alguien no se prepare para
   * una llamada que sí existe.
   */
  falta: string | null;
}

/** Cuántos días hacia adelante trae la Agenda. El documento pide quince. */
export const DIAS_DE_LA_AGENDA = 15;

/**
 * Las citas de una ventana de días. **Corre dentro de `conOrganizacion(`.**
 *
 * @param zonaHoraria La de la ORGANIZACIÓN. El corte del día se hace con ella y no con la del
 *   servidor: `current_date` usaría la zona del motor, que no es la de nadie.
 * @param incluirCanceladas Por omisión NO. El documento: *"las canceladas se ocultan por omisión,
 *   con un parámetro para incluirlas"*. Se ocultan y no se borran — están en la tabla, y son el 39 %
 *   de lo que el CRM devuelve.
 */
export async function agendaDelCloser(
  territorio: Territorio,
  zonaHoraria: string,
  opciones: { dias?: number; incluirCanceladas?: boolean } = {},
): Promise<Agenda> {
  const dias = Math.max(1, Math.trunc(opciones.dias ?? DIAS_DE_LA_AGENDA));

  /* ── UN SOLO RELOJ, Y ANTES HABÍA DOS ──────────────────────────────────────
   *
   * `hoy` se calculaba con `new Date()` —el reloj de la aplicación— y la ventana con `now()` —el de
   * la base—. Parecen el mismo instante y no lo son: basta un desfase de segundos entre los dos
   * procesos, o que la petición cruce la medianoche local, para que **`hoy` nombre un día que no
   * está en `dias[]`**.
   *
   * El síntoma sería que la pantalla se contradice sola: ninguna cabecera dice «HOY», o lo dice
   * sobre un día vacío mientras las citas de hoy están más abajo. Y no se reproduce en horario de
   * oficina, porque solo aparece alrededor de la medianoche.
   *
   * Se arregla trayendo el día de la MISMA consulta. Y funciona por una propiedad de PostgreSQL que
   * conviene nombrar: **`now()` devuelve el instante en que empezó la TRANSACCIÓN**, no el momento
   * de cada sentencia. Como `conOrganizacion(` envuelve todo en una, las dos consultas de acá ven
   * exactamente el mismo `now()`.
   */
  const reloj = await datos()
    .selectNoFrom([
      sql<string>`to_char(date_trunc('day', timezone(${zonaHoraria}, now())), 'YYYY-MM-DD')`.as('hoy'),
      sql<Date>`now()`.as('ahora'),
    ])
    .executeTakeFirstOrThrow();
  const hoy = reloj.hoy;
  /* El último día que esta respuesta cubre, con la MISMA aritmética que la ventana de abajo y en la
     misma zona. Calcularlo en el navegador sería un segundo cálculo del mismo hecho, y el que se
     equivoque por una zona horaria pinta días «sin citas» que en realidad no se miraron. */
  const hasta = await datos()
    .selectNoFrom([
      sql<string>`to_char(date_trunc('day', timezone(${zonaHoraria}, now())) + ((${dias} - 1) * interval '1 day'), 'YYYY-MM-DD')`.as('hasta'),
    ])
    .executeTakeFirstOrThrow()
    .then((f) => f.hasta);

  // El día en la zona de la EMPRESA. Es la misma expresión que `lib/negocio/miDia.ts` ya usa para
  // la cola de hoy, y por el mismo motivo: `date_trunc` sobre `timezone(zona, now())` da la
  // medianoche local, y volver a `at time zone` la convierte al instante que la columna guarda.
  const desdeLaMedianoche = sql<Date>`date_trunc('day', timezone(${zonaHoraria}, now())) at time zone ${zonaHoraria}`;
  const hastaElFin = sql<Date>`(date_trunc('day', timezone(${zonaHoraria}, now())) + (${dias} * interval '1 day')) at time zone ${zonaHoraria}`;

  let q = datos()
    .selectFrom('citas as c')
    .innerJoin('contactos as k', 'k.id', 'c.contacto_id')
    /* ── EL TERRITORIO, Y ESTO FALTABA ────────────────────────────────────────
     *
     * Esta consulta no filtraba por territorio: devolvía las citas de **cualquier** contacto de la
     * empresa —las del setter y las de los congelados, que tienen `territorio` nulo y no aparecen en
     * ninguna pantalla— con su nombre, su teléfono y su identificador.
     *
     * La capacidad no alcanza para esto: `closer.ver` habilita la PANTALLA, y lo que la pantalla
     * mostraba era el territorio equivocado. El aislamiento por fila tampoco: son contactos de la
     * misma organización.
     *
     * Se pasa por parámetro y no se deduce, igual que `filasDeTerritorio(territorio, …)`: así no se
     * puede llamar sin haberlo decidido. Deducirlo acá —«la función se llama agenda del closer, será
     * `closer`»— es cómo la omisión vuelve la próxima vez.
     */
    .where('k.territorio', '=', territorio)
    .where('c.inicio_el', '>=', desdeLaMedianoche)
    .where('c.inicio_el', '<', hastaElFin)
    .select([
      'c.id',
      'c.contacto_id',
      'c.inicio_el',
      'c.fin_el',
      'c.titulo',
      'c.estado_ghl',
      'c.sala_url',
      'k.nombre',
      'k.telefono',
    ])
    .orderBy('c.inicio_el', 'asc');

  if (opciones.incluirCanceladas !== true) {
    /* La condición estaba escrita a mano acá, otra vez a mano en `miDia.ts`, y en ningún lado en
       `fila.ts` —que era el defecto: los íconos 📹 y 📅 contaban las canceladas—. El comentario que
       estaba en este lugar decía *"unificarlas sería mejor, y mientras no lo estén tienen que decir
       lo mismo"*; no dijeron lo mismo. Ahora hay una sola definición y es `noCancelada()`. */
    q = q.where(noCancelada('c.estado_ghl'));
  }

  const filas = await q.execute();

  // ── EL AGRUPADO, y de acá sale el conteo de «Próximos días» ───────────────
  //
  // La misma lista que se dibuja. Ver el encabezado: dos fuentes para el número y la lista es cómo
  // se llega a anunciar seis llamadas que no existen.
  // El MISMO instante que la ventana y que `hoy`. Antes era `Date.now()`, y eso hacía tres relojes
  // en una función: la ventana, el día, y esto. Además `lib/negocio/fila.ts` decide los íconos 📹 y
  // 📅 con `now()` de la base, así que con `Date.now()` acá la misma cita podía estar vencida para la
  // Agenda y pendiente para su ícono.
  const ahora = reloj.ahora.getTime();
  const porDia = new Map<string, CitaDeLaAgenda[]>();

  for (const f of filas) {
    const dia = diaEnZona(f.inicio_el, zonaHoraria);
    if (dia === '') continue; // una fecha ilegible no tiene día donde ir
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia)?.push({
      id: f.id,
      contactoId: f.contacto_id,
      // ── NINGUNA FILA SIN NOMBRE ──────────────────────────────────────────
      //
      // El contacto viene por `inner join`, así que siempre hay uno — la clave foránea compuesta
      // hace imposible una cita huérfana. El respaldo está igual porque un contacto con el nombre
      // vacío sí es posible, y una fila muda en una agenda es una llamada que nadie sabe de quién es.
      nombre: f.nombre?.trim() || f.titulo?.trim() || 'Sin nombre',
      telefono: f.telefono,
      inicioEl: f.inicio_el,
      finEl: f.fin_el,
      titulo: f.titulo,
      estado: f.estado_ghl,
      salaUrl: f.sala_url,
      // Con el reloj del SERVIDOR y no del navegador: un navegador atrasado marcaría como pendiente
      // una cita que ya pasó, y quien la mire creería que todavía tiene tiempo.
      vencida: f.inicio_el.getTime() < ahora,
      cancelada: estaCancelada(f.estado_ghl),
    });
  }

  return {
    dias: [...porDia.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([dia, citas]) => ({ dia, citas })),
    hoy,
    hasta,
    total: filas.length,
    zonaHoraria,
    avisoDeZona: avisoDeZona(zonaHoraria),
    frescura: await frescuraDe('citas'),
    falta: filas.length === 0 ? await porQueNoHayCitas(territorio, zonaHoraria) : null,
  };
}

/**
 * El aviso de que la zona de la empresa no está configurada.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * `UTC` NO SIGNIFICA «ESTÁ EN UTC»: SIGNIFICA «NADIE LO DIJO»
 *
 * `identidad.organizaciones.zona_horaria` es `not null default 'UTC'`, y el formulario del alta **no
 * ofrece el campo**. Resultado medido en producción, antes de escribir esto:
 *
 *   ARIA     America/Lima
 *   PRUEBA   UTC   ← nadie la configuró
 *   Aivora   UTC   ← nadie la configuró
 *
 * Y las citas del calendario vienen con desfase `-05:00`. Para esas dos empresas, **toda cita
 * posterior a las 19:00 se dibujaría el día siguiente**, y ninguna otra parte del sistema lo diría:
 * la cita vino, `falta` sigue en nulo, no hay error en ningún registro.
 *
 * Es exactamente el defecto que el proyecto ya había cerrado —una sola definición de la hora— pero
 * reintroducido por un valor por omisión en vez de por un cálculo. El cálculo es correcto; el insumo
 * no estaba garantizado.
 *
 * Este aviso es la mitad barata del arreglo: convierte el silencio en una afirmación. La otra mitad
 * es que el formulario de empresas ofrezca la zona, para que el consejo se pueda seguir.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
function avisoDeZona(zonaHoraria: string): string | null {
  if (zonaHoraria !== 'UTC') return null;
  return (
    'Esta empresa no tiene zona horaria configurada, así que las horas se muestran en UTC. Si su ' +
    'equipo no trabaja en UTC, las citas de la tarde pueden aparecer un día corridas. Se configura ' +
    'en Ajustes → Empresas.'
  );
}

/**
 * Los dos primeros estados del vacío, que son los mismos para CUALQUIER vitrina de citas.
 *
 * Igual que con los mensajes: **quien sabe si el cero está medido es el pulso del barrido**, no la
 * tabla de citas. Sin haber barrido nunca, «no hay citas» es una afirmación que nadie comprobó.
 *
 * Devuelve `null` cuando el barrido corrió completo — y entonces el cero es de verdad un cero, y
 * cada pantalla dice lo suyo sobre SU ventana. Está separado justamente porque la ventana difiere:
 * la Agenda mira quince días y la cola de Mi Día mira hoy, así que la tercera frase no puede ser
 * compartida sin mentir en una de las dos.
 */
async function faltaDelBarrido(): Promise<string | null> {
  const pulso = await datos()
    .selectFrom('ingesta_pulso')
    .select(['ultima_corrida_el', 'atrasado'])
    .where('clave', '=', 'citas')
    .executeTakeFirst();

  if (!pulso || pulso.ultima_corrida_el === null) {
    return (
      'Todavía no se leyó el calendario de GoHighLevel. Puede haber citas agendadas: lo que falta ' +
      'es el barrido que las copia acá. Usá «Traer del calendario».'
    );
  }
  if (pulso.atrasado) {
    return (
      'El último barrido del calendario quedó incompleto, así que puede haber citas que todavía no ' +
      'se copiaron. Probá con «Traer del calendario».'
    );
  }
  return null;
}

/**
 * El cero de la cola de HOY de Mi Día, explicado.
 *
 * ── EL TEXTO QUE ESTABA ACÁ ERA FALSO, Y LO VOLVIÓ FALSO ESTE MISMO TRABAJO ──
 *
 * `miDia.ts` decía *«las citas se leen del calendario de GoHighLevel, y eso todavía no está
 * conectado»*. Era cierto cuando se escribió y dejó de serlo el día que el barrido existió, y lo
 * peor es la clase de error: **un día tranquilo se reportaba como una integración rota**. Con el
 * 39 % de canceladas medido, un día cuyas citas están todas canceladas también cae acá.
 *
 * Un mensaje de falta que sobrevive a lo que describe es peor que no tenerlo: enseña a no creerle.
 *
 * La tercera frase dice **cuántas hay más adelante**, porque es lo que decide qué hace la persona:
 * cero hoy con seis mañana es un día libre; cero hoy y cero adelante es que hay que agendar.
 */
export async function porQueNoHayCitasHoy(
  territorio: Territorio,
  zonaHoraria: string,
): Promise<string> {
  const delBarrido = await faltaDelBarrido();
  if (delBarrido !== null) return delBarrido;

  const adelante = await datos()
    .selectFrom('citas as c')
    // El mismo territorio que la ventana: «hay 3 citas más adelante» tiene que ser de esta pantalla
    // y no del setter, o el número que explica un cero es de otro lado.
    .innerJoin('contactos as k', 'k.id', 'c.contacto_id')
    .where('k.territorio', '=', territorio)
    .select(({ fn }) => fn.countAll<string>().as('n'))
    .where(
      'c.inicio_el',
      '>=',
      sql<Date>`(date_trunc('day', timezone(${zonaHoraria}, now())) + interval '1 day') at time zone ${zonaHoraria}`,
    )
    .where(noCancelada('c.estado_ghl'))
    .executeTakeFirst();

  const n = Number(adelante?.n ?? 0);
  if (n === 0) {
    return (
      'El calendario está leído y hoy no hay ninguna cita — tampoco en los próximos días. Lo que ' +
      'falta no es la lectura: es agendar.'
    );
  }
  return (
    `Hoy no hay ninguna cita. El calendario está leído, y ${n === 1 ? 'hay 1 cita' : `hay ${n} citas`} ` +
    'más adelante — se ven en Closer → Agenda.'
  );
}

/**
 * Un cero de citas de la ventana de la Agenda, explicado. Tres estados, no dos.
 */
async function porQueNoHayCitas(territorio: Territorio, zonaHoraria: string): Promise<string> {
  const delBarrido = await faltaDelBarrido();
  if (delBarrido !== null) return delBarrido;

  /* ── UN CERO DE HOY EN ADELANTE NO ES UN CALENDARIO VACÍO ──────────────────
   *
   * Medido contra la subcuenta real: el barrido guardó **43 citas y las 43 eran pasadas** — la
   * última, de ayer. La ventana de la Agenda arranca hoy, así que devolvió cero, y eso es correcto.
   *
   * Lo que NO era correcto era el texto. «No hay ninguna cita» sobre un calendario con 43 citas en
   * dos semanas es cierto para la ventana y **falso para lo que la persona va a entender**: que su
   * calendario está vacío. Y la diferencia decide qué hace después — si cree que el sistema no
   * cargó nada, va a apretar el botón; si sabe que no tiene nada agendado, va a agendar.
   *
   * Así que el cero viene con el dato que lo vuelve una afirmación: cuántas hubo antes.
   */
  const recientes = await datos()
    .selectFrom('citas as c')
    // Y acá también: «quedaron 12 citas de días anteriores» contando las del setter sería explicar
    // un cero con un número de otra pantalla.
    .innerJoin('contactos as k', 'k.id', 'c.contacto_id')
    .where('k.territorio', '=', territorio)
    .select(({ fn }) => fn.countAll<string>().as('n'))
    .where(
      'c.inicio_el',
      '<',
      sql<Date>`date_trunc('day', timezone(${zonaHoraria}, now())) at time zone ${zonaHoraria}`,
    )
    .executeTakeFirst();

  const antes = Number(recientes?.n ?? 0);
  if (antes === 0) {
    return 'El calendario se leyó completo y no hay ninguna cita: ni de hoy en adelante ni antes.';
  }
  return (
    `No hay citas de hoy en adelante. El calendario se leyó completo, y de los días anteriores ` +
    `${antes === 1 ? 'quedó 1 cita' : `quedaron ${antes} citas`} — así que la lectura funcionó: ` +
    'lo que no hay es nada agendado por delante.'
  );
}
