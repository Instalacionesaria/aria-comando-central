// EL PROMPT DE CADA AGENTE, por empresa. Leer, guardar y borrar.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL HASH SE RECALCULA DEL TEXTO. LA COLUMNA NO SE LEE PARA COMPARAR.
//
// La tabla guarda un `prompt_hash`, y **este archivo no lo usa para nada al leer**: lo recalcula del
// texto en cada lectura.
//
// No es desconfianza abstracta. Ese hash decide una cosa concreta en la pantalla del técnico —*«el
// prompt cambió desde que se escribió este hallazgo»*— y el modo de fallo de leerlo de la columna es
// exactamente el que no se nota: cualquier escritura futura que se olvide de actualizarla deja **todos
// los hallazgos viejos pasando por vigentes para siempre**, sin un error, sin una fila rara, y con la
// pantalla mostrando correcciones que ya no aplican a ningún texto.
//
// Recalculándolo, el hash es una función del texto y no puede desincronizarse de él. La columna queda
// como lo que honestamente es: **el hash que tenía cuando se guardó**, que es el dato con el que se
// compara el de un hallazgo.
//
// ── VACIAR ES BORRAR, Y ES AL REVÉS QUE EN UNA CREDENCIAL ───────────────────
//
// En `lib/credenciales/` un campo que llega vacío **no toca** el secreto guardado: un formulario que
// se manda con el token en blanco no debe desconectarle la cuenta a nadie.
//
// Acá es al contrario, y tiene que ser al contrario: vaciar el texto es **el único gesto disponible**
// para decir «este agente vuelve a no tener prompt de referencia». Sin él no habría forma de deshacer
// una carga, y la única salida sería dejar un prompt que la empresa ya no quiere.
//
// Y la base lo respalda: un `check` hace que una fila con el texto en blanco sea **inescribible**, así
// que el estado «hay fila y no hay prompt» no existe. Sin eso, el auditor entraría a la rama «con
// prompt» a buscar fragmentos en cero caracteres.
//
// ── NO SE CACHEA, Y ADEMÁS EL CACHÉ ERA EL DEFECTO ──────────────────────────
//
// El diseño de origen tenía un caché indexado por empresa+agente. Acá `ADR-0703` prohíbe cualquier
// estructura mutable en el nivel superior de un módulo del servidor, así que el prompt se lee de la
// base en cada análisis: **una consulta contra una llamada al modelo que tarda segundos**.
//
// Y el defecto que ese caché causaba desaparece de arriba: no puede haber una instancia caliente
// sirviéndole el prompt de una empresa al auditor de otra.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto';
import { datos } from '../datos/contexto.ts';
import { AGENTES, type Agente } from './veredicto.ts';

/**
 * El hash de un prompt. **Del texto, siempre.**
 *
 * Se usa para comparar dos versiones del mismo prompt, no como identificador ni como secreto, así que
 * los 16 caracteres alcanzan y hacen que quepa en una pantalla. `sha256` porque es el que ya usa el
 * resto del repositorio.
 *
 * Y hashea el texto **recortado**, así que el hash es del contenido y no de los espacios que lo
 * rodean. Conviene decir con precisión qué compra eso, porque es menos de lo que parece: **por el
 * camino de la base hoy no cambia nada**, ya que el escritor recorta antes de guardar y la lectura
 * hashea un texto que ya viene recortado.
 *
 * Lo que compra es el otro camino: quien compare el hash guardado de un hallazgo contra un texto que
 * viene de un formulario **no tiene que acordarse de recortarlo**. Sin esta línea, un salto de línea
 * de más al final del cuadro de texto haría que la pantalla avise de un cambio que no hubo, y un aviso
 * falso enseña a ignorar los verdaderos. Es una propiedad de la función, no un defecto que hubo.
 */
export function hashDelPrompt(texto: string): string {
  return createHash('sha256').update(texto.trim(), 'utf8').digest('hex').slice(0, 16);
}

/** Un prompt cargado. **Nunca vacío**: la ausencia se representa con `null`, no con esto. */
export interface PromptDelAgente {
  agente: Agente;
  texto: string;
  /** Recalculado del texto. **No es la columna.** */
  hash: string;
  actualizadoEl: Date;
}

/**
 * El prompt de un agente, o `null` si esa empresa no le cargó ninguno.
 *
 * `null` es **un estado normal y esperado**, no un fallo: en la plataforma anterior los cuatro
 * espacios estaban vacíos, así que sus 59 análisis salieron todos por esta rama. Quien llama tiene que
 * tratarla como el caso frecuente — `lib/auditor/rubrica.ts` lo hace.
 *
 * Corre **dentro** de un contexto de organización: el aislamiento lo aplica la política de la base
 * sobre `app.org_id`, y por eso acá no hay un `where org_id =`.
 */
export async function leerPromptDelAgente(agente: Agente): Promise<PromptDelAgente | null> {
  const fila = await datos()
    .selectFrom('prompts_del_agente')
    .select(['texto', 'actualizado_el'])
    .where('agente', '=', agente)
    .executeTakeFirst();

  if (fila === undefined) return null;
  return {
    agente,
    texto: fila.texto,
    hash: hashDelPrompt(fila.texto),
    actualizadoEl: fila.actualizado_el,
  };
}

/**
 * Los prompts de TODOS los agentes de la empresa. Para la pantalla del técnico.
 *
 * Devuelve una entrada por agente que exista, **con `null` en los que no tienen prompt**, y no solo
 * las filas que hay. La diferencia importa: una lista de filas hace que la pantalla no pueda
 * distinguir «este agente no tiene prompt» de «este agente no existe», y ése es el defecto `4.1` del
 * origen otra vez —*«declaraba a los dos auditores de voz como sin auditor cuando ya lo tenían»*—
 * pero llegando por la interfaz en vez de por el esquema.
 */
export async function leerLosPrompts(): Promise<Readonly<Record<Agente, PromptDelAgente | null>>> {
  const filas = await datos()
    .selectFrom('prompts_del_agente')
    .select(['agente', 'texto', 'actualizado_el'])
    .execute();

  const porAgente = new Map(filas.map((f) => [f.agente, f]));
  const salida = {} as Record<Agente, PromptDelAgente | null>;
  for (const agente of AGENTES) {
    const f = porAgente.get(agente);
    salida[agente] =
      f === undefined
        ? null
        : {
            agente,
            texto: f.texto,
            hash: hashDelPrompt(f.texto),
            actualizadoEl: f.actualizado_el,
          };
  }
  return salida;
}

/** Qué pasó al guardar. Lo devuelve el escritor para que la interfaz diga lo que ocurrió. */
export type QuePasoAlGuardar = 'guardado' | 'borrado' | 'no_habia_nada';

/**
 * Guarda el prompt de un agente. **Un texto en blanco BORRA la fila.**
 *
 * Ver el encabezado: es al revés que en una credencial, y es a propósito.
 *
 * Devuelve `'no_habia_nada'` cuando se pidió borrar y no había fila. **No es un error**: quien vacía
 * un campo que ya estaba vacío consiguió lo que quería. Devolver un fallo ahí obligaría a la interfaz
 * a mostrar un error rojo por una operación que salió bien, y ése es el camino por el que la gente
 * aprende a ignorar los errores de una pantalla.
 *
 * `on conflict` sobre `(org_id, agente)` y no un `select` previo: la restricción única ya está en la
 * base, así que dos guardados simultáneos terminan con una fila y no con dos. Con la lectura previa
 * habría una ventana en la que los dos ven «no hay fila» y los dos insertan.
 *
 * @param quien Quién lo editó, para el rastro. `null` cuando no lo escribió una persona.
 */
export async function guardarPromptDelAgente(
  agente: Agente,
  texto: string,
  quien: string | null,
): Promise<QuePasoAlGuardar> {
  const limpio = texto.trim();

  if (limpio === '') {
    const r = await datos()
      .deleteFrom('prompts_del_agente')
      .where('agente', '=', agente)
      .executeTakeFirst();
    return Number(r.numDeletedRows ?? 0) > 0 ? 'borrado' : 'no_habia_nada';
  }

  await datos()
    .insertInto('prompts_del_agente')
    .values({
      agente,
      texto: limpio,
      prompt_hash: hashDelPrompt(limpio),
      actualizado_por: quien,
    } as never)
    /* La columna `actualizado_el` tiene `default now()` y en el camino del conflicto **hay que
       escribirla a mano**: un `default` solo se aplica al insertar, así que sin esto la fecha se
       quedaría en la del primer guardado y la pantalla mostraría un prompt editado hoy como si fuera
       de hace meses. */
    .onConflict((oc) =>
      oc.columns(['org_id', 'agente']).doUpdateSet({
        texto: limpio,
        prompt_hash: hashDelPrompt(limpio),
        actualizado_por: quien,
        actualizado_el: new Date(),
      } as never),
    )
    .execute();

  return 'guardado';
}
