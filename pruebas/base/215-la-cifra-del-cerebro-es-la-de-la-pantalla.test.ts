// LA CIFRA DEL CEREBRO ES LA DE LA PANTALLA, EN LAS CUATRO VENTANAS. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/executive/adaptadores/` (AG6; `docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-42; `07`, AG-101):
// «consume, no recalcula». Cada herramienta llama a la misma función, con los mismos argumentos, que la
// ruta de su pantalla, así que da la misma cifra. Se compara contra la RUTA de verdad, con la sesión de
// quien mira, sobre la empresa sembrada de `db/sembrado/casos-de-los-agentes.ts`:
//
//   · las que reciben el período, en las cuatro ventanas (hoy, 7d, 30d, completo): con una ventana fija en el
//     adaptador, coincidiría en una sola;
//   · las que no, con la persona de su pantalla: el setter ve lo suyo, el closer vinculado lo suyo y quien
//     administra, la empresa;
//   · y `economia_del_negocio`, que no tiene pantalla: sus ventas son las de Sales, su inversión la del mes
//     contada aparte, y con cero ventas no hay retorno.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import {
  ZONA_DE_LOS_CASOS,
  quitarEmpresasDeLosAgentes,
  sembrarCasosDeLosAgentes,
  type EmpresasDeLosAgentes,
} from '../../db/sembrado/casos-de-los-agentes.ts';
import { ejecutarHerramienta, herramientasPara, type DatosDeLaRuta } from '../../lib/agentes/executive/herramientas.ts';
import { PERIODOS } from '../../lib/negocio/periodo.ts';
import { GET as acquisition } from '../../app/api/acquisition/route.ts';
import { GET as creative } from '../../app/api/creative/route.ts';
import { GET as conversion } from '../../app/api/conversion/route.ts';
import { GET as auditoria } from '../../app/api/auditoria/route.ts';
import { GET as sales } from '../../app/api/sales/route.ts';
import { GET as leadsPortal } from '../../app/api/leads-portal/route.ts';
import { GET as miDiaDelSetter } from '../../app/api/setter/mi-dia/route.ts';
import { GET as pipelineDelSetter } from '../../app/api/setter/pipeline/route.ts';
import { GET as miDiaDelCloser } from '../../app/api/closer/mi-dia/route.ts';
import { GET as agendaDelCloser } from '../../app/api/closer/agenda/route.ts';
import { GET as pipelineDelCloser } from '../../app/api/closer/pipeline/route.ts';

const PREFIJO = 'agentes-215-';
let admin: Client;
let e: EmpresasDeLosAgentes;
const tokens: Record<'admin' | 'setter' | 'closerUno', string> = { admin: '', setter: '', closerUno: '' };

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  e = await sembrarCasosDeLosAgentes(PREFIJO);
  for (const quien of Object.keys(tokens) as (keyof typeof tokens)[]) tokens[quien] = await sesionDe(e.personas[quien]);
});
after(async () => {
  for (const t of Object.values(tokens)) await admin.query('delete from identidad.sesiones where token_hash = $1', [hashDeToken(t)]);
  await quitarEmpresasDeLosAgentes(PREFIJO);
  await cerrarClientes();
  await cerrarTodo();
});

type Cuerpo = Record<string, any>;

const SECCIONES = ['acquisition', 'creative', 'conversion', 'conversation', 'sales', 'contacts', 'setter', 'closer'];
const TODAS = herramientasPara(SECCIONES);

async function herramienta(
  nombre: string,
  argumentos: Record<string, unknown>,
  quien: keyof typeof tokens = 'admin',
  deLaRuta: DatosDeLaRuta = { noAudita: null, integraciones: null },
): Promise<Cuerpo> {
  const contexto = { zona: ZONA_DE_LOS_CASOS, usuarioId: e.personas[quien], secciones: SECCIONES, deLaRuta };
  const r = await conOrganizacion(e.conDatos, () => ejecutarHerramienta(nombre, argumentos, TODAS, contexto));
  assert.equal(r.tipo, 'datos', `${nombre} no devolvió datos`);
  // Lo que viaja al modelo es el JSON, como el de la ruta: las fechas, como texto.
  return JSON.parse(JSON.stringify((r as { datos: Cuerpo }).datos)) as Cuerpo;
}

async function pantalla(ruta: (r: Request) => Promise<Response>, camino: string, quien: keyof typeof tokens = 'admin'): Promise<Cuerpo> {
  const r = await leerRespuesta<Cuerpo>(await ruta(pedirComo(camino, tokens[quien])));
  assert.equal(r.estado, 200, `${camino} contestó ${r.estado}`);
  return r.cuerpo;
}

const pares = (filas: Cuerpo[], ...campos: string[]) => filas.slice(0, 20).map((f) => campos.map((c) => f[c]));

for (const { clave } of PERIODOS) {
  const periodo = { periodo: clave };

  test(`Acquisition con «${clave}»: la inversión y las etapas del total`, async () => {
    const p = await pantalla(acquisition, `/api/acquisition?periodo=${clave}`);
    const h = await herramienta('embudos_de_acquisition', periodo);
    assert.equal(h.total.inversion, p.embudos.total.inversion);
    assert.deepEqual(pares(h.total.etapas, 'etapa', 'valor'), pares(p.embudos.total.etapas, 'etapa', 'valor'));
  });

  test(`Creative con «${clave}»: calidad, rendimiento y fatiga por pieza`, async () => {
    const p = await pantalla(creative, `/api/creative?periodo=${clave}`);
    const calidad = await herramienta('calidad_de_piezas', periodo);
    assert.deepEqual(pares(calidad.piezas.filas, 'creativo', 'contactos', 'agendaron'), pares(p.calidad.filas, 'creativo', 'contactos', 'agendaron'));
    assert.equal(calidad.piezas.total, p.calidad.filas.length);
    const rendimiento = await herramienta('rendimiento_de_piezas', periodo);
    assert.equal(rendimiento.gastoTotal, p.rendimiento.gastoTotal);
    assert.deepEqual(pares(rendimiento.piezas.filas, 'creativo', 'gasto', 'impresiones'), pares(p.rendimiento.filas, 'creativo', 'gasto', 'impresiones'));
    const fatiga = await herramienta('fatiga_de_piezas', periodo);
    assert.deepEqual(fatiga.conVeredicto, p.fatiga.conVeredicto);
  });

  test(`Conversion con «${clave}»: el recorrido y el formulario`, async () => {
    const p = await pantalla(conversion, `/api/conversion?periodo=${clave}`);
    const recorrido = await herramienta('recorrido_de_los_leads', periodo);
    assert.equal(recorrido.cohorte, p.recorrido.cohorte);
    assert.deepEqual(pares(recorrido.familias, 'familia', 'contactos', 'agendaron'), pares(p.recorrido.filas, 'familia', 'contactos', 'agendaron'));
    const formulario = await herramienta('formulario_de_la_landing', periodo);
    assert.deepEqual(pares(formulario.estados, 'estado', 'contactos'), pares(p.formulario.filas, 'estado', 'contactos'));
    assert.equal(formulario.finalizacion, p.formulario.finalizacion);
  });

  test(`Conversation con «${clave}»: cancelación, Lead Flow, atribución, precall y sentimiento`, async () => {
    const p = await pantalla(auditoria, `/api/auditoria?periodo=${clave}`);
    const cancelacion = await herramienta('cancelacion_de_citas', periodo);
    assert.deepEqual([cancelacion.citas, cancelacion.canceladas, cancelacion.tasa], [p.cancelacion.citas, p.cancelacion.canceladas, p.cancelacion.tasa]);
    const lead = await herramienta('lead_flow', periodo);
    for (const c of ['cohorte', 'agendaron', 'bookingRate', 'escritos', 'respondieron', 'sinNingunMensaje']) assert.deepEqual(lead[c], p.respuesta[c], c);
    const atribucion = await herramienta('atribucion_del_lead', periodo);
    assert.deepEqual(pares(atribucion.porFuente, 'etiqueta', 'cohorte', 'agendaron'), pares(p.atribucion.porFuente, 'etiqueta', 'cohorte', 'agendaron'));
    const precall = await herramienta('consumo_del_precall', periodo);
    assert.deepEqual([precall.sobre, precall.registraron], [p.precall.sobre, p.precall.registraron]);
    const sentimiento = await herramienta('sentimiento_por_flujo', periodo);
    for (const flujo of Object.keys(p.sentimiento)) assert.equal(sentimiento[flujo].juzgadas, p.sentimiento[flujo].juzgadas, flujo);
  });

  test(`Sales con «${clave}»: la cadena, el ciclo, el cierre por closer y la cancelación`, async () => {
    const p = await pantalla(sales, `/api/sales?periodo=${clave}`);
    const cadena = await herramienta('cadena_de_cierre', periodo);
    assert.equal(cadena.cohorte, p.cadena.cohorte);
    assert.deepEqual(pares(cadena.eslabones, 'clave', 'contactos'), pares(p.cadena.eslabones, 'clave', 'contactos'));
    const ciclo = await herramienta('ciclo_hasta_la_cita', periodo);
    assert.deepEqual([ciclo.p50, ciclo.p90, ciclo.cohorte], [p.ciclo.p50, p.ciclo.p90, p.ciclo.cohorte]);
    const cierre = await herramienta('cierre_por_closer', periodo);
    assert.deepEqual(pares(cierre.closers.filas, 'usuarioId', 'citas', 'ventas'), pares(p.closers.filas, 'usuarioId', 'citas', 'ventas'));
    const cancelacion = await herramienta('cancelacion_de_citas', periodo);
    assert.deepEqual([cancelacion.citas, cancelacion.tasa], [p.cancelacion.citas, p.cancelacion.tasa]);
  });

  test(`Leads › De GHL con «${clave}»: la cohorte y los tramos`, async () => {
    const p = await pantalla(leadsPortal, `/api/leads-portal?periodo=${clave}`);
    const h = await herramienta('cohorte_de_leads', periodo);
    assert.deepEqual(h.cohorte, p.cohorte);
    assert.deepEqual(h.todos, p.todos);
    assert.deepEqual(pares(h.leads.filas, 'id', 'tramo'), pares(p.leads, 'id', 'tramo'));
  });
}

test('la auditoría de los agentes: las tarjetas de la pantalla, sin los casos', async () => {
  const p = await pantalla(auditoria, '/api/auditoria?periodo=30d');
  const h = await herramienta('auditoria_de_agentes', {}, 'admin', { noAudita: p.noAudita, integraciones: null });
  assert.deepEqual(pares(h.tarjetas, 'agente', 'analizadas', 'rojos', 'amarillos', 'hallazgosAbiertos'), pares(p.tarjetas, 'agente', 'analizadas', 'rojos', 'amarillos', 'hallazgosAbiertos'));
  assert.equal(h.noAudita, p.noAudita);
  assert.equal((h.casosPorPatron.filas as { casos: number }[]).reduce((s, c) => s + c.casos, 0), p.casos.length);
});

test('el Setter: sus colas, su inicio y su pipeline, con la sesión del setter', async () => {
  const p = await pantalla(miDiaDelSetter, '/api/setter/mi-dia', 'setter');
  const colas = await herramienta('colas_del_setter', {}, 'setter');
  for (const [k, n] of Object.entries(colas.colas as Record<string, number>)) assert.equal(n, p.colas[k].length, k);
  assert.equal(colas.tareasPendientes, p.colas.tareasPendientes);
  const inicio = await herramienta('inicio_del_setter', {}, 'setter');
  assert.deepEqual(inicio.agendas, p.cockpit.agendas);
  assert.deepEqual(inicio.comision.directo.porcentaje, p.comision.directo.porcentaje);
  const pipe = await pantalla(pipelineDelSetter, '/api/setter/pipeline', 'setter');
  const h = await herramienta('pipeline_del_setter', {}, 'setter');
  assert.deepEqual(pares(h.columnas, 'clave', 'cuantos'), pares(pipe.columnas, 'clave', 'cuantos'));
});

for (const quien of ['closerUno', 'admin'] as const) {
  test(`el Closer, con la sesión de ${quien}: colas, inicio, agenda y pipeline`, async () => {
    const p = await pantalla(miDiaDelCloser, '/api/closer/mi-dia', quien);
    const colas = await herramienta('mi_dia_del_closer', {}, quien);
    for (const [k, n] of Object.entries(colas.colas as Record<string, number>)) assert.equal(n, p.colas[k].length, k);
    assert.equal(colas.de, quien === 'admin' ? 'empresa' : 'propio');
    const inicio = await herramienta('inicio_del_closer', {}, quien);
    for (const c of ['cobrado', 'ventas', 'conCitaAgendada', 'noShows']) assert.deepEqual(inicio[c], p.cockpit[c], c);
    assert.deepEqual(inicio.comision?.porcentaje ?? null, p.comision?.porcentaje ?? null);
    const agenda = await pantalla(agendaDelCloser, '/api/closer/agenda', quien);
    const a = await herramienta('agenda_del_closer', {}, quien);
    assert.deepEqual([a.hoy, a.hasta, a.total], [agenda.hoy, agenda.hasta, agenda.total]);
    const pipe = await pantalla(pipelineDelCloser, '/api/closer/pipeline', quien);
    const h = await herramienta('pipeline_del_closer', {}, quien);
    assert.deepEqual(pares(h.columnas, 'clave', 'cuantos'), pares(pipe.columnas, 'clave', 'cuantos'));
  });
}

test('la economía del mes: las ventas de Sales, la inversión del mes y, con cero ventas, sin retorno', async () => {
  /* El sembrado deja de gastar hace 16 días, así que en los primeros días de un mes no hay gasto del mes y la
     inversión sería nula con cualquier ventana. Un gasto de hoy hace que el mes tenga uno, y que todo lo
     anterior quede afuera. */
  await admin.query(
    `insert into negocio.metricas_de_anuncio (org_id, meta_anuncio_id, fecha, gasto)
     select org_id, meta_anuncio_id, timezone($2, now())::date, 123.45 from negocio.anuncios where org_id = $1 order by meta_anuncio_id limit 1`,
    [e.conDatos, ZONA_DE_LOS_CASOS],
  );
  const s = await pantalla(sales, '/api/sales?periodo=30d');
  const h = await herramienta('economia_del_negocio', {}, 'admin');
  assert.deepEqual(h.ventas, s.dinero.ventas);
  assert.deepEqual(h.cobrado, s.dinero.cobrado);
  // La inversión del mes, contada aparte: el gasto de los días del mes calendario de la empresa.
  const r = await admin.query<{ inversion: string | null }>(
    `select sum(m.gasto) as inversion
       from negocio.metricas_de_anuncio m
       join negocio.anuncios a on a.org_id = m.org_id and a.meta_anuncio_id = m.meta_anuncio_id
      where m.org_id = $1 and a.meta_campana_id is not null
        and m.fecha between date_trunc('month', timezone($2, now()))::date and timezone($2, now())::date`,
    [e.conDatos, ZONA_DE_LOS_CASOS],
  );
  const esperada = r.rows[0]!.inversion;
  assert.notEqual(esperada, null, 'el mes no tiene gasto: la comparación no miraría nada');
  assert.equal(h.inversion.valor, Math.round(Number(esperada) * 100) / 100);
  assert.equal(h.gastoHasta, (await admin.query<{ d: string }>(`select to_char(timezone($1, now())::date, 'YYYY-MM-DD') as d`, [ZONA_DE_LOS_CASOS])).rows[0]!.d);
  // El sembrado no tiene ninguna venta: no hay dato suficiente para el retorno ni el costo por venta.
  assert.equal(h.retorno, null);
  assert.equal(h.costoPorVenta, null);
  assert.match(String(h.aviso), /No hay dato suficiente/);
});

test('la economía con ventas: el retorno y el costo por venta, y sin ellos con una venta sin monto o el gasto incompleto', async () => {
  // Dos ventas con monto de Closer Uno, este mes. Lo que sigue a este test no mira el dinero.
  const resultado = (monto: number | null) =>
    admin.query(
      `insert into negocio.resultados (org_id, contacto_id, salida, rol, registrado_por, monto, creado_el)
       select org_id, id, 'venta', 'closer', $2, $3, now() from negocio.contactos where org_id = $1 order by alta_en_el_crm desc limit 1`,
      [e.conDatos, e.personas.closerUno, monto],
    );
  await resultado(1000);
  await resultado(500);
  const conVentas = await herramienta('economia_del_negocio', {}, 'admin');
  assert.equal(conVentas.ventas.valor, 2);
  assert.equal(conVentas.gastoEntero, true, 'el sembrado tiene filas de métricas en todos los días del mes antes de hoy');
  const inversion = conVentas.inversion.valor as number;
  assert.ok(inversion > 0);
  assert.equal(conVentas.retorno, Math.round((1500 / inversion) * 100) / 100);
  assert.equal(conVentas.costoPorVenta, Math.round((inversion / 2) * 100) / 100);
  assert.equal(conVentas.aviso, null);

  // Una venta sin monto: el cobrado está incompleto, y no hay retorno.
  await resultado(null);
  const sinMonto = await herramienta('economia_del_negocio', {}, 'admin');
  assert.deepEqual([sinMonto.ventasSinMonto, sinMonto.retorno, sinMonto.costoPorVenta], [1, null, null]);
  assert.match(String(sinMonto.aviso), /sin monto/);
  await admin.query(`delete from negocio.resultados where org_id = $1 and salida = 'venta' and monto is null`, [e.conDatos]);

  /* El gasto incompleto: un día del mes, antes de hoy, sin ninguna fila. El primero de un mes no hay días
     antes de hoy, así que ese día se borra la fila de hoy: sin gasto del mes, tampoco hay retorno. */
  const r = await admin.query<{ desde: string; hasta: string }>(
    `select date_trunc('month', timezone($1, now()))::date::text as desde, timezone($1, now())::date::text as hasta`,
    [ZONA_DE_LOS_CASOS],
  );
  const { desde, hasta } = r.rows[0]!;
  await admin.query('delete from negocio.metricas_de_anuncio where org_id = $1 and fecha = $2::date', [e.conDatos, desde === hasta ? hasta : desde]);
  const incompleto = await herramienta('economia_del_negocio', {}, 'admin');
  assert.deepEqual([incompleto.retorno, incompleto.costoPorVenta], [null, null]);
  if (desde !== hasta) {
    assert.equal(incompleto.gastoEntero, false);
    assert.match(String(incompleto.aviso), /no está entero/);
  }
});
