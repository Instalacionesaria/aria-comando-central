// TOOLS HABLA CON TÚ: EL ESPÍA Y SUS VECINOS NO VOSEAN. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `D-26` del plan de los agentes (`docs/OTROS/agentes/00-MAPA.md`): tú neutro. La pantalla del Espía decía
// «Escribí un nicho…», «Espiá la Meta Ad Library…», «Intentá de nuevo», y el Scraper, Mis leads, el saldo y
// el plan de prospección, lo mismo, mientras el prompt del Espía ya tuteaba. Desde AG3 todo Tools tutea.
//
// Mira lo que lee la persona —los componentes de Tools y los mensajes de sus rutas, sin comentarios— y lo
// que lee el modelo del Espía, porque el modelo imita el registro de sus instrucciones. Fundaciones tiene su
// propia prueba en la rama `feature/icp-oferta-v2` (la 185), con la misma lista (`pruebas/apoyo/voseo.ts`).
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { VOSEO } from '../apoyo/voseo.ts';
import { promptDelAnalisis } from '../../lib/tools/espia.ts';

/** Todos los archivos de una carpeta con esas extensiones, recorriendo las subcarpetas. */
function archivos(dir: string, extensiones: readonly string[]): string[] {
  return readdirSync(join(RAIZ, dir), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && extensiones.some((x) => e.name.endsWith(x)))
    .map((e) => join(e.parentPath, e.name).slice(RAIZ.length).replace(/^[\\/]/, '').replace(/\\/g, '/'));
}

test('la lista atrapa las formas que tenía Tools: si no, esta prueba no miraría nada', () => {
  for (const forma of ['Escribí un nicho', 'Espiá la Meta Ad Library', 'Intentá de nuevo', 'Elegí una búsqueda', 'la que buscás']) {
    assert.match(forma, VOSEO, forma);
  }
  for (const neutra of ['Escribe un nicho', 'Espía la Meta Ad Library', 'Inténtalo de nuevo', 'más', 'después', 'país', 'Espía a tus competidores']) {
    assert.doesNotMatch(neutra, VOSEO, neutra);
  }
});

test('la pantalla de Tools no vosea: componentes, lógica y mensajes de sus rutas', () => {
  const rutas = [
    ...archivos('components/tools', ['.jsx', '.tsx', '.js']),
    ...archivos('lib/tools', ['.ts']),
    ...archivos('app/api/tools', ['.ts']),
  ];
  assert.ok(rutas.includes('components/tools/EspiaDeAnuncios.jsx'), 'no se leyó la pantalla del Espía');
  assert.ok(rutas.includes('app/api/tools/leads/enviar/route.ts'), 'no se leyeron las rutas');
  for (const ruta of rutas) {
    const m = VOSEO.exec(sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8')));
    assert.equal(m, null, `${ruta} vosea: «${m?.[0]}»`);
  }
});

test('el modelo del Espía recibe instrucciones con tú', () => {
  const prompt = promptDelAnalisis([{ page_name: 'Competidor', days_active: 30, body_text: 'compra ya' }]);
  assert.equal(VOSEO.exec(prompt), null);
  assert.match(prompt, /Analiza estos anuncios/);
});
