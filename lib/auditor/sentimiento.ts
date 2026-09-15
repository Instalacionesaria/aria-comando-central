// Cómo estaba el contacto en las conversaciones que el auditor juzgó. **El §9.7 y el §10.7.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA COLUMNA SE ESCRIBÍA EN CADA ANÁLISIS Y NO LA LEÍA NADIE
//
// `analisis_del_agente.sentimiento` la escribe `lib/auditor/escritura.ts` desde que el módulo
// existe, y ningún consumidor la seleccionaba: ni `TarjetaDelAgente`, ni `CasoDelPatron`, ni
// `ConversacionAuditada`, ni el endpoint, ni un componente. Era una columna de sólo escritura, con
// tres secciones del documento pidiéndola como cifra del departamento.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DENOMINADOR: TRES POBLACIONES DISTINTAS SE VEN IGUAL EN ESA COLUMNA
//
// `sentimiento is null` significa hoy una de tres cosas, y la columna sola no las separa. Censo
// completo el 2026-09-14:
//
//     auditable, disparo <> mejora    20 filas   ← las ÚNICAS que producen sentimiento
//     auditable, disparo = mejora     14 filas   ← el carril de mejora escribe null a propósito
//     no auditable                    12 filas   ← nunca se llamó al modelo
//
// Un cuarto caso existe y hoy tiene cero filas: que el modelo conteste algo fuera del vocabulario y
// `deLaLista` lo guarde en null. Ése sí sería un defecto, y hoy es indistinguible del segundo.
//
// Sobre las 46 filas la distribución diría «43 % sin dato», que es una afirmación sobre las
// conversaciones y en realidad es una sobre los carriles del propio auditor. Por eso el denominador
// son las 20, y la cifra viaja con él al lado.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES EL SENTIMIENTO DE LA CONVERSACIÓN, NO DEL CONTACTO
//
// La rúbrica dice «el sentimiento DEL CONTACTO, no del agente», y eso contrasta con **a quién se le
// atribuye**, no con a quién le pertenece la etiqueta. Tres cosas del diseño lo fijan:
//
//   · la fila es por `(contacto, agente, analizado_el)` y no por contacto: no hay unicidad;
//   · el transcript puede llegar RECORTADO a las últimas 40 líneas, así que el modelo etiqueta un
//     tramo y no una historia;
//   · el antirrebote garantiza re-auditorías, y medido hay 3 contactos con dos análisis — en dos de
//     ellos el primero trae sentimiento y el segundo, del carril de mejora, trae null.
//
// **Consecuencia para la pantalla:** esto se rotula como «así estaban las conversaciones juzgadas en
// los últimos N días», nunca como una insignia junto al nombre de una persona. Lo segundo convertiría
// un tramo de chat en un atributo permanente de alguien.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { DIAS_DE_LA_TASA, PISO_DE_UNA_TASA } from '../negocio/indicadoresDeCitas.ts';
import { AGENTES, SENTIMIENTOS, type Agente, type Sentimiento } from './veredicto.ts';
import { NOMBRE_DEL_AGENTE } from './vista.ts';

export interface SentimientoDelFlujo {
  dias: number;
  /** Análisis con veredicto en la ventana. **Es el denominador y viaja siempre.** */
  juzgadas: number;
  /** Cuántas de cada valor del vocabulario. Las tres claves están siempre presentes. */
  porValor: Readonly<Record<Sentimiento, number>>;
  /**
   * Qué proporción quedó `molesto`. `null` por debajo del piso.
   *
   * Se publica **el molesto y no el positivo** porque es el accionable: un contacto molesto es una
   * conversación que alguien tiene que mirar, y un positivo no pide nada. Con las tres barras al
   * lado, la que decide qué hacer se pierde entre dos que no.
   */
  molestos: number | null;
  aviso: string | null;
}

/** Las tres claves en cero, para que el conteo no dependa de qué vino de la base. */
function enCero(): Record<Sentimiento, number> {
  return { positivo: 0, neutral: 0, molesto: 0 };
}

/**
 * El sentimiento de un agente. **Corre dentro de `conOrganizacion(`.**
 *
 * Por agente y no por empresa: son dos conversaciones distintas —pre-agenda y post-agenda— y
 * mezclarlas daría un promedio que no describe a ninguna. Y hay un motivo medido además: hoy
 * `chat_pre_agenda` tiene 5 análisis y **los 5 son no auditables**, así que su tarjeta tiene que
 * decir «todavía no hay ninguna conversación juzgable de este agente» y no «0 % molestos».
 */
export async function sentimientoDelFlujo(
  agente: Agente,
  dias = DIAS_DE_LA_TASA,
): Promise<SentimientoDelFlujo> {
  const filas = await datos()
    .selectFrom('analisis_del_agente')
    .select(['sentimiento', sql<number>`count(*)`.as('n')])
    .where('agente', '=', agente)
    /* Las dos condiciones del denominador, juntas y explícitas. `auditable` sola dejaría entrar al
       carril de mejora, que escribe `sentimiento: null` a propósito: 14 de 34 filas auditables. */
    .where('auditable', '=', true)
    .where('disparo', '!=', 'mejora')
    .where(sql<boolean>`analizado_el >= now() - make_interval(days => ${dias})`)
    .groupBy('sentimiento')
    .execute();

  const porValor = enCero();
  let juzgadas = 0;
  let fueraDelVocabulario = 0;

  for (const f of filas) {
    const n = Number(f.n ?? 0);
    juzgadas += n;
    const v = f.sentimiento as Sentimiento | null;
    /* ── UN NULO ACÁ SÍ ES UN DEFECTO, Y POR ESO SE CUENTA APARTE ──────────
     *
     * Los otros dos nulos de esta columna ya quedaron afuera por los dos `where`. El que llegue
     * hasta acá sólo puede ser el cuarto caso: el modelo contestó algo que no está en el
     * vocabulario y `deLaLista` lo guardó en null. Hoy son cero filas.
     *
     * Sumarlo al denominador bajaría las tres proporciones sin que nadie sepa por qué; ignorarlo
     * lo haría invisible el día que el modelo empiece a contestar otra cosa. Se cuenta y se avisa. */
    if (v === null || !SENTIMIENTOS.includes(v)) {
      fueraDelVocabulario += n;
      continue;
    }
    porValor[v] += n;
  }

  const conVocabulario = juzgadas - fueraDelVocabulario;

  return {
    dias,
    juzgadas,
    porValor,
    molestos:
      conVocabulario < PISO_DE_UNA_TASA
        ? null
        : Math.round((porValor.molesto / conVocabulario) * 1000) / 10,
    aviso: avisoDe(juzgadas, conVocabulario, fueraDelVocabulario, dias),
  };
}

/**
 * Qué advertir, y **por qué el primero importa más que la cifra**.
 *
 * Con cero conversaciones juzgadas, una tarjeta vacía se lee como «ningún contacto está molesto».
 * Es el caso real de `chat_pre_agenda` hoy: 5 análisis, los 5 no auditables, y la razón —no hay
 * líneas del agente, o hay menos de dos intercambios— no es que los leads estén contentos.
 *
 * Y el ritmo obliga al segundo aviso. Medido: **~1,3 veredictos por día**, y el pico fue la siembra
 * del 2026-09-01 con 10. Cuando ese día salga de la ventana el denominador cae de 20 a ~11, así que
 * esta cifra va a cruzar el piso hacia abajo sola. El aviso tiene que explicarlo cuando pase, o se
 * va a leer como que el auditor dejó de funcionar.
 */
function avisoDe(
  juzgadas: number,
  conVocabulario: number,
  fueraDelVocabulario: number,
  dias: number,
): string | null {
  const partes: string[] = [];

  if (juzgadas === 0) {
    return `Este agente todavía no tiene ninguna conversación juzgable en ${dias} días. No es que ` +
      'los contactos estén conformes: es que no hubo suficientes intercambios suyos para auditar.';
  }
  if (conVocabulario < PISO_DE_UNA_TASA) {
    partes.push(
      `Con ${conVocabulario} conversación(es) juzgadas no se muestra una proporción: el auditor ` +
        'produce alrededor de un veredicto por día, así que este número se mueve mucho de un día ' +
        'al otro sin que cambie nada del negocio.',
    );
  }
  if (fueraDelVocabulario > 0) {
    partes.push(
      `${fueraDelVocabulario} análisis tienen un sentimiento que no está en el vocabulario y no ` +
        'entran. Eso no debería pasar: significa que el modelo contestó algo distinto de positivo, ' +
        'neutral o molesto.',
    );
  }
  return partes.length === 0 ? null : partes.join(' ');
}

/**
 * El sentimiento de **todos** los agentes, con la clave de su pestaña.
 *
 * ── POR QUÉ ESTO EXISTE Y LA RUTA NO LLAMA DOS VECES ───────────────────────
 *
 * Porque escribir `'chat_pre_agenda'` en la ruta sería escribir el nombre de un agente a mano, y
 * eso está prohibido con un motivo caro escrito en `114-derivacion-del-nivel`: en la plataforma
 * anterior la base aceptaba cuatro agentes y el código validaba contra una lista de dos, así que
 * los patrones de voz **no se podían cerrar ni medir su reincidencia**. La regla es que el
 * vocabulario se declara una vez.
 *
 * La clave de la pestaña sale de `NOMBRE_DEL_AGENTE` en minúscula —`LeadFlow` → `leadflow`— que es
 * la misma derivación que ya usa la pantalla para rotularlas. Un agente nuevo aparece solo, con su
 * pestaña, sin tocar este archivo.
 */
export async function sentimientoPorFlujo(
  dias = DIAS_DE_LA_TASA,
): Promise<Record<string, SentimientoDelFlujo>> {
  const pares = await Promise.all(
    AGENTES.map(async (a) => [
      NOMBRE_DEL_AGENTE[a].toLowerCase(),
      await sentimientoDelFlujo(a, dias),
    ] as const),
  );
  return Object.fromEntries(pares);
}
