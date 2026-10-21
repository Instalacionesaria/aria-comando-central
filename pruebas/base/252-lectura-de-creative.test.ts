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
//   · los calificados: ICP de 75 o más, sin contar el cero, un texto ni un decimal (C6 · D4) — mutación: otro umbral, o romper con un texto;
//   · la miniatura de la pieza: la más frecuente entre sus contactos; empate, la del contacto más nuevo; sólo de los
//     hosts permitidos, con el tope de la tabla; la foto si no hay video — mutación: la primera, cualquier host, el tope
//     del link manual, sólo el video;
//   · los anuncios sin nombre, en su pieza rotulada, y el borde de los 3 días — mutación: descartarlos, o 4 días.
//
// Los datos de la CF-4 están puestos para que el orden de inserción, el id y el orden alfabético NO coincidan con la
// respuesta correcta: así cada `orderBy` decide algo.
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
const TERCERA = 'pieza-cf1-tres';
const CUARTA = 'pieza-cf1-cuatro';
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

async function unLead(o: { pieza: string | null; adId?: string; icp?: string | null; video?: string | null; foto?: string; haceDias?: number }): Promise<void> {
  // `pieza: null` = un lead sin `utmContent`, como los que entran por un anuncio de Instagram (DM).
  const atribucion = o.pieza === null ? { adId: o.adId ?? '1' } : { utmContent: o.pieza, adId: o.adId ?? '1' };
  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera, campos_del_crm)
     values ($1, $2, 'Lead de prueba', 'setter', now() - make_interval(days => $5), $3::jsonb, $4::jsonb) returning id`,
    [esc.org, `${CONTACTO}${randomUUID().slice(0, 8)}`, JSON.stringify(atribucion), JSON.stringify(o.icp == null ? {} : { [CAMPO]: o.icp }), o.haceDias ?? 1],
  );
  if (o.video !== undefined || o.foto !== undefined) {
    await esc.admin.query(
      `insert into negocio.miniaturas_del_contacto (org_id, contacto_id, encontrado, video_url, photo_url) values ($1, $2, true, $3, $4)`,
      [esc.org, r.rows[0]!.id, o.video ?? null, o.foto ?? null],
    );
  }
}

const enAlfa = <T>(f: () => Promise<T>) => conOrganizacion(esc.org, f);

test('la entrega de una pieza: la ventana, las claves, la frecuencia pesada, los días y la etapa', async () => {
  await limpiar();
  // La campaña BOFU lleva el id MENOR: si el orden por impresiones no decidiera, ganaría ella por el desempate.
  await unaCampana(`${MARCA}02`, 'NUEVA ERA | TOFU | LEADS');
  await unaCampana(`${MARCA}01`, 'NUEVA ERA | BOFU | AGENDAS');
  await unAnuncio(`${MARCA}11`, PIEZA, `${MARCA}02`);
  await unAnuncio(`${MARCA}12`, ' Pieza-CF1-Uno ', `${MARCA}01`);
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
  assert.equal(e.impresionesConFrecuencia, 4500, 'el peso de la frecuencia incluye días sin frecuencia, o fuera de la ventana');
  assert.equal(e.etapa, 'TOFU', 'la etapa no es la de la campaña con más impresiones');
  assert.equal(e.entregando, true);
  const dia = async (hace: number) => (await esc.admin.query<{ d: string }>(`select (current_date - $1::int)::text as d`, [hace])).rows[0]!.d;
  assert.equal(e.primerDia, await dia(40), 'el primer día no mira toda la historia');
  assert.equal(e.ultimoDia, await dia(1));

  // El mismo hook rate que el módulo, en porcentaje allá y de 0 a 1 acá.
  const r = (await enAlfa(() => rendimientoDelCreativo(30))).filas.find((f) => f.creativo === PIEZA);
  assert.ok(r);
  assert.ok(Math.abs(r.hookRate.tasa! / 100 - e.vistas!.cantidad / e.vistas!.impresiones) < 0.0001, 'la entrega y el rendimiento no dan el mismo hook rate');

  /* «Entregando»: impresiones en los últimos 3 días del calendario, hoy incluido —hoy, ayer y anteayer—. OTRA entregó
     hace 3 días y hoy tuvo un día en cero: no está entregando, y su último día es el de hace 3. TERCERA entregó
     anteayer: sí. */
  await unaCampana(`${MARCA}03`, 'IG-DM');
  await unAnuncio(`${MARCA}13`, OTRA, `${MARCA}03`);
  await unAnuncio(`${MARCA}14`, TERCERA, `${MARCA}03`);
  await unDia(`${MARCA}13`, 3, { impresiones: 1500 }, null);
  await unDia(`${MARCA}13`, 0, { impresiones: 0 }, null);
  await unDia(`${MARCA}14`, 2, { impresiones: 700 }, null);
  // Un anuncio sin nombre va a la pieza rotulada, como en el rendimiento: su entrega es real.
  await unAnuncio(`${MARCA}15`, '', `${MARCA}03`);
  await unDia(`${MARCA}15`, 1, { impresiones: 777 }, null);
  const todas = await enAlfa(() => entregaDeLasPiezas(30));
  const otra = todas.find((x) => x.pieza === OTRA);
  const tercera = todas.find((x) => x.pieza === TERCERA);
  const sinNombre = todas.find((x) => x.pieza === '(anuncio sin nombre)');
  const haceTres = await dia(3);
  await limpiar();
  assert.deepEqual([otra?.entregando, otra?.etapa, otra?.vistas, otra?.ultimoDia], [false, null, null, haceTres], 'el borde de los 3 días, o un día en cero cuenta como entrega');
  assert.equal(tercera?.entregando, true);
  assert.ok(sinNombre && sinNombre.impresiones >= 777, 'el anuncio sin nombre se descartó');
  assert.ok(!todas.some((x) => x.pieza === ''), 'quedó una pieza con nombre vacío');
});

test('los calificados: ICP de 75 o más, sin el cero, un texto ni un decimal', async () => {
  await limpiar();
  await esc.admin.query(`insert into negocio.carpetas_del_crm (org_id, carpeta_id, nombre, visto_el) values ($1, $2, 'Prueba', now()) on conflict do nothing`, [esc.org, CARPETA]);
  await esc.admin.query(
    `insert into negocio.campos_del_crm (org_id, campo_id, nombre, carpeta_id, tipo, posicion, visto_el) values ($1, $2, $3, $4, 'TEXT', '1', now()) on conflict do nothing`,
    [esc.org, CAMPO, CAMPO_DE_ICP, CARPETA],
  );
  // `90.5` no es un puntaje: la validación es la de la sincronización, un entero de 0 a 100 (C6 · D4).
  for (const icp of ['75', '90', '90.5', '74.9', '0', 'alto', null]) await unLead({ pieza: PIEZA, icp });
  const f = (await enAlfa(() => calidadDelCreativo(30))).filas.filter((x) => x.creativo === PIEZA);
  await limpiar();
  assert.equal(f.reduce((s, x) => s + x.calificados, 0), 2, 'contó otro umbral, el cero, un texto o un decimal');
  assert.equal(f.reduce((s, x) => s + x.contactos, 0), 7);
});

test('la miniatura de la pieza: la más frecuente; empate, la del contacto más nuevo; sólo hosts permitidos', async () => {
  await limpiar();
  const ALFA = 'https://www.facebook.com/ads/image/?d=alfa';
  const ZETA = 'https://www.facebook.com/ads/image/?d=zeta';
  // La más frecuente entra PRIMERO y es la mayor alfabéticamente: sólo la frecuencia la hace ganar.
  await unLead({ pieza: PIEZA, video: ZETA });
  await unLead({ pieza: PIEZA, video: ZETA });
  await unLead({ pieza: PIEZA, video: ALFA });
  await unLead({ pieza: PIEZA, video: null });
  await unLead({ pieza: OTRA, video: 'https://evil.example.com/x.jpg' });
  await unLead({ pieza: OTRA, video: 'https://evil.example.com/x.jpg' });
  await unLead({ pieza: OTRA, video: ALFA });
  // Empate: la del contacto que entró al CRM más tarde, aunque se haya guardado antes y vaya después en el abecedario.
  await unLead({ pieza: TERCERA, video: ZETA, haceDias: 2 });
  await unLead({ pieza: TERCERA, video: ALFA, haceDias: 20 });
  // Sin video, la foto; y una URL larga, dentro del tope de la tabla, se dibuja igual.
  const LARGA = `https://www.facebook.com/ads/image/?d=${'x'.repeat(900)}`;
  await unLead({ pieza: CUARTA, foto: 'https://scontent.xx.fbcdn.net/foto.jpg' });
  const m = await enAlfa(() => miniaturasDeLasPiezas());
  await unLead({ pieza: CUARTA, video: LARGA });
  await unLead({ pieza: CUARTA, video: LARGA });
  const m2 = await enAlfa(() => miniaturasDeLasPiezas());
  await limpiar();
  assert.equal(m.get(PIEZA), ZETA, 'no eligió la más frecuente');
  assert.equal(m.get(OTRA), ALFA, 'eligió una URL de un host que no está permitido');
  assert.equal(m.get(TERCERA), ZETA, 'el empate no fue para el contacto más nuevo');
  assert.equal(m.get(CUARTA), 'https://scontent.xx.fbcdn.net/foto.jpg', 'sin video no tomó la foto');
  assert.equal(m2.get(CUARTA), LARGA, 'una miniatura de más de 500 caracteres no se dibuja');
});

test('la miniatura va a la pieza de su ANUNCIO, aunque el contacto no traiga utmContent', async () => {
  /* Los contactos que traen imagen son los de un anuncio de Instagram (DM), y llegan sin UTMs: en producción, 2 de las
     3 imágenes no tenían pieza por eso, y la pantalla no mostraba ninguna (2026-10-15). La pieza sale del anuncio. */
  await limpiar();
  await unaCampana(`${MARCA}01`, 'NUEVA ERA | TOFU | LEADS');
  await unAnuncio(`${MARCA}21`, ' Pieza-CF1-Uno ', `${MARCA}01`);
  await unAnuncio(`${MARCA}22`, OTRA, `${MARCA}01`);
  const DEL_DM = 'https://www.facebook.com/ads/image/?d=dm';
  const RENOMBRADO = 'https://www.facebook.com/ads/image/?d=renombrado';
  await unLead({ pieza: null, adId: `${MARCA}21`, video: DEL_DM });
  // Un utmContent viejo (el anuncio se renombró): gana el nombre ACTUAL del anuncio, que es el de la pantalla.
  await unLead({ pieza: 'nombre-viejo-del-anuncio', adId: `${MARCA}22`, video: RENOMBRADO });
  // Sin anuncio conocido y sin utmContent: no hay pieza a la que darle la imagen.
  await unLead({ pieza: null, adId: `${MARCA}99`, video: 'https://www.facebook.com/ads/image/?d=huerfana' });
  const m = await enAlfa(() => miniaturasDeLasPiezas());
  await limpiar();
  assert.equal(m.get(PIEZA), DEL_DM, 'la imagen de un contacto sin utmContent no llegó a la pieza de su anuncio');
  assert.equal(m.get(OTRA), RENOMBRADO, 'ganó el utmContent viejo y no el nombre actual del anuncio');
  assert.ok(!m.has('nombre-viejo-del-anuncio'), 'quedó una pieza con el nombre viejo');
  assert.equal([...m.values()].filter((u) => u.endsWith('huerfana')).length, 0, 'una imagen sin pieza se asignó a algo');
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
