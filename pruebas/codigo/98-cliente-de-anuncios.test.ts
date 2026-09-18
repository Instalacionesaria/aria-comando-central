// El cliente del Ad Manager de GoHighLevel: qué lee, qué descarta y qué reintenta. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTE ARCHIVO NO TENÍA NINGUNA PRUEBA, Y ES EL QUE MÁS SE ROMPE SOLO
//
// `lib/ghl/anuncios.ts` es la frontera con una API ajena que **ya cambió dos formas bajo nuestros
// pies durante la construcción**, y las dos costaron una sonda contra producción:
//
//   · `/reporting/list` devuelve un arreglo PELADO donde `/entity` devuelve `{ data, next }`. Leerlo
//     como `{data}` daba cero filas sin fallar.
//   · El cursor de paginación se llama `next` y NO `after`. Con `after` el proveedor **reserva la
//     misma página**, así que el listado de anuncios se quedaba en 100 de 402 — y la única forma de
//     notarlo fue comparar los identificadores de dos páginas seguidas.
//
// Ninguno de los dos lanza. Los dos devuelven menos datos y siguen. Por eso lo que se prueba acá no
// es «la función anda», es **cómo se comporta ante una respuesta que no es la esperada**.
//
// ── SE INTERCEPTA `globalThis.fetch`, COMO EN EL RESTO DEL REPOSITORIO ─────
//
// Es la única salida del proyecto (`ADR-0305`), y es lo que permite ejercitar el cliente REAL en vez
// de uno inventado para la prueba. Sin esto habría que inyectar un `fetch` por parámetro, o sea
// cambiar la firma de producción para que la prueba pudiera entrar.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  estructuraDeAnuncios,
  integracionDeAnuncios,
  metricasPorAnuncio,
  serieDeLaCuenta,
} from '../../lib/ghl/anuncios.ts';

const ACCESO = { token: 'un-token', locationId: 'una-ubicacion' };

/** Lo que el `fetch` interceptado devolverá, en orden. Cada llamada consume una. */
let respuestas: { estado: number; cuerpo: unknown; cabeceras?: Record<string, string> }[] = [];
/** Las URL que el cliente pidió, en orden. Es lo que permite comprobar la paginación. */
let pedidas: string[] = [];

const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  respuestas = [];
  pedidas = [];
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    pedidas.push(typeof entrada === 'string' ? entrada : String((entrada as Request).url ?? entrada));
    const r = respuestas.shift();
    assert.ok(r, `el cliente pidió más veces de las previstas: ${pedidas[pedidas.length - 1]}`);
    return new Response(JSON.stringify(r.cuerpo), {
      status: r.estado,
      headers: { 'content-type': 'application/json', ...(r.cabeceras ?? {}) },
    });
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

// ─── LAS FILAS QUE NO SE PUEDEN LEER ────────────────────────────────────────

test('una fila sin `adId` se CUENTA, no se descarta en silencio', async () => {
  /* El peor fallo posible de este cliente: que el proveedor renombre la llave. Descartando en
     silencio, se caen TODAS las filas, la pasada reporta éxito y la pantalla queda vacía. */
  respuestas.push({
    estado: 200,
    cuerpo: [
      { adId: '120249633901580467', name: 'El bueno', spend: '10.5', impressions: '100' },
      { ad_id: '120249633901590467', name: 'El de la clave renombrada', spend: '20' },
      { name: 'El que no trae nada' },
    ],
  });

  const r = await metricasPorAnuncio(ACCESO, '120249633901590467', '2026-09-16');
  assert.equal(r.tipo, 'datos');
  if (r.tipo !== 'datos') return;

  assert.equal(r.datos.length, 1, 'se leyó una fila que no tenía `adId`');
  assert.equal(r.ilegibles, 2, 'las filas ilegibles no se contaron: un cambio de clave sería invisible');
  assert.equal(r.datos[0]?.anuncioId, '120249633901580467');
});

test('las siete métricas ausentes llegan NULAS, y las presentes con su valor', async () => {
  /* La regla de los dos ceros, en la frontera donde nace: el proveedor OMITE las claves cuando el
     anuncio no entregó. Un `?? 0` acá destruiría la distinción antes de que nadie pueda verla. */
  respuestas.push({
    estado: 200,
    cuerpo: [
      { adId: 'a1', name: 'Sin entrega', objective: 'OUTCOME_LEADS', campaignId: 'c1', leads: '0' },
      { adId: 'a2', name: 'Con entrega', spend: '69.59', impressions: '12197', clicks: '400', ctr: '3.279495' },
    ],
  });

  const r = await metricasPorAnuncio(ACCESO, 'c1', '2026-09-16');
  assert.equal(r.tipo, 'datos');
  if (r.tipo !== 'datos') return;

  const sin = r.datos.find((m) => m.anuncioId === 'a1');
  assert.equal(sin?.gasto, null, '«no entregó» se guardó como cero');
  assert.equal(sin?.impresiones, null);
  assert.equal(sin?.clics, null);
  assert.equal(sin?.ctr, null);

  const con = r.datos.find((m) => m.anuncioId === 'a2');
  assert.equal(con?.gasto, 69.59);
  assert.equal(con?.impresiones, 12197);
  assert.equal(con?.ctr, 3.279495, 'el CTR perdió decimales al parsear');
});

test('un día es un día: `startDate` y `endDate` son el mismo', async () => {
  /* `groupBy=day` se IGNORA en `/reporting/list`: con un rango devuelve UNA fila por anuncio con el
     total del rango. Medido el 2026-09-16 sobre la campaña `120249590301010467`: 09-10→09-12 da
     `spend 24,3` y 09-11→09-11 da `spend 6,23`. Por eso la firma pide un día y no un rango. */
  respuestas.push({ estado: 200, cuerpo: [] });
  await metricasPorAnuncio(ACCESO, 'c1', '2026-09-16');

  const url = pedidas[0] ?? '';
  assert.match(url, /startDate=2026-09-16/);
  assert.match(url, /endDate=2026-09-16/);
  assert.doesNotMatch(url, /groupBy/, '`groupBy` no hace nada en esta ruta y pedirlo engaña al que lea la URL');
});

// ─── LA PAGINACIÓN, QUE SE QUEDÓ EN 100 DE 402 ──────────────────────────────

test('la estructura sigue el cursor `next` hasta agotarlo', async () => {
  /* El parámetro es `next` y NO `after`: con `after` el proveedor devuelve LA MISMA página, así que
     el listado se quedaba en 100 de 402 anuncios sin que nada fallara. */
  respuestas.push({ estado: 200, cuerpo: { data: [{ adId: 'a1', name: 'uno' }], next: 'cursor-1' } });
  respuestas.push({ estado: 200, cuerpo: { data: [{ adId: 'a2', name: 'dos' }], next: null } });

  const r = await estructuraDeAnuncios(ACCESO, 'AD');
  assert.equal(r.tipo, 'datos');
  if (r.tipo !== 'datos') return;

  assert.equal(r.datos.length, 2, 'no siguió el cursor');
  assert.equal(pedidas.length, 2);
  assert.match(pedidas[1] ?? '', /[?&]next=cursor-1/, 'el cursor viaja como `next`, no como `after`');
});

test('una página que no agrega nada CORTA, aunque el cursor siga viniendo', async () => {
  /* El freno contra el bucle infinito, y es el caso real: con `after` el proveedor reserva la misma
     página y manda cursor otra vez. Sin este corte, veinte páginas idénticas. */
  respuestas.push({ estado: 200, cuerpo: { data: [{ adId: 'a1', name: 'uno' }], next: 'c1' } });
  respuestas.push({ estado: 200, cuerpo: { data: [{ adId: 'a1', name: 'uno' }], next: 'c2' } });

  const r = await estructuraDeAnuncios(ACCESO, 'AD');
  assert.equal(r.tipo, 'datos');
  if (r.tipo !== 'datos') return;

  assert.equal(r.datos.length, 1, 'el mismo anuncio entró dos veces');
  assert.equal(pedidas.length, 2, 'siguió pidiendo páginas que no agregaban nada');
});

// ─── EL 429, QUE ES EL RIESGO DEL COLECTOR ──────────────────────────────────

test('un 429 se REINTENTA, y un 500 no', async () => {
  /* Son dos respuestas distintas y hay que tratarlas distinto: un 429 dice «volvé a intentar» y un
     500 dice que el servidor ya contestó. Reintentar un 500 dentro de la llamada es insistirle a
     alguien que no va a cambiar de opinión — para eso está el reintento del colector, minutos
     después. */
  respuestas.push({ estado: 429, cuerpo: { message: 'slow down' } });
  respuestas.push({ estado: 200, cuerpo: [{ adId: 'a1', name: 'uno' }] });

  const r = await metricasPorAnuncio(ACCESO, 'c1', '2026-09-16');
  assert.equal(r.tipo, 'datos', 'el 429 no se reintentó');
  assert.equal(pedidas.length, 2, 'se esperaba un reintento y sólo hubo una llamada');

  respuestas = [];
  pedidas = [];
  respuestas.push({ estado: 500, cuerpo: { message: 'boom' } });
  const r2 = await metricasPorAnuncio(ACCESO, '888888', '2026-09-16');
  assert.equal(r2.tipo, 'fallo', 'un 500 tiene que fallar, no reintentarse hasta agotar el presupuesto');
  assert.equal(pedidas.length, 1, 'el 500 se reintentó: eso gasta el presupuesto del colector');
});

// ─── EL PASO 0 ──────────────────────────────────────────────────────────────

test('el vínculo con Meta se lee de `status` y `fbAdAccountId`', async () => {
  respuestas.push({
    estado: 200,
    cuerpo: { status: 'connected', fbAdAccountId: 'act_1349863156073553', pages: [{ id: '1' }] },
  });

  const r = await integracionDeAnuncios(ACCESO);
  assert.equal(r.tipo, 'datos');
  if (r.tipo !== 'datos') return;
  assert.equal(r.datos.estado, 'connected');
  assert.equal(r.datos.cuentaId, 'act_1349863156073553');
});

// ─── LA SERIE DE LA CUENTA ──────────────────────────────────────────────────

test('la serie diaria sale de `grouped`, y un día sin `dateStart` se descarta', async () => {
  /* La única llamada que devuelve CPM, y la que sirve de comprobación contra la suma por anuncio.
     Su forma es `{ grouped: [...] }` y no un arreglo pelado como `/reporting/list` — dos rutas del
     mismo proveedor con dos formas distintas, que es de donde salió la mitad de los errores. */
  respuestas.push({
    estado: 200,
    cuerpo: {
      grouped: [
        { dateStart: '2026-08-17', spend: '216.44', impressions: '74063', cpm: '2.922377' },
        { spend: '10' },
      ],
    },
  });

  const r = await serieDeLaCuenta(ACCESO, '2026-08-17', '2026-08-17');
  assert.equal(r.tipo, 'datos');
  if (r.tipo !== 'datos') return;

  assert.equal(r.datos.length, 1, 'se coló una fila sin fecha, que no se puede ubicar en el tiempo');
  assert.equal(r.datos[0]?.dia, '2026-08-17');
  assert.equal(r.datos[0]?.cpm, 2.922377);
});
