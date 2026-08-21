// Convierte las tablas de `PRUEBAS.md` en identificadores estables y en un overlay
// para el grafo de la especificación.
//
// POR QUÉ NO LO HACE UN LLM: `PRUEBAS.md` no es prosa. Son diez tablas markdown
// legibles por máquina —regla, prueba, tipo, y la columna ⛔— por etapa. Pedirle a un
// modelo que extraiga estructura QUE YA ESTÁ ESTRUCTURADA agrega costo, varianza y
// alucinación posible, y pierde lo único que la extracción por LLM nunca da: el
// `source_location` exacto de la fila.
//
// Cero LLM. Cero alucinación. Reproducible.
//
//   node tools/graphify/spec-overlay.mjs              # imprime el resumen
//   node tools/graphify/spec-overlay.mjs --trazabilidad  # escribe docs/TRAZABILIDAD.md
//   node tools/graphify/spec-overlay.mjs --aplicar     # + fusiona el overlay en el grafo
//
// El esquema de identificadores es `ADR-SSRR` (SS = etapa, RR = fila) y NO es
// negociable en su forma: el paso AST de graphify solo reconoce `ADR[- ]?\d{1,5}` o
// `RFC[- ]?\d{1,5}` dentro de una LÍNEA DE COMENTARIO. `REGLA-E2-07` es invisible.
// Ver docs/TRAZABILIDAD.md y el § 4 del plan.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

// La carpeta de la especificación vive en OTRO repositorio
// (`Instalacionesaria/aria-project-closer-setter`, público), así que la ruta depende
// de dónde estén clonados los dos. Se resuelve así, en orden:
//
//   1. `ARIA_ESPEC`, si está definida — es la salida para cualquier otra disposición
//      de carpetas, incluida la integración continua.
//   2. El repo hermano al lado de éste, que es la disposición por omisión.
//
// Hardcodear una ruta absoluta haría que este guion funcionara en una sola máquina.
const ESPEC =
  process.env.ARIA_ESPEC ??
  fileURLToPath(new URL('../../../aria-project-closer-setter/docs/migracion/', import.meta.url));

const PRUEBAS_MD = join(ESPEC, 'PRUEBAS.md');
const GRAFO = join(ESPEC, 'graphify-out', 'graph.json');

// La etapa 7b es la única que no es un dígito. `71` la mantiene dentro del rango de
// 1 a 5 dígitos del regex y deja que el número siga nombrando la etapa.
const CODIGO_ETAPA = { '0': '00', '1': '01', '2': '02', '3': '03', '4': '04',
  '5': '05', '6': '06', '7': '07', '7b': '71', '8': '08' };

/** Separa una fila de tabla markdown respetando los `\|` escapados. */
function celdas(linea) {
  const cuerpo = linea.trim().replace(/^\|/, '').replace(/\|$/, '');
  return cuerpo
    .split(/(?<!\\)\|/)
    .map((c) => c.replace(/\\\|/g, '|').trim());
}

function esSeparador(linea) {
  return /^\|[\s:-]+\|/.test(linea.trim()) && !/[a-zA-Z⛔]/.test(linea);
}

/** Quita el énfasis markdown y los backticks para tener texto plano legible. */
function plano(texto) {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function leerReglas() {
  const texto = readFileSync(PRUEBAS_MD, 'utf8').replace(/\r\n/g, '\n');
  const lineas = texto.split('\n');

  const reglas = [];
  let etapa = null;
  let fila = 0;

  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i] ?? '';

    const cabecera = /^##\s+Etapa\s+(\d+b?)\b/.exec(linea);
    if (cabecera) {
      etapa = cabecera[1] ?? null;
      fila = 0;
      continue;
    }
    // Cualquier otro `##` cierra la sección de etapa.
    if (/^##\s+/.test(linea) && !cabecera) {
      etapa = null;
      continue;
    }
    if (etapa === null) continue;
    if (!linea.trim().startsWith('|')) continue;
    if (esSeparador(linea)) continue;

    const c = celdas(linea);
    if (c.length !== 4) continue;
    // La fila de encabezado.
    if (c[1] === 'Regla') continue;

    const codigo = CODIGO_ETAPA[etapa];
    if (!codigo) throw new Error(`etapa desconocida: ${etapa}`);
    fila += 1;

    reglas.push({
      id: `ADR-${codigo}${String(fila).padStart(2, '0')}`,
      etapa,
      fila,
      innegociable: (c[0] ?? '').includes('⛔'),
      regla: plano(c[1] ?? ''),
      prueba: plano(c[2] ?? ''),
      tipo: plano(c[3] ?? ''),
      // La línea exacta de la tabla — lo que ninguna extracción por LLM da.
      linea: i + 1,
    });
  }
  return reglas;
}

// ── Trazabilidad legible ────────────────────────────────────────────────────

function escribirTrazabilidad(reglas) {
  const l = [];
  l.push('# Trazabilidad — regla ↔ identificador ↔ prueba');
  l.push('');
  l.push('**Generado.** No editar a mano: sale de `tools/graphify/spec-overlay.mjs`,');
  l.push('que parsea las tablas de `PRUEBAS.md`. Regenerar con:');
  l.push('');
  l.push('```bash');
  l.push('node tools/graphify/spec-overlay.mjs --trazabilidad');
  l.push('```');
  l.push('');
  l.push('## Cómo se usa');
  l.push('');
  l.push('El identificador va en un **comentario** del archivo que implementa la regla y');
  l.push('del que la prueba. El paso AST de graphify reconoce `ADR-NNNN` dentro de una línea');
  l.push('de comentario y crea una arista `archivo --cites--> ADR-NNNN` con confianza');
  l.push('`EXTRACTED`, gratis y refrescada por cada `graphify update`. Entonces:');
  l.push('');
  // Sin `--graph`: por omisión toma `graphify-out/graph.json`, que es el grafo de
  // ESTE repo — el de código, que es el que tiene las citas. Y así el comando es
  // portable, en vez de llevar la ruta absoluta de una máquina.
  l.push('```bash');
  l.push('graphify affected "ADR-0301" --relation cites --depth 1');
  l.push('```');
  l.push('');
  l.push('devuelve **la implementación y su prueba como una sola respuesta**.');
  l.push('');
  l.push('> Un `describe(\'ADR-0207 …\')` **no** se escanea: tiene que estar en un comentario.');
  l.push('');
  l.push(`Total: **${reglas.length} reglas**, de las cuales **${reglas.filter((r) => r.innegociable).length} son ⛔**.`);
  l.push('');

  const etapas = [...new Set(reglas.map((r) => r.etapa))];
  for (const e of etapas) {
    const delEtapa = reglas.filter((r) => r.etapa === e);
    l.push(`## Etapa ${e}`);
    l.push('');
    l.push('| ID | ⛔ | Regla | La prueba | Tipo |');
    l.push('| --- | --- | --- | --- | --- |');
    for (const r of delEtapa) {
      const cel = (s) => s.replace(/\|/g, '\\|');
      l.push(`| \`${r.id}\` | ${r.innegociable ? '⛔' : ''} | ${cel(r.regla)} | ${cel(r.prueba)} | ${r.tipo} |`);
    }
    l.push('');
  }

  const destino = join(RAIZ, 'docs', 'TRAZABILIDAD.md');
  writeFileSync(destino, l.join('\n'), 'utf8');
  return destino;
}

// ── Overlay para el grafo ───────────────────────────────────────────────────

// Los documentos que corrigen a otros. Sale de la regla de precedencia de
// EJECUCION § 4 y del README de la carpeta: "el 08 nació de una revisión que
// encontró cosas que la serie afirmaba y no sostenía; el 09 nació de encontrar que
// el propio 08 rompía el login. Donde uno contradice a otro, gana el de número más
// alto."
const CORRECCIONES = [
  ['DOC-08', ['DOC-00', 'DOC-01', 'DOC-02', 'DOC-03', 'DOC-04', 'DOC-05', 'DOC-06', 'DOC-07']],
  ['DOC-09', ['DOC-08']],
];
const DOCS = ['DOC-00', 'DOC-01', 'DOC-02', 'DOC-03', 'DOC-04', 'DOC-05', 'DOC-06',
  'DOC-07', 'DOC-08', 'DOC-09', 'DOC-10', 'DOC-PRUEBAS'];

const MARCA = 'spec-overlay';

function construirOverlay(reglas) {
  const nodos = [];
  const aristas = [];
  const nodo = (id, label, extra = {}) => {
    nodos.push({
      id, label,
      file_type: 'concept',
      source_file: 'PRUEBAS.md',
      source_location: null,
      overlay: MARCA,
      ...extra,
    });
  };
  const arista = (source, target, relation, score = 1.0) => {
    aristas.push({
      source, target, relation,
      confidence: 'EXTRACTED',
      confidence_score: score,
      source_file: 'PRUEBAS.md',
      weight: 1.0,
      overlay: MARCA,
    });
  };

  const etapas = [...new Set(reglas.map((r) => r.etapa))];
  for (const e of etapas) nodo(`ETAPA-${e}`, `Etapa ${e}`, { source_file: 'EJECUCION.md' });

  const tipos = [...new Set(reglas.map((r) => r.tipo).filter(Boolean))];
  for (const t of tipos) nodo(`TIPO-${t.toUpperCase()}`, `Tipo: ${t}`);

  for (const r of reglas) {
    nodo(r.id, r.regla, { source_location: `L${r.linea}`, innegociable: r.innegociable });
    const idPrueba = r.id.replace('ADR-', 'PRUEBA-');
    nodo(idPrueba, r.prueba, { source_location: `L${r.linea}` });
    arista(r.id, idPrueba, 'sustained_by');
    arista(r.id, `ETAPA-${r.etapa}`, 'in_stage');
    if (r.tipo) arista(r.id, `TIPO-${r.tipo.toUpperCase()}`, 'is_type');
  }

  for (const d of DOCS) nodo(d, `Documento ${d.replace('DOC-', '')}`, { source_file: 'README.md' });
  nodo('DOC-EJECUCION', 'EJECUCION — manda sobre todos', { source_file: 'EJECUCION.md' });
  for (const [quien, aQuienes] of CORRECCIONES) {
    for (const otro of aQuienes) arista(quien, otro, 'corrects');
  }
  for (const d of DOCS) arista('DOC-EJECUCION', d, 'governs');

  return { nodos, aristas };
}

function aplicarOverlay(reglas) {
  if (!existsSync(GRAFO)) {
    console.error(`No existe ${GRAFO}.`);
    console.error('Construí primero el grafo de la especificación:');
    console.error(`  graphify extract "${ESPEC}" --backend claude-cli --mode deep --token-budget 20000`);
    process.exit(1);
  }
  const grafo = JSON.parse(readFileSync(GRAFO, 'utf8'));
  const { nodos, aristas } = construirOverlay(reglas);

  // Idempotente: se quita lo que puso una corrida anterior antes de agregar.
  const nodosPrevios = (grafo.nodes ?? []).filter((n) => n.overlay === MARCA).length;
  grafo.nodes = (grafo.nodes ?? []).filter((n) => n.overlay !== MARCA);
  const clave = grafo.links ? 'links' : 'edges';
  grafo[clave] = (grafo[clave] ?? []).filter((a) => a.overlay !== MARCA);

  const existentes = new Set(grafo.nodes.map((n) => n.id));
  for (const n of nodos) if (!existentes.has(n.id)) grafo.nodes.push(n);
  grafo[clave].push(...aristas);

  writeFileSync(GRAFO, JSON.stringify(grafo, null, 2), 'utf8');
  return { nodosPrevios, agregados: nodos.length, aristas: aristas.length, total: grafo.nodes.length };
}

// ── Principal ───────────────────────────────────────────────────────────────

// Guard de ejecución directa: `cobertura.mjs` importa `leerReglas` de acá, y sin
// esto el bloque principal correría como efecto secundario del import.
const ejecutadoDirecto = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (!ejecutadoDirecto) {
  // Importado como biblioteca: no se hace nada más.
} else {
main();
}

function main() {
const argv = new Set(process.argv.slice(2));
const reglas = leerReglas();

const porEtapa = new Map();
for (const r of reglas) porEtapa.set(r.etapa, (porEtapa.get(r.etapa) ?? 0) + 1);

console.log(`PRUEBAS.md: ${reglas.length} reglas, ${reglas.filter((r) => r.innegociable).length} innegociables (⛔)`);
for (const [e, n] of porEtapa) {
  const inn = reglas.filter((r) => r.etapa === e && r.innegociable).length;
  const rango = `${reglas.find((r) => r.etapa === e)?.id}..${[...reglas].reverse().find((r) => r.etapa === e)?.id}`;
  console.log(`  Etapa ${e.padEnd(2)}  ${String(n).padStart(2)} reglas  ${String(inn).padStart(2)} ⛔   ${rango}`);
}

if (argv.has('--trazabilidad') || argv.has('--aplicar') || argv.has('--emitir')) {
  console.log(`\nescrito ${escribirTrazabilidad(reglas)}`);
}

// `--emitir <ruta>`: escribe el overlay en formato de EXTRACCIÓN, para fusionarlo
// con los fragmentos semánticos ANTES de construir el grafo. Así el agrupamiento
// ve los nodos ADR desde el principio, en vez de que queden pegados después.
if (argv.has('--emitir')) {
  const i = process.argv.indexOf('--emitir');
  const destino = process.argv[i + 1];
  if (!destino) {
    console.error('--emitir necesita una ruta de salida');
    process.exit(1);
  }
  const { nodos, aristas } = construirOverlay(reglas);
  writeFileSync(
    destino,
    JSON.stringify({ nodes: nodos, edges: aristas, hyperedges: [], input_tokens: 0, output_tokens: 0 }, null, 2),
    'utf8',
  );
  console.log(`overlay emitido: ${nodos.length} nodos, ${aristas.length} aristas → ${destino}`);
}
if (argv.has('--aplicar')) {
  const r = aplicarOverlay(reglas);
  console.log(
    `overlay aplicado: ${r.agregados} nodos, ${r.aristas} aristas ` +
      `(quitados ${r.nodosPrevios} de una corrida anterior). Total del grafo: ${r.total} nodos.`,
  );
  console.log('\nRe-agrupar y regenerar el reporte:');
  console.log(`  graphify cluster-only "${ESPEC}" --backend=claude-cli`);
}
}
