// LA HISTORIA SE LEE POR EL ÍNDICE DEL LEAD: la trayectoria y el disparador del cuadrante. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (la `106`)
//
// Los índices de la historia empiezan por (org_id, cuenta_id, contacto_id…), y PostgreSQL 17 (producción) no tiene
// skip scan: una búsqueda por (org_id, contacto_id) SIN la cuenta no puede usar el contacto como condición del índice
// y recorre todas las filas de la organización. Medido en una copia de producción migrada a la 106 (doc 23 § 9): con
// 570 000 respuestas, la trayectoria de un lead sin ninguna tardaba 129 ms (494 ms en frío) en vez de menos de 1 ms, y
// el costo crecía con la tabla entera, no con el lead.
//
//   · cada lectura de negocio.trayectoria_del_lead sobre una tabla de la historia cuyos índices empiezan por
//     (org_id, cuenta_id…) —eventos, clasificaciones, respuestas, toques, llamadas analizadas— lleva la cuenta Y el
//     contacto del lead, que es lo que deja usar el prefijo entero del índice — mutaciones: sacar la cuenta de las
//     respuestas, de los eventos, de las clasificaciones o de los toques;
//   · el disparador del cuadrante busca «¿es la primera vez?» igual — mutación: v_primera sin la cuenta.
//   (citas y resultados tienen su índice (org_id, contacto_id…) desde antes: la cuenta les sobra, y no se miran.)
//
// CÓMO SE MIDE. auto_explain, con los planes como avisos al cliente (log_level = notice) y las sentencias anidadas
// (las de la función y las del disparador): cada recorrido de esas tablas tiene que nombrar cuenta_id y contacto_id
// en sus condiciones (de índice o de filtro). Qué índice elige el planificador en una base de prueba chica depende de
// costos casi empatados y de las estadísticas del momento, así que eso no se afirma acá: con volumen, el plan es el
// índice del lead con las tres columnas en la condición (lo medido está en el doc 23 § 9).
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';

const SLUG = 'indices-326';

let admin: Client;
let org: string;
let cuenta: string;
let lead: string;

/** Las tablas de la historia que se buscan por lead con índices (org_id, cuenta_id…) (los eventos, por partición). */
const POR_LEAD = /^(eventos(_.*)?|clasificaciones|respuestas_del_lead|toques_de_marketing|analizador_llamadas)$/;

interface Nodo {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  'Index Cond'?: string;
  'Recheck Cond'?: string;
  Filter?: string;
  Plans?: Nodo[];
}

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  await admin.query(`delete from negocio.contactos where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Índices 326', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  cuenta = (await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]))!.id;
  // Un lead con algo en cada tabla: cuadrante (clasificación y evento), campos (respuestas), atribución (toques),
  // etiquetas (eventos), una cita y un resultado.
  lead = (
    await unaFila<{ id: string }>(
      admin,
      `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, cuadrante, campos_del_crm, atribucion_primera, etiquetas)
       values ($1, $2, 'lead326', 'Lead 326', 'valida', '{"cf326": "Clínica"}', '{"adId": "326"}', array['asistio']) returning id`,
      [org, cuenta],
    )
  )!.id;
  await admin.query(
    `insert into negocio.citas (org_id, cuenta_id, ghl_evento_id, contacto_id, inicio_el, estado_ghl) values ($1, $2, 'cita326', $3, now() + interval '1 day', 'confirmed')`,
    [org, cuenta, lead],
  );
  await admin.query(`insert into negocio.resultados (org_id, cuenta_id, contacto_id, salida, rol) values ($1, $2, $3, 'seguimiento', 'closer')`, [
    org,
    cuenta,
    lead,
  ]);
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
  }
});

/** Corre `trabajo` con auto_explain prendido y devuelve los planes de TODAS sus sentencias, anidadas incluidas. Se deshace. */
async function planesDe(trabajo: () => Promise<unknown>): Promise<Nodo[]> {
  const planes: Nodo[] = [];
  const oir = (m: { message?: string }) => {
    const texto = m.message ?? '';
    const i = texto.indexOf('{');
    if (!texto.includes('plan:') || i < 0) return;
    planes.push((JSON.parse(texto.slice(i)) as { Plan: Nodo }).Plan);
  };
  admin.on('notice', oir);
  await admin.query('begin');
  try {
    await admin.query(`load 'auto_explain'`);
    for (const s of [
      `set local auto_explain.log_min_duration = 0`,
      `set local auto_explain.log_nested_statements = on`,
      `set local auto_explain.log_format = 'json'`,
      `set local auto_explain.log_level = 'notice'`,
    ]) {
      await admin.query(s);
    }
    await trabajo();
  } finally {
    await admin.query('rollback');
    admin.off('notice', oir);
  }
  return planes;
}

/** Un nodo que LEE una tabla (no el que escribe: un insert también nombra su tabla). */
const lee = (n: Nodo) => /Scan$/.test(n['Node Type']) && n['Node Type'] !== 'Bitmap Index Scan';

/** Cada recorrido de una tabla de la historia que no busca al lead dentro de su cuenta (sin cuenta_id o sin contacto_id). */
function sinElLead(planes: Nodo[]): string[] {
  const malos: string[] = [];
  // Las condiciones del nodo y, en un Bitmap Heap Scan, las de sus Bitmap Index Scan de abajo.
  const condiciones = (n: Nodo): string[] => [
    n['Index Cond'] ?? '', n['Recheck Cond'] ?? '', n.Filter ?? '',
    ...(n['Node Type'] === 'Bitmap Heap Scan' || /^Bitmap (Index|And|Or)/.test(n['Node Type']) ? (n.Plans ?? []).flatMap(condiciones) : []),
  ];
  const mirar = (n: Nodo) => {
    const tabla = n['Relation Name'];
    if (tabla && POR_LEAD.test(tabla) && lee(n)) {
      const conds = condiciones(n).filter((c) => c !== '');
      if (!conds.some((c) => c.includes('cuenta_id')) || !conds.some((c) => c.includes('contacto_id'))) {
        malos.push(`${tabla}: ${n['Node Type']}${n['Index Name'] ? ` por ${n['Index Name']}` : ''} (${conds.join(' · ') || 'sin condiciones'})`);
      }
    }
    for (const h of n.Plans ?? []) mirar(h);
  };
  for (const p of planes) mirar(p);
  return malos;
}

/** Las tablas de la historia que los planes recorrieron (para no pasar en vacío). */
function tablas(planes: Nodo[]): Set<string> {
  const vistas = new Set<string>();
  const mirar = (n: Nodo) => {
    const t = n['Relation Name'];
    if (t && POR_LEAD.test(t) && lee(n)) vistas.add(t.startsWith('eventos') ? 'eventos' : t);
    for (const h of n.Plans ?? []) mirar(h);
  };
  planes.forEach(mirar);
  return vistas;
}

test('la trayectoria busca al lead dentro de su cuenta en cada tabla de la historia, no en toda la organización', async () => {
  const planes = await planesDe(() => admin.query(`select negocio.trayectoria_del_lead($1)`, [lead]));
  assert.deepEqual(
    [...tablas(planes)].sort(),
    ['analizador_llamadas', 'clasificaciones', 'eventos', 'respuestas_del_lead', 'toques_de_marketing'],
    'auto_explain no mostró las lecturas de la trayectoria: la prueba pasaría en vacío',
  );
  assert.deepEqual(sinElLead(planes), [], 'una lectura de la trayectoria no lleva la cuenta: recorrería la organización entera');
});

test('el disparador del cuadrante busca la primera vez del lead dentro de su cuenta', async () => {
  const planes = await planesDe(() => admin.query(`update negocio.contactos set cuadrante = 'prioriza' where org_id = $1 and id = $2`, [org, lead]));
  assert.ok(tablas(planes).has('clasificaciones'), 'auto_explain no mostró la búsqueda del disparador');
  assert.deepEqual(sinElLead(planes), [], 'el disparador del cuadrante no lleva la cuenta: recorrería las clasificaciones de la organización');
});
