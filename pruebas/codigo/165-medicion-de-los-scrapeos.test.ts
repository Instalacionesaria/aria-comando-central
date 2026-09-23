// Cuánto tarda cada scrapeo se mide, y medirlo no puede romper un scrapeo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ CUSTODIAN ESTAS PRUEBAS
//
// La pantalla espera un trabajo de scraping diez minutos y después lo da por caído. Kevin,
// 2026-09-23: *«¿es posible que el scraper demore o pase de 10 min?»*. La respuesta era «no lo
// sabemos»: `aria_cc_scraper_trabajos` la escribe el backend de scraping y **nadie actualiza su
// `actualizado_el` al terminar** —medido sobre los trece trabajos que hay, nueve la tienen
// exactamente igual a `created_at`—, así que la tabla guarda cuándo se insertó la fila, no cuánto
// tardó el trabajo.
//
// Ahora se mide desde el proxy, que es el único lugar que ve las dos puntas. Y con una condición
// que Kevin puso con todas las letras: *«eso no malogra la funcionalidad actual verdad? porque está
// funcionando bien por lo menos el espía»*. De ahí las tres reglas que se comprueban acá:
//
//   1. se mide DESPUÉS de tener la respuesta del backend, nunca antes;
//   2. el error de la medición se traga hacia el registro y no llega a la pantalla;
//   3. y corre en su PROPIA transacción, porque en PostgreSQL una sentencia que falla aborta la
//      transacción entera.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ } from '../apoyo/fuente.ts';
import { ESTADOS_TERMINALES, yaTermino } from '../../lib/tools/medicion.ts';

const codigo = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

test('terminó o sigue corriendo: los tres estados finales del backend, y nada más', () => {
  for (const estado of ESTADOS_TERMINALES) assert.equal(yaTermino(estado), true, estado);
  // Vienen del backend, así que se aceptan como los mande: con espacios o en minúsculas.
  assert.equal(yaTermino('completed'), true);
  assert.equal(yaTermino('  COMPLETED  '), true);

  /* Y lo que NO terminó no se mide: anotar el fin de un trabajo que sigue corriendo dejaría una
     duración inventada, que es peor que no tener ninguna. */
  for (const corriendo of ['PENDING', 'RUNNING', '', 'READY']) {
    assert.equal(yaTermino(corriendo), false, corriendo);
  }
  assert.equal(yaTermino(undefined), false);
  assert.equal(yaTermino(null), false);
  assert.equal(yaTermino(42), false);
});

test('medir no puede romper un scrapeo', () => {
  const medicion = codigo('lib/tools/medicion.ts');

  // 1 · Ninguna de las dos lanza: las dos devuelven `void` y tienen su `catch`.
  for (const fn of ['anotarInicio', 'anotarFin']) {
    const desde = medicion.indexOf(`export async function ${fn}(`);
    assert.ok(desde > 0, `se fue ${fn}`);
    const firma = medicion.slice(desde, medicion.indexOf('{', medicion.indexOf('Promise<', desde)));
    assert.ok(
      firma.includes('Promise<void>'),
      `${fn} dejo de devolver void: quien la llame va a empezar a ramificar sobre un fallo que no importa`,
    );
  }
  assert.equal((medicion.match(/\} catch \(e\) \{/g) ?? []).length, 2, 'una de las dos funciones dejó de atrapar su error');
  assert.equal((medicion.match(/console\.error\(/g) ?? []).length, 2, 'un fallo de la medición se pierde sin dejar rastro');

  /* 2 · Y en su PROPIA transacción. Colgarse de una abierta dejaría que un `insert` fallido
     abortara la transacción entera y se llevara puesto lo que la ruta ya había hecho: es la misma
     lección que el histórico de conversaciones, aplicada acá desde el primer día. */
  assert.equal((medicion.match(/await conOrganizacion\(orgId, async \(\) => \{/g) ?? []).length, 2);
  assert.doesNotMatch(medicion, /hayOrganizacion\(\)/, 'la medición reusa la transacción abierta');
});

test('se mide DESPUÉS de tener la respuesta del backend, en las dos puntas', () => {
  const ruta = codigo('app/api/tools/scrape/route.ts');

  /* El orden es lo único que garantiza que la medición no demore ni condicione el scrapeo: primero
     se habla con el backend y se comprueba su respuesta, y recién ahí se anota. */
  const backendPost = ruta.indexOf('const r = await alBackend(`${url}${arranque.camino}`');
  const anotaInicio = ruta.indexOf('await anotarInicio(');
  assert.ok(backendPost > 0 && anotaInicio > backendPost, 'se anota el arranque antes de tener el trabajo');

  const anotaFin = ruta.indexOf('await anotarFin(');
  const guardaFin = ruta.indexOf('if (yaTermino(leido[');
  assert.ok(guardaFin > 0 && anotaFin > guardaFin, 'se anota el fin sin comprobar que el trabajo terminó');

  /* El arranque se anota con el identificador del backend, no con uno nuestro: es la llave con la
     que el sondeo va a encontrar la fila para cerrarla. */
  assert.match(ruta, /const id = iniciado\['jobId'\] \?\? iniciado\['job_id'\];/);
  assert.match(ruta, /if \(id !== undefined && id !== null\)/, 'se anota un arranque sin identificador');
});

test('la duración es idempotente: sondear de más no la estira', () => {
  /* El navegador pregunta cada cinco segundos y no siempre corta al primer «terminado». Sin la
     condición, cada sondeo de más movería `terminado_el` hacia adelante y la medición diría que el
     trabajo tardó más de lo que tardó — justo el número que se quiere confiable. */
  const medicion = codigo('lib/tools/medicion.ts');
  assert.match(medicion, /\.where\('terminado_el', 'is', null\)/);
  // Y el arranque tampoco se puede mover: un reintento dejaría la duración más CORTA de lo real.
  assert.match(medicion, /\.onConflict\(\(oc\) => oc\.columns\(\['org_id', 'trabajo_id'\]\)\.doNothing\(\)\)/);
});

test('la tabla está declarada en el esquema con la forma que la medición escribe', () => {
  const esquema = codigo('lib/datos/esquema.ts');
  assert.match(esquema, /'public\.aria_cc_scraper_mediciones': TablaScraperMediciones;/);
  for (const columna of ['trabajo_id', 'fuente', 'iniciado_el', 'terminado_el', 'estado', 'segundos']) {
    assert.match(esquema, new RegExp(`${columna}:`), `la tabla del esquema no declara \`${columna}\``);
  }
  /* `terminado_el` y `segundos` admiten nulo a propósito: un trabajo que nadie volvió a sondear
     —porque cerraron la pestaña— queda sin cerrar, y eso es un dato, no una fila a medias. */
  assert.match(esquema, /terminado_el: Date \| null;/);
  assert.match(esquema, /segundos: number \| null;/);
});
