// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0302 — El permiso se pregunta por capacidad, nunca por nombre de rol.
// ADR-0306 — Toda petición que modifica verifica el origen.
// Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL PORTERO CONTRA LA BASE, CON SESIONES DE VERDAD
//
// `pruebas/codigo/30-portero.test.ts` verifica que toda operación LLAME al portero. Eso es
// análisis estático y no dice nada sobre si el portero DECIDE BIEN.
//
// Acá se arman peticiones a mano, se siembran sesiones en los cuatro estados, y se comprueba
// cada rechazo por separado. Lo que importa no es que rechace: es que rechace con **el código
// correcto**. El 03 § 5 y el 09 § 5 lo dicen dos veces, en dos documentos: los cinco 403 son
// cosas distintas, y colapsarlos hace que *"el usuario nunca sepa que le falta un paso"*.
//
// El login es de la Etapa 4, así que las sesiones se insertan directo. Eso es legítimo y
// además conveniente: permite construir estados que el login todavía no sabe producir.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import { conIdentidad, cerrarClientes } from '../../lib/datos/capa.ts';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { exigir, NINGUNA, sesionOpcional } from '../../lib/autorizacion/portero.ts';
import { COOKIE_SESION, hashDeToken, type EstadoSesion } from '../../lib/autorizacion/sesion.ts';

const DOMINIO = 'ejemplo.test';

before(() => {
  // El portero rechaza toda petición que modifica si no está configurado, así que la prueba
  // del origen necesita un valor. Se pone acá y no en el entorno del proyecto: es un dato de
  // esta prueba.
  process.env.DOMINIO_ESPERADO = DOMINIO;
});

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

interface Usuarios {
  fundadora: { id: string; org: string };
  ana: { id: string; org: string };
  bruno: { id: string; org: string };
  orgBeta: string;
}

async function usuarios(): Promise<Usuarios> {
  return conIdentidad(async (db) => {
    const filas = await db
      .selectFrom('usuarios as u')
      .innerJoin('organizaciones as o', 'o.id', 'u.org_id')
      .select(['u.id', 'u.org_id', 'o.slug'])
      .execute();
    const de = (slug: string) => {
      const f = filas.find((x) => x.slug === slug);
      assert.ok(f, `falta el usuario de ${slug}: ¿corrió el sembrado?`);
      return { id: f.id, org: f.org_id };
    };
    const beta = filas.find((x) => x.slug === 'beta');
    assert.ok(beta);
    return {
      fundadora: de('principal'),
      ana: de('alfa'),
      bruno: de('beta'),
      orgBeta: beta.org_id,
    };
  });
}

/** Siembra una sesión y devuelve su token en claro. */
async function sesionNueva(opciones: {
  usuarioId: string;
  estado?: EstadoSesion;
  orgActiva?: string | null;
  expiraEl?: string;
  expiraAbsoluto?: string;
}): Promise<{ token: string; id: string }> {
  const token = randomBytes(32).toString('base64url');
  const id = await conIdentidad(async (db) => {
    const f = await db
      .insertInto('sesiones')
      .values({
        usuario_id: opciones.usuarioId,
        token_hash: hashDeToken(token),
        estado: opciones.estado ?? 'activa',
        org_activa: opciones.orgActiva ?? null,
        expira_el: sql<Date>`now() + interval ${sql.lit(opciones.expiraEl ?? '7 days')}`,
        expira_absoluto: sql<Date>`now() + interval ${sql.lit(opciones.expiraAbsoluto ?? '30 days')}`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return f.id;
  });
  return { token, id };
}

async function borrarSesion(id: string): Promise<void> {
  await conIdentidad(async (db) => {
    await db.deleteFrom('sesiones').where('id', '=', id).execute();
  });
}

/** Una petición armada a mano. El portero es una función de `Request` a `Response`. */
function peticion(
  metodo: string,
  camino: string,
  opciones: { token?: string; origen?: string | null } = {},
): Request {
  const cabeceras = new Headers();
  if (opciones.token) {
    cabeceras.set('cookie', `${COOKIE_SESION}=${encodeURIComponent(opciones.token)}`);
  }
  if (opciones.origen !== null && opciones.origen !== undefined) {
    cabeceras.set('origin', opciones.origen);
  }
  return new Request(`https://${DOMINIO}${camino}`, { method: metodo, headers: cabeceras });
}

/** El código de rechazo de una respuesta, o `null` si pasó. */
async function codigoDe(r: unknown): Promise<{ estado: number; codigo: string } | null> {
  if (!(r instanceof Response)) return null;
  const cuerpo = (await r.json()) as { codigo?: string };
  return { estado: r.status, codigo: cuerpo.codigo ?? 'sin_codigo' };
}

// ─── Paso 1 · ¿hay sesión? ──────────────────────────────────────────────────

test('ADR-0301 · sin cookie: 401 sin_sesion', async () => {
  const r = await exigir(peticion('GET', '/api/usuarios'), ['usuarios.ver']);
  assert.deepEqual(await codigoDe(r), { estado: 401, codigo: 'sin_sesion' });
});

test('ADR-0301 · con un token inventado: 401 sin_sesion', async () => {
  const r = await exigir(peticion('GET', '/api/usuarios', { token: 'no-existe' }), [
    'usuarios.ver',
  ]);
  assert.deepEqual(await codigoDe(r), { estado: 401, codigo: 'sin_sesion' });
});

test('ADR-0301 · una sesión con `expira_el` pasado: 401', async () => {
  const u = await usuarios();
  const s = await sesionNueva({ usuarioId: u.ana.id, expiraEl: '-1 hour' });
  try {
    const r = await exigir(peticion('GET', '/api/usuarios', { token: s.token }), ['usuarios.ver']);
    assert.deepEqual(await codigoDe(r), { estado: 401, codigo: 'sin_sesion' });
  } finally {
    await borrarSesion(s.id);
  }
});

test('ADR-0301 · el TECHO ABSOLUTO: `expira_el` futuro y `expira_absoluto` pasado → 401', async () => {
  // Es el olvido más silencioso de esta pieza: sin `and expira_absoluto > now()` en la
  // consulta, todo funciona, todas las pruebas de login pasan, y una sesión usada a diario
  // NUNCA VENCE — *"un token robado vive para siempre mientras el ladrón lo siga usando"*
  // (08 § 5.1).
  const u = await usuarios();
  const s = await sesionNueva({
    usuarioId: u.ana.id,
    expiraEl: '7 days',
    expiraAbsoluto: '-1 hour',
  });
  try {
    const r = await exigir(peticion('GET', '/api/usuarios', { token: s.token }), ['usuarios.ver']);
    assert.deepEqual(await codigoDe(r), { estado: 401, codigo: 'sin_sesion' });
  } finally {
    await borrarSesion(s.id);
  }
});

test('ADR-0301 · un usuario desactivado no tiene sesión, aunque la fila exista', async () => {
  // Defensa en profundidad que la especificación no pide: el 05 § 6 dice que al desactivar un
  // usuario se cierran sus sesiones, o sea que la defensa es una ESCRITURA en otra operación.
  // Si esa escritura falla o se olvida, el usuario desactivado sigue trabajando hasta que la
  // sesión venza, y nada avisa.
  const u = await usuarios();
  const s = await sesionNueva({ usuarioId: u.ana.id });
  try {
    await conIdentidad(async (db) => {
      await db.updateTable('usuarios').set({ activo: false }).where('id', '=', u.ana.id).execute();
    });
    const r = await exigir(peticion('GET', '/api/usuarios', { token: s.token }), ['usuarios.ver']);
    assert.deepEqual(await codigoDe(r), { estado: 401, codigo: 'sin_sesion' });
  } finally {
    await conIdentidad(async (db) => {
      await db.updateTable('usuarios').set({ activo: true }).where('id', '=', u.ana.id).execute();
    });
    await borrarSesion(s.id);
  }
});

// ─── Paso 2 · el estado de la sesión ────────────────────────────────────────

test('ADR-0301 · cada estado restringido devuelve SU código, no `sin_permiso`', async () => {
  // La afirmación central de esta prueba. Los dos son 403 y son cosas distintas: el de permiso
  // *"se muestra muchas veces como 'no hay datos'"*, así que si se confunden, quien está en
  // `debe_cambiar_password` lee que no tiene permiso y no va a buscar la salida — que es justo
  // cambiar la contraseña.
  const u = await usuarios();
  const estados: EstadoSesion[] = [
    'pendiente_2fo',
    'debe_cambiar_password',
    'debe_configurar_2fo',
  ];
  for (const estado of estados) {
    const s = await sesionNueva({ usuarioId: u.fundadora.id, estado });
    try {
      const r = await exigir(peticion('GET', '/api/usuarios', { token: s.token }), [
        'usuarios.ver',
      ]);
      assert.deepEqual(
        await codigoDe(r),
        { estado: 403, codigo: estado },
        `el estado ${estado} tiene que devolver su propio código`,
      );
    } finally {
      await borrarSesion(s.id);
    }
  }
});

test('ADR-0301 · una sesión ACTIVA sí llega al paso de capacidades', async () => {
  // La guarda de la de arriba: sin ésta, un portero que rechazara SIEMPRE en el paso 2 pasaría
  // los tres casos anteriores.
  const u = await usuarios();
  const s = await sesionNueva({ usuarioId: u.ana.id });
  try {
    const r = await exigir(peticion('GET', '/api/usuarios', { token: s.token }), ['usuarios.ver']);
    assert.equal(await codigoDe(r), null, 'una sesión activa con la capacidad tiene que pasar');
  } finally {
    await borrarSesion(s.id);
  }
});

// ─── Paso 3 · la organización ───────────────────────────────────────────────

test('ADR-0301 · organización inactiva: 403 organizacion_inactiva', async () => {
  const u = await usuarios();
  const s = await sesionNueva({ usuarioId: u.ana.id });
  try {
    await conIdentidad(async (db) => {
      await db.updateTable('organizaciones').set({ activa: false }).where('id', '=', u.ana.org).execute();
    });
    const r = await exigir(peticion('GET', '/api/usuarios', { token: s.token }), ['usuarios.ver']);
    assert.deepEqual(await codigoDe(r), { estado: 403, codigo: 'organizacion_inactiva' });
  } finally {
    await conIdentidad(async (db) => {
      await db.updateTable('organizaciones').set({ activa: true }).where('id', '=', u.ana.org).execute();
    });
    await borrarSesion(s.id);
  }
});

// ─── Paso 5 · las capacidades ───────────────────────────────────────────────

test('ADR-0302 · sin la capacidad: 403 sin_permiso', async () => {
  const u = await usuarios();
  // Ana es `administrador`, que tiene todo MENOS `organizaciones.*`.
  const s = await sesionNueva({ usuarioId: u.ana.id });
  try {
    const r = await exigir(peticion('GET', '/api/usuarios', { token: s.token }), [
      'organizaciones.crear',
    ]);
    assert.deepEqual(await codigoDe(r), { estado: 403, codigo: 'sin_permiso' });
  } finally {
    await borrarSesion(s.id);
  }
});

test('ADR-0302 · `NINGUNA` deja pasar a cualquiera con sesión activa', async () => {
  const u = await usuarios();
  const s = await sesionNueva({ usuarioId: u.ana.id });
  try {
    const r = await exigir(peticion('GET', '/api/control', { token: s.token }), NINGUNA);
    assert.equal(await codigoDe(r), null);
  } finally {
    await borrarSesion(s.id);
  }
});

test('ADR-0302 · los permisos se leen EN LA PETICIÓN, no se cachean', async () => {
  // El 03 § 4: *"si a alguien le quitan un permiso, seguiría teniéndolo hasta que su sesión
  // venza"*. Con sesiones de siete días eso es una semana — y como el permiso quitado ya no se
  // usa, nadie reporta nada.
  const u = await usuarios();
  const s = await sesionNueva({ usuarioId: u.ana.id });
  try {
    const antes = await exigir(peticion('GET', '/api/usuarios', { token: s.token }), [
      'usuarios.ver',
    ]);
    assert.equal(await codigoDe(antes), null, 'tendría que pasar antes de quitarle el rol');

    // Se le quita el rol y se vuelve a preguntar con LA MISMA sesión.
    const asignaciones = await conIdentidad(async (db) => {
      const filas = await db
        .selectFrom('usuarios_roles')
        .select(['rol_id'])
        .where('usuario_id', '=', u.ana.id)
        .execute();
      await db.deleteFrom('usuarios_roles').where('usuario_id', '=', u.ana.id).execute();
      return filas;
    });

    const despues = await exigir(peticion('GET', '/api/usuarios', { token: s.token }), [
      'usuarios.ver',
    ]);
    assert.deepEqual(
      await codigoDe(despues),
      { estado: 403, codigo: 'sin_permiso' },
      'el permiso quitado siguió valiendo: los permisos están cacheados en algún lado',
    );

    await conIdentidad(async (db) => {
      for (const a of asignaciones) {
        await db.insertInto('usuarios_roles').values({ usuario_id: u.ana.id, rol_id: a.rol_id }).execute();
      }
    });
  } finally {
    await borrarSesion(s.id);
  }
});

// ─── orgEfectiva · la barrera del 04 § 8 ────────────────────────────────────

test('ADR-0206 · `org_activa` de un usuario COMÚN se ignora — es la fuga entre inquilinos', async () => {
  // LA PRUEBA MÁS IMPORTANTE DE ESTE ARCHIVO.
  //
  // El 04 § 8 escribe la fórmula al revés a propósito: *"si alguien escribiera esa columna por
  // otra vía —un script, un bug, una migración— UN USUARIO COMÚN SEGUIRÍA TRABAJANDO EN SU
  // PROPIA ORGANIZACIÓN: el valor está ahí y el código no lo mira"*.
  //
  // Calcular `orgEfectiva` sin exigir `esRolDePlataforma` no lanza: la consulta anda, devuelve
  // filas, y son de otro cliente.
  const u = await usuarios();
  // Ana es `administrador` —NO tiene rol `solo_principal`— y se le pone la organización de
  // beta como activa.
  const s = await sesionNueva({ usuarioId: u.ana.id, orgActiva: u.orgBeta });
  try {
    const ctx = await exigir(peticion('GET', '/api/usuarios', { token: s.token }), ['usuarios.ver']);
    assert.ok(!(ctx instanceof Response), 'tendría que pasar el portero');
    assert.equal(ctx.esRolDePlataforma, false, 'ana no es rol de plataforma');
    assert.equal(
      ctx.orgEfectiva,
      u.ana.org,
      'un usuario común con org_activa puesta terminó trabajando en OTRA organización',
    );
    assert.notEqual(ctx.orgEfectiva, u.orgBeta);
    assert.equal(ctx.mirandoOtraOrganizacion, false);
  } finally {
    await borrarSesion(s.id);
  }
});

test('ADR-0206 · `org_activa` del rol de plataforma SÍ se respeta', async () => {
  // La otra mitad: sin ésta, la de arriba pasaría con un `orgEfectiva` que siempre es
  // `orgPropia`, o sea con el cambio de organización roto del todo.
  const u = await usuarios();
  const s = await sesionNueva({ usuarioId: u.fundadora.id, orgActiva: u.orgBeta });
  try {
    const ctx = await exigir(peticion('GET', '/api/usuarios', { token: s.token }), ['usuarios.ver']);
    assert.ok(!(ctx instanceof Response), 'tendría que pasar el portero');
    assert.equal(ctx.esRolDePlataforma, true, 'la fundadora tiene el rol `solo_principal`');
    assert.equal(ctx.orgEfectiva, u.orgBeta);
    assert.equal(ctx.mirandoOtraOrganizacion, true, 'el cartel permanente depende de esto');
    assert.equal(ctx.organizacion.id, u.orgBeta);
  } finally {
    await borrarSesion(s.id);
  }
});

// ─── ADR-0306 · el origen ───────────────────────────────────────────────────

test('ADR-0306 · una petición que modifica sin `Origin` se rechaza', async () => {
  const u = await usuarios();
  const s = await sesionNueva({ usuarioId: u.fundadora.id });
  try {
    const r = await exigir(peticion('PATCH', '/api/auth/sesion', { token: s.token, origen: null }), [
      'organizaciones.listar',
    ]);
    assert.deepEqual(await codigoDe(r), { estado: 403, codigo: 'origen_no_permitido' });
  } finally {
    await borrarSesion(s.id);
  }
});

test('ADR-0306 · con un `Origin` ajeno se rechaza, y con el propio pasa', async () => {
  const u = await usuarios();
  const s = await sesionNueva({ usuarioId: u.fundadora.id });
  try {
    const ajeno = await exigir(
      peticion('PATCH', '/api/auth/sesion', { token: s.token, origen: 'https://malo.test' }),
      ['organizaciones.listar'],
    );
    assert.deepEqual(await codigoDe(ajeno), { estado: 403, codigo: 'origen_no_permitido' });

    const propio = await exigir(
      peticion('PATCH', '/api/auth/sesion', { token: s.token, origen: `https://${DOMINIO}` }),
      ['organizaciones.listar'],
    );
    assert.equal(await codigoDe(propio), null, 'con el origen propio tendría que pasar');
  } finally {
    await borrarSesion(s.id);
  }
});

test('ADR-0306 · una lectura NO necesita `Origin`', async () => {
  // El 08 § 5.3 exime `GET`, `HEAD` y `OPTIONS`. Exigirlo en las lecturas rompería toda
  // navegación directa sin comprar nada.
  const u = await usuarios();
  const s = await sesionNueva({ usuarioId: u.ana.id });
  try {
    const r = await exigir(peticion('GET', '/api/usuarios', { token: s.token, origen: null }), [
      'usuarios.ver',
    ]);
    assert.equal(await codigoDe(r), null);
  } finally {
    await borrarSesion(s.id);
  }
});

// ─── El paso 0 · las dos rutas con contrato propio ──────────────────────────

test('ADR-0301 · llamar al portero con una ruta de `sesionOpcional` LANZA', async () => {
  // No es un rechazo: es un error de programación. Mezclar los dos contratos es lo que produce
  // los defectos silenciosos que el paso 0 del 03 § 5 existe para evitar.
  await assert.rejects(
    () => exigir(peticion('GET', '/api/auth/sesion'), NINGUNA),
    /usa sesionOpcional\(\), no el portero/,
  );
  await assert.rejects(
    () => exigir(peticion('DELETE', '/api/auth/sesion'), NINGUNA),
    /usa sesionOpcional\(\), no el portero/,
  );
});

test('ADR-0301 · `sesionOpcional` devuelve nulo sin responder, y el contexto cuando hay', async () => {
  assert.equal(await sesionOpcional(peticion('GET', '/api/auth/sesion')), null);

  const u = await usuarios();
  const s = await sesionNueva({ usuarioId: u.bruno.id, estado: 'pendiente_2fo' });
  try {
    const ctx = await sesionOpcional(peticion('GET', '/api/auth/sesion', { token: s.token }));
    assert.ok(ctx, 'tendría que resolver la sesión');
    // Y devuelve el estado incluso en un estado restringido: sin eso el frontend no sabe qué
    // pantalla mostrar y no puede salir del estado.
    assert.equal(ctx.estado, 'pendiente_2fo');
  } finally {
    await borrarSesion(s.id);
  }
});

// ─── La ventana deslizante ──────────────────────────────────────────────────

test('la renovación NO toca `expira_absoluto`, y no corre si el estado no es `activa`', async () => {
  const u = await usuarios();

  // (a) Una sesión activa a punto de vencer SÍ se renueva, y el techo no se mueve.
  const activa = await sesionNueva({ usuarioId: u.ana.id, expiraEl: '2 hours' });
  try {
    const antes = await plazos(activa.id);
    await exigir(peticion('GET', '/api/usuarios', { token: activa.token }), ['usuarios.ver']);
    const despues = await plazos(activa.id);
    assert.ok(
      despues.expira_el > antes.expira_el,
      'una sesión a punto de vencer tendría que renovarse',
    );
    assert.equal(
      despues.expira_absoluto.getTime(),
      antes.expira_absoluto.getTime(),
      'la renovación movió el techo absoluto: la sesión se volvió eterna',
    );
  } finally {
    await borrarSesion(activa.id);
  }

  // (b) Una sesión en estado restringido NO se renueva. Sin esta condición, la primera
  // petición a `POST /auth/2fo/verificar` extiende a siete días una sesión cuya identidad
  // todavía no se probó.
  const pendiente = await sesionNueva({
    usuarioId: u.ana.id,
    estado: 'pendiente_2fo',
    expiraEl: '2 hours',
  });
  try {
    const antes = await plazos(pendiente.id);
    await sesionOpcional(peticion('GET', '/api/auth/sesion', { token: pendiente.token }));
    const despues = await plazos(pendiente.id);
    assert.equal(
      despues.expira_el.getTime(),
      antes.expira_el.getTime(),
      'una sesión sin identidad probada se renovó',
    );
  } finally {
    await borrarSesion(pendiente.id);
  }

  // (c) Una sesión con plazo lejano NO se renueva: renovar en cada petición convierte la
  // ventana deslizante en decoración y agrega una escritura por petición contra la tabla más
  // consultada del sistema.
  const lejana = await sesionNueva({ usuarioId: u.ana.id, expiraEl: '6 days' });
  try {
    const antes = await plazos(lejana.id);
    await exigir(peticion('GET', '/api/usuarios', { token: lejana.token }), ['usuarios.ver']);
    const despues = await plazos(lejana.id);
    assert.equal(
      despues.expira_el.getTime(),
      antes.expira_el.getTime(),
      'se renovó una sesión que no hacía falta renovar',
    );
  } finally {
    await borrarSesion(lejana.id);
  }
});

async function plazos(id: string): Promise<{ expira_el: Date; expira_absoluto: Date }> {
  return conIdentidad(async (db) =>
    db
      .selectFrom('sesiones')
      .select(['expira_el', 'expira_absoluto'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow(),
  );
}
