// ADR-0401 — El mensaje único va con el tiempo único. (la mitad de análisis estático)
// ADR-0406 — El cambio de contraseña NO exige capacidades.
// ADR-0407 — Ninguna ruta de autenticación registra cuerpos. INNEGOCIABLE.
// ADR-0410 — Un endpoint nuevo nace cerrado a los estados restringidos. INNEGOCIABLE.
// Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS CUATRO QUE NO SE PUEDEN PROBAR CORRIENDO EL SISTEMA
//
// Cada una vigila algo que **no falla** cuando se rompe:
//
//   · `ADR-0407` — un `console.log(cuerpo)` de una noche de depuración escribe contraseñas en
//     claro en un panel que se conserva. Nada falla, y sobre una tabla inmutable el error es
//     permanente.
//   · `ADR-0410` — un endpoint nuevo que nadie agregó a ninguna lista de estados. El código de
//     hoy queda correcto; el defecto lo introduce quien escriba el endpoint número quince.
//   · `ADR-0406` — si el cambio de contraseña exigiera una capacidad, quien no la tenga queda
//     encerrado. Se nota recién cuando le pasa a alguien.
//   · `ADR-0401` — la comparación de largos ANTES de derivar reabre el canal de tiempo, y la
//     prueba de tiempos es sensible al ruido. Ésta lee el código.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { archivosFuente, RAIZ } from '../apoyo/fuente.ts';
import { RUTAS_PUBLICAS, RUTAS_CON_SESION_OPCIONAL } from '../apoyo/autorizados.ts';
import { COMUN, ESTADOS } from '../../lib/autorizacion/estados.ts';

const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

function manejadoresDeRuta(): string[] {
  const dir = join(RAIZ, 'app');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /^route\.(ts|js|tsx|jsx)$/.test(e.name))
    .map((e) => relative(RAIZ, join(e.parentPath, e.name)).split(sep).join('/'))
    .sort();
}

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

/** Las rutas de autenticación: las que manejan credenciales o sesiones. */
function rutasDeAutenticacion(): string[] {
  return manejadoresDeRuta().filter((r) => r.startsWith('app/api/auth/'));
}

// ─── ADR-0407 · ninguna ruta de autenticación registra cuerpos ──────────────

test('ADR-0407 · ninguna ruta de autenticación registra NADA', () => {
  const rutas = rutasDeAutenticacion();
  assert.ok(rutas.length > 0, 'no hay rutas de autenticación: la prueba pasaría en vacío');

  // La prohibición es de TODA función de registro, no solo de las que reciben el cuerpo. El
  // motivo: *"ni en desarrollo — el registro de desarrollo es el que termina desplegado"*, y un
  // `console.log(algo)` en una ruta que maneja credenciales es a un carácter de distancia de
  // `console.log(cuerpo)`.
  const registro = /\bconsole\s*\.\s*(log|info|debug|warn|error|dir|table|trace)\s*\(/;
  const conRegistro = rutas.filter((r) => registro.test(fuenteDe(r)));
  assert.deepEqual(
    conRegistro,
    [],
    'una ruta de autenticación con registro: un `console.log(cuerpo)` está a un carácter, y ' +
      'escribe contraseñas en claro en un panel que se conserva',
  );

  // Y la mitad literal de la fila: el cuerpo nunca se pasa a nada. Se buscan los nombres con
  // los que se lee el cuerpo en este proyecto.
  for (const ruta of rutas) {
    const limpio = fuenteDe(ruta);
    // `peticion.json()` puede aparecer —hay que leer el cuerpo para usarlo— pero su resultado
    // no puede terminar en un `auditar(`, ni en un `detalle:` completo.
    assert.doesNotMatch(
      limpio,
      /auditar\s*\([^)]*\bcuerpo\b/,
      `${ruta} pasa el cuerpo a la función de registro`,
    );
    assert.doesNotMatch(
      limpio,
      /detalle:\s*cuerpo\b|detalle:\s*\{\s*\.\.\./,
      `${ruta} vuelca el cuerpo dentro de \`detalle\``,
    );
  }
});

test('ADR-0407 · el tipo de `detalle` es CERRADO: el cuerpo no cabe', () => {
  // La propiedad estructural, que es la que de verdad la sostiene. Si `Detalle` tuviera un
  // índice abierto (`[clave: string]: unknown`), pasarle el cuerpo compilaría y la búsqueda de
  // arriba sería la única defensa.
  const a = archivosFuente(['lib']).find((x) => x.ruta === 'lib/autenticacion/auditoria.ts');
  assert.ok(a, 'no se encontró el módulo de auditoría');
  assert.doesNotMatch(
    a.limpio,
    /\[\s*[a-zA-Z_]+\s*:\s*string\s*\]\s*:/,
    'un índice abierto en `Detalle` es por donde entra el cuerpo de la petición',
  );
  // Y la contraseña no se nombra en ningún campo del tipo.
  assert.doesNotMatch(a.limpio, /\bpassword\b\s*\??\s*:/, '`Detalle` no puede tener un campo de contraseña');
});

// ─── ADR-0410 · un endpoint nuevo nace cerrado ──────────────────────────────

test('ADR-0410 · toda ruta que llama al portero está en alguna lista de estados', () => {
  // La fila dice: *"recorre las rutas QUE LLAMAN AL PORTERO: las que no están en ninguna lista
  // responden rechazo. Sin acotarlo, la prueba falla sobre el login y la comprobación de
  // salud."*
  //
  // LÍMITE HONESTO, y hay que decirlo: esto verifica la CONFIGURACIÓN, no el comportamiento.
  // Que una ruta no esté en ninguna lista de un estado restringido significa que
  // `estadoHabilita()` devuelve `false` para ella en ese estado — y eso sí es comportamiento
  // probado, en `pruebas/base/40-portero.test.ts` y en `43-estados.test.ts`. Lo que esta prueba
  // agrega es el inventario: que no exista una ruta OLVIDADA, ni una lista con una ruta que ya
  // no existe.
  //
  // Y el sentido de "nace cerrada" es que **no hacer nada es lo correcto**: una ruta nueva que
  // nadie agrega a ninguna lista queda inalcanzable desde todo estado restringido. Por eso la
  // afirmación no es "está en alguna lista" sino la de abajo: que las que SÍ están, estén a
  // propósito.
  const conPortero = manejadoresDeRuta().filter((r) => {
    if (RUTAS_PUBLICAS.includes(r)) return false;
    return /\bexigir\s*\(/.test(fuenteDe(r));
  });
  assert.ok(conPortero.length > 0, 'ninguna ruta llama al portero: la prueba pasaría en vacío');

  // El inventario: cada ruta declarada en un estado restringido tiene que existir y llamar al
  // portero o a `sesionOpcional`. Una entrada muerta hace que la lista deje de decir la verdad.
  const declaradas = new Set<string>();
  for (const rutas of Object.values(ESTADOS)) {
    if (rutas) for (const r of rutas) declaradas.add(r);
  }

  const caminoDe = (archivo: string) =>
    '/' + archivo.replace(/^app\//, '').replace(/\/route\.(ts|js|tsx|jsx)$/, '');

  const existentes = new Set<string>();
  for (const archivo of manejadoresDeRuta()) {
    for (const { metodo } of metodosDe(fuenteDe(archivo))) {
      existentes.add(`${metodo} ${caminoDe(archivo)}`);
    }
  }

  // Toda ruta del conjunto COMUN tiene que existir: son las dos salidas de todo estado, y una
  // salida que no existe es una cuenta encerrada.
  for (const c of COMUN) {
    assert.ok(existentes.has(c), `${c} está en COMUN y no existe: es un estado sin salida`);
  }
});

test('ADR-0410 · el portero rechaza por omisión, no por lista negra', () => {
  // La propiedad que hace que "nace cerrada" sea cierta, leída en el código: `estadoHabilita`
  // devuelve `false` cuando el estado no está en el diccionario y cuando la ruta no está en su
  // lista. Si en algún lugar hubiera un `?? true` o un `|| true`, todo lo de arriba sería
  // decorativo.
  const a = archivosFuente(['lib']).find((x) => x.ruta === 'lib/autorizacion/estados.ts');
  assert.ok(a, 'no se encontró el módulo de estados');
  assert.doesNotMatch(a.limpio, /\?\?\s*true|\|\|\s*true/, 'un respaldo a `true` abre todo');
  // Y el portero no tiene una lista de rutas EXENTAS del paso 2. Solo `activa` habilita todo,
  // y lo hace por `null`, no por una excepción.
  const p = archivosFuente(['lib']).find((x) => x.ruta === 'lib/autorizacion/portero.ts');
  assert.ok(p, 'no se encontró el portero');
  assert.match(p.limpio, /estadoHabilita\s*\(/, 'el portero no consulta las listas de estado');
});

// ─── ADR-0406 · el cambio de contraseña ─────────────────────────────────────

test('ADR-0406 · el cambio de contraseña pide `NINGUNA` capacidad', () => {
  // Es la ÚNICA salida del estado `debe_cambiar_password`. Si exigiera una capacidad, alguien
  // con contraseña temporal y sin esa capacidad queda encerrado — y un estado sin salida es
  // una cuenta bloqueada que necesita a un administrador (03 § 5).
  const archivo = 'app/api/auth/sesion/route.ts';
  const limpio = fuenteDe(archivo);
  const post = metodosDe(limpio).find((m) => m.metodo === 'POST');
  assert.ok(post, `${archivo} no exporta POST: la salida del estado no existe`);

  const llamada = /\bexigir\s*\(\s*[A-Za-z]+\s*,\s*([^)]*)\)/.exec(post.cuerpo);
  assert.ok(llamada, 'el cambio de contraseña no llama al portero');
  assert.equal(
    /* El tercer argumento —la pantalla— se descarta: lo que esta prueba mide es la CAPACIDAD.
       Sin el recorte, el valor con nombre `NINGUNA` se leía como `'NINGUNA, SIN_SECCION'` y esta
       comparación fallaba sobre una ruta correcta. Y una prueba que falla sobre lo correcto se
       termina ignorando. */
    (llamada[1] ?? '')
      .replace(/,\s*(PANTALLA|SIN_SECCION)\s*,?\s*$/, '')
      .trim(),
    'NINGUNA',
    'el cambio de contraseña exige una capacidad: encierra a quien no la tenga',
  );

  // Y está en la lista de `debe_cambiar_password`, o el estado no tendría salida.
  const permitidas = ESTADOS['debe_cambiar_password'];
  assert.ok(permitidas, 'falta el estado debe_cambiar_password');
  assert.ok(
    permitidas.includes('POST /api/auth/sesion'),
    'el cambio de contraseña no está habilitado en el estado que sale por él',
  );
});

// ─── ADR-0401 · la mitad que la prueba de tiempos no puede sostener ─────────

test('ADR-0401 · la comparación de largos va DESPUÉS de derivar', () => {
  // El `02` § 4 lo marca como *"detalle que parece limpieza y no lo es: si cortara antes, el
  // camino del señuelo terminaría más rápido que el de un hash real y el canal de tiempo se
  // abriría por la puerta de al lado"*.
  //
  // La prueba de tiempos es sensible al ruido; ésta lee el orden en el código y no puede
  // fallar por una pausa del recolector de basura.
  const h = archivosFuente(['lib']).find((x) => x.ruta === 'lib/datos/hash.ts');
  assert.ok(h, 'no se encontró el módulo de hash');
  const derivar = h.limpio.indexOf('const calculado = derivar(');
  const comparar = h.limpio.search(/calculado\.length\s*!==\s*esperado\.length/);
  assert.ok(derivar > 0, 'no se encontró la derivación');
  assert.ok(comparar > 0, 'no se encontró la comparación de largos');
  assert.ok(
    comparar > derivar,
    'la comparación de largos está ANTES de derivar: el canal de tiempo está abierto',
  );
});

test('ADR-0401 · el señuelo tiene los MISMOS parámetros que un hash real', () => {
  // `verificar()` deriva con `largo = esperado.length`, así que un señuelo con 32 bytes en vez
  // de 64 **cuesta menos** y el camino del correo inexistente vuelve a ser el más rápido.
  const s = archivosFuente(['lib']).find((x) => x.ruta === 'lib/autenticacion/senuelo.ts');
  assert.ok(s, 'no se encontró el señuelo');
  const valor = /'(scrypt\$[^']+)'/.exec(s.limpio)?.[1];
  assert.ok(valor, 'no se encontró el valor del señuelo');

  const partes = valor.split('$');
  assert.equal(partes.length, 6, 'el señuelo no tiene el formato de un hash real');
  assert.deepEqual(partes.slice(1, 4), ['16384', '8', '1'], 'los parámetros no son los reales');
  assert.equal(
    Buffer.from(partes[5] ?? '', 'base64').length,
    64,
    'el señuelo no tiene 64 bytes: cuesta menos que un hash real',
  );
});

// ─── El estado de la sesión se RECALCULA, nunca se escribe literal ──────────

test('las tres transiciones llaman a `estadoQueCorresponde`, ninguna escribe un estado literal', () => {
  // ═════════════════════════════════════════════════════════════════════════
  // ESTA PRUEBA REEMPLAZA A UNA DE BASE QUE DEJÓ DE PODER MEDIR
  //
  // El cambio de contraseña escribía `estado: 'activa'` con una constante en vez de recalcular,
  // y eso salteaba entero el segundo factor obligatorio: un usuario con contraseña temporal y un
  // rol que lo exigía quedaba dentro siete días sin haberlo configurado. Lo cazó una prueba de
  // base.
  //
  // Cuando el segundo factor pasó a ser opcional (migración 010), la constante y el recálculo se
  // volvieron **indistinguibles por comportamiento** en ese camino: las cuatro ramas ahora
  // devuelven `activa` ahí. O sea que la prueba de base dejó de poder ver la diferencia, y una
  // prueba que no puede fallar por lo que dice medir es peor que ninguna.
  //
  // Así que la garantía se muda acá, donde SÍ se puede ver: se afirma la FORMA del código. El
  // recálculo se conserva porque es correcto por construcción y sigue estando bien el día que
  // alguien vuelva a exigir el factor por rol — y esta prueba es lo que impide que alguien lo
  // "simplifique" de vuelta a una constante mientras eso no se puede observar.
  // ═════════════════════════════════════════════════════════════════════════
  const CAMINOS = [
    'app/api/auth/login/route.ts',
    'app/api/auth/sesion/route.ts',
    'app/api/auth/2fo/confirmar/route.ts',
    'app/api/auth/2fo/verificar/route.ts',
  ];

  const archivos = archivosFuente(['app']);
  for (const camino of CAMINOS) {
    const a = archivos.find((x) => x.ruta === camino);
    assert.ok(a, `no se encontró ${camino}`);
    assert.match(
      a.limpio,
      /\bestadoQueCorresponde\s*\(/,
      `${camino} decide el estado de una sesión sin recalcularlo con las cuatro ramas`,
    );
  }

  // LA MITAD COMPLEMENTARIA: que nadie escriba un estado literal en `sesiones.estado`.
  //
  // Sin ella, un archivo podría llamar a `estadoQueCorresponde` para una rama y escribir
  // `'activa'` a mano en otra — que es exactamente la forma que tenía el defecto. Se excluye
  // `login/route.ts`, que legítimamente escribe el resultado de la función en una variable
  // llamada `estado`; lo que se busca es la CADENA literal junto al `set`.
  const literales = archivos
    .filter((a) => /\.set\(\s*\{[^}]*estado:\s*'(activa|pendiente_2fo|debe_)/s.test(a.limpio))
    .map((a) => a.ruta);
  assert.deepEqual(
    literales,
    [],
    'un manejador escribe un estado de sesión literal: tiene que salir de `estadoQueCorresponde`',
  );
});
