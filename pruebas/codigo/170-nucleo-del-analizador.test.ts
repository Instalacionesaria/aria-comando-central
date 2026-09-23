// EL NÚCLEO PORTADO DE LOS ANALIZADORES. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/analizadores/nucleo/` es la parte de ARIA Brain que se copió en vez de reescribirse: las tres
// rúbricas, los tres esquemas de salida y los normalizadores. Su valor está en que **juzga igual que
// el origen**, y un porte que cambia el juicio no falla: produce informes distintos que se leen igual
// de bien.
//
// Por eso hay tres grupos:
//
//   · **Los casos del origen** (`analyzer.test.ts`, 25), portados de vitest. Los dos de `extractJson`
//     viven en la 171, junto al transporte donde está esa función.
//   · **Las huellas.** Un sha256 de cada rúbrica y de cada esquema, sacado de la copia byte a byte
//     (verificada contra el MANIFIESTO del paquete el 2026-09-22). Cambiar un carácter del prompt,
//     reordenar un `$defs` o «arreglar» una tilde lo pone en rojo, y obliga a subir la versión.
//   · **Lo que cambió a propósito**: la fase que el origen perdía, y el costo que ya no se inventa.
//
// Sin red ni base: todo lo de acá son funciones puras de texto.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseTranscriptInput, formatTranscript } from '../../lib/analizadores/nucleo/transcript.ts';
import { buildAnalyzerSystem, buildInsightSystem } from '../../lib/analizadores/nucleo/defs.ts';
import { OB_DEF, type Onboarding } from '../../lib/analizadores/nucleo/ob.ts';
import { HT_DEF, deriveScoreColor, type Analysis } from '../../lib/analizadores/nucleo/ht.ts';
import { getAnalyzer, enabledAnalyzers } from '../../lib/analizadores/nucleo/registry.ts';
import { getInsightDef, insightsFor } from '../../lib/analizadores/nucleo/insight-registry.ts';
import { PROSPECT_CARD_DEF, type ProspectCard } from '../../lib/analizadores/nucleo/prospect-card.ts';
import {
  CONFIRMED_RATES,
  computeCostUsd,
  type TokenRate,
} from '../../lib/analizadores/nucleo/pricing.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LOS CASOS DEL ORIGEN
// ═══════════════════════════════════════════════════════════════════════════════

test('parseTranscriptInput · texto plano con locutor y marcas de tiempo', () => {
  const t = parseTranscriptInput('[00:10] María: Hola, gracias por la llamada\nAsesor: Bienvenida al programa');
  assert.equal(t.segments.length, 2);
  assert.equal(t.segments[0]?.speaker, 'María');
  assert.equal(t.segments[0]?.startSec, 10);
  assert.equal(t.segments[1]?.speaker, 'Asesor');
  assert.ok(t.fullText.includes('[María]: Hola'));
});

test('parseTranscriptInput · un arreglo JSON de segmentos, como los de tl;dv', () => {
  const raw = JSON.stringify([
    { startTime: '00:05', speaker: 'Ana', text: 'buenos días' },
    { startTime: 12, speaker: 'Coach', text: 'arranquemos' },
  ]);
  const t = parseTranscriptInput(raw);
  assert.equal(t.segments.length, 2);
  assert.equal(t.segments[0]?.startSec, 5);
  assert.equal(t.segments[1]?.startSec, 12);
});

test('parseTranscriptInput · una marca de horas, minutos y segundos', () => {
  /* No estaba en el origen, y cubre la rama de tres partes de `toSec`: es la que el porte tocó para
     satisfacer `noUncheckedIndexedAccess`, así que es la que un error de la guarda rompería. */
  const t = parseTranscriptInput('[1:02:03] Ana: hola');
  assert.equal(t.segments[0]?.startSec, 3723);
});

test('parseTranscriptInput · lanza si está vacía', () => {
  assert.throws(() => parseTranscriptInput('   '));
});

test('formatTranscript · cabecera y líneas con tiempos', () => {
  const t = parseTranscriptInput('Ana: hola', 'manual-1');
  const s = formatTranscript(t);
  assert.ok(s.includes('MEETING_ID: manual-1'));
  assert.ok(s.includes('TRANSCRIPT:'));
  assert.match(s, /\[\d+s-\d+s\] Ana: hola/);
});

test('OB · el system lleva la rúbrica, la compuerta match:false y el esquema', () => {
  const sys = buildAnalyzerSystem(OB_DEF);
  assert.ok(sys.includes('QUIÉN ERES'));
  assert.ok(sys.includes('"match": false'));
  assert.ok(sys.includes('clientEmail'));
  assert.ok(sys.includes('readiness'));
});

test('OB · normalize rellena los valores por omisión de un objeto parcial', () => {
  const p = OB_DEF.normalize({ primaryName: 'María', readiness: 'listo' }) as Onboarding;
  assert.equal(p.primaryName, 'María');
  assert.equal(p.readiness, 'LISTO');
  assert.ok(Array.isArray(p.participants));
  assert.ok(Array.isArray(p.keyMoments));
  assert.equal(p.setup.slack, 'NO');
  assert.equal(p.commitmentLevel, 'MEDIO');
});

test('OB · listColumns deriva readiness y summary', () => {
  const p = OB_DEF.normalize({ readiness: 'PARCIAL', summary: 'ok' });
  const cols = OB_DEF.listColumns(p);
  assert.equal(cols.readiness, 'PARCIAL');
  assert.equal(cols.summary, 'ok');
});

test('registro · OB y HT están registrados, y OTRO no', () => {
  /* OB se registra aunque la fase OB llegue después: si faltara, el clasificador no la conocería,
     cada onboarding saldría OTRO y el descarte por identificador externo la sellaría para siempre.
     Lo que se analiza lo decide otra constante, no este registro. */
  assert.equal(getAnalyzer('OB')?.tipo, 'OB');
  assert.equal(getAnalyzer('HT')?.tipo, 'HT');
  assert.equal(getAnalyzer('OTRO'), null);
  assert.deepEqual(
    enabledAnalyzers().map((d) => d.tipo).sort(),
    ['HT', 'OB'],
  );
});

test('HT · deriveScoreColor', () => {
  assert.equal(deriveScoreColor(9), 'VERDE');
  assert.equal(deriveScoreColor(5), 'AMARILLO');
  assert.equal(deriveScoreColor(2), 'ROJO');
});

test('HT · el system lleva la rúbrica v8, la compuerta y el esquema', () => {
  const sys = buildAnalyzerSystem(HT_DEF);
  assert.ok(sys.includes('Versión 8'));
  assert.ok(sys.includes('"match": false'));
  assert.ok(sys.includes('phaseScores'));
  assert.ok(sys.includes('scoreJustification'));
});

test('HT · normalize rellena, recorta el puntaje y fuerza los enumerados', () => {
  const a = HT_DEF.normalize({ score: 99, outcome: 'cerrada', client: { interestLevel: 'alto' } }) as Analysis;
  assert.equal(a.score, 10);
  assert.equal(a.outcome, 'CERRADA');
  assert.equal(a.client.interestLevel, 'ALTO');
  assert.equal(a.client.budget.ability, 'DESCONOCIDO');
  assert.ok(Array.isArray(a.seller.phaseScores));
  assert.ok(Array.isArray(a.keyMoments));
});

test('HT · normalize conserva la evidencia opcional', () => {
  const a = HT_DEF.normalize({
    seller: { strengths: [{ title: 't', description: 'd', evidence: { startSec: 5, endSec: 9 } }] },
  }) as Analysis;
  assert.equal(a.seller.strengths[0]?.evidence?.startSec, 5);
  const b = HT_DEF.normalize({ seller: { strengths: [{ title: 't', description: 'd' }] } }) as Analysis;
  assert.equal(b.seller.strengths[0]?.evidence, undefined);
});

test('HT · listColumns deriva puntaje, resultado y color', () => {
  const a = HT_DEF.normalize({ score: 8, outcome: 'NO_CERRADA' });
  const cols = HT_DEF.listColumns(a);
  assert.equal(cols.score, 8);
  assert.equal(cols.outcome, 'NO_CERRADA');
  assert.equal(cols.scoreColor, 'VERDE');
});

test('ficha · el system lleva la rúbrica y el esquema, pero NO la compuerta', () => {
  /* La llamada ya pasó el clasificador y la compuerta del análisis del closer: una tercera solo
     produciría falsos negativos. */
  const s = buildInsightSystem(PROSPECT_CARD_DEF);
  assert.ok(s.includes('NO CONSTA'));
  assert.ok(s.includes('decisionMakerPresent'));
  assert.ok(s.includes('CONTRATO DE SALIDA'));
  assert.ok(!s.includes('"match": false'));
  assert.ok(!s.includes('PRIMER PASO'));
});

test('ficha · un campo omitido cae a NO_MENCIONADO, no a un valor inventado', () => {
  const c = PROSPECT_CARD_DEF.normalize({}) as ProspectCard;
  assert.equal(c.commercialTerms.price.state, 'NO_MENCIONADO');
  assert.equal(c.commercialTerms.price.value, null);
  assert.equal(c.buyingIntent.decisionMakerPresent.state, 'NO_MENCIONADO');
  assert.deepEqual(c.bottlenecks, []);
});

test('ficha · DETECTADO sin cita se degrada a AMBIGUO (inventar cuesta una cita)', () => {
  const c = PROSPECT_CARD_DEF.normalize({
    commercialTerms: { price: { state: 'DETECTADO', value: '6000 dólares', quote: null, confidence: 'ALTA' } },
  }) as ProspectCard;
  assert.equal(c.commercialTerms.price.state, 'AMBIGUO');
  assert.notEqual(c.commercialTerms.price.confidence, 'ALTA');
});

test('ficha · DETECTADO con cita se conserva', () => {
  const c = PROSPECT_CARD_DEF.normalize({
    commercialTerms: {
      price: { state: 'DETECTADO', value: '6000 dólares', quote: 'son seis mil dólares', startSec: 120, endSec: 125, confidence: 'ALTA' },
    },
  }) as ProspectCard;
  assert.equal(c.commercialTerms.price.state, 'DETECTADO');
  assert.equal(c.commercialTerms.price.value, '6000 dólares');
  assert.equal(c.commercialTerms.price.startSec, 120);
});

test('ficha · DETECTADO sin valor no es una detección', () => {
  /* La regla R1 del normalizador. El origen no tenía un caso propio para ella: la cubrían de rebote
     los demás, y un normalizador que la perdiera seguía verde. */
  const c = PROSPECT_CARD_DEF.normalize({
    commercialTerms: { price: { state: 'DETECTADO', value: '', quote: 'algo se dijo', confidence: 'ALTA' } },
  }) as ProspectCard;
  assert.equal(c.commercialTerms.price.state, 'NO_MENCIONADO');
});

test('ficha · un «no consta» escrito dentro del valor se convierte en NO_MENCIONADO', () => {
  const c = PROSPECT_CARD_DEF.normalize({
    commercialTerms: { price: { state: 'DETECTADO', value: 'No consta', quote: 'algo', confidence: 'ALTA' } },
  }) as ProspectCard;
  assert.equal(c.commercialTerms.price.state, 'NO_MENCIONADO');
  assert.equal(c.commercialTerms.price.value, null);
});

test('ficha · decisionMakerPresent acepta «Sí» con tilde y lo normaliza a SI', () => {
  const c = PROSPECT_CARD_DEF.normalize({
    buyingIntent: { decisionMakerPresent: { state: 'DETECTADO', value: 'Sí', quote: 'yo decido', confidence: 'ALTA' } },
  }) as ProspectCard;
  assert.equal(c.buyingIntent.decisionMakerPresent.value, 'SI');
});

test('ficha · una fecha de calendario en dueDateText se descarta (nadie la pronuncia)', () => {
  const c = PROSPECT_CARD_DEF.normalize({
    nextStepsAria: [{ action: 'Enviar propuesta', dueDateText: '2026-09-12', confidence: 'ALTA' }],
    nextStepsProspect: [{ action: 'Pagar', dueDateText: 'el viernes', confidence: 'ALTA' }],
  }) as ProspectCard;
  assert.equal(c.nextStepsAria[0]?.dueDateText, null);
  assert.equal(c.nextStepsProspect[0]?.dueDateText, 'el viernes');
});

test('ficha · notRecorded se deriva en código y lista lo que no se registró', () => {
  const c = PROSPECT_CARD_DEF.normalize({}) as ProspectCard;
  assert.ok(c.notRecorded.includes('Precio'));
  assert.ok(c.notRecorded.includes('Decisor presente'));
});

test('ficha · listColumns deriva intención, decisor y cantidad de riesgos', () => {
  const c = PROSPECT_CARD_DEF.normalize({
    buyingIntent: {
      level: { state: 'DETECTADO', value: 'ALTO', quote: 'quiero empezar ya', confidence: 'ALTA' },
      decisionMakerPresent: { state: 'DETECTADO', value: 'NO', quote: 'lo hablo con mi socio', confidence: 'ALTA' },
    },
    riskFlags: [{ text: 'Es su última oportunidad', kind: 'SUPERVIVENCIA', confidence: 'ALTA' }],
  });
  const cols = PROSPECT_CARD_DEF.listColumns(c);
  assert.equal(cols.intent, 'ALTO');
  assert.equal(cols.decisionMaker, 'NO');
  assert.equal(cols.riskCount, 1);
});

test('ficha · NO contamina el clasificador de tipos de llamada, y es solo de HT', () => {
  assert.equal(getAnalyzer('PROSPECT_CARD'), null);
  assert.equal(getInsightDef('PROSPECT_CARD')?.appliesTo, 'HT');
  assert.deepEqual(insightsFor('OB'), []);
  assert.deepEqual(insightsFor('HT').map((d) => d.kind), ['PROSPECT_CARD']);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LA FASE QUE EL ORIGEN PERDÍA
// ═══════════════════════════════════════════════════════════════════════════════

test('HT · cada fase conserva su nombre, en el orden en que llega', () => {
  /* El defecto medido: el origen comparaba la fase en MAYÚSCULAS contra una lista en minúsculas, y
     las 170 fases de producción quedaron como `apertura_rapport`. El mutante que vuelve a `asEnum`
     deja las cinco en `apertura_rapport` y esta prueba lo ve en la segunda. */
  const nombres = ['apertura_rapport', 'descubrimiento', 'presentacion_oferta', 'manejo_objeciones', 'cierre'];
  const a = HT_DEF.normalize({
    seller: { phaseScores: nombres.map((phase) => ({ phase, score: 6, rationale: 'r', toReachTen: 't' })) },
  }) as Analysis;
  assert.deepEqual(a.seller.phaseScores.map((p) => p.phase), nombres);
});

test('HT · una fase fuera del catálogo cae al valor por omisión, sin inventar otra', () => {
  const a = HT_DEF.normalize({
    seller: { phaseScores: [{ phase: 'CIERRE', score: 5 }, { phase: 'negociacion', score: 5 }] },
  }) as Analysis;
  /* «CIERRE» en mayúsculas es la misma fase: el modelo a veces sube el caso. «negociacion» no existe
     en el esquema, y lo honesto es el valor por omisión, no la fase más parecida. */
  assert.deepEqual(a.seller.phaseScores.map((p) => p.phase), ['cierre', 'apertura_rapport']);
});

test('HT · la versión subió a v8.1, porque lo que se guarda ya no es lo de v8', () => {
  assert.equal(HT_DEF.rubricVersion, 'rubric.es.md@v8.1');
  assert.equal(OB_DEF.rubricVersion, 'rubric.es.md@OB');
  assert.equal(PROSPECT_CARD_DEF.rubricVersion, 'ficha.es@v1');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LAS HUELLAS: el prompt es el del origen, carácter por carácter
// ═══════════════════════════════════════════════════════════════════════════════

const huella = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

/* Sacadas de la copia byte a byte de los anexos, cuyos quince sha256 coincidieron con el MANIFIESTO
   del paquete el 2026-09-22. **Si una cambia a propósito, cambia la versión en el mismo commit**: el
   análisis guarda su `rubricVersion`, y dos prompts distintos con la misma versión no se pueden
   separar después. */
const HUELLAS = {
  HT: {
    rubrica: '8fc85f6dfd84d1e4a052390f299f7879651db778b685f5d710caf28d988d80ea',
    esquema: '84ff02ca121a1dca925c8f24f156cabc718224dfa346b1d55c370ba4664360d9',
  },
  OB: {
    rubrica: '330e08357e39e18bce690014630adaa1228b91007ac5b73a899036deb4e8041f',
    esquema: 'f1a88edba681f67f8796fedcb543dbc3927adc8bfd358cee62eb5907f5946bf6',
  },
  FICHA: {
    rubrica: 'b14a973b5085cf8b86414205282f5a6cddfac30713c4a53b85b2523bd6eae349',
    esquema: 'f96c337706fc4af3370004b6c5a07c6007f6b2006a74838b7eb6416a78fc5b86',
  },
} as const;

test('las tres rúbricas y los tres esquemas son los del origen', () => {
  const defs = { HT: HT_DEF, OB: OB_DEF, FICHA: PROSPECT_CARD_DEF } as const;
  for (const [nombre, def] of Object.entries(defs) as [keyof typeof HUELLAS, typeof HT_DEF | typeof PROSPECT_CARD_DEF][]) {
    assert.equal(huella(def.rubric), HUELLAS[nombre].rubrica, `la rúbrica de ${nombre} cambió`);
    assert.equal(
      huella(JSON.stringify(def.jsonSchema)),
      HUELLAS[nombre].esquema,
      `el esquema de ${nombre} cambió (un campo, un orden o una descripción)`,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL COSTO: nulo sin tarifa confirmada, y con los cuatro contadores
// ═══════════════════════════════════════════════════════════════════════════════

const USO = { input: 10_000, output: 2_000, cacheWrite: 4_000, cacheRead: 30_000 };

test('sin una tarifa confirmada el costo es NULO, no cero', () => {
  /* Un cero dice «no costó nada». El mutante `?? 0` lo produce y pasa cualquier lectura de
     plausibilidad en una tabla de gastos. */
  assert.deepEqual(CONFIRMED_RATES, {});
  assert.equal(computeCostUsd('claude-sonnet-5', USO), null);
  assert.equal(computeCostUsd(null, USO), null);
  assert.equal(computeCostUsd('claude-sonnet-5', null), null);
});

test('con tarifa, el costo suma los CUATRO contadores, caché incluida', () => {
  /* Números inventados a propósito y distintos entre sí, para que cada contador deje su huella en el
     total: el mutante que ignora la lectura de caché —lo que hacía el origen— da 0,08 en vez de
     0,11, y el que la cobra al precio de la entrada da 0,17. */
  const tarifas: Record<string, TokenRate> = {
    prueba: { input: 3, output: 15, cacheWrite: 5, cacheRead: 1 },
  };
  const costo = computeCostUsd('prueba', USO, tarifas);
  const esperado = (10_000 * 3 + 2_000 * 15 + 4_000 * 5 + 30_000 * 1) / 1_000_000;
  assert.ok(costo !== null && Math.abs(costo - esperado) < 1e-12, `costo ${costo}, esperado ${esperado}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LOS DATOS DUROS NO SE LE PIDEN AL MODELO
// ═══════════════════════════════════════════════════════════════════════════════

/** Todos los nombres de propiedad de un esquema, a cualquier profundidad. */
function propiedades(nodo: unknown): string[] {
  if (nodo === null || typeof nodo !== 'object') return [];
  const n = nodo as Record<string, unknown>;
  const aca = n['properties'] && typeof n['properties'] === 'object'
    ? Object.entries(n['properties'] as Record<string, unknown>)
    : [];
  return [
    ...aca.map(([clave]) => clave),
    ...aca.flatMap(([, valor]) => propiedades(valor)),
    ...propiedades(n['items']),
  ];
}

test('ningún esquema de salida pide la fecha, la duración, el enlace ni el organizador', () => {
  /* Son datos que la llamada ya trae de tl;dv. Si el esquema los pidiera, el modelo los escribiría —a
     veces bien, a veces inventados— y la pantalla no tendría forma de saber cuál de los dos mostrar.
     La cabecera de contexto de la ficha los muestra como LECTURA; el esquema no les da lugar.
   *
   * `duration` a secas NO está en la lista, y es a propósito: la ficha tiene `commercialTerms.duration`,
   * que es la duración **del programa ofrecido** («3 meses») y sí sale de lo que se dijo. La de la
   * reunión se llama `durationSec` en todo el núcleo. */
  const prohibidas = ['meetingUrl', 'meeting_url', 'url', 'happenedAt', 'date', 'durationSec', 'organizer', 'organizerEmail'];
  for (const def of [HT_DEF, OB_DEF, PROSPECT_CARD_DEF]) {
    const encontradas = propiedades(def.jsonSchema).filter((p) => prohibidas.includes(p));
    assert.deepEqual(encontradas, [], `el esquema de ${def.label} pide ${encontradas.join(', ')}`);
  }
});
