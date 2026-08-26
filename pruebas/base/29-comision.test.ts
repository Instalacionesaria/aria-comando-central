// La comisión: su base, su configuración y los ceros que no se pueden confundir. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PRUEBA MÁS IMPORTANTE DE ESTE ARCHIVO ES LA PRIMERA
//
// **Sin el filtro por persona, la comisión de cada uno se calcula sobre las ventas de todos.** No
// falla, no lanza, no queda vacío: da un número plausible **y más alto**. El cockpit ya tiene ese
// defecto por diseño declarado —su «cobrado» es de la empresa y está rotulado así— y la tentación era
// multiplicarlo por un porcentaje personal.
//
// Y después, los cuatro estados que no se pueden colapsar, que son dos parejas:
//
//   · sin porcentaje (`null`) ≠ porcentaje en 0 (`0`)
//   · sin resultados propios (`null`) ≠ con resultados y sin ventas (`0`)
//
// En las cuatro, un `?? 0` en cualquiera de las cuatro capas —la tabla, el endpoint, la lectura, la
// pantalla— convierte el «no medido» en un «cero medido». Y `Number(null)` es `0`, así que ni el tipo
// ni el motor avisan.
//
// Más una que la base hace inexpresable: **meta en cero**. La implementación de referencia, con la
// meta en 0, dibuja el anillo vacío y el cartel de «meta superada» a la vez.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { COOKIE_SESION, hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { GET as verPorcentajes, PUT as fijarPorcentaje } from '../../app/api/admin/comisiones/route.ts';
import { PATCH as fijarMeta } from '../../app/api/closer/meta/route.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { comisionDelMes, porcentajesDeLaEmpresa, TIPO_CLOSER } from '../../lib/negocio/comision.ts';

const ZONA = 'America/Lima';
const DOMINIO = 'ejemplo.test';

let admin: Client;
let alfa: string;
let beta: string;
let ana: string;
let bruno: string;
/** Una segunda persona de alfa, creada acá: el sembrado trae una sola por empresa. */
let dos: string;

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  const a = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug='alfa'`);
  const b = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug='beta'`);
  assert.ok(a && b);
  alfa = a.id;
  beta = b.id;

  const u1 = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email='ana@alfa.ejemplo'`);
  const u2 = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email='bruno@beta.ejemplo'`);
  assert.ok(u1 && u2);
  ana = u1.id;
  bruno = u2.id;

  const nueva = await unaFila<{ id: string }>(
    admin,
    // Con `password_hash`: la restricción `usuarios_credenciales_completas` exige que el correo y el
    // hash vayan juntos o ninguno. No entra por el login en esta prueba; solo tiene que existir.
    `insert into identidad.usuarios (org_id, nombre, email, password_hash)
       values ($1, 'Dos Alfa', $2, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [alfa, `dos-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
  );
  assert.ok(nueva);
  dos = nueva.id;
  await limpiar();
});

after(async () => {
  await limpiar();
  await admin.query('delete from identidad.usuarios where id = $1', [dos]);
  await cerrarTodo();
  await cerrarClientes();
});

async function limpiar(): Promise<void> {
  await admin.query('delete from negocio.comisiones');
  await admin.query('delete from negocio.resultados');
  await admin.query('delete from negocio.contactos');
}

/** Un contacto, para poder colgarle un resultado. */
async function contacto(org: string): Promise<string> {
  return conOrganizacion(org, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({ ghl_contact_id: `c-${randomUUID()}`, nombre: 'Contacto', territorio: 'closer' } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.id;
  });
}

/** Un resultado registrado POR alguien. `registrado_por` es la columna que decide de quién es. */
async function resultado(
  org: string,
  contactoId: string,
  quien: string,
  salida: string,
  monto: number | null,
): Promise<void> {
  await conOrganizacion(org, async () => {
    await datos()
      .insertInto('resultados')
      .values({
        contacto_id: contactoId,
        salida,
        monto,
        registrado_por: quien,
        rol: 'closer',
      } as never)
      .execute();
  });
}

async function config(
  org: string,
  usuarioId: string,
  campos: { porcentaje?: number | null; meta?: number | null },
): Promise<void> {
  await conOrganizacion(org, async () => {
    await datos()
      .insertInto('comisiones')
      .values({
        usuario_id: usuarioId,
        tipo: TIPO_CLOSER,
        porcentaje: campos.porcentaje ?? null,
        meta_mensual: campos.meta ?? null,
      } as never)
      .onConflict((oc) =>
        oc.columns(['org_id', 'usuario_id', 'tipo']).doUpdateSet({
          porcentaje: campos.porcentaje ?? null,
          meta_mensual: campos.meta ?? null,
        } as never),
      )
      .execute();
  });
}

const leer = (org: string, usuarioId: string) =>
  conOrganizacion(org, () => comisionDelMes(usuarioId, ZONA));

/** Una sesión activa, y su token. */
async function sesion(usuarioId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await conIdentidad(async (db) => {
    await db
      .insertInto('sesiones')
      .values({
        usuario_id: usuarioId,
        token_hash: hashDeToken(token),
        estado: 'activa',
        expira_el: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      })
      .execute();
  });
  return token;
}

async function darRol(usuarioId: string, clave: string): Promise<void> {
  await conIdentidad(async (db) => {
    const rol = await db
      .selectFrom('roles')
      .select('id')
      .where('clave', '=', clave)
      .executeTakeFirstOrThrow();
    await db
      .insertInto('usuarios_roles')
      .values({ usuario_id: usuarioId, rol_id: rol.id })
      .onConflict((oc) => oc.columns(['usuario_id', 'rol_id']).doNothing())
      .execute();
  });
}

function pedir(camino: string, token: string, cuerpo?: unknown, metodo = 'POST'): Request {
  return new Request(`https://${DOMINIO}${camino}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      origin: `https://${DOMINIO}`,
      cookie: `${COOKIE_SESION}=${token}`,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LA BASE ES DE LA PERSONA
// ═══════════════════════════════════════════════════════════════════════════════

test('LA PRUEBA: la base de cada persona es SOLO la suya', async () => {
  // Sin el `where registrado_por`, las dos personas verían la comisión sobre los $3.000 y el número
  // sería un 50 % más alto. No falla: es plausible.
  await limpiar();
  const c = await contacto(alfa);
  await resultado(alfa, c, ana, 'venta', 2000);
  await resultado(alfa, c, dos, 'venta', 1000);
  await config(alfa, ana, { porcentaje: 10 });
  await config(alfa, dos, { porcentaje: 10 });

  const deAna = await leer(alfa, ana);
  const deDos = await leer(alfa, dos);

  assert.equal(deAna.base, 2000, 'la base de Ana tiene que ser solo lo que Ana registró');
  assert.equal(deDos.base, 1000);
  assert.equal(deAna.valor, 200);
  assert.equal(deDos.valor, 100);
  // Y la suma de las dos es el total: ninguna se quedó con la del otro ni se perdió nada.
  assert.equal((deAna.base ?? 0) + (deDos.base ?? 0), 3000);
});

test('un `acuerdo_sin_pago` NO entra en la base de la comisión', async () => {
  // Es plata comprometida, no cobrada, y ya tiene su propio indicador en el cockpit. Sumarla acá
  // pagaría comisión sobre algo que todavía no ocurrió.
  await limpiar();
  const c = await contacto(alfa);
  await resultado(alfa, c, ana, 'venta', 1000);
  await resultado(alfa, c, ana, 'acuerdo_sin_pago', 5000);
  await config(alfa, ana, { porcentaje: 10 });

  const k = await leer(alfa, ana);
  assert.equal(k.base, 1000);
  assert.equal(k.ventas, 1);
  assert.equal(k.valor, 100);
});

test('la comisión de una persona NO se ve desde otra empresa', async () => {
  // La política de RLS aísla por organización, así que esto lo garantiza la base — y se comprueba
  // igual, porque la consulta corre con el contexto de una empresa y el identificador de la persona
  // viene de la sesión: si el aislamiento fallara, el número saldría de la empresa equivocada.
  await limpiar();
  const c = await contacto(alfa);
  await resultado(alfa, c, ana, 'venta', 4000);
  await config(alfa, ana, { porcentaje: 20 });

  const desdeBeta = await leer(beta, ana);
  assert.equal(desdeBeta.porcentaje, null, 'beta no puede ver la configuración de una persona de alfa');
  assert.equal(desdeBeta.base, null);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LOS CUATRO ESTADOS, EN DOS PAREJAS
// ═══════════════════════════════════════════════════════════════════════════════

test('SIN porcentaje: `null` con motivo, y el motivo NO manda a la persona a cargarlo', async () => {
  await limpiar();
  const c = await contacto(alfa);
  await resultado(alfa, c, ana, 'venta', 1000);

  const k = await leer(alfa, ana);
  assert.equal(k.porcentaje, null);
  assert.equal(k.valor, null, 'sin porcentaje no hay comisión, y no es cero');
  assert.ok(k.falta);
  // El texto viejo de la pantalla decía «cargá tu porcentaje» y era falso: lo fija quien administra.
  assert.match(k.falta, /administra/i);
});

test('porcentaje en 0 a propósito: la comisión es CERO, no nula', async () => {
  // Un cero MEDIDO. Colapsarlo con el estado anterior afirmaría que nadie lo configuró cuando
  // alguien decidió que es cero — y son cosas distintas para quien cobra.
  await limpiar();
  const c = await contacto(alfa);
  await resultado(alfa, c, ana, 'venta', 1000);
  await config(alfa, ana, { porcentaje: 0 });

  const k = await leer(alfa, ana);
  assert.equal(k.porcentaje, 0);
  assert.equal(k.valor, 0);
  assert.equal(k.falta, undefined, 'un cero medido no lleva «falta»');
});

test('SIN resultados propios: `null`, aunque la empresa tenga ventas de otros', async () => {
  // El testigo de «hubo datos» tiene que estar filtrado por persona. Con el total de la organización,
  // alguien que no registró nada vería `$0` — un cero que nadie midió sobre su trabajo.
  await limpiar();
  const c = await contacto(alfa);
  await resultado(alfa, c, dos, 'venta', 5000); // de OTRA persona
  await config(alfa, ana, { porcentaje: 10 });

  const k = await leer(alfa, ana);
  assert.equal(k.valor, null);
  assert.equal(k.base, null);
  assert.ok(k.falta);
  assert.match(k.falta, /no registraste/i);
});

test('CON resultados propios y sin ventas: la comisión es CERO', async () => {
  // La otra mitad de la pareja. Hacen falta las dos: una sola de las dos pruebas pasaría con una
  // implementación que devuelve siempre `null`, o siempre `0`.
  await limpiar();
  const c = await contacto(alfa);
  await resultado(alfa, c, ana, 'no_interesa', null);
  await config(alfa, ana, { porcentaje: 10 });

  const k = await leer(alfa, ana);
  assert.equal(k.valor, 0, 'registró trabajo y no vendió: cero medido');
  assert.equal(k.base, 0);
  assert.equal(k.ventas, 0);
  assert.equal(k.falta, undefined);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LA META
// ═══════════════════════════════════════════════════════════════════════════════

test('la base RECHAZA una meta de cero', async () => {
  // Vuelve inexpresable el defecto de la referencia: con la meta en 0, el anillo vacío y el cartel de
  // felicitación aparecen a la vez. Una condición de pantalla se puede borrar; un `check` no.
  await limpiar();
  await assert.rejects(
    () => config(alfa, ana, { porcentaje: 10, meta: 0 }),
    /comisiones_meta_mensual_check|violates check/i,
    'la base aceptó una meta de cero',
  );
  // Y negativa tampoco.
  await assert.rejects(() => config(alfa, ana, { porcentaje: 10, meta: -5 }));
});

test('«meta superada» exige las TRES condiciones', async () => {
  await limpiar();
  const c = await contacto(alfa);
  await resultado(alfa, c, ana, 'venta', 10_000);
  await config(alfa, ana, { porcentaje: 10, meta: 500 });

  const superada = await leer(alfa, ana);
  assert.equal(superada.valor, 1000);
  assert.equal(superada.faltaParaLaMeta, -500);
  assert.equal(superada.metaSuperada, true);

  // Sin meta no hay «superada», aunque la comisión sea grande.
  await config(alfa, ana, { porcentaje: 10, meta: null });
  const sinMeta = await leer(alfa, ana);
  assert.equal(sinMeta.metaSuperada, false);
  assert.equal(sinMeta.faltaParaLaMeta, null, 'sin meta, «cuánto falta» es un número inventado');
});

test('con comisión CERO no se felicita a nadie, ni con la meta más baja', async () => {
  // La condición que la referencia no tiene. Sin `valor > 0`, quien registró trabajo y no vendió
  // recibe un «meta superada» — porque `0 >= 0` es cierto y `falta <= 0` también.
  await limpiar();
  const c = await contacto(alfa);
  await resultado(alfa, c, ana, 'no_interesa', null);
  await config(alfa, ana, { porcentaje: 10, meta: 1 });

  const k = await leer(alfa, ana);
  assert.equal(k.valor, 0);
  assert.equal(k.metaSuperada, false, 'felicitó a quien no vendió nada');
});

test('la meta sin alcanzar dice cuánto falta, y es la resta exacta', async () => {
  await limpiar();
  const c = await contacto(alfa);
  await resultado(alfa, c, ana, 'venta', 3000);
  await config(alfa, ana, { porcentaje: 10, meta: 1000 });

  const k = await leer(alfa, ana);
  assert.equal(k.valor, 300);
  assert.equal(k.faltaParaLaMeta, 700);
  assert.equal(k.metaSuperada, false);
});

test('la comisión se redondea a centavos', async () => {
  // `1234.56 * 7 / 100` no es exacto en binario, y arrastrar la cola hace que la pantalla muestre
  // `86.4192000000001`. Es plata: dos decimales.
  await limpiar();
  const c = await contacto(alfa);
  await resultado(alfa, c, ana, 'venta', 1234.56);
  await config(alfa, ana, { porcentaje: 7 });

  const k = await leer(alfa, ana);
  assert.equal(k.valor, 86.42);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL PANEL DE ADMINISTRACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

test('el panel lista los usuarios ACTIVOS, con o sin fila de comisión', async () => {
  // Al revés —listar los que tienen fila— el panel arrancaría vacío y no habría forma de cargarle el
  // porcentaje a nadie: la fila se crea al guardar.
  await limpiar();
  await config(alfa, ana, { porcentaje: 15 });

  const lista = await conOrganizacion(alfa, () => porcentajesDeLaEmpresa());
  const porId = new Map(lista.map((x) => [x.usuarioId, x]));
  assert.ok(porId.has(ana));
  assert.ok(porId.has(dos), 'la persona sin fila de comisión también tiene que aparecer');
  assert.equal(porId.get(ana)?.porcentaje, 15);
  assert.equal(porId.get(dos)?.porcentaje, null, 'sin fila es `null`, NUNCA 0');
});

test('el panel de una empresa no muestra a la gente de otra', async () => {
  await limpiar();
  const lista = await conOrganizacion(alfa, () => porcentajesDeLaEmpresa());
  assert.ok(!lista.some((x) => x.usuarioId === bruno), 'apareció alguien de beta en el panel de alfa');
});

test('un usuario DESACTIVADO no aparece en el panel', async () => {
  await limpiar();
  await admin.query('update identidad.usuarios set activo = false where id = $1', [dos]);
  try {
    const lista = await conOrganizacion(alfa, () => porcentajesDeLaEmpresa());
    assert.ok(!lista.some((x) => x.usuarioId === dos));
  } finally {
    await admin.query('update identidad.usuarios set activo = true where id = $1', [dos]);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LA TABLA
// ═══════════════════════════════════════════════════════════════════════════════

test('no se puede guardar una comisión de una empresa apuntando a alguien de otra', async () => {
  // Con una clave foránea simple esto pasaría, y `aplicar_aislamiento` NO lo cubre: solo revisa las
  // claves hacia el esquema `negocio`. La compuesta es la que lo impide.
  await limpiar();
  await assert.rejects(
    () => config(alfa, bruno, { porcentaje: 10 }),
    /foreign key|comisiones_org_id_usuario_id/i,
    'se pudo apuntar a un usuario de otra empresa',
  );
});

test('borrar a la persona se lleva su comisión, y NO bloquea el borrado de quien la configuró', async () => {
  // Las dos claves foráneas, y las dos decisiones. `usuario_id` cascadea: la comisión de alguien que
  // ya no está no significa nada. `actualizado_por` pone nulo: si bloqueara, quien alguna vez le fijó
  // el porcentaje a otro quedaría **imborrable para siempre**, y no habría ninguna acción que lo
  // resuelva. El rastro de quién lo cambió vive en la auditoría, que sobrevive a la fila borrada.
  await limpiar();
  const otra = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.usuarios (org_id, nombre, email, password_hash)
       values ($1, 'Tres', $2, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [alfa, `tres-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
  );
  assert.ok(otra);

  // `otra` le fija el porcentaje a `dos`.
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('comisiones')
      .values({
        usuario_id: dos,
        tipo: TIPO_CLOSER,
        porcentaje: 12,
        actualizado_por: otra.id,
      } as never)
      .execute();
  });

  // Borrar a quien la configuró NO tiene que fallar.
  await admin.query('delete from identidad.usuarios where id = $1', [otra.id]);
  const quedo = await filas<{ porcentaje: string | null; actualizado_por: string | null }>(
    admin,
    'select porcentaje, actualizado_por from negocio.comisiones where usuario_id = $1',
    [dos],
  );
  assert.equal(quedo.length, 1, 'la comisión no tenía que desaparecer');
  assert.equal(quedo[0]?.actualizado_por, null, 'el autor quedó nulo, no bloqueó el borrado');
  assert.equal(Number(quedo[0]?.porcentaje), 12, 'y el porcentaje sigue ahí');
});

test('el aislamiento de la tabla: con el contexto de una empresa no se ve la comisión de otra', async () => {
  await limpiar();
  await config(alfa, ana, { porcentaje: 11 });
  await config(beta, bruno, { porcentaje: 22 });

  const deAlfa = await conOrganizacion(alfa, () =>
    datos().selectFrom('comisiones').select(['porcentaje']).execute(),
  );
  const deBeta = await conOrganizacion(beta, () =>
    datos().selectFrom('comisiones').select(['porcentaje']).execute(),
  );
  assert.equal(deAlfa.length, 1);
  assert.equal(deBeta.length, 1);
  assert.equal(Number(deAlfa[0]?.porcentaje), 11);
  assert.equal(Number(deBeta[0]?.porcentaje), 22);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · LOS DOS ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

test('LA CAPACIDAD: un rol `usuario` NO puede fijar porcentajes; un `administrador` sí', async () => {
  // La elección de capacidad es la decisión menos obvia de todo el cambio, y ésta es la prueba que la
  // sostiene. Con `configuracion.editar` —la que parecía natural— esta prueba se pone roja: esa
  // capacidad la tienen los TRES roles, así que cualquiera se fijaría su propio porcentaje con una
  // petición a mano y la frontera viviría solo en la pantalla.
  await limpiar();
  await admin.query('delete from identidad.usuarios_roles where usuario_id = $1', [dos]);
  await darRol(dos, 'usuario');
  const tokenUsuario = await sesion(dos);

  const negado = await fijarPorcentaje(
    pedir('/api/admin/comisiones', tokenUsuario, { usuarioId: ana, porcentaje: 50 }, 'PUT'),
  );
  assert.equal(negado.status, 403, 'un rol operativo pudo fijar un porcentaje');

  // Y leer tampoco: los sueldos del equipo no son de lectura general.
  const negadoLeer = await verPorcentajes(pedir('/api/admin/comisiones', tokenUsuario, undefined, 'GET'));
  assert.equal(negadoLeer.status, 403);

  // El administrador del sembrado sí.
  const tokenAdmin = await sesion(ana);
  const ok = await fijarPorcentaje(
    pedir('/api/admin/comisiones', tokenAdmin, { usuarioId: dos, porcentaje: 12.5 }, 'PUT'),
  );
  assert.equal(ok.status, 200);
  const cuerpo = (await ok.json()) as { usuarios: { usuarioId: string; porcentaje: number | null }[] };
  assert.equal(cuerpo.usuarios.find((u) => u.usuarioId === dos)?.porcentaje, 12.5);
});

test('el porcentaje se puede DEJAR SIN CONFIGURAR, y eso no es ponerlo en cero', async () => {
  // El único camino de vuelta desde «0 % a propósito» hasta «nadie lo definió». Sin `Object.hasOwn`,
  // `{"porcentaje": null}` se leería como «no vino» y este camino desaparecería en silencio.
  await limpiar();
  const t = await sesion(ana);
  await fijarPorcentaje(pedir('/api/admin/comisiones', t, { usuarioId: dos, porcentaje: 0 }, 'PUT'));
  const enCero = await leer(alfa, dos);
  assert.equal(enCero.porcentaje, 0, 'el cero a propósito tiene que quedar como cero');

  await fijarPorcentaje(pedir('/api/admin/comisiones', t, { usuarioId: dos, porcentaje: null }, 'PUT'));
  const sinConfigurar = await leer(alfa, dos);
  assert.equal(sinConfigurar.porcentaje, null, 'no volvió al estado «sin configurar»');
});

test('un porcentaje fuera de rango o de otro tipo se RECHAZA', async () => {
  await limpiar();
  const t = await sesion(ana);
  /* `NaN` no está en la lista, y la razón vale escribirla: **JSON no tiene NaN**. `JSON.stringify`
     lo serializa como `null`, que acá es el valor VÁLIDO para dejar sin configurar. O sea que ese
     caso no existe en la frontera HTTP, y ponerlo en la lista hacía fallar la prueba por un motivo
     que no era el que decía. */
  for (const malo of [101, -1, '10', '', {}, true, [10]]) {
    const r = await fijarPorcentaje(
      pedir('/api/admin/comisiones', t, { usuarioId: dos, porcentaje: malo }, 'PUT'),
    );
    assert.equal(r.status, 400, `se aceptó ${JSON.stringify(malo)} como porcentaje`);
  }
  // Y sin el campo tampoco: un cuerpo sin `porcentaje` no es «dejalo como está», porque este endpoint
  // tiene UNA sola cosa que hacer.
  const sinCampo = await fijarPorcentaje(pedir('/api/admin/comisiones', t, { usuarioId: dos }, 'PUT'));
  assert.equal(sinCampo.status, 400);
});

test('una persona de OTRA empresa responde 404, no 409 con el mensaje de la base', async () => {
  await limpiar();
  const t = await sesion(ana);
  const r = await fijarPorcentaje(
    pedir('/api/admin/comisiones', t, { usuarioId: bruno, porcentaje: 10 }, 'PUT'),
  );
  assert.equal(r.status, 404, 'la existencia de un usuario de otra empresa no se confirma ni se niega');
  const cuerpo = await r.text();
  assert.doesNotMatch(cuerpo, /comisiones|foreign key|constraint/i, 'el cuerpo filtró estructura de la base');
});

test('LAS DOS COLUMNAS NO SE PISAN: la meta no toca el porcentaje y el porcentaje no toca la meta', async () => {
  // Es la prueba que impide el defecto más silencioso de este par de endpoints. Con un solo endpoint
  // que escribiera las dos columnas con `?? null`, cada guardado borraría la mitad ajena — y el
  // síntoma («se me borró la meta») no tendría ninguna pista de quién la borró.
  await limpiar();
  const tAdmin = await sesion(ana);
  const tPropio = await sesion(ana);

  // El administrador fija el porcentaje de Ana; Ana fija su meta.
  await fijarPorcentaje(pedir('/api/admin/comisiones', tAdmin, { usuarioId: ana, porcentaje: 20 }, 'PUT'));
  const conMeta = await fijarMeta(pedir('/api/closer/meta', tPropio, { meta: 800 }, 'PATCH'));
  assert.equal(conMeta.status, 200);

  const k1 = await leer(alfa, ana);
  assert.equal(k1.porcentaje, 20, 'fijar la meta pisó el porcentaje');
  assert.equal(k1.meta, 800);

  // Y ahora al revés: el administrador cambia el porcentaje y la meta sobrevive.
  await fijarPorcentaje(pedir('/api/admin/comisiones', tAdmin, { usuarioId: ana, porcentaje: 30 }, 'PUT'));
  const k2 = await leer(alfa, ana);
  assert.equal(k2.porcentaje, 30);
  assert.equal(k2.meta, 800, 'fijar el porcentaje pisó la meta');
});

test('la meta se puede QUITAR, y una meta de cero se rechaza con motivo', async () => {
  await limpiar();
  const t = await sesion(ana);
  await fijarMeta(pedir('/api/closer/meta', t, { meta: 500 }, 'PATCH'));
  assert.equal((await leer(alfa, ana)).meta, 500);

  const quitada = await fijarMeta(pedir('/api/closer/meta', t, { meta: null }, 'PATCH'));
  assert.equal(quitada.status, 200);
  assert.equal((await leer(alfa, ana)).meta, null);

  // El cero lo rechaza el endpoint CON MOTIVO, antes de que lo rechace el `check` de la base: el
  // rechazo de la base sería un 409 con el mensaje del motor, que no explica nada.
  const cero = await fijarMeta(pedir('/api/closer/meta', t, { meta: 0 }, 'PATCH'));
  assert.equal(cero.status, 400);
  const cuerpo = (await cero.json()) as { detalle?: string };
  assert.match(cuerpo.detalle ?? '', /mayor que cero/i);
});

test('el PATCH de la meta devuelve la comisión RECALCULADA, no un «listo»', async () => {
  // Mostrar «guardado» sin leer lo que quedó es reportar un éxito sin verificarlo — y acá lo que
  // cambia con la meta es «cuánto falta» y «meta superada», que es justo lo que la persona mira.
  await limpiar();
  const c = await contacto(alfa);
  await resultado(alfa, c, ana, 'venta', 5000);
  await config(alfa, ana, { porcentaje: 10 });
  const t = await sesion(ana);

  const r = await fijarMeta(pedir('/api/closer/meta', t, { meta: 200 }, 'PATCH'));
  const cuerpo = (await r.json()) as { comision: { valor: number; faltaParaLaMeta: number; metaSuperada: boolean } };
  assert.equal(cuerpo.comision.valor, 500);
  assert.equal(cuerpo.comision.faltaParaLaMeta, -300);
  assert.equal(cuerpo.comision.metaSuperada, true);
});
