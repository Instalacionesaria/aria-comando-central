// ACQUISITION, CONVERSATION Y LOS DETECTORES DEL GASTO CON VARIOS CLIENTES: LO DE UNA CUENTA, POR CLIENTE. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C5, frente G3)
//
// Cada cliente tiene su cuenta de Meta y sus campañas. Lo que suponía una sola cuenta por empresa daba, con dos
// clientes, una cifra o una señal equivocada:
//
//   · la atribución por campaña juntaba dos campañas homónimas de dos clientes en una fila — mutación: agrupar sólo
//     por el nombre; y la fila dice de qué cliente es sólo cuando hay varios — mutaciones: ponerlo siempre, o nunca;
//   · un cliente que pauta sin su serie deja a la empresa sin costos y sin el total de la cuenta, y sólo dentro de la
//     ventana — mutaciones: la fórmula de antes, «alguna vez» en vez de la ventana, el total sin el freno;
//   · las vistas de Conversion no son la suma —ni el cero— de otro cliente — mutaciones: sin la guarda, sin el motivo;
//   · los DOS frenos: un cliente sin Meta frena los costos y las flechas pero no «sin entrega», la concentración ni el
//     costo por mil de los demás — mutaciones: el freno de los costos en el detector, comparar con el gasto incompleto;
//   · con UN solo cliente, el freno de Meta y su anterior son los de siempre (`faltan_dias` y `anterior`) — mutaciones:
//     el freno de Meta sin el motivo de siempre, la anterior de Meta sin la historia de contactos;
//   · «sin entrega» es de la cuenta del cliente, con la entidad `cliente` que la `094` deja guardar — mutaciones:
//     ignorar el cliente, la `094` sin `cliente`, `lectura.ts` sin nombrarlo;
//   · toda señal de campaña dice su cliente cuando las campañas son de varios, y con uno el nombre es el de siempre —
//     mutaciones: sólo con el cliente de la evidencia, el cliente siempre;
//   · el funnel de la campaña de otro cliente queda en ese cliente, y la base lo exige — mutaciones: insertar sin
//     cuenta, la `094` sin la foránea;
//   · la serie atrasada y «métricas sin serie» miran sólo a los clientes activos — mutación: mirar a todos;
//   · a un cliente en pausa se le pide la serie sólo hasta su último día cerrado — mutaciones: pedirle la ventana
//     entera, pedirle el día leído a medias, no sumar lo que tiene después.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { atribucionDelLead, type FilaDeAtribucion } from '../../lib/negocio/atribucionDelLead.ts';
import { lecturaDeAcquisition } from '../../lib/negocio/embudosDeAcquisition.ts';
import { lecturaDeConversion } from '../../lib/negocio/pasosDeConversion.ts';
import { estadoDeLaSerie } from '../../lib/negocio/gastoDeLaCuenta.ts';
import { asignarFunnel } from '../../lib/negocio/funnelDeLaCampana.ts';
import { ACQ, detectarEnAcquisition, medirAcquisition } from '../../lib/agentes/detectores/acquisition.ts';
import { reconciliarSenales } from '../../lib/agentes/senales/escritura.ts';
import { senalesDeLaPantalla } from '../../lib/agentes/senales/lectura.ts';
import { ENTIDADES_DE_SENAL, type Deteccion } from '../../lib/agentes/senales/tipos.ts';
import { CATALOGO_DE_REGLAS, umbralVigente } from '../../lib/agentes/senales/umbrales.ts';
import { textoDe } from '../../lib/agentes/plan/acquisition.ts';
import { ejecutarHerramienta, herramientasPara } from '../../lib/agentes/executive/herramientas.ts';
import { SIN_DATOS_DE_LA_RUTA } from '../../lib/agentes/executive/adaptadores/comun.ts';

const ZONA = 'America/Lima';
const PERIODO = { clave: '7d', dias: 7 } as const;

let admin: Client;
/** Delta: Y pauta sin Meta (sólo contactos de campaña). Epsilon: Y con su Meta. */
const delta = { slug: 'delta-284', nombre: 'Delta 284', org: '', p: '', y: '' };
const epsilon = { slug: 'epsilon-284', nombre: 'Epsilon 284', org: '', p: '', y: '' };
/** Zeta: un solo cliente, el principal. Lo que con uno tiene que ser lo de siempre. */
const zeta = { slug: 'zeta-284', nombre: 'Zeta 284', org: '', p: '', y: '' };

const umbral = (codigo: string) => umbralVigente(CATALOGO_DE_REGLAS.find((r) => r.codigo === codigo)!, new Map());
const foco = (e: typeof delta, cuenta: string) => ({ orgId: e.org, todaLaOrganizacion: true, cuentas: [cuenta] }) as const;

async function limpiar(slug: string): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [slug]);
  if (!o) return;
  for (const t of ['senales', 'planes_de_accion', 'funnels_de_campana', 'metricas_de_anuncio', 'anuncios', 'gasto_de_la_cuenta', 'campanas', 'citas', 'contactos']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

async function crear(e: typeof delta, conSegunda = true): Promise<void> {
  await limpiar(e.slug);
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ($1, $2, $3) returning id`,
    [e.nombre, e.slug, ZONA],
  );
  assert.ok(o);
  e.org = o.id;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [e.org]);
  assert.ok(principal);
  e.p = principal.id;
  if (!conSegunda) return;
  const segunda = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Segunda 284', 'segunda-284') returning id`,
    [e.org],
  );
  assert.ok(segunda);
  e.y = segunda.id;
}

/**
 * Un anuncio con sus métricas y su serie, que cuadra día por día, de hace 20 días a anteayer (el último cerrado).
 * `porDia(atras)` da gasto, impresiones y acciones de cada día; la serie es el gasto.
 */
async function pauta(
  org: string,
  cuenta: string,
  anuncio: string,
  campana: string,
  porDia: (atras: number) => { gasto: number; impresiones: number; acciones: Record<string, number> | null },
): Promise<void> {
  await admin.query(
    `insert into negocio.anuncios (org_id, cuenta_id, meta_anuncio_id, meta_campana_id, nombre) values ($1, $2, $3, $4, $3)`,
    [org, cuenta, anuncio, campana],
  );
  for (let atras = 20; atras >= 2; atras--) {
    const d = porDia(atras);
    await admin.query(
      `insert into negocio.metricas_de_anuncio (org_id, cuenta_id, meta_anuncio_id, fecha, gasto, impresiones, acciones)
       values ($1, $2, $3, current_date - $4::int, $5, $6, $7::jsonb)`,
      [org, cuenta, anuncio, atras, d.gasto, d.impresiones, d.acciones === null ? null : JSON.stringify(d.acciones)],
    );
    await admin.query(
      `insert into negocio.gasto_de_la_cuenta (org_id, cuenta_id, fecha, gasto, leido_el) values ($1, $2, current_date - $3::int, $4, now())`,
      [org, cuenta, atras, d.gasto],
    );
  }
}

/** `n` contactos de un cliente con su atribución, dados de alta hace `haceDias`; los primeros `conCita`, con cita alcanzable. */
async function contactos(
  org: string,
  cuenta: string,
  marca: string,
  n: number,
  atribucion: Record<string, string>,
  haceDias: number,
  conCita = 0,
): Promise<void> {
  for (let i = 0; i < n; i++) {
    const c = await unaFila<{ id: string }>(
      admin,
      `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera)
       values ($1, $2, $3, 'Contacto 284', 'setter', now() - make_interval(days => $4), $5::jsonb) returning id`,
      [org, cuenta, `${marca}-${i}`, haceDias, JSON.stringify(atribucion)],
    );
    assert.ok(c);
    if (i < conCita) {
      await admin.query(
        `insert into negocio.citas (org_id, cuenta_id, ghl_evento_id, contacto_id, inicio_el, estado_ghl, ghl_calendario_id)
         values ($1, $2, $3, $4, now(), 'confirmed', 'cal284')`,
        [org, cuenta, `${marca}-cita-${i}`, c.id],
      );
    }
  }
}

const CON_VISTAS = { landingPageView: 5, linkClick: 3 };

before(async () => {
  admin = await conectar('admin');

  // Delta: P con su Meta entera, y un contacto viejo de su campaña (la historia de contactos empieza antes de la
  // anterior: sin eso, nada de lo que compara se mediría). Y trae contactos de campaña sin Meta conectado.
  await crear(delta);
  await pauta(delta.org, delta.p, 'a284p', '2840001', () => ({ gasto: 100, impresiones: 1000, acciones: CON_VISTAS }));
  await contactos(delta.org, delta.p, 'd284p', 1, { campaignId: '2840001', campaign: 'Siempre' }, 40);
  await contactos(delta.org, delta.y, 'd284y', 5, { campaignId: '2840002', campaign: 'Lanzamiento' }, 3);

  // Epsilon: los dos con su Meta. Y entregó hasta hace 8 días y después nada: seis días cerrados sin entregar.
  await crear(epsilon);
  await pauta(epsilon.org, epsilon.p, 'a284ep', '2840101', () => ({ gasto: 100, impresiones: 1000, acciones: CON_VISTAS }));
  const sinEntregar: Record<string, number> = {};
  await pauta(epsilon.org, epsilon.y, 'a284ey', '2840102', (atras) =>
    atras >= 8 ? { gasto: 10, impresiones: 100, acciones: { landingPageView: 1 } } : { gasto: 0, impresiones: 0, acciones: sinEntregar },
  );
  for (const [cuenta, campana] of [
    [epsilon.p, '2840101'],
    [epsilon.y, '2840102'],
  ] as const) {
    await admin.query(
      `insert into negocio.campanas (org_id, cuenta_id, meta_campana_id, nombre, estado) values ($1, $2, $3, 'Lanzamiento', 'ACTIVE')`,
      [epsilon.org, cuenta, campana],
    );
  }

  // Zeta: un solo cliente con su Meta entera y su historia de contactos de campaña desde hace 40 días.
  await crear(zeta, false);
  await pauta(zeta.org, zeta.p, 'a284z', '2840201', () => ({ gasto: 100, impresiones: 1000, acciones: CON_VISTAS }));
  await contactos(zeta.org, zeta.p, 'z284p', 1, { campaignId: '2840201', campaign: 'Única' }, 40);
  await admin.query(
    `insert into negocio.campanas (org_id, cuenta_id, meta_campana_id, nombre, estado) values ($1, $2, '2840201', 'Única', 'ACTIVE')`,
    [zeta.org, zeta.p],
  );
});

after(async () => {
  try {
    await limpiar(delta.slug);
    await limpiar(epsilon.slug);
    await limpiar(zeta.slug);
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

/** Las filas de campaña, en un orden fijo: el conteo empata y la consulta no desempata. */
const porCliente = (filas: readonly FilaDeAtribucion[]) =>
  filas.map((f) => [f.cliente, f.cohorte, f.tasa]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));

test('dos campañas homónimas de dos clientes son dos filas, cada una con su cliente', async () => {
  await contactos(epsilon.org, epsilon.p, 'e284p', 10, { campaign: 'Lanzamiento', sessionSource: 'Paid Social' }, 3, 5);
  await contactos(epsilon.org, epsilon.y, 'e284y', 10, { campaign: 'LANZAMIENTO', sessionSource: 'Paid Social' }, 3, 2);

  const entera = await conOrganizacion(epsilon.org, () => atribucionDelLead());
  assert.deepEqual(
    porCliente(entera.porCampana),
    [
      ['Epsilon 284', 10, 50],
      ['Segunda 284', 10, 20],
    ],
    'las campañas homónimas de dos clientes se juntaron, o no dicen de quién son',
  );
  // La fuente es una categoría de la empresa: una sola fila, sin cliente.
  assert.deepEqual(entera.porFuente.map((f) => [f.etiqueta, f.cohorte, f.agendaron]), [['Paid Social', 20, 7]]);
  assert.ok(entera.porFuente.every((f) => !('cliente' in f)), 'la fuente trae un cliente');

  // Con el foco en un cliente, la fila de siempre: sin la clave.
  const deY = await conOrganizacion(foco(epsilon, epsilon.y), () => atribucionDelLead());
  assert.equal(deY.porCampana.length, 1);
  assert.ok(!('cliente' in deY.porCampana[0]!), 'con un solo cliente a la vista, la fila trae `cliente`');

  // El cerebro: las cinco claves de siempre, y `cliente` sólo con varios.
  const herramienta = async (ambito: Parameters<typeof conOrganizacion>[0], nombre: string) => {
    const contexto = { zona: ZONA, usuarioId: '00000000-0000-0000-0000-000000000000', secciones: ['acquisition', 'conversation'], deLaRuta: SIN_DATOS_DE_LA_RUTA };
    const r = await conOrganizacion(ambito, () => ejecutarHerramienta(nombre, { periodo: '30d' }, herramientasPara(['acquisition', 'conversation']), contexto));
    assert.equal(r.tipo, 'datos', `${nombre} no devolvió datos`);
    return (r as { datos: Record<string, unknown> }).datos;
  };
  const claves = (o: object) => Object.keys(o).sort();
  const filasDe = (d: Record<string, unknown>) => (d.porCampana as { filas: object[] }).filas;
  const conVarios = filasDe(await herramienta(epsilon.org, 'atribucion_del_lead'));
  assert.deepEqual(conVarios.map(claves), [0, 1].map(() => ['agendaron', 'cliente', 'cohorte', 'esElResto', 'etiqueta', 'tasa']));
  const conUno = filasDe(await herramienta(foco(epsilon, epsilon.y), 'atribucion_del_lead'));
  assert.deepEqual(conUno.map(claves), [['agendaron', 'cohorte', 'esElResto', 'etiqueta', 'tasa']]);
});

test('Acquisition: un cliente que pauta sin Meta deja a la empresa sin costos y sin el total de la cuenta, en su ventana', async () => {
  const entera = await conOrganizacion(delta.org, () => lecturaDeAcquisition(PERIODO, ZONA));
  assert.equal(entera.embudos.sinCostos, 'gasto_incompleto', 'el gasto de P pagó el costo por contacto de la gente de Y');
  assert.deepEqual(entera.embudos.gasto, { deLaCuenta: null, motivo: 'dias_sin_leer' }, 'la serie de P se dio por la cuenta de la empresa');
  // Y sin flechas: con el gasto de la empresa incompleto, no se compara contra la anterior.
  assert.deepEqual([entera.embudos.sinComparacion, entera.embudos.anterior], ['faltan_dias', null], 'con el gasto de la empresa incompleto, la pantalla comparó');
  // Lo que sólo lee Meta no se frena: Y no tiene anuncios que sumar.
  assert.equal(entera.faltanDiasDeMeta, false, 'un cliente sin Meta prendió el freno de los detectores de Meta');
  assert.notEqual(entera.anteriorDeMeta, null, 'un cliente sin Meta apagó la comparación de lo que sólo lee Meta');
  // Las filas de campaña dicen de qué cliente son: hay dos.
  assert.deepEqual(
    entera.embudos.campanas.map((c) => [c.campana, c.cliente]).sort(),
    [
      ['2840001', 'Delta 284'],
      ['2840002', 'Segunda 284'],
    ],
  );
  assert.deepEqual([...entera.clienteDe].sort(), [
    ['2840001', delta.p],
    ['2840002', delta.y],
  ]);

  // Con el foco en P, P está entero, y sus campañas, sin cliente.
  const deP = await conOrganizacion(foco(delta, delta.p), () => lecturaDeAcquisition(PERIODO, ZONA));
  assert.equal(deP.embudos.sinCostos, null);
  assert.deepEqual(deP.embudos.gasto, { deLaCuenta: 700, motivo: null });
  assert.ok(deP.embudos.campanas.every((c) => !('cliente' in c)), 'con un solo cliente a la vista, una campaña trae `cliente`');
  assert.equal(deP.clienteDe.size, 0);

  // Lo viejo de Y no está en la cohorte: no frena (por la ventana, no «alguna vez»).
  await admin.query(`update negocio.contactos set alta_en_el_crm = now() - interval '60 days' where org_id = $1 and cuenta_id = $2`, [delta.org, delta.y]);
  try {
    const sinY = await conOrganizacion(delta.org, () => lecturaDeAcquisition(PERIODO, ZONA));
    assert.equal(sinY.embudos.sinCostos, null, 'los contactos viejos de un cliente sin Meta frenaron los costos de hoy');
    assert.deepEqual(sinY.embudos.gasto, { deLaCuenta: 700, motivo: null });
    assert.equal(sinY.embudos.sinComparacion, null, 'los contactos viejos de un cliente sin Meta apagaron las flechas de hoy');
    assert.notEqual(sinY.embudos.anterior, null);
  } finally {
    await admin.query(`update negocio.contactos set alta_en_el_crm = now() - interval '3 days' where org_id = $1 and cuenta_id = $2`, [delta.org, delta.y]);
  }

  // El cerebro: la misma fila de la pantalla, con `cliente` sólo con varios.
  const contexto = { zona: ZONA, usuarioId: '00000000-0000-0000-0000-000000000000', secciones: ['acquisition'], deLaRuta: SIN_DATOS_DE_LA_RUTA };
  const filas = async (ambito: Parameters<typeof conOrganizacion>[0]) => {
    const r = await conOrganizacion(ambito, () => ejecutarHerramienta('embudos_de_acquisition', { periodo: '7d' }, herramientasPara(['acquisition']), contexto));
    return ((r as { datos: { campanas: { filas: { campana: string; cliente?: string }[] } } }).datos.campanas.filas).map((f) => [f.campana, f.cliente]).sort();
  };
  assert.deepEqual(await filas(delta.org), [
    ['2840001', 'Delta 284'],
    ['2840002', 'Segunda 284'],
  ]);
  assert.deepEqual(await filas(foco(delta, delta.p)), [['2840001', undefined]]);
});

test('Conversion: las vistas no son la suma ni el cero de otro cliente', async () => {
  const entera = (await conOrganizacion(delta.org, () => lecturaDeConversion(PERIODO, ZONA))).pasos.cifras.vistas;
  assert.deepEqual([entera.valor, entera.motivo], [null, 'dias_sin_leer'], 'las vistas de P se publicaron como las de la empresa');
  const deP = (await conOrganizacion(foco(delta, delta.p), () => lecturaDeConversion(PERIODO, ZONA))).pasos.cifras.vistas;
  assert.deepEqual([deP.valor, deP.motivo], [35, null]);

  // Y con contactos de campaña sólo en la anterior: las vistas de hoy se publican, y no comparan diciendo por qué.
  await admin.query(`update negocio.contactos set alta_en_el_crm = now() - interval '10 days' where org_id = $1 and cuenta_id = $2`, [delta.org, delta.y]);
  try {
    const v = (await conOrganizacion(delta.org, () => lecturaDeConversion(PERIODO, ZONA))).pasos.cifras.vistas;
    assert.deepEqual([v.valor, v.motivo, v.variacion.tipo], [35, 'dias_sin_leer', 'sin_comparacion'], 'la anterior con un cliente sin Meta comparó, o se calló el porqué');
  } finally {
    await admin.query(`update negocio.contactos set alta_en_el_crm = now() - interval '3 days' where org_id = $1 and cuenta_id = $2`, [delta.org, delta.y]);
  }
});

test('los dos frenos: un cliente sin Meta no apaga «sin entrega», la concentración ni el costo por mil de otro', async () => {
  // P deja de entregar hace seis días cerrados (la serie sigue cuadrando, en cero).
  await admin.query(
    `update negocio.metricas_de_anuncio set gasto = 0, impresiones = 0 where org_id = $1 and fecha >= current_date - 7`,
    [delta.org],
  );
  await admin.query(`update negocio.gasto_de_la_cuenta set gasto = 0 where org_id = $1 and fecha >= current_date - 7`, [delta.org]);
  try {
    const r = await conOrganizacion(delta.org, async () => {
      const m = await medirAcquisition('7d', ZONA);
      return { m, d: detectarEnAcquisition(m, umbral) };
    });
    assert.equal(r.m.embudos.sinCostos, 'gasto_incompleto', 'el freno de los costos tiene que seguir puesto');
    assert.deepEqual(
      r.d.detecciones.filter((x) => x.regla === ACQ.sinEntrega).map((x) => [x.entidad.tipo, x.entidad.id, x.gravedad, x.valorActual]),
      [['cliente', delta.p, 'critica', 6]],
      'la sin entrega de P no salió',
    );
    for (const regla of [ACQ.sinEntrega, ACQ.concentracion, ACQ.cpmAbrupto]) {
      assert.ok(!r.d.sinMedicion.includes(regla), `${regla} quedó sin medición por un cliente sin Meta`);
    }
    // Lo que divide el gasto por la gente sí se frena.
    for (const regla of [ACQ.cplSostenido, ACQ.escalaPorCalificado]) assert.ok(r.d.sinMedicion.includes(regla), `${regla} se midió sin el gasto de Y`);
  } finally {
    await admin.query(
      `update negocio.metricas_de_anuncio set gasto = 100, impresiones = 1000 where org_id = $1 and fecha >= current_date - 7`,
      [delta.org],
    );
    await admin.query(`update negocio.gasto_de_la_cuenta set gasto = 100 where org_id = $1 and fecha >= current_date - 7`, [delta.org]);
  }
});

test('el detector: la crítica es del cliente que no entrega, no de la empresa, y se guarda y se nombra', async () => {
  const { m, d } = await conOrganizacion(epsilon.org, async () => {
    const m = await medirAcquisition('7d', ZONA);
    return { m, d: detectarEnAcquisition(m, umbral) };
  });
  assert.notEqual(m.embudos.sinComparacion, 'faltan_dias');
  assert.equal(m.clienteDe.get('2840102'), epsilon.y);
  assert.equal(m.clienteDe.get('2840101'), epsilon.p);
  assert.deepEqual(
    d.detecciones.filter((x) => x.regla === ACQ.sinEntrega).map((x) => [x.entidad.tipo, x.entidad.id, x.gravedad, x.valorActual]),
    [['cliente', epsilon.y, 'critica', 6]],
    'la cuenta de Y entera no entrega: es una crítica de Y, no una alta de su campaña ni una de la empresa',
  );

  // Se guarda (la `094` deja la entidad nueva) y la pantalla la nombra con el nombre del cliente. Una campaña medida
  // dentro de su cliente (la evidencia lo nombra, como la concentración) se muestra «Campaña (Cliente)»; y también
  // cualquier otra señal de campaña, sin cliente en la evidencia: las dos se llaman «Lanzamiento».
  const sinEntregaDeY = d.detecciones.find((x) => x.regla === ACQ.sinEntrega)!;
  const dentroDeY = { ...sinEntregaDeY, regla: ACQ.concentracion, entidad: { tipo: 'campana' as const, id: '2840102' }, evidencia: { cliente: epsilon.y } };
  const deP = { ...sinEntregaDeY, regla: ACQ.cplSostenido, entidad: { tipo: 'campana' as const, id: '2840101' }, evidencia: {} };
  await conOrganizacion(epsilon.org, () =>
    reconciliarSenales({ departamento: 'acquisition', detector: 'acquisition', ventana: '7d', detecciones: [...d.detecciones, dentroDeY, deP], sinMedicion: d.sinMedicion }),
  );
  const senales = await conOrganizacion(epsilon.org, () => senalesDeLaPantalla('acquisition', '7d', textoDe));
  const sinEntrega = senales.filter((s) => s.regla === ACQ.sinEntrega);
  assert.deepEqual(sinEntrega.map((s) => [s.entidad.tipo, s.nombre]), [['cliente', 'Segunda 284']]);
  assert.match(sinEntrega[0]!.texto, /^Ninguna de las 1 campañas activas de este cliente/);
  assert.deepEqual(
    senales.filter((s) => s.regla === ACQ.concentracion).map((s) => s.nombre),
    ['Lanzamiento (Segunda 284)'],
    'una campaña medida dentro de su cliente no dice de cuál',
  );
  assert.deepEqual(
    senales.filter((s) => s.regla === ACQ.cplSostenido).map((s) => s.nombre),
    ['Lanzamiento (Epsilon 284)'],
    'con campañas de dos clientes, una señal de campaña sin cliente en la evidencia no dice de cuál es',
  );
});

test('el funnel de la campaña de otro cliente queda en ese cliente, y la base lo exige', async () => {
  // Antes de que exista la fila: con la clave primaria ocupada, el choque sería otro.
  await assert.rejects(
    admin.query(`insert into negocio.funnels_de_campana (org_id, cuenta_id, meta_campana_id, funnel) values ($1, $2, '2840102', 'leadform')`, [
      epsilon.org,
      epsilon.p,
    ]),
    { code: '23503', constraint: 'funnels_de_campana_misma_cuenta_que_la_campana' },
    'un funnel de la campaña de Y se guardó en P',
  );
  assert.equal(await conOrganizacion(epsilon.org, () => asignarFunnel({ campana: '2840102', funnel: 'booking' }, null)), null);
  const f = await unaFila<{ cuenta_id: string }>(admin, `select cuenta_id from negocio.funnels_de_campana where org_id = $1 and meta_campana_id = '2840102'`, [
    epsilon.org,
  ]);
  assert.equal(f?.cuenta_id, epsilon.y, 'el funnel de la campaña de Y quedó en el principal');
  // Con el foco en P, la campaña de Y no existe.
  assert.equal(await conOrganizacion(foco(epsilon, epsilon.p), () => asignarFunnel({ campana: '2840102', funnel: 'booking' }, null)), 'sin_campana');
});

test('el juego cerrado de entidades es el mismo en la base y en el código', async () => {
  const c = await unaFila<{ def: string }>(
    admin,
    `select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'senales_entidad_tipo_check' and conrelid = 'negocio.senales'::regclass`,
  );
  assert.ok(c);
  const enLaBase = [...c.def.matchAll(/'([a-z_]+)'::text/g)].map((x) => x[1]).sort();
  assert.deepEqual(enLaBase, [...ENTIDADES_DE_SENAL].sort());
});

test('la serie atrasada y «métricas sin serie» miran sólo a los clientes activos', async () => {
  const estado = () => conOrganizacion(epsilon.org, () => estadoDeLaSerie(ZONA));
  const dia = async (atras: number) => (await unaFila<{ d: string }>(admin, `select to_char(current_date - $1::int, 'YYYY-MM-DD') as d`, [atras]))!.d;
  const pausar = (estadoDeY: 'activa' | 'pausada') =>
    admin.query(`update identidad.cuentas set estado = $2 where id = $1`, [epsilon.y, estadoDeY]);
  // La serie de Y deja de leerse en toda la ventana de 7 días: su último cerrado tiene más de tres.
  await admin.query(`delete from negocio.gasto_de_la_cuenta where org_id = $1 and cuenta_id = $2 and fecha >= current_date - 8`, [epsilon.org, epsilon.y]);
  try {
    const activo = await estado();
    assert.deepEqual([activo.atrasado, activo.ultimoCerrado], [true, await dia(9)], 'un cliente activo sin leer no atrasó a la empresa');
    await pausar('pausada');
    const enPausa = await estado();
    assert.deepEqual([enPausa.atrasado, enPausa.ultimoCerrado], [false, await dia(2)], 'un cliente en pausa dejó atrasada a la empresa');

    // En pausa, con métricas en la ventana y sin serie en ella: lo que sólo lee Meta se frena igual, y las vistas no comparan.
    const a = await conOrganizacion(epsilon.org, () => lecturaDeAcquisition(PERIODO, ZONA));
    assert.deepEqual([a.faltanDiasDeMeta, a.embudos.sinCostos], [true, 'gasto_incompleto'], 'un cliente con métricas sin serie no frenó lo de Meta');
    const v = (await conOrganizacion(epsilon.org, () => lecturaDeConversion(PERIODO, ZONA))).pasos.cifras.vistas;
    assert.deepEqual([v.valor, v.motivo, v.variacion.tipo], [36, 'dias_sin_leer', 'sin_comparacion'], 'las vistas compararon con un cliente sin su serie');

    // Sin ninguna serie: activo, «métricas sin serie» atrasa; en pausa, no.
    await admin.query(`delete from negocio.gasto_de_la_cuenta where org_id = $1 and cuenta_id = $2`, [epsilon.org, epsilon.y]);
    assert.equal((await estado()).atrasado, false, 'las métricas de un cliente en pausa sin serie atrasaron a la empresa');
    await pausar('activa');
    assert.equal((await estado()).atrasado, true, 'las métricas de un cliente activo sin serie no atrasaron a la empresa');
  } finally {
    await pausar('activa');
    await admin.query(
      `insert into negocio.gasto_de_la_cuenta (org_id, cuenta_id, fecha, gasto, leido_el)
       select $1, $2, current_date - x, case when x >= 8 then 10 else 0 end, now() from generate_series(2, 20) x
       on conflict (org_id, cuenta_id, fecha) do nothing`,
      [epsilon.org, epsilon.y],
    );
  }
});

test('con un solo cliente, el freno de lo que sólo lee Meta y su anterior son los de siempre', async () => {
  const medir = () =>
    conOrganizacion(zeta.org, async () => {
      const m = await medirAcquisition('7d', ZONA);
      return { m, d: detectarEnAcquisition(m, umbral) };
    });
  const DE_META = [ACQ.sinEntrega, ACQ.concentracion, ACQ.cpmAbrupto];
  // Con uno, los dos frenos son uno: el de Meta es `faltan_dias`, y su anterior es la de la pantalla.
  const comoSiempre = (m: Awaited<ReturnType<typeof medir>>['m'], cuando: string) => {
    assert.equal(m.faltanDiasDeMeta, m.embudos.sinComparacion === 'faltan_dias', `${cuando}: el freno de Meta no es el de siempre`);
    assert.deepEqual(m.anteriorDeMeta, m.embudos.anterior, `${cuando}: la anterior de Meta no es la de la pantalla`);
  };

  const entera = await medir();
  comoSiempre(entera.m, 'entera');
  assert.notEqual(entera.m.anteriorDeMeta, null);
  for (const regla of DE_META) assert.ok(!entera.d.sinMedicion.includes(regla), `${regla} quedó sin medición con la ventana entera`);

  // A un día de la ventana le falta la serie: «sin entrega» contaría días sin recolectar (AG-35).
  await admin.query(`delete from negocio.gasto_de_la_cuenta where org_id = $1 and fecha = current_date - 4`, [zeta.org]);
  try {
    const sinUnDia = await medir();
    comoSiempre(sinUnDia.m, 'sin un día');
    assert.deepEqual([sinUnDia.m.faltanDiasDeMeta, sinUnDia.m.anteriorDeMeta], [true, null], 'un día sin leer no frenó lo que sólo lee Meta');
    for (const regla of DE_META) assert.ok(sinUnDia.d.sinMedicion.includes(regla), `${regla} se midió con un día sin leer`);
  } finally {
    await admin.query(
      `insert into negocio.gasto_de_la_cuenta (org_id, cuenta_id, fecha, gasto, leido_el) values ($1, $2, current_date - 4, 100, now())`,
      [zeta.org, zeta.p],
    );
  }

  // La historia de contactos de campaña empieza dentro de la anterior: no se compara, tampoco el costo por mil.
  await admin.query(`update negocio.contactos set alta_en_el_crm = now() - interval '3 days' where org_id = $1`, [zeta.org]);
  try {
    const corta = await medir();
    comoSiempre(corta.m, 'con la historia corta');
    assert.deepEqual([corta.m.embudos.sinComparacion, corta.m.anteriorDeMeta], ['sin_historia', null]);
    assert.ok(corta.d.sinMedicion.includes(ACQ.cpmAbrupto), 'el costo por mil comparó contra una anterior sin historia de contactos');
  } finally {
    await admin.query(`update negocio.contactos set alta_en_el_crm = now() - interval '40 days' where org_id = $1`, [zeta.org]);
  }

  // Y una señal de campaña se llama como siempre: sin cliente.
  const senal: Deteccion = {
    regla: ACQ.cplSostenido,
    entidad: { tipo: 'campana', id: '2840201' },
    metrica: 'costo_por_contacto',
    lineaBase: 10,
    valorActual: 20,
    cambioPct: 1,
    muestra: null,
    periodo: { desde: entera.m.embudos.ventana.desde, hasta: entera.m.embudos.ventana.hasta },
    datosDesde: null,
    gravedad: 'alta',
    causasPosibles: [],
    revisionRecomendada: 'Revisar la campaña.',
    perdidaContactos: null,
    destino: null,
    requiereValidacionEjecutiva: false,
    umbral: { valor: 0.3, provisional: true },
    evidencia: {},
  };
  await conOrganizacion(zeta.org, () =>
    reconciliarSenales({ departamento: 'acquisition', detector: 'acquisition', ventana: '7d', detecciones: [senal], sinMedicion: [] }),
  );
  const senales = await conOrganizacion(zeta.org, () => senalesDeLaPantalla('acquisition', '7d', textoDe));
  assert.deepEqual(senales.map((s) => [s.regla, s.nombre]), [[ACQ.cplSostenido, 'Única']], 'con un solo cliente, la campaña dice un cliente');
});

test('un cliente en pausa: su serie se pide hasta su último día cerrado, y no deja a la empresa sin el gasto entero', async () => {
  const leer = () => conOrganizacion(epsilon.org, () => lecturaDeAcquisition(PERIODO, ZONA));
  const pausar = (estadoDeY: 'activa' | 'pausada') =>
    admin.query(`update identidad.cuentas set estado = $2 where id = $1`, [epsilon.y, estadoDeY]);
  // Y deja de leerse hace cuatro días: ese día quedó leído a medias (5 de gasto, sin cerrar) y nada después.
  await admin.query(`delete from negocio.gasto_de_la_cuenta where org_id = $1 and cuenta_id = $2 and fecha >= current_date - 3`, [epsilon.org, epsilon.y]);
  await admin.query(`delete from negocio.metricas_de_anuncio where org_id = $1 and cuenta_id = $2 and fecha >= current_date - 3`, [epsilon.org, epsilon.y]);
  await admin.query(
    `update negocio.gasto_de_la_cuenta set gasto = 5, leido_el = ((current_date - 4)::timestamp + interval '12 hours') at time zone $3
      where org_id = $1 and cuenta_id = $2 and fecha = current_date - 4`,
    [epsilon.org, epsilon.y, ZONA],
  );
  await admin.query(
    `update negocio.metricas_de_anuncio set gasto = 5, impresiones = 50 where org_id = $1 and cuenta_id = $2 and fecha = current_date - 4`,
    [epsilon.org, epsilon.y],
  );
  try {
    // Activo, su serie cortada atrasa a la empresa: así se ve un cliente que dejó de leerse sin que nadie lo pausara.
    assert.equal((await leer()).embudos.sinCostos, 'gasto_incompleto', 'la serie cortada de un cliente activo no frenó');
    await pausar('pausada');
    const enPausa = await leer();
    // Se le piden sus días hasta el último cerrado (los cuatro primeros de la ventana); el de la pausa, a medias, se
    // suma (10 + 5 de Y, con los 700 de P) y no se le exige.
    assert.deepEqual(
      [enPausa.embudos.sinCostos, enPausa.embudos.gasto, enPausa.faltanDiasDeMeta, enPausa.embudos.ventana.hasta],
      [null, { deLaCuenta: 715, motivo: null }, false, (await unaFila<{ d: string }>(admin, `select to_char(current_date - 2, 'YYYY-MM-DD') as d`))!.d],
      'la serie cortada de un cliente en pausa dejó a la empresa sin el gasto entero',
    );
  } finally {
    await pausar('activa');
    await admin.query(
      `update negocio.gasto_de_la_cuenta set gasto = 0, leido_el = now() where org_id = $1 and cuenta_id = $2 and fecha = current_date - 4`,
      [epsilon.org, epsilon.y],
    );
    await admin.query(
      `update negocio.metricas_de_anuncio set gasto = 0, impresiones = 0 where org_id = $1 and cuenta_id = $2 and fecha = current_date - 4`,
      [epsilon.org, epsilon.y],
    );
    await admin.query(
      `insert into negocio.gasto_de_la_cuenta (org_id, cuenta_id, fecha, gasto, leido_el)
       select $1, $2, current_date - x, 0, now() from generate_series(2, 3) x
       on conflict (org_id, cuenta_id, fecha) do nothing`,
      [epsilon.org, epsilon.y],
    );
    await admin.query(
      `insert into negocio.metricas_de_anuncio (org_id, cuenta_id, meta_anuncio_id, fecha, gasto, impresiones, acciones)
       select $1, $2, 'a284ey', current_date - x, 0, 0, '{}'::jsonb from generate_series(2, 3) x
       on conflict do nothing`,
      [epsilon.org, epsilon.y],
    );
  }
});
