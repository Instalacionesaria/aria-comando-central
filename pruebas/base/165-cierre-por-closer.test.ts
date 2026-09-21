// La tabla por closer, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO PROTEGE ES UNA EVALUACIÓN DE PERSONAS CON NOMBRE
//
// La tabla que este módulo alimenta pone tres nombres reales al lado de tasas. El defecto que más
// importa acá no es un número mal sumado: es un número plausible que califica mal a alguien.
//
// ── EL CRUCE DE EJES NO DESVÍA LA TABLA: LA DA VUELTA ──────────────────────
//
// Medido contra producción el 2026-09-21, con los tres closers configurados:
//
//     Q  94 citas  ·  0 resultados
//     V  20 citas  ·  5 resultados
//     G   7 citas  ·  2 resultados   ← los únicos de los últimos catorce días
//
// Quien tiene 94 de las 136 citas no registró nada, y quien tiene 7 registró toda la actividad
// reciente. Un `registrado_por` donde va `crm_asignado_a` —el defecto que `inicio.ts:123-125`
// anticipa— no mueve las cifras unos puntos: **intercambia las filas**. Por eso los dos ejes tienen
// su propia prueba y se siembran cruzados a propósito.
//
// ── Y LA ASISTENCIA TIENE SU CASO REAL EN LA BASE ──────────────────────────
//
// Los dos únicos resultados recientes son dos `no_show`, y `citas.asistio` es nulo en las 327 filas
// de la base. Deducir la asistencia de la salida publicaría «0 % de asistencia sobre 2»: plausible,
// alarmante y falso. Hay una prueba para cada mitad — con la columna nula y con la columna
// respondida.
//
// ── EL PISO ES DEL DENOMINADOR DE LA FILA, NUNCA DE LA FILA ────────────────
//
// Borrar la fila de quien tiene 9 citas afirma que esa persona no trabaja acá. Se muestra la fila
// con sus conteos y sin tasas, y eso tiene dos pruebas: que la fila sigue estando y que la tasa no.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { cierrePorCloser, type CierreDeUnCloser } from '../../lib/negocio/cierrePorCloser.ts';
import { PISO_DE_UNA_TASA } from '../../lib/negocio/indicadoresDeCitas.ts';

let esc: Escenario;

const CONTACTO = 'cierre-';
const CORREO = '@cierre.ejemplo';
const CRM_A = 'crm-cierre-a';
const CRM_B = 'crm-cierre-b';
const CRM_C = 'crm-cierre-c';
/** Un usuario del CRM que existe en los contactos y que nadie designó closer. */
const CRM_AJENO = 'crm-cierre-ajeno';

async function limpiar(): Promise<void> {
  const mios = 'select id from negocio.contactos where ghl_contact_id like $1';
  await esc.admin.query(`delete from negocio.resultados where contacto_id in (${mios})`, [`${CONTACTO}%`]);
  await esc.admin.query(`delete from negocio.citas where contacto_id in (${mios})`, [`${CONTACTO}%`]);
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${CONTACTO}%`]);
  await esc.admin.query('delete from negocio.closer_asignado where org_id = $1', [esc.org]);
  /* Las personas se borran DESPUÉS de las designaciones: la clave foránea las sostiene, y al revés
     falla con un error que no menciona ni los closers (lo aprendió `88-alcance-del-closer`). */
  await esc.admin.query('delete from identidad.usuarios where email like $1', [`%${CORREO}`]);
}

/**
 * Una persona REAL de la organización.
 *
 * No sirve inventar un uuid: `closer_asignado` tiene una clave foránea COMPUESTA contra
 * `(org_id, id)` de `usuarios`, que es lo que impide designar closer a alguien de otra empresa.
 */
async function unaPersona(nombre: string): Promise<string> {
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash, creado_por)
     values ($1, $2, $3, 'scrypt$16384$8$1$c2FsCg==$aGFzaAo=', null) returning id`,
    [esc.org, nombre, `${randomUUID().slice(0, 8)}${CORREO}`],
  );
  return rows[0]!.id;
}

/**
 * Designa a alguien closer.
 *
 * `haceDias` fija `actualizado_el`, que es lo que ordena las filas: más días = designado antes = más
 * arriba. Se pasa explícito para que el orden de la tabla no dependa del orden de los `insert`.
 */
async function designar(usuarioId: string, crmId: string | null, haceDias: number): Promise<void> {
  await esc.admin.query(
    `insert into negocio.closer_asignado (org_id, usuario_id, crm_usuario_id, actualizado_el, actualizado_por)
     values ($1, $2, $3, now() - make_interval(days => $4), null)`,
    [esc.org, usuarioId, crmId, haceDias],
  );
}

interface CitaSembrada {
  /** **Negativo para el pasado**, como en `163-cadena-de-cierre`. Positivo = cita futura. */
  haceHoras: number;
  estado?: string;
  congelada?: boolean;
  asistio?: boolean;
  /** `citas.crm_asignado_a`, que NO es el eje de esta tabla. Se siembra para probar que no se usa. */
  crmDeLaCita?: string;
}

/** Un contacto asignado en el CRM a `crmAsignadoA`, con sus citas y sus resultados. */
async function unContacto(o: {
  crmAsignadoA: string | null;
  /** Una etiqueta REAL de `ETIQUETAS_DE_DESCARTE`. `'descartado'` no está en esa lista. */
  descartado?: boolean;
  citas?: CitaSembrada[];
  resultados?: { salida: string; registradoPor: string }[];
}): Promise<string> {
  const ghl = `${CONTACTO}${randomUUID().slice(0, 8)}`;
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos
       (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, crm_asignado_a, etiquetas)
     values ($1, $2, 'Lead de prueba', 'closer', now() - interval '2 days', $3, $4::text[])
     returning id`,
    [esc.org, ghl, o.crmAsignadoA, o.descartado ? ['rechazado'] : []],
  );
  const id = rows[0]!.id;

  for (const [i, c] of (o.citas ?? []).entries()) {
    await esc.admin.query(
      `insert into negocio.citas
         (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el,
          estado_ghl, asistio, crm_asignado_a)
       values ($1, $2, $3, $4,
               now() + make_interval(secs => $5::float8),
               now() + make_interval(secs => $5::float8) + interval '1 hour', $6, $7, $8)`,
      [
        esc.org,
        id,
        `cita-${ghl}-${i}`,
        c.congelada ? null : 'cal-cierre',
        c.haceHoras * 3600,
        c.estado ?? 'confirmed',
        c.asistio ?? null,
        c.crmDeLaCita ?? null,
      ],
    );
  }

  for (const r of o.resultados ?? []) {
    await esc.admin.query(
      `insert into negocio.resultados (org_id, contacto_id, salida, rol, registrado_por, creado_el)
         values ($1, $2, $3, 'closer', $4, now() - interval '1 hour')`,
      [esc.org, id, r.salida, r.registradoPor],
    );
  }
  return id;
}

/** `n` citas pasadas, una por hora hacia atrás. */
function pasadas(n: number, base: Omit<CitaSembrada, 'haceHoras'> = {}): CitaSembrada[] {
  return Array.from({ length: n }, (_, i) => ({ haceHoras: -(i + 1), ...base }));
}

const leer = (dias = 14) => conOrganizacion(esc.org, () => cierrePorCloser(dias));

/** La fila de una persona, por nombre. Falla con un mensaje útil si no está. */
function fila(filas: CierreDeUnCloser[], nombre: string): CierreDeUnCloser {
  const f = filas.find((x) => x.nombre === nombre);
  assert.ok(f, `no hay fila para ${nombre}; hay: ${filas.map((x) => x.nombre).join(', ') || '(ninguna)'}`);
  return f;
}

before(async () => {
  esc = await montar('CierrePorCloser');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LAS FILAS SALEN DEL CATÁLOGO, NO DE UN `group by`
// ═══════════════════════════════════════════════════════════════════════════════

test('el closer designado SIN actividad tiene fila con ceros medidos, no una ausencia', async () => {
  /* Un `group by` sólo devuelve a quien tiene filas, así que este closer desaparecería — y su
     ausencia de la tabla se lee como «no está configurado», que es el hecho OPUESTO a «no registró
     nada». Se cuida con el caso concreto porque un `group by` no falla: devuelve una tabla más
     corta y perfectamente creíble. */
  await limpiar();
  const grande = await unaPersona('Con citas');
  const quieto = await unaPersona('Sin nada');
  await designar(grande, CRM_A, 3);
  await designar(quieto, CRM_B, 2);
  await unContacto({ crmAsignadoA: CRM_A, citas: pasadas(12) });

  const r = await leer();
  assert.equal(r.filas.length, 2, 'el closer sin actividad no tiene fila: la tabla salió de un `group by`');

  const f = fila(r.filas, 'Sin nada');
  assert.equal(f.citas, 0, 'el closer vinculado y sin citas tiene que ser cero MEDIDO, no nulo');
  assert.equal(f.contactos, 0);
  assert.equal(f.intentos, 0);
  assert.equal(f.tasaDeCancelacion, null, 'una tasa sobre cero citas no es cero: no existe');
  assert.match(f.aviso ?? '', /ninguna cita/i, 'la fila vacía no dice por qué está vacía');
});

test('el orden es el de la designación: ni por tamaño ni por tasa, en ninguna dirección', async () => {
  /* Las cuatro ordenaciones tentadoras dan cuatro órdenes DISTINTOS del de designación, y por eso la
     siembra tiene tres filas con tamaños y tasas cruzados: con dos, «ascendente» coincide con el
     orden correcto y el mutante sobrevive.
     *
     El motivo de fondo es el de producción: con 94, 20 y 7 citas, cualquier orden por tasa pone
     primero al de menos volumen y la pantalla lo lee como el mejor. */
  await limpiar();
  const a = await unaPersona('Primero');   // 12 citas, 1 cancelada  → 0,083
  const b = await unaPersona('Segundo');   // 20 citas, 10 canceladas → 0,500
  const c = await unaPersona('Tercero');   // 15 citas, 5 canceladas  → 0,333
  await designar(a, CRM_A, 5);
  await designar(b, CRM_B, 4);
  await designar(c, CRM_C, 3);
  await unContacto({ crmAsignadoA: CRM_A, citas: [...pasadas(11), { haceHoras: -20, estado: 'cancelled' }] });
  await unContacto({ crmAsignadoA: CRM_B, citas: [...pasadas(10), ...pasadas(10).map((x) => ({ ...x, haceHoras: x.haceHoras - 30, estado: 'cancelled' }))] });
  await unContacto({ crmAsignadoA: CRM_C, citas: [...pasadas(10), ...pasadas(5).map((x) => ({ ...x, haceHoras: x.haceHoras - 60, estado: 'cancelled' }))] });

  const r = await leer();
  assert.deepEqual(
    r.filas.map((f) => f.nombre),
    ['Primero', 'Segundo', 'Tercero'],
    'la tabla se reordenó: con tasas de 0,083 · 0,500 · 0,333 y tamaños de 12 · 20 · 15, ' +
      'cualquier orden por tasa o por tamaño da otro resultado',
  );
  /* Y las tasas son las que la siembra dice, que es lo que hace que el orden de arriba signifique
     algo: sin esto el `deepEqual` pasaría con tres filas vacías. */
  assert.equal(fila(r.filas, 'Primero').tasaDeCancelacion, 0.083);
  assert.equal(fila(r.filas, 'Segundo').tasaDeCancelacion, 0.5);
  assert.equal(fila(r.filas, 'Tercero').tasaDeCancelacion, 0.333);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · EL PISO, Y LOS DOS NULOS QUE NO SON CERO
// ═══════════════════════════════════════════════════════════════════════════════

test('el piso es del DENOMINADOR de la fila: con 9 citas quedan los conteos y no la tasa', async () => {
  await limpiar();
  const chico = await unaPersona('Nueve citas');
  const grande = await unaPersona('Doce citas');
  await designar(chico, CRM_A, 3);
  await designar(grande, CRM_B, 2);
  await unContacto({
    crmAsignadoA: CRM_A,
    citas: [...pasadas(5), ...pasadas(4).map((x) => ({ ...x, haceHoras: x.haceHoras - 10, estado: 'cancelled' }))],
  });
  await unContacto({ crmAsignadoA: CRM_B, citas: pasadas(12) });

  const r = await leer();
  const f = fila(r.filas, 'Nueve citas');
  assert.equal(f.citas, 9, 'la fila bajo el piso perdió sus conteos');
  assert.equal(f.canceladas, 4);
  assert.equal(
    f.tasaDeCancelacion,
    null,
    `con ${PISO_DE_UNA_TASA - 1} citas la tasa no puede existir: el próximo registro la movería once puntos`,
  );
  assert.equal(r.filas.length, 2, 'la fila bajo el piso se borró, y eso afirma que esa persona no trabaja acá');
  assert.notEqual(fila(r.filas, 'Doce citas').tasaDeCancelacion, null, 'el piso se aplicó de más');
  assert.equal(r.bajoElPiso, 1);
});

test('un closer designado y SIN vincular tiene el eje del CRM en `null`, no en cero', async () => {
  /* Las dos cosas mandan a hacer cosas distintas: una a vincular al closer con su usuario del CRM,
     la otra a mirar por qué no le llegan citas. Un `?? 0` las escribe igual y la primera desaparece.
     Hoy los tres closers de producción están vinculados, así que este caso NO lo cubre ninguna fila
     real: esta prueba es su única cobertura. */
  await limpiar();
  const suelto = await unaPersona('Sin vincular');
  await designar(suelto, null, 3);
  await unContacto({ crmAsignadoA: CRM_A, citas: pasadas(12) });

  const f = fila((await leer()).filas, 'Sin vincular');
  assert.equal(f.citas, null, 'sin vínculo al CRM no es que tenga cero citas: es que no hay dónde buscarlas');
  assert.equal(f.contactos, null);
  assert.equal(f.canceladas, null);
  assert.equal(f.conAsistencia, null);
  assert.equal(f.tasaDeCancelacion, null);
  /* El eje NUESTRO sí existe siempre: lo que registró esta persona se sabe sin pasar por el CRM. */
  assert.equal(f.intentos, 0, 'el eje propio no depende del vínculo y no puede ser nulo');
  assert.match(f.aviso ?? '', /vinculad/i);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LOS DOS EJES
// ═══════════════════════════════════════════════════════════════════════════════

test('los dos ejes caen en filas distintas: cruzarlos da vuelta la tabla', async () => {
  /* La siembra reproduce producción: quien tiene todas las citas no registró nada, y quien registró
     todo no tiene ninguna cita. Es el caso donde cruzar los ejes no desvía la tabla unos puntos —la
     intercambia—, y por eso las dos afirmaciones van juntas en la misma prueba. */
  await limpiar();
  const conCitas = await unaPersona('Tiene las citas');
  const conRegistros = await unaPersona('Registró todo');
  await designar(conCitas, CRM_A, 3);
  await designar(conRegistros, CRM_B, 2);
  /* El contacto es de CRM_A y los tres resultados los cargó la OTRA persona. */
  await unContacto({
    crmAsignadoA: CRM_A,
    citas: pasadas(12),
    resultados: [
      { salida: 'seguimiento', registradoPor: conRegistros },
      { salida: 'seguimiento', registradoPor: conRegistros },
      { salida: 'no_interesa', registradoPor: conRegistros },
    ],
  });

  const r = await leer();
  const citas = fila(r.filas, 'Tiene las citas');
  const registros = fila(r.filas, 'Registró todo');

  assert.equal(citas.citas, 12, 'las citas se fueron a la fila de quien registró');
  assert.equal(citas.intentos, 0, 'lo registrado por otro apareció en esta fila');
  assert.equal(registros.citas, 0, 'las citas del contacto de OTRO closer entraron por el eje equivocado');
  assert.equal(registros.intentos, 3, 'lo que esta persona registró no llegó a su fila');
});

test('las citas se cuentan por el asignatario del CONTACTO, no por `citas.crm_asignado_a`', async () => {
  /* `citas.crm_asignado_a` existe y es un tercer identificador. Medido en producción difiere del
     asignatario del contacto en 38 de las 134 citas del closer más grande, así que usarlo mueve más
     de una cuarta parte de la tabla. La cita no tiene dueño propio: es del contacto
     (`agenda.ts:286-287`). */
  await limpiar();
  const delContacto = await unaPersona('Dueño del contacto');
  const deLaCita = await unaPersona('Dueño de la cita');
  await designar(delContacto, CRM_A, 3);
  await designar(deLaCita, CRM_B, 2);
  await unContacto({ crmAsignadoA: CRM_A, citas: pasadas(12, { crmDeLaCita: CRM_B }) });

  const r = await leer();
  assert.equal(fila(r.filas, 'Dueño del contacto').citas, 12, 'la consulta usó `citas.crm_asignado_a`');
  assert.equal(fila(r.filas, 'Dueño de la cita').citas, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LA VENTANA Y LOS DOS FILTROS COMPARTIDOS
// ═══════════════════════════════════════════════════════════════════════════════

test('la cita FUTURA no entra: su cancelación todavía no es un hecho', async () => {
  await limpiar();
  const p = await unaPersona('Con futuras');
  await designar(p, CRM_A, 3);
  await unContacto({
    crmAsignadoA: CRM_A,
    citas: [...pasadas(12), { haceHoras: 5 }, { haceHoras: 30 }, { haceHoras: 60, estado: 'cancelled' }],
  });

  const f = fila((await leer()).filas, 'Con futuras');
  assert.equal(f.citas, 12, 'entraron citas que todavía no ocurrieron');
  assert.equal(f.canceladas, 0, 'una cancelación futura entró en el numerador');
});

test('la cita más vieja que la ventana no entra, y `dias` es lo que la mueve', async () => {
  await limpiar();
  const p = await unaPersona('Con viejas');
  await designar(p, CRM_A, 3);
  await unContacto({
    crmAsignadoA: CRM_A,
    citas: [...pasadas(12), ...pasadas(5).map((x) => ({ ...x, haceHoras: x.haceHoras - 40 * 24 })) ],
  });

  assert.equal(fila((await leer(14)).filas, 'Con viejas').citas, 12, 'la ventana de 14 días no recortó nada');
  assert.equal(
    fila((await leer(3650)).filas, 'Con viejas').citas,
    17,
    '`dias` no llega a la consulta: la ventana quedó fija',
  );
});

test('las citas congeladas no entran: el barrido ya no puede refrescarlas', async () => {
  await limpiar();
  const p = await unaPersona('Con congeladas');
  await designar(p, CRM_A, 3);
  await unContacto({
    crmAsignadoA: CRM_A,
    citas: [
      ...pasadas(12),
      ...pasadas(5).map((x) => ({ ...x, haceHoras: x.haceHoras - 10, congelada: true, estado: 'cancelled' })),
    ],
  });

  const f = fila((await leer()).filas, 'Con congeladas');
  assert.equal(f.citas, 12, 'el filtro `alcanzable` no se aplicó: el denominador se infló con las congeladas');
  assert.equal(f.canceladas, 0, 'las cancelaciones de las congeladas entraron en el numerador');
});

test('las citas de un contacto DESCARTADO no entran: el descarte propio no es una pérdida', async () => {
  /* El 94,4 % de cancelación de los descartados es la automatización de la casa cancelando lo que ya
     había rechazado, no la conducta de nadie — es lo que el commit `9931f4d` corrigió
     (`lib/ghl/contrato.ts:200-212`). Atribuírselo a un closer es el peor defecto posible de esta
     tabla: le carga una tasa altísima por algo que no hizo.
     *
     La etiqueta sembrada es `'rechazado'`, que SÍ está en `ETIQUETAS_DE_DESCARTE`. */
  await limpiar();
  const p = await unaPersona('Con descartados');
  await designar(p, CRM_A, 3);
  await unContacto({ crmAsignadoA: CRM_A, citas: pasadas(12) });
  await unContacto({
    crmAsignadoA: CRM_A,
    descartado: true,
    citas: pasadas(9).map((x) => ({ ...x, haceHoras: x.haceHoras - 30, estado: 'cancelled' })),
  });

  const f = fila((await leer()).filas, 'Con descartados');
  assert.equal(f.citas, 12, 'el filtro `descartado` no se aplicó');
  assert.equal(f.canceladas, 0, 'las cancelaciones del flujo de descarte se le atribuyeron al closer');
  assert.equal(f.tasaDeCancelacion, 0);
});

test('`contactos` son PERSONAS distintas, y no el conteo de citas con otro rótulo', async () => {
  /* Medido: 94 citas son 82 personas. Publicar el conteo de citas bajo el rótulo «Personas» es el
     defecto que `citasAlcanzables.ts:19-30` mide y nombra, y es invisible porque las dos consultas
     están bien escritas. */
  await limpiar();
  const p = await unaPersona('Seis personas');
  await designar(p, CRM_A, 3);
  for (let i = 0; i < 6; i++) {
    await unContacto({ crmAsignadoA: CRM_A, citas: pasadas(2, {}).map((x) => ({ ...x, haceHoras: x.haceHoras - i * 5 })) });
  }

  const f = fila((await leer()).filas, 'Seis personas');
  assert.equal(f.citas, 12);
  assert.equal(f.contactos, 6, 'se publicó el conteo de citas con el rótulo de personas');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LA ASISTENCIA Y LA VENTA
// ═══════════════════════════════════════════════════════════════════════════════

test('la asistencia sale de `citas.asistio` y NUNCA de la salida registrada', async () => {
  /* El caso está en producción: los dos únicos resultados recientes son dos `no_show` y las citas de
     esas personas tienen `asistio` nulo. Un mutante que dedujera la asistencia de la salida diría
     «0 % de asistencia sobre 2» — plausible, alarmante y falso. El catálogo ya documenta por qué se
     sacó «No-show» de las opciones de `nurture` (`salidas.ts:183-196`). */
  await limpiar();
  const p = await unaPersona('Con no shows');
  await designar(p, CRM_A, 3);
  await unContacto({
    crmAsignadoA: CRM_A,
    citas: pasadas(12),
    resultados: Array.from({ length: 4 }, () => ({ salida: 'no_show', registradoPor: p })),
  });

  const f = fila((await leer()).filas, 'Con no shows');
  assert.equal(f.conAsistencia, 0, 'la asistencia se dedujo de la salida: 12 citas sin responder dieron denominador');
  assert.equal(f.sePresentaron, 0);
  assert.equal(f.tasaDeAsistencia, null, 'sin una sola respuesta la tasa no es 0 %: no existe');
  assert.equal(f.intentos, 4, 'los cuatro `no_show` sí son lo que esta persona registró');
  assert.deepEqual(f.porSalida, { no_show: 4 });
});

test('el PLANTÓN del calendario se publica aparte, y no entra en la tasa de asistencia', async () => {
  /* Censo de `estado_ghl` del 2026-09-21: **cancelled 163 · confirmed 149 · noshow 15**. Quince
     citas marcadas como plantón por el calendario, las quince alcanzables, y `showed` cero veces.
     *
     O sea que la asistencia NO está completamente a oscuras como todo este departamento venía
     afirmando: el lado negativo se observa y el positivo no. Esta prueba fija las dos mitades —que
     el conteo existe, y que no se mete en `tasaDeAsistencia`, que sigue siendo de `citas.asistio`—
     porque sumarlas daría un show rate con dos definiciones adentro. */
  await limpiar();
  const p = await unaPersona('Con plantones');
  await designar(p, CRM_A, 3);
  await unContacto({
    crmAsignadoA: CRM_A,
    citas: [
      ...pasadas(8, { estado: 'noshow' }),
      ...pasadas(4).map((x) => ({ ...x, haceHoras: x.haceHoras - 20 })),
    ],
  });

  const f = fila((await leer()).filas, 'Con plantones');
  assert.equal(f.citas, 12, 'un plantón no es una cancelación y no puede salir del denominador');
  assert.equal(f.canceladas, 0, 'el plantón se contó como cancelación: son dos hechos distintos');
  assert.equal(f.noShowDelCalendario, 8, 'la única señal de asistencia que existe no se publica');
  assert.equal(f.conAsistencia, 0, 'el plantón del calendario se coló en el denominador de `asistio`');
  assert.equal(f.tasaDeAsistencia, null, 'se publicó una tasa de asistencia mezclando las dos fuentes');
  assert.match(f.aviso ?? '', /8 plantones/, 'la celda vacía con 8 plantones al lado no se explica');
  assert.match(f.aviso ?? '', /otra fuente/i);
});

test('con la asistencia RESPONDIDA la tasa sale, y el denominador son solo las respondidas', async () => {
  await limpiar();
  const p = await unaPersona('Con asistencia');
  await designar(p, CRM_A, 3);
  await unContacto({
    crmAsignadoA: CRM_A,
    citas: [
      ...pasadas(7, { asistio: true }),
      ...pasadas(3).map((x) => ({ ...x, haceHoras: x.haceHoras - 10, asistio: false })),
      /* Cinco sin responder, que NO pueden entrar al denominador: con ellas la tasa daría 0,467 y
         diría que se presenta la mitad. */
      ...pasadas(5).map((x) => ({ ...x, haceHoras: x.haceHoras - 20 })),
    ],
  });

  const f = fila((await leer()).filas, 'Con asistencia');
  assert.equal(f.citas, 15);
  assert.equal(f.conAsistencia, 10, 'el denominador de la asistencia no son las citas: son las respondidas');
  assert.equal(f.sePresentaron, 7);
  assert.equal(f.tasaDeAsistencia, 0.7, 'las cinco sin responder se colaron en el denominador');
});

test('`ventas` es `venta` y nunca `venta_chica`: son dos negocios y no se suman', async () => {
  /* `lib/negocio/etapas.ts:86-94`. Un `like '%venta%'` o una suma de las dos da un número más grande
     y creíble, y además le acredita al closer la venta del setter. */
  await limpiar();
  const p = await unaPersona('Con ventas');
  await designar(p, CRM_A, 3);
  await unContacto({
    crmAsignadoA: CRM_A,
    citas: pasadas(12),
    resultados: [
      ...Array.from({ length: 3 }, () => ({ salida: 'venta', registradoPor: p })),
      ...Array.from({ length: 4 }, () => ({ salida: 'venta_chica', registradoPor: p })),
      ...Array.from({ length: 2 }, () => ({ salida: 'acuerdo_sin_pago', registradoPor: p })),
      { salida: 'seguimiento', registradoPor: p },
    ],
  });

  const f = fila((await leer()).filas, 'Con ventas');
  assert.equal(f.ventas, 3, 'se sumó `venta_chica` o `acuerdo_sin_pago` a las ventas');
  assert.equal(f.intentos, 10);
  assert.equal(f.tasaDeCierre, 0.3);
  /* Y las otras salidas no se pierden ni se fuerzan a una rama del catálogo: se cuentan por su
     nombre, tal como están en la base. */
  assert.deepEqual(f.porSalida, { venta: 3, venta_chica: 4, acuerdo_sin_pago: 2, seguimiento: 1 });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · LO QUE NO ES DE NADIE, Y EL TOTAL QUE NO SE PUBLICA
// ═══════════════════════════════════════════════════════════════════════════════

test('las filas no suman la ventana, y los DOS motivos van separados', async () => {
  /* Son dos hechos que llevan a acciones opuestas: uno se arregla asignando el contacto en el CRM,
     el otro designando closer a esa persona acá. Y el segundo sólo existe porque las filas salen del
     catálogo: sin este término, las citas de alguien que nadie designó desaparecen de la pantalla sin
     dejar rastro. */
  await limpiar();
  const p = await unaPersona('El único closer');
  await designar(p, CRM_A, 3);
  await unContacto({ crmAsignadoA: CRM_A, citas: pasadas(12) });
  await unContacto({ crmAsignadoA: null, citas: pasadas(5).map((x) => ({ ...x, haceHoras: x.haceHoras - 20 })) });
  await unContacto({ crmAsignadoA: CRM_AJENO, citas: pasadas(7).map((x) => ({ ...x, haceHoras: x.haceHoras - 40 })) });

  const r = await leer();
  assert.equal(r.fueraDeLasFilas.sinAsignar.citas, 5);
  assert.equal(r.fueraDeLasFilas.deAlguienQueNoEsCloser.citas, 7, 'las citas de quien nadie designó closer se perdieron');
  assert.deepEqual(r.coberturaDeLaTabla, { con: 12, sobre: 24 });

  /* La identidad que hace verificable a la cobertura: lo de las filas más los dos buckets es el
     total de la ventana. Sin ella, `sobre` puede ser cualquier número plausible. */
  const enFilas = r.filas.reduce((s, f) => s + (f.citas ?? 0), 0);
  assert.equal(
    enFilas + r.fueraDeLasFilas.sinAsignar.citas + r.fueraDeLasFilas.deAlguienQueNoEsCloser.citas,
    r.coberturaDeLaTabla.sobre,
    'las citas de la ventana no cierran: hay un bucket que no se publica',
  );
  assert.match(r.aviso ?? '', /sin closer asignado/i);
  assert.match(r.aviso ?? '', /no está designado/i);
});

test('la suma de las filas NO se publica como total de la empresa', async () => {
  /* Medido en producción: 340 de 590 contactos no son de nadie. Una fila «Total» al pie de esta tabla
     afirmaría que la empresa es la suma de sus closers, y no lo es. Lo que sí se publica es la
     COBERTURA, que dice lo mismo sin afirmarlo. */
  await limpiar();
  const p = await unaPersona('Uno solo');
  await designar(p, CRM_A, 3);
  await unContacto({ crmAsignadoA: CRM_A, citas: pasadas(12) });
  await unContacto({ crmAsignadoA: null, citas: pasadas(4).map((x) => ({ ...x, haceHoras: x.haceHoras - 20 })) });

  const r = await leer();
  const claves = [...Object.keys(r), ...r.filas.flatMap((f) => Object.keys(f))];
  assert.deepEqual(
    claves.filter((k) => /total|suma|global/i.test(k)),
    [],
    'apareció una clave de total: la tabla no suma la empresa y no puede decir que sí',
  );
  assert.equal(r.filas.some((f) => /total/i.test(f.nombre)), false, 'hay una fila de total disfrazada de closer');
  assert.equal(r.coberturaDeLaTabla.con, 12);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7 · LA CONCENTRACIÓN, EL PISO DE LA TABLA Y LA REGLA DEL SILENCIO
// ═══════════════════════════════════════════════════════════════════════════════

test('la concentración es `null` con un solo closer y se mide con dos', async () => {
  /* Con una sola fila no hay concentración de la que hablar: `1` diría «un closer se lleva el 100 %»
     de una tabla donde no hay nadie más, que es una alarma sobre nada. */
  await limpiar();
  const solo = await unaPersona('Solo uno');
  await designar(solo, CRM_A, 3);
  await unContacto({ crmAsignadoA: CRM_A, citas: pasadas(12) });
  assert.equal((await leer()).concentracion, null, 'con un solo closer se publicó una concentración');

  const otro = await unaPersona('El chico');
  await designar(otro, CRM_B, 2);
  await unContacto({ crmAsignadoA: CRM_B, citas: pasadas(4).map((x) => ({ ...x, haceHoras: x.haceHoras - 20 })) });

  const r = await leer();
  assert.equal(r.concentracion, 0.75, 'la concentración no es la porción de las citas de las FILAS');
  assert.match(r.aviso ?? '', /75 % de las citas/, 'el desbalance no se avisa, y sin eso comparar las filas engaña');
});

test('la concentración se mide sobre las citas de las FILAS, no sobre el total de la ventana', async () => {
  /* Dividir por el total de la ventana la diluye con las citas que no son de nadie, y entonces el
     aviso se apaga justo cuando más hace falta: la base con más huérfanos es la que peor se compara.
     Con 12 y 4 en filas y 20 sin asignar, el mutante daría 0,33 y no avisaría nada. */
  await limpiar();
  const a = await unaPersona('Grande');
  const b = await unaPersona('Chico');
  await designar(a, CRM_A, 3);
  await designar(b, CRM_B, 2);
  await unContacto({ crmAsignadoA: CRM_A, citas: pasadas(12) });
  await unContacto({ crmAsignadoA: CRM_B, citas: pasadas(4).map((x) => ({ ...x, haceHoras: x.haceHoras - 20 })) });
  await unContacto({ crmAsignadoA: null, citas: pasadas(10).map((x) => ({ ...x, haceHoras: x.haceHoras - 40 })) });
  await unContacto({ crmAsignadoA: null, citas: pasadas(10).map((x) => ({ ...x, haceHoras: x.haceHoras - 60 })) });

  const r = await leer();
  assert.equal(r.coberturaDeLaTabla.sobre, 36, 'la siembra no es la que esta prueba cree');
  assert.equal(r.concentracion, 0.75, 'la concentración se diluyó con las citas que no son de nadie');
});

test('`bajoElPiso` cuenta sólo las filas sin NINGUNA tasa', async () => {
  /* La fila con 12 citas no tiene tasa de cierre ni de asistencia —nadie registró nada, nadie
     respondió— y aun así es comparable por cancelación. Contarla como «bajo el piso» diría que de
     ella no se puede decir nada, y sí se puede. */
  await limpiar();
  const comparable = await unaPersona('Comparable');
  const muyChico = await unaPersona('Muy chico');
  await designar(comparable, CRM_A, 3);
  await designar(muyChico, CRM_B, 2);
  await unContacto({ crmAsignadoA: CRM_A, citas: pasadas(12) });
  await unContacto({ crmAsignadoA: CRM_B, citas: pasadas(5).map((x) => ({ ...x, haceHoras: x.haceHoras - 20 })) });

  const r = await leer();
  assert.equal(fila(r.filas, 'Comparable').tasaDeAsistencia, null);
  assert.equal(fila(r.filas, 'Comparable').tasaDeCierre, null);
  assert.equal(
    r.bajoElPiso,
    1,
    'se contó como bajo el piso una fila que sí tiene una tasa: con dos, el aviso describe una tabla que no es ésta',
  );
  assert.match(r.aviso ?? '', /1 fila\(s\)/);
});

test('sin ningún closer configurado la tabla lo dice, y no dibuja una tabla vacía', async () => {
  await limpiar();
  await unContacto({ crmAsignadoA: CRM_A, citas: pasadas(12) });

  const r = await leer();
  assert.deepEqual(r.filas, []);
  assert.match(r.aviso ?? '', /ningún closer configurado/i);
  assert.equal(r.concentracion, null);
  assert.equal(r.bajoElPiso, 0);
});

test('la fila a la que no le falta nada no dice nada: el aviso es `null`, no vacío', async () => {
  /* La regla del silencio, y la mutación la encontró: la prueba del Markdown de más abajo barre los
     avisos que HAY, y en su siembra todas las filas tienen algo que decir — así que un
     `return partes.join(' ')` sin el `null` sobrevivía.
     *
     El string vacío no es inocuo: la celda dibuja la caja del aviso con nada adentro, y eso se lee
     como un aviso que no cargó. `null` significa que la pantalla no dibuja nada. */
  await limpiar();
  const p = await unaPersona('Nada que decir');
  await designar(p, CRM_A, 3);
  await unContacto({
    crmAsignadoA: CRM_A,
    citas: [...pasadas(10, { asistio: true }), ...pasadas(2).map((x) => ({ ...x, haceHoras: x.haceHoras - 20 }))],
    resultados: [
      { salida: 'venta', registradoPor: p },
      { salida: 'seguimiento', registradoPor: p },
    ],
  });

  const f = fila((await leer()).filas, 'Nada que decir');
  assert.equal(f.citas, 12, 'la siembra no es la que esta prueba cree');
  assert.equal(f.conAsistencia, 10);
  assert.equal(f.intentos, 2);
  assert.equal(f.aviso, null, 'una fila completa dibujaría una caja de aviso vacía');
});

test('ningún aviso lleva Markdown: los dibuja una pantalla que los pone como texto', async () => {
  await limpiar();
  const a = await unaPersona('Uno');
  const b = await unaPersona('Sin vincular');
  await designar(a, CRM_A, 3);
  await designar(b, null, 2);
  await unContacto({ crmAsignadoA: CRM_A, citas: pasadas(5) });
  await unContacto({ crmAsignadoA: null, citas: pasadas(4).map((x) => ({ ...x, haceHoras: x.haceHoras - 20 })) });

  const r = await leer();
  const textos = [r.aviso, ...r.filas.map((f) => f.aviso), ...Object.values(r.rotulos).map((x) => x.que)];
  for (const t of textos) {
    if (t === null) continue;
    assert.equal(/[*_`#]|\[.+\]\(/.test(t), false, `este texto lleva Markdown y saldría crudo: ${t}`);
  }
  /* Y la regla del silencio: `null` significa que la pantalla no dibuja nada. Un string vacío la
     haría dibujar una caja vacía, que se lee como un aviso que no se cargó. */
  assert.equal(textos.some((t) => t === ''), false, 'hay un aviso vacío en vez de `null`');
});
