// ADR-0212 — Toda tabla de negocio tiene la forma que cierra las dos verificaciones que
// NO pasan por la seguridad a nivel de fila. INNEGOCIABLE.
// Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA POLÍTICA NO ES SUFICIENTE, Y ESTO NO ES TEÓRICO
//
// PostgreSQL valida la UNICIDAD y las CLAVES FORÁNEAS por debajo de las políticas: las
// dos corren con los privilegios del dueño de la tabla, así que la política del inquilino
// no participa. Una tabla puede tener el régimen entero bien puesto —`enable`, `force`,
// `revoke`, `using`, `with check`— y seguir filtrando por ahí.
//
// Las dos fugas están MEDIDAS contra esta base, no deducidas:
//
//   · ORÁCULO DE EXISTENCIA. Con `id uuid primary key` —un índice único GLOBAL— el
//     inquilino de alfa pregunta si un id existe en CUALQUIER organización con un
//     `insert … on conflict (id) do nothing`: devuelve "0 filas" si ya existe y "1 fila"
//     si no. Sin error y sin ruido.
//
//   · REFERENCIA CRUZADA. Con `madre_id uuid references madre(id)`, el inquilino de alfa
//     inserta una fila propia que APUNTA a una fila de beta — una fila que en la misma
//     transacción NO PUEDE VER. Medido, literal: "¿el padre es visible? NO -> ACEPTADO".
//     No es un canal lateral de un bit: es una fila de alfa que depende de una fila de
//     beta, con todo lo que eso arrastra.
//
// La única defensa es la FORMA de la tabla. `negocio.aplicar_aislamiento()` la exige
// antes de proteger nada, y esta prueba comprueba las dos mitades: que la exigencia
// FUNCIONA (rechaza cada forma mal hecha) y que el catálogo real la cumple.
//
// Por qué las dos y no una: la función previene AL CREAR, y no puede ver un índice único
// o una clave foránea agregados por un `alter table` posterior a la llamada. La prueba de
// catálogo sí los ve.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { conectar, cerrarTodo, filas } from '../apoyo/conexiones.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { conIdentidad, cerrarClientes } from '../../lib/datos/capa.ts';

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

async function dosOrganizaciones(): Promise<{ alfa: string; beta: string }> {
  return conIdentidad(async (db) => {
    const f = await db
      .selectFrom('organizaciones')
      .select(['id', 'slug'])
      .where('slug', 'in', ['alfa', 'beta'])
      .execute();
    const alfa = f.find((x) => x.slug === 'alfa')?.id;
    const beta = f.find((x) => x.slug === 'beta')?.id;
    assert.ok(alfa && beta, 'faltan las organizaciones alfa y beta: ¿corrió el sembrado?');
    return { alfa, beta };
  });
}

// La forma de cada tabla de `negocio`, leída del catálogo. Las cuatro columnas son las
// cuatro condiciones que exige `aplicar_aislamiento()`, escritas acá otra vez a
// propósito: si la función se debilitara, esta consulta seguiría diciendo la verdad.
const FORMA = `
  select c.oid::regclass::text as tabla,
         (select count(*) from pg_attribute a
           where a.attrelid = c.oid and a.attname = 'org_id'
             and a.attnum > 0 and not a.attisdropped and a.attnotnull) as org_id_no_nulo,
         (select count(*) from pg_index i
           where i.indrelid = c.oid and i.indisunique
             and not exists (select 1 from unnest(i.indkey) as k(n)
                             join pg_attribute a on a.attrelid = c.oid and a.attnum = k.n
                             where a.attname = 'org_id')) as unicos_sin_org,
         (select count(*) from pg_index i
           join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
           where i.indrelid = c.oid and i.indisprimary and a.attname = 'org_id') as org_id_primero,
         (select count(*) from pg_constraint f
           join pg_class rf on rf.oid = f.confrelid
           join pg_namespace nf on nf.oid = rf.relnamespace
           where f.conrelid = c.oid and f.contype = 'f' and nf.nspname = 'negocio'
             and not exists (
               select 1 from generate_subscripts(f.conkey, 1) as k(i)
               join pg_attribute al on al.attrelid = f.conrelid  and al.attnum = f.conkey[k.i]
               join pg_attribute ar on ar.attrelid = f.confrelid and ar.attnum = f.confkey[k.i]
               where al.attname = 'org_id' and ar.attname = 'org_id')) as fk_sin_org
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'negocio' and c.relkind = 'r'
   order by 1
`;

interface Forma {
  tabla: string;
  org_id_no_nulo: string;
  unicos_sin_org: string;
  org_id_primero: string;
  fk_sin_org: string;
}

test('ADR-0212 · toda tabla de negocio tiene la forma que cierra las dos fugas', async () => {
  const migrador = await conectar('migrador');
  const tablas = await filas<Forma>(migrador, FORMA);

  // La guarda contra el falso verde: sin tablas, un bucle vacío pasa.
  assert.ok(tablas.length > 0, 'no hay ni una tabla de negocio: la prueba pasaría en vacío');

  for (const t of tablas) {
    assert.equal(t.org_id_no_nulo, '1', `${t.tabla}: org_id falta o admite nulos`);
    assert.equal(
      t.unicos_sin_org,
      '0',
      `${t.tabla}: ${t.unicos_sin_org} índice(s) único(s) sin org_id adentro — ` +
        'la verificación de unicidad no pasa por la seguridad de fila, así que eso es un ' +
        'oráculo de existencia entre organizaciones',
    );
    assert.equal(
      t.org_id_primero,
      '1',
      `${t.tabla}: org_id no es la primera columna de la clave primaria`,
    );
    assert.equal(
      t.fk_sin_org,
      '0',
      `${t.tabla}: ${t.fk_sin_org} clave(s) foránea(s) a negocio sin org_id de los dos ` +
        'lados — una fila propia puede apuntar a una fila ajena, y la validación de la ' +
        'clave foránea no pasa por la seguridad de fila',
    );
  }
});

test('ADR-0212 · `aplicar_aislamiento` RECHAZA cada forma mal hecha', async () => {
  // Todo corre como `migrador` dentro de una transacción que se REVIERTE. El DDL de
  // PostgreSQL es transaccional, así que no queda nada: ni tabla, ni política, ni
  // permiso. Y con una sola conexión no hay carrera con la prueba de catálogo de arriba.
  const migrador = await conectar('migrador');

  /** Aplica el DDL y devuelve el mensaje de error, o `null` si fue aceptado. */
  async function probar(ddl: string): Promise<string | null> {
    await migrador.query('begin');
    try {
      await migrador.query(ddl);
      return null;
    } catch (e) {
      return String((e as Error).message);
    } finally {
      await migrador.query('rollback');
    }
  }

  const CORRECTA = `
    create table negocio.sonda (
      id uuid not null default gen_random_uuid(),
      org_id uuid not null references identidad.organizaciones(id),
      primary key (org_id, id));
    select negocio.aplicar_aislamiento('negocio.sonda');`;

  // LA GUARDA CONTRA EL FALSO VERDE, y acá es la mitad que decide si la prueba vale: si
  // la forma correcta también fuera rechazada, todos los rechazos de abajo estarían
  // pasando por el motivo equivocado y la función sería inservible.
  assert.equal(await probar(CORRECTA), null, 'la forma CORRECTA fue rechazada');

  const casos: [string, string, string][] = [
    [
      'clave primaria global (`id uuid primary key`) — el oráculo de existencia',
      `create table negocio.sonda (
         id uuid primary key default gen_random_uuid(),
         org_id uuid not null references identidad.organizaciones(id));
       select negocio.aplicar_aislamiento('negocio.sonda');`,
      'índices únicos sin org_id',
    ],
    [
      'org_id en la clave primaria pero NO primero',
      `create table negocio.sonda (
         id uuid not null default gen_random_uuid(),
         org_id uuid not null references identidad.organizaciones(id),
         primary key (id, org_id));
       select negocio.aplicar_aislamiento('negocio.sonda');`,
      'no es la primera columna',
    ],
    [
      'una restricción `unique` sin la organización adentro',
      `create table negocio.sonda (
         id uuid not null default gen_random_uuid(),
         org_id uuid not null references identidad.organizaciones(id),
         marca text not null unique,
         primary key (org_id, id));
       select negocio.aplicar_aislamiento('negocio.sonda');`,
      'índices únicos sin org_id',
    ],
    [
      'un `create unique index` suelto, que no es una restricción',
      `create table negocio.sonda (
         id uuid not null default gen_random_uuid(),
         org_id uuid not null references identidad.organizaciones(id),
         marca text not null,
         primary key (org_id, id));
       create unique index sonda_marca on negocio.sonda (marca);
       select negocio.aplicar_aislamiento('negocio.sonda');`,
      'índices únicos sin org_id',
    ],
    [
      'org_id que admite nulos — una fila que no ve NADIE',
      // Ojo con este caso, porque enseña algo: estar en la clave primaria hace que
      // PostgreSQL le ponga `not null` a la columna SOLO. Así que la forma correcta
      // —org_id primero en la clave primaria— nunca puede tener org_id nulo, y para
      // llegar a esta comprobación hay que sacar org_id de la clave primaria, que YA es
      // una violación. La comprobación se queda igual: es la que sigue diciendo la verdad
      // si algún día la forma de la clave primaria cambia.
      `create table negocio.sonda (
         id uuid primary key default gen_random_uuid(),
         org_id uuid references identidad.organizaciones(id));
       select negocio.aplicar_aislamiento('negocio.sonda');`,
      'admite nulos',
    ],
    [
      'org_id que no nombra una organización de verdad',
      `create table negocio.sonda (
         id uuid not null default gen_random_uuid(),
         org_id uuid not null,
         primary key (org_id, id));
       select negocio.aplicar_aislamiento('negocio.sonda');`,
      'no referencia identidad.organizaciones',
    ],
    [
      'una clave foránea a negocio con las columnas CRUZADAS',
      // El caso reachable de la quinta condición: la madre tiene `unique (id, org_id)`,
      // que lleva org_id adentro y por lo tanto pasa las otras condiciones. La hija
      // declara `(org_id, madre_id) references madre (id, org_id)`: las dos columnas
      // están, pero APAREADAS AL REVÉS, así que la clave foránea no ata nada.
      `create table negocio.sonda_madre (
         id uuid not null default gen_random_uuid(),
         org_id uuid not null references identidad.organizaciones(id),
         primary key (org_id, id),
         unique (id, org_id));
       select negocio.aplicar_aislamiento('negocio.sonda_madre');
       create table negocio.sonda (
         id uuid not null default gen_random_uuid(),
         org_id uuid not null references identidad.organizaciones(id),
         madre_id uuid not null,
         primary key (org_id, id),
         foreign key (org_id, madre_id) references negocio.sonda_madre (id, org_id));
       select negocio.aplicar_aislamiento('negocio.sonda');`,
      'sin org_id de los dos lados',
    ],
  ];

  for (const [nombre, ddl, fragmento] of casos) {
    const error = await probar(ddl);
    assert.ok(error !== null, `${nombre}: fue ACEPTADA y no debería`);
    assert.ok(
      error.includes(fragmento),
      `${nombre}: rechazada por otro motivo — se esperaba "${fragmento}" y salió: ${error}`,
    );
  }
});

test('ADR-0212 · la clave primaria compuesta hace IMPOSIBLE la clave foránea ingenua', async () => {
  // El resultado más fuerte de los tres, y sale gratis: con `primary key (org_id, id)`,
  // `id` deja de ser único por sí solo, así que `references control_aislamiento(id)` ni
  // se puede declarar. PostgreSQL lo rechaza antes de que nadie tenga que acordarse.
  const migrador = await conectar('migrador');
  await migrador.query('begin');
  let error: string | null = null;
  try {
    await migrador.query(`
      create table negocio.sonda_hija (
        id uuid not null default gen_random_uuid(),
        org_id uuid not null references identidad.organizaciones(id),
        control_id uuid not null references negocio.control_aislamiento(id),
        primary key (org_id, id))`);
  } catch (e) {
    error = String((e as Error).message);
  } finally {
    await migrador.query('rollback');
  }

  assert.ok(error !== null, 'la clave foránea a una sola columna fue aceptada');
  assert.match(
    error,
    /no unique constraint|no hay restricción unique/i,
    `rechazada por otro motivo: ${error}`,
  );
});

test('ADR-0212 · y el oráculo de existencia quedó CERRADO', async () => {
  // La sonda que funcionaba con la clave primaria global: parado en alfa, insertar una
  // fila con el id de una fila de beta. Con `primary key (org_id, id)` el par es
  // distinto, así que no hay conflicto: el insert entra y no dice una palabra de beta.
  const { alfa, beta } = await dosOrganizaciones();

  const idDeBeta = await conOrganizacion(beta, async () => {
    const f = await datos().selectFrom('control_aislamiento').select('id').executeTakeFirstOrThrow();
    return f.id;
  });

  const insertadas = await conOrganizacion(alfa, async () => {
    const r = await sql<{ id: string }>`
      insert into control_aislamiento (id, org_id, marca)
      values (${idDeBeta}, ${alfa}, 'sonda-del-oraculo')
      on conflict do nothing
      returning id
    `.execute(datos());
    // Se limpia en el mismo contexto que la creó. La fila no tiene por qué sobrevivir.
    await sql`delete from control_aislamiento where marca = 'sonda-del-oraculo'`.execute(datos());
    return r.rows.length;
  });

  assert.equal(
    insertadas,
    1,
    'el insert reportó conflicto con el id de otra organización: el oráculo sigue abierto',
  );
});
