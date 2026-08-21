// ADR-0604 — Sin credencial, la organización no opera y lo dice.
// ADR-0605 — Dos refrescos simultáneos no se invalidan.
// ADR-0606 — Un estado ausente y uno vencido no se muestran igual.
// Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// `ADR-0605` ES LA ÚNICA PRUEBA DE CONCURRENCIA REAL DEL PROYECTO
//
// El `08` § 9: *"varias plataformas invalidan el token de refresco AL USARLO. Dos peticiones
// simultáneas que detectan el token vencido y refrescan a la vez **se invalidan entre sí**, y la
// organización queda desconectada."*
//
// Es un fallo *"intermitente, que aparece con carga y no se reproduce localmente"*. Acá se
// reproduce a propósito: dos transacciones simultáneas contra la misma organización, y se cuenta
// **cuántas veces se llamó al servicio externo**. Tiene que ser una.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import type { Client } from 'pg';
import { conectar, cerrarTodo } from '../apoyo/conexiones.ts';
import { conIdentidad, cerrarClientes } from '../../lib/datos/capa.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { ILEGIBLE, resolverCredenciales } from '../../lib/credenciales/resolver.ts';
import { tokenVigente } from '../../lib/credenciales/refresco.ts';

let admin: Client;
let alfa: string;

before(async () => {
  admin = await conectar('admin');
  const f = await admin.query(`select id from identidad.organizaciones where slug = 'alfa'`);
  alfa = f.rows[0].id;
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

async function limpiar(): Promise<void> {
  await admin.query('delete from identidad.organizaciones_credenciales');
}

/** Pone la fila de credenciales de alfa en el estado que se pida. */
async function poner(fila: {
  token?: string | null;
  refresco?: string | null;
  expiraEn?: string | null;
  estado?: string;
}): Promise<void> {
  await limpiar();
  await admin.query(
    `insert into identidad.organizaciones_credenciales
       (org_id, crm_token_cifrado, crm_refresh_cifrado, crm_expira_el, crm_estado)
     values ($1, $2, $3, ${fila.expiraEn ? `now() + interval '${fila.expiraEn}'` : 'null'}, $4)`,
    [
      alfa,
      fila.token === undefined ? cifrar('token-de-alfa-1234') : fila.token,
      fila.refresco === undefined ? cifrar('refresco-de-alfa') : fila.refresco,
      fila.estado ?? 'activa',
    ],
  );
}

// ─── ADR-0606 · los cuatro estados no se confunden ──────────────────────────

test('ADR-0606 · sin fila y con fila vacía son `ausente`, y NO son `vencida`', async () => {
  // La organización recién creada NO tiene fila: el `05` § 2 dice que junto con la organización no
  // se crea *"nada más"*. Es el caso más frecuente del sistema, y el que el pseudocódigo del
  // `06` § 5 no cubre — desreferencia la fila sin rama para su ausencia.
  await limpiar();
  const sinFila = await conIdentidad(async (db) => resolverCredenciales(db, alfa));
  assert.equal(sinFila.crm.estado, 'ausente');
  assert.equal(sinFila.crm.cargado, false);
  assert.equal(sinFila.crm.texto, 'Falta conectar esta integración');
  assert.equal(sinFila.crm.vistaPrevia, null, 'no puede haber vista previa de algo que no existe');

  // Fila con el token en nulo: hacia afuera significa lo mismo.
  await poner({ token: null, refresco: null, estado: 'ausente' });
  const filaVacia = await conIdentidad(async (db) => resolverCredenciales(db, alfa));
  assert.equal(filaVacia.crm.estado, 'ausente');
  assert.equal(filaVacia.crm.texto, 'Falta conectar esta integración');
});

test('ADR-0606 · cada estado tiene SU texto, y son todos distintos', async () => {
  // *"Cada uno pide un texto distinto en la interfaz"* (`08` § 9). La fila lo dice al revés:
  // *"nunca un cero como si fuera un dato"* — si `vencida` y `ausente` dijeran lo mismo, quien lo
  // lea va a reconectar una integración que ya estaba conectada, y el problema real queda sin
  // diagnosticar.
  const esperado: Record<string, string | null> = {
    ausente: 'Falta conectar esta integración',
    activa: null,
    vencida: 'La conexión venció. Hay que volver a autorizarla',
    revocada: 'El acceso fue revocado desde el panel del servicio',
  };

  const textos: (string | null)[] = [];
  for (const [estado, texto] of Object.entries(esperado)) {
    await poner({ estado, expiraEn: '1 hour', ...(estado === 'ausente' ? { token: null } : {}) });
    const r = await conIdentidad(async (db) => resolverCredenciales(db, alfa));
    assert.equal(r.crm.estado, estado, `el estado leído no es ${estado}`);
    assert.equal(r.crm.texto, texto, `el texto de ${estado} no es el del 08 § 9`);
    textos.push(texto);
  }

  // Y son todos distintos entre sí. Sin esta afirmación, cuatro estados con el mismo texto
  // pasarían las cuatro comprobaciones de arriba si alguien "unificara los mensajes".
  const conTexto = textos.filter((t): t is string => t !== null);
  assert.equal(new Set(conTexto).size, conTexto.length, 'dos estados comparten texto');
});

test('ADR-0606 · una credencial ILEGIBLE no se muestra como ausente', async () => {
  // El caso que la especificación no tiene y que pasa cada vez que se restaura una copia de la
  // base en otro entorno: hay algo guardado y la clave maestra es otra.
  //
  // Decir "falta conectar" mandaría a reconectar una integración que **está** conectada, y el
  // problema real —la clave— quedaría sin diagnosticar. Es la misma familia que la fila: dos cosas
  // distintas no pueden mostrarse igual.
  await poner({ token: 'no-es-un-blob-valido', expiraEn: '1 hour' });
  const r = await conIdentidad(async (db) => resolverCredenciales(db, alfa));
  assert.equal(r.crm.estado, ILEGIBLE);
  assert.equal(r.crm.cargado, true, 'está cargada: lo que falla es leerla');
  assert.match(r.crm.texto ?? '', /no puede leerla/i);
  assert.notEqual(r.crm.texto, 'Falta conectar esta integración');
});

test('ADR-0604 · el valor NUNCA sale; solo los últimos cuatro caracteres', async () => {
  const secreto = 'token-secretisimo-abcd';
  await poner({ token: cifrar(secreto), expiraEn: '1 hour' });
  const r = await conIdentidad(async (db) => resolverCredenciales(db, alfa));

  assert.equal(r.crm.vistaPrevia, '••••abcd');
  // Y el objeto entero no contiene el secreto por ningún lado. Es la comprobación que agarra un
  // campo agregado sin pensar.
  assert.ok(
    !JSON.stringify(r).includes(secreto),
    'el valor de la credencial salió en la respuesta',
  );
  assert.ok(!JSON.stringify(r).includes(secreto.slice(0, 10)));
});

// ─── ADR-0605 · dos refrescos simultáneos ───────────────────────────────────

test('ADR-0605 · dos peticiones a la vez: UNA refresca, la otra usa el resultado', async () => {
  // El token vence YA, así que las dos peticiones van a querer refrescar.
  await poner({ expiraEn: '10 seconds' });

  let llamadas = 0;
  const tokens: string[] = [];
  const pedirTokenNuevo = async (): Promise<{ token: string; duracionSegundos: number }> => {
    llamadas += 1;
    const t = `token-renovado-${randomBytes(4).toString('hex')}`;
    tokens.push(t);
    // Una demora real: sin ella las dos transacciones podrían serializarse por casualidad y la
    // prueba pasaría sin haber ejercitado el candado.
    await new Promise((r) => setTimeout(r, 150));
    return { token: t, duracionSegundos: 3600 };
  };

  // DOS transacciones de identidad SIMULTÁNEAS. `conIdentidad` abre una cada una, así que son dos
  // conexiones distintas del agrupador: el candado tiene que ser de la base, no del proceso.
  const [a, b] = await Promise.all([
    conIdentidad(async (db) => tokenVigente(db, alfa, pedirTokenNuevo)),
    conIdentidad(async (db) => tokenVigente(db, alfa, pedirTokenNuevo)),
  ]);
  assert.equal(a.tipo, 'token');
  assert.equal(b.tipo, 'token');

  // LA AFIRMACIÓN CENTRAL. Con dos llamadas, la plataforma habría invalidado el primer token de
  // refresco al usar el segundo y la organización quedaría desconectada.
  assert.equal(
    llamadas,
    1,
    `se pidió un token nuevo ${llamadas} veces: las dos peticiones refrescaron y se invalidaron ` +
      'entre sí. El candado no está funcionando.',
  );

  // Y las dos devolvieron EL MISMO token: la segunda usó el resultado de la primera, no un valor
  // viejo ni vacío.
  assert.deepEqual(a, b, 'las dos peticiones devolvieron tokens distintos');
  assert.equal(a.tipo === 'token' ? a.token : null, tokens[0]);

  // Y la fila quedó consistente.
  const fila = await conIdentidad(async (db) =>
    db
      .selectFrom('organizaciones_credenciales')
      .select(['crm_estado', 'crm_expira_el'])
      .where('org_id', '=', alfa)
      .executeTakeFirstOrThrow(),
  );
  assert.equal(fila.crm_estado, 'activa');
  assert.ok(fila.crm_expira_el && fila.crm_expira_el > new Date(), 'el vencimiento no se movió');
});

test('ADR-0605 · con el token vigente NO se refresca', async () => {
  // La guarda de la de arriba: sin ésta, un `tokenVigente` que nunca refrescara pasaría la
  // afirmación de "una sola llamada" con cero llamadas.
  await poner({ expiraEn: '2 hours' });
  let llamadas = 0;
  const devuelto = await conIdentidad(async (db) =>
    tokenVigente(db, alfa, async () => {
      llamadas += 1;
      return { token: 'no-deberia-usarse', duracionSegundos: 3600 };
    }),
  );
  assert.equal(llamadas, 0, 'refrescó un token que seguía vigente');
  assert.deepEqual(devuelto, { tipo: 'token', token: 'token-de-alfa-1234' });
});

test('ADR-0605 · el MARGEN: un token que vence en un minuto SÍ se refresca', async () => {
  // *"El margen evita usar un token que vence mientras la petición viaja."* Sin margen, un token
  // con treinta segundos de vida sale hacia el servicio externo y falla allá, con un error de
  // autenticación que no dice nada.
  await poner({ expiraEn: '1 minute' });
  let llamadas = 0;
  await conIdentidad(async (db) =>
    tokenVigente(db, alfa, async () => {
      llamadas += 1;
      return { token: 'renovado-por-margen', duracionSegundos: 3600 };
    }),
  );
  assert.equal(llamadas, 1, 'no refrescó un token que vence dentro del margen');
});

test('ADR-0605 · el token de refresco ROTADO se guarda', async () => {
  // *"Algunas plataformas rotan también el de refresco, y perderlo desconecta al cliente sin
  // aviso."* Y el fallo es diferido: todo anda hasta el refresco siguiente.
  await poner({ expiraEn: '10 seconds', refresco: cifrar('refresco-viejo') });
  let vistoPorElServicio: string | null = null;

  await conIdentidad(async (db) =>
    tokenVigente(db, alfa, async (r) => {
      vistoPorElServicio = r;
      return { token: 't1', refresco: 'refresco-NUEVO', duracionSegundos: 3600 };
    }),
  );
  assert.equal(vistoPorElServicio, 'refresco-viejo');

  // Y en el refresco siguiente se usa el nuevo, no el viejo.
  await admin.query(
    `update identidad.organizaciones_credenciales set crm_expira_el = now() + interval '10 seconds'`,
  );
  let segundo: string | null = null;
  await conIdentidad(async (db) =>
    tokenVigente(db, alfa, async (r) => {
      segundo = r;
      return { token: 't2', duracionSegundos: 3600 };
    }),
  );
  assert.equal(segundo, 'refresco-NUEVO', 'el token de refresco rotado no se guardó');
});

test('ADR-0604 · sin credencial NO OPERA y lo dice, y no cae a la de nadie', async () => {
  // *"Nunca un valor por defecto que use la credencial de otra organización."* Si hubiera respaldo,
  // esto devolvería un token — y el token sería de otro.
  await limpiar();
  const sin = await conIdentidad(async (db) =>
    tokenVigente(db, alfa, async () => ({ token: 'x' })),
  );
  assert.deepEqual(sin, {
    tipo: 'no_operativa',
    estado: 'ausente',
    texto: 'Falta conectar esta integración',
  });

  // Y con la credencial revocada, tampoco.
  await poner({ estado: 'revocada', expiraEn: '2 hours' });
  const revocada = await conIdentidad(async (db) =>
    tokenVigente(db, alfa, async () => ({ token: 'x' })),
  );
  assert.equal(revocada.tipo, 'no_operativa');
  assert.equal(revocada.tipo === 'no_operativa' ? revocada.estado : null, 'revocada');
});

test('ADR-0604 · la marca del estado SOBREVIVE, que es lo que el primer diseño perdía', async () => {
  // La prueba que encontró el bug. `tokenVigente` marcaba el estado y después LANZABA, todo dentro
  // de la misma transacción — así que el `rollback` se llevaba la marca. El estado quedaba en
  // `activa` para siempre y la interfaz seguía diciendo que la conexión andaba.
  //
  // Por eso ahora devuelve un valor en vez de lanzar: la transacción confirma, la marca persiste.
  await poner({ expiraEn: '-1 hour', refresco: null, estado: 'activa' });
  const r = await conIdentidad(async (db) =>
    tokenVigente(db, alfa, async () => ({ token: 'x' })),
  );
  assert.equal(r.tipo, 'no_operativa');

  // Y acá está la mitad que importa: se relee en OTRA transacción.
  const leido = await conIdentidad(async (db) => resolverCredenciales(db, alfa));
  assert.equal(leido.crm.estado, 'vencida', 'la marca del estado no sobrevivió a la transacción');
  assert.equal(leido.crm.texto, 'La conexión venció. Hay que volver a autorizarla');
});
