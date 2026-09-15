// Cuánto del video precall consumieron los que llegaron a la llamada. **El §10.6.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PANTALLA DECÍA QUE ESTE DATO NO VENÍA, Y VENÍA
//
// `PanelDeConversation` declaraba el precall como imposible porque *«llega como campo suelto del
// CRM, sin fecha ni porcentaje visto»*. La fecha es cierto: no viene. **El porcentaje sí viene**, y
// la creencia salió de mirar los dos campos equivocados:
//
//     Video Pre-Call                213 de 584   ← el porcentaje está acá, adentro del vocabulario
//     Clic a Video Pre-Call          20 de 584
//     Video Watch Percentage          0 de 584   ← el que se miró
//     Porcentaje de Video Visto       0 de 584   ← y el otro
//
// Los dos campos NUMERICAL dedicados al porcentaje están vacíos, con razón. El porcentaje viaja
// metido en las opciones de un RADIO. Es el mismo error que con las UTM: cierto como nombre de
// campo, engañoso como conclusión.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA TRAMPA, Y CAMBIA CÓMO SE ROTULA LA CIFRA ENTERA
//
// `Nada` y `Sin abrir (0%)` **no significan «no vio el video»**: son el ESTADO INICIAL que el CRM
// escribe al agendar, antes de que la persona haya tenido ocasión de ver nada.
//
// La evidencia es directa y no admite otra lectura: de las **13 citas futuras** de la subcuenta,
// **las 13 ya tienen el campo escrito y 11 ya dicen «sin reproducción»**. Su llamada todavía no
// ocurrió. Y el campo no es un valor por omisión de la creación del contacto —estaría en los 584—:
// está en 207 de los 213 que agendaron alguna vez.
//
// Por eso la rama se llama **«el CRM no registró reproducción»** y no «no vio el video». La
// diferencia importa: el 67 % se convierte en una acusación al lead cuando en parte es un medidor
// que no reportó. Medido además: 9 de los 20 contactos con `Clic a Video Pre-Call = Si` tienen este
// campo todavía en su valor inicial, o sea que el clic quedó registrado en un lado y no en el otro.
//
// ── Y POR ESO LA POBLACIÓN EXCLUYE DOS COSAS ───────────────────────────────
//
//   · **Las citas que no ocurrieron todavía.** Su valor inicial contaría como «no lo vio».
//   · **Las canceladas.** Quien canceló no tenía motivo para ver el precall, y además el cruce sale
//     circular: la cobertura del campo es del 94,3 % entre las citas `confirmed` y del 48,9 % entre
//     las `cancelled`, así que «tener el campo» es consecuencia de no haber cancelado antes. Es el
//     mismo defecto que la cohorte por territorio, con otro disfraz.
//
// ═══════════════════════════════════════════════════════════════════════════════
// DOS REGÍMENES DE VOCABULARIO, Y EL CORTE ES EL 2026-09-08
//
// `Sin abrir (0%)` deja de escribirse **de golpe** ese día y `Nada` ocupa su lugar: por día de alta,
// antes del 8 son todos `Sin abrir (0%)` y desde el 8 son todos `Nada`, sin transición. Nadie dejó
// de no-abrir videos un martes: **es el mismo valor renombrado.**
//
// Las dos van a la misma rama. Si fueran a ramas distintas, cualquier serie temporal mostraría un
// derrumbe fantasma el 8 de septiembre.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { ESTADOS_CANCELADOS } from '../ghl/calendarios.ts';
import { campoPorNombre } from './camposDelCrm.ts';
import { DIAS_DE_LA_TASA, PISO_DE_UNA_TASA } from './indicadoresDeCitas.ts';

/**
 * El nombre EXACTO del campo del CRM. Igual que `CAMPO_DE_CONFIRMACION`: es configuración de este
 * cliente disfrazada de constante, y el día que haya una segunda empresa se muda a una columna.
 */
export const CAMPO_DEL_PRECALL = 'Video Pre-Call';

/**
 * A qué rama va cada valor del vocabulario. **Lo que no está acá NO se fuerza.**
 *
 * Censo completo del campo, el 2026-09-14 sobre los 213 contactos que lo tienen:
 *
 *     Sin abrir (0%) 131 · Nada 43 · 76–100% 12 · 1–25% 11 · -20% 5 · 51–75% 4
 *     40-60% 2 · Clic a link 2 · 26–50% 2 · Accede: sin reproducir 1
 *
 * ── LOS TRES QUE QUEDAN SIN RAMA, Y POR QUÉ NO SE ADIVINAN ─────────────────
 *
 *   · **`-20%`** (5). No es un tramo: puede ser «menos de 20 %» o un error de carga. Elegir es
 *     inventar, y sobre cinco contactos mueve la cifra fina.
 *   · **`Clic a link`** (2). Describe un clic, no consumo. Mandarlo a «no vio» afirma que no
 *     reprodujo; mandarlo a «parcial» afirma que sí.
 *   · **`Accede: sin reproducir`** (1). Dice explícitamente que accedió Y que no reprodujo: es una
 *     CUARTA categoría —«lo abrió y no lo vio»— que el §10.6 no tiene, y que para un closer es
 *     información distinta de «lo ignoró».
 *
 * Se cuentan aparte y se informan. Con «completó» en 3 contactos, forzar 7 los movería más que
 * ningún dato real — **la bolsa de los no clasificados es más grande que la rama que decidiría**.
 *
 * ── LAS DOS ESCALAS INCOMPATIBLES ──────────────────────────────────────────
 *
 * `1–25%` usa guion LARGO (U+2013) y `40-60%` guion corto: son dos escalas distintas conviviendo.
 * Como RAMA caen las dos en «parcial», así que mapearlas no inventa nada — pero **ninguna de las
 * dos se puede convertir a número ni promediar con la otra**, y por eso esto devuelve ramas y no un
 * porcentaje medio de visionado.
 */
const RAMA: Readonly<Record<string, 'sin_reproduccion' | 'parcial' | 'completo'>> = {
  'Sin abrir (0%)': 'sin_reproduccion',
  Nada: 'sin_reproduccion',
  '1–25%': 'parcial',
  '26–50%': 'parcial',
  '51–75%': 'parcial',
  '40-60%': 'parcial',
  '76–100%': 'completo',
};

export interface ConsumoDelPrecall {
  dias: number;
  /** Contactos con cita alcanzable, **ya pasada y no cancelada**, en la ventana. */
  sobre: number;
  /** De ésos, cuántos tienen el campo escrito. */
  conCampo: number;
  /** Cuántos registraron ALGUNA reproducción (parcial o completa). */
  registraron: number;
  /** De 0 a 100. `null` por debajo del piso, o sin el campo en el CRM. */
  tasa: number | null;
  /** El desglose fino. Se devuelve siempre; `detalleSePublica` dice si alcanza para dibujarlo. */
  parcial: number;
  completo: number;
  /**
   * Valores que no se pudieron clasificar. **Hoy son 7, más que los 3 que completaron.**
   *
   * Es la única alarma que va a haber el día que el CRM agregue un valor nuevo al RADIO:
   * `negocio.campos_del_crm` no guarda las opciones declaradas de un campo, así que no hay forma de
   * enterarse por otro lado.
   */
  sinRama: number;
  /**
   * `false` cuando alguna de las dos ramas finas está por debajo del piso.
   *
   * Hoy lo está: parcial 6 y completo 3. Publicar «6 % completó» al lado de «12 % parcial» invita a
   * comparar dos números que se mueven diez puntos con cada contacto nuevo. Lo binario sí se
   * publica, porque su denominador es el mismo y sus dos lados suman 49.
   */
  detalleSePublica: boolean;
  aviso: string | null;
}

export async function consumoDelPrecall(dias = DIAS_DE_LA_TASA): Promise<ConsumoDelPrecall> {
  const vacio = (aviso: string | null): ConsumoDelPrecall => ({
    dias,
    sobre: 0,
    conCampo: 0,
    registraron: 0,
    tasa: null,
    parcial: 0,
    completo: 0,
    sinRama: 0,
    detalleSePublica: false,
    aviso,
  });

  const campoId = await campoPorNombre(CAMPO_DEL_PRECALL);
  /* Sin el campo en el catálogo no hay cifra, y **no es lo mismo que cero**: puede ser que esta
     empresa no mande precall, o que alguien lo haya renombrado en el CRM. Los dos casos mandan a
     mirar lugares distintos, y un hueco mudo los confunde. */
  if (campoId === null) {
    return vacio(
      `El CRM de esta empresa no tiene un campo «${CAMPO_DEL_PRECALL}», o cambió de nombre. Sin él ` +
        'no hay consumo que contar: no es que nadie vea el video.',
    );
  }

  const filas = await datos()
    .selectFrom('contactos as ct')
    .select([
      sql<string | null>`ct.campos_del_crm ->> ${campoId}`.as('valor'),
      sql<number>`count(*)`.as('n'),
    ])
    /* ── LA POBLACIÓN, Y LAS TRES CONDICIONES SON TODAS NECESARIAS ─────────
     *
     * Alcanzable (el barrido todavía la refresca), **ya pasada** (si no, el valor inicial contaría
     * como «no lo vio» — las 13 citas futuras de hoy ya lo tienen escrito) y **no cancelada** (quien
     * canceló no tenía motivo para ver el precall, y su cobertura del campo es la mitad).
     *
     * `exists` y no un `join`: un contacto con dos citas tiene UN valor del campo, así que con el
     * `join` su respuesta pesaría el doble.
     *
     * ── EL MISMO PREDICADO DE «CANCELADA» QUE LAS OTRAS CIFRAS ──────────────
     *
     * Acá decía `not like 'cancel%'` mientras `indicadoresDeCitas` usa la lista cerrada
     * `ESTADOS_CANCELADOS`. Hoy coinciden porque el CRM sólo manda `cancelled`, `confirmed` y
     * `noshow` — pero el vocabulario SE MUEVE: `noshow` apareció por primera vez el 2026-09-08.
     *
     * Un `cancelled_by_owner` futuro sería «no cancelada» para la tasa de cancelación y
     * «cancelada» para esta cifra: la misma cita contada de dos maneras en la misma pantalla, y
     * las dos viéndose bien por separado.
     *
     * (Y el comentario vive ACÁ y no adentro de la plantilla: sus comillas invertidas cerrarían
     * el `sql` a la mitad, que es exactamente lo que pasó al escribirlo.) */
    .where(
      sql<boolean>`exists (
        select 1 from negocio.citas ci
         where ci.org_id = ct.org_id and ci.contacto_id = ct.id
           and ci.ghl_calendario_id is not null
           and ci.inicio_el < now()
           and ci.inicio_el >= now() - make_interval(days => ${dias})
           and lower(coalesce(ci.estado_ghl, '')) <> all(${sql.val(ESTADOS_CANCELADOS)}))`,
    )
    .groupBy(sql`1`)
    .execute();

  let sobre = 0;
  let conCampo = 0;
  let parcial = 0;
  let completo = 0;
  let sinReproduccion = 0;
  let sinRama = 0;

  for (const f of filas) {
    const n = Number(f.n ?? 0);
    sobre += n;
    if (f.valor === null) continue;
    conCampo += n;
    const rama = RAMA[f.valor];
    if (rama === 'parcial') parcial += n;
    else if (rama === 'completo') completo += n;
    else if (rama === 'sin_reproduccion') sinReproduccion += n;
    else sinRama += n;
  }

  const registraron = parcial + completo;
  /* El denominador son los que TIENEN el campo menos los que no se pudieron clasificar: meter a los
     siete sin rama del lado de «no registró» afirmaría que no reprodujeron, que es justamente lo que
     no se sabe de ellos. */
  const clasificados = sinReproduccion + registraron;

  return {
    dias,
    sobre,
    conCampo,
    registraron,
    tasa:
      clasificados < PISO_DE_UNA_TASA
        ? null
        : Math.round((registraron / clasificados) * 1000) / 10,
    parcial,
    completo,
    sinRama,
    /* Las dos ramas finas tienen que pasar el piso, no su suma: si «completó» son 3, publicarlo
       junto a «parcial» invita a compararlos y el chico se mueve treinta puntos por contacto. */
    detalleSePublica: parcial >= PISO_DE_UNA_TASA && completo >= PISO_DE_UNA_TASA,
    aviso: avisoDe(sobre, conCampo, clasificados, sinRama, parcial, completo),
  };
}

/**
 * Qué advertir, y **por qué son dos avisos y no uno**.
 *
 * La cobertura y el vocabulario son dos problemas distintos: uno se arregla esperando a que el CRM
 * escriba el campo, y el otro decidiendo a qué rama va `Clic a link`. Mezclarlos en una sola frase
 * haría que quien la lea no sepa cuál de las dos cosas tiene que hacer — y la regla del silencio ya
 * enseñó que un aviso que dice dos cosas es uno que no dice ninguna.
 */
function avisoDe(
  sobre: number,
  conCampo: number,
  clasificados: number,
  sinRama: number,
  parcial: number,
  completo: number,
): string | null {
  const partes: string[] = [];

  if (sobre === 0) return null; // Ya lo dice el aviso de las citas.
  if (conCampo === 0) {
    partes.push(
      `Ninguno de los ${sobre} contactos que llegaron a su llamada tiene el campo «${CAMPO_DEL_PRECALL}» ` +
        'escrito en el CRM.',
    );
  } else if (sobre - conCampo > 1) {
    partes.push(`${sobre - conCampo} de ${sobre} contactos no tienen el campo escrito y no entran.`);
  }

  if (sinRama > 0) {
    partes.push(
      `${sinRama} traen un valor que no se puede clasificar —«-20%», «Clic a link», «Accede: sin ` +
        'reproducir»— y se cuentan aparte en vez de forzarlos a una rama: elegir por ellos movería ' +
        'la cifra con casos que nadie entendió.',
    );
  }

  if (clasificados > 0 && clasificados < PISO_DE_UNA_TASA) {
    partes.push(
      `Con ${clasificados} clasificados no se muestra una tasa: por debajo de ${PISO_DE_UNA_TASA} ` +
        'cada contacto nuevo la mueve más de diez puntos.',
    );
  } else if (parcial < PISO_DE_UNA_TASA || completo < PISO_DE_UNA_TASA) {
    partes.push(
      `El desglose fino no se muestra: «vio parte» son ${parcial} y «lo completó» ${completo}, y ` +
        'con grupos así de chicos los dos porcentajes se mueven más que lo que separan.',
    );
  }

  return partes.length === 0 ? null : partes.join(' ');
}
