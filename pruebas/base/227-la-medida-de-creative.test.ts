// LO QUE MIDE EL DETECTOR DE CREATIVE, CONTRA LA BASE DE VERDAD. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `medirCreative` (`lib/agentes/detectores/creative.ts`, AG10). Lo demás que mide lo leen las funciones de la
// pantalla, y sus pruebas son las suyas (158, 159 y las de calidad); lo propio del detector es la frecuencia
// y la frescura:
//
//   · la frecuencia de un anuncio se pesa por impresiones, y sólo con los días que la traen: el promedio simple
//     le daría a un día de cien impresiones el peso de uno de diez mil;
//   · la ventana es la de las métricas de la pantalla (`ventanaDeMetricas`): el día de hace 7 queda afuera;
//   · el nombre de la pieza sale del anuncio de la MISMA empresa, aunque otra tenga el mismo id. Lo cuida la
//     política de fila; la unión por las dos columnas es la segunda línea, como en `costoDelAnuncio`, y por eso
//     la mutación que la quita queda verde;
//   · en 30 días no se mide (la regla es semanal), y sin la lectura de anuncios al día, tampoco se publica;
//   · al mostrar, la señal de un anuncio lleva el nombre del anuncio y la de una pieza, su nombre normalizado.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { CRE, medirCreative } from '../../lib/agentes/detectores/creative.ts';
import { reconciliarSenales } from '../../lib/agentes/senales/escritura.ts';
import { senalesDeLaPantalla } from '../../lib/agentes/senales/lectura.ts';
import { textoDeCreative } from '../../lib/agentes/plan/creative.ts';
import type { Deteccion } from '../../lib/agentes/senales/tipos.ts';

let esc: Escenario;
const MARCA = '55555227';
let selloOriginal: { ultima_corrida_el: Date; ultimo_estado: string } | null = null;

async function limpiar(): Promise<void> {
  await esc.admin.query(`delete from negocio.senales where org_id = $1 and departamento = 'creative'`, [esc.org]);
  await esc.admin.query('delete from negocio.metricas_de_anuncio where meta_anuncio_id like $1', [`${MARCA}%`]);
  await esc.admin.query('delete from negocio.anuncios where meta_anuncio_id like $1', [`${MARCA}%`]);
}

async function sellarAnuncios(estado: string): Promise<void> {
  await esc.admin.query(
    `insert into negocio.tareas_programadas (org_id, tarea, ultima_corrida_el, ultimo_estado) values ($1, 'anuncios', now(), $2)
       on conflict (org_id, tarea) do update set ultima_corrida_el = now(), ultimo_estado = $2`,
    [esc.org, estado],
  );
}

before(async () => {
  esc = await montar('MedidaCreative');
  await limpiar();
  const r = await esc.admin.query(`select ultima_corrida_el, ultimo_estado from negocio.tareas_programadas where org_id = $1 and tarea = 'anuncios'`, [esc.org]);
  selloOriginal = r.rows[0] ?? null;
});

after(async () => {
  await limpiar();
  // El sello de la empresa vuelve a como estaba: otras pruebas leen su frescura.
  if (selloOriginal) {
    await esc.admin.query(`update negocio.tareas_programadas set ultima_corrida_el = $2, ultimo_estado = $3 where org_id = $1 and tarea = 'anuncios'`, [
      esc.org,
      selloOriginal.ultima_corrida_el,
      selloOriginal.ultimo_estado,
    ]);
  } else {
    await esc.admin.query(`delete from negocio.tareas_programadas where org_id = $1 and tarea = 'anuncios'`, [esc.org]);
  }
  await cerrarTodo();
  await cerrarClientes();
});

async function unAnuncio(org: string, id: string, nombre: string): Promise<void> {
  await esc.admin.query(
    `insert into negocio.anuncios (org_id, meta_anuncio_id, meta_conjunto_id, meta_campana_id, nombre, objetivo)
       values ($1, $2, '7700', '8800', $3, 'OUTCOME_LEADS')`,
    [org, id, nombre],
  );
}

async function unDia(org: string, id: string, hace: number, impresiones: number, frecuencia: number | null): Promise<void> {
  await esc.admin.query(
    `insert into negocio.metricas_de_anuncio
       (org_id, meta_anuncio_id, fecha, gasto, impresiones, clics, alcance, ctr, cpc, frecuencia)
     values ($1, $2, current_date - $3::int, 1, $4, 10, null, null, null, $5)`,
    [org, id, hace, impresiones, frecuencia],
  );
}

const medir = (ventana: '7d' | '30d') => conOrganizacion(esc.org, () => medirCreative(ventana));

test('la frecuencia se pesa por impresiones, sólo con los días que la traen y dentro de la semana', async () => {
  await limpiar();
  const id = `${MARCA}01`;
  await unAnuncio(esc.org, id, '  Pieza Pesada ');
  await unDia(esc.org, id, 1, 1000, 2);
  await unDia(esc.org, id, 2, 3000, 5);
  // Sin frecuencia: no entra ni arriba ni abajo.
  await unDia(esc.org, id, 3, 9000, null);
  // Hace 7 días: fuera de la ventana de la pantalla.
  await unDia(esc.org, id, 7, 100000, 10);
  // La otra empresa, con el mismo id: ni su nombre ni sus días cuentan.
  await unAnuncio(esc.otraOrg, id, 'pieza ajena');
  await unDia(esc.otraOrg, id, 1, 50000, 9);

  const m = await medir('7d');
  // (2 · 1.000 + 5 · 3.000) / 4.000 = 4,25; el promedio simple diría 3,5.
  assert.deepEqual(m.frecuencias?.get(id), { frecuencia: 4.25, impresiones: 4000, creativo: 'pieza pesada' });
});

test('en 30 días la frecuencia no se mide: la regla es semanal', async () => {
  const m = await medir('30d');
  assert.equal(m.frecuencias, null);
});

test('la lectura de anuncios: al día con un sello fresco, no al día si la última corrida falló', async () => {
  await sellarAnuncios('corrio');
  assert.equal((await medir('30d')).anunciosAlDia, true);
  await sellarAnuncios('fallo');
  assert.equal((await medir('30d')).anunciosAlDia, false);
});

test('el período es el de la ventana, contado en días de la base', async () => {
  const m = await medir('7d');
  const r = await esc.admin.query<{ desde: string; hasta: string }>(
    `select to_char(current_date - 6, 'YYYY-MM-DD') as desde, to_char(current_date, 'YYYY-MM-DD') as hasta`,
  );
  assert.deepEqual(m.periodo, r.rows[0]);
});

const deteccion = (regla: string, entidad: Deteccion['entidad']): Deteccion => ({
  regla,
  entidad,
  metrica: 'x',
  lineaBase: null,
  valorActual: 3.5,
  cambioPct: null,
  muestra: 2000,
  periodo: { desde: '2026-09-29', hasta: '2026-10-05' },
  datosDesde: null,
  gravedad: 'media',
  causasPosibles: [],
  revisionRecomendada: 'Revisa.',
  perdidaContactos: null,
  destino: null,
  requiereValidacionEjecutiva: false,
  umbral: { valor: 3, provisional: true },
  evidencia: {},
});

test('al mostrar, el anuncio lleva su nombre y la pieza el suyo', async () => {
  await limpiar();
  await unAnuncio(esc.org, `${MARCA}02`, 'Anuncio con nombre');
  await conOrganizacion(esc.org, () =>
    reconciliarSenales({
      departamento: 'creative',
      detector: 'creative',
      ventana: '7d',
      detecciones: [deteccion(CRE.frecuenciaAlta, { tipo: 'anuncio', id: `${MARCA}02` }), deteccion(CRE.caidaDeCtr, { tipo: 'pieza', id: 'pieza que cae' })],
      sinMedicion: [],
    }),
  );
  const lista = await conOrganizacion(esc.org, () => senalesDeLaPantalla('creative', '7d', textoDeCreative));
  assert.deepEqual(
    lista.map((x) => [x.entidad.tipo, x.nombre]).sort(),
    [['anuncio', 'Anuncio con nombre'], ['pieza', 'pieza que cae']],
  );
});
