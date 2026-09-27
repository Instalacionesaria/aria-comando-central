// Qué es que una PERSONA haya comprado, y cuánto reportó el closer. En un solo lugar.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTABA ESCRITO ADENTRO DE LA CADENA DE SALES, Y AHORA LO NECESITAN DOS PANTALLAS
//
// Hasta Leads Portal, «tiene una venta» vivía como un fragmento local de `cadenaDeCierre.ts`. La
// pestaña nueva cuenta vendidos por tramo con la misma definición, y copiar el fragmento es el
// defecto que `citasAlcanzables.ts` cuenta en su encabezado: nueve copias de un predicado, cada una
// escrita un poco distinta, y dos tarjetas que no cuadran sin que ninguna prueba lo vea.
//
// **Las dos pantallas preguntan lo mismo y cuentan distinto, y está bien.** La cadena exige además
// una cita cerrable y un intento registrado después, porque su trabajo es que el embudo no se
// ensanche. Leads Portal cuenta la venta de la persona sin esas condiciones. El predicado de abajo
// es el que comparten; las condiciones de más son de la cadena.
//
// ── LO QUE NO ES VENTA ──────────────────────────────────────────────────────
//
// Un `acuerdo_sin_pago` no: es plata comprometida y no cobrada, y tiene su propio indicador
// (`dineroDelMes.ts`). Una `venta_chica` tampoco: es la del setter, vive en otra tabla de etapas y
// no se suma con la del closer. Y en todos los casos es venta **reportada por el closer**, no un
// pago verificado: el sistema no tiene ninguna integración de cobros.
// ═══════════════════════════════════════════════════════════════════════════════

import { type RawBuilder, sql } from 'kysely';

/** La salida del catálogo que cuenta como venta (`salidas.ts`). Una sola; ver el encabezado. */
const SALIDA_VENTA = 'venta';

/** Los resultados de venta de la persona. Con alias, por lo mismo que `citasAlcanzables.ts`. */
function ventasDe(alias: string): RawBuilder<boolean> {
  const a = sql.raw(alias);
  return sql<boolean>`r.org_id = ${a}.org_id and r.contacto_id = ${a}.id and r.salida = ${SALIDA_VENTA}`;
}

/**
 * **¿Esta PERSONA tiene alguna venta registrada?**
 *
 * `exists` y no un `join`: dos ventas de la misma persona cuentan una. De cualquier fecha y con o
 * sin cita: `resultados.cita_id` estaba vacío en las 7 filas de la base el 2026-09-21, así que
 * exigir la cita dejaría fuera toda venta que se registre como hoy se registran los resultados.
 *
 * @param alias El nombre con el que la consulta llama a la tabla `contactos`.
 */
export function tieneVenta(alias = 'contactos'): RawBuilder<boolean> {
  return sql<boolean>`exists (select 1 from negocio.resultados r where ${ventasDe(alias)})`;
}

/**
 * **Cuánto reportó el closer por las ventas de esta persona**, o `null` si no hay ningún monto.
 *
 * `sum` ignora los nulos, así que una venta sin monto no se suma como cero: si ninguna lo trae, la
 * suma es `null` y no `0`. Eso es a propósito —un `?? 0` en cualquier punto convierte «nadie cargó
 * el monto» en «vendió por cero»—, y para decir cuántas faltan está `ventasSinMonto`.
 *
 * `numeric(12,2)` en la base: sale como texto del controlador de PostgreSQL, o como número dentro
 * de un `json_build_object`. Quien lo lea lo convierte.
 */
export function montoReportado(alias = 'contactos'): RawBuilder<string | null> {
  return sql<string | null>`(select sum(r.monto) from negocio.resultados r where ${ventasDe(alias)})`;
}

/** Cuántas ventas de esta persona no traen monto. Es lo que el aviso dice que falta sumar. */
export function ventasSinMonto(alias = 'contactos'): RawBuilder<number> {
  return sql<number>`(select count(*) from negocio.resultados r
                       where ${ventasDe(alias)} and r.monto is null)`;
}

/**
 * **¿La EMPRESA tiene alguna venta registrada?** Sin ventana y sin persona.
 *
 * Sin `org_id` en el `where` porque lo pone la base: `resultados` tiene la política de aislamiento
 * (`aplicar_aislamiento` en la `011`) y esto corre dentro de `conOrganizacion(`.
 *
 * Es lo que decide si una tasa de cierre en cero es un hecho o un dato que falta. Medido el
 * 2026-09-27: ninguna en toda la base. Con eso, un «0 %» en una tarjeta afirmaría que el tramo no
 * compra, cuando lo cierto es que nadie registró una venta — el hueco que `huecosDeSales.ts` ya
 * declara.
 */
export function hayVentasRegistradas(): RawBuilder<boolean> {
  return sql<boolean>`exists (select 1 from negocio.resultados r where r.salida = ${SALIDA_VENTA})`;
}
