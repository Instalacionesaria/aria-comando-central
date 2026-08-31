// El TRANSCRIPT, los HECHOS MEDIDOS y la PRECONDICIÓN. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTAS PRUEBAS DEFIENDEN
//
// Es todo lo que el modelo ve de una conversación, y los tres defectos que puede tener son de la
// clase que no da error:
//
//   · **Un transcript filtrado** hace que el auditor le imputa al agente la bronca que provocó una
//     plantilla, y que dé por abandonada una conversación que un asesor tomó.
//   · **Un sello de tiempo corrido o de ancho variable** hace que el modelo compare mal las horas, y
//     el criterio de abandono se decide sobre eso.
//   · **Un hecho medido mal** —cuántos mensajes del agente, si alguien respondió— cambia el veredicto
//     y encima descuadra el debounce, que resta contra ese número.
//
// Las tres se ven bien en pantalla.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOTIVOS_DE_NO_AUDITABLE,
  TOPE_DE_LINEAS,
  UMBRAL_DE_SILENCIO_MIN,
  armarTranscript,
  medirHechos,
  porQueNoSeAudita,
  selloDeTiempo,
  type MensajeParaAuditar,
} from '../../lib/auditor/transcripcion.ts';

/** El identificador del agente, con la forma real de GoHighLevel. */
const AGENTE = '0peGoq7VvFqnDGA7gxtX';
/** Otro identificador válido, que no es el del agente. */
const OTRO = 'JJxGem987J7MRKced71Z';

/** Un instante del 3 de agosto de 2026, en tiempo universal. */
const el3 = (hora: number, minuto: number): Date => new Date(Date.UTC(2026, 7, 3, hora, minuto));

/** Un mensaje, con lo que no está bajo prueba puesto por omisión. */
function msj(campos: Partial<MensajeParaAuditar> = {}): MensajeParaAuditar {
  return {
    direccion: 'saliente',
    autor: 'agente',
    autor_ghl_usuario_id: AGENTE,
    cuerpo: 'texto',
    enviado_el: el3(12, 0),
    ...campos,
  };
}

/** Del contacto. */
const de = (cuerpo: string | null, hora: number, minuto: number): MensajeParaAuditar =>
  msj({ direccion: 'entrante', autor: 'contacto', autor_ghl_usuario_id: null, cuerpo, enviado_el: el3(hora, minuto) });
/** Del agente de IA. */
const ia = (cuerpo: string | null, hora: number, minuto: number): MensajeParaAuditar =>
  msj({ cuerpo, enviado_el: el3(hora, minuto) });
/** De una automatización del CRM: saliente, sin identificador. */
const flujo = (cuerpo: string, hora: number, minuto: number): MensajeParaAuditar =>
  msj({ autor_ghl_usuario_id: null, cuerpo, enviado_el: el3(hora, minuto) });
/** De un asesor humano. */
const asesor = (cuerpo: string, hora: number, minuto: number): MensajeParaAuditar =>
  msj({ autor: 'persona', autor_ghl_usuario_id: null, cuerpo, enviado_el: el3(hora, minuto) });

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL SELLO DE TIEMPO
// ═══════════════════════════════════════════════════════════════════════════════

test('el sello va en la zona de la EMPRESA, y con ANCHO FIJO', async () => {
  /* ── EL DEFECTO QUE ESTA PRUEBA ATRAPÓ DE VERDAD ───────────────────────────
   *
   * La primera versión pedía `day: '2-digit'` y confiaba en `Intl`. Medido: con la configuración `es`,
   * `formatToParts` devuelve **`3`** y no `03` — `2-digit` es una preferencia, no una promesa.
   *
   * O sea que el código tenía exactamente el defecto que su propio comentario decía evitar, y de la
   * peor forma: el sello **se ve bien** y el modelo compara mal en silencio. `3/8 9:02` y
   * `03/08 14:02` en la misma columna se leen como formatos distintos.
   *
   * Se comprueba el ancho de los cuatro campos, no el valor de uno. */
  const ANCHO = /^\d{2}\/\d{2} \d{2}:\d{2}$/;

  for (const [hora, minuto] of [
    [19, 2],
    [4, 5],
    [23, 59],
    [5, 0],
    [0, 0],
  ] as const) {
    const instante = el3(hora, minuto);
    for (const zona of ['America/Lima', 'UTC', 'Europe/Madrid', 'Asia/Tokyo']) {
      const sello = selloDeTiempo(instante, zona);
      assert.match(sello, ANCHO, `«${sello}» no tiene ancho fijo (${zona}, ${hora}:${minuto})`);
    }
  }

  /* Y la zona se aplica de verdad: 19:02 en tiempo universal son las 14:02 en Lima. Sin esta
     aserción, un sello de ancho correcto pero en la zona del servidor pasaría — y es el otro defecto
     que esta función cierra: la zona era una constante del módulo, así que la de la primera empresa
     quedaba congelada para todas. */
  assert.equal(selloDeTiempo(el3(19, 2), 'America/Lima'), '03/08 14:02');
  assert.equal(selloDeTiempo(el3(19, 2), 'UTC'), '03/08 19:02');

  // Y el día cambia cuando corresponde: 04:05 universal son las 23:05 del día ANTERIOR en Lima.
  assert.equal(selloDeTiempo(el3(4, 5), 'America/Lima'), '02/08 23:05');

  /* Medianoche es `00:00` y nunca `24:00`, que es una hora que el modelo leería como inexistente.
     Lo garantiza `hourCycle: 'h23'` explicito, no un `if`: `hour12: false` deja el ciclo a la
     configuración regional, que puede resolverlo a `h24`. La primera versión manejaba el `24` con
     una rama, y esa rama era **inalcanzable** en este entorno — una mutación que la borraba
     sobrevivía a la suite entera. Pedir el ciclo hace que el estado no pueda ocurrir. */
  assert.equal(selloDeTiempo(el3(5, 0), 'America/Lima'), '03/08 00:00');

  /* Una zona inválida no deja al modelo sin sellos: cae a tiempo universal y sigue. Sin sellos no
     puede juzgar nada temporal, y un transcript sin horas es peor que uno con horas que se pueden
     sospechar. */
  assert.match(selloDeTiempo(el3(19, 2), 'No/Existe'), ANCHO);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · EL TRANSCRIPT ETIQUETA, NO FILTRA
// ═══════════════════════════════════════════════════════════════════════════════

test('las cinco etiquetas aparecen, y NINGUNA línea se filtra', async () => {
  /* El ejemplo del propio diseño de origen, con las cinco clases de autor. Filtrar a los que no son
     el agente produce cinco defectos concretos, y los dos primeros están en esta conversación: la
     plantilla que puede haber provocado la bronca, y el asesor que convierte «dejó de responder» en
     un traspaso. */
  const conversacion = [
    de('hola, me pasan el link de pago?', 19, 2),
    ia('¡Claro! Te lo envío en un momento 😊', 19, 2),
    flujo('Hola 👋 te recordamos tu sesión de mañana.', 21, 40),
    asesor('Perdón por la demora, acá va: pay.link/x', 22, 20),
    msj({ autor_ghl_usuario_id: OTRO, cuerpo: 'consulta de disponibilidad', enviado_el: el3(22, 30) }),
  ];

  const t = armarTranscript(conversacion, 'America/Lima', AGENTE);

  assert.equal(t.lineas, 5, 'se perdió alguna línea: el transcript etiqueta, no filtra');
  assert.equal(t.recortados, 0);

  const lineas = t.texto.split('\n');
  assert.equal(lineas.length, 5, 'el transcript no tiene una línea por mensaje');
  assert.match(lineas[0] as string, /^\[03\/08 14:02\] CONTACTO: hola, me pasan el link de pago\?$/);
  assert.match(lineas[1] as string, /^\[03\/08 14:02\] AGENTE IA: /);
  assert.match(lineas[2] as string, /^\[03\/08 16:40\] AUTOMATIZACIÓN: /);
  assert.match(lineas[3] as string, /^\[03\/08 17:20\] ASESOR HUMANO: /);
  assert.match(lineas[4] as string, /^\[03\/08 17:30\] ORIGEN NO IDENTIFICADO: /);
});

test('un mensaje SIN TEXTO deja su línea, y dice que el contenido no lo tenemos', async () => {
  /* **Un audio o una imagen existieron, y su contenido no lo tenemos.** Borrar la línea sería peor: el
     turno anterior parecería sin respuesta, y el auditor reportaría un abandono que no hubo. Va entre
     corchetes, y la rúbrica dice que no se suponga qué decía. */
  const t = armarTranscript([de(null, 12, 0), ia('¿me lo escribís?', 12, 5)], 'UTC', AGENTE);
  assert.equal(t.lineas, 2, 'el mensaje sin texto se descartó: el turno anterior queda sin respuesta');
  const primera = t.texto.split('\n')[0] as string;
  assert.match(primera, /CONTACTO: \[/, 'el marcador no está entre corchetes');
  assert.ok(
    !primera.endsWith('CONTACTO: '),
    'la línea quedó vacía después de la etiqueta: el modelo no sabe si hubo mensaje o no',
  );
  // Y un cuerpo de solo espacios cuenta igual: es un mensaje sin contenido legible.
  assert.match(armarTranscript([de('   ', 12, 0)], 'UTC', AGENTE).texto, /CONTACTO: \[/);
});

test('el recorte va en la PRIMERA línea, y dice cuántos mensajes no se están viendo', async () => {
  /* Solo la cola de la conversación: lo viejo no explica el fallo de hoy, y el transcript es lo que
     domina el costo —**crece con el CUADRADO de la longitud**, porque se re-manda entero—.
   *
   * Y el aviso va **primero**: sin él, una conversación recortada se lee como una que empezó ahí, y el
   * auditor puede reportar que el agente nunca se presentó. Al final del texto llegaría después de que
   * el modelo ya leyó todo. */
  const muchos: MensajeParaAuditar[] = [];
  for (let i = 0; i < TOPE_DE_LINEAS + 12; i++) {
    muchos.push(i % 2 === 0 ? de(`pregunta ${i}`, 8, i) : ia(`respuesta ${i}`, 8, i));
  }

  const t = armarTranscript(muchos, 'UTC', AGENTE);
  assert.equal(t.recortados, 12);
  assert.equal(t.lineas, TOPE_DE_LINEAS, `entraron ${t.lineas} líneas y el tope es ${TOPE_DE_LINEAS}`);

  const lineas = t.texto.split('\n');
  assert.equal(lineas.length, TOPE_DE_LINEAS + 1, 'el aviso no está, o no es una línea aparte');
  const aviso = lineas[0] as string;
  assert.ok(!aviso.includes('CONTACTO'), 'la primera línea es un mensaje: el aviso no va primero');
  assert.match(aviso, /12/, 'el aviso no dice CUÁNTOS mensajes no se están viendo');
  assert.match(aviso, /No supongas|no supongas/, 'el aviso no le dice al modelo qué no hacer');

  // Y lo que entró es la COLA, no la cabeza: el fallo de hoy está al final.
  assert.match(t.texto, new RegExp(`respuesta ${TOPE_DE_LINEAS + 11}`));
  assert.ok(!t.texto.includes('pregunta 0'), 'entró el principio de la conversación en vez de la cola');

  // Con la conversación justo en el tope no hay aviso: no se recortó nada.
  const justo = armarTranscript(muchos.slice(-TOPE_DE_LINEAS), 'UTC', AGENTE);
  assert.equal(justo.recortados, 0);
  assert.equal(justo.texto.split('\n').length, TOPE_DE_LINEAS, 'apareció un aviso sin recorte');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LOS HECHOS MEDIDOS
// ═══════════════════════════════════════════════════════════════════════════════

test('los hechos se miden sobre la conversación COMPLETA, no sobre el transcript recortado', async () => {
  /* Los dos son distintos a propósito: el transcript se recorta por costo. Un conteo sobre 40 de 120
     mensajes diría que el agente mandó 20 cuando mandó 60 — y el **debounce resta contra ese
     número**, así que se volvería loco: cada análisis creería que el agente escribió veinte mensajes
     nuevos y volvería a gastar. */
  const muchos: MensajeParaAuditar[] = [];
  for (let i = 0; i < 100; i++) {
    muchos.push(i % 2 === 0 ? de(`p${i}`, 8, i % 60) : ia(`r${i}`, 8, i % 60));
  }
  const t = armarTranscript(muchos, 'UTC', AGENTE);
  const h = medirHechos(muchos, AGENTE, el3(9, 0));

  assert.equal(t.lineas, TOPE_DE_LINEAS, 'el transcript no se recortó');
  assert.equal(
    h.porAutor['AGENTE IA'],
    50,
    'los hechos se midieron sobre el transcript recortado: el debounce restaría contra un número ' +
      'que no es la cantidad real de mensajes del agente',
  );
  assert.equal(h.porAutor['CONTACTO'], 50);
});

test('el umbral de silencio VIAJA como dato, y no se le pide al modelo que lo sepa', async () => {
  const h = medirHechos([de('hola', 12, 0), ia('hola', 12, 1)], AGENTE, el3(13, 0));
  assert.equal(h.umbralDeSilencioMin, UMBRAL_DE_SILENCIO_MIN);
  assert.ok(h.umbralDeSilencioMin > 0, 'el umbral llegaría al modelo en cero');
});

test('«nunca escribió» es NULL y no cero minutos, que son dos hechos distintos', async () => {
  /* Es la distinción que sostiene la precondición: sin ninguna línea del agente no hay nada que
     auditar, y **cero minutos diría que acaba de escribir**. Con eso, el criterio de abandono se
     cumpliría siempre que no hay agente — le imputaría al agente su propia ausencia. */
  const sinAgente = medirHechos([de('hola', 12, 0), flujo('plantilla', 12, 1)], AGENTE, el3(13, 0));
  assert.equal(sinAgente.minutosDesdeElAgente, null, 'un agente que nunca escribió salió con minutos');
  assert.equal(sinAgente.porAutor['AGENTE IA'], 0);

  const conAgente = medirHechos([ia('hola', 12, 0)], AGENTE, el3(13, 0));
  assert.equal(conAgente.minutosDesdeElAgente, 60);
});

test('la condición (b) del abandono: CUALQUIERA que responda cuenta, incluida una plantilla', async () => {
  /* ── EL DESCARTE QUE EL CRITERIO LLEVA ESCRITO ─────────────────────────────
   *
   * *«Alguien respondió después, aunque sea una plantilla — eso es un traspaso o un seguimiento, no un
   * abandono.»* Si solo contara el agente, una conversación que un asesor tomó a mano se reportaría
   * como abandonada, y el vendedor recibiría una urgencia por algo que ya atendió. */
  const abandonada = medirHechos(
    [ia('¿te llamo?', 12, 0), de('sí, dale', 12, 5), de('estoy esperando', 13, 30)],
    AGENTE,
    el3(15, 0),
  );
  assert.equal(abandonada.respondieronAlContacto, false, 'no se detectó el abandono');
  assert.equal(abandonada.ultimoEsDe, 'CONTACTO');

  // Con una PLANTILLA después: no es abandono.
  const conPlantilla = medirHechos(
    [ia('¿te llamo?', 12, 0), de('sí, dale', 12, 5), flujo('te recordamos tu sesión', 13, 40)],
    AGENTE,
    el3(15, 0),
  );
  assert.equal(
    conPlantilla.respondieronAlContacto,
    true,
    'una plantilla posterior no contó como respuesta: eso reportaría como abandonada una ' +
      'conversación que siguió',
  );

  // Con un ASESOR después: tampoco. Es un traspaso.
  const conAsesor = medirHechos(
    [ia('¿te llamo?', 12, 0), de('sí, dale', 12, 5), asesor('te llamo yo', 13, 40)],
    AGENTE,
    el3(15, 0),
  );
  assert.equal(conAsesor.respondieronAlContacto, true, 'un traspaso a un humano se leyó como abandono');

  /* Y dos mensajes seguidos del contacto al final **no** son una respuesta: son una frase partida en
     dos. Se pregunta por el INSTANTE y no por «el último es del contacto», porque con la otra forma el
     segundo taparía al primero. */
  const fraseCortada = medirHechos(
    [ia('¿te llamo?', 12, 0), de('sí', 12, 5), de('mañana mejor', 12, 6)],
    AGENTE,
    el3(15, 0),
  );
  assert.equal(fraseCortada.respondieronAlContacto, false);

  /* Sin ningún mensaje del contacto la pregunta no tiene sujeto: `null` y no `false`. Responder
     `false` afirmaría que nadie le contestó a alguien que no habló. */
  const sinContacto = medirHechos([ia('hola', 12, 0), ia('¿estás?', 12, 30)], AGENTE, el3(13, 0));
  assert.equal(sinContacto.respondieronAlContacto, null);
});

test('la condición (b) NO depende del orden de la lista, y por eso escanea', async () => {
  /* ══ POR QUÉ ESTA PRUEBA EXISTE ════════════════════════════════
   *
   * La condición (b) se podría escribir mirando si el último mensaje es del contacto, y bajo el
   * contrato de entrada —cronológica, con instantes distintos: medido, **cero instantes repetidos en
   * producción**— daría exactamente lo mismo. Una mutación a esa forma **sobrevivía** a todo lo demás
   * de este archivo.
   *
   * Se escribe escaneando por instante igual, y esta prueba es la que lo fija: el contrato es una
   * promesa de quien llama, y el precio de romperla es un abandono inventado sobre una conversación
   * que alguien tomó — o al revés, una urgencia que nadie ve.
   *
   * La lista va **desordenada a propósito**. */
  const desordenada = [
    de('estoy esperando', 13, 30),
    ia('¿te llamo?', 12, 0),
    asesor('te llamo yo en cinco minutos', 14, 0),
    de('sí, dale', 12, 5),
  ];
  const h = medirHechos(desordenada, AGENTE, el3(15, 0));
  assert.equal(
    h.respondieronAlContacto,
    true,
    'con la lista desordenada no se vio la respuesta del asesor: el último elemento del arreglo no ' +
      'es el último mensaje, y mirar el último elemento reportaría un abandono que no hubo',
  );

  /* Y al revés: desordenada, sin nadie después del último del contacto, sí es abandono. Sin esta
     mitad la prueba pasaría con una función que devuelve `true` siempre. */
  const sinRespuesta = [de('estoy esperando', 13, 30), ia('¿te llamo?', 12, 0), de('sí, dale', 12, 5)];
  assert.equal(medirHechos(sinRespuesta, AGENTE, el3(15, 0)).respondieronAlContacto, false);

  // Y el último mensaje también sale del instante, no de la posición.
  assert.equal(medirHechos(desordenada, AGENTE, el3(15, 0)).ultimoEsDe, 'ASESOR HUMANO');
  assert.equal(medirHechos(desordenada, AGENTE, el3(15, 0)).minutosDesdeElUltimo, 60);

  /* Y el último DEL CONTACTO también. Este caso es el que lo separa: su último mensaje es el PRIMER
     elemento del arreglo, y hay una línea del agente entre el último del contacto por posición y el
     verdadero. Tomándolo por posición, el agente parece haber respondido — y una conversación
     abandonada dejaría de entrar a la cola de urgencias. */
  const elUltimoPrimero = [de('sigo esperando', 13, 30), de('hola', 12, 0), ia('¿te llamo?', 12, 30)];
  assert.equal(
    medirHechos(elUltimoPrimero, AGENTE, el3(15, 0)).respondieronAlContacto,
    false,
    'el último mensaje del contacto se tomó por posición: un abandono real se leyó como respondido, ' +
      'y ese contacto no entra a la cola de urgencias',
  );
})

test('el conteo por autor tiene las CINCO claves siempre, incluso en cero', async () => {
  /* Un objeto al que le falta la clave hace que el modelo lea «no hay dato» donde hay un cero medido —
     y la diferencia entre las dos cosas es la regla que atraviesa este producto. */
  const h = medirHechos([ia('hola', 12, 0)], AGENTE, el3(12, 1));
  assert.deepEqual(Object.keys(h.porAutor).sort(), [
    'AGENTE IA',
    'ASESOR HUMANO',
    'AUTOMATIZACIÓN',
    'CONTACTO',
    'ORIGEN NO IDENTIFICADO',
  ]);
  assert.equal(h.porAutor['CONTACTO'], 0);
});

test('sin ningún mensaje, todo es nulo y nada es cero-con-forma-de-medición', async () => {
  const h = medirHechos([], AGENTE, el3(12, 0));
  assert.equal(h.ultimoEsDe, null);
  assert.equal(h.minutosDesdeElUltimo, null);
  assert.equal(h.minutosDesdeElAgente, null);
  assert.equal(h.respondieronAlContacto, null);
  assert.equal(h.sinTexto, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LA PRECONDICIÓN
// ═══════════════════════════════════════════════════════════════════════════════

test('sin ninguna línea del agente NO se audita, y ése es el falso positivo original', async () => {
  /* **Sin agente no hay nada que auditar, y bajo ninguna circunstancia eso es una falla del agente:
     es la ausencia de un agente.**
   *
   * Es el portón que cierra el falso positivo original: sin él, el criterio «la IA dejó de responder»
   * se cumple **siempre** que no hay agente.
   *
   * Y se comprueba sobre los HECHOS y no sobre las etiquetas del contacto, porque **una etiqueta puede
   * mentir**: quedó puesta, el automatismo no corrió, alguien la editó a mano. */
  const soloFlujos = medirHechos(
    [de('hola', 12, 0), flujo('plantilla 1', 12, 1), de('¿hay alguien?', 12, 30), flujo('plantilla 2', 13, 0)],
    AGENTE,
    el3(14, 0),
  );
  assert.equal(porQueNoSeAudita(soloFlujos), 'sin_lineas_del_agente');

  // Y con el agente sin configurar, TODO cae acá: no hay ninguna línea imputable.
  const sinConfigurar = medirHechos([de('hola', 12, 0), ia('hola!', 12, 1), de('ok', 12, 2), ia('dale', 12, 3)], null, el3(13, 0));
  assert.equal(
    porQueNoSeAudita(sinConfigurar),
    'sin_lineas_del_agente',
    'sin el agente configurado se auditó igual: no había ninguna línea imputable',
  );
});

test('menos de DOS intercambios reales no se audita, y son dos DE CADA LADO', async () => {
  /* No es «cuatro mensajes»: cuatro del agente y uno del contacto tampoco son dos intercambios. Y el
     caso que más importa es el del agujero del debounce —la conversación corta donde el contacto se
     va— porque ahí lo que corta tiene que ser esto y no una cuenta total. */
  assert.equal(
    porQueNoSeAudita(medirHechos([de('hola', 12, 0), ia('hola!', 12, 1)], AGENTE, el3(13, 0))),
    'menos_de_dos_intercambios',
  );
  assert.equal(
    porQueNoSeAudita(
      medirHechos([ia('a', 12, 0), ia('b', 12, 1), ia('c', 12, 2), de('hola', 12, 3)], AGENTE, el3(13, 0)),
    ),
    'menos_de_dos_intercambios',
    'cuatro mensajes con uno solo del contacto se dieron por dos intercambios',
  );
  // Con dos de cada lado, sí se audita.
  assert.equal(
    porQueNoSeAudita(
      medirHechos([de('a', 12, 0), ia('b', 12, 1), de('c', 12, 2), ia('d', 12, 3)], AGENTE, el3(13, 0)),
    ),
    null,
  );
});

test('con MÁS DE LA MITAD sin texto no se audita, y la mitad exacta sí', async () => {
  /* Lo que se dijo no lo tenemos, así que no se puede juzgar cómo se atendió. Y el `>` estricto está
     medido en el borde: la mitad exacta todavía deja la mitad legible. */
  const mayoria = medirHechos(
    [de(null, 12, 0), ia('a', 12, 1), de(null, 12, 2), ia(null, 12, 3), de('b', 12, 4), ia(null, 12, 5)],
    AGENTE,
    el3(13, 0),
  );
  assert.equal(porQueNoSeAudita(mayoria), 'mayoria_sin_texto');

  const laMitad = medirHechos(
    [de(null, 12, 0), ia('a', 12, 1), de('b', 12, 2), ia(null, 12, 3)],
    AGENTE,
    el3(13, 0),
  );
  assert.equal(porQueNoSeAudita(laMitad), null, 'la mitad exacta sin texto cortó, y todavía es legible');
});

test('cada motivo de no-auditable tiene su texto, y ninguno culpa al agente', async () => {
  /* El motivo viaja con la decisión y se guarda en la fila. Un análisis que dice «no auditable» sin
     decir por qué se lee desde la pantalla igual que «el auditor falló» — dos cosas distintas.
   *
   * Y ninguno puede sonar a falla del agente, que es la regla explícita del primero: *«bajo ninguna
   * circunstancia eso es una falla del agente»*. Un texto que diga «el agente no respondió» sobre una
   * conversación donde el agente no existía es exactamente el falso positivo escrito en prosa. */
  const claves = Object.keys(MOTIVOS_DE_NO_AUDITABLE);
  assert.equal(claves.length, 3, 'cambiaron los motivos: hay que escribirle su texto al nuevo');
  for (const [clave, texto] of Object.entries(MOTIVOS_DE_NO_AUDITABLE)) {
    assert.ok(texto.length > 30, `el motivo «${clave}» no explica nada: «${texto}»`);
    assert.ok(
      !/el agente (no respondi|abandon|fall)/i.test(texto),
      `el motivo «${clave}» culpa al agente de que no se pueda auditar: «${texto}»`,
    );
  }
  // Y el primero dice explícitamente que la ausencia del agente no es su falla.
  assert.match(MOTIVOS_DE_NO_AUDITABLE['sin_lineas_del_agente'], /no es una falla del agente/i);
});
