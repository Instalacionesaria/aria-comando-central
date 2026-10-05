// NADA BAJO `lib/agentes/` LLAMA AL MODELO DENTRO DE UNA TRANSACCIÓN, NI IMPORTA LA IDENTIDAD. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// Dos reglas de `docs/OTROS/agentes/01-LA-ARQUITECTURA.md` que no fallan en una prueba de un solo usuario:
//
//   · AG-05: el modelo no se espera dentro de `conOrganizacion(`. Una transacción abierta durante dos
//     minutos retiene una de las cinco conexiones del agrupador. La 210 lo mide en la base; ésta lo mira en
//     el código, en cada archivo de los agentes y en las rutas del cerebro.
//   · AG-88 de `05`: la llave y lo demás de identidad se resuelven en la ruta. Nada bajo `lib/agentes/`
//     importa `conIdentidad`: si lo hiciera, el cerebro podría leer identidad sin pasar por el portero.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente } from '../apoyo/fuente.ts';

/** Lo que llama al modelo, directa o indirectamente, desde lo que esta prueba mira. */
const LLAMAN_AL_MODELO = /\b(llamarAlModelo|preguntar)\s*\(/;

/** El texto de cada llamada a `conOrganizacion(`: desde el paréntesis hasta el que lo cierra. */
function dentroDeConOrganizacion(codigo: string): string[] {
  const tramos: string[] = [];
  const patron = /\bconOrganizacion\s*\(/g;
  for (let m = patron.exec(codigo); m !== null; m = patron.exec(codigo)) {
    let profundidad = 1;
    let i = m.index + m[0].length;
    for (; i < codigo.length && profundidad > 0; i++) {
      if (codigo[i] === '(') profundidad += 1;
      else if (codigo[i] === ')') profundidad -= 1;
    }
    tramos.push(codigo.slice(m.index, i));
  }
  return tramos;
}

const DEL_CEREBRO = archivosFuente(['lib/agentes', 'app/api/executive']);

test('se leyeron los archivos del cerebro', () => {
  const rutas = DEL_CEREBRO.map((a) => a.ruta);
  for (const r of ['lib/agentes/executive/preguntar.ts', 'lib/agentes/llamada.ts', 'app/api/executive/route.ts']) {
    assert.ok(rutas.includes(r), `no se leyó ${r}`);
  }
});

test('ninguna llamada al modelo dentro de una `conOrganizacion(`', () => {
  const culpables = DEL_CEREBRO.flatMap((a) =>
    dentroDeConOrganizacion(a.limpio)
      .filter((tramo) => LLAMAN_AL_MODELO.test(tramo))
      .map((tramo) => `${a.ruta}: ${tramo.slice(0, 120)}`),
  );
  assert.deepEqual(culpables, []);
  // La entrada muerta: el detector encuentra las `conOrganizacion(` que sí hay.
  const preguntar = DEL_CEREBRO.find((a) => a.ruta === 'lib/agentes/executive/preguntar.ts')!;
  assert.ok(dentroDeConOrganizacion(preguntar.limpio).length >= 3);
  assert.match(preguntar.limpio, /\bllamarAlModelo\s*\(/);
});

test('nada bajo `lib/agentes/` importa `conIdentidad`', () => {
  const culpables = archivosFuente(['lib/agentes'])
    .filter((a) => /\bconIdentidad\b/.test(a.limpio))
    .map((a) => a.ruta);
  assert.deepEqual(culpables, []);
});
