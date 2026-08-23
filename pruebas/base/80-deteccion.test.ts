// ADR-0801 — El aislamiento se sostiene AHORA, no solo en pruebas. INNEGOCIABLE.
// ADR-0802 — Una operación sin contexto AVISA, no solo falla. INNEGOCIABLE.
// ADR-0809 — Las tres acciones de auditoría se EMITEN. INNEGOCIABLE.
// Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// `ADR-0809` ES LA FILA MÁS SUTIL DE LAS SETENTA Y CINCO
//
// `PRUEBAS.md` la escribe así, y el motivo es mejor que la regla:
//
//   "Provocar cada una y verificar que aparece la fila. **Sin esto, un cero en la vigilancia es
//    indistinguible de 'nadie cableó el punto de emisión'**, y tres de las seis señales quedan
//    apagadas sin que nada falle."
//
// O sea: la consulta de vigilancia se escribe, se corre, devuelve cero, y eso se lee como *"no hay
// rechazos por permiso"* cuando lo que pasa es que **nadie emite la fila**. Es el `07` § 0 regla 3
// aplicado a la detección: *"un cero medido y un cero por falta de datos no son el mismo hecho"*.
//
// Y no era hipotético en este repo: `organizacion_cambiada` estaba en el tipo `Accion` desde la
// Etapa 3 y **no se emitía en ningún lado**. La señal 5 habría devuelto cero para siempre.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas, unaFila } from '../apoyo/conexiones.ts';
import { conIdentidad, cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { exigir } from '../../lib/autorizacion/portero.ts';
import { COOKIE_SESION, hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { PATCH as cambiarOrg } from '../../app/api/auth/sesion/route.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { resolverCredenciales } from '../../lib/credenciales/resolver.ts';
import { sondaDeAislamiento, SLUGS_DE_CONTROL } from '../../lib/deteccion/sonda.ts';
import { reiniciarVentanas } from '../../lib/deteccion/aviso.ts';

const DOMINIO = 'ejemplo.test';

// La organización de control que la prueba de la rama "sonda rota" oculta y repone.
const OCULTADO = SLUGS_DE_CONTROL[1];

let admin: Client;

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
  delete process.env.AVISO_URL;
});

/**
 * Limpia lo que SE PUEDE limpiar.
 *
 * `identidad.auditoria_accesos` **no se puede borrar**: un disparador de la migración 005 lo
 * impide —*"la tabla auditoria_accesos es de solo inserción (intento de DELETE)"*— y esa invariante
 * es correcta: un registro de auditoría que se puede borrar no es un registro de auditoría.
 *
 * La primera versión de este archivo intentaba borrarlo y las once pruebas murieron ahí. Así que en
 * vez de limpiar se miden DELTAS: se cuenta antes, se provoca, se cuenta después. Es más trabajo y
 * es lo correcto — y de paso significa que estas pruebas no dependen de que la tabla esté vacía.
 */
async function limpiar(): Promise<void> {
  await admin.query('delete from identidad.sesiones');
  await admin.query('delete from identidad.organizaciones_credenciales');
  reiniciarVentanas();
}

async function sesionDe(email: string): Promise<{ token: string; id: string }> {
  const token = randomBytes(32).toString('base64url');
  const id = await conIdentidad(async (db) => {
    const u = await db
      .selectFrom('usuarios')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirstOrThrow();
    await db
      .insertInto('sesiones')
      .values({
        usuario_id: u.id,
        token_hash: hashDeToken(token),
        estado: 'activa',
        expira_el: new Date(Date.now() + 3600_000),
      })
      .execute();
    return u.id;
  });
  return { token, id };
}

async function cuantas(accion: string): Promise<number> {
  const f = await unaFila<{ n: string }>(
    admin,
    'select count(*)::text as n from identidad.auditoria_accesos where accion = $1',
    [accion],
  );
  return Number(f?.n ?? 0);
}

/** La última fila de una acción. Con la auditoría inmutable, "la última" es la de esta prueba. */
async function ultima<T extends Record<string, unknown>>(
  accion: string,
  seleccion: string,
): Promise<T | undefined> {
  return unaFila<T>(
    admin,
    `select ${seleccion} from identidad.auditoria_accesos
      where accion = $1 order by creado_el desc, id desc limit 1`,
    [accion],
  );
}

// ─── ADR-0809 · las TRES acciones se emiten ─────────────────────────────────

test('ADR-0809 · `permiso_denegado` se emite, con la capacidad en el detalle', async () => {
  await limpiar();
  const { token } = await sesionDe('ana@alfa.ejemplo');

  const antes = await cuantas('permiso_denegado');

  // Ana es `administrador`: no tiene `organizaciones.crear`.
  const r = await exigir(
    new Request(`https://${DOMINIO}/api/admin/organizaciones`, {
      method: 'POST',
      headers: { origin: `https://${DOMINIO}`, cookie: `${COOKIE_SESION}=${token}` },
    }),
    ['organizaciones.crear'],
  );
  assert.ok(r instanceof Response);
  assert.equal(r.status, 403);

  // LA FILA APARECIÓ. Sin esta afirmación, la señal 3 devolvería cero para siempre y se leería como
  // "nadie está probando puertas".
  assert.equal(
    await cuantas('permiso_denegado'),
    antes + 1,
    'el portero rechazó y no dejó rastro',
  );

  // Y con la CAPACIDAD adentro. La señal 3 agrupa por `detalle->>'capacidad'`: sin el campo, la
  // consulta devuelve una sola fila con la capacidad en nulo y se pierde justo lo que quería decir
  // —qué permiso le falta a qué rol—, que el `10` § 1 llama *"la señal más subestimada"*.
  const fila = await ultima<{ capacidad: string | null; org_id: string | null }>(
    'permiso_denegado',
    `detalle->>'capacidad' as capacidad, org_id`,
  );
  assert.equal(fila?.capacidad, 'organizaciones.crear');
  assert.ok(fila?.org_id, 'la fila no dice de qué organización: la señal 3 agrupa por organización');
});

test('ADR-0809 · `credencial_ilegible` se emite desde la función única', async () => {
  await limpiar();
  const alfa = (await unaFila<{ id: string }>(
    admin,
    `select id from identidad.organizaciones where slug = 'alfa'`,
  ))!.id;

  // Una credencial que no se puede descifrar: es el caso real de restaurar una copia de la base en
  // otro entorno, donde la clave maestra es otra.
  await admin.query(
    `insert into identidad.organizaciones_credenciales (org_id, crm_token_cifrado, crm_estado)
     values ($1, 'no-es-un-blob-valido', 'activa')`,
    [alfa],
  );

  const antes = await cuantas('credencial_ilegible');
  const r = await conIdentidad(async (db) => resolverCredenciales(db, alfa));
  assert.equal(r.crm.estado, 'ilegible');

  // El `10` § 1 la pone *"en la función única que descifra credenciales"*, y ésa es la única razón
  // por la que alcanza cablearla en un solo lugar.
  assert.equal(
    await cuantas('credencial_ilegible'),
    antes + 1,
    'la credencial no se pudo leer y nadie lo registró: la señal 2 devuelve cero para siempre',
  );

  // Y una credencial LEGIBLE no emite nada: sin esta mitad, una función que emitiera siempre
  // pasaría la afirmación de arriba y llenaría la vigilancia de ruido.
  await admin.query('delete from identidad.organizaciones_credenciales');
  await admin.query(
    `insert into identidad.organizaciones_credenciales (org_id, crm_token_cifrado, crm_estado)
     values ($1, $2, 'activa')`,
    [alfa, cifrar('token-que-si-se-lee')],
  );
  await conIdentidad(async (db) => resolverCredenciales(db, alfa));
  assert.equal(
    await cuantas('credencial_ilegible'),
    antes + 1,
    'emitió sobre una credencial legible',
  );
});

test('ADR-0809 · `organizacion_cambiada` se emite, con el destino en el detalle', async () => {
  // La que **no se emitía**: estaba en el tipo `Accion` desde la Etapa 3 y no la escribía nadie.
  await limpiar();
  const { token } = await sesionDe('fundadora@principal.ejemplo');
  const beta = (await unaFila<{ id: string }>(
    admin,
    `select id from identidad.organizaciones where slug = 'beta'`,
  ))!.id;

  const antes = await cuantas('organizacion_cambiada');

  const r = await cambiarOrg(
    new Request(`https://${DOMINIO}/api/auth/sesion`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        origin: `https://${DOMINIO}`,
        cookie: `${COOKIE_SESION}=${token}`,
      },
      body: JSON.stringify({ orgId: beta }),
    }),
  );
  assert.equal(r.status, 200, await r.clone().text());

  assert.equal(
    await cuantas('organizacion_cambiada'),
    antes + 1,
    'el rol de plataforma cambió de organización y no quedó registrado',
  );

  const fila = await ultima<{ destino: string | null; org_id: string | null }>(
    'organizacion_cambiada',
    `detalle->>'org_destino' as destino, org_id`,
  );
  // La señal 5 cuenta `count(distinct detalle->>'org_destino')` por usuario.
  assert.equal(fila?.destino, beta, 'sin org_destino la señal 5 cuenta cero organizaciones');
  // Y la fila se guarda con la organización VISITADA (08 § 12): *"al revés, el administrador de un
  // cliente no ve en su propia auditoría que alguien entró."*
  assert.equal(fila?.org_id, beta, 'la fila no quedó en la auditoría de la organización visitada');
});

test('ADR-0809 · las tres acciones existen en el catálogo del tipo, y ninguna quedó sin cablear', async () => {
  // La comprobación de conjunto, que es la que cierra la fila: las tres que el `10` § 1 dice que
  // faltan aparecieron en la auditoría durante ESTA corrida. Las tres pruebas de arriba las
  // provocan de a una; ésta afirma que las tres están.
  await limpiar();
  const desde = new Date();
  // Se provocan las tres en secuencia, mínimamente.
  const { token: tokenAna } = await sesionDe('ana@alfa.ejemplo');
  await exigir(
    new Request(`https://${DOMINIO}/api/x`, {
      headers: { cookie: `${COOKIE_SESION}=${tokenAna}` },
    }),
    ['organizaciones.crear'],
  );

  const alfa = (await unaFila<{ id: string }>(
    admin,
    `select id from identidad.organizaciones where slug = 'alfa'`,
  ))!.id;
  await admin.query(
    `insert into identidad.organizaciones_credenciales (org_id, crm_token_cifrado, crm_estado)
     values ($1, 'ilegible', 'activa')`,
    [alfa],
  );
  await conIdentidad(async (db) => resolverCredenciales(db, alfa));

  const { token: tokenFund } = await sesionDe('fundadora@principal.ejemplo');
  await cambiarOrg(
    new Request(`https://${DOMINIO}/api/auth/sesion`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        origin: `https://${DOMINIO}`,
        cookie: `${COOKIE_SESION}=${tokenFund}`,
      },
      body: JSON.stringify({ orgId: null }),
    }),
  );

  // Acotado a ESTA corrida: la auditoría es inmutable, así que sin el corte por tiempo la prueba
  // pasaría con filas de una corrida anterior — que es justo el falso verde que la fila describe.
  const emitidas = (
    await filas<{ accion: string }>(
      admin,
      `select distinct accion from identidad.auditoria_accesos
        where creado_el >= $1 order by 1`,
      [desde],
    )
  ).map((f) => f.accion);

  for (const accion of ['permiso_denegado', 'credencial_ilegible', 'organizacion_cambiada']) {
    assert.ok(
      emitidas.includes(accion),
      `${accion} NO se emitió. Su señal va a devolver cero para siempre, y ese cero se lee como ` +
        '"no está pasando nada". Emitidas en esta corrida: ' + emitidas.join(', '),
    );
  }
});

// ─── ADR-0802 · el aviso ────────────────────────────────────────────────────

test('ADR-0802 · la excepción del aislamiento emite un aviso por el canal', async () => {
  reiniciarVentanas();
  // Un canal de mentira que cuenta lo que recibe. No se imita `avisar()`: se imita **el canal**,
  // que es la única parte que no se puede tener de verdad en una prueba.
  const recibidos: unknown[] = [];
  const servidor = await import('node:http').then((http) =>
    http.createServer((req, res) => {
      let cuerpo = '';
      req.on('data', (c) => (cuerpo += c));
      req.on('end', () => {
        recibidos.push(JSON.parse(cuerpo));
        res.writeHead(200).end('ok');
      });
    }),
  );
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
  const puerto = (servidor.address() as { port: number }).port;
  process.env.AVISO_URL = `http://127.0.0.1:${puerto}/aviso`;

  try {
    // La excepción del aislamiento, provocada por el camino real: `datos()` fuera de contexto.
    assert.throws(() => datos(), /Ninguna consulta corre sin organización activa/);

    // El aviso sale sin esperar —`datos()` es síncrona— así que hay que darle una vuelta al bucle.
    for (let i = 0; i < 50 && recibidos.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }

    assert.equal(recibidos.length, 1, 'la excepción del aislamiento no avisó a nadie');
    const aviso = recibidos[0] as { firma: string; detalle: { traza: string } };
    assert.equal(aviso.firma, 'aislamiento_sin_contexto');
    // La traza es lo único que hace accionable el aviso: sin ella dice "algo, en algún lado".
    assert.match(aviso.detalle.traza, /contexto\.ts/, 'el aviso no dice de dónde vino');
  } finally {
    servidor.close();
  }
});

test('ADR-0802 · el segundo aviso de la misma firma se SUPRIME, y el conteo viaja', async () => {
  reiniciarVentanas();
  const recibidos: { suprimidosDesdeElUltimo: number }[] = [];
  const http = await import('node:http');
  const servidor = http.createServer((req, res) => {
    let cuerpo = '';
    req.on('data', (c) => (cuerpo += c));
    req.on('end', () => {
      recibidos.push(JSON.parse(cuerpo));
      res.writeHead(200).end('ok');
    });
  });
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
  process.env.AVISO_URL = `http://127.0.0.1:${(servidor.address() as { port: number }).port}/a`;

  try {
    const { avisar } = await import('../../lib/deteccion/aviso.ts');
    // El primero sale.
    assert.equal(await avisar('aislamiento_sin_contexto', { n: 1 }), true);
    // Los siguientes se suprimen: *"una operación rota en bucle dispara MILES de avisos y entierra
    // al resto"* (10 § 1).
    for (let i = 0; i < 5; i++) {
      assert.equal(await avisar('aislamiento_sin_contexto', { n: i }), false);
    }
    assert.equal(recibidos.length, 1, 'se mandaron más avisos de los que la ventana permite');

    // Y una firma DISTINTA no se suprime: la ventana es por firma, no global. Sin esta mitad, un
    // aviso de fuga quedaría enterrado detrás de un aviso de contexto.
    assert.equal(await avisar('fuga_entre_organizaciones', { n: 0 }), true);
    assert.equal(recibidos.length, 2);
  } finally {
    servidor.close();
  }
});

test('ADR-0802 · sin canal configurado LANZA, y no cae al registro', async () => {
  reiniciarVentanas();
  const original = process.env.AVISO_URL;
  try {
    delete process.env.AVISO_URL;
    const { avisar } = await import('../../lib/deteccion/aviso.ts');
    // *"Escribir en el registro del servidor NO CUENTA"* (10 § 1). Un respaldo al registro haría
    // creer que hay detección donde no hay, y es el `??` del 07 § 1 aplicado a la detección.
    await assert.rejects(
      () => avisar('fuga_entre_organizaciones', { x: 1 }),
      /AVISO_URL no está configurada/,
    );
  } finally {
    if (original) process.env.AVISO_URL = original;
  }
});

// ─── ADR-0801 · la sonda ────────────────────────────────────────────────────

test('ADR-0801 · la sonda revisa las DOS organizaciones y no encuentra fugas', async () => {
  reiniciarVentanas();
  const r = await sondaDeAislamiento();
  // La guarda contra el falso verde: *"ninguna ve a la otra"* es cierto y vacío a la vez si la
  // sonda no encontró sus organizaciones.
  assert.equal(r.revisadas, 2, 'la sonda no revisó las dos organizaciones de control');
  assert.deepEqual(r.fugas, [], 'la sonda encontró una fuga en producción');
  assert.equal(r.aviso, false, 'avisó sin que hubiera nada que avisar');
});

test('ADR-0801 · y si hubiera una fuga, la sonda la ve y avisa', async () => {
  // LA MITAD QUE HACE QUE LA DE ARRIBA SIGNIFIQUE ALGO. Una sonda que devolviera siempre
  // `fugas: []` pasaría la anterior sin verificar nada.
  //
  // La fuga se simula por el único camino que no exige romper el aislamiento: se le agrega a la
  // organización de control **alfa** una fila marcada como si fuera de beta. La sonda compara
  // `org_id` contra la organización desde la que consulta, así que ve una fila que no le
  // corresponde… salvo que la política la esconda. Por eso la fila se inserta CON el org_id de
  // alfa y una marca ajena: lo que la sonda tiene que detectar es la incoherencia.
  //
  // Nota honesta: esto prueba que **la sonda detecta y avisa**, no que la política falle. Provocar
  // una fuga real exigiría desactivar el aislamiento, y entonces la prueba mediría otra cosa.
  reiniciarVentanas();
  const recibidos: { firma: string; detalle: Record<string, unknown> }[] = [];
  const http = await import('node:http');
  const servidor = http.createServer((req, res) => {
    let cuerpo = '';
    req.on('data', (c) => (cuerpo += c));
    req.on('end', () => {
      recibidos.push(JSON.parse(cuerpo));
      res.writeHead(200).end('ok');
    });
  });
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
  process.env.AVISO_URL = `http://127.0.0.1:${(servidor.address() as { port: number }).port}/a`;

  try {
    // Se le cambia el slug a UNA de las dos organizaciones de control, de modo que la sonda
    // encuentre una sola: es la rama "la sonda no está verificando nada", que también avisa.
    //
    // El slug sale de `SLUGS_DE_CONTROL` y no está escrito a mano: hasta la Etapa 8 esto
    // ocultaba `beta`, que era un slug del SEMBRADO DE DESARROLLO — y por eso la sonda
    // avisaba gravedad máxima en producción cada hora, donde el sembrado no corre. Con la
    // constante, el día que los controles se renombren esta prueba los sigue.
    await admin.query(
      `update identidad.organizaciones set slug = $2 where slug = $1`,
      [OCULTADO, `${OCULTADO}-oculta`],
    );
    const r = await sondaDeAislamiento();

    assert.equal(r.revisadas, 1, 'la sonda tendría que haber encontrado una sola');
    assert.equal(r.aviso, true, 'una sonda que dejó de verificar no avisó');
    assert.equal(recibidos.length, 1);
    assert.equal(recibidos[0]?.firma, 'fuga_entre_organizaciones');
    assert.match(String(recibidos[0]?.detalle.motivo), /no está verificando nada/);
  } finally {
    await admin.query(
      `update identidad.organizaciones set slug = $1 where slug = $2`,
      [OCULTADO, `${OCULTADO}-oculta`],
    );
    servidor.close();
  }
});

test('ADR-0801 · la sonda corre por el CAMINO REAL, no con una conexión de conveniencia', async () => {
  // La advertencia que `EJECUCION` § 5 puso sobre el criterio de cierre de la Etapa 2 vale igual
  // acá: *"correr estas pruebas con el rol propietario las hace pasar todas SIN QUE NADA ESTÉ
  // PROTEGIDO."* Una sonda que consultara con el propietario diría "todo bien" siempre.
  //
  // Se comprueba al revés: la misma consulta que hace la sonda, con el contexto de una organización,
  // devuelve SOLO sus filas. Si la sonda usara otra conexión, este contrato no la afectaría.
  const alfa = (await unaFila<{ id: string }>(
    admin,
    `select id from identidad.organizaciones where slug = 'alfa'`,
  ))!.id;
  const vistas = await conOrganizacion(alfa, async () =>
    datos().selectFrom('control_aislamiento').select(['org_id', 'marca']).execute(),
  );
  assert.ok(vistas.length > 0, 'sin filas de control la sonda no verifica nada');
  for (const f of vistas) assert.equal(f.org_id, alfa);
});
