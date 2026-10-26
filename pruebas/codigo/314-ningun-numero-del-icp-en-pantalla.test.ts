// NINGÚN NÚMERO DEL ICP EN PANTALLA: EL FRONT DIBUJA LAS PALABRAS DEL CRM, NUNCA EL PUNTAJE. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (ICP en cuadrantes · Q6, decidido por el usuario el 2026-10-26)
//
// El puntaje de 0 a 100 queda guardado en `contactos.score`, pero en la plataforma ya no deben aparecer números del
// ICP. Las lecturas ya no lo mandan (lo cuidan la 175 y la 176); esto cuida el otro lado: que ningún componente lo vuelva
// a leer —un `l.puntaje`, un `fila.score`, el `icp.promedio` de Acquisition— y que las pantallas lean el cuadrante. Las
// mutaciones que lo ponen rojo:
//
//   · volver a dibujar `fila.score` en la fila del Closer, o `l.puntaje` en la tarjeta del Leads Portal;
//   · volver a dibujar el «ICP 62 %» de Acquisition (`icp.promedio`);
//   · que una pantalla deje de leer el cuadrante.
//
// El analizador de llamadas tiene su propia nota del vendedor (`a.score`, de 1 a 10): no es el ICP y no entra.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';

/** Los componentes de las pantallas que dibujan el ICP, o lo dibujaban. */
const CARPETAS = ['components/leads-portal', 'components/acquisition', 'components/conversation', 'components/creative', 'components/negocio', 'components/ajustes'];

function archivos(): string[] {
  return CARPETAS.flatMap((c) =>
    readdirSync(join(RAIZ, c), { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && /\.(jsx|tsx|js|ts)$/.test(e.name))
      .map((e) => relative(RAIZ, join(e.parentPath, e.name)).split(sep).join('/')),
  );
}

const leer = (ruta: string) => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));

test('ningún componente de esas pantallas lee el puntaje, el score ni el ICP promedio', () => {
  const lecturas = archivos().flatMap((ruta) =>
    [...leer(ruta).matchAll(/\.(puntaje|score|icpPromedio)\b|\bicp\.promedio\b/g)].map((m) => `${ruta}: ${m[0]}`),
  );
  assert.deepEqual(lecturas, [], 'una pantalla volvió a dibujar un número del ICP');
});

test('las pantallas leen el cuadrante del CRM', () => {
  const debe: [string, RegExp][] = [
    ['components/leads-portal/PanelDeLeadsPortal.jsx', /rotuloDelCuadrante\(l\.cuadrante\)/],
    ['components/leads-portal/FichaDelLead.jsx', /f\.clasificacion\.rotulo/],
    ['components/negocio/Fila.jsx', /rotuloDelCuadrante\(fila\.cuadrante\)/],
    ['components/acquisition/PanelDeAcquisition.jsx', /icp\.porcionDePrioriza/],
    ['components/conversation/PanelDeConversation.jsx', /icp\.cuadrantes\.map/],
    ['components/ajustes/CamposDelCliente.jsx', /datos\.cuadrante/],
  ];
  for (const [ruta, patron] of debe) assert.match(leer(ruta), patron, `${ruta} no lee el cuadrante`);
});
