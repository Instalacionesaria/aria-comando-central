// El barrido del calendario: de GoHighLevel a `negocio.citas`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO ÚNICO QUE FALTABA PARA LA AGENDA ERA ESTO
//
// El lector ya existía completo y no se toca: `negocio.citas` tiene sus columnas y sus dos índices
// desde la migración 011, `lib/negocio/miDia.ts` ya consulta las citas de hoy **en la zona de la
// organización** y excluye las canceladas, y `components/closer/MiDia.jsx` ya las dibuja con su
// hora, su estado y su sala.
//
// La tabla estaba vacía porque **nada la escribía**. Este archivo es eso y nada más.
//
// ── EL COSTE, Y NO CRECE CON LA CANTIDAD DE CITAS ──────────────────────────
//
// Medido: `calendarId` es obligatorio, así que no se puede pedir «los eventos de la subcuenta». El
// barrido es **1 llamada para listar los calendarios + 1 por calendario**. Con los nueve de hoy,
// **diez llamadas**, y ese número no se mueve si mañana hay diez mil citas: se mueve si hay más
// calendarios.
//
// Es una cota distinta de la de los mensajes —donde el coste crece con la actividad— y por eso
// tiene su propia clave de pulso y su propia cadencia. Mezclarlas haría que la agenda se barriera
// cada diez segundos, que es diez veces por minuto para un dato que cambia cuando alguien agenda.
//
// ── LA VENTANA ES ESTRECHA A PROPÓSITO ─────────────────────────────────────
//
// No se trae la historia entera. Medido en la subcuenta real, la ventana que la Agenda necesita
// —dos semanas atrás, seis adelante— son **132 citas en total**, contra 1109 de la historia
// completa. Y la de atrás no es capricho: `miDia.ts` marca las citas **vencidas** y hay que tenerlas
// para poder marcarlas.
//
// Traer todo costaría lo mismo en llamadas y llenaría la tabla con 977 citas que ninguna pantalla
// mira. El día que haga falta un histórico, es una ventana distinta y un barrido aparte.
//
// ── ESE DÍA LLEGÓ, SE MIRÓ, Y LA RESPUESTA FUE QUE NO ──────────────────────
//
// Conversation Intelligence empezó a mostrar cifras el 2026-09-14 y con eso apareció la pregunta de
// si traer la historia. **Decidido el mismo día: no.** Sólo cuentan las citas agendadas desde que
// Comando Central existe —la primera guardada es del **2026-08-26**— y las anteriores no importan.
//
// No es sólo una decisión de producto: hay un argumento técnico que apunta al mismo lado, y conviene
// que quede escrito porque la idea de «traer la historia» vuelve sola.
//
// **Un relleno de una sola vez crea filas CONGELADAS POR CONSTRUCCIÓN.** Se traen, nunca se vuelven
// a mirar, y su estado queda detenido en el día de la importación. Ya hay 101 así en esta tabla
// —anteriores a la 038, sin sincronizar desde el 2026-09-06— y **sesgaron una cifra real**: la tasa
// de cancelación daba 50,6 % mezclándolas y 60,3 % sobre las que el barrido alcanza. Un relleno
// histórico sumaría ~977 más de la misma clase, o sea que empeoraría el problema que viene a
// resolver.
//
// Y hay un tercer motivo, concreto y de este archivo: el `on conflict` de abajo estampa
// `estado_cambiado_el = now()` cuando el estado difiere. Un relleno que actualizara citas viejas
// cuyo estado cambió hace semanas les pondría fecha de HOY — el artefacto que la 045 dice estar
// evitando.
//
// Si alguien reabre esto, que sea sabiendo las tres cosas: la decisión del dueño, las filas
// congeladas, y el sello falso.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { conOrganizacion, datos } from '../datos/contexto.ts';
import {
  ESTADOS_CANCELADOS,
  citaPorId,
  citasDelCalendario,
  estaCancelada,
  listarCalendarios,
  type CitaDeGhl,
} from '../ghl/calendarios.ts';
import { conElPulso, type Cierre, type ResultadoDelPulso } from './pulso.ts';
import type { AmbitoDeUnCliente } from './ambitoDelCliente.ts';

/**
 * La ventana. Hacia atrás lo que la Agenda necesita para marcar vencidas; hacia adelante lo que
 * alguien puede tener agendado.
 */
export const DIAS_ATRAS = 14;

/**
 * Cuántas citas ausentes se confirman por barrido, una llamada cada una (la `108`). Una ausencia es rara —medido el
 * 2026-10-29: 4 en la ventana—, así que el tope casi nunca se alcanza; está por el día en que un calendario entero
 * desaparezca, que serían decenas de llamadas en una pasada. Las que no entran se confirman en la siguiente.
 */
const TOPE_DE_CONFIRMACIONES = 20;
/**
 * Hacia adelante. **Se exporta porque es el techo real de lo que se puede mostrar**: pedir la agenda
 * de los próximos 90 días devolvería vacíos los días 46 a 90 —nunca se le preguntaron al CRM— y ese
 * vacío no es «no hay citas», es un cero sin medir. `app/api/closer/agenda/route.ts` acota con esto.
 */
export const DIAS_ADELANTE = 45;

const DIA_MS = 86_400_000;

/**
 * El filtro de canceladas, en SQL y en un solo lugar.
 *
 * ── POR QUÉ ESTO NO SE ESCRIBE DOS VECES ──────────────────────────────────────
 *
 * Estaba escrito dos veces —a mano en `miDia.ts`, y en ningún lado en `fila.ts`, que era el
 * defecto—, y el resultado medido es grande: **el 39 % de las citas de la subcuenta real están
 * canceladas** (411 de 1052). Los íconos 📹 «reuniones tenidas» y 📅 «cita futura» las contaban, así
 * que el dato que el closer mira antes de llamar decía que hubo reuniones que nadie tuvo.
 *
 * El vocabulario es de GoHighLevel y sale de `ESTADOS_CANCELADOS`, la MISMA lista que usa
 * `estaCancelada()` para decidir lo mismo en memoria. Dos listas se separan; una no.
 *
 * `estado_ghl` nulo **no** es cancelada: nulo es «el CRM no lo dijo», y descartar por eso perdería
 * citas buenas. Se compara en minúsculas porque el campo es texto libre de ellos.
 *
 * El fragmento no se iza a una constante de módulo: `ADR-0703` prohíbe las estructuras compartidas
 * en el ámbito del módulo, y armarlo cada vez no cuesta nada.
 */
export function noCancelada(columna: string) {
  const col = sql.ref(columna);
  const lista = sql.join(ESTADOS_CANCELADOS.map((e) => sql`${e}`));
  return sql<boolean>`(${col} is null or lower(${col}) not in (${lista}))`;
}

/**
 * **¿El CRM todavía lo tiene?** La baja (`baja_en_el_crm`, la `108`) de una cita o de un contacto, en SQL y en un solo
 * lugar, para las colas de trabajo: Mi Día, la Agenda, la fila y sus íconos. Una cita o un contacto borrado en el CRM
 * no es trabajo de nadie. Las cifras no usan esto: usan `alcanzable()` (`citasAlcanzables.ts`), que ya lo incluye.
 */
export function sinBaja(columna = 'baja_en_el_crm') {
  return sql<boolean>`(${sql.ref(columna)} is null)`;
}

export interface ResultadoDelBarrido {
  calendarios: number;
  /** Cuántas citas devolvió el CRM, de todos los calendarios juntos. */
  vistas: number;
  /** De ésas, cuántas son de un contacto NUESTRO. Las demás no se pueden guardar. */
  nuestras: number;
  guardadas: number;
  /** Marcadas como borradas por el CRM. Se cuentan porque **no se guardan**. */
  borradas: number;
  /**
   * Citas YA GUARDADAS que quedaron con `baja_en_el_crm` en esta pasada (la `108`): las que volvieron con
   * `deleted: true`, y las que un barrido completo no trajo y su GET confirmó borradas.
   */
  dadasDeBaja: number;
  /** Sin hora de inicio. También se cuentan, y también se descartan: ver abajo. */
  sinHora: number;
  /** Cuántas de las nuestras están canceladas. No se descartan — ver abajo. */
  canceladas: number;
  llamadas: number;
  atrasado: boolean;
}

/**
 * Un barrido del calendario. Devuelve `corrio: false` cuando no le tocaba, y **eso no es un fallo**.
 */
/**
 * Los dos lectores del CRM, inyectables. **La costura existe para que el barrido se pueda probar.**
 *
 * Lo que hay que verificar acá no es la red: es el bucle. El filtro por territorio, el descarte de
 * las borradas, el conteo de las que no tienen hora, que las canceladas SÍ se guarden, que un
 * calendario que falla marque atrasado sin perder los otros ocho, y que el segundo barrido actualice
 * sin pisar `contacto_id`. Nada de eso se puede ejercitar contra la subcuenta real —no se puede
 * pedirle que una cita venga borrada—, y sin la costura quedaría probado por inspección.
 *
 * Es la misma forma que `revisarEntregas(ambito, acceso, preguntar)`: el valor por omisión es la
 * implementación de verdad, así que el camino de producción no cambia.
 */
export interface LectoresDelCalendario {
  listar: typeof listarCalendarios;
  citas: typeof citasDelCalendario;
  /**
   * Una cita por su id, para confirmar una ausencia antes de marcar su baja. Opcional: sin él no se confirma nada y
   * no se marca ninguna ausente —un doble de prueba que no lo declara no puede salir a la red por la puerta de atrás—.
   */
  cita?: typeof citaPorId;
}

export async function barrerCitas(
  // Las citas de UN cliente (el nivel 3), con el token de su subcuenta.
  ambito: AmbitoDeUnCliente,
  acceso: { token: string; locationId: string },
  lectores: LectoresDelCalendario = { listar: listarCalendarios, citas: citasDelCalendario, cita: citaPorId },
): Promise<ResultadoDelPulso<ResultadoDelBarrido>> {
  return conElPulso(ambito, 'citas', async () => {
    // UNA consulta, y de acá sale el filtro por territorio. Igual que la ingesta de mensajes: las
    // citas que no son de un contacto nuestro no se pueden guardar —la clave foránea compuesta lo
    // impide— y preguntarle al CRM contacto por contacto costaría 239 llamadas.
    const conocidos = await conOrganizacion(ambito, async () => {
      const filas = await datos().selectFrom('contactos').select(['id', 'ghl_contact_id']).execute();
      return new Map(filas.map((f) => [f.ghl_contact_id, f.id]));
    });

    const ahora = Date.now();
    const desde = new Date(ahora - DIAS_ATRAS * DIA_MS);
    const hasta = new Date(ahora + DIAS_ADELANTE * DIA_MS);

    let llamadas = 0;
    const lista = await lectores.listar(acceso);
    llamadas++;
    if (lista.tipo !== 'datos') {
      return {
        cierre: cierreDe(llamadas, true, describir(lista.fallo)),
        resultado: vacio(llamadas, true),
      };
    }

    // Los inactivos se barren igual. Ver `listarCalendarios`: un calendario apagado puede tener
    // citas viejas que la Agenda necesita para marcarlas vencidas, y saltearlo ahorra una llamada
    // a cambio de que esas citas no existan para nadie.
    const calendarios = lista.datos.filter((c) => c.id !== '');

    let vistas = 0;
    let nuestras = 0;
    let guardadas = 0;
    let borradas = 0;
    let dadasDeBaja = 0;
    let sinHora = 0;
    let canceladas = 0;
    let atrasado = false;
    // Todo id que el CRM devolvió, de cualquier contacto y borrado o no: es contra esto que se resta (la `108`).
    const devueltas = new Set<string>();

    for (const cal of calendarios) {
      const r = await lectores.citas(acceso, cal.id, desde, hasta);
      llamadas++;
      if (r.tipo !== 'datos') {
        // Un calendario que falla **no invalida los que ya se barrieron**. Se marca atrasado y se
        // sigue: perder los nueve porque uno falló sería cambiar una agenda incompleta por una
        // vacía.
        atrasado = true;
        continue;
      }

      for (const cita of r.datos) {
        vistas++;
        devueltas.add(cita.id);
        const contactoId = cita.contactId ? conocidos.get(cita.contactId) : undefined;
        if (!contactoId) continue;
        nuestras++;

        // ── LO QUE EL CRM MARCÓ COMO BORRADO NO SE GUARDA ────────────────────
        //
        // Y hay que decirlo porque sorprende: **el CRM sigue devolviendo las citas borradas** en la
        // lista, con `deleted: true`. Sin este filtro aparecerían en la agenda de alguien.
        //
        // Una que YA estaba guardada queda con su baja (la `108`): antes se salteaba y su fila se quedaba con el último
        // estado para siempre, contada como viva. Nunca se inserta una borrada.
        if (cita.borrada) {
          borradas++;
          if (await darDeBaja(ambito, cita.id)) dadasDeBaja++;
          continue;
        }

        // Sin hora de inicio no hay dónde ponerla: la columna es obligatoria y la Agenda ordena por
        // ella. Se cuenta para que un cero de citas no se confunda con un descarte silencioso — en
        // lo medido son 0 de 1052, pero contarlas es lo que hace que si mañana aparecen, se sepa.
        if (cita.inicioEl === null) {
          sinHora++;
          continue;
        }

        // ── LAS CANCELADAS SÍ SE GUARDAN, Y ES DELIBERADO ────────────────────
        //
        // Son el **39 %** de lo medido: 411 de 1052. Descartarlas acá sería más simple y estaría
        // mal por dos motivos:
        //
        //   1. Una cita cancelada **ocurrió**: alguien la agendó y alguien la canceló. Es el
        //      denominador de cualquier medición honesta sobre el calendario.
        //   2. Las vitrinas **ya las excluyen** donde corresponde, con `noCancelada()` —la cola de
        //      Mi Día y los íconos de la fila—, así que filtrar acá también sería filtrar dos veces,
        //      y el día que alguien quiera verlas tendría que volver a traerlas del CRM. La Agenda,
        //      en cambio, las muestra marcadas: una cita cancelada es información.
        //
        // Se guarda el estado crudo, sin traducir: los valores son del proveedor.
        if (estaCancelada(cita.estado)) canceladas++;

        if (await guardar(ambito, contactoId, cita)) guardadas++;
      }
    }

    /* ── LA RESTA: LO QUE ESTABA EN LA VENTANA Y EL CRM YA NO DEVUELVE (la `108`) ──
     *
     * Las dos guardas de `congelarLosQueYaNoEstan`, por el mismo motivo: «lo que no vino ya no está» es cierto sólo
     * con una lectura COMPLETA. Con un calendario que falló (`atrasado`) sus citas faltan sin haberse borrado, y con
     * cero citas vistas la lectura pudo venir vacía por cualquier cosa. Y aun completa, cada ausente se CONFIRMA con
     * su GET antes de marcarla: sólo un 404 o un `deleted: true` la dan de baja. */
    if (!atrasado && vistas > 0 && lectores.cita) {
      const resta = await restarLasAusentes(ambito, acceso, lectores.cita, devueltas, desde, hasta);
      llamadas += resta.llamadas;
      dadasDeBaja += resta.dadasDeBaja;
    }

    return {
      cierre: cierreDe(llamadas, atrasado, null),
      resultado: {
        calendarios: calendarios.length,
        vistas,
        nuestras,
        guardadas,
        borradas,
        dadasDeBaja,
        sinHora,
        canceladas,
        llamadas,
        atrasado,
      },
    };
  });
}

function cierreDe(llamadas: number, atrasado: boolean, fallo: string | null): Cierre {
  return {
    // ── LA MARCA DE AGUA NO SIRVE ACÁ, Y ES MEJOR DECIRLO QUE FINGIRLA ──────
    //
    // Los mensajes se caminan en orden y la marca avanza sobre trabajo terminado. Una cita no: se
    // puede **reagendar hacia atrás**, y una cita de la semana que viene puede moverse a ayer. Una
    // marca de agua sobre la fecha de inicio dejaría esa cita para siempre por debajo del corte.
    //
    // Así que el barrido es siempre la ventana completa. Es barato porque la ventana es chica —diez
    // llamadas, y no crece con la cantidad de citas— y correcto porque no depende de que nada se
    // mueva solo hacia adelante.
    marcaEl: null,
    llamadas,
    atrasado,
    fallo,
  };
}

function vacio(llamadas: number, atrasado: boolean): ResultadoDelBarrido {
  return {
    calendarios: 0,
    vistas: 0,
    nuestras: 0,
    guardadas: 0,
    borradas: 0,
    dadasDeBaja: 0,
    sinHora: 0,
    canceladas: 0,
    llamadas,
    atrasado,
  };
}

/**
 * Marca la baja de una cita YA guardada (la `108`). `true` si marcó. No inserta nunca, y la fecha es la primera vez
 * que se vio: una cita que sigue volviendo con `deleted: true` no corre su baja en cada pasada.
 */
async function darDeBaja(ambito: AmbitoDeUnCliente, ghlEventoId: string): Promise<boolean> {
  const r = await conOrganizacion(ambito, () =>
    datos()
      .updateTable('citas')
      .set({ baja_en_el_crm: sql<Date>`now()` } as never)
      .where('ghl_evento_id', '=', ghlEventoId)
      .where('baja_en_el_crm', 'is', null)
      .executeTakeFirst(),
  );
  return Number(r?.numUpdatedRows ?? 0) > 0;
}

/**
 * Las citas guardadas de la ventana que el barrido completo no trajo, confirmadas de a una (la `108`).
 *
 * Dentro de la ventana por su inicio: el CRM casa por solapamiento, así que una cita que EMPIEZA en la ventana siempre
 * se pide. Sin baja (ya está marcada) y en el ámbito del cliente: la política de fila deja ver sólo las suyas, que son
 * las que este token puede pedir. Cada una cuesta una llamada, acotadas por `TOPE_DE_CONFIRMACIONES`:
 *
 *   · 404, o la cita con `deleted: true` → baja.
 *   · viva → se guarda con lo que dice el CRM (se movió fuera de la ventana, o de calendario): `guardar()` la refresca.
 *   · otro rechazo → no se marca nada; la pasada siguiente la vuelve a pedir.
 */
async function restarLasAusentes(
  ambito: AmbitoDeUnCliente,
  acceso: { token: string; locationId: string },
  leer: typeof citaPorId,
  devueltas: ReadonlySet<string>,
  desde: Date,
  hasta: Date,
): Promise<{ llamadas: number; dadasDeBaja: number }> {
  const guardadas = await conOrganizacion(ambito, () =>
    datos()
      .selectFrom('citas')
      .select(['ghl_evento_id', 'contacto_id'])
      .where('baja_en_el_crm', 'is', null)
      .where('inicio_el', '>=', desde)
      .where('inicio_el', '<', hasta)
      .orderBy('inicio_el')
      .execute(),
  );
  const ausentes = guardadas.filter((c) => !devueltas.has(c.ghl_evento_id)).slice(0, TOPE_DE_CONFIRMACIONES);
  let llamadas = 0;
  let dadasDeBaja = 0;
  for (const a of ausentes) {
    const r = await leer(acceso, a.ghl_evento_id);
    llamadas++;
    if (r.tipo === 'fallo') continue;
    if (r.datos === null || r.datos.borrada) {
      if (await darDeBaja(ambito, a.ghl_evento_id)) dadasDeBaja++;
    } else if (r.datos.inicioEl !== null && r.datos.id === a.ghl_evento_id) {
      await guardar(ambito, a.contacto_id, r.datos);
    }
  }
  return { llamadas, dadasDeBaja };
}

function describir(f: { tipo: string; estado?: number; causa?: string }): string {
  if (f.tipo === 'sin_respuesta') return `sin respuesta: ${f.causa ?? ''}`.trim();
  return `${f.tipo} (${f.estado ?? '?'})`;
}

/**
 * Guarda una cita. `true` si entró o se actualizó.
 *
 * ── EL `on conflict` VA POR LAS DOS COLUMNAS ────────────────────────────────
 *
 * `(org_id, ghl_evento_id)`, que es como está declarado el único en la migración 011. Nombrando
 * solo `ghl_evento_id` PostgreSQL no encuentra el índice y el `insert` falla con `42P10` — un error
 * de forma, no de datos, y por eso fácil de no ver hasta que corre contra una base real. Es el mismo
 * detalle que `sincronizar.ts` ya documentó para los contactos.
 *
 * Y el `do update` es lo que hace que reagendar funcione: la misma cita vuelve con otra hora, y la
 * fila se mueve. Con `do nothing` la agenda mostraría la hora vieja para siempre.
 *
 * ── LA MISMA LÍNEA ERA LA VIRTUD Y EL DEFECTO ───────────────────────────────
 *
 * Ese `inicio_el: valores.inicio_el` movía la fila **y borraba la hora anterior sin dejar rastro**.
 * Las dos cosas a la vez, y la segunda no estaba escrita en ninguna parte hasta que la pantalla de
 * Conversation tuvo que declararla como un dato que falta.
 *
 * Ahora el `do update` guarda la hora que está pisando, en la misma sentencia que la pisa: en un
 * `on conflict do update`, toda referencia a `citas.x` es la fila VIEJA, sin importar el orden de
 * las asignaciones. No hace falta un `select` de más.
 */
async function guardar(ambito: AmbitoDeUnCliente, contactoId: string, cita: CitaDeGhl): Promise<boolean> {
  const valores = {
    ghl_evento_id: cita.id,
    contacto_id: contactoId,
    inicio_el: cita.inicioEl,
    fin_el: cita.finEl,
    titulo: cita.titulo,
    estado_ghl: cita.estado,
    sala_url: cita.sala,
    /* Ya se leía de la respuesta del CRM y se tiraba acá. Se guarda porque el enlace de
       reagendar necesita el calendario de ESTA cita, y el de la empresa es uno de nueve. */
    ghl_calendario_id: cita.calendarioId,
    /* Los otros dos que hacían el mismo viaje: `lib/ghl/calendarios.ts` los lee de la respuesta
       —`rescheduledAt` y `assignedUserId`—, los normaliza, y morían en este objeto. */
    reagendada_el: cita.reagendadaEl,
    crm_asignado_a: cita.usuarioAsignadoId,
    reservada_el: cita.reservadaEl,
    sincronizado_el: new Date(),
  };

  const r = await conOrganizacion(ambito, async () =>
    datos()
      .insertInto('citas')
      .values(valores as never)
      .onConflict((oc) =>
        oc.columns(['org_id', 'ghl_evento_id']).doUpdateSet({
          // `contacto_id` NO se pisa. Es nuestra clave, y el día que el CRM devuelva la cita con
          // otro contacto —porque alguien la reasignó— moverla de contacto en silencio haría
          // aparecer una cita en la agenda de otra persona. Si eso pasa, se ve como una cita que
          // no cambió, y eso es una pregunta; moverla sola no lo sería.
          inicio_el: valores.inicio_el,
          fin_el: valores.fin_el,
          titulo: valores.titulo,
          estado_ghl: valores.estado_ghl,
          sala_url: valores.sala_url,
          /* Se pisa igual que la sala: reagendar en el CRM puede mover la cita de calendario, y el
             enlace tiene que seguirla. */
          ghl_calendario_id: valores.ghl_calendario_id,

          /* ── Y ACÁ VAN TRES REGLAS DISTINTAS, QUE ES EL PUNTO ────────────────
           *
           * `reagendada_el` NO se pisa derecho: cae el valor nuevo sólo si trae algo. Si una
           * respuesta viniera sin el campo —el CRM lo omite, lo renombra, un calendario contesta
           * distinto— un pisado directo pondría en nulo el único rastro de que la cita se movió,
           * en TODAS las citas de ese barrido, de una vez, sin error y sin que nada se ponga
           * rojo. Con `coalesce`, lo que ya se midió gana sobre lo que no vino. */
          reagendada_el: sql`coalesce(excluded.reagendada_el, citas.reagendada_el)`,

          /* La fecha de reserva se protege igual, y por un motivo propio además del compartido:
             **una cita se reserva UNA vez**. Su valor no puede cambiar, así que un valor nuevo que
             viniera distinto es una señal de que algo se rompió, no un dato mejor — y un nulo que
             pisara borraría la única fecha con la que se pueden dar tasas por período. */
          reservada_el: sql`coalesce(excluded.reservada_el, citas.reservada_el)`,

          /* Éste SÍ se pisa derecho, nulo incluido, y la asimetría con el de arriba es a
           * propósito: reasignar una cita a otro closer —o DESASIGNARLA— es un hecho del CRM que
           * pasó hoy, no un dato que se pierde. Que el nulo gane es lo que hace que «ya no tiene
           * asignado» se pueda ver. */
          crm_asignado_a: valores.crm_asignado_a,

          /* ── LA HORA QUE SE ESTÁ PISANDO, GUARDADA ANTES DE PISARLA ────────
           *
           * La guarda `when` no es una optimización: **sin ella el barrido inventa
           * reagendamientos**. Corre cada hora sobre las mismas citas, así que la primera pasada
           * siguiente marcaría todas como movidas y «cuántas se reagendaron» diría el 100 % — un
           * número alarmante que sería un artefacto del cron.
           *
           * `is distinct from` y no `<>`: con `<>` un nulo daría nulo y el `case` caería al
           * `else`. Hoy `inicio_el` es `not null` (migración 011), así que esa diferencia no se
           * puede ejercitar con una prueba — y por eso queda dicha acá en vez de fingir una que
           * pasaría igual con las dos versiones. */
          inicio_anterior_el: sql`
            case when citas.inicio_el is distinct from excluded.inicio_el
                 then citas.inicio_el
                 else citas.inicio_anterior_el end`,

          /* ── Y EL ESTADO, QUE ES EL MISMO PATRÓN EN LA COLUMNA DE AL LADO ────
           *
           * `estado_ghl` se sigue pisando arriba, que está bien: es el estado VIGENTE. Lo que
           * faltaba es el rastro, y sin él la tabla sabe que una cita está cancelada y no sabe
           * cuándo se canceló — o sea que una cancelada el día que se reservó y una cancelada una
           * hora antes de empezar son el mismo dato. La segunda es un plantón anunciado y es lo
           * que el agente de Appointment Flow existe para evitar.
           *
           * La guarda `when` es la misma lección de `inicio_anterior_el` y evita el mismo
           * artefacto: sin ella, cada pasada horaria del barrido marcaría TODAS las citas como
           * recién cambiadas, y la cifra sería el reloj del cron y no un hecho del negocio.
           *
           * `is distinct from` y no `<>`, y acá SÍ se puede ejercitar: `estado_ghl` es nulable
           * —es «el CRM no lo dijo»— así que con `<>` la transición de nulo a `cancelled` daría
           * nulo, caería al `else`, y no se registraría nunca. */
          estado_anterior_ghl: sql`
            case when citas.estado_ghl is distinct from excluded.estado_ghl
                 then citas.estado_ghl
                 else citas.estado_anterior_ghl end`,
          estado_cambiado_el: sql`
            case when citas.estado_ghl is distinct from excluded.estado_ghl
                 then now()
                 else citas.estado_cambiado_el end`,

          /* ── Y `asistio` NO ESTÁ ACÁ, QUE ES EL PUNTO ───────────────────────
           *
           * Es la única columna de esta tabla que **no viene del CRM**: la escribe una persona al
           * cerrar el intento en Avanzar, porque el campo de asistencia de GoHighLevel está
           * poblado en 3 de 1052 citas. Es la misma regla que protege a `sello_setter_id` en
           * `sincronizar.ts`: *lo que decide GoHighLevel se pisa; lo que decidimos acá, no.*
           *
           * Si entrara al `set`, la primera pasada horaria del barrido la pondría en nulo sobre
           * TODAS las citas y **nada fallaría**: el closer registraría, la cifra subiría, y una
           * hora después volvería a cero sin un solo error en ninguna parte. Por eso está dicho
           * acá y no sólo por omisión. */

          sincronizado_el: valores.sincronizado_el,
          // El CRM la devolvió viva: si tenía baja (la `108`), ya no la tiene.
          baja_en_el_crm: null,
        } as never),
      )
      .returning('id')
      .executeTakeFirst(),
  );
  return Boolean(r);
}
