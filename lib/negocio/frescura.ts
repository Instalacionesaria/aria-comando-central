// ¿Hace cuánto que el barrido automático no pasa por acá?
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL HUECO QUE ESTO CIERRA, Y ES EL MÁS INCÓMODO DE TODOS
//
// Existe un cron. Y **nada de la aplicación puede notar que dejó de correr.**
//
// Medido sobre el código que ya estaba: los dos lugares que leen el pulso de la ingesta
// —`porQueNoHayMensajes` en `ficha.ts` y `faltaDelBarrido` en `agenda.ts`— tienen tres ramas cada
// uno, y **ninguna de las seis compara la última corrida contra ahora**. Un pulso de hace seis
// semanas se lee exactamente igual que uno de hace un minuto: «terminó una vuelta completa, el cero
// es medido, no hay nada que aclarar».
//
// O sea que el modo de fallar del cron es el silencio, y el sistema estaba construido para no verlo.
//
// ── Y NO ES UN RIESGO TEÓRICO ───────────────────────────────────────────────
//
// Medido el 2026-08-26, después de desplegar: Vercel registró el cron apuntando a la URL **generada**
// del despliegue, y esa URL está detrás del muro de SSO —responde 302— mientras el dominio de
// producción responde 403, o sea que ahí la ruta sí corre. La documentación de Vercel no dice que los
// cron salteen la protección de despliegue. Así que hoy hay una posibilidad real de que el cron no
// esté corriendo, y **la única evidencia es una consulta a mano contra la base**.
//
// Esto convierte esa consulta en algo que la pantalla dice sola.
//
// ── LOS TRES ESTADOS, Y POR QUÉ NO SON DOS ──────────────────────────────────
//
//   · `nunca`     · no hay sello. El cron no pasó NUNCA por esta empresa.
//   · `atrasada`  · hay sello y es más viejo que el umbral del horario.
//   · al día      · `null`, y la pantalla no dice nada.
//
// Colapsar los dos primeros sería el error de siempre: «no corrió nunca» manda a mirar la
// configuración del despliegue, y «corrió hace tres días» manda a mirar por qué se cortó. Son dos
// investigaciones distintas.
//
// ── DÓNDE VA, Y DÓNDE NO ────────────────────────────────────────────────────
//
// Va como un campo HERMANO en la respuesta, **nunca dentro de `falta`**. El contrato de `Indicador`
// es que `falta` existe solo cuando `valor` es nulo, y un atraso convive con datos presentes: hay
// mensajes, hay citas, y además el barrido está viejo. Meterlo en `falta` rompería ese contrato de la
// forma más silenciosa posible — y encima `porQueNoHayMensajes` solo se evalúa cuando la lista viene
// vacía, así que el atraso se vería únicamente en las fichas sin mensajes.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { HORARIOS, type Tarea } from './barrido.ts';

/** Qué tan fresco está el barrido de una tarea. `null` en `estado` = al día. */
export interface Frescura {
  /** `nunca` | `atrasada` | `al_dia`. Los dos primeros se dicen; el tercero se calla. */
  estado: 'nunca' | 'atrasada' | 'al_dia';
  /** Hace cuántos minutos corrió. `null` cuando nunca corrió. */
  minutos: number | null;
  /** A partir de cuántos minutos se considera atrasada. Viaja para que la pantalla no lo invente. */
  umbralMinutos: number;
  /** El texto, ya armado. `null` cuando está al día — y entonces la pantalla no dibuja nada. */
  aviso: string | null;
}

/**
 * El umbral de una tarea, sacado del mapa de horarios.
 *
 * Es el **máximo** de los umbrales de los horarios que incluyen esa tarea, y el máximo y no el mínimo
 * a propósito: con dos horarios que la corren —uno cada diez minutos y otro cada hora— basta que el
 * más lento haya pasado para que no haya nada que avisar. Tomar el mínimo haría que el aviso apareciera
 * en la mitad de los casos normales, y un aviso que aparece siempre es un aviso que se ignora.
 *
 * Si ningún horario la corre, no hay umbral: la tarea no está programada, y decir que está «atrasada»
 * sería culpar al reloj de una decisión de configuración.
 */
function umbralDe(tarea: Tarea): number | null {
  const umbrales = Object.values(HORARIOS)
    .filter((h) => (h.tareas as readonly Tarea[]).includes(tarea))
    .map((h) => h.umbralMinutos);
  return umbrales.length === 0 ? null : Math.max(...umbrales);
}

/** Cómo se llama cada tarea para una persona. El nombre interno no va a una pantalla. */
const NOMBRE: Record<Tarea, string> = {
  mensajes: 'la lectura de mensajes',
  citas: 'la lectura del calendario',
  sonda: 'la sonda de aislamiento',
  /* `Record<Tarea, string>` y no un mapa parcial: agregar la tarea `contactos` al cron dejó este
     objeto en rojo, que es exactamente lo que tenía que pasar. Con un `Partial` o un `?? tarea`, el
     aviso habría dicho «… y contactos tendría que correr cada …», con la palabra interna adentro de
     una frase para una persona. */
  contactos: 'la lectura de las etiquetas de los contactos',
  // Y la quinta dejó este objeto en rojo otra vez, que es la prueba de que el `Record` total sirve.
  auditoria: 'la auditoría de los agentes de IA',
  mejora: 'la revisión en frío del carril amarillo',
};

/**
 * Hace cuánto que el barrido automático no pasa por esta empresa. **Corre dentro de `conOrganizacion(`.**
 *
 * El instante sale de la base, en la misma transacción que el sello: `now()` de PostgreSQL es el
 * instante en que empezó la transacción, así que las dos lecturas ven el mismo reloj. Con `Date.now()`
 * serían dos, y este archivo existe justamente para medir una diferencia de tiempos.
 */
export async function frescuraDe(tarea: Tarea): Promise<Frescura> {
  const umbral = umbralDe(tarea);

  const fila = await datos()
    .selectFrom('tareas_programadas')
    .select([
      'ultimo_estado',
      // La diferencia la calcula la BASE, no la aplicación: es la única forma de que el «ahora» sea
      // el mismo reloj que escribió el sello.
      sql<number>`greatest(0, floor(extract(epoch from (now() - ultima_corrida_el)) / 60))`.as('minutos'),
    ])
    .where('tarea', '=', tarea)
    .executeTakeFirst();

  // Sin tarea programada no hay nada que medir. Ver `umbralDe`.
  if (umbral === null) {
    return { estado: 'al_dia', minutos: null, umbralMinutos: 0, aviso: null };
  }

  if (!fila) {
    return {
      estado: 'nunca',
      minutos: null,
      umbralMinutos: umbral,
      aviso:
        `El barrido automático nunca corrió en esta empresa, así que ${NOMBRE[tarea]} solo pasa ` +
        'mientras alguien tiene esta pantalla abierta. Hay que revisar la tarea programada.',
    };
  }

  const minutos = Number(fila.minutos);
  if (minutos <= umbral) {
    return { estado: 'al_dia', minutos, umbralMinutos: umbral, aviso: null };
  }

  return {
    estado: 'atrasada',
    minutos,
    umbralMinutos: umbral,
    aviso:
      `El último barrido automático es de hace ${enPalabras(minutos)}, y ${NOMBRE[tarea]} tendría ` +
      `que correr cada ${enPalabras(umbral - 60)} como mucho. Puede haber cosas sin traer.`,
  };
}

/**
 * «3 horas», «2 días». Con la unidad más grande que dé un número entendible.
 *
 * `1440 minutos` es cierto y no se puede leer de un vistazo, y este texto aparece arriba de una
 * pantalla que alguien está usando para trabajar.
 */
function enPalabras(minutos: number): string {
  if (minutos < 60) return `${Math.max(1, Math.round(minutos))} minutos`;
  const horas = Math.round(minutos / 60);
  if (horas < 48) return horas === 1 ? '1 hora' : `${horas} horas`;
  return `${Math.round(horas / 24)} días`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EL AVISO DEL CRM: CUATRO ESTADOS, Y EL CUARTO ES EL QUE JUSTIFICA ESTO
// ═══════════════════════════════════════════════════════════════════════════════

/** Cómo viene el aviso del CRM. Es un campo HERMANO de los datos, nunca dentro de `falta`. */
export interface FrescuraDelAviso {
  /**
   * · `nunca`              — no llegó ni uno. El workflow no está configurado, o la cabecera está mal.
   * · `llega_sin_procesar` — **el cuarto estado, y el único motivo por el que esto existe.** Cubre
   *                          el caso total (nada se interpreta) y el PARCIAL (uno de los siete
   *                          eventos falla y los demás no), y gana sobre los dos de abajo.
   * · `atrasada`           — se procesaron avisos y el último es viejo.
   * · `al_dia`             — nada que decir.
   */
  estado: 'nunca' | 'llega_sin_procesar' | 'atrasada' | 'al_dia';
  /** Hace cuántos minutos se procesó el último. `null` = nunca se procesó ninguno. */
  minutos: number | null;
  /** Cuántos llegaron y NO se pudieron interpretar en la última hora. */
  sinProcesar: number;
  /** El texto, ya armado. `null` cuando está al día. */
  aviso: string | null;
}

/**
 * Cuántos minutos sin un aviso procesado antes de decir que está atrasado.
 *
 * ── NO SALE DE `HORARIOS`, Y HAY QUE DECIR POR QUÉ ──────────────────────────
 *
 * `umbralDe(tarea)` devuelve `null` para una tarea que no está en el mapa, y entonces `frescuraDe`
 * responde `al_dia` con `aviso: null` — o sea **silencio, sin error**. Un webhook no está en ese mapa
 * y nunca va a estarlo: no tiene cadencia, se dispara cuando una persona escribe.
 *
 * Así que es una decisión de producto con su número al lado. Dos horas: en una cuenta con actividad
 * normal pasan varios avisos por hora, y dos horas sin ninguno procesado es raro. De noche no hay
 * actividad y tampoco hay nadie mirando la pantalla.
 */
const UMBRAL_DEL_AVISO_MINUTOS = 120;

/**
 * Cómo viene el aviso del CRM. **Corre dentro de `conOrganizacion(`.**
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LEE `procesado_el`, NO `recibido_el`, Y ESA ES TODA LA DIFERENCIA
 *
 * Leer `recibido_el` responde «¿llegó un POST?». Y el modo de fallo insignia de este subsistema es
 * justamente uno donde el POST llega perfecto:
 *
 *   alguien pega la URL sin el `?evento=`, o con `mensaje_entrante` en vez de `mensaje.entrante`
 *     → GoHighLevel entrega
 *     → nosotros guardamos y respondemos 200
 *     → `recibido_el` fresquísimo
 *     → `al_dia`, la pantalla no dibuja nada
 *     → y el 100 % del aviso está INERTE, mientras cada mensaje sigue entrando por el sondeo con
 *       hasta diez minutos de retraso.
 *
 * Con `procesado_el`, ese caso cae en `llega_sin_procesar` y el texto manda a mirar el parámetro de
 * la URL — que es donde está el problema. «No llega nada» y «llega y se descarta» son dos
 * investigaciones distintas, y sin el cuarto estado comparten el silencio.
 *
 * Las dos comparaciones las hace la BASE, con `now()`: es la única forma de que el «ahora» sea el
 * mismo reloj que escribió las filas.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export async function frescuraDelAviso(): Promise<FrescuraDelAviso> {
  const fila = await datos()
    .selectFrom('avisos_del_crm')
    .select([
      /* ── EL `case` NO ES ADORNO: `greatest(0, NULL)` DEVUELVE 0 ──────────────
       *
       * `greatest` en PostgreSQL **ignora los nulos**, así que sin el `case` una tabla donde nada se
       * procesó nunca devuelve `minutos = 0` — o sea «se procesó hace cero minutos». Y con eso el
       * estado sale `al_dia`, la pantalla no dibuja nada, y el modo de fallo insignia de este
       * subsistema queda escondido por el propio monitor que existe para mostrarlo.
       *
       * Lo encontró la prueba 7b de `pruebas/base/34-aviso-del-crm.test.ts`. Es la misma clase de
       * defecto que este proyecto persigue en las pantallas —un cero no medido que se muestra como un
       * cero medido— y acá apareció en una función de agregación de SQL. */
      sql<number | null>`case
        when max(procesado_el) is null then null
        else greatest(0, floor(extract(epoch from (now() - max(procesado_el))) / 60))
      end`.as('minutos'),
      sql<string>`count(*) filter (
        where (procesado_el is null or error is not null)
          and recibido_el > now() - interval '1 hour'
      )`.as('sin_procesar'),
      sql<string>`count(*)`.as('total'),
    ])
    .executeTakeFirst();

  const total = Number(fila?.total ?? 0);
  const sinProcesar = Number(fila?.sin_procesar ?? 0);
  const minutos = fila?.minutos === null || fila?.minutos === undefined ? null : Number(fila.minutos);

  // NUNCA llegó ninguno. Manda a la configuración del workflow, que es lo único que puede estar mal.
  if (total === 0) {
    return {
      estado: 'nunca',
      minutos: null,
      sinProcesar: 0,
      aviso:
        'GoHighLevel no avisó ni una vez todavía, así que los mensajes entran solo por el ciclo de ' +
        'diez minutos. Hay que pegar la URL y la cabecera en los workflows — están en Ajustes → ' +
        'Credenciales.',
    };
  }

  /* ── LLEGA Y NO SE PROCESA. GANA SOBRE `atrasada` **Y SOBRE `al_dia`** ─────
   *
   * Que gane sobre `atrasada` estaba desde el principio: si hay avisos frescos sin interpretar, el
   * problema es el evento, y decir «está atrasado» mandaría a mirar si GoHighLevel está entregando —
   * que sí lo está.
   *
   * Que gane sobre `al_dia` se agregó después, y lo encontró la prueba `7g`. Falta el caso PARCIAL, y
   * es el más probable de todos: son siete workflows, y basta uno con el `?evento=` mal escrito. Los
   * otros seis interpretan bien, así que `max(procesado_el)` es reciente — y con eso el estado salía
   * `al_dia`, la pantalla no dibujaba nada, y el séptimo evento quedaba muerto para siempre.
   *
   * O sea: el conteo se medía y después se tiraba. Un dato medido que nadie lee es peor que no
   * medirlo, porque parece cubierto. */
  if (sinProcesar > 0) {
    return {
      estado: 'llega_sin_procesar',
      minutos,
      sinProcesar,
      /* Los dos textos NO se colapsan, porque mandan a lugares distintos. Con todo fallando hay que
         revisar la URL entera; con parte fallando hay que buscar CUÁL de los siete workflows es —y
         para eso sirve saber que los demás funcionan. */
      aviso:
        minutos === null
          ? `Llegaron ${sinProcesar} aviso(s) en la última hora y NO se pudo interpretar ninguno. ` +
            'GoHighLevel está avisando bien; lo que está mal es el `?evento=` del final de la URL. ' +
            'Revisá que sea exactamente uno de los que muestra Ajustes → Credenciales.'
          : `${sinProcesar} aviso(s) de la última hora no se pudieron interpretar, y otros sí. ` +
            'Suele ser UN workflow con el `?evento=` mal escrito: los demás funcionan, así que ese ' +
            'evento es el único que no está entrando en el momento. Las siete URLs están en ' +
            'Ajustes → Credenciales.',
    };
  }

  // Llegaron, ninguno se procesó nunca, y ya no hay ninguno reciente con error — o sea que el
  // problema es viejo y nadie lo miró. Mismo diagnóstico, visto más tarde.
  if (minutos === null) {
    return {
      estado: 'llega_sin_procesar',
      minutos: null,
      sinProcesar,
      aviso:
        'Llegaron avisos de GoHighLevel pero nunca se pudo interpretar ninguno. Lo que está mal es ' +
        'el `?evento=` del final de la URL, no la entrega.',
    };
  }

  if (minutos > UMBRAL_DEL_AVISO_MINUTOS) {
    return {
      estado: 'atrasada',
      minutos,
      sinProcesar,
      aviso:
        `El último aviso interpretado es de hace ${enPalabras(minutos)}. Los mensajes están ` +
        'entrando por el ciclo de diez minutos, no en el momento.',
    };
  }

  return { estado: 'al_dia', minutos, sinProcesar, aviso: null };
}
