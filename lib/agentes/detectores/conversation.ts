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
// ═══════════════════════════════════════════════════════════════════════════════

import { laPantallaDelTecnico, type CasoDelPatron } from '../../auditor/pantalla.ts';
import { AGENTES, CATEGORIAS } from '../../auditor/veredicto.ts';
import type { Deteccion, IssueSource, VentanaDeSenal } from '../senales/tipos.ts';
import type { ReglaDelCatalogo } from '../senales/umbrales.ts';

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
  /** Los casos abiertos de la pantalla. */
  casos: readonly Pick<CasoDelPatron, 'hallazgoId' | 'patron' | 'agente' | 'contactoId' | 'titulo' | 'severidad' | 'categoria' | 'detectadoEl' | 'fragmentoPrompt' | 'promptSeccion'>[];
  /** Si la tarea del auditor está al día. */
  auditorAlDia: boolean;
  /** El instante de la medición: la ventana se cuenta desde acá. */
  ahora: Date;
}

const DIA = (d: Date) => d.toISOString().slice(0, 10);

/** Corre dentro de `conOrganizacion`. */
export async function medirConversation(ventana: VentanaDeSenal, ahora: Date): Promise<MedidaDeConversation> {
  // `noAudita` no cambia los casos, sólo el encabezado de la pantalla: acá no hace falta.
  const pantalla = await laPantallaDelTecnico(null);
  /* La frescura se carga al medir, por el mismo ciclo que en Creative: `frescura.ts` lee los horarios de
     `barrido.ts`, que importa la pasada, que importa este detector. */
  const { frescuraDe } = await import('../../negocio/frescura.ts');
  const auditoria = await frescuraDe('auditoria');
  const dias = ventana === '7d' ? 7 : 30;
  return {
    ventana,
    periodo: { desde: DIA(new Date(ahora.getTime() - (dias - 1) * 86_400_000)), hasta: DIA(ahora) },
    casos: pantalla.casos,
    auditorAlDia: auditoria.estado === 'al_dia',
    ahora,
  };
}

type Umbral = (codigo: string) => { valor: number; provisional: boolean };

/** Una señal por agente y patrón, con los casos de la ventana. Pura. */
export function detectarEnConversation(m: MedidaDeConversation, umbral: Umbral): { detecciones: Deteccion[]; debajoDelPiso: []; sinMedicion: string[] } {
  if (!m.auditorAlDia) return { detecciones: [], debajoDelPiso: [], sinMedicion: [CONV.patronAbierto] };
  const u = umbral(CONV.patronAbierto);
  const desde = m.ahora.getTime() - (m.ventana === '7d' ? 7 : 30) * 86_400_000;
  const porPatron = new Map<string, MedidaDeConversation['casos'][number][]>();
  for (const c of m.casos) {
    if (c.detectadoEl.getTime() <= desde || !(AGENTES as readonly string[]).includes(c.agente)) continue;
    const clave = `${c.agente}:${c.patron}`;
    porPatron.set(clave, [...(porPatron.get(clave) ?? []), c]);
  }
  const detecciones: Deteccion[] = [];
  for (const [clave, casos] of porPatron) {
    if (casos.length < u.valor) continue;
    // El más reciente manda, como en la pantalla: su título, su categoría y su fragmento son los del patrón.
    const ultimo = [...casos].sort((a, b) => b.detectadoEl.getTime() - a.detectadoEl.getTime())[0]!;
    const fuente = issueSourceDe(ultimo.categoria, ultimo.fragmentoPrompt);
    const rojos = casos.filter((c) => c.severidad === 'rojo').length;
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
          ? `Revisa el prompt del agente${ultimo.promptSeccion ? ` en «${ultimo.promptSeccion}»` : ''}: el auditor propone una corrección, y la publica una persona.`
          : fuente === 'missing_data'
            ? 'Revisa la base de conocimiento del agente: le falta un dato que la conversación pedía.'
            : 'Revisa las conversaciones del patrón en la pestaña Auditoría.',
      perdidaContactos: null,
      destino: null,
      requiereValidacionEjecutiva: false,
      umbral: u,
      evidencia: {
        ventana: m.ventana,
        agente: ultimo.agente,
        patron: ultimo.patron,
        titulo: ultimo.titulo,
        rojos,
        amarillos: casos.length - rojos,
        hallazgos: casos.map((c) => c.hallazgoId),
        contactos: [...new Set(casos.map((c) => c.contactoId))],
      },
      issueSource: fuente,
    });
  }
  return { detecciones, debajoDelPiso: [], sinMedicion: [] };
}
