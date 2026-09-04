// ADR-0701 — Ninguna ruta autenticada se cachea. INNEGOCIABLE.
// ADR-0702 — Ninguna respuesta autenticada lleva caché pública. INNEGOCIABLE.
// ADR-0703 — Toda memorización incluye la organización efectiva. INNEGOCIABLE.
// ADR-0704 — Las respuestas de error no revelan estructura.
// Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA ETAPA MÁS CORTA, Y LA QUE MÁS SE APOYA EN LO QUE YA SE DECIDIÓ
//
// `EJECUCION` § 5: *"ninguna ruta del API usa primitivas de caché; ninguna respuesta autenticada
// lleva caché pública; ninguna ruta de autenticación registra cuerpos."*
//
// Tres de las cuatro filas son consecuencia de decisiones que ya están tomadas y ya tienen
// mecanismo: `EJECUCION` § 2 prohibió *"cualquier primitiva de caché en rutas del API"*, y
// `lib/autorizacion/respuesta.ts` es el único constructor de respuestas y pone `no-store`.
//
// Lo que agrega esta etapa es la verificación de que el mecanismo **funciona sobre las respuestas
// de verdad**, no solo sobre el código que las construye. Un constructor correcto y una ruta que
// arma su propia `Response` es exactamente el hueco que una prueba de código no ve.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { archivosFuente, archivosQueContienen, RAIZ } from '../apoyo/fuente.ts';

function manejadores(): string[] {
  const dir = join(RAIZ, 'app');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /^route\.(ts|js|tsx|jsx)$/.test(e.name))
    .map((e) => relative(RAIZ, join(e.parentPath, e.name)).split(sep).join('/'))
    .sort();
}

function fuenteDe(ruta: string): string {
  const a = archivosFuente(['app']).find((x) => x.ruta === ruta);
  assert.ok(a, `no se pudo leer ${ruta}`);
  return a.limpio;
}

// ─── ADR-0701 · ninguna ruta se cachea ──────────────────────────────────────

test('ADR-0701 · la lista autorizada de primitivas de caché está VACÍA', () => {
  // La fila dice *"fuera de una lista autorizada"*. Acá esa lista es **el conjunto vacío**, y eso
  // es más fuerte que una lista corta: `EJECUCION` § 2 cerró que *"nada se cachea"*, así que no hay
  // caso legítimo que exceptuar.
  //
  // Queda dicho para que nadie la "arregle" agregando una entrada: el día que haga falta una
  // primitiva de caché en una ruta del API, `EJECUCION` § 2 dice que **se para y se pregunta**.
  const AUTORIZADAS: readonly string[] = [];
  assert.deepEqual(AUTORIZADAS, [], 'la lista autorizada dejó de estar vacía: eso es una decisión');

  // El barrido completo vive en `pruebas/codigo/10-arquitectura`, que ya recorre el vocabulario
  // entero —incluidos `revalidate = false`, que ACTIVA la generación estática, y
  // `generateStaticParams` sola—. Acá se afirma la propiedad del artefacto, que es lo que la fila
  // de verdad quiere: que ninguna ruta salga como estática.
  //
  // `.next/app-path-routes-manifest.json` mapea cada ruta a su tipo. Una ruta del API que apareciera
  // en `prerender-manifest.json` estaría cacheada.
  const prerender = join(RAIZ, '.next', 'prerender-manifest.json');
  assert.ok(existsSync(prerender), 'no hay paquete construido: corré `npm run build`');
  const manifiesto = JSON.parse(readFileSync(prerender, 'utf8')) as {
    routes?: Record<string, unknown>;
  };

  const apiPrerrenderizadas = Object.keys(manifiesto.routes ?? {}).filter((r) =>
    r.startsWith('/api'),
  );
  assert.deepEqual(
    apiPrerrenderizadas,
    [],
    'estas rutas del API están prerrenderizadas: sus respuestas se sirven desde el paquete',
  );
});

// ─── ADR-0702 · la cabecera, sobre las respuestas de VERDAD ─────────────────

test('ADR-0702 · ningún manejador construye una `Response` por su cuenta', () => {
  // Ésta es la mitad que hace que `no-store` sea estructural. El constructor único lo pone; una
  // ruta que arme su propia `Response` se lo saltea, y ninguna prueba de comportamiento sobre las
  // rutas que sí usan el constructor lo vería.
  const malos: string[] = [];
  for (const ruta of manejadores()) {
    const limpio = fuenteDe(ruta);
    if (/new\s+Response\s*\(/.test(limpio)) malos.push(`${ruta} (new Response)`);
    if (/Response\s*\.\s*json\s*\(/.test(limpio)) malos.push(`${ruta} (Response.json)`);
    if (/NextResponse/.test(limpio)) malos.push(`${ruta} (NextResponse)`);
  }
  assert.deepEqual(
    malos,
    [],
    'las respuestas se arman con `ok()` y `rechazo()` de lib/autorizacion/respuesta.ts, que son ' +
      'los únicos que ponen `Cache-Control: no-store`',
  );
});

test('ADR-0702 · el constructor único pone `no-store`, y nadie más pone `Cache-Control`', () => {
  const r = archivosFuente(['lib']).find((a) => a.ruta === 'lib/autorizacion/respuesta.ts');
  assert.ok(r, 'no se encontró el constructor de respuestas');
  assert.match(r.limpio, /cache-control['"]\s*,\s*['"]no-store/i, 'el constructor no pone no-store');

  // `no-store` y NO `no-cache`: `no-cache` permite guardar y revalidar. Con datos de inquilino la
  // diferencia es la que decide si la respuesta queda en un caché intermedio.
  assert.doesNotMatch(r.limpio, /['"]no-cache['"]/, 'no-cache permite guardar: hace falta no-store');

  // Y nadie más toca la cabecera. Un `set('cache-control', 'public, max-age=…')` en una ruta la
  // pisaría, y el `08` § 3 llama a eso *"la fuga que llega por un camino donde la capa de datos, el
  // portero y las políticas no participan"*.
  const otros = archivosQueContienen(/cache-control/i).filter(
    (x) => x !== 'lib/autorizacion/respuesta.ts',
  );
  assert.deepEqual(otros, [], 'solo el constructor de respuestas toca `Cache-Control`');
});

// ─── ADR-0703 · toda memorización incluye la organización ───────────────────

/**
 * Las memorizaciones DEL NAVEGADOR, con su motivo.
 *
 * ── ESTA LISTA NACIÓ VACÍA, Y ESO YA NO ES CIERTO ─────────────────────────
 *
 * Esta prueba se llamaba *«no hay ninguna memorización, así que no hay clave que auditar»*, y era
 * la forma más fuerte de cumplir la fila. Dejó de serlo el día que `lib/lecturas.ts` entró: volver
 * a una sub-pestaña remontaba la pantalla y la hacía pedir de nuevo, así que ahora lo traído
 * sobrevive al desmontaje.
 *
 * Con eso la fila pasa de cumplirse **por ausencia** a cumplirse **por construcción**, y esta
 * lista es lo que lo hace comprobable. Cada entrada dice qué guarda y por qué está permitido.
 */
const MEMORIZACIONES_DEL_NAVEGADOR: readonly { archivo: string; porque: string }[] = [
  {
    archivo: 'lib/reloj.ts',
    porque:
      '**No es una caché de datos.** Su `Map` guarda temporizadores por clave de reloj — no hay ni ' +
      'una fila de ninguna organización adentro, así que no hay clave que pueda cruzarse. Es el ' +
      'archivo que la exención por `use client` ya nombraba.',
  },
  {
    archivo: 'lib/lecturas.ts',
    porque:
      'SÍ es una caché de datos —el `Map` vive acá— y **la clave lleva el id de la empresa**, que se ' +
      'comprueba abajo. Es la primera memorización del proyecto: existe para que volver a una ' +
      'sub-pestaña no cueste un «Cargando», porque `CloserView` y `SetterView` desmontan la ' +
      'pantalla al cambiar de pestaña. No importa React, y eso es lo que la vuelve comprobable de ' +
      'verdad en `pruebas/codigo/129-lecturas.test.ts`.',
  },
  {
    archivo: 'lib/usarLectura.ts',
    porque:
      'Los hooks. **No guarda nada por su cuenta** —su `Map` no existe: usa el de `lecturas.ts`— y ' +
      'es el único que arma claves, leyendo la empresa de la sesión él mismo para que ninguna ' +
      'pantalla pueda olvidársela. Está en esta lista porque lleva `use client` y el barrido de ' +
      'arriba tiene que seguir reconociéndolo.',
  },
];

test('ADR-0703 · ningún módulo del SERVIDOR memoriza', () => {
  // El motivo es específico del servidor y el `07` § 3 lo escribe: *«en funciones sin servidor las
  // instancias se reutilizan entre peticiones de ORGANIZACIONES DISTINTAS; un caché de proceso
  // 'para no descifrar dos veces' es exactamente cómo el token de una organización termina
  // usándose para otra»*.
  //
  // Se busca la FORMA, porque el nombre puede ser cualquiera: una estructura mutable declarada en el
  // nivel superior de un módulo del servidor.
  const sospechosos: string[] = [];
  const delNavegador: string[] = [];
  for (const a of archivosFuente(['app', 'lib'])) {
    // `lib/datos/capa.ts` tiene el agrupador de clientes por ROL de base, que no es un caché de
    // datos y ya está justificado en su propio comentario. Es la única excepción POR NOMBRE, y está
    // acá con nombre.
    if (a.ruta === 'lib/datos/capa.ts') continue;

    /* ── Y LA EXENCIÓN POR DIRECTIVA, QUE NO ES UNA LISTA ───────────────────
     *
     * La regla es sobre módulos del SERVIDOR. Un módulo que declara `'use client'` no atiende
     * peticiones — su estado es de UNA pestaña de UNA persona, y ahí un `Map` en el nivel superior
     * es la forma correcta.
     *
     * Se exime por la DIRECTIVA y no por una lista de rutas: una lista crece, y cada línea que se le
     * agrega es una decisión que se toma en la prueba en vez de en el código. La directiva la escribe
     * el archivo sobre sí mismo, y `next build` la hace verdad — importar un módulo `'use client'`
     * desde el servidor es un error de construcción, no una convención.
     *
     * Lo que SÍ es una lista es la de abajo: eximir no es no auditar. Ver la prueba siguiente. */
    if (/^\s*['"]use client['"]/.test(a.limpio)) {
      delNavegador.push(a.ruta);
      continue;
    }

    const nivelSuperior = a.limpio
      .split('\n')
      .filter((l) => /^(const|let|var)\s+\w+/.test(l))
      .join('\n');
    /* `Map<string, Tarea>(` y no solo `Map(`: los parámetros de tipo van ENTRE el nombre y el
       paréntesis, así que el patrón de antes —`new\s+Map\s*\(`— no veía ninguna estructura genérica.
       `lib/reloj.ts` tenía `const tareas = new Map<string, Tarea>()` y pasaba por ese hueco: está
       bien que pase —es del navegador— pero pasaba por el motivo equivocado, y un módulo del
       servidor con `new Map<string, Token>()` habría pasado igual. */
    if (/new\s+(Map|WeakMap|Set|WeakSet)\s*(<[^;=]*>)?\s*\(/.test(nivelSuperior)) {
      sospechosos.push(a.ruta);
    }
  }
  assert.deepEqual(
    sospechosos,
    [],
    'una estructura mutable en el nivel superior de un módulo del servidor se comparte entre ' +
      'peticiones de organizaciones distintas',
  );

  /* Y la exención está VIVA. Sin esta línea, el día que la detección de la directiva se rompa —un
     cambio en `sinComentarios`, una directiva movida de línea— el barrido eximiría CERO archivos o
     TODOS, y en los dos casos seguiría verde. */
  for (const { archivo } of MEMORIZACIONES_DEL_NAVEGADOR) {
    assert.ok(
      delNavegador.includes(archivo),
      `la exención por \`use client\` dejó de reconocer \`${archivo}\`, así que este barrido está ` +
        'mirando otra cosa que la que dice',
    );
  }

  // Y la excepción por nombre está viva: si `capa.ts` dejara de tener su agrupador, la exención
  // pasaría a ser una entrada muerta que exime a un archivo que ya no lo necesita.
  const capa = archivosFuente(['lib']).find((a) => a.ruta === 'lib/datos/capa.ts');
  assert.match(
    capa?.limpio ?? '',
    /new\s+Map\s*</,
    'la exención de capa.ts quedó muerta: sacala de esta prueba',
  );
});

test('ADR-0703 · la memorización del navegador lleva la EMPRESA en la clave', () => {
  /* ── LA FILA, AHORA QUE HAY ALGO QUE AUDITAR ─────────────────────────────
   *
   * *«Toda memorización incluye la organización efectiva. INNEGOCIABLE.»* Mientras no hubo ninguna,
   * la fila se cumplía sola. `lib/lecturas.ts` es la primera, así que hace falta el guardia.
   *
   * ── Y NO ALCANZA CON QUE HOY SE RECARGUE LA PÁGINA ──────────────────────
   *
   * Cambiar de empresa hace `window.location.reload()` en `components/SelectorDeEmpresa.jsx`, así
   * que una caché en memoria muere con el cambio y la fila se cumpliría igual sin la clave. Eso es
   * exactamente lo que esta prueba impide que sea suficiente: se cumpliría **por un efecto
   * secundario de otro componente**, y el día que alguien haga que el selector no recargue —una
   * optimización obvia— un superadmin empezaría a ver los datos de la empresa anterior **sin que
   * nada falle en ninguna parte**. */
  const lecturas = archivosFuente(['lib']).find((a) => a.ruta === 'lib/lecturas.ts');
  const hooks = archivosFuente(['lib']).find((a) => a.ruta === 'lib/usarLectura.ts');
  assert.ok(lecturas, 'no está `lib/lecturas.ts`: si se fue, sacá su entrada de la lista');
  assert.ok(hooks, 'no está `lib/usarLectura.ts`: si se fue, sacá su entrada de la lista');

  /* La clave se arma en UN lugar y la empresa es su primer argumento. Se afirma la firma y el
     cuerpo: una función que reciba la empresa y no la use pasaría la primera mitad. */
  assert.match(
    lecturas.limpio,
    /export function claveDeLectura\(empresaId: string, camino: string\): string {/,
    'la clave dejó de recibir la empresa como primer argumento',
  );
  assert.match(
    lecturas.limpio,
    /return `\$\{empresaId\}\\n\$\{camino\}`;/,
    'la clave ya no se arma con la empresa adentro',
  );

  /* Y NADIE arma una clave por su cuenta. Es la mitad que importa: con `claveDeLectura` perfecta y
     una pantalla que llame a `guardar('mi-lista', …)`, la fila se rompe y la prueba de arriba sigue
     verde. Las dos formas de obtenerla —el hook completo y el que solo devuelve la clave— leen la
     sesión ellas mismas, así que ninguna pantalla puede olvidarse de la empresa. */
  assert.match(hooks.limpio, /function usarEmpresaDeLaSesion\(\): string \| null {/);
  for (const quien of ['usarLectura', 'usarClaveDeLectura']) {
    const fn = hooks.limpio.match(new RegExp(`export function ${quien}[\\s\\S]*?\\n}`));
    assert.ok(fn, `no está \`${quien}\``);
    assert.match(
      fn[0],
      /usarEmpresaDeLaSesion\(\)/,
      `\`${quien}\` dejó de leer la empresa de la sesión: pasaría a depender de que el llamador se ` +
        'acuerde, y olvidarse no falla en ninguna parte',
    );
  }

  /* `claveDeLectura(` se puede LLAMAR desde un solo lugar: el hook que lee la sesión. Es la mitad
     que importa — con la función perfecta y una pantalla que llame a `guardar('mi-lista', …)`, la
     fila se rompe y todo lo de arriba sigue verde. */
  const fuera = archivosQueContienen(/claveDeLectura\s*\(/).filter(
    (x) => x !== 'lib/lecturas.ts' && x !== 'lib/usarLectura.ts',
  );
  assert.deepEqual(
    fuera,
    [],
    'alguien arma una clave de caché fuera de los dos archivos de lecturas: la empresa deja de ' +
      'estar garantizada por construcción',
  );

  // Y la lista de memorizaciones no tiene entradas muertas ni motivos vacíos.
  for (const m of MEMORIZACIONES_DEL_NAVEGADOR) {
    assert.ok(
      archivosFuente(['lib']).some((a) => a.ruta === m.archivo),
      `\`${m.archivo}\` ya no existe: sacalo de \`MEMORIZACIONES_DEL_NAVEGADOR\``,
    );
    assert.ok(m.porque.length > 40, `la entrada de \`${m.archivo}\` no dice por qué está permitida`);
  }
});

// ─── ADR-0704 · los errores no revelan estructura ──────────────────────────

test('ADR-0704 · ninguna ruta pasa el mensaje crudo de la base al cliente', () => {
  // El `05` § 3 pide devolver el mensaje de un DISPARADOR tal cual, y tiene razón: *"traducirlos en
  // el backend sería mantener dos textos que dicen lo mismo y que van a divergir"*.
  //
  // Pero un error estructural nombra la tabla. Medido contra esta base:
  //   disparador → `El administrador principal no se puede degradar (usuario 6fffc…).`
  //   estructural → `column "columna_inexistente" of relation "usuarios" does not exist`
  //
  // El discriminante es el SQLSTATE, no el texto: `P0001` es `raise_exception` y ningún error
  // estructural lo produce. `mensajeDeDisparador()` es el único lugar donde vive esa decisión.
  const malos: string[] = [];
  for (const ruta of manejadores()) {
    const limpio = fuenteDe(ruta);
    // Un mensaje de error de la base pasado directo al cuerpo de la respuesta.
    if (/rechazo\s*\([^)]*,\s*(mensaje|String\s*\(\s*\(e|\(e as Error\)\.message)/.test(limpio)) {
      malos.push(`${ruta}: pasa el mensaje crudo`);
    }
    // Y el nombre de una tabla escrito a mano en un cuerpo de error.
    for (const tabla of ['organizaciones_credenciales', 'usuarios_roles', 'usuarios_permisos']) {
      if (new RegExp(`(detalle|motivo|texto)\\s*:[^\\n]{0,80}${tabla}`).test(limpio)) {
        malos.push(`${ruta}: nombra la tabla ${tabla} en un cuerpo de error`);
      }
    }
  }
  assert.deepEqual(
    malos,
    [],
    'el mensaje de la base pasa por `mensajeDeDisparador()`, que solo deja pasar `P0001`',
  );
});

test('ADR-0704 · `mensajeDeDisparador` filtra por SQLSTATE y no por texto', () => {
  const r = archivosFuente(['lib']).find((a) => a.ruta === 'lib/autorizacion/respuesta.ts');
  assert.ok(r);
  assert.match(r.limpio, /P0001/, 'no filtra por el código de `raise_exception`');
  // Y NO por patrones sobre el texto, que sería una lista de palabras prohibidas que hay que
  // mantener y que falla en el idioma equivocado.
  assert.doesNotMatch(
    r.limpio,
    /includes\s*\(\s*['"](relation|column|table)/i,
    'filtrar por texto es una lista de palabras prohibidas que se queda vieja',
  );
});
