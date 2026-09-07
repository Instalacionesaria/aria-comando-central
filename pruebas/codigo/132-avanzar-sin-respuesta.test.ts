// Registrar un resultado no puede reportar un fallo sobre algo que se escribió. Tipo: Código.
//
// ══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO, TAL COMO LLEGÓ
//
// Alguien registró un seguimiento y vio, en rojo:
//
//     «No se pudo contactar al servidor. No se registró nada.»
//
// La segunda mitad de esa frase es FALSA, y no por poco. `app/api/contactos/[id]/avanzar/route.ts`
// está escrita en dos pasos, y su propio comentario los nombra:
//
//     // ── PASO 1 · LA BASE, en una transacción ──
//     const registrado = await conOrganizacion(...)   // ← acá YA se confirmó el INSERT
//     // ── PASO 2 · EL CRM, y su fallo NO invalida el paso 1 ──
//     const aviso = await avisarAlCrm(...)            // ← llamada de red a GoHighLevel
//
// Así que cuando la respuesta no llega, el resultado **ya puede estar escrito**. Y
// `registrarResultado` hace un `insertInto('resultados')` sin guarda de duplicado, así que el
// cartel no era solo impreciso: invitaba a registrar de nuevo y quedarse con DOS resultados, dos
// notas, dos tareas en Mi Día y dos comisiones.
//
// ── Y ESTO YA HABÍA PASADO, EN OTRA RUTA ───────────────────────────────────
//
// `lib/http/cliente.ts` lo cuenta arriba de `ESPERA_MS`: el barrido de calendarios tardaba más de
// quince segundos contra la subcuenta real, el navegador abortaba, y se reportaba un fallo sobre
// **118 citas que sí se habían escrito**. De ahí salió la regla que este archivo hace cumplir:
// *«quien llama a una ruta que declara `maxDuration` tiene que esperar al menos eso»*.
//
// `avanzar` se escapaba por el otro lado: no declaraba `maxDuration`, así que no había tope que
// respetar y su llamador usaba la omisión de 15 s para una operación que llama al CRM.
// ══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');

/** Sin comentarios: la lección de `110`, `120`, `123`, `127`, `128`, `129`, `130` y `131`. */
const codigo = (r: string): string =>
  leer(r)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const RUTA = 'app/api/contactos/[id]/avanzar/route.ts';
const PANTALLA = 'components/negocio/Avanzar.jsx';

test('la ruta declara cuánto puede tardar, y el cliente espera AL MENOS eso', () => {
  /* Los dos números tienen que moverse juntos. Atados acá, bajar el tope de la ruta sin bajar la
     espera —o subirlo sin subirla— falla; sin esta prueba, se separan y nadie se entera hasta que
     alguien vea un fallo sobre una operación que salió bien. */
  const tope = codigo(RUTA).match(/export const maxDuration = (\d+);/);
  assert.ok(
    tope,
    `${RUTA} llama a GoHighLevel dentro del POST y no declara \`maxDuration\`: sin tope declarado ` +
      'nadie del lado del navegador tiene con qué calcular cuánto esperar',
  );

  const espera = codigo(PANTALLA).match(/const ESPERA_DE_AVANZAR_MS = ([\d_]+);/);
  assert.ok(espera, `${PANTALLA} dejó de nombrar su espera`);

  /* Los grupos se leen con `?? ''` y no con `!`: un patrón que dejara de capturar daría `NaN`, y
     `NaN >= n` es `false`, así que la comparación de abajo falla en vez de pasar por descuido. */
  const topeMs = Number(tope[1] ?? '') * 1000;
  const esperaMs = Number((espera[1] ?? '').replace(/_/g, ''));
  assert.ok(
    esperaMs >= topeMs,
    `el cliente espera ${esperaMs} ms y la ruta declara ${topeMs} ms: el navegador aborta mientras ` +
      'el servidor sigue trabajando, y entonces se reporta un fallo sobre algo que salió bien',
  );

  // Y la espera se PASA. Declarada y no usada, `pedir()` vuelve a su omisión de 15 s.
  assert.match(
    codigo(PANTALLA),
    /espera: ESPERA_DE_AVANZAR_MS,/,
    'la espera está declarada y no se pasa a `pedir()`: vuelve a valer la omisión de 15 s',
  );
});

test('el cartel NO afirma que no se registró nada', () => {
  /* Es la frase exacta que había, y la que no se puede decir: el paso 1 se confirma antes del paso
     2, así que un corte puede caer con el resultado ya escrito. */
  assert.doesNotMatch(
    codigo(PANTALLA),
    /No se registró nada/,
    'volvió la afirmación que no se puede hacer: cuando la respuesta no llega, el resultado puede ' +
      'estar escrito, y este cartel invita a duplicarlo',
  );
});

test('los dos desenlaces DESCONOCIDOS se tratan juntos, y los rechazos con código aparte', () => {
  /* Son dos familias:

       · Rechazos CON código —`no_encontrado`, `peticion_invalida`, `sin_permiso`— salen antes de
         escribir. Sobre ésos se puede decir qué pasó.
       · Corte sin respuesta, y `sin_codigo` —que es lo que devuelve `pedir()` cuando el cuerpo no
         es JSON, o sea un 502/504 de la plataforma con HTML— son desenlace DESCONOCIDO.

     El segundo caso es el que se agregó y el que se olvida: un 504 por el tope de la ruta llega
     JUSTO DESPUÉS de escribir, y sin él el cartel diría «No se pudo registrar (504)», que es la
     misma mentira con otro número. */
  const fuente = codigo(PANTALLA);

  assert.match(
    fuente,
    /r\.tipo === 'sin_respuesta' \|\| \(r\.tipo === 'rechazado' && r\.codigo === 'sin_codigo'\)/,
    'el 504 de la plataforma volvió a tratarse como un rechazo normal: llega justo después de ' +
      'escribir, así que decir «no se pudo registrar» es la misma mentira con otro número',
  );

  // Y lo que se muestra manda a COMPROBAR, que es lo único útil cuando no se sabe.
  assert.match(
    fuente,
    /PUEDE haber quedado registrado/,
    'el cartel dejó de decir que puede haber quedado registrado',
  );
  assert.match(
    fuente,
    /Historial/,
    'el cartel no dice DÓNDE mirar: sin eso, «puede haber quedado registrado» deja a la persona ' +
      'con la duda y el botón al lado',
  );
});

test('la ruta sigue escribiendo ANTES de avisarle al CRM, que es lo que hace falsa la otra frase', () => {
  /* Esta prueba no pide que cambie el orden: el orden está BIEN y su motivo está escrito —«su fallo
     NO invalida el paso 1»—. Lo que hace es dejar atado el HECHO del que depende el cartel. El día
     que alguien mueva el aviso al CRM adentro de la transacción, el mensaje de arriba pasa a ser
     demasiado prudente y esta prueba es la que lo va a decir. */
  const fuente = codigo(RUTA);
  const base = fuente.indexOf('await conOrganizacion(');
  const crm = fuente.indexOf('await avisarAlCrm(');

  assert.ok(base > 0, 'no está la transacción de la base');
  assert.ok(crm > 0, 'no está el aviso al CRM');
  assert.ok(
    base < crm,
    'el aviso al CRM pasó a estar antes de la escritura: revisá el cartel de `Avanzar.jsx`, que ' +
      'está escrito sobre el orden contrario',
  );
});
