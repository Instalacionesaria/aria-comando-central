// El link manual de una pieza de Creative: la ruta, la base y la auditoría. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE AFIRMA, Y LA MUTACIÓN QUE CADA COSA TIENE QUE PONER EN ROJO
//
// El link manual es el respaldo del video (docs/creative/15, C15-06): un «Ver en Facebook» que abre
// el post de la pieza. Se vigila lo que haría que llevara a otro lado o que lo cargara quien no debe:
//
//   · quien administra lo carga y queda auditado — mutación: no auditar;
//   · el rol `usuario` NO lo carga, aunque tenga la pestaña — mutación: pedir `tablero.ver`;
//   · una pieza que no es de la empresa da 404 — mutación: saltear `existeLaPieza`;
//   · la base rechaza una pieza sin normalizar y un link sin `https://` — mutación: quitar el `check`;
//   · un link guardado que hoy no pasa la validación no viaja — mutación: no filtrar en la lectura.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { leerRespuesta, montar, pedirComo, sesionDe, type Escenario } from '../apoyo/closer.ts';
import { enlacesDeLasPiezas } from '../../lib/negocio/enlaceDeLaPieza.ts';
import { DELETE as sacarEnlace, PUT as cargarEnlace } from '../../app/api/creative/enlace/route.ts';

let esc: Escenario;
/** Los anuncios de este archivo llevan esta marca en el id, para limpiarlos sin tocar los de otros. */
const MARCA = '178000';
const CORREO_COMUN = 'comun@enlace-pieza.ejemplo';
/** La pieza sembrada: el nombre del anuncio lleva mayúsculas y un espacio; la pieza, no. */
const NOMBRE = `  Hook ${MARCA} Uno `;
const PIEZA = `hook ${MARCA} uno`;
const AJENA = `ajena ${MARCA}`;
const URL_BUENA = 'https://www.facebook.com/reel/178000111';

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.enlaces_de_pieza');
  await esc.admin.query(`delete from negocio.anuncios where meta_anuncio_id like '${MARCA}%'`);
  await esc.admin.query(`delete from identidad.usuarios where email = $1`, [CORREO_COMUN]);
}

before(async () => {
  esc = await montar('EnlacePieza');
  await limpiar();
  await esc.admin.query(
    `insert into negocio.anuncios (org_id, meta_anuncio_id, meta_conjunto_id, meta_campana_id, nombre, objetivo)
     values ($1, $2, '7700', '8800', $3, 'OUTCOME_LEADS'), ($4, $5, '7700', '8800', $6, 'OUTCOME_LEADS')`,
    [esc.org, `${MARCA}1`, NOMBRE, esc.otraOrg, `${MARCA}2`, AJENA],
  );
});
after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

/** Carga el link como la persona del token. */
function cargar(token: string, cuerpo: unknown): Promise<Response> {
  return cargarEnlace(pedirComo('/api/creative/enlace', token, { metodo: 'PUT', cuerpo }));
}

/** Las filas de auditoría de este archivo, en orden. */
async function auditoria(): Promise<{ accion: string; enlace: string; pieza: string }[]> {
  const { rows } = await esc.admin.query<{ accion: string; enlace: string; pieza: string }>(
    `select accion, detalle->>'enlace' as enlace, detalle->>'pieza' as pieza
       from identidad.auditoria_accesos
      where accion like 'enlace_de_pieza%' and detalle->>'pieza' like $1
      order by creado_el, id`,
    [`%${MARCA}%`],
  );
  return rows;
}

test('quien administra carga el link, lo reemplaza y lo saca, y las tres cosas quedan auditadas', async () => {
  await esc.admin.query('delete from negocio.enlaces_de_pieza');
  const antes = (await auditoria()).length;

  const alta = await leerRespuesta<{ enlaces: { pieza: string; url: string; red: string }[] }>(
    await cargar(esc.token, { pieza: PIEZA, url: URL_BUENA }),
  );
  assert.equal(alta.estado, 200);
  assert.deepEqual(
    alta.cuerpo.enlaces.map((e) => [e.pieza, e.url, e.red]),
    [[PIEZA, URL_BUENA, 'facebook']],
  );

  // Una pieza tiene UN link: el segundo reemplaza al primero, no se suma.
  const otro = 'https://www.instagram.com/reel/178000222/';
  const cambio = await leerRespuesta<{ enlaces: { url: string; red: string }[] }>(
    await cargar(esc.token, { pieza: PIEZA, url: otro }),
  );
  assert.deepEqual(cambio.cuerpo.enlaces.map((e) => [e.url, e.red]), [[otro, 'instagram']]);

  const baja = await sacarEnlace(
    pedirComo(`/api/creative/enlace?pieza=${encodeURIComponent(PIEZA)}`, esc.token, { metodo: 'DELETE' }),
  );
  assert.equal(baja.status, 200);
  assert.deepEqual((await leerRespuesta<{ enlaces: unknown[] }>(baja)).cuerpo.enlaces, []);

  const filas = (await auditoria()).slice(antes);
  assert.deepEqual(
    filas.map((f) => [f.accion, f.enlace, f.pieza]),
    [
      ['enlace_de_pieza_cargado', URL_BUENA, PIEZA],
      ['enlace_de_pieza_cargado', otro, PIEZA],
      // El borrado registra el link que se SACÓ, que después ya no está en ningún otro lado.
      ['enlace_de_pieza_borrado', otro, PIEZA],
    ],
    'la auditoría no dice qué link se cargó o se sacó, ni de qué pieza',
  );

  // Sacar lo que ya no está es un 404, no un 200 que diga «borrado».
  const otraVez = await sacarEnlace(
    pedirComo(`/api/creative/enlace?pieza=${encodeURIComponent(PIEZA)}`, esc.token, { metodo: 'DELETE' }),
  );
  assert.equal(otraVez.status, 404);
});

test('el rol `usuario` no carga links, aunque tenga la pestaña Creative', async () => {
  /* La pestaña se concede a propósito: el rol `usuario` es el único con secciones restringidas, así
     que sin ella el 403 saldría del alcance por sección y la CAPACIDAD ni se miraría — y la prueba
     dejaría pasar una ruta que pida `tablero.ver`. Es lo que `100-enlaces-rapidos` midió. */
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash, creado_por)
     values ($1, 'Persona comun', $2, 'scrypt$16384$8$1$c2FsCg==$aGFzaAo=', null) returning id`,
    [esc.org, CORREO_COMUN],
  );
  const id = rows[0]!.id;
  await esc.admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id)
     select $1, r.id from identidad.roles r where r.clave = 'usuario' and r.org_id is null`,
    [id],
  );
  await esc.admin.query(
    `insert into identidad.usuarios_secciones (usuario_id, seccion, concedida_por) values ($1, 'creative', $2)`,
    [id, esc.quien],
  );

  const r = await cargar(await sesionDe(id), { pieza: PIEZA, url: URL_BUENA });
  assert.equal(r.status, 403, 'una persona con el rol `usuario` cargó un link');
  const { rows: quedan } = await esc.admin.query('select 1 from negocio.enlaces_de_pieza');
  assert.equal(quedan.length, 0);
});

test('una pieza que no es de la empresa da 404, igual que una que no existe', async () => {
  await esc.admin.query('delete from negocio.enlaces_de_pieza');
  // La pieza de la otra empresa y una inventada reciben la MISMA respuesta (`ADR-0501`).
  for (const pieza of [AJENA, `no existe ${MARCA}`]) {
    const r = await cargar(esc.token, { pieza, url: URL_BUENA });
    assert.equal(r.status, 404, `la pieza «${pieza}» no dio 404`);
  }
  // Y el nombre sin normalizar tampoco es la pieza: la llave es la de la base, no la que llega.
  assert.equal((await cargar(esc.token, { pieza: NOMBRE, url: URL_BUENA })).status, 404);
});

test('un link que no es de Facebook o Instagram, o que no es https, se rechaza con su motivo', async () => {
  for (const url of ['https://evilfacebook.com/reel/1', 'http://www.facebook.com/reel/1', 'javascript:alert(1)']) {
    const r = await leerRespuesta<{ codigo: string; motivo?: string }>(
      await cargar(esc.token, { pieza: PIEZA, url }),
    );
    assert.equal(r.estado, 400, `aceptó ${url}`);
  }
  assert.equal((await cargar(esc.token, { pieza: PIEZA })).status, 400);
  assert.equal((await cargar(esc.token, { url: URL_BUENA })).status, 400);
});

test('la base rechaza una pieza sin normalizar y un link sin https, aunque no se pase por la ruta', async () => {
  // `23514` es la violación de un `check`. Mutación: quitar cualquiera de los dos de la 063.
  const insertar = (pieza: string, url: string) =>
    esc.admin.query('insert into negocio.enlaces_de_pieza (org_id, pieza, url) values ($1, $2, $3)', [
      esc.org,
      pieza,
      url,
    ]);
  await assert.rejects(insertar('Hook Uno', URL_BUENA), { code: '23514' });
  await assert.rejects(insertar(' hook uno', URL_BUENA), { code: '23514' });
  await assert.rejects(insertar('', URL_BUENA), { code: '23514' });
  await assert.rejects(insertar('hook uno', 'http://www.facebook.com/x'), { code: '23514' });
});

test('los links de otra empresa no se ven, y uno guardado que hoy no valida no viaja', async () => {
  await esc.admin.query('delete from negocio.enlaces_de_pieza');
  await esc.admin.query(
    `insert into negocio.enlaces_de_pieza (org_id, pieza, url) values
       ($1, $2, $3), ($1, $4, 'https://evil.com/escrito-a-mano'), ($5, $6, $7)`,
    [esc.org, PIEZA, URL_BUENA, `otra ${MARCA}`, esc.otraOrg, AJENA, 'https://www.facebook.com/de-la-otra'],
  );
  const mios = await conOrganizacion(esc.org, enlacesDeLasPiezas);
  assert.deepEqual(mios.map((e) => e.url), [URL_BUENA], 'viajó un link ajeno o uno que no valida');
  // La otra mitad: la otra empresa ve el suyo. Sin esto, una lectura vacía pasaría la de arriba.
  const suyos = await conOrganizacion(esc.otraOrg, enlacesDeLasPiezas);
  assert.deepEqual(suyos.map((e) => e.url), ['https://www.facebook.com/de-la-otra']);
});
