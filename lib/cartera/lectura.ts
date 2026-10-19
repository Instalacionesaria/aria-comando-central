// La lectura de la foto de los negocios: la última foto que hay, entera.
//
// Corre dentro de `conOrganizacion` de la PRINCIPAL: la foto es suya (089), y ninguna empresa cliente la ve. La leen
// el tablero de Negocios y, después, el agente que saca conclusiones; los dos la misma, por esta función.

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';

export interface FotoDeLosNegocios {
  /** El día de la foto (`AAAA-MM-DD`), o `null` si todavía no hay ninguna. */
  dia: string | null;
  tomadaEl: Date | null;
  contrato: number | null;
  empresas: Record<string, unknown>[];
  cuentas: Record<string, unknown>[];
}

/** La última foto. **Corre dentro de `conOrganizacion` de la principal.** */
export async function leerLaFoto(): Promise<FotoDeLosNegocios> {
  const ultima = await sql<{ dia: string | null }>`
    select to_char(max(dia), 'YYYY-MM-DD') as dia from negocio.foto_de_las_empresas`.execute(datos());
  const dia = ultima.rows[0]?.dia ?? null;
  if (dia === null) return { dia: null, tomadaEl: null, contrato: null, empresas: [], cuentas: [] };
  const empresas = await datos()
    .selectFrom('foto_de_las_empresas')
    .selectAll()
    .where('dia', '=', dia)
    .orderBy('es_principal', 'desc')
    .orderBy('organizacion_ref')
    .execute();
  const cuentas = await datos()
    .selectFrom('foto_de_las_cuentas')
    .selectAll()
    .where('dia', '=', dia)
    .orderBy('organizacion_ref')
    .orderBy('es_por_omision', 'desc')
    .orderBy('cuenta_ref')
    .execute();
  const tomadaEl = empresas.reduce<Date | null>((max, e) => (max === null || e.tomada_el > max ? e.tomada_el : max), null);
  return {
    dia,
    tomadaEl,
    contrato: empresas[0]?.contrato ?? null,
    empresas: empresas as unknown as Record<string, unknown>[],
    cuentas: cuentas as unknown as Record<string, unknown>[],
  };
}
