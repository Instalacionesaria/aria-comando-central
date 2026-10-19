// EL SELECTOR DE CLIENTE Y EL RÓTULO DEL FOCO. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Paso 7)
//
// `lib/foco.ts` decide cuándo se dibuja el selector de cliente y qué dice la cabecera con un cliente enfocado:
//
//   · el selector es un menú con dos clientes o más; con uno, el cliente final ve su nombre y la empresa nada —
//     mutación: dibujarlo siempre (una empresa de un solo cliente vería un control que no cambia nada);
//   · con un cliente enfocado, la cabecera lo nombra en las pantallas que lo filtran y dice «Toda la empresa» en las
//     demás; sin foco no dice nada; al cliente final nunca le dice «Toda la empresa» — mutación: nombrar el cliente
//     en toda pantalla (un número de la empresa parecería del cliente);
//   · la barra dibuja el selector debajo del de la empresa, y la cabecera el rótulo, sin decidir nada por su cuenta.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { formaDelSelector, nombreDelFoco, rotuloDelFoco, type CuentasEnLaSesion } from '../../lib/foco.ts';

const A = { id: 'a', nombre: 'Clínica Norte', estado: 'activa' as const };
const B = { id: 'b', nombre: 'Clínica Sur', estado: 'pausada' as const };
const empresa = (visibles: CuentasEnLaSesion['visibles'], activa: string | null = null): CuentasEnLaSesion => ({
  limitado: false,
  activa,
  visibles,
});
const PANTALLAS = ['contacts', 'sales'];

test('el selector: menú con dos o más; con uno, el cliente final lo ve como texto y la empresa nada', () => {
  assert.equal(formaDelSelector(empresa([A, B])), 'menu');
  assert.equal(formaDelSelector(empresa([A])), 'oculto');
  assert.equal(formaDelSelector({ limitado: true, activa: null, visibles: [A] }), 'texto');
  assert.equal(formaDelSelector({ limitado: true, activa: null, visibles: [A, B] }), 'menu');
  assert.equal(formaDelSelector(empresa([])), 'oculto');
});

test('lo que dice el selector cerrado: el enfocado, o todos', () => {
  assert.equal(nombreDelFoco(empresa([A, B])), 'Todos los clientes');
  assert.equal(nombreDelFoco(empresa([A, B], 'b')), 'Clínica Sur');
  assert.equal(nombreDelFoco({ limitado: true, activa: null, visibles: [A, B] }), 'Todos tus clientes');
  assert.equal(nombreDelFoco({ limitado: true, activa: null, visibles: [A] }), 'Clínica Norte');
});

test('el rótulo: el cliente en sus pantallas, «Toda la empresa» en las demás, nada sin foco', () => {
  assert.equal(rotuloDelFoco(empresa([A, B]), 'contacts', PANTALLAS), null);
  assert.deepEqual(rotuloDelFoco(empresa([A, B], 'a'), 'contacts', PANTALLAS), { texto: 'Clínica Norte', deUnCliente: true });
  assert.deepEqual(rotuloDelFoco(empresa([A, B], 'a'), 'closer', PANTALLAS), { texto: 'Toda la empresa', deUnCliente: false });
  // Un foco que no está entre los visibles no se nombra.
  assert.equal(rotuloDelFoco(empresa([A, B], 'otra'), 'contacts', PANTALLAS), null);
  // Al cliente final, nunca «Toda la empresa»: sólo llega a sus pantallas.
  assert.equal(rotuloDelFoco({ limitado: true, activa: 'a', visibles: [A, B] }, 'closer', PANTALLAS), null);
});

test('la barra dibuja el selector debajo del de la empresa, y la cabecera el rótulo con la vista', () => {
  const nav = readFileSync(join(RAIZ, 'components/Nav.jsx'), 'utf8');
  const empresaEn = nav.indexOf('<SelectorDeEmpresa sesion={sesion} />');
  const clienteEn = nav.indexOf('<SelectorDeCliente sesion={sesion} />');
  assert.ok(empresaEn > 0 && clienteEn > empresaEn, 'el selector de cliente no está debajo del de la empresa');
  const selector = readFileSync(join(RAIZ, 'components/SelectorDeCliente.jsx'), 'utf8');
  assert.match(selector, /formaDelSelector\(cuentas\)/, 'el selector decide por su cuenta cuándo dibujarse');
  assert.match(selector, /pedir\('\/api\/auth\/cliente'/);
  const cabecera = readFileSync(join(RAIZ, 'components/CabeceraDeDepartamento.jsx'), 'utf8');
  assert.match(cabecera, /<RotuloDelFoco vista=\{vista\} \/>/);
  const rotulo = readFileSync(join(RAIZ, 'components/RotuloDelFoco.jsx'), 'utf8');
  assert.match(rotulo, /rotuloDelFoco\(sesion\.cuentas, vista, sesion\.pantallasDelCliente \?\? \[\]\)/);
});
