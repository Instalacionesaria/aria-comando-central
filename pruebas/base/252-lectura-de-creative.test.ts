// La lectura de Creative y sus piezas nuevas, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, CF-1)
//
// La mitad pura la cuida `pruebas/codigo/252-lectura-de-creative.test.ts`. Acá se mira lo que sólo se ve con filas:
//
//   · la entrega de cada pieza: las impresiones de la ventana, las acciones sobre los anuncio-día que traían la clave,
//     la frecuencia pesada, los días con entrega de toda la historia y si entregó en los últimos 3 días — mutaciones:
//     sacar la ventana, sumar días sin la clave, promediar la frecuencia, mirar sólo la ventana para los días;
//   · la etapa: la de la campaña con más impresiones — mutación: la primera que aparezca;
//   · el hook rate de la entrega es el de `rendimientoDelCreativo` — mutación: otro denominador;
//   · los calificados: ICP de 75 o más, sin contar el cero ni un texto — mutación: otro umbral, o romper con un texto;
//   · la miniatura de la pieza: la más frecuente entre sus contactos, sólo de los hosts permitidos — mutación: la
//     primera, o cualquier host.
//
// Las piezas llevan una marca en el nombre: la organización la comparten otras pruebas.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { CAMPO_DE_ICP, calidadDelCreativo } from '../../lib/negocio/calidadDelCreativo.ts';
import { rendimientoDelCreativo } from '../../lib/negocio/rendimientoDelCreativo.ts';
import { entregaDeLasPiezas, lecturaDeCreative } from '../../lib/negocio/lecturaDeCreative.ts';
import { miniaturasDeLasPiezas } from '../../lib/negocio/miniaturaDelContacto.ts';

let esc: Escenario;
const MARCA = '25200';
const PIEZA = 'pieza-cf1-uno';
const OTRA = 'pieza-cf1-dos';
const CONTACTO = 'lectura-creative-';
const CAMPO = 'campo-icp-cf1';
const CARPETA = 'carpeta-icp-cf1';

async function limpiar(): Promise<void> {
  const mios = 'select id from negocio.contactos where ghl_contact_id like $1';
  await esc.admin.query(`delete from negocio.miniaturas_del_contacto where contacto_id in (${mios})`, [`${CONTACTO}%`]);
  await esc.admin.query(`delete from negocio.citas where contacto_id in (${mios})`, [`${CONTACTO}%`]);
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${CONTACTO}%`]);
  await esc.admin.query('delete from negocio.metricas_de_anuncio where meta_anuncio_id like $1', [`${MARCA}%`]);
  await esc.admin.query('delete from negocio.anuncios where meta_anuncio_id like $1', [`${MARCA}%`]);
  await esc.admin.query('delete from negocio.campanas where meta_campana_id like $1', [`${MARCA}%`]);
  await esc.admin.query('delete from negocio.campos_del_crm where campo_id = $1', [CAMPO]);
  await esc.admin.query('delete from negocio.carpetas_del_crm where carpeta_id = $1', [CARPETA]);
}

before(async () => {
  esc = await montar('LecturaCreative');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

async function unaCampana(id: string, nombre: string): Promise<void> {
  await esc.admin.query(`insert into negocio.campanas (org_id, meta_campana_id, nombre, estado) values ($1, $2, $3, 'ACTIVE')`, [esc.org, id, nombre]);
}

async function unAnuncio(id: string, nombre: string, campana: string): Promise<void> {
  await esc.admin.query(
    `insert into negocio.anuncios (org_id, meta_anuncio_id, meta_conjunto_id, meta_campana_id, nombre, objetivo)
       values ($1, $2, '7700', $3, $4, 'OUTCOME_LEADS')`,
    [esc.org, id, campana, nombre],
  );
}

async function unDia(id: string, hace: number, m: { impresiones: number; clics?: number; frecuencia?: number | null }, acciones: Record<string, number> | null): Promise<void> {
  await esc.admin.query(
    `insert into negocio.metricas_de_anuncio (org_id, meta_anuncio_id, fecha, gasto, impresiones, clics, alcance, ctr, cpc, frecuencia, acciones)
     values ($1, $2, current_date - $3::int, 10, $4, $5, null, null, null, $6, $7::jsonb)`,
    [esc.org, id, hace, m.impresiones, m.clics ?? 0, m.frecuencia ?? null, acciones === null ? null : JSON.stringify(acciones)],
  );
}

async function unLead(o: { pieza: string; icp?: string | null; video?: string | null }): Promise<void> {
  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera, campos_del_crm)
     values ($1, $2, 'Lead de prueba', 'setter', now() - interval '1 day', $3::jsonb, $4::jsonb) returning id`,
    [esc.org, `${CONTACTO}${randomUUID().slice(0, 8)}`, JSON.stringify({ utmContent: o.pieza, adId: '1' }), JSON.stringify(o.icp == null ? {} : { [CAMPO]: o.icp })],
  );
  if (o.video !== undefined) {
    await esc.admin.query(
      `insert into negocio.miniaturas_del_contacto (org_id, contacto_id, encontrado, video_url) values ($1, $2, true, $3)`,
      [esc.org, r.rows[0]!.id, o.video],
    );
  }
}

const enAlfa = <T>(f: () => Promise<T>) => conOrganizacion(esc.org, f);

test('la entrega de una pieza: la ventana, las claves, la frecuencia pesada, los días y la etapa', async () => {
  await limpiar();
  await unaCampana(`${MARCA}01`, 'NUEVA ERA | TOFU | LEADS');
  await unaCampana(`${MARCA}02`, 'NUEVA ERA | BOFU | AGENDAS');
  await unAnuncio(`${MARCA}11`, PIEZA, `${MARCA}01`);
  await unAnuncio(`${MARCA}12`, ' Pieza-CF1-Uno ', `${MARCA}02`);
  // En la ventana de 30: tres días del anuncio TOFU (uno sin videoView) y uno del BOFU.
  await unDia(`${MARCA}11`, 1, { impresiones: 1000, clics: 20, frecuencia: 1 }, { videoView: 300 });
  await unDia(`${MARCA}11`, 2, { impresiones: 3000, clics: 30, frecuencia: 2 }, { videoView: 600, linkClick: 50 });
  await unDia(`${MARCA}11`, 3, { impresiones: 2000, clics: 10, frecuencia: null }, { linkClick: 10 });
  await unDia(`${MARCA}12`, 4, { impresiones: 500, clics: 5, frecuencia: 4 }, { videoView: 100 });
  // Fuera de la ventana: cuenta para los días con entrega, no para las cifras.
  await unDia(`${MARCA}11`, 40, { impresiones: 9000, clics: 99, frecuencia: 9 }, { videoView: 9000 });

  const e = (await enAlfa(() => entregaDeLasPiezas(30))).find((x) => x.pieza === PIEZA);
  assert.ok(e, 'la pieza no salió, o el nombre con espacios y mayúsculas no se unió');
  assert.equal(e.impresiones, 6500, 'contó impresiones fuera de la ventana');
  assert.equal(e.clics, 65);
  assert.deepEqual(e.vistas, { cantidad: 1000, impresiones: 4500 }, 'el denominador de las vistas incluye días sin la clave');
  assert.deepEqual(e.clicsAlEnlace, { cantidad: 60, impresiones: 5000 });
  assert.equal(e.landing, null, 'sin landingPageView no hay par');
  assert.equal(e.frecuencia, (1 * 1000 + 2 * 3000 + 4 * 500) / 4500, 'la frecuencia no está pesada por impresiones');
  assert.equal(e.etapa, 'TOFU', 'la etapa no es la de la campaña con más impresiones');
  assert.equal(e.entregando, true);
  assert.equal(e.primerDia, (await esc.admin.query<{ d: string }>(`select (current_date - 40)::text as d`)).rows[0]!.d, 'el primer día no mira toda la historia');

  // El mismo hook rate que el módulo, en porcentaje allá y de 0 a 1 acá.
  const r = (await enAlfa(() => rendimientoDelCreativo(30))).filas.find((f) => f.creativo === PIEZA);
  assert.ok(r);
  assert.ok(Math.abs(r.hookRate.tasa! / 100 - e.vistas!.cantidad / e.vistas!.impresiones) < 0.0001, 'la entrega y el rendimiento no dan el mismo hook rate');

  // Sin impresiones en los últimos 3 días, no está entregando.
  await unaCampana(`${MARCA}03`, 'IG-DM');
  await unAnuncio(`${MARCA}13`, OTRA, `${MARCA}03`);
  await unDia(`${MARCA}13`, 5, { impresiones: 1500 }, null);
  const otra = (await enAlfa(() => entregaDeLasPiezas(30))).find((x) => x.pieza === OTRA);
  await limpiar();
  assert.deepEqual([otra?.entregando, otra?.etapa, otra?.vistas], [false, null, null]);
});

test('los calificados: ICP de 75 o más, sin el cero ni un texto', async () => {
  await limpiar();
  await esc.admin.query(`insert into negocio.carpetas_del_crm (org_id, carpeta_id, nombre, visto_el) values ($1, $2, 'Prueba', now()) on conflict do nothing`, [esc.org, CARPETA]);
  await esc.admin.query(
    `insert into negocio.campos_del_crm (org_id, campo_id, nombre, carpeta_id, tipo, posicion, visto_el) values ($1, $2, $3, $4, 'TEXT', '1', now()) on conflict do nothing`,
    [esc.org, CAMPO, CAMPO_DE_ICP, CARPETA],
  );
  for (const icp of ['75', '90.5', '74.9', '0', 'alto', null]) await unLead({ pieza: PIEZA, icp });
  const f = (await enAlfa(() => calidadDelCreativo(30))).filas.filter((x) => x.creativo === PIEZA);
  await limpiar();
  assert.equal(f.reduce((s, x) => s + x.calificados, 0), 2, 'contó otro umbral, el cero o un texto');
  assert.equal(f.reduce((s, x) => s + x.contactos, 0), 6);
});

test('la miniatura de la pieza: la más frecuente entre sus contactos, sólo de los hosts permitidos', async () => {
  await limpiar();
  const UNA = 'https://www.facebook.com/ads/image/?d=una';
  const DOS = 'https://www.facebook.com/ads/image/?d=dos';
  await unLead({ pieza: PIEZA, video: UNA });
  await unLead({ pieza: PIEZA, video: DOS });
  await unLead({ pieza: PIEZA, video: DOS });
  await unLead({ pieza: PIEZA, video: null });
  await unLead({ pieza: OTRA, video: 'https://evil.example.com/x.jpg' });
  await unLead({ pieza: OTRA, video: 'https://evil.example.com/x.jpg' });
  await unLead({ pieza: OTRA, video: UNA });
  const m = await enAlfa(() => miniaturasDeLasPiezas());
  await limpiar();
  assert.equal(m.get(PIEZA), DOS, 'no eligió la más frecuente');
  assert.equal(m.get(OTRA), UNA, 'eligió una URL de un host que no está permitido');
});

test('la lectura entera arma la pantalla con lo leído', async () => {
  await limpiar();
  await unaCampana(`${MARCA}01`, 'NUEVA ERA | TOFU | LEADS');
  await unAnuncio(`${MARCA}11`, PIEZA, `${MARCA}01`);
  await unDia(`${MARCA}11`, 1, { impresiones: 2000, clics: 40, frecuencia: 1.2 }, { videoView: 500 });
  await unLead({ pieza: PIEZA, video: 'https://www.facebook.com/ads/image/?d=una' });
  const l = await enAlfa(() => lecturaDeCreative(30));
  await limpiar();
  const p = l.pantalla.piezas.find((x) => x.clave === PIEZA);
  assert.ok(p, 'la pieza no está en la pantalla');
  assert.deepEqual([p.etapa, p.estado, p.cifras.impresiones.valor, p.cifras.hookRate.valor, p.miniatura], ['TOFU', 'entregando', 2000, 0.25, 'https://www.facebook.com/ads/image/?d=una']);
  assert.deepEqual(p.cifras.agendas, { valor: 0, motivo: null });
});
