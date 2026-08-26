// ADR-0002, ADR-0003 — La base se levanta desde cero desde artefactos versionados,
// y siembra las organizaciones de desarrollo.
//
// La base, desde cero, con un comando.
//
//   node scripts/db.mjs reset       bajar + levantar + arranque + migrar + sembrar + verificar
//   node scripts/db.mjs levantar    el contenedor, y esperar a que esté sano
//   node scripts/db.mjs bajar       el contenedor y su volumen
//   node scripts/db.mjs arranque    los tres roles y sus rutas de búsqueda (superusuario)
//   node scripts/db.mjs catalogo    capacidades, roles y reparto (superusuario, tras migrar)
//   node scripts/db.mjs retiro      retira los roles que salieron del catálogo (`app_identidad`)
//   node scripts/db.mjs migrar      las migraciones, como `migrador`
//   node scripts/db.mjs sembrar     tres organizaciones, por `conIdentidad()`
//   node scripts/db.mjs verificar   cuenta filas CONTRA LA BASE
//
// `reset` imprime QUÉ FASES COMPLETÓ, nunca un "listo" liso. Escribe en dos
// dominios con dos conexiones —migraciones como `migrador`, sembrado como
// `app_identidad`— y entre dominios NO HAY ATOMICIDAD (09 § 6): una mitad puede
// confirmar y la otra fallar. Es aceptable porque es idempotente por destrucción
// (tira la base primero, así que una falla a medias se arregla volviendo a correrlo)
// y porque `verificar` es una fase aparte que comprueba el efecto, no la ausencia de
// error.
//
// ── Y EL LÍMITE DE ESE RAZONAMIENTO ─────────────────────────────────────
//
// "Idempotente por destrucción" vale SOLO para el contenedor local. Contra un
// proveedor administrado, `bajar` no destruye nada remoto, así que `reset` pasa a
// ser `arranque + migrar + catalogo + sembrar` sobre estado ACUMULADO — y con eso desaparece
// justo la propiedad que hacía aceptable la falta de atomicidad entre dominios.
//
// Por eso `bajar` ahora exige un anfitrión local, y con ella `reset` completo: es la
// primera fase de la lista, así que corta antes de que nada haya corrido. Las fases
// sueltas `arranque`, `migrar` y `catalogo` SÍ pueden correr contra el proveedor
// administrado:
// es como se despliega.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const CONTENEDOR = 'aria_base';

function compose(...args) {
  const r = spawnSync('docker', ['compose', ...args], { cwd: RAIZ, stdio: 'inherit' });
  if (r.error) throw new Error(`no se pudo ejecutar docker: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`docker compose ${args.join(' ')} salió ${r.status}`);
}

function estadoDeSalud() {
  const r = spawnSync(
    'docker',
    ['inspect', '--format', '{{.State.Health.Status}}', CONTENEDOR],
    { encoding: 'utf8' },
  );
  return r.status === 0 ? r.stdout.trim() : 'ausente';
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarSano({ intentos = 60, cada = 2000 } = {}) {
  for (let i = 1; i <= intentos; i += 1) {
    const s = estadoDeSalud();
    if (s === 'healthy') return i;
    if (s === 'ausente') throw new Error(`el contenedor ${CONTENEDOR} no existe`);
    await dormir(cada);
  }
  throw new Error(`el contenedor ${CONTENEDOR} no llegó a "healthy"`);
}

// El guard de anfitrión, para las fases que solo tienen sentido en local.
//
// La lista de anfitriones vive en `lib/datos/anfitrion.ts`, que es la misma que usan
// el sembrado y las pruebas. Se importa perezosamente porque este archivo corre
// fases que NO necesitan entorno de base (`levantar`), y un import arriba las haría
// depender de él.
async function exigirLocalParaFase(fase, porque) {
  const { exigirAnfitrionLocal } = await import('../lib/datos/anfitrion.ts');
  const url = process.env.DATABASE_URL_IDENTIDAD;
  if (!url) throw new Error('DATABASE_URL_IDENTIDAD no está definida.');
  exigirAnfitrionLocal(url, {
    quien: `la fase \`${fase}\``,
    porque,
    escotilla: 'ARIA_DB_FORZADO',
  });
}

// ── Fases ────────────────────────────────────────────────────────────────────

async function bajar() {
  // Este `docker compose down -v` no mira a dónde apunta el entorno, y ahí hay dos
  // sorpresas distintas: contra un proveedor administrado no baja NADA remoto —así
  // que `reset` deja de ser idempotente por destrucción, ver el encabezado— y de
  // paso se lleva la base local de alguien que creía estar operando la remota.
  await exigirLocalParaFase('bajar', 'destruye el contenedor local y su volumen.');
  // `-v` se lleva el volumen anónimo: la base muere de verdad.
  compose('down', '-v', '--remove-orphans');
}

async function levantar() {
  compose('up', '-d');
  const vueltas = await esperarSano();
  console.log(`  contenedor sano (tras ${vueltas} comprobación/es)`);
}

const CLAVES = {
  '@CLAVE_MIGRADOR@': 'DATABASE_URL_MIGRADOR',
  '@CLAVE_INQUILINO@': 'DATABASE_URL_INQUILINO',
  '@CLAVE_IDENTIDAD@': 'DATABASE_URL_IDENTIDAD',
};

function claveDesdeUrl(nombreVariable) {
  const url = process.env[nombreVariable];
  if (!url) throw new Error(`${nombreVariable} no está definida.`);
  let clave;
  try {
    clave = decodeURIComponent(new URL(url).password);
  } catch {
    throw new Error(`${nombreVariable} no es una URL válida.`);
  }
  // Validación de conjunto de caracteres además del citado. El citado es lo que
  // protege; esto es para que una contraseña rara falle acá y no en un error de
  // sintaxis de PostgreSQL a mitad del arranque.
  if (!/^[\x21-\x7e]{16,}$/.test(clave)) {
    throw new Error(
      `la contraseña de ${nombreVariable} tiene que ser 16+ caracteres ASCII imprimibles ` +
        'sin espacios. Generá unas con `node scripts/credenciales.mjs`.',
    );
  }
  return clave;
}

async function arranque() {
  // Los roles son objetos del CLÚSTER: los crea el superusuario, no `migrador`.
  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
  if (!process.env.DATABASE_URL_ADMIN) throw new Error('DATABASE_URL_ADMIN no está definida.');
  await cliente.connect();
  try {
    let sql = readFileSync(new URL('../db/arranque/000_cluster.sql', import.meta.url), 'utf8')
      .replace(/\r\n/g, '\n');

    for (const [marca, variable] of Object.entries(CLAVES)) {
      if (!sql.includes(marca)) throw new Error(`falta la marca ${marca} en 000_cluster.sql`);
      // `escapeLiteral` del propio controlador. `alter role … password $1` NO acepta
      // parámetros —la misma limitación que `SET` que el 08 § 1 documenta para
      // `set_config`— así que hay que citar. Nunca una contraseña literal en el archivo.
      sql = sql.replaceAll(marca, cliente.escapeLiteral(claveDesdeUrl(variable)));
    }

    // El nombre de la base, citado como IDENTIFICADOR (no como literal): sale de la
    // cadena de conexión, así que el archivo no queda atado al contenedor local.
    const base = decodeURIComponent(new URL(process.env.DATABASE_URL_ADMIN).pathname).replace(/^\//, '');
    if (!base) throw new Error('DATABASE_URL_ADMIN no nombra una base de datos.');
    sql = sql.replaceAll('@BASE@', cliente.escapeIdentifier(base));

    const restantes = sql.match(/@[A-Z_]+@/g);
    if (restantes) throw new Error(`marcas sin reemplazar: ${[...new Set(restantes)].join(', ')}`);

    await cliente.query(sql);
    console.log('  tres roles, rutas de búsqueda, pgcrypto y permisos de esquema');
  } finally {
    await cliente.end();
  }
}

/**
 * El catálogo de capacidades, los roles de sistema y el reparto.
 *
 * Va en una fase PROPIA y no dentro de `arranque()` por una razón de orden que no es
 * opinable: `arranque` corre ANTES de `migrar`, y `identidad.permisos` todavía no existe.
 * Y no va dentro de una migración porque esa tabla tiene el forzado de RLS sin política
 * para `migrador`, así que un `insert` desde ahí es rechazado — es lo que rompe
 * `009_fundaciones`. El motivo completo, con las siete salidas medidas y por qué se
 * descartó cada una, está en el encabezado de `db/arranque/001_catalogo.sql`.
 *
 * Corre con `DATABASE_URL_ADMIN` —la misma credencial que `arranque`— porque es la única
 * que omite RLS. En Supabase ese rol es `postgres` por la Management API.
 */
async function catalogo() {
  if (!process.env.DATABASE_URL_ADMIN) throw new Error('DATABASE_URL_ADMIN no está definida.');

  // ── PRIMERO el privilegio, y lo otorga el DUEÑO ────────────────────────────
  //
  // `identidad.permisos` tiene el forzado de RLS, así que hacen falta DOS cosas para
  // escribirla: privilegio de inserción y exención de las políticas. Están repartidas en
  // dos roles distintos, y el único que puede otorgar es el dueño — `migrador`. El
  // razonamiento completo está en `db/arranque/002_escritura_del_catalogo.sql`.
  //
  // En local esto es un no-op —el rol de arranque es superusuario de verdad y salta las
  // dos comprobaciones— y se corre igual, a propósito: que el camino local y el de
  // producción tengan la MISMA forma es lo que hace que `db:reset` pruebe este archivo. Un
  // paso que solo existe en producción es un paso que nadie prueba.
  if (!process.env.DATABASE_URL_MIGRADOR) throw new Error('DATABASE_URL_MIGRADOR no está definida.');
  const rolDelCatalogo = decodeURIComponent(new URL(process.env.DATABASE_URL_ADMIN).username);
  if (!rolDelCatalogo) throw new Error('DATABASE_URL_ADMIN no nombra un usuario.');

  const dueno = new pg.Client({ connectionString: process.env.DATABASE_URL_MIGRADOR });
  await dueno.connect();
  try {
    let permiso = readFileSync(
      new URL('../db/arranque/002_escritura_del_catalogo.sql', import.meta.url),
      'utf8',
    ).replace(/\r\n/g, '\n');
    // Como IDENTIFICADOR, no como literal: es un nombre de rol.
    permiso = permiso.replaceAll('@ROL_DEL_CATALOGO@', dueno.escapeIdentifier(rolDelCatalogo));
    const marcas = permiso.match(/@[A-Z_]+@/g);
    if (marcas) throw new Error(`marcas sin reemplazar: ${[...new Set(marcas)].join(', ')}`);
    await dueno.query(permiso);
    console.log(`  privilegio de escritura del catálogo para \`${rolDelCatalogo}\``);
  } finally {
    await dueno.end();
  }

  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
  await cliente.connect();
  try {
    const sql = readFileSync(
      new URL('../db/arranque/001_catalogo.sql', import.meta.url),
      'utf8',
    ).replace(/\r\n/g, '\n');

    // Sin marcas que sustituir: no lleva contraseñas ni el nombre de la base. Si alguien
    // agrega una, esto lo dice en vez de mandar `@MARCA@` al motor.
    const marcas = sql.match(/@[A-Z_]+@/g);
    if (marcas) throw new Error(`001_catalogo.sql tiene marcas y esta fase no sustituye ninguna: ${[...new Set(marcas)].join(', ')}`);

    await cliente.query(sql);
    console.log('  catálogo de capacidades, roles de sistema y reparto');
  } finally {
    await cliente.end();
  }

  // ── Y EL RETIRO, CON UNA TERCERA CONEXIÓN ──────────────────────────────────
  //
  // Tres conexiones en una fase parece de más, y cada una está por una razón distinta que el
  // archivo que corre explica: el DUEÑO otorga privilegios, el rol del CATÁLOGO escribe
  // capacidades y roles, e IDENTIDAD retira roles y reasigna a su gente.
  //
  // Va DESPUÉS del catálogo porque necesita que el rol destino ya exista — y si no existe, ese
  // archivo se niega a borrar nada en vez de dejar gente sin acceso.
  await retiro();
}

/**
 * El retiro de los roles que salieron del catálogo. **Corre como `app_identidad`.**
 *
 * ── POR QUÉ ES UNA FASE SUELTA Y NO SOLO EL FINAL DE `catalogo` ──────────────
 *
 * Porque contra Supabase `catalogo` **no se puede correr**: exige `DATABASE_URL_ADMIN`, y la
 * contraseña de `postgres` no vive en ninguna máquina de acá a propósito (`docs/DESPLIEGUE.md`
 * § 2). Allá el catálogo se manda por la Management API:
 *
 *     node --env-file=.env.supabase scripts/supabase.mjs correr --archivo db/arranque/001_catalogo.sql
 *     node --env-file=.env.supabase scripts/db.mjs retiro
 *
 * Y el retiro es el único de los tres pasos que ESE camino no puede hacer, porque no es un
 * problema de privilegio sino de política: `migrador`, el rol del catálogo y `postgres` no
 * tienen política sobre `identidad.usuarios_roles`, así que con cualquiera de ellos el retiro
 * afectaría **cero filas y reportaría éxito**, dejando a alguien sin ningún rol. Medido y
 * escrito en el encabezado de `003_retiro_de_roles.sql`:
 *
 *     migrador → select count(*) from identidad.usuarios_roles  →  0 filas
 *
 * Sin esta fase, el paso quedaba viviendo en la cabeza de quien despliega — y un paso que solo
 * existe en producción es un paso que nadie prueba. Acá corre en las dos partes: `catalogo` la
 * llama en local, y en Supabase se la invoca sola.
 */
async function retiro() {
  if (!process.env.DATABASE_URL_IDENTIDAD) throw new Error('DATABASE_URL_IDENTIDAD no está definida.');
  const identidad = new pg.Client({ connectionString: process.env.DATABASE_URL_IDENTIDAD });
  await identidad.connect();
  try {
    const sql = readFileSync(
      new URL('../db/arranque/003_retiro_de_roles.sql', import.meta.url),
      'utf8',
    ).replace(/\r\n/g, '\n');
    const marcas = sql.match(/@[A-Z_]+@/g);
    if (marcas) throw new Error(`003_retiro_de_roles.sql tiene marcas sin sustituir: ${[...new Set(marcas)].join(', ')}`);

    // Los `raise notice` del archivo son lo único que cuenta qué se movió. Sin esto se
    // pierden, y una reasignación de accesos que no deja rastro es una que nadie puede
    // revisar después.
    identidad.on('notice', (n) => console.log(`  ${n.message}`));
    await identidad.query(sql);
    console.log('  roles retirados y su gente reasignada');
  } finally {
    await identidad.end();
  }
}

async function migrar() {
  const { migrar: aplicar } = await import('../lib/datos/migrador.ts');
  const { aplicadas } = await aplicar();
  if (aplicadas.length === 0) console.log('  nada que aplicar (ya estaba al día)');
  for (const m of aplicadas) console.log(`  aplicada ${m}`);
}

async function sembrar() {
  const { sembrar: poblar } = await import('../db/sembrado/organizaciones.ts');
  const r = await poblar();
  for (const c of r.creadas) console.log(`  creada ${c}`);
  if (r.creadas.length === 0) console.log('  nada que crear (ya estaba sembrada)');
  console.log(`  ${r.organizaciones} organizaciones, ${r.usuarios} usuarios, ${r.asignaciones} asignaciones, ${r.control} filas de control`);
}

/**
 * Contra la base, no contra el código.
 *
 * EJECUCION § 6: "Nada se marca como terminado sin verificarlo contra la base.
 * Abrir la base, contar filas, y comparar con lo que muestra la pantalla. Los
 * defectos de esta familia no se encuentran leyendo código."
 */
async function verificar() {
  const fallos = [];

  // Como el rol REAL de la aplicación. Con el propietario "casi nada de esto se
  // manifiesta y todo se ve perfecto" (09 § 1).
  const identidad = new pg.Client({ connectionString: process.env.DATABASE_URL_IDENTIDAD });
  await identidad.connect();
  try {
    const orgs = await identidad.query('select count(*)::int as n from identidad.organizaciones');
    const usuarios = await identidad.query('select count(*)::int as n from identidad.usuarios');
    const porOrg = await identidad.query(
      'select org_id, count(*)::int as n from identidad.usuarios group by org_id',
    );
    const nOrgs = orgs.rows[0]?.n ?? 0;
    const nUsuarios = usuarios.rows[0]?.n ?? 0;
    console.log(`  app_identidad ve ${nOrgs} organizaciones y ${nUsuarios} usuarios`);
    // CINCO organizaciones: las tres de desarrollo más las dos de control de la sonda,
    // que el sembrado crea por el mismo camino que `scripts/arranque.mjs` en producción.
    // Y TRES usuarios: las de control no tienen ninguno, son infraestructura.
    if (nOrgs !== 5) fallos.push(`se esperaban 5 organizaciones, hay ${nOrgs}`);
    if (nUsuarios !== 3) fallos.push(`se esperaban 3 usuarios, hay ${nUsuarios}`);
    if (porOrg.rows.length !== 3 || porOrg.rows.some((f) => f.n !== 1)) {
      fallos.push('cada organización de desarrollo tiene que tener exactamente un usuario');
    }
  } finally {
    await identidad.end();
  }

  // La demostración POSITIVA de que `force row level security` está haciendo su
  // trabajo: el propietario de las tablas no ve una sola fila. Si esto devolviera
  // filas, el sembrado podría haber sido una migración — y no puede.
  const migrador = new pg.Client({ connectionString: process.env.DATABASE_URL_MIGRADOR });
  await migrador.connect();
  try {
    const r = await migrador.query('select count(*)::int as n from identidad.organizaciones');
    const n = r.rows[0]?.n ?? -1;
    console.log(`  migrador (propietario, forzado) ve ${n} organizaciones`);
    if (n !== 0) fallos.push(`migrador ve ${n} organizaciones: el forzado de RLS no está puesto`);
  } finally {
    await migrador.end();
  }

  // ── El dominio del INQUILINO, por el camino real ──────────────────────────
  //
  // No con una conexión de conveniencia: por `conOrganizacion()`, que es lo que va a
  // usar la aplicación. El 09 § 1 lo dice de la forma más útil: "correr estas
  // comprobaciones con el rol propietario las hace pasar todas SIN QUE NADA ESTÉ
  // PROTEGIDO".
  const { conOrganizacion, datos } = await import('../lib/datos/contexto.ts');
  const { conIdentidad, cerrarClientes } = await import('../lib/datos/capa.ts');
  try {
    const orgs = await conIdentidad(async (db) =>
      db.selectFrom('organizaciones').select(['id', 'slug']).orderBy('slug').execute(),
    );

    // Lo que cada organización ve, y de quién es cada fila.
    const visto = new Map();
    for (const org of orgs) {
      const filas = await conOrganizacion(org.id, async () =>
        datos().selectFrom('control_aislamiento').select(['org_id', 'marca']).execute(),
      );
      visto.set(org.slug, filas);
      const ajenas = filas.filter((f) => f.org_id !== org.id);
      console.log(`  ${org.slug}: ve ${filas.length} fila(s) de control, ${ajenas.length} ajena(s)`);
      // LA comprobación. Una fila ajena acá es la fuga que todo el diseño existe para
      // impedir — y no lanzaría ninguna excepción por sí sola.
      if (ajenas.length > 0) {
        fallos.push(`${org.slug} ve ${ajenas.length} fila(s) de otra organización`);
      }
    }

    // Y la guarda contra el falso verde: si NINGUNA organización tiene filas, "nadie ve
    // filas ajenas" es cierto y vacío a la vez.
    const conFilas = [...visto.values()].filter((f) => f.length > 0).length;
    if (conFilas < 2) {
      fallos.push(
        `solo ${conFilas} organización(es) tiene(n) filas de control: ` +
          'con menos de dos, el aislamiento no es comprobable',
      );
    }
  } finally {
    await cerrarClientes();
  }

  if (fallos.length > 0) {
    for (const f of fallos) console.error(`  FALLA: ${f}`);
    throw new Error(`${fallos.length} comprobación/es contra la base fallaron`);
  }
}

// ── Despacho ─────────────────────────────────────────────────────────────────

// `retiro` está en la lista pero NO en `RESET`: `catalogo` ya la llama, y correrla dos veces
// seguidas no rompe nada —es idempotente— pero repetir un paso en la secuencia hace creer que
// hace falta dos veces. Se invoca sola contra Supabase, donde `catalogo` no puede correr.
const FASES = { bajar, levantar, arranque, migrar, catalogo, retiro, sembrar, verificar };
// `catalogo` va DESPUÉS de `migrar`: escribe en tablas que las migraciones crean.
const RESET = ['bajar', 'levantar', 'arranque', 'migrar', 'catalogo', 'sembrar', 'verificar'];

const comando = process.argv[2];
const completadas = [];

try {
  if (comando === 'reset') {
    for (const nombre of RESET) {
      console.log(`\n[${nombre}]`);
      await FASES[nombre]();
      completadas.push(nombre);
    }
    console.log(`\nreset completo. Fases: ${completadas.join(' → ')}`);
  } else if (comando && Object.hasOwn(FASES, comando)) {
    console.log(`[${comando}]`);
    await FASES[comando]();
    console.log(`\n${comando}: hecho`);
  } else {
    console.error(`Uso: node scripts/db.mjs <${['reset', ...Object.keys(FASES)].join('|')}>`);
    process.exit(1);
  }
} catch (e) {
  // Nunca un "listo" liso: se dice qué fases completaron y en cuál se cortó.
  if (completadas.length > 0) console.error(`\nfases completadas: ${completadas.join(' → ')}`);
  console.error(`\nFALLÓ en "${comando}": ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
