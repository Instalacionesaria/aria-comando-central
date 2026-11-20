// LA TAREA `contactos` DEL CRON: LOS NUEVOS SIN ETIQUETA, Y NADA DE CONVERSACIONES. Tipo: Código.
//
// Desde el 2026-11-20 la tarea `contactos` trae los leads nuevos sin etiqueta para todos los clientes, sin interruptor
// (`lib/negocio/contactosSinEtiqueta.ts`), y el cron no trae conversaciones. Esto mira la forma de `releerContactos` y
// del bucle del barrido; el comportamiento lo cubre `pruebas/base/506-el-cron-de-contactos-sin-etiqueta.test.ts`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const barrido = sinComentarios(readFileSync(join(RAIZ, 'lib/negocio/barrido.ts'), 'utf8'));

test('la tarea `contactos`: los nuevos, después los avisos y al final las miniaturas, con sus llamadas', () => {
  const i = barrido.indexOf('async function releerContactos(');
  const cuerpo = barrido.slice(i, barrido.indexOf('\n}\n', i));
  const nuevos = cuerpo.indexOf('sincronizarLosNuevos(');
  const avisos = cuerpo.indexOf('await reprocesarAvisosDeOportunidad(ambito, acceso, { fin, ahora })');
  const miniaturas = cuerpo.indexOf('await completarMiniaturas(ambito, acceso,');
  assert.ok(nuevos > 0 && nuevos < avisos && avisos < miniaturas, 'el orden no es nuevos → avisos → miniaturas');
  assert.match(
    cuerpo,
    /\(nuevos\.corrio \? nuevos\.llamadas : 0\) \+ miniaturas\.pedidos \+ avisos\.llamadas/,
    'las llamadas de la traída, los avisos o las miniaturas no se cuentan en el sello',
  );
  assert.doesNotMatch(cuerpo, /sincronizarContactos\(/, 'el cron volvió a buscar por etiqueta');
  assert.doesNotMatch(barrido, /releerLosCongelados\(/, 'el cron volvió a releer los congelados de a uno');
});

test('sin interruptor: ninguna variable de entorno decide la regla', () => {
  assert.doesNotMatch(barrido, /CONTACTOS_SIN_ETIQUETA|traeTodosLosContactos/);
  const traida = sinComentarios(readFileSync(join(RAIZ, 'lib/negocio/contactosSinEtiqueta.ts'), 'utf8'));
  assert.doesNotMatch(traida, /process\.env/, 'la traída volvió a depender de una variable de entorno');
});

test('`mensajes` se sella saltada sin despacharse, y DESPUÉS del control de la credencial', () => {
  const salto = barrido.indexOf("if (tarea === 'mensajes') {");
  assert.ok(salto > 0, 'el bucle no saltea `mensajes`');
  // El control de la credencial del CRM es el que sella `sin_token`: tiene que ir antes, o el motivo de este salto
  // sería el sello más nuevo del cliente y apagaría el aviso de «cliente sin conexión».
  // Dentro del MISMO bucle: el `for` de las tareas más cercano antes del salto, y el control entre los dos.
  const bucle = barrido.lastIndexOf('for (const tarea of tareasDeLaUnidad) {', salto);
  const credencial = barrido.indexOf("acceso.tipo !== 'listo'", bucle);
  assert.ok(bucle > 0 && credencial > bucle && credencial < salto, 'el salto de `mensajes` va antes del control de la credencial');
  assert.ok(salto < barrido.indexOf('try {', salto), 'el salto no va antes del despacho');
  assert.doesNotMatch(barrido, /ingerirMensajes\(/, 'el cron volvió a traer conversaciones');
});
