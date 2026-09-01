// LA PANTALLA DEL TÉCNICO: las tarjetas, los patrones y las conversaciones auditadas.
//
// ═══════════════════════════════════════════════════════════════════════════════
// SON DOS TARJETAS Y NO CUATRO, Y ESO ES UNA MEDICIÓN
//
// El diseño de origen dibujaba cuatro porque tenía cuatro auditores: dos de chat y dos de voz. Acá los
// de voz están fuera de alcance **por medición** —`negocio.llamadas` tiene cero filas y ninguna columna
// de transcripción, así que no tienen qué leer— y `AGENTES` tiene dos.
//
// Así que la lista sale de `AGENTES` y no de un número escrito acá. Es el defecto `4.1` del origen otra
// vez: *«la causa es una lista escrita a mano»*, que declaraba a los dos de voz como «sin auditor»
// cuando ya lo tenían. El día que exista un tercero, esta pantalla lo dibuja sola.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS TRES ESTADOS DE UNA TARJETA, Y LOS TRES SE VEN DISTINTO
//
//   1 · **La empresa no audita.** Le falta la llave de IA, o el identificador del agente, o alguien
//       apagó el interruptor. Se dice CUÁL de los tres —son tres acciones distintas— y **no se
//       atenúa**: una tarjeta gris se lee como un defecto de la pantalla, y esto es un dato.
//
//   2 · **Audita y todavía no hay análisis de ese agente.** Va **un guion y un chip «sin datos»**,
//       nunca `0 %` ni un tilde verde. Un cero medido y un cero por falta de datos se ven iguales en un
//       número, y el segundo es el que hace tomar decisiones sobre nada.
//
//   3 · **Con datos.** Los números, y todos son cuentas.
//
// El cuarto estado —cargando / listo / error— es del cliente y también se ve distinto, por lo mismo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS CONTADORES CUENTAN AUDITABLES; LA LISTA MUESTRA TODO. SON DOS FILTROS.
//
// Es la única asimetría de este archivo y hay que justificarla, porque el producto ya pagó una vez por
// no escribirla:
//
//   · **Los contadores** —verde, amarillo, rojo— cuentan **solo lo auditable**. Meter las no auditables
//     ahí haría que el porcentaje de verdes bajara cada vez que entra una conversación de dos mensajes,
//     y el técnico leería «el agente empeoró» sobre un agente que no cambió.
//
//   · **La lista** las **incluye**, con su motivo. Es donde se ve *por qué* no se pudo juzgar, y sin
//     ellas «no se auditó» y «no existe» vuelven a verse iguales — que es el defecto que este módulo
//     entero viene arreglando en otras cuatro formas.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { hashDelPrompt } from './prompts.ts';
import { AGENTES, type Agente } from './veredicto.ts';

/** Cuántas conversaciones auditadas trae la lista. */
export const TOPE_DE_CONVERSACIONES = 50;
/** Cuántos casos por patrón se traen. Agrupar quince y mostrar tres es lo que el técnico necesita. */
export const TOPE_DE_CASOS = 200;

/** Por qué una empresa no audita, tal como lo ve la pantalla. */
export type PorQueNoAudita = 'auditor_apagado' | 'sin_clave_ia' | 'sin_id_del_agente';

/** Una tarjeta: un agente y cómo le está yendo. */
export interface TarjetaDelAgente {
  agente: Agente;
  /**
   * Cuántas conversaciones se ANALIZARON, auditables o no. **Es el denominador de nada.**
   *
   * Va aparte de `auditables` a propósito: son dos cuentas y la pantalla las muestra las dos. Con una
   * sola, «se miraron 40 y 19 no se pudieron juzgar» se colapsa en un número que no dice ninguna de
   * las dos cosas.
   */
  analizadas: number;
  auditables: number;
  verdes: number;
  amarillos: number;
  rojos: number;
  /** Intervenciones abiertas: las que todavía están en la cola de algún vendedor. */
  intervencionesAbiertas: number;
  /** Hallazgos abiertos de ese agente. Es la lista de este técnico. */
  hallazgosAbiertos: number;
  /** Cuándo fue el último análisis. `null` = ninguno todavía, que es el estado 2. */
  ultimoEl: Date | null;
  /** ¿Tiene prompt de referencia cargado? La ausencia es un estado normal. */
  tienePrompt: boolean;
}

/** Un caso: un hallazgo concreto, con el texto GANADOR de su patrón ya resuelto. */
export interface CasoDelPatron {
  hallazgoId: string;
  patron: string;
  agente: Agente;
  contactoId: string;
  contacto: string;
  /** El título del caso. Lo que cambia entre casos del mismo patrón. */
  titulo: string;
  severidad: string | null;
  categoria: string | null;
  detectadoEl: Date;
  evidenciaAgente: string;
  evidenciaContacto: string | null;
  // ── Lo del PATRÓN, no del caso. Igual en todos los casos del mismo código. ──
  diagnostico: string | null;
  correccion: string;
  fragmentoPrompt: string | null;
  promptSeccion: string | null;
  /**
   * `true` = el prompt del agente **cambió** desde que este patrón se diagnosticó.
   *
   * Se calcula comparando el `prompt_hash` que el auditor VIO contra el hash del prompt de hoy, y el
   * de hoy **se recalcula del texto** — nunca se lee de la columna. Sin este aviso, el técnico pega un
   * reemplazo cuyo fragmento original ya no existe, no encuentra qué reemplazar, y desconfía de la
   * pantalla entera.
   */
  elPromptCambio: boolean;
}

/** Una conversación auditada, para la lista. **Incluye las no auditables.** */
export interface ConversacionAuditada {
  analisisId: string;
  contactoId: string;
  contacto: string;
  agente: Agente;
  auditable: boolean;
  /** `null` cuando no fue auditable: es la ausencia de veredicto, no un cuarto nivel. */
  nivel: string | null;
  resumen: string;
  /** Por qué no se pudo juzgar. `null` cuando sí se juzgó. */
  noAuditableMotivo: string | null;
  intervencion: boolean;
  motivo: string | null;
  resueltoEl: Date | null;
  analizadoEl: Date;
}

export interface LaPantalla {
  /** `null` = esta empresa SÍ audita. Con valor, es el estado 1 de las tarjetas. */
  noAudita: PorQueNoAudita | null;
  tarjetas: readonly TarjetaDelAgente[];
  casos: readonly CasoDelPatron[];
  conversaciones: readonly ConversacionAuditada[];
  /** `true` = el tope cortó la lista de conversaciones. Un tope silencioso miente. */
  hayMas: boolean;
}

/**
 * Todo lo que la pantalla dibuja. **Corre dentro de `conOrganizacion(`.**
 *
 * @param noAudita El freno de la empresa, ya resuelto por quien llama. Se recibe y no se calcula acá:
 *   sale de las credenciales, que viven en `identidad` y necesitan `conIdentidad(` — y este archivo
 *   corre en el dominio del inquilino. Cruzar los dos acá sería exactamente lo que `ADR-0209` acota.
 */
export async function laPantallaDelTecnico(noAudita: PorQueNoAudita | null): Promise<LaPantalla> {
  /* ── LAS TARJETAS SE DIBUJAN AUNQUE LA EMPRESA NO AUDITE ──────────────────
   *
   * Y no es un descuido: si la empresa auditó antes y alguien apagó el interruptor, los análisis siguen
   * ahí y el técnico tiene que poder verlos. Devolver la pantalla vacía con el motivo arriba borraría
   * el historial de la vista justo cuando alguien está averiguando qué pasó.
   *
   * Lo que el freno cambia es el ENCABEZADO de cada tarjeta, no su contenido. */
  const [porAgente, casos, conversaciones, prompts] = await Promise.all([
    contarPorAgente(),
    casosDeLosPatrones(),
    conversacionesAuditadas(),
    promptsCargados(),
  ]);

  const tarjetas = AGENTES.map((agente) => {
    const c = porAgente.get(agente);
    return {
      agente,
      analizadas: c?.analizadas ?? 0,
      auditables: c?.auditables ?? 0,
      verdes: c?.verdes ?? 0,
      amarillos: c?.amarillos ?? 0,
      rojos: c?.rojos ?? 0,
      intervencionesAbiertas: c?.intervencionesAbiertas ?? 0,
      hallazgosAbiertos: c?.hallazgosAbiertos ?? 0,
      ultimoEl: c?.ultimoEl ?? null,
      tienePrompt: prompts.has(agente),
    };
  });

  return {
    noAudita,
    tarjetas,
    casos,
    conversaciones: conversaciones.filas,
    hayMas: conversaciones.hayMas,
  };
}

/**
 * Las cuentas por agente, **en una sola pasada**.
 *
 * `filter (where …)` de PostgreSQL y no cinco consultas: son cinco cuentas sobre la misma tabla y el
 * mismo `where`. Con cinco consultas, cada una vería la tabla en un instante distinto y los números
 * podrían no sumar — «40 analizadas, 21 auditables, 19 no auditables» dejaría de cuadrar sin que nada
 * fallara.
 */
async function contarPorAgente(): Promise<
  Map<string, Omit<TarjetaDelAgente, 'agente' | 'tienePrompt'>>
> {
  const filas = await datos()
    .selectFrom('analisis_del_agente as a')
    .select(({ fn, eb }) => [
      'a.agente',
      fn.countAll<string>().as('analizadas'),
      eb.fn.count<string>('a.id').filterWhere('a.auditable', '=', true).as('auditables'),
      eb.fn.count<string>('a.id').filterWhere('a.nivel', '=', 'verde').as('verdes'),
      eb.fn.count<string>('a.id').filterWhere('a.nivel', '=', 'amarillo').as('amarillos'),
      eb.fn.count<string>('a.id').filterWhere('a.nivel', '=', 'rojo').as('rojos'),
      sql<string>`count(*) filter (where a.intervencion and a.resuelto_el is null)`.as(
        'intervenciones_abiertas',
      ),
      fn.max('a.analizado_el').as('ultimo_el'),
    ])
    .groupBy('a.agente')
    .execute();

  /* Los hallazgos abiertos van en su propia consulta y no en un `join`: con el `join`, cada análisis
     con dos hallazgos contaría dos veces en las cinco cuentas de arriba — el defecto clásico de sumar
     sobre un producto cartesiano, que no falla y devuelve números plausibles. */
  const abiertos = await datos()
    .selectFrom('hallazgos')
    .select(({ fn }) => ['agente', fn.countAll<string>().as('n')])
    .where('resuelto_el', 'is', null)
    .groupBy('agente')
    .execute();
  const hallazgosDe = new Map(abiertos.map((h) => [h.agente, Number(h.n)]));

  return new Map(
    filas.map((f) => [
      f.agente,
      {
        analizadas: Number(f.analizadas),
        auditables: Number(f.auditables),
        verdes: Number(f.verdes),
        amarillos: Number(f.amarillos),
        rojos: Number(f.rojos),
        intervencionesAbiertas: Number(f.intervenciones_abiertas),
        hallazgosAbiertos: hallazgosDe.get(f.agente) ?? 0,
        ultimoEl: f.ultimo_el,
      },
    ]),
  );
}

/**
 * Los casos abiertos, con el texto ganador de su patrón ya pegado en cada uno.
 *
 * ── EL SERVIDOR ELIGE EL TEXTO; EL CLIENTE AGRUPA Y CUENTA ─────────────────
 *
 * Son dos listas y una sola consulta. Acá se devuelve **un caso por hallazgo**, y cada uno lleva el
 * diagnóstico y la corrección del **hallazgo más reciente de su patrón** — la ventana `first_value`
 * de abajo.
 *
 * Que el cliente agrupe es lo que hace que **el contador sea la cantidad de casos por construcción**:
 * es la longitud del grupo, no un número que viaja al lado. Con el conteo calculado en el servidor y
 * la lista traída aparte, los dos pueden discrepar —un tope, un filtro de más— y la pantalla diría
 * «×15 casos» mostrando tres.
 *
 * Y el texto lo elige el servidor porque **es una decisión, no un dato**: el diagnóstico y la
 * corrección son DEL PATRÓN, no del caso, y quince casos traen quince redacciones distintas de lo
 * mismo. Dejar que el cliente elija sería quince criterios.
 */
/** La ventana de los cinco `first_value`: el hallazgo más reciente de cada patrón. */
const VENTANA_DEL_PATRON = sql`over (partition by h.patron order by h.detectado_el desc)`;

async function casosDeLosPatrones(): Promise<CasoDelPatron[]> {
  const filas = await datos()
    .selectFrom('hallazgos as h')
    .innerJoin('contactos as c', (j) => j.onRef('c.id', '=', 'h.contacto_id'))
    .select([
      'h.id as hallazgo_id',
      'h.patron',
      'h.agente',
      'h.contacto_id',
      'c.nombre as contacto',
      'h.titulo',
      'h.severidad',
      'h.categoria',
      'h.detectado_el',
      'h.evidencia_agente',
      'h.evidencia_contacto',
      /* ── El texto GANADOR del patrón: el del hallazgo más reciente de ese código. ──
       *
       * La ventana se define UNA vez, arriba, y se interpola en las cinco. Con una `window` con
       * nombre el constructor la pone al final de la sentencia —después del `order by`— y PostgreSQL
       * la rechaza con un `42601`; y escribir el `over (…)` cinco veces serían cinco copias del
       * mismo criterio de desempate, que es como una de ellas termina ordenando al revés. */
      sql<string | null>`first_value(h.diagnostico) ${VENTANA_DEL_PATRON}`.as('diagnostico'),
      sql<string>`first_value(h.correccion) ${VENTANA_DEL_PATRON}`.as('correccion'),
      sql<string | null>`first_value(h.fragmento_prompt) ${VENTANA_DEL_PATRON}`.as('fragmento_prompt'),
      sql<string | null>`first_value(h.prompt_seccion) ${VENTANA_DEL_PATRON}`.as('prompt_seccion'),
      sql<string | null>`first_value(h.prompt_hash) ${VENTANA_DEL_PATRON}`.as('prompt_hash'),
    ])
    .where('h.resuelto_el', 'is', null)
    .orderBy('h.detectado_el', 'desc')
    .limit(TOPE_DE_CASOS)
    .execute();

  /* El hash de HOY, recalculado del texto de cada prompt. Se lee una vez para toda la lista: leerlo
     por caso serían doscientas consultas para comparar contra dos textos. */
  const hoy = await promptsCargados();

  return filas.map((f) => ({
    hallazgoId: f.hallazgo_id,
    patron: f.patron,
    agente: f.agente as Agente,
    contactoId: f.contacto_id,
    contacto: f.contacto,
    titulo: f.titulo,
    severidad: f.severidad,
    categoria: f.categoria,
    detectadoEl: f.detectado_el,
    evidenciaAgente: f.evidencia_agente,
    evidenciaContacto: f.evidencia_contacto,
    diagnostico: f.diagnostico,
    correccion: f.correccion,
    fragmentoPrompt: f.fragmento_prompt,
    promptSeccion: f.prompt_seccion,
    /* ── CUÁNDO SE AVISA QUE EL PROMPT CAMBIÓ, Y CUÁNDO NO ─────────────────
     *
     * Solo cuando había un hash **y** hay un prompt hoy **y** son distintos. Los otros dos casos no son
     * un cambio: sin hash, el auditor no vio ningún prompt; sin prompt hoy, no hay nada que haya
     * cambiado — hay algo que no está, y eso ya lo dice la tarjeta. Avisar ahí sería un aviso que
     * aparece siempre, y un aviso que aparece siempre se ignora. */
    elPromptCambio:
      f.prompt_hash !== null &&
      hoy.has(f.agente) &&
      hoy.get(f.agente) !== f.prompt_hash,
  }));
}

/**
 * Las conversaciones auditadas, la más reciente primero. **Incluye las no auditables.**
 *
 * Ver el encabezado: es el otro lado de la asimetría con los contadores, y está justificado ahí.
 *
 * Se pide una de más para poder afirmar `hayMas` sin una segunda consulta de conteo — un tope
 * silencioso hace que «se auditaron 50» se lea como «había 50».
 */
async function conversacionesAuditadas(): Promise<{
  filas: ConversacionAuditada[];
  hayMas: boolean;
}> {
  const crudas = await datos()
    .selectFrom('analisis_del_agente as a')
    .innerJoin('contactos as c', (j) => j.onRef('c.id', '=', 'a.contacto_id'))
    .select([
      'a.id',
      'a.contacto_id',
      'c.nombre as contacto',
      'a.agente',
      'a.auditable',
      'a.nivel',
      'a.resumen',
      'a.no_auditable_motivo',
      'a.intervencion',
      'a.motivo',
      'a.resuelto_el',
      'a.analizado_el',
    ])
    .orderBy('a.analizado_el', 'desc')
    // El desempate estable: dos análisis del mismo instante saldrían en orden distinto en cada carga.
    .orderBy('a.id', 'desc')
    .limit(TOPE_DE_CONVERSACIONES + 1)
    .execute();

  return {
    filas: crudas.slice(0, TOPE_DE_CONVERSACIONES).map((a) => ({
      analisisId: a.id,
      contactoId: a.contacto_id,
      contacto: a.contacto,
      agente: a.agente as Agente,
      auditable: a.auditable,
      nivel: a.nivel,
      resumen: a.resumen,
      noAuditableMotivo: a.no_auditable_motivo,
      intervencion: a.intervencion,
      motivo: a.motivo,
      resueltoEl: a.resuelto_el,
      analizadoEl: a.analizado_el,
    })),
    hayMas: crudas.length > TOPE_DE_CONVERSACIONES,
  };
}

/**
 * Los prompts cargados hoy, por agente, con su hash **recalculado del texto**.
 *
 * Nunca se lee `prompt_hash` de la tabla de prompts: esa columna dice qué hash tenía al guardarse.
 * Leerla acá haría que una escritura que se olvide de actualizarla deje todos los hallazgos viejos
 * pasando por vigentes para siempre — el aviso de «el prompt cambió» no volvería a salir nunca.
 */
async function promptsCargados(): Promise<Map<string, string>> {
  const filas = await datos().selectFrom('prompts_del_agente').select(['agente', 'texto']).execute();
  return new Map(filas.map((f) => [f.agente, hashDelPrompt(f.texto)]));
}
