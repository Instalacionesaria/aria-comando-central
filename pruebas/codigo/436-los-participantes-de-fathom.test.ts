// LOS PARTICIPANTES, LA TRANSCRIPCIÓN Y LA FIRMA DE FATHOM. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// Las tres piezas puras de `lib/fathom/` que deciden qué se guarda del lead:
//
//   · `participantes.ts`: quiénes estuvieron y quiénes pueden ser el lead. Un error acá vincula la transcripción a
//     un closer (un Gmail personal del equipo) o deja afuera al lead que vino con su socio.
//   · `transcripcion.ts`: la forma de `negocio.transcripciones` (111), con el fin de cada turno deducido y el texto
//     acotado al tope de la columna.
//   · `firma.ts`: los secretos del entorno (uno pegado sin `whsec_` daría firmas malas en silencio) y la firma.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import type { FathomMeeting } from '../../lib/analizadores/nucleo/fathom.ts';
import { firmarComoFathom } from '../../lib/analizadores/nucleo/fathom.ts';
import { participantesDe } from '../../lib/fathom/participantes.ts';
import { TOPE_DEL_TEXTO, transcripcionDe } from '../../lib/fathom/transcripcion.ts';
import {
  firmaEsperadaDeFathom,
  firmasDeLaCabecera,
  secretosDeFathom,
  timestampVigente,
} from '../../lib/fathom/firma.ts';

function reunion(parcial: Partial<FathomMeeting> = {}): FathomMeeting {
  return {
    title: 'HT_Juan - ARIA',
    meeting_title: 'HT_Juan - ARIA',
    recording_id: 1,
    recording_start_time: '2026-11-13T15:00:00Z',
    recording_end_time: '2026-11-13T15:30:00Z',
    recorded_by: { name: 'Closer', email: 'Closer@AriaIA.com', email_domain: 'ariaia.com' },
    calendar_invitees: [
      { name: 'Closer', email: 'closer@ariaia.com', is_external: false },
      { name: 'Juan', email: ' Juan@Gmail.com ', is_external: true },
    ],
    transcript: [
      { speaker: { display_name: 'Closer', matched_calendar_invitee_email: 'closer@ariaia.com' }, text: 'Hola', timestamp: '00:00:05' },
      { speaker: { display_name: 'Juan', matched_calendar_invitee_email: 'juan@gmail.com' }, text: 'Hola, ¿qué tal?', timestamp: '00:00:09' },
    ],
    ...parcial,
  };
}

test('el lead es el externo con correo; el closer y quien grabó son del equipo', () => {
  const { participantes, candidatos } = participantesDe(reunion(), []);
  assert.deepEqual(candidatos, ['juan@gmail.com']);
  assert.deepEqual(participantes, [
    { nombre: 'Closer', email: 'closer@ariaia.com', externo: false, del_equipo: true, hablo: true },
    { nombre: 'Juan', email: 'juan@gmail.com', externo: true, del_equipo: false, hablo: true },
  ]);
});

test('varios externos: todos son candidatos (el lead y su socio), sin repetir', () => {
  const { candidatos } = participantesDe(
    reunion({
      calendar_invitees: [
        { name: 'Socio', email: 'socio@empresa.com', is_external: true },
        { name: 'Juan', email: 'juan@gmail.com', is_external: true },
        { name: 'Juan otra vez', email: 'JUAN@gmail.com', is_external: true },
      ],
    }),
    [],
  );
  assert.deepEqual(candidatos, ['socio@empresa.com', 'juan@gmail.com']);
});

test('un closer con Gmail personal, marcado externo por Fathom, es del equipo y no candidato', () => {
  const { participantes, candidatos } = participantesDe(
    reunion({
      calendar_invitees: [
        { name: 'Closer', email: 'closer.personal@gmail.com', is_external: true },
        { name: 'Juan', email: 'juan@gmail.com', is_external: true },
      ],
    }),
    ['CLOSER.personal@gmail.com'],
  );
  assert.deepEqual(candidatos, ['juan@gmail.com']);
  assert.equal(participantes.find((p) => p.email === 'closer.personal@gmail.com')?.del_equipo, true);
});

test('un lead del mismo dominio que el equipo (interno para Fathom) es candidato si no es usuario ni quien grabó', () => {
  const { participantes, candidatos, externos } = participantesDe(
    reunion({
      recorded_by: { name: 'Soporte', email: 'soporte@ariaia.com', email_domain: 'ariaia.com' },
      calendar_invitees: [
        { name: 'Soporte', email: 'soporte@ariaia.com', is_external: false },
        { name: 'Mruiz', email: 'mruiz@ariaia.com', is_external: false },
        { name: 'Closer', email: 'closer@ariaia.com', is_external: false },
      ],
    }),
    ['closer@ariaia.com'],
  );
  assert.deepEqual(candidatos, ['mruiz@ariaia.com']);
  assert.deepEqual(externos, []);
  assert.equal(participantes.find((p) => p.email === 'mruiz@ariaia.com')?.del_equipo, false);
  assert.equal(participantes.find((p) => p.email === 'soporte@ariaia.com')?.del_equipo, true);
});

test('los externos van primero entre los candidatos', () => {
  const { candidatos, externos } = participantesDe(
    reunion({
      calendar_invitees: [
        { name: 'Colega', email: 'colega@ariaia.com', is_external: false },
        { name: 'Juan', email: 'juan@gmail.com', is_external: true },
      ],
    }),
    [],
  );
  assert.deepEqual(candidatos, ['juan@gmail.com', 'colega@ariaia.com']);
  assert.deepEqual(externos, ['juan@gmail.com']);
});

test('un externo sin correo no es candidato pero queda en la lista; quien no habló, «hablo» falso', () => {
  const { participantes, candidatos } = participantesDe(
    reunion({
      calendar_invitees: [
        { name: 'Sin correo', email: null, is_external: true },
        { name: 'Juan', email: 'juan@gmail.com', is_external: true },
      ],
      transcript: [{ speaker: { display_name: 'Closer', matched_calendar_invitee_email: null }, text: 'Hola', timestamp: '00:00:01' }],
    }),
    [],
  );
  assert.deepEqual(candidatos, ['juan@gmail.com']);
  assert.deepEqual(participantes[0], { nombre: 'Sin correo', email: null, externo: true, del_equipo: false, hablo: false });
  assert.equal(participantes.find((p) => p.email === 'juan@gmail.com')?.hablo, false);
});

test('sin calendario (llamada sin agendar): sólo quien grabó, y ningún candidato', () => {
  const { participantes, candidatos } = participantesDe(reunion({ calendar_invitees: [] }), []);
  assert.deepEqual(candidatos, []);
  assert.deepEqual(participantes, [{ nombre: 'Closer', email: 'closer@ariaia.com', externo: false, del_equipo: true, hablo: true }]);
});

test('la transcripción: turnos con su fin deducido, el último hasta el fin de la grabación', () => {
  const t = transcripcionDe(reunion());
  assert.ok(t);
  assert.deepEqual(t.segmentos, [
    { hablante: 'Closer', desde_seg: 5, hasta_seg: 9, texto: 'Hola' },
    { hablante: 'Juan', desde_seg: 9, hasta_seg: 1800, texto: 'Hola, ¿qué tal?' },
  ]);
  assert.equal(t.texto, '[Closer]: Hola\n[Juan]: Hola, ¿qué tal?');
  assert.equal(t.recortada, false);
});

test('sin líneas con texto no hay transcripción; el idioma se guarda si vino', () => {
  assert.equal(transcripcionDe(reunion({ transcript: [] })), null);
  assert.equal(transcripcionDe(reunion({ transcript: null })), null);
  assert.equal(transcripcionDe(reunion({ transcript: [{ text: '   ', timestamp: '00:00:01' }] })), null);
  assert.equal(transcripcionDe(reunion({ transcript_language: 'es' }))?.idioma, 'es');
  assert.equal(transcripcionDe(reunion())?.idioma, null);
});

test('una transcripción más larga que la columna se recorta y lo dice', () => {
  const larga = 'x'.repeat(TOPE_DEL_TEXTO);
  const t = transcripcionDe(reunion({ transcript: [{ speaker: { display_name: 'Juan' }, text: larga, timestamp: '00:00:00' }] }));
  assert.ok(t);
  assert.equal(t.texto.length, TOPE_DEL_TEXTO);
  assert.equal(t.recortada, true);
});

test('los secretos: varios por coma, y el que no empieza con whsec_ se descarta', () => {
  const previo = process.env.FATHOM_SECRETO_WEBHOOK;
  try {
    delete process.env.FATHOM_SECRETO_WEBHOOK;
    assert.deepEqual(secretosDeFathom(), []);
    process.env.FATHOM_SECRETO_WEBHOOK = ' whsec_AAAA , sinprefijo, whsec_, whsec_BBBB ';
    assert.deepEqual(secretosDeFathom(), ['whsec_AAAA', 'whsec_BBBB']);
  } finally {
    if (previo === undefined) delete process.env.FATHOM_SECRETO_WEBHOOK;
    else process.env.FATHOM_SECRETO_WEBHOOK = previo;
  }
});

test('la firma esperada es la misma que firma Fathom, y se lee de una cabecera con varias', () => {
  const secreto = `whsec_${Buffer.from('un secreto de prueba').toString('base64')}`;
  const cuerpo = '{"recording_id":1}';
  const firma = firmarComoFathom(secreto, 'msg_1', '1700000000', cuerpo);
  const esperada = firmaEsperadaDeFathom(secreto, 'msg_1', '1700000000', cuerpo);
  const dadas = firmasDeLaCabecera(`v1,otra ${firma}`);
  assert.equal(dadas.length, 2);
  assert.ok(dadas.some((d) => d.equals(esperada)));
});

test('el timestamp: dentro de 5 minutos sí, fuera no, y lo que no es número tampoco', () => {
  assert.equal(timestampVigente('1000', 1000 + 300), true);
  assert.equal(timestampVigente('1000', 1000 + 301), false);
  assert.equal(timestampVigente('1000', 1000 - 301), false);
  assert.equal(timestampVigente('abc', 1000), false);
  assert.equal(timestampVigente('', 1000), false);
  assert.equal(timestampVigente('1e3', 1000), false);
});
