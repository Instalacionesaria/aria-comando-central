// ADR-0101 — El administrador fundador no se borra, no se desactiva, no se degrada.
// ADR-0102 — La organización principal no se desactiva.
// ADR-0103 — El rol de plataforma solo existe en la organización principal.
// ADR-0104 — Un rol privado de una organización no se asigna a usuario de otra.
// ADR-0105 — La auditoría es inmutable.
// ADR-0106 — Las referencias dentro del inquilino no cruzan organizaciones.
// Tipo: Base. Es el criterio de cierre de la Etapa 1.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTAS PRUEBAS CORREN COMO SUPERUSUARIO, y no con el rol de la aplicación
//
// Es contraintuitivo —el 09 § 1 insiste en correr las pruebas con el rol real, porque
// "con el propietario casi nada de esto se manifiesta y todo se ve perfecto"— así que
// conviene decir por qué acá es al revés.
//
// Estos disparadores NO existen para detener a la aplicación. Existen para detener lo
// que NO pasa por la aplicación: "un condicional se saltea con un script de
// mantenimiento, una consola de administración, un endpoint nuevo que nadie revisó, o
// una sentencia a mano un domingo. Una restricción de la base no" (00 § 2, regla 4).
// Una sesión de superusuario ES esa sentencia a mano un domingo. Probar el disparador
// desde ahí es probar exactamente el modelo de amenaza que justifica su existencia.
//
// Y hay una razón mecánica además de la doctrinal: con el rol de la aplicación, varias
// de estas operaciones son rechazadas ANTES de llegar al disparador —por falta de
// permiso (`app_identidad` no tiene `delete` sobre `usuarios`) o por la política de
// fila— y la prueba pasaría POR EL MOTIVO EQUIVOCADO, sin haber ejercitado nunca el
// disparador. El caso más engañoso es el borrado como `migrador`: con el forzado
// puesto y sin política que lo nombre, el `delete` afecta CERO FILAS SIN ERROR y el
// disparador nunca se dispara. Una prueba que exigiera "falla" quedaría verde
// creyendo haber comprobado la invariante.
//
// La segunda capa —que ningún rol de aplicación TENGA el permiso— se afirma aparte,
// al final de este archivo.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';

let su: Client;

/** El identificador de una fila sembrada, buscado por una columna estable. */
async function idDe(tabla: string, columna: string, valor: string): Promise<string> {
  const f = await unaFila<{ id: string }>(
    su,
    `select id from identidad.${tabla} where ${columna} = $1`,
    [valor],
  );
  assert.ok(f?.id, `no se encontró ${tabla} con ${columna} = ${valor}`);
  return f.id;
}

before(async () => {
  su = await conectar('admin');
  // Que de verdad sea una sesión exenta de RLS: si no lo fuera, todo lo de abajo
  // pasaría por el motivo equivocado.
  const q = await unaFila<{ su: string }>(su, `select current_setting('is_superuser') as su`);
  assert.equal(q?.su, 'on', 'esta prueba necesita una sesión exenta de RLS para llegar al disparador');
});

after(async () => {
  await cerrarTodo();
});

// ─── ADR-0101 · el administrador fundador ───────────────────────────────────

test('ADR-0101 · el fundador no se puede BORRAR', async () => {
  await assert.rejects(
    () => su.query('delete from identidad.usuarios where es_admin_principal'),
    /no se puede eliminar/i,
  );
});

test('ADR-0101 · el fundador no se puede DESACTIVAR', async () => {
  await assert.rejects(
    () => su.query('update identidad.usuarios set activo = false where es_admin_principal'),
    /no se puede desactivar/i,
  );
});

test('ADR-0101 · el fundador no se puede DEGRADAR', async () => {
  await assert.rejects(
    () => su.query('update identidad.usuarios set es_admin_principal = false where es_admin_principal'),
    /no se puede degradar/i,
  );
});

test('ADR-0101 · el email del fundador es inmutable', async () => {
  await assert.rejects(
    () => su.query(`update identidad.usuarios set email = 'otro@ejemplo.com' where es_admin_principal`),
    /email del administrador principal es inmutable/i,
  );
});

test('ADR-0101 · pero su CONTRASEÑA sí se puede rotar', async () => {
  // Lo inmutable es QUIÉN ES y QUÉ PUEDE HACER, no su credencial: "si no se pudiera
  // rotar, una filtración sería permanente" (01 § 6).
  //
  // Esta afirmación es la que impide que alguien "endurezca" el disparador hasta
  // volver la cuenta irrecuperable.
  //
  // DENTRO DE UNA TRANSACCIÓN QUE SE REVIERTE. Es la única prueba de este archivo que
  // necesita que una escritura TENGA ÉXITO sobre una fila sembrada, y sin revertirla
  // dejaría al fundador con un hash inservible — con lo que la prueba del sembrado
  // ("el hash guardado VERIFICA") fallaría según el ORDEN de los archivos. Ya pasó
  // durante el desarrollo de esta etapa.
  //
  // La regla que sale de ahí: una prueba que muta estado sembrado compartido lo hace
  // en una transacción y la revierte. Las de arriba no la necesitan porque todas
  // esperan un RECHAZO, y un rechazo no cambia nada.
  await su.query('begin');
  try {
    const r = await su.query(
      `update identidad.usuarios set password_hash = 'scrypt$16384$8$1$YWJj$ZGVm'
        where es_admin_principal`,
    );
    assert.equal(r.rowCount, 1, 'la rotación de contraseña del fundador tiene que funcionar');
  } finally {
    await su.query('rollback');
  }

  // Y comprobar que de verdad se revirtió: un `rollback` que no revierte es
  // exactamente el éxito reportado que no ocurrió.
  const ahora = await unaFila<{ password_hash: string | null }>(
    su,
    'select password_hash from identidad.usuarios where es_admin_principal',
  );
  assert.notEqual(ahora?.password_hash, 'scrypt$16384$8$1$YWJj$ZGVm', 'el rollback no revirtió');
});

// ─── ADR-0102 · la organización principal ───────────────────────────────────

test('ADR-0102 · la organización principal no se puede DESACTIVAR', async () => {
  // Desactivarla equivale a apagar la plataforma entera.
  await assert.rejects(
    () => su.query('update identidad.organizaciones set activa = false where es_principal'),
    /no se puede desactivar/i,
  );
});

test('ADR-0102 · la organización principal no se puede DESMARCAR ni ELIMINAR', async () => {
  await assert.rejects(
    () => su.query('update identidad.organizaciones set es_principal = false where es_principal'),
    /no se puede desmarcar/i,
  );
  await assert.rejects(
    () => su.query('delete from identidad.organizaciones where es_principal'),
    /no se puede eliminar/i,
  );
});

// ─── ADR-0103 · el rol de plataforma acotado ────────────────────────────────

test('ADR-0103 · asignar el rol de plataforma a un usuario de un CLIENTE falla', async () => {
  // Es LA barrera contra la escalada entre inquilinos: sin ella, el administrador de
  // una empresa cliente podría otorgarse un rol de plataforma dentro de su propia
  // empresa y con él ver a todas las demás.
  const usuarioCliente = await idDe('usuarios', 'email', 'ana@alfa.ejemplo');
  const rolPlataforma = await idDe('roles', 'clave', 'superadministrador');

  await assert.rejects(
    () =>
      su.query('insert into identidad.usuarios_roles (usuario_id, rol_id) values ($1, $2)', [
        usuarioCliente,
        rolPlataforma,
      ]),
    /solo existe en la organización principal/i,
  );
});

test('ADR-0103 · y al fundador no se le puede quitar por la puerta de atrás', async () => {
  // El disparador que protege al fundador mira la tabla de USUARIOS. Pero su rol no
  // vive ahí: vive en la tabla de asignaciones, y un `delete` sobre esa tabla lo
  // dejaría sin permisos sin tocar ni una fila protegida. Los dos disparadores que hay
  // sobre las asignaciones son `before insert or update`: NINGUNO mira el borrado.
  const fundador = await idDe('usuarios', 'email', 'fundadora@principal.ejemplo');
  const rolPlataforma = await idDe('roles', 'clave', 'superadministrador');

  await assert.rejects(
    () =>
      su.query('delete from identidad.usuarios_roles where usuario_id = $1 and rol_id = $2', [
        fundador,
        rolPlataforma,
      ]),
    /no se le puede quitar el rol de plataforma/i,
  );
});

// ─── ADR-0104 · un rol privado no cruza organizaciones ──────────────────────

test('ADR-0104 · un rol privado de una organización no se asigna a usuario de otra', async () => {
  // La clave foránea se satisface —el identificador existe— así que nada más lo
  // impide. La columna de organización en `roles` existe y queda VACÍA por decisión
  // (EJECUCION § 3), así que el rol privado de esta prueba se crea y se borra acá.
  const orgAlfa = await idDe('organizaciones', 'slug', 'alfa');
  const usuarioBeta = await idDe('usuarios', 'email', 'bruno@beta.ejemplo');
  const usuarioAlfa = await idDe('usuarios', 'email', 'ana@alfa.ejemplo');

  const rol = await unaFila<{ id: string }>(
    su,
    `insert into identidad.roles (clave, nombre, org_id) values ('supervisor_prueba', 'Supervisor', $1)
       returning id`,
    [orgAlfa],
  );
  assert.ok(rol?.id);

  try {
    // Cruzado: rol de alfa a usuario de beta.
    await assert.rejects(
      () =>
        su.query('insert into identidad.usuarios_roles (usuario_id, rol_id) values ($1, $2)', [
          usuarioBeta,
          rol.id,
        ]),
      /pertenece a otra organización/i,
    );

    // Y el caso legítimo SÍ funciona, para que la afirmación de arriba no pase por el
    // motivo equivocado.
    const ok = await su.query(
      'insert into identidad.usuarios_roles (usuario_id, rol_id) values ($1, $2)',
      [usuarioAlfa, rol.id],
    );
    assert.equal(ok.rowCount, 1, 'asignar un rol privado a un usuario de SU organización tiene que funcionar');
  } finally {
    await su.query('delete from identidad.usuarios_roles where rol_id = $1', [rol.id]);
    await su.query('delete from identidad.roles where id = $1', [rol.id]);
  }
});

test('ADR-0104 · RETIRADA · un rol de plataforma YA puede nacer sin exigir segundo factor', async () => {
  // Esta invariante se retiró, y la prueba se da vuelta en vez de borrarse.
  //
  // Decía —y sigue siendo cierto como afirmación de riesgo— que el rol de plataforma ve los
  // datos de TODAS las organizaciones, y que una contraseña filtrada sin segundo factor es una
  // brecha de todos los clientes a la vez. La migración 010 quita
  // `roles_plataforma_exige_2fo` a pedido explícito de quien decide el producto.
  //
  // Se prueba acá con el SUPERUSUARIO, y eso es lo que esta prueba aporta sobre las cuatro de
  // `41-catalogo-de-autenticacion.test.ts`: el resto del archivo verifica invariantes que
  // aguantan *"una sentencia a mano un domingo"*. Que ésta ya no aguante nada es exactamente el
  // hecho que hay que dejar afirmado — si alguien repone la restricción, esto falla y le cuenta
  // que está volviendo atrás una decisión deliberada.
  //
  // En su PROPIA transacción, que se revierte. Este archivo no envuelve las pruebas por
  // omisión —casi todas esperan un rechazo, así que nada queda— y la primera versión de esta
  // prueba, que ahora espera ÉXITO, dejó el rol sembrado: la corrida siguiente falló con
  // `roles_clave_unica` y el diagnóstico dejó de hablar del segundo factor. Invertir una
  // prueba de rechazo a una de éxito cambia quién tiene que limpiar.
  await su.query('begin');
  let error: string | null = null;
  try {
    await su.query(
      `insert into identidad.roles (clave, nombre, solo_principal, exige_segundo_factor)
       values ('plataforma_sin_2fo', 'Sin segundo factor', true, false)`,
    );
  } catch (e) {
    error = String((e as Error).message);
  } finally {
    await su.query('rollback');
  }
  assert.equal(
    error,
    null,
    `la base todavía impide un rol de plataforma sin segundo factor: ¿volvió la restricción? ${error}`,
  );
});

// ─── ADR-0105 · la auditoría es inmutable ───────────────────────────────────

test('ADR-0105 · la auditoría no se puede MODIFICAR ni BORRAR', async () => {
  const fila = await unaFila<{ id: string }>(
    su,
    `insert into identidad.auditoria_accesos (accion, detalle) values ('prueba_inmutable', '{}'::jsonb)
       returning id`,
  );
  assert.ok(fila?.id);

  await assert.rejects(
    () => su.query(`update identidad.auditoria_accesos set accion = 'pisado' where id = $1`, [fila.id]),
    /solo inserción/i,
  );
  await assert.rejects(
    () => su.query('delete from identidad.auditoria_accesos where id = $1', [fila.id]),
    /solo inserción/i,
  );

  // Y sigue ahí. "Corregir un error se hace con una fila nueva, como en un libro
  // contable." Consecuencia aceptada: la fila de prueba es permanente, igual que
  // cualquier registro escrito por error (10 § 7, riesgo residual 5).
  const sigue = await unaFila<{ n: number }>(
    su,
    'select count(*)::int as n from identidad.auditoria_accesos where id = $1',
    [fila.id],
  );
  assert.equal(sigue?.n, 1);
});

// ─── ADR-0106 · las referencias no cruzan organizaciones ────────────────────

test('ADR-0106 · una referencia dentro del inquilino no puede apuntar a otra organización', async () => {
  // Ocurrió de verdad: "una función firmaba registros con el identificador de una
  // persona de OTRA organización, y nunca falló nada, porque la clave foránea apuntaba
  // solo al `id`" (01 § 8).
  //
  // La foránea de `organizaciones_credenciales` apunta al PAR `(org_id, id)`, así que
  // el error no compila en la base.
  const orgAlfa = await idDe('organizaciones', 'slug', 'alfa');
  const usuarioBeta = await idDe('usuarios', 'email', 'bruno@beta.ejemplo');
  const usuarioAlfa = await idDe('usuarios', 'email', 'ana@alfa.ejemplo');

  try {
    await assert.rejects(
      () =>
        su.query(
          `insert into identidad.organizaciones_credenciales (org_id, actualizado_por)
           values ($1, $2)`,
          [orgAlfa, usuarioBeta],
        ),
      /foreign key|violates foreign key constraint/i,
      'firmar la fila de alfa con un usuario de beta tendría que fallar',
    );

    // Y el caso legítimo funciona.
    const ok = await su.query(
      `insert into identidad.organizaciones_credenciales (org_id, actualizado_por)
       values ($1, $2)`,
      [orgAlfa, usuarioAlfa],
    );
    assert.equal(ok.rowCount, 1);
  } finally {
    await su.query('delete from identidad.organizaciones_credenciales where org_id = $1', [orgAlfa]);
  }
});

// ─── La segunda capa: el permiso, además del disparador ─────────────────────

test('ningún rol de aplicación puede BORRAR usuarios ni MUTAR la auditoría', async () => {
  // "La inmutabilidad va en el permiso además del disparador: dos capas, como todo lo
  // demás" (09 § 2). Los disparadores de arriba son la primera; ésta es la segunda, y
  // es la que hace que la operación no llegue nunca a intentarse desde la aplicación.
  const prohibidos: Array<[string, string, string]> = [
    // `app_identidad` sigue SIN poder borrar usuarios, y es la mitad que no se movió en la Etapa
    // 12. La otra mitad —`app_inquilino` SÍ puede— se comprueba en la prueba de abajo, que exige
    // además la política que la acota. Ver la migración 012.
    ['app_identidad', 'identidad.usuarios', 'DELETE'],
    ['app_identidad', 'identidad.auditoria_accesos', 'UPDATE'],
    ['app_identidad', 'identidad.auditoria_accesos', 'DELETE'],
    ['app_inquilino', 'identidad.auditoria_accesos', 'UPDATE'],
    ['app_inquilino', 'identidad.auditoria_accesos', 'DELETE'],
    // Y el inquilino no toca las tablas del dominio de identidad puro.
    ['app_inquilino', 'identidad.sesiones', 'SELECT'],
    ['app_inquilino', 'identidad.usuarios_roles', 'SELECT'],
    ['app_inquilino', 'identidad.roles_permisos', 'SELECT'],
    ['app_inquilino', 'identidad.permisos', 'SELECT'],
    ['app_inquilino', 'identidad.usuarios_segundo_factor', 'SELECT'],
    ['app_inquilino', 'identidad.organizaciones_credenciales', 'SELECT'],
  ];

  for (const [rol, tabla, privilegio] of prohibidos) {
    const f = await unaFila<{ tiene: boolean }>(
      su,
      'select has_table_privilege($1, $2, $3) as tiene',
      [rol, tabla, privilegio],
    );
    assert.equal(f?.tiene, false, `${rol} NO tendría que tener ${privilegio} sobre ${tabla}`);
  }
});

test('borrar un usuario lo puede el INQUILINO, y solo con la política que lo acota', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // ESTA PRUEBA REEMPLAZA A UNA MÁS SIMPLE, Y ES MÁS FUERTE QUE ELLA
  //
  // Hasta la Etapa 12 la invariante era *"ningún rol de aplicación puede BORRAR usuarios"*, y se
  // cumplía porque no había ninguna operación de borrado. Cuando se pidió una, esa invariante ya
  // no describía lo que había que proteger: **el peligro nunca fue borrar, fue borrar a alguien de
  // OTRA empresa.**
  //
  // Así que se afirma eso, en dos mitades que tienen que valer las dos:
  //
  //   1 · el privilegio existe SOLO en el rol cuya política filtra por organización, y
  //   2 · esa política existe.
  //
  // La segunda no es un adorno. Con `force row level security` y el privilegio puesto pero sin
  // política de `delete`, el borrado **no toca ninguna fila y no da error**: responde 404 siempre,
  // y el síntoma sería «el botón no hace nada». Y al revés, si alguien reescribiera la política sin
  // el `org_id`, el privilegio quedaría sin acotar y nada fallaría.
  // ═══════════════════════════════════════════════════════════════════════════
  const puede = await unaFila<{ tiene: boolean }>(
    su,
    `select has_table_privilege('app_inquilino', 'identidad.usuarios', 'DELETE') as tiene`,
  );
  assert.equal(puede?.tiene, true, 'el inquilino no puede borrar usuarios: la operación no existe');

  const politica = await unaFila<{ expresion: string | null }>(
    su,
    `select pg_get_expr(pol.polqual, pol.polrelid) as expresion
       from pg_policy pol
       join pg_class c on c.oid = pol.polrelid
      where c.relname = 'usuarios'
        and c.relnamespace = 'identidad'::regnamespace
        and pol.polcmd = 'd'
        and 'app_inquilino' = any (
          select r.rolname from pg_roles r where r.oid = any (pol.polroles))`,
  );
  assert.ok(politica, 'no hay política de `delete` para el inquilino: el borrado no tocaría nada');
  assert.match(
    String(politica.expresion),
    /org_id/,
    'la política de borrado no menciona `org_id`: el privilegio quedó sin acotar por organización',
  );
});
