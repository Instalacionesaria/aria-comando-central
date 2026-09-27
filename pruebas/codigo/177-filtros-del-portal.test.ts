// La búsqueda y los filtros de la rejilla de Leads Portal. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA
//
// Filtrar en la pantalla es honesto mientras diga lo mismo que las tarjetas. Tres formas de que no:
//
//   · **«martin» no encuentra a «Martín».** La cartera está llena de tildes y nadie las escribe en un
//     buscador: sin normalizar, la búsqueda dice que no existe alguien que está tres filas más abajo.
//   · **«Sin calificar» deja afuera a los ceros.** El usuario decidió el 2026-09-26 que el 0 cuenta
//     como sin calificar; si el filtro lo decidiera de nuevo con el puntaje, la tarjeta y la rejilla
//     contarían distinto.
//   · **Un vacío que miente.** «Asistieron» vacío porque nadie registró asistencia no es «ninguno
//     coincide», y «Vendidos» vacío sin ninguna venta en la empresa tampoco.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import {
  DE_A,
  SIN_FILTROS,
  contador,
  filtrar,
  porQueVacia,
  type FilaFiltrable,
  type Filtros,
} from '../../lib/negocio/filtrosDelPortal.ts';

const fila = (o: Partial<FilaFiltrable> & { nombre: string }): FilaFiltrable => ({
  campana: null,
  creativo: null,
  tramo: 'medio',
  cita: 'sin_cita',
  asistencia: null,
  vendio: false,
  ...o,
});

const FILAS: FilaFiltrable[] = [
  fila({ nombre: 'Martín Benítez', campana: 'Campaña Otoño', creativo: 'Pieza 3', tramo: 'alto', cita: 'agendo' }),
  fila({ nombre: 'Sofía Ruiz', campana: 'Remarketing', creativo: 'Video Testimonio', tramo: 'sin_calificar' }),
  fila({ nombre: 'Ana Paz', tramo: 'sin_calificar', cita: 'solo_congeladas' }),
  fila({ nombre: 'Luis Gómez', tramo: 'bajo', cita: 'agendo', asistencia: 'sin_registrar' }),
  fila({ nombre: 'Rosa Díaz', tramo: 'alto', cita: 'agendo', asistencia: 'asistio', vendio: true }),
];

const con = (f: Partial<Filtros>): Filtros => ({ ...SIN_FILTROS, ...f });
const nombres = (xs: FilaFiltrable[]) => xs.map((x) => x.nombre);

test('«martin» encuentra a «Martín», sin tildes y sin mayúsculas', () => {
  assert.deepEqual(nombres(filtrar(FILAS, con({ consulta: 'martin' }))), ['Martín Benítez']);
  assert.deepEqual(nombres(filtrar(FILAS, con({ consulta: '  BENITEZ ' }))), ['Martín Benítez']);
});

test('busca en la campaña y en el creativo, y en nada más', () => {
  assert.deepEqual(nombres(filtrar(FILAS, con({ consulta: 'otono' }))), ['Martín Benítez']);
  assert.deepEqual(nombres(filtrar(FILAS, con({ consulta: 'testimonio' }))), ['Sofía Ruiz']);
  /* Un campo que no existe en la fila no hace coincidir: la búsqueda mira tres campos, no el objeto. */
  assert.deepEqual(filtrar(FILAS, con({ consulta: 'agendo' })), [], 'la búsqueda miró el estado de la cita');
});

test('«Sin calificar» filtra por la clave que mandó el servidor, así que el 0 está adentro', () => {
  /* Las dos filas `sin_calificar` pueden ser un nulo o un 0: el filtro no mira el puntaje, mira la
     clave, y el servidor ya puso ahí a los ceros. */
  assert.deepEqual(nombres(filtrar(FILAS, con({ tramo: 'sin_calificar' }))), ['Sofía Ruiz', 'Ana Paz']);
});

test('las etapas usan las definiciones de la tarjeta, y se combinan con el tramo y la búsqueda', () => {
  /* «Agendados» es `cita === 'agendo'`: la persona con sólo citas congeladas no entra, igual que en la
     tarjeta. */
  assert.deepEqual(nombres(filtrar(FILAS, con({ etapa: 'agendados' }))), ['Martín Benítez', 'Luis Gómez', 'Rosa Díaz']);
  assert.deepEqual(nombres(filtrar(FILAS, con({ etapa: 'asistieron' }))), ['Rosa Díaz'], '«sin registrar» contó como asistió');
  assert.deepEqual(nombres(filtrar(FILAS, con({ etapa: 'vendidos' }))), ['Rosa Díaz']);
  assert.deepEqual(nombres(filtrar(FILAS, con({ etapa: 'agendados', tramo: 'alto', consulta: 'rosa' }))), ['Rosa Díaz']);
});

test('el contador nombra los filtros por su rótulo, cuántas se muestran, y si la lista llegó incompleta', () => {
  assert.equal(
    contador({ vistas: 3, mostradas: 3, cohorte: 5, filtros: con({ tramo: 'alto', etapa: 'agendados' }), truncado: false }),
    '3 de 5 contactos · ICP alto · Agendados',
  );
  assert.match(contador({ vistas: 200, mostradas: DE_A, cohorte: 286, filtros: SIN_FILTROS, truncado: false }), /mostrando 60/);
  assert.match(contador({ vistas: 2, mostradas: 2, cohorte: 9000, filtros: SIN_FILTROS, truncado: true }), /incompleta/);
});

test('un vacío dice por qué: no es lo mismo que nadie haya registrado que ninguno coincida', () => {
  const base = { asistenciasRegistradas: 0, sinRegistrar: 47, hayVentasRegistradas: false, truncado: false };
  assert.match(porQueVacia({ ...base, filtros: con({ etapa: 'asistieron' }) }), /Nadie registró asistencia/);
  assert.match(porQueVacia({ ...base, filtros: con({ etapa: 'asistieron' }) }), /47/);
  assert.match(porQueVacia({ ...base, filtros: con({ etapa: 'vendidos' }) }), /ninguna venta registrada/);
  assert.equal(porQueVacia({ ...base, filtros: con({ consulta: 'zzz' }) }), 'Ningún contacto coincide con estos filtros.');
  /* Con asistencias registradas, un «Asistieron» vacío sí es una búsqueda sin coincidencias. */
  assert.equal(
    porQueVacia({ ...base, asistenciasRegistradas: 3, filtros: con({ etapa: 'asistieron' }) }),
    'Ningún contacto coincide con estos filtros.',
  );
  assert.match(porQueVacia({ ...base, truncado: true, filtros: con({ consulta: 'zzz' }) }), /entre los que llegaron/);
});

test('los filtros no importan nada que toque la base', () => {
  /* Los usa el panel, que es `'use client'`. Un import de `leadsDelPortal.ts` que no sea de tipo
     metería la capa de datos en el paquete del navegador. */
  const ts = readFileSync(join(RAIZ, 'lib/negocio/filtrosDelPortal.ts'), 'utf8');
  const imports = [...ts.matchAll(/^\s*import\s(?!type\s)[^;]+from\s+'([^']+)';/gm)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ['./buscarLead.ts', './tramosDelIcp.ts']);
});
