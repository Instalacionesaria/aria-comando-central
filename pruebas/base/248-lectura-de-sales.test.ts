// La lectura de Sales y sus dos piezas nuevas, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, SA-1)
//
// La mitad pura la cuida `pruebas/codigo/248-lectura-de-sales.test.ts`. Acá se mira lo que sólo se ve con filas:
//
//   · los motivos cuentan los «No le interesa» de los closers configurados, en la ventana, por el catálogo, y lo
//     que no casa va aparte — mutaciones: sacar el filtro de salida, el de quién registró o el de la ventana;
//   · el monto de cada closer es la suma de SUS ventas —ni `venta_chica` ni `acuerdo_sin_pago`—, y la venta sin
//     monto se cuenta aparte — mutación: sumar el monto de todas las salidas, o de las que empiezan con «venta»;
//   · la lectura entera: sin ningún resultado, ventas y revenue son «—»; con resultados sin ventas, cero
//     medido; el revenue es el de la ventana y no el del mes; y la asistencia es la de la cancelación, con una
//     cita marcada de verdad — mutación: tomar el revenue de `dineroDelMes`, o publicar la asistencia sin mirar;
//   · los motivos de las llamadas cuentan las HT sin cierre de la ventana, una vez por categoría, y las que no
//     tienen ninguna objeción clasificada van aparte — mutaciones: sacar el filtro de resultado, de tipo o de la
//     ventana, contar objeciones en vez de llamadas, o casar la categoría sin mirar la huella.
//
// La organización `alfa` la comparten otras pruebas, así que lo que depende de TODA la empresa —la asistencia—
// se compara contra la función de la que sale, no contra un número fijo.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { closersDeLaEmpresa } from '../../lib/negocio/alcanceDelCloser.ts';
import { cierrePorCloser } from '../../lib/negocio/cierrePorCloser.ts';
import { lecturaDeSales } from '../../lib/negocio/lecturaDeSales.ts';
import { motivosDeNoVenta } from '../../lib/negocio/motivosDeNoVenta.ts';
import { motivosDeLasLlamadas } from '../../lib/negocio/motivosDeLasLlamadas.ts';
import { TABLAS_DEL_ANALIZADOR } from '../apoyo/analizador.ts';

let esc: Escenario;

const CONTACTO = 'lectura-sales-';
const CORREO = '@lectura-sales.ejemplo';
const CRM_A = 'crm-lectura-sales-a';
const CRM_B = 'crm-lectura-sales-b';

async function limpiar(): Promise<void> {
  const mios = 'select id from negocio.contactos where ghl_contact_id like $1';
  await esc.admin.query(`delete from negocio.resultados where contacto_id in (${mios})`, [`${CONTACTO}%`]);
  await esc.admin.query(`delete from negocio.citas where contacto_id in (${mios})`, [`${CONTACTO}%`]);
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${CONTACTO}%`]);
  await esc.admin.query('delete from negocio.closer_asignado where org_id = $1', [esc.org]);
  /* Las personas, DESPUÉS de las designaciones: la clave foránea las sostiene (la 165 lo explica). */
  await esc.admin.query('delete from identidad.usuarios where email like $1', [`%${CORREO}`]);
}

/** Una persona real de la organización: `closer_asignado` tiene clave foránea compuesta contra `usuarios`. */
async function unaPersona(nombre: string): Promise<string> {
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash, creado_por)
     values ($1, $2, $3, 'scrypt$16384$8$1$c2FsCg==$aGFzaAo=', null) returning id`,
    [esc.org, nombre, `${randomUUID().slice(0, 8)}${CORREO}`],
  );
  return rows[0]!.id;
}

async function designar(usuarioId: string, crmId: string | null, haceDias: number): Promise<void> {
  await esc.admin.query(
    `insert into negocio.closer_asignado (org_id, usuario_id, crm_usuario_id, actualizado_el, actualizado_por)
     values ($1, $2, $3, now() - make_interval(days => $4), null)`,
    [esc.org, usuarioId, crmId, haceDias],
  );
}

interface ResultadoSembrado {
  salida: string;
  registradoPor: string;
  monto?: number;
  detalle?: string | null;
  /** Hace cuántos días se registró. Por omisión, hace una hora. */
  haceDias?: number;
}

/** Un contacto asignado en el CRM a `crmAsignadoA`, con sus resultados. */
async function unContacto(crmAsignadoA: string | null, resultados: ResultadoSembrado[]): Promise<void> {
  const ghl = `${CONTACTO}${randomUUID().slice(0, 8)}`;
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos
       (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, crm_asignado_a, etiquetas)
     values ($1, $2, 'Lead de prueba', 'closer', now() - interval '2 days', $3, '{}'::text[])
     returning id`,
    [esc.org, ghl, crmAsignadoA],
  );
  for (const r of resultados) {
    await esc.admin.query(
      `insert into negocio.resultados (org_id, contacto_id, salida, rol, registrado_por, monto, detalle, creado_el)
         values ($1, $2, $3, 'closer', $4, $5, $6,
                 now() - interval '1 hour' - make_interval(days => $7))`,
      [esc.org, rows[0]!.id, r.salida, r.registradoPor, r.monto ?? null, r.detalle ?? null, r.haceDias ?? 0],
    );
  }
}

const enAlfa = <T>(f: () => Promise<T>) => conOrganizacion(esc.org, f);

before(async () => {
  esc = await montar('LecturaDeSales');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LOS MOTIVOS
// ═══════════════════════════════════════════════════════════════════════════════

test('los motivos cuentan los «No le interesa» de los closers, en la ventana, por el catálogo', async () => {
  await limpiar();
  const uno = await unaPersona('Closer uno');
  const ajeno = await unaPersona('No es closer');
  await designar(uno, CRM_A, 3);
  await unContacto(CRM_A, [
    { salida: 'no_interesa', registradoPor: uno, detalle: 'Precio' },
    { salida: 'no_interesa', registradoPor: uno, detalle: 'Precio' },
    { salida: 'no_interesa', registradoPor: uno, detalle: 'Otro' },
    { salida: 'no_interesa', registradoPor: uno, detalle: 'Pidió tiempo' },
    { salida: 'no_interesa', registradoPor: uno, detalle: null },
    // Lo que no cuenta: otra salida, alguien que no es closer, y uno fuera de la ventana.
    { salida: 'seguimiento', registradoPor: uno, detalle: 'Precio' },
    { salida: 'no_interesa', registradoPor: ajeno, detalle: 'Competencia' },
    { salida: 'no_interesa', registradoPor: uno, detalle: 'No califica', haceDias: 40 },
  ]);

  const m = await enAlfa(async () => motivosDeNoVenta(30, await closersDeLaEmpresa()));
  assert.equal(m.total, 5, 'el total cuenta otra salida, a quien no es closer o lo de afuera de la ventana');
  assert.deepEqual(
    m.filas.map((f) => [f.motivo, f.resultados]),
    [['Precio', 2], ['Otro', 1]],
    'los motivos no siguen el catálogo, o se colaron «Competencia» (no es closer) o «No califica» (hace 40 días)',
  );
  assert.equal(m.filas[0]!.porcion, 2 / 5);
  assert.equal(m.fueraDelCatalogo, 2, '«Pidió tiempo» y el que no trae motivo van aparte');

  const conLaVentanaLarga = await enAlfa(async () => motivosDeNoVenta(60, await closersDeLaEmpresa()));
  assert.deepEqual(conLaVentanaLarga.filas.map((f) => f.motivo), ['Precio', 'No califica', 'Otro']);
});

test('sin closers configurados no hay motivos que contar, ni consulta que falle', async () => {
  await limpiar();
  const m = await enAlfa(() => motivosDeNoVenta(30, []));
  assert.deepEqual([m.total, m.filas, m.fueraDelCatalogo], [0, [], 0]);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · EL MONTO DE CADA CLOSER
// ═══════════════════════════════════════════════════════════════════════════════

test('el monto de cada closer es la suma de sus ventas de la ventana, y nada más', async () => {
  await limpiar();
  const uno = await unaPersona('Closer uno');
  const dos = await unaPersona('Closer dos');
  await designar(uno, CRM_A, 3);
  await designar(dos, CRM_B, 2);
  await unContacto(CRM_A, [
    { salida: 'venta', registradoPor: uno, monto: 1200.5 },
    { salida: 'venta', registradoPor: uno, monto: 800 },
    { salida: 'venta', registradoPor: uno },
    { salida: 'seguimiento', registradoPor: uno, monto: 999 },
    { salida: 'venta_chica', registradoPor: uno, monto: 300 },
    { salida: 'acuerdo_sin_pago', registradoPor: uno, monto: 450 },
    { salida: 'venta', registradoPor: uno, monto: 5000, haceDias: 40 },
  ]);
  await unContacto(CRM_B, [{ salida: 'no_interesa', registradoPor: dos, detalle: 'Precio' }]);

  const r = await enAlfa(async () => cierrePorCloser(30, await closersDeLaEmpresa()));
  const [a, b] = r.filas;
  assert.equal(a!.montoDeVentas, 2000.5, 'el monto suma otra salida o una venta de afuera de la ventana');
  assert.equal(a!.ventas, 3);
  assert.equal(a!.ventasSinMonto, 1, 'la venta sin monto no se contó aparte');
  assert.equal(b!.ventasSinMonto, 0);
  assert.equal(b!.montoDeVentas, 0, 'sin ventas el monto es cero medido');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LA LECTURA ENTERA
// ═══════════════════════════════════════════════════════════════════════════════

test('sin ningún resultado, ventas y revenue son «—»; con uno sin venta, son cero medido', async () => {
  await limpiar();
  const uno = await unaPersona('Closer uno');
  await designar(uno, CRM_A, 3);

  const vacia = await enAlfa(() => lecturaDeSales(30, 'America/Lima'));
  assert.deepEqual(vacia.pantalla.cifras.ventas, { valor: null, motivo: 'sin_registros' });
  assert.deepEqual(vacia.pantalla.cifras.revenue, { valor: null, motivo: 'sin_registros' });

  await unContacto(CRM_A, [{ salida: 'no_interesa', registradoPor: uno, detalle: 'Otro' }]);
  const conUno = await enAlfa(() => lecturaDeSales(30, 'America/Lima'));
  assert.deepEqual(conUno.pantalla.cifras.ventas, { valor: 0, motivo: null });
  assert.deepEqual(conUno.pantalla.cifras.revenue, { valor: 0, motivo: null });
  assert.equal(conUno.pantalla.registrados.total, 1);
  assert.equal(conUno.pantalla.registrados.sinVenta, 1);
  assert.equal(conUno.pantalla.closers.filas.length, 1);
});

test('con ventas, la lectura publica las ventas y el monto reportado de los closers', async () => {
  await limpiar();
  const uno = await unaPersona('Closer uno');
  await designar(uno, CRM_A, 3);
  await unContacto(CRM_A, [
    { salida: 'venta', registradoPor: uno, monto: 1500 },
    { salida: 'no_interesa', registradoPor: uno, detalle: 'Precio' },
  ]);
  const l = await enAlfa(() => lecturaDeSales(30, 'America/Lima'));
  assert.deepEqual(l.pantalla.cifras.ventas, { valor: 1, motivo: null });
  assert.deepEqual(l.pantalla.cifras.revenue, { valor: 1500, motivo: null });
  assert.deepEqual(l.pantalla.cifras.tasaDeCierre, { valor: null, motivo: 'bajo_el_piso' });
  assert.deepEqual(l.pantalla.closers.filas[0]!.revenue, { valor: 1500, motivo: null });
});

test('el revenue es el de la ventana elegida, no el del mes calendario', async () => {
  /* Una venta de hace 40 días cae en una ventana de 60 y nunca en el mes en curso, que dura a lo sumo 31: si el
     revenue se tomara de `dineroDelMes`, no la contaría. */
  await limpiar();
  const uno = await unaPersona('Closer uno');
  await designar(uno, CRM_A, 3);
  await unContacto(CRM_A, [
    { salida: 'venta', registradoPor: uno, monto: 1500 },
    { salida: 'venta', registradoPor: uno, monto: 700, haceDias: 40 },
  ]);
  const l = await enAlfa(() => lecturaDeSales(60, 'America/Lima'));
  assert.deepEqual(l.pantalla.cifras.revenue, { valor: 2200, motivo: null });
  assert.deepEqual(l.pantalla.cifras.ventas, { valor: 2, motivo: null });
  assert.notEqual(l.dinero.cobrado.valor, 2200, 'el mes contó la venta de hace 40 días: la prueba no separa las dos ventanas');
});

test('la asistencia es la de la cancelación de la empresa, y la tarjeta de abajo la lleva de 0 a 1', async () => {
  await limpiar();
  /* Una cita ocurrida y marcada como presente: sin ella, `alfa` puede no tener ninguna y la comparación de abajo
     miraría sólo la rama de «Nadie marca la asistencia». */
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, crm_asignado_a, etiquetas)
     values ($1, $2, 'Lead de prueba', 'closer', now() - interval '2 days', $3, '{}'::text[]) returning id`,
    [esc.org, `${CONTACTO}${randomUUID().slice(0, 8)}`, CRM_A],
  );
  await esc.admin.query(
    `insert into negocio.citas (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl, asistio)
     values ($1, $2, $3, 'cal-lectura-sales', now() - interval '3 hours', now() - interval '2 hours', 'confirmed', true)`,
    [esc.org, rows[0]!.id, `cita-${randomUUID().slice(0, 8)}`],
  );
  const l = await enAlfa(() => lecturaDeSales(30, 'America/Lima'));
  const c = l.cancelacion;
  assert.ok(c.sePresentaron >= 1, 'la cita marcada no entró en la cancelación: la prueba no mira nada');
  assert.deepEqual(l.pantalla.cifras.asistencias, { valor: c.sePresentaron, motivo: null });
  assert.equal(l.pantalla.comercial.cancelacion.tasa, c.tasa === null ? null : c.tasa / 100);
  assert.equal(l.pantalla.comercial.cancelacion.citas, c.citas);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LOS MOTIVOS DE LAS LLAMADAS HT (S15-19)
// ═══════════════════════════════════════════════════════════════════════════════

/** Vacía los Analizadores de la organización, como la 230: las llamadas de otra prueba cambiarían los conteos. */
async function sinLlamadas(): Promise<void> {
  for (const t of TABLAS_DEL_ANALIZADOR) await esc.admin.query(`delete from negocio.${t} where org_id = $1`, [esc.org]);
}

/**
 * Una llamada analizada con su resultado y sus objeciones, cada una con la categoría que se le da. `vieja` siembra
 * la categoría con la huella de otro texto: la de un análisis que cambió, que ya no casa.
 */
async function unaLlamada(o: {
  tipo?: 'HT' | 'OB';
  resultado: 'CERRADA' | 'NO_CERRADA' | 'INDETERMINADO';
  haceDias?: number;
  objeciones?: { texto: string; categoria: string | null; vieja?: boolean }[];
}): Promise<void> {
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into negocio.analizador_llamadas (org_id, tipo, proveedor, estado, fecha_de_la_reunion)
     values ($1, $2, 'MANUAL', 'DONE', now() - make_interval(days => $3) - interval '1 hour') returning id`,
    [esc.org, o.tipo ?? 'HT', o.haceDias ?? 0],
  );
  const id = rows[0]!.id;
  const objeciones = o.objeciones ?? [];
  await esc.admin.query(
    `insert into negocio.analizador_analisis (org_id, llamada_id, tipo, coincide, resultado, analisis, modelo, version_de_rubrica)
     values ($1, $2, $3, true, $4, $5, 'claude-sonnet-5', 'rubric.es.md@v8.1')`,
    [esc.org, id, o.tipo ?? 'HT', o.resultado, JSON.stringify({ seller: { objections: objeciones.map((x) => ({ objection: x.texto, howHandled: '', howToRespond: '' })) } })],
  );
  for (const [i, x] of objeciones.entries()) {
    if (x.categoria === null) continue;
    await esc.admin.query(
      `insert into negocio.objeciones_clasificadas (org_id, llamada_id, indice, huella, categoria, modelo)
       values ($1, $2, $3, md5($4), $5, 'claude-haiku-5')`,
      [esc.org, id, i, x.vieja ? `${x.texto} (antes)` : x.texto, x.categoria],
    );
  }
}

test('los motivos cuentan las llamadas HT sin cierre de la ventana, una vez por categoría', async () => {
  await sinLlamadas();
  await unaLlamada({ resultado: 'NO_CERRADA', objeciones: [
    { texto: 'Es caro.', categoria: 'precio' },
    { texto: 'No me alcanza.', categoria: 'precio' },
    { texto: 'Lo hablo con mi socio.', categoria: 'decisor' },
  ] });
  await unaLlamada({ resultado: 'NO_CERRADA', objeciones: [{ texto: 'Muy caro para mí.', categoria: 'precio' }] });
  // Sin ninguna objeción clasificada: una sin objeciones, una sin categoría todavía y una con la categoría vieja.
  await unaLlamada({ resultado: 'NO_CERRADA' });
  await unaLlamada({ resultado: 'NO_CERRADA', objeciones: [{ texto: 'No sé si funciona.', categoria: null }] });
  await unaLlamada({ resultado: 'NO_CERRADA', objeciones: [{ texto: 'No es para mí.', categoria: 'encaje', vieja: true }] });
  // Lo que no cuenta: una cerrada, una indeterminada, una de onboarding y una de afuera de la ventana.
  await unaLlamada({ resultado: 'CERRADA', objeciones: [{ texto: 'Caro, pero dale.', categoria: 'precio' }] });
  await unaLlamada({ resultado: 'INDETERMINADO', objeciones: [{ texto: 'Caro.', categoria: 'precio' }] });
  await unaLlamada({ tipo: 'OB', resultado: 'NO_CERRADA', objeciones: [{ texto: 'Caro.', categoria: 'precio' }] });
  await unaLlamada({ resultado: 'NO_CERRADA', haceDias: 40, objeciones: [{ texto: 'Ahora no.', categoria: 'momento' }] });

  const m = await enAlfa(() => motivosDeLasLlamadas(30));
  await sinLlamadas();
  assert.equal(m.sinCierre, 5, 'el total cuenta una cerrada, una indeterminada, una de onboarding o una de afuera de la ventana');
  assert.deepEqual(
    m.filas.map((f) => [f.categoria, f.llamadas]),
    [['precio', 2], ['decisor', 1]],
    'una llamada con dos objeciones de precio contó dos veces, o se coló una llamada que no cuenta',
  );
  assert.equal(m.filas[0]!.porcion, 2 / 5);
  assert.equal(m.sinObjecion, 3, 'la llamada sin objeciones, la sin categoría o la de la categoría vieja no van aparte');
});

test('la lectura de la pantalla trae los motivos de las llamadas, y aparte lo que registraron los closers', async () => {
  await limpiar();
  await sinLlamadas();
  const uno = await unaPersona('Closer uno');
  await designar(uno, CRM_A, 3);
  await unContacto(CRM_A, [{ salida: 'no_interesa', registradoPor: uno, detalle: 'Precio' }]);
  // Hace cinco días: con la ventana de la lectura cae; con una de un día, no.
  await unaLlamada({ resultado: 'NO_CERRADA', haceDias: 5, objeciones: [{ texto: 'Ahora no puedo.', categoria: 'momento' }] });
  const l = await enAlfa(() => lecturaDeSales(30, 'America/Lima'));
  await sinLlamadas();
  assert.deepEqual([l.pantalla.motivos.sinCierre, l.pantalla.motivos.filas.map((f) => f.categoria)], [1, ['momento']]);
  assert.deepEqual([l.pantalla.registrados.total, l.pantalla.registrados.filas.map((f) => f.motivo)], [1, ['Precio']]);
});
