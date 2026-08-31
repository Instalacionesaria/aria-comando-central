// LOS PORTONES: quién se audita y quién no. **Todo esto corre ANTES de gastar un centavo.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// «UN PORTÓN DE MENOS NO FALLA: SOLO FACTURA»
//
// Es la frase del diseño de origen y describe exactamente la clase de defecto que este archivo
// existe para evitar. Sin un portón el módulo **funciona**: audita, produce veredictos correctos,
// llena la pantalla del técnico. Lo único que cambia es la factura, y aparece un mes después sin
// nada que la explique.
//
// De ahí que estén ordenados **del más barato al más caro**, y que el orden sea parte del contrato:
//
//   0 · LA EMPRESA        — tres motivos, ninguna consulta por contacto
//   1 · territorio        — una columna de la fila que ya está cargada
//   2 · agente atendiendo — las etiquetas de la misma fila
//   3 · ya está marcado   — un `exists` sobre los hallazgos abiertos
//   4 · el antirrebote    — una RESTA sobre dos cuentas de mensajes
//   5 · hay líneas DEL AGENTE — **vive en otro archivo**, ver abajo
//
// ── EL PORTÓN 5 NO ESTÁ ACÁ, Y NO ES UN OLVIDO ──────────────────────────────
//
// Es `porQueNoSeAudita()` de `lib/auditor/transcripcion.ts`, que ya existía y ya está probado. No se
// duplica por una razón de fondo: ese portón necesita **los mensajes cargados y atribuidos**, y su
// resultado no es solo «no gastes» — es también el `no_auditable_motivo` que se escribe en la fila.
// Copiarlo acá serían dos listas del mismo hecho, que es la forma en que este repositorio ya se
// equivocó una vez (ver el encabezado de la migración 027).
//
// Y **no es redundante con el portón 4**, aunque los dos hablen de «mensajes del agente». Cuentan
// cosas distintas:
//
//   · El **4** cuenta `mensajes.autor = 'agente'`, que es una columna. Barato, y **miente**: la
//     ingesta pone `'agente'` en todo saliente cuya fuente no sea la aplicación, así que ahí adentro
//     hay automatizaciones del CRM.
//   · El **5** cuenta las líneas que la regla de atribución le imputa al `AGENTE IA`, lo cual exige
//     el identificador del agente en el CRM. Es estrictamente menos.
//
// Cinco plantillas de un flujo del CRM **pasan el 4 y no pasan el 5**. Sin el 5, el criterio «dejó de
// responder» se cumpliría siempre que no hay agente: le imputaría al agente su propia ausencia.
//
// ── EL ANTIRREBOTE RESTA, NO CUENTA ─────────────────────────────────────────
//
// El umbral no se mide con una columna que alguien tenga que acordarse de incrementar, sino con
// `cuántos hay ahora − cuántos había en el último análisis`. Las dos puntas salen de la misma
// fuente, así que si aparecen o desaparecen mensajes —una carga de históricos, el borrado de
// duplicados de la ingesta— **se mueven juntas**. Un contador se desincroniza con las dos cosas, y el
// síntoma es un contacto que se audita en cada corrida o que no se audita nunca.
//
// **Cero llamadas al CRM.** Todo lo de este archivo sale de nuestra propia base.
// ═══════════════════════════════════════════════════════════════════════════════

import { ESTANCADO, estadoDelAgente, type EstadoDelAgente } from '../ghl/contrato.ts';
import { tiene } from '../negocio/colas.ts';
import type { Territorio } from '../datos/esquema.ts';
import { UMBRAL_DE_SILENCIO_MIN } from './transcripcion.ts';
import { AGENTE_DEL_TERRITORIO, type Agente } from './veredicto.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL PORTÓN 0: LA EMPRESA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Por qué una empresa entera no se audita. **Los tres son estados normales, no fallos.**
 *
 * Y no se colapsan en uno, por el mismo motivo que las cinco faltas de credencial de
 * `lib/negocio/barrido.ts`: `sin_clave_ia` en TODAS las empresas a la vez significa que cambió la
 * clave maestra del servidor, no que todos los clientes desconectaron su IA el mismo día. Un motivo
 * único haría indistinguibles esas dos cosas.
 */
export type MotivoDeLaEmpresa = 'auditor_apagado' | 'sin_clave_ia' | 'sin_id_del_agente';

export const TEXTO_DEL_MOTIVO_DE_LA_EMPRESA: Readonly<Record<MotivoDeLaEmpresa, string>> = {
  auditor_apagado: 'El auditor está apagado para esta empresa.',
  sin_clave_ia: 'Esta empresa no tiene cargada su clave de IA.',
  sin_id_del_agente:
    'Esta empresa no tiene configurado el identificador de su agente en el CRM, así que no se ' +
    'puede saber qué líneas escribió el agente.',
};

/** Lo que hace falta saber de la empresa. Nada de esto es por contacto. */
export interface EmpresaParaAuditar {
  /** El interruptor de la migración 029. */
  auditorActivo: boolean;
  /** ¿Tiene clave de IA cargada? **No se recibe la clave**: acá solo se decide, no se llama. */
  tieneClaveIa: boolean;
  /** El identificador del agente en el CRM, o `null`. */
  idDelAgente: string | null;
}

/**
 * ¿Se audita esta empresa? `null` = sí.
 *
 * ── POR QUÉ EL INTERRUPTOR VA PRIMERO ──────────────────────────────────────
 *
 * Es el único de los tres que alguien apretó a propósito. Si el orden fuera el otro, una empresa con
 * el auditor apagado Y sin clave saldría reportada como «sin clave», y quien la apagó vería un motivo
 * que no es el suyo — y trataría de arreglar algo que no está roto.
 *
 * ── Y POR QUÉ EL INTERRUPTOR NACE ENCENDIDO ────────────────────────────────
 *
 * Porque **no es él el que habilita el gasto**: sin `idDelAgente` no se audita nada, y ese
 * identificador lo tiene que escribir una persona en la pantalla de credenciales. O sea que una
 * empresa nueva no gasta aunque el interruptor esté encendido, y nadie tiene que acordarse de
 * encenderlo el día que sí se configure. Lo que el interruptor compra es **apagar una cuenta que ya
 * está auditando, sin desplegar y sin borrarle la configuración**.
 */
export function porQueNoSeAuditaLaEmpresa(e: EmpresaParaAuditar): MotivoDeLaEmpresa | null {
  if (!e.auditorActivo) return 'auditor_apagado';
  if (!e.tieneClaveIa) return 'sin_clave_ia';
  if (e.idDelAgente === null || e.idDelAgente.trim() === '') return 'sin_id_del_agente';
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · EL NIVEL 0: LAS SEÑALES QUE ADELANTAN UN ANÁLISIS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * El antirrebote: cuántos mensajes del agente tienen que haber aparecido desde el último análisis.
 *
 * Cinco es el número del diseño de origen y no se toca sin medir. Lo que sí conviene tener escrito es
 * **qué agujero deja**: una conversación de cuatro mensajes donde el contacto se va enojado nunca
 * llega a cinco, así que sin las señales de abajo **no se auditaría jamás** — y es exactamente el caso
 * en el que un humano tendría que entrar.
 */
export const UMBRAL_DEL_DEBOUNCE = 5;

/**
 * El PISO. Una señal adelanta el análisis, pero **no lo dispara sobre trabajo viejo**.
 *
 * Sin esto habría un bucle: la señal sigue puesta —el contacto no borra su mensaje enojado— así que
 * cada corrida del barrido volvería a auditar la misma conversación sin que el agente haya dicho nada
 * nuevo, y cada corrida es una inferencia pagada.
 *
 * Y el motivo de fondo, que es el que hay que entender: **esto audita AL AGENTE**. Si el agente no
 * dijo nada nuevo, el veredicto anterior ya cubre lo que hay.
 */
export const PISO_DEL_DEBOUNCE = 1;

/**
 * Las señales del nivel 0. **Cuatro, y el diseño pedía cinco.**
 *
 * ── LA QUINTA SE CAYÓ POR MEDICIÓN, Y ESO ES EL PUNTO ──────────────────────
 *
 * La quinta era la etiqueta `estancado` del CRM —el CRM diciendo que la conversación se trabó—, y
 * **en producción la tienen CERO contactos** de 322 (medido el 2026-08-31). Construirla sería tubería
 * para un insumo que no existe: código que nadie puede ejercitar, una rama que ninguna prueba real
 * cubre, y un renglón en la pantalla que siempre dice cero.
 *
 * Es la misma decisión que dejó los dos auditores de voz fuera de alcance, y por la misma razón.
 *
 * ── LO QUE LAS CUATRO PUEDEN VER, Y LO QUE NO ──────────────────────────────
 *
 * Salen todas de la fila del contacto que ya está cargada: **cero consultas y cero llamadas**. Pero
 * `ultimo_entrante_texto` es **un solo mensaje** —el último que escribió el contacto—, así que las
 * tres señales de texto no pueden ver «lo pidió tres veces» ni «se fue enfriando». Eso lo ve el
 * modelo, no esto. Acá solo se decide si vale la pena preguntarle.
 *
 * ── Y POR QUÉ UNA LISTA DE FRASES ES ACEPTABLE ACÁ Y NO EN LA RÚBRICA ──────
 *
 * En la rúbrica, un criterio que dispara por parecido semántico produce **un veredicto falso**, que se
 * ve igual que uno bueno. Acá un falso positivo cuesta **un análisis** —plata, no un error— y el
 * modelo sigue juzgando con la rúbrica completa. Así que el lado por el que conviene equivocarse es
 * el generoso: una señal de más gasta una vez; una de menos deja una conversación urgente sin mirar.
 */
export const ALARMAS = [
  /** El contacto escribió último y pasó el umbral de silencio sin que nadie le contestara. */
  'silencio_tras_el_contacto',
  /** Pidió expresamente hablar con una persona. Es uno de los cuatro casos de intervención. */
  'pidio_una_persona',
  /** Dijo que no le sirve o que no le interesa. */
  'rechazo_explicito',
  /** Fastidio inequívoco. */
  'enojo_explicito',
] as const;
export type Alarma = (typeof ALARMAS)[number];

export const TEXTO_DE_LA_ALARMA: Readonly<Record<Alarma, string>> = {
  silencio_tras_el_contacto: 'El contacto escribió y nadie le respondió.',
  pidio_una_persona: 'Pidió hablar con una persona.',
  rechazo_explicito: 'Dijo que no le sirve.',
  enojo_explicito: 'Expresó fastidio.',
};

/**
 * Las frases de cada señal de texto.
 *
 * Sin acentos y en minúsculas **porque el texto que se compara viene normalizado**: la gente escribe
 * «pesimo» y «pésimo», y una lista con acentos deja pasar la mitad de los casos reales sin que nada
 * falle.
 */
const FRASES: Readonly<Record<'pidio_una_persona' | 'rechazo_explicito' | 'enojo_explicito', readonly string[]>> =
  {
    pidio_una_persona: [
      'hablar con una persona',
      'hablar con alguien',
      'hablar con un humano',
      'hablar con un asesor',
      'hablar con un ejecutivo',
      'hablar con un vendedor',
      'con un humano',
      'una persona real',
      'atencion humana',
      'me pasas con',
      'me comunicas con',
      'pasame con',
      'quiero un asesor',
      'eres un bot',
      'sos un bot',
      'esto es un bot',
      'un robot',
    ],
    rechazo_explicito: [
      'no me sirve',
      'no me interesa',
      'no me convence',
      'no es lo que busco',
      'no es lo que necesito',
      'no es para mi',
      'ya no quiero',
      'no quiero nada',
      'dejen de escribirme',
      'no me escriban',
      'dar de baja',
      'desuscribir',
      'cancelar todo',
    ],
    enojo_explicito: [
      'ya te dije',
      'ya lo dije',
      'te lo dije',
      'no me entiendes',
      'no me entendes',
      'no entiendes nada',
      'es la tercera vez',
      'es la cuarta vez',
      'cuantas veces',
      'estoy cansado',
      'estoy cansada',
      'estoy harto',
      'estoy harta',
      'una verguenza',
      'un desastre',
      'pesimo',
      'malisimo',
      'basta ya',
      'estafa',
    ],
  };

/**
 * Baja el texto a minúsculas y le saca los acentos.
 *
 * Es la misma normalización que `normalizarPatron`, y por el mismo motivo: comparar contra un texto
 * escrito por una persona sin normalizarlo es comparar contra la ortografía, no contra lo que dijo.
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Lo que hace falta para mirar las señales. Todo de la fila del contacto. */
export interface ParaMirarLasAlarmas {
  ultimoEntranteEl: Date | null;
  ultimoSalienteEl: Date | null;
  ultimoEntranteTexto: string | null;
}

/**
 * Qué señales están puestas. **Array vacío = se miraron y no había.**
 *
 * @param ahora Inyectable: sin la costura, comprobar el umbral de silencio exigiría una prueba de una
 *   hora.
 */
export function alarmasPuestas(de: ParaMirarLasAlarmas, ahora: Date): readonly Alarma[] {
  const puestas: Alarma[] = [];

  /* ── EL SILENCIO: LAS DOS CONDICIONES, Y LA SEGUNDA NO ALCANZA SOLA ───────
   *
   * Hace falta que el contacto haya escrito ÚLTIMO. Con solo «pasó una hora desde el último entrante»
   * dispararía en toda conversación que el agente cerró bien hace un rato — o sea en casi todas, y una
   * señal que dispara en casi todas es un antirrebote apagado con pasos extra. */
  const e = de.ultimoEntranteEl;
  if (
    e !== null &&
    (de.ultimoSalienteEl === null || de.ultimoSalienteEl.getTime() < e.getTime()) &&
    ahora.getTime() - e.getTime() >= UMBRAL_DE_SILENCIO_MIN * 60_000
  ) {
    puestas.push('silencio_tras_el_contacto');
  }

  const texto = de.ultimoEntranteTexto === null ? '' : normalizar(de.ultimoEntranteTexto);
  if (texto !== '') {
    for (const senal of ['pidio_una_persona', 'rechazo_explicito', 'enojo_explicito'] as const) {
      if (FRASES[senal].some((f) => texto.includes(f))) puestas.push(senal);
    }
  }

  return puestas;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LOS PORTONES 1 A 4
// ═══════════════════════════════════════════════════════════════════════════════

/** Por qué un contacto no se audita. Cinco motivos, y ninguno es un error. */
export type MotivoDelPorton =
  /** 1 · Sin territorio no se sabe qué trabajo se está juzgando. */
  | 'sin_territorio'
  /** 2 · El agente de ESE territorio no está atendiendo. */
  | 'agente_no_atiende'
  /** 3 · Ya tiene una marca nuestra abierta: alguien lo está mirando. */
  | 'ya_marcado'
  /** 4 · No aparecieron suficientes mensajes del agente, y ninguna señal lo adelanta. */
  | 'antirrebote'
  /** 4b · Una señal lo adelantaría, pero el agente no dijo NADA nuevo. Ver `PISO_DEL_DEBOUNCE`. */
  | 'sin_novedad_del_agente';

export const TEXTO_DEL_PORTON: Readonly<Record<MotivoDelPorton, string>> = {
  sin_territorio: 'Sin territorio: no se sabe qué trabajo habría que juzgar.',
  agente_no_atiende: 'El agente de su territorio no está atendiendo esta conversación.',
  ya_marcado: 'Ya tiene un aviso abierto: alguien lo está mirando.',
  antirrebote: 'No hay suficientes mensajes nuevos del agente.',
  sin_novedad_del_agente: 'Hay una señal, pero el agente no dijo nada nuevo desde el último análisis.',
};

/**
 * Los estados del agente que habilitan auditar, **por territorio**.
 *
 * ── EL LEGADO ENTRA, Y EL TERRITORIO ES EL QUE DESEMPATA ───────────────────
 *
 * `bot_activado` a secas dice que el chatbot atiende **sin decir cuál**, y el contrato lo trata como
 * legado. Entra igual, porque acá quien decide de qué agente se habla es el TERRITORIO del contacto y
 * no la etiqueta. Dejarlo afuera excluiría para siempre a un contacto que sí está siendo atendido.
 *
 * Medido: hoy en producción **cero** contactos tienen la etiqueta legada a secas, así que esto no
 * cambia una sola fila. Está por lo que cuesta el otro lado del error, que es una exclusión silenciosa.
 *
 * ── Y LO QUE ESTA TABLA RECHAZA A PROPÓSITO ────────────────────────────────
 *
 * Un contacto del territorio del setter con `bot_activado_appflow` puesto —el agente de post-agenda
 * atendiendo trabajo de pre-agenda— **no se audita**. Existe de verdad: el encabezado de
 * `lib/negocio/colas.ts` mide que hay contactos con las dos zonas a la vez durante el traspaso.
 *
 * Auditarlo sería elegir a quién imputarle el fallo con una moneda: el territorio dice de quién es el
 * trabajo y la etiqueta dice quién está hablando, y cuando no coinciden **no se sabe qué se está
 * juzgando**. Es el mismo motivo del portón 1.
 */
export const ATIENDE_EL_AGENTE: Readonly<Record<Territorio, readonly EstadoDelAgente[]>> = {
  closer: ['atendiendo_post_agenda', 'atendiendo'],
  setter: ['atendiendo_pre_agenda', 'atendiendo'],
};

/** Un candidato, con todo lo que los portones 1 a 4 necesitan. **Todo de nuestra base.** */
export interface CandidatoAAuditar {
  contactoId: string;
  territorio: Territorio | null;
  etiquetas: readonly string[];
  /** ¿Tiene un hallazgo abierto? Es el portón 3. */
  tieneAvisoAbierto: boolean;
  /** Cuántos `mensajes.autor = 'agente'` hay AHORA. */
  mensajesDelAgente: number;
  /**
   * Cuántos había en el último análisis. **`null` = nunca se analizó**, y entonces la resta es el
   * total. No es cero por casualidad: escribirlo como cero funcionaría igual hoy y perdería la
   * distinción el día que alguien quiera saber cuántos contactos nunca pasaron por el auditor.
   */
  mensajesDelAgenteEnElUltimoAnalisis: number | null;
  ultimoEntranteEl: Date | null;
  ultimoSalienteEl: Date | null;
  ultimoEntranteTexto: string | null;
}

/** Lo que se decidió sobre un candidato. */
export type Decision =
  | {
      audita: true;
      /** Qué auditor le toca. Sale del territorio, nunca de la etiqueta. */
      agente: Agente;
      /** Por qué se disparó. Va a la columna `disparo`. */
      disparo: 'debounce' | 'alarma';
      /**
       * Las señales que lo adelantaron, o `null` si salió por el antirrebote normal.
       *
       * `null` y no `[]`, y es el contrato de la columna: **cuando el antirrebote alcanza, las señales
       * no se miran**. Es más barato y es honesto — «nadie las miró» y «se miraron y no había» no son
       * el mismo hecho.
       *
       * Lo que ese ahorro cuesta, dicho: de un análisis disparado por el antirrebote **no se puede
       * saber después qué señales estaban puestas**, así que los datos responden «¿esta señal alcanza
       * para encontrar un rojo?» y no «¿esta señal predice un rojo?». La primera es la pregunta que
       * decide si una señal se saca, que es para lo que la columna existe.
       */
      alarmas: readonly Alarma[] | null;
      /** Cuántos mensajes del agente hay ahora. Es la línea base que la fila tiene que guardar. */
      mensajesDelAgente: number;
      /** Cuántos aparecieron desde el último análisis. Para la corrida en seco. */
      delta: number;
    }
  | { audita: false; porton: MotivoDelPorton; /** Detalle para la corrida en seco. */ detalle?: string };

/**
 * Los portones 1 a 4, en orden. **Cero consultas: todo sale del candidato.**
 *
 * @param ahora Inyectable, por el umbral de silencio. Ver `alarmasPuestas`.
 */
export function decidirSiAuditar(c: CandidatoAAuditar, ahora: Date): Decision {
  // ── 1 · TERRITORIO ────────────────────────────────────────────────────────
  if (c.territorio === null) return { audita: false, porton: 'sin_territorio' };
  const agente = AGENTE_DEL_TERRITORIO[c.territorio];

  // ── 2 · EL AGENTE DE ESE TERRITORIO ESTÁ ATENDIENDO ──────────────────────
  const estado = estadoDelAgente(c.etiquetas);
  if (!ATIENDE_EL_AGENTE[c.territorio].includes(estado)) {
    return { audita: false, porton: 'agente_no_atiende', detalle: estado };
  }

  /* ── 3 · NO ESTÁ YA MARCADO ───────────────────────────────────────────────
   *
   * Y esto NO es redundante con el portón 2, aunque lo parezca: el estado `pausado_por_fallo` sale de
   * una etiqueta del CRM, y **poner esa etiqueta es una segunda escritura a un sistema ajeno que
   * puede fallar**. Cuando falla, nuestro hallazgo queda abierto y el CRM sigue diciendo que el
   * agente atiende — el portón 2 lo deja pasar y este lo frena.
   *
   * Sin él, un contacto con la etiqueta sin poner se re-auditaría en cada corrida: la misma
   * conversación, el mismo veredicto, y una inferencia pagada cada diez minutos. */
  if (c.tieneAvisoAbierto) return { audita: false, porton: 'ya_marcado' };

  // ── 4 · EL ANTIRREBOTE, POR RESTA ────────────────────────────────────────
  const previos = c.mensajesDelAgenteEnElUltimoAnalisis ?? 0;
  /* `Math.max(0, …)` y no la resta cruda: si desaparecieron mensajes —el borrado de duplicados de la
     ingesta lo hace— la resta da negativo, y un negativo pasaría el piso de abajo al revés. Un delta
     negativo no significa «menos que nada»: significa que no hay novedad. */
  const delta = Math.max(0, c.mensajesDelAgente - previos);

  const comun = { agente, mensajesDelAgente: c.mensajesDelAgente, delta } as const;
  if (delta >= UMBRAL_DEL_DEBOUNCE) {
    return { audita: true, ...comun, disparo: 'debounce', alarmas: null };
  }

  // ── 4b · EL NIVEL 0 ──────────────────────────────────────────────────────
  const alarmas = alarmasPuestas(c, ahora);
  if (alarmas.length === 0) return { audita: false, porton: 'antirrebote', detalle: `delta ${delta}` };
  if (delta < PISO_DEL_DEBOUNCE) {
    return { audita: false, porton: 'sin_novedad_del_agente', detalle: alarmas.join(', ') };
  }
  return { audita: true, ...comun, disparo: 'alarma', alarmas };
}
