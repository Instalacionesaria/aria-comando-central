// EL PUNTAJE Y EL PERFIL SE ELIGEN EN LA CONEXIÓN DE CADA CLIENTE: LA PANTALLA Y LOS ESCRITORES, SIN BASE. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C6 · D4)
//
// Lo que la 296 no ve porque no corre la pantalla ni lee el código. Cada afirmación dice la mutación que la pone roja:
//
//   · `ConexionDelCliente.jsx` monta «ICP y Perfil» también para el principal, que no tiene Conexión propia pero
//     sí su catálogo — mutación: montarlo sólo en la rama de los demás;
//   · `CamposDelCliente.jsx` no tiene lista propia de tipos ni de grupos —los grupos los dice el servidor—, muestra el
//     campo del cuadrante y no elige el puntaje (la `105`) — mutaciones: una lista de tipos, volver a mandar «puntaje»;
//   · quien sólo ve no recibe botones;
//   · los escritores del catálogo no nombran `visto_el`: si lo tocaran, el catálogo parecería recién leído y no se
//     releería en un día — mutación: tocarlo al elegir;
//   · la ruta no abre una transacción de identidad (no cruza los dos dominios) y corre con el foco del cliente;
//   · los textos nuevos hablan de tú.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { VOSEO } from '../apoyo/voseo.ts';

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8').replace(/\r\n/g, '\n');

/** El cuerpo de una función exportada de `camposDelCrm.ts`, hasta la siguiente declaración de primer nivel. */
function cuerpoDe(fuente: string, nombre: string): string {
  const desde = fuente.indexOf(`export async function ${nombre}(`);
  assert.ok(desde >= 0, `no encontré ${nombre}`);
  const hasta = fuente.indexOf('\n}\n', desde);
  return fuente.slice(desde, hasta);
}

test('la Conexión monta «ICP y Perfil» también para el principal, y después del aviso en los demás', () => {
  const fuente = sinComentarios(leer('components/ajustes/ConexionDelCliente.jsx'));
  const principal = /if \(cliente\.esPorOmision\) \{\s*return \([\s\S]*?\n {2}\}\n/.exec(fuente)?.[0] ?? '';
  assert.ok(principal, 'no encontré la rama del principal');
  assert.match(principal, /<CamposDelCliente cliente=\{cliente\} \/>/, 'el principal se quedó sin ICP ni Perfil');
  const resto = fuente.slice(fuente.indexOf('<AvisoDelCrm'));
  assert.match(resto, /<CamposDelCliente cliente=\{cliente\} \/>/, 'los demás clientes se quedaron sin ICP ni Perfil');
});

test('la pantalla muestra el cuadrante sin elegirlo, y no tiene lista propia de tipos ni de grupos', () => {
  const fuente = sinComentarios(leer('components/ajustes/CamposDelCliente.jsx'));
  assert.doesNotMatch(fuente, /NUMERICAL|LARGE_TEXT|SINGLE_OPTIONS|'TEXT'/, 'la pantalla decide qué tipos sirven: es una segunda lista');
  assert.doesNotMatch(fuente, /'(detalles|origen|calificacion|interacciones)'/, 'la pantalla tiene su propia lista de grupos');
  assert.match(fuente, /datos\.grupos\.map\(/);
  // Desde la `105` el puntaje no se elige: ni el selector, ni un cuerpo con «puntaje», ni sus opciones.
  assert.doesNotMatch(fuente, /datos\.opciones|puntaje:|setPuntaje/, 'la pantalla volvió a elegir el puntaje');
  assert.match(fuente, /datos\.cuadrante/, 'la pantalla no muestra el campo del cuadrante');
  assert.match(fuente, /const editable = datos\.puedeEditar === true;/);
  assert.match(fuente, /\{editable \? \(\s*<div className="aj-fila">\s*<button/, 'quien sólo ve recibe un botón que va a dar 403');
});

test('los escritores del catálogo no tocan `visto_el`', () => {
  const fuente = leer('lib/negocio/camposDelCrm.ts');
  for (const nombre of ['elegirLosGrupos', 'recalcularLosCuadrantes']) {
    assert.doesNotMatch(sinComentarios(cuerpoDe(fuente, nombre)), /visto_el/, `${nombre} toca visto_el: el catálogo parecería recién leído`);
  }
  // Y el refresco no nombra `es_el_puntaje`: lo elegido es nuestro.
  const refresco = cuerpoDe(fuente, 'refrescarCatalogoDeCampos');
  assert.doesNotMatch(sinComentarios(refresco), /es_el_puntaje|grupo_elegido_el/);
});

test('la ruta corre con el foco del cliente y nunca por identidad', () => {
  const fuente = sinComentarios(leer('app/api/admin/cuentas/[id]/campos/route.ts'));
  assert.doesNotMatch(fuente, /conIdentidad/, 'la ruta del catálogo cruza los dos dominios');
  assert.match(fuente, /conOrganizacion\(ambitoDeUnCliente\(contexto\.orgEfectiva, cliente\.id\)/);
  assert.match(fuente, /export async function GET[\s\S]*?exigir\(peticion, \['credenciales\.ver'\], PANTALLA\)/);
  assert.match(fuente, /export async function PUT[\s\S]*?exigir\(peticion, \['credenciales\.editar'\], PANTALLA\)/);
  assert.match(fuente, /export const PANTALLA = 'credenciales';/);
});

test('los textos nuevos hablan de tú', () => {
  for (const ruta of [
    'components/ajustes/CamposDelCliente.jsx',
    'app/api/admin/cuentas/[id]/campos/route.ts',
    'app/api/admin/cuentas/[id]/vinculo/route.ts',
  ]) {
    const textos = [...leer(ruta).matchAll(/'([^'\n]*(?:elige|vuelve|recarga|revísalos)[^'\n]*)'/gi)].map((m) => m[1]!);
    for (const t of textos) assert.equal(VOSEO.exec(t), null, `vosea: ${t}`);
  }
  assert.doesNotMatch(leer('components/ajustes/CamposDelCliente.jsx'), /(?<!\p{L})(elegí|volvé|recargá|revisalos)(?!\p{L})/u);
});
