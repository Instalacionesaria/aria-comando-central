// ADR-0002 — Las migraciones son versionadas y se aplican igual en todos lados.
// INNEGOCIABLE. Ver docs/1-plataforma/TRAZABILIDAD.md.
//
// El corredor de migraciones: ordena, registra y CONDICIONA el SQL.
//
// No escribe SQL. Los archivos de `db/migraciones/` se aplican VERBATIM, para que
// un revisor pueda diffear `002_organizaciones_y_usuarios.sql` contra el 01 § 2–§ 3
// y el 09 § 2 línea por línea. Esa diffeabilidad es el punto (EJECUCION § 6: "no
// se inventa… se usa ESE").
//
// Lo que sí hace es negarse a aplicar. Cada rechazo de acá corresponde a una forma
// documentada de fallar EN SILENCIO.

import { sql } from 'kysely';
// En kysely 0.29 la API de migraciones vive en un subpath, no en la raíz:
// `kysely/migration`. Importarla de 'kysely' falla en tiempo de ejecución con
// "does not provide an export named 'Migrator'".
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clienteMigradorParaMigraciones, type Db } from './capa.ts';

const DIR = fileURLToPath(new URL('../../db/migraciones/', import.meta.url));

// La contabilidad de las migraciones vive en su PROPIO esquema.
//
// Bomba concreta, y sigue siendo cierta: por omisión Kysely crea su tabla en el
// primer esquema de la ruta de búsqueda, y `migrador` tiene
// `search_path = identidad, negocio`. La contabilidad nacería DENTRO de `identidad` y
// la prueba de catálogo de la Etapa 1 —"cero tablas sin seguridad activada, forzada y
// con política"— fallaría sobre la tabla de la propia herramienta.
//
// ── POR QUÉ YA NO ES `public` ──────────────────────────────────────────────────
//
// Hasta acá era `public`, y el razonamiento era que `public` era el esquema vacío
// por exclusión: el único lugar que no era ni `identidad` ni `negocio`.
//
// Ese razonamiento se cayó. La base real tiene 59 tablas de cinco sistemas ahí, más
// los esquemas de plataforma de Supabase. `public` no es un lugar tranquilo: es el
// esquema de otros cinco dueños, y encima está publicado por PostgREST, así que una
// tabla nuestra sin RLS nace alcanzable desde la red con la clave anónima.
//
// Mudarla acá compra lo que de verdad importaba: permite QUITAR
// `grant usage, create on schema public to migrador` del arranque, que era la única
// razón por la que `migrador` podía crear objetos en el esquema de los cinco
// sistemas. Con eso, nuestra superficie de escritura sobre `public` baja a CERO — que
// es la propiedad entera sobre la que se apoya la convivencia.
export const ESQUEMA_CONTABILIDAD = 'migraciones';
export const TABLA_APLICADAS = 'migraciones_aplicadas';
export const TABLA_CANDADO = 'migraciones_candado';

/**
 * Los esquemas donde este proyecto puede crear tablas.
 *
 * `public` NO está, y es el punto. La lista la usa el rechazo 4b de
 * `revisarMigraciones()`: hasta la base real, "calificar el esquema" alcanzaba
 * porque no había otro esquema donde caer.
 *
 * `migraciones` está porque es el esquema de la contabilidad — pero esas dos tablas
 * las crea Kysely, no un archivo de `db/migraciones/`, así que en la práctica ningún
 * `create table` nuestro lo nombra. Está en la lista para que el día que alguien
 * necesite tocar la contabilidad desde una migración, el rechazo no lo confunda.
 *
 * `catalogo` entra con la `079` (modelo multiempresa, Fase 0): el idioma común, tablas de referencia compartidas
 * por todas las empresas. Cada esquema del modelo se suma acá en la migración que lo crea, no antes: una entrada
 * sin esquema detrás sería un permiso para crear tablas donde todavía no hay reglas. `sistema` (las particiones) e
 * `ingesta` (la bandeja de lo crudo) entran con la `081`.
 */
export const ESQUEMAS_NUESTROS: readonly string[] = ['identidad', 'negocio', 'catalogo', 'sistema', 'ingesta', ESQUEMA_CONTABILIDAD];

/** Los `.sql` de db/migraciones/, en orden alfabético. El nombre ordena. */
export function archivosDeMigracion(): string[] {
  return readdirSync(DIR)
    .filter((n) => n.endsWith('.sql'))
    .sort();
}

/**
 * Normaliza los finales de línea antes de mirar el contenido.
 *
 * El desarrollo es en Windows con `core.autocrlf = true` —git guarda LF y escribe
 * CRLF en el disco— y la integración corre en Linux. Sin esto, cualquier
 * comparación de contenido difiere entre las dos máquinas por razones que no
 * tienen nada que ver con el SQL.
 */
function normalizar(texto: string): string {
  return texto.replace(/\r\n/g, '\n');
}

/** Quita comentarios de SQL para que un comentario no active un rechazo. */
function sinComentarios(sql_: string): string {
  return sql_
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');
}

export interface Rechazo {
  archivo: string;
  motivo: string;
}

/**
 * Las revisiones estáticas, sobre TODOS los archivos, ANTES de aplicar cualquiera.
 *
 * Promueve cuatro reglas de "prueba" a "negativa en tiempo de migración", que es
 * más temprano y no se puede comentar.
 */
export function revisarMigraciones(): Rechazo[] {
  const rechazos: Rechazo[] = [];

  for (const archivo of archivosDeMigracion()) {
    const bruto = normalizar(readFileSync(join(DIR, archivo), 'utf8'));
    const limpio = sinComentarios(bruto);

    // 1 · "Cambiar el dueño después de crear la tabla no reaplica nada" (09 § 2).
    //     Es el patrón "creo como superusuario y después cambio el dueño", que
    //     deja las tablas nuevas sin los permisos por omisión.
    if (/\bowner\s+to\b/i.test(limpio)) {
      rechazos.push({ archivo, motivo: '`owner to`: los permisos por omisión se consultan AL CREAR' });
    }

    // 2 · "Lo que NO hay que hacer es quitar el forzado durante la migración y
    //     reponerlo al final: una migración que falle a la mitad deja la tabla sin
    //     forzar, y el catálogo la muestra como 'encendida y con política' — el
    //     estado en el que el dueño la evade. Es el peor de los tres porque no se
    //     ve." (09 § 2)
    if (/\bno\s+force\s+row\s+level\s+security\b/i.test(limpio)) {
      rechazos.push({ archivo, motivo: '`no force row level security`: deja la tabla evadible por su dueño' });
    }

    // 3 · Ningún `set role`: el cambio de rol NO es una frontera entre dominios,
    //     y además es reversible desde la misma sesión (09 § 6).
    if (/\bset\s+role\b/i.test(limpio)) {
      rechazos.push({ archivo, motivo: '`set role`: no es una frontera entre dominios' });
    }

    // 4 · Toda tabla se crea CALIFICADA. El 09 § 6 nombra la ruta de búsqueda mal
    //     puesta como el mecanismo real por el que una tabla nace en el esquema
    //     equivocado, y el `search_path` por rol solo aplica a sesiones abiertas
    //     DESPUÉS del `alter role`. Calificar cuesta nueve caracteres.
    for (const m of limpio.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi)) {
      const nombre = m[1] ?? '';
      if (!nombre.includes('.')) {
        rechazos.push({ archivo, motivo: `\`create table ${nombre}\` sin esquema: calificalo` });
      } else if (!ESQUEMAS_NUESTROS.some((e) => nombre.toLowerCase().startsWith(`${e}.`))) {
        // 4b · Y el esquema tiene que ser UNO DE LOS NUESTROS.
        //
        // Hasta acá la regla 4 solo exigía que el nombre tuviera un punto, y con la
        // base vacía de la Etapa 0 eso alcanzaba: no había otro esquema donde caer.
        // Ya no. La base real tiene cinco sistemas en `public` y los esquemas de
        // plataforma de Supabase (`auth`, `storage`, `extensions`, `vault`…), así que
        // `create table public.pedidos` y `create table auth.usuarios` pasaban la
        // revisión sin una objeción.
        //
        // Y una tabla nuestra en `public` no es solo desorden: `public` está
        // publicado por PostgREST, así que nace alcanzable desde la red con la clave
        // anónima y sin ninguna de las quince políticas de este sistema.
        rechazos.push({
          archivo,
          motivo:
            `\`create table ${nombre}\`: el esquema tiene que ser uno de ` +
            `${ESQUEMAS_NUESTROS.join(', ')} — no se crean tablas en esquemas ajenos`,
        });
      }
      // 5 · Toda tabla de NEGOCIO lleva la columna del inquilino, o está en la
      //     lista de tablas compartidas — que es el CONJUNTO VACÍO, porque no hay
      //     esquema `comun` ni tablas sin dueño (EJECUCION § 2).
      const cuerpoDeLaTabla = limpio.slice(m.index ?? 0);
      const finDeLaTabla = cuerpoDeLaTabla.indexOf(';');
      // Una PARTICIÓN (`create table … partition of …`, desde la `084`) no es una tabla nueva para estas dos reglas:
      // hereda las columnas de su madre —org_id incluida— y se lee a través de ella, que es la que lleva la política.
      // Lo que se le exige es otra cosa, que nazca cerrada (sin permisos para la aplicación y con la RLS forzada), y
      // eso lo mide la prueba 257 sobre la base, no un patrón de texto.
      const esParticion = /\bpartition\s+of\b/i.test(
        finDeLaTabla === -1 ? cuerpoDeLaTabla : cuerpoDeLaTabla.slice(0, finDeLaTabla),
      );
      if (nombre.startsWith('negocio.') && !esParticion) {
        const cuerpo = cuerpoDeLaTabla;
        const fin = finDeLaTabla;
        const declaracion = fin === -1 ? cuerpo : cuerpo.slice(0, fin);
        if (!/\borg_id\b/.test(declaracion)) {
          rechazos.push({ archivo, motivo: `\`${nombre}\` es de negocio y no declara org_id` });
        }
        // 5b · La llamada tiene que nombrar ESTA tabla, no cualquiera.
        //
        // Antes se comprobaba contra el archivo completo: bastaba UNA llamada a
        // `aplicar_aislamiento()` en cualquier parte para que TODAS las tablas de
        // negocio del archivo pasaran. Una migración que creara dos tablas y aislara
        // una sola pasaba la revisión, y la que quedaba afuera terminaba con RLS
        // apagada y el `grant` por omisión al inquilino — o sea, el inquilino viendo
        // todas las filas de todas las organizaciones.
        //
        // Que es exactamente el defecto que la migración 008 existe para prevenir. Con
        // una sola tabla de negocio en el proyecto el hueco era teórico; deja de serlo
        // en cuanto se agregue la segunda.
        //
        // El calificador de esquema es opcional en las dos puntas: la convención del
        // proyecto es calificar (`select negocio.aplicar_aislamiento('negocio.x')`),
        // pero el documento la escribe sin calificar y las dos formas tienen que pasar.
        //
        // Desde la `084` también vale `aplicar_aislamiento_de_cuenta('negocio.x', …)`: llama a la otra y suma la
        // cuenta (modelo multiempresa), así que aísla igual o más. Sigue siendo una llamada por tabla, nombrada.
        const corta = nombre.replace(/^negocio\./i, '');
        const nombrada = new RegExp(
          String.raw`\bselect\s+(?:[\w"]+\.)?aplicar_aislamiento(?:_de_cuenta)?\s*\(\s*'(?:negocio\.)?` +
            `${corta}'`,
          'i',
        );
        if (!nombrada.test(limpio)) {
          rechazos.push({
            archivo,
            motivo:
              `\`${nombre}\` es de negocio y ninguna llamada a aplicar_aislamiento() la ` +
              'nombra: una llamada por tabla, no una por archivo',
          });
        }
      }
    }
  }

  return rechazos;
}

// ── EL TOPE DE ESPERA POR UN CANDADO ─────────────────────────────────────────
//
// Un `alter table` pide un candado exclusivo sobre la tabla. Si una consulta larga de la aplicación la está leyendo,
// el `alter` espera, y mientras espera, TODA consulta nueva a esa tabla se encola detrás de él: en producción eso es
// la ingesta y las pantallas paradas sin que nada dé error. Con el tope, la migración falla a los cinco segundos, la
// transacción se revierte entera (nada queda a medias) y se vuelve a correr en otro momento. Sin el tope, Postgres
// espera para siempre (`lock_timeout = 0`). Revisión para producción, documento 23 § 7, paso 0.3.
//
// Se cambia con `ARIA_MIGRAR_LOCK_TIMEOUT` (por ejemplo `10s`, `500ms`, `1min`; `0` lo apaga).
export const LOCK_TIMEOUT_POR_OMISION = '5s';

/** El tope de espera por un candado de las migraciones, validado: `set_config` lo recibe como texto. */
export function topeDeEspera(valor: string | undefined = process.env.ARIA_MIGRAR_LOCK_TIMEOUT): string {
  const v = (valor ?? '').trim();
  if (v === '') return LOCK_TIMEOUT_POR_OMISION;
  if (!/^\d+(?:us|ms|s|min|h|d)?$/.test(v)) {
    throw new Error(
      `ARIA_MIGRAR_LOCK_TIMEOUT = «${v}» no es una duración de Postgres: un número con unidad opcional ` +
        '(us, ms, s, min, h, d), por ejemplo `5s`.',
    );
  }
  return v;
}

function proveedorDe(tope: string): MigrationProvider {
  return {
    async getMigrations(): Promise<Record<string, Migration>> {
      const migraciones: Record<string, Migration> = {};
      for (const archivo of archivosDeMigracion()) {
        const contenido = normalizar(readFileSync(join(DIR, archivo), 'utf8'));
        // Sin extensión: el nombre que queda en la contabilidad.
        const nombre = archivo.replace(/\.sql$/, '');
        migraciones[nombre] = {
          async up(db) {
            // El tope, dentro de la transacción de las migraciones (`set_config(…, true)` es `set local`). Local y no
            // de sesión porque la conexión vuelve al agrupador y se reusa, y porque detrás de un agrupador de
            // transacciones (Supabase) un `set` de sesión no se queda en la conexión. Kysely corre todas las
            // pendientes en UNA transacción, así que la primera lo deja puesto para todas; se repite en cada una
            // para no depender de eso.
            await sql`select set_config('lock_timeout', ${tope}, true)`.execute(db);
            // El archivo entero, de una. `pg` usa el protocolo simple cuando no hay
            // parámetros, así que un archivo con VARIAS sentencias y cuerpos
            // `$$ … $$` se aplica tal cual, sin partirlo en fragmentos.
            await sql.raw(contenido).execute(db);
          },
        };
      }
      return migraciones;
    },
  };
}

// ── `migrar --hasta NNN` ─────────────────────────────────────────────────────
//
// El código y las migraciones suben intercalados (documento 23 § 2, B2): hay que poder aplicar «hasta la 081», hacer
// la fase de arranque que toca, empujar el código, y seguir. Las migraciones salen SIEMPRE de los archivos de HEAD:
// aplicar desde un checkout viejo deja registrada por nombre una versión que después se corrigió, y la corregida no
// se vuelve a aplicar nunca.

/** Las opciones de `scripts/db.mjs migrar`. */
export interface OpcionesDeMigrar {
  /** El número (`081`) o el nombre (`081_la_bandeja_de_entrada`) de la última migración que se aplica. */
  hasta: string | null;
}

/**
 * Lee los argumentos de `migrar`: `--hasta NNN` o `--hasta=NNN`, nada más. Lanza ante cualquier otro argumento, un
 * `--hasta` sin valor o repetido: un tope mal escrito que se ignorara aplicaría TODO lo pendiente.
 */
export function leerOpcionesDeMigrar(args: readonly string[]): OpcionesDeMigrar {
  let hasta: string | null = null;
  let visto = false;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i] ?? '';
    let valor: string | undefined;
    if (a === '--hasta') {
      valor = args[i + 1];
      i += 1;
    } else if (a.startsWith('--hasta=')) {
      valor = a.slice('--hasta='.length);
    } else {
      throw new Error(`migrar no entiende «${a}». Uso: migrar [--hasta NNN]`);
    }
    if (visto) throw new Error('--hasta va una sola vez');
    visto = true;
    if (valor === undefined || valor.trim() === '' || valor.startsWith('-')) {
      throw new Error('--hasta necesita la migración: un número (081) o un nombre (081_la_bandeja_de_entrada)');
    }
    hasta = valor.trim();
  }
  return { hasta };
}

/**
 * El nombre de la migración que nombra `--hasta`, entre `nombres` (sin `.sql`). Acepta el número (`81` u `081`) o el
 * nombre completo (con o sin `.sql`). Lanza si no existe o si el número es ambiguo.
 */
export function resolverHasta(valor: string, nombres: readonly string[]): string {
  const v = valor.trim().replace(/\.sql$/i, '');
  if (/^\d{1,3}$/.test(v)) {
    const prefijo = `${v.padStart(3, '0')}_`;
    const candidatas = nombres.filter((n) => n.startsWith(prefijo));
    if (candidatas.length === 1) return candidatas[0] as string;
    if (candidatas.length === 0) throw new Error(`no existe la migración ${v.padStart(3, '0')} en db/migraciones/`);
    throw new Error(`el número ${v.padStart(3, '0')} es ambiguo: ${candidatas.join(', ')}. Usa el nombre completo`);
  }
  if (nombres.includes(v)) return v;
  throw new Error(`no existe la migración «${v}» en db/migraciones/`);
}

/** Lo que una corrida va a aplicar, calculado ANTES de aplicar nada. */
export interface PlanDeMigracion {
  /** Las ya registradas en la contabilidad, en orden. */
  aplicadas: string[];
  /** Todas las que faltan, en orden. */
  pendientes: string[];
  /** Las que esta corrida aplica: las pendientes hasta `hasta` inclusive (todas si no hay tope). */
  aAplicar: string[];
  /** El nombre resuelto del tope, o null. */
  hasta: string | null;
}

/**
 * El plan, sin tocar la base: `nombres` son los archivos de HEAD y `aplicadas` lo que dice la contabilidad.
 *
 * Se niega a VOLVER ATRÁS: Kysely, con `migrateTo` de una migración ya aplicada, baja las posteriores. Nuestras
 * migraciones no tienen `down`, así que hoy no haría nada, pero un `--hasta` detrás de lo aplicado siempre es un error
 * de quien despliega (un paso del runbook salteado o repetido) y se dice en voz alta. Repite además las dos
 * comprobaciones de orden de Kysely para que el plan impreso nunca mienta.
 */
export function planear(nombres: readonly string[], aplicadas: readonly string[], hasta: string | null): PlanDeMigracion {
  const faltantes = aplicadas.filter((a) => !nombres.includes(a));
  if (faltantes.length > 0) {
    throw new Error(`la base tiene aplicadas migraciones que no están en db/migraciones/: ${faltantes.join(', ')}`);
  }
  const pendientes = nombres.filter((n) => !aplicadas.includes(n));
  const ultima = aplicadas.length > 0 ? [...aplicadas].sort().at(-1) ?? null : null;
  const desordenadas = ultima === null ? [] : pendientes.filter((p) => p < ultima);
  if (desordenadas.length > 0) {
    throw new Error(
      `hay migraciones pendientes anteriores a la última aplicada (${ultima}): ${desordenadas.join(', ')}`,
    );
  }

  if (hasta === null) return { aplicadas: [...aplicadas], pendientes, aAplicar: pendientes, hasta: null };

  const tope = resolverHasta(hasta, nombres);
  if (aplicadas.includes(tope)) {
    if (tope === ultima) return { aplicadas: [...aplicadas], pendientes, aAplicar: [], hasta: tope };
    throw new Error(
      `--hasta ${tope}: ya está aplicada y la base va más adelante (última: ${ultima}). ` +
        'migrar no vuelve atrás.',
    );
  }
  const indice = pendientes.indexOf(tope);
  return { aplicadas: [...aplicadas], pendientes, aAplicar: pendientes.slice(0, indice + 1), hasta: tope };
}

/**
 * Comprueba que la conexión es la correcta ANTES de tocar la base.
 *
 * El 09 § 2 documenta cuatro formas de que `alter default privileges` no se
 * aplique, todas con el mismo síntoma: *permiso denegado* en la primera consulta a
 * la primera tabla nueva, ya desplegada. Ésta cubre la primera y la peor: "la
 * regla es por rol efectivo al crear el objeto, y NO SE HEREDA".
 */
export async function comprobarConexion(db: Db): Promise<void> {
  const quien = await sql<{
    usuario: string;
    sesion: string;
    superusuario: string;
  }>`
    select current_user as usuario,
           session_user as sesion,
           current_setting('is_superuser') as superusuario
  `.execute(db);
  const f = quien.rows[0];
  if (!f) throw new Error('no se pudo leer current_user');

  if (f.usuario !== 'migrador' || f.sesion !== 'migrador') {
    throw new Error(
      `las migraciones tienen que correr como \`migrador\`, no como ` +
        `${f.usuario} (sesión: ${f.sesion}). El rol efectivo AL CREAR el objeto es ` +
        'el que decide si `alter default privileges for role migrador` aplica.',
    );
  }
  if (f.superusuario !== 'off') {
    throw new Error(
      'las migraciones no pueden correr como superusuario: `force row level security` ' +
        'no lo alcanzaría y el aislamiento se vería perfecto sin estar puesto.',
    );
  }

  // "Ninguno puede ser miembro de otro." Una política dirigida a un rol se aplica
  // a TODO rol que herede sus privilegios, y como las políticas permisivas se
  // combinan con O, un `grant app_identidad to app_inquilino` haría que el
  // inquilino vea TODAS las filas de TODAS las organizaciones. En silencio, sin
  // cambiar una sola política. Es una línea de SQL que revierte el diseño entero.
  const herencia = await sql<{
    inq_identidad: boolean;
    ident_inquilino: boolean;
    inq_migrador: boolean;
    ident_migrador: boolean;
  }>`
    select pg_has_role('app_inquilino', 'app_identidad', 'USAGE') as inq_identidad,
           pg_has_role('app_identidad', 'app_inquilino', 'USAGE') as ident_inquilino,
           pg_has_role('app_inquilino', 'migrador',      'USAGE') as inq_migrador,
           pg_has_role('app_identidad', 'migrador',      'USAGE') as ident_migrador
  `.execute(db);
  const h = herencia.rows[0];
  if (!h) throw new Error('no se pudo comprobar la herencia de roles');
  const heredados = Object.entries(h)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
  if (heredados.length > 0) {
    throw new Error(
      `hay herencia entre roles (${heredados.join(', ')}). Una política dirigida a un ` +
        'rol se aplica a todo rol que herede sus privilegios: el inquilino vería todas ' +
        'las filas de todas las organizaciones.',
    );
  }
}

export interface ResultadoMigracion {
  aplicadas: string[];
}

export interface OpcionesDeLaCorrida {
  /** El tope (`--hasta`): número o nombre. Sin él, todo lo pendiente. */
  hasta?: string | null;
  /** Recibe el plan ANTES de aplicar nada: `scripts/db.mjs` lo imprime. */
  alPlanear?: (plan: PlanDeMigracion) => void;
}

/** Aplica lo que falte (o hasta `hasta`). Idempotente: una segunda corrida no aplica nada. */
export async function migrar(opciones: OpcionesDeLaCorrida = {}): Promise<ResultadoMigracion> {
  const hasta = opciones.hasta ?? null;
  // Antes de conectarse: un tope mal escrito o una variable mal puesta no abren ninguna conexión.
  const tope = topeDeEspera();
  if (hasta !== null) resolverHasta(hasta, archivosDeMigracion().map((a) => a.replace(/\.sql$/, '')));

  const rechazos = revisarMigraciones();
  if (rechazos.length > 0) {
    const detalle = rechazos.map((r) => `  ${r.archivo}: ${r.motivo}`).join('\n');
    throw new Error(`migraciones rechazadas antes de aplicar nada:\n${detalle}`);
  }

  const db = clienteMigradorParaMigraciones();
  await comprobarConexion(db);

  // El esquema de la contabilidad, antes que nada.
  //
  // Kysely usa `migrationTableSchema` pero NO crea el esquema: si no existe, falla
  // con "schema does not exist" en la primera corrida y ni el candado se toma. Con
  // `public` esto no hacía falta porque siempre existe; ése era todo el conveniente
  // de estar ahí, y es más barato de reponer que la propiedad que costaba.
  //
  // Después de `comprobarConexion()` y no antes: crear un esquema sin haber
  // verificado con qué rol estamos conectados es crearlo con el dueño equivocado, y
  // el dueño de un esquema es lo que las pruebas de catálogo usan para distinguir lo
  // nuestro de lo ajeno.
  await sql.raw(`create schema if not exists ${ESQUEMA_CONTABILIDAD}`).execute(db);

  const migrator = new Migrator({
    db,
    provider: proveedorDe(tope),
    migrationTableSchema: ESQUEMA_CONTABILIDAD,
    migrationTableName: TABLA_APLICADAS,
    migrationLockTableName: TABLA_CANDADO,
  });

  // El plan, con lo que dice la contabilidad, ANTES de aplicar: quien despliega ve qué entra.
  const estado = await migrator.getMigrations();
  const plan = planear(
    estado.map((m) => m.name),
    estado.filter((m) => m.executedAt !== undefined).map((m) => m.name),
    hasta,
  );
  opciones.alPlanear?.(plan);
  if (plan.aAplicar.length === 0) return { aplicadas: [] };

  // Con tope, `migrateTo` de la última del plan; sin tope, `migrateToLatest` como siempre. Las dos corren las
  // pendientes en UNA transacción (con DDL transaccional, si una falla se revierten todas).
  const { error, results } = plan.hasta !== null
    ? await migrator.migrateTo(plan.hasta)
    : await migrator.migrateToLatest();

  // Nunca hacia abajo. `planear` ya lo rechaza; esto cubre que otra corrida haya avanzado entre el plan y el candado.
  const bajadas = (results ?? []).filter((r) => r.direction === 'Down');
  if (bajadas.length > 0) {
    throw new Error(`migrar intentó bajar ${bajadas.map((r) => r.migrationName).join(', ')}: no vuelve atrás`);
  }

  const aplicadas = (results ?? [])
    .filter((r) => r.status === 'Success')
    .map((r) => r.migrationName);

  if (error) {
    const fallada = (results ?? []).find((r) => r.status === 'Error');
    const cual = fallada ? ` (falló ${fallada.migrationName})` : '';
    // Con DDL transaccional, si una falla se revierten TODAS: una corrida a medias
    // no existe. Es la respuesta directa al 09 § 2 sobre la migración que muere
    // por la mitad y deja una tabla sin forzar.
    throw new Error(`la migración falló${cual}: ${String(error)}`);
  }

  return { aplicadas };
}
