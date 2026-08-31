// La DERIVACIÓN del nivel, y los dos vocabularios que no pueden divergir. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL MODELO DEVUELVE UN NIVEL, Y NO ES EL QUE SE GUARDA
//
// La base tiene la invariante `rojo ⟺ pide intervención` como restricción de tabla, así que un modelo
// que devuelva «amarillo» junto a `intervención: true` **tumbaría la escritura entera** y el análisis
// se perdería — **con la inferencia ya pagada**, que es el peor final posible.
//
// Derivar convierte un error del modelo en una fila correcta. Estas pruebas fijan que la derivación
// produzca exactamente lo que la base acepta, para que las dos mitades no puedan discrepar.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, archivosFuente } from '../apoyo/fuente.ts';
import {
  AGENTES,
  AGENTE_DEL_TERRITORIO,
  CATEGORIAS,
  CRITERIOS_DEL_AGENTE,
  CRITERIOS_POST_AGENDA,
  CRITERIOS_PRE_AGENDA,
  NIVELES,
  SENTIMIENTOS,
  SEVERIDADES,
  SIN_CRITERIO,
  TERRITORIO_DEL_AGENTE,
  criterioValido,
  nivelDerivado,
  normalizarPatron,
  type Nivel,
} from '../../lib/auditor/veredicto.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LA DERIVACIÓN: el producto completo
// ═══════════════════════════════════════════════════════════════════════════════

test('las 32 combinaciones de la derivación dan el nivel que la base acepta', async () => {
  /* auditable × intervención × (0 o 2 hallazgos) × el nivel que pidió el modelo (4, contando el nulo)
     = 32. Se barren todas, y lo esperado está escrito, no derivado del código bajo prueba.
   *
   * La aserción que importa no es solo «da este nivel»: es que **el nivel derivado y la intervención
   * satisfagan la invariante de la base en las 32**. Si no, hay una entrada del modelo que hace perder
   * el análisis. */
  const PEDIDOS: (Nivel | null)[] = [...NIVELES, null];
  let combinaciones = 0;

  for (const auditable of [true, false]) {
    for (const intervencion of [true, false]) {
      for (const hallazgos of [0, 2]) {
        for (const pidioElModelo of PEDIDOS) {
          combinaciones++;
          const nivel = nivelDerivado({ auditable, intervencion, hallazgos, pidioElModelo });

          // Lo esperado, escrito a mano según las cuatro reglas.
          const esperado: Nivel | null = !auditable
            ? null
            : intervencion
              ? 'rojo'
              : hallazgos > 0
                ? 'amarillo'
                : pidioElModelo === 'amarillo'
                  ? 'amarillo'
                  : 'verde';

          const caso =
            `auditable=${auditable} intervencion=${intervencion} hallazgos=${hallazgos} ` +
            `pidio=${String(pidioElModelo)}`;
          assert.equal(nivel, esperado, caso);

          /* ── LA MITAD QUE NINGUNA OTRA ASERCIÓN DA ────────────────────────────
           *
           * La invariante de la base, comprobada sobre lo que la derivación produce. Es lo único que
           * garantiza que **ninguna entrada del modelo pueda hacer perder una inferencia pagada**: si
           * la derivación devolviera «amarillo» con intervención, el `insert` reventaría y el análisis
           * se iría con él.
           *
           * Es la misma expresión del `check` de la migración 027, con su `coalesce`. */
          assert.equal(
            (nivel ?? '') === 'rojo',
            intervencion && auditable,
            `la derivación viola la invariante de la base en: ${caso}`,
          );
        }
      }
    }
  }
  assert.equal(combinaciones, 32, 'el barrido dejó de ser exhaustivo');
});

test('sin auditar no hay veredicto, y eso corta ANTES que todo lo demás', async () => {
  /* La precondición se decide antes de evaluar, y **no se fuerza un veredicto**: sin ninguna línea del
     agente no hay nada que auditar, y bajo ninguna circunstancia eso es una falla del agente — **es la
     ausencia de un agente**.
   *
   * Se comprueba con las entradas que más empujarían hacia un nivel: intervención pedida, hallazgos, y
   * un nivel explícito del modelo. Ninguna alcanza. */
  for (const pidioElModelo of [...NIVELES, null]) {
    assert.equal(
      nivelDerivado({ auditable: false, intervencion: true, hallazgos: 3, pidioElModelo }),
      null,
      `una conversación no auditable salió con nivel (el modelo pidió ${String(pidioElModelo)})`,
    );
  }
});

test('la intervención manda sobre lo que pidió el modelo', async () => {
  /* Es la definición de rojo, y es la regla que evita perder la inferencia: la base rechaza cualquier
     otro nivel junto a una intervención. */
  for (const pidioElModelo of [...NIVELES, null]) {
    assert.equal(
      nivelDerivado({ auditable: true, intervencion: true, hallazgos: 0, pidioElModelo }),
      'rojo',
      `con intervención el nivel no fue rojo (el modelo pidió ${String(pidioElModelo)})`,
    );
  }
});

test('un amarillo pedido SIN hallazgos se honra, y un verde pedido CON hallazgos no', async () => {
  /* Las dos mitades de la regla 4, que es la única que mira lo que dijo el modelo.
   *
   * **Se honra el amarillo** porque pisarlo a verde escondería una señal que el modelo levantó, y
   * porque un amarillo sin patrón se VE en la pantalla del técnico —una fila sin nada que ajustar— y
   * eso es un defecto medible de la rúbrica, no un problema silencioso.
   *
   * **No se honra el verde** cuando hay hallazgos: el hallazgo ya es la prueba de que había algo
   * observable, con su cita y su patrón. Ahí el modelo se contradice a sí mismo y gana el hecho. */
  assert.equal(
    nivelDerivado({ auditable: true, intervencion: false, hallazgos: 0, pidioElModelo: 'amarillo' }),
    'amarillo',
    'un amarillo pedido sin hallazgos se pisó a verde: eso esconde la señal que el modelo levantó',
  );
  assert.equal(
    nivelDerivado({ auditable: true, intervencion: false, hallazgos: 2, pidioElModelo: 'verde' }),
    'amarillo',
    'un verde pedido con dos hallazgos se honró: el hallazgo ya prueba que había algo observable',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LOS CRITERIOS: dos listas, y el cruce que la medición encontró
// ═══════════════════════════════════════════════════════════════════════════════

test('un criterio del OTRO territorio cae al valor neutro, no se acepta', async () => {
  /* ── ESTA PRUEBA EXISTE POR UNA MEDICIÓN ───────────────────────────────────
   *
   * En los 59 análisis reales de la plataforma anterior apareció **`calificacion_saltada` —un criterio
   * de pre-agenda— en análisis de agentes de POST-agenda**. O su enumerado era compartido, o el modelo
   * no estaba acotado a la lista de su territorio.
   *
   * El daño no es un error visible: es un veredicto que juzga el trabajo equivocado, con la forma de
   * uno bueno. «Abandonó la conversación» en post-agenda es dejar colgada una cita; en pre-agenda el
   * contacto todavía no agendó, y es otra cosa. */
  const soloDePreAgenda = CRITERIOS_PRE_AGENDA.filter((c) => !CRITERIOS_POST_AGENDA.includes(c as never));
  const soloDePostAgenda = CRITERIOS_POST_AGENDA.filter((c) => !CRITERIOS_PRE_AGENDA.includes(c as never));

  assert.ok(soloDePreAgenda.length >= 3, 'pre-agenda tiene que tener criterios propios');
  assert.ok(soloDePostAgenda.length >= 3, 'post-agenda tiene que tener criterios propios');

  for (const criterio of soloDePreAgenda) {
    assert.equal(
      criterioValido('chat_post_agenda', criterio),
      SIN_CRITERIO,
      `el criterio de pre-agenda «${criterio}» se aceptó en un análisis de post-agenda`,
    );
    assert.equal(criterioValido('chat_pre_agenda', criterio), criterio);
  }
  for (const criterio of soloDePostAgenda) {
    assert.equal(
      criterioValido('chat_pre_agenda', criterio),
      SIN_CRITERIO,
      `el criterio de post-agenda «${criterio}» se aceptó en un análisis de pre-agenda`,
    );
    assert.equal(criterioValido('chat_post_agenda', criterio), criterio);
  }
});

test('el criterio compartido vale en los DOS, y es exactamente uno', async () => {
  /* Tres criterios de pre-agenda no tienen equivalente —los de calificación— y **uno se comparte tal
     cual**, porque significa lo mismo en las dos etapas. Que sea exactamente uno está fijado para que
     ampliar la intersección sea una decisión y no un descuido: un criterio compartido de más borra la
     diferencia entre las dos rúbricas de a poco. */
  const compartidos = CRITERIOS_POST_AGENDA.filter((c) => CRITERIOS_PRE_AGENDA.includes(c as never));
  assert.deepEqual(
    compartidos,
    ['dato_faltante'],
    'cambió qué criterios comparten las dos rúbricas. Un compartido de más borra la diferencia entre ' +
      'ellas, que es justo lo que este módulo separa',
  );
  for (const agente of AGENTES) {
    assert.equal(criterioValido(agente, 'dato_faltante'), 'dato_faltante');
  }
});

test('lo desconocido cae al neutro y NO tira el análisis', async () => {
  /* Perder la inferencia por un criterio mal escrito sería el peor cambio posible. Lo inválido se
     descarta **por partes**: un criterio desconocido cae al neutro, y el veredicto se guarda. */
  for (const basura of ['inventado', '', '   ', 'CALIFICACION_SALTADA_X', null, undefined]) {
    assert.equal(
      criterioValido('chat_post_agenda', basura),
      SIN_CRITERIO,
      `«${String(basura)}» no cayó al neutro`,
    );
  }
  // Y lo válido con ruido de formato sí se reconoce: el modelo puede devolverlo en mayúsculas.
  assert.equal(criterioValido('chat_post_agenda', '  Promesa_Incorrecta  '), 'promesa_incorrecta');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL PATRÓN: lo que la base va a aceptar, y nada más
// ═══════════════════════════════════════════════════════════════════════════════

test('lo que `normalizarPatron` devuelve SIEMPRE pasa el `check` de la base', async () => {
  /* ── LA GUARDA QUE UNE LAS DOS CAPAS ───────────────────────────────────────
   *
   * El formato lo hace cumplir la base y lo normaliza el código. Si el normalizador devolviera algo
   * que el `check` rechaza, **el hallazgo tumbaría la escritura del análisis entero** — y con él el
   * veredicto, el resumen y los otros hallazgos. Tirar un hallazgo es mejor que tirar un análisis, y
   * eso solo funciona si el descarte pasa acá y no en la base.
   *
   * El patrón de esta prueba es el MISMO texto del `check`, leído del archivo de la migración en vez de
   * copiado: dos copias de una expresión regular divergen en la primera corrección. */
  const sql = readFileSync(join(RAIZ, 'db', 'migraciones', '027_veredicto_del_auditor.sql'), 'utf8');
  const delCheck = /check\s*\(patron\s*~\s*'([^']+)'\)/.exec(sql);
  assert.ok(delCheck, 'no se encontró el `check` del patrón en la migración 027');
  const deLaBase = new RegExp(delCheck[1] as string);

  const entradas = [
    'promete_financiamiento_inexistente',
    'Promesa Incorrecta',
    'no-maneja-frustracion',
    'presión_sin_calificar',
    '  ESPACIOS  ',
    'ab',
    'a'.repeat(60),
    '!!!',
    'caso_juan_pérez',
    'doble__guion',
    '_bordes_',
    '',
    'ÑOÑO_con_eñe',
    '¿pregunta?',
    'emoji_🙂_adentro',
  ];
  for (const entrada of entradas) {
    const salida = normalizarPatron(entrada);
    if (salida === null) continue;
    assert.ok(
      deLaBase.test(salida),
      `«${entrada}» se normalizó a «${salida}», que el \`check\` de la base RECHAZA: ese hallazgo ` +
        'tumbaría la escritura del análisis entero',
    );
  }

  // Y los acentos se van de verdad, que es el caso que una expresión regular mal escrita deja pasar.
  assert.equal(normalizarPatron('presión_sin_calificar'), 'presion_sin_calificar');
  assert.equal(normalizarPatron('ÑOÑO_con_eñe'), 'nono_con_ene');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LA FORMA: una sola derivación de los vocabularios
// ═══════════════════════════════════════════════════════════════════════════════

test('los vocabularios están declarados UNA vez, y la base los repite con su motivo', async () => {
  /* ── EL DEFECTO QUE ESTA GUARDA CIERRA, Y ES DE LA PLATAFORMA ANTERIOR ─────
   *
   * Allá la base aceptaba los cuatro agentes y el código que registraba un ajuste validaba contra
   * **una lista escrita a mano** con los dos de chat. Consecuencia: un patrón de voz devolvía «agente
   * inválido», no se podía cerrar desde el botón, y su reincidencia **no se podía calcular nunca**.
   *
   * Su propia documentación nombra la regla que se rompió: **la de una sola derivación**. Así que acá
   * los vocabularios se declaran en `lib/auditor/veredicto.ts` y ningún otro archivo del auditor los
   * escribe a mano.
   *
   * La base los repite —son un `check`— y eso es la excepción declarada: son dos capas, no dos listas.
   * Y esta prueba comprueba que digan lo mismo. */
  const sql = readFileSync(join(RAIZ, 'db', 'migraciones', '027_veredicto_del_auditor.sql'), 'utf8');
  const enLaBase = (columna: string): string[] => {
    const m = new RegExp(`check\\s*\\(${columna}\\s+in\\s*\\(([^)]+)\\)`).exec(sql);
    assert.ok(m, `no se encontró el \`check\` de «${columna}» en la migración 027`);
    return [...(m[1] as string).matchAll(/'([^']+)'/g)].map((x) => x[1] as string).sort();
  };

  assert.deepEqual([...AGENTES].sort(), enLaBase('agente'), 'los agentes del código y de la base difieren');
  assert.deepEqual([...NIVELES].sort(), enLaBase('nivel'), 'los niveles difieren');
  assert.deepEqual([...SENTIMIENTOS].sort(), enLaBase('sentimiento'), 'los sentimientos difieren');
  assert.deepEqual([...SEVERIDADES].sort(), enLaBase('severidad'), 'las severidades difieren');
  assert.deepEqual([...CATEGORIAS].sort(), enLaBase('categoria'), 'las categorías difieren');

  /* Y ningún otro archivo del auditor escribe uno de estos literales. Se busca sobre el texto SIN
     comentarios: este archivo y `veredicto.ts` los citan en sus propias explicaciones. */
  const culpables: string[] = [];
  for (const a of archivosFuente(['lib', 'app', 'components'])) {
    if (a.ruta === 'lib/auditor/veredicto.ts') continue;
    if (!a.ruta.startsWith('lib/auditor/') && !a.ruta.includes('auditoria')) continue;
    for (const literal of [...AGENTES, 'chat_voz_post_agenda', 'chat_voz_pre_agenda']) {
      if (a.limpio.includes(`'${literal}'`)) culpables.push(`${a.ruta}: '${literal}'`);
    }
  }
  assert.deepEqual(
    culpables,
    [],
    'un archivo del auditor escribe el nombre de un agente a mano. Es el defecto exacto que la ' +
      'plataforma anterior pagó: dos listas del mismo hecho, y la que quedó atrás dejó a los ' +
      'patrones de voz sin poder cerrarse ni medir su reincidencia',
  );
});

test('el territorio y el agente se corresponden en las dos direcciones', async () => {
  /* Un `Record<Territorio, Agente>` en vez de un `if`, por `ADR-0302` y porque **no compila** el día
     que aparezca un tercer territorio. Y las dos vueltas tienen que ser inversas: si no, un análisis
     guardado con un agente se leería como de otro territorio, y la cola de urgentes del rol equivocado
     mostraría el fallo del agente ajeno — que es el defecto que `FALLOS_DEL_AUDITOR` ya pagó. */
  for (const territorio of ['closer', 'setter'] as const) {
    assert.equal(TERRITORIO_DEL_AGENTE[AGENTE_DEL_TERRITORIO[territorio]], territorio);
  }
  for (const agente of AGENTES) {
    assert.equal(AGENTE_DEL_TERRITORIO[TERRITORIO_DEL_AGENTE[agente]], agente);
  }
  // Y cada agente tiene su lista de criterios: sin eso, `criterioValido` reventaría al indexar.
  for (const agente of AGENTES) {
    assert.ok(CRITERIOS_DEL_AGENTE[agente].length === 7, `el agente «${agente}» no tiene siete criterios`);
  }
});
