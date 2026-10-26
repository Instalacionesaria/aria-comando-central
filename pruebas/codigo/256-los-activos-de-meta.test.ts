// Los activos de cada anuncio leídos de Meta: la miniatura y el post. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md, etapa M-2 del 2026-10-15)
//
// La mitad con filas la cuida `pruebas/base/256-los-activos-de-meta.test.ts`. Acá, lo que se ve sin base. Cada prueba
// dice qué mira y la mutación que la pone en rojo:
//
//   · el vencimiento de la miniatura sale del `oe` de la URL firmada — mutación: leerlo en decimal, o ignorarlo;
//   · el post: Instagram primero, si no la Página de Facebook, y sólo hosts permitidos — mutación: el orden, o
//     aceptar cualquier host;
//   · la fila: un anuncio de otra cuenta no se muestra, la imagen va antes que la miniatura del video, y sólo del
//     CDN de Meta — mutación: no comparar la cuenta, invertir el orden, aceptar cualquier host;
//   · la lectura por lotes: 50 por pedido, un id que no existe no tumba el lote, una falla de token corta todo y el
//     reloj corta sin perder lo leído — mutación: no reintentar de a uno, seguir después del token, ignorar `hasta`;
//   · un solo escritor de la tabla, la tarea sola en el minuto 37, sin token queda `saltada` y la ruta del cron
//     resuelve el token de Meta sólo en ese horario.
//
// Meta se simula reemplazando `fetch`: ninguna prueba llama a Meta de verdad.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, archivosFuente } from '../apoyo/fuente.ts';
import { LADO_DE_LA_MINIATURA, LOTE_DE_META, leerCreativos, type CreativoDeMeta } from '../../lib/meta/anuncios.ts';
import { filaDelActivo, publicacionDelCreativo, vencimientoDeLaFirma } from '../../lib/negocio/recolectarActivos.ts';
import { HORARIOS, TAREAS, TAREAS_DE_META, motivoDeLoIncompleto } from '../../lib/negocio/barrido.ts';

type Respuesta = { estado: number; cuerpo: unknown };

/** Reemplaza `fetch` por una función que contesta según la URL, y guarda las URLs pedidas. */
async function conMeta<T>(contestar: (url: URL) => Respuesta, f: (pedidos: URL[]) => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  const pedidos: URL[] = [];
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const u = new URL(String(url));
    pedidos.push(u);
    const r = contestar(u);
    return new Response(JSON.stringify(r.cuerpo), { status: r.estado, headers: { 'content-type': 'application/json' } });
  }) as typeof globalThis.fetch;
  try {
    return await f(pedidos);
  } finally {
    globalThis.fetch = original;
  }
}

const errorDeMeta = (code: number): Respuesta => ({ estado: 400, cuerpo: { error: { message: 'm', type: 'OAuthException', code } } });
const CDN = 'https://scontent.xx.fbcdn.net/v/t45/foto.jpg';
const AHORA = Date.UTC(2026, 9, 15, 12);

const creativo = (c: Partial<CreativoDeMeta>): CreativoDeMeta => ({
  cuenta: '123',
  creativo: '900',
  tipo: 'PHOTO',
  imagen: null,
  miniatura: null,
  historia: null,
  instagram: null,
  ...c,
});

test('el vencimiento sale del `oe` de la firma, en hexadecimal; sin él, un día', () => {
  const vence = Math.floor(AHORA / 1000) + 3 * 3600;
  assert.equal(vencimientoDeLaFirma(`${CDN}?stp=x&oe=${vence.toString(16)}`, AHORA).getTime(), vence * 1000);
  assert.equal(vencimientoDeLaFirma(CDN, AHORA).getTime(), AHORA + 24 * 3600_000, 'sin firma, no vale un día');
  assert.equal(vencimientoDeLaFirma(`${CDN}?oe=zz`, AHORA).getTime(), AHORA + 24 * 3600_000, 'un `oe` ilegible se tomó como fecha');
});

test('el post: Instagram primero, si no la Página de Facebook, y sólo de los hosts permitidos', () => {
  const ig = 'https://www.instagram.com/p/Cabc123/';
  assert.equal(publicacionDelCreativo(creativo({ instagram: ig, historia: '111_222' })), ig);
  assert.equal(publicacionDelCreativo(creativo({ historia: '1110_2220' })), 'https://www.facebook.com/1110/posts/2220');
  // Un permalink de un host ajeno no pasa, y se cae al post de la Página.
  assert.equal(publicacionDelCreativo(creativo({ instagram: 'https://evil.example.com/p/1', historia: '1110_2220' })), 'https://www.facebook.com/1110/posts/2220');
  assert.equal(publicacionDelCreativo(creativo({ historia: 'no-es-un-id' })), null);
  assert.equal(publicacionDelCreativo(creativo({})), null);
});

test('la fila: otra cuenta no se muestra, la imagen antes que la miniatura, y sólo del CDN de Meta', () => {
  const vacia = { meta_creativo_id: null, tipo_de_objeto: null, miniatura_url: null, miniatura_caduca_el: null, publicacion_url: null };
  assert.deepEqual(filaDelActivo('1', 'no_existe', 'act_123', AHORA), { meta_anuncio_id: '1', ...vacia, motivo: 'no_existe' });
  assert.deepEqual(filaDelActivo('1', creativo({ cuenta: '999', imagen: CDN }), 'act_123', AHORA), { meta_anuncio_id: '1', ...vacia, motivo: 'cuenta_ajena' });
  assert.deepEqual(filaDelActivo('1', creativo({ creativo: null }), 'act_123', AHORA), { meta_anuncio_id: '1', ...vacia, motivo: 'sin_creativo' });

  const video = `${CDN}?v=video`;
  const conLasDos = filaDelActivo('1', creativo({ tipo: 'VIDEO', imagen: CDN, miniatura: video }), 'act_123', AHORA);
  assert.equal(conLasDos.miniatura_url, CDN, 'la miniatura del video ganó a la imagen entera');
  assert.equal(conLasDos.motivo, null);
  assert.equal(conLasDos.tipo_de_objeto, 'VIDEO');
  assert.ok(conLasDos.miniatura_caduca_el instanceof Date);

  const imagenAjena = filaDelActivo('1', creativo({ imagen: 'https://evil.example.com/x.jpg', miniatura: video }), 'act_123', AHORA);
  assert.equal(imagenAjena.miniatura_url, video, 'una imagen de otro host se guardó');

  const sinNada = filaDelActivo('1', creativo({ imagen: 'https://evil.example.com/x.jpg' }), 'act_123', AHORA);
  assert.deepEqual([sinNada.miniatura_url, sinNada.miniatura_caduca_el, sinNada.motivo], [null, null, 'sin_miniatura']);

  // Meta a veces omite `account_id`: sin cuenta que comparar, el anuncio se acepta (vino de la cuenta cargada).
  assert.equal(filaDelActivo('1', creativo({ cuenta: null, imagen: CDN }), 'act_123', AHORA).motivo, null);
});

/** Contesta como Meta: cada anuncio con su creativo `c<id>`, cada creativo con su imagen. */
function metaQueContesta(noExisten: readonly string[] = []) {
  return (u: URL): Respuesta => {
    const ids = (u.searchParams.get('ids') ?? u.pathname.split('/').pop() ?? '').split(',');
    if (ids.some((id) => noExisten.includes(id))) return errorDeMeta(100);
    const esCreativo = ids[0]!.startsWith('c');
    const fila = (id: string) =>
      esCreativo ? { object_type: 'PHOTO', image_url: `${CDN}?de=${id}` } : { account_id: '123', creative: { id: `c${id}` } };
    if (!u.searchParams.has('ids')) return { estado: 200, cuerpo: fila(ids[0]!) };
    return { estado: 200, cuerpo: Object.fromEntries(ids.map((id) => [id, fila(id)])) };
  };
}

test('la lectura: lotes de 50, primero los anuncios y después los creativos con el tamaño de la tarjeta', async () => {
  const ids = Array.from({ length: LOTE_DE_META + 1 }, (_, i) => String(1000 + i));
  const r = await conMeta(metaQueContesta(), async (pedidos) => {
    const leido = await leerCreativos('t', ids, AHORA + 60_000, () => AHORA);
    // 51 anuncios = dos lotes de anuncios y dos de creativos.
    assert.equal(pedidos.length, 4);
    assert.equal(pedidos[0]!.searchParams.get('ids')!.split(',').length, LOTE_DE_META);
    assert.equal(pedidos[1]!.searchParams.get('ids'), String(1000 + LOTE_DE_META));
    assert.match(pedidos[0]!.searchParams.get('fields')!, /creative\{id\}/);
    assert.equal(pedidos[2]!.searchParams.get('thumbnail_width'), String(LADO_DE_LA_MINIATURA));
    assert.equal(pedidos[2]!.searchParams.get('thumbnail_height'), String(LADO_DE_LA_MINIATURA));
    return leido;
  });
  assert.ok(r.tipo === 'leido');
  assert.equal(r.llamadas, 4);
  assert.equal(r.incompleto, false);
  assert.equal(r.anuncios.size, ids.length);
  assert.deepEqual(r.anuncios.get('1000'), {
    cuenta: '123',
    creativo: 'c1000',
    tipo: 'PHOTO',
    imagen: `${CDN}?de=c1000`,
    miniatura: null,
    historia: null,
    instagram: null,
  });
});

test('un anuncio que no existe no tumba su lote: el lote se pide de a uno', async () => {
  const r = await conMeta(metaQueContesta(['2']), (pedidos) =>
    leerCreativos('t', ['1', '2', '3'], AHORA + 60_000, () => AHORA).then((x) => ({ x, n: pedidos.length })),
  );
  assert.ok(r.x.tipo === 'leido');
  // El lote rechazado, los tres de a uno y el lote de creativos.
  assert.equal(r.n, 5);
  assert.equal(r.x.anuncios.get('2'), 'no_existe');
  assert.equal((r.x.anuncios.get('1') as CreativoDeMeta).creativo, 'c1');
  assert.equal((r.x.anuncios.get('3') as CreativoDeMeta).creativo, 'c3', 'el que venía después del borrado se perdió');
});

test('un token rechazado corta la pasada; el reloj la corta sin perder lo leído', async () => {
  const token = await conMeta(() => errorDeMeta(190), (pedidos) =>
    leerCreativos('t', ['1', '2'], AHORA + 60_000, () => AHORA).then((x) => ({ x, n: pedidos.length })),
  );
  assert.deepEqual(token.x, { tipo: 'falla', motivo: 'token', llamadas: 1 });
  assert.equal(token.n, 1, 'siguió pidiendo con un token rechazado');

  // Sin tiempo desde el principio: nada leído, nada pedido, y la pasada dice que quedó incompleta.
  const sinTiempo = await conMeta(metaQueContesta(), () => leerCreativos('t', ['1'], AHORA, () => AHORA));
  assert.ok(sinTiempo.tipo === 'leido');
  assert.deepEqual([sinTiempo.anuncios.size, sinTiempo.llamadas, sinTiempo.incompleto], [0, 0, true]);

  // El tiempo se acaba entre los anuncios y los creativos: el anuncio sin creativo leído queda para la próxima.
  let reloj = AHORA;
  const aMedias = await conMeta(
    (u) => {
      reloj += 120_000;
      return metaQueContesta()(u);
    },
    () => leerCreativos('t', ['1'], AHORA + 60_000, () => reloj),
  );
  assert.ok(aMedias.tipo === 'leido');
  assert.deepEqual([aMedias.anuncios.size, aMedias.incompleto], [0, true], 'un anuncio se guardó sin su creativo');
});

test('`negocio.activos_de_anuncio` tiene UN solo escritor', () => {
  const ESCRITOR = 'lib/negocio/recolectarActivos.ts';
  const escritura = /(insertInto|updateTable|deleteFrom)\(\s*['"`]activos_de_anuncio['"`]\s*\)/;
  const culpables = archivosFuente(['app', 'lib'])
    .filter((a) => a.ruta !== ESCRITOR && escritura.test(a.limpio))
    .map((a) => a.ruta);
  assert.deepEqual(culpables, [], 'otro archivo escribe los activos de Meta');
  const escritor = archivosFuente(['lib']).find((a) => a.ruta === ESCRITOR);
  assert.ok(escritor, `no se encontró ${ESCRITOR}`);
  assert.match(escritor.limpio, escritura, 'el escritor dejó de escribir: la aserción de arriba pasaría en vacío');
});

test('la tarea `activos`: sola en el minuto 37, cada hora, y su corte se lee en el sello', () => {
  assert.ok((TAREAS as readonly string[]).includes('activos'));
  const suyos = Object.entries(HORARIOS).filter(([, h]) => (h.tareas as readonly string[]).includes('activos'));
  assert.deepEqual(
    suyos.map(([horario, h]) => [horario, h.tareas, h.cadenciaMinutos]),
    [['37 * * * *', ['activos'], 60]],
  );

  assert.match(String(motivoDeLoIncompleto({ pedidos: 3, guardados: 0, conMiniatura: 0, corte: 'token' })), /rechazó la conexión/);
  assert.match(String(motivoDeLoIncompleto({ pedidos: 3, guardados: 1, conMiniatura: 1, corte: 'tiempo' })), /hora siguiente/);
  assert.equal(motivoDeLoIncompleto({ pedidos: 3, guardados: 3, conMiniatura: 2, corte: null }), null);

  const barrido = readFileSync(join(RAIZ, 'lib/negocio/barrido.ts'), 'utf8');
  // Sin cuentas de Meta, saltada con su texto y sin llamar a nadie; y no se le pide el token del CRM. Desde Meta directo
  // vale para las tres tareas de Meta (`TAREAS_DE_META`): los activos, los anuncios y su historia.
  assert.match(barrido, /if \(esDeMeta\(tarea\) && meta\?\.tipo !== 'listo'\) \{/);
  assert.match(barrido, /!esDeMeta\(tarea\) &&\s*\n\s*acceso\.tipo !== 'listo'/);
  assert.deepEqual([...TAREAS_DE_META].sort(), ['activos', 'anuncios', 'anuncios_relleno']);

  const ruta = readFileSync(join(RAIZ, 'app/api/cron/route.ts'), 'utf8');
  assert.match(ruta, /const conLosActivos = tareasDelHorario\(horario\)\.tareas\.some\(\(t\) => TAREAS_DE_META\.includes\(t\)\);/);
  assert.match(ruta, /\.\.\.\(conLosActivos \? \{ meta: await resolverCuentasDeMeta\(db, org\.id, 'la_de_la_empresa'\) \} : \{\}\)/);
});
