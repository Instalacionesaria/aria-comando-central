// La redacción de la Reunión de hoy con el modelo (`docs/OTROS/agentes/04-LA-REUNION-Y-LA-CABECERA.md`,
// AG-72; `fichas/F17-LA-REUNION-DE-HOY.md`, AG-F17-1 y AG-F17-4).
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL MODELO ORDENA Y REDACTA; LAS REGLAS YA DETECTARON
//
// Los temas ya están guardados con el orden de las reglas y sus plantillas cuando esto corre: si la redacción
// no llega, se quedan así (`AG-35`, «primero guarda, después redacta»). Al modelo se le dan los candidatos —su
// clave, su origen, su gravedad y su texto— y devuelve un orden y una frase por tema. La etiqueta del Lienzo (SIN
// DATOS NUEVOS, CADENA…) no viaja: es un rótulo de la tarjeta, y la primera evaluación real mostró que el modelo la
// leía como el problema («revisa por qué no hay datos nuevos» para campañas que no gastan). Se comprueba:
//
//   · el orden: sólo claves que existen, sin repetir. Lo que no nombró va al final en el orden de las reglas
//     (`temasEnSuOrden`): un tema no se pierde porque el modelo lo olvidó;
//   · cada frase, contra SU tema y sólo contra el suyo: ninguna cifra que no esté en su texto, ningún
//     superlativo, ningún término entre comillas angulares que su texto no traiga, y ningún nombre de otra
//     área. Esto último es la regla de AG-F17-1, «sin referencias cruzadas»: los temas se filtran por persona
//     DESPUÉS, y una frase que nombre otro tema le contaría a un closer lo que pasa en Acquisition.
//
// La frase que no pasa se descarta y ese tema conserva su plantilla. Se cuenta cuántas se quitaron.
// ═══════════════════════════════════════════════════════════════════════════════

import { llamarAlModelo } from '../llamada.ts';
import { MODELO_DE_LA_REUNION } from '../modelos.ts';
import { numerosDelTexto } from '../executive/respuesta.ts';
import { SUPERLATIVO } from '../plan/redaccion.ts';
import type { RedaccionDeLaReunion } from './guardar.ts';
import type { TemaDeLaReunion } from './temas.ts';

/** El techo de la respuesta: un orden y una frase por tema, y una Reunión rara vez pasa de diez temas. */
const TECHO_DE_LA_REDACCION = 3000;

/** Las áreas que una frase no puede nombrar si no son la suya: lo que va antes y después del «·» del origen. */
function areasDe(origen: string): string[] {
  return origen.split('·').map((p) => p.trim().toLowerCase()).filter((p) => p.length > 0);
}

/** Los términos «entre comillas angulares» de un texto. */
const citados = (texto: string) => [...texto.matchAll(/«([^»]+)»/g)].map((m) => m[1]!.trim().toLowerCase());

export const INSTRUCCIONES_DE_LA_REUNION = `Preparas la reunión del día de una empresa de marketing y ventas: los temas que su dirección tendría que mirar hoy. Hablas en español neutro, tuteando, con frases cortas. Nunca uses voseo.

Recibes temas ya detectados por reglas. Haz dos cosas:
1. Ordénalos: primero lo que más arriesga contactos o ventas hoy. La gravedad que trae cada tema es una guía, no una orden.
2. Para cada tema, escribe UNA o dos frases más claras para quien decide: qué pasa y qué conviene mirar.

Reglas:
- Cada frase habla SÓLO de su tema. No menciones otros temas ni otras áreas: cada persona ve sólo los temas de las áreas que tiene, y una frase que nombre otro tema le contaría algo que no ve.
- Usa sólo las cifras del texto de ese tema, tal como están. No calcules, no redondees y no agregues ninguna cifra.
- No uses superlativos («el más», «la mejor», «la mayor», «el peor», «máximo»).
- No inventes causas. Si el texto no trae una causa, no la nombres.
- Si el texto dice que requiere validación ejecutiva, mantenlo: lo decide la dirección.
- Devuelve todos los temas, con su misma clave.`;

/** El formato de la respuesta (`output_config.format`). Estricto: sin restricciones de largo. */
const FORMATO = {
  type: 'object',
  additionalProperties: false,
  required: ['orden', 'temas'],
  properties: {
    orden: { type: 'array', items: { type: 'string' } },
    temas: {
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

export interface ValidacionDeLaReunion {
  orden: string[];
  textos: Record<string, string>;
  quitadas: { cifra: number; superlativo: number; cruzada: number; otras: number };
}

/** Valida lo que devolvió el modelo contra los temas. Pura. */
export function validarRedaccionDeLaReunion(temas: readonly TemaDeLaReunion[], devuelto: unknown): ValidacionDeLaReunion {
  const salida: ValidacionDeLaReunion = { orden: [], textos: {}, quitadas: { cifra: 0, superlativo: 0, cruzada: 0, otras: 0 } };
  const porClave = new Map(temas.map((t) => [t.clave, t]));

  const orden = (devuelto as { orden?: unknown })?.orden;
  if (Array.isArray(orden)) {
    for (const c of orden) if (typeof c === 'string' && porClave.has(c) && !salida.orden.includes(c)) salida.orden.push(c);
  }

  const lista = (devuelto as { temas?: unknown })?.temas;
  if (!Array.isArray(lista)) return salida;
  for (const d of lista) {
    const clave = (d as { clave?: unknown })?.clave;
    const frase = (d as { frase?: unknown })?.frase;
    const tema = typeof clave === 'string' ? porClave.get(clave) : undefined;
    if (!tema || typeof frase !== 'string' || frase.trim() === '' || tema.clave in salida.textos) {
      salida.quitadas.otras += 1;
      continue;
    }
    const permitidas = numerosDelTexto(tema.texto);
    if (numerosDelTexto(frase).some((n) => !permitidas.some((p) => Math.abs(p - n) < 1e-9))) {
      salida.quitadas.cifra += 1;
      continue;
    }
    if (SUPERLATIVO.test(frase)) {
      salida.quitadas.superlativo += 1;
      continue;
    }
    // Otra área: un nombre del origen de otro tema que no sea también del suyo.
    const propias = new Set([...areasDe(tema.origen), ...citados(tema.texto)]);
    const enLaFrase = frase.toLowerCase();
    const ajenas = temas.filter((t) => t.clave !== tema.clave).flatMap((t) => areasDe(t.origen)).filter((a) => !propias.has(a));
    const conCitaAjena = citados(frase).some((c) => !propias.has(c) && !tema.texto.toLowerCase().includes(c));
    if (conCitaAjena || ajenas.some((a) => new RegExp(`(?<![a-záéíóúñ])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-záéíóúñ])`, 'i').test(enLaFrase))) {
      salida.quitadas.cruzada += 1;
      continue;
    }
    salida.textos[tema.clave] = frase.trim();
  }
  return salida;
}

/**
 * Pide el orden y la redacción. `null` si no hay temas o si el modelo no contestó: entonces se quedan el orden
 * de las reglas y las plantillas. El fallo deja su uso y su incidente por el transporte.
 */
export async function redactarReunion(p: {
  temas: readonly TemaDeLaReunion[];
  dia: string;
  llave: string;
  orgId: string;
  espera: number;
}): Promise<(RedaccionDeLaReunion & { quitadas: ValidacionDeLaReunion['quitadas'] }) | null> {
  if (p.temas.length === 0) return null;
  const r = await llamarAlModelo({
    agente: 'reunion',
    modelo: MODELO_DE_LA_REUNION,
    llave: p.llave,
    orgId: p.orgId,
    usuarioId: null,
    ref: `reunion:${p.dia}`,
    donde: `la redacción de la Reunión del ${p.dia}`,
    techo: TECHO_DE_LA_REDACCION,
    instrucciones: INSTRUCCIONES_DE_LA_REUNION,
    mensajes: [
      {
        role: 'user',
        content: JSON.stringify({ temas: p.temas.map((t) => ({ clave: t.clave, origen: t.origen, gravedad: t.gravedad, texto: t.texto })) }),
      },
    ],
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
  const v = validarRedaccionDeLaReunion(p.temas, r.datos);
  return { modelo: r.modelo, orden: v.orden, textos: v.textos, quitadas: v.quitadas };
}
