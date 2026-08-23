// Las comprobaciones que solo tienen sentido contra el proveedor administrado.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ NO ES UN ARCHIVO DE `pruebas/`
//
// La suite corre contra el contenedor local y va a seguir así: escribe y borra, y
// `lib/datos/anfitrion.ts` se niega a dejarla correr contra un proveedor administrado. Esto es
// lo complementario: lo que el contenedor NO puede verificar porque depende de la
// infraestructura real —el agrupador, la versión del motor, los permisos del clúster ajeno.
//
// Es de SOLO LECTURA, así que se puede correr contra producción cuando haga falta:
//
//   node --env-file=.env.supabase scripts/compatibilidad.mjs
//
// Sale con código 1 si algo falla, para que sirva en una tarea programada.
//
// ── Y POR QUÉ LAS LECTURAS DE NEGOCIO VAN POR EL CAMINO REAL ─────────────────
//
// Las comprobaciones de aislamiento usan `conOrganizacion()` y `datos()`, no un `set_config` a
// mano. Dos razones, y la segunda es la buena:
//
//   · `ADR-0201` exige que la variable de la organización se ponga en UN solo lugar, y agregar
//     una excepción para un guion de verificación debilitaría justo la invariante que este
//     guion existe para confirmar.
//   · `conOrganizacion()` ya hace una LECTURA DE VUELTA y lanza si la variable no quedó puesta.
//     Así que llamarla y que no lance prueba MÁS que comparar dos cadenas: prueba el camino
//     real con su guarda, que es lo único que va a correr en producción.
//
// Las conexiones crudas de `pg` quedan solo para inspección de catálogo y para comprobar que
// las fronteras entre dominios LANZAN — cosas que por definición no pasan por la capa de datos.
// ═══════════════════════════════════════════════════════════════════════════════

import pg from 'pg';
import { urlDe } from '../lib/datos/entorno.ts';
import { conOrganizacion, datos } from '../lib/datos/contexto.ts';
import { cerrarClientes } from '../lib/datos/capa.ts';

const fallos = [];
const oks = [];

function comprobar(nombre, condicion, detalle = '') {
  if (condicion) oks.push(nombre);
  else fallos.push(`${nombre}${detalle ? ' — ' + detalle : ''}`);
}

async function conectar(rol) {
  const c = new pg.Client({ connectionString: urlDe(rol), connectionTimeoutMillis: 15_000 });
  await c.connect();
  return c;
}

const inq = await conectar('inquilino');
const ident = await conectar('identidad');
const mig = await conectar('migrador');

try {
  // ── 1 · La versión mayor coincide con la del contenedor local ──────────────
  const v = (await mig.query('select current_setting($1) as v', ['server_version_num'])).rows[0].v;
  const mayor = Math.floor(Number(v) / 10000);
  comprobar(
    `la versión mayor es 17 (medida: ${mayor})`,
    mayor === 17,
    'si cambió, `docker-compose.yml` tiene que seguirla o la suite prueba otra cosa',
  );

  // ── 2 · Ningún rol nuestro puede evadir las políticas ─────────────────────
  const roles = (
    await mig.query(
      `select rolname, rolsuper, rolbypassrls from pg_roles
        where rolname in ('migrador','app_inquilino','app_identidad') order by 1`,
    )
  ).rows;
  comprobar('los tres roles existen', roles.length === 3, `hay ${roles.length}`);
  for (const r of roles) {
    comprobar(`\`${r.rolname}\` no es superusuario`, r.rolsuper === false);
    comprobar(`\`${r.rolname}\` no omite RLS`, r.rolbypassrls === false);
  }

  // ── 3 · Sin contexto, el inquilino no ve NADA de negocio ───────────────────
  const sinContexto = (await inq.query('select count(*)::int as n from negocio.control_aislamiento'))
    .rows[0].n;
  comprobar(
    'sin la variable puesta, el inquilino ve CERO filas de negocio',
    sinContexto === 0,
    `vio ${sinContexto}`,
  );

  // ── 4 · La variable SOBREVIVE por el agrupador, y el aislamiento se aplica ─
  //
  // Es LA comprobación que el contenedor no puede hacer: con Supavisor en modo sentencia la
  // variable no sobreviviría y todo el aislamiento se caería en silencio.
  const orgs = (
    await ident.query(
      `select id, slug from identidad.organizaciones where slug like 'control-%' order by slug`,
    )
  ).rows;
  comprobar('las dos organizaciones de control existen', orgs.length === 2, `hay ${orgs.length}`);

  for (const o of orgs) {
    let filas;
    try {
      filas = await conOrganizacion(o.id, async () =>
        datos().selectFrom('control_aislamiento').select('org_id').execute(),
      );
    } catch (e) {
      comprobar(
        `\`${o.slug}\`: la variable de transacción sobrevive por el agrupador`,
        false,
        String(e.message).slice(0, 200),
      );
      continue;
    }
    comprobar(`\`${o.slug}\`: la variable sobrevive por el agrupador`, true);
    comprobar(`\`${o.slug}\` ve al menos una fila propia`, filas.length > 0, 'no vio ninguna');
    comprobar(
      `\`${o.slug}\` no ve NI UNA fila ajena`,
      filas.every((f) => f.org_id === o.id),
      `vio ${filas.filter((f) => f.org_id !== o.id).length} ajena(s)`,
    );
  }

  // ── 5 · Y muere al salir del contexto ─────────────────────────────────────
  const despues = (await inq.query('select count(*)::int as n from negocio.control_aislamiento'))
    .rows[0].n;
  comprobar(
    'al salir del contexto el inquilino vuelve a ver CERO: la variable murió',
    despues === 0,
    `vio ${despues}`,
  );

  // ── 6 · Las fronteras entre dominios ──────────────────────────────────────
  let identFallo = false;
  try {
    await ident.query('select 1 from negocio.control_aislamiento limit 1');
  } catch {
    identFallo = true;
  }
  comprobar('`app_identidad` LANZA al tocar una tabla de negocio', identFallo);

  let inqFallo = false;
  try {
    await inq.query('select 1 from identidad.sesiones limit 1');
  } catch {
    inqFallo = true;
  }
  comprobar('`app_inquilino` LANZA al tocar una tabla de identidad pura', inqFallo);

  // ── 7 · El propietario NO ve filas: el forzado está puesto ────────────────
  const comoMigrador = (await mig.query('select count(*)::int as n from identidad.organizaciones'))
    .rows[0].n;
  comprobar(
    '`migrador` (propietario) ve CERO organizaciones: `force row level security` está puesto',
    comoMigrador === 0,
    `vio ${comoMigrador}`,
  );

  // ── 8 · LA AFIRMACIÓN QUE PRUEBA LA CONVIVENCIA ───────────────────────────
  const nuestrasEnPublic = (
    await mig.query(
      `select c.relname from pg_class c
        where c.relnamespace='public'::regnamespace and c.relkind in ('r','p')
          and c.relowner = 'migrador'::regrole`,
    )
  ).rows;
  comprobar(
    'NINGUNA tabla nuestra vive en `public`',
    nuestrasEnPublic.length === 0,
    `hay ${nuestrasEnPublic.length}: ${nuestrasEnPublic.map((x) => x.relname).join(', ')}`,
  );

  const permisosAjenos = (
    await mig.query(
      `select c.relname from pg_class c
        where c.relnamespace='public'::regnamespace and c.relkind='r'
          and array_to_string(c.relacl,',') ~ '(migrador|app_inquilino|app_identidad)'`,
    )
  ).rows;
  comprobar(
    'ninguna tabla de `public` recibió permisos nuestros',
    permisosAjenos.length === 0,
    `${permisosAjenos.length}: ${permisosAjenos.map((x) => x.relname).join(', ')}`,
  );

  // ── 9 · La ruta de búsqueda por rol quedó puesta ──────────────────────────
  //
  // Es donde muerde la advertencia de Supabase de que `SET search_path` no sobrevive en
  // conexiones agrupadas: su propia solución es ponerlo a nivel de rol, que es lo que hace el
  // arranque. Si esto falla, el código empieza a resolver tablas en el esquema equivocado.
  for (const [rol, cliente, esperada] of [
    ['app_inquilino', inq, 'negocio, identidad'],
    ['app_identidad', ident, 'identidad'],
  ]) {
    const r = (await cliente.query(`select current_setting('search_path') as p`)).rows[0].p;
    comprobar(`la ruta de búsqueda de \`${rol}\` es "${esperada}"`, r === esperada, `es "${r}"`);
  }
} finally {
  await Promise.all([inq.end(), ident.end(), mig.end()].map((p) => p.catch(() => {})));
  // Los agrupadores de `lib/datos/capa.ts`, o el proceso queda colgado.
  await cerrarClientes().catch(() => {});
}

console.log(`\n${oks.length} comprobación(es) OK`);
for (const o of oks) console.log(`  ok   ${o}`);
if (fallos.length > 0) {
  console.error(`\n${fallos.length} FALLO(S):`);
  for (const f of fallos) console.error(`  FALLA ${f}`);
  process.exit(1);
}
console.log('\nTodo en orden contra el proveedor administrado.');
