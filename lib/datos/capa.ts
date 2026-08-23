// ADR-0203 — Un solo lugar crea el cliente de base.
//
// La capa de datos. Este es el ÚNICO archivo del proyecto que construye un
// cliente de base.
//
// El 04 § 7 lo escribe así, y explica por qué la prueba dice EXACTAMENTE DOS y no
// UNO: "Escrita como 'un solo lugar', esta prueba falla sobre código correcto la
// primera vez que exista el segundo dominio — y una prueba que falla sobre lo
// correcto se ignora, que es como mueren las pruebas arquitectónicas."
//
// La reconciliación con PRUEBAS Etapa 2 ("un solo lugar crea el cliente"):
// UN ARCHIVO, DOS CLIENTES. `crearCliente(` aparece solo acá; construye uno por
// dominio. La prueba de la Etapa 2 afirma que ningún otro archivo lo contiene.
//
// Lo que la Etapa 0 NO trae: `conOrganizacion(`, la inyección de la organización
// en las escrituras, y el contexto por petición. Eso es Etapa 2.

import { Kysely, PostgresDialect, type Transaction } from 'kysely';
import pg from 'pg';
import { urlDe, type RolBase } from './entorno.ts';
import { enPruebas, exigirAnfitrionLocal } from './anfitrion.ts';
import { organizacionActual } from './almacen.ts';
import { InyectarOrganizacion } from './inyeccion.ts';
import type { BaseDeDatos } from './esquema.ts';

export type Db = Kysely<BaseDeDatos>;
export type Trx = Transaction<BaseDeDatos>;

// El único constructor de clientes del proyecto.
function crearCliente(rol: RolBase): Db {
  const url = urlDe(rol);

  // ── El guard de anfitrión, SOLO bajo pruebas ───────────────────────────────
  //
  // `pruebas/apoyo/conexiones.ts` cubre las conexiones de inspección, pero varias
  // pruebas escriben por el CAMINO REAL a propósito —`30-aislamiento` y la fase
  // `verificar` de `db.mjs` usan `conOrganizacion()` y `datos()`, que es lo que las
  // hace valer algo— y ese camino pasa por acá, no por ahí.
  //
  // Sin esta rama, el guard de las pruebas tendría un agujero con la forma exacta
  // de las pruebas que más escriben.
  //
  // Condicionado a `enPruebas()` porque en producción el anfitrión TIENE que ser
  // remoto: acá el mismo hecho es correcto o catastrófico según quién pregunte.
  if (enPruebas()) {
    exigirAnfitrionLocal(url, {
      quien: `la capa de datos bajo pruebas (rol \`${rol}\`)`,
      porque: 'la suite escribe y borra por el camino real de la aplicación.',
      escotilla: 'ARIA_PRUEBAS_FORZADAS',
    });
  }

  return new Kysely<BaseDeDatos>({
    // La inyección de la organización va SOLO en el cliente del inquilino.
    //
    // El de identidad NO la lleva, y eso es lo que hace viable que la inyección sea
    // incondicional: las tablas de identidad se alcanzan por otro cliente, así que este
    // transformador nunca las ve. Si las viera, un `insert into sesiones` recibiría una
    // columna `org_id` que no existe — y fallaría ruidosamente, que es el lado correcto
    // del que fallar, pero no hace falta llegar ahí.
    //
    // `organizacionActual` viene de `almacen.ts`, que no importa nada de esta capa —
    // por eso no hay ciclo con `contexto.ts`.
    plugins: rol === 'inquilino' ? [new InyectarOrganizacion(organizacionActual)] : [],
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString: url,
        // A la escala de este sistema —cinco organizaciones, veinte usuarios,
        // decenas de peticiones simultáneas— un agrupador chico alcanza. La regla
        // de tamaño de EJECUCION § 1 es explícita: "si una solución existe para
        // resolver un problema de escala, no se implementa".
        max: 5,
        // Que una credencial mal puesta falle rápido y con un error claro, en vez
        // de colgar la suite de pruebas.
        connectionTimeoutMillis: 10_000,
      }),
    }),
  });
}

// Un cliente por rol, perezoso.
//
// NO es una caché de datos de inquilino, que es lo que el 07 § 3 prohíbe ("un
// caché de proceso 'para no descifrar dos veces' es exactamente cómo el token de
// una organización termina usándose para otra"). Es un agrupador de conexiones por
// ROL de base, que es para lo que existe un agrupador. Nada derivado de una
// organización se guarda acá ni en ningún otro lado del proceso.
const clientes = new Map<RolBase, Db>();

function clienteDe(rol: RolBase): Db {
  let cliente = clientes.get(rol);
  if (!cliente) {
    cliente = crearCliente(rol);
    clientes.set(rol, cliente);
  }
  return cliente;
}

/**
 * La escotilla: acceso al dominio de IDENTIDAD, sin filtro de organización.
 *
 * No es "acceso total". Es "acceso a las diez tablas de identidad, declarado en
 * una migración que alguien revisó" (09 § 1). Este rol NO PUEDE LEER UNA SOLA FILA
 * DE NEGOCIO: no tiene el permiso, así que falla FUERTE y a la vista, no devuelve
 * vacío. Ésa es la propiedad que hace que la separación valga la pena.
 *
 * El nombre `conIdentidad(` es la cadena que van a buscar las pruebas
 * (EJECUCION § 6). Un sinónimo rompe la prueba sin romper el código.
 *
 * Envuelve el trabajo en una transacción: da atomicidad dentro del dominio y fija
 * la conexión. El costo son dos viajes de ida y vuelta por llamada, que a esta
 * escala no se mide.
 */
export async function conIdentidad<T>(trabajo: (db: Trx) => Promise<T>): Promise<T> {
  return clienteDe('identidad').transaction().execute(trabajo);
}

/**
 * El cliente del dominio del inquilino.
 *
 * NO se usa directo desde código de negocio: se usa a través de `conOrganizacion(` y
 * `datos()` de `contexto.ts`, que son los que ponen la variable de transacción y
 * lanzan cuando no hay contexto. Éste es solo el constructor del agrupador.
 *
 * Lo exporta para `contexto.ts` y para las pruebas que necesitan comprobar que este
 * rol FALLA al tocar las tablas de identidad.
 */
export function clienteInquilino(): Db {
  return clienteDe('inquilino');
}

/** El cliente de las migraciones. Solo lo usa el corredor de migraciones. */
export function clienteMigradorParaMigraciones(): Db {
  return clienteDe('migrador');
}

/**
 * Cierra los agrupadores abiertos.
 *
 * Hace falta de verdad: con el corredor de pruebas de Node, un agrupador sin
 * cerrar deja el proceso colgado y la suite nunca termina — y un proceso que no
 * termina en integración continua se lee como una prueba lenta, no como un error.
 */
export async function cerrarClientes(): Promise<void> {
  const abiertos = [...clientes.values()];
  clientes.clear();
  await Promise.all(abiertos.map((c) => c.destroy()));
}
