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
// ── LO QUE LA PANTALLA NO TRAE ───────────────────────────────────────────────
//
// El costo por mil impresiones y el cambio brusco por conjunto piden impresiones y conjuntos, que la lectura
// de la pantalla no necesita: se leen aparte, sobre las MISMAS dos ventanas que eligió la pantalla. El
// monitor de atribución se lee con `calidadDeLaAtribucion` sobre los mismos días cerrados (F03, A11-06).
//
// ── CON VARIOS CLIENTES (el nivel 3) ─────────────────────────────────────────
//
// Cada cliente tiene su cuenta publicitaria. Lo que es de toda una cuenta —sin entrega, la concentración, la escala
// por calificado y el gasto sin crecimiento agregado— se mide dentro de cada cliente (`clienteDe`), y lo que
// era de la `empresa` pasa a ser de su `cliente`. Con un solo cliente el mapa va vacío y todo es como siempre. Y hay
// dos frenos: un cliente que pautó sin Meta deja a la empresa sin costos (`sinCostos`), pero no apaga lo que sólo lee
// Meta —sin entrega, la concentración, el costo por mil y el cambio brusco del conjunto— de los demás
// (`faltanDiasDeMeta`, `anteriorDeMeta`).
//
// Desde C6 · D3 se miden también dentro de su cliente las tres que comparaban contra toda la empresa: el ICP de una
// campaña contra SU funnel EN SU cliente, la fuga de un funnel contra los otros funnels DE SU cliente (con el
// identificador de `idConCliente`: el de siempre para el principal) y el monitor de atribución, por cliente, sobre los
// clientes ACTIVOS con campañas que tienen denominador en la ventana: uno sin gente, en pausa o de baja se salta, y la
// regla queda sin medición sólo si ninguno tiene denominador, como la de la empresa. El conjunto lee Meta —su gente
// llega por `utmTerm`, que es un id de Meta— y pasa al freno de Meta. El costo por contacto, el gasto sin crecimiento y
// la escala siguen con el de los costos: necesitan la ventana anterior de la pantalla, que con un cliente sin Meta no
// se lee (la decisión del 2026-10-20: el gasto de cada cliente sale de SU GoHighLevel con Meta vinculado); el plan dice
// de qué cliente falta el gasto y qué hacer (`porQueNoSeMidio`).
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../../datos/contexto.ts';
import { FUNNELS, type Funnel } from '../../negocio/funnelDeLaCampana.ts';
import {
  CIFRAS_VACIAS,
  costo,
  lecturaDeAcquisition,
  promedioDelIcp,
  sumar,
  type Cifras,
  type EmbudosDeAcquisition,
} from '../../negocio/embudosDeAcquisition.ts';
import { calidadDeLaAtribucion, type CalidadDeLaAtribucion, type PuntoDeAtribucion } from '../../negocio/calidadDeLaAtribucion.ts';
import { idConCliente } from '../../negocio/idDeLaPieza.ts';
import { PISO_DE_UNA_SENAL, type DebajoDelPiso, type Deteccion, type VentanaDeSenal } from '../senales/tipos.ts';
import type { ReglaDelCatalogo } from '../senales/umbrales.ts';
import { clientesDeLaEmpresa } from './clientes.ts';

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
  cpmAbrupto: 'ACQ-CPM-ABRUPTO',
  cambioBruscoConjunto: 'ACQ-CAMBIO-BRUSCO-CONJUNTO',
  atribucionContactos: 'ACQ-ATRIBUCION-CONTACTOS',
  atribucionCitas: 'ACQ-ATRIBUCION-CITAS',
  atribucionVentas: 'ACQ-ATRIBUCION-VENTAS',
  atribucionUtm: 'ACQ-ATRIBUCION-UTM',
  atribucionSinCampana: 'ACQ-ATRIBUCION-SIN-CAMPANA',
} as const;

/** El piso del costo por mil: mil impresiones en cada ventana. Un CPM sobre menos es ruido de la subasta. */
export const PISO_DE_IMPRESIONES = 1000;

/** Los puntos del monitor que publican señal, con su regla y su denominador. */
const PUNTOS_DEL_MONITOR: readonly { clave: PuntoDeAtribucion['clave']; regla: string; denominador: string }[] = [
  { clave: 'leads_con_anuncio', regla: ACQ.atribucionContactos, denominador: 'contactos' },
  { clave: 'citas_con_anuncio', regla: ACQ.atribucionCitas, denominador: 'citas' },
  { clave: 'ventas_con_anuncio', regla: ACQ.atribucionVentas, denominador: 'ventas reportadas' },
  { clave: 'utm_incompletas', regla: ACQ.atribucionUtm, denominador: 'contactos con alguna UTM' },
  { clave: 'sin_campana', regla: ACQ.atribucionSinCampana, denominador: 'contactos' },
];

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
    unidad: 'dias',
    denominador: null,
    gravedad: 'critica',
    porque: 'Dos días cerrados seguidos sin entregar ya no es un bache del proveedor; con uno solo se avisaría cada pausa de un día. Crítica si no entrega ninguna campaña de la cuenta publicitaria (con varios clientes, la de cada uno), alta si alguna sí.',
  },
  {
    codigo: ACQ.cplSostenido,
    departamento: 'acquisition',
    valor: 0.3,
    unidad: 'proporcion',
    denominador: 'contactos',
    gravedad: 'media',
    porque: 'Un 30 % sobre el costo por contacto de la ventana anterior, con 10 contactos en las dos, es más que la variación de una semana normal; desde el 60 % es alta.',
  },
  {
    codigo: ACQ.gastoSinCrecimiento,
    departamento: 'acquisition',
    valor: 0.25,
    unidad: 'proporcion',
    denominador: 'contactos',
    gravedad: 'media',
    porque: 'Un cuarto más de gasto que no trae ni un contacto más es plata que no compra entrada.',
  },
  {
    codigo: ACQ.concentracion,
    departamento: 'acquisition',
    valor: 0.6,
    unidad: 'proporcion',
    denominador: null,
    gravedad: 'media',
    porque: 'Con tres campañas o más en una cuenta publicitaria (con varios clientes, la de cada uno), que una se lleve el 60 % de su gasto deja a la cuenta dependiendo de un solo anuncio. Toca presupuesto: requiere validación ejecutiva.',
  },
  {
    codigo: ACQ.icpEntreCampanas,
    departamento: 'acquisition',
    valor: 15,
    unidad: 'puntos',
    denominador: 'calificados con puntaje',
    gravedad: 'media',
    porque: 'Quince puntos de ICP bajo el promedio de su funnel (con varios clientes, el de su funnel en su cliente) separan un tramo del otro.',
  },
  {
    codigo: ACQ.escalaPorCalificado,
    departamento: 'acquisition',
    valor: 0.8,
    unidad: 'proporcion',
    denominador: 'calificados',
    gravedad: 'info',
    porque: 'Un calificado un 20 % más barato que el de su cuenta publicitaria (la empresa, o su cliente si hay varios) es la única razón medida para escalar, y no el costo por contacto. Escalar es presupuesto: requiere validación ejecutiva.',
  },
  {
    codigo: ACQ.fugaEntreEtapas,
    departamento: 'acquisition',
    valor: 0.15,
    unidad: 'puntos_porcentuales',
    denominador: 'contactos',
    gravedad: 'media',
    porque: 'Quince puntos menos de paso de contacto a agendado que en los otros funnels (con varios clientes, los de su cliente), con 10 en la etapa de origen, es una fuga del funnel y no del mercado.',
  },
  {
    codigo: ACQ.cpmAbrupto,
    departamento: 'acquisition',
    valor: 0.4,
    unidad: 'proporcion',
    denominador: 'impresiones',
    gravedad: 'media',
    porque: 'Un 40 % más por mil impresiones contra la ventana anterior, con mil en las dos, es la subasta o la audiencia cambiando y no el ruido de un día.',
  },
  {
    codigo: ACQ.cambioBruscoConjunto,
    departamento: 'acquisition',
    valor: 0.5,
    unidad: 'proporcion',
    denominador: 'contactos',
    gravedad: 'media',
    porque: 'La mitad más o menos de gasto o de costo por contacto en una semana, con 10 contactos en las dos, es un cambio de configuración o de aprendizaje, no una tendencia.',
  },
  ...PUNTOS_DEL_MONITOR.map((p) => ({
    codigo: p.regla,
    departamento: 'acquisition' as const,
    valor: 0.9,
    unidad: 'proporcion' as const,
    denominador: p.denominador,
    gravedad: 'media' as const,
    porque: 'Es el mismo corte del monitor de atribución (con varios clientes, el de cada uno): si se pierde el origen de más de uno de cada diez, ya no se puede decir qué anuncio trae más.',
  })),
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
  /** Gasto e impresiones de cada campaña en las dos ventanas. `null` sin ventana anterior. */
  impresiones: ReadonlyMap<string, { gasto: number; impresiones: number; gastoAntes: number; impresionesAntes: number }> | null;
  /** Gasto y contactos de cada conjunto en las dos ventanas. Sólo en 7 días (la regla es semanal) y con anterior. */
  conjuntos: ReadonlyMap<string, { gasto: number; contactos: number; gastoAntes: number; contactosAntes: number }> | null;
  /** El monitor de atribución sobre los mismos días cerrados. */
  atribucion: CalidadDeLaAtribucion;
  /**
   * El cliente de cada campaña, por su id de `identidad.cuentas` (el nivel 3): el de sus anuncios —la cuenta de Meta que
   * los leyó— y, sin anuncios, el que la listó o el de sus contactos (`lecturaDeAcquisition`). VACÍO cuando las campañas
   * son de un solo cliente: las reglas miran la empresa entera, como siempre.
   */
  clienteDe: ReadonlyMap<string, string>;
  /**
   * El freno de lo que sólo lee Meta (`lecturaDeAcquisition`): sin entrega, la concentración y el costo por mil. Con un
   * solo cliente es `embudos.sinComparacion === 'faltan_dias'`; con varios, un cliente sin Meta no lo prende.
   */
  faltanDiasDeMeta: boolean;
  /** La anterior de lo que sólo lee Meta: la de las `impresiones` y los `conjuntos`. Con un solo cliente, `embudos.anterior`. */
  anteriorDeMeta: Ventana | null;
  /**
   * (C6 · D3) El monitor de atribución de cada cliente ACTIVO con campañas (`clienteDe`), sobre los mismos días. VACÍO con
   * `clienteDe` vacío: el monitor es el de la empresa (`atribucion`), como siempre.
   */
  atribucionPorCliente: ReadonlyMap<string, CalidadDeLaAtribucion>;
  /** (C6 · D3) El cliente de cada conjunto, por sus anuncios. VACÍO con `clienteDe` vacío. */
  clienteDelConjunto: ReadonlyMap<string, string>;
  /** (C6 · D3) El cliente por omisión: lo suyo lleva el identificador de siempre (`idConCliente`). */
  principal: string | null;
}

/** Corre dentro de `conOrganizacion`. */
export async function medirAcquisition(ventana: VentanaDeSenal, zona: string): Promise<MedidaDeAcquisition> {
  const dias = ventana === '7d' ? 7 : 30;
  const { embudos, actual, previa, clienteDe, faltanDiasDeMeta, anteriorDeMeta } = await lecturaDeAcquisition({ clave: ventana, dias }, zona);
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
  /* El monitor de cada cliente (C6 · D3), con campañas de varios: sólo los ACTIVOS. Uno en pausa o de baja no se mide
     —sus señales se cierran solas—, y el que no tiene gente en la ventana se salta al detectar. En serie: es una sola
     transacción. */
  const clientes = clienteDe.size > 0 ? await clientesDeLaEmpresa() : null;
  const atribucionPorCliente = new Map<string, CalidadDeLaAtribucion>();
  for (const cliente of [...new Set(clienteDe.values())].sort()) {
    if (clientes?.activos.includes(cliente)) atribucionPorCliente.set(cliente, await calidadDeLaAtribucion(dias, embudos.ventana, cliente));
  }
  return {
    ventana,
    embudos,
    actual,
    previa,
    entrega: entregaDe(filas.rows, hasta),
    // El costo por mil sólo lee Meta: compara contra la anterior de Meta, que un cliente sin Meta no apaga.
    impresiones: anteriorDeMeta === null ? null : await impresionesPorCampana(embudos.ventana, anteriorDeMeta),
    // El conjunto también (C6 · D3): su gasto es de Meta y su gente llega por `utmTerm`, el id del conjunto en Meta.
    conjuntos: anteriorDeMeta === null || ventana !== '7d' ? null : await cifrasPorConjunto(embudos.ventana, anteriorDeMeta),
    atribucion: await calidadDeLaAtribucion(dias, embudos.ventana),
    clienteDe,
    faltanDiasDeMeta,
    anteriorDeMeta,
    atribucionPorCliente,
    clienteDelConjunto: clienteDe.size > 0 ? await clienteDeCadaConjunto() : new Map(),
    principal: clientes?.principal ?? null,
  };
}

/** El cliente de cada conjunto (C6 · D3): el de sus anuncios, la cuenta de Meta que los leyó. */
async function clienteDeCadaConjunto(): Promise<Map<string, string>> {
  const r = await sql<{ conjunto: string; cliente: string }>`
    select meta_conjunto_id as conjunto, min(cuenta_id::text) as cliente
      from negocio.anuncios
     where meta_conjunto_id is not null
     group by 1`.execute(datos());
  return new Map(r.rows.map((f) => [f.conjunto, f.cliente]));
}

type Ventana = { desde: string; hasta: string };
const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

/** El gasto y las impresiones de cada campaña en las dos ventanas, sumados como en `cifrasPorCampana`. */
async function impresionesPorCampana(v: Ventana, a: Ventana) {
  const r = await sql<{ campana: string; gasto: string | null; impresiones: string | null; gasto_antes: string | null; impresiones_antes: string | null }>`
    select a.meta_campana_id as campana,
           sum(m.gasto) filter (where m.fecha between ${v.desde}::date and ${v.hasta}::date) as gasto,
           sum(m.impresiones) filter (where m.fecha between ${v.desde}::date and ${v.hasta}::date) as impresiones,
           sum(m.gasto) filter (where m.fecha between ${a.desde}::date and ${a.hasta}::date) as gasto_antes,
           sum(m.impresiones) filter (where m.fecha between ${a.desde}::date and ${a.hasta}::date) as impresiones_antes
      from negocio.metricas_de_anuncio m
      join negocio.anuncios a on a.org_id = m.org_id and a.meta_anuncio_id = m.meta_anuncio_id
     where m.fecha between ${a.desde}::date and ${v.hasta}::date
       and a.meta_campana_id is not null
     group by 1`.execute(datos());
  return new Map(
    r.rows.map((f) => [f.campana, { gasto: n(f.gasto), impresiones: n(f.impresiones), gastoAntes: n(f.gasto_antes), impresionesAntes: n(f.impresiones_antes) }]),
  );
}

/**
 * El gasto y los contactos de cada conjunto en las dos ventanas. El contacto se ubica en su conjunto por
 * `utmTerm`, que es el identificador del conjunto (la `050` lo dice con su nombre verdadero), y en su día de
 * alta, con la misma regla de días de calendario que la pantalla.
 */
async function cifrasPorConjunto(v: Ventana, a: Ventana) {
  const r = await sql<{ conjunto: string; gasto: string | null; gasto_antes: string | null; contactos: string | null; contactos_antes: string | null }>`
    with gasto as (
      select an.meta_conjunto_id as conjunto,
             sum(m.gasto) filter (where m.fecha between ${v.desde}::date and ${v.hasta}::date) as gasto,
             sum(m.gasto) filter (where m.fecha between ${a.desde}::date and ${a.hasta}::date) as gasto_antes
        from negocio.metricas_de_anuncio m
        join negocio.anuncios an on an.org_id = m.org_id and an.meta_anuncio_id = m.meta_anuncio_id
       where m.fecha between ${a.desde}::date and ${v.hasta}::date
         and an.meta_conjunto_id is not null
       group by 1
    ), gente as (
      select c.atribucion_primera->>'utmTerm' as conjunto,
             count(*) filter (where c.alta_en_el_crm >= ${v.desde}::date and c.alta_en_el_crm < (${v.hasta}::date + 1)) as contactos,
             count(*) filter (where c.alta_en_el_crm >= ${a.desde}::date and c.alta_en_el_crm < (${a.hasta}::date + 1)) as contactos_antes
        from negocio.contactos c
       where c.alta_en_el_crm >= ${a.desde}::date and c.alta_en_el_crm < (${v.hasta}::date + 1)
         and c.atribucion_primera ? 'utmTerm'
       group by 1
    )
    select conjunto, g.gasto, g.gasto_antes, p.contactos, p.contactos_antes
      from gasto g full join gente p using (conjunto)`.execute(datos());
  return new Map(
    r.rows.map((f) => [f.conjunto, { gasto: n(f.gasto), contactos: n(f.contactos), gastoAntes: n(f.gasto_antes), contactosAntes: n(f.contactos_antes) }]),
  );
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

/**
 * Lo de cada campaña agrupado por su cliente (el nivel 3), en el orden en que llega. Con `clienteDe` vacío es un solo
 * grupo, `null`: la empresa entera.
 */
function agruparPorCliente<T>(m: Pick<MedidaDeAcquisition, 'clienteDe'>, cosas: readonly T[], campanaDe: (t: T) => string): Map<string | null, T[]> {
  const grupos = new Map<string | null, T[]>();
  for (const t of cosas) {
    const cliente = m.clienteDe.get(campanaDe(t)) ?? null;
    const g = grupos.get(cliente);
    if (g) g.push(t);
    else grupos.set(cliente, [t]);
  }
  return grupos;
}

/** Lo que es de toda una cuenta publicitaria: de la empresa con un solo cliente, de su cliente con varios. */
const entidadDeLaCuenta = (cliente: string | null): Deteccion['entidad'] =>
  cliente === null ? { tipo: 'empresa', id: 'empresa' } : { tipo: 'cliente', id: cliente };

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
  // «no se recolectó» (AG-35). Es el freno de Meta: un cliente que pauta sin Meta no apaga la de los demás.
  if (m.faltanDiasDeMeta) {
    salida.sinMedicion.push(ACQ.sinEntrega);
  } else {
    const u = umbral(ACQ.sinEntrega);
    const sinEntregar = (c: string) => m.entrega.get(c)!.diasSinEntregar;
    /* Una campaña pausada a propósito no «dejó de entregar». Cuenta la activa y la de estado desconocido
       (GoHighLevel no la listó): sin saber su estado, no entregar sigue siendo un hallazgo. */
    const estado = new Map(embudos.campanas.map((c) => [c.campana, c.estado]));
    const entregaban = [...m.entrega.keys()].filter((c) => (estado.get(c) ?? null) === null || estado.get(c) === 'ACTIVE');
    const evidencia = (cuales: string[]) => ({
      ventana: m.ventana,
      ultimoDiaCerrado: periodo.hasta,
      campanas: cuales.map((c) => ({ campana: c, ultimaEntrega: m.entrega.get(c)!.ultimaEntrega, diasSinEntregar: sinEntregar(c) })),
    });
    /* Por cuenta publicitaria, que es por cliente (el nivel 3): crítica la del cliente que no entrega en ninguna de sus
       campañas activas aunque otro cliente sí entregue —pago y revisión son de cada cuenta—; alta por campaña si a SU
       cliente le queda alguna entregando. Con un solo cliente el grupo es la empresa, con la entidad y la huella de
       siempre. Un grupo nunca está vacío, así que «todas paradas» es el `entregaban.length > 0 && …` de antes. */
    for (const [cliente, suyas] of agruparPorCliente(m, entregaban, (c) => c)) {
      const paradas = suyas.filter((c) => sinEntregar(c) >= u.valor);
      if (paradas.length === suyas.length) {
        salida.detecciones.push({
          ...base,
          regla: ACQ.sinEntrega,
          entidad: entidadDeLaCuenta(cliente),
          metrica: 'dias_sin_entrega',
          lineaBase: null,
          valorActual: Math.min(...paradas.map(sinEntregar)),
          cambioPct: null,
          muestra: null,
          gravedad: 'critica',
          revisionRecomendada:
            cliente === null
              ? 'Revisa en el Administrador de anuncios por qué ninguna campaña está entregando: pago, revisión o pausa.'
              : 'Revisa en el Administrador de anuncios de este cliente por qué ninguna de sus campañas está entregando: pago, revisión o pausa.',
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
    /* El gasto que se mide es el de las campañas que traen contactos (A14-19): el de una campaña de mensajes,
       cuyos contactos llegan sin `campaignId`, sube sin que «sus» contactos puedan subir, y la regla saltaría por
       un hueco de atribución y no por el anuncio. Una campaña sin contactos tiene cero acá, y no compara. */
    type Gasto = { inversion: number; contactos: number };
    const deCampana = (c: Cifras): Gasto => ({ inversion: c.inversionConContactos, contactos: c.contactos });
    const candidatas: [Deteccion['entidad'], Gasto, Gasto][] = [];
    for (const [campana, ahora] of m.actual) {
      const antes = previaDe(campana);
      if (antes) candidatas.push([{ tipo: 'campana', id: campana }, deCampana(ahora), deCampana(antes)]);
    }
    const suma = (mapa: ReadonlyMap<string, Cifras>): Gasto =>
      [...mapa.values()].reduce(
        (s, c) => ({ inversion: s.inversion + c.inversionConContactos, contactos: s.contactos + c.contactos }),
        { inversion: 0, contactos: 0 },
      );
    /* El agregado es el de una cuenta publicitaria (el nivel 3): la empresa con un cliente, cada cliente con varios.
       Sumadas, la cuenta de un cliente que gasta más sin traer a nadie quedaba tapada por la del otro. */
    const todas = [...new Set([...m.actual.keys(), ...m.previa!.keys()])];
    for (const cliente of agruparPorCliente(m, todas, (c) => c).keys()) {
      const delCliente = (mapa: ReadonlyMap<string, Cifras>) => new Map([...mapa].filter(([c]) => (m.clienteDe.get(c) ?? null) === cliente));
      candidatas.push([entidadDeLaCuenta(cliente), suma(delCliente(m.actual)), suma(delCliente(m.previa!))]);
    }
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
  // Sólo lee Meta: el freno es el de Meta, y un cliente que pauta sin Meta no la apaga para los demás.
  if (m.faltanDiasDeMeta) {
    salida.sinMedicion.push(ACQ.concentracion);
  } else {
    const u = umbral(ACQ.concentracion);
    const conGasto = [...m.actual.entries()].filter(([, c]) => c.inversion > 0);
    /* Sobre el gasto de SU cliente (el nivel 3): dos cuentas publicitarias son dos presupuestos, y la única campaña de
       un cliente no «concentra» el gasto de otro. Con un solo cliente, el de la empresa. */
    for (const [cliente, suyas] of agruparPorCliente(m, conGasto, ([c]) => c)) {
      const total = suyas.reduce((s, [, c]) => s + c.inversion, 0);
      if (suyas.length < 3 || total <= 0) continue;
      for (const [campana, c] of suyas) {
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
            ...(cliente === null ? {} : { cliente }),
            total: redondear(total),
            campanas: suyas.map(([id, x]) => ({ campana: id, inversion: redondear(x.inversion), parte: redondear(x.inversion / total, 4) })),
          },
        });
      }
    }
  }

  // ── El ICP de una campaña, bajo el de su funnel ──
  {
    const u = umbral(ACQ.icpEntreCampanas);
    /* Con campañas de varios clientes (C6 · D3), el promedio es el de SU funnel EN SU cliente: con el de la empresa, una
       campaña de un cliente cuyo público puntúa distinto quedaba bajo un promedio que no es el suyo —o tapada por él—.
       Con la misma fórmula de la pantalla (`promedioDelIcp`) sobre las cifras de sus campañas. Con un cliente, la cifra
       de la pantalla, sin volver a sumarla. */
    const enSuCliente = new Map<string, Cifras>();
    if (m.clienteDe.size > 0) {
      for (const c of embudos.campanas) {
        if (c.funnel === null) continue;
        const clave = `${m.clienteDe.get(c.campana) ?? ''}·${c.funnel}`;
        enSuCliente.set(clave, sumar(enSuCliente.get(clave) ?? CIFRAS_VACIAS, m.actual.get(c.campana) ?? CIFRAS_VACIAS));
      }
    }
    for (const c of embudos.campanas) {
      if (c.funnel === null) continue;
      const cliente = m.clienteDe.get(c.campana) ?? null;
      const delFunnel =
        m.clienteDe.size === 0
          ? embudos.funnels[c.funnel].calificados.icp.promedio
          : promedioDelIcp(enSuCliente.get(`${cliente ?? ''}·${c.funnel}`) ?? CIFRAS_VACIAS);
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
        evidencia: {
          ventana: m.ventana,
          periodo,
          campana: c.campana,
          funnel: c.funnel,
          ...(cliente === null ? {} : { cliente }),
          promedioDelFunnel: redondear(delFunnel, 1),
          promedio: redondear(propio, 1),
          conPuntaje,
        },
      });
    }
  }

  // ── Calificados más baratos que los de la empresa ──
  const costoDeLaEmpresa = embudos.total.calificados.costo;
  if (!conCostos || costoDeLaEmpresa === null) {
    salida.sinMedicion.push(ACQ.escalaPorCalificado);
  } else {
    const u = umbral(ACQ.escalaPorCalificado);
    /* La base es el costo por calificado de SU cliente (el nivel 3): contra las dos cuentas juntas, una campaña barata
       de un cliente caro parecía cara, y una cara de un cliente barato, barata. Con un cliente, la cifra de la pantalla,
       sin volver a sumarla (una suma en otro orden podría mover un borde). */
    const delCliente = new Map<string, number | null>();
    for (const [cliente, suyas] of agruparPorCliente(m, [...m.actual.entries()], ([c]) => c)) {
      if (cliente === null) continue;
      const s = suyas.reduce(
        (a, [, c]) => ({ inversion: a.inversion + c.inversionConContactos, calificados: a.calificados + c.calificados }),
        { inversion: 0, calificados: 0 },
      );
      delCliente.set(cliente, costo(s.inversion, s.calificados));
    }
    for (const c of embudos.campanas) {
      const cliente = m.clienteDe.get(c.campana) ?? null;
      const referencia = cliente === null ? costoDeLaEmpresa : (delCliente.get(cliente) ?? null);
      const propio = c.cifras.calificados.costo;
      if (propio === null || referencia === null || propio > u.valor * referencia) continue;
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
        lineaBase: redondear(referencia),
        valorActual: redondear(propio),
        cambioPct: redondear(propio / referencia - 1, 4),
        muestra: calificados,
        gravedad: 'info',
        revisionRecomendada: 'Si se decide escalar, que sea esta campaña y por su costo por calificado, no por su costo por contacto.',
        perdidaContactos: null,
        requiereValidacionEjecutiva: true,
        umbral: u,
        evidencia:
          cliente === null
            ? { ventana: m.ventana, periodo, campana: c.campana, costoPorCalificado: redondear(propio), costoDeLaEmpresa: redondear(referencia), calificados }
            : { ventana: m.ventana, periodo, campana: c.campana, cliente, costoPorCalificado: redondear(propio), costoDelCliente: redondear(referencia), calificados },
      });
    }
  }

  // ── El paso de contacto a agendado de un funnel, bajo el de los otros ──
  {
    const u = umbral(ACQ.fugaEntreEtapas);
    type Paso = { contactos: number; agendados: number };
    /* Con campañas de varios clientes (C6 · D3), los funnels de cada cliente se comparan entre sí: los otros funnels de
       la empresa son la gente de otro cliente, con otra oferta y otra agenda. Con un cliente, las cifras de la pantalla. */
    const grupos = new Map<string | null, Map<Funnel, Paso>>();
    if (m.clienteDe.size === 0) {
      const porFunnel = new Map<Funnel, Paso>();
      for (const f of FUNNELS) {
        const etapas = embudos.funnels[f].etapas;
        const contactos = etapas.find((e) => e.etapa === 'contactos')?.valor ?? null;
        const agendados = etapas.find((e) => e.etapa === 'agendados')?.valor ?? null;
        if (contactos !== null && agendados !== null) porFunnel.set(f, { contactos, agendados });
      }
      grupos.set(null, porFunnel);
    } else {
      const conFunnel = embudos.campanas.filter((c) => c.funnel !== null);
      for (const [cliente, suyas] of agruparPorCliente(m, conFunnel, (c) => c.campana)) {
        const porFunnel = new Map<Funnel, Paso>(FUNNELS.map((f) => [f, { contactos: 0, agendados: 0 }]));
        for (const c of suyas) {
          const x = m.actual.get(c.campana) ?? CIFRAS_VACIAS;
          const p = porFunnel.get(c.funnel!)!;
          porFunnel.set(c.funnel!, { contactos: p.contactos + x.contactos, agendados: p.agendados + x.agendados });
        }
        grupos.set(cliente, porFunnel);
      }
    }
    const funnelsDeCadaCliente = [...grupos].flatMap(([cliente, porFunnel]) => [...porFunnel].map(([f, propio]) => ({ cliente, porFunnel, f, propio })));
    for (const { cliente, porFunnel, f, propio } of funnelsDeCadaCliente) {
      const otros = [...porFunnel.entries()].filter(([g]) => g !== f).reduce((s, [, x]) => ({ contactos: s.contactos + x.contactos, agendados: s.agendados + x.agendados }), { contactos: 0, agendados: 0 });
      if (otros.contactos < PISO_DE_UNA_SENAL || propio.contactos === 0) continue;
      const tasaPropia = propio.agendados / propio.contactos;
      const tasaDeLosOtros = otros.agendados / otros.contactos;
      const debajo = tasaDeLosOtros - tasaPropia;
      if (debajo < u.valor) continue;
      // El par de SU cliente: el de siempre para el principal, con el cliente adelante para otro (`idConCliente`).
      const entidad = { tipo: 'par_de_etapas' as const, id: idConCliente(cliente, `${f}:contactos>agendados`, m.principal) };
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
        evidencia: { ventana: m.ventana, periodo, funnel: f, ...(cliente === null ? {} : { cliente }), propio, otros },
      });
    }
  }

  // ── El costo por mil impresiones sube contra la anterior ──
  /* Sólo lee Meta: compara contra la anterior de Meta (`impresiones` se lee con ella), y un cliente que pauta sin Meta
     no la apaga para los demás. Con un solo cliente, `impresiones` existe justo cuando la pantalla compara. */
  if (m.faltanDiasDeMeta || m.impresiones === null) {
    salida.sinMedicion.push(ACQ.cpmAbrupto);
  } else {
    const u = umbral(ACQ.cpmAbrupto);
    for (const [campana, x] of m.impresiones) {
      if (x.gasto <= 0 || x.gastoAntes <= 0 || x.impresiones <= 0 || x.impresionesAntes <= 0) continue;
      const cpm = (x.gasto / x.impresiones) * 1000;
      const cpmAntes = (x.gastoAntes / x.impresionesAntes) * 1000;
      const cambio = cpm / cpmAntes - 1;
      if (cambio < u.valor) continue;
      const muestra = Math.min(x.impresiones, x.impresionesAntes);
      if (muestra < PISO_DE_IMPRESIONES) {
        salida.debajoDelPiso.push({ regla: ACQ.cpmAbrupto, entidad: { tipo: 'campana', id: campana }, muestra });
        continue;
      }
      salida.detecciones.push({
        ...base,
        regla: ACQ.cpmAbrupto,
        entidad: { tipo: 'campana', id: campana },
        metrica: 'cpm',
        lineaBase: redondear(cpmAntes),
        valorActual: redondear(cpm),
        cambioPct: redondear(cambio, 4),
        muestra,
        gravedad: 'media',
        revisionRecomendada: 'Revisa la audiencia y la competencia en la subasta de esta campaña.',
        causasPosibles: ['puede deberse a más competencia en la subasta', 'puede deberse a una audiencia más chica o más cara'],
        perdidaContactos: null,
        umbral: u,
        evidencia: { ventana: m.ventana, periodo, anterior: m.anteriorDeMeta, campana, ...x },
      });
    }
  }

  // ── Un conjunto cambia de golpe su gasto o su costo por contacto (sólo en 7 días) ──
  /* Sólo lee Meta (C6 · D3): su gasto es de los anuncios y su gente llega por `utmTerm`, el id del conjunto en Meta. El
     freno es el de Meta, y la anterior, la suya (`conjuntos` se lee con `anteriorDeMeta`): un cliente que pauta sin Meta
     no lo apaga para los demás. Con un solo cliente, `conjuntos` existe justo cuando la pantalla compara con costos. */
  if (m.ventana === '7d') {
    if (m.faltanDiasDeMeta || m.conjuntos === null) {
      salida.sinMedicion.push(ACQ.cambioBruscoConjunto);
    } else {
      const u = umbral(ACQ.cambioBruscoConjunto);
      for (const [conjunto, x] of m.conjuntos) {
        if (x.gastoAntes <= 0 || x.gasto <= 0) continue;
        const delGasto = x.gasto / x.gastoAntes - 1;
        const delCosto = x.contactos > 0 && x.contactosAntes > 0 ? x.gasto / x.contactos / (x.gastoAntes / x.contactosAntes) - 1 : null;
        // El cambio que manda es el más grande de los dos: es el que se nombra.
        const porCosto = delCosto !== null && Math.abs(delCosto) > Math.abs(delGasto);
        const cambio = porCosto ? delCosto! : delGasto;
        if (Math.abs(cambio) < u.valor) continue;
        const entidad = { tipo: 'conjunto' as const, id: conjunto };
        const muestra = Math.min(x.contactos, x.contactosAntes);
        if (muestra < PISO_DE_UNA_SENAL) {
          salida.debajoDelPiso.push({ regla: ACQ.cambioBruscoConjunto, entidad, muestra });
          continue;
        }
        salida.detecciones.push({
          ...base,
          regla: ACQ.cambioBruscoConjunto,
          entidad,
          metrica: porCosto ? 'costo_por_contacto' : 'inversion',
          lineaBase: redondear(porCosto ? x.gastoAntes / x.contactosAntes : x.gastoAntes),
          valorActual: redondear(porCosto ? x.gasto / x.contactos : x.gasto),
          cambioPct: redondear(cambio, 4),
          muestra,
          gravedad: 'media',
          revisionRecomendada: 'Revisa si el conjunto cambió de presupuesto, de puja o de audiencia esta semana.',
          causasPosibles: ['puede deberse a un cambio de presupuesto o de puja', 'puede deberse a que el conjunto volvió a la fase de aprendizaje'],
          perdidaContactos: null,
          umbral: u,
          evidencia: {
            ventana: m.ventana,
            periodo,
            anterior: m.anteriorDeMeta,
            conjunto,
            ...(m.clienteDelConjunto.has(conjunto) ? { cliente: m.clienteDelConjunto.get(conjunto)! } : {}),
            ...x,
          },
        });
      }
    }
  }

  // ── El monitor de atribución: cada punto con su cifra y lo que deja de valer ──
  /* Con campañas de varios clientes (C6 · D3), el de cada cliente ACTIVO con campañas (`atribucionPorCliente`): sumados,
     el cliente chico con la atribución rota quedaba tapado por el grande. Un cliente sin denominador en la ventana —sin
     gente, en pausa o de baja— se salta: no frena la regla de los demás. Queda sin medición sólo si ninguno lo tiene,
     como la de la empresa. Los contactos de un cliente que nunca tuvo campañas no entran en ninguna proporción. */
  const monitores: [string | null, CalidadDeLaAtribucion][] = m.clienteDe.size === 0 ? [[null, m.atribucion]] : [...m.atribucionPorCliente];
  for (const punto of PUNTOS_DEL_MONITOR) {
    let medido = false;
    for (const [cliente, atribucion] of monitores) {
      const p = atribucion.puntos.find((x) => x.clave === punto.clave);
      // Sin denominador no hay nada que medir: hoy, las ventas (no hay ninguna reportada).
      if (!p || p.sobre === 0) continue;
      medido = true;
      const u = umbral(punto.regla);
      // `utm_incompletas` cuenta lo roto: su cobertura es lo que queda entero.
      const cobertura = punto.clave === 'utm_incompletas' ? 1 - p.cuantos / p.sobre : p.cuantos / p.sobre;
      if (cobertura >= u.valor) continue;
      if (p.sobre < PISO_DE_UNA_SENAL) {
        salida.debajoDelPiso.push({ regla: punto.regla, entidad: entidadDeLaCuenta(cliente), muestra: p.sobre });
        continue;
      }
      salida.detecciones.push({
        ...base,
        regla: punto.regla,
        entidad: entidadDeLaCuenta(cliente),
        metrica: `cobertura_${punto.clave}`,
        lineaBase: null,
        valorActual: redondear(cobertura, 4),
        cambioPct: null,
        muestra: p.sobre,
        gravedad: 'media',
        revisionRecomendada:
          cliente === null
            ? 'Revisa cómo llegan los datos de origen de los contactos antes de comparar anuncios.'
            : 'Revisa cómo llegan los datos de origen de los contactos de este cliente antes de comparar sus anuncios.',
        perdidaContactos: null,
        umbral: u,
        evidencia: {
          ventana: m.ventana,
          periodo,
          ...(cliente === null ? {} : { cliente }),
          punto: p.clave,
          titulo: p.titulo,
          cuantos: p.cuantos,
          sobre: p.sobre,
          consecuencia: p.consecuencia,
        },
      });
    }
    if (!medido) salida.sinMedicion.push(punto.regla);
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
