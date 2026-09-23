// LA PANTALLA DE LOS ANALIZADORES: lo que solo se ve leyendo el código. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// Cinco cosas que ninguna prueba Base puede ver porque no fallan: se ven mal, o no se ven.
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
//   · **El detalle OB y los rótulos de las vetadas.** «No es HT» / «No es OB», cada valor del esquema
//     OB con su nombre, «No consta» en todos los vacíos, los momentos en orden y el correo de la
//     llamada, nunca el del modelo.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente } from '../apoyo/fuente.ts';
import { SECCIONES } from '../../lib/autorizacion/secciones.ts';
import { FASES, rotulosDeLasFases } from '../../lib/analizadores/fases.ts';
import { ROTULOS_OB, consta, fraseDelVeto, momentosEnOrden, rotuloDelEstado } from '../../lib/analizadores/rotulos.ts';
import { OB_DEF } from '../../lib/analizadores/nucleo/ob.ts';

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

// ═══════════════════════════════════════════════════════════════════════════════
// OB-3 · El detalle OB y los rótulos
// ═══════════════════════════════════════════════════════════════════════════════

test('una llamada vetada dice qué NO es, según su pestaña: no desaparece ni queda en «no corresponde»', () => {
  /* Decidido el 2026-09-23: una reunión que no es lo que su analizador espera queda en Descartadas
     diciendo «No es HT» o «No es OB». Con «No corresponde» para todas no se leía de dónde se cayó. */
  assert.equal(rotuloDelEstado('NOT_MATCH', 'HT'), 'No es HT');
  assert.equal(rotuloDelEstado('NOT_MATCH', 'OB'), 'No es OB');
  assert.equal(rotuloDelEstado('NOT_MATCH', 'OTRO'), 'No es HT ni OB');
  assert.equal(rotuloDelEstado('DONE', 'OB'), 'Analizada');
  // Dentro de una frase, las siglas siguen en mayúsculas: `.toLowerCase()` las bajaba a «no es ht ni ob».
  assert.deepEqual(['HT', 'OB', 'OTRO'].map(fraseDelVeto), ['no es HT', 'no es OB', 'no es HT ni OB']);
  const panel = fuente('components/analizadores/PanelDeAnalizadores.jsx');
  assert.ok(!/No corresponde/.test(panel), 'el panel todavía rotula «No corresponde»');
  assert.ok(!/rotuloDelEstado\([^)]*\)\.toLowerCase\(\)/.test(panel), 'el panel baja un rótulo a minúsculas: las siglas quedan «ht» y «ob»');
  assert.match(panel, /rotuloDelEstado\(l\.estado, l\.tipo\)/);
});

test('cada valor de enumeración del esquema OB tiene su rótulo en castellano', () => {
  /* Un valor sin rótulo se dibuja como la clave del modelo («SUBCUENTA_ARIA»). Se recorre el esquema
     de verdad, así que un valor nuevo en la rúbrica sin su rótulo pone esta prueba en rojo. */
  const faltan: string[] = [];
  let vistos = 0;
  const recorrer = (nodo: unknown, nombre: string): void => {
    if (!nodo || typeof nodo !== 'object') return;
    const n = nodo as { enum?: unknown[]; properties?: Record<string, unknown>; items?: unknown };
    if (Array.isArray(n.enum)) {
      for (const v of n.enum) {
        vistos++;
        if (!ROTULOS_OB[nombre]?.[String(v)]) faltan.push(`${nombre}.${String(v)}`);
      }
    }
    for (const [k, v] of Object.entries(n.properties ?? {})) recorrer(v, k);
    if (n.items) recorrer(n.items, nombre);
  };
  recorrer(OB_DEF.jsonSchema, '');
  assert.ok(vistos >= 30, `se esperaban los 30 valores del esquema, se vieron ${vistos}`);
  assert.deepEqual(faltan, []);
});

test('«consta» trata igual los tres vacíos de `normalizeOb`: texto vacío, null y lista vacía', () => {
  for (const vacio of ['', '   ', null, undefined, []]) assert.equal(consta(vacio), false, JSON.stringify(vacio));
  for (const lleno of ['x', ['x'], 0, false]) assert.equal(consta(lleno), true, JSON.stringify(lleno));
});

test('los momentos clave van en el orden de la llamada, sin tocar lo guardado', () => {
  /* En 4 de las 7 OB copiadas de Brain no vienen ordenados. */
  const guardados = [{ startSec: 300 }, { startSec: 12 }, { startSec: 95 }];
  assert.deepEqual(momentosEnOrden(guardados).map((m) => m.startSec), [12, 95, 300]);
  assert.deepEqual(guardados.map((m) => m.startSec), [300, 12, 95], 'ordenó el arreglo guardado');
  assert.deepEqual(momentosEnOrden(null), []);
});

test('el detalle OB: sin vista Prospecto ni ficha, y el correo sale de la llamada', () => {
  /* La prueba 39 del plan. El esquema OB trae `clientEmail`, que el modelo casi nunca llena y a veces
     podría inventar: el correo que se muestra es el dato duro de la llamada, o «email pendiente». */
  const t = fuente('components/analizadores/DetalleOb.jsx');
  assert.ok(!/VistaProspecto|\/ficha|DetalleHt/.test(t), 'el detalle OB toca la ficha o la vista Prospecto');
  assert.ok(!/\.clientEmail\b/.test(t), 'el detalle OB lee el correo del modelo');
  assert.ok(!/participants[^\n]*\.email|p\.email/.test(t), 'el detalle OB muestra el correo que escribió el modelo');
  assert.match(t, /llamada\.prospectoEmail/);
  assert.match(t, /email pendiente/);
  assert.match(t, /momentosEnOrden\(/);
});

test('el panel abre el detalle OB para una OB, y el de HT para una HT', () => {
  const t = fuente('components/analizadores/PanelDeAnalizadores.jsx');
  assert.match(t, /detalle\.tipo === 'OB' \? DetalleOb : DetalleHt/);
  /* `detalle` pasó de guardar el id a guardar { id, tipo }: un `setDetalle(id)` suelto abriría el
     detalle con un tipo indefinido, que cae en el de HT. Los dos lugares que lo llenan pasan el tipo, y
     el botón Ver se ofrece para una OB. */
  assert.ok(!/setDetalle\((?!null\b|\{)/.test(t), 'queda un setDetalle con el id solo');
  assert.match(t, /setDetalle\(\{ id: l\.id, tipo: l\.tipo \}\)/);
  assert.match(t, /setDetalle\(\{ id, tipo \}\)/);
  assert.match(t, /l\.estado === 'DONE' && l\.tipo !== 'OTRO'/);
  assert.ok(!/fase OB/.test(t), 'el panel todavía promete «la fase OB»');
});

