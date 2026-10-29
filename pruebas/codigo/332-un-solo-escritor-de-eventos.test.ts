// UN SOLO ESCRITOR DE EVENTOS EN EL CÓDIGO, Y LAS FORMAS DEL AVISO DE LA OPORTUNIDAD. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el 8.º aviso, ítem 8 de la ESPEC de la estructura, 2026-10-27)
//
//   · `negocio.eventos` lo escriben los disparadores de la base (la `106`) y, en el código, SÓLO
//     `lib/negocio/etapaDelCrm.ts`. Un segundo escritor sería un segundo criterio de idempotencia y de forma — mutación:
//     un `insertInto('eventos')` en otro archivo, o un `insert into negocio.eventos` en otra migración;
//   · las etapas y las Salidas del panel son las de la semilla de la `079`, en orden (la 330 las compara con la base);
//   · la clave del idioma común: minúsculas, sin tildes, espacios y guiones a `_` — mutaciones: sin quitar tildes, sin
//     los guiones;
//   · el cuerpo de la oportunidad en sus formas (sin medir): plana, en camello, con la errata `pipleline_stage`,
//     anidada y en `customData`; nunca el `id` suelto — mutaciones: quitar una forma, leer `id`;
//   · la precedencia: la constante válida de la URL gana; si es inválida, el cuerpo; si el cuerpo no dice nada, la
//     constante inválida igual (para contarla); `&salida=` vacío o `ninguna` vacía — mutaciones: el cuerpo primero,
//     descartar la constante inválida, «ninguna» como clave;
//   · otro pipeline no es el Maestro; sin pipeline, sí;
//   · la URL fija pone el evento primero y codifica la clave; el panel ofrece una URL por clave de cada evento con
//     parámetro, y la ruta pone la consulta en la huella de los avisos de oportunidad.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { archivosFuente, RAIZ } from '../apoyo/fuente.ts';
import {
  ETAPAS_DEL_MAESTRO,
  EVENTOS_DEL_AVISO,
  SALIDAS_DE_LA_OPORTUNIDAD,
  claveDelIdiomaComun,
  esDelPipelineMaestro,
  loQueDiceLaOportunidad,
  oportunidadDelCuerpo,
  urlDelEvento,
} from '../../lib/ghl/avisos.ts';

const ESCRITOR = 'lib/negocio/etapaDelCrm.ts';
const DISPARADORES = 'db/migraciones/106_la_historia_del_lead.sql';
/** La `109` redefine UNO de los disparadores de la 106 (el del cuadrante), con su mismo insert: no es otro escritor. */
const REDEFINICION = 'db/migraciones/109_quien_clasifico.sql';

/** Una escritura en la tabla de eventos, por Kysely o en SQL. */
const ESCRIBE_EVENTOS =
  /(?:insertInto|updateTable|deleteFrom|mergeInto)\(\s*['"`](?:negocio\.)?eventos['"`]|(?:insert\s+into|update|delete\s+from|merge\s+into)\s+(?:negocio\.)?eventos\b/i;

test('en el código, sólo etapaDelCrm.ts escribe en negocio.eventos; en la base, sólo los disparadores de la 106', () => {
  const codigo = archivosFuente(['.', 'app', 'components', 'lib', 'scripts'])
    .filter((a) => ESCRIBE_EVENTOS.test(a.limpio))
    .map((a) => a.ruta);
  assert.deepEqual(codigo, [ESCRITOR], 'hay otro escritor de negocio.eventos en el código (o el único dejó de escribir)');

  const base = archivosFuente(['db'])
    .filter((a) => ESCRIBE_EVENTOS.test(a.limpio))
    .map((a) => a.ruta);
  assert.deepEqual(base, [DISPARADORES, REDEFINICION], 'otra migración o el sembrado escriben en negocio.eventos');
  // La 109 escribe eventos SÓLO dentro de la redefinición de `registrar_cambio_de_cuadrante`, con la misma clave
  // idempotente (`on conflict do nothing`): es el mismo escritor de la 106, no uno nuevo.
  const redefinicion = archivosFuente(['db']).find((a) => a.ruta === REDEFINICION)!.limpio;
  const funciones = redefinicion.split(/(?=create or replace function )/);
  const conEventos = funciones.filter((f) => ESCRIBE_EVENTOS.test(f));
  assert.equal(conEventos.length, 1);
  assert.match(conEventos[0]!, /^create or replace function negocio\.registrar_cambio_de_cuadrante\(\) returns trigger/);
  assert.match(conEventos[0]!, /'cuadrante_cambiado'[\s\S]*on conflict do nothing;/);

  // Y el escritor lo hace como lo pide la ESPEC: con `insertInto` (un `sql` crudo no recibe el org_id), sin pisar un
  // hecho ya registrado, con el contacto bloqueado.
  const escritor = archivosFuente(['lib']).find((a) => a.ruta === ESCRITOR)!.limpio;
  assert.match(escritor, /insertInto\('eventos'\)/);
  assert.match(escritor, /oc\.columns\(\['org_id', 'cuenta_id', 'fuente', 'id_externo', 'ocurrio_el'\]\)\.doNothing\(\)/);
  assert.match(escritor, /\.forUpdate\(\)/);
});

/** Las filas sembradas de un `insert into catalogo.<tabla>` de la 079: (clave, nombre, orden). */
function semilla(tabla: 'etapas' | 'salidas'): { clave: string; nombre: string; orden: number }[] {
  const sqlDe079 = readFileSync(`${RAIZ}/db/migraciones/079_el_idioma_comun.sql`, 'utf8').replace(/\r\n/g, '\n');
  const bloque = sqlDe079.match(new RegExp(`insert into catalogo\\.${tabla} \\([^)]*\\) values\\n([\\s\\S]*?)\\non conflict`));
  assert.ok(bloque, `no encontré la semilla de catalogo.${tabla}`);
  const filas = [...bloque[1]!.matchAll(/\('([a-z_]+)', '([^']+)', (?:true, |false, )?(\d+),/g)].map((m) => ({
    clave: m[1]!,
    nombre: m[2]!,
    orden: Number(m[3]),
  }));
  return filas.sort((a, b) => a.orden - b.orden);
}

test('las etapas y las Salidas del panel son las de la semilla de la 079, en orden', () => {
  assert.deepEqual(
    semilla('etapas').map(({ clave, nombre }) => ({ clave, nombre })),
    ETAPAS_DEL_MAESTRO.map(({ clave, nombre }) => ({ clave, nombre })),
  );
  assert.deepEqual(
    semilla('salidas').map(({ clave, nombre }) => ({ clave, nombre })),
    SALIDAS_DE_LA_OPORTUNIDAD.map(({ clave, nombre }) => ({ clave, nombre })),
  );
});

test('la clave del idioma común: minúsculas, sin tildes, espacios y guiones a guion bajo', () => {
  const casos: [unknown, string | null][] = [
    ['Asistió', 'asistio'],
    ['No-show', 'no_show'],
    ['NO rotundo', 'no_rotundo'],
    [' Conversación ', 'conversacion'],
    ['Nutrición', 'nutricion'],
    ['Pipeline  Maestro', 'pipeline_maestro'],
    ['', null],
    ['   ', null],
    [42, null],
    [null, null],
  ];
  for (const [entrada, salida] of casos) assert.equal(claveDelIdiomaComun(entrada), salida, JSON.stringify(entrada));
});

test('el cuerpo de la oportunidad en sus formas, y nunca el id suelto', () => {
  assert.deepEqual(oportunidadDelCuerpo(null), { oportunidadId: null, etapa: null, pipeline: null, pipelineId: null, salida: null });
  assert.deepEqual(
    oportunidadDelCuerpo({ id: 'id-del-contacto', opportunity_id: 'o1', pipleline_stage: 'Agendado', pipeline_name: 'Pipeline Maestro', pipeline_id: 'p1' }),
    { oportunidadId: 'o1', etapa: 'Agendado', pipeline: 'Pipeline Maestro', pipelineId: 'p1', salida: null },
  );
  assert.equal(oportunidadDelCuerpo({ id: 'id-del-contacto' }).oportunidadId, null, 'el id suelto se tomó por el de la oportunidad');
  for (const forma of [
    { pipeline_stage: 'Lead' },
    { pipelineStage: { id: 's1', name: 'Lead' } },
    { stageName: 'Lead' },
    { stage_name: 'Lead' },
    { pipelineStageName: 'Lead' },
    { opportunity: { stage: { name: 'Lead' } } },
    { opportunity: { pipelineStageName: 'Lead' } },
    { customData: { etapa: 'Lead' } },
  ] as Record<string, unknown>[]) {
    assert.equal(oportunidadDelCuerpo(forma).etapa, 'Lead', `no leyó la etapa de ${JSON.stringify(forma)}`);
  }
  for (const forma of [{ opportunityId: 'o' }, { opportunity: { id: 'o' } }, { customData: { oportunidadId: 'o' } }] as Record<string, unknown>[]) {
    assert.equal(oportunidadDelCuerpo(forma).oportunidadId, 'o', JSON.stringify(forma));
  }
  for (const forma of [{ pipelineName: 'X' }, { pipeline: { id: 'p', name: 'X' } }, { opportunity: { pipelineName: 'X' } }] as Record<string, unknown>[]) {
    assert.equal(oportunidadDelCuerpo(forma).pipeline, 'X', JSON.stringify(forma));
  }
  for (const forma of [{ Salida: 'Descarta' }, { salida: 'Descarta' }, { customData: { salida: 'Descarta' } }] as Record<string, unknown>[]) {
    assert.equal(oportunidadDelCuerpo(forma).salida, 'Descarta', JSON.stringify(forma));
  }
  assert.equal(oportunidadDelCuerpo({ stageName: 'x'.repeat(500) }).etapa?.length, 100, 'la etapa del cuerpo no se acota');
});

test('la precedencia: la constante válida gana, después el cuerpo, y la inválida se devuelve para contarla', () => {
  const p = (q: string) => new URLSearchParams(q);
  assert.deepEqual(loQueDiceLaOportunidad(p('etapa=Agendado'), { stageName: 'Lead' }).etapa, { valor: 'agendado', deLaUrl: true });
  assert.deepEqual(loQueDiceLaOportunidad(p('etapa=agendó'), { stageName: 'Lead' }).etapa, { valor: 'Lead', deLaUrl: false });
  assert.deepEqual(loQueDiceLaOportunidad(p('etapa=agendó'), {}).etapa, { valor: 'agendó', deLaUrl: true });
  assert.equal(loQueDiceLaOportunidad(p(''), {}).etapa, null);

  assert.deepEqual(loQueDiceLaOportunidad(p('salida=No-show'), { Salida: 'Descarta' }).salida, { valor: 'no_show', deLaUrl: true });
  assert.deepEqual(loQueDiceLaOportunidad(p('salida='), {}).salida, { valor: null, deLaUrl: true });
  assert.deepEqual(loQueDiceLaOportunidad(p('salida=ninguna'), { Salida: 'Descarta' }).salida, { valor: null, deLaUrl: true });
  assert.deepEqual(loQueDiceLaOportunidad(p('salida=otra cosa'), {}).salida, { valor: 'otra cosa', deLaUrl: true });
  assert.deepEqual(loQueDiceLaOportunidad(p(''), { Salida: 'Descarta' }).salida, { valor: 'Descarta', deLaUrl: false });
  assert.equal(loQueDiceLaOportunidad(p(''), {}).salida, null);
});

test('el Pipeline Maestro: sin nombre sí, con el suyo sí, con otro no', () => {
  assert.equal(esDelPipelineMaestro(null), true);
  assert.equal(esDelPipelineMaestro('Pipeline Maestro'), true);
  assert.equal(esDelPipelineMaestro(' pipeline-maestro '), true);
  assert.equal(esDelPipelineMaestro('Seguimiento comercial'), false);
  assert.equal(esDelPipelineMaestro('Citas'), false);
});

test('la URL fija lleva el evento primero; el panel ofrece una por clave, y la ruta pone la consulta en la huella', () => {
  assert.equal(
    urlDelEvento('https://x.test/', 'oportunidad.etapa', { nombre: 'etapa', clave: 'no_show' }),
    'https://x.test/api/avisos/crm?evento=oportunidad.etapa&etapa=no_show',
  );
  assert.equal(urlDelEvento('https://x.test', 'oportunidad.salida', { nombre: 'salida', clave: 'a b' }), 'https://x.test/api/avisos/crm?evento=oportunidad.salida&salida=a%20b');

  // Los dos eventos de la oportunidad, cada uno con su parámetro y la lista completa.
  const deOportunidad = EVENTOS_DEL_AVISO.filter((e) => e.evento.startsWith('oportunidad.'));
  assert.deepEqual(
    deOportunidad.map((e) => [e.evento, e.parametro?.nombre, e.parametro?.valores.length]),
    [
      ['oportunidad.etapa', 'etapa', ETAPAS_DEL_MAESTRO.length],
      ['oportunidad.salida', 'salida', SALIDAS_DE_LA_OPORTUNIDAD.length],
    ],
  );
  // Y el intérprete los reconoce a los dos por su nombre exacto: un evento en la lista sin su rama guarda y no hace nada.
  const interprete = archivosFuente(['lib']).find((a) => a.ruta === 'lib/negocio/avisoDelCrm.ts')!.limpio;
  for (const e of deOportunidad) assert.ok(interprete.includes(`'${e.evento}'`), `avisoDelCrm.ts no trata ${e.evento}`);

  const panel = archivosFuente(['components']).find((a) => a.ruta === 'components/ajustes/AvisoDelCrm.jsx')!.limpio;
  assert.match(panel, /e\.parametro\.valores\.map/, 'el panel no ofrece una URL por clave');
  assert.match(panel, /urlDelEvento\(base, e\.evento, \{ nombre: e\.parametro\.nombre, clave: v\.clave \}\)/);

  const ruta = archivosFuente(['app']).find((a) => a.ruta === 'app/api/avisos/crm/route.ts')!.limpio;
  assert.match(ruta, /evento\.startsWith\('oportunidad\.'\)\s*\?\s*sha256\(`\$\{url\.search\.replace\(\/\^\\\?\/, ''\)\}\\n\$\{leido\.texto\}`\)/);
  assert.match(ruta, /parametros: url\.searchParams/, 'la ruta no le pasa al intérprete los parámetros de la URL');
});
