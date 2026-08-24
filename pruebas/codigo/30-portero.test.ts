// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0302 — El permiso se pregunta por capacidad, nunca por nombre de rol.
// ADR-0303 — Todo rol asignable tiene al menos una pantalla.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
// ADR-0305 — Un rechazo por permiso no se muestra como "no hay datos".
// ADR-0306 — Toda petición que modifica verifica el origen.
// Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES EL CRITERIO DE CIERRE DE LA ETAPA 3
//
// `EJECUCION` § 5: *"la prueba que recorre los manejadores de ruta y verifica que TODOS
// llaman al portero, salvo la lista explícita de rutas públicas"*.
//
// Y el 03 § 6 dice por qué vale más que su costo: *"un portero es inútil si una operación se
// olvida de llamarlo. Y olvidarse NO FALLA: la operación funciona, sin verificar nada."*
//
// ── POR MÉTODO, NO POR ARCHIVO ───────────────────────────────────────────────
//
// El 03 § 6 escribe la prueba como *"afirmar que codigo contiene 'exigir('"*, a nivel de
// archivo. Eso tiene un agujero concreto: un `route.ts` con `GET` y `POST` donde **solo `GET`**
// llama al portero **pasa**. El `POST` queda abierto y responde 200.
//
// Acá se recorre método por método. Es la desviación de la letra que conserva el propósito.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { archivosFuente, archivosQueContienen, RAIZ } from '../apoyo/fuente.ts';
import {
  ARCHIVOS_AUTORIZADOS,
  RUTAS_CON_SECRETO_PROPIO,
  RUTAS_CON_SESION_OPCIONAL,
  RUTAS_PUBLICAS,
} from '../apoyo/autorizados.ts';
import { CAPACIDADES } from '../../lib/autorizacion/capacidades.ts';
import {
  SECCIONES,
  SIN_OPERACIONES_TODAVIA,
  SIN_PANTALLA,
} from '../../lib/autorizacion/secciones.ts';
import { AUN_NO_EXISTEN, ESTADOS } from '../../lib/autorizacion/estados.ts';

const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

function manejadoresDeRuta(): string[] {
  const dir = join(RAIZ, 'app');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /^route\.(ts|js|tsx|jsx)$/.test(e.name))
    .map((e) => relative(RAIZ, join(e.parentPath, e.name)).split(sep).join('/'))
    .sort();
}

/** Los métodos exportados y el cuerpo de cada uno. Ver el comentario del encabezado. */
function metodosDe(limpio: string): { metodo: string; cuerpo: string }[] {
  const marcas: { metodo: string; desde: number }[] = [];
  for (const m of METODOS) {
    const re = new RegExp(`export\\s+(?:async\\s+)?(?:function\\s+${m}\\b|const\\s+${m}\\b)`, 'g');
    for (let hit = re.exec(limpio); hit; hit = re.exec(limpio)) {
      marcas.push({ metodo: m, desde: hit.index });
    }
  }
  marcas.sort((a, b) => a.desde - b.desde);
  return marcas.map((mk, i) => ({
    metodo: mk.metodo,
    cuerpo: limpio.slice(mk.desde, marcas[i + 1]?.desde ?? limpio.length),
  }));
}

function fuenteDe(ruta: string): string {
  const a = archivosFuente(['app']).find((x) => x.ruta === ruta);
  assert.ok(a, `no se pudo leer ${ruta}`);
  return a.limpio;
}

// ─── ADR-0301 · el criterio de cierre ───────────────────────────────────────

test('ADR-0301 · TODO método de TODO manejador llama al portero', () => {
  const rutas = manejadoresDeRuta();
  assert.ok(rutas.length > 0, 'no hay manejadores de ruta: la prueba pasaría en vacío');

  // Las dos guardas de las listas blancas, primero. Sin ellas, agregar una ruta a
  // `RUTAS_PUBLICAS` sería una forma silenciosa de sacarla de esta prueba.
  for (const publica of RUTAS_PUBLICAS) {
    assert.ok(rutas.includes(publica), `${publica} está en RUTAS_PUBLICAS y no existe`);
  }
  for (const opcional of RUTAS_CON_SESION_OPCIONAL) {
    assert.ok(rutas.includes(opcional), `${opcional} está en RUTAS_CON_SESION_OPCIONAL y no existe`);
  }
  for (const propia of RUTAS_CON_SECRETO_PROPIO) {
    assert.ok(rutas.includes(propia), `${propia} está en RUTAS_CON_SECRETO_PROPIO y no existe`);
  }

  const sinPortero: string[] = [];
  for (const ruta of rutas) {
    if (RUTAS_PUBLICAS.includes(ruta)) continue;
    // Las rutas con secreto propio no llaman al portero —no hay sesión— pero SÍ tienen que
    // autenticar. Se verifica que lo hagan, no que no verifiquen nada: es la misma forma que
    // `sesionOpcional`, y por eso está en su propia lista y no en `RUTAS_PUBLICAS`.
    if (RUTAS_CON_SECRETO_PROPIO.includes(ruta)) {
      assert.match(
        fuenteDe(ruta),
        /timingSafeEqual/,
        `${ruta} tiene secreto propio y no lo compara con timingSafeEqual`,
      );
      continue;
    }
    const limpio = fuenteDe(ruta);
    const metodos = metodosDe(limpio);
    assert.ok(metodos.length > 0, `${ruta} no exporta ningún método`);

    // Las rutas de `sesionOpcional(` tienen su propio contrato. Se verifica que lo usen —no
    // que no verifiquen nada—, y que sus otros métodos sí pasen por el portero: en
    // `auth/sesion` el `PATCH` es una operación normal.
    const conSesionOpcional = RUTAS_CON_SESION_OPCIONAL.includes(ruta);

    for (const { metodo, cuerpo } of metodos) {
      const llamaPortero = /\bexigir\s*\(/.test(cuerpo);
      const llamaOpcional = /\bsesionOpcional\s*\(/.test(cuerpo);
      if (llamaPortero) continue;
      if (conSesionOpcional && llamaOpcional) continue;
      sinPortero.push(`${ruta} → ${metodo}`);
    }
  }

  assert.deepEqual(
    sinPortero,
    [],
    'estos métodos no llaman al portero. Olvidarse NO FALLA: la operación funciona, ' +
      'sin verificar nada.',
  );
});

test('ADR-0301 · ninguna ruta de metadatos: son manejadores invisibles con caché pública', () => {
  // Las rutas de metadatos —`sitemap`, `opengraph-image`, `icon`, `robots`, `manifest`— se
  // compilan a manejadores de ruta que exportan `GET`, reciben `params`, **pueden consultar la
  // base**, no pasan por el portero, y salen con `Cache-Control: public`. Ninguna prueba que
  // busque archivos llamados `route.*` las ve.
  //
  // Es la fuga del 08 § 3 —"llega por un camino donde la capa de datos, el portero de permisos
  // y las políticas de la base no participan"— con un nombre de archivo que nadie sospecha.
  // Hoy no hay ninguna, y esta afirmación es lo que obliga a decidir el día que aparezca.
  const NOMBRES = /^(sitemap|robots|manifest|opengraph-image|twitter-image|icon|apple-icon)\./;
  const dir = join(RAIZ, 'app');
  const halladas = !existsSync(dir)
    ? []
    : readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile() && NOMBRES.test(e.name))
        .map((e) => relative(RAIZ, join(e.parentPath, e.name)).split(sep).join('/'))
        .sort();

  assert.deepEqual(
    halladas,
    [],
    'una ruta de metadatos es un manejador de ruta que no se llama `route.*`: no pasa por ' +
      'el portero y sale con caché pública',
  );
});

test('ADR-0301 · ningún manejador re-exporta sus métodos desde otro archivo', () => {
  // Un `export { GET, POST } from './manejador'` haría que este archivo no contenga
  // `exigir(` y la prueba de arriba fallaría sobre código que está bien — y *"una prueba que
  // falla sobre lo correcto se termina ignorando"* (04 § 4).
  //
  // Se prohíbe el patrón en vez de tolerarlo con una lista blanca: la lista blanca crece, la
  // prohibición no.
  const malos = manejadoresDeRuta().filter((r) =>
    /export\s*\{[^}]*\}\s*from/.test(fuenteDe(r)),
  );
  assert.deepEqual(
    malos,
    [],
    'un manejador que re-exporta sus métodos esconde el portero de la búsqueda',
  );
});

// ─── ADR-0302 · por capacidad, nunca por nombre de rol ──────────────────────

test('ADR-0302 · ninguna comparación con un nombre de rol', () => {
  // El 03 § 9: *"Comparar nombres de rol 'solo esta vez'. Aparece siempre, y con un argumento
  // razonable ('es un caso especial del administrador'). Cada una de esas comparaciones es un
  // lugar que hay que encontrar y revisar cuando llegue un rol nuevo — y el que se olvide no
  // va a fallar: va a dejar afuera a alguien que debería entrar, o adentro a alguien que no."*
  //
  // Se busca la COMPARACIÓN, no la mención. `db/` y `db/sembrado/` nombran los roles como
  // DATOS —los `insert` de la migración 003, el tipo del sembrado— y eso es legítimo; excluir
  // `db/` entero para que esta prueba pase le sacaría a `ADR-0303` su fuente de roles.
  const CLAVES = ['superadministrador', 'administrador'];
  const malos: string[] = [];
  for (const a of archivosFuente(['app', 'components', 'lib'])) {
    for (const clave of CLAVES) {
      // `=== 'administrador'`, `== "administrador"`, `!== 'administrador'`, y el caso de
      // `switch (rol) { case 'administrador':`.
      const re = new RegExp(`(===?|!==?|case)\\s*['"\`]${clave}['"\`]`);
      if (re.test(a.limpio)) malos.push(`${a.ruta} (${clave})`);
    }
  }
  assert.deepEqual(
    malos,
    [],
    'si de verdad es un caso especial, es una CAPACIDAD nueva: cuesta una fila (03 § 9)',
  );
});

test('ADR-0302 · el portero NO tiene atajo para el rol de plataforma', () => {
  // El 03 § 5 ofrece el atajo `si contexto.esRolDePlataforma: devolver contexto` en el paso 5
  // como una de dos alternativas, y `EJECUCION` § 3 eligió la otra: *"tiene todas las
  // capacidades cargadas en la tabla. Sin atajo en el portero."*
  //
  // Un atajo que no está no se puede olvidar de los pasos 1 a 3 — y ése es el riesgo real:
  // alguien con el rol de plataforma pero con la sesión vencida, con contraseña temporal o
  // mirando una organización desactivada tiene que seguir siendo rechazado.
  const portero = archivosFuente(['lib']).find((a) => a.ruta === 'lib/autorizacion/portero.ts');
  assert.ok(portero, 'no se encontró el portero');
  assert.doesNotMatch(
    portero.limpio,
    /esRolDePlataforma/,
    'el portero no consulta el rol de plataforma: las capacidades están en la tabla',
  );
});

test('ADR-0302 · toda capacidad usada en el código está en el catálogo', () => {
  // Una errata en una capacidad no falla como errata: `exigir(['usuarios.vere'])` es una
  // capacidad que nadie tiene, así que rechaza a TODO EL MUNDO con el 403 que el 07 § 2 dice
  // que "se muestra muchas veces como 'no hay datos'". El síntoma que llega es "la pantalla
  // está vacía".
  const usadas = new Set<string>();
  for (const a of archivosFuente(['app', 'components', 'lib'])) {
    if (a.ruta === 'lib/autorizacion/capacidades.ts') continue;
    for (const m of a.limpio.matchAll(/['"`]([a-z]+\.[a-zA-Z]+)['"`]/g)) {
      const posible = m[1];
      // Solo se consideran las que parecen capacidades por su prefijo de recurso.
      if (posible && /^(organizaciones|usuarios|roles|credenciales|configuracion|auditoria)\./.test(posible)) {
        usadas.add(posible);
      }
    }
  }
  const desconocidas = [...usadas].filter((c) => !CAPACIDADES.includes(c as never)).sort();
  assert.deepEqual(desconocidas, [], 'capacidades que no están en el catálogo');
});

// ─── ADR-0303 y ADR-0304 · las pantallas ────────────────────────────────────

test('ADR-0303 · toda sección declara una capacidad del catálogo', () => {
  assert.ok(SECCIONES.length > 0, 'no hay secciones: la prueba pasaría en vacío');
  for (const s of SECCIONES) {
    assert.ok(
      CAPACIDADES.includes(s.capacidadRequerida),
      `la sección ${s.clave} pide ${s.capacidadRequerida}, que no está en el catálogo`,
    );
  }
});

test('ADR-0303 · las pantallas del prototipo siguen sin operaciones', () => {
  // LA GUARDA CONTRA LA LISTA PARALELA, que es el modo de fallar de este archivo.
  //
  // Ninguna de las diez pantallas del prototipo corresponde a ninguna de las trece
  // capacidades: son de producto y no tienen ni una operación de servidor. Mientras eso siga
  // siendo cierto, `ADR-0303` verifica poco — y decirlo es más honesto que inflar la lista.
  //
  // El día que una de las diez reciba su primera operación, este conteo falla y obliga a
  // decidir: catalogar su capacidad y ponerla en `SECCIONES`, o justificar por qué no.
  const conOperacion = manejadoresDeRuta()
    .map((r) => {
      const m = /export\s+const\s+PANTALLA\s*=\s*['"`]([^'"`]+)['"`]/.exec(fuenteDe(r));
      return m?.[1];
    })
    .filter((p): p is string => p !== undefined);

  const invasoras = conOperacion.filter((p) => SIN_OPERACIONES_TODAVIA.includes(p));
  assert.deepEqual(
    invasoras,
    [],
    'una pantalla del prototipo recibió su primera operación: entra al modelo de permisos ' +
      '(SECCIONES) o se justifica por qué no',
  );
});

test('ADR-0304 · las operaciones de una misma pantalla piden el MISMO conjunto', () => {
  // Se comparan CONJUNTOS, no solapamiento, y la diferencia decide si la prueba sirve: el
  // portero usa "alguna de", así que `['usuarios.ver']` y `['usuarios.ver','usuarios.editar']`
  // se solapan y **no** son equivalentes. Quien tenga solo `usuarios.editar` pasa la segunda
  // operación y recibe 403 en la primera: ve *"una sección con datos y cuatro en blanco, sin
  // ningún error"* (07 § 2). Una prueba de solapamiento lo aprueba.
  const porPantalla = new Map<string, Map<string, string>>();

  for (const ruta of manejadoresDeRuta()) {
    const limpio = fuenteDe(ruta);
    const pantalla = /export\s+const\s+PANTALLA\s*=\s*['"`]([^'"`]+)['"`]/.exec(limpio)?.[1];

    if (!pantalla) {
      // Una operación sin pantalla tiene que estar NOMBRADA. No puede ser el valor por
      // omisión: por la lógica del 03 § 5, "una operación nueva nace cerrada".
      assert.ok(
        SIN_PANTALLA.includes(ruta),
        `${ruta} no declara PANTALLA y no está en SIN_PANTALLA: agregá una de las dos`,
      );
      continue;
    }

    for (const { metodo, cuerpo } of metodosDe(limpio)) {
      // SOLO LOS MÉTODOS QUE LLENAN LA PANTALLA, y el recorte tiene motivo.
      //
      // El defecto que esta fila previene es de LECTURAS. El `07` § 2 lo describe así: quien abría
      // una pantalla de cinco secciones autorizado en una *"veía una sección con datos y cuatro en
      // blanco, sin ningún error"*. Eso pasa cuando dos GET de la misma pantalla piden capacidades
      // distintas.
      //
      // Una MUTACIÓN que pide otra capacidad no produce ese defecto: `credenciales.ver` y
      // `credenciales.editar` son dos a propósito —el `03` § 2 usa exactamente ese criterio,
      // *"¿existe un rol plausible que necesite A y no B?"*— y un rol de consulta tiene que poder
      // ver la pantalla sin poder escribir.
      //
      // Igualarlas para que esta prueba pase sería una ESCALADA SILENCIOSA: el portero usa
      // `contieneAlguna`, así que pedir las dos en las dos deja escribir a quien solo puede leer.
      //
      // Lo que queda sin cubrir —un botón que se ve y da 403— es el `07` § 4, *"mostrar un control
      // que no puede cumplir"*, y se resuelve no renderizando el control. Eso es interfaz, y esta
      // prueba no lo puede ver.
      if (metodo !== 'GET') continue;
      const m = /\bexigir\s*\(\s*[A-Za-z]+\s*,\s*([\s\S]*?)\)\s*;/.exec(cuerpo);
      if (!m) continue;
      const arg = (m[1] ?? '').trim();
      // `NINGUNA` NO se normaliza a `[]`. El 03 § 5: *"'ninguna capacidad' es un valor
      // explícito, no una lista vacía"*. Si se normalizaran juntos, una operación que quedó
      // abierta por accidente se agruparía con las abiertas a propósito y el conjunto
      // "coincidiría".
      const conjunto =
        arg === 'NINGUNA'
          ? 'NINGUNA'
          : [...arg.matchAll(/['"`]([^'"`]+)['"`]/g)]
              .map((x) => x[1])
              .sort()
              .join(',');
      assert.notEqual(conjunto, '', `no se pudo leer las capacidades de ${ruta} → ${metodo}`);
      if (!porPantalla.has(pantalla)) porPantalla.set(pantalla, new Map());
      porPantalla.get(pantalla)?.set(`${ruta} → ${metodo}`, conjunto);
    }
  }

  for (const [pantalla, ops] of porPantalla) {
    const conjuntos = new Set(ops.values());
    assert.equal(
      conjuntos.size,
      1,
      `la pantalla "${pantalla}" tiene operaciones con conjuntos distintos: ` +
        `${[...ops].map(([k, v]) => `${k} = [${v}]`).join(' | ')}`,
    );
  }

  // Y la guarda: cada sección declarada tiene que tener al menos una operación, o `SECCIONES`
  // es la lista paralela que este archivo existe para no ser.
  //
  // ── LA ÚNICA EXENCIÓN, Y ES EL CABLE TRAMPA ────────────────────────────────
  //
  // `sinOperacionesTodavia`. Desde la Etapa 11 `SECCIONES` es la lista ÚNICA —incluye las
  // pantallas del prototipo que todavía no llaman a nada— y esa bandera es lo que las exime.
  //
  // Lo que hace que siga siendo un cable trampa y no una puerta de escape: bajar la bandera es
  // un acto manual, y **darle su primera operación a una pantalla sin bajarla no rompe nada
  // acá**. Al revés: el día que alguien le escribe un manejador con `PANTALLA = 'executive'`,
  // la aserción de abajo dispara y le obliga a decidir. Y si alguien pone la bandera en una
  // pantalla que YA tiene operaciones para silenciar un rojo, también dispara.
  for (const s of SECCIONES) {
    if (s.sinOperacionesTodavia) {
      // La bandera dice "no tiene operaciones". Si tiene, la bandera miente — y una bandera
      // que miente es peor que no tenerla, porque exime a una pantalla que sí hay que
      // verificar.
      assert.ok(
        !porPantalla.has(s.clave),
        `la sección "${s.clave}" está marcada \`sinOperacionesTodavia\` y TIENE operaciones: ` +
          `${[...(porPantalla.get(s.clave) ?? new Map()).keys()].join(', ')}. ` +
          'Bajá la bandera en `lib/autorizacion/secciones.ts`.',
      );
      continue;
    }
    assert.ok(
      porPantalla.has(s.clave),
      `la sección "${s.clave}" no tiene ninguna operación que la declare con PANTALLA`,
    );
  }
});

// ─── ADR-0305 · un solo cliente HTTP, y el 403 que no es vacío ──────────────

test('ADR-0305 · un solo archivo hace peticiones HTTP', () => {
  // La regla no está escrita en la especificación —el 07 § 4 describe el DEFECTO de tener dos
  // con manejo opuesto— y se adopta por simetría con `ADR-0203`. El defecto está medido: *"un
  // 401 por el segundo camino no echa a nadie: la sesión está vencida y la pantalla sigue como
  // si nada."*
  // `lib/deteccion/aviso.ts` está exceptuado, y la distinción es real, no una comodidad: esta
  // regla existe porque *"un 401 por el segundo camino no echa a nadie"* (07 § 4) — o sea, es
  // sobre el cliente que le habla a NUESTRO API y cuyas respuestas llenan una pantalla.
  //
  // `avisar()` hace una petición SALIENTE a un canal de terceros, nunca a este API, y **no
  // devuelve datos a ninguna pantalla**: devuelve un booleano y lanza si el canal falla. No puede
  // confundir un rechazo con un vacío porque no tiene un vacío que devolver. La última afirmación
  // de esta prueba es la que sostiene la exención.
  const EXCEPTUADOS = ['lib/http/cliente.ts', 'lib/deteccion/aviso.ts'];
  const clientes = archivosQueContienen(
    /\bfetch\s*\(|XMLHttpRequest|axios|navigator\.sendBeacon|new\s+EventSource/,
  ).filter((r) => !EXCEPTUADOS.includes(r));
  assert.deepEqual(clientes, [], 'todas las peticiones pasan por `pedir(` de lib/http/cliente.ts');

  // La comprobación de entrada muerta: los dos exceptuados SÍ hacen la petición.
  assert.deepEqual([...archivosQueContienen(/\bfetch\s*\(/)].sort(), [...EXCEPTUADOS].sort());

  // Y el aviso NO lee el cuerpo de la respuesta, que es lo que lo mantiene fuera del alcance de
  // esta regla. Si algún día lo leyera —para sacar un identificador del aviso, digamos— pasaría a
  // ser un cliente HTTP y tendría que ir por `pedir(`.
  const aviso = archivosFuente(['lib']).find((a) => a.ruta === 'lib/deteccion/aviso.ts');
  assert.ok(aviso, 'no se encontró el módulo de avisos');
  assert.doesNotMatch(
    aviso.limpio,
    /respuesta\s*\.\s*(json|text)\s*\(/,
    'el aviso lee el cuerpo de la respuesta: pasó a ser un cliente HTTP',
  );
});

test('ADR-0305 · el cliente distingue rechazo, vacío y "no pude preguntar"', () => {
  const c = archivosFuente(['lib']).find((a) => a.ruta === 'lib/http/cliente.ts');
  assert.ok(c, 'no se encontró el cliente HTTP');

  // Las tres ramas existen y están nombradas. Si alguien colapsa dos, esto falla.
  for (const rama of ["'datos'", "'rechazado'", "'sin_respuesta'"]) {
    assert.match(c.limpio, new RegExp(`tipo:\\s*${rama}`), `falta la rama ${rama}`);
  }

  // Y las formas prohibidas, que son las que ya se pagaron:
  //   `catch { return [] }`      — el defecto textual del 07 § 2
  //   `if (!respuesta.ok) return []`  — la variante más probable, porque `ok` es el
  //                              discriminante que la API del navegador ofrece primero, y es
  //                              `false` por igual para 401, 403, 404, 429 y 500.
  assert.doesNotMatch(
    c.limpio,
    /catch\s*(\([^)]*\))?\s*\{\s*return\s*(\[\s*\]|null|undefined)\s*;?\s*\}/,
    'un catch que devuelve vacío convierte un 403 en "no hay nada acá"',
  );
  assert.doesNotMatch(
    c.limpio,
    /return\s*\[\s*\]\s*;/,
    'el cliente nunca devuelve una lista: devuelve una de las tres ramas',
  );
});

// ─── ADR-0306 · el origen ───────────────────────────────────────────────────

test('ADR-0306 · el portero verifica el origen y solo exime los métodos que no modifican', () => {
  const p = archivosFuente(['lib']).find((a) => a.ruta === 'lib/autorizacion/portero.ts');
  assert.ok(p, 'no se encontró el portero');
  assert.match(p.limpio, /\bverificarOrigen\s*\(/, 'el portero no verifica el origen');
  // Los tres exentos del 08 § 5.3, y solo esos tres.
  assert.match(p.limpio, /'GET'|"GET"/);
  assert.match(p.limpio, /'HEAD'|"HEAD"/);
  assert.match(p.limpio, /'OPTIONS'|"OPTIONS"/);
  // Y ningún respaldo implícito: sin `DOMINIO_ESPERADO` se rechaza, no se acepta.
  assert.doesNotMatch(
    p.limpio,
    /DOMINIO_ESPERADO[^\n]*\?\?/,
    'un respaldo del dominio esperado abre el sistema entero',
  );
});

// ─── Las entradas muertas de las listas blancas ─────────────────────────────
//
// Las dos propiedades de CONTENIDO de esas listas —el conjunto común en las cuatro, y
// ninguna ruta específica en dos— son ADR-0409 y ADR-0408, de la Etapa 4:
// `pruebas/codigo/40-estados-de-sesion.test.ts`.

test('ninguna ruta de las listas blancas está muerta', () => {
  // Una lista blanca sin comprobación de entradas muertas acumula rutas que ya no existen, y
  // ahí deja de decir la verdad. Las de la Etapa 4 están declaradas en `AUN_NO_EXISTEN`, y
  // tienen que SALIR de ahí cuando se escriban.
  const existentes = new Set<string>();
  for (const ruta of manejadoresDeRuta()) {
    const camino = '/' + ruta.replace(/^app\//, '').replace(/\/route\.(ts|js|tsx|jsx)$/, '');
    for (const { metodo } of metodosDe(fuenteDe(ruta))) {
      existentes.add(`${metodo} ${camino}`);
    }
  }

  const declaradas = new Set<string>();
  for (const rutas of Object.values(ESTADOS)) {
    if (rutas) for (const r of rutas) declaradas.add(r);
  }

  const muertas = [...declaradas].filter(
    (r) => !existentes.has(r) && !AUN_NO_EXISTEN.includes(r as never),
  );
  assert.deepEqual(
    muertas,
    [],
    'rutas nombradas en ESTADOS que no existen ni están declaradas en AUN_NO_EXISTEN',
  );

  // Y al revés: una entrada de `AUN_NO_EXISTEN` que YA existe tiene que salir de la lista.
  const yaExisten = AUN_NO_EXISTEN.filter((r) => existentes.has(r));
  assert.deepEqual(yaExisten, [], 'estas rutas ya existen: sacalas de AUN_NO_EXISTEN');
});
