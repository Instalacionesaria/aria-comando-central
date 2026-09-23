// LA PANTALLA DE LOS ANALIZADORES: lo que solo se ve leyendo el código. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// Cuatro cosas que ninguna prueba Base puede ver porque no fallan: se ven mal, o no se ven.
//
//   · **Dónde está en el menú.** Debajo de Closer, con su propia capacidad: fue el pedido, y el orden
//     del arreglo `SECCIONES` es el orden del menú.
//   · **Que un error no se vea como una lista vacía.** Un `catch` que devuelve `ok([])` convierte una
//     caída de la base en una pestaña sin llamadas, que es un estado normal y nadie lo reporta.
//   · **Que la pantalla espere lo que las rutas tardan.** Las que analizan declaran 300 s; con la
//     espera por omisión del cliente, la pantalla diría «no respondió» con el análisis todavía en
//     curso —y pagado—.
//   · **Que las fases se rotulen bien en los dos historiales.** El v8 dice `apertura_rapport` en las
//     cinco; el v8.1 trae cada una con su nombre, y no necesariamente en orden ni de a cinco.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente } from '../apoyo/fuente.ts';
import { SECCIONES } from '../../lib/autorizacion/secciones.ts';
import { FASES, rotulosDeLasFases } from '../../lib/analizadores/fases.ts';

const fuente = (ruta: string) => {
  const a = archivosFuente(['app', 'components']).find((x) => x.ruta === ruta);
  assert.ok(a, `no se encontró ${ruta}`);
  return a.limpio;
};

test('Analizadores va JUSTO debajo de Closer, en Operación, con su propia capacidad', () => {
  const claves = SECCIONES.map((s) => s.clave);
  assert.equal(claves.indexOf('analizadores'), claves.indexOf('closer') + 1);
  const s = SECCIONES.find((x) => x.clave === 'analizadores');
  assert.equal(s?.capacidadRequerida, 'analizadores.ver');
  assert.equal(s?.menu?.grupo, 'Operación');
  /* Y con `closer.ver` no: cualquier closer leería las transcripciones de todo el equipo. */
  assert.notEqual(s?.capacidadRequerida, 'closer.ver');
});

test('ninguna ruta de los Analizadores convierte un error en una respuesta vacía', () => {
  const rutas = archivosFuente(['app/api/analizadores']);
  assert.ok(rutas.length >= 7, `se esperaban las siete rutas, hay ${rutas.length}`);
  for (const a of rutas) {
    for (const m of a.limpio.matchAll(/catch\s*(?:\([^)]*\))?\s*\{([\s\S]*?)\n\s*\}/g)) {
      assert.ok(!/\bok\s*\(/.test(m[1] ?? ''), `${a.ruta} devuelve ok() dentro de un catch`);
    }
  }
});

test('la pantalla espera al menos lo que declaran las rutas que analizan', () => {
  /* Cada pedido a una ruta que analiza lleva `espera: ESPERA_LARGA`, y esa espera cubre los 300 s.
     La mutación que la quita no se ve en ninguna prueba del servidor: se ve como un «no respondió»
     en pantalla con el análisis siguiendo del otro lado. */
  for (const ruta of ['components/analizadores/PanelDeAnalizadores.jsx', 'components/analizadores/DetalleHt.jsx']) {
    const t = fuente(ruta);
    const espera = /const ESPERA_LARGA = ([\d_]+);/.exec(t);
    assert.ok(espera, `${ruta} no declara ESPERA_LARGA`);
    assert.ok(Number(espera[1]!.replace(/_/g, '')) >= 300_000, `${ruta} espera menos que maxDuration`);
    for (const m of t.matchAll(/pedir\(\s*[`'"]([^`'"]*(?:analizar|ficha|manual|sincronizar)[^`'"]*)[`'"]([^)]*)\)/g)) {
      assert.match(m[2] ?? '', /espera:\s*ESPERA_LARGA/, `${ruta}: el pedido a ${m[1]} no pasa la espera larga`);
    }
  }
  for (const ruta of [
    'app/api/analizadores/llamadas/[id]/analizar/route.ts',
    'app/api/analizadores/llamadas/[id]/ficha/route.ts',
    'app/api/analizadores/manual/route.ts',
    'app/api/analizadores/sincronizar/route.ts',
  ]) {
    assert.match(fuente(ruta), /export const maxDuration = 300;/, `${ruta} no declara maxDuration = 300`);
  }
});

test('las fases: por su campo cuando vienen distintas, aunque lleguen desordenadas', () => {
  /* Rotular SIEMPRE por posición era falso para el v8.1: el esquema no obliga al orden, y una fase
     que llega tercera se llamaba «Presentación» fuera cual fuera. */
  const r = rotulosDeLasFases([{ phase: 'cierre' }, { phase: 'apertura_rapport' }, { phase: 'descubrimiento' }]);
  assert.deepEqual(r, { rotulos: ['Cierre', 'Apertura y conexión', 'Descubrimiento'], nota: null });
});

test('las fases: cinco iguales son el defecto v8, y se rotulan por posición diciéndolo', () => {
  const r = rotulosDeLasFases(Array.from({ length: 5 }, () => ({ phase: 'apertura_rapport' })));
  assert.deepEqual(r.rotulos, [...FASES]);
  assert.match(String(r.nota), /v8/);
});

test('las fases: repetidas y no cinco no tienen nombre honesto, y lo dicen', () => {
  /* Ninguna HT copiada está así, pero nada lo impide: rotularlas por posición inventaría qué fase es
     cada una. */
  const r = rotulosDeLasFases([{ phase: 'apertura_rapport' }, { phase: 'apertura_rapport' }, { phase: 'apertura_rapport' }]);
  assert.deepEqual(r.rotulos, ['Fase 1', 'Fase 2', 'Fase 3']);
  assert.ok(r.nota);
});

test('las fases: un análisis sin ninguna lo dice, en vez de dejar el título solo', () => {
  /* Así están 3 de las 37 HT copiadas de Brain (medido el 2026-09-23). Un arreglo vacío no tiene
     repetidos, así que caía en la rama de «distintas» con `nota: null`, y la pantalla mostraba «Las
     fases» sin nada debajo: se leía como un error de carga. */
  const r = rotulosDeLasFases([]);
  assert.deepEqual(r.rotulos, []);
  assert.ok(r.nota, 'un análisis sin fases no dice nada');
});

test('el detalle rotula las fases con `rotulosDeLasFases`, y no lee el campo por su cuenta', () => {
  const t = fuente('components/analizadores/DetalleHt.jsx');
  assert.match(t, /import \{ rotulosDeLasFases \} from '@\/lib\/analizadores\/fases'/);
  assert.ok(!/\.phase\b/.test(t), 'el detalle lee el campo `phase` sin pasar por la regla del historial v8');
});

test('ninguna pantalla de los Analizadores dibuja una transcripción', () => {
  /* La API no la devuelve; esto es el segundo cinturón. Una pantalla que la leyera de algún campo
     nuevo mostraría el texto entero de una reunión interna. */
  for (const a of archivosFuente(['components/analizadores'])) {
    assert.ok(!/transcripcion\s*\.\s*(texto|segmentos|fullText)|\.texto\b/.test(a.limpio), `${a.ruta} dibuja una transcripción`);
  }
});
