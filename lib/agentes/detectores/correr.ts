// La pasada diaria de los detectores de una empresa: la tarea `senales` del cron
// (`docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`, AG-35). Corre FUERA de todo contexto de organización y
// abre el suyo, como las demás tareas del barrido.
//
// ═══════════════════════════════════════════════════════════════════════════════
// A QUIÉN LE TOCA
//
// El cron dispara cada hora en UTC (`23 * * * *`) y cada empresa tiene su mañana: le toca a la que ya pasó
// las 6:00 de SU zona y todavía tiene algún departamento sin la pasada de su día local. «Ya corrió» se decide
// por departamento y es el plan guardado (las dos ventanas): si Creative falló, se reintenta la hora
// siguiente aunque Acquisition haya terminado.
//
// A la que no le toca no se la sella, y quien llama lo respeta: `sellar` guarda una sola fila por empresa y
// tarea, y la frescura mide su fecha. Un sello de «no me tocaba» cada hora haría parecer al día una tarea
// diaria que no corrió. La única excepción es la primera pasada del día de una empresa sin departamentos
// pendientes —hoy, todas: el catálogo de detectores nace vacío en AG8—, que sí se sella una vez, para que la
// frescura diga que la tarea pasó.
//
// ── PRIMERO SE MIDE, DESPUÉS SE ESCRIBE ──────────────────────────────────────
//
// La medición de cada ventana va en su propia transacción y las señales con su plan en otra, juntas: un
// departamento que falla a mitad no deja plan, y por eso se reintenta. La redacción del plan con el modelo
// (AG9) va después, y si no llega queda el de plantillas.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { conOrganizacion, datos } from '../../datos/contexto.ts';
import { diaEnZona, horaDelDiaEnZona } from '../../negocio/tiempo.ts';
import { guardarPlan, guardarRedaccion } from '../plan/guardar.ts';
import { reconciliarSenales, type ResumenDeLaReconciliacion } from '../senales/escritura.ts';
import { umbralesFirmados } from '../senales/umbrales.ts';
import { DETECTOR_DE_ACQUISITION } from './detector-de-acquisition.ts';
import { DETECTOR_DE_CREATIVE } from './detector-de-creative.ts';
import { DETECTOR_DE_CONVERSATION } from './detector-de-conversation.ts';
import {
  type DebajoDelPiso,
  type DepartamentoConSenales,
  type Deteccion,
  VENTANAS_DE_LAS_SENALES,
  type VentanaDeSenal,
  huellaDe,
} from '../senales/tipos.ts';

/** La hora local desde la que le toca a una empresa (AG-35). */
export const HORA_DE_LA_PASADA = 6;

export interface ContextoDelDetector {
  zona: string;
  ventana: VentanaDeSenal;
  /** El día local de la pasada, `AAAA-MM-DD`. */
  dia: string;
  ahora: Date;
  /** Los umbrales que el Admin firmó en esta empresa. */
  firmados: ReadonlyMap<string, number>;
}

export interface ResultadoDelDetector {
  detecciones: readonly Deteccion[];
  /** Las reglas cuya fuente no llegó: lo suyo que no se detectó queda `sin_medicion`. */
  sinMedicion: readonly string[];
  debajoDelPiso: readonly DebajoDelPiso[];
  /** La ventana sobre la que se midió, para que el plan la declare (A6-23). */
  periodo?: { desde: string; hasta: string };
}

/** Lo que recibe el armado del plan: lo vigente después de reconciliar. */
export interface ParaElPlan extends ResultadoDelDetector {
  ventana: VentanaDeSenal;
  dia: string;
  /** Las detecciones que nadie descartó ni resolvió todavía (A6-20). */
  vigentes: readonly Deteccion[];
}

export interface Detector {
  departamento: DepartamentoConSenales;
  /** Va a la columna `detector` de cada señal. */
  nombre: string;
  /** Corre dentro de la `conOrganizacion` que abre la pasada: sólo lee. */
  detectar: (c: ContextoDelDetector) => Promise<ResultadoDelDetector>;
  /** El plan con plantillas y el formato del departamento (AG-32). Puro. */
  armarPlan: (p: ParaElPlan) => unknown;
  /**
   * Pide al modelo la redacción del plan ya guardado, si el departamento la tiene. Devuelve `null` si no hubo
   * nada que redactar o el modelo no contestó: entonces queda el de plantillas.
   */
  redactar?: (plan: unknown, c: { llave: string; orgId: string; espera: number }) => Promise<unknown | null>;
}

/** El tope de cada llamada de la redacción, como el del cerebro: 120 s (`02`, AG-35). */
const ESPERA_DE_LA_REDACCION_MS = 120_000;
/** Lo que se le deja a la función para sellar y contestar después de la última llamada. */
const MARGEN_DEL_FINAL_MS = 15_000;
/** Debajo de esto no se pide: la llamada terminaría cortada y se pagaría igual. */
const ESPERA_MINIMA_DE_LA_REDACCION_MS = 20_000;

/** Los detectores construidos: Acquisition desde AG9, Creative desde AG10, Conversation desde AG13; Conversion, en su etapa. */
export const DETECTORES: readonly Detector[] = [DETECTOR_DE_ACQUISITION, DETECTOR_DE_CREATIVE, DETECTOR_DE_CONVERSATION];

export interface RenglonDeLaPasada {
  departamento: DepartamentoConSenales;
  estado: 'corrio' | 'ya_corrio' | 'fallo';
  /** Qué pasó con la redacción de cada ventana: sin llave no se pide; sin tiempo, tampoco. */
  redaccion?: Partial<Record<VentanaDeSenal, 'redactada' | 'sin_llave' | 'sin_tiempo' | 'sin_respuesta' | 'no_aplica'>>;
  /** Lo que hizo la reconciliación en cada ventana, en cuentas. */
  ventanas?: Partial<Record<VentanaDeSenal, Omit<ResumenDeLaReconciliacion, 'debajoDelPiso'> & { debajoDelPiso: number }>>;
}

export type ResultadoDeLaPasada =
  | { tocaba: false; porque: string }
  | { tocaba: true; dia: string; departamentos: RenglonDeLaPasada[]; departamentosQueFallaron: number };

export async function correrLaPasada(
  org: { id: string; zonaHoraria: string },
  opciones: {
    ahora: Date;
    detectores?: readonly Detector[];
    /** La llave de IA de la empresa, para redactar el plan. `null` o ausente: el plan queda con plantillas. */
    llave?: string | null;
    /** Hasta cuándo puede llamar al modelo, en milisegundos del reloj de `ahoraMs`. */
    hasta?: number;
    ahoraMs?: () => number;
  },
): Promise<ResultadoDeLaPasada> {
  const { ahora } = opciones;
  const zona = org.zonaHoraria;
  const detectores = opciones.detectores ?? DETECTORES;
  if (horaDelDiaEnZona(ahora, zona) < HORA_DE_LA_PASADA) {
    return { tocaba: false, porque: `todavía no son las ${HORA_DE_LA_PASADA}:00 en ${zona}` };
  }
  const dia = diaEnZona(ahora, zona);

  const { hechos, selladaHoy } = await conOrganizacion(org.id, async () => {
    const planes = await datos()
      .selectFrom('planes_de_accion')
      .select(['departamento', 'ventana'])
      .where(sql<boolean>`dia = ${dia}::date`)
      .execute();
    const sello = await datos()
      .selectFrom('tareas_programadas')
      .select(['ultima_corrida_el', 'ultimo_estado'])
      .where('tarea', '=', 'senales')
      .executeTakeFirst();
    return {
      hechos: new Set(planes.map((p) => `${p.departamento}·${p.ventana}`)),
      selladaHoy: sello !== undefined && sello.ultimo_estado === 'corrio' && diaEnZona(sello.ultima_corrida_el, zona) === dia,
    };
  });
  const yaCorrio = (d: Detector) => VENTANAS_DE_LAS_SENALES.every((v) => hechos.has(`${d.departamento}·${v}`));
  if (detectores.every(yaCorrio) && selladaHoy) return { tocaba: false, porque: 'ya corrió hoy' };

  const departamentos: RenglonDeLaPasada[] = [];
  for (const detector of detectores) {
    if (yaCorrio(detector)) {
      departamentos.push({ departamento: detector.departamento, estado: 'ya_corrio' });
      continue;
    }
    try {
      const ventanas: RenglonDeLaPasada['ventanas'] = {};
      const redaccion: NonNullable<RenglonDeLaPasada['redaccion']> = {};
      for (const ventana of VENTANAS_DE_LAS_SENALES) {
        const medido = await conOrganizacion(org.id, async () =>
          detector.detectar({ zona, ventana, dia, ahora, firmados: await umbralesFirmados() }),
        );
        let planGuardado: unknown = null;
        const resumen = await conOrganizacion(org.id, async () => {
          const r = await reconciliarSenales({
            departamento: detector.departamento,
            detector: detector.nombre,
            ventana,
            detecciones: medido.detecciones,
            sinMedicion: medido.sinMedicion,
          });
          const debajoDelPiso = [...medido.debajoDelPiso, ...r.debajoDelPiso];
          const decididas = new Set(r.decididas);
          const vigentes = medido.detecciones.filter(
            (d) => !decididas.has(huellaDe(detector.departamento, d, ventana)) && !debajoDelPiso.some((x) => x.regla === d.regla && x.entidad.tipo === d.entidad.tipo && x.entidad.id === d.entidad.id),
          );
          planGuardado = detector.armarPlan({ ...medido, debajoDelPiso, ventana, dia, vigentes });
          await guardarPlan({ departamento: detector.departamento, ventana, dia, plan: planGuardado, debajoDelPiso });
          return r;
        });
        ventanas[ventana] = { ...resumen, debajoDelPiso: medido.debajoDelPiso.length + resumen.debajoDelPiso.length };
        redaccion[ventana] = await redactar(detector, planGuardado, ventana);
      }
      departamentos.push({ departamento: detector.departamento, estado: 'corrio', ventanas, redaccion });
    } catch (e) {
      // El mensaje va al registro y no al cuerpo (`ADR-0704`): puede llevar nombres de tabla.
      console.error(`senales: falló la pasada de ${detector.departamento}`, e);
      departamentos.push({ departamento: detector.departamento, estado: 'fallo' });
    }
  }
  return { tocaba: true, dia, departamentos, departamentosQueFallaron: departamentos.filter((d) => d.estado === 'fallo').length };

  /**
   * Primero se guardó el plan con plantillas; esto lo mejora si se puede (AG-35). La espera es la menor entre
   * 120 s y lo que le queda a la función menos 15 s, y sin tiempo suficiente no se pide: se pagaría una llamada
   * que termina cortada. Un fallo del modelo deja su uso y su incidente por el transporte, y el plan de plantillas.
   */
  async function redactar(detector: Detector, plan: unknown, ventana: VentanaDeSenal) {
    if (!detector.redactar) return 'no_aplica' as const;
    if (!opciones.llave) return 'sin_llave' as const;
    const ahoraMs = opciones.ahoraMs ?? Date.now;
    const queda = (opciones.hasta ?? Number.POSITIVE_INFINITY) - ahoraMs() - MARGEN_DEL_FINAL_MS;
    const espera = Math.min(ESPERA_DE_LA_REDACCION_MS, queda);
    if (espera < ESPERA_MINIMA_DE_LA_REDACCION_MS) return 'sin_tiempo' as const;
    const r = await detector.redactar(plan, { llave: opciones.llave, orgId: org.id, espera });
    if (r === null) return 'sin_respuesta' as const;
    await conOrganizacion(org.id, () => guardarRedaccion({ departamento: detector.departamento, ventana, dia, redaccion: r }));
    return 'redactada' as const;
  }
}
