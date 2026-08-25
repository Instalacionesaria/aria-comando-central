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
