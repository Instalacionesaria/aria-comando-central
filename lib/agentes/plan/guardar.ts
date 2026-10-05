// El único escritor de `negocio.planes_de_accion` (migración 072). **Corre dentro de `conOrganizacion(`.**
//
// Una fila por departamento, ventana y día local, también vacía: el plan vacío dice que se miró y no hubo
// nada (`docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`, AG-32). Y es la marca de que ese departamento ya
// corrió ese día (AG-35), así que se guarda en la misma transacción que sus señales: un departamento que
// falla a mitad no deja plan, y la hora siguiente lo vuelve a intentar.
//
// Volver a guardar el mismo día reemplaza el plan y borra la redacción: lo que redactó el modelo se escribió
// sobre el plan anterior, y sus cifras pueden no ser las de ahora.

import { sql } from 'kysely';
import { datos } from '../../datos/contexto.ts';
import type { DebajoDelPiso, DepartamentoConSenales, VentanaDeSenal } from '../senales/tipos.ts';

export interface PlanParaGuardar {
  departamento: DepartamentoConSenales;
  ventana: VentanaDeSenal;
  /** El día local de la empresa, `AAAA-MM-DD`. */
  dia: string;
  /** El plan armado con plantillas, con el formato de su departamento. */
  plan: unknown;
  debajoDelPiso: readonly DebajoDelPiso[];
}

export async function guardarPlan(p: PlanParaGuardar): Promise<void> {
  const columnas = {
    plan: JSON.stringify(p.plan),
    redaccion: null,
    bajo_el_piso: p.debajoDelPiso.length,
    bajo_el_piso_detalle: JSON.stringify(p.debajoDelPiso),
    actualizado_el: new Date(),
  };
  await datos()
    .insertInto('planes_de_accion')
    .values({ departamento: p.departamento, ventana: p.ventana, dia: p.dia, ...columnas })
    .onConflict((oc) => oc.columns(['org_id', 'departamento', 'ventana', 'dia']).doUpdateSet(columnas))
    .execute();
}

/**
 * La redacción del modelo, sobre el plan de ese día (AG-32). Va aparte y después: el plan de plantillas ya
 * está guardado, y si esto falla queda ése.
 */
export async function guardarRedaccion(p: { departamento: DepartamentoConSenales; ventana: VentanaDeSenal; dia: string; redaccion: unknown }): Promise<void> {
  await datos()
    .updateTable('planes_de_accion')
    .set({ redaccion: JSON.stringify(p.redaccion), actualizado_el: new Date() })
    .where('departamento', '=', p.departamento)
    .where('ventana', '=', p.ventana)
    .where(sql<boolean>`dia = ${p.dia}::date`)
    .execute();
}
