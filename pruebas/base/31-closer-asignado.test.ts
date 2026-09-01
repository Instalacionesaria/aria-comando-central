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
import { closersDeLaEmpresa } from '../../lib/negocio/alcanceDelCloser.ts';
import { candidatosAlCloser } from '../../lib/negocio/closer.ts';
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
/** El CUARTO, que existe solo para que el tope de tres se pueda medir de verdad. */
let otroMas: string;
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
  otroMas = await personaQueCierra('Cierra Cuatro');
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
/**
 * @param conSeccion `false` crea la persona con el rol `usuario` y **sin** la fila de la sección.
 *   Es el caso normal de alguien recién dado de alta: `usuario` está marcado `secciones_restringidas`,
 *   así que sin esa fila no ve la pestaña Closer y no puede ser designado. Hace falta poder crearlo
 *   para distinguir «nadie tiene el rol» de «nadie tiene la sección», que llevan a acciones distintas.
 */
async function personaQueCierra(nombre: string, org?: string, conSeccion = true): Promise<string> {
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
  if (conSeccion) {
    await admin.query(
      `insert into identidad.usuarios_secciones (usuario_id, seccion)
         values ($1, 'closer') on conflict do nothing`,
      [fila.id],
    );
  }
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

/**
 * Una petición al panel del closer.
 *
 * `cola` es la cadena de consulta, y existe porque el `DELETE` pasó a necesitar A QUIÉN se quita:
 * con un closer no hacía falta, con tres un borrado sin identificador se llevaría a los tres.
 */
function pedir(token: string, cuerpo?: unknown, metodo = 'PUT', cola = ''): Request {
  return new Request(`https://${DOMINIO}/api/admin/closer${cola}`, {
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

test('un ADMINISTRADOR puede ser closer, que es lo contrario de lo que esta prueba decía', async () => {
  /* ══════════════════════════════════════════════════════════════════════════
     ESTA PRUEBA AFIRMABA LO OPUESTO, Y SE LLAMABA «LA PRUEBA»

     Decía que un administrador NO podía designarse closer ni mandando su propio identificador, y
     el argumento era bueno mientras hubo UN closer: los números del cockpit eran de esa persona,
     así que designarse a uno mismo era escribirse el propio tablero.

     Se pidió sacar la regla —*«ahora cualquiera puede ser configurado como closer, admin
     superadmin o usuario»*— y el argumento que la sostenía se cayó solo con el cambio a varios
     closers: lo que decide qué leads ve cada uno ya no es la designación, es **el vínculo con un
     usuario de GoHighLevel**, y ese reparto lo hace el CRM.

     Medido, además: las tres personas de la empresa de producción son administradoras. La regla
     no protegía a nadie — dejaba el panel vacío mandando a crear un usuario más.
     ══════════════════════════════════════════════════════════════════════════ */
  await limpiar();
  const t = await sesion(ana);

  const r = await designar(pedir(t, { usuarioId: ana }));
  assert.equal(r.status, 200, await r.clone().text());

  const quedo = await conOrganizacion(alfa, () => closersDeLaEmpresa());
  assert.deepEqual(
    quedo.map((k) => k.usuarioId),
    [ana],
    'la administradora no quedó designada',
  );
});

test('la lista de candidatos INCLUYE a quien administra, y sigue acotada a la empresa', async () => {
  /* La otra mitad del cambio de arriba: antes esta prueba afirmaba que la administradora NO
     aparecía. Ahora aparece, y lo que sigue valiendo —y es lo que esta prueba cuida— es el
     aislamiento: nadie de otra organización entra a la lista.

     Las dos afirmaciones van juntas a propósito. Sacar la exclusión del administrador es aflojar
     un filtro, y aflojar un filtro es cuándo conviene comprobar que el otro sigue apretado. */
  const t = await sesion(ana);
  const r = await verEstado(pedir(t, undefined, 'GET'));
  assert.equal(r.status, 200);
  const cuerpo = (await r.json()) as { candidatos: { usuarioId: string }[] };

  const ids = cuerpo.candidatos.map((k) => k.usuarioId);
  assert.ok(ids.includes(ana), 'la administradora NO aparece: la exclusión volvió');
  assert.ok(ids.includes(cierra), 'quien tiene la pestaña closer no aparece');
  assert.ok(!ids.includes(deBeta), 'aparece alguien de otra organización en la lista');
});

test('con la lista vacía, el servidor dice CUÁL de los motivos es — y llevan a pantallas distintas', async () => {
  // ══════════════════════════════════════════════════════════════════════
  // EL DEFECTO QUE ESTO CIERRA, Y SE MIDIÓ CONTRA LA BASE DE PRODUCCIÓN
  //
  // La pantalla ya avisaba cuando el desplegable salía vacío, con UN texto para los cuatro motivos:
  // *«hay que darle a alguien la pestaña Closer desde Ajustes → Usuarios»*.
  //
  // Medido en producción el 2026-08-28, después de aplicar la migración 020: los tres usuarios que
  // existen son administradores, y **los tres ya tienen la pestaña Closer** —`closer.ver` está
  // concedida a los tres roles del catálogo—. Lo que les falta es lo contrario: no administrar la
  // empresa. Así que el aviso mandaba a una pantalla donde no había nada que cambiar, y quien lo
  // leyera quedaba trabado. No daba error y el texto era amable, que es lo peor de este defecto.
  //
  // El `before` de este archivo YA SABÍA el hecho —dice *«sin crear a nadie, la lista de candidatos es
  // vacía por construcción: todo el que tiene closer.ver en el sembrado es administrador»*— y ninguna
  // prueba miraba el motivo. Esta lo mira, y recorre los estados en orden.
  // ══════════════════════════════════════════════════════════════════════
  /* ── SE MIDE LA FUNCIÓN, NO EL ENDPOINT, Y ESO CAMBIÓ CON ESTE PEDIDO ─────
   *
   * Antes se medía por el `GET`: se desactivaban las candidatas y la lista salía vacía. **Eso ya
   * no se puede alcanzar por ahí**, y el motivo es el cambio mismo: quien abre este panel tiene
   * `credenciales.editar`, y desde que la exclusión del administrador se fue, esa persona es
   * candidata de sí misma. La lista nunca sale vacía para quien la puede pedir.
   *
   * No es una prueba que perdió su objeto: el estado sigue existiendo —una empresa donde nadie
   * tiene la sección concedida— y sigue habiendo un texto por motivo que la pantalla dibuja. Lo
   * que cambió es dónde se puede medir, y es una capa más adentro: `candidatosAlCloser` recibe la
   * transacción y el `org_id`, así que se le puede preguntar por una empresa donde TODOS estén
   * desactivados, incluida la administradora.
   *
   * Se mide la misma función que el endpoint llama, no una copia. */
  const motivo = async (): Promise<{ cuantos: number; porque: string | null }> => {
    const c = await conIdentidad((db) => candidatosAlCloser(db, alfa));
    return { cuantos: c.candidatos.length, porque: c.porqueNinguno };
  };

  // 0 · El estado de partida: hay candidatos, así que NO hay motivo. Un motivo con la lista llena
  //     sería un texto de «no hay nadie» esperando a dibujarse por error.
  const inicial = await motivo();
  assert.ok(inicial.cuantos > 0, 'el escenario arranca sin candidatos');
  assert.equal(inicial.porque, null, 'con candidatos en la lista, el motivo tiene que ser nulo');

  let sinSeccion: string | null = null;
  try {
    /* 1 · SIN LA SECCIÓN CONCEDIDA. Se desactivan TODAS las personas de `alfa` —incluida la
     *     administradora, que ahora es candidata— y queda una sola con rol `usuario` y sin la
     *     fila de la sección. Ese rol está marcado `secciones_restringidas`, así que nace sin ver
     *     la pestaña, y la acción que resuelve es concederla.
     *
     *     Desactivar a la administradora es lo que el endpoint no permitía: es ella quien hace la
     *     petición. Midiendo la función, el escenario se puede armar entero. */
    sinSeccion = await personaQueCierra('Sin Seccion', undefined, false);
    await admin.query(
      `update identidad.usuarios set activo = false where org_id = $1 and id <> $2`,
      [alfa, sinSeccion],
    );
    assert.deepEqual(
      await motivo(),
      { cuantos: 0, porque: 'sin_seccion' },
      'una persona con el rol adecuado y sin la sección concedida tiene que dar `sin_seccion`: la ' +
        'acción que resuelve es concederla, y es la única que resuelve',
    );

    /* 2 · SIN NADIE. Desactivada también ésa, el motivo pasa a `sin_gente`, que manda a otra
     *     pantalla: dar de alta a una persona. Sin esta mitad, un motivo fijo pasaría el caso de
     *     arriba y la pantalla mandaría a conceder una sección a nadie. */
    await admin.query(`update identidad.usuarios set activo = false where org_id = $1`, [alfa]);
    assert.deepEqual(await motivo(), { cuantos: 0, porque: 'sin_gente' });

    /* 3 · Y CON UNA CANDIDATA DE VUELTA, el motivo desaparece. Sin esta mitad, un motivo fijo
     *     pasaría los dos casos de arriba y la pantalla mostraría «no hay nadie» con el
     *     desplegable lleno. */
    await admin.query(`update identidad.usuarios set activo = true where id = $1`, [cierra]);
    const conUna = await motivo();
    assert.equal(conUna.cuantos, 1, 'la candidata reactivada no volvió a la lista');
    assert.equal(conUna.porque, null, 'con una candidata en la lista sigue habiendo motivo');
  } finally {
    /* Se restaura TODO, y no por prolijidad: las otras pruebas de este archivo cuentan con que
       las personas de `alfa` están activas, y una prueba que deja el escenario cambiado convierte
       a las siguientes en rojas según el orden del archivo. */
    await admin.query(`update identidad.usuarios set activo = true where org_id = $1`, [alfa]);
    if (sinSeccion !== null) {
      await admin.query(`delete from identidad.usuarios_roles where usuario_id = $1`, [sinSeccion]);
      await admin.query(`delete from identidad.usuarios where id = $1`, [sinSeccion]);
    }
  }

  // Y queda restaurado de verdad, comprobado y no supuesto.
  const final = await motivo();
  assert.ok(final.cuantos >= 2, 'el escenario no volvió a su estado: las pruebas de abajo van a fallar');
  assert.equal(final.porque, null);
});

/* ── EL MOTIVO QUE ESTA PRUEBA NO EJERCITA, Y POR QUÉ ─────────────────────
 *
 * Son tres motivos y acá se recorren dos. Falta `sin_capacidad` —personas que no tienen
 * `closer.ver`— y es **inalcanzable con el catálogo de este sistema**: los tres roles la tienen,
 * así que haría falta un rol propio de la empresa que no la tuviera.
 *
 * Se deja sin cubrir a propósito y escrito acá en vez de fingir que está: montar un rol a medida
 * para ejercitar una rama que ninguna empresa puede alcanzar hoy es complejidad que hay que
 * mantener. Es también por eso que `sin_capacidad` es el valor de reserva del catálogo de textos
 * de la pantalla: si algún día un rol propio la alcanza, el mensaje que sale es el correcto. */
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

test('designar a otro AGREGA, no reemplaza, y el cuarto se rechaza con su motivo', async () => {
  /* ══════════════════════════════════════════════════════════════════════════
     ERA «UNA FILA Y LA SEGUNDA REEMPLAZA», Y AHORA SON HASTA TRES

     La clave primaria era `org_id` entero: la base **no aceptaba** un segundo closer, y esta
     prueba afirmaba justamente eso. La migración 034 la abrió a `(org_id, usuario_id)` porque se
     pidieron hasta tres.

     Lo que se afirma ahora es lo que reemplaza a aquella garantía: designar **agrega** —el segundo
     no se lleva puesto al primero, que sería perder un closer sin decirlo— y el tope existe y se
     rechaza con un motivo que la pantalla puede decir.
     ══════════════════════════════════════════════════════════════════════════ */
  await limpiar();
  const t = await sesion(ana);

  assert.equal((await designar(pedir(t, { usuarioId: cierra }))).status, 200);
  assert.equal((await designar(pedir(t, { usuarioId: cierraDos }))).status, 200);

  const dos = await conOrganizacion(alfa, () => closersDeLaEmpresa());
  assert.deepEqual(
    dos.map((k) => k.usuarioId).sort(),
    [cierra, cierraDos].sort(),
    'designar al segundo se llevó puesto al primero',
  );

  // El tercero entra —el tope es tres— y el CUARTO no.
  assert.equal((await designar(pedir(t, { usuarioId: ana }))).status, 200);
  const r = await designar(pedir(t, { usuarioId: otroMas }));
  assert.equal(r.status, 409, await r.clone().text());
  assert.match((await r.json() as { detalle?: string }).detalle ?? '', /m[áa]ximo|Quit[áa]/i);

  const cuantas = await unaFila<{ n: string }>(
    admin,
    'select count(*) as n from negocio.closer_asignado where org_id = $1',
    [alfa],
  );
  assert.equal(cuantas?.n, '3', 'el tope de tres no se respetó');
});

test('dos personas NO se pueden vincular al mismo usuario del CRM', async () => {
  /* Es lo único que la BASE hace cumplir de todo esto, con el índice único parcial de la 034, y
     por eso vale la pena medirlo: dos closers vinculados al mismo usuario de GoHighLevel
     reclamarían **los mismos leads**. Cada uno vería la lista completa del otro y los dos
     llamarían al mismo contacto. Nada fallaría: las dos filas son válidas y las dos consultas
     devuelven resultados.

     El endpoint lo comprueba antes para poder devolver un motivo legible; si no lo hiciera, el
     índice devolvería un `23505` que nombra un índice y nadie sabría qué hacer. */
  await limpiar();
  const t = await sesion(ana);

  assert.equal(
    (await designar(pedir(t, { usuarioId: cierra, crmUsuarioId: 'usuarioDelCrm1' }))).status,
    200,
  );
  const r = await designar(pedir(t, { usuarioId: cierraDos, crmUsuarioId: 'usuarioDelCrm1' }));
  assert.equal(r.status, 409, await r.clone().text());
  assert.match((await r.json() as { detalle?: string }).detalle ?? '', /ya está vinculado/i);

  // Y volver a guardar al MISMO con su mismo vínculo sí se puede: no es un cambio, pero tiene
  // que poder hacerse — es lo que pasa al tocar el porcentaje sin tocar el desplegable.
  assert.equal(
    (await designar(pedir(t, { usuarioId: cierra, crmUsuarioId: 'usuarioDelCrm1' }))).status,
    200,
  );
});

test('quitar deja la empresa SIN closer, que no es lo mismo que sin configurar el porcentaje', async () => {
  // Hay que poder volver de «es Ana» a «todavía nadie». Sin esta operación el único camino sería
  // designar a otra persona, que es un hecho distinto.
  await limpiar();
  const t = await sesion(ana);
  await designar(pedir(t, { usuarioId: cierra }));

  /* A QUIÉN se quita va por parámetro, y antes no hacía falta porque había uno. Sin él,
     `quitarCloser()` borraría a los tres: la política de aislamiento no lo impediría porque acota
     por organización, que es justo lo que ese borrado ya hace. */
  assert.equal(
    (await quitar(pedir(t, undefined, 'DELETE', `?usuarioId=${cierra}`))).status,
    200,
  );
  assert.deepEqual(
    await conOrganizacion(alfa, () => closersDeLaEmpresa()),
    [],
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
  let ck = await conOrganizacion(alfa, () => cockpitDelMes(ZONA, 0, { tipo: 'persona', usuarioId: cierra, crmUsuarioId: null }));
  assert.equal(ck.cobrado.valor, 1000, 'el cockpit sumó ventas que no son del designado');

  await designar(pedir(t, { usuarioId: cierraDos }));
  ck = await conOrganizacion(alfa, () => cockpitDelMes(ZONA, 0, { tipo: 'persona', usuarioId: cierraDos, crmUsuarioId: null }));
  assert.equal(ck.cobrado.valor, 2000, 'cambiar el designado no cambió los números');
});

test('sin closer designado el cockpit dice que FALTA elegirlo, y no cero', async () => {
  // La regla de todo el cockpit aplicada al caso nuevo, y el texto importa: manda a hacer lo que
  // corresponde. Con el mensaje de «nadie registró resultados» se mandaría a cargar un resultado que
  // ya existe.
  await limpiar();
  const c = await contacto(alfa);
  await venta(alfa, c, cierra, 5000);

  const ck = await conOrganizacion(alfa, () => cockpitDelMes(ZONA, 0, { tipo: 'nadie' }));
  assert.equal(
    ck.cobrado.valor,
    null,
    'sin closer designado el cockpit devolvió un número: son las ventas de la empresa mostradas ' +
      'como si fueran de un closer que nadie eligió',
  );
  assert.match(
    ck.cobrado.falta ?? '',
    /closer configurado/i,
    'el texto no dice que falta configurar un closer',
  );
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
  await quitar(pedir(t, undefined, 'DELETE', `?usuarioId=${cierra}`));

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
