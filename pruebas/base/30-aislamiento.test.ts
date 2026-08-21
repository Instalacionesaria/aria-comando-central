// ADR-0201 — Ninguna consulta corre sin organización activa. INNEGOCIABLE.
// ADR-0205 — Sin organización en contexto, no se ve nada de negocio. INNEGOCIABLE.
// ADR-0206 — Con la organización A no se ve ni una fila de la B. INNEGOCIABLE.
// ADR-0207 — La escotilla no llega a las tablas de negocio. INNEGOCIABLE.
// ADR-0208 — El dominio del inquilino no llega a las tablas de identidad. INNEGOCIABLE.
// ADR-0210 — Los rellenos de datos tocan filas de verdad.
// Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES EL CRITERIO DE CIERRE MÁS IMPORTANTE DE TODO EL PROYECTO
//
// EJECUCION § 5: "con dos organizaciones sembradas y CONECTANDO CON EL ROL REAL DE LA
// APLICACIÓN, una consulta desde A no devuelve ni una fila de B; sin organización en
// contexto no se ve nada; el rol de identidad LANZA PERMISO DENEGADO al tocar negocio; y
// el rol del inquilino lanza al tocar sesiones."
//
// Y la advertencia que va con él, que es la razón por la que todo esto corre por
// `conOrganizacion()` y no por una conexión de conveniencia:
//
//   "Correr estas pruebas con el rol propietario las hace pasar todas SIN QUE NADA ESTÉ
//    PROTEGIDO."
//
// Nótese el contraste con `20-invariantes.test.ts`, que corre a propósito como
// SUPERUSUARIO: allá se prueban disparadores, que existen para detener lo que saltea la
// aplicación. Acá se prueba el aislamiento, que existe para la aplicación misma. El rol
// con el que se conecta ES la prueba.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { conOrganizacion, datos, hayOrganizacion } from '../../lib/datos/contexto.ts';
import { conIdentidad, clienteInquilino, cerrarClientes } from '../../lib/datos/capa.ts';

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

/** Los identificadores de las dos organizaciones cliente sembradas. */
async function dosOrganizaciones(): Promise<{ alfa: string; beta: string }> {
  return conIdentidad(async (db) => {
    const filas = await db
      .selectFrom('organizaciones')
      .select(['id', 'slug'])
      .where('slug', 'in', ['alfa', 'beta'])
      .execute();
    const alfa = filas.find((f) => f.slug === 'alfa')?.id;
    const beta = filas.find((f) => f.slug === 'beta')?.id;
    assert.ok(alfa && beta, 'faltan las organizaciones sembradas alfa y beta');
    return { alfa, beta };
  });
}

// ─── ADR-0201 · ninguna consulta corre sin organización activa ───────────────

test('ADR-0201 · `datos()` LANZA fuera de todo contexto', () => {
  assert.equal(hayOrganizacion(), false);
  assert.throws(() => datos(), /Ninguna consulta corre sin organización activa/);
});

test('ADR-0201 · el contexto se CIERRA al salir', async () => {
  // La primitiva elegida es la que ENVUELVE Y CIERRA (`run`), no la que entra y deja el
  // contexto puesto (`enterWith`). Ésta es la afirmación que lo demuestra: si alguien
  // cambiara la primitiva, el contexto sobreviviría a la llamada y en un bucle sobre
  // organizaciones el de la primera seguiría vivo cuando empieza la segunda.
  const { alfa } = await dosOrganizaciones();
  await conOrganizacion(alfa, async () => {
    assert.equal(hayOrganizacion(), true);
  });
  assert.equal(hayOrganizacion(), false, 'el contexto sobrevivió a conOrganizacion()');
});

test('ADR-0201 · el contexto se cierra TAMBIÉN cuando el trabajo lanza', async () => {
  const { alfa } = await dosOrganizaciones();
  await assert.rejects(
    () =>
      conOrganizacion(alfa, async () => {
        throw new Error('falla deliberada');
      }),
    /falla deliberada/,
  );
  assert.equal(hayOrganizacion(), false, 'una excepción dejó el contexto abierto');
});

// ─── ADR-0205 · sin organización en contexto, no se ve nada de negocio ──────

test('ADR-0205 · el cliente del inquilino SIN la variable no ve nada de negocio', async () => {
  // Se salta `conOrganizacion()` a propósito y se va directo al cliente, que es lo que
  // haría un archivo que se olvidó de abrir el contexto.
  //
  // "La consulta LANZA o devuelve 0. Exigir exactamente 0 hace una prueba que pasa o
  // falla según el estado del agrupador de conexiones" — las dos son seguras: cero filas
  // si la variable nunca se puso en esa conexión, y un error si se puso y quedó en cadena
  // vacía. Lo que NO puede pasar es que devuelva filas.
  const db = clienteInquilino();
  let filas: number | null = null;
  let lanzo = false;
  try {
    const f = await db
      .selectFrom('control_aislamiento')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    filas = Number(f.n);
  } catch {
    lanzo = true;
  }
  assert.ok(lanzo || filas === 0, `sin organización en contexto se vieron ${filas} filas`);
});

// ─── ADR-0206 · el criterio más importante del proyecto ────────────────────

test('ADR-0206 · con la organización A no se ve NI UNA FILA de la B', async () => {
  const { alfa, beta } = await dosOrganizaciones();

  const desdeAlfa = await conOrganizacion(alfa, async () =>
    datos().selectFrom('control_aislamiento').select(['id', 'org_id', 'marca']).execute(),
  );
  const desdeBeta = await conOrganizacion(beta, async () =>
    datos().selectFrom('control_aislamiento').select(['id', 'org_id', 'marca']).execute(),
  );

  // LA GUARDA CONTRA EL FALSO VERDE, y es la mitad que se olvida: "A no ve filas de B"
  // se cumple trivialmente si la tabla está VACÍA. Sin estas dos afirmaciones, esta
  // prueba pasaría con el aislamiento roto y la tabla sin sembrar — que es exactamente
  // la familia de defectos que todo este diseño existe para evitar.
  assert.ok(desdeAlfa.length > 0, 'alfa no tiene ni una fila: la prueba pasaría en vacío');
  assert.ok(desdeBeta.length > 0, 'beta no tiene ni una fila: la prueba pasaría en vacío');

  // Y las filas son DISTINTAS entre las dos organizaciones. Si fueran las mismas, cada
  // una estaría viendo el conjunto completo.
  const idsAlfa = new Set(desdeAlfa.map((f) => f.id));
  const idsBeta = new Set(desdeBeta.map((f) => f.id));
  assert.equal([...idsAlfa].filter((id) => idsBeta.has(id)).length, 0, 'hay filas compartidas');

  // La afirmación central.
  for (const f of desdeAlfa) {
    assert.equal(f.org_id, alfa, `alfa vio una fila de ${f.org_id}: ${f.marca}`);
  }
  for (const f of desdeBeta) {
    assert.equal(f.org_id, beta, `beta vio una fila de ${f.org_id}: ${f.marca}`);
  }
});

test('ADR-0206 · y tampoco se puede ESCRIBIR en la organización de otro', async () => {
  // `using` filtra la lectura; `with check` la escritura. Sin el segundo se puede leer
  // filtrado pero escribir una fila con la organización de otro (08 § 1).
  const { alfa, beta } = await dosOrganizaciones();

  // La inyección PISA lo que venga: una fila compuesta con la organización de beta,
  // insertada desde el contexto de alfa, aterriza en ALFA. "Ante la duda gana la opción
  // que hace más difícil escribir en los datos de otro" (04 § 2).
  const marca = `intento-${Date.now()}`;
  const aterrizo = await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('control_aislamiento')
      // Se le pasa la organización AJENA a propósito.
      .values({ marca, org_id: beta })
      .execute();
    const f = await datos()
      .selectFrom('control_aislamiento')
      .select(['org_id'])
      .where('marca', '=', marca)
      .executeTakeFirstOrThrow();
    return f.org_id;
  });
  assert.equal(aterrizo, alfa, 'la inyección no pisó la organización ajena');

  // Y beta no la ve.
  const laVeBeta = await conOrganizacion(beta, async () => {
    const f = await datos()
      .selectFrom('control_aislamiento')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('marca', '=', marca)
      .executeTakeFirstOrThrow();
    return Number(f.n);
  });
  assert.equal(laVeBeta, 0);

  // Limpieza, desde el contexto que la creó.
  await conOrganizacion(alfa, async () => {
    await datos().deleteFrom('control_aislamiento').where('marca', '=', marca).execute();
  });
});

// ─── ADR-0207 · la escotilla no llega al negocio ───────────────────────────

test('ADR-0207 · el rol de identidad LANZA permiso denegado al tocar negocio', async () => {
  // "Falla FUERTE Y A LA VISTA, no devuelve vacío. Es la diferencia que importa."
  //
  // Y el 09 § 1 explica por qué la frontera se construye con `grant` y no con políticas:
  // sin permiso, las cuatro operaciones dan un error explícito. Con permiso y sin
  // política, la lectura da cero filas sin error y la MODIFICACIÓN informa cero filas
  // afectadas SIN ERROR — un éxito reportado que no ocurrió.
  const ident = await conectar('identidad');
  await assert.rejects(
    () => ident.query('select 1 from negocio.control_aislamiento limit 1'),
    /permission denied|permiso denegado/i,
    'el rol de identidad alcanzó una tabla de negocio',
  );

  // Y sí llega a las tablas de identidad, para que la afirmación de arriba no pase por
  // el motivo equivocado (una conexión rota también lanzaría).
  const ok = await unaFila<{ n: number }>(
    ident,
    'select count(*)::int as n from identidad.organizaciones',
  );
  assert.ok((ok?.n ?? 0) > 0, 'el rol de identidad tampoco ve identidad: la conexión está mal');
});

// ─── ADR-0208 · el inquilino no llega a la identidad ───────────────────────

test('ADR-0208 · el rol del inquilino LANZA al tocar las tablas de identidad puras', async () => {
  const inq = await conectar('inquilino');
  for (const tabla of [
    'identidad.sesiones',
    'identidad.usuarios_roles',
    'identidad.roles_permisos',
    'identidad.permisos',
    'identidad.usuarios_segundo_factor',
    'identidad.organizaciones_credenciales',
  ]) {
    await assert.rejects(
      () => inq.query(`select 1 from ${tabla} limit 1`),
      /permission denied|permiso denegado/i,
      `el rol del inquilino alcanzó ${tabla}`,
    );
  }
});

test('ADR-0208 · pero SÍ ve las cuatro columnas de usuarios que necesita', async () => {
  // Otra vez: que la afirmación de arriba no pase porque la conexión está mal. El
  // inquilino tiene permiso POR COLUMNA sobre `usuarios`, y con la variable puesta ve las
  // de su organización.
  const { alfa } = await dosOrganizaciones();
  const inq = await conectar('inquilino');
  await inq.query('begin');
  try {
    await inq.query(`select set_config('app.org_id', $1, true)`, [alfa]);
    const f = await unaFila<{ n: number }>(
      inq,
      'select count(*)::int as n from identidad.usuarios',
    );
    assert.equal(f?.n, 1, 'el inquilino tendría que ver el único usuario de su organización');

    // Y `select *` FALLA, porque el permiso es por columna. Falla fuerte, que está bien —
    // pero es la razón por la que la convención del proyecto es nombrar las columnas
    // siempre desde el dominio del inquilino.
    await assert.rejects(
      () => inq.query('select * from identidad.usuarios limit 1'),
      /permission denied|permiso denegado/i,
      '`select *` tendría que fallar con permisos por columna',
    );
  } finally {
    await inq.query('rollback');
  }
});

// ─── ADR-0210 · los rellenos tocan filas de verdad ─────────────────────────

test('ADR-0210 · como `migrador`, un relleno informa CERO FILAS SIN ERROR', async () => {
  // Es la consecuencia menos evidente de todo el diseño, y "va a morder la primera vez
  // que haya que rellenar una columna nueva en una tabla que ya tiene datos — que en
  // cualquier producto es cuestión de meses" (09 § 2).
  //
  // Una migración de datos que "corre bien" y no toca nada queda marcada como aplicada,
  // el despliegue sigue, y la columna nueva queda vacía en producción. Nadie se entera
  // hasta que una pantalla muestra nulos.
  const mig = await conectar('migrador');

  const vistas = await unaFila<{ n: number }>(
    mig,
    'select count(*)::int as n from negocio.control_aislamiento',
  );
  assert.equal(vistas?.n, 0, 'migrador ve filas de negocio: el forzado de RLS no está puesto');

  // Y el `update` NO LANZA: informa cero filas.
  const r = await mig.query(`update negocio.control_aislamiento set marca = 'pisado'`);
  assert.equal(r.rowCount, 0, 'el relleno como migrador afectó filas');
});

test('ADR-0210 · por bucle de organizaciones, SÍ toca filas', async () => {
  // La forma correcta: "los rellenos se escriben por bucle de organizaciones, con la
  // variable puesta, igual que una tarea programada". Es más lento de escribir y es lo
  // único coherente con el resto del diseño.
  //
  // Se cuenta ANTES y DESPUÉS, que es lo que la fila de PRUEBAS pide: verificar el
  // EFECTO, no la ausencia de error.
  const { alfa, beta } = await dosOrganizaciones();
  let tocadas = 0;

  for (const org of [alfa, beta]) {
    tocadas += await conOrganizacion(org, async () => {
      const r = await sql<{ n: number }>`
        with tocadas as (
          update negocio.control_aislamiento set creado_el = creado_el returning 1
        ) select count(*)::int as n from tocadas
      `.execute(datos());
      return r.rows[0]?.n ?? 0;
    });
  }

  assert.ok(tocadas > 0, 'el bucle por organizaciones no tocó ni una fila');

  // Y nada quedó "pisado" por el intento de `migrador` de la prueba anterior.
  for (const org of [alfa, beta]) {
    const pisadas = await conOrganizacion(org, async () => {
      const f = await datos()
        .selectFrom('control_aislamiento')
        .select((eb) => eb.fn.countAll<string>().as('n'))
        .where('marca', '=', 'pisado')
        .executeTakeFirstOrThrow();
      return Number(f.n);
    });
    assert.equal(pisadas, 0);
  }
});

// ─── La variable de transacción, de punta a punta ──────────────────────────

test('la variable muere con la transacción, también a través de la capa', async () => {
  // La compuerta de la Etapa 0 lo probó sobre una conexión desnuda. Ésta lo prueba a
  // través de `conOrganizacion()`, que es el camino real — y con el agrupador de
  // conexiones en el medio, que es donde el alcance de sesión se filtraría entre
  // inquilinos si alguien cambiara el tercer argumento de `set_config` a `false`.
  const { alfa } = await dosOrganizaciones();

  const dentro = await conOrganizacion(alfa, async () => {
    const r = await sql<{ v: string | null }>`
      select current_setting('app.org_id', true) as v
    `.execute(datos());
    return r.rows[0]?.v ?? null;
  });
  assert.equal(dentro, alfa);

  // Y después, sobre el MISMO agrupador, una consulta sin contexto no ve nada. Si la
  // variable hubiera quedado con alcance de sesión, esta consulta devolvería las filas
  // de alfa — y sería exactamente la fuga entre inquilinos que el 08 § 1 describe.
  const db = clienteInquilino();
  let filas: number | null = null;
  try {
    const f = await db
      .selectFrom('control_aislamiento')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    filas = Number(f.n);
  } catch {
    filas = null;
  }
  assert.ok(filas === 0 || filas === null, `la variable se filtró: se vieron ${filas} filas`);
});
