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
