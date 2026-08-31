// LOS PORTONES y el nivel 0. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTAS PRUEBAS DEFIENDEN, Y POR QUÉ NINGÚN DEFECTO DE ACÁ FALLA
//
// «Un portón de menos no falla: solo factura.» Apagar cualquiera de estos guardias deja un módulo que
// funciona perfecto y gasta de más, y el síntoma llega un mes después en una factura sin nada que la
// explique. O sea que **la única defensa posible es una prueba que muera cuando el portón se apaga**,
// y por eso cada portón tiene la suya y la mutación de apagarlo se mide.
//
// Los cuatro defectos que se pueden escribir sin que nada se rompa:
//
//   · **Un portón desactivado.** Audita más, todo sigue correcto, y cuesta.
//   · **El orden invertido.** El motivo que se reporta es el caro en vez del barato, así que la
//     corrida en seco manda a investigar lo que no es.
//   · **El piso del nivel 0 apagado.** La señal sigue puesta —el contacto no borra su mensaje
//     enojado— así que la misma conversación se audita en CADA corrida del barrido. Es el único
//     defecto de este archivo que no gasta un poco más: gasta sin techo.
//   · **El agente saliendo de la etiqueta y no del territorio.** Le imputa el fallo al agente
//     equivocado, con un veredicto que se ve igual que uno bueno.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALARMAS,
  PISO_DEL_DEBOUNCE,
  TEXTO_DEL_MOTIVO_DE_LA_EMPRESA,
  TEXTO_DE_LA_ALARMA,
  TEXTO_DEL_PORTON,
  UMBRAL_DEL_DEBOUNCE,
  alarmasPuestas,
  decidirSiAuditar,
  porQueNoSeAuditaLaEmpresa,
  type CandidatoAAuditar,
} from '../../lib/auditor/portones.ts';
import { UMBRAL_DE_SILENCIO_MIN } from '../../lib/auditor/transcripcion.ts';

/** Un instante fijo. Nada de este archivo mira el reloj real. */
const AHORA = new Date('2026-08-31T15:00:00.000Z');
/** Hace `min` minutos, respecto de `AHORA`. */
const hace = (min: number): Date => new Date(AHORA.getTime() - min * 60_000);

/** Un candidato que PASA los cuatro portones, para mutarlo en cada prueba. */
function candidato(cambios: Partial<CandidatoAAuditar> = {}): CandidatoAAuditar {
  return {
    contactoId: '11111111-1111-4111-8111-111111111111',
    ghlContactId: 'ghl-del-contacto',
    territorio: 'closer',
    etiquetas: ['bot_activado_appflow'],
    tieneAvisoAbierto: false,
    mensajesDelAgente: 12,
    mensajesDelAgenteEnElUltimoAnalisis: 5,
    ultimoEntranteEl: hace(3),
    ultimoSalienteEl: hace(1),
    ultimoEntranteTexto: 'Perfecto, muchas gracias.',
    ...cambios,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL PORTÓN 0: LA EMPRESA
// ═══════════════════════════════════════════════════════════════════════════════

test('la empresa completa: los tres motivos, y ninguno se colapsa', () => {
  /* No se colapsan porque significan cosas distintas, igual que las cinco faltas de credencial del
     barrido: `sin_clave_ia` en TODAS las empresas a la vez significa que cambió la clave maestra del
     servidor, no que todos los clientes desconectaron su IA el mismo día. */
  assert.equal(
    porQueNoSeAuditaLaEmpresa({ auditorActivo: false, tieneClaveIa: true, idDelAgente: 'x' }),
    'auditor_apagado',
  );
  assert.equal(
    porQueNoSeAuditaLaEmpresa({ auditorActivo: true, tieneClaveIa: false, idDelAgente: 'x' }),
    'sin_clave_ia',
  );
  assert.equal(
    porQueNoSeAuditaLaEmpresa({ auditorActivo: true, tieneClaveIa: true, idDelAgente: null }),
    'sin_id_del_agente',
  );
  assert.equal(
    porQueNoSeAuditaLaEmpresa({ auditorActivo: true, tieneClaveIa: true, idDelAgente: 'usuario1' }),
    null,
  );

  // Y los tres tienen su texto: un motivo sin frase llega a la pantalla como un código interno.
  for (const motivo of ['auditor_apagado', 'sin_clave_ia', 'sin_id_del_agente'] as const) {
    assert.ok(TEXTO_DEL_MOTIVO_DE_LA_EMPRESA[motivo].length > 0);
  }
});

test('el INTERRUPTOR gana sobre las otras dos faltas', () => {
  /* Con el orden al revés, una empresa apagada Y sin clave saldría reportada como «sin clave», y quien
     la apagó vería un motivo que no es el suyo — y trataría de arreglar algo que no está roto. El
     interruptor es el único de los tres que alguien apretó a propósito. */
  assert.equal(
    porQueNoSeAuditaLaEmpresa({ auditorActivo: false, tieneClaveIa: false, idDelAgente: null }),
    'auditor_apagado',
  );
});

test('un identificador del agente EN BLANCO cuenta como ausente', () => {
  /* Un campo de texto que alguien vació deja `'   '`, no `null`. Sin el recorte, esa empresa pasaría
     el portón y el atribuidor compararía el id de cada mensaje contra tres espacios: **ninguna línea
     saldría como AGENTE IA**, así que cada conversación se auditaría para producir un «no auditable».
     Gasto puro con la apariencia de estar funcionando. */
  for (const vacio of ['', '   ', '\n']) {
    assert.equal(
      porQueNoSeAuditaLaEmpresa({ auditorActivo: true, tieneClaveIa: true, idDelAgente: vacio }),
      'sin_id_del_agente',
      `no rechazó ${JSON.stringify(vacio)}`,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LOS PORTONES 1 A 3
// ═══════════════════════════════════════════════════════════════════════════════

test('el caso que PASA los cuatro portones audita, y dice por qué', () => {
  const d = decidirSiAuditar(candidato(), AHORA);
  assert.equal(d.audita, true);
  if (!d.audita) return;
  assert.equal(d.agente, 'chat_post_agenda');
  assert.equal(d.disparo, 'debounce');
  assert.equal(d.delta, 7);
  assert.equal(d.mensajesDelAgente, 12);
});

test('1 · sin territorio no se audita, porque no se sabe qué juzgar', () => {
  const d = decidirSiAuditar(candidato({ territorio: null }), AHORA);
  assert.deepEqual(d, { audita: false, porton: 'sin_territorio' });
});

test('2 · el agente que se juzga sale del TERRITORIO, no de la etiqueta', () => {
  /* ── EL DEFECTO QUE ESTO CIERRA ────────────────────────────────────────────
   *
   * Leer el agente de la etiqueta produciría veredictos correctos sobre el agente equivocado, y se
   * verían idénticos a los buenos. El territorio dice de quién es EL TRABAJO; eso es lo que se juzga. */
  const closer = decidirSiAuditar(candidato({ territorio: 'closer' }), AHORA);
  const setter = decidirSiAuditar(
    candidato({ territorio: 'setter', etiquetas: ['bot_activado_leadflow'] }),
    AHORA,
  );
  assert.equal(closer.audita && closer.agente, 'chat_post_agenda');
  assert.equal(setter.audita && setter.agente, 'chat_pre_agenda');
});

test('2 · la etiqueta del OTRO territorio no habilita: no se sabe qué se juzga', () => {
  /* Existe de verdad: el encabezado de `colas.ts` mide que hay contactos con las dos zonas a la vez
     durante el traspaso. El territorio dice de quién es el trabajo y la etiqueta dice quién está
     hablando; cuando no coinciden, auditar sería elegir a quién imputarle el fallo con una moneda. */
  const d = decidirSiAuditar(
    candidato({ territorio: 'setter', etiquetas: ['bot_activado_appflow'] }),
    AHORA,
  );
  assert.equal(d.audita, false);
  assert.equal(d.audita === false && d.porton, 'agente_no_atiende');
  // Y el detalle nombra el estado, que es lo que la corrida en seco tiene que mostrar.
  assert.equal(d.audita === false && d.detalle, 'atendiendo_post_agenda');
});

test('2 · la etiqueta LEGADA habilita en los dos territorios', () => {
  /* `bot_activado` a secas dice que el chatbot atiende sin decir cuál, y acá el territorio desempata.
     Dejarla afuera excluiría para siempre a un contacto que sí está siendo atendido.

     Medido: hoy en producción cero contactos la tienen a secas, así que esto no cambia una fila. Está
     por lo que cuesta el otro lado del error, que es una exclusión silenciosa. */
  const esperado = { closer: 'chat_post_agenda', setter: 'chat_pre_agenda' } as const;
  for (const territorio of ['closer', 'setter'] as const) {
    const d = decidirSiAuditar(candidato({ territorio, etiquetas: ['bot_activado'] }), AHORA);
    assert.equal(d.audita, true, `no pasó en ${territorio}`);
    /* ── Y ES EL ÚNICO CASO DONDE SOLO EL TERRITORIO PUEDE DECIDIR ────────────
     *
     * Con las dos etiquetas específicas, leer el agente de la etiqueta da el mismo resultado que
     * leerlo del territorio —porque el portón 2 ya rechazó los casos en que no coinciden— así que
     * una prueba sobre ellas **no distingue las dos implementaciones**. Acá sí: la etiqueta legada no
     * dice cuál agente es, y quien la lea tiene que inventar un valor por omisión. Sin esta
     * afirmación, mover el agente a la etiqueta pasa las veintiocho pruebas. */
    assert.equal(d.audita && d.agente, esperado[territorio]);
  }
});

test('2 · un agente pausado, apagado o post-llamada NO se audita', () => {
  /* Los tres estados de apagado. Y `bot_desactivado_postcall` importa aparte: significa lo CONTRARIO
     —«esta persona ya pasó por la llamada»— y auditarlo sería juzgar una conversación terminada. */
  for (const etiqueta of [
    'bot_desactivado_appflow',
    'bot_pausado_fallo',
    'bot_apagado_manual',
    'bot_desactivado_postcall',
  ]) {
    const d = decidirSiAuditar(candidato({ etiquetas: [etiqueta, 'bot_activado_appflow'] }), AHORA);
    assert.equal(d.audita, false, `${etiqueta} pasó el portón`);
  }
});

test('2 · sin ninguna etiqueta de agente no se audita', () => {
  const d = decidirSiAuditar(candidato({ etiquetas: [] }), AHORA);
  assert.equal(d.audita === false && d.porton, 'agente_no_atiende');
  assert.equal(d.audita === false && d.detalle, 'sin_agente');
});

test('3 · con un aviso abierto no se audita, ni con el antirrebote a tope', () => {
  /* ── Y NO ES REDUNDANTE CON EL PORTÓN 2 ────────────────────────────────────
   *
   * El estado `pausado_por_fallo` sale de una etiqueta del CRM, y ponerla es una segunda escritura a
   * un sistema ajeno **que puede fallar**. Cuando falla, nuestro hallazgo queda abierto y el CRM sigue
   * diciendo que el agente atiende: el portón 2 lo deja pasar y este lo frena.
   *
   * Sin él, ese contacto se re-auditaría en CADA corrida: la misma conversación, el mismo veredicto, y
   * una inferencia pagada cada diez minutos. */
  const d = decidirSiAuditar(
    candidato({ tieneAvisoAbierto: true, mensajesDelAgente: 500 }),
    AHORA,
  );
  assert.deepEqual(d, { audita: false, porton: 'ya_marcado' });
});

test('los portones reportan el motivo MÁS BARATO cuando fallan varios', () => {
  /* El orden es parte del contrato: la corrida en seco usa este motivo para decir qué habría que
     mirar. Reportando el caro, mandaría a investigar el antirrebote de un contacto que en realidad no
     tiene territorio. */
  const d = decidirSiAuditar(
    candidato({
      territorio: null,
      etiquetas: [],
      tieneAvisoAbierto: true,
      mensajesDelAgente: 0,
      mensajesDelAgenteEnElUltimoAnalisis: 0,
    }),
    AHORA,
  );
  assert.equal(d.audita === false && d.porton, 'sin_territorio');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL PORTÓN 4: LA RESTA
// ═══════════════════════════════════════════════════════════════════════════════

test('4 · el umbral EXACTO audita, y uno menos no', () => {
  const justo = decidirSiAuditar(
    candidato({ mensajesDelAgente: UMBRAL_DEL_DEBOUNCE, mensajesDelAgenteEnElUltimoAnalisis: 0 }),
    AHORA,
  );
  assert.equal(justo.audita, true);

  const uno_menos = decidirSiAuditar(
    candidato({
      mensajesDelAgente: UMBRAL_DEL_DEBOUNCE - 1,
      mensajesDelAgenteEnElUltimoAnalisis: 0,
    }),
    AHORA,
  );
  assert.equal(uno_menos.audita === false && uno_menos.porton, 'antirrebote');
});

test('4 · la resta es contra el ÚLTIMO análisis, no contra cero', () => {
  /* Es lo que hace que un contacto muy conversado no se re-audite en cada corrida. Sin la resta —o
     con la línea base clavada en cero— cualquier conversación de más de cinco mensajes del agente
     pasaría el portón SIEMPRE, y el antirrebote sería decorativo. */
  const d = decidirSiAuditar(
    candidato({ mensajesDelAgente: 104, mensajesDelAgenteEnElUltimoAnalisis: 100 }),
    AHORA,
  );
  assert.equal(d.audita === false && d.porton, 'antirrebote');
  assert.equal(d.audita === false && d.detalle, 'delta 4');
});

test('4 · nunca analizado hace que la resta sea el TOTAL', () => {
  /* `null` no es cero por casualidad: se traduce a cero para la resta, y se guarda como `null` para
     que un día se pueda preguntar cuántos contactos nunca pasaron por el auditor. */
  const d = decidirSiAuditar(
    candidato({ mensajesDelAgente: 6, mensajesDelAgenteEnElUltimoAnalisis: null }),
    AHORA,
  );
  assert.equal(d.audita, true);
  assert.equal(d.audita && d.delta, 6);
});

test('4 · una resta NEGATIVA no audita: no es «menos que nada», es «sin novedad»', () => {
  /* Pasa de verdad: el borrado de duplicados de la ingesta puede dejar menos mensajes que en el último
     análisis. Sin el recorte a cero, el delta negativo pasaría el piso del nivel 0 al revés —`-3 < 1`
     es cierto, pero por el lado equivocado— y el razonamiento de abajo se volvería frágil. */
  const d = decidirSiAuditar(
    candidato({ mensajesDelAgente: 2, mensajesDelAgenteEnElUltimoAnalisis: 9 }),
    AHORA,
  );
  assert.equal(d.audita === false && d.porton, 'antirrebote');
  assert.equal(d.audita === false && d.detalle, 'delta 0');
});

test('cuando el antirrebote alcanza, las alarmas van en `null` y NO en `[]`', () => {
  /* Es el contrato de la columna: «nadie las miró» y «se miraron y no había» no son el mismo hecho.
     Y acá nadie las miró de verdad — el antirrebote corta antes, que además es más barato. */
  const d = decidirSiAuditar(
    candidato({
      mensajesDelAgente: 20,
      mensajesDelAgenteEnElUltimoAnalisis: 0,
      // Con una señal puesta bien fuerte: igual tiene que salir `null`.
      ultimoEntranteTexto: 'quiero hablar con una persona ya',
      ultimoEntranteEl: hace(1),
      ultimoSalienteEl: null,
    }),
    AHORA,
  );
  assert.equal(d.audita, true);
  assert.equal(d.audita && d.alarmas, null);
  assert.equal(d.audita && d.disparo, 'debounce');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL NIVEL 0
// ═══════════════════════════════════════════════════════════════════════════════

test('las cuatro señales tienen su frase, y son CUATRO a propósito', () => {
  /* El número es una afirmación, no un conteo: el diseño pedía cinco y la quinta —la etiqueta
     `estancado` del CRM— la tienen **cero contactos de 322** en producción. Si alguien agrega una
     quinta, esto se pone rojo y la obliga a justificarse en el mismo cambio, que es lo único que
     impide que vuelva a entrar una señal que no puede disparar.

     Y la frase de cada una no es adorno: una señal sin texto llega a la corrida en seco como un
     código interno, y una corrida en seco que nadie entiende no se lee. */
  assert.equal(ALARMAS.length, 4);
  for (const a of ALARMAS) {
    assert.ok(TEXTO_DE_LA_ALARMA[a]?.trim().length ?? 0 > 0, `${a} no tiene frase`);
  }
});

test('el silencio pide LAS DOS condiciones, no solo el reloj', () => {
  /* Con solo «pasó el umbral desde el último entrante», la señal dispararía en toda conversación que
     el agente cerró bien hace un rato — o sea en casi todas. Una señal que dispara en casi todas es el
     antirrebote apagado con pasos extra. */
  const base = { ultimoEntranteTexto: 'ok' };

  // (a) el contacto escribió último Y (b) pasó el umbral → dispara
  assert.deepEqual(
    alarmasPuestas(
      { ...base, ultimoEntranteEl: hace(UMBRAL_DE_SILENCIO_MIN + 1), ultimoSalienteEl: hace(500) },
      AHORA,
    ),
    ['silencio_tras_el_contacto'],
  );
  // el agente respondió DESPUÉS → no dispara, aunque el entrante sea viejísimo
  assert.deepEqual(
    alarmasPuestas(
      { ...base, ultimoEntranteEl: hace(500), ultimoSalienteEl: hace(1) },
      AHORA,
    ),
    [],
  );
  // el contacto escribió último pero HACE UN MINUTO → no dispara
  assert.deepEqual(
    alarmasPuestas({ ...base, ultimoEntranteEl: hace(1), ultimoSalienteEl: hace(500) }, AHORA),
    [],
  );
});

test('el silencio dispara cuando NADIE respondió nunca', () => {
  /* `ultimoSalienteEl` nulo significa que no hay ni un saliente. Tratarlo como «el agente respondió
     hace mucho» dejaría fuera justo el caso más claro de abandono. */
  assert.deepEqual(
    alarmasPuestas(
      {
        ultimoEntranteEl: hace(UMBRAL_DE_SILENCIO_MIN + 10),
        ultimoSalienteEl: null,
        ultimoEntranteTexto: 'hola?',
      },
      AHORA,
    ),
    ['silencio_tras_el_contacto'],
  );
});

test('el umbral EXACTO de silencio ya dispara', () => {
  assert.deepEqual(
    alarmasPuestas(
      {
        ultimoEntranteEl: hace(UMBRAL_DE_SILENCIO_MIN),
        ultimoSalienteEl: null,
        ultimoEntranteTexto: 'hola',
      },
      AHORA,
    ),
    ['silencio_tras_el_contacto'],
  );
});

test('las tres señales de texto disparan con lo que la gente escribe de verdad', () => {
  const solo = (texto: string): readonly string[] =>
    alarmasPuestas(
      { ultimoEntranteEl: hace(1), ultimoSalienteEl: hace(0), ultimoEntranteTexto: texto },
      AHORA,
    );

  assert.deepEqual(solo('Quiero HABLAR CON UNA PERSONA por favor'), ['pidio_una_persona']);
  assert.deepEqual(solo('me pasas con alguien del equipo?'), ['pidio_una_persona']);
  assert.deepEqual(solo('gracias pero no me interesa'), ['rechazo_explicito']);
  assert.deepEqual(solo('esto no es lo que busco'), ['rechazo_explicito']);
  assert.deepEqual(solo('ya te dije que no'), ['enojo_explicito']);
  assert.deepEqual(solo('un servicio pésimo'), ['enojo_explicito']);
});

test('los acentos y las mayúsculas no apagan una señal', () => {
  /* La gente escribe «pesimo» y «pésimo». Una lista con acentos y sin normalizar deja pasar la mitad de
     los casos reales sin que nada falle: la señal simplemente no dispara. */
  const con = alarmasPuestas(
    { ultimoEntranteEl: hace(1), ultimoSalienteEl: hace(0), ultimoEntranteTexto: 'PÉSIMO servicio' },
    AHORA,
  );
  const sin = alarmasPuestas(
    { ultimoEntranteEl: hace(1), ultimoSalienteEl: hace(0), ultimoEntranteTexto: 'pesimo servicio' },
    AHORA,
  );
  assert.deepEqual(con, ['enojo_explicito']);
  assert.deepEqual(sin, ['enojo_explicito']);
});

test('sin texto entrante las señales de texto no disparan, y no lanzan', () => {
  assert.deepEqual(
    alarmasPuestas({ ultimoEntranteEl: hace(1), ultimoSalienteEl: hace(0), ultimoEntranteTexto: null }, AHORA),
    [],
  );
  assert.deepEqual(
    alarmasPuestas({ ultimoEntranteEl: null, ultimoSalienteEl: null, ultimoEntranteTexto: null }, AHORA),
    [],
  );
});

test('una señal adelanta el análisis por debajo del umbral', () => {
  /* Es el agujero que el nivel 0 cierra: la conversación de cuatro mensajes donde el contacto se va
     enojado nunca llega a cinco, así que sin esto **no se auditaría jamás** — y es justo el caso en el
     que un humano tendría que entrar. */
  const d = decidirSiAuditar(
    candidato({
      mensajesDelAgente: 2,
      mensajesDelAgenteEnElUltimoAnalisis: 0,
      ultimoEntranteTexto: 'esto no me sirve, quiero hablar con una persona',
      ultimoEntranteEl: hace(1),
      ultimoSalienteEl: hace(0),
    }),
    AHORA,
  );
  assert.equal(d.audita, true);
  assert.equal(d.audita && d.disparo, 'alarma');
  assert.deepEqual(d.audita && d.alarmas, ['pidio_una_persona', 'rechazo_explicito']);
});

test('EL PISO: una señal NO dispara sobre trabajo viejo', () => {
  /* ── EL ÚNICO DEFECTO DE ESTE ARCHIVO QUE NO GASTA UN POCO MÁS ─────────────
   *
   * La señal sigue puesta: el contacto no borra su mensaje enojado. Sin el piso, cada corrida del
   * barrido volvería a auditar la misma conversación sin que el agente haya dicho nada nuevo — y cada
   * corrida es una inferencia pagada, cada diez minutos, para siempre.
   *
   * El motivo de fondo es el que hay que entender: **esto audita AL AGENTE**. Si el agente no dijo
   * nada nuevo, el veredicto anterior ya cubre lo que hay. */
  const d = decidirSiAuditar(
    candidato({
      mensajesDelAgente: 7,
      mensajesDelAgenteEnElUltimoAnalisis: 7,
      ultimoEntranteTexto: 'ya te dije que esto no me sirve',
      ultimoEntranteEl: hace(1),
      ultimoSalienteEl: hace(0),
    }),
    AHORA,
  );
  assert.equal(d.audita === false && d.porton, 'sin_novedad_del_agente');
  // Y el detalle dice qué señal había: sin eso la corrida en seco no explica por qué se frenó.
  assert.match(String(d.audita === false && d.detalle), /enojo_explicito/);
});

test('EL PISO deja pasar el mínimo: un mensaje nuevo alcanza', () => {
  /* El piso es «al menos uno», no «al menos dos». Con `<=` en vez de `<`, una conversación con un
     mensaje nuevo del agente y el contacto pidiendo una persona se frenaría — que es exactamente el
     caso que el nivel 0 existe para atrapar. */
  const d = decidirSiAuditar(
    candidato({
      mensajesDelAgente: 7 + PISO_DEL_DEBOUNCE,
      mensajesDelAgenteEnElUltimoAnalisis: 7,
      ultimoEntranteTexto: 'quiero hablar con una persona',
      ultimoEntranteEl: hace(1),
      ultimoSalienteEl: hace(0),
    }),
    AHORA,
  );
  assert.equal(d.audita, true);
  assert.equal(d.audita && d.disparo, 'alarma');
});

test('los cinco motivos de portón tienen su frase, y ninguna está vacía', () => {
  /* Un motivo sin frase llega a la corrida en seco como un código interno, y una corrida en seco que
     nadie entiende no se lee — que es lo único que esa herramienta tiene que lograr. */
  for (const m of [
    'sin_territorio',
    'agente_no_atiende',
    'ya_marcado',
    'antirrebote',
    'sin_novedad_del_agente',
  ] as const) {
    assert.ok(TEXTO_DEL_PORTON[m].trim().length > 0, `${m} no tiene frase`);
  }
});
