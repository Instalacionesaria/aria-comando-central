// Los activos de cada anuncio leídos de Meta, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/2-departamentos/creative/15-LA-MINIATURA-Y-EL-VIDEO.md, etapa M-2 del 2026-10-15)
//
// La mitad pura la cuida `pruebas/codigo/256-los-activos-de-meta.test.ts`. Acá, lo que sólo se ve con filas:
//
//   · qué se pide: lo nunca leído, lo leído hace más de un día y la miniatura que vence en menos de seis horas; nada
//     de otra empresa; primero los anuncios que entregaron hace menos — mutaciones: sacar una de las tres
//     condiciones, ordenar por id, quitar la RLS;
//   · guardar reescribe la fila del anuncio y no suma otra — mutación: `doNothing` en el conflicto;
//   · la pasada entera con Meta simulado: guarda la miniatura con su vencimiento, marca la cuenta ajena, y la
//     segunda pasada sólo vuelve a pedir la miniatura que está por vencer.
//
// Los ids están puestos para que el orden alfabético NO coincida con el de la entrega. La organización la
// comparten otras pruebas: los anuncios llevan una marca, y las aserciones miran sólo los marcados.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { activosDeLasPiezas, anunciosPorLeer, guardarActivos, recolectarActivos } from '../../lib/negocio/recolectarActivos.ts';
import { porOmisionDe } from '../../lib/negocio/ambitoDelCliente.ts';

let esc: Escenario;
const MARCA = '25600';
const id = (n: number) => `${MARCA}${n}`;
const CDN = 'https://scontent.xx.fbcdn.net/v/t45/foto.jpg';
const oe = (msDesdeAhora: number) => Math.floor((Date.now() + msDesdeAhora) / 1000).toString(16);

async function limpiar(): Promise<void> {
  // La tabla tiene un solo escritor, que es lo que se prueba acá: se vacía entera, de las dos empresas.
  await esc.admin.query('delete from negocio.activos_de_anuncio where org_id = any($1::uuid[])', [[esc.org, esc.otraOrg]]);
  await esc.admin.query('delete from negocio.metricas_de_anuncio where meta_anuncio_id like $1', [`${MARCA}%`]);
  await esc.admin.query('delete from negocio.anuncios where meta_anuncio_id like $1', [`${MARCA}%`]);
}

before(async () => {
  esc = await montar('ActivosDeMeta');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

async function unAnuncio(anuncio: string, org = esc.org, nombre = `pieza-${anuncio}`): Promise<void> {
  await esc.admin.query(
    `insert into negocio.anuncios (org_id, meta_anuncio_id, meta_conjunto_id, meta_campana_id, nombre, objetivo)
       values ($1, $2, '7700', '8800', $3, 'OUTCOME_LEADS')`,
    [org, anuncio, nombre],
  );
}

async function unDia(anuncio: string, hace: number, impresiones = 100): Promise<void> {
  await esc.admin.query(
    `insert into negocio.metricas_de_anuncio (org_id, meta_anuncio_id, fecha, gasto, impresiones)
       values ($1, $2, current_date - $3::int, 1, $4)`,
    [esc.org, anuncio, hace, impresiones],
  );
}

/** Una lectura ya guardada, con su antigüedad y el vencimiento de su miniatura. */
async function unaLectura(anuncio: string, haceHoras: number, venceEnHoras: number | null): Promise<void> {
  await esc.admin.query(
    `insert into negocio.activos_de_anuncio (org_id, meta_anuncio_id, meta_creativo_id, miniatura_url, miniatura_caduca_el, motivo, leido_el)
       values ($1, $2, 'c1', $3, $4, $5, now() - make_interval(hours => $6))`,
    [
      esc.org,
      anuncio,
      venceEnHoras === null ? null : CDN,
      venceEnHoras === null ? null : new Date(Date.now() + venceEnHoras * 3600_000),
      venceEnHoras === null ? 'sin_miniatura' : null,
      haceHoras,
    ],
  );
}

const marcados = (ids: readonly string[]) => ids.filter((x) => x.startsWith(MARCA));

test('qué se pide: lo nunca leído, lo viejo y lo que vence pronto; nada de otra empresa; primero lo que entregó hace menos', async () => {
  // 1: nunca leído, entregó hace 10 días. 3: leído hace dos días, entregó hace 5. 4: leído recién pero su miniatura
  // vence en 2 h, entregó hace 3. 7: nunca leído y sin métricas. 5: leído recién, vence en dos días: NO se pide.
  // 6: leído recién, sin miniatura: NO se pide. 9: de la otra empresa, nunca leído: NO se pide.
  for (const n of [1, 3, 4, 5, 6, 7]) await unAnuncio(id(n));
  await unAnuncio(id(9), esc.otraOrg);
  await unDia(id(1), 10);
  await unDia(id(3), 5);
  await unDia(id(4), 3);
  await unDia(id(5), 1);
  await unaLectura(id(3), 48, 72);
  await unaLectura(id(4), 1, 2);
  await unaLectura(id(5), 1, 48);
  await unaLectura(id(6), 1, null);

  const pedidos = marcados(await conOrganizacion(esc.org, () => anunciosPorLeer(10_000)));
  assert.deepEqual(pedidos, [id(4), id(3), id(1), id(7)]);
  await limpiar();
});

test('guardar reescribe la fila del anuncio, con la organización puesta, y no suma otra', async () => {
  await unAnuncio(id(1));
  const fila = {
    meta_anuncio_id: id(1),
    meta_creativo_id: 'c1',
    tipo_de_objeto: 'PHOTO',
    miniatura_url: CDN,
    miniatura_caduca_el: new Date(Date.now() + 3600_000),
    publicacion_url: null,
    motivo: null,
  } as const;
  await conOrganizacion(esc.org, () => guardarActivos([fila]));
  await conOrganizacion(esc.org, () =>
    guardarActivos([{ ...fila, meta_creativo_id: 'c2', miniatura_url: null, miniatura_caduca_el: null, motivo: 'sin_miniatura' }]),
  );
  const { rows } = await esc.admin.query<{ org_id: string; meta_creativo_id: string; miniatura_url: string | null; motivo: string }>(
    'select org_id, meta_creativo_id, miniatura_url, motivo from negocio.activos_de_anuncio where meta_anuncio_id = $1',
    [id(1)],
  );
  assert.deepEqual(rows, [{ org_id: esc.org, meta_creativo_id: 'c2', miniatura_url: null, motivo: 'sin_miniatura' }]);
  await limpiar();
});

test('por pieza: la miniatura vigente y el post del anuncio más visto, cada uno por separado', async () => {
  /* Una pieza de cuatro anuncios, con los ids al revés de las impresiones. 3: el más visto (900), con el post y la
     miniatura VENCIDA. 2: 500, sin post y con miniatura vigente. 1: 300, con otra miniatura vigente y otro post. 4: sin
     métricas, con su miniatura vigente. Gana la miniatura del 2 (la vigente del más visto) y el post del 3.
     Mutaciones: no mirar el vencimiento, ordenar por id, tomar miniatura y post del mismo anuncio. */
  const NOMBRE = '  Pieza-M3  ';
  for (const n of [1, 2, 3, 4]) await unAnuncio(id(n), esc.org, NOMBRE);
  await unDia(id(3), 2, 900);
  await unDia(id(2), 2, 500);
  await unDia(id(1), 2, 300);
  const fila = (n: number, miniatura: string | null, venceEnHoras: number | null, post: string | null) =>
    esc.admin.query(
      `insert into negocio.activos_de_anuncio (org_id, meta_anuncio_id, meta_creativo_id, miniatura_url, miniatura_caduca_el, publicacion_url)
         values ($1, $2, 'c', $3, $4, $5)`,
      [esc.org, id(n), miniatura, venceEnHoras === null ? null : new Date(Date.now() + venceEnHoras * 3600_000), post],
    );
  await fila(3, `${CDN}?n=3`, -1, 'https://www.facebook.com/1/posts/3');
  await fila(2, `${CDN}?n=2`, 5, null);
  await fila(1, `${CDN}?n=1`, 5, 'https://www.facebook.com/1/posts/1');
  await fila(4, `${CDN}?n=4`, 5, null);

  const activos = await conOrganizacion(esc.org, () => activosDeLasPiezas());
  assert.deepEqual(activos.get('pieza-m3'), { miniatura: `${CDN}?n=2`, publicacion: 'https://www.facebook.com/1/posts/3' });
  // Y la otra empresa no ve nada de esto.
  assert.equal((await conOrganizacion(esc.otraOrg, () => activosDeLasPiezas())).get('pieza-m3'), undefined);
  await limpiar();
});

test('la pasada entera: guarda la miniatura con su vencimiento, marca la cuenta ajena y la segunda sólo renueva lo que vence', async () => {
  for (const n of [1, 2, 3]) await unAnuncio(id(n));
  await unAnuncio(id(9), esc.otraOrg);
  const vencePronto = oe(3600_000);
  const venceLejos = oe(3 * 24 * 3600_000);

  const pedidosDeAnuncios: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const u = new URL(String(url));
    const ids = (u.searchParams.get('ids') ?? '').split(',');
    const esCreativo = ids[0]!.startsWith('c');
    if (!esCreativo) pedidosDeAnuncios.push(...ids);
    const fila = (x: string) =>
      esCreativo
        ? { object_type: 'PHOTO', image_url: `${CDN}?oe=${x === `c${id(1)}` ? vencePronto : venceLejos}` }
        : { account_id: x === id(2) ? '999' : '123', creative: { id: `c${x}` } };
    return new Response(JSON.stringify(Object.fromEntries(ids.map((x) => [x, fila(x)]))), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
  try {
    const primera = await recolectarActivos(await porOmisionDe(esc.org), { token: 't', cuentaId: 'act_123' });
    assert.equal(primera.resultado.corte, null);
    assert.deepEqual(marcados(pedidosDeAnuncios).sort(), [id(1), id(2), id(3)], 'se pidió un anuncio de la otra empresa, o faltó uno');

    const { rows } = await esc.admin.query<{ meta_anuncio_id: string; motivo: string | null; con: boolean; vence: string | null }>(
      `select meta_anuncio_id, motivo, miniatura_url is not null as con, to_char(miniatura_caduca_el at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS') as vence
         from negocio.activos_de_anuncio where meta_anuncio_id like $1 order by meta_anuncio_id`,
      [`${MARCA}%`],
    );
    const iso = (hex: string) => new Date(parseInt(hex, 16) * 1000).toISOString().slice(0, 19);
    assert.deepEqual(rows, [
      { meta_anuncio_id: id(1), motivo: null, con: true, vence: iso(vencePronto) },
      { meta_anuncio_id: id(2), motivo: 'cuenta_ajena', con: false, vence: null },
      { meta_anuncio_id: id(3), motivo: null, con: true, vence: iso(venceLejos) },
    ]);

    // La segunda pasada: sólo la miniatura que vence en una hora.
    pedidosDeAnuncios.length = 0;
    await recolectarActivos(await porOmisionDe(esc.org), { token: 't', cuentaId: 'act_123' });
    assert.deepEqual(marcados(pedidosDeAnuncios), [id(1)], 'la segunda pasada volvió a pedir lo que estaba al día');
  } finally {
    globalThis.fetch = original;
  }
});
