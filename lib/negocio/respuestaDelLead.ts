// LA TASA DE RESPUESTA de Lead Flow, y por qué SÍ se puede medir sin saber quién escribió.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL INDICADOR QUE PARECÍA BLOQUEADO Y NO LO ESTABA
//
// Los indicadores de Lead Flow estaban dados por imposibles hasta que `mensajes.fuente` acumulara
// historia — hoy 180 de 5.829 filas—, porque la atribución no distingue al agente de IA de un flujo
// del CRM: medido, el 71,5 % de lo sellado con el identificador del agente es `workflow`.
//
// Pero esa objeción **no alcanza a este indicador**, y conviene ver por qué. La pregunta es *«a los
// contactos a los que les escribimos, ¿cuántos contestaron?»*:
//
//   · el DENOMINADOR es «tiene al menos un saliente» — no importa qué mecanismo lo mandó;
//   · el NUMERADOR es «tiene al menos un entrante» — lo escribió el contacto, no nosotros.
//
// Ninguno de los dos necesita saber quién escribió de nuestro lado. Lo que `fuente` va a agregar
// cuando acumule es la pregunta más fina —«de lo que escribió EL AGENTE, cuánto se contestó»— y esa
// sigue esperando. Las dos son distintas y esta pantalla dice cuál está mostrando.
//
// ── LA COHORTE ES POR FECHA DE ALTA, Y ESO NO ES UN DETALLE ─────────────────
//
// Medido el 2026-09-14 sobre los contactos de zona setter:
//
//     dados de alta hace más de 14 días   129 escritos   36 contestaron   **27,9 %**
//     dados de alta en los últimos 14     119 escritos   81 contestaron   **68,1 %**
//
// Cuarenta puntos de diferencia. Y NO es un agujero de datos: se comprobó que los viejos SÍ tienen
// mensajes guardados —129 de 160— y que 93 de esos 129 recibieron mensajes y **nunca contestaron**.
// O sea que es un hecho del negocio y no del sistema.
//
// Por eso mezclarlos daría un promedio que no describe a ninguno de los dos, y por eso la cohorte se
// acota a los últimos 14 días: la misma ventana que los indicadores de citas, para que las dos
// pestañas hablen del mismo período.
//
// ── LA MADUREZ DE LA COHORTE, QUE ERA LA OBJECIÓN OBVIA ────────────────────
//
// Un contacto dado de alta ayer no tuvo tiempo de contestar, así que una cohorte de catorce días
// mezcla maduros con recién llegados y debería salir diluida. Se midió antes de decidir:
//
//     menos de 3 días   70,0 %        de 3 a 7 días   60,0 %        de 7 a 14 días   69,4 %
//
// Es estable dentro de la ventana, así que la dilución no ocurre en la práctica. Queda escrito para
// que quien mueva la ventana sepa que esto se comprobó y no se supuso.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { DIAS_DE_LA_TASA } from './indicadoresDeCitas.ts';

export interface RespuestaDelLead {
  /** Contactos de zona setter dados de alta en la ventana. */
  cohorte: number;
  /** De ésos, a cuántos se les escribió al menos una vez. Es el denominador. */
  escritos: number;
  /** De los escritos, cuántos contestaron al menos una vez. */
  respondieron: number;
  /** De 0 a 100. `null` cuando no se le escribió a nadie: un 0 % sería una afirmación. */
  tasa: number | null;
  dias: number;
  /** El texto ya armado, o `null` si no hay nada que advertir. La regla de silencio de siempre. */
  aviso: string | null;
}

export async function respuestaDelLead(dias = DIAS_DE_LA_TASA): Promise<RespuestaDelLead> {
  const fila = await datos()
    .selectFrom('contactos')
    .select([
      sql<number>`count(*)`.as('cohorte'),
      /* Los dos `exists` y no un `join` con `distinct`: un contacto con doscientos mensajes tiene que
         contar UNA vez, y con un `join` contaría doscientas. El `exists` corta en el primero. */
      sql<number>`count(*) filter (where exists (
        select 1 from negocio.mensajes m
         where m.org_id = contactos.org_id and m.contacto_id = contactos.id
           and m.direccion = 'saliente'
      ))`.as('escritos'),
      sql<number>`count(*) filter (where
        exists (
          select 1 from negocio.mensajes m
           where m.org_id = contactos.org_id and m.contacto_id = contactos.id
             and m.direccion = 'saliente'
        )
        and exists (
          select 1 from negocio.mensajes m
           where m.org_id = contactos.org_id and m.contacto_id = contactos.id
             and m.direccion = 'entrante'
        )
      )`.as('respondieron'),
    ])
    /* La zona del SETTER, que es de quien habla Lead Flow. Y ojo con lo que esto NO es: los contactos
       que agendaron se van a zona closer, así que esta cohorte son los que todavía no agendaron más
       los que nunca lo harán. Sirve para la tasa de respuesta —que es sobre conversación, no sobre
       cita— y NO serviría para una tasa de agendamiento: medido, de 280 contactos en zona setter sólo
       2 tienen cita, porque los que agendan dejan de estar acá. */
    .where('territorio', '=', 'setter')
    .where(sql<boolean>`creado_el >= now() - make_interval(days => ${dias})`)
    .executeTakeFirst();

  const cohorte = Number(fila?.cohorte ?? 0);
  const escritos = Number(fila?.escritos ?? 0);
  const respondieron = Number(fila?.respondieron ?? 0);

  return {
    cohorte,
    escritos,
    respondieron,
    tasa: escritos === 0 ? null : Math.round((respondieron / escritos) * 1000) / 10,
    dias,
    aviso: avisoDe(cohorte, escritos, dias),
  };
}

/**
 * Qué advertir, y cuándo callarse.
 *
 * El caso que importa es el tercero: **hay contactos en la zona y no se le escribió a ninguno**. Sin
 * decirlo, el guion de la tasa se lee como «nadie contesta», cuando lo que pasa es que nadie
 * preguntó — dos cosas opuestas que se ven igual en pantalla.
 */
function avisoDe(cohorte: number, escritos: number, dias: number): string | null {
  if (cohorte === 0) return `No entraron contactos nuevos a la zona del setter en ${dias} días.`;
  if (escritos === 0) {
    return `Hay ${cohorte} contacto(s) nuevos y no se le escribió a ninguno, así que no hay tasa que ` +
      'calcular. El vacío es de mensajes salientes, no de respuestas.';
  }
  /* Y si a algunos no se les escribió, se dice — pero sólo si son varios: uno solo en una cohorte de
     ciento veinte es ruido, y un aviso que aparece siempre se aprende a ignorar. */
  const sinEscribir = cohorte - escritos;
  return sinEscribir > 1
    ? `No se cuentan ${sinEscribir} contacto(s) a los que todavía no se les escribió: no pudieron ` +
        'contestar, y meterlos en el denominador bajaría la tasa sin que nadie hiciera nada mal.'
    : null;
}
