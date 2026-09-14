// La tasa de cancelación, y sobre qué citas se cuenta. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA CIFRA QUE ESTAS PRUEBAS EXISTEN PARA NO DAR
//
// El 2026-09-13 se reportó «160 de 316 citas canceladas, el 50,6 %». Estaba sesgado a la baja, y el
// modo en que apareció es lo que hay que fijar: la tasa subía hacia el presente —61,9 % a siete
// días, 60,1 % a catorce, 52,9 % a treinta, 50,6 % en total— y eso se parece a una tendencia.
//
// No lo era. Partiendo la población:
//
//     con calendario (el barrido las alcanza)   199 citas   120 canceladas   60,3 %
//     congeladas (anteriores a la 038)          101 citas    31 canceladas   30,7 %
//
// Las congeladas tienen `ghl_calendario_id` nulo y el CRM ya no devuelve sus eventos, así que su
// estado quedó detenido. Mezclarlas produce un número más bajo, estable y falso.
//
// Por eso la prueba que más importa de este archivo **no es la que comprueba la tasa**: es la que
// mete una congelada CANCELADA dentro de la ventana y exige que no cuente. Con las dos poblaciones
// del mismo signo, cualquier implementación pasaría.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { DIAS_DE_LA_TASA, tasaDeCancelacion } from '../../lib/negocio/indicadoresDeCitas.ts';

let admin: Client;
let alfa: string;
let contacto: string;

const MARCA = 'tasa-cancel';

before(async () => {
  admin = await conectar('admin');
  const o = await filas<{ id: string }>(admin, `select id from identidad.organizaciones where slug='alfa'`);
  assert.equal(o.length, 1, 'falta la organización cliente del sembrado');
  alfa = o[0]!.id;
  await limpiarTodo();
  contacto = await conOrganizacion(alfa, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({ ghl_contact_id: `${MARCA}-c`, nombre: 'Contacto de la tasa', territorio: 'closer' } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.id;
  });
});

after(async () => {
  await limpiarTodo();
  await cerrarTodo();
  await cerrarClientes();
});

/** Entre pruebas se van las CITAS y no el contacto: del contacto cuelga la clave foránea. */
async function limpiar(): Promise<void> {
  await conOrganizacion(alfa, () => datos().deleteFrom('citas').execute());
}

/** Al final sí, todo. Va en el `after` y no entre pruebas, por el mismo motivo. */
async function limpiarTodo(): Promise<void> {
  await conOrganizacion(alfa, async () => {
    await datos().deleteFrom('citas').execute();
    await datos().deleteFrom('contactos').where('ghl_contact_id', 'like', `${MARCA}%`).execute();
  });
}

/**
 * Una cita en la tabla. `calendario: null` la vuelve **congelada** — el estado que tienen las 101
 * anteriores a la `038`, cuyos eventos el CRM ya no devuelve.
 */
async function cita(
  haceDias: number,
  estado: string | null,
  calendario: string | null = 'cal1',
  extra: { reservadaHorasAntes?: number; reagendada?: boolean } = {},
): Promise<void> {
  const inicio = new Date(Date.now() - haceDias * 86_400_000);
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('citas')
      .values({
        ghl_evento_id: `${MARCA}-${randomUUID().slice(0, 8)}`,
        contacto_id: contacto,
        inicio_el: inicio,
        estado_ghl: estado,
        ghl_calendario_id: calendario,
        reservada_el:
          extra.reservadaHorasAntes === undefined
            ? null
            : new Date(inicio.getTime() - extra.reservadaHorasAntes * 3_600_000),
        reagendada_el: extra.reagendada ? new Date(inicio.getTime() - 3_600_000) : null,
      } as never)
      .execute();
  });
}

const leer = (dias?: number) => conOrganizacion(alfa, () => tasaDeCancelacion(dias));

// ─── La tasa ────────────────────────────────────────────────────────────────

test('la tasa se calcula sobre las citas de la ventana, y redondea a un decimal', async () => {
  await limpiar();
  await cita(1, 'cancelled');
  await cita(2, 'cancelled');
  await cita(3, 'confirmed');

  const t = await leer();
  assert.equal(t.citas, 3);
  assert.equal(t.canceladas, 2);
  assert.equal(t.tasa, 66.7, 'la tasa no es la de las citas de la ventana');
  assert.equal(t.aviso, null, 'avisó sin tener nada que advertir: un cartel que aparece siempre se ignora');
});

test('LA QUE DECIDE: una congelada CANCELADA dentro de la ventana no cuenta, y se declara', async () => {
  /* ── POR QUÉ ÉSTA ES LA PRUEBA DEL ARCHIVO ────────────────────────────────
   *
   * Las 101 citas congeladas tienen una tasa de cancelación MUY distinta de las vivas —30,7 % contra
   * 60,3 %— así que mezclarlas mueve el número. Pero el defecto no se ve con poblaciones parecidas:
   * acá la congelada es cancelada y las vivas no, para que incluirla cambie la tasa de 0 a 50 y
   * cualquier implementación que las sume falle.
   *
   * Y la segunda mitad importa igual: la cifra vale, pero **hay que decir sobre cuántas no se
   * contó**. Una tasa correcta con una exclusión callada es una tasa que nadie puede auditar. */
  await limpiar();
  await cita(1, 'confirmed');
  await cita(2, 'confirmed');
  await cita(3, 'cancelled', null); // congelada Y cancelada

  const t = await leer();
  assert.equal(t.citas, 2, 'la congelada entró al conteo');
  assert.equal(t.canceladas, 0, 'se contó como cancelada una cita cuyo estado quedó detenido');
  assert.equal(t.tasa, 0);
  assert.equal(t.congeladas, 1, 'no se contaron las congeladas de la ventana');
  assert.ok(t.aviso, 'se excluyó una cita y no se dijo: la tasa no se puede auditar');
  assert.match(t.aviso, /congelad/i);
});

test('fuera de la ventana no cuenta, ni siquiera una cancelada', async () => {
  /* Catorce días y no treinta, y el motivo es el mismo sesgo: más atrás, mayor es la proporción de
     citas que el sistema dejó de mirar. Una ventana más vieja no es una muestra más grande. */
  await limpiar();
  await cita(1, 'confirmed');
  await cita(DIAS_DE_LA_TASA + 2, 'cancelled');

  const t = await leer();
  assert.equal(t.citas, 1, 'entró una cita de fuera de la ventana');
  assert.equal(t.tasa, 0);
});

test('una cita FUTURA no cuenta: todavía no pudo cancelarse ni ocurrir', async () => {
  /* Sin el tope de arriba, las citas de los próximos 45 días —que el barrido trae— entrarían al
     denominador como si ya hubieran pasado, y la tasa saldría diluida por citas que no tuvieron
     oportunidad de cancelarse. */
  await limpiar();
  await cita(1, 'cancelled');
  await cita(-5, 'confirmed'); // dentro de cinco días

  const t = await leer();
  assert.equal(t.citas, 1, 'una cita futura entró al denominador');
  assert.equal(t.tasa, 100);
});

// ─── El silencio, y los dos ceros ───────────────────────────────────────────

test('sin citas alcanzables la tasa es NULA, nunca 0 %', async () => {
  /* Un `0 %` con cero citas se lee como «no se cancela ninguna»: una afirmación sobre el negocio
     hecha con cero datos. Es el cero indistinguible que este proyecto persigue en todas partes. */
  await limpiar();
  const t = await leer();
  assert.equal(t.citas, 0);
  assert.equal(t.tasa, null, 'con cero citas se devolvió una tasa: eso afirma algo que nadie midió');
  assert.ok(t.aviso, 'el vacío sin explicación se lee como un cero');
});

test('sin citas vivas pero CON congeladas, el vacío dice cuál de los dos ceros es', async () => {
  /* Los dos ceros: «no hubo citas» y «las que hubo ya no se pueden seguir». Se ven igual en pantalla
     y significan cosas opuestas — uno es una semana tranquila, el otro es un agujero de datos. */
  await limpiar();
  await cita(2, 'cancelled', null);

  const t = await leer();
  assert.equal(t.citas, 0);
  assert.equal(t.tasa, null);
  assert.equal(t.congeladas, 1);
  assert.match(t.aviso ?? '', /congelad/i, 'el cero no distingue «no hubo citas» de «no se pueden seguir»');
  assert.doesNotMatch(t.aviso ?? '', /No hubo citas/i);
});

test('el estado cancelado se reconoce sin distinguir caja', async () => {
  // El CRM manda `cancelled` y también `CANCELLED`, medido. Un `=` desnudo perdería la mitad.
  await limpiar();
  await cita(1, 'CANCELLED');
  await cita(2, 'confirmed');

  assert.equal((await leer()).tasa, 50, 'un estado en mayúsculas no se reconoció como cancelada');
});

// ─── El reagendamiento ──────────────────────────────────────────────────────

test('la tasa de reagendamiento cuenta sobre las MISMAS citas que la de cancelación', async () => {
  /* Las dos comparten denominador a propósito: son dos cosas que le pasan a la misma población, y
     con denominadores distintos nadie podría sumarlas ni compararlas. Medido en la ventana el
     2026-09-14: 11 de 151, el 7,3 %. */
  await limpiar();
  await cita(1, 'confirmed', 'cal1', { reagendada: true });
  await cita(2, 'confirmed');
  await cita(3, 'cancelled');
  await cita(4, 'confirmed');

  const t = await leer();
  assert.equal(t.citas, 4);
  assert.equal(t.reagendadas, 1);
  assert.equal(t.tasaDeReagendamiento, 25);
  assert.equal(t.tasa, 25, 'las dos tasas tienen que salir del mismo denominador');
});

test('una congelada reagendada tampoco cuenta', async () => {
  // La misma exclusión que la cancelación, por el mismo motivo: su estado quedó detenido.
  await limpiar();
  await cita(1, 'confirmed');
  await cita(2, 'confirmed', null, { reagendada: true });

  const t = await leer();
  assert.equal(t.citas, 1);
  assert.equal(t.reagendadas, 0, 'una cita congelada entró al conteo de reagendadas');
});

// ─── El tiempo hasta la cita ────────────────────────────────────────────────

test('LA MEDIANA Y NO EL PROMEDIO: una cita reservada con meses de anticipación no corre la cifra', async () => {
  /* ── POR QUÉ ESTA PRUEBA EXISTE ───────────────────────────────────────────
   *
   * Con promedio, una sola cita reservada con dos meses de anticipación mueve la cifra decenas de
   * horas y deja de describir a las demás. Medido en producción: la mediana es 49,2 h y el promedio
   * 63,5 h — o sea que la cola larga ya existe hoy, no es un caso inventado.
   *
   * El fixture lo fuerza: tres citas reservadas con 24, 48 y 1440 horas de anticipación. La mediana
   * es 48; el promedio sería 504. */
  await limpiar();
  await cita(1, 'confirmed', 'cal1', { reservadaHorasAntes: 24 });
  await cita(2, 'confirmed', 'cal1', { reservadaHorasAntes: 48 });
  await cita(3, 'confirmed', 'cal1', { reservadaHorasAntes: 1440 });

  const t = await leer();
  assert.equal(t.conFechaDeReserva, 3);
  assert.equal(t.horasHastaLaCita, 48, 'la cifra es el promedio: una cita lejana la corrió');
});

test('sin ninguna fecha de reserva la mediana es NULA, no cero', async () => {
  /* Un cero significaría «se reservan y ocurren en el mismo instante», que es una afirmación sobre el
     negocio. Las citas anteriores a la 043 no tienen la fecha, así que el caso es real. */
  await limpiar();
  await cita(1, 'confirmed');
  await cita(2, 'cancelled');

  const t = await leer();
  assert.equal(t.conFechaDeReserva, 0);
  assert.equal(t.horasHastaLaCita, null, 'sin fechas de reserva se devolvió una mediana');
  assert.equal(t.citas, 2, 'la falta de fecha de reserva no tiene que sacar la cita de las otras cifras');
});

test('las citas SIN fecha de reserva no entran a la mediana, pero sí a las tasas', async () => {
  /* Las tres cifras miran la misma población y sólo ésta tiene un hueco propio. Sacar la cita
     entera de todo por no tener una fecha haría que las tasas cambiaran según una columna que no
     tiene nada que ver con ellas. */
  await limpiar();
  await cita(1, 'confirmed', 'cal1', { reservadaHorasAntes: 10 });
  await cita(2, 'cancelled'); // sin fecha de reserva

  const t = await leer();
  assert.equal(t.citas, 2, 'la cita sin fecha de reserva salió del denominador de las tasas');
  assert.equal(t.tasa, 50);
  assert.equal(t.conFechaDeReserva, 1);
  assert.equal(t.horasHastaLaCita, 10, 'la cita sin fecha entró a la mediana');
});

// ─── El no-show, que es un CONTEO y no una tasa ─────────────────────────────

test('el no-show viaja como CONTEO: con dos eventos una tasa no es una tasa', async () => {
  /* Medido el 2026-09-14: 2 no-shows en catorce días sobre 6 resultados. Una tasa sobre dos eventos
     se mueve cincuenta puntos con el próximo registro.
     Y su denominador tampoco sería el de las citas: un resultado es un INTENTO del closer, que no es
     lo mismo que una cita — así que dividirlo por `citas` daría un número con dos poblaciones
     distintas arriba y abajo. */
  await limpiar();
  await cita(1, 'confirmed');
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('resultados')
      .values([
        { contacto_id: contacto, salida: 'no_show', rol: 'closer' },
        { contacto_id: contacto, salida: 'no_show', rol: 'closer' },
        { contacto_id: contacto, salida: 'venta', rol: 'closer' },
      ] as never)
      .execute();
  });

  const t = await leer();
  assert.equal(t.noShowReportado, 2, 'no se contaron los no-shows reportados');
  assert.ok(
    !Object.keys(t).some((k) => /noShow.*[Tt]asa|tasa.*[Nn]oShow/.test(k)),
    'apareció una TASA de no-show: con dos eventos eso no es una tasa',
  );
});
