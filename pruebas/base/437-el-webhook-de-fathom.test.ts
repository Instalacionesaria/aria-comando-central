// EL WEBHOOK DE FATHOM. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `POST /api/fathom/webhook` (la ruta, `lib/fathom/guardar.ts` y la 116) de punta a punta, contra la base: un envío
// firmado como lo firma Fathom entra por la ruta y se mira qué quedó en `negocio.recepciones_de_fathom`,
// `negocio.llamadas` y `negocio.transcripciones`. Lo que se cuida:
//
//   · LA VENTA CON LEAD queda como dato del lead: una llamada `venta` de `fathom`, contestada, con su título, sus
//     participantes y quién la hizo, y UNA transcripción atada al mismo lead y la misma subcuenta.
//   · LOS REINTENTOS no duplican nada; un envío que quedó en `error` se reprocesa.
//   · EL LEAD: por correo, sólo en la subcuenta de ARIA; con el correo repetido desempata la cita o queda `ambiguo`;
//     sin correo, la cita única; si no, se descarta con su motivo.
//   · LO QUE NO ES VENTA, o no tiene lead o transcripción, queda sólo en la recepción.
//   · LA FIRMA: todo rechazo de autenticación es el mismo 403, sin tocar la base; lo firmado e ilegible es 200.
//   · EL AISLAMIENTO: otra organización no ve la recepción.
//
// Cada caso vive en su propio día (cada 3 días hacia atrás) para que las citas a ±12 h de uno no toquen a otro.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { firmarComoFathom, type FathomMeeting } from '../../lib/analizadores/nucleo/fathom.ts';
import { esFallaDeLaBase } from '../../lib/fathom/guardar.ts';
import { POST as recibir } from '../../app/api/fathom/webhook/route.ts';

const MARCA = 'fathom-437-';
const SECRETO = `whsec_${randomBytes(24).toString('base64')}`;
const SECRETO_NUEVO = `whsec_${randomBytes(24).toString('base64')}`;
/** Un rango propio de recording_id, para barrer sólo lo de este archivo. */
const BASE_DE_IDS = 437_000_000_000 + Math.floor(Math.random() * 1_000_000) * 1000;
let siguienteId = BASE_DE_IDS;

let admin: Client;
let principal: string;
let cuentaAria: string;
let otraCuenta: string;
let alfa: string;
let usuario: { id: string; email: string };
let secretoPrevio: string | undefined;

before(async () => {
  admin = await conectar('admin');
  secretoPrevio = process.env.FATHOM_SECRETO_WEBHOOK;
  process.env.FATHOM_SECRETO_WEBHOOK = SECRETO;

  const p = await unaFila<{ id: string; cuenta: string }>(
    admin,
    `select o.id, k.id as cuenta from identidad.organizaciones o
       join identidad.cuentas k on k.org_id = o.id and k.es_por_omision
      where o.es_principal`,
  );
  assert.ok(p, 'falta la organización principal con su cuenta por omisión');
  principal = p.id;
  cuentaAria = p.cuenta;
  const a = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'alfa'`);
  assert.ok(a);
  alfa = a.id;
  const u = await unaFila<{ id: string; email: string }>(
    admin,
    `select id, email from identidad.usuarios where org_id = $1 and email is not null order by email limit 1`,
    [principal],
  );
  assert.ok(u, 'la principal no tiene un usuario con correo');
  usuario = u;

  await barrer();
  const otra = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Otra 437', 'otra-437') returning id`,
    [principal],
  );
  assert.ok(otra);
  otraCuenta = otra.id;
});

after(async () => {
  try {
    await barrer();
  } finally {
    if (secretoPrevio === undefined) delete process.env.FATHOM_SECRETO_WEBHOOK;
    else process.env.FATHOM_SECRETO_WEBHOOK = secretoPrevio;
    await cerrarTodo();
    await cerrarClientes();
  }
});

async function barrer(): Promise<void> {
  await admin.query(`delete from negocio.recepciones_de_fathom where recording_id between $1 and $2`, [
    BASE_DE_IDS,
    BASE_DE_IDS + 999,
  ]);
  await admin.query(`delete from negocio.citas where ghl_evento_id like $1`, [`${MARCA}%`]);
  // Las llamadas y sus transcripciones se van en cascada con el contacto (011, 111).
  await admin.query(`delete from negocio.contactos where ghl_contact_id like $1`, [`${MARCA}%`]);
  await admin.query(`alter table negocio.transcripciones drop constraint if exists transcripciones_falla_437`);
  await admin.query(`delete from identidad.cuentas where slug = 'otra-437'`);
}

/** El momento de cada caso: `n` veces tres días atrás, a una hora fija. */
function dia(n: number): Date {
  const d = new Date(Date.now() - n * 3 * 24 * 3600 * 1000);
  d.setUTCHours(15, 0, 0, 0);
  return d;
}

async function contacto(o: { email: string | null; cuenta?: string; altaHaceDias?: number; baja?: boolean }): Promise<string> {
  const fila = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, email, alta_en_el_crm, baja_en_el_crm)
     values ($1, $2, $3, 'Lead 437', $4, now() - make_interval(days => $5), $6) returning id`,
    [principal, o.cuenta ?? cuentaAria, `${MARCA}${randomUUID()}`, o.email, o.altaHaceDias ?? 1, o.baja ? new Date() : null],
  );
  assert.ok(fila);
  return fila.id;
}

async function cita(contactoId: string, inicio: Date, estado = 'confirmed'): Promise<string> {
  const fila = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.citas (org_id, cuenta_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl)
     values ($1, $2, $3, $4, 'cal-437', $5, $5::timestamptz + interval '45 minutes', $6) returning id`,
    [principal, cuentaAria, contactoId, `${MARCA}${randomUUID()}`, inicio, estado],
  );
  assert.ok(fila);
  return fila.id;
}

/** Una grabación como la manda Fathom, en el día `n`. */
function grabacion(n: number, parcial: Partial<FathomMeeting> = {}): FathomMeeting {
  const inicio = dia(n);
  const fin = new Date(inicio.getTime() + 30 * 60 * 1000);
  return {
    title: 'HT_Lead - ARIA',
    meeting_title: 'HT_Lead - ARIA',
    recording_id: siguienteId++,
    url: 'https://fathom.video/calls/1',
    share_url: 'https://fathom.video/share/abc',
    created_at: fin.toISOString(),
    scheduled_start_time: inicio.toISOString(),
    scheduled_end_time: fin.toISOString(),
    recording_start_time: inicio.toISOString(),
    recording_end_time: fin.toISOString(),
    transcript_language: 'es',
    recorded_by: { name: 'Closer', email: usuario.email, email_domain: usuario.email.split('@')[1] ?? '' },
    calendar_invitees: [
      { name: 'Closer', email: usuario.email, is_external: false },
      { name: 'Lead', email: 'lead@ejemplo.test', is_external: true },
    ],
    transcript: [
      { speaker: { display_name: 'Closer', matched_calendar_invitee_email: usuario.email }, text: 'Buenas tardes', timestamp: '00:00:02' },
      { speaker: { display_name: 'Lead', matched_calendar_invitee_email: 'lead@ejemplo.test' }, text: 'Hola, cuéntame', timestamp: '00:00:06' },
    ],
    ...parcial,
  };
}

function invitadoExterno(email: string | null): FathomMeeting['calendar_invitees'] {
  return [
    { name: 'Closer', email: usuario.email, is_external: false },
    { name: 'Lead', email, is_external: true },
  ];
}

/** El envío firmado. `firma: false` lo manda sin firmar; `secreto` firma con otro. */
async function enviar(
  cuerpo: unknown,
  o: { secreto?: string; timestamp?: number; firma?: string | false; crudo?: string; id?: string } = {},
): Promise<{ estado: number; cuerpo: Record<string, unknown> }> {
  const texto = o.crudo ?? JSON.stringify(cuerpo);
  const id = o.id ?? `msg_${randomUUID()}`;
  const ts = String(o.timestamp ?? Math.floor(Date.now() / 1000));
  const cabeceras: Record<string, string> = { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': ts };
  if (o.firma !== false) cabeceras['webhook-signature'] = o.firma ?? firmarComoFathom(o.secreto ?? SECRETO, id, ts, texto);
  const r = await recibir(new Request('https://ejemplo.test/api/fathom/webhook', { method: 'POST', headers: cabeceras, body: texto }));
  return { estado: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

async function recepcion(recordingId: number) {
  return unaFila<{
    estado: string;
    contacto_id: string | null;
    cita_id: string | null;
    llamada_id: string | null;
    vinculada_por: string | null;
    ambiguo: boolean;
    correo_del_lead: string | null;
    motivo: string | null;
    intentos: number;
    participantes: unknown;
    cuenta_id: string;
  }>(admin, `select * from negocio.recepciones_de_fathom where recording_id = $1`, [recordingId]);
}

const llamadasDe = (contactoId: string) =>
  filas<{ id: string; externa_id: string; tipo: string; proveedor: string; contestada: boolean; persona_id: string | null; titulo: string | null; participantes: unknown; vinculada_por: string; cita_id: string | null; estado_de_transcripcion: string; cuenta_id: string; duracion_segundos: number }>(
    admin,
    `select * from negocio.llamadas where contacto_id = $1`,
    [contactoId],
  );

const transcripcionesDe = (llamadaId: string) =>
  filas<{ texto: string; segmentos: unknown; contacto_id: string; cuenta_id: string; proveedor: string; idioma: string | null }>(
    admin,
    `select * from negocio.transcripciones where llamada_id = $1`,
    [llamadaId],
  );

// ─── La venta con lead ───────────────────────────────────────────────────────

test('una venta con lead por correo: la llamada y su transcripción quedan como datos del lead', async () => {
  const lead = await contacto({ email: ' Lead.Uno@Ejemplo.test ' });
  const g = grabacion(1, { calendar_invitees: invitadoExterno('lead.uno@ejemplo.test') });
  const r = await enviar(g);
  assert.equal(r.estado, 200);
  assert.deepEqual(r.cuerpo, { recibido: true, estado: 'guardada', ya_estaba: false });

  const rec = await recepcion(g.recording_id!);
  assert.equal(rec?.estado, 'guardada');
  assert.equal(rec?.contacto_id, lead);
  assert.equal(rec?.vinculada_por, 'correo');
  assert.equal(rec?.ambiguo, false);
  assert.equal(rec?.cuenta_id, cuentaAria);

  const ls = await llamadasDe(lead);
  assert.equal(ls.length, 1);
  const l = ls[0]!;
  assert.equal(rec?.llamada_id, l.id);
  assert.equal(l.externa_id, `fathom:${g.recording_id}`);
  assert.equal(l.tipo, 'venta');
  assert.equal(l.proveedor, 'fathom');
  assert.equal(l.contestada, true);
  assert.equal(l.persona_id, usuario.id);
  assert.equal(l.titulo, 'HT_Lead - ARIA');
  assert.equal(l.vinculada_por, 'correo');
  assert.equal(l.estado_de_transcripcion, 'lista');
  assert.equal(l.cuenta_id, cuentaAria);
  assert.equal(l.duracion_segundos, 1800);
  assert.deepEqual(l.participantes, [
    { nombre: 'Closer', email: usuario.email.toLowerCase(), externo: false, del_equipo: true, hablo: true },
    { nombre: 'Lead', email: 'lead.uno@ejemplo.test', externo: true, del_equipo: false, hablo: false },
  ]);

  const ts = await transcripcionesDe(l.id);
  assert.equal(ts.length, 1);
  assert.equal(ts[0]!.contacto_id, lead);
  assert.equal(ts[0]!.cuenta_id, cuentaAria);
  assert.equal(ts[0]!.proveedor, 'fathom');
  assert.equal(ts[0]!.idioma, 'es');
  assert.equal(ts[0]!.texto, '[Closer]: Buenas tardes\n[Lead]: Hola, cuéntame');
  assert.deepEqual(ts[0]!.segmentos, [
    { hablante: 'Closer', desde_seg: 2, hasta_seg: 6, texto: 'Buenas tardes' },
    { hablante: 'Lead', desde_seg: 6, hasta_seg: 1800, texto: 'Hola, cuéntame' },
  ]);

  // El reintento de Fathom (otro o el mismo webhook-id): nada se duplica.
  const otra = await enviar(g);
  assert.equal(otra.estado, 200);
  assert.deepEqual(otra.cuerpo, { recibido: true, estado: 'guardada', ya_estaba: true });
  assert.equal((await llamadasDe(lead)).length, 1);
  assert.equal((await transcripcionesDe(l.id)).length, 1);
  const cuantas = await unaFila<{ n: number }>(
    admin,
    `select count(*)::int as n from negocio.recepciones_de_fathom where recording_id = $1`,
    [g.recording_id],
  );
  assert.equal(cuantas?.n, 1);
});

test('el lead dado de baja en el CRM no cuenta, y uno de otra subcuenta tampoco: sin_lead', async () => {
  await contacto({ email: 'baja@ejemplo.test', baja: true });
  await contacto({ email: 'otra-cuenta@ejemplo.test', cuenta: otraCuenta });
  for (const [n, email] of [
    [2, 'baja@ejemplo.test'],
    [3, 'otra-cuenta@ejemplo.test'],
    [4, 'nadie@ejemplo.test'],
  ] as const) {
    const g = grabacion(n, { calendar_invitees: invitadoExterno(email) });
    const r = await enviar(g);
    assert.deepEqual(r.cuerpo, { recibido: true, estado: 'sin_lead', ya_estaba: false }, email);
    const rec = await recepcion(g.recording_id!);
    assert.equal(rec?.estado, 'sin_lead');
    assert.equal(rec?.llamada_id, null);
    assert.equal(rec?.correo_del_lead, email);
    assert.match(rec?.motivo ?? '', new RegExp(email.replace('.', '\\.')));
  }
});

test('lo que no es de venta queda sólo en la recepción, aunque el lead exista', async () => {
  const lead = await contacto({ email: 'onboarding@ejemplo.test' });
  const g = grabacion(5, { title: 'Onboarding Lead', meeting_title: 'Onboarding Lead', calendar_invitees: invitadoExterno('onboarding@ejemplo.test') });
  const r = await enviar(g);
  assert.deepEqual(r.cuerpo, { recibido: true, estado: 'no_es_venta', ya_estaba: false });
  const rec = await recepcion(g.recording_id!);
  assert.equal(rec?.estado, 'no_es_venta');
  assert.equal(rec?.contacto_id, lead);
  assert.equal(rec?.llamada_id, null);
  assert.equal((await llamadasDe(lead)).length, 0);
});

test('una venta sin transcripción no crea la llamada', async () => {
  const lead = await contacto({ email: 'sin-texto@ejemplo.test' });
  const g = grabacion(6, { calendar_invitees: invitadoExterno('sin-texto@ejemplo.test'), transcript: [] });
  const r = await enviar(g);
  assert.deepEqual(r.cuerpo, { recibido: true, estado: 'sin_transcripcion', ya_estaba: false });
  assert.equal((await llamadasDe(lead)).length, 0);
});

test('un lead con el correo del dominio del equipo (interno para Fathom) se encuentra igual; un externo que casa le gana', async () => {
  const dominio = usuario.email.split('@')[1] ?? 'ejemplo.test';
  const interno = await contacto({ email: `lead-interno-437@${dominio}` });
  const g = grabacion(15, {
    calendar_invitees: [
      { name: 'Closer', email: usuario.email, is_external: false },
      { name: 'Lead', email: `lead-interno-437@${dominio}`, is_external: false },
    ],
  });
  assert.deepEqual((await enviar(g)).cuerpo, { recibido: true, estado: 'guardada', ya_estaba: false });
  assert.equal((await recepcion(g.recording_id!))?.contacto_id, interno);

  const externo = await contacto({ email: 'externo-gana-437@ejemplo.test' });
  const g2 = grabacion(16, {
    calendar_invitees: [
      { name: 'Closer', email: usuario.email, is_external: false },
      { name: 'Lead interno', email: `lead-interno-437@${dominio}`, is_external: false },
      { name: 'Lead externo', email: 'externo-gana-437@ejemplo.test', is_external: true },
    ],
  });
  await enviar(g2);
  const rec = await recepcion(g2.recording_id!);
  assert.equal(rec?.contacto_id, externo);
  assert.equal(rec?.ambiguo, false);
});

// ─── El correo repetido y la cita ─────────────────────────────────────────────

test('el correo de dos contactos: desempata la única cita; sin cita, el de alta más reciente y «ambiguo»', async () => {
  // Con cita: gana el que tiene la cita, aunque sea el más viejo.
  const viejo = await contacto({ email: 'doble@ejemplo.test', altaHaceDias: 30 });
  await contacto({ email: 'doble@ejemplo.test', altaHaceDias: 2 });
  const laCita = await cita(viejo, dia(7));
  const g = grabacion(7, { calendar_invitees: invitadoExterno('doble@ejemplo.test') });
  await enviar(g);
  const rec = await recepcion(g.recording_id!);
  assert.equal(rec?.estado, 'guardada');
  assert.equal(rec?.contacto_id, viejo);
  assert.equal(rec?.cita_id, laCita);
  assert.equal(rec?.ambiguo, false);
  assert.equal((await llamadasDe(viejo))[0]?.cita_id, laCita);

  // Sin cita: el más reciente, marcado.
  await contacto({ email: 'doble-b@ejemplo.test', altaHaceDias: 30 });
  const nuevo = await contacto({ email: 'doble-b@ejemplo.test', altaHaceDias: 2 });
  const g2 = grabacion(8, { calendar_invitees: invitadoExterno('doble-b@ejemplo.test') });
  await enviar(g2);
  const rec2 = await recepcion(g2.recording_id!);
  assert.equal(rec2?.estado, 'guardada');
  assert.equal(rec2?.contacto_id, nuevo);
  assert.equal(rec2?.ambiguo, true);
  assert.match(rec2?.motivo ?? '', /alta más reciente/);
});

test('sin correo que case: la cita única encuentra al lead; con dos citados, se descarta', async () => {
  const citado = await contacto({ email: 'otro-correo@ejemplo.test' });
  const laCita = await cita(citado, new Date(dia(9).getTime() - 2 * 3600 * 1000));
  const g = grabacion(9, { calendar_invitees: [{ name: 'Closer', email: usuario.email, is_external: false }] });
  const r = await enviar(g);
  assert.deepEqual(r.cuerpo, { recibido: true, estado: 'guardada', ya_estaba: false });
  const rec = await recepcion(g.recording_id!);
  assert.equal(rec?.contacto_id, citado);
  assert.equal(rec?.vinculada_por, 'cita');
  assert.equal(rec?.cita_id, laCita);
  assert.equal((await llamadasDe(citado))[0]?.vinculada_por, 'cita');

  // Una cita cancelada no cuenta.
  const cancelado = await contacto({ email: 'cancelado@ejemplo.test' });
  await cita(cancelado, dia(10), 'cancelled');
  const g2 = grabacion(10, { calendar_invitees: [] });
  assert.deepEqual((await enviar(g2)).cuerpo, { recibido: true, estado: 'sin_correo_externo', ya_estaba: false });

  // Dos contactos citados en esas horas: no se elige.
  const a = await contacto({ email: 'a@ejemplo.test' });
  const b = await contacto({ email: 'b@ejemplo.test' });
  await cita(a, dia(11));
  await cita(b, dia(11));
  const g3 = grabacion(11, { calendar_invitees: invitadoExterno('desconocido@ejemplo.test') });
  await enviar(g3);
  const rec3 = await recepcion(g3.recording_id!);
  assert.equal(rec3?.estado, 'sin_lead');
  assert.match(rec3?.motivo ?? '', /2 contactos con cita/);
});

// ─── La firma ─────────────────────────────────────────────────────────────────

test('todo rechazo de autenticación es el mismo 403 y no escribe nada', async () => {
  const g = grabacion(12, { calendar_invitees: invitadoExterno('firma@ejemplo.test') });
  const casos = [
    await enviar(g, { firma: false }),
    await enviar(g, { firma: 'v1,basura' }),
    await enviar(g, { secreto: SECRETO_NUEVO }),
    await enviar(g, { timestamp: Math.floor(Date.now() / 1000) - 301 }),
  ];
  for (const c of casos) {
    assert.equal(c.estado, 403);
    assert.deepEqual(c.cuerpo, { codigo: 'sin_permiso' });
  }
  const previo = process.env.FATHOM_SECRETO_WEBHOOK;
  try {
    process.env.FATHOM_SECRETO_WEBHOOK = 'sin-prefijo';
    const sinSecreto = await enviar(g);
    assert.equal(sinSecreto.estado, 403);
    assert.deepEqual(sinSecreto.cuerpo, { codigo: 'sin_permiso' });
  } finally {
    process.env.FATHOM_SECRETO_WEBHOOK = previo;
  }
  assert.equal(await recepcion(g.recording_id!), undefined);

  // Sin cuerpo, aunque traiga cabeceras.
  const sinCuerpo = await recibir(
    new Request('https://ejemplo.test/api/fathom/webhook', {
      method: 'POST',
      headers: { 'webhook-id': 'x', 'webhook-timestamp': String(Math.floor(Date.now() / 1000)), 'webhook-signature': 'v1,x' },
    }),
  );
  assert.equal(sinCuerpo.status, 403);
});

test('la rotación: la segunda clave de la lista vale, y una cabecera con varias firmas también', async () => {
  const previo = process.env.FATHOM_SECRETO_WEBHOOK;
  try {
    process.env.FATHOM_SECRETO_WEBHOOK = `${SECRETO_NUEVO},${SECRETO}`;
    const g = grabacion(13, { title: 'Interna', meeting_title: 'Interna' });
    const r = await enviar(g);
    assert.equal(r.estado, 200);

    const g2 = grabacion(13, { title: 'Interna', meeting_title: 'Interna' });
    const texto = JSON.stringify(g2);
    const ts = String(Math.floor(Date.now() / 1000));
    const firma = `v1,otra ${firmarComoFathom(SECRETO_NUEVO, 'msg_v', ts, texto)}`;
    const r2 = await enviar(g2, { crudo: texto, id: 'msg_v', timestamp: Number(ts), firma });
    assert.equal(r2.estado, 200);
    assert.equal((await recepcion(g2.recording_id!))?.estado, 'no_es_venta');
  } finally {
    process.env.FATHOM_SECRETO_WEBHOOK = previo;
  }
});

test('lo firmado pero ilegible es 200 sin reintento; lo enorme es 413', async () => {
  assert.deepEqual((await enviar(null, { crudo: '{no es json' })).cuerpo, { recibido: false, porque: 'ilegible' });
  // Un cuerpo vacío es «sin cuerpo» para el lector acotado: se rechaza como lo sin firma (Fathom nunca lo manda).
  assert.deepEqual((await enviar(null, { crudo: '' })).cuerpo, { codigo: 'sin_permiso' });
  assert.deepEqual((await enviar({ title: 'HT_x' })).cuerpo, { recibido: false, porque: 'ilegible' });
  assert.deepEqual((await enviar({ recording_id: 'abc' })).cuerpo, { recibido: false, porque: 'ilegible' });
  const enorme = await enviar(null, { crudo: JSON.stringify({ relleno: 'x'.repeat(4 * 1024 * 1024) }) });
  assert.equal(enorme.estado, 413);
});

// ─── El error y el reproceso ──────────────────────────────────────────────────

test('un error de los datos queda como «error» con 200, y el reintento lo reprocesa', async () => {
  const lead = await contacto({ email: 'error@ejemplo.test' });
  await admin.query(
    `alter table negocio.transcripciones add constraint transcripciones_falla_437 check (texto not like '%FALLA-437%')`,
  );
  const g = grabacion(14, {
    calendar_invitees: invitadoExterno('error@ejemplo.test'),
    transcript: [{ speaker: { display_name: 'Lead' }, text: 'FALLA-437', timestamp: '00:00:01' }],
  });
  const r = await enviar(g);
  assert.equal(r.estado, 200);
  assert.deepEqual(r.cuerpo, { recibido: true, estado: 'error' });
  const rec = await recepcion(g.recording_id!);
  assert.equal(rec?.estado, 'error');
  assert.match(rec?.motivo ?? '', /transcripciones_falla_437/);
  assert.equal((await llamadasDe(lead)).length, 0, 'la transacción del proceso no se revirtió entera');

  await admin.query(`alter table negocio.transcripciones drop constraint transcripciones_falla_437`);
  const otra = await enviar(g);
  assert.deepEqual(otra.cuerpo, { recibido: true, estado: 'guardada', ya_estaba: false });
  const rec2 = await recepcion(g.recording_id!);
  assert.equal(rec2?.estado, 'guardada');
  assert.equal(rec2?.intentos, 2);
  assert.equal((await llamadasDe(lead)).length, 1);
});

test('sólo una falla de conexión es «de la base»; un CHECK no', () => {
  assert.equal(esFallaDeLaBase(Object.assign(new Error('x'), { code: '08006' })), true);
  assert.equal(esFallaDeLaBase(Object.assign(new Error('x'), { code: '57P01' })), true);
  assert.equal(esFallaDeLaBase(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })), true);
  assert.equal(esFallaDeLaBase(Object.assign(new Error('x'), { code: '23514' })), false);
  assert.equal(esFallaDeLaBase(new Error('otra cosa')), false);
});

// ─── El aislamiento ───────────────────────────────────────────────────────────

test('otra organización no ve las recepciones de ARIA', async () => {
  const deAria = await conOrganizacion(principal, () =>
    datos().selectFrom('recepciones_de_fathom').select('id').where('recording_id', '>=', String(BASE_DE_IDS)).execute(),
  );
  assert.ok(deAria.length > 0, 'la prueba pasaría en vacío');
  const deAlfa = await conOrganizacion(alfa, () =>
    datos().selectFrom('recepciones_de_fathom').select('id').where('recording_id', '>=', String(BASE_DE_IDS)).execute(),
  );
  assert.deepEqual(deAlfa, []);
});
