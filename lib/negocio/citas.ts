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
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { conOrganizacion, datos } from '../datos/contexto.ts';
import {
  ESTADOS_CANCELADOS,
  citasDelCalendario,
  estaCancelada,
  listarCalendarios,
  type CitaDeGhl,
} from '../ghl/calendarios.ts';
import { conElPulso, type Cierre, type ResultadoDelPulso } from './pulso.ts';

/**
 * La ventana. Hacia atrás lo que la Agenda necesita para marcar vencidas; hacia adelante lo que
 * alguien puede tener agendado.
 */
const DIAS_ATRAS = 14;
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

export interface ResultadoDelBarrido {
  calendarios: number;
  /** Cuántas citas devolvió el CRM, de todos los calendarios juntos. */
  vistas: number;
  /** De ésas, cuántas son de un contacto NUESTRO. Las demás no se pueden guardar. */
  nuestras: number;
  guardadas: number;
  /** Marcadas como borradas por el CRM. Se cuentan porque **no se guardan**. */
  borradas: number;
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
 * Es la misma forma que `revisarEntregas(orgId, acceso, preguntar)`: el valor por omisión es la
 * implementación de verdad, así que el camino de producción no cambia.
 */
export interface LectoresDelCalendario {
  listar: typeof listarCalendarios;
  citas: typeof citasDelCalendario;
}

export async function barrerCitas(
  orgId: string,
  acceso: { token: string; locationId: string },
  lectores: LectoresDelCalendario = { listar: listarCalendarios, citas: citasDelCalendario },
): Promise<ResultadoDelPulso<ResultadoDelBarrido>> {
  return conElPulso(orgId, 'citas', async () => {
    // UNA consulta, y de acá sale el filtro por territorio. Igual que la ingesta de mensajes: las
    // citas que no son de un contacto nuestro no se pueden guardar —la clave foránea compuesta lo
    // impide— y preguntarle al CRM contacto por contacto costaría 239 llamadas.
    const conocidos = await conOrganizacion(orgId, async () => {
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
    let sinHora = 0;
    let canceladas = 0;
    let atrasado = false;

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
        const contactoId = cita.contactId ? conocidos.get(cita.contactId) : undefined;
        if (!contactoId) continue;
        nuestras++;

        // ── LO QUE EL CRM MARCÓ COMO BORRADO NO SE GUARDA ────────────────────
        //
        // Y hay que decirlo porque sorprende: **el CRM sigue devolviendo las citas borradas** en la
        // lista, con `deleted: true`. Sin este filtro aparecerían en la agenda de alguien.
        if (cita.borrada) {
          borradas++;
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

        if (await guardar(orgId, contactoId, cita)) guardadas++;
      }
    }

    return {
      cierre: cierreDe(llamadas, atrasado, null),
      resultado: {
        calendarios: calendarios.length,
        vistas,
        nuestras,
        guardadas,
        borradas,
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
    sinHora: 0,
    canceladas: 0,
    llamadas,
    atrasado,
  };
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
 */
async function guardar(orgId: string, contactoId: string, cita: CitaDeGhl): Promise<boolean> {
  const valores = {
    ghl_evento_id: cita.id,
    contacto_id: contactoId,
    inicio_el: cita.inicioEl,
    fin_el: cita.finEl,
    titulo: cita.titulo,
    estado_ghl: cita.estado,
    sala_url: cita.sala,
    sincronizado_el: new Date(),
  };

  const r = await conOrganizacion(orgId, async () =>
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
          sincronizado_el: valores.sincronizado_el,
        } as never),
      )
      .returning('id')
      .executeTakeFirst(),
  );
  return Boolean(r);
}
