// ICP & Oferta habla en español neutro con tú. Sin voseo.
//
// El agente decía «contame», «decime», «seguí», y la pantalla «Tenés», «Podés», «Probá de nuevo»,
// mientras las preguntas del formulario tuteaban («¿Cómo te presentas hoy?»). Pedido del 2026-10-02:
// un solo tono. Esta prueba mira lo que lee la persona —el texto de los componentes y los mensajes,
// sin comentarios— y lo que lee el agente, porque el modelo imita el registro de sus instrucciones.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { FUNDACIONES, herramienta } from '../../lib/fundaciones/herramientas.ts';
import {
  instruccionesDeEntrevista,
  mensajeDeApertura,
  mensajeDeAperturaConEntregable,
  mensajeDeAperturaConPropuesta,
  mensajeDeArranque,
} from '../../lib/fundaciones/conversacion.ts';
import { instruccionesDeRelleno } from '../../lib/fundaciones/relleno.ts';

/* Las formas de vos que ya aparecieron en esta pantalla, más las de su misma familia. Una lista y no
   una regla gramatical: «más», «después» o «país» terminan igual y no son verbos. */
const VOSEO =
  /(?<!\p{L})(contame|cont[aá]melos|decime|dec[ií]melo|decile|pedile|pasale|mandale|preguntame|preguntale|fijate|segu[ií]|sos|vos|ten[eé]s|pod[eé]s|quer[eé]s|hablás|escribís|escribí|llená|llenás|apretá|apretás|probá|volvé|volvés|recargá|intentá|esperá|acortá|reformulá|completá|completás|cambiá|regenerá|revisás|hacé|bajá|pedí|anotá|preguntá|mirá|tomá|usá|respondé|resumilo|citá|proponé|deducí|dejalos|proponelos|usalos|citalos)(?!\p{L})/iu;

const leer = (ruta: string): string => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));

test('la pantalla no vosea: componentes de Fundaciones y mensajes', () => {
  const componentes = readdirSync(join(RAIZ, 'components', 'fundaciones'))
    .filter((f) => f.endsWith('.jsx'))
    .map((f) => `components/fundaciones/${f}`);
  for (const ruta of [...componentes, 'lib/fundaciones/mensajes.ts', 'lib/fundaciones/herramientas.ts']) {
    const m = VOSEO.exec(leer(ruta));
    assert.equal(m, null, `${ruta} vosea: «${m?.[0]}»`);
  }
});

test('el agente no vosea: instrucciones, esquema y los cuatro saludos que arma el código', () => {
  for (const h of FUNDACIONES) {
    /* La línea que le PROHÍBE el voseo nombra las formas prohibidas entre comillas; se quita antes de
       buscar, y se exige que siga estando. */
    const instrucciones = instruccionesDeEntrevista(h, {}, 'contexto', 'entregable');
    assert.match(instrucciones, /NUNCA uses voseo/);
    const sinLaProhibicion = instrucciones.replace(/NUNCA uses voseo:[^\n]*?«quieres»\./, '');
    const m = VOSEO.exec(sinLaProhibicion);
    assert.equal(m, null, `las instrucciones de «${h.pestania}» vosean: «${m?.[0]}»`);
    assert.match(instrucciones, /Hablas en español neutro, tuteando/);

    for (const saludo of [
      mensajeDeApertura(h, {}),
      mensajeDeAperturaConPropuesta(h, {}, {}),
      mensajeDeArranque(h, {}),
      mensajeDeAperturaConEntregable(h, 'hoy'),
    ]) {
      const v = VOSEO.exec(saludo);
      assert.equal(v, null, `un saludo de «${h.pestania}» vosea: «${v?.[0]}»`);
    }

    const relleno = VOSEO.exec(instruccionesDeRelleno(h, 'contexto'));
    assert.equal(relleno, null, `el relleno de «${h.pestania}» vosea: «${relleno?.[0]}»`);
  }

  // El saludo con respuestas guardadas, que es el que más se ve al volver a una herramienta.
  const ficha = herramienta(0)!;
  assert.match(mensajeDeApertura(ficha, { biz: 'Allpa' }), /Veo que ya tienes esto guardado/);
  assert.match(mensajeDeApertura(ficha, { biz: 'Allpa' }), /¿Seguimos con eso o quieres cambiar algo\?/);

  // El esquema que describe el mensaje también pide el tono, no solo las instrucciones.
  assert.match(leer('lib/fundaciones/conversacion.ts'), /'neutro con tú \(nunca voseo\), corto, sin viñetas salvo en el resumen final\.'/);
});
