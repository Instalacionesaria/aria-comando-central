// Los motivos de no venta: por qué dijo que no la gente que el closer registró como «No le interesa».
//
// ═══════════════════════════════════════════════════════════════════════════════
// DE DÓNDE SALEN, Y DE DÓNDE NO
//
// Del catálogo real de Avanzar: al registrar «No le interesa» el closer elige un motivo de una lista cerrada
// (`lib/negocio/salidas.ts`), y se guarda en `resultados.detalle`. Es la tarjeta «Motivos de no venta» del
// prototipo (`docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`, S15-11), con los motivos de verdad: los del
// prototipo no son de «No le interesa» —«No es quien decide» no existe en ningún catálogo, y «Pidió tiempo» es una
// opción de `nurture`, otra salida—.
//
// No salen de las objeciones que el modelo clasifica en las llamadas analizadas —son de una llamada, no de una
// pérdida, y piden otra capacidad— ni de los campos del CRM, que no los tienen
// (`docs/sales/05-LOS-MOTIVOS-DE-NO-VENTA.md`).
//
// Un `detalle` que no está en el catálogo —o que falta— no se reparte entre los motivos: se cuenta aparte. El
// texto nunca viaja: sólo el motivo cuando casa con el catálogo, y el conteo de los que no.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import type { CloserConfigurado } from './alcanceDelCloser.ts';
import { DIAS_DE_LA_TASA } from './indicadoresDeCitas.ts';
import { SALIDAS_DEL_CLOSER } from './salidas.ts';

/** Los motivos de «No le interesa», en el orden del catálogo de Avanzar. */
export const MOTIVOS_DE_NO_VENTA: readonly string[] = SALIDAS_DEL_CLOSER.find((s) => s.salida === 'no_interesa')!.opciones;

export interface FilaDeMotivo {
  motivo: string;
  resultados: number;
  /** Sobre el total de «No le interesa» de la ventana, de 0 a 1. */
  porcion: number;
}

export interface MotivosDeNoVenta {
  dias: number;
  /** Los «No le interesa» de los closers en la ventana. */
  total: number;
  /** Una por motivo del catálogo con al menos un resultado, en el orden del catálogo. */
  filas: FilaDeMotivo[];
  /** Los que no traen motivo, o traen uno que no está en el catálogo. */
  fueraDelCatalogo: number;
  /** Su porción sobre el total. `null` sin ninguno. */
  porcionFueraDelCatalogo: number | null;
}

/** Reparte los conteos por motivo. Puro: la prueba lo arma con números a mano. */
export function repartirMotivos(dias: number, conteos: readonly { detalle: string | null; n: number }[]): MotivosDeNoVenta {
  const total = conteos.reduce((s, c) => s + c.n, 0);
  const porMotivo = new Map<string, number>();
  let fueraDelCatalogo = 0;
  for (const c of conteos) {
    if (c.detalle !== null && MOTIVOS_DE_NO_VENTA.includes(c.detalle)) {
      porMotivo.set(c.detalle, (porMotivo.get(c.detalle) ?? 0) + c.n);
    } else {
      fueraDelCatalogo += c.n;
    }
  }
  const filas = MOTIVOS_DE_NO_VENTA.filter((m) => (porMotivo.get(m) ?? 0) > 0).map((m) => ({
    motivo: m,
    resultados: porMotivo.get(m)!,
    porcion: porMotivo.get(m)! / total,
  }));
  return {
    dias,
    total,
    filas,
    fueraDelCatalogo,
    porcionFueraDelCatalogo: fueraDelCatalogo === 0 ? null : fueraDelCatalogo / total,
  };
}

/**
 * Los motivos de la ventana, de los closers configurados. Corre dentro de `conOrganizacion`.
 *
 * La ventana es la de lo registrado en la tabla de closers: `creado_el` desde hace `dias` días
 * (`lib/negocio/cierrePorCloser.ts`, el eje propio), para que los motivos y «{N} sin venta» hablen de la misma
 * ventana. No cuentan lo mismo: «{N} sin venta» suma toda salida que no es venta —seguimiento, no show, nurture—, y
 * los motivos sólo los «No le interesa».
 * Sin closers no se consulta: un `in ()` es SQL inválido, y no hay de quién contar.
 */
export async function motivosDeNoVenta(
  dias = DIAS_DE_LA_TASA,
  closers: readonly CloserConfigurado[],
): Promise<MotivosDeNoVenta> {
  if (closers.length === 0) return repartirMotivos(dias, []);
  const filas = await datos()
    .selectFrom('resultados')
    .select(['detalle', sql<number>`count(*)`.as('n')])
    .where('salida', '=', 'no_interesa')
    .where('registrado_por', 'in', closers.map((c) => c.usuarioId))
    .where(sql<boolean>`creado_el >= now() - make_interval(days => ${dias})`)
    .groupBy('detalle')
    .execute();
  return repartirMotivos(dias, filas.map((f) => ({ detalle: f.detalle, n: Number(f.n) })));
}
