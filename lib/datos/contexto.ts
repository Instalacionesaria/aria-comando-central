// ADR-0201 — Ninguna consulta corre sin organización activa. INNEGOCIABLE.
//
// El contexto por petición y la capa fina.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA NO ES "ACORDATE DE FILTRAR". LA REGLA ES QUE NO SE PUEDA ESCRIBIR UNA
// CONSULTA SIN FILTRO.
//
// El modo de fallar es lo que define el diseño. Si el filtro lo pone quien escribe la
// consulta, alcanza UNA omisión en UNA consulta para que un cliente vea las filas de
// otro — y eso NO lanza una excepción, no rompe una prueba y no aparece en ningún
// registro. La consulta anda, devuelve filas, y el número está mal (04 § 1).
//
// Acá el filtro lo pone la BASE, con las políticas de la migración 008. Esta capa hace
// dos cosas y nada más (EJECUCION § 3): **inyecta la organización en las escrituras y
// LANZA cuando no hay contexto**.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { clienteInquilino, type Trx } from './capa.ts';
import { almacen } from './almacen.ts';

// El almacén y los dos lectores viven en `almacen.ts`, que no importa nada de acá: es
// lo que rompe el ciclo con `capa.ts`, que necesita leer la organización activa para el
// plugin de inyección. Se reexportan para que quien use el contexto tenga un solo
// módulo que importar.
export { organizacionActual, hayOrganizacion } from './almacen.ts';

/** Un uuid, validado antes de que llegue a la base. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El mismo `nullif(btrim(…), '')` que hace la política, del lado de acá.
 *
 * Escrito igual a propósito: si un día el criterio cambia, tiene que cambiar en los dos
 * lados o la comprobación de abajo y el filtro de la base dejan de hablar del mismo
 * valor. Nulo y cadena vacía son los DOS valores de reposo legítimos —nulo cuando la
 * variable nunca se puso en esa conexión, cadena vacía después del primer `set_config`—
 * y los dos colapsan acá a cadena vacía.
 */
function enReposo(v: string | null | undefined): boolean {
  return (v ?? '').trim() === '';
}

/**
 * Abre el contexto de una organización y corre el trabajo dentro.
 *
 * `conOrganizacion(` es la cadena que van a buscar las pruebas que leen el código
 * fuente (EJECUCION § 6). Un sinónimo rompe la prueba sin romper el código.
 *
 * ── La primitiva es la que ENVUELVE Y CIERRA ─────────────────────────────────
 *
 * `AsyncLocalStorage` tiene dos: `enterWith`, que abre y NO cierra, y `run`, que abre,
 * ejecuta y cierra. EJECUCION § 3 eligió la segunda, y el 04 § 3 explica la trampa que
 * eso evita: `enterWith` **no propaga hacia afuera de una función asíncrona**, así que
 * en un bucle sobre organizaciones el contexto de la primera puede seguir vivo cuando
 * empieza la segunda — y en los ganchos de preparación de las pruebas el contexto no
 * queda puesto, lo que en el sistema de referencia hizo que una limpieza nunca corriera
 * y quedaran filas de prueba EN PRODUCCIÓN.
 *
 * El costo de `run` es que todo el cuerpo del manejador vive dentro de la clausura. A
 * cambio, ese defecto entero desaparece.
 *
 * ── Y por qué hay una transacción ────────────────────────────────────────────
 *
 * La variable `app.org_id` se pone con alcance de TRANSACCIÓN, no de sesión. La conexión
 * se reutiliza: con alcance de sesión, la siguiente petición —que puede ser de otra
 * organización— HEREDA la variable de la anterior. Con alcance de transacción la
 * variable muere con ella y ese escenario no existe (08 § 1, pieza 4).
 *
 * Consecuencia de diseño que hay que aceptar de frente: **toda operación que dependa
 * del filtro de la base corre dentro de una transacción.** No es un detalle de
 * implementación, es una restricción.
 */
export async function conOrganizacion<T>(orgId: string, trabajo: () => Promise<T>): Promise<T> {
  // Se valida acá y no en la política: el `nullif(btrim(...))::uuid` de la política
  // LANZA sobre cualquier texto que no sea un uuid, y ese error saldría desde el fondo
  // de una consulta de negocio sin decir de dónde vino.
  if (!UUID.test(orgId)) {
    throw new Error(`conOrganizacion: "${orgId}" no es un uuid`);
  }

  return clienteInquilino().transaction().execute(async (trx) => {
    // ── ANTES DE PONER NADA: la conexión tiene que venir LIMPIA ──────────────────
    //
    // `set_config(…, true)` revierte al terminar la transacción. Toda la seguridad del
    // alcance de transacción se apoya en eso — y eso, a su vez, se apoya en un
    // invariante que NO vive en la base: que la conexión siempre vuelva al agrupador
    // con su transacción CERRADA. Si una transacción queda abierta sobre una conexión
    // devuelta al agrupador, la variable no revierte y el siguiente que tome esa
    // conexión física HEREDA la organización del anterior.
    //
    // Está medido, no supuesto: con `pool.connect()` y un `release()` sin
    // `commit`/`rollback`, el siguiente préstamo devolvió el MISMO backend con la
    // transacción abierta, `app.org_id` todavía puesto, y leyó las filas de la
    // organización anterior. Hoy no es alcanzable —Kysely siempre cierra la transacción
    // antes de devolver la conexión, y no hay ni un `pool.connect()` manual en `lib/`—
    // pero es el invariante más fácil de romper sin darse cuenta: un agrupador externo
    // mal configurado, un manejador que se quede con el cliente, un `release()` en un
    // camino de error.
    //
    // Esta lectura cuesta un viaje de ida y vuelta y convierte "heredó la organización
    // de otro" en un error ruidoso. Al empezar una transacción el valor de reposo es
    // nulo (nunca se puso en esta conexión) o cadena vacía (ya se usó): cualquier otra
    // cosa significa que la conexión trae estado.
    const reposo = await sql<{ v: string | null }>`
      select current_setting('app.org_id', true) as v
    `.execute(trx);

    if (!enReposo(reposo.rows[0]?.v)) {
      throw new Error(
        'conOrganizacion: la conexión vino del agrupador con una organización ya puesta ' +
          `("${reposo.rows[0]?.v}"). Alguien devolvió una conexión sin cerrar su ` +
          'transacción, o hay un agrupador externo que no respeta el alcance de transacción.',
      );
    }

    // `SET` no acepta parámetros, así que tiene que ser `set_config`. Escrito a mano
    // obligaría a interpolar en el texto de la consulta un identificador que viene de
    // una sesión, que es exactamente lo que no se quiere hacer (08 § 1).
    const puesto = await sql<{ v: string | null }>`
      select set_config('app.org_id', ${orgId}, true) as v
    `.execute(trx);

    // LA VERIFICACIÓN PROPIA, y no es paranoia: `set_config(…, true)` FUERA de una
    // transacción TIENE ÉXITO Y NO HACE NADA, SIN AVISAR — el 08 § 1 lo dice y la
    // compuerta de la Etapa 0 lo midió. No hay advertencia que delate una operación que
    // cree tener contexto y no lo tiene.
    //
    // Y hay un segundo motivo, que es el que la hace valer para siempre: un agrupador de
    // conexiones en MODO SENTENCIA rompe el alcance de transacción incluso dentro de una
    // transacción abierta (09 § 6). Esta lectura de vuelta es la única defensa que no
    // cuesta infraestructura, y falla ruidosamente si algún día alguien pone un agrupador
    // mal configurado delante.
    if (puesto.rows[0]?.v !== orgId) {
      throw new Error(
        'conOrganizacion: la variable de transacción no quedó puesta. ' +
          'Suele ser un agrupador de conexiones en modo sentencia, que rompe el alcance ' +
          'de transacción sin avisar.',
      );
    }

    return almacen.run({ orgId, trx }, trabajo);
  });
}

/**
 * La capa de datos del inquilino, ya filtrada por la base.
 *
 * **LANZA si no hay organización activa.** No devuelve todo, no devuelve vacío: rompe.
 * Un error visible es infinitamente preferible a una consulta que devuelve las filas de
 * otro cliente (04 § 2).
 *
 * Y es la señal 1 del 10 § 1: esta excepción convierte el mecanismo de protección en un
 * mecanismo de detección sin escribir nada nuevo — si aparece en producción, hay una
 * operación que se olvidó el contexto.
 */
export function datos(): Trx {
  const ctx = almacen.getStore();
  if (!ctx) {
    throw new Error(
      'Ninguna consulta corre sin organización activa. ' +
        'Envolvé la operación en conOrganizacion(orgId, async () => { … }).',
    );
  }
  return ctx.trx;
}

