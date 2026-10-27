// LOS AVISOS DE OPORTUNIDAD QUE QUEDARON SIN PROCESAR SE REPROCESAN. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (revisión final de la estructura, 2026-10-27)
//
// La etapa del Pipeline Maestro y la Salida llegan SÓLO por el aviso del CRM, y la ruta responde 200 aunque la
// interpretación falle. `lib/negocio/reprocesoDeAvisos.ts` las reprocesa en la tarea `contactos` del barrido. Cada
// afirmación dice la mutación que la pone en rojo:
//
//   · un fallo transitorio (GoHighLevel no responde al pedir el contacto nuevo del aviso de «Lead») queda con su motivo
//     y el reproceso lo registra con la MISMA fila: su id, su hora y su rama — mutaciones: otra hora, sin la consulta
//     guardada, no marcar procesado;
//   · la función que se cortó a mitad de camino (sin motivo): el evento que ya estaba no se duplica; una fila sin
//     motivo y RECIENTE no se toca (la ruta puede estar en ella) — mutación: sin los minutos de gracia;
//   · lo que no cambia solo (sin mapear) no se reprocesa; lo que falta la credencial, sí; lo que vuelve a fallar, hasta
//     cinco intentos — mutaciones: tomar todo error, no contar los intentos;
//   · en orden de llegada, con tope por pasada y al fin de la corrida, y sólo los del cliente — mutaciones: el orden al
//     revés, sin el tope, sin el fin de la corrida;
//   · un cuerpo ilegible se anota y no vuelve;
//   · la tarea `contactos` lo corre después de sincronizar y antes de las miniaturas, suma sus llamadas, y el sello dice
//     lo que quedó — mutación: no llamarlo.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { POST as recibirAviso } from '../../app/api/avisos/crm/route.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';
import type { LectorDeContacto } from '../../lib/negocio/avisoDelCrm.ts';
import { motivoDeLoIncompleto } from '../../lib/negocio/barrido.ts';
import {
  MOTIVO_FALLO,
  MOTIVO_SIN_CREDENCIAL,
  reprocesarAvisosDeOportunidad,
} from '../../lib/negocio/reprocesoDeAvisos.ts';

const SLUG = 'reproceso-333';
const PIMIENTA = 'pimienta-333-no-usar';
const LOCATION = 'loc-333';
const ACCESO = { token: 'no-se-usa', locationId: LOCATION };
const RAIZ = process.cwd();

let admin: Client;
let org: string;
let cuenta: string;
let otro: string;
let secreto: string;
let pimientaPrevia: string | undefined;
const fetchOriginal = globalThis.fetch;

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const ambito = () => ambitoDeUnCliente(org, cuenta);

const lectorQueLanza: LectorDeContacto = async () => {
  throw new Error('no tenía que preguntarle al CRM: el contacto ya estaba en la caché');
};
/** GoHighLevel respondió 429 al pedir el contacto. */
const lectorSaturado: LectorDeContacto = async () => ({ tipo: 'fallo', fallo: { tipo: 'demasiadas_peticiones' } }) as never;

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (o) {
    for (const t of ['avisos_del_crm', 'valores_sin_mapear', 'contactos', 'ingesta_pulso']) {
      await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
    }
    await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
    await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
  }
}

async function contacto(ghl: string, enCuenta = cuenta): Promise<string> {
  const f = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm)
     values ($1, $2, $3, 'Contacto 333', 'closer', now()) returning id`,
    [org, enCuenta, ghl],
  );
  assert.ok(f);
  return f.id;
}

const etapaDe = async (id: string) =>
  (await unaFila<{ etapa_estandar: string | null }>(admin, `select etapa_estandar from negocio.contactos where id = $1`, [id]))!.etapa_estandar;

/** Una fila de la cuarentena como la dejó la ruta: su consulta, su hora (al milisegundo) y su motivo. */
async function aviso(o: {
  consulta: string;
  cuerpo: string;
  haceMin: number;
  vistoHaceMin?: number;
  error?: string | null;
  enCuenta?: string;
}): Promise<{ id: string; recibido_el: Date }> {
  const evento = new URLSearchParams(o.consulta).get('evento');
  const f = await unaFila<{ id: string; recibido_el: Date }>(
    admin,
    `insert into negocio.avisos_del_crm (org_id, cuenta_id, huella, evento, cuerpo, bytes, atribucion, consulta, recibido_el, visto_ultimo_el, error)
     values ($1, $2, $3, $4, $5, length($5), 'coincide', $6,
             date_trunc('milliseconds', now() - make_interval(mins => $7::int)), now() - make_interval(mins => $8::int), $9)
     returning id, recibido_el`,
    [org, o.enCuenta ?? cuenta, randomUUID(), evento, o.cuerpo, o.consulta, o.haceMin, o.vistoHaceMin ?? o.haceMin, o.error ?? null],
  );
  assert.ok(f);
  return f;
}

const laFila = (id: string) =>
  unaFila<{ procesado_el: Date | null; error: string | null }>(admin, `select procesado_el, error from negocio.avisos_del_crm where id = $1`, [id]);

const eventosDe = (id: string) =>
  filas<{ id_externo: string; ocurrio_el: Date; datos: Record<string, unknown> }>(
    admin,
    `select id_externo, ocurrio_el, datos from negocio.eventos where org_id = $1 and contacto_id = $2 and tipo in ('etapa_cambiada', 'salida_marcada') order by ocurrio_el`,
    [org, id],
  );

before(async () => {
  admin = await conectar('admin');
  pimientaPrevia = process.env.AVISO_PIMIENTA;
  process.env.AVISO_PIMIENTA = PIMIENTA;
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Reproceso 333', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  cuenta = (await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]))!.id;
  otro = (await unaFila<{ id: string }>(admin, `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Otro 333', 'otro-333') returning id`, [org]))!.id;
  secreto = randomBytes(24).toString('base64url');
  await admin.query(
    `insert into identidad.organizaciones_credenciales (org_id, aviso_secreto_hash, crm_token_cifrado, crm_cuenta_id, crm_estado)
     values ($1, $2, $3, $4, 'activa')`,
    [org, sha256(secreto), cifrar('token-333'), LOCATION],
  );
  // GoHighLevel no responde: es el fallo transitorio del aviso de un contacto nuevo.
  globalThis.fetch = (async () => {
    throw new Error('GoHighLevel no responde (prueba 333)');
  }) as typeof globalThis.fetch;
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  if (pimientaPrevia === undefined) delete process.env.AVISO_PIMIENTA;
  else process.env.AVISO_PIMIENTA = pimientaPrevia;
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('un fallo transitorio del aviso de «Lead» se reprocesa con la misma fila: su id, su hora y su rama', async () => {
  const ghl = `c333-lead-${randomUUID().slice(0, 8)}`;
  const cuerpo = { contactId: ghl, location: { id: LOCATION } };
  const r = await recibirAviso(
    new Request('https://ejemplo.test/api/avisos/crm?evento=oportunidad.etapa&etapa=lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-webhook-secret': `${PIMIENTA}.${secreto}` },
      body: JSON.stringify(cuerpo),
    }),
  );
  assert.equal(r.status, 200);
  assert.equal(((await r.json()) as { porque?: string }).porque, 'fallo_de_mapeo');
  const guardado = await unaFila<{ id: string; recibido_el: Date; error: string | null; consulta: string | null }>(
    admin,
    `select id, recibido_el, error, consulta from negocio.avisos_del_crm where org_id = $1 and cuerpo = $2`,
    [org, JSON.stringify(cuerpo)],
  );
  assert.ok(guardado);
  assert.equal(guardado.error, MOTIVO_FALLO);
  assert.equal(guardado.consulta, 'evento=oportunidad.etapa&etapa=lead');

  // La sincronización trajo el contacto; la pasada siguiente reprocesa sin llamar al CRM.
  const id = await contacto(ghl);
  const pasada = await reprocesarAvisosDeOportunidad(ambito(), ACCESO, { leerContacto: lectorQueLanza });
  assert.deepEqual(pasada, { revisados: 1, procesados: 1, sinProcesar: 0, fallaron: 0, quedan: false, llamadas: 0 });
  assert.equal(await etapaDe(id), 'lead', 'el cambio de etapa del aviso que falló se perdió');
  const ev = await eventosDe(id);
  assert.equal(ev.length, 1);
  assert.equal(ev[0]!.id_externo, `aviso:${guardado.id}:etapa`, 'el reproceso no usó el id del aviso: una reentrega duplicaría');
  assert.equal(ev[0]!.ocurrio_el.getTime(), guardado.recibido_el.getTime(), 'el reproceso no usó la hora del aviso');
  const f = await laFila(guardado.id);
  assert.ok(f?.procesado_el, 'el aviso reprocesado no quedó procesado');
  assert.equal(f?.error, null);

  // La pasada siguiente no tiene nada que hacer.
  assert.equal((await reprocesarAvisosDeOportunidad(ambito(), ACCESO, { leerContacto: lectorQueLanza })).revisados, 0);
});

test('la función que se cortó: el evento que ya estaba no se duplica, y una fila reciente sin motivo no se toca', async () => {
  const ghl = `c333-corte-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl);
  const cuerpo = JSON.stringify({ contactId: ghl });
  // Hace cinco minutos llegó y la función se cortó DESPUÉS de escribir el evento: sin procesar y sin motivo.
  const cortada = await aviso({ consulta: 'evento=oportunidad.etapa&etapa=agendado', cuerpo, haceMin: 5 });
  await reprocesarAvisosDeOportunidad(ambito(), ACCESO, { leerContacto: lectorQueLanza });
  assert.equal((await eventosDe(id)).length, 1);
  await admin.query(`update negocio.avisos_del_crm set procesado_el = null where id = $1`, [cortada.id]);
  const otraVez = await reprocesarAvisosDeOportunidad(ambito(), ACCESO, { leerContacto: lectorQueLanza });
  assert.equal(otraVez.procesados, 1);
  assert.equal((await eventosDe(id)).length, 1, 'reprocesar escribió el mismo hecho dos veces');
  assert.ok((await laFila(cortada.id))?.procesado_el);

  // Una que llegó recién y todavía no tiene motivo puede ser de una ruta que sigue corriendo: no se toca.
  const enCurso = await aviso({ consulta: 'evento=oportunidad.etapa&etapa=asistio', cuerpo, haceMin: 0 });
  const r = await reprocesarAvisosDeOportunidad(ambito(), ACCESO, { leerContacto: lectorQueLanza });
  assert.equal(r.revisados, 0, 'el reproceso tomó una fila que la ruta todavía podía estar procesando');
  assert.equal((await laFila(enCurso.id))?.procesado_el, null);
  await admin.query(`delete from negocio.avisos_del_crm where id = $1`, [enCurso.id]);
});

test('lo que no cambia solo no se reprocesa; sin credencial sí; lo que vuelve a fallar, hasta cinco intentos', async () => {
  const ghl = `c333-motivos-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl);
  const cuerpo = JSON.stringify({ contactId: ghl });
  const sinMapear = await aviso({ consulta: 'evento=oportunidad.etapa&etapa=rara', cuerpo, haceMin: 30, error: 'etapa sin mapear: rara' });
  const sinCredencial = await aviso({
    consulta: 'evento=oportunidad.etapa&etapa=calificado',
    cuerpo,
    haceMin: 20,
    error: `${MOTIVO_SIN_CREDENCIAL}: sin_token_de_crm`,
  });
  const r = await reprocesarAvisosDeOportunidad(ambito(), ACCESO, { leerContacto: lectorQueLanza });
  assert.equal(r.revisados, 1, 'se reprocesó un aviso cuyo motivo no cambia solo');
  assert.equal((await laFila(sinMapear.id))?.error, 'etapa sin mapear: rara');
  assert.ok((await laFila(sinCredencial.id))?.procesado_el, 'el aviso sin credencial no se reprocesó');
  assert.equal(await etapaDe(id), 'calificado');

  // Un contacto que todavía no está y GoHighLevel que sigue saturado: cuenta los intentos, y al quinto para.
  const ghlNuevo = `c333-nuevo-${randomUUID().slice(0, 8)}`;
  const falla = await aviso({ consulta: 'evento=oportunidad.etapa&etapa=lead', cuerpo: JSON.stringify({ contactId: ghlNuevo }), haceMin: 10, error: MOTIVO_FALLO });
  const una = await reprocesarAvisosDeOportunidad(ambito(), ACCESO, { leerContacto: lectorSaturado });
  assert.deepEqual({ fallaron: una.fallaron, llamadas: una.llamadas }, { fallaron: 1, llamadas: 1 });
  assert.equal((await laFila(falla.id))?.error, `reintento 1: ${MOTIVO_FALLO}`);
  assert.match(String(motivoDeLoIncompleto({ avisos: una })), /volvieron a fallar/);
  await admin.query(`update negocio.avisos_del_crm set error = $2 where id = $1`, [falla.id, `reintento 4: ${MOTIVO_FALLO}`]);
  await reprocesarAvisosDeOportunidad(ambito(), ACCESO, { leerContacto: lectorSaturado });
  assert.equal((await laFila(falla.id))?.error, `reintento 5: ${MOTIVO_FALLO}`);
  const agotado = await reprocesarAvisosDeOportunidad(ambito(), ACCESO, { leerContacto: lectorSaturado });
  assert.equal(agotado.revisados, 0, 'un aviso que falló cinco veces se sigue reintentando para siempre');
  await admin.query(`delete from negocio.avisos_del_crm where id = $1`, [falla.id]);
});

test('en orden de llegada, con tope por pasada y al fin de la corrida, y sólo los del cliente', async () => {
  const ghl = `c333-orden-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl);
  const cuerpo = JSON.stringify({ contactId: ghl });
  // Se guardan al revés de como llegaron: el reproceso los toma por su hora.
  const nuevo = await aviso({ consulta: 'evento=oportunidad.salida&salida=no_show', cuerpo, haceMin: 20, error: MOTIVO_FALLO });
  const viejo = await aviso({ consulta: 'evento=oportunidad.etapa&etapa=agendado', cuerpo, haceMin: 40, error: MOTIVO_FALLO });
  const delOtro = await aviso({
    consulta: 'evento=oportunidad.etapa&etapa=venta',
    cuerpo: JSON.stringify({ contactId: `c333-otro-${randomUUID().slice(0, 8)}` }),
    haceMin: 50,
    error: MOTIVO_FALLO,
    enCuenta: otro,
  });

  const sinTiempo = await reprocesarAvisosDeOportunidad(ambito(), ACCESO, { leerContacto: lectorQueLanza, fin: 0, ahora: () => 1 });
  assert.deepEqual({ revisados: sinTiempo.revisados, quedan: sinTiempo.quedan }, { revisados: 0, quedan: true }, 'pasado el fin de la corrida siguió');
  assert.match(String(motivoDeLoIncompleto({ avisos: sinTiempo })), /quedaron avisos/);

  const primera = await reprocesarAvisosDeOportunidad(ambito(), ACCESO, { leerContacto: lectorQueLanza, tope: 1 });
  assert.deepEqual({ revisados: primera.revisados, quedan: primera.quedan }, { revisados: 1, quedan: true });
  assert.ok((await laFila(viejo.id))?.procesado_el, 'no se tomó primero el que llegó primero');
  assert.equal((await laFila(nuevo.id))?.procesado_el, null, 'el tope por pasada no se respetó');
  assert.equal(await etapaDe(id), 'agendado');

  const segunda = await reprocesarAvisosDeOportunidad(ambito(), ACCESO, { leerContacto: lectorQueLanza, tope: 1 });
  assert.equal(segunda.quedan, false);
  assert.ok((await laFila(nuevo.id))?.procesado_el);
  assert.equal((await laFila(delOtro.id))?.procesado_el, null, 'el reproceso de un cliente tocó el aviso de otro');
  assert.equal((await laFila(delOtro.id))?.error, MOTIVO_FALLO);
});

test('un cuerpo ilegible se anota y no vuelve', async () => {
  const ilegible = await aviso({ consulta: 'evento=oportunidad.etapa&etapa=lead', cuerpo: 'no es json', haceMin: 10 });
  const r = await reprocesarAvisosDeOportunidad(ambito(), ACCESO, { leerContacto: lectorQueLanza });
  assert.equal(r.sinProcesar, 1);
  assert.equal((await laFila(ilegible.id))?.error, 'cuerpo ilegible');
  assert.equal((await reprocesarAvisosDeOportunidad(ambito(), ACCESO, { leerContacto: lectorQueLanza })).revisados, 0);
});

test('la tarea `contactos` reprocesa después de sincronizar y antes de las miniaturas, y suma sus llamadas', () => {
  const barrido = readFileSync(join(RAIZ, 'lib/negocio/barrido.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const i = barrido.indexOf('async function releerContactos(');
  const cuerpo = barrido.slice(i, barrido.indexOf('\n}\n', i));
  const reproceso = cuerpo.indexOf('await reprocesarAvisosDeOportunidad(ambito, acceso, { fin, ahora })');
  assert.ok(reproceso > 0, 'la tarea `contactos` no reprocesa los avisos de oportunidad: un fallo transitorio pierde la etapa');
  assert.ok(cuerpo.indexOf('sincronizarContactos(') < reproceso, 'el reproceso va antes de sincronizar: el contacto nuevo no está');
  assert.ok(reproceso < cuerpo.indexOf('completarMiniaturas('), 'el reproceso espera a que sobre tiempo de las miniaturas');
  assert.match(cuerpo, /miniaturas\.pedidos \+ avisos\.llamadas/, 'las llamadas del reproceso no se cuentan');
  assert.match(cuerpo, /resultado: \{ \.\.\.r\.resumen, miniaturas, avisos \}/, 'el sello no lleva el resumen del reproceso');
});
