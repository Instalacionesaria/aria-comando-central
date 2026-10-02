// El saludo del Inicio se cuenta en la hora de la empresa. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA HORA EQUIVOCADA NO FALLA: SALUDA MAL (docs/OTROS/nueva-estructura/04-EL-INICIO.md, NE-29)
//
// «Buenos días» hasta las 12, «Buenas tardes» hasta las 19, «Buenas noches» después, en la zona de la
// ORGANIZACIÓN (`lib/negocio/tiempo.ts`: toda hora que una persona lee). Con la hora del navegador,
// quien abre la aplicación de viaje o con la máquina mal configurada leería «Buenas noches» a media
// mañana de su empresa, y no fallaría nada.
//
// La prueba principal pide EL MISMO instante en tres zonas y espera tres saludos distintos: con la
// hora del proceso, los tres serían iguales en cualquier zona en que corra la suite. Y la de la zona
// inválida mueve ella misma la zona del proceso, porque la suite corre una sola vez —en la
// integración continua, en UTC— y caer a la zona del entorno no se ve desde UTC.
//
// Las mutaciones que la ponen en rojo: contar la hora con `getHours()`; quitar `hourCycle: 'h23'`;
// `< 12` → `<= 12`; `< 19` → `<= 19`; la coma sin mirar si hay nombre; el nombre completo; una zona
// inválida que cae a la del entorno; que la pantalla le pase la zona del navegador; y una pregunta que no
// nombre la empresa de la sesión.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { saludo } from '../../lib/saludo.ts';

const T = new Date('2026-10-01T17:00:00Z');

test('el mismo instante saluda distinto en tres zonas', () => {
  // 10:00 en Los Ángeles (PDT, UTC−7), 12:00 en Lima (UTC−5) y 19:00 en Madrid (CEST, UTC+2).
  assert.deepEqual(
    ['America/Los_Angeles', 'America/Lima', 'Europe/Madrid'].map((z) => saludo('Ana', z, T)),
    ['Buenos días, Ana.', 'Buenas tardes, Ana.', 'Buenas noches, Ana.'],
  );
});

test('los cortes son a las 12 y a las 19, y medianoche es de día', () => {
  const unMinutoAntes = new Date('2026-10-01T16:59:00Z');
  assert.equal(saludo('', 'America/Lima', unMinutoAntes), 'Buenos días.', 'a las 11:59 ya es de tarde');
  assert.equal(saludo('', 'America/Lima', T), 'Buenas tardes.', 'a las 12:00 todavía es de mañana');
  assert.equal(saludo('', 'Europe/Madrid', unMinutoAntes), 'Buenas tardes.', 'a las 18:59 ya es de noche');
  assert.equal(saludo('', 'Europe/Madrid', T), 'Buenas noches.', 'a las 19:00 todavía es de tarde');
  /* Medianoche: `NE-29` dice «Buenos días» hasta las 12, y con un ciclo de 24 horas mal pedido la hora
     de medianoche sale `24` y el saludo diría «Buenas noches». */
  assert.equal(saludo('', 'America/Lima', new Date('2026-10-01T05:00:00Z')), 'Buenos días.', 'medianoche se contó como las 24');
});

test('sólo el nombre de pila, y sin nombre no hay coma', () => {
  assert.equal(saludo('  Ana   Lucía Pérez ', 'America/Lima', T), 'Buenas tardes, Ana.');
  for (const vacio of ['', '   ', undefined, null]) {
    assert.equal(saludo(vacio, 'America/Lima', T), 'Buenas tardes.', `con ${JSON.stringify(vacio)} queda una coma colgando`);
  }
});

test('una zona inválida cae a UTC, no a la del entorno', () => {
  /* A las 20:00 UTC: en UTC es de noche; en Lima (15:00) sería de tarde y en Tokio (05:00), de día.
     La prueba recorre ella misma las tres zonas del proceso, como `pruebas/base/92-mi-dia.test.ts`:
     corriendo sólo en UTC, caer a la zona del entorno daría lo mismo que caer a UTC. Node toma el
     cambio de `TZ` en caliente, para `getHours` y para el `Intl` sin zona. */
  const t = new Date('2026-10-01T20:00:00Z');
  const antes = process.env.TZ;
  try {
    for (const tz of ['America/Lima', 'UTC', 'Asia/Tokyo']) {
      process.env.TZ = tz;
      assert.equal(saludo('Ana', 'No/Existe', t), 'Buenas noches, Ana.', `con el proceso en ${tz}`);
    }
  } finally {
    if (antes === undefined) delete process.env.TZ;
    else process.env.TZ = antes;
  }
});

test('la pantalla le pasa la zona de la organización y el nombre de la sesión', () => {
  /* La función bien hecha no alcanza: la pantalla todavía puede pasarle la zona equivocada. */
  const vista = readFileSync(join(RAIZ, 'components/views/ExecutiveView.jsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  /* La llamada exacta, con `UTC` como única caída —la misma que pone la guarda—, y su resultado es lo
     que se dibuja: una llamada muerta al lado de otro saludo dejaría la prueba verde. */
  assert.match(
    vista,
    /const linea = saludo\(sesion\?\.usuarioNombre, sesion\?\.organizacion\.zonaHoraria \?\? 'UTC'\);/,
    'el Inicio no saluda con el nombre y la zona de la sesión',
  );
  assert.match(vista, /<span className="l1">\{linea\}<\/span>/, 'el Inicio dibuja otro saludo que el de la zona de la empresa');
  assert.doesNotMatch(vista, /getHours\(|getUTCHours\(|getTimezoneOffset\(|resolvedOptions\(\)|toLocaleTimeString\(/, 'el Inicio cuenta la hora por su cuenta');
});

test('la pregunta nombra la empresa de la sesión, y sin nombre dice «tu agencia»', () => {
  /* El cerebro va a hablar de la empresa en la que está la persona —la que mira, si mira otra—, así
     que la pregunta la nombra. Escrita a mano, cada inquilino leería el mismo nombre. */
  const vista = readFileSync(join(RAIZ, 'components/views/ExecutiveView.jsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  assert.match(vista, /const empresa = sesion\?\.organizacion\?\.nombre\?\.trim\(\) \|\| 'tu agencia';/, 'la pregunta no sale del nombre de la empresa de la sesión');
  assert.match(vista, /<span className="l2">¿Qué quieres saber de \{empresa\}\?<\/span>/, 'la pregunta del Inicio no nombra la empresa');
});
