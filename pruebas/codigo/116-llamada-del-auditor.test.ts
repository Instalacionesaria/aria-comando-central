// EL ESQUEMA DE SALIDA y LA LLAMADA AL MODELO. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE DEFIENDE ACÁ, Y POR QUÉ CADA COSA SE MIDE SOBRE EL CUERPO REAL
//
// Este es el único módulo del producto que **gasta plata por conversación**, y sus defectos tienen un
// modo de fallar propio: **la inferencia se paga y el análisis se pierde.**
//
// Pasa de cuatro formas, y las cuatro se prueban:
//
//   · Un **campo de más** en el cuerpo → 400 *«Extra inputs are not permitted»*. Es el error típico de
//     copiar un cuerpo de otra API, y ya ocurrió en producción en el módulo hermano.
//   · Un **`additionalProperties` olvidado en un objeto anidado** → el modelo agrega campos ahí
//     adentro y la escritura viola una restricción de la base.
//   · Un **motivo de corte no mirado** → una salida truncada se lee como estructura inválida, y manda
//     a revisar el esquema en vez de subir el techo.
//   · Una **herramienta no forzada** → el modelo contesta texto libre y no hay veredicto que leer.
//
// El cuerpo se mide **serializado y vuelto a leer**, que es la única forma de ver los campos que
// `JSON.stringify` se comió: un `undefined` desaparece del JSON, y comparar contra `undefined` no
// distingue «no vino» de «vino sin valor».
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente } from '../apoyo/fuente.ts';
import {
  NOMBRE_DE_LA_HERRAMIENTA,
  esquemaDelVeredicto,
  type VeredictoDelModelo,
} from '../../lib/auditor/esquema.ts';
import {
  MODELO_DEL_AUDITOR,
  TECHO_DE_TOKENS,
  pedirVeredicto,
} from '../../lib/auditor/modelo.ts';
import { AGENTES, CRITERIOS_DEL_AGENTE, SIN_CRITERIO } from '../../lib/auditor/veredicto.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL ESQUEMA: las cuatro restricciones, recorridas hasta el fondo
// ═══════════════════════════════════════════════════════════════════════════════

/** Recorre el esquema entero y devuelve todos los objetos, con su camino. */
function objetosDelEsquema(
  nodo: unknown,
  camino = 'raíz',
): { camino: string; nodo: Record<string, unknown> }[] {
  if (nodo === null || typeof nodo !== 'object') return [];
  const n = nodo as Record<string, unknown>;
  const hallados: { camino: string; nodo: Record<string, unknown> }[] = [];

  const tipo = n['type'];
  const esObjeto = tipo === 'object' || (Array.isArray(tipo) && tipo.includes('object'));
  if (esObjeto) hallados.push({ camino, nodo: n });

  const props = n['properties'];
  if (props !== null && typeof props === 'object') {
    for (const [clave, valor] of Object.entries(props as Record<string, unknown>)) {
      hallados.push(...objetosDelEsquema(valor, `${camino}.${clave}`));
    }
  }
  if (n['items'] !== undefined) hallados.push(...objetosDelEsquema(n['items'], `${camino}[]`));
  return hallados;
}

test('TODO objeto del esquema prohíbe propiedades extra, incluidos los anidados', async () => {
  /* La restricción que más fácil se olvida, y su defecto es el que no se ve: sin
     `additionalProperties: false` en un objeto de **segundo nivel**, la validación estricta del nivel
     de arriba pasa igual y el modelo agrega campos ahí adentro. Después la escritura viola una
     restricción de la base y **se pierde el análisis con la inferencia ya pagada**.
   *
   * Se recorre el esquema hasta el fondo en vez de mirar la raíz: los objetos que importan están
   * dentro de `hallazgos[]` y `observaciones[]`. */
  for (const agente of AGENTES) {
    const objetos = objetosDelEsquema(esquemaDelVeredicto(agente));
    assert.ok(
      objetos.length >= 4,
      `el esquema de ${agente} tiene ${objetos.length} objetos: se esperaban al menos cuatro (la ` +
        'raíz, la intervención, una observación y un hallazgo)',
    );
    for (const { camino, nodo } of objetos) {
      assert.equal(
        nodo['additionalProperties'],
        false,
        `${agente} → ${camino} no prohíbe propiedades extra`,
      );
    }
  }
});

test('TODA propiedad es OBLIGATORIA, y lo anulable se dice en el tipo', async () => {
  /* *Una clave opcional en un esquema estricto es más frágil que una obligatoria que puede ser nula.*
     Con la opcional, el modelo decide si la manda y el consumidor tiene que distinguir «no vino» de
     «vino nula» sin saber cuál quiso decir.
   *
   * Se comprueba la igualdad exacta entre las claves y `required`, en los dos sentidos: una clave sin
   * declarar es opcional, y un `required` de una clave que no existe es un esquema inválido que el
   * proveedor rechaza con un 400. */
  for (const agente of AGENTES) {
    for (const { camino, nodo } of objetosDelEsquema(esquemaDelVeredicto(agente))) {
      const props = Object.keys((nodo['properties'] ?? {}) as Record<string, unknown>).sort();
      const requeridas = [...((nodo['required'] ?? []) as string[])].sort();
      assert.deepEqual(requeridas, props, `${agente} → ${camino}: `);
    }
  }
});

test('el esquema NO lleva largos mínimos ni patrones de texto ni topes de items', async () => {
  /* ── LAS DOS RAZONES, Y NINGUNA ES ESTÉTICA ────────────────────────────────
   *
   * **El formato del patrón lo valida la base** y lo normaliza el código. Si estuviera en el esquema,
   * un código mal escrito rompería **la respuesta entera** en vez de un hallazgo — y perder la
   * inferencia completa por un guion es el peor cambio posible. Con el descarte en código, se tira el
   * hallazgo y se guarda el análisis.
   *
   * **Y el tope de hallazgos se recorta en código.** Un esquema con un máximo hace que el modelo
   * TRUNQUE en vez de elegir: se le pide que traiga los más importantes y se recorta después. */
  const PROHIBIDAS = ['minLength', 'maxLength', 'pattern', 'minItems', 'maxItems', 'format'];

  const buscar = (nodo: unknown, camino: string, halladas: string[]): void => {
    if (nodo === null || typeof nodo !== 'object') return;
    const n = nodo as Record<string, unknown>;
    for (const prohibida of PROHIBIDAS) {
      if (prohibida in n) halladas.push(`${camino}.${prohibida}`);
    }
    for (const [clave, valor] of Object.entries(n)) {
      if (valor !== null && typeof valor === 'object') buscar(valor, `${camino}.${clave}`, halladas);
    }
  };

  for (const agente of AGENTES) {
    const halladas: string[] = [];
    buscar(esquemaDelVeredicto(agente), agente, halladas);
    assert.deepEqual(
      halladas,
      [],
      'el esquema lleva una restricción de formato: eso hace que lo inválido rompa la respuesta ' +
        'entera en vez de una de sus partes',
    );
  }
});

test('el criterio del esquema es el de SU agente, y el del otro territorio es INEXPRESABLE', async () => {
  /* ── LA MEJORA SOBRE EL DISEÑO DE ORIGEN, Y SALE DE UNA MEDICIÓN ───────────
   *
   * En los 59 análisis reales de la plataforma anterior apareció `calificacion_saltada` —un criterio de
   * pre-agenda— en análisis de agentes de **post-agenda**. Con el enumerado por agente, el modelo **no
   * puede** devolverlo: el cruce deja de ser algo que hay que descartar y pasa a ser inexpresable.
   *
   * Y el daño que evita no es un error: es un veredicto que juzga el trabajo equivocado con la forma
   * de uno bueno. «Abandonó la conversación» en post-agenda es dejar colgada una cita; en pre-agenda
   * el contacto todavía no agendó, y es otra cosa. */
  for (const agente of AGENTES) {
    const esquema = esquemaDelVeredicto(agente);
    const props = esquema['properties'] as Record<string, Record<string, unknown>>;

    const delVeredicto = props['criterio']?.['enum'] as string[];
    assert.ok(Array.isArray(delVeredicto), `${agente}: el criterio del veredicto no es un enumerado`);
    // El del veredicto incluye el valor neutro: un verde no disparó ninguno.
    assert.deepEqual(
      [...delVeredicto].sort(),
      [SIN_CRITERIO, ...CRITERIOS_DEL_AGENTE[agente]].sort(),
      `${agente}: el enumerado del criterio del veredicto no es el de este agente`,
    );

    const hallazgos = props['hallazgos'] as Record<string, unknown>;
    const items = hallazgos['items'] as Record<string, Record<string, Record<string, unknown>>>;
    const delHallazgo = items['properties']?.['criterio']?.['enum'] as string[];
    /* El del hallazgo NO lleva el neutro: un hallazgo sin criterio no se puede agrupar ni corregir, y
       sería una fila que la pantalla del técnico no sabe dónde poner. */
    assert.deepEqual(
      [...delHallazgo].sort(),
      [...CRITERIOS_DEL_AGENTE[agente]].sort(),
      `${agente}: el enumerado del criterio del hallazgo no es el de este agente`,
    );
    assert.ok(
      !delHallazgo.includes(SIN_CRITERIO),
      `${agente}: un hallazgo puede venir sin criterio, y entonces no se puede agrupar ni corregir`,
    );

    // Y los del OTRO agente no están.
    const elOtro = AGENTES.find((a) => a !== agente);
    if (elOtro === undefined) continue;
    const ajenos = CRITERIOS_DEL_AGENTE[elOtro].filter(
      (c) => !CRITERIOS_DEL_AGENTE[agente].includes(c),
    );
    assert.ok(ajenos.length >= 3, 'los dos agentes tienen que tener criterios propios');
    for (const ajeno of ajenos) {
      assert.ok(
        !delVeredicto.includes(ajeno) && !delHallazgo.includes(ajeno),
        `${agente}: el esquema admite «${ajeno}», que es un criterio de ${elOtro}`,
      );
    }
  }
});

test('las descripciones del esquema llevan las reglas que tienen que estar pegadas al campo', async () => {
  /* Las descripciones **no son documentación: el modelo las lee**, y ahí vive la mitad de la rúbrica
     que tiene que estar donde se decide. Una regla escrita solo en el texto de la rúbrica se pierde
     entre cincuenta líneas de transcript.
   *
   * Se fija que las cuatro reglas que más se pierden estén EN SU CAMPO, no en cualquier lado. */
  const props = esquemaDelVeredicto('chat_post_agenda')['properties'] as Record<
    string,
    Record<string, unknown>
  >;
  const dice = (clave: string): string => String(props[clave]?.['description'] ?? '');

  // La vara de la intervención son cuatro condiciones, y el estilo no es una de ellas.
  const intervencion = (
    (props['intervencion']?.['properties'] as Record<string, Record<string, unknown>>)?.['requerida']
      ?.['description'] ?? ''
  ).toString();
  assert.match(intervencion, /verboso|formal|repetitivo/i, 'no dice qué NO es intervención');
  assert.match(intervencion, /tres o m[áa]s veces/i, 'no dice la condición de las tres veces');

  // El verde: destacado y evidencia van juntos o no van.
  assert.match(dice('destacado'), /los dos o ninguno/i);
  assert.match(dice('evidencia'), /los dos o ninguno/i);
  assert.match(dice('evidencia'), /EXACTA Y LITERAL/i, 'no pide la línea literal');

  // El resumen se escribe siempre, incluso sin auditar.
  assert.match(dice('resumen'), /SIEMPRE/, 'no dice que el resumen se escribe siempre');

  // Y el sentimiento es DEL CONTACTO.
  assert.match(dice('sentimiento'), /DEL CONTACTO/i);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · EL CUERPO QUE SALE
// ═══════════════════════════════════════════════════════════════════════════════

/** El veredicto que un modelo bien portado devolvería. */
const VEREDICTO_BUENO: VeredictoDelModelo = {
  auditable: true,
  no_auditable_motivo: null,
  resumen: 'El contacto pidió el link de pago tres veces y no lo recibió.',
  intervencion: { requerida: true, motivo: 'pidió el link de pago tres veces sin obtenerlo' },
  nivel: 'rojo',
  criterio: 'insiste_sin_entender',
  destacado: null,
  evidencia: null,
  sentimiento: 'molesto',
  observaciones: [],
  hallazgos: [],
};

function respuestaCon(cuerpo: {
  input?: unknown;
  stop_reason?: string;
  tipo?: string;
  nombre?: string;
}): () => Response {
  return () =>
    new Response(
      JSON.stringify({
        content: [
          {
            type: cuerpo.tipo ?? 'tool_use',
            name: cuerpo.nombre ?? NOMBRE_DE_LA_HERRAMIENTA,
            /* `in` y no `??`: con `??` un `input: null` EXPLÍCITO caía al veredicto bueno, y el
               caso de la entrada nula no se medía — la prueba pasaba midiendo otra cosa. Es la
               misma trampa que este repositorio documenta para `max_tokens`. */
            input: 'input' in cuerpo ? cuerpo.input : VEREDICTO_BUENO,
          },
        ],
        stop_reason: cuerpo.stop_reason ?? 'tool_use',
        usage: { input_tokens: 8000, output_tokens: 900 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
}

async function interceptando<T>(
  respuesta: () => Response,
  correr: () => Promise<T>,
): Promise<{
  salida: T;
  peticiones: { url: string; cuerpo: Record<string, unknown>; cabeceras: Headers }[];
}> {
  const peticiones: { url: string; cuerpo: Record<string, unknown>; cabeceras: Headers }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const enviado = typeof init?.body === 'string' ? init.body : '{}';
    peticiones.push({
      url: String(url),
      // Serializado y vuelto a leer A PROPÓSITO: es la única forma de ver los campos que
      // `JSON.stringify` se comió.
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

const llamar = (respuesta: () => Response) =>
  interceptando(respuesta, () =>
    pedirVeredicto({
      claveIa: 'sk-de-prueba',
      agente: 'chat_post_agenda',
      instrucciones: 'la rúbrica entera',
      patrones: ['promete_financiamiento_inexistente'],
      conversacion: '[03/08 14:02] CONTACTO: hola',
    }),
  );

test('el cuerpo lleva EXACTAMENTE los campos que la API espera, y ninguno de más', async () => {
  /* Un campo de más responde 400 *«Extra inputs are not permitted»* — y en este módulo eso significa
     que **ningún análisis se escribe nunca**, con el mismo texto amable en pantalla. Es el error
     típico de copiar un cuerpo de otra API, y el módulo hermano ya lo pagó en producción. */
  const { peticiones } = await llamar(respuestaCon({}));
  assert.equal(peticiones.length, 1, 'no se hizo exactamente una petición');
  const p = peticiones[0]!;

  assert.equal(p.url, 'https://api.anthropic.com/v1/messages');
  assert.deepEqual(
    Object.keys(p.cuerpo).sort(),
    ['max_tokens', 'messages', 'model', 'system', 'tool_choice', 'tools'],
    'el cuerpo manda campos que la API no espera, o le falta alguno',
  );

  // El modelo, con el valor que el módulo declara — y NO el de Fundaciones.
  assert.equal(p.cuerpo['model'], MODELO_DEL_AUDITOR);

  /* `max_tokens` PRESENTE, comprobado con `in` y no con una comparación de valor: un `undefined`
     desaparece del JSON, y la API responde *«Field required»* con el mismo síntoma en pantalla. */
  assert.ok('max_tokens' in p.cuerpo, 'el cuerpo va SIN max_tokens');
  assert.equal(p.cuerpo['max_tokens'], TECHO_DE_TOKENS);

  // Las dos cabeceras sin las que no hay petición válida, y la llave es la que se pasó.
  assert.equal(p.cabeceras.get('anthropic-version'), '2023-06-01');
  assert.equal(p.cabeceras.get('x-api-key'), 'sk-de-prueba');
});

test('la herramienta se FUERZA, y es la única que se ofrece', async () => {
  /* Forzarla es lo que hace que **el esquema sea el contrato**. Sin esto el modelo puede contestar con
     texto libre, y ahí no hay veredicto que leer: la inferencia se paga y no queda nada. */
  const { peticiones } = await llamar(respuestaCon({}));
  const p = peticiones[0]!;

  const herramientas = p.cuerpo['tools'] as { name?: string; input_schema?: unknown }[];
  assert.equal(herramientas.length, 1, 'se ofrece más de una herramienta');
  assert.equal(herramientas[0]?.name, NOMBRE_DE_LA_HERRAMIENTA);
  assert.ok(herramientas[0]?.input_schema, 'la herramienta va sin esquema');

  assert.deepEqual(p.cuerpo['tool_choice'], { type: 'tool', name: NOMBRE_DE_LA_HERRAMIENTA });
});

test('el prefijo estable y los patrones van SEPARADOS, y en ese orden', async () => {
  /* Es el corte del caché, puesto de entrada aunque la marca todavía no se ponga.
   *
   * El diseño de origen lo tenía en el bloque de los patrones, y **los patrones cambian solos** —salen
   * de los hallazgos—, así que cada hallazgo nuevo invalidaba el caché entero de esa empresa: **se
   * pagaba la escritura una y otra vez sin llegar a cobrar una sola lectura.**
   *
   * Con la separación puesta desde el principio, marcarlo es una línea el día que la cabecera se pueda
   * comprobar. Sin ella, agregar el caché exigiría además rearmar el cuerpo. */
  const { peticiones } = await llamar(respuestaCon({}));
  const sistema = peticiones[0]!.cuerpo['system'] as { type?: string; text?: string }[];

  assert.ok(Array.isArray(sistema), '`system` no es una lista de bloques: no hay dónde poner el corte');
  assert.equal(sistema.length, 2, 'el prefijo estable y los patrones no están separados');
  assert.equal(sistema[0]?.text, 'la rúbrica entera', 'el prefijo estable no va primero');
  assert.match(String(sistema[1]?.text), /promete_financiamiento_inexistente/);
  assert.match(
    String(sistema[1]?.text),
    /REUS[ÁA] ESE C[ÓO]DIGO EXACTO/,
    'la orden de reusar el código no está, y sin ella el técnico ve quince problemas en vez de ×15 casos',
  );

  // Y sin patrones se DICE que la lista está vacía, en vez de omitir el bloque.
  const { peticiones: sinPatrones } = await interceptando(respuestaCon({}), () =>
    pedirVeredicto({
      claveIa: 'sk',
      agente: 'chat_pre_agenda',
      instrucciones: 'x',
      patrones: [],
      conversacion: 'y',
    }),
  );
  const sistemaVacio = sinPatrones[0]!.cuerpo['system'] as { text?: string }[];
  assert.equal(sistemaVacio.length, 2, 'el bloque de patrones se omitió en vez de decir que está vacío');
  assert.match(String(sistemaVacio[1]?.text), /ninguno todav[íi]a/i);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LOS CINCO FINALES, SIN COLAPSAR NINGUNO
// ═══════════════════════════════════════════════════════════════════════════════

test('un veredicto bien formado se lee del bloque de la herramienta', async () => {
  const { salida } = await llamar(respuestaCon({}));
  assert.equal(salida.tipo, 'datos');
  if (salida.tipo !== 'datos') return;
  assert.equal(salida.datos.veredicto.nivel, 'rojo');
  assert.equal(salida.datos.veredicto.intervencion.requerida, true);
  assert.equal(salida.datos.modelo, MODELO_DEL_AUDITOR);
  assert.equal(salida.datos.tokens, 8900, 'los tokens no suman entrada más salida');
});

test('una salida TRUNCADA se dice, y no se confunde con estructura inválida', async () => {
  /* El techo cubre pensamiento más texto, y el diseño de origen dice que **ya se rompió dos veces**:
     cuando quedó corto, el análisis **se perdió entero con la inferencia ya pagada** y el error se
     reportaba como «sin veredicto», sin decir por qué.
   *
   * Y la distinción importa para quien lo lee: un truncado manda a **subir el techo**; una estructura
   * inválida manda a **revisar el esquema**. Colapsarlos manda a la investigación equivocada. */
  const { salida } = await llamar(respuestaCon({ stop_reason: 'max_tokens' }));
  assert.equal(salida.tipo, 'truncado');
});

test('el modelo DECLINÓ es su propia rama: no es un fallo del agente auditado', async () => {
  /* **No se marca nada.** Si cayera en el mismo cajón que un rechazo del servicio, la pantalla lo
     mostraría como un problema del auditor, y el barrido de respaldo lo reintentaría para siempre. */
  const { salida } = await llamar(respuestaCon({ stop_reason: 'refusal' }));
  assert.equal(salida.tipo, 'declino');
});

test('un 200 SIN el bloque de la herramienta no es un veredicto vacío', async () => {
  /* Es una respuesta que no sirve, y guardarla como análisis dejaría una fila que dice algo sobre
     nada. Se comprueba también el NOMBRE de la herramienta y no solo el tipo: hoy se ofrece una sola
     y no debería hacer falta, y hace falta igual — el día que se ofrezca una segunda, leer «el primer
     tool_use» tomaría la equivocada y el veredicto saldría de otra forma. */
  const soloTexto = await llamar(respuestaCon({ tipo: 'text' }));
  assert.equal(soloTexto.salida.tipo, 'sin_estructura');

  const otraHerramienta = await llamar(respuestaCon({ nombre: 'otra_cosa' }));
  assert.equal(
    otraHerramienta.salida.tipo,
    'sin_estructura',
    'se leyó el bloque de OTRA herramienta como si fuera el veredicto',
  );

  const sinEntrada = await llamar(respuestaCon({ input: null }));
  assert.equal(sinEntrada.salida.tipo, 'sin_estructura');
});

test('un rechazo del servicio trae su estado, su código y su MOTIVO', async () => {
  /* `motivo` es el único campo que dice QUÉ estuvo mal: sin él, `invalid_request_error` cubre por
     igual un techo fuera de rango, un campo de más y una cuenta sin saldo — tres investigaciones
     distintas con el mismo nombre. */
  const { salida } = await llamar(
    () =>
      new Response(
        JSON.stringify({ error: { type: 'invalid_request_error', message: 'max_tokens: too large' } }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
  );
  assert.equal(salida.tipo, 'rechazado');
  if (salida.tipo !== 'rechazado') return;
  assert.equal(salida.estado, 400);
  assert.match(String(salida.motivo), /max_tokens/, 'el motivo del servicio se perdió');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LA DUPLICACIÓN ACOTADA: el transporte tiene que coincidir
// ═══════════════════════════════════════════════════════════════════════════════

test('el auditor y Fundaciones coinciden en el TRANSPORTE, y difieren solo en el cuerpo', async () => {
  /* ── POR QUÉ ESTA PRUEBA EXISTE ────────────────────────────────────────────
   *
   * Los dos archivos llaman al mismo proveedor. Lo que comparten es el transporte —la dirección, la
   * versión, el nombre de la cabecera de autenticación, la salida por `pedirExterno`— y lo que difiere
   * es el cuerpo y el parseo, que son genuinamente distintos: uno pide texto markdown y lee bloques
   * `text`; el otro pide una forma estricta y lee un `tool_use`.
   *
   * No se unificó porque el cuerpo de Fundaciones está fijado por una prueba que afirma sus claves
   * exactas —con motivo: un campo de más produjo un 400 en producción— y su lector descartaría un
   * bloque de herramienta en silencio.
   *
   * Así que la duplicación es deliberada y **acotada por esta prueba**: si un día uno cambia de
   * dirección o de versión de API y el otro no, esto se pone rojo. Sin ella, la divergencia aparecería
   * como «el auditor dejó de funcionar» meses después de que alguien tocó el otro archivo.
   *
   * Se lee el texto SIN comentarios: los dos archivos citan estas cadenas en sus explicaciones. */
  const fuente = (ruta: string): string => {
    const a = archivosFuente(['lib']).find((x) => x.ruta === ruta);
    assert.ok(a, `no se encontró ${ruta}`);
    return a.limpio;
  };
  const delAuditor = fuente('lib/auditor/modelo.ts');
  const deFundaciones = fuente('lib/fundaciones/generacion.ts');

  for (const compartido of [
    "'https://api.anthropic.com/v1/messages'",
    "'2023-06-01'",
    "'x-api-key'",
    "'anthropic-version'",
    'pedirExterno',
  ]) {
    assert.ok(
      delAuditor.includes(compartido),
      `el auditor dejó de usar «${compartido}»: si cambió el transporte, hay que cambiar los dos`,
    );
    assert.ok(
      deFundaciones.includes(compartido),
      `Fundaciones dejó de usar «${compartido}»: el auditor quedó apuntando a otro lado`,
    );
  }

  /* Y ninguno de los dos usa `fetch(` directo: `ADR-0305` lo restringe a tres archivos exactos y la
     lista es una igualdad, así que un cuarto rompería esa prueba en las dos direcciones. */
  for (const [ruta, texto] of [
    ['lib/auditor/modelo.ts', delAuditor],
    ['lib/fundaciones/generacion.ts', deFundaciones],
  ] as const) {
    assert.ok(!/\bfetch\s*\(/.test(texto), `${ruta} llama a \`fetch(\` directo`);
  }

  /* Y el modelo es una constante PROPIA de cada uno, no una importada. Compartirla haría que cambiar
     el modelo de los documentos de un alumno cambie en silencio cuánto cuesta auditar y cómo se juzga
     a los agentes — dos decisiones distintas con un solo interruptor. */
  assert.ok(
    !delAuditor.includes("from '../fundaciones/generacion.ts'"),
    'el auditor importa del módulo de Fundaciones: cambiar el modelo de allá cambiaría el de acá',
  );
  assert.match(delAuditor, /MODELO_DEL_AUDITOR = '[a-z0-9-]+'/);
});
