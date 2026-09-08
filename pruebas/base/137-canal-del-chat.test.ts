// El chat es de WhatsApp y SMS. Lo demás no entra. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO, QUE SE VEÍA EN PANTALLA
//
// La pestaña Chat de la ficha mostraba **correos**. Y no solo correos: sobre 392 mensajes de
// nuestros contactos medidos el 2026-09-08, se dibujaban como burbujas **17 `TYPE_EMAIL`** y
// **9 `TYPE_CUSTOM_CALL`**. Los nueve de llamada traen `body: ""`, así que salían con el marcador
// `[mensaje sin texto]` —el que existe para los audios y las imágenes— sobre algo que no fue
// ningún mensaje.
//
// ── LA CAUSA RAÍZ NO ERA UN FILTRO QUE FALTABA, ERA UN DATO QUE NO SE GUARDABA ──
//
// `negocio.mensajes.canal` se llenaba con `from ?? messageType`, y `from` no es el canal: es quién
// manda. Medido sobre las 5.124 filas de la cuenta real, esa columna tenía 3.563 números de
// teléfono, 393 veces «ARIA IA - High Ticket» y 123 nombres de personas. **Ninguna consulta podía
// filtrar por canal**, y por eso el defecto no era arreglable sin la migración 040.
//
// ── LO QUE ESTE ARCHIVO MIDE, Y QUÉ MATA CADA COSA ─────────────────────────
//
// **1 · Un correo no llega al chat, y un WhatsApp y un SMS sí.** Es el pedido, literal.
//
// **2 · Una fila SIN canal se muestra.** Son las 5.124 anteriores a la 040. Esconderlas vaciaría el
// chat de todos los contactos por un cambio de esquema — el `03` § 7 nombra ese defecto en su
// versión chica y acá sería en todas las conversaciones a la vez.
//
// **3 · Un correo VIEJO tampoco llega**, y ésa es la mitad que casi se perdió: la 040 intentó
// etiquetarlos con un `update` y escribió **cero filas sin error**, porque el migrador no ve filas
// de inquilino bajo la RLS forzada. La inferencia vive en `lib/negocio/ficha.ts` y este caso es lo
// único que la sostiene.
//
// **4 · La ingesta no GUARDA lo que no es del chat.** No es una optimización: de cada fila de
// `negocio.mensajes` cuelga un disparador que mueve `contactos.ultimo_entrante_el`, y de esa columna
// cuelgan el Buzón, la ventana de 24 horas y la reapertura de una tarea. Un correo entrante ponía al
// contacto en el Buzón debiendo respuesta **por un canal que esta aplicación no puede contestar**.
//
// **5 · Todo canal por el que se puede MANDAR es un canal que el chat MUESTRA.** Si los dos
// catálogos divergen, un mensaje sale de esta pantalla y no aparece en ella.
//
// ── LA MUTACIÓN QUE SOBREVIVE, Y ES INFORMACIÓN ────────────────────────────
//
// De once mutaciones, diez mueren. La que queda viva es **borrar `esUnMensaje` de la ingesta**, y no
// es un hueco de estas pruebas: el filtro de canal la SUBSUME —ningún `TYPE_ACTIVITY_*` está en una
// lista de inclusión de tres valores—. Se dejó igual, con su motivo escrito en `ingesta.ts`, y la
// última prueba de este archivo es la que vuelve demostrada esa redundancia en vez de supuesta.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas } from '../apoyo/conexiones.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { mensajesDeLaFicha } from '../../lib/negocio/ficha.ts';
import { NO_CORRIO } from '../../lib/negocio/pulso.ts';
import {
  CANALES_DEL_CHAT,
  esDeUnCanalDelChat,
  esUnMensaje,
} from '../../lib/ghl/entrega.ts';
import { TIPO_DEL_CANAL, type CanalDeEnvio } from '../../lib/ghl/conversaciones.ts';

let admin: Client;
let alfa: string;
let contactoId: string;

const MARCA = 'canal-del-chat';

before(async () => {
  admin = await conectar('admin');
  const o = await filas<{ id: string }>(admin, `select id from identidad.organizaciones where slug='alfa'`);
  assert.equal(o.length, 1, 'falta la organización cliente del sembrado');
  alfa = o[0]!.id;
  await limpiar();
  contactoId = await conOrganizacion(alfa, async () => {
    const f = await datos()
      .insertInto('contactos')
      .values({ ghl_contact_id: `${MARCA}-c`, nombre: 'Contacto del chat', territorio: 'closer' } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return f.id;
  });
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

/** Por el camino del INQUILINO: si hiciera falta el propietario, los permisos estarían mal. */
async function limpiar(): Promise<void> {
  await conOrganizacion(alfa, async () => {
    await datos().deleteFrom('mensajes').execute();
    await datos().deleteFrom('contactos').where('ghl_contact_id', 'like', `${MARCA}%`).execute();
  });
}

/** Una fila de mensaje, escrita como la escribe cada uno de los tres escritores. */
async function unMensaje(campos: {
  cuerpo: string;
  /** `undefined` = no se pasa la columna, o sea una fila anterior a la migración 040. */
  tipoGhl?: string | null;
  canal?: string | null;
  direccion?: 'entrante' | 'saliente';
  /** De qué contacto cuelga. Por omisión el de este archivo. */
  de?: string;
}): Promise<void> {
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('mensajes')
      .values({
        ghl_mensaje_id: `${MARCA}-${campos.cuerpo.slice(0, 20)}-${Math.random()}`,
        contacto_id: campos.de ?? contactoId,
        canal: campos.canal ?? null,
        ...(campos.tipoGhl === undefined ? {} : { tipo_ghl: campos.tipoGhl }),
        direccion: campos.direccion ?? 'entrante',
        cuerpo: campos.cuerpo,
        autor: (campos.direccion ?? 'entrante') === 'entrante' ? 'contacto' : 'agente',
        enviado_el: new Date(),
        estado_entrega_familia: 'en_curso',
      } as never)
      .execute();
  });
}

/** Los cuerpos que el chat dibuja, en orden. */
async function loQueMuestraElChat(): Promise<string[]> {
  const p = await conOrganizacion(alfa, () => mensajesDeLaFicha(contactoId));
  return p.filas.map((f) => f.cuerpo ?? '');
}

// ─── 1 · Qué entra al chat y qué no ──────────────────────────────────────────

test('el chat muestra WhatsApp y SMS, y NO muestra correos ni llamadas', async () => {
  await conOrganizacion(alfa, () => datos().deleteFrom('mensajes').execute());

  await unMensaje({ cuerpo: 'un whatsapp', tipoGhl: 'TYPE_WHATSAPP' });
  await unMensaje({ cuerpo: 'un sms', tipoGhl: 'TYPE_CUSTOM_SMS' });
  await unMensaje({ cuerpo: 'un sms del enumerado', tipoGhl: 'TYPE_SMS' });
  /* Los dos que se veían. El correo trae texto de verdad —el que un closer leía como si el contacto
     lo hubiera escrito— y la llamada trae el cuerpo vacío, que es peor: se dibujaba como
     «[mensaje sin texto]», el marcador de los audios. */
  await unMensaje({ cuerpo: 'CORREO: te asigno un asesor', tipoGhl: 'TYPE_EMAIL', direccion: 'saliente' });
  await unMensaje({ cuerpo: '', tipoGhl: 'TYPE_CUSTOM_CALL', direccion: 'saliente' });
  // Y dos canales que la cuenta todavía no usa: el filtro es de INCLUSIÓN, así que no hace falta
  // nombrarlos en ninguna lista para que queden afuera.
  await unMensaje({ cuerpo: 'UN INSTAGRAM', tipoGhl: 'TYPE_INSTAGRAM' });
  await unMensaje({ cuerpo: 'UN FACEBOOK', tipoGhl: 'TYPE_FACEBOOK' });

  const visto = await loQueMuestraElChat();
  assert.deepEqual(
    [...visto].sort(),
    ['un sms', 'un sms del enumerado', 'un whatsapp'],
    'el chat mostró algo que no es de WhatsApp ni de SMS, o escondió uno que sí',
  );
});

// ─── 2 y 3 · Las filas anteriores a la migración 040 ─────────────────────────

test('una fila SIN canal se muestra, pero un correo viejo se reconoce por `canal`', async () => {
  await conOrganizacion(alfa, () => datos().deleteFrom('mensajes').execute());

  /* Las 5.124 que ya estaban. Su `canal` es el `from` del CRM: un teléfono, o el nombre del
     remitente. De ahí no sale ningún canal, así que se muestran — y tienen que mostrarse. */
  await unMensaje({ cuerpo: 'viejo, de un telefono', canal: '+595981334210' });
  await unMensaje({ cuerpo: 'viejo, de un nombre', canal: 'ARIA IA - High Ticket', direccion: 'saliente' });
  await unMensaje({ cuerpo: 'viejo, sin from', canal: null });

  /* Y el caso que lo sostiene todo: `canal` salía de `from ?? messageType`, así que cuando `from`
     vino nulo quedó ahí el TIPO. Los correos son exactamente ésos —medido: `from: null` en los 17 de
     la muestra— y son 378 filas en producción. Si esta inferencia se cae, vuelven al chat. */
  await unMensaje({ cuerpo: 'CORREO VIEJO', canal: 'TYPE_EMAIL', direccion: 'saliente' });

  const visto = await loQueMuestraElChat();
  assert.deepEqual(
    [...visto].sort(),
    ['viejo, de un nombre', 'viejo, de un telefono', 'viejo, sin from'],
    'o se escondieron las filas viejas —y el chat de cada contacto quedaría casi vacío— o volvió ' +
      'el correo viejo, que son las 378 que la migración 040 no pudo etiquetar',
  );
});

test('el nulo se muestra al LEER y se descarta al ESCRIBIR, y las dos cosas son a propósito', () => {
  /* Es la asimetría que más se va a querer «arreglar» leyendo una de las dos mitades. Las preguntas
     son distintas: al escribir se decide si una fila NUEVA entra a la tabla del chat, y sin canal no
     se sabe qué es; al leer, la fila ya está y su nulo significa «se guardó cuando el canal no se
     leía». Está medido que ningún mensaje de GoHighLevel llega sin `messageType`, así que la rama
     estricta de la escritura no le cuesta nada a nadie. */
  assert.equal(esDeUnCanalDelChat(null), false, 'al escribir, sin canal NO entra');
  assert.equal(esDeUnCanalDelChat(''), false);
  assert.equal(esDeUnCanalDelChat('TYPE_WHATSAPP'), true);
  assert.equal(esDeUnCanalDelChat('TYPE_EMAIL'), false);

  /* Y no se confunde con el otro filtro, que es de exclusión y contesta otra cosa: «¿esto es un
     mensaje o es una entrada del registro del CRM?». Un correo ES un mensaje —solo que de un canal
     que no mostramos— y una cita NO lo es. */
  assert.equal(esUnMensaje('TYPE_EMAIL'), true, 'un correo es un mensaje: lo que falla es su canal');
  assert.equal(esUnMensaje('TYPE_ACTIVITY_APPOINTMENT'), false);
});

// ─── 4 · La ingesta no guarda lo que no es del chat ──────────────────────────

test('un canal ajeno no llega a la tabla, así que no puede mover el Buzón', async () => {
  /* La mitad invisible del defecto. Este `insert` es el que la ingesta ya no hace, y se comprueba
     por el EFECTO: un entrante mueve `contactos.ultimo_entrante_el` por un disparador de la base
     (migración 013), y de esa columna cuelgan el Buzón, la ventana de respuesta de 24 horas y la
     reapertura de una tarea cerrada.
     O sea que un correo entrante no era un renglón de más: ponía al contacto en el Buzón debiendo
     una respuesta que esta aplicación **no puede mandar** — solo manda WhatsApp y SMS. */
  /* UN CONTACTO PROPIO, y no es comodidad: `contactos.ultimo_entrante_el` **solo avanza**, y lo hace
     cumplir el disparador `entrante_solo_avanza` de la migración 011 — un `update` que la devuelva a
     nulo se descarta en silencio. Así que no hay forma de limpiar la marca del contacto compartido,
     y la única manera de medir el avance desde cero es un contacto que todavía no tenga ninguna.
     Lo confirma la primera aserción: si algún día ese disparador dejara de existir, esto seguiría
     midiendo lo mismo. */
  const soloParaLaMarca = await conOrganizacion(alfa, async () => {
    const f = await datos()
      .insertInto('contactos')
      .values({ ghl_contact_id: `${MARCA}-marca`, nombre: 'Contacto de la marca', territorio: 'closer' } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return f.id;
  });

  const marcaDe = async () =>
    conOrganizacion(alfa, async () =>
      datos()
        .selectFrom('contactos')
        .select(['ultimo_entrante_el', 'ultimo_entrante_texto'])
        .where('id', '=', soloParaLaMarca)
        .executeTakeFirstOrThrow(),
    );

  assert.equal((await marcaDe()).ultimo_entrante_el, null, 'la marca no arrancó limpia');

  /* Se escribe un correo entrante A MANO, que es lo que la ingesta hacía. El disparador corre igual
     —no distingue canales, y no tiene por qué— y ahí está el motivo por el que el filtro vive en la
     ingesta y no solo en la consulta del chat: filtrando solo al leer, ESTA marca seguiría
     moviéndose y el contacto seguiría cayendo en el Buzón, sin nada visible que lo explicara. */
  await unMensaje({ cuerpo: 'correo entrante', tipoGhl: 'TYPE_EMAIL', de: soloParaLaMarca });
  const conCorreo = await marcaDe();
  assert.notEqual(
    conCorreo.ultimo_entrante_el,
    null,
    'el disparador dejó de mover la marca: entonces esta prueba ya no mide nada y hay que ' +
      'replantearla contra lo que la mueva ahora',
  );
  assert.equal(conCorreo.ultimo_entrante_texto, 'correo entrante');

  /* Y la comprobación de verdad: el filtro de la ingesta descarta ese mensaje ANTES de escribirlo,
     así que el disparador nunca corre. Se mide sobre la misma función que usa la ingesta. */
  assert.equal(
    esDeUnCanalDelChat('TYPE_EMAIL'),
    false,
    'la ingesta guardaría el correo, y con él se mueve la marca del Buzón',
  );
});

test('la INGESTA no escribe el correo, y sí escribe el WhatsApp y el SMS', async () => {
  /* ═══════════════════════════════════════════════════════════════════════════
   * ESTA PRUEBA EXISTE PORQUE LA DE ARRIBA NO ALCANZABA, Y LO DIJO EL ARNÉS
   *
   * La prueba anterior mide `esDeUnCanalDelChat`, que es la función que la ingesta usa — pero no
   * ejecuta la ingesta. Medido con el arnés de mutación: **borrar la línea
   * `if (!esDeUnCanalDelChat(m.tipo)) continue;` de `lib/negocio/ingesta.ts` dejaba las cinco
   * pruebas en verde.** También sobrevivían dejar de guardar el canal (`tipo_ghl: null`) y borrar el
   * filtro de actividades.
   *
   * O sea que el encabezado de este archivo afirmaba medir la ingesta y no la medía. `ingerirMensajes`
   * no se ejercitaba en ninguna prueba del proyecto.
   *
   * ── CÓMO SE PRUEBA UN MÓDULO QUE HABLA CON UN SERVICIO AJENO ──────────────
   *
   * Se intercepta `globalThis.fetch`, que es la ÚNICA salida del proyecto —lo afirma el `ADR-0305` y
   * lo vigila `pruebas/codigo/30-portero`—. Es el mismo recurso que `98-closer-sincronizar` usa para
   * los contactos, y por el mismo motivo: así la ingesta corre **contra la base de verdad**, con la
   * política de fila puesta, y lo que se comprueba es qué filas quedaron escritas.
   * ═══════════════════════════════════════════════════════════════════════════ */
  const CONV = `${MARCA}-conv`;
  const GHL = 'https://services.leadconnectorhq.com';

  const contacto = await conOrganizacion(alfa, async () => {
    await datos().deleteFrom('mensajes').execute();
    const f = await datos()
      .selectFrom('contactos')
      .select('ghl_contact_id')
      .where('id', '=', contactoId)
      .executeTakeFirstOrThrow();
    return f.ghl_contact_id;
  });

  /* El pulso, que es el candado del ciclo. Se borra la fila de ESTA empresa —no la tabla— porque el
     antirrebote de `conElPulso` haría que el ciclo se fuera sin trabajar si otra prueba lo corrió
     hace poco, y entonces esto no mediría nada. `25-ingesta` la borra sin filtro; acá con filtro,
     que es lo que hace que las dos puedan convivir. */
  await conOrganizacion(alfa, () => datos().deleteFrom('ingesta_pulso').execute());

  const original = globalThis.fetch;
  let pidioMensajes = 0;
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const url = typeof entrada === 'string' ? entrada : String((entrada as Request).url ?? entrada);
    const responder = (cuerpo: unknown) =>
      new Response(JSON.stringify(cuerpo), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    if (url.startsWith(`${GHL}/conversations/search`)) {
      // Una sola conversación, y del contacto de este archivo: es lo que la hace «nuestra».
      return responder({
        conversations: [
          {
            id: CONV,
            contactId: contacto,
            lastMessageDate: new Date().toISOString(),
            lastMessageBody: 'un whatsapp de verdad',
            lastMessageDirection: 'inbound',
            lastMessageType: 'TYPE_WHATSAPP',
          },
        ],
        total: 1,
      });
    }
    if (url.includes(`/conversations/${CONV}/messages`)) {
      pidioMensajes += 1;
      /* Los cinco casos, con la forma exacta que el proveedor devuelve —medida el 2026-09-08—:
         el correo trae `from: null`, el registro de llamada trae `body: ""`, y la entrada de
         actividad trae el título de una cita en el cuerpo. */
      return responder({
        messages: {
          messages: [
            { id: `${MARCA}-wa`, conversationId: CONV, contactId: contacto, body: 'un whatsapp de verdad', direction: 'inbound', messageType: 'TYPE_WHATSAPP', from: '+595981334210', dateAdded: new Date().toISOString() },
            { id: `${MARCA}-sms`, conversationId: CONV, contactId: contacto, body: 'un sms de verdad', direction: 'outbound', messageType: 'TYPE_CUSTOM_SMS', from: 'ARIA IA - High Ticket', dateAdded: new Date().toISOString() },
            { id: `${MARCA}-mail`, conversationId: CONV, contactId: contacto, body: 'CORREO: te asigno un asesor', direction: 'outbound', messageType: 'TYPE_EMAIL', from: null, dateAdded: new Date().toISOString() },
            { id: `${MARCA}-call`, conversationId: CONV, contactId: contacto, body: '', direction: 'outbound', messageType: 'TYPE_CUSTOM_CALL', from: '+16083365898', dateAdded: new Date().toISOString() },
            { id: `${MARCA}-cita`, conversationId: CONV, contactId: contacto, body: 'Iiliana Diaz - ARIA', direction: 'outbound', messageType: 'TYPE_ACTIVITY_APPOINTMENT', from: null, dateAdded: new Date().toISOString() },
          ],
          lastMessageId: `${MARCA}-cita`,
        },
      });
    }
    // Cualquier otra salida contesta vacío en vez de lanzar: un doble que lanza convierte esta
    // prueba en una medición del orden de las llamadas.
    return responder({});
  }) as typeof globalThis.fetch;

  try {
    const { ingerirMensajes } = await import('../../lib/negocio/ingesta.ts');
    const r = await ingerirMensajes(alfa, { token: 'x', locationId: 'loc' });
    assert.notEqual(r, NO_CORRIO, 'el candado no dejó correr el ciclo: la prueba no midió nada');
    assert.equal(pidioMensajes, 1, 'no se pidieron los mensajes de la conversación');

    const escritas = await conOrganizacion(alfa, async () =>
      datos()
        .selectFrom('mensajes')
        .select(['ghl_mensaje_id', 'tipo_ghl', 'cuerpo'])
        .orderBy('ghl_mensaje_id')
        .execute(),
    );

    assert.deepEqual(
      escritas.map((m) => m.ghl_mensaje_id).sort(),
      [`${MARCA}-sms`, `${MARCA}-wa`],
      'la ingesta escribió algo que no es de WhatsApp ni de SMS. No es un renglón de más en el ' +
        'chat: de cada fila cuelga el disparador que mueve `contactos.ultimo_entrante_el`, y de ahí ' +
        'cuelgan el Buzón, la ventana de 24 horas y la reapertura de una tarea',
    );

    /* Y el canal QUEDA GUARDADO. Sin esto la fila entra bien y se lee mal: `tipo_ghl` nulo cae en la
       rama de las filas viejas, así que un correo del futuro se mostraría por la regla que existe
       para las 5.124 de antes. */
    assert.deepEqual(
      escritas.map((m) => m.tipo_ghl).sort(),
      ['TYPE_CUSTOM_SMS', 'TYPE_WHATSAPP'],
      'la ingesta no guardó el canal de lo que escribió',
    );

    // Y lo que la pantalla dibuja, que es el pedido completo recorrido de punta a punta.
    assert.deepEqual(
      (await loQueMuestraElChat()).sort(),
      ['un sms de verdad', 'un whatsapp de verdad'],
      'el chat no muestra exactamente lo que entró por WhatsApp y por SMS',
    );
  } finally {
    globalThis.fetch = original;
  }
});

// ─── 5 · Los dos catálogos no pueden divergir ────────────────────────────────

test('todo canal por el que se MANDA es un canal que el chat MUESTRA', () => {
  /* `CanalDeEnvio` tiene dos valores y el compositor del chat manda por uno de ellos. Si alguno no
     estuviera en `CANALES_DEL_CHAT`, un mensaje saldría de esta pantalla y **no aparecería en
     ella**: el closer lo escribiría, lo mandaría, y vería la conversación sin su propio mensaje.
     Se recorre `TIPO_DEL_CANAL`, que es el mapa que el `POST` del chat usa para escribir la
     columna, así que agregar un canal de envío sin darle su tipo también cae acá. */
  const deEnvio: CanalDeEnvio[] = ['WhatsApp', 'SMS'];
  for (const canal of deEnvio) {
    const tipo = TIPO_DEL_CANAL[canal];
    assert.ok(tipo, `«${canal}» se puede mandar y no tiene su \`messageType\``);
    assert.ok(
      CANALES_DEL_CHAT.includes(tipo),
      `se puede mandar por «${canal}» (${tipo}) y el chat no lo muestra: el mensaje saldría de ` +
        'esta pantalla y no aparecería en ella',
    );
  }

  assert.deepEqual(
    Object.keys(TIPO_DEL_CANAL).sort(),
    [...deEnvio].sort(),
    'cambió `CanalDeEnvio` y el mapa de tipos quedó viejo, o al revés',
  );
});

test('ningún tipo de ACTIVIDAD puede entrar a los canales del chat', () => {
  /* ── LA INVARIANTE QUE VUELVE DEMOSTRADA UNA REDUNDANCIA ─────────────────
   *
   * La ingesta corre dos filtros seguidos: `esUnMensaje` (exclusión: ¿es un mensaje o es una entrada
   * del registro del CRM?) y `esDeUnCanalDelChat` (inclusión: ¿viajó por WhatsApp o SMS?).
   *
   * Medido con el arnés de mutación: **borrar el primero deja la suite en verde**, porque el segundo
   * lo subsume — ningún `TYPE_ACTIVITY_*` está en una lista de tres valores. Se dejó igual, y el
   * motivo está escrito en `lib/negocio/ingesta.ts`: el día que alguien agregue un canal, ese primer
   * filtro vuelve a ser lo único que separa un mensaje de Telegram de una ACTIVIDAD de Telegram.
   *
   * Esta prueba es la que hace que esa afirmación sea cierta en vez de una suposición. Si alguien
   * mete un tipo de actividad en `CANALES_DEL_CHAT`, acá se ve; sin ella, el primer filtro sería un
   * guardia muerto y nadie tendría cómo saber si se puede borrar. */
  for (const canal of CANALES_DEL_CHAT) {
    assert.ok(
      esUnMensaje(canal),
      `«${canal}» está en los canales del chat y NO es un mensaje: la ingesta lo descarta antes de ` +
        'llegar al filtro de canal, así que ese canal no funcionaría y nada fallaría',
    );
    assert.ok(
      !canal.startsWith('TYPE_ACTIVITY_'),
      `«${canal}» es un tipo de actividad y está en los canales del chat`,
    );
  }
});
