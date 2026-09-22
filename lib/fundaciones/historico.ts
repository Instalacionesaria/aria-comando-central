// El histórico de conversaciones con el agente. **Escribe, y no puede romper un turno.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ RESUELVE, Y POR QUÉ NO ALCANZABA CON QUE ESTUVIERA EN SUPABASE
//
// La conversación viva vive en `aria_cc_foundations.tool_chats`: un casillero por herramienta que
// se **reescribe entero** en cada turno. Sí estaba en Supabase, y aun así no había histórico —un
// documento que se pisa no es un histórico—. Kevin, 2026-09-22, con el reporte de las empresas:
// *«cada empresa en cada sesión debería entrar y no se debería perder esa conversación anterior»*.
//
// Acá se archiva en `public.aria_cc_fundaciones_mensajes` (migración `019`): una fila por mensaje,
// que solo se agrega. Con eso, reabrir deja de significar «borrar» y pasa a significar «cerrar esta
// conversación y abrir otra».
//
// ── LA REGLA QUE MANDA SOBRE TODAS LAS DEMÁS DE ESTE ARCHIVO ────────────────
//
// **Un fallo del histórico NO puede costarle a nadie el turno que está escribiendo.** Hay clientes
// reales conversando ahí. Así que `archivar` no lanza NUNCA, devuelve `void`, y se llama DESPUÉS
// de que la conversación viva quedó guardada. Si la tabla no existe todavía —la migración se corre
// a mano—, si la base no contesta, o si un documento viene con otra forma, lo que pasa es que queda
// una línea en el registro del servidor y el chat sigue andando exactamente igual que antes.
//
// El precio es real y está elegido a conciencia: un archivado que falla se pierde en silencio para
// la persona. Por eso deja línea en el registro, que es donde se diagnostica esto (fue así como se
// encontró la llave de IA inválida de CONEKTIA el 2026-09-18).
//
// ── POR QUÉ SE EMPUJA LA LISTA COMPLETA EN CADA TURNO ───────────────────────
//
// Porque hace que archivar sea **idempotente**, y eso vale más que el ahorro. La clave primaria es
// `(org_id, conversacion_id, orden)` y el `insert` lleva `on conflict do nothing`: mandar los
// quince mensajes de una conversación cuando trece ya estaban inserta dos y descarta trece, sin
// preguntar. La alternativa —averiguar qué falta y mandar solo eso— es una comparación que, si se
// equivoca, duplica mensajes o los pierde; y equivocarse es fácil, porque el arreglo se reemplaza
// entero en cada reapertura.
//
// Dos filas por turno contra una lectura previa: la lectura costaría lo mismo y podría mentir.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto';

import type { Trx } from '../datos/capa.ts';
import { conOrganizacion, datos, hayOrganizacion, organizacionActual } from '../datos/contexto.ts';
import type { ChatDeHerramienta } from './estado.ts';

const TABLA = 'public.aria_cc_fundaciones_mensajes' as const;

/**
 * Cuántos mensajes se archivan de una vez.
 *
 * Una conversación no llega ni cerca —la más larga medida el 2026-09-22 son 17 mensajes, la de
 * Allpa en el Research— y el tope existe para que un documento absurdo (o adulterado a mano en el
 * Table Editor) no arme una sentencia de miles de parámetros. Se archiva la COLA, que es lo último
 * dicho: si alguna vez hubiera que recortar, perder el principio de una charla larguísima es menos
 * malo que perder lo que se acaba de decir.
 */
export const TOPE_DE_MENSAJES_POR_ARCHIVO = 500;

/**
 * El identificador de una conversación que no lo trae. **Derivado, no sorteado.**
 *
 * Sortearlo con `randomUUID()` haría que la misma conversación se archivara bajo un identificador
 * distinto en cada turno: el `on conflict` no reconocería nada, y el histórico mostraría la misma
 * charla repetida una vez por turno. Derivarlo de `(organización, herramienta)` lo hace estable.
 *
 * **La semilla tiene que decir exactamente lo mismo que la migración `019`**, que deriva así los
 * identificadores de las conversaciones que ya existían:
 *
 *     md5(f.org_id::text || ':' || t.k || ':fundaciones-019')::uuid
 *
 * `org_id::text` de Postgres sale en minúsculas, así que acá se baja a minúsculas antes de picar:
 * un identificador en mayúsculas daría otro hash y la misma conversación se archivaría dos veces.
 * Si esto cambia, cambia en los dos lados o el histórico se duplica.
 */
export function idDeConversacionDerivado(orgId: string, herramienta: number): string {
  const hex = createHash('md5')
    .update(`${orgId.trim().toLowerCase()}:${herramienta}:fundaciones-019`)
    .digest('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

/** El identificador de esta conversación: el que trae, o el derivado. */
export function idDeConversacion(
  chat: ChatDeHerramienta | undefined,
  orgId: string,
  herramienta: number,
): string {
  const propio = typeof chat?.conversation_id === 'string' ? chat.conversation_id.trim() : '';
  return propio === '' ? idDeConversacionDerivado(orgId, herramienta) : propio;
}

/** Una fila lista para insertar. Se arma aparte para poder probarla sin base. */
export interface MensajeArchivado {
  org_id: string;
  conversacion_id: string;
  orden: number;
  herramienta: number;
  rol: 'assistant' | 'user';
  contenido: string;
  agent_version: number | null;
  usuario_id: string | null;
}

/**
 * Las filas que le corresponden a una conversación.
 *
 * `orden` es el índice en el arreglo `messages` y no un contador propio: es lo que hace que el
 * mismo mensaje caiga siempre en la misma fila, que es de lo que depende toda la idempotencia.
 *
 * El autor va SOLO en los mensajes de la persona. En los del agente sería mentira —los escribió el
 * modelo— y en pantalla se leería como que alguien dijo algo que no dijo.
 */
export function filasDe(
  chat: ChatDeHerramienta | undefined,
  opciones: { orgId: string; herramienta: number; usuarioId?: string | null },
): MensajeArchivado[] {
  const mensajes = chat?.messages ?? [];
  if (mensajes.length === 0) return [];
  const conversacionId = idDeConversacion(chat, opciones.orgId, opciones.herramienta);
  const sello = typeof chat?.agent_version === 'number' ? chat.agent_version : null;
  const autor = typeof opciones.usuarioId === 'string' && opciones.usuarioId !== '' ? opciones.usuarioId : null;

  const filas: MensajeArchivado[] = [];
  mensajes.forEach((m, orden) => {
    if (m.role !== 'assistant' && m.role !== 'user') return;
    if (typeof m.content !== 'string' || m.content === '') return;
    filas.push({
      org_id: opciones.orgId,
      conversacion_id: conversacionId,
      orden,
      herramienta: opciones.herramienta,
      rol: m.role,
      contenido: m.content,
      agent_version: sello,
      usuario_id: m.role === 'user' ? autor : null,
    });
  });
  return filas.slice(-TOPE_DE_MENSAJES_POR_ARCHIVO);
}

/** Corre el trabajo con la organización abierta, reusando la que ya esté abierta si la hay. */
async function enOrganizacion<T>(orgId: string, trabajo: (db: Trx) => Promise<T>): Promise<T> {
  if (hayOrganizacion()) {
    const abierta = organizacionActual();
    if (abierta !== orgId) {
      throw new Error(`el contexto abierto es de la organización ${abierta}, no de ${orgId}`);
    }
    return trabajo(datos());
  }
  return conOrganizacion(orgId, () => trabajo(datos()));
}

/**
 * Archiva una conversación. **Nunca lanza.**
 *
 * Se le pasan las conversaciones que hay que conservar —la que se va y la que queda— y las empuja
 * enteras; el `on conflict do nothing` se encarga de que lo repetido no entre. Devuelve cuántas
 * filas se intentaron archivar, que es lo que la prueba puede mirar sin base.
 */
export async function archivar(
  orgId: string,
  conversaciones: readonly { herramienta: number; chat: ChatDeHerramienta | undefined }[],
  usuarioId?: string | null,
): Promise<void> {
  const filas = conversaciones.flatMap((c) =>
    filasDe(c.chat, { orgId, herramienta: c.herramienta, usuarioId }),
  );
  if (filas.length === 0) return;

  /* Se quitan las repetidas ANTES de mandarlas: dos conversaciones de la misma llamada pueden
     compartir mensajes —la que se archiva al reabrir y la que queda—, y Postgres rechaza un
     `insert` que traiga dos veces la misma clave primaria en el MISMO comando, con `on conflict` y
     todo («ON CONFLICT DO UPDATE command cannot affect row a second time» es su primo). Con
     `do nothing` no falla, pero tampoco hay por qué mandarlas. */
  const vistas = new Set<string>();
  const unicas = filas.filter((f) => {
    const llave = `${f.conversacion_id}:${f.orden}`;
    if (vistas.has(llave)) return false;
    vistas.add(llave);
    return true;
  });

  try {
    await enOrganizacion(orgId, async (db) => {
      await db
        .insertInto(TABLA)
        .values(unicas)
        .onConflict((oc) => oc.columns(['org_id', 'conversacion_id', 'orden']).doNothing())
        .execute();
      return null;
    });
  } catch (e) {
    /* Y acá termina todo fallo posible de este archivo. La línea nombra la organización y la
       herramienta para que se pueda ir a mirar esa conversación, y NO el contenido: `ADR-0407`
       prohíbe registrar cuerpos, y un mensaje de chat es exactamente eso. */
    const causa = e instanceof Error ? e.message : String(e);
    const cuales = conversaciones.map((c) => c.herramienta).join(', ');
    console.error(
      `historico: no se pudo archivar la conversación · org ${orgId} · herramienta(s) ${cuales} · ${causa}`,
    );
  }
}
