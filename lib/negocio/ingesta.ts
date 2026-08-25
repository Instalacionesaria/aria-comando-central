// EL único escritor de `negocio.mensajes`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA RESTRICCIÓN, Y CÓMO SE DA VUELTA
//
// La búsqueda de conversaciones **ignora el filtro por etiqueta** y devuelve las 15.808 de la
// cuenta. Nuestros contactos son 239 —el 1,5 %—. Traerlas todas para quedarse con eso costaría 159
// llamadas por ciclo.
//
// Se ordenan en vez de filtrarse: `sort=asc` desde una marca de agua, y **el territorio se filtra en
// memoria** contra una sola consulta a nuestra tabla de contactos. El porqué de `asc` y no `desc`
// está en `lib/ghl/conversaciones.ts`, y se resume en que con `desc` la marca **no se puede
// mantener**.
//
// ── EL COSTE, DECLARADO ─────────────────────────────────────────────────────
//
//   **En régimen: 1 llamada.** La búsqueda, y nada cambió. Es el caso normal.
//   **Con actividad: 1 + k**, siendo `k` las conversaciones NUESTRAS que se movieron.
//   **Con envíos propios por confirmar: +2**, que es la tercera pasada yendo a buscar su estado.
//   **En el peor caso: 15**, y lo acotan los dos topes de abajo más el de `entregas.ts`.
//
// Ese `+2` no es un extra opcional: es lo único que descubre que un mensaje que el CRM aceptó
// terminó rechazado por el canal. Un mensaje que falla minutos después **no cambia la fecha de su
// conversación**, así que queda por debajo de la marca de agua y ninguna otra vía lo vuelve a mirar.
//
// ── POR QUÉ SE PIDEN LOS MENSAJES Y NO ALCANZA CON LA BÚSQUEDA ──────────────
//
// La búsqueda ya trae `lastMessageBody`, así que **tentaba** guardar ese texto y ahorrarse la
// llamada por conversación. Es lo que hace el Buzón, y ahí está bien porque el Buzón muestra
// exactamente eso: el último.
//
// Para el chat no alcanza. Entre dos ciclos pueden entrar tres mensajes, y guardando solo el último
// **los dos del medio no existirían para nadie**. El `03` § 7 ya nombra ese defecto en su versión
// chica —*"para el auditor ese mensaje no existió y el turno anterior parecía sin respuesta"*— y acá
// sería peor, porque no habría ni forma de notarlo.
//
// Así que se paga una llamada por conversación **que se movió y es nuestra**. En régimen ese número
// es cero, y por eso el régimen sigue costando una sola llamada.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { conOrganizacion, datos } from '../datos/contexto.ts';
import {
  buscarConversaciones,
  mensajesDeConversacion,
  type ConversacionDeGhl,
  type MensajeDeGhl,
} from '../ghl/conversaciones.ts';
import { esUnMensaje, familiaDeEntrega } from '../ghl/entrega.ts';
import { revisarEntregas } from './entregas.ts';
import { conElPulso, type Cierre, type ResultadoDelPulso } from './pulso.ts';

/**
 * Los dos topes. Juntos acotan el peor ciclo en **13 llamadas**, y por eso son dos y no uno: un
 * solo tope sobre el total dejaría que una ráfaga de conversaciones nuestras consumiera todas las
 * llamadas paginando, o al revés.
 */
const TOPE_DE_PAGINAS = 7;
const TOPE_DE_CONVERSACIONES = 6;

/** Cuántas conversaciones por página. El máximo, para que paginar cueste lo menos posible. */
const POR_PAGINA = 100;

/** Cuántos mensajes se traen de una conversación que se movió. */
const MENSAJES_POR_CONVERSACION = 100;

export interface ResultadoDeIngesta {
  /** Cuántas conversaciones se miraron, nuestras o no. */
  miradas: number;
  /** De ésas, cuántas son de un contacto nuestro. */
  nuestras: number;
  mensajesNuevos: number;
  /** Los que el CRM mandó sin fecha utilizable. Se cuentan porque **no se guardaron**. */
  sinFecha: number;
  atrasado: boolean;
  /** Cuántas entregas sin resolver se fueron a buscar, y cuántas se resolvieron. */
  entregasRevisadas: number;
  entregasResueltas: number;
}

/** Una fila lista para escribir. Se nombra para que `filas` no quede sin tipo. */
interface FilaDeMensaje {
  ghl_mensaje_id: string;
  ghl_conversacion_id: string;
  contacto_id: string;
  canal: string | null;
  direccion: 'entrante' | 'saliente';
  cuerpo: string | null;
  autor: 'contacto' | 'agente' | 'persona';
  autor_ghl_usuario_id: string | null;
  enviado_el: Date;
  estado_entrega: string | null;
  estado_entrega_familia: 'en_curso' | 'entregado' | 'fallido' | 'desconocido';
  estado_entrega_revisado_el: Date;
  estado_entrega_el: Date | null;
  id_fabricado: boolean;
  origen: 'ingesta';
}

/** Un contacto nuestro, indexado por su identificador en el CRM. */
interface ContactoConocido {
  id: string;
  mensajesDesdeEl: Date | null;
}

/**
 * Un ciclo de ingesta. Devuelve `corrio: false` cuando no le tocaba, y eso **no es un fallo**.
 */
export async function ingerirMensajes(
  orgId: string,
  acceso: { token: string; locationId: string },
): Promise<ResultadoDelPulso<ResultadoDeIngesta>> {
  return conElPulso(orgId, 'mensajes', async (pulso) => {
    // UNA consulta, y de acá sale todo el filtro por territorio. Son cientos de filas: cabe en
    // memoria de sobra, y la alternativa —preguntarle al proveedor conversación por conversación—
    // es la que cuesta 159 llamadas.
    const conocidos = await conOrganizacion(orgId, async () => {
      const filas = await datos()
        .selectFrom('contactos')
        .select(['id', 'ghl_contact_id', 'mensajes_desde_el'])
        .execute();
      const mapa = new Map<string, ContactoConocido>();
      for (const f of filas) {
        mapa.set(f.ghl_contact_id, { id: f.id, mensajesDesdeEl: f.mensajes_desde_el });
      }
      return mapa;
    });

    let llamadas = 0;
    let miradas = 0;
    let nuestras = 0;
    let mensajesNuevos = 0;
    let sinFecha = 0;
    let atrasado = false;
    let conversacionesPedidas = 0;

    // La marca **arranca donde estaba** y solo se mueve sobre conversaciones terminadas. Empezarla
    // en `null` haría que un ciclo que no completa nada la borrara, y todo se reingeriría.
    let marca: Date | null = pulso.marcaEl;
    let primeraVista: Date | null = null;

    paginas: for (let pagina = 0; pagina < TOPE_DE_PAGINAS; pagina++) {
      const r = await buscarConversaciones(acceso, { desde: marca, limite: POR_PAGINA });
      llamadas++;
      if (r.tipo !== 'datos') {
        // Un fallo del proveedor **no mueve la marca** y no es una excepción: es un ciclo que hizo
        // menos de lo que quería. Se anota y se sale — reintentar en el mismo ciclo sería insistir
        // contra algo que acaba de decir que no.
        return {
          cierre: cierreDe({ marca, llamadas, atrasado: true, fallo: describir(r.fallo) }),
          // La revisión de entregas NO se intenta si la búsqueda falló: el proveedor acaba de
          // decir que no, y gastar dos llamadas más contra él es insistir sobre lo mismo.
          resultado: {
            miradas,
            nuestras,
            mensajesNuevos,
            sinFecha,
            atrasado: true,
            entregasRevisadas: 0,
            entregasResueltas: 0,
          },
        };
      }

      const lote = r.datos.conversaciones;
      if (lote.length === 0) break;

      for (const conv of lote) {
        miradas++;
        if (primeraVista === null) primeraVista = conv.ultimaEl;

        const contacto = conv.contactId ? conocidos.get(conv.contactId) : undefined;
        if (!contacto) {
          // No es nuestra: **ya está terminada**, no hay nada que traer. La marca avanza igual, y
          // ése es justamente el mecanismo que hace barato caminar 15.000 conversaciones ajenas.
          marca = conv.ultimaEl ?? marca;
          continue;
        }
        nuestras++;

        if (conversacionesPedidas >= TOPE_DE_CONVERSACIONES) {
          // Se agotó el tope. **La marca NO avanza sobre ésta**: quedó sin traer, y el ciclo que
          // viene tiene que volver a verla. Avanzar acá sería perder sus mensajes en silencio.
          atrasado = true;
          break paginas;
        }

        const m = await mensajesDeConversacion(acceso, conv.id, {
          limite: MENSAJES_POR_CONVERSACION,
        });
        llamadas++;
        conversacionesPedidas++;
        if (m.tipo !== 'datos') {
          atrasado = true;
          break paginas;
        }

        const escrito = await guardarMensajes(orgId, contacto, conv, m.datos.mensajes);
        mensajesNuevos += escrito.nuevos;
        sinFecha += escrito.sinFecha;
        marca = conv.ultimaEl ?? marca;
      }

      // Página incompleta = se llegó al final de la cuenta. No hay más que caminar.
      if (lote.length < POR_PAGINA) break;
      if (pagina === TOPE_DE_PAGINAS - 1) atrasado = true;
    }

    // ── Y LA TERCERA PASADA, dentro del MISMO ciclo ────────────────────────
    //
    // Comparte el alquiler y la contabilidad de la ingesta a propósito: dos candados separados
    // serían dos cosas que mantener, y esto no necesita el suyo — corre exactamente cuando corre
    // el ciclo, ni más ni menos.
    const revision = await revisarEntregas(orgId, acceso);
    llamadas += revision.llamadas;

    return {
      cierre: cierreDe({
        marca,
        llamadas,
        atrasado,
        fallo: null,
        // El piso se escribe UNA vez, en el primer ciclo que mire algo: desde ahí para adelante la
        // cobertura es continua, porque se camina en orden y sin saltos. `pulso.ts` lo protege con
        // un `coalesce` para que un ciclo posterior no lo mueva.
        primeraVista: pulso.marcaDesdeEl === null ? primeraVista : undefined,
      }),
      resultado: {
        miradas,
        nuestras,
        mensajesNuevos,
        sinFecha,
        atrasado,
        entregasRevisadas: revision.revisados,
        entregasResueltas: revision.resueltos,
      },
    };
  });
}

function cierreDe(x: {
  marca: Date | null;
  llamadas: number;
  atrasado: boolean;
  fallo: string | null;
  primeraVista?: Date | null;
}): Cierre {
  return {
    marcaEl: x.marca,
    marcaDesdeEl: x.primeraVista,
    llamadas: x.llamadas,
    atrasado: x.atrasado,
    fallo: x.fallo,
  };
}

/** El fallo, en una frase corta para la columna. No se muestra a nadie: es para diagnosticar. */
function describir(f: { tipo: string; estado?: number; causa?: string }): string {
  if (f.tipo === 'sin_respuesta') return `sin respuesta: ${f.causa ?? ''}`.trim();
  return `${f.tipo} (${f.estado ?? '?'})`;
}

// ─── La escritura ───────────────────────────────────────────────────────────

/**
 * Guarda los mensajes de una conversación.
 *
 * ── LA REESCRITURA NO ES GRATIS NI ES INÚTIL ────────────────────────────────
 *
 * Un `do nothing` a secas sería lo obvio y dejaría los estados de entrega congelados en lo que
 * fueran la primera vez. Con `do update` **solo cuando el estado cambió**, releer una conversación
 * vieja resuelve entregas de paso y sin costo extra: el disparador `mensajes_reabren_por_entrega`
 * se dispara y recalcula la actividad del contacto.
 *
 * La condición `is distinct from` es lo que lo vuelve barato: sin ella, cada relectura reescribiría
 * cien filas y dispararía cien recálculos para no cambiar nada.
 */
async function guardarMensajes(
  orgId: string,
  contacto: ContactoConocido,
  conv: ConversacionDeGhl,
  crudos: readonly MensajeDeGhl[],
): Promise<{ nuevos: number; sinFecha: number }> {
  let sinFecha = 0;
  const filas: FilaDeMensaje[] = [];

  for (const m of crudos) {
    // Las actividades del CRM no son mensajes. Es el 15 % de lo que llega y traen texto: sin este
    // filtro, el título de una cita aparecería como si lo hubiera escrito el contacto.
    if (!esUnMensaje(m.tipo)) continue;
    if (m.id === '') continue;

    // Sin fecha no se puede ubicar en el chat. Se cae a la de la conversación —es la mejor
    // aproximación disponible— y recién si tampoco hay se descarta, contándolo: un descarte
    // silencioso es lo que hace que un turno parezca sin respuesta.
    const enviadoEl = m.enviadoEl ?? conv.ultimaEl;
    if (!enviadoEl) {
      sinFecha++;
      continue;
    }

    const entrante = m.direccion === 'inbound';
    const estado = m.estado;
    filas.push({
      ghl_mensaje_id: m.id,
      ghl_conversacion_id: conv.id,
      contacto_id: contacto.id,
      canal: m.canal,
      direccion: entrante ? 'entrante' : 'saliente',
      cuerpo: m.cuerpo,
      autor: autorDe(entrante, m.fuente),
      autor_ghl_usuario_id: m.usuarioId,
      enviado_el: enviadoEl,
      estado_entrega: estado,
      estado_entrega_familia: familiaDeEntrega(estado),
      // Se acaba de mirar, así que se marca revisado. La tercera pasada busca por familia
      // `en_curso` y ordena por esta columna: los nunca revisados van primero.
      estado_entrega_revisado_el: new Date(),
      estado_entrega_el: estado === null ? null : new Date(),
      id_fabricado: false,
      origen: 'ingesta' as const,
    });
  }

  if (filas.length === 0) return { nuevos: 0, sinFecha };

  const escritas = await conOrganizacion(orgId, async () => {
    const r = await datos()
      .insertInto('mensajes')
      .values(filas as never)
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
      .returning('id')
      .execute();

    // Y la frontera de cobertura de ESTE contacto. Sin ella, una ficha sin mensajes no se puede
    // distinguir de una que nadie leyó todavía, y la ficha diría «nunca escribió» de las dos.
    await datos()
      .updateTable('contactos')
      .set({ mensajes_desde_el: sql`coalesce(mensajes_desde_el, ${menorFecha(filas)})` } as never)
      .where('id', '=', contacto.id)
      .execute();

    return r.length;
  });

  return { nuevos: escritas, sinFecha };
}

function menorFecha(filas: readonly FilaDeMensaje[]): Date {
  return filas.reduce((a, f) => (f.enviado_el < a ? f.enviado_el : a), filas[0]!.enviado_el);
}

/**
 * Quién lo mandó. **Tres estados y no dos**, porque el bot y una persona no son lo mismo.
 *
 * Por omisión un saliente es del agente y no de una persona, y la asimetría es deliberada:
 * atribuirle a alguien un mensaje que disparó una automatización es el error que vuelve inservible
 * el historial (`04` § 3). El error inverso —dar por automático algo que escribió una persona— no
 * le pone el nombre de nadie a nada.
 */
function autorDe(entrante: boolean, fuente: string | null): 'contacto' | 'agente' | 'persona' {
  if (entrante) return 'contacto';
  // `app` es la única fuente que significa que alguien lo escribió a mano en el CRM.
  return fuente === 'app' ? 'persona' : 'agente';
}
