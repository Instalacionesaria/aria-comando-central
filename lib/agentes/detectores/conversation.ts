// Conversation en la tabla común de señales (AG13 de los agentes; `docs/OTROS/agentes/fichas/F05-CONVERSATION.md`;
// `02`, AG-37). No es un detector que mida: **traduce**. El auditor de los agentes del CRM sigue siendo el que
// juzga cada conversación y el único escritor de `negocio.hallazgos`; esto lee sus hallazgos abiertos y publica
// una señal por agente y patrón, con su `issue_source`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LEE LO QUE LEE LA PANTALLA
//
// Los casos abiertos de `laPantallaDelTecnico` (`lib/auditor/pantalla.ts`), con el texto de su patrón ya elegido
// por el servidor (el del hallazgo más reciente), y los que se detectaron dentro de la ventana de la señal: 7 o
// 30 días, como los demás detectores (AG-28). La ficha decía 14 días; la ventana de la señal manda, y un
// patrón que se repite en la semana es una señal de 7 días y de 30.
//
// ── LA TRADUCCIÓN (AG-37) ──────────────────────────────────────────────────
//
//   · `comportamiento` con un fragmento del prompt señalado → `prompt_design`;
//   · `comportamiento` sin fragmento → `agent_execution`;
//   · `base_conocimiento` o `informacion_adicional` → `missing_data`;
//   · sin categoría, ninguna: no se inventa una fuente.
//
// La gravedad: con algún caso rojo, `alta`; si no, `media`. La entidad es el patrón del agente
// (`agente:patron`), y la evidencia lleva ids de hallazgos y de contactos, **nunca citas**: las conversaciones
// son de los leads del cliente (AG-38).
//
// ── LO QUE NO SE PUEDE MEDIR ────────────────────────────────────────────────
//
// Sin la tarea del auditor al día (`frescuraDe('auditoria')`), no publicar nada sería decir «no hay patrones»
// cuando lo cierto es que nadie auditó: la regla va a «sin medición».
//
// ── CON VARIOS CLIENTES (el nivel 3, C6 · D3) ────────────────────────────────
//
// El agente del CRM es de cada subcuenta, y un mismo código de patrón en dos clientes son dos patrones: se agrupa por
// (cliente, agente, patrón), con el identificador de `idConCliente` —el de siempre para el principal, con el cliente
// adelante para otro—. Con hallazgos de más de un cliente, los casos se leen cliente por cliente (`casosDeUnCliente`):
// el tope de la pantalla es el de cada uno y el texto ganador —el fragmento y su `issue_source`— es el de su cliente.
// Y el freno es por cliente (`frenoDeLaTarea`): un cliente activo con la auditoría atrasada no publica lo suyo y sólo
// sus señales quedan «sin medición»; lo de los demás se publica. Con un cliente, todo es como siempre, letra por letra.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../../datos/contexto.ts';
import { casosDeUnCliente, laPantallaDelTecnico, type CasoDelPatron } from '../../auditor/pantalla.ts';
import { AGENTES, CATEGORIAS } from '../../auditor/veredicto.ts';
import { idConCliente } from '../../negocio/idDeLaPieza.ts';
import type { Deteccion, IssueSource, SinMedicionDeUnCliente, VentanaDeSenal } from '../senales/tipos.ts';
import type { ReglaDelCatalogo } from '../senales/umbrales.ts';
import { clientesDeLaEmpresa, frenoDeLaTarea } from './clientes.ts';

export const CONV = { patronAbierto: 'CONV-PATRON-ABIERTO' } as const;

export const REGLAS_DE_CONVERSATION: readonly ReglaDelCatalogo[] = [
  {
    codigo: CONV.patronAbierto,
    departamento: 'conversation',
    valor: 1,
    unidad: 'veces',
    denominador: null,
    gravedad: 'media',
    porque:
      'Un patrón que el auditor encontró y nadie resolvió, desde la primera conversación: el auditor ya filtra lo que no es un error del agente, y un rojo pausó al agente. Con más casos firmados, sólo los patrones que se repiten.',
  },
];

/** La traducción de AG-37. Pura. `null` sin categoría: no se inventa una fuente. */
export function issueSourceDe(categoria: string | null, fragmentoPrompt: string | null): IssueSource | null {
  if (categoria === 'comportamiento') return fragmentoPrompt && fragmentoPrompt.trim() !== '' ? 'prompt_design' : 'agent_execution';
  if (categoria === 'base_conocimiento' || categoria === 'informacion_adicional') return 'missing_data';
  return null;
}

/** Las categorías que el auditor escribe (`CATEGORIAS`): la traducción tiene que cubrirlas todas. */
export const CATEGORIAS_DEL_AUDITOR = CATEGORIAS;

const CAUSAS: Record<IssueSource, string[]> = {
  prompt_design: ['puede deberse a cómo está escrita esa parte del prompt'],
  agent_execution: ['puede deberse a que el agente no sigue una instrucción que el prompt sí tiene'],
  missing_data: ['puede deberse a un dato que el agente no tiene en su base de conocimiento'],
  missing_tool: [],
  workflow_configuration: [],
  external_failure: [],
};

export interface MedidaDeConversation {
  ventana: VentanaDeSenal;
  periodo: { desde: string; hasta: string };
  /** Los casos abiertos de la pantalla; con varios clientes, los de cada cliente activo. */
  casos: readonly (Pick<CasoDelPatron, 'hallazgoId' | 'patron' | 'agente' | 'contactoId' | 'titulo' | 'severidad' | 'categoria' | 'detectadoEl' | 'fragmentoPrompt' | 'promptSeccion'> &
    Partial<Pick<CasoDelPatron, 'cuentaId'>>)[];
  /** Si la regla entera se puede medir: la tarea del auditor al día (con varios clientes activos, la de alguno). */
  auditorAlDia: boolean;
  /** El instante de la medición: la ventana se cuenta desde acá. */
  ahora: Date;
  /** (C6 · D3) Hallazgos de más de un cliente, alguna vez: la evidencia nombra al cliente y la revisión lo dice. */
  variosClientes?: boolean;
  /** (C6 · D3) El cliente por omisión: sus patrones llevan el identificador de siempre (`idConCliente`). */
  principal?: string | null;
  /** (C6 · D3) Los clientes activos con la auditoría atrasada o fallando: lo suyo no se publica. */
  atrasados?: readonly { id: string; nombre: string }[];
}

const DIA = (d: Date) => d.toISOString().slice(0, 10);

/** Corre dentro de `conOrganizacion`. */
export async function medirConversation(ventana: VentanaDeSenal, ahora: Date): Promise<MedidaDeConversation> {
  const clientes = await clientesDeLaEmpresa();
  // De qué clientes hay hallazgos, alguna vez (C6 · D3): decide la letra, no el identificador ni el freno.
  const conHallazgos = (await sql<{ cuenta_id: string }>`select distinct cuenta_id from negocio.hallazgos order by 1`.execute(datos())).rows.map(
    (f) => f.cuenta_id,
  );
  const variosClientes = conHallazgos.length > 1;
  /* Con varios, los casos de cada cliente activo, con su tope y su texto ganador. Con uno, los de la pantalla: `noAudita`
     no cambia los casos, sólo el encabezado, y acá no hace falta. */
  const casos: CasoDelPatron[] = [];
  if (variosClientes) {
    const abiertos = new Set(
      (await sql<{ cuenta_id: string }>`select distinct cuenta_id from negocio.hallazgos where resuelto_el is null`.execute(datos())).rows.map((f) => f.cuenta_id),
    );
    for (const id of clientes.activos) if (abiertos.has(id)) casos.push(...(await casosDeUnCliente(id)));
  } else {
    casos.push(...(await laPantallaDelTecnico(null)).casos);
  }
  /* El freno, por cliente activo (`frenoDeLaTarea`). Con los hallazgos de un solo cliente y ése atrasado, toda la regla,
     como siempre: sus señales no nombran a ningún cliente. */
  const freno = await frenoDeLaTarea('auditoria', clientes);
  const unico = conHallazgos.length === 1 ? conHallazgos[0]! : null;
  const dias = ventana === '7d' ? 7 : 30;
  return {
    ventana,
    periodo: { desde: DIA(new Date(ahora.getTime() - (dias - 1) * 86_400_000)), hasta: DIA(ahora) },
    casos,
    auditorAlDia: freno.alDia && !freno.atrasados.some((a) => a.id === unico),
    ahora,
    ...(variosClientes ? { variosClientes } : {}),
    principal: clientes.principal,
    atrasados: freno.atrasados,
  };
}

type Umbral = (codigo: string) => { valor: number; provisional: boolean };

/** Una señal por agente y patrón —con varios clientes, en cada cliente—, con los casos de la ventana. Pura. */
export function detectarEnConversation(
  m: MedidaDeConversation,
  umbral: Umbral,
): { detecciones: Deteccion[]; debajoDelPiso: []; sinMedicion: string[]; sinMedicionDeClientes?: SinMedicionDeUnCliente[] } {
  if (!m.auditorAlDia) return { detecciones: [], debajoDelPiso: [], sinMedicion: [CONV.patronAbierto] };
  const u = umbral(CONV.patronAbierto);
  const desde = m.ahora.getTime() - (m.ventana === '7d' ? 7 : 30) * 86_400_000;
  /* Lo de un cliente atrasado no se publica (C6 · D3): sus casos pueden no estar todos, y sus señales quedan «sin
     medición» en el escritor. Lo de los demás, sí. */
  const atrasados = new Set((m.atrasados ?? []).map((a) => a.id));
  const porPatron = new Map<string, MedidaDeConversation['casos'][number][]>();
  for (const c of m.casos) {
    if (c.detectadoEl.getTime() <= desde || !(AGENTES as readonly string[]).includes(c.agente)) continue;
    if (c.cuentaId !== undefined && atrasados.has(c.cuentaId)) continue;
    // El patrón del agente EN SU CLIENTE: el de siempre para el principal, con el cliente adelante para otro.
    const clave = idConCliente(c.cuentaId ?? null, `${c.agente}:${c.patron}`, m.principal ?? null);
    porPatron.set(clave, [...(porPatron.get(clave) ?? []), c]);
  }
  const detecciones: Deteccion[] = [];
  for (const [clave, casos] of porPatron) {
    if (casos.length < u.valor) continue;
    // El más reciente manda, como en la pantalla: su título, su categoría y su fragmento son los del patrón.
    const ultimo = [...casos].sort((a, b) => b.detectadoEl.getTime() - a.detectadoEl.getTime())[0]!;
    const fuente = issueSourceDe(ultimo.categoria, ultimo.fragmentoPrompt);
    const rojos = casos.filter((c) => c.severidad === 'rojo').length;
    // Con hallazgos de varios clientes, la evidencia nombra al cliente y la revisión dice de qué agente es.
    const cliente = m.variosClientes && ultimo.cuentaId !== undefined ? ultimo.cuentaId : null;
    const delAgente = cliente === null ? 'del agente' : 'del agente de este cliente';
    detecciones.push({
      regla: CONV.patronAbierto,
      entidad: { tipo: 'patron', id: clave },
      metrica: 'conversaciones',
      lineaBase: null,
      valorActual: casos.length,
      cambioPct: null,
      // No es una tasa: son casos, y el auditor ya juzgó cada uno. El piso de 10 es de un denominador.
      muestra: null,
      periodo: m.periodo,
      datosDesde: null,
      gravedad: rojos > 0 ? 'alta' : 'media',
      causasPosibles: fuente ? CAUSAS[fuente] : [],
      revisionRecomendada:
        fuente === 'prompt_design'
          ? `Revisa el prompt ${delAgente}${ultimo.promptSeccion ? ` en «${ultimo.promptSeccion}»` : ''}: el auditor propone una corrección, y la publica una persona.`
          : fuente === 'missing_data'
            ? `Revisa la base de conocimiento ${delAgente}: le falta un dato que la conversación pedía.`
            : 'Revisa las conversaciones del patrón en la pestaña Auditoría.',
      perdidaContactos: null,
      destino: null,
      requiereValidacionEjecutiva: false,
      umbral: u,
      evidencia: {
        ventana: m.ventana,
        agente: ultimo.agente,
        patron: ultimo.patron,
        ...(cliente === null ? {} : { cliente }),
        titulo: ultimo.titulo,
        rojos,
        amarillos: casos.length - rojos,
        hallazgos: casos.map((c) => c.hallazgoId),
        contactos: [...new Set(casos.map((c) => c.contactoId))],
      },
      issueSource: fuente,
    });
  }
  const sinMedicionDeClientes = (m.atrasados ?? []).map((a) => ({ regla: CONV.patronAbierto, cuentaId: a.id, cliente: a.nombre }));
  return { detecciones, debajoDelPiso: [], sinMedicion: [], ...(sinMedicionDeClientes.length > 0 ? { sinMedicionDeClientes } : {}) };
}
