// Lo que una pantalla lee de las señales y del plan (`docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`, AG-28 a
// AG-34). **Corre dentro de `conOrganizacion(`.** Sólo lee: «vista» la marca un POST aparte (AG-24).
//
// La entidad viaja como identificador y el nombre de una campaña o de un anuncio se resuelve acá, al mostrar
// (A6-05), por `negocio.campanas` y `negocio.anuncios`. Una pieza no tiene otro identificador que su nombre
// normalizado (`lib/negocio/creativo.ts`), así que ése es su nombre. El rótulo de un funnel lo pone la pantalla,
// que ya lo tiene. Lo que no tiene nombre —un conjunto, una campaña que GoHighLevel no listó— viaja sin él y la
// pantalla dibuja el identificador.

import { datos } from '../../datos/contexto.ts';
import { CATALOGO_DE_REGLAS, umbralesFirmados, umbralVigente } from './umbrales.ts';
import type { DepartamentoConSenales, Deteccion, Gravedad, VentanaDeSenal } from './tipos.ts';

export interface SenalParaMostrar {
  id: string;
  regla: string;
  entidad: Deteccion['entidad'];
  /** El nombre de la entidad, o `null` si no tiene uno que mostrar. */
  nombre: string | null;
  gravedad: Gravedad;
  confianza: 'alta' | 'media';
  estado: 'abierta' | 'vista' | 'sin_medicion';
  /** La frase de su regla: métrica, valor y base juntas (A6-06). */
  texto: string;
  revision: string;
  causasPosibles: string[];
  perdidaContactos: number | null;
  muestra: number | null;
  periodo: { desde: string | null; hasta: string };
  requiereValidacionEjecutiva: boolean;
  /** En foto: con qué valor se calculó y si era provisional (AG-33). */
  umbral: { valor: number; provisional: boolean };
  evidencia: unknown;
  ultimaDeteccion: string;
}

const ORDEN_DE_GRAVEDAD: Record<Gravedad, number> = { critica: 0, alta: 1, media: 2, info: 3 };

/** Las del departamento y la ventana que todavía piden algo: vivas. Ordenadas por pérdida y después por gravedad (AG-29). */
export async function senalesDeLaPantalla(
  departamento: DepartamentoConSenales,
  ventana: VentanaDeSenal,
  texto: (d: Deteccion, ventana: VentanaDeSenal) => string,
): Promise<SenalParaMostrar[]> {
  const filas = await datos()
    .selectFrom('senales')
    .selectAll()
    .where('departamento', '=', departamento)
    .where('ventana', '=', ventana)
    .where('estado', 'in', ['abierta', 'vista', 'sin_medicion'])
    .execute();
  const campanas = filas.some((f) => f.entidad_tipo === 'campana')
    ? new Map((await datos().selectFrom('campanas').select(['meta_campana_id', 'nombre']).execute()).map((c) => [c.meta_campana_id, c.nombre]))
    : new Map<string, string | null>();
  const anuncios = filas.some((f) => f.entidad_tipo === 'anuncio')
    ? new Map((await datos().selectFrom('anuncios').select(['meta_anuncio_id', 'nombre']).execute()).map((a) => [a.meta_anuncio_id, a.nombre]))
    : new Map<string, string | null>();

  const salida = filas.map((f): SenalParaMostrar => {
    const deteccion: Deteccion = {
      regla: f.regla,
      entidad: { tipo: f.entidad_tipo as Deteccion['entidad']['tipo'], id: f.entidad_id },
      metrica: f.metrica,
      lineaBase: numero(f.linea_base),
      valorActual: numero(f.valor_actual),
      cambioPct: numero(f.cambio_pct),
      muestra: f.muestra,
      periodo: { desde: dia(f.periodo_desde), hasta: dia(f.periodo_hasta)! },
      datosDesde: dia(f.datos_desde),
      gravedad: f.gravedad,
      causasPosibles: f.causas_posibles,
      revisionRecomendada: f.revision_recomendada,
      perdidaContactos: numero(f.perdida_contactos),
      destino: f.destino_departamento,
      requiereValidacionEjecutiva: f.requiere_validacion_ejecutiva,
      umbral: f.umbral as Deteccion['umbral'],
      evidencia: f.evidencia,
    };
    return {
      id: f.id,
      regla: f.regla,
      entidad: deteccion.entidad,
      nombre: nombreDe(deteccion.entidad, campanas, anuncios),
      gravedad: f.gravedad,
      confianza: f.confianza,
      estado: f.estado as SenalParaMostrar['estado'],
      texto: texto(deteccion, ventana),
      revision: f.revision_recomendada,
      causasPosibles: f.causas_posibles,
      perdidaContactos: deteccion.perdidaContactos,
      muestra: f.muestra,
      periodo: deteccion.periodo,
      requiereValidacionEjecutiva: f.requiere_validacion_ejecutiva,
      umbral: deteccion.umbral,
      evidencia: f.evidencia,
      ultimaDeteccion: f.ultima_deteccion_el.toISOString(),
    };
  });
  salida.sort(
    (a, b) =>
      (b.perdidaContactos ?? -1) - (a.perdidaContactos ?? -1) ||
      ORDEN_DE_GRAVEDAD[a.gravedad] - ORDEN_DE_GRAVEDAD[b.gravedad] ||
      a.regla.localeCompare(b.regla) ||
      a.entidad.id.localeCompare(b.entidad.id),
  );
  return salida;
}

/** El último plan guardado del departamento en esa ventana: el de hoy, o el último día que corrió. */
export async function ultimoPlan(departamento: DepartamentoConSenales, ventana: VentanaDeSenal) {
  const f = await datos()
    .selectFrom('planes_de_accion')
    .select(['dia', 'plan', 'redaccion', 'bajo_el_piso', 'bajo_el_piso_detalle', 'actualizado_el'])
    .where('departamento', '=', departamento)
    .where('ventana', '=', ventana)
    .orderBy('dia', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (!f) return null;
  return {
    dia: dia(f.dia)!,
    plan: f.plan,
    redaccion: f.redaccion,
    bajoElPiso: f.bajo_el_piso,
    bajoElPisoDetalle: f.bajo_el_piso_detalle,
    actualizado: f.actualizado_el.toISOString(),
  };
}

/** Las reglas del departamento con su umbral vigente en esta empresa: para firmar y para decir «provisional». */
export async function reglasDelDepartamento(departamento: DepartamentoConSenales) {
  const firmados = await umbralesFirmados();
  return CATALOGO_DE_REGLAS.filter((r) => r.departamento === departamento).map((r) => ({
    codigo: r.codigo,
    unidad: r.unidad,
    denominador: r.denominador,
    gravedad: r.gravedad,
    porque: r.porque,
    valorProvisional: r.valor,
    ...umbralVigente(r, firmados),
  }));
}

/** El estado del departamento para su ficha (AG-34): crítica abierta da `crit`; alta o media, `warn`; sin vivas, `ok`. */
export function estadoDelDepartamento(senales: readonly Pick<SenalParaMostrar, 'gravedad'>[]): 'crit' | 'warn' | 'ok' {
  if (senales.some((s) => s.gravedad === 'critica')) return 'crit';
  if (senales.some((s) => s.gravedad === 'alta' || s.gravedad === 'media')) return 'warn';
  return 'ok';
}

function nombreDe(
  entidad: Deteccion['entidad'],
  campanas: ReadonlyMap<string, string | null>,
  anuncios: ReadonlyMap<string, string | null>,
): string | null {
  switch (entidad.tipo) {
    case 'campana':
      return campanas.get(entidad.id) ?? null;
    case 'anuncio':
      return anuncios.get(entidad.id) ?? null;
    case 'pieza':
      return entidad.id;
    default:
      return null;
  }
}

const numero = (v: string | number | null) => (v === null ? null : Number(v));

/**
 * `pg` devuelve un `date` como la medianoche LOCAL de Node, así que se lee con los componentes locales y no
 * con `toISOString`, que lo correría un día al este de Greenwich.
 */
function dia(d: Date | null): string | null {
  if (d === null) return null;
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}
