// Lo que una pantalla lee de las señales y del plan (`docs/3-agentes/02-EL-CONTRATO-DE-SENALES.md`, AG-28 a
// AG-34). **Corre dentro de `conOrganizacion(`.** Sólo lee: «vista» la marca un POST aparte (AG-24).
//
// La entidad viaja como identificador y el nombre de una campaña o de un anuncio se resuelve acá, al mostrar
// (A6-05), por `negocio.campanas` y `negocio.anuncios`; el de un cliente (el nivel 3), por `identidad.cuentas`. Con
// campañas de más de un cliente, una campaña se muestra «Campaña (Cliente)»: el de la evidencia si se midió dentro de
// su cliente, y si no el suyo. Una pieza se nombra por su nombre normalizado, sin el id de su cliente que lleva su
// identificador cuando no es del principal (`lib/negocio/idDeLaPieza.ts`): «nombre · cliente» cuando la evidencia nombra
// al cliente —el detector lo hace con piezas de dos clientes o más, como la pantalla—, y si no su nombre. Lo mismo un
// anuncio: «Anuncio (Cliente)» con la evidencia. Nunca un uuid. El rótulo de un funnel lo pone la pantalla, que ya lo
// tiene.
//
// Lo que se mide dentro de un cliente (C6 · D3) lleva el cliente adelante en su identificador cuando no es del principal
// (`idConCliente`): una familia, un patrón, el formulario y un conjunto se nombran sin él, con «(Cliente)» cuando la
// evidencia lo nombra. Y la señal trae aparte el nombre de su cliente (`cliente`) y su evidencia con el nombre en vez del
// id, para que la tarjeta, «Ver evidencia» y los cajones de Conversion digan de cuál es.
// Lo que no tiene nombre —un conjunto, una campaña que GoHighLevel no listó— viaja sin él y la pantalla dibuja el
// identificador.

import { datos } from '../../datos/contexto.ts';
import { NOMBRE_DEL_AGENTE } from '../../auditor/vista.ts';
import { clienteDeCadaCampana } from '../../negocio/embudosDeAcquisition.ts';
import { nombreDeLaPieza, partirIdConCliente, rotuloDeLaPieza } from '../../negocio/idDeLaPieza.ts';
import { ROTULOS, type Familia } from '../../negocio/recorrido.ts';
import { CATALOGO_DE_REGLAS, umbralesFirmados, umbralVigente } from './umbrales.ts';
import type { DepartamentoConSenales, Deteccion, Gravedad, VentanaDeSenal } from './tipos.ts';

export interface SenalParaMostrar {
  id: string;
  regla: string;
  entidad: Deteccion['entidad'];
  /** El nombre de la entidad, o `null` si no tiene uno que mostrar. */
  nombre: string | null;
  /**
   * El nombre del cliente que nombra su evidencia (el nivel 3, C6 · D3); con un cliente, nunca viene. Es el que la
   * pantalla antepone cuando la frase no lo dice (los cajones de Conversion, el funnel de una fuga). Sólo viene con él.
   */
  cliente?: string;
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
  /** Lo que midió la regla. Su `cliente` llega con el nombre y no con el id: «Ver evidencia» la dibuja tal cual. */
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
  /* El cliente de cada campaña cuando son de más de uno (el nivel 3), con el criterio de la pantalla de Acquisition:
     TODA señal de campaña se nombra «Campaña (Cliente)» —sin entrega, el costo por lead, el ICP—, no sólo la que se
     midió dentro de su cliente; dos campañas homónimas de dos clientes no se distinguen por el nombre. Con uno, vacío. */
  const clienteDeLaCampana = filas.some((f) => f.entidad_tipo === 'campana') ? await clienteDeCadaCampana() : new Map<string, string>();
  /* Los clientes (el nivel 3): la entidad de lo que es de toda una cuenta publicitaria con varios, el de cada campaña y
     el de lo que se midió dentro de un cliente. Las pantallas de señales abren la empresa entera, así que se ven todos. */
  const clientes =
    clienteDeLaCampana.size > 0 || filas.some((f) => f.entidad_tipo === 'cliente' || clienteDeLaEvidencia(f.evidencia) !== null)
      ? new Map((await datos().selectFrom('cuentas').select(['id', 'nombre']).execute()).map((c) => [c.id, c.nombre]))
      : new Map<string, string>();

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
      // Sin esto, la frase de Conversation perdía de dónde parece venir el error al leerla (lo vio la 235).
      issueSource: f.issue_source as Deteccion['issueSource'],
    };
    const delCliente = clienteDeLaEvidencia(f.evidencia);
    return {
      id: f.id,
      regla: f.regla,
      entidad: deteccion.entidad,
      nombre: nombreDe(deteccion.entidad, campanas, anuncios, clientes, delCliente ?? clienteDeLaCampana.get(f.entidad_id) ?? null),
      ...(delCliente !== null && clientes.has(delCliente) ? { cliente: clientes.get(delCliente)! } : {}),
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
      // Nunca un uuid (AG-21): el cliente de la evidencia, por su nombre. La frase ya se armó con la de verdad.
      evidencia: delCliente !== null && clientes.has(delCliente) ? { ...(f.evidencia as object), cliente: clientes.get(delCliente) } : f.evidencia,
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

/**
 * El último plan guardado del departamento en esa ventana: el de hoy, o el último día que corrió. Con renglones de varios
 * clientes (C6 · D3), `clientes` trae el nombre de cada uno: el renglón guarda su id, y la pantalla dice de cuál es.
 */
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
  const ids = new Set(
    ((f.plan as { grupos?: { renglones?: { cliente?: unknown }[] }[] } | null)?.grupos ?? [])
      .flatMap((g) => g.renglones ?? [])
      .map((r) => r.cliente)
      .filter((c): c is string => typeof c === 'string'),
  );
  const clientes =
    ids.size === 0
      ? null
      : Object.fromEntries(
          (await datos().selectFrom('cuentas').select(['id', 'nombre']).where('id', 'in', [...ids]).execute()).map((c) => [c.id, c.nombre]),
        );
  return {
    dia: dia(f.dia)!,
    plan: f.plan,
    redaccion: f.redaccion,
    bajoElPiso: f.bajo_el_piso,
    bajoElPisoDetalle: f.bajo_el_piso_detalle,
    actualizado: f.actualizado_el.toISOString(),
    ...(clientes === null ? {} : { clientes }),
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

/** El cliente que la evidencia nombra, si la regla se midió dentro de un cliente (el nivel 3): su id, o `null`. */
function clienteDeLaEvidencia(evidencia: unknown): string | null {
  const c = (evidencia as { cliente?: unknown } | null)?.cliente;
  return typeof c === 'string' ? c : null;
}

function nombreDe(
  entidad: Deteccion['entidad'],
  campanas: ReadonlyMap<string, string | null>,
  anuncios: ReadonlyMap<string, string | null>,
  clientes: ReadonlyMap<string, string>,
  /**
   * El cliente de una campaña: el de la evidencia, si se midió dentro de su cliente, o el suyo cuando las campañas son
   * de más de uno. Una campaña con cliente se nombra «Campaña (Cliente)». El de una pieza o un anuncio, el de la
   * evidencia: Creative lo nombra con piezas de dos clientes o más.
   */
  delCliente: string | null,
): string | null {
  switch (entidad.tipo) {
    case 'campana': {
      const nombre = campanas.get(entidad.id) ?? null;
      const cliente = delCliente === null ? undefined : clientes.get(delCliente);
      // Sin cliente —con un solo cliente siempre—, el nombre de siempre.
      return cliente === undefined ? nombre : `${nombre ?? `Campaña ${entidad.id}`} (${cliente})`;
    }
    case 'cliente':
      // Un cliente (el nivel 3), por su nombre en identidad: la entidad es su id de `identidad.cuentas`.
      return clientes.get(entidad.id) ?? null;
    case 'anuncio': {
      const nombre = anuncios.get(entidad.id) ?? null;
      const cliente = delCliente === null ? undefined : clientes.get(delCliente);
      // Sin cliente —con un solo cliente siempre—, el nombre de siempre.
      return cliente === undefined ? nombre : `${nombre ?? `Anuncio ${entidad.id}`} (${cliente})`;
    }
    case 'pieza': {
      // Su nombre, sin el id del cliente que lleva cuando no es del principal; con el de la evidencia, «nombre · cliente».
      return rotuloDeLaPieza(nombreDeLaPieza(entidad.id), delCliente === null ? null : (clientes.get(delCliente) ?? null));
    }
    case 'familia_de_entrada': {
      // La familia por su rótulo de pantalla (Conversion): «Landing con VSL», no `landing`; sin el cliente de su id.
      const familia = partirIdConCliente(entidad.id).resto;
      return conSuCliente(ROTULOS[familia as Familia]?.titulo ?? familia, clientes, delCliente);
    }
    case 'patron': {
      // `agente:patron`: se nombra por el agente del CRM, como la pantalla (LeadFlow, AppFlow); sin el cliente de su id.
      const agente = partirIdConCliente(entidad.id).resto.split(':')[0]!;
      return conSuCliente((NOMBRE_DEL_AGENTE as Readonly<Record<string, string>>)[agente] ?? agente, clientes, delCliente);
    }
    case 'funnel':
      // El formulario de la landing (Conversion): sin nombre con un cliente, como siempre; con varios, el suyo.
      return delCliente !== null && partirIdConCliente(entidad.id).resto === 'formulario' ? conSuCliente('Formulario', clientes, delCliente) : null;
    case 'conjunto':
      // Un conjunto no tiene nombre guardado: la pantalla dibuja su id. Con su cliente (C6 · D3), «Conjunto N (Cliente)».
      return delCliente !== null && clientes.has(delCliente) ? conSuCliente(`Conjunto ${entidad.id}`, clientes, delCliente) : null;
    default:
      // El par de etapas de una fuga: el rótulo de su funnel lo pone la pantalla, con el cliente de `cliente`.
      return null;
  }
}

/** «Nombre (Cliente)» si la evidencia nombra a un cliente que se conoce; si no, el nombre de siempre. */
function conSuCliente(nombre: string, clientes: ReadonlyMap<string, string>, delCliente: string | null): string {
  const cliente = delCliente === null ? undefined : clientes.get(delCliente);
  return cliente === undefined ? nombre : `${nombre} (${cliente})`;
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
