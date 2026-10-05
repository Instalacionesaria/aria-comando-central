// Los umbrales de las reglas: provisionales en el código, firmes cuando el Admin los firma (`D-11`;
// `docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`, AG-33). El único escritor de `negocio.umbrales`
// (migración 072). Lo que lee o escribe la base corre dentro de `conOrganizacion(`.
//
// El catálogo nace vacío en AG8: cada detector suma sus reglas en la etapa que lo construye (Acquisition en
// AG9). Una regla declara su denominador porque el piso de 10 se aplica a ESE número (AG-26), y su porqué
// porque un valor provisional sin razón escrita no se puede firmar con criterio.

import { datos } from '../../datos/contexto.ts';
import type { DepartamentoConSenales, Gravedad } from './tipos.ts';

export interface ReglaDelCatalogo {
  /** `ACQ-CPL-SOSTENIDO`: departamento y nombre, en mayúsculas. */
  codigo: string;
  departamento: DepartamentoConSenales;
  /** El valor provisional. */
  valor: number;
  /** Qué cuenta el denominador: impresiones, contactos, citas, llamadas. Nulo en una regla de ausencia. */
  denominador: string | null;
  gravedad: Gravedad;
  /** Por qué ese valor y esa gravedad. */
  porque: string;
}

/** Las reglas de todos los detectores. Ver el encabezado. */
export const CATALOGO_DE_REGLAS: readonly ReglaDelCatalogo[] = [];

/** Lo que el Admin firmó en esta empresa, por código de regla. */
export async function umbralesFirmados(): Promise<ReadonlyMap<string, number>> {
  const filas = await datos().selectFrom('umbrales').select(['regla', 'valor']).execute();
  return new Map(filas.map((f) => [f.regla, Number(f.valor)]));
}

/** El valor con que se calcula una regla hoy, y si es provisional. Va en foto en cada señal. */
export function umbralVigente(regla: ReglaDelCatalogo, firmados: ReadonlyMap<string, number>): { valor: number; provisional: boolean } {
  const firmado = firmados.get(regla.codigo);
  return firmado === undefined ? { valor: regla.valor, provisional: true } : { valor: firmado, provisional: false };
}

/**
 * Firma un umbral: el valor pasa a firme, con quién y cuándo. Quien llama comprobó `umbrales.firmar` y que no
 * se esté bajo delegación (`02`, AG-25: un autor de la principal dentro de un cliente es un `23503`).
 */
export async function firmarUmbral(codigo: string, valor: number, firmadoPor: string): Promise<void> {
  if (!CATALOGO_DE_REGLAS.some((r) => r.codigo === codigo)) throw new Error(`umbrales: «${codigo}» no es una regla del catálogo`);
  if (!Number.isFinite(valor)) throw new Error('umbrales: el valor no es un número');
  const columnas = { valor, firmado_el: new Date(), firmado_por: firmadoPor };
  await datos()
    .insertInto('umbrales')
    .values({ regla: codigo, ...columnas })
    .onConflict((oc) => oc.columns(['org_id', 'regla']).doUpdateSet(columnas))
    .execute();
}
