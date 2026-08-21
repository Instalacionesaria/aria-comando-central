// ¿Qué reglas de una etapa NO tienen ningún archivo que las cite?
//
// Es la compuerta de cierre de etapa. Cruza dos fuentes:
//
//   · las reglas, parseadas de `PRUEBAS.md` (determinista, sin LLM)
//   · los archivos que las citan, del grafo de CÓDIGO — nodos `ADR-NNNN` que el paso
//     AST de graphify crea gratis a partir de los comentarios, y que cada
//     `graphify update` refresca
//
//   node tools/graphify/cobertura.mjs 0          # la etapa 0
//   node tools/graphify/cobertura.mjs 2 --solo-innegociables
//   node tools/graphify/cobertura.mjs --adr ADR-0002   # qué archivos citan una regla
//   node tools/graphify/cobertura.mjs --todas
//
// Sale distinto de cero si a una regla ⛔ de la etapa pedida le falta un archivo que
// la cite, así que sirve como paso de integración continua.
//
// LÍMITE HONESTO, y hay que decirlo cada vez: esto prueba que un archivo MENCIONA el
// identificador en un comentario. NO prueba que la prueba exista, corra, ni falle
// cuando la regla se rompe. **Es una lista de verificación, no una compuerta de
// corrección.** La compuerta es la integración continua. Confundir las dos convierte
// todo este aparato en lo que `PRUEBAS.md` advierte: "diez documentos aplicados a
// medias… vienen con la confianza de los diez".

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerReglas } from './spec-overlay.mjs';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const GRAFO_CODIGO = join(RAIZ, 'graphify-out', 'graph.json');

/** Mapa `ADR-NNNN` → archivos que lo citan, leído del grafo de código. */
function citasPorRegla() {
  if (!existsSync(GRAFO_CODIGO)) {
    console.error(`No existe ${GRAFO_CODIGO}. Corré:`);
    console.error(`  graphify update "${RAIZ.replace(/\\$/, '')}"`);
    process.exit(1);
  }
  const g = JSON.parse(readFileSync(GRAFO_CODIGO, 'utf8'));
  const mapa = new Map();
  for (const n of g.nodes ?? []) {
    const etiqueta = String(n.label ?? '').toUpperCase();
    if (!/^ADR[- ]?\d{1,5}$/.test(etiqueta)) continue;
    const id = etiqueta.replace(/^ADR\s/, 'ADR-');
    // El paso AST crea un nodo POR ARCHIVO, no uno compartido por identificador, y
    // el archivo que cita está en `source_file` del propio nodo. Por eso se agrupa
    // por etiqueta acá en vez de usar `graphify affected`, que necesita un nodo
    // único y responde "No unique node match".
    if (!mapa.has(id)) mapa.set(id, new Set());
    if (n.source_file) mapa.get(id).add(n.source_file);
  }
  return mapa;
}

const argv = process.argv.slice(2);
const soloInneg = argv.includes('--solo-innegociables');
const todas = argv.includes('--todas');
const iAdr = argv.indexOf('--adr');
const etapaPedida = argv.find((a) => /^\d+b?$/.test(a));

const reglas = leerReglas();
const citas = citasPorRegla();

// ── Modo "un identificador" ─────────────────────────────────────────────────
if (iAdr !== -1) {
  const buscado = (argv[iAdr + 1] ?? '').toUpperCase();
  const regla = reglas.find((r) => r.id === buscado);
  if (!regla) {
    console.error(`${buscado} no existe en PRUEBAS.md`);
    process.exit(1);
  }
  console.log(`${regla.id}${regla.innegociable ? '  ⛔' : ''}  (Etapa ${regla.etapa}, tipo ${regla.tipo})`);
  console.log(`  regla:  ${regla.regla}`);
  console.log(`  prueba: ${regla.prueba}`);
  console.log(`  PRUEBAS.md:${regla.linea}`);
  const archivos = [...(citas.get(regla.id) ?? [])].sort();
  console.log(`\n  archivos que la citan (${archivos.length}):`);
  for (const a of archivos) console.log(`    ${a}`);
  if (archivos.length === 0) console.log('    (ninguno)');
  process.exit(0);
}

// ── Modo "una etapa" o "todas" ──────────────────────────────────────────────
const etapas = todas
  ? [...new Set(reglas.map((r) => r.etapa))]
  : [etapaPedida ?? '0'];

let faltanInnegociables = 0;

for (const etapa of etapas) {
  let delEtapa = reglas.filter((r) => r.etapa === etapa);
  if (soloInneg) delEtapa = delEtapa.filter((r) => r.innegociable);
  if (delEtapa.length === 0) continue;

  const citadas = delEtapa.filter((r) => (citas.get(r.id)?.size ?? 0) > 0);
  console.log(`\nEtapa ${etapa}: ${citadas.length}/${delEtapa.length} reglas con archivo que las cite`);

  for (const r of delEtapa) {
    const archivos = [...(citas.get(r.id) ?? [])].sort();
    const marca = r.innegociable ? '⛔' : '  ';
    if (archivos.length > 0) {
      console.log(`  ${marca} ${r.id}  ${archivos.join(', ')}`);
    } else {
      console.log(`  ${marca} ${r.id}  SIN CITAR  — ${r.regla.slice(0, 72)}`);
      if (r.innegociable) faltanInnegociables += 1;
    }
  }
}

// ── Las reglas LOCALES: citadas en el código y ausentes de `PRUEBAS.md` ─────
//
// Existen y van a seguir existiendo: `EJECUCION` § 2 declara reglas que `PRUEBAS.md` no
// convirtió en fila, y una etapa puede descubrir una regla que la especificación no vio
// —la Etapa 2 descubrió dos, midiendo—. El riesgo no es que existan: es que sean
// INVISIBLES. Sin esta lista, una regla local vive en un comentario, nadie la cuenta, y
// la primera lectura de `docs/TRAZABILIDAD.md` dice que la etapa está completa.
//
// El identificador trae su etapa adentro (`ADR-SSRR`), así que se pueden acotar al mismo
// alcance que se pidió.
const definidas = new Set(reglas.map((r) => r.id));
const locales = [...citas.keys()]
  .filter((id) => !definidas.has(id))
  .filter((id) => {
    const etapa = String(Number(id.slice(4, 6)));
    return todas || etapas.includes(etapa);
  })
  .sort();

if (locales.length > 0) {
  console.log(`\nReglas LOCALES (no están en PRUEBAS.md, hay que agregarlas o justificarlas):`);
  for (const id of locales) {
    console.log(`     ${id}  ${[...citas.get(id)].sort().join(', ')}`);
  }
}

if (faltanInnegociables > 0) {
  console.error(
    `\n${faltanInnegociables} regla(s) INNEGOCIABLE(S) sin ningún archivo que las cite.`,
  );
  console.error('Recordá: citar no es probar. Esto es una lista de verificación, no una compuerta.');
  process.exit(1);
}
console.log('\nTodas las reglas ⛔ del alcance pedido tienen al menos un archivo que las cita.');
