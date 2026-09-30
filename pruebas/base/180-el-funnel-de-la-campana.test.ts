// El funnel de cada campaña en Acquisition: la ruta, la base y la auditoría. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE AFIRMA, Y LA MUTACIÓN QUE CADA COSA TIENE QUE PONER EN ROJO
//
// El funnel lo asigna una persona (docs/acquisition/14, A14-03), y una campaña en el funnel equivocado
// se ve igual de bien que en el bueno. Se vigila lo que haría que la asignara quien no debe, que
// quedara sin rastro o que apuntara a una campaña ajena:
//
//   · quien administra asigna, reasigna y quita, y las tres cosas quedan auditadas — mutación: no
//     auditar;
//   · el rol `usuario` NO asigna, aunque tenga la pestaña — mutación: pedir `tablero.ver`;
//   · una campaña que no es de la empresa da 404, igual que una que no existe — mutación: saltear
//     `existeLaCampana` (la foránea de la `066` la frena con `23503` y la ruta revienta);
//   · quitar una campaña no toca la otra, y dos quitas a la vez auditan una sola — mutaciones: un
//     `delete` sin `where`, y volver al `select` seguido de `delete`;
//   · un funnel fuera de la lista se rechaza con 400 — mutación: aceptar cualquier texto;
//   · un rol de plataforma mirando otra empresa asigna sin reventar, con `actualizado_por` nulo —
//     mutación: guardar `contexto.usuarioId` en vez de `autorDelCambio` (el `23503` de la 41);
//   · la base sola rechaza un funnel desconocido, una campaña inexistente y una ajena, y borrar la
//     campaña se lleva su funnel.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { sql } from 'kysely';

import { cerrarTodo, conectar } from '../apoyo/conexiones.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { leerRespuesta, montar, pedirComo, sesionDe, type Escenario } from '../apoyo/closer.ts';
import { funnelsDeLasCampanas } from '../../lib/negocio/funnelDeLaCampana.ts';
import { DELETE as quitar, PANTALLA, PUT as asignar } from '../../app/api/acquisition/funnel/route.ts';
import { SECCIONES } from '../../lib/autorizacion/secciones.ts';

let esc: Escenario;
/** Las campañas de este archivo empiezan con esta marca: son dígitos, como las de Meta. */
const MARCA = '180000';
const PROPIA = `${MARCA}1`;
const OTRA_PROPIA = `${MARCA}3`;
const AJENA = `${MARCA}2`;
const CORREO_COMUN = 'comun@funnel-campana.ejemplo';
/** La fundadora, que tiene el rol de plataforma en la organización principal. */
let fundadora: string;
/** Los tokens de sesión que este archivo crea para la fundadora, para borrarlos al final. */
const sesionesPropias: string[] = [];

async function limpiar(): Promise<void> {
  // Primero los funnels y después las campañas: la foránea cascadea, pero así la prueba no depende de eso.
  await esc.admin.query('delete from negocio.funnels_de_campana where meta_campana_id like $1', [`${MARCA}%`]);
  await esc.admin.query('delete from negocio.campanas where meta_campana_id like $1', [`${MARCA}%`]);
  await esc.admin.query('delete from identidad.usuarios where email = $1', [CORREO_COMUN]);
}

/** Las tres campañas: dos de la empresa y una de la otra. */
async function sembrarCampanas(): Promise<void> {
  await esc.admin.query(
    `insert into negocio.campanas (org_id, meta_campana_id, nombre, estado) values
       ($1, $2, 'bofu - agendamiento', 'ACTIVE'), ($1, $3, 'tofu - reels', 'PAUSED'), ($4, $5, 'de la otra', 'ACTIVE')
     on conflict do nothing`,
    [esc.org, PROPIA, OTRA_PROPIA, esc.otraOrg, AJENA],
  );
}

before(async () => {
  esc = await montar('FunnelCampana');
  await limpiar();
  await sembrarCampanas();
  const f = await esc.admin.query<{ id: string }>(
    `select u.id from identidad.usuarios u join identidad.organizaciones o on o.id = u.org_id
      where o.slug = 'principal' limit 1`,
  );
  assert.ok(f.rows[0], 'falta el sembrado: corré `npm run db:reset`');
  fundadora = f.rows[0].id;
});

after(async () => {
  await limpiar();
  for (const t of sesionesPropias) {
    await esc.admin.query('delete from identidad.sesiones where token_hash = $1', [hashDeToken(t)]);
  }
  await cerrarTodo();
  await cerrarClientes();
});

function pedirAsignar(token: string, cuerpo: unknown): Promise<Response> {
  return asignar(pedirComo('/api/acquisition/funnel', token, { metodo: 'PUT', cuerpo }));
}

function pedirQuitar(token: string, campana: string): Promise<Response> {
  return quitar(
    pedirComo(`/api/acquisition/funnel?campana=${encodeURIComponent(campana)}`, token, { metodo: 'DELETE' }),
  );
}

interface FilaDeAuditoria {
  accion: string;
  campana: string;
  funnel: string;
  usuario: string;
  org: string;
  objetivo: string;
}

/** Las filas de auditoría de este archivo, en orden. */
async function auditoria(): Promise<FilaDeAuditoria[]> {
  const { rows } = await esc.admin.query<FilaDeAuditoria>(
    `select accion, detalle->>'campana' as campana, detalle->>'funnel' as funnel, usuario_id as usuario,
            org_id as org, detalle->>'objetivo' as objetivo
       from identidad.auditoria_accesos
      where accion like 'funnel_de_campana%' and detalle->>'campana' like $1
      order by creado_el, id`,
    [`${MARCA}%`],
  );
  return rows;
}

/**
 * Espera hasta que `cuantas` transacciones estén bloqueadas esperando una fila de `tabla`.
 *
 * Es lo que vuelve determinista la prueba del doble clic: sin esto, las dos peticiones «simultáneas»
 * se serializan solas —la segunda lee cuando la primera ya confirmó— y la carrera nunca ocurre.
 * Medido por mutación: con dos `Promise.all` sueltos, volver al `select` seguido de `delete`
 * sobrevivía.
 */
async function esperarBloqueadas(cuantas: number, tabla: string): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    const r = await esc.admin.query<{ n: number }>(
      `select count(*)::int as n from pg_stat_activity where wait_event_type = 'Lock' and query ilike $1`,
      [`%${tabla}%`],
    );
    if ((r.rows[0]?.n ?? 0) >= cuantas) return;
    await new Promise((listo) => setTimeout(listo, 25));
  }
  assert.fail(`no llegaron ${cuantas} transacciones a esperar el candado de ${tabla}`);
}

async function filaDe(campana: string) {
  const r = await esc.admin.query<{ funnel: string; actualizado_por: string | null; actualizado_el: Date }>(
    'select funnel, actualizado_por, actualizado_el from negocio.funnels_de_campana where meta_campana_id = $1',
    [campana],
  );
  return r.rows[0] ?? null;
}

test('quien administra asigna, reasigna y quita, y las tres cosas quedan auditadas', async () => {
  await esc.admin.query('delete from negocio.funnels_de_campana where meta_campana_id like $1', [`${MARCA}%`]);
  const antes = (await auditoria()).length;

  const alta = await leerRespuesta<{ funnels: { campana: string; funnel: string; actualizadoEl: string }[] }>(
    await pedirAsignar(esc.token, { campana: PROPIA, funnel: 'leadform' }),
  );
  assert.equal(alta.estado, 200);
  assert.deepEqual(alta.cuerpo.funnels.map((f) => [f.campana, f.funnel]), [[PROPIA, 'leadform']]);
  const primera = await filaDe(PROPIA);
  assert.equal(primera?.actualizado_por, esc.quien, 'la fila no dice quién asignó');
  // Lo que viaja es lo guardado: la fecha de la respuesta es la de la base, no la del reloj de la ruta.
  assert.equal(alta.cuerpo.funnels[0]?.actualizadoEl, primera?.actualizado_el.toISOString());

  // Una campaña tiene UN funnel: el segundo reemplaza al primero, no se suma. Y renueva la fecha.
  const cambio = await leerRespuesta<{ funnels: { campana: string; funnel: string }[] }>(
    await pedirAsignar(esc.token, { campana: PROPIA, funnel: 'booking' }),
  );
  assert.deepEqual(cambio.cuerpo.funnels.map((f) => [f.campana, f.funnel]), [[PROPIA, 'booking']]);
  const segunda = await filaDe(PROPIA);
  assert.ok(segunda && primera && segunda.actualizado_el > primera.actualizado_el, 'reasignar no renovó la fecha');

  /* Una SEGUNDA campaña asignada antes de quitar la primera: quitar una no toca la otra. Con una
     sola asignación, un `delete` sin `where` —que la RLS acota a la empresa— daba el mismo `[]` y
     sobrevivía (lo encontró la revisión de AQ-2). */
  await pedirAsignar(esc.token, { campana: OTRA_PROPIA, funnel: 'profile' });

  const baja = await pedirQuitar(esc.token, PROPIA);
  assert.equal(baja.status, 200);
  assert.deepEqual(
    (await leerRespuesta<{ funnels: { campana: string; funnel: string }[] }>(baja)).cuerpo.funnels.map((f) => [
      f.campana,
      f.funnel,
    ]),
    [[OTRA_PROPIA, 'profile']],
    'quitar una campaña se llevó también la otra',
  );
  assert.equal((await filaDe(OTRA_PROPIA))?.funnel, 'profile');

  const filas = (await auditoria()).slice(antes);
  assert.deepEqual(
    filas.map((f) => [f.accion, f.campana, f.funnel, f.usuario, f.org, f.objetivo]),
    [
      ['funnel_de_campana_asignado', PROPIA, 'leadform', esc.quien, esc.org, esc.org],
      ['funnel_de_campana_asignado', PROPIA, 'booking', esc.quien, esc.org, esc.org],
      ['funnel_de_campana_asignado', OTRA_PROPIA, 'profile', esc.quien, esc.org, esc.org],
      // La quita registra el funnel que se SACÓ, que después ya no está en ningún otro lado.
      ['funnel_de_campana_quitado', PROPIA, 'booking', esc.quien, esc.org, esc.org],
    ],
    'la auditoría no dice qué campaña, qué funnel, quién o sobre qué empresa',
  );

  // Quitar lo que ya no está es un 404, no un 200 que diga «quitado».
  assert.equal((await pedirQuitar(esc.token, PROPIA)).status, 404);
});

test('dos quitas a la vez auditan UNA sola quita', async () => {
  /* Un doble clic. Con un `select` seguido de un `delete`, las dos transacciones leían la fila, la
     borraba una y auditaban las dos. Con `delete … returning`, la segunda espera el bloqueo de la
     fila, no encuentra nada que borrar y responde 404.

     Para que las dos se crucen de verdad, un candado aparte toma la fila antes: las dos quitas
     quedan esperándolo en su `delete` —un `select` simple no espera, así que en la forma vieja las
     dos alcanzan a leer— y recién entonces se suelta. */
  await esc.admin.query('delete from negocio.funnels_de_campana where meta_campana_id like $1', [`${MARCA}%`]);
  await pedirAsignar(esc.token, { campana: PROPIA, funnel: 'leadform' });
  const antes = (await auditoria()).filter((f) => f.accion === 'funnel_de_campana_quitado').length;

  const candado = await conectar('admin');
  await candado.query('begin');
  await candado.query('select 1 from negocio.funnels_de_campana where meta_campana_id = $1 for update', [PROPIA]);
  let quitas: Promise<Response[]>;
  try {
    quitas = Promise.all([pedirQuitar(esc.token, PROPIA), pedirQuitar(esc.token, PROPIA)]);
    await esperarBloqueadas(2, 'funnels_de_campana');
  } finally {
    await candado.query('commit');
  }
  const estados = (await quitas).map((r) => r.status).sort();
  assert.deepEqual(estados, [200, 404], 'las dos quitas simultáneas dijeron haber quitado');
  const despues = (await auditoria()).filter((f) => f.accion === 'funnel_de_campana_quitado').length;
  assert.equal(despues - antes, 1, 'un solo borrado dejó más de una fila de «quitado»');
});

test('el rol `usuario` no asigna funnels, aunque tenga la pestaña Acquisition', async () => {
  /* La pestaña se concede a propósito: el rol `usuario` es el único con secciones restringidas, así
     que sin ella el 403 saldría del alcance por sección y la CAPACIDAD ni se miraría — y la prueba
     dejaría pasar una ruta que pida `tablero.ver`. Es lo que la 178 hace con Creative. */
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
  await esc.admin.query('delete from negocio.funnels_de_campana where meta_campana_id like $1', [`${MARCA}%`]);

  const token = await sesionDe(id);
  assert.equal(
    (await pedirAsignar(token, { campana: PROPIA, funnel: 'profile' })).status,
    403,
    'una persona con el rol `usuario` asignó un funnel',
  );
  assert.equal(await filaDe(PROPIA), null, 'el 403 igual escribió');
  assert.equal((await pedirQuitar(token, PROPIA)).status, 403, 'una persona con el rol `usuario` quitó un funnel');
});

test('una campaña que no es de la empresa da 404, igual que una que no existe', async () => {
  /* La de la otra empresa y una inventada reciben la MISMA respuesta (`ADR-0501`): distinguirlas
     diría qué campañas tiene otra empresa. Y `888888` es el identificador falso de la atribución:
     GoHighLevel nunca lo listó, así que no hay campaña que asignar. */
  for (const campana of [AJENA, `${MARCA}9`, '888888']) {
    const r = await pedirAsignar(esc.token, { campana, funnel: 'leadform' });
    assert.equal(r.status, 404, `la campaña «${campana}» dio ${r.status} y no 404`);
  }
  const { rows } = await esc.admin.query('select 1 from negocio.funnels_de_campana where meta_campana_id = $1', [AJENA]);
  assert.equal(rows.length, 0, 'quedó un funnel apuntando a la campaña de otra empresa');
});

test('un funnel fuera de la lista, o una campaña que no se dice, se rechazan con 400', async () => {
  for (const funnel of ['otro', 'LEADFORM', 'Lead form ads', '', null, 3]) {
    const r = await pedirAsignar(esc.token, { campana: PROPIA, funnel });
    assert.equal(r.status, 400, `aceptó el funnel ${JSON.stringify(funnel)}`);
  }
  assert.equal((await pedirAsignar(esc.token, { funnel: 'leadform' })).status, 400, 'aceptó sin campaña');
  assert.equal((await pedirAsignar(esc.token, { campana: '', funnel: 'leadform' })).status, 400);
  assert.equal((await pedirAsignar(esc.token, { campana: '1'.repeat(65), funnel: 'leadform' })).status, 400);
  // El borde: 64 es el máximo y entra —llega al escritor, que no la encuentra—; 65 ya no.
  assert.equal((await pedirAsignar(esc.token, { campana: '1'.repeat(64), funnel: 'leadform' })).status, 404);
  // Un cuerpo JSON que no es un objeto no revienta: es una campaña que no se dijo.
  for (const cuerpo of [null, [], 'leadform']) {
    assert.equal((await pedirAsignar(esc.token, cuerpo)).status, 400, `el cuerpo ${JSON.stringify(cuerpo)} no dio 400`);
  }
  // Y el DELETE valida igual: sin campaña, vacía o demasiado larga es 400, no un 404 «no tenía funnel».
  const quitarCon = (consulta: string) =>
    quitar(pedirComo(`/api/acquisition/funnel${consulta}`, esc.token, { metodo: 'DELETE' }));
  for (const consulta of ['', '?campana=', `?campana=${'1'.repeat(65)}`]) {
    assert.equal((await quitarCon(consulta)).status, 400, `el DELETE «${consulta}» no dio 400`);
  }
  // Un cuerpo que no es JSON tampoco llega al escritor.
  const roto = await asignar(
    new Request('https://ejemplo.test/api/acquisition/funnel', {
      method: 'PUT',
      headers: pedirComo('/x', esc.token, { metodo: 'PUT', cuerpo: {} }).headers,
      body: '{no es json',
    }),
  );
  assert.equal(roto.status, 400);
});

test('un rol de plataforma mirando otra empresa asigna, reasigna y quita sin reventar', async () => {
  /* El `23503` de la 41: la fundadora es de la principal y la fila es de `alfa`, así que el par
     (org, usuario) no existe. `autorDelCambio` devuelve `null` bajo delegación, y la auditoría es la
     que guarda al actor de verdad. La campaña ya tiene un funnel puesto por alguien de adentro, así
     que la reasignación pasa por el `on conflict`: ahí es donde un `actualizado_por` olvidado dejaría
     firmada por Ana una decisión que no tomó. */
  await esc.admin.query('delete from negocio.funnels_de_campana where meta_campana_id like $1', [`${MARCA}%`]);
  assert.equal((await pedirAsignar(esc.token, { campana: OTRA_PROPIA, funnel: 'leadform' })).status, 200);
  const deAdentro = await filaDe(OTRA_PROPIA);
  assert.equal(deAdentro?.actualizado_por, esc.quien);

  const token = randomBytes(32).toString('base64url');
  sesionesPropias.push(token);
  await conIdentidad(async (db) => {
    await db
      .insertInto('sesiones')
      .values({
        usuario_id: fundadora,
        token_hash: hashDeToken(token),
        estado: 'activa',
        org_activa: esc.org,
        expira_el: sql<Date>`now() + interval '7 days'`,
        expira_absoluto: sql<Date>`now() + interval '30 days'`,
      })
      .execute();
  });

  /* La foránea compuesta rechaza con una EXCEPCIÓN, no con un 500: la ruta no la atrapa, y en Next
     eso sería el 500 sin diagnóstico. Por eso se espera que la llamada no se rechace. */
  let r: Response | null = null;
  await assert.doesNotReject(async () => {
    r = await pedirAsignar(token, { campana: OTRA_PROPIA, funnel: 'profile' });
  }, 'la escritura reventó: la foránea compuesta volvió a rechazar');
  const respuesta = await leerRespuesta<{ funnels: { campana: string; funnel: string }[] }>(r!);
  assert.equal(respuesta.estado, 200);
  // Lo que queda en ALFA, que es donde se asignó; no la lista de la principal.
  assert.deepEqual(
    respuesta.cuerpo.funnels.filter((f) => f.campana.startsWith(MARCA)).map((f) => [f.campana, f.funnel]),
    [[OTRA_PROPIA, 'profile']],
    'la respuesta no es la lista de la empresa donde se asignó',
  );
  const fila = await filaDe(OTRA_PROPIA);
  assert.equal(fila?.funnel, 'profile');
  assert.equal(fila?.actualizado_por, null, 'la reasignación bajo delegación dejó firmada la fila por otra persona');
  assert.ok(fila && deAdentro && fila.actualizado_el > deAdentro.actualizado_el, 'la reasignación no renovó la fecha');

  // Y quita también, en alfa: si buscara en la principal, respondería «no tenía funnel».
  assert.equal((await pedirQuitar(token, OTRA_PROPIA)).status, 200, 'bajo delegación no se pudo quitar');
  assert.equal(await filaDe(OTRA_PROPIA), null);

  const ultimas = (await auditoria()).slice(-2);
  assert.deepEqual(
    ultimas.map((f) => [f.accion, f.campana, f.funnel, f.usuario, f.org, f.objetivo]),
    [
      ['funnel_de_campana_asignado', OTRA_PROPIA, 'profile', fundadora, esc.org, esc.org],
      ['funnel_de_campana_quitado', OTRA_PROPIA, 'profile', fundadora, esc.org, esc.org],
    ],
    'la auditoría no registró a la fundadora como actora, o no sobre alfa',
  );
});

test('la ruta declara la pantalla Acquisition, y esa sección existe', () => {
  /* El portero mira el alcance por sección con `PANTALLA`, y ninguna otra prueba lo fija: el rol
     `usuario` cae antes por la capacidad, y el administrador no tiene secciones restringidas. Con
     otra pantalla, «sin la pestaña Acquisition no se reparten campañas» miraría otra pestaña. */
  assert.equal(PANTALLA, 'acquisition');
  assert.ok(SECCIONES.some((s) => s.clave === PANTALLA), 'la pantalla no es una sección del catálogo');
});

test('la base sola rechaza un funnel desconocido, una campaña inexistente y una ajena', async () => {
  await esc.admin.query('delete from negocio.funnels_de_campana where meta_campana_id like $1', [`${MARCA}%`]);
  const insertar = (org: string, campana: string, funnel: string) =>
    esc.admin.query('insert into negocio.funnels_de_campana (org_id, meta_campana_id, funnel) values ($1, $2, $3)', [
      org,
      campana,
      funnel,
    ]);
  // `23514` es la violación de un `check`; `23503`, la de una foránea.
  await assert.rejects(insertar(esc.org, PROPIA, 'otro'), { code: '23514' });
  await assert.rejects(insertar(esc.org, `${MARCA}9`, 'leadform'), { code: '23503' });
  // La campaña existe, pero es de la OTRA empresa: la foránea compuesta la frena (ADR-0212).
  await assert.rejects(insertar(esc.org, AJENA, 'leadform'), { code: '23503' });
});

test('borrar la campaña se lleva su funnel', async () => {
  const efimera = `${MARCA}7`;
  await esc.admin.query(`insert into negocio.campanas (org_id, meta_campana_id, nombre) values ($1, $2, 'efímera')`, [
    esc.org,
    efimera,
  ]);
  assert.equal((await pedirAsignar(esc.token, { campana: efimera, funnel: 'booking' })).status, 200);
  await esc.admin.query('delete from negocio.campanas where meta_campana_id = $1', [efimera]);
  assert.equal(await filaDe(efimera), null, 'quedó el funnel de una campaña que ya no existe');
});

test('los funnels de otra empresa no se ven', async () => {
  await esc.admin.query('delete from negocio.funnels_de_campana where meta_campana_id like $1', [`${MARCA}%`]);
  await esc.admin.query(
    `insert into negocio.funnels_de_campana (org_id, meta_campana_id, funnel) values ($1, $2, 'leadform'), ($3, $4, 'profile')`,
    [esc.org, PROPIA, esc.otraOrg, AJENA],
  );
  const mios = await conOrganizacion(esc.org, funnelsDeLasCampanas);
  assert.deepEqual(mios.filter((f) => f.campana.startsWith(MARCA)).map((f) => [f.campana, f.funnel]), [[PROPIA, 'leadform']]);
  // La otra mitad: la otra empresa ve el suyo. Sin esto, una lectura vacía pasaría la de arriba.
  const suyos = await conOrganizacion(esc.otraOrg, funnelsDeLasCampanas);
  assert.deepEqual(suyos.filter((f) => f.campana.startsWith(MARCA)).map((f) => [f.campana, f.funnel]), [[AJENA, 'profile']]);
});
