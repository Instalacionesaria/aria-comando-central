// EL ESCRITOR del análisis, contra la base. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA AFIRMACIÓN QUE ESTE ARCHIVO DEFIENDE, EN UNA LÍNEA
//
// **`escribirAnalisis` no lanza nunca, y la base acepta lo que escribe.**
//
// Las dos mitades importan por igual y ninguna alcanza sola. La 027 le puso once `check` a las dos
// tablas, y todos abortan la escritura: eso es lo correcto —el estado inválido es inescribible— y es
// también el peor final posible para este módulo, porque cuando la escritura aborta **el análisis se
// pierde con la inferencia ya pagada**.
//
// Así que estas pruebas no comprueban que la base rechace: eso ya lo hace
// `pruebas/base/99-veredicto-del-auditor.test.ts`, intentando las escrituras inválidas a mano.
// Comprueban lo de acá: que el escritor **corrija** en vez de dejar que la base rechace.
//
// Y la prueba que más vale es la última: un veredicto DELIBERADAMENTE HOSTIL, con cada campo
// equivocado a la vez, que igual tiene que terminar en una fila válida.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { limpiar, montar, unContacto, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { escribirAnalisis, type AnalisisParaEscribir } from '../../lib/auditor/escritura.ts';
import type { VeredictoDelModelo } from '../../lib/auditor/esquema.ts';
import type { HechosDeLaConversacion } from '../../lib/auditor/transcripcion.ts';
import { TOPE_DE_HALLAZGOS } from '../../lib/auditor/veredicto.ts';

let esc: Escenario;
let contactoId: string;

before(async () => {
  esc = await montar('Escritura');
  const k = await unContacto(esc, { territorio: 'closer', nombre: 'Escritura contacto' });
  contactoId = k.id;
});
after(async () => {
  await borrarTodo();
  await limpiar(esc);
  await cerrarTodo();
  await cerrarClientes();
});

async function borrarTodo(): Promise<void> {
  await esc.admin.query('delete from negocio.hallazgos where contacto_id = $1', [contactoId]);
  await esc.admin.query('delete from negocio.analisis_del_agente where contacto_id = $1', [contactoId]);
}

/** Un hallazgo completo, para mutarlo. */
function unHallazgo(cambios: Partial<VeredictoDelModelo['hallazgos'][number]> = {}) {
  return {
    titulo: 'Promete financiamiento',
    patron: 'promete_financiamiento_inexistente',
    criterio: 'promesa_incorrecta',
    severidad: 'rojo',
    categoria: 'comportamiento',
    diagnostico: 'El agente ofrece cuotas que la empresa no da.',
    fragmento_prompt: null,
    prompt_seccion: 'Precios',
    correccion: 'Agregar en la sección Precios: no se ofrece financiamiento.',
    evidencia_agente: 'Podés pagarlo en doce cuotas sin interés.',
    evidencia_contacto: '¿Se puede en cuotas?',
    ...cambios,
  };
}

/** Un veredicto válido y prolijo, para mutarlo campo por campo. */
function unVeredicto(cambios: Partial<VeredictoDelModelo> = {}): VeredictoDelModelo {
  return {
    auditable: true,
    no_auditable_motivo: null,
    resumen: 'El contacto preguntó por el precio y el agente respondió.',
    intervencion: { requerida: false, motivo: null },
    nivel: 'verde',
    criterio: 'ninguno',
    destacado: 'Confirmó la cita con la hora exacta.',
    evidencia: 'Te confirmo el martes a las 15:00.',
    sentimiento: 'positivo',
    observaciones: [],
    hallazgos: [],
    ...cambios,
  };
}

/** Los hechos, para el camino sin veredicto. */
function unosHechos(cambios: Partial<HechosDeLaConversacion> = {}): HechosDeLaConversacion {
  return {
    porAutor: {
      CONTACTO: 1,
      'AGENTE IA': 0,
      'ASESOR HUMANO': 0,
      'AUTOMATIZACIÓN': 3,
      'ORIGEN NO IDENTIFICADO': 0,
    },
    ultimoEsDe: 'AUTOMATIZACIÓN',
    minutosDesdeElUltimo: 5,
    minutosDesdeElAgente: null,
    respondieronAlContacto: true,
    sinTexto: 0,
    umbralDeSilencioMin: 60,
    ...cambios,
  };
}

/** Escribe y devuelve la fila tal como quedó en la base. */
async function escribirYLeer(a: AnalisisParaEscribir) {
  const escrito = await conOrganizacion(esc.org, () => escribirAnalisis(a));
  const fila = await conOrganizacion(esc.org, () =>
    datos()
      .selectFrom('analisis_del_agente')
      .selectAll()
      .where('id', '=', escrito.analisisId)
      .executeTakeFirstOrThrow(),
  );
  const hallazgos = await conOrganizacion(esc.org, () =>
    datos()
      .selectFrom('hallazgos')
      .selectAll()
      .where('analisis_id', '=', escrito.analisisId)
      .orderBy('patron')
      .execute(),
  );
  return { escrito, fila, hallazgos };
}

/** Lo común de un análisis con veredicto. */
const base = {
  tipo: 'veredicto' as const,
  agente: 'chat_post_agenda' as const,
  disparo: 'debounce' as const,
  alarmas: null,
  mensajesDelAgente: 7,
  modelo: 'claude-sonnet-5',
  promptHash: 'abc123def456abcd',
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL CAMINO FELIZ
// ═══════════════════════════════════════════════════════════════════════════════

test('un veredicto prolijo se guarda tal cual, con su modelo y su hash', async () => {
  await borrarTodo();
  const { escrito, fila } = await escribirYLeer({
    ...base,
    contactoId,
    veredicto: unVeredicto(),
  });

  assert.equal(fila.auditable, true);
  assert.equal(fila.nivel, 'verde');
  assert.equal(fila.intervencion, false);
  assert.equal(fila.modelo, 'claude-sonnet-5');
  assert.equal(fila.prompt_hash, 'abc123def456abcd');
  assert.equal(fila.mensajes_del_agente, 7);
  assert.equal(escrito.descartados.length, 0);
  // El criterio neutro se guarda NULO y no como la palabra «ninguno»: la columna es anulable, y
  // guardar el neutro haría que la pantalla mostrara «ninguno» como si fuera un criterio.
  assert.equal(fila.criterio, null);
});

test('el hallazgo entra completo, con el hash del prompt COPIADO en él', async () => {
  await borrarTodo();
  const { fila, hallazgos } = await escribirYLeer({
    ...base,
    contactoId,
    veredicto: unVeredicto({ hallazgos: [unHallazgo()] }),
  });

  assert.equal(hallazgos.length, 1);
  assert.equal(hallazgos[0]?.patron, 'promete_financiamiento_inexistente');
  assert.equal(hallazgos[0]?.analisis_id, fila.id);
  /* El hash va en el hallazgo y no solo en el análisis: la pantalla del técnico muestra hallazgos, y
     es lo que le permite avisar que el fragmento citado puede ya no existir. */
  assert.equal(hallazgos[0]?.prompt_hash, 'abc123def456abcd');
  // Y el nivel subió a amarillo por tener un hallazgo, sin que el modelo lo pidiera.
  assert.equal(fila.nivel, 'amarillo');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LA DERIVACIÓN GANA AL MODELO
// ═══════════════════════════════════════════════════════════════════════════════

test('el modelo pide amarillo CON intervención y se guarda ROJO', async () => {
  await borrarTodo();
  /* ── LA ESCRITURA QUE LA BASE HABRÍA TUMBADO ────────────────────────────────
   *
   * `check ((coalesce(nivel,'') = 'rojo') = intervencion)`. Escribiendo lo que el modelo dijo, esta
   * fila aborta con un `23514` y **el análisis se pierde con la inferencia ya pagada** — que es el
   * peor final posible de este módulo.
   *
   * Derivar convierte un error del modelo en una fila correcta. */
  const { fila } = await escribirYLeer({
    ...base,
    contactoId,
    veredicto: unVeredicto({
      nivel: 'amarillo',
      intervencion: { requerida: true, motivo: 'Dijo que el precio es negociable y no lo es.' },
    }),
  });
  assert.equal(fila.nivel, 'rojo');
  assert.equal(fila.intervencion, true);
  assert.equal(fila.motivo, 'Dijo que el precio es negociable y no lo es.');
});

test('el nivel se deriva DESPUÉS de filtrar: tres hallazgos rotos dan VERDE', async () => {
  await borrarTodo();
  /* ── EL ORDEN, QUE ES LO ÚNICO QUE ESTA PRUEBA MIDE ────────────────────────
   *
   * Derivando antes del filtro, el nivel saldría amarillo con CERO hallazgos escritos: una fila que la
   * pantalla del técnico muestra sin nada que ajustar. El encabezado de `veredicto.ts` describe ese
   * caso como el defecto medido de una redacción vieja de la rúbrica, y su efecto no era un error
   * visible sino **el contador de verdes bajando sin que nada hubiera cambiado en los agentes**. */
  const { fila, hallazgos, escrito } = await escribirYLeer({
    ...base,
    contactoId,
    veredicto: unVeredicto({
      hallazgos: [
        unHallazgo({ patron: '!!' }),
        unHallazgo({ patron: 'sin_cita', evidencia_agente: '   ' }),
        unHallazgo({ patron: 'sin_correccion', correccion: '' }),
      ],
    }),
  });
  assert.equal(hallazgos.length, 0);
  assert.equal(fila.nivel, 'verde');
  assert.equal(escrito.descartados.length, 3);
});

test('el modelo pide amarillo SIN hallazgos y se honra, porque la rúbrica es la que lo impide', async () => {
  await borrarTodo();
  /* La tensión que el encabezado de `veredicto.ts` deja dicha en voz alta: lo que impide este amarillo
     es la RÚBRICA, no la derivación. Si igual llega, se guarda y no se pisa a verde — pisarlo
     esconderÍa una señal que el modelo levantó, y un amarillo sin patrón **se ve** en la pantalla del
     técnico como una fila sin nada que ajustar. Eso es un defecto medible de la rúbrica, no un
     problema silencioso. */
  const { fila } = await escribirYLeer({
    ...base,
    contactoId,
    veredicto: unVeredicto({ nivel: 'amarillo', hallazgos: [] }),
  });
  assert.equal(fila.nivel, 'amarillo');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LOS DESCARTES: SE TIRA UN HALLAZGO, NUNCA UN ANÁLISIS
// ═══════════════════════════════════════════════════════════════════════════════

test('un patrón roto tira EL HALLAZGO y el análisis entra con los otros', async () => {
  await borrarTodo();
  const { fila, hallazgos, escrito } = await escribirYLeer({
    ...base,
    contactoId,
    veredicto: unVeredicto({
      hallazgos: [unHallazgo({ patron: '¡¡!!' }), unHallazgo({ patron: 'este_si_sirve' })],
    }),
  });
  assert.equal(hallazgos.length, 1);
  assert.equal(hallazgos[0]?.patron, 'este_si_sirve');
  assert.equal(fila.nivel, 'amarillo');
  assert.equal(escrito.descartados.length, 1);
  assert.match(escrito.descartados[0] ?? '', /patrón inválido/);
});

test('un patrón con acentos, espacios y mayúsculas se NORMALIZA, no se descarta', async () => {
  await borrarTodo();
  /* Es el error de tipeo esperable, y descartar por eso sería tirar un hallazgo bueno. El formato lo
     hace cumplir un `check` de la base, así que sin la normalización esta escritura abortaría. */
  const { hallazgos } = await escribirYLeer({
    ...base,
    contactoId,
    veredicto: unVeredicto({ hallazgos: [unHallazgo({ patron: '  Promesa-Inválida  ' })] }),
  });
  assert.equal(hallazgos[0]?.patron, 'promesa_invalida');
});

test('el TOPE se aplica en código y se DICE cuántos quedaron afuera', async () => {
  await borrarTodo();
  /* El esquema del modelo no lleva máximo de items a propósito: un máximo hace que el modelo TRUNQUE
     en vez de elegir. Se le pide que traiga los más importantes y se recorta acá — y el recorte se
     reporta, porque «el modelo encontró tres» y «encontró cinco y dos se tiraron» no son lo mismo. */
  const muchos = Array.from({ length: TOPE_DE_HALLAZGOS + 2 }, (_, i) =>
    unHallazgo({ patron: `patron_numero_${i}` }),
  );
  const { hallazgos, escrito } = await escribirYLeer({
    ...base,
    contactoId,
    veredicto: unVeredicto({ hallazgos: muchos }),
  });
  assert.equal(hallazgos.length, TOPE_DE_HALLAZGOS);
  assert.ok(escrito.descartados.some((d) => /por encima del tope/.test(d)));
});

test('un criterio del OTRO agente se guarda nulo, no como el neutro', async () => {
  await borrarTodo();
  /* `calificacion_saltada` es de pre-agenda y esto es post-agenda: es exactamente el cruce que la
     medición encontró en los 59 análisis del origen. El esquema por agente lo hace inexpresable del
     lado del modelo; esta capa es la que queda si un día su validación estricta se relaja. */
  const { fila, hallazgos } = await escribirYLeer({
    ...base,
    contactoId,
    veredicto: unVeredicto({
      criterio: 'calificacion_saltada',
      hallazgos: [unHallazgo({ criterio: 'calificacion_saltada' })],
    }),
  });
  assert.equal(fila.criterio, null);
  assert.equal(hallazgos[0]?.criterio, null);
});

test('el modelo se declara NO AUDITABLE y pide intervención: se guarda sin ninguna de las dos', async () => {
  await borrarTodo();
  /* ── LA CONTRADICCIÓN QUE LA BASE NO PERDONA ──────────────────────────────
   *
   * El modelo dice «no pude juzgar esta conversación» y a la vez «que venga un humano ahora». Son
   * incompatibles: la intervención es un veredicto, y él declaró que no hay veredicto.
   *
   * Escribiéndolo tal cual, el nivel deriva a `null` —sin auditar no hay veredicto— y entonces
   * `check ((coalesce(nivel,'') = 'rojo') = intervencion)` compara `false = true` y **aborta la
   * escritura**. Una inferencia pagada, perdida por una contradicción del modelo.
   *
   * La corrección es forzar la intervención a falso, que es lo único coherente con lo que él mismo
   * dijo: **no se le cree la conclusión a quien declaró que no pudo concluir.** */
  const { fila } = await escribirYLeer({
    ...base,
    contactoId,
    veredicto: unVeredicto({
      auditable: false,
      no_auditable_motivo: 'La conversación es toda de audios sin transcribir.',
      nivel: 'rojo',
      intervencion: { requerida: true, motivo: 'Que venga alguien.' },
      destacado: null,
      evidencia: null,
    }),
  });

  assert.equal(fila.auditable, false);
  assert.equal(fila.intervencion, false, 'no se le cree la conclusión a quien no pudo concluir');
  assert.equal(fila.nivel, null);
  assert.equal(fila.motivo, null);
  assert.equal(fila.observaciones, null);
  // Y el motivo de por qué no se pudo SÍ se guarda: es lo único que el modelo aportó.
  assert.match(String(fila.no_auditable_motivo), /audios sin transcribir/);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL DESTACADO Y SU CITA
// ═══════════════════════════════════════════════════════════════════════════════

test('un destacado SIN su cita apaga los dos', async () => {
  await borrarTodo();
  /* Lo exige `check ((destacado is null) = (evidencia is null))`, y la corrección es apagar los dos y
     no inventar el que falta. Un mérito afirmado sin la línea que lo respalda es peor que un hallazgo
     sin cita, **porque nadie audita un elogio**. */
  const { fila } = await escribirYLeer({
    ...base,
    contactoId,
    veredicto: unVeredicto({ destacado: 'Estuvo muy bien', evidencia: null }),
  });
  assert.equal(fila.destacado, null);
  assert.equal(fila.evidencia, null);
  assert.equal(fila.nivel, 'verde', 'no encontrar un elogio no es encontrar una falla');
});

test('en ROJO el destacado va nulo aunque el modelo lo mande', async () => {
  await borrarTodo();
  const { fila } = await escribirYLeer({
    ...base,
    contactoId,
    veredicto: unVeredicto({
      intervencion: { requerida: true, motivo: 'El contacto pidió hablar con una persona tres veces.' },
      destacado: 'Fue muy amable',
      evidencia: 'Con mucho gusto te ayudo.',
    }),
  });
  assert.equal(fila.nivel, 'rojo');
  assert.equal(fila.destacado, null);
  assert.equal(fila.evidencia, null);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · EL CAMINO SIN VEREDICTO
// ═══════════════════════════════════════════════════════════════════════════════

test('una conversación no auditable deja fila, y su resumen cuenta los HECHOS', async () => {
  await borrarTodo();
  /* La fila se escribe por dos motivos, y el segundo es el que decide: la pantalla del técnico tiene
     que poder listar las no auditables, y **la fila mueve la línea base del antirrebote**. Sin fila,
     cada corrida del barrido vuelve a cargar los mensajes y a decidir lo mismo, cada diez minutos y
     para siempre. */
  const { fila } = await escribirYLeer({
    tipo: 'no_auditable',
    contactoId,
    agente: 'chat_post_agenda',
    disparo: 'debounce',
    alarmas: null,
    mensajesDelAgente: 4,
    porque: 'sin_lineas_del_agente',
    hechos: unosHechos(),
  });

  assert.equal(fila.auditable, false);
  assert.equal(fila.nivel, null, 'sin auditar no hay veredicto, y `null` no es un cuarto nivel');
  assert.equal(fila.observaciones, null);
  assert.equal(fila.intervencion, false);
  assert.equal(fila.modelo, null, 'un nombre de modelo acá diría que se juzgó');
  assert.equal(fila.mensajes_del_agente, 4, 'la línea base se mueve igual');
  // El resumen: descripción y no juicio, con los números adentro.
  assert.match(fila.resumen, /1 mensajes del contacto y 0 del agente/);
  assert.match(String(fila.no_auditable_motivo), /Sin agente no hay nada que auditar/);
});

test('las tres formas de no ser auditable dejan tres resúmenes distintos', async () => {
  /* Un resumen fijo haría que la pantalla del técnico mostrara veinte filas idénticas. Y los tres
     motivos llevan a tres lecturas distintas: sin agente es su ausencia, dos intercambios es que la
     conversación no llegó a desarrollarse, y la mayoría sin texto es que lo que se dijo no lo tenemos. */
  const resumenes = new Set<string>();
  for (const porque of ['sin_lineas_del_agente', 'menos_de_dos_intercambios', 'mayoria_sin_texto'] as const) {
    await borrarTodo();
    const { fila } = await escribirYLeer({
      tipo: 'no_auditable',
      contactoId,
      agente: 'chat_post_agenda',
      disparo: 'alarma',
      alarmas: ['pidio_una_persona'],
      mensajesDelAgente: 2,
      porque,
      hechos: unosHechos({ sinTexto: 2 }),
    });
    resumenes.add(fila.resumen);
    // Y las alarmas viajan: es el dato con el que después se decide si una señal vale lo que gasta.
    assert.deepEqual(fila.alarmas, ['pidio_una_persona']);
  }
  assert.equal(resumenes.size, 3);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · LAS TRES FORMAS DE `alarmas`
// ═══════════════════════════════════════════════════════════════════════════════

test('`alarmas` distingue «nadie las miró» de «se miraron y no había»', async () => {
  /* Tres estados y tres significados. `null` es el antirrebote normal —no se miraron, y es más
     barato—; con elementos son las que adelantaron el análisis. Colapsar `null` con `[]` haría
     imposible la única pregunta para la que la columna existe: si una señal dispara seguido y nunca
     termina en rojo, es gasto puro. */
  await borrarTodo();
  const sinMirar = await escribirYLeer({ ...base, contactoId, veredicto: unVeredicto() });
  assert.equal(sinMirar.fila.alarmas, null);

  await borrarTodo();
  const miradas = await escribirYLeer({
    ...base,
    contactoId,
    disparo: 'alarma',
    alarmas: [],
    veredicto: unVeredicto(),
  });
  assert.deepEqual(miradas.fila.alarmas, []);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7 · LA PRUEBA QUE MÁS VALE
// ═══════════════════════════════════════════════════════════════════════════════

test('UN VEREDICTO HOSTIL, con cada campo mal a la vez, igual deja una fila válida', async () => {
  await borrarTodo();
  /* ══════════════════════════════════════════════════════════════════════════
     TODO ESTE ARCHIVO EXISTE PARA ESTA PRUEBA

     Un veredicto con las once restricciones de la 027 violadas al mismo tiempo:

       · nivel `rojo` sin pedir intervención     → violaría la invariante
       · `criterio` de otro agente               → se descarta al neutro, y el neutro va nulo
       · `sentimiento` inventado                 → nulo, no la palabra inventada
       · `destacado` sin cita                    → los dos nulos
       · `motivo` sin intervención               → nulo, lo exige un `check`
       · `no_auditable_motivo` con auditable     → nulo, lo exige un `check`
       · una observación con etiqueta inventada  → se descarta
       · `resumen` vacío                         → se pone una frase, la columna es `not null`
       · tres hallazgos rotos de tres formas     → los tres se tiran
       · un hallazgo con patrón sucio            → se normaliza y entra

     La base rechazaría CUALQUIERA de esos por separado, y cada rechazo cuesta una inferencia pagada.
     Lo que se afirma acá es que ninguna llega a la base.
     ══════════════════════════════════════════════════════════════════════════ */
  const hostil = {
    auditable: true,
    no_auditable_motivo: 'igual pongo algo acá',
    resumen: '   ',
    intervencion: { requerida: false, motivo: 'un motivo sin intervención' },
    nivel: 'rojo',
    criterio: 'calificacion_saltada',
    destacado: 'Un elogio sin respaldo',
    evidencia: null,
    sentimiento: 'eufórico',
    observaciones: [
      { etiqueta: 'inventada', texto: 'algo', cita: null },
      { etiqueta: 'ritmo', texto: 'La conversación se cortó enseguida.', cita: null },
      { etiqueta: 'contexto', texto: '  ', cita: null },
    ],
    hallazgos: [
      unHallazgo({ patron: '###' }),
      unHallazgo({ patron: 'sin_evidencia', evidencia_agente: '' }),
      unHallazgo({ patron: 'sin_correccion', correccion: null as unknown as string }),
      unHallazgo({ patron: ' Un Patrón CON Acentos ' }),
    ],
  } as unknown as VeredictoDelModelo;

  const { fila, hallazgos, escrito } = await escribirYLeer({
    ...base,
    contactoId,
    veredicto: hostil,
  });

  // La invariante: nivel derivado del estado real, no del que el modelo dijo.
  assert.equal(fila.intervencion, false);
  assert.equal(fila.nivel, 'amarillo', 'un hallazgo entró, así que amarillo');
  assert.equal(fila.motivo, null, 'el motivo solo va con intervención');
  assert.equal(fila.no_auditable_motivo, null, 'auditable y con motivo de no auditable es imposible');
  assert.equal(fila.criterio, null);
  assert.equal(fila.sentimiento, null);
  assert.equal(fila.destacado, null);
  assert.equal(fila.evidencia, null);
  assert.ok(fila.resumen.trim().length > 0, 'la columna es `not null`');

  // Las observaciones: entra la buena, se van la de etiqueta inventada y la de texto en blanco.
  const obs = fila.observaciones as { etiqueta: string }[];
  assert.equal(obs.length, 1);
  assert.equal(obs[0]?.etiqueta, 'ritmo');

  // Los hallazgos: tres tirados, uno normalizado y escrito.
  assert.equal(hallazgos.length, 1);
  assert.equal(hallazgos[0]?.patron, 'un_patron_con_acentos');
  assert.equal(escrito.descartados.length, 3);
});
