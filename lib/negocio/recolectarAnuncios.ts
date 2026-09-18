// Traer de GoHighLevel lo que costó cada anuncio cada día, y guardarlo por fecha.
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
// mira qué días faltan, los pide, y los reescribe. Una pasada perdida se arregla sola en la
// siguiente porque el último día guardado no avanzó.
//
// Y eso es lo que permite que el `on conflict` REESCRIBA en vez de ignorar: **Meta corrige datos
// hacia atrás**, así que la fila de anteayer puede cambiar mañana sin que nada falle. Ignorar el
// conflicto congelaría la primera lectura, que suele ser la peor.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos, conOrganizacion } from '../datos/contexto.ts';
import { integracionDeAnuncios, metricasPorAnuncio, type MetricaDeAnuncio } from '../ghl/anuncios.ts';

/**
 * Cuántos días hacia atrás se vuelven a pedir en cada pasada.
 *
 * **Cuántos días conviene releer no está medido, y hay que decirlo.** Meta corrige cifras hacia
 * atrás y no sabemos cuánto tarda esta cuenta en estabilizarlas. Lo que sí queda hecho es la forma
 * de medirlo: `metricas_de_anuncio.sincronizado_el` guarda cuándo se leyó cada fila, así que
 * comparar dos lecturas del mismo día dice cuánto se movió y con cuánto retraso.
 *
 * ── PERO EL VALOR SÍ ESTÁ MEDIDO, Y ES EL QUE ENTRA EN EL PRESUPUESTO ──────
 *
 * Empezó en 3 y **no cabía**. La cuenta, con las cifras de producción del 2026-09-18:
 *
 *     13 campañas × 4,55 s por llamada  =  59 s por día pedido
 *     ventana = hoy + DIAS_QUE_SE_RELEEN
 *
 * Con 3, la ventana son 4 días = 237 s contra un `PRESUPUESTO_MS` de 120 s: el guardia cortaba
 * siempre y `atrasado` quedaba en verdadero **todas las pasadas** — que es un aviso que aparece
 * siempre, o sea uno que nadie lee.
 *
 * Con 2, la ventana son 3 días = 177 s. El guardia se comprueba ANTES de cada día, así que el
 * tercero arranca con 118 s gastados y entra: la pasada completa la ventana y `atrasado` queda en
 * falso, que es lo que lo vuelve una señal.
 *
 * Subirlo exige subir el presupuesto, y el presupuesto está atado al `maxDuration` de 300 s de la
 * función entera del cron. No es una preferencia: es lo que cabe.
 */
export const DIAS_QUE_SE_RELEEN = 2;

/**
 * Cuántos días se piden la primera vez, cuando la tabla está vacía para esta organización.
 *
 * Treinta porque es la ventana que las pantallas de este sistema ofrecen (`lib/negocio/periodo.ts`),
 * no porque el proveedor tenga ese límite. Cuesta 13 × 30 = 390 llamadas **una sola vez**.
 */
export const DIAS_DE_RELLENO = 30;

/**
 * El tope de días de UNA pasada, y por qué existe.
 *
 * Sin él, una organización que estuvo un mes sin corridas pediría trece llamadas por cada día
 * perdido en una sola función de 300 segundos. Con él, la pasada hace lo que entra y la siguiente
 * sigue desde donde quedó — que es la misma reconciliación de siempre, aplicada al calendario.
 */
export const MAXIMO_DE_DIAS_POR_PASADA = 30;

/**
 * El presupuesto de tiempo de UNA pasada, en milisegundos. **Sale de una medición, no de un criterio.**
 *
 * El relleno inicial contra la subcuenta real, el 2026-09-16: **390 llamadas en 1.775 segundos**, o
 * sea **4,55 s por llamada**. El Ad Manager de GoHighLevel es mucho más lento que el resto de su API.
 *
 * A ese ritmo la pasada diaria —13 campañas por 3 días, que es el tramo fijo de `diasQuePedir`—
 * son 39 llamadas y **177 segundos**, contra un `maxDuration` de 300 para la función ENTERA del
 * cron. Y el guardia de `barrido.ts` no alcanza: `PRESUPUESTO_MS` se comprueba **antes de empezar
 * cada empresa**, no entre tareas, así que una empresa que entra con 100 segundos gastados sale de
 * esta tarea a los 277 — y con un día de huecos que rellenar, se pasa de los 300 y la plataforma
 * corta la función sin reintentar.
 *
 * Con este tope la pasada hace lo que entra, lo dice en `atrasado`, y la siguiente sigue desde donde
 * quedó. Es la misma reconciliación de siempre, y es lo que hace que cortar no cueste nada.
 */
export const PRESUPUESTO_MS = 120_000;

/** Qué pasó con una campaña en esta pasada. Los fallos se informan uno por uno, nunca en silencio. */
export interface ResumenDeAnuncios {
  /** Cuántos días se pidieron, y cuáles fueron el primero y el último. */
  dias: number;
  desde: string | null;
  hasta: string | null;
  /** Cuántas campañas se recorrieron. */
  campanas: number;
  /** Filas de anuncio escritas o reescritas. */
  metricas: number;
  /** Anuncios distintos que quedaron nombrados en la dimensión. */
  anuncios: number;
  /**
   * Las campañas que fallaron, con su motivo. **Una campaña que falla no aborta la pasada.**
   *
   * Es un caso real y medido, no una precaución: `atribucion_primera` tiene un `888888` —un valor
   * de prueba que alguien dejó— y pedirle métricas devuelve **HTTP 500**, no un 404. Si un 500
   * tumbara la pasada, ese único contacto bloquearía el costo de las otras doce campañas para
   * siempre, y el síntoma sería «Acquisition no tiene datos» sin nada que mirar.
   */
  fallidas: { campana: string; porque: string }[];
  /**
   * `true` = se agotó `PRESUPUESTO_MS` **y quedaron días de la ventana sin pedir**, o sea que falta
   * gasto. Una cola incompleta tiene que decirlo, que es la misma regla que `Cierre.atrasado`
   * aplica en la ingesta y en las citas.
   *
   * **Sólo eso.** No se enciende porque un reintento no haya entrado en el presupuesto: eso no deja
   * ningún día sin pedir y ya se informa, con nombre y fecha, en `huecos`. La distinción no es
   * cosmética — ver el comentario del bucle de reintentos.
   */
  atrasado: boolean;
  /**
   * Los pares (campaña, día) que fallaron DOS veces: en la vuelta normal y en el reintento.
   *
   * Existe porque el relleno inicial dejó uno. Un par (campaña, día) que falla cuando los de
   * alrededor salen bien **no lo rescata `diasQuePedir`**: ese día SÍ tiene filas —las de las otras
   * doce campañas— así que no cuenta como faltante. El reintento cierra el caso transitorio, que
   * fue el que ocurrió, y esta lista deja anotado el que no.
   */
  huecos: { campana: string; dia: string }[];
  /**
   * El vínculo con Meta, comprobado al principio de la pasada. `null` = no se pudo preguntar.
   *
   * ── POR QUÉ VALE UNA LLAMADA DE LAS 39 ──────────────────────────────────
   *
   * Porque sin vínculo el proveedor **devuelve vacío sin fallar**, y ése es el peor modo posible:
   * la pasada sella `corrio`, escribe cero filas, y la pantalla dibuja un cero que se lee como «no
   * se invirtió nada» en vez de «Meta está desconectado». Son dos hechos opuestos con la misma
   * pinta, que es exactamente lo que este proyecto persigue en todas partes.
   *
   * El cliente ya tenía la función y su comentario la llamaba «el paso 0 de todo lo demás». **No la
   * llamaba nadie.**
   */
  vinculo: { estado: string | null; cuentaId: string | null } | null;
  /**
   * Filas que el proveedor mandó y **no se pudieron leer** por falta de `adId`.
   *
   * Cero es lo normal y lo que se espera. Un número distinto de cero sobre una pasada que por lo
   * demás anduvo es la firma de que el proveedor cambió el nombre de una clave — el peor fallo de
   * este cliente, porque no lanza: la pantalla se queda vacía y el sello dice `corrio`.
   *
   * Ya cambió dos formas bajo nuestros pies (el arreglo de la respuesta, el nombre del cursor), así
   * que esto no es una precaución abstracta.
   */
  ilegibles: number;
  llamadas: number;
}

/** Un día en `YYYY-MM-DD`, en UTC. */
function diaDe(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Los días que hay que pedir esta pasada, **del más nuevo al más viejo**.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * LA VENTANA SALE DE LO QUE FALTA, NO DE UNA MARCA DE AGUA. LAS DOS FORMAS ANTERIORES FALLARON.
 *
 * **Primer intento: días en orden cronológico desde `max(fecha) - N`.** El guardia de
 * `PRESUPUESTO_MS` corta entre días, así que sacrificaba los más NUEVOS y nunca llegaba a hoy.
 * Medido en producción el 2026-09-18: la tarea sellaba `corrio` con 39 llamadas reales y
 * `max(fecha)` llevaba dos días sin moverse. La pasada siguiente pedía lo mismo. Para siempre.
 *
 * **Segundo intento: los mismos días, invertidos.** Arregla eso y rompe lo otro: ahora
 * `max(fecha)` avanza SIEMPRE, así que lo que el presupuesto sacrifica queda perdido por
 * construcción. Con la tabla vacía, el relleno de treinta días escribía tres y los otros
 * veintisiete no volvían a entrar en ninguna ventana; una pasada perdida dejaba un hueco
 * permanente a mitad del calendario de gasto.
 *
 * Los dos defectos son el mismo: **una marca de agua no puede describir un conjunto con agujeros.**
 *
 * ── LO QUE HACE ESTA VERSIÓN ─────────────────────────────────────
 *
 * Se le pasa el conjunto de días que YA tienen filas, y la lista se arma en dos tramos:
 *
 *   1 · **Los que se piden siempre**: hoy y los `DIAS_QUE_SE_RELEEN` anteriores, estén o no
 *       guardados. Meta corrige hacia atrás, así que una lectura vieja no es definitiva.
 *   2 · **Los que faltan**: del resto de la ventana, sólo los que no tienen NI UNA fila.
 *
 * Los dos tramos van del más nuevo al más viejo, y el segundo detrás del primero. Así el
 * presupuesto sacrifica siempre los huecos más viejos — que siguen faltando y vuelven a aparecer
 * en la lista de la pasada siguiente, hasta que se llenen. **Eso es lo que restituye la
 * reconciliación**: nada depende de que una pasada termine.
 *
 * ── POR QUÉ «SIN FILAS» ES UNA SEÑAL SÓLIDA, MEDIDO ──────────────────────
 *
 * Porque el proveedor devuelve una fila por anuncio **aunque no haya entregado** — con las siete
 * métricas ausentes, que es de donde sale la regla de los dos ceros de este módulo. Así que un día
 * recolectado siempre tiene filas, y cero filas significa que nadie lo pidió nunca.
 *
 * Comprobado contra producción el 2026-09-18 sobre los treinta días de la ventana: **cero días sin
 * filas**. Si algún día una campaña dejara de tener anuncios y ninguna otra cubriera esa fecha, ese
 * día se volvería a pedir en cada pasada; el costo está acotado a trece llamadas y la ventana a
 * treinta días, y el `atrasado` lo diría.
 *
 * ── Y POR QUÉ EL DÍA ES UTC Y NO LA ZONA DE LA EMPRESA ──────────────────
 *
 * Porque el día que el proveedor devuelve es el de la cuenta publicitaria, que no conocemos y que
 * la API no expone. Pedir «el 10 de septiembre» devuelve lo que Meta considera el 10 de septiembre,
 * y traducirlo a la zona de la organización sería inventar un huso que el dato no trae.
 *
 * ── Y POR QUÉ HOY ENTRA, SABIENDO QUE ESTÁ INCOMPLETO ──────────────────
 *
 * Porque `DIAS_QUE_SE_RELEEN` lo corrige mañana y pasado. Dejarlo afuera daría una pantalla que
 * nunca muestra el día en curso — y la alternativa, mostrarlo sin volver a pedirlo, es la que
 * congelaría una cifra parcial como si fuera final.
 */
export function diasQuePedir(guardados: ReadonlySet<string>, ahora: number): string[] {
  // La ventana entera, del más nuevo al más viejo.
  const ventana: string[] = [];
  for (let i = 0; i < MAXIMO_DE_DIAS_POR_PASADA; i += 1) ventana.push(diaDe(ahora - i * DIA_MS));

  // Tramo 1: se piden siempre, haya o no filas. `slice` y no un bucle aparte para que el largo
  // salga de la constante y no de una cuenta escrita a mano.
  const siempre = ventana.slice(0, DIAS_QUE_SE_RELEEN + 1);
  // Tramo 2: del resto, sólo lo que no tiene ni una fila.
  const faltan = ventana.slice(DIAS_QUE_SE_RELEEN + 1).filter((d) => !guardados.has(d));

  return [...siempre, ...faltan];
}

/**
 * Las campañas que hay que pedir: **las que aparecen en nuestra atribución, y sólo ésas.**
 *
 * La cuenta tiene 61 campañas y nosotros recibimos contactos de 13. Pedir las 61 costaría cuatro
 * veces más llamadas para guardar el costo de anuncios que ningún contacto nuestro menciona, y ese
 * costo no se puede cruzar con nada: el § 18.5 sólo deja publicar por anuncio lo que tiene su
 * cobertura al lado.
 *
 * El filtro `~ '^[0-9]+$'` saca `{{campaign.id}}`, una plantilla de GoHighLevel que nunca se
 * expandió. **No saca `888888`**, que es numérico y no existe — para eso está la tolerancia al
 * fallo por campaña, porque un filtro por forma no puede distinguir un identificador falso de uno
 * verdadero.
 */
async function campanasNuestras(): Promise<string[]> {
  const filas = await datos()
    .selectFrom('contactos')
    .select((eb) => eb.ref('atribucion_primera', '->>').key('campaignId').as('campana'))
    .distinct()
    .where((eb) => eb.ref('atribucion_primera', '->>').key('campaignId'), 'is not', null)
    .execute();

  return filas
    .map((f) => f.campana as string | null)
    .filter((c): c is string => c !== null && /^[0-9]+$/.test(c))
    .sort();
}

/**
 * Qué días de la ventana YA tienen filas.
 *
 * Reemplaza a un `max(fecha)`, y el motivo está en `diasQuePedir`: una marca de agua no puede
 * describir un conjunto con agujeros, y los agujeros son el caso normal —una pasada perdida, un
 * presupuesto agotado— y no el excepcional.
 *
 * ── EL `date` SE FORMATEA EN UTC A MANO, Y NO CON `toISOString()` ─────────
 *
 * El controlador entrega un `date` de PostgreSQL como un `Date` a **medianoche LOCAL**. Al este de
 * Greenwich, `toISOString()` sobre esa medianoche devuelve el día ANTERIOR — así que en Asia el
 * conjunto quedaría corrido un día y el colector pediría de más para siempre, sin fallar.
 */
async function diasConFilas(): Promise<Set<string>> {
  const filas = await datos()
    .selectFrom('metricas_de_anuncio')
    .select('fecha')
    .distinct()
    .execute();

  const dias = new Set<string>();
  for (const f of filas) {
    const v = f.fecha as Date | string | null | undefined;
    if (v === null || v === undefined) continue;
    dias.add(v instanceof Date ? comoDiaLocal(v) : String(v).slice(0, 10));
  }
  return dias;
}

/** Un `Date` que representa una medianoche LOCAL, escrito como su día. Ver `diasConFilas`. */
function comoDiaLocal(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * Guarda un lote de métricas: primero la dimensión, después el hecho.
 *
 * El orden no es estilo: la clave foránea compuesta de `metricas_de_anuncio` exige que el anuncio
 * exista. Invertirlo daría un `23503` en la primera fila de cada anuncio nuevo.
 */
async function guardar(metricas: readonly MetricaDeAnuncio[], dia: string): Promise<void> {
  if (metricas.length === 0) return;

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
          sincronizado_el: new Date(),
        } as never),
      )
      .execute();
  }
}

/**
 * Una pasada completa para una organización.
 *
 * ── NO PASA POR `conElPulso`, POR EL MISMO MOTIVO QUE `contactos` ──────────
 *
 * El candado existe para el reloj del navegador, que dispara cada diez segundos. Esta tarea la
 * dispara sólo el cron, una vez por día. Meterla en el candado le pondría un antirrebote a algo que
 * no tiene tráfico que acotar.
 *
 * ── UN FALLO DE CAMPAÑA SE CUENTA; UNO DE TODAS, SE LANZA ─────────────────
 *
 * La diferencia importa. Una campaña que devuelve 500 es un identificador podrido y la pasada tiene
 * que seguir. Que fallen TODAS es un token rechazado o el proveedor caído, y eso sí es un fallo de
 * la tarea: devolverlo como éxito dejaría el sello en verde sobre una pasada que no escribió nada.
 */
/**
 * Las piezas que la prueba reemplaza. Mismo idioma que `barrerCitas`, que inyecta sus `lectores`.
 *
 * No están acá por comodidad de la prueba: están porque las cuatro son la frontera del módulo —el
 * reloj, el proveedor, nuestra base de lectura y nuestra base de escritura—, y una prueba que tenga
 * que levantar las cuatro para comprobar que un `<` no era un `<=` no se escribe.
 */
export interface PiezasDelColector {
  /** El reloj. Fijarlo es lo que hace que la suite dé lo mismo en las tres zonas horarias. */
  ahora?: number;
  /**
   * El cronómetro del presupuesto, aparte de `ahora`. Son dos cosas distintas: `ahora` decide QUÉ
   * DÍAS se piden y esto decide CUÁNDO SE CORTA. Una prueba del corte tiene que poder avanzar el
   * segundo sin mover el primero, o la ventana cambiaría a mitad de la pasada.
   */
  reloj?: () => number;
  pedir?: typeof metricasPorAnuncio;
  /**
   * El paso 0: si Meta sigue vinculado. Sin esto, `integracionDeAnuncios` contra el proveedor real.
   *
   * Es inyectable por lo mismo que `pedir`: una prueba de la ventana de días no tiene por qué salir
   * a la red, y una que lo hiciera fallaría distinto según haya conexión.
   */
  vinculo?: typeof integracionDeAnuncios;
  /** Qué campañas pedir. Sin esto, salen de nuestra atribución. */
  campanas?: readonly string[];
  /**
   * Qué días YA tienen filas. `undefined` = preguntarle a la base.
   *
   * Es un conjunto y no un «hasta dónde llegué» porque los agujeros son el caso normal. Ver
   * `diasQuePedir`.
   */
  guardados?: ReadonlySet<string>;
  /**
   * Dónde se escribe, **con su propio contexto de organización adentro**. Sin esto, las dos tablas
   * de la migración 050 dentro de `conOrganizacion`.
   */
  escribir?: (metricas: readonly MetricaDeAnuncio[], dia: string) => Promise<void>;
}

/**
 * Una pasada completa para una organización.
 *
 * ── NO PASA POR `conElPulso`, POR EL MISMO MOTIVO QUE `contactos` ──────────
 *
 * El candado existe para el reloj del navegador, que dispara cada diez segundos. Esta tarea la
 * dispara sólo el cron, una vez por día. Meterla en el candado le pondría un antirrebote a algo que
 * no tiene tráfico que acotar.
 *
 * ── UN FALLO DE CAMPAÑA SE CUENTA; UNO DE TODAS, SE LANZA ─────────────────
 *
 * La diferencia importa. Una campaña que devuelve 500 es un identificador podrido y la pasada tiene
 * que seguir. Que fallen TODAS es un token rechazado o el proveedor caído, y eso sí es un fallo de
 * la tarea: devolverlo como éxito dejaría el sello en verde sobre una pasada que no escribió nada.
 */
export async function recolectarAnuncios(
  orgId: string,
  acceso: { token: string; locationId: string },
  piezas: PiezasDelColector = {},
): Promise<{ corrio: true; resultado: ResumenDeAnuncios; llamadas: number }> {
  const ahora = piezas.ahora ?? Date.now();
  const pedir = piezas.pedir ?? metricasPorAnuncio;
  const mirarElVinculo = piezas.vinculo ?? integracionDeAnuncios;
  const reloj = piezas.reloj ?? Date.now;
  // El envoltorio de organización va ADENTRO del escritor y no en el bucle, y no es acomodo: el
  // escritor es la frontera con la base, así que es él quien tiene que decir en qué contexto
  // escribe. Con el envoltorio afuera, reemplazarlo en una prueba seguía abriendo una conexión —o
  // sea que la pieza inyectable no aislaba de la base, que es lo único para lo que existe.
  const escribir =
    piezas.escribir ??
    ((m: readonly MetricaDeAnuncio[], d: string) => conOrganizacion(orgId, () => guardar(m, d)));

  // Las dos lecturas van en UNA sola entrada a la organización, no en dos: `conOrganizacion` abre
  // contexto y el contexto cuesta, y las dos preguntas se contestan con la misma conexión.
  const { campanas, guardados } =
    piezas.campanas !== undefined && piezas.guardados !== undefined
      ? { campanas: piezas.campanas, guardados: piezas.guardados }
      : await conOrganizacion(orgId, async () => ({
          campanas: piezas.campanas ?? (await campanasNuestras()),
          guardados: piezas.guardados ?? (await diasConFilas()),
        }));

  const dias = diasQuePedir(guardados, ahora);

  const resumen: ResumenDeAnuncios = {
    dias: dias.length,
    // `dias` viene del más nuevo al más viejo, así que el primero es `hasta` y el último `desde`.
    // Tomarlos al derecho —como estaban— daría un resumen con la ventana invertida.
    desde: dias[dias.length - 1] ?? null,
    hasta: dias[0] ?? null,
    campanas: campanas.length,
    metricas: 0,
    anuncios: 0,
    fallidas: [],
    atrasado: false,
    huecos: [],
    vinculo: null,
    ilegibles: 0,
    llamadas: 0,
  };

  if (campanas.length === 0 || dias.length === 0) return { corrio: true, resultado: resumen, llamadas: 0 };

  const arranque = reloj();

  /* El paso 0. Se pregunta UNA vez por pasada y no aborta nada: si el vínculo está roto, las 39
     llamadas siguientes van a devolver vacío igual, y lo que importa es que el resumen lo DIGA en
     vez de dejar un cero indistinguible de «no se gastó». */
  const v = await mirarElVinculo(acceso);
  resumen.llamadas += 1;
  resumen.vinculo = v.tipo === 'datos' ? { estado: v.datos.estado, cuentaId: v.datos.cuentaId } : null;

  const vistos = new Set<string>();
  // Se cuenta por CAMPAÑA y no por llamada: una campaña que falla el mismo día en los cinco días es
  // un solo identificador podrido, y listarlo cinco veces escondería que es uno.
  const conFallo = new Map<string, string>();
  // Y aparte los pares (campaña, día), que son lo que hay que reintentar. Es otra pregunta.
  const paraReintentar: { campana: string; dia: string }[] = [];
  let algunaAnduvo = false;

  /** Pide un par y guarda lo que venga. Devuelve `false` si falló. */
  async function pedirYGuardar(campana: string, dia: string): Promise<boolean> {
    const r = await pedir(acceso, campana, dia);
    resumen.llamadas += 1;

    if (r.tipo !== 'datos') {
      conFallo.set(campana, r.fallo.tipo);
      return false;
    }
    algunaAnduvo = true;
    resumen.ilegibles += r.ilegibles ?? 0;
    if (r.datos.length === 0) return true;

    await escribir(r.datos, dia);
    resumen.metricas += r.datos.length;
    for (const m of r.datos) vistos.add(m.anuncioId);
    return true;
  }

  for (const dia of dias) {
    /* El guardia va entre DÍAS y no entre campañas, y la diferencia importa: cortar a mitad de un
       día dejaría ese día con la mitad de las campañas, y el día siguiente lo daría por hecho —
       porque un día a medias SÍ tiene filas y `diasQuePedir` lo daría por hecho. Cortando entre
       días, lo que queda sin pedir es un sufijo limpio que la pasada siguiente vuelve a tomar
       —porque esos días siguen sin filas y vuelven a aparecer en la lista—. */
    if (reloj() - arranque > PRESUPUESTO_MS) {
      resumen.atrasado = true;
      break;
    }
    for (const campana of campanas) {
      if (!(await pedirYGuardar(campana, dia))) paraReintentar.push({ campana, dia });
    }
  }

  /* ── EL REINTENTO, Y POR QUÉ NO ESTÁ EN `leer()` ──────────────────────────
   *
   * El cliente reintenta el 429 con retroceso, porque un 429 dice «volvé a intentar». Un 500 no dice
   * eso, así que reintentarlo dentro de la misma llamada sería insistirle a un servidor que ya
   * contestó. Acá es distinto: pasaron minutos, el proveedor puede haberse recuperado, y **el costo
   * de no reintentar es permanente**.
   *
   * Medido en el relleno inicial: la campaña `120249590301010467` falló UN día de treinta y quedó con
   * 290 filas de 300. Ese día no vuelve solo, porque la pasada siguiente arranca del último día
   * guardado y ese día ya está «pasado».
   *
   * Sólo una vuelta más, y sólo sobre lo que falló. Si vuelve a fallar, queda anotado en `huecos` en
   * vez de reintentarse para siempre. */
  /* ── Y EL REINTENTO **NO** MARCA `atrasado`, QUE ES OTRA COSA ─────────────
   *
   * Lo marcaba, y eso lo dejaba encendido todos los días. Medido el 2026-09-18 en régimen: la
   * ventana de tres días entra completa en 144 s, y los reintentos arrancan con el presupuesto ya
   * gastado — así que el aviso se encendía por no reintentar `888888`, una campaña de prueba que
   * alguien dejó en la atribución y que devuelve 500 desde siempre.
   *
   * Son dos hechos distintos y colapsarlos inutiliza al más grave: `atrasado` significa **quedó
   * ventana sin pedir**, o sea faltan días de gasto. Que un reintento no entre en el presupuesto no
   * deja ningún día sin pedir; deja un par (campaña, día) sin corregir, y eso ya se dice con su
   * nombre y su fecha en `huecos`.
   *
   * Un aviso que aparece siempre es uno que nadie lee, y éste iba camino a serlo. */
  for (const { campana, dia } of paraReintentar) {
    if (reloj() - arranque > PRESUPUESTO_MS) {
      resumen.huecos.push({ campana, dia });
      continue;
    }
    if (!(await pedirYGuardar(campana, dia))) resumen.huecos.push({ campana, dia });
  }

  if (!algunaAnduvo) {
    // El tipo del fallo va al registro y NO al cuerpo (`ADR-0704`); el bucle del barrido pone el
    // texto genérico. Ver `releerContactos`, que hace exactamente lo mismo.
    throw new Error(`el CRM rechazó las ${campanas.length} campañas`);
  }

  resumen.anuncios = vistos.size;
  resumen.fallidas = [...conFallo].map(([campana, porque]) => ({ campana, porque }));
  return { corrio: true, resultado: resumen, llamadas: resumen.llamadas };
}
