// Todo lo que la ruta de sesión manda llega al contexto de la pantalla. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// YA PASÓ, Y NADA FALLÓ
//
// `GET /api/auth/sesion` mandaba `puedeBorrarPersonas` y `components/ajustes/Usuarios.jsx` lo leía con
// `useSesion()`, pero `app/guardia.tsx` —el paso del medio— no lo copiaba al contexto. El botón
// «Eliminar» no aparecía para nadie, tampoco para el superadministrador, y la prueba que lo vigilaba
// (`144`) miraba las dos puntas y no el medio, así que estaba verde. Lo encontró la planificación de
// la nueva estructura (docs/OTROS/estado actual/09-DEUDA-ABIERTA.md, nota del 2026-10-01).
//
// Esta prueba cierra el paso del medio en las dos direcciones que importan: toda clave que la ruta
// manda a una sesión activa está declarada en `DatosDeSesion` y la guarda la copia, salvo las que
// quedan afuera con su motivo. La mutación que la pone en rojo: sacar la copia de una clave en la
// guarda, o la clave de la interfaz.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/** Lo que la ruta manda y la pantalla NO necesita en el contexto, con el porqué. */
const FUERA: Readonly<Record<string, string>> = {
  autenticado: 'la guarda lo usa para decidir si entra, no es un dato de la pantalla',
  estado: 'ídem: sólo se entra con `activa`',
  permisos:
    'la pantalla decide por los permisos YA resueltos (`puede…`, `secciones`, `menu`); ' +
    '`Fundaciones.jsx` los pide por su cuenta a la misma ruta',
};

/**
 * Las claves de PRIMER nivel del objeto literal que abre en `desde` (la posición de su `{`).
 *
 * Lee cada propiedad desde su comienzo —después de la `{` o de una `,` del primer nivel—, así que ve
 * también las abreviadas (`menu,`), que es como la ruta manda el menú. Leer sólo `clave:` las perdía:
 * una clave nueva escrita así habría pasado sin vigilar. Sirve también para una interfaz, cuyas
 * propiedades terminan en `;`.
 */
function clavesDelObjeto(texto: string, desde: number): string[] {
  const claves: string[] = [];
  let nivel = 0;
  let alComienzo = false;
  for (let i = desde; i < texto.length; i += 1) {
    const c = texto[i]!;
    if (c === '{' || c === '(' || c === '[') {
      nivel += 1;
      alComienzo = nivel === 1;
    } else if (c === '}' || c === ')' || c === ']') {
      nivel -= 1;
      if (nivel === 0) break;
    } else if (nivel === 1 && (c === ',' || c === ';')) {
      alComienzo = true;
    } else if (nivel === 1 && alComienzo && /[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_]\w*/.exec(texto.slice(i))!;
      claves.push(m[0]);
      alComienzo = false;
      i += m[0].length - 1;
    }
  }
  return [...new Set(claves)];
}

function mandaLaRuta(): string[] {
  const ruta = sinComentarios(leer('app/api/auth/sesion/route.ts'));
  const i = ruta.indexOf('autenticado: true');
  assert.notEqual(i, -1, 'no se encontró la respuesta de una sesión activa en la ruta');
  const abre = ruta.lastIndexOf('{', i);
  return clavesDelObjeto(ruta, abre);
}

function copiaLaGuarda(): string[] {
  const guardia = sinComentarios(leer('app/guardia.tsx'));
  const i = guardia.indexOf('setDatos({');
  assert.notEqual(i, -1, 'no se encontró el `setDatos({` de la guarda');
  return clavesDelObjeto(guardia, i + 'setDatos('.length);
}

function declaraElContexto(): string[] {
  const ctx = sinComentarios(leer('app/sesion-contexto.tsx'));
  const i = ctx.indexOf('export interface DatosDeSesion {');
  assert.notEqual(i, -1, 'no se encontró `DatosDeSesion`');
  return clavesDelObjeto(ctx, ctx.indexOf('{', i));
}

test('la lectura de las tres listas funciona: sin esto, la prueba no mira nada', () => {
  // La guarda de la de abajo: un extractor roto devolvería listas vacías y la comparación pasaría.
  assert.ok(mandaLaRuta().length >= 10, `la ruta: ${mandaLaRuta().join(', ')}`);
  assert.ok(copiaLaGuarda().length >= 8, `la guarda: ${copiaLaGuarda().join(', ')}`);
  assert.ok(declaraElContexto().length >= 8, `el contexto: ${declaraElContexto().join(', ')}`);
});

test('toda clave que la ruta manda a una sesión activa llega al contexto, salvo las de FUERA', () => {
  const llega = new Set(copiaLaGuarda());
  const declarada = new Set(declaraElContexto());
  const faltan = mandaLaRuta().filter((c) => !(c in FUERA) && !llega.has(c));
  assert.deepEqual(faltan, [], 'la ruta las manda y la guarda no las copia: la pantalla las lee como `undefined`');
  const sinTipo = mandaLaRuta().filter((c) => !(c in FUERA) && !declarada.has(c));
  assert.deepEqual(sinTipo, [], 'la guarda las copia pero `DatosDeSesion` no las declara');
});

test('la lista de FUERA no tiene entradas muertas', () => {
  const manda = new Set(mandaLaRuta());
  for (const c of Object.keys(FUERA)) {
    assert.ok(manda.has(c), `\`${c}\` está en FUERA y la ruta ya no lo manda: sacalo de la lista`);
  }
});

test('«Eliminar» llega: `puedeBorrarPersonas` viaja de la ruta a la pantalla', () => {
  assert.ok(mandaLaRuta().includes('puedeBorrarPersonas'));
  assert.ok(copiaLaGuarda().includes('puedeBorrarPersonas'), 'la guarda volvió a perder `puedeBorrarPersonas`');
  assert.match(sinComentarios(leer('app/guardia.tsx')), /puedeBorrarPersonas:\s*r\.datos\.puedeBorrarPersonas\s*\?\?\s*false/,
    'sin saberlo, «Eliminar» no se ofrece: el valor por omisión tiene que ser `false`');
});
