// LA BAJA EN EL CRM (la `108`), lo que se ve leyendo el código. Tipo: Código.
//
// La parte que corre contra la base está en `pruebas/base/336-la-baja-en-el-crm.test.ts`, la `27-agenda` y la `278`.
// Acá, lo que una prueba de base no ve: que la migración sea reaplicable y no escriba eventos, que las copias sueltas
// del predicado de «alcanzable» se fueron, que la tarea de contactos cuenta los pedidos de la relectura en su sello, y
// que las pantallas dibujan lo que el servidor manda.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, archivosFuente } from '../apoyo/fuente.ts';
import { citaPorId } from '../../lib/ghl/calendarios.ts';
import { contactoPorId } from '../../lib/ghl/cliente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const MIGRACION = 'db/migraciones/108_la_baja_en_el_crm.sql';

test('la 108 es reaplicable, documentada, y no escribe eventos', () => {
  const m = leer(MIGRACION);
  for (const tabla of ['contactos', 'citas']) {
    assert.match(m, new RegExp(`alter table negocio\\.${tabla} add column if not exists baja_en_el_crm timestamptz;`));
    assert.match(m, new RegExp(`comment on column negocio\\.${tabla}\\.baja_en_el_crm is`));
  }
  assert.match(m, /create index if not exists contactos_congelados_por_releer\s+on negocio\.contactos \(org_id, sincronizado_el\)\s+where territorio is null and baja_en_el_crm is null;/);
  assert.match(m, /comment on index negocio\.contactos_congelados_por_releer is/);
  // Sin `drop`, sin `delete` y sin eventos: la baja es la columna con su fecha (la `332` sigue con un solo escritor).
  const sinComentarios = m.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(sinComentarios, /\bdrop\b|\bdelete\b|\beventos\b/i);
  // Y el esquema la declara en las dos tablas.
  assert.equal((leer('lib/datos/esquema.ts').match(/^ {2}baja_en_el_crm: Date \| null;$/gm) ?? []).length, 2);
});

test('«alcanzable» tiene UNA definición, con la baja adentro, y las tres copias sueltas la usan', () => {
  assert.match(
    leer('lib/negocio/citasAlcanzables.ts'),
    /return sql<boolean>`\(\$\{a\}\.ghl_calendario_id is not null and \$\{a\}\.baja_en_el_crm is null\)`;/,
  );
  const copias = archivosFuente(['lib', 'app'])
    .filter((a) => a.ruta !== 'lib/negocio/citasAlcanzables.ts')
    .filter((a) => /ghl_calendario_id is not null|'ghl_calendario_id', 'is not', null/.test(a.limpio))
    .map((a) => a.ruta);
  assert.deepEqual(copias, [], 'volvió una copia suelta de «alcanzable», sin la baja');
  assert.match(leer('lib/negocio/citasParaCerrar.ts'), /\.where\(alcanzable\(\)\)/);
  assert.match(leer('lib/negocio/consumoDelPrecall.ts'), /and \$\{alcanzable\('ci'\)\}/);
  assert.match(leer('lib/negocio/indicadoresDeCitas.ts'), /and \$\{esAlcanzable\('ci'\)\}/);
});

test('las colas de trabajo dejan afuera lo que el CRM borró', () => {
  const agenda = leer('lib/negocio/agenda.ts');
  assert.equal((agenda.match(/\.where\(sinBaja\('c\.baja_en_el_crm'\)\)\s*\.where\(sinBaja\('k\.baja_en_el_crm'\)\)/g) ?? []).length, 3);
  const fila = leer('lib/negocio/fila.ts');
  assert.match(fila, /\.where\(sinBaja\('c\.baja_en_el_crm'\)\)/);
  assert.equal((fila.match(/\.where\(sinBaja\('citas\.baja_en_el_crm'\)\)/g) ?? []).length, 2, 'un ícono de la fila cuenta citas borradas');
  assert.match(leer('lib/negocio/miDia.ts'), /\.where\(noCancelada\('estado_ghl'\)\)\s*\.where\(sinBaja\(\)\)/);
  assert.match(leer('lib/negocio/enlacesDeLaCita.ts'), /\.where\(noCancelada\('estado_ghl'\)\)\s*\.where\(sinBaja\(\)\)/);
});

test('la tarea de contactos relee los congelados y cuenta sus pedidos en el sello', () => {
  const b = leer('lib/negocio/barrido.ts');
  assert.match(b, /releerLosCongelados\(\{ token: acceso\.token, locationId: acceso\.locationId \}, TOPE_DE_CONGELADOS, \{ fin, ahora \}\)/);
  assert.match(b, /resultado: \{ \.\.\.r\.resumen, miniaturas, avisos, congeladosReleidos: congelados \},/);
  assert.match(b, /llamadas: r\.resumen\.llamadas \+ miniaturas\.pedidos \+ avisos\.llamadas \+ congelados\.pedidos,/);
  // Y sólo un 404 marca: la relectura marca cuando `contactoPorId` devuelve `datos: null`, nunca con un fallo.
  const s = leer('lib/negocio/sincronizar.ts');
  assert.match(s, /if \(!leido\.datos\) \{\s*if \(await marcarLaBaja\(id\)\) r\.dadosDeBaja\+\+;/);
  assert.match(s, /if \(!r\.datos\) \{[\s\S]{0,200}await marcarLaBaja\(ghlContactId\);/);
  // El GET de una cita: 404 es `null`, y una forma desconocida es un fallo, no una baja.
  const cal = leer('lib/ghl/calendarios.ts');
  assert.match(cal, /if \(r\.tipo === 'rechazado' && r\.estado === 404\) return \{ tipo: 'datos', datos: null \};/);
  assert.match(cal, /codigo: 'cita_sin_forma'/);
});

test('Sales y Conversion dicen cuántas citas del período no se releen; el Leads Portal, la baja y la última lectura', () => {
  assert.match(leer('app/api/sales/route.ts'), /await citasSinReleer\(periodo\.dias\),[\s\S]*relectura,\n {2}\}\);/);
  assert.match(leer('app/api/conversion/route.ts'), /await citasSinReleer\(periodo\.dias\),[\s\S]*frescura,\n {4}relectura,/);
  assert.match(leer('components/sales/PanelDeSales.jsx'), /\{p\.relectura\?\.texto \? <p className="sl-relectura">\{p\.relectura\.texto\}<\/p> : null\}/);
  assert.match(leer('app/sales.css'), /#v-sales \.sl-relectura \{/);
  assert.match(leer('components/conversion/PanelDeConversion.jsx'), /if \(p\.relectura\?\.texto\) motivos\.push\(p\.relectura\.texto\);/);
  const panel = leer('components/leads-portal/PanelDeLeadsPortal.jsx');
  assert.match(panel, /\{l\.bajaEnElCrm \? <span className="lp-marca lp-marca-descarte">borrado en el CRM<\/span> : null\}/);
  assert.match(panel, /congelado\{l\.leidoEl \? ` · última lectura: \$\{fechaCorta\(l\.leidoEl\)\}` : ''\}/);
  const ficha = leer('components/leads-portal/FichaDelLead.jsx');
  assert.match(ficha, /\{f\.bajaEnElCrmEl \? <span className="lp-marca lp-marca-descarte">borrado en el CRM el \{fecha\(f\.bajaEnElCrmEl\)\}<\/span> : null\}/);
  assert.match(ficha, /c\.borrada \? 'borrada en el CRM' : c\.alcanzable \? null : 'congelada'/);
});

/* Los dos GET que deciden una baja, corridos contra un GoHighLevel falso (sin base): SÓLO un 404 devuelve `null`. Un 200
   con una forma que no se midió es un fallo —marcar la baja de algo vivo lo sacaría de las colas y de las cifras—. */
test('los GET de la baja: sólo un 404 es `null`; un 200 sin la cita o el contacto es un fallo', async () => {
  const original = globalThis.fetch;
  const acceso = { token: 't', locationId: 'l' };
  const con = (estado: number, cuerpo: unknown) => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  };
  try {
    con(404, { message: 'not found' });
    assert.deepEqual(await citaPorId(acceso, 'e1'), { tipo: 'datos', datos: null });
    assert.deepEqual(await contactoPorId(acceso, 'c1'), { tipo: 'datos', datos: null });
    con(200, { otra: 'forma' });
    assert.equal((await citaPorId(acceso, 'e1')).tipo, 'fallo', 'una cita sin forma se leyó como borrada');
    assert.equal((await contactoPorId(acceso, 'c1')).tipo, 'fallo', 'un contacto sin forma se leyó como borrado');
    con(500, {});
    assert.equal((await citaPorId(acceso, 'e1')).tipo, 'fallo');
    con(200, { appointment: { id: 'e1', contactId: 'c1', startTime: '2026-10-29T10:00:00Z', deleted: true } });
    const viva = await citaPorId(acceso, 'e1');
    assert.ok(viva.tipo === 'datos' && viva.datos !== null && viva.datos.id === 'e1' && viva.datos.borrada === true);
  } finally {
    globalThis.fetch = original;
  }
});
