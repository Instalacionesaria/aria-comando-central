// Los datos que un paso ya sabe porque los contestó o los produjo un paso anterior.
//
// ═══════════════════════════════════════════════════════════════════════════════
// CADA DATO SE PREGUNTA UNA SOLA VEZ (2026-10-03)
//
// El nicho se preguntaba en Tu ficha, en el Research y en el ICP; el precio en la ficha y en la
// Oferta; la experiencia en la ficha y en el Research. Ahora cada dato se pregunta en el PRIMER paso
// donde hace falta, y los siguientes lo heredan: el agente no lo pregunta, lo muestra como «Esto ya
// lo sé» y deja corregirlo.
//
// ── QUÉ ES HEREDAR, Y QUÉ NO ───────────────────────────────────────────────────
//
// Heredar es COPIAR un dato que ya existe, sin modelo de por medio: la respuesta que la persona dio
// en otro paso, o una línea del veredicto de un documento generado. Es distinto de lo que el agente
// «deduce» al abrir (`proponerRespuestas`), que es una inferencia y se marca como tal. Un dato
// heredado manda sobre uno deducido; uno que la persona ya contestó en ESTE paso manda sobre los dos.
//
// ── CORREGIR UN DATO HEREDADO ──────────────────────────────────────────────────
//
// La corrección vale solo para este paso: queda en sus respuestas. Si el dato viene de una respuesta
// de Tu ficha (`campoDeLaFicha`), la pantalla ofrece «Actualizar también en Tu ficha», y solo escribe
// allí si la persona lo toca. Decisión del 2026-10-03: cambiar un paso desde otro sin que se vea es
// peor que pedir un clic.
// ═══════════════════════════════════════════════════════════════════════════════

import { SIN_ESPECIFICAR, camposDe, claveCorta } from './campos.ts';
import { leerDocumento, segmentoGanador } from './documento.ts';
import { ultimaVersion, type EstadoDeFundaciones } from './estado.ts';
import { esB2C, esUbicacionBuscable } from './mercado.ts';
import { herramienta, type Herramienta } from './herramientas.ts';

export interface Heredado {
  valor: string;
  /** De dónde sale, como se le dice a la persona: «Tu ficha», «tu Research», «tu ICP». */
  fuente: string;
  /** El campo de Tu ficha que lo contestó, cuando la fuente es una respuesta de la ficha. Es lo que
      habilita «Actualizar también en Tu ficha». `null` cuando sale de un documento generado. */
  campoDeLaFicha: string | null;
}

type Regla = (estado: EstadoDeFundaciones) => Heredado | null;

/** Una respuesta de Tu ficha, si la hay. */
function deLaFicha(clave: string): Regla {
  return (estado) => {
    const v = estado.perfil[0]?.[clave];
    if (!v || v.trim() === '' || v === SIN_ESPECIFICAR) return null;
    return { valor: v.trim(), fuente: 'Tu ficha', campoDeLaFicha: `t1-${clave}` };
  };
}

/** El segmento ganador del Research, leído de su veredicto. Solo con los cinco pasos hechos. */
const segmentoDelResearch: Regla = (estado) => {
  if (estado.researchSalidas.length < 5) return null;
  const g = segmentoGanador(estado.researchSalidas[4]);
  return g ? { valor: g.segmento, fuente: 'tu Research', campoDeLaFicha: null } : null;
};

/** El país de la ciudad donde el Research buscó negocios reales («zona, ciudad, país»). */
const paisDelResearch: Regla = (estado) => {
  const lugar = (estado.researchInputs['location'] ?? '').trim();
  if (!esUbicacionBuscable(lugar)) return null;
  const pais = lugar.split(',').pop()?.trim() ?? '';
  return pais ? { valor: pais, fuente: 'tu Research', campoDeLaFicha: null } : null;
};

/** El «Deseo dominante» del veredicto del ICP: lo que el cliente quiere conseguir. */
const deseoDelIcp: Regla = (estado) => {
  const doc = ultimaVersion(estado, 3);
  if (!doc) return null;
  const item = leerDocumento(doc).veredicto.find((v) => /deseo/i.test(v.titulo));
  const valor = item?.conclusion.replace(/\*\*/g, '').trim() ?? '';
  return valor ? { valor, fuente: 'tu ICP', campoDeLaFicha: null } : null;
};

/** El mercado del Research (B2B o B2C), traducido a la opción equivalente del VSL de Tools. */
const mercadoDelResearch: Regla = (estado) => {
  const mercado = (estado.researchInputs['market'] ?? '').trim();
  if (mercado === '' || mercado === SIN_ESPECIFICAR) return null;
  /* Los valores del VSL son otros textos —encienden ramas de su framework por el prefijo (`_isB2C`)—,
     así que se copia la OPCIÓN del VSL que empieza igual, nunca el texto del Research. */
  const prefijo = esB2C(mercado) ? 'B2C' : 'B2B';
  const opcion = herramienta(5)
    ?.filas.flatMap((f) => f.campos)
    .find((c) => c.id === 't6-market')
    ?.opciones?.find((o) => o.valor.startsWith(prefijo));
  return opcion ? { valor: opcion.valor, fuente: 'tu Research', campoDeLaFicha: null } : null;
};

/**
 * Qué campo hereda de dónde. Por identificador de campo: el catálogo de `herramientas.ts` sigue
 * siendo la única lista de preguntas, y esto solo dice cuáles de ellas ya tienen respuesta.
 */
export const HEREDA: Readonly<Record<string, Regla>> = {
  // Research ← Tu ficha
  'mr-niche': deLaFicha('niche'),
  'mr-experience': deLaFicha('experience'),
  // ICP ← Research
  't4-niche': segmentoDelResearch,
  't4-country': paisDelResearch,
  // Oferta ← Tu ficha y el ICP
  't5-price': deLaFicha('price'),
  't5-result': deseoDelIcp,
  // Tu precio ← Tu ficha
  't11-pastresults': deLaFicha('result'),
  // El VSL (Tools) ← Research: a empresas o a personas se pregunta una sola vez.
  't6-market': mercadoDelResearch,
};

/** Los datos heredados de una herramienta, con CLAVES CORTAS (como las respuestas del agente). */
export function heredadosDe(h: Herramienta, estado: EstadoDeFundaciones): Record<string, Heredado> {
  const salida: Record<string, Heredado> = {};
  for (const campo of camposDe(h)) {
    const regla = HEREDA[campo.id];
    const dato = regla ? regla(estado) : null;
    if (dato) salida[claveCorta(campo.id)] = dato;
  }
  return salida;
}
