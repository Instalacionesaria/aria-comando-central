// EL CARRIL AMARILLO: una mejora por día y por empresa, EN FRÍO.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE CARRIL NO HACE, Y CADA UNA ES UNA DECISIÓN
//
//   · **No interrumpe a nadie.** No pide intervención, no escribe una nota, no toca el CRM y no apaga
//     ningún agente. Su salida es una fila en la lista del técnico y nada más.
//   · **No cachea.** Corre una vez por día y por empresa sobre una conversación distinta cada vez, así
//     que un caché **jamás acertaría** — y *«un caché que jamás acierta no es una optimización: es un
//     recargo»*: se paga la escritura, nunca se cobra una lectura.
//   · **No genera tarea** ni entra en ninguna cola.
//
// ── POR QUÉ EXISTE, Y ES UNA MEDICIÓN ──────────────────────────────────────
//
// El carril rojo dispara poquísimo: **2 de 40 auditables** en los datos reales del origen, un 5 %. Y
// acá va a disparar menos todavía, porque el agente de pre-agenda **no llega nunca al antirrebote** —
// medido en producción: entre 0 y 3 mensajes por contacto, máximo 3, contra un umbral de 5.
//
// Sin este carril, la pantalla del técnico nace casi vacía y nadie vuelve a mirarla. Y una pantalla
// que nadie mira es una pantalla que no existe, por más correcta que sea.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL TOPE Y EL DESCARTE SE CONSULTAN PRIMERO. ANTES DE MIRAR NADA.
//
// Si el techo del día ya está alcanzado, **todo lo demás es trabajo que no se va a poder escribir**:
// elegir una conversación, cargarla, atribuirla y llamar al modelo, para tirar la respuesta.
//
// Y el tope se cuenta **por criterio, no por severidad**. El carril rojo también produce amarillos, y
// contarlos acá bloquearía este carril con trabajo ajeno — le pasó al origen en su primer ensayo: un
// día con tres hallazgos amarillos del carril rojo dejaba a éste sin correr, y el síntoma era «el
// carril amarillo no anda» sobre un carril que estaba haciendo exactamente lo que se le pidió.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { hashDelPrompt } from './prompts.ts';
import { AGENTE_DEL_TERRITORIO, type Agente } from './veredicto.ts';

/**
 * El criterio de este carril. **Propio, y no uno de los catorce.**
 *
 * Los catorce son de las dos rúbricas y describen fallas; éste describe **una dimensión**: si el
 * agente leyó dónde estaba el lead. No entra a ninguna de las dos listas por dos motivos:
 *
 *   · El esquema del modelo del carril rojo lo ofrecería como una opción más, y ahí compite con
 *     criterios que sí son fallas — el modelo elegiría éste para cosas que son `objecion_no_entendida`.
 *   · Y **el tope se cuenta por este valor**. Compartido con los otros, contaría trabajo ajeno.
 *
 * `hallazgos.criterio` no tiene `check` en la base —se valida en código— así que esto no cuesta una
 * migración de esa columna. La que sí costó es el `disparo`, que es una lista cerrada.
 */
export const CRITERIO_DE_LA_MEJORA = 'contexto_no_leido';

/** El disparo con el que se guarda. Ver la migración 033. */
export const DISPARO_DE_LA_MEJORA = 'mejora';

/**
 * Cuántas mejoras por día y por empresa. **Una.**
 *
 * No es un presupuesto: es lo que hace que la lista del técnico crezca a un ritmo que alguien puede
 * seguir. Diez por día son diez que nadie mira; una por día son cinco por semana, que es una reunión.
 */
export const TOPE_POR_DIA = 1;

/**
 * Los tres peldaños de la dimensión, **y sólo el de abajo se reporta**.
 *
 * ── POR QUÉ TRES Y NO DOS ──────────────────────────────────────────────────
 *
 * El del medio existe para **absorber lo tibio**. Con dos peldaños, todo lo que no está claramente
 * bien cae en el que se reporta, y la lista del técnico se llena de casos discutibles — que es como
 * una lista deja de mirarse.
 *
 * Con tres, el modelo tiene dónde poner lo dudoso sin que eso genere trabajo. La pregunta que el
 * peldaño del medio contesta es *«¿esto es un problema o es que a mí me parece?»*, y la respuesta
 * honesta casi siempre es la segunda.
 */
export const PELDANOS = ['no_leyo', 'leyo_a_medias', 'leyo_y_respondio'] as const;
export type Peldano = (typeof PELDANOS)[number];

/** El único que produce un hallazgo. */
export const PELDANO_QUE_SE_REPORTA: Peldano = 'no_leyo';

export const TEXTO_DEL_PELDANO: Readonly<Record<Peldano, string>> = {
  no_leyo:
    'El agente respondió sin registrar lo que el contacto acababa de decir: siguió su guion sobre ' +
    'otra conversación.',
  leyo_a_medias:
    'El agente registró algo de lo que el contacto dijo, pero respondió en general en vez de a eso. ' +
    'No se reporta: es lo tibio, y llenar la lista de casos discutibles es como deja de mirarse.',
  leyo_y_respondio: 'El agente leyó dónde estaba el contacto y le respondió a eso.',
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LOS DOS GUARDIAS, EN UNA CONSULTA
// ═══════════════════════════════════════════════════════════════════════════════

/** Lo que hay que saber antes de mirar nada. */
export interface AntesDeMirar {
  /** Cuántas mejoras se escribieron HOY, en la zona de la empresa. */
  hoy: number;
  /** `true` = el techo del día ya está alcanzado. **Nada más se consulta.** */
  techoAlcanzado: boolean;
  /**
   * Los `(patrón, agente, hash del prompt)` que ya están abiertos.
   *
   * ── LA VERSIÓN DEL PROMPT ES LO QUE IMPIDE UN SILENCIO PERMANENTE ────────
   *
   * Sin ella, el descarte sería por `(patrón, agente)` y un patrón **arreglado quedaría silenciado
   * para siempre**: alguien corrige el prompt, el agente sigue fallando por otra razón bajo el mismo
   * código, y este carril no lo vuelve a levantar nunca.
   *
   * Con la versión adentro, corregir el prompt **reabre** ese código: si el problema sigue, se reporta
   * de nuevo sobre el texto nuevo, que es donde ahora hay que arreglarlo.
   */
  yaAbiertos: ReadonlySet<string>;
}

/** La clave del descarte. Una función y no un `template` suelto: se arma igual en los dos lados. */
export function claveDelDescarte(
  patron: string,
  agente: string,
  promptHash: string | null,
): string {
  /* El hash nulo entra como una cadena con nombre y no como vacía: «no había prompt» es un estado, y
     con la cadena vacía sería indistinguible de un hash que se perdió. */
  return `${patron}|${agente}|${promptHash ?? 'sin_prompt'}`;
}

/**
 * El tope y el descarte, **antes de mirar nada**. Corre dentro de `conOrganizacion(`.
 *
 * @param zona La zona de la EMPRESA. «Hoy» es el día de la empresa, no el del servidor: con UTC, una
 *   empresa en Lima tendría su tope reiniciado a las 19:00 y podría escribir dos mejoras en su propio
 *   día. Es el mismo borde del día que usan las seis consultas del Closer.
 */
export async function antesDeMirar(zona: string): Promise<AntesDeMirar> {
  const [cuenta, abiertos] = await Promise.all([
    datos()
      .selectFrom('hallazgos')
      .select(({ fn }) => fn.countAll<string>().as('n'))
      .where('criterio', '=', CRITERIO_DE_LA_MEJORA)
      .where(
        'detectado_el',
        '>=',
        sql<Date>`date_trunc('day', timezone(${zona}, now())) at time zone ${zona}`,
      )
      .executeTakeFirst(),

    /* Los abiertos, **de este criterio y de los otros trece**: si el carril rojo ya levantó ese patrón
       sobre ese prompt, este carril no lo repite. Son la misma lista para el técnico, así que
       reportarlo dos veces sería una fila duplicada con dos códigos distintos. */
    datos()
      .selectFrom('hallazgos')
      .select(['patron', 'agente', 'prompt_hash'])
      .where('resuelto_el', 'is', null)
      .execute(),
  ]);

  const hoy = Number(cuenta?.n ?? 0);
  return {
    hoy,
    techoAlcanzado: hoy >= TOPE_POR_DIA,
    yaAbiertos: new Set(
      abiertos.map((h) => claveDelDescarte(h.patron, h.agente, h.prompt_hash)),
    ),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · A QUIÉN MIRAR
// ═══════════════════════════════════════════════════════════════════════════════

/** Cuántos mensajes del agente hacen falta para que haya algo que juzgar. */
export const MINIMO_DE_MENSAJES = 3;

/** El elegido del día. */
export interface ElegidoParaMejorar {
  contactoId: string;
  contacto: string;
  agente: Agente;
  /** Cuántos mensajes del agente tiene. Es lo que lo hizo ganar. */
  mensajesDelAgente: number;
  /** Cuándo lo miró este carril por última vez. `null` = nunca. */
  ultimaMejoraEl: Date | null;
}

/**
 * A quién le toca hoy. **Al que hace más tiempo que este carril no mira.**
 *
 * ── EL ORDEN ES LO ÚNICO QUE HACE QUE ESTO RECORRA LA CUENTA ───────────────
 *
 * Una por día es poquísimo, así que el orden decide si en un mes se miraron treinta conversaciones
 * distintas o la misma treinta veces. `nulls first` pone adelante a las que **nunca** pasaron por acá.
 *
 * Y el desempate es por cantidad de mensajes del agente: entre dos que nunca se miraron, primero la
 * que tiene más material que juzgar. Una conversación de tres mensajes y una de treinta no dan la
 * misma información por el mismo precio.
 *
 * ── POR QUÉ NO SE REUSA `candidatosDecididos` ─────────────────────────────
 *
 * Aquélla aplica el antirrebote, que pregunta *«¿el agente dijo algo NUEVO?»*. Este carril corre **en
 * frío**: mira conversaciones que ya no se mueven, que es justo donde el carril rojo no vuelve a
 * entrar nunca. Con el antirrebote puesto, los dos carriles mirarían exactamente lo mismo.
 */
export async function aQuienMirar(): Promise<ElegidoParaMejorar | null> {
  const fila = await datos()
    .selectFrom('contactos as c')
    .select((eb) => [
      'c.id',
      'c.nombre',
      'c.territorio',
      eb
        .selectFrom('mensajes')
        .whereRef('mensajes.contacto_id', '=', 'c.id')
        .where('mensajes.autor', '=', 'agente')
        .select(({ fn }) => fn.countAll<string>().as('n'))
        .as('mensajes_del_agente'),
      eb
        .selectFrom('analisis_del_agente')
        .whereRef('analisis_del_agente.contacto_id', '=', 'c.id')
        .where('analisis_del_agente.disparo', '=', DISPARO_DE_LA_MEJORA)
        .select(({ fn }) => fn.max('analisis_del_agente.analizado_el').as('ultima'))
        .as('ultima_mejora_el'),
    ])
    .where('c.territorio', 'is not', null)
    /* El mínimo va en SQL y no en el bucle: sin él, la consulta ordena por «el que nunca se miró» y el
       ganador sería casi siempre un contacto con cero mensajes del agente — o sea que este carril
       gastaría todos los días en conversaciones donde no hay nada que leer. */
    .having(
      sql<boolean>`(select count(*) from negocio.mensajes m
                     where m.org_id = c.org_id and m.contacto_id = c.id and m.autor = 'agente')
                   >= ${MINIMO_DE_MENSAJES}`,
    )
    .groupBy(['c.id', 'c.nombre', 'c.territorio', 'c.org_id'])
    .orderBy(
      sql`(select max(a.analizado_el) from negocio.analisis_del_agente a
             where a.org_id = c.org_id and a.contacto_id = c.id
               and a.disparo = ${DISPARO_DE_LA_MEJORA}) asc nulls first`,
    )
    .orderBy(
      sql`(select count(*) from negocio.mensajes m
             where m.org_id = c.org_id and m.contacto_id = c.id and m.autor = 'agente') desc`,
    )
    // El desempate final, para que dos corridas con los mismos datos elijan al mismo.
    .orderBy('c.id')
    .limit(1)
    .executeTakeFirst();

  if (fila === undefined || fila.territorio === null) return null;
  return {
    contactoId: fila.id,
    contacto: fila.nombre,
    /* ── EL `Record`, Y DOS GUARDIAS LO ATRAPARON A LA VEZ ──────────────────
     *
     * Acá había un `territorio === 'closer' ? … : …`, y saltaron **dos** pruebas sobre la misma
     * línea: `ADR-0302` —ninguna comparación con un nombre de rol— y la que exige que los nombres de
     * los agentes se declaren una sola vez.
     *
     * Las dos tienen razón y por motivos distintos. El ternario **no compila mal** el día que aparezca
     * un tercer territorio: manda todo lo que no sea `closer` a pre-agenda, en silencio. Y era la
     * cuarta copia de un mapeo que ya vive en `AGENTE_DEL_TERRITORIO`, que es el defecto que la
     * plataforma anterior pagó con sus patrones de voz. */
    agente: AGENTE_DEL_TERRITORIO[fila.territorio],
    mensajesDelAgente: Number(fila.mensajes_del_agente),
    ultimaMejoraEl: fila.ultima_mejora_el,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LA DIMENSIÓN, QUE ES SU PROPIO PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

/** El nombre de la herramienta de este carril. Distinta de la del veredicto: otra forma, otra salida. */
export const NOMBRE_DE_LA_HERRAMIENTA_DE_MEJORA = 'registrar_mejora';

/**
 * El esquema de la mejora. **Mucho más chico que el del veredicto, y a propósito.**
 *
 * Este carril contesta UNA pregunta. Un esquema con quince campos invita al modelo a llenarlos, y lo
 * que sale de ahí no es más información: es la misma respuesta repartida en quince redacciones — que
 * después hay que decidir cuál gana.
 */
export function esquemaDeLaMejora(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['peldano', 'patron', 'titulo', 'diagnostico', 'correccion', 'evidencia_agente', 'evidencia_contacto'],
    properties: {
      peldano: {
        type: 'string',
        enum: [...PELDANOS],
        description:
          'no_leyo = respondió sin registrar lo que el contacto acababa de decir; siguió su guion ' +
          'sobre otra conversación. leyo_a_medias = registró algo pero respondió en general en vez de ' +
          'a eso. leyo_y_respondio = leyó dónde estaba el contacto y le respondió a eso. ' +
          'ANTE LA DUDA, `leyo_a_medias`: ese peldaño existe para lo tibio, y no genera trabajo.',
      },
      patron: {
        type: 'string',
        description:
          'El código del patrón: minúsculas, guiones bajos, sin acentos ni espacios. Describe LA ' +
          'FALLA y no la conversación. Si es el mismo problema que uno de los patrones ya detectados, ' +
          'REUSÁ ESE CÓDIGO EXACTO.',
      },
      titulo: { type: 'string', description: 'El patrón en lenguaje humano, SEIS PALABRAS O MENOS.' },
      diagnostico: {
        type: 'string',
        description: 'Qué está fallando y por qué, en dos o tres frases.',
      },
      correccion: {
        type: 'string',
        description:
          'La instrucción para el prompt, lista para pegar. Arregla EL PATRÓN, no el caso: no ' +
          'menciones al contacto ni cites esta conversación acá adentro.',
      },
      evidencia_agente: {
        type: 'string',
        description:
          'La línea EXACTA Y LITERAL del AGENTE IA que lo prueba, copiada del transcript. ' +
          'Obligatoria: sin ella no hay nada que reportar.',
      },
      evidencia_contacto: {
        type: ['string', 'null'],
        description: 'La línea del contacto que el agente no leyó. null si no aplica.',
      },
    },
  };
}

/** Lo que el modelo devuelve. */
export interface MejoraDelModelo {
  peldano: string;
  patron: string;
  titulo: string;
  diagnostico: string;
  correccion: string;
  evidencia_agente: string;
  evidencia_contacto: string | null;
}

/**
 * El prompt de este carril. **Una sola pregunta, y su escala.**
 *
 * ── POR QUÉ NO REUSA LA RÚBRICA DE CATORCE CRITERIOS ──────────────────────
 *
 * Porque no está buscando una falla: está midiendo **una dimensión**. Con la rúbrica puesta, el modelo
 * elegiría entre catorce criterios que describen incumplimientos y devolvería el más parecido — y lo
 * que este carril quiere no es «cuál de estos catorce incumplió» sino «¿leyó dónde estaba el lead?».
 *
 * Y la regla de atribución sí se comparte, porque es la que no puede divergir: se reusa el mismo molde
 * de `rubrica.ts` para el bloque de las etiquetas del transcript.
 */
export function instruccionesDeLaMejora(de: {
  agente: Agente;
  mision: string;
  comoLeerElTranscript: string;
  promptDelAgente: string | null;
}): string {
  const prompt =
    de.promptDelAgente === null || de.promptDelAgente.trim() === ''
      ? 'EL PROMPT DE ESTE AGENTE NO ESTÁ CARGADO. Se puede juzgar igual —lo que hizo el agente está ' +
        'en el transcript— y la corrección sale como una instrucción autónoma para agregar.'
      : `EL PROMPT DE ESTE AGENTE:\n\n<<<PROMPT\n${de.promptDelAgente.trim()}\nPROMPT>>>`;

  return [
    'Estás mirando una conversación en frío, para encontrar UNA mejora concreta del prompt de un ' +
      'agente automático. No es una auditoría: no busques fallas, contestá una sola pregunta.',

    de.comoLeerElTranscript,

    `LA MISIÓN DEL AGENTE (${de.agente}):\n${de.mision}`,

    prompt,

    /* LA PREGUNTA, sola y en una línea. Es lo único que separa este carril de una segunda auditoría
       más barata — y una segunda auditoría más barata es exactamente lo que no hace falta. */
    'LA ÚNICA PREGUNTA:\n\n' +
      '  **¿El agente leyó DÓNDE ESTABA EL CONTACTO y le respondió a eso?**\n\n' +
      'No «¿fue amable?», no «¿siguió el guion?», no «¿cerró la venta?». Solo eso: si lo que el ' +
      'contacto dejó ver —su duda, su objeción, su situación, en qué punto está— aparece o no en lo ' +
      'que el agente le contestó después.',

    'LOS TRES PELDAÑOS:\n' +
      PELDANOS.map((p) => `  · ${p} — ${TEXTO_DEL_PELDANO[p]}`).join('\n') +
      '\n\nANTE LA DUDA, `leyo_a_medias`. Ese peldaño existe justamente para lo tibio: **no genera ' +
      'trabajo**, y empujar lo dudoso al de abajo llena la lista del técnico de casos discutibles — ' +
      'que es como una lista deja de mirarse.',

    'Y una sola mejora, la más clara. No enumeres todo lo que se podría mejorar: esto se lee una vez ' +
      'por día y lo que se pide es lo que vale la pena arreglar hoy.',
  ].join('\n\n════════════════════════════════════════\n\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · QUÉ SE ESCRIBE
// ═══════════════════════════════════════════════════════════════════════════════

/** Por qué una mejora no se escribió. **Los cuatro son normales.** */
export type PorQueNoHayMejora =
  /** El techo del día ya estaba alcanzado. */
  | 'techo_del_dia'
  /** No hay ninguna conversación con material suficiente. */
  | 'sin_candidato'
  /** El modelo la puso en uno de los dos peldaños que no se reportan. */
  | 'no_es_para_reportar'
  /** Ese patrón ya está abierto sobre esta versión del prompt. */
  | 'ya_estaba_abierto'
  /** El código de patrón no sobrevivió a la normalización. */
  | 'patron_invalido';

export const TEXTO_DE_POR_QUE_NO: Readonly<Record<PorQueNoHayMejora, string>> = {
  techo_del_dia: `Ya se escribió la mejora de hoy (el tope es ${TOPE_POR_DIA} por día).`,
  sin_candidato: `Ninguna conversación tiene al menos ${MINIMO_DE_MENSAJES} mensajes del agente.`,
  no_es_para_reportar: 'El agente leyó el contexto, o lo leyó a medias: no hay nada que reportar.',
  ya_estaba_abierto: 'Ese patrón ya está abierto sobre esta versión del prompt.',
  patron_invalido: 'El código de patrón que devolvió el modelo no tiene un formato usable.',
};

/** Lo que la corrida en seco dice, sin llamar al modelo ni escribir nada. */
export interface MejoraEnSeco {
  /** `null` = hay a quién mirar y el techo no está alcanzado. */
  porQueNo: PorQueNoHayMejora | null;
  hoy: number;
  /** Cuántos códigos ya están abiertos sobre este prompt. Es lo que el cierre de la etapa pide ver. */
  yaAbiertos: number;
  elegido: ElegidoParaMejorar | null;
}

/**
 * La corrida en seco: a quién elegiría, con qué agente, y cuántos códigos ya están abiertos.
 *
 * **No llama al modelo y no escribe nada.** Es lo que permite ver el camino de decisión completo antes
 * de encender un carril que gasta todos los días.
 */
export async function mejoraEnSeco(zona: string): Promise<MejoraEnSeco> {
  const antes = await antesDeMirar(zona);
  if (antes.techoAlcanzado) {
    /* Se corta ANTES de elegir, igual que el camino real: si el techo está alcanzado, elegir un
       candidato produciría un reporte con un nombre adentro que después no se va a mirar. */
    return { porQueNo: 'techo_del_dia', hoy: antes.hoy, yaAbiertos: antes.yaAbiertos.size, elegido: null };
  }

  const elegido = await aQuienMirar();
  return {
    porQueNo: elegido === null ? 'sin_candidato' : null,
    hoy: antes.hoy,
    yaAbiertos: antes.yaAbiertos.size,
    elegido,
  };
}

/** El hash del prompt de un agente, o `null`. Recalculado del texto, nunca leído de la columna. */
export function hashDelPromptDelAgente(texto: string | null): string | null {
  return texto === null || texto.trim() === '' ? null : hashDelPrompt(texto);
}
