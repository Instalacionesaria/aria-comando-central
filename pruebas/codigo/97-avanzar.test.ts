// Avanzar y las siete etapas, sin base y sin red. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO VIGILA, Y POR QUÉ NINGUNO SE VE MIRANDO LA PANTALLA
//
// **1 · La precedencia entre desenlaces.** Las etiquetas se ACUMULAN y la lista que devuelve el CRM
// no trae fechas, así que un contacto puede llegar con `seguimiento` y `venta_ganada` a la vez. Sin
// una precedencia declarada, la misma persona cae en una columna u otra según cómo vino ordenada la
// respuesta — y las dos veces parece correcto.
//
// **2 · Que la etapa se lea de nuestra base ANTES que de las etiquetas.** Al revés, un resultado que
// alguien registró a mano quedaría tapado por una etiqueta vieja del CRM.
//
// **3 · Que las siete columnas existan siempre**, incluidas las que dan cero. Una columna que
// desaparece cuando está vacía hace que nadie note que está vacía.
//
// **4 · Que el catálogo de salidas y el del CRM digan lo mismo.** Son dos archivos y una salida sin
// etiqueta se registra igual: el resultado entra a la base y el CRM nunca se enteró.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BOT_DESACTIVADO_POSTCALL,
  RESULTADOS,
  etiquetasDelResultado,
  etiquetasDelResultadoDelSetter,
  noAvisaAPropositoDelSetter,
  sePuedeMandar,
} from '../../lib/ghl/contrato.ts';
import {
  contarPorEtapa,
  desenlaceDeLasEtiquetas,
  ETAPAS,
  ETAPA_DE_ENTRADA,
  ETAPA_DE_LA_SALIDA,
  etapaDelContacto,
  PRECEDENCIA,
  type Etapa,
} from '../../lib/negocio/etapas.ts';
import {
  definicionDe,
  esSalidaDelCloser,
  esSalidaDelSetter,
  modosDe,
  SALIDAS_DEL_CLOSER,
  SALIDAS_DEL_SETTER,
} from '../../lib/negocio/salidas.ts';

const CLAVES = ETAPAS.map((e) => e.clave);

// ═══ 1 · Las siete etapas ═══════════════════════════════════════════════════

test('son SIETE, con clave y nombre, sin repetidas', () => {
  assert.equal(ETAPAS.length, 7);
  assert.equal(new Set(CLAVES).size, 7, 'hay una clave repetida');
  for (const e of ETAPAS) {
    assert.ok(e.nombre.length > 0, `la etapa ${e.clave} no tiene nombre`);
  }
});

test('la etapa de entrada es una de las siete', () => {
  // Un respaldo que apunta a una columna que no se dibuja hace desaparecer contactos de la
  // pantalla sin que nada falle.
  assert.ok(CLAVES.includes(ETAPA_DE_ENTRADA));
});

test('TODA salida lleva a una de las siete', () => {
  // El `Record<SalidaResultado, Etapa>` obliga a que estén las nueve; esto comprueba que ninguna
  // apunte a una columna inexistente, que el tipo no puede ver.
  for (const [salida, etapa] of Object.entries(ETAPA_DE_LA_SALIDA)) {
    assert.ok(CLAVES.includes(etapa as Etapa), `«${salida}» lleva a «${etapa}», que no existe`);
  }
});

// ═══ 2 · La precedencia ═════════════════════════════════════════════════════

test('con VENTA y SEGUIMIENTO a la vez, gana la venta', () => {
  // El caso que motiva toda la precedencia: las etiquetas se acumulan y no traen fecha. Con la
  // venta perdiendo, un contacto que ya pagó seguiría en la columna de trabajo activo.
  const d = desenlaceDeLasEtiquetas(['seguimiento', 'venta_ganada', 'lead_meta_ads']);
  assert.equal(d?.salida, 'venta');
  assert.equal(d?.etapa, 'ganado');
});

test('y el orden en que vengan las etiquetas NO cambia el resultado', () => {
  // Sin esto, la clasificación depende de cómo el proveedor ordenó su respuesta.
  const a = desenlaceDeLasEtiquetas(['venta_ganada', 'seguimiento']);
  const b = desenlaceDeLasEtiquetas(['seguimiento', 'venta_ganada']);
  assert.deepEqual(a, b);
});

test('SEGUIMIENTO gana solo cuando está solo: es la señal más débil', () => {
  // `seguimiento` no lo quita nadie, así que se arrastra para siempre: prueba que el contacto
  // ESTUVO en seguimiento, nunca que ESTÁ.
  assert.equal(desenlaceDeLasEtiquetas(['seguimiento'])?.etapa, 'seguimiento');

  // La secuencia más común de todas: seguimiento durante semanas y después «no le interesa».
  // Con `seguimiento` arriba, ese contacto seguiría en la columna de trabajo activo de alguien
  // que ya lo dio por perdido.
  assert.equal(desenlaceDeLasEtiquetas(['seguimiento', 'descalificado'])?.etapa, 'descalificado');
  assert.equal(desenlaceDeLasEtiquetas(['seguimiento', 'nurture_appflow'])?.etapa, 'nurture');
  assert.equal(desenlaceDeLasEtiquetas(['seguimiento', 'noshow'])?.etapa, 'no_show');
});

test('la precedencia está ordenada de lo más definitivo a lo menos', () => {
  // Se afirma el orden ENTERO y no pares sueltos: un cambio de orden en el medio no rompería
  // ninguna comparación de dos y movería contactos de columna.
  assert.deepEqual(PRECEDENCIA, [
    'venta',
    'acuerdo_sin_pago',
    'no_interesa',
    'nurture',
    'no_show',
    'seguimiento',
  ]);
});

test('sin ninguna etiqueta de desenlace no hay desenlace', () => {
  // Las decenas de etiquetas de campaña, origen y estado NO clasifican. Que alguna lo hiciera
  // pondría contactos en columnas por cómo entraron, no por cómo terminaron.
  assert.equal(desenlaceDeLasEtiquetas(['lead_meta_ads', 'cita_agendada', 'estancado']), null);
  assert.equal(desenlaceDeLasEtiquetas([]), null);
});

test('una etiqueta con otra caja se reconoce igual', () => {
  // En la LECTURA la tolerancia es correcta: si la subcuenta guardó `Venta_Ganada`, ignorarlo
  // mandaría a un contacto vendido a la columna equivocada. En la escritura no — ahí la
  // coincidencia tiene que ser exacta, y eso lo defiende `sePuedeMandar`.
  assert.equal(desenlaceDeLasEtiquetas([' VENTA_GANADA '])?.salida, 'venta');
});

// ═══ 3 · De dónde sale la etapa de un contacto ══════════════════════════════

test('lo que registró una PERSONA gana sobre lo que dicen las etiquetas', () => {
  // Es el mismo criterio que la píldora: *"el resultado lo registra una persona con Avanzar, así
  // que cuando existe es un hecho, no una inferencia"*. Al revés, una etiqueta vieja del CRM
  // taparía un Avanzar de hoy.
  assert.equal(
    etapaDelContacto({ etapa: 'ganado', etiquetas: ['noshow'] }),
    'ganado',
    'una etiqueta vieja tapó un resultado registrado',
  );
});

test('sin etapa propia se deduce de las etiquetas', () => {
  assert.equal(etapaDelContacto({ etapa: null, etiquetas: ['noshow'] }), 'no_show');
});

test('sin etapa y sin desenlace cae en la ENTRADA, no en un limbo', () => {
  // Un contacto del territorio del closer sin ningún Avanzar es alguien que ya agendó. Ésa es la
  // entrada del Pipeline, no un «no sé dónde ponerlo».
  assert.equal(etapaDelContacto({ etapa: null, etiquetas: [] }), ETAPA_DE_ENTRADA);
  assert.equal(etapaDelContacto({ etapa: null, etiquetas: ['lead_meta_ads'] }), 'agendado');
});

test('una etapa guardada que ya no existe NO hace desaparecer al contacto', () => {
  // Si mañana se retira una columna, las filas que la tenían escrita apuntarían a algo que no se
  // dibuja: el contacto se iría de la pantalla sin que nada falle. Se cae a las etiquetas.
  assert.equal(etapaDelContacto({ etapa: 'limbo', etiquetas: ['noshow'] }), 'no_show');
  assert.equal(etapaDelContacto({ etapa: 'limbo', etiquetas: [] }), ETAPA_DE_ENTRADA);
});

// ═══ 4 · El conteo ══════════════════════════════════════════════════════════

test('el conteo trae las SIETE claves, también las que dan cero', () => {
  // Una columna que desaparece cuando está vacía hace que nadie note que está vacía.
  const c = contarPorEtapa(['ganado', 'ganado', 'no_show']);
  assert.deepEqual(Object.keys(c).sort(), [...CLAVES].sort());
  assert.equal(c.ganado, 2);
  assert.equal(c.no_show, 1);
  assert.equal(c.nurture, 0);
  assert.equal(c.agendado, 0);
});

// ═══ 5 · El catálogo de salidas ═════════════════════════════════════════════

test('son SEIS salidas para el closer, cada una con su etapa', () => {
  assert.equal(SALIDAS_DEL_CLOSER.length, 6);
  for (const s of SALIDAS_DEL_CLOSER) {
    assert.ok(s.nombre.length > 0, `${s.salida} sin nombre`);
    assert.ok(s.detalle.length > 0, `${s.salida} sin descripción: la tarjeta quedaría muda`);
    assert.ok(CLAVES.includes(ETAPA_DE_LA_SALIDA[s.salida]), `${s.salida} sin etapa válida`);
  }
});

test('TODA salida del closer tiene su etiqueta en el contrato del CRM', () => {
  // Son dos archivos, y una salida sin etiqueta se registra igual: el resultado entra a la base y
  // el CRM nunca se entera. No falla nada — no dispara el flujo de recuperación de un no-show, y
  // eso se descubre cuando alguien pregunta por qué no salió la secuencia.
  for (const s of SALIDAS_DEL_CLOSER) {
    const def = RESULTADOS.find((r) => r.salida === s.salida);
    assert.ok(def, `la salida «${s.salida}» no tiene etiqueta en el contrato`);
    /* Las seis del closer SÍ declaran etiqueta: ninguna es de las que «no avisan a propósito», que
       son dos del setter. Se afirma y no se saltea: una etiqueta nula acá sería una salida del
       closer que dejó de disparar su automatismo sin que nada falle. */
    assert.notEqual(def.etiqueta, null, `la salida «${s.salida}» dejó de declarar etiqueta`);
    assert.ok(sePuedeMandar(def.etiqueta ?? ''), `«${def.etiqueta}» no se puede mandar al CRM`);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// EL SETTER NO APAGA EL AGENTE, Y ES LA AFIRMACIÓN QUE MÁS PESA DEL MÓDULO
// ════════════════════════════════════════════════════════════════════════════

test('NINGUNA salida del setter apaga el agente, y una del closer SÍ', () => {
  /* ══ LA MINA QUE HABÍA CARGADA ════════════════════════════════
   *
   * `no_califica` —una salida del SETTER— vivía en la tabla del closer con `apagaElBot: true`. Lo
   * único que lo contenía era que la ruta rechazaba esa salida con un 400: el día que el setter
   * pudiera registrarla, le habría puesto `bot_desactivado_postcall` —que significa literalmente
   * «ya pasó la llamada de cierre»— a un lead que **nunca tuvo una llamada**. Y esa etiqueta la
   * aplicación no la sabe quitar.
   *
   * El Closer apaga el agente en seis de sus siete salidas porque cualquier resultado suyo prueba
   * que hubo llamada. **Ninguna de las cinco del setter lo prueba**: es pre-agenda por definición.
   * Apagarlo desde ahí mata al agente que todavía tiene que calificar al lead — y peor en
   * `seguimiento`, que es justo la salida que lo deja en manos del agente por días.
   *
   * ── POR QUÉ ESTA PRUEBA ES DE CÓDIGO Y NO DE COMPORTAMIENTO ───────────
   *
   * `etiquetasDelResultado*` son puras y viven en el contrato justamente para esto. Una prueba por
   * HTTP no sirve: la ruta resuelve credenciales ANTES de decidir qué mandar, así que en una base
   * sin token devuelve la lista vacía sin llegar a la decisión — y pasaría en verde con el apagado
   * encendido. */
  for (const s of SALIDAS_DEL_SETTER) {
    for (const modo of [undefined, ...modosDe('setter', s.salida).map((m) => m.etiqueta)]) {
      const etiquetas = etiquetasDelResultadoDelSetter(s.salida, modo);
      assert.ok(
        !etiquetas.includes(BOT_DESACTIVADO_POSTCALL),
        `la salida «${s.salida}» del setter manda ${BOT_DESACTIVADO_POSTCALL}, que significa «ya ` +
          'pasó la llamada de cierre» sobre un lead que nunca tuvo una',
      );
    }
  }

  /* Y LA MITAD SIMÉTRICA, sin la cual esto pasa en vacío: si alguien borrara la etiqueta del
     archivo, el bucle de arriba seguiría verde afirmando nada. */
  assert.ok(
    etiquetasDelResultado('venta').includes(BOT_DESACTIVADO_POSTCALL),
    'la venta del closer dejó de apagar el agente: entonces la prueba de arriba no prueba nada',
  );
});

test('el catálogo del setter no tiene siquiera DÓNDE escribir el apagado', () => {
  /* La otra mitad, y es la que impide que esto vuelva por copia-pega. La prueba de arriba mira el
     COMPORTAMIENTO; ésta mira la FORMA: el tipo de la tabla del setter no tiene el campo, así que
     escribir `apagaElBot: true` ahí es un error de compilación.

     No es una bandera en `false` que alguien pueda cambiar de opinión: la diferencia es
     **inexpresable**, que es el único grado de garantía que no depende de que nadie se olvide. */
  const fuente = readFileSync(new URL('../../lib/ghl/contrato.ts', import.meta.url), 'utf8');
  const tabla = /RESULTADOS_DEL_SETTER[\s\S]*?\n\];/.exec(fuente)?.[0] ?? '';
  assert.notEqual(tabla, '', 'no se encontró la tabla de resultados del setter');
  assert.doesNotMatch(
    tabla,
    /apagaElBot/,
    'la tabla del setter nombra `apagaElBot`: el apagado dejó de ser inexpresable y pasó a ser una ' +
      'bandera que alguien puede cambiar',
  );
  assert.doesNotMatch(
    tabla,
    /BOT_DESACTIVADO_POSTCALL/,
    'la tabla del setter nombra la etiqueta que apaga el agente',
  );
});

test('las cinco salidas del setter, y las dos que NO avisan a propósito', () => {
  /* Las cinco de la documentación. El conteo se fija para que agregar una sexta sea una decisión y
     no un descuido — igual que las seis del closer. */
  assert.deepEqual(
    SALIDAS_DEL_SETTER.map((s) => s.salida),
    ['agendo', 'venta_chica', 'seguimiento', 'no_califica', 'nurture'],
  );

  /* Los dos catálogos NO se filtran uno en el otro. Es lo que impide que un closer registre
     `agendo` sobre su contacto —que le borraría el desenlace— y que un setter registre la venta
     grande, que le pagaría el tramo de comisión equivocado. */
  assert.equal(esSalidaDelSetter('venta'), false, 'la venta grande entró al catálogo del setter');
  assert.equal(esSalidaDelCloser('agendo'), false, '`agendo` entró al catálogo del closer');
  assert.equal(esSalidaDelCloser('venta_chica'), false);

  /* ── LAS DOS QUE NO AVISAN, Y POR QUÉ ES DISTINTO DE «NO CONFIRMADA» ────
   *
   * `agendo` no manda etiqueta porque el traspaso lo hace el CRM cuando la cita se crea de verdad;
   * `venta_chica` porque **no existe ninguna etiqueta que signifique «vendió el producto chico»**.
   * El único candidato es la de derivación, y significa un ruteo, no un cobro: usarla marcaría como
   * venta a todo el que recibió la oferta.
   *
   * Sin el tercer estado, las dos se reportaban con «ninguna de las etiquetas está confirmada en la
   * subcuenta» — que es FALSO, y manda a alguien a crear en el CRM una etiqueta que nadie tiene que
   * crear. */
  assert.equal(noAvisaAPropositoDelSetter('agendo'), true);
  assert.equal(noAvisaAPropositoDelSetter('venta_chica'), true);
  assert.equal(
    noAvisaAPropositoDelSetter('no_califica'),
    false,
    '`no_califica` SÍ tiene etiqueta: decir que no avisa a propósito taparia que dejó de mandarla',
  );
})
;

test('el `seguimiento` del setter tiene un modo MANUAL, o su cola nace muerta', () => {
  /* Las dos series del setter las corre el CRM: `exigeFecha: false` significa que **no se escribe
     fila en `negocio.tareas`**, y esa tabla es la única fuente de la cola «Seguimientos de hoy».

     O sea que con SOLO las dos series, esa cola del Mi Día del setter nace vacía para siempre: una
     sección que se dibuja y nunca tiene nada, que es la rama de interfaz muerta que `miDia.ts` ya
     retiró una vez con `serie_agotada`. */
  const modos = modosDe('setter', 'seguimiento');
  assert.ok(
    modos.some((m) => m.exigeFecha),
    'ningún modo del seguimiento del setter escribe una tarea nuestra, así que su cola de ' +
      'seguimientos no puede tener una sola fila nunca',
  );

  // Y las dos series propias siguen ahí: son 5 y 3 días contra los 7 del closer porque persiguen
  // una CITA y no un cierre.
  assert.deepEqual(
    modos.map((m) => m.etiqueta).sort(),
    ['seguimiento_decision_lt', 'seguimiento_manual', 'seguimiento_para_agendar'],
  );
});

test('el NO-SHOW es la única que deja el bot vivo', () => {
  // Dispara un flujo de recuperación que necesita al agente trabajando. Apagárselo ahí sería
  // romper justo el caso que más lo necesita.
  const noShow = RESULTADOS.find((r) => r.salida === 'no_show');
  assert.equal(noShow?.apagaElBot, false);
  for (const s of SALIDAS_DEL_CLOSER) {
    if (s.salida === 'no_show') continue;
    assert.equal(
      RESULTADOS.find((r) => r.salida === s.salida)?.apagaElBot,
      true,
      `«${s.salida}» dejó el bot vivo: va a seguir escribiéndole a alguien ya resuelto`,
    );
  }
});

test('las dos salidas que piden MONTO son las dos que hablan de dinero', () => {
  // De esto dependen los números de Inicio: una venta sin monto suma uno menos en «cobrado» y
  // nada falla.
  const conMonto = SALIDAS_DEL_CLOSER.filter((s) => s.pideMonto).map((s) => s.salida);
  assert.deepEqual([...conMonto].sort(), ['acuerdo_sin_pago', 'venta']);
});

test('la que NO tiene subcategoría es exactamente «acordó comprar»', () => {
  // Lo que la describe es el monto. Las otras cinco tienen su pregunta, y una salida sin opciones
  // dejaría el segundo paso del formulario en blanco sin decir por qué.
  const sinCampo = SALIDAS_DEL_CLOSER.filter((s) => s.etiquetaDelCampo === null).map((s) => s.salida);
  assert.deepEqual(sinCampo, ['acuerdo_sin_pago']);
  for (const s of SALIDAS_DEL_CLOSER) {
    if (s.etiquetaDelCampo === null) continue;
    assert.ok(s.opciones.length > 0, `«${s.salida}» pregunta algo y no ofrece ninguna opción`);
  }
});

test('esSalidaDelCloser no se deja engañar por la cadena de prototipos', () => {
  // `'toString' in OBJETO` devuelve `true`, y con eso un cuerpo con `salida: 'constructor'` pasaba
  // la validación del endpoint para después no encontrar nada en el catálogo. Es un defecto real
  // que la implementación de referencia dejó anotado.
  for (const v of ['toString', 'constructor', 'hasOwnProperty', '__proto__', 'valueOf']) {
    assert.equal(esSalidaDelCloser(v), false, `«${v}» pasó como salida`);
  }
  assert.equal(esSalidaDelCloser('venta'), true);
  // Y las del setter tampoco: el closer no las registra.
  assert.equal(esSalidaDelCloser('agendo'), false);
  assert.equal(esSalidaDelCloser('venta_chica'), false);
  assert.equal(esSalidaDelCloser(null), false);
  assert.equal(esSalidaDelCloser(42), false);
});

test('definicionDe devuelve undefined para lo que no es una salida', () => {
  assert.equal(definicionDe('closer', 'constructor'), undefined);
  assert.equal(definicionDe('closer', 'venta')?.pideMonto, true);
});
