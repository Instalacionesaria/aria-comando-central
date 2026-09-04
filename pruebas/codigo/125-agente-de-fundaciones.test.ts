// El agente conversacional de las nueve herramientas. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE PERSIGUE ACÁ: DOS CAMINOS QUE DEJAN DE LLEVAR AL MISMO LUGAR
//
// Cada herramienta tiene un formulario y un agente que hace las mismas preguntas. Todo lo que puede
// salir mal tiene la misma forma —y es la del resto de Fundaciones—: **nada falla**.
//
//   · El agente de una herramienta pregunta siete campos porque el octavo se agregó al formulario y
//     no a él. El entregable se genera igual, sin ese dato, y se ve bien.
//   · El agente devuelve `listo` y el servidor le cree: una generación de miles de tokens sobre
//     respuestas a medias, ya pagada, sin que nadie haya confirmado nada.
//   · El agente inventa una clave (`nicho` en vez de `niche`) y la respuesta entra al almacén con un
//     nombre que la plantilla no interpola. El documento sale con un hueco.
//   · El agente escribe «b2c» en un desplegable del VSL, donde el valor válido es otro. El
//     `SKILL.md` deriva `_isB2C` del principio de la cadena, la rama no se enciende, y el video sale
//     con el molde equivocado.
//   · La conversación se guarda con el turno de la persona y sin el del agente, y el próximo turno
//     le manda al modelo dos mensajes seguidos de la persona.
//
// Las afirmaciones se hacen sobre TODAS las herramientas con agente, no sobre una: un recorrido y no
// un ejemplo, porque el ejemplo pasa a estar bien justo en la que alguien miró.
//
// No toca la base, no llama a ningún modelo —el `fetch` se intercepta— y corre en milisegundos.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ } from '../apoyo/fuente.ts';
import { camposDe, claveCorta, obligatoriosQueFaltan } from '../../lib/fundaciones/campos.ts';
import {
  FUNDACIONES,
  TOOLS,
  herramienta,
  tieneAgente,
  type Herramienta,
} from '../../lib/fundaciones/herramientas.ts';
import {
  NOMBRE_DE_LA_HERRAMIENTA,
  TECHO_DE_TOKENS,
  TURNOS_QUE_VE_EL_MODELO,
  arranca,
  conversar,
  esquemaDeRespuestas,
  instruccionesDeEntrevista,
  mensajeDeApertura,
} from '../../lib/fundaciones/conversacion.ts';
import { MODELO } from '../../lib/fundaciones/generacion.ts';

const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

/** Las nueve con agente, de las dos pantallas. Se recorren TODAS en cada afirmación. */
const CON_AGENTE: readonly Herramienta[] = [...FUNDACIONES, ...TOOLS].filter(tieneAgente);

/** El Research, que es la única con obligatorias y con cinco pasos en vez de un documento. */
const RESEARCH = FUNDACIONES.find((h) => h.forma === 'research')!;

/** Un juego de respuestas completo para una herramienta: cada campo con algo adentro. */
function respuestasCompletas(h: Herramienta): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const campo of camposDe(h)) {
    /* En las listas se elige la primera opción CON valor: algunas abren con un «Selecciona…» cuyo
       valor es la cadena vacía, y tomarlo dejaría el campo en «todavía no» sin que se note. */
    const conValor = campo.opciones?.find((o) => o.valor !== '');
    salida[claveCorta(campo.id)] =
      campo.tipo === 'lista' && conValor ? conValor.valor : `respuesta de ${campo.id}`;
  }
  return salida;
}

test('el agente lo tienen las nueve de formulario, y Prospección NO', () => {
  const conAgente = CON_AGENTE.map((h) => h.pestania).sort();
  assert.equal(conAgente.length, 9, `son nueve y hay ${conAgente.length}: ${conAgente.join(', ')}`);

  /* Prospección queda afuera a propósito y con su motivo: su formulario no produce un documento,
     dispara un scraping que gasta leads del monedero. La afirmación es literal para que sacarla de
     la excepción sea una decisión y no un efecto de tocar `tieneAgente`. */
  const sinAgente = [...FUNDACIONES, ...TOOLS].filter((h) => !tieneAgente(h));
  assert.deepEqual(sinAgente.map((h) => h.clave), ['prospeccion']);

  // Y el Research sigue siendo el de los cinco pasos, con el id del hub.
  assert.equal(RESEARCH.id, 1);
  assert.equal(herramienta(1)?.forma, 'research');
});

// ─── Las preguntas se derivan, no se escriben ───────────────────────────────

test('el esquema de cada herramienta tiene EXACTAMENTE sus campos, con sus claves cortas', () => {
  /* Es la afirmación central del archivo. Si el esquema y el formulario dejan de coincidir, los dos
     caminos de una pantalla juntan cosas distintas y el entregable sale de respuestas que dependen
     de por qué botón se entró — con las dos vistas viéndose perfectas. */
  for (const h of CON_AGENTE) {
    const esquema = esquemaDeRespuestas(h);
    const bloque = (esquema['properties'] as Record<string, Record<string, unknown>>)['respuestas']!;
    const propiedades = Object.keys(bloque['properties'] as Record<string, unknown>).sort();
    const esperadas = camposDe(h).map((c) => claveCorta(c.id)).sort();

    assert.deepEqual(propiedades, esperadas, `el esquema de «${h.pestania}» no son sus campos`);
    // Todas obligatorias: cada turno trae el estado completo, así no hay que mezclar con lo anterior.
    assert.deepEqual([...(bloque['required'] as string[])].sort(), esperadas);
    assert.equal(bloque['additionalProperties'], false);
    // Y el turno entero: sin `mensaje` no hay nada que mostrar, sin `listo` no se puede decidir.
    assert.deepEqual(
      [...(esquema['required'] as string[])].sort(),
      ['listo', 'mensaje', 'respuestas'],
    );
  }
});

test('los desplegables van como `enum`, con sus valores y con el vacío', () => {
  /* `PanelHerramienta` ya explica por qué esos campos son un `select`: sus valores no son etiquetas,
     son el texto que entra al prompt, y el `SKILL.md` del VSL deriva de ellos booleanos que encienden
     ramas enteras. Un valor escrito a mano apaga la rama y el documento sale con otro molde. En el
     chat el valor lo escribe un modelo a partir de prosa, así que la puerta es más grande. */
  let listas = 0;
  for (const h of CON_AGENTE) {
    const bloque = (esquemaDeRespuestas(h)['properties'] as Record<string, Record<string, unknown>>)[
      'respuestas'
    ]!;
    const propiedades = bloque['properties'] as Record<string, Record<string, unknown>>;
    for (const campo of camposDe(h)) {
      const prop = propiedades[claveCorta(campo.id)]!;
      if (campo.tipo !== 'lista' || !campo.opciones || campo.opciones.length === 0) {
        assert.ok(!('enum' in prop), `\`${campo.id}\` no es una lista y trae \`enum\``);
        continue;
      }
      listas += 1;
      assert.deepEqual(
        prop['enum'],
        ['', ...campo.opciones.map((o) => o.valor)],
        `el \`enum\` de \`${campo.id}\` no son sus opciones`,
      );
    }
  }
  // La comprobación de que esto no pasó en vacío: el VSL tiene cuatro desplegables.
  assert.equal(listas, 4, 'no se midió ningún desplegable: la afirmación de arriba no probó nada');
});

test('las instrucciones llevan la etiqueta de cada campo, y no una redacción propia', () => {
  for (const h of CON_AGENTE) {
    const texto = instruccionesDeEntrevista(h, {});
    // De qué herramienta se está hablando sale del catálogo, no de una lista de títulos.
    assert.ok(texto.includes(h.titulo), `las instrucciones de «${h.pestania}» no la nombran`);
    assert.ok(texto.includes(h.etiquetaSalida), `no dicen qué entregable se va a generar`);

    for (const campo of camposDe(h)) {
      assert.ok(
        texto.includes(campo.etiqueta),
        `la pregunta de \`${campo.id}\` no sale de su etiqueta: el chat y el formulario preguntan ` +
          'cosas distintas',
      );
      assert.ok(texto.includes(`[${claveCorta(campo.id)}]`), `falta la clave de \`${campo.id}\``);
    }
  }
});

test('lo opcional se puede saltear, lo que tiene omisión no se insiste, y eso sale del catálogo', () => {
  for (const h of CON_AGENTE) {
    const lineas = instruccionesDeEntrevista(h, {}).split('\n');
    for (const campo of camposDe(h)) {
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
      }
      if (campo.tipo === 'lista' && campo.opciones) {
        for (const o of campo.opciones) {
          assert.ok(bloque.includes(o.valor), `el agente no ve la opción "${o.valor}"`);
        }
      }
    }
  }
});

test('el agente recibe el contexto heredado, responde con él, y los ejemplos no son respuestas', () => {
  /* Reportado con captura: a «¿cuál es mi ICP?» el agente contestaba «todavía no tengo suficientes
     datos» con la ficha y el research a un paso, y había anotado como nicho el TEXTO DEL EJEMPLO del
     campo («dueños de agencias de marketing»). Las dos cosas eran del prompt: no recibía el contexto,
     y nadie le decía que los ejemplos son formato. */
  const conContexto = instruccionesDeEntrevista(RESEARCH, {}, 'SEGMENTO GANADOR: agencias PPC');
  assert.ok(conContexto.includes('SEGMENTO GANADOR: agencias PPC'), 'el contexto heredado no llega al agente');
  assert.ok(conContexto.includes('No contestes «todavía no tengo datos» si los datos están arriba'));
  assert.ok(conContexto.includes('son FORMATO, no datos. Nunca los anotes como respuesta'));
  // Sin contexto, la sección no aparece: no se le promete al modelo algo que no viene.
  assert.ok(!instruccionesDeEntrevista(RESEARCH, {}).includes('YA CONSTRUYÓ EN LAS HERRAMIENTAS ANTERIORES'));

  // Y el servidor lo manda en cada turno, con el mismo constructor que usa el prompt de generación.
  const operaciones = leer('lib/fundaciones/operaciones.ts');
  assert.match(operaciones, /contexto: contextoHeredado\(h, estado\.datos\),/);
});

test('las instrucciones dicen lo que YA se sabe: el estado no vive en el historial', () => {
  /* Al modelo se le manda la cola de la conversación, no la conversación entera. Lo que hace que
     recortarla no pierda nada es que las respuestas viajan enteras en cada llamada. Sin esto, el
     agente vuelve a preguntar lo mismo en el turno veintiuno. */
  const texto = instruccionesDeEntrevista(RESEARCH, { niche: 'Agencias de Marketing' });
  assert.ok(texto.includes('Agencias de Marketing'));
  assert.ok(texto.includes('(todavía no)'), 'una respuesta vacía no se distingue de una contestada');
  assert.ok(TURNOS_QUE_VE_EL_MODELO > 0);
});

test('el saludo NO gasta una inferencia, y dice la primera etiqueta del formulario', () => {
  for (const h of CON_AGENTE) {
    const primera = camposDe(h)[0]!;
    const deCero = mensajeDeApertura(h, {});
    assert.ok(
      deCero.includes(primera.etiqueta),
      `el saludo de «${h.pestania}» no arranca con su primera pregunta`,
    );
    assert.ok(deCero.includes(h.titulo), 'el saludo no dice de qué herramienta se trata');

    // Con respuestas guardadas, las muestra y pregunta: es el caso de quien ya llenó el formulario.
    const conLoGuardado = mensajeDeApertura(h, { [claveCorta(primera.id)]: 'lo de antes' });
    assert.ok(conLoGuardado.includes('lo de antes'));
    assert.ok(!conLoGuardado.includes('(no especificado)'), 'el hueco del almacén llegó al saludo');
  }
});

// ─── La decisión de generar es del servidor ─────────────────────────────────

test('sin una respuesta obligatoria NO se genera, aunque el modelo diga que sí', () => {
  /* Obligatorias hay solo en el Research —el nicho y el trasfondo—; en las ocho genéricas el
     formulario deja generar con campos vacíos y el entregable los marca como pendientes. La regla es
     la MISMA función que decide si el botón está habilitado, no una copia parecida. */
  const sinTrasfondo: Record<string, string> = { ...respuestasCompletas(RESEARCH), experience: '' };
  assert.equal(
    arranca(RESEARCH, { mensaje: 'arranco', respuestas: sinTrasfondo, listo: true }, sinTrasfondo),
    false,
    'cinco generaciones con búsqueda web sobre criterios incompletos, ya pagadas',
  );

  const porId: Record<string, string> = {};
  for (const campo of camposDe(RESEARCH)) porId[campo.id] = sinTrasfondo[claveCorta(campo.id)] ?? '';
  assert.deepEqual(obligatoriosQueFaltan(RESEARCH, porId).map((c) => c.id), ['mr-experience']);
});

test('solo el Research EXIGE sus campos; las otras ocho generan con lo que haya', () => {
  /* No es un detalle del agente: es la decisión de producto de `PanelHerramienta` —*"lo que no sepas
     se puede dejar vacío: sale marcado como pendiente, no inventado"*— y el agente tiene que exigir
     exactamente lo mismo que el botón. Un chat más estricto que su propio formulario deja a alguien
     sin poder generar por un campo que la otra puerta acepta vacío, y sin decirle por qué. */
  assert.deepEqual(
    CON_AGENTE.filter((h) => h.exigeSusCampos).map((h) => h.clave),
    ['research'],
  );

  for (const h of CON_AGENTE) {
    if (h.exigeSusCampos) continue;
    const vacias: Record<string, string> = {};
    for (const campo of camposDe(h)) vacias[claveCorta(campo.id)] = '';
    assert.equal(
      arranca(h, { mensaje: 'genero', respuestas: vacias, listo: true }, vacias),
      true,
      `«${h.pestania}» no deja generar vacía, y su formulario sí: el chat es más estricto que el botón`,
    );
  }
});

test('un turno que agrega información NO genera: ahí se estaba contestando, no confirmando', () => {
  /* Ésta es la condición que hace estructural la confirmación, y vale para las nueve. Cubre el caso
     que más se paga: «dale, pero cambiá el precio a 5.000». Hay un sí y hay un dato nuevo, y generar
     con el resumen viejo produce el entregable con el precio anterior. */
  for (const h of CON_AGENTE) {
    const completas = respuestasCompletas(h);
    const campo = camposDe(h)[0]!;
    const previas = { ...completas, [claveCorta(campo.id)]: 'lo que decía antes' };

    assert.equal(
      arranca(h, { mensaje: 'listo, genero', respuestas: completas, listo: true }, previas),
      false,
      `«${h.pestania}» genera en el mismo turno en que cambió una respuesta`,
    );

    // Sin cambios respecto del turno anterior, el `listo` se respeta: eso es una confirmación.
    assert.equal(
      arranca(h, { mensaje: 'dale, genero', respuestas: completas, listo: true }, completas),
      true,
      `«${h.pestania}» no genera ni con todo contestado y confirmado`,
    );

    // Y sin `listo` no se genera nunca, por completas que estén las respuestas.
    assert.equal(
      arranca(h, { mensaje: '¿genero?', respuestas: completas, listo: false }, completas),
      false,
    );
  }
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
  h: Herramienta = RESEARCH,
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
      herramienta: h,
      mensajes,
      respuestas: {},
    });
    return { salida, peticiones };
  } finally {
    globalThis.fetch = original;
  }
}

test('el cuerpo lleva los campos que la API espera, y la herramienta se FUERZA', async () => {
  const { peticiones } = await llamando(
    respuestaCon({ mensaje: '¿y tu trasfondo?', respuestas: {}, listo: false }),
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
  // El mismo modelo que la generación que este chat alimenta: nadie puede terminar con un entregable
  // hecho por un modelo y unas respuestas entendidas por otro.
  assert.equal(p.cuerpo['model'], MODELO);
  assert.equal(p.cuerpo['max_tokens'], TECHO_DE_TOKENS);
  assert.equal(p.cabeceras.get('x-api-key'), 'sk-de-prueba');
  assert.equal(p.cabeceras.get('anthropic-version'), '2023-06-01');

  // Forzada, y una sola: sin esto el modelo puede contestar texto libre y no hay respuestas que leer.
  assert.deepEqual(p.cuerpo['tool_choice'], { type: 'tool', name: NOMBRE_DE_LA_HERRAMIENTA });
  const herramientas = p.cuerpo['tools'] as { name?: string; input_schema?: unknown }[];
  assert.equal(herramientas.length, 1);
  assert.equal(herramientas[0]?.name, NOMBRE_DE_LA_HERRAMIENTA);
  assert.ok(herramientas[0]?.input_schema);

  // Y NO se declara búsqueda web: el agente pregunta, no investiga. Una búsqueda por turno es una
  // cuenta que nadie pidió, y minutos de espera en un chat.
  assert.ok(!JSON.stringify(p.cuerpo['tools']).includes('web_search'));
});

test('al modelo se le manda la COLA de la conversación, no toda', async () => {
  const largos = Array.from({ length: TURNOS_QUE_VE_EL_MODELO + 8 }, (_, i) => ({
    role: (i % 2 === 0 ? 'assistant' : 'user') as 'assistant' | 'user',
    content: `turno ${i}`,
  }));
  const { peticiones } = await llamando(
    respuestaCon({ mensaje: 'ok', respuestas: {}, listo: false }),
    largos,
  );
  const enviados = peticiones[0]!.cuerpo['messages'] as { content: string }[];
  assert.equal(enviados.length, TURNOS_QUE_VE_EL_MODELO);
  // Los últimos, no los primeros: lo que se recorta es el principio.
  assert.equal(enviados[enviados.length - 1]?.content, `turno ${largos.length - 1}`);
});

test('una clave inventada no entra, y una respuesta que no vino queda vacía', async () => {
  /* Se recorre el CATÁLOGO y no lo que vino. Una clave inventada en el almacén es un dato que la
     plantilla no interpola: el documento sale con un hueco y nada falla. */
  const { salida } = await llamando(
    respuestaCon({
      mensaje: 'anotado',
      respuestas: { nicho: 'Agencias', niche: 'Agencias de Marketing' },
      listo: false,
    }),
  );
  assert.equal(salida.tipo, 'datos');
  if (salida.tipo !== 'datos') return;
  assert.deepEqual(Object.keys(salida.datos.respuestas).sort(), [
    'buyers',
    'contract',
    'experience',
    'ltv',
    'niche',
  ]);
  assert.equal(salida.datos.respuestas['niche'], 'Agencias de Marketing');
  assert.equal(salida.datos.respuestas['buyers'], '');
});

test('un desplegable con un valor que no existe se descarta, no se guarda', async () => {
  /* El `enum` del esquema lo pide y esto lo hace cierto. Un «b2c» inventado donde el valor válido es
     otro no falla en ninguna parte: apaga la rama que el `SKILL.md` deriva y el video sale con otro
     molde. Vacío es «no se sabe», que es recuperable; un valor inválido no lo es. */
  const vsl = TOOLS.find((h) => h.clave === 'vsl')!;
  const lista = camposDe(vsl).find((c) => c.tipo === 'lista')!;
  const valida = lista.opciones![0]!.valor;

  const { salida: mala } = await llamando(
    respuestaCon({ mensaje: 'anotado', respuestas: { [claveCorta(lista.id)]: 'inventado' }, listo: false }),
    undefined,
    vsl,
  );
  assert.equal(mala.tipo, 'datos');
  if (mala.tipo === 'datos') assert.equal(mala.datos.respuestas[claveCorta(lista.id)], '');

  const { salida: buena } = await llamando(
    respuestaCon({ mensaje: 'anotado', respuestas: { [claveCorta(lista.id)]: valida }, listo: false }),
    undefined,
    vsl,
  );
  assert.equal(buena.tipo, 'datos');
  if (buena.tipo === 'datos') assert.equal(buena.datos.respuestas[claveCorta(lista.id)], valida);
});

test('un turno sin mensaje NO es un turno: la pantalla no muestra una burbuja en blanco', async () => {
  const { salida } = await llamando(respuestaCon({ mensaje: '   ', respuestas: {}, listo: true }));
  assert.equal(salida.tipo, 'sin_estructura');
});

test('el corte por techo se distingue de una estructura ilegible', async () => {
  /* Un truncado leído como esquema inválido manda a revisar el esquema en vez de subir el techo. Es
     la misma lección que ya está escrita en el auditor y en la generación. */
  const { salida } = await llamando(
    respuestaCon({ mensaje: 'a medio decir', respuestas: {}, listo: false }, 'max_tokens'),
  );
  assert.equal(salida.tipo, 'truncado');
});

// ─── Lo que el servidor escribe, leído del código ───────────────────────────

test('el historial NO viaja por el navegador', () => {
  /* La segunda mitad de la comprobación de `arranca`: si el cliente pudiera mandar la conversación,
     podría mandar una en la que la persona ya confirmó, y `listo` saldría en true en el primer
     turno. El navegador manda UNA línea. */
  const chat = leer('components/fundaciones/ChatDeHerramienta.jsx');
  assert.match(chat, /cuerpo:\s*\{\s*herramienta:\s*herramienta\.id,\s*\.\.\.cuerpo\s*\}/);

  const operaciones = leer('lib/fundaciones/operaciones.ts');
  // El manejador lee del almacén y solo acepta `herramienta`, `mensaje` y `reiniciar`.
  assert.match(
    operaciones,
    /cuerpo: \{ herramienta\?: unknown; mensaje\?: unknown; reiniciar\?: unknown \}/,
  );
});

test('si el modelo falla no se guarda nada, ni siquiera el turno de la persona', () => {
  /* Guardarlo dejaría la conversación terminando en una pregunta sin respuesta, y el próximo turno
     le mandaría al modelo dos mensajes seguidos de la persona. Y el texto que la pantalla muestra en
     ese caso —«no se perdió nada de lo que escribiste»— sería falso. */
  const fuente = leer('lib/fundaciones/operaciones.ts');
  const i = fuente.indexOf('export async function conversarConElAgente');
  assert.ok(i > 0, 'se renombró el manejador de la conversación');
  const cuerpo = fuente.slice(i);

  const fallo = cuerpo.indexOf("if (salida.tipo !== 'datos') return rechazoDeConversacion(salida);");
  const guarda = cuerpo.indexOf('guardarChat(acceso.clienteId, estado.datos, h.id, proximo)');
  assert.ok(fallo > 0 && guarda > fallo, 'el chat se guarda antes de saber si el modelo respondió');
});

test('las nueve conversaciones van en UN documento, y guardar una no borra las otras ocho', () => {
  /* `tool_chats` guarda las nueve juntas, como `profile` y `history`. Escribir solo con la que
     cambió se lleva las demás en silencio — el mismo defecto que `guardarLosInputs` documenta y por
     el que relee el estado antes de escribir. */
  const almacen = leer('lib/fundaciones/almacen.ts');
  assert.match(almacen, /const proximo: Record<number, ChatDeHerramienta> = \{ \.\.\.estado\.chats/);
});

test('las dos pantallas arrancan la generación con los valores del turno, no con los del estado', () => {
  /* El defecto de ARIA-brain entrando por la puerta de al lado: `setState` es asíncrono, así que
     generar con los valores del estado justo después de recibirlos del agente los lee un render antes
     de que existan — y el entregable sale sobre respuestas vacías, viéndose igual de bien. */
  const research = leer('components/fundaciones/PanelResearch.jsx');
  assert.match(research, /const correrPaso = async \(paso, v = valores\)/);
  assert.match(research, /const correrTodo = async \(v = valores\)/);
  assert.match(research, /await correrTodo\(v\)/);

  const generica = leer('components/fundaciones/PanelHerramienta.jsx');
  assert.match(generica, /const guardar = async \(v = valores\)/);
  assert.match(generica, /const generar = async \(ajuste, v = valores\)/);
  assert.match(generica, /await generar\(null, v\)/);

  /* Y ningún manejador pasa el evento de React donde van los valores: `onClick={guardar}` le
     entregaría un `SyntheticEvent` a la petición, que lo mandaría como `valores` en el cuerpo. */
  for (const [nombre, fuente] of [
    ['PanelResearch', research],
    ['PanelHerramienta', generica],
  ] as const) {
    assert.ok(!/onClick=\{guardar\}/.test(fuente), `${nombre} pasa el evento a \`guardar\``);
    assert.ok(!/onClick=\{correrTodo\}/.test(fuente), `${nombre} pasa el evento a \`correrTodo\``);
  }
});

test('el selector de modo es UNO, y las dos pantallas lo usan', () => {
  /* Duplicarlo sería la lista paralela con forma de botones: la pantalla en la que alguien corrija
     el texto o el estado deshabilitado queda distinta de la otra sin que nada falle. */
  for (const panel of [
    'components/fundaciones/PanelResearch.jsx',
    'components/fundaciones/PanelHerramienta.jsx',
  ]) {
    const fuente = leer(panel);
    assert.match(fuente, /import SelectorDeModo/, `${panel} no usa el selector compartido`);
    assert.ok(
      !/Opción 1/.test(fuente),
      `${panel} escribe los botones del selector por su cuenta: son dos copias`,
    );
  }
});
