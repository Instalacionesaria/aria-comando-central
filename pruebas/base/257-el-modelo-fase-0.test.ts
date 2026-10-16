// La Fase 0 del modelo de datos multiempresa: las cuentas, el catálogo, la bandeja de entrada y los eventos.
// Tipo: Base + Catálogo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (plan de la Fase 0, 2026-10-16)
//
// Crece con cada paso de la Fase 0: cada prueba entra en el paso que crea lo que prueba, y dice la mutación que la
// pone en rojo. Hoy:
//
//   · toda tabla de `negocio` tiene su régimen escrito (`pruebas/apoyo/regimenes-de-negocio.ts`) — mutación: una
//     migración con una tabla nueva sin sumarla a la lista, o una tabla en dos listas;
//   · el catálogo (Paso 2, `079`) es de todos y no es de nadie: sin org_id, sin datos personales, todos lo leen y
//     ningún rol de la aplicación lo escribe — mutación: un `grant insert` a `app_inquilino`, o un `org_id`;
//   · una llave de catálogo mal escrita no entra (el dominio `catalogo.clave`) — mutación: aflojar el patrón;
//   · el nivel de un nicho es el de su padre más uno — mutación: quitar el disparador;
//   · las semillas están: 45 nichos y los 33 tipos de evento, cada uno con el JSON Schema de sus datos — mutación:
//     perder un bloque de semillas;
//   · las cuentas (Paso 3, `080`): toda organización nace con su cuenta (el puente) — mutación: quitar el disparador;
//   · la fase `cuentas` crea la que falta, con la location del CRM, y no duplica — mutación: sacarle el `not exists`;
//   · `tipo` sale de `es_principal` y no se puede escribir — mutación: volverla una columna común;
//   · el inquilino ve las cuentas de su organización sólo con `app.cuentas`, y ninguna credencial — mutación: una
//     política sin `app.cuentas`, o un `grant select` sobre las credenciales;
//   · la bandeja (Paso 4, `081`): el mismo aviso dos veces se guarda una sola, con la location tal cual — mutación:
//     sacar la tabla de claves de la puerta;
//   · sólo el ingestor ejecuta la puerta, y no lee nada; el normalizador lee y no inserta — mutación: un `grant
//     select` al ingestor, o un `grant execute` a public;
//   · la partición del mes existe y la de por omisión está vacía — mutación: no crear las del mes;
//   · ninguna política de identidad ni de negocio nombra al migrador, y ninguna función elevada es de public —
//     mutación: la política de lectura de cuentas que el diseño daba a la puerta.
//
// Corre como `migrador`: es una comprobación de catálogo, y el migrador ve la estructura aunque no vea las filas.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas, unaFila } from '../apoyo/conexiones.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import {
  DE_LA_ORGANIZACION,
  DE_UNA_CUENTA,
  DE_UNA_CUENTA_O_DE_LA_ORGANIZACION,
} from '../apoyo/regimenes-de-negocio.ts';

let mig: Client;
let admin: Client;
let ident: Client;

before(async () => {
  mig = await conectar('migrador');
  admin = await conectar('admin');
  ident = await conectar('identidad');
});

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

test('toda tabla de `negocio` tiene su régimen escrito, y uno solo', async () => {
  // Las tablas madre y las comunes; las particiones heredan el régimen de su madre.
  const enLaBase = (
    await filas<{ tabla: string }>(
      mig,
      `select c.relname as tabla
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'negocio' and c.relkind in ('r', 'p') and not c.relispartition
        order by 1`,
    )
  ).map((f) => f.tabla);

  const listas = [...DE_UNA_CUENTA, ...DE_UNA_CUENTA_O_DE_LA_ORGANIZACION, ...DE_LA_ORGANIZACION] as string[];
  const repetidas = listas.filter((t, i) => listas.indexOf(t) !== i);
  assert.deepEqual(repetidas, [], 'una tabla está en dos regímenes');

  const sinRegimen = enLaBase.filter((t) => !listas.includes(t));
  assert.deepEqual(sinRegimen, [], 'una tabla de negocio no tiene régimen: sumala a pruebas/apoyo/regimenes-de-negocio.ts');

  const queYaNoEstan = listas.filter((t) => !enLaBase.includes(t));
  assert.deepEqual(queYaNoEstan, [], 'la lista nombra una tabla que no existe en la base');
});

// ─── Paso 2 · El catálogo ───────────────────────────────────────────────────────

test('el catálogo es de todos y no es de nadie: sin org_id, todos lo leen, ningún rol de la aplicación lo escribe', async () => {
  const tablas = (
    await filas<{ tabla: string }>(
      mig,
      `select c.relname as tabla from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'catalogo' and c.relkind = 'r' order by 1`,
    )
  ).map((f) => f.tabla);
  assert.ok(tablas.length >= 23, `el catálogo tiene ${tablas.length} tablas; se esperaban al menos 23`);

  const conOrg = await filas<{ tabla: string }>(
    mig,
    `select table_name as tabla from information_schema.columns
      where table_schema = 'catalogo' and column_name in ('org_id', 'cuenta_id', 'contacto_id')`,
  );
  assert.deepEqual(conOrg, [], 'una tabla del catálogo lleva una columna de empresa o de persona');

  const ROLES = ['app_inquilino', 'app_identidad', 'app_ingesta', 'app_analista'];
  const malos = await filas<{ rol: string; tabla: string; que: string }>(
    admin,
    `select r as rol, t as tabla, p as que
       from unnest($1::text[]) r
      cross join unnest($2::text[]) t
      cross join unnest(array['select', 'insert', 'update', 'delete', 'truncate']) p
      where has_table_privilege(r, 'catalogo.' || t, p) <> (p = 'select')`,
    [ROLES, tablas],
  );
  assert.deepEqual(malos, [], 'un rol de la aplicación no puede leer el catálogo, o puede escribirlo');
  // El ingestor no lee ni el catálogo: es la credencial de n8n, la que más fácil se filtra.
  const ingestor = await unaFila<{ n: number }>(
    admin,
    `select count(*)::int as n from unnest($1::text[]) t where has_table_privilege('ingestor', 'catalogo.' || t, 'select')`,
    [tablas],
  );
  assert.equal(ingestor?.n, 0, 'el ingestor puede leer el catálogo');
});

test('una llave de catálogo mal escrita no entra, y el nivel del nicho es el de su padre más uno', async () => {
  await mig.query('begin');
  try {
    // El dominio: minúsculas, dígitos y guion bajo. Ni mayúsculas, ni espacios, ni tildes.
    for (const mala of ['Clinicas', 'clínicas', 'dos palabras', 'x']) {
      await mig.query('savepoint s');
      await assert.rejects(mig.query(`select $1::catalogo.clave`, [mala]), /catalogo.clave|check|viola/i, `entró «${mala}»`);
      await mig.query('rollback to savepoint s');
    }
    const buena = await unaFila<{ v: string }>(mig, `select 'clinicas_esteticas'::catalogo.clave::text as v`);
    assert.equal(buena?.v, 'clinicas_esteticas');

    // El hijo de un sector (nivel 1) es un nicho (nivel 2). Saltarse un nivel —un subnicho colgado directo de un
    // sector— lo rechaza el disparador: es una regla entre filas, que el `check` de la columna no puede ver.
    const sector = await unaFila<{ clave: string }>(
      mig,
      `select clave from catalogo.nichos where nivel = 1 order by clave limit 1`,
    );
    assert.ok(sector, 'no hay sectores sembrados');
    await mig.query('savepoint s');
    await assert.rejects(
      mig.query(`insert into catalogo.nichos (clave, padre, nivel, nombre) values ('prueba_257_salto', $1, 3, 'Prueba')`, [
        sector.clave,
      ]),
      /es de nivel 3 pero su padre/,
      'entró un nicho de nivel 3 colgado de un sector',
    );
    await mig.query('rollback to savepoint s');
    await mig.query(`insert into catalogo.nichos (clave, padre, nivel, nombre) values ('prueba_257_bien', $1, 2, 'Prueba')`, [
      sector.clave,
    ]);
  } finally {
    await mig.query('rollback');
  }
});

test('las semillas están: los nichos v1 y los tipos de evento, cada uno con el esquema de sus datos', async () => {
  const f = await unaFila<{ nichos: number; raices: number; eventos: number; sin_esquema: number; monedas: number; paises: number }>(
    mig,
    `select (select count(*)::int from catalogo.nichos) as nichos,
            (select count(*)::int from catalogo.nichos where padre is null) as raices,
            (select count(*)::int from catalogo.tipos_de_evento) as eventos,
            (select count(*)::int from catalogo.tipos_de_evento
              where esquema_de_datos is null or jsonb_typeof(esquema_de_datos) <> 'object') as sin_esquema,
            (select count(*)::int from catalogo.monedas) as monedas,
            (select count(*)::int from catalogo.paises) as paises`,
  );
  assert.equal(f?.nichos, 45, 'cambió la cantidad de nichos sembrados');
  assert.ok((f?.raices ?? 0) > 0, 'no hay nichos raíz');
  assert.equal(f?.eventos, 33, 'cambió la cantidad de tipos de evento sembrados');
  assert.equal(f?.sin_esquema, 0, 'un tipo de evento no tiene el JSON Schema de sus datos');
  assert.ok((f?.monedas ?? 0) > 0 && (f?.paises ?? 0) > 0, 'faltan monedas o países');
});

// ─── Paso 3 · Las cuentas ───────────────────────────────────────────────────────

/** Corre `trabajo` dentro de una transacción de `ident` que se deshace siempre. */
async function deshaciendo<T>(trabajo: () => Promise<T>): Promise<T> {
  await ident.query('begin');
  try {
    return await trabajo();
  } finally {
    await ident.query('rollback');
  }
}

test('toda organización nace con su cuenta, y `tipo` sale de `es_principal`', async () => {
  await deshaciendo(async () => {
    const org = await unaFila<{ id: string; tipo: string }>(
      ident,
      `insert into identidad.organizaciones (nombre, slug) values ('Prueba 257', 'Prueba_257 Cuentas') returning id, tipo`,
    );
    assert.ok(org);
    assert.equal(org.tipo, 'agencia');
    const cuentas = await filas<{ slug: string; zona_horaria: string; estado: string; es_prueba: boolean }>(
      ident,
      `select slug, zona_horaria, estado, es_prueba from identidad.cuentas where org_id = $1`,
      [org.id],
    );
    // El slug de la cuenta sale del de la organización, en minúsculas y con guiones: el `check` de la cuenta es más
    // estricto que el de la organización.
    assert.deepEqual(cuentas, [{ slug: 'prueba-257-cuentas', zona_horaria: 'UTC', estado: 'activa', es_prueba: false }]);

    await ident.query('savepoint s');
    await assert.rejects(
      ident.query(`insert into identidad.organizaciones (nombre, slug, tipo) values ('Otra', 'otra-257', 'plataforma')`),
      // 428C9 = «generated_always»: el código, no el texto, que sale en el idioma de la base.
      (e: { code?: string }) => e.code === '428C9',
      '`tipo` se pudo escribir a mano',
    );
    await ident.query('rollback to savepoint s');
  });
  const principal = await unaFila<{ tipo: string }>(admin, `select tipo from identidad.organizaciones where es_principal`);
  assert.equal(principal?.tipo, 'plataforma');
});

test('la fase `cuentas` crea la cuenta que falta, con la location del CRM, y no duplica', async () => {
  const fase = readFileSync(join(RAIZ, 'db/arranque/004_las_cuentas_iniciales.sql'), 'utf8');
  await deshaciendo(async () => {
    const org = await unaFila<{ id: string }>(
      ident,
      `insert into identidad.organizaciones (nombre, slug) values ('Sin cuenta 257', 'sin-cuenta-257') returning id`,
    );
    assert.ok(org);
    // Una organización como las de producción antes de la `080`: sin cuenta, con su location cargada.
    await ident.query(`delete from identidad.cuentas where org_id = $1`, [org.id]);
    await ident.query(`insert into identidad.organizaciones_credenciales (org_id, crm_cuenta_id) values ($1, 'loc-257')`, [org.id]);

    await ident.query(fase);
    await ident.query(fase);
    const cuentas = await filas<{ crm_cuenta_id: string | null }>(
      ident,
      `select crm_cuenta_id from identidad.cuentas where org_id = $1`,
      [org.id],
    );
    assert.deepEqual(cuentas, [{ crm_cuenta_id: 'loc-257' }], 'la fase no creó la cuenta, o la creó dos veces');
    const copias = await unaFila<{ n: number }>(
      ident,
      `select count(*)::int as n from identidad.cuentas_credenciales where org_id = $1`,
      [org.id],
    );
    assert.equal(copias?.n, 1, 'las credenciales no se copiaron una vez');
  });
});

test('el inquilino ve las cuentas de su organización sólo con `app.cuentas`, y ninguna credencial', async () => {
  const org = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'alfa'`);
  assert.ok(org, 'falta el sembrado');
  const inq = await conectar('inquilino');
  try {
    await inq.query('begin');
    await inq.query(`select set_config('app.org_id', $1, true)`, [org.id]);
    const sinCuentas = await unaFila<{ n: number }>(inq, `select count(*)::int as n from identidad.cuentas`);
    assert.equal(sinCuentas?.n, 0, 'sin app.cuentas se vio una cuenta: la política no falla cerrada');
    await inq.query(`select set_config('app.cuentas', '*', true)`);
    const conCuentas = await unaFila<{ n: number; otras: number }>(
      inq,
      `select count(*)::int as n, count(*) filter (where org_id <> $1)::int as otras from identidad.cuentas`,
      [org.id],
    );
    assert.deepEqual(conCuentas, { n: 1, otras: 0 });
    await inq.query('rollback');
  } finally {
    await inq.end();
  }
  const credenciales = await unaFila<{ ve: boolean }>(
    admin,
    `select has_table_privilege('app_inquilino', 'identidad.cuentas_credenciales', 'select') as ve`,
  );
  assert.equal(credenciales?.ve, false, 'el inquilino alcanza las credenciales de las cuentas');
});

// ─── Paso 4 · La bandeja de entrada ─────────────────────────────────────────────

test('el mismo aviso dos veces se guarda una sola, con la location tal cual y sin traducir', async () => {
  await admin.query('begin');
  try {
    const recibir = `select recibido_id, ya_estaba from ingesta.recibir('ghl', 'ContactCreate', 'aviso-257', $1::jsonb, 'loc-257')`;
    const primera = await unaFila<{ recibido_id: string; ya_estaba: boolean }>(admin, recibir, ['{"contacto":"x"}']);
    const segunda = await unaFila<{ recibido_id: string; ya_estaba: boolean }>(admin, recibir, ['{"contacto":"x","otra":1}']);
    assert.equal(primera?.ya_estaba, false);
    assert.equal(segunda?.ya_estaba, true, 'el reintento se guardó como un aviso nuevo');
    assert.equal(segunda?.recibido_id, primera?.recibido_id, 'el reintento no devolvió el id del primero');
    const filas_ = await filas<{ crm_cuenta_id: string; org_id: string | null; cuenta_id: string | null; estado: string; huella: string }>(
      admin,
      `select crm_cuenta_id, org_id, cuenta_id, estado, huella from ingesta.recibidos where id_externo = 'aviso-257'`,
    );
    assert.equal(filas_.length, 1);
    // La puerta no traduce la location: corre como el migrador, que no ve identidad. La resuelve el normalizador.
    assert.deepEqual(
      { ...filas_[0], huella: /^[0-9a-f]{64}$/.test(filas_[0]!.huella) },
      { crm_cuenta_id: 'loc-257', org_id: null, cuenta_id: null, estado: 'pendiente', huella: true },
    );
  } finally {
    await admin.query('rollback');
  }
});

test('sólo el ingestor ejecuta la puerta, y no lee nada; el normalizador lee y no inserta', async () => {
  const FIRMA = 'ingesta.recibir(text, text, text, jsonb, text)';
  const f = await unaFila<Record<string, boolean>>(
    admin,
    `select has_function_privilege('ingestor', $1, 'execute') as ingestor_ejecuta,
            has_function_privilege('app_inquilino', $1, 'execute') as inquilino_ejecuta,
            has_function_privilege('app_identidad', $1, 'execute') as identidad_ejecuta,
            has_table_privilege('ingestor', 'ingesta.recibidos', 'select') as ingestor_lee,
            has_table_privilege('ingestor', 'ingesta.claves', 'select') as ingestor_lee_claves,
            has_table_privilege('ingestor', 'ingesta.recibidos', 'insert') as ingestor_inserta,
            has_table_privilege('app_ingesta', 'ingesta.recibidos', 'select') as normalizador_lee,
            has_table_privilege('app_ingesta', 'ingesta.recibidos', 'insert') as normalizador_inserta,
            has_table_privilege('app_ingesta', 'ingesta.recibidos', 'delete') as normalizador_borra,
            has_table_privilege('app_inquilino', 'ingesta.recibidos', 'select') as inquilino_lee,
            exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                     where p.oid = $1::regprocedure and a.grantee = 0) as public_ejecuta`,
    [FIRMA],
  );
  assert.deepEqual(f, {
    ingestor_ejecuta: true,
    inquilino_ejecuta: false,
    identidad_ejecuta: false,
    ingestor_lee: false,
    ingestor_lee_claves: false,
    ingestor_inserta: false,
    normalizador_lee: true,
    normalizador_inserta: false,
    normalizador_borra: false,
    inquilino_lee: false,
    public_ejecuta: false,
  });
  const rls = await filas<{ tabla: string; forzada: boolean; politicas: number }>(
    admin,
    `select c.relname as tabla, c.relforcerowsecurity as forzada,
            (select count(*)::int from pg_policy p where p.polrelid = c.oid) as politicas
       from pg_class c where c.oid in ('ingesta.recibidos'::regclass, 'ingesta.claves'::regclass) order by 1`,
  );
  assert.deepEqual(rls.map((x) => [x.tabla, x.forzada, x.politicas > 0]), [['claves', true, true], ['recibidos', true, true]]);
});

test('la partición del mes existe, y la de por omisión está vacía', async () => {
  const f = await unaFila<{ del_mes: boolean; en_el_resto: number }>(
    admin,
    `select exists (select 1 from pg_class where relnamespace = 'ingesta'::regnamespace
                     and relname = 'recibidos_' || to_char(now() at time zone 'UTC', 'YYYY_MM')) as del_mes,
            (select count(*)::int from ingesta.recibidos_resto) as en_el_resto`,
  );
  assert.equal(f?.del_mes, true, 'falta la partición del mes en curso: lo que llegue hoy cae en la de por omisión');
  assert.equal(f?.en_el_resto, 0, 'la partición por omisión tiene filas: faltó crear la de su mes');
});

test('ninguna política de identidad ni de negocio nombra al migrador, y ninguna función elevada es de public', async () => {
  // El migrador cambia la estructura y NO ve filas: sin política, con la RLS forzada. La puerta de la bandeja corre
  // como él y necesita las suyas, pero sólo sobre ingesta.
  const politicas = await filas<{ tabla: string; politica: string }>(
    admin,
    `select n.nspname || '.' || c.relname as tabla, p.polname as politica
       from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('identidad', 'negocio') and 'migrador'::regrole = any (p.polroles)`,
  );
  assert.deepEqual(politicas, [], 'una política le deja ver filas de identidad o de negocio al migrador');

  // Toda función `security definer` de nuestros esquemas se otorga a un rol con nombre, nunca a public (de quien
  // heredan anon y authenticated en Supabase).
  const elevadas = await filas<{ funcion: string }>(
    admin,
    `select p.oid::regprocedure::text as funcion
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.prosecdef and n.nspname in ('identidad', 'negocio', 'catalogo', 'sistema', 'ingesta')
        and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0)`,
  );
  assert.deepEqual(elevadas, [], 'una función security definer se puede ejecutar desde public');
});
