// Cada dato se pregunta una sola vez.
//
// El nicho se preguntaba en Tu ficha, en el Research y en el ICP; el precio en la ficha y en la Oferta;
// la experiencia en la ficha y en el Research. Desde el 2026-10-03 se pregunta en el primer paso donde
// hace falta, y los siguientes lo heredan (`lib/fundaciones/heredados.ts`): el agente no lo pregunta,
// lo muestra como «Esto ya lo sé», y si la persona lo corrige, el cambio vale para ese paso y la
// pantalla ofrece «Actualizar también en Tu ficha».

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { estadoVacio, type EstadoDeFundaciones } from '../../lib/fundaciones/estado.ts';
import { HEREDA, heredadosDe } from '../../lib/fundaciones/heredados.ts';
import { TODAS, herramienta } from '../../lib/fundaciones/herramientas.ts';
import { instruccionesDeEntrevista, mensajeDeAperturaConPropuesta } from '../../lib/fundaciones/conversacion.ts';

const codigo = (ruta: string): string => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));

function estado(): EstadoDeFundaciones {
  const e = estadoVacio();
  e.perfil = {
    0: { biz: 'Allpa', service: 'agentes IA', niche: 'inmobiliarias', price: '$1,000/mes', result: '3 clientes, +40% citas', experience: '5 años en ventas' },
  };
  e.researchInputs = { location: 'Cayma, Arequipa, Perú' };
  e.researchSalidas = [
    'p1', 'p2', 'p3', 'p4',
    '<veredicto>\n<item titulo="Segmento ganador">Inmobiliarias con 5+ agentes</item>\n<item titulo="Por qué">Fáciles de encontrar</item>\n</veredicto>\nEvaluación',
  ];
  e.historial = {
    3: [{ date: 'hoy', output: '<veredicto>\n<item titulo="Avatar">Dueño de inmobiliaria</item>\n<item titulo="Deseo dominante">**Cerrar más ventas sin perseguir leads**</item>\n</veredicto>\nAvatar' }],
  };
  return e;
}

test('cada dato repetido tiene UN lugar donde se pregunta, y los demás lo heredan', () => {
  const e = estado();
  const de = (id: number) => heredadosDe(herramienta(id)!, e);

  // Research ← Tu ficha
  assert.deepEqual(de(1)['niche'], { valor: 'inmobiliarias', fuente: 'Tu ficha', campoDeLaFicha: 't1-niche' });
  assert.equal(de(1)['experience']?.valor, '5 años en ventas');
  // ICP ← Research: el segmento ganador y el país de la ciudad donde se buscó.
  assert.deepEqual(de(3)['niche'], { valor: 'Inmobiliarias con 5+ agentes', fuente: 'tu Research', campoDeLaFicha: null });
  assert.equal(de(3)['country']?.valor, 'Perú');
  // Oferta ← Tu ficha (precio) y el ICP (lo que quiere el cliente), sin las negritas.
  assert.equal(de(4)['price']?.valor, '$1,000/mes');
  assert.equal(de(4)['result']?.valor, 'Cerrar más ventas sin perseguir leads');
  // Tu precio ← Tu ficha
  assert.equal(de(10)['pastresults']?.valor, '3 clientes, +40% citas');

  // Lo que no se contestó no se hereda: un hueco no es un dato.
  const vacio = estadoVacio();
  for (const h of TODAS) assert.deepEqual(heredadosDe(h, vacio), {}, `«${h.pestania}» heredó de un estado vacío`);

  // Toda regla apunta a un campo que existe: un identificador mal escrito heredaría a ninguna parte.
  const ids = new Set(TODAS.flatMap((h) => h.filas.flatMap((f) => f.campos.map((c) => c.id))));
  for (const id of Object.keys(HEREDA)) assert.ok(ids.has(id), `\`${id}\` hereda pero no es un campo`);
});

test('el agente no pregunta lo heredado: lo muestra como «Esto ya lo sé» y deja corregirlo', () => {
  const research = herramienta(1)!;
  const heredados = heredadosDe(research, estado());

  const apertura = mensajeDeAperturaConPropuesta(research, {}, {}, heredados);
  assert.match(apertura, /Esto ya lo sé de los pasos anteriores, así que no te lo vuelvo a preguntar:/);
  assert.match(apertura, /· ¿Cuál es tu nicho\? inmobiliarias \(de Tu ficha\)/);
  assert.match(apertura, /Si algo de esto cambió, dímelo y lo corrijo para este paso\./);
  // Y no aparece en «Me falta».
  assert.doesNotMatch(apertura, /Me falta:[^\n]*¿Cuál es tu nicho\?/);

  // Lo contestado en ESTE paso manda sobre lo heredado.
  const corregida = mensajeDeAperturaConPropuesta(research, { niche: 'clínicas' }, {}, heredados);
  assert.match(corregida, /· ¿Cuál es tu nicho\? clínicas\n/);
  assert.doesNotMatch(corregida, /inmobiliarias \(de Tu ficha\)/);

  const instrucciones = instruccionesDeEntrevista(research, {}, '', '', heredados);
  assert.match(instrucciones, /YA LO SÉ \(de Tu ficha\): «inmobiliarias»\. NO la preguntes/);
  assert.match(instrucciones, /el cambio vale solo para este paso, y la pantalla le ofrece actualizarlo también en Tu ficha/);
});

test('la apertura y el relleno ponen lo heredado antes que lo deducido, y el servidor lo devuelve', () => {
  const operaciones = codigo('lib/fundaciones/operaciones.ts');
  assert.match(operaciones, /const heredados = heredadosDe\(h, estado\);/);
  // Orden: guardado → heredado → propuesto.
  assert.match(operaciones, /const conHeredados: Record<string, string> = \{ \.\.\.guardadas \};/);
  assert.match(operaciones, /const respuestas: Record<string, string> = \{ \.\.\.conHeredados \};/);
  assert.match(operaciones, /heredados: heredadosDe\(h, estado\.datos\),/);

  const relleno = codigo('lib/fundaciones/relleno.ts');
  assert.match(relleno, /return ok\(\{ valores: conHeredados\(propuesta\.valores\) \}\);/);
});

test('«Actualizar también en Tu ficha» escribe un solo campo, y solo si la persona lo toca', () => {
  const chat = codigo('components/fundaciones/ChatDeHerramienta.jsx');
  assert.match(chat, /Actualizar también en Tu ficha/);
  assert.match(chat, /cuerpo: \{ herramienta: 0, valores: \{ \[h\.campoDeLaFicha\]: nuevo \}, fusionar: true \}/);
  // Solo detrás de un clic.
  assert.match(chat, /onClick=\{\(\) => actualizarEnLaFicha\(clave, h\)\}/);

  // El servidor fusiona sobre lo guardado y acepta solo campos de esa herramienta.
  const operaciones = codigo('lib/fundaciones/operaciones.ts');
  assert.match(operaciones, /if \(cuerpo\.fusionar === true\) \{/);
  assert.match(operaciones, /const propios = new Set\(idsDeCampos\(id\)\);/);
  assert.match(operaciones, /const fusionados: Record<string, string> = \{ \.\.\.actuales \};/);
});
