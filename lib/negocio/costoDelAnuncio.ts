// Lo que costó cada anuncio en una ventana, cruzado con los leads que trajo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA DEL § 18.5, QUE ES LA QUE GOBIERNA TODO ESTE ARCHIVO
//
//   «Acquisition puede informar sobre Meta aunque la atribución posterior esté incompleta, pero no
//    debe presentar como definitivas conclusiones sobre citas, ventas o revenue cuando la
//    trazabilidad sea insuficiente.»
//
// Son dos mitades y las dos importan. El gasto, el CPM y el CTR salen sólo de Meta y se pueden
// publicar enteros. «Este anuncio trae más citas» **no**, y por un motivo medido el 2026-09-16 que
// es peor que el porcentaje que se suele citar:
//
//     medium `facebook` / `instagram`   213 contactos   213 con adId  (100 %)
//     medium `External Form`             98 contactos     0 con adId
//     medium `calendar`                  47 contactos     0 con adId
//
// **La cobertura del 36 % no es una muestra al azar.** El `adId` llega si y sólo si el lead entró
// por Facebook o Instagram; los anuncios cuyos leads entran por formulario o por el calendario son
// invisibles a nivel de anuncio, ENTEROS. Así que ordenar anuncios por leads no compara anuncios:
// compara puertas de entrada.
//
// Por eso `cobertura` viaja en la respuesta y no es opcional. El § 18.14 pide publicarla al lado de
// la conclusión, no en una nota al pie.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { DIAS_DE_LA_TASA, PISO_DE_UNA_TASA } from './indicadoresDeCitas.ts';
import { COBERTURA_SUFICIENTE } from './calidadDeLaAtribucion.ts';

/*
 * ═════════════════════════════════════════════════════════════════════════════
 * VENTANAS · ACÁ UN «DÍA» ES UN DÍA DE CALENDARIO, Y EN EL RESTO DEL SISTEMA SON 24 HORAS
 *
 * `lib/negocio/periodo.ts` define sus ventanas como múltiplos de 24 horas —su propio matiz lo dice:
 * *«Hoy: las últimas 24 horas, no el día del calendario»*— y el resto de los módulos recortan con
 * `now() - make_interval(days => N)`.
 *
 * **Este módulo no puede.** El gasto vive en `metricas_de_anuncio.fecha`, que es un `date`: el
 * proveedor entrega días de calendario de la zona de la cuenta publicitaria y no instantes (ver la
 * migración `050`). No hay forma de recortar un `date` por una ventana móvil de horas.
 *
 * Y mezclar las dos formas es peor que elegir una. Medido el 2026-09-18 con `dias = 30`:
 *
 *     gasto  `fecha >= current_date - 30`        →  31 fechas (del 19 de agosto al 18 de septiembre)
 *     leads  `alta_en_el_crm >= now() - 30 d`    →  30×24 h (desde el 19 a las 15:57)
 *
 * O sea que el CPL dividía **treinta y un días de gasto entre treinta de leads**, y el mismo dato
 * daba un número distinto según la hora a la que se mirara la pantalla. Nada fallaba.
 *
 * Así que las tres consultas de este archivo usan LA MISMA ventana, anclada al día:
 *
 *     los últimos `dias` días de calendario, terminando hoy
 *
 * El gasto con `fecha > current_date - dias` —con `>` estricto, o serían `dias + 1` fechas— y los
 * leads desde la medianoche del primero de esos días. Con `dias = 1` los dos dan el día de hoy.
 *
 * La consecuencia que hay que respetar: **el botón «Hoy» de esta pantalla significa el día de
 * calendario, no las últimas 24 horas.** Es distinto de Conversation, y es la única lectura posible
 * cuando el numerador sólo existe por días.
 * ═════════════════════════════════════════════════════════════════════════════
 */

/** Mil impresiones. El CPM se llama así por esto y el número no puede vivir suelto en la fórmula. */
const MIL_IMPRESIONES = 1000;

/** Una fila: un anuncio en toda la ventana. */
export interface FilaDeCosto {
  anuncioId: string;
  /** El nombre que le puso quien lo armó. Sin la dimensión, un anuncio es dieciocho dígitos. */
  nombre: string;
  campanaId: string | null;

  /**
   * Las tres que SÍ se pueden sumar a lo largo de los días.
   *
   * `null` = el anuncio **no entregó ni un día de la ventana**, que es distinto de entregar y
   * gastar cero. Ver `metricas_de_anuncio`: el proveedor omite las claves cuando no hubo entrega, y
   * medido en el relleno inicial eso pasa en la GRAN MAYORÍA de los pares (anuncio, día).
   */
  gasto: number | null;
  impresiones: number | null;
  clics: number | null;

  /**
   * ── Y LAS DOS QUE NO SE PUEDEN SUMAR, Y POR ESO NO ESTÁN ────────────────
   *
   * `alcance` son PERSONAS ÚNICAS y `frecuencia` es un promedio sobre ellas. Sumar siete días de
   * alcance cuenta siete veces a quien vio el anuncio los siete días, así que la suma no es el
   * alcance de la semana: es un número más grande que no significa nada, y que encima se parece a
   * uno que sí — nadie puede mirar «alcance 63.416» y darse cuenta de que está inflado.
   *
   * Las dos están guardadas por día en `negocio.metricas_de_anuncio` y se pueden publicar POR DÍA.
   * Lo que no existe es su agregado, y el § 18.4 tampoco lo pide.
   */

  /** Derivadas, y las tres se calculan sobre sumas válidas. `null` sin denominador. */
  cpm: number | null;
  cpc: number | null;
  ctr: number | null;

  /** Cuántos días de la ventana entregó. Es el denominador honesto de cualquier promedio diario. */
  diasConEntrega: number;

  /** Contactos NUESTROS con este `adId` en la ventana, y cuántos de ellos agendaron. */
  leads: number;
  agendaron: number;

  /**
   * Gasto por lead. **Se publica con un solo lead**, a diferencia de las tasas.
   *
   * No es una inconsistencia con `PISO_DE_UNA_TASA` y conviene decir por qué: el piso existe para
   * las PROPORCIONES, que sobre un denominador chico se mueven diez puntos por fila. El CPL no es
   * una proporción — «gastamos 200 y entró uno» es un hecho exacto sobre lo que ya pasó. Lo que sí
   * es malo es leerlo como predicción, y eso lo resuelve `leads` viajando al lado: una pantalla que
   * muestre «CPL $200 · 1 lead» dice sola lo que hay que saber.
   */
  cpl: number | null;

  /**
   * De los que trajo, qué proporción agendó. **`null` bajo el piso**, y acá sí es una proporción.
   */
  tasaDeAgenda: number | null;
}

export interface CostoDeLosAnuncios {
  dias: number;
  /**
   * El primer y el ÚLTIMO día con métricas guardadas. `null` los dos si no hay ninguna.
   *
   * ── LOS DOS, Y `hasta` SE AGREGÓ PORQUE `desde` SOLO NO ALCANZABA ────────
   *
   * `desde` impide la lectura de «treinta días» sobre una tabla que tiene cinco. Pero al correr
   * esto contra producción durante el relleno inicial apareció la otra mitad del mismo defecto: la
   * tabla arrancaba en el día 1 de la ventana y **terminaba en el 13**, y la pantalla decía
   * «treinta días» sobre datos que se cortaban a mitad de camino.
   *
   * Es peor que la primera, porque el gasto de los últimos días es el que alguien está mirando: un
   * anuncio con 109 leads mostraba 14,14 de gasto —su único día cargado— al lado de otro con cero
   * leads y 744, que sí tenía los suyos. La tabla ordenada por gasto quedaba al revés.
   */
  desde: string | null;
  hasta: string | null;
  filas: FilaDeCosto[];
  /** La suma de las filas. Existe para que se pueda comprobar contra la cuenta publicitaria. */
  gastoTotal: number | null;
  /**
   * Qué proporción de los contactos de la ventana trae `adId`. **Viaja siempre**, con sus dos
   * términos: una proporción sola se lee como precisión y el par dice de cuántos habla.
   */
  cobertura: { con: number; sobre: number };
  aviso: string | null;
}

/**
 * El costo por anuncio en la ventana.
 *
 * ── DOS CONSULTAS Y NO UNA, Y NO ES PEREZA ─────────────────────────────────
 *
 * El gasto vive en `metricas_de_anuncio` por (anuncio, día) y los leads en `contactos` por contacto.
 * Unirlas en una sola consulta multiplicaría las filas: cada contacto aparecería una vez por día con
 * métricas, y la suma del gasto quedaría multiplicada por la cantidad de leads. Es el defecto clásico
 * de unir dos hechos de distinto grano, y no falla: devuelve un número más grande.
 */
export async function costoDelAnuncio(dias = DIAS_DE_LA_TASA): Promise<CostoDeLosAnuncios> {
  const [gastos, leads, cobertura] = await Promise.all([
    gastoPorAnuncio(dias),
    leadsPorAnuncio(dias),
    coberturaDeAdId(dias),
  ]);

  const porId = new Map(leads.map((l) => [l.anuncioId, l]));
  const filas: FilaDeCosto[] = gastos.map((g) => {
    const mio = porId.get(g.anuncioId);
    const conteo = mio?.leads ?? 0;
    const agendaron = mio?.agendaron ?? 0;

    return {
      ...g,
      leads: conteo,
      agendaron,
      cpl: g.gasto !== null && conteo > 0 ? redondear(g.gasto / conteo, 2) : null,
      tasaDeAgenda: conteo >= PISO_DE_UNA_TASA ? redondear((agendaron / conteo) * 100, 1) : null,
    };
  });

  // Los anuncios que trajeron leads y NO tienen gasto guardado se agregan igual. Omitirlos daría
  // una tabla donde la suma de leads no llega al total, y el lector no tendría cómo notarlo.
  for (const l of leads) {
    if (filas.some((f) => f.anuncioId === l.anuncioId)) continue;
    filas.push({
      anuncioId: l.anuncioId,
      nombre: l.nombre ?? l.anuncioId,
      campanaId: null,
      gasto: null,
      impresiones: null,
      clics: null,
      cpm: null,
      cpc: null,
      ctr: null,
      diasConEntrega: 0,
      leads: l.leads,
      agendaron: l.agendaron,
      cpl: null,
      tasaDeAgenda: l.leads >= PISO_DE_UNA_TASA ? redondear((l.agendaron / l.leads) * 100, 1) : null,
    });
  }

  filas.sort((a, b) => (b.gasto ?? -1) - (a.gasto ?? -1));

  const conGasto = filas.filter((f) => f.gasto !== null);
  const gastoTotal = conGasto.length === 0 ? null : redondear(conGasto.reduce((s, f) => s + (f.gasto ?? 0), 0), 2);

  const { primero, ultimo } = await ventanaGuardada(dias);

  return {
    dias,
    desde: primero,
    hasta: ultimo,
    filas,
    gastoTotal,
    cobertura,
    aviso: avisoDe(filas, cobertura, gastoTotal, ultimo, dias),
  };
}

function redondear(v: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
}

/** Lo que Meta cobró, sumado por anuncio. Sale sólo de `metricas_de_anuncio`. */
async function gastoPorAnuncio(dias: number): Promise<Omit<FilaDeCosto, 'leads' | 'agendaron' | 'cpl' | 'tasaDeAgenda'>[]> {
  const filas = await datos()
    .selectFrom('metricas_de_anuncio as m')
    .innerJoin('anuncios as a', (j) =>
      // Por las DOS columnas. Una unión de negocio sin `org_id` de los dos lados permitiría que una
      // métrica se nombre con el anuncio de otro inquilino — y la política de fila no lo desmiente,
      // porque las dos filas son visibles para sus dueños respectivos.
      j.onRef('a.org_id', '=', 'm.org_id').onRef('a.meta_anuncio_id', '=', 'm.meta_anuncio_id'),
    )
    .select([
      'm.meta_anuncio_id as anuncioId',
      'a.nombre as nombre',
      'a.meta_campana_id as campanaId',
      /* `sum` ignora los nulos, que es exactamente lo que hace falta: un día sin entrega no suma
         cero, no participa. Y devuelve NULL cuando TODOS los días son nulos, que es la distinción
         que este módulo existe para conservar. */
      sql<string | null>`sum(m.gasto)`.as('gasto'),
      sql<string | null>`sum(m.impresiones)`.as('impresiones'),
      sql<string | null>`sum(m.clics)`.as('clics'),
      sql<number>`count(*) filter (where m.gasto is not null)`.as('diasConEntrega'),
    ])
    /* `>` y no `>=`: con `>=` la ventana abarca `dias + 1` fechas. Medido el 2026-09-18 con
       `dias = 30`: `current_date - 30` es la medianoche del 19 de agosto, y `fecha >= esa` incluye
       el 19 entero, o sea **31 fechas**. Ver `VENTANAS` arriba. */
    .where(sql<boolean>`m.fecha > (current_date - make_interval(days => ${dias}))`)
    .groupBy(['m.meta_anuncio_id', 'a.nombre', 'a.meta_campana_id'])
    .execute();

  return filas.map((f) => {
    const gasto = numero(f.gasto);
    const impresiones = numero(f.impresiones);
    const clics = numero(f.clics);
    return {
      anuncioId: f.anuncioId,
      nombre: f.nombre,
      campanaId: f.campanaId,
      gasto: gasto === null ? null : redondear(gasto, 2),
      impresiones,
      clics,
      /* Las tres derivadas se recalculan y NO se promedian las que el proveedor mandó por día.
         Promediar un CPM diario le da el mismo peso a un día de mil impresiones y a uno de cien
         mil, y el resultado no es el CPM de la ventana: es el promedio de siete números. */
      cpm: gasto !== null && impresiones ? redondear((gasto / impresiones) * MIL_IMPRESIONES, 2) : null,
      cpc: gasto !== null && clics ? redondear(gasto / clics, 4) : null,
      ctr: impresiones && clics !== null ? redondear((clics / impresiones) * 100, 3) : null,
      diasConEntrega: Number(f.diasConEntrega ?? 0),
    };
  });
}

/** Los contactos NUESTROS atribuidos a cada anuncio, y cuántos agendaron. */
async function leadsPorAnuncio(
  dias: number,
): Promise<{ anuncioId: string; nombre: string | null; leads: number; agendaron: number }[]> {
  const filas = await datos()
    .selectFrom('contactos')
    .leftJoin('anuncios as a', (j) =>
      j
        .onRef('a.org_id', '=', 'contactos.org_id')
        .on(sql<boolean>`a.meta_anuncio_id = contactos.atribucion_primera ->> 'adId'`),
    )
    .select([
      sql<string>`contactos.atribucion_primera ->> 'adId'`.as('anuncioId'),
      'a.nombre as nombre',
      sql<number>`count(*)`.as('leads'),
      /* El mismo `exists` y el mismo filtro de cita alcanzable que `atribucionDelLead` y que el
         booking rate. Tiene que ser el mismo o las filas de este corte no sumarían la cifra grande
         de al lado, y nadie tendría cómo darse cuenta de cuál de las dos está mal. */
      sql<number>`count(*) filter (where exists (
        select 1 from negocio.citas ci
         where ci.org_id = contactos.org_id and ci.contacto_id = contactos.id
           and ci.ghl_calendario_id is not null))`.as('agendaron'),
    ])
    .where(sql<boolean>`contactos.atribucion_primera ? 'adId'`)
    // La MISMA ventana que el gasto, anclada al día. Ver `VENTANAS` arriba.
    .where(sql<boolean>`contactos.alta_en_el_crm >= (current_date - make_interval(days => ${dias} - 1))`)
    .groupBy([sql`1`, 'a.nombre'])
    .execute();

  return filas.map((f) => ({
    anuncioId: f.anuncioId,
    nombre: f.nombre,
    leads: Number(f.leads ?? 0),
    agendaron: Number(f.agendaron ?? 0),
  }));
}

/** Cuántos contactos de la ventana traen `adId`, sobre cuántos hay. Los dos términos, siempre. */
async function coberturaDeAdId(dias: number): Promise<{ con: number; sobre: number }> {
  const f = await datos()
    .selectFrom('contactos')
    .select([
      sql<number>`count(*)`.as('sobre'),
      sql<number>`count(*) filter (where atribucion_primera ? 'adId')`.as('con'),
    ])
    // La MISMA ventana que el gasto, anclada al día. Ver `VENTANAS` arriba.
    .where(sql<boolean>`alta_en_el_crm >= (current_date - make_interval(days => ${dias} - 1))`)
    .executeTakeFirst();

  return { con: Number(f?.con ?? 0), sobre: Number(f?.sobre ?? 0) };
}

/**
 * Los dos extremos de lo que hay guardado.
 *
 * Es lo que impide las dos lecturas peores de esta pantalla: una ventana de 30 días sobre una tabla
 * que tiene 5 no muestra «poco gasto», muestra **el gasto de cinco días con la etiqueta de treinta**;
 * y una tabla que llega hasta el día 13 de 30 pone arriba a los anuncios que gastaron temprano.
 */
async function ventanaGuardada(dias: number): Promise<{ primero: string | null; ultimo: string | null }> {
  /* ── RECORTA POR LA VENTANA PEDIDA, Y ESO FALTABA ───────────────────────
   *
   * No llevaba `where`, así que `desde` y `hasta` describían **la tabla entera** mientras las
   * cifras de al lado describían el período elegido. Con treinta días guardados y el botón de
   * «7 días» encendido, el encabezado decía *«Del 18 ago al 18 sep»* sobre un gasto de una semana:
   * el lector divide de cabeza por el período equivocado y no hay nada que lo desmienta.
   *
   * Es exactamente la lectura que estas dos fechas existen para impedir, con el signo cambiado. */
  const f = await datos()
    .selectFrom('metricas_de_anuncio')
    .select((eb) => [eb.fn.min('fecha').as('primero'), eb.fn.max('fecha').as('ultimo')])
    .where(sql<boolean>`fecha > (current_date - make_interval(days => ${dias}))`)
    .executeTakeFirst();

  return { primero: comoDia(f?.primero), ultimo: comoDia(f?.ultimo) };
}

/** `date` llega como `Date` o como texto según el controlador. Las dos formas dan el mismo día. */
function comoDia(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

/** `numeric` y `bigint` llegan como texto desde `pg`. Nulo se conserva; no se convierte en cero. */
function numero(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * El aviso. **`null` ⟹ la pantalla no dibuja nada**, que es la regla del silencio de este proyecto.
 *
 * Se elige UNO y el orden es por cuánto invalida lo que se está mirando, no por gravedad abstracta.
 */
function avisoDe(
  filas: readonly FilaDeCosto[],
  cobertura: { con: number; sobre: number },
  gastoTotal: number | null,
  ultimo: string | null,
  dias: number,
): string | null {
  if (filas.length === 0) {
    return gastoTotal === null
      ? 'Todavía no hay costo de anuncios guardado. La primera lectura corre con el barrido diario.'
      : null;
  }

  /* 1 · La ventana incompleta va PRIMERA, antes que la cobertura, y el orden es deliberado: una
     cobertura del 52 % describe mal una tabla que igual se puede leer, y una ventana cortada a
     mitad de camino hace que la tabla esté ORDENADA AL REVÉS. Lo que invalida más, primero.

     El umbral es dos días y no cero: el colector pide hoy y los tres anteriores en la pasada
     diaria, así que un día de retraso es el funcionamiento normal y avisarlo sería avisar siempre. */
  if (ultimo !== null) {
    /* ── SE CUENTAN DÍAS DE CALENDARIO, NO MILISEGUNDOS ────────────────────
     *
     * Antes era `Math.round((Date.now() - medianoche(ultimo)) / 86.400.000)`, y eso mezcla un
     * instante con una fecha: el mismo dato daba 2 por la mañana y 3 por la tarde, así que el aviso
     * aparecía o no según la hora a la que alguien mirara la pantalla. Un aviso que depende del
     * reloj y no del dato es peor que ninguno.
     *
     * Las dos puntas son días de calendario (`ultimo` sale de un `date`), así que la resta se hace
     * entre medianoches y da un entero exacto. */
    const hoy = new Date().toISOString().slice(0, 10);
    const faltan = Math.round(
      (Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${ultimo}T00:00:00Z`)) / 86_400_000,
    );
    if (faltan > 2) {
      return (
        `El costo llega hasta el ${ultimo} y la ventana pide ${dias} días, así que a los últimos ` +
        `${faltan} días les falta el gasto. La tabla ordenada por gasto pone arriba a los anuncios ` +
        'que gastaron temprano, no a los que más gastaron.'
      );
    }
  }

  /* 2 · La cobertura, porque invalida la columna de leads entera y no se ve.

     ── CON UMBRAL, Y SIN ÉL DEJABA MUERTO AL TERCER AVISO ────────────────

     La condición era `con < sobre` a secas: UN contacto sin `adId` sobre quinientos ya publicaba
     «1 de 500 no traen anuncio». Y como la cobertura perfecta no existe —ningún lead que entra por
     formulario trae anuncio, y eso es estructural— el aviso se encendía SIEMPRE y el tercero, el
     de los anuncios que gastaron sin traer a nadie, era inalcanzable.

     `COBERTURA_SUFICIENTE` es el mismo umbral que usa el monitor de atribución para lo mismo, así
     que las dos pantallas declaran «incompleta» con el mismo criterio en vez de con dos. */
  if (
    cobertura.sobre >= PISO_DE_UNA_TASA &&
    cobertura.con / cobertura.sobre < COBERTURA_SUFICIENTE
  ) {
    const sin = cobertura.sobre - cobertura.con;
    return (
      `${sin} de ${cobertura.sobre} contactos de esta ventana no traen anuncio, así que las columnas ` +
      'de leads y agenda hablan solo del resto. Medido: el anuncio llega cuando el lead entra por ' +
      'Facebook o Instagram, y NO cuando entra por formulario o por el calendario — así que lo que ' +
      'falta no está repartido al azar entre los anuncios.'
    );
  }

  // 2 · Anuncios que gastaron y no trajeron a nadie. No es un error: puede ser atribución perdida.
  const mudos = filas.filter((f) => f.gasto !== null && f.gasto > 0 && f.leads === 0).length;
  if (mudos > 0) {
    return `${mudos} ${mudos === 1 ? 'anuncio gastó' : 'anuncios gastaron'} sin que ningún contacto los mencione. Puede ser que no trajeran a nadie, o que la atribución se haya perdido en el camino.`;
  }

  return null;
}
