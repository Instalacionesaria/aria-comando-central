// El vínculo de cada llamada analizada con su contacto (AG11 de los agentes; `T-19`;
// `docs/OTROS/agentes/fichas/F14-LLAMADAS-DE-VENTA.md`). **Se calcula al leer**: sin tabla nueva y sin un
// segundo escritor de las tablas del analizador. Corre dentro de `conOrganizacion(`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS DOS VÍAS, EN ESTE ORDEN
//
//   1. **El correo del prospecto** contra el de un contacto del CRM, sin mayúsculas ni espacios. Si dos
//      contactos comparten el correo, el más reciente.
//   2. Si no, **una cita** que empiece a ±12 horas de la reunión. Sólo si es UNA: con dos contactos citados en
//      esas horas no hay forma de saber cuál era, y elegir uno sería inventar el vínculo. Esa llamada cuenta
//      como **ambigua**, sin vínculo.
//
// «Llamadas sin usar» quiere decir **sin vínculo** (`D-20`), y el número viaja siempre, con sus dos motivos.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';

/** Cuánto antes o después de la reunión puede empezar la cita que la vincula. */
export const HORAS_DEL_VINCULO_POR_CITA = 12;

export type ViaDelVinculo = 'correo' | 'cita';

export interface VinculoDeLlamada {
  llamadaId: string;
  contactoId: string | null;
  por: ViaDelVinculo | null;
  /** Por qué no casó: ninguna vía, o más de un contacto citado en esas horas. `null` si casó. */
  sinVinculo: 'sin_correo_ni_cita' | 'cita_ambigua' | null;
}

/** El vínculo de cada una de esas llamadas. Las que no existen no vuelven. */
export async function vinculosDe(llamadas: readonly string[]): Promise<Map<string, VinculoDeLlamada>> {
  if (llamadas.length === 0) return new Map();
  const filas = (
    await sql<{ llamada_id: string; por_correo: string | null; citados: number; por_cita: string | null }>`
      select l.id as llamada_id,
             (select c.id from negocio.contactos c
               where c.org_id = l.org_id and l.prospecto_email is not null
                 and lower(btrim(c.email)) = lower(btrim(l.prospecto_email))
               order by c.alta_en_el_crm desc nulls last, c.id limit 1) as por_correo,
             cerca.citados, cerca.por_cita
        from negocio.analizador_llamadas l
        cross join lateral (
          select count(distinct ci.contacto_id)::int as citados, min(ci.contacto_id::text) as por_cita
            from negocio.citas ci
           where ci.org_id = l.org_id and l.fecha_de_la_reunion is not null
             and ci.inicio_el between l.fecha_de_la_reunion - make_interval(hours => ${HORAS_DEL_VINCULO_POR_CITA})
                                  and l.fecha_de_la_reunion + make_interval(hours => ${HORAS_DEL_VINCULO_POR_CITA})
        ) cerca
       where l.id = any(${llamadas}::uuid[])`.execute(datos())
  ).rows;
  return new Map(
    filas.map((f): [string, VinculoDeLlamada] => {
      if (f.por_correo) return [f.llamada_id, { llamadaId: f.llamada_id, contactoId: f.por_correo, por: 'correo', sinVinculo: null }];
      if (f.citados === 1) return [f.llamada_id, { llamadaId: f.llamada_id, contactoId: f.por_cita, por: 'cita', sinVinculo: null }];
      return [f.llamada_id, { llamadaId: f.llamada_id, contactoId: null, por: null, sinVinculo: f.citados > 1 ? 'cita_ambigua' : 'sin_correo_ni_cita' }];
    }),
  );
}

/** Los conteos que viajan con todo agregado: con vínculo por cada vía, y sin él por cada motivo. */
export interface CuentaDeVinculos {
  llamadas: number;
  porCorreo: number;
  porCita: number;
  sinVinculo: number;
  ambiguas: number;
}

export function contarVinculos(vinculos: Iterable<VinculoDeLlamada>): CuentaDeVinculos {
  const c: CuentaDeVinculos = { llamadas: 0, porCorreo: 0, porCita: 0, sinVinculo: 0, ambiguas: 0 };
  for (const v of vinculos) {
    c.llamadas++;
    if (v.por === 'correo') c.porCorreo++;
    else if (v.por === 'cita') c.porCita++;
    else {
      c.sinVinculo++;
      if (v.sinVinculo === 'cita_ambigua') c.ambiguas++;
    }
  }
  return c;
}
