// De dónde salió el mensaje: el campo que separa al agente de un flujo del CRM. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO, Y NO SE VE EN NINGUNA PANTALLA: SE VE EN UN TABLERO QUE MIENTE
//
// `negocio.mensajes.autor` tiene tres estados, y el que importa acá sale de una sola línea:
// `autorDe()` devuelve `persona` si `source` vale `app`, y `agente` si vale **cualquier otra cosa**.
// O sea que dentro de `autor = 'agente'` conviven el agente de IA, los flujos del CRM, las campañas
// y los envíos por API de esta misma aplicación.
//
// Y el identificador del usuario NO los separa. Medido el 2026-09-11 con `scripts/medir-mensaje.mjs`
// —censo completo sobre las 518 conversaciones de nuestros contactos, emparejando cada fila nuestra
// con su mensaje del CRM— de las **2.182 selladas con el identificador del agente**:
//
//     workflow   1.560   71,5 %
//     app          417   19,1 %
//     api          205    9,4 %
//
// Filtrar por ese identificador para decir «lo que hizo el agente» se lleva 1.560 mensajes que
// disparó un flujo del CRM. El número que sale es plausible, estable y de otra cosa.
//
// Por eso la `044` guarda `source` crudo, y por eso estas pruebas usan **dos mensajes con el MISMO
// usuario y distinta fuente**: es la forma exacta del defecto, y una prueba que usara dos usuarios
// distintos pasaría sin tocarlo.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas } from '../apoyo/conexiones.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { NO_CORRIO } from '../../lib/negocio/pulso.ts';

let admin: Client;
let alfa: string;
let contactoGhl: string;

const MARCA = 'de-donde-salio';
const CONV = `${MARCA}-conv`;
const GHL = 'https://services.leadconnectorhq.com';
/** El mismo usuario en los dos mensajes. Es lo que vuelve la prueba una prueba. */
const USUARIO = 'el-mismo-usuario-en-los-dos';

before(async () => {
  admin = await conectar('admin');
  const o = await filas<{ id: string }>(admin, `select id from identidad.organizaciones where slug='alfa'`);
  assert.equal(o.length, 1, 'falta la organización cliente del sembrado');
  alfa = o[0]!.id;
  await limpiar();
  contactoGhl = `${MARCA}-c`;
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('contactos')
      .values({ ghl_contact_id: contactoGhl, nombre: 'Contacto de la fuente', territorio: 'closer' } as never)
      .execute();
  });
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

async function limpiar(): Promise<void> {
  await conOrganizacion(alfa, async () => {
    await datos().deleteFrom('mensajes').execute();
    await datos().deleteFrom('contactos').where('ghl_contact_id', 'like', `${MARCA}%`).execute();
    await datos().deleteFrom('ingesta_pulso').execute();
  });
}

/** Un mensaje como el CRM lo manda de verdad, con la forma medida el 2026-09-11. */
function delCrm(id: string, fuente: string | null, extra: Record<string, unknown> = {}) {
  return {
    id,
    conversationId: CONV,
    contactId: contactoGhl,
    body: 'algo',
    direction: 'outbound',
    messageType: 'TYPE_WHATSAPP',
    from: 'ARIA IA - High Ticket',
    dateAdded: new Date().toISOString(),
    userId: USUARIO,
    ...(fuente === null ? {} : { source: fuente }),
    ...extra,
  };
}

/**
 * Corre la ingesta contra la base de verdad, interceptando la única salida del proyecto.
 * Es el mismo recurso —y por el mismo motivo— que `137-canal-del-chat`.
 */
async function ingerir(mensajes: unknown[]): Promise<void> {
  await conOrganizacion(alfa, () => datos().deleteFrom('ingesta_pulso').execute());
  const original = globalThis.fetch;
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const url = typeof entrada === 'string' ? entrada : String((entrada as Request).url ?? entrada);
    const responder = (cuerpo: unknown) =>
      new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } });

    if (url.startsWith(`${GHL}/conversations/search`)) {
      return responder({
        conversations: [
          {
            id: CONV,
            contactId: contactoGhl,
            lastMessageDate: new Date().toISOString(),
            lastMessageBody: 'algo',
            lastMessageDirection: 'outbound',
            lastMessageType: 'TYPE_WHATSAPP',
          },
        ],
        total: 1,
      });
    }
    if (url.includes(`/conversations/${CONV}/messages`)) {
      return responder({ messages: { messages: mensajes, lastMessageId: 'z' } });
    }
    return responder({});
  }) as typeof globalThis.fetch;

  try {
    const { ingerirMensajes } = await import('../../lib/negocio/ingesta.ts');
    const r = await ingerirMensajes(alfa, { token: 'x', locationId: 'loc' });
    assert.notEqual(r, NO_CORRIO, 'el candado no dejó correr el ciclo: la prueba no midió nada');
  } finally {
    globalThis.fetch = original;
  }
}

async function comoQuedo(): Promise<Record<string, unknown>[]> {
  return conOrganizacion(alfa, async () =>
    datos()
      .selectFrom('mensajes')
      .select(['ghl_mensaje_id', 'fuente', 'autor', 'autor_ghl_usuario_id'])
      .orderBy('ghl_mensaje_id')
      .execute(),
  ) as Promise<Record<string, unknown>[]>;
}

// ─── 1 · Se guarda, y guarda lo que `autor` pierde ──────────────────────────

test('dos mensajes del MISMO usuario y distinta fuente quedan distinguibles', async () => {
  /* La prueba del defecto, en su forma exacta. Los dos mensajes traen el mismo `userId`, así que
     ningún filtro por identificador los separa; y `autor` tampoco alcanza, porque colapsa todo lo
     que no es `app`. Sólo `fuente` los distingue.
     Si alguien borrara `fuente: m.fuente` de la ingesta, las dos filas quedarían idénticas en todo
     lo que la base sabe — y el 71,5 % de los mensajes del agente se volvería incontable. */
  await limpiar();
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('contactos')
      .values({ ghl_contact_id: contactoGhl, nombre: 'Contacto de la fuente', territorio: 'closer' } as never)
      .execute();
  });

  await ingerir([delCrm(`${MARCA}-flujo`, 'workflow'), delCrm(`${MARCA}-agente`, 'api')]);

  const f = await comoQuedo();
  assert.equal(f.length, 2, 'no se guardaron los dos mensajes');
  assert.deepEqual(
    f.map((m) => m.fuente),
    ['api', 'workflow'],
    'la fuente no llegó a la tabla: el lector la trae y el `insert` la tiró',
  );

  // Y la comprobación que sostiene el motivo: por lo demás, las dos filas son iguales.
  assert.deepEqual(
    [...new Set(f.map((m) => m.autor))],
    ['agente'],
    'el fixture dejó de ser el caso difícil: `autor` ya las separa y la prueba no prueba nada',
  );
  assert.deepEqual(
    [...new Set(f.map((m) => m.autor_ghl_usuario_id))],
    [USUARIO],
    'el fixture dejó de ser el caso difícil: los usuarios son distintos y el id ya las separa',
  );
});

test('`app` sigue marcando persona, y ahora además se sabe que fue `app`', async () => {
  /* La otra mitad, y la que impide «simplificar» la columna: alguien podría mirar `fuente` y decir
     que `autor` sobra, o al revés. Las dos conviven a propósito — `autor` es la decisión ya tomada
     y `fuente` es el dato crudo del que salió. */
  await limpiar();
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('contactos')
      .values({ ghl_contact_id: contactoGhl, nombre: 'Contacto de la fuente', territorio: 'closer' } as never)
      .execute();
  });

  await ingerir([delCrm(`${MARCA}-mano`, 'app')]);

  const f = await comoQuedo();
  assert.equal(f[0]?.fuente, 'app');
  assert.equal(f[0]?.autor, 'persona', 'se rompió la regla de `autorDe`: `app` es una persona');
});

// ─── 2 · El relleno de las viejas, y que no se pise ─────────────────────────

test('un segundo barrido RELLENA la fuente de una fila que la tenía nula', async () => {
  /* Las 5.606 filas anteriores a la `044` nacen en nulo y una migración no las puede tocar —regla de
     la `040`: el migrador ve cero filas bajo RLS forzada—. El único camino es que la ingesta vuelva
     a pasar por su conversación, y eso sólo ocurre si el `on conflict` las actualiza.
     La mitad que casi se pierde es el `where`: sin ampliarlo, una fila cuyo estado de entrega no
     cambió no se actualiza nunca, y el relleno no ocurriría justo en las filas que lo necesitan. */
  await limpiar();
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('contactos')
      .values({ ghl_contact_id: contactoGhl, nombre: 'Contacto de la fuente', territorio: 'closer' } as never)
      .execute();
  });

  // Primera pasada: el CRM no manda la fuente. Es la forma de las filas viejas.
  await ingerir([delCrm(`${MARCA}-vieja`, null)]);
  assert.equal((await comoQuedo())[0]?.fuente, null, 'nació con fuente sin que el CRM la mandara');

  // Segunda: ahora sí la manda, y el mismo mensaje ya existe.
  await ingerir([delCrm(`${MARCA}-vieja`, 'workflow')]);
  assert.equal(
    (await comoQuedo())[0]?.fuente,
    'workflow',
    'la fila vieja no se rellenó: el `coalesce` del `on conflict` o su `where` no están',
  );
});

test('con el estado de entrega CAMBIADO y sin fuente, la fuente sobrevive', async () => {
  /* ── ESTA PRUEBA EXISTE PORQUE LA DE ABAJO PASABA POR EL MOTIVO EQUIVOCADO ──
   *
   * Medido con el arnés de mutación: cambiar el `coalesce` del `on conflict` por un pisado directo
   * dejaba la prueba siguiente EN VERDE. El motivo es que ahí el `where` es falso —ni el estado de
   * entrega cambió ni la fuente estaba nula— así que la fila no se actualiza y la fuente sobrevive
   * sola. La prueba medía la guarda, no el `coalesce`.
   *
   * Acá el estado de entrega SÍ cambia, así que el `where` es verdadero y el `do update` corre de
   * verdad. Es el único camino por el que un pisado directo puede borrar una fuente ya resuelta, y
   * es un camino real: el CRM puede mandar el cambio de entrega sin repetir el `source`. */
  await limpiar();
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('contactos')
      .values({ ghl_contact_id: contactoGhl, nombre: 'Contacto de la fuente', territorio: 'closer' } as never)
      .execute();
  });

  await ingerir([delCrm(`${MARCA}-entrega`, 'workflow', { status: 'delivered' })]);
  assert.equal((await comoQuedo())[0]?.fuente, 'workflow', 'no se guardó en la primera pasada');

  // El mismo mensaje, con OTRO estado de entrega y sin `source`.
  await ingerir([delCrm(`${MARCA}-entrega`, null, { status: 'read' })]);

  const f = await comoQuedo();
  assert.equal(
    f[0]?.fuente,
    'workflow',
    'el `do update` corrió por el cambio de entrega y se llevó puesta la fuente: falta el `coalesce`',
  );
  // Y la comprobación de entrada muerta: si el estado NO hubiera cambiado, esto no probaría nada.
  const estado = await conOrganizacion(alfa, async () =>
    datos()
      .selectFrom('mensajes')
      .select('estado_entrega')
      .where('ghl_mensaje_id', '=', `${MARCA}-entrega`)
      .executeTakeFirst(),
  );
  assert.equal(estado?.estado_entrega, 'read', 'el estado de entrega no cambió: el `where` fue falso y el `do update` nunca corrió');
});

test('un barrido sin fuente NO borra la que ya teníamos', async () => {
  /* La gemela, y el motivo es propio: **un mensaje sale de un lugar una sola vez**. Un nulo que
     pisara borraría una atribución ya resuelta, y como la ingesta camina hacia adelante desde una
     marca de agua, esa conversación puede no volver a mirarse nunca. */
  await limpiar();
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('contactos')
      .values({ ghl_contact_id: contactoGhl, nombre: 'Contacto de la fuente', territorio: 'closer' } as never)
      .execute();
  });

  await ingerir([delCrm(`${MARCA}-firme`, 'workflow')]);
  await ingerir([delCrm(`${MARCA}-firme`, null)]);

  assert.equal(
    (await comoQuedo())[0]?.fuente,
    'workflow',
    'un barrido sin el campo borró la fuente: falta el `coalesce` del `on conflict`',
  );
});
