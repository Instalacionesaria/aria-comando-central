// LA TAREA PROGRAMADA DE LOS ANALIZADORES, y su lugar en el barrido. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// Que la tarea haga las tres cosas en su orden —descubrir, drenar, completar fichas— dentro del
// tiempo que tiene, y que el barrido la despache de verdad y deje su sello:
//
//   · con tiempo, una reunión nueva termina la corrida DONE y con ficha;
//   · sin tiempo para un análisis, lo descubierto queda PENDING y el sello lo dice;
//   · con la llave de IA rechazada no se intenta ningún análisis, y el sello lo dice;
//   · el sello `analizadores` existe en la base (sin la `058`, `sellar` falla contra el CHECK).
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { correrAnalizadores } from '../../lib/analizadores/tarea.ts';
import { relojDe } from '../../lib/analizadores/pipeline.ts';
import {
  FIN_PARA_LOS_ANALIZADORES_MS,
  HORARIOS,
  barrerTodo,
  motivoDeLoIncompleto,
  type EmpresaParaBarrer,
} from '../../lib/negocio/barrido.ts';
import { maxDuration } from '../../app/api/cron/route.ts';
import {
  TABLAS_DEL_ANALIZADOR,
  delModelo,
  instalarRedFalsa,
  quitarRedFalsa,
  red,
  unaReunion,
} from '../apoyo/analizador.ts';

let esc: Escenario;
const ACCESO = { tipo: 'listo' as const, claveIa: 'ia-falsa', claveTldv: 'tldv-falsa' };

async function limpiar(): Promise<void> {
  for (const t of TABLAS_DEL_ANALIZADOR) {
    await esc.admin.query(`delete from negocio.${t} where org_id = any($1)`, [[esc.org, esc.otraOrg]]);
  }
  await esc.admin.query(`delete from negocio.tareas_programadas where tarea = 'analizadores'`);
}

before(async () => {
  esc = await montar('analizador-tarea');
  instalarRedFalsa();
});
beforeEach(async () => {
  await limpiar();
  red.reiniciar();
});
after(async () => {
  await limpiar();
  quitarRedFalsa();
  await cerrarClientes();
  await cerrarTodo();
});

/** Una HT manual PENDING con su transcripción: lista para que el drenado la tome. */
async function unaManualConTexto(): Promise<string> {
  const r = await esc.admin.query(
    `insert into negocio.analizador_llamadas (org_id, tipo, proveedor, estado) values ($1, 'HT', 'MANUAL', 'PENDING') returning id`,
    [esc.org],
  );
  await esc.admin.query(
    `insert into negocio.analizador_transcripciones (org_id, llamada_id, texto, segmentos, con_marcas_de_tiempo)
     values ($1, $2, '[A]: hola', '[{"startSec":0,"endSec":0,"speaker":"A","text":"hola"}]', false)`,
    [esc.org, r.rows[0].id],
  );
  return r.rows[0].id;
}

async function estados(): Promise<string[]> {
  const r = await esc.admin.query('select estado from negocio.analizador_llamadas where org_id = $1 order by creado_el', [esc.org]);
  return r.rows.map((f) => f.estado);
}

test('con tiempo, una reunión nueva termina la corrida DONE y con su ficha', async () => {
  unaReunion('m-1', 'HT');
  red.analisis.push(() => delModelo('{"score": 7, "outcome": "NO_CERRADA"}'));
  red.analisis.push(() => delModelo('{"summary": "vende pan"}'));
  const r = await correrAnalizadores(esc.org, ACCESO, relojDe(300_000));
  assert.deepEqual(
    { d: r.descubrimiento.tipo === 'hecho' && r.descubrimiento.descubiertas, a: r.analizadas, f: r.fichas, t: r.sinTiempo },
    { d: 1, a: 1, f: 1, t: 0 },
  );
  assert.deepEqual(await estados(), ['DONE']);
  const f = await esc.admin.query('select estado from negocio.analizador_fichas where org_id = $1', [esc.org]);
  assert.deepEqual(f.rows, [{ estado: 'OK' }]);
});

test('sin tiempo para un análisis, lo descubierto queda PENDING y se cuenta', async () => {
  /* 120 s alcanzan para descubrir y no para un análisis (150 s + margen). La corrida no arranca la
     inferencia —se pagaría y no se guardaría— y deja la llamada para la próxima. */
  unaReunion('m-1', 'HT');
  const r = await correrAnalizadores(esc.org, ACCESO, relojDe(120_000));
  assert.equal(r.analizadas, 0);
  assert.equal(r.sinTiempo, 1);
  assert.equal(red.llamadasAlAnalisis, 0);
  assert.deepEqual(await estados(), ['PENDING']);
  assert.match(String(motivoDeLoIncompleto(r)), /1 llamada\(s\) quedaron para la próxima corrida/);
});

test('con la llave de IA rechazada no se intenta ningún análisis', async () => {
  /* Cada intento fallaría con un 401 y dejaría la llamada FAILED: la de antes, que estaba PENDING y
     bien, quedaría marcada como rota por un problema de la llave. */
  /* CON transcripción: sin ella el drenado la rechazaría antes de llamar al modelo, y la mutación que
     sigue drenando con la llave rechazada pasaría sin que se viera. */
  await unaManualConTexto();
  unaReunion('m-1', 'HT');
  red.estadoDeAnthropic = 401;
  const r = await correrAnalizadores(esc.org, ACCESO, relojDe(300_000));
  assert.equal(r.llaveRechazada, 'ia');
  assert.equal(red.llamadasAlAnalisis, 0);
  assert.deepEqual(await estados(), ['PENDING']);
  assert.match(String(motivoDeLoIncompleto(r)), /llave de IA/);
});

test('con la llave de tl;dv rechazada, lo ya guardado se drena igual', async () => {
  await unaManualConTexto();
  red.estadoDeTldv = 401;
  const r = await correrAnalizadores(esc.org, ACCESO, relojDe(300_000));
  assert.equal(r.llaveRechazada, 'tldv');
  assert.equal(r.analizadas, 1);
  assert.match(String(motivoDeLoIncompleto(r)), /tl;dv rechazó la llave/);
});

test('el barrido despacha la tarea en su horario y la SELLA', async () => {
  /* Sin la `058`, `sellar` falla contra el CHECK de `tareas_programadas`: el error queda en el
     registro y la pantalla de monitoreo nunca se entera de que la tarea existe. */
  unaReunion('m-1', 'HT');
  const empresa: EmpresaParaBarrer = {
    org: { id: esc.org, slug: 'alfa', nombre: 'Alfa', activa: true, esPrincipal: false, zonaHoraria: 'UTC' } as EmpresaParaBarrer['org'],
    acceso: { tipo: 'falta', que: 'sin_token' },
    auditor: { tipo: 'falta', que: 'sin_llave_de_ia' },
    analizador: ACCESO,
  };
  const r = await barrerTodo('41 * * * *', [empresa]);
  assert.deepEqual(r.tareas, ['analizadores']);
  const renglon = r.renglones.find((x) => x.tarea === 'analizadores');
  assert.equal(renglon?.estado, 'corrio', 'la empresa no tiene token del CRM y la tarea igual tiene que correr');
  const s = await esc.admin.query(`select ultimo_estado as estado from negocio.tareas_programadas where org_id = $1 and tarea = 'analizadores'`, [esc.org]);
  assert.deepEqual(s.rows, [{ estado: 'corrio' }]);
});

test('el fin de los Analizadores es la función entera menos el margen, no el presupuesto compartido', () => {
  /* Con los 180 s del presupuesto, menos lo que ya se gastó en descubrir, no quedaría nunca una
     ventana de 150 s para un análisis: la guardia lo rechazaría en todas las corridas y las
     pendientes no se drenarían jamás, sin que nada fallara. */
  assert.equal(FIN_PARA_LOS_ANALIZADORES_MS, maxDuration * 1000 - 15_000);
  // Y corre SOLA en su horario: compartirlo con las tareas del CRM le comería esa ventana.
  const suyos = Object.entries(HORARIOS).filter(([, h]) => (h.tareas as readonly string[]).includes('analizadores'));
  assert.deepEqual(suyos.map(([, h]) => h.tareas), [['analizadores']]);
});
