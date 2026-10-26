// Los cuadrantes del ICP: qué texto del CRM es cuál palabra, en qué orden se dibujan, cuáles son calificados, y que el
// módulo no arrastre nada. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (ICP en cuadrantes · Q1, decidido por el usuario el 2026-10-26)
//
// El CRM manda la opción como está escrita en el campo («Prioriza»), y la columna guarda la clave («prioriza»). Una
// normalización que se equivoca no falla: deja a un lead en «Sin clasificar» o, peor, lo clasifica por la pregunta
// equivocada —la subcuenta de ARIA tiene OTRO campo, `contact.cuadrante`, con «Prioridad» y «Descartar»—. Por eso se
// prueban los bordes de a uno, y las mutaciones que esto caza son:
//
//   · sin recortar espacios, o sin quitar la tilde, o sin pasar a minúscula: un valor del CRM queda sin clasificar;
//   · comparar por prefijo o por parecido: «Prioridad» y «Descartar» entran como Prioriza y Descarta;
//   · Descarta entre los calificados, o Valida/Financia afuera;
//   · el orden de las tarjetas, o un rótulo que no es la palabra del CRM;
//   · un import en el módulo, que lo arrastra al navegador.
//
// Que el SQL normalice igual lo prueba la 311, contra la base.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import {
  CALIFICADOS,
  CON_TILDE,
  CUADRANTES,
  LOS_CUATRO,
  SIN_TILDE,
  claveDelCuadrante,
  cuadranteDeUnValor,
  esCuadranteCalificado,
  rotuloDelCuadrante,
} from '../../lib/negocio/cuadrantesDelIcp.ts';
import { CLAVE_DEL_CUADRANTE } from '../../lib/ghl/contrato.ts';
import { BORDES_DEL_CUADRANTE } from '../apoyo/cuadrantes.ts';

const MODULO = 'lib/negocio/cuadrantesDelIcp.ts';

/** Los valores de borde, con lo que tiene que salir de cada uno: los mismos que la 311 le pasa al SQL. */
const BORDES = BORDES_DEL_CUADRANTE;

test('cada texto del CRM cae en su cuadrante, y lo que no es ninguna de las cuatro queda afuera', () => {
  /* Como un mapa entero: el mensaje de un fallo muestra todos los bordes a la vez. */
  assert.deepEqual(
    BORDES.map(([v]) => [JSON.stringify(v) ?? 'undefined', cuadranteDeUnValor(v)]),
    BORDES.map(([v, esperado]) => [JSON.stringify(v) ?? 'undefined', esperado]),
  );
});

test('las tildes se quitan posición por posición: las dos listas tienen el mismo largo', () => {
  // El SQL usa `translate` con estas dos cadenas: con largos distintos, `translate` BORRA las que sobran.
  assert.equal([...CON_TILDE].length, [...SIN_TILDE].length);
});

test('el campo se reconoce por su clave exacta, que no es la del otro campo «cuadrante»', () => {
  assert.equal(CLAVE_DEL_CUADRANTE, 'contact.cuadrante_de_clasificacion');
  assert.notEqual(CLAVE_DEL_CUADRANTE, 'contact.cuadrante');
});

test('calificados son Prioriza, Valida y Financia; Descarta no', () => {
  assert.deepEqual([...CALIFICADOS], ['prioriza', 'valida', 'financia']);
  assert.deepEqual(
    [...LOS_CUATRO, 'rechazo', null, undefined].map((c) => esCuadranteCalificado(c)),
    [true, true, true, false, false, false, false],
  );
});

test('las tarjetas van en el orden fijo, con las palabras del CRM y su nivel', () => {
  assert.deepEqual(
    CUADRANTES.map((c) => [c.clave, c.rotulo, c.nivel]),
    [
      ['sin_clasificar', 'Sin clasificar', null],
      ['prioriza', 'Prioriza', 'alto'],
      ['valida', 'Valida', 'medio'],
      ['financia', 'Financia', 'medio'],
      ['descarta', 'Descarta', 'bajo'],
    ],
  );
  assert.equal(rotuloDelCuadrante('financia'), 'Financia');
});

test('lo que no es una de las cuatro claves se cuenta como «Sin clasificar», también el «rechazo» del catálogo', () => {
  assert.deepEqual(
    ['prioriza', 'descarta', 'rechazo', 'Prioriza', null, undefined].map((c) => claveDelCuadrante(c)),
    ['prioriza', 'descarta', 'sin_clasificar', 'sin_clasificar', 'sin_clasificar', 'sin_clasificar'],
  );
});

test('el módulo de los cuadrantes no importa nada', () => {
  /* Lo usan el servidor y el navegador. Lo que importe viaja al paquete del cliente, y si llega a la capa de datos
     arrastra el cliente de PostgreSQL: `next build` ya lo rechazó una vez, con `DIAS_DE_TODO` en `periodo.ts`. */
  const ts = readFileSync(join(RAIZ, MODULO), 'utf8');
  const imports = [...ts.matchAll(/^\s*import\s[^;]+;|^\s*export\s[^;]*\sfrom\s[^;]+;/gm)].map((m) => m[0]);
  assert.deepEqual(imports, [], 'los cuadrantes importan algo: lo que arrastren va al navegador');
});
