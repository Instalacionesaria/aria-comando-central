// Cuánto tarda cada scrapeo. **Mide, y no puede romper un scrapeo.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO EXISTE
//
// La pantalla espera un trabajo de scraping **diez minutos** y después lo da por caído
// (`esperarTrabajo` en `PanelResearch.jsx`: 120 intentos de cinco segundos). Kevin, 2026-09-23:
// *«¿es posible que el scraper demore o pase de 10 min?»*.
//
// La respuesta honesta era «no lo sabemos», y no por falta de tabla: `aria_cc_scraper_trabajos`
// existe, tiene `created_at` y `actualizado_el`, y **no sirve para esto**. Esa tabla la escribe el
// backend de scraping —que no es nuestro y lo comparten dos plataformas— y nadie toca
// `actualizado_el` al terminar. Medido sobre los trece trabajos que hay: nueve la tienen EXACTAMENTE
// igual a `created_at` y los otros cuatro difieren en menos de un segundo. Guarda cuándo se insertó
// la fila, no cuándo terminó el trabajo.
//
// Así que se mide desde donde ya pasamos: el proxy `app/api/tools/scrape/route.ts` ve el arranque
// (el `POST` que devuelve el identificador) y ve el final (el `GET` del sondeo que trae el estado).
// Dos ganchos, una fila por trabajo, en una tabla nuestra (migración `020`).
//
// ── LA REGLA QUE MANDA SOBRE TODO LO DEMÁS ──────────────────────────────────
//
// **Medir no puede romper un scrapeo.** Kevin lo pidió con esas palabras: *«eso no malogra la
// funcionalidad actual verdad? porque está funcionando bien por lo menos el espía»*.
//
// Por eso las dos funciones de acá devuelven `void`, **no lanzan nunca**, corren DESPUÉS de tener
// la respuesta del backend, y van en su PROPIA transacción — en PostgreSQL una sentencia que falla
// aborta la transacción entera, y colgarse de una abierta dejaría que un fallo de la medición se
// llevara puesto lo que la ruta ya había hecho. Es la misma lección que el histórico de
// conversaciones, y acá se aplica desde el primer día en vez de después de pagarla.
//
// Si la migración `020` todavía no se corrió, el scraping arranca y termina exactamente igual que
// hoy, y en el registro del servidor queda una línea por intento. Nada más.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { conOrganizacion, datos } from '../datos/contexto.ts';

const TABLA = 'public.aria_cc_scraper_mediciones' as const;

/** Los tres estados con los que un trabajo termina. El resto significa que sigue corriendo. */
export const ESTADOS_TERMINALES: readonly string[] = ['COMPLETED', 'FAILED', 'CANCELLED'];

/** ¿Este estado del backend significa que el trabajo terminó? */
export function yaTermino(estado: unknown): boolean {
  return typeof estado === 'string' && ESTADOS_TERMINALES.includes(estado.trim().toUpperCase());
}

/**
 * Anota que un trabajo arrancó. Se llama cuando el backend devolvió su identificador.
 *
 * `do nothing` al chocar: reintentar un arranque —o que dos pestañas manden el mismo— no puede
 * mover el reloj hacia adelante, porque entonces la duración saldría más corta de lo que fue.
 */
export async function anotarInicio(
  orgId: string,
  trabajoId: string,
  fuente: string | null,
): Promise<void> {
  if (trabajoId.trim() === '') return;
  try {
    await conOrganizacion(orgId, async () => {
      await datos()
        .insertInto(TABLA)
        .values({ org_id: orgId, trabajo_id: trabajoId, fuente })
        .onConflict((oc) => oc.columns(['org_id', 'trabajo_id']).doNothing())
        .execute();
      return null;
    });
  } catch (e) {
    console.error(
      `medicion: no se pudo anotar el arranque · org ${orgId} · trabajo ${trabajoId} · ` +
        `${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Anota que un trabajo terminó, con su estado y su duración.
 *
 * `where terminado_el is null` es lo que lo hace idempotente: el sondeo puede ver el estado final
 * más de una vez —la pantalla pregunta cada cinco segundos y no siempre corta al primer sí— y la
 * primera vez es la que vale. Sin esa condición, cada sondeo de más estiraría la duración.
 *
 * `segundos` se calcula EN LA BASE contra `iniciado_el`. Hacerlo acá obligaría a leer la fila
 * primero, que es un viaje de ida y vuelta para restar dos fechas que la base ya tiene.
 */
export async function anotarFin(orgId: string, trabajoId: string, estado: string): Promise<void> {
  if (trabajoId.trim() === '') return;
  try {
    await conOrganizacion(orgId, async () => {
      await datos()
        .updateTable(TABLA)
        .set({
          terminado_el: sql`now()`,
          estado: estado.trim().toUpperCase(),
          /* `extract(epoch …)` da segundos con decimales; la columna es entera y el sondeo tiene una
             resolución de cinco segundos, así que redondear no pierde nada que existiera. El
             `greatest` cubre un reloj que vaya para atrás entre dos instancias. */
          segundos: sql`greatest(0, round(extract(epoch from (now() - iniciado_el))))::int`,
        })
        .where('org_id', '=', orgId)
        .where('trabajo_id', '=', trabajoId)
        .where('terminado_el', 'is', null)
        .execute();
      return null;
    });
  } catch (e) {
    console.error(
      `medicion: no se pudo anotar el fin · org ${orgId} · trabajo ${trabajoId} · ` +
        `${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
