// Tu ficha describe el negocio; el cliente ideal se define solo en el ICP.
//
// Hasta el 2026-10-03 la ficha generaba un «Perfil de Cliente» —dolores, deseos, creencias, cómo
// habla— antes de que el Research eligiera el segmento, y el ICP volvía a hacerlo sobre el segmento
// ganador: dos clientes ideales que podían contradecirse. Ahora la ficha es un Perfil del Negocio, y
// los pasos siguientes toman de ella lo del negocio y del ICP lo del cliente.
//
// Las fichas ya generadas con el formato anterior NO se borran: quedan en el historial, los pasos
// siguientes dejan de leer su documento (usan solo las respuestas de negocio) y Tu ficha avisa.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { camposDe } from '../../lib/fundaciones/campos.ts';
import { esFichaDeNegocio } from '../../lib/fundaciones/documento.ts';
import { estadoVacio, type EstadoDeFundaciones } from '../../lib/fundaciones/estado.ts';
import { fuentes } from '../../lib/fundaciones/herencia.ts';
import { herramienta } from '../../lib/fundaciones/herramientas.ts';
import { armarPrompt, datosDe } from '../../lib/fundaciones/prompts.ts';
import { leerPlantilla } from '../../lib/fundaciones/plantillas.ts';

const FICHA_NUEVA =
  '<veredicto>\n<item titulo="Qué vende">Agentes de IA para inmobiliarias</item>\n</veredicto>\n\n# Perfil del Negocio\nNEGOCIO NUEVO';
const FICHA_VIEJA = '# Perfil de Cliente\n## Los 5 dolores principales\nDOLORES DEL CLIENTE VIEJOS';

function conFicha(doc: string): EstadoDeFundaciones {
  const e = estadoVacio();
  e.perfil = {
    0: { biz: 'Allpa', service: 'agentes IA', niche: 'inmobiliarias', price: '$1,000', result: '3 clientes', experience: '5 años', pain: 'no responden a tiempo', before: 'un setter' },
    3: { niche: 'inmobiliarias' },
  };
  e.historial = { 0: [{ date: 'hoy', output: doc }], 3: [{ date: 'hoy', output: 'AVATAR GENERADO' }] };
  return e;
}

test('la ficha pregunta solo por el negocio, y su metodología no escribe el perfil del cliente', () => {
  const ficha = herramienta(0)!;
  const ids = camposDe(ficha).map((c) => c.id);
  assert.deepEqual(ids, ['t1-biz', 't1-service', 't1-niche', 't1-price', 't1-result', 't1-experience']);
  assert.equal(ficha.etiquetaSalida, 'Perfil del Negocio');

  const skill = leerPlantilla('perfil/onboarding')!;
  assert.match(skill, /este documento describe EL NEGOCIO, no al cliente ideal/);
  assert.doesNotMatch(skill, /LOS 5 DOLORES|CREENCIAS LIMITANTES|CÓMO HABLA TU CLIENTE/);
  // El veredicto con «Qué vende» es lo que distingue el formato nuevo del anterior.
  assert.match(skill, /<item titulo="Qué vende">/);
});

test('una ficha del formato anterior no se lee como contexto, pero sus datos de negocio sí', () => {
  assert.equal(esFichaDeNegocio(FICHA_NUEVA), true);
  assert.equal(esFichaDeNegocio(FICHA_VIEJA), false);
  assert.equal(esFichaDeNegocio(''), false);

  for (const id of [3, 4, 10, 26]) {
    const vieja = armarPrompt(id, {}, conFicha(FICHA_VIEJA));
    assert.doesNotMatch(vieja, /DOLORES DEL CLIENTE VIEJOS/, `la herramienta ${id} leyó el perfil de cliente viejo`);
    assert.match(vieja, /PERFIL DEL NEGOCIO \(raíz[^\n]*Qué vende: agentes IA/, `la herramienta ${id} perdió los datos de negocio`);
    const nueva = armarPrompt(id, {}, conFicha(FICHA_NUEVA));
    assert.match(nueva, /NEGOCIO NUEVO/, `la herramienta ${id} no leyó el Perfil del Negocio`);
  }
  // Y nunca entran como datos de la ficha las dos respuestas del cliente.
  const oferta = armarPrompt(4, {}, conFicha(FICHA_NUEVA));
  assert.doesNotMatch(oferta, /no responden a tiempo|un setter/, 'la Oferta leyó de la ficha lo que es del cliente');
  // El chip lo dice.
  assert.equal(fuentes(conFicha(FICHA_VIEJA)).perfil.resumen, 'Formato anterior');
  assert.equal(fuentes(conFicha(FICHA_NUEVA)).perfil.resumen, 'Perfil del negocio');
});

test('lo que la persona contó de su cliente en la ficha vieja no se pierde: lo recibe el ICP', () => {
  const icp = String(datosDe(3, {}, conFicha(FICHA_VIEJA))['_profileContext']);
  assert.match(icp, /LO QUE EL ALUMNO YA HABÍA CONTADO DE SU CLIENTE/);
  assert.match(icp, /Mayor problema de su cliente: no responden a tiempo/);
  assert.match(icp, /Qué intentaron antes de llegar a él: un setter/);
});

test('Tu ficha avisa del formato anterior y ofrece regenerarla', () => {
  const panel = sinComentarios(readFileSync(join(RAIZ, 'components/fundaciones/PanelHerramienta.jsx'), 'utf8'));
  assert.match(panel, /Tu ficha tiene el formato anterior\. Regénerala para que los demás pasos la usen completa\./);
  assert.match(panel, /esLaFicha && versionesGuardadas\.length > 0 && !esFichaDeNegocio\(versionesGuardadas\[0\]\.output\)/);
  assert.match(panel, /onClick=\{\(\) => generar\(null\)\}>\s*Regenerar mi ficha/);
});
