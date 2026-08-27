// Quién es EL closer: quién puede serlo, quién lo elige, y de quién son los números. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// «CLOSER» NO ES UN ROL, Y ESO ABRE UNA PUERTA QUE HAY QUE CERRAR ACÁ
//
// La designación la hace quien administra, desde un desplegable. Y un desplegable es una pantalla:
// **lo que llega al endpoint es un identificador en un cuerpo JSON**, no una opción de una lista.
//
// Así que la regla que se pidió —*"un admin no debe poder ser closer"*— no la puede sostener el
// desplegable. Si el endpoint solo comprobara que la persona existe, un administrador mandaría su
// propio identificador y quedaría designado: existe, es de su empresa, y pasa. Con el cockpit
// mostrando siempre al designado, se habría dado a sí mismo un anillo de comisión.
//
// La prueba central de este archivo es exactamente ésa.
//
// ── Y LA OTRA MITAD: DE QUIÉN SON LOS NÚMEROS ───────────────────────────────
//
// Hasta la migración `020`, el número grande del cockpit era de TODA la empresa y el anillo de al
// lado de quien miraba. La `015` lo dejó medido y no pudo cerrarlo sola. Ahora los dos salen del
// designado, así que designar a otra persona cambia toda la pantalla — y eso también se comprueba.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { COOKIE_SESION, hashDeToken } from '../../lib/autorizacion/sesion.ts';
import {
  GET as verEstado,
  PUT as designar,
  DELETE as quitar,
} from '../../app/api/admin/closer/route.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { closerAsignado } from '../../lib/negocio/closer.ts';
import { cockpitDelMes } from '../../lib/negocio/inicio.ts';

const ZONA = 'America/Lima';
const DOMINIO = 'ejemplo.test';

/* ── LA MARCA, Y POR QUÉ SE BARRE ANTES Y DESPUÉS ─────────────────────────────
 *
 * Esta prueba CREA personas en las organizaciones del sembrado, porque el sembrado trae una sola por
 * empresa y es administradora — o sea que sin crear a nadie no hay candidatos y no hay nada que
 * comprobar.
 *
 * Eso tiene un costo que se pagó una vez: una corrida en la que el `before` se cortó a mitad dejó
 * usuarios sin borrar, y la corrida siguiente puso en rojo
 * `11-sembrado · hay un usuario en cada organización` — una prueba de OTRO archivo, con un mensaje
 * que no menciona esta. Un `after` no alcanza: no corre si el `before` revienta.
 *
 * Así que el barrido va en los DOS extremos y por MARCA, no por identificador: en `before` limpia lo
 * que dejó una corrida anterior, y en `after` lo propio. */
const MARCA = 'closer-designado-prueba';

let admin: Client;
let alfa: string;
let beta: string;
/** La administradora de alfa: tiene `credenciales.editar`, así que NO puede ser closer. */
let ana: string;
/** Una persona con rol `usuario` y la sección `closer` concedida: la candidata. */
let cierra: string;
/** Otra igual, para comprobar que designar a una reemplaza a la otra. */
let cierraDos: string;
/** Una de la otra empresa: no tiene que existir para esta organización. */
let deBeta: string;

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  const a = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug='alfa'`);
  const b = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug='beta'`);
  assert.ok(a && b, 'faltan las organizaciones del sembrado');
  alfa = a.id;
  beta = b.id;

  const u = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email='ana@alfa.ejemplo'`);
  assert.ok(u, 'falta ana del sembrado');
  ana = u.id;

  /* ── LAS CANDIDATAS SE CREAN ACÁ, Y NO ES COMODIDAD ────────────────────────
   *
   * El sembrado trae una persona por empresa y es administradora. O sea que **sin crear a nadie, la
   * lista de candidatos es vacía por construcción**: todo el que tiene `closer.ver` en el sembrado
   * es administrador, y los administradores están excluidos.
   *
   * Eso no es un defecto del sembrado: es que el rol de operación existe y no está asignado a nadie.
   * `usuario` tiene todo MENOS `organizaciones.%`, `usuarios.%`, `roles.%` y `credenciales.%` —o sea
   * que tiene `closer.ver` y no tiene `credenciales.editar`— y está marcado
   * `secciones_restringidas`, así que además necesita la fila de la sección. Las dos mitades se
   * arman abajo, y son las dos que la lista comprueba. */
  // Los restos de una corrida que se cortó. Ver el comentario de `MARCA`.
  await barrerLosDeLaMarca();

  cierra = await personaQueCierra('Cierra Alfa');
  cierraDos = await personaQueCierra('Cierra Dos');
  deBeta = await personaQueCierra('Cierra Beta', beta);

  await limpiar();
});

after(async () => {
  await limpiar();
  await barrerLosDeLaMarca();
  await cerrarTodo();
  await cerrarClientes();
});

/** Borra toda persona creada por este archivo, la haya creado esta corrida u otra. */
async function barrerLosDeLaMarca(): Promise<void> {
  /* El orden importa: `usuarios_roles.rol_id` es `no action`, y las sesiones y las secciones
     apuntan a la persona. Se sacan las dependencias y después la fila. */
  const patron = `%${MARCA}%`;
  for (const sql of [
    'delete from identidad.usuarios_secciones where usuario_id in (select id from identidad.usuarios where email like $1)',
    'delete from identidad.usuarios_roles where usuario_id in (select id from identidad.usuarios where email like $1)',
    'delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where email like $1)',
    'delete from negocio.closer_asignado where usuario_id in (select id from identidad.usuarios where email like $1)',
    'delete from negocio.comisiones where usuario_id in (select id from identidad.usuarios where email like $1)',
    'delete from negocio.resultados where registrado_por in (select id from identidad.usuarios where email like $1)',
    'delete from identidad.usuarios where email like $1',
  ]) {
    await admin.query(sql, [patron]);
  }
}

async function limpiar(): Promise<void> {
  await admin.query('delete from negocio.closer_asignado');
  await admin.query('delete from negocio.comisiones');
  await admin.query('delete from negocio.resultados');
  await admin.query('delete from negocio.contactos');
}

/** Una persona con rol `usuario` y la sección `closer` concedida. */
async function personaQueCierra(nombre: string, org?: string): Promise<string> {
  const fila = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.usuarios (org_id, nombre, email, password_hash)
       values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [
      org ?? alfa,
      nombre,
      // La MARCA va en el correo: es lo que hace barrible un resto de una corrida cortada.
      `${MARCA}-${nombre.toLowerCase().replace(/ /g, '-')}-${randomUUID().slice(0, 8)}@ejemplo.test`,
    ],
  );
  assert.ok(fila);
  const rol = await unaFila<{ id: string }>(
    admin,
    `select id from identidad.roles where clave = 'usuario' and org_id is null`,
  );
  assert.ok(rol, 'falta el rol `usuario` del catálogo: ¿corrió `db:arranque`?');
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) values ($1, $2)
       on conflict do nothing`,
    [fila.id, rol.id],
  );
  /* Sin `org_id`: esa tabla NO lo tiene. Su migración lo explica — en `identidad` el aislamiento
     entre inquilinos lo pone el CÓDIGO, con `usuarioObjetivo(db, id, orgEfectiva)`, y por eso la
     tabla solo guarda `usuario_id`. Es también el motivo de que `candidatosAlCloser` filtre primero
     los usuarios por organización y después consulte esta tabla por esos identificadores. */
  await admin.query(
    `insert into identidad.usuarios_secciones (usuario_id, seccion)
       values ($1, 'closer') on conflict do nothing`,
    [fila.id],
  );
  return fila.id;
}

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

function pedir(token: string, cuerpo?: unknown, metodo = 'PUT'): Request {
  return new Request(`https://${DOMINIO}/api/admin/closer`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      origin: `https://${DOMINIO}`,
      cookie: `${COOKIE_SESION}=${token}`,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

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

async function venta(org: string, contactoId: string, quien: string, monto: number): Promise<void> {
  await conOrganizacion(org, async () => {
    await datos()
      .insertInto('resultados')
      .values({
        contacto_id: contactoId,
        salida: 'venta',
        monto,
        registrado_por: quien,
        rol: 'closer',
      } as never)
      .execute();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LA PRUEBA: UN ADMINISTRADOR NO PUEDE SER CLOSER
// ═══════════════════════════════════════════════════════════════════════════════

test('LA PRUEBA: un administrador NO puede designarse closer, ni mandando su propio id', async () => {
  // El desplegable no la ofrece. Eso no alcanza: lo que llega al endpoint es un identificador en un
  // cuerpo JSON, y quien lo manda es la misma persona que tiene permiso de escribir acá.
  //
  // Si esto pasara, un administrador se habría dado a sí mismo el anillo de comisión del cockpit.
  await limpiar();
  const t = await sesion(ana);

  const r = await designar(pedir(t, { usuarioId: ana }));
  assert.equal(
    r.status,
    404,
    'un administrador se pudo designar closer: comprobar que el usuario EXISTE no alcanza, porque ' +
      'un administrador existe y es de su propia empresa',
  );

  // Y no quedó nada escrito.
  const quedo = await conOrganizacion(alfa, () => closerAsignado());
  assert.equal(quedo, null, 'quedó una designación de una petición rechazada');
});

test('la lista de candidatos excluye a quien administra, y por CAPACIDAD', async () => {
  // La regla se escribe con `credenciales.editar` y no con el nombre del rol —`ADR-0302`—, y la
  // capacidad elegida es la misma que habilita designar: quien puede designar no puede ser
  // designado. Un rol nuevo que administre la empresa queda excluido solo.
  const t = await sesion(ana);
  const r = await verEstado(pedir(t, undefined, 'GET'));
  assert.equal(r.status, 200);
  const cuerpo = (await r.json()) as { candidatos: { usuarioId: string }[]; asignado: unknown };

  const ids = cuerpo.candidatos.map((k) => k.usuarioId);
  assert.ok(!ids.includes(ana), 'la administradora aparece en la lista de candidatos a closer');
  assert.ok(ids.includes(cierra), 'quien tiene la pestaña closer y no administra NO aparece');
  // Y nadie de la otra empresa, que es la otra mitad del aislamiento.
  assert.ok(!ids.includes(deBeta), 'aparece alguien de otra organización en la lista');
});

test('una persona de OTRA empresa no se puede designar, y responde 404 y no 403', async () => {
  // `ADR-0501`: un 403 confirmaría que ese identificador existe. El mismo 404 cubre los tres casos
  // —no existe, es de otra empresa, o no puede ser closer— sin decir cuál fue.
  await limpiar();
  const t = await sesion(ana);
  const r = await designar(pedir(t, { usuarioId: deBeta }));
  assert.equal(r.status, 404, 'se pudo designar a alguien de otra organización');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · DESIGNAR, REEMPLAZAR Y QUITAR
// ═══════════════════════════════════════════════════════════════════════════════

test('designar escribe UNA fila, y designar a otro la REEMPLAZA', async () => {
  // La clave primaria es `org_id` entero, así que una organización no puede tener dos closers: no es
  // una convención del código, es una fila que la base no acepta. Y el `on conflict` hace el cambio
  // atómico: no existe el instante con dos designados ni el instante con ninguno.
  await limpiar();
  const t = await sesion(ana);

  assert.equal((await designar(pedir(t, { usuarioId: cierra }))).status, 200);
  assert.equal((await conOrganizacion(alfa, () => closerAsignado()))?.usuarioId, cierra);

  assert.equal((await designar(pedir(t, { usuarioId: cierraDos }))).status, 200);
  const ahora = await conOrganizacion(alfa, () => closerAsignado());
  assert.equal(ahora?.usuarioId, cierraDos, 'designar a otro no reemplazó al anterior');

  const cuantas = await unaFila<{ n: string }>(
    admin,
    'select count(*) as n from negocio.closer_asignado where org_id = $1',
    [alfa],
  );
  assert.equal(cuantas?.n, '1', 'quedaron dos designaciones para la misma empresa');
});

test('quitar deja la empresa SIN closer, que no es lo mismo que sin configurar el porcentaje', async () => {
  // Hay que poder volver de «es Ana» a «todavía nadie». Sin esta operación el único camino sería
  // designar a otra persona, que es un hecho distinto.
  await limpiar();
  const t = await sesion(ana);
  await designar(pedir(t, { usuarioId: cierra }));

  assert.equal((await quitar(pedir(t, undefined, 'DELETE'))).status, 200);
  assert.equal(
    await conOrganizacion(alfa, () => closerAsignado()),
    null,
    'quitar no borró la designación',
  );
});

test('quien NO puede editar credenciales no puede designar ni quitar', async () => {
  // La misma capacidad que excluye de la lista es la que habilita escribir acá. Sin esto, cualquiera
  // con la pestaña Closer podría designarse a sí mismo.
  await limpiar();
  const t = await sesion(cierra);

  const r1 = await designar(pedir(t, { usuarioId: cierraDos }));
  assert.ok(r1.status === 403 || r1.status === 404, `designó sin permiso: respondió ${r1.status}`);
  const r2 = await quitar(pedir(t, undefined, 'DELETE'));
  assert.ok(r2.status === 403 || r2.status === 404, `quitó sin permiso: respondió ${r2.status}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · DE QUIÉN SON LOS NÚMEROS
// ═══════════════════════════════════════════════════════════════════════════════

test('el cockpit sigue al designado: cambiarlo cambia TODOS los números', async () => {
  // ── EL DEFECTO QUE LA 015 MIDIÓ Y NO PUDO CERRAR SOLA ─────────────────────
  //
  // Su encabezado: *"ese `cobrado` es de TODA la organización"*. Con la comisión por persona, la
  // pantalla multiplicaba un porcentaje personal por una base de la empresa — *"correcto con un
  // closer y falso desde el segundo. Y no falla: da un número plausible y más alto"*.
  //
  // Acá cada una vendió lo suyo, y el cockpit tiene que mostrar el de quien está designado. Sin el
  // filtro por persona daría 3000 para las dos.
  await limpiar();
  const c1 = await contacto(alfa);
  const c2 = await contacto(alfa);
  await venta(alfa, c1, cierra, 1000);
  await venta(alfa, c2, cierraDos, 2000);

  const t = await sesion(ana);

  await designar(pedir(t, { usuarioId: cierra }));
  let ck = await conOrganizacion(alfa, () => cockpitDelMes(ZONA, 0, cierra));
  assert.equal(ck.cobrado.valor, 1000, 'el cockpit sumó ventas que no son del designado');

  await designar(pedir(t, { usuarioId: cierraDos }));
  ck = await conOrganizacion(alfa, () => cockpitDelMes(ZONA, 0, cierraDos));
  assert.equal(ck.cobrado.valor, 2000, 'cambiar el designado no cambió los números');
});

test('sin closer designado el cockpit dice que FALTA elegirlo, y no cero', async () => {
  // La regla de todo el cockpit aplicada al caso nuevo, y el texto importa: manda a hacer lo que
  // corresponde. Con el mensaje de «nadie registró resultados» se mandaría a cargar un resultado que
  // ya existe.
  await limpiar();
  const c = await contacto(alfa);
  await venta(alfa, c, cierra, 5000);

  const ck = await conOrganizacion(alfa, () => cockpitDelMes(ZONA, 0, null));
  assert.equal(
    ck.cobrado.valor,
    null,
    'sin closer designado el cockpit devolvió un número: son las ventas de la empresa mostradas ' +
      'como si fueran de un closer que nadie eligió',
  );
  assert.match(ck.cobrado.falta ?? '', /closer asignado/i, 'el texto no dice que falta designarlo');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL RASTRO
// ═══════════════════════════════════════════════════════════════════════════════

test('designar y quitar quedan en la auditoría, con actor y objetivo', async () => {
  // Decide de quién son los números y el sueldo que muestra una pantalla. Sin estas filas, un cambio
  // de designación no deja rastro de quién lo hizo.
  await limpiar();

  /* ── NO SE BORRA LA AUDITORÍA PARA AISLAR LA PRUEBA, Y LA BASE TIENE RAZÓN ──
   *
   * La primera versión empezaba con un `delete from identidad.auditoria_accesos`, y reventó con
   * *«La tabla auditoria_accesos es de solo inserción (intento de DELETE)»*: un disparador lo
   * impide. Es exactamente para lo que existe — un registro que se puede borrar no es un registro,
   * y que la prueba no pueda hacer trampa es la misma garantía que protege a producción.
   *
   * Así que se acota por VENTANA: se marca el instante antes de operar y se leen las filas
   * posteriores. Vale igual y no necesita permisos que nadie debería tener. */
  const desde = await unaFila<{ ahora: Date }>(admin, 'select now() as ahora');
  assert.ok(desde);
  const t = await sesion(ana);

  await designar(pedir(t, { usuarioId: cierra }));
  await quitar(pedir(t, undefined, 'DELETE'));

  /* Las columnas son `usuario_id` —EL ACTOR— y `detalle`, un JSON donde `auditarAdministracion`
     guarda el objetivo. No hay `actor_id` ni `objetivo_id`: la primera versión de esta prueba los
     inventó y el motor la corrigió con un *«column "actor_id" does not exist»*. Vale anotarlo porque
     el nombre `usuario_id` para el actor es justo el que se lee al revés: en una fila de
     administración, el «usuario» es quien HIZO la acción, no sobre quien se hizo. */
  const filas = await admin.query<{ accion: string; usuario_id: string; detalle: { objetivo?: string } }>(
    `select accion, usuario_id, detalle from identidad.auditoria_accesos
      where accion like 'closer_%' and creado_el >= $1 order by creado_el asc, id asc`,
    [desde.ahora],
  );
  assert.deepEqual(
    filas.rows.map((f) => f.accion),
    ['closer_designado', 'closer_quitado'],
    'faltan las filas de auditoría de la designación',
  );
  for (const f of filas.rows) {
    assert.equal(f.usuario_id, ana, 'la auditoría no registró quién lo hizo');
    assert.equal(f.detalle?.objetivo, cierra, 'la auditoría no registró sobre quién');
  }
});
