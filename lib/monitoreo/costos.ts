// Llenar el costo de los scrapings que todavía no lo tienen.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO CORRE DENTRO DE LA PETICIÓN DEL PANEL, Y NO EN EL CRON
//
// La respuesta corta: porque el cron de este proyecto **es por empresa y con credencial de
// empresa**, y esto no es ninguna de las dos cosas.
//
// `barrerTodo` recorre las organizaciones y, antes de cada tarea, comprueba `acceso.tipo ===
// 'listo'` —el token de GoHighLevel de esa empresa—. Una tarea de costos ahí se saltearía en toda
// empresa sin CRM conectado, que hoy son casi todas, y el sello diría `saltada` con el motivo
// equivocado. Encajarla igual habría significado un caso especial dentro de un bucle cuyo invariante
// es justamente ése.
//
// ── Y POR QUÉ NO UN BOTÓN ──────────────────────────────────────────────────
//
// Era la otra salida: «Actualizar costos», y el usuario decide cuándo pagar la latencia. Se
// descartó porque un paso que hay que acordarse de hacer es un paso que no se hace, y el síntoma
// sería una columna de costos vieja que se lee como actual.
//
// ── LO QUE SÍ HACE FALTA: QUE ESTÉ ACOTADO ─────────────────────────────────
//
// Cada consulta es una llamada HTTP a Apify. Sin tope, la primera carga del panel después de un mes
// de scrapings sería cientos de llamadas dentro de una función serverless. Con tope, cada carga
// avanza un poco y el trabajo se termina solo en unas pocas visitas — y como el resultado se
// GUARDA, la segunda carga ya no consulta nada.
//
// Es autorreparable: no hay estado que se pueda quedar a medias, sólo filas que todavía no tienen
// su número.
// ═══════════════════════════════════════════════════════════════════════════════

import { conOrganizacion, datos } from '../datos/contexto.ts';
import { costoDeLaCorrida } from './apify.ts';

/**
 * Cuántas corridas se consultan por carga del panel.
 *
 * Con `A_LA_VEZ = 4` empresas en paralelo y `ESPERA_MS = 4s` por consulta, el peor caso son
 * ~8 segundos de latencia agregada. Suena mucho y es el caso que **no se repite**: sólo pasa
 * mientras hay costos sin llenar, y cada carga deja menos.
 */
export const POR_CARGA = 8;

/**
 * Los estados en los que un trabajo YA TERMINÓ y su costo es definitivo.
 *
 * `PENDING` y `RUNNING` quedan afuera a propósito: preguntarle a Apify por una corrida que sigue
 * andando devuelve el costo PARCIAL, y guardarlo lo congelaría ahí para siempre — el trabajo
 * seguiría gastando y la columna diría lo que gastó en el primer minuto.
 */
const TERMINADOS = ['COMPLETED', 'FAILED', 'CANCELLED'] as const;

/** Qué pasó al intentar llenar. Lo que la pantalla necesita para explicar una columna vacía. */
export interface ResultadoDelRelleno {
  /** Cuántas corridas se consultaron en esta pasada. */
  consultadas: number;
  /** Cuántas devolvieron un costo. */
  medidas: number;
  /** `true` = no hay `APIFY_API_TOKEN`, así que los costos NO se van a llenar nunca solos. */
  sinToken: boolean;
}

/**
 * Llena hasta `POR_CARGA` costos de UNA organización.
 *
 * **Tiene que llamarse dentro de `conOrganizacion(`.** Las lecturas y las escrituras pasan por la
 * política de RLS de esa empresa, igual que todo lo demás del panel.
 */
async function rellenarUnaOrganizacion(cupo: number): Promise<ResultadoDelRelleno> {
  if (cupo <= 0) return { consultadas: 0, medidas: 0, sinToken: false };

  const pendientes = await datos()
    .selectFrom('public.aria_cc_scraper_trabajos')
    .select(['id', 'apify_actor_run_id'])
    .where('costo_consultado_el', 'is', null)
    .where('apify_actor_run_id', 'is not', null)
    .where('status', 'in', TERMINADOS)
    // Las más nuevas primero: son las que alguien está mirando. Con `asc`, después de un mes sin
    // token el panel llenaría primero los costos de hace un mes y la fila de hoy seguiría vacía.
    .orderBy('created_at', 'desc')
    .limit(cupo)
    .execute();

  let medidas = 0;
  let sinToken = false;

  for (const t of pendientes) {
    const r = await costoDeLaCorrida(t.apify_actor_run_id as string);

    // Sin token no tiene sentido seguir preguntando por las otras: la respuesta va a ser la misma.
    // Y **no se sella nada**: sellar acá marcaría estas corridas como «ya consultadas» y el día que
    // el token aparezca no se volverían a mirar nunca.
    if (r.tipo === 'sin_token') return { consultadas: 0, medidas: 0, sinToken: true };

    // Un fallo tampoco se sella: Apify caído es transitorio y la próxima carga reintenta. Es la
    // diferencia con `sin_dato`, que sí se sella porque es definitivo.
    if (r.tipo === 'fallo') continue;

    await datos()
      .updateTable('public.aria_cc_scraper_trabajos')
      .set({
        costo_usd: r.tipo === 'medido' ? String(r.usd) : null,
        costo_consultado_el: new Date(),
      })
      .where('id', '=', t.id)
      .execute();

    if (r.tipo === 'medido') medidas += 1;
  }

  return { consultadas: pendientes.length, medidas, sinToken };
}

/**
 * Llena costos repartiendo un cupo entre varias organizaciones.
 *
 * El cupo es GLOBAL y no por empresa: con un cupo por empresa, veinte empresas serían veinte veces
 * el tope y la primera carga del panel tardaría minutos.
 *
 * **Nunca lanza.** Es trabajo accesorio dentro de la petición que dibuja el panel: si Apify se
 * cae, la tabla tiene que salir igual, sin costos. Lo que no se hace es disimularlo — el resultado
 * dice si faltó el token, y la pantalla lo muestra.
 */
export async function rellenarCostos(
  orgIds: readonly string[],
): Promise<ResultadoDelRelleno> {
  let restante = POR_CARGA;
  let consultadas = 0;
  let medidas = 0;

  for (const orgId of orgIds) {
    if (restante <= 0) break;
    try {
      const r = await conOrganizacion(orgId, () => rellenarUnaOrganizacion(restante));
      if (r.sinToken) return { consultadas, medidas, sinToken: true };
      consultadas += r.consultadas;
      medidas += r.medidas;
      restante -= r.consultadas;
    } catch {
      // Una empresa que no se puede leer no frena a las demás. El panel ya marca esa fila como
      // `ilegible` por su propia cuenta; acá no hay nada más que decir.
      continue;
    }
  }

  return { consultadas, medidas, sinToken: false };
}
