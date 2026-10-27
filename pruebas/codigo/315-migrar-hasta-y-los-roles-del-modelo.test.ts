// MIGRAR POR TRAMOS (`--hasta NNN`) Y LOS TRES ROLES DEL MODELO EN UN ARCHIVO SIN MARCAS. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (revisión para producción, documento 23 § 2 B1 y B2, § 7 paso 0.3 y 0.4)
//
// B2 · El código y las migraciones suben intercalados: `node scripts/db.mjs migrar --hasta 081`, la fase que toca, el
// push, y seguir. Un tope mal leído que se ignorara aplicaría TODO lo pendiente en producción, así que acá se cuida que
// los argumentos se lean estrictos, que el tope exista, que nunca se vuelva atrás y que cada migración corra con un
// `lock_timeout` (sin él, un `alter table` detrás de una consulta larga encola a toda la aplicación).
//
// B1 · Producción no tiene `ingestor`, `app_ingesta` ni `app_analista`, y el `000` no se puede correr allá (lleva
// marcas; `supabase.mjs correr` las rechaza, y sustituirlas a mano vuelve a fijar las contraseñas de los roles con
// login). El `008` es el archivo que sí corre: sin marcas, sólo esos tres roles, sin login y sin contraseña. Y para
// que no haya dos copias que diverjan, el `000` ya no los crea y `db.mjs arranque` corre el `008` a continuación.
//
// Las mutaciones que la ponen roja: aceptar un argumento desconocido o un `--hasta` sin valor; resolver un número que
// no existe; dejar que un tope detrás de lo aplicado pase; quitar el `set_config('lock_timeout', …)`; llamar a
// `migrateToLatest` también con tope; ponerle una marca, una contraseña o un cuarto rol al `008`; volver a crear los
// tres roles en el `000`; que `db.mjs arranque` deje de correr el `008` o `migrar` deje de leer sus argumentos.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import {
  archivosDeMigracion,
  leerOpcionesDeMigrar,
  LOCK_TIMEOUT_POR_OMISION,
  planear,
  resolverHasta,
  topeDeEspera,
} from '../../lib/datos/migrador.ts';

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8').replace(/\r\n/g, '\n');

/** SQL sin comentarios de línea ni de bloque. */
const sqlSinComentarios = (texto: string) =>
  texto
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');

const NOMBRES = archivosDeMigracion().map((a) => a.replace(/\.sql$/, ''));

// ─── Los argumentos de `migrar` ───────────────────────────────────────────────

test('migrar lee `--hasta NNN` y `--hasta=NNN`, y sin argumentos no pone tope', () => {
  assert.deepEqual(leerOpcionesDeMigrar([]), { hasta: null });
  assert.deepEqual(leerOpcionesDeMigrar(['--hasta', '081']), { hasta: '081' });
  assert.deepEqual(leerOpcionesDeMigrar(['--hasta=082']), { hasta: '082' });
  assert.deepEqual(leerOpcionesDeMigrar(['--hasta', '081_la_bandeja_de_entrada']), { hasta: '081_la_bandeja_de_entrada' });
});

test('migrar rechaza un argumento que no entiende, un --hasta sin valor y uno repetido', () => {
  for (const malo of [
    ['081'],
    ['--hast', '081'],
    ['--todo'],
    ['--hasta'],
    ['--hasta='],
    ['--hasta', '--hasta', '081'],
    ['--hasta', '081', '--hasta', '082'],
    ['--hasta', '081', 'extra'],
  ]) {
    assert.throws(() => leerOpcionesDeMigrar(malo), Error, `aceptó ${JSON.stringify(malo)}`);
  }
});

test('el tope se resuelve contra los archivos de HEAD: número o nombre, y nunca uno que no existe', () => {
  const la081 = NOMBRES.find((n) => n.startsWith('081_'));
  assert.ok(la081, 'falta la 081 en db/migraciones/');
  assert.equal(resolverHasta('081', NOMBRES), la081);
  assert.equal(resolverHasta('81', NOMBRES), la081);
  assert.equal(resolverHasta(la081, NOMBRES), la081);
  assert.equal(resolverHasta(`${la081}.sql`, NOMBRES), la081);

  assert.throws(() => resolverHasta('999', NOMBRES), /no existe la migración 999/);
  assert.throws(() => resolverHasta('081_otra_cosa', NOMBRES), /no existe la migración/);
  assert.throws(() => resolverHasta('0811', NOMBRES), /no existe la migración/);
  assert.throws(() => resolverHasta('007_', ['007_a', '007_b']), /no existe/, 'un prefijo del nombre no es el nombre');
  assert.equal(resolverHasta('007_b', ['007_a', '007_b']), '007_b');
  assert.throws(() => resolverHasta('7', ['007_a', '007_b']), /ambiguo/);
});

// ─── El plan ────────────────────────────────────────────────────────────────

const TODAS = ['001_a', '002_b', '003_c', '004_d', '005_e'];

test('el plan aplica las pendientes hasta el tope inclusive, y todas sin tope', () => {
  const sinTope = planear(TODAS, ['001_a'], null);
  assert.deepEqual(sinTope.aAplicar, ['002_b', '003_c', '004_d', '005_e']);
  assert.equal(sinTope.hasta, null);

  const conTope = planear(TODAS, ['001_a'], '3');
  assert.deepEqual(conTope.aAplicar, ['002_b', '003_c']);
  assert.deepEqual(conTope.pendientes, ['002_b', '003_c', '004_d', '005_e']);
  assert.equal(conTope.hasta, '003_c');

  assert.deepEqual(planear(TODAS, [], '001_a').aAplicar, ['001_a']);
});

test('el plan no vuelve atrás: un tope ya aplicado es un no-op si es el último, y un error si quedó atrás', () => {
  assert.deepEqual(planear(TODAS, ['001_a', '002_b', '003_c'], '003').aAplicar, []);
  assert.throws(() => planear(TODAS, ['001_a', '002_b', '003_c'], '002'), /no vuelve atrás/);
  assert.throws(() => planear(TODAS, ['001_a', '002_b', '003_c'], '001_a'), /no vuelve atrás/);
});

test('el plan se niega con la contabilidad desordenada o con aplicadas que no están en los archivos', () => {
  assert.throws(() => planear(TODAS, ['001_a', '003_c'], null), /pendientes anteriores/);
  assert.throws(() => planear(TODAS, ['001_a', '009_z'], '002'), /no están en db\/migraciones/);
  assert.throws(() => planear(TODAS, ['001_a'], '999'), /no existe la migración 999/);
});

// ─── El tope de espera por un candado ─────────────────────────────────────────

test('lock_timeout: 5 s por omisión, configurable, y nada que no sea una duración', () => {
  assert.equal(LOCK_TIMEOUT_POR_OMISION, '5s');
  assert.equal(topeDeEspera(undefined), '5s');
  assert.equal(topeDeEspera(''), '5s');
  assert.equal(topeDeEspera('10s'), '10s');
  assert.equal(topeDeEspera('500ms'), '500ms');
  assert.equal(topeDeEspera('0'), '0');
  for (const malo of ["5s'; drop role migrador; --", '5 segundos', '-1', 's']) {
    assert.throws(() => topeDeEspera(malo), /no es una duración/, `aceptó ${malo}`);
  }
});

test('cada migración corre con el lock_timeout puesto en su transacción, y con tope se usa migrateTo', () => {
  const fuente = sinComentarios(leer('lib/datos/migrador.ts'));
  const up = fuente.slice(fuente.indexOf('async up(db)'), fuente.indexOf('sql.raw(contenido)'));
  assert.match(up, /set_config\('lock_timeout',\s*\$\{tope\},\s*true\)/, 'el `up` no pone el lock_timeout antes del archivo');
  assert.match(fuente, /provider:\s*proveedorDe\(tope\)/, 'el Migrator no usa el proveedor con el tope');
  assert.match(fuente, /plan\.hasta !== null\s*\?\s*await migrator\.migrateTo\(plan\.hasta\)\s*:\s*await migrator\.migrateToLatest\(\)/);
  assert.match(fuente, /opciones\.alPlanear\?\.\(plan\)/, 'el plan no se entrega antes de aplicar');
  assert.ok(
    fuente.indexOf('opciones.alPlanear?.(plan)') < fuente.indexOf('migrator.migrateTo('),
    'el plan tiene que imprimirse ANTES de aplicar',
  );
});

/** `db.mjs migrar` con estos argumentos, contra una base inalcanzable: todo lo de acá tiene que fallar ANTES de conectar. */
function migrarCon(argumentos: string[], env: Record<string, string> = {}): { salida: number | null; texto: string } {
  const inalcanzable = 'postgresql://nadie:nadanadanadanada@127.0.0.1:1/nada';
  const r = spawnSync(process.execPath, [join(RAIZ, 'scripts', 'db.mjs'), 'migrar', ...argumentos], {
    cwd: RAIZ,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      DATABASE_URL_MIGRADOR: inalcanzable,
      DATABASE_URL_INQUILINO: inalcanzable,
      DATABASE_URL_IDENTIDAD: inalcanzable,
      DATABASE_URL_ADMIN: inalcanzable,
      ARIA_MIGRAR_LOCK_TIMEOUT: '',
      ...env,
    },
  });
  return { salida: r.status, texto: `${r.stdout}${r.stderr}` };
}

test('`db.mjs migrar` lee sus argumentos y se niega antes de conectarse', () => {
  const noExiste = migrarCon(['--hasta', '999']);
  assert.equal(noExiste.salida, 1, noExiste.texto);
  assert.match(noExiste.texto, /no existe la migración 999/);

  const raro = migrarCon(['--hast', '081']);
  assert.equal(raro.salida, 1, raro.texto);
  assert.match(raro.texto, /migrar no entiende/);

  const tope = migrarCon(['--hasta', '081'], { ARIA_MIGRAR_LOCK_TIMEOUT: 'cinco' });
  assert.equal(tope.salida, 1, tope.texto);
  assert.match(tope.texto, /no es una duración/);
});

// ─── El 008: los tres roles del modelo, sin marcas ─────────────────────────────

const ROLES_DEL_MODELO = ['app_analista', 'app_ingesta', 'ingestor'];
const OCHO = 'db/arranque/008_los_roles_del_modelo.sql';

test('el 008 no tiene marcas, ni en los comentarios: `supabase.mjs correr` rechaza el archivo entero', () => {
  // `scripts/supabase.mjs` mira el texto CRUDO, comentarios incluidos.
  assert.deepEqual(leer(OCHO).match(/@[A-Z_]+@/g), null);
  assert.match(sinComentarios(leer('scripts/supabase.mjs')), /sql\.match\(\/@\[A-Z_\]\+@\/g\)/, 'cambió el freno de supabase.mjs');
});

test('el 008 crea sólo los tres roles, sin login, sin herencia, sin omitir RLS y sin contraseña', () => {
  const sql = sqlSinComentarios(leer(OCHO)).toLowerCase();

  const creados = [...sql.matchAll(/\bcreate\s+role\s+(\w+)([^;]*);/g)];
  assert.deepEqual(creados.map((m) => m[1]).sort(), ROLES_DEL_MODELO);
  for (const m of creados) {
    const atributos = (m[2] ?? '').trim().split(/\s+/).sort();
    assert.deepEqual(atributos, ['nobypassrls', 'noinherit', 'nologin'], `${m[1]}: ${m[2]}`);
  }

  const tocados = [...sql.matchAll(/\balter\s+role\s+(\w+)/g)].map((m) => m[1]);
  assert.ok(tocados.length >= 3, 'falta el `alter role … nologin` de los tres');
  assert.deepEqual([...new Set(tocados)].sort(), ROLES_DEL_MODELO, 'el 008 toca un rol que no es del modelo');
  for (const r of ROLES_DEL_MODELO) assert.match(sql, new RegExp(`\\balter\\s+role\\s+${r}\\s+nologin\\s*;`));

  assert.doesNotMatch(sql, /\bpassword\b/, 'el 008 no fija contraseñas');
  assert.doesNotMatch(sql, /(^|[^o])\blogin\b/m, 'un rol del modelo con login');
  assert.doesNotMatch(sql, /\b(grant|revoke|drop)\b/, 'el 008 sólo crea y comprueba roles');
  assert.doesNotMatch(sql, /\b(migrador|app_inquilino|app_identidad|postgres)\b/, 'el 008 nombra un rol que no es suyo');

  // Y la comprobación de atributos, que aborta en vez de imponer.
  assert.match(sql, /rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication or rolcanlogin/);
  assert.match(sql, /where rolname in \('ingestor', 'app_ingesta', 'app_analista'\)/);
  assert.match(sql, /raise exception/);
});

test('una sola copia: el 000 ya no crea los tres roles y `db.mjs arranque` corre el 008 en la misma query', () => {
  const cero = sqlSinComentarios(leer('db/arranque/000_cluster.sql')).toLowerCase();
  for (const r of ROLES_DEL_MODELO) {
    assert.doesNotMatch(cero, new RegExp(`\\b${r}\\b`), `el 000 vuelve a nombrar ${r}: dos copias divergen`);
  }

  const db = sinComentarios(leer('scripts/db.mjs'));
  const arranque = db.slice(db.indexOf('async function arranque()'), db.indexOf('async function catalogo()'));
  assert.match(arranque, /008_los_roles_del_modelo\.sql/, '`db.mjs arranque` no corre el 008');
  assert.match(arranque, /await cliente\.query\(`\$\{sql\}\\n\$\{modelo\}`\)/, 'el 000 y el 008 no van en la misma query');

  const despacho = db.slice(db.indexOf('const comando = process.argv[2]'));
  assert.match(despacho, /comando === 'migrar'\) await migrar\(process\.argv\.slice\(3\)\)/, '`migrar` no recibe sus argumentos');
});
