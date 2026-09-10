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

import type { Trx } from '../datos/capa.ts';
import { conOrganizacion, datos, hayOrganizacion, organizacionActual } from '../datos/contexto.ts';
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

/** Escribe una columna de la fila de la organización, creando la fila si no existía. */
async function escribir(orgId: string, columna: string, valor: unknown): Promise<ResultadoDeAlmacen<null>> {
  // `JSON.stringify` y no el objeto: el controlador de Postgres serializa un objeto igual, pero un
  // arreglo lo mandaría como arreglo de Postgres y no como JSON. El texto es JSON siempre.
  const json = JSON.stringify(valor);
  const r = await enOrganizacion(orgId, async (db) => {
    await db
      .insertInto(TABLA)
      .values({ org_id: orgId, [columna]: json } as never)
      .onConflict((oc) =>
        oc.column('org_id').doUpdateSet({ [columna]: json, actualizado_el: new Date() } as never),
      )
      .execute();
    return null;
  });
  return r;
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
  const version = typeof o['agent_version'] === 'number' ? o['agent_version'] : undefined;
  return version === undefined
    ? { messages: mensajes, answers: respuestas }
    : { messages: mensajes, answers: respuestas, agent_version: version };
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

/** Guarda los inputs de una herramienta, mezclándolos con los de las demás. */
export async function guardarInputs(
  orgId: string,
  estado: EstadoDeFundaciones,
  id: number,
  inputs: Record<string, string>,
): Promise<ResultadoDeAlmacen<null>> {
  const proximo: Record<number, Record<string, string>> = { ...estado.perfil, [id]: inputs };
  return escribir(orgId, LLAVES.perfil, proximo);
}

/** Cuántas versiones se conservan por herramienta. El hub usaba diez; se conserva el número. */
export const MAX_VERSIONES = 10;

/** Agrega una versión al historial de una herramienta y lo guarda. */
export async function guardarVersion(
  orgId: string,
  estado: EstadoDeFundaciones,
  id: number,
  version: Version,
): Promise<ResultadoDeAlmacen<null>> {
  const previas = estado.historial[id];
  const lista = previas ? [version, ...previas] : [version];
  const proximo: Record<number, Version[]> = {
    ...estado.historial,
    [id]: lista.slice(0, MAX_VERSIONES),
  };
  return escribir(orgId, LLAVES.historial, proximo);
}

/** Guarda los criterios y las salidas del Research (una sola columna, las dos cosas juntas). */
export async function guardarResearch(
  orgId: string,
  inputs: Record<string, string>,
  salidas: string[],
): Promise<ResultadoDeAlmacen<null>> {
  return escribir(orgId, LLAVES.research, { inputs, outputs: salidas });
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
 * Y se relee el estado antes de escribir por lo mismo que `guardarInputs`: las nueve conversaciones
 * viven en UNA columna, así que escribir solo con la que cambió borraría las otras ocho — en
 * silencio.
 */
export async function guardarChat(
  orgId: string,
  estado: EstadoDeFundaciones,
  id: number,
  chatDeHerramienta: ChatDeHerramienta,
): Promise<ResultadoDeAlmacen<null>> {
  const proximo: Record<number, ChatDeHerramienta> = { ...estado.chats, [id]: chatDeHerramienta };
  return escribir(orgId, LLAVES.chats, proximo);
}

/** La fecha con el formato que escribía el hub, para que el historial copiado se lea igual. */
export function fechaDeVersion(): string {
  return new Date().toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
}
