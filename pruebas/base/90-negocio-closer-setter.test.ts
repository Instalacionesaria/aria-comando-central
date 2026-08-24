// El esquema de negocio de las pestañas Closer y Setter. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS TRES COSAS QUE ESTE ARCHIVO PRUEBA, Y POR QUÉ NINGUNA ES OPCIONAL
//
// 1 · **El aislamiento entre organizaciones sobre datos de cliente.** Es la prueba de
//     aceptación 6 del `11`, y su propia nota dice por qué está ahí:
//
//       "No es de estas pantallas: es del sistema entero. Va acá porque ESTAS SON LAS
//        PRIMERAS PANTALLAS CON DATOS REALES DE CLIENTES, y son las primeras donde el
//        defecto tendría consecuencias. Con una sola organización en desarrollo ese
//        defecto no se manifiesta nunca."
//
//     `pruebas/base/30-aislamiento.test.ts` ya prueba esto sobre `control_aislamiento`,
//     que existe para eso. Acá se prueba sobre `contactos` —la tabla con nombres y
//     teléfonos— y sobre una tabla HIJA, que es el caso que `control_aislamiento` no
//     puede cubrir porque no tiene hijas.
//
// 2 · **Los dos disparadores.** Protegen cosas que un `update` pisa SIN FALLAR. Un
//     disparador sin prueba es una intención, no una garantía.
//
// 3 · **Que las claves foráneas compuestas cierren de verdad.** `aplicar_aislamiento()`
//     verifica que la FORMA sea correcta —que el par `(org_id, id)` esté en la
//     declaración— pero no que la base rechace una fila cruzada. Es la diferencia entre
//     "está declarado" y "no se puede hacer".
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { conectar, cerrarTodo, unaFila, filas } from '../apoyo/conexiones.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { conIdentidad, cerrarClientes } from '../../lib/datos/capa.ts';

let admin: Client;
let alfa: string;
let beta: string;

before(async () => {
  admin = await conectar('admin');
  // Las dos organizaciones CLIENTE del sembrado. Se usan éstas y no la principal porque
  // el usuario de la principal es el superadministrador con organización conmutable — el
  // peor fixture posible para la prueba más importante del archivo.
  const orgs = await filas<{ id: string; slug: string }>(
    admin,
    `select id, slug from identidad.organizaciones where slug in ('alfa','beta') order by slug`,
  );
  assert.equal(orgs.length, 2, 'hacen falta las dos organizaciones cliente del sembrado');
  alfa = orgs[0]!.id;
  beta = orgs[1]!.id;
});

after(async () => {
  // Se borra por el camino del inquilino, no con el superusuario: si el borrado necesitara
  // el propietario, sería una pista de que los permisos están mal.
  for (const org of [alfa, beta]) {
    await conOrganizacion(org, async () => {
      await datos().deleteFrom('contactos').execute();
    });
  }
  await cerrarTodo();
  await cerrarClientes();
});

/** Un contacto de prueba en la organización dada, por el camino real. */
async function contactoEn(org: string, ghlId: string): Promise<string> {
  return conOrganizacion(org, async () => {
    const c = await datos()
      .insertInto('contactos')
      // `org_id` NO se escribe: lo inyecta la capa fina. Si el código de negocio tuviera
      // que acordarse de ponerlo, volveríamos a "acordate de filtrar".
      .values({ ghl_contact_id: ghlId, nombre: 'Contacto de prueba' })
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.id;
  });
}

// ─── 1 · El aislamiento, sobre datos de cliente ─────────────────────────────

test('ADR-0206 · con la organización A no se ve NI UN contacto de la B', async () => {
  const enAlfa = await contactoEn(alfa, `alfa-${randomUUID()}`);
  const enBeta = await contactoEn(beta, `beta-${randomUUID()}`);

  const desdeAlfa = await conOrganizacion(alfa, async () =>
    datos().selectFrom('contactos').select(['id', 'org_id']).execute(),
  );

  // LA GUARDA CONTRA EL FALSO VERDE, y acá es la mitad que decide si la prueba sirve: si
  // la consulta no devolviera nada, "no vio los de beta" sería cierto y vacío a la vez.
  assert.ok(desdeAlfa.length > 0, 'alfa no vio ni sus propios contactos: la prueba no probaría nada');
  assert.ok(
    desdeAlfa.some((c) => c.id === enAlfa),
    'alfa no vio el contacto que acaba de crear',
  );
  assert.ok(
    desdeAlfa.every((c) => c.org_id === alfa),
    `alfa vio ${desdeAlfa.filter((c) => c.org_id !== alfa).length} contacto(s) de otra organización`,
  );
  assert.ok(!desdeAlfa.some((c) => c.id === enBeta), 'alfa vio el contacto de beta');
});

test('ADR-0206 · y tampoco a través de una tabla HIJA', async () => {
  // El caso que `control_aislamiento` no puede cubrir: no tiene hijas. Un mensaje lleva
  // `contacto_id`, y si la política de `mensajes` estuviera mal, alfa podría leer la
  // conversación de un contacto de beta sin ver nunca el contacto — que es peor, porque
  // el cuerpo del mensaje es el dato sensible.
  const enBeta = await contactoEn(beta, `beta-hija-${randomUUID()}`);
  await conOrganizacion(beta, async () => {
    await datos()
      .insertInto('mensajes')
      .values({
        ghl_mensaje_id: `m-${randomUUID()}`,
        contacto_id: enBeta,
        direccion: 'entrante',
        autor: 'contacto',
        cuerpo: 'texto de beta',
        enviado_el: new Date(),
      })
      .execute();
  });

  const desdeAlfa = await conOrganizacion(alfa, async () =>
    datos().selectFrom('mensajes').select(['id', 'org_id']).execute(),
  );
  assert.ok(
    desdeAlfa.every((m) => m.org_id === alfa),
    'alfa leyó un mensaje de beta',
  );

  // Y la mitad complementaria: beta SÍ lo ve. Sin ella, una política `using (false)`
  // pasaría la afirmación de arriba y el sistema no serviría para nada.
  const desdeBeta = await conOrganizacion(beta, async () =>
    datos().selectFrom('mensajes').select('id').execute(),
  );
  assert.ok(desdeBeta.length > 0, 'beta no ve su propio mensaje');
});

test('ADR-0206 · una fila NO puede apuntar al contacto de otra organización', async () => {
  // `aplicar_aislamiento()` verifica que la clave foránea esté DECLARADA con el par
  // `(org_id, id)`. Esto verifica que la base lo RECHACE, que es distinto: entre "está
  // declarado" y "no se puede hacer" hay una diferencia que solo se ve intentándolo.
  const enBeta = await contactoEn(beta, `beta-cruzada-${randomUUID()}`);

  let error: string | null = null;
  try {
    await conOrganizacion(alfa, async () => {
      await datos()
        .insertInto('notas')
        // El contacto es de beta; la nota se escribe como alfa. La clave foránea compuesta
        // busca el par (alfa, enBeta), que no existe.
        .values({ contacto_id: enBeta, cuerpo: 'nota cruzada' })
        .execute();
    });
  } catch (e) {
    error = String((e as Error).message);
  }
  assert.ok(error !== null, 'se pudo escribir una nota sobre el contacto de otra organización');
  assert.match(
    error,
    /foreign key|clave (externa|for[áa]nea)/i,
    `rechazado por otro motivo, y eso importa: ${error}`,
  );
});

test('sin contexto de organización, no se ve NI UN contacto', async () => {
  // El modo de fallar seguro de toda la capa. `datos()` lanza fuera de contexto, así que
  // esto se comprueba con una conexión cruda del rol del inquilino: es el único camino que
  // podría dejar una consulta sin la variable puesta.
  const inq = await conectar('inquilino');
  const f = await unaFila<{ n: string }>(inq, 'select count(*)::text as n from negocio.contactos');
  assert.equal(f?.n, '0', 'el inquilino sin contexto vio contactos');
});

// ─── 2 · Los dos disparadores ───────────────────────────────────────────────

test('el sello del setter NO se sobreescribe: el segundo no le roba la atribución al primero', async () => {
  // El `11` § 2 regla 4. Es la ÚNICA excepción a "lo calculado no se guarda", y lo hace
  // cumplir un disparador y no un condicional del código: un `update` que lo pise NO
  // FALLA, y quien pierde la comisión no se entera.
  const usuarios = await filas<{ id: string }>(
    admin,
    `select id from identidad.usuarios where org_id = $1 limit 2`,
    [alfa],
  );
  assert.ok(usuarios.length >= 1, 'hace falta al menos un usuario en alfa');
  const primero = usuarios[0]!.id;
  // El segundo puede no existir en el sembrado: se usa el mismo id con otro valor de
  // control. Lo que se prueba es que NO CAMBIE, y para eso alcanza con intentar cualquier
  // otro valor — incluso uno inválido, porque el disparador corre antes que la foránea.
  const otro = usuarios[1]?.id ?? primero;

  const id = await contactoEn(alfa, `sello-${randomUUID()}`);

  await conOrganizacion(alfa, async () => {
    await datos()
      .updateTable('contactos')
      .set({ sello_setter_id: primero })
      .where('id', '=', id)
      .execute();
  });

  const tras = await conOrganizacion(alfa, async () =>
    datos()
      .selectFrom('contactos')
      .select(['sello_setter_id', 'sello_setter_el'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow(),
  );
  assert.equal(tras.sello_setter_id, primero, 'el sello no se encendió');
  assert.ok(tras.sello_setter_el, 'el sello se encendió sin fecha: la pone la base, no quien escribe');

  // Y ahora el intento de robarlo. No lanza: se conserva el original en silencio, que es
  // lo correcto acá — un alta legítima puede intentar escribirlo sin saber que ya está.
  await conOrganizacion(alfa, async () => {
    await datos()
      .updateTable('contactos')
      .set({ sello_setter_id: otro, sello_setter_el: new Date('2000-01-01') })
      .where('id', '=', id)
      .execute();
  });

  const despues = await conOrganizacion(alfa, async () =>
    datos()
      .selectFrom('contactos')
      .select(['sello_setter_id', 'sello_setter_el'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow(),
  );
  assert.equal(despues.sello_setter_id, primero, 'el segundo setter le robó la atribución al primero');
  assert.deepEqual(
    despues.sello_setter_el,
    tras.sello_setter_el,
    'la fecha del sello cambió: se puede antedatar una comisión',
  );

  // Y APAGARLO tampoco: el `11` dice "no se apaga ni se sobreescribe", y son dos verbos.
  await conOrganizacion(alfa, async () => {
    await datos()
      .updateTable('contactos')
      .set({ sello_setter_id: null, sello_setter_el: null })
      .where('id', '=', id)
      .execute();
  });
  const apagado = await conOrganizacion(alfa, async () =>
    datos()
      .selectFrom('contactos')
      .select('sello_setter_id')
      .where('id', '=', id)
      .executeTakeFirstOrThrow(),
  );
  assert.equal(apagado.sello_setter_id, primero, 'se pudo APAGAR el sello del setter');
});

test('`ultimo_entrante_el` solo AVANZA: nunca retrocede', async () => {
  // Esa marca decide el Buzón. Retroceder puede hacer desaparecer de la cola a alguien que
  // sí escribió — y el síntoma es una cola más corta, que nadie reporta.
  const id = await contactoEn(alfa, `entrante-${randomUUID()}`);
  const reciente = new Date('2026-08-20T10:00:00Z');
  const viejo = new Date('2026-01-01T10:00:00Z');

  await conOrganizacion(alfa, async () => {
    await datos()
      .updateTable('contactos')
      .set({ ultimo_entrante_el: reciente, ultimo_entrante_texto: 'el nuevo' })
      .where('id', '=', id)
      .execute();
  });

  // El intento de retroceder.
  await conOrganizacion(alfa, async () => {
    await datos()
      .updateTable('contactos')
      .set({ ultimo_entrante_el: viejo, ultimo_entrante_texto: 'el viejo' })
      .where('id', '=', id)
      .execute();
  });

  const f = await conOrganizacion(alfa, async () =>
    datos()
      .selectFrom('contactos')
      .select(['ultimo_entrante_el', 'ultimo_entrante_texto'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow(),
  );
  assert.deepEqual(f.ultimo_entrante_el, reciente, 'la marca del último entrante retrocedió');
  // El texto viaja con la fecha: si la fecha no cambió, el texto tampoco puede. Sin esta
  // mitad quedaría la fecha nueva con el texto viejo, y la cola mostraría un mensaje que
  // no corresponde a su hora.
  assert.equal(f.ultimo_entrante_texto, 'el nuevo', 'el texto cambió sin que cambiara la fecha');

  // Y la mitad complementaria: AVANZAR sí se puede, o el disparador sería un candado.
  const masNuevo = new Date('2026-08-21T10:00:00Z');
  await conOrganizacion(alfa, async () => {
    await datos()
      .updateTable('contactos')
      .set({ ultimo_entrante_el: masNuevo, ultimo_entrante_texto: 'el más nuevo' })
      .where('id', '=', id)
      .execute();
  });
  const avanzo = await conOrganizacion(alfa, async () =>
    datos()
      .selectFrom('contactos')
      .select(['ultimo_entrante_el', 'ultimo_entrante_texto'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow(),
  );
  assert.deepEqual(avanzo.ultimo_entrante_el, masNuevo, 'la marca no pudo avanzar');
  assert.equal(avanzo.ultimo_entrante_texto, 'el más nuevo');
});

// ─── 3 · Lo que el esquema NO deja hacer ────────────────────────────────────

test('las columnas que la fuente no tiene admiten nulos, y las que exige no', async () => {
  // Es la decisión del encabezado de la migración 011, afirmada. El `11` § 9 regla 1: un
  // cero medido y un cero no medido no son el mismo hecho — y una columna obligatoria con
  // valor de relleno convierte el segundo en el primero.
  //
  // Si alguien "completa" el esquema poniendo `not null` en `score` o en `responsable_id`,
  // esto falla y le cuenta que la fuente no los tiene.
  const cols = await filas<{ columna: string; obligatoria: boolean }>(
    admin,
    `select a.attname as columna, a.attnotnull as obligatoria
       from pg_attribute a
      where a.attrelid = 'negocio.contactos'::regclass and a.attnum > 0 and not a.attisdropped
      order by a.attname`,
  );
  const mapa = new Map(cols.map((c) => [c.columna, c.obligatoria]));

  for (const c of ['score', 'responsable_id', 'responsable_rol', 'etapa', 'territorio']) {
    assert.equal(mapa.get(c), false, `\`${c}\` es obligatoria, y la fuente no la tiene`);
  }
  // Y las que sí: sin éstas la fila no se puede dibujar.
  for (const c of ['org_id', 'ghl_contact_id', 'nombre', 'fuente', 'etiquetas']) {
    assert.equal(mapa.get(c), true, `\`${c}\` admite nulos, y el 11 § 7.1 la exige`);
  }
});

test('los identificadores de GHL son únicos POR ORGANIZACIÓN, no globales', async () => {
  // Dos organizaciones pueden tener el mismo contacto de GHL — pasa si comparten subcuenta,
  // y también si una migración de datos se corre dos veces. Con un único global, el segundo
  // `insert` devolvería `23505`, y ese error CONFIRMA la existencia de una fila que quien
  // pregunta no puede ver.
  const compartido = `compartido-${randomUUID()}`;
  await contactoEn(alfa, compartido);

  let error: string | null = null;
  try {
    await contactoEn(beta, compartido);
  } catch (e) {
    error = String((e as Error).message);
  }
  assert.equal(error, null, `el identificador de GHL es único global: ${error}`);

  // Y dentro de UNA organización sí es único, o la sincronización duplicaría en cada corrida.
  let dentro: string | null = null;
  try {
    await contactoEn(alfa, compartido);
  } catch (e) {
    dentro = String((e as Error).message);
  }
  assert.ok(dentro !== null, 'se pudo duplicar el mismo contacto de GHL en la misma organización');
});
