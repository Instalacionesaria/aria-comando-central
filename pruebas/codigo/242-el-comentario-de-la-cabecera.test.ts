// EL COMENTARIO DE LA CABECERA: LA PRIORIDAD, LA REGLA DEL SILENCIO, Y NADA ESCRITO A MANO. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/cabecera.ts` y `components/CabeceraDeDepartamento.jsx` (AG15 de los agentes; `04`, AG-77 a
// AG-79; F18):
//
//   · la prioridad: lo que falta configurar, después la señal crítica o alta más grave, después una regla;
//   · la regla del silencio: sin ninguna de las tres, nada; una señal media o sin medición no habla;
//   · la frescura, en una línea por su consecuencia;
//   · la cabecera dibuja sólo el texto que publicó el panel, y en el teléfono no lo dibuja.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { comentarioDeLaCabecera, faltaPorFrescura, type FuentesDeLaCabecera } from '../../lib/agentes/cabecera.ts';

const senal = (gravedad: 'critica' | 'alta' | 'media' | 'info', texto: string, perdidaContactos: number | null = null, estado: 'abierta' | 'vista' | 'sin_medicion' = 'abierta') => ({
  gravedad,
  estado,
  nombre: null,
  texto,
  perdidaContactos,
});
const NADA: FuentesDeLaCabecera = { falta: null, senales: [], regla: null };
const c = (f: Partial<FuentesDeLaCabecera>) => comentarioDeLaCabecera({ ...NADA, ...f });

test('sin ninguna fuente, nada: la regla del silencio', () => {
  assert.equal(c({}), null);
  // Una señal media o una sin medición no habla en la cabecera.
  assert.equal(c({ senales: [senal('media', 'm'), senal('critica', 'x', 9, 'sin_medicion')] }), null);
});

test('la prioridad: falta configurar, después la señal, después la regla', () => {
  const todas = { falta: 'Falta algo.', senales: [senal('critica', 'Grave.')], regla: 'Una regla.' };
  assert.deepEqual(c(todas), { texto: 'Falta algo.', fuente: 'configurar' });
  assert.deepEqual(c({ ...todas, falta: null }), { texto: 'Grave.', fuente: 'senal' });
  assert.deepEqual(c({ ...todas, falta: null, senales: [] }), { texto: 'Una regla.', fuente: 'regla' });
});

test('de las señales, la crítica antes que la alta; entre iguales, la que más pierde; con su nombre', () => {
  assert.equal(c({ senales: [senal('alta', 'Alta', 50), senal('critica', 'Crítica', 1)] })!.texto, 'Crítica');
  assert.equal(c({ senales: [senal('alta', 'Pierde 2', 2), senal('alta', 'Pierde 20', 20), senal('alta', 'Sin pérdida')] })!.texto, 'Pierde 20');
  assert.equal(c({ senales: [{ ...senal('alta', 'Agenda el 5 %.'), nombre: 'Landing con VSL' }] })!.texto, 'Landing con VSL: Agenda el 5 %.');
});

test('la frescura, en una línea por su consecuencia; al día, nada', () => {
  const f = (estado: 'nunca' | 'atrasada' | 'fallando' | 'al_dia', minutos: number | null) => ({ estado, minutos, umbralMinutos: 60, aviso: null });
  assert.equal(faltaPorFrescura(f('al_dia', 5), 'la lectura de los contactos'), null);
  assert.equal(faltaPorFrescura(f('nunca', null), 'la lectura de los contactos'), 'La lectura de los contactos nunca corrió sola en esta empresa: lo de esta pantalla no se renueva.');
  assert.equal(faltaPorFrescura(f('atrasada', 3 * 24 * 60), 'la lectura de los contactos'), 'Sin datos nuevos: la lectura de los contactos no corre desde hace 3 días.');
  assert.equal(faltaPorFrescura(f('fallando', 120), 'la lectura de los contactos'), 'La lectura de los contactos falló la última vez, hace 2 horas: puede haber datos sin traer.');
});

test('la cabecera dibuja sólo el texto publicado, y en el teléfono no lo dibuja', () => {
  const cabecera = sinComentarios(readFileSync(join(RAIZ, 'components/CabeceraDeDepartamento.jsx'), 'utf8'));
  assert.match(cabecera, /const comentario = usarComentario\(abierta \? vista : null\);/, 'el comentario no sale de lo que publicó el panel de la sección a la vista');
  const bloque = /\{comentario \? \(([\s\S]*?)\) : null\}/.exec(cabecera)?.[1];
  assert.ok(bloque, 'el comentario se dibuja aunque no haya: la regla del silencio');
  assert.deepEqual([...bloque.matchAll(/>([^<]+)</g)].map((m) => m[1]!.trim()).filter(Boolean), ['{comentario.texto}'], 'el comentario dibuja algo escrito a mano');
  const hoja = readFileSync(join(RAIZ, 'app/departamentos.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const telefono = hoja.slice(hoja.indexOf('@media (max-width: 760px)'));
  assert.match(telefono, /\.cd-comentario \{\s*display: none;\s*\}/, 'el comentario se dibuja en el teléfono');
  // Y cada panel con señales lo publica, con lo que trajo su GET.
  for (const [archivo, seccion] of [
    ['components/acquisition/PanelDeAcquisition.jsx', 'acquisition'],
    ['components/creative/PanelDeCreative.jsx', 'creative'],
    ['components/conversion/PanelDeConversion.jsx', 'conversion'],
    ['components/conversation/PanelDeConversation.jsx', 'conversation'],
  ] as const) {
    assert.ok(
      sinComentarios(readFileSync(join(RAIZ, archivo), 'utf8')).includes(`usarPublicarComentario('${seccion}', pantalla ? (pantalla.comentario ?? null) : undefined);`),
      `${archivo} no publica el comentario de su GET`,
    );
  }
});
