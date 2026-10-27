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
//   · las semillas están: 45 nichos y al menos 42 tipos de evento, cada uno con el JSON Schema de sus datos, con los
//     de la historia (etapa_cambiada, salida_marcada, cuadrante_cambiado…) y sin perdido ni precall_abierto; las 7
//     etapas del Pipeline Maestro en orden — mutación: perder un bloque de semillas, o volver a sembrar perdido;
//   · las cuentas (Paso 3, `080`): toda organización nace con su cuenta (el puente) — mutación: quitar el disparador;
//   · la fase `cuentas` crea la que falta, con la location del CRM, y no duplica — mutación: sacarle el `not exists`;
//   · `tipo` sale de `es_principal` y no se puede escribir — mutación: volverla una columna común;
//   · el inquilino ve las cuentas de su organización sólo con `app.cuentas`, y ninguna credencial — mutación: una
//     política sin `app.cuentas`, o un `grant select` sobre las credenciales;
//   · la bandeja (Paso 4, `081`): el mismo aviso dos veces se guarda una sola, con la location tal cual; el mismo id en
//     dos ámbitos son dos avisos; un proveedor que no está en el catálogo no entra — mutación: sacar la tabla de
//     claves de la puerta, o sacar el ámbito de su clave;
//   · sólo el ingestor ejecuta la puerta, y no lee nada; el normalizador lee y no inserta — mutación: un `grant
//     select` al ingestor, o un `grant execute` a public;
//   · la partición del mes existe y la de por omisión está vacía — mutación: no crear las del mes;
//   · ninguna política de identidad ni de negocio nombra al migrador, y ninguna función elevada es de public —
//     mutación: la política de lectura de cuentas que el diseño daba a la puerta;
//   · la cuenta en negocio (Paso 5, `082` y la fase `cuenta-en-negocio`): las listas de tablas de los SQL son las de
//     los regímenes — mutación: olvidar una tabla en un archivo;
//   · el puente pone la cuenta del contacto, con dos cuentas activas cae en la por omisión (desde la `085`), sin
//     ninguna por omisión exige decirla, y no deja mudarla — mutación: quitar el disparador, o su rama de update;
//   · la fase rellena una fila vieja sin cuenta, y no toca otra organización (eso lo garantiza la política de hoy,
//     porque corre como el inquilino con su organización puesta) — mutación: sacarle una tabla a la fase;
//   · la 083: la columna de cada tabla es la de su régimen (obligatoria, nulable o ninguna) y la política de las 39
//     pide la cuenta — mutación: dejar una nulable, o una política de sólo organización;
//   · sin `app.cuentas` el inquilino no ve ningún contacto, con `'*'` los ve — mutación: la política de hoy;
//   · una cita no puede quedar en otra cuenta que su contacto — mutación: quitar la clave «misma cuenta»;
//   · los eventos (Paso 6, `084`): el inquilino agrega y no edita ni borra — mutación: no revocar update/delete;
//   · toda partición nace cerrada, sin permisos para la aplicación y con la RLS forzada — mutación: la
//     `crear_particiones` de la `081`, que sólo revocaba a public;
//   · un evento necesita un tipo y un proveedor del catálogo, y la partición del mes existe — mutación: no crear las
//     del mes;
//   · las particiones cubren 24 meses hacia atrás y 36 hacia adelante (eventos) y el mes en curso más 36 (bandeja) —
//     mutación: volver a los seis meses.
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
  NACIERON_CON_CUENTA,
  NACIERON_DESPUES_DE_LA_086,
  DE_UNA_CUENTA_DESPUES_DE_LA_086,
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
  // Al menos: un tipo nuevo es un INSERT versionado y no tiene por qué romper esta prueba.
  assert.ok((f?.eventos ?? 0) >= 42, `hay ${f?.eventos} tipos de evento sembrados; se esperaban al menos 42`);
  assert.equal(f?.sin_esquema, 0, 'un tipo de evento no tiene el JSON Schema de sus datos');
  assert.ok((f?.monedas ?? 0) > 0 && (f?.paises ?? 0) > 0, 'faltan monedas o países');

  const claves = new Set(
    (await filas<{ clave: string }>(mig, `select clave from catalogo.tipos_de_evento`)).map((x) => x.clave),
  );
  for (const k of ['etapa_cambiada', 'salida_marcada', 'cuadrante_cambiado', 'calificado', 'respondio_video', 'conexion_confirmada', 'cita_estado_cambiado']) {
    assert.ok(claves.has(k), `falta el tipo de evento ${k}`);
  }
  // El dominio nutrición tiene sus tipos (listas del SOP), aunque todavía nada los escriba.
  const nutricion = await filas<{ clave: string }>(mig, `select clave from catalogo.tipos_de_evento where dominio = 'nutricion' order by clave`);
  assert.deepEqual(nutricion.map((x) => x.clave), ['email_enviado', 'entro_a_nutricion', 'reactivado', 'salio_de_nutricion']);
  for (const k of ['perdido', 'precall_abierto']) assert.ok(!claves.has(k), `quedó el tipo ${k}, que el SOP reemplazó`);
  // El tipo de cita es un catálogo (el destino del mapeo «calendario»), no un CHECK: sólo la de venta es de venta.
  assert.deepEqual(await filas(mig, `select clave, es_de_venta from catalogo.tipos_de_cita order by clave`), [
    { clave: 'coaching', es_de_venta: false },
    { clave: 'onboarding', es_de_venta: false },
    { clave: 'otra', es_de_venta: false },
    { clave: 'venta', es_de_venta: true },
  ]);

  // Sólo etapa_cambiada registra la etapa; los demás dicen, a lo sumo, la etapa que deberían implicar.
  const marcan = await filas<{ clave: string; etapa: string | null }>(
    mig,
    `select clave, etapa_que_marca as etapa from catalogo.tipos_de_evento
      where clave in ('clasificado', 'calificado', 'pidio_no_contacto', 'onboarding_hecho', 'etapa_cambiada') order by clave`,
  );
  assert.deepEqual(marcan, [
    { clave: 'calificado', etapa: 'calificado' },
    { clave: 'clasificado', etapa: null },
    { clave: 'etapa_cambiada', etapa: null },
    { clave: 'onboarding_hecho', etapa: 'onboarding' },
    { clave: 'pidio_no_contacto', etapa: null },
  ]);
});

test('las etapas son las 7 del Pipeline Maestro: venta no es final, onboarding sí, y perdido es una Salida', async () => {
  const etapas = await filas<{ clave: string; orden: number; es_final: boolean }>(
    mig,
    `select clave, orden, es_final from catalogo.etapas order by orden`,
  );
  assert.deepEqual(etapas, [
    { clave: 'lead', orden: 1, es_final: false },
    { clave: 'conversacion', orden: 2, es_final: false },
    { clave: 'calificado', orden: 3, es_final: false },
    { clave: 'agendado', orden: 4, es_final: false },
    { clave: 'asistio', orden: 5, es_final: false },
    { clave: 'venta', orden: 6, es_final: false },
    { clave: 'onboarding', orden: 7, es_final: true },
  ]);
  const salidas = await filas<{ clave: string }>(mig, `select clave from catalogo.salidas order by orden`);
  assert.deepEqual(
    salidas.map((s) => s.clave),
    ['descarta', 'no_show', 'seguimiento', 'adelanto', 'nurture', 'descalificado', 'nutricion', 'no_rotundo'],
  );
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
    await inq.query(`select set_config('app.cuentas', '*', true), set_config('app.toda_la_organizacion', 'si', true)`);
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
    const recibir = `select recibido_id, ya_estaba from ingesta.recibir('ghl', 'loc-257', 'ContactCreate', 'aviso-257', $1::jsonb, 'loc-257')`;
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

    // El mismo id en OTRO ámbito (otra location, otra empresa) es otro aviso: no se pierde en silencio.
    const otra = await unaFila<{ ya_estaba: boolean }>(
      admin,
      `select ya_estaba from ingesta.recibir('ghl', 'loc-257-b', 'ContactCreate', 'aviso-257', '{}'::jsonb, 'loc-257-b')`,
    );
    assert.equal(otra?.ya_estaba, false, 'el mismo id de otro ámbito se tomó por un reintento');

    // Y un proveedor que no está en el catálogo no entra (la clave foránea a catalogo.proveedores).
    await admin.query('savepoint s');
    await assert.rejects(
      admin.query(`select ingesta.recibir('no_existe_257', 'loc-257', 'X', 'aviso-257-c', '{}'::jsonb)`),
      (e: { code?: string }) => e.code === '23503',
      'entró un aviso de un proveedor que no está en catalogo.proveedores',
    );
    await admin.query('rollback to savepoint s');
  } finally {
    await admin.query('rollback');
  }
});

test('sólo el ingestor ejecuta la puerta, y no lee nada; el normalizador lee y no inserta', async () => {
  const FIRMA = 'ingesta.recibir(text, text, text, text, jsonb, text)';
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

// ─── Paso 5 · La cuenta en negocio ──────────────────────────────────────────────

/** Las tablas de un `array[...]` de un archivo SQL, en el orden en que aparecen. */
function listaDelSql(texto: string, variable: string): string[] {
  const m = new RegExp(`${variable}\\s+text\\[\\]\\s*:=\\s*array\\[([^\\]]*)\\]`).exec(texto);
  assert.ok(m, `no encontré ${variable} en el archivo`);
  return [...m[1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]!);
}

test('las listas de tablas de los SQL de la cuenta son las de los regímenes', () => {
  const ordenar = (xs: readonly string[]) => [...xs].sort();
  for (const archivo of ['db/migraciones/082_la_cuenta_en_negocio_expandir.sql', 'db/arranque/005_la_cuenta_en_negocio.sql']) {
    const sql = readFileSync(join(RAIZ, archivo), 'utf8');
    const rellenadas = DE_UNA_CUENTA.filter((t) => !(NACIERON_CON_CUENTA as readonly string[]).includes(t));
    assert.deepEqual(ordenar(listaDelSql(sql, 'v_obligatorias')), ordenar(rellenadas), `${archivo}: las obligatorias`);
    /* La fase 005 deja los sellos del cron sin cuenta (el nivel 3, `090`): son de la empresa. La 082 sí los lista,
       porque su política es la de las opcionales. */
    const opcionales = archivo.includes('005_')
      ? DE_UNA_CUENTA_O_DE_LA_ORGANIZACION.filter((t) => t !== 'tareas_programadas')
      : DE_UNA_CUENTA_O_DE_LA_ORGANIZACION;
    assert.deepEqual(ordenar(listaDelSql(sql, 'v_opcionales')), ordenar(opcionales), `${archivo}: las opcionales`);
  }
  // La 086 (el nivel 3) rehace la política de las TRES listas, con las que nacieron con cuenta.
  const sql = readFileSync(join(RAIZ, 'db/migraciones/086_la_organizacion_entera.sql'), 'utf8');
  assert.deepEqual(
    ordenar(listaDelSql(sql, 'v_obligatorias')),
    ordenar(DE_UNA_CUENTA.filter((t) => !(DE_UNA_CUENTA_DESPUES_DE_LA_086 as readonly string[]).includes(t))),
    '086: las obligatorias',
  );
  assert.deepEqual(ordenar(listaDelSql(sql, 'v_opcionales')), ordenar(DE_UNA_CUENTA_O_DE_LA_ORGANIZACION), '086: las opcionales');
  assert.deepEqual(
    ordenar(listaDelSql(sql, 'v_de_la_organizacion')),
    ordenar(DE_LA_ORGANIZACION.filter((t) => !(NACIERON_DESPUES_DE_LA_086 as readonly string[]).includes(t))),
    '086: las de la organización',
  );
});

test('el puente pone la cuenta del contacto, con dos activas cae en la por omisión, y no deja mudarla', async () => {
  const org = await unaFila<{ id: string; cuenta: string }>(
    admin,
    `select o.id, c.id as cuenta from identidad.organizaciones o join identidad.cuentas c on c.org_id = o.id where o.slug = 'alfa'`,
  );
  assert.ok(org, 'falta el sembrado');
  await admin.query('begin');
  try {
    // Sin cuenta_id: el puente pone la única cuenta activa de la organización.
    const contacto = await unaFila<{ id: string; cuenta_id: string }>(
      admin,
      `insert into negocio.contactos (org_id, ghl_contact_id, nombre) values ($1, 'puente-257', 'Puente') returning id, cuenta_id`,
      [org.id],
    );
    assert.equal(contacto?.cuenta_id, org.cuenta);
    // La nota de ese contacto toma la cuenta del CONTACTO.
    const nota = await unaFila<{ cuenta_id: string }>(
      admin,
      `insert into negocio.notas (org_id, contacto_id, cuerpo) values ($1, $2, 'nota 257') returning cuenta_id`,
      [org.id, contacto!.id],
    );
    assert.equal(nota?.cuenta_id, org.cuenta);

    // Una fila no se muda de cuenta.
    await admin.query('savepoint s');
    const otra = await unaFila<{ id: string }>(
      admin,
      `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Segunda 257', 'segunda-257') returning id`,
      [org.id],
    );
    await assert.rejects(
      admin.query(`update negocio.contactos set cuenta_id = $1 where id = $2`, [otra!.id, contacto!.id]),
      /no se puede cambiar/,
      'una fila se mudó de cuenta',
    );
    await admin.query('rollback to savepoint s');

    // Con dos cuentas activas cae en la por omisión (085): dar de alta un segundo cliente no corta la ingesta.
    await admin.query(`insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Segunda 257', 'segunda-257')`, [org.id]);
    const segundo = await unaFila<{ cuenta_id: string }>(
      admin,
      `insert into negocio.contactos (org_id, ghl_contact_id, nombre) values ($1, 'puente-257-b', 'Puente') returning cuenta_id`,
      [org.id],
    );
    assert.equal(segundo?.cuenta_id, org.cuenta, 'con dos cuentas activas el puente no cayó en la por omisión');

    // Y sin ninguna por omisión, quien inserta tiene que decir de cuál es.
    await admin.query('savepoint t');
    await admin.query(`update identidad.cuentas set es_por_omision = false where id = $1`, [org.cuenta]);
    await assert.rejects(
      admin.query(`insert into negocio.contactos (org_id, ghl_contact_id, nombre) values ($1, 'puente-257-c', 'Puente')`, [org.id]),
      /tiene 2 cuentas activas y ninguna por omisión/,
      'con dos cuentas activas y sin por omisión el puente eligió una',
    );
    await admin.query('rollback to savepoint t');
  } finally {
    await admin.query('rollback');
  }
});

test('la fase `cuenta-en-negocio` rellena una fila vieja sin cuenta, y no toca otra organización', async () => {
  const alfa = await unaFila<{ id: string; cuenta: string }>(
    admin,
    `select o.id, c.id as cuenta from identidad.organizaciones o join identidad.cuentas c on c.org_id = o.id where o.slug = 'alfa'`,
  );
  const beta = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'beta'`);
  assert.ok(alfa && beta, 'falta el sembrado');
  // Dos filas «de antes de la 082», sin cuenta: se insertan sin disparadores de usuario (session_replication_role), que
  // es como las deja la 082 sobre los datos de hoy. En una tabla donde la cuenta es OPCIONAL (el uso de la IA): desde
  // la 083 una obligatoria ya no admite una fila sin cuenta, que es justo lo que la 083 cierra.
  await admin.query(`set session_replication_role = replica`);
  try {
    await admin.query(
      `insert into negocio.uso_de_ia (org_id, agente, modelo, duracion_ms, resultado, cuenta_id)
         values ($1, 'plan', 'viejo-257-alfa', 1, 'ok', null), ($2, 'plan', 'viejo-257-beta', 1, 'ok', null)`,
      [alfa.id, beta.id],
    );
  } finally {
    await admin.query(`set session_replication_role = origin`);
  }
  const inq = await conectar('inquilino');
  try {
    await inq.query('begin');
    await inq.query(`select set_config('app.org_id', $1, true), set_config('app.cuentas', '*', true),
                            set_config('app.toda_la_organizacion', 'si', true)`, [alfa.id]);
    await inq.query(readFileSync(join(RAIZ, 'db/arranque/005_la_cuenta_en_negocio.sql'), 'utf8'));
    await inq.query('commit');
    const filas_ = await filas<{ modelo: string; cuenta_id: string | null }>(
      admin,
      `select modelo, cuenta_id from negocio.uso_de_ia where modelo like 'viejo-257-%' order by 1`,
    );
    assert.deepEqual(filas_, [
      { modelo: 'viejo-257-alfa', cuenta_id: alfa.cuenta },
      { modelo: 'viejo-257-beta', cuenta_id: null },
    ], 'la fase no rellenó la fila de su organización, o tocó la de otra');
  } finally {
    await inq.end();
    await admin.query(`delete from negocio.uso_de_ia where modelo like 'viejo-257-%'`);
  }
});

test('la columna de cada tabla es la de su régimen, y la política de las 39 pide la cuenta', async () => {
  const columnas = await filas<{ tabla: string; obligatoria: boolean | null; politica: string | null }>(
    admin,
    `select c.relname as tabla,
            (select a.attnotnull from pg_attribute a where a.attrelid = c.oid and a.attname = 'cuenta_id' and not a.attisdropped) as obligatoria,
            (select pg_get_expr(p.polqual, p.polrelid) from pg_policy p where p.polrelid = c.oid and p.polname = 'aislamiento') as politica
       from pg_class c where c.relnamespace = 'negocio'::regnamespace and c.relkind in ('r', 'p') and not c.relispartition`,
  );
  const de = new Map(columnas.map((x) => [x.tabla, x]));
  const malas: string[] = [];
  for (const t of DE_UNA_CUENTA) {
    if (de.get(t)?.obligatoria !== true) malas.push(`${t}: cuenta_id tendría que ser obligatoria`);
  }
  for (const t of DE_UNA_CUENTA_O_DE_LA_ORGANIZACION) {
    if (de.get(t)?.obligatoria !== false) malas.push(`${t}: cuenta_id tendría que existir y ser nulable`);
  }
  for (const t of DE_LA_ORGANIZACION) {
    if (de.get(t)?.obligatoria != null) malas.push(`${t}: es de la organización y tiene cuenta_id`);
  }
  for (const t of [...DE_UNA_CUENTA, ...DE_UNA_CUENTA_O_DE_LA_ORGANIZACION]) {
    if (!/app\.cuentas/.test(de.get(t)?.politica ?? '')) malas.push(`${t}: la política no pide la cuenta`);
  }
  for (const t of DE_LA_ORGANIZACION) {
    if (/app\.cuentas/.test(de.get(t)?.politica ?? '')) malas.push(`${t}: es de la organización y su política pide la cuenta`);
  }
  // Desde la 086 (el nivel 3), toda política pide además la organización entera: para lo de la organización, y para
  // que «todas las cuentas» no le sirva al cliente final.
  for (const t of [...DE_UNA_CUENTA, ...DE_UNA_CUENTA_O_DE_LA_ORGANIZACION, ...DE_LA_ORGANIZACION]) {
    if (!/app\.toda_la_organizacion/.test(de.get(t)?.politica ?? '')) malas.push(`${t}: la política no pide la organización entera`);
  }
  assert.deepEqual(malas, []);
});

test('sin `app.cuentas` el inquilino no ve ningún contacto; con `*` ve los de su organización', async () => {
  const org = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'alfa'`);
  assert.ok(org);
  await admin.query(`insert into negocio.contactos (org_id, ghl_contact_id, nombre) values ($1, 'visible-257', 'Visible')`, [org.id]);
  const inq = await conectar('inquilino');
  try {
    await inq.query('begin');
    await inq.query(`select set_config('app.org_id', $1, true)`, [org.id]);
    const sin = await unaFila<{ n: number }>(inq, `select count(*)::int as n from negocio.contactos where ghl_contact_id = 'visible-257'`);
    assert.equal(sin?.n, 0, 'sin app.cuentas se vio un contacto: la política no falla cerrada');
    await inq.query(`select set_config('app.cuentas', '*', true), set_config('app.toda_la_organizacion', 'si', true)`);
    const con = await unaFila<{ n: number }>(inq, `select count(*)::int as n from negocio.contactos where ghl_contact_id = 'visible-257'`);
    assert.equal(con?.n, 1);
    await inq.query('rollback');
  } finally {
    await inq.end();
    await admin.query(`delete from negocio.contactos where ghl_contact_id = 'visible-257'`);
  }
});

test('una cita no puede quedar en otra cuenta que su contacto', async () => {
  const org = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'alfa'`);
  assert.ok(org);
  await admin.query('begin');
  try {
    const contacto = await unaFila<{ id: string }>(
      admin,
      `insert into negocio.contactos (org_id, ghl_contact_id, nombre) values ($1, 'madre-257', 'Madre') returning id`,
      [org.id],
    );
    const otra = await unaFila<{ id: string }>(
      admin,
      `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Otra 257', 'otra-257') returning id`,
      [org.id],
    );
    await assert.rejects(
      admin.query(`insert into negocio.notas (org_id, cuenta_id, contacto_id, cuerpo) values ($1, $2, $3, 'nota en otra cuenta')`, [
        org.id,
        otra!.id,
        contacto!.id,
      ]),
      (e: { code?: string }) => e.code === '23503',
      'una nota quedó en otra cuenta que su contacto',
    );
  } finally {
    await admin.query('rollback');
  }
});

// ─── Paso 6 · Los eventos ───────────────────────────────────────────────────────

test('el inquilino agrega eventos y no los edita ni los borra; el tipo tiene que existir en el catálogo', async () => {
  const org = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'alfa'`);
  assert.ok(org);
  const f = await unaFila<Record<string, boolean>>(
    admin,
    `select has_table_privilege('app_inquilino', 'negocio.eventos', 'insert') as inserta,
            has_table_privilege('app_inquilino', 'negocio.eventos', 'select') as lee,
            has_table_privilege('app_inquilino', 'negocio.eventos', 'update') as edita,
            has_table_privilege('app_inquilino', 'negocio.eventos', 'delete') as borra,
            has_table_privilege('app_inquilino', 'negocio.eventos', 'truncate') as vacia`,
  );
  assert.deepEqual(f, { inserta: true, lee: true, edita: false, borra: false, vacia: false });

  const inq = await conectar('inquilino');
  try {
    await inq.query('begin');
    await inq.query(`select set_config('app.org_id', $1, true), set_config('app.cuentas', '*', true),
                            set_config('app.toda_la_organizacion', 'si', true)`, [org.id]);
    const tipo = await unaFila<{ clave: string }>(inq, `select clave from catalogo.tipos_de_evento order by clave limit 1`);
    assert.ok(tipo);
    // El puente le pone la cuenta.
    const ev = await unaFila<{ cuenta_id: string | null }>(
      inq,
      `insert into negocio.eventos (org_id, ocurrio_el, tipo, actor_tipo, fuente, id_externo)
         values ($1, now(), $2, 'sistema', 'comando_central', 'evento-257') returning cuenta_id`,
      [org.id, tipo.clave],
    );
    assert.ok(ev?.cuenta_id, 'el evento nació sin cuenta');
    await inq.query('savepoint s');
    await assert.rejects(
      inq.query(`insert into negocio.eventos (org_id, ocurrio_el, tipo, actor_tipo, fuente, id_externo)
                   values ($1, now(), 'no_existe_257', 'sistema', 'comando_central', 'evento-257-b')`, [org.id]),
      (e: { code?: string }) => e.code === '23503',
      'entró un evento de un tipo que no está en el catálogo',
    );
    await inq.query('rollback to savepoint s');
    // El proveedor también es del catálogo: una clave foránea, no una lista cerrada.
    await inq.query('savepoint p');
    await assert.rejects(
      inq.query(`insert into negocio.eventos (org_id, ocurrio_el, tipo, actor_tipo, fuente, id_externo)
                   values ($1, now(), $2, 'sistema', 'no_existe_257', 'evento-257-c')`, [org.id, tipo.clave]),
      (e: { code?: string }) => e.code === '23503',
      'entró un evento de un proveedor que no está en catalogo.proveedores',
    );
    await inq.query('rollback to savepoint p');
    await assert.rejects(inq.query(`update negocio.eventos set actor_id = 'x' where id_externo = 'evento-257'`), /permis|permission/i);
    await inq.query('rollback');
  } finally {
    await inq.end();
  }
});

test('toda partición nace cerrada: sin permisos para la aplicación, con la RLS forzada; y la del mes existe', async () => {
  const particiones = await filas<{ tabla: string; forzada: boolean; algun_permiso: boolean }>(
    admin,
    `select n.nspname || '.' || c.relname as tabla, c.relforcerowsecurity as forzada,
            exists (select 1 from unnest(array['app_inquilino', 'app_identidad', 'app_ingesta', 'app_analista']) r
                     where has_table_privilege(r, c.oid, 'select') or has_table_privilege(r, c.oid, 'insert')) as algun_permiso
       from pg_inherits i join pg_class c on c.oid = i.inhrelid join pg_namespace n on n.oid = c.relnamespace
      where i.inhparent in ('ingesta.recibidos'::regclass, 'negocio.eventos'::regclass) order by 1`,
  );
  assert.ok(particiones.length >= 14, `se esperaban al menos 14 particiones; hay ${particiones.length}`);
  assert.deepEqual(
    particiones.filter((p) => !p.forzada || p.algun_permiso).map((p) => p.tabla),
    [],
    'una partición se puede leer directo: no hereda la política de su madre',
  );
  const f = await unaFila<{ del_mes: boolean; en_el_resto: number }>(
    admin,
    `select exists (select 1 from pg_class where relnamespace = 'negocio'::regnamespace
                     and relname = 'eventos_' || to_char(now() at time zone 'UTC', 'YYYY_MM')) as del_mes,
            (select count(*)::int from negocio.eventos_resto) as en_el_resto`,
  );
  assert.deepEqual(f, { del_mes: true, en_el_resto: 0 });
});

test('las particiones cubren la historia: eventos 24 meses atrás y 36 adelante, la bandeja el mes y 36 más', async () => {
  const f = await unaFila<Record<string, boolean | number>>(
    admin,
    `with meses as (
       select to_char(date_trunc('month', now() at time zone 'UTC') + make_interval(months => i), 'YYYY_MM') as mes, i
         from generate_series(-24, 36) i)
     select bool_and(exists (select 1 from pg_class where relnamespace = 'negocio'::regnamespace and relname = 'eventos_' || mes)) as eventos,
            bool_and(exists (select 1 from pg_class where relnamespace = 'ingesta'::regnamespace and relname = 'recibidos_' || mes))
              filter (where i >= 0) as recibidos,
            (select count(*)::int from ingesta.recibidos_resto) as recibidos_resto,
            (select count(*)::int from negocio.eventos_resto) as eventos_resto
       from meses`,
  );
  assert.deepEqual(f, { eventos: true, recibidos: true, recibidos_resto: 0, eventos_resto: 0 });
});
