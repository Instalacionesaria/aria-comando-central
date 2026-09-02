// El agente conversacional del Research. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE PERSIGUE ACÁ: DOS CAMINOS QUE DEJAN DE LLEVAR AL MISMO LUGAR
//
// La pantalla del Research tiene un formulario y un agente que hace las mismas preguntas. Todo lo
// que puede salir mal tiene la misma forma —y es la del resto de Fundaciones—: **nada falla**.
//
//   · El agente pregunta cuatro criterios porque el quinto se agregó al formulario y no a él. Los
//     cinco pasos corren igual y el research sale genérico.
//   · El agente devuelve `listo` y el servidor le cree: cinco generaciones con búsqueda web sobre
//     criterios a medias, ya pagadas, sin que nadie haya confirmado nada.
//   · El agente inventa una clave (`nicho` en vez de `niche`) y el criterio entra al almacén con un
//     nombre que el prompt del paso 1 no interpola. El documento sale con un hueco.
//   · La conversación se guarda con el turno de la persona y sin el del agente, y el próximo turno
//     le manda al modelo dos mensajes seguidos de la persona.
//
// No toca la base, no llama a ningún modelo —el `fetch` se intercepta— y corre en milisegundos.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ } from '../apoyo/fuente.ts';
import { camposDe, claveCorta, obligatoriosQueFaltan } from '../../lib/fundaciones/campos.ts';
import { FUNDACIONES, herramienta } from '../../lib/fundaciones/herramientas.ts';
import {
  NOMBRE_DE_LA_HERRAMIENTA,
  TECHO_DE_TOKENS,
  TURNOS_QUE_VE_EL_MODELO,
  arranca,
  conversar,
  esquemaDeCriterios,
  instruccionesDeEntrevista,
  mensajeDeApertura,
} from '../../lib/fundaciones/conversacion.ts';
import { MODELO } from '../../lib/fundaciones/generacion.ts';

const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

/** La herramienta del Research. Se busca por `forma` y no por el número: el número es del hub. */
const RESEARCH = FUNDACIONES.find((h) => h.forma === 'research');

const CRITERIOS_COMPLETOS = {
  niche: 'Agencias de Marketing',
  buyers: '50,000+',
  ltv: '$3,000+',
  contract: '',
  experience: 'Consultor de agencias, IA y ventas high ticket',
};

test('el agente entrevista sobre LA herramienta del Research, no sobre un número escrito a mano', () => {
  assert.ok(RESEARCH, 'no hay ninguna herramienta con `forma: research`');
  // El id sigue siendo el del hub, y se afirma para que renumerarlo se vea acá también.
  assert.equal(RESEARCH.id, 1);
  assert.equal(herramienta(1)?.forma, 'research');
});

// ─── Las preguntas se derivan, no se escriben ───────────────────────────────

test('el esquema tiene EXACTAMENTE los campos del formulario, con sus claves cortas', () => {
  /* Es la afirmación central del archivo. Si el esquema y el formulario dejan de coincidir, los dos
     caminos de la pantalla juntan cosas distintas y el research sale de criterios que dependen de
     por qué botón se entró — con las dos pantallas viéndose perfectas. */
  const esquema = esquemaDeCriterios(RESEARCH!);
  const criterios = (esquema['properties'] as Record<string, Record<string, unknown>>)['criterios']!;
  const propiedades = Object.keys(criterios['properties'] as Record<string, unknown>).sort();
  const esperadas = camposDe(RESEARCH!).map((c) => claveCorta(c.id)).sort();

  assert.deepEqual(propiedades, esperadas);
  // Y las mismas claves que usa el almacén: son las que interpola `armarPromptResearch`.
  assert.deepEqual(esperadas, ['buyers', 'contract', 'experience', 'ltv', 'niche']);
});

test('los cinco criterios son OBLIGATORIOS en el esquema, y la cadena vacía es el "todavía no"', () => {
  /* Con criterios opcionales, cada turno devuelve un pedazo y el servidor tiene que mezclarlo con lo
     anterior — y una mezcla no distingue «no lo repetí» de «lo borré». La persona que pide sacar un
     dato deja un criterio que ya no se puede vaciar. */
  const esquema = esquemaDeCriterios(RESEARCH!);
  const criterios = (esquema['properties'] as Record<string, Record<string, unknown>>)['criterios']!;
  assert.deepEqual(
    [...(criterios['required'] as string[])].sort(),
    camposDe(RESEARCH!).map((c) => claveCorta(c.id)).sort(),
  );
  assert.equal(criterios['additionalProperties'], false);

  // Y el turno entero: sin `mensaje` no hay nada que mostrar, sin `listo` no se puede decidir.
  assert.deepEqual([...(esquema['required'] as string[])].sort(), ['criterios', 'listo', 'mensaje']);
});

test('las instrucciones llevan la etiqueta de cada campo, y no una redacción propia', () => {
  const texto = instruccionesDeEntrevista(RESEARCH!, {});
  for (const campo of camposDe(RESEARCH!)) {
    assert.ok(
      texto.includes(campo.etiqueta),
      `la pregunta de \`${campo.id}\` no sale de su etiqueta: el chat y el formulario preguntan ` +
        'cosas distintas',
    );
    assert.ok(texto.includes(`[${claveCorta(campo.id)}]`), `falta la clave de \`${campo.id}\``);
  }
});

test('lo opcional se puede saltear y lo obligatorio no, y eso sale del catálogo', () => {
  const texto = instruccionesDeEntrevista(RESEARCH!, {});
  const lineas = texto.split('\n');

  for (const campo of camposDe(RESEARCH!)) {
    const i = lineas.findIndex((l) => l.includes(`[${claveCorta(campo.id)}]`));
    assert.ok(i >= 0, `no está la línea de \`${campo.id}\``);
    const bloque = lineas.slice(i, i + 3).join('\n');
    if (campo.opcional) {
      assert.match(bloque, /OPCIONAL/, `\`${campo.id}\` es opcional y el agente va a insistir`);
    } else if (campo.valorPorOmision) {
      assert.ok(
        bloque.includes(campo.valorPorOmision),
        `\`${campo.id}\` tiene valor por omisión y el agente no lo sabe: va a insistir por un dato ` +
          'que el formulario da por respondido',
      );
    } else {
      assert.match(bloque, /OBLIGATORIA/, `\`${campo.id}\` se puede saltear y no debería`);
    }
  }
});

test('las instrucciones dicen lo que YA se sabe: el estado no vive en el historial', () => {
  /* Al modelo se le manda la cola de la conversación, no la conversación entera. Lo que hace que
     recortarla no pierda nada es que los criterios viajan enteros en cada llamada. Sin esto, el
     agente vuelve a preguntar el nicho en el turno veintiuno. */
  const texto = instruccionesDeEntrevista(RESEARCH!, CRITERIOS_COMPLETOS);
  assert.ok(texto.includes('Agencias de Marketing'));
  assert.ok(texto.includes('(todavía no)'), 'un criterio vacío no se distingue de uno contestado');
  assert.ok(TURNOS_QUE_VE_EL_MODELO > 0);
});

test('el saludo NO gasta una inferencia, y dice la primera etiqueta del formulario', () => {
  const primera = camposDe(RESEARCH!)[0]!;
  const deCero = mensajeDeApertura(RESEARCH!, {});
  assert.ok(
    deCero.includes(primera.etiqueta),
    'el saludo no arranca con la primera pregunta del formulario',
  );

  // Con criterios guardados, los muestra y pregunta: es el caso de quien ya llenó el formulario.
  const conLoGuardado = mensajeDeApertura(RESEARCH!, { niche: 'Agencias de Marketing' });
  assert.ok(conLoGuardado.includes('Agencias de Marketing'));
  assert.ok(!conLoGuardado.includes('(no especificado)'), 'el hueco del almacén llegó al saludo');
});

// ─── La decisión de arrancar es del servidor ────────────────────────────────

test('sin un criterio obligatorio NO se arranca, aunque el modelo diga que sí', () => {
  const sinTrasfondo = { ...CRITERIOS_COMPLETOS, experience: '' };
  assert.equal(
    arranca(RESEARCH!, { mensaje: 'arranco', criterios: sinTrasfondo, listo: true }, sinTrasfondo),
    false,
    'cinco generaciones con búsqueda web sobre criterios incompletos, ya pagadas',
  );

  // Y la regla es la MISMA que la del botón del formulario, no una copia parecida.
  const porId: Record<string, string> = {};
  for (const campo of camposDe(RESEARCH!)) porId[campo.id] = sinTrasfondo[claveCorta(campo.id) as keyof typeof sinTrasfondo] ?? '';
  assert.deepEqual(
    obligatoriosQueFaltan(RESEARCH!, porId).map((c) => c.id),
    ['mr-experience'],
  );
});

test('no se arranca en el MISMO turno en que se completó el último criterio', () => {
  /* La confirmación deja de ser una regla de buena voluntad del prompt y pasa a ser estructural: si
     el último dato llegó recién en este turno, este es el turno en que el agente puede resumir — no
     puede ser también el turno en que la persona ya dijo que sí.

     El modelo se puede equivocar con la regla del prompt. Con esto, equivocarse cuesta un turno
     más; sin esto, cuesta cinco generaciones. */
  const previos = { ...CRITERIOS_COMPLETOS, experience: '' };
  assert.equal(
    arranca(
      RESEARCH!,
      { mensaje: 'listo, arranco', criterios: CRITERIOS_COMPLETOS, listo: true },
      previos,
    ),
    false,
  );

  // Con los criterios ya completos ANTES del turno, el `listo` se respeta.
  assert.equal(
    arranca(
      RESEARCH!,
      { mensaje: 'dale, arranco', criterios: CRITERIOS_COMPLETOS, listo: true },
      CRITERIOS_COMPLETOS,
    ),
    true,
  );

  // Y sin `listo` no se arranca nunca, por completos que estén los criterios.
  assert.equal(
    arranca(
      RESEARCH!,
      { mensaje: '¿arranco?', criterios: CRITERIOS_COMPLETOS, listo: false },
      CRITERIOS_COMPLETOS,
    ),
    false,
  );
});

// ─── La llamada ────────────────────────────────────────────────────────────

function respuestaCon(entrada: unknown, stop = 'tool_use'): () => Response {
  return () =>
    new Response(
      JSON.stringify({
        content: [{ type: 'tool_use', name: NOMBRE_DE_LA_HERRAMIENTA, input: entrada }],
        stop_reason: stop,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
}

async function llamando(
  respuesta: () => Response,
  mensajes: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'assistant', content: 'hola' },
    { role: 'user', content: 'agencias de marketing' },
  ],
) {
  const peticiones: { url: string; cuerpo: Record<string, unknown>; cabeceras: Headers }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    peticiones.push({
      url: String(url),
      cuerpo: JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<
        string,
        unknown
      >,
      cabeceras: new Headers(init?.headers),
    });
    return respuesta();
  }) as typeof globalThis.fetch;
  try {
    const salida = await conversar({
      claveIa: 'sk-de-prueba',
      herramienta: RESEARCH!,
      mensajes,
      criterios: {},
    });
    return { salida, peticiones };
  } finally {
    globalThis.fetch = original;
  }
}

test('el cuerpo lleva los campos que la API espera, y la herramienta se FUERZA', async () => {
  const { peticiones } = await llamando(
    respuestaCon({ mensaje: '¿y tu trasfondo?', criterios: CRITERIOS_COMPLETOS, listo: false }),
  );
  assert.equal(peticiones.length, 1);
  const p = peticiones[0]!;

  assert.equal(p.url, 'https://api.anthropic.com/v1/messages');
  assert.deepEqual(Object.keys(p.cuerpo).sort(), [
    'max_tokens',
    'messages',
    'model',
    'system',
    'tool_choice',
    'tools',
  ]);
  // El mismo modelo que la generación que este chat alimenta: un alumno no puede terminar con un
  // research hecho por un modelo y unos criterios entendidos por otro.
  assert.equal(p.cuerpo['model'], MODELO);
  assert.equal(p.cuerpo['max_tokens'], TECHO_DE_TOKENS);
  assert.equal(p.cabeceras.get('x-api-key'), 'sk-de-prueba');
  assert.equal(p.cabeceras.get('anthropic-version'), '2023-06-01');

  // Forzada, y una sola: sin esto el modelo puede contestar texto libre y no hay criterios que leer.
  assert.deepEqual(p.cuerpo['tool_choice'], { type: 'tool', name: NOMBRE_DE_LA_HERRAMIENTA });
  const herramientas = p.cuerpo['tools'] as { name?: string; input_schema?: unknown }[];
  assert.equal(herramientas.length, 1);
  assert.equal(herramientas[0]?.name, NOMBRE_DE_LA_HERRAMIENTA);
  assert.ok(herramientas[0]?.input_schema);

  // Y NO se declara búsqueda web: el agente pregunta, no investiga. Una búsqueda por turno es una
  // cuenta que nadie pidió, y minutos de espera en un chat.
  assert.ok(!('tools' in p.cuerpo && JSON.stringify(p.cuerpo['tools']).includes('web_search')));
});

test('al modelo se le manda la COLA de la conversación, no toda', async () => {
  const largos = Array.from({ length: TURNOS_QUE_VE_EL_MODELO + 8 }, (_, i) => ({
    role: (i % 2 === 0 ? 'assistant' : 'user') as 'assistant' | 'user',
    content: `turno ${i}`,
  }));
  const { peticiones } = await llamando(
    respuestaCon({ mensaje: 'ok', criterios: CRITERIOS_COMPLETOS, listo: false }),
    largos,
  );
  const enviados = peticiones[0]!.cuerpo['messages'] as { content: string }[];
  assert.equal(enviados.length, TURNOS_QUE_VE_EL_MODELO);
  // Los últimos, no los primeros: lo que se recorta es el principio.
  assert.equal(enviados[enviados.length - 1]?.content, `turno ${largos.length - 1}`);
});

test('una clave inventada no entra, y un criterio que no vino queda vacío', async () => {
  /* Se recorre el CATÁLOGO y no lo que vino. Una clave inventada en el almacén es un criterio que
     el prompt del paso 1 no interpola: el documento sale con un hueco y nada falla. */
  const { salida } = await llamando(
    respuestaCon({
      mensaje: 'anotado',
      criterios: { nicho: 'Agencias', niche: 'Agencias de Marketing' },
      listo: false,
    }),
  );
  assert.equal(salida.tipo, 'datos');
  if (salida.tipo !== 'datos') return;
  assert.deepEqual(Object.keys(salida.datos.criterios).sort(), [
    'buyers',
    'contract',
    'experience',
    'ltv',
    'niche',
  ]);
  assert.equal(salida.datos.criterios['niche'], 'Agencias de Marketing');
  assert.equal(salida.datos.criterios['buyers'], '');
});

test('un turno sin mensaje NO es un turno: la pantalla no muestra una burbuja en blanco', async () => {
  const { salida } = await llamando(
    respuestaCon({ mensaje: '   ', criterios: CRITERIOS_COMPLETOS, listo: true }),
  );
  assert.equal(salida.tipo, 'sin_estructura');
});

test('el corte por techo se distingue de una estructura ilegible', async () => {
  /* Un truncado leído como esquema inválido manda a revisar el esquema en vez de subir el techo.
     Es la misma lección que ya está escrita en el auditor y en la generación. */
  const { salida } = await llamando(
    respuestaCon({ mensaje: 'a medio decir', criterios: {}, listo: false }, 'max_tokens'),
  );
  assert.equal(salida.tipo, 'truncado');
});

// ─── Lo que el servidor escribe, leído del código ───────────────────────────

test('el historial NO viaja por el navegador', () => {
  /* La segunda mitad de la comprobación de `arranca`: si el cliente pudiera mandar la conversación,
     podría mandar una en la que la persona ya confirmó, y `listo` saldría en true en el primer
     turno. El navegador manda UNA línea. */
  const chat = leer('components/fundaciones/ChatDeResearch.jsx');
  assert.match(chat, /cuerpo:\s*\{\s*herramienta:\s*herramienta\.id,\s*\.\.\.cuerpo\s*\}/);
  assert.ok(
    !/mensajes\s*:/.test(chat.replace(/setMensajes|mensajes\.map|const \[mensajes/g, '')),
    'el navegador le está mandando el historial al servidor',
  );

  const operaciones = leer('lib/fundaciones/operaciones.ts');
  // El manejador lee del almacén y solo acepta `herramienta`, `mensaje` y `reiniciar`.
  assert.match(
    operaciones,
    /cuerpo: \{ herramienta\?: unknown; mensaje\?: unknown; reiniciar\?: unknown \}/,
  );
});

test('si el modelo falla no se guarda nada, ni siquiera el turno de la persona', () => {
  /* Guardarlo dejaría la conversación terminando en una pregunta sin respuesta, y el próximo turno
     le mandaría al modelo dos mensajes seguidos de la persona. Y el texto que la pantalla muestra
     en ese caso —«no se perdió nada de lo que escribiste»— sería falso. */
  const fuente = leer('lib/fundaciones/operaciones.ts');
  const i = fuente.indexOf('export async function conversarConElAgente');
  assert.ok(i > 0, 'se renombró el manejador de la conversación');
  const cuerpo = fuente.slice(i);

  const fallo = cuerpo.indexOf('if (salida.tipo !== \'datos\') return rechazoDeConversacion(salida);');
  const guarda = cuerpo.indexOf('guardarChatDeResearch(acceso.clienteId, proximo)');
  assert.ok(fallo > 0 && guarda > fallo, 'el chat se guarda antes de saber si el modelo respondió');
});

test('la pantalla arranca los pasos con los valores del turno, no con los del estado', () => {
  /* El defecto del hub, entrando por la puerta de al lado: `setState` es asíncrono, así que arrancar
     con los valores del estado justo después de recibirlos del agente los lee un render antes de que
     existan — y los cinco pasos se generan sobre criterios vacíos, con el documento saliendo igual. */
  const panel = leer('components/fundaciones/PanelResearch.jsx');
  assert.match(panel, /const correrPaso = async \(paso, v = valores\)/);
  assert.match(panel, /const correrTodo = async \(v = valores\)/);
  assert.match(panel, /await correrTodo\(v\)/, 'el arranque desde el agente no pasa los valores');

  /* Y los manejadores no pasan el evento de React donde van los valores: `onClick={correrTodo}` le
     entregaría un `SyntheticEvent` a `correrPaso`, que lo mandaría como `valores` en el cuerpo. */
  assert.ok(!/onClick=\{correrTodo\}/.test(panel));
  assert.ok(!/onClick=\{guardar\}/.test(panel));
});
