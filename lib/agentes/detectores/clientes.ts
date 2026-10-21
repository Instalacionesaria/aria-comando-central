// Los clientes de la empresa para los detectores, y el freno de una tarea por cliente (el nivel 3, C6 · D3).
//
// ═══════════════════════════════════════════════════════════════════════════════
// UN CLIENTE ATRASADO NO CALLA A LOS DEMÁS
//
// La frescura de la empresa entera es la del PEOR cliente activo (`frescuraDe`, `lib/negocio/frescura.ts`): para una
// pantalla es lo cierto —puede haber cosas sin traer—, pero como freno de una regla dejaba a todos sin publicar por uno.
// Un cliente activo con el token revocado, que nunca va a tener hallazgos ni contactos, callaba para siempre a
// Conversation y a Conversion del principal. Acá el freno es por cliente:
//
//   · con un cliente activo o ninguno, es el de siempre: la frescura de la empresa, y toda la regla;
//   · con varios, la regla entera se frena sólo si ningún activo está al día. Si alguno lo está, los activos atrasados
//     o fallando van a `atrasados`: lo suyo no se publica y sus señales quedan «sin medición» en el escritor
//     (`sinMedicionDeClientes`), y lo de los demás se publica;
//   · un cliente sin ningún sello no cuenta, como en la frescura de la empresa: el cron todavía no lo barrió;
//   · un cliente en pausa o de baja no frena: sus datos están congelados, no atrasados. Y no se mide por cliente: los
//     detectores miden por cliente sólo a los activos, así que sus señales se cierran solas. Es el criterio de los tres
//     detectores que miden por cliente (el monitor de Acquisition, Conversation y Conversion), también cuando los datos
//     son de un solo cliente y otro activo no tiene nada: el freno es el del que tiene datos (y en Conversion, la
//     anterior del cambio de ruta, la de SU lectura). Creative todavía no: frena todas sus reglas con la frescura de
//     `anuncios` de la empresa, el peor de los activos (un residuo, en el 07).
//
// La frescura se importa al usarla: `frescura.ts` lee los horarios de `barrido.ts`, que importa la pasada, que importa
// los detectores (el ciclo que explica `./creative.ts`).
// ═══════════════════════════════════════════════════════════════════════════════

import { datos } from '../../datos/contexto.ts';
import type { Tarea } from '../../negocio/barrido.ts';

/** Los clientes que ve la pasada: toda la empresa. */
export interface ClientesDeLaEmpresa {
  /** El cliente por omisión: lo suyo no lleva prefijo en el identificador de una señal (`idConCliente`). */
  principal: string | null;
  /** Los activos, el principal primero y después por nombre: el orden en que se dicen. */
  activos: readonly string[];
  nombres: ReadonlyMap<string, string>;
}

/** Corre dentro de `conOrganizacion`. */
export async function clientesDeLaEmpresa(): Promise<ClientesDeLaEmpresa> {
  const filas = await datos()
    .selectFrom('cuentas')
    .select(['id', 'nombre', 'es_por_omision', 'estado'])
    .orderBy('es_por_omision', 'desc')
    .orderBy('nombre', 'asc')
    .orderBy('id', 'asc')
    .execute();
  return {
    principal: filas.find((f) => f.es_por_omision)?.id ?? null,
    activos: filas.filter((f) => f.estado === 'activa').map((f) => f.id),
    nombres: new Map(filas.map((f) => [f.id, f.nombre])),
  };
}

/** El freno de una regla que necesita una tarea al día. */
export interface FrenoDeUnaTarea {
  /** Si la regla se puede medir: con un cliente activo, la frescura de la empresa; con varios, alguno al día. */
  alDia: boolean;
  /** Con varios activos y la regla medible, los activos atrasados o fallando, con su nombre. */
  atrasados: readonly { id: string; nombre: string }[];
}

/** Corre dentro de `conOrganizacion`. */
export async function frenoDeLaTarea(tarea: Tarea, clientes: ClientesDeLaEmpresa): Promise<FrenoDeUnaTarea> {
  const { frescuraDe } = await import('../../negocio/frescura.ts');
  if (clientes.activos.length <= 1) return { alDia: (await frescuraDe(tarea)).estado === 'al_dia', atrasados: [] };
  const estados: { id: string; estado: string }[] = [];
  for (const id of clientes.activos) estados.push({ id, estado: (await frescuraDe(tarea, id)).estado });
  const alDia = estados.some((e) => e.estado === 'al_dia');
  return {
    alDia,
    atrasados: alDia
      ? estados
          .filter((e) => e.estado !== 'al_dia' && e.estado !== 'nunca')
          .map((e) => ({ id: e.id, nombre: clientes.nombres.get(e.id) ?? 'Cliente sin nombre' }))
      : [],
  };
}
