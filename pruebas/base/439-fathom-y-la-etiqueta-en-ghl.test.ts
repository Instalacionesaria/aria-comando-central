// FATHOM Y LA ETIQUETA EN GHL. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// El paso en GoHighLevel del webhook de Fathom (la 123, `lib/fathom/ghl.ts` y el paso 6 de la ruta), contra la base y
// con GHL simulado (`globalThis.fetch`):
//
//   · una llamada de venta guardada le pone «asistio» al contacto en GHL, y queda anotado;
//   · si el lead no estaba en la base, se busca su correo en GHL, se trae, y la llamada se guarda y se etiqueta;
//   · si tampoco está en GHL, sigue «sin_lead» y no se etiqueta nada;
//   · una falla de GHL al etiquetar no tumba el webhook (200) y queda anotada;
//   · sin token de GHL, se guarda igual y queda «sin_acceso»;
//   · lo que no es venta no toca GHL.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { firmarComoFathom, type FathomMeeting } from '../../lib/analizadores/nucleo/fathom.ts';
import { POST as recibir } from '../../app/api/fathom/webhook/route.ts';

const MARCA = 'fathom-439-';
const SECRETO = `whsec_${randomBytes(24).toString('base64')}`;
const BASE_DE_IDS = 439_000_000_000 + Math.floor(Math.random() * 1_000_000) * 1000;
let siguienteId = BASE_DE_IDS;
const GHL = 'https://services.leadconnectorhq.com';

let admin: Client;
let principal: string;
let cuentaAria: string;
let usuario: { id: string; email: string };
let secretoPrevio: string | undefined;
let credencialPrevia: { crm_token_cifrado: string | null; crm_cuenta_id: string | null; crm_estado: string } | null | undefined;
const fetchOriginal = globalThis.fetch;

/** Lo que GHL contesta en cada prueba, y lo que se le pidió. */
let ghl: {
  buscar: (correo: string) => unknown[];
  contacto: (id: string) => unknown;
  etiquetar: number;
  pedidos: { metodo: string; ruta: string; cuerpo: unknown }[];
};

function ghlPorOmision(): typeof ghl {
  return { buscar: () => [], contacto: () => null, etiquetar: 200, pedidos: [] };
}

before(async () => {
  admin = await conectar('admin');
  secretoPrevio = process.env.FATHOM_SECRETO_WEBHOOK;
  process.env.FATHOM_SECRETO_WEBHOOK = SECRETO;
  const p = await unaFila<{ id: string; cuenta: string }>(
    admin,
    `select o.id, k.id as cuenta from identidad.organizaciones o
       join identidad.cuentas k on k.org_id = o.id and k.es_por_omision where o.es_principal`,
  );
  assert.ok(p);
  principal = p.id;
  cuentaAria = p.cuenta;
  const u = await unaFila<{ id: string; email: string }>(
    admin,
    `select id, email from identidad.usuarios where org_id = $1 and email is not null order by email limit 1`,
    [principal],
  );
  assert.ok(u);
  usuario = u;

  // El token de GHL de la empresa, guardando el estado de antes para restaurarlo exacto.
  const previa = await unaFila<{ crm_token_cifrado: string | null; crm_cuenta_id: string | null; crm_estado: string }>(
    admin,
    `select crm_token_cifrado, crm_cuenta_id, crm_estado from identidad.organizaciones_credenciales where org_id = $1`,
    [principal],
  );
  credencialPrevia = previa ?? null;
  await ponerToken();
  await barrer();

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u2 = String(url);
    if (!u2.startsWith(GHL)) throw new Error(`fetch inesperado: ${u2}`);
    const ruta = u2.slice(GHL.length);
    const metodo = init?.method ?? 'GET';
    const cuerpo = init?.body ? JSON.parse(String(init.body)) : null;
    ghl.pedidos.push({ metodo, ruta, cuerpo });
    const json = (estado: number, c: unknown) =>
      new Response(JSON.stringify(c), { status: estado, headers: { 'content-type': 'application/json' } });
    if (metodo === 'POST' && ruta === '/contacts/search') {
      const correo = (cuerpo as { filters: { value: string }[] }).filters[0]!.value;
      return json(200, { contacts: ghl.buscar(correo) });
    }
    const etiquetas = ruta.match(/^\/contacts\/([^/]+)\/tags$/);
    if (metodo === 'POST' && etiquetas) return json(ghl.etiquetar, ghl.etiquetar < 300 ? { tags: ['asistio'] } : { message: 'falla' });
    const uno = ruta.match(/^\/contacts\/([^/?]+)$/);
    if (metodo === 'GET' && uno) {
      const c = ghl.contacto(decodeURIComponent(uno[1]!));
      return c ? json(200, { contact: c }) : json(404, { message: 'no existe' });
    }
    return json(404, { message: `ruta no simulada: ${metodo} ${ruta}` });
  }) as typeof fetch;
});

afterEach(() => {
  ghl = ghlPorOmision();
});

after(async () => {
  try {
    globalThis.fetch = fetchOriginal;
    await barrer();
    if (credencialPrevia === null) {
      await admin.query(`delete from identidad.organizaciones_credenciales where org_id = $1`, [principal]);
    } else if (credencialPrevia) {
      await admin.query(
        `update identidad.organizaciones_credenciales set crm_token_cifrado = $2, crm_cuenta_id = $3, crm_estado = $4 where org_id = $1`,
        [principal, credencialPrevia.crm_token_cifrado, credencialPrevia.crm_cuenta_id, credencialPrevia.crm_estado],
      );
    }
  } finally {
    if (secretoPrevio === undefined) delete process.env.FATHOM_SECRETO_WEBHOOK;
    else process.env.FATHOM_SECRETO_WEBHOOK = secretoPrevio;
    await cerrarTodo();
    await cerrarClientes();
  }
});

ghl = ghlPorOmision();

async function ponerToken(): Promise<void> {
  await admin.query(
    `insert into identidad.organizaciones_credenciales (org_id, crm_token_cifrado, crm_cuenta_id, crm_estado)
       values ($1, $2, 'loc-439', 'activa')
     on conflict (org_id) do update set crm_token_cifrado = excluded.crm_token_cifrado,
       crm_cuenta_id = excluded.crm_cuenta_id, crm_estado = excluded.crm_estado`,
    [principal, cifrar('pit-de-prueba-439')],
  );
}

async function barrer(): Promise<void> {
  await admin.query(`delete from negocio.recepciones_de_fathom where recording_id between $1 and $2`, [BASE_DE_IDS, BASE_DE_IDS + 999]);
  await admin.query(`delete from negocio.contactos where ghl_contact_id like $1`, [`${MARCA}%`]);
}

async function contacto(email: string): Promise<{ id: string; ghl: string }> {
  const ghlId = `${MARCA}${randomUUID()}`;
  const fila = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, email, alta_en_el_crm)
     values ($1, $2, $3, 'Lead 439', $4, now() - interval '1 day') returning id`,
    [principal, cuentaAria, ghlId, email],
  );
  assert.ok(fila);
  return { id: fila.id, ghl: ghlId };
}

function grabacion(n: number, correo: string, parcial: Partial<FathomMeeting> = {}): FathomMeeting {
  const inicio = new Date(Date.now() - n * 3 * 24 * 3600 * 1000);
  inicio.setUTCHours(15, 0, 0, 0);
  const fin = new Date(inicio.getTime() + 30 * 60 * 1000);
  return {
    title: 'HT_Lead - ARIA',
    meeting_title: 'HT_Lead - ARIA',
    recording_id: siguienteId++,
    share_url: 'https://fathom.video/share/439',
    created_at: fin.toISOString(),
    recording_start_time: inicio.toISOString(),
    recording_end_time: fin.toISOString(),
    recorded_by: { name: 'Closer', email: usuario.email, email_domain: usuario.email.split('@')[1] ?? '' },
    calendar_invitees: [
      { name: 'Closer', email: usuario.email, is_external: false },
      { name: 'Lead', email: correo, is_external: true },
    ],
    transcript: [{ speaker: { display_name: 'Lead', matched_calendar_invitee_email: correo }, text: 'Quiero crecer', timestamp: '00:00:03' }],
    ...parcial,
  };
}

async function enviar(cuerpo: unknown): Promise<{ estado: number; cuerpo: Record<string, unknown> }> {
  const texto = JSON.stringify(cuerpo);
  const id = `msg_${randomUUID()}`;
  const ts = String(Math.floor(Date.now() / 1000));
  const r = await recibir(
    new Request('https://ejemplo.test/api/fathom/webhook', {
      method: 'POST',
      headers: { 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': firmarComoFathom(SECRETO, id, ts, texto) },
      body: texto,
    }),
  );
  return { estado: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

const recepcion = (recordingId: number) =>
  unaFila<{ estado: string; contacto_id: string | null; llamada_id: string | null; resultado_en_ghl: string | null }>(
    admin,
    `select estado, contacto_id, llamada_id, resultado_en_ghl from negocio.recepciones_de_fathom where recording_id = $1`,
    [recordingId],
  );

const etiquetados = () => ghl.pedidos.filter((p) => p.metodo === 'POST' && p.ruta.endsWith('/tags'));

test('una venta guardada le pone «asistio» al contacto en GHL', async () => {
  const lead = await contacto('lead-a-439@ejemplo.test');
  const g = grabacion(1, 'lead-a-439@ejemplo.test');
  const r = await enviar(g);
  assert.deepEqual(r.cuerpo, { recibido: true, estado: 'guardada', ya_estaba: false });
  const tags = etiquetados();
  assert.equal(tags.length, 1);
  assert.equal(tags[0]!.ruta, `/contacts/${encodeURIComponent(lead.ghl)}/tags`);
  assert.deepEqual(tags[0]!.cuerpo, { tags: ['asistio'] });
  assert.equal((await recepcion(g.recording_id!))?.resultado_en_ghl, 'etiqueta_puesta: asistio');
  // No se buscó en GHL: el lead ya estaba en la base.
  assert.equal(ghl.pedidos.filter((p) => p.ruta === '/contacts/search').length, 0);

  // El reintento de Fathom no vuelve a etiquetar.
  ghl.pedidos = [];
  assert.equal((await enviar(g)).cuerpo.ya_estaba, true);
  assert.equal(etiquetados().length, 0);
});

test('sin el lead en la base: se busca en GHL, se trae, se guarda la llamada y se etiqueta', async () => {
  const correo = 'lead-b-439@ejemplo.test';
  const ghlId = `${MARCA}${randomUUID()}`;
  ghl.buscar = (c) => (c === correo ? [{ id: ghlId, email: correo }] : []);
  ghl.contacto = (id) => (id === ghlId ? { id: ghlId, email: correo, firstName: 'Lead', lastName: 'Traído', tags: [] } : null);
  const g = grabacion(2, correo);
  const r = await enviar(g);
  assert.equal(r.estado, 200);
  assert.deepEqual(r.cuerpo, { recibido: true, estado: 'guardada', ya_estaba: false });

  const traido = await unaFila<{ id: string; cuenta_id: string }>(
    admin,
    `select id, cuenta_id from negocio.contactos where ghl_contact_id = $1`,
    [ghlId],
  );
  assert.ok(traido, 'el contacto no se trajo a la base');
  assert.equal(traido.cuenta_id, cuentaAria);
  const rec = await recepcion(g.recording_id!);
  assert.equal(rec?.estado, 'guardada');
  assert.equal(rec?.contacto_id, traido.id);
  assert.ok(rec?.llamada_id);
  assert.equal(rec?.resultado_en_ghl, `traido_de_ghl: ${correo} · etiqueta_puesta: asistio`);
  assert.equal(etiquetados()[0]?.ruta, `/contacts/${encodeURIComponent(ghlId)}/tags`);
});

test('si tampoco está en GHL, sigue «sin_lead» y no se etiqueta nada', async () => {
  const g = grabacion(3, 'nadie-439@ejemplo.test');
  const r = await enviar(g);
  assert.deepEqual(r.cuerpo, { recibido: true, estado: 'sin_lead', ya_estaba: false });
  const rec = await recepcion(g.recording_id!);
  assert.equal(rec?.resultado_en_ghl, 'no_esta_en_ghl');
  assert.equal(etiquetados().length, 0);
});

test('una falla de GHL al etiquetar no tumba el webhook y queda anotada', async () => {
  await contacto('lead-c-439@ejemplo.test');
  ghl.etiquetar = 500;
  const g = grabacion(4, 'lead-c-439@ejemplo.test');
  const r = await enviar(g);
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.estado, 'guardada');
  assert.match((await recepcion(g.recording_id!))?.resultado_en_ghl ?? '', /^etiqueta_fallo: GHL respondió 500/);
});

test('sin token de GHL se guarda igual y queda «sin_acceso»', async () => {
  await contacto('lead-d-439@ejemplo.test');
  await admin.query(`update identidad.organizaciones_credenciales set crm_token_cifrado = null where org_id = $1`, [principal]);
  try {
    const g = grabacion(5, 'lead-d-439@ejemplo.test');
    assert.equal((await enviar(g)).cuerpo.estado, 'guardada');
    assert.equal((await recepcion(g.recording_id!))?.resultado_en_ghl, 'sin_acceso: sin_token');
    assert.equal(ghl.pedidos.length, 0);
  } finally {
    await ponerToken();
  }
});

test('lo que no es venta no toca GHL', async () => {
  await contacto('lead-e-439@ejemplo.test');
  const g = grabacion(6, 'lead-e-439@ejemplo.test', { title: 'Onboarding', meeting_title: 'Onboarding' });
  assert.equal((await enviar(g)).cuerpo.estado, 'no_es_venta');
  assert.equal(ghl.pedidos.length, 0);
  assert.equal((await recepcion(g.recording_id!))?.resultado_en_ghl, null);
});
