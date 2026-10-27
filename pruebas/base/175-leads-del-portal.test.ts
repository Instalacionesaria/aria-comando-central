// La cohorte de Leads Portal, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO PROTEGE
//
// Una fila por persona, con cinco preguntas ya contestadas —cuadrante del ICP, cita, asistencia, plantón y
// venta—, y seis tarjetas contadas sobre esas mismas filas. Los defectos que importan no fallan: dan
// un número más grande y creíble.
//
//   · **Contar citas y rotularlas personas.** Tres citas de una persona son una persona que agendó.
//   · **Colapsar el «no se sabe» en «no».** Una cita que ocurrió sin que nadie registrara nada no es
//     un «no asistió», un plantón del calendario no es nuestra asistencia, y cero ventas registradas
//     no es un cierre de 0 %.
//   · **Clasificar dos veces.** El cuadrante que la tarjeta cuenta y el que la fila muestra salen de la
//     misma columna (la `105`); lo que no es una de las cuatro claves cae en «Sin clasificar» en las dos.
//   · **Mandar al navegador lo que no va.** La fila tiene exactamente trece claves, y ningún número del ICP.
//
// Todas las pruebas comparten la organización `alfa` con el resto de la suite. Por eso cada una
// siembra con el prefijo `portal-`, limpia antes, y lo que es de toda la empresa —los que no tienen
// alta, los que traen un valor desconocido en el campo— se mide contra una línea base tomada en la misma prueba.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { CLAVES_DE_LA_FILA, leadsDelPortal, type LeadsDelPortal } from '../../lib/negocio/leadsDelPortal.ts';
import { PISO_DE_UNA_TASA } from '../../lib/negocio/indicadoresDeCitas.ts';
import { claveDelCuadrante } from '../../lib/negocio/cuadrantesDelIcp.ts';
import { CLAVE_DEL_CUADRANTE } from '../../lib/ghl/contrato.ts';
import { DIAS_DE_TODO } from '../../lib/negocio/periodo.ts';

let esc: Escenario;

const PREFIJO = 'portal-';
/** El campo del cuadrante en el catálogo de la empresa de prueba: sin él no se distingue «sin valor» de «otro valor». */
const CAMPO = 'portal-campo-cuadrante';
const CARPETA = 'portal-carpeta';

async function sembrarElCampo(): Promise<void> {
  await esc.admin.query(
    `insert into negocio.carpetas_del_crm (org_id, carpeta_id, nombre, visto_el) values ($1, $2, 'Prueba', now()) on conflict do nothing`,
    [esc.org, CARPETA],
  );
  await esc.admin.query(
    `insert into negocio.campos_del_crm (org_id, campo_id, nombre, carpeta_id, tipo, posicion, clave, visto_el)
       values ($1, $2, 'Cuadrante de Clasificacion', $3, 'RADIO', '1', $4, now()) on conflict do nothing`,
    [esc.org, CAMPO, CARPETA, CLAVE_DEL_CUADRANTE],
  );
}

async function quitarElCampo(): Promise<void> {
  await esc.admin.query('delete from negocio.campos_del_crm where org_id = $1 and campo_id = $2', [esc.org, CAMPO]);
  await esc.admin.query('delete from negocio.carpetas_del_crm where org_id = $1 and carpeta_id = $2', [esc.org, CARPETA]);
}

async function limpiar(): Promise<void> {
  const deLaPrueba = 'select id from negocio.contactos where ghl_contact_id like $1';
  await esc.admin.query(`delete from negocio.resultados where contacto_id in (${deLaPrueba})`, [`${PREFIJO}%`]);
  await esc.admin.query(`delete from negocio.citas where contacto_id in (${deLaPrueba})`, [`${PREFIJO}%`]);
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${PREFIJO}%`]);
}

interface Cita {
  /** Negativo para el pasado. En horas, porque «cerrable» mira `inicio_el < now()`. */
  haceHoras: number;
  estado?: string;
  congelada?: boolean;
  asistio?: boolean | null;
}

/** Un contacto con lo que haga falta. Devuelve su id. */
async function unContacto(o: {
  nombre?: string;
  /** Días desde el alta. `null` = sin alta. Por omisión, dos. */
  altaHaceDias?: number | null;
  creadoHaceDias?: number;
  /** El cuadrante ya guardado. Por omisión, Valida. */
  cuadrante?: string | null;
  /** Lo que trae en el campo del cuadrante, crudo. Por omisión, nada. */
  enElCampo?: string;
  etiquetas?: string[];
  territorio?: 'closer' | 'setter' | null;
  atribucion?: Record<string, string>;
  citas?: Cita[];
  resultados?: { salida: string; monto?: number | null }[];
}): Promise<string> {
  const ghl = `${PREFIJO}${randomUUID().slice(0, 8)}`;
  const alta = o.altaHaceDias === undefined ? 2 : o.altaHaceDias;
  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos
       (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, creado_el, cuadrante, etiquetas,
        atribucion_primera, telefono, email, campos_del_crm, score)
     values ($1, $2, $3, $4,
             case when $5::int is null then null else now() - make_interval(days => $5::int) end,
             now() - make_interval(days => $6::int), $7, $8::text[], $9::jsonb,
             '+51 999 000 000', 'persona@ejemplo.test', $10::jsonb, 87)
     returning id`,
    [
      esc.org,
      ghl,
      o.nombre ?? 'Lead de prueba',
      o.territorio === undefined ? 'closer' : o.territorio,
      alta,
      o.creadoHaceDias ?? 1,
      o.cuadrante === undefined ? 'valida' : o.cuadrante,
      o.etiquetas ?? [],
      JSON.stringify(o.atribucion ?? {}),
      JSON.stringify(o.enElCampo === undefined ? {} : { [CAMPO]: o.enElCampo }),
    ],
  );
  const id = r.rows[0]!.id;
  for (const [i, c] of (o.citas ?? []).entries()) {
    const inicio = new Date(Date.now() + c.haceHoras * 3600_000);
    await esc.admin.query(
      `insert into negocio.citas
         (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl, asistio)
       values ($1, $2, $3, $4, $5::timestamptz, $5::timestamptz + interval '1 hour', $6, $7)`,
      [esc.org, id, `cita-${ghl}-${i}`, c.congelada ? null : 'cal-portal', inicio, c.estado ?? 'confirmed', c.asistio ?? null],
    );
  }
  for (const res of o.resultados ?? []) {
    await esc.admin.query(
      `insert into negocio.resultados (org_id, contacto_id, salida, rol, registrado_por, monto)
         values ($1, $2, $3, 'closer', $4, $5)`,
      [esc.org, id, res.salida, esc.quien, res.monto ?? null],
    );
  }
  return id;
}

const leer = (dias = 30, tope?: number): Promise<LeadsDelPortal> =>
  conOrganizacion(esc.org, () => leadsDelPortal(dias, tope));
const filaDe = (r: LeadsDelPortal, id: string) => r.leads.find((l) => l.id === id);
const cuadrante = (r: LeadsDelPortal, clave: string) => r.cuadrantes.find((t) => t.clave === clave)!;

/**
 * La org de prueba no puede tener ventas de otra prueba: varias afirmaciones de acá dependen de que
 * la empresa no tenga NINGUNA. Si esto falla, alguna prueba anterior dejó una venta sembrada.
 */
async function sinVentasAjenas(): Promise<void> {
  const r = await esc.admin.query<{ n: number }>(
    `select count(*)::int as n from negocio.resultados where org_id = $1 and salida = 'venta'`,
    [esc.org],
  );
  assert.equal(r.rows[0]!.n, 0, 'la organización de prueba ya tiene una venta de otra prueba');
}

before(async () => {
  esc = await montar('LeadsDelPortal');
  await limpiar();
  await sembrarElCampo();
});

after(async () => {
  await limpiar();
  await quitarElCampo();
  await cerrarTodo();
  await cerrarClientes();
});

// ─── EL CUADRANTE ────────────────────────────────────────────────────────────

test('el cuadrante de la fila es el de la columna, y lo que no es una de las cuatro claves es «Sin clasificar»', async () => {
  /* La fila y la tarjeta no vuelven a clasificar: leen la columna que la sincronización normalizó. Sin cuadrante es
     NULL (el catálogo de la `079` no tiene una quinta clave): «Sin clasificar», como en `claveDelCuadrante`. */
  await limpiar();
  const valores = ['prioriza', 'valida', 'financia', 'descarta', null];
  const ids = new Map<string, string | null>();
  for (const c of valores) ids.set(await unContacto({ cuadrante: c }), c);

  const r = await leer();
  for (const [id, c] of ids) assert.equal(filaDe(r, id)?.cuadrante, claveDelCuadrante(c), `el cuadrante ${c} cae en otro en SQL`);
});

test('las cinco tarjetas suman el total de la cohorte, y «Todos» es esa suma', async () => {
  await limpiar();
  for (const c of [null, null, 'prioriza', 'prioriza', 'valida', 'descarta']) await unContacto({ cuadrante: c });

  const r = await leer();
  const suma = r.cuadrantes.reduce((a, t) => a + t.contactos, 0);
  assert.equal(r.cohorte.total, 6);
  assert.equal(suma, r.cohorte.total, 'los cuadrantes no suman la cohorte: alguien cayó fuera de los cinco');
  assert.equal(r.todos.contactos, suma);
  assert.deepEqual(
    r.cuadrantes.map((t) => [t.clave, t.contactos]),
    [['sin_clasificar', 2], ['prioriza', 2], ['valida', 1], ['financia', 0], ['descarta', 1]],
  );
  assert.equal(cuadrante(r, 'prioriza').porcion, 2 / 6);
});

test('«Sin clasificar» se parte en sin valor y en otro valor, y las dos partes suman la tarjeta', async () => {
  await limpiar();
  await unContacto({ cuadrante: null });
  await unContacto({ cuadrante: null });
  // Una opción del OTRO campo «cuadrante» escrita en éste: no es ninguna de las cuatro.
  await unContacto({ cuadrante: null, enElCampo: 'Prioridad' });
  await unContacto({ cuadrante: 'prioriza', enElCampo: 'Prioriza' });

  const r = await leer();
  assert.equal(r.sinClasificar.sinValor, 2);
  assert.equal(r.sinClasificar.otroValor, 1, 'el valor desconocido se contó como sin valor, o no se contó');
  assert.equal(r.sinClasificar.sinValor + r.sinClasificar.otroValor, cuadrante(r, 'sin_clasificar').contactos);
  assert.equal(r.sinClasificar.sinCampo, false);
});

test('el guardián del valor desconocido mira la EMPRESA, no la ventana', async () => {
  /* Si se midiera dentro de la cohorte, el aviso se encendería con «30 días» y se apagaría con «Hoy» para el mismo
     contacto. La mutación que lo pone rojo es justamente ésa. */
  await limpiar();
  const base = (await leer(1)).sinClasificar.otrosEnLaEmpresa;
  await unContacto({ cuadrante: null, enElCampo: 'Descartar', altaHaceDias: 10 });

  const hoy = await leer(1);
  const todo = await leer(DIAS_DE_TODO);
  assert.equal(hoy.sinClasificar.otrosEnLaEmpresa, base + 1, 'con «Hoy» el valor de hace diez días no encendió el guardián');
  assert.equal(todo.sinClasificar.otrosEnLaEmpresa, base + 1);
  assert.equal(hoy.sinClasificar.otroValor, 0, 'el de hace diez días entró en la cohorte de hoy');
  assert.match(String(hoy.aviso), /no es Prioriza, Valida, Financia ni Descarta/, 'el guardián encendido no aparece en el aviso');
});

test('sin el campo del cuadrante en el catálogo, todos son «Sin clasificar» y el aviso lo dice', async () => {
  await limpiar();
  await quitarElCampo();
  try {
    await unContacto({ cuadrante: null, enElCampo: 'Prioridad' });
    const r = await leer();
    assert.equal(r.sinClasificar.sinCampo, true);
    assert.equal(r.sinClasificar.otroValor, 0, 'sin campo no hay valor que llamar desconocido');
    assert.match(String(r.aviso), /no tiene el campo del cuadrante/);
  } finally {
    await sembrarElCampo();
  }
});

test('ningún número del ICP viaja: ni en la fila ni en la respuesta', async () => {
  // El contacto tiene `score` 87 guardado (lo pone `unContacto`): la `105` lo deja en la base y fuera de la pantalla.
  await limpiar();
  const id = await unContacto({ cuadrante: 'prioriza' });
  const r = await leer();
  assert.doesNotMatch(JSON.stringify(r), /"(puntaje|score)"/, 'una clave del puntaje viejo viajó en la respuesta');
  assert.doesNotMatch(JSON.stringify(filaDe(r, id)), /87/, 'el puntaje viejo viajó en la fila');
});

// ─── LA COHORTE ──────────────────────────────────────────────────────────────

test('la cohorte se arma con el alta en el CRM, no con cuándo lo vio el barrido', async () => {
  /* `creado_el` es la marca de nuestro barrido, y en la carga inicial es la misma para cientos: una
     cohorte por `creado_el` salta de golpe sin que entre nadie. */
  await limpiar();
  const reciente = await unContacto({ altaHaceDias: 2, creadoHaceDias: 90 });
  const viejo = await unContacto({ altaHaceDias: 60, creadoHaceDias: 1 });

  const r = await leer(30);
  assert.ok(filaDe(r, reciente), 'un alta de hace dos días no entró porque el barrido lo vio hace noventa');
  assert.equal(filaDe(r, viejo), undefined, 'un alta de hace sesenta días entró porque el barrido lo vio ayer');
  assert.equal(r.cohorte.total, 1);
});

test('los que no tienen alta no entran en ninguna ventana, y se declaran', async () => {
  await limpiar();
  const base = await leer(DIAS_DE_TODO);
  await unContacto({ altaHaceDias: null, territorio: null });

  const r = await leer(DIAS_DE_TODO);
  assert.equal(r.cohorte.total, base.cohorte.total, 'un contacto sin alta entró en «Completo»');
  assert.equal(r.cohorte.sinAlta, base.cohorte.sinAlta + 1);
  assert.equal(r.cohorte.universo, base.cohorte.universo + 1);
  assert.match(String(r.aviso), /no tienen fecha de alta/);
});

test('con la cohorte vacía la porción es nula, no 0 %, y el aviso lo dice', async () => {
  await limpiar();
  await unContacto({ altaHaceDias: 5 });

  const r = await leer(1);
  assert.equal(r.cohorte.total, 0);
  assert.equal(r.todos.porcion, null, 'un «0 %» sobre nadie afirma algo');
  assert.ok(r.cuadrantes.every((t) => t.porcion === null));
  assert.match(String(r.aviso), /No entró ni un contacto/);
  assert.ok(r.cohorte.ultimaAlta, 'con la cohorte vacía, la última alta de la empresa es lo que dice cuándo entró alguien');
});

test('la lista viaja ordenada por alta, la más reciente primero', async () => {
  await limpiar();
  const vieja = await unContacto({ altaHaceDias: 20 });
  const nueva = await unContacto({ altaHaceDias: 1 });
  const media = await unContacto({ altaHaceDias: 10 });

  const r = await leer();
  assert.deepEqual(r.leads.map((l) => l.id), [nueva, media, vieja]);
});

test('con el tope, la lista se recorta y lo dice, y las tarjetas siguen contando a todos', async () => {
  await limpiar();
  for (let i = 0; i < 3; i += 1) await unContacto({});

  const r = await leer(30, 2);
  assert.equal(r.leads.length, 2);
  assert.equal(r.truncado, true, 'la lista llegó recortada sin decirlo');
  assert.equal(r.cohorte.total, 3);
  assert.equal(r.todos.contactos, 3, 'las tarjetas contaron sólo lo que llegó en la lista');
  assert.match(String(r.aviso), /recortada/);
  assert.equal((await leer(30)).truncado, false);
});

// ─── LA CITA ─────────────────────────────────────────────────────────────────

test('tres citas de una persona son una persona que agendó', async () => {
  await limpiar();
  await unContacto({ citas: [{ haceHoras: -3 }, { haceHoras: -30 }, { haceHoras: +30 }] });

  const r = await leer();
  assert.equal(r.leads.length, 1);
  assert.equal(r.todos.agendados, 1, 'se contaron citas y no personas');
});

test('una cita cancelada cuenta como agendó; una persona con sólo congeladas no, y se marca aparte', async () => {
  /* Es la definición del sistema (`tieneCitaAlcanzable`): la misma de Sales, Creative y Conversion. */
  await limpiar();
  const cancelo = await unContacto({ citas: [{ haceHoras: -3, estado: 'cancelled' }] });
  const congelado = await unContacto({ citas: [{ haceHoras: -3, congelada: true }] });
  const sinCita = await unContacto({});

  const r = await leer();
  assert.equal(filaDe(r, cancelo)?.cita, 'agendo', 'una cancelada dejó de contar como agendó');
  assert.equal(filaDe(r, congelado)?.cita, 'solo_congeladas');
  assert.equal(filaDe(r, sinCita)?.cita, 'sin_cita');
  assert.equal(r.todos.agendados, 1, 'la persona con sólo citas congeladas entró en «Agendados»');
  assert.equal(r.todos.soloCongeladas, 1);
  assert.match(String(r.aviso), /congeladas/);
});

// ─── LA ASISTENCIA ───────────────────────────────────────────────────────────

test('la asistencia: lo registrado gana, y sin registro sólo es «sin registrar» si la cita ya ocurrió', async () => {
  await limpiar();
  const fue = await unContacto({ citas: [{ haceHoras: -3, asistio: false }, { haceHoras: -30, asistio: true }] });
  const noFue = await unContacto({ citas: [{ haceHoras: -3, asistio: false }] });
  const sinRegistro = await unContacto({ citas: [{ haceHoras: -3 }] });
  const futura = await unContacto({ citas: [{ haceHoras: +30 }] });
  const cancelada = await unContacto({ citas: [{ haceHoras: -3, estado: 'cancelled' }] });
  const congelada = await unContacto({ citas: [{ haceHoras: -3, congelada: true }] });
  /* `asistio` lo escribe Avanzar, no el CRM: una cita congelada con la asistencia cargada sigue
     diciendo la verdad. */
  const congeladaQueFue = await unContacto({ citas: [{ haceHoras: -3, congelada: true, asistio: true }] });

  const r = await leer();
  assert.equal(filaDe(r, fue)?.asistencia, 'asistio', 'un «sí» en cualquier cita tiene que ganar');
  assert.equal(filaDe(r, noFue)?.asistencia, 'no_asistio');
  assert.equal(filaDe(r, sinRegistro)?.asistencia, 'sin_registrar');
  assert.equal(filaDe(r, futura)?.asistencia, null, 'preguntar por una cita de mañana es pedir un pronóstico');
  assert.equal(filaDe(r, cancelada)?.asistencia, null, 'nadie faltó a una cita que no ocurrió');
  assert.equal(filaDe(r, congelada)?.asistencia, null, 'una congelada sin registro no es «sin registrar»');
  assert.equal(filaDe(r, congeladaQueFue)?.asistencia, 'asistio');
  assert.equal(r.todos.asistieron, 2);
  assert.equal(r.todos.sinRegistrar, 1);
  assert.match(String(r.aviso), /nadie registró si se presentaron/);
});

test('el plantón del calendario viaja aparte y no se convierte en «no asistió»', async () => {
  /* Son dos fuentes de la misma pregunta y sólo una es nuestra. Una cita `noshow` que ya pasó sigue
     siendo una cita sin asistencia registrada. */
  await limpiar();
  const planton = await unContacto({ citas: [{ haceHoras: -3, estado: 'noshow' }] });

  const r = await leer();
  assert.equal(filaDe(r, planton)?.planton, true);
  assert.equal(filaDe(r, planton)?.asistencia, 'sin_registrar', 'el plantón del calendario se sumó a la asistencia');
  assert.equal(r.todos.asistieron, 0);
});

// ─── LA VENTA ────────────────────────────────────────────────────────────────

test('sin ninguna venta en la empresa, el cierre y el monto son nulos con su motivo, no 0 %', async () => {
  /* Es el caso de hoy en producción. Un «0 %» en cada tarjeta se leería como «ningún cuadrante compra»;
     lo cierto es que nadie registró una venta. */
  await limpiar();
  await sinVentasAjenas();
  for (let i = 0; i < PISO_DE_UNA_TASA + 2; i += 1) await unContacto({ cuadrante: 'prioriza' });

  const r = await leer();
  assert.equal(r.hayVentasRegistradas, false);
  for (const t of [...r.cuadrantes, r.todos]) {
    assert.equal(t.cierre, null, `«${t.rotulo}» publicó un cierre sin ninguna venta registrada`);
    assert.equal(t.porQueSinCierre, 'sin_ventas_registradas');
    assert.equal(t.montoReportado, null, `«${t.rotulo}» publicó un monto sin ninguna venta`);
    assert.equal(t.porQueSinMonto, 'sin_ventas_registradas');
  }
});

test('un acuerdo sin pago no es una venta', async () => {
  await limpiar();
  await sinVentasAjenas();
  const acuerdo = await unContacto({ resultados: [{ salida: 'acuerdo_sin_pago', monto: 500 }] });

  const r = await leer();
  assert.equal(filaDe(r, acuerdo)?.vendio, false, 'un acuerdo sin pago contó como venta');
  assert.equal(filaDe(r, acuerdo)?.monto, null, 'el monto de un acuerdo sin pago se sumó como reportado');
  assert.equal(r.todos.vendidos, 0);
  assert.equal(r.hayVentasRegistradas, false);
});

test('con ventas en la empresa: el piso, el cero medido, y el monto reportado', async () => {
  await limpiar();
  await sinVentasAjenas();
  /* Prioriza: once personas, dos venden (una con monto y otra sin). Pasa el piso. */
  await unContacto({ cuadrante: 'prioriza', resultados: [{ salida: 'venta', monto: 1000 }, { salida: 'venta', monto: 250.5 }] });
  const sinMonto = await unContacto({ cuadrante: 'prioriza', resultados: [{ salida: 'venta', monto: null }] });
  for (let i = 0; i < 9; i += 1) await unContacto({ cuadrante: 'prioriza' });
  /* Valida: diez personas y ninguna venta. Pasa el piso: su 0 % es un hecho. */
  for (let i = 0; i < PISO_DE_UNA_TASA; i += 1) await unContacto({ cuadrante: 'valida' });
  /* Financia: tres personas, una vende. No pasa el piso. */
  await unContacto({ cuadrante: 'financia', resultados: [{ salida: 'venta', monto: 300 }] });
  await unContacto({ cuadrante: 'financia' });
  await unContacto({ cuadrante: 'financia' });

  const r = await leer();
  const alto = cuadrante(r, 'prioriza');
  const medio = cuadrante(r, 'valida');
  const bajo = cuadrante(r, 'financia');
  assert.equal(r.hayVentasRegistradas, true);

  assert.equal(alto.vendidos, 2, 'dos ventas de la misma persona se contaron como dos personas');
  assert.equal(alto.cierre, 2 / 11);
  assert.equal(alto.montoReportado, 1250.5);
  assert.equal(alto.ventasSinMonto, 1);
  assert.equal(filaDe(r, sinMonto)?.monto, null, 'una venta sin monto se mostró como $0');
  assert.equal(filaDe(r, sinMonto)?.vendio, true);

  assert.equal(medio.cierre, 0, 'con ventas en la empresa, un cuadrante sobre el piso sin ventas es un 0 % medido');
  assert.equal(medio.porQueSinCierre, null);
  assert.equal(medio.montoReportado, 0, 'con ventas en la empresa, un cuadrante sin ventas reportó un nulo en vez de 0');

  assert.equal(bajo.cierre, null, 'con tres personas, una venta publicó un 33 %');
  assert.equal(bajo.porQueSinCierre, 'bajo_el_piso');
  assert.equal(bajo.montoReportado, 300, 'el monto no lleva piso: es una suma');

  assert.equal(r.todos.vendidos, 3);
  assert.equal(r.todos.montoReportado, 1550.5);
  assert.match(String(r.aviso), /no tienen el monto cargado/);
  assert.match(String(r.aviso), /no un pago verificado/);
});

test('un cuadrante con ventas y ningún monto cargado dice por qué, en vez de reportar $0', async () => {
  await limpiar();
  await sinVentasAjenas();
  await unContacto({ cuadrante: 'prioriza', resultados: [{ salida: 'venta', monto: null }] });

  const r = await leer();
  assert.equal(cuadrante(r, 'prioriza').montoReportado, null);
  assert.equal(cuadrante(r, 'prioriza').porQueSinMonto, 'ventas_sin_monto');
});

// ─── LA FILA ─────────────────────────────────────────────────────────────────

test('«ICP_Rechazado» marca al descartado aunque venga con otra caja, y no lo saca de la cohorte', async () => {
  await limpiar();
  const rechazado = await unContacto({ etiquetas: ['ICP_Rechazado'] });
  const otro = await unContacto({ etiquetas: ['vip'] });
  // Desde la `105`, el cuadrante Descarta también es un descarte.
  const enDescarta = await unContacto({ cuadrante: 'descarta' });

  const r = await leer();
  assert.equal(filaDe(r, rechazado)?.descartado, true, 'la etiqueta con mayúsculas no se reconoció');
  assert.equal(filaDe(r, otro)?.descartado, false);
  assert.equal(filaDe(r, enDescarta)?.descartado, true, 'el cuadrante Descarta no marcó el descarte');
  assert.equal(r.cohorte.total, 3, 'el descartado salió de la cohorte: es un atributo de la fila, no un filtro');
});

test('la fila trae exactamente sus trece claves: ni teléfono, ni correo, ni atribución cruda, ni el puntaje', async () => {
  /* «Exactamente» y no «no contiene»: una clave nueva tiene que poner esto en rojo aunque hoy no esté
     prohibida. El contacto sembrado TIENE teléfono, correo, atribución con IP y etiquetas: si alguna
     se colara, está ahí para colarse. */
  await limpiar();
  const id = await unContacto({
    etiquetas: ['vip'],
    atribucion: { campaign: 'Campaña X', utmContent: 'Pieza 3', ip: '203.0.113.9', fbclid: 'abc' },
  });

  const r = await leer();
  const fila = filaDe(r, id)!;
  assert.deepEqual(Object.keys(fila).sort(), [...CLAVES_DE_LA_FILA].sort());
  assert.equal(fila.campana, 'Campaña X');
  assert.equal(fila.creativo, 'Pieza 3');
  assert.equal(fila.territorio, 'closer');
  assert.ok(!JSON.stringify(r).includes('203.0.113.9'), 'la IP de la atribución viajó en la respuesta');
  assert.ok(!JSON.stringify(r).includes('ejemplo.test'), 'el correo viajó en la respuesta');
});

test('un origen vacío llega como nulo, y un congelado se dice congelado', async () => {
  await limpiar();
  const id = await unContacto({ territorio: null, atribucion: { campaign: '  ', utmContent: '' } });

  const r = await leer();
  assert.equal(filaDe(r, id)?.campana, null, 'un origen vacío no puede llegar como texto: la tarjeta lo dibuja como si hubiera');
  assert.equal(filaDe(r, id)?.creativo, null);
  assert.equal(filaDe(r, id)?.territorio, 'congelado');
});
