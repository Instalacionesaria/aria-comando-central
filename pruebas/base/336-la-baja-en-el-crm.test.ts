// LA BAJA EN EL CRM (la `108`): las filas viejas se releen y se marcan, nunca se borran. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (las filas viejas, paso a paso, 2026-10-29)
//
// Medido en producción: 41 contactos congelados que nadie relee (65,7 días el más viejo) y 4 citas de la ventana que
// dejaron de releerse con su contacto. Lo que se construyó, y lo que pone rojo cada prueba:
//
//   · la relectura de los congelados (`releerLosCongelados`): un 200 refresca y descongela, un 404 marca la baja, otro
//     rechazo no marca nada; los leídos hace menos de un día y los que ya tienen baja no se piden; el más viejo
//     primero, con tope; un 401 corta la pasada — mutaciones: marcar con cualquier fallo, sacar el filtro del día,
//     sacar el de la baja, ordenar al revés, no cortar con el 401;
//   · el refresco de la ficha (`refrescarUnContacto`) marca con un 404 y `guardar()` limpia la baja con un 200;
//   · las cifras: una cita con baja no es alcanzable (`alcanzable()`), y el aviso de frescura cuenta las del período
//     sin releer — mutación: sacar la baja de `alcanzable()`;
//   · las cohortes: un contacto con baja SIGUE contando como entrada en el Leads Portal, marcado, y su ficha dice
//     «borrado en el CRM» de él y de su cita.
//
// El GoHighLevel falso intercepta `globalThis.fetch`, como `98-closer-sincronizar`: la única salida del proyecto.
// Los contactos son de un cliente propio de alfa (`baja-336`), así que la relectura —que mira a TODOS los congelados
// a la vista— sólo ve los de este archivo.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';
import { refrescarUnContacto, releerLosCongelados } from '../../lib/negocio/sincronizar.ts';
import { citasSinReleer, textoDeCitasSinReleer } from '../../lib/negocio/citasSinReleer.ts';
import { tasaDeCancelacion } from '../../lib/negocio/indicadoresDeCitas.ts';
import { calidadDelCreativo } from '../../lib/negocio/calidadDelCreativo.ts';
import { leadsDelPortal } from '../../lib/negocio/leadsDelPortal.ts';
import { fichaDelLeadDelPortal } from '../../lib/negocio/fichaDelLeadDelPortal.ts';

const MARCA = 'baja336';
const GHL = 'https://services.leadconnectorhq.com';
const ACCESO = { token: 'token-de-prueba', locationId: 'loc-de-prueba' };

let admin: Client;
let alfa: string;
let cuenta: string;
const fetchOriginal = globalThis.fetch;

/** Lo que el GoHighLevel falso contesta a `GET /contacts/{id}`, por id; lo que no está, 500. */
let respuestas: Record<string, { estado: number; cuerpo: unknown }> = {};
/** Los ids que se pidieron, en orden. */
let pedidos: string[] = [];

const ambito = () => ambitoDeUnCliente(alfa, cuenta);

async function limpiar(): Promise<void> {
  await admin.query(`delete from negocio.citas where ghl_evento_id like $1`, [`${MARCA}-%`]);
  await admin.query(`delete from negocio.contactos where ghl_contact_id like $1`, [`${MARCA}-%`]);
}

/** Un contacto del cliente `baja-336`, con su territorio y la edad de su última lectura. */
async function contacto(
  nombre: string,
  campos: { territorio?: string | null; leidoHaceHoras?: number; baja?: boolean; altaHaceDias?: number } = {},
): Promise<{ id: string; ghl: string }> {
  const ghl = `${MARCA}-${randomUUID().slice(0, 8)}`;
  const f = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, sincronizado_el, baja_en_el_crm, alta_en_el_crm)
     values ($1, $2, $3, $4, $5, now() - make_interval(hours => $6), case when $7 then now() end,
             now() - make_interval(days => $8)) returning id`,
    [
      alfa,
      cuenta,
      ghl,
      nombre,
      campos.territorio === undefined ? null : campos.territorio,
      campos.leidoHaceHoras ?? 48,
      campos.baja === true,
      campos.altaHaceDias ?? 2,
    ],
  );
  assert.ok(f);
  return { id: f.id, ghl };
}

/** Una cita del contacto, en la tabla. */
async function cita(
  contactoId: string,
  campos: { haceDias: number; leidaHaceDias?: number; baja?: boolean; estado?: string },
): Promise<void> {
  await admin.query(
    `insert into negocio.citas (org_id, cuenta_id, contacto_id, ghl_evento_id, inicio_el, ghl_calendario_id, estado_ghl,
                                sincronizado_el, baja_en_el_crm)
     values ($1, $2, $3, $4, now() - make_interval(days => $5), 'cal-336', $6, now() - make_interval(days => $7),
             case when $8 then now() end)`,
    [alfa, cuenta, contactoId, `${MARCA}-ev-${randomUUID().slice(0, 8)}`, campos.haceDias, campos.estado ?? 'confirmed', campos.leidaHaceDias ?? 0, campos.baja === true],
  );
}

const delCrm = (ghl: string, etiquetas: string[]) => ({
  estado: 200,
  cuerpo: { contact: { id: ghl, firstName: 'Releído', lastName: MARCA, tags: etiquetas } },
});

async function filaDe(ghl: string) {
  return unaFila<{ territorio: string | null; baja: boolean; nombre: string; fresco: boolean }>(
    admin,
    `select territorio, baja_en_el_crm is not null as baja, nombre, sincronizado_el > now() - interval '1 minute' as fresco
       from negocio.contactos where ghl_contact_id = $1`,
    [ghl],
  );
}

before(async () => {
  admin = await conectar('admin');
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'alfa'`);
  assert.ok(o);
  alfa = o.id;
  await limpiar();
  await admin.query(`delete from identidad.cuentas where org_id = $1 and slug = 'baja-336'`, [alfa]);
  const c = await unaFila<{ id: string }>(
    admin,
    // Activo: el alta de un contacto en su ámbito necesita la cuenta. Se borra en el `after` (las pruebas corren de a una).
    `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Baja 336', 'baja-336') returning id`,
    [alfa],
  );
  assert.ok(c);
  cuenta = c.id;
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const url = typeof entrada === 'string' ? entrada : String((entrada as Request).url ?? entrada);
    const id = url.startsWith(`${GHL}/contacts/`) ? decodeURIComponent(url.slice(`${GHL}/contacts/`.length)) : url;
    pedidos.push(id);
    const r = respuestas[id] ?? { estado: 500, cuerpo: { message: 'no previsto' } };
    return new Response(JSON.stringify(r.cuerpo), { status: r.estado, headers: { 'content-type': 'application/json' } });
  }) as typeof globalThis.fetch;
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  try {
    await limpiar();
    await admin.query(`delete from identidad.cuentas where id = $1`, [cuenta]);
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('la relectura de los congelados: 200 refresca y descongela, 404 marca la baja, otro rechazo no marca nada', async () => {
  await limpiar();
  const vuelve = await contacto('Vuelve a la zona', { leidoHaceHoras: 30 });
  const borrado = await contacto('Borrado en el CRM', { leidoHaceHoras: 40 });
  const falla = await contacto('El CRM falla', { leidoHaceHoras: 50 });
  const sigue = await contacto('Sigue congelado', { leidoHaceHoras: 60 });
  const reciente = await contacto('Leído hace un rato', { leidoHaceHoras: 2 });
  const yaDeBaja = await contacto('Ya tenía baja', { leidoHaceHoras: 90, baja: true });
  const activo = await contacto('Tiene zona', { territorio: 'closer', leidoHaceHoras: 70 });
  respuestas = {
    [vuelve.ghl]: delCrm(vuelve.ghl, ['zona_closer']),
    [borrado.ghl]: { estado: 404, cuerpo: { message: 'not found' } },
    [falla.ghl]: { estado: 502, cuerpo: { message: 'mal' } },
    [sigue.ghl]: delCrm(sigue.ghl, ['otra']),
  };
  pedidos = [];

  const r = await conOrganizacion(ambito(), () => releerLosCongelados(ACCESO));

  // Los congelados sin baja leídos hace más de un día, el más viejo primero. Ni el reciente, ni el que ya tenía baja,
  // ni el que tiene zona (a ése lo trae la búsqueda por etiqueta).
  assert.deepEqual(pedidos, [sigue.ghl, falla.ghl, borrado.ghl, vuelve.ghl], 'se pidieron otros, o en otro orden');
  assert.deepEqual(r, { pedidos: 4, releidos: 2, dadosDeBaja: 1, fallidos: 1, cortada: false });
  assert.deepEqual(await filaDe(vuelve.ghl), { territorio: 'closer', baja: false, nombre: `Releído ${MARCA}`, fresco: true }, 'un 200 con la zona no lo descongeló');
  assert.deepEqual(await filaDe(sigue.ghl), { territorio: null, baja: false, nombre: `Releído ${MARCA}`, fresco: true }, 'un 200 sin zona no refrescó la foto');
  assert.deepEqual(await filaDe(borrado.ghl), { territorio: null, baja: true, nombre: 'Borrado en el CRM', fresco: false }, 'un 404 no marcó la baja, o tocó la foto');
  assert.deepEqual(await filaDe(falla.ghl), { territorio: null, baja: false, nombre: 'El CRM falla', fresco: false }, 'un 502 marcó la baja');
  assert.equal((await filaDe(reciente.ghl))?.baja, false);
  assert.equal((await filaDe(yaDeBaja.ghl))?.baja, true);
  assert.equal((await filaDe(activo.ghl))?.territorio, 'closer');

  // La pasada siguiente: sólo vuelve a pedir el que falló. Los releídos son de hace un rato, el borrado tiene baja.
  pedidos = [];
  await conOrganizacion(ambito(), () => releerLosCongelados(ACCESO));
  assert.deepEqual(pedidos, [falla.ghl], 'la segunda pasada volvió a pedir uno releído o uno dado de baja');
});

test('la relectura respeta el tope (el más viejo primero) y un 401 corta la pasada', async () => {
  await limpiar();
  const viejo = await contacto('El más viejo', { leidoHaceHoras: 100 });
  const medio = await contacto('El del medio', { leidoHaceHoras: 80 });
  await contacto('El más nuevo', { leidoHaceHoras: 30 });
  respuestas = { [viejo.ghl]: { estado: 401, cuerpo: { message: 'token' } }, [medio.ghl]: delCrm(medio.ghl, []) };

  pedidos = [];
  const r = await conOrganizacion(ambito(), () => releerLosCongelados(ACCESO, 2));
  assert.deepEqual(pedidos, [viejo.ghl], 'un 401 no cortó la pasada: se gastó el resto en el mismo rechazo');
  assert.equal(r.cortada, true);
  assert.equal((await filaDe(viejo.ghl))?.baja, false, 'un 401 marcó la baja');

  respuestas[viejo.ghl] = delCrm(viejo.ghl, []);
  pedidos = [];
  await conOrganizacion(ambito(), () => releerLosCongelados(ACCESO, 2));
  assert.deepEqual(pedidos, [viejo.ghl, medio.ghl], 'el tope no se respetó, o no fue el más viejo primero');

  // El plazo de la corrida: vencido, no se pide nada.
  pedidos = [];
  const sinTiempo = await conOrganizacion(ambito(), () => releerLosCongelados(ACCESO, 40, { fin: 0, ahora: () => 1 }));
  assert.deepEqual(pedidos, []);
  assert.equal(sinTiempo.cortada, true);
});

test('un 200 sin el contacto adentro NO es un 404: ni la relectura ni la ficha marcan la baja', async () => {
  await limpiar();
  const raro = await contacto('Respuesta rara', { leidoHaceHoras: 30 });
  respuestas = { [raro.ghl]: { estado: 200, cuerpo: { otra: 'forma' } } };
  pedidos = [];
  const r = await conOrganizacion(ambito(), () => releerLosCongelados(ACCESO));
  assert.deepEqual(pedidos, [raro.ghl]);
  assert.deepEqual(r, { pedidos: 1, releidos: 0, dadosDeBaja: 0, fallidos: 1, cortada: false }, 'un 200 raro se contó como baja');
  const ficha = await conOrganizacion(ambito(), () => refrescarUnContacto(ACCESO, raro.ghl));
  assert.equal(ficha.tipo, 'fallo', 'la ficha dijo «no está en el CRM» con un 200');
  assert.equal((await filaDe(raro.ghl))?.baja, false, 'un 200 sin el contacto marcó la baja');
});

test('el refresco de la ficha marca la baja con un 404, y el CRM que lo devuelve se la quita', async () => {
  await limpiar();
  const c = await contacto('Ficha abierta', { territorio: 'closer' });
  respuestas = { [c.ghl]: { estado: 404, cuerpo: { message: 'not found' } } };
  const r = await conOrganizacion(ambito(), () => refrescarUnContacto(ACCESO, c.ghl));
  assert.deepEqual(r, { tipo: 'no_esta_en_el_crm' });
  assert.deepEqual(await filaDe(c.ghl), { territorio: 'closer', baja: true, nombre: 'Ficha abierta', fresco: false }, 'el 404 no marcó la baja o tocó la fila');

  // Otro rechazo no la toca.
  respuestas = { [c.ghl]: { estado: 500, cuerpo: {} } };
  await conOrganizacion(ambito(), () => refrescarUnContacto(ACCESO, c.ghl));
  assert.equal((await filaDe(c.ghl))?.baja, true);

  respuestas = { [c.ghl]: delCrm(c.ghl, ['zona_setter']) };
  const de = await conOrganizacion(ambito(), () => refrescarUnContacto(ACCESO, c.ghl));
  assert.deepEqual(de, { tipo: 'listo', territorio: 'setter' });
  assert.equal((await filaDe(c.ghl))?.baja, false, 'el CRM lo devolvió y siguió con baja');
});

test('las cifras: una cita con baja no es alcanzable, y el aviso cuenta las del período sin releer', async () => {
  await limpiar();
  const c = await contacto('Con citas', { territorio: 'closer' });
  await cita(c.id, { haceDias: 3, leidaHaceDias: 0 });
  // Salieron de la ventana del barrido hace más de 14 días: su última lectura es de hace 15 y 16.
  await cita(c.id, { haceDias: 29, leidaHaceDias: 15 });
  await cita(c.id, { haceDias: 28, leidaHaceDias: 16, estado: 'cancelled' });
  // Y una de hace 20 días, leída hace 6: no se relee más, pero todavía no hace 14 que no.
  await cita(c.id, { haceDias: 20, leidaHaceDias: 6 });
  await cita(c.id, { haceDias: 29, leidaHaceDias: 15, baja: true, estado: 'cancelled' });

  const aviso = await conOrganizacion(ambito(), () => citasSinReleer(30));
  assert.deepEqual(aviso, {
    total: 4,
    sinReleer: 2,
    dias: 14,
    texto: '2 de 4 citas del período no se releen desde hace más de 14 días.',
  }, 'el aviso contó la cita borrada en el CRM, o no contó las viejas');
  // La tasa de cancelación tampoco ve la borrada: 1 cancelada de 4, no 2 de 5.
  const t = await conOrganizacion(ambito(), () => tasaDeCancelacion(30));
  assert.equal(t.citas, 4, 'la tasa de cancelación contó la cita borrada en el CRM');
  assert.equal(t.canceladas, 1);
  // Y el aviso de la tasa la declara entre las que no se cuentan: sacarla en silencio es la cifra que miente.
  assert.equal(t.congeladas, 1, 'la cita borrada en el CRM salió de la tasa sin que el aviso la cuente');
  // Lo mismo en Creative: su «no se cuentan N citas» es el mismo texto sobre la cohorte de contactos.
  const cr = await conOrganizacion(ambito(), () => calidadDelCreativo(30));
  assert.equal(cr.congeladas, 1, 'Creative sacó la cita borrada en el CRM sin contarla en su aviso');
  // El período que no alcanza las viejas: silencio.
  assert.equal((await conOrganizacion(ambito(), () => citasSinReleer(7))).texto, null);
});

test('la frase del aviso, en singular y en plural, y con cero no hay frase', () => {
  assert.equal(textoDeCitasSinReleer(0, 5, 14), null);
  assert.equal(textoDeCitasSinReleer(1, 1, 14), '1 de 1 cita del período no se relee desde hace más de 14 días.');
  assert.equal(textoDeCitasSinReleer(1, 4, 14), '1 de 4 citas del período no se relee desde hace más de 14 días.');
});

test('la cohorte: un contacto borrado en el CRM sigue contando como entrada, marcado, y la ficha lo dice', async () => {
  await limpiar();
  const borrado = await contacto('Entró y lo borraron', { territorio: null, baja: true, altaHaceDias: 3, leidoHaceHoras: 30 });
  const vivo = await contacto('Entró y sigue', { territorio: 'closer', altaHaceDias: 3 });
  await cita(borrado.id, { haceDias: 2, baja: true });

  const lp = await conOrganizacion(ambito(), () => leadsDelPortal(7));
  const ids = lp.leads.map((l) => l.id);
  assert.ok(ids.includes(borrado.id) && ids.includes(vivo.id), 'la baja sacó al contacto de la cohorte');
  assert.equal(lp.cohorte.total, 2);
  const fila = lp.leads.find((l) => l.id === borrado.id)!;
  assert.equal(fila.bajaEnElCrm, true);
  assert.equal(fila.territorio, 'congelado');
  assert.ok(fila.leidoEl && Date.now() - Date.parse(fila.leidoEl) > 29 * 3_600_000, 'la fila no dice de cuándo es la última lectura');
  // Su única cita está borrada: no agendó (no es alcanzable).
  assert.notEqual(fila.cita, 'agendo', 'una cita borrada en el CRM contó como «agendó»');
  assert.equal(lp.leads.find((l) => l.id === vivo.id)!.bajaEnElCrm, false);

  const ficha = await conOrganizacion(ambito(), () => fichaDelLeadDelPortal(borrado.id));
  assert.ok(ficha?.bajaEnElCrmEl, 'la ficha no dice que el contacto está borrado en el CRM');
  assert.deepEqual(ficha.citas.map((x) => ({ alcanzable: x.alcanzable, borrada: x.borrada })), [{ alcanzable: false, borrada: true }]);

  const quedan = await filas<{ n: number }>(admin, `select count(*)::int as n from negocio.contactos where id = $1`, [borrado.id]);
  assert.equal(quedan[0]?.n, 1, 'la baja borró la fila');
});
