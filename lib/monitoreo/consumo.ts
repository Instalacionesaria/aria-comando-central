// El consumo de scraping de UNA organización. Lo que el Panel de Monitoreo suma por empresa.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO CUENTA UNA EMPRESA Y NO TODAS
//
// El panel es una tabla de todas las empresas, así que la consulta obvia es un `group by org_id`
// sobre `aria_cc_scraper_trabajos`. **Esa consulta devuelve una sola fila**, y por una razón que
// conviene entender antes de "arreglarla": las tres tablas del scraper tienen RLS forzada con la
// política `org_id = current_setting('app.org_id')`, y el rol `app_inquilino` es el único con
// privilegios sobre ellas. Un `group by` bajo `conOrganizacion(` ve las filas de esa organización
// y nada más.
//
// Hay tres formas de cruzar organizaciones y solo una es aceptable acá:
//
//   1 · **Una función `security definer` en `public`** que agregue por organización y se otorgue a
//       `app_inquilino`. Anda, y deja la barrera **solo en el código de la aplicación**: cualquier
//       camino que llegue a `datos()` podría llamarla. Cambiar la defensa de "la base filtra" a
//       "el manejador se acuerda" por una pantalla de administración es un mal negocio.
//
//   2 · **Un rol de base nuevo, sin RLS.** Es la escotilla que `conIdentidad(` ya es para
//       identidad, y ahí funciona porque ese rol NO PUEDE LEER UNA SOLA FILA DE NEGOCIO —falla
//       fuerte y a la vista—. Un rol que sí puede leer negocio sin filtro no tiene esa propiedad:
//       una consulta a la que se le olvide el `where` devuelve datos de otro cliente sin error.
//
//   3 · **Recorrer las organizaciones de a una**, abriendo el contexto en cada vuelta como una
//       petición normal. Es lo que hace este archivo, y lo que hace `scripts/db.mjs verificar`
//       para lo mismo. `pruebas/apoyo/autorizados.ts` lo nombra como el caso legítimo del 04 § 4:
//       *"necesitan la LISTA de organizaciones, y después trabajar de una en una, abriendo el
//       contexto en cada vuelta"*.
//
// Lo que compra la 3: **el panel no puede leer nada que la sesión de esa empresa no pudiera leer
// por sí misma.** La parte que cruza organizaciones es el bucle, en código, detrás del portero —
// exactamente el mismo reparto de responsabilidades que `lib/administracion/organizaciones.ts`
// documenta para el listado de empresas: *"la barrera está en el portero, una línea antes, y no
// en un `where`"*.
//
// Lo que cuesta: una transacción por empresa. Con diez clientes High Ticket son diez, y la regla
// de tamaño de `EJECUCION` § 1 es explícita — *"si una solución existe para resolver un problema
// de escala, no se implementa"*. El día que sean cientos, la salida no es la opción 1: es
// materializar los contadores en una tabla de negocio que el backend actualice al terminar cada
// trabajo.
// ═══════════════════════════════════════════════════════════════════════════════

import { datos } from '../datos/contexto.ts';
import { FUENTES, type ConsumoDeUnaOrganizacion } from './fuentes.ts';

/**
 * El consumo de la organización cuyo contexto está abierto.
 *
 * **Tiene que llamarse dentro de `conOrganizacion(`.** No lo comprueba acá: `datos()` lanza con
 * un mensaje que dice exactamente eso cuando no hay contexto, y repetir la comprobación sería
 * una segunda respuesta a la misma pregunta.
 */
export async function consumoDeLaOrganizacion(): Promise<ConsumoDeUnaOrganizacion> {
  const db = datos();

  /* ── LAS TRES CONSULTAS VAN EN PARALELO, Y NO CONCURREN ────────────────────
   *
   * `datos()` devuelve la transacción del contexto, y una transacción de `pg` es UNA conexión:
   * las tres sentencias se serializan sobre ella igual. `Promise.all` acá no gana viajes de red
   * —los gana el `pipelining` que `pg` no hace— pero tampoco los pierde, y escribe la intención:
   * son tres lecturas independientes de la misma foto.
   *
   * Lo que sí importa y es gratis: al ir en la MISMA transacción, las tres ven el mismo estado.
   * Con tres transacciones sueltas, un trabajo que termina en el medio dejaría el conteo de
   * trabajos y el de leads describiendo instantes distintos. */
  const [porFuente, leads, monedero] = await Promise.all([
    // Un `group by` que trae las cuentas y el costo de una vez. Contar tres veces —total,
    // completados, costo— duplicaría el recorrido para responder sobre las mismas filas.
    db
      .selectFrom('public.aria_cc_scraper_trabajos')
      .select(({ fn, eb }) => [
        'fuente',
        fn.countAll<string>().as('total'),
        fn
          .count<string>('id')
          .filterWhere(eb('status', '=', 'COMPLETED'))
          .as('completados'),
        // El costo de Apify. `sum` sobre una columna con nulos los IGNORA —no los cuenta como
        // cero— que es exactamente lo que hace falta: un trabajo sin costo medido no baja el
        // promedio ni ensucia el total, simplemente no está.
        fn.sum<string | null>('costo_usd').as('costo'),
        // Y cuántos quedan sin medir, que es lo que convierte ese total en un número honesto:
        // sin esta cuenta, «USD 0.42» se lee como el costo de la empresa cuando puede ser el de
        // una corrida de doce.
        fn
          .count<string>('id')
          .filterWhere('costo_usd', 'is', null)
          .as('sin_costo'),
      ])
      .groupBy('fuente')
      .execute(),

    db
      .selectFrom('public.aria_cc_scraper_leads')
      .select(({ fn }) => fn.countAll<string>().as('n'))
      .executeTakeFirst(),

    db
      .selectFrom('public.aria_cc_scraper_monedero')
      .select([
        'numero_leads_scrapeados',
        'leads_base_gratuitos',
        'leads_adicionales_pagados',
        'leads_disponibles_en_total',
      ])
      // Sin `where`: la política de RLS ya deja como mucho una fila —la clave primaria del
      // monedero es `org_id`—. Un `where org_id = …` acá daría la impresión de que el filtro es
      // ése, y el día que alguien lo quitara para "simplificar" no se notaría que la protección
      // era otra. Es el mismo criterio que `listarOrganizaciones` escribe al revés.
      .executeTakeFirst(),
  ]);

  /* Las cinco claves SIEMPRE, en cero las que no aparecieron. Un objeto con las fuentes que esta
     empresa usó obligaría a cada lector —la tabla, el total por columna, el CSV— a acordarse de
     tratar la ausencia como cero, y el primero que se olvide muestra una celda vacía donde va un
     0. La ausencia se traduce UNA vez, acá. */
  const cuentas: Record<string, number> = Object.fromEntries(FUENTES.map((f) => [f, 0]));
  let scrapeos = 0;
  let completados = 0;
  let costo = 0;
  let sinCosto = 0;
  let huboCosto = false;
  for (const fila of porFuente) {
    const n = Number(fila.total);
    scrapeos += n;
    completados += Number(fila.completados);
    sinCosto += Number(fila.sin_costo);
    // `null` = ninguna fila de este grupo tenía costo. Se distingue de `0` para poder devolver
    // `costo: null` —«no se midió nada»— en vez de `0`, que sería «esta empresa no gastó».
    if (fila.costo !== null && fila.costo !== undefined) {
      costo += Number(fila.costo);
      huboCosto = true;
    }
    // Una fuente que el `check` no contempla no puede existir hoy, pero si el `check` cambiara
    // antes que esta lista, sumarla al total y no a ninguna columna dejaría una tabla cuyas
    // columnas no suman el total — sin ningún error. Se agrega la clave y se ve.
    cuentas[fila.fuente] = (cuentas[fila.fuente] ?? 0) + n;
  }

  return {
    scrapeos,
    completados,
    porFuente: cuentas,
    // `null` cuando ninguna corrida tiene costo medido. Es la misma regla que el saldo y que el
    // precio: la ausencia de un dato no se dibuja como un cero medido.
    costoUsd: huboCosto ? costo : null,
    scrapeosSinCosto: sinCosto,
    leads: Number(leads?.n ?? 0),
    saldo: monedero
      ? {
          historico: Number(monedero.numero_leads_scrapeados),
          gratuitos: Number(monedero.leads_base_gratuitos),
          pagados: Number(monedero.leads_adicionales_pagados),
          disponibles: Number(monedero.leads_disponibles_en_total),
        }
      : null,
  };
}
