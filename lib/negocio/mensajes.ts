// EL único escritor de `negocio.mensajes`. Ahora sí.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTE ARCHIVO CIERRA, Y ESTÁ EN PANTALLA HOY
//
// `lib/negocio/ingesta.ts` abre diciendo *«EL único escritor de `negocio.mensajes`»*, y era falso:
// el `POST` del chat —`app/api/contactos/[id]/mensajes/route.ts`— inserta directo en la tabla, sin
// pasar por ahí. Dos escritores, y uno de los dos afirmaba ser el único.
//
// Lo que eso produce, comprobado línea por línea:
//
//   1. Mandamos un mensaje. La respuesta de GoHighLevel **puede no traer el identificador**
//      (`lib/ghl/conversaciones.ts:406`: `texto(o.messageId) ?? (ids.length > 0 ? … : null)`), y
//      entonces la ruta fabrica uno: `propio:<contactoId>:<epoch>` (`:183`), marcado
//      `id_fabricado: true`.
//   2. Más tarde la ingesta lee esa conversación. Trae **también los salientes** —`ingesta.ts:309`,
//      `direccion: entrante ? 'entrante' : 'saliente'`— y el mensaje viene con su identificador REAL.
//   3. `unique (org_id, ghl_mensaje_id)` (`011:249`) es la única defensa que hay, y no salta: los dos
//      identificadores son distintos. Un fabricado **no puede colisionar nunca** con uno real.
//   4. → **DOS filas para UN mensaje**, las dos dibujadas en el chat, una debajo de la otra.
//
// Y no falla nada. No hay error, no hay registro, no hay contador que se mueva. El chat muestra el
// mensaje repetido y se lee como que alguien lo mandó dos veces.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA DEL GEMELO ES ASIMÉTRICA, Y LA ASIMETRÍA ES TODO
//
// La tentación es «si ya existe uno igual, no insertes». Eso **colapsa mensajes legítimos**: dos «ok»
// a tres minutos son dos mensajes, no uno, y esa gente escribe así todo el día. La regla que sirve
// distingue por el ORIGEN del identificador y no por el texto:
//
//   · un **fabricado** NO entra si su gemelo REAL ya está;
//   · un **real**, al entrar, BORRA los fabricados equivalentes;
//   · **nunca real ↔ real**. Dos identificadores reales son dos mensajes del proveedor, punto.
//
// El fabricado se reconoce por `id_fabricado = true` y **no por el prefijo `propio:`**. El motivo
// está escrito en `db/migraciones/013_ingesta_de_mensajes.sql:96-99`: la columna existe justamente
// para no tener que adivinar por la forma de una cadena que alguien puede cambiar.
//
// Y al reemplazar, el real **HEREDA `origen`, `autor` y `autor_usuario_id`** del fabricado. Sin esa
// herencia el arreglo introduce un defecto peor que el que cierra: la ingesta escribe
// `autor: 'agente'` para todo saliente sin fuente (`ingesta.ts:371-373`), así que el mensaje que
// escribió una persona con su nombre pasaría a decir que lo mandó el agente de IA — y eso no es una
// fila repetida, es una atribución falsa en el historial de una conversación con un cliente.
//
// ── EL ORDEN: SE INSERTA EL REAL, Y DESPUÉS SE BORRA EL FABRICADO ────────────
//
// Al revés parece más limpio y es peor. Si el proceso se corta entre las dos operaciones:
//
//   · con este orden queda una fila repetida — visible, molesta, y **recuperable**: la próxima
//     relectura de la conversación la vuelve a limpiar;
//   · con el orden inverso **el mensaje desaparece de la conversación** y no vuelve nunca, porque el
//     fabricado ya no está y el real no se insertó.
//
// Un duplicado se arregla; un mensaje perdido no se sabe que faltó.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { conOrganizacion, datos } from '../datos/contexto.ts';

/**
 * La ventana del gemelo.
 *
 * Diez minutos, y sale de la referencia porque allá está medido: es el hueco entre que mandamos el
 * mensaje y que la ingesta lo ve de vuelta con su identificador de verdad.
 *
 * Los dos bordes cuestan cosas distintas, y por eso el número importa:
 *
 *   · **Demasiado corto** y el gemelo no se reconoce: vuelve el duplicado que este archivo cierra.
 *   · **Demasiado largo** y un mensaje legítimo con el mismo texto —«ok», «gracias», «dale»— se come
 *     al anterior. Eso sí es pérdida de datos, y silenciosa.
 *
 * Ante la duda se prefiere el duplicado: se ve.
 */
export const VENTANA_DEL_GEMELO_MS = 10 * 60 * 1000;

/** Una fila de `negocio.mensajes`, tal como la escriben los dos escritores. */
export interface FilaDeMensaje {
  ghl_mensaje_id: string;
  ghl_conversacion_id: string | null;
  contacto_id: string;
  canal: string | null;
  direccion: 'entrante' | 'saliente';
  cuerpo: string | null;
  autor: 'contacto' | 'agente' | 'persona';
  autor_ghl_usuario_id?: string | null;
  autor_usuario_id?: string | null;
  enviado_el: Date;
  estado_entrega: string | null;
  estado_entrega_familia: 'en_curso' | 'entregado' | 'fallido' | 'desconocido';
  estado_entrega_revisado_el: Date | null;
  estado_entrega_el: Date | null;
  id_fabricado: boolean;
  /**
   * De dónde salió la fila. Los tres valores que se escriben hoy:
   *
   *   · `ingesta` — el barrido de conversaciones;
   *   · `propio`  — el `POST` del chat, o sea una persona de esta plataforma;
   *   · `aviso`   — el webhook del CRM. **Todavía sin escritor**: el valor está en el `check` de
   *     `013:113-115` desde el primer día y ninguna línea lo escribe. Cuando exista el receptor, es
   *     por acá que va a entrar, y por eso el tipo ya lo admite.
   */
  origen: 'ingesta' | 'propio' | 'aviso';
}

/** Lo que quedó escrito. Los dos números se informan porque miden cosas distintas. */
export interface Escritura {
  /** Filas que la base aceptó como nuevas o actualizó. */
  escritas: number;
  /**
   * Fabricados que se reemplazaron por su gemelo real, o que no se insertaron porque su gemelo ya
   * estaba. **Es el contador que hace visible el arreglo**: si sube, había un duplicado en camino.
   */
  gemelos: number;
  /**
   * Qué fila de la base REPRESENTA a cada mensaje del lote, indexado por su `ghl_mensaje_id`.
   *
   * ── POR QUÉ NO ES SIEMPRE «LA FILA QUE INSERTÉ» ────────────────────────
   *
   * Con la regla del gemelo, un mensaje fabricado cuyo real ya estaba **no se inserta** —y sin este
   * mapa, quien lo escribió recibiría un identificador nulo y la pantalla se quedaría sin la fila que
   * SÍ existe. Acá esa clave apunta al gemelo real, que es la respuesta correcta a «¿dónde quedó mi
   * mensaje?».
   *
   * Es la pieza que le permite al `POST` del chat dejar de insertar por su cuenta sin perder lo que
   * su respuesta tenía: el `id` y el `enviado_el` de la fila.
   */
  representantes: Map<string, { id: string; enviadoEl: Date }>;
}

/** Lo que hace falta saber de una fila que ya está en la base para decidir si es un gemelo. */
interface Candidato {
  id: string;
  direccion: string;
  cuerpo: string | null;
  enviado_el: Date;
  id_fabricado: boolean;
  origen: string;
  autor: string;
  autor_usuario_id: string | null;
}

/** La clave por la que dos filas son «el mismo mensaje»: mismo sentido y mismo texto. */
function claveDe(direccion: string, cuerpo: string | null): string {
  // `trim`, y no es cosmético: el `POST` del chat guarda `texto.trim()`
  // (`app/api/contactos/[id]/mensajes/route.ts`) y la ingesta guarda lo que manda el proveedor. Sin
  // esto, un espacio al final hace que el gemelo no se reconozca y vuelve el duplicado.
  return `${direccion} ${(cuerpo ?? '').trim()}`;
}

const cerca = (a: Date, b: Date): boolean =>
  Math.abs(a.getTime() - b.getTime()) <= VENTANA_DEL_GEMELO_MS;

/**
 * Escribir mensajes. **Corre FUERA de un contexto de organización: lo abre él.**
 *
 * Todas las filas tienen que ser del MISMO contacto. No es una comodidad: `fijarPiso` escribe la
 * frontera de cobertura de un contacto, y con filas de varios habría que decidir cuál — que es
 * exactamente la clase de decisión que no se toma bien en un bucle.
 *
 * @param opciones.fijarPiso `true` escribe `contactos.mensajes_desde_el` con la fecha más vieja del
 *   lote, **si todavía está nulo**. Y tiene que ser una opción, no un comportamiento:
 *   `mensajes_desde_el` se escribe con `coalesce` —o sea **una sola vez, para siempre**— y significa
 *   *«desde acá hacia adelante la conversación está completa»*. La ingesta puede afirmarlo porque
 *   leyó la conversación entera hacia atrás. Un escritor de UN mensaje suelto —el `POST` del chat, el
 *   webhook— **no**: fijaría el piso con su único mensaje y la ficha afirmaría tener una historia
 *   que no tiene, sin forma de corregirlo después.
 */
export async function escribirMensajes(
  orgId: string,
  filas: readonly FilaDeMensaje[],
  opciones: { fijarPiso: boolean },
): Promise<Escritura> {
  if (filas.length === 0) return { escritas: 0, gemelos: 0, representantes: new Map() };

  const contactoId = filas[0]!.contacto_id;
  if (filas.some((f) => f.contacto_id !== contactoId)) {
    // Se lanza y no se saltea: un lote mezclado es un error de quien llama, y saltear filas dejaría
    // mensajes sin escribir sin que nada lo diga.
    throw new Error('escribirMensajes: todas las filas tienen que ser del mismo contacto');
  }

  return conOrganizacion(orgId, async () => {
    /* ── LOS CANDIDATOS A GEMELO, EN UNA SOLA CONSULTA ───────────────────────
     *
     * Se traen las filas del contacto en la ventana del lote ensanchada por los dos lados, y se
     * comparan en memoria. Una consulta por fila serían cien consultas por conversación, y el
     * emparejamiento en SQL exigiría un `join` con `abs(extract(epoch …))` que no usa ningún índice.
     *
     * `enviado_el` tiene índice por contacto (`011:254`, `mensajes_por_contacto`), así que este
     * rango es barato. */
    const desde = new Date(
      filas.reduce((a, f) => Math.min(a, f.enviado_el.getTime()), Infinity) - VENTANA_DEL_GEMELO_MS,
    );
    const hasta = new Date(
      filas.reduce((a, f) => Math.max(a, f.enviado_el.getTime()), -Infinity) + VENTANA_DEL_GEMELO_MS,
    );

    const candidatos = (await datos()
      .selectFrom('mensajes')
      .select([
        'id',
        'direccion',
        'cuerpo',
        'enviado_el',
        'id_fabricado',
        'origen',
        'autor',
        'autor_usuario_id',
      ])
      .where('contacto_id', '=', contactoId)
      .where('enviado_el', '>=', desde)
      .where('enviado_el', '<=', hasta)
      .execute()) as unknown as Candidato[];

    const porClave = new Map<string, Candidato[]>();
    for (const c of candidatos) {
      const k = claveDe(c.direccion, c.cuerpo);
      porClave.set(k, [...(porClave.get(k) ?? []), c]);
    }

    /** El gemelo más CERCANO en el tiempo, entre los que cumplen la condición. */
    const gemeloDe = (f: FilaDeMensaje, fabricado: boolean): Candidato | undefined =>
      (porClave.get(claveDe(f.direccion, f.cuerpo)) ?? [])
        .filter((c) => c.id_fabricado === fabricado && cerca(c.enviado_el, f.enviado_el))
        .sort(
          (a, b) =>
            Math.abs(a.enviado_el.getTime() - f.enviado_el.getTime()) -
            Math.abs(b.enviado_el.getTime() - f.enviado_el.getTime()),
        )[0];

    let gemelos = 0;
    const representantes = new Map<string, { id: string; enviadoEl: Date }>();
    const aEscribir: FilaDeMensaje[] = [];
    /** Los fabricados que hay que borrar DESPUÉS de insertar su real, con lo que hay que heredar. */
    const aReemplazar: { viejo: Candidato; nuevo: FilaDeMensaje }[] = [];
    /** Para que dos reales del mismo lote no se peleen el mismo fabricado. */
    const tomados = new Set<string>();

    for (const f of filas) {
      if (f.id_fabricado) {
        // UN FABRICADO NO ENTRA si su real ya está: sería el duplicado, con los papeles al revés.
        // Pasa cuando la ingesta llegó antes que nuestro propio guardado.
        const real = gemeloDe(f, false);
        if (real !== undefined) {
          gemelos += 1;
          // El representante es el REAL. Devolver nada dejaría a quien escribió sin la fila que existe.
          representantes.set(f.ghl_mensaje_id, { id: real.id, enviadoEl: real.enviado_el });
          continue;
        }
        aEscribir.push(f);
        continue;
      }

      // UN REAL SIEMPRE ENTRA. Si tenía un fabricado, ese fabricado se va después — y el real hereda
      // su atribución, que es lo que impide que un mensaje escrito por una persona pase a decir que
      // lo mandó el agente.
      const viejo = gemeloDe(f, true);
      aEscribir.push(f);
      if (viejo !== undefined && !tomados.has(viejo.id)) {
        tomados.add(viejo.id);
        aReemplazar.push({ viejo, nuevo: f });
        gemelos += 1;
      }
    }

    let escritas = 0;
    if (aEscribir.length > 0) {
      /* El `on conflict` es el de la ingesta, tal cual, y su motivo sigue siendo el mismo: releer una
         conversación vieja resuelve entregas de paso y sin costo extra, y el `is distinct from` es lo
         que impide que cien filas se reescriban para no cambiar nada. */
      const escritasFilas = await datos()
        .insertInto('mensajes')
        .values(aEscribir as never)
        .onConflict((oc) =>
          oc
            .columns(['org_id', 'ghl_mensaje_id'])
            .doUpdateSet({
              estado_entrega: sql`excluded.estado_entrega`,
              estado_entrega_familia: sql`excluded.estado_entrega_familia`,
              estado_entrega_el: sql`excluded.estado_entrega_el`,
              estado_entrega_revisado_el: sql`excluded.estado_entrega_revisado_el`,
            } as never)
            .where(sql<boolean>`mensajes.estado_entrega is distinct from excluded.estado_entrega`),
        )
        .returning(['id', 'ghl_mensaje_id', 'enviado_el'])
        .execute();
      escritas = escritasFilas.length;

      /* Los representantes de lo que SÍ se insertó. Sale del `returning` y no de una relectura: una
         segunda consulta sería otro viaje y podría ver otra cosa.
         Ojo con el `on conflict do update ... where`: una fila cuyo estado de entrega NO cambió no
         vuelve en el `returning`, así que su clave queda sin representante. Eso es correcto y hay
         que decirlo: significa «esa fila ya estaba y no se tocó», y el único llamador que usa el
         mapa —el `POST` del chat— inserta un mensaje nuevo, que nunca cae en ese caso. */
      for (const e of escritasFilas as unknown as { id: string; ghl_mensaje_id: string; enviado_el: Date }[]) {
        representantes.set(e.ghl_mensaje_id, { id: e.id, enviadoEl: e.enviado_el });
      }
    }

    /* ── LA HERENCIA Y EL BORRADO, EN ESE ORDEN ──────────────────────────────
     *
     * Se hereda ANTES de borrar por una razón trivial y suficiente: después del `delete` el dato ya
     * no está. Y las dos van DESPUÉS del `insert` de arriba — ver el encabezado del archivo. */
    for (const { viejo, nuevo } of aReemplazar) {
      await datos()
        .updateTable('mensajes')
        .set({
          origen: viejo.origen,
          autor: viejo.autor,
          autor_usuario_id: viejo.autor_usuario_id,
        } as never)
        .where('ghl_mensaje_id', '=', nuevo.ghl_mensaje_id)
        .execute();
      await datos().deleteFrom('mensajes').where('id', '=', viejo.id).execute();
    }

    if (opciones.fijarPiso && aEscribir.length > 0) {
      // La frontera de cobertura de ESTE contacto. Sin ella, una ficha sin mensajes no se puede
      // distinguir de una que nadie leyó todavía, y la ficha diría «nunca escribió» de las dos.
      const menor = aEscribir.reduce(
        (a, f) => (f.enviado_el < a ? f.enviado_el : a),
        aEscribir[0]!.enviado_el,
      );
      await datos()
        .updateTable('contactos')
        .set({ mensajes_desde_el: sql`coalesce(mensajes_desde_el, ${menor})` } as never)
        .where('id', '=', contactoId)
        .execute();
    }

    return { escritas, gemelos, representantes };
  });
}
