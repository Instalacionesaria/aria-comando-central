// El contrato con GoHighLevel y el cliente que lo usa. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA QUE ESTE ARCHIVO EXISTE PARA HACER CUMPLIR
//
// El documento de contrato de la subcuenta la pone en negrita, y es la que ordena todo lo
// demás: **un tag mal escrito no da error. No hace nada.**
//
// *"Es el defecto más caro de esta lista porque es invisible."* Un `zona_Closer` con mayúscula,
// un `bot_activado ` con un espacio al final, un `descalificación` con acento: la petición
// devuelve 200, el CRM no dispara nada, y el contacto aparece en la cola equivocada. Ninguna
// prueba de integración lo agarra, porque nada falla.
//
// Así que se comprueba la FORMA de cada literal, acá, sin red.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { nombreDe } from '../../lib/ghl/cliente.ts';
import {
  ETAPAS_DEL_SETTER,
  ETIQUETAS_DEL_AGENTE,
  RESULTADOS,
  SERIES_DE_SEGUIMIENTO,
  TERRITORIOS,
  estadoDelAgente,
  sePuedeMandar,
} from '../../lib/ghl/contrato.ts';

/** Todas las etiquetas del contrato, de todas las familias. */
function todasLasEtiquetas(): { etiqueta: string; familia: string }[] {
  return [
    ...TERRITORIOS.map((t) => ({ etiqueta: t.etiqueta, familia: 'territorio' })),
    ...ETIQUETAS_DEL_AGENTE.map((t) => ({ etiqueta: t.etiqueta, familia: 'agente' })),
    ...SERIES_DE_SEGUIMIENTO.map((t) => ({ etiqueta: t.etiqueta, familia: 'seguimiento' })),
    ...RESULTADOS.map((t) => ({ etiqueta: t.etiqueta, familia: 'resultado' })),
    ...ETAPAS_DEL_SETTER.map((t) => ({ etiqueta: t.etiqueta, familia: 'etapa' })),
  ];
}

// ─── La forma de los literales ──────────────────────────────────────────────

test('cada etiqueta es minúsculas, números y guion bajo, y nada más', () => {
  // Sin acentos, sin espacios, sin mayúsculas. Cualquiera de las tres cosas produce una
  // etiqueta que el CRM acepta y no reconoce.
  const malas: string[] = [];
  for (const { etiqueta, familia } of todasLasEtiquetas()) {
    if (!/^[a-z0-9_]+$/.test(etiqueta)) malas.push(`${familia}: ${JSON.stringify(etiqueta)}`);
  }
  assert.deepEqual(
    malas,
    [],
    'estas etiquetas tienen una forma que el CRM no va a reconocer, y NO va a fallar:\n  ' +
      malas.join('\n  '),
  );
});

test('la comprobación de forma no es vacua', () => {
  // Si el patrón estuviera mal escrito, la prueba de arriba pasaría con cualquier cosa. Acá se
  // comprueba que RECHAZA las tres formas que de verdad aparecen al tipear a mano.
  for (const mala of ['zona_Closer', 'bot activado', 'descalificación', 'zona-closer', 'zona_closer ']) {
    assert.ok(!/^[a-z0-9_]+$/.test(mala), `el patrón dejó pasar ${JSON.stringify(mala)}`);
  }
  // Y que ACEPTA las buenas.
  for (const buena of ['zona_closer', 'bot_desactivado_postcall', 'noshow']) {
    assert.ok(/^[a-z0-9_]+$/.test(buena), `el patrón rechazó ${JSON.stringify(buena)}`);
  }
});

test('ninguna etiqueta del agente se repite', () => {
  // Dos filas con la misma etiqueta y estados distintos hacen que el resultado dependa del
  // orden — y el orden de ese arreglo ES la precedencia, así que una repetición la rompe en
  // silencio.
  const claves = ETIQUETAS_DEL_AGENTE.map((t) => t.etiqueta);
  assert.equal(new Set(claves).size, claves.length, `hay etiquetas repetidas en: ${claves.join(', ')}`);
});

test('`bot_reactivar` NO está en la tabla de estados', () => {
  // El contrato: *"Orden de volver a encender el bot. **No decide estado**: es una orden"*.
  //
  // Es una prueba de una línea y vale la pena: la etiqueta se llama como las otras nueve y
  // agregarla se ve razonable. El efecto sería que un contacto con una orden PENDIENTE se
  // leyera como un bot que ya atiende, y quien mire la fila decidiría no tocarlo.
  assert.ok(
    !ETIQUETAS_DEL_AGENTE.some((t) => t.etiqueta === 'bot_reactivar'),
    '`bot_reactivar` entró a la tabla de estados: es una orden, no un hecho',
  );
});

// ─── Lo que se puede mandar ─────────────────────────────────────────────────

test('una etiqueta PENDIENTE no se manda, y una desconocida tampoco', () => {
  // Las tres etapas del setter no existen todavía en la subcuenta. Mandarlas devolvería éxito
  // y no haría nada — el defecto invisible del encabezado.
  for (const { etiqueta } of ETAPAS_DEL_SETTER) {
    assert.equal(sePuedeMandar(etiqueta), false, `${etiqueta} está pendiente y se mandaría`);
  }
  // `seguimiento_terminado` existe y nadie confirmó qué significa. Escribirlo podría disparar
  // un flujo que nadie revisó.
  assert.equal(sePuedeMandar('seguimiento_terminado'), false);
  // Y lo que no está en el contrato NO existe. Es el lado correcto del que fallar.
  assert.equal(sePuedeMandar('inventada_por_alguien'), false);
  // Las confirmadas sí.
  assert.equal(sePuedeMandar('zona_closer'), true);
  assert.equal(sePuedeMandar('noshow'), true);
});

test('el No-show es la ÚNICA salida que deja el bot vivo', () => {
  // Literal del contrato, y no es un detalle: el No-show dispara un flujo de recuperación que
  // NECESITA al agente trabajando. Apagarlo ahí deja al contacto sin nadie —ni bot ni persona—
  // y no falla nada.
  const vivas = RESULTADOS.filter((r) => !r.apagaElBot).map((r) => r.salida);
  assert.deepEqual(vivas, ['no_show'], 'cambió qué salidas dejan el bot vivo');
});

// ─── El estado del agente ───────────────────────────────────────────────────

test('sin ninguna etiqueta del agente, el estado es `sin_agente`', () => {
  // `sin_agente` NO es "no sé": es "se miraron las etiquetas y ninguna es del agente". Un cero
  // medido. La fila lo dibuja atenuado, igual que el resto de los ceros medidos.
  assert.equal(estadoDelAgente([]), 'sin_agente');
  assert.equal(estadoDelAgente(['zona_closer', 'cita_agendada']), 'sin_agente');
});

test('la precedencia no depende del orden en que vengan las etiquetas', () => {
  // El caso real: «marcelo», en la subcuenta, tiene las dos. Si el código recorriera las
  // etiquetas DEL CONTACTO en vez de su propia lista, el resultado cambiaría según cómo las
  // devuelva GoHighLevel — o sea, según nada.
  const a = estadoDelAgente(['bot_activado_appflow', 'bot_desactivado_postcall']);
  const b = estadoDelAgente(['bot_desactivado_postcall', 'bot_activado_appflow']);
  assert.equal(a, b, 'el estado cambió al invertir el orden de las etiquetas');
  assert.equal(a, 'ya_paso_la_llamada', 'ganó el encendido: tendría que ganar el apagado');
});

test('el legado `bot_activado` pierde contra los dos que dicen CUÁL agente', () => {
  // El contrato: `bot_activado` dice que el chatbot atiende **sin decir cuál**. Los otros dos
  // sí lo dicen, y esa distinción existe porque el auditor tiene que saber a qué agente
  // imputarle un fallo. Si el genérico ganara, esa información se perdería.
  assert.equal(estadoDelAgente(['bot_activado', 'bot_activado_leadflow']), 'atendiendo_pre_agenda');
  assert.equal(estadoDelAgente(['bot_activado', 'bot_activado_appflow']), 'atendiendo_post_agenda');
  assert.equal(estadoDelAgente(['bot_activado']), 'atendiendo');
});

// ─── El nombre ──────────────────────────────────────────────────────────────

test('el nombre con caja se prefiere sobre el que viene en minúscula', () => {
  // `/contacts/search` devuelve solo las variantes `*LowerCase` — la documentación lo dice:
  // *"first name without lowercase is not yet available"*. Pero `GET /contacts/{id}` sí trae
  // las buenas, y el día que se use, tienen que ganar.
  assert.equal(
    nombreDe({ id: 'x', contactName: 'María José Pérez', firstNameLowerCase: 'maría josé' }),
    'María José Pérez',
  );
  assert.equal(nombreDe({ id: 'x', firstName: 'Ana', lastName: 'Solís' }), 'Ana Solís');
});

test('el nombre en minúscula recupera la mayúscula inicial', () => {
  // Medido: los 238 contactos de la subcuenta llegan así. Una lista de trabajo entera en
  // minúscula se lee como datos de prueba.
  //
  // No es inventar un dato: la fuente perdió la CAJA, no el nombre.
  assert.equal(
    nombreDe({ id: 'x', firstNameLowerCase: 'ornella', lastNameLowerCase: 'centurion' }),
    'Ornella Centurion',
  );
  // Con guion y con apóstrofo, que son los dos separadores que aparecen en nombres reales.
  assert.equal(nombreDe({ id: 'x', firstNameLowerCase: "o'brien" }), "O'Brien");
  assert.equal(nombreDe({ id: 'x', firstNameLowerCase: 'ana-lucía' }), 'Ana-Lucía');
});

test('un contacto sin ningún nombre devuelve NULO, no una cadena de relleno', () => {
  // La columna `nombre` es obligatoria. Si esto devolviera `'Sin nombre'`, ese texto entraría a
  // la base y después se leería como si fuera su nombre. El sincronizador lo saltea CON MOTIVO
  // y lo informa, que es lo que permite enterarse.
  assert.equal(nombreDe({ id: 'x' }), null);
  assert.equal(nombreDe({ id: 'x', contactName: '   ' }), null);
});
