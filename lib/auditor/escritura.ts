// EL ESCRITOR del análisis y sus hallazgos. **Todo lo de acá existe para no perder una inferencia
// que ya se pagó.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// CADA NORMALIZACIÓN DE ESTE ARCHIVO ES UNA RESTRICCIÓN DE LA BASE, VISTA DESDE ACÁ
//
// La migración 027 le puso seis `check` a `analisis_del_agente` y cinco a `hallazgos`, y todos hacen
// lo mismo: **abortan la escritura**. Eso es exactamente lo que se quiere de una restricción —el
// estado inválido es inescribible— y es también el peor final posible para este módulo, porque cuando
// la escritura aborta **el análisis se pierde entero con el dinero ya gastado**.
//
// Así que la política es asimétrica a propósito:
//
//   · **La base rechaza.** Es la red, y no se toca.
//   · **Este archivo CORRIGE.** Un modelo que devuelve «amarillo» con intervención, un código de
//     patrón con un guion, un destacado sin su cita: nada de eso tumba la escritura. Se arregla y se
//     guarda.
//
// Y cuando algo no se puede corregir, **se descarta lo más chico**: un hallazgo con el patrón roto se
// tira, y el análisis entra igual con los otros dos. Tirar un hallazgo es mejor que tirar un análisis.
//
// ── LA TRANSACCIÓN YA ESTÁ ABIERTA, Y ESO NO ES CASUALIDAD ──────────────────
//
// `conOrganizacion(` abre una transacción y `datos()` devuelve esa transacción, así que el análisis y
// sus hallazgos entran o no entran **juntos**. Un hallazgo colgado de un análisis que no existe
// violaría su clave foránea, y un análisis con dos de sus tres hallazgos sería un veredicto que dice
// una cosa y una pantalla que muestra otra.
// ═══════════════════════════════════════════════════════════════════════════════

import { datos } from '../datos/contexto.ts';
import type { VeredictoDelModelo } from './esquema.ts';
import { MOTIVOS_DE_NO_AUDITABLE, type HechosDeLaConversacion, type PorQueNoSeAudita } from './transcripcion.ts';
import {
  CATEGORIAS,
  CRITERIOS_DEL_AGENTE,
  ETIQUETAS_DE_OBSERVACION,
  SENTIMIENTOS,
  SEVERIDADES,
  SIN_CRITERIO,
  TOPE_DE_HALLAZGOS,
  criterioValido,
  nivelDerivado,
  normalizarPatron,
  type Agente,
  type Nivel,
} from './veredicto.ts';

/** Lo que todo análisis lleva, venga del modelo o de la precondición. */
interface Comun {
  contactoId: string;
  agente: Agente;
  disparo: 'debounce' | 'alarma' | 'manual' | 'siembra';
  /** `null` = el antirrebote alcanzó y nadie miró las señales. Ver `lib/auditor/portones.ts`. */
  alarmas: readonly string[] | null;
  /** La línea base del próximo antirrebote. **Sin esto el contacto se re-audita para siempre.** */
  mensajesDelAgente: number;
}

/** Un análisis que el modelo produjo. */
export interface AnalisisConVeredicto extends Comun {
  tipo: 'veredicto';
  veredicto: VeredictoDelModelo;
  /** El modelo REAL con el que se juzgó. Si mañana cambia, esto sigue diciendo con qué se produjo. */
  modelo: string;
  /** Qué versión del prompt vio. `null` = esa empresa no tenía prompt cargado. */
  promptHash: string | null;
}

/**
 * Un análisis que **no llegó al modelo**: la precondición lo cortó antes.
 *
 * ── POR QUÉ SE ESCRIBE UNA FILA SI NO SE JUZGÓ NADA ────────────────────────
 *
 * Por dos motivos, y el segundo es el que decide:
 *
 *   1 · La pantalla del técnico tiene que poder listar las conversaciones **no auditables**. Sin fila,
 *       «no se auditó» y «no existe» se ven iguales — que es el defecto que este módulo entero viene
 *       arreglando en otras cuatro formas.
 *   2 · **Mueve la línea base del antirrebote.** Sin fila, cada corrida del barrido vuelve a cargar
 *       los mensajes de esa conversación, los atribuye, y vuelve a decidir que no se puede juzgar.
 *       No gasta en el modelo, pero gasta en la base cada diez minutos y para siempre.
 */
export interface AnalisisNoAuditable extends Comun {
  tipo: 'no_auditable';
  porque: PorQueNoSeAudita;
  /** Los hechos medidos. Es de donde sale el resumen: **descripción, no juicio.** */
  hechos: HechosDeLaConversacion;
}

export type AnalisisParaEscribir = AnalisisConVeredicto | AnalisisNoAuditable;

/** Lo que quedó escrito. */
export interface LoEscrito {
  analisisId: string;
  nivel: Nivel | null;
  intervencion: boolean;
  /** Cuántos hallazgos entraron **después** de descartar los inválidos y de aplicar el tope. */
  hallazgos: number;
  /** Cuántos se descartaron, y por qué. Vacío es lo normal. */
  descartados: readonly string[];
}

/**
 * El resumen de una conversación que no se pudo juzgar. **Se arma de los hechos, no del modelo.**
 *
 * El resumen se escribe siempre, y cuando no hay veredicto es *lo único que se puede decir*. Dejarlo
 * en una frase fija —«no auditable»— haría que la pantalla del técnico mostrara veinte filas
 * idénticas; con los hechos adentro, cada una dice qué pasó de verdad.
 *
 * Y es **descripción, no juicio**: cuenta cuántos mensajes hubo de cada lado. No dice que el agente
 * hizo algo mal, porque nadie lo juzgó.
 */
function resumenDeLoNoAuditable(porque: PorQueNoSeAudita, h: HechosDeLaConversacion): string {
  const delContacto = h.porAutor['CONTACTO'];
  const delAgente = h.porAutor['AGENTE IA'];
  const sinTexto = h.sinTexto === 0 ? '' : `, ${h.sinTexto} sin texto`;
  return (
    `${delContacto} mensajes del contacto y ${delAgente} del agente${sinTexto}. ` +
    MOTIVOS_DE_NO_AUDITABLE[porque]
  );
}

/** Un valor del modelo, acotado a su vocabulario. Fuera de la lista **se guarda nulo, no se inventa**. */
function deLaLista(valor: string | null | undefined, lista: readonly string[]): string | null {
  if (typeof valor !== 'string') return null;
  const v = valor.trim().toLowerCase();
  return lista.includes(v) ? v : null;
}

/** Un texto del modelo, o `null` si vino vacío. Una cadena en blanco no es un dato. */
function texto(valor: string | null | undefined): string | null {
  if (typeof valor !== 'string') return null;
  const t = valor.trim();
  return t === '' ? null : t;
}

/**
 * Escribe el análisis y sus hallazgos. **Corre DENTRO de `conOrganizacion(`**, en su transacción.
 *
 * Devuelve lo que quedó escrito, incluidos los hallazgos descartados: un descarte silencioso haría
 * que «el modelo encontró uno» y «el modelo encontró tres y dos estaban rotos» se vieran iguales.
 */
export async function escribirAnalisis(a: AnalisisParaEscribir): Promise<LoEscrito> {
  const descartados: string[] = [];

  // ── EL CAMINO SIN VEREDICTO ───────────────────────────────────────────────
  if (a.tipo === 'no_auditable') {
    const fila = await datos()
      .insertInto('analisis_del_agente')
      .values({
        contacto_id: a.contactoId,
        agente: a.agente,
        auditable: false,
        no_auditable_motivo: MOTIVOS_DE_NO_AUDITABLE[a.porque],
        /* Los cuatro que el `check` de la 027 exige nulos cuando no es auditable, escritos explícitos
           y no omitidos: omitirlos dejaría que un `default` futuro los llenara sin que nada avisara. */
        intervencion: false,
        motivo: null,
        criterio: null,
        nivel: null,
        observaciones: null,
        resumen: resumenDeLoNoAuditable(a.porque, a.hechos),
        destacado: null,
        evidencia: null,
        sentimiento: null,
        disparo: a.disparo,
        alarmas: a.alarmas === null ? null : [...a.alarmas],
        // Nulos porque **no se llamó al modelo**. Un nombre de modelo acá sería decir que se juzgó.
        modelo: null,
        prompt_hash: null,
        mensajes_del_agente: a.mensajesDelAgente,
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();

    return { analisisId: fila.id, nivel: null, intervencion: false, hallazgos: 0, descartados };
  }

  // ── EL CAMINO CON VEREDICTO ───────────────────────────────────────────────
  const v = a.veredicto;

  /* La intervención sale del objeto anidado, y **se fuerza a falso si no es auditable**. El modelo no
     debería pedir intervención sobre algo que él mismo declaró imposible de juzgar, pero si lo hace,
     el `check` de la base tumbaría la escritura entera. */
  const auditable = v.auditable === true;
  const intervencion = auditable && v.intervencion?.requerida === true;

  /* ── LOS HALLAZGOS: SE FILTRAN ANTES DE DERIVAR EL NIVEL ──────────────────
   *
   * El orden importa. El nivel depende de CUÁNTOS hallazgos quedaron, así que derivarlo antes del
   * filtro produciría un «amarillo» con cero hallazgos — una fila que la pantalla del técnico muestra
   * sin nada que ajustar, y que el encabezado de `veredicto.ts` describe como el defecto medido de
   * una redacción vieja de la rúbrica.
   *
   * Y el corte por el tope va acá y no en el esquema del modelo: un máximo en el esquema hace que el
   * modelo TRUNQUE en vez de elegir. */
  const crudos = auditable && Array.isArray(v.hallazgos) ? v.hallazgos : [];
  const buenos: { patron: string; h: (typeof crudos)[number] }[] = [];
  for (const h of crudos) {
    const patron = normalizarPatron(h?.patron);
    if (patron === null) {
      /* Se descarta EL HALLAZGO, no el análisis. El formato lo hace cumplir un `check`, así que un
         código roto tumbaría la escritura entera y se perdería todo lo demás que el veredicto traía. */
      descartados.push(`patrón inválido: ${JSON.stringify(h?.patron ?? null)}`);
      continue;
    }
    // Los tres obligatorios de la base. Sin cita, el hallazgo **no existe**; sin corrección, es un reclamo.
    if (texto(h?.evidencia_agente) === null) {
      descartados.push(`${patron}: sin la línea del agente que lo prueba`);
      continue;
    }
    if (texto(h?.correccion) === null) {
      descartados.push(`${patron}: sin corrección`);
      continue;
    }
    if (texto(h?.titulo) === null) {
      descartados.push(`${patron}: sin título`);
      continue;
    }
    buenos.push({ patron, h });
  }
  if (buenos.length > TOPE_DE_HALLAZGOS) {
    descartados.push(`${buenos.length - TOPE_DE_HALLAZGOS} por encima del tope de ${TOPE_DE_HALLAZGOS}`);
  }
  const aEscribir = buenos.slice(0, TOPE_DE_HALLAZGOS);

  const nivel = nivelDerivado({
    auditable,
    intervencion,
    hallazgos: aEscribir.length,
    pidioElModelo: deLaLista(v.nivel, ['verde', 'amarillo', 'rojo']) as Nivel | null,
  });

  /* ── EL DESTACADO Y SU CITA: LOS DOS O NINGUNO ───────────────────────────
   *
   * Lo exige un `check`, y la corrección es apagar los dos y no inventar el que falta. Un mérito
   * afirmado sin la línea que lo respalda es peor que un hallazgo sin cita, **porque nadie audita un
   * elogio**: la cita del hallazgo alguien la va a mirar, la del destacado no.
   *
   * Y en rojo van los dos en nulo aunque el modelo los mande: no se felicita en una fila que dice que
   * hay que intervenir ahora. */
  const destacadoCrudo = intervencion ? null : texto(v.destacado);
  const evidenciaCruda = intervencion ? null : texto(v.evidencia);
  const conAmbos = destacadoCrudo !== null && evidenciaCruda !== null;
  const destacado = conAmbos ? destacadoCrudo : null;
  const evidencia = conAmbos ? evidenciaCruda : null;

  /* Las observaciones se acotan al vocabulario y se descartan las que no tengan etiqueta válida: la
     columna es `jsonb` sin `check`, así que una etiqueta inventada no rompe nada — y por eso mismo
     se colaría hasta la pantalla, donde se dibujaría como una categoría que no existe. */
  const observaciones = auditable
    ? (Array.isArray(v.observaciones) ? v.observaciones : [])
        .map((o) => ({
          etiqueta: deLaLista(o?.etiqueta, ETIQUETAS_DE_OBSERVACION),
          texto: texto(o?.texto),
          cita: texto(o?.cita),
        }))
        .filter((o) => o.etiqueta !== null && o.texto !== null)
    : null;

  const criterio = auditable ? criterioValido(a.agente, v.criterio) : null;

  const fila = await datos()
    .insertInto('analisis_del_agente')
    .values({
      contacto_id: a.contactoId,
      agente: a.agente,
      auditable,
      no_auditable_motivo: auditable ? null : texto(v.no_auditable_motivo),
      intervencion,
      /* El motivo SOLO con intervención, y lo exige un `check`. La frase la lee un vendedor en su cola
         de urgencias, así que si el modelo pidió intervención y no dejó motivo, no se guarda una fila
         muda: se guarda `null` y el lector de la cola pone su texto de reserva. */
      motivo: intervencion ? texto(v.intervencion?.motivo) : null,
      criterio: criterio === SIN_CRITERIO ? null : criterio,
      nivel,
      /* El resumen se escribe SIEMPRE. Si el modelo no lo mandó —no debería, es obligatorio en el
         esquema— se dice eso, y no se deja la fila sin nada: la columna es `not null`. */
      resumen: texto(v.resumen) ?? 'El modelo no devolvió un resumen de esta conversación.',
      destacado,
      evidencia,
      observaciones: observaciones === null ? null : JSON.stringify(observaciones),
      sentimiento: auditable ? deLaLista(v.sentimiento, SENTIMIENTOS) : null,
      disparo: a.disparo,
      alarmas: a.alarmas === null ? null : [...a.alarmas],
      modelo: a.modelo,
      prompt_hash: a.promptHash,
      mensajes_del_agente: a.mensajesDelAgente,
    } as never)
    .returning('id')
    .executeTakeFirstOrThrow();

  if (aEscribir.length > 0) {
    await datos()
      .insertInto('hallazgos')
      .values(
        aEscribir.map(({ patron, h }) => ({
          contacto_id: a.contactoId,
          analisis_id: fila.id,
          agente: a.agente,
          titulo: texto(h.titulo) as string,
          patron,
          /* El criterio del hallazgo no tiene valor neutro en el esquema del modelo, así que uno
             inválido va a `null` y no al neutro: la columna es anulable, y guardar «ninguno» diría que
             el modelo eligió eso. */
          criterio: deLaLista(h.criterio, CRITERIOS_DEL_AGENTE[a.agente]),
          severidad: deLaLista(h.severidad, SEVERIDADES),
          categoria: deLaLista(h.categoria, CATEGORIAS),
          diagnostico: texto(h.diagnostico),
          fragmento_prompt: texto(h.fragmento_prompt),
          prompt_seccion: texto(h.prompt_seccion),
          correccion: texto(h.correccion) as string,
          /* El hash del prompt que el auditor VIO, copiado en cada hallazgo. Es lo que después permite
             avisar que el fragmento citado puede ya no existir — y va en el hallazgo y no solo en el
             análisis porque la pantalla muestra hallazgos, no análisis. */
          prompt_hash: a.promptHash,
          evidencia_agente: texto(h.evidencia_agente) as string,
          evidencia_contacto: texto(h.evidencia_contacto),
        })) as never,
      )
      .execute();
  }

  return { analisisId: fila.id, nivel, intervencion, hallazgos: aEscribir.length, descartados };
}
