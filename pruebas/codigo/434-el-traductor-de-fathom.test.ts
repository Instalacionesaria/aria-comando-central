// EL TRADUCTOR DE FATHOM. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/analizadores/nucleo/fathom.ts` traduce una reunión de Fathom al idioma del analizador y
// comprueba la firma de sus webhooks. Lo que se cuida:
//
//   · **Quién es el prospecto.** Un error acá no falla: arma la ficha a nombre del vendedor.
//   · **Los tiempos.** Fathom sólo manda el inicio de cada línea; el fin se deduce.
//   · **La firma.** Un webhook falso o tocado se rechaza, y una cabecera basura NO tira el receptor
//     (el ejemplo oficial usa `timingSafeEqual` sin mirar el largo, y esa función lanza).
//   · **La llave** no aparece en ningún mensaje de error.
//
// La reunión de ejemplo es la del OpenAPI oficial de Fathom (el ejemplo del webhook `newMeeting`),
// copiada tal cual. Sin red: `globalThis.fetch` se reemplaza donde hace falta.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FathomError,
  fathomAReunion,
  fathomATranscripcion,
  firmarComoFathom,
  listarReunionesDeFathom,
  pedirAFathom,
  segundosDeMarca,
  verificarFirmaDeFathom,
  type FathomMeeting,
} from '../../lib/analizadores/nucleo/fathom.ts';

/** El ejemplo del OpenAPI, sin los campos que el traductor no mira. */
function ejemplo(): FathomMeeting {
  return {
    title: 'Quarterly Business Review',
    meeting_title: 'QBR 2025 Q1',
    meeting_type: 'Quarterly Business Review',
    recording_id: 123456789,
    url: 'https://fathom.video/xyz123',
    meeting_url: 'https://us02web.zoom.us/j/123456789',
    share_url: 'https://fathom.video/share/xyz123',
    created_at: '2025-03-01T17:01:30Z',
    scheduled_start_time: '2025-03-01T16:00:00Z',
    scheduled_end_time: '2025-03-01T17:00:00Z',
    recording_start_time: '2025-03-01T16:01:12Z',
    recording_end_time: '2025-03-01T17:00:55Z',
    calendar_invitees_domains_type: 'one_or_more_external',
    shared_with: 'single_team',
    transcript_language: 'en',
    transcript: [
      {
        speaker: { display_name: 'Jane Doe', matched_calendar_invitee_email: 'jane.doe@acme.com' },
        text: "Let's revisit the budget allocations.",
        timestamp: '00:05:32',
      },
      {
        speaker: { display_name: 'John Smith', matched_calendar_invitee_email: 'john.smith@client.com' },
        text: 'I agree, we need to adjust our projections.',
        timestamp: '00:05:40',
      },
    ],
    calendar_invitees: [
      { name: 'Alice Johnson', email: 'alice.johnson@acme.com', is_external: false, email_domain: 'acme.com' },
      { name: 'Jane Doe', email: 'jane.doe@acme.com', is_external: false, email_domain: 'acme.com' },
      { name: 'John Smith', email: 'john.smith@client.com', is_external: true, email_domain: 'client.com' },
    ],
    recorded_by: { name: 'Alice Johnson', email: 'alice.johnson@acme.com', team: 'Customer Success', email_domain: 'acme.com' },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LA REUNIÓN
// ═══════════════════════════════════════════════════════════════════════════════

test('la reunión del ejemplo oficial se traduce entera', () => {
  const r = fathomAReunion(ejemplo());
  assert.equal(r.externalMeetingId, '123456789');
  assert.equal(r.title, 'Quarterly Business Review');
  assert.equal(r.organizerEmail, 'alice.johnson@acme.com');
  assert.equal(r.prospectName, 'John Smith');
  assert.equal(r.prospectEmail, 'john.smith@client.com');
  assert.equal(r.happenedAt, '2025-03-01T16:01:12.000Z', 'la fecha es la del inicio de la grabación');
  assert.equal(r.durationSec, 59 * 60 + 43);
  assert.equal(r.meetingUrl, 'https://fathom.video/xyz123');
  assert.equal(r.invitees?.length, 3);
  assert.deepEqual(r.invitees?.[2], { name: 'John Smith', email: 'john.smith@client.com', role: 'externo' });
  assert.equal(r.providerMeta?.share_url, 'https://fathom.video/share/xyz123');
  assert.equal(r.providerMeta?.shared_with, 'single_team');
});

test('el prospecto es el EXTERNO aunque no sea el primero de la lista', () => {
  const m = ejemplo();
  m.calendar_invitees = [...(m.calendar_invitees ?? [])].reverse();
  m.calendar_invitees.push({ name: 'Otro Interno', email: 'otro@acme.com', is_external: false });
  assert.equal(fathomAReunion(m).prospectEmail, 'john.smith@client.com');
});

test('sin nadie marcado como externo, cae al dominio distinto del de quien grabó', () => {
  const m = ejemplo();
  m.calendar_invitees = (m.calendar_invitees ?? []).map((i) => ({ ...i, is_external: undefined }));
  assert.equal(fathomAReunion(m).prospectEmail, 'john.smith@client.com');
});

test('una reunión sólo interna no inventa prospecto', () => {
  const m = ejemplo();
  m.calendar_invitees = (m.calendar_invitees ?? []).filter((i) => !i.is_external);
  const r = fathomAReunion(m);
  // El respaldo por nombre toma a otro interno con nombre, igual que `tldv.ts`: el clasificador la
  // marca OTRO por la transcripción. Lo que NO puede pasar es que el prospecto sea quien grabó.
  assert.notEqual(r.prospectEmail, 'alice.johnson@acme.com');
});

test('sin grabación terminada no hay duración, y la fecha cae a la agendada', () => {
  const m = ejemplo();
  delete m.recording_start_time;
  delete m.recording_end_time;
  const r = fathomAReunion(m);
  assert.equal(r.durationSec, undefined);
  assert.equal(r.happenedAt, '2025-03-01T16:00:00.000Z');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LA TRANSCRIPCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

test('las marcas HH:MM:SS pasan a segundos, y lo que no parsea es 0', () => {
  assert.equal(segundosDeMarca('00:05:32'), 332);
  assert.equal(segundosDeMarca('01:00:00'), 3600);
  assert.equal(segundosDeMarca('05:32'), 332);
  assert.equal(segundosDeMarca('basura'), 0);
  assert.equal(segundosDeMarca(undefined), 0);
});

test('cada línea termina donde empieza la siguiente, y la última, al fin de la grabación', () => {
  const t = fathomATranscripcion(ejemplo());
  assert.equal(t.externalMeetingId, '123456789');
  assert.equal(t.language, 'en');
  assert.deepEqual(
    t.segments.map((s) => [s.startSec, s.endSec, s.speaker]),
    [
      [332, 340, 'Jane Doe'],
      [340, 59 * 60 + 43, 'John Smith'],
    ],
  );
  assert.equal(t.fullText, "[Jane Doe]: Let's revisit the budget allocations.\n[John Smith]: I agree, we need to adjust our projections.");
});

test('sin transcripción es «todavía no», con su tipo, y no un texto vacío', () => {
  for (const transcript of [null, [], [{ speaker: { display_name: 'X' }, text: '   ', timestamp: '00:00:01' }]]) {
    const m = { ...ejemplo(), transcript };
    assert.throws(
      () => fathomATranscripcion(m),
      (e: unknown) => e instanceof FathomError && e.kind === 'no_lista',
    );
  }
});

test('sin idioma, la transcripción se asume en español', () => {
  const m = ejemplo();
  delete m.transcript_language;
  assert.equal(fathomATranscripcion(m).language, 'es');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LA FIRMA DEL WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════════

const SECRETO = `whsec_${Buffer.from('un secreto de prueba de 32 bytes!').toString('base64')}`;
const AHORA = 1_762_800_000;

function firmado(cuerpo: string, ts = AHORA) {
  const id = 'msg_prueba';
  return { id, timestamp: String(ts), firma: firmarComoFathom(SECRETO, id, String(ts), cuerpo) };
}

test('la firma de Fathom se acepta, también entre varias', () => {
  const cuerpo = JSON.stringify(ejemplo());
  const c = firmado(cuerpo);
  assert.deepEqual(verificarFirmaDeFathom(SECRETO, c, cuerpo, AHORA), { ok: true });
  assert.deepEqual(verificarFirmaDeFathom(SECRETO, { ...c, firma: `v1,QUJD ${c.firma}` }, cuerpo, AHORA), { ok: true });
});

test('un cuerpo tocado, reformateado o firmado con otro secreto se rechaza', () => {
  const cuerpo = JSON.stringify(ejemplo());
  const c = firmado(cuerpo);
  assert.deepEqual(verificarFirmaDeFathom(SECRETO, c, cuerpo.replace('John', 'Juan'), AHORA), { ok: false, motivo: 'firma_distinta' });
  assert.deepEqual(verificarFirmaDeFathom(SECRETO, c, JSON.stringify(ejemplo(), null, 2), AHORA), { ok: false, motivo: 'firma_distinta' });
  const otro = `whsec_${Buffer.from('otro secreto').toString('base64')}`;
  assert.deepEqual(verificarFirmaDeFathom(otro, c, cuerpo, AHORA), { ok: false, motivo: 'firma_distinta' });
});

test('una firma de otro largo o basura no tira el receptor', () => {
  const cuerpo = '{}';
  const c = firmado(cuerpo);
  for (const firma of ['v1,corta', 'basura', 'v1,', ' ', 'v1,QUJD v2,']) {
    assert.deepEqual(verificarFirmaDeFathom(SECRETO, { ...c, firma }, cuerpo, AHORA), { ok: false, motivo: 'firma_distinta' });
  }
});

test('un webhook viejo o del futuro se rechaza (más de 5 minutos)', () => {
  const cuerpo = '{}';
  assert.deepEqual(verificarFirmaDeFathom(SECRETO, firmado(cuerpo, AHORA - 301), cuerpo, AHORA), { ok: false, motivo: 'fuera_de_tiempo' });
  assert.deepEqual(verificarFirmaDeFathom(SECRETO, firmado(cuerpo, AHORA + 301), cuerpo, AHORA), { ok: false, motivo: 'fuera_de_tiempo' });
  assert.deepEqual(verificarFirmaDeFathom(SECRETO, firmado(cuerpo, AHORA - 299), cuerpo, AHORA), { ok: true });
});

test('sin cabeceras o con un secreto mal pegado no se compara nada', () => {
  const cuerpo = '{}';
  const c = firmado(cuerpo);
  assert.deepEqual(verificarFirmaDeFathom(SECRETO, { ...c, firma: null }, cuerpo, AHORA), { ok: false, motivo: 'faltan_cabeceras' });
  assert.deepEqual(verificarFirmaDeFathom(SECRETO, { ...c, id: '' }, cuerpo, AHORA), { ok: false, motivo: 'faltan_cabeceras' });
  assert.deepEqual(verificarFirmaDeFathom('sin-prefijo', c, cuerpo, AHORA), { ok: false, motivo: 'secreto_invalido' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL TRANSPORTE
// ═══════════════════════════════════════════════════════════════════════════════

async function conFetch<T>(responder: (url: string, init?: RequestInit) => Response, correr: () => Promise<T>) {
  const pedidos: { url: string; init?: RequestInit }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    pedidos.push({ url: String(url), init });
    return responder(String(url), init);
  }) as typeof globalThis.fetch;
  try {
    return { resultado: await correr(), pedidos };
  } finally {
    globalThis.fetch = original;
  }
}

const json = (cuerpo: unknown, estado = 200, cabeceras: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json', ...cabeceras } });

test('el listado pide la transcripción, filtra por fecha y devuelve el cursor', async () => {
  const { resultado, pedidos } = await conFetch(
    () => json({ limit: 10, next_cursor: 'abc', items: [ejemplo()] }),
    () => listarReunionesDeFathom('llave-de-prueba-123', { desde: '2026-11-01T00:00:00Z', conTranscripcion: true, grabadoPor: ['a@x.com'] }),
  );
  assert.equal(resultado.reuniones.length, 1);
  assert.equal(resultado.siguiente, 'abc');
  const url = new URL(pedidos[0]!.url);
  assert.equal(url.origin + url.pathname, 'https://api.fathom.ai/external/v1/meetings');
  assert.equal(url.searchParams.get('created_after'), '2026-11-01T00:00:00Z');
  assert.equal(url.searchParams.get('include_transcript'), 'true');
  assert.deepEqual(url.searchParams.getAll('recorded_by[]'), ['a@x.com']);
  assert.equal((pedidos[0]!.init?.headers as Record<string, string>)['X-Api-Key'], 'llave-de-prueba-123');
});

test('la última página devuelve cursor nulo', async () => {
  const { resultado } = await conFetch(() => json({ limit: 10, next_cursor: null, items: [] }), () => listarReunionesDeFathom('k'));
  assert.deepEqual(resultado, { reuniones: [], siguiente: null });
});

test('cada rechazo sale con su tipo, y la llave no aparece en ningún mensaje', async () => {
  const llave = 'llave-secreta-de-fathom-999';
  const casos: [number, string][] = [
    [401, 'llave'],
    [403, 'llave'],
    [429, 'limite'],
    [500, 'rechazado'],
  ];
  for (const [estado, tipo] of casos) {
    await conFetch(
      () => json({ message: `algo con ${llave}` }, estado, estado === 429 ? { 'retry-after': '12' } : {}),
      async () => {
        await assert.rejects(pedirAFathom('/meetings', llave), (e: unknown) => {
          assert.ok(e instanceof FathomError);
          assert.equal(e.kind, tipo);
          assert.equal(e.status, estado);
          assert.ok(!e.message.includes(llave), `la llave apareció en el mensaje del ${estado}`);
          if (estado === 429) assert.equal(e.retryAfterSec, 12);
          return true;
        });
      },
    );
  }
});
