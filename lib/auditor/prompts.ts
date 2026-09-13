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
import { sql } from 'kysely';
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
 *
 * ── ESTE UPSERT Y ESTE DELETE ARCHIVAN LA VERSIÓN QUE SALE ─────────────────
 *
 * Acá no hay ninguna línea que escriba `versiones_del_prompt`, y **no es un olvido**: lo hace un
 * disparador sobre la tabla (migración `046`). Es el precio declarado de esa decisión —un escritor
 * que no aparece en ningún `grep` de este archivo— y compra dos cosas que acá no se pueden tener:
 * que cualquier camino de escritura futuro archive aunque nadie se acuerde, y que no haga falta leer
 * la fila antes de pisarla, que es lo que reabriría la carrera que el `on conflict` ya cerró.
 *
 * La ATOMICIDAD del par la garantiza el llamador: el disparador corre dentro de la transacción que
 * abrió `conOrganizacion(`.
 */
export async function guardarPromptDelAgente(
  agente: Agente,
  texto: string,
  quien: string | null,
): Promise<QuePasoAlGuardar> {
  const limpio = texto.trim();

  if (limpio === '') {
    /* QUIÉN BORRÓ. Es el único dato que el disparador de la `046` no puede sacar de la fila: un
       `delete` no lleva autor. Hoy este parámetro `quien` **no se usa en esta rama**, así que «quién
       le vació el prompt al agente el martes» es irrecuperable por completo.

       Viaja por una variable de TRANSACCIÓN, el mismo mecanismo y el mismo alcance que `app.org_id`:
       muere con la transacción que abrió `conOrganizacion(`, así que no puede filtrarse a la petición
       siguiente por una conexión reutilizada.

       Y se LIMPIA después, que es la mitad que no es obvia: `set_config(..., true)` dura hasta el
       final de la TRANSACCIÓN, no de la sentencia. Sin la limpieza, un segundo borrado en la misma
       transacción que no la ponga no leería nulo: leería el valor anterior y le atribuiría el vaciado
       a la persona EQUIVOCADA. Un nombre falso es peor que un nulo — es la misma regla que la `044`
       escribió para `fuente`. Con la limpieza, olvidarse degrada a nulo. */
    await sql`select set_config('app.quien_toca_el_prompt', ${quien ?? ''}, true)`.execute(datos());
    const r = await datos()
      .deleteFrom('prompts_del_agente')
      .where('agente', '=', agente)
      .executeTakeFirst();
    await sql`select set_config('app.quien_toca_el_prompt', '', true)`.execute(datos());
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
    /* ── Y DESDE LA `046`, DOS COSAS MÁS ───────────────────────────────────
     *
     * 1 · Se escribe con **`now()` de la base** y no con el reloj de Node. `now()` es la hora de
     *     INICIO de la transacción, y el disparador estampa `reemplazada_el` con el mismo `now()` en
     *     la misma transacción: así el instante en que una versión deja de regir y el instante en que
     *     empieza la siguiente son EL MISMO, y la línea de tiempo queda contigua por construcción.
     *     Con dos relojes —Vercel y Supabase— cada costura tendría un desfase de signo desconocido: o
     *     dos versiones afirmando estar vigentes a la vez, o un hueco en el que no corría ninguna.
     *
     * 2 · El **`where`**: si el texto que llega es el mismo que ya está, no se toca la fila. Sin esto
     *     un reguardado idéntico mueve `actualizado_el`, y entonces la versión que se archive después
     *     nace afirmando que empezó a regir el día del reguardado en vez del día real — la misma
     *     mentira que la `046` viene a impedir, fabricada por el propio arreglo.
     *
     *     Y es alcanzable con una tecla, no en teoría: el freno de hoy es el botón deshabilitado del
     *     navegador (`components/auditoria/PanelDeAuditoria.jsx`: `texto !== (p.texto ?? '')`), que
     *     compara SIN recortar mientras acá se recorta — un salto de línea al final lo habilita y
     *     manda el mismo texto.
     *
     *     Se compara TEXTO contra texto y no hash contra hash: el hash es un sha256 recortado a 16
     *     caracteres que este mismo archivo declara que no es un identificador, y la comparación
     *     exacta está disponible gratis acá. Y sólo contra la fila que se reemplaza, jamás contra el
     *     resto del historial: deduplicar contra una versión anterior dejaría la línea de tiempo
     *     afirmando que el prompt fue B desde el martes, que es una respuesta falsa a la única
     *     pregunta que esa tabla contesta.
     *
     *     Lo que cuesta, dicho: «volvió a guardar sin cambiar nada» deja de tener rastro. Se acepta,
     *     porque eso no es una versión. */
    .onConflict((oc) =>
      oc
        .columns(['org_id', 'agente'])
        .doUpdateSet({
          texto: limpio,
          prompt_hash: hashDelPrompt(limpio),
          actualizado_por: quien,
          actualizado_el: sql`now()`,
        } as never)
        .where(sql`prompts_del_agente.texto`, 'is distinct from', sql`excluded.texto`),
    )
    .execute();

  return 'guardado';
}
