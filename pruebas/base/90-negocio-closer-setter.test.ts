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
import { filasDeTerritorio } from '../../lib/negocio/fila.ts';

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

// ─── 4 · La fila y sus seis íconos ──────────────────────────────────────────
//
// Lo que se prueba acá NO es que la consulta corra: es la SEMÁNTICA, que es lo que puede
// mentir sin fallar. Cada una de estas pruebas corresponde a una forma concreta de estar mal
// que deja la pantalla funcionando y mostrando un número equivocado.

/** Un contacto con territorio, que es lo que la fila filtra. */
async function contactoConTerritorio(
  org: string,
  ghlId: string,
  territorio: 'closer' | 'setter' | null,
  extra: Record<string, unknown> = {},
): Promise<string> {
  return conOrganizacion(org, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({ ghl_contact_id: ghlId, nombre: 'C ' + ghlId, territorio, ...extra } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.id;
  });
}

test('el territorio SEPARA las dos pestañas: el contacto de una no aparece en la otra', async () => {
  // ES LA PRUEBA DE LA ETAPA. Lo único que se pidió en voz alta fue *"un closer solo ve su
  // pestaña y por lo tanto solo le aparecerán los contactos que estén en zona closer"*.
  //
  // Y el modo de fallar es silencioso: si alguien saca el `where territorio`, las dos
  // pestañas siguen andando y muestran MÁS filas. Nadie reporta ver más trabajo del que le
  // toca — se reporta ver menos.
  const marca = randomUUID().slice(0, 8);
  const delCloser = await contactoConTerritorio(alfa, 'terr-c-' + marca, 'closer');
  const delSetter = await contactoConTerritorio(alfa, 'terr-s-' + marca, 'setter');
  // Y uno CONGELADO, sin territorio: no es de ninguna de las dos.
  const congelado = await contactoConTerritorio(alfa, 'terr-n-' + marca, null);

  const closer = await conOrganizacion(alfa, () => filasDeTerritorio('closer'));
  const setter = await conOrganizacion(alfa, () => filasDeTerritorio('setter'));

  const idsCloser = closer.filas.map((f) => f.id);
  const idsSetter = setter.filas.map((f) => f.id);

  assert.ok(idsCloser.includes(delCloser), 'el contacto de zona closer no está en la lista del closer');
  assert.ok(!idsCloser.includes(delSetter), 'el closer VE un contacto de zona setter');
  assert.ok(!idsSetter.includes(delCloser), 'el setter VE un contacto de zona closer');
  assert.ok(idsSetter.includes(delSetter), 'el contacto de zona setter no está en la lista del setter');

  // El congelado en NINGUNA. Un `territorio is null` que cayera en una de las dos listas
  // sería trabajo apareciendo en la bandeja de alguien que no lo pidió.
  assert.ok(!idsCloser.includes(congelado), 'un contacto sin territorio apareció en el closer');
  assert.ok(!idsSetter.includes(congelado), 'un contacto sin territorio apareció en el setter');
});

test('el tercer ícono cuenta llamadas CONTESTADAS, no llamadas hechas', async () => {
  // La divergencia que el encabezado de `lib/negocio/fila.ts` nombra. Dos llamadas: una
  // contestada y una que no. El ícono tiene que decir UNO.
  //
  // Sin esta prueba, quitar el `where contestada` da DOS —un número perfectamente
  // plausible— y el closer creería que el agente conectó el doble de veces de las que
  // conectó. Es exactamente el defecto que "sigue funcionando y muestra datos falsos".
  const marca = randomUUID().slice(0, 8);
  const id = await contactoConTerritorio(alfa, 'llam-' + marca, 'closer');

  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('llamadas')
      .values([
        { externa_id: 'ok-' + marca, contacto_id: id, contestada: true, inicio_el: new Date() },
        { externa_id: 'no-' + marca, contacto_id: id, contestada: false, inicio_el: new Date() },
        // Y una tercera SIN hora de inicio, que es el 42% de las llamadas reales de la
        // fuente: una llamada que nunca conectó no tiene inicio. Tampoco fue contestada,
        // así que tampoco cuenta.
        { externa_id: 'nada-' + marca, contacto_id: id, contestada: false, inicio_el: null },
      ] as never)
      .execute();
  });

  const r = await conOrganizacion(alfa, () => filasDeTerritorio('closer'));
  const fila = r.filas.find((f) => f.id === id);
  assert.ok(fila, 'el contacto no volvió en la lista');
  assert.equal(
    fila.iconos.llamadasContestadas,
    1,
    'contó llamadas hechas y no contestadas: el ícono del `11` § 7.2 dice CONTESTADAS',
  );
});

test('las reuniones que YA TUVO no incluyen las futuras ni las sin fecha', async () => {
  const marca = randomUUID().slice(0, 8);
  const id = await contactoConTerritorio(alfa, 'cita-' + marca, 'closer');
  const ayer = new Date(Date.now() - 24 * 3600 * 1000);
  const manana = new Date(Date.now() + 24 * 3600 * 1000);

  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('citas')
      .values([
        { ghl_evento_id: 'pas-' + marca, contacto_id: id, inicio_el: ayer },
        { ghl_evento_id: 'fut-' + marca, contacto_id: id, inicio_el: manana },
      ] as never)
      .execute();
  });

  const r = await conOrganizacion(alfa, () => filasDeTerritorio('closer'));
  const fila = r.filas.find((f) => f.id === id);
  assert.ok(fila);
  // UNA reunión tenida, no dos: la de mañana no ocurrió todavía.
  assert.equal(fila.iconos.reunionesTenidas, 1, 'contó como "ya tuvo" una cita futura');
  // Y el cuarto... perdón, el SEGUNDO ícono sí la ve: hay cita futura.
  assert.equal(fila.iconos.citaFutura, true, 'no detectó la cita futura');
  // Y es un BOOLEANO de verdad, no un 0/1 de otro motor. Si llegara `1`, `=== true` falla
  // en el cliente y el ícono no se dibuja nunca.
  assert.equal(typeof fila.iconos.citaFutura, 'boolean');
});

test('una venta SIN monto cargado da `null`, no cero', async () => {
  // El § 9 regla 1, con la consecuencia dicha por el § 4: *"un `$0` donde nadie cargó
  // montos afirma «no vendiste nada». Es falso, y nadie reporta un panel que simplemente
  // parece vacío."*
  //
  // Y hoy es el caso NORMAL, no un borde: el § 4 dice que ningún contacto tiene monto.
  const marca = randomUUID().slice(0, 8);
  const sinMonto = await contactoConTerritorio(alfa, 'vsm-' + marca, 'closer');
  const conMonto = await contactoConTerritorio(alfa, 'vcm-' + marca, 'closer');

  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('resultados')
      .values([
        { contacto_id: sinMonto, salida: 'venta', rol: 'closer', monto: null },
        { contacto_id: conMonto, salida: 'venta', rol: 'closer', monto: '1500.00' },
      ] as never)
      .execute();
  });

  const r = await conOrganizacion(alfa, () => filasDeTerritorio('closer'));
  const a = r.filas.find((f) => f.id === sinMonto);
  const b = r.filas.find((f) => f.id === conMonto);
  assert.ok(a && b);
  assert.equal(a.iconos.montoVenta, null, 'una venta sin monto devolvió algo en vez de nulo');
  assert.notEqual(a.iconos.montoVenta, '0', 'devolvió un cero donde nadie cargó un monto');
  assert.equal(b.iconos.montoVenta, '1500.00');

  // Y la píldora sale del ÚLTIMO resultado, que en los dos es la venta.
  assert.equal(a.situacion, 'venta');
  assert.equal(b.situacion, 'venta');
});

test('sin ningún resultado registrado la situación es `sin_resultado`, que no es una salida', async () => {
  // "Todavía nadie registró un resultado" y "el resultado fue que no interesa" son dos
  // hechos distintos, y colapsarlos hace que la píldora afirme algo que nadie dijo.
  const marca = randomUUID().slice(0, 8);
  const id = await contactoConTerritorio(alfa, 'sr-' + marca, 'closer');
  const r = await conOrganizacion(alfa, () => filasDeTerritorio('closer'));
  const fila = r.filas.find((f) => f.id === id);
  assert.ok(fila);
  assert.equal(fila.situacion, 'sin_resultado');
});

test('el estado del agente sale de las ETIQUETAS, que es la fuente que apareció', async () => {
  // ── ESTA PRUEBA CAMBIÓ DE SENTIDO, Y ESO ES EL PUNTO ──────────────────────
  //
  // Antes afirmaba que el estado del agente era `null` SIEMPRE, con este comentario:
  //
  //   "El día que alguien conecte una fuente para el estado del bot, esta prueba falla y le
  //    obliga a decidir a la vista. Sin ella, la salida fácil es devolver 'apagado' —que se ve
  //    razonable— y con eso el sexto ícono afirmaría de todos los contactos que su agente está
  //    apagado. Ninguno lo sabe."
  //
  // Ese día llegó: el documento de contrato de la subcuenta mostró que el estado sale de DIEZ
  // etiquetas de la familia `bot_*`, que ya venían en cada contacto y ya se guardaban en la
  // columna `etiquetas`. El dato estaba en la base y la fila no lo miraba.
  //
  // El cable trampa hizo su trabajo: nadie pudo conectar la fuente sin venir acá.
  const marca = randomUUID().slice(0, 8);

  const casos: [string[], string][] = [
    [[], 'sin_agente'],
    [['bot_activado_leadflow'], 'atendiendo_pre_agenda'],
    [['bot_activado_appflow'], 'atendiendo_post_agenda'],
    [['bot_activado'], 'atendiendo'],
    [['bot_apagado_manual'], 'apagado_a_mano'],
    [['bot_desactivado_postcall'], 'ya_paso_la_llamada'],
    [['bot_desactivado_appflow'], 'pausado_por_fallo'],
    [['bot_desactivado_leadflow'], 'pausado_por_fallo'],
    // LEGADO. Ya no se aplica y se sigue leyendo, porque quedaron contactos con él puesto.
    [['bot_pausado_fallo'], 'pausado_por_fallo'],
  ];

  // El identificador lleva el ÍNDICE y no el estado esperado: tres casos distintos esperan
  // `pausado_por_fallo` —son tres etiquetas para el mismo estado— y con el estado en el nombre
  // los tres chocarían contra el único `contactos_ghl_por_org`. Lo atrapó ese índice, que es
  // exactamente para lo que está.
  for (const [i, [etiquetas, esperado]] of casos.entries()) {
    const id = await contactoConTerritorio(alfa, `ag-${i}-${marca}`, 'closer', {
      etiquetas,
    });
    const r = await conOrganizacion(alfa, () => filasDeTerritorio('closer'));
    const fila = r.filas.find((f) => f.id === id);
    assert.ok(fila, `no volvió el contacto de ${esperado}`);
    assert.equal(
      fila.iconos.estadoAgente,
      esperado,
      `con [${etiquetas.join(', ')}] el estado tendría que ser ${esperado}`,
    );
  }
});

test('con etiquetas de agente contradictorias gana el APAGADO', async () => {
  // No es un caso teórico. Medido contra la subcuenta real el 2026-08-24: el contacto
  // «marcelo» tiene `bot_activado_appflow` y `bot_desactivado_postcall` a la vez.
  //
  // Sin un orden explícito, el resultado dependería de en qué posición del arreglo vino cada
  // etiqueta — o sea, de nada. Y las dos lecturas llevan a acciones opuestas: "el bot lo está
  // atendiendo, no lo toques" contra "ya pasó por la llamada, seguí vos".
  //
  // Gana el apagado porque es más NUEVO: los `bot_desactivado_*` los aplica la aplicación al
  // registrar un resultado, o sea después de que el CRM encendió el suyo.
  const marca = randomUUID().slice(0, 8);
  const id = await contactoConTerritorio(alfa, `ag-choque-${marca}`, 'closer', {
    // En este orden a propósito: el encendido PRIMERO. Si el código recorriera las etiquetas
    // del contacto en vez de su propia lista de precedencia, ganaría éste y la prueba fallaría.
    etiquetas: ['bot_activado_appflow', 'bot_desactivado_postcall'],
  });

  const r = await conOrganizacion(alfa, () => filasDeTerritorio('closer'));
  const fila = r.filas.find((f) => f.id === id);
  assert.ok(fila);
  assert.equal(
    fila.iconos.estadoAgente,
    'ya_paso_la_llamada',
    'con las dos etiquetas ganó el encendido: el orden de precedencia no se está respetando',
  );
});

test('`bot_reactivar` NO decide el estado: es una orden, no un hecho', async () => {
  // El contrato lo dice con todas las letras: *"Orden de volver a encender el bot. **No decide
  // estado**: es una orden"*.
  //
  // Un contacto con `bot_apagado_manual` y `bot_reactivar` está APAGADO hasta que el CRM
  // ejecute la orden. Tratarla como estado haría que el ícono dijera que el bot atiende cuando
  // todavía no lo hace — y quien mire la fila decidiría no tocar un contacto que sí necesita
  // que alguien lo toque.
  const marca = randomUUID().slice(0, 8);

  // ── EL CASO QUE DE VERDAD DISCRIMINA ──────────────────────────────────────
  //
  // La primera versión de esta prueba usaba `['bot_apagado_manual', 'bot_reactivar']` y era
  // VACUA: metiendo `bot_reactivar` en la tabla de estados, la prueba seguía pasando, porque
  // `bot_apagado_manual` ganaba igual por precedencia. Lo encontró una mutación.
  //
  // El caso que discrimina es la etiqueta SOLA: si decidiera estado, diría que el bot atiende;
  // como es una orden pendiente, no hay ningún estado puesto.
  const sola = await contactoConTerritorio(alfa, `ag-sola-${marca}`, 'closer', {
    etiquetas: ['bot_reactivar'],
  });
  // Y el caso de convivencia, que es el que ocurre en la subcuenta real.
  const conOtra = await contactoConTerritorio(alfa, `ag-orden-${marca}`, 'closer', {
    etiquetas: ['bot_apagado_manual', 'bot_reactivar'],
  });

  const r = await conOrganizacion(alfa, () => filasDeTerritorio('closer'));
  const laSola = r.filas.find((f) => f.id === sola);
  const laOtra = r.filas.find((f) => f.id === conOtra);
  assert.ok(laSola && laOtra);

  assert.equal(
    laSola.iconos.estadoAgente,
    'sin_agente',
    '`bot_reactivar` sola decidió un estado: es una ORDEN, y el bot todavía no atiende',
  );
  assert.equal(laOtra.iconos.estadoAgente, 'apagado_a_mano');
});

test('la cita y el seguimiento se encienden por ETIQUETA, no solo por tabla', async () => {
  // Las dos tablas —`negocio.citas` y `negocio.tareas`— están vacías mientras no se lea el
  // calendario ni se registre nada acá. Con solo esa fuente, dos de los seis íconos quedarían
  // apagados para los 238 contactos reales que SÍ tienen la etiqueta puesta por el CRM.
  const marca = randomUUID().slice(0, 8);
  const id = await contactoConTerritorio(alfa, `et-${marca}`, 'closer', {
    etiquetas: ['cita_agendada', 'seguimiento_recupero'],
  });

  const r = await conOrganizacion(alfa, () => filasDeTerritorio('closer'));
  const fila = r.filas.find((f) => f.id === id);
  assert.ok(fila);
  assert.equal(fila.iconos.citaFutura, true, '`cita_agendada` no encendió el ícono de la cita');
  assert.equal(
    fila.iconos.seguimientoAbierto,
    true,
    '`seguimiento_recupero` no encendió el ícono del seguimiento',
  );
});

test('`seguimiento_manual` NO enciende el ícono, y es deliberado', async () => {
  // El contrato: *"`seguimiento_manual` no dispara nada, y ese es su punto: le dice al CRM que
  // NO persiga a este contacto porque lo retoma una persona"*.
  //
  // Contarlo encendería el ícono de "hay un seguimiento automático corriendo" justo cuando lo
  // que hay es lo contrario. Es un error fácil —los dos empiezan con `seguimiento_`— y por eso
  // tiene su propia prueba.
  const marca = randomUUID().slice(0, 8);
  const id = await contactoConTerritorio(alfa, `sm-${marca}`, 'closer', {
    etiquetas: ['seguimiento_manual'],
  });

  const r = await conOrganizacion(alfa, () => filasDeTerritorio('closer'));
  const fila = r.filas.find((f) => f.id === id);
  assert.ok(fila);
  assert.equal(
    fila.iconos.seguimientoAbierto,
    false,
    '`seguimiento_manual` encendió el ícono: dice lo contrario de lo que significa',
  );
});

test('`estancado` NO va en la píldora: va en la fila', async () => {
  // El `11` § 7.1: *"la píldora dice la situación REAL, nunca una condición temporal.
  // «Estancado» y «vencido» se comunican con el color de la fila y el microtexto, jamás con la
  // píldora"*.
  //
  // El defecto que evita: un contacto con una VENTA registrada y la etiqueta `estancado`
  // mostraría «Estancado» y taparía el hecho que importa.
  const marca = randomUUID().slice(0, 8);
  const id = await contactoConTerritorio(alfa, `es-${marca}`, 'closer', {
    etiquetas: ['estancado'],
  });
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('resultados')
      .values({ contacto_id: id, salida: 'venta', rol: 'closer', monto: '900.00' } as never)
      .execute();
  });

  const r = await conOrganizacion(alfa, () => filasDeTerritorio('closer'));
  const fila = r.filas.find((f) => f.id === id);
  assert.ok(fila);
  assert.equal(fila.estancado, true, 'no se leyó la etiqueta `estancado`');
  assert.equal(fila.situacion, 'venta', 'el estancado tapó la situación real');
});

test('el orden pone los que nunca escribieron AL FINAL, no al principio', async () => {
  // En PostgreSQL `order by … desc` pone los NULOS PRIMERO. Sin `nulls last`, la lista de
  // trabajo arranca con los contactos que nunca dijeron una palabra y entierra al que
  // acaba de responder — y no falla nada: la lista está ahí, completa, en el orden que
  // menos sirve.
  const marca = randomUUID().slice(0, 8);
  const callado = await contactoConTerritorio(alfa, 'ord-n-' + marca, 'closer');
  const hablo = await contactoConTerritorio(alfa, 'ord-h-' + marca, 'closer', {
    ultimo_entrante_el: new Date(),
    ultimo_entrante_texto: 'respondió',
  });

  const r = await conOrganizacion(alfa, () => filasDeTerritorio('closer'));
  const posHablo = r.filas.findIndex((f) => f.id === hablo);
  const posCallado = r.filas.findIndex((f) => f.id === callado);
  assert.ok(posHablo >= 0 && posCallado >= 0);
  assert.ok(
    posHablo < posCallado,
    'el que nunca escribió quedó ANTES del que acaba de responder: falta `nulls last`',
  );
});

test('la fuente NUNCA llega vacía, aunque nadie la haya cargado', async () => {
  // El § 7.1: *"ninguna fila sin fuente: si no se sabe, va un valor de reserva visible"*.
  // La reserva la pone la base, no la consulta ni el cliente — así que no hay camino por el
  // que una fila llegue sin chip.
  const marca = randomUUID().slice(0, 8);
  const id = await contactoConTerritorio(alfa, 'fue-' + marca, 'closer');
  const r = await conOrganizacion(alfa, () => filasDeTerritorio('closer'));
  const fila = r.filas.find((f) => f.id === id);
  assert.ok(fila);
  assert.ok(fila.fuente && fila.fuente.length > 0, 'llegó una fila sin fuente');
});

test('la fila TAMPOCO cruza organizaciones: los íconos se cuentan dentro del inquilino', async () => {
  // El aislamiento de `contactos` ya está probado arriba. Esto prueba algo distinto y más
  // fácil de romper: los SEIS AGREGADOS son subconsultas sobre otras cinco tablas, y cada
  // una es una oportunidad de contar filas ajenas. Una subconsulta que se escape del
  // contexto no falla — suma.
  const marca = randomUUID().slice(0, 8);
  const enAlfa = await contactoConTerritorio(alfa, 'x-a-' + marca, 'closer');
  await contactoConTerritorio(beta, 'x-b-' + marca, 'closer');

  await conOrganizacion(beta, async () => {
    // Una llamada contestada en BETA. No puede aparecer en el conteo de alfa.
    const suyo = await datos()
      .selectFrom('contactos')
      .where('ghl_contact_id', '=', 'x-b-' + marca)
      .select('id')
      .executeTakeFirstOrThrow();
    await datos()
      .insertInto('llamadas')
      .values({ externa_id: 'aj-' + marca, contacto_id: suyo.id, contestada: true, inicio_el: new Date() } as never)
      .execute();
  });

  /* ── Y UNA LLAMADA PROPIA EN ALFA, PARA QUE EL CERO SIGNIFIQUE ALGO ────────
   *
   * Desde que `llamadasContestadas` distingue el cero medido del no medido, el valor esperado acá
   * depende de si alfa tiene alguna fila en `negocio.llamadas` —y otra prueba de este mismo archivo
   * ya deja dos—. Depender de eso es tener una prueba que se pone roja al REORDENAR el archivo, no
   * al romperse el código. Con esta siembra el `0` de abajo afirma las dos cosas por su cuenta: la
   * fuente existe para alfa, y la llamada contestada de beta no se coló.
   *
   * No contestada a propósito: si fuera contestada, el conteo daría 1 y una fuga desde beta —que
   * es lo que esta prueba persigue— quedaría tapada dando 2 en vez de 1. */
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('llamadas')
      .values({
        externa_id: 'aa-' + marca,
        contacto_id: enAlfa,
        contestada: false,
        inicio_el: new Date(),
      } as never)
      .execute();
  });

  const r = await conOrganizacion(alfa, () => filasDeTerritorio('closer'));
  assert.ok(
    !r.filas.some((f) => f.nombre.includes('x-b-' + marca)),
    'la lista de alfa trajo un contacto de beta',
  );
  const fila = r.filas.find((f) => f.id === enAlfa);
  assert.ok(fila);
  assert.equal(fila.iconos.llamadasContestadas, 0, 'contó una llamada de otra organización');
});

test('con más de una página, la lista DICE que hay más', async () => {
  // ── EL DEFECTO QUE ESTO ATRAPA ────────────────────────────────────────────
  //
  // Medido contra la subcuenta real: el closer tiene 123 contactos y la primera página trae
  // 100. Sin `hayMas`, la pantalla muestra 100 y **se ve completa**. Nadie reporta lo que no
  // sabe que falta, así que 23 personas quedarían sin trabajar sin que nada falle.
  //
  // Se prueban las DOS direcciones. Solo la primera —"con muchos dice que hay más"— pasaría
  // con un `hayMas: true` fijo, que sería igual de mentiroso en el otro sentido: una lista
  // completa con un botón «ver más» que trae cero.
  const marca = randomUUID().slice(0, 8);

  // Una página son 100. Se crean 101 de una sola sentencia: uno por uno son 101 viajes.
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('contactos')
      .values(
        Array.from({ length: 101 }, (_, i) => ({
          ghl_contact_id: `pag-${marca}-${i}`,
          nombre: `Contacto de paginación ${i}`,
          territorio: 'closer' as const,
        })),
      )
      .execute();
  });

  const primera = await conOrganizacion(alfa, () => filasDeTerritorio('closer'));
  assert.equal(primera.filas.length, 100, 'la página no trae 100 filas');
  assert.equal(primera.hayMas, true, 'con 101 contactos, la lista no dijo que había más');

  // La segunda trae el resto y ya no promete más. Y NO puede repetir filas de la primera: sin
  // un desempate estable en el orden, la paginación repite o se saltea gente en silencio.
  const segunda = await conOrganizacion(alfa, () => filasDeTerritorio('closer', { pagina: 1 }));

  // Cuántos hay DE VERDAD. No se compara contra 101: las pruebas anteriores de este archivo
  // dejan contactos de zona closer en la misma organización, así que el total es mayor. Fijar
  // el número a mano haría que esta prueba se rompiera cada vez que alguien agrega otra.
  const cuantos = await unaFila<{ n: number }>(
    admin,
    `select count(*)::int as n from negocio.contactos where org_id = $1 and territorio = 'closer'`,
    [alfa],
  );
  assert.ok(cuantos && cuantos.n > 100 && cuantos.n <= 200, `hacen falta entre 101 y 200 contactos, hay ${cuantos?.n}`);

  assert.equal(segunda.hayMas, false, 'la segunda página dijo que todavía hay más');
  assert.equal(
    segunda.filas.length,
    cuantos.n - 100,
    'la segunda página no trae exactamente el resto',
  );

  // Y NO puede repetir filas de la primera: sin un desempate estable en el orden, la
  // paginación repite o se saltea gente en silencio, y las dos cosas se ven igual de bien.
  const ids = new Set(primera.filas.map((f) => f.id));
  const repetidas = segunda.filas.filter((f) => ids.has(f.id)).map((f) => f.nombre);
  assert.deepEqual(
    repetidas,
    [],
    `la página 2 repitió filas de la 1: el orden no tiene desempate estable. ${repetidas.join(', ')}`,
  );

  // Entre las dos está TODO: ni una persona se perdió entre página y página.
  assert.equal(ids.size + segunda.filas.length, cuantos.n, 'faltan contactos entre las dos páginas');
});
