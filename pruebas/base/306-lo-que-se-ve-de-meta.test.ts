// LO QUE SE VE DE META DIRECTO: LA ENTREGA DE CADA CAMPAÑA Y LA RETENCIÓN DEL VIDEO. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (Meta directo, M4, 2026-10-26)
//
// GoHighLevel no daba ni el presupuesto ni el estado de entrega de una campaña (A8-23, A8-25), ni el video de un
// anuncio (C14-04/05). Meta directo los trae (`102`), y las pantallas los usan:
//
//   · Acquisition: cada campaña leída de Meta trae su `entrega` —estado efectivo, presupuesto, moneda y objetivo—; una
//     que no se leyó de Meta, no la trae (no se inventa) — mutación: no leer `estado_efectivo`;
//   · Creative: la retención de una pieza es la parte de sus reproducciones que llegó al final, con su curva por
//     cuartiles; con menos reproducciones que el piso, «bajo el piso»; sin video de Meta, «sin fuente» — mutaciones: el
//     denominador equivocado, sin el piso.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { lecturaDeAcquisition } from '../../lib/negocio/embudosDeAcquisition.ts';
import { lecturaDeCreative, PISO_DE_REPRODUCCIONES } from '../../lib/negocio/lecturaDeCreative.ts';

const SLUG = 'gamma-306';
const ZONA = 'America/Lima';
let admin: Client;
let org: string;

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['metricas_de_anuncio', 'anuncios', 'campanas', 'gasto_de_la_cuenta']) await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Un anuncio de una campaña con un día de métricas de hace 2 días, con o sin video. */
async function anuncio(id: string, campana: string, nombre: string, video: Record<string, number> | null): Promise<void> {
  await admin.query(`insert into negocio.anuncios (org_id, meta_anuncio_id, meta_campana_id, nombre) values ($1, $2, $3, $4)`, [org, id, campana, nombre]);
  await admin.query(
    `insert into negocio.metricas_de_anuncio (org_id, meta_anuncio_id, fecha, gasto, impresiones, clics, video, fuente)
     values ($1, $2, current_date - 2, 10, 2000, 20, $3, 'meta')`,
    [org, id, video === null ? null : JSON.stringify(video)],
  );
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(admin, `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 306', $1, $2) returning id`, [SLUG, ZONA]);
  assert.ok(o);
  org = o.id;
  // Una campaña leída de Meta directo, con su entrega; otra que sólo se conoce de antes (GoHighLevel).
  await admin.query(
    `insert into negocio.campanas (org_id, meta_campana_id, nombre, estado, estado_efectivo, presupuesto_diario, moneda, objetivo)
     values ($1, '3060000000001', 'De Meta 306', 'ACTIVE', 'ADSET_PAUSED', 50, 'PEN', 'OUTCOME_LEADS'),
            ($1, '3060000000002', 'De antes 306', 'ACTIVE', null, null, null, null)`,
    [org],
  );
  // Tres piezas: con video y reproducciones de sobra; con video y pocas reproducciones; sin video.
  await anuncio('3060000000101', '3060000000001', 'pieza con video 306', { p25: 400, p50: 250, p75: 150, p100: 100, reproducciones: 500 });
  await anuncio('3060000000102', '3060000000001', 'pieza con pocas vistas 306', { p25: 5, p50: 3, p75: 2, p100: 1, reproducciones: PISO_DE_REPRODUCCIONES - 1 });
  await anuncio('3060000000103', '3060000000002', 'pieza sin video 306', null);
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('Acquisition: la campaña de Meta trae su entrega; la de antes, no', async () => {
  const r = await conOrganizacion(org, () => lecturaDeAcquisition({ clave: '30d', dias: 30 }, ZONA));
  const de = (id: string) => r.embudos.campanas.find((c) => c.campana === id);
  assert.deepEqual(de('3060000000001')?.entrega, {
    estadoEfectivo: 'ADSET_PAUSED',
    presupuestoDiario: 50,
    presupuestoTotal: null,
    moneda: 'PEN',
    objetivo: 'OUTCOME_LEADS',
  });
  assert.equal(de('3060000000002')?.entrega, undefined, 'se inventó una entrega para una campaña que no se leyó de Meta');
});

test('Creative: la retención es la parte de las reproducciones que llegó al final, con su piso y su curva', async () => {
  const { pantalla } = await conOrganizacion(org, () => lecturaDeCreative(30));
  const de = (nombre: string) => pantalla.piezas.find((p) => p.nombre === nombre);
  const conVideo = de('pieza con video 306');
  assert.deepEqual(conVideo?.cifras.retencion, { valor: 0.2, motivo: null });
  assert.deepEqual(conVideo?.ficha.curvaDelVideo, { p25: 0.8, p50: 0.5, p75: 0.3, p100: 0.2, reproducciones: 500 });
  const pocas = de('pieza con pocas vistas 306');
  assert.deepEqual(pocas?.cifras.retencion, { valor: null, motivo: 'bajo_el_piso' });
  assert.equal(pocas?.ficha.curvaDelVideo, null);
  const sin = de('pieza sin video 306');
  assert.deepEqual(sin?.cifras.retencion, { valor: null, motivo: 'sin_fuente' });
  assert.equal(sin?.ficha.curvaDelVideo, null);
});
