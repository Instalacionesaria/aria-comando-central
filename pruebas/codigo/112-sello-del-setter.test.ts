// UN SOLO escritor del sello, y QUIÉNES lo llaman. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO NO SE PUEDE PROBAR EJECUTANDO
//
// El comportamiento del sello está probado contra la base en `pruebas/base/97-closer-avanzar.test.ts`
// —se enciende con quien registra, no se reescribe, y no toca a un contacto del closer ni a un
// congelado— y el disparador que lo protege, en `90-negocio-closer-setter.test.ts`.
//
// Queda una cosa que ninguna prueba de comportamiento atrapa: **que nadie más escriba esa columna, y
// que quienes la escriben sean solo las intervenciones MANUALES.** Una prueba que ejecuta mide lo que
// pasó en el camino que recorrió; un segundo escritor en un camino que no recorrió le da verde.
//
// ── Y ES LA COLUMNA CON EL PEOR MODO DE FALLO DEL MÓDULO ────────────────────
//
// De `contactos.sello_setter_id` sale la **comisión diferida** del setter: el tramo que cobra sobre
// las ventas grandes que cierra el closer sobre leads que él originó. El disparador conserva el
// primero y descarta los siguientes **en silencio**, que es lo correcto para una carrera entre dos
// personas y lo peor posible para un sello puesto por error: se pone una vez, no avisa, y no hay
// operación de corrección en ninguna parte.
//
// Así que el riesgo no es que no se escriba —eso se ve, la comisión sale en cero— sino que lo
// escriba algo que no debería, y que le pague a la persona equivocada durante meses sin que nada
// falle. Estas guardas se leen porque ése es el defecto que no tiene síntoma.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente } from '../apoyo/fuente.ts';

const SELLADOR = 'lib/negocio/sello.ts';

/** Los dos únicos llamadores, y el motivo por el que cada uno lo es. */
const LLAMADORES = [
  // Registrar un resultado: alguien miró la conversación y decidió en qué terminó.
  'lib/negocio/avanzar.ts',
  // Responder un mensaje: alguien leyó y contestó.
  'app/api/contactos/[id]/mensajes/route.ts',
];

function limpio(ruta: string): string {
  const a = archivosFuente(['app', 'lib']).find((x) => x.ruta === ruta);
  assert.ok(a, `no se encontró ${ruta}`);
  return a.limpio;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · NADIE MÁS ESCRIBE LA COLUMNA
// ═══════════════════════════════════════════════════════════════════════════════

test('`sello_setter_id` tiene UN solo escritor, y `sello_setter_el` no tiene ninguno', () => {
  /* Se busca la FORMA de la escritura y no una convención de nombres: cualquier archivo de `app/` o
     `lib/` que ponga la columna dentro de un `set(` es un escritor, se llame como se llame.

     La columna existe desde la migración 011 y **estuvo sin escritor hasta ahora**, así lo dejó
     anotado `015_comisiones.sql`. O sea que el estado de partida de esta guarda es cero escritores:
     cualquiera que aparezca es nuevo, y hay que mirarlo. */
  const escribenElSello = archivosFuente(['app', 'lib'])
    .filter((a) => a.ruta !== SELLADOR)
    .filter((a) => /set\(\s*\{[^}]*sello_setter_id/s.test(a.limpio))
    .map((a) => a.ruta);

  assert.deepEqual(
    escribenElSello,
    [],
    'alguien más escribe `sello_setter_id`: el disparador conserva el primero y descarta el resto ' +
      `en silencio, así que un segundo escritor no falla — le paga a otra persona. Único: ${SELLADOR}`,
  );

  /* Y LA FECHA NO LA ESCRIBE NADIE, ni el sellador. La pone el disparador. Mandarla desde la
     aplicación sería tener dos relojes para el mismo hecho, y así se llega a un sello con fecha del
     futuro que ninguna consulta por mes va a contar. */
  const escribenLaFecha = archivosFuente(['app', 'lib'])
    .filter((a) => /set\(\s*\{[^}]*sello_setter_el/s.test(a.limpio))
    .map((a) => a.ruta);

  assert.deepEqual(
    escribenLaFecha,
    [],
    'se está escribiendo `sello_setter_el` desde la aplicación: la pone el disparador, y con dos ' +
      'relojes para el mismo hecho el sello puede quedar con fecha del futuro',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LO LLAMAN LAS INTERVENCIONES MANUALES, Y NADIE MÁS
// ═══════════════════════════════════════════════════════════════════════════════

test('el sello lo enciende una intervención MANUAL, y ningún automatismo', () => {
  /* ── LA AFIRMACIÓN QUE ESTA PRUEBA VUELVE VERIFICABLE ───────────────────────
   *
   * *«El apagado automático del agente no enciende el sello.»* Es una decisión de producto y sin
   * esta guarda es nada más una frase: `lib/negocio/ingesta.ts` y el aviso del CRM corren solos, en
   * cada ciclo del reloj, sobre todos los contactos. Un sellado desde ahí le pondría el sello a
   * **quien haya abierto la pestaña**, o a nadie, y la comisión diferida quedaría repartida por
   * quién tenía el navegador abierto.
   *
   * Y no alcanza con listar quiénes NO deben llamarlo: la lista se queda vieja el día que se agrega
   * un automatismo nuevo. Se fija el conjunto EXACTO de llamadores, así que un llamador nuevo
   * —automático o manual— pone esto en rojo y obliga a decidirlo a propósito. */
  const llaman = archivosFuente(['app', 'lib'])
    .filter((a) => a.ruta !== SELLADOR)
    .filter((a) => /sellarSiEsDelSetter\s*\(/.test(a.limpio))
    .map((a) => a.ruta)
    .sort();

  assert.deepEqual(
    llaman,
    [...LLAMADORES].sort(),
    'cambió quién enciende el sello. Si es un llamador nuevo, tiene que ser una acción MANUAL de ' +
      'una persona identificada; si es un automatismo, le va a atribuir el lead a quien tenga la ' +
      'pestaña abierta',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL ORDEN Y LA POLÍTICA DE FALLO, que son distintos en cada llamador
// ═══════════════════════════════════════════════════════════════════════════════

test('al responder, el sello va DESPUÉS del envío y su fallo NO se propaga', () => {
  /* Las dos cosas se leen porque las dos son de orden y de excepción, y ninguna de las dos tiene
     síntoma en una prueba que ejecuta el camino feliz.

     **El orden:** sellar antes de mandar sería atribuirle a alguien un trabajo que no ocurrió — si
     el canal rechaza el mensaje, el sello ya está puesto y el disparador no lo deja corregir.

     **El `catch`:** acá el mensaje YA salió y ya está guardado. Un 500 le diría a quien respondió
     que no salió, y lo mandaría de nuevo. Un mensaje repetido a un lead real es peor que un sello
     que falta: el sello se vuelve a intentar en la próxima acción. */
  const ruta = limpio('app/api/contactos/[id]/mensajes/route.ts');

  const envio = ruta.indexOf('escribirMensajes(');
  const sello = ruta.indexOf('sellarSiEsDelSetter(');
  assert.ok(envio > 0, 'no se encontró el envío');
  assert.ok(sello > 0, 'no se encontró el sellado');
  assert.ok(
    sello > envio,
    'el sello se pone ANTES de guardar el mensaje: si el canal lo rechaza, queda alguien atribuido ' +
      'por un trabajo que no ocurrió, y el disparador no deja corregirlo',
  );

  // El `try` tiene que envolver AL SELLADO, no a cualquier otra cosa del archivo.
  const antes = ruta.lastIndexOf('try {', sello);
  const despues = ruta.indexOf('} catch', sello);
  assert.ok(
    antes > envio && despues > sello,
    'el sellado de la ruta de mensajes no está envuelto en un `try`: un fallo al sellar devolvería ' +
      '500 sobre un mensaje YA enviado, y quien respondió lo mandaría de nuevo',
  );
});

test('al registrar, el sello va DENTRO de la transacción y su fallo SÍ revierte', () => {
  /* La asimetría con el caso de arriba, y es deliberada. Acá nada se confirmó todavía: si el sello
     falla, que se caiga el resultado entero es lo correcto. Un resultado registrado sin atribución
     es comisión diferida que nadie puede reclamar, y **no hay operación de corrección**: el
     disparador solo acepta el primer sello.

     Lo que se lee es DÓNDE está la llamada. `registrarResultado` corre dentro de la transacción que
     abre `conOrganizacion(`; la ruta corre fuera. Llamarlo desde la ruta compilaría igual, dejaría
     todas las pruebas en verde, y movería el sello afuera de la transacción sin ningún síntoma. */
  const enLaRuta = limpio('app/api/contactos/[id]/avanzar/route.ts');
  assert.ok(
    !/sellarSiEsDelSetter\s*\(/.test(enLaRuta),
    'el sello se llama desde la RUTA de avanzar: eso lo saca de la transacción, y un sello que ' +
      'queda puesto sobre un resultado que se revirtió atribuye un lead que nadie trabajó',
  );

  const escritor = limpio('lib/negocio/avanzar.ts');
  const resultado = escritor.indexOf("insertInto('resultados')");
  const sello = escritor.indexOf('sellarSiEsDelSetter(');
  assert.ok(resultado > 0 && sello > 0);
  assert.ok(
    sello > resultado,
    'el sello se pone antes de insertar el resultado: no es un defecto de datos —la transacción lo ' +
      'cubre— pero invierte el orden que el archivo dice tener, y es lo que se lee para entenderlo',
  );

  // Y acá NO hay `try`: el fallo tiene que subir.
  const antes = escritor.lastIndexOf('try {', sello);
  const cierra = antes < 0 ? -1 : escritor.indexOf('}', antes);
  assert.ok(
    antes < 0 || cierra < sello,
    'el sellado de `registrarResultado` está envuelto en un `try`: entonces un fallo al sellar deja ' +
      'el resultado escrito y sin atribución, que es exactamente lo que la transacción evitaba',
  );
});
