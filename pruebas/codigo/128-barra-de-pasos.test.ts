// La barra del método: paso anterior, progreso y «Continuar al paso N». Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// DE DÓNDE SALE
//
// Reportado por Kevin: se terminan los cinco pasos del Research y no hay ningún «Continuar al paso
// 3». En ARIA-brain esa barra (`StepNav`) acompaña a todas las herramientas del método y este port
// se la había dejado.
//
// Lo que se persigue acá:
//
//   · Que la barra NAVEGUE y no genere. Cada generación gasta la llave de IA de la organización:
//     una cadena que se dispara sola gastaría nueve porque alguien terminó la primera.
//   · Que el orden sea el del MÉTODO. No es el de los identificadores ni el de las pestañas, y
//     equivocarlo manda al alumno a construir sobre algo que todavía no existe.
//   · Que no ofrezca un botón que no puede cumplir. El VSL y la Landing viven en `tools`: desde
//     «ICP & Oferta» no se los puede abrir con un cambio de subpestaña, así que la barra lo DICE en
//     vez de llevar a la pantalla equivocada.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ } from '../apoyo/fuente.ts';
import { FUNDACIONES, TOOLS, TODAS, tieneAgente } from '../../lib/fundaciones/herramientas.ts';
import {
  TRAVESIA,
  pantallaDe,
  pasoAnterior,
  pasoSiguiente,
  posicionEnLaTravesia,
} from '../../lib/fundaciones/travesia.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const codigo = (r: string): string =>
  leer(r).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('la travesía es el orden del MÉTODO, y son los nueve pasos', () => {
  assert.deepEqual(
    TRAVESIA,
    [0, 1, 3, 2, 4, 10, 26, 5, 6],
    'Perfil → Research → ICP → Categoría → Oferta → Pricing → Mapa → VSL → Landing',
  );
});

test('ninguna herramienta del método queda fuera de la travesía, ni al revés', () => {
  /* La comprobación que impide que una mudanza rompa la barra en silencio. Toda herramienta que
     produce un entregable del método tiene que ser un paso, y todo paso tiene que existir. */
  const conEntregable = [...FUNDACIONES, ...TOOLS].filter(tieneAgente).map((h) => h.id).sort();
  assert.deepEqual([...TRAVESIA].sort(), conEntregable);
  for (const id of TRAVESIA) {
    assert.ok(TODAS.some((h) => h.id === id), `la travesía nombra ${id}, que no existe`);
  }
});

test('después del Research viene el ICP, y es el paso 3', () => {
  /* El caso del reporte, literal: los cinco pasos del Research terminados y el botón que faltaba. */
  assert.equal(posicionEnLaTravesia(1), 2, 'el Research es el paso 2 del método');

  const siguiente = pasoSiguiente(1);
  assert.ok(siguiente);
  assert.equal(siguiente.herramienta.id, 3, 'después del Research viene el ICP');
  assert.equal(siguiente.posicion, 3, 'el botón dice «Continuar al paso 3»');
  // Y está en la MISMA pantalla, así que el botón se puede dibujar de verdad.
  assert.equal(siguiente.pantalla, 'icp');

  const anterior = pasoAnterior(1);
  assert.equal(anterior?.herramienta.id, 0, 'antes del Research está Tu ficha');
});

test('los extremos no ofrecen lo que no hay', () => {
  assert.equal(pasoAnterior(0), null, 'el primer paso ofrece un «anterior»');
  assert.equal(pasoSiguiente(6), null, 'el último paso ofrece un «siguiente»');
  // Prospección y el Espía no son pasos del método: la barra no se dibuja para ellos.
  assert.equal(posicionEnLaTravesia(20), 0);
  assert.equal(pasoSiguiente(20), null);
});

test('la pantalla de cada paso se DERIVA del catálogo', () => {
  for (const h of FUNDACIONES) assert.equal(pantallaDe(h.id), 'icp');
  for (const h of TOOLS) assert.equal(pantallaDe(h.id), 'tools');
  // Y el cruce que la barra no puede resolver con un cambio de subpestaña: Mapa(26) → VSL(5).
  assert.equal(pasoSiguiente(26)?.pantalla, 'tools');
});

test('la barra NAVEGA y no genera', () => {
  /* La afirmación central. Lo que faltaba era la guía, no el gasto. */
  const barra = codigo('components/fundaciones/BarraDePasos.jsx');
  assert.ok(!/pedir\(/.test(barra), 'la barra hace una petición: está generando');
  assert.ok(!/rutaGenerar|correrTodo|generar\(/.test(barra), 'la barra dispara una generación');
  assert.match(barra, /onIr\(siguiente\.herramienta\.id\)/);
});

test('no se dibuja un botón que no puede cumplir', () => {
  /* El `07` § 4. Cuando el paso siguiente vive en la otra pantalla, la barra dice dónde está en vez
     de ofrecer un botón que abriría la herramienta equivocada. */
  const barra = codigo('components/fundaciones/BarraDePasos.jsx');
  assert.match(barra, /const puedeIr = \(vecino\) => !!vecino && vecino\.pantalla === pantalla;/);
  assert.match(barra, /puedeIr\(siguiente\) \?/);
});

test('la barra está en los dos paneles del método', () => {
  /* En el del Research —que es donde se reportó— y en el genérico, que sirve a las otras ocho. Una
     barra que existiera en una sola dejaría la travesía cortada en la primera herramienta que no la
     tenga, sin que nada falle. */
  for (const panel of [
    'components/fundaciones/PanelResearch.jsx',
    'components/fundaciones/PanelHerramienta.jsx',
  ]) {
    const fuente = codigo(panel);
    assert.match(fuente, /<BarraDePasos/, `${panel} no dibuja la barra del método`);
    assert.match(fuente, /pantalla=\{pantalla\}/, `${panel} no le pasa su pantalla`);
  }

  // Y el armazón le pasa a cada panel su pantalla, que es lo que decide si el botón se puede dibujar.
  const armazon = codigo('components/fundaciones/Fundaciones.jsx');
  assert.match(armazon, /pantalla: 'icp'/);
  assert.match(codigo('components/views/ToolsView.jsx'), /pantalla: 'tools'/);
});

// ─── El puente del Research al ICP ─────────────────────────────────────────

test('el nombre del segmento se saca del paso 5, y el preámbulo del modelo no cuenta', async () => {
  /* Puerto verbatim de `extractSegmentName` del hub. Se copia el ALGORITMO porque allá lleva meses
     corriendo contra las salidas reales del modelo: su forma es el resultado de esa medición, y
     reescribirlo «mejor» significa fallar en textos que allá funcionan. */
  const { nombreDelSegmento } = await import('../../lib/fundaciones/segmento.ts');

  // Primera pasada: la línea que nombra el segmento explícitamente.
  assert.equal(
    nombreDelSegmento(
      'Perfecto, ahora que analicé los cuatro.\n\n**SEGMENTO GANADOR: Agencias de marketing de 5 a 20 personas**\n\nCumple los cuatro criterios.',
    ),
    'Agencias de marketing de 5 a 20 personas',
  );

  /* Segunda pasada: sin esa línea, el primer título que no sea una frase de transición. Sin esta
     lista, el nicho del ICP terminaría siendo «Ahora te presento el análisis» — y eso se propaga a
     todo lo que hereda del avatar. */
  assert.equal(
    nombreDelSegmento('Ahora te presento el análisis.\n\nClínicas dentales con dos o más sedes\n\nSon las mejores.'),
    'Clínicas dentales con dos o más sedes',
  );

  // Y sin nada legible devuelve vacío: es preferible no llenar el campo a llenarlo mal.
  assert.equal(nombreDelSegmento(''), '');
  assert.equal(nombreDelSegmento('Analizando los segmentos...'), '');
});

test('el puente llena el nicho del ICP, NO pisa lo escrito, y manda los ocho campos', () => {
  const panel = codigo('components/fundaciones/PanelResearch.jsx');

  // Solo con los cinco pasos: el nombre sale del paso 5, que es el que elige.
  assert.match(panel, /if \(!puedeEditar \|\| hechos < PASOS_RESEARCH\) return;/);

  /* NUNCA pisa lo que alguien escribió. Quien afinó su nicho a mano lo hizo por algo, y perderlo al
     cambiar de pestaña sería peor que no llenar nada. */
  assert.match(
    panel,
    /if \(actuales\[CAMPO_NICHO_DEL_ICP\] && actuales\[CAMPO_NICHO_DEL_ICP\]\.trim\(\) !== ''\) return;/,
  );

  /* Se manda el juego COMPLETO de valores del ICP. El servidor rellena con `(no especificado)` todo
     campo que no venga (`aValoresDeAlmacen`), así que mandar solo el nicho borraría los otros siete
     — en silencio, y recién se notaría al generar el avatar. */
  assert.match(panel, /valores: \{ \.\.\.actuales, \[CAMPO_NICHO_DEL_ICP\]: nombre \}/);
  assert.match(panel, /const actuales = aValoresDeFormulario\(idsDelIcp, estado\.perfil\[ICP\]\)/);

  // Y solo el nicho: los otros campos no se pueden sacar del texto sin inventarlos.
  const puente = panel.slice(panel.indexOf('const pasarElSegmentoAlIcp'), panel.indexOf('return ('));
  const camposTocados = [...puente.matchAll(/'t4-[a-z]+'/g)].map((m) => m[0]);
  assert.deepEqual(camposTocados, [], 'el puente escribe campos del ICP por su nombre literal');
});

test('el viaje espera al puente, y un fallo del puente no bloquea el viaje', () => {
  /* Sin el `await`, el ICP se monta leyendo el estado anterior: llenaría su formulario con lo que
     había y el nicho recién guardado aparecería recién a la próxima visita. */
  const barra = codigo('components/fundaciones/BarraDePasos.jsx');
  assert.match(barra, /if \(alSalir\) await alSalir\(siguiente\.herramienta\.id\);/);

  /* Y si el guardado falla, se navega igual: el paso 3 se abre con su campo vacío, que es lo que
     pasaba antes de que el puente existiera. Cortar el viaje por no haber podido prellenar un campo
     sería cambiar un inconveniente por un bloqueo. */
  const panel = codigo('components/fundaciones/PanelResearch.jsx');
  assert.match(panel, /if \(r\.tipo === 'datos'\) await onEstadoCambiado\(\);/);
});

test('recargar el estado DEVUELVE la promesa: sin eso, esperar la recarga es mentira', () => {
  /* ═══════════════════════════════════════════════════════════════════════════
   * REPORTADO EN VIVO: «le doy click a Continuar al paso 3 pero el formulario del ICP sigue vacío».
   *
   * El puente guardaba bien el segmento. Lo que fallaba era el `await`: `recargar` estaba escrito
   * como `() => { cargar(); }` —con llaves— así que TRAGABA la promesa. `await onEstadoCambiado()`
   * resolvía al instante, se navegaba al paso 3, y el panel se montaba leyendo el estado ANTERIOR.
   *
   * Y no se corregía solo cuando la recarga terminaba: `PanelHerramienta` lee sus valores en un
   * inicializador de `useState` y su `key` no cambia, así que el dato recién guardado aparecía
   * recién a la próxima visita a la pestaña.
   *
   * Es un defecto de UNA llave, invisible en el tipo y en el build: una función que devuelve
   * `undefined` se puede esperar igual, y `await undefined` no falla.
   * ═══════════════════════════════════════════════════════════════════════════ */
  const armazon = codigo('components/fundaciones/Fundaciones.jsx');
  assert.match(
    armazon,
    /const recargar = useCallback\(\(\) => cargar\(\), \[cargar\]\);/,
    '`recargar` volvió a tragarse la promesa: quien la espere va a seguir con el estado viejo',
  );
});

// ─── Rellenar el formulario con lo que ya se generó ────────────────────────

test('el relleno usa EL MISMO esquema que el agente conversacional', async () => {
  /* Son dos caminos que llenan los mismos campos del mismo formulario. Con dos esquemas, uno
     aceptaría un campo que el otro rechaza, y el defecto se vería como «por el chat sí y por el
     relleno no» — sin que nada falle en ninguno de los dos. */
  const { esquemaDeCampos, esquemaDeRespuestas } = await import('../../lib/fundaciones/conversacion.ts');
  const { herramienta } = await import('../../lib/fundaciones/herramientas.ts');
  const icp = herramienta(3)!;

  const suelto = esquemaDeCampos(icp);
  const dentroDelChat = (esquemaDeRespuestas(icp)['properties'] as Record<string, unknown>)['respuestas'];
  assert.deepEqual(dentroDelChat, suelto, 'el chat y el relleno dejaron de compartir el esquema');
});

test('el relleno lee lo que la pantalla PROMETE que se hereda', async () => {
  /* El contexto sale de `FUENTES_POR_HERRAMIENTA`, la misma lista que dibuja los chips de «Hereda
     de». Una segunda lista haría que el formulario se rellenara con algo que los chips no nombran, y
     nadie podría explicar de dónde salió un dato. */
  const relleno = codigo('lib/fundaciones/relleno.ts');
  assert.match(relleno, /FUENTES_POR_HERRAMIENTA\[h\.id\]/);
  assert.match(relleno, /fuente\.completo\.slice\(0, CARACTERES_POR_FUENTE\)/);
});

test('sin contexto no se llama al modelo', () => {
  /* El prompt saldría con la sección vacía y el modelo llenaría los campos con lo típico del rubro
     —justo lo que sus reglas le prohíben— con la inferencia pagada igual. */
  const relleno = codigo('lib/fundaciones/relleno.ts');
  const corte = relleno.indexOf("if (contexto.trim() === '')");
  const llamada = relleno.indexOf('pedirExterno<RespuestaDeAnthropic>');
  assert.ok(corte > 0 && llamada > corte, 'se llama al modelo antes de comprobar que haya contexto');
});

test('el relleno PROPONE: no guarda ni genera', () => {
  /* Un dato que no se vio antes de guardarse es indistinguible de uno que la persona escribió, y de
     estos campos heredan las ocho herramientas siguientes. */
  const relleno = codigo('lib/fundaciones/relleno.ts');
  assert.ok(!/guardarInputs|guardarVersion|guardarResearch/.test(relleno), 'el relleno escribe en el almacén');

  const panel = codigo('components/fundaciones/PanelHerramienta.jsx');
  const cuerpo = panel.slice(panel.indexOf('const rellenar = async'), panel.indexOf('const generar = async'));
  assert.ok(!/pedir\(rutaEstado/.test(cuerpo), 'el botón de rellenar guarda sin que nadie lo pida');
  assert.ok(!/pedir\(rutaGenerar/.test(cuerpo), 'el botón de rellenar genera');
  // Y no pisa con vacío lo que ya estaba escrito.
  assert.match(cuerpo, /if \(v && v\.trim\(\) !== ''\) proximo\[campo\.id\] = v;/);
});

test('un valor inventado en un desplegable se descarta, también acá', () => {
  /* Misma defensa que en el chat: el `SKILL.md` del VSL deriva booleanos del principio del valor, y
     uno inventado apaga la rama sin que nada falle. */
  const relleno = codigo('lib/fundaciones/relleno.ts');
  assert.match(relleno, /campo\.opciones\.some\(\(o\) => o\.valor === texto\) \? texto : ''/);
});
