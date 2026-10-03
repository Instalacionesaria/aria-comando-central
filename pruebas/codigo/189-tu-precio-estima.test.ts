// Tu precio ayuda a estimar en vez de dejar huecos.
//
// Valor del resultado, probabilidad de lograrlo, costo del problema y facturación del cliente son
// números que casi nadie sabe, y el Pricing Protocol salía lleno de [COMPLETAR]. Desde el 2026-10-03,
// en esas cuatro preguntas (`admiteEstimacion`) el agente propone un rango para el nicho, dice de
// dónde sale, y —solo con el sí de la persona— lo anota como «[ESTIMACIÓN] rango — de dónde sale». La
// metodología lo usa y lo marca como [ESTIMACIÓN] en el documento, nunca como [COMPLETAR].

import test from 'node:test';
import assert from 'node:assert/strict';

import { camposDe } from '../../lib/fundaciones/campos.ts';
import { esquemaDeCampos, instruccionesDeEntrevista } from '../../lib/fundaciones/conversacion.ts';
import { TODAS, herramienta } from '../../lib/fundaciones/herramientas.ts';
import { estadoVacio } from '../../lib/fundaciones/estado.ts';
import { armarPrompt } from '../../lib/fundaciones/prompts.ts';
import { leerPlantilla } from '../../lib/fundaciones/plantillas.ts';

const pricing = herramienta(10)!;

test('solo las cuatro cifras de Tu precio admiten estimación', () => {
  const conEstimacion = TODAS.flatMap((h) => camposDe(h).filter((c) => c.admiteEstimacion).map((c) => c.id));
  assert.deepEqual(conEstimacion.sort(), ['t11-clientrevenue', 't11-outcome', 't11-probability', 't11-problemcost']);
});

test('el agente propone un rango con su origen y lo anota solo con el sí, marcado', () => {
  const instrucciones = instruccionesDeEntrevista(pricing, {});
  // Cuatro veces, una por pregunta.
  assert.equal(instrucciones.match(/SI NO LO SABE: no la dejes vacía de entrada\. Propón un RANGO razonable para su nicho/g)?.length, 4);
  assert.match(instrucciones, /Solo si dice que sí, anótalo EXACTAMENTE así: «\[ESTIMACIÓN\] 50–70 % — de dónde sale»/);
  // La regla general de no inventar sigue, con la excepción nombrada.
  assert.match(instrucciones, /NO inventes valores\.[\s\S]*La ÚNICA excepción son las preguntas marcadas «SI NO LO SABE»/);

  // Y el esquema lo dice campo por campo, solo en esos cuatro.
  const esquema = esquemaDeCampos(pricing)['properties'] as Record<string, { description: string }>;
  assert.match(esquema['outcome']!.description, /«\[ESTIMACIÓN\] rango — de dónde sale»/);
  assert.doesNotMatch(esquema['delivery']!.description, /ESTIMACIÓN/);
  // En las demás herramientas, nada de esto.
  assert.doesNotMatch(instruccionesDeEntrevista(herramienta(4)!, {}), /SI NO LO SABE/);
});

test('el Pricing Protocol usa la estimación y la marca como [ESTIMACIÓN], no como [COMPLETAR]', () => {
  const skill = leerPlantilla('pricing/protocol')!;
  assert.match(skill, /márcalo SIEMPRE como \[ESTIMACIÓN: de dónde sale\]/);
  assert.match(skill, /Nunca lo marques como \[COMPLETAR\]/);

  const prompt = armarPrompt(10, { 't11-probability': '[ESTIMACIÓN] 50–70 % — típico del rubro' }, estadoVacio());
  assert.match(prompt, /PROBABILIDAD REALISTA DE LOGRARLO: \[ESTIMACIÓN\] 50–70 % — típico del rubro/);
});
