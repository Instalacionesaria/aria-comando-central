// El almacén del estado de Fundaciones. **Vive fuera de la base de este proyecto.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA DECISIÓN, Y LO QUE CUESTA
//
// Las siete herramientas leen y escriben en `aria_brain_client_state`, la MISMA tabla que usa
// ARIA-brain hoy. La decisión es de la Etapa 9 y está tomada a la vista: el hub va a seguir en pie
// unos meses, los alumnos van a entrar por las dos puertas, y un alumno que genera su avatar acá y
// lo ve vacío allá no tiene forma de entender qué pasó. Compartir el almacén es lo que hace que
// las dos puertas den al mismo cuarto.
//
// Lo que cuesta, escrito para que nadie lo descubra después:
//
//   1. **El aislamiento de este proyecto no cubre estos datos.** No hay `org_id`, no hay política de
//      seguridad a nivel de fila, no hay `conOrganizacion(`. El filtro es la columna `cliente_id`
//      de la tabla ajena, y lo pone ESTA capa. Por eso `cliente_id` NUNCA llega del navegador: se
//      resuelve desde la organización de la sesión (`fundaciones_cliente_id`), igual que
//      `orgEfectiva`. Un `cliente_id` que viaje en el cuerpo de una petición es la fuga entera.
//   2. **La llave de servicio de Supabase pasa por acá.** Es una credencial de infraestructura
//      —una sola para todo el proyecto, como la cadena de conexión—, no una credencial POR
//      organización: lo que separa a una organización de otra es el `cliente_id`, no la llave.
//   3. **La migración a la base propia es un trabajo pendiente y nombrado.** Está en
//      `docs/ETAPA-9.md`. Este archivo es la única puerta: cuando llegue ese día, se reescribe
//      acá y las siete herramientas no se enteran.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedirExterno, type Respuesta } from '../http/cliente.ts';
import { LLAVES, estadoVacio, type EstadoDeFundaciones, type Version } from './estado.ts';

/** Lo que puede salir mal al hablar con el almacén. Tres cosas, no una. */
export type FalloDeAlmacen =
  | { tipo: 'sin_configurar'; detalle: string }
  | { tipo: 'rechazado'; estado: number }
  | { tipo: 'sin_respuesta'; causa: string };

export type ResultadoDeAlmacen<T> = { tipo: 'datos'; datos: T } | FalloDeAlmacen;

interface Conexion {
  url: string;
  llave: string;
}

/**
 * Las dos variables de entorno del almacén, o el fallo que las nombra.
 *
 * Sin `??` y sin valor por omisión: una cadena vacía produciría una URL como `/rest/v1/…` que el
 * `fetch` interpreta como relativa, la petición sale contra nuestro propio dominio, devuelve un 404
 * y el síntoma es *"el alumno no tiene nada guardado"*. Es el mismo defecto del `07` § 1 con otro
 * disfraz: un respaldo implícito que convierte "no está configurado" en "está vacío".
 */
function conexion(): Conexion | FalloDeAlmacen {
  const url = process.env.ALMACEN_HUB_URL;
  const llave = process.env.ALMACEN_HUB_LLAVE_SERVICIO;
  if (!url || !llave) {
    return {
      tipo: 'sin_configurar',
      detalle: 'Faltan ALMACEN_HUB_URL y ALMACEN_HUB_LLAVE_SERVICIO',
    };
  }
  return { url, llave };
}

function esFallo(x: Conexion | FalloDeAlmacen): x is FalloDeAlmacen {
  return 'tipo' in x;
}

function cabeceras(c: Conexion): Record<string, string> {
  return { apikey: c.llave, authorization: `Bearer ${c.llave}` };
}

const TABLA = 'aria_brain_client_state';

/** Traduce las tres ramas del cliente HTTP a las tres del almacén, sin colapsar ninguna. */
function traducir<T>(r: Respuesta<T>): ResultadoDeAlmacen<T> {
  if (r.tipo === 'datos') return { tipo: 'datos', datos: r.datos };
  if (r.tipo === 'rechazado') return { tipo: 'rechazado', estado: r.estado };
  return { tipo: 'sin_respuesta', causa: r.causa };
}

/**
 * Lee una llave. Una llave ausente devuelve `null` **como dato**, no como fallo.
 *
 * La distinción es la regla 2 del `07` § 0 y acá se paga a diario: "este alumno todavía no generó
 * su avatar" y "no pude preguntarle al almacén" tienen que ser dos cosas, o la pantalla muestra
 * formularios en blanco cuando en realidad hay un problema de red.
 */
async function leer(
  clienteId: string,
  llave: string,
): Promise<ResultadoDeAlmacen<unknown | null>> {
  const c = conexion();
  if (esFallo(c)) return c;

  const camino =
    `${c.url}/rest/v1/${TABLA}` +
    `?cliente_id=eq.${encodeURIComponent(clienteId)}` +
    `&key=eq.${encodeURIComponent(llave)}` +
    `&select=value`;

  const r = await pedirExterno<{ value: unknown }[]>(camino, { cabeceras: cabeceras(c) });
  const t = traducir(r);
  if (t.tipo !== 'datos') return t;
  const filas = Array.isArray(t.datos) ? t.datos : [];
  const primera = filas.length > 0 ? filas[0] : undefined;
  return { tipo: 'datos', datos: primera === undefined ? null : primera.value };
}

/** Escribe una llave, creándola o reemplazándola. */
async function escribir(
  clienteId: string,
  llave: string,
  valor: unknown,
): Promise<ResultadoDeAlmacen<null>> {
  const c = conexion();
  if (esFallo(c)) return c;

  const r = await pedirExterno<unknown>(
    `${c.url}/rest/v1/${TABLA}?on_conflict=cliente_id,key`,
    {
      metodo: 'POST',
      cabeceras: {
        ...cabeceras(c),
        prefer: 'resolution=merge-duplicates,return=minimal',
      },
      cuerpo: {
        cliente_id: clienteId,
        key: llave,
        value: valor,
        updated_at: new Date().toISOString(),
      },
    },
  );
  // `return=minimal` responde 201 con cuerpo vacío, y un cuerpo vacío no es JSON: el cliente lo
  // reporta como `sin_respuesta`. Es la única situación donde eso NO significa que algo falló.
  if (r.tipo === 'sin_respuesta' && r.causa === 'el cuerpo no es JSON') {
    return { tipo: 'datos', datos: null };
  }
  const t = traducir(r);
  return t.tipo === 'datos' ? { tipo: 'datos', datos: null } : t;
}

// ── Lectores tolerantes ──────────────────────────────────────────────────────
//
// Cada documento del almacén lo escribió otro sistema y puede venir a medias: un alumno de hace un
// año, una migración a mitad de camino, una llave que alguien editó a mano. Un lector que asume la
// forma perfecta convierte eso en una pantalla que no carga. Un lector tolerante lo convierte en un
// formulario vacío, que es recuperable.
//
// Lo que NO se tolera es confundir "vino mal" con "no vino": el fallo de red sigue siendo un fallo.

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
 * El estado completo del alumno.
 *
 * Se piden las cinco llaves **en paralelo**: son cinco filas de la misma tabla y la latencia de la
 * pantalla es la de la más lenta, no la suma. Si CUALQUIERA falla por red o por rechazo, se
 * devuelve ese fallo: un estado a medias haría que una herramienta creyera que no hereda nada y
 * generara el documento con marcadores `[COMPLETAR]` sobre datos que sí existen.
 */
export async function leerEstado(clienteId: string): Promise<ResultadoDeAlmacen<EstadoDeFundaciones>> {
  const llaves = [
    LLAVES.perfil,
    LLAVES.historial,
    LLAVES.research,
    LLAVES.researchProfundo,
    LLAVES.categoriaLegado,
  ] as const;

  const leidas = await Promise.all(llaves.map((ll) => leer(clienteId, ll)));
  for (const r of leidas) {
    if (r.tipo !== 'datos') return r;
  }
  const [crudoPerfil, crudoHistorial, crudoResearch, crudoProfundo, crudoCategoria] = leidas.map(
    (r) => (r.tipo === 'datos' ? r.datos : null),
  );

  const estado = estadoVacio();
  estado.perfil = porHerramienta(crudoPerfil, (v) => {
    const t = textos(v);
    return Object.keys(t).length > 0 ? t : null;
  });
  estado.historial = porHerramienta(crudoHistorial, versiones);

  const research = objeto(crudoResearch);
  estado.researchInputs = textos(research['inputs']);
  estado.researchSalidas = Array.isArray(research['outputs'])
    ? research['outputs'].map((s) => (typeof s === 'string' ? s : ''))
    : [];

  const profundo = objeto(crudoProfundo);
  estado.researchProfundo = typeof profundo['deep'] === 'string' ? profundo['deep'] : null;
  estado.researchCampo = typeof profundo['fieldAnalysis'] === 'string' ? profundo['fieldAnalysis'] : null;

  // El chat viejo de Categoría Única guardaba una lista de mensajes o un objeto con el entregable.
  // Solo el objeto trae algo heredable.
  const categoria = objeto(crudoCategoria);
  estado.categoriaLegado = typeof categoria['deliverable'] === 'string' ? categoria['deliverable'] : null;

  return { tipo: 'datos', datos: estado };
}

/** Guarda los inputs de una herramienta, mezclándolos con los de las demás. */
export async function guardarInputs(
  clienteId: string,
  estado: EstadoDeFundaciones,
  id: number,
  inputs: Record<string, string>,
): Promise<ResultadoDeAlmacen<null>> {
  const proximo: Record<number, Record<string, string>> = { ...estado.perfil, [id]: inputs };
  return escribir(clienteId, LLAVES.perfil, proximo);
}

/** Cuántas versiones se conservan por herramienta. El hub usa diez; se conserva el número. */
export const MAX_VERSIONES = 10;

/** Agrega una versión al historial de una herramienta y lo guarda. */
export async function guardarVersion(
  clienteId: string,
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
  return escribir(clienteId, LLAVES.historial, proximo);
}

/** Guarda los criterios y las salidas del Research (una sola llave, las dos cosas juntas). */
export async function guardarResearch(
  clienteId: string,
  inputs: Record<string, string>,
  salidas: string[],
): Promise<ResultadoDeAlmacen<null>> {
  return escribir(clienteId, LLAVES.research, { inputs, outputs: salidas });
}

/** La fecha con el formato que escribe el hub, para que el historial se lea igual en los dos. */
export function fechaDeVersion(): string {
  return new Date().toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
}
