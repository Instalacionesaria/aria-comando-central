// LA REDACCIÓN DEL PLAN: EL MODELO SÓLO REDACTA, Y LO QUE INVENTA SE QUITA. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/plan/redaccion.ts` (AG9 de los agentes; `docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`,
// AG-32; `docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md`, A6-18):
//
//   · una frase con una cifra que no está en su renglón se quita: el modelo no calcula ni redondea;
//   · un superlativo sin su ranking se quita —«el más», «la mejor», «máximo»—, y un comparativo («más barato
//     que») no es un superlativo;
//   · una clave que no existe, una frase vacía o una repetida, tampoco pasan;
//   · lo que se quita se cuenta, por motivo, y ese renglón conserva la frase de la plantilla.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { renglonesParaRedactar, validarRedaccion } from '../../lib/agentes/plan/redaccion.ts';

const plan = {
  grupos: [
    {
      clave: 'data',
      titulo: 'Lo que dice la data',
      renglones: [
        { texto: 'El paso de contacto a agendado está 57 puntos por debajo: 0 % contra 57 %, sobre 19 contactos.', revision: 'Revisa el paso del funnel.' },
        { texto: 'Ninguna de las 2 campañas activas entrega desde hace 15 días cerrados.', revision: 'Revisa el Administrador de anuncios.' },
      ],
    },
    { clave: 'ajusta', titulo: 'Ajusta o pausa esto', renglones: [] },
    {
      clave: 'validacion',
      titulo: 'Requiere validación ejecutiva',
      renglones: [{ texto: 'Se lleva el 67 % del gasto, entre 3 campañas.', revision: 'Decide con la dirección.' }],
    },
  ],
} as never;

const originales = renglonesParaRedactar(plan);

test('las claves son `grupo:índice`, sólo de los grupos con renglones', () => {
  assert.deepEqual(originales.map((o) => o.clave), ['data:0', 'data:1', 'validacion:0']);
});

test('pasa la frase que usa las cifras del renglón, sin superlativos', () => {
  const r = validarRedaccion(originales, {
    renglones: [
      { clave: 'data:0', frase: 'En Profile funnel agenda el 0 % contra el 57 % de los otros funnels, sobre 19 contactos: revisa ese paso.' },
      { clave: 'data:1', frase: 'Las 2 campañas activas no entregan hace 15 días cerrados; revisa el Administrador de anuncios.' },
      // Un comparativo no es un superlativo.
      { clave: 'validacion:0', frase: 'Una campaña se lleva el 67 % del gasto, más que las otras 3 juntas: lo decide la dirección.' },
    ],
  });
  assert.deepEqual(Object.keys(r.renglones), ['data:0', 'data:1', 'validacion:0']);
  assert.deepEqual(r.quitadas, { cifra: 0, superlativo: 0, otras: 0 });
});

test('una cifra que el renglón no trae se quita, y ese renglón queda con la plantilla', () => {
  const r = validarRedaccion(originales, {
    renglones: [
      // 58 no está: el modelo redondeó o inventó.
      { clave: 'data:0', frase: 'El paso de contacto a agendado está 58 puntos por debajo.' },
      // 20 % tampoco: lo calculó.
      { clave: 'data:1', frase: 'Las 2 campañas perdieron un 20 % de la entrega en 15 días.' },
    ],
  });
  assert.deepEqual(r.renglones, {});
  assert.equal(r.quitadas.cifra, 2);
});

test('un superlativo sin su ranking se quita (A6-18)', () => {
  for (const frase of [
    'Es el más caro de los tres funnels, sobre 19 contactos.',
    'La mejor campaña se lleva el 67 % del gasto.',
    'Es la mayor fuga: 57 puntos.',
    'Llegó al máximo de 15 días sin entregar.',
  ]) {
    const r = validarRedaccion(originales, { renglones: [{ clave: 'data:0', frase }] });
    assert.equal(r.quitadas.superlativo + r.quitadas.cifra, 1, `pasó: «${frase}»`);
    assert.deepEqual(r.renglones, {});
  }
});

test('una clave que no existe, una frase vacía o una repetida no pasan', () => {
  const r = validarRedaccion(originales, {
    renglones: [
      { clave: 'data:9', frase: 'Algo.' },
      { clave: 'data:0', frase: '   ' },
      { clave: 'data:1', frase: 'Las 2 campañas no entregan hace 15 días cerrados.' },
      { clave: 'data:1', frase: 'Otra vez las 2 campañas, 15 días.' },
    ],
  });
  assert.deepEqual(Object.keys(r.renglones), ['data:1']);
  assert.equal(r.quitadas.otras, 3);
  // Lo que no es una lista no rompe: no hay redacción.
  assert.deepEqual(validarRedaccion(originales, 'texto suelto').renglones, {});
});
