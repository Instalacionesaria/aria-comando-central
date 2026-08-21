// ADR-0507 — El generador de temporales no tiene sesgo.
// Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// UNA PRUEBA ESTADÍSTICA, Y POR QUÉ ES LA ÚNICA FORMA
//
// El sesgo modular no produce ningún síntoma: la contraseña se ve aleatoria, nadie se queja, y
// el defecto solo aparece **contando**. `PRUEBAS.md` lo pide con esas palabras —*"distribución
// de caracteres sobre muchas muestras"*— porque no hay otra manera de verlo.
//
// El riesgo de una prueba estadística es el opuesto al de las demás: puede fallar sobre código
// correcto por azar. Se controla con dos cosas, y las dos están abajo: **una muestra grande** y
// **un umbral calculado, no adivinado**.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente, archivosQueContienen } from '../apoyo/fuente.ts';
import { ALFABETO, LARGO, LIMITE, contrasenaTemporal } from '../../lib/autenticacion/temporal.ts';

test('ADR-0507 · la distribución de caracteres es plana', () => {
  // 210 000 caracteres sobre 57 símbolos son ~3684 apariciones esperadas de cada uno. Con esa
  // muestra la desviación estándar de cada conteo es ~√3684 ≈ 61, o sea ~1,6 % del esperado.
  //
  // El umbral es 8 %, que son CINCO desviaciones: la probabilidad de que un generador correcto lo
  // cruce por azar es de una en varios millones **por carácter**, así que una prueba inestable no
  // es el riesgo. Y detecta de sobra el defecto real: sin el descarte, los 28 primeros caracteres
  // salen un ~20 % más seguido, porque 256 = 4 × 57 + 28.
  const MUESTRAS = 15_000; // × 14 caracteres = 210 000
  const conteo = new Map<string, number>();
  for (const c of ALFABETO) conteo.set(c, 0);

  for (let i = 0; i < MUESTRAS; i++) {
    const clave = contrasenaTemporal();
    assert.equal(clave.length, LARGO, 'largo inesperado');
    for (const c of clave) {
      const previo = conteo.get(c);
      // Un carácter fuera del alfabeto es un defecto distinto y hay que verlo, no promediarlo.
      assert.notEqual(previo, undefined, `carácter fuera del alfabeto: ${JSON.stringify(c)}`);
      conteo.set(c, (previo ?? 0) + 1);
    }
  }

  const total = MUESTRAS * LARGO;
  const esperado = total / ALFABETO.length;
  const desviados = [...conteo]
    .map(([c, n]) => ({ c, n, desvio: Math.abs(n - esperado) / esperado }))
    .filter((x) => x.desvio > 0.08)
    .sort((a, b) => b.desvio - a.desvio);

  assert.deepEqual(
    desviados.map((x) => `${x.c}: ${x.n} (${(x.desvio * 100).toFixed(1)} % de desvío)`),
    [],
    `esperado ~${esperado.toFixed(0)} por carácter sobre ${total}: hay sesgo en el generador`,
  );

  // Y la guarda de que la muestra sirvió: los 57 caracteres tienen que haber aparecido. Si
  // alguno no apareció nunca, el bucle de arriba no lo habría marcado como desviado —su desvío
  // sería 100 % y sí lo marcaría—, pero conviene decirlo aparte porque significa otra cosa: un
  // alfabeto que el generador no usa entero.
  const ausentes = [...conteo].filter(([, n]) => n === 0).map(([c]) => c);
  assert.deepEqual(ausentes, [], 'hay caracteres del alfabeto que el generador nunca produce');
});

test('ADR-0507 · el alfabeto no tiene caracteres ambiguos ni repetidos', () => {
  // Un carácter repetido en el alfabeto es un sesgo por la puerta de al lado: sale el doble.
  assert.equal(new Set(ALFABETO).size, ALFABETO.length, 'el alfabeto tiene caracteres repetidos');

  // Los CINCO que nombra el `05` § 3, *"porque estas contraseñas se dictan por teléfono o se
  // copian a mano"*. Ni más ni menos: agregar exclusiones sobre un documento normativo mueve la
  // entropía y el límite del descarte sin que nadie lo note.
  for (const ambiguo of ['l', 'I', 'O', '0', '1']) {
    assert.ok(!ALFABETO.includes(ambiguo), `el alfabeto incluye ${ambiguo}, que se confunde`);
  }

  // El largo y la entropía. Catorce es del `05` § 3; 57 caracteres dan ~81 bits.
  assert.equal(LARGO, 14, 'el 05 § 3 dice catorce caracteres');
  const bits = LARGO * Math.log2(ALFABETO.length);
  assert.ok(bits > 64, `solo ${bits.toFixed(0)} bits de entropía`);

  // Y el límite del descarte es el que dice el documento: `256 - (256 % largoAlfabeto)`.
  assert.equal(LIMITE, 256 - (256 % ALFABETO.length));
  assert.ok(LIMITE < 256, 'sin descarte no hay defensa contra el sesgo');
});

test('ADR-0507 · el DESCARTE existe en el código, no solo en la estadística', () => {
  // La mitad de análisis estático, y hace falta: la prueba de arriba detecta un sesgo del 8 %,
  // pero un alfabeto que casi divida a 256 daría un sesgo más chico que podría pasarla. Ésta
  // afirma la FORMA que el `05` § 3 escribe, línea por línea.
  const g = archivosFuente(['lib']).find((a) => a.ruta === 'lib/autenticacion/temporal.ts');
  assert.ok(g, 'no se encontró el generador');
  // El descarte: la línea sin la cual el `%` de abajo sí introduce sesgo.
  assert.match(
    g.limpio,
    /if\s*\(\s*byte\s*>=\s*LIMITE\s*\)\s*continue/,
    'falta el descarte de los bytes del resto incompleto',
  );
  assert.match(
    g.limpio,
    /256\s*-\s*\(\s*256\s*%/,
    'el límite no se calcula como manda el 05 § 3',
  );
  // Y `Math.random` en ningún lado del proyecto, que es el otro generador que parece servir.
  assert.deepEqual(
    archivosQueContienen(/Math\.random\s*\(/),
    [],
    'Math.random no es criptográficamente seguro',
  );
});

test('ADR-0506 · la contraseña temporal no llega a ningún registro', () => {
  // La otra fila que depende del generador: *"la contraseña temporal nunca queda registrada. No
  // aparece en la auditoría ni en ningún registro."*
  //
  // La defensa estructural ya está —el tipo `Detalle` de la auditoría es cerrado y no tiene
  // campo de contraseña— y esto es el cinturón: ningún archivo pasa el resultado del generador a
  // una función de registro ni al detalle de la auditoría.
  // `scripts/arranque.mjs` está exceptuado, y con el motivo escrito: es un script INTERACTIVO
  // cuya única forma de entregar la contraseña es imprimirla. Su salida estándar no es un
  // registro —no se persiste en ningún panel ni en la auditoría— y el script **no corre nunca en
  // integración continua**, que es el único lugar donde la salida estándar sí se conserva.
  //
  // La excepción está acá y no en una regla más laxa a propósito: es una entrada que alguien tuvo
  // que escribir, en un cambio que alguien revisa. Es la misma forma que `ARCHIVOS_AUTORIZADOS`.
  const EXCEPTUADOS = ['lib/autenticacion/temporal.ts', 'scripts/arranque.mjs'];
  const usan = archivosQueContienen(/\bcontrasenaTemporal\s*\(/).filter(
    (r) => !EXCEPTUADOS.includes(r),
  );
  // Y la comprobación de entrada muerta de esa lista: el archivo exceptuado tiene que existir y
  // tiene que usar el generador. Una excepción muerta es una excepción que dejó de decir la verdad.
  for (const e of EXCEPTUADOS) {
    assert.ok(
      archivosQueContienen(/\bcontrasenaTemporal\s*\(/).includes(e),
      `${e} está exceptuado y no usa el generador: sacalo de la lista`,
    );
  }

  for (const ruta of usan) {
    const a = archivosFuente(['app', 'lib', 'scripts', 'db']).find((x) => x.ruta === ruta);
    assert.ok(a, `no se pudo leer ${ruta}`);
    assert.doesNotMatch(
      a.limpio,
      /console\s*\.\s*\w+\s*\([^)]*temporal/i,
      `${ruta} registra la contraseña temporal`,
    );
    assert.doesNotMatch(
      a.limpio,
      /detalle:\s*\{[^}]*temporal/i,
      `${ruta} pone la contraseña temporal en el detalle de la auditoría`,
    );
  }
});
