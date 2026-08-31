// Las invariantes del veredicto, CONTRA LA BASE. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTAS RESTRICCIONES SE PRUEBAN CONTRA POSTGRESQL Y NO LEYENDO EL SQL
//
// Porque lo que se afirma no es que el texto del `check` esté escrito: es que **el estado inválido sea
// inescribible**. Un `check` con un paréntesis mal puesto, o uno que devuelve `null` donde se esperaba
// `false`, se lee igual de bien y **no rechaza nada**.
//
// El caso concreto está en la migración 027: `(nivel = 'rojo') = intervencion` parece correcto y tiene
// un agujero — con el nivel nulo devuelve `null`, y **un `check` que devuelve nulo PASA**. O sea que un
// análisis sin veredicto podría pedir una intervención. El `coalesce` lo cierra, y la única forma de
// saber que lo cierra es intentar la escritura.
//
// ── Y POR QUÉ IMPORTA TANTO ─────────────────────────────────────────────────
//
// El nivel **se deriva en código**, así que en el camino feliz estas restricciones nunca disparan. Su
// trabajo es el otro: que el día que alguien escriba un `insert` a mano —una corrección, una
// migración de datos, un guion de respaldo— el estado inválido no entre.
//
// El precio también hay que decirlo: cada restricción es una forma de **perder una inferencia ya
// pagada**. Son seis y no doce a propósito.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { limpiar, montar, unContacto, type Escenario } from '../apoyo/closer.ts';
import {
  AGENTES,
  CATEGORIAS,
  NIVELES,
  SENTIMIENTOS,
  SEVERIDADES,
} from '../../lib/auditor/veredicto.ts';

let esc: Escenario;
/** El contacto sobre el que se intentan todas las escrituras. */
let contactoId: string;

before(async () => {
  esc = await montar('Veredicto');
  const k = await unContacto(esc, { territorio: 'closer', nombre: 'Veredicto' });
  contactoId = k.id;
});
after(async () => {
  await esc.admin.query('delete from negocio.analisis_del_agente where contacto_id = $1', [
    contactoId,
  ]);
  await limpiar(esc);
  await cerrarTodo();
  await cerrarClientes();
});

/** Los campos que un análisis necesita para existir, con los valores que no están bajo prueba. */
interface Analisis {
  agente?: string;
  auditable?: boolean;
  no_auditable_motivo?: string | null;
  intervencion?: boolean;
  motivo?: string | null;
  criterio?: string | null;
  nivel?: string | null;
  resumen?: string;
  destacado?: string | null;
  evidencia?: string | null;
  observaciones?: string | null;
  sentimiento?: string | null;
  disparo?: string;
  alarmas?: string[] | null;
  modelo?: string | null;
  prompt_hash?: string | null;
  mensajes_del_agente?: number;
}

/**
 * Intenta escribir un análisis. Devuelve `null` si entró, o el nombre de la restricción que lo
 * rechazó.
 *
 * **Cada intento es su propia sentencia**, no una transacción compartida: en PostgreSQL un `insert`
 * que viola una restricción aborta la transacción entera, así que con un `begin` de por medio el
 * primer rechazo se llevaría puestos todos los intentos siguientes y la prueba pasaría midiendo uno.
 */
async function intentar(a: Analisis): Promise<string | null> {
  const fila = {
    agente: 'chat_post_agenda',
    auditable: true,
    no_auditable_motivo: null,
    intervencion: false,
    motivo: null,
    criterio: null,
    nivel: 'verde',
    resumen: 'El agente confirmó la cita y respondió las dos preguntas.',
    destacado: null,
    evidencia: null,
    observaciones: null,
    sentimiento: null,
    disparo: 'debounce',
    alarmas: null,
    modelo: 'claude-sonnet-5',
    prompt_hash: null,
    mensajes_del_agente: 5,
    ...a,
  };
  try {
    await esc.admin.query(
      `insert into negocio.analisis_del_agente
         (org_id, contacto_id, agente, auditable, no_auditable_motivo, intervencion, motivo,
          criterio, nivel, resumen, destacado, evidencia, observaciones, sentimiento, disparo,
          alarmas, modelo, prompt_hash, mensajes_del_agente)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        esc.org,
        contactoId,
        fila.agente,
        fila.auditable,
        fila.no_auditable_motivo,
        fila.intervencion,
        fila.motivo,
        fila.criterio,
        fila.nivel,
        fila.resumen,
        fila.destacado,
        fila.evidencia,
        fila.observaciones,
        fila.sentimiento,
        fila.disparo,
        fila.alarmas,
        fila.modelo,
        fila.prompt_hash,
        fila.mensajes_del_agente,
      ],
    );
    return null;
  } catch (e) {
    const err = e as { constraint?: string; message?: string };
    return err.constraint ?? err.message ?? 'rechazo sin nombre';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL BARRIDO DEL NÚCLEO: nivel × intervención × auditable
// ═══════════════════════════════════════════════════════════════════════════════

test('las 16 combinaciones de nivel × intervención × auditable: entran las válidas y solo esas', async () => {
  /* Los tres campos que las dos invariantes principales atan entre sí. Se barren TODAS —cuatro
     niveles contando el nulo, por dos, por dos— y cada una lleva escrito si debe entrar.
   *
   * Se hace exhaustivo porque el espacio es chico y la rama que se olvide va a ser la que deje pasar
   * el estado inválido, sin decirlo. */
  const NIVELES_CON_NULO = [...NIVELES, null];
  let combinaciones = 0;
  const inesperadas: string[] = [];

  for (const nivel of NIVELES_CON_NULO) {
    for (const intervencion of [true, false]) {
      for (const auditable of [true, false]) {
        combinaciones++;

        /* Lo que se espera, escrito y no derivado del código que se está probando:
             · rojo ⟺ intervención  (con el nivel nulo contando como «no rojo»)
             · no auditable ⟹ sin nivel                                              */
        const esRojo = nivel === 'rojo';
        const debeEntrar = esRojo === intervencion && (auditable || nivel === null);

        const rechazo = await intentar({
          nivel,
          intervencion,
          auditable,
          // Los dos campos que otras invariantes atan, puestos coherentes para no mezclar causas.
          no_auditable_motivo: auditable ? null : 'la conversación no tiene ninguna línea del agente',
          motivo: intervencion ? 'el contacto pidió tres veces el link de pago y no lo recibió' : null,
        });

        const entro = rechazo === null;
        if (entro !== debeEntrar) {
          inesperadas.push(
            `nivel=${String(nivel)} intervencion=${intervencion} auditable=${auditable} → ` +
              (entro ? 'ENTRÓ y no debía' : `rechazada por ${rechazo}`),
          );
        }
      }
    }
  }

  assert.equal(combinaciones, 16, 'el barrido dejó de ser exhaustivo');
  assert.deepEqual(inesperadas, [], 'combinaciones que no se comportaron como manda la migración 027');
});

test('el agujero del `check` sin `coalesce`: un análisis SIN NIVEL no puede pedir intervención', async () => {
  /* ── ESTE ES EL CASO QUE JUSTIFICA LA PRUEBA ENTERA ─────────────────────────
   *
   * `(nivel = 'rojo') = intervencion` sin el `coalesce` devuelve `null` cuando el nivel es nulo, y **un
   * `check` que devuelve nulo PASA**. O sea que este `insert` entraría: un análisis sin veredicto que
   * igual manda a un humano a atender la conversación.
   *
   * Y el daño sería silencioso en las dos direcciones: la cola roja mostraría un contacto cuyo
   * análisis no dice nada, y las vitrinas —que cuentan por nivel— no lo verían en ninguna columna.
   *
   * Está aparte del barrido de arriba, que ya lo cubre, porque es el caso cuyo nombre hay que poder
   * leer cuando esta prueba se ponga roja. */
  const rechazo = await intentar({
    nivel: null,
    intervencion: true,
    auditable: true,
    motivo: 'el contacto pidió hablar con una persona',
  });
  assert.equal(
    rechazo,
    'analisis_rojo_es_intervencion',
    'un análisis SIN NIVEL pudo pedir intervención: al `check` le falta el `coalesce`, y un `check` ' +
      'que devuelve nulo pasa',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LAS OTRAS CUATRO INVARIANTES, cada una con su producto
// ═══════════════════════════════════════════════════════════════════════════════

test('no se pueden guardar observaciones sobre un análisis NO AUDITABLE', async () => {
  /* **Observar algo de una conversación que el propio auditor declaró imposible de juzgar es
     juzgarla.** Y los tres estados de la columna son la razón por la que esto es una restricción y no
     una convención: `null` = no se pidieron, `[]` = se pidieron y no hubo ninguna, `[…]` = las que
     hubo. Escribir `[]` sobre un no auditable borraría la diferencia afirmando una medición que nadie
     hizo. */
  const casos: [boolean, string | null, boolean][] = [
    [true, null, true],
    [true, '[]', true],
    [true, '[{"etiqueta":"ritmo","texto":"la conversación se cortó","cita":null}]', true],
    [false, null, true],
    [false, '[]', false],
    [false, '[{"etiqueta":"ritmo","texto":"x","cita":null}]', false],
  ];
  for (const [auditable, observaciones, debeEntrar] of casos) {
    const rechazo = await intentar({
      auditable,
      observaciones,
      nivel: auditable ? 'verde' : null,
      no_auditable_motivo: auditable ? null : 'menos de dos intercambios reales',
    });
    assert.equal(
      rechazo === null,
      debeEntrar,
      `auditable=${auditable} observaciones=${String(observaciones)} → ${String(rechazo)}`,
    );
  }
});

test('el destacado y su evidencia van JUNTOS o no van', async () => {
  /* Un verde MEDIDO y una conversación SIN AUDITAR se veían iguales, y distinguirlos fue toda la razón
     del cambio. Así que el verde tiene una obligación simétrica a la del amarillo: qué hizo bien, y la
     línea exacta del agente que lo demuestra.
   *
   * **Un mérito afirmado sin la línea que lo respalda es peor que un hallazgo sin cita, porque nadie
   * audita un elogio.** Y si de verdad no hay línea citable, los dos quedan vacíos y el nivel sigue
   * siendo verde: no encontrar un elogio no es encontrar una falla. */
  const casos: [string | null, string | null, boolean][] = [
    [null, null, true],
    ['Reformuló la objeción antes de responderla', 'Entiendo, te preocupa el plazo de entrega', true],
    ['Reformuló la objeción antes de responderla', null, false],
    [null, 'Entiendo, te preocupa el plazo de entrega', false],
  ];
  for (const [destacado, evidencia, debeEntrar] of casos) {
    const rechazo = await intentar({ destacado, evidencia });
    assert.equal(
      rechazo === null,
      debeEntrar,
      `destacado=${destacado === null ? 'null' : 'texto'} evidencia=` +
        `${evidencia === null ? 'null' : 'texto'} → ${String(rechazo)}`,
    );
  }
});

test('el motivo es el de la INTERVENCIÓN: sin intervención no hay motivo que dar', async () => {
  const casos: [boolean, string | null, boolean][] = [
    [false, null, true],
    [true, 'el contacto pidió expresamente hablar con una persona', true],
    // Una intervención sin motivo entra: el diseño dice que cuando no hay motivo guardado se dice eso
    // en la cola, en vez de inventar un diagnóstico.
    [true, null, true],
    [false, 'el contacto pidió expresamente hablar con una persona', false],
  ];
  for (const [intervencion, motivo, debeEntrar] of casos) {
    const rechazo = await intentar({
      intervencion,
      motivo,
      nivel: intervencion ? 'rojo' : 'verde',
    });
    assert.equal(
      rechazo === null,
      debeEntrar,
      `intervencion=${intervencion} motivo=${motivo === null ? 'null' : 'texto'} → ${String(rechazo)}`,
    );
  }
});

test('el motivo de NO AUDITABLE existe exactamente cuando no es auditable', async () => {
  /* Al revés que el otro, y es una equivalencia y no una implicación: un no auditable **tiene que**
     decir por qué —«sale con no auditable y su motivo»— y un auditable no puede traerlo, porque sería
     un motivo de algo que no pasó. */
  const casos: [boolean, string | null, boolean][] = [
    [true, null, true],
    [false, 'no hay ninguna línea del agente', true],
    [true, 'no hay ninguna línea del agente', false],
    [false, null, false],
  ];
  for (const [auditable, no_auditable_motivo, debeEntrar] of casos) {
    const rechazo = await intentar({
      auditable,
      no_auditable_motivo,
      nivel: auditable ? 'verde' : null,
    });
    assert.equal(
      rechazo === null,
      debeEntrar,
      `auditable=${auditable} motivo=${no_auditable_motivo === null ? 'null' : 'texto'} → ` +
        String(rechazo),
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LOS VOCABULARIOS: la base y el código dicen lo mismo
// ═══════════════════════════════════════════════════════════════════════════════

test('los vocabularios del código son EXACTAMENTE los que la base acepta', async () => {
  /* ── POR QUÉ SE PRUEBAN LAS DOS DIRECCIONES ────────────────────────────────
   *
   * Un valor que el código conoce y la base rechaza tumba la escritura y **pierde la inferencia**. Un
   * valor que la base acepta y el código no conoce entra a la tabla y **ninguna consulta lo lee**: el
   * síntoma es «el auditor no encontró nada» con la fila ahí, que es peor.
   *
   * Así que se comprueba que cada valor del código entre, y que uno inventado no. */
  for (const agente of AGENTES) {
    assert.equal(await intentar({ agente }), null, `la base rechazó el agente «${agente}»`);
  }
  for (const nivel of NIVELES) {
    const rechazo = await intentar({ nivel, intervencion: nivel === 'rojo', motivo: null });
    assert.equal(rechazo, null, `la base rechazó el nivel «${nivel}»`);
  }
  for (const sentimiento of SENTIMIENTOS) {
    assert.equal(await intentar({ sentimiento }), null, `la base rechazó «${sentimiento}»`);
  }

  // Y lo inventado no entra, en las cuatro columnas con vocabulario.
  assert.ok(await intentar({ agente: 'chat_voz_post_agenda' }), 'entró un agente que no existe');
  assert.ok(await intentar({ nivel: 'naranja' }), 'entró un nivel que no existe');
  assert.ok(await intentar({ sentimiento: 'furioso' }), 'entró un sentimiento que no existe');
  assert.ok(await intentar({ disparo: 'a_mano' }), 'entró un disparo que no existe');
});

test('los vocabularios de HALLAZGOS también, y el formato del patrón lo hace cumplir la base', async () => {
  /* El patrón es el que agrupa los casos: **«×15 casos» en vez de quince problemas sueltos.** Su
     formato lo valida la base y lo normaliza el código, y esa división es deliberada — el esquema de
     salida del modelo NO lleva patrones de texto, porque un código mal escrito rompería la respuesta
     entera en vez de una de sus partes. */
  const analisisId = (
    await esc.admin.query<{ id: string }>(
      `insert into negocio.analisis_del_agente
         (org_id, contacto_id, agente, auditable, intervencion, nivel, resumen, disparo,
          mensajes_del_agente)
       values ($1,$2,'chat_post_agenda',true,false,'amarillo','x','debounce',5) returning id`,
      [esc.org, contactoId],
    )
  ).rows[0]!.id;

  const hallazgo = async (campos: Record<string, unknown>): Promise<string | null> => {
    const f = {
      titulo: 'Promete un financiamiento que no existe',
      patron: 'promete_financiamiento_inexistente',
      agente: 'chat_post_agenda',
      severidad: 'amarillo',
      categoria: 'comportamiento',
      correccion: 'Reemplazá esa línea por: «el financiamiento lo confirma un asesor».',
      evidencia_agente: 'Sí, tenemos financiamiento en 12 cuotas sin interés',
      ...campos,
    };
    try {
      await esc.admin.query(
        `insert into negocio.hallazgos
           (org_id, contacto_id, analisis_id, titulo, patron, agente, severidad, categoria,
            correccion, evidencia_agente)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          esc.org,
          contactoId,
          analisisId,
          f.titulo,
          f.patron,
          f.agente,
          f.severidad,
          f.categoria,
          f.correccion,
          f.evidencia_agente,
        ],
      );
      return null;
    } catch (e) {
      const err = e as { constraint?: string; message?: string };
      return err.constraint ?? err.message ?? 'rechazo sin nombre';
    }
  };

  for (const severidad of SEVERIDADES) {
    assert.equal(await hallazgo({ severidad }), null, `la base rechazó la severidad «${severidad}»`);
  }
  for (const categoria of CATEGORIAS) {
    assert.equal(await hallazgo({ categoria }), null, `la base rechazó la categoría «${categoria}»`);
  }

  // Lo inventado no entra.
  assert.ok(await hallazgo({ severidad: 'critico' }), 'entró una severidad que no existe');
  assert.ok(await hallazgo({ categoria: 'tono' }), 'entró una categoría que no existe');

  /* Y el formato del patrón, con los cinco casos que la normalización del código produce o descarta.
     Que la base los rechace es lo que hace que `normalizarPatron` no pueda equivocarse en silencio. */
  for (const malo of ['ab', 'CON_MAYUSCULAS', 'con espacios', 'con-guion', 'con_acentué', '']) {
    assert.equal(
      await hallazgo({ patron: malo }),
      'hallazgos_patron_check',
      `la base aceptó el patrón «${malo}», que no es una clave de agrupamiento`,
    );
  }
  assert.equal(await hallazgo({ patron: 'a'.repeat(49) }), 'hallazgos_patron_check');
  assert.equal(await hallazgo({ patron: 'a'.repeat(48) }), null, 'el tope de 48 quedó en 47');

  /* Y un hallazgo NO puede existir sin su análisis padre: sin él no tiene el transcript que lo prueba,
     ni el prompt contra el que se juzgó, ni de qué agente es. */
  const huerfano = await hallazgo({});
  assert.equal(huerfano, null);
  await esc.admin.query('delete from negocio.hallazgos where analisis_id = $1', [analisisId]);
  await esc.admin.query('delete from negocio.analisis_del_agente where id = $1', [analisisId]);
});

test('borrar el análisis se lleva sus hallazgos, y borrar el contacto se lleva todo', async () => {
  /* La cascada. Sin ella, un contacto borrado dejaría hallazgos apuntando a la nada y la pantalla del
     técnico contaría casos de conversaciones que ya no existen. */
  const analisisId = (
    await esc.admin.query<{ id: string }>(
      `insert into negocio.analisis_del_agente
         (org_id, contacto_id, agente, auditable, intervencion, nivel, resumen, disparo,
          mensajes_del_agente)
       values ($1,$2,'chat_pre_agenda',true,false,'amarillo','x','alarma',5) returning id`,
      [esc.org, contactoId],
    )
  ).rows[0]!.id;
  await esc.admin.query(
    `insert into negocio.hallazgos
       (org_id, contacto_id, analisis_id, titulo, patron, agente, severidad, categoria, correccion,
        evidencia_agente)
     values ($1,$2,$3,'x','empuja_sin_calificar','chat_pre_agenda','amarillo','comportamiento','y','z')`,
    [esc.org, contactoId, analisisId],
  );

  const cuantos = async (): Promise<number> =>
    Number(
      (
        await esc.admin.query<{ n: string }>(
          'select count(*) as n from negocio.hallazgos where analisis_id = $1',
          [analisisId],
        )
      ).rows[0]!.n,
    );
  assert.equal(await cuantos(), 1);

  await esc.admin.query('delete from negocio.analisis_del_agente where id = $1', [analisisId]);
  assert.equal(await cuantos(), 0, 'borrar el análisis dejó su hallazgo huérfano');
});
