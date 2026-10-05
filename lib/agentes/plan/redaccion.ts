// La redacción del Plan de acción con el modelo (`docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`, AG-32;
// `docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md`, A6-18).
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL MODELO SÓLO REDACTA, Y LO QUE REDACTA SE VALIDA
//
// El plan ya está guardado con plantillas cuando esto corre: si la redacción no llega, se queda el de
// plantillas (AG-35, «primero guarda, después redacta»). Al modelo se le da cada renglón —su frase y su
// revisión— y devuelve una frase por renglón, más clara para quien decide. Cada frase se comprueba:
//
//   · ninguna cifra que no esté en el renglón original: el modelo no calcula ni redondea por su cuenta;
//   · ningún superlativo —«el más», «la mejor», «la mayor»—: la plantilla no trae el ranking que lo sostenga,
//     y un superlativo sin su ranking se quita (A6-18);
//   · una frase vacía o de un renglón que no existe, tampoco.
//
// La que no pasa se descarta y ese renglón conserva la frase de la plantilla. Se cuenta cuántas se quitaron.
// ═══════════════════════════════════════════════════════════════════════════════

import { llamarAlModelo } from '../llamada.ts';
import { MODELO_DEL_PLAN } from '../modelos.ts';
import { numerosDelTexto } from '../executive/respuesta.ts';
import type { PlanDeAcquisition } from './acquisition.ts';

export interface RedaccionDelPlan {
  modelo: string;
  /** La frase redactada de cada renglón que pasó la validación, por su clave (`grupo:índice`). */
  renglones: Record<string, string>;
  /** Cuántas frases se descartaron, y por qué, en cuentas. */
  quitadas: { cifra: number; superlativo: number; otras: number };
}

/** El techo de la respuesta: una frase por renglón, y un plan rara vez pasa de veinte. */
const TECHO_DE_LA_REDACCION = 4000;

/** «el más», «la mejor», «los mayores», «máximo»: comparaciones que piden un ranking que el renglón no trae. */
const SUPERLATIVO = /(?<![a-záéíóúñ])(?:(?:el|la|los|las|lo)\s+(?:m[aá]s|menos|mejor(?:es)?|peor(?:es)?|mayor(?:es)?|menor(?:es)?)|m[aá]xim[oa]s?|m[ií]nim[oa]s?|r[eé]cord)(?![a-záéíóúñ])/i;

export const INSTRUCCIONES_DE_LA_REDACCION = `Redactas el Plan de acción de un departamento de pauta publicitaria. Hablas en español neutro, tuteando, con frases cortas. Nunca uses voseo.

Recibes renglones ya calculados. Para cada uno, escribe UNA frase más clara para quien decide la pauta, que diga qué se midió y qué revisar.

Reglas:
- Usa sólo las cifras del renglón, tal como están. No calcules, no redondees y no agregues ninguna cifra.
- No uses superlativos («el más», «la mejor», «la mayor», «el peor», «máximo»): el renglón no trae el ranking que los sostenga.
- Las causas son hipótesis: «puede deberse a…».
- No recomiendes escalar por costo por contacto: la escala se decide por costo por calificado.
- Si el renglón es del grupo de validación ejecutiva, dilo: lo decide la dirección.
- Devuelve todos los renglones, con su misma clave.`;

/** El formato de la respuesta (`output_config.format`). Estricto: sin restricciones de largo. */
const FORMATO = {
  type: 'object',
  additionalProperties: false,
  required: ['renglones'],
  properties: {
    renglones: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['clave', 'frase'],
        properties: { clave: { type: 'string' }, frase: { type: 'string' } },
      },
    },
  },
} as const;

/** Los renglones del plan con su clave estable: `grupo:índice`. */
export function renglonesParaRedactar(plan: Pick<PlanDeAcquisition, 'grupos'>) {
  return plan.grupos.flatMap((g) =>
    g.renglones.map((r, i) => ({ clave: `${g.clave}:${i}`, grupo: g.titulo, texto: r.texto, revision: r.revision })),
  );
}

/**
 * Valida lo que devolvió el modelo contra los renglones. Puro.
 */
export function validarRedaccion(
  originales: ReturnType<typeof renglonesParaRedactar>,
  devueltos: unknown,
): Pick<RedaccionDelPlan, 'renglones' | 'quitadas'> {
  const salida: Pick<RedaccionDelPlan, 'renglones' | 'quitadas'> = { renglones: {}, quitadas: { cifra: 0, superlativo: 0, otras: 0 } };
  const lista = (devueltos as { renglones?: unknown })?.renglones;
  if (!Array.isArray(lista)) return salida;
  const porClave = new Map(originales.map((o) => [o.clave, o]));
  for (const d of lista) {
    const clave = (d as { clave?: unknown })?.clave;
    const frase = (d as { frase?: unknown })?.frase;
    const original = typeof clave === 'string' ? porClave.get(clave) : undefined;
    if (!original || typeof frase !== 'string' || frase.trim() === '' || original.clave in salida.renglones) {
      salida.quitadas.otras += 1;
      continue;
    }
    const permitidas = numerosDelTexto(`${original.texto} ${original.revision}`);
    if (numerosDelTexto(frase).some((n) => !permitidas.some((p) => Math.abs(p - n) < 1e-9))) {
      salida.quitadas.cifra += 1;
      continue;
    }
    if (SUPERLATIVO.test(frase)) {
      salida.quitadas.superlativo += 1;
      continue;
    }
    salida.renglones[original.clave] = frase.trim();
  }
  return salida;
}

/**
 * Pide la redacción. Devuelve `null` si no hay nada que redactar o si el modelo no contestó: entonces se queda
 * el plan de plantillas. El fallo deja su uso y su incidente por el transporte.
 */
export async function redactarPlan(p: {
  plan: Pick<PlanDeAcquisition, 'grupos' | 'departamento' | 'ventana'>;
  llave: string;
  orgId: string;
  espera: number;
}): Promise<RedaccionDelPlan | null> {
  const originales = renglonesParaRedactar(p.plan);
  if (originales.length === 0) return null;
  const r = await llamarAlModelo({
    agente: 'plan',
    modelo: MODELO_DEL_PLAN,
    llave: p.llave,
    orgId: p.orgId,
    usuarioId: null,
    ref: `${p.plan.departamento}:${p.plan.ventana}`,
    donde: `la redacción del plan de ${p.plan.departamento} (${p.plan.ventana})`,
    techo: TECHO_DE_LA_REDACCION,
    instrucciones: INSTRUCCIONES_DE_LA_REDACCION,
    mensajes: [{ role: 'user', content: JSON.stringify({ renglones: originales }) }],
    formato: FORMATO,
    esfuerzo: 'low',
    espera: p.espera,
    leer: (m) => {
      const texto = m.contenido.find((b) => b.type === 'text')?.text;
      if (typeof texto !== 'string') return { tipo: 'sin_texto' };
      try {
        return { tipo: 'datos', datos: JSON.parse(texto) as unknown };
      } catch {
        return { tipo: 'sin_estructura' };
      }
    },
  });
  if (r.tipo === 'fallo') return null;
  return { modelo: r.modelo, ...validarRedaccion(originales, r.datos) };
}
