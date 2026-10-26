// El detector de Creative Insights (`docs/OTROS/agentes/fichas/F06-CREATIVE-INSIGHTS.md`; `02`, AG-20 a AG-35).
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL GRANO ES LA PIEZA
//
// Creative publica sólo lo que es de la pieza o del anuncio (C11-04): la caída del CTR, la concentración del
// gasto en una pieza, la frecuencia de un anuncio y el Descarta de una pieza. Lo de campaña y de conjunto —la
// entrega, el CPM, el costo por contacto, los cambios por conjunto— es de Acquisition (`./acquisition.ts`), y
// Creative no publica ni una señal con esas entidades. La pieza se identifica por su cliente y su nombre normalizado
// (`idDeLaPieza`, `lib/negocio/idDeLaPieza.ts`), el mismo identificador con que la pantalla agrupa: el nombre si es del
// principal —con un cliente, la huella de siempre—, `<cuenta>:<nombre>` si es de otro. Un nombre que no entra en los 200
// caracteres de la tabla se corta con una huella del entero (`idDeLaPiezaEnUnaSenal`): sin eso la pasada fallaba entera.
//
// ── CON VARIOS CLIENTES (el nivel 3) ─────────────────────────────────────────
//
// Lo que la regla dice de «la cuenta» se mide dentro de cada cliente: la concentración es sobre el gasto de SU cliente,
// y el Descarta de una pieza se compara con las de su etapa EN SU CLIENTE —el cuadrante es el campo de la subcuenta de
// cada uno—. Con piezas de dos clientes o más, la evidencia nombra al cliente (`cliente`, su id), y con eso la frase lo dice
// y la pantalla rotula la señal. Con uno, la evidencia y la frase son las de siempre.
//
// ── CONSUME LA LECTURA DE LA PANTALLA ────────────────────────────────────────
//
// Mide con `calidadDelCreativo`, `rendimientoDelCreativo` y `fatigaDelCreativo` con los mismos días que la
// pantalla (`app/api/creative/route.ts`), y la frecuencia con la misma ventana de métricas
// (`ventanaDeMetricas`). Esa ventana es móvil —llega hasta hoy— y no de días cerrados como la de Acquisition:
// es la de la pantalla de Creative, y una señal con otra ventana diría otra cifra que la que se ve.
//
// Lo que no se puede medir no se publica: sin la lectura de anuncios al día (`frescuraDe('anuncios')`), la
// caída del CTR, la concentración y la frecuencia van a «sin medición»; sin el campo del cuadrante en el CRM, la de Descarta.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../../datos/contexto.ts';
import { calidadDelCreativo, type CalidadDeLosCreativos } from '../../negocio/calidadDelCreativo.ts';
import { rendimientoDelCreativo, PISO_DE_IMPRESIONES, type RendimientoDeLosCreativos } from '../../negocio/rendimientoDelCreativo.ts';
import { fatigaDelCreativo, type FatigaDeLosCreativos } from '../../negocio/fatigaDelCreativo.ts';
import { ventanaDeMetricas } from '../../negocio/costoDelAnuncio.ts';
import { diasSinCuadrar } from '../../negocio/gastoDeLaCuenta.ts';
import { clientesDeCreative, llaveDelCreativo } from '../../negocio/creativo.ts';
import { idDeLaPiezaEnUnaSenal } from '../../negocio/idDeLaPieza.ts';
import { type DebajoDelPiso, type Deteccion, type VentanaDeSenal } from '../senales/tipos.ts';
import type { ReglaDelCatalogo } from '../senales/umbrales.ts';

export const CRE = {
  caidaDeCtr: 'CRE-CAIDA-DE-CTR',
  concentracion: 'CRE-CONCENTRACION',
  frecuenciaAlta: 'CRE-FRECUENCIA-ALTA',
  /* Reemplaza a `CRE-ICP-POR-PIEZA` (el ICP promedio): desde la `105` el ICP es una de cuatro palabras y no hay
     promedio. Sus señales viejas quedan en el historial con su código. */
  descartaPorPieza: 'CRE-DESCARTA-POR-PIEZA',
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
    porque: 'Con tres piezas o más en una cuenta publicitaria (con varios clientes, la de cada uno), que una se lleve más de un tercio de su gasto deja la cuenta dependiendo de una sola pieza. Es presupuesto: requiere validación ejecutiva.',
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
    codigo: CRE.descartaPorPieza,
    departamento: 'creative',
    valor: 0.15,
    unidad: 'puntos_porcentuales',
    denominador: 'contactos clasificados',
    gravedad: 'media',
    porque: 'Quince puntos más de Descarta que el promedio de las piezas de su etapa (con varios clientes, en su cliente): la pieza trae gente que el CRM descarta (decisión del usuario, 2026-10-26; reemplaza a C7-10).',
  },
];

// ─── Lo medido ──────────────────────────────────────────────────────────────

export interface MedidaDeCreative {
  ventana: VentanaDeSenal;
  periodo: { desde: string; hasta: string };
  calidad: Pick<CalidadDeLosCreativos, 'filas' | 'campoDelCuadrante'>;
  rendimiento: Pick<RendimientoDeLosCreativos, 'filas'>;
  fatiga: Pick<FatigaDeLosCreativos, 'filas'>;
  /** El cliente por omisión de la empresa: el identificador de sus piezas es el nombre (`idDeLaPieza`). */
  principal: string | null;
  /** La frecuencia media de cada anuncio, pesada por impresiones, con su cliente. Sólo en 7 días: la regla es semanal. */
  frecuencias: ReadonlyMap<string, { frecuencia: number; impresiones: number; creativo: string | null; cuentaId: string }> | null;
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
    principal: (await clientesDeCreative()).principal,
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
      'a.cuenta_id as cuentaId',
      llaveDelCreativo('a.nombre').as('creativo'),
      sql<string | null>`sum(m.impresiones) filter (where m.frecuencia is not null)`.as('impresiones'),
      sql<string | null>`sum(m.frecuencia * m.impresiones) filter (where m.frecuencia is not null)
        / nullif(sum(m.impresiones) filter (where m.frecuencia is not null), 0)`.as('frecuencia'),
    ])
    .where(ventanaDeMetricas('m', dias))
    .groupBy(['m.meta_anuncio_id', 'a.cuenta_id', 'a.nombre'])
    .groupBy(llaveDelCreativo('a.nombre'))
    .execute();
  return new Map(
    filas
      .filter((f) => f.frecuencia !== null)
      .map((f) => [
        f.anuncio,
        { frecuencia: Number(f.frecuencia), impresiones: Number(f.impresiones ?? 0), creativo: f.creativo || null, cuentaId: f.cuentaId },
      ]),
  );
}

// ─── Detectar, puro ─────────────────────────────────────────────────────────

type Umbral = (codigo: string) => { valor: number; provisional: boolean };
const redondear = (x: number, decimales = 2) => Math.round(x * 10 ** decimales) / 10 ** decimales;

export function detectarEnCreative(m: MedidaDeCreative, umbral: Umbral): { detecciones: Deteccion[]; debajoDelPiso: DebajoDelPiso[]; sinMedicion: string[] } {
  const salida = { detecciones: [] as Deteccion[], debajoDelPiso: [] as DebajoDelPiso[], sinMedicion: [] as string[] };
  const base = { periodo: m.periodo, datosDesde: null, destino: null, requiereValidacionEjecutiva: false, perdidaContactos: null };
  /* El identificador de una pieza (el nivel 3): su nombre si es del principal, con su cliente si es de otro; con un nombre
     que no entra en la tabla, cortado (C6 · D3: si no, la pasada entera fallaba). */
  const id = (cuentaId: string, creativo: string) => idDeLaPiezaEnUnaSenal(cuentaId, creativo, m.principal);
  /* Con piezas de dos clientes o más, la evidencia nombra al cliente: la frase lo dice y la pantalla rotula la señal. */
  const clientes = new Set([
    ...m.calidad.filas.filter((f) => f.creativo !== null).map((f) => f.cuentaId),
    ...m.rendimiento.filas.map((f) => f.cuentaId),
    ...m.fatiga.filas.map((f) => f.cuentaId),
    ...[...(m.frecuencias?.values() ?? [])].map((x) => x.cuentaId),
  ]);
  const delCliente = (cuentaId: string) => (clientes.size >= 2 ? { cliente: cuentaId } : {});
  const impresionesDe = new Map(m.rendimiento.filas.map((f) => [id(f.cuentaId, f.creativo), f.impresiones ?? 0]));

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
        entidad: { tipo: 'pieza', id: id(f.cuentaId, f.creativo) },
        metrica: 'ctr',
        lineaBase: f.ctrTemprano,
        valorActual: f.ctrTardio,
        cambioPct: redondear(-f.caida, 4),
        muestra: impresionesDe.get(id(f.cuentaId, f.creativo)) ?? null,
        gravedad: 'media',
        causasPosibles: ['puede deberse a que la audiencia ya vio la pieza', 'puede deberse a más competencia por la misma audiencia'],
        revisionRecomendada: 'Revisa si la pieza necesita una variante: su CTR va en baja dentro de la ventana.',
        umbral: u,
        evidencia: { ventana: m.ventana, creativo: f.creativo, ...delCliente(f.cuentaId), dias: f.dias, desde: f.desde, hasta: f.hasta, ctrTemprano: f.ctrTemprano, ctrTardio: f.ctrTardio, caida: f.caida },
      });
    }
  }

  // ── Una pieza se lleva una parte grande del gasto ──
  // Con el gasto de la cuenta sin cuadrar, el total es corto y la parte de cada pieza sale inflada (`076`).
  if (!m.anunciosAlDia || !m.gastoCuadra) {
    salida.sinMedicion.push(CRE.concentracion);
  } else {
    const u = umbral(CRE.concentracion);
    /* Sobre el gasto de SU cliente (el nivel 3): «la cuenta» de la regla es la cuenta publicitaria, y cada cliente tiene
       la suya. Juntas, la pieza que se lleva casi todo el gasto de un cliente chico no se veía al lado del grande. Con un
       cliente, el gasto de la empresa. */
    const porCliente = new Map<string, typeof m.rendimiento.filas>();
    for (const f of m.rendimiento.filas) {
      if ((f.gasto ?? 0) > 0) porCliente.set(f.cuentaId, [...(porCliente.get(f.cuentaId) ?? []), f]);
    }
    for (const [cuentaId, conGasto] of porCliente) {
      const total = conGasto.reduce((s, f) => s + (f.gasto ?? 0), 0);
      if (conGasto.length < 3 || total <= 0) continue;
      for (const f of conGasto) {
        const parte = (f.gasto ?? 0) / total;
        if (parte < u.valor) continue;
        salida.detecciones.push({
          ...base,
          regla: CRE.concentracion,
          entidad: { tipo: 'pieza', id: id(f.cuentaId, f.creativo) },
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
          evidencia: {
            ventana: m.ventana,
            ...delCliente(cuentaId),
            total: redondear(total),
            piezas: conGasto.map((x) => ({ creativo: x.creativo, gasto: redondear(x.gasto ?? 0), parte: redondear((x.gasto ?? 0) / total, 4) })),
          },
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
          evidencia: { ventana: m.ventana, anuncio, creativo: x.creativo, ...delCliente(x.cuentaId), frecuencia: redondear(x.frecuencia), impresiones: x.impresiones },
        });
      }
    }
  }

  // ── La porción de Descarta de una pieza, sobre el promedio de su etapa ──
  // El corte se hace dentro de cada etapa y nunca entre etapas (C3-06): una pieza de captación no compite con
  // una de cierre. El promedio es el de las piezas, no el de los contactos, como lo era el del ICP (C6-04a). La fila sin
  // etapa o sin creativo no está en ningún promedio. Y dentro de su CLIENTE (el nivel 3): el cuadrante es el campo de la
  // subcuenta de cada uno. Reemplaza al ICP promedio por pieza (la `105`): con palabras no hay promedio.
  if (m.calidad.campoDelCuadrante === null) {
    salida.sinMedicion.push(CRE.descartaPorPieza);
  } else {
    const u = umbral(CRE.descartaPorPieza);
    const porEtapa = new Map<string, { etapa: string; filas: typeof m.calidad.filas }>();
    for (const f of m.calidad.filas) {
      // `porcionDeDescarta` llega nula bajo el piso de clasificados: esa pieza no tiene cifra que comparar.
      if (f.creativo === null || f.etapa === null || f.porcionDeDescarta === null) continue;
      const grupo = `${f.cuentaId}·${f.etapa}`;
      porEtapa.set(grupo, { etapa: f.etapa, filas: [...(porEtapa.get(grupo)?.filas ?? []), f] });
    }
    // Una pieza puede correr en dos etapas: la huella es de la pieza, así que se publica su caída más grande.
    const porPieza = new Map<string, Deteccion>();
    for (const { etapa, filas } of porEtapa.values()) {
      if (filas.length < 2) continue;
      const promedio = filas.reduce((s, f) => s + f.porcionDeDescarta!, 0) / filas.length;
      for (const f of filas) {
        const encima = f.porcionDeDescarta! - promedio;
        if (encima < u.valor) continue;
        const pieza = id(f.cuentaId, f.creativo!);
        const previa = porPieza.get(pieza);
        if (previa && previa.valorActual! - previa.lineaBase! >= encima) continue;
        porPieza.set(pieza, {
          ...base,
          regla: CRE.descartaPorPieza,
          entidad: { tipo: 'pieza', id: pieza },
          metrica: 'porcion_de_descarta',
          lineaBase: redondear(promedio, 4),
          valorActual: redondear(f.porcionDeDescarta!, 4),
          cambioPct: null,
          muestra: f.clasificados,
          gravedad: 'media',
          causasPosibles: ['puede deberse al mensaje de la pieza', 'puede deberse a la audiencia donde corre'],
          revisionRecomendada: 'Revisa a quién le habla la pieza: trae más gente que el CRM descarta que las otras de su etapa.',
          umbral: u,
          evidencia: { ventana: m.ventana, creativo: f.creativo, ...delCliente(f.cuentaId), etapa, descarta: redondear(f.porcionDeDescarta!, 4), descartaDeLaEtapa: redondear(promedio, 4), piezasDeLaEtapa: filas.length, clasificados: f.clasificados },
        });
      }
    }
    salida.detecciones.push(...porPieza.values());
  }

  return salida;
}
