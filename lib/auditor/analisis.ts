// EL CAMINO COMPLETO: de los candidatos al veredicto escrito. **Es el único que gasta.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL ORDEN DE ESTE ARCHIVO ES SU DOCUMENTACIÓN
//
//   0 · la empresa            — tres motivos, y ninguna consulta
//   1 · el candado            — antes de gastar, no después
//   2 · los candidatos        — una consulta, cero llamadas al CRM
//   3 · por contacto:
//         a · los mensajes    — una consulta
//         b · los hechos      — atribución, en código
//         c · la precondición — **el portón 5, y corta ANTES del modelo**
//         d · el transcript, el prompt y los patrones
//         e · el modelo       — acá y solo acá se gasta
//         f · la escritura    — una transacción por contacto
//
// ── EL CANDADO NO ES LO QUE HACE IDEMPOTENTE UNA CORRIDA DUPLICADA ──────────
//
// Vale decirlo porque es contraintuitivo. `conElPulso` frena las corridas SIMULTÁNEAS, y su
// antirrebote son diez segundos contra un cron de diez minutos: una entrega duplicada que llegue tres
// minutos después **pasa el candado**.
//
// Lo que hace que esa corrida no cueste nada es otra cosa: **la línea base del antirrebote**. La
// primera corrida escribió una fila por cada contacto que analizó, así que la segunda hace la resta
// contra ese número y todos dan cero. La resta es la que protege el dinero; el candado solo evita que
// dos corridas se pisen en el mismo instante.
//
// Por eso el diseño de origen pedía un candado de 120 segundos y acá no hace falta: allá el análisis
// corría dentro del webhook, con muchos eventos por minuto. Acá el único que llama es el cron.
//
// ── EL CORTA-CIRCUITO, Y POR QUÉ NO ALCANZA CON REPORTAR EL FALLO ──────────
//
// Cinco finales del modelo son fallos, y **dos de ellos se pagan y son deterministas**: un truncado
// vuelve a truncar sobre la misma conversación, y un declino vuelve a declinar. Ninguno escribe fila,
// así que la línea base no se mueve y la corrida siguiente lo reintenta.
//
// Sin nada en el medio, un fallo determinista sobre veinte candidatos son veinte llamadas pagadas cada
// diez minutos, para siempre. El corta-circuito lo acota a `TOPE_DE_FALLOS` por corrida: los primeros
// fallos se reintentan —pueden ser transitorios— y a partir del tope la empresa se abandona y el
// reporte lo dice.
// ═══════════════════════════════════════════════════════════════════════════════

import { datos, conOrganizacion } from '../datos/contexto.ts';
import { conElPulso } from '../negocio/pulso.ts';
import { candidatosDecididos } from './candidatos.ts';
import { escribirAnalisis } from './escritura.ts';
import { MODELO_DEL_AUDITOR, pedirVeredicto, type ResultadoDelAuditor } from './modelo.ts';
import { porQueNoSeAuditaLaEmpresa, type MotivoDeLaEmpresa } from './portones.ts';
import { leerPromptDelAgente } from './prompts.ts';
import { instruccionesDelAuditor, textoDeLaConversacion } from './rubrica.ts';
import {
  armarTranscript,
  medirHechos,
  porQueNoSeAudita,
  type MensajeParaAuditar,
} from './transcripcion.ts';
import type { Agente } from './veredicto.ts';

/**
 * Cuántos mensajes se traen por conversación.
 *
 * ── ESTE NÚMERO ES UNA MEDICIÓN, Y ACOTA UNA AFIRMACIÓN ────────────────────
 *
 * `medirHechos` promete contar sobre la conversación **completa**, y eso es cierto solo si acá entra
 * toda. Medido en producción el 2026-08-31: la conversación más larga tiene **99 mensajes**, el
 * promedio es 12,8, y **ninguna pasa de 100**. Con 200 hay el doble de margen que la más larga.
 *
 * Lo que se paga si algún día una conversación lo pasa, dicho con precisión: los hechos se medirían
 * sobre los últimos 200 y no sobre la conversación entera, así que un «nunca respondió» podría ser un
 * «no respondió en los últimos 200». El transcript ya avisa cuando está recortado; los hechos no.
 */
export const TOPE_DE_MENSAJES_A_LEER = 200;

/**
 * Cuántos patrones ya detectados se le muestran al modelo.
 *
 * La lista va en el segundo bloque de `system` y su trabajo es que el modelo REUSE un código en vez de
 * inventar uno nuevo para el mismo problema. Sin tope crecería con cada hallazgo y el prompt con ella;
 * con los más frecuentes primero, los que sobran son justamente los que casi no se repiten.
 */
export const TOPE_DE_PATRONES = 40;

/**
 * Cuántos fallos del modelo se toleran por corrida y por empresa antes de abandonarla.
 *
 * Tres y no uno: `sin_estructura` y `rechazo` pueden ser transitorios, y abandonar con el primero haría
 * que un hipo del proveedor dejara sin auditar una empresa entera durante diez minutos. Tres y no diez:
 * los otros dos finales son deterministas y cada reintento se paga.
 */
export const TOPE_DE_FALLOS = 3;

/** Lo que hace falta saber de la empresa para auditarla. */
export interface ParaAuditar {
  orgId: string;
  /** La zona de la EMPRESA, para los sellos de tiempo del transcript. */
  zona: string;
  auditorActivo: boolean;
  /** La clave de IA **ya descifrada**, o `null`. Sin valor por omisión: `ADR-0908`. */
  claveIa: string | null;
  /** El identificador del agente en el CRM de esa empresa. Sin él no hay atribución. */
  idDelAgente: string | null;
}

/** Qué pasó con un contacto. Cinco finales, y **tres son normales**. */
export type FinalDelContacto =
  /** Se escribió un veredicto. */
  | 'analizado'
  /** La precondición cortó antes del modelo. **No se gastó nada.** */
  | 'no_auditable'
  /** El modelo falló. No se escribió fila. */
  | 'fallo_del_modelo'
  /** El corta-circuito ya estaba abierto. */
  | 'abandonado'
  /**
   * Se agotó el presupuesto de tiempo de la corrida. **No se gastó nada en este contacto.**
   *
   * Es distinto de `abandonado`, y colapsarlos escondería la diferencia que importa: `abandonado`
   * significa que algo está fallando y hay que mirarlo; esto significa que había más trabajo que
   * tiempo, y se arregla solo en la corrida siguiente.
   */
  | 'sin_tiempo';

export interface RenglonDelAnalisis {
  contactoId: string;
  agente: Agente;
  final: FinalDelContacto;
  /** El nivel que quedó escrito, cuando se escribió. */
  nivel?: string | null;
  intervencion?: boolean;
  hallazgos?: number;
  /** Qué salió mal, o por qué no se pudo juzgar. **Nunca se colapsan dos motivos distintos.** */
  porque?: string;
}

export interface ResultadoDeLaAuditoria {
  /** `null` = la empresa se audita. Con valor, no se miró ni un contacto. */
  frenoDeLaEmpresa: MotivoDeLaEmpresa | null;
  /** `true` = el candado o el antirrebote lo frenaron. **No es un error.** */
  frenado?: string;
  candidatos: number;
  /** Cuántas veces se llamó al modelo. **Es lo que vuelve el costo una medición.** */
  llamadas: number;
  /** `true` = el corta-circuito se abrió y quedaron candidatos sin mirar. */
  cortoCircuito: boolean;
  /** `true` = el tope de candidatos cortó. */
  hayMas: boolean;
  renglones: readonly RenglonDelAnalisis[];
}

/** La costura para probar sin gastar. Es la firma de `pedirVeredicto`. */
export type PedirVeredicto = typeof pedirVeredicto;

/**
 * Lo que no es de la empresa: el reloj, el presupuesto y la costura.
 *
 * ── EL PRESUPUESTO DE TIEMPO ES EL GUARDIA QUE FALTABA ────────────────────
 *
 * `lib/negocio/barrido.ts` ya tiene uno, y **no alcanza para esta tarea**: comprueba el reloj *antes
 * de empezar cada empresa*, lo cual acota el caso de muchas empresas lentas. Las otras tareas cuestan
 * unas pocas llamadas al CRM y terminan en segundos, así que ese granulado les sirve.
 *
 * Ésta no. Una sola empresa puede tener veinte candidatos, y veinte llamadas al modelo pasan
 * cómodamente los 300 segundos de `maxDuration`. Sin un guardia acá, Vercel corta la función a mitad
 * de camino: **la plataforma no reintenta**, así que lo que se corta se pierde, y la llamada que
 * estaba en vuelo se paga igual.
 *
 * Con el presupuesto, la corrida se detiene sola, reporta los que quedaron como `sin_tiempo`, y la
 * siguiente empieza justo por ahí — porque el orden de los candidatos pone primero a los que hace más
 * que no se analizan.
 */
export interface OpcionesDeAuditoria {
  /** El instante de referencia. Inyectable por el umbral de silencio del nivel 0. */
  ahora?: Date;
  /** Hasta cuándo se puede llamar al modelo, en milisegundos de época. */
  hasta?: number;
  /** El reloj del presupuesto. Inyectable: sin la costura, probarlo exigiría una prueba de minutos. */
  reloj?: () => number;
  /** La llamada al modelo. **Es lo que permite probar todo este camino sin gastar.** */
  pedir?: PedirVeredicto;
}

/**
 * Los mensajes de un contacto, con lo que la atribución necesita.
 *
 * No se reusa `mensajesDeLaFicha`: esa función **no devuelve `autor_ghl_usuario_id`**, que es
 * exactamente la columna sobre la que se decide si una línea es del agente o de una automatización.
 * Agregársela le pondría a la ficha del contacto un campo que no usa, y el día que alguien lo quite
 * por prolijidad la atribución del auditor se rompería en silencio: todas las líneas saldrían como
 * AUTOMATIZACIÓN y ningún agente volvería a tener un hallazgo.
 *
 * ── ASCENDENTE, Y EL TOPE SE PIDE AL REVÉS ─────────────────────────────────
 *
 * `armarTranscript` pide la conversación en orden cronológico y no la ordena —ordenarla dos veces son
 * dos criterios que un día difieren—. Y el tope se pide `desc` y se invierte, que es el error que la
 * ficha ya documenta: con `asc + limit` se guardan los más VIEJOS y se esconde lo reciente.
 */
async function mensajesDelContacto(contactoId: string): Promise<MensajeParaAuditar[]> {
  const crudos = await datos()
    .selectFrom('mensajes')
    .select(['direccion', 'autor', 'autor_ghl_usuario_id', 'cuerpo', 'enviado_el'])
    .where('contacto_id', '=', contactoId)
    .orderBy('enviado_el', 'desc')
    // El desempate estable. Dos mensajes del mismo instante saldrían en orden distinto en cada
    // corrida, y el transcript le mostraría al modelo una conversación con las líneas cruzadas.
    .orderBy('id', 'desc')
    .limit(TOPE_DE_MENSAJES_A_LEER)
    .execute();
  return crudos.reverse();
}

/**
 * Los códigos de patrón ya detectados para ese agente, **los más frecuentes primero**.
 *
 * Acotado al agente y no a la empresa entera: ofrecerle al auditor de pre-agenda los códigos de
 * post-agenda invita al mismo cruce que este módulo viene evitando en el esquema y en la rúbrica. Y el
 * sentido de reusar un código es agrupar **la misma falla del mismo agente**.
 */
async function patronesDelAgente(agente: Agente): Promise<string[]> {
  const filas = await datos()
    .selectFrom('hallazgos')
    .select(['patron'])
    .select(({ fn }) => fn.countAll<string>().as('n'))
    .where('agente', '=', agente)
    .groupBy('patron')
    .orderBy('n', 'desc')
    .limit(TOPE_DE_PATRONES)
    .execute();
  return filas.map((f) => f.patron);
}

/**
 * Audita una empresa. **Corre FUERA de un contexto de organización**: los abre por paso.
 *
 * La costura de `pedir` es lo que permite probar todo este camino **sin gastar plata de la cuenta de
 * la empresa** — que es la única forma de tener una prueba de este archivo que se pueda correr en
 * cada cambio, y sin eso este archivo no tendría ninguna.
 */
export async function auditarEmpresa(
  e: ParaAuditar,
  o: OpcionesDeAuditoria = {},
): Promise<ResultadoDeLaAuditoria> {
  const ahora = o.ahora ?? new Date();
  const pedir = o.pedir ?? pedirVeredicto;
  const vacio = { candidatos: 0, llamadas: 0, cortoCircuito: false, hayMas: false, renglones: [] };

  // ── 0 · LA EMPRESA. Antes de cualquier consulta y antes del candado. ──────
  const freno = porQueNoSeAuditaLaEmpresa({
    auditorActivo: e.auditorActivo,
    /* Derivado de la clave y no un campo aparte: dos formas de decir el mismo hecho terminan
       divergiendo, y acá la divergencia sería «dice que tiene clave y llama sin clave». */
    tieneClaveIa: e.claveIa !== null && e.claveIa !== '',
    idDelAgente: e.idDelAgente,
  });
  if (freno !== null) return { frenoDeLaEmpresa: freno, ...vacio };

  // Después del portón 0 las dos son seguras, y el tipo lo sabe.
  const claveIa = e.claveIa as string;
  const idDelAgente = e.idDelAgente as string;

  // ── 1 · EL CANDADO, ANTES DE GASTAR ──────────────────────────────────────
  const conPulso = await conElPulso(e.orgId, 'auditoria', async () => {
    const r = await trabajar(e, claveIa, idDelAgente, ahora, pedir, o);
    return {
      /* La marca de agua **no se usa acá**, y va en nulo a propósito. `ingesta_pulso` la comparte con
         la ingesta, donde significa «toda conversación anterior a esto ya se leyó». Este barrido no
         camina por fecha sino por la resta del antirrebote, así que escribir una marca sería inventar
         una afirmación que nadie lee — y que el día que alguien la lea sería falsa. */
      cierre: { marcaEl: null, llamadas: r.llamadas, atrasado: r.hayMas || r.cortoCircuito, fallo: null },
      resultado: r,
    };
  });

  if (conPulso.corrio === false) {
    return { frenoDeLaEmpresa: null, frenado: conPulso.porque, ...vacio };
  }
  return { frenoDeLaEmpresa: null, ...conPulso.resultado };
}

/**
 * El fallo del modelo, en una frase. **Los cinco por su nombre, y los dos con detalle lo llevan.**
 *
 * El detalle es lo único que dice QUÉ estuvo mal: sin él, un `rechazado` cubre por igual una clave
 * vencida, un tope de peticiones y un campo de más en el cuerpo, y las tres mandan a mirar lugares
 * distintos.
 *
 * Y va al RENGLÓN del reporte, no al registro: el reporte del cron lo devuelve el manejador, que ya
 * decide qué sale al cuerpo. Acá no hay nombres de tabla ni fragmentos de consulta, así que no hay
 * nada de `ADR-0704` que ocultar — es la frase que manda el proveedor.
 */
function porqueFallo(r: Exclude<ResultadoDelAuditor, { tipo: 'datos' }>): string {
  if (r.tipo === 'rechazado') return `rechazado (${r.estado} ${r.codigo}): ${r.motivo ?? 'sin detalle'}`;
  if (r.tipo === 'sin_respuesta') return `sin respuesta: ${r.causa}`;
  return r.tipo;
}

/** El trabajo, con el candado ya tomado y la transacción del reclamo YA CERRADA. */
async function trabajar(
  e: ParaAuditar,
  claveIa: string,
  idDelAgente: string,
  ahora: Date,
  pedir: PedirVeredicto,
  o: OpcionesDeAuditoria,
): Promise<Omit<ResultadoDeLaAuditoria, 'frenoDeLaEmpresa'>> {
  const reloj = o.reloj ?? Date.now;
  const hasta = o.hasta ?? Number.POSITIVE_INFINITY;
  const { decididos, hayMas } = await conOrganizacion(e.orgId, () => candidatosDecididos(ahora));

  const renglones: RenglonDelAnalisis[] = [];
  let llamadas = 0;
  let fallos = 0;

  for (const { candidato, decision } of decididos) {
    if (!decision.audita) continue;
    const { agente, disparo, alarmas, mensajesDelAgente } = decision;

    /* El presupuesto va ANTES del corta-circuito, y el orden importa para el reporte: si quedan
       fallos y además se acabó el tiempo, el renglón honesto es `sin_tiempo` —hay más trabajo que
       tiempo, se arregla en la corrida siguiente— y no `abandonado`, que manda a investigar. */
    if (reloj() >= hasta) {
      renglones.push({ contactoId: candidato.contactoId, agente, final: 'sin_tiempo' });
      continue;
    }
    if (fallos >= TOPE_DE_FALLOS) {
      renglones.push({ contactoId: candidato.contactoId, agente, final: 'abandonado' });
      continue;
    }

    /* ── 3a–3d · TODO LO QUE NO CUESTA, EN UNA TRANSACCIÓN ────────────────
     *
     * Una por contacto y no una para toda la corrida: con una sola, un fallo en el contacto siete
     * revertiría los seis análisis anteriores — seis inferencias pagadas y tiradas. Y una transacción
     * abierta mientras se habla con el proveedor retiene una conexión del agrupador durante todas las
     * llamadas, que es justo lo que el encabezado de `pulso.ts` prohíbe. */
    const preparado = await conOrganizacion(e.orgId, async () => {
      const mensajes = await mensajesDelContacto(candidato.contactoId);
      const hechos = medirHechos(mensajes, idDelAgente, ahora);

      // ── 3c · EL PORTÓN 5. Corta ANTES del modelo: acá no se gastó nada. ──
      const porque = porQueNoSeAudita(hechos);
      if (porque !== null) {
        const escrito = await escribirAnalisis({
          tipo: 'no_auditable',
          contactoId: candidato.contactoId,
          agente,
          disparo,
          alarmas,
          mensajesDelAgente,
          porque,
          hechos,
        });
        return { tipo: 'no_auditable' as const, porque, escrito };
      }

      const transcript = armarTranscript(mensajes, e.zona, idDelAgente);
      const prompt = await leerPromptDelAgente(agente);
      const patrones = await patronesDelAgente(agente);
      return {
        tipo: 'listo' as const,
        hechos,
        instrucciones: instruccionesDelAuditor({
          agente,
          promptDelAgente: prompt === null ? null : prompt.texto,
        }),
        promptHash: prompt === null ? null : prompt.hash,
        patrones,
        conversacion: textoDeLaConversacion({ hechos, transcript: transcript.texto }),
      };
    });

    if (preparado.tipo === 'no_auditable') {
      renglones.push({
        contactoId: candidato.contactoId,
        agente,
        final: 'no_auditable',
        porque: preparado.porque,
      });
      continue;
    }

    // ── 3e · EL MODELO. **Acá, y solo acá, se gasta.** ───────────────────
    llamadas += 1;
    const r = await pedir({
      claveIa,
      agente,
      instrucciones: preparado.instrucciones,
      patrones: preparado.patrones,
      conversacion: preparado.conversacion,
    });

    if (r.tipo !== 'datos') {
      /* Los CINCO finales de fallo cuentan igual para el corta-circuito y **se reportan distinto**:
         colapsarlos mandaría a la investigación equivocada — un truncado manda a subir el techo de
         tokens, una estructura inválida manda a revisar el esquema, y un rechazo del proveedor manda
         a mirar la clave. Los dos que traen detalle lo llevan al renglón. */
      fallos += 1;
      renglones.push({
        contactoId: candidato.contactoId,
        agente,
        final: 'fallo_del_modelo',
        porque: porqueFallo(r),
      });
      continue;
    }

    // ── 3f · LA ESCRITURA, en su propia transacción. ─────────────────────
    const escrito = await conOrganizacion(e.orgId, () =>
      escribirAnalisis({
        tipo: 'veredicto',
        contactoId: candidato.contactoId,
        agente,
        disparo,
        alarmas,
        mensajesDelAgente,
        veredicto: r.datos.veredicto,
        modelo: MODELO_DEL_AUDITOR,
        promptHash: preparado.promptHash,
      }),
    );

    renglones.push({
      contactoId: candidato.contactoId,
      agente,
      final: 'analizado',
      nivel: escrito.nivel,
      intervencion: escrito.intervencion,
      hallazgos: escrito.hallazgos,
      ...(escrito.descartados.length > 0 ? { porque: escrito.descartados.join('; ') } : {}),
    });
  }

  return {
    candidatos: decididos.length,
    llamadas,
    cortoCircuito: fallos >= TOPE_DE_FALLOS,
    /* `hayMas` junta las DOS formas de quedar corto: el tope de candidatos y el de tiempo. Las dos
       significan lo mismo para quien mira —quedó trabajo sin hacer— y las dos se arreglan en la
       corrida siguiente. El renglón de cada contacto sí las distingue. */
    hayMas: hayMas || renglones.some((r) => r.final === 'sin_tiempo'),
    renglones,
  };
}
