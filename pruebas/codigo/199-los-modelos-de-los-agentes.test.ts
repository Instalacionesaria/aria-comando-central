// LOS MODELOS DE LOS AGENTES NUEVOS. Tipo: Código.
//
// Un identificador mal escrito no falla en ninguna prueba con la red falseada: la red falsa contesta lo
// que le digan. Falla en producción, con `IA-MODELO` en cada llamada, y la pantalla manda a revisar una
// llave que está bien. Esta prueba lo ataja antes: cada constante de `lib/agentes/modelos.ts` tiene que
// estar en la lista de modelos que el proyecto acepta usar, la MISMA que vigila el de Fundaciones en la 90
// (`pruebas/apoyo/modelos-validos.ts`).
//
// No dice que la llave de la principal alcance cada modelo: eso es AG-92, con el OK del usuario.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as modelos from '../../lib/agentes/modelos.ts';
import { MODELO } from '../../lib/fundaciones/generacion.ts';
import { MODELO_DEL_AUDITOR } from '../../lib/auditor/modelo.ts';
import { archivosFuente } from '../apoyo/fuente.ts';
import { MODELOS_SIN_HERRAMIENTA_FORZADA, MODELOS_VALIDOS } from '../apoyo/modelos-validos.ts';

test('cada constante de `lib/agentes/modelos.ts` es un modelo que el proyecto acepta', () => {
  const constantes = Object.entries(modelos);
  // La entrada muerta: un archivo vacío —o un import que no trae nada— pasaría el bucle de abajo sin
  // comparar una sola. Son las cinco de AG-90; sumar un agente es sumarlo acá también.
  assert.deepEqual(constantes.map(([nombre]) => nombre).sort(), [
    'MODELO_DEL_BRIEF',
    'MODELO_DEL_EXECUTIVE',
    'MODELO_DEL_PLAN',
    'MODELO_DE_LAS_OBJECIONES',
    'MODELO_DE_LA_REUNION',
  ]);
  for (const [nombre, valor] of constantes) {
    assert.equal(typeof valor, 'string', `${nombre} no es un identificador: en ese archivo sólo van modelos`);
    assert.ok(
      MODELOS_VALIDOS.includes(valor),
      `${nombre} = «${String(valor)}» no es un modelo válido: toda llamada de ese agente va a fallar con IA-MODELO`,
    );
  }
});

test('los módulos que fuerzan su herramienta no usan un modelo que la rechaza', () => {
  /* La lista de válidos acepta `claude-sonnet-5-5` desde AG1. Los tres módulos que ya existían y fuerzan
     su herramienta (`tool_choice` de tipo `tool`) no pueden pasar a ese modelo sin dejar de forzarla: sería
     un 400 en cada conversación, cada relleno y cada auditoría, con todas las pruebas de red falsa en verde
     (`docs/OTROS/agentes/06-MODELOS-USO-TOPES-E-INCIDENTES.md`, AG-90). */
  const FUERZAN = [
    { ruta: 'lib/fundaciones/conversacion.ts', nombre: 'MODELO', modelo: MODELO },
    { ruta: 'lib/fundaciones/relleno.ts', nombre: 'MODELO', modelo: MODELO },
    { ruta: 'lib/auditor/modelo.ts', nombre: 'MODELO_DEL_AUDITOR', modelo: MODELO_DEL_AUDITOR },
  ];
  const forzada = /tool_choice:\s*\{\s*type:\s*'(tool|any)'/;
  // La lista está completa: nadie más en `lib/` fuerza una herramienta.
  const enLib = archivosFuente(['lib']).filter((a) => forzada.test(a.limpio)).map((a) => a.ruta);
  assert.deepEqual([...enLib].sort(), FUERZAN.map((f) => f.ruta).sort());
  for (const { ruta, nombre, modelo } of FUERZAN) {
    assert.ok(
      !MODELOS_SIN_HERRAMIENTA_FORZADA.includes(modelo),
      `${ruta} fuerza su herramienta y ${nombre} = «${modelo}», que la rechaza con un 400: quitar el forzado antes de cambiar el modelo`,
    );
  }
});
