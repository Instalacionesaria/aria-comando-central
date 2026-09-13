// Lo que el cliente llenó en el formulario de Walter llega a «Tu ficha».
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTAS PRUEBAS CUSTODIAN
//
// Walter reportó el 2026-09-10 que un cliente nuevo —«Innat8 Technologies»— entraba a «Tu ficha» y
// el agente lo saludaba con *«¿Cómo se llama tu negocio?»*. El nombre estaba en la base desde que se
// registró: la captura del formulario vive en `aria_cc_icp_oferta`, con el HTML de la síntesis en
// cinco secciones, y NADA de Comando Central la leía.
//
// Kevin: *«los datos que llegaron a las tablas correspondientes deben servir para la pestaña Tu
// ficha; cuando el usuario vaya a chatear con el agente, ya debería estar allí precargada esa
// información, y el usuario podría consultar al chat sobre sus datos»*.
//
// El camino completo son cuatro tramos, y cada uno se rompe en silencio: el disparador de la base
// copia la captura a `intake`, el almacén la lee, el lector la convierte en secciones, y el
// constructor la mete en el prompt y en el contexto del agente. Un tramo cortado no falla — deja al
// agente preguntando lo que ya sabe.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { CARACTERES_DE_ONBOARDING, contextoDeOnboarding, leerOnboarding, paresDelChat } from '../../lib/fundaciones/onboarding.ts';
import { LLAVES, estadoVacio } from '../../lib/fundaciones/estado.ts';
import { armarPrompt, datosDe } from '../../lib/fundaciones/prompts.ts';
import { contextoHeredado } from '../../lib/fundaciones/relleno.ts';
import { FUNDACIONES } from '../../lib/fundaciones/herramientas.ts';

const codigo = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

/* ── ACÁ HABÍA UN LECTOR DE UN REPOSITORIO HERMANO ─────────────────────────
 *
 * `migracion()` leía `<raíz>/../migraciones/0NN.sql` y dos pruebas comprobaban el SQL de la `014` y
 * la `015`. Esos archivos **no están en este repositorio, ni en el disco de nadie**: el esquema
 * `public` se comparte con la plataforma anterior, así que sus migraciones viven en el otro
 * proyecto. Las dos pruebas venían ROJAS desde que se escribieron, en local y en la integración
 * continua — el mismo defecto que la `130` ya había pagado, con el mismo argumento: un rojo
 * permanente no se arregla, se ignora, y con él se ignoran los demás.
 *
 * Traer los archivos acá sería peor que no tenerlos: dos repositorios migrando el mismo esquema
 * compartido, y el orden de aplicación decidiendo quién gana.
 *
 * Lo que se pierde, dicho de frente: nadie comprueba desde acá el CONTENIDO de esas dos
 * migraciones. Lo que se conserva está abajo, y es lo que este repositorio de verdad controla —
 * la frontera y el contrato de lectura. */

/* Un recorte FIEL de la captura real de «Innat8 Technologies» (2026-09-10): el encabezado con el
   nombre, dos tarjetas del formulario con contenido, y una de la llamada que dice «Sin dato» porque
   todavía no hubo llamada de onboarding. Los acentos faltantes están como en el original. */
const HTML = `<div class="header"><div class="brandrow"><span class="wordmark">ARIA</span>
<span class="doctag">Perfil de Cliente · Uso interno</span></div>
<div class="clientname">Innat8 Technologies</div>
<span class="chip">✉ <b>miguel@innat8.com</b></span>
<span class="chip">País · <b>sin dato</b></span></div>
<div class="section form"><div class="sechead"><h2>Formulario Pre-Kickoff</h2></div>
<div class="grid"><div class="card"><h3><span class="ico">🏢</span> El negocio</h3><p>El cliente es consultor o implementador de IA, con 1 a 3 años operando bajo este modelo. Actualmente tiene entre 3 y 10 clientes activos.</p></div>
<div class="card"><h3><span class="ico">🎯</span> Oferta y posicionamiento</h3><p>Aun no tiene un nicho definido; promete un agente de inteligencia artificial conectado a un CRM con capacidad de responder, dar seguimiento y agendar.</p></div>
<div class="card full"><h3><span class="ico">📝</span> Resumen de la llamada</h3><p>Sin dato en la llamada.</p></div></div></div>`;

const CAPTURA = {
  version: 1,
  origen: 'aria_cc_icp_oferta',
  telefono: '7873670451',
  website: 'www.innat8.com',
  html: HTML,
};

function conOnboarding() {
  const estado = estadoVacio();
  estado.onboarding = leerOnboarding(CAPTURA);
  return estado;
}

test('la captura de Walter se lee: nombre del negocio, secciones con contenido, y datos sueltos', () => {
  const o = leerOnboarding(CAPTURA);
  assert.ok(o, 'no se pudo leer la captura');

  // El nombre del negocio es la respuesta a `t1-biz`, que es justo lo que el agente preguntaba.
  assert.equal(o.nombreDelNegocio, 'Innat8 Technologies');
  assert.equal(o.website, 'www.innat8.com');
  assert.equal(o.telefono, '7873670451');
  // El país llegó como «sin dato» en la captura, y eso NO es un valor.
  assert.equal(o.paisCiudad, null);

  // Las dos tarjetas con contenido, con su título sin el emoji del icono.
  assert.deepEqual(
    o.secciones.map((s) => s.titulo),
    ['El negocio', 'Oferta y posicionamiento'],
    'los títulos no salieron limpios, o entró una sección vacía',
  );
  const [negocio, oferta] = o.secciones;
  assert.ok(negocio && oferta);
  assert.match(negocio.texto, /consultor o implementador de IA/);
  assert.ok(!/<[a-z]/i.test(oferta.texto), 'quedaron etiquetas HTML dentro del texto');

  /* Y la de la llamada NO entra: «Sin dato en la llamada» es ausencia, no contenido. Meterla haría
     que el agente le contara a la persona que su llamada no tiene datos, que es ruido. */
  assert.ok(
    !o.secciones.some((s) => /Resumen de la llamada/.test(s.titulo)),
    'entró una sección que solo dice «sin dato»',
  );
});

test('el lector NUNCA lanza, y sin nada aprovechable devuelve `null`', () => {
  /* Es la propiedad que importa: el HTML lo genera un pipeline ajeno que puede cambiar de plantilla
     sin avisarnos. Un cambio allá no puede dejar a nadie sin poder abrir su ficha. */
  for (const basura of [null, undefined, 0, '', 'texto suelto', [], {}, { html: 12 }, { html: '<p>hola</p>' }]) {
    assert.equal(leerOnboarding(basura), null, `${JSON.stringify(basura)} debería dar null`);
  }
  // Con una sección reconocible alcanza, aunque falte todo lo demás.
  const minimo = leerOnboarding({ html: '<div class="card"><h3>El negocio</h3><p>Vende software.</p></div>' });
  assert.equal(minimo?.secciones.length, 1);
  assert.equal(minimo?.nombreDelNegocio, null);

  /* Pero los datos SUELTOS no alcanzan, y es un caso real: de las nueve capturas de producción una
     tiene solo el teléfono, de una conversación que se cortó antes de la síntesis. Con eso el agente
     abriría prometiendo datos precargados y sin ninguno de los siete campos. */
  assert.equal(leerOnboarding({ telefono: '7873670451' }), null);
  assert.equal(leerOnboarding({ website: 'x.com', pais_ciudad: 'Lima' }), null);
});

test('el contexto dice QUÉ es y DE DÓNDE viene, para que el agente lo pueda citar', () => {
  const texto = contextoDeOnboarding(leerOnboarding(CAPTURA));
  assert.ok(texto);
  // La procedencia es la mitad del pedido: el usuario le pregunta al chat por «sus datos».
  assert.match(texto, /FORMULARIO DE ONBOARDING/);
  assert.match(texto, /lo escribió ella misma/);
  assert.match(texto, /Innat8 Technologies/);
  assert.match(texto, /El negocio: /);
  assert.match(texto, /Oferta y posicionamiento: /);
  assert.ok(texto.length <= CARACTERES_DE_ONBOARDING, 'el contexto se pasó de su tope');

  // Sin onboarding no hay texto — y `null` es lo que hace que el bloque del SKILL se omita entero.
  assert.equal(contextoDeOnboarding(null), null);
});

test('«Tu ficha» lo recibe en su prompt Y en el contexto del agente, que son el mismo dato', () => {
  const ficha = FUNDACIONES[0];
  assert.ok(ficha && ficha.id === 0, 'la primera herramienta del método dejó de ser Tu ficha');

  // 1 · El constructor de datos de la ficha lo produce.
  const datos = datosDe(0, {}, conOnboarding());
  assert.match(String(datos['_onboardingContext']), /Innat8 Technologies/);

  // 2 · El prompt lo interpola, y el SKILL trae el bloque condicional que lo envuelve.
  const prompt = armarPrompt(0, {}, conOnboarding());
  assert.match(prompt, /FORMULARIO DE ONBOARDING/);
  assert.match(prompt, /consultor o implementador de IA/);
  assert.doesNotMatch(prompt, /\{\{[\w.#^/]+\}\}/, 'el prompt de la ficha dejó una variable sin resolver');

  // 3 · Y el AGENTE lee exactamente lo mismo: `contextoHeredado` sale del mismo constructor, así que
  //     lo que el chat propone y lo que la generación usa no pueden divergir.
  assert.match(contextoHeredado(ficha, conOnboarding()), /Innat8 Technologies/);

  /* Sin onboarding —una cuenta creada a mano desde Ajustes— no queda ni el rótulo ni un hueco: el
     bloque desaparece y la ficha se trabaja conversando, como antes. */
  const sin = armarPrompt(0, {}, estadoVacio());
  assert.doesNotMatch(sin, /FORMULARIO DE ONBOARDING/);
  assert.doesNotMatch(sin, /\{\{[\w.#^/]+\}\}/);
  assert.equal(contextoHeredado(ficha, estadoVacio()), '');
});

test('las preguntas y respuestas del chat de Walter llegan textuales, sin los botones del formulario', () => {
  /* Kevin (2026-09-12): «¿estamos trayendo el jsonb de chat_history? ¿el agente toma conciencia de
     esas preguntas y respuestas?». Un recorte fiel del chat de Innat8: la pregunta viene con los
     botones del formulario incrustados, y la respuesta es la opción elegida. */
  const chat = {
    messages: [
      { role: 'ARIA', content: '¡Hola! Cuéntame, ¿cuál es tu modelo de negocio actual?\n\n[BOTONES:UNICA]\nAgencia\nConsultor de IA\nOtro\n[/BOTONES]\n[BLOQUE: 1]' },
      { role: 'Cliente', content: 'Consultor o implementador de IA' },
      { role: 'ARIA', content: 'Perfecto. ¿Cuánto cobras típicamente por el setup?\n\n[BOTONES:UNICA]\n$1,000–$3,000\n[/BOTONES]' },
      { role: 'Cliente', content: '$1,000–$3,000' },
      { role: 'ARIA', content: 'Si quieres agregar algo, escríbelo. Si no, escribe "listo" y seguimos.' },
      { role: 'Cliente', content: 'Listo' },
      { role: 'ARIA', content: 'Listo, Miguel. Todo arranca en esa llamada. [ONBOARDING_COMPLETO]' },
    ],
  };
  const pares = paresDelChat(chat);
  assert.deepEqual(pares, [
    { pregunta: '¡Hola! Cuéntame, ¿cuál es tu modelo de negocio actual?', respuesta: 'Consultor o implementador de IA' },
    { pregunta: 'Perfecto. ¿Cuánto cobras típicamente por el setup?', respuesta: '$1,000–$3,000' },
  ]);
  // Los botones y las marcas NO quedan en ningún lado, y la transición «listo» no cuenta.
  assert.ok(!JSON.stringify(pares).includes('BOTONES') && !JSON.stringify(pares).includes('BLOQUE'));
  // Tolerante: sin chat, o con otra forma, cero pares y ninguna excepción.
  assert.deepEqual(paresDelChat(null), []);
  assert.deepEqual(paresDelChat('x'), []);
  assert.deepEqual(paresDelChat([{ role: 'user', content: 'suelto' }]), []);

  // Y entran al contexto del agente, después de la síntesis y marcadas como textuales.
  const o = leerOnboarding({ ...CAPTURA, chat_history: chat });
  assert.equal(o?.respuestas.length, 2);
  const texto = contextoDeOnboarding(o);
  assert.ok(texto);
  assert.match(texto, /PREGUNTAS DEL FORMULARIO Y LO QUE CONTESTÓ, TEXTUAL:/);
  assert.match(texto, /→ Consultor o implementador de IA/);
  assert.ok(texto.indexOf('El negocio:') < texto.indexOf('PREGUNTAS DEL FORMULARIO'), 'las respuestas van antes que la síntesis');
  // Con solo el chat —sin HTML— también hay onboarding: es lo que la persona dijo.
  assert.equal(leerOnboarding({ chat_history: chat })?.respuestas.length, 2);
});

test('el agente deduce el problema y el resultado del cliente desde lo que la oferta promete', () => {
  /* Kevin, con captura de Innat8 (2026-09-12): el agente dejaba «me falta: ¿cuál es el mayor problema
     de tu cliente? · ¿qué resultado obtienen contigo?» con la oferta a la vista. El formulario de
     Walter nunca pregunta por el cliente final, así que esos dos solo salen por deducción — y la
     instrucción tiene que pedirla con todas las letras, marcada como propuesta. */
  const relleno = codigo('lib/fundaciones/relleno.ts');
  assert.match(relleno, /Si el contexto es un FORMULARIO DE ONBOARDING, deducí el problema del cliente y el resultado/);
  assert.match(relleno, /Solo dejalos vacíos si la oferta no dice qué hace/);
});

test('las respuestas del FINAL del formulario llegan al agente: el recorte por fuente no aplica al onboarding', () => {
  /* Kevin, registrado como «Allpa» (2026-09-12): la ficha le pedía el problema y el resultado del
     cliente, que él había contestado en el formulario. Un onboarding del tamaño real —cinco
     secciones y 27 pares— mide ~6.900 caracteres; el recorte genérico de 3.000 por fuente dejaba
     pasar CUATRO pares y tiraba los 23 restantes, con lo que la persona eligió al final. Esta
     prueba construye ese tamaño y exige que la última respuesta llegue al contexto del agente. */
  const ficha = FUNDACIONES[0];
  const messages: { role: string; content: string }[] = [];
  for (let i = 1; i <= 27; i += 1) {
    messages.push({ role: 'ARIA', content: `Pregunta ${i} del formulario, ¿qué elegís?\n\n[BOTONES:UNICA]\nA\nB\n[/BOTONES]` });
    messages.push({ role: 'Cliente', content: `Respuesta ${i}: ${'lo que la persona eligió '.repeat(4)}` });
  }
  messages.push({ role: 'ARIA', content: '¿Cuál es el mayor problema que le resolvés a tu cliente?' });
  messages.push({ role: 'Cliente', content: 'Pierden citas porque nadie responde a tiempo' });

  const estado = estadoVacio();
  estado.onboarding = leerOnboarding({ ...CAPTURA, chat_history: { messages } });
  const completo = contextoDeOnboarding(estado.onboarding);
  assert.ok(completo && completo.length > 3_000, 'el onboarding de prueba tiene que superar el recorte genérico');

  const contexto = contextoHeredado(ficha, estado);
  assert.match(contexto, /Pierden citas porque nadie responde a tiempo/, 'la última respuesta del formulario no llegó al agente');
  assert.equal(contexto, completo, 'el contexto de la ficha tiene que ser el onboarding entero, no un recorte');
});

test('el almacén lee la columna `intake` con el lector tolerante', () => {
  assert.equal(LLAVES.onboarding, 'intake', 'cambió el nombre de la columna del onboarding');
  assert.equal(estadoVacio().onboarding, null, 'el estado vacío ya no nace sin onboarding');

  const almacen = sinComentarios(codigo('lib/fundaciones/almacen.ts'));
  assert.match(almacen, /LLAVES\.onboarding,/, 'el select del estado dejó de pedir la columna');
  assert.match(almacen, /estado\.onboarding = leerOnboarding\(fila\[LLAVES\.onboarding\]\)/);
});

test('«Traer del onboarding»: el plan B manual, solo en «Tu ficha», y la empresa sale de la sesión', () => {
  /* Kevin (2026-09-10): «¿habrá algún botón para jalar del onboarding, por si acaso, como una opción
     B, y no depender de que se extraiga solito?». Aprobado sobre mockup. Tres piezas, y cada una tiene
     su propia forma de fallar en silencio. */

  // 1 · La ruta: portero, contexto de organización, y la función de la base. Nada más.
  const ruta = sinComentarios(codigo('app/api/fundaciones/onboarding/route.ts'));
  assert.match(ruta, /exigir\(peticion, \['fundaciones\.editar'\], PANTALLA\)/, 'la ruta no pide editar');
  assert.match(ruta, /conOrganizacion\(contexto\.orgEfectiva/);
  assert.match(ruta, /select public\.aria_cc_traer_onboarding\(\) as r/);
  assert.ok(!/aria_cc_icp_oferta/.test(ruta), 'la ruta lee la tabla de Walter directamente: eso es de la función');
  assert.ok(!/conIdentidad/.test(ruta));

  /* 2 · La llamada va SIN ARGUMENTOS, y es lo único de la función que este repositorio controla.
   *
   * La función vive en el otro proyecto (ver la nota de arriba), pero de qué empresa trae los datos
   * se decide acá: sin parámetro, la función sólo puede mirar `app.org_id` —la empresa que el
   * contexto ya abrió— y no hay nada que un llamador pueda pasarle para pedir la de otro. El día
   * que alguien le agregue un argumento «por comodidad», esto salta. */
  assert.match(ruta, /aria_cc_traer_onboarding\(\)/, 'la función dejó de llamarse sin argumentos');
  assert.ok(
    !/aria_cc_traer_onboarding\(\s*[^)\s]/.test(ruta),
    'la llamada pasó a recibir un parámetro: la empresa dejó de salir de la sesión',
  );

  // 3 · El panel: la línea existe, solo para la ficha, y remonta el chat después de traer.
  const panel = codigo('components/fundaciones/PanelHerramienta.jsx');
  assert.match(panel, /const esLaFicha = herramienta\.id === 0 && !!rutaOnboarding;/);
  assert.match(panel, /className=\{`fd-onboarding /);
  assert.match(panel, /Traer del onboarding/);
  assert.match(panel, /Esta empresa no tiene formulario de onboarding guardado/, 'sin formulario no se distingue de un error');
  assert.match(panel, /key=\{`chat-\$\{reinicios\}`\}/, 'después de traer, el chat no vuelve a abrir proponiendo');
  assert.match(panel, /await onEstadoCambiado\(\);\s*\n\s*setReinicios/, 'remonta el chat ANTES de recargar el estado');

  // Y solo ICP & Oferta pasa la ruta: en Tools no hay ficha.
  assert.match(codigo('components/fundaciones/Fundaciones.jsx'), /rutaOnboarding: '\/api\/fundaciones\/onboarding'/);
  assert.ok(!/rutaOnboarding/.test(codigo('components/views/ToolsView.jsx')));

  // La fecha que muestra la línea viene de la captura.
  assert.equal(leerOnboarding({ ...CAPTURA, capturado_el: '2026-09-10T16:22:46Z' })?.capturadoEl, '2026-09-10T16:22:46Z');
  assert.equal(leerOnboarding(CAPTURA)?.capturadoEl, null);
});

test('la frontera con el repositorio de Walter se respeta, y el contrato de lectura no se mueve', async () => {
  /* Lo que reemplaza a la prueba que leía la `014` del repositorio hermano. Son las dos mitades que
     SÍ se pueden afirmar desde acá, y cada una impide un defecto distinto. */

  /* ── 1 · La frontera ───────────────────────────────────────────────────────
   *
   * `public.aria_cc_icp_oferta` es la tabla donde el formulario de Walter deposita la captura, y se
   * migra desde el otro proyecto. Si una migración de ESTE repositorio la creara, la alterara o le
   * colgara un disparador, la tabla quedaría con dos dueños y el orden en que se apliquen decidiría
   * cuál gana — que es exactamente el defecto que la `130` documentó para `aria_cc_foundations`. */
  const { readdirSync } = await import('node:fs');
  const migraciones = readdirSync(join(RAIZ, 'db/migraciones')).filter((f) => f.endsWith('.sql'));
  assert.ok(migraciones.length > 30, `solo ${migraciones.length} migraciones: la lista cambió de sitio`);

  const invasoras = migraciones.filter((f) =>
    /(create|alter|drop)\s+(table|trigger|function)[^;]*aria_cc_(icp_oferta|traer_onboarding)/i.test(
      sinComentarios(codigo(join('db/migraciones', f))),
    ),
  );
  assert.deepEqual(
    invasoras,
    [],
    'una migración de este repositorio toca la captura de Walter, que se migra desde el otro ' +
      'proyecto: quedan dos dueños para una misma tabla',
  );

  /* ── 2 · El contrato de lectura ────────────────────────────────────────────
   *
   * De la forma que el disparador escribe en `intake`, el lector de acá depende de CINCO claves. El
   * defecto que esto impide es el que no se ve: `leerOnboarding` devuelve un objeto igual de válido
   * cuando una clave no se entiende —el campo queda en `null`— así que renombrar `pais_ciudad` a
   * `ciudad` no rompe nada, no tira ningún error, y deja al agente preguntando lo que ya sabe. Que
   * es textualmente el reporte de Walter con el que empieza este archivo.
   *
   * `captura_id` NO está en la lista a propósito: el disparador la escribe y este lector no la usa.
   * Meterla acá afirmaría una dependencia que no existe. */
  const conTodo = {
    ...CAPTURA,
    pais_ciudad: 'San Juan, Puerto Rico',
    capturado_el: '2026-09-10T16:22:46Z',
  };
  for (const clave of ['html', 'telefono', 'pais_ciudad', 'website', 'capturado_el']) {
    const sinEsa: Record<string, unknown> = { ...conTodo };
    delete sinEsa[clave];
    assert.notDeepEqual(
      leerOnboarding(sinEsa),
      leerOnboarding(conTodo),
      `quitar «${clave}» no cambió nada de lo leído: el lector dejó de depender de esa clave, ` +
        'así que el disparador puede renombrarla y nadie se entera',
    );
  }
});
