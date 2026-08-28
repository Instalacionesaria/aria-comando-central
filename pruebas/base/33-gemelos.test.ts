// La regla del GEMELO: un mensaje, una fila. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTE ARCHIVO FIJA, Y ESTABA EN PANTALLA
//
// `lib/negocio/ingesta.ts` abría diciendo *«EL único escritor de `negocio.mensajes`»* y era falso: el
// `POST` del chat insertaba directo. La cadena, verificada línea por línea:
//
//   1. Mandamos un mensaje y GoHighLevel **puede no devolver el identificador**
//      (`lib/ghl/conversaciones.ts:406`). La ruta entonces fabrica uno, `propio:<id>:<epoch>`, y lo
//      marca `id_fabricado: true`.
//   2. La ingesta después trae esa conversación, y trae **también los salientes**
//      (`lib/negocio/ingesta.ts:309`), con el identificador REAL.
//   3. `unique (org_id, ghl_mensaje_id)` no salta: un fabricado no puede colisionar con un real.
//   4. → **dos filas para un mensaje**, las dos dibujadas en el chat.
//
// Sin error, sin registro, sin contador. Se lee como que alguien lo mandó dos veces.
//
// ── POR QUÉ LA REGLA ES ASIMÉTRICA, Y POR QUÉ ESO ES LO QUE HAY QUE PROBAR ───
//
// La regla obvia —«si ya existe uno igual, no insertes»— **colapsa mensajes legítimos**: dos «ok» a
// tres minutos son dos mensajes. Así que la regla mira el ORIGEN del identificador:
//
//   · un fabricado NO entra si su gemelo real ya está;
//   · un real, al entrar, BORRA los fabricados equivalentes y HEREDA su atribución;
//   · nunca real ↔ real.
//
// Los seis casos de abajo existen porque cada uno mata una forma distinta de escribirla mal, y las
// formas mal escritas **funcionan** en el caso feliz. Cada `test` dice cuál mata.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { escribirMensajes, VENTANA_DEL_GEMELO_MS, type FilaDeMensaje } from '../../lib/negocio/mensajes.ts';

const MARCA = 'gemelos-prueba';

let admin: Client;
let alfa: string;
let contactoId: string;
let quien: string;

before(async () => {
  admin = await conectar('admin');
  const o = await unaFila<{ id: string }>(
    admin,
    `select id from identidad.organizaciones where slug = 'alfa'`,
  );
  assert.ok(o, 'falta la organización `alfa` del sembrado');
  alfa = o.id;

  const u = await unaFila<{ id: string }>(
    admin,
    `select id from identidad.usuarios where email = 'ana@alfa.ejemplo'`,
  );
  assert.ok(u, 'falta ana del sembrado');
  quien = u.id;

  await barrer();
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, fuente)
       values ($1, $2, 'Contacto de gemelos', 'closer', 'manual') returning id`,
    [alfa, `${MARCA}-${randomUUID().slice(0, 8)}`],
  );
  assert.ok(c);
  contactoId = c.id;
});

after(async () => {
  await barrer();
  await cerrarTodo();
  await cerrarClientes();
});

/** Se barre por MARCA en los DOS extremos: una corrida cortada no puede envenenar la siguiente. */
async function barrer(): Promise<void> {
  const patron = `${MARCA}-%`;
  await admin.query(
    `delete from negocio.mensajes where contacto_id in
       (select id from negocio.contactos where ghl_contact_id like $1)`,
    [patron],
  );
  await admin.query(`delete from negocio.contactos where ghl_contact_id like $1`, [patron]);
}

/** El estado de la conversación de este contacto: lo que el chat dibujaría. */
async function enElChat(): Promise<
  { id: string; ghl: string; cuerpo: string | null; origen: string; autor: string; usuario: string | null; fabricado: boolean }[]
> {
  return (
    await filas<{
      id: string;
      ghl_mensaje_id: string;
      cuerpo: string | null;
      origen: string;
      autor: string;
      autor_usuario_id: string | null;
      id_fabricado: boolean;
    }>(
      admin,
      `select id, ghl_mensaje_id, cuerpo, origen, autor, autor_usuario_id, id_fabricado
         from negocio.mensajes where contacto_id = $1 order by enviado_el, ghl_mensaje_id`,
      [contactoId],
    )
  ).map((f) => ({
    id: f.id,
    ghl: f.ghl_mensaje_id,
    cuerpo: f.cuerpo,
    origen: f.origen,
    autor: f.autor,
    usuario: f.autor_usuario_id,
    fabricado: f.id_fabricado,
  }));
}

async function vaciar(): Promise<void> {
  await admin.query(`delete from negocio.mensajes where contacto_id = $1`, [contactoId]);
  await admin.query(`update negocio.contactos set mensajes_desde_el = null where id = $1`, [
    contactoId,
  ]);
}

/** Una fila lista para escribir. Los valores por omisión son los del caso normal. */
function fila(campos: Partial<FilaDeMensaje> & { ghl_mensaje_id: string }): FilaDeMensaje {
  return {
    ghl_conversacion_id: `${MARCA}-conv`,
    contacto_id: contactoId,
    canal: 'WhatsApp',
    direccion: 'saliente',
    cuerpo: 'Buenas, te escribo por la propuesta',
    autor: 'agente',
    enviado_el: new Date('2026-08-20T15:00:00Z'),
    estado_entrega: null,
    estado_entrega_familia: 'en_curso',
    estado_entrega_revisado_el: null,
    estado_entrega_el: null,
    id_fabricado: false,
    origen: 'ingesta',
    ...campos,
  };
}

/** El fabricado tal como lo escribe el `POST` del chat: persona, con su identificador de usuario. */
const DEL_CHAT = (cuando: Date, cuerpo?: string): FilaDeMensaje =>
  fila({
    ghl_mensaje_id: `propio:${contactoId}:${cuando.getTime()}`,
    id_fabricado: true,
    origen: 'propio',
    autor: 'persona',
    autor_usuario_id: quien,
    enviado_el: cuando,
    ...(cuerpo === undefined ? {} : { cuerpo }),
  });

const MINUTO = 60 * 1000;

// ═══════════════════════════════════════════════════════════════════════════════

test('1 · fabricado y después el real: UNA fila, con el identificador real y la atribución HEREDADA', async () => {
  // El caso de producción, en su orden habitual: mandamos el mensaje, y la ingesta lo trae después.
  //
  // MATA DOS COSAS. La primera, no tener regla: quedaban dos filas. La segunda, y es la que importa
  // más: **quitar la herencia**. La ingesta escribe `autor: 'agente'` para todo saliente sin fuente
  // (`ingesta.ts:371-373`), así que un reemplazo sin herencia convierte el mensaje que escribió una
  // persona —con su nombre— en uno del agente de IA. Eso no es una fila repetida: es una atribución
  // falsa en el historial de una conversación con un cliente, y nadie la puede detectar después.
  await vaciar();
  const cuando = new Date('2026-08-20T15:00:00Z');

  await escribirMensajes(alfa, [DEL_CHAT(cuando)], { fijarPiso: false });
  const solo = await enElChat();
  assert.equal(solo.length, 1, 'el fabricado no se escribió');
  assert.equal(solo[0]?.fabricado, true);

  const r = await escribirMensajes(
    alfa,
    [fila({ ghl_mensaje_id: `${MARCA}-real-1`, enviado_el: new Date(cuando.getTime() + 2 * MINUTO) })],
    { fijarPiso: true },
  );
  assert.equal(r.gemelos, 1, 'no reconoció el gemelo');

  const despues = await enElChat();
  assert.equal(
    despues.length,
    1,
    `quedaron ${despues.length} filas para UN mensaje: ${JSON.stringify(despues.map((x) => x.ghl))}`,
  );
  assert.equal(despues[0]?.ghl, `${MARCA}-real-1`, 'sobrevivió el fabricado en vez del real');
  assert.equal(despues[0]?.fabricado, false);
  // LA HERENCIA, que es la mitad que no se ve fallar.
  assert.equal(despues[0]?.origen, 'propio', 'el real no heredó `origen`: la métrica pasa a medir quién llegó primero');
  assert.equal(despues[0]?.autor, 'persona', 'el real no heredó `autor`: el mensaje pasó a ser del agente de IA');
  assert.equal(despues[0]?.usuario, quien, 'el real no heredó `autor_usuario_id`: el mensaje perdió su firma');
});

test('2 · el real PRIMERO y el fabricado después: UNA fila, y no se inserta el fabricado', async () => {
  // La otra dirección, y ocurre de verdad: la ingesta puede correr entre que GoHighLevel acepta el
  // mensaje y que nuestra fila se guarda.
  //
  // MATA implementar MEDIA regla. Con solo «el real borra al fabricado», este caso deja dos filas
  // — y es exactamente el caso que el orden de las operaciones vuelve más probable.
  await vaciar();
  const cuando = new Date('2026-08-20T16:00:00Z');

  await escribirMensajes(alfa, [fila({ ghl_mensaje_id: `${MARCA}-real-2`, enviado_el: cuando })], {
    fijarPiso: true,
  });
  const r = await escribirMensajes(alfa, [DEL_CHAT(new Date(cuando.getTime() + MINUTO))], {
    fijarPiso: false,
  });
  assert.equal(r.gemelos, 1, 'no reconoció que su gemelo real ya estaba');

  const despues = await enElChat();
  assert.equal(despues.length, 1, `quedaron ${despues.length} filas`);
  assert.equal(despues[0]?.ghl, `${MARCA}-real-2`);

  /* Y el REPRESENTANTE apunta al real. Sin esto, la ruta del chat le devolvería `id: null` a la
     pantalla y el mensaje se vería como que no quedó guardado — cuando quedó. */
  const suId = r.representantes.get(`propio:${contactoId}:${cuando.getTime() + MINUTO}`);
  assert.equal(suId?.id, despues[0]?.id, 'el representante no apunta a la fila que existe');
});

test('3 · DOS reales con el MISMO texto a tres minutos: DOS filas', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // LA PRUEBA MÁS IMPORTANTE DEL ARCHIVO
  //
  // Mata escribir la regla como «¿ya existe uno igual?», que es la primera que a cualquiera se le
  // ocurre y que **pasa los dos casos de arriba**. Con esa regla, dos «ok» a tres minutos se
  // convierten en uno — y esa gente escribe así todo el día.
  //
  // O sea: la regla ingenua arregla el duplicado visible y PIERDE mensajes en silencio, que es un
  // cambio a peor. La asimetría es lo único que separa las dos cosas.
  // ═══════════════════════════════════════════════════════════════════════════
  await vaciar();
  const cuando = new Date('2026-08-20T17:00:00Z');

  const r = await escribirMensajes(
    alfa,
    [
      fila({ ghl_mensaje_id: `${MARCA}-ok-a`, cuerpo: 'ok', enviado_el: cuando }),
      fila({
        ghl_mensaje_id: `${MARCA}-ok-b`,
        cuerpo: 'ok',
        enviado_el: new Date(cuando.getTime() + 3 * MINUTO),
      }),
    ],
    { fijarPiso: true },
  );
  assert.equal(r.gemelos, 0, 'trató dos reales como gemelos: nunca real ↔ real');

  const despues = await enElChat();
  assert.equal(
    despues.length,
    2,
    'dos mensajes reales con el mismo texto quedaron en UNA fila: se perdió un mensaje, y en silencio',
  );

  // Y en un SEGUNDO lote, que es el camino por el que llegan de verdad (dos ciclos distintos).
  await vaciar();
  await escribirMensajes(alfa, [fila({ ghl_mensaje_id: `${MARCA}-ok-c`, cuerpo: 'ok', enviado_el: cuando })], {
    fijarPiso: true,
  });
  await escribirMensajes(
    alfa,
    [fila({ ghl_mensaje_id: `${MARCA}-ok-d`, cuerpo: 'ok', enviado_el: new Date(cuando.getTime() + 3 * MINUTO) })],
    { fijarPiso: true },
  );
  assert.equal((await enElChat()).length, 2, 'dos reales en dos lotes se colapsaron');
});

test('4 · la VENTANA: a nueve minutos es gemelo, a once no', async () => {
  // Los dos bordes, y cuestan cosas distintas. Sin ventana (infinita) un mensaje legítimo de la
  // semana pasada con el mismo texto se come al de hoy. Con ventana cero, el gemelo no se reconoce
  // nunca y vuelve el duplicado.
  //
  // MATA las dos: quitar la comparación de tiempo, y compararla con `0`.
  await vaciar();
  const base = new Date('2026-08-20T18:00:00Z');
  const nueve = 9 * MINUTO;
  const once = 11 * MINUTO;
  assert.ok(nueve < VENTANA_DEL_GEMELO_MS && once > VENTANA_DEL_GEMELO_MS, 'los bordes ya no rodean la ventana');

  await escribirMensajes(alfa, [DEL_CHAT(base)], { fijarPiso: false });
  await escribirMensajes(
    alfa,
    [fila({ ghl_mensaje_id: `${MARCA}-dentro`, enviado_el: new Date(base.getTime() + nueve) })],
    { fijarPiso: true },
  );
  assert.equal((await enElChat()).length, 1, 'a nueve minutos no lo reconoció como gemelo');

  await vaciar();
  await escribirMensajes(alfa, [DEL_CHAT(base)], { fijarPiso: false });
  await escribirMensajes(
    alfa,
    [fila({ ghl_mensaje_id: `${MARCA}-fuera`, enviado_el: new Date(base.getTime() + once) })],
    { fijarPiso: true },
  );
  assert.equal(
    (await enElChat()).length,
    2,
    'a ONCE minutos los unió: un mensaje legítimo con el mismo texto se comió al anterior',
  );
});

test('4b · la ventana se comprueba POR FILA, no solo por el rango de la consulta', async () => {
  // ══════════════════════════════════════════════════════════════════════
  // ESTA PRUEBA EXISTE PORQUE UN MUTANTE SOBREVIVIÓ DOS VECES, Y LA SEGUNDA FUE CULPA DEL DISEÑO
  //
  // Muté `cerca()` para que devolviera SIEMPRE `true` —ventana infinita— y la prueba 4 siguió verde.
  // La ventana está enforzada en DOS lugares y en ese caso mandaba el otro: la consulta de candidatos
  // trae solo `[min(enviado_el del lote) - ventana, max(…) + ventana]`, así que el gemelo a once
  // minutos **nunca llega a la memoria** y `cerca()` no se ejecuta sobre él.
  //
  // Mi primer intento de este caso también falló, y por lo mismo: puse el fabricado ANTES del lote, o
  // sea fuera del rango otra vez. Para que `cerca()` sea lo único que decide, el candidato tiene que
  // estar **dentro del rango del lote** y **lejos de la fila con la que comparte el texto**:
  //
  //     fabricado 'confirmo'   20:00   ← dentro del rango, porque el lote arranca 20:00
  //     lote: 'otra cosa'      20:00
  //           'confirmo'       20:40   ← a CUARENTA minutos del fabricado
  //
  //     rango de la consulta = [19:50, 20:50]  → el fabricado SÍ se trae
  //     cerca(20:00, 20:40)  = 40 min > 10     → y solo esto lo rechaza
  //
  // El caso no es artificial: un lote de la ingesta abarca una conversación entera, y «confirmo»
  // repetido en la misma charla es lo más normal del mundo.
  // ══════════════════════════════════════════════════════════════════════
  await vaciar();
  const base = new Date('2026-08-21T20:00:00Z');

  await escribirMensajes(alfa, [DEL_CHAT(base, 'confirmo')], { fijarPiso: false });

  const r = await escribirMensajes(
    alfa,
    [
      // Esta fila hace que el rango de la consulta ARRANQUE en 20:00 menos la ventana, que es lo que
      // pone al fabricado adentro. Sin ella, el rango lo excluye y la prueba no prueba nada.
      fila({ ghl_mensaje_id: `${MARCA}-ancla`, cuerpo: 'otra cosa', enviado_el: base }),
      fila({
        ghl_mensaje_id: `${MARCA}-lejano`,
        cuerpo: 'confirmo',
        enviado_el: new Date(base.getTime() + 40 * MINUTO),
      }),
    ],
    { fijarPiso: true },
  );
  assert.equal(
    r.gemelos,
    0,
    'unió el «confirmo» de las 20:40 con el fabricado de las 20:00: los dos están dentro del rango de ' +
      'la consulta, así que sin la comparación POR FILA la ventana no existe',
  );

  const despues = await enElChat();
  assert.equal(
    despues.length,
    3,
    `quedaron ${despues.length} filas de 3: se perdió un mensaje a 40 minutos de distancia`,
  );
  assert.equal(despues.filter((x) => x.fabricado).length, 1, 'el fabricado se lo comió un mensaje lejano');
});

test('4c · el gemelo se reconoce con el texto RECORTADO en los dos lados', async () => {
  /* El `POST` del chat guarda `texto.trim()`; la ingesta guarda lo que manda el proveedor, espacios
     incluidos. Sin recortar los dos lados para comparar, un espacio al final hace que el gemelo no se
     reconozca **y vuelve el duplicado que todo este archivo cierra** — con la agravante de que
     dependería de un carácter invisible, así que mirar las dos filas en la pantalla no explicaría nada.

     Sobrevivió a la mutación que quita el `trim`, y por eso este caso existe. */
  await vaciar();
  const cuando = new Date('2026-08-21T21:00:00Z');

  await escribirMensajes(alfa, [DEL_CHAT(cuando, 'Perfecto, quedamos así')], { fijarPiso: false });
  const r = await escribirMensajes(
    alfa,
    [
      fila({
        ghl_mensaje_id: `${MARCA}-con-espacios`,
        // Lo mismo, con un espacio adelante y dos atrás. Es lo que devuelve el proveedor.
        cuerpo: ' Perfecto, quedamos así  ',
        enviado_el: new Date(cuando.getTime() + MINUTO),
      }),
    ],
    { fijarPiso: true },
  );
  assert.equal(
    r.gemelos,
    1,
    'un espacio invisible al final rompió el reconocimiento del gemelo: vuelve el duplicado, y esta ' +
      'vez por un carácter que no se ve en la pantalla',
  );
  assert.equal((await enElChat()).length, 1, 'quedaron dos filas por diferencia de espacios');
});


test('4d · con DOS fabricados candidatos, el real reemplaza al MÁS CERCANO', async () => {
  // ══════════════════════════════════════════════════════════════════════
  // OTRO MUTANTE SOBREVIVIENTE, Y LO QUE PROTEGE NO ES COSMÉTICO
  //
  // Quitar el orden por cercanía —y quedarse con el primero que devuelva la consulta— dejaba todo en
  // verde. Y el defecto que introduce **pierde un mensaje**:
  //
  //     fabricado 'dale'  20:00     ← el que el real de 20:05 NO es
  //     fabricado 'dale'  20:06     ← el gemelo de verdad
  //     real      'dale'  20:05
  //
  // Sin el orden se reemplaza el de 20:00, y queda: el real de 20:05 más el fabricado de 20:06. O sea
  // que el mensaje de las 20:00 **desapareció** y el de las 20:06 sigue sin confirmar para siempre.
  // Con el orden se reemplaza el de 20:06 y queda el de 20:00 intacto, esperando su propio real.
  //
  // Los dos mensajes son reales, escritos por una persona a seis minutos de distancia. Es una charla
  // normal.
  // ══════════════════════════════════════════════════════════════════════
  await vaciar();
  const base = new Date('2026-08-21T22:00:00Z');
  const lejos = base;
  const cerquita = new Date(base.getTime() + 6 * MINUTO);

  // Se insertan EN ESE ORDEN, así que el más viejo es el que la consulta devuelve primero. Es lo que
  // hace que el mutante se equivoque de forma observable en vez de acertar por casualidad.
  await escribirMensajes(alfa, [DEL_CHAT(lejos, 'dale')], { fijarPiso: false });
  await escribirMensajes(alfa, [DEL_CHAT(cerquita, 'dale')], { fijarPiso: false });
  assert.equal((await enElChat()).length, 2, 'los dos fabricados no entraron');

  // El real llega a las 20:05: está a 5 minutos del primero y a 1 del segundo.
  const r = await escribirMensajes(
    alfa,
    [fila({ ghl_mensaje_id: `${MARCA}-cercano`, cuerpo: 'dale', enviado_el: new Date(base.getTime() + 5 * MINUTO) })],
    { fijarPiso: true },
  );
  assert.equal(r.gemelos, 1, 'no reconoció ningún gemelo');

  const despues = await enElChat();
  assert.equal(despues.length, 2, `quedaron ${despues.length} filas de 2`);
  const fabricadosVivos = despues.filter((x) => x.fabricado);
  assert.equal(fabricadosVivos.length, 1, 'se fueron los dos fabricados, o ninguno');
  assert.equal(
    fabricadosVivos[0]?.ghl,
    `propio:${contactoId}:${lejos.getTime()}`,
    'reemplazó el fabricado LEJANO: el mensaje de las 22:00 desapareció del chat y el de las 22:06 ' +
      'se quedó sin poder confirmarse nunca',
  );
});

test('4e · DOS reales del mismo lote NO se reparten el mismo fabricado', async () => {
  /* ── EL ÚLTIMO MUTANTE SOBREVIVIENTE, Y ES UNA ATRIBUCIÓN FALSA ───────────
   *
   * Quitar la guarda de «fabricado ya tomado» dejaba todo en verde. Lo que introduce:
   *
   *     fabricado 'ok'  22:30   ← UNO, escrito por una persona
   *     lote: real 'ok' 22:31   ← el nuestro
   *           real 'ok' 22:32   ← otro, del agente de IA
   *
   * Sin la guarda, los DOS reales heredan `origen: 'propio'` y `autor: 'persona'` del único fabricado
   * — así que el mensaje que mandó el agente queda firmado por una persona, con su identificador de
   * usuario. No es una fila de más: es el historial de una conversación con un cliente diciendo que
   * alguien escribió algo que no escribió.
   *
   * Y el borrado se ejecutaría dos veces sobre la misma fila, que es inocuo y esconde el problema. */
  await vaciar();
  const base = new Date('2026-08-21T22:30:00Z');

  await escribirMensajes(alfa, [DEL_CHAT(base, 'ok')], { fijarPiso: false });
  const r = await escribirMensajes(
    alfa,
    [
      fila({ ghl_mensaje_id: `${MARCA}-real-uno`, cuerpo: 'ok', enviado_el: new Date(base.getTime() + MINUTO) }),
      fila({ ghl_mensaje_id: `${MARCA}-real-dos`, cuerpo: 'ok', enviado_el: new Date(base.getTime() + 2 * MINUTO) }),
    ],
    { fijarPiso: true },
  );
  assert.equal(r.gemelos, 1, `reconoció ${r.gemelos} gemelos para UN fabricado`);

  const despues = await enElChat();
  assert.equal(despues.length, 2, `quedaron ${despues.length} filas: un fabricado y dos reales son DOS mensajes`);
  const dePersona = despues.filter((x) => x.autor === 'persona');
  assert.equal(
    dePersona.length,
    1,
    'los dos reales heredaron la atribución del único fabricado: un mensaje del agente de IA quedó ' +
      'firmado por una persona, con su identificador de usuario, en el historial de un cliente',
  );
  // Y el otro conserva la suya, que es la mitad que hace que la de arriba no pase por casualidad.
  assert.equal(despues.filter((x) => x.autor === 'agente').length, 1, 'el segundo real perdió su propia atribución');
});

test('5 · `fijarPiso: false` NO escribe la frontera de cobertura, y `true` sí', async () => {
  // `contactos.mensajes_desde_el` significa «desde acá hacia adelante la conversación está completa»
  // y se escribe con `coalesce`: **una vez y para siempre**.
  //
  // MATA cablear el piso adentro del escritor. Si el `POST` del chat —o el webhook— lo fijara con su
  // único mensaje, la ficha afirmaría tener una historia que no tiene, y no habría forma de
  // corregirlo después porque el `coalesce` ya no vuelve a escribir.
  await vaciar();
  const piso = async (): Promise<Date | null> =>
    (
      await unaFila<{ mensajes_desde_el: Date | null }>(
        admin,
        `select mensajes_desde_el from negocio.contactos where id = $1`,
        [contactoId],
      )
    )?.mensajes_desde_el ?? null;

  await escribirMensajes(alfa, [DEL_CHAT(new Date('2026-08-20T19:00:00Z'), 'suelto')], {
    fijarPiso: false,
  });
  assert.equal(
    await piso(),
    null,
    'un escritor de un mensaje suelto fijó la frontera: la ficha va a afirmar una historia que no tiene',
  );

  await escribirMensajes(
    alfa,
    [fila({ ghl_mensaje_id: `${MARCA}-piso`, enviado_el: new Date('2026-08-20T19:30:00Z'), cuerpo: 'del barrido' })],
    { fijarPiso: true },
  );
  assert.notEqual(await piso(), null, 'la ingesta no fijó la frontera: la ficha no puede decir qué falta');
});

test('6 · un lote de VARIOS contactos se rechaza, y no escribe nada a medias', async () => {
  /* La invariante que `fijarPiso` necesita: con filas de varios contactos habría que decidir de cuál
     es el piso, y eso no se decide bien en un bucle.
     MATA saltear las filas ajenas en silencio, que dejaría mensajes sin escribir sin que nada lo
     diga — el peor de los dos comportamientos posibles. */
  await vaciar();
  const otro = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, fuente)
       values ($1, $2, 'Otro de gemelos', 'closer', 'manual') returning id`,
    [alfa, `${MARCA}-otro-${randomUUID().slice(0, 8)}`],
  );
  assert.ok(otro);

  await assert.rejects(
    () =>
      escribirMensajes(
        alfa,
        [
          fila({ ghl_mensaje_id: `${MARCA}-mio` }),
          fila({ ghl_mensaje_id: `${MARCA}-ajeno`, contacto_id: otro.id }),
        ],
        { fijarPiso: true },
      ),
    /mismo contacto/,
    'aceptó un lote de varios contactos',
  );

  // Y NADA quedó escrito: ni la fila propia.
  assert.equal((await enElChat()).length, 0, 'escribió parte del lote rechazado');
  const delOtro = await filas(admin, `select id from negocio.mensajes where contacto_id = $1`, [
    otro.id,
  ]);
  assert.equal(delOtro.length, 0);
});

test('la ingesta y el chat comparten el escritor, y el aislamiento sigue puesto', async () => {
  /* El control de que la extracción no aflojó nada: el escritor abre su propio contexto de
     organización, así que una llamada con el identificador de otra empresa no puede escribir en esta.
     Sin esta prueba, mover el `conOrganizacion(` de lugar durante la extracción pasaría inadvertido. */
  await vaciar();
  const beta = await unaFila<{ id: string }>(
    admin,
    `select id from identidad.organizaciones where slug = 'beta'`,
  );
  assert.ok(beta);

  // Escribir el contacto de ALFA con el contexto de BETA no puede dejar la fila: la política de fila
  // de `negocio.mensajes` la rechaza, o la clave foránea compuesta no encuentra el contacto.
  await assert.rejects(
    () => escribirMensajes(beta.id, [fila({ ghl_mensaje_id: `${MARCA}-cruzado` })], { fijarPiso: false }),
    'una escritura con el contexto de otra empresa no falló',
  );
  assert.equal((await enElChat()).length, 0, 'quedó una fila escrita desde otra organización');

  // Y desde SU organización sí entra, que es lo que hace que la aserción de arriba signifique algo.
  await conOrganizacion(alfa, async () => {
    const n = await datos()
      .selectFrom('mensajes')
      .select(({ fn }) => fn.countAll<string>().as('n'))
      .executeTakeFirst();
    assert.ok(n, 'la consulta del inquilino no corrió');
  });
  await escribirMensajes(alfa, [fila({ ghl_mensaje_id: `${MARCA}-propio-ok` })], { fijarPiso: false });
  assert.equal((await enElChat()).length, 1, 'la escritura legítima no entró');
});
