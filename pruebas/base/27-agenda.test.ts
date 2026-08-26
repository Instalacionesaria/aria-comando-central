// El barrido del calendario y la Agenda del closer. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO PRUEBA, Y CADA COSA SALIÓ DE UNA MEDICIÓN CONTRA LA CUENTA REAL
//
//   1 · **El 39 % de las citas están canceladas** (411 de 1052). Se guardan igual —una cita
//       cancelada ocurrió— y las vitrinas las excluyen con UNA definición: `noCancelada()`. Tres
//       copias a mano fue el defecto real: los íconos 📹 y 📅 las contaban.
//   2 · **El CRM devuelve las citas borradas**, con `deleted: true`. No se guardan.
//   3 · **El primer barrido real trajo 132 citas y guardó 43**: las otras 89 son de contactos que no
//       están traídos. Eso no es un fallo y tiene que quedar contado, no descartado en silencio.
//   4 · **Un calendario que falla no invalida los otros ocho.** Cuesta una llamada por calendario:
//       perder los nueve porque uno falló sería cambiar una agenda incompleta por una vacía.
//   5 · **Un cero de citas tiene tres estados**: nunca se barrió, se barrió a medias, se barrió
//       completo. `11` § 9 regla 1 — un cero medido y uno sin medir no son el mismo hecho.
//   6 · **Las 22:00 de Lima son del día siguiente en UTC**, así que el agrupado por día usa la zona
//       de la empresa. Y `UTC` en una empresa significa «nadie lo configuró»: eso se avisa.
//
// Ninguno de los seis da error cuando falla. Todos dibujan una agenda plausible.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import type { CalendarioDeGhl, CitaDeGhl } from '../../lib/ghl/calendarios.ts';
import type { ResultadoDeGhl } from '../../lib/ghl/cliente.ts';
import { agendaDelCloser, porQueNoHayCitasHoy } from '../../lib/negocio/agenda.ts';
import { barrerCitas, type LectoresDelCalendario } from '../../lib/negocio/citas.ts';
import { filasDeTerritorio } from '../../lib/negocio/fila.ts';
import { colasDelDia } from '../../lib/negocio/miDia.ts';

const ZONA = 'America/Lima';
const ACCESO = { token: 'no-se-usa', locationId: 'loc1' };

let admin: Client;
let alfa: string;

before(async () => {
  admin = await conectar('admin');
  const org = await unaFila<{ id: string }>(
    admin,
    `select id from identidad.organizaciones where slug = 'alfa'`,
  );
  assert.ok(org, 'falta la organización alfa del sembrado');
  alfa = org.id;
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

/** Borrar los contactos arrastra las citas por la clave foránea compuesta `on delete cascade`. */
async function limpiar(): Promise<void> {
  await admin.query('delete from negocio.contactos where org_id = $1', [alfa]);
  await admin.query('delete from negocio.ingesta_pulso where org_id = $1', [alfa]);
}

// ─── Aparejo ───────────────────────────────────────────────────────────────

async function contacto(ghl: string, nombre = `C ${ghl}`, etiquetas: string[] = []): Promise<string> {
  return conOrganizacion(alfa, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({ ghl_contact_id: ghl, nombre, territorio: 'closer', etiquetas } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.id;
  });
}

/** Una cita en la tabla, sin pasar por el barrido. Para probar la LECTURA. */
async function citaEnTabla(
  contactoId: string,
  inicio: Date,
  extra: Record<string, unknown> = {},
): Promise<string> {
  return conOrganizacion(alfa, async () => {
    const c = await datos()
      .insertInto('citas')
      .values({
        contacto_id: contactoId,
        ghl_evento_id: `ev-${randomUUID().slice(0, 8)}`,
        inicio_el: inicio,
        ...extra,
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.id;
  });
}

/** Una cita como la devuelve el CRM ya leída. */
function delCrm(id: string, contactId: string | null, inicio: Date | null, extra: Partial<CitaDeGhl> = {}): CitaDeGhl {
  return {
    id,
    calendarioId: 'cal1',
    contactId,
    titulo: 'Llamada',
    inicioEl: inicio,
    finEl: inicio ? new Date(inicio.getTime() + 1_800_000) : null,
    estado: 'confirmed',
    sala: 'https://meet.example/x',
    usuarioAsignadoId: 'u1',
    borrada: false,
    reagendadaEl: null,
    ...extra,
  };
}

const datosDe = <T>(d: T): ResultadoDeGhl<T> => ({ tipo: 'datos', datos: d });
const falloDe = <T>(): ResultadoDeGhl<T> => ({
  tipo: 'fallo',
  fallo: { tipo: 'rechazado', estado: 500, codigo: 'quien_sabe' },
});

function calendario(id: string, activo = true): CalendarioDeGhl {
  return { id, nombre: `Cal ${id}`, tipo: 'personal', activo };
}

/**
 * Los lectores falsos. **La costura existe para poder pedirle al CRM cosas que no se le pueden
 * pedir**: que una cita venga borrada, que un calendario falle, que dos calendarios devuelvan la
 * misma cita.
 */
function lectores(
  cals: CalendarioDeGhl[],
  porCalendario: Record<string, CitaDeGhl[] | 'falla'>,
  cuenta?: { llamadas: number },
): LectoresDelCalendario {
  return {
    listar: async () => {
      if (cuenta) cuenta.llamadas++;
      return datosDe(cals);
    },
    citas: async (_acceso, calendarioId) => {
      if (cuenta) cuenta.llamadas++;
      const c = porCalendario[calendarioId];
      if (c === 'falla' || c === undefined) return falloDe<CitaDeGhl[]>();
      return datosDe(c);
    },
  };
}

/** El antirrebote de 8 s bloquearía el segundo barrido de la misma prueba. */
async function liberarPulso(): Promise<void> {
  await admin.query(
    `update negocio.ingesta_pulso set ultima_corrida_el = now() - interval '1 hour'
      where org_id = $1 and clave = 'citas'`,
    [alfa],
  );
}

async function marcarPulso(campos: { atrasado?: boolean; corrida?: boolean }): Promise<void> {
  await admin.query(
    `insert into negocio.ingesta_pulso (org_id, clave, ultima_corrida_el, atrasado)
     values ($1, 'citas', case when $2 then now() else null end, $3)
     on conflict (org_id, clave) do update
        set ultima_corrida_el = case when $2 then now() else null end, atrasado = $3`,
    [alfa, campos.corrida !== false, campos.atrasado === true],
  );
}

const laAgenda = (opciones: { dias?: number; incluirCanceladas?: boolean } = {}, zona = ZONA) =>
  conOrganizacion(alfa, () => agendaDelCloser(zona, opciones));

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL BARRIDO
// ═══════════════════════════════════════════════════════════════════════════════

test('el barrido cuesta 1 + N llamadas: una por calendario, y no crece con las citas', async () => {
  // Medido: `GET /calendars/events` **exige** `calendarId` —sin él responde 422 *"Either of userId,
  // calendarId or groupId is required"*—, así que no hay una consulta por subcuenta. El documento
  // decía «1 llamada»; son 10. Un botón que cuesta diez llamadas y dice que cuesta una se aprieta
  // por si acaso.
  await limpiar();
  const c = await contacto(`b1-${randomUUID().slice(0, 6)}`);
  const enUnaHora = new Date(Date.now() + 3_600_000);
  const cuenta = { llamadas: 0 };
  const tres = [calendario('a'), calendario('b'), calendario('c')];

  const r = await barrerCitas(
    alfa,
    ACCESO,
    lectores(
      tres,
      {
        a: [delCrm('e1', `b1`, enUnaHora)],
        b: [],
        c: [],
      },
      cuenta,
    ),
  );

  assert.equal(r.corrio, true);
  assert.equal(cuenta.llamadas, 4, 'tienen que ser 1 + 3, una por calendario');
  assert.ok(r.corrio && r.resultado.llamadas === 4, 'el resultado tiene que DECIR lo que costó');
  assert.ok(c);
});

test('una cita de un contacto que no tenemos se CUENTA y no se guarda', async () => {
  // El primer barrido real: **132 vistas, 43 guardadas**. Las otras 89 son de contactos que no están
  // traídos de GoHighLevel, y la clave foránea compuesta las hace imposibles de guardar. Si el
  // descarte fuera silencioso, «43 guardadas» se leería como que el CRM tiene 43 citas.
  await limpiar();
  const marca = `n${randomUUID().slice(0, 6)}`;
  const nuestro = await contacto(marca);
  const enUnaHora = new Date(Date.now() + 3_600_000);

  const r = await barrerCitas(
    alfa,
    ACCESO,
    lectores([calendario('a')], {
      a: [delCrm('e1', marca, enUnaHora), delCrm('e2', 'de-otro-mundo', enUnaHora)],
    }),
  );

  assert.ok(r.corrio);
  assert.equal(r.resultado.vistas, 2, 'las dos se vieron');
  assert.equal(r.resultado.nuestras, 1, 'una sola es de un contacto nuestro');
  assert.equal(r.resultado.guardadas, 1);

  const cuantas = await conOrganizacion(alfa, async () => {
    const f = await datos().selectFrom('citas').select(['contacto_id']).execute();
    return f;
  });
  assert.equal(cuantas.length, 1);
  assert.equal(cuantas[0]?.contacto_id, nuestro);
});

test('una cita BORRADA por el CRM no se guarda, y se cuenta aparte', async () => {
  // Lo que sorprende y está medido: el CRM **sigue devolviendo** las citas borradas en la lista.
  await limpiar();
  const marca = `d${randomUUID().slice(0, 6)}`;
  await contacto(marca);
  const enUnaHora = new Date(Date.now() + 3_600_000);

  const r = await barrerCitas(
    alfa,
    ACCESO,
    lectores([calendario('a')], {
      a: [
        delCrm('e1', marca, enUnaHora, { borrada: true }),
        delCrm('e2', marca, enUnaHora),
      ],
    }),
  );

  assert.ok(r.corrio);
  assert.equal(r.resultado.borradas, 1);
  assert.equal(r.resultado.guardadas, 1, 'solo la que no está borrada');
});

test('una cita SIN HORA no se guarda, y se cuenta: un descarte silencioso vuelve el cero mentira', async () => {
  // En lo medido son 0 de 1052. Contarlas es lo que hace que si mañana aparecen, se sepa.
  await limpiar();
  const marca = `s${randomUUID().slice(0, 6)}`;
  await contacto(marca);

  const r = await barrerCitas(
    alfa,
    ACCESO,
    lectores([calendario('a')], { a: [delCrm('e1', marca, null)] }),
  );

  assert.ok(r.corrio);
  assert.equal(r.resultado.sinHora, 1);
  assert.equal(r.resultado.guardadas, 0);
});

test('las CANCELADAS sí se guardan, y se cuentan', async () => {
  // Son el 39 % de lo medido. Una cita cancelada ocurrió: alguien la agendó y alguien la canceló, y
  // es el denominador de cualquier medición honesta. Se ocultan en las vitrinas, no en la tabla.
  await limpiar();
  const marca = `c${randomUUID().slice(0, 6)}`;
  await contacto(marca);
  const enUnaHora = new Date(Date.now() + 3_600_000);

  const r = await barrerCitas(
    alfa,
    ACCESO,
    lectores([calendario('a')], {
      a: [
        delCrm('e1', marca, enUnaHora, { estado: 'cancelled' }),
        delCrm('e2', marca, enUnaHora, { estado: 'CANCELLED' }),
        delCrm('e3', marca, enUnaHora),
      ],
    }),
  );

  assert.ok(r.corrio);
  assert.equal(r.resultado.canceladas, 2, 'la caja no cambia el hecho');
  assert.equal(r.resultado.guardadas, 3, 'las tres están en la tabla');
});

test('un calendario que falla marca ATRASADO y no se lleva a los otros', async () => {
  // Cuesta una llamada por calendario, así que un fallo parcial es lo normal, no lo raro. Perder los
  // nueve porque uno falló sería cambiar una agenda incompleta por una vacía — y sin `atrasado`,
  // nadie sabría que falta algo.
  await limpiar();
  const marca = `f${randomUUID().slice(0, 6)}`;
  await contacto(marca);
  const enUnaHora = new Date(Date.now() + 3_600_000);

  const r = await barrerCitas(
    alfa,
    ACCESO,
    lectores([calendario('a'), calendario('b')], {
      a: 'falla',
      b: [delCrm('e1', marca, enUnaHora)],
    }),
  );

  assert.ok(r.corrio);
  assert.equal(r.resultado.atrasado, true, 'una agenda incompleta tiene que decirlo');
  assert.equal(r.resultado.guardadas, 1, 'lo que sí se pudo leer se guardó');
});

test('si falla el LISTADO de calendarios no se barre nada, y queda atrasado', async () => {
  // Es el paso 1 obligatorio: sin la lista no hay a quién preguntarle.
  await limpiar();
  const r = await barrerCitas(alfa, ACCESO, {
    listar: async () => falloDe<CalendarioDeGhl[]>(),
    citas: async () => {
      throw new Error('no se tiene que llegar acá: sin lista no hay a quién preguntar');
    },
  });
  assert.ok(r.corrio);
  assert.equal(r.resultado.atrasado, true);
  assert.equal(r.resultado.vistas, 0);
  assert.equal(r.resultado.llamadas, 1);
});

test('el segundo barrido ACTUALIZA la misma cita y NO pisa el contacto', async () => {
  // El rango casa por SOLAPAMIENTO, no por hora de inicio, así que toda ventana contigua repite
  // citas: sin el `on conflict` habría duplicados en la agenda. Y `contacto_id` no se pisa porque
  // una cita puede haber sido asignada acá a mano.
  await limpiar();
  const marca = `u${randomUUID().slice(0, 6)}`;
  await contacto(marca);
  const enUnaHora = new Date(Date.now() + 3_600_000);
  const eventoFijo = 'ev-fijo-1';

  const cal = [calendario('a')];
  await barrerCitas(alfa, ACCESO, lectores(cal, { a: [delCrm(eventoFijo, marca, enUnaHora)] }));
  await liberarPulso();
  const enDosHoras = new Date(Date.now() + 7_200_000);
  const r2 = await barrerCitas(
    alfa,
    ACCESO,
    lectores(cal, {
      a: [delCrm(eventoFijo, marca, enDosHoras, { estado: 'cancelled', titulo: 'Reagendada' })],
    }),
  );

  assert.ok(r2.corrio);
  const filas = await conOrganizacion(alfa, () =>
    datos().selectFrom('citas').select(['ghl_evento_id', 'inicio_el', 'estado_ghl']).execute(),
  );
  assert.equal(filas.length, 1, 'la misma cita dos veces no puede dar dos filas');
  assert.equal(filas[0]?.estado_ghl, 'cancelled', 'la cancelación tiene que llegar');
  assert.equal(
    filas[0]?.inicio_el?.getTime(),
    enDosHoras.getTime(),
    'reagendar mueve la hora; sin esto la agenda muestra la vieja',
  );
});

test('el segundo barrido seguido devuelve `corrio: false` y NO cuesta llamadas', async () => {
  // El candado impide corridas simultáneas; el antirrebote impide las seguidas. Sin él, el botón
  // apretado dos veces cuesta veinte llamadas.
  await limpiar();
  const marca = `a${randomUUID().slice(0, 6)}`;
  await contacto(marca);
  const cuenta = { llamadas: 0 };
  const l = lectores([calendario('a')], { a: [] }, cuenta);

  const uno = await barrerCitas(alfa, ACCESO, l);
  assert.equal(uno.corrio, true);
  const gasto = cuenta.llamadas;

  const dos = await barrerCitas(alfa, ACCESO, l);
  assert.equal(dos.corrio, false, 'el segundo seguido no le tocaba');
  assert.equal(cuenta.llamadas, gasto, 'y sobre todo: no gastó ninguna llamada');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LA AGENDA
// ═══════════════════════════════════════════════════════════════════════════════

test('LA PRUEBA DE LA ZONA: una cita de las 22:00 en Lima va al día de Lima', async () => {
  // Es el defecto que este proyecto ya pagó. Las 22:00 de Lima son las 03:00 UTC del día siguiente:
  // agrupado con la zona del servidor, la cita encabeza el día de mañana y quien la mire llama tarde.
  await limpiar();
  const c = await contacto(`z${randomUUID().slice(0, 6)}`);
  await marcarPulso({ corrida: true });

  // Hoy en Lima, a las 22:00. Se arma desde la base para no depender de la zona de quien corre.
  const cuando = await unaFila<{ i: Date; d: string }>(
    admin,
    `select (date_trunc('day', timezone('America/Lima', now())) + interval '22 hours')
              at time zone 'America/Lima' as i,
            to_char(date_trunc('day', timezone('America/Lima', now())), 'YYYY-MM-DD') as d`,
  );
  assert.ok(cuando);
  await citaEnTabla(c, cuando.i);

  const enLima = await laAgenda({ dias: 2 }, 'America/Lima');
  assert.equal(enLima.total, 1);
  assert.equal(enLima.dias.length, 1);
  assert.equal(enLima.dias[0]?.dia, cuando.d, 'la cita de las 22:00 es del día de Lima');
  assert.equal(enLima.hoy, cuando.d, '`hoy` tiene que ser el mismo día que la encabeza');
});

test('`hoy` sale de la MISMA consulta que la ventana, así que siempre es un día de la ventana', async () => {
  // El defecto que esto cierra: `hoy` con `new Date()` y la ventana con `now()` son dos relojes. El
  // síntoma no es un error, es que ninguna cabecera dice «HOY» — y solo alrededor de la medianoche.
  await limpiar();
  const c = await contacto(`h${randomUUID().slice(0, 6)}`);
  await marcarPulso({ corrida: true });
  const hoyMedioDia = await unaFila<{ i: Date }>(
    admin,
    `select (date_trunc('day', timezone($1, now())) + interval '12 hours') at time zone $1 as i`,
    [ZONA],
  );
  assert.ok(hoyMedioDia);
  await citaEnTabla(c, hoyMedioDia.i);

  const a = await laAgenda({ dias: 3 });
  assert.match(a.hoy, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(
    a.dias.some((d) => d.dia === a.hoy),
    'la cita del mediodía de hoy tiene que caer en el día que `hoy` nombra',
  );
});

test('la ventana empieza en la medianoche de HOY: lo de ayer no entra', async () => {
  await limpiar();
  const c = await contacto(`v${randomUUID().slice(0, 6)}`);
  await marcarPulso({ corrida: true });
  const ayer = await unaFila<{ i: Date }>(
    admin,
    `select (date_trunc('day', timezone($1, now())) - interval '2 hours') at time zone $1 as i`,
    [ZONA],
  );
  assert.ok(ayer);
  await citaEnTabla(c, ayer.i);

  const a = await laAgenda({ dias: 15 });
  assert.equal(a.total, 0);
  // Y el cero NO dice «no hay citas»: dice cuántas hay antes. Es la diferencia entre «el sistema no
  // cargó nada» y «no tenés nada agendado por delante», y decide qué hace la persona después.
  assert.ok(a.falta, 'un cero sin motivo afirma «no tenés citas»');
  assert.match(a.falta, /1 cita|anteriores|antes/i);
});

test('una cita que ya pasó viene marcada VENCIDA, no escondida', async () => {
  // *"Si desapareciera, el closer perdería de vista exactamente la cita que tiene pendiente de
  // registrar"*. Y `vencida` se calcula con el reloj del SERVIDOR: un navegador atrasado marcaría
  // como pendiente una cita que ya pasó.
  await limpiar();
  const c = await contacto(`x${randomUUID().slice(0, 6)}`);
  await marcarPulso({ corrida: true });
  const haceUnaHora = await unaFila<{ i: Date }>(admin, `select now() - interval '1 hour' as i`);
  const enUnaHora = await unaFila<{ i: Date }>(admin, `select now() + interval '1 hour' as i`);
  assert.ok(haceUnaHora && enUnaHora);
  await citaEnTabla(c, haceUnaHora.i);
  await citaEnTabla(c, enUnaHora.i);

  const a = await laAgenda({ dias: 2 });
  const todas = a.dias.flatMap((d) => d.citas);
  assert.equal(todas.length, 2, 'la vencida no se esconde');
  assert.equal(todas.filter((x) => x.vencida).length, 1);
  assert.equal(todas.filter((x) => !x.vencida).length, 1);
});

test('las canceladas se OCULTAN por omisión y se pueden pedir marcadas', async () => {
  await limpiar();
  const c = await contacto(`k${randomUUID().slice(0, 6)}`);
  await marcarPulso({ corrida: true });
  const enUnaHora = await unaFila<{ i: Date }>(admin, `select now() + interval '1 hour' as i`);
  assert.ok(enUnaHora);
  await citaEnTabla(c, enUnaHora.i, { estado_ghl: 'cancelled' });
  await citaEnTabla(c, enUnaHora.i, { estado_ghl: 'confirmed' });

  const porOmision = await laAgenda({ dias: 2 });
  assert.equal(porOmision.total, 1, 'la cancelada no va en la agenda por omisión');

  const conTodas = await laAgenda({ dias: 2, incluirCanceladas: true });
  assert.equal(conTodas.total, 2);
  const marcadas = conTodas.dias.flatMap((d) => d.citas).filter((x) => x.cancelada);
  assert.equal(marcadas.length, 1, 'y viene marcada, no disfrazada de cita buena');
});

test('un estado con MAYÚSCULAS también cuenta como cancelada', async () => {
  // El campo es texto libre del proveedor. Comparar sin bajar la caja dejaría entrar `CANCELLED`.
  await limpiar();
  const c = await contacto(`m${randomUUID().slice(0, 6)}`);
  await marcarPulso({ corrida: true });
  const enUnaHora = await unaFila<{ i: Date }>(admin, `select now() + interval '1 hour' as i`);
  assert.ok(enUnaHora);
  await citaEnTabla(c, enUnaHora.i, { estado_ghl: 'Cancelled' });

  const a = await laAgenda({ dias: 2 });
  assert.equal(a.total, 0);
});

test('una cita con `estado_ghl` NULO no es cancelada: nulo es «el CRM no lo dijo»', async () => {
  await limpiar();
  const c = await contacto(`w${randomUUID().slice(0, 6)}`);
  await marcarPulso({ corrida: true });
  const enUnaHora = await unaFila<{ i: Date }>(admin, `select now() + interval '1 hour' as i`);
  assert.ok(enUnaHora);
  await citaEnTabla(c, enUnaHora.i);

  const a = await laAgenda({ dias: 2 });
  assert.equal(a.total, 1, 'descartar por nulo perdería citas buenas');
});

test('un contacto con el nombre vacío no deja una fila muda', async () => {
  await limpiar();
  const c = await contacto(`q${randomUUID().slice(0, 6)}`, '   ');
  await marcarPulso({ corrida: true });
  const enUnaHora = await unaFila<{ i: Date }>(admin, `select now() + interval '1 hour' as i`);
  assert.ok(enUnaHora);
  await citaEnTabla(c, enUnaHora.i, { titulo: 'Llamada con alguien' });

  const a = await laAgenda({ dias: 2 });
  const cita = a.dias[0]?.citas[0];
  assert.ok(cita);
  assert.ok(cita.nombre.trim().length > 0, 'una fila sin nombre es una llamada de nadie');
});

test('la zona viaja en la respuesta, y `UTC` viene con su aviso', async () => {
  // `zona_horaria` es `not null default 'UTC'`: para una empresa que nunca la cargó, `UTC` no
  // significa «está en UTC», significa **«nadie lo dijo»**. Medido en producción: dos de tres
  // empresas estaban así, y con las citas en `-05:00` toda cita de la tarde se dibujaba corrida.
  await limpiar();
  await marcarPulso({ corrida: true });

  const enLima = await laAgenda({ dias: 2 }, 'America/Lima');
  assert.equal(enLima.zonaHoraria, 'America/Lima');
  assert.equal(enLima.avisoDeZona, null, 'una empresa configurada no tiene nada que avisar');

  const enUtc = await laAgenda({ dias: 2 }, 'UTC');
  assert.equal(enUtc.zonaHoraria, 'UTC');
  assert.ok(enUtc.avisoDeZona, 'el silencio tiene que volverse una afirmación');
  assert.match(enUtc.avisoDeZona, /Ajustes/, 'un aviso sin qué hacer no sirve de nada');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LOS TRES ESTADOS DEL CERO
// ═══════════════════════════════════════════════════════════════════════════════

test('sin haber barrido nunca, el cero dice que falta la LECTURA, no que no hay citas', async () => {
  await limpiar();
  const a = await laAgenda({ dias: 2 });
  assert.equal(a.total, 0);
  assert.ok(a.falta);
  assert.match(a.falta, /Traer del calendario/, 'tiene que decir qué hacer');
});

test('con el barrido a medias, el cero dice que puede faltar algo', async () => {
  await limpiar();
  await marcarPulso({ corrida: true, atrasado: true });
  const a = await laAgenda({ dias: 2 });
  assert.ok(a.falta);
  assert.match(a.falta, /incompleto/i);
});

test('con el barrido completo y nada en ninguna parte, lo dice sin culpar a la lectura', async () => {
  await limpiar();
  await marcarPulso({ corrida: true });
  const a = await laAgenda({ dias: 2 });
  assert.ok(a.falta);
  assert.match(a.falta, /se leyó completo/i);
  assert.doesNotMatch(a.falta, /Traer del calendario/, 'no hay nada que traer: ya se trajo');
});

test('la cola de HOY de Mi Día ya NO dice que el calendario no está conectado', async () => {
  // El texto que estaba ahí decía *"eso todavía no está conectado"*. Era cierto y dejó de serlo el
  // día que existió el barrido: **un día tranquilo se reportaba como una integración rota**. Un
  // mensaje de falta que sobrevive a lo que describe enseña a no creerle a los demás.
  await limpiar();
  await marcarPulso({ corrida: true });
  const texto = await conOrganizacion(alfa, () => porQueNoHayCitasHoy(ZONA));
  assert.doesNotMatch(texto, /no está conectado/i);
});

test('LA COLA DE MI DÍA usa ese texto de verdad, y no uno propio', async () => {
  // LA MUTACIÓN QUE SOBREVIVIÓ: la prueba de arriba llama a `porQueNoHayCitasHoy()` directamente, así
  // que volver a poner un texto fijo en `miDia.ts` la dejaba pasar. O sea que probaba la función y no
  // el cableado — y el defecto estaba justamente en el cableado.
  //
  // Acá se pide la cola por el camino real y se comprueba que el texto viene de los tres estados.
  await limpiar();
  await marcarPulso({ corrida: true });
  const sinBarrer = await conOrganizacion(alfa, () => colasDelDia(ZONA));
  assert.ok(sinBarrer.faltantes.agenda, 'un cero de citas sin motivo afirma «no tenés citas»');
  assert.doesNotMatch(
    sinBarrer.faltantes.agenda,
    /no está conectado/i,
    'el calendario SÍ está conectado desde que existe el barrido: un día tranquilo no es una integración rota',
  );
  assert.match(sinBarrer.faltantes.agenda, /le[íy]/i, 'tiene que hablar de la lectura del calendario');

  // Y el estado «nunca se barrió» también llega hasta la cola, con su consejo.
  await limpiar();
  const nunca = await conOrganizacion(alfa, () => colasDelDia(ZONA));
  assert.ok(nunca.faltantes.agenda);
  assert.match(nunca.faltantes.agenda, /Traer del calendario/);
});

test('el cero de hoy dice CUÁNTAS hay más adelante, que es lo que decide qué hacer', async () => {
  // Cero hoy con citas mañana es un día libre; cero hoy y cero adelante es que hay que agendar.
  await limpiar();
  const c = await contacto(`p${randomUUID().slice(0, 6)}`);
  await marcarPulso({ corrida: true });
  const mañana = await unaFila<{ i: Date }>(
    admin,
    `select (date_trunc('day', timezone($1, now())) + interval '1 day 10 hours') at time zone $1 as i`,
    [ZONA],
  );
  assert.ok(mañana);
  await citaEnTabla(c, mañana.i);
  await citaEnTabla(c, mañana.i, { estado_ghl: 'cancelled' });

  const texto = await conOrganizacion(alfa, () => porQueNoHayCitasHoy(ZONA));
  assert.match(texto, /1 cita/, 'la cancelada no cuenta como cita por delante');
  assert.match(texto, /Agenda/);
});

test('cero hoy y cero adelante dice que lo que falta es AGENDAR', async () => {
  await limpiar();
  await marcarPulso({ corrida: true });
  const texto = await conOrganizacion(alfa, () => porQueNoHayCitasHoy(ZONA));
  assert.match(texto, /agendar/i);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LOS ÍCONOS: UNA DEFINICIÓN DE «CANCELADA», NO TRES
// ═══════════════════════════════════════════════════════════════════════════════

test('EL ARREGLO: una cita cancelada NO cuenta como reunión tenida', async () => {
  // El defecto medido: **411 de 1052 citas están canceladas** y los íconos las contaban. El 📹 es el
  // que el closer mira antes de llamar para saber si ya habló con esta persona, así que decía que
  // hubo reuniones que nadie tuvo. Y el número se veía plausible.
  await limpiar();
  const c = await contacto(`i${randomUUID().slice(0, 6)}`);
  const haceUnaHora = await unaFila<{ i: Date }>(admin, `select now() - interval '1 hour' as i`);
  const haceDos = await unaFila<{ i: Date }>(admin, `select now() - interval '2 hours' as i`);
  assert.ok(haceUnaHora && haceDos);
  await citaEnTabla(c, haceUnaHora.i, { estado_ghl: 'showed' });
  await citaEnTabla(c, haceDos.i, { estado_ghl: 'cancelled' });

  const { filas } = await conOrganizacion(alfa, () => filasDeTerritorio('closer', { todas: true }));
  const fila = filas.find((f) => f.id === c);
  assert.ok(fila);
  assert.equal(fila.iconos.reunionesTenidas, 1, 'la cancelada no fue una reunión');
});

test('EL ARREGLO: una cita futura cancelada NO enciende el ícono de cita agendada', async () => {
  // Acá el efecto es peor: el 📅 es justo el motivo por el que alguien decide NO llamar.
  await limpiar();
  const c = await contacto(`j${randomUUID().slice(0, 6)}`);
  const enUnaHora = await unaFila<{ i: Date }>(admin, `select now() + interval '1 hour' as i`);
  assert.ok(enUnaHora);
  await citaEnTabla(c, enUnaHora.i, { estado_ghl: 'canceled' });

  const { filas } = await conOrganizacion(alfa, () => filasDeTerritorio('closer', { todas: true }));
  const fila = filas.find((f) => f.id === c);
  assert.ok(fila);
  assert.equal(fila.iconos.citaFutura, false);
});

test('una cita futura viva SÍ enciende el ícono, y una pasada viva SÍ cuenta como reunión', async () => {
  // El complemento obligatorio: sin esto, el filtro podría estar excluyendo todo y las dos pruebas
  // de arriba pasarían igual.
  await limpiar();
  const c = await contacto(`y${randomUUID().slice(0, 6)}`);
  const enUnaHora = await unaFila<{ i: Date }>(admin, `select now() + interval '1 hour' as i`);
  const haceUnaHora = await unaFila<{ i: Date }>(admin, `select now() - interval '1 hour' as i`);
  assert.ok(enUnaHora && haceUnaHora);
  await citaEnTabla(c, enUnaHora.i, { estado_ghl: 'confirmed' });
  await citaEnTabla(c, haceUnaHora.i, { estado_ghl: 'confirmed' });

  const { filas } = await conOrganizacion(alfa, () => filasDeTerritorio('closer', { todas: true }));
  const fila = filas.find((f) => f.id === c);
  assert.ok(fila);
  assert.equal(fila.iconos.citaFutura, true);
  assert.equal(fila.iconos.reunionesTenidas, 1);
});
