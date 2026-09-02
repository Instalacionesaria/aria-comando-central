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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  FUNDACIONES,
  IDS_FUNDACIONES,
  TODAS,
  PASOS_RESEARCH,
  TOOLS,
  herramienta,
} from '../../lib/fundaciones/herramientas.ts';
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
import { MODELO, generar } from '../../lib/fundaciones/generacion.ts';
import { rechazoDeModelo } from '../../lib/fundaciones/operaciones.ts';
import { CAPACIDADES } from '../../lib/autorizacion/capacidades.ts';
import { SECCIONES, SIN_OPERACIONES_TODAVIA, seccionesVisibles } from '../../lib/autorizacion/secciones.ts';

// ─── El contrato con ARIA-brain: los identificadores y las claves ───────────

test('las siete de ICP & Oferta son las del hub, en el ORDEN DEL MÉTODO', () => {
  // El orden es el de `FOUNDATIONS_JOURNEY` de ARIA-brain. NO es el orden de los identificadores, y
  // esta lista literal es la que lo congela: sin ella, reordenar las pestañas "para que queden por
  // número" pasaría desapercibido y dejaría a Categoría generando antes de que exista el avatar del
  // que lee.
  //
  // ── ERAN NUEVE, Y LAS DOS ÚLTIMAS SE FUERON A `TOOLS` ──────────────────────
  //
  // El VSL(5) el 2026-08-31 por pedido de Jorge; la Landing(6) —la pestaña 8 de esta pantalla— el
  // 2026-09-02 por pedido de Kevin. En ARIA-brain son los pasos 8 y 9 de «Construye tu base», y el
  // port las trajo ahí.
  //
  // La lista sigue congelada y los dos identificadores siguen afirmados, sólo que del otro lado: la
  // prueba de más abajo exige que el VSL y la Landing estén en `TOOLS`. O sea que una herramienta
  // no se puede perder en el camino —desaparecer de los dos catálogos pondría roja una de las dos—
  // que es la garantía que esta lista literal da y que un `length` no daría.
  assert.deepEqual(
    IDS_FUNDACIONES,
    [0, 1, 3, 2, 4, 10, 26],
    'los identificadores son los del hub y el orden es el del método: Perfil, Research, ICP, ' +
      'Categoría, Oferta, Pricing, Mapa',
  );

  // ── ESTA AFIRMACIÓN ESTABA INVERTIDA, Y SE INVIERTE, NO SE BORRA ───────────
  //
  // Decía `assert.equal(herramienta(5), undefined)` con el motivo "VSL entró sin que nadie lo
  // decidiera": las dos últimas del método quedaron fuera de la Etapa 9 y esa línea existía para
  // que agregarlas fuera una decisión y no un accidente. Se decidió, y ahora la prueba custodia lo
  // contrario — que no se caigan sin que nadie lo note.
  assert.ok(herramienta(5), 'VSL(5) salió de las nueve');
  assert.ok(herramienta(6), 'Landing(6) salió de las nueve');
  // Y ninguna de las dos quedó en el catálogo del que se fueron: una herramienta en las DOS
  // pantallas se vería dos veces y se generaría con dos capacidades distintas según por dónde
  // se entrara.
  assert.ok(!IDS_FUNDACIONES.includes(5), 'el VSL volvió a «ICP & Oferta» sin que nadie lo decidiera');
  assert.ok(!IDS_FUNDACIONES.includes(6), 'la Landing volvió a «ICP & Oferta» sin que nadie lo decidiera');

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

test('Prospección está PORTADA del hub, no reinterpretada', () => {
  // ── POR QUÉ ESTA PRUEBA EXISTE ──────────────────────────────────────────────
  //
  // La primera versión de este port reescribió las etiquetas "más conversacionales", cambió los
  // marcadores y partió la única fila del hub en tres. Nada falló: la herramienta generaba igual.
  // Lo que se rompió es lo que un port existe para no romper — que el alumno que entra por las dos
  // puertas reconozca la misma herramienta.
  //
  // Es una lista congelada a mano, o sea una lista paralela, y va igual: no hay forma de leer
  // `ARIA-brain/app-next/lib/tools.ts` desde este repositorio, así que la alternativa a congelarlo
  // es no comprobarlo.
  const p = herramienta(20);
  assert.ok(p, 'Prospección(20) salió de TOOLS');

  // El VSL y la Landing viven en `TOOLS` desde que se movieron de Fundaciones. Se afirma acá para que no pueda
  // desaparecer de los dos catálogos a la vez: sacarlo de `FUNDACIONES` y olvidarse de ponerlo
  // en `TOOLS` dejaría la herramienta inalcanzable sin que nada mas fallara.
  /* El orden importa: la Landing hereda del VSL, así que va después. Al revés, la pantalla
     ofrecería primero la herramienta que necesita la salida de la que viene atrás. */
  assert.deepEqual(
    TOOLS.map((h) => h.id),
    [20, 5, 6],
    'TOOLS son Prospección(20), el VSL(5) y la Landing(6), en ese orden',
  );

  // UNA fila de DOS columnas con los CUATRO campos: en el hub se ven en una cuadrícula de 2×2.
  // Partirla cambia dónde queda cada campo en la pantalla.
  assert.equal(p.filas.length, 1, 'la fila única del hub se partió');
  assert.equal(p.filas[0]!.columnas, 2);
  assert.equal(p.filas[0]!.campos.length, 4);

  assert.deepEqual(
    camposDe(p).map((c) => [c.id, c.etiqueta]),
    [
      ['t20-ubicacion', 'Ubicación / mercado objetivo'],
      ['t20-canal', 'Canal principal de outreach'],
      ['t20-fuentes', 'Fuentes a usar'],
      ['t20-tono', 'Tono de los mensajes (siempre dentro del marco consultivo)'],
    ],
    'las etiquetas o el orden no son los del hub',
  );

  assert.equal(p.titulo, 'Prospección Inteligente');
  assert.equal(p.etiquetaBoton, 'Generar Plan de Prospección');
  assert.equal(p.etiquetaSalida, 'Plan de Prospección Generado');

  // `hasEdit: false` en el hub. El panel muestra el control de Ajustar para todas las demás, así
  // que sin esta bandera Prospección tendría un botón que allá no existe.
  assert.equal(p.sinAjuste, true, 'volvió el control de Ajustar, que el hub no tiene');

  // ── Y LA FORMA, QUE ES LO QUE SE PORTÓ MAL DOS VECES ────────────────────────
  //
  // `TOOL_20_PROSPECCION` declara cuatro campos y un formulario genérico, y el hub NO la pinta con
  // eso: tiene un panel propio con un extractor de leads, que usa solo dos de los cuatro campos.
  // Guiarse por la declaración es la conclusión equivocada a la que ya se llegó una vez, así que
  // la forma queda congelada acá.
  assert.equal(p.forma, 'prospeccion', 'Prospección volvió al formulario genérico');

  // Las tres listas nacen con su primera opción sembrada. Es lo ÚNICO que no está en el hub, y no
  // cambia nada visible: allá el `<select>` suelto muestra la primera y ésa se lee del DOM. Sin
  // esto, la pantalla mostraría "Multicanal" y el prompt recibiría `(no especificado)`.
  for (const c of camposDe(p)) {
    if (c.tipo !== 'lista') continue;
    assert.equal(
      c.valorPorOmision,
      c.opciones![0]!.valor,
      `"${c.etiqueta}" no siembra su primera opción: se vería llena y llegaría vacía`,
    );
  }
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

test('las catorce metodologías existen y no están vacías', () => {
  const todas = [...Object.values(METODOLOGIA), ...METODOLOGIA_RESEARCH];
  // Once hasta que entraron VSL(5) y Landing(6); catorce desde que entró Prospección(20), que es
  // de la pantalla `tools` y no de Fundaciones — el mapa es de TODAS las herramientas, porque la
  // metodología de una no depende de en qué pantalla se muestre.
  //
  // El número literal es lo que obliga a que sumar o quitar una metodología sea una decisión: los
  // archivos entran al paquete construido por un glob de `outputFileTracingIncludes`, así que uno
  // que falte NO rompe la construcción — rompe la generación en producción, con
  // `metodologia_ilegible`, y solo para esa herramienta.
  assert.equal(todas.length, 14, 'cambió la cantidad de metodologías sin que nadie lo dijera');

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

  /* ── SE RECORREN LAS DOS PANTALLAS, Y ANTES NO ─────────────────────────────
   *
   * Decía `for (const h of FUNDACIONES)`, y con eso el VSL y la Landing SALIERON DE ESTA PRUEBA el
   * día que se mudaron a `tools` — el 2026-08-31 y el 2026-09-02. La mudanza no les cambió ni el
   * prompt ni el constructor de datos, así que nada se rompió; lo que se perdió fue la comprobación,
   * que es peor: un hueco en la plantilla del VSL habría dejado de verse sin que nadie tocara el VSL.
   *
   * Prospección(20) entra por primera vez, y tiene el mismo derecho: su prompt se arma igual.
   *
   * La lección, escrita para el próximo que mueva una herramienta de pantalla: **una prueba que
   * recorre un catálogo pierde cobertura en silencio cuando algo se va de ese catálogo.** Se recorre
   * `TODAS`, que es el catálogo de las dos, y así una mudanza futura no puede sacar nada de acá. */
  for (const h of TODAS) {
    if (h.id === 1) continue;
    for (const [nombre, estado] of [['completo', completo], ['vacío', vacio]] as const) {
      const crudo = armarPrompt(h.id, valoresLlenos(h.id), estado);
      /* Las DOS llaves que sí tienen que sobrevivir, y sólo en Prospección: `{{nombre}}` y
         `{{empresa}}` son los campos de combinación de GoHighLevel. El constructor de datos los pasa
         a propósito —ver la nota de `datosDeProspeccion`— para que lleguen TAL CUAL al documento y
         el CRM los reemplace por el nombre de cada prospecto. Quitarlos acá antes de comprobar es lo
         que permite que la herramienta entre a esta prueba en vez de quedar exenta entera. */
      const prompt =
        h.id === 20 ? crudo.replace(/\{\{(nombre|empresa)\}\}/g, 'CAMPO_DEL_CRM') : crudo;
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

test('el modelo es uno de los identificadores VÁLIDOS de Anthropic', () => {
  /* ── FIJABA UN SOLO IDENTIFICADOR, Y EL COMENTARIO SE EQUIVOCABA ────────────
   *
   * Pedía `claude-sonnet-4-6` «porque es el que usa ARIA-brain». Fijar UNO es el defecto real: la
   * prueba estaba en verde sosteniendo el valor con el que nada generaba — o sea confirmando una
   * suposición en vez de un hecho.
   *
   * Pero la explicación que se escribió acá —«ese valor no es un modelo de la API»— **era falsa**.
   * `claude-sonnet-4-6` es un modelo activo. El `404` de entonces no decía «no existe» sino «esta
   * llave no lo alcanza», que es una condición de la cuenta y no de este código. El comentario de
   * `MODELO` en `lib/fundaciones/generacion.ts` lo cuenta completo.
   *
   * Queda escrito porque el error de razonamiento se repite solo: **«falla, entonces el valor es
   * inválido» no es una medición.**
   *
   * La lista de abajo no dice «los únicos que existen»: dice «los que este proyecto acepta usar».
   * Un valor inventado no pasa, y cambiar de modelo por un motivo real sigue siendo una línea. */
  const VALIDOS = [
    'claude-opus-5',
    'claude-sonnet-5',
    'claude-fable-5',
    'claude-haiku-4-5-20251001',
  ];
  assert.ok(
    VALIDOS.includes(MODELO),
    `«${MODELO}» no es un identificador de modelo válido, así que TODA generación va a fallar con 404 ` +
      'y la pantalla va a decir «el modelo no respondió» — mandando a revisar la clave, que está bien',
  );
});

// ════════════════════════════════════════════════════════════════════════════
// EL CUERPO QUE SALE HACIA ANTHROPIC — lo que nadie miraba
//
// Este archivo comprobaba el MODELO y el PRESUPUESTO por separado, y nunca el cuerpo armado. Y ese
// hueco tiene una consecuencia medida: un cuerpo invalido llega a produccion, la API responde 400
// `invalid_request_error`, y la pantalla dice «el modelo no respondio» — que manda a revisar la
// credencial, que esta bien. Ya paso dos veces en la misma pantalla.
//
// Lo que hace que valga: NO reimplementa el cuerpo. Llama a `generar(` de verdad y le pone una
// trampa a `fetch`, asi que lo que se afirma es lo que sale por el cable.
//
// ── EL CASO QUE MOTIVA LA COMPROBACION DEL VIAJE DE IDA Y VUELTA ──────────
//
// `JSON.stringify` **borra las claves cuyo valor es `undefined`**, sin ruido. Asi que un
// `max_tokens: undefined` —una funcion que devuelve `undefined` para un id nuevo, digamos— no sale
// como `null`: sale como si el campo no existiera, y la API responde *«max_tokens: Field required»*.
// Por eso lo que se inspecciona es el JSON YA SERIALIZADO Y VUELTO A LEER, no el objeto.
// ════════════════════════════════════════════════════════════════════════════

/** Corre `generar(` con `fetch` interceptado, y devuelve lo que salio y lo que volvio. */
async function conFetchInterceptado<T>(
  respuesta: () => Response,
  correr: () => Promise<T>,
): Promise<{ salida: T; peticiones: { url: string; cuerpo: Record<string, unknown>; cabeceras: Headers }[] }> {
  const peticiones: { url: string; cuerpo: Record<string, unknown>; cabeceras: Headers }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const enviado = typeof init?.body === 'string' ? init.body : '{}';
    peticiones.push({
      url: String(url),
      // Se serializa y se vuelve a leer A PROPOSITO: ver el encabezado. Es la unica forma de ver
      // los campos que `JSON.stringify` se comio.
      cuerpo: JSON.parse(enviado) as Record<string, unknown>,
      cabeceras: new Headers(init?.headers),
    });
    return respuesta();
  }) as typeof globalThis.fetch;
  try {
    return { salida: await correr(), peticiones };
  } finally {
    globalThis.fetch = original;
  }
}

const RESPUESTA_BUENA = () =>
  new Response(
    JSON.stringify({
      content: [{ type: 'text', text: 'un documento' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 20 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

test('el cuerpo que sale hacia Anthropic tiene los tres campos, y ninguno se lo come `JSON.stringify`', async () => {
  /* Se recorren las herramientas con su prompt REAL y su presupuesto REAL. Si alguna arma un cuerpo
     que la API rechazaria, esto falla ACA y no en produccion tres semanas despues. */
  for (const id of [0, 2, 3, 4, 10, 26]) {
    const estado = estadoVacio();
    const prompt = armarPrompt(id, {}, estado);

    const { peticiones } = await conFetchInterceptado(RESPUESTA_BUENA, () =>
      generar({ claveIa: 'sk-de-prueba', prompt, tokens: tokensDeSalida(id) }),
    );

    assert.equal(peticiones.length, 1, `la herramienta ${id} no hizo exactamente una peticion`);
    const p = peticiones[0]!;
    assert.equal(p.url, 'https://api.anthropic.com/v1/messages');

    // 1 · El modelo, presente y con el valor que el modulo declara.
    assert.equal(p.cuerpo['model'], MODELO, `la herramienta ${id} manda otro modelo`);

    /* 2 · `max_tokens` PRESENTE. La clave es `in`, no una comparacion de valor: un `undefined`
           desaparece del JSON y `p.cuerpo['max_tokens'] === undefined` no distingue «no vino» de
           «vino undefined». La API responde *«Field required»* y el sintoma en pantalla es el mismo
           «el modelo no respondio» de siempre. */
    assert.ok('max_tokens' in p.cuerpo, `la herramienta ${id} manda un cuerpo SIN max_tokens`);
    const tope = p.cuerpo['max_tokens'];
    assert.ok(
      typeof tope === 'number' && Number.isInteger(tope) && tope > 0,
      `la herramienta ${id} manda max_tokens = ${String(tope)}`,
    );

    // 3 · Un mensaje de usuario con contenido de verdad. La API rechaza los bloques vacios, y un
    //     prompt que se interpola a nada es exactamente eso.
    const mensajes = p.cuerpo['messages'] as { role?: string; content?: unknown }[] | undefined;
    assert.ok(Array.isArray(mensajes) && mensajes.length === 1, `la herramienta ${id} no manda un mensaje`);
    assert.equal(mensajes[0]?.role, 'user');
    const contenido = mensajes[0]?.content;
    assert.ok(typeof contenido === 'string', `la herramienta ${id} manda un content que no es texto`);
    assert.ok(
      contenido.trim().length > 0,
      `la herramienta ${id} manda un content VACIO: la API lo rechaza con 400 y la pantalla dice ` +
        '«el modelo no respondio», que manda a revisar la credencial',
    );

    /* 4 · NINGUN campo de mas. La API responde *«Extra inputs are not permitted»* —otro 400 con el
           mismo texto amable en pantalla— y es el error tipico de copiar un cuerpo de otra API. */
    assert.deepEqual(
      Object.keys(p.cuerpo).sort(),
      ['max_tokens', 'messages', 'model'],
      `la herramienta ${id} manda campos que la API no espera`,
    );

    // 5 · Las dos cabeceras sin las que no hay peticion valida.
    assert.equal(p.cabeceras.get('anthropic-version'), '2023-06-01');
    assert.equal(p.cabeceras.get('x-api-key'), 'sk-de-prueba');
  }
});

test('el prompt del Research SI declara la herramienta de busqueda, y las demas NO', async () => {
  /* Las dos mitades importan. La busqueda de mas en una herramienta que no la necesita gasta y
     cambia el documento; la de menos en el Research lo deja inventando referentes en vez de
     buscarlos, que es el defecto que el Research existe para no tener. */
  const { peticiones: conBusqueda } = await conFetchInterceptado(RESPUESTA_BUENA, () =>
    generar({ claveIa: 'k', prompt: 'hola', tokens: 100, conBusquedaWeb: true }),
  );
  const herramientas = conBusqueda[0]?.cuerpo['tools'] as { type?: string; name?: string }[] | undefined;
  assert.ok(Array.isArray(herramientas) && herramientas.length === 1, 'el Research no declara la busqueda');
  assert.equal(herramientas[0]?.name, 'web_search');
  assert.match(
    String(herramientas[0]?.type),
    /^web_search_\d{8}$/,
    'el tipo de la herramienta de busqueda no tiene la forma `web_search_AAAAMMDD`. Un tipo que la ' +
      'API no conoce da 400 `invalid_request_error`, con el mismo texto amable de siempre',
  );

  const { peticiones: sinBusqueda } = await conFetchInterceptado(RESPUESTA_BUENA, () =>
    generar({ claveIa: 'k', prompt: 'hola', tokens: 100 }),
  );
  assert.equal('tools' in (sinBusqueda[0]?.cuerpo ?? {}), false, 'una herramienta sin busqueda la declara igual');
});

// ════════════════════════════════════════════════════════════════════════════
// EL MOTIVO QUE VUELVE — el campo que decidia entre cuatro investigaciones y se tiraba
// ════════════════════════════════════════════════════════════════════════════

const rechazoDeAnthropic = (tipo: string, mensaje?: string) => () =>
  new Response(
    JSON.stringify({ type: 'error', error: mensaje === undefined ? { type: tipo } : { type: tipo, message: mensaje } }),
    { status: 400, headers: { 'content-type': 'application/json' } },
  );

test('el `message` de Anthropic LLEGA, porque es lo unico que dice que estuvo mal', async () => {
  /* ══ ESTA PRUEBA EXISTE POR UN DEFECTO QUE ME COSTO DOS RONDAS ═════════════
   *
   * `pedirExterno` leia `error.type` y descartaba `error.message`, por una decision escrita: *«el
   * codigo y no el mensaje del proveedor, que es texto que no controlamos»*. El resultado es que
   * estas cuatro situaciones se ven IDENTICAS en pantalla, y son cuatro cosas distintas:
   *
   *   · una cuenta sin saldo        → hay que recargar, y esperar no arregla nada;
   *   · un `max_tokens` fuera de rango → es nuestro y se corrige en una linea;
   *   · un campo de mas en el cuerpo  → tambien nuestro;
   *   · un tipo de herramienta caducado → tambien nuestro.
   *
   * Las cuatro son `invalid_request_error`. Lo unico que las separa es la frase del `message`. */
  const conSaldo = await conFetchInterceptado(
    rechazoDeAnthropic('invalid_request_error', 'Your credit balance is too low to access the Anthropic API.'),
    () => generar({ claveIa: 'k', prompt: 'hola', tokens: 100 }),
  );
  assert.equal(conSaldo.salida.tipo, 'rechazado');
  assert.equal(
    conSaldo.salida.tipo === 'rechazado' ? conSaldo.salida.motivo : null,
    'Your credit balance is too low to access the Anthropic API.',
    'el motivo del proveedor se perdio: en pantalla queda `invalid_request_error` a secas, que no ' +
      'distingue una cuenta sin saldo de un cuerpo mal armado',
  );
  assert.equal(conSaldo.salida.tipo === 'rechazado' ? conSaldo.salida.codigo : '', 'invalid_request_error');

  /* Y `null` cuando el servicio no dijo nada, que NO es lo mismo que una cadena vacia. «No dijo por
     que» es un hecho, y la pantalla tiene que poder decirlo asi en vez de mostrar un parentesis
     vacio. */
  const sinMensaje = await conFetchInterceptado(rechazoDeAnthropic('overloaded_error'), () =>
    generar({ claveIa: 'k', prompt: 'hola', tokens: 100 }),
  );
  assert.equal(sinMensaje.salida.tipo === 'rechazado' ? sinMensaje.salida.motivo : 'x', null);

  // Y se acota. Un servicio verborragico no vuelca medio cuerpo de la peticion en una pantalla.
  const largo = await conFetchInterceptado(
    rechazoDeAnthropic('invalid_request_error', 'x'.repeat(5000)),
    () => generar({ claveIa: 'k', prompt: 'hola', tokens: 100 }),
  );
  const motivoLargo = largo.salida.tipo === 'rechazado' ? (largo.salida.motivo ?? '') : '';
  assert.ok(motivoLargo.length > 0 && motivoLargo.length <= 320, `el motivo vino con ${motivoLargo.length} caracteres`);
});

test('el motivo queda en el REGISTRO del servidor y tambien en la pantalla', async () => {
  /* ══ LOS DOS SOBREVIVIENTES DE LA MUTACION, Y SON EL ULTIMO TRAMO ══════════
   *
   * Que `pedirExterno` lea el motivo no sirve de nada si `rechazoDeModelo` lo tira. Y mientras esa
   * funcion fue privada no habia por donde ejercitarla: borrarle el `console.error` y borrarle el
   * motivo de la respuesta dejaban la suite entera en verde.
   *
   * Son las dos mitades del mismo arreglo, y NINGUNA reemplaza a la otra:
   *
   *   · el REGISTRO es lo que sobrevive. Cuando alguien reporta esto tres dias despues, la pantalla
   *     ya se cerro y lo unico que queda es la linea de Vercel. Antes de este cambio no habia
   *     NINGUNA: el diagnostico no se perdia en el camino, no existia.
   *   · la PANTALLA es lo que hace que no haga falta ir a los registros. Quien esta mirando es quien
   *     administra la organizacion, o sea la persona que puede recargar el saldo o avisar. */
  const errores: string[] = [];
  const original = console.error;
  console.error = (...partes: unknown[]) => void errores.push(partes.map(String).join(' '));

  let r: Response;
  try {
    r = rechazoDeModelo({
      tipo: 'rechazado',
      estado: 400,
      codigo: 'invalid_request_error',
      motivo: 'Your credit balance is too low to access the Anthropic API.',
    });
  } finally {
    console.error = original;
  }

  // 1 · EL REGISTRO. Con el codigo, el numero y el motivo: los tres hacen falta para decidir.
  assert.equal(errores.length, 1, 'un rechazo del modelo no dejo ni una linea en el registro del servidor');
  assert.match(errores[0] ?? '', /invalid_request_error/, 'el registro no dice el codigo');
  assert.match(errores[0] ?? '', /400/, 'el registro no dice el numero de situacion');
  assert.match(
    errores[0] ?? '',
    /credit balance is too low/,
    'el registro no dice el MOTIVO, que es lo unico que distingue una cuenta sin saldo de un cuerpo ' +
      'mal armado. Sin eso, la linea de registro no vale mas que la pantalla',
  );

  // 2 · LA PANTALLA. El codigo dice la familia y el motivo dice el problema: van los dos.
  assert.equal(r.status, 502, 'un rechazo del modelo dejo de ser 502: un 500 mandaria a revisar NUESTRO codigo');
  const cuerpo = (await r.json()) as { codigo?: string; detalle?: string };
  assert.equal(cuerpo.codigo, 'modelo_no_disponible');
  assert.match(cuerpo.detalle ?? '', /invalid_request_error/, 'el detalle perdio el codigo');
  assert.match(
    cuerpo.detalle ?? '',
    /credit balance is too low/,
    'el detalle llega sin el motivo: en pantalla queda `invalid_request_error` a secas, que es ' +
      'exactamente lo que hizo falta adivinar dos veces',
  );

  /* 3 · Y sin motivo, el registro lo DICE en vez de dejar un hueco. Un registro que termina en
         «invalid_request_error ·» hace dudar de si el motivo no vino o si se perdio acá. */
  const sinMotivo: string[] = [];
  console.error = (...partes: unknown[]) => void sinMotivo.push(partes.map(String).join(' '));
  try {
    rechazoDeModelo({ tipo: 'rechazado', estado: 529, codigo: 'overloaded_error', motivo: null });
  } finally {
    console.error = original;
  }
  assert.match(sinMotivo[0] ?? '', /sin motivo/, 'sin motivo, el registro deja un hueco en vez de decirlo');
});

test('el frontmatter YAML NO llega al prompt, con cualquier final de línea', () => {
  /* ══ UN DEFECTO QUE EXISTÍA EN LOCAL Y NO EN PRODUCCIÓN ══════════════════
   *
   * `sinFrontmatter` pedía un `---` seguido de salto de línea UNIX exacto. Los `SKILL.md` son copias
   * byte a byte de las del hub y el desarrollo es en Windows con `core.autocrlf = true`, así que en
   * el disco traen el retorno de carro: el patrón no coincidía, y el bloque YAML entero —nombre,
   * descripción, versión— entraba al prompt como si fuera metodología. En Vercel, que construye
   * sobre Linux, el mismo archivo está en LF y funcionaba bien.
   *
   * O sea: el prompt que se medía acá no era el que corría allá. Eso no se nota como un error — se
   * nota como un diagnóstico que no cierra, y cuesta el doble.
   *
   * La prueba afirma la PROPIEDAD y no el patrón, así que dice lo mismo en las dos plataformas: en
   * la de Windows atrapa el defecto, y en Linux sostiene que sigue arreglado. */
  const conFrontmatterEnCrudo: string[] = [];

  for (const metodologia of [...Object.values(METODOLOGIA), ...METODOLOGIA_RESEARCH]) {
    const plantilla = leerPlantilla(metodologia);
    assert.ok(plantilla, `no se pudo leer ${metodologia}`);

    // Lo que llega al prompt no empieza por el separador del frontmatter.
    assert.doesNotMatch(
      plantilla,
      /^---/,
      `${metodologia} llega al prompt CON su frontmatter, así que el modelo recibe la metadata del ` +
        'archivo como si fueran instrucciones',
    );

    // Ni nombra las claves del YAML en su arranque, que es la forma en que se colaba.
    assert.doesNotMatch(
      plantilla.slice(0, 200),
      /^\s*(name|description|version)\s*:/m,
      `${metodologia} arranca con una clave del frontmatter`,
    );

    /* Y LA COMPROBACIÓN DE ENTRADA MUERTA, que es la mitad que hace que esto valga algo: el archivo
       EN CRUDO SÍ tiene frontmatter. Sin ella, un directorio vacío pasaría la prueba. */
    const ruta = join(process.cwd(), 'lib', 'fundaciones', 'skills', metodologia, 'SKILL.md');
    if (/^---\r?\n/.test(readFileSync(ruta, 'utf8'))) conFrontmatterEnCrudo.push(metodologia);
  }

  assert.ok(
    conFrontmatterEnCrudo.length > 0,
    'ningún SKILL.md tiene frontmatter en crudo, así que la afirmación de arriba no ejercita nada',
  );
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
  // Las SIETE que siguen esperando su primera operación.
  //
  // Eran nueve hasta la Etapa 11, que se llevó `setter` y `closer` por el mismo camino que la 9
  // se llevó `icp`. `tools` nació sin operaciones y las tuvo el mismo día: Prospección en Frío le
  // dio las suyas, así que entró y salió de esta lista sin llegar a contarse.
  //
  // El número literal es el cable trampa: **el día que una de estas ocho reciba su primera
  // operación de servidor, esta línea falla** y alguien tiene que bajarle la bandera
  // `sinOperacionesTodavia` en `SECCIONES` en vez de dejar una pantalla que decide por
  // capacidad figurando como si no decidiera nada. Derivarlo lo apagaría.
  assert.equal(SIN_OPERACIONES_TODAVIA.length, 7);
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

test('`icp` salió de la comparación con el prototipo, y las que quedan siguen', async () => {
  // La vista ya no coincide con el prototipo A PROPÓSITO. Dejarla en la lista daría un rojo
  // permanente, y un rojo permanente no se arregla: se ignora, y con él se ignoran los otros.
  //
  // Lo que esta prueba protege es la otra mitad: que sacar una vista no se vuelva la salida fácil
  // para cualquier rojo. El número es EXACTO, así que bajarlo pone esto rojo y alguien tiene que
  // venir a escribir el motivo — que es lo único que hace que una compuerta que se encoge no se
  // encoja sola.
  //
  // Van cuatro salidas y cada una con su motivo escrito en `scripts/paridad.mjs`: `icp` en la
  // Etapa 9, `setter` y `closer` en la 11 —las tres porque sus DATOS dejaron de ser los del
  // maquetado— y `executive` acá, que es la primera por un cambio de DISEÑO: el mapa de áreas se
  // pulió (cinco líneas de un solo color, un punto animado en cada una, la de Creative recta) y
  // eso mueve la forma y las cajas del SVG a propósito. Su red de reemplazo es
  // `pruebas/codigo/120-mapa-ejecutivo.test.ts`.
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { RAIZ } = await import('../apoyo/fuente.ts');
  const paridad = readFileSync(join(RAIZ, 'scripts/paridad.mjs'), 'utf8');
  const lista = /const VISTAS = \[([\s\S]*?)\];/.exec(paridad);
  assert.ok(lista && lista[1], 'no se pudo leer la lista de vistas de paridad.mjs');
  const vistas = [...lista[1].matchAll(/'([\w-]+)'/g)].map((m) => m[1]);
  assert.equal(vistas.length, 6, `la lista de paridad tiene ${vistas.length} vistas, no seis`);
  for (const fuera of ['icp', 'setter', 'closer', 'executive']) {
    assert.ok(
      !vistas.includes(fuera),
      `\`${fuera}\` volvió a la comparación: diverge del prototipo a propósito y va a dar rojo ` +
        'permanente',
    );
  }
});

// ─── La espera del navegador contra lo que la ruta puede tardar ─────────────

test('las pantallas esperan lo que las rutas de Fundaciones pueden tardar', async () => {
  // ES EL DEFECTO DE LA AGENDA, COBRADO POR SEGUNDA VEZ. Llegó como queja al apretar «Crear mi
  // perfil de cliente» en `ICP & Oferta`: cartel rojo de red caída sobre una generación que el
  // servidor estaba haciendo bien. Las rutas declaran `maxDuration = 300` —una generación son
  // miles de tokens contra Anthropic, y leer el estado son nueve documentos del almacén del hub— y
  // el cliente abortaba a los quince segundos.
  //
  // Peor que en la Agenda: `generarElDocumento` GUARDA la versión antes de responder. El documento
  // quedaba escrito y el alumno leía que no se había podido llegar al servidor.
  //
  // La regla, la misma de `104-temas.test.ts`: **quien llama a una ruta que declara `maxDuration`
  // tiene que esperar al menos eso.** Se comprueba comparando los dos números, no la presencia del
  // argumento.
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { RAIZ } = await import('../apoyo/fuente.ts');
  const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

  const cliente = leer('lib/http/cliente.ts');
  const ms = Number(
    /ESPERA_DE_RUTA_LARGA_MS\s*=\s*([\d_]+)/.exec(cliente)?.[1]?.replace(/_/g, ''),
  );
  assert.ok(ms > 0, 'el cliente dejó de fijar cuánto se espera a una ruta larga');

  // Las seis rutas que las dos pantallas —Fundaciones y `tools`— pueden llamar. Las dos del agente
  // conversacional entraron después: sus turnos son cortos, pero cada uno lee las seis llaves del
  // almacén antes de llamar al modelo, así que heredan el mismo `maxDuration` que las demás.
  const RUTAS = [
    'app/api/fundaciones/estado/route.ts',
    'app/api/fundaciones/generar/route.ts',
    'app/api/fundaciones/conversar/route.ts',
    'app/api/tools/estado/route.ts',
    'app/api/tools/generar/route.ts',
    'app/api/tools/conversar/route.ts',
    // El análisis del Espía de Anuncios: no es de Fundaciones, y declara `maxDuration` y llama al
    // modelo igual que las otras. La regla que se comprueba es la misma —quien llama a una ruta que
    // puede tardar minutos tiene que esperarla— y dejarla afuera de esta lista la volvería a abrir.
    'app/api/tools/espia/route.ts',
  ];
  for (const ruta of RUTAS) {
    const segundos = Number(/maxDuration\s*=\s*(\d+)/.exec(leer(ruta))?.[1]);
    assert.ok(segundos > 0, `${ruta} dejó de declarar \`maxDuration\``);
    assert.ok(
      ms >= segundos * 1000,
      `las pantallas esperan ${ms / 1000}s y ${ruta} puede tardar ${segundos}s: el navegador va a ` +
        'abortar y anunciar un fallo sobre una generación que se guardó',
    );
  }

  // Y que la espera se declare Y se use: los cuatro llamadores, uno por uno. Sin esta mitad, la
  // constante puede quedar exportada y sin pasar a `pedir()`, que es exactamente el estado en el
  // que estaba el código cuando llegó la queja.
  const LLAMADORES = [
    'components/fundaciones/Fundaciones.jsx',
    'components/fundaciones/PanelHerramienta.jsx',
    'components/fundaciones/PanelResearch.jsx',
    'components/fundaciones/ChatDeHerramienta.jsx',
    'components/tools/PanelProspeccion.jsx',
  ];
  for (const archivo of LLAMADORES) {
    const fuente = leer(archivo);
    const pedidos = (fuente.match(/pedir\(\s*ruta(Estado|Generar|Conversar)/g) || []).length;
    const esperas = (fuente.match(/espera:\s*ESPERA_DE_RUTA_LARGA_MS/g) || []).length;
    assert.equal(
      esperas,
      pedidos,
      `${archivo} hace ${pedidos} llamadas a las rutas de Fundaciones y solo ${esperas} declaran ` +
        'la espera larga: la que falta va a abortar a los quince segundos',
    );
  }
});

test('la bandera `opcional` y el «(opcional)» de la etiqueta van SIEMPRE juntos', () => {
  // La etiqueta es lo que lee la persona y la bandera es lo que lee el código —`obligatoriosQueFaltan`
  // decide con ella si el botón se habilita y si el agente conversacional puede seguir de largo—.
  // Que se contradigan no falla en ninguna parte, y da las dos formas del mismo defecto:
  //
  //   · etiqueta sin bandera → el formulario dice «(opcional)» y el botón queda deshabilitado hasta
  //     que lo llenes, sin decir por qué;
  //   · bandera sin etiqueta → un campo que parece obligatorio se puede saltear, y el entregable sale
  //     con un dato menos sin que nadie lo haya decidido.
  //
  // Se comprueba en las DOS direcciones sobre las nueve herramientas, no solo sobre el Research.
  for (const h of [...FUNDACIONES, ...TOOLS]) {
    for (const campo of camposDe(h)) {
      const loDice = campo.etiqueta.toLowerCase().includes('(opcional)');
      assert.equal(
        !!campo.opcional,
        loDice,
        `\`${campo.id}\` dice «${campo.etiqueta}» y su bandera \`opcional\` es ` +
          `${campo.opcional ? 'true' : 'false'}: la etiqueta y el código no dicen lo mismo`,
      );
    }
  }
});

// ─── Las opciones de descarga que el hub ya ofrecía ─────────────────────────

test('un entregable se descarga como Word y como PDF, no solo como markdown', async () => {
  // LLEGÓ COMO REPORTE: «antes había un PDF para descargar y ahora no». Y era cierto — el port
  // entregaba un único botón «Descargar .md» donde el hub tiene un menú con Word y PDF
  // (`DownloadButton.tsx`). Un alumno le manda el entregable a su coach o a un cliente, y nadie
  // abre un `.md`.
  //
  // Lo que esta prueba fija NO es el formato: es que una afordancia del hub no se pierda en el port
  // sin que nadie lo decida. El defecto no falla — la pantalla anda perfecto con menos opciones, y
  // solo lo nota quien conocía la de antes.
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { RAIZ } = await import('../apoyo/fuente.ts');
  const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

  const documento = leer('components/fundaciones/Documento.jsx');
  for (const formato of ['Word (.doc)', 'PDF (.pdf)', 'Markdown (.md)']) {
    assert.ok(documento.includes(formato), `el menú de descarga perdió la opción ${formato}`);
  }

  // Los tres salen de `aTextoPlano`, que es lo mismo que se copia al portapapeles. Es LA regla del
  // `<veredicto>`: si un exportador recibiera `texto` crudo, el Word y el PDF saldrían con
  // etiquetas XML en las primeras líneas del Mapa de Proceso — y como el resto se ve bien, nadie
  // lo reportaría.
  const llamadas = documento.match(/descargarComo(?:Doc|Pdf)\([^)]*\)/g) || [];
  assert.equal(llamadas.length, 2, 'cambió la forma de llamar a los exportadores');
  for (const llamada of llamadas) {
    assert.match(llamada, /aTextoPlano\(texto\)/, `${llamada} no limpia el veredicto antes de exportar`);
  }

  // `jspdf` pesa ~350 KB y no tiene por qué entrar al paquete de una pantalla que la mayoría abre
  // sin descargar nada. El hub lo importa dinámico y acá también.
  const exportar = leer('lib/fundaciones/exportar.ts');
  assert.match(exportar, /await import\('jspdf'\)/, '`jspdf` dejó de importarse bajo demanda');
  assert.doesNotMatch(
    exportar.replace(/await import\('jspdf'\)/g, ''),
    /^import .*jspdf/m,
    '`jspdf` entró como import estático: se va al paquete principal',
  );

  // Y el markdown lo convierte `aHtml`, no un segundo renderizador. Dos renderizadores markdown en
  // el mismo repositorio divergen sin que nada falle: el Word diría una cosa y la pantalla otra.
  assert.match(exportar, /from '\.\/documento\.ts'/, 'el Word dejó de usar el renderizador del proyecto');
  const paquete = JSON.parse(leer('package.json')) as { dependencies?: Record<string, string> };
  assert.ok(
    !(paquete.dependencies || {}).marked,
    'entró `marked`: ya hay un renderizador markdown en `documento.ts`',
  );
});

// ─── Los cuatro defectos del PDF, que no fallaban ──────────────────────────

test('el PDF no aplana las listas ni contradice a la pantalla', async () => {
  // Los cuatro salieron de MIRAR un PDF generado, no de que algo fallara. Ése es el punto: el
  // documento «sale», está completo, y solo alguien que lo compara contra la pantalla nota que dice
  // otra cosa. Por eso quedan acá y no en la lista de estilo.
  const { aBloques } = await import('../../lib/fundaciones/exportar.ts');

  // 1 · La sangría es información. `aBloques` medía la línea DESPUÉS de recortarla, así que un
  //     sub-ítem quedaba al mismo nivel que su padre: en el «Perfil de Cliente» eso ponía cuatro
  //     tipos de freelancer como hermanos de «Perfil laboral:», que es lo contrario de lo que dice.
  const anidada = aBloques('- Perfil laboral:\n  - Freelancers estancados\n    - Jóvenes sin trayectoria');
  assert.deepEqual(
    anidada.map((b) => b.nivel),
    [0, 1, 2],
    'las listas anidadas volvieron a aplanarse',
  );

  // 2 · La pantalla SÍ reconoce `1.` como lista (ver `aHtml`). Cuando el PDF no lo hacía, el mismo
  //     documento se veía distinto en cada lado — y el PDF es el que sale de la empresa.
  const numerada = aBloques('1. El miedo con fecha de vencimiento\n2) El techo invisible');
  assert.deepEqual(
    numerada.map((b) => [b.tipo, b.marca]),
    [['vineta', '1.'], ['vineta', '2.']],
    'las listas numeradas volvieron a dibujarse como párrafos',
  );

  // Y una viñeta sigue siendo una viñeta: el punto de arriba no se ganó a costa de éste.
  assert.equal(aBloques('- Cobrar en dólares')[0]?.marca, '•');

  // Un párrafo que EMPIEZA con algo parecido no es una lista. `2026 fue el año…` no lleva viñeta.
  assert.equal(aBloques('2026 fue el año del cambio')[0]?.tipo, 'p');

  const fuente = (await import('node:fs')).readFileSync(
    (await import('node:path')).join((await import('../apoyo/fuente.ts')).RAIZ, 'lib/fundaciones/exportar.ts'),
    'utf8',
  );

  // 3 · La sangría francesa. Sin ella, la segunda línea de una viñeta vuelve al margen y se lee como
  //     un ítem nuevo. Se comprueba que la marca y el texto se dibujen en x DISTINTAS.
  assert.match(fuente, /doc\.text\(marca, MARGEN \+ sangria, y\)/, 'la marca dejó de ir al margen');
  assert.match(
    fuente,
    /doc\.text\(ln, MARGEN \+ sangria \+ anchoMarca, y\)/,
    'el texto de la viñeta volvió a alinearse con la marca: se pierde la sangría francesa',
  );

  // 4 · Un solo lugar cambia de página, y por eso la cabecera corrida, el foliado y la repetición de
  //     la cabecera de tabla no se pueden olvidar en uno de tres. El día que aparezca un
  //     `addPage()` suelto, esa página sale sin encabezado y nadie lo ve hasta que imprime.
  const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const saltos = (sinComentarios.match(/doc\.addPage\(\)/g) || []).length;
  assert.equal(saltos, 2, 'apareció un `addPage()` fuera de `saltarPagina()` y de la portada');
  assert.match(
    sinComentarios,
    /saltarPagina\(\);\s*\n\s*if \(!esCabecera && encabezado\.some/,
    'la tabla dejó de repetir su cabecera al partirse: se leen columnas sin saber cuál es cuál',
  );
});
