// El lector de citas del CRM y la aritmética del tiempo. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO VIGILA, Y TODO ESTÁ MEDIDO CONTRA LA SUBCUENTA REAL
//
// Ninguna de estas cosas da error cuando falla. Todas dibujan una agenda plausible con la hora
// equivocada, y por eso se comprueban acá.
//
//   1 · **El campo del estado viene MAL ESCRITO.** El CRM manda `appointmentStatus` y
//       `appoinmentStatus` —sin la segunda `t`— con el mismo valor. Leer solo uno de los dos
//       funciona hasta el día que no.
//   2 · **`address` viene `""` en 23 de 1052 citas.** Una cadena vacía tomada como sala dibuja un
//       botón de videollamada que no lleva a ninguna parte.
//   3 · **El CRM devuelve las citas borradas**, con `deleted: true`. Sin leer esa bandera aparecen
//       en la agenda de alguien.
//   4 · **La hora viene ISO con desfase** (`-05:00`) en este endpoint y **sin zona** en el otro. De
//       ahí sale que el módulo use este, y que una fecha ilegible sea `null` y no 1970: el instante
//       cero se ordena antes que todo y aparecería como «la cita más vieja».
//   5 · **El día de una cita de las 22:00 en Lima es el día siguiente en UTC.** Es el defecto que
//       este proyecto ya pagó una vez —*"dos vitrinas mostraban horas distintas para la misma
//       cita"*— y el que `lib/negocio/tiempo.ts` existe para cerrar.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTADOS_CANCELADOS,
  ESTADOS_MEDIDOS,
  estaCancelada,
  leerCita,
} from '../../lib/ghl/calendarios.ts';
import {
  diaEnZona,
  etiquetaCorta,
  etiquetaDeDia,
  horaEnZona,
  sumarDias,
} from '../../lib/negocio/tiempo.ts';

// ─── 1 · El lector de una cita ──────────────────────────────────────────────

/** Una cita como el CRM la manda de verdad. Las claves son las medidas, con el typo incluido. */
function comoLaManda(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'ev1',
    calendarId: 'cal1',
    contactId: 'con1',
    title: 'Llamada de cierre',
    startTime: '2026-08-25T08:00:00-05:00',
    endTime: '2026-08-25T08:30:00-05:00',
    appointmentStatus: 'confirmed',
    appoinmentStatus: 'confirmed',
    address: 'https://meet.example/abc',
    assignedUserId: 'u1',
    ...extra,
  };
}

test('la hora se lee del ISO CON DESFASE, y es el instante que el CRM quiso decir', () => {
  // `2026-08-25T08:00:00-05:00` son las 13:00 UTC. Si alguien "limpiara" el desfase antes de
  // convertir —o usara el otro endpoint, que manda `"2026-08-25 08:00:00"` sin zona—, la cita se
  // correría cinco horas y nada lo diría.
  const c = leerCita(comoLaManda());
  assert.equal(c.inicioEl?.toISOString(), '2026-08-25T13:00:00.000Z');
  assert.equal(c.finEl?.toISOString(), '2026-08-25T13:30:00.000Z');
});

test('el estado se lee del campo BIEN escrito cuando están los dos', () => {
  const c = leerCita(comoLaManda({ appointmentStatus: 'showed', appoinmentStatus: 'confirmed' }));
  assert.equal(c.estado, 'showed', 'ganó el campo con el typo, que es el que va a desaparecer');
});

test('el estado se lee del campo MAL escrito cuando es el único que viene', () => {
  // Es el caso que obliga a leer los dos: hoy el CRM manda ambos, y una respuesta que traiga solo
  // `appoinmentStatus` dejaría todas las citas «sin estado» — o sea ninguna cancelada, o sea 411
  // citas fantasma en la agenda de alguien.
  const sinElBueno = comoLaManda();
  delete sinElBueno.appointmentStatus;
  assert.equal(leerCita(sinElBueno).estado, 'confirmed');
});

test('una sala VACÍA es ausencia de sala, no una sala vacía', () => {
  // Medido: `address` viene `""` en 23 de 1052. Con la cadena vacía como valor, la pantalla dibuja
  // el botón «Sala» habilitado y quien lo aprieta abre la nada.
  assert.equal(leerCita(comoLaManda({ address: '' })).sala, null);
  assert.equal(leerCita(comoLaManda({ address: '   ' })).sala, null);
  assert.equal(leerCita(comoLaManda()).sala, 'https://meet.example/abc');
});

test('la bandera de borrada se lee, y solo el `true` exacto cuenta', () => {
  assert.equal(leerCita(comoLaManda()).borrada, false);
  assert.equal(leerCita(comoLaManda({ deleted: true })).borrada, true);
  // `deleted: "false"` es una cadena, y una cadena no vacía es verdadera en JavaScript. Si esto se
  // leyera con `Boolean(o.deleted)`, una cita viva se descartaría por venir con el texto «false».
  assert.equal(leerCita(comoLaManda({ deleted: 'false' })).borrada, false);
});

test('una fecha ilegible es NULA, nunca 1970', () => {
  // El instante cero se ordena antes que todo: la cita aparecería primera en la agenda, como la más
  // vieja, en vez de no aparecer. Ausente es más honesto que primera.
  assert.equal(leerCita(comoLaManda({ startTime: 'la semana que viene' })).inicioEl, null);
  assert.equal(leerCita(comoLaManda({ startTime: '' })).inicioEl, null);
  assert.equal(leerCita(comoLaManda({ startTime: null })).inicioEl, null);
});

test('una cita vacía no explota: todo nulo y el identificador en blanco', () => {
  // El lector se aplica a lo que venga. Si lanzara con una respuesta rara, un solo evento
  // malformado tumbaría el barrido de los nueve calendarios.
  const c = leerCita({});
  assert.equal(c.id, '');
  assert.equal(c.contactId, null);
  assert.equal(c.inicioEl, null);
  assert.equal(c.estado, null);
  assert.equal(c.borrada, false);
  assert.equal(leerCita(null).id, '');
  assert.equal(leerCita('cualquier cosa').id, '');
});

// ─── 2 · Cancelada ─────────────────────────────────────────────────────────

test('cancelada se reconoce sin distinguir caja ni espacios, y `null` NO es cancelada', () => {
  for (const e of ESTADOS_CANCELADOS) {
    assert.equal(estaCancelada(e), true, e);
    assert.equal(estaCancelada(e.toUpperCase()), true, e.toUpperCase());
    assert.equal(estaCancelada(` ${e} `), true, `«${e}» con espacios`);
  }
  // Nulo es «el CRM no lo dijo». Tratarlo como cancelada esconderría citas buenas.
  assert.equal(estaCancelada(null), false);
  assert.equal(estaCancelada('confirmed'), false);
  assert.equal(estaCancelada('showed'), false);
});

test('el censo de estados medidos incluye `cancelled`, y `cancelled` está en la lista de canceladas', () => {
  // Une las dos listas: si alguien agregara un estado al censo sin decidir si cancela, esta prueba
  // no lo atrapa — pero si alguien BORRARA `cancelled` de las canceladas, sí. Y son el 39 %.
  assert.ok(ESTADOS_MEDIDOS.includes('cancelled'));
  assert.ok((ESTADOS_CANCELADOS as readonly string[]).includes('cancelled'));
});

// ─── 3 · El día, la hora y las etiquetas ───────────────────────────────────

test('LA PRUEBA DE LA ZONA: las 22:00 en Lima son del día de Lima, no del de UTC', () => {
  // Es el defecto pagado, textual: *"dos vitrinas mostraban horas distintas para la misma cita"*.
  // `2026-08-25T22:00:00-05:00` es el 26 a las 03:00 UTC. Sin la zona, esta cita encabezaría el día
  // siguiente y quien la mire va a llamar un día tarde.
  const laDeLasDiez = new Date('2026-08-25T22:00:00-05:00');
  assert.equal(diaEnZona(laDeLasDiez, 'America/Lima'), '2026-08-25');
  assert.equal(diaEnZona(laDeLasDiez, 'UTC'), '2026-08-26', 'en UTC sí es el día siguiente');
  assert.equal(horaEnZona(laDeLasDiez, 'America/Lima'), '22:00');
  assert.equal(horaEnZona(laDeLasDiez, 'UTC'), '03:00');
});

test('la hora va en 24 horas', () => {
  // Una agenda que dice `2:00` sin decir si es de la tarde es una llamada perdida.
  assert.equal(horaEnZona(new Date('2026-08-25T19:30:00-05:00'), 'America/Lima'), '19:30');
  assert.equal(horaEnZona(new Date('2026-08-25T00:05:00-05:00'), 'America/Lima'), '00:05');
});

test('una zona inválida no deja la fila muda', () => {
  // Se cae a la del entorno y se sigue: una hora que puede estar corrida se puede sospechar; un
  // guion donde debería haber una hora no.
  const h = horaEnZona(new Date('2026-08-25T13:00:00Z'), 'Perú');
  assert.match(h, /^\d{2}:\d{2}$/);
  const d = diaEnZona(new Date('2026-08-25T13:00:00Z'), 'GMT-5');
  assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
});

test('un instante ausente o ilegible da guion en la hora y vacío en el día', () => {
  assert.equal(horaEnZona(null, 'America/Lima'), '—');
  assert.equal(horaEnZona(undefined, 'America/Lima'), '—');
  assert.equal(horaEnZona('no es una fecha', 'America/Lima'), '—');
  assert.equal(diaEnZona(null, 'America/Lima'), '');
  assert.equal(diaEnZona('no es una fecha', 'America/Lima'), '');
});

test('HOY, AYER y MAÑANA con palabras; el resto con el nombre del día', () => {
  assert.equal(etiquetaDeDia('2026-08-26', '2026-08-26'), 'HOY');
  assert.equal(etiquetaDeDia('2026-08-25', '2026-08-26'), 'AYER');
  assert.equal(etiquetaDeDia('2026-08-27', '2026-08-26'), 'MAÑANA');
  const otro = etiquetaDeDia('2026-09-03', '2026-08-26');
  assert.match(otro, /JUEVES/, 'falta el nombre del día, que es lo que alguien busca en una agenda');
  assert.match(otro, /3/);
});

test('EL AÑO VA en la etiqueta, porque esta función también encabeza el chat', () => {
  // Una prueba anterior ya obligó a esto y queda fija: la misma función pone los separadores del
  // chat, donde una conversación cruza años. «12 DE AGOSTO» sobre un mensaje de 2025 no es breve,
  // es falso.
  assert.match(etiquetaDeDia('2025-08-12', '2026-08-26'), /2025/);
  assert.match(etiquetaDeDia('2026-12-31', '2026-08-26'), /2026/);
});

test('un día ilegible se muestra crudo, no se inventa uno', () => {
  assert.equal(etiquetaDeDia('vaya-a-saber', '2026-08-26'), 'vaya-a-saber');
});

test('sumar días cruza meses, años y el cambio de horario sin corrimientos', () => {
  assert.equal(sumarDias('2026-08-26', 1), '2026-08-27');
  assert.equal(sumarDias('2026-08-31', 1), '2026-09-01');
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDias('2027-01-01', -1), '2026-12-31');
  assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(sumarDias('2028-03-01', -1), '2028-02-29', 'año bisiesto');
  // El domingo del cambio de horario en el hemisferio norte. Se calcula a las 12:00 UTC justamente
  // para que un salto de una hora no pueda cambiar el día.
  assert.equal(sumarDias('2026-03-08', 1), '2026-03-09');
  assert.equal(sumarDias('2026-11-01', 1), '2026-11-02');
  assert.equal(sumarDias('no es un día', 1), '');
});

test('sumar cero es el mismo día', () => {
  // Parece trivial y no lo es: la tira de «Próximos días» arranca en `sumarDias(hoy, 0)`, así que un
  // corrimiento acá haría que la primera tarjeta diga HOY y cuente las citas de ayer.
  assert.equal(sumarDias('2026-08-26', 0), '2026-08-26');
  assert.equal(etiquetaDeDia(sumarDias('2026-08-26', 0), '2026-08-26'), 'HOY');
});

// ─── 4 · La zona de QUIEN CORRE el proceso no puede cambiar ningún resultado ─

test('LA MUTACIÓN QUE SOBREVIVIÓ: el cálculo no depende de la zona del proceso', () => {
  // Esta prueba existe porque una mutación pasó. `sumarDias` calcula a las 12:00 **UTC** justamente
  // para que ningún desfase pueda cambiar el día; cambiándolo a medianoche local, todas las pruebas
  // seguían verdes — **porque el proceso corre en `America/Lima`**, donde la medianoche local es las
  // 05:00 UTC y el día no se mueve.
  //
  // En Madrid (UTC+2) la medianoche local es las 22:00 UTC **del día anterior**, así que la versión
  // mutada devuelve un día menos. O sea: el defecto existía, era invisible acá, y aparecería en la
  // primera empresa europea. Se prueba corriendo la misma cuenta bajo tres zonas extremas.
  const original = process.env.TZ;
  try {
    const respuestas: string[][] = [];
    for (const zona of ['Pacific/Kiritimati', 'Etc/GMT+11', 'Europe/Madrid', 'America/Lima']) {
      process.env.TZ = zona;
      respuestas.push([
        sumarDias('2026-08-26', 1),
        sumarDias('2026-08-26', 0),
        sumarDias('2026-08-26', -1),
        sumarDias('2026-12-31', 1),
        diaEnZona(new Date('2026-08-25T22:00:00-05:00'), 'America/Lima'),
        etiquetaDeDia('2026-08-27', '2026-08-26'),
      ]);
    }
    const primera = respuestas[0];
    assert.ok(primera);
    for (const otra of respuestas.slice(1)) {
      assert.deepEqual(
        otra,
        primera,
        'el resultado cambió con la zona del proceso: el defecto es invisible donde se corre',
      );
    }
    // Y los valores, además de iguales, correctos. Sin esto, una función que devuelve siempre `''`
    // pasaría la comparación de arriba con las cuatro zonas.
    assert.deepEqual(primera.slice(0, 4), ['2026-08-27', '2026-08-26', '2026-08-25', '2027-01-01']);
    assert.equal(primera[4], '2026-08-25');
    assert.equal(primera[5], 'MAÑANA');
  } finally {
    // Se restaura SIEMPRE: dejar la zona cambiada haría fallar a cualquier prueba que corra después
    // en este mismo proceso, y el motivo no se vería en ninguna parte.
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test('la etiqueta CORTA suelta el año, y la larga lo sigue llevando', () => {
  // Las dos existen a propósito y la diferencia está acotada: la corta es para una tira de cuatro
  // días alrededor de hoy —donde el año no puede ser ambiguo— y la larga para los separadores del
  // chat, que cruzan años. Si alguien las unificara por prolijidad, una de las dos vitrinas
  // empeoraría; esta prueba fija cuál es cuál.
  assert.equal(etiquetaCorta('2026-08-26', '2026-08-26'), 'HOY');
  assert.equal(etiquetaCorta('2026-08-27', '2026-08-26'), 'MAÑANA');
  assert.equal(etiquetaCorta('2026-08-25', '2026-08-26'), 'AYER');

  const corta = etiquetaCorta('2026-08-28', '2026-08-26');
  assert.doesNotMatch(corta, /2026/, 'en una tira de cuatro días el año es ruido');
  assert.match(corta, /28/);
  assert.match(corta, /VIE/, 'el día de la semana es lo que se busca en una agenda');
  assert.ok(corta.length <= 10, `«${corta}» no entra en un botón de la tira`);

  // Y la larga NO cambió: es la que encabeza el chat.
  assert.match(etiquetaDeDia('2026-08-28', '2026-08-26'), /2026/);
  assert.equal(etiquetaCorta('vaya-a-saber', '2026-08-26'), 'vaya-a-saber');
});
