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
import { avisoDeLaCola } from './periodo.ts';

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
  /**
   * El contacto más viejo que la ventana llegó a alcanzar. **No es `now() - dias`.**
   *
   * Con «completo» la ventana son diez años y el grueso de los contactos es de las últimas semanas.
   * Sin esta fecha, la pantalla diría «completo» sobre seis semanas y quien mira creería estar
   * viendo un año. Es lo único que distingue *«pedí todo»* de *«todo es esto»*. `null` con cohorte
   * vacía.
   *
   * **No viaja sola, y ese arreglo salió de medirla.** Ver `avisoDeLaVentana`.
   */
  desde: Date | null;
  /**
   * La fecha en la que la cohorte llegó a la MITAD. **Mediana y no promedio**, por el mismo motivo
   * que las latencias de más abajo: una sola fila vieja corre el promedio y no puede correr la
   * mediana.
   *
   * `null` con cohorte vacía.
   */
  mitad: Date | null;
  /**
   * Qué hay que decir cuando `desde` describe a un caso suelto y no a los datos. `null` es el caso
   * normal — ver `avisoDeLaCola`, que es donde vive el umbral con su medición.
   *
   * ── ESTE CAMPO EXISTE PORQUE `desde` SOLO SE EQUIVOCABA ───────────────────
   *
   * Medido el 2026-09-16 en producción: en «Completo», `desde` vale **2025-08-08** y es cierto, pero
   * **95 % de los 559 contactos entraron en las últimas seis semanas**; la historia larga son 28
   * contactos repartidos en doce meses. La pantalla decía «desde el 8 de agosto de 2025» sobre un
   * conjunto que es de agosto de 2026, o sea justo la lectura que `desde` vino a impedir.
   *
   * Y no se apagó `desde`: la fila vieja existe y el rango es ése. Lo que faltaba era la segunda
   * cifra que lo pone en escala.
   */
  avisoDeLaVentana: string | null;
  /** Contactos que ENTRARON AL CRM en la ventana. El denominador de todo lo demás. */
  cohorte: number;

  // ── El KPI principal (§9.3) ───────────────────────────────────────────────
  /** De la cohorte, cuántos tienen al menos una cita que el barrido todavía alcanza. */
  agendaron: number;
  /** De 0 a 100. `null` con cohorte vacía: un 0 % sería una afirmación sobre el negocio. */
  bookingRate: number | null;
  /**
   * De los que agendaron, cuántos lo hicieron con una cita que el barrido **ya no refresca**.
   *
   * Cuentan como agendamiento —agendar es el evento; ver el comentario de `tieneCita`— y aun así
   * viajan aparte, porque son exactamente los que la tasa de cancelación de al lado NO cuenta. Sin
   * esta cifra, las dos tarjetas de la misma pantalla hablan de dos poblaciones y nada lo dice.
   *
   * Medido el 2026-09-16: **0 a catorce días y 22 a treinta**, que es la ventana por omisión.
   */
  agendaronSoloCongeladas: number;
  /** Qué decir de esos contactos, o `null` cuando no hay ninguno. */
  avisoDelBooking: string | null;

  // ── CÓMO llegaron a agendar, que NO es un escalón más del embudo ──────────
  /**
   * De los que agendaron, cuántos venían de haber contestado al menos una vez.
   *
   * ── ESTA CIFRA EXISTE PARA IMPEDIR UN EMBUDO QUE MIENTE ───────────────────
   *
   * Medido hoy: entraron 231, se le escribió a 225, contestaron 138, agendaron 121. Puesto en fila
   * parece un embudo, y **no lo es**: de esos 121 sólo 64 habían contestado. Los otros 57 agendaron
   * sin una sola respuesta nuestra — el enlace del calendario no obliga a conversar.
   *
   * Una barra que vaya de 138 a 121 afirma que 121 de esos 138 convirtieron. Son 64, o sea el 46,4 %
   * y no el 87,7 %: casi el doble. Y es una mentira que no falla —los cuatro números son correctos,
   * sólo la flecha entre los dos últimos es falsa—, así que nadie la va a descubrir mirando.
   *
   * Por eso la cadena se corta en «respondieron» y acá empieza una BIFURCACIÓN. Los dos sumandos
   * dan `agendaron` exactamente, y eso es lo que hay que poder comprobar.
   */
  agendaronTrasResponder: number;
  /**
   * El complemento exacto: `agendaron - agendaronTrasResponder`. Viaja calculado y no restado en la
   * pantalla para que la suma sea una propiedad del módulo y no una costumbre de quien la dibuja.
   *
   * Incluye dos casos que **no** conviene separar acá: a quien se le escribió y nunca contestó, y a
   * quien nunca se le escribió. Los dos significan lo mismo para esta pregunta —agendó sin que la
   * conversación pasara por una respuesta suya— y partirlos en dos daría dos cifras chicas que se
   * mueven con tres contactos.
   */
  agendaronSinResponder: number;

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
  /* ── AGENDAR ES EL EVENTO, Y NINGUNA DE LAS DOS EXCLUSIONES LO DESHACE ─────
   *
   * Este predicado no lleva `inicio_el < now()` ni `ghl_calendario_id is not null`, y el mismo
   * argumento cubre a los dos: **una cita que todavía no ocurrió, y una cuyo estado dejamos de
   * refrescar, son las dos citas que el lead agendó.** La cancelación sí necesita las dos cosas
   * —que haya pasado y que el estado esté fresco— porque pregunta otra cosa: si se cayó.
   *
   * ── EL FILTRO DE CALENDARIO ESTUVO ACÁ Y HUNDÍA LA CIFRA SIN AVISAR ───────
   *
   * Estaba copiado de `tasaDeCancelacion` por consistencia, no por la pregunta. Con la ventana de
   * catorce días no descartaba a nadie, así que nadie lo notó — y el día que la pantalla pasó a
   * treinta días por omisión empezó a descartar contactos que SÍ habían agendado. Medido el
   * 2026-09-16:
   *
   *     ventana    cohorte   con el filtro   sin el filtro   sólo congeladas
   *     7 días         52      26  50,0 %      26  50,0 %          0
   *     14 días       186     104  55,9 %     104  55,9 %          0     ← por eso no se veía
   *     30 días       391     175  44,8 %     197  50,4 %         22     ← la de por omisión
   *     completo      560     191  34,1 %     270  48,2 %         79
   *
   * Cinco puntos y medio en la ventana que sale sola al abrir, catorce en «Completo», y la curva
   * descendente se parecía a un hecho del negocio. Los 22 no son filas dudosas: se midieron y las 22
   * traen hora y estado reales, del 18 al 22 de agosto de 2026, o sea de antes de que la `038`
   * empezara a guardar el calendario.
   *
   * Lo que sí hay que decir es que su estado quedó detenido, y para eso viaja
   * `agendaronSoloCongeladas`: la cifra de al lado —la cancelación— no los cuenta, y dos cifras de la
   * misma pantalla sobre poblaciones distintas es exactamente lo que este proyecto declara. */
  const tieneCita = sql`exists (
    select 1 from negocio.citas ci
     where ci.org_id = contactos.org_id and ci.contacto_id = contactos.id)`;
  /* El predicado VIEJO, que ahora sólo sirve para contar la diferencia. Se conserva escrito acá y
     no se deduce restando: restando, el día que alguien cambie uno de los dos la resta sigue dando
     un número y deja de significar lo que dice. */
  const tieneCitaAlcanzable = sql`exists (
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
      /* Los que agendaron y cuya ÚNICA cita el barrido ya no refresca. Es la diferencia entre el
         numerador de esta cifra y el de la cancelación de al lado, y viaja para que se pueda ver. */
      sql<number>`count(*) filter (
        where ${tieneCita} and not ${tieneCitaAlcanzable}
      )`.as('solo_congeladas'),
      /* La bifurcación, en la MISMA pasada que su total. Restarla después en la pantalla dejaría que
         los dos sumandos vinieran de dos consultas y pudieran no sumar `agendaron`. Ver el comentario
         de `agendaronTrasResponder`: la suma es lo único que hace honesta a la figura. */
      sql<number>`count(*) filter (
        where ${tieneCita} and ${tieneSaliente} and ${tieneEntrante}
      )`.as('agendaron_tras_responder'),
      sql<number>`count(*) filter (where not ${tieneSaliente})`.as('sin_mensaje'),
      sql<number>`count(*) filter (where ${tieneSaliente} and not ${tieneEntrante})`.as('sin_contestar'),
      /* El contacto más viejo que la ventana alcanzó, LA MEDIANA, y la proporción entre las dos.
         Las tres en la misma pasada y calculadas por la BASE: la proporción compara contra `now()`,
         y el «ahora» tiene que ser el mismo reloj que escribió las filas. Ver `avisoDeLaCola`. */
      sql<Date | null>`min(alta_en_el_crm)`.as('desde'),
      /* `percentile_disc` y no `percentile_cont`: devuelve una fecha que EXISTE en los datos en vez
         de interpolar entre dos. Para «cuándo llegó la cohorte a la mitad», una fecha real dice más
         que un instante promediado que no le corresponde a ningún contacto. */
      sql<Date | null>`percentile_disc(0.5) within group (order by alta_en_el_crm)`.as('mitad'),
      sql<number | null>`
        extract(epoch from (now() - percentile_disc(0.5) within group (order by alta_en_el_crm)))
        / nullif(extract(epoch from (now() - min(alta_en_el_crm))), 0)`.as('proporcion'),
    ])
    .where(enLaVentana)
    .executeTakeFirst();

  const lat = await latencias(dias);

  const cohorte = Number(fila?.cohorte ?? 0);
  const escritos = Number(fila?.escritos ?? 0);
  const respondieron = Number(fila?.respondieron ?? 0);
  const agendaron = Number(fila?.agendaron ?? 0);
  const agendaronTrasResponder = Number(fila?.agendaron_tras_responder ?? 0);
  const agendaronSoloCongeladas = Number(fila?.solo_congeladas ?? 0);
  const sinNingunMensaje = Number(fila?.sin_mensaje ?? 0);
  const escritosSinContestar = Number(fila?.sin_contestar ?? 0);

  const mitad = fila?.mitad ?? null;

  return {
    dias,
    desde: fila?.desde ?? null,
    mitad,
    avisoDeLaVentana: avisoDeLaCola(
      fila?.proporcion === null || fila?.proporcion === undefined
        ? null
        : Number(fila.proporcion),
      mitad,
      'la mitad de los contactos entró',
    ),
    cohorte,
    agendaron,
    bookingRate: cohorte === 0 ? null : Math.round((agendaron / cohorte) * 1000) / 10,
    agendaronSoloCongeladas,
    avisoDelBooking:
      agendaronSoloCongeladas === 0
        ? null
        : `${agendaronSoloCongeladas} de los ${agendaron} agendaron con una cita que el barrido ya ` +
          'no refresca: cuentan acá —agendar es el evento— y NO entran en la tasa de cancelación, ' +
          'que necesita un estado fresco para poder preguntar si se cayó.',
    agendaronTrasResponder,
    agendaronSinResponder: agendaron - agendaronTrasResponder,
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
