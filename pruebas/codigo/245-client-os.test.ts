// Client OS: la herramienta externa en prueba, sólo para la organización principal. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE PIDIÓ, Y CÓMO SE ROMPERÍA SIN QUE NADA FALLE
//
// El 2026-10-08: una pestaña que abre `https://client-os.vibepreview.app/clients` en un `iframe`, *«solo
// exclusivamente para aria»*, y *«cualquier usuario podría verlo con cualquier tipo de permiso»*.
//
// Las dos mitades se rompen en silencio, cada una para un lado:
//
//   · sin `soloDesdeLaPrincipal`, las empresas cliente verían una herramienta que es de ARIA —mutación:
//     sacar la bandera—;
//   · sin `sinAlcance`, un `usuario` de ARIA con pestañas concedidas no la vería, y nadie lo notaría
//     porque para los demás sí aparece —mutación: volver al filtro por `concedidas` solamente—.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { alcanceOfrecible, menuVisible, seccionDeArranque, SECCIONES } from '../../lib/autorizacion/secciones.ts';
import { menuPorDepartamentos } from '../../lib/autorizacion/departamentos.ts';
import { RAIZ } from '../apoyo/fuente.ts';
import { rutaDeLaCaja } from '../../lib/agentes/pantalla.ts';

const CLIENT_OS = SECCIONES.find((s) => s.clave === 'clientos');
/** Lo mínimo que tiene un `usuario`: la capacidad de los tableros, y nada concedido. */
const USUARIO = new Set(['tablero.ver']);
const RESTRINGIDO_SIN_NADA = { restringido: true as const, concedidas: new Set<string>() };
const claves = (m: ReturnType<typeof menuVisible>) => m.flatMap((g) => g.secciones.map((s) => s.clave));

test('la sección existe, sólo desde la principal, sin recorte por pestañas y sin operaciones', () => {
  assert.ok(CLIENT_OS, 'falta la sección `clientos`');
  assert.equal(CLIENT_OS.soloDesdeLaPrincipal, true, 'sin esto, las empresas cliente verían la herramienta de ARIA');
  assert.equal(CLIENT_OS.sinAlcance, true);
  assert.equal(CLIENT_OS.sinOperacionesTodavia, true, 'no llama a ninguna operación nuestra');
  // La capacidad la tienen los tres roles (`db/arranque/001_catalogo.sql`): «cualquier tipo de permiso».
  assert.equal(CLIENT_OS.capacidadRequerida, 'tablero.ver');
});

test('toda sección sin recorte por pestañas es también sólo de la principal', () => {
  /* `sinAlcance` abre la pantalla a todo el que tenga la capacidad. Fuera de la principal eso sería abrirla a
     todas las personas de todas las empresas cliente. */
  for (const s of SECCIONES.filter((x) => x.sinAlcance)) {
    assert.equal(s.soloDesdeLaPrincipal, true, `«${s.clave}» no se recorta por pestañas y se vería en las empresas cliente`);
  }
});

test('un `usuario` de ARIA la ve aunque no tenga ninguna pestaña concedida; uno de una empresa cliente, no', () => {
  assert.ok(claves(menuVisible(USUARIO, RESTRINGIDO_SIN_NADA, true)).includes('clientos'), 'el alcance la escondió en la principal');
  assert.ok(!claves(menuVisible(USUARIO, RESTRINGIDO_SIN_NADA, false)).includes('clientos'), 'se ve en una empresa cliente');
  assert.ok(!claves(menuVisible(USUARIO, { restringido: false }, false)).includes('clientos'), 'se ve en una empresa cliente');
  // Y lo demás sigue recortado: la bandera no abre las otras pantallas.
  assert.deepEqual(
    claves(menuVisible(USUARIO, RESTRINGIDO_SIN_NADA, true)),
    ['clientos'],
    'el alcance dejó pasar una pantalla que no estaba concedida',
  );
});

test('nunca es la pantalla de arranque: se ve en la barra, pero no se abre sola', () => {
  /* Quien sólo tiene Ajustes, o nada concedido, abriría en una herramienta ajena que nadie le dio. Mutación:
     volver a `g.secciones[0]` en `seccionDeArranque`. */
  assert.equal(seccionDeArranque(menuVisible(USUARIO, RESTRINGIDO_SIN_NADA, true)), null);
  const soloAjustes = menuVisible(new Set(['tablero.ver', 'credenciales.ver']), { restringido: true, concedidas: new Set(['credenciales']) }, true);
  assert.equal(seccionDeArranque(soloAjustes)?.seccion.clave, 'credenciales');
});

test('no se ofrece como casilla en Ajustes › Usuarios: tildarla o no, no cambiaría nada', () => {
  const ofrecidas = alcanceOfrecible(USUARIO).flatMap((g) => g.secciones.map((s) => s.clave));
  assert.ok(!ofrecidas.includes('clientos'));
});

test('en la barra va en Client Success, y la abre a ella', () => {
  const navegacion = menuPorDepartamentos(menuVisible(USUARIO, RESTRINGIDO_SIN_NADA, true));
  const cs = navegacion.departamentos.find((d) => d.clave === 'client-success');
  assert.ok(cs, 'Client Success no aparece con la herramienta como única entrada que abre algo');
  assert.ok(cs.entradas.some((e) => !('proximamente' in e) && e.seccion === 'clientos' && e.nombre === 'Client OS'));
});

test('la vista es el `iframe` de la dirección pedida, con el id que abre `shell.js`', () => {
  const vista = readFileSync(join(RAIZ, 'components/views/ClientOsView.jsx'), 'utf8');
  assert.match(vista, /export const DIRECCION_DE_CLIENT_OS = 'https:\/\/client-os\.vibepreview\.app\/clients';/);
  assert.match(vista, /id="v-clientos"/);
  assert.match(vista, /<iframe[\s\S]*?src=\{DIRECCION_DE_CLIENT_OS\}/);
  const centro = readFileSync(join(RAIZ, 'components/CommandCenter.jsx'), 'utf8');
  assert.match(centro, /clientos: ClientOsView,/, 'la vista no está en `VISTAS`: la entrada no abriría nada');
});

test('no lleva caja del cerebro: no hay nada nuestro que preguntarle', () => {
  // El cerebro no lee la herramienta ajena. Mutación: volver a dibujar la caja en toda entrada de la barra.
  assert.equal(rutaDeLaCaja('clientos'), null);
  const caja = readFileSync(join(RAIZ, 'components/ConsultaAlCerebro.jsx'), 'utf8');
  assert.match(caja, /if \(!abierta \|\| rutaDeLaCaja\(vista\) === null\) return null;/);
});
