// La ficha de una persona en Leads Portal. SÓLO LEE.
//
// ═══════════════════════════════════════════════════════════════════════════════
// NO ES LA FICHA DEL CLOSER, Y LA DIFERENCIA ES QUE ÉSTA NO TOCA NADA
//
// La ficha del closer refresca al contacto contra el CRM al abrirse: es *«la llamada que cuesta abrir
// la ficha»*, gasta presupuesto del proveedor y puede reescribir el territorio. Ésta no. Lee lo que
// la sincronización ya guardó y lo dice con la fecha de esa sincronización, porque de los 25
// contactos congelados la ficha es la foto del último día que se vieron (medido el 2026-09-27).
//
// **Lo que muestra sale de los mismos predicados que la fila de la rejilla.** El estado de la cita,
// la asistencia y el plantón son los fragmentos de `leadsDelPortal.ts`, y el tramo es
// `tramoDelPuntaje`: si la tarjeta dice «sin registrar», la ficha no puede decir otra cosa.
//
// ── LO QUE VIAJA Y LO QUE NO ────────────────────────────────────────────────
//
// Acá sí van el teléfono y el correo —la decisión del 2026-09-26 los pone en la ficha y sólo en la
// ficha—. Lo demás pasa por lista: la atribución por `atribucionVisible`, las etiquetas sólo si son de
// descarte, el closer por su nombre y nunca por el id del CRM, y de los mensajes el conteo y las
// fechas, nunca el texto: la conversación es del closer y del setter, que ya la ven en su pantalla.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { CAMPO_DEL_PUNTAJE, ETIQUETAS_DE_DESCARTE } from '../ghl/contrato.ts';
import { closersDeLaEmpresa } from './alcanceDelCloser.ts';
import { camposQueSeMuestran, campoPorNombre } from './camposDelCrm.ts';
import { cancelada, alcanzable } from './citasAlcanzables.ts';
import { CAMPO_DEL_PRECALL, ramaDelPrecall } from './consumoDelPrecall.ts';
import { HUECOS, MEDIDO_EL, type HuecoDelPortal } from './huecosDelLeadsPortal.ts';
import { asistenciaDe, estadoDeCita, plantonDe, type Asistencia, type EstadoDeCita } from './leadsDelPortal.ts';
import {
  CAMPO_DEL_FORMULARIO,
  familiaDelRecorrido,
  hostDe,
  ROTULOS as ROTULOS_DEL_RECORRIDO,
  type Familia,
  ultimoDiaDelFormulario,
} from './recorrido.ts';
import { definicionDe } from './salidas.ts';
import { atribucionVisible, type ParametroVisible } from './atribucionVisible.ts';
import {
  type ClaveDeTramo,
  motivoSinCalificar,
  type MotivoSinCalificar,
  rotuloDelTramo,
  tramoDelPuntaje,
} from './tramosDelIcp.ts';
import { montoReportado, tieneVenta } from './ventasDelContacto.ts';

/** El closer asignado, por su nombre. **El id crudo del CRM no viaja nunca.** */
export type CloserDeLaFicha =
  | { estado: 'closer'; nombre: string }
  /** Asignado en el CRM a alguien que no es un closer configurado acá. */
  | { estado: 'no_configurado' }
  | { estado: 'sin_asignar' };

export interface FichaDelLead {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  pais: string | null;
  altaEl: string | null;
  /** La última vez que la sincronización lo vio. La ficha no refresca: esto dice de cuándo es la foto. */
  sincronizadoEl: string | null;
  territorio: 'closer' | 'setter' | 'congelado';
  /** Las etiquetas de descarte que tiene, tal como las escribió el CRM. Vacío = no está descartado. */
  descarte: string[];
  puntaje: {
    valor: number | null;
    tramo: ClaveDeTramo;
    rotulo: string;
    /** Por qué está en «Sin calificar». El 0 viaja con el suyo: «0, se cuenta como sin calificar». */
    motivo: MotivoSinCalificar | null;
  };
  recorrido: {
    entro: { altaEl: string | null; campana: string | null; creativo: string | null };
    /** El ÚLTIMO toque, con la clasificación de Conversion. Reemplaza al «Vio el VSL» de la maqueta. */
    llegoPor: { familia: Familia; titulo: string; que: string };
    agendo: {
      estado: EstadoDeCita;
      /** La primera cita alcanzable. */
      primeraCitaEl: string | null;
      /** Tiene citas alcanzables y todas están canceladas: «agendó y canceló». */
      todasCanceladas: boolean;
    };
    asistio: { asistencia: Asistencia | null; planton: boolean };
    compro: { vendio: boolean; monto: number | null; acuerdoSinPago: boolean };
  };
  /** Las respuestas del grupo `calificacion`, sin el puntaje, que va arriba. Un campo vacío no viaja. */
  cuestionario: { etiqueta: string; valor: string }[];
  formulario: {
    valor: string | null;
    /** El último día con el campo escrito en la empresa. `null` = nunca se escribió. */
    corte: string | null;
    /** Entró después del corte: un vacío no dice «no completó», dice que el campo ya no se escribe. */
    despuesDelCorte: boolean;
  };
  precall: {
    /** Tal como lo escribe el CRM. Nunca convertido a número: conviven dos escalas. */
    valor: string | null;
    /** «Nada» y «Sin abrir (0%)» son el valor inicial que el CRM escribe al agendar. */
    sinReproduccionRegistrada: boolean;
  };
  mensajes: {
    ultimoEntranteEl: string | null;
    ultimoSalienteEl: string | null;
    /** Sin la historia leída, un cero no es «nunca escribió». */
    historiaLeida: boolean;
    entrantes: number | null;
    salientes: number | null;
  };
  citas: { inicioEl: string; estado: string | null; alcanzable: boolean; asistio: boolean | null }[];
  resultados: { salida: string; nombre: string; creadoEl: string; monto: number | null }[];
  publicidad: ParametroVisible[];
  closer: CloserDeLaFicha;
  huecos: { medidoEl: string; lista: readonly HuecoDelPortal[] };
}

const iso = (d: Date | string | null | undefined): string | null =>
  d === null || d === undefined ? null : new Date(d).toISOString();

/**
 * La ficha de una persona, o `null` si no existe **en esta empresa**.
 *
 * Se corre dentro de `conOrganizacion(`. El id de otra empresa no da un error ni una ficha vacía: da
 * `null`, porque la política de la tabla ya no deja verla, y la ruta lo convierte en 404. Nunca hay
 * un relleno: la maqueta copiaba la ficha del primer contacto con otro nombre cuando no encontraba.
 */
export async function fichaDelLeadDelPortal(id: string): Promise<FichaDelLead | null> {
  const c = await datos()
    .selectFrom('contactos as c')
    .select([
      'c.id',
      'c.nombre',
      'c.telefono',
      'c.email',
      'c.pais',
      'c.alta_en_el_crm',
      'c.sincronizado_el',
      'c.territorio',
      'c.score',
      'c.etiquetas',
      'c.atribucion_primera',
      'c.campos_del_crm',
      'c.crm_asignado_a',
      'c.ultimo_entrante_el',
      'c.ultimo_saliente_el',
      'c.mensajes_desde_el',
      sql<Familia>`${familiaDelRecorrido('c')}`.as('familia'),
      sql<string | null>`${hostDe('c', 'atribucion_primera', 'url')}`.as('host_url'),
      sql<string | null>`${hostDe('c', 'atribucion_primera', 'referrer')}`.as('host_referrer'),
      sql<string | null>`(select an.nombre from negocio.anuncios an
                           where an.org_id = c.org_id
                             and an.meta_anuncio_id = c.atribucion_primera ->> 'adId'
                           limit 1)`.as('nombre_del_anuncio'),
      sql<EstadoDeCita>`${estadoDeCita('c')}`.as('cita'),
      sql<Asistencia | null>`${asistenciaDe('c')}`.as('asistencia'),
      sql<boolean>`${plantonDe('c')}`.as('planton'),
      sql<boolean>`${tieneVenta('c')}`.as('vendio'),
      sql<string | null>`${montoReportado('c')}`.as('monto'),
      sql<boolean>`exists (select 1 from negocio.resultados r
                            where r.org_id = c.org_id and r.contacto_id = c.id
                              and r.salida = 'acuerdo_sin_pago')`.as('acuerdo_sin_pago'),
      sql<Date | null>`(select min(ci.inicio_el) from negocio.citas ci
                         where ci.org_id = c.org_id and ci.contacto_id = c.id and ${alcanzable('ci')})`.as(
        'primera_cita',
      ),
      sql<boolean>`(exists (select 1 from negocio.citas ci
                             where ci.org_id = c.org_id and ci.contacto_id = c.id and ${alcanzable('ci')})
                    and not exists (select 1 from negocio.citas ci
                                     where ci.org_id = c.org_id and ci.contacto_id = c.id
                                       and ${alcanzable('ci')} and not ${cancelada('ci')}))`.as(
        'todas_canceladas',
      ),
    ])
    .where('c.id', '=', id)
    .executeTakeFirst();

  if (!c) return null;

  const [citas, resultados, mensajes, mostrables, campoFormulario, corte, campoPrecall, closers] =
    await Promise.all([
      datos()
        .selectFrom('citas')
        .select(['inicio_el', 'estado_ghl', 'ghl_calendario_id', 'asistio'])
        .where('contacto_id', '=', id)
        .orderBy('inicio_el', 'desc')
        .execute(),
      datos()
        .selectFrom('resultados')
        .select(['salida', 'rol', 'creado_el', 'monto'])
        .where('contacto_id', '=', id)
        .orderBy('creado_el', 'desc')
        .execute(),
      datos()
        .selectFrom('mensajes')
        .select([
          sql<number>`count(*) filter (where direccion = 'entrante')`.as('entrantes'),
          sql<number>`count(*) filter (where direccion = 'saliente')`.as('salientes'),
        ])
        .where('contacto_id', '=', id)
        .executeTakeFirst(),
      camposQueSeMuestran(),
      campoPorNombre(CAMPO_DEL_FORMULARIO),
      ultimoDiaDelFormulario(),
      campoPorNombre(CAMPO_DEL_PRECALL),
      closersDeLaEmpresa(),
    ]);

  const valores = c.campos_del_crm ?? {};
  const textoDe = (campo: string | null): string | null => {
    if (campo === null) return null;
    const v = valores[campo];
    return v === undefined || v === null || String(v).trim() === '' ? null : String(v);
  };

  /* ── EL CUESTIONARIO: EL GRUPO `calificacion`, MENOS EL PUNTAJE ──────────
   *
   * Es la misma lista que el grupo `calificacion` del Perfil del closer (`perfilDeLaFicha` la arma
   * con `camposQueSeMuestran` también): agrupada por significado, con un campo sin grupo afuera y un
   * vacío sin mandar. Se arma acá y no llamando a `perfilDeLaFicha` porque aquélla le agrega la
   * «Calificación» y deja el campo del puntaje adentro, y la ficha lo mostraría dos veces: el puntaje
   * va una sola vez, arriba, con su tramo. */
  const cuestionario = mostrables
    .filter((m) => m.grupo === 'calificacion' && m.campoId !== CAMPO_DEL_PUNTAJE)
    .map((m) => ({ etiqueta: m.etiqueta, valor: textoDe(m.campoId) }))
    .filter((x): x is { etiqueta: string; valor: string } => x.valor !== null);

  const precall = textoDe(campoPrecall);
  const alta = c.alta_en_el_crm;
  const historiaLeida = c.mensajes_desde_el !== null;
  const descarte = new Set<string>(ETIQUETAS_DE_DESCARTE);
  const asignado = c.crm_asignado_a;
  const closer = asignado === null ? null : closers.find((k) => k.crmUsuarioId === asignado);
  const tramo = tramoDelPuntaje(c.score);

  return {
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono,
    email: c.email,
    pais: c.pais,
    altaEl: iso(alta),
    sincronizadoEl: iso(c.sincronizado_el),
    territorio: c.territorio ?? 'congelado',
    descarte: (c.etiquetas ?? []).filter((e) => descarte.has(e.toLowerCase())),
    puntaje: {
      valor: c.score,
      tramo,
      rotulo: rotuloDelTramo(tramo),
      motivo: motivoSinCalificar(c.score),
    },
    recorrido: {
      entro: {
        altaEl: iso(alta),
        campana: textoPlano(c.atribucion_primera?.campaign),
        creativo: textoPlano(c.atribucion_primera?.utmContent),
      },
      llegoPor: { familia: c.familia, ...ROTULOS_DEL_RECORRIDO[c.familia] },
      agendo: {
        estado: c.cita,
        primeraCitaEl: iso(c.primera_cita),
        todasCanceladas: Boolean(c.todas_canceladas),
      },
      asistio: { asistencia: c.asistencia, planton: Boolean(c.planton) },
      compro: {
        vendio: Boolean(c.vendio),
        /* Sólo con venta: el monto de un acuerdo sin pago no es un monto reportado. */
        monto: c.vendio && c.monto !== null ? Number(c.monto) : null,
        acuerdoSinPago: Boolean(c.acuerdo_sin_pago),
      },
    },
    cuestionario,
    formulario: {
      valor: textoDe(campoFormulario),
      corte,
      /* Comparado como fecha de calendario, igual que el corte, que sale de la base como `date`. */
      despuesDelCorte: corte !== null && alta !== null && iso(alta)!.slice(0, 10) > corte,
    },
    precall: {
      valor: precall,
      sinReproduccionRegistrada: precall !== null && ramaDelPrecall(precall) === 'sin_reproduccion',
    },
    mensajes: {
      ultimoEntranteEl: iso(c.ultimo_entrante_el),
      ultimoSalienteEl: iso(c.ultimo_saliente_el),
      historiaLeida,
      entrantes: historiaLeida ? Number(mensajes?.entrantes ?? 0) : null,
      salientes: historiaLeida ? Number(mensajes?.salientes ?? 0) : null,
    },
    citas: citas.map((ci) => ({
      inicioEl: iso(ci.inicio_el)!,
      estado: ci.estado_ghl,
      alcanzable: ci.ghl_calendario_id !== null,
      asistio: ci.asistio,
    })),
    resultados: resultados.map((r) => ({
      salida: r.salida,
      /* El nombre sale del catálogo del ROL que lo registró: `seguimiento` y `nurture` existen en los
         dos negocios con definiciones distintas. */
      nombre: definicionDe(r.rol, r.salida)?.nombre ?? r.salida,
      creadoEl: iso(r.creado_el)!,
      monto: r.salida === 'venta' && r.monto !== null ? Number(r.monto) : null,
    })),
    publicidad: atribucionVisible(c.atribucion_primera, {
      hostDeLaUrl: c.host_url,
      hostDelReferrer: c.host_referrer,
      nombreDelAnuncio: c.nombre_del_anuncio,
    }),
    closer:
      asignado === null
        ? { estado: 'sin_asignar' }
        : closer
          ? { estado: 'closer', nombre: closer.nombre }
          : { estado: 'no_configurado' },
    huecos: { medidoEl: MEDIDO_EL, lista: HUECOS },
  };
}

function textoPlano(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}
