// LA RÚBRICA: el molde, las dos listas y el mensaje. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTAS PRUEBAS DEFIENDEN
//
// Es el texto que decide el veredicto, y **ninguno de sus defectos da error**. Los cuatro que se
// pueden escribir sin que nada falle:
//
//   · **Las dos rúbricas cruzadas.** `RUBRICA_DEL_AGENTE` mapea agente → rúbrica, y las dos rúbricas
//     son asignables al mismo tipo: **cambiarlas de lugar compila**. El auditor de post-agenda leería
//     los criterios de pre-agenda mientras el esquema le ofrece los suyos, y el resultado es un
//     veredicto convincente sobre el trabajo equivocado. Es exactamente el cruce que la medición
//     encontró en los 59 análisis del origen.
//
//   · **Un criterio sin descartes.** Compila, se ve completo, y dispara por parecido semántico.
//
//   · **La rama sin prompt tratando un prompt vacío como cargado.** Le pide al modelo que cite un
//     fragmento de un texto que no existe, y la corrección resultante no se puede aplicar.
//
//   · **Un tri-estado de los hechos renderizado como su valor por omisión.** «El agente escribió hace
//     0 minutos» afirma que escribió; «nadie le respondió» afirma que alguien habló. Los dos son
//     falsos y los dos sostienen un criterio.
//
// Lo que el compilador SÍ cubre no se prueba dos veces: que cada rúbrica tenga los siete criterios de
// su agente lo garantiza el `Record` sobre el enumerado. Lo que se prueba acá es lo que el tipo no
// puede ver.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { COMO_LEER_LOS_AUTORES, IMPUTABLE } from '../../lib/auditor/atribucion.ts';
import {
  LAS_DOS_SALIDAS,
  MISION_DEL_AGENTE,
  REGLA_DE_IMPUTACION,
  RUBRICA_DEL_AGENTE,
  RUBRICA_POST_AGENDA,
  RUBRICA_PRE_AGENDA,
  SEPARADOR,
  instruccionesDelAuditor,
  textoDeLaConversacion,
} from '../../lib/auditor/rubrica.ts';
import { UMBRAL_DE_SILENCIO_MIN, type HechosDeLaConversacion } from '../../lib/auditor/transcripcion.ts';
import {
  AGENTES,
  CRITERIOS_DEL_AGENTE,
  SIN_CRITERIO,
  TOPE_DE_HALLAZGOS,
} from '../../lib/auditor/veredicto.ts';

/** Los criterios que el molde escribió como encabezados, en el orden en que salieron. */
function criteriosEnElTexto(texto: string): string[] {
  return [...texto.matchAll(/^▸ ([a-z_]+)$/gm)].map((m) => m[1] as string);
}

/** Unos hechos, con lo que no está bajo prueba puesto por omisión. */
function hechos(cambios: Partial<HechosDeLaConversacion> = {}): HechosDeLaConversacion {
  return {
    porAutor: {
      CONTACTO: 4,
      'AGENTE IA': 5,
      'ASESOR HUMANO': 0,
      'AUTOMATIZACIÓN': 0,
      'ORIGEN NO IDENTIFICADO': 0,
    },
    ultimoEsDe: 'AGENTE IA',
    minutosDesdeElUltimo: 12,
    minutosDesdeElAgente: 12,
    respondieronAlContacto: true,
    sinTexto: 0,
    umbralDeSilencioMin: UMBRAL_DE_SILENCIO_MIN,
    ...cambios,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LAS DOS LISTAS DE CRITERIOS
// ═══════════════════════════════════════════════════════════════════════════════

test('ningún criterio tiene la lista de descartes vacía, en ninguna de las dos rúbricas', () => {
  /* Es la invariante del archivo. Un criterio sin descartes no falla nunca: dispara por parecido
     semántico, el técnico ve amarillos que no son, y deja de mirar la pantalla — que es la única
     forma real de perder este módulo. */
  for (const [nombre, rubrica] of [
    ['post-agenda', RUBRICA_POST_AGENDA],
    ['pre-agenda', RUBRICA_PRE_AGENDA],
  ] as const) {
    for (const [codigo, t] of Object.entries(rubrica)) {
      assert.ok(t.descartes.length > 0, `${nombre} · ${codigo} no tiene ni un descarte`);
      assert.ok(t.disparo.trim().length > 0, `${nombre} · ${codigo} no tiene disparo`);
      for (const d of t.descartes) {
        assert.ok(d.trim().length > 0, `${nombre} · ${codigo} tiene un descarte en blanco`);
      }
    }
  }
});

test('`dato_faltante` está en las dos listas y NO dice lo mismo', () => {
  /* El código es el mismo porque significa lo mismo —falta un dato— pero contra qué se mide si
     faltaba es distinto: en pre-agenda es «el prompt SÍ lo contesta y el agente derivó». Un `Record`
     por lista es lo que permite eso; una sola tabla compartida haría que el texto de una etapa juzgara
     el trabajo de la otra. */
  const post = RUBRICA_POST_AGENDA.dato_faltante;
  const pre = RUBRICA_PRE_AGENDA.dato_faltante;
  assert.notEqual(post.disparo, pre.disparo);
  // Y el de pre-agenda se mide contra el prompt, que es la diferencia concreta.
  assert.match(pre.disparo, /PROMPT DEL AGENTE SÍ CONTESTA/);
});

test('los criterios que se miden contra el prompt descartan el caso SIN prompt', () => {
  /* Medido: los cuatro espacios de prompt del origen estaban VACÍOS, así que la rama sin prompt es la
     que va a correr. Un criterio que se mide contra el prompt y no descarta su ausencia dispararía
     siempre que no hay prompt — le imputaría al agente lo que el sistema no sabe. */
  for (const rubrica of [RUBRICA_POST_AGENDA, RUBRICA_PRE_AGENDA]) {
    for (const [codigo, t] of Object.entries(rubrica)) {
      if (!/\bprompt\b/i.test(t.disparo)) continue;
      assert.ok(
        t.descartes.some((d) => /SIN PROMPT/.test(d)),
        `${codigo} se mide contra el prompt y no descarta que no haya prompt`,
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · EL CRUCE, QUE ES LO QUE EL COMPILADOR NO VE
// ═══════════════════════════════════════════════════════════════════════════════

test('cada auditor recibe LOS CRITERIOS DE SU AGENTE, ni uno más ni uno menos', () => {
  /* ── LA PRUEBA QUE EL TIPO NO PUEDE HACER ──────────────────────────────────
   *
   * `RUBRICA_DEL_AGENTE` es un `Record<Agente, Record<string, TextoDelCriterio>>`, y las dos rúbricas
   * son asignables a ese valor: **intercambiarlas compila sin una queja**. El efecto sería que el
   * molde de post-agenda escriba los criterios de pre-agenda mientras el esquema le ofrece al modelo
   * los de post-agenda — o sea que el modelo lea cuándo dispara `calificacion_saltada` y solo pueda
   * devolver criterios que nadie le explicó.
   *
   * Y es el cruce medido: en los 59 análisis del origen apareció `calificacion_saltada` en análisis de
   * agentes de post-agenda. El esquema por agente lo hizo inexpresable de un lado; esto lo cierra del
   * otro. */
  for (const agente of AGENTES) {
    const escritos = criteriosEnElTexto(
      instruccionesDelAuditor({ agente, promptDelAgente: null }),
    );
    assert.deepEqual(
      [...escritos].sort(),
      [...CRITERIOS_DEL_AGENTE[agente]].sort(),
      `el molde de ${agente} no escribió sus propios criterios`,
    );
  }
});

test('la misión que se escribe es la del agente que se juzga', () => {
  /* «El agente no preguntó el presupuesto» es una falla grave en pre-agenda y no es NADA en
     post-agenda. La misma línea, dos veredictos opuestos, y lo único que los separa es esta frase:
     fijar la misión al agente equivocado produce hallazgos correctos sobre un trabajo que nadie hizo. */
  const post = instruccionesDelAuditor({ agente: 'chat_post_agenda', promptDelAgente: null });
  const pre = instruccionesDelAuditor({ agente: 'chat_pre_agenda', promptDelAgente: null });

  assert.ok(post.includes(MISION_DEL_AGENTE.chat_post_agenda));
  assert.ok(pre.includes(MISION_DEL_AGENTE.chat_pre_agenda));
  assert.ok(!post.includes(MISION_DEL_AGENTE.chat_pre_agenda));
  assert.ok(!pre.includes(MISION_DEL_AGENTE.chat_post_agenda));

  // Y las dos misiones son distintas: si un día alguien las iguala, lo de arriba pasaría en vacío.
  assert.notEqual(MISION_DEL_AGENTE.chat_post_agenda, MISION_DEL_AGENTE.chat_pre_agenda);
});

test('el molde escribe cada disparo Y cada descarte, no solo los códigos', () => {
  /* El código de un criterio no le dice nada al modelo: lo que decide es el disparo y, sobre todo, el
     descarte. Un molde que enumere los siete códigos y se coma los descartes se ve completo y produce
     el auditor que dispara por parecido semántico. */
  for (const agente of AGENTES) {
    const texto = instruccionesDelAuditor({ agente, promptDelAgente: null });
    for (const [codigo, t] of Object.entries(RUBRICA_DEL_AGENTE[agente])) {
      assert.ok(texto.includes(t.disparo), `falta el disparo de ${codigo} en ${agente}`);
      for (const d of t.descartes) {
        assert.ok(texto.includes(d), `falta un descarte de ${codigo} en ${agente}`);
      }
    }
  }
});

test('el valor neutro se le OFRECE al modelo', () => {
  /* Sin la salida «ninguno» escrita, el modelo tiene que elegir uno de los siete para todo lo que ve,
     y elige el más parecido. El neutro es lo que convierte «esto no encaja» en una respuesta válida en
     vez de en un criterio inventado. */
  for (const agente of AGENTES) {
    const texto = instruccionesDelAuditor({ agente, promptDelAgente: null });
    assert.ok(texto.includes(`«${SIN_CRITERIO}»`), `${agente} no ofrece el valor neutro`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL MOLDE COMPARTIDO
// ═══════════════════════════════════════════════════════════════════════════════

test('las cinco etiquetas de la atribución entran CON su explicación', () => {
  /* El transcript etiqueta cada línea con una de cinco, y el molde tiene que explicar las cinco: una
     etiqueta que aparece en el transcript y no en la rúbrica es una que el modelo interpreta solo.
     Y se arma DESDE `COMO_LEER_LOS_AUTORES`, así que una etiqueta nueva no puede quedarse sin texto. */
  for (const agente of AGENTES) {
    const texto = instruccionesDelAuditor({ agente, promptDelAgente: null });
    for (const [etiqueta, explicacion] of Object.entries(COMO_LEER_LOS_AUTORES)) {
      assert.ok(texto.includes(etiqueta), `falta la etiqueta ${etiqueta}`);
      assert.ok(texto.includes(explicacion), `falta la explicación de ${etiqueta}`);
    }
  }
});

test('las dos reglas que gobiernan el módulo están CABLEADAS al molde', () => {
  /* ── LO QUE ESTA PRUEBA FIJA, Y LO QUE NO ──────────────────────────────────
   *
   * Fija **el cableado**: que las dos constantes lleguen al texto que el modelo lee. No fija su
   * redacción, y no debe: una prueba que congela la prosa de un prompt es una prueba que alguien borra
   * la primera vez que mejora una frase, y ahí se pierde también lo que sí valía.
   *
   * Existe porque una mutación borró la regla de imputación del molde y **las veintiuna pruebas
   * siguieron pasando**. Y no era casualidad: la comprobación de las cinco etiquetas mira las cinco
   * etiquetas, y la comprobación de que el molde es uno solo compara los dos moldes entre sí —una
   * regla que falta en LOS DOS los deja igual de idénticos. Un defecto compartido es invisible para
   * una prueba de simetría, y eso vale para cualquier sección que un día se agregue. */
  for (const agente of AGENTES) {
    const texto = instruccionesDelAuditor({ agente, promptDelAgente: null });
    assert.ok(texto.includes(REGLA_DE_IMPUTACION), `${agente} perdió la regla de imputación`);
    assert.ok(texto.includes(LAS_DOS_SALIDAS), `${agente} perdió la separación de las dos salidas`);
  }

  /* Y las dos dicen lo que tienen que decir, comprobado sobre la constante y no sobre el molde: la
     regla nombra la ÚNICA etiqueta imputable, y la separación dice qué NO es una intervención. */
  assert.ok(REGLA_DE_IMPUTACION.includes(IMPUTABLE));
  assert.match(LAS_DOS_SALIDAS, /JAMÁS una intervención/);
});


test('el tope de hallazgos se le PIDE al modelo, con el número de la constante', () => {
  /* El esquema no lleva máximo de items a propósito —un máximo hace que el modelo trunque en vez de
     elegir— así que pedirlo en palabras es lo único que lo hace elegir. El recorte en código es la
     red, no el mecanismo. */
  const texto = instruccionesDelAuditor({ agente: 'chat_post_agenda', promptDelAgente: null });
  assert.ok(texto.includes(`No reportes más de ${TOPE_DE_HALLAZGOS} hallazgos`));
});

test('el molde es EL MISMO para los dos auditores salvo dos secciones', () => {
  /* ── LA PRUEBA QUE JUSTIFICA QUE EL MOLDE SEA UNO ──────────────────────
   *
   * Los dos moldes se parten por el separador y se comparan sección contra sección. **Exactamente dos
   * pueden diferir**: la misión y los criterios. Las otras —la atribución, la separación entre las dos
   * salidas, el bloque del prompt, lo que no se hace— tienen que ser idénticas byte a byte.
   *
   * Si un día alguien duplica el molde «para tocar solo uno», esto se pone rojo **en el momento de la
   * duplicación** y no meses después, cuando la regla de atribución de las dos copias ya divergió y el
   * segundo auditor produce hallazgos correctos sobre el culpable equivocado.
   *
   * Y la comparación es al revés de la intuitiva: no se afirma cuáles coinciden, se afirma **cuántas
   * difieren**. Así una sección nueva que alguien escriba por agente también aparece acá, en vez de
   * colarse por no estar en la lista. */
  const post = instruccionesDelAuditor({
    agente: 'chat_post_agenda',
    promptDelAgente: null,
  }).split(SEPARADOR);
  const pre = instruccionesDelAuditor({
    agente: 'chat_pre_agenda',
    promptDelAgente: null,
  }).split(SEPARADOR);

  assert.equal(post.length, pre.length, 'los dos moldes no tienen las mismas secciones');

  const distintas = post.map((_, i) => i).filter((i) => post[i] !== pre[i]);
  assert.equal(distintas.length, 2, `difieren ${distintas.length} secciones, no dos`);

  // Y las dos que difieren son la de la misión y la de los criterios, no otras dos.
  assert.ok(post[distintas[0] as number]?.includes('LA MISIÓN DEL AGENTE'));
  assert.ok(post[distintas[1] as number]?.includes('LOS CRITERIOS DE ESTE AGENTE'));
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL PROMPT DE LA EMPRESA, Y SU AUSENCIA
// ═══════════════════════════════════════════════════════════════════════════════

test('el prompt cargado llega VERBATIM al molde', () => {
  /* La mitad comprobable hoy del cierre de la etapa 2: una frase inconfundible guardada tiene que
     llegar hasta el texto que el modelo lee. Si no llega, la lectura no lee lo que la escritura
     escribió — y el defecto se vería como «el modelo ignora el prompt». */
  const prompt = 'REGLA 7: nunca menciones el pimentón dulce de La Vera antes del minuto tres.';
  const texto = instruccionesDelAuditor({ agente: 'chat_pre_agenda', promptDelAgente: prompt });
  assert.ok(texto.includes(prompt));
  assert.match(texto, /fragmento EXACTO/);
});

test('un prompt con saltos y sangría conserva sus espacios', () => {
  /* Un fragmento de prompt tiene viñetas y sangría, y el reemplazo que el modelo devuelve se pega tal
     cual en el prompt real. Normalizar los espacios acá haría que el fragmento citado no coincida con
     el texto guardado, y el técnico no lo encuentre para reemplazarlo. */
  const prompt = '## Tono\n\n  - Cercano, no informal.\n  - Nunca prometas precio.\n';
  const texto = instruccionesDelAuditor({ agente: 'chat_post_agenda', promptDelAgente: prompt });
  assert.ok(texto.includes('  - Cercano, no informal.\n  - Nunca prometas precio.'));
});

test('sin prompt, y con prompt en blanco, se prohíbe la cita inventada', () => {
  /* Los cuatro espacios de prompt del origen estaban VACÍOS: `length(prompt_*) = 0` en las dos
     organizaciones, así que sus 59 análisis salieron sin prompt de referencia. Esta rama es la que va
     a correr, no un caso de borde.

     Y el blanco cuenta como ausente: tratar `'   '` como cargado abriría un bloque de prompt vacío y
     le pediría al modelo que cite un fragmento de la nada. Esa corrección no se puede aplicar y se ve
     igual que una buena. */
  for (const vacio of [null, '', '   ', '\n\n']) {
    const texto = instruccionesDelAuditor({ agente: 'chat_post_agenda', promptDelAgente: vacio });
    assert.match(texto, /EL PROMPT DE ESTE AGENTE NO ESTÁ CARGADO/, `falló con ${JSON.stringify(vacio)}`);
    assert.ok(!texto.includes('<<<PROMPT'), `abrió el bloque con ${JSON.stringify(vacio)}`);
    assert.match(texto, /`fragmento_prompt` va en null SIEMPRE/);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · EL MENSAJE: LOS HECHOS Y EL TRANSCRIPT
// ═══════════════════════════════════════════════════════════════════════════════

test('los hechos van ANTES del transcript', () => {
  /* Los hechos corrigen lo que el modelo contaría mal, y una corrección que llega después de cincuenta
     líneas llega después de que el modelo ya contó. */
  const texto = textoDeLaConversacion({ hechos: hechos(), transcript: 'ELTRANSCRIPT' });
  assert.ok(texto.indexOf('HECHOS MEDIDOS') < texto.indexOf('ELTRANSCRIPT'));
});

test('«el agente nunca escribió» no se dice como «hace 0 minutos»', () => {
  /* `null` en `minutosDesdeElAgente` significa que NUNCA escribió. Renderizarlo como `0` afirma lo
     contrario —que acaba de escribir— y sostiene un criterio de abandono al revés. */
  const nunca = textoDeLaConversacion({
    hechos: hechos({ minutosDesdeElAgente: null }),
    transcript: '',
  });
  assert.match(nunca, /El agente NUNCA escribió/);
  assert.ok(!/línea del agente: hace 0 minutos/.test(nunca));

  const recien = textoDeLaConversacion({
    hechos: hechos({ minutosDesdeElAgente: 0 }),
    transcript: '',
  });
  assert.match(recien, /línea del agente: hace 0 minutos/);
  assert.ok(!/NUNCA escribió/.test(recien));
});

test('«no hay ningún mensaje» y «nadie» tampoco se dicen como un número ni en blanco', () => {
  /* Los otros dos tri-estados del bloque, por lo mismo: `minutosDesdeElUltimo` en `null` significa que
     la conversación está vacía, y `ultimoEsDe` en `null` que no hay último. Renderizados como `0` y
     como cadena vacía le dan al modelo una conversación reciente de autor anónimo. */
  const vacia = textoDeLaConversacion({
    hechos: hechos({ minutosDesdeElUltimo: null, ultimoEsDe: null }),
    transcript: '',
  });
  assert.match(vacia, /No hay ningún mensaje\./);
  assert.match(vacia, /Última línea de: nadie\./);
  assert.ok(!/de cualquiera: hace 0 minutos/.test(vacia));
});

test('los tres estados de «¿le respondieron al contacto?» se dicen distinto', () => {
  /* Es la condición (b) del criterio de abandono, y sus tres valores son tres afirmaciones distintas.
     `null` es «el contacto no habló nunca»: decirlo como `false` afirmaría que nadie le respondió a
     alguien que no dijo nada, y eso dispara el abandono sobre una conversación que no existió. */
  const sin = textoDeLaConversacion({
    hechos: hechos({ respondieronAlContacto: null }),
    transcript: '',
  });
  const no = textoDeLaConversacion({
    hechos: hechos({ respondieronAlContacto: false }),
    transcript: '',
  });
  const si = textoDeLaConversacion({
    hechos: hechos({ respondieronAlContacto: true }),
    transcript: '',
  });

  assert.match(sin, /no tiene sujeto/);
  assert.match(no, /NO hubo ninguna línea después/);
  assert.match(si, /SÍ hubo al menos una línea después/);

  // Y ninguno de los tres se puede confundir con otro.
  assert.ok(!/hubo ninguna línea después/.test(sin));
  assert.ok(!/no tiene sujeto/.test(no));
});

test('los autores con cero mensajes NO se listan', () => {
  /* Listar «AUTOMATIZACIÓN: 0» le pone al modelo una categoría que en esta conversación no existe, y
     lo invita a razonar sobre ella. Los hechos son lo que hay, no el catálogo. */
  const texto = textoDeLaConversacion({ hechos: hechos(), transcript: '' });
  assert.match(texto, /CONTACTO: 4/);
  assert.match(texto, /AGENTE IA: 5/);
  assert.ok(!texto.includes('AUTOMATIZACIÓN'));
  assert.ok(!texto.includes('ORIGEN NO IDENTIFICADO'));
});

test('el umbral de silencio aparece UNA sola vez en todo el prompt', () => {
  /* ── UN NÚMERO ESCRITO DOS VECES ES UN NÚMERO QUE UN DÍA DIFIERE ───────────
   *
   * El criterio de abandono se decide contra este umbral, y el texto del criterio remite a «el umbral
   * que los hechos declaran» justamente para no repetirlo. Si además estuviera escrito en la rúbrica,
   * subir la constante dejaría al modelo con dos umbrales distintos en el mismo prompt y decidiendo con
   * el que leyó primero.
   *
   * Se usa un valor inconfundible para que la cuenta no tropiece con otro número del texto. */
  const umbral = 137;
  const prompt =
    instruccionesDelAuditor({ agente: 'chat_post_agenda', promptDelAgente: null }) +
    textoDeLaConversacion({
      hechos: hechos({ umbralDeSilencioMin: umbral }),
      transcript: '',
    });
  assert.equal(prompt.split(String(umbral)).length - 1, 1);
});

test('el mensaje termina pidiendo la herramienta', () => {
  /* La herramienta va forzada en el cuerpo, y además se pide en palabras: la última línea es la que el
     modelo lee más cerca de decidir. */
  const texto = textoDeLaConversacion({ hechos: hechos(), transcript: 'x' });
  assert.match(texto, /Registrá el veredicto con la herramienta\.$/);
});
