// EL CAMINO DEL CARRIL AMARILLO: del tope del día a la fila escrita.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL ORDEN ES SU DOCUMENTACIÓN, Y LOS DOS PRIMEROS PASOS NO GASTAN
//
//   1 · el tope del día        — una cuenta; si está alcanzado, **se corta acá**
//   2 · a quién mirar          — una consulta
//   3 · los mensajes y el transcript
//   4 · el modelo              — acá y solo acá se gasta, UNA vez por día y por empresa
//   5 · los tres descartes     — peldaño, patrón inválido, ya abierto
//   6 · la escritura           — un análisis y un hallazgo, en una transacción
//
// Los tres descartes del paso 5 ocurren **después** de pagar, y eso hay que decirlo sin adornos: no
// son guardias de gasto, son guardias de calidad. Lo que acota el gasto es el tope del paso 1, que es
// una cuenta y corre siempre.
//
// ── SE ESCRIBE UN ANÁLISIS AUNQUE NO HAYA HALLAZGO ─────────────────────────
//
// Y es lo que hace que este carril recorra la cuenta en vez de mirar siempre la misma conversación:
// `aQuienMirar` ordena por *«hace cuánto que este carril no la mira»*, y esa fecha sale del análisis.
// Sin fila, el mismo contacto ganaría todos los días — y como el peldaño que se reporta es el raro, la
// mayoría de los días no habría hallazgo y el carril quedaría clavado para siempre en una sola
// conversación.
// ═══════════════════════════════════════════════════════════════════════════════

import { conOrganizacion, datos } from '../datos/contexto.ts';
import { COMO_LEER_LOS_AUTORES, IMPUTABLE } from './atribucion.ts';
import {
  CRITERIO_DE_LA_MEJORA,
  DISPARO_DE_LA_MEJORA,
  PELDANO_QUE_SE_REPORTA,
  aQuienMirar,
  antesDeMirar,
  claveDelDescarte,
  esquemaDeLaMejora,
  hashDelPromptDelAgente,
  instruccionesDeLaMejora,
  NOMBRE_DE_LA_HERRAMIENTA_DE_MEJORA,
  type MejoraDelModelo,
  type PorQueNoHayMejora,
} from './mejora.ts';
import { MODELO_DEL_AUDITOR, pedirVeredicto } from './modelo.ts';
import { leerPromptDelAgente } from './prompts.ts';
import { MISION_DEL_AGENTE, REGLA_DE_IMPUTACION } from './rubrica.ts';
import { armarTranscript, medirHechos, type MensajeParaAuditar } from './transcripcion.ts';
import { normalizarPatron } from './veredicto.ts';

/** Cuántos mensajes se leen. El mismo tope que el carril rojo, y por lo mismo. */
const TOPE_DE_MENSAJES = 200;

/** Lo que hace falta para buscar una mejora. */
export interface ParaBuscarMejora {
  orgId: string;
  zona: string;
  claveIa: string;
  idDelAgente: string;
}

export interface ResultadoDeLaMejora {
  /** `null` = se escribió una mejora. Con valor, no se escribió y dice por qué. */
  porQueNo: PorQueNoHayMejora | null;
  /** Cuántas veces se llamó al modelo. Cero o uno. **Es lo que vuelve el costo una medición.** */
  llamadas: number;
  /** A quién se miró, cuando se llegó a mirar a alguien. */
  contactoId?: string;
  /** El patrón que quedó escrito. */
  patron?: string;
  /** El peldaño que el modelo eligió, cuando el modelo contestó. */
  peldano?: string;
  /** Qué falló del modelo, cuando falló. */
  fallo?: string;
}

/**
 * El bloque de las etiquetas del transcript, **reusado del carril rojo**.
 *
 * La regla de atribución es la única que no puede divergir entre los dos carriles: es la que decide a
 * quién se le imputa una línea. Duplicarla acá haría que un día un carril dijera «el agente» y el otro
 * «el agente o una automatización», y el segundo produciría mejoras correctas sobre el culpable
 * equivocado — que se ven idénticas a las buenas.
 */
function comoLeerElTranscript(): string {
  const filas = Object.entries(COMO_LEER_LOS_AUTORES).map(
    ([etiqueta, que]) => `  · ${etiqueta} — ${que}`,
  );
  return (
    'CADA LÍNEA DEL TRANSCRIPT DICE DE QUIÉN ES. Las etiquetas posibles son cinco:\n' +
    filas.join('\n') +
    '\n\n' +
    REGLA_DE_IMPUTACION
  );
}

/** Los mensajes del contacto, con lo que la atribución necesita. Ver `analisis.ts`. */
async function mensajesDelContacto(contactoId: string): Promise<MensajeParaAuditar[]> {
  const crudos = await datos()
    .selectFrom('mensajes')
    .select(['direccion', 'autor', 'autor_ghl_usuario_id', 'cuerpo', 'enviado_el'])
    .where('contacto_id', '=', contactoId)
    .orderBy('enviado_el', 'desc')
    .orderBy('id', 'desc')
    .limit(TOPE_DE_MENSAJES)
    .execute();
  return crudos.reverse();
}

/**
 * Busca la mejora del día. **Corre FUERA de un contexto de organización.**
 *
 * @param pedir La llamada al modelo, inyectable — la misma costura que el carril rojo, y por lo mismo:
 *   sin ella, probar este camino exigiría gastar plata de la cuenta en cada corrida de la suite.
 */
export async function buscarUnaMejora(
  e: ParaBuscarMejora,
  ahora: Date = new Date(),
  pedir: typeof pedirVeredicto = pedirVeredicto,
): Promise<ResultadoDeLaMejora> {
  // ── 1 · EL TOPE DEL DÍA. Una cuenta, y corta antes de todo lo demás. ──────
  const antes = await conOrganizacion(e.orgId, () => antesDeMirar(e.zona));
  if (antes.techoAlcanzado) return { porQueNo: 'techo_del_dia', llamadas: 0 };

  // ── 2 · A QUIÉN MIRAR ────────────────────────────────────────────────────
  const elegido = await conOrganizacion(e.orgId, () => aQuienMirar());
  if (elegido === null) return { porQueNo: 'sin_candidato', llamadas: 0 };

  // ── 3 · LO QUE NO CUESTA ─────────────────────────────────────────────────
  const preparado = await conOrganizacion(e.orgId, async () => {
    const mensajes = await mensajesDelContacto(elegido.contactoId);
    const hechos = medirHechos(mensajes, e.idDelAgente, ahora);
    const transcript = armarTranscript(mensajes, e.zona, e.idDelAgente);
    const prompt = await leerPromptDelAgente(elegido.agente);
    return {
      hechos,
      transcript: transcript.texto,
      promptTexto: prompt === null ? null : prompt.texto,
      promptHash: prompt === null ? null : prompt.hash,
    };
  });

  // ── 4 · EL MODELO. Una vez por día y por empresa. ────────────────────────
  const r = await pedir({
    claveIa: e.claveIa,
    agente: elegido.agente,
    instrucciones: instruccionesDeLaMejora({
      agente: elegido.agente,
      mision: MISION_DEL_AGENTE[elegido.agente],
      comoLeerElTranscript: comoLeerElTranscript(),
      promptDelAgente: preparado.promptTexto,
    }),
    /* Los patrones ya abiertos van como «conocidos» para que el modelo REUSE un código en vez de
       inventar otro para el mismo problema. Es lo mismo que hace el carril rojo, y acá importa más:
       sin eso, el descarte por patrón no descartaría casi nunca — dos códigos distintos para la misma
       falla pasan los dos. */
    patrones: [...antes.yaAbiertos].map((k) => k.split('|')[0] as string),
    conversacion: `${preparado.transcript}\n\nRegistrá la mejora con la herramienta.`,
    // La herramienta y el esquema son propios de este carril: otra pregunta, otra forma.
    herramienta: NOMBRE_DE_LA_HERRAMIENTA_DE_MEJORA,
    esquema: esquemaDeLaMejora(),
  });

  const comun = { llamadas: 1, contactoId: elegido.contactoId };
  if (r.tipo !== 'datos') {
    return { ...comun, porQueNo: null, fallo: r.tipo };
  }

  const m = r.datos.veredicto as unknown as MejoraDelModelo;

  /* ── 5 · LOS TRES DESCARTES, Y SE ESCRIBE EL ANÁLISIS IGUAL ───────────────
   *
   * Los tres ocurren después de pagar, así que no ahorran nada — y aun así el análisis se escribe en
   * los tres casos. Es lo que mueve la fecha de «este carril ya miró a este contacto», y sin eso el
   * mismo contacto ganaría la elección todos los días: como el peldaño que se reporta es el raro, la
   * mayoría de los días no hay hallazgo, y el carril quedaría clavado en una sola conversación. */
  const patron = normalizarPatron(m?.patron);
  const porQueNo: PorQueNoHayMejora | null =
    m?.peldano !== PELDANO_QUE_SE_REPORTA
      ? 'no_es_para_reportar'
      : patron === null
        ? 'patron_invalido'
        : antes.yaAbiertos.has(
              claveDelDescarte(patron, elegido.agente, preparado.promptHash),
            )
          ? 'ya_estaba_abierto'
          : null;

  await conOrganizacion(e.orgId, async () => {
    const analisis = await datos()
      .insertInto('analisis_del_agente')
      .values({
        contacto_id: elegido.contactoId,
        agente: elegido.agente,
        /* `auditable: true` y `nivel` derivado: hubo veredicto —el modelo contestó la pregunta— y el
           nivel sale de si quedó un hallazgo, igual que en el carril rojo. Un análisis de este carril
           **nunca es rojo**: no pide intervención y el `check` de la base lo hace cumplir. */
        auditable: true,
        no_auditable_motivo: null,
        intervencion: false,
        motivo: null,
        criterio: porQueNo === null ? CRITERIO_DE_LA_MEJORA : null,
        nivel: porQueNo === null ? 'amarillo' : 'verde',
        resumen: resumenDeLaMejora(m, porQueNo),
        destacado: null,
        evidencia: null,
        observaciones: null,
        sentimiento: null,
        disparo: DISPARO_DE_LA_MEJORA,
        /* `null` y no `[]`: este carril **no mira las señales del nivel 0**. Un array vacío diría que
           se miraron y no había, que es otra afirmación. */
        alarmas: null,
        modelo: MODELO_DEL_AUDITOR,
        prompt_hash: preparado.promptHash,
        /* La línea base del antirrebote del carril ROJO. Se escribe con lo que hay para que este
           carril no le adelante el contador al otro: si pusiera cero, el rojo vería un delta enorme y
           auditaría de nuevo la misma conversación al día siguiente. */
        mensajes_del_agente: elegido.mensajesDelAgente,
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();

    if (porQueNo === null && patron !== null) {
      await datos()
        .insertInto('hallazgos')
        .values({
          contacto_id: elegido.contactoId,
          analisis_id: analisis.id,
          agente: elegido.agente,
          titulo: m.titulo,
          patron,
          criterio: CRITERIO_DE_LA_MEJORA,
          /* Siempre amarillo. Este carril **no produce rojos**: no interrumpe a nadie, y un rojo acá
             mandaría a un vendedor a tomar una conversación que ya terminó hace días. */
          severidad: 'amarillo',
          categoria: 'comportamiento',
          diagnostico: m.diagnostico,
          fragmento_prompt: null,
          prompt_seccion: null,
          correccion: m.correccion,
          prompt_hash: preparado.promptHash,
          evidencia_agente: m.evidencia_agente,
          evidencia_contacto: m.evidencia_contacto,
        } as never)
        .execute();
    }
  });

  return { ...comun, porQueNo, patron: patron ?? undefined, peldano: m?.peldano };
}

/** El resumen del análisis. **Dice el peldaño**, que es lo único que este carril midió. */
function resumenDeLaMejora(m: MejoraDelModelo, porQueNo: PorQueNoHayMejora | null): string {
  const base = `Revisión en frío: ${m?.peldano ?? 'sin peldaño'}.`;
  if (porQueNo === null) return `${base} ${m.diagnostico}`;
  /* Cuando no se reporta, el resumen dice por qué. Sin eso, la lista del técnico mostraría filas
     idénticas que dicen «revisión en frío» y nada más, y nadie podría distinguir «el agente estuvo
     bien» de «el modelo devolvió un código roto». */
  return `${base} No se reportó: ${porQueNo}.`;
}
