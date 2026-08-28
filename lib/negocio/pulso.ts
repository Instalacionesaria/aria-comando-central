// El candado de la ingesta, las marcas de agua y la contabilidad del coste.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ PROBLEMA RESUELVE
//
// El reloj del navegador vive en cada pestaña. Tres pestañas abiertas son tres pedidos por ciclo, y
// sin nada en el medio son tres veces el tráfico contra el proveedor. `lib/reloj.ts` acota lo que
// pasa DENTRO de una pestaña; esto acota lo que pasa entre todas.
//
// ── SON DOS MECANISMOS, NO UNO, Y CUBREN COSAS DISTINTAS ───────────────────
//
// **El candado** (`.forUpdate().skipLocked()`) protege el RECLAMO, que dura milisegundos. Es lo
// contrario de `lib/credenciales/refresco.ts`, que usa `.forUpdate()` **sin** `skipLocked` para que
// la segunda petición espere y aproveche el token ya renovado. Acá esperar sería inútil: la segunda
// no necesita el resultado de la primera, necesita **no correr**. Con `.forUpdate()` a secas se
// formaría una fila de ciclos que corren uno detrás de otro y gastan lo mismo que sin candado, solo
// que más tarde.
//
// **El alquiler** (`ultima_corrida_el` + `ANTIRREBOTE_MS`) es el que hace casi todo el trabajo, y
// conviene decirlo sin adornos: como el reclamo se confirma y suelta antes de trabajar, **el candado
// casi nunca llega a rechazar a nadie** — para cuando el segundo ciclo llega, el primero ya soltó la
// fila y lo que lo frena es el alquiler.
//
// El candado sigue haciendo falta para el caso que el alquiler no puede cubrir: dos ciclos que
// entran EXACTAMENTE a la vez, antes de que ninguno haya estampado nada. Sin él los dos leerían
// `ultima_corrida_el` vieja, los dos pasarían el antirrebote, y los dos correrían.
//
// ── Y POR QUÉ NO SE SOSTIENE LA TRANSACCIÓN MIENTRAS SE HABLA CON EL CRM ────
//
// Sería el candado más simple: abrir la transacción, bloquear, hacer las llamadas, escribir,
// cerrar. Y sería un defecto.
//
// Un ciclo hace hasta trece llamadas, y `pedirExterno` espera hasta cuatro minutos por cada una. Una
// transacción abierta durante ese rato **retiene una conexión del agrupador** y bloquea la limpieza
// de las tablas que tocó. Un proveedor lento no debería poder quedarse con una conexión de la base.
//
// Entonces: se reclama, se suelta, se trabaja, y se anota. Se estampa `ultima_corrida_el` al empezar,
// y durante `ANTIRREBOTE_MS` cualquier otro ciclo se va. Un ciclo que se cae no deja el candado
// tomado —no hay candado que soltar mientras se trabaja—: simplemente el alquiler vence.
//
// Lo que se paga por eso: **un ciclo que dure más que el alquiler puede tener compañía**. Es
// aceptable y no corrompe nada, porque las dos escrituras que importan son idempotentes — el alta de
// mensajes es `on conflict do nothing` sobre el identificador del CRM, y la marca de agua avanza con
// `greatest`, así que **nunca retrocede**. Lo que cuesta son llamadas repetidas, y solo mientras dura
// el relleno inicial.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { conOrganizacion, datos } from '../datos/contexto.ts';
import { CADENCIA } from '../cadencia.ts';

/**
 * Qué se está ingiriendo. Cada clave tiene su propio candado, su propia marca y su propio coste.
 *
 * ── SON DOS Y NO UNA, Y LA RAZÓN ES EL COSTE ───────────────────────────────
 *
 * `mensajes` cuesta 1 llamada en régimen y crece con la ACTIVIDAD: si nadie escribe, no cuesta más.
 * `citas` cuesta 10 —una por calendario, medido— y **no crece con la cantidad de citas**: crece con
 * la cantidad de calendarios.
 *
 * Con una sola clave las dos compartirían el antirrebote, y la que corriera primero bloquearía a la
 * otra: la agenda se barrería a la cadencia del chat —seis veces por minuto— para un dato que
 * cambia cuando alguien agenda.
 */
export type ClaveDePulso = 'mensajes' | 'citas';

/**
 * El antirrebote. **El candado impide corridas simultáneas, no seguidas**: sin esto, dos pestañas
 * desfasadas medio segundo son dos ciclos completos, cada uno tomando y soltando el candado sin
 * pisarse nunca.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ERAN OCHO SEGUNDOS CONTRA UN CICLO DE DIEZ, Y ESO DEJABA PASAR UNA CORRIDA DE MÁS
 *
 * El comentario anterior justificaba el 8 así: *«la ventana deja pasar el ciclo siguiente sin
 * correrlo dos veces, y no se come uno legítimo por un desfase de reloj»*. La primera mitad es
 * cierta para UNA pestaña. Para dos, no:
 *
 *     pestaña A tira a los 0 s   → corre
 *     pestaña B tira a los 9 s   → pasaron 9 > 8, **corre también**
 *     pestaña A tira a los 10 s  → pasó 1 desde B, se frena
 *
 * O sea DOS corridas por ciclo de diez segundos en vez de una. Medido, el techo con varias pestañas
 * subía de 360 a 450 llamadas por hora — el 25 % de más, por una ventana más corta que la cadencia.
 *
 * Con la ventana IGUAL a la cadencia, la de B a los 9 s se frena y solo queda una corrida por ciclo.
 *
 * ── Y POR QUÉ SE IMPORTA EN VEZ DE ESCRIBIR `10_000` ──────────────────────
 *
 * Porque el número **no significa nada por sí solo**: significa «la cadencia del tic». Escrito a
 * mano, ya se había desalineado una vez, en silencio, y el síntoma era un 25 % de gasto extra que no
 * se ve en ninguna pantalla. Mover la perilla de `CADENCIA.operacion` ahora mueve esta ventana.
 *
 * ── EL CASO DE LAS CITAS, QUE COMPARTE LA CONSTANTE ──────────────────────
 *
 * `citas` no la dispara ningún reloj sino un botón, así que dos pulsaciones a menos de diez segundos
 * la segunda no corre. Ya pasaba con ocho, y es el comportamiento correcto: el barrido de la agenda
 * cuesta 1+N llamadas y lo que cambió en diez segundos no lo justifica. La pantalla dice cuándo fue
 * el último barrido, así que no es un botón que «no hace nada» sin explicación.
 * ════════════════════════════════════════════════════════════════════════════
 */
export const ANTIRREBOTE_MS = CADENCIA.operacion;

/** Lo que el ciclo necesita saber al empezar. */
export interface Pulso {
  /**
   * **Toda conversación cuya última actividad es anterior o igual a esto ya fue ingerida.**
   * `null` = todavía no se ingirió nada, así que se empieza por el principio de la cuenta.
   */
  marcaEl: Date | null;
  /** El piso de la cobertura. `null` mientras no haya corrido nunca. */
  marcaDesdeEl: Date | null;
  corridas: number;
}

/** Lo que el ciclo devuelve para que quede anotado. */
export interface Cierre {
  /**
   * Hasta dónde quedó ingerido. **Solo se mueve sobre trabajo terminado.** `null` = no avanzó, y
   * eso es lo correcto cuando el ciclo no completó ninguna conversación.
   */
  marcaEl: Date | null;
  /** Se escribe UNA vez, en el primer ciclo que procese algo. Después no se toca más. */
  marcaDesdeEl?: Date | null;
  /** Cuántas llamadas costó. Es lo que vuelve el presupuesto una medición y no una intención. */
  llamadas: number;
  /** `true` = se agotó un tope y quedó trabajo sin hacer. Una cola incompleta tiene que decirlo. */
  atrasado: boolean;
  /** Qué salió mal, si algo salió mal. `null` limpia el fallo anterior. */
  fallo: string | null;
}

export type ResultadoDelPulso<T> =
  | { corrio: true; resultado: T; llamadas: number }
  | { corrio: false; porque: string };

/**
 * Los dos motivos por los que un ciclo no corre. Los dos son NORMALES, ninguno es un error.
 *
 * En la práctica el que se ve es `reciente`: `ocupado` solo aparece en el instante exacto en que dos
 * ciclos intentan reclamar a la vez. Ver el encabezado.
 */
export const NO_CORRIO = {
  ocupado: 'Ya hay un ciclo de ingesta reclamando el turno para esta empresa.',
  reciente: `Hubo un ciclo hace menos de ${ANTIRREBOTE_MS / 1000} segundos.`,
} as const;

/**
 * Corre `trabajo` como mucho una vez por ciclo y por empresa.
 *
 * Devuelve `corrio: false` cuando no le tocaba — **y eso no es un fallo**: es la respuesta correcta
 * a «otro ya se está encargando». Quien llame no tiene que reintentar ni avisar de nada.
 */
export async function conElPulso<T>(
  orgId: string,
  clave: ClaveDePulso,
  trabajo: (pulso: Pulso) => Promise<{ cierre: Cierre; resultado: T }>,
): Promise<ResultadoDelPulso<T>> {
  // ── PASO 1 · reclamar. Transacción corta, sin nada de red adentro. ────────
  const reclamo = await conOrganizacion(orgId, async () => {
    // Se asegura la fila antes de bloquearla. Sin esto, `skipLocked` devolvería cero filas en dos
    // situaciones distintas —«está tomada» y «no existe»— y no habría forma de distinguirlas: la
    // primera corrida de una empresa nueva se leería como «ocupado» **para siempre**.
    await datos()
      .insertInto('ingesta_pulso')
      .values({ clave } as never)
      .onConflict((oc) => oc.columns(['org_id', 'clave']).doNothing())
      .execute();

    const fila = await datos()
      .selectFrom('ingesta_pulso')
      .select(['marca_el', 'marca_desde_el', 'ultima_corrida_el', 'corridas'])
      .where('clave', '=', clave)
      .forUpdate()
      .skipLocked()
      .executeTakeFirst();

    // Ahora sí es inequívoco: la fila existe, así que cero filas significa que otro la tiene.
    if (!fila) return { tipo: 'ocupado' as const };

    if (
      fila.ultima_corrida_el &&
      Date.now() - fila.ultima_corrida_el.getTime() < ANTIRREBOTE_MS
    ) {
      return { tipo: 'reciente' as const };
    }

    // EL ALQUILER. Se estampa ANTES de trabajar, no después: estampando al final, todos los ciclos
    // que arranquen mientras éste trabaja pasarían el antirrebote y correrían en paralelo.
    await datos()
      .updateTable('ingesta_pulso')
      .set({ ultima_corrida_el: new Date() })
      .where('clave', '=', clave)
      .execute();

    return {
      tipo: 'tomado' as const,
      pulso: {
        marcaEl: fila.marca_el,
        marcaDesdeEl: fila.marca_desde_el,
        corridas: Number(fila.corridas),
      },
    };
  });

  if (reclamo.tipo === 'ocupado') return { corrio: false, porque: NO_CORRIO.ocupado };
  if (reclamo.tipo === 'reciente') return { corrio: false, porque: NO_CORRIO.reciente };

  // ── PASO 2 · trabajar, con la transacción YA CERRADA. ─────────────────────
  let cierre: Cierre;
  let resultado: T;
  try {
    const r = await trabajo(reclamo.pulso);
    cierre = r.cierre;
    resultado = r.resultado;
  } catch (e) {
    // Lo que se rompió se anota igual, y con las llamadas que alcanzó a gastar en cero porque no se
    // pueden saber. **La marca no se toca**: si avanzara sobre un ciclo que falló, el trabajo que
    // quedó en el medio no se volvería a mirar nunca — y nada lo señalaría.
    await anotar(orgId, clave, {
      marcaEl: null,
      llamadas: 0,
      atrasado: true,
      fallo: e instanceof Error ? e.message : 'desconocido',
    });
    throw e;
  }

  // ── PASO 3 · anotar. Otra transacción corta. ──────────────────────────────
  await anotar(orgId, clave, cierre);
  return { corrio: true, resultado, llamadas: cierre.llamadas };
}

/** Escribe el cierre. Aparte, porque el camino del fallo también lo necesita. */
async function anotar(orgId: string, clave: ClaveDePulso, cierre: Cierre): Promise<void> {
  await conOrganizacion(orgId, async () => {
    await datos()
      .updateTable('ingesta_pulso')
      .set({
        // ── `greatest` Y NO UNA ASIGNACIÓN, Y ES LA LÍNEA MÁS IMPORTANTE ────
        //
        // La marca **no puede retroceder nunca**. Retrocediendo, todo lo que quedó por encima se
        // vuelve a ingerir —caro pero inofensivo— y, peor, un ciclo lento que termina después de
        // uno rápido pisaría el avance del rápido y dejaría un hueco.
        //
        // Es lo que vuelve inofensivos los ciclos superpuestos que el alquiler admite.
        // Y la rama del nulo es un SEGUNDO CINTURÓN, no la defensa principal, y conviene decirlo
        // porque parece lo contrario: `greatest` en PostgreSQL **ignora los nulos** —medido:
        // `greatest(timestamptz '2025-06-01', null)` devuelve la fecha—, así que la expresión de
        // abajo ya dejaría la marca quieta sin esta línea. El arnés de mutación lo demostró: sacar
        // la rama no rompió ninguna prueba.
        //
        // Se conserva igual porque el que la lee no tiene por qué saber esa sutileza, y porque el
        // día que alguien cambie `greatest` por otra cosa la garantía se caería en silencio.
        marca_el:
          cierre.marcaEl === null
            ? sql`marca_el`
            : sql`greatest(coalesce(marca_el, to_timestamp(0)), ${cierre.marcaEl}::timestamptz)`,
        // El piso se escribe UNA sola vez. `coalesce` con la columna: si ya tiene valor, gana el
        // que está. Reescribirlo movería la frontera entre «no hay» y «no se leyó».
        marca_desde_el:
          cierre.marcaDesdeEl === undefined || cierre.marcaDesdeEl === null
            ? sql`marca_desde_el`
            : sql`coalesce(marca_desde_el, ${cierre.marcaDesdeEl}::timestamptz)`,
        ultima_corrida_el: new Date(),
        ultima_corrida_llamadas: cierre.llamadas,
        llamadas_acumuladas: sql`llamadas_acumuladas + ${cierre.llamadas}`,
        corridas: sql`corridas + 1`,
        atrasado: cierre.atrasado,
        ultimo_fallo: cierre.fallo,
        ultimo_fallo_el: cierre.fallo === null ? sql`ultimo_fallo_el` : new Date(),
      } as never)
      .where('clave', '=', clave)
      .execute();
  });
}

/** El pulso tal como está, para mostrarlo. No toca nada. */
export async function leerPulso(orgId: string, clave: ClaveDePulso) {
  return conOrganizacion(orgId, async () =>
    datos()
      .selectFrom('ingesta_pulso')
      .selectAll()
      .where('clave', '=', clave)
      .executeTakeFirst(),
  );
}
