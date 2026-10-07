// El detector de Creative Insights (`docs/OTROS/agentes/fichas/F06-CREATIVE-INSIGHTS.md`; `02`, AG-20 a AG-35).
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL GRANO ES LA PIEZA
//
// Creative publica sólo lo que es de la pieza o del anuncio (C11-04): la caída del CTR, la concentración del
// gasto en una pieza, la frecuencia de un anuncio y el ICP de una pieza. Lo de campaña y de conjunto —la
// entrega, el CPM, el costo por contacto, los cambios por conjunto— es de Acquisition (`./acquisition.ts`), y
// Creative no publica ni una señal con esas entidades. La pieza se identifica por su llave normalizada
// (`lib/negocio/creativo.ts`), la misma con que la pantalla agrupa: no hay otro identificador de una pieza.
//
// ── CONSUME LA LECTURA DE LA PANTALLA ────────────────────────────────────────
//
// Mide con `calidadDelCreativo`, `rendimientoDelCreativo` y `fatigaDelCreativo` con los mismos días que la
// pantalla (`app/api/creative/route.ts`), y la frecuencia con la misma ventana de métricas
// (`ventanaDeMetricas`). Esa ventana es móvil —llega hasta hoy— y no de días cerrados como la de Acquisition:
// es la de la pantalla de Creative, y una señal con otra ventana diría otra cifra que la que se ve.
//
// Lo que no se puede medir no se publica: sin la lectura de anuncios al día (`frescuraDe('anuncios')`), la
// caída del CTR, la concentración y la frecuencia van a «sin medición»; sin el campo de ICP en el CRM, la del ICP.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../../datos/contexto.ts';
import { calidadDelCreativo, type CalidadDeLosCreativos } from '../../negocio/calidadDelCreativo.ts';
import { rendimientoDelCreativo, PISO_DE_IMPRESIONES, type RendimientoDeLosCreativos } from '../../negocio/rendimientoDelCreativo.ts';
import { fatigaDelCreativo, type FatigaDeLosCreativos } from '../../negocio/fatigaDelCreativo.ts';
import { ventanaDeMetricas } from '../../negocio/costoDelAnuncio.ts';
import { diasSinCuadrar } from '../../negocio/gastoDeLaCuenta.ts';
import { llaveDelCreativo } from '../../negocio/creativo.ts';
import { type DebajoDelPiso, type Deteccion, type VentanaDeSenal } from '../senales/tipos.ts';
import type { ReglaDelCatalogo } from '../senales/umbrales.ts';

export const CRE = {
  caidaDeCtr: 'CRE-CAIDA-DE-CTR',
  concentracion: 'CRE-CONCENTRACION',
  frecuenciaAlta: 'CRE-FRECUENCIA-ALTA',
  icpPorPieza: 'CRE-ICP-POR-PIEZA',
} as const;

export const REGLAS_DE_CREATIVE: readonly ReglaDelCatalogo[] = [
  {
    codigo: CRE.caidaDeCtr,
    departamento: 'creative',
    valor: 0.25,
    unidad: 'proporcion',
    denominador: 'impresiones',
    gravedad: 'media',
    porque: 'Un cuarto menos de CTR entre la primera y la segunda mitad de la serie, con mil impresiones en cada mitad, es una pieza que se cansa; la pantalla avisa desde el 20 %, la señal pide un poco más para no repetirla cada mañana.',
  },
  {
    codigo: CRE.concentracion,
    departamento: 'creative',
    valor: 0.35,
    unidad: 'proporcion',
    denominador: null,
    gravedad: 'media',
    porque: 'Con tres piezas o más, que una se lleve más de un tercio del gasto deja la cuenta dependiendo de una sola pieza. Es presupuesto: requiere validación ejecutiva.',
  },
  {
    codigo: CRE.frecuenciaAlta,
    departamento: 'creative',
    valor: 3,
    unidad: 'veces',
    denominador: 'impresiones',
    gravedad: 'media',
    porque: 'Más de tres veces por persona en una semana, con mil impresiones, es la misma gente viendo el mismo anuncio.',
  },
  {
    codigo: CRE.icpPorPieza,
    departamento: 'creative',
    valor: 15,
    unidad: 'puntos',
    denominador: 'contactos con puntaje',
    gravedad: 'media',
    porque: 'Quince puntos de ICP bajo el promedio de las piezas de su etapa separan un tramo del otro (C7-10).',
  },
];

// ─── Lo medido ──────────────────────────────────────────────────────────────

export interface MedidaDeCreative {
  ventana: VentanaDeSenal;
  periodo: { desde: string; hasta: string };
  calidad: Pick<CalidadDeLosCreativos, 'filas' | 'campoDeIcp'>;
  rendimiento: Pick<RendimientoDeLosCreativos, 'filas'>;
  fatiga: Pick<FatigaDeLosCreativos, 'filas'>;
  /** La frecuencia media de cada anuncio, pesada por impresiones. Sólo en 7 días: la regla es semanal. */
  frecuencias: ReadonlyMap<string, { frecuencia: number; impresiones: number; creativo: string | null }> | null;
  /** Si la lectura de anuncios del cron está al día: sin ella, gasto y entrega no se miden. */
  anunciosAlDia: boolean;
  /**
   * Si el gasto por anuncio de la ventana cuadra con el de la cuenta (`076`). Sin eso, a la tabla le falta el
   * gasto de alguna campaña, y la parte del gasto de cada pieza sale sobre un total corto.
   */
  gastoCuadra: boolean;
}

/** Corre dentro de `conOrganizacion`. */
export async function medirCreative(ventana: VentanaDeSenal): Promise<MedidaDeCreative> {
  const dias = ventana === '7d' ? 7 : 30;
  const calidad = await calidadDelCreativo(dias);
  const rendimiento = await rendimientoDelCreativo(dias);
  const fatiga = await fatigaDelCreativo(dias);
  const bordes = await sql<{ desde: string; hasta: string }>`
    select to_char(current_date - ${dias - 1}::int, 'YYYY-MM-DD') as desde, to_char(current_date, 'YYYY-MM-DD') as hasta`.execute(datos());
  const frecuencias = ventana === '7d' ? await frecuenciaPorAnuncio(dias) : null;
  /* La frescura se carga acá y no arriba: `frescura.ts` lee los horarios de `barrido.ts`, que importa la pasada,
     que importa este detector y su plan. Importada arriba, el plan leería `CRE` antes de que exista. */
  const { frescuraDe } = await import('../../negocio/frescura.ts');
  const anuncios = await frescuraDe('anuncios');
  return {
    ventana,
    periodo: bordes.rows[0]!,
    calidad,
    rendimiento,
    fatiga,
    frecuencias,
    anunciosAlDia: anuncios.estado === 'al_dia',
    gastoCuadra: (await diasSinCuadrar((alias) => ventanaDeMetricas(alias, dias))) === 0,
  };
}

/**
 * La frecuencia de cada anuncio en la ventana, pesada por impresiones: el promedio simple de las de cada día
 * le daría a un día de cien impresiones el mismo peso que a uno de diez mil. Sólo los días que traen
 * frecuencia cuentan en las dos sumas, para que el denominador hable del mismo hecho que el numerador.
 */
async function frecuenciaPorAnuncio(dias: number): Promise<MedidaDeCreative['frecuencias']> {
  const filas = await datos()
    .selectFrom('metricas_de_anuncio as m')
    // Por las dos columnas, como `costoDelAnuncio`: sin `org_id` de los dos lados, el nombre podría ser de otro inquilino.
    .innerJoin('anuncios as a', (j) => j.onRef('a.org_id', '=', 'm.org_id').onRef('a.meta_anuncio_id', '=', 'm.meta_anuncio_id'))
    .select([
      'm.meta_anuncio_id as anuncio',
      llaveDelCreativo('a.nombre').as('creativo'),
      sql<string | null>`sum(m.impresiones) filter (where m.frecuencia is not null)`.as('impresiones'),
      sql<string | null>`sum(m.frecuencia * m.impresiones) filter (where m.frecuencia is not null)
        / nullif(sum(m.impresiones) filter (where m.frecuencia is not null), 0)`.as('frecuencia'),
    ])
    .where(ventanaDeMetricas('m', dias))
    .groupBy(['m.meta_anuncio_id', 'a.nombre'])
    .groupBy(llaveDelCreativo('a.nombre'))
    .execute();
  return new Map(
    filas
      .filter((f) => f.frecuencia !== null)
      .map((f) => [f.anuncio, { frecuencia: Number(f.frecuencia), impresiones: Number(f.impresiones ?? 0), creativo: f.creativo || null }]),
  );
}

// ─── Detectar, puro ─────────────────────────────────────────────────────────

type Umbral = (codigo: string) => { valor: number; provisional: boolean };
const redondear = (x: number, decimales = 2) => Math.round(x * 10 ** decimales) / 10 ** decimales;

export function detectarEnCreative(m: MedidaDeCreative, umbral: Umbral): { detecciones: Deteccion[]; debajoDelPiso: DebajoDelPiso[]; sinMedicion: string[] } {
  const salida = { detecciones: [] as Deteccion[], debajoDelPiso: [] as DebajoDelPiso[], sinMedicion: [] as string[] };
  const base = { periodo: m.periodo, datosDesde: null, destino: null, requiereValidacionEjecutiva: false, perdidaContactos: null };
  const impresionesDe = new Map(m.rendimiento.filas.map((f) => [f.creativo, f.impresiones ?? 0]));

  // ── El CTR de una pieza cae entre la primera y la segunda mitad de la serie ──
  if (!m.anunciosAlDia) {
    salida.sinMedicion.push(CRE.caidaDeCtr);
  } else {
    const u = umbral(CRE.caidaDeCtr);
    for (const f of m.fatiga.filas) {
      // Sin veredicto no se puede decir: la serie es corta o una mitad no llega al piso de impresiones.
      if (f.fatigado === null || f.caida === null || f.caida < u.valor) continue;
      salida.detecciones.push({
        ...base,
        regla: CRE.caidaDeCtr,
        entidad: { tipo: 'pieza', id: f.creativo },
        metrica: 'ctr',
        lineaBase: f.ctrTemprano,
        valorActual: f.ctrTardio,
        cambioPct: redondear(-f.caida, 4),
        muestra: impresionesDe.get(f.creativo) ?? null,
        gravedad: 'media',
        causasPosibles: ['puede deberse a que la audiencia ya vio la pieza', 'puede deberse a más competencia por la misma audiencia'],
        revisionRecomendada: 'Revisa si la pieza necesita una variante: su CTR va en baja dentro de la ventana.',
        umbral: u,
        evidencia: { ventana: m.ventana, creativo: f.creativo, dias: f.dias, desde: f.desde, hasta: f.hasta, ctrTemprano: f.ctrTemprano, ctrTardio: f.ctrTardio, caida: f.caida },
      });
    }
  }

  // ── Una pieza se lleva una parte grande del gasto ──
  // Con el gasto de la cuenta sin cuadrar, el total es corto y la parte de cada pieza sale inflada (`076`).
  if (!m.anunciosAlDia || !m.gastoCuadra) {
    salida.sinMedicion.push(CRE.concentracion);
  } else {
    const u = umbral(CRE.concentracion);
    const conGasto = m.rendimiento.filas.filter((f) => (f.gasto ?? 0) > 0);
    const total = conGasto.reduce((s, f) => s + (f.gasto ?? 0), 0);
    if (conGasto.length >= 3 && total > 0) {
      for (const f of conGasto) {
        const parte = (f.gasto ?? 0) / total;
        if (parte < u.valor) continue;
        salida.detecciones.push({
          ...base,
          regla: CRE.concentracion,
          entidad: { tipo: 'pieza', id: f.creativo },
          metrica: 'parte_del_gasto',
          lineaBase: null,
          valorActual: redondear(parte, 4),
          cambioPct: null,
          muestra: null,
          gravedad: 'media',
          causasPosibles: ['puede deberse a una decisión de presupuesto', 'puede deberse a que el algoritmo concentra la entrega en la pieza que mejor rinde'],
          revisionRecomendada: 'Decide con la dirección si la cuenta debe depender tanto de una sola pieza.',
          requiereValidacionEjecutiva: true,
          umbral: u,
          evidencia: { ventana: m.ventana, total: redondear(total), piezas: conGasto.map((x) => ({ creativo: x.creativo, gasto: redondear(x.gasto ?? 0), parte: redondear((x.gasto ?? 0) / total, 4) })) },
        });
      }
    }
  }

  // ── Un anuncio se muestra demasiadas veces a la misma persona (sólo en 7 días) ──
  if (m.ventana === '7d') {
    if (!m.anunciosAlDia || m.frecuencias === null) {
      salida.sinMedicion.push(CRE.frecuenciaAlta);
    } else {
      const u = umbral(CRE.frecuenciaAlta);
      for (const [anuncio, x] of m.frecuencias) {
        if (x.frecuencia < u.valor) continue;
        const entidad = { tipo: 'anuncio' as const, id: anuncio };
        if (x.impresiones < PISO_DE_IMPRESIONES) {
          salida.debajoDelPiso.push({ regla: CRE.frecuenciaAlta, entidad, muestra: x.impresiones });
          continue;
        }
        salida.detecciones.push({
          ...base,
          regla: CRE.frecuenciaAlta,
          entidad,
          metrica: 'frecuencia',
          lineaBase: null,
          valorActual: redondear(x.frecuencia),
          cambioPct: null,
          muestra: x.impresiones,
          gravedad: 'media',
          causasPosibles: ['puede deberse a una audiencia chica para el presupuesto', 'puede deberse a un anuncio que corre hace mucho sin cambios'],
          revisionRecomendada: 'Revisa si la audiencia del anuncio se agotó.',
          umbral: u,
          evidencia: { ventana: m.ventana, anuncio, creativo: x.creativo, frecuencia: redondear(x.frecuencia), impresiones: x.impresiones },
        });
      }
    }
  }

  // ── El ICP de una pieza, bajo el promedio de su etapa ──
  // El corte se hace dentro de cada etapa y nunca entre etapas (C3-06): una pieza de captación no compite con
  // una de cierre. El promedio es el de las piezas —«el ICP promedio por pieza es X» (C6-04a)—, no el de los
  // contactos: así lo dice la pantalla. La fila sin etapa o sin creativo no está en ningún promedio.
  if (m.calidad.campoDeIcp === null) {
    salida.sinMedicion.push(CRE.icpPorPieza);
  } else {
    const u = umbral(CRE.icpPorPieza);
    const porEtapa = new Map<string, typeof m.calidad.filas>();
    for (const f of m.calidad.filas) {
      // `icpPromedio` llega nulo bajo el piso de calificados: esa pieza no tiene cifra que comparar.
      if (f.creativo === null || f.etapa === null || f.icpPromedio === null) continue;
      porEtapa.set(f.etapa, [...(porEtapa.get(f.etapa) ?? []), f]);
    }
    // Una pieza puede correr en dos etapas: la huella es de la pieza, así que se publica su caída más grande.
    const porPieza = new Map<string, Deteccion>();
    for (const [etapa, filas] of porEtapa) {
      if (filas.length < 2) continue;
      const promedio = filas.reduce((s, f) => s + f.icpPromedio!, 0) / filas.length;
      for (const f of filas) {
        const debajo = promedio - f.icpPromedio!;
        if (debajo < u.valor) continue;
        const previa = porPieza.get(f.creativo!);
        if (previa && previa.lineaBase! - previa.valorActual! >= debajo) continue;
        porPieza.set(f.creativo!, {
          ...base,
          regla: CRE.icpPorPieza,
          entidad: { tipo: 'pieza', id: f.creativo! },
          metrica: 'icp_promedio',
          lineaBase: redondear(promedio, 1),
          valorActual: redondear(f.icpPromedio!, 1),
          cambioPct: null,
          muestra: f.conPuntaje,
          gravedad: 'media',
          causasPosibles: ['puede deberse al mensaje de la pieza', 'puede deberse a la audiencia donde corre'],
          revisionRecomendada: 'Revisa a quién le habla la pieza: trae gente que encaja menos que las otras de su etapa.',
          umbral: u,
          evidencia: { ventana: m.ventana, creativo: f.creativo, etapa, icpPromedio: f.icpPromedio, promedioDeLaEtapa: redondear(promedio, 1), piezasDeLaEtapa: filas.length, conPuntaje: f.conPuntaje },
        });
      }
    }
    salida.detecciones.push(...porPieza.values());
  }

  return salida;
}
