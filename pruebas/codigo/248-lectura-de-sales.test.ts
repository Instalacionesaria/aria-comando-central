// La mitad pura de la lectura de Sales: las cuatro cifras, la tabla, los motivos y la tarjeta de abajo. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, SA-1)
//
// `armarSales` y `repartirMotivos` deciden qué número va en cada lugar del prototipo y, cuando no hay número, por
// qué. Cada prueba dice qué mira y la mutación que la pone en rojo:
//
//   · sin closers o sin ningún resultado, ventas y revenue son «—» con su motivo, y con resultados sin ventas son
//     cero — mutación: publicar el cero siempre, o confundir los dos motivos;
//   · la tasa de cierre respeta el piso de intentos — mutación: sacar el piso;
//   · la asistencia sin citas o sin respuestas es «—», no cero — mutación: publicar `sePresentaron` siempre;
//   · el revenue suma los montos de las filas, en centavos, y una venta sin monto lo deja en «—» — mutación:
//     contar ventas en vez de montos, o sumar la venta sin monto como cero;
//   · la tabla lleva las seis columnas, cada una con su motivo, y una fila con intentos y sin ventas dice cero —
//     mutación: confundir los ejes, o mirar las ventas en vez de los intentos;
//   · los motivos siguen el catálogo de Avanzar y lo demás va aparte — mutación: repartir lo de afuera;
//   · «{N} sin venta» son los intentos que no fueron venta — mutación: contar sólo los «No le interesa»;
//   · la cancelación de la tarjeta va de 0 a 1 — mutación: dejarla de 0 a 100.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import type { CadenaDeCierre } from '../../lib/negocio/cadenaDeCierre.ts';
import type { CicloHastaLaCita } from '../../lib/negocio/cicloHastaLaCita.ts';
import type { CierreDeLosClosers, CierreDeUnCloser } from '../../lib/negocio/cierrePorCloser.ts';
import type { Cancelacion } from '../../lib/negocio/indicadoresDeCitas.ts';
import { armarSales, type EntradaDeSales } from '../../lib/negocio/lecturaDeSales.ts';
import { MOTIVOS_DE_NO_VENTA, repartirMotivos } from '../../lib/negocio/motivosDeNoVenta.ts';

function unCloser(o: Partial<CierreDeUnCloser> & { usuarioId: string }): CierreDeUnCloser {
  return {
    nombre: `Closer ${o.usuarioId}`,
    crmUsuarioId: `crm-${o.usuarioId}`,
    contactos: 10,
    citas: 12,
    canceladas: 3,
    tasaDeCancelacion: 0.25,
    conAsistencia: 0,
    sePresentaron: 0,
    tasaDeAsistencia: null,
    noShowDelCalendario: 1,
    intentos: 0,
    porSalida: {},
    ventas: 0,
    montoDeVentas: 0,
    ventasSinMonto: 0,
    tasaDeCierre: null,
    aviso: null,
    ...o,
  };
}

function entrada(o: { filas?: CierreDeUnCloser[]; cancelacion?: Partial<Cancelacion> } = {}): EntradaDeSales {
  return {
    cancelacion: { citas: 40, canceladas: 14, tasa: 35, conAsistencia: 0, sePresentaron: 0, aviso: null, ...o.cancelacion } as Cancelacion,
    cadena: { coberturaDeLaCohorte: { con: 596, sobre: 620 } } as CadenaDeCierre,
    ciclo: { p50: 2.3, p90: 6.1, cobertura: { con: 139, sobre: 277 }, avisoDelTecho: null, aviso: null } as CicloHastaLaCita,
    closers: { filas: o.filas ?? [], coberturaDeLaTabla: { con: 95, sobre: 106 }, aviso: 'aviso de la tabla' } as CierreDeLosClosers,
    motivos: repartirMotivos(30, []),
  };
}

test('sin ningún resultado, ventas y revenue son «—» con su motivo; con resultados sin ventas, cero medido', () => {
  const vacia = armarSales(entrada({ filas: [unCloser({ usuarioId: 'a' }), unCloser({ usuarioId: 'b' })] }));
  assert.deepEqual(vacia.cifras.ventas, { valor: null, motivo: 'sin_registros' });
  assert.deepEqual(vacia.cifras.revenue, { valor: null, motivo: 'sin_registros' });
  assert.deepEqual(vacia.cifras.tasaDeCierre, { valor: null, motivo: 'sin_registros' });

  const conUno = armarSales(entrada({ filas: [unCloser({ usuarioId: 'a', intentos: 1, porSalida: { no_show: 1 } }), unCloser({ usuarioId: 'b' })] }));
  assert.deepEqual(conUno.cifras.ventas, { valor: 0, motivo: null }, 'con un resultado, cero ventas es un hecho');
  assert.deepEqual(conUno.cifras.revenue, { valor: 0, motivo: null });
  assert.deepEqual(conUno.cifras.tasaDeCierre, { valor: null, motivo: 'bajo_el_piso' }, 'un intento no alcanza para una tasa');

  /* Sin closers configurados no es que nadie registró: no hay de quién (como `dineroDelMes`, que separa los dos). */
  const sinClosers = armarSales(entrada());
  for (const k of ['ventas', 'revenue', 'tasaDeCierre'] as const) {
    assert.deepEqual(sinClosers.cifras[k], { valor: null, motivo: 'sin_closers' }, `${k} sin closers no dice por qué`);
  }
});

test('la tasa de cierre es ventas sobre intentos, desde el piso de diez', () => {
  const nueve = armarSales(entrada({ filas: [unCloser({ usuarioId: 'a', intentos: 9, ventas: 3 })] }));
  assert.deepEqual(nueve.cifras.tasaDeCierre, { valor: null, motivo: 'bajo_el_piso' });
  const doce = armarSales(entrada({ filas: [unCloser({ usuarioId: 'a', intentos: 8, ventas: 2 }), unCloser({ usuarioId: 'b', intentos: 4, ventas: 1 })] }));
  assert.equal(doce.cifras.tasaDeCierre.valor, 3 / 12, 'la tasa de la fila de cifras suma los intentos de todos los closers');
  assert.equal(doce.cifras.ventas.valor, 3);
});

test('la asistencia sin respuestas es «—»; con respuestas, los que se presentaron', () => {
  assert.deepEqual(armarSales(entrada()).cifras.asistencias, { valor: null, motivo: 'sin_asistencia' });
  // Sin ninguna cita en la ventana no es que nadie marcó: no hubo a quién.
  assert.deepEqual(armarSales(entrada({ cancelacion: { citas: 0, canceladas: 0, tasa: null } })).cifras.asistencias, { valor: null, motivo: 'sin_citas' });
  const respondidas = armarSales(entrada({ cancelacion: { conAsistencia: 6, sePresentaron: 4 } }));
  assert.deepEqual(respondidas.cifras.asistencias, { valor: 4, motivo: null });
});

test('el revenue suma los montos reportados de las filas, no las ventas', () => {
  const p = armarSales(entrada({
    filas: [
      unCloser({ usuarioId: 'a', intentos: 3, ventas: 2, montoDeVentas: 1500 }),
      unCloser({ usuarioId: 'b', intentos: 2, ventas: 1, montoDeVentas: 800 }),
    ],
  }));
  assert.deepEqual(p.cifras.revenue, { valor: 2300, motivo: null });

  // La suma va en centavos: la de JavaScript dejaría una cola de coma flotante en lo que lee el cerebro.
  const centavos = armarSales(entrada({
    filas: [unCloser({ usuarioId: 'a', intentos: 1, ventas: 1, montoDeVentas: 0.1 }), unCloser({ usuarioId: 'b', intentos: 1, ventas: 1, montoDeVentas: 0.2 })],
  }));
  assert.equal(centavos.cifras.revenue.valor, 0.3);

  // Una venta sin monto no suma como cero: el revenue sería más chico que lo reportado.
  const sinMonto = armarSales(entrada({
    filas: [unCloser({ usuarioId: 'a', intentos: 2, ventas: 2, montoDeVentas: 1500, ventasSinMonto: 1 }), unCloser({ usuarioId: 'b', intentos: 1, ventas: 1, montoDeVentas: 800 })],
  }));
  assert.deepEqual(sinMonto.cifras.revenue, { valor: null, motivo: 'venta_sin_monto' });
  assert.deepEqual(sinMonto.closers.filas[0]!.revenue, { valor: null, motivo: 'venta_sin_monto' });
  assert.deepEqual(sinMonto.closers.filas[1]!.revenue, { valor: 800, motivo: null });
  assert.equal(sinMonto.cifras.ventas.valor, 3, 'la venta sin monto sigue siendo una venta');
});

test('la tabla lleva las seis columnas del prototipo, cada una con su eje y su motivo', () => {
  const p = armarSales(entrada({
    filas: [
      unCloser({ usuarioId: 'a', contactos: 22, citas: 30, conAsistencia: 0, intentos: 0 }),
      unCloser({ usuarioId: 'b', contactos: 66, citas: 90, conAsistencia: 5, sePresentaron: 3, intentos: 12, ventas: 4, montoDeVentas: 4000 }),
      unCloser({ usuarioId: 'c', crmUsuarioId: null, contactos: null, citas: null, conAsistencia: null, sePresentaron: null }),
      unCloser({ usuarioId: 'd', citas: 0, intentos: 3, ventas: 0, porSalida: { seguimiento: 3 } }),
    ],
  }));
  const [a, b, c, d] = p.closers.filas;
  assert.deepEqual([a!.contactos, a!.agendadas], [22, 30]);
  assert.deepEqual(a!.asistieron, { valor: null, motivo: 'sin_asistencia' });
  assert.deepEqual(a!.ventas, { valor: null, motivo: 'sin_registros' });
  assert.deepEqual(a!.revenue, { valor: null, motivo: 'sin_registros' });
  assert.deepEqual(b!.asistieron, { valor: 3, motivo: null });
  assert.deepEqual(b!.cierre, { valor: 4 / 12, motivo: null });
  assert.deepEqual(b!.revenue, { valor: 4000, motivo: null });
  // Sin vínculo con el CRM: «—» sin motivo; la nota de la fila dice por qué.
  assert.deepEqual([c!.agendadas, c!.asistieron], [null, { valor: null, motivo: null }]);
  // Con intentos y sin ventas, cero medido; sin citas, «—» porque no hubo.
  assert.deepEqual([d!.ventas, d!.revenue], [{ valor: 0, motivo: null }, { valor: 0, motivo: null }]);
  assert.deepEqual(d!.asistieron, { valor: null, motivo: 'sin_citas' });
  assert.equal(p.closers.aviso, 'aviso de la tabla');
});

test('los motivos siguen el catálogo de Avanzar, en su orden; lo que no casa va aparte y no se reparte', () => {
  assert.deepEqual([...MOTIVOS_DE_NO_VENTA], ['Precio', 'No es el momento', 'Competencia', 'No califica', 'Otro']);
  const m = repartirMotivos(30, [
    { detalle: 'Otro', n: 1 },
    { detalle: 'Precio', n: 3 },
    { detalle: 'Pidió tiempo', n: 2 },
    { detalle: null, n: 2 },
  ]);
  assert.equal(m.total, 8);
  assert.deepEqual(m.filas, [
    { motivo: 'Precio', resultados: 3, porcion: 3 / 8 },
    { motivo: 'Otro', resultados: 1, porcion: 1 / 8 },
  ]);
  assert.equal(m.fueraDelCatalogo, 4, '«Pidió tiempo» y los sin motivo no son del catálogo');
  assert.equal(m.porcionFueraDelCatalogo, 4 / 8);
  const vacios = repartirMotivos(7, []);
  assert.deepEqual([vacios.total, vacios.filas, vacios.porcionFueraDelCatalogo], [0, [], null]);
});

test('«{N} sin venta» son los intentos de los closers que no fueron venta', () => {
  const p = armarSales(entrada({
    filas: [
      unCloser({ usuarioId: 'a', intentos: 5, ventas: 1, porSalida: { venta: 1, no_interesa: 2, seguimiento: 2 } }),
      unCloser({ usuarioId: 'b', intentos: 2, ventas: 0, porSalida: { no_show: 2 } }),
    ],
  }));
  assert.equal(p.motivos.sinVenta, 6);
});

test('la tarjeta de abajo viaja de 0 a 1: la cancelación, las coberturas y la del ciclo', () => {
  const p = armarSales(entrada());
  assert.equal(p.comercial.cancelacion.tasa, 0.35, 'la función la da de 0 a 100; la pantalla, de 0 a 1');
  assert.deepEqual(p.comercial.cobertura.cohorte, { con: 596, sobre: 620, porcion: 596 / 620 });
  assert.deepEqual(p.comercial.cobertura.tabla, { con: 95, sobre: 106, porcion: 95 / 106 });
  assert.deepEqual(p.comercial.ciclo.cobertura, { con: 139, sobre: 277, porcion: 139 / 277 });
  const sinCitas = armarSales(entrada({ cancelacion: { citas: 0, canceladas: 0, tasa: null } }));
  assert.equal(sinCitas.comercial.cancelacion.tasa, null);
});
