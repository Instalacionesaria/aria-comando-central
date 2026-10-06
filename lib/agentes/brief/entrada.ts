// Lo que lee el Brief del closer de una cita (AG12 de los agentes; `docs/OTROS/agentes/fichas/F13-CLOSER-Y-BRIEF.md`,
// «El Brief: qué lee»). **Corre dentro de `conOrganizacion(`.** Sólo lee.
//
// ═══════════════════════════════════════════════════════════════════════════════
// CADA DATO CON SU FUENTE, DESDE ACÁ
//
// Cada dato que viaja al modelo lleva una clave de fuente —`formulario:3`, `ficha:campana`,
// `llamada:facturacion`, `objeciones_frecuentes`— y el modelo tiene que citarla. Así la validación
// (`./brief.ts`) puede comprobar que un dato «detectado» salió de algún lado y que su cita está en ese dato:
// inventar cuesta una cita verificable (el patrón de `lib/analizadores/nucleo/prospect-card.ts`).
//
// ── MÁS ESTRICTO QUE LA FICHA (AG-F13-4, `T-20`) ──────────────────────────────
//
// La ficha de un contacto no filtra por territorio. El Brief sí: manda datos de una persona al modelo. La cita
// tiene que ser de un contacto del territorio del closer y, para un closer con «mío», de un contacto suyo. Si
// no, para quien pide no existe.
//
// ── LO QUE NO VIAJA ─────────────────────────────────────────────────────────
//
// El teléfono y el correo del contacto: el Brief prepara una conversación, no la contacta.
//
// ── LA HUELLA ───────────────────────────────────────────────────────────────
//
// La huella es la de lo que es DE ESTA PERSONA y puede cambiar: el formulario, la ficha y la llamada anterior.
// Las objeciones frecuentes de la empresa no entran: cambian todos los días, y dirían «hay datos nuevos» de
// cada Brief cada mañana sin que nada de la persona haya cambiado.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import { datos } from '../../datos/contexto.ts';
import type { AlcanceDelCloser } from '../../negocio/alcanceDelCloser.ts';
import { camposQueSeMuestran } from '../../negocio/camposDelCrm.ts';
import { fichaDelLeadDelPortal } from '../../negocio/fichaDelLeadDelPortal.ts';
import { llamadasDeVenta } from '../../negocio/llamadasDeVenta.ts';
import { HORAS_DEL_VINCULO_POR_CITA, vinculosDe } from '../../negocio/vinculoDeLlamadas.ts';

/** Un dato con su fuente. `cita` y `minuto`, sólo los de una llamada. */
export interface DatoDeLaEntrada {
  fuente: string;
  etiqueta: string;
  valor: string;
  cita?: string | null;
  minuto?: number | null;
}

export interface EntradaDelBrief {
  cita: { id: string; inicioEl: string; contactoId: string };
  /** El nombre del contacto, para que el Brief lo nombre. */
  nombre: string;
  formulario: DatoDeLaEntrada[];
  /** De dónde vino, su puntaje de ICP y su recorrido (`fichaDelLeadDelPortal`). */
  ficha: DatoDeLaEntrada[];
  /** Lo que la ficha de su última llamada de venta registró, con la cita y el minuto. */
  llamada: DatoDeLaEntrada[];
  /** Las objeciones de las llamadas de la empresa, por categoría, en 30 días. No son de esta persona. */
  objecionesFrecuentes: { categoria: string; veces: number }[];
  sinFormulario: boolean;
  huella: string;
}

/**
 * Las respuestas del formulario de cada contacto: los campos del CRM de las carpetas elegidas que tienen valor,
 * en el orden del Perfil (`camposQueSeMuestran`). La misma regla para el Brief y para la marca «SIN FORMULARIO»
 * de Mi Día (`./guardar.ts`): con dos, la marca podría decir «sin formulario» de un Brief que lo usó.
 */
export async function formulariosDe(contactoIds: readonly string[]): Promise<Map<string, { etiqueta: string; valor: string }[]>> {
  if (contactoIds.length === 0) return new Map();
  const mostrables = await camposQueSeMuestran();
  const filas = await datos().selectFrom('contactos').select(['id', 'campos_del_crm']).where('id', 'in', [...new Set(contactoIds)]).execute();
  return new Map(
    filas.map((k) => {
      const valores = k.campos_del_crm ?? {};
      const respuestas = mostrables
        .map((m) => ({ etiqueta: m.etiqueta, valor: String(valores[m.campoId] ?? '').trim() }))
        .filter((r) => r.valor !== '');
      return [k.id, respuestas];
    }),
  );
}

/** Los campos de la ficha de una llamada que sirven para preparar la siguiente, con su rótulo. */
const DE_LA_LLAMADA: readonly [string, (f: FichaDeLlamada) => CampoDeLlamada | undefined, string][] = [
  ['negocio', (f) => f.business?.model, 'Su negocio'],
  ['tamano', (f) => f.business?.size, 'Tamaño'],
  ['facturacion', (f) => f.business?.revenue, 'Facturación'],
  ['quiere', (f) => f.whatTheyWant, 'Lo que quiere'],
  ['objecion', (f) => f.buyingIntent?.mainObjection, 'Su objeción principal'],
  ['decide', (f) => f.buyingIntent?.whoDecides, 'Quién decide'],
  ['urgencia', (f) => f.buyingIntent?.urgency, 'Urgencia'],
  ['pago', (f) => f.buyingIntent?.payAbility, 'Capacidad de pago'],
];

interface CampoDeLlamada {
  state?: string;
  value?: string | null;
  quote?: string | null;
  startSec?: number | null;
}
interface FichaDeLlamada {
  business?: { model?: CampoDeLlamada; size?: CampoDeLlamada; revenue?: CampoDeLlamada };
  whatTheyWant?: CampoDeLlamada;
  buyingIntent?: { mainObjection?: CampoDeLlamada; whoDecides?: CampoDeLlamada; urgency?: CampoDeLlamada; payAbility?: CampoDeLlamada };
}

/**
 * La entrada del Brief de una cita, o `null` si para quien pide no existe: no está, no es del territorio del
 * closer, o es de un contacto de otro closer y quien pide ve «mío».
 */
export async function entradaDelBrief(citaId: string, alcance: AlcanceDelCloser): Promise<EntradaDelBrief | null> {
  let q = datos()
    .selectFrom('citas as c')
    .innerJoin('contactos as k', (j) => j.onRef('k.org_id', '=', 'c.org_id').onRef('k.id', '=', 'c.contacto_id'))
    .select(['c.id', 'c.inicio_el', 'c.contacto_id', 'k.nombre', 'k.email'])
    .where('c.id', '=', citaId)
    .where('k.territorio', '=', 'closer');
  if (alcance.tipo === 'mio') q = q.where('k.crm_asignado_a', '=', alcance.crmUsuarioId);
  const c = await q.executeTakeFirst();
  if (!c) return null;

  // ── El formulario: los campos del CRM de las carpetas elegidas, numerados ──
  const respuestas = (await formulariosDe([c.contacto_id])).get(c.contacto_id) ?? [];
  const formulario = respuestas.map((f, i): DatoDeLaEntrada => ({ fuente: `formulario:${i + 1}`, etiqueta: f.etiqueta, valor: f.valor }));

  // ── La ficha del lead: de dónde vino y su puntaje ──
  const lead = await fichaDelLeadDelPortal(c.contacto_id);
  const ficha: DatoDeLaEntrada[] = [];
  const poner = (fuente: string, etiqueta: string, valor: string | number | null | undefined) => {
    if (valor !== null && valor !== undefined && String(valor).trim() !== '') ficha.push({ fuente: `ficha:${fuente}`, etiqueta, valor: String(valor) });
  };
  if (lead) {
    poner('puntaje', 'Puntaje de ICP', lead.puntaje.valor === null ? null : `${lead.puntaje.valor} (${lead.puntaje.rotulo})`);
    poner('campana', 'Campaña por la que entró', lead.recorrido.entro.campana);
    poner('creativo', 'Anuncio por el que entró', lead.recorrido.entro.creativo);
    poner('llego_por', 'Cómo llegó a agendar', lead.recorrido.llegoPor.titulo);
    poner('precall', 'Lo que vio del video previo a la llamada', lead.precall.valor);
  }

  // ── La ficha de su última llamada de venta, si alguna está vinculada a este contacto ──
  const llamada = await laLlamadaAnterior(c.contacto_id, c.email);

  // ── Las objeciones frecuentes de la empresa, 30 días ──
  const ventas = await llamadasDeVenta({ clave: '30d', dias: 30 }, { conFrases: false });
  const objecionesFrecuentes = ventas.objeciones.porCategoria.filter((x) => x.ahora > 0).map((x) => ({ categoria: x.categoria, veces: x.ahora }));

  const huella = createHash('sha256').update(JSON.stringify({ formulario, ficha, llamada })).digest('hex');
  return {
    cita: { id: c.id, inicioEl: new Date(c.inicio_el).toISOString(), contactoId: c.contacto_id },
    nombre: c.nombre,
    formulario,
    ficha,
    llamada,
    objecionesFrecuentes,
    sinFormulario: formulario.length === 0,
    huella,
  };
}

/** Lo detectado de la ficha de la última llamada de venta vinculada al contacto, con su cita. */
async function laLlamadaAnterior(contactoId: string, email: string | null): Promise<DatoDeLaEntrada[]> {
  /* Las candidatas son las HT analizadas con ficha: por correo, o con una cita de este contacto cerca. El
     vínculo decide después, con sus mismas dos vías: así una llamada «ambigua» no se le atribuye. */
  const candidatas = (
    await sql<{ id: string; ficha: unknown }>`
      select l.id, f.ficha
        from negocio.analizador_llamadas l
        join negocio.analizador_fichas f on f.org_id = l.org_id and f.llamada_id = l.id
       where l.tipo = 'HT' and l.estado = 'DONE' and f.estado = 'OK'
         and ((${email}::text is not null and lower(btrim(l.prospecto_email)) = lower(btrim(${email}::text)))
           or exists (
             select 1 from negocio.citas ci
              where ci.org_id = l.org_id and ci.contacto_id = ${contactoId}::uuid and l.fecha_de_la_reunion is not null
                and ci.inicio_el between l.fecha_de_la_reunion - make_interval(hours => ${HORAS_DEL_VINCULO_POR_CITA})
                                     and l.fecha_de_la_reunion + make_interval(hours => ${HORAS_DEL_VINCULO_POR_CITA})))
       order by coalesce(l.fecha_de_la_reunion, l.creado_el) desc, l.id`.execute(datos())
  ).rows;
  if (candidatas.length === 0) return [];
  const vinculos = await vinculosDe(candidatas.map((x) => x.id));
  const suya = candidatas.find((x) => vinculos.get(x.id)?.contactoId === contactoId);
  if (!suya) return [];
  const f = (suya.ficha ?? {}) as FichaDeLlamada;
  const salida: DatoDeLaEntrada[] = [];
  for (const [clave, campo, etiqueta] of DE_LA_LLAMADA) {
    const c = campo(f);
    if (!c || c.state !== 'DETECTADO' || !c.value) continue;
    salida.push({
      fuente: `llamada:${clave}`,
      etiqueta,
      valor: c.value,
      cita: c.quote ?? null,
      minuto: typeof c.startSec === 'number' ? Math.floor(c.startSec / 60) : null,
    });
  }
  return salida;
}
