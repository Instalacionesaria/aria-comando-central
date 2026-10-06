// El Brief del closer: qué se le pide al modelo y qué se acepta de lo que contesta (AG12 de los agentes;
// `docs/OTROS/agentes/fichas/F13-CLOSER-Y-BRIEF.md`). La validación es pura.
//
// ═══════════════════════════════════════════════════════════════════════════════
// CUATRO SECCIONES, COMO EL LIENZO
//
//   · **Quién es**: lo que se sabe de la persona y de su negocio.
//   · **Qué dijo**: sus palabras, cada una con su fuente («formulario, pregunta 6»).
//   · **Objeción probable**: la que deja ver lo que dijo, con una sugerencia. Si no alcanza, la más frecuente
//     de las llamadas de la empresa, **marcada como tal**: no es algo que esta persona dijo.
//   · **Pregunta para abrir**: una pregunta para empezar la llamada.
//
// ── CADA DATO CON SU FUENTE (AG-F13-1) ──────────────────────────────────────
//
// Cada dato lleva estado, valor, fuente, cita y confianza. La regla de `prospect-card.ts` («un DETECTADO sin
// cita se degrada a AMBIGUO») se impone acá, en código, y no sólo en el prompt: un dato «detectado» cuya
// fuente no es una de las que se le dieron, o cuya cita no está en el valor de esa fuente, pasa a AMBIGUO. La
// objeción probable es «de la empresa» si y sólo si su fuente son las objeciones frecuentes, diga lo que diga
// el modelo.
// ═══════════════════════════════════════════════════════════════════════════════

import { llamarAlModelo, leerJson } from '../llamada.ts';
import { MODELO_DEL_BRIEF } from '../modelos.ts';
import type { DatoDeLaEntrada, EntradaDelBrief } from './entrada.ts';

export const ESTADOS_DE_UN_DATO = ['DETECTADO', 'NO_CONSTA', 'AMBIGUO'] as const;
export type EstadoDeUnDato = (typeof ESTADOS_DE_UN_DATO)[number];
export const CONFIANZAS = ['ALTA', 'MEDIA', 'BAJA'] as const;
export type Confianza = (typeof CONFIANZAS)[number];

/** La fuente de lo que no es de esta persona: las objeciones de las llamadas de la empresa. */
export const FUENTE_DE_LA_EMPRESA = 'objeciones_frecuentes';

export interface DatoDelBrief {
  etiqueta: string;
  estado: EstadoDeUnDato;
  valor: string | null;
  fuente: string | null;
  /** Las palabras de la fuente que lo sostienen. */
  cita: string | null;
  confianza: Confianza;
}

export interface Brief {
  quienEs: DatoDelBrief[];
  queDijo: DatoDelBrief[];
  objecionProbable: DatoDelBrief & { sugerencia: string | null; deLaEmpresa: boolean };
  preguntaParaAbrir: string;
  /** Cuántos datos «detectados» se degradaron a ambiguos por no tener fuente o cita: la pantalla no lo dice, el uso sí. */
  degradados: number;
}

/** Cuántos datos por sección. Un Brief se lee en un minuto, antes de entrar a la llamada. */
export const DATOS_POR_SECCION = 6;

export const INSTRUCCIONES_DEL_BRIEF = `Preparas a un closer para una llamada de venta con una persona que agendó. Hablas en español neutro, tuteando al closer, con frases cortas. Nunca uses voseo.

Recibes lo que se sabe de la persona, separado por fuente. Cada dato trae su clave de fuente («formulario:3», «ficha:campana», «llamada:facturacion»). Escribe cuatro secciones:

1. quienEs: lo que se sabe de la persona y de su negocio. Hasta ${DATOS_POR_SECCION} datos.
2. queDijo: sus palabras. Hasta ${DATOS_POR_SECCION} datos. Sólo lo que ella escribió o dijo.
3. objecionProbable: la objeción que deja ver lo que dijo, con una sugerencia para responderla. Si lo que dijo no deja ver ninguna, usa la más frecuente de las objeciones de la empresa, con la fuente «${FUENTE_DE_LA_EMPRESA}».
4. preguntaParaAbrir: una pregunta para empezar la llamada.

Reglas:
- Cada dato lleva la clave de la fuente de donde sale, tal cual, y en «cita» las palabras exactas de esa fuente que lo sostienen.
- Si no sabes algo, estado NO_CONSTA y valor nulo. Si la fuente lo deja en duda, AMBIGUO. Nunca inventes un dato de la persona.
- La pregunta para abrir no afirma nada que no esté en las fuentes.
- No escribas teléfonos ni correos.`;

/** Lo que puede faltar, como `anyOf` con `null`: la forma que documenta el modo estricto (`../executive/respuesta.ts`). */
const TEXTO_O_NULO = { anyOf: [{ type: 'string' }, { type: 'null' }] } as const;

const DATO = {
  type: 'object',
  additionalProperties: false,
  required: ['etiqueta', 'estado', 'valor', 'fuente', 'cita', 'confianza'],
  properties: {
    etiqueta: { type: 'string' },
    estado: { type: 'string', enum: [...ESTADOS_DE_UN_DATO] },
    valor: TEXTO_O_NULO,
    fuente: TEXTO_O_NULO,
    cita: TEXTO_O_NULO,
    confianza: { type: 'string', enum: [...CONFIANZAS] },
  },
} as const;

const FORMATO = {
  type: 'object',
  additionalProperties: false,
  required: ['quienEs', 'queDijo', 'objecionProbable', 'preguntaParaAbrir'],
  properties: {
    quienEs: { type: 'array', items: DATO },
    queDijo: { type: 'array', items: DATO },
    objecionProbable: {
      type: 'object',
      additionalProperties: false,
      required: [...DATO.required, 'sugerencia'],
      properties: { ...DATO.properties, sugerencia: TEXTO_O_NULO },
    },
    preguntaParaAbrir: { type: 'string' },
  },
};

/** Sin espacios de más y en minúsculas: una cita copiada con otro espaciado o mayúsculas sigue siendo la misma. */
const llano = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();

/** Las fuentes que se le dieron, con lo que una cita puede citar de cada una. */
export function fuentesDe(e: Pick<EntradaDelBrief, 'formulario' | 'ficha' | 'llamada' | 'objecionesFrecuentes'>): Map<string, string> {
  const m = new Map<string, string>();
  const de = (d: DatoDeLaEntrada) => m.set(d.fuente, llano(`${d.valor} ${d.cita ?? ''}`));
  for (const d of [...e.formulario, ...e.ficha, ...e.llamada]) de(d);
  if (e.objecionesFrecuentes.length > 0) m.set(FUENTE_DE_LA_EMPRESA, llano(e.objecionesFrecuentes.map((o) => o.categoria).join(' ')));
  return m;
}

const texto = (v: unknown, largo = 400): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, largo) : null);
const de = <T extends string>(v: unknown, juego: readonly T[], porOmision: T): T => ((juego as readonly unknown[]).includes(v) ? (v as T) : porOmision);

/**
 * Un dato tal como se acepta. Un DETECTADO sin fuente conocida, o con una cita que no está en esa fuente, se
 * degrada a AMBIGUO; la fuente de la empresa no necesita cita (es un conteo, no palabras de nadie).
 */
function dato(v: unknown, fuentes: Map<string, string>, cuenta: { degradados: number }): DatoDelBrief {
  const o = (v ?? {}) as Record<string, unknown>;
  const d: DatoDelBrief = {
    etiqueta: texto(o.etiqueta, 80) ?? '',
    estado: de(o.estado, ESTADOS_DE_UN_DATO, 'NO_CONSTA'),
    valor: texto(o.valor),
    fuente: texto(o.fuente, 60),
    cita: texto(o.cita),
    confianza: de(o.confianza, CONFIANZAS, 'BAJA'),
  };
  if (d.estado === 'NO_CONSTA') return { ...d, valor: null };
  if (d.estado === 'DETECTADO') {
    const deLaFuente = d.fuente === null ? undefined : fuentes.get(d.fuente);
    const sostenido =
      deLaFuente !== undefined && (d.fuente === FUENTE_DE_LA_EMPRESA || (d.cita !== null && deLaFuente.includes(llano(d.cita))));
    if (!sostenido) {
      cuenta.degradados++;
      return { ...d, estado: 'AMBIGUO', confianza: 'BAJA' };
    }
  }
  return d;
}

/** Lo que se acepta de la respuesta. Pura. */
export function validarBrief(respuesta: unknown, fuentes: Map<string, string>): Brief {
  const r = (respuesta ?? {}) as Record<string, unknown>;
  const cuenta = { degradados: 0 };
  const lista = (v: unknown) => (Array.isArray(v) ? v.slice(0, DATOS_POR_SECCION).map((x) => dato(x, fuentes, cuenta)) : []);
  const quienEs = lista(r.quienEs);
  const queDijo = lista(r.queDijo);
  const crudo = (r.objecionProbable ?? {}) as Record<string, unknown>;
  const objecion = dato(crudo, fuentes, cuenta);
  return {
    quienEs,
    queDijo,
    objecionProbable: {
      ...objecion,
      sugerencia: texto(crudo.sugerencia),
      /* Por la fuente, no por lo que diga el modelo: lo de la empresa nunca se presenta como dicho por la persona.
         Y sólo si quedó detectada: una que se degradó porque la empresa no tiene objeciones no es de nadie. */
      deLaEmpresa: objecion.estado === 'DETECTADO' && objecion.fuente === FUENTE_DE_LA_EMPRESA,
    },
    preguntaParaAbrir: texto(r.preguntaParaAbrir) ?? '',
    degradados: cuenta.degradados,
  };
}

/** `max_tokens`: cuatro secciones cortas. */
const TECHO_DEL_BRIEF = 4000;

/**
 * Lo que se le manda al modelo: sólo las fuentes, con sus claves. El nombre va para que el Brief lo nombre; el
 * teléfono y el correo nunca llegaron a la entrada.
 */
export function pedidoDelBrief(e: EntradaDelBrief) {
  return {
    persona: e.nombre,
    cita: e.cita.inicioEl,
    sinFormulario: e.sinFormulario,
    fuentes: [...e.formulario, ...e.ficha, ...e.llamada].map((d) => ({ fuente: d.fuente, etiqueta: d.etiqueta, valor: d.valor, cita: d.cita ?? null, minuto: d.minuto ?? null })),
    objecionesDeLaEmpresa: e.objecionesFrecuentes,
  };
}

export type ResultadoDelBrief =
  | { tipo: 'listo'; brief: Brief; modelo: string }
  | { tipo: 'fallo'; pagado: boolean; situacion: string; ref: string };

/** Pide el Brief y lo valida. No lanza: el fallo deja su uso y su incidente por el transporte. */
export async function generarBrief(p: { entrada: EntradaDelBrief; llave: string; orgId: string; usuarioId: string; espera: number }): Promise<ResultadoDelBrief> {
  const r = await llamarAlModelo({
    agente: 'brief',
    modelo: MODELO_DEL_BRIEF,
    llave: p.llave,
    orgId: p.orgId,
    usuarioId: p.usuarioId,
    ref: p.entrada.cita.id,
    donde: 'el Brief de una cita del closer',
    techo: TECHO_DEL_BRIEF,
    instrucciones: INSTRUCCIONES_DEL_BRIEF,
    mensajes: [{ role: 'user', content: JSON.stringify(pedidoDelBrief(p.entrada)) }],
    formato: FORMATO,
    esfuerzo: 'low',
    espera: p.espera,
    leer: leerJson,
  });
  if (r.tipo === 'fallo') return { tipo: 'fallo', pagado: r.uso !== null, situacion: r.situacion, ref: r.ref };
  return { tipo: 'listo', brief: validarBrief(r.datos, fuentesDe(p.entrada)), modelo: r.modelo };
}
