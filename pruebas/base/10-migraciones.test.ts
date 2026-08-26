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
// Y de la Etapa 2, porque es una comprobación de catálogo sobre los mismos roles:
//   ADR-0204 — los roles de la aplicación no pueden saltear las políticas.
//              INNEGOCIABLE. Si `rolbypassrls` fuera cierto o el rol fuera superusuario,
//              las políticas existirían en el esquema y NO PROTEGERÍAN DE NADA — y eso
//              es peor que no tenerlas, porque uno acepta atajos en la capa de
//              aplicación pensando "igual la base me cubre" (08 § 1).
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

test('los esquemas DE MIGRADOR son exactamente los nuestros — `comun` NO existe', async () => {
  // ── POR QUÉ ESTO PREGUNTA POR EL DUEÑO Y NO POR EL CLÚSTER ──────────────────
  //
  // Antes esto afirmaba `deepEqual(nombres, ['identidad', 'negocio', 'public'])`
  // sobre TODOS los esquemas no sistémicos del clúster. Contra el contenedor de la
  // Etapa 0 era exacto, porque ahí no vivía nadie más.
  //
  // Contra la base real falla con una lista de ~19 nombres: los esquemas de
  // plataforma de Supabase (`auth`, `storage`, `extensions`, `graphql_public`,
  // `realtime`, `vault`, `cron`, `supabase_migrations`…). Y falla POR EL MOTIVO
  // EQUIVOCADO: no descubrió una tabla nuestra fuera del régimen, descubrió que la
  // base tiene otros inquilinos.
  //
  // La intención de la fila nunca fue "este clúster es nuestro". Era: *no nació un
  // esquema nuestro fuera del régimen*. Preguntar por `nspowner = migrador` dice
  // exactamente eso, y sigue rompiendo si alguien agrega un esquema propio — que es
  // toda la propiedad que la fila compraba.
  const r = await filas<{ nspname: string }>(
    mig,
    `select n.nspname from pg_namespace n
       join pg_roles p on p.oid = n.nspowner
      where p.rolname = 'migrador'
      order by n.nspname`,
  );
  const nombres = r.map((x) => x.nspname);
  assert.deepEqual(nombres, [ESQUEMA_CONTABILIDAD, 'identidad', 'negocio'].sort());

  // `comun` se comprueba sobre TODO el clúster y no solo sobre lo de `migrador`: la
  // prohibición de EJECUCION § 2 y § 3 es sobre el nombre, sin importar quién lo cree.
  // Si alguien lo creara con otro rol, la afirmación de arriba no lo vería.
  const comun = await filas<{ nspname: string }>(
    mig,
    `select nspname from pg_namespace where nspname = 'comun'`,
  );
  assert.deepEqual(comun, [], 'EJECUCION § 2 y § 3: el esquema `comun` no se crea');
});

test('NINGUNA tabla nuestra vive en `public`, y ninguna tabla nuestra tiene org_id fuera de negocio', async () => {
  // Es la fila de PRUEBAS Etapa 1 que el 09 § 4 escribió para el esquema de
  // catálogos —"la más valiosa del documento entero"— RETARGETEADA dos veces.
  //
  // Primero de `comun` a `public`, cuando `comun` dejó de existir: el valor de la
  // fila nunca fue `comun`, era *el esquema que la prueba de RLS excluye*.
  //
  // Y ahora de "`public` tiene exactamente estas dos tablas" a "`public` no tiene
  // NINGUNA tabla nuestra". Las dos razones del cambio:
  //
  //   1. La contabilidad se mudó a su propio esquema, así que en `public` no debería
  //      quedar nada de lo nuestro. La afirmación se vuelve más fuerte, no más débil.
  //   2. `public` tiene 59 tablas de otros cinco sistemas en la base real. Un
  //      `deepEqual` contra el inventario completo de `public` mide código ajeno.
  //
  // El discriminante es el DUEÑO. `pg_class` no filtra por ACL, así que `migrador` ve
  // todas las tablas del esquema y puede afirmar sobre las suyas sin ver las ajenas.
  const nuestrasEnPublic = await filas<{ relname: string }>(
    mig,
    `select c.relname from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_roles p     on p.oid = c.relowner
       where n.nspname = 'public' and c.relkind in ('r', 'p') and p.rolname = 'migrador'
       order by c.relname`,
  );
  assert.deepEqual(
    nuestrasEnPublic,
    [],
    '`public` está publicado por PostgREST: una tabla nuestra ahí nace alcanzable ' +
      'desde la red y sin ninguna de nuestras políticas',
  );

  // Y la contabilidad está donde tiene que estar. Sin esta mitad, la afirmación de
  // arriba pasaría también si las migraciones no hubieran corrido nunca.
  const contabilidad = await filas<{ relname: string }>(
    mig,
    `select c.relname from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = $1 and c.relkind in ('r', 'p')
       order by c.relname`,
    [ESQUEMA_CONTABILIDAD],
  );
  assert.deepEqual(
    contabilidad.map((t) => t.relname).sort(),
    [TABLA_APLICADAS, TABLA_CANDADO].sort(),
  );

  // ── La comprobación que importa de verdad ───────────────────────────────────
  //
  // Una tabla NUESTRA con columna de organización fuera de los dos esquemas del
  // diseño es una tabla de negocio sin aislamiento, en el esquema equivocado.
  //
  // `identidad` queda dentro del conjunto permitido y NO es una concesión: cuatro de
  // sus tablas llevan `org_id` a propósito (`usuarios`, `roles`, `auditoria_accesos`,
  // `organizaciones_credenciales`). Ahí el filtro por organización lo pone la
  // aplicación —`usuarioObjetivo()` en `lib/administracion/objetivo.ts` es el único
  // `where org_id` del dominio— y no una política, que es toda la razón por la que
  // los dos dominios están separados. Lo que esta afirmación persigue es una tabla
  // con `org_id` en un TERCER lugar: `public`, la contabilidad, o un esquema nuevo.
  //
  // Se lee de `pg_attribute` y NO de `information_schema.columns`, y ése es un
  // arreglo de fondo, no cosmético: `information_schema` FILTRA POR PRIVILEGIOS.
  // `migrador` no tiene ninguno sobre las tablas de los otros cinco sistemas, así que
  // la versión anterior podía pasar EN VERDE POR FALTA DE VISIBILIDAD en vez de por
  // ausencia de `org_id` — exactamente el falso verde que este archivo entero existe
  // para no tener. `pg_attribute` no filtra por ACL.
  const conOrg = await filas<{ esquema: string; tabla: string }>(
    mig,
    `select n.nspname as esquema, c.relname as tabla
       from pg_attribute a
       join pg_class c     on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
       join pg_roles p     on p.oid = c.relowner
      where a.attname = 'org_id' and a.attnum > 0 and not a.attisdropped
        and c.relkind in ('r', 'p') and p.rolname = 'migrador'
        and n.nspname not in ('negocio', 'identidad')
      order by 1, 2`,
  );
  assert.deepEqual(
    conOrg,
    [],
    'una tabla nuestra con org_id fuera de `negocio` e `identidad` no está en ningún régimen',
  );
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

  // Para cada esquema NUESTRO distinto de `identidad` y de la contabilidad tiene que
  // haber una regla. Hoy eso es solo `negocio`; el día que alguien cree un cuarto
  // esquema sin su regla, esto rompe.
  //
  // ── POR QUÉ POR DUEÑO Y NO POR "NO SISTÉMICO" ───────────────────────────────
  //
  // Antes el universo era "todo esquema que no empiece con `pg_` y no sea
  // `information_schema`, `identidad` ni `public`". Ese era el complemento correcto
  // mientras el clúster fuera nuestro.
  //
  // Contra la base real dispara UNA VEZ POR CADA ESQUEMA DE SUPABASE —`auth`,
  // `storage`, `extensions`, `realtime`, `vault`, `cron`, `supabase_migrations`…—
  // exigiéndoles una regla de permisos por omisión para `migrador` que no tienen ni
  // tienen por qué tener. El comentario original anticipaba el modo de falla ("el día
  // que alguien cree un tercer esquema sin su regla, esto rompe"); lo que no
  // anticipaba es que alguien crearía dieciséis, y que ninguno sería nuestro.
  //
  // La contabilidad se excluye por el mismo motivo que `identidad`: sus dos tablas
  // las crea Kysely y no las toca ningún rol de aplicación, así que una regla por
  // omisión ahí no protegería nada y daría acceso donde no hace falta.
  const esquemas = await filas<{ nspname: string }>(
    mig,
    `select n.nspname from pg_namespace n
       join pg_roles p on p.oid = n.nspowner
      where p.rolname = 'migrador' and n.nspname not in ('identidad', $1)`,
    [ESQUEMA_CONTABILIDAD],
  );
  // La guarda contra el falso verde: un bucle sobre cero esquemas pasa sin afirmar
  // nada, y con el universo acotado por dueño eso es ahora posible de verdad — basta
  // que la consulta de arriba se equivoque en el nombre del rol.
  assert.deepEqual(
    esquemas.map((e) => e.nspname),
    ['negocio'],
    'se esperaba exactamente un esquema de negocio de `migrador` que necesite la regla',
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
  // ── ONCE, Y EL NOMBRE SE ACTUALIZA CON EL NÚMERO ─────────────────────────
  //
  // La constante se llamaba `DIEZ_TABLAS_DE_IDENTIDAD`. Un nombre con el número adentro es lo que
  // hace que agregar una tabla **obligue** a leer esta prueba en vez de sumar un renglón y seguir —
  // que es exactamente para lo que está escrita así. La número once es `usuarios_secciones`.
  const ONCE_TABLAS_DE_IDENTIDAD = [
    'auditoria_accesos',
    'organizaciones',
    'organizaciones_credenciales',
    'permisos',
    'roles',
    'roles_permisos',
    'sesiones',
    'usuarios',
    'usuarios_roles',
    'usuarios_secciones',
    'usuarios_segundo_factor',
  ];
  assert.deepEqual(
    r.filter((t) => t.nspname === 'identidad').map((t) => t.relname).sort(),
    ONCE_TABLAS_DE_IDENTIDAD,
    'el conjunto de tablas de identidad cambió: son once y se otorgan a mano, una por una',
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

test('07 § 1 · ninguna función tiene dos firmas', async () => {
  // "PostgreSQL resuelve las sobrecargas POR CANTIDAD DE ARGUMENTOS. Si existe
  // `f(p_org_id)` y quedó una `f()` heredada, UN LLAMADOR QUE SE OLVIDE EL ARGUMENTO NO
  // FALLA: ejecuta la vieja, que ignora la organización."
  //
  // `EJECUCION` § 2 prohíbe los procedimientos almacenados con lógica de negocio, así que
  // la trampa entera no debería aplicar — pero `negocio.aplicar_aislamiento()` existe y es
  // una función, y el día que alguien le cambie la firma va a escribir un
  // `create or replace` que deja la vieja viva al lado. El propio `07` lo dice: "borrar la
  // versión sin parámetro es parte del trabajo", y el borrado "SE LLEVA LOS PERMISOS".
  //
  // Es una comprobación de catálogo de tres líneas que cierra la clase entera.
  // Se excluyen las funciones que pertenecen a una EXTENSIÓN, y la primera corrida
  // demostró por qué: `pgcrypto` trae **doce** nombres sobrecargados en `public`
  // —`digest`, `hmac`, `pgp_sym_encrypt`…— que son su API pública y están perfectas. Sin
  // este filtro la prueba fallaba sobre código correcto, que es como mueren las pruebas
  // arquitectónicas (04 § 7). La sobrecarga que importa es la NUESTRA.
  //
  // ── Y POR QUÉ `public` YA NO ESTÁ EN EL FILTRO ──────────────────────────────
  //
  // Estaba, y contra el contenedor de la Etapa 0 era gratis: en `public` no vivía
  // nada salvo la contabilidad, que no tiene funciones.
  //
  // En la base real hay **catorce funciones RPC** de otros cinco sistemas ahí. Tres
  // de ellas son `match_documents`, `match_documents_crm` y `match_documents_sofia`,
  // que salen de la plantilla RAG de Supabase — y esa plantilla se distribuye con
  // variantes sobrecargadas. Barrer `public` es medir código ajeno: la prueba fallaría
  // nombrando una función que no escribimos y que no podemos arreglar.
  //
  // Lo cual NO significa que el hallazgo no valga. Una RPC sobrecargada expuesta por
  // PostgREST tiene el modo de falla exacto que este comentario describe, así que la
  // consulta contra `public` queda escrita en `docs/COMPATIBILIDAD.md` para correrla a
  // mano contra la base real y anotar lo que devuelva. Es un hallazgo sobre esa base,
  // no una prueba de este repositorio.
  const dobles = await filas<{ esquema: string; nombre: string; firmas: string }>(
    mig,
    `select n.nspname as esquema, p.proname as nombre, count(*)::text as firmas
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       join pg_roles r on r.oid = n.nspowner
      where r.rolname = 'migrador'
        and not exists (select 1 from pg_depend d
                         where d.objid = p.oid and d.deptype = 'e')
      group by 1, 2 having count(*) > 1
      order by 1, 2`,
  );
  assert.deepEqual(
    dobles.map((d) => `${d.esquema}.${d.nombre} (${d.firmas} firmas)`),
    [],
    'una función con dos firmas se resuelve por cantidad de argumentos: el llamador que ' +
      'se olvide el de la organización NO falla, ejecuta la otra',
  );

  // La guarda contra el falso verde: si no hubiera NINGUNA función, el conjunto vacío
  // pasaría sin verificar nada. Hoy hay una, `negocio.aplicar_aislamiento`.
  const cuantas = await unaFila<{ n: string }>(
    mig,
    `select count(*)::text as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('identidad', 'negocio')`,
  );
  assert.ok(Number(cuantas?.n ?? 0) > 0, 'no hay ninguna función: la prueba pasaría en vacío');
});
