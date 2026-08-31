// La ATRIBUCIÓN del auditor: sus cinco etiquetas y la única imputable. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTA ES LA PRIMERA PRUEBA DEL MÓDULO
//
// La regla que `lib/auditor/atribucion.ts` hace cumplir es la que su propia documentación llama
// innegociable: **solo se le puede imputar al agente lo que dice una línea del agente**.
//
// Y el modo de fallar no es un error: es un hallazgo **convincente y falso**. El auditor le imputa al
// agente el enojo que provocó una plantilla automática, y propone corregir un prompt que no escribió
// esa línea. Nada revienta, la pantalla se ve completa, y el técnico ajusta un prompt por un problema
// que está en otro lado.
//
// Es una prueba de Código y no de Base porque `atribuir` es **isomorfa a propósito** —sin base, sin
// red, sin React— y eso se aprovecha: se puede barrer el espacio de entradas completo.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMO_LEER_LOS_AUTORES,
  IMPUTABLE,
  atribuir,
  type AutorDeLaLinea,
  type LineaAAtribuir,
} from '../../lib/auditor/atribucion.ts';
import { archivosFuente } from '../apoyo/fuente.ts';

/** El identificador del agente, con la forma real: 20 caracteres, como los de GoHighLevel. */
const AGENTE = '0peGoq7VvFqnDGA7gxtX';
/** Otro identificador válido que NO es el del agente. Un asesor, o una integración desconocida. */
const OTRO = 'JJxGem987J7MRKced71Z';

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL BARRIDO COMPLETO: las 24 combinaciones posibles
// ═══════════════════════════════════════════════════════════════════════════════

test('las 24 combinaciones de entrada producen exactamente una etiqueta, y la esperada', () => {
  /* Dos direcciones × tres autores × cuatro identificadores (el del agente, otro, nulo, ausente) =
     24. Se barren TODAS y cada una lleva escrita su etiqueta esperada.
   *
   * Se hace exhaustivo y no con casos elegidos porque el espacio es chico y el costo de una rama sin
   * medir es alto: la rama que se olvide va a ser la que atribuya mal, y no lo va a decir. */
  const IDENTIFICADORES: (string | null | undefined)[] = [AGENTE, OTRO, null, undefined];
  const AUTORES: LineaAAtribuir['autor'][] = ['contacto', 'agente', 'persona'];

  /** Lo que se espera de cada combinación, escrito y no derivado. */
  const esperado = (
    direccion: 'entrante' | 'saliente',
    autor: LineaAAtribuir['autor'],
    id: string | null | undefined,
  ): AutorDeLaLinea => {
    if (direccion === 'entrante') return 'CONTACTO';
    if (autor === 'persona') return 'ASESOR HUMANO';
    if (id === AGENTE) return 'AGENTE IA';
    if (id === null || id === undefined) return 'AUTOMATIZACIÓN';
    return 'ORIGEN NO IDENTIFICADO';
  };

  let combinaciones = 0;
  for (const direccion of ['entrante', 'saliente'] as const) {
    for (const autor of AUTORES) {
      for (const id of IDENTIFICADORES) {
        combinaciones++;
        const linea: LineaAAtribuir = { direccion, autor, autor_ghl_usuario_id: id };
        assert.equal(
          atribuir(linea, AGENTE),
          esperado(direccion, autor, id),
          `direccion=${direccion} autor=${autor} id=${String(id)}`,
        );
      }
    }
  }
  assert.equal(combinaciones, 24, 'el barrido dejó de ser exhaustivo');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LOS TRES FALSOS POSITIVOS QUE ESTA FUNCIÓN EXISTE PARA CERRAR
// ═══════════════════════════════════════════════════════════════════════════════

test('un saliente SIN identificador NO es el agente: es una automatización', () => {
  /* El falso positivo principal, y el más caro. Medido en producción el 2026-08-31: **919 de 2.737
     salientes no traen identificador**, y son los flujos automáticos del CRM.
   *
   * `mensajes.autor` los marca `'agente'` —lo hace `autorDe()` en la ingesta para todo saliente cuya
   * fuente no sea `app`— así que un auditor que se fiara de esa columna le imputaría al agente 919
   * mensajes que no escribió. Entre ellos, las plantillas que provocan el enojo del contacto: el
   * primero de los cinco defectos que el diseño de origen enumera. */
  assert.equal(
    atribuir({ direccion: 'saliente', autor: 'agente', autor_ghl_usuario_id: null }, AGENTE),
    'AUTOMATIZACIÓN',
    'un saliente sin identificador se atribuyó al agente: son 919 mensajes en producción, y con ' +
      'ellos las plantillas automáticas cuya bronca el auditor le cargaría al agente',
  );
  // Y ausente es lo mismo que nulo: la fila puede no traer la columna.
  assert.equal(
    atribuir({ direccion: 'saliente', autor: 'agente' }, AGENTE),
    'AUTOMATIZACIÓN',
  );
});

test('sin agente configurado NADA es imputable, y eso es el estado seguro', () => {
  /* `idDelAgente` nulo significa que esa empresa no configuró quién es su agente. La tentación es
     tratarlo como «entonces todo lo automático es del agente», y es exactamente al revés: sin saber
     quién es el agente, **no hay ninguna línea imputable**.
   *
   * La migración 026 lo dice: adivinar la atribución es peor que no auditar. Esta aserción es la que
   * hace que «no configurado» sea un estado seguro y no un estado que atribuye todo. */
  for (const id of [AGENTE, OTRO, null, undefined]) {
    const etiqueta = atribuir(
      { direccion: 'saliente', autor: 'agente', autor_ghl_usuario_id: id },
      null,
    );
    assert.notEqual(
      etiqueta,
      IMPUTABLE,
      `sin agente configurado, un saliente con id=${String(id)} salió como imputable`,
    );
  }
});

test('un identificador DESCONOCIDO no se adivina: no es el contacto ni el asesor', () => {
  /* La rama que el diseño de origen llama «la trampa»: cuando todo lo que no era del agente se le
     presentaba al modelo como dicho por la persona, los turnos de herramienta entraban *como si el
     contacto los hubiera pronunciado* — y sobre esa base el auditor le imputa a una persona real algo
     que escribió una función.
   *
   * Y tampoco se adivina «asesor humano»: con esa etiqueta el auditor daría por **traspasada** una
   * conversación que nadie tomó, que es el segundo de los cinco defectos. */
  const etiqueta = atribuir(
    { direccion: 'saliente', autor: 'agente', autor_ghl_usuario_id: OTRO },
    AGENTE,
  );
  assert.equal(etiqueta, 'ORIGEN NO IDENTIFICADO');
  assert.notEqual(etiqueta, 'CONTACTO', 'un origen desconocido se atribuyó al contacto');
  assert.notEqual(etiqueta, 'ASESOR HUMANO', 'un origen desconocido se dio por traspaso');
});

test('«persona» gana sobre el identificador del agente, y la asimetría es deliberada', () => {
  /* El caso raro: una fila marcada como escrita por una persona que además trae el identificador del
     agente. No debería pasar, y si pasa gana «persona».
   *
   * El motivo es el mismo que la ingesta escribió para su propia asimetría: dar por humano algo
   * automático **no le pone el nombre de nadie a nada**; dar por automático algo que escribió una
   * persona sí — y acá, encima, lo volvería imputable. Entre los dos errores se elige el que no
   * imputa. */
  assert.equal(
    atribuir({ direccion: 'saliente', autor: 'persona', autor_ghl_usuario_id: AGENTE }, AGENTE),
    'ASESOR HUMANO',
    'una fila marcada como escrita por una persona se volvió imputable por traer el identificador ' +
      'del agente',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LA FORMA: una sola etiqueta imputable, y la instrucción viaja con ella
// ═══════════════════════════════════════════════════════════════════════════════

test('hay UNA sola etiqueta imputable, y las otras cuatro dicen que no imputan', () => {
  /* Si mañana alguien agrega una etiqueta nueva, esta prueba obliga a decidir de qué lado cae y a
     escribirle su instrucción. Sin eso, una etiqueta nueva llegaría al modelo sin decir si se le
     puede imputar algo — y el modelo, ante la duda, imputa. */
  const todas = Object.keys(COMO_LEER_LOS_AUTORES) as AutorDeLaLinea[];
  assert.equal(todas.length, 5, 'cambió la cantidad de etiquetas: hay que decidir si la nueva imputa');
  assert.ok(todas.includes(IMPUTABLE));

  /* La instrucción de la imputable lo dice; las otras cuatro dicen lo contrario. Se busca la
     afirmación, no una palabra: lo que el modelo lee es esta frase. */
  assert.match(
    COMO_LEER_LOS_AUTORES[IMPUTABLE],
    /única l[íi]nea a la que le pod[ée]s imputar/i,
    'la etiqueta imputable no dice que es la única imputable',
  );

  for (const etiqueta of todas.filter((e) => e !== IMPUTABLE)) {
    const texto = COMO_LEER_LOS_AUTORES[etiqueta];
    assert.ok(
      /NO (la )?escribi[óo] el agente|no imputes|NO es del agente|persona a la que se atiende/i.test(texto),
      `la instrucción de «${etiqueta}» no le dice al modelo que esa línea no es del agente: ` +
        `«${texto}»`,
    );
  }
});

test('la atribución se decide en UN solo lugar', () => {
  /* ── POR QUÉ ESTA GUARDA, Y CONTRA QUÉ ─────────────────────────────────────
   *
   * La tentación concreta: al armar el transcript, o al contar los mensajes del agente para el
   * debounce, escribir `autor === 'agente'` porque es más corto. Eso reintroduce el cajón de sastre
   * en un lugar distinto del que se arregló, y las dos mitades del módulo empezarían a discrepar
   * sobre quién es el agente — una para juzgar y otra para decidir cuándo juzgar.
   *
   * Se busca la FORMA de la comparación en todo `lib/auditor/`, sobre el texto sin comentarios: este
   * archivo cita `autor === 'agente'` en su propia explicación. */
  const delAuditor = archivosFuente(['lib']).filter((a) => a.ruta.startsWith('lib/auditor/'));
  assert.ok(delAuditor.length > 0, 'no se encontró el módulo del auditor');

  const culpables: string[] = [];
  for (const a of delAuditor) {
    if (a.ruta === 'lib/auditor/atribucion.ts') continue;
    for (const m of a.limpio.matchAll(/autor\s*===?\s*['"`]agente['"`]/g)) {
      culpables.push(`${a.ruta}: ${m[0]}`);
    }
  }
  assert.deepEqual(
    culpables,
    [],
    'un archivo del auditor compara `autor` con «agente» por su cuenta. Esa columna es un cajón de ' +
      'sastre que mezcla al agente de IA con las automatizaciones del CRM: la única forma correcta ' +
      'de preguntar quién dijo una línea es `atribuir(...)`',
  );
});
