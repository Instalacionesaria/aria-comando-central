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
import { guardarPlan } from '../plan/guardar.ts';
import { reconciliarSenales, type ResumenDeLaReconciliacion } from '../senales/escritura.ts';
import { umbralesFirmados } from '../senales/umbrales.ts';
import {
  type DebajoDelPiso,
  type DepartamentoConSenales,
  type Deteccion,
  VENTANAS_DE_LAS_SENALES,
  type VentanaDeSenal,
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
  /** El plan armado con plantillas, con el formato de su departamento (AG-32). */
  plan: unknown;
}

export interface Detector {
  departamento: DepartamentoConSenales;
  /** Va a la columna `detector` de cada señal. */
  nombre: string;
  /** Corre dentro de la `conOrganizacion` que abre la pasada: sólo lee. */
  detectar: (c: ContextoDelDetector) => Promise<ResultadoDelDetector>;
}

/** Los detectores construidos. Vacío en AG8: Acquisition llega en AG9. Ver el encabezado. */
export const DETECTORES: readonly Detector[] = [];

export interface RenglonDeLaPasada {
  departamento: DepartamentoConSenales;
  estado: 'corrio' | 'ya_corrio' | 'fallo';
  /** Lo que hizo la reconciliación en cada ventana, en cuentas. */
  ventanas?: Partial<Record<VentanaDeSenal, Omit<ResumenDeLaReconciliacion, 'debajoDelPiso'> & { debajoDelPiso: number }>>;
}

export type ResultadoDeLaPasada =
  | { tocaba: false; porque: string }
  | { tocaba: true; dia: string; departamentos: RenglonDeLaPasada[]; departamentosQueFallaron: number };

export async function correrLaPasada(
  org: { id: string; zonaHoraria: string },
  opciones: { ahora: Date; detectores?: readonly Detector[] },
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
      for (const ventana of VENTANAS_DE_LAS_SENALES) {
        const medido = await conOrganizacion(org.id, async () =>
          detector.detectar({ zona, ventana, dia, ahora, firmados: await umbralesFirmados() }),
        );
        const resumen = await conOrganizacion(org.id, async () => {
          const r = await reconciliarSenales({
            departamento: detector.departamento,
            detector: detector.nombre,
            ventana,
            detecciones: medido.detecciones,
            sinMedicion: medido.sinMedicion,
          });
          await guardarPlan({
            departamento: detector.departamento,
            ventana,
            dia,
            plan: medido.plan,
            debajoDelPiso: [...medido.debajoDelPiso, ...r.debajoDelPiso],
          });
          return r;
        });
        ventanas[ventana] = { ...resumen, debajoDelPiso: medido.debajoDelPiso.length + resumen.debajoDelPiso.length };
      }
      departamentos.push({ departamento: detector.departamento, estado: 'corrio', ventanas });
    } catch (e) {
      // El mensaje va al registro y no al cuerpo (`ADR-0704`): puede llevar nombres de tabla.
      console.error(`senales: falló la pasada de ${detector.departamento}`, e);
      departamentos.push({ departamento: detector.departamento, estado: 'fallo' });
    }
  }
  return { tocaba: true, dia, departamentos, departamentosQueFallaron: departamentos.filter((d) => d.estado === 'fallo').length };
}
