// La pasada que completa la miniatura de cada contacto con `GET /contacts/{id}`. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, CF1-11)
//
// La búsqueda de contactos no trae el «Video Url»; el pedido por contacto sí. La pasada pide, una sola vez, los
// contactos que llegaron por un anuncio, y guarda lo que vuelve aparte de `atribucion_primera`, que la sincronización
// pisa. Ninguna llamada real: GoHighLevel se simula con `fetch`. Cada prueba dice qué mira y la mutación que la pone
// en rojo:
//
//   · qué se pide: sólo con `adId` o `mediumId`, sin pedir dos veces, de los más recientes, con el tope — mutaciones:
//     pedir todos, volver a pedir, otro orden, sin tope;
//   · qué se guarda: las cuatro claves, el 404 como `encontrado = false`, y nada de un fallo — mutaciones: guardar
//     un fallo, o no guardar el 404;
//   · un 429 corta la pasada y el sello lo dice — mutación: seguir pidiendo;
//   · la tabla tiene un solo escritor.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { archivosFuente, RAIZ } from '../apoyo/fuente.ts';
import { completarMiniaturas, contactosPorPedir } from '../../lib/negocio/miniaturaDelContacto.ts';
import { motivoDeLoIncompleto } from '../../lib/negocio/barrido.ts';

let esc: Escenario;
const CONTACTO = 'miniatura-cf1-';
const ACCESO = { token: 'token-de-prueba', locationId: 'loc-de-prueba' };

async function limpiar(): Promise<void> {
  const mios = 'select id from negocio.contactos where ghl_contact_id like $1';
  await esc.admin.query(`delete from negocio.miniaturas_del_contacto where contacto_id in (${mios})`, [`${CONTACTO}%`]);
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${CONTACTO}%`]);
}

before(async () => {
  esc = await montar('MiniaturaContacto');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

/** Un contacto con su primera atribución, dado de alta hace `haceHoras`. Devuelve su id de GoHighLevel. */
async function unContacto(atribucion: Record<string, string>, haceHoras = 1): Promise<string> {
  const ghl = `${CONTACTO}${randomUUID().slice(0, 8)}`;
  await esc.admin.query(
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera)
     values ($1, $2, 'Lead de prueba', 'setter', now() - make_interval(hours => $3), $4::jsonb)`,
    [esc.org, ghl, haceHoras, JSON.stringify(atribucion)],
  );
  return ghl;
}

/** `fetch` simulado: cada id de GoHighLevel contesta lo que diga el mapa; cuenta los pedidos. */
function simular(respuestas: Record<string, { estado: number; atribucion?: Record<string, string | null> }>) {
  const pedidos: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const url = typeof entrada === 'string' ? entrada : String((entrada as Request).url ?? entrada);
    const id = decodeURIComponent(/\/contacts\/([^/?]+)/.exec(url)?.[1] ?? '');
    pedidos.push(id);
    const r = respuestas[id] ?? { estado: 404 };
    const cuerpo = r.estado === 200 ? { contact: { id, attributionSource: r.atribucion ?? {} } } : { message: 'no' };
    return new Response(JSON.stringify(cuerpo), { status: r.estado, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { pedidos, restaurar: () => (globalThis.fetch = original) };
}

const filas = async () =>
  (
    await esc.admin.query<{ ghl: string; encontrado: boolean; video_url: string | null; photo_url: string | null; post_id: string | null; ig_sid: string | null }>(
      `select c.ghl_contact_id as ghl, m.encontrado, m.video_url, m.photo_url, m.post_id, m.ig_sid
         from negocio.miniaturas_del_contacto m join negocio.contactos c on c.org_id = m.org_id and c.id = m.contacto_id
        where c.ghl_contact_id like $1`,
      [`${CONTACTO}%`],
    )
  ).rows;

test('se piden sólo los que llegaron por un anuncio, una vez, de los más recientes, con el tope', async () => {
  await limpiar();
  const viejo = await unContacto({ adId: '1' }, 48);
  const nuevo = await unContacto({ mediumId: '2' }, 1);
  const medio = await unContacto({ adId: '3' }, 10);
  await unContacto({ sessionSource: 'CRM UI' }, 2); // sin anuncio: no se pide
  const pedidos = (await conOrganizacion(esc.org, () => contactosPorPedir(50))).map((p) => p.ghlId).filter((g) => g.startsWith(CONTACTO));
  assert.deepEqual(pedidos, [nuevo, medio, viejo], 'pidió uno sin anuncio, o en otro orden');
  const dos = (await conOrganizacion(esc.org, () => contactosPorPedir(2))).map((p) => p.ghlId);
  assert.equal(dos.length, 2, 'no respetó el tope');
  // Uno ya pedido no se vuelve a pedir, aunque no haya tenido nada.
  const sim = simular({ [nuevo]: { estado: 200, atribucion: {} } });
  try {
    await completarMiniaturas(esc.org, ACCESO, 1);
  } finally {
    sim.restaurar();
  }
  const despues = (await conOrganizacion(esc.org, () => contactosPorPedir(50))).map((p) => p.ghlId).filter((g) => g.startsWith(CONTACTO));
  await limpiar();
  assert.deepEqual(despues, [medio, viejo], 'volvió a pedir uno que ya se pidió');
});

test('se guardan las cuatro claves y el 404; un fallo no se guarda y se vuelve a pedir', async () => {
  await limpiar();
  const conVideo = await unContacto({ adId: '1' }, 1);
  const borrado = await unContacto({ adId: '2' }, 2);
  const caido = await unContacto({ adId: '3' }, 3);
  const raro = await unContacto({ adId: '4' }, 4);
  const sim = simular({
    [conVideo]: { estado: 200, atribucion: { videoUrl: 'https://www.facebook.com/ads/image/?d=x', photoUrl: null, postId: '22', igSid: '33', adId: '1' } },
    [borrado]: { estado: 404 },
    [caido]: { estado: 500 },
    [raro]: { estado: 200, atribucion: { videoUrl: 'http://inseguro.example.com/x' } },
  });
  let resumen;
  try {
    resumen = await completarMiniaturas(esc.org, ACCESO);
  } finally {
    sim.restaurar();
  }
  const f = await filas();
  await limpiar();
  const de = (g: string) => f.find((x) => x.ghl === g);
  assert.deepEqual(de(conVideo), { ghl: conVideo, encontrado: true, video_url: 'https://www.facebook.com/ads/image/?d=x', photo_url: null, post_id: '22', ig_sid: '33' });
  assert.deepEqual(de(borrado), { ghl: borrado, encontrado: false, video_url: null, photo_url: null, post_id: null, ig_sid: null });
  assert.equal(de(caido), undefined, 'un 500 quedó guardado: no se volvería a pedir');
  assert.equal(de(raro)?.video_url, null, 'guardó una URL que no es https');
  assert.deepEqual(resumen, { pedidos: 4, conImagen: 1, sinDato: 1, noEncontrados: 1, fallos: 1, cortada: false });
});

test('un 429 corta la pasada, y el sello lo dice', async () => {
  await limpiar();
  const primero = await unContacto({ adId: '1' }, 1);
  await unContacto({ adId: '2' }, 2);
  await unContacto({ adId: '3' }, 3);
  const sim = simular({ [primero]: { estado: 429 } });
  let resumen;
  try {
    resumen = await completarMiniaturas(esc.org, ACCESO);
  } finally {
    sim.restaurar();
  }
  await limpiar();
  assert.equal(sim.pedidos.length, 1, 'siguió pidiendo después de un 429');
  assert.equal(resumen.cortada, true);
  assert.match(String(motivoDeLoIncompleto({ miniaturas: resumen })), /cortó la pasada de miniaturas/);
  assert.equal(motivoDeLoIncompleto({ miniaturas: { ...resumen, cortada: false } }), null);
});

test('la tabla tiene un solo escritor', () => {
  const escritura = /(insertInto|updateTable|deleteFrom)\(\s*['"`]miniaturas_del_contacto['"`]\s*\)|insert into negocio\.miniaturas_del_contacto/;
  const escritores = archivosFuente(['lib', 'app', 'scripts'])
    .filter((a) => escritura.test(a.limpio))
    .map((a) => a.ruta);
  assert.deepEqual(escritores, ['lib/negocio/miniaturaDelContacto.ts']);
  assert.match(readFileSync(join(RAIZ, 'db/migraciones/077_la_miniatura_del_contacto.sql'), 'utf8'), /aplicar_aislamiento\('negocio\.miniaturas_del_contacto'\)/);
});
