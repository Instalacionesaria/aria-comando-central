// La lectura de la foto de los negocios: la última foto que hay, entera.
//
// Corre dentro de `conOrganizacion` de la PRINCIPAL: la foto es suya (089), y ninguna empresa cliente la ve. La leen
// el tablero de Negocios y, después, el agente que saca conclusiones; los dos la misma, por esta función.

import { sql, type Selectable } from 'kysely';
import { datos } from '../datos/contexto.ts';
import type { TablaFotoDeLasCuentas, TablaFotoDeLasEmpresas } from '../datos/esquema.ts';

export type FilaDeLaFotoDeUnaEmpresa = Selectable<TablaFotoDeLasEmpresas>;
export type FilaDeLaFotoDeUnCliente = Selectable<TablaFotoDeLasCuentas>;

export interface FotoDeLosNegocios {
  /** El día de la foto (`AAAA-MM-DD`), o `null` si todavía no hay ninguna. */
  dia: string | null;
  tomadaEl: Date | null;
  contrato: number | null;
  empresas: FilaDeLaFotoDeUnaEmpresa[];
  cuentas: FilaDeLaFotoDeUnCliente[];
}

/** La última foto. **Corre dentro de `conOrganizacion` de la principal.** */
export async function leerLaFoto(): Promise<FotoDeLosNegocios> {
  const ultima = await sql<{ dia: string | null }>`
    select to_char(max(dia), 'YYYY-MM-DD') as dia from negocio.foto_de_las_empresas`.execute(datos());
  const dia = ultima.rows[0]?.dia ?? null;
  if (dia === null) return { dia: null, tomadaEl: null, contrato: null, empresas: [], cuentas: [] };
  /* `dia` vuelve como el texto que se pidió y no como lo trae el controlador: una columna `date` llega como un `Date` a
     la medianoche de la zona del servidor, y comparado con un texto no es igual a nada. */
  const empresas = (
    await datos()
      .selectFrom('foto_de_las_empresas')
      .selectAll()
      .where('dia', '=', dia)
      .orderBy('es_principal', 'desc')
      .orderBy('organizacion_ref')
      .execute()
  ).map((e) => ({ ...e, dia }));
  const cuentas = (
    await datos()
      .selectFrom('foto_de_las_cuentas')
      .selectAll()
      .where('dia', '=', dia)
      .orderBy('organizacion_ref')
      .orderBy('es_por_omision', 'desc')
      .orderBy('cuenta_ref')
      .execute()
  ).map((c) => ({ ...c, dia }));
  const tomadaEl = empresas.reduce<Date | null>((max, e) => (max === null || e.tomada_el > max ? e.tomada_el : max), null);
  return { dia, tomadaEl, contrato: empresas[0]?.contrato ?? null, empresas, cuentas };
}
