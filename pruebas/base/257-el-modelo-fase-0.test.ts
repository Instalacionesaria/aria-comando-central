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
//     perder un bloque de semillas.
//
// Corre como `migrador`: es una comprobación de catálogo, y el migrador ve la estructura aunque no vea las filas.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import {
  DE_LA_ORGANIZACION,
  DE_UNA_CUENTA,
  DE_UNA_CUENTA_O_DE_LA_ORGANIZACION,
} from '../apoyo/regimenes-de-negocio.ts';

let mig: Client;
let admin: Client;

before(async () => {
  mig = await conectar('migrador');
  admin = await conectar('admin');
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
