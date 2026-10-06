// Lo que dicen las llamadas de onboarding analizadas, contado (AG11 de los agentes;
// `docs/OTROS/agentes/fichas/F15-LLAMADAS-DE-ONBOARDING.md`). Sin modelo y sólo lectura (AG-F15-1): no escribe
// al cliente ni al CRM. Corre dentro de `conOrganizacion(`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ SE CUENTA, Y QUÉ NO SE PUEDE CONTAR
//
//   · **El estado de cada cliente**, con los rótulos del Lienzo, de su última llamada en la ventana: EN RIESGO
//     si el análisis dice que el arranque está bloqueado o que el compromiso es bajo; ATENCIÓN si está a medias
//     o trae alguna señal de riesgo; AL DÍA si no. La regla es provisional y está escrita acá, no en el modelo:
//     el análisis trae `readiness`, `commitmentLevel` y `riskFlags`, y esto sólo los combina.
//   · **Los riesgos**: cuántos clientes traen señales de riesgo, cuántos están bloqueados y cuántos con
//     compromiso bajo.
//   · **Lo que esperan** no se cuenta: la meta de cada cliente es texto libre y contar texto libre no dice nada
//     —«vender más» y «facturar el doble» serían dos metas—. Se listan, por cliente, y lo dice el aviso.
//
// El cliente se nombra por su empresa, y si no la dijo, no se nombra: el nombre del titular y el correo son
// datos de una persona, y esto alimenta al cerebro (`D-17`).
// La llamada sin vínculo con un contacto se cuenta aparte, con el mismo vínculo que las de venta.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import type { Periodo } from './periodo.ts';
import { contarVinculos, vinculosDe, type CuentaDeVinculos } from './vinculoDeLlamadas.ts';

export type EstadoDelCliente = 'EN RIESGO' | 'ATENCIÓN' | 'AL DÍA';

/** Hasta cuántos clientes viajan en la lista; el total viaja siempre. */
export const CLIENTES_EN_LA_LISTA = 20;

export const AVISO_DE_LAS_METAS =
  'Lo que espera cada cliente es texto libre: se lista por cliente y no se cuenta, porque dos metas parecidas escritas distinto contarían como dos.';

export interface ClienteDeOnboarding {
  /** La empresa del cliente, si la dijo. */
  empresa: string | null;
  estado: EstadoDelCliente;
  /** `LISTO`, `PARCIAL` o `BLOQUEADO`, como lo dijo el análisis. */
  arranque: string | null;
  compromiso: string | null;
  senalesDeRiesgo: number;
  meta: string | null;
}

export interface LlamadasDeOnboarding {
  dias: number;
  llamadas: CuentaDeVinculos;
  /** Un cliente es un correo distinto; sin correo, cada llamada es uno. */
  clientes: number;
  estados: Record<EstadoDelCliente, number>;
  riesgos: { conSenales: number; bloqueados: number; compromisoBajo: number };
  lista: ClienteDeOnboarding[];
  avisoDeLasMetas: string;
}

/** El estado de un cliente a partir de su análisis. Pura. */
export function estadoDelCliente(a: { arranque: string | null; compromiso: string | null; senalesDeRiesgo: number }): EstadoDelCliente {
  if (a.arranque === 'BLOQUEADO' || a.compromiso === 'BAJO') return 'EN RIESGO';
  if (a.arranque === 'PARCIAL' || a.senalesDeRiesgo > 0) return 'ATENCIÓN';
  return 'AL DÍA';
}

export async function llamadasDeOnboarding(periodo: Pick<Periodo, 'dias'>): Promise<LlamadasDeOnboarding> {
  const filas = (
    await sql<{
      id: string;
      clave: string;
      empresa: string | null;
      arranque: string | null;
      compromiso: string | null;
      senales: number;
      meta: string | null;
    }>`
      select l.id,
             coalesce(lower(btrim(l.prospecto_email)), l.id::text) as clave,
             nullif(btrim(a.analisis->>'company'), '') as empresa,
             a.analisis->>'readiness' as arranque,
             a.analisis->>'commitmentLevel' as compromiso,
             case when jsonb_typeof(a.analisis->'riskFlags') = 'array' then jsonb_array_length(a.analisis->'riskFlags') else 0 end as senales,
             nullif(btrim(a.analisis->>'mainGoal'), '') as meta
        from negocio.analizador_llamadas l
        join negocio.analizador_analisis a on a.org_id = l.org_id and a.llamada_id = l.id
       where l.tipo = 'OB' and l.estado = 'DONE' and a.coincide
         and coalesce(l.fecha_de_la_reunion, l.creado_el) > now() - make_interval(days => ${periodo.dias})
       order by coalesce(l.fecha_de_la_reunion, l.creado_el) desc, l.id`.execute(datos())
  ).rows;

  const vinculos = await vinculosDe(filas.map((f) => f.id));
  // Cada cliente, por su última llamada de la ventana: las filas ya vienen de la más nueva a la más vieja.
  const porCliente = new Map<string, ClienteDeOnboarding>();
  for (const f of filas) {
    if (porCliente.has(f.clave)) continue;
    const base = { arranque: f.arranque, compromiso: f.compromiso, senalesDeRiesgo: Number(f.senales) };
    porCliente.set(f.clave, { empresa: f.empresa, estado: estadoDelCliente(base), ...base, meta: f.meta });
  }
  const clientes = [...porCliente.values()];
  const estados: Record<EstadoDelCliente, number> = { 'EN RIESGO': 0, ATENCIÓN: 0, 'AL DÍA': 0 };
  for (const c of clientes) estados[c.estado]++;
  const orden: Record<EstadoDelCliente, number> = { 'EN RIESGO': 0, ATENCIÓN: 1, 'AL DÍA': 2 };

  return {
    dias: periodo.dias,
    llamadas: contarVinculos(vinculos.values()),
    clientes: clientes.length,
    estados,
    riesgos: {
      conSenales: clientes.filter((c) => c.senalesDeRiesgo > 0).length,
      bloqueados: clientes.filter((c) => c.arranque === 'BLOQUEADO').length,
      compromisoBajo: clientes.filter((c) => c.compromiso === 'BAJO').length,
    },
    lista: [...clientes].sort((a, b) => orden[a.estado] - orden[b.estado]).slice(0, CLIENTES_EN_LA_LISTA),
    avisoDeLasMetas: AVISO_DE_LAS_METAS,
  };
}
