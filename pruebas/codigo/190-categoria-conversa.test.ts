// Categoría conversa antes de escribir.
//
// Tenía tres preguntas y generaba en «modo documento»: su metodología —un consultor que diagnostica
// preguntando— quedaba forzada a suponer, y el Category Architect salía lleno de [SUPUESTO]. Desde el
// 2026-10-03 el agente hace las preguntas de diagnóstico de su `SKILL.md`, de a una; las que ya se saben
// vienen heredadas; no se genera hasta que cada una tenga respuesta o se haya saltado; y el documento
// supone SOLO en las saltadas.

import test from 'node:test';
import assert from 'node:assert/strict';

import { camposDe, claveCorta } from '../../lib/fundaciones/campos.ts';
import { arranca, instruccionesDeEntrevista, mensajeDeAperturaConPropuesta } from '../../lib/fundaciones/conversacion.ts';
import { estadoVacio } from '../../lib/fundaciones/estado.ts';
import { heredadosDe } from '../../lib/fundaciones/heredados.ts';
import { herramienta } from '../../lib/fundaciones/herramientas.ts';
import { leerPlantilla } from '../../lib/fundaciones/plantillas.ts';
import { SALTADA, armarPrompt } from '../../lib/fundaciones/prompts.ts';

const categoria = herramienta(2)!;

test('las preguntas son las de diagnóstico de su metodología, y todas se hacen antes de escribir', () => {
  assert.equal(categoria.conversa, true);
  const skill = leerPlantilla('categoria/system')!;
  // Cada pregunta del catálogo corresponde a una de la lista de diagnóstico del SKILL.md.
  for (const tema of ['Qué vendes exactamente', 'Para quién es', 'Qué problema cree el cliente', 'Contra qué o quién te comparan', 'Por qué te eligen', 'Qué hace tu enfoque genuinamente diferente', 'Qué no está funcionando', 'Qué evidencia tienes', 'Qué resultados logran tus mejores clientes', 'Qué buscas lograr']) {
    assert.ok(skill.includes(tema), `la metodología ya no pregunta «${tema}»`);
  }
  for (const campo of camposDe(categoria)) {
    assert.equal(campo.pedirAntesDeGenerar, true, `\`${campo.id}\` no se pregunta antes de escribir`);
    assert.match(campo.guia ?? '', /anota exactamente «\(saltada\)»/);
  }
});

test('no genera con preguntas sin contestar; saltar es una respuesta', () => {
  const respuestas = (valor: string) =>
    Object.fromEntries(camposDe(categoria).map((c) => [claveCorta(c.id), valor]));
  const turno = (r: Record<string, string>) => ({ mensaje: 'Arranco.', respuestas: r, listo: true });
  assert.equal(arranca(categoria, turno(respuestas('')), respuestas('')), false);
  const casi = { ...respuestas('algo'), goal: '' };
  assert.equal(arranca(categoria, turno(casi), casi), false, 'generó con una pregunta sin contestar ni saltar');
  assert.equal(arranca(categoria, turno(respuestas(SALTADA)), respuestas(SALTADA)), true);
});

test('abre preguntando la primera, no con una lista; lo heredado no se pregunta', () => {
  const e = estadoVacio();
  e.perfil = { 0: { service: 'agentes IA', result: '+40% citas' } };
  e.historial = { 3: [{ date: 'hoy', output: '<veredicto>\n<item titulo="Avatar">Dueño de inmobiliaria con 5+ agentes</item>\n</veredicto>\nAvatar' }] };
  const heredados = heredadosDe(categoria, e);
  assert.deepEqual(Object.keys(heredados).sort(), ['forwho', 'results', 'service']);

  const apertura = mensajeDeAperturaConPropuesta(categoria, {}, {}, heredados);
  assert.match(apertura, /Esto ya lo sé de los pasos anteriores/);
  assert.match(apertura, /te hago 8 preguntas de diagnóstico, de a una\./);
  assert.match(apertura, /Empecemos: ¿Qué problema cree tu cliente que está resolviendo cuando te compra\?$/);
  assert.doesNotMatch(apertura, /Me falta:/);

  assert.match(instruccionesDeEntrevista(categoria, {}), /SE PREGUNTA ANTES DE ESCRIBIR/);
});

test('el documento supone SOLO en las preguntas saltadas', () => {
  const valores = Object.fromEntries(camposDe(categoria).map((c) => [c.id, `respuesta de ${c.id}`]));
  delete valores['t2cat-evidence'];
  const prompt = armarPrompt(2, valores, estadoVacio());
  assert.match(prompt, /EL DIAGNÓSTICO YA SE CONVERSÓ/);
  assert.match(prompt, /SOLO para lo que dependa de ellas puedes hacer un supuesto razonable/);
  assert.match(prompt, /Fuera de las saltadas, NO uses \[SUPUESTO\]/);
  // Cada respuesta va con SU pregunta, y la que falta va como saltada.
  assert.match(prompt, /- ¿Por qué te eligen a ti en vez de esas alternativas\?\n  respuesta de t2cat-whychoose/);
  assert.match(prompt, /- ¿Qué te indica que tu posicionamiento actual no está funcionando\?\n  \(saltada\)/);
  assert.doesNotMatch(prompt, /MODO DOCUMENTO|Todo supuesto razonable que necesites hacer/);
});
