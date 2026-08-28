// La ruta que RECIBE los avisos de GoHighLevel. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES LA PRIMERA RUTA DE ESTE SISTEMA QUE RECIBE DATOS SIN SESIÓN
//
// Hasta ahora las dos rutas sin sesión —`/api/cron` y `/api/sonda`— son DISPARADORES: alguien las
// llama y nosotros trabajamos con nuestros propios datos. Ésta recibe contenido de afuera, en un
// sistema multi-inquilino. Así que las pruebas de acá no son sobre «¿funciona?» sino sobre **qué NO
// puede pasar**, y el orden importa: la primera es la más importante de todas.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { POST as recibirAviso } from '../../app/api/avisos/crm/route.ts';
import { interpretarAviso } from '../../lib/negocio/avisoDelCrm.ts';

const MARCA = 'aviso-crm-prueba';
const PIMIENTA = 'pimienta-de-prueba-no-usar';

let admin: Client;
let alfa: string;
let beta: string;
/** El secreto en claro de cada empresa. El hash es lo que va a la base. */
let secretoAlfa: string;
let secretoBeta: string;
let pimientaPrevia: string | undefined;
/** El estado de la fila de credenciales ANTES de esta prueba. `null` = no existía. Ver el `before`. */
const filaPrevia = new Map<string, { hash: string | null } | null>();

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

before(async () => {
  admin = await conectar('admin');
  pimientaPrevia = process.env.AVISO_PIMIENTA;
  process.env.AVISO_PIMIENTA = PIMIENTA;

  const orgs = await filas<{ id: string; slug: string }>(
    admin,
    `select id, slug from identidad.organizaciones where slug in ('alfa','beta') order by slug`,
  );
  assert.equal(orgs.length, 2, 'faltan las dos organizaciones del sembrado');
  alfa = orgs[0]!.id;
  beta = orgs[1]!.id;

  await barrer();

  /* Cada empresa con SU secreto. Es lo que permite la prueba que más importa: que el secreto de una
     no pueda escribir en la otra, ni siquiera diciendo en el cuerpo que es de la otra. */
  secretoAlfa = randomBytes(24).toString('base64url');
  secretoBeta = randomBytes(24).toString('base64url');
  for (const [org, secreto] of [
    [alfa, secretoAlfa],
    [beta, secretoBeta],
  ] as const) {
    /* ── SE RECUERDA SI LA FILA YA EXISTÍA, Y ESO ARREGLA UNA PRUEBA INTERMITENTE ──
     *
     * `pruebas/base/20-invariantes.test.ts` hace un `insert` LIMPIO en esta misma tabla para `alfa` y
     * espera que funcione, porque su último paso lo borra. Si este archivo deja la fila puesta, esa
     * prueba falla con un duplicado — y encima su propio `finally` borra la fila, así que la corrida
     * SIGUIENTE pasa. Una intermitente que se arregla sola es la peor de las dos: se atribuye a
     * cualquier cosa.
     *
     * Ocurrió de verdad acá: las corridas de mutación cortan el proceso a mitad, y una fila que quedó
     * puesta puso roja a `20-invariantes` en la corrida siguiente.
     *
     * Así que se anota el estado previo y el `after` lo restaura exacto: si la fila no estaba, se
     * borra; si estaba, se le devuelve su hash anterior. */
    const previa = await unaFila<{ aviso_secreto_hash: string | null }>(
      admin,
      `select aviso_secreto_hash from identidad.organizaciones_credenciales where org_id = $1`,
      [org],
    );
    filaPrevia.set(org, previa === undefined ? null : { hash: previa.aviso_secreto_hash });

    await admin.query(
      `insert into identidad.organizaciones_credenciales (org_id, aviso_secreto_hash)
         values ($1, $2)
       on conflict (org_id) do update set aviso_secreto_hash = excluded.aviso_secreto_hash`,
      [org, sha256(secreto)],
    );
  }
});

after(async () => {
  await barrer();
  /* Se restaura el estado EXACTO de antes, no «algo parecido». Dejar el hash en nulo pero la fila
     puesta es lo que ponía intermitente a `20-invariantes` — ver el `before`. */
  for (const [org, previa] of filaPrevia) {
    if (previa === null) {
      await admin.query(`delete from identidad.organizaciones_credenciales where org_id = $1`, [org]);
    } else {
      await admin.query(
        `update identidad.organizaciones_credenciales set aviso_secreto_hash = $2 where org_id = $1`,
        [org, previa.hash],
      );
    }
  }
  if (pimientaPrevia === undefined) delete process.env.AVISO_PIMIENTA;
  else process.env.AVISO_PIMIENTA = pimientaPrevia;
  await cerrarTodo();
  await cerrarClientes();
});

async function barrer(): Promise<void> {
  await admin.query(`delete from negocio.avisos_del_crm where cuerpo like $1`, [`%${MARCA}%`]);
}

/** Una petición como la que manda GoHighLevel: cabecera de dos mitades y el evento en la URL. */
function pedir(
  opciones: {
    evento?: string | null;
    secreto?: string;
    pimienta?: string;
    cabecera?: string;
    cuerpo?: unknown;
    crudo?: string;
    conLargo?: boolean;
  } = {},
): Request {
  const url = new URL('https://ejemplo.test/api/avisos/crm');
  if (opciones.evento !== null && opciones.evento !== undefined) {
    url.searchParams.set('evento', opciones.evento);
  }
  const cabeceras: Record<string, string> = { 'content-type': 'application/json' };
  const cabecera =
    opciones.cabecera ??
    `${opciones.pimienta ?? PIMIENTA}.${opciones.secreto ?? secretoAlfa}`;
  if (cabecera !== '') cabeceras['x-webhook-secret'] = cabecera;

  const cuerpo = opciones.crudo ?? JSON.stringify(opciones.cuerpo ?? {});
  // Sin `content-length`: `fetch`/`Request` lo pone solo con un string. Para probar el camino
  // `chunked` hace falta un `ReadableStream`, y eso lo hace el caso que lo necesita.
  return new Request(url, { method: 'POST', headers: cabeceras, body: cuerpo });
}

const leer = async (r: Response) => ({ estado: r.status, cuerpo: await r.json() });

/** Las filas de cuarentena de una empresa. */
async function enCuarentena(org: string): Promise<
  { evento: string | null; atribucion: string; repeticiones: number; procesado: boolean; error: string | null }[]
> {
  return (
    await filas<{
      evento: string | null;
      atribucion: string;
      repeticiones: number;
      procesado_el: Date | null;
      error: string | null;
    }>(
      admin,
      `select evento, atribucion, repeticiones, procesado_el, error
         from negocio.avisos_del_crm where org_id = $1 and cuerpo like $2
        order by recibido_el`,
      [org, `%${MARCA}%`],
    )
  ).map((f) => ({
    evento: f.evento,
    atribucion: f.atribucion,
    repeticiones: Number(f.repeticiones),
    procesado: f.procesado_el !== null,
    error: f.error,
  }));
}

/** Un cuerpo con la forma real de GoHighLevel: el `locationId` va ANIDADO. */
const cuerpoDe = (location: string | null, extra: Record<string, unknown> = {}) => ({
  // La marca va en el cuerpo porque es por lo que se barre: la tabla no tiene otra columna nuestra.
  marca: MARCA,
  ...(location === null ? {} : { location: { id: location } }),
  ...extra,
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LA PRUEBA QUE MÁS IMPORTA
// ═══════════════════════════════════════════════════════════════════════════════

test('el secreto de UNA empresa no puede escribir en OTRA, ni diciendo en el cuerpo que es de la otra', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // ESTO ES LO QUE LA PLATAFORMA ANTERIOR NO PODÍA GARANTIZAR
  //
  // Allá la empresa se resolvía por el `locationId` DEL CUERPO. O sea que el workflow de la empresa A
  // —o cualquiera con su secreto— podía inyectar eventos a nombre de B con solo cambiar un campo del
  // payload. Su propio archivo de atribución lo dice: *«el costo es parsear JSON de alguien que
  // todavía no se autenticó»*.
  //
  // Acá la empresa sale del SECRETO. El `locationId` del cuerpo solo se compara, y cuando no coincide
  // queda anotado como `discordante` — que es información útil (un workflow mal copiado) y no una
  // decisión de ruteo.
  //
  // Se escribe primera porque es la que mata el diseño de la referencia si se copia tal cual.
  // ═══════════════════════════════════════════════════════════════════════════
  await barrer();
  const locationDeBeta = `loc-de-beta-${randomUUID().slice(0, 8)}`;

  const r = await leer(
    await recibirAviso(
      pedir({
        evento: 'contacto.actualizado',
        secreto: secretoAlfa,
        cuerpo: cuerpoDe(locationDeBeta, { contactId: 'no-existe-en-el-crm' }),
      }),
    ),
  );
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));

  const deAlfa = await enCuarentena(alfa);
  const deBeta = await enCuarentena(beta);

  assert.equal(deAlfa.length, 1, 'el aviso no quedó en la empresa DEL SECRETO');
  assert.equal(
    deAlfa[0]?.atribucion,
    'discordante',
    'el cuerpo traía el `locationId` de otra empresa y no quedó marcado: sin esa marca, un workflow ' +
      'apuntando a la URL equivocada es invisible',
  );
  assert.equal(
    deBeta.length,
    0,
    'EL AVISO ENTRÓ A LA EMPRESA QUE DECÍA EL CUERPO. El aislamiento no puede depender de que el ' +
      'payload diga la verdad: eso es una fuga que se dispara con cambiar un campo',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LOS RECHAZOS SON INDISTINGUIBLES ENTRE SÍ
// ═══════════════════════════════════════════════════════════════════════════════

test('los cuatro rechazos responden el MISMO código y el MISMO cuerpo, byte por byte', async () => {
  /* `ADR-0501`: si se distinguieran, esta ruta sería un enumerador. Con un bucle y la diferencia entre
     «secreto inválido» y «empresa desactivada» se puede averiguar qué secretos existen y qué empresas
     están activas — sin autenticarse. */
  await barrer();
  const cuerpo = cuerpoDe('cualquiera');

  const casos: [string, Request][] = [
    ['sin la cabecera', pedir({ cabecera: '', cuerpo })],
    ['pimienta inválida', pedir({ pimienta: 'no-es-la-pimienta', cuerpo })],
    ['secreto desconocido', pedir({ secreto: randomBytes(24).toString('base64url'), cuerpo })],
    ['sin la mitad del secreto', pedir({ cabecera: PIMIENTA, cuerpo })],
  ];

  const respuestas: { nombre: string; estado: number; cuerpo: unknown }[] = [];
  for (const [nombre, peticion] of casos) {
    const r = await leer(await recibirAviso(peticion));
    respuestas.push({ nombre, ...r });
  }

  /* Y EL QUINTO CASO: una empresa DESACTIVADA con su secreto VÁLIDO.
   *
   * Se agregó porque sobrevivió a la mutación. Los cuatro de arriba fallan la autenticación; éste la
   * PASA y se rechaza por otro motivo, así que es el único que puede responder distinto sin que se
   * note — y si respondiera distinto, un bucle sobre secretos válidos diría qué empresas están
   * activas, que es información de negocio de otro cliente. */
  await admin.query(`update identidad.organizaciones set activa = false where id = $1`, [beta]);
  try {
    const desactivada = await leer(await recibirAviso(pedir({ secreto: secretoBeta, cuerpo })));
    respuestas.push({ nombre: 'empresa desactivada, con secreto válido', ...desactivada });
  } finally {
    await admin.query(`update identidad.organizaciones set activa = true where id = $1`, [beta]);
  }

  for (const r of respuestas) {
    assert.equal(r.estado, 403, `«${r.nombre}» respondió ${r.estado} y no 403`);
    assert.deepEqual(
      { estado: r.estado, cuerpo: r.cuerpo },
      { estado: respuestas[0]!.estado, cuerpo: respuestas[0]!.cuerpo },
      `«${r.nombre}» responde distinto que «${respuestas[0]!.nombre}»: la ruta se volvió un oráculo`,
    );
  }

  // Y NINGUNO escribió una fila. Un rechazo que igual guarda es un rechazo que consume base.
  assert.equal((await enCuarentena(alfa)).length, 0, 'un rechazo dejó una fila');
  assert.equal((await enCuarentena(beta)).length, 0);

  // Ningún cuerpo de respuesta menciona una tabla, una columna ni una variable (`ADR-0704`).
  const texto = JSON.stringify(respuestas.map((r) => r.cuerpo));
  for (const prohibido of ['aviso_secreto', 'avisos_del_crm', 'AVISO_PIMIENTA', 'org_id']) {
    assert.equal(texto.includes(prohibido), false, `la respuesta menciona «${prohibido}»`);
  }
});

test('SIN la pimienta configurada en el servidor se rechaza TODO', async () => {
  /* La misma decisión que `/api/cron` toma con `CRON_SECRET`, y por el mismo motivo: sin el guardia,
     la comparación sería contra `undefined` y cualquiera la pasaría mandando la cadena vacía.
     Falla CERRADO: es lo contrario de «abrir la puerta por ahora». */
  await barrer();
  const previa = process.env.AVISO_PIMIENTA;
  delete process.env.AVISO_PIMIENTA;
  try {
    const r = await leer(await recibirAviso(pedir({ cuerpo: cuerpoDe('x') })));
    assert.equal(r.estado, 403, 'sin la pimienta configurada la ruta aceptó un aviso');
    assert.equal((await enCuarentena(alfa)).length, 0);
  } finally {
    process.env.AVISO_PIMIENTA = previa;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL CAMINO FELIZ, Y LO QUE NO CUESTA
// ═══════════════════════════════════════════════════════════════════════════════

test('un aviso válido se guarda CRUDO, con su evento y su tamaño', async () => {
  await barrer();
  const cuerpo = cuerpoDe('loc-alfa', { contactId: 'nadie', message: { body: 'hola' } });

  const r = await leer(
    await recibirAviso(pedir({ evento: 'mensaje.entrante', cuerpo })),
  );
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));

  const guardadas = await enCuarentena(alfa);
  assert.equal(guardadas.length, 1, 'no se guardó el aviso');
  assert.equal(guardadas[0]?.evento, 'mensaje.entrante', 'no se guardó el `?evento=` de la URL');

  // El cuerpo entra CRUDO y byte por byte: es lo que permite reprocesar cuando el mapeo mejore, y lo
  // que hace que la huella sea estable.
  const fila = await unaFila<{ cuerpo: string; bytes: number }>(
    admin,
    `select cuerpo, bytes from negocio.avisos_del_crm where org_id = $1 and cuerpo like $2`,
    [alfa, `%${MARCA}%`],
  );
  assert.equal(fila?.cuerpo, JSON.stringify(cuerpo), 'el cuerpo se guardó normalizado, no crudo');
  assert.equal(fila?.bytes, Buffer.byteLength(JSON.stringify(cuerpo)), 'el tamaño no es el real');
});

test('el MISMO cuerpo dos veces deja UNA fila, con `repeticiones` en 2', async () => {
  /* GoHighLevel **admite entregas duplicadas** — es la razón por la que el cron de este repositorio
     está escrito como reconciliación y no como cola. Sin idempotencia, cada reentrega es una fila más
     y, aguas abajo, un mensaje repetido en el chat.
     `do update` y no `do nothing`: con `do nothing` una reentrega sería INVISIBLE, y no se podría ver
     que un workflow está disparando de más. */
  await barrer();
  const cuerpo = cuerpoDe('loc-alfa', { contactId: 'nadie' });

  await recibirAviso(pedir({ evento: 'contacto.actualizado', cuerpo }));
  await recibirAviso(pedir({ evento: 'contacto.actualizado', cuerpo }));

  const guardadas = await enCuarentena(alfa);
  assert.equal(guardadas.length, 1, `quedaron ${guardadas.length} filas para el mismo cuerpo`);
  assert.equal(guardadas[0]?.repeticiones, 2, 'la reentrega quedó invisible: `repeticiones` no subió');
});

test('un cuerpo que NO es JSON se guarda igual, marcado `ilegible`, y responde 200', async () => {
  /* Descartarlo sería perder la única evidencia de que el proveedor cambió de forma. Y responder 400
     haría que GoHighLevel reintentara para siempre y terminara desactivando el workflow — o sea que
     el castigo por un cambio de formato del proveedor sería quedarse sin avisos de nada. */
  await barrer();
  const r = await leer(
    await recibirAviso(pedir({ evento: 'mensaje.entrante', crudo: `esto no es json ${MARCA}` })),
  );
  assert.equal(r.estado, 200, 'un cuerpo ilegible se rechazó en vez de guardarse');

  const guardadas = await enCuarentena(alfa);
  assert.equal(guardadas.length, 1, 'el cuerpo ilegible se descartó');
  assert.equal(guardadas[0]?.atribucion, 'ilegible');
  assert.equal(guardadas[0]?.procesado, false, 'un cuerpo ilegible se marcó como procesado');
});

test('la URL SIN `?evento=` guarda y NO procesa, que es la trampa documentada', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // EL ÚNICO ERROR SILENCIOSO QUE LA PLATAFORMA ANTERIOR DOCUMENTÓ DE SU PANEL
  //
  // Alguien pega la URL base sin el parámetro. GoHighLevel entrega, nosotros guardamos, respondemos
  // 200, y el aviso **no se interpreta nunca**. No hay error, no hay reintento, y la pantalla no
  // dibuja nada distinto: el aviso está 100 % inerte mientras cada mensaje sigue entrando por el
  // sondeo con hasta diez minutos de retraso.
  //
  // Esta prueba fija que la fila quede SIN procesar y CON su motivo, que es lo que le da algo que
  // contar al monitor. Sin el motivo, «no llega nada» y «llega y se descarta» comparten el silencio,
  // y son dos investigaciones completamente distintas.
  // ═══════════════════════════════════════════════════════════════════════════
  await barrer();
  const r = await leer(
    await recibirAviso(pedir({ evento: null, cuerpo: cuerpoDe('loc-alfa', { contactId: 'x' }) })),
  );
  assert.equal(r.estado, 200);

  const guardadas = await enCuarentena(alfa);
  assert.equal(guardadas.length, 1, 'sin `?evento=` no se guardó nada: se perdió la evidencia');
  assert.equal(guardadas[0]?.evento, null);
  assert.equal(guardadas[0]?.procesado, false, 'se marcó como procesado un aviso que no se interpretó');
  assert.notEqual(
    guardadas[0]?.error,
    null,
    'la fila quedó sin motivo: el monitor no tiene con qué distinguir «no llega» de «llega y se descarta»',
  );

  // Y un `?evento=` INVENTADO hace lo mismo: no es un error, es un workflow que todavía no sabemos
  // interpretar.
  await barrer();
  await recibirAviso(pedir({ evento: 'mensaje_entrante', cuerpo: cuerpoDe('loc-alfa', { contactId: 'x' }) }));
  const conGuionBajo = await enCuarentena(alfa);
  assert.equal(conGuionBajo.length, 1);
  assert.equal(
    conGuionBajo[0]?.procesado,
    false,
    '`mensaje_entrante` con guion bajo se procesó: el nombre correcto lleva punto, y aceptar los dos ' +
      'esconde el error de configuración en vez de mostrarlo',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL TAMAÑO
// ═══════════════════════════════════════════════════════════════════════════════

test('un cuerpo sobre el tope se rechaza con 413, y también sin `content-length`', async () => {
  /* El atajo de `content-length` **no puede ser la defensa**: lo escribe el cliente, y con
     `Transfer-Encoding: chunked` la cabecera no existe. Este caso manda el cuerpo por un
     `ReadableStream` justamente para que el atajo no sirva y tenga que actuar el lector acotado.

     El tope real es 64 KiB, y sale de una medición: el cuerpo más grande del buzón de la plataforma
     anterior era de 29.936 bytes (una llamada con su transcripción completa). */
  await barrer();
  const relleno = 'x'.repeat(70 * 1024);
  const crudo = JSON.stringify({ marca: MARCA, relleno });

  // (a) Con `content-length`, que lo pone `Request` solo.
  const conLargo = await leer(await recibirAviso(pedir({ evento: 'mensaje.entrante', crudo })));
  assert.equal(conLargo.estado, 413, 'un cuerpo de 70 KiB con `content-length` no se rechazó');

  // (b) Y por flujo, SIN `content-length`.
  const flujo = new ReadableStream<Uint8Array>({
    start(c) {
      const bytes = new TextEncoder().encode(crudo);
      // En trozos, como llega de verdad.
      for (let i = 0; i < bytes.length; i += 8 * 1024) c.enqueue(bytes.slice(i, i + 8 * 1024));
      c.close();
    },
  });
  const url = new URL('https://ejemplo.test/api/avisos/crm?evento=mensaje.entrante');
  const sinLargo = await leer(
    await recibirAviso(
      new Request(url, {
        method: 'POST',
        headers: { 'x-webhook-secret': `${PIMIENTA}.${secretoAlfa}`, 'content-type': 'application/json' },
        body: flujo,
        // @ts-expect-error `duplex` es obligatorio con un cuerpo de flujo y no está en los tipos de Node.
        duplex: 'half',
      }),
    ),
  );
  assert.equal(
    sinLargo.estado,
    413,
    'un cuerpo grande SIN `content-length` pasó: el atajo de la cabecera era la única defensa, y esa ' +
      'cabecera la escribe quien llama',
  );

  assert.equal((await enCuarentena(alfa)).length, 0, 'un cuerpo rechazado por tamaño dejó una fila');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LO QUE NO CUESTA
// ═══════════════════════════════════════════════════════════════════════════════

test('un aviso NO toca la marca de agua ni los contadores de la ingesta', async () => {
  /* Las dos cosas serían errores concretos:
       · el antirrebote del candado significa «no correr», y para un aviso eso es descartar un cuerpo
         que YA llegó;
       · `marca_el` se escribe con `greatest(...)`, así que empujarla declararía ingerido todo lo
         anterior y saltearía en silencio las conversaciones que el sondeo no alcanzó.
     Se comprueba sobre la fila del pulso, que es donde las dos viven. */
  await barrer();
  const antes = await filas<{ clave: string; marca_el: Date | null; llamadas_acumuladas: string }>(
    admin,
    `select clave, marca_el, llamadas_acumuladas::text from negocio.ingesta_pulso where org_id = $1 order by clave`,
    [alfa],
  );

  await recibirAviso(
    pedir({ evento: 'contacto.actualizado', cuerpo: cuerpoDe('loc-alfa', { contactId: 'nadie' }) }),
  );

  const despues = await filas<{ clave: string; marca_el: Date | null; llamadas_acumuladas: string }>(
    admin,
    `select clave, marca_el, llamadas_acumuladas::text from negocio.ingesta_pulso where org_id = $1 order by clave`,
    [alfa],
  );
  assert.deepEqual(
    despues,
    antes,
    'el aviso movió la fila del pulso: o tomó el candado, o empujó la marca de agua. Lo segundo ' +
      'saltea conversaciones en silencio y no se recupera',
  );
});


// ════════════════════════════════════════════════════════════════════════════════
// 6 · LA INTERPRETACIÓN: EL TERRITORIO Y EL MENSAJE
//
// Todo lo de arriba prueba LA PUERTA. Nada de eso prueba que el aviso haga su trabajo — y hasta acá
// no podía: en una base de pruebas no hay token de GoHighLevel, así que toda llamada al CRM falla y
// `procesado` salía falso SIEMPRE. Las pruebas pasaban por el motivo equivocado, que se descubrió
// mutando la validación del evento: aceptar cualquier cadena dejaba todo en verde.
//
// Por eso `interpretarAviso` recibe su lector de contactos por parámetro. Es la misma costura que
// `barrerCitas` ya usa, y es la que permite probar lo que se pidió: **que al llegar un mensaje el
// sistema sepa si ese contacto va a setter, a closer, o a ninguno**.
// ════════════════════════════════════════════════════════════════════════════════

/** El acceso al CRM que la interpretación necesita. No se usa: el lector está inyectado. */
const ACCESO = { tipo: 'listo' as const, token: 'no-se-usa', locationId: 'loc-alfa' };

/** Un contacto de prueba, con el territorio que se le quiera dar. */
async function unContactoConTerritorio(
  ghlId: string,
  territorio: 'closer' | 'setter' | null,
): Promise<string> {
  const f = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, fuente)
       values ($1, $2, $3, $4, 'manual')
     on conflict (org_id, ghl_contact_id) do update set territorio = excluded.territorio
     returning id`,
    [alfa, ghlId, `${MARCA} contacto`, territorio],
  );
  assert.ok(f);
  return f.id;
}

test('un mensaje entrante de un contacto DEL CLOSER dice `closer`, y escribe la fila del chat', async () => {
  /* El caso central de lo que se pidió. Y el territorio no se recalcula acá: sale de la caché, que el
     cron relee cada diez minutos con la MISMA precedencia que la sincronización completa. Un segundo
     criterio sería un lugar donde divergir, y el síntoma un contacto en las dos pestañas o en ninguna. */
  const ghlId = `${MARCA}-closer-${randomUUID().slice(0, 8)}`;
  const contactoId = await unContactoConTerritorio(ghlId, 'closer');
  try {
    const r = await interpretarAviso(
      alfa,
      ACCESO,
      'mensaje.entrante',
      { marca: MARCA, contactId: ghlId, message: { body: 'Hola, quiero información' } },
      // El lector NO se llama: el contacto ya está en la caché. Si se llamara, esto lo delata.
      async () => {
        throw new Error('no tenía que preguntarle al CRM: el contacto ya estaba en la caché');
      },
    );

    assert.equal(r.tipo, 'listo', JSON.stringify(r));
    assert.equal(r.tipo === 'listo' && r.territorio, 'closer', 'no resolvió el territorio del contacto');
    assert.equal(r.tipo === 'listo' && r.mensaje, true, 'no escribió el mensaje');

    /* Y la fila del chat, con las tres marcas que importan:
         · `origen = 'aviso'` — primera vez que ese valor del `check` de la 013 se escribe;
         · `id_fabricado = true` — es lo que le dice a la regla del gemelo que ceda ante la fila real
           cuando el sondeo traiga el mismo mensaje con su identificador de verdad;
         · `direccion = 'entrante'` y el autor es el CONTACTO, que es el único autor que un aviso puede
           afirmar sin depender de campos que su payload no manda. */
    const fila = await unaFila<{
      origen: string;
      id_fabricado: boolean;
      direccion: string;
      autor: string;
      cuerpo: string | null;
    }>(
      admin,
      `select origen, id_fabricado, direccion, autor, cuerpo from negocio.mensajes
        where contacto_id = $1`,
      [contactoId],
    );
    assert.ok(fila, 'no quedó la fila del mensaje');
    assert.equal(fila.origen, 'aviso');
    assert.equal(fila.id_fabricado, true, 'el mensaje del aviso no se marcó fabricado: se va a duplicar');
    assert.equal(fila.direccion, 'entrante');
    assert.equal(fila.autor, 'contacto');
    assert.equal(fila.cuerpo, 'Hola, quiero información');

    /* Y NO fijó la frontera de cobertura: trae UN mensaje, así que afirmar «desde acá la conversación
       está completa» sería falso — y esa columna se escribe una vez y para siempre. */
    const piso = await unaFila<{ mensajes_desde_el: Date | null }>(
      admin,
      `select mensajes_desde_el from negocio.contactos where id = $1`,
      [contactoId],
    );
    assert.equal(
      piso?.mensajes_desde_el,
      null,
      'el aviso fijó la frontera de cobertura con un solo mensaje: la ficha va a afirmar una historia ' +
        'que no tiene, y no hay forma de corregirlo después',
    );
  } finally {
    await admin.query(`delete from negocio.mensajes where contacto_id = $1`, [contactoId]);
    await admin.query(`delete from negocio.contactos where id = $1`, [contactoId]);
  }
});

test('un contacto SIN territorio dice `null`: no aparece en ninguna pestaña, y se dice', async () => {
  /* La tercera respuesta que se pidió —«o si ni siquiera aparece en ninguno»— y es un estado legítimo:
     un contacto que perdió sus dos etiquetas de zona. Devolver `'closer'` por omisión sería meterlo en
     la cola de trabajo de alguien; devolver un error sería perder su mensaje. */
  const ghlId = `${MARCA}-sin-zona-${randomUUID().slice(0, 8)}`;
  const contactoId = await unContactoConTerritorio(ghlId, null);
  try {
    const r = await interpretarAviso(
      alfa,
      ACCESO,
      'mensaje.entrante',
      { marca: MARCA, contactId: ghlId, message: 'sigo esperando' },
      async () => {
        throw new Error('no tenía que preguntarle al CRM');
      },
    );
    assert.equal(r.tipo, 'listo');
    assert.equal(r.tipo === 'listo' && r.territorio, null, 'un contacto sin zona no devolvió `null`');
    // Y el mensaje se guardó igual: no aparecer en una pestaña no es motivo para perder lo que dijo.
    const n = await filas(admin, `select id from negocio.mensajes where contacto_id = $1`, [contactoId]);
    assert.equal(n.length, 1, 'se perdió el mensaje de un contacto sin territorio');
    // El texto sale del `message` como CADENA SUELTA, que es una de las dos formas medidas.
    const f = await unaFila<{ cuerpo: string | null }>(
      admin,
      `select cuerpo from negocio.mensajes where contacto_id = $1`,
      [contactoId],
    );
    assert.equal(f?.cuerpo, 'sigo esperando', '`message` como cadena suelta no se leyó');
  } finally {
    await admin.query(`delete from negocio.mensajes where contacto_id = $1`, [contactoId]);
    await admin.query(`delete from negocio.contactos where id = $1`, [contactoId]);
  }
});

test('un contacto NUEVO SÍ se le pregunta al CRM, y de ahi sale su territorio', async () => {
  /* La «red de seguridad del alta» de la plataforma anterior. Sin ella, un lead que escribe antes de
     que el cron lo traiga entra sin territorio, no aparece en ninguna pestaña, y **su mensaje se
     pierde**: la marca de agua de la ingesta pasa sobre las conversaciones de contactos desconocidos.

     Acá el lector inyectado simula lo que hace el de verdad: crea el contacto y devuelve su
     territorio. */
  const ghlId = `${MARCA}-nuevo-${randomUUID().slice(0, 8)}`;
  let pedidos = 0;
  try {
    const r = await interpretarAviso(
      alfa,
      ACCESO,
      'mensaje.entrante',
      { marca: MARCA, contactId: ghlId, body: 'primera vez que escribo' },
      async () => {
        pedidos += 1;
        await unContactoConTerritorio(ghlId, 'setter');
        return { tipo: 'listo', territorio: 'setter' };
      },
    );
    assert.equal(pedidos, 1, 'a un contacto que NO está en la caché no se le preguntó al CRM');
    assert.equal(r.tipo, 'listo', JSON.stringify(r));
    assert.equal(r.tipo === 'listo' && r.territorio, 'setter');

    const f = await unaFila<{ id: string }>(
      admin,
      `select id from negocio.contactos where org_id = $1 and ghl_contact_id = $2`,
      [alfa, ghlId],
    );
    assert.ok(f, 'el contacto nuevo no quedó en la base');
    const n = await filas(admin, `select id from negocio.mensajes where contacto_id = $1`, [f.id]);
    assert.equal(n.length, 1, 'el mensaje del contacto nuevo no se guardó');
  } finally {
    await admin.query(
      `delete from negocio.mensajes where contacto_id in
         (select id from negocio.contactos where ghl_contact_id = $1)`,
      [ghlId],
    );
    await admin.query(`delete from negocio.contactos where ghl_contact_id = $1`, [ghlId]);
  }
});

test('un evento con guion bajo NO se interpreta, y eso se prueba sin depender del CRM', async () => {
  /* Sobrevivió a la mutación: aceptar cualquier cadena como evento dejaba todo en verde, porque el
     camino terminaba fallando por falta de credencial y no por la validación. Con el lector inyectado
     —que lanza si lo llaman— la validación es lo ÚNICO que puede cortar. */
  for (const malo of ['mensaje_entrante', 'MENSAJE.ENTRANTE', 'mensaje.entrante ', '', 'cualquier.cosa']) {
    const r = await interpretarAviso(
      alfa,
      ACCESO,
      malo,
      { marca: MARCA, contactId: 'x' },
      async () => {
        throw new Error(`se interpretó el evento «${malo}», que no está en el catálogo`);
      },
    );
    assert.equal(r.tipo, 'desconocido', `«${malo}» se aceptó como evento válido`);
  }

  // Y el nombre correcto SÍ pasa la validación: sin esta mitad, un `return 'desconocido'` fijo
  // pasaría el bucle de arriba y el aviso no interpretaría nada nunca.
  const bueno = await interpretarAviso(
    alfa,
    ACCESO,
    'contacto.actualizado',
    { marca: MARCA, contactId: `${MARCA}-valido` },
    async () => ({ tipo: 'no_esta_en_el_crm' }),
  );
  assert.notEqual(bueno.tipo, 'desconocido', 'el evento correcto se rechazó como desconocido');
});

test('un cuerpo SIN contacto en ninguna de sus tres formas se dice, y no se inventa', async () => {
  const r = await interpretarAviso(alfa, ACCESO, 'mensaje.entrante', { marca: MARCA }, async () => {
    throw new Error('no había contacto que buscar');
  });
  assert.equal(r.tipo, 'sin_contacto');

  // Y las TRES formas se aceptan. `contact.id` anidado es la que uno no escribiría.
  for (const forma of [
    { contactId: 'a' },
    { contact_id: 'b' },
    { contact: { id: 'c' } },
  ] as Record<string, unknown>[]) {
    const leido = await interpretarAviso(
      alfa,
      ACCESO,
      'contacto.actualizado',
      { marca: MARCA, ...forma },
      async () => ({ tipo: 'no_esta_en_el_crm' }),
    );
    assert.notEqual(
      leido.tipo,
      'sin_contacto',
      `no se leyó el contacto de la forma ${JSON.stringify(forma)}: el día que GoHighLevel cambie de ` +
        'payload se corta la ingesta entera',
    );
  }
});
