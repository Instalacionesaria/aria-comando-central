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
import {
  CAMPO_DE_CONFIRMACION,
  DIAS_DE_LA_TASA,
  PISO_DE_UNA_TASA,
  tasaDeCancelacion,
} from '../../lib/negocio/indicadoresDeCitas.ts';
import { DIAS_DE_TODO } from '../../lib/negocio/periodo.ts';

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
  extra: { reservadaHorasAntes?: number; reagendada?: boolean; asistio?: boolean } = {},
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
        /* `undefined` deja la columna en nulo, que es «nadie lo dijo» — el estado de toda cita
           anterior a la `049` y de toda cita cuyo intento no se cerró. */
        asistio: extra.asistio ?? null,
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

// ─── La asistencia (migración `049`) ────────────────────────────────────────

test('EL DEFECTO QUE HUNDIRÍA LA CIFRA: las citas sin responder NO son plantones', async () => {
  /* ═══════════════════════════════════════════════════════════════════════════
   * El nulo de `asistio` es «nadie lo dijo todavía», y ése es el caso NORMAL: ninguna cita anterior
   * a la `049` lo va a tener nunca, y las nuevas sólo cuando alguien cierre el intento.
   *
   * Si el denominador fueran todas las citas alcanzables en vez de las respondidas, la tasa diría
   * que no se presenta casi nadie — una cifra plausible, alarmante y falsa, calculada sobre gente
   * que sí vino. Es el mismo cero indistinguible que este archivo persigue en la cancelación.
   * ═══════════════════════════════════════════════════════════════════════════ */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await cita(1, 'confirmed', 'cal1', { asistio: true });
  // Y veinte que nadie cerró. Si contaran, la tasa caería de 100 a 33,3.
  for (let i = 0; i < 20; i++) await cita(1, 'confirmed');

  const r = await leer();
  assert.equal(r.conAsistencia, PISO_DE_UNA_TASA, 'el denominador dejó de ser «las respondidas»');
  assert.equal(r.sePresentaron, PISO_DE_UNA_TASA);
  assert.equal(
    r.tasaDeAsistencia,
    100,
    'las citas que nadie cerró entraron al denominador y hundieron la cifra',
  );
});

test('por debajo del piso NO hay tasa, y el aviso dice por qué', async () => {
  /* Una tasa sobre pocos eventos no es una tasa: se mueve más de diez puntos con el próximo
     registro. Es exactamente el motivo por el que el no-show de más arriba se declara como CONTEO,
     y acá se resuelve callando en vez de publicando. */
  await limpiar();
  await cita(1, 'confirmed', 'cal1', { asistio: true });
  await cita(2, 'confirmed', 'cal1', { asistio: false });
  for (let i = 0; i < 8; i++) await cita(3, 'confirmed');

  const r = await leer();
  assert.equal(r.conAsistencia, 2);
  assert.equal(r.sePresentaron, 1);
  assert.equal(r.tasaDeAsistencia, null, 'publicó un 50 % construido sobre dos registros');
  assert.match(String(r.avisoDeAsistencia), /2 de 10/, 'el aviso no dice sobre cuántas habla');
});

test('sin ninguna respuesta el aviso lo dice, en vez de dejar un hueco que se lee como cero', async () => {
  await limpiar();
  for (let i = 0; i < 4; i++) await cita(1, 'confirmed');

  const r = await leer();
  assert.equal(r.conAsistencia, 0);
  assert.equal(r.tasaDeAsistencia, null);
  assert.match(
    String(r.avisoDeAsistencia),
    /Nadie registró/,
    'una tarjeta vacía sin aviso se lee como «no se presentó nadie»',
  );
});

test('con suficientes respuestas la tasa aparece Y el aviso se calla', async () => {
  /* La regla del silencio: un aviso que siempre está encendido es un aviso que nadie mira, y
     arrastraría con él al de las citas congeladas, que está al lado. */
  await limpiar();
  for (let i = 0; i < 8; i++) await cita(1, 'confirmed', 'cal1', { asistio: true });
  for (let i = 0; i < 4; i++) await cita(2, 'confirmed', 'cal1', { asistio: false });

  const r = await leer();
  assert.equal(r.conAsistencia, 12);
  assert.equal(r.tasaDeAsistencia, 66.7, 'la tasa no redondea a un decimal como sus vecinas');
  assert.equal(r.avisoDeAsistencia, null, 'el aviso siguió encendido con la cifra ya publicada');
});

test('una cita CONGELADA no entra, aunque alguien haya respondido', async () => {
  /* El mismo filtro que las otras cuatro cifras: sin él, una respuesta registrada sobre una cita
     que el CRM ya no devuelve mezclaría una foto vieja con el dato de hoy. Y peor: `citasParaCerrar`
     no las ofrece, así que esa respuesta sólo puede existir por un camino que ya no debería haber. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await cita(1, 'confirmed', 'cal1', { asistio: true });
  for (let i = 0; i < 5; i++) await cita(2, 'confirmed', null, { asistio: false });

  const r = await leer();
  assert.equal(r.conAsistencia, PISO_DE_UNA_TASA, 'entraron citas congeladas al denominador');
  assert.equal(r.tasaDeAsistencia, 100);
});

// ─── La confirmación del agendamiento ───────────────────────────────────────

/** El campo en el catálogo, con el nombre EXACTO que la cifra busca. */
async function elCampo(campoId = 'cf-confirma'): Promise<string> {
  /* La carpeta va SIN `grupo`, que es el estado real de este campo en produccion: su carpeta esta
     deliberadamente fuera de `CARPETAS_DEL_PERFIL`, y por eso `camposQueSeMuestran` no lo devuelve.
     Es lo que hace que esta prueba ejercite el motivo por el que `campoPorNombre` existe. */
  await conOrganizacion(alfa, () =>
    datos()
      .insertInto('carpetas_del_crm')
      .values({ carpeta_id: 'fo-x', nombre: 'Carpeta que no se muestra', grupo: null } as never)
      .onConflict((oc) => oc.doNothing())
      .execute(),
  );
  await conOrganizacion(alfa, () =>
    datos()
      .insertInto('campos_del_crm')
      .values({
        campo_id: campoId,
        nombre: CAMPO_DE_CONFIRMACION,
        carpeta_id: 'fo-x',
        tipo: 'RADIO',
        posicion: 1,
      } as never)
      .onConflict((oc) => oc.doNothing())
      .execute(),
  );
  return campoId;
}

/** Un contacto con su respuesta al campo, y una cita en la ventana. */
async function contactoQueRespondio(campoId: string, valor: string | null): Promise<void> {
  const id = await conOrganizacion(alfa, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({
        ghl_contact_id: `${MARCA}-${randomUUID().slice(0, 8)}`,
        nombre: 'Contacto con cita',
        territorio: 'closer',
        campos_del_crm: valor === null ? '{}' : JSON.stringify({ [campoId]: valor }),
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.id;
  });
  const inicio = new Date(Date.now() - 86_400_000);
  await conOrganizacion(alfa, () =>
    datos()
      .insertInto('citas')
      .values({
        ghl_evento_id: `${MARCA}-${randomUUID().slice(0, 8)}`,
        contacto_id: id,
        inicio_el: inicio,
        estado_ghl: 'confirmed',
        ghl_calendario_id: 'cal1',
      } as never)
      .execute(),
  );
}

async function limpiarConfirmacion(): Promise<void> {
  await conOrganizacion(alfa, async () => {
    await datos().deleteFrom('citas').execute();
    await datos().deleteFrom('contactos').where('nombre', '=', 'Contacto con cita').execute();
    await datos().deleteFrom('campos_del_crm').where('nombre', '=', CAMPO_DE_CONFIRMACION).execute();
    await datos().deleteFrom('carpetas_del_crm').where('carpeta_id', '=', 'fo-x').execute();
  });
}

test('la confirmación sale de un campo que la PANTALLA no muestra, y la cifra igual lo lee', async () => {
  /* ═══════════════════════════════════════════════════════════════════════════
   * `Confirmación Agendamiento` estaba guardado en `contactos.campos_del_crm` —178 de 584 contactos
   * lo traen— y era ILEGIBLE desde el código de negocio: el único camino al catálogo filtraba por
   * `grupo is not null`, o sea por la decisión de qué se dibuja en la ficha del closer.
   *
   * Esta prueba crea el campo SIN carpeta con grupo, que es exactamente el mundo de producción: si
   * alguien «simplificara» `campoPorNombre` reusando `camposQueSeMuestran`, la cifra desaparecería
   * y ninguna otra prueba lo notaría.
   * ═══════════════════════════════════════════════════════════════════════════ */
  await limpiarConfirmacion();
  const campo = await elCampo();
  for (let i = 0; i < 8; i++) await contactoQueRespondio(campo, 'Si');
  for (let i = 0; i < 4; i++) await contactoQueRespondio(campo, 'No');

  const r = await leer();
  assert.equal(r.conConfirmacion, 12, 'la cifra no pudo leer el campo: ¿volvió a pasar por el filtro de carpetas?');
  assert.equal(r.confirmaron, 8);
  assert.equal(r.tasaDeConfirmacion, 66.7);
  assert.equal(r.avisoDeConfirmacion, null, 'el aviso siguió encendido con la cifra publicada');
  await limpiarConfirmacion();
});

test('quien NO respondió el campo no entra al denominador', async () => {
  /* El mismo defecto que hundiría la asistencia: contar como «no confirmó» a quien nadie preguntó.
     Acá es peor todavía, porque el campo lo llena un flujo del CRM que puede no haber corrido — y la
     cifra diría que la gente no confirma cuando lo que pasa es que no se les pidió. */
  await limpiarConfirmacion();
  const campo = await elCampo();
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await contactoQueRespondio(campo, 'Si');
  for (let i = 0; i < 20; i++) await contactoQueRespondio(campo, null);

  const r = await leer();
  assert.equal(r.conConfirmacion, PISO_DE_UNA_TASA, 'los que no respondieron entraron al denominador');
  assert.equal(r.tasaDeConfirmacion, 100, 'la cifra se hundió con gente a la que nadie preguntó');
  await limpiarConfirmacion();
});

test('sin el campo en el catálogo la cifra dice que MIREN EL CRM, no que nadie confirma', async () => {
  /* Los dos ceros otra vez, y acá mandan a lugares distintos: «nadie respondió» se arregla esperando
     o revisando el flujo, y «el campo no existe» se arregla mirando el CRM. Un hueco mudo los
     confunde, y quien lo lea va a esperar un dato que no va a llegar nunca. */
  await limpiarConfirmacion();
  for (let i = 0; i < 5; i++) await contactoQueRespondio('cf-que-no-esta', 'Si');

  const r = await leer();
  assert.equal(r.tasaDeConfirmacion, null);
  assert.match(String(r.avisoDeConfirmacion), /no tiene un campo/, 'no se dijo que el campo falta');
  assert.match(String(r.avisoDeConfirmacion), /no es que nadie confirme/);
  await limpiarConfirmacion();
});

test('un contacto con DOS citas en la ventana cuenta una vez, no dos', async () => {
  /* Con un `join` en vez de `exists`, su única respuesta pesaría el doble que la de quien tuvo una
     sola cita — y la cifra se inclinaría hacia los contactos que más reagendan, que es justamente el
     grupo cuya confirmación uno querría mirar aparte. */
  await limpiarConfirmacion();
  const campo = await elCampo();
  await contactoQueRespondio(campo, 'Si');

  const unContacto = await conOrganizacion(alfa, () =>
    datos().selectFrom('contactos').select('id').where('nombre', '=', 'Contacto con cita').executeTakeFirstOrThrow(),
  );
  await conOrganizacion(alfa, () =>
    datos()
      .insertInto('citas')
      .values({
        ghl_evento_id: `${MARCA}-segunda`,
        contacto_id: unContacto.id,
        inicio_el: new Date(Date.now() - 2 * 86_400_000),
        estado_ghl: 'confirmed',
        ghl_calendario_id: 'cal1',
      } as never)
      .execute(),
  );

  const r = await leer();
  assert.equal(r.conConfirmacion, 1, 'el contacto con dos citas se contó dos veces');
  await limpiarConfirmacion();
});

// ─── El descarte propio, apartado de la pérdida real ────────────────────────

/** Un contacto con etiquetas de descarte, y una cita suya en la ventana. */
async function citaDeDescartado(estado: string, etiqueta = 'icp_rechazado'): Promise<void> {
  await conOrganizacion(alfa, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({
        ghl_contact_id: `${MARCA}-desc-${randomUUID().slice(0, 8)}`,
        nombre: 'Contacto descartado',
        territorio: 'closer',
        /* En MAYÚSCULA a propósito: GoHighLevel no garantiza la caja de las etiquetas y se guardan
           crudas, así que una comparación sin `lower()` dejaría pasar a este contacto como si
           nadie lo hubiera descartado. */
        etiquetas: [etiqueta.toUpperCase()],
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();

    await datos()
      .insertInto('citas')
      .values({
        ghl_evento_id: `${MARCA}-${randomUUID().slice(0, 8)}`,
        contacto_id: c.id,
        inicio_el: new Date(Date.now() - 86_400_000),
        estado_ghl: estado,
        ghl_calendario_id: 'cal1',
      } as never)
      .execute();
  });
}

async function limpiarDescartados(): Promise<void> {
  await conOrganizacion(alfa, async () => {
    await datos().deleteFrom('citas').execute();
    await datos().deleteFrom('contactos').where('nombre', '=', 'Contacto descartado').execute();
  });
}

test('EL DEFECTO PUBLICADO: la tasa sumaba el descarte propio con la pérdida real', async () => {
  /* ═══════════════════════════════════════════════════════════════════════════
   * Medido en producción el 2026-09-14, sobre las 150 citas alcanzables de la ventana:
   *
   *     de contactos descartados      72 citas   cancelan el 94,4 %
   *     del resto                     78 citas   cancelan el 33,3 %
   *     las dos juntas               150 citas             62,7 %   ← lo que se publicaba
   *
   * Casi la mitad de las citas eran de contactos que la empresa MISMA había rechazado, y cancelan
   * al 94 % porque su flujo de descarte las cancela. No es conducta de ningún lead: es la
   * automatización de la casa. Sumarlas le atribuía al negocio la mitad del trabajo de su filtro.
   *
   * Esta prueba reproduce la mezcla en chico: sin el corte daría 60 %, con el corte da 20 %.
   * ═══════════════════════════════════════════════════════════════════════════ */
  await limpiar();
  await limpiarDescartados();
  // El negocio: 10 citas, 2 canceladas → 20 %.
  for (let i = 0; i < 2; i++) await cita(1, 'cancelled');
  for (let i = 0; i < 8; i++) await cita(1, 'confirmed');
  // El descarte: 10 citas, todas canceladas → 100 %.
  for (let i = 0; i < 10; i++) await citaDeDescartado('cancelled');

  const r = await leer();
  assert.equal(r.citas, 10, 'las citas de contactos descartados volvieron al denominador');
  assert.equal(r.tasa, 20, 'la tasa volvió a mezclar el descarte propio con la pérdida real');
  assert.equal(r.descartados.citas, 10, 'las descartadas desaparecieron en vez de apartarse');
  assert.equal(r.descartados.canceladas, 10);
  assert.equal(r.descartados.tasa, 100);
  await limpiarDescartados();
});

test('las dos poblaciones SUMAN el total: nada se esconde', async () => {
  /* Apartar no es tirar. Si las descartadas desaparecieran, la pantalla mostraría menos citas de
     las que hay y nadie tendría cómo notarlo — que es peor que el defecto original, porque al menos
     aquél daba un número grande. */
  await limpiar();
  await limpiarDescartados();
  for (let i = 0; i < 4; i++) await cita(1, 'confirmed');
  for (let i = 0; i < 3; i++) await citaDeDescartado('cancelled');

  const r = await leer();
  assert.equal(r.citas + r.descartados.citas, 7, 'las dos poblaciones no suman las citas que hay');
  await limpiarDescartados();
});

test('la etiqueta se compara en MINÚSCULA: el CRM no garantiza la caja', async () => {
  /* El fixture escribe la etiqueta en mayúscula. Sin `lower()`, este contacto pasaría por bueno y
     sus cancelaciones volverían a contaminar la cifra — que es el defecto original, otra vez, y
     sólo para los contactos cuya etiqueta vino con otra caja. */
  await limpiar();
  await limpiarDescartados();
  for (let i = 0; i < 5; i++) await cita(1, 'confirmed');
  await citaDeDescartado('cancelled', 'RechaZado');

  const r = await leer();
  assert.equal(r.citas, 5, 'una etiqueta en otra caja no se reconoció como descarte');
  assert.equal(r.tasa, 0);
  assert.equal(r.descartados.citas, 1);
  await limpiarDescartados();
});

test('con pocas citas descartadas su tasa CALLA, igual que todas las demás', async () => {
  /* El mismo piso que el resto del archivo. Un «100 %» sobre dos citas al lado de la cifra buena
     invitaría a compararlas, y esta población no está para eso: está para que se sepa que existe. */
  await limpiar();
  await limpiarDescartados();
  for (let i = 0; i < 5; i++) await cita(1, 'confirmed');
  for (let i = 0; i < 2; i++) await citaDeDescartado('cancelled');

  const r = await leer();
  assert.equal(r.descartados.citas, 2, 'el conteo tiene que estar igual: es lo que dice que existen');
  assert.equal(r.descartados.tasa, null, 'se publicó una tasa sobre dos citas');
  await limpiarDescartados();
});

test('las OTRAS cifras de la tarjeta también excluyen el descarte', async () => {
  /* Si la cancelación cortara y las demás no, las cinco cifras de la misma tarjeta hablarían de
     poblaciones distintas — y las cuatro se verían bien por separado. Es el mismo argumento por el
     que las cinco comparten la única pasada. */
  await limpiar();
  await limpiarDescartados();
  for (let i = 0; i < 4; i++) await cita(1, 'confirmed', 'cal1', { reservadaHorasAntes: 10 });
  for (let i = 0; i < 6; i++) await citaDeDescartado('confirmed');

  const r = await leer();
  assert.equal(r.citas, 4);
  assert.equal(
    r.conFechaDeReserva,
    4,
    'la mediana de anticipación se calculó incluyendo citas de contactos descartados',
  );
  await limpiarDescartados();
});

// ─── Desde cuándo hay datos ─────────────────────────────────────────────────

test('`desde` es la cita más vieja que la ventana alcanzó, NO el borde de la ventana', async () => {
  /* ── LO QUE IMPIDE QUE «COMPLETO» SE LEA COMO HISTORIA ────────────────────
   *
   * «Completo» son diez años de ventana y los datos de esta empresa empiezan hace tres semanas. Con
   * `desde` calculado como `now() - dias`, la pantalla diría «desde 2016» sobre veintiún días de
   * negocio, y cualquier lectura de tendencia sobre eso sería falsa.
   *
   * Y no es la fila más vieja de la tabla: es la más vieja de las que ESTA cifra cuenta. Una
   * congelada más antigua no corre la fecha, porque tampoco entra en el numerador ni en el
   * denominador — decir «hay datos desde» una cita que no se cuenta sería la misma mentira al
   * revés. */
  await limpiar();
  await cita(40, 'cancelled', null);   // congelada y más vieja: no cuenta, y no corre la fecha
  await cita(12, 'confirmed');
  await cita(2, 'cancelled');

  const t = await leer(DIAS_DE_TODO);
  assert.equal(t.citas, 2, 'la congelada entró al conteo');
  assert.ok(t.desde, 'no viaja desde cuándo hay citas: «completo» se lee como toda la historia');

  const haceDias = (Date.now() - new Date(t.desde).getTime()) / 86_400_000;
  assert.ok(
    haceDias > 11.5 && haceDias < 12.5,
    `desde quedó a ${haceDias.toFixed(1)} días: tiene que ser la cita de hace 12, ni la ventana ` +
      'entera (3650) ni la congelada de hace 40',
  );
});

test('sin citas en la ventana no se inventa una fecha de comienzo', async () => {
  /* El mismo criterio que la tasa: sin filas no hay dato. Una fecha puesta igual se dibujaría como
     «hay citas desde hoy» sobre una pantalla vacía. */
  await limpiar();
  const t = await leer();
  assert.equal(t.citas, 0);
  assert.equal(t.desde, null, 'sin citas se está devolviendo una fecha de comienzo inventada');
});

// ─── El guardián de la cola, que hoy tiene que estar CALLADO ────────────────

test('con la historia pareja de hoy, el matiz de la ventana no se enciende', async () => {
  /* ── UNA PRUEBA DE QUE ALGO **NO** APARECE, Y POR QUÉ VALE ────────────────
   *
   * El matiz existe porque del otro lado de esta pantalla ya falló: Lead Flow publicaba «desde el 8
   * de agosto de 2025» sobre una cohorte donde 95 % entró en las últimas seis semanas. Acá el mismo
   * guardián está puesto y medido en producción el 2026-09-16 no se enciende en ninguno de los
   * cuatro períodos —la proporción va de 0,81 a 0,46 y el umbral es 0,25— porque la historia de
   * citas empieza el 2026-08-24 y no tiene cola.
   *
   * Sin esta prueba, el día que alguien cambie el umbral y encienda el aviso en las citas, nada
   * falla: aparece una advertencia permanente sobre una cifra correcta, y una advertencia que
   * aparece siempre apaga por costumbre a las que sí son excepcionales. */
  await limpiar();
  for (const d of [2, 4, 6, 8, 10, 12]) await cita(d, 'confirmed');

  const t = await leer(DIAS_DE_TODO);
  assert.equal(t.citas, 6);
  assert.ok(t.desde && t.mitad, 'faltan las dos fechas de la ventana');
  assert.equal(
    t.avisoDeLaVentana,
    null,
    'se encendió el matiz sobre una ventana pareja: una salvedad permanente deja de leerse',
  );
});

test('con una cita vieja suelta, el matiz SÍ aparece y la mediana no se corre', async () => {
  /* La otra mitad: el guardián tiene que poder encenderse, o es decoración. Una cita de hace 400
     días contra seis recientes es la misma forma que hoy tiene Lead Flow. */
  await limpiar();
  await cita(400, 'confirmed');
  for (const d of [2, 3, 4, 5, 6, 7] ) await cita(d, 'confirmed');

  const t = await leer(DIAS_DE_TODO);
  assert.equal(t.citas, 7);
  assert.ok(t.desde && t.mitad, 'faltan las dos fechas de la ventana');

  const diasDelMasViejo = (Date.now() - new Date(t.desde).getTime()) / 86_400_000;
  assert.ok(diasDelMasViejo > 399, 'se perdió la cita más vieja: el rango dejó de ser el real');

  const diasDeLaMitad = (Date.now() - new Date(t.mitad).getTime()) / 86_400_000;
  assert.ok(diasDeLaMitad < 10, `la mediana quedó a ${diasDeLaMitad.toFixed(1)} días: una sola fila la corrió`);

  assert.ok(t.avisoDeLaVentana, 'con 1 de 7 citas a 400 días, `desde` describe a un caso suelto y no se dijo');
  assert.match(t.avisoDeLaVentana, /la mitad de las citas ocurrió/);
});
