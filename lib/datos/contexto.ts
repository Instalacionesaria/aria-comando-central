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
import { avisar } from '../deteccion/aviso.ts';

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
 * Las subcuentas que ve la transacción: `'*'` = todas las de la organización.
 *
 * ── LA SEGUNDA LLAVE DEL MODELO MULTIEMPRESA (Fase 0, 2026-10-16) ─────────────
 *
 * El modelo de datos suma `cuenta_id` —la subcuenta de GoHighLevel dentro de su agencia— a las tablas de `negocio`,
 * con una política que exige `app.cuentas`: `'*'` ve todas las cuentas de la organización, una lista `uuid,uuid` ve
 * sólo ésas, y SIN la variable no se ve nada (falla cerrada). Hoy cada organización tiene una sola cuenta y nadie
 * está limitado a una parte, así que siempre es `'*'`; la lista llega con los usuarios de un cliente final.
 *
 * Se pone ANTES de que exista la política, a propósito: mientras la base no la pida, la variable no hace nada, y el
 * día que llegue la migración el código ya la está poniendo. Al revés, la migración dejaría a la aplicación sin ver
 * una sola fila hasta el siguiente despliegue.
 */
const TODAS_LAS_CUENTAS = '*';

/**
 * El ámbito de una transacción: de qué organización, qué cuentas ve y si ve lo de la organización entera.
 *
 * ── LAS TRES VARIABLES (el nivel 3, 2026-10-18) ──────────────────────────────
 *
 * El nivel 3 son los clientes de cada empresa (las cuentas). Dos personas distintas los miran:
 *
 *   · la EMPRESA (y el sistema: el cron, las fases) ve la organización entera. Puede mirar todos sus clientes a la vez
 *     (`cuentas: '*'`) o enfocarse en uno (`cuentas: [uno]`), y sigue viendo y escribiendo lo que es de la
 *     organización: el chat del cerebro, los sellos del cron, las señales;
 *   · el CLIENTE FINAL (un usuario limitado a sus cuentas) ve sólo sus cuentas (`todaLaOrganizacion: false`), y nada
 *     de lo que es de la organización.
 *
 * Por eso son tres variables y no dos: `app.cuentas` dice qué filas de cuenta se ven, y `app.toda_la_organizacion`
 * (`'si'`/`'no'`) dice si se ve lo que no es de ninguna cuenta. Con dos, la empresa enfocada en un cliente perdería
 * las filas de la organización —y no podría escribirlas—, o el cliente final las vería.
 *
 * Las invariantes se comprueban ANTES de abrir la transacción, porque una combinación mal armada es un defecto del
 * código y no un dato:
 *   · `'*'` sólo con la organización entera: el cliente final nunca ve «todas»;
 *   · la organización entera con una lista es el FOCO, y el foco es UNA cuenta;
 *   · el cliente final tiene entre 1 y `MAXIMO_DE_CUENTAS` cuentas: sin ninguna no ve nada, y eso se rechaza en la
 *     sesión, no acá.
 */
export interface Ambito {
  readonly orgId: string;
  /** `true` = la empresa o el sistema; `false` = el cliente final, que sólo ve sus cuentas. */
  readonly todaLaOrganizacion: boolean;
  /** `'*'` = todas las cuentas de la organización; una lista = sólo ésas. */
  readonly cuentas: typeof TODAS_LAS_CUENTAS | readonly string[];
}

/** Cuántas cuentas puede tener a la vista un cliente final. La variable viaja como texto en cada transacción. */
export const MAXIMO_DE_CUENTAS = 200;

/** Lo que se pone en las variables, ya validado. Lanza si el ámbito no es una combinación posible. */
function variablesDe(donde: string | Ambito): { orgId: string; cuentas: string; toda: 'si' | 'no'; lista: string[] } {
  const ambito: Ambito =
    typeof donde === 'string' ? { orgId: donde, todaLaOrganizacion: true, cuentas: TODAS_LAS_CUENTAS } : donde;
  // Se valida acá y no en la política: el `nullif(btrim(...))::uuid` de la política
  // LANZA sobre cualquier texto que no sea un uuid, y ese error saldría desde el fondo
  // de una consulta de negocio sin decir de dónde vino.
  if (!UUID.test(ambito.orgId)) {
    throw new Error(`conOrganizacion: "${ambito.orgId}" no es un uuid`);
  }
  const toda = ambito.todaLaOrganizacion ? 'si' : 'no';
  if (ambito.cuentas === TODAS_LAS_CUENTAS) {
    if (!ambito.todaLaOrganizacion) throw new Error('conOrganizacion: el cliente final no ve «todas las cuentas»');
    return { orgId: ambito.orgId, cuentas: TODAS_LAS_CUENTAS, toda, lista: [] };
  }
  const lista = [...ambito.cuentas];
  for (const c of lista) {
    if (!UUID.test(c)) throw new Error(`conOrganizacion: la cuenta "${c}" no es un uuid`);
  }
  if (new Set(lista).size !== lista.length) throw new Error('conOrganizacion: una cuenta repetida en el ámbito');
  if (ambito.todaLaOrganizacion && lista.length !== 1) {
    throw new Error('conOrganizacion: con la organización entera, el foco es una sola cuenta');
  }
  if (!ambito.todaLaOrganizacion && (lista.length < 1 || lista.length > MAXIMO_DE_CUENTAS)) {
    throw new Error(`conOrganizacion: el cliente final ve entre 1 y ${MAXIMO_DE_CUENTAS} cuentas`);
  }
  return { orgId: ambito.orgId, cuentas: lista.join(','), toda, lista };
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
export async function conOrganizacion<T>(donde: string | Ambito, trabajo: () => Promise<T>): Promise<T> {
  // Con un texto es la organización entera con todas sus cuentas: el sistema, y todo el código anterior al nivel 3.
  const { orgId, cuentas, toda, lista } = variablesDe(donde);

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
    const reposo = await sql<{ v: string | null; cuentas: string | null; toda: string | null }>`
      select current_setting('app.org_id', true) as v, current_setting('app.cuentas', true) as cuentas,
             current_setting('app.toda_la_organizacion', true) as toda
    `.execute(trx);

    if (!enReposo(reposo.rows[0]?.v)) {
      throw new Error(
        'conOrganizacion: la conexión vino del agrupador con una organización ya puesta ' +
          `("${reposo.rows[0]?.v}"). Alguien devolvió una conexión sin cerrar su ` +
          'transacción, o hay un agrupador externo que no respeta el alcance de transacción.',
      );
    }
    // Lo mismo con las cuentas: una conexión que trae `app.cuentas` de otra transacción trae su alcance.
    if (!enReposo(reposo.rows[0]?.cuentas) || !enReposo(reposo.rows[0]?.toda)) {
      throw new Error(
        'conOrganizacion: la conexión vino del agrupador con las cuentas ya puestas. Alguien devolvió una ' +
          'conexión sin cerrar su transacción, o hay un agrupador externo que no respeta el alcance de transacción.',
      );
    }

    // `SET` no acepta parámetros, así que tiene que ser `set_config`. Escrito a mano
    // obligaría a interpolar en el texto de la consulta un identificador que viene de
    // una sesión, que es exactamente lo que no se quiere hacer (08 § 1).
    const puesto = await sql<{ v: string | null; cuentas: string | null; toda: string | null }>`
      select set_config('app.org_id', ${orgId}, true) as v,
             set_config('app.cuentas', ${cuentas}, true) as cuentas,
             set_config('app.toda_la_organizacion', ${toda}, true) as toda
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
    if (puesto.rows[0]?.v !== orgId || puesto.rows[0]?.cuentas !== cuentas || puesto.rows[0]?.toda !== toda) {
      throw new Error(
        'conOrganizacion: la variable de transacción no quedó puesta. ' +
          'Suele ser un agrupador de conexiones en modo sentencia, que rompe el alcance ' +
          'de transacción sin avisar.',
      );
    }

    // Con una lista, cada cuenta tiene que ser de ESTA organización. La política de las cuentas ya filtra por
    // organización y por lista, así que basta con contar cuántas ve: una cuenta de otra empresa (o borrada) en la
    // lista no se vería, y el ámbito quedaría distinto del que se pidió sin que nada lo dijera.
    if (lista.length > 0) {
      const vistas = await sql<{ n: number }>`
        select count(*)::int as n from identidad.cuentas where id = any(cast(${lista} as uuid[]))
      `.execute(trx);
      if (vistas.rows[0]?.n !== lista.length) {
        throw new Error('conOrganizacion: una cuenta del ámbito no es de esta organización');
      }
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
    // ADR-0802 · EL AVISO. Es la señal 1 del `10` § 1, y la más barata de todas:
    //
    //   "La capa de aislamiento YA LANZA una excepción cuando alguien consulta sin organización en
    //    contexto. Hoy eso termina en un error 500 y en un registro que nadie lee. **Que esa
    //    excepción emita un aviso convierte el mecanismo de protección en un mecanismo de detección
    //    sin escribir nada nuevo.**"
    //
    // ── POR QUÉ EL AVISO NO SE ESPERA ────────────────────────────────────────
    //
    // `datos()` es SÍNCRONA —tiene que serlo: devuelve el constructor de consultas y encadena— y
    // `avisar()` no lo es. Así que se dispara sin esperar, y la excepción se lanza igual.
    //
    // La consecuencia hay que decirla: si el canal de avisos falla, `avisar()` rechaza su promesa y
    // acá no hay quién lo espere. Un rechazo sin manejar TUMBA EL PROCESO en Node, así que el
    // `.catch` es obligatorio — y lo único que puede hacer es escribir en el registro. Eso **no es
    // el aviso**: es el registro de que el aviso NO LLEGÓ, que es una cosa distinta y está
    // etiquetada como tal.
    //
    // La respuesta del propio documento a un canal caído no es un respaldo al registro: es *"el
    // resumen que se manda siempre (§ 2): también prueba que el canal vive"*. Ese resumen es de
    // tipo Producción y `EJECUCION` § 5 lo deja fuera de alcance, así que queda como pendiente
    // nombrado en `docs/6-historial/capa-base/ETAPA-8.md`.
    //
    // ── Y EL AVISO NO PASA POR LA CAPA QUE ESTÁ FALLANDO ─────────────────────
    //
    // El `10` § 1: *"si el registro de este evento se escribe con la misma capa que acaba de lanzar,
    // no se escribe nunca."* `avisar()` no toca la base: sale por el canal web.
    void avisar('aislamiento_sin_contexto', {
      // La traza es lo que dice QUÉ operación se olvidó el contexto, que es el único dato que hace
      // accionable este aviso. Sin ella dice "algo, en algún lado".
      traza: new Error('aislamiento_sin_contexto').stack ?? '(sin traza)',
    }).catch((e: unknown) => {
      // NO es el aviso. Es el registro de que el aviso no llegó.
      console.error(
        '[AVISO NO ENTREGADO] la capa de aislamiento lanzó y el canal de avisos falló:',
        e instanceof Error ? e.message : e,
      );
    });

    throw new Error(
      'Ninguna consulta corre sin organización activa. ' +
        'Envolvé la operación en conOrganizacion(orgId, async () => { … }).',
    );
  }
  return ctx.trx;
}

