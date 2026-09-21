// Cuántos días pasan del alta en el CRM a la primera cita.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL NOMBRE ES EL PRIMER DISEÑO, Y NO DICE «CICLO DE VENTA»
//
// «Ciclo de venta» promete alta → venta. Lo que se puede medir hoy es alta → primera **cita**: el
// último eslabón no existe —cero ventas en toda la base— y el penúltimo está en 4 de 566
// (`cadenaDeCierre.ts`). Un archivo llamado `cicloDeVenta.ts` pasaría todas las pruebas y sería lo
// primero que alguien cita en una reunión como si midiera el cierre.
//
// ── LA MEDIA ES PEOR QUE EL p90, Y ESO SE MIDIÓ ─────────────────────────────
//
// Medido contra producción el 2026-09-21, sobre los 197 contactos con primera cita:
//
//     mediana (p50)      2,86 días
//     p90               10,62 días
//     promedio          16,47 días   ← MÁS ALTO QUE EL p90
//
// **El promedio está por encima de nueve de cada diez casos.** La cola que lo arrastra son 14
// contactos de más de un mes, uno de ellos de 290 días. Una cifra que describe a catorce de ciento
// noventa y siete no describe al negocio, y por eso el promedio **no viaja en el tipo**: si no está,
// no se puede dibujar por descuido.
//
// ── Y LOS DOS PERCENTILES VAN JUNTOS ────────────────────────────────────────
//
// Es el precedente de `indicadoresDelLead.ts:52-68`, y vale por lo mismo: *«sólo los dos juntos
// dicen la verdad»*. Acá el p90 es **3,7 veces** el p50. Publicar sólo la mediana diría «agendan en
// tres días» de un negocio donde uno de cada diez tarda más de diez.
//
// ── LOS DOS SESGOS, Y EL SEGUNDO NO TIENE PRECEDENTE ────────────────────────
//
// **1 · La censura.** 369 de 566 contactos nunca tuvieron una cita alcanzable. No son ciclo cero ni
// ciclo infinito: **no entran en la cifra**, y eso se dice. Un `coalesce(primera_cita, now())` los
// metería como «todavía esperando» y movería la mediana sin que nada fallara. El precedente es
// `avisoDeLasLatencias` (`indicadoresDelLead.ts:426-450`).
//
// **2 · El techo de la ventana**, que es propio de esta cifra. **Con el botón de «7 días», la
// mediana no puede pasar de 7**: sólo entran los contactos que agendaron dentro de esos siete días,
// y los que tardaron veinte no están en la cohorte. Esa ventana produce siempre un ciclo excelente y
// nada falla.
//
// Medido: con «completo» entran los 14 de más de un mes y el p90 da 10,62; con siete días esos
// catorce desaparecen. Por eso `techoDeLaVentana` viaja y `avisoDelTecho` se enciende cuando el p90
// se acerca al borde — y con «completo» (3650 días) no se enciende nunca, que es lo correcto.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { DIAS_DE_LA_TASA, PISO_DE_UNA_TASA } from './indicadoresDeCitas.ts';
import { alcanzable } from './citasAlcanzables.ts';

/**
 * A partir de qué fracción del techo se avisa.
 *
 * `0.8` y no `1`: el aviso tiene que aparecer **antes** de que la cifra choque contra el borde, no
 * cuando ya lo tocó. Con el p90 en el 80 % de la ventana, la cola ya está recortada y la mediana ya
 * está describiendo sólo a los rápidos.
 */
const CERCA_DEL_TECHO = 0.8;

export interface CicloHastaLaCita {
  dias: number;
  /** Contactos de la ventana con fecha de alta. El denominador de la cobertura. */
  cohorte: number;
  /**
   * Días del alta a la primera cita alcanzable. **`null` bajo el piso, nunca cero.**
   *
   * Un cero acá afirmaría que agendan el mismo día; lo que pasa bajo el piso es que no hay con qué
   * decirlo.
   */
  p50: number | null;
  p90: number | null;
  /** Los **dos** términos: sobre cuántos se midió, de cuántos hay. */
  cobertura: { con: number; sobre: number };
  /**
   * Los que todavía no agendaron. **No son cero ni infinito: no entran, y se dicen.**
   *
   * Medido el 2026-09-21: 369 de 566. Es el sesgo más grande de esta cifra y el más fácil de
   * esconder — un `coalesce(primera_cita, now())` los mete como «esperando» y mueve la mediana.
   */
  sinCitaTodavia: number;
  /** El techo de lo que esta cifra puede decir en esta ventana: son los días pedidos. */
  techoDeLaVentana: number;
  /** Encendido cuando la ventana TRUNCA la cifra en vez de describirla. `null` si no. */
  avisoDelTecho: string | null;
  /** El piso, para que la pantalla lo diga sin importar un módulo que abre la base. */
  piso: number;
  aviso: string | null;
}

/**
 * El ciclo del alta a la primera cita, en la ventana.
 *
 * Se corre dentro de `conOrganizacion(`.
 */
export async function cicloHastaLaCita(dias = DIAS_DE_LA_TASA): Promise<CicloHastaLaCita> {
  /* La misma ventana rodante que `cadenaDeCierre`, y por el mismo motivo: acá no hay ninguna columna
     `date` que obligue a anclar al día. Ver su encabezado. */
  const enLaVentana = sql<boolean>`contactos.alta_en_el_crm >= now() - make_interval(days => ${dias})`;

  /* ── LA PRIMERA CITA ES LA PRIMERA, Y TIENE QUE SER ALCANZABLE ─────────────
   *
   * `min` y no `max`: un contacto con citas a 2 y a 40 días tardó dos en agendar, no cuarenta.
   *
   * Y `alcanzable`: una cita congelada no cuenta como primera. Si contara, el ciclo mediría sobre una
   * población que `cadenaDeCierre` no cuenta —su segundo eslabón las excluye— y las dos cifras de la
   * misma pantalla hablarían de dos grupos distintos. */
  const primeraCita = sql<Date | null>`(
    select min(ci.inicio_el) from negocio.citas ci
     where ci.org_id = contactos.org_id and ci.contacto_id = contactos.id
       and ${alcanzable('ci')})`;

  /* Los días, en `numeric` para que los percentiles no redondeen antes de tiempo.
     *
     * La guarda `>= 0` no es por datos corruptos —medido, cero contactos tienen su primera cita
     * antes del alta— sino por construcción: una cita anterior al alta **no es un ciclo**, y el día
     * que aparezca una no puede entrar como cero y bajar la mediana. */
  const enDias = sql<number | null>`nullif(
    greatest(extract(epoch from (${primeraCita} - contactos.alta_en_el_crm)) / 86400, -1), -1)`;

  const f = await datos()
    .selectFrom('contactos')
    .select([
      sql<number>`count(*)`.as('cohorte'),
      sql<number>`count(${enDias})`.as('medidos'),
      /* `percentile_cont` ignora los nulos por sí solo, que es exactamente la censura que se quiere:
         los que no agendaron no entran. Lo que NO hace solo es decirlo — eso es `sinCitaTodavia`. */
      sql<string | null>`percentile_cont(0.5) within group (order by ${enDias})`.as('p50'),
      sql<string | null>`percentile_cont(0.9) within group (order by ${enDias})`.as('p90'),
    ])
    /* La cohorte son los que TIENEN fecha de alta: sin ella no hay de dónde contar los días. Los que
       no la traen los declara `cadenaDeCierre.coberturaDeLaCohorte` —24 de 590, medido— y no se
       repite el aviso acá. */
    .where(sql<boolean>`contactos.alta_en_el_crm is not null`)
    .where(enLaVentana)
    .executeTakeFirst();

  const cohorte = Number(f?.cohorte ?? 0);
  const medidos = Number(f?.medidos ?? 0);

  /* El piso es de la población MEDIDA, no de la cohorte: con 400 contactos y tres citas, la mediana
     sale de tres observaciones aunque la cohorte sea grande. */
  const hayPiso = medidos >= PISO_DE_UNA_TASA;
  const p50 = hayPiso && f?.p50 != null ? redondear(Number(f.p50), 1) : null;
  const p90 = hayPiso && f?.p90 != null ? redondear(Number(f.p90), 1) : null;

  const salida: CicloHastaLaCita = {
    dias,
    cohorte,
    p50,
    p90,
    cobertura: { con: medidos, sobre: cohorte },
    sinCitaTodavia: cohorte - medidos,
    techoDeLaVentana: dias,
    avisoDelTecho: null,
    piso: PISO_DE_UNA_TASA,
    aviso: null,
  };

  salida.avisoDelTecho = avisoDelTecho(salida);
  salida.aviso = avisoDe(salida);
  return salida;
}

function redondear(v: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
}

/**
 * El aviso del techo. **`null` cuando la ventana describe la cifra en vez de recortarla.**
 *
 * Se mira el p90 y no la mediana: la mediana puede estar cómoda mientras la cola ya está cortada, y
 * es la cola la que el techo se come.
 */
function avisoDelTecho(r: CicloHastaLaCita): string | null {
  if (r.p90 === null) return null;
  if (r.p90 < r.techoDeLaVentana * CERCA_DEL_TECHO) return null;
  return (
    `Esta ventana son ${r.techoDeLaVentana} días, así que ningún ciclo más largo que eso puede ` +
    `entrar: quien tardó más en agendar no está en la cohorte. Con el p90 en ${r.p90} días la cifra ` +
    'está describiendo el borde de la ventana más que al negocio — mirala en una ventana más larga.'
  );
}

/** El aviso. **`null` ⟹ la pantalla no dibuja nada.** */
function avisoDe(r: CicloHastaLaCita): string | null {
  const partes: string[] = [];

  if (r.cohorte === 0) {
    return (
      'No entró ni un contacto en esta ventana. No es que falte el dato: no hubo gente. Probá una ' +
      'ventana más larga.'
    );
  }

  if (r.p50 === null) {
    partes.push(
      `Sólo ${r.cobertura.con} contacto(s) de esta ventana llegaron a agendar, y hacen falta ` +
        `${r.piso} para que una mediana signifique algo. Se muestra el conteo y no la cifra.`,
    );
  }

  /* La censura. Va siempre que haya alguno, y no sólo cuando son muchos: es el sesgo que decide qué
     población describe la cifra, y quien la lea tiene derecho a saber sobre quiénes se calculó. */
  if (r.sinCitaTodavia > 0) {
    partes.push(
      `${r.sinCitaTodavia} de los ${r.cohorte} contactos de esta ventana todavía no agendaron, así ` +
        'que no entran en la cifra. No cuentan como cero ni como una espera larga: no se sabe cuánto ' +
        'van a tardar, y algunos no van a agendar nunca.',
    );
  }

  /* Y la nota de definición, que es de la fuente y no de ninguna ventana: sin ella, «ciclo» se lee
     como «hasta la venta», que es justo el eslabón que no existe. */
  partes.push(
    'Lo que se mide es el tiempo del alta en el CRM a la PRIMERA cita, no a la venta: hoy no hay ' +
      'ninguna venta registrada de la que medir un cierre.',
  );

  return partes.length === 0 ? null : partes.join(' ');
}
