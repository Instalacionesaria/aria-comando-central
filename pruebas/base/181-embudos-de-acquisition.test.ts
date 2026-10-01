// Lo que los tres funnels de Acquisition LEEN de la base, en una empresa propia. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ UNA EMPRESA PROPIA
//
// `embudosDeAcquisition` suma TODO lo de la empresa: los totales, la cobertura y el universo de
// campañas. Las demás pruebas siembran contactos y anuncios en `alfa` y `beta`, así que ahí cualquier
// total dependería de lo que otra prueba dejó. Esta prueba crea su propia empresa, siembra todo adentro
// y la borra al final: cada número de abajo es exacto. Y antes de crearla borra las que hayan quedado de
// una corrida cortada a mitad, que si no dejarían `11-sembrado` en rojo.
//
// ── LO QUE SE AFIRMA, Y LA MUTACIÓN QUE CADA COSA TIENE QUE PONER EN ROJO ──
//
//   · 7 y 30 días son días CERRADOS, hasta ayer, y la anterior no se pisa con la actual — mutaciones:
//     terminar la ventana hoy, y correr la anterior un día;
//   · la ventana incluye sus dos bordes y nada más — mutación: correr un borde un día;
//   · los clics son nulos sin desglose y cero con desglose sin `linkClick`, y el costo por clic usa sólo
//     el gasto con desglose — mutaciones: `?? 0`, y dividir la inversión entera;
//   · calificado es agendado y no descartado, y el descarte no mira la caja — mutación: sin el `not`;
//   · una cita sin calendario no es «agendó» (`alcanzable`) — mutación: contar cualquier cita;
//   · la ventana anterior cuenta los agendados A LA MISMA EDAD — mutación: sin el corte de `reservada_el`;
//   · los cortes del ICP son los de `tramoDelPuntaje` — mutación: `>` por `>=` en un corte;
//   · se compara sólo si los datos describen las dos ventanas enteras, y los clics sólo si el desglose
//     cubre la anterior — mutaciones: dar cada cobertura por hecha;
//   · «Hoy» no compara ni publica costos — mutación: costos en «Hoy»;
//   · el universo incluye la campaña asignada sin actividad y la que GoHighLevel no listó;
//   · otra empresa no se cuela — la RLS; y la ruta respeta el período y dice si la sesión puede asignar.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { leerRespuesta, montar, pedirComo, sesionDe, type Escenario } from '../apoyo/closer.ts';
import { cifrasPorCampana, embudosDeAcquisition } from '../../lib/negocio/embudosDeAcquisition.ts';
import { PERIODOS, type ClaveDePeriodo } from '../../lib/negocio/periodo.ts';
import { tramoDelPuntaje } from '../../lib/negocio/tramosDelIcp.ts';
import { GET as leerAcquisition } from '../../app/api/acquisition/route.ts';

let esc: Escenario;
/** La empresa de esta prueba, creada en el `before` y borrada en el `after`. */
let propia: string;
const PREFIJO_DEL_SLUG = 'embudos-181-';

const C1 = '181000001'; // conocida, en Lead form ads, con actividad
const C2 = '181000002'; // conocida, sin funnel
const C3 = '181000003'; // desconocida: tiene contactos, pero GoHighLevel no la listó
const C4 = '181000004'; // conocida, en Booking directo, sin ninguna actividad
const A0 = '181000010'; // el de relleno: una fila por día, sin entrega, como escribe el colector
const A1 = '181000011';
const A2 = '181000012';
const A_AJENO = '181000019';
const CORREO_COMUN = 'comun@embudos-181.ejemplo';

/** Las fechas, como las calcula la base: `current_date` es el de la base, no el de Node. */
let hoy: (menos: number) => string;

/** Borra una empresa de esta prueba y todo lo suyo. */
async function borrarEmpresa(org: string): Promise<void> {
  for (const tabla of ['funnels_de_campana', 'campanas', 'citas', 'contactos', 'metricas_de_anuncio', 'anuncios']) {
    await esc.admin.query(`delete from negocio.${tabla} where org_id = $1`, [org]);
  }
  await esc.admin.query('delete from identidad.organizaciones where id = $1', [org]);
}

async function borrarLoDeAlfa(): Promise<void> {
  await esc.admin.query('delete from negocio.metricas_de_anuncio where meta_anuncio_id = $1', [A_AJENO]);
  await esc.admin.query('delete from negocio.anuncios where meta_anuncio_id = $1', [A_AJENO]);
  await esc.admin.query(`delete from negocio.contactos where atribucion_primera->>'campaignId' = $1`, [C1]);
  await esc.admin.query('delete from identidad.usuarios where email = $1', [CORREO_COMUN]);
}

/** Un contacto de la empresa propia. `alta`, `reservada` e `inicio` son SQL relativo a `now()`/`current_date`. */
async function unContacto(campos: {
  campana?: string | null;
  alta: string;
  score?: number | null;
  etiquetas?: string[];
  cita?: { calendario?: boolean; reservada?: string | null; inicio?: string };
}): Promise<void> {
  // «Sin atribución» es el objeto vacío: la columna no admite nulo.
  const atribucion = JSON.stringify(campos.campana === null ? {} : { campaignId: campos.campana ?? C1 });
  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera, score, etiquetas)
     values ($1, $2, 'Contacto 181', 'setter', ${campos.alta}, $3::jsonb, $4, $5) returning id`,
    [propia, `c181-${randomUUID()}`, atribucion, campos.score ?? null, campos.etiquetas ?? []],
  );
  if (!campos.cita) return;
  const inicio = campos.cita.inicio ?? `now() + interval '1 day'`;
  const reservada = campos.cita.reservada === undefined ? `now() - interval '1 hour'` : (campos.cita.reservada ?? 'null');
  await esc.admin.query(
    `insert into negocio.citas (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl, reservada_el)
     values ($1, $2, $3, $4, ${inicio}, ${inicio} + interval '30 minutes', 'confirmed', ${reservada})`,
    [propia, r.rows[0]!.id, `ev181-${randomUUID()}`, campos.cita.calendario === false ? null : 'cal-181'],
  );
}

/** Un día de métricas. Con `gasto` nulo, sin entrega: el proveedor omite las siete métricas enteras. */
async function unDia(anuncio: string, hace: number, gasto: number | null, acciones: Record<string, number> | null): Promise<void> {
  const entrego = gasto !== null;
  await esc.admin.query(
    `insert into negocio.metricas_de_anuncio (org_id, meta_anuncio_id, fecha, gasto, impresiones, clics, acciones)
     values ($1, $2, current_date - $3::int, $4, $5, $6, $7::jsonb)`,
    [propia, anuncio, hace, gasto, entrego ? 100 : null, entrego ? 5 : null, acciones === null ? null : JSON.stringify(acciones)],
  );
}

/** Los puntajes de los calificados de C1 en la ventana de siete días. */
const PUNTAJES_CALIFICADOS = [80, 90, 75, 100, 60, 50, 74, 30, 1, 49, 0, null];

before(async () => {
  esc = await montar('Embudos181');
  await borrarLoDeAlfa();
  const viejas = await esc.admin.query<{ id: string }>('select id from identidad.organizaciones where slug like $1', [
    `${PREFIJO_DEL_SLUG}%`,
  ]);
  for (const v of viejas.rows) await borrarEmpresa(v.id);

  const o = await esc.admin.query<{ id: string }>(
    `insert into identidad.organizaciones (nombre, slug) values ('Embudos 181', $1) returning id`,
    [`${PREFIJO_DEL_SLUG}${randomUUID().slice(0, 8)}`],
  );
  propia = o.rows[0]!.id;

  const fechas = await esc.admin.query<{ n: number; d: string }>(
    `select n, to_char(current_date - n, 'YYYY-MM-DD') as d from generate_series(0, 70) as n`,
  );
  const mapa = new Map(fechas.rows.map((f) => [Number(f.n), f.d]));
  hoy = (menos) => mapa.get(menos)!;

  // Las campañas que GoHighLevel listó (C3 no), y los funnels asignados a mano.
  await esc.admin.query(
    `insert into negocio.campanas (org_id, meta_campana_id, nombre, estado) values
       ($1, $2, 'bofu - lead ads', 'ACTIVE'), ($1, $3, 'tofu - reels', 'PAUSED'), ($1, $4, 'booking sin pauta', 'ACTIVE')`,
    [propia, C1, C2, C4],
  );
  await esc.admin.query(
    `insert into negocio.funnels_de_campana (org_id, meta_campana_id, funnel) values ($1, $2, 'leadform'), ($1, $3, 'booking')`,
    [propia, C1, C4],
  );
  await esc.admin.query(
    `insert into negocio.anuncios (org_id, meta_anuncio_id, meta_campana_id, nombre) values
       ($1, $2, $3, 'relleno'), ($1, $4, $5, 'a1'), ($1, $6, $3, 'a2')`,
    [propia, A0, C2, A1, C1, A2],
  );

  // El relleno: una fila por día de hoy a hace treinta, sin entrega. Cubre las ventanas de 7 días y la
  // actual de 30, y deja a la anterior de 30 sin datos.
  for (let hace = 0; hace <= 30; hace += 1) await unDia(A0, hace, null, null);
  // C1. Ventana de 7 días (hace 7 a hace 1): 7 + 2 + 5 = 14 de gasto, 9 de ellos con desglose y 3 clics.
  await unDia(A1, 0, 10, { linkClick: 4, videoView: 9 }); // hoy: sólo en «Hoy»
  await unDia(A1, 3, 5, null);
  await unDia(A1, 6, 2, { linkClick: 1 });
  await unDia(A1, 7, 7, { linkClick: 2 });
  // La anterior de 7 días (hace 14 a hace 8): 4 de gasto, 1 clic.
  await unDia(A1, 8, 4, { linkClick: 1 });
  // El primer desglose, antes de la anterior: los clics se pueden comparar.
  await unDia(A1, 15, 1, { linkClick: 1 });
  await unDia(A1, 20, 1, null);
  // C2: hace dos, con gasto y sin desglose; hace uno, con desglose SIN `linkClick`.
  await unDia(A2, 2, 3, null);
  await unDia(A2, 1, 0, { videoView: 3 });

  const mediodia = (hace: number) => `(current_date - ${hace})::timestamptz + interval '12 hours'`;
  // Doce calificados de C1: diez con puntaje, uno en cero y uno sin puntaje.
  for (const score of PUNTAJES_CALIFICADOS) {
    await unContacto({ alta: mediodia(score === null || score === 0 ? 2 : 1), score, cita: {} });
  }
  // Agendó pero está descartado, con la etiqueta en otra caja: no es calificado, y su 90 no cuenta.
  await unContacto({ alta: mediodia(3), score: 90, etiquetas: ['ICP_Rechazado'], cita: {} });
  await unContacto({ alta: mediodia(3), score: 70, cita: { calendario: false } }); // sin calendario no es «agendó»
  await unContacto({ alta: mediodia(4), score: 95 }); // sólo contacto
  await unContacto({ alta: '(current_date - 7)::timestamptz' }); // el primer instante de la ventana: entra
  await unContacto({ alta: `(current_date - 7)::timestamptz - interval '1 second'` }); // el último de la anterior
  // La anterior de 7 días, con citas reservadas antes y después de la edad de corte (hace siete días).
  await unContacto({ alta: mediodia(10), cita: { reservada: `now() - interval '9 days'` } }); // cuenta
  await unContacto({ alta: mediodia(10), cita: { reservada: `now() - interval '5 days'` } }); // tarde: no
  await unContacto({ alta: mediodia(11), cita: { reservada: null, inicio: `now() - interval '8 days'` } }); // cuenta
  await unContacto({ alta: mediodia(11), cita: { reservada: null, inicio: `now() - interval '3 days'` } }); // no
  await unContacto({ alta: mediodia(12), cita: { calendario: false, reservada: `now() - interval '10 days'` } }); // sin calendario: no
  await unContacto({ alta: mediodia(25) }); // el más viejo: la historia de contactos cubre la anterior de 7
  await unContacto({ campana: '{{campaign.id}}', alta: mediodia(1) }); // la plantilla sin expandir
  await unContacto({ campana: null, alta: mediodia(1) }); // sin atribución
  await unContacto({ campana: C3, alta: mediodia(1) }); // la campaña que GoHighLevel no listó
  await unContacto({ alta: 'current_date::timestamptz' }); // de hoy: sólo en «Hoy»

  // Y en ALFA, con el MISMO identificador de campaña y dentro de la ventana: no se puede colar.
  await esc.admin.query(
    `insert into negocio.anuncios (org_id, meta_anuncio_id, meta_campana_id, nombre) values ($1, $2, $3, 'ajeno')`,
    [esc.org, A_AJENO, C1],
  );
  await esc.admin.query(
    `insert into negocio.metricas_de_anuncio (org_id, meta_anuncio_id, fecha, gasto, acciones)
     values ($1, $2, current_date - 2, 1000, '{"linkClick": 500}'::jsonb)`,
    [esc.org, A_AJENO],
  );
  await esc.admin.query(
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera)
     values ($1, $2, 'Ajeno 181', 'setter', now() - interval '2 days', $3::jsonb)`,
    [esc.org, `c181-ajeno-${randomUUID()}`, JSON.stringify({ campaignId: C1 })],
  );
});

after(async () => {
  if (propia) await borrarEmpresa(propia);
  await borrarLoDeAlfa();
  await cerrarTodo();
  await cerrarClientes();
});

const enLaPropia = <T>(f: () => Promise<T>) => conOrganizacion(propia, f);
/** La zona con la que se lee cada empresa en esta prueba. Por omisión, la de la columna: `UTC`. */
const zonas = new Map<string, string>();
const zonaDe = (org: string) => zonas.get(org) ?? 'UTC';
const periodo = (clave: ClaveDePeriodo) => PERIODOS.find((p) => p.clave === clave)!;

/** Saca las filas de gasto de un día, corre `f`, y las devuelve. Para sembrar un hueco. */
async function sinElDia<T>(hace: number, f: () => Promise<T>): Promise<T> {
  const guardadas = await esc.admin.query(
    `delete from negocio.metricas_de_anuncio where org_id = $1 and fecha = current_date - $2::int returning *`,
    [propia, hace],
  );
  try {
    return await f();
  } finally {
    for (const g of guardadas.rows as Record<string, unknown>[]) {
      const columnas = Object.keys(g);
      await esc.admin.query(
        `insert into negocio.metricas_de_anuncio (${columnas.join(', ')}) values (${columnas.map((_, i) => `$${i + 1}`).join(', ')})`,
        columnas.map((c) => (c === 'acciones' && g[c] !== null ? JSON.stringify(g[c]) : g[c])),
      );
    }
  }
}

// ─── 1 · La lectura de una ventana ──────────────────────────────────────────

test('la ventana incluye sus dos bordes y ni un día más', async () => {
  const c1 = (await enLaPropia(() => cifrasPorCampana(hoy(7), hoy(1)))).get(C1);
  // 7 + 2 + 5: entra el primer día (hace siete), no el anterior (hace ocho, 4) ni hoy (10).
  assert.equal(c1?.inversion, 14, 'la ventana de gasto se corrió un día');
  // 15 del mediodía en la ventana, más el primer instante de su primer día; no el segundo anterior ni el de hoy.
  assert.equal(c1?.contactos, 16, 'la ventana de contactos se corrió en un borde');
});

test('los clics: la suma de `linkClick`, y su costo se paga sólo con el gasto que los cuenta', async () => {
  const semana = await enLaPropia(() => cifrasPorCampana(hoy(7), hoy(1)));
  assert.equal(semana.get(C1)?.clics, 3, 'no se sumaron los `linkClick`');
  // Los 5 de hace tres días no tienen desglose: gastaron, pero sus clics no se saben.
  assert.equal(semana.get(C1)?.inversionConDesglose, 9);
  // C2 tiene un desglose sin `linkClick`: ese tipo no ocurrió, y eso sí es cero.
  assert.equal(semana.get(C2)?.clics, 0);
  // El día en que C2 entregó sin ningún desglose, los clics no se saben.
  const soloEseDia = await enLaPropia(() => cifrasPorCampana(hoy(2), hoy(2)));
  assert.equal(soloEseDia.get(C2)?.clics, null, 'con entrega y sin desglose, los clics se inventaron en cero');
  assert.equal(soloEseDia.get(C2)?.inversion, 3);
  // Y en días sin ninguna entrega —sólo el relleno— los clics son CERO: sin entrega no hay clics.
  const sinEntrega = await enLaPropia(() => cifrasPorCampana(hoy(5), hoy(4)));
  assert.equal(sinEntrega.get(C2)?.clics, 0, 'sin entrega, los clics salieron «no se saben»');
});

test('calificado es agendado y no descartado; una cita sin calendario no cuenta', async () => {
  const c1 = (await enLaPropia(() => cifrasPorCampana(hoy(7), hoy(1)))).get(C1)!;
  // 12 calificados + 1 descartado; el de la cita sin calendario no agendó.
  assert.equal(c1.agendados, 13, 'se contó como agendada una cita sin calendario, o se perdió una');
  assert.equal(c1.calificados, 12, 'el descartado se contó como calificado');
});

test('el ICP de los calificados reparte con `tramoDelPuntaje`', async () => {
  /* Lo esperado sale de la función y no de una lista escrita a mano: el `case` del SQL es una segunda
     copia de ese corte (`tramosDelIcp.ts`), y la única forma de que no diverjan es compararlas. */
  const esperado = { alto: 0, medio: 0, bajo: 0, sin_calificar: 0 };
  for (const s of PUNTAJES_CALIFICADOS) esperado[tramoDelPuntaje(s)] += 1;
  const c1 = (await enLaPropia(() => cifrasPorCampana(hoy(7), hoy(1)))).get(C1)!;
  assert.deepEqual(
    [c1.alto, c1.medio, c1.bajo, c1.sinCalificar],
    [esperado.alto, esperado.medio, esperado.bajo, esperado.sin_calificar],
    'el SQL corta distinto que `tramoDelPuntaje`',
  );
  // El 90 del descartado no entra: el puntaje es de los calificados.
  assert.deepEqual([c1.sumaDePuntajes, c1.conPuntaje], [609, 10]);
});

test('la ventana anterior cuenta los agendados a la MISMA edad', async () => {
  /* Sus contactos llevan siete días más en la base. Sin el corte, habrían tenido una semana más para
     agendar: dos de estas cuatro citas se reservaron DESPUÉS de esa edad, y no cuentan. Las dos sin
     `reservada_el` se miden por su inicio. */
  const sinCorte = (await enLaPropia(() => cifrasPorCampana(hoy(14), hoy(8)))).get(C1)!;
  const conCorte = (await enLaPropia(() => cifrasPorCampana(hoy(14), hoy(8), 7))).get(C1)!;
  assert.equal(sinCorte.agendados, 4, 'contó una cita sin calendario, o perdió una');
  assert.equal(conCorte.agendados, 2, 'la anterior contó citas reservadas después de su edad, o una sin calendario');
  assert.equal(conCorte.contactos, 6);
});

// ─── 2 · La pantalla ────────────────────────────────────────────────────────

test('siete días son siete días CERRADOS, y comparan contra los siete anteriores', async () => {
  const p = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), zonaDe(propia)));
  assert.deepEqual(p.ventana, { desde: hoy(7), hasta: hoy(1) }, 'la ventana incluye hoy, que está incompleto');
  assert.deepEqual(p.anterior, { desde: hoy(14), hasta: hoy(8) }, 'la anterior pisa a la actual o se corrió');
  assert.equal(p.sinComparacion, null);
  assert.equal(p.sinCostos, null);

  const c1 = p.campanas.find((c) => c.campana === C1)!;
  const [contactos, clics, agendados] = c1.cifras.etapas;
  assert.deepEqual(c1.cifras.variacionDeInversion, { tipo: 'sube', porcentaje: 10 / 4, lectura: 'neutra' });
  // 16 contra los 6 de la anterior (cinco de C1 más el último segundo antes de la ventana).
  assert.deepEqual(contactos?.variacion, { tipo: 'sube', porcentaje: 10 / 6, lectura: 'buena' });
  assert.deepEqual(clics?.variacion, { tipo: 'sube', porcentaje: 2, lectura: 'buena' });
  // 13 contra los 2 de la anterior A LA MISMA EDAD, no contra los 4 de hoy.
  assert.deepEqual(agendados?.variacion, { tipo: 'sube', porcentaje: 11 / 2, lectura: 'buena' });
  // Los calificados no comparan: el descarte no tiene fecha, y la anterior tuvo más tiempo para recibirlo.
  assert.deepEqual(c1.cifras.calificados.variacion, { tipo: 'sin_comparacion' });
  // El costo por clic: los 9 con desglose sobre los 3 clics, no los 14 de toda la ventana.
  assert.equal(clics?.costo, 3, 'el costo por clic dividió gasto de filas sin desglose');
  assert.equal(contactos?.costo, 14 / 16);
});

test('sin desglose que cubra la anterior, sólo los clics dejan de comparar', async () => {
  await esc.admin.query(
    `update negocio.metricas_de_anuncio set acciones = null where org_id = $1 and meta_anuncio_id = $2 and fecha = current_date - 15`,
    [propia, A1],
  );
  try {
    const p = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), zonaDe(propia)));
    const [contactos, clics] = p.campanas.find((c) => c.campana === C1)!.cifras.etapas;
    assert.equal(clics?.variacion.tipo, 'sin_comparacion', 'los clics compararon contra días sin desglose');
    assert.equal(contactos?.variacion.tipo, 'sube', 'se apagó la comparación de todo, y no sólo la de los clics');
  } finally {
    await esc.admin.query(
      `update negocio.metricas_de_anuncio set acciones = '{"linkClick": 1}'::jsonb where org_id = $1 and meta_anuncio_id = $2 and fecha = current_date - 15`,
      [propia, A1],
    );
  }
});

test('un día sin gasto guardado apaga la comparación: en la actual y en la anterior', async () => {
  const actual = await sinElDia(2, () => enLaPropia(() => embudosDeAcquisition(periodo('7d'), zonaDe(propia))));
  assert.deepEqual([actual.sinComparacion, actual.anterior], ['faltan_dias', null]);
  // Y sin costos: la inversión de esa ventana sale baja, y el costo por contacto se leería como un dato.
  assert.equal(actual.sinCostos, 'gasto_incompleto');
  assert.ok(actual.total.etapas.every((e) => e.costo === null) && actual.total.calificados.costo === null);
  const previa = await sinElDia(10, () => enLaPropia(() => embudosDeAcquisition(periodo('7d'), zonaDe(propia))));
  assert.deepEqual([previa.sinComparacion, previa.anterior], ['sin_historia', null]);
});

test('con el gasto entero, una historia de contactos que empieza tarde también apaga la comparación', async () => {
  /* Sin el contacto de hace veinticinco días, el más viejo es de hace doce: la anterior empieza hace
     catorce, así que sus primeros días no tienen de dónde contar contactos. */
  const viejo = await esc.admin.query<{ id: string }>(
    `select id from negocio.contactos where org_id = $1 and alta_en_el_crm < current_date - 20`,
    [propia],
  );
  assert.equal(viejo.rows.length, 1);
  await esc.admin.query(`update negocio.contactos set alta_en_el_crm = alta_en_el_crm + interval '20 days' where id = $1`, [
    viejo.rows[0]!.id,
  ]);
  try {
    const p = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), zonaDe(propia)));
    assert.deepEqual([p.sinComparacion, p.anterior], ['sin_historia', null], 'comparó con contactos que empiezan tarde');
  } finally {
    await esc.admin.query(`update negocio.contactos set alta_en_el_crm = alta_en_el_crm - interval '20 days' where id = $1`, [
      viejo.rows[0]!.id,
    ]);
  }
});

test('treinta días no compara: los datos no cubren los treinta anteriores', async () => {
  const p = await enLaPropia(() => embudosDeAcquisition(periodo('30d'), zonaDe(propia)));
  assert.deepEqual(p.ventana, { desde: hoy(30), hasta: hoy(1) });
  assert.equal(p.sinComparacion, 'sin_historia');
  assert.equal(p.anterior, null);
  assert.ok(p.campanas.every((c) => c.cifras.etapas.every((e) => e.variacion.tipo === 'sin_comparacion')));
  /* El primer desglose es de hace quince días y la ventana empieza hace treinta: los clics serían los de
     la mitad de la ventana, y no se publican. En siete días, que el desglose cubre, sí (ver arriba). */
  const clics = p.campanas.find((c) => c.campana === C1)!.cifras.etapas.find((e) => e.etapa === 'clics');
  assert.equal(clics?.valor, null, 'publicó los clics de una parte de la ventana como si fueran de toda');
});

test('«Hoy» es hoy, no compara y no publica costos', async () => {
  const p = await enLaPropia(() => embudosDeAcquisition(periodo('hoy'), zonaDe(propia)));
  assert.deepEqual(p.ventana, { desde: hoy(0), hasta: hoy(0) });
  assert.deepEqual([p.sinComparacion, p.anterior, p.sinCostos], ['periodo', null, 'hoy']);
  const c1 = p.campanas.find((c) => c.campana === C1)!;
  assert.equal(c1.cifras.inversion, 10);
  assert.ok(
    c1.cifras.etapas.every((e) => e.costo === null) && c1.cifras.calificados.costo === null,
    'publicó costos con el gasto de la madrugada',
  );
  // El contacto de hoy: la cobertura mira también el último día de su ventana.
  assert.deepEqual(p.cobertura, { conCampana: 1, sobre: 1 });
});

test('«Completo» empieza en el primer dato, no compara, y publica costos sólo si el gasto lo cubre', async () => {
  const p = await enLaPropia(() => embudosDeAcquisition(periodo('completo'), zonaDe(propia)));
  // El primer dato es el gasto de hace treinta días (el relleno); el contacto más viejo es de hace veinticinco.
  assert.deepEqual(p.ventana, { desde: hoy(30), hasta: hoy(0) }, '«Completo» no empieza en el primer dato');
  assert.equal(p.sinComparacion, 'periodo');
  assert.notEqual(p.total.etapas[0]?.costo, null, 'con el gasto entero, «Completo» tiene que publicar costos');

  /* Con un contacto de antes del primer gasto, la ventana empieza con él y sus primeros días no tienen
     gasto guardado: el costo por contacto dividiría cuatro semanas y media de gasto por seis semanas
     de contactos. */
  await esc.admin.query(
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera)
     values ($1, $2, 'Contacto 181 viejo', 'setter', (current_date - 40)::timestamptz + interval '12 hours', $3::jsonb)`,
    [propia, `c181-viejo-${randomUUID()}`, JSON.stringify({ campaignId: C1 })],
  );
  try {
    const q = await enLaPropia(() => embudosDeAcquisition(periodo('completo'), zonaDe(propia)));
    assert.equal(q.ventana.desde, hoy(40));
    assert.ok(q.total.etapas.every((e) => e.costo === null), 'publicó costos con contactos de antes del primer gasto');
  } finally {
    await esc.admin.query(`delete from negocio.contactos where org_id = $1 and nombre = 'Contacto 181 viejo'`, [propia]);
  }
});

test('«Completo» no pierde los costos de noche, antes de que llegue la primera fila de hoy', async () => {
  const p = await sinElDia(0, () => enLaPropia(() => embudosDeAcquisition(periodo('completo'), zonaDe(propia))));
  assert.equal(p.sinCostos, null, 'sin la fila de hoy, «Completo» se quedó sin costos');
});

test('antes de que el colector relea ayer, la ventana cerrada termina anteayer', async () => {
  /* El gasto de un día se lee a las 06:17 UTC de ese día y se relee a la misma hora del siguiente. Si la
     única lectura de ayer es de ayer mismo, ayer todavía es la foto de la madrugada. */
  await esc.admin.query(
    `update negocio.metricas_de_anuncio set sincronizado_el = (current_date - 1)::timestamptz + interval '6 hours'
      where org_id = $1 and fecha = current_date - 1`,
    [propia],
  );
  try {
    const p = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), zonaDe(propia)));
    assert.deepEqual(p.ventana, { desde: hoy(8), hasta: hoy(2) }, 'la ventana terminó en un día sin releer');
    assert.deepEqual(p.anterior, { desde: hoy(15), hasta: hoy(9) });
  } finally {
    await esc.admin.query(
      `update negocio.metricas_de_anuncio set sincronizado_el = now() where org_id = $1 and fecha = current_date - 1`,
      [propia],
    );
  }
});

test('una empresa sin métricas pero con contactos de campaña no «nunca pautó»: le falta el gasto', async () => {
  const o = await esc.admin.query<{ id: string }>(
    `insert into identidad.organizaciones (nombre, slug) values ('Embudos 181 sin gasto', $1) returning id`,
    [`${PREFIJO_DEL_SLUG}${randomUUID().slice(0, 8)}`],
  );
  const otra = o.rows[0]!.id;
  try {
    await esc.admin.query(
      `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera)
       values ($1, $2, 'Contacto 181', 'setter', now() - interval '3 days', $3::jsonb)`,
      [otra, `c181-${randomUUID()}`, JSON.stringify({ campaignId: C1 })],
    );
    const p = await conOrganizacion(otra, () => embudosDeAcquisition(periodo('7d'), 'UTC'));
    assert.equal(p.sinComparacion, 'faltan_dias', 'comparó una inversión cero que no es cero');
    assert.equal(p.sinCostos, 'gasto_incompleto');
    // Sin métricas no hay nada que esperar: la ventana termina ayer.
    assert.deepEqual(p.ventana, { desde: hoy(7), hasta: hoy(1) });
  } finally {
    await borrarEmpresa(otra);
  }
});

test('una empresa sin métricas ni contactos de campaña compara: nunca pautó, y cero contra cero es verdad', async () => {
  const o = await esc.admin.query<{ id: string }>(
    `insert into identidad.organizaciones (nombre, slug) values ('Embudos 181 sin nada', $1) returning id`,
    [`${PREFIJO_DEL_SLUG}${randomUUID().slice(0, 8)}`],
  );
  const otra = o.rows[0]!.id;
  try {
    const p = await conOrganizacion(otra, () => embudosDeAcquisition(periodo('7d'), 'UTC'));
    assert.deepEqual([p.sinComparacion, p.sinCostos], [null, null], 'una empresa que nunca pautó no compara');
    assert.deepEqual(p.anterior, { desde: hoy(14), hasta: hoy(8) });
  } finally {
    await borrarEmpresa(otra);
  }
});

test('el universo: la asignada sin actividad y la que GoHighLevel no listó también están', async () => {
  const p = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), zonaDe(propia)));
  const de = (c: string) => p.campanas.find((x) => x.campana === c);
  assert.deepEqual(
    p.campanas.map((c) => c.campana).sort(),
    [C1, C2, C3, C4],
    'falta una campaña del universo, o se coló una que no es de esta empresa',
  );
  assert.deepEqual([de(C1)?.funnel, de(C1)?.nombre, de(C1)?.estado, de(C1)?.conocida], ['leadform', 'bofu - lead ads', 'ACTIVE', true]);
  assert.deepEqual([de(C2)?.estado, de(C3)?.funnel, de(C3)?.nombre, de(C3)?.conocida], ['PAUSED', null, null, false]);
  assert.equal(de(C4)?.funnel, 'booking');
  assert.deepEqual([p.funnels.leadform.campanas, p.funnels.booking.campanas, p.sinFunnel.campanas], [1, 1, 2]);
  assert.equal(p.funnels.booking.inversion, 0);
  // El total: 14 de C1 + 3 de C2. Los 1000 de alfa, con la misma campaña y el mismo día, no.
  assert.equal(p.total.inversion, 17, 'se coló el gasto de otra empresa, o faltó uno de esta');
  assert.equal(p.total.etapas[0]?.valor, 17, '16 de C1 y 1 de C3; no la plantilla ni el sin atribución');
  // 16 de C1 + 1 de C3 con campaña; más la plantilla y el sin atribución.
  assert.deepEqual(p.cobertura, { conCampana: 17, sobre: 19 });
});

// ─── 3 · La ruta ────────────────────────────────────────────────────────────

test('la ruta respeta el período, trae los funnels y dice si la sesión puede asignar', async () => {
  const semana = await leerRespuesta<{ embudos: { ventana: unknown }; puedeAsignar: boolean } & Record<string, unknown>>(
    await leerAcquisition(pedirComo('/api/acquisition?periodo=7d', esc.token)),
  );
  assert.equal(semana.estado, 200);
  /* Sin `costo` ni `calidad` desde AQ-4: la tabla por anuncio y el monitor eran la pantalla anterior, y
     calcularlos para nadie costaba dos lecturas por carga (A14-15). */
  assert.deepEqual(Object.keys(semana.cuerpo).sort(), ['embudos', 'periodo', 'puedeAsignar']);
  /* `alfa` es compartida: la ventana exacta depende de si su «ayer» ya se releyó. Lo que se exige es
     que la ruta dé lo MISMO que el cálculo con el período pedido. */
  const zonaDeAlfa = (await esc.admin.query<{ z: string }>('select zona_horaria as z from identidad.organizaciones where id = $1', [esc.org])).rows[0]!.z;
  const esperada = await conOrganizacion(esc.org, () => embudosDeAcquisition(periodo('7d'), zonaDeAlfa));
  assert.deepEqual(semana.cuerpo.embudos.ventana, esperada.ventana, 'la ruta no le pasó el período');
  assert.equal(semana.cuerpo.puedeAsignar, true);
  const deHoy = await leerRespuesta<{ embudos: { sinComparacion: string } }>(
    await leerAcquisition(pedirComo('/api/acquisition?periodo=hoy', esc.token)),
  );
  assert.equal(deHoy.cuerpo.embudos.sinComparacion, 'periodo');

  // El rol `usuario`, con la pestaña, ve la pantalla y NO puede asignar.
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash, creado_por)
     values ($1, 'Persona comun', $2, 'scrypt$16384$8$1$c2FsCg==$aGFzaAo=', null) returning id`,
    [esc.org, CORREO_COMUN],
  );
  const id = rows[0]!.id;
  await esc.admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id)
     select $1, r.id from identidad.roles r where r.clave = 'usuario' and r.org_id is null`,
    [id],
  );
  await esc.admin.query(
    `insert into identidad.usuarios_secciones (usuario_id, seccion, concedida_por) values ($1, 'acquisition', $2)`,
    [id, esc.quien],
  );
  const comun = await leerRespuesta<{ puedeAsignar: boolean }>(
    await leerAcquisition(pedirComo('/api/acquisition?periodo=7d', await sesionDe(id))),
  );
  assert.equal(comun.estado, 200);
  assert.equal(comun.cuerpo.puedeAsignar, false, 'la pantalla le ofrecería el selector a quien no puede asignar');
});

test('si el colector dejó de escribir hace más de 26 horas, la ventana termina ayer y no compara ni publica costos', async () => {
  /* Pasadas perdidas: la última escritura es de hace treinta horas. Dar la ventana por buena sería
     comparar días que el colector no volvió a mirar. */
  await esc.admin.query(`update negocio.metricas_de_anuncio set sincronizado_el = now() - interval '30 hours' where org_id = $1`, [propia]);
  try {
    const p = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), zonaDe(propia)));
    assert.deepEqual([p.sinComparacion, p.anterior, p.sinCostos], ['faltan_dias', null, 'gasto_incompleto']);
    assert.deepEqual(p.ventana, { desde: hoy(7), hasta: hoy(1) });

    /* Veinticinco horas es lo normal: la pasada es diaria, y un minuto antes de la de hoy la última
       escritura tiene casi veinticuatro. No es atraso. */
    await esc.admin.query(`update negocio.metricas_de_anuncio set sincronizado_el = now() - interval '25 hours' where org_id = $1`, [
      propia,
    ]);
    const alDia = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), zonaDe(propia)));
    assert.notEqual(alDia.sinComparacion, 'faltan_dias', 'una pasada puntual se leyó como atraso');
    assert.equal(alDia.sinCostos, null);
  } finally {
    await esc.admin.query(`update negocio.metricas_de_anuncio set sincronizado_el = now() where org_id = $1`, [propia]);
  }
});

test('un día del medio que nunca se releyó después de terminar apaga la comparación', async () => {
  /* Dos pasadas perdidas dejan el día de la última buena como una foto de antes de que terminara, para
     siempre: el colector no vuelve a pedir un día que ya tiene filas. Tiene filas, pero no está cerrado.
     Ayer, releído a las 06:17 UTC de hoy, para que en Lima esté cerrado a cualquier hora de la corrida:
     el instante puede quedar en el futuro, y no importa, porque el atraso sólo mira hacia atrás. */
  await esc.admin.query(
    `update negocio.metricas_de_anuncio set sincronizado_el = current_date::timestamptz + interval '6 hours 17 minutes'
      where org_id = $1 and fecha = current_date - 1`,
    [propia],
  );
  await esc.admin.query(
    `update negocio.metricas_de_anuncio set sincronizado_el = fecha::timestamptz + interval '6 hours'
      where org_id = $1 and fecha = current_date - 4`,
    [propia],
  );
  try {
    const p = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), zonaDe(propia)));
    assert.deepEqual([p.sinComparacion, p.sinCostos], ['faltan_dias', 'gasto_incompleto'], 'dio por entero un día a medias');

    /* Releído a las 03:00 UTC del día siguiente: cerrado en UTC, todavía no en Lima (05:00 UTC). La
       cobertura cierra los días con la zona de la empresa, como el último día cerrado. */
    await esc.admin.query(
      `update negocio.metricas_de_anuncio set sincronizado_el = (fecha + 1)::timestamptz + interval '3 hours'
        where org_id = $1 and fecha = current_date - 4`,
      [propia],
    );
    const enUtc = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), 'UTC'));
    const enLima = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), 'America/Lima'));
    assert.equal(enUtc.sinComparacion, null);
    assert.deepEqual(enLima.ventana, { desde: hoy(7), hasta: hoy(1) });
    assert.equal(enLima.sinComparacion, 'faltan_dias', 'la cobertura cerró el día con la medianoche de UTC');
  } finally {
    await esc.admin.query(
      `update negocio.metricas_de_anuncio set sincronizado_el = now() where org_id = $1 and fecha in (current_date - 1, current_date - 4)`,
      [propia],
    );
  }
});

test('un día de la ventana anterior releído antes de la medianoche de la empresa apaga la flecha', async () => {
  /* Con ayer cerrado —releído a las 06:17 UTC de hoy, como en la prueba de arriba—, la anterior de
     siete días va de hace catorce a hace ocho. Un día suyo releído a las 03:00 UTC del siguiente está
     cerrado en UTC y no en Lima. */
  await esc.admin.query(
    `update negocio.metricas_de_anuncio set sincronizado_el = current_date::timestamptz + interval '6 hours 17 minutes'
      where org_id = $1 and fecha = current_date - 1`,
    [propia],
  );
  await esc.admin.query(
    `update negocio.metricas_de_anuncio set sincronizado_el = (fecha + 1)::timestamptz + interval '3 hours'
      where org_id = $1 and fecha = current_date - 11`,
    [propia],
  );
  try {
    const enUtc = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), 'UTC'));
    const enLima = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), 'America/Lima'));
    assert.equal(enUtc.sinComparacion, null);
    assert.deepEqual(enUtc.anterior, { desde: hoy(14), hasta: hoy(8) });
    assert.equal(enLima.sinComparacion, 'sin_historia', 'la anterior cerró el día con la medianoche de UTC');
  } finally {
    await esc.admin.query(
      `update negocio.metricas_de_anuncio set sincronizado_el = now() where org_id = $1 and fecha in (current_date - 1, current_date - 11)`,
      [propia],
    );
  }
});

test('si el colector escribe pero ya no cierra días, también está atrasado: la ventana no se queda en una semana vieja', async () => {
  /* Hoy y los cuatro días anteriores releídos sólo en su propio día: el colector escribió hace minutos,
     pero el último día cerrado es de hace cinco. Sin la cota de días, la ventana terminaría ahí, con
     flechas y costos de una semana que ya pasó. */
  await esc.admin.query(
    `update negocio.metricas_de_anuncio set sincronizado_el = fecha::timestamptz + interval '6 hours'
      where org_id = $1 and fecha between current_date - 4 and current_date - 1`,
    [propia],
  );
  try {
    const p = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), zonaDe(propia)));
    assert.deepEqual([p.sinComparacion, p.sinCostos], ['faltan_dias', 'gasto_incompleto'], 'publicó una semana vieja como la actual');
    assert.deepEqual(p.ventana, { desde: hoy(7), hasta: hoy(1) });

    /* Con el último cerrado de hace tres, que es lo normal al oeste de UTC−6 antes de la pasada, no hay
       atraso: la ventana termina ahí y los costos se publican. */
    await esc.admin.query(
      `update negocio.metricas_de_anuncio set sincronizado_el = now() where org_id = $1 and fecha in (current_date - 3, current_date - 4)`,
      [propia],
    );
    const normal = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), zonaDe(propia)));
    assert.equal(normal.ventana.hasta, hoy(3));
    assert.notEqual(normal.sinComparacion, 'faltan_dias', 'el peor caso normal se leyó como atraso');
    assert.equal(normal.sinCostos, null);
  } finally {
    await esc.admin.query(
      `update negocio.metricas_de_anuncio set sincronizado_el = now() where org_id = $1 and fecha between current_date - 4 and current_date - 1`,
      [propia],
    );
  }
});

test('«Completo» con el primer dato de hoy no publica costos: no hay ningún día cerrado que los respalde', async () => {
  const o = await esc.admin.query<{ id: string }>(
    `insert into identidad.organizaciones (nombre, slug) values ('Embudos 181 de hoy', $1) returning id`,
    [`${PREFIJO_DEL_SLUG}${randomUUID().slice(0, 8)}`],
  );
  const otra = o.rows[0]!.id;
  try {
    await esc.admin.query(`insert into negocio.anuncios (org_id, meta_anuncio_id, meta_campana_id, nombre) values ($1, $2, $3, 'a1')`, [
      otra,
      A1,
      C1,
    ]);
    await esc.admin.query(
      `insert into negocio.metricas_de_anuncio (org_id, meta_anuncio_id, fecha, gasto, impresiones, clics)
       values ($1, $2, current_date, 5, 100, 5)`,
      [otra, A1],
    );
    await esc.admin.query(
      `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera)
       values ($1, $2, 'Contacto 181', 'setter', now(), $3::jsonb)`,
      [otra, `c181-${randomUUID()}`, JSON.stringify({ campaignId: C1 })],
    );
    const p = await conOrganizacion(otra, () => embudosDeAcquisition(periodo('completo'), 'UTC'));
    assert.equal(p.sinCostos, 'gasto_incompleto', 'publicó el gasto de la madrugada dividido por los contactos del día entero');
  } finally {
    await borrarEmpresa(otra);
  }
});

test('una empresa al oeste de UTC−6 termina la ventana antes, sin parecer atrasada', async () => {
  /* La pasada de hoy releyó ayer a las 06:17 UTC. La medianoche de Lima (05:00 UTC) ya pasó: ayer está
     cerrado. La de Los Ángeles (07:00 u 08:00 UTC) no: ayer no está cerrado, y la ventana termina
     anteayer. Ninguna de las dos está atrasada: el colector escribió hoy. */
  await esc.admin.query(
    `update negocio.metricas_de_anuncio set sincronizado_el = current_date::timestamptz + interval '6 hours 17 minutes'
      where org_id = $1 and fecha = current_date - 1`,
    [propia],
  );
  try {
    const enLima = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), 'America/Lima'));
    const enLosAngeles = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), 'America/Los_Angeles'));
    assert.equal(enLima.ventana.hasta, hoy(1));
    assert.equal(enLosAngeles.ventana.hasta, hoy(2));
    assert.deepEqual([enLima.sinComparacion, enLosAngeles.sinComparacion], [null, null], 'una de las dos pareció atrasada');
  } finally {
    await esc.admin.query(`update negocio.metricas_de_anuncio set sincronizado_el = now() where org_id = $1 and fecha = current_date - 1`, [
      propia,
    ]);
  }
});

test('el día cierra a la medianoche de la EMPRESA, no a la de UTC', async () => {
  /* Una relectura a las 03:00 UTC ya pasó la medianoche de UTC, pero no la de Lima (05:00 UTC): para
     una empresa en Lima, ayer todavía no terminó cuando se releyó. */
  await esc.admin.query(
    `update negocio.metricas_de_anuncio set sincronizado_el = current_date::timestamptz + interval '3 hours'
      where org_id = $1 and fecha = current_date - 1`,
    [propia],
  );
  try {
    const enUtc = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), 'UTC'));
    const enLima = await enLaPropia(() => embudosDeAcquisition(periodo('7d'), 'America/Lima'));
    assert.equal(enUtc.ventana.hasta, hoy(1));
    assert.equal(enLima.ventana.hasta, hoy(2), 'dio por cerrado un día que en la empresa todavía no había terminado');
  } finally {
    await esc.admin.query(`update negocio.metricas_de_anuncio set sincronizado_el = now() where org_id = $1 and fecha = current_date - 1`, [
      propia,
    ]);
  }
});
