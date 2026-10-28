// El almacén del estado de Fundaciones. **Vive en la base de este proyecto, por organización.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// DE DÓNDE VIENE, Y QUÉ CAMBIÓ EL 2026-09-07
//
// Hasta hoy las nueve herramientas leían y escribían en `aria_brain_client_state`, la tabla de
// ARIA-brain, indexada por el ALUMNO DEL HUB. La decisión era de la Etapa 9 —los dos sistemas iban
// a convivir y el alumno tenía que ver lo mismo por las dos puertas— y tenía un costo que se pagó
// con un cliente real: una organización que nace en Comando Central **no existe en el hub**, así
// que no tenía ningún `cliente_id` que poner en «Alumno de Fundaciones», y la pantalla no abría.
// Kevin, con todas las letras: *«no sé por qué tendría el cliente poner su propio ID de Hub. El
// cliente solo debería preocuparse por poner su API Key de Anthropic»*.
//
// Ahora el estado vive en `public.aria_cc_foundations` —la tabla que la migración 004 creó para
// esto el 2026-08-26 y que nadie usaba—, UNA fila por organización, y la llave es `org_id`. Con
// eso:
//
//   1. **El aislamiento es el de todas las demás tablas del proyecto.** RLS forzada y la política
//      por `app.org_id` que `conOrganizacion(` fija. Ya no hay un segundo filtro que esta capa
//      tenga que poner a mano, ni una llave de servicio ajena que pase por acá.
//   2. **No hace falta ningún vínculo con el hub.** Una organización con su llave de IA cargada
//      genera. Sin nada más.
//   3. **ARIA-brain no se toca.** Su tabla sigue como estaba; lo que había de las organizaciones ya
//      vinculadas se copió UNA vez con `migraciones/011_foundations_sin_hub.sql`.
//
// Las columnas son las mismas llaves que escribía el hub (`LLAVES`, en `estado.ts`), con el mismo
// contenido: los lectores tolerantes de abajo no cambiaron, y los ids de herramienta siguen siendo
// los del hub porque son la llave de la herencia (ver `herramientas.ts`).
//
// ── DÓNDE CORRE CADA CONSULTA ─────────────────────────────────────────────────
//
// Toda consulta de negocio corre dentro de `conOrganizacion(`. Acá hay dos casos y los dos son
// deliberados:
//
//   · Las rutas de ESTADO abren el contexto ellas mismas —leer y guardar inputs es corto— y esta
//     capa lo reutiliza (`hayOrganizacion()`). Es lo que `ADR-0202` exige ver en la ruta.
//   · Las rutas que GENERAN o CONVERSAN no lo abren: una transacción abierta durante los minutos
//     que tarda el modelo retiene una conexión del agrupador por nada. Esta capa abre una corta
//     por cada lectura y cada escritura, con el `org_id` que la ruta ya resolvió del portero.
//
// En los dos casos el `org_id` sale de la sesión y **nunca del navegador**.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import type { Trx } from '../datos/capa.ts';
import { conOrganizacion, datos, hayOrganizacion, organizacionActual } from '../datos/contexto.ts';
import { archivar, idDeConversacion } from './historico.ts';
import { leerMercado, type MercadoReal } from './mercado.ts';
import { leerOnboarding } from './onboarding.ts';
import {
  LLAVES,
  estadoVacio,
  type ChatDeHerramienta,
  type EstadoDeFundaciones,
  type MensajeDeChat,
  type Version,
} from './estado.ts';

/**
 * Lo que puede salir mal al hablar con el almacén.
 *
 * `sin_configurar` es la base sin cadena de conexión; `sin_respuesta` es todo lo demás que la base
 * pueda decir. Se conservan como dos porque llevan a dos personas distintas: la primera es del
 * despliegue, la segunda hay que mirarla en el registro.
 */
export type FalloDeAlmacen =
  | { tipo: 'sin_configurar'; detalle: string }
  | { tipo: 'sin_respuesta'; causa: string };

export type ResultadoDeAlmacen<T> = { tipo: 'datos'; datos: T } | FalloDeAlmacen;

const TABLA = 'public.aria_cc_foundations' as const;

/**
 * Corre `trabajo` con la transacción de la organización, abriéndola si hace falta.
 *
 * Si ya hay un contexto abierto tiene que ser EL DE ESTA organización: un contexto ajeno no se
 * reutiliza ni se anida en silencio — se rechaza, porque leería el trabajo de otra.
 */
async function enOrganizacion<T>(
  orgId: string,
  trabajo: (db: Trx) => Promise<T>,
): Promise<ResultadoDeAlmacen<T>> {
  try {
    if (hayOrganizacion()) {
      const abierta = organizacionActual();
      if (abierta !== orgId) {
        throw new Error(`el contexto abierto es de la organización ${abierta}, no de ${orgId}`);
      }
      return { tipo: 'datos', datos: await trabajo(datos()) };
    }
    return { tipo: 'datos', datos: await conOrganizacion(orgId, () => trabajo(datos())) };
  } catch (e) {
    const causa = e instanceof Error ? e.message : String(e);
    if (/DATABASE_URL/.test(causa)) return { tipo: 'sin_configurar', detalle: causa };
    return { tipo: 'sin_respuesta', causa };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * CADA GUARDADO TOCA SÓLO SU PEDAZO, Y LO MEZCLA EN LA BASE (2026-10-28)
 *
 * Hasta hoy cada guardado reescribía la columna ENTERA con lo que se había leído al empezar. Generar
 * y conversar leen, esperan al modelo segundos o minutos, y recién después escriben: lo que otra
 * persona —u otra herramienta de la cadena «Construir el método»— guardó en esa ventana se perdía
 * sin ningún error, versiones pagadas incluidas (la investigación de `datos()`, confirmado 1).
 *
 * Ahora cada guardado manda sólo las llaves que cambió y la base las mezcla con lo que hay EN ESE
 * MOMENTO (`||` de jsonb, en la misma sentencia, con la fila bloqueada por el `on conflict`):
 *   · los inputs, el chat o las versiones de UNA herramienta tocan sólo su llave (`"3"`);
 *   · el Research toca sólo `inputs`, `outputs` o `mercado`;
 *   · una versión nueva se agrega ADELANTE de las que haya en la base, no de las que se leyeron.
 * El formato del documento no cambia: quien lo lea (el hub, otra app) lo ve igual que antes.
 * Lo que queda a propósito (decidido por el usuario): dos turnos simultáneos sobre el chat de la MISMA
 * herramienta se quedan con el último en el chat vivo. Ninguno de los dos textos se pierde, pero
 * quedan en lugares distintos: el histórico archiva por (conversación, posición) con `on conflict do
 * nothing`, así que guarda el turno que archivó PRIMERO —que puede ser justo el que el chat vivo
 * descartó— y el otro queda sólo en el chat vivo (ver `historico.ts`).
 * Tampoco se cubre que dos pasos del Research terminen a la vez: cada uno escribe la lista de salidas
 * que armó con lo leído antes (la pantalla los corre en orden, uno después del otro). Y como ya no se
 * reescribe la columna entera, lo que un lector tolerante descarta (una versión rota heredada del hub)
 * queda en la base hasta que las versiones nuevas lo empujen fuera de las diez.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** La columna tal como está en la base, o un objeto vacío si no es un objeto (null o un documento roto). */
function columnaComoObjeto(columna: string) {
  const ref = sql.ref(`${TABLA}.${columna}`);
  return sql`(case when jsonb_typeof(${ref}) = 'object' then ${ref} else '{}'::jsonb end)`;
}

/**
 * Mezcla `parche` en las llaves de primer nivel de la columna, creando la fila si no existía.
 * Las llaves que el parche no nombra quedan como están EN LA BASE.
 */
async function fusionar(
  orgId: string,
  columna: string,
  parche: Record<string, unknown>,
): Promise<ResultadoDeAlmacen<null>> {
  // `JSON.stringify` y no el objeto: el controlador de Postgres serializa un objeto igual, pero un
  // arreglo lo mandaría como arreglo de Postgres y no como JSON. El texto es JSON siempre.
  const json = JSON.stringify(parche);
  return enOrganizacion(orgId, async (db) => {
    await db
      .insertInto(TABLA)
      .values({ org_id: orgId, [columna]: json } as never)
      .onConflict((oc) =>
        oc.column('org_id').doUpdateSet({
          [columna]: sql`${columnaComoObjeto(columna)} || ${json}::jsonb`,
          actualizado_el: new Date(),
        } as never),
      )
      .execute();
    return null;
  });
}

// ── Lectores tolerantes ──────────────────────────────────────────────────────
//
// Cada documento puede venir a medias: lo escribió el hub hace un año, lo copió la migración 011, o
// alguien lo editó a mano. Un lector que asume la forma perfecta convierte eso en una pantalla que
// no carga. Un lector tolerante lo convierte en un formulario vacío, que es recuperable.
//
// Lo que NO se tolera es confundir "vino mal" con "no vino": el fallo de la base sigue siendo un fallo.

function objeto(x: unknown): Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

function textos(x: unknown): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [k, v] of Object.entries(objeto(x))) {
    if (typeof v === 'string') salida[k] = v;
  }
  return salida;
}

/** `{"0": {...}, "3": {...}}` → `{0: {...}, 3: {...}}`, descartando lo que no encaje. */
function porHerramienta<T>(x: unknown, lee: (v: unknown) => T | null): Record<number, T> {
  const salida: Record<number, T> = {};
  for (const [k, v] of Object.entries(objeto(x))) {
    const id = Number(k);
    if (!Number.isInteger(id)) continue;
    const leido = lee(v);
    if (leido !== null) salida[id] = leido;
  }
  return salida;
}

/**
 * El chat del agente de UNA herramienta, leído con la misma desconfianza que todo lo demás.
 *
 * Un turno con un `role` que no es ninguno de los dos **se descarta**, y no se convierte en
 * `assistant` por omisión: un mensaje de la persona leído como si lo hubiera dicho el agente cambia
 * de quién es cada afirmación, y a partir de ahí el modelo contesta sobre una conversación que no
 * ocurrió. Descartarlo deja un hueco visible; traducirlo deja una mentira invisible.
 *
 * Devuelve `null` cuando el documento no tiene ni turnos ni respuestas, porque así lo pide
 * `porHerramienta(`: una entrada vacía no se guarda como una conversación que existe y está en
 * blanco.
 */
function chat(x: unknown): ChatDeHerramienta | null {
  const o = objeto(x);
  const mensajes: MensajeDeChat[] = [];
  const crudos = Array.isArray(o['messages']) ? o['messages'] : [];
  for (const item of crudos) {
    const m = objeto(item);
    const papel = m['role'];
    const texto = m['content'];
    if ((papel !== 'user' && papel !== 'assistant') || typeof texto !== 'string') continue;
    mensajes.push({ role: papel, content: texto });
  }
  const respuestas = textos(o['answers']);
  if (mensajes.length === 0 && Object.keys(respuestas).length === 0) return null;
  const leido: ChatDeHerramienta = { messages: mensajes, answers: respuestas };
  if (typeof o['agent_version'] === 'number') leido.agent_version = o['agent_version'];
  /* ── EL IDENTIFICADOR DE LA CONVERSACIÓN SE CONSERVA AL LEER ────────────────
     Este lector reconstruye el documento campo por campo, así que lo que no nombre se PIERDE en el
     próximo guardado — y perder `conversation_id` no se vería como un error: la conversación
     seguiría andando y el histórico la archivaría bajo un identificador nuevo en cada turno, o sea
     la misma charla repetida una vez por turno. Ver `historico.ts`. */
  if (typeof o['conversation_id'] === 'string' && o['conversation_id'].trim() !== '') {
    leido.conversation_id = o['conversation_id'];
  }
  return leido;
}

function versiones(x: unknown): Version[] | null {
  if (!Array.isArray(x)) return null;
  const salida: Version[] = [];
  for (const item of x) {
    const o = objeto(item);
    if (typeof o['output'] !== 'string') continue;
    const v: Version = { date: typeof o['date'] === 'string' ? o['date'] : '', output: o['output'] };
    const fuentes = o['sources'];
    if (fuentes !== null && fuentes !== undefined && typeof fuentes === 'object') {
      v.sources = fuentes as Version['sources'];
    }
    salida.push(v);
  }
  return salida;
}

/**
 * El estado completo de la organización.
 *
 * Es UNA fila con seis columnas, así que es una sola lectura. Sin fila = organización que todavía
 * no empezó: se devuelve el estado vacío COMO DATO, no como fallo. La distinción es la regla 2 del
 * `07` § 0 y acá se paga a diario: "todavía no generó su avatar" y "no pude leer la base" tienen
 * que ser dos cosas, o la pantalla muestra formularios en blanco cuando hay un problema real.
 */
export async function leerEstado(orgId: string): Promise<ResultadoDeAlmacen<EstadoDeFundaciones>> {
  const r = await enOrganizacion(orgId, (db) =>
    db
      .selectFrom(TABLA)
      .select([
        LLAVES.perfil,
        LLAVES.historial,
        LLAVES.research,
        LLAVES.researchProfundo,
        LLAVES.categoriaLegado,
        LLAVES.chats,
        LLAVES.onboarding,
      ])
      .where('org_id', '=', orgId)
      .executeTakeFirst(),
  );
  if (r.tipo !== 'datos') return r;
  const fila = objeto(r.datos);

  const estado = estadoVacio();
  estado.perfil = porHerramienta(fila[LLAVES.perfil], (v) => {
    const t = textos(v);
    return Object.keys(t).length > 0 ? t : null;
  });
  estado.historial = porHerramienta(fila[LLAVES.historial], versiones);

  const research = objeto(fila[LLAVES.research]);
  estado.researchInputs = textos(research['inputs']);
  estado.researchSalidas = Array.isArray(research['outputs'])
    ? research['outputs'].map((s) => (typeof s === 'string' ? s : ''))
    : [];
  // La mirada al mercado real, si el Research la hizo. Lector tolerante: un documento del hub no la
  // tiene y eso es `null`, no un fallo.
  estado.researchMercado = leerMercado(research['mercado']);

  estado.chats = porHerramienta(fila[LLAVES.chats], chat);

  const profundo = objeto(fila[LLAVES.researchProfundo]);
  estado.researchProfundo = typeof profundo['deep'] === 'string' ? profundo['deep'] : null;
  estado.researchCampo = typeof profundo['fieldAnalysis'] === 'string' ? profundo['fieldAnalysis'] : null;

  // El chat viejo de Categoría Única del hub guardaba una lista de mensajes o un objeto con el
  // entregable. Solo el objeto trae algo heredable.
  const categoria = objeto(fila[LLAVES.categoriaLegado]);
  estado.categoriaLegado = typeof categoria['deliverable'] === 'string' ? categoria['deliverable'] : null;

  /* El onboarding del formulario de Walter. Lo escribe un disparador de la base y lo lee el lector
     tolerante de `onboarding.ts`: un HTML con otra forma devuelve `null`, no una excepción. */
  estado.onboarding = leerOnboarding(fila[LLAVES.onboarding]);

  return { tipo: 'datos', datos: estado };
}

/** Guarda los inputs de UNA herramienta. Los de las demás quedan como estén en la base. */
export async function guardarInputs(
  orgId: string,
  id: number,
  inputs: Record<string, string>,
): Promise<ResultadoDeAlmacen<null>> {
  return fusionar(orgId, LLAVES.perfil, { [id]: inputs });
}

/** Cuántas versiones se conservan por herramienta. El hub usaba diez; se conserva el número. */
export const MAX_VERSIONES = 10;

/**
 * Agrega una versión ADELANTE del historial de una herramienta, conservando las `MAX_VERSIONES` más
 * nuevas. La lista que se alarga es la que está en la base al escribir, no la que se leyó antes de
 * generar: dos generaciones que terminan juntas dejan las dos versiones.
 */
export async function guardarVersion(
  orgId: string,
  id: number,
  version: Version,
): Promise<ResultadoDeAlmacen<null>> {
  const llave = String(id);
  const nueva = JSON.stringify(version);
  const columna = LLAVES.historial;
  const actual = sql`${columnaComoObjeto(columna)} -> ${llave}`;
  return enOrganizacion(orgId, async (db) => {
    await db
      .insertInto(TABLA)
      .values({ org_id: orgId, [columna]: JSON.stringify({ [llave]: [version] }) } as never)
      .onConflict((oc) =>
        oc.column('org_id').doUpdateSet({
          [columna]: sql`${columnaComoObjeto(columna)} || jsonb_build_object(${llave}::text, (
            select coalesce(jsonb_agg(v.elemento order by v.orden), '[]'::jsonb)
              from jsonb_array_elements(
                     jsonb_build_array(${nueva}::jsonb)
                     || (case when jsonb_typeof(${actual}) = 'array' then ${actual} else '[]'::jsonb end)
                   ) with ordinality as v(elemento, orden)
             where v.orden <= ${MAX_VERSIONES}))`,
          actualizado_el: new Date(),
        } as never),
      )
      .execute();
    return null;
  });
}

/**
 * Guarda lo que cambió del Research: los criterios (`inputs`), las salidas de los pasos (`outputs`)
 * y la mirada al mercado (`mercado`). **Sólo se tocan las partes que vienen**: una que no viene
 * queda como esté en la base. Así, guardar los criterios no pisa un paso que se está generando, y
 * un paso no pisa la mirada al mercado que se guardó mientras tanto.
 */
export async function guardarResearch(
  orgId: string,
  cambios: { inputs?: Record<string, string>; salidas?: string[]; mercado?: MercadoReal | null },
): Promise<ResultadoDeAlmacen<null>> {
  const parche: Record<string, unknown> = {};
  if (cambios.inputs !== undefined) parche['inputs'] = cambios.inputs;
  if (cambios.salidas !== undefined) parche['outputs'] = cambios.salidas;
  if (cambios.mercado !== undefined) parche['mercado'] = cambios.mercado;
  return fusionar(orgId, LLAVES.research, parche);
}

/** Guarda la mirada al mercado real. Los criterios y las salidas quedan como estén en la base. */
export async function guardarMercado(orgId: string, mercado: MercadoReal): Promise<ResultadoDeAlmacen<null>> {
  return guardarResearch(orgId, { mercado });
}

/**
 * Guarda la conversación del agente de UNA herramienta: los turnos y lo que lleva juntado.
 *
 * Las dos cosas van en la MISMA escritura, y no en dos, porque son un solo hecho: «después de este
 * turno, el agente sabe esto». Separarlas abre la ventana en la que los turnos ya están guardados y
 * las respuestas todavía no — y ahí la próxima llamada le manda al modelo una conversación en la que
 * ya preguntó el nicho, junto con un juego de respuestas donde el nicho está vacío. El modelo no
 * tiene forma de saber cuál de los dos miente.
 *
 * Las nueve conversaciones viven en UNA columna: se escribe sólo la llave de esta herramienta y la
 * base la mezcla con las otras ocho tal como estén al escribir (`fusionar`). `estado` sirve para
 * archivar la conversación que había antes.
 */
export async function guardarChat(
  orgId: string,
  estado: EstadoDeFundaciones,
  id: number,
  chatDeHerramienta: ChatDeHerramienta,
  /** Quién está escribiendo, para firmar sus mensajes en el histórico. Ver `historico.ts`. */
  usuarioId?: string | null,
): Promise<ResultadoDeAlmacen<null>> {
  /* ── EL IDENTIFICADOR SE ESTAMPA ACÁ, Y ES LO QUE HACE QUE NO SE DUPLIQUE ───
     Una conversación nueva nace con el suyo (`chatVacio`), pero las que ya existían —las de los
     clientes, desde antes de la migración `019`— no lo tienen. Si se archivaran sin él, cada turno
     derivaría el mismo identificador (bien) pero el documento nunca lo aprendería, y bastaría un
     cambio en la derivación para partir la conversación en dos. Estampándolo una vez, el documento
     pasa a ser la fuente y ya nadie tiene que derivar nada. */
  const sellado: ChatDeHerramienta = {
    ...chatDeHerramienta,
    conversation_id: idDeConversacion(chatDeHerramienta, orgId, id),
  };
  const guardado = await fusionar(orgId, LLAVES.chats, { [id]: sellado });

  /* ── Y RECIÉN AHORA EL HISTÓRICO, QUE NO PUEDE COSTAR UN TURNO ──────────────
     Después de guardar y sin `await` sobre su resultado en el camino de error: `archivar` no lanza
     nunca (ver su encabezado). Si el guardado falló, no se archiva: no hay nada confirmado que
     archivar, y la persona va a reintentar.

     Se archivan DOS conversaciones y por eso esto no es una llamada suelta:
       · la que está QUEDANDO, con el turno nuevo;
       · y la que había ANTES (`estado.chats[id]`), que en una reapertura es una conversación
         distinta —otro `conversation_id`— y cuyos mensajes están a punto de desaparecer del
         documento vivo. Sin esta segunda, «Empezar de nuevo» seguiría borrando de verdad. */
  if (guardado.tipo !== 'datos') return guardado;
  await archivar(orgId, [
    /* La que SE VA no lleva autor: sus mensajes son de turnos anteriores, quizá de otra persona de
       la empresa, y lo ya archivado conserva el suyo por el `on conflict do nothing`. */
    { herramienta: id, chat: estado.chats[id] },
    { herramienta: id, chat: sellado, usuarioId },
  ]);
  return guardado;
}

/** La fecha con el formato que escribía el hub, para que el historial copiado se lea igual. */
export function fechaDeVersion(): string {
  return new Date().toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
}
