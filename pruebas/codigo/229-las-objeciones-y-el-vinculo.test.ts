// LA CATEGORÍA DE CADA OBJECIÓN ES DE UN JUEGO CERRADO, EL VÍNCULO DICE CUÁNTAS NO CASAN Y EL ESTADO DEL
// CLIENTE SALE DE SU ANÁLISIS. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// AG11 de los agentes (`docs/OTROS/agentes/fichas/F14-LLAMADAS-DE-VENTA.md` y `F15-LLAMADAS-DE-ONBOARDING.md`):
//
//   · las categorías son un juego cerrado con «otra», el mismo en el código, en el tipo y en el `check` de la
//     migración 073;
//   · de la respuesta del modelo vale sólo un índice pedido, una categoría del juego y el primero de cada índice;
//   · el vínculo cuenta cada vía y, sin vínculo, cada motivo: la ambigua no se esconde;
//   · el estado del cliente de onboarding: bloqueado o compromiso bajo, EN RIESGO; a medias o con señales,
//     ATENCIÓN; si no, AL DÍA.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATEGORIAS_DE_OBJECION, validarCategorias } from '../../lib/analizadores/objeciones.ts';
import { contarVinculos } from '../../lib/negocio/vinculoDeLlamadas.ts';
import { estadoDelCliente } from '../../lib/negocio/llamadasDeOnboarding.ts';

const RAIZ = join(import.meta.dirname, '..', '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

test('las categorías son un juego cerrado con «otra», el mismo en el código, el tipo y la migración', () => {
  assert.ok(CATEGORIAS_DE_OBJECION.includes('otra'));
  const enLaMigracion = /categoria text not null check \(categoria in \(([^)]+)\)\)/.exec(leer('db/migraciones/073_las_objeciones_clasificadas.sql'))![1]!;
  assert.deepEqual(enLaMigracion.split(',').map((x) => x.trim().replace(/'/g, '')), [...CATEGORIAS_DE_OBJECION]);
  const enElTipo = /categoria: ((?:'[a-z]+'(?: \| )?)+);/.exec(leer('lib/datos/esquema.ts'))![1]!;
  assert.deepEqual(enElTipo.split('|').map((x) => x.trim().replace(/'/g, '')), [...CATEGORIAS_DE_OBJECION]);
});

test('de la respuesta vale un índice pedido, una categoría del juego y el primero de cada índice', () => {
  const pedidas = [0, 1, 2].map((indice) => ({ indice, huella: 'x'.repeat(32), texto: `objeción ${indice}` }));
  const r = validarCategorias(pedidas, {
    categorias: [
      { indice: 0, categoria: 'precio' },
      { indice: 0, categoria: 'momento' }, // el segundo del mismo índice no pisa al primero
      { indice: 1, categoria: 'caro' }, // fuera del juego
      { indice: 7, categoria: 'otra' }, // no se pidió
      { indice: '2', categoria: 'otra' }, // no es un número
    ],
  });
  assert.deepEqual([...r], [[0, 'precio']]);
  assert.deepEqual([...validarCategorias(pedidas, { otra: 'cosa' })], []);
  assert.deepEqual([...validarCategorias(pedidas, null)], []);
});

test('el vínculo cuenta cada vía y, sin vínculo, cada motivo', () => {
  const v = (por: 'correo' | 'cita' | null, sinVinculo: 'sin_correo_ni_cita' | 'cita_ambigua' | null) => ({ llamadaId: 'l', contactoId: por ? 'c' : null, por, sinVinculo });
  assert.deepEqual(
    contarVinculos([v('correo', null), v('correo', null), v('cita', null), v(null, 'cita_ambigua'), v(null, 'sin_correo_ni_cita')]),
    { llamadas: 5, porCorreo: 2, porCita: 1, sinVinculo: 2, ambiguas: 1 },
  );
});

test('el estado del cliente de onboarding sale de su análisis', () => {
  const e = (arranque: string | null, compromiso: string | null, senalesDeRiesgo = 0) => estadoDelCliente({ arranque, compromiso, senalesDeRiesgo });
  assert.equal(e('BLOQUEADO', 'ALTO'), 'EN RIESGO');
  assert.equal(e('LISTO', 'BAJO'), 'EN RIESGO');
  assert.equal(e('PARCIAL', 'ALTO'), 'ATENCIÓN');
  assert.equal(e('LISTO', 'ALTO', 1), 'ATENCIÓN');
  assert.equal(e('LISTO', 'ALTO'), 'AL DÍA');
});
