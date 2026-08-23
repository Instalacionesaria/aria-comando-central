// El guard de anfitrión: que exista, que nadie lo saltee, y que no se pueda forzar
// hacia un proveedor administrado.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTA PRUEBA EXISTE
//
// El guard de `lib/datos/anfitrion.ts` es la única cosa del repositorio que impide
// que un `npm test` con `.env.local` apuntando a Supabase borre datos de
// producción. La suite de base borra a propósito: `limpiarTodo()` se lleva todo
// usuario que no sea uno de los tres del sembrado, y `60-credenciales.test.ts` vacía
// `organizaciones_credenciales`, que está cifrada con `CLAVE_MAESTRA` y por lo tanto
// NO se recupera.
//
// Un guard así se rompe de tres maneras, y las tres son silenciosas:
//
//   1. Alguien agrega una segunda forma de conectarse en las pruebas, que no pasa
//      por `conectar()`.
//   2. Alguien "arregla" un fallo local comentando la llamada.
//   3. Alguien descubre la escotilla y la usa para apuntar a producción.
//
// Las tres tienen que fallar acá, en una prueba estática que corre sin base.
//
// Y una nota sobre por qué esta prueba es de tipo Código y no de Base: una prueba de
// base que verificara el guard tendría que conectarse para comprobarlo, o sea que
// dependería de lo que está verificando. Recorrer el código fuente no tiene ese
// problema.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente, archivosQueContienen, sinComentarios } from '../apoyo/fuente.ts';
import {
  esAnfitrionLocal,
  esProveedorAdministrado,
  anfitrionDe,
  exigirAnfitrionLocal,
} from '../../lib/datos/anfitrion.ts';

// ── La lista blanca hace lo que dice ─────────────────────────────────────────

test('los cuatro anfitriones locales pasan, y nada más', () => {
  for (const a of ['localhost', '127.0.0.1', 'host.docker.internal']) {
    assert.ok(
      esAnfitrionLocal(`postgres://u:p@${a}:5432/aria`),
      `${a} tendría que contar como local`,
    );
  }
  // `::1` va entre corchetes en una URL, y `URL.hostname` los DEVUELVE con corchetes.
  // Ésa es la razón por la que `anfitrionDe` los quita: el `'::1'` de la lista blanca
  // original del sembrado no era alcanzable, y esta afirmación es la que lo detecta.
  assert.equal(anfitrionDe('postgres://u:p@[::1]:5432/aria'), '::1');
  assert.ok(esAnfitrionLocal('postgres://u:p@[::1]:5432/aria'));

  // La mitad complementaria, que es la que importa: sin esto, un `esAnfitrionLocal`
  // que devolviera `true` siempre pasaría la afirmación de arriba.
  for (const a of [
    'db.pajhjpzydkkpmjdofqqp.supabase.co',
    'aws-1-us-east-1.pooler.supabase.com',
    'ep-cool-name.us-east-2.aws.neon.tech',
    '192.168.1.50',
    'localhost.evil.com',
    'notlocalhost',
  ]) {
    assert.ok(
      !esAnfitrionLocal(`postgres://u:p@${a}:5432/aria`),
      `${a} NO tendría que contar como local`,
    );
  }
});

test('una cadena ilegible no es local', () => {
  // El modo de fallar seguro: si no se puede leer el anfitrión, no se asume nada.
  assert.equal(anfitrionDe('no es una url'), undefined);
  assert.ok(!esAnfitrionLocal('no es una url'));
  assert.ok(!esAnfitrionLocal(''));
});

test('los proveedores administrados se reconocen incluso en una cadena ilegible', () => {
  // Se compara sobre la cadena completa a propósito: una cadena que `new URL` no
  // parsea igual tiene que quedar del lado reconocido, o la escotilla la deja pasar.
  assert.ok(esProveedorAdministrado('postgresql://x@db.abc.supabase.co:5432/postgres'));
  assert.ok(esProveedorAdministrado('esto no es una url pero dice supabase.co'));
  assert.ok(esProveedorAdministrado('POSTGRES://X@DB.ABC.SUPABASE.CO/postgres'));
  assert.ok(!esProveedorAdministrado('postgres://u:p@localhost:5432/aria'));
});

// ── La escotilla y su límite ─────────────────────────────────────────────────

test('la escotilla abre un anfitrión local con otro nombre', () => {
  const url = 'postgres://u:p@mi-postgres-de-la-oficina:5432/aria';
  const opciones = { quien: 'la prueba', porque: 'da igual.', escotilla: 'ARIA_PRUEBA_ESCOTILLA' };

  assert.throws(() => exigirAnfitrionLocal(url, opciones), /solo anfitriones locales/);

  process.env.ARIA_PRUEBA_ESCOTILLA = '1';
  try {
    // No lanza: es exactamente para lo que la escotilla existe.
    exigirAnfitrionLocal(url, opciones);
  } finally {
    delete process.env.ARIA_PRUEBA_ESCOTILLA;
  }
});

test('la escotilla NO abre un proveedor administrado', () => {
  // Es la afirmación central de todo este archivo. Sin ella, el guard es una
  // variable de entorno de un carácter frente a una pérdida de datos irreversible.
  const url = 'postgresql://postgres:x@db.pajhjpzydkkpmjdofqqp.supabase.co:5432/postgres';
  const opciones = { quien: 'la prueba', porque: 'da igual.', escotilla: 'ARIA_PRUEBA_ESCOTILLA' };

  process.env.ARIA_PRUEBA_ESCOTILLA = '1';
  try {
    assert.throws(
      () => exigirAnfitrionLocal(url, opciones),
      /NO lo habilita: es un proveedor administrado/,
      'la escotilla dejó pasar un proveedor administrado',
    );
  } finally {
    delete process.env.ARIA_PRUEBA_ESCOTILLA;
  }
});

test('el mensaje nombra el anfitrión al que se apuntaba', () => {
  // Un guard que dice "se niega a correr" sin decir contra qué manda a leer este
  // archivo. El anfitrión en el mensaje es la diferencia entre entenderlo y adivinar.
  assert.throws(
    () =>
      exigirAnfitrionLocal('postgresql://u:p@db.abc.supabase.co:5432/postgres', {
        quien: 'la prueba',
        porque: 'borra credenciales.',
        escotilla: 'ARIA_PRUEBA_ESCOTILLA',
      }),
    (e: unknown) => {
      const m = e instanceof Error ? e.message : String(e);
      assert.match(m, /db\.abc\.supabase\.co/, 'el mensaje no nombra el anfitrión');
      assert.match(m, /borra credenciales/, 'el mensaje no dice qué se habría perdido');
      return true;
    },
  );
});

// ── Que nadie lo saltee ──────────────────────────────────────────────────────

test('las pruebas se conectan SOLO por `conectar()`', () => {
  // El guard vive en `conectar()`. Un `new pg.Client` suelto en un archivo de prueba
  // lo saltea, y es la forma número uno en que este guard se rompe: alguien que
  // necesita una conexión con una opción distinta la construye a mano.
  const sospechosos = archivosFuente(['pruebas'])
    .filter((a) => /\bnew\s+pg\.(Client|Pool)\b/.test(a.limpio))
    .map((a) => a.ruta)
    .sort();

  assert.deepEqual(
    sospechosos,
    [
      // El constructor único de las conexiones de inspección. Ahí vive el guard.
      'pruebas/apoyo/conexiones.ts',
      // La compuerta: necesita `max: 1` y `db.connection()` para fijar una conexión
      // física, y eso no se puede pedir a `conectar()`. Llama al guard a mano — lo
      // afirma la prueba de los llamadores, más abajo.
      'pruebas/base/01-controlador-transaccion.test.ts',
    ].sort(),
    'una prueba construye su propio cliente de base y saltea el guard de anfitrión',
  );
});

test('`conectar()` llama al guard', () => {
  // La forma 2: alguien comenta la llamada para que su corrida local funcione. Se
  // lee SIN comentarios, así que un `// exigirAnfitrionLocal(...)` no la salva.
  const conexiones = archivosFuente(['pruebas']).find(
    (a) => a.ruta === 'pruebas/apoyo/conexiones.ts',
  );
  assert.ok(conexiones, 'no se encontró pruebas/apoyo/conexiones.ts');
  assert.match(
    conexiones.limpio,
    /exigirAnfitrionLocal\s*\(/,
    'pruebas/apoyo/conexiones.ts dejó de llamar al guard de anfitrión',
  );
});

test('los cinco llamadores del guard siguen ahí', () => {
  // La lista es explícita y con motivo, no un conteo. Un conteo sube y baja sin que
  // nadie mire; una lista obliga a justificar la entrada nueva en el diff.
  //
  // `pruebas/` va en la búsqueda porque uno de los cuatro vive ahí.
  const esperados = [
    // Toda conexión de inspección de las 158 pruebas de base.
    'pruebas/apoyo/conexiones.ts',
    // El camino real de la aplicación, que es por donde escriben las que más escriben.
    'lib/datos/capa.ts',
    // Escribe usuarios con una contraseña de desarrollo conocida.
    'db/sembrado/organizaciones.ts',
    // `docker compose down -v`, y con él `reset` completo.
    'scripts/db.mjs',
    // La compuerta, que construye su propio cliente y por eso llama al guard a mano.
    'pruebas/base/01-controlador-transaccion.test.ts',
  ].sort();

  const hallados = archivosQueContienen(/exigirAnfitrionLocal\s*\(/, [
    'lib',
    'db',
    'scripts',
    'pruebas',
  ])
    // El módulo que lo define no cuenta como llamador, ni esta prueba, que lo nombra
    // para verificarlo.
    .filter((r) => r !== 'lib/datos/anfitrion.ts')
    .filter((r) => r !== 'pruebas/codigo/11-guard-de-anfitrion.test.ts')
    .sort();

  assert.deepEqual(hallados, esperados);
});

test('el guard de la capa de datos está condicionado a las pruebas', () => {
  // Si `lib/datos/capa.ts` exigiera anfitrión local SIN condicionar, la aplicación
  // desplegada no podría conectarse a nada. Es un fallo que solo aparece en
  // producción, así que tiene que fallar acá.
  const capa = archivosFuente(['lib']).find((a) => a.ruta === 'lib/datos/capa.ts');
  assert.ok(capa);
  assert.match(
    capa.limpio,
    /if\s*\(\s*enPruebas\(\)\s*\)\s*\{[\s\S]*?exigirAnfitrionLocal/,
    'el guard de capa.ts tiene que estar dentro de `if (enPruebas())`',
  );
});

// ── La `service_role` de Supabase ────────────────────────────────────────────

test('ninguna clave de servicio de Supabase aparece en el repositorio', () => {
  // EJECUCION § 3: "ninguna clave de servicio que saltee las políticas".
  //
  // Supabase trae una por diseño, y la `service_role` tiene `bypassrls`: con ella,
  // las quince políticas de este sistema no se aplican a una sola consulta. Nuestra
  // capa habla por TCP con sus tres roles y no la necesita para nada — pero el
  // sistema del que salió esta especificación la usa para TODO su tráfico, así que
  // el camino existe y es conocido por quien venga a trabajar acá.
  //
  // Esta prueba no protege un secreto: protege una decisión de arquitectura. El día
  // que alguien resuelva un problema de permisos con la clave de servicio, el
  // aislamiento entero se salta en una línea y ninguna otra prueba lo nota.
  //
  // Se busca sobre el contenido CON comentarios, al revés que casi todo lo demás
  // acá: un comentario que diga "usar la service_role para esto" es justamente lo
  // que no queremos que quede escrito como sugerencia. Este archivo se excluye,
  // porque nombra las cadenas que busca.
  const prohibidas = [/\bsb_secret_/, /\bservice_role\b/, /SUPABASE_SERVICE_ROLE_KEY/];

  const hallados = archivosFuente(['app', 'components', 'lib', 'db', 'scripts', 'pruebas'])
    .filter((a) => a.ruta !== 'pruebas/codigo/11-guard-de-anfitrion.test.ts')
    .filter((a) => prohibidas.some((p) => p.test(a.contenido)))
    .map((a) => a.ruta);

  assert.deepEqual(
    hallados,
    [],
    'una clave de servicio de Supabase saltea las políticas: el aislamiento de este ' +
      'sistema no se aplica a una sola consulta hecha con ella',
  );
});

test('la búsqueda de la clave de servicio encontraría algo si estuviera', () => {
  // La guarda anti-falso-verde. Sin esto, un error en el recorrido de archivos deja
  // la prueba de arriba en verde para siempre — y el 07 § 0 regla 3 es explícito:
  // un cero por falta de datos se lee como "no hay problema".
  const archivos = archivosFuente(['app', 'components', 'lib', 'db', 'scripts', 'pruebas']);
  assert.ok(archivos.length > 50, `el recorrido devolvió ${archivos.length} archivos`);

  const yo = archivos.find((a) => a.ruta === 'pruebas/codigo/11-guard-de-anfitrion.test.ts');
  assert.ok(yo, 'el recorrido no incluye este archivo, así que no probaría nada');
  assert.match(
    yo.contenido,
    /\bservice_role\b/,
    'este archivo tendría que contener la cadena que busca, para que la exclusión signifique algo',
  );
  // Y que la exclusión sea NECESARIA: sin comentarios, este archivo sigue nombrándola.
  assert.match(sinComentarios(yo.contenido), /service_role/);
});
