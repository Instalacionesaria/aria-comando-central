// **El único escritor de `negocio.uso_de_ia`** (`069`): lo que consume cada llamada al modelo de IA.
//
// ═══════════════════════════════════════════════════════════════════════════════
// UNA FILA POR LLAMADA, Y NINGUNA PALABRA DE LO QUE SE DIJO
//
// Hasta AG1 sólo los Analizadores guardaban sus tokens, y en su propio registro de análisis; los demás los
// devolvían o ni los leían, y nadie los persistía. Esta tabla es la única fuente del consumo de IA
// (`docs/OTROS/agentes/06-MODELOS-USO-TOPES-E-INCIDENTES.md`, AG-94). Guarda el agente, el modelo, los
// cuatro contadores, la duración, el resultado, quién pidió y una referencia; ni el prompt ni la
// respuesta (`ADR-0407`).
//
// ── NUNCA LANZA ──────────────────────────────────────────────────────────────
//
// Se llama cuando la llamada ya se pagó, o ya falló. Si la base no contesta o la tabla todavía no existe
// (la migración corre aparte del despliegue), deja una línea en el registro y sigue: anotar el consumo
// no puede tumbar la respuesta que la persona está esperando. Es la forma de `registrarIncidente`
// (`lib/incidentes/registro.ts`), y se ESPERA por su mismo motivo: en Vercel una promesa sin esperar
// puede quedar congelada cuando la función responde.
//
// ── SU PROPIA TRANSACCIÓN, SIEMPRE ───────────────────────────────────────────
//
// `conOrganizacion` abre una transacción nueva, en otra conexión, aunque ya haya una abierta
// (`lib/datos/contexto.ts`). Acá eso es lo que se quiere, por dos motivos:
//
//   · el consumo ya se pagó: si lo que hacía quien llama se revierte, la fila del uso tiene que quedar;
//   · un `insert` que falla ABORTA la transacción donde corre, y el `catch` de acá no la desaborta
//     (`lib/fundaciones/historico.ts`, `enSuPropiaTransaccion`): colgado de la de afuera, un fallo al
//     anotar el uso se llevaría puesto lo que esa transacción ya había escrito.
//
// Pero no se la llama con una abierta (`docs/OTROS/agentes/01-LA-ARQUITECTURA.md`, AG-05): el modelo se
// espera fuera de toda transacción y el uso se anota después. Si igual pasa, se escribe en la suya y se
// deja una línea que lo dice, en vez de perder la fila: el defecto —una de las cinco conexiones del
// agrupador retenida mientras se esperaba al modelo— queda a la vista. Con el agrupador lleno, esta
// conexión espera hasta su tope (`lib/datos/capa.ts`) y el `catch` la pierde, con su línea.
// ═══════════════════════════════════════════════════════════════════════════════

import { conOrganizacion, datos, hayOrganizacion } from '../datos/contexto.ts';
import type { TokenUsage } from '../analizadores/nucleo/pricing.ts';
import type { SituacionDelModelo } from '../fundaciones/fallo-del-modelo.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Quién consume. Un juego cerrado: el `check` de la `069` tiene la MISMA lista, y
 * `pruebas/base/200-el-uso-de-la-ia.test.ts` compara las dos. Sumar uno es sumarlo acá y en una migración
 * que suelte y vuelva a poner `uso_de_ia_agente_check`.
 */
export const AGENTES_DE_USO = [
  'executive',
  'plan',
  'reunion',
  'brief',
  'objeciones',
  'fundaciones_generar',
  'fundaciones_conversar',
  'fundaciones_rellenar',
  'espia',
  'auditor',
  'auditor_mejora',
  'analizador_clasificar',
  'analizador_analizar',
  'analizador_ficha',
] as const;

export type AgenteDeUso = (typeof AGENTES_DE_USO)[number];

/**
 * Los que llaman al modelo por el transporte de los agentes (`llamada.ts`). Los demás conservan su
 * propio transporte (`docs/OTROS/agentes/01-LA-ARQUITECTURA.md`, AG-09) y anotan su uso directo con
 * `registrarUso`: desde AG2 el Espía, el auditor y los Analizadores; Fundaciones, cuando se integre la
 * rama `feature/icp-oferta-v2`. El compilador no los deja entrar por la puerta equivocada.
 */
export type AgenteNuevo = Extract<AgenteDeUso, 'executive' | 'plan' | 'reunion' | 'brief' | 'objeciones'>;

/** El largo máximo de `ref`, el mismo del `check` de la `069`: una referencia, nunca un texto. */
const LARGO_MAXIMO_DE_REF = 64;

export interface NuevoUso {
  orgId: string;
  agente: AgenteDeUso;
  /** El identificador que viajó en el cuerpo. */
  modelo: string;
  /** `null` cuando el proveedor no contestó: no se sabe qué consumió, y un cero diría que nada. */
  uso: TokenUsage | null;
  /** Desde el primer intento hasta la respuesta, reintento y pausa incluidos. */
  duracionMs: number;
  /** `ok`, o la situación con que se clasificó el fallo. */
  resultado: 'ok' | SituacionDelModelo;
  /**
   * Quién pidió: la persona de la sesión, o `null` en el cron. Los agentes nuevos no llaman al modelo bajo
   * delegación (`D-17`); los que ya existían —el Espía, los Analizadores— sí, y acá queda la persona de la
   * sesión aunque esté actuando en otra empresa.
   */
  usuarioId: string | null;
  /** El hilo, el análisis o la referencia del incidente. */
  ref: string | null;
}

/** Anota una llamada. No lanza nunca: ver el encabezado. */
export async function registrarUso(u: NuevoUso): Promise<void> {
  // Sin una organización de verdad no hay dónde guardarlo (pruebas de código, caminos que no la conocen).
  if (!UUID.test(u.orgId)) return;
  if (hayOrganizacion()) {
    console.error(
      `uso: registrarUso con una transacción abierta (${u.agente}): se escribe en la suya, pero el modelo ` +
        'no se espera adentro de una (AG-05)',
    );
  }
  try {
    await conOrganizacion(u.orgId, async () => {
      await datos()
        .insertInto('uso_de_ia')
        .values({
          agente: u.agente,
          modelo: u.modelo,
          tokens_entrada: u.uso === null ? null : u.uso.input,
          tokens_salida: u.uso === null ? null : u.uso.output,
          tokens_escritura_cache: u.uso === null ? null : u.uso.cacheWrite,
          tokens_lectura_cache: u.uso === null ? null : u.uso.cacheRead,
          duracion_ms: Math.max(0, Math.round(u.duracionMs)),
          resultado: u.resultado,
          usuario_id: u.usuarioId && UUID.test(u.usuarioId) ? u.usuarioId : null,
          // Una referencia más larga no se guarda: el `check` la rechazaría y se perdería la fila entera.
          ref: u.ref !== null && u.ref.length <= LARGO_MAXIMO_DE_REF ? u.ref : null,
        } as never)
        .execute();
    });
  } catch (e) {
    console.error(`uso: no se pudo guardar el de ${u.agente} · ${e instanceof Error ? e.message : 'desconocido'}`);
  }
}
