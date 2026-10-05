// El detector de Acquisition: el piloto (`docs/OTROS/agentes/fichas/F03-ACQUISITION.md`; `02`, AG-20 a AG-35).
//
// ═══════════════════════════════════════════════════════════════════════════════
// CONSUME LA LECTURA DE LA PANTALLA, NO LA RECALCULA
//
// Mide con `lecturaDeAcquisition` —la misma función, las mismas ventanas de días cerrados y la misma edad
// de los agendados que dibuja la pantalla—, más un solo dato que la pantalla no necesita: cuántos días
// seguidos lleva cada campaña sin entregar. Detectar es puro (`detectarEnAcquisition`): recibe lo medido y
// los umbrales, y devuelve detecciones, lo que quedó bajo el piso y las reglas que no se pudieron medir.
//
// ── CUÁNDO UNA REGLA NO SE PUEDE MEDIR ───────────────────────────────────────
//
// La pantalla ya dice por qué no compara (`sinComparacion`) y por qué no publica costos (`sinCostos`). Una
// regla que necesita lo que falta va a `sinMedicion`: sus señales vivas quedan «sin medición» en vez de
// cerrarse solas. Es lo que evita la falsa «sin entrega» crítica de cada mañana en una empresa al este de
// UTC, cuyo día todavía no se recolectó (AG-35): con el colector atrasado o un día sin cerrar, la pantalla
// dice `faltan_dias`, y ninguna regla de gasto se publica.
//
// ── LO QUE TODAVÍA NO ESTÁ ───────────────────────────────────────────────────
//
// `ACQ-CPM-ABRUPTO` y `ACQ-CAMBIO-BRUSCO-CONJUNTO` necesitan impresiones y conjuntos, que la lectura de la
// pantalla no trae; el monitor de atribución necesita su versión en días cerrados. Llegan en la segunda
// tanda de AG9 (`08`).
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../../datos/contexto.ts';
import { FUNNELS, type Funnel } from '../../negocio/funnelDeLaCampana.ts';
import { lecturaDeAcquisition, type Cifras, type EmbudosDeAcquisition } from '../../negocio/embudosDeAcquisition.ts';
import { PISO_DE_UNA_SENAL, type DebajoDelPiso, type Deteccion, type VentanaDeSenal } from '../senales/tipos.ts';
import type { ReglaDelCatalogo } from '../senales/umbrales.ts';

// ─── Las reglas ─────────────────────────────────────────────────────────────

/** Los códigos, para no escribirlos dos veces. */
export const ACQ = {
  sinEntrega: 'ACQ-SIN-ENTREGA',
  cplSostenido: 'ACQ-CPL-SOSTENIDO',
  gastoSinCrecimiento: 'ACQ-GASTO-SIN-CRECIMIENTO',
  concentracion: 'ACQ-CONCENTRACION',
  icpEntreCampanas: 'ACQ-ICP-ENTRE-CAMPANAS',
  escalaPorCalificado: 'ACQ-ESCALA-POR-CALIFICADO',
  fugaEntreEtapas: 'ACQ-FUGA-ENTRE-ETAPAS',
} as const;

/**
 * Las reglas de Acquisition, con su valor provisional (`D-11`). Los porqués son los de la ficha `F03`: salen
 * del criterio, no de una serie larga, y el Admin los firma. Valores relativos y no en moneda: el `$110` del
 * prototipo no declaraba su moneda.
 */
export const REGLAS_DE_ACQUISITION: readonly ReglaDelCatalogo[] = [
  {
    codigo: ACQ.sinEntrega,
    departamento: 'acquisition',
    valor: 2,
    denominador: null,
    gravedad: 'critica',
    porque: 'Dos días cerrados seguidos sin entregar ya no es un bache del proveedor; con uno solo se avisaría cada pausa de un día. Crítica si no entrega ninguna campaña, alta si alguna sí.',
  },
  {
    codigo: ACQ.cplSostenido,
    departamento: 'acquisition',
    valor: 0.3,
    denominador: 'contactos',
    gravedad: 'media',
    porque: 'Un 30 % sobre el costo por contacto de la ventana anterior, con 10 contactos en las dos, es más que la variación de una semana normal; desde el 60 % es alta.',
  },
  {
    codigo: ACQ.gastoSinCrecimiento,
    departamento: 'acquisition',
    valor: 0.25,
    denominador: 'contactos',
    gravedad: 'media',
    porque: 'Un cuarto más de gasto que no trae ni un contacto más es plata que no compra entrada.',
  },
  {
    codigo: ACQ.concentracion,
    departamento: 'acquisition',
    valor: 0.6,
    denominador: null,
    gravedad: 'media',
    porque: 'Con tres campañas o más, que una se lleve el 60 % del gasto deja a la cuenta dependiendo de un solo anuncio. Toca presupuesto: requiere validación ejecutiva.',
  },
  {
    codigo: ACQ.icpEntreCampanas,
    departamento: 'acquisition',
    valor: 15,
    denominador: 'calificados con puntaje',
    gravedad: 'media',
    porque: 'Quince puntos de ICP bajo el promedio de su funnel separan un tramo del otro.',
  },
  {
    codigo: ACQ.escalaPorCalificado,
    departamento: 'acquisition',
    valor: 0.8,
    denominador: 'calificados',
    gravedad: 'info',
    porque: 'Un calificado un 20 % más barato que el de la empresa es la única razón medida para escalar (A6-19). Escalar es presupuesto: requiere validación ejecutiva.',
  },
  {
    codigo: ACQ.fugaEntreEtapas,
    departamento: 'acquisition',
    valor: 0.15,
    denominador: 'contactos',
    gravedad: 'media',
    porque: 'Quince puntos menos de paso de contacto a agendado que en los otros funnels, con 10 en la etapa de origen, es una fuga del funnel y no del mercado.',
  },
];

// ─── Lo medido ──────────────────────────────────────────────────────────────

/** Hasta dónde se mira atrás para saber si una campaña entregaba: el largo de la historia de la pantalla. */
export const DIAS_DE_HISTORIA_DE_LA_ENTREGA = 60;

export interface MedidaDeAcquisition {
  ventana: VentanaDeSenal;
  embudos: EmbudosDeAcquisition;
  actual: ReadonlyMap<string, Cifras>;
  previa: ReadonlyMap<string, Cifras> | null;
  /**
   * De cada campaña que entregó en los últimos `DIAS_DE_HISTORIA_DE_LA_ENTREGA` días cerrados: cuántos días
   * seguidos lleva sin entregar, contando hacia atrás desde el último cerrado, y cuál fue su último día con
   * entrega. Es igual en las dos ventanas: no entregar es un estado, no una comparación.
   */
  entrega: ReadonlyMap<string, { diasSinEntregar: number; ultimaEntrega: string }>;
}

/** Corre dentro de `conOrganizacion`. */
export async function medirAcquisition(ventana: VentanaDeSenal, zona: string): Promise<MedidaDeAcquisition> {
  const dias = ventana === '7d' ? 7 : 30;
  const { embudos, actual, previa } = await lecturaDeAcquisition({ clave: ventana, dias }, zona);
  // El último día cerrado es el final de la ventana, en las dos: la pantalla lo eligió igual.
  const { hasta } = embudos.ventana;
  // Entregar es tener impresiones, como en la pantalla (`cifrasPorCampana`). El último día con entrega de cada campaña.
  const filas = await sql<{ campana: string; ultima: string }>`
    select a.meta_campana_id as campana, to_char(max(m.fecha), 'YYYY-MM-DD') as ultima
      from negocio.metricas_de_anuncio m
      join negocio.anuncios a on a.org_id = m.org_id and a.meta_anuncio_id = m.meta_anuncio_id
     where m.fecha between (${hasta}::date - ${DIAS_DE_HISTORIA_DE_LA_ENTREGA - 1}::int) and ${hasta}::date
       and a.meta_campana_id is not null
       and coalesce(m.impresiones, 0) > 0
     group by 1`.execute(datos());
  return { ventana, embudos, actual, previa, entrega: entregaDe(filas.rows, hasta) };
}

/** Puro: los días seguidos sin entregar hasta `hasta`, a partir del último día con entrega. */
export function entregaDe(
  filas: readonly { campana: string; ultima: string }[],
  hasta: string,
): Map<string, { diasSinEntregar: number; ultimaEntrega: string }> {
  return new Map(filas.map((f) => [f.campana, { diasSinEntregar: diasEntre(f.ultima, hasta) - 1, ultimaEntrega: f.ultima }]));
}

// ─── Detectar, puro ─────────────────────────────────────────────────────────

export interface DeteccionesDeAcquisition {
  detecciones: Deteccion[];
  debajoDelPiso: DebajoDelPiso[];
  sinMedicion: string[];
}

type Umbral = (codigo: string) => { valor: number; provisional: boolean };

const redondear = (x: number, decimales = 2) => Math.round(x * 10 ** decimales) / 10 ** decimales;

export function detectarEnAcquisition(m: MedidaDeAcquisition, umbral: Umbral): DeteccionesDeAcquisition {
  const salida: DeteccionesDeAcquisition = { detecciones: [], debajoDelPiso: [], sinMedicion: [] };
  const { embudos } = m;
  const periodo = { desde: embudos.ventana.desde, hasta: embudos.ventana.hasta };
  const comparable = embudos.sinComparacion === null && m.previa !== null;
  const conCostos = embudos.sinCostos === null;
  const previaDe = (c: string) => m.previa?.get(c);
  const actualDe = (c: string) => m.actual.get(c);
  const base = {
    periodo,
    datosDesde: null,
    causasPosibles: [] as string[],
    destino: null,
    requiereValidacionEjecutiva: false,
  };
  const anterior = embudos.anterior;

  // ── Sin entrega: entregaba y lleva N días cerrados sin entregar ──
  // Sólo con los días cerrados al día: con el colector atrasado o un día sin cerrar, «no entregó» sería
  // «no se recolectó» (AG-35).
  if (embudos.sinComparacion === 'faltan_dias') {
    salida.sinMedicion.push(ACQ.sinEntrega);
  } else {
    const u = umbral(ACQ.sinEntrega);
    const sinEntregar = (c: string) => m.entrega.get(c)!.diasSinEntregar;
    /* Una campaña pausada a propósito no «dejó de entregar». Cuenta la activa y la de estado desconocido
       (GoHighLevel no la listó): sin saber su estado, no entregar sigue siendo un hallazgo. */
    const estado = new Map(embudos.campanas.map((c) => [c.campana, c.estado]));
    const entregaban = [...m.entrega.keys()].filter((c) => (estado.get(c) ?? null) === null || estado.get(c) === 'ACTIVE');
    const paradas = entregaban.filter((c) => sinEntregar(c) >= u.valor);
    const evidencia = (cuales: string[]) => ({
      ventana: m.ventana,
      ultimoDiaCerrado: periodo.hasta,
      campanas: cuales.map((c) => ({ campana: c, ultimaEntrega: m.entrega.get(c)!.ultimaEntrega, diasSinEntregar: sinEntregar(c) })),
    });
    if (entregaban.length > 0 && paradas.length === entregaban.length) {
      salida.detecciones.push({
        ...base,
        regla: ACQ.sinEntrega,
        entidad: { tipo: 'empresa', id: 'empresa' },
        metrica: 'dias_sin_entrega',
        lineaBase: null,
        valorActual: Math.min(...paradas.map(sinEntregar)),
        cambioPct: null,
        muestra: null,
        gravedad: 'critica',
        revisionRecomendada: 'Revisa en el Administrador de anuncios por qué ninguna campaña está entregando: pago, revisión o pausa.',
        causasPosibles: ['puede deberse a un problema de pago de la cuenta', 'puede deberse a anuncios en revisión o rechazados', 'puede deberse a una pausa manual'],
        perdidaContactos: null,
        umbral: u,
        evidencia: evidencia(paradas),
      });
    } else {
      for (const c of paradas) {
        salida.detecciones.push({
          ...base,
          regla: ACQ.sinEntrega,
          entidad: { tipo: 'campana', id: c },
          metrica: 'dias_sin_entrega',
          lineaBase: null,
          valorActual: sinEntregar(c),
          cambioPct: null,
          muestra: null,
          gravedad: 'alta',
          revisionRecomendada: 'Revisa en el Administrador de anuncios por qué esta campaña dejó de entregar.',
          causasPosibles: ['puede deberse a anuncios en revisión o rechazados', 'puede deberse a una pausa manual', 'puede deberse a un presupuesto agotado'],
          perdidaContactos: null,
          umbral: u,
          evidencia: evidencia([c]),
        });
      }
    }
  }

  // ── El costo por contacto sube contra la anterior ──
  if (!comparable || !conCostos) {
    salida.sinMedicion.push(ACQ.cplSostenido);
  } else {
    const u = umbral(ACQ.cplSostenido);
    for (const [campana, ahora] of m.actual) {
      const antes = previaDe(campana);
      if (!antes || ahora.inversion <= 0 || antes.inversion <= 0 || ahora.contactos === 0 || antes.contactos === 0) continue;
      const cplAhora = ahora.inversion / ahora.contactos;
      const cplAntes = antes.inversion / antes.contactos;
      const cambio = cplAhora / cplAntes - 1;
      if (cambio < u.valor) continue;
      const muestra = Math.min(ahora.contactos, antes.contactos);
      if (muestra < PISO_DE_UNA_SENAL) {
        salida.debajoDelPiso.push({ regla: ACQ.cplSostenido, entidad: { tipo: 'campana', id: campana }, muestra });
        continue;
      }
      salida.detecciones.push({
        ...base,
        regla: ACQ.cplSostenido,
        entidad: { tipo: 'campana', id: campana },
        metrica: 'costo_por_contacto',
        lineaBase: redondear(cplAntes),
        valorActual: redondear(cplAhora),
        cambioPct: redondear(cambio, 4),
        muestra,
        gravedad: cambio >= 2 * u.valor ? 'alta' : 'media',
        revisionRecomendada: 'Revisa la segmentación y el creativo de la campaña antes de sostener su gasto.',
        causasPosibles: ['puede deberse a la fatiga del creativo', 'puede deberse a una audiencia más cara', 'puede deberse a la competencia en la subasta'],
        // Los contactos que la misma inversión habría traído al costo anterior.
        perdidaContactos: Math.max(0, Math.round(ahora.inversion / cplAntes - ahora.contactos)),
        umbral: u,
        evidencia: { ventana: m.ventana, periodo, anterior, campana, ahora: cifrasDeEvidencia(ahora), antes: cifrasDeEvidencia(antes) },
      });
    }
  }

  // ── El gasto sube y los contactos no ──
  if (!comparable || !conCostos) {
    salida.sinMedicion.push(ACQ.gastoSinCrecimiento);
  } else {
    const u = umbral(ACQ.gastoSinCrecimiento);
    type Gasto = { inversion: number; contactos: number };
    const candidatas: [Deteccion['entidad'], Gasto, Gasto][] = [];
    for (const [campana, ahora] of m.actual) {
      const antes = previaDe(campana);
      if (antes) candidatas.push([{ tipo: 'campana', id: campana }, ahora, antes]);
    }
    const suma = (mapa: ReadonlyMap<string, Cifras>): Gasto =>
      [...mapa.values()].reduce((s, c) => ({ inversion: s.inversion + c.inversion, contactos: s.contactos + c.contactos }), { inversion: 0, contactos: 0 });
    candidatas.push([{ tipo: 'empresa', id: 'empresa' }, suma(m.actual), suma(m.previa!)]);
    for (const [entidad, ahora, antes] of candidatas) {
      if (antes.inversion <= 0) continue;
      const subeElGasto = ahora.inversion / antes.inversion - 1;
      if (subeElGasto < u.valor || ahora.contactos > antes.contactos) continue;
      if (antes.contactos < PISO_DE_UNA_SENAL) {
        salida.debajoDelPiso.push({ regla: ACQ.gastoSinCrecimiento, entidad, muestra: antes.contactos });
        continue;
      }
      salida.detecciones.push({
        ...base,
        regla: ACQ.gastoSinCrecimiento,
        entidad,
        metrica: 'inversion',
        lineaBase: redondear(antes.inversion),
        valorActual: redondear(ahora.inversion),
        cambioPct: redondear(subeElGasto, 4),
        muestra: antes.contactos,
        gravedad: 'media',
        revisionRecomendada: 'Revisa a dónde fue el gasto adicional antes de sostenerlo.',
        causasPosibles: ['puede deberse a una audiencia saturada', 'puede deberse a una puja más alta sin más entrega útil'],
        // Los contactos que faltaron para crecer al ritmo del gasto.
        perdidaContactos: Math.max(0, Math.round(antes.contactos * (1 + subeElGasto) - ahora.contactos)),
        umbral: u,
        evidencia: { ventana: m.ventana, periodo, anterior, entidad, ahora: { inversion: redondear(ahora.inversion), contactos: ahora.contactos }, antes: { inversion: redondear(antes.inversion), contactos: antes.contactos } },
      });
    }
  }

  // ── Una campaña se lleva casi todo el gasto ──
  if (!conCostos) {
    salida.sinMedicion.push(ACQ.concentracion);
  } else {
    const u = umbral(ACQ.concentracion);
    const conGasto = [...m.actual.entries()].filter(([, c]) => c.inversion > 0);
    const total = conGasto.reduce((s, [, c]) => s + c.inversion, 0);
    if (conGasto.length >= 3 && total > 0) {
      for (const [campana, c] of conGasto) {
        const parte = c.inversion / total;
        if (parte < u.valor) continue;
        salida.detecciones.push({
          ...base,
          regla: ACQ.concentracion,
          entidad: { tipo: 'campana', id: campana },
          metrica: 'parte_del_gasto',
          lineaBase: null,
          valorActual: redondear(parte, 4),
          cambioPct: null,
          muestra: null,
          gravedad: 'media',
          revisionRecomendada: 'Decide con la dirección si la cuenta debe depender tanto de una sola campaña.',
          causasPosibles: ['puede deberse a una decisión de presupuesto', 'puede deberse a que las otras campañas dejaron de entregar'],
          perdidaContactos: null,
          requiereValidacionEjecutiva: true,
          umbral: u,
          evidencia: {
            ventana: m.ventana,
            periodo,
            total: redondear(total),
            campanas: conGasto.map(([id, x]) => ({ campana: id, inversion: redondear(x.inversion), parte: redondear(x.inversion / total, 4) })),
          },
        });
      }
    }
  }

  // ── El ICP de una campaña, bajo el de su funnel ──
  {
    const u = umbral(ACQ.icpEntreCampanas);
    for (const c of embudos.campanas) {
      if (c.funnel === null) continue;
      const delFunnel = embudos.funnels[c.funnel].calificados.icp.promedio;
      const propio = c.cifras.calificados.icp.promedio;
      const conPuntaje = actualDe(c.campana)?.conPuntaje ?? 0;
      /* Bajo el piso de puntajes la pantalla no publica el promedio, y sin él no se sabe si la regla se
         cumpliría: no es una detección bajo el piso, es una que no se puede hacer. */
      if (delFunnel === null || propio === null) continue;
      const debajo = delFunnel - propio;
      if (debajo < u.valor) continue;
      salida.detecciones.push({
        ...base,
        regla: ACQ.icpEntreCampanas,
        entidad: { tipo: 'campana', id: c.campana },
        metrica: 'icp_promedio',
        lineaBase: redondear(delFunnel, 1),
        valorActual: redondear(propio, 1),
        cambioPct: null,
        muestra: conPuntaje,
        gravedad: 'media',
        revisionRecomendada: 'Revisa a quién le habla la campaña: trae gente que encaja menos que el resto de su funnel.',
        causasPosibles: ['puede deberse a la segmentación', 'puede deberse a un mensaje que atrae a otro público'],
        perdidaContactos: null,
        umbral: u,
        evidencia: { ventana: m.ventana, periodo, campana: c.campana, funnel: c.funnel, promedioDelFunnel: redondear(delFunnel, 1), promedio: redondear(propio, 1), conPuntaje },
      });
    }
  }

  // ── Calificados más baratos que los de la empresa ──
  const costoDeLaEmpresa = embudos.total.calificados.costo;
  if (!conCostos || costoDeLaEmpresa === null) {
    salida.sinMedicion.push(ACQ.escalaPorCalificado);
  } else {
    const u = umbral(ACQ.escalaPorCalificado);
    for (const c of embudos.campanas) {
      const propio = c.cifras.calificados.costo;
      if (propio === null || propio > u.valor * costoDeLaEmpresa) continue;
      const calificados = c.cifras.calificados.valor;
      if (calificados < PISO_DE_UNA_SENAL) {
        salida.debajoDelPiso.push({ regla: ACQ.escalaPorCalificado, entidad: { tipo: 'campana', id: c.campana }, muestra: calificados });
        continue;
      }
      salida.detecciones.push({
        ...base,
        regla: ACQ.escalaPorCalificado,
        entidad: { tipo: 'campana', id: c.campana },
        metrica: 'costo_por_calificado',
        lineaBase: redondear(costoDeLaEmpresa),
        valorActual: redondear(propio),
        cambioPct: redondear(propio / costoDeLaEmpresa - 1, 4),
        muestra: calificados,
        gravedad: 'info',
        revisionRecomendada: 'Si se decide escalar, que sea esta campaña y por su costo por calificado, no por su costo por contacto.',
        perdidaContactos: null,
        requiereValidacionEjecutiva: true,
        umbral: u,
        evidencia: { ventana: m.ventana, periodo, campana: c.campana, costoPorCalificado: redondear(propio), costoDeLaEmpresa: redondear(costoDeLaEmpresa), calificados },
      });
    }
  }

  // ── El paso de contacto a agendado de un funnel, bajo el de los otros ──
  {
    const u = umbral(ACQ.fugaEntreEtapas);
    const porFunnel = new Map<Funnel, { contactos: number; agendados: number }>();
    for (const f of FUNNELS) {
      const etapas = embudos.funnels[f].etapas;
      const contactos = etapas.find((e) => e.etapa === 'contactos')?.valor ?? null;
      const agendados = etapas.find((e) => e.etapa === 'agendados')?.valor ?? null;
      if (contactos !== null && agendados !== null) porFunnel.set(f, { contactos, agendados });
    }
    for (const [f, propio] of porFunnel) {
      const otros = [...porFunnel.entries()].filter(([g]) => g !== f).reduce((s, [, x]) => ({ contactos: s.contactos + x.contactos, agendados: s.agendados + x.agendados }), { contactos: 0, agendados: 0 });
      if (otros.contactos < PISO_DE_UNA_SENAL || propio.contactos === 0) continue;
      const tasaPropia = propio.agendados / propio.contactos;
      const tasaDeLosOtros = otros.agendados / otros.contactos;
      const debajo = tasaDeLosOtros - tasaPropia;
      if (debajo < u.valor) continue;
      const entidad = { tipo: 'par_de_etapas' as const, id: `${f}:contactos>agendados` };
      if (propio.contactos < PISO_DE_UNA_SENAL) {
        salida.debajoDelPiso.push({ regla: ACQ.fugaEntreEtapas, entidad, muestra: propio.contactos });
        continue;
      }
      salida.detecciones.push({
        ...base,
        regla: ACQ.fugaEntreEtapas,
        entidad,
        metrica: 'tasa_de_agenda',
        lineaBase: redondear(tasaDeLosOtros, 4),
        valorActual: redondear(tasaPropia, 4),
        cambioPct: null,
        muestra: propio.contactos,
        gravedad: 'media',
        revisionRecomendada: 'Revisa el paso del funnel entre el contacto y la agenda.',
        causasPosibles: ['puede deberse a la página de agenda', 'puede deberse al seguimiento después del contacto'],
        // Los que habrían agendado con la tasa de los otros funnels (A6-11).
        perdidaContactos: Math.max(0, Math.round(debajo * propio.contactos)),
        umbral: u,
        evidencia: { ventana: m.ventana, periodo, funnel: f, propio, otros },
      });
    }
  }

  return salida;
}

/** Las cifras de una campaña que viajan en la evidencia: números, sin nombres. */
function cifrasDeEvidencia(c: Cifras) {
  return { inversion: redondear(c.inversion), contactos: c.contactos, agendados: c.agendados, calificados: c.calificados };
}

/** Los días de `[desde, hasta]`, los dos incluidos. */
function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;
}
