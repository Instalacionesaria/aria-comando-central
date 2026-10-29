// LA APLICACIÓN HABLA CON TÚ, Y LO QUE TODAVÍA VOSEA ESTÁ ESCRITO. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `D-26` del plan de los agentes: tú neutro. La 202 lo hace cumplir sólo en Tools, y por eso el voseo siguió entrando
// por otros lados sin que nada fallara: los textos de la conexión con Meta («Revisá», «Probá», «avisá a desarrollo»,
// 2026-10-15) y el aviso de una ventana vacía de Leads Portal («Probá una ventana más larga»), que encontró la foto del
// estado actual del 2026-10-18 y se corrigieron ese día.
//
// Esta prueba mira TODO lo que lee la persona —`components/`, `lib/` y `app/`, sin comentarios— y exige que no vosee,
// salvo los archivos de `TODAVIA_VOSEAN`: los que vosean hoy, escritos uno por uno. Así un archivo nuevo con voseo pone
// la suite en rojo, y cada uno que se corrige tiene que salir de la lista (la segunda prueba lo exige), así que la
// lista sólo puede achicarse.
//
// Fundaciones no entra: es de la rama `feature/icp-oferta-v2`, que la pasa a tú y trae su propia prueba (la 185).
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { VOSEO } from '../apoyo/voseo.ts';

/** Los que vosean hoy (2026-10-18), fuera de Fundaciones. Cada uno que se corrige sale de acá. */
const TODAVIA_VOSEAN = [
  'app/api/admin/closer/usuarios-crm/route.ts',
  'app/api/admin/organizaciones/[id]/route.ts',
  'app/api/analizadores/llamadas/[id]/route.ts',
  'app/api/analizadores/sincronizar/route.ts',
  'app/api/auth/2fo/verificar/route.ts',
  'app/api/auth/login/route.ts',
  'app/api/contactos/[id]/avanzar/route.ts',
  'app/api/contactos/[id]/mensajes/route.ts',
  'app/api/contactos/sincronizar/route.ts',
  'app/entrar/page.tsx',
  'components/MenuDeUsuario.jsx',
  'components/ajustes/Empresas.jsx',
  'components/ajustes/Usuarios.jsx',
  'components/analizadores/PanelDeAnalizadores.jsx',
  'components/closer/Agenda.jsx',
  'components/closer/MiDia.jsx',
  'components/closer/QuienEsElCloser.jsx',
  'components/incidentes/PanelDeIncidentes.jsx',
  'components/negocio/Avanzar.jsx',
  'components/negocio/EnlacesRapidos.jsx',
  'components/negocio/Ficha.jsx',
  'components/negocio/ListaDeContactos.jsx',
  'components/setter/Inicio.jsx',
  'lib/analizadores/rutas.ts',
  'lib/auditor/atribucion.ts',
  'lib/auditor/esquema.ts',
  'lib/auditor/modelo.ts',
  'lib/auditor/portones.ts',
  'lib/auditor/rubrica.ts',
  'lib/autorizacion/portero.ts',
  'lib/negocio/agenda.ts',
  'lib/negocio/cadenaDeCierre.ts',
  'lib/negocio/cicloHastaLaCita.ts',
  'lib/negocio/comisionDelSetter.ts',
  'lib/negocio/frescura.ts',
  'lib/negocio/recorridoDelLead.ts',
];

/** Todo el código que lee la persona, fuera de Fundaciones, con su ruta relativa con `/`. */
function codigoDeLaAplicacion(): string[] {
  return ['components', 'lib', 'app'].flatMap((dir) =>
    readdirSync(join(RAIZ, dir), { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && /\.(ts|tsx|js|jsx)$/.test(e.name))
      .map((e) => join(e.parentPath, e.name).slice(RAIZ.length).replace(/^[\\/]/, '').replace(/\\/g, '/'))
      .filter((ruta) => !/(^|\/)fundaciones(\/|$)/.test(ruta)),
  );
}

const vosea = (ruta: string) => VOSEO.exec(sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8')));

test('fuera de la lista, la aplicación no vosea', () => {
  const rutas = codigoDeLaAplicacion();
  assert.ok(rutas.includes('lib/meta/graph.ts'), 'no se leyó lib/meta/');
  assert.ok(rutas.includes('components/ajustes/ConexionConMeta.jsx'), 'no se leyó Ajustes');
  const nuevas = rutas
    .filter((r) => !TODAVIA_VOSEAN.includes(r))
    .map((r) => [r, vosea(r)?.[0]] as const)
    .filter(([, forma]) => forma !== undefined)
    .map(([r, forma]) => `${r} «${forma}»`);
  assert.deepEqual(nuevas, [], 'voseo nuevo: con tú neutro (D-26)');
});

test('la lista de lo que todavía vosea no tiene entradas muertas', () => {
  // Sin esto, la lista se vuelve un permiso permanente: un archivo que ya se corrigió seguiría pudiendo vosear.
  const muertas = TODAVIA_VOSEAN.filter((r) => vosea(r) === null);
  assert.deepEqual(muertas, [], 'estos ya no vosean: sácalos de TODAVIA_VOSEAN');
});

test('la lista atrapa las formas de la conexión con Meta y de Leads Portal', () => {
  for (const forma of ['Revisá en el Business Manager', 'Probá de nuevo', 'avisá a desarrollo', 'Probá una ventana']) {
    assert.match(forma, VOSEO, forma);
  }
  for (const neutra of ['Revisa en el Business Manager', 'Prueba de nuevo', 'avisa a desarrollo', 'Prueba una ventana']) {
    assert.doesNotMatch(neutra, VOSEO, neutra);
  }
});
