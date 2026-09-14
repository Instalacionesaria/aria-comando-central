// Los dos lectores de mensajes del auditor piden las MISMAS columnas. Tipo: Código.
//
// ══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO NO SE PUEDE DEJAR A LA DISCIPLINA
//
// `lib/auditor/analisis.ts` y `lib/auditor/buscarMejora.ts` tienen cada uno su propia
// `mensajesDelContacto`, y las dos alimentan a `atribuir()`. Están separadas a propósito —leen topes
// distintos y viven en caminos distintos— pero **tienen que pedir lo mismo**, porque `atribuir()`
// decide con lo que le llega y nada más.
//
// Si una pidiera menos columnas que la otra, la MISMA conversación se atribuiría distinto en los dos
// caminos: el carril rojo vería una línea como AUTOMATIZACIÓN —porque su `fuente` es `workflow`— y
// el buscador de mejoras la vería como AGENTE IA. La mejora del día propondría reescribir el prompt
// del agente apoyándose en líneas que el auditor ya había decidido que no eran suyas.
//
// Los dos módulos se verían correctos por separado, las dos consultas correrían sin error, y lo
// único raro sería que las recomendaciones no se parecen a los hallazgos.
//
// Y el precedente está escrito en `analisis.ts`: *«el día que alguien lo quite por prolijidad la
// atribución del auditor se rompería en silencio»*. Eso vale para las dos copias, no para una.
// ══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente } from '../apoyo/fuente.ts';

/** Las columnas del `select` que alimenta a `atribuir()`, en el orden en que están escritas. */
function columnasDelSelect(limpio: string): string[] {
  const i = limpio.indexOf("selectFrom('mensajes')");
  assert.notEqual(i, -1, 'el archivo dejó de leer `mensajes`: ¿se renombró la tabla?');
  const j = limpio.indexOf('.select(', i);
  assert.notEqual(j, -1, 'no se encontró el `select` que sigue a `selectFrom`');
  const k = limpio.indexOf('])', j);
  assert.notEqual(k, -1, 'el `select` no es una lista: la prueba dejó de poder leerlo');
  return [...limpio.slice(j, k).matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string);
}

test('los dos lectores de mensajes del auditor piden exactamente las mismas columnas', () => {
  const fuentes = archivosFuente(['lib']);
  const de = (ruta: string): string[] => {
    const f = fuentes.find((a) => a.ruta === ruta);
    assert.ok(f, `${ruta} no existe: si se renombró, hay que renombrarlo acá también`);
    return columnasDelSelect(f.limpio);
  };

  const delAnalisis = de('lib/auditor/analisis.ts');
  const deLaMejora = de('lib/auditor/buscarMejora.ts');

  /* Se comparan ORDENADAS y no en el orden en que están escritas: el orden de un `select` no cambia
     nada, y exigirlo haría fallar la prueba por una reordenación inofensiva — que es la clase de
     falso positivo que enseña a apagar una prueba. */
  assert.deepEqual(
    [...deLaMejora].sort(),
    [...delAnalisis].sort(),
    'los dos lectores del auditor dejaron de pedir lo mismo. `atribuir()` decide con lo que le ' +
      'llega, así que la misma conversación va a salir atribuida distinto en cada camino — y los ' +
      'dos módulos se van a ver correctos por separado',
  );

  /* Y que la lista no sea trivialmente vacía: sin esto, un cambio que rompiera `columnasDelSelect`
     dejaría la prueba comparando `[]` con `[]` y pasando para siempre. */
  assert.ok(
    delAnalisis.includes('fuente') && delAnalisis.includes('estado_entrega_familia'),
    'el lector del análisis dejó de pedir las columnas que deciden la atribución y la entrega',
  );
});
