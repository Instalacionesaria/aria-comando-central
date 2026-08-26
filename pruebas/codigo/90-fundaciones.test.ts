// Etapa 9 · Fundaciones. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ VIGILA ESTE ARCHIVO, Y POR QUÉ NINGUNA DE ESTAS COSAS FALLA SOLA
//
// Las nueve herramientas son un PORT de ARIA-brain que comparte almacén con él. Todo lo que puede
// salir mal acá tiene la misma forma: **el documento se genera, se ve bien, y está construido sobre
// nada**. Ninguno de estos defectos produce un error.
//
//   · Un identificador renumerado ("que queden 0..6, más ordenado") rompe la herencia: `perfil[3]`
//     deja de ser el ICP. Nada falla: la Oferta genera con el contexto de otra herramienta.
//   · Una clave corta mal derivada hace que el hub y el port escriban campos distintos en el mismo
//     documento. Nada falla: cada uno lee el suyo y ve el otro vacío.
//   · Una variable de plantilla que el constructor de datos no produce se interpola como cadena
//     vacía. Nada falla: el prompt sale con un hueco y el modelo lo rellena inventando.
//   · Un `SKILL.md` que no está en el paquete construido. Eso SÍ falla, y esta prueba verifica que
//     falle — que no haya un prompt suplente que lo tape.
//
// Es una prueba de tipo Código: no toca la base, no llama a ningún modelo, y corre en milisegundos.

import test from 'node:test';
import assert from 'node:assert/strict';

import { FUNDACIONES, IDS_FUNDACIONES, PASOS_RESEARCH, herramienta } from '../../lib/fundaciones/herramientas.ts';
import { claveCorta, camposDe, idsDeCampos } from '../../lib/fundaciones/campos.ts';
import { estadoVacio, pasoCompleto, type EstadoDeFundaciones } from '../../lib/fundaciones/estado.ts';
import { FUENTES_POR_HERRAMIENTA, faltantes, fuentes } from '../../lib/fundaciones/herencia.ts';
import { interpolar, leerPlantilla } from '../../lib/fundaciones/plantillas.ts';
import {
  METODOLOGIA,
  METODOLOGIA_RESEARCH,
  MetodologiaIlegible,
  armarPrompt,
  armarPromptResearch,
  pasoDeResearchListo,
  tokensDeSalida,
} from '../../lib/fundaciones/prompts.ts';
import { aHtml, aTextoPlano, leerDocumento } from '../../lib/fundaciones/documento.ts';
import { MODELO } from '../../lib/fundaciones/generacion.ts';
import { CAPACIDADES } from '../../lib/autorizacion/capacidades.ts';
import { SECCIONES, SIN_OPERACIONES_TODAVIA, seccionesVisibles } from '../../lib/autorizacion/secciones.ts';

// ─── El contrato con ARIA-brain: los identificadores y las claves ───────────

test('las nueve herramientas son las nueve del hub, en el ORDEN DEL MÉTODO', () => {
  // El orden es el de `FOUNDATIONS_JOURNEY` de ARIA-brain. NO es el orden de los identificadores, y
  // esta lista literal es la que lo congela: sin ella, reordenar las pestañas "para que queden por
  // número" pasaría desapercibido y dejaría a Categoría generando antes de que exista el avatar del
  // que lee.
  assert.deepEqual(
    IDS_FUNDACIONES,
    [0, 1, 3, 2, 4, 10, 26, 5, 6],
    'los identificadores son los del hub y el orden es el del método: Perfil, Research, ICP, ' +
      'Categoría, Oferta, Pricing, Mapa, VSL, Landing',
  );

  // ── ESTA AFIRMACIÓN ESTABA INVERTIDA, Y SE INVIERTE, NO SE BORRA ───────────
  //
  // Decía `assert.equal(herramienta(5), undefined)` con el motivo "VSL entró sin que nadie lo
  // decidiera": las dos últimas del método quedaron fuera de la Etapa 9 y esa línea existía para
  // que agregarlas fuera una decisión y no un accidente. Se decidió, y ahora la prueba custodia lo
  // contrario — que no se caigan sin que nadie lo note.
  assert.ok(herramienta(5), 'VSL(5) salió de las nueve');
  assert.ok(herramienta(6), 'Landing(6) salió de las nueve');

  // Los prefijos de campo del hub NO coinciden con el id de la herramienta, y esa rareza se
  // congela: el VSL es la 5 y sus campos son `t6-`; la Landing es la 6 y el suyo es `t7-`.
  // "Arreglarlo" cambiaría la clave con la que se guarda cada campo.
  assert.ok(
    camposDe(herramienta(5)!).every((c) => c.id.startsWith('t6-')),
    'los campos del VSL son `t6-`, como en el hub',
  );
  assert.deepEqual(camposDe(herramienta(6)!).map((c) => c.id), ['t7-niche']);
});

test('los valores de las listas del VSL encienden las ramas del framework', () => {
  // `vsl/killer-framework` no es una plantilla con huecos: tiene ramas. Los tres booleanos que las
  // encienden se derivan mirando el PRINCIPIO del valor elegido, igual que el hub. Acortar un valor
  // en `herramientas.ts` —"B2C" en vez de la frase entera— apaga la rama Y EL DOCUMENTO SALE IGUAL,
  // escrito con el molde equivocado. Esto es lo que hace que ese cambio falle en vez de pasar.
  const campos = new Map(camposDe(herramienta(5)!).map((c) => [c.id, c]));

  const mercado = campos.get('t6-market')!;
  assert.ok(mercado.opciones!.some((o) => o.valor.startsWith('B2C')), 'ninguna opción enciende _isB2C');
  assert.ok(mercado.opciones!.some((o) => o.valor.startsWith('B2B')), 'falta la rama B2B');

  const proof = campos.get('t6-socialproof')!;
  assert.ok(proof.opciones!.some((o) => o.valor.startsWith('Sí')), 'ninguna opción enciende _hasProof');
  assert.ok(proof.opciones!.some((o) => o.valor.startsWith('No')), 'ninguna opción enciende _noProof');

  const formato = campos.get('t6-format')!;
  assert.ok(
    formato.opciones!.some((o) => o.valor.startsWith('Case study')),
    'ninguna opción enciende _isScreenShare, que cambia el entregable entero',
  );
});

test('las claves de persistencia son las que ya escribió el hub', () => {
  // El almacén es COMPARTIDO. Estas claves cortas son las que el hub guarda hoy, copiadas de
  // `lib/legacy/fieldIds.ts` de ARIA-brain. Una diferencia acá no rompe nada visible: el port
  // escribe `nicho` donde el hub escribe `niche`, y cada sistema ve el campo del otro en blanco.
  const esperadas: Readonly<Record<number, readonly string[]>> = {
    0: ['biz', 'niche', 'service', 'price', 'pain', 'result', 'before'],
    1: ['niche', 'buyers', 'ltv', 'contract', 'experience'],
    3: ['niche', 'income', 'age', 'country', 'occupation', 'pains', 'desires', 'tried'],
    2: ['current', 'alternatives', 'notworking'],
    4: ['name', 'price', 'result', 'format', 'why', 'when', 'includes', 'urgency'],
    10: ['outcome', 'probability', 'problemcost', 'clientrevenue', 'delivery', 'goal', 'proof', 'pastresults'],
    26: ['caso', 'responsables'],
    // El VSL guarda con prefijo `t6-` y la Landing con `t7-`, aunque sus ids sean 5 y 6. Las claves
    // cortas que quedan son éstas, y son las del hub: si alguien "arregla" los prefijos para que
    // coincidan con el id, esta lista deja de cuadrar y la prueba lo dice.
    5: ['program', 'duration', 'promise', 'market', 'socialproof', 'format', 'story', 'obj'],
    6: ['niche'],
  };

  for (const h of FUNDACIONES) {
    const derivadas = idsDeCampos(h.id).map(claveCorta);
    assert.deepEqual(
      [...derivadas].sort(),
      [...(esperadas[h.id] ?? [])].sort(),
      `las claves cortas de "${h.pestania}" no son las del hub`,
    );
  }

  // Y la regla, por si alguien cambia el prefijo de un campo: `t2cat-current` → `current`.
  assert.equal(claveCorta('t2cat-current'), 'current');
  assert.equal(claveCorta('t1-biz'), 'biz');
  assert.equal(claveCorta('mr-niche'), 'niche');
  // Un identificador sin prefijo se devuelve entero, no vacío.
  assert.equal(claveCorta('suelto'), 'suelto');
});

test('ningún identificador de campo se repite entre herramientas', () => {
  // Dos herramientas con el mismo identificador de campo compartirían el `id` del `<label>` y del
  // control en el DOM, y —peor— la clave corta. `t5-price` y `t11-price` derivan las dos a `price`,
  // que está BIEN porque van a documentos distintos (`perfil[4]` y `perfil[10]`); lo que no puede
  // repetirse es el identificador completo.
  const vistos = new Map<string, string>();
  for (const h of FUNDACIONES) {
    for (const c of camposDe(h)) {
      const previo = vistos.get(c.id);
      assert.equal(previo, undefined, `el campo ${c.id} está en "${previo}" y en "${h.pestania}"`);
      vistos.set(c.id, h.pestania);
    }
  }
  assert.ok(vistos.size > 30, 'muy pocos campos: la prueba estaría pasando en vacío');
});

// ─── Las metodologías: existen, y no hay suplente que las tape ──────────────

test('las trece metodologías existen y no están vacías', () => {
  const todas = [...Object.values(METODOLOGIA), ...METODOLOGIA_RESEARCH];
  // Once hasta que entraron VSL(5) y Landing(6). El número literal es lo que obliga a que sumar o
  // quitar una metodología sea una decisión: los archivos entran al paquete construido por un glob
  // de `outputFileTracingIncludes`, así que uno que falte NO rompe la construcción — rompe la
  // generación en producción, con `metodologia_ilegible`, y solo para esa herramienta.
  assert.equal(todas.length, 13, 'cambió la cantidad de metodologías sin que nadie lo dijera');

  for (const id of todas) {
    const plantilla = leerPlantilla(id);
    assert.ok(plantilla !== null, `no se pudo leer la metodología ${id}`);
    // El frontmatter YAML se quita antes de devolver. Si quedara, el prompt empezaría con
    // `---\nversion: 3\n---`, que el modelo lee como parte de la instrucción.
    assert.doesNotMatch(plantilla, /^---\n/, `${id} conserva su frontmatter`);
    assert.ok(plantilla.trim().length > 200, `${id} es sospechosamente corta`);
  }

  // Las nueve herramientas tienen la suya. Research usa las cinco de los pasos.
  for (const h of FUNDACIONES) {
    if (h.id === 1) continue;
    assert.ok(METODOLOGIA[h.id], `"${h.pestania}" no tiene metodología asignada`);
  }
  assert.equal(METODOLOGIA_RESEARCH.length, PASOS_RESEARCH);
});

test('una metodología que no se puede leer LANZA: no hay prompt suplente', () => {
  // ARIA-brain sí tiene suplente —una copia embebida de cada metodología— y acá se decidió no
  // portarlo. El motivo: dos copias del mismo prompt divergen en la primera corrección, y el
  // síntoma es un documento generado con la metodología vieja SIN ningún error.
  //
  // Esta prueba es lo que impide que alguien "arregle" el `metodologia_ilegible` agregando una
  // copia embebida. Si eso pasara, esto dejaría de lanzar.
  assert.throws(
    () => armarPromptResearch(99, {}, []),
    /no tiene un paso 99/,
    'un paso inexistente tiene que fallar, no devolver un prompt vacío',
  );
  assert.throws(() => armarPrompt(777, {}, estadoVacio()), /no tiene metodología asignada/);
  // El tipo del error existe y lleva el nombre de la metodología, para que la respuesta pueda
  // decir CUÁL falta.
  const e = new MetodologiaIlegible('icp/avatar');
  assert.equal(e.metodologia, 'icp/avatar');
  assert.equal(e.name, 'MetodologiaIlegible');
});

// ─── El defecto silencioso principal: una variable sin dato ─────────────────

/** Un estado con TODO hecho: siete documentos, inputs, y los cinco pasos del research. */
function estadoCompleto(): EstadoDeFundaciones {
  const e = estadoVacio();
  e.perfil = {
    0: { biz: 'ARIA IA', niche: 'agencias', service: 'sistema', price: '$3,000', pain: 'leads', result: '15 llamadas', before: 'ads' },
    3: { niche: 'agencias digitales', income: '$10k', age: '30-45', country: 'MX', occupation: 'dueño', pains: 'no agenda', desires: 'escalar', tried: 'setter' },
    2: { current: 'agencia', alternatives: 'otras agencias', notworking: 'me comparan' },
    4: { name: 'Protocolo', price: '$4,000', result: '15 llamadas', format: 'DFY', why: 'cuello', when: '90 días', includes: 'todo', urgency: 'cupos' },
    10: { outcome: '$120k', probability: '60%', problemcost: '$8k', clientrevenue: '$40k', delivery: '$600', goal: '$30k', proof: '6 clientes', pastresults: '3 a 14' },
    26: { caso: 'Marcos', responsables: 'yo' },
    5: {
      program: 'ARIA IA Accelerator',
      duration: 'medio',
      promise: 'Lanza tu AI Firm en 90 días',
      // Los valores LARGOS y no las etiquetas: son los que encienden las ramas del framework.
      market: 'B2B — vendes a dueños de negocio / empresas (lenguaje directo, lógico, orientado a resultados)',
      socialproof: 'Sí, tengo casos de éxito / testimonios / resultados probados con clientes reales',
      format: 'Case study / screen share — proyectando Miro, Google Docs u otra pantalla mientras hablas',
      story: 'Marcos pasó de 4 a 19 llamadas',
      obj: 'no tengo tiempo',
    },
    6: { niche: 'agencias digitales' },
  };
  e.historial = {
    0: [{ date: 'hoy', output: 'PERFIL GENERADO' }],
    3: [{ date: 'hoy', output: 'AVATAR GENERADO' }],
    2: [{ date: 'hoy', output: 'CATEGORÍA GENERADA' }],
    4: [{ date: 'hoy', output: 'OFERTA GENERADA' }],
    10: [{ date: 'hoy', output: 'PRICING GENERADO' }],
    26: [{ date: 'hoy', output: 'MAPA GENERADO' }],
    // El guion del VSL con sus DOS secciones de compromiso: es lo que la Landing copia en vez de
    // inventar. Sin ellas, `formatearCompromisos` devuelve null y la landing toma la otra rama.
    5: [{ date: 'hoy', output: '# Guion\n\n## Pasos y requisitos para aplicar\nFacturar $5k/mes\n\n## Cupos limitados\nSolo 8 por mes\n' }],
    6: [{ date: 'hoy', output: 'PROMPT DE LANDING GENERADO' }],
  };
  e.researchInputs = { niche: 'agencias', buyers: '50,000+', ltv: '$3,000+', contract: '$1,000+', experience: 'consultor' };
  e.researchSalidas = ['PASO 1', 'PASO 2', 'PASO 3', 'PASO 4', 'PASO 5'];
  e.researchProfundo = 'PROFUNDO';
  e.researchCampo = 'CAMPO';
  return e;
}

/** Los valores de formulario de una herramienta, todos llenos. */
function valoresLlenos(id: number): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const campo of idsDeCampos(id)) salida[campo] = `valor de ${campo}`;
  return salida;
}

test('ningún prompt sale con una variable de plantilla sin resolver', () => {
  // ÉSTA es la prueba que justifica el archivo. Una `{{clave}}` que el constructor de datos no
  // produce se interpola como CADENA VACÍA: el prompt sale con un hueco, el modelo lo rellena
  // inventando, y el documento se ve perfecto. No hay error, no hay señal, y el alumno recibe un
  // avatar construido sobre un dato que nunca dio.
  const completo = estadoCompleto();
  const vacio = estadoVacio();

  for (const h of FUNDACIONES) {
    if (h.id === 1) continue;
    for (const [nombre, estado] of [['completo', completo], ['vacío', vacio]] as const) {
      const prompt = armarPrompt(h.id, valoresLlenos(h.id), estado);
      assert.doesNotMatch(
        prompt,
        /\{\{[\w.#^/]+\}\}/,
        `"${h.pestania}" con estado ${nombre} dejó una variable sin resolver`,
      );
      assert.doesNotMatch(
        prompt,
        /\bundefined\b/,
        `"${h.pestania}" con estado ${nombre} interpoló \`undefined\``,
      );
      assert.ok(prompt.length > 400, `el prompt de "${h.pestania}" salió sospechosamente corto`);
    }
  }
});

test('los cinco pasos del research tampoco dejan huecos, y encadenan de verdad', () => {
  const inputs = estadoCompleto().researchInputs;
  const previas = ['SALIDA UNO', 'SALIDA DOS', 'SALIDA TRES', 'SALIDA CUATRO'];

  for (let paso = 0; paso < PASOS_RESEARCH; paso += 1) {
    const prompt = armarPromptResearch(paso, inputs, previas.slice(0, paso));
    assert.doesNotMatch(prompt, /\{\{[\w.#^/]+\}\}/, `el paso ${paso + 1} dejó una variable sin resolver`);
    assert.doesNotMatch(prompt, /\bundefined\b/, `el paso ${paso + 1} interpoló \`undefined\``);
  }

  // El encadenamiento es lo que hace útil al research: el paso 2 lee la salida del 1, el 3 la del
  // 2, y el 5 lee la del 2 y la del 4. Es el defecto que ARIA-brain pagó —el paso 5 recibía la
  // lista vacía y su plantilla interpolaba `undefined`— y esto lo vigila.
  assert.match(armarPromptResearch(1, inputs, ['SALIDA UNO']), /SALIDA UNO/);
  assert.match(armarPromptResearch(2, inputs, previas.slice(0, 2)), /SALIDA DOS/);
  assert.match(armarPromptResearch(3, inputs, previas.slice(0, 3)), /SALIDA TRES/);
  const paso5 = armarPromptResearch(4, inputs, previas);
  assert.match(paso5, /SALIDA DOS/, 'el paso 5 no leyó los dolores del paso 2');
  assert.match(paso5, /SALIDA CUATRO/, 'el paso 5 no leyó los precios del paso 4');

  // Y la compuerta: un paso sin su anterior NO se puede pedir.
  assert.equal(pasoDeResearchListo(0, []), true, 'el primer paso no necesita nada');
  assert.equal(pasoDeResearchListo(1, []), false);
  assert.equal(pasoDeResearchListo(1, ['']), false, 'una salida vacía no es una salida');
  assert.equal(pasoDeResearchListo(4, previas), true);
});

test('el contexto heredado LLEGA al prompt: no es decorativo', () => {
  // Sin esto, las siete herramientas serían siete formularios independientes y el método dejaría
  // de ser un método. La comprobación es literal: los documentos del estado tienen que aparecer
  // dentro del prompt de quien los hereda.
  const e = estadoCompleto();

  const oferta = armarPrompt(4, valoresLlenos(4), e);
  assert.match(oferta, /AVATAR GENERADO/, 'la Oferta no heredó el avatar');
  assert.match(oferta, /CATEGORÍA GENERADA/, 'la Oferta no heredó el posicionamiento');

  const mapa = armarPrompt(26, valoresLlenos(26), e);
  for (const fuente of ['AVATAR GENERADO', 'CATEGORÍA GENERADA', 'OFERTA GENERADA', 'PRICING GENERADO']) {
    assert.match(mapa, new RegExp(fuente), `el Mapa no heredó ${fuente} — hornea desde las cuatro`);
  }

  const icp = armarPrompt(3, valoresLlenos(3), e);
  assert.match(icp, /PASO 5/, 'el ICP no heredó el segmento ganador del research');
  assert.match(icp, /PASO 2/, 'el ICP no heredó los dolores investigados del paso 2');
  assert.match(icp, /PERFIL GENERADO/, 'el ICP no heredó la ficha de negocio');

  const pricing = armarPrompt(10, valoresLlenos(10), e);
  assert.match(pricing, /OFERTA GENERADA/, 'Tu precio no heredó el stack de valor');

  const categoria = armarPrompt(2, valoresLlenos(2), e);
  assert.match(categoria, /AVATAR GENERADO/, 'Categoría no heredó el avatar');
  // Y su adaptador de modo documento, que es lo que la convierte de conversación en entregable.
  assert.match(categoria, /MODO DOCUMENTO/, 'Categoría perdió su adaptador de modo documento');
});

test('el research incompleto NO se hereda: cuatro pasos no son cinco', () => {
  // El segmento ganador es el paso 5. Con cuatro pasos hechos, lo que el ICP hereda todavía no
  // existe — y heredar el paso 4 (los precios) en su lugar daría un avatar construido sobre la
  // pregunta equivocada. Es la misma regla que `isStepDone` del hub.
  const e = estadoCompleto();
  e.researchSalidas = ['PASO 1', 'PASO 2', 'PASO 3', 'PASO 4'];
  assert.equal(pasoCompleto(e, 1), false, 'cuatro pasos contaron como research completo');
  assert.equal(fuentes(e).marketResearch.presente, false);
  const icp = armarPrompt(3, valoresLlenos(3), e);
  assert.doesNotMatch(icp, /PASO 4/, 'el ICP heredó un research a medias');
});

// ─── Los criterios de "hecho" ──────────────────────────────────────────────

test('los tres casos especiales de "paso completo" son los del hub', () => {
  const vacio = estadoVacio();
  for (const h of FUNDACIONES) {
    assert.equal(pasoCompleto(vacio, h.id), false, `"${h.pestania}" se declaró hecha sin nada`);
  }

  // Tu ficha (0): cuenta como hecha con inputs guardados, aunque nadie haya generado. El
  // onboarding puede haberla llenado.
  const soloInputs = estadoVacio();
  soloInputs.perfil = { 0: { biz: 'ARIA IA' } };
  assert.equal(pasoCompleto(soloInputs, 0), true, 'la ficha con inputs del onboarding no contó');
  // Pero eso NO aplica a las demás: tener inputs no es tener el documento.
  const inputsDeIcp = estadoVacio();
  inputsDeIcp.perfil = { 3: { niche: 'agencias' } };
  assert.equal(pasoCompleto(inputsDeIcp, 3), false, 'inputs sin documento contaron como hecho');

  // Categoría (2): acepta el entregable del chat viejo del hub, que no vive en el historial.
  const soloLegado = estadoVacio();
  soloLegado.categoriaLegado = 'POSICIONAMIENTO VIEJO';
  assert.equal(pasoCompleto(soloLegado, 2), true, 'se perdió el entregable del chat viejo');
  assert.equal(fuentes(soloLegado).categoria.presente, true);

  // Y el estado completo: los nueve.
  const completo = estadoCompleto();
  for (const h of FUNDACIONES) {
    assert.equal(pasoCompleto(completo, h.id), true, `"${h.pestania}" no contó con todo hecho`);
  }
});

test('las fuentes críticas que faltan se pueden nombrar antes de gastar la generación', () => {
  const vacio = estadoVacio();
  assert.deepEqual(faltantes(vacio, 4), ['icp', 'categoria']);
  assert.deepEqual(faltantes(vacio, 26), ['icp', 'categoria', 'oferta', 'pricing']);
  // Con todo hecho, no falta nada.
  assert.deepEqual(faltantes(estadoCompleto(), 26), []);
  // Y las herramientas raíz no tienen fuentes críticas: exigirle algo a la primera pantalla del
  // método sería pedirle al alumno que empiece por el final.
  assert.deepEqual(faltantes(vacio, 0), []);
  assert.deepEqual(faltantes(vacio, 1), []);

  // Toda fuente que una herramienta declara como crítica tiene que estar entre las que MUESTRA, o
  // el aviso hablaría de algo que no está en pantalla.
  for (const [id, criticas] of Object.entries({ 4: ['icp', 'categoria'], 26: ['icp', 'categoria', 'oferta', 'pricing'] })) {
    const mostradas = FUENTES_POR_HERRAMIENTA[Number(id)] ?? [];
    for (const c of criticas) {
      assert.ok(mostradas.includes(c as never), `la herramienta ${id} exige ${c} y no lo muestra`);
    }
  }
});

// ─── El presupuesto de salida ──────────────────────────────────────────────

test('los cuatro entregables largos llevan el presupuesto amplio', () => {
  // Son los números del hub. El del Mapa no es generosidad: nueve secciones densas más el
  // veredicto, y con 8.192 la respuesta se corta a la mitad de S6 — y un documento cortado se ve
  // como un documento hasta que alguien llega al final.
  for (const id of [3, 4, 10, 26]) {
    assert.equal(tokensDeSalida(id), 16_000, `la herramienta ${id} perdió su presupuesto amplio`);
  }
  for (const id of [0, 2]) {
    assert.equal(tokensDeSalida(id), 8_192, `la herramienta ${id} cambió de presupuesto`);
  }
});

test('el modelo es el del hub, y cambiarlo es una decisión', () => {
  // No es una preferencia: mientras ARIA-brain siga en pie, un alumno tiene que poder comparar su
  // avatar de acá con el de allá. Un modelo distinto sobre el mismo prompt da un documento
  // distinto, y la diferencia se leería como un error del port.
  assert.equal(MODELO, 'claude-sonnet-4-6');
});

// ─── El veredicto nunca sale crudo ─────────────────────────────────────────

test('el bloque <veredicto> se separa y NUNCA llega crudo a la pantalla ni al portapapeles', () => {
  const crudo =
    '<veredicto>\n<item titulo="Transformación">de X a Y</item>\n' +
    '<item titulo="Protocolo">Método Propio, 5 fases</item>\n</veredicto>\n\n# Mapa\n\nTexto.';

  const leido = leerDocumento(crudo);
  assert.equal(leido.veredicto.length, 2);
  assert.equal(leido.veredicto[0]?.titulo, 'Transformación');
  assert.equal(leido.veredicto[1]?.conclusion, 'Método Propio, 5 fases');
  assert.doesNotMatch(leido.cuerpo, /<veredicto>/, 'el bloque quedó en el cuerpo');

  // Ni en pantalla…
  assert.doesNotMatch(aHtml(leido.cuerpo), /&lt;veredicto&gt;/);
  // …ni al copiar o descargar. Quien pega esto en un documento para su coach no tiene por qué
  // recibir etiquetas XML.
  const plano = aTextoPlano(crudo);
  assert.doesNotMatch(plano, /<veredicto>|<item /, 'el veredicto salió crudo al portapapeles');
  assert.match(plano, /Transformación/, 'se perdió el contenido del veredicto al aplanarlo');

  // Un bloque presente pero SIN items legibles no se quita: quitar un bloque y no mostrar nada en
  // su lugar es perder contenido en silencio.
  const roto = '<veredicto>\nsin items\n</veredicto>\n\nDocumento.';
  assert.deepEqual(leerDocumento(roto).veredicto, []);
  assert.match(leerDocumento(roto).cuerpo, /sin items/);
});

test('el renderizador escapa ANTES de agregar sus propias etiquetas', () => {
  // El texto viene de un modelo y termina en un `dangerouslySetInnerHTML`. Un documento que hable
  // de una landing puede contener `<script>` sin ninguna mala intención.
  const html = aHtml('## Mi <script>alert(1)</script> sección\n\n- **uno** y *dos*');
  assert.doesNotMatch(html, /<script>/, 'el escape no corrió primero');
  assert.match(html, /&lt;script&gt;/);
  // Y lo propio sí se renderiza.
  assert.match(html, /<strong>uno<\/strong>/);
  assert.match(html, /<em>dos<\/em>/);
  assert.match(html, /class="fd-h fd-h2"/);
  assert.match(html, /<li>/);
});

test('la interpolación resuelve rutas con punto y bloques condicionales', () => {
  // `{{_prev.0}}` es cómo los pasos del research leen la salida anterior, y `{{#clave}}` es cómo
  // una plantilla omite una línea entera en vez de mostrarla con un hueco.
  assert.equal(interpolar('A {{_prev.1}} B', { _prev: ['uno', 'dos'] }), 'A dos B');
  assert.equal(interpolar('{{#x}}sí{{/x}}', { x: 'algo' }), 'sí');
  assert.equal(interpolar('{{#x}}sí{{/x}}', { x: '' }), '');
  assert.equal(interpolar('{{^x}}no hay{{/x}}', { x: '' }), 'no hay');
  assert.equal(interpolar('{{^x}}no hay{{/x}}', { x: 'algo' }), '');
  // Una clave ausente se resuelve a cadena vacía, no a "undefined". Es lo que hace que la prueba
  // de "ninguna variable sin resolver" tenga que existir: acá no hay error posible.
  assert.equal(interpolar('[{{falta}}]', {}), '[]');
});

// ─── El modelo de permisos ─────────────────────────────────────────────────

test('la pantalla `icp` salió de la lista de "sin operaciones" y entró al catálogo', () => {
  // El cable trampa de `SIN_OPERACIONES_TODAVIA` disparó en esta etapa. Esta prueba es lo que
  // impide que alguien lo desarme volviendo a poner `icp` en las dos listas — que dejaría a
  // `ADR-0303` verificando una pantalla que ya no está.
  assert.ok(
    SECCIONES.some((s) => s.clave === 'icp' && s.capacidadRequerida === 'fundaciones.ver'),
    '`icp` no está en SECCIONES con su capacidad',
  );
  assert.ok(
    !SIN_OPERACIONES_TODAVIA.includes('icp'),
    '`icp` quedó en las DOS listas: una de las dos miente',
  );
  assert.ok(CAPACIDADES.includes('fundaciones.ver'));
  assert.ok(CAPACIDADES.includes('fundaciones.editar'));
  // Las OCHO que siguen esperando su primera operación.
  //
  // Eran nueve hasta la Etapa 11, que se llevó `setter` y `closer` por el mismo camino que la 9
  // se llevó `icp` — y volvieron a ocho cuando entró `tools`, que nace sin ninguna operación.
  //
  // El número literal es el cable trampa: **el día que una de estas ocho reciba su primera
  // operación de servidor, esta línea falla** y alguien tiene que bajarle la bandera
  // `sinOperacionesTodavia` en `SECCIONES` en vez de dejar una pantalla que decide por
  // capacidad figurando como si no decidiera nada. Derivarlo lo apagaría.
  assert.equal(SIN_OPERACIONES_TODAVIA.length, 8);
});

test('`setter` y `closer` salieron de la lista, cada uno con su propia capacidad', () => {
  // La segunda vez que el cable trampa dispara. Y la primera con una consecuencia que `icp` no
  // tuvo: estas dos pantallas **no las ve todo el mundo**, así que su visibilidad tiene que
  // decidirse por capacidad de verdad y no solo estar catalogada.
  for (const clave of ['setter', 'closer']) {
    assert.ok(
      SECCIONES.some((s) => s.clave === clave),
      clave + ' no está en SECCIONES',
    );
    assert.ok(
      !SIN_OPERACIONES_TODAVIA.includes(clave),
      clave + ' quedó en las DOS listas: una de las dos miente',
    );
  }

  // Y ésta es LA aserción de la etapa, la que hace cierto *"un closer solo ve su pestaña"*.
  //
  // Las dos capacidades tienen que ser DISTINTAS. Si alguien las unifica —que es la
  // simplificación que se ve razonable desde lejos— los dos roles pasan a ver las dos
  // pestañas y nada más falla: `seccionesVisibles` filtra bien, con el criterio equivocado.
  const closer = SECCIONES.find((s) => s.clave === 'closer');
  const setter = SECCIONES.find((s) => s.clave === 'setter');
  assert.notEqual(
    closer?.capacidadRequerida,
    setter?.capacidadRequerida,
    'Closer y Setter piden la MISMA capacidad: con eso los dos roles ven las dos pestañas',
  );

  // Y que la separación sea real, no dos nombres: lo que un closer tiene no puede abrir la
  // pestaña del setter. Se comprueba con `seccionesVisibles`, que es la función que decide.
  assert.ok(closer && setter);
  const soloCloser = seccionesVisibles(new Set([closer.capacidadRequerida])).map((x) => x.clave);
  const soloSetter = seccionesVisibles(new Set([setter.capacidadRequerida])).map((x) => x.clave);
  assert.deepEqual(soloCloser, ['closer'], 'con closer.ver a secas se ve algo más que Closer');
  assert.deepEqual(soloSetter, ['setter'], 'con setter.ver a secas se ve algo más que Setter');
});

test('las dos capacidades están en el archivo que las carga, y no en la migración', async () => {
  // Esta prueba SE MUDÓ en la Etapa 11, y el motivo es que el archivo que decía cargarlas no las
  // cargaba. La migración 009 tenía los tres `insert`, y el primero era rechazado por política
  // —`identidad.permisos` tiene el forzado de RLS sin política para `migrador`— así que
  // `db:reset` moría ahí y se llevaba las 158 pruebas de base con él. Nadie podía reconstruir la
  // base local, y esta prueba pasaba en verde igual: comprobaba que el texto NOMBRARA las
  // capacidades, no que llegaran a la tabla.
  //
  // Ahora las carga `db/arranque/001_catalogo.sql`, con la credencial de nivel clúster, que es
  // la única que omite RLS. Ese archivo explica en su encabezado las siete salidas que se
  // midieron y por qué se descartaron las otras seis.
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { RAIZ } = await import('../apoyo/fuente.ts');

  const catalogo = readFileSync(join(RAIZ, 'db/arranque/001_catalogo.sql'), 'utf8');
  for (const capacidad of ['fundaciones.ver', 'fundaciones.editar']) {
    assert.ok(catalogo.includes("('" + capacidad + "'"), 'el catálogo no carga ' + capacidad);
  }
  // Y las reparte: una capacidad en el catálogo que ningún rol tiene es una capacidad que nadie
  // puede usar.
  assert.match(catalogo, /superadministrador/);
  assert.match(catalogo, /administrador/);

  // La otra mitad, y es la que impide que esto se deshaga: la migración YA NO tiene que
  // intentar el `insert`. Si alguien lo vuelve a poner, `db:reset` vuelve a morir — y sin esta
  // aserción, moriría sin que ninguna prueba diga por qué.
  const migracion = readFileSync(join(RAIZ, 'db/migraciones/009_fundaciones.sql'), 'utf8');
  const sinComentarios = migracion
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n');
  assert.doesNotMatch(
    sinComentarios,
    /insert\s+into\s+identidad\./i,
    'la migración 009 volvió a tener un `insert` en `identidad`: eso es rechazado por política',
  );
  // Lo que sí le queda, que es lo que una migración puede hacer.
  assert.match(migracion, /fundaciones_cliente_id/);
});

// ─── La compuerta de paridad ───────────────────────────────────────────────

test('`icp` salió de la comparación con el prototipo, y las otras nueve siguen', async () => {
  // La vista ya no coincide con el prototipo A PROPÓSITO. Dejarla en la lista daría un rojo
  // permanente, y un rojo permanente no se arregla: se ignora, y con él se ignoran los otros nueve.
  //
  // Lo que esta prueba protege es la otra mitad: que sacar una vista no se vuelva la salida fácil
  // para cualquier rojo. Si mañana quedan siete, esto falla y alguien tiene que explicar por qué.
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { RAIZ } = await import('../apoyo/fuente.ts');
  const paridad = readFileSync(join(RAIZ, 'scripts/paridad.mjs'), 'utf8');
  const lista = /const VISTAS = \[([\s\S]*?)\];/.exec(paridad);
  assert.ok(lista && lista[1], 'no se pudo leer la lista de vistas de paridad.mjs');
  const vistas = [...lista[1].matchAll(/'([\w-]+)'/g)].map((m) => m[1]);
  assert.equal(vistas.length, 7, `la lista de paridad tiene ${vistas.length} vistas, no siete`);
  assert.ok(!vistas.includes('icp'), '`icp` volvió a la comparación: va a dar rojo permanente');
});
