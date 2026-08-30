// Cuánto costó una corrida de Apify. La única cosa que este proyecto le pregunta a Apify.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ EL COSTO NO PODÍA CALCULARSE, Y POR QUÉ AHORA SÍ
//
// De cada scraping guardamos el `apify_actor_run_id` —lo escribe el backend de Python al lanzar el
// actor— y nada más. Eso ata un trabajo nuestro a un cargo de la factura de Apify, pero el monto
// vive allá. La alternativa que se descartó era **estimar**: una tarifa por lead multiplicada por
// los leads scrapeados. Anda, y produce un número que se ve medido y no lo es — en un tablero que
// existe para decidir si un cliente deja plata, eso es peor que no tener la columna.
//
// ── LA CREDENCIAL ES NUESTRA Y ES GLOBAL, NO POR EMPRESA ───────────────────
//
// `APIFY_API_TOKEN`, una variable de entorno del servidor. Es la MISMA cuenta de Apify que usa el
// backend de scraping (ahí la variable se llama igual), y tiene que serlo: el costo que se
// consulta es el de las corridas que ese backend lanzó.
//
// No va en `organizaciones_credenciales` como el token del CRM o la llave de IA, y la diferencia
// es de quién paga: aquéllas son de cada empresa —el `05` § 2 prohíbe que una organización opere
// con la credencial de otra— y ésta es **nuestra**. Apify nos cobra a nosotros; el cliente no
// tiene cuenta de Apify.
//
// ── SIN TOKEN NO SE INVENTA NADA ───────────────────────────────────────────
//
// Devuelve `sin_token`, y la pantalla dice «sin medir». No cero: cero es un costo medido, y una
// columna de ceros en un tablero de rentabilidad es una afirmación falsa que nadie puede detectar
// mirando.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedirExterno } from '../http/cliente.ts';

/** Lo que se pudo averiguar de una corrida. Cuatro resultados, y ninguno es «cero». */
export type CostoDeUnaCorrida =
  | { tipo: 'medido'; usd: number }
  /** Apify contestó y no reportó costo: una corrida borrada, o un identificador que ya no existe. */
  | { tipo: 'sin_dato' }
  /** No hay `APIFY_API_TOKEN` en el entorno. No es un fallo de la corrida: es de la configuración. */
  | { tipo: 'sin_token' }
  /** Apify no respondió, o respondió mal. Se reintenta la próxima vez. */
  | { tipo: 'fallo'; porque: string };

/**
 * Cuánto tarda a lo sumo una consulta.
 *
 * Corto a propósito, y por eso `pedirExterno` acepta el parámetro: esto corre DENTRO de la
 * petición que dibuja el panel. Su valor por omisión son cuatro minutos, calibrados para una
 * generación de IA; acá una consulta lenta convertiría un dato accesorio —el costo de una
 * corrida— en una pantalla que no carga. La tabla vale sin los costos; no vale sin la tabla.
 */
const ESPERA_MS = 4_000;

/**
 * El costo de UNA corrida.
 *
 * `usageTotalUsd` es el campo que Apify reporta en `GET /v2/actor-runs/{runId}`, y es el total ya
 * sumado de todo lo que la corrida consumió. Se usa ése y no `usageUsd`, que es el desglose por
 * concepto: sumarlo nosotros sería mantener una copia de la lista de conceptos de Apify.
 *
 * Va por `pedirExterno` y no por `fetch` directo — `ADR-0305`, un solo archivo hace peticiones
 * HTTP. La regla existe porque *"un 401 por el segundo camino no echa a nadie"*, y aunque acá no
 * haya sesión que caducar, la exención tendría que escribirse en una lista que alguien revisa. No
 * hace falta: este caso entra en la regla sin forzar nada.
 */
export async function costoDeLaCorrida(runId: string): Promise<CostoDeUnaCorrida> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return { tipo: 'sin_token' };

  const r = await pedirExterno<{ data?: { usageTotalUsd?: unknown } }>(
    // El token va en la CABECERA y no en la query, aunque Apify acepte las dos formas: un token en
    // la URL termina en los registros de acceso de cualquier proxy del camino.
    `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}`,
    { cabeceras: { authorization: `Bearer ${token}` }, espera: ESPERA_MS },
  );

  if (r.tipo === 'sin_respuesta') return { tipo: 'fallo', porque: r.causa };

  if (r.tipo === 'rechazado') {
    // Un 404 es «esa corrida ya no existe» y es DEFINITIVO: se sella y no se vuelve a preguntar.
    // Un 500 o un 429 son transitorios y se reintentan en la próxima carga. Colapsarlos dejaría
    // una de las dos mal: o se repregunta para siempre por corridas borradas, o se pierde el costo
    // de una corrida real porque Apify tuvo un mal minuto.
    if (r.estado === 404) return { tipo: 'sin_dato' };
    return { tipo: 'fallo', porque: `Apify respondió ${r.estado}` };
  }

  const usd = r.datos?.data?.usageTotalUsd;

  // `typeof number` Y `isFinite`: un `NaN` o un `Infinity` que se colara sumaría a `NaN` el total
  // de la columna entera, y todas las demás empresas quedarían sin número sin que nada falle.
  if (typeof usd !== 'number' || !Number.isFinite(usd)) return { tipo: 'sin_dato' };

  // Un costo negativo no es un estado posible de una factura. Si llegara, es un dato que no
  // entendemos: mejor no tenerlo que sumarlo.
  if (usd < 0) return { tipo: 'sin_dato' };

  return { tipo: 'medido', usd };
}
