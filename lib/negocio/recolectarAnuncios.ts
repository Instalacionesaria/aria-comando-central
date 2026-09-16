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

import { datos, conOrganizacion } from '../datos/contexto.ts';
import { metricasPorAnuncio, type MetricaDeAnuncio } from '../ghl/anuncios.ts';

/**
 * Cuántos días hacia atrás se vuelven a pedir en cada pasada.
 *
 * **No está medido, y hay que decirlo.** Meta corrige cifras hacia atrás y no sabemos cuánto tarda
 * esta cuenta en estabilizarlas; tres días es un punto de partida, no un hallazgo. Lo que sí queda
 * hecho es la forma de medirlo: `metricas_de_anuncio.sincronizado_el` guarda cuándo se leyó cada
 * fila, así que comparar dos lecturas del mismo día dice cuánto se movió y con cuánto retraso.
 *
 * Subirlo es barato —un día más son trece llamadas— y bajarlo no: una corrección que llega al
 * cuarto día quedaría fuera para siempre, sin error y sin síntoma.
 */
export const DIAS_QUE_SE_RELEEN = 3;

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
 * A ese ritmo la pasada diaria —13 campañas por 4 días— son 52 llamadas y **237 segundos**, contra
 * un `maxDuration` de 300 para la función entera del cron. Y el guardia de `barrido.ts` no alcanza:
 * `PRESUPUESTO_MS` se comprueba **antes de empezar cada empresa**, no entre tareas, así que una
 * empresa que entra con 100 segundos gastados sale de esta tarea a los 337 — con la función cortada
 * a la mitad y sin reintento, porque la plataforma no reintenta.
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
   * `true` = se agotó `PRESUPUESTO_MS` y quedaron días sin pedir. **Una cola incompleta tiene que
   * decirlo**, que es la misma regla que `Cierre.atrasado` aplica en la ingesta y en las citas.
   */
  atrasado: boolean;
  /**
   * Los pares (campaña, día) que fallaron DOS veces: en la vuelta normal y en el reintento.
   *
   * Existe porque el relleno inicial dejó uno, y porque **un hueco a mitad de ventana no se rellena
   * nunca**: `diasQueFaltan` camina hacia adelante desde el último día guardado, así que un día que
   * falló cuando los de alrededor salieron bien queda afuera para siempre. El reintento cierra el
   * caso transitorio —que fue el que ocurrió— y esta lista deja anotado el que no.
   */
  huecos: { campana: string; dia: string }[];
  llamadas: number;
}

/** Un día en `YYYY-MM-DD`, en UTC. */
function diaDe(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Los días que hay que pedir esta pasada.
 *
 * ── POR QUÉ EL DÍA ES UTC Y NO LA ZONA DE LA EMPRESA ───────────────────────
 *
 * Porque el día que el proveedor devuelve es el de la cuenta publicitaria, que no conocemos y que
 * la API no expone. Pedir «el 10 de septiembre» devuelve lo que Meta considera el 10 de septiembre,
 * y traducirlo a la zona de la organización sería inventar un huso que el dato no trae. Se pide en
 * UTC, se guarda como `date`, y queda dicho acá para que nadie lo tome por un instante.
 *
 * ── Y POR QUÉ HOY ENTRA, SABIENDO QUE ESTÁ INCOMPLETO ──────────────────────
 *
 * Porque `DIAS_QUE_SE_RELEEN` lo corrige mañana y pasado. Dejarlo afuera daría una pantalla que
 * nunca muestra el día en curso — y la alternativa, mostrarlo sin volver a pedirlo, es la que
 * congelaría una cifra parcial como si fuera final.
 */
export function diasQueFaltan(ultimoGuardado: string | null, ahora: number): string[] {
  const hoy = diaDe(ahora);
  const primeroPosible = diaDe(ahora - (MAXIMO_DE_DIAS_POR_PASADA - 1) * DIA_MS);

  const arranque =
    ultimoGuardado === null
      ? diaDe(ahora - (DIAS_DE_RELLENO - 1) * DIA_MS)
      : diaDe(Date.parse(`${ultimoGuardado}T00:00:00Z`) - DIAS_QUE_SE_RELEEN * DIA_MS);

  // El tope se aplica DESPUÉS de elegir el arranque, no en vez de: así una organización muy
  // atrasada avanza treinta días por pasada en vez de quedarse esperando una ventana que no llega.
  const primero = arranque < primeroPosible ? primeroPosible : arranque;

  const dias: string[] = [];
  for (let t = Date.parse(`${primero}T00:00:00Z`); diaDe(t) <= hoy; t += DIA_MS) {
    dias.push(diaDe(t));
  }
  return dias;
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

/** El último día con métricas guardadas, o `null` si no hay ninguna. */
async function ultimoDiaGuardado(): Promise<string | null> {
  const fila = await datos()
    .selectFrom('metricas_de_anuncio')
    .select((eb) => eb.fn.max('fecha').as('ultima'))
    .executeTakeFirst();

  const v = fila?.ultima as Date | string | null | undefined;
  if (v === null || v === undefined) return null;
  return v instanceof Date ? diaDe(v.getTime()) : String(v).slice(0, 10);
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
          meta_conjunto_id: m.adSetId,
          meta_campana_id: m.campanaId,
          nombre: m.nombre,
          objetivo: m.objetivo,
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
  /** Qué campañas pedir. Sin esto, salen de nuestra atribución. */
  campanas?: readonly string[];
  /** Hasta qué día hay guardado. `undefined` = preguntarle a la base; `null` = no hay nada. */
  ultimoDia?: string | null;
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
  const { campanas, ultimoDia } =
    piezas.campanas !== undefined && piezas.ultimoDia !== undefined
      ? { campanas: piezas.campanas, ultimoDia: piezas.ultimoDia }
      : await conOrganizacion(orgId, async () => ({
          campanas: piezas.campanas ?? (await campanasNuestras()),
          ultimoDia: piezas.ultimoDia !== undefined ? piezas.ultimoDia : await ultimoDiaGuardado(),
        }));

  const dias = diasQueFaltan(ultimoDia, ahora);

  const resumen: ResumenDeAnuncios = {
    dias: dias.length,
    desde: dias[0] ?? null,
    hasta: dias[dias.length - 1] ?? null,
    campanas: campanas.length,
    metricas: 0,
    anuncios: 0,
    fallidas: [],
    atrasado: false,
    huecos: [],
    llamadas: 0,
  };

  if (campanas.length === 0 || dias.length === 0) return { corrio: true, resultado: resumen, llamadas: 0 };

  const arranque = reloj();
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
    if (r.datos.length === 0) return true;

    await escribir(r.datos, dia);
    resumen.metricas += r.datos.length;
    for (const m of r.datos) vistos.add(m.anuncioId);
    return true;
  }

  for (const dia of dias) {
    /* El guardia va entre DÍAS y no entre campañas, y la diferencia importa: cortar a mitad de un
       día dejaría ese día con la mitad de las campañas, y el día siguiente lo daría por hecho —
       porque `diasQueFaltan` mira el último día guardado, no si está completo. Cortando entre días,
       lo que queda sin pedir es un sufijo limpio que la pasada siguiente vuelve a tomar. */
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
  for (const { campana, dia } of paraReintentar) {
    if (reloj() - arranque > PRESUPUESTO_MS) {
      resumen.atrasado = true;
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
