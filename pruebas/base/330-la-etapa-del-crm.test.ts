// LA ETAPA DEL PIPELINE MAESTRO Y SU SALIDA LLEGAN POR EL AVISO DEL CRM. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el 8.º aviso, ítem 8 de la ESPEC de la estructura, 2026-10-27)
//
// GoHighLevel mueve la etapa del Pipeline Maestro y la Salida en la oportunidad del lead; Comando Central las REGISTRA
// por `?evento=oportunidad.etapa` y `?evento=oportunidad.salida` (`lib/negocio/avisoDelCrm.ts` → `idiomaComun.ts` →
// `etapaDelCrm.ts`, el único escritor). Cada afirmación dice la mutación que la pone en rojo:
//
//   · por la RUTA: el mismo cuerpo con otro `&etapa=` son dos avisos y dos cambios, y repetir uno no duplica nada —
//     mutaciones: la huella sólo del cuerpo, no pasar el aviso guardado, un `ocurrio_el` que no sea el de la fila; y la
//     huella de los demás eventos sigue siendo la del cuerpo — mutación: la huella con la consulta para todos;
//   · un contacto conocido cuesta CERO llamadas (el lector inyectado lanza) — mutación: refrescar siempre;
//   · avanzar deja un `etapa_cambiada` con la forma de su tipo y mueve `etapa_estandar` y su hora; reprocesar no escribe
//     otro — mutaciones: sin `on conflict do nothing`, un `id_externo` al azar;
//   · una etapa menor deja el evento con `retrocede: true` y la vigente no baja — mutaciones: bajar la vigente, no
//     registrar el retroceso, `retrocede` siempre falso;
//   · la Salida: marcarla, avanzar la vacía con su propio `salida_marcada` nulo, `&salida=ninguna` vacía — mutaciones:
//     no vaciar al avanzar, vaciar también al retroceder, leer «ninguna» como una clave;
//   · una REENTREGA de un hecho ya registrado no mueve lo vigente: la Salida vieja no vuelve después de que un avance
//     la vació, y un avance viejo no vacía una Salida posterior ni mueve la etapa — mutaciones: aplicar la Salida (o
//     la etapa) aunque `unEvento` devuelva 0;
//   · FUERA DE ORDEN (la revisión final): un avance más viejo no vacía una Salida más nueva, y una Salida (o una etapa)
//     más vieja que la vigente queda TARDÍA —en la historia con `tardio: true`, contra lo que regía a SU hora (la etapa
//     más alta de las anteriores), y lo vigente no se mueve— — mutaciones: vaciar sin mirar `salida_el`, sin la rama
//     tardía, la anterior o el retroceso contra la vigente, la última etapa en vez de la más alta;
//   · EN CUALQUIER ORDEN, LO MISMO (el cierre): una tardía más ALTA que la vigente la sube con su hora, y su Salida del
//     mismo cambio vale; una Salida de antes del último avance queda tardía aunque ese avance no encontrara ninguna
//     que vaciar — mutaciones: sin subir la tardía, sin comparar la Salida con el avance, el avance sin el del mismo
//     cambio;
//   · por la RUTA, la misma rama con el mismo cuerpo: en minutos es una reentrega; pasados quince, un hecho nuevo con
//     su hora — mutación: sin el `case` del hecho nuevo;
//   · el tope por hora: las oportunidades se cuentan aparte; por encima se GUARDAN (con su consulta) y las procesa el
//     reproceso; los mensajes no se frenan por ellas ni ellas por los mensajes; a diez veces el tope, 429 — mutaciones:
//     un solo conteo, descartar por encima del tope, sin techo, interpretar en espera, no guardar la consulta;
//   · del cuerpo: el Pipeline Maestro (con la errata `pipleline_stage`) sí; OTRO pipeline o un nombre desconocido van a
//     `valores_sin_mapear`, con su campo, y cuentan las apariciones — mutaciones: aceptar cualquier pipeline, no contar,
//     no sumar;
//   · la constante de la URL gana sobre el cuerpo; una mal escrita se cuenta — mutación: el cuerpo primero;
//   · los mapeos: el de la cuenta (por pipeline), `ignorar` (sin contar ni escribir), y el del snapshot del cliente —
//     mutaciones: sin cada escalón;
//   · sin la etapa (o la Salida) que el evento promete: `sin_dato`;
//   · un contacto desconocido se pide UNA vez al CRM y después se registra;
//   · las listas del panel (`ETAPAS_DEL_MAESTRO`, `SALIDAS_DE_LA_OPORTUNIDAD`) son las de la base, en orden;
//   · el contacto se BLOQUEA (`for update`): dos avisos del mismo lead a la vez dejan UN evento — mutación: sin
//     `forUpdate()` (la carrera se fuerza con un candado aparte y `pg_stat_activity`).
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { POST as recibirAviso } from '../../app/api/avisos/crm/route.ts';
import { interpretarAviso, type AvisoGuardado, type Interpretado } from '../../lib/negocio/avisoDelCrm.ts';
import { registrarCambioDelCrm } from '../../lib/negocio/etapaDelCrm.ts';
import { MOTIVO_EN_ESPERA, reprocesarAvisosDeOportunidad } from '../../lib/negocio/reprocesoDeAvisos.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';
import { ETAPAS_DEL_MAESTRO, SALIDAS_DE_LA_OPORTUNIDAD } from '../../lib/ghl/avisos.ts';

const SLUG = 'etapa-330';
const PIMIENTA = 'pimienta-330-no-usar';
const LOCATION = 'loc-330';
const ACCESO = { tipo: 'listo' as const, token: 'no-se-usa', locationId: LOCATION };

let admin: Client;
let org: string;
let cuenta: string;
let snapshot: string | null = null;
let secreto: string;
let pimientaPrevia: string | undefined;
const fetchOriginal = globalThis.fetch;

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const ambito = () => ambitoDeUnCliente(org, cuenta);

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (o) {
    for (const t of ['avisos_del_crm', 'valores_sin_mapear', 'mapeos_de_cuenta', 'contactos', 'ingesta_pulso']) {
      await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
    }
    await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
  }
  await admin.query(`delete from catalogo.mapeos_de_snapshot where valor_origen like 'Etapa del snapshot 330%'`);
  await admin.query(`delete from catalogo.snapshot_versiones where snapshot = 's0_core' and version = 'v330'`);
}

/** Un contacto de este cliente, como lo dejó una sincronización. */
async function contacto(ghl: string, etapa: string | null = null, salida: string | null = null): Promise<string> {
  const f = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, etapa_estandar, salida)
     values ($1, $2, $3, 'Contacto 330', 'closer', now(), $4, $5) returning id`,
    [org, cuenta, ghl, etapa, salida],
  );
  assert.ok(f);
  return f.id;
}

interface Fila {
  etapa_estandar: string | null;
  etapa_estandar_el: Date | null;
  salida: string | null;
  salida_el: Date | null;
  ghl_oportunidad_id: string | null;
}
const fila = async (id: string) =>
  (await unaFila<Fila>(admin, `select etapa_estandar, etapa_estandar_el, salida, salida_el, ghl_oportunidad_id from negocio.contactos where id = $1`, [id]))!;

interface Evento {
  tipo: string;
  id_externo: string;
  ocurrio_el: Date;
  fuente: string;
  actor_tipo: string;
  datos: Record<string, unknown>;
}
const eventos = (id: string) =>
  filas<Evento>(
    admin,
    `select tipo, id_externo, ocurrio_el, fuente, actor_tipo, datos from negocio.eventos
      where org_id = $1 and contacto_id = $2 and tipo in ('etapa_cambiada', 'salida_marcada') order by ocurrio_el, registrado_el, id_externo`,
    [org, id],
  );

/** Un aviso guardado, como lo arma la ruta: su id, su primera llegada y la consulta de la URL. */
const unAviso = (consulta: string, haceSegundos = 60): AvisoGuardado => ({
  id: randomUUID(),
  recibidoEl: new Date(Date.now() - haceSegundos * 1000),
  parametros: new URLSearchParams(consulta),
});

const lectorQueLanza = async (): Promise<never> => {
  throw new Error('no tenía que preguntarle al CRM: el contacto ya estaba en la caché');
};

const interpretar = (evento: string, cuerpo: Record<string, unknown>, aviso: AvisoGuardado) =>
  interpretarAviso(ambito(), ACCESO, evento, cuerpo, lectorQueLanza, aviso);

/** Los datos del evento tienen la forma de su tipo: lo requerido está, y no hay claves fuera del esquema. */
async function conLaFormaDeSuTipo(e: Evento): Promise<void> {
  const t = await unaFila<{ esquema_de_datos: { required?: string[]; properties: Record<string, unknown> } }>(
    admin,
    `select esquema_de_datos from catalogo.tipos_de_evento where clave = $1 and version = 1`,
    [e.tipo],
  );
  assert.ok(t);
  for (const r of t.esquema_de_datos.required ?? []) assert.ok(r in e.datos, `${e.tipo} sin «${r}»`);
  for (const k of Object.keys(e.datos)) assert.ok(k in t.esquema_de_datos.properties, `${e.tipo} con «${k}», que su esquema no tiene`);
}

const sinMapear = (valor: string) =>
  unaFila<{ campo: string; apariciones: number; tipo: string }>(
    admin,
    `select campo, apariciones, tipo from negocio.valores_sin_mapear where org_id = $1 and valor_origen = $2`,
    [org, valor],
  );

before(async () => {
  admin = await conectar('admin');
  pimientaPrevia = process.env.AVISO_PIMIENTA;
  process.env.AVISO_PIMIENTA = PIMIENTA;
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Etapa 330', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  cuenta = (await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]))!.id;
  secreto = randomBytes(24).toString('base64url');
  await admin.query(
    `insert into identidad.organizaciones_credenciales (org_id, aviso_secreto_hash, crm_token_cifrado, crm_cuenta_id, crm_estado)
     values ($1, $2, $3, $4, 'activa')`,
    [org, sha256(secreto), cifrar('token-330'), LOCATION],
  );
  // Ninguna llamada a GoHighLevel: un contacto conocido cuesta cero, y lo que no, falla ruidoso.
  globalThis.fetch = (async () => {
    throw new Error('la prueba 330 no llama a GoHighLevel');
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

/** Un POST como el de GoHighLevel. */
function pedir(consulta: string, cuerpo: unknown): Request {
  return new Request(`https://ejemplo.test/api/avisos/crm?${consulta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-webhook-secret': `${PIMIENTA}.${secreto}` },
    body: JSON.stringify(cuerpo),
  });
}

test('por la ruta: el mismo cuerpo con otro &etapa= son dos cambios, y repetir uno no duplica nada', async () => {
  const ghl = `c330-ruta-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl);
  const cuerpo = { contactId: ghl, opportunityId: 'opp-330-ruta', location: { id: LOCATION } };

  const a = await recibirAviso(pedir('evento=oportunidad.etapa&etapa=agendado', cuerpo));
  const ra = (await a.json()) as { procesado: boolean; historia?: { etapa: string } };
  assert.equal(a.status, 200);
  assert.equal(ra.procesado, true, JSON.stringify(ra));
  assert.equal(ra.historia?.etapa, 'avanzo');

  const b = (await (await recibirAviso(pedir('evento=oportunidad.etapa&etapa=asistio', cuerpo))).json()) as { historia?: { etapa: string } };
  assert.equal(b.historia?.etapa, 'avanzo', 'la segunda rama con el MISMO cuerpo se fundió con la primera: la huella no lleva la URL');

  // La reentrega de la primera: la misma fila, la misma hora, el mismo id del hecho → ningún evento nuevo.
  const c = (await (await recibirAviso(pedir('evento=oportunidad.etapa&etapa=agendado', cuerpo))).json()) as {
    historia?: { etapa: string; eventos: number };
  };
  assert.equal(c.historia?.eventos, 0, 'reentregar el mismo aviso escribió otro evento');

  const avisos = await filas<{ huella: string; repeticiones: number; recibido_el: Date }>(
    admin,
    `select huella, repeticiones, recibido_el from negocio.avisos_del_crm where org_id = $1 and cuerpo like $2 order by recibido_el`,
    [org, `%${ghl}%`],
  );
  assert.equal(avisos.length, 2, 'dos ramas distintas con el mismo cuerpo tienen que ser dos avisos');
  assert.deepEqual(avisos.map((x) => Number(x.repeticiones)), [2, 1]);
  assert.equal(avisos[0]!.huella, sha256(`evento=oportunidad.etapa&etapa=agendado\n${JSON.stringify(cuerpo)}`));

  const ev = await eventos(id);
  assert.deepEqual(ev.map((e) => e.datos.etapa), ['agendado', 'asistio']);
  assert.equal(ev[0]!.ocurrio_el.getTime(), avisos[0]!.recibido_el.getTime(), 'el cambio no tiene la hora de su aviso');
  const f = await fila(id);
  assert.equal(f.etapa_estandar, 'asistio');
  assert.equal(f.etapa_estandar_el?.getTime(), avisos[1]!.recibido_el.getTime());
  assert.equal(f.ghl_oportunidad_id, 'opp-330-ruta', 'no se guardó la oportunidad del cuerpo');

  // Los demás eventos siguen con la huella del cuerpo: cambiarla duplicaría las filas que ya están.
  const otro = { contactId: `c330-otro-${randomUUID().slice(0, 8)}` };
  await recibirAviso(pedir('evento=contacto.actualizado', otro));
  const h = await unaFila<{ huella: string }>(admin, `select huella from negocio.avisos_del_crm where org_id = $1 and cuerpo = $2`, [
    org,
    JSON.stringify(otro),
  ]);
  assert.equal(h?.huella, sha256(JSON.stringify(otro)), 'la huella de un aviso que no es de oportunidad dejó de ser la del cuerpo');
});

test('un contacto conocido no cuesta llamadas; avanzar deja un evento con su forma, y reprocesar no deja otro', async () => {
  const ghl = `c330-avanza-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl);
  const aviso = unAviso('evento=oportunidad.etapa&etapa=calificado', 120);

  const r = await interpretar('oportunidad.etapa', { contactId: ghl }, aviso);
  assert.equal(r.tipo, 'listo', JSON.stringify(r));
  assert.deepEqual(r.tipo === 'listo' && r.historia, { etapa: 'avanzo', salida: 'no_vino', eventos: 1 });

  const ev = await eventos(id);
  assert.equal(ev.length, 1);
  const e = ev[0]!;
  assert.equal(e.tipo, 'etapa_cambiada');
  assert.equal(e.id_externo, `aviso:${aviso.id}:etapa`);
  assert.equal(e.fuente, 'ghl');
  assert.equal(e.actor_tipo, 'sistema');
  assert.equal(e.ocurrio_el.getTime(), aviso.recibidoEl.getTime());
  assert.deepEqual(
    { etapa: e.datos.etapa, anterior: e.datos.etapa_anterior, retrocede: e.datos.retrocede, via: e.datos.via },
    { etapa: 'calificado', anterior: null, retrocede: false, via: 'aviso' },
  );
  await conLaFormaDeSuTipo(e);
  const f = await fila(id);
  assert.equal(f.etapa_estandar, 'calificado');
  assert.equal(f.etapa_estandar_el?.getTime(), aviso.recibidoEl.getTime());

  // Reprocesar el MISMO aviso: la etapa ya es ésa.
  const otraVez = await interpretar('oportunidad.etapa', { contactId: ghl }, aviso);
  assert.deepEqual(otraVez.tipo === 'listo' && otraVez.historia, { etapa: 'igual', salida: 'no_vino', eventos: 0 });
  assert.equal((await eventos(id)).length, 1);

  // Y aunque la etapa vigente cambiara, el mismo hecho no se escribe dos veces (id_externo y hora deterministas).
  await admin.query(`update negocio.contactos set etapa_estandar = 'lead' where id = $1`, [id]);
  const reproceso = await interpretar('oportunidad.etapa', { contactId: ghl }, aviso);
  assert.equal(reproceso.tipo === 'listo' && reproceso.historia?.eventos, 0, 'el mismo aviso escribió su evento dos veces');
  assert.equal((await eventos(id)).length, 1);
});

test('una etapa menor deja el evento con retrocede, y la vigente no baja', async () => {
  const ghl = `c330-atras-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl, 'agendado');
  const antes = await fila(id);
  const r = await interpretar('oportunidad.etapa', { contactId: ghl }, unAviso('etapa=conversacion'));
  assert.equal(r.tipo === 'listo' && r.historia?.etapa, 'retrocede');
  const ev = await eventos(id);
  assert.equal(ev.length, 1, 'el retroceso no quedó en la historia');
  assert.equal(ev[0]!.datos.retrocede, true);
  assert.equal(ev[0]!.datos.etapa_anterior, 'agendado');
  const f = await fila(id);
  assert.equal(f.etapa_estandar, 'agendado', 'la etapa vigente bajó: el SOP dice que sólo avanza');
  assert.equal(f.etapa_estandar_el?.getTime() ?? null, antes.etapa_estandar_el?.getTime() ?? null);
});

test('la Salida: se marca, avanzar la vacía con su propio evento, retroceder no, y «ninguna» la vacía', async () => {
  const ghl = `c330-salida-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl, 'agendado');

  const marca = unAviso('salida=no_show', 300);
  const r1 = await interpretar('oportunidad.salida', { contactId: ghl }, marca);
  assert.deepEqual(r1.tipo === 'listo' && r1.historia, { etapa: 'no_vino', salida: 'cambio', eventos: 1 });
  let f = await fila(id);
  assert.equal(f.salida, 'no_show');
  assert.equal(f.salida_el?.getTime(), marca.recibidoEl.getTime());

  // Retroceder no vacía: el lead no volvió a moverse hacia adelante.
  await interpretar('oportunidad.etapa', { contactId: ghl }, unAviso('etapa=calificado', 240));
  assert.equal((await fila(id)).salida, 'no_show', 'un retroceso vació la Salida');

  const avanza = unAviso('etapa=asistio', 180);
  const r2 = await interpretar('oportunidad.etapa', { contactId: ghl }, avanza);
  assert.deepEqual(r2.tipo === 'listo' && r2.historia, { etapa: 'avanzo', salida: 'cambio', eventos: 2 });
  f = await fila(id);
  assert.equal(f.salida, null, 'avanzar no vació la Salida');
  assert.equal(f.salida_el?.getTime(), avanza.recibidoEl.getTime());
  const vaciada = (await eventos(id)).find((e) => e.id_externo === `aviso:${avanza.id}:salida_vaciada`);
  assert.ok(vaciada, 'vaciar la Salida al avanzar no dejó su salida_marcada');
  assert.deepEqual({ salida: vaciada.datos.salida, anterior: vaciada.datos.salida_anterior, etapa: vaciada.datos.etapa }, {
    salida: null,
    anterior: 'no_show',
    etapa: 'asistio',
  });
  await conLaFormaDeSuTipo(vaciada);

  // Asistió con Adelanto: la Salida llega con su clave y después «ninguna» la vacía.
  await interpretar('oportunidad.salida', { contactId: ghl }, unAviso('salida=Adelanto', 120));
  assert.equal((await fila(id)).salida, 'adelanto');
  const vacia = await interpretar('oportunidad.salida', { contactId: ghl }, unAviso('salida=ninguna', 60));
  assert.equal(vacia.tipo === 'listo' && vacia.historia?.salida, 'cambio', '«ninguna» no vació la Salida');
  assert.equal((await fila(id)).salida, null);
  for (const e of await eventos(id)) await conLaFormaDeSuTipo(e);
});

test('una reentrega vieja no mueve lo vigente: ni vuelve a poner una Salida vaciada, ni vacía una Salida posterior', async () => {
  const ghl = `c330-reentrega-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl, 'calificado');
  const ahora = Date.now();
  const hace = (h: number) => new Date(ahora - h * 3_600_000);
  const cambio = (idExterno: string, ocurrioEl: Date, v: { etapa?: string; salida?: string | null }) =>
    registrarCambioDelCrm(ambito(), { contactoId: id, oportunidadId: null, ocurrioEl, idExterno, via: 'aviso', origen: {}, ...v });

  // A marca no_show; B avanza a agendado y la vacía; llega la reentrega de A (mismo id del hecho, misma hora).
  await cambio('aviso:330-A', hace(3), { salida: 'no_show' });
  await cambio('aviso:330-B', hace(2), { etapa: 'agendado' });
  const otraVezA = await cambio('aviso:330-A', hace(3), { salida: 'no_show' });
  assert.deepEqual(otraVezA, { etapa: 'no_vino', salida: 'igual', eventos: 0 });
  let f = await fila(id);
  assert.equal(f.salida, null, 'la reentrega volvió a poner la Salida que un avance posterior vació, sin evento');
  assert.equal(f.salida_el?.getTime(), hace(2).getTime(), 'la Salida quedó con la hora vieja de la reentrega');
  const ultima = (await eventos(id)).filter((e) => e.tipo === 'salida_marcada').at(-1);
  assert.equal(ultima?.datos.salida ?? null, f.salida, 'lo vigente quedó distinto del último salida_marcada');

  // C marca seguimiento; llega la reentrega de B (el avance): no vacía la Salida de C ni toca la etapa.
  await cambio('aviso:330-C', hace(1), { salida: 'seguimiento' });
  await admin.query(`update negocio.contactos set etapa_estandar = 'calificado' where id = $1`, [id]);
  const otraVezB = await cambio('aviso:330-B', hace(2), { etapa: 'agendado' });
  assert.deepEqual(otraVezB, { etapa: 'igual', salida: 'no_vino', eventos: 0 });
  f = await fila(id);
  assert.equal(f.salida, 'seguimiento', 'la reentrega de un avance vació una Salida posterior');
  assert.equal(f.etapa_estandar, 'calificado', 'la reentrega de un hecho ya registrado volvió a mover la etapa vigente');
});

test('fuera de orden: un avance más viejo no vacía una Salida más nueva, y una Salida más vieja queda tardía', async () => {
  const ghl = `c330-orden-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl, 'agendado');
  const ahora = Date.now();
  const hace = (s: number) => new Date(ahora - s * 1000);
  const cambio = (idExterno: string, ocurrioEl: Date, v: { etapa?: string; salida?: string | null }) =>
    registrarCambioDelCrm(ambito(), { contactoId: id, oportunidadId: null, ocurrioEl, idExterno, via: 'aviso', origen: {}, ...v });

  // «Asistió con Adelanto» en dos ramas: B (la Salida, .300) llega al candado ANTES que A (el avance, .100).
  assert.deepEqual(await cambio('aviso:330-oo-B', hace(200), { salida: 'adelanto' }), { etapa: 'no_vino', salida: 'cambio', eventos: 1 });
  const a = await cambio('aviso:330-oo-A', hace(300), { etapa: 'asistio' });
  assert.deepEqual(a, { etapa: 'avanzo', salida: 'no_vino', eventos: 1 }, 'el avance más viejo vació la Salida más nueva');
  let f = await fila(id);
  assert.equal(f.salida, 'adelanto', 'la Salida vigente quedó vacía aunque la historia termina en «adelanto»');
  assert.equal(f.salida_el?.getTime(), hace(200).getTime());
  assert.equal(f.etapa_estandar, 'asistio');
  let ev = await eventos(id);
  assert.equal(ev.filter((e) => e.tipo === 'salida_marcada' && e.datos.salida === null).length, 0, 'se registró un vaciado que no pasó');
  assert.equal(ev.filter((e) => e.tipo === 'salida_marcada').at(-1)?.datos.salida, f.salida, 'lo vigente no es lo último de la historia');

  // Un avance POSTERIOR sí la vacía; y una Salida de antes de ese avance que llega después queda tardía y no vuelve.
  await cambio('aviso:330-oo-C', hace(100), { etapa: 'venta' });
  assert.equal((await fila(id)).salida, null);
  const d = await cambio('aviso:330-oo-D', hace(150), { salida: 'seguimiento' });
  assert.deepEqual(d, { etapa: 'no_vino', salida: 'tardia', eventos: 1 });
  f = await fila(id);
  assert.equal(f.salida, null, 'una Salida más vieja que la vigente volvió a ponerse');
  assert.equal(f.salida_el?.getTime(), hace(100).getTime());
  ev = await eventos(id);
  const tardia = ev.find((e) => e.id_externo === 'aviso:330-oo-D:salida');
  assert.ok(tardia, 'la Salida tardía no quedó en la historia');
  assert.deepEqual(
    { salida: tardia.datos.salida, anterior: tardia.datos.salida_anterior, etapa: tardia.datos.etapa, tardio: tardia.datos.tardio },
    { salida: 'seguimiento', anterior: 'adelanto', etapa: 'asistio', tardio: true },
    'la Salida tardía no se registró contra lo que regía a SU hora',
  );
  await conLaFormaDeSuTipo(tardia);
});

test('una etapa que llega tarde no es un retroceso: se registra contra la de SU hora, y la vigente no se mueve', async () => {
  const ghl = `c330-tarde-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl);
  const ahora = Date.now();
  const hace = (s: number) => new Date(ahora - s * 1000);
  const cambio = (idExterno: string, ocurrioEl: Date, etapa: string) =>
    registrarCambioDelCrm(ambito(), { contactoId: id, oportunidadId: null, ocurrioEl, idExterno, via: 'aviso', origen: {}, etapa });

  await cambio('aviso:330-t-0', hace(400), 'lead');
  await cambio('aviso:330-t-2', hace(200), 'calificado');
  // La conversación pasó a las 300, entre las dos, y llega al candado después de calificado.
  const r = await cambio('aviso:330-t-1', hace(300), 'conversacion');
  assert.deepEqual(r, { etapa: 'tardia', salida: 'no_vino', eventos: 1 });
  const f = await fila(id);
  assert.equal(f.etapa_estandar, 'calificado', 'una etapa tardía movió la vigente');
  assert.equal(f.etapa_estandar_el?.getTime(), hace(200).getTime());
  const e = (await eventos(id)).find((x) => x.id_externo === 'aviso:330-t-1:etapa');
  assert.ok(e);
  assert.deepEqual(
    { anterior: e.datos.etapa_anterior, retrocede: e.datos.retrocede, tardio: e.datos.tardio },
    { anterior: 'lead', retrocede: false, tardio: true },
    'una llegada tardía quedó como un retroceso contra la etapa vigente: ese retroceso nunca existió',
  );
  await conLaFormaDeSuTipo(e);

  // Y una tardía que SÍ retrocedía a su hora (lead después de conversación, antes de calificado) lo dice.
  await cambio('aviso:330-t-15', hace(250), 'lead');
  const atras = (await eventos(id)).find((x) => x.id_externo === 'aviso:330-t-15:etapa');
  assert.deepEqual(
    { anterior: atras?.datos.etapa_anterior, retrocede: atras?.datos.retrocede, tardio: atras?.datos.tardio },
    { anterior: 'conversacion', retrocede: true, tardio: true },
    'la etapa que regía a esa hora no es la más alta de las anteriores',
  );
  // La que regía es la MÁS ALTA de las anteriores, no la última: un retroceso no la bajó.
  const otraAtras = await cambio('aviso:330-t-22', hace(220), 'lead');
  assert.equal(otraAtras.etapa, 'tardia', 'la etapa que regía se tomó del último cambio (un retroceso) y no de la más alta');
  assert.equal((await eventos(id)).find((x) => x.id_externo === 'aviso:330-t-22:etapa')?.datos.etapa_anterior, 'conversacion');
  // Reprocesar la tardía no escribe otra.
  assert.equal((await cambio('aviso:330-t-1', hace(300), 'conversacion')).eventos, 0);
});

test('en cualquier orden, lo mismo: una tardía más ALTA sube la vigente con su hora, y una Salida de antes del último avance no vuelve', async () => {
  const ahora = Date.now();
  const hace = (s: number) => new Date(ahora - s * 1000);
  const para = (id: string) => (idExterno: string, ocurrioEl: Date, v: { etapa?: string; salida?: string | null }) =>
    registrarCambioDelCrm(ambito(), { contactoId: id, oportunidadId: null, ocurrioEl, idExterno, via: 'aviso', origen: {}, ...v });

  // GoHighLevel: calificado (400) → venta (300) → a mano, agendado (200), un retroceso. El aviso de venta llega último.
  const desordenado = await contacto(`c330-sube-${randomUUID().slice(0, 8)}`);
  const d = para(desordenado);
  await d('aviso:330-s-0', hace(400), { etapa: 'calificado' });
  await d('aviso:330-s-2', hace(200), { etapa: 'agendado' });
  const r = await d('aviso:330-s-1', hace(300), { etapa: 'venta' });
  assert.deepEqual(r, { etapa: 'avanzo', salida: 'no_vino', eventos: 1 });
  const enOrden = await contacto(`c330-sube-orden-${randomUUID().slice(0, 8)}`);
  const o = para(enOrden);
  await o('aviso:330-so-0', hace(400), { etapa: 'calificado' });
  await o('aviso:330-so-1', hace(300), { etapa: 'venta' });
  await o('aviso:330-so-2', hace(200), { etapa: 'agendado' });
  const [fd, fo] = [await fila(desordenado), await fila(enOrden)];
  assert.deepEqual(
    { etapa: fd.etapa_estandar, el: fd.etapa_estandar_el?.getTime() },
    { etapa: fo.etapa_estandar, el: fo.etapa_estandar_el?.getTime() },
    'la misma historia dejó otra etapa vigente según el orden de llegada: una tardía más alta no la subió',
  );
  assert.equal(fd.etapa_estandar, 'venta');
  const tardia = (await eventos(desordenado)).find((x) => x.id_externo === 'aviso:330-s-1:etapa');
  assert.ok(tardia);
  assert.deepEqual(
    { anterior: tardia.datos.etapa_anterior, retrocede: tardia.datos.retrocede, tardio: tardia.datos.tardio },
    { anterior: 'calificado', retrocede: false, tardio: true },
  );
  await conLaFormaDeSuTipo(tardia);

  // «Asistió con Adelanto» (300) llega tarde, después de un retroceso a agendado (200): sube, y su Salida vale.
  const conSalida = await contacto(`c330-sube-salida-${randomUUID().slice(0, 8)}`);
  const s = para(conSalida);
  await s('aviso:330-ss-0', hace(400), { etapa: 'calificado' });
  await s('aviso:330-ss-2', hace(200), { etapa: 'agendado' });
  assert.deepEqual(await s('aviso:330-ss-1', hace(300), { etapa: 'asistio', salida: 'adelanto' }), { etapa: 'avanzo', salida: 'cambio', eventos: 2 });
  const fs = await fila(conSalida);
  assert.deepEqual(
    { etapa: fs.etapa_estandar, salida: fs.salida, el: fs.salida_el?.getTime() },
    { etapa: 'asistio', salida: 'adelanto', el: hace(300).getTime() },
    'la Salida del mismo cambio que subió la etapa se tomó por vieja contra el avance que ese cambio desplazó',
  );

  // La Salida (200) se procesa DESPUÉS de un avance posterior (100) que no encontró ninguna Salida que vaciar.
  const salidaVieja = await contacto(`c330-salida-vieja-${randomUUID().slice(0, 8)}`, 'conversacion');
  const v = para(salidaVieja);
  await v('aviso:330-sv-2', hace(100), { etapa: 'calificado' });
  assert.deepEqual(await v('aviso:330-sv-1', hace(200), { salida: 'seguimiento' }), { etapa: 'no_vino', salida: 'tardia', eventos: 1 });
  const salidaEnOrden = await contacto(`c330-salida-orden-${randomUUID().slice(0, 8)}`, 'conversacion');
  const w = para(salidaEnOrden);
  await w('aviso:330-svo-1', hace(200), { salida: 'seguimiento' });
  await w('aviso:330-svo-2', hace(100), { etapa: 'calificado' });
  assert.equal((await fila(salidaEnOrden)).salida, null);
  assert.equal((await fila(salidaVieja)).salida, null, 'una Salida de antes del último avance quedó vigente: el lead se ve detenido y ya avanzó');
  const marcada = (await eventos(salidaVieja)).find((x) => x.id_externo === 'aviso:330-sv-1:salida');
  assert.equal(marcada?.datos.tardio, true);
});

test('por la ruta: la misma rama con el mismo cuerpo es una reentrega en minutos y un hecho nuevo después', async () => {
  const ghl = `c330-hecho-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl, 'agendado');
  const cuerpo = { contactId: ghl, location: { id: LOCATION } };
  const salida = async (clave: string) =>
    (await (await recibirAviso(pedir(`evento=oportunidad.salida&salida=${clave}`, cuerpo))).json()) as {
      procesado: boolean;
      historia?: { salida: string; eventos: number };
    };

  assert.equal((await salida('no_show')).historia?.salida, 'cambio');
  assert.equal((await salida('ninguna')).historia?.salida, 'cambio');
  // La reentrega inmediata del primero: la misma fila, el mismo hecho, nada nuevo.
  assert.equal((await salida('no_show')).historia?.eventos, 0, 'una reentrega en minutos se tomó como un hecho nuevo');
  assert.equal((await fila(id)).salida, null);

  // Días después vuelve a faltar: la misma rama, el mismo cuerpo. La fila no se vio en más de quince minutos.
  await admin.query(
    `update negocio.avisos_del_crm set visto_ultimo_el = visto_ultimo_el - interval '20 minutes'
      where org_id = $1 and consulta = 'evento=oportunidad.salida&salida=no_show' and cuerpo = $2`,
    [org, JSON.stringify(cuerpo)],
  );
  const otraVez = await salida('no_show');
  assert.equal(otraVez.historia?.salida, 'cambio', 'el lead volvió a faltar y la Salida no cambió: se fundió con la fila de la primera vez');
  const f = await fila(id);
  assert.equal(f.salida, 'no_show');
  const fila1 = await unaFila<{ recibido_el: Date; repeticiones: number; procesado_el: Date | null }>(
    admin,
    `select recibido_el, repeticiones, procesado_el from negocio.avisos_del_crm where org_id = $1 and consulta = 'evento=oportunidad.salida&salida=no_show' and cuerpo = $2`,
    [org, JSON.stringify(cuerpo)],
  );
  assert.ok(fila1);
  assert.equal(Number(fila1.repeticiones), 3);
  assert.ok(fila1.procesado_el, 'el hecho nuevo no quedó procesado');
  assert.equal(f.salida_el?.getTime(), fila1.recibido_el.getTime(), 'el hecho nuevo no tomó la hora de su llegada');
  const marcas = (await eventos(id)).filter((e) => e.tipo === 'salida_marcada').map((e) => e.datos.salida);
  assert.deepEqual(marcas, ['no_show', null, 'no_show']);
});

test('del cuerpo: el Pipeline Maestro sí; otro pipeline o un nombre desconocido se cuentan sin mapear', async () => {
  const ghl = `c330-cuerpo-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl);

  // La errata que GoHighLevel publica, con tilde y mayúscula.
  const r = await interpretar('oportunidad.etapa', { contactId: ghl, pipeline_name: 'Pipeline Maestro', pipleline_stage: 'Asistió' }, unAviso(''));
  assert.equal(r.tipo, 'listo', JSON.stringify(r));
  assert.equal((await fila(id)).etapa_estandar, 'asistio');

  // «Venta» es también una etapa del seguimiento comercial: de OTRO pipeline no mueve la del Maestro.
  const ajeno = { contactId: ghl, pipeline_name: 'Seguimiento comercial', pipeline_stage: 'Venta' };
  const r2 = await interpretar('oportunidad.etapa', ajeno, unAviso(''));
  assert.deepEqual(r2, { tipo: 'sin_mapear', que: 'etapa', valor: 'Venta' } satisfies Interpretado);
  assert.equal((await fila(id)).etapa_estandar, 'asistio', 'la etapa de otro pipeline movió la del Maestro');
  let s = await sinMapear('Venta');
  assert.deepEqual(s && { campo: s.campo, apariciones: Number(s.apariciones), tipo: s.tipo }, {
    campo: 'Seguimiento comercial',
    apariciones: 1,
    tipo: 'etapa_del_pipeline',
  });
  await interpretar('oportunidad.etapa', ajeno, unAviso(''));
  s = await sinMapear('Venta');
  assert.equal(Number(s?.apariciones), 2, 'la segunda aparición no se sumó');

  const raro = await interpretar('oportunidad.etapa', { contactId: ghl, pipeline_stage: 'Etapa rara 330' }, unAviso(''));
  assert.equal(raro.tipo, 'sin_mapear');
  assert.equal((await sinMapear('Etapa rara 330'))?.campo, '');
  assert.equal((await eventos(id)).length, 1, 'un valor sin mapear escribió un evento');
});

test('la constante de la URL gana sobre el cuerpo, y una mal escrita se cuenta', async () => {
  const ghl = `c330-url-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl);
  await interpretar('oportunidad.etapa', { contactId: ghl, pipeline_stage: 'Lead' }, unAviso('etapa=venta'));
  assert.equal((await fila(id)).etapa_estandar, 'venta', 'el cuerpo le ganó a la constante de la rama');

  const mal = await interpretar('oportunidad.etapa', { contactId: ghl }, unAviso('etapa=agendó llamada'));
  assert.deepEqual(mal, { tipo: 'sin_mapear', que: 'etapa', valor: 'agendó llamada' } satisfies Interpretado);
  assert.equal(Number((await sinMapear('agendó llamada'))?.apariciones), 1, 'una constante mal escrita no quedó a la vista');
});

test('los mapeos: el de la cuenta por pipeline, «ignorar» sin contar, y el del snapshot del cliente', async () => {
  const ghl = `c330-mapeo-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl);
  await admin.query(
    `insert into negocio.mapeos_de_cuenta (org_id, cuenta_id, tipo, campo, valor_origen, destino_catalogo, destino_clave)
     values ($1, $2, 'etapa_del_pipeline', 'Pipeline de la agencia', 'Agendó llamada', 'etapas', 'agendado'),
            ($1, $2, 'etapa_del_pipeline', '', 'Ignorar 330', 'ignorar', null)`,
    [org, cuenta],
  );
  const r = await interpretar('oportunidad.etapa', { contactId: ghl, pipelineName: 'Pipeline de la agencia', stageName: 'Agendó llamada' }, unAviso(''));
  assert.equal(r.tipo, 'listo', JSON.stringify(r));
  assert.equal((await fila(id)).etapa_estandar, 'agendado', 'el mapeo de la cuenta no tradujo');

  const ign = await interpretar('oportunidad.etapa', { contactId: ghl, stageName: 'Ignorar 330' }, unAviso(''));
  assert.equal(ign.tipo, 'listo', 'un valor ignorado a propósito se informó como error');
  assert.equal(await sinMapear('Ignorar 330'), undefined, 'un valor ignorado a propósito se contó como sin mapear');

  const v = await unaFila<{ id: string }>(admin, `insert into catalogo.snapshot_versiones (snapshot, version, publicada_el) values ('s0_core', 'v330', now()) returning id`);
  assert.ok(v);
  snapshot = v.id;
  await admin.query(
    `insert into catalogo.mapeos_de_snapshot (snapshot_version_id, tipo, campo, valor_origen, destino_catalogo, destino_clave)
     values ($1, 'etapa_del_pipeline', '', 'Etapa del snapshot 330', 'etapas', 'venta')`,
    [snapshot],
  );
  const antes = await interpretar('oportunidad.etapa', { contactId: ghl, stageName: 'Etapa del snapshot 330' }, unAviso(''));
  assert.equal(antes.tipo, 'sin_mapear', 'un mapeo de un snapshot que el cliente no tiene se aplicó');
  await admin.query(`update identidad.cuentas set snapshot_version_id = $2 where id = $1`, [cuenta, snapshot]);
  const r3 = await interpretar('oportunidad.etapa', { contactId: ghl, stageName: 'Etapa del snapshot 330' }, unAviso(''));
  assert.equal(r3.tipo, 'listo', JSON.stringify(r3));
  assert.equal((await fila(id)).etapa_estandar, 'venta', 'el mapeo del snapshot del cliente no tradujo');
});

test('sin la etapa o la Salida que el evento promete: sin_dato, y nada escrito', async () => {
  const ghl = `c330-sin-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl);
  assert.deepEqual(await interpretar('oportunidad.etapa', { contactId: ghl }, unAviso('')), { tipo: 'sin_dato', que: 'etapa' });
  assert.deepEqual(await interpretar('oportunidad.salida', { contactId: ghl }, unAviso('etapa=lead')), { tipo: 'sin_dato', que: 'salida' });
  assert.equal((await fila(id)).etapa_estandar, 'lead', 'lo que sí vino (la etapa de la URL) no se registró');
});

test('un contacto desconocido se pide UNA vez al CRM, y después se registra', async () => {
  const ghl = `c330-nuevo-${randomUUID().slice(0, 8)}`;
  let pedidos = 0;
  const r = await interpretarAviso(ambito(), ACCESO, 'oportunidad.etapa', { contactId: ghl }, async () => {
    pedidos += 1;
    await contacto(ghl);
    return { tipo: 'listo', territorio: 'closer' };
  }, unAviso('etapa=lead'));
  assert.equal(pedidos, 1);
  assert.equal(r.tipo, 'listo', JSON.stringify(r));
  const id = (await unaFila<{ id: string }>(admin, `select id from negocio.contactos where org_id = $1 and ghl_contact_id = $2`, [org, ghl]))!.id;
  assert.equal((await fila(id)).etapa_estandar, 'lead');
});

/** Espera a que `cuantas` transacciones estén esperando un candado sobre `tabla`. */
async function esperarBloqueadas(cuantas: number, tabla: string): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    const r = await admin.query<{ n: number }>(
      `select count(*)::int as n from pg_stat_activity where wait_event_type = 'Lock' and query ilike $1`,
      [`%${tabla}%`],
    );
    if ((r.rows[0]?.n ?? 0) >= cuantas) return;
    await new Promise((listo) => setTimeout(listo, 25));
  }
  assert.fail(`no llegaron ${cuantas} transacciones a esperar el candado de ${tabla}`);
}

test('el contacto se bloquea: dos avisos del mismo lead a la vez dejan UN cambio de etapa', async () => {
  const ghl = `c330-carrera-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl);
  const candado = await conectar('admin');
  const cambio = (n: number) =>
    registrarCambioDelCrm(ambito(), {
      contactoId: id,
      etapa: 'agendado',
      oportunidadId: null,
      ocurrioEl: new Date(Date.now() - n * 1000),
      idExterno: `carrera:${n}`,
      via: 'aviso',
      origen: {},
    });
  let dos: Promise<unknown>;
  try {
    await candado.query('begin');
    await candado.query(`select id from negocio.contactos where id = $1 for update`, [id]);
    dos = Promise.all([cambio(1), cambio(2)]);
    await esperarBloqueadas(2, 'contactos');
  } finally {
    await candado.query('commit');
    await candado.end();
  }
  await dos;
  const ev = await eventos(id);
  assert.equal(ev.length, 1, 'dos avisos simultáneos leyeron la misma etapa vieja: el contacto no se bloqueó');
  assert.equal((await fila(id)).etapa_estandar, 'agendado');
});

test('las etapas y las Salidas del panel son las de la base, en su orden', async () => {
  const etapas = await filas<{ clave: string; nombre: string }>(admin, `select clave, nombre from catalogo.etapas order by orden`);
  assert.deepEqual(etapas, ETAPAS_DEL_MAESTRO.map((e) => ({ clave: e.clave, nombre: e.nombre })));
  const salidas = await filas<{ clave: string; nombre: string }>(admin, `select clave, nombre from catalogo.salidas order by orden`);
  assert.deepEqual(salidas, SALIDAS_DE_LA_OPORTUNIDAD.map((e) => ({ clave: e.clave, nombre: e.nombre })));
});

/** Filas de relleno en la cuarentena de este cliente, de la última hora y ya procesadas. */
async function relleno(cuantas: number, evento: string, marca: string): Promise<void> {
  await admin.query(
    `insert into negocio.avisos_del_crm (org_id, cuenta_id, huella, evento, cuerpo, bytes, atribucion, procesado_el)
     select $1, $2, $3 || g, $4, '{}', 2, 'coincide', now() from generate_series(1, $5::int) g`,
    [org, cuenta, `relleno-330-${marca}-`, evento, cuantas],
  );
}

test('el tope por hora: las oportunidades se cuentan aparte, y por encima se guardan para el reproceso', async () => {
  const ghl = `c330-tope-${randomUUID().slice(0, 8)}`;
  const id = await contacto(ghl, 'lead');
  try {
    // 240 de oportunidad en la última hora: el tope de las oportunidades, no el de los mensajes.
    await relleno(240, 'oportunidad.etapa', 'op');
    const enEspera = await recibirAviso(pedir('evento=oportunidad.etapa&etapa=calificado', { contactId: ghl }));
    assert.equal(enEspera.status, 200, 'un aviso de oportunidad por encima del tope se descartó: no tiene otra puerta');
    assert.equal(((await enEspera.json()) as { porque?: string }).porque, 'en_espera');
    const guardada = await unaFila<{ error: string | null; consulta: string | null; procesado_el: Date | null }>(
      admin,
      `select error, consulta, procesado_el from negocio.avisos_del_crm where org_id = $1 and cuerpo = $2`,
      [org, JSON.stringify({ contactId: ghl })],
    );
    assert.ok(guardada, 'el aviso de oportunidad por encima del tope no quedó guardado');
    assert.equal(guardada.error, MOTIVO_EN_ESPERA);
    assert.equal(guardada.consulta, 'evento=oportunidad.etapa&etapa=calificado', 'no se guardó la rama: el reproceso no sabría qué etapa era');
    assert.equal((await fila(id)).etapa_estandar, 'lead', 'por encima del tope se interpretó igual');

    // Los mensajes del cliente no se frenan por las oportunidades.
    const mensaje = await recibirAviso(pedir('evento=contacto.actualizado', { contactId: `c330-tope-otro-${randomUUID().slice(0, 8)}` }));
    assert.notEqual(mensaje.status, 429, 'las oportunidades se comieron el tope de los mensajes del cliente');

    // El reproceso la toma, con su rama.
    const r = await reprocesarAvisosDeOportunidad(ambito(), ACCESO, { leerContacto: lectorQueLanza });
    assert.ok(r.procesados >= 1, JSON.stringify(r));
    assert.equal((await fila(id)).etapa_estandar, 'calificado', 'el reproceso no procesó el aviso en espera');

    // Al revés: con el tope de los mensajes lleno, una oportunidad entra y se procesa.
    await relleno(240, 'mensaje.entrante', 'msj');
    assert.equal((await recibirAviso(pedir('evento=contacto.actualizado', { contactId: `c330-tope-3-${randomUUID().slice(0, 8)}` }))).status, 429);
    await admin.query(`delete from negocio.avisos_del_crm where org_id = $1 and huella like 'relleno-330-op-%'`, [org]);
    const pasa = (await (await recibirAviso(pedir('evento=oportunidad.etapa&etapa=agendado', { contactId: ghl }))).json()) as { procesado?: boolean };
    assert.equal(pasa.procesado, true, 'los mensajes se comieron el tope de las oportunidades');

    // El techo: diez veces el tope. Pasado, 429 como los demás y sin guardar.
    await relleno(2400, 'oportunidad.salida', 'techo');
    const techo = await recibirAviso(pedir('evento=oportunidad.etapa&etapa=asistio', { contactId: ghl, techo: true }));
    assert.equal(techo.status, 429, 'un workflow desbocado puede llenar la cuarentena sin techo');
    const nada = await unaFila<{ n: number }>(admin, `select count(*)::int as n from negocio.avisos_del_crm where org_id = $1 and cuerpo like '%"techo":true%'`, [org]);
    assert.equal(nada?.n, 0);
  } finally {
    await admin.query(`delete from negocio.avisos_del_crm where org_id = $1 and huella like 'relleno-330-%'`, [org]);
  }
});
