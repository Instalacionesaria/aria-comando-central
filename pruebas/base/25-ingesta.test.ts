// El candado de la ingesta y las marcas de agua, contra la base. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS CINCO HECHOS QUE ESTE ARCHIVO MIDE, Y NINGUNO SE VE MIRANDO LA PANTALLA
//
// **1 · El ciclo que llega tarde SE VA, no espera.** Y se mide en sus DOS formas, porque son dos
// mecanismos distintos y cada uno cubre lo que el otro no puede:
//
//   · **el alquiler**, que frena al que llega mientras otro trabaja — el caso corriente;
//   · **el candado** (`.forUpdate().skipLocked()`), que frena al que llega en el instante exacto en
//     que otro está reclamando, antes de que haya estampado nada. Ese se mide tomando la fila desde
//     una conexión aparte, y el tiempo de espera de la prueba es lo que distingue *irse* de
//     *encolarse*: con `.forUpdate()` a secas se encolaría y fallaría por tiempo.
//
// Es lo contrario de `lib/credenciales/refresco.ts`, donde esperar es correcto porque la segunda
// petición aprovecha el token que renovó la primera. Acá esperar sería una fila de ciclos que
// corren uno detrás de otro y gastan lo mismo que sin candado, solo que más tarde.
//
// **2 · Y el segundo SEGUIDO también.** El candado no cubre las corridas consecutivas: dos pestañas
// desfasadas medio segundo son dos ciclos completos que no se pisan nunca. Eso lo tapa el
// antirrebote, y sin él el candado da una falsa sensación de estar acotando el gasto.
//
// **3 · La marca NUNCA retrocede.** Es la línea de la que depende todo el diseño: retrocediendo,
// un ciclo lento que termina después de uno rápido pisaría su avance y dejaría un hueco de
// conversaciones que ya nadie va a volver a mirar — y **nada lo señalaría**.
//
// **4 · Un ciclo que falla no mueve la marca.** Avanzar sobre trabajo que no se hizo es la misma
// pérdida silenciosa, por el camino de al lado.
//
// **5 · El piso se escribe una vez.** Moverlo correría la frontera entre «este contacto no tiene
// mensajes» y «no se leyó su historia», que son los dos hechos que la ficha tiene que distinguir.
//
// Todo con un proveedor de mentira: acá se mide la mecánica del candado, no el CRM.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas } from '../apoyo/conexiones.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { ANTIRREBOTE_MS, conElPulso, leerPulso, NO_CORRIO } from '../../lib/negocio/pulso.ts';
import { pendientesDeRevision, revisarEntregas } from '../../lib/negocio/entregas.ts';

let admin: Client;
let alfa: string;
let beta: string;

before(async () => {
  admin = await conectar('admin');
  const orgs = await filas<{ id: string; slug: string }>(
    admin,
    `select id, slug from identidad.organizaciones where slug in ('alfa','beta') order by slug`,
  );
  assert.equal(orgs.length, 2, 'hacen falta las dos organizaciones cliente del sembrado');
  alfa = orgs[0]!.id;
  beta = orgs[1]!.id;
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

/** Por el camino del INQUILINO: si hiciera falta el propietario, los permisos estarían mal. */
async function limpiar(): Promise<void> {
  for (const org of [alfa, beta]) {
    await conOrganizacion(org, async () => {
      await datos().deleteFrom('ingesta_pulso').execute();
    });
  }
}

/** Un cierre corriente, para no repetirlo en cada prueba. */
function cierre(marcaEl: Date | null, extra: Record<string, unknown> = {}) {
  return { marcaEl, llamadas: 1, atrasado: false, fallo: null, ...extra };
}

const T = (iso: string) => new Date(iso);

/** Deja el antirrebote atrás sin dormir: se envejece la marca de la corrida anterior. */
async function envejecerCorrida(org: string): Promise<void> {
  await conOrganizacion(org, async () => {
    await datos()
      .updateTable('ingesta_pulso')
      .set({ ultima_corrida_el: new Date(Date.now() - ANTIRREBOTE_MS - 5_000) })
      .where('clave', '=', 'mensajes')
      .execute();
  });
}

// ─── 1 · El candado ─────────────────────────────────────────────────────────

test('el primer ciclo corre, y arranca sin marca: se empieza por el principio', async () => {
  await limpiar();
  let vioLaMarca: unknown = 'no corrió';
  const r = await conElPulso(alfa, 'mensajes', async (pulso) => {
    vioLaMarca = pulso.marcaEl;
    return { cierre: cierre(T('2025-01-01T00:00:00Z')), resultado: 'listo' };
  });

  assert.equal(r.corrio, true);
  assert.equal(vioLaMarca, null, 'la primera corrida no puede recibir una marca inventada');
  const p = await leerPulso(alfa, 'mensajes');
  assert.equal(p?.marca_el?.toISOString(), '2025-01-01T00:00:00.000Z');
  assert.equal(Number(p?.corridas), 1);
});

test('un ciclo que arrancó ya cortó el paso al siguiente, aunque siga trabajando', async () => {
  await limpiar();
  // Se arranca el primero y se lo deja bloqueando DENTRO de su trabajo hasta que el segundo termine
  // de intentarlo. El tiempo de espera está para que un interbloqueo se vea como fallo y no como
  // cuelgue: si el diseño esperara en vez de irse, esto no terminaría nunca.
  //
  // Lo que frena al segundo acá es el ALQUILER, no el candado — el primero ya confirmó y soltó la
  // fila antes de ponerse a trabajar. El candado se mide aparte, abajo.
  let soltar: () => void = () => {};
  const trabajando = new Promise<void>((res) => {
    soltar = res;
  });
  let primeroEntro: () => void = () => {};
  const entro = new Promise<void>((res) => {
    primeroEntro = res;
  });

  const primero = conElPulso(alfa, 'mensajes', async () => {
    primeroEntro();
    await trabajando;
    return { cierre: cierre(T('2025-02-01T00:00:00Z')), resultado: 'primero' };
  });

  await entro;
  const segundo = await Promise.race([
    conElPulso(alfa, 'mensajes', async () => ({
      cierre: cierre(T('2025-03-01T00:00:00Z')),
      resultado: 'segundo',
    })),
    new Promise((_, rej) => setTimeout(() => rej(new Error('se quedó esperando')), 5_000)),
  ]);

  soltar();
  await primero;

  assert.deepEqual(segundo, { corrio: false, porque: NO_CORRIO.reciente });
  const p = await leerPulso(alfa, 'mensajes');
  assert.equal(Number(p?.corridas), 1, 'el segundo no tenía que llegar a contarse');
});

test('EL CANDADO: con la fila tomada por otra transacción, el ciclo se va en vez de esperar', async () => {
  // Éste es el caso que el alquiler NO puede cubrir: dos ciclos que entran a la vez, antes de que
  // ninguno haya estampado nada. Sin `skipLocked` los dos leerían la marca vieja, los dos pasarían
  // el antirrebote, y los dos correrían.
  //
  // Se simula tomando la fila desde una conexión aparte, que es lo que hace el otro ciclo durante
  // los milisegundos de su reclamo. El tiempo de espera es lo que distingue *irse* de *encolarse*:
  // con `.forUpdate()` a secas esto se quedaría esperando y la prueba fallaría por tiempo.
  await limpiar();
  await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-06-01T00:00:00Z')),
    resultado: 'para que exista la fila',
  }));
  await envejecerCorrida(alfa);

  const otro = await conectar('inquilino');
  try {
    await otro.query('begin');
    await otro.query(`select set_config('app.org_id', $1, true)`, [alfa]);
    await otro.query(
      `select 1 from negocio.ingesta_pulso where clave = 'mensajes' for update`,
    );

    const r = await Promise.race([
      conElPulso(alfa, 'mensajes', async () => ({
        cierre: cierre(T('2025-09-09T00:00:00Z')),
        resultado: 'no tendría que llegar acá',
      })),
      new Promise((_, rej) => setTimeout(() => rej(new Error('se encoló en vez de irse')), 5_000)),
    ]);
    assert.deepEqual(r, { corrio: false, porque: NO_CORRIO.ocupado });
  } finally {
    await otro.query('rollback');
    await otro.end();
  }

  // Y lo más importante: no escribió nada. Un ciclo rechazado que igual toca la marca sería peor
  // que no tener candado, porque parecería que lo hay.
  const p = await leerPulso(alfa, 'mensajes');
  assert.equal(p?.marca_el?.toISOString(), '2025-06-01T00:00:00.000Z');
});

test('el segundo ciclo SEGUIDO también se va: el candado no cubre las corridas consecutivas', async () => {
  await limpiar();
  const a = await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-02-01T00:00:00Z')),
    resultado: 'a',
  }));
  assert.equal(a.corrio, true);

  // Ya no hay nadie adentro: el candado está libre. Lo único que puede impedir el segundo ciclo
  // es el antirrebote.
  const b = await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-03-01T00:00:00Z')),
    resultado: 'b',
  }));
  assert.deepEqual(b, { corrio: false, porque: NO_CORRIO.reciente });

  const p = await leerPulso(alfa, 'mensajes');
  assert.equal(Number(p?.corridas), 1, 'el segundo ciclo no tenía que contarse');
});

test('pasado el antirrebote sí corre de nuevo', async () => {
  await limpiar();
  await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-02-01T00:00:00Z')),
    resultado: 'a',
  }));
  await envejecerCorrida(alfa);

  const b = await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-03-01T00:00:00Z')),
    resultado: 'b',
  }));
  assert.equal(b.corrio, true);
  const p = await leerPulso(alfa, 'mensajes');
  assert.equal(Number(p?.corridas), 2);
});

test('el candado es POR EMPRESA: una no le pisa el ciclo a la otra', async () => {
  // Sin esto, una organización activa dejaría a las demás sin ingesta, y el síntoma sería
  // *"a algunos clientes no les llegan los mensajes"* sin ningún error en ningún lado.
  await limpiar();
  const a = await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-02-01T00:00:00Z')),
    resultado: 'a',
  }));
  const b = await conElPulso(beta, 'mensajes', async () => ({
    cierre: cierre(T('2025-02-01T00:00:00Z')),
    resultado: 'b',
  }));
  assert.equal(a.corrio, true);
  assert.equal(b.corrio, true);
});

// ─── 2 · Las marcas ─────────────────────────────────────────────────────────

test('la marca NUNCA retrocede, aunque un ciclo la cierre más atrás', async () => {
  // EL caso que rompe todo: un ciclo lento que termina después de uno rápido. Pisando el avance
  // del rápido, las conversaciones del medio quedan por debajo de la marca y **nadie las vuelve a
  // mirar**. Es una pérdida de datos silenciosa, y es la razón de que el `update` use `greatest`.
  await limpiar();
  await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-06-01T00:00:00Z')),
    resultado: 'rápido',
  }));
  await envejecerCorrida(alfa);
  await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-01-01T00:00:00Z')),
    resultado: 'lento',
  }));

  const p = await leerPulso(alfa, 'mensajes');
  assert.equal(p?.marca_el?.toISOString(), '2025-06-01T00:00:00.000Z');
});

test('un ciclo que no completó nada deja la marca donde estaba', async () => {
  // `marcaEl: null` significa «no terminé ninguna conversación», no «volvé al principio». Si esto
  // borrara la marca, un solo ciclo sin trabajo reingeriría la cuenta entera.
  await limpiar();
  await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-06-01T00:00:00Z')),
    resultado: 'a',
  }));
  await envejecerCorrida(alfa);
  await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(null),
    resultado: 'sin trabajo',
  }));

  const p = await leerPulso(alfa, 'mensajes');
  assert.equal(p?.marca_el?.toISOString(), '2025-06-01T00:00:00.000Z');
});

test('un ciclo que LANZA no mueve la marca, y deja el fallo anotado', async () => {
  await limpiar();
  await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-06-01T00:00:00Z')),
    resultado: 'a',
  }));
  await envejecerCorrida(alfa);

  await assert.rejects(
    conElPulso(alfa, 'mensajes', async () => {
      throw new Error('el proveedor se cayó');
    }),
    /el proveedor se cayó/,
  );

  const p = await leerPulso(alfa, 'mensajes');
  assert.equal(p?.marca_el?.toISOString(), '2025-06-01T00:00:00.000Z');
  assert.equal(p?.ultimo_fallo, 'el proveedor se cayó');
  assert.ok(p?.ultimo_fallo_el, 'un fallo sin fecha no se puede ordenar ni descartar por viejo');
  // Y queda ATRASADO: una cola incompleta tiene que decir que lo está.
  assert.equal(p?.atrasado, true);
});

test('el piso se escribe UNA vez y no se mueve', async () => {
  // Moverlo correría la frontera entre «no tiene mensajes» y «no se leyó su historia». La ficha
  // dice cosas distintas según cuál sea, y decirlo mal manda a alguien a llamar a un cliente
  // creyendo que nunca contestó.
  await limpiar();
  await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-06-01T00:00:00Z'), { marcaDesdeEl: T('2024-01-01T00:00:00Z') }),
    resultado: 'a',
  }));
  await envejecerCorrida(alfa);
  await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-07-01T00:00:00Z'), { marcaDesdeEl: T('2025-05-05T00:00:00Z') }),
    resultado: 'b',
  }));

  const p = await leerPulso(alfa, 'mensajes');
  assert.equal(p?.marca_desde_el?.toISOString(), '2024-01-01T00:00:00.000Z');
});

// ─── 3 · La contabilidad del coste ──────────────────────────────────────────

test('las llamadas se acumulan: el presupuesto es una medición y no una intención', async () => {
  await limpiar();
  await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-06-01T00:00:00Z'), { llamadas: 1 }),
    resultado: 'a',
  }));
  await envejecerCorrida(alfa);
  await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-07-01T00:00:00Z'), { llamadas: 7 }),
    resultado: 'b',
  }));

  const p = await leerPulso(alfa, 'mensajes');
  assert.equal(Number(p?.llamadas_acumuladas), 8);
  assert.equal(p?.ultima_corrida_llamadas, 7, 'la última tiene que ser la última, no la suma');
  assert.equal(Number(p?.corridas), 2);
});

test('un ciclo limpio BORRA el fallo anterior', async () => {
  // Un fallo viejo que no se limpia hace que la fila diga para siempre que algo anda mal, y eso
  // es como se aprende a ignorar un indicador.
  await limpiar();
  await assert.rejects(
    conElPulso(alfa, 'mensajes', async () => {
      throw new Error('caída pasajera');
    }),
  );
  await envejecerCorrida(alfa);
  await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-06-01T00:00:00Z')),
    resultado: 'ok',
  }));

  const p = await leerPulso(alfa, 'mensajes');
  assert.equal(p?.ultimo_fallo, null);
  assert.equal(p?.atrasado, false);
});

// ─── 4 · El aislamiento ─────────────────────────────────────────────────────

test('el pulso de una empresa no se ve desde la otra', async () => {
  // La tabla lleva `aplicar_aislamiento`, así que esto tendría que ser cierto por construcción.
  // Se mide igual: es la clase de garantía que se rompe al agregar una columna o una vista y no
  // avisa de ninguna manera.
  await limpiar();
  await conElPulso(alfa, 'mensajes', async () => ({
    cierre: cierre(T('2025-06-01T00:00:00Z')),
    resultado: 'a',
  }));

  assert.ok(await leerPulso(alfa, 'mensajes'), 'alfa tiene que ver el suyo');
  assert.equal(await leerPulso(beta, 'mensajes'), undefined, 'beta no puede ver el de alfa');
});

// ═══ 5 · La cola de la tercera pasada ═══════════════════════════════════════
//
// Los tres recortes de `lib/negocio/entregas.ts` viven en una sola consulta, y equivocarse en
// cualquiera de ellos **no da error**: da una cola que no se vacía nunca y una factura que crece
// sola. Son dos llamadas por ciclo, indefinidamente, contra un servicio que cobra por llamada.

/** Un contacto y un mensaje saliente por el camino real. `org_id` lo inyecta la capa fina. */
async function mensajeSaliente(
  org: string,
  extra: Record<string, unknown>,
): Promise<string> {
  return conOrganizacion(org, async () => {
    const c = await datos()
      .selectFrom('contactos')
      .select('id')
      .limit(1)
      .executeTakeFirst();
    const contactoId =
      c?.id ??
      (
        await datos()
          .insertInto('contactos')
          .values({
            ghl_contact_id: `ghl-entregas-${Math.random().toString(36).slice(2)}`,
            nombre: 'Contacto de entregas',
            territorio: 'closer',
          } as never)
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;

    const m = await datos()
      .insertInto('mensajes')
      .values({
        ghl_mensaje_id: `m-${Math.random().toString(36).slice(2)}`,
        contacto_id: contactoId,
        direccion: 'saliente',
        cuerpo: 'algo',
        autor: 'persona',
        enviado_el: new Date(),
        estado_entrega_familia: 'en_curso',
        id_fabricado: false,
        origen: 'propio',
        ...extra,
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return m.id;
  });
}

async function limpiarMensajes(): Promise<void> {
  for (const org of [alfa, beta]) {
    await conOrganizacion(org, async () => {
      await datos().deleteFrom('mensajes').execute();
      await datos().deleteFrom('contactos').execute();
    });
  }
}

test('un identificador FABRICADO no entra nunca en la cola', async () => {
  // El gasto silencioso más caro que podía tener este diseño. Cuando el envío no devuelve
  // identificador se inventa uno; preguntarle al CRM por él devuelve 400 —medido— para siempre.
  // Sin este recorte son dos llamadas por ciclo, indefinidamente, y la cola no se vacía nunca.
  await limpiarMensajes();
  await mensajeSaliente(alfa, { id_fabricado: true });
  const cola = await pendientesDeRevision(alfa);
  assert.deepEqual(cola, [], 'un id fabricado en la cola es una factura que crece sola');
});

test('solo los EN CURSO: lo resuelto no se vuelve a preguntar', async () => {
  await limpiarMensajes();
  const enCurso = await mensajeSaliente(alfa, { estado_entrega_familia: 'en_curso' });
  await mensajeSaliente(alfa, { estado_entrega_familia: 'entregado', estado_entrega: 'delivered' });
  await mensajeSaliente(alfa, { estado_entrega_familia: 'fallido', estado_entrega: 'failed' });
  // Y `desconocido` tampoco: el CRM contestó algo que no supimos clasificar, y repreguntar por un
  // valor que no entendemos es gastar llamadas para siempre.
  await mensajeSaliente(alfa, { estado_entrega_familia: 'desconocido' });

  const cola = await pendientesDeRevision(alfa);
  assert.deepEqual(
    cola.map((m) => m.id),
    [enCurso],
  );
});

test('un ENTRANTE no se revisa: no hay nada que entregar', async () => {
  await limpiarMensajes();
  await mensajeSaliente(alfa, { direccion: 'entrante', autor: 'contacto' });
  assert.deepEqual(await pendientesDeRevision(alfa), []);
});

test('pasada la ventana de una hora se deja de preguntar', async () => {
  // Un mensaje que sigue sin resolverse después de una hora casi seguro no se va a resolver, y
  // seguir preguntando es pagar por nada. Queda `en_curso`, que la pantalla lee como «enviado» —
  // que es exactamente lo que se sabe de él.
  await limpiarMensajes();
  const ahora = new Date();
  const reciente = await mensajeSaliente(alfa, {
    enviado_el: new Date(ahora.getTime() - 30 * 60_000),
  });
  await mensajeSaliente(alfa, { enviado_el: new Date(ahora.getTime() - 90 * 60_000) });

  const cola = await pendientesDeRevision(alfa, ahora);
  assert.deepEqual(
    cola.map((m) => m.id),
    [reciente],
  );
});

test('primero los NUNCA revisados, y después el más viejo', async () => {
  // Con cualquier otro orden, los dos mismos mensajes se revisarían una y otra vez mientras el
  // resto **no se mira nunca**. Es inanición, y no da ningún error: la cola simplemente no avanza.
  await limpiarMensajes();
  const ahora = new Date();
  const revisadoHaceRato = await mensajeSaliente(alfa, {
    enviado_el: new Date(ahora.getTime() - 20 * 60_000),
    estado_entrega_revisado_el: new Date(ahora.getTime() - 10 * 60_000),
  });
  /* EL NUNCA REVISADO ES EL MÁS VIEJO DE LOS TRES, y eso es lo que hace que esta prueba sirva.
     Con él siendo el más nuevo, un orden por `enviado_el desc` daba exactamente la misma respuesta
     y la mutación quedaba invisible — el arnés lo encontró. Ahora cualquier orden que mire la fecha
     de envío en vez del sello de revisión lo manda al fondo y la prueba falla. */
  const nuncaRevisado = await mensajeSaliente(alfa, {
    enviado_el: new Date(ahora.getTime() - 45 * 60_000),
    estado_entrega_revisado_el: null,
  });
  const revisadoReciEn = await mensajeSaliente(alfa, {
    enviado_el: new Date(ahora.getTime() - 25 * 60_000),
    estado_entrega_revisado_el: new Date(ahora.getTime() - 60_000),
  });

  const cola = await pendientesDeRevision(alfa, ahora);
  // Dos por ciclo, y en este orden: el que nunca se miró primero, después el mirado hace más rato.
  assert.deepEqual(
    cola.map((m) => m.id),
    [nuncaRevisado, revisadoHaceRato],
  );
  assert.ok(!cola.some((m) => m.id === revisadoReciEn), 'el recién mirado no va primero');
});

test('la cola se corta en dos por ciclo', async () => {
  await limpiarMensajes();
  for (let i = 0; i < 5; i++) await mensajeSaliente(alfa, {});
  assert.equal((await pendientesDeRevision(alfa)).length, 2);
});

test('la cola de una empresa no ve los mensajes de la otra', async () => {
  await limpiarMensajes();
  await mensajeSaliente(alfa, {});
  assert.equal((await pendientesDeRevision(alfa)).length, 1);
  assert.deepEqual(await pendientesDeRevision(beta), []);
});

// ═══ 6 · El bucle de revisión, con un proveedor de mentira ══════════════════

/** Un CRM de mentira. Devuelve lo que se le diga, y cuenta a quién le preguntaron. */
function crmQueResponde(porId: Record<string, unknown>) {
  const preguntados: string[] = [];
  const fn = async (_acceso: { token: string }, id: string) => {
    preguntados.push(id);
    const r = porId[id];
    if (r === undefined) return { tipo: 'datos' as const, datos: null };
    return r as never;
  };
  return { fn, preguntados };
}

const conEstado = (estado: string | null) => ({
  tipo: 'datos' as const,
  datos: {
    id: 'x',
    conversacionId: null,
    contactId: null,
    cuerpo: null,
    direccion: 'outbound',
    tipo: 'TYPE_WHATSAPP',
    canal: 'WhatsApp',
    estado,
    enviadoEl: new Date(),
    usuarioId: null,
    fuente: null,
  },
});

async function estadoDe(id: string) {
  return conOrganizacion(alfa, async () =>
    datos()
      .selectFrom('mensajes')
      .select([
        'estado_entrega',
        'estado_entrega_familia',
        'fallo_del_canal',
        'estado_entrega_revisado_el',
      ])
      .where('id', '=', id)
      .executeTakeFirst(),
  );
}

test('un saliente que el canal RECHAZÓ queda en rojo, con el motivo', async () => {
  // El defecto entero, cerrado: la llamada devolvió éxito, el CRM aceptó el mensaje, y el canal lo
  // rechazó después. Esta pasada es lo único que lo descubre.
  await limpiarMensajes();
  const id = await mensajeSaliente(alfa, { ghl_mensaje_id: 'ghl-1' });
  const crm = crmQueResponde({ 'ghl-1': conEstado('failed') });

  const r = await revisarEntregas(alfa, { token: 't' }, crm.fn);

  assert.deepEqual(crm.preguntados, ['ghl-1']);
  assert.equal(r.resueltos, 1);
  assert.equal(r.llamadas, 1);
  const m = await estadoDe(id);
  assert.equal(m?.estado_entrega_familia, 'fallido');
  assert.equal(m?.estado_entrega, 'failed');
  assert.ok(m?.fallo_del_canal, 'sin motivo, la burbuja en rojo solo dice que algo salió mal');
});

test('y uno entregado sale de la cola', async () => {
  await limpiarMensajes();
  const id = await mensajeSaliente(alfa, { ghl_mensaje_id: 'ghl-2' });
  await revisarEntregas(alfa, { token: 't' }, crmQueResponde({ 'ghl-2': conEstado('delivered') }).fn);

  const m = await estadoDe(id);
  assert.equal(m?.estado_entrega_familia, 'entregado');
  assert.equal(m?.fallo_del_canal, null, 'un entregado no puede quedar con un motivo de fallo');
  assert.deepEqual(await pendientesDeRevision(alfa), []);
});

test('EL SELLO SE ESTAMPA AUNQUE NADA CAMBIE: es lo único que hace avanzar la cola', async () => {
  // Sin esto, los dos primeros de la lista se revisan en cada ciclo **para siempre** y el resto no
  // se mira nunca. No da ningún error: la cola simplemente no avanza, y son dos llamadas por ciclo
  // gastadas en los mismos dos mensajes.
  await limpiarMensajes();
  const a = await mensajeSaliente(alfa, { ghl_mensaje_id: 'ghl-a' });
  const b = await mensajeSaliente(alfa, { ghl_mensaje_id: 'ghl-b' });
  const c = await mensajeSaliente(alfa, { ghl_mensaje_id: 'ghl-c' });

  // El CRM contesta `sent`: sigue EN CURSO, así que nada cambia de familia.
  const crm = crmQueResponde({
    'ghl-a': conEstado('sent'),
    'ghl-b': conEstado('sent'),
    'ghl-c': conEstado('sent'),
  });

  const r1 = await revisarEntregas(alfa, { token: 't' }, crm.fn);
  assert.equal(r1.resueltos, 0, 'nada se resolvió, que es justo el caso que importa');

  /* Los dos primeros quedaron sellados, así que el ciclo siguiente ARRANCA POR EL TERCERO.
     Se afirma el primero y no la lista entera: los tres siguen sin resolverse —el CRM contestó
     `sent`, que es `en_curso`— así que la cola de dos sigue trayendo dos. Lo que tiene que haber
     cambiado es POR CUÁL empieza. */
  const cola = await pendientesDeRevision(alfa);
  assert.equal(
    cola[0]?.id,
    c,
    'la cola no avanzó: los mismos dos se van a revisar para siempre y el tercero nunca',
  );
  assert.equal(r1.llamadas, 2, 'se revisaron dos, que es el tope del ciclo');
  for (const id of [a, b]) {
    assert.ok((await estadoDe(id))?.estado_entrega_revisado_el, 'quedó sin sellar');
  }
});

test('un identificador que el CRM no reconoce sale de la cola, no se reintenta', async () => {
  // Es un HECHO, no un fallo: preguntar de nuevo no lo va a cambiar. Dejarlo `en_curso` lo traería
  // en cada ciclo, indefinidamente, por una respuesta que ya se sabe.
  await limpiarMensajes();
  const id = await mensajeSaliente(alfa, { ghl_mensaje_id: 'ghl-fantasma' });
  const r = await revisarEntregas(alfa, { token: 't' }, crmQueResponde({}).fn);

  assert.equal(r.desconocidos, 1);
  assert.equal((await estadoDe(id))?.estado_entrega_familia, 'desconocido');
  assert.deepEqual(await pendientesDeRevision(alfa), []);
});

test('si el proveedor falla, se corta el ciclo y NO se sella al que no se pudo preguntar', async () => {
  // Sellarlo lo mandaría al fondo de la cola por un problema que no es suyo. Y seguir preguntando
  // es gastar el resto del presupuesto en el mismo error.
  await limpiarMensajes();
  const a = await mensajeSaliente(alfa, { ghl_mensaje_id: 'ghl-x' });
  await mensajeSaliente(alfa, { ghl_mensaje_id: 'ghl-y' });

  const crm = crmQueResponde({
    'ghl-x': { tipo: 'fallo', fallo: { tipo: 'sin_respuesta', causa: 'se cayó' } },
    'ghl-y': conEstado('delivered'),
  });
  const r = await revisarEntregas(alfa, { token: 't' }, crm.fn);

  assert.equal(r.llamadas, 1, 'se cortó en el primero en vez de insistir');
  assert.deepEqual(crm.preguntados, ['ghl-x'], 'no se preguntó por el segundo');
  assert.equal(
    (await estadoDe(a))?.estado_entrega_revisado_el,
    null,
    'no se pudo preguntar: no se puede dar por revisado',
  );
});

test('la revisión no toca los mensajes de otra empresa', async () => {
  await limpiarMensajes();
  await mensajeSaliente(beta, { ghl_mensaje_id: 'ghl-de-beta' });
  const crm = crmQueResponde({ 'ghl-de-beta': conEstado('failed') });
  const r = await revisarEntregas(alfa, { token: 't' }, crm.fn);
  assert.equal(r.llamadas, 0);
  assert.deepEqual(crm.preguntados, []);
});
