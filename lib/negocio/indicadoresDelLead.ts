// Las cifras de Lead Flow, en una sola pasada y sobre UNA sola cohorte.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA COHORTE CAMBIÓ, Y ES EL CAMBIO MÁS IMPORTANTE DE ESTE ARCHIVO
//
// Antes: `contactos.creado_el` —cuándo lo vio NUESTRO barrido— y además filtrando `territorio =
// 'setter'`. Ahora: `contactos.alta_en_el_crm`, que es cuándo entró el lead al CRM de verdad
// (migración `048`), y sin filtro de territorio.
//
// ── POR QUÉ `creado_el` ESTABA POR ROMPERSE SOLO ────────────────────────────
//
// No es que diera un número muy distinto —medido el 2026-09-14, la tasa de respuesta pasa de 68,1 %
// a 67,0 % con el mismo filtro de zona—. El problema es QUIÉN entra:
//
//   · Los 7 contactos que se movían son de zona setter con alta en el CRM de hasta **nueve meses
//     atrás** (del 2025-12-22 al 2026-08-24), que `creado_el` contaba como «nuevos de esta semana»
//     porque el barrido los vio por primera vez la semana pasada.
//   · Y la carga inicial fue el **2026-08-24**: 239 contactos comparten esa marca de `creado_el`.
//     En cuanto la ventana de 14 días la toque, la cohorte **salta de 260 a 499 de golpe** sin que
//     entre un solo lead. Todas las tasas se moverían el mismo día, por el calendario del barrido.
//
// `alta_en_el_crm` no tiene ese acantilado porque las fechas son las del CRM. Y la latencia entre
// las dos está medida: en la ventana, **ningún contacto estuvo más de 42 minutos** fuera de nuestro
// alcance (mediana 5 minutos), así que la cohorte nueva no mezcla leads que el sistema no pudo
// trabajar.
//
// ── Y POR QUÉ SE FUE EL FILTRO DE TERRITORIO ────────────────────────────────
//
// **El territorio es consecuencia de agendar, no una cohorte.** Un contacto que agenda se va a zona
// closer, así que `territorio = 'setter'` son los que todavía no agendaron más los que nunca lo
// harán — y sobre esa población un booking rate da 2 de 280, que es una tautología, no una cifra.
//
// El precio está medido y hay que decirlo en voz alta: **la tasa de respuesta baja de 68,1 % a
// 60,9 %**. No empeoró nada. Lo que cambió es que la cohorte dejó de excluir a los que agendaron —
// y entre ellos hay 59 contactos que agendaron **sin escribirnos nunca**, que la cohorte vieja no
// veía y que bajan la tasa por existir.
//
// ── UNA SOLA COHORTE PARA LAS CUATRO CIFRAS, Y ESO ES EL PUNTO ──────────────
//
// Las cuatro se calculan sobre los mismos 236 contactos. Con cohortes distintas por cifra, dos
// tarjetas de la misma tarjeta dirían cosas que no se pueden sumar —«60,9 % contesta» y «52,5 %
// agenda» sobre poblaciones distintas no permiten preguntarse cuántos hicieron las dos— y nadie
// tendría cómo darse cuenta.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { DIAS_DE_LA_TASA } from './indicadoresDeCitas.ts';

/**
 * Una latencia, en minutos. **Dos percentiles y no un promedio.**
 *
 * El promedio miente acá y está medido: en el tiempo hasta el primer intento el promedio es
 * **30,6 veces la mediana** (71,0 contra 2,32 minutos), porque una sola conversación de dos días y
 * medio lo arrastra entera. Una cifra que se mueve así con una fila no describe al resto.
 *
 * Y el p90 va al lado del p50 porque solo los dos juntos dicen la verdad: en el tiempo hasta la
 * primera respuesta, el p90 es **61 veces** el p50 (6 minutos contra 6,2 horas). Publicar sólo la
 * mediana diría «contestan en seis minutos» de un negocio donde uno de cada diez tarda más de seis
 * horas.
 */
export interface Latencia {
  p50: number;
  p90: number;
  /** Sobre cuántos contactos se midió. Viaja para que la pantalla no lo suponga. */
  sobre: number;
}

export interface IndicadoresDelLead {
  dias: number;
  /** Contactos que ENTRARON AL CRM en la ventana. El denominador de todo lo demás. */
  cohorte: number;

  // ── El KPI principal (§9.3) ───────────────────────────────────────────────
  /** De la cohorte, cuántos tienen al menos una cita que el barrido todavía alcanza. */
  agendaron: number;
  /** De 0 a 100. `null` con cohorte vacía: un 0 % sería una afirmación sobre el negocio. */
  bookingRate: number | null;

  // ── La conversación ───────────────────────────────────────────────────────
  /** A cuántos se les escribió al menos una vez. */
  escritos: number;
  /** De los escritos, cuántos contestaron. */
  respondieron: number;
  /** La tasa de respuesta. `null` si no se le escribió a nadie. */
  tasa: number | null;

  // ── Las latencias (§9.7) ──────────────────────────────────────────────────
  /** De que el lead entra al CRM a que le escribimos por primera vez. */
  hastaElPrimerIntento: Latencia | null;
  /** De nuestro primer mensaje a su primera respuesta. **Sólo de los que contestaron.** */
  hastaLaPrimeraRespuesta: Latencia | null;

  // ── Los dos conteos, que NO son tasas ─────────────────────────────────────
  /**
   * Contactos a los que no se les escribió nunca. **Conteo y no tasa, a propósito.**
   *
   * Medido: 6 de 236, y **5 de esos 6 ya tienen cita** — se autoagendaron y nadie les escribió
   * después. Titular esto «leads sin atender» sería falso. Y como tasa, pasar de 6 a 10 sobre 236
   * se lee como un deterioro del 68 % cuando son cuatro contactos.
   */
  sinNingunMensaje: number;
  /** Escritos que todavía no contestaron. El complemento exacto de `respondieron`. */
  escritosSinContestar: number;

  aviso: string | null;
  /** El de las latencias va aparte: habla de otra población y se apaga por su cuenta. */
  avisoDeLatencias: string | null;
}

/**
 * Las cifras de Lead Flow. **Corre dentro de `conOrganizacion(`.**
 *
 * Dos consultas y no una: los conteos son por CONTACTO y las latencias son percentiles sobre
 * subconjuntos distintos (230 y 140). Forzarlas en un solo `select` pediría los percentiles con
 * `filter` sobre la misma pasada, que se puede, pero dejaría las cuatro cifras colgando de una
 * consulta que nadie va a poder leer dentro de seis meses. Van las dos en la misma transacción.
 */
export async function indicadoresDelLead(dias = DIAS_DE_LA_TASA): Promise<IndicadoresDelLead> {
  const enLaVentana = sql<boolean>`alta_en_el_crm >= now() - make_interval(days => ${dias})`;

  /* Los `exists` y no un `join` con `distinct`: un contacto con doscientos mensajes tiene que contar
     UNA vez, y con un `join` contaría doscientas. El `exists` corta en el primero. */
  const tieneSaliente = sql`exists (
    select 1 from negocio.mensajes m
     where m.org_id = contactos.org_id and m.contacto_id = contactos.id
       and m.direccion = 'saliente')`;
  const tieneEntrante = sql`exists (
    select 1 from negocio.mensajes m
     where m.org_id = contactos.org_id and m.contacto_id = contactos.id
       and m.direccion = 'entrante')`;
  /* ── LA CITA TIENE QUE SER ALCANZABLE, Y NO TIENE QUE HABER OCURRIDO ───────
   *
   * `ghl_calendario_id is not null` es el mismo filtro que todas las cifras de citas: las anteriores
   * a la `038` ya no las refresca el barrido.
   *
   * Lo que este filtro **no** lleva, y es deliberado, es `inicio_el < now()`. Copiar eso de
   * `tasaDeCancelacion` borraría a los 12 contactos que ya agendaron para los próximos días y
   * bajaría el booking rate de 52,5 % a 48,7 %. **Agendar es el evento**: que la cita todavía no
   * haya ocurrido no lo deshace. La cancelación sí necesita que la cita haya pasado, porque
   * pregunta otra cosa. */
  const tieneCita = sql`exists (
    select 1 from negocio.citas ci
     where ci.org_id = contactos.org_id and ci.contacto_id = contactos.id
       and ci.ghl_calendario_id is not null)`;

  const fila = await datos()
    .selectFrom('contactos')
    .select([
      sql<number>`count(*)`.as('cohorte'),
      sql<number>`count(*) filter (where ${tieneSaliente})`.as('escritos'),
      sql<number>`count(*) filter (where ${tieneSaliente} and ${tieneEntrante})`.as('respondieron'),
      sql<number>`count(*) filter (where ${tieneCita})`.as('agendaron'),
      sql<number>`count(*) filter (where not ${tieneSaliente})`.as('sin_mensaje'),
      sql<number>`count(*) filter (where ${tieneSaliente} and not ${tieneEntrante})`.as('sin_contestar'),
    ])
    .where(enLaVentana)
    .executeTakeFirst();

  const lat = await latencias(dias);

  const cohorte = Number(fila?.cohorte ?? 0);
  const escritos = Number(fila?.escritos ?? 0);
  const respondieron = Number(fila?.respondieron ?? 0);
  const agendaron = Number(fila?.agendaron ?? 0);
  const sinNingunMensaje = Number(fila?.sin_mensaje ?? 0);
  const escritosSinContestar = Number(fila?.sin_contestar ?? 0);

  return {
    dias,
    cohorte,
    agendaron,
    bookingRate: cohorte === 0 ? null : Math.round((agendaron / cohorte) * 1000) / 10,
    escritos,
    respondieron,
    tasa: escritos === 0 ? null : Math.round((respondieron / escritos) * 1000) / 10,
    hastaElPrimerIntento: lat.intento,
    hastaLaPrimeraRespuesta: lat.respuesta,
    sinNingunMensaje,
    escritosSinContestar,
    aviso: avisoDe(cohorte, escritos, dias),
    avisoDeLatencias: avisoDeLasLatencias(lat, escritos, respondieron),
  };
}

/**
 * Los dos percentiles de cada latencia.
 *
 * ── LA GUARDA `>= 0` NO ES PARANOIA: HAY UNA FILA QUE LA EJERCITA ───────────
 *
 * Un primer saliente ANTERIOR al alta da una latencia negativa, y significa que ese contacto existía
 * antes en otro lado. En la ventana de 14 días hay **cero** — medido— pero fuera de ella hay **una**
 * fila de **−103,9 días**. Sin la guarda, el día que alguien ensanche la ventana esa sola fila
 * arrastra el promedio, y el número que sale sigue pareciendo razonable.
 *
 * Por eso el filtro va en el SQL y no en un comentario: el defecto no aparece hoy y aparece el día
 * que se cambie un número que parece inofensivo.
 */
async function latencias(
  dias: number,
): Promise<{ intento: Latencia | null; respuesta: Latencia | null }> {
  const f = await datos()
    .selectFrom('contactos as ct')
    .select([
      sql<number>`count(*) filter (where prim_sal is not null and prim_sal >= ct.alta_en_el_crm)`.as('n_intento'),
      sql<number | null>`percentile_cont(0.5) within group (
        order by extract(epoch from (prim_sal - ct.alta_en_el_crm)) / 60
      ) filter (where prim_sal is not null and prim_sal >= ct.alta_en_el_crm)`.as('intento_p50'),
      sql<number | null>`percentile_cont(0.9) within group (
        order by extract(epoch from (prim_sal - ct.alta_en_el_crm)) / 60
      ) filter (where prim_sal is not null and prim_sal >= ct.alta_en_el_crm)`.as('intento_p90'),
      sql<number>`count(*) filter (where prim_ent is not null and prim_sal is not null and prim_ent >= prim_sal)`.as('n_resp'),
      sql<number | null>`percentile_cont(0.5) within group (
        order by extract(epoch from (prim_ent - prim_sal)) / 60
      ) filter (where prim_ent is not null and prim_sal is not null and prim_ent >= prim_sal)`.as('resp_p50'),
      sql<number | null>`percentile_cont(0.9) within group (
        order by extract(epoch from (prim_ent - prim_sal)) / 60
      ) filter (where prim_ent is not null and prim_sal is not null and prim_ent >= prim_sal)`.as('resp_p90'),
    ])
    /* Los dos instantes se calculan en subconsultas laterales y no con un `join` + `min`: con el
       `join`, un contacto sin mensajes desaparecería de la fila en vez de contar como «sin dato»,
       y los 6 que no recibieron nada son justamente los que hay que poder informar. */
    .innerJoin(
      (eb) =>
        eb
          .selectFrom('contactos as c2')
          .select([
            'c2.id as cid',
            sql<Date | null>`(select min(m.enviado_el) from negocio.mensajes m
               where m.org_id = c2.org_id and m.contacto_id = c2.id and m.direccion = 'saliente')`.as('prim_sal'),
            sql<Date | null>`(select min(m.enviado_el) from negocio.mensajes m
               where m.org_id = c2.org_id and m.contacto_id = c2.id and m.direccion = 'entrante')`.as('prim_ent'),
          ])
          .as('h'),
      (j) => j.onRef('h.cid', '=', 'ct.id'),
    )
    .where(sql<boolean>`ct.alta_en_el_crm >= now() - make_interval(days => ${dias})`)
    .executeTakeFirst();

  const arma = (n: unknown, p50: unknown, p90: unknown): Latencia | null => {
    const sobre = Number(n ?? 0);
    /* Sin observaciones no hay percentil, y un cero acá diría «contestan al instante». Es el mismo
       criterio que `horasHastaLaCita` en `indicadoresDeCitas`. */
    if (sobre === 0 || p50 === null || p50 === undefined) return null;
    return {
      p50: Math.round(Number(p50) * 100) / 100,
      p90: Math.round(Number(p90 ?? p50) * 100) / 100,
      sobre,
    };
  };

  return {
    intento: arma(f?.n_intento, f?.intento_p50, f?.intento_p90),
    respuesta: arma(f?.n_resp, f?.resp_p50, f?.resp_p90),
  };
}

/**
 * Qué advertir de la cohorte, y cuándo callarse.
 *
 * El caso que importa es el segundo: **entraron contactos y no se le escribió a ninguno**. Sin
 * decirlo, el hueco de la tasa se lee como «nadie contesta», cuando lo que pasa es que nadie
 * preguntó — dos cosas opuestas que se ven igual en pantalla.
 */
function avisoDe(cohorte: number, escritos: number, dias: number): string | null {
  if (cohorte === 0) {
    return `No entró ningún contacto nuevo al CRM en ${dias} días, así que no hay nada que medir.`;
  }
  if (escritos === 0) {
    return `Entraron ${cohorte} contacto(s) y no se le escribió a ninguno, así que no hay tasa de ` +
      'respuesta que calcular. El vacío es de mensajes salientes, no de respuestas.';
  }
  /* Y si a algunos no se les escribió, se dice — pero sólo si son varios: uno solo en una cohorte de
     doscientos es ruido, y un aviso que aparece siempre se aprende a ignorar. */
  const sinEscribir = cohorte - escritos;
  return sinEscribir > 1
    ? `${sinEscribir} contacto(s) no entran en la tasa de respuesta porque todavía no se les ` +
        'escribió: no pudieron contestar, y meterlos en el denominador la bajaría sin que nadie ' +
        'hiciera nada mal. Sí entran en el booking rate, que no depende de que les escribamos.'
    : null;
}

/**
 * Lo que las latencias NO dicen, que es más importante que lo que dicen.
 *
 * **El censurado.** Los 90 contactos escritos que todavía no contestaron no tienen latencia infinita
 * ni latencia cero: son observaciones incompletas. Meterlos como cero, o como «el tiempo hasta hoy»,
 * convertiría la mediana en una función de cuándo se abre la pantalla.
 *
 * Y el sesgo va en una dirección concreta, medida: los que nunca contestaron tienen **más** intentos
 * que los que sí (mediana 3 contra 1), así que el grupo que falta no es una muestra al azar del que
 * está. Por eso el aviso dice cuántos faltan en vez de dejar que la mediana hable sola.
 */
function avisoDeLasLatencias(
  lat: { intento: Latencia | null; respuesta: Latencia | null },
  escritos: number,
  respondieron: number,
): string | null {
  if (lat.intento === null && lat.respuesta === null) return null;
  const pendientes = escritos - respondieron;
  if (pendientes <= 1) return null;
  return `El tiempo de respuesta se mide sobre los ${respondieron} contactos que ya contestaron. ` +
    `Otros ${pendientes} recibieron mensaje y todavía no contestaron: no son una respuesta de cero ` +
    'ni de infinito, así que no entran — y no son una muestra al azar de los demás, porque los que ' +
    'no contestan reciben más intentos, no menos.';
}
