// LA REDACCIÓN DE LA REUNIÓN: EL ORDEN DEL MODELO Y CADA FRASE CONTRA SU PROPIO TEMA. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/reunion/redaccion.ts` (AG15 de los agentes; `04`, AG-72; F17, AG-F17-1 y AG-F17-4):
//
//   · el orden: sólo claves que existen, sin repetir;
//   · una frase con una cifra que su tema no trae, con un superlativo, con un término «entre comillas» ajeno
//     o con el nombre de otra área se descarta, y ese tema conserva su plantilla;
//   · sin temas no hay pedido. La pasada con el modelo falso la prueba la 239.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { redactarReunion, validarRedaccionDeLaReunion } from '../../lib/agentes/reunion/redaccion.ts';
import type { TemaDeLaReunion } from '../../lib/agentes/reunion/temas.ts';

const tema = (clave: string, origen: string, texto: string): TemaDeLaReunion => ({
  clave,
  regla: clave,
  etiqueta: 'CADENA',
  seccion: clave,
  origen,
  gravedad: 'media',
  perdida: null,
  texto,
  evidencia: {},
});
const TEMAS = [
  tema('acq', 'Systems · Acquisition', 'Entraron 6 contactos en los últimos 7 días cerrados, contra 20 en los 7 anteriores.'),
  tema('clo', 'Sales · Closer', '43 de 46 contactos tuvieron una cita que ya ocurrió y nadie registró si se presentaron.'),
  tema('obj', 'Sales · Llamadas de venta', 'La objeción «precio» crece: 9 en 14 días, contra 3 antes.'),
];
const validar = (devuelto: unknown) => validarRedaccionDeLaReunion(TEMAS, devuelto);

test('el orden: sólo claves que existen, sin repetir', () => {
  assert.deepEqual(validar({ orden: ['clo', 'nada', 'clo', 'acq', 3], temas: [] }).orden, ['clo', 'acq']);
  assert.deepEqual(validar({}).orden, []);
});

test('una frase con sus propias cifras pasa; con otra cifra, no', () => {
  const v = validar({
    orden: [],
    temas: [
      { clave: 'acq', frase: 'La entrada cayó: 6 contactos esta semana contra 20 la anterior. Revisa la pauta.' },
      { clave: 'clo', frase: '43 de 46 contactos, es decir el 93 %, esperan registro.' },
    ],
  });
  assert.deepEqual(Object.keys(v.textos), ['acq']);
  assert.equal(v.quitadas.cifra, 1);
});

test('sin superlativos', () => {
  const v = validar({ orden: [], temas: [{ clave: 'clo', frase: 'Es el mayor problema: 43 de 46 citas sin registrar.' }] });
  assert.deepEqual([v.textos, v.quitadas.superlativo], [{}, 1]);
});

test('sin referencias cruzadas: ni otra área ni un término entre comillas que su tema no trae', () => {
  const v = validar({
    orden: [],
    temas: [
      // Nombra la objeción de otro tema.
      { clave: 'clo', frase: '43 de 46 citas sin registrar; en las que sí, aparece «precio».' },
      // Nombra otra área.
      { clave: 'obj', frase: 'La objeción «precio» crece (9 contra 3): coincide con la caída en Acquisition.' },
      // Su propia área y su propio término: pasa.
      { clave: 'acq', frase: 'En Acquisition entraron 6 contactos contra 20: revisa la pauta.' },
    ],
  });
  assert.deepEqual(Object.keys(v.textos), ['acq']);
  assert.equal(v.quitadas.cruzada, 2);
  // Un nombre que también es de su origen («Sales») no cuenta como ajeno.
  const sales = validar({ orden: [], temas: [{ clave: 'clo', frase: 'En Sales, 43 de 46 citas esperan registro.' }] });
  assert.deepEqual(Object.keys(sales.textos), ['clo']);
});

test('una clave que no existe, repetida, o una frase vacía, se cuentan y no entran', () => {
  const v = validar({
    orden: [],
    temas: [
      { clave: 'nada', frase: 'x' },
      { clave: 'acq', frase: '' },
      { clave: 'clo', frase: '43 de 46 esperan registro.' },
      { clave: 'clo', frase: '43 de 46 otra vez.' },
    ],
  });
  assert.deepEqual([Object.keys(v.textos), v.quitadas.otras], [['clo'], 3]);
  assert.equal(v.textos.clo, '43 de 46 esperan registro.');
});

test('sin temas no hay pedido', async () => {
  // Contar y no lanzar: el transporte atrapa lo que lanza el pedido, y el resultado sería `null` igual.
  const original = globalThis.fetch;
  let pedidos = 0;
  globalThis.fetch = (async () => {
    pedidos += 1;
    return new Response('{}', { status: 500 });
  }) as typeof globalThis.fetch;
  try {
    assert.equal(await redactarReunion({ temas: [], dia: '2026-10-06', llave: 'sk-de-prueba-241', orgId: '00000000-0000-0000-0000-000000000000', espera: 1000 }), null);
    assert.equal(pedidos, 0, 'sin temas se llamó al modelo');
  } finally {
    globalThis.fetch = original;
  }
});
