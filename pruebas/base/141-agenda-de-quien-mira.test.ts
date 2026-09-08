// La Agenda del closer es la de QUIEN MIRA, no la del calendario entero. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO, Y ESTABA ANUNCIADO POR ESCRITO
//
// `lib/negocio/alcanceDelCloser.ts` dejó dicho, en el encabezado de `alcanceDeQuienMira`, cómo se
// rompe esto:
//
//   *«Existe para que las tres pantallas del Closer —Mi Día, Pipeline y Contactos— hagan la misma
//   pregunta con una sola llamada. Repetir los tres pasos en cada ruta es cómo se llega a que una de
//   las tres se olvide de aplicar el alcance: las otras dos filtran, ésa no, y el closer ve en
//   Contactos los leads que Mi Día le esconde. **No falla nada.**»*
//
// La Agenda es la CUARTA pantalla, y era la que se olvidaba. Con tres closers vinculados a tres
// usuarios de GoHighLevel, cada uno abría la pestaña y veía las citas de los tres: el nombre del
// contacto, su teléfono, y el botón para entrar a la sala de una reunión ajena.
//
// ── POR QUÉ NADIE LO IBA A NOTAR MIRANDO ───────────────────────────────────
//
// Porque Mi Día **ya filtraba**, y su cola «Agenda de hoy» filtra sin una línea propia: arma las
// citas contra `porId`, que sale del núcleo de colas ya acotado, y una cita cuyo contacto no está
// ahí se saltea. O sea que las citas de hoy salían bien en una pantalla y de más en la de al lado.
//
// **Las dos listas eran plausibles y una era más larga.** Es la prueba 6 de este archivo, y es la
// única que puede fallar por la contradicción en sí y no por uno de los dos lados.
//
// ── LOS DOS LADOS POR LOS QUE SE ROMPE, Y EL SEGUNDO ES PEOR ───────────────
//
//   · **De más** — el filtro no se aplica: alguien entra a la sala de una reunión que no es suya, y
//     el contacto ve aparecer a un vendedor que no esperaba.
//   · **De menos** — el filtro se aplica a quien no debía: un administrador abre la Agenda, la ve
//     vacía, y concluye que la empresa no tiene nada agendado. Y un closer sin vincular ve cero.
//
// El segundo es peor porque es invisible: una agenda vacía no dice por qué está vacía. Por eso las
// pruebas 2 y 3 valen tanto como la 1.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import {
  leerRespuesta,
  limpiar,
  montar,
  pedirComo,
  sesionDe,
  unaCita,
  unContacto,
  type Escenario,
} from '../apoyo/closer.ts';
import { GET as verAgenda } from '../../app/api/closer/agenda/route.ts';
import { porQueNoHayCitasHoy } from '../../lib/negocio/agenda.ts';
import { alcanceDe, closersDeLaEmpresa } from '../../lib/negocio/alcanceDelCloser.ts';
import { asignarCloser } from '../../lib/negocio/closer.ts';
import { colasDelDia } from '../../lib/negocio/miDia.ts';

/** Los dos usuarios de GoHighLevel: el de quien mira, y el del compañero. */
const CRM_MIO = 'crmDeQuienMira';
const CRM_AJENO = 'crmDelCompanero';

let esc: Escenario;
/** La zona de la ORGANIZACIÓN, que es la que corta los días. `alfa` la tiene configurada. */
let zona: string;
/** El compañero: una persona REAL de la empresa, porque `closer_asignado` tiene clave foránea. */
let companero: string;
let tokenDelCompanero: string;

before(async () => {
  esc = await montar('AgendaMia');
  const r = await esc.admin.query<{ z: string }>(
    'select zona_horaria as z from identidad.organizaciones where id = $1',
    [esc.org],
  );
  zona = r.rows[0]?.z ?? 'UTC';

  /* No sirve inventar un uuid: `closer_asignado` tiene clave foránea COMPUESTA contra `(org_id, id)`
     de `usuarios`, que es justamente lo que impide designar closer a alguien de otra empresa. */
  const p = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash, creado_por)
     values ($1, $2, $3, 'scrypt$16384$8$1$c2FsCg==$aGFzaAo=', null) returning id`,
    [esc.org, `${esc.marca} companero`, 'companero@agendamia.ejemplo'],
  );
  companero = p.rows[0]!.id;
  /* Y con rol, porque sin él el portero corta en el Paso 5 con `sin_permiso` y la prueba de «ver
     como» daría 403 — un fallo que parece de permisos y es de andamio. El rol `usuario` alcanza:
     `closer.ver` la conceden los tres. */
  await esc.admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id, asignado_por)
     select $1, id, null from identidad.roles where clave = 'usuario'`,
    [companero],
  );
  /* Y la SECCIÓN, que es el otro eje: el rol `usuario` está restringido por alcance, así que la
     capacidad sola deja el Paso 6 cortando con `seccion_no_concedida`. Es exactamente el diseño —un
     closer usa la pantalla del Closer y nada más— y es la forma en que esta persona existe de
     verdad en producción, no un atajo para la prueba. */
  await esc.admin.query(
    `insert into identidad.usuarios_secciones (usuario_id, seccion, concedida_por)
     values ($1, 'closer', null)`,
    [companero],
  );
  tokenDelCompanero = await sesionDe(companero);

  await sinDesignaciones();
});

after(async () => {
  await limpiar(esc);
  await sinDesignaciones();
  await esc.admin.query("delete from identidad.usuarios where email = 'companero@agendamia.ejemplo'");
  await cerrarTodo();
  await cerrarClientes();
});

/**
 * Ninguna designación en esta empresa.
 *
 * Se borra por `org_id` y NO por marca, porque las designaciones no llevan una: la tabla es
 * `(org_id, usuario_id)`. Y se hace en el `before` **además** del `after`: una corrida anterior
 * interrumpida dejaría a alguien designado, y entonces la prueba de «sin vincular ve todo» pasaría
 * o fallaría según qué corrió antes — que es la peor clase de prueba.
 */
async function sinDesignaciones(): Promise<void> {
  await esc.admin.query('delete from negocio.closer_asignado where org_id = $1', [esc.org]);
}

/** Designa a alguien y lo vincula a un usuario del CRM. */
async function vincular(usuarioId: string, crmUsuarioId: string): Promise<void> {
  await conOrganizacion(esc.org, () => asignarCloser(usuarioId, crmUsuarioId, esc.quien));
}

/**
 * Un instante que cae HOY en la zona de la empresa, garantizado.
 *
 * `new Date()` no alcanza: a las 23:40 de Lima, «ahora más un rato» ya es mañana, y entonces la
 * prueba 6 compararía dos listas vacías y pasaría sin haber comparado nada. Se calcula con la MISMA
 * expresión que usan las dos pantallas, así que las tres hablan del mismo día.
 */
async function hoyAlMediodia(): Promise<Date> {
  const f = await conOrganizacion(esc.org, () =>
    datos()
      .selectNoFrom(
        sql<Date>`date_trunc('day', timezone(${zona}, now())) at time zone ${zona} + interval '12 hours'`.as(
          't',
        ),
      )
      .executeTakeFirstOrThrow(),
  );
  return f.t;
}

/** Un instante de mañana, fuera de cualquier borde de medianoche. */
async function mananaAlMediodia(): Promise<Date> {
  const hoy = await hoyAlMediodia();
  return new Date(hoy.getTime() + 24 * 3600 * 1000);
}

interface CitaEnJson {
  nombre: string;
  telefono: string | null;
  salaUrl: string | null;
}
interface AgendaEnJson {
  dias: { dia: string; citas: CitaEnJson[] }[];
  total: number;
  falta: string | null;
}

/** Los nombres de las citas que la RUTA devuelve, ordenados. Es lo que se compara. */
async function loQueVeEnLaAgenda(
  token: string,
  extra = '',
): Promise<{ nombres: string[]; cuerpo: AgendaEnJson }> {
  const r = await verAgenda(pedirComo(`/api/closer/agenda?dias=15${extra}`, token));
  const { estado, cuerpo } = await leerRespuesta<AgendaEnJson>(r);
  assert.equal(estado, 200, `la Agenda respondió ${estado}: ${JSON.stringify(cuerpo)}`);
  return {
    nombres: cuerpo.dias.flatMap((d) => d.citas.map((c) => c.nombre)).sort(),
    cuerpo,
  };
}

/** Los tres contactos con una cita cada uno, mañana: la mía, la del compañero, y una sin asignar. */
async function tresCitasDeManana(): Promise<void> {
  const cuando = await mananaAlMediodia();
  for (const [nombre, crm] of [
    ['AgendaMia propia', CRM_MIO],
    ['AgendaMia ajena', CRM_AJENO],
    ['AgendaMia sin asignar', null],
  ] as const) {
    const c = await unContacto(esc, { nombre, crmAsignadoA: crm });
    await unaCita(esc, c.id, { inicioEl: cuando, salaUrl: 'https://meet.example/x' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL REPARTO
// ═══════════════════════════════════════════════════════════════════════════════

test('un closer VINCULADO ve en la Agenda solo las citas de sus contactos', async () => {
  await limpiar(esc);
  await sinDesignaciones();
  await tresCitasDeManana();
  await vincular(esc.quien, CRM_MIO);

  const { nombres } = await loQueVeEnLaAgenda(esc.token);
  assert.deepEqual(
    nombres,
    ['AgendaMia propia'],
    'la Agenda le mostró citas que no son suyas: las del compañero, o las que nadie tiene asignadas',
  );
});

test('la cita sin asignar en el CRM no es de ningún closer, y por eso no se reparte', async () => {
  /* Fue la decisión de producto para los contactos —*«solo quien no es closer»*— y una cita hereda
     el dueño del contacto porque no tiene uno propio. Un `or … is null` en la consulta se la daría
     a los tres closers a la vez, y los tres se prepararían para la misma reunión.

     Se cuida con el caso concreto porque ese `or` NO haría fallar nada: las tres agendas seguirían
     devolviendo citas, una de más cada una. */
  await limpiar(esc);
  await sinDesignaciones();
  await tresCitasDeManana();
  await vincular(esc.quien, CRM_MIO);

  const { nombres } = await loQueVeEnLaAgenda(esc.token);
  assert.equal(
    nombres.includes('AgendaMia sin asignar'),
    false,
    'una cita que el CRM no asignó a nadie le apareció a un closer como propia',
  );
});

test('quien NO es closer sigue viendo el calendario entero del territorio', async () => {
  /* La mitad que se rompe en silencio. Un administrador con la Agenda vacía concluye que la empresa
     no tiene nada agendado, y ninguna pantalla lo contradice — es el `11` § 9 otra vez: un cero sin
     medir presentado como un cero medido. */
  await limpiar(esc);
  await sinDesignaciones();
  await tresCitasDeManana();

  const { nombres, cuerpo } = await loQueVeEnLaAgenda(esc.token);
  assert.deepEqual(nombres, ['AgendaMia ajena', 'AgendaMia propia', 'AgendaMia sin asignar']);
  // Y el total sale de la MISMA lista: es la regla de este archivo desde el principio —el conteo y
  // la lista que lo justifica se derivan del mismo dato— y el alcance no la puede romper.
  assert.equal(cuerpo.total, nombres.length, 'el total y la lista dejaron de coincidir');
});

test('un closer DESIGNADO PERO SIN VINCULAR ve todo, y eso es a propósito', async () => {
  /* La salida obvia sería la contraria: no tiene ninguna cita que reclamar, así que «lo suyo» es
     cero. Y una agenda vacía no dice «te falta vincularte»: dice «no tenés reuniones», y esa persona
     no se prepara para ninguna. Fallar mostrando de más es visible y reparable. */
  await limpiar(esc);
  await sinDesignaciones();
  await tresCitasDeManana();
  await conOrganizacion(esc.org, () => asignarCloser(esc.quien, null, esc.quien));

  const { nombres } = await loQueVeEnLaAgenda(esc.token);
  assert.equal(nombres.length, 3, 'un closer sin vincular se quedó con la agenda vacía');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · EL NÚMERO QUE EXPLICA UN CERO TAMBIÉN ES SUYO
// ═══════════════════════════════════════════════════════════════════════════════

test('el motivo del vacío NO cuenta las citas pasadas del compañero', async () => {
  /* `falta` dice, cuando la ventana sale vacía, «de los días anteriores quedaron N citas — así que
     la lectura funcionó». Con N contando las del compañero, el consejo es correcto y el número no es
     suyo: manda a buscar citas que su propia Agenda nunca le va a mostrar, y de paso afirma que su
     calendario tuvo actividad que no tuvo.

     Es el mismo cuidado que esos dos conteos ya tenían por territorio, un piso más adentro. */
  await limpiar(esc);
  await sinDesignaciones();

  const ayer = new Date((await hoyAlMediodia()).getTime() - 24 * 3600 * 1000);
  const delCompanero = await unContacto(esc, { nombre: 'AgendaMia ajena', crmAsignadoA: CRM_AJENO });
  await unaCita(esc, delCompanero.id, { inicioEl: ayer });
  await unaCita(esc, delCompanero.id, { inicioEl: ayer });
  // Y quien mira existe en el territorio, pero sin ninguna cita: ni adelante ni atrás.
  await unContacto(esc, { nombre: 'AgendaMia propia', crmAsignadoA: CRM_MIO });
  await vincular(esc.quien, CRM_MIO);
  await alDiaElBarrido();

  const { cuerpo } = await loQueVeEnLaAgenda(esc.token);
  assert.equal(cuerpo.total, 0, 'la ventana tenía que salir vacía para que `falta` se calcule');
  assert.ok(cuerpo.falta, 'una agenda vacía sin motivo afirma «no tenés citas» sin haberlo medido');
  assert.ok(
    !/\b2 citas\b/.test(cuerpo.falta),
    `el motivo del vacío contó las citas del compañero: «${cuerpo.falta}»`,
  );
  assert.match(
    cuerpo.falta,
    /ni de hoy en adelante ni antes/,
    `el motivo tenía que ser el del calendario propio vacío, y fue: «${cuerpo.falta}»`,
  );
});

test('«hay N citas más adelante» de la cola de hoy también es del propio closer', async () => {
  /* El mismo problema en el otro mensaje, y acá el consejo que trae encima es lo que lo vuelve
     concreto: dice *«se ven en Closer → Agenda»*. Con el número del compañero, esa frase manda a
     una pantalla que va a estar vacía. */
  await limpiar(esc);
  await sinDesignaciones();

  const manana = await mananaAlMediodia();
  const delCompanero = await unContacto(esc, { nombre: 'AgendaMia ajena', crmAsignadoA: CRM_AJENO });
  await unaCita(esc, delCompanero.id, { inicioEl: manana });
  await unaCita(esc, delCompanero.id, { inicioEl: manana });
  await unContacto(esc, { nombre: 'AgendaMia propia', crmAsignadoA: CRM_MIO });
  await vincular(esc.quien, CRM_MIO);
  await alDiaElBarrido();

  const mio = await conOrganizacion(esc.org, async () =>
    porQueNoHayCitasHoy('closer', zona, alcanceDe(esc.quien, await closersDeLaEmpresa())),
  );
  assert.match(
    mio,
    /tampoco en los próximos días/,
    `con dos citas del compañero por delante, el mensaje propio decía: «${mio}»`,
  );

  // Y sin alcance —quien no es closer— el número SÍ está: no se filtra a quien no debía.
  const todo = await conOrganizacion(esc.org, () => porQueNoHayCitasHoy('closer', zona));
  assert.match(todo, /hay 2 citas/, `quien ve todo perdió el conteo del territorio: «${todo}»`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LAS DOS PANTALLAS QUE SE CONTRADECÍAN
// ═══════════════════════════════════════════════════════════════════════════════

test('la Agenda y la cola «Agenda de hoy» de Mi Día muestran LAS MISMAS citas de hoy', async () => {
  /* ══════════════════════════════════════════════════════════════════════════
   * LA PRUEBA QUE SOLO PUEDE FALLAR POR LA CONTRADICCIÓN
   *
   * Las otras miran una pantalla y comparan contra lo que debería. Ésta compara las dos pantallas
   * ENTRE SÍ, y es la que reproduce lo que un closer veía de verdad: la cola de hoy con su cita, y
   * la Agenda —a un clic— con la de sus dos compañeros también.
   *
   * Mi Día no tiene una línea de filtro para las citas: las cruza contra las filas del núcleo de
   * colas, que ya vienen acotadas por el alcance, y descarta la cita cuyo contacto no está. Ese
   * acierto por construcción es lo que hacía que el error de la Agenda pasara por diferencia de
   * criterio y no por defecto.
   * ══════════════════════════════════════════════════════════════════════════ */
  await limpiar(esc);
  await sinDesignaciones();

  const cuando = await hoyAlMediodia();
  for (const [nombre, crm] of [
    ['AgendaMia propia', CRM_MIO],
    ['AgendaMia ajena', CRM_AJENO],
    ['AgendaMia sin asignar', null],
  ] as const) {
    const c = await unContacto(esc, { nombre, crmAsignadoA: crm });
    await unaCita(esc, c.id, { inicioEl: cuando });
  }
  await vincular(esc.quien, CRM_MIO);

  const { cuerpo } = await loQueVeEnLaAgenda(esc.token);
  const enLaAgenda = (cuerpo.dias.find((d) => d.citas.length > 0)?.citas ?? [])
    .map((c) => c.nombre)
    .sort();

  const colas = await conOrganizacion(esc.org, async () =>
    colasDelDia(zona, alcanceDe(esc.quien, await closersDeLaEmpresa())),
  );
  const enMiDia = colas.agenda.map((e) => e.fila.nombre).sort();

  // No vacías: si las dos salieran en cero, la igualdad se cumpliría sin haber comparado nada.
  assert.ok(enMiDia.length > 0, 'la cola de hoy de Mi Día salió vacía: la prueba no compara nada');
  assert.deepEqual(
    enLaAgenda,
    enMiDia,
    'la Agenda y la cola de hoy de Mi Día no coinciden: la misma cita está en una y no en la otra, ' +
      'y las dos listas se ven correctas',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · «VER COMO», Y QUE NO SEA UNA ESCALADA
// ═══════════════════════════════════════════════════════════════════════════════

test('quien ve TODO puede pedir la Agenda de un closer con «ver como»', async () => {
  /* El selector de Inicio ya prometía esto y solo lo cumplía Mi Día: el Pipeline y la Agenda
     seguían mostrando la empresa entera mientras el encabezado anunciaba el nombre elegido. */
  await limpiar(esc);
  await sinDesignaciones();
  await tresCitasDeManana();
  await vincular(companero, CRM_AJENO);

  const { nombres } = await loQueVeEnLaAgenda(esc.token, `&verComo=${companero}`);
  assert.deepEqual(
    nombres,
    ['AgendaMia ajena'],
    'pedir la agenda de un closer devolvió otra cosa que sus citas',
  );
});

test('un closer VINCULADO que manda «ver como» recibe su propia Agenda igual', async () => {
  /* La forma que tiene una escalada: la petición elige de quién ver las citas. Lo que la cierra es
     que `alcancePedido` solo la atiende cuando el alcance PROPIO es `todo`.

     Y se IGNORA en vez de rechazarse, a propósito: un 403 acá sería un oráculo — le confirmaría a
     quien prueba que ese identificador existe y es closer. */
  await limpiar(esc);
  await sinDesignaciones();
  await tresCitasDeManana();
  await vincular(esc.quien, CRM_MIO);
  await vincular(companero, CRM_AJENO);

  const { nombres } = await loQueVeEnLaAgenda(tokenDelCompanero, `&verComo=${esc.quien}`);
  assert.deepEqual(
    nombres,
    ['AgendaMia ajena'],
    'un closer vinculado se llevó la agenda de otro pidiéndola en la URL',
  );
});

/**
 * El barrido, marcado como corrido y al día.
 *
 * Sin esto, `falta` contesta con los dos primeros estados —«todavía no se leyó el calendario» o «el
 * último barrido quedó incompleto»— y las pruebas del motivo del vacío pasarían mirando un mensaje
 * que no es el que dicen medir.
 */
async function alDiaElBarrido(): Promise<void> {
  await esc.admin.query(
    `insert into negocio.ingesta_pulso (org_id, clave, ultima_corrida_el, atrasado)
     values ($1, 'citas', now(), false)
     on conflict (org_id, clave) do update set ultima_corrida_el = now(), atrasado = false`,
    [esc.org],
  );
}
