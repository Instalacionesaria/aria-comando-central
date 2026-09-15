// El selector de período de Conversation: una lista cerrada, servida y dibujada desde el mismo sitio.
// Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ SE PIDIÓ, Y POR QUÉ LA PARTE DIFÍCIL NO ES DIBUJAR LOS BOTONES
//
// *«que haya un de hoy 7 dias 30 dias y el completo, y como por ahora no hay data mas atras
// simplemente que por ahora se quede con toda la informacion mas antigua que tenga»*
//
// Cuatro botones son media hora. Lo que este archivo cuida son las dos formas en que un selector de
// período miente sin fallar:
//
//   1 · **La ventana que se sirve no es la que el botón dice.** Un `?periodo=` desconocido que cae
//       en un valor por omisión deja el botón encendido en una cosa y las cifras calculadas sobre
//       otra. Nada falla, los números están bien, y describen un período que nadie pidió.
//
//   2 · **«Completo» se lee como historia.** La ventana son diez años y la primera fila es de hace
//       tres semanas. Sin decir DESDE CUÁNDO hay datos, «completo» invita a leer tres semanas como
//       un año — y a concluir cosas sobre una tendencia que no existe.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import {
  DIAS_DE_TODO,
  PERIODOS,
  PERIODO_POR_OMISION,
  periodoDe,
} from '../../lib/negocio/periodo.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const RUTA = 'app/api/auditoria/route.ts';
const PANEL = 'components/conversation/PanelDeConversation.jsx';
const VISTA = 'lib/auditor/vista.ts';
const PERIODO = 'lib/negocio/periodo.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// LA LISTA CERRADA
// ═══════════════════════════════════════════════════════════════════════════════

test('los cuatro períodos son los cuatro que se pidieron, y ninguno más', () => {
  /* La lista se compara ENTERA y no con un `includes` por clave: con `includes`, agregar un quinto
     período no rompe nada, y el quinto es justamente el que nadie decidió que fuera válido — el
     sesgo de las citas congeladas crece con la ventana, así que cada una es una decisión. */
  assert.deepEqual(
    PERIODOS.map((p) => p.clave),
    ['hoy', '7d', '30d', 'completo'],
  );
  assert.deepEqual(
    PERIODOS.map((p) => p.dias),
    [1, 7, 30, DIAS_DE_TODO],
  );
});

test('una clave que no está en la lista se RECHAZA, no se corrige', () => {
  /* ══════════════════════════════════════════════════════════════════════════
     EL DEFECTO QUE ESTE ARCHIVO EXISTE PARA CERRAR

     Devolver el valor por omisión ante una clave desconocida es lo que hace casi todo el mundo, y
     acá es exactamente el error: quien pide noventa días recibe treinta, ve un tablero lleno de
     números correctos, y no tiene forma de enterarse. `null` obliga a quien llama a contestar un
     400, que es lo único que se nota.

     Los tres casos son distintos y los tres tienen que morir: una clave inventada, un NÚMERO —la
     forma vieja del parámetro, que alguien va a volver a probar— y un valor negativo, que en SQL
     produce `now() - interval '-5 days'`, o sea una ventana en el FUTURO que cuenta cero filas y
     se dibuja como «no pasó nada».
     ══════════════════════════════════════════════════════════════════════════ */
  assert.equal(periodoDe('90d'), null);
  assert.equal(periodoDe('30'), null, 'un número crudo se está aceptando como si fuera una clave');
  assert.equal(periodoDe('-5'), null);
  assert.equal(periodoDe('completo '), null, 'con un espacio de más ya no es la misma clave');
  assert.equal(periodoDe('COMPLETO'), null, 'la clave distingue mayúsculas: el botón manda minúsculas');
});

test('la AUSENCIA sí cae en el valor por omisión, que es uno de los cuatro', () => {
  /* La primera carga no manda parámetro, y ése es el único caso en que corregir es correcto: no hay
     nadie a quien desmentir. Y el valor por omisión tiene que SER uno de los botones — si fuera
     catorce días, como era antes, el segmentado se dibujaría sin nada encendido sobre cifras de una
     ventana que ningún botón puede volver a pedir. */
  for (const vacio of [null, undefined, '']) {
    assert.equal(periodoDe(vacio)?.clave, PERIODO_POR_OMISION);
  }
  assert.ok(
    PERIODOS.some((p) => p.clave === PERIODO_POR_OMISION),
    'el período por omisión no es ninguno de los botones: el segmentado queda sin nada encendido',
  );
});

test('«completo» es una ventana grande, no un centinela', () => {
  /* Con `null` o `0`, cada una de las nueve consultas tendría que bifurcar su `where`, y la décima
     que alguien escriba se va a olvidar de la rama — la cifra nueva saldría de catorce días bajo un
     botón que dice «completo». El número grande deja un solo camino.
     Diez años: más que la vida del CRM de esta empresa, cuya fila más vieja es de 2026. */
  const completo = PERIODOS.find((p) => p.clave === 'completo');
  assert.ok(completo, 'se fue el período «completo»');
  assert.ok(completo.dias >= 3650, 'la ventana de «completo» recorta historia real');
  assert.ok(
    PERIODOS.every((p) => Number.isInteger(p.dias) && p.dias > 0),
    'algún período tiene una ventana que no es un entero positivo: en SQL eso mira al futuro',
  );
});

test('«completo» y «hoy» dicen lo que NO se ve en su etiqueta', () => {
  /* Los dos rótulos prometen más de lo que dan y por eso llevan matiz obligatorio:
     · «Completo» se lee como toda la historia del negocio, y son tres semanas.
     · «Hoy» se lee como el día del calendario, y son las últimas 24 horas — el día calendario
       necesitaría una zona horaria, y elegirla mal es un defecto que esta suite ya persigue
       corriendo en tres zonas.
     Los otros dos no llevan matiz, y eso también se comprueba: una aclaración en los cuatro se
     aprende a ignorar, y entonces las dos que importan tampoco se leen. */
  const matiz = new Map(PERIODOS.map((p) => [p.clave, p.matiz]));
  assert.ok(matiz.get('completo'), '«completo» no advierte que puede ser mucho menos de lo que parece');
  assert.ok(matiz.get('hoy'), '«hoy» no aclara que son las últimas 24 horas y no el día calendario');
  assert.equal(matiz.get('7d'), null, 'un matiz en los cuatro deja de ser un matiz');
  assert.equal(matiz.get('30d'), null);
});

// ═══════════════════════════════════════════════════════════════════════════════
// QUE LA LISTA SEA LA MISMA EN LOS DOS LADOS
// ═══════════════════════════════════════════════════════════════════════════════

test('la ruta valida contra la lista y contesta 400, en vez de servir otra ventana', () => {
  const ts = leer(RUTA);
  assert.match(ts, /periodoDe\(/, 'la ruta no valida el período contra la lista cerrada');
  /* El rechazo con `=== null` y no con un `??`: un `periodoDe(x) ?? POR_OMISION` compila, se lee
     razonable, y es exactamente el defecto — sirve treinta días bajo el botón equivocado. */
  assert.match(
    ts,
    /periodo === null\)\s*return rechazo\(/,
    'un período desconocido no se rechaza: se está corrigiendo en silencio',
  );
  assert.ok(
    !/periodoDe\([^)]*\)\s*\?\?/.test(ts),
    'el período desconocido cae en un valor por omisión con `??`: eso sirve otra ventana sin avisar',
  );
});

test('las CINCO cifras reciben la misma ventana, y sale del período', () => {
  /* Con una sola que se quede sin argumento, esa cifra sigue calculándose sobre catorce días
     mientras las otras cuatro cambian con el botón. Las cinco se dibujan en la misma pantalla, así
     que el resultado es una tarjeta donde dos números hablan de dos períodos distintos y nada lo
     dice. Es la razón por la que las cinco van además en una sola transacción. */
  const ts = leer(RUTA);
  for (const fn of [
    'tasaDeCancelacion',
    'indicadoresDelLead',
    'atribucionDelLead',
    'consumoDelPrecall',
    'sentimientoPorFlujo',
  ]) {
    assert.match(
      ts,
      new RegExp(`${fn}\\(periodo\\.dias\\)`),
      `${fn} no recibe la ventana del período: se queda en la de por omisión sin que nada falle`,
    );
  }
});

test('la lectura del navegador EXIGE el período: no tiene uno por omisión', () => {
  /* Un argumento opcional acá compila y es el mismo defecto por otro camino: una llamada que se
     olvide de pasarlo pide treinta días mientras el botón encendido dice otra cosa.
     Se comprueba que el parámetro NO tenga `=` —que es como se escribe un valor por omisión— y que
     lo que se manda sea ese parámetro y no una constante. */
  const ts = leer(VISTA);
  assert.match(
    ts,
    /leerLaPantalla\(periodo: ClaveDePeriodo\)/,
    'la lectura dejó de exigir el período, o le pusieron un valor por omisión',
  );
  assert.match(
    ts,
    /periodo=\$\{encodeURIComponent\(periodo\)\}/,
    'el período no viaja en la petición: la pantalla pide siempre la misma ventana',
  );
});

test('los botones salen de PERIODOS y no de una lista escrita en la pantalla', () => {
  /* La entrada muerta de todo lo de arriba: con la lista copiada en el JSX, las pruebas del módulo
     siguen pasando y las dos listas divergen en el próximo cambio — un botón que manda una clave
     que el servidor rechaza, o un período válido que ningún botón puede pedir. */
  const jsx = leer(PANEL);
  assert.match(
    jsx,
    /import \{[^}]*PERIODOS/s,
    'la pantalla no importa la lista de períodos: si la copió, va a divergir del servidor',
  );
  assert.match(jsx, /PERIODOS\.map\(/, 'los botones no se derivan de la lista');
  for (const p of PERIODOS) {
    assert.ok(
      !jsx.includes(`'${p.clave}'`) || p.clave === PERIODO_POR_OMISION,
      `la clave «${p.clave}» está escrita a mano en la pantalla: tiene que salir de PERIODOS`,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// QUE «COMPLETO» NO SE LEA COMO HISTORIA
// ═══════════════════════════════════════════════════════════════════════════════

test('la pantalla dibuja DESDE CUÁNDO hay datos, y no la ventana pedida', () => {
  /* Lo que se pidió: *«como por ahora no hay data mas atras simplemente que por ahora se quede con
     toda la informacion mas antigua que tenga»*. Servir todo lo que hay es la mitad fácil; la que
     evita la conclusión falsa es decir desde cuándo.
     `desde` sale de un `min()` sobre las filas, no de `now() - dias` — eso lo comprueban las pruebas
     de base de los dos módulos. Acá se comprueba que llegue a la pantalla. */
  const jsx = leer(PANEL);
  assert.match(jsx, /fechaCorta\(r\.desde\)/, 'Lead Flow no dice desde cuándo hay datos');
  assert.match(jsx, /fechaCorta\(c\.desde\)/, 'Appointment Flow no dice desde cuándo hay datos');
  assert.match(
    jsx,
    /desde el \$\{desde\}/,
    'la fecha de comienzo no se dibuja: «completo» se lee entonces como toda la historia',
  );
});

test('el período NO se ofrece en las pestañas que no lo usan', () => {
  /* Auditoría y Prompts no están acotadas por ventana. Un segmentado que se enciende encima de una
     lista que no cambia enseña que el control no hace nada — y después tampoco se usa donde sí. */
  const jsx = leer(PANEL);
  assert.match(
    jsx,
    /\{FLUJOS\[sub\] \? <Periodos/,
    'el selector de período se dibuja también en Auditoría y Prompts, donde no cambia nada',
  );
});

test('el vocabulario del período no importa nada que toque la base', () => {
  /* ── UNA PRUEBA QUE SALIÓ DE UNA CONSTRUCCIÓN ROTA ────────────────────────
   *
   * `DIAS_DE_TODO` vivió un rato en `indicadoresDeCitas.ts`, al lado de `DIAS_DE_LA_TASA`, que es
   * donde parecía corresponder. Este archivo lo importaba desde ahí — y como también lo importa el
   * componente del navegador, eso metió la capa de datos entera, con el cliente de PostgreSQL,
   * dentro del paquete del cliente. `next build` lo rechazó.
   *
   * Se arregló moviendo la constante acá. La prueba existe porque el arreglo es fácil de deshacer:
   * la próxima constante compartida va a tener la misma tentación, y el fallo aparece recién en la
   * construcción, que es tarde y lejos. */
  const ts = leer(PERIODO);
  const imports = [...ts.matchAll(/^\s*import\s[^;]+;/gm)].map((m) => m[0]);
  assert.deepEqual(
    imports,
    [],
    'el vocabulario del período importa algo: lo usan los dos lados, y lo que arrastre va al navegador',
  );
});
