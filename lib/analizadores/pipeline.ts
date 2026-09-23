// El pipeline de los Analizadores: descubrir, analizar y la ficha del prospecto.
//
// ═══════════════════════════════════════════════════════════════════════════════
// DE DÓNDE VIENE
//
// Es el `pipeline.ts` de ARIA Brain (`lib/analyzer/pipeline.ts`), reescrito sobre la capa de
// `datos.ts`. Lo que conserva es el orden y las tres salidas de cada reunión; lo que cambió, cada
// cosa por un defecto del origen que costaba plata o se veía como «no pasó nada»:
//
//   · **Una llave rechazada corta el descubrimiento y lo dice.** El origen tragaba cualquier fallo
//     de tl;dv con un `catch {}` y lo contaba como «transcripción no lista»: con la llave revocada,
//     cada corrida terminaba bien, con cero reuniones, para siempre.
//   · **La guardia de reloj.** El cron del origen tenía 800 s y un presupuesto, pero no comprobaba
//     que un análisis entero —hasta 270 s de espera— cupiera en lo que quedaba; y su ruta de análisis
//     manual hacía dos inferencias seguidas dentro de 300 s. Una llamada al modelo que empieza sin
//     tiempo para terminar se paga y no se guarda, y la llamada queda en ANALYZING. Acá no arranca.
//   · **La toma exige el estado que vio quien llama** (`tomarParaAnalizar`): los drenados recorren
//     una foto de las pendientes, y sin esto una llamada que otra corrida ya dejó DONE se volvía a
//     analizar y a pagar.
//   · **Una llave que deja de servir no marca FAILED**: devuelve la llamada a su estado y corta. Con
//     la llave rota, el drenado dejaba FAILED a cada pendiente que tocaba.
//   · **`TIPOS_QUE_SE_ANALIZAN`.** El clasificador conoce HT y OB desde el primer día —si no, cada
//     onboarding saldría OTRO y el descarte lo sellaría para siempre—, pero en la fase HT solo HT se
//     analiza. Las OB esperan en PENDING hasta la fase OB.
//   · **La ficha no va en la misma petición que el análisis.** El origen la generaba a continuación:
//     dos inferencias de minutos en una sola función de 300 s. Acá el análisis termina y devuelve; la
//     ficha la pide la pantalla enseguida, en otra petición, y la tarea completa las que falten.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  ANALYSIS_WAIT_MS,
  AnalyzerCallError,
  CLASSIFY_WAIT_MS,
  isOverloaded,
  isUnusableKey,
} from './nucleo/anthropic.ts';
import { classifyCallType, runAnalysis, runInsight } from './nucleo/engine.ts';
import { insightsFor } from './nucleo/insight-registry.ts';
import { TLDV_PAGE_SIZE, TLDV_WAIT_MS, TldvError, fetchTranscript, listRecentMeetings } from './nucleo/tldv.ts';
import { parseTranscriptInput } from './nucleo/transcript.ts';
import type { NormalizedTranscript } from './nucleo/types.ts';
import {
  crearLlamadaConTranscripcion,
  guardarFicha,
  leerParaAnalizar,
  prospectoDeLaLlamada,
  reunionesConocidas,
  terminarConAnalisis,
  terminarConFallo,
  terminarConVeto,
  tomarParaAnalizar,
  devolverAlEstado,
  type EstadoTomable,
  type LlamadaParaAnalizar,
} from './datos.ts';

/**
 * Qué tipos se ANALIZAN. **La única constante que separa la fase HT de la fase OB.**
 *
 * No es lo mismo que qué tipos se CLASIFICAN: eso lo decide el registro del núcleo, y ahí OB está
 * desde el primer día. Esta lista decide solo qué se le manda a Sonnet.
 */
export const TIPOS_QUE_SE_ANALIZAN: readonly ('HT' | 'OB')[] = ['HT'];

/** Tope de reuniones nuevas que se examinan por corrida: el del origen. */
export const TOPE_DEL_DESCUBRIMIENTO = 40;

/**
 * La ventana del descubrimiento, desde el instante de la corrida. 48 h y no 24 a propósito, como en
 * el origen: una transcripción que tl;dv tarda dos horas en procesar, de una reunión de las 23:40,
 * con 24 h se pierde para siempre. El solape lo absorbe el descarte por identificador externo.
 */
export const VENTANA_DEL_DESCUBRIMIENTO_HORAS = 48;

/** Lo que se deja libre al final de la función: guardar el resultado y contestar. */
export const MARGEN_MS = 15_000;

/**
 * Por debajo de esto no se arranca un análisis. Un análisis que se corta a mitad se paga igual y no
 * se guarda: es peor que no empezarlo. Se ajusta con las duraciones medidas en producción.
 */
export const MINIMO_PARA_ANALIZAR_MS = 150_000;

/** Qué hora es y cuándo se termina la función. Inyectable para probar la guardia sin esperar. */
export interface Reloj {
  ahora(): number;
  fin: number;
}

/** Un reloj que termina `duracionMs` después de ahora. */
export function relojDe(duracionMs: number, ahora: () => number = Date.now): Reloj {
  return { ahora, fin: ahora() + duracionMs };
}

const restante = (r: Reloj) => r.fin - r.ahora();

/** Cuánto se le puede dar de espera a un análisis, o `null` si no cabe. */
export function esperaDisponible(reloj: Reloj): number | null {
  const libre = restante(reloj) - MARGEN_MS;
  if (libre < MINIMO_PARA_ANALIZAR_MS) return null;
  return Math.min(ANALYSIS_WAIT_MS, libre);
}

const mensajeDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * El error que se GUARDA en la llamada y se devuelve por la API.
 *
 * Un error de la base trae su SQLSTATE en `code` y un mensaje que nombra tablas y restricciones
 * —«insert or update on table "analizador_analisis" violates foreign key constraint…»—, y ADR-0704
 * prohíbe que eso salga en una respuesta. Va entero al registro del servidor y a la llamada, una frase
 * que dice qué pasó sin la estructura. Los errores del modelo y de tl;dv son nuestros y ya vienen
 * escritos para leerse.
 */
function errorParaGuardar(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) {
    console.error('analizadores: la base rechazó una escritura del análisis', e);
    return 'No se pudo guardar el resultado del análisis. La llamada quedó como estaba antes de analizarla.';
  }
  return mensajeDe(e);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · DESCUBRIR
// ═══════════════════════════════════════════════════════════════════════════════

export type ResultadoDelDescubrimiento =
  | {
      tipo: 'hecho';
      /** Cuántas reuniones devolvió tl;dv. */
      listadas: number;
      /**
       * La página vino llena y NINGUNA de sus reuniones es anterior a la ventana: puede haber reuniones
       * de la ventana más atrás, en la página que no se pide. Ver el cálculo.
       */
      paginaSinBorde: boolean;
      /** HT u OB guardadas en PENDING. */
      descubiertas: number;
      /** OTRO guardadas en NOT_MATCH, con su motivo. */
      internas: number;
      /** tl;dv todavía no tiene la transcripción: se retoma en la próxima corrida. */
      pendientesDeTranscripcion: number;
      /** El clasificador falló o devolvió basura: no se escribió nada, se retoma. */
      sinClasificar: number;
      /** Nuevas que quedaron sin examinar porque se acabó el tiempo o el tope. */
      sinExaminar: number;
    }
  | { tipo: 'falta'; que: 'llave_de_tldv_rechazada' | 'llave_de_ia_rechazada' }
  | { tipo: 'fallo'; causa: string };

/**
 * Descubre las reuniones nuevas de tl;dv, las clasifica y las guarda. **No analiza**: eso es lo caro,
 * y lo hace el drenado.
 *
 * Descubre las dos, HT y OB, como el origen desde que el botón dejó de ser por pestaña: una
 * sincronización lanzada desde OB también trae las HT.
 */
export async function descubrir(
  orgId: string,
  opciones: {
    claveTldv: string;
    claveIa: string;
    reloj: Reloj;
    ventanaHoras?: number;
    tope?: number;
  },
): Promise<ResultadoDelDescubrimiento> {
  const { claveTldv, claveIa, reloj } = opciones;
  const ventanaHoras = opciones.ventanaHoras ?? VENTANA_DEL_DESCUBRIMIENTO_HORAS;
  const tope = opciones.tope ?? TOPE_DEL_DESCUBRIMIENTO;
  const corte = reloj.ahora() - ventanaHoras * 3_600_000;

  let reuniones;
  try {
    reuniones = await listRecentMeetings(claveTldv, TLDV_WAIT_MS);
  } catch (e) {
    if (e instanceof TldvError && e.kind === 'llave') return { tipo: 'falta', que: 'llave_de_tldv_rechazada' };
    return { tipo: 'fallo', causa: mensajeDe(e) };
  }

  const conocidas = await reunionesConocidas(
    orgId,
    'TLDV',
    reuniones.map((m) => m.externalMeetingId).filter(Boolean),
  );
  const nuevas = reuniones
    .filter((m) => m.externalMeetingId && !conocidas.has(m.externalMeetingId))
    // Solo la ventana reciente. Sin fecha (raro) se incluye: mejor examinarla que perderla.
    .filter((m) => !m.happenedAt || new Date(m.happenedAt).getTime() >= corte);

  const out = {
    tipo: 'hecho' as const,
    listadas: reuniones.length,
    /* ── UNA PÁGINA LLENA NO ALCANZA PARA AVISAR ────────────────────────────
     *
     * La primera versión avisaba con solo contar: `listadas >= TLDV_PAGE_SIZE`. La primera corrida
     * real (2026-09-23 18:41) lo desmintió: la página vino llena, traía la reunión de esa misma
     * tarde, y 48 de sus 50 eran anteriores a la ventana —ya conocidas o de más de 48 h—. O sea que
     * la página cruzaba el borde de la ventana y no faltaba nada, pero el sello avisaba igual, y en
     * una cuenta con más de 50 reuniones iba a avisar en TODAS las corridas. Un sello que avisa
     * siempre deja de leerse.
     *
     * Solo puede faltar algo si la página, además de llena, no llega a salir de la ventana. Una
     * reunión sin fecha cuenta como adentro: no prueba que se haya cruzado el borde. */
    paginaSinBorde:
      reuniones.length >= TLDV_PAGE_SIZE &&
      !reuniones.some((m) => m.happenedAt && new Date(m.happenedAt).getTime() < corte),
    descubiertas: 0,
    internas: 0,
    pendientesDeTranscripcion: 0,
    sinClasificar: 0,
    sinExaminar: 0,
  };

  /* Cada reunión cuesta, en el peor caso, una espera de tl;dv más una del clasificador. Si eso no
     cabe en lo que queda, se para ACÁ y las que faltan quedan para la próxima corrida: no se crearon
     filas, así que el descarte no las conoce y vuelven a entrar. */
  const porReunion = TLDV_WAIT_MS + CLASSIFY_WAIT_MS + MARGEN_MS;
  let examinadas = 0;
  for (const m of nuevas) {
    if (examinadas >= tope || restante(reloj) < porReunion) break;
    examinadas++;
    const externa = m.externalMeetingId;

    let transcripcion: NormalizedTranscript;
    try {
      transcripcion = await fetchTranscript(claveTldv, externa, TLDV_WAIT_MS);
    } catch (e) {
      if (e instanceof TldvError && e.kind === 'llave') return { tipo: 'falta', que: 'llave_de_tldv_rechazada' };
      out.pendientesDeTranscripcion++; // aún no lista, o tl;dv falló: la retoma la próxima corrida
      continue;
    }

    let cls;
    try {
      cls = await classifyCallType(transcripcion.fullText, {
        title: m.title,
        attendeeEmails: (m.invitees || []).map((p) => p.email),
        apiKey: claveIa,
        waitMs: CLASSIFY_WAIT_MS,
      });
    } catch (e) {
      // `classifyCallType` solo relanza una llave rechazada: todo lo demás ya es `null`.
      if (e instanceof AnalyzerCallError) return { tipo: 'falta', que: 'llave_de_ia_rechazada' };
      throw e;
    }
    if (!cls) {
      out.sinClasificar++;
      continue;
    }

    const datosDuros = {
      proveedor: 'TLDV' as const,
      reunionExternaId: externa,
      titulo: m.title || m.prospectName || 'Reunión tl;dv',
      prospectoNombre: m.prospectName || null,
      prospectoEmail: m.prospectEmail || null,
      fechaDeLaReunion: m.happenedAt || null,
      duracionSeg: m.durationSec ?? null,
      organizadorNombre: m.organizer?.name ?? null,
      organizadorEmail: m.organizerEmail ?? null,
      urlDeLaGrabacion: m.meetingUrl ?? null,
      invitados: m.invitees ?? null,
      metaDelProveedor: m.providerMeta ?? null,
    };

    if (cls.tipo === 'OTRO') {
      /* Fila VISIBLE y no lápida muda, como en el origen: una reunión que desaparece sin explicación
         genera soporte. Y con su transcripción, para poder reencaminarla sin volver a bajarla. */
      const id = await crearLlamadaConTranscripcion(
        orgId,
        {
          ...datosDuros,
          tipo: 'OTRO',
          estado: 'NOT_MATCH',
          prospectoId: null,
          motivo: cls.reason || 'El clasificador determinó que no es una llamada HT ni OB.',
        },
        transcripcion,
        true,
      );
      if (id !== null) out.internas++;
      continue;
    }

    const prospectoId = await prospectoDeLaLlamada(orgId, m.prospectName || null, m.prospectEmail || null);
    const id = await crearLlamadaConTranscripcion(
      orgId,
      { ...datosDuros, tipo: cls.tipo, estado: 'PENDING', prospectoId, motivo: null },
      transcripcion,
      true,
    );
    // `null` = la carrera con el botón: la otra corrida ya la guardó. No es un error.
    if (id !== null) out.descubiertas++;
  }
  out.sinExaminar = nuevas.length - examinadas;
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · ANALIZAR
// ═══════════════════════════════════════════════════════════════════════════════

export type RechazoDelAnalisis =
  | 'no_encontrada'
  | 'tipo_otro'
  | 'analizador_no_disponible'
  | 'sin_transcripcion'
  | 'llamada_en_curso'
  /** Ya no está en el estado que vio quien pidió analizarla: otra corrida la terminó o la movió. */
  | 'llamada_cambio'
  | 'sin_tiempo'
  /** La llave de IA dejó de servir (401, 403 o sin saldo). La llamada volvió a su estado. */
  | 'llave_de_ia_rechazada'
  /** El servicio está saturado (429, 529). La llamada volvió a su estado: se reintenta después. */
  | 'modelo_saturado';

export type ResultadoDelAnalisis =
  | { tipo: 'hecho'; estado: 'DONE' | 'NOT_MATCH' | 'FAILED'; motivo: string | null; error: string | null }
  | { tipo: 'rechazo'; que: RechazoDelAnalisis };

/**
 * Analiza UNA llamada guardada y deja su estado final.
 *
 * El orden es el del origen (`analyzeStoredCall`), con una diferencia: el paso a ANALYZING es un
 * candado. Todo lo que puede rechazar sin gastar —no existe, es OTRO, no hay transcripción, no hay
 * tiempo— va ANTES del candado, así una llamada rechazada no queda tomada. Y lo que puede fallar
 * después del candado termina SIEMPRE en DONE, NOT_MATCH o FAILED: nunca queda en ANALYZING por un
 * error nuestro.
 */
export async function analizarLlamada(
  orgId: string,
  llamadaId: string,
  claveIa: string,
  reloj: Reloj,
  /** El estado en que la vio quien pide analizarla. Ver `tomarParaAnalizar`. */
  esperado: EstadoTomable = 'PENDING',
): Promise<ResultadoDelAnalisis> {
  const llamada = await leerParaAnalizar(orgId, llamadaId);
  if (!llamada) return { tipo: 'rechazo', que: 'no_encontrada' };
  if (llamada.tipo === 'OTRO') return { tipo: 'rechazo', que: 'tipo_otro' };
  if (!TIPOS_QUE_SE_ANALIZAN.includes(llamada.tipo)) return { tipo: 'rechazo', que: 'analizador_no_disponible' };
  if (llamada.estado !== esperado) {
    return { tipo: 'rechazo', que: llamada.estado === 'ANALYZING' ? 'llamada_en_curso' : 'llamada_cambio' };
  }
  if (!llamada.transcripcion) return { tipo: 'rechazo', que: 'sin_transcripcion' };
  const espera = esperaDisponible(reloj);
  if (espera === null) return { tipo: 'rechazo', que: 'sin_tiempo' };
  const tipo = llamada.tipo;
  if (!(await tomarParaAnalizar(orgId, llamadaId, esperado, tipo))) return { tipo: 'rechazo', que: 'llamada_en_curso' };

  try {
    const r = await runAnalysis(tipo, llamada.transcripcion, claveIa, espera);
    const comun = { tipo, modelo: r.model, uso: r.usage, costoUsd: r.costUsd, versionDeRubrica: r.rubricVersion };
    if (!r.matched) {
      await terminarConVeto(orgId, llamadaId, { ...comun, motivo: r.reason });
      return { tipo: 'hecho', estado: 'NOT_MATCH', motivo: r.reason, error: null };
    }
    await terminarConAnalisis(orgId, llamadaId, { ...comun, analisis: r.analysis, columnas: r.cols });
    return { tipo: 'hecho', estado: 'DONE', motivo: null, error: null };
  } catch (e) {
    /* La llave que ya no sirve y el servicio saturado NO son fallos de la llamada: el análisis no
       llegó a ocurrir, y el próximo intento con la llave arreglada o en un rato la analiza. Vuelve
       a su estado, con su error de antes si lo tenía. */
    if (isUnusableKey(e) || isOverloaded(e)) {
      await devolverAlEstado(orgId, llamadaId, esperado);
      return { tipo: 'rechazo', que: isUnusableKey(e) ? 'llave_de_ia_rechazada' : 'modelo_saturado' };
    }
    const error = errorParaGuardar(e);
    try {
      await terminarConFallo(orgId, llamadaId, error);
    } catch (e2) {
      // Si ni el fallo se puede guardar —la llamada se borró mientras se analizaba—, queda en el registro.
      console.error('analizadores: no se pudo marcar el fallo de la llamada', llamadaId, e2);
    }
    return { tipo: 'hecho', estado: 'FAILED', motivo: null, error };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LA FICHA DEL PROSPECTO
// ═══════════════════════════════════════════════════════════════════════════════

/** El texto del origen, byte a byte: es parte del prompt de la ficha. */
function cabeceraDeContexto(l: LlamadaParaAnalizar): string {
  const partes: string[] = [];
  if (l.organizadorNombre || l.organizadorEmail) {
    partes.push(`EL CLOSER (nuestro lado) es: ${l.organizadorNombre || l.organizadorEmail}`);
  }
  if (l.prospectoNombre) partes.push(`EL PROSPECTO es: ${l.prospectoNombre}`);
  if (partes.length === 0) return '';
  return `CONTEXTO (solo para que sepas quién habla; NO lo repitas en tu respuesta):\n${partes.join('\n')}`;
}

export type ResultadoDeLaFicha =
  | { tipo: 'hecho'; estado: 'OK' | 'FAILED'; error: string | null }
  | {
      tipo: 'rechazo';
      que:
        | 'no_encontrada'
        | 'ficha_solo_ht'
        | 'sin_analisis'
        | 'sin_transcripcion'
        | 'sin_tiempo'
        | 'llave_de_ia_rechazada'
        | 'modelo_saturado';
    };

/**
 * Genera la ficha de una HT ya analizada. **No lanza**: un fallo queda en la fila de la ficha como
 * FAILED y la llamada sigue DONE con su análisis intacto. Es la regla R2 del paquete —un análisis
 * derivado jamás degrada el principal—, y la tabla aparte la vuelve física: una ficha no puede pisar
 * un análisis.
 */
export async function generarFicha(
  orgId: string,
  llamadaId: string,
  claveIa: string,
  reloj: Reloj,
): Promise<ResultadoDeLaFicha> {
  const llamada = await leerParaAnalizar(orgId, llamadaId);
  if (!llamada) return { tipo: 'rechazo', que: 'no_encontrada' };
  if (llamada.tipo === 'OTRO') return { tipo: 'rechazo', que: 'ficha_solo_ht' };
  const [def] = insightsFor(llamada.tipo);
  if (!def) return { tipo: 'rechazo', que: 'ficha_solo_ht' };
  if (llamada.estado !== 'DONE') return { tipo: 'rechazo', que: 'sin_analisis' };
  if (!llamada.transcripcion) return { tipo: 'rechazo', que: 'sin_transcripcion' };
  const espera = esperaDisponible(reloj);
  if (espera === null) return { tipo: 'rechazo', que: 'sin_tiempo' };

  try {
    const r = await runInsight(def.kind, llamada.transcripcion, {
      apiKey: claveIa,
      contextHeader: cabeceraDeContexto(llamada),
      waitMs: espera,
    });
    await guardarFicha(orgId, llamadaId, {
      estado: 'OK',
      tipo: 'HT',
      ficha: r.insight,
      columnas: r.cols,
      modelo: r.model,
      uso: r.usage,
      costoUsd: r.costUsd,
      versionDeRubrica: r.rubricVersion,
    });
    return { tipo: 'hecho', estado: 'OK', error: null };
  } catch (e) {
    /* Con la llave rota o el servicio saturado la ficha no llegó a intentarse: no se guarda una
       FAILED, que no se reintenta sola y quedaría así para siempre por un problema de la llave. */
    if (isUnusableKey(e)) return { tipo: 'rechazo', que: 'llave_de_ia_rechazada' };
    if (isOverloaded(e)) return { tipo: 'rechazo', que: 'modelo_saturado' };
    const error = errorParaGuardar(e);
    try {
      await guardarFicha(orgId, llamadaId, { estado: 'FAILED', error });
    } catch {
      /* Si ni el fallo se puede guardar, la fila no existe y la tarea la vuelve a intentar: es lo que
         `llamadasSinFicha` busca. */
    }
    return { tipo: 'hecho', estado: 'FAILED', error };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LA TRANSCRIPCIÓN PEGADA A MANO
// ═══════════════════════════════════════════════════════════════════════════════

/** El tope de una transcripción pegada: el del origen. */
export const TOPE_DE_LA_TRANSCRIPCION = 200_000;

/**
 * ¿La transcripción pegada trae marcas de tiempo?
 *
 * Hace falta saberlo porque el parser del núcleo, a una línea sin `[mm:ss]`, le pone como segundo de
 * inicio **su número de línea**. La evidencia citada mostraría entonces «00:00:14» para la línea 14,
 * y se leería como un tiempo real de la grabación. Con este dato, la pantalla lo avisa.
 *
 * El patrón es el mismo de `parseTranscriptInput` (`nucleo/transcript.ts`): si ahí cambia, acá tiene
 * que cambiar igual.
 */
export function tieneMarcasDeTiempo(crudo: string): boolean {
  const texto = crudo.trim();
  try {
    const json = JSON.parse(texto) as unknown;
    const arr = Array.isArray(json) ? json : (json as { segments?: unknown[] } | null)?.segments;
    if (Array.isArray(arr)) {
      return arr.some((item) => {
        const s = (item ?? {}) as Record<string, unknown>;
        return s['startTime'] !== undefined || s['startSec'] !== undefined || s['start'] !== undefined;
      });
    }
  } catch {
    // no es JSON: cae a texto plano
  }
  return texto.split(/\r?\n/).some((l) => /^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+/.test(l.trim()));
}

/**
 * Guarda una transcripción pegada a mano como una llamada PENDING, con su prospecto. **No la
 * analiza**: eso lo hace `analizarLlamada`, el mismo camino que las de tl;dv.
 */
export async function crearManual(
  orgId: string,
  entrada: { tipo: 'HT' | 'OB'; nombre: string; email: string; transcripcion: string },
): Promise<string> {
  const crudo = entrada.transcripcion.slice(0, TOPE_DE_LA_TRANSCRIPCION);
  const transcripcion = parseTranscriptInput(crudo, 'manual');
  const prospectoId = await prospectoDeLaLlamada(orgId, entrada.nombre, entrada.email);
  const id = await crearLlamadaConTranscripcion(
    orgId,
    {
      tipo: entrada.tipo,
      proveedor: 'MANUAL',
      estado: 'PENDING',
      reunionExternaId: null,
      titulo: entrada.nombre || 'Análisis manual',
      prospectoId,
      prospectoNombre: entrada.nombre || null,
      prospectoEmail: entrada.email || null,
      motivo: null,
      fechaDeLaReunion: null,
      duracionSeg: null,
      organizadorNombre: null,
      organizadorEmail: null,
      urlDeLaGrabacion: null,
      invitados: null,
      metaDelProveedor: null,
    },
    transcripcion,
    tieneMarcasDeTiempo(crudo),
  );
  // Sin identificador externo no hay único con qué chocar: `null` acá sería un error de la base.
  if (id === null) throw new Error('la llamada manual no se pudo crear');
  return id;
}
