// Los ajustes de la organización: las tres credenciales propias. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PRUEBA QUE JUSTIFICA ESTE ARCHIVO ES LA PRIMERA, Y ES DE UN DEFECTO QUE ESTABA
//
// La ruta aceptaba dos campos y escribía los dos SIEMPRE:
//
//     crm_refresh_cifrado: typeof refresco === 'string' && refresco ? cifrar(refresco) : null
//
// O sea que rotar el token sin volver a mandar el de refresco **borraba el de refresco**, y no
// fallaba: la respuesta decía `activa` con su vista previa, todo verde. El síntoma llegaba días
// después, cuando el token vencía y `tokenVigente()` no encontraba con qué renovarlo: la
// organización quedaba desconectada, y el registro de auditoría decía que alguien había cargado
// credenciales correctamente.
//
// Con la pantalla de Ajustes eso pasaba de improbable a inevitable: son tres secretos en un
// formulario, y guardar uno mandaba los otros dos vacíos.
//
// Se prueba por el MANEJADOR REAL, no llamando a la base. La regla nueva —"solo se escriben los
// campos presentes en el cuerpo"— vive en el manejador, así que probarla escribiendo SQL a mano
// verificaría mi prueba y no el código.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Client } from 'pg';
import { GET as leerAjustes, PUT as guardarAjustes } from '../../app/api/admin/credenciales/route.ts';
import { conIdentidad, cerrarClientes } from '../../lib/datos/capa.ts';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { COOKIE_SESION, hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { cifrar, descifrar } from '../../lib/credenciales/cifrado.ts';

const DOMINIO = 'ejemplo.test';

let admin: Client;
let alfa: string;
let usuarioAlfa: string;
let cookieAlfa: string;

before(async () => {
  // El freno por origen del `08` § 5.3 compara con `DOMINIO_ESPERADO`, y sin esto TODA
  // petición que modifica responde 403 `origen_no_permitido`. Igual que `50-administracion`.
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');

  const org = await unaFila<{ id: string }>(
    admin,
    `select id from identidad.organizaciones where slug = 'alfa'`,
  );
  assert.ok(org, 'falta la organizacion alfa del sembrado');
  alfa = org.id;

  // El administrador de alfa que ya siembra el desarrollo. Se usa ése y no uno nuevo porque
  // tiene `credenciales.ver` y `credenciales.editar` por su rol, que es justo lo que hace falta
  // ejercitar: el portero de verdad, con capacidades de verdad.
  const u = await unaFila<{ id: string }>(
    admin,
    `select id from identidad.usuarios where email = 'ana@alfa.ejemplo'`,
  );
  assert.ok(u, 'falta el administrador de alfa del sembrado');
  usuarioAlfa = u.id;

  const token = randomBytes(32).toString('base64url');
  await conIdentidad(async (db) => {
    await db
      .insertInto('sesiones')
      .values({
        usuario_id: usuarioAlfa,
        token_hash: hashDeToken(token),
        estado: 'activa',
        expira_el: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      })
      .execute();
  });
  cookieAlfa = token;
});

after(async () => {
  await limpiar();
  await admin.query('delete from identidad.sesiones where usuario_id = $1', [usuarioAlfa]);
  await cerrarTodo();
  await cerrarClientes();
});

async function limpiar(): Promise<void> {
  await admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [alfa]);
}

function peticion(cuerpo: unknown, metodo = 'PUT'): Request {
  return new Request(`https://${DOMINIO}/api/admin/credenciales`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      origin: `https://${DOMINIO}`,
      cookie: `${COOKIE_SESION}=${cookieAlfa}`,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

/** Lo que quedó en la base, en crudo. Para ver lo que la respuesta no muestra. */
async function enLaBase(): Promise<Record<string, string | null>> {
  const f = await admin.query(
    `select crm_token_cifrado, crm_refresh_cifrado, crm_expira_el, crm_estado,
            ia_clave_cifrada, pagos_clave_cifrada, crm_cuenta_id, fundaciones_cliente_id
       from identidad.organizaciones_credenciales where org_id = $1`,
    [alfa],
  );
  return (f.rows[0] ?? {}) as Record<string, string | null>;
}

async function cuerpoDe(r: Response): Promise<Record<string, unknown>> {
  return (await r.clone().json()) as Record<string, unknown>;
}

// ─── 1 · Lo que no se manda, no se toca ─────────────────────────────────────

test('guardar la llave de IA NO borra el token de refresco del CRM', async () => {
  // ES LA PRUEBA DEL ARCHIVO. El defecto que había, en su forma más directa.
  await limpiar();

  // Se carga el par completo del CRM.
  let r = await guardarAjustes(peticion({ crmToken: 'token-ghl-original', crmRefresco: 'refresco-original' }));
  assert.equal(r.status, 200, 'no se pudo cargar el par del CRM');

  const antes = await enLaBase();
  assert.ok(antes['crm_refresh_cifrado'], 'el refresco no quedó guardado: la prueba no puede seguir');

  // Y ahora se guarda SOLO la llave de IA, que es lo que hace la pantalla de Ajustes.
  r = await guardarAjustes(peticion({ iaClave: 'clave-de-anthropic-de-alfa' }));
  assert.equal(r.status, 200);

  const despues = await enLaBase();
  assert.equal(
    despues['crm_refresh_cifrado'],
    antes['crm_refresh_cifrado'],
    'guardar la llave de IA borró el token de refresco del CRM',
  );
  assert.equal(
    despues['crm_token_cifrado'],
    antes['crm_token_cifrado'],
    'guardar la llave de IA pisó el token del CRM',
  );
  // Y la de IA sí se guardó, que es la otra mitad: una prueba que solo comprobara que nada
  // cambió pasaría con un manejador que no escribe nada.
  assert.ok(despues['ia_clave_cifrada'], 'la llave de IA no se guardó');
  assert.equal(descifrar(despues['ia_clave_cifrada']!), 'clave-de-anthropic-de-alfa');
});

test('rotar el token del CRM tampoco borra su refresco', async () => {
  // El caso exacto que el comentario del manejador describe: rotar el token sin volver a
  // mandar el refresco. Es lo que alguien hace cuando GoHighLevel le da un token nuevo.
  await limpiar();
  await guardarAjustes(peticion({ crmToken: 'token-viejo', crmRefresco: 'refresco-que-tiene-que-vivir' }));
  const antes = await enLaBase();

  const r = await guardarAjustes(peticion({ crmToken: 'token-nuevo' }));
  assert.equal(r.status, 200);

  const despues = await enLaBase();
  assert.equal(despues['crm_refresh_cifrado'], antes['crm_refresh_cifrado'], 'se perdió el refresco al rotar');
  assert.equal(descifrar(despues['crm_token_cifrado']!), 'token-nuevo', 'el token no se reemplazó');
});

// ─── 2 · Borrar es explícito ────────────────────────────────────────────────

test('`null` explícito BORRA; la cadena vacía se RECHAZA', async () => {
  // Las dos mitades de la misma decisión, y la segunda es la que evita el desastre: si la
  // cadena vacía borrara, abrir Ajustes y darle a guardar sin tocar nada dejaría a la
  // organización sin sus tres credenciales.
  await limpiar();
  await guardarAjustes(peticion({ crmToken: 'token-para-borrar', iaClave: 'ia-para-quedarse' }));

  // Vacía → rechazo, y NADA cambia.
  const antes = await enLaBase();
  const rVacio = await guardarAjustes(peticion({ crmToken: '' }));
  assert.equal(rVacio.status, 400, 'la cadena vacía no fue rechazada');
  const cuerpo = await cuerpoDe(rVacio);
  assert.equal(cuerpo['codigo'], 'peticion_invalida');
  // El detalle dice QUÉ campo y POR QUÉ. Sin él, los seis rechazos de esta ruta se ven iguales.
  assert.match(String(cuerpo['detalle']), /crmToken/);
  assert.match(String(cuerpo['detalle']), /null/, 'el detalle no dice cómo borrar');
  assert.deepEqual(await enLaBase(), antes, 'un rechazo dejó cambios en la base');

  // Nulo → borra, y SOLO eso.
  const rNulo = await guardarAjustes(peticion({ crmToken: null }));
  assert.equal(rNulo.status, 200);
  const despues = await enLaBase();
  assert.equal(despues['crm_token_cifrado'], null, 'el nulo explícito no borró');
  assert.ok(despues['ia_clave_cifrada'], 'borrar el token del CRM se llevó la llave de IA');
  // Y el estado del CRM vuelve a `ausente`: un token borrado no es una integración activa.
  assert.equal(despues['crm_estado'], 'ausente');
});

test('un cuerpo sin ningún campo conocido se RECHAZA, no responde que guardó', async () => {
  // El § 9 regla 2: *"nunca reportar un éxito que no ocurrió"*. Un `{}` que devolviera 200
  // haría que la pantalla dijera «Guardado» sin haber escrito nada.
  await limpiar();
  for (const cuerpo of [{}, { campoQueNoExiste: 'x' }, [], 'texto', 7]) {
    const r = await guardarAjustes(peticion(cuerpo));
    assert.equal(r.status, 400, `el cuerpo ${JSON.stringify(cuerpo)} no fue rechazado`);
  }
  const f = await admin.query(
    'select 1 from identidad.organizaciones_credenciales where org_id = $1',
    [alfa],
  );
  assert.equal(f.rowCount, 0, 'un cuerpo rechazado creó la fila igual');
});

// ─── 3 · Cada credencial tiene su propio estado ─────────────────────────────

test('guardar la llave de IA NO declara activa la integración del CRM', async () => {
  // Antes `crm_estado` se ponía en `activa` en cada guardado. Con eso, cargar la llave de
  // Anthropic de una organización cuyo token de GoHighLevel estaba VENCIDO lo declaraba activo:
  // la pantalla decía que la integración andaba mientras cada llamada a GHL fallaba.
  await limpiar();
  await admin.query(
    `insert into identidad.organizaciones_credenciales (org_id, crm_token_cifrado, crm_estado)
     values ($1, $2, 'vencida')`,
    [alfa, cifrar('token-vencido')],
  );

  const r = await guardarAjustes(peticion({ iaClave: 'una-clave-de-ia' }));
  assert.equal(r.status, 200);

  assert.equal((await enLaBase())['crm_estado'], 'vencida', 'guardar la llave de IA revivió el CRM');
  const cuerpo = await cuerpoDe(r);
  assert.equal((cuerpo['crm'] as { estado: string }).estado, 'vencida');
  assert.equal((cuerpo['ia'] as { cargado: boolean }).cargado, true);
});

test('rotar el token limpia su vencimiento: el del anterior no sobrevive', async () => {
  // `tokenVigente()` lee `crm_expira_el` para decidir si hay que renovar. Una fecha del token
  // anterior lo haría renovar uno que acaba de cargarse — o tratarlo como vigente cuando ya no
  // lo es, que es peor porque no se nota hasta que una llamada falla.
  await limpiar();
  await admin.query(
    `insert into identidad.organizaciones_credenciales
       (org_id, crm_token_cifrado, crm_expira_el, crm_estado)
     values ($1, $2, now() - interval '1 day', 'vencida')`,
    [alfa, cifrar('token-viejo')],
  );

  await guardarAjustes(peticion({ crmToken: 'token-recien-cargado' }));

  const f = await enLaBase();
  assert.equal(f['crm_expira_el'], null, 'sobrevivió el vencimiento del token anterior');
  assert.equal(f['crm_estado'], 'activa');
});

test('las tres credenciales se informan por separado, cada una con su estado', async () => {
  // Un solo estado haría que "no cargó GoHighLevel" y "no cargó la llave de IA" fueran el mismo
  // hecho, y son dos: una organización puede operar el pipeline sin generar documentos.
  await limpiar();
  await guardarAjustes(peticion({ crmToken: 'solo-el-crm' }));

  const cuerpo = await cuerpoDe(await leerAjustes(peticion(undefined, 'GET')));
  assert.equal((cuerpo['crm'] as { cargado: boolean }).cargado, true);
  assert.equal((cuerpo['ia'] as { cargado: boolean }).cargado, false);
  assert.equal((cuerpo['pagos'] as { cargado: boolean }).cargado, false);
  // Y las dos que faltan dicen QUÉ falta, no vienen vacías.
  assert.equal((cuerpo['ia'] as { estado: string }).estado, 'ausente');
  assert.ok((cuerpo['ia'] as { texto: string | null }).texto, 'la llave de IA ausente no dice nada');
});

// ─── 4 · El valor nunca sale ────────────────────────────────────────────────

test('ADR-0604 · ningún secreto aparece en la respuesta, ni en claro ni cifrado', async () => {
  await limpiar();
  const secretos = ['token-ghl-secretisimo', 'refresco-secretisimo', 'clave-ia-secretisima'];
  await guardarAjustes(
    peticion({ crmToken: secretos[0], crmRefresco: secretos[1], iaClave: secretos[2] }),
  );

  // Se revisa el texto ENTERO de las dos respuestas, no campo por campo: un campo nuevo que
  // filtre el valor se agrega sin tocar esta prueba, y así igual la rompe.
  for (const [nombre, r] of [
    ['GET', await leerAjustes(peticion(undefined, 'GET'))],
    ['PUT', await guardarAjustes(peticion({ crmToken: secretos[0] }))],
  ] as const) {
    const texto = await r.clone().text();
    for (const s of secretos) {
      assert.ok(!texto.includes(s), `el ${nombre} devolvió el secreto en claro`);
    }
    // Y tampoco el blob cifrado: no es legible sin la clave maestra, pero mandarlo al navegador
    // hace que una copia del secreto viva fuera del servidor, y la clave maestra deja de ser lo
    // único que lo protege.
    const enBase = await enLaBase();
    for (const col of ['crm_token_cifrado', 'crm_refresh_cifrado', 'ia_clave_cifrada']) {
      const blob = enBase[col];
      if (blob) assert.ok(!texto.includes(blob), `el ${nombre} devolvió ${col} cifrado`);
    }
  }
});

test('los identificadores públicos SÍ van completos: no son secretos', async () => {
  // La otra mitad, y hace falta. Enmascararlos daría la impresión de que son lo que protege
  // algo, y volvería imposible lo único que hay que hacer con ellos: mirarlos para comprobar
  // que apuntan a la subcuenta correcta.
  await limpiar();
  await guardarAjustes(
    peticion({ crmCuentaId: 'loc_ABC123', fundacionesClienteId: 'alumno-42' }),
  );
  const cuerpo = await cuerpoDe(await leerAjustes(peticion(undefined, 'GET')));
  assert.equal(cuerpo['crmCuentaId'], 'loc_ABC123');
  assert.equal(cuerpo['fundacionesClienteId'], 'alumno-42');
  // Y no se cifraron en la base: cifrar un identificador público solo lo vuelve ilegible para
  // quien tenga que diagnosticar.
  assert.equal((await enLaBase())['crm_cuenta_id'], 'loc_ABC123');
});

// ─── 5 · Y sigue siendo de UNA organización ─────────────────────────────────

test('los ajustes son de la organización de la sesión, y de ninguna otra', async () => {
  // La ruta va por `conIdentidad(`, que NO tiene política de fila: el filtro por organización
  // lo pone la consulta con `contexto.orgEfectiva`. Eso lo hace exactamente la clase de lugar
  // donde un filtro olvidado no falla — devuelve la fila de otro.
  await limpiar();
  const beta = await unaFila<{ id: string }>(
    admin,
    `select id from identidad.organizaciones where slug = 'beta'`,
  );
  assert.ok(beta, 'falta la organizacion beta del sembrado');
  await admin.query(
    `insert into identidad.organizaciones_credenciales (org_id, crm_token_cifrado, crm_estado)
     values ($1, $2, 'activa')
     on conflict (org_id) do update set crm_token_cifrado = $2, crm_estado = 'activa'`,
    [beta.id, cifrar('el-token-de-beta-no-se-ve')],
  );

  try {
    // La sesión es de alfa, que no tiene nada cargado.
    const cuerpo = await cuerpoDe(await leerAjustes(peticion(undefined, 'GET')));
    assert.equal(cuerpo['orgId'], alfa, 'devolvió los ajustes de otra organización');
    assert.equal((cuerpo['crm'] as { cargado: boolean }).cargado, false, 'alfa vio la credencial de beta');

    // Y escribir con la sesión de alfa no toca la fila de beta.
    await guardarAjustes(peticion({ crmToken: 'el-de-alfa' }));
    const deBeta = await unaFila<{ crm_token_cifrado: string }>(
      admin,
      `select crm_token_cifrado from identidad.organizaciones_credenciales where org_id = $1`,
      [beta.id],
    );
    assert.ok(deBeta);
    assert.equal(descifrar(deBeta.crm_token_cifrado), 'el-token-de-beta-no-se-ve');
  } finally {
    await admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [
      beta.id,
    ]);
  }
});
