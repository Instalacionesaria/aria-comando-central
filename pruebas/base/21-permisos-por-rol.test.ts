// ADR-0108 — "Y además, permisos: la tabla es ACCESIBLE para el rol que la usa."
// Tipo: Catálogo. INNEGOCIABLE (⛔).
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTA FILA NO SE PUEDE ESCRIBIR COMO ESTÁ EN `PRUEBAS.md`, Y ESTÁ VERIFICADO
//
// `PRUEBAS.md` dice: "`has_table_privilege` por tabla". Pero el 09 § 2 otorga
// `select (id, org_id, nombre, email, activo)` sobre `identidad.usuarios`: un permiso
// POR COLUMNA. La compuerta del controlador de la Etapa 0 lo midió contra la versión
// real de PostgreSQL: `has_table_privilege` devuelve **false** sobre una columna
// otorgada por columna.
//
// Escrita literalmente, esta fila ⛔ FALLARÍA SOBRE CÓDIGO CORRECTO — y una prueba que
// falla sobre lo correcto se termina comentando, que es como mueren las pruebas
// arquitectónicas.
//
// El 09 § 4 ya lo resuelve: su bucle de `has_table_privilege` está acotado a "cada
// tabla del ESQUEMA DE NEGOCIO", donde no hay permisos por columna. Se implementa esa
// versión, más un mapa explícito de expectativas por rol para las diez tablas de
// identidad — que es donde vive el contenido real hoy, porque `negocio` está vacío.
//
// Las políticas filtran FILAS; los permisos filtran COLUMNAS. Son dos ejes distintos y
// hacen falta los dos.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, unaFila, filas } from '../apoyo/conexiones.ts';

let mig: Client;
let ident: Client;

before(async () => {
  // `migrador` para el CATÁLOGO —`pg_class`, `has_*_privilege`— que son metadatos y no
  // pasan por las políticas de fila.
  mig = await conectar('migrador');
  // Y `app_identidad` para las consultas de DATOS. Como `migrador`,
  // `select count(*) from identidad.permisos` devuelve CERO: force RLS sin política que
  // lo nombre. Es la misma asimetría del 09 § 2, y acá muerde en una prueba en vez de
  // en producción.
  ident = await conectar('identidad');
});

after(async () => {
  await cerrarTodo();
});

type Privilegio = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

interface Esperado {
  /** Privilegios que tienen que existir a NIVEL DE TABLA. */
  tabla?: Privilegio[];
  /** Privilegios otorgados POR COLUMNA: a nivel de tabla dan `false`. */
  columnas?: Partial<Record<Privilegio, string[]>>;
}

// El mapa sale línea por línea del 09 § 2. Si una migración cambia un grant, esto
// falla y nombra la tabla.
const ESPERADO: Record<string, Partial<Record<'app_inquilino' | 'app_identidad', Esperado>>> = {
  organizaciones: {
    app_inquilino: { tabla: ['SELECT'], columnas: { UPDATE: ['nombre', 'zona_horaria'] } },
    app_identidad: { tabla: ['SELECT', 'INSERT', 'UPDATE'] },
  },
  // Permiso POR COLUMNA: el dominio del inquilino necesita nombre y correo para
  // mostrar autores y listas. NO necesita el hash ni las marcas de bloqueo. Si una
  // consulta de negocio tuviera una inyección, el hash no está a su alcance.
  usuarios: {
    app_inquilino: {
      columnas: { SELECT: ['id', 'org_id', 'nombre', 'email', 'activo'], UPDATE: ['nombre', 'activo'] },
    },
    app_identidad: { tabla: ['SELECT', 'INSERT', 'UPDATE'] },
  },
  permisos: {
    app_identidad: { tabla: ['SELECT'] },
  },
  roles: {
    app_inquilino: { tabla: ['SELECT'] },
    app_identidad: { tabla: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  },
  roles_permisos: {
    app_identidad: { tabla: ['SELECT', 'INSERT', 'DELETE'] },
  },
  usuarios_roles: {
    app_identidad: { tabla: ['SELECT', 'INSERT', 'DELETE'] },
  },
  sesiones: {
    app_identidad: { tabla: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  },
  auditoria_accesos: {
    app_inquilino: { tabla: ['SELECT', 'INSERT'] },
    app_identidad: { tabla: ['SELECT', 'INSERT'] },
  },
  usuarios_segundo_factor: {
    app_identidad: { tabla: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  },
  organizaciones_credenciales: {
    app_identidad: { tabla: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  },
};

const TODOS: Privilegio[] = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

// `DELETE` NO EXISTE A NIVEL DE COLUMNA, y verificarlo cuesta un error: PostgreSQL
// rechaza `has_column_privilege(..., 'DELETE')` con "unrecognized privilege type".
// Tiene sentido — no se borra "una columna", se borra una fila.
//
// Consecuencia real para este diseño: "el inquilino no puede borrar un usuario" solo
// se puede afirmar A NIVEL DE TABLA. Eso está en `20-invariantes.test.ts`, en la
// afirmación de la segunda capa.
const COLUMNARES: Privilegio[] = ['SELECT', 'INSERT', 'UPDATE'];

test('cada tabla de identidad tiene exactamente los permisos de tabla que le corresponden', async () => {
  for (const [tabla, porRol] of Object.entries(ESPERADO)) {
    for (const rol of ['app_inquilino', 'app_identidad'] as const) {
      const esperado = porRol[rol];
      const conTabla = new Set(esperado?.tabla ?? []);
      for (const priv of TODOS) {
        const f = await unaFila<{ tiene: boolean }>(
          mig,
          'select has_table_privilege($1, $2, $3) as tiene',
          [rol, `identidad.${tabla}`, priv],
        );
        assert.equal(
          f?.tiene,
          conTabla.has(priv),
          `${rol} sobre identidad.${tabla}: ${priv} tendría que ser ${conTabla.has(priv)}`,
        );
      }
    }
  }
});

test('los permisos POR COLUMNA otorgan solo las columnas nombradas', async () => {
  for (const [tabla, porRol] of Object.entries(ESPERADO)) {
    for (const rol of ['app_inquilino', 'app_identidad'] as const) {
      const columnas = porRol[rol]?.columnas;
      if (!columnas) continue;

      const todas = await filas<{ column_name: string }>(
        mig,
        `select column_name from information_schema.columns
          where table_schema = 'identidad' and table_name = $1`,
        [tabla],
      );

      for (const [priv, permitidas] of Object.entries(columnas)) {
        const permitido = new Set(permitidas);
        for (const { column_name } of todas) {
          const f = await unaFila<{ tiene: boolean }>(
            mig,
            'select has_column_privilege($1, $2, $3, $4) as tiene',
            [rol, `identidad.${tabla}`, column_name, priv],
          );
          assert.equal(
            f?.tiene,
            permitido.has(column_name),
            `${rol} sobre identidad.${tabla}.${column_name}: ${priv} tendría que ser ${permitido.has(column_name)}`,
          );
        }
      }
    }
  }
});

test('el hash y las marcas de bloqueo NO son alcanzables por el inquilino, por ninguna vía', async () => {
  // La afirmación que protege lo que el 09 § 2 dice proteger, escrita aparte para que
  // no se pierda entre las genéricas de arriba.
  for (const col of ['password_hash', 'intentos_fallidos', 'bloqueado_hasta', 'debe_cambiar_password']) {
    for (const priv of COLUMNARES) {
      const f = await unaFila<{ tiene: boolean }>(
        mig,
        'select has_column_privilege($1, $2, $3, $4) as tiene',
        ['app_inquilino', 'identidad.usuarios', col, priv],
      );
      assert.equal(f?.tiene, false, `app_inquilino alcanza usuarios.${col} con ${priv}`);
    }
  }
});

test('toda tabla de identidad es ACCESIBLE por al menos un rol', async () => {
  // El punto de esta fila: "una tabla con política perfecta y sin permiso pasa la fila
  // anterior y rompe en producción". Una tabla que nadie puede leer ni escribir es una
  // tabla que va a fallar en la primera consulta, ya desplegada.
  const tablas = await filas<{ relname: string }>(
    mig,
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'identidad' and c.relkind in ('r', 'p') order by c.relname`,
  );
  assert.equal(tablas.length, 10, 'son diez tablas de identidad');

  for (const { relname } of tablas) {
    const f = await unaFila<{ alcanzable: boolean }>(
      mig,
      `select (has_table_privilege('app_identidad', $1, 'SELECT')
               or has_table_privilege('app_inquilino', $1, 'SELECT')
               or has_any_column_privilege('app_identidad', $1, 'SELECT')
               or has_any_column_privilege('app_inquilino', $1, 'SELECT')) as alcanzable`,
      [`identidad.${relname}`],
    );
    assert.equal(f?.alcanzable, true, `identidad.${relname} no es legible por ningún rol`);
  }
});

test('las tablas de negocio son accesibles para el inquilino — y hoy no hay ninguna', async () => {
  // Ésta es la versión del 09 § 4, acotada a `negocio` donde no hay permisos por
  // columna. Hoy `negocio` está VACÍO, así que el bucle no corre.
  //
  // Y eso se AFIRMA en vez de dejarse pasar: "una prueba que pasa en vacío es peor que
  // ninguna". El día que la Etapa 2 cree la primera tabla de negocio, este conteo
  // cambia, esta afirmación falla, y quien la arregle tiene que decidir a propósito
  // qué espera del bucle.
  const tablas = await filas<{ relname: string }>(
    mig,
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'negocio' and c.relkind in ('r', 'p')`,
  );
  assert.equal(
    tablas.length,
    0,
    'apareció una tabla de negocio: quitá este conteo y dejá que el bucle de abajo la verifique',
  );

  for (const { relname } of tablas) {
    for (const priv of TODOS) {
      const f = await unaFila<{ tiene: boolean }>(
        mig,
        'select has_table_privilege($1, $2, $3) as tiene',
        ['app_inquilino', `negocio.${relname}`, priv],
      );
      assert.equal(f?.tiene, true, `app_inquilino no tiene ${priv} sobre negocio.${relname}`);
    }
  }
});

test('la única vista del proyecto corre con los permisos de QUIEN LA INVOCA', async () => {
  // 09 § 2, "lo que ninguna política cubre", punto 2: "una vista se ejecuta con los
  // permisos de su dueño, no de quien la consulta. Una vista sobre tablas de inquilino,
  // creada por el rol que migra, EVADE las políticas del inquilino y devuelve todo."
  //
  // `security_invoker` es lo que lo cierra. Sin esta afirmación, alguien podría
  // recrear la vista sin la opción y nada fallaría hasta que devolviera datos de otro.
  const vistas = await filas<{ relname: string; reloptions: string[] | null }>(
    mig,
    `select c.relname, c.reloptions from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'identidad' and c.relkind = 'v' order by c.relname`,
  );
  assert.deepEqual(
    vistas.map((v) => v.relname),
    ['usuarios_permisos'],
    'apareció una vista nueva: tiene que declarar security_invoker',
  );
  for (const v of vistas) {
    assert.ok(
      (v.reloptions ?? []).includes('security_invoker=true'),
      `la vista ${v.relname} no declara security_invoker=true`,
    );
  }

  // Y solo la alcanza el rol de identidad: quien la invoca necesita permiso sobre las
  // tres tablas que lee, y el inquilino no lo tiene sobre dos de ellas.
  const identidad = await unaFila<{ tiene: boolean }>(
    mig,
    `select has_table_privilege('app_identidad', 'identidad.usuarios_permisos', 'SELECT') as tiene`,
  );
  const inquilino = await unaFila<{ tiene: boolean }>(
    mig,
    `select has_table_privilege('app_inquilino', 'identidad.usuarios_permisos', 'SELECT') as tiene`,
  );
  assert.equal(identidad?.tiene, true);
  assert.equal(inquilino?.tiene, false);
});

test('la vista de permisos efectivos DEVUELVE FILAS, no solo tiene permiso', async () => {
  // Que el permiso exista no es que funcione. Con `security_invoker`, la vista corre con
  // las políticas de quien la invoca — y si una de las tres tablas que lee no tuviera
  // política para `app_identidad`, la vista devolvería CERO FILAS SIN ERROR.
  //
  // Ése es el modo de falla que este diseño persigue en todas partes: un éxito
  // reportado que no ocurrió. Un portero que resuelve "cero capacidades" para todo el
  // mundo rechaza todo, y el síntoma sería "no tengo permisos" en vez de "la vista está
  // vacía".
  const f = await unaFila<{ n: number }>(
    ident,
    `select count(*)::int as n from identidad.usuarios_permisos up
        join identidad.usuarios u on u.id = up.usuario_id
       where u.es_admin_principal`,
  );
  assert.ok(
    (f?.n ?? 0) > 0,
    'la vista de permisos efectivos no devuelve nada para el fundador: tiene el rol de plataforma con todas las capacidades',
  );

  // Y el fundador tiene EXACTAMENTE todas las capacidades del catálogo, por la vista
  // —no por la tabla— que es el camino que va a recorrer el portero.
  const cotejo = await unaFila<{ suyas: number; total: number }>(
    ident,
    `select (select count(distinct up.permiso) from identidad.usuarios_permisos up
               join identidad.usuarios u on u.id = up.usuario_id
              where u.es_admin_principal)::int as suyas,
            (select count(*) from identidad.permisos)::int as total`,
  );
  assert.equal(cotejo?.suyas, cotejo?.total);
});

test('el rol de plataforma tiene TODAS las capacidades cargadas en la tabla', async () => {
  // EJECUCION § 3 cerró que no hay atajo en el portero: "con las capacidades en la
  // tabla hay un solo camino, y una prueba de catálogo garantiza que el rol de
  // plataforma las tenga todas".
  //
  // Sin esta prueba, la decisión de no tener atajo se paga sin obtener su beneficio:
  // una capacidad nueva que nadie le agregue al superadministrador lo deja sin ella, en
  // silencio.
  const f = await unaFila<{ faltan: number; total: number }>(
    ident,
    `select (select count(*) from identidad.permisos p
              where not exists (select 1 from identidad.roles_permisos rp
                                  join identidad.roles r on r.id = rp.rol_id
                                 where r.clave = 'superadministrador' and rp.permiso = p.clave))::int as faltan,
            (select count(*) from identidad.permisos)::int as total`,
  );
  assert.ok((f?.total ?? 0) > 0, 'el catálogo de capacidades está vacío');
  assert.equal(f?.faltan, 0, `al superadministrador le faltan ${f?.faltan} capacidades`);
});

test('el administrador NO tiene las capacidades de organizaciones', async () => {
  // El administrador de un cliente no da de alta organizaciones ni las lista: eso es
  // del rol de plataforma. Si las tuviera, cualquier administrador podría enumerar
  // clientes.
  const f = await unaFila<{ n: number }>(
    ident,
    `select count(*)::int as n from identidad.roles_permisos rp
        join identidad.roles r on r.id = rp.rol_id
       where r.clave = 'administrador' and rp.permiso like 'organizaciones.%'`,
  );
  assert.equal(f?.n, 0);
});
