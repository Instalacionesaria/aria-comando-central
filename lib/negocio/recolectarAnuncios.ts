// Traer de GoHighLevel lo que costó cada anuncio cada día, y el total diario de la cuenta, y guardarlos por fecha.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE MÓDULO HACE INNECESARIO
//
// `docs/acquisition/13-EL-CONTRASTE.md` § 5 cierra la carpeta con *«no es un problema de diseño ni
// de esfuerzo: es una credencial que nadie cargó»*, y sobre eso quedaron veintiún KPI bloqueados.
// La credencial no hace falta: GoHighLevel expone el Ad Manager de Meta y el token del CRM lo
// alcanza. El porqué completo, con la sonda que lo midió, está en `db/migraciones/050`.
//
// ── ES RECONCILIACIÓN, NO UNA COLA ─────────────────────────────────────────
//
// Misma propiedad que gobierna `barrido.ts`: el cron de Vercel admite corridas perdidas y corridas
// duplicadas, y no reintenta nunca. Así que nada se acumula y nada se incrementa — cada pasada
// mira qué falta, lo pide, y lo reescribe. Una pasada perdida se arregla sola en la siguiente,
// porque lo que faltaba sigue faltando.
//
// Y eso es lo que permite que el `on conflict` REESCRIBA en vez de ignorar: **Meta corrige datos
// hacia atrás**, así que la fila de anteayer puede cambiar mañana sin que nada falle. Ignorar el
// conflicto congelaría la primera lectura, que suele ser la peor.
//
// ── TODA LA CUENTA, NO LA ATRIBUCIÓN (`076`) ────────────────────────────────
//
// Hasta el 2026-10-07 este colector pedía sólo las campañas que aparecían en nuestra atribución: 13 de 61.
// Una campaña de mensajes, cuyos contactos llegan como `instagram` o `facebook` sin `campaignId`, no podía
// entrar nunca, y la app decía 0 de inversión en 7 días contra 200,19 del Administrador de anuncios. Nadie lo
// vio porque «completo» quería decir «el día tiene filas», y las filas nulas de las campañas pausadas tapaban
// a la única que gastó.
//
// Ahora el universo son las campañas de la cuenta (`negocio.campanas`), y la referencia es el total diario de
// la cuenta (`negocio.gasto_de_la_cuenta`): un día está completo cuando la suma por anuncio cuadra con él
// (`gastoDeLaCuenta.ts`). Lo ya leído se anota por (campaña, día) en `negocio.lecturas_de_gasto`.
//
// Son dos tareas, y este archivo tiene los escritores de las dos:
//
//   · ésta, `anuncios`, una vez por día: el vínculo, las campañas, la serie de la cuenta, y hoy, ayer y
//     anteayer de las campañas que pueden estar gastando;
//   · `anuncios_relleno` (`rellenarAnuncios.ts`), cada hora: los días cerrados que no cuadran, desde el
//     primero guardado, buscando con rangos qué campaña gastó.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos, conOrganizacion } from '../datos/contexto.ts';
import {
  estructuraDeAnuncios,
  integracionDeAnuncios,
  metricasPorAnuncio,
  serieDeLaCuenta,
  type DiaDeLaCuenta,
  type EntidadDeAnuncio,
  type MetricaDeAnuncio,
} from '../ghl/anuncios.ts';
import { diaUtc, paresDelTramoFijo, sumarDias, TOLERANCIA_DEL_CUADRE } from './gastoDeLaCuenta.ts';

/**
 * Cuántos días hacia atrás de hoy pide SIEMPRE la pasada diaria: hoy, ayer y anteayer.
 *
 * Dos y no más porque el día de la cuenta termina, en el peor huso, a las 00:00 UTC de dos días después
 * (`finSeguro`): la lectura de anteayer en esta pasada ya es final, y de ahí para atrás se ocupa el relleno.
 */
export const DIAS_QUE_SE_RELEEN = 2;

/**
 * Cuántos días de la serie de la cuenta se piden la primera vez, cuando la empresa no tiene nada guardado.
 *
 * Treinta porque es la ventana que las pantallas de este sistema ofrecen (`lib/negocio/periodo.ts`),
 * no porque el proveedor tenga ese límite. La serie son dos llamadas por cada cuarenta días.
 */
export const DIAS_DE_RELLENO = 30;

/**
 * Cuántos días de la serie de la cuenta se releen en cada pasada diaria.
 *
 * Para ver las correcciones de Meta: un total que cambia marca `cambio_el`, y el relleno vuelve a pedir lo que
 * esas campañas gastaron. Sesenta días cubren con holgura la ventana de atribución más larga de Meta, que es de
 * 28 días, y son tres llamadas.
 */
export const DIAS_DE_LA_SERIE_QUE_SE_RELEEN = 60;

/**
 * Hasta cuántos días atrás una campaña que gastó sigue siendo candidata de la pasada diaria.
 *
 * Una campaña pausada ayer gastó ayer: tiene que releerse aunque ya no esté ACTIVE. Una semana alcanza para
 * cubrir los tres días que la pasada pide.
 */
export const DIAS_DE_GASTO_RECIENTE = 7;

/**
 * El presupuesto de tiempo de UNA pasada diaria, en milisegundos. **Sale de una medición, no de un criterio.**
 *
 * El relleno inicial contra la subcuenta real, el 2026-09-16: **390 llamadas en 1.775 segundos**, o
 * sea **4,55 s por llamada**. El Ad Manager de GoHighLevel es mucho más lento que el resto de su API.
 *
 * El guardia de `barrido.ts` no alcanza: `PRESUPUESTO_MS` de allá se comprueba **antes de empezar cada
 * empresa**, no entre tareas, así que una empresa que entra con 100 segundos gastados sale de esta tarea a
 * los 220 — y la función entera tiene un `maxDuration` de 300.
 *
 * Con este tope la pasada hace lo que entra, lo dice en `atrasado`, y lo que quedó de anteayer lo toma el
 * relleno de la hora siguiente. Se comprueba antes de CADA llamada: la pasada vieja lo comprobaba entre días,
 * porque un día a medias se daba por completo; ahora lo pendiente se lleva por par y cortar entre dos pares no
 * deja nada mal contado.
 *
 * La cuenta en régimen: el vínculo, una página de campañas y tres de la serie son 5 llamadas, más 3 por cada
 * candidata. Con las 1 a 3 campañas activas de esta cuenta son 8 a 14 llamadas, unos 60 segundos.
 */
export const PRESUPUESTO_MS = 120_000;

/** Qué pasó en una pasada diaria. Los fallos se informan uno por uno, nunca en silencio. */
export interface ResumenDeAnuncios {
  /** Cuántos días pide el tramo fijo, y cuáles fueron el primero y el último. */
  dias: number;
  desde: string | null;
  hasta: string | null;
  /** Cuántas campañas candidatas se pidieron: las ACTIVE más las que gastaron en la última semana. */
  campanas: number;
  /** Filas de anuncio escritas o reescritas. */
  metricas: number;
  /** Anuncios distintos que quedaron nombrados en la dimensión. */
  anuncios: number;
  /**
   * Las campañas que fallaron, con su motivo. **Una campaña que falla no aborta la pasada.**
   *
   * Es un caso real y medido, no una precaución: la atribución tenía un `888888` —un valor de prueba que
   * alguien dejó— y pedirle métricas devolvía **HTTP 500**, no un 404. Ya no se pide —el universo son las
   * campañas de la cuenta—, pero un 500 de una campaña de verdad tampoco puede tumbar la pasada.
   */
  fallidas: { campana: string; porque: string }[];
  /**
   * `true` = se agotó `PRESUPUESTO_MS` **y quedaron pares del tramo fijo sin pedir**. Una cola incompleta
   * tiene que decirlo, que es la misma regla que `Cierre.atrasado` aplica en la ingesta y en las citas.
   *
   * **Sólo eso.** No se enciende porque un reintento no haya entrado en el presupuesto: eso ya se informa,
   * con nombre y fecha, en `huecos`.
   */
  atrasado: boolean;
  /** Los pares (campaña, día) que fallaron DOS veces: en la vuelta normal y en el reintento. */
  huecos: { campana: string; dia: string }[];
  /**
   * El vínculo con Meta, comprobado al principio de la pasada. **Es una compuerta**: sin `connected` no se
   * escribe nada.
   *
   * Sin vínculo el proveedor **devuelve vacío sin fallar**, y con los ceros probados de `076` un vacío guardado
   * como cero sería permanente: el relleno daría por probado que no gastó una campaña que nadie pudo leer.
   */
  vinculo: { estado: string | null; cuentaId: string | null } | null;
  /**
   * Filas que el proveedor mandó y **no se pudieron leer** por falta de `adId`.
   *
   * Cero es lo normal. Un número distinto de cero sobre una pasada que por lo demás anduvo es la firma de que
   * el proveedor cambió el nombre de una clave — el peor fallo de este cliente, porque no lanza.
   */
  ilegibles: number;
  /**
   * Valores del desglose de acciones que llegaron y **no se pudieron leer como número**. Aparte de
   * `ilegibles`: aquél dice que se escribieron menos filas, éste que se escribieron todas con un dato de menos.
   */
  accionesIlegibles: number;
  /**
   * Las campañas de la cuenta (`065`), leídas al PRINCIPIO de la pasada, porque son el universo que se pide.
   *
   *   · `leidas`: cuántas listó la cuenta, y si la lista vino recortada por el tope de páginas;
   *   · `fallo`: el proveedor no las devolvió. **No tumba la pasada**: se piden las de la última lectura buena.
   */
  nombres: { tipo: 'leidas'; campanas: number; corto: boolean } | { tipo: 'fallo'; porque: string } | null;
  /** La serie de la cuenta (`076`): qué días se releyeron, o por qué no. */
  cuenta: { tipo: 'leida'; desde: string; hasta: string } | { tipo: 'fallo'; porque: string } | null;
  llamadas: number;
}

/** Un `Date` que representa una medianoche LOCAL, escrito como su día. */
export function comoDiaLocal(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Lo que una lectura de un día suma, en centavos y de vuelta: un nulo no gastó. */
function gastoDe(metricas: readonly MetricaDeAnuncio[]): number {
  return metricas.reduce((s, m) => s + Math.round((m.gasto ?? 0) * 100), 0) / 100;
}

/**
 * Guarda la lectura de UNA campaña en UN día: primero la dimensión, después el hecho, y al final el par.
 *
 * El orden no es estilo: la clave foránea compuesta de `metricas_de_anuncio` exige que el anuncio
 * exista. Invertirlo daría un `23503` en la primera fila de cada anuncio nuevo.
 *
 * El par (`lecturas_de_gasto`) se escribe aunque no haya venido ningún anuncio: una lectura que anduvo y
 * devolvió vacío es un cero leído, y sin la fila la campaña seguiría pendiente para siempre. Una lectura que
 * FALLÓ no llega acá: un fallo nunca se guarda como un cero.
 */
export async function guardar(campana: string, dia: string, metricas: readonly MetricaDeAnuncio[]): Promise<void> {
  for (const m of metricas) {
    await datos()
      .insertInto('anuncios')
      .values({
        meta_anuncio_id: m.anuncioId,
        meta_conjunto_id: m.adSetId,
        meta_campana_id: m.campanaId,
        nombre: m.nombre,
        objetivo: m.objetivo,
        sincronizado_el: new Date(),
      } as never)
      .onConflict((oc) =>
        // Por las DOS columnas, que es como está declarada la clave primaria. Nombrar sólo
        // `meta_anuncio_id` haría que PostgreSQL no encontrara el índice y fallara con `42P10`.
        oc.columns(['org_id', 'meta_anuncio_id']).doUpdateSet({
          /* ── UN NULO NUEVO NO PISA UN VALOR VIEJO ────────────────────────
           *
           * **Esto estaba mal y se midió: 77 de 79 anuncios tenían `meta_conjunto_id` en NULL en
           * producción**, o sea el 97 % de la columna que la migración `050` presenta como la llave
           * del cruce por conjunto.
           *
           * La causa es la misma asimetría que gobierna las métricas: cuando el anuncio NO entregó
           * ese día, el proveedor omite `adsetId` —pero sí manda `campaignId` y `objective`—. Medido
           * el 2026-09-16, la fila de un anuncio sin entrega es:
           *
           *     {"name":"bofu - agendamiento - yaping - 23/07","adId":"120249254688910467",
           *      "objective":"OUTCOME_LEADS","campaignId":"120249254209020467", …}
           *
           * Como el colector pide varios días y reescribe en cada uno, bastaba UN día sin entrega
           * posterior al bueno para borrar el conjunto. Por eso `meta_campana_id` estaba completo y
           * `meta_conjunto_id` vacío: los dos vienen de la misma fila, y sólo uno se omite.
           *
           * `coalesce(excluded.x, anuncios.x)` conserva lo que ya se sabía. Es el mismo patrón que
           * la `048` dejó escrito para los campos del CRM —clave ausente ⟹ no se escribe— y que acá
           * no se había aplicado a la dimensión. */
          meta_conjunto_id: sql`coalesce(excluded.meta_conjunto_id, anuncios.meta_conjunto_id)`,
          meta_campana_id: sql`coalesce(excluded.meta_campana_id, anuncios.meta_campana_id)`,
          objetivo: sql`coalesce(excluded.objetivo, anuncios.objetivo)`,
          /* El nombre NO se protege con `coalesce`: es `not null` en la tabla, así que nunca puede
             llegar nulo, y si el anuncio se renombra en Meta queremos el nombre nuevo. */
          nombre: m.nombre,
          sincronizado_el: new Date(),
        } as never),
      )
      .execute();
  }

  for (const m of metricas) {
    // ── LOS NULOS SE ESCRIBEN COMO NULOS, Y ÉSA ES TODA LA REGLA ────────────
    //
    // `metricasPorAnuncio` devuelve `null` cuando el proveedor omitió la clave, que es lo que pasa
    // cuando el anuncio no entregó ese día. Un `?? 0` acá destruiría la diferencia entre «no
    // entregó» y «entregó y costó cero» justo en la capa que puede conservarla, y el síntoma sería
    // un CPM que divide por impresiones que nunca existieron.
    /* ── Y EL DESGLOSE SE FOTOGRAFÍA, NO SE CONSERVA ────────────────────────
     *
     * `acciones` se reescribe PLANO, sin el `coalesce` con el que la dimensión protege
     * `meta_conjunto_id`. Contradice a la tabla de al lado y tiene que ser así: la dimensión
     * describe QUÉ ES un anuncio y acumula lo que se va sabiendo; el hecho describe UN DÍA tal
     * como el proveedor lo cuenta hoy.
     *
     * Con `coalesce`, una relectura en la que Meta ya no reporta `videoView` dejaría el valor
     * viejo junto a las impresiones nuevas — y el hook rate saldría con el numerador de una
     * lectura y el denominador de otra. Meta corrige hacia atrás, así que no es hipotético.
     *
     * `null` y no `'{}'`: el proveedor omite `results` cuando el anuncio no entregó, y eso es «no
     * se leyó», no «mandó un desglose vacío». Ver la § 2 de la `053`. */
    const acciones = m.acciones === null ? null : JSON.stringify(m.acciones);

    const valores = {
      meta_anuncio_id: m.anuncioId,
      fecha: dia,
      gasto: m.gasto,
      impresiones: m.impresiones,
      clics: m.clics,
      alcance: m.alcance,
      ctr: m.ctr,
      cpc: m.cpc,
      frecuencia: m.frecuencia,
      acciones,
      sincronizado_el: new Date(),
    };

    await datos()
      .insertInto('metricas_de_anuncio')
      .values(valores as never)
      .onConflict((oc) =>
        // Reescribe, no ignora: ver el encabezado. Meta corrige hacia atrás.
        oc.columns(['org_id', 'meta_anuncio_id', 'fecha']).doUpdateSet({
          gasto: m.gasto,
          impresiones: m.impresiones,
          clics: m.clics,
          alcance: m.alcance,
          ctr: m.ctr,
          cpc: m.cpc,
          frecuencia: m.frecuencia,
          acciones,
          sincronizado_el: new Date(),
        } as never),
      )
      .execute();
  }

  /* El par, reescrito: una lectura del día pisa un cero de rango, y una relectura pisa la anterior. */
  const gasto = gastoDe(metricas);
  await datos()
    .insertInto('lecturas_de_gasto')
    .values({ meta_campana_id: campana, fecha: dia, gasto, por_rango: false, leido_el: new Date() } as never)
    .onConflict((oc) =>
      oc.columns(['org_id', 'meta_campana_id', 'fecha']).doUpdateSet({ gasto, por_rango: false, leido_el: new Date() } as never),
    )
    .execute();
}

/**
 * Guarda el nombre y el estado de cada campaña de la cuenta (`065`). **El único escritor de
 * `negocio.campanas`.**
 *
 * El nombre se protege con `coalesce` y el estado no, y la asimetría es la misma que separa a
 * `anuncios` de `metricas_de_anuncio`: el nombre dice QUÉ ES la campaña y acumula lo que se sabe
 * —una lectura que no trae `name` no borra el que ya teníamos—; el estado dice CÓMO ESTÁ HOY, y
 * conservar uno viejo al lado de un `sincronizado_el` nuevo afirmaría algo que nadie confirmó.
 */
export async function guardarCampanas(lista: readonly EntidadDeAnuncio[]): Promise<void> {
  for (const c of lista) {
    await datos()
      .insertInto('campanas')
      .values({
        meta_campana_id: c.id,
        nombre: c.nombre,
        estado: c.estado,
        sincronizado_el: new Date(),
      } as never)
      .onConflict((oc) =>
        // Las DOS columnas de la clave primaria, como en `anuncios`: con una sola, `42P10`.
        oc.columns(['org_id', 'meta_campana_id']).doUpdateSet({
          nombre: sql`coalesce(excluded.nombre, campanas.nombre)`,
          estado: c.estado,
          sincronizado_el: new Date(),
        } as never),
      )
      .execute();
  }
}

/**
 * Guarda la serie de la cuenta (`076`). **El único escritor de `negocio.gasto_de_la_cuenta`.**
 *
 * Reescribe plano —Meta corrige hacia atrás y la lectura nueva es la buena— y anota `cambio_el` sólo si el total
 * se movió más que la tolerancia del cuadre: un centavo de redondeo no es una corrección. Cuando cambia, el
 * día pierde el redescubrimiento y el residuo: con otro total, lo que no cuadraba puede cuadrar, y lo que se
 * declaró residuo merece otra vuelta.
 */
export async function guardarSerie(dias: readonly DiaDeLaCuenta[]): Promise<void> {
  const cambio = sql<boolean>`abs(round(coalesce(gasto_de_la_cuenta.gasto, 0) * 100) - round(coalesce(excluded.gasto, 0) * 100)) > ${Math.round(TOLERANCIA_DEL_CUADRE * 100)}`;
  for (const d of dias) {
    await datos()
      .insertInto('gasto_de_la_cuenta')
      .values({
        fecha: d.dia,
        gasto: d.gasto,
        impresiones: d.impresiones,
        clics: d.clics,
        leido_el: new Date(),
      } as never)
      .onConflict((oc) =>
        // Las DOS columnas de la clave primaria, como en `anuncios`: con una sola, `42P10`.
        oc.columns(['org_id', 'fecha']).doUpdateSet({
          gasto: sql`excluded.gasto`,
          impresiones: sql`excluded.impresiones`,
          clics: sql`excluded.clics`,
          leido_el: new Date(),
          cambio_el: sql`case when ${cambio} then now() else gasto_de_la_cuenta.cambio_el end`,
          redescubierto_el: sql`case when ${cambio} then null else gasto_de_la_cuenta.redescubierto_el end`,
          residuo_el: sql`case when ${cambio} then null else gasto_de_la_cuenta.residuo_el end`,
        } as never),
      )
      .execute();
  }
}

/**
 * Anota como CEROS PROBADOS los días de una campaña cuyo rango no gastó. **Nunca pisa una lectura del día**: si
 * el par ya se leyó de a un día, esa lectura tiene sus métricas detrás y vale más que un total.
 */
export async function guardarCeros(campana: string, dias: readonly string[]): Promise<void> {
  for (const dia of dias) {
    await datos()
      .insertInto('lecturas_de_gasto')
      .values({ meta_campana_id: campana, fecha: dia, gasto: 0, por_rango: true, leido_el: new Date() } as never)
      .onConflict((oc) => oc.columns(['org_id', 'meta_campana_id', 'fecha']).doNothing())
      .execute();
  }
}

/**
 * La primera vez que un día no cuadra con todas sus campañas leídas: se borran sus CEROS —de rango y del día—
 * para volver a descubrirlos, y se anota cuándo. Un vacío del proveedor pudo ser un silencio y no un cero, y esto
 * le da una sola vuelta más. Lo que gastó no se borra: tiene sus métricas detrás.
 */
export async function redescubrir(dia: string): Promise<void> {
  await datos().deleteFrom('lecturas_de_gasto').where('fecha', '=', dia as never).where('gasto', '=', '0').execute();
  await datos()
    .updateTable('gasto_de_la_cuenta')
    .set({ redescubierto_el: new Date() } as never)
    .where('fecha', '=', dia as never)
    .execute();
}

/** Un día que sigue sin cuadrar después de redescubrirlo: su diferencia es gasto que ninguna campaña listada explica. */
export async function declararResiduo(dia: string): Promise<void> {
  await datos().updateTable('gasto_de_la_cuenta').set({ residuo_el: new Date() } as never).where('fecha', '=', dia as never).execute();
}

/**
 * La primera vez, los pares que el colector viejo ya leyó pasan a `lecturas_de_gasto`, desde sus métricas.
 *
 * La migración no puede hacerlo: con RLS forzada el migrador ve cero filas (`050`). Se hace UNA vez —si la
 * empresa ya tiene alguna lectura, no hace nada—, porque después las métricas no alcanzan para decir qué se leyó:
 * un redescubrimiento borra lecturas en cero que tienen métricas nulas detrás, y volver a sembrarlas lo desharía.
 * La llaman las dos tareas, la que corra primero: sin ella el relleno buscaría con rangos lo que ya se leyó.
 */
export async function sembrarLecturasDeLasMetricas(): Promise<void> {
  /* `org_id` va escrito, y sale de las métricas: esto es SQL crudo, y la capa de datos pone la organización sólo
     en los `insertInto` de Kysely. Sin él, la fila nace sin empresa y la RLS la rechaza. Bajo la RLS las métricas
     que se leen son sólo las de la empresa activa, así que no puede venir otra. */
  await sql`
    insert into negocio.lecturas_de_gasto (org_id, meta_campana_id, fecha, gasto, por_rango, leido_el)
    select m.org_id, a.meta_campana_id, m.fecha, coalesce(sum(m.gasto), 0), false, max(m.sincronizado_el)
      from negocio.metricas_de_anuncio m
      join negocio.anuncios a on a.org_id = m.org_id and a.meta_anuncio_id = m.meta_anuncio_id
     where a.meta_campana_id is not null
       and not exists (select 1 from negocio.lecturas_de_gasto)
     group by m.org_id, a.meta_campana_id, m.fecha
    on conflict do nothing`.execute(datos());
}

/** Lo que la pasada diaria necesita saber de la base antes de pedir nada. */
export interface PlanDelDia {
  /** El primer día con gasto guardado —de la serie o de las métricas—, o `null` si no hay nada. */
  inicio: string | null;
  /** Las campañas que la última lectura de la cuenta dio por ACTIVE. */
  activas: readonly string[];
  /** Las que gastaron en los últimos `DIAS_DE_GASTO_RECIENTE` días, aunque ya estén pausadas. */
  conGastoReciente: readonly string[];
}

/** Arma el plan de la pasada diaria. Corre dentro de `conOrganizacion(`, y siembra las lecturas viejas la primera vez. */
export async function prepararElPlanDelDia(hoy: string): Promise<PlanDelDia> {
  await sembrarLecturasDeLasMetricas();
  const r = await sql<{ inicio: string | null }>`
    select to_char(least((select min(fecha) from negocio.gasto_de_la_cuenta),
                         (select min(fecha) from negocio.metricas_de_anuncio)), 'YYYY-MM-DD') as inicio`.execute(datos());
  const activas = await datos().selectFrom('campanas').select('meta_campana_id').where('estado', '=', 'ACTIVE').execute();
  const recientes = await sql<{ campana: string }>`
    select distinct meta_campana_id as campana from negocio.lecturas_de_gasto
     where fecha >= ${sumarDias(hoy, -DIAS_DE_GASTO_RECIENTE)}::date and gasto > 0`.execute(datos());
  return {
    inicio: r.rows[0]?.inicio ?? null,
    activas: activas.map((a) => a.meta_campana_id),
    conGastoReciente: recientes.rows.map((f) => f.campana),
  };
}

/**
 * Las piezas que la prueba reemplaza. Mismo idioma que `barrerCitas`, que inyecta sus `lectores`.
 *
 * No están acá por comodidad de la prueba: están porque son la frontera del módulo —el reloj, el proveedor,
 * nuestra base de lectura y nuestra base de escritura—, y una prueba que tenga que levantarlas todas para
 * comprobar que un `<` no era un `<=` no se escribe. Cada escritor lleva su contexto de organización ADENTRO:
 * con el envoltorio afuera, reemplazarlo en una prueba seguía abriendo una conexión.
 */
export interface PiezasDelColector {
  /** El reloj. Fijarlo es lo que hace que la suite dé lo mismo en las tres zonas horarias. */
  ahora?: number;
  /**
   * El cronómetro del presupuesto, aparte de `ahora`. Son dos cosas distintas: `ahora` decide QUÉ DÍAS se
   * piden y esto decide CUÁNDO SE CORTA. Una prueba del corte tiene que poder avanzar el segundo sin mover el
   * primero.
   */
  reloj?: () => number;
  /** El paso 0, la compuerta: si Meta sigue vinculado. */
  vinculo?: typeof integracionDeAnuncios;
  /** Las campañas de la cuenta. Sin esto, `estructuraDeAnuncios` en el nivel `CAMPAIGN`. */
  listarCampanas?: (acceso: { token: string; locationId: string }) => ReturnType<typeof estructuraDeAnuncios>;
  escribirCampanas?: (lista: readonly EntidadDeAnuncio[]) => Promise<void>;
  /** La serie de la cuenta, y dónde se escribe. */
  serie?: typeof serieDeLaCuenta;
  escribirSerie?: (dias: readonly DiaDeLaCuenta[]) => Promise<void>;
  /** Las métricas de una campaña en un día, y dónde se escriben (el hecho, la dimensión y el par). */
  pedir?: typeof metricasPorAnuncio;
  escribir?: (campana: string, dia: string, metricas: readonly MetricaDeAnuncio[]) => Promise<void>;
  /** El plan de la pasada diaria. `undefined` = preguntarle a la base. */
  plan?: PlanDelDia;
}

/** El mayor de dos `YYYY-MM-DD`. */
function elMasNuevo(a: string, b: string): string {
  return a > b ? a : b;
}

/**
 * Una pasada diaria completa para una organización.
 *
 * ── NO PASA POR `conElPulso`, POR EL MISMO MOTIVO QUE `contactos` ──────────
 *
 * El candado existe para el reloj del navegador, que dispara cada diez segundos. Esta tarea la dispara sólo el
 * cron, una vez por día.
 *
 * ── UN FALLO DE CAMPAÑA SE CUENTA; UNO DE TODO, SE LANZA ─────────────────
 *
 * Una campaña que devuelve 500 es un dato malo y la pasada tiene que seguir. Que no ande nada —ni el vínculo,
 * ni la serie, ni ningún par— es un token rechazado o el proveedor caído, y eso sí es un fallo de la tarea:
 * devolverlo como éxito dejaría el sello en verde sobre una pasada que no escribió nada.
 */
export async function recolectarAnuncios(
  orgId: string,
  acceso: { token: string; locationId: string },
  piezas: PiezasDelColector = {},
): Promise<{ corrio: true; resultado: ResumenDeAnuncios; llamadas: number }> {
  const ahora = piezas.ahora ?? Date.now();
  const reloj = piezas.reloj ?? Date.now;
  const hoy = diaUtc(ahora);
  const pedir = piezas.pedir ?? metricasPorAnuncio;
  const mirarElVinculo = piezas.vinculo ?? integracionDeAnuncios;
  const listarCampanas =
    piezas.listarCampanas ?? ((a: { token: string; locationId: string }) => estructuraDeAnuncios(a, 'CAMPAIGN'));
  const escribirCampanas =
    piezas.escribirCampanas ?? ((lista: readonly EntidadDeAnuncio[]) => conOrganizacion(orgId, () => guardarCampanas(lista)));
  const pedirSerie = piezas.serie ?? serieDeLaCuenta;
  const escribirSerie = piezas.escribirSerie ?? ((d: readonly DiaDeLaCuenta[]) => conOrganizacion(orgId, () => guardarSerie(d)));
  const escribir =
    piezas.escribir ??
    ((c: string, d: string, m: readonly MetricaDeAnuncio[]) => conOrganizacion(orgId, () => guardar(c, d, m)));

  const resumen: ResumenDeAnuncios = {
    dias: DIAS_QUE_SE_RELEEN + 1,
    desde: sumarDias(hoy, -DIAS_QUE_SE_RELEEN),
    hasta: hoy,
    campanas: 0,
    metricas: 0,
    anuncios: 0,
    fallidas: [],
    atrasado: false,
    huecos: [],
    vinculo: null,
    ilegibles: 0,
    accionesIlegibles: 0,
    nombres: null,
    cuenta: null,
    llamadas: 0,
  };
  const arranque = reloj();

  /* ── 1 · EL VÍNCULO, COMO COMPUERTA ────────────────────────────────────────
     Sin vínculo el proveedor devuelve vacío sin fallar, y un vacío convertido en cero sería permanente. Si no se
     puede ni preguntar, es el token o el proveedor: la tarea falla, y el tipo del fallo va al registro (ADR-0704). */
  const v = await mirarElVinculo(acceso);
  resumen.llamadas += 1;
  if (v.tipo !== 'datos') throw new Error(`no se pudo comprobar el vínculo con Meta: ${v.fallo.tipo}`);
  resumen.vinculo = { estado: v.datos.estado, cuentaId: v.datos.cuentaId };
  if (v.datos.estado !== 'connected') return { corrio: true, resultado: resumen, llamadas: resumen.llamadas };

  /* ── 2 · LAS CAMPAÑAS, AL PRINCIPIO ─────────────────────────────────────────
     Son el universo: una campaña nueva tiene que estar en la tabla antes de armar el plan. Un fallo del proveedor
     no tumba nada —se piden las de la última lectura buena—; un fallo AL ESCRIBIR no se atrapa: es un defecto
     nuestro. */
  const n = await listarCampanas(acceso);
  // Las páginas pedidas, también cuando falló a mitad: `estructuraDeAnuncios` las devuelve en las dos ramas.
  resumen.llamadas += n.paginas ?? 1;
  if (n.tipo === 'datos') {
    if (n.datos.length > 0) await escribirCampanas(n.datos);
    resumen.nombres = { tipo: 'leidas', campanas: n.datos.length, corto: n.corto === true };
  } else {
    resumen.nombres = { tipo: 'fallo', porque: n.fallo.tipo };
  }

  const plan = piezas.plan ?? (await conOrganizacion(orgId, () => prepararElPlanDelDia(hoy)));

  /* ── 3 · LA SERIE DE LA CUENTA ──────────────────────────────────────────────
     Desde el primer día guardado, o los últimos `DIAS_DE_RELLENO` si no hay nada, y como mucho los últimos
     `DIAS_DE_LA_SERIE_QUE_SE_RELEEN`: lo de antes ya se leyó cerrado. */
  const desdeSerie = elMasNuevo(
    plan.inicio ?? sumarDias(hoy, -(DIAS_DE_RELLENO - 1)),
    sumarDias(hoy, -(DIAS_DE_LA_SERIE_QUE_SE_RELEEN - 1)),
  );
  const s = await pedirSerie(acceso, desdeSerie, hoy);
  resumen.llamadas += s.llamadas;
  let algoAnduvo = false;
  if (s.tipo === 'datos') {
    await escribirSerie(s.datos);
    algoAnduvo = true;
    resumen.cuenta = { tipo: 'leida', desde: desdeSerie, hasta: hoy };
  } else {
    resumen.cuenta = { tipo: 'fallo', porque: s.fallo.tipo };
  }

  /* ── 4 · HOY, AYER Y ANTEAYER DE LAS CANDIDATAS ─────────────────────────────
     Las ACTIVE, y las que gastaron en la última semana aunque ya estén pausadas. Lo que otra campaña haya
     gastado en estos días lo descubre el relleno cuando el día se cierra: la cuenta lo dice, porque no cuadra. */
  const candidatas = [...new Set([...plan.activas, ...plan.conGastoReciente])].sort();
  resumen.campanas = candidatas.length;

  const vistos = new Set<string>();
  // Por CAMPAÑA y no por llamada: una campaña que falla los tres días es un solo identificador podrido.
  const conFallo = new Map<string, string>();
  const paraReintentar: { campana: string; dia: string }[] = [];

  /** Pide un par y guarda lo que venga. Devuelve `false` si falló, y entonces no escribe nada. */
  async function pedirYGuardar(campana: string, dia: string): Promise<boolean> {
    const r = await pedir(acceso, campana, dia);
    resumen.llamadas += 1;
    if (r.tipo !== 'datos') {
      conFallo.set(campana, r.fallo.tipo);
      return false;
    }
    algoAnduvo = true;
    resumen.ilegibles += r.ilegibles ?? 0;
    resumen.accionesIlegibles += r.accionesIlegibles ?? 0;
    await escribir(campana, dia, r.datos);
    resumen.metricas += r.datos.length;
    for (const m of r.datos) vistos.add(m.anuncioId);
    return true;
  }

  const pares = paresDelTramoFijo(hoy, candidatas);
  for (let i = 0; i < pares.length; i += 1) {
    // El guardia, antes de CADA llamada. Lo que quede sin pedir de anteayer lo toma el relleno.
    if (reloj() - arranque > PRESUPUESTO_MS) {
      resumen.atrasado = true;
      break;
    }
    const { campana, dia } = pares[i]!;
    if (!(await pedirYGuardar(campana, dia))) paraReintentar.push({ campana, dia });
  }

  /* ── EL REINTENTO, Y POR QUÉ NO ESTÁ EN `leer()` ──────────────────────────
   *
   * El cliente reintenta el 429 con retroceso, porque un 429 dice «volvé a intentar». Un 500 no dice eso, así
   * que reintentarlo dentro de la misma llamada sería insistirle a un servidor que ya contestó. Acá pasaron
   * segundos o minutos, y el proveedor puede haberse recuperado. Medido en el relleno inicial del 2026-09-16:
   * una campaña falló UN día de treinta por un 500 pasajero.
   *
   * Sólo una vuelta más, y sólo sobre lo que falló. Si vuelve a fallar queda en `huecos`, y **no** enciende
   * `atrasado`: eso quiere decir que quedaron pares sin pedir, no que uno falló. Un aviso que aparece siempre
   * es uno que nadie lee. */
  for (const { campana, dia } of paraReintentar) {
    if (reloj() - arranque > PRESUPUESTO_MS) {
      resumen.huecos.push({ campana, dia });
      continue;
    }
    if (!(await pedirYGuardar(campana, dia))) resumen.huecos.push({ campana, dia });
  }

  if (!algoAnduvo) {
    // El detalle va al registro y NO al cuerpo (`ADR-0704`); el bucle del barrido pone el texto genérico.
    throw new Error(`el CRM no devolvió la serie de la cuenta ni ninguna de las ${candidatas.length} campañas`);
  }

  resumen.anuncios = vistos.size;
  /* Una campaña que se recuperó en el reintento no sigue acusada. Se decide DESPUÉS del bucle: adentro, el
     veredicto dependía del orden en que llegaran los reintentos (medido por mutación). Queda acusada la que
     dejó algún hueco. */
  const conHueco = new Set(resumen.huecos.map((h) => h.campana));
  resumen.fallidas = [...conFallo]
    .filter(([campana]) => conHueco.has(campana))
    .map(([campana, porque]) => ({ campana, porque }));
  return { corrio: true, resultado: resumen, llamadas: resumen.llamadas };
}
