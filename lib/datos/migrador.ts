// ADR-0002 — Las migraciones son versionadas y se aplican igual en todos lados.
// INNEGOCIABLE. Ver docs/TRAZABILIDAD.md.
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
 */
export const ESQUEMAS_NUESTROS: readonly string[] = ['identidad', 'negocio', ESQUEMA_CONTABILIDAD];

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
      if (nombre.startsWith('negocio.')) {
        const cuerpo = limpio.slice(m.index ?? 0);
        const fin = cuerpo.indexOf(';');
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
        const corta = nombre.replace(/^negocio\./i, '');
        const nombrada = new RegExp(
          String.raw`\bselect\s+(?:[\w"]+\.)?aplicar_aislamiento\s*\(\s*'(?:negocio\.)?` +
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

const proveedor: MigrationProvider = {
  async getMigrations(): Promise<Record<string, Migration>> {
    const migraciones: Record<string, Migration> = {};
    for (const archivo of archivosDeMigracion()) {
      const contenido = normalizar(readFileSync(join(DIR, archivo), 'utf8'));
      // Sin extensión: el nombre que queda en la contabilidad.
      const nombre = archivo.replace(/\.sql$/, '');
      migraciones[nombre] = {
        async up(db) {
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

/** Aplica lo que falte. Idempotente: una segunda corrida no aplica nada. */
export async function migrar(): Promise<ResultadoMigracion> {
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
    provider: proveedor,
    migrationTableSchema: ESQUEMA_CONTABILIDAD,
    migrationTableName: TABLA_APLICADAS,
    migrationLockTableName: TABLA_CANDADO,
  });

  const { error, results } = await migrator.migrateToLatest();

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
