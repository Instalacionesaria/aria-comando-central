// ADR-0002 — "Las migraciones son versionadas y se aplican igual en todos lados."
// Tipo: Base + Catálogo. INNEGOCIABLE (⛔).
//
// Y también, adelantadas de la Etapa 1 porque las dos tablas de identidad ya existen
// y así estas pruebas se escriben UNA vez y crecen solas con las otras ocho:
//   ADR-0107 — toda tabla con seguridad de fila activada, forzada y con política
//   ADR-0108 — y además accesible para el rol que la usa (por COLUMNA, ver la compuerta)
//   ADR-0109 — ninguna tabla quedó sin forzar
//   ADR-0110 — el esquema excluido de la prueba de RLS solo tiene lo declarado, y
//              ninguna de sus tablas lleva org_id. Reapuntada de `comun` a `public`,
//              porque EJECUCION § 2 y § 3 cierran que `comun` no se crea.
//
// Todo lo de acá corre conectando como `migrador`, y las comprobaciones de catálogo
// son las que "no se pueden engañar con un comentario y no se quedan viejas"
// (PRUEBAS § Los cinco tipos).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, unaFila, filas } from '../apoyo/conexiones.ts';
import { archivosFuente, archivosQueContienen, RAIZ } from '../apoyo/fuente.ts';
import {
  archivosDeMigracion,
  ESQUEMA_CONTABILIDAD,
  TABLA_APLICADAS,
  TABLA_CANDADO,
  migrar,
  revisarMigraciones,
} from '../../lib/datos/migrador.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

let mig: Client;

before(async () => {
  mig = await conectar('migrador');
});

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

// ─── La conexión ────────────────────────────────────────────────────────────

test('las migraciones corren como `migrador`, sin superusuario', async () => {
  const f = await unaFila<{ usuario: string; sesion: string; superusuario: string }>(
    mig,
    `select current_user as usuario, session_user as sesion,
            current_setting('is_superuser') as superusuario`,
  );
  assert.equal(f?.usuario, 'migrador');
  assert.equal(f?.sesion, 'migrador');
  // Con superusuario, `force row level security` no lo alcanzaría y el aislamiento
  // se vería perfecto sin estar puesto.
  assert.equal(f?.superusuario, 'off');
});

test('los tres roles existen, sin superusuario y sin omisión de RLS', async () => {
  const r = await filas<{
    rolname: string;
    rolsuper: boolean;
    rolbypassrls: boolean;
    rolcanlogin: boolean;
  }>(
    mig,
    `select rolname, rolsuper, rolbypassrls, rolcanlogin
       from pg_roles
      where rolname in ('migrador', 'app_inquilino', 'app_identidad')
      order by rolname`,
  );
  assert.deepEqual(
    r.map((x) => x.rolname),
    ['app_identidad', 'app_inquilino', 'migrador'],
  );
  for (const rol of r) {
    // Si el rol de la aplicación puede saltear las políticas, la segunda capa
    // existe en el esquema y no protege de nada (08 § 1).
    assert.equal(rol.rolsuper, false, `${rol.rolname} es superusuario`);
    assert.equal(rol.rolbypassrls, false, `${rol.rolname} tiene bypassrls`);
    assert.equal(rol.rolcanlogin, true, `${rol.rolname} no puede iniciar sesión`);
  }
});

test('ningún rol es miembro de otro', async () => {
  // "Es una línea de SQL que revierte el diseño entero" (09 § 2). Una política
  // dirigida a un rol se aplica a todo rol que herede sus privilegios, y como las
  // políticas permisivas se combinan con O, un `grant app_identidad to
  // app_inquilino` haría que el inquilino vea TODAS las filas de TODAS las
  // organizaciones. En silencio, sin cambiar una sola política.
  const f = await unaFila<Record<string, boolean>>(
    mig,
    `select pg_has_role('app_inquilino', 'app_identidad', 'USAGE') as inq_identidad,
            pg_has_role('app_identidad', 'app_inquilino', 'USAGE') as ident_inquilino,
            pg_has_role('app_inquilino', 'migrador',      'USAGE') as inq_migrador,
            pg_has_role('app_identidad', 'migrador',      'USAGE') as ident_migrador`,
  );
  assert.ok(f);
  for (const [nombre, valor] of Object.entries(f)) {
    assert.equal(valor, false, `herencia detectada: ${nombre}`);
  }
});

// ─── Los esquemas ───────────────────────────────────────────────────────────

test('los esquemas son exactamente identidad, negocio y public — `comun` NO existe', async () => {
  const r = await filas<{ nspname: string }>(
    mig,
    `select nspname from pg_namespace
      where nspname not like 'pg\\_%' and nspname <> 'information_schema'
      order by nspname`,
  );
  const nombres = r.map((x) => x.nspname);
  // Un esquema nuevo ROMPE la suite. Es deliberado: el 09 § 6 nombra la ruta de
  // búsqueda mal puesta como el mecanismo por el que una tabla nace en el esquema
  // equivocado, y sin esta afirmación una tabla podría nacer fuera del régimen.
  assert.deepEqual(nombres, ['identidad', 'negocio', 'public']);
  assert.ok(!nombres.includes('comun'), 'EJECUCION § 2 y § 3: el esquema `comun` no se crea');
});

test('`public` solo tiene la contabilidad de migraciones, y ninguna tabla con org_id', async () => {
  // Es la fila de PRUEBAS Etapa 1 que el 09 § 4 escribió para el esquema de
  // catálogos —"la más valiosa del documento entero"— RETARGETEADA.
  //
  // Sin `comun`, el agujero por exclusión se muda a `public`, que siempre existe y
  // que es donde tiene que vivir la contabilidad de las migraciones. El valor de la
  // fila nunca fue `comun`: era *el esquema que la prueba de RLS excluye*.
  const tablas = await filas<{ relname: string }>(
    mig,
    `select c.relname from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p')
       order by c.relname`,
  );
  assert.deepEqual(
    tablas.map((t) => t.relname).sort(),
    [TABLA_APLICADAS, TABLA_CANDADO].sort(),
  );

  // Y la comprobación que importa de verdad: una tabla con columna de organización
  // acá sería una tabla de negocio SIN AISLAMIENTO, en el esquema equivocado.
  const conOrg = await filas<{ table_name: string }>(
    mig,
    `select table_name from information_schema.columns
       where table_schema = 'public' and column_name = 'org_id'`,
  );
  assert.deepEqual(conOrg, [], 'una tabla con org_id en `public` es una tabla de negocio sin aislar');
});

test('las tres rutas de búsqueda son las doctrinales y ninguna menciona `comun`', async () => {
  const r = await filas<{ rolname: string; setconfig: string[] }>(
    mig,
    `select r.rolname, s.setconfig
       from pg_db_role_setting s
       join pg_roles r on r.oid = s.setrole
      where s.setdatabase = 0
      order by r.rolname`,
  );
  const porRol = new Map(r.map((x) => [x.rolname, (x.setconfig ?? []).join(';')]));

  assert.match(porRol.get('app_inquilino') ?? '', /search_path=negocio,\s*identidad/);
  assert.match(porRol.get('app_identidad') ?? '', /search_path=identidad/);
  assert.match(porRol.get('migrador') ?? '', /search_path=identidad,\s*negocio/);

  for (const [rol, cfg] of porRol) {
    // Un `search_path` que nombra un esquema que no existe NO da error: se ignora
    // en silencio. Es peor que uno roto, porque documenta algo que no está.
    assert.ok(!cfg.includes('comun'), `${rol} todavía nombra \`comun\` en su search_path`);
  }
});

// ─── Los permisos por omisión ───────────────────────────────────────────────

test('la regla de permisos por omisión existe para `negocio` y nombra a `migrador`', async () => {
  // Una de las cuatro formas documentadas de que esto falle en silencio: "la regla
  // es por esquema. Si una migración crea un esquema nuevo, no hay regla que
  // aplique" (09 § 2). El síntoma es "permiso denegado" en la primera consulta a la
  // primera tabla nueva, ya desplegada.
  const r = await filas<{ nspname: string; tipo: string; acl: string }>(
    mig,
    `select n.nspname, a.defaclobjtype::text as tipo, array_to_string(a.defaclacl, ',') as acl
       from pg_default_acl a
       join pg_namespace n on n.oid = a.defaclnamespace
       join pg_roles r     on r.oid = a.defaclrole
      where r.rolname = 'migrador'
      order by n.nspname, a.defaclobjtype`,
  );

  const tablas = r.find((x) => x.nspname === 'negocio' && x.tipo === 'r');
  assert.ok(tablas, 'falta la regla por omisión de TABLAS en `negocio`');
  assert.match(tablas.acl, /app_inquilino=arwd/, 'el inquilino tiene que recibir select/insert/update/delete');

  const secuencias = r.find((x) => x.nspname === 'negocio' && x.tipo === 'S');
  assert.ok(secuencias, 'falta la regla por omisión de SECUENCIAS en `negocio`');

  // Y NINGUNA sobre `identidad`: ahí cada tabla se otorga a mano, y una tabla nueva
  // nace sin acceso para nadie hasta que alguien escriba el grant.
  assert.deepEqual(
    r.filter((x) => x.nspname === 'identidad'),
    [],
    'no puede haber regla por omisión sobre `identidad`: es lo que la hace segura',
  );

  // Para cada esquema no sistémico distinto de `identidad` y `public` tiene que
  // haber una regla. Hoy eso es solo `negocio`; el día que alguien cree un tercer
  // esquema sin su regla, esto rompe.
  const esquemas = await filas<{ nspname: string }>(
    mig,
    `select nspname from pg_namespace
      where nspname not like 'pg\\_%' and nspname not in ('information_schema', 'identidad', 'public')`,
  );
  for (const e of esquemas) {
    assert.ok(
      r.some((x) => x.nspname === e.nspname && x.tipo === 'r'),
      `el esquema \`${e.nspname}\` no tiene regla de permisos por omisión para migrador`,
    );
  }
});

// ─── La contabilidad y la idempotencia ──────────────────────────────────────

test('la contabilidad lista exactamente los archivos de db/migraciones/', async () => {
  const aplicadas = await filas<{ name: string }>(
    mig,
    `select name from ${ESQUEMA_CONTABILIDAD}.${TABLA_APLICADAS} order by name`,
  );
  const esperadas = archivosDeMigracion().map((a) => a.replace(/\.sql$/, ''));
  assert.deepEqual(
    aplicadas.map((x) => x.name),
    esperadas,
  );
  assert.ok(esperadas.length >= 2, 'se esperaban al menos las dos migraciones de la Etapa 0');
});

test('volver a migrar no aplica nada', async () => {
  const { aplicadas } = await migrar();
  assert.deepEqual(aplicadas, [], 'la segunda corrida tiene que ser un no-op');
});

// ─── Las revisiones estáticas del corredor ──────────────────────────────────

test('las migraciones pasan las revisiones estáticas del corredor', () => {
  assert.deepEqual(revisarMigraciones(), []);
});

test('ninguna migración lleva `owner to` ni fija la ruta de búsqueda', () => {
  // "Cambiar el dueño después de crear la tabla no reaplica nada": es el patrón
  // "creo como superusuario y después cambio el dueño", que deja las tablas nuevas
  // sin los permisos por omisión.
  assert.deepEqual(archivosQueContienen(/\bowner\s+to\b/i, ['db']), []);

  // La ruta de búsqueda se comprueba SOLO sobre `db/migraciones`. El arranque del
  // clúster fija legítimamente un `search_path` POR ROL —es un atributo de rol, y
  // es la razón por la que el código de la aplicación puede escribir sin
  // calificar—. Escrita sobre todo `db/`, esta afirmación fallaría sobre código
  // correcto, y una prueba que falla sobre lo correcto se termina ignorando.
  assert.deepEqual(archivosQueContienen(/\bset\s+(local\s+)?search_path\b/i, ['db/migraciones']), []);
});

test('ningún archivo del proyecto contiene `set role`, salvo el que lo prohíbe', () => {
  // El cambio de rol NO es una frontera entre dominios: la ruta de búsqueda por rol
  // se aplica al iniciar sesión, no al cambiar de rol, y volver al rol original
  // recupera sus privilegios desde la misma sesión (09 § 6). Son dos cadenas de
  // conexión, dos agrupadores, dos contraseñas.
  //
  // La lista de autorizados tiene UNA entrada, y es el archivo que hace cumplir la
  // regla: `migrador.ts` contiene la cadena porque contiene el patrón que la
  // rechaza. Quitar comentarios no alcanza para eximirlo —está en un literal de
  // expresión regular—, y ésa es exactamente la forma del problema que el 04 § 4
  // resuelve con una lista explícita: "un archivo nuevo que la use ROMPE la suite
  // hasta que alguien lo agregue a la lista a mano".
  const AUTORIZADOS = ['lib/datos/migrador.ts'];

  const encontrados = archivosQueContienen(/\bset\s+role\b/i);
  assert.deepEqual(
    encontrados.filter((r) => !AUTORIZADOS.includes(r)),
    [],
    '`set role` no es una frontera entre dominios',
  );

  // Y la comprobación de entradas MUERTAS, sin la cual una lista blanca se
  // convierte en permiso permanente: si un autorizado deja de contener la cadena,
  // hay que sacarlo de la lista.
  assert.deepEqual(
    AUTORIZADOS.filter((r) => !encontrados.includes(r)),
    [],
    'hay entradas muertas en la lista de autorizados: sacalas',
  );
});

test('el alcance de sesión está prohibido en el código', () => {
  // 09 § 6: "prohibí el alcance de sesión en el código, con una búsqueda en la
  // integración continua. Un solo lugar que lo use deja la variable viva en esa
  // conexión del servidor PARA SIEMPRE."
  //
  // `set_config(..., false)` es alcance de SESIÓN. Solo se permite `true`.
  const malos = archivosFuente().filter((a) =>
    /set_config\s*\([^)]*,\s*false\s*\)/i.test(a.limpio),
  );
  assert.deepEqual(
    malos.map((a) => a.ruta),
    [],
    'set_config con tercer argumento `false` es alcance de sesión: se filtra entre inquilinos',
  );
  assert.deepEqual(archivosQueContienen(/\bset\s+session\b/i), []);
});

test('el esquema no viene de un volcado: no hay dump ni schema.sql', () => {
  // "El entorno de pruebas se levanta solo desde las migraciones." Todo lo que vive
  // DENTRO de la base nace de archivos versionados en db/migraciones/. No hay
  // volcado dorado, no hay pg_restore, no hay DDL aplicado a mano.
  const sospechosos: string[] = [];
  for (const e of readdirSync(RAIZ, { recursive: true, withFileTypes: true })) {
    if (!e.isFile()) continue;
    const ruta = relative(RAIZ, join(e.parentPath, e.name)).split(sep).join('/');
    if (ruta.startsWith('node_modules/') || ruta.startsWith('.next/') || ruta.startsWith('.git/')) continue;
    if (ruta.startsWith('graphify-out/')) continue;
    if (/\.(dump|backup)$/i.test(e.name) || e.name === 'schema.sql') sospechosos.push(ruta);
  }
  assert.deepEqual(sospechosos, []);
});

// ─── El régimen de aislamiento, sobre toda tabla ────────────────────────────

test('toda tabla de identidad y negocio tiene RLS activada, forzada y con política', async () => {
  // Es la fila ⛔ de la Etapa 1, escrita ya en la Etapa 0: hoy da verde sobre dos
  // tablas y CRECE SOLA a medida que la Etapa 1 agrega las otras ocho. Ocho tablas
  // de protección, gratis.
  //
  // `relkind in ('r','p')` no es un detalle: sin eso, índices, secuencias y vistas
  // aparecen como "tablas sin seguridad", son falsos positivos que nadie puede
  // corregir, y la costumbre de ignorar el resultado se instala.
  const r = await filas<{
    nspname: string;
    relname: string;
    habilitada: boolean;
    forzada: boolean;
    con_politica: boolean;
  }>(
    mig,
    `select n.nspname, c.relname,
            c.relrowsecurity      as habilitada,
            c.relforcerowsecurity as forzada,
            exists (select 1 from pg_policy p where p.polrelid = c.oid) as con_politica
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('identidad', 'negocio')
        and c.relkind in ('r', 'p')
      order by n.nspname, c.relname`,
  );

  // Que la consulta no vuelva vacía: un filtro por un esquema equivocado hace que
  // esta prueba pase SIEMPRE, y una prueba que pasa en vacío es peor que ninguna.
  assert.ok(r.length > 0, 'la consulta de catálogo no devolvió ninguna tabla');

  // Y el roster EXPLÍCITO, para que el conjunto no pueda encogerse en silencio.
  // Sin esto, borrar una tabla dejaría la prueba verde sobre las que quedan — y "cero
  // tablas sin las tres cosas" sería cierto y vacío a la vez.
  //
  // SON DIEZ (09 § 2). Es el detalle que hace que este arreglo se aplique a medias: se
  // resuelve el login —`usuarios` y `organizaciones`— y se descubre después que
  // `sesiones` no tiene columna de organización, que `permisos` es un catálogo global,
  // que `roles` puede ser global o de una organización, que la auditoría tiene la
  // organización nulificable a propósito, y que el segundo factor y las credenciales
  // cifradas son dos tablas más que nadie contó.
  const DIEZ_TABLAS_DE_IDENTIDAD = [
    'auditoria_accesos',
    'organizaciones',
    'organizaciones_credenciales',
    'permisos',
    'roles',
    'roles_permisos',
    'sesiones',
    'usuarios',
    'usuarios_roles',
    'usuarios_segundo_factor',
  ];
  assert.deepEqual(
    r.filter((t) => t.nspname === 'identidad').map((t) => t.relname).sort(),
    DIEZ_TABLAS_DE_IDENTIDAD,
    'el conjunto de tablas de identidad cambió: son diez y se otorgan a mano, una por una',
  );

  for (const t of r) {
    const cual = `${t.nspname}.${t.relname}`;
    assert.equal(t.habilitada, true, `${cual}: RLS no activada`);
    // Encendida y con política pero SIN FORZAR: el dueño de la tabla la evade, y el
    // catálogo la muestra igual que una correcta.
    assert.equal(t.forzada, true, `${cual}: RLS no forzada — su dueño la evade`);
    // Encendida SIN política: nadie ve nada. Rompe la aplicación, no la abre.
    assert.equal(t.con_politica, true, `${cual}: sin política`);
  }
});

test('el inquilino NO alcanza el hash de contraseña ni las marcas de bloqueo', async () => {
  // Verificado en la compuerta: `has_table_privilege` NO ve los permisos por
  // columna, así que la fila ⛔ de la Etapa 1 tal como está escrita en PRUEBAS
  // fallaría sobre código correcto. Ésta es la versión que sí prueba lo que el
  // 09 § 2 dice proteger: "si una consulta de negocio tuviera una inyección, el
  // hash no está a su alcance".
  const permitidas = ['id', 'org_id', 'nombre', 'email', 'activo'];
  const prohibidas = ['password_hash', 'intentos_fallidos', 'bloqueado_hasta'];

  for (const col of permitidas) {
    const f = await unaFila<{ ok: boolean }>(
      mig,
      `select has_column_privilege('app_inquilino', 'identidad.usuarios', $1, 'SELECT') as ok`,
      [col],
    );
    assert.equal(f?.ok, true, `app_inquilino tendría que poder leer ${col}`);
  }
  for (const col of prohibidas) {
    const f = await unaFila<{ ok: boolean }>(
      mig,
      `select has_column_privilege('app_inquilino', 'identidad.usuarios', $1, 'SELECT') as ok`,
      [col],
    );
    assert.equal(f?.ok, false, `app_inquilino NO tendría que poder leer ${col}`);
  }
});
