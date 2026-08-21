// ADR-0202 — Toda operación abre el contexto de su organización. INNEGOCIABLE.
// ADR-0203 — Un solo lugar crea el cliente de base.
// ADR-0209 — Ninguna operación cruza los dos dominios sin decirlo.
// ADR-0211 — Solo los archivos autorizados usan el acceso sin filtro.
// Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES ANÁLISIS ESTÁTICO ESCRITO COMO PRUEBA, Y ES LO MÁS VALIOSO DEL SISTEMA
//
// "Un portero es inútil si una operación se olvida de llamarlo. Y olvidarse NO FALLA:
// la operación funciona, sin verificar nada" (03 § 6).
//
// "Parece rudimentario y es lo más valioso del sistema: una operación nueva que se
// olvide del portero rompe la suite, que es la única forma de que no se olvide — sobre
// todo si el código lo escribe un asistente que no leyó esta documentación."
//
// En el sistema del que salen estas notas, CATORCE operaciones ya estaban escritas sin
// activar el contexto de organización. Ninguna fallaba: leían los datos de la
// organización equivocada. El 04 § 7 lo dice sin vueltas: "escribila antes de la segunda
// operación, no después de la decimocuarta".
//
// Hoy no hay ni una operación. Por eso estas pruebas se escriben AHORA, cuando el conteo
// es cero y no cuesta nada, en vez de cuando ya hay catorce.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { archivosFuente, archivosQueContienen, RAIZ } from '../apoyo/fuente.ts';
import {
  ARCHIVOS_AUTORIZADOS,
  CRUZAN_LOS_DOS_DOMINIOS,
  RUTAS_PUBLICAS,
} from '../apoyo/autorizados.ts';

/** Los manejadores de ruta del App Router. Hoy, ninguno. */
function manejadoresDeRuta(): string[] {
  const dir = join(RAIZ, 'app');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /^route\.(ts|js|tsx|jsx)$/.test(e.name))
    .map((e) => relative(RAIZ, join(e.parentPath, e.name)).split(sep).join('/'))
    .sort();
}

// ─── ADR-0203 · un solo lugar crea el cliente ───────────────────────────────

test('ADR-0203 · solo `lib/datos/capa.ts` construye un cliente de base', () => {
  // El 04 § 7 explica por qué su texto dice EXACTAMENTE DOS y no UNO: "escrita como 'un
  // solo lugar', esta prueba falla sobre código correcto la primera vez que exista el
  // segundo dominio — y una prueba que falla sobre lo correcto se ignora, que es como
  // mueren las pruebas arquitectónicas".
  //
  // La reconciliación con la fila de PRUEBAS: UN ARCHIVO, DOS CLIENTES. `crearCliente(`
  // aparece en un solo archivo; ese archivo construye uno por dominio.
  assert.deepEqual(archivosQueContienen(/\bcrearCliente\s*\(/), ['lib/datos/capa.ts']);
});

test('ADR-0203 · nadie fuera de la capa de datos importa el controlador', () => {
  // El controlador es `pg`. Si otro archivo lo importa, puede abrir su propia conexión y
  // saltearse el régimen entero — sin que nada falle.
  //
  // `pruebas/apoyo/conexiones.ts` sí lo importa, a propósito: las pruebas de base y de
  // catálogo necesitan conectarse como un rol concreto y afirmar que una operación FALLA.
  // `archivosFuente()` excluye `pruebas/` por omisión, así que no aparece acá — y la
  // afirmación complementaria de abajo cierra el hueco que eso abre.
  const importan = archivosFuente().filter((a) => /from\s+['"]pg['"]/.test(a.limpio));
  assert.deepEqual(
    importan.map((a) => a.ruta).sort(),
    ['lib/datos/capa.ts', 'scripts/db.mjs'].sort(),
    'un archivo nuevo importa `pg`: o va en la capa de datos, o hay que justificarlo acá',
  );
});

test('ADR-0203 · nada de `app/` ni `lib/` importa de `pruebas/`', () => {
  // La afirmación complementaria, sin la cual excluir `pruebas/` del recorrido sería un
  // agujero: si el código de producción importara de ahí, alcanzaría el cliente crudo
  // por una puerta que ninguna prueba mira.
  const malos = archivosFuente(['app', 'lib', 'components'])
    .filter((a) => /from\s+['"][^'"]*pruebas\//.test(a.limpio))
    .map((a) => a.ruta);
  assert.deepEqual(malos, []);
});

// ─── ADR-0211 · la escotilla, solo donde está autorizada ────────────────────

test('ADR-0211 · solo los archivos autorizados usan `conIdentidad(`', () => {
  // El patrón tolera el genérico de TypeScript, y NO es un detalle de estilo:
  // `conIdentidad<T>(` **no contiene la cadena literal `conIdentidad(`**. EJECUCION § 6
  // dice que los nombres son las cadenas que buscan las pruebas — y en TypeScript la
  // DECLARACIÓN de una función genérica no coincide con esa cadena, aunque todas sus
  // llamadas sí. Sin el grupo opcional, el archivo que define la escotilla queda
  // invisible para su propia prueba, y la comprobación de entradas muertas lo delata.
  const usan = archivosQueContienen(/\bconIdentidad\b\s*(?:<[^>]*>)?\s*\(/);
  assert.deepEqual(
    usan.filter((r) => !ARCHIVOS_AUTORIZADOS.includes(r)),
    [],
    'un archivo usa el acceso sin filtro sin estar autorizado: agregalo a ' +
      'pruebas/apoyo/autorizados.ts a mano, en un cambio que alguien revise',
  );

  // Entradas MUERTAS. Sin esto, la lista blanca se convierte en permiso permanente: una
  // autorización que ya no hace falta queda habilitando algo que nadie va a volver a
  // mirar.
  assert.deepEqual(
    ARCHIVOS_AUTORIZADOS.filter((r) => !usan.includes(r)),
    [],
    'hay entradas muertas en ARCHIVOS_AUTORIZADOS: sacalas',
  );
});

// ─── ADR-0209 · los dos dominios en un archivo ──────────────────────────────

test('ADR-0209 · ningún archivo nuevo cruza los dos dominios sin decirlo', () => {
  // Entre dominios NO hay atomicidad: son dos transacciones distintas y una puede
  // confirmar y la otra fallar. Si la segunda mitad falla, la respuesta va a decir que
  // todo salió bien porque la primera funcionó — un éxito reportado que no ocurrió.
  //
  // `PRUEBAS.md` dice que estos archivos "se revisan a mano". Eso no es una prueba. Acá
  // está como lista blanca: un archivo nuevo en la intersección rompe la suite.
  const cruzan = archivosFuente()
    .filter(
      (a) =>
        /\bconIdentidad\b\s*(?:<[^>]*>)?\s*\(/.test(a.limpio) &&
        /\bconOrganizacion\b\s*(?:<[^>]*>)?\s*\(/.test(a.limpio),
    )
    .map((a) => a.ruta);

  assert.deepEqual(
    cruzan.filter((r) => !CRUZAN_LOS_DOS_DOMINIOS.includes(r)),
    [],
    'un archivo nuevo escribe en los dos dominios: no hay atomicidad entre ellos, así ' +
      'que tiene que decir en su propio código qué pasa si la segunda mitad falla',
  );
  assert.deepEqual(
    CRUZAN_LOS_DOS_DOMINIOS.filter((r) => !cruzan.includes(r)),
    [],
    'hay entradas muertas en CRUZAN_LOS_DOS_DOMINIOS: sacalas',
  );
});

// ─── ADR-0202 · toda operación abre el contexto ─────────────────────────────

test('ADR-0202 · todo manejador de ruta abre el contexto de su organización', () => {
  const rutas = manejadoresDeRuta();

  // HOY NO HAY NINGUNO, y eso se AFIRMA en vez de dejar pasar un bucle vacío.
  //
  // Un bucle sobre cero archivos pasa siempre, y "una prueba que pasa en vacío es peor
  // que ninguna" (09 § 4). Con esta afirmación, el día que la Etapa 3 escriba el primer
  // manejador de ruta esta prueba FALLA, y quien la arregle tiene que borrar este conteo
  // a propósito y dejar que el bucle de abajo lo verifique. Es el disparador que hace
  // que la regla exista antes que el código que vigila.
  assert.deepEqual(
    rutas,
    [],
    'apareció el primer manejador de ruta: borrá esta afirmación y dejá que el bucle ' +
      'de abajo verifique que abre el contexto',
  );

  for (const ruta of rutas) {
    if (RUTAS_PUBLICAS.includes(ruta)) continue;
    // Las operaciones del dominio de IDENTIDAD —login, alta de usuarios y de
    // organizaciones, la lista para las tareas programadas— legítimamente NUNCA abren
    // contexto de inquilino y tampoco son públicas: van en la misma lista de autorizados.
    // Sin esa exención, esta prueba falla sobre operaciones correctas — y una prueba que
    // falla sobre lo correcto se termina ignorando.
    if (ARCHIVOS_AUTORIZADOS.includes(ruta)) continue;

    const contenido = archivosFuente(['app']).find((a) => a.ruta === ruta);
    assert.ok(contenido, `no se pudo leer ${ruta}`);
    assert.match(
      contenido.limpio,
      /\bconOrganizacion\s*\(/,
      `${ruta} no abre el contexto de organización. Olvidarse no falla: la operación ` +
        'funciona y lee los datos de la organización equivocada.',
    );
  }
});

// ─── El léxico: los nombres SON las cadenas que buscan las pruebas ──────────

test('los nombres del léxico existen, y los sinónimos prohibidos no', () => {
  // EJECUCION § 6: "Los nombres son las cadenas que buscan las pruebas. Un sinónimo rompe
  // la prueba sin romper el código, que es la peor combinación."
  //
  // Esta prueba es la que hace que esa frase sea verdad y no una intención. Sin ella, un
  // renombre deja todas las pruebas de arriba buscando cadenas que ya no existen — y
  // pasando, porque no encuentran nada que objetar.
  const fuente = archivosFuente();
  const contiene = (p: RegExp) => fuente.some((a) => p.test(a.limpio));

  assert.ok(contiene(/\bconOrganizacion\s*\(/), 'falta `conOrganizacion(`');
  assert.ok(contiene(/\bconIdentidad\s*\(/), 'falta `conIdentidad(`');
  assert.ok(contiene(/\bcrearCliente\s*\(/), 'falta `crearCliente(`');

  // `activarContexto` NO existe: EJECUCION § 6 lo nombra, pero § 3 cerró la primitiva que
  // ENVUELVE Y CIERRA, y `activarContexto` es por construcción la que entra sin cerrar.
  // Decisión confirmada y documentada en docs/LEXICO.md.
  const prohibidos: Array<[string, RegExp]> = [
    ['activarContexto', /\bactivarContexto\s*\(/],
    ['dbSinScope', /\bdbSinScope\s*\(/],
    ['createClient', /\bcreateClient\s*\(/],
    ['super_admin', /\bsuper_admin\b/],
    ['empresa_id', /\bempresa_id\b/],
  ];
  for (const [nombre, patron] of prohibidos) {
    const malos = fuente.filter((a) => patron.test(a.limpio)).map((a) => a.ruta);
    assert.deepEqual(malos, [], `sinónimo prohibido \`${nombre}\` en: ${malos.join(', ')}`);
  }
});

test('ninguna primitiva de caché bajo `app/`', () => {
  // EJECUCION § 2 prohíbe "cualquier primitiva de caché" en rutas del API. Verificado en
  // los docs de Next 16.3: los manejadores de ruta NO se cachean por omisión con
  // `cacheComponents` sin activar, así que "nada se cachea" es el comportamiento por
  // defecto — y esta búsqueda es lo que impide que alguien lo cambie sin decidirlo.
  const vocabulario = [
    /'use cache'/,
    /\bunstable_cache\b/,
    /\bcacheLife\b/,
    /\bcacheTag\b/,
    /\brevalidateTag\b/,
    /\brevalidatePath\b/,
    /\bupdateTag\b/,
    /export\s+const\s+(dynamic|revalidate|fetchCache)\b/,
    /cache:\s*['"]force-cache['"]/,
  ];
  for (const patron of vocabulario) {
    assert.deepEqual(
      archivosQueContienen(patron, ['app']),
      [],
      `primitiva de caché ${patron} bajo app/`,
    );
  }
});

test('ningún `use server`: una acción exportada es alcanzable por un POST directo', () => {
  // EJECUCION § 2 lo prohíbe, y verificado en los docs de Next 16.3 no hay interruptor de
  // configuración: `serverActions` solo expone `allowedOrigins` y `bodySizeLimit`. Una
  // acción exportada "es alcanzable por un POST directo, no solo a través de la interfaz"
  // AUNQUE NADIE LA IMPORTE.
  //
  // Así que la prohibición es enforceable SOLO por esta búsqueda — y tiene que matchear
  // directivas en línea, no solo al principio del archivo. Esta fila NO está en
  // `PRUEBAS.md`: hay que agregarla.
  assert.deepEqual(archivosQueContienen(/['"]use server['"]/), []);
});

test('`cacheComponents` no está activado', () => {
  const config = archivosFuente(['.']).find((a) => a.ruta === 'next.config.mjs');
  // `archivosFuente(['.'])` no recorre la raíz, así que se lee directo.
  const texto = config?.limpio ?? '';
  assert.doesNotMatch(
    texto + archivosFuente(['app', 'lib']).map((a) => a.limpio).join('\n'),
    /cacheComponents\s*:\s*true/,
    'activar Cache Components cambia el régimen de caché de todo el proyecto',
  );
});

test('ADR-0201 · un solo archivo pone `app.org_id`', () => {
  // Lo encontró una verificación adversarial de la Etapa 2, y es el complemento exacto de
  // ADR-0203: si `crearCliente(` vive en un solo lugar para que nadie abra una conexión
  // por su cuenta, `set_config('app.org_id'` tiene que vivir en un solo lugar por el
  // mismo motivo. Es la variable de la que depende TODO el aislamiento.
  //
  // El agujero concreto: `datos()` entrega la transacción cruda, así que código de
  // negocio puede correr `set_config('app.org_id', <otra>, true)` sobre ella y quedar
  // leyendo otra organización mientras `organizacionActual()` sigue diciendo la primera.
  // No es un salto de la política —la base hace exactamente lo que le pidieron— pero
  // convierte el contexto en una sugerencia, y una revisión no lo ve.
  //
  // No hace falta prohibir el SQL crudo ni sacarle la transacción a nadie: basta con que
  // poner la variable a mano ROMPA LA SUITE.
  assert.deepEqual(
    archivosQueContienen(/set_config\s*\(\s*['"]app\.org_id['"]/).filter(
      (r) => r !== 'lib/datos/contexto.ts',
    ),
    [],
    'la variable de la organización se pone en `conOrganizacion()` y en ningún otro lado',
  );

  // La otra mitad, sin la que ésta pasaría si alguien renombrara la variable: el archivo
  // autorizado SÍ la pone. Es la comprobación de entrada muerta de una lista de uno.
  assert.deepEqual(archivosQueContienen(/set_config\s*\(\s*['"]app\.org_id['"]/), [
    'lib/datos/contexto.ts',
  ]);
});
