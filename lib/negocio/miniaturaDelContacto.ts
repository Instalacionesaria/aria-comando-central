// La miniatura del anuncio por el que llegó cada contacto, pedida a GoHighLevel contacto por contacto.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE (docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, CF1-11 y CF1-12)
//
// Medido el 2026-10-11: `GET /contacts/{id}` trae en `attributionSource` un `videoUrl` —la imagen del anuncio por el
// que llegó el contacto, en `www.facebook.com`—, más `photoUrl`, `postId` e `igSid`. `POST /contacts/search`, que es
// lo que usa la sincronización, no los trae: en la base había 0 de 597. Esta pasada pide, uno por uno, los contactos
// que llegaron por un anuncio y todavía no se pidieron, y guarda lo que vuelve en `negocio.miniaturas_del_contacto`
// —no en `atribucion_primera`, que la sincronización pisa cada diez minutos (`077`)—.
//
// ── EL COSTO, CONTADO ──────────────────────────────────────────────────────────
//
// Una llamada por contacto, una sola vez salvo un fallo pasajero (un 5xx, que se vuelve a pedir): la fila queda
// también cuando no hubo nada que guardar, y cuando el CRM
// rechazó ESE contacto (un 403 o un 4xx que no sea 429): repetirlo cada diez minutos no lo arregla, y un rechazo fijo
// en el contacto más reciente frenaba la cola entera. Con el tope de 50 por pasada, los ~215 contactos con `adId` de
// la medición se completan en unas cinco pasadas de la tarea `contactos` (cada diez minutos), y después sólo los nuevos.
//
// ── SÓLO CON `adId` ────────────────────────────────────────────────────────────
//
// Medido el 2026-10-11 en producción: GoHighLevel adjunta la imagen sólo cuando el contacto entra desde un anuncio de
// Instagram, y siempre con `adId`. Los que sólo traen `mediumId` —formularios externos y el calendario: su `mediumId`
// es el del formulario, no el de un anuncio— no trajeron ninguna en 255 pedidos: pedirlos gastaba un pedido por cada
// contacto nuevo de un formulario (docs/creative/16, § 2). La miniatura de las piezas de Facebook necesita Meta directo.
//
// La pasada se corta —y lo que faltó se pide en la siguiente— ante un 429 (insistir sólo gasta el cupo), un 401 (la
// credencial no sirve para ninguno), un GoHighLevel que no contesta, o el tiempo: corre dentro de la tarea `contactos`,
// antes de `mensajes` y `auditoria` de la misma empresa, y no puede comerse los 300 segundos de la función. Cada pedido
// espera como mucho `ESPERA_POR_PEDIDO_MS`, y la pasada entera `TIEMPO_DE_LA_PASADA_MS`.
//
// Es el único escritor de la tabla (la prueba 253).
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { conOrganizacion, datos } from '../datos/contexto.ts';
import { atribucionDelContacto, contactoPorId } from '../ghl/cliente.ts';
import { llaveDelCreativo } from './creativo.ts';
import { LARGO_MAXIMO_DE_MINIATURA, enlaceDePublicacion, medioPermitido } from './urlExterna.ts';

/** Cuántos contactos se piden, como mucho, en cada pasada. */
export const TOPE_POR_PASADA = 50;

/** Lo más que espera cada pedido: el de por omisión de `pedirExterno` son cuatro minutos. */
export const ESPERA_POR_PEDIDO_MS = 15_000;

/** Lo más que dura la pasada entera: deja a `mensajes` y `auditoria` el resto del presupuesto del barrido. */
export const TIEMPO_DE_LA_PASADA_MS = 60_000;

/** Un texto que la tabla acepta como URL, o `null`. */
function url(valor: string | undefined): string | null {
  if (valor === undefined) return null;
  return valor.startsWith('https://') && valor.length <= LARGO_MAXIMO_DE_MINIATURA ? valor : null;
}

/** Lo que dejó una pasada. Viaja al resumen de la tarea `contactos`. */
export interface ResumenDeMiniaturas {
  pedidos: number;
  conImagen: number;
  sinDato: number;
  /** El CRM no devolvió el contacto —un 404, una respuesta sin contacto, un 403 u otro rechazo de ese contacto—: no
   *  se vuelve a pedir. */
  noEncontrados: number;
  /** Fallos que no se guardan: el contacto se vuelve a pedir en la pasada siguiente. */
  fallos: number;
  /** Por qué se cortó la pasada antes del tope, o `null`: lo que faltó se pide en la siguiente. */
  corte: CorteDeLaPasada | null;
}

/** `cupo`: un 429. `credencial`: un 401. `sin_respuesta`: GoHighLevel no contestó. `tiempo`: se acabó la pasada. */
export type CorteDeLaPasada = 'cupo' | 'credencial' | 'sin_respuesta' | 'tiempo';

/**
 * Los contactos que llegaron por un anuncio —con `adId` en su primera atribución— y todavía no se pidieron, de los
 * más recientes a los más viejos. Corre dentro de `conOrganizacion`.
 */
export async function contactosPorPedir(tope = TOPE_POR_PASADA): Promise<{ id: string; ghlId: string }[]> {
  const filas = await datos()
    .selectFrom('contactos')
    .select(['id', 'ghl_contact_id'])
    .where(sql<boolean>`contactos.atribucion_primera ? 'adId'`)
    .where(sql<boolean>`not exists (select 1 from negocio.miniaturas_del_contacto m
                                     where m.org_id = contactos.org_id and m.contacto_id = contactos.id)`)
    .orderBy(sql`contactos.alta_en_el_crm desc nulls last`)
    .orderBy('id')
    .limit(tope)
    .execute();
  return filas.map((f) => ({ id: f.id, ghlId: f.ghl_contact_id }));
}

/** Una fila de la tabla, armada con lo que devolvió el CRM. */
type FilaNueva = { contacto_id: string; encontrado: boolean; video_url: string | null; photo_url: string | null; post_id: string | null; ig_sid: string | null };

/**
 * Pide a GoHighLevel los contactos pendientes y devuelve las filas que hay que guardar. NO corre dentro de una
 * transacción: son llamadas de red, y una transacción abierta durante cincuenta de ellas retendría la conexión.
 */
export async function pedirMiniaturas(
  acceso: { token: string; locationId: string },
  pendientes: readonly { id: string; ghlId: string }[],
  hasta = Date.now() + TIEMPO_DE_LA_PASADA_MS,
  ahora: () => number = Date.now,
): Promise<{ filas: FilaNueva[]; resumen: ResumenDeMiniaturas }> {
  const filas: FilaNueva[] = [];
  const resumen: ResumenDeMiniaturas = { pedidos: 0, conImagen: 0, sinDato: 0, noEncontrados: 0, fallos: 0, corte: null };
  for (const p of pendientes) {
    if (ahora() >= hasta) {
      resumen.corte = 'tiempo';
      break;
    }
    resumen.pedidos += 1;
    const r = await contactoPorId(acceso, p.ghlId, ESPERA_POR_PEDIDO_MS);
    if (r.tipo === 'fallo') {
      const f = r.fallo;
      /* El rechazo de ESE contacto —un 403, o un 4xx que no sea el cupo— no cambia con la próxima pasada: se guarda
         como no devuelto. Un 401 es la credencial, y vale para todos. Un 5xx puede ser pasajero: se vuelve a pedir. */
      const deEseContacto = (f.tipo === 'no_autorizado' && f.estado === 403) || (f.tipo === 'rechazado' && f.estado < 500);
      if (deEseContacto) {
        resumen.noEncontrados += 1;
        filas.push({ contacto_id: p.id, encontrado: false, video_url: null, photo_url: null, post_id: null, ig_sid: null });
        continue;
      }
      resumen.fallos += 1;
      if (f.tipo === 'demasiadas_peticiones') resumen.corte = 'cupo';
      else if (f.tipo === 'no_autorizado') resumen.corte = 'credencial';
      else if (f.tipo === 'sin_respuesta') resumen.corte = 'sin_respuesta';
      if (resumen.corte !== null) break;
      continue;
    }
    if (r.datos === null) {
      resumen.noEncontrados += 1;
      filas.push({ contacto_id: p.id, encontrado: false, video_url: null, photo_url: null, post_id: null, ig_sid: null });
      continue;
    }
    const a = atribucionDelContacto(r.datos.attributionSource);
    const fila: FilaNueva = {
      contacto_id: p.id,
      encontrado: true,
      video_url: url(a.videoUrl),
      photo_url: url(a.photoUrl),
      post_id: a.postId ?? null,
      ig_sid: a.igSid ?? null,
    };
    if (fila.video_url !== null || fila.photo_url !== null) resumen.conImagen += 1;
    else resumen.sinDato += 1;
    filas.push(fila);
  }
  return { filas, resumen };
}

/**
 * La pasada entera para una empresa: lee los pendientes, los pide y guarda lo que volvió. Las dos lecturas de la
 * base van en su propia transacción, y las llamadas de red, afuera. Es lo que corre la tarea `contactos`
 * (`lib/negocio/barrido.ts`), después de sincronizar.
 */
export async function completarMiniaturas(
  orgId: string,
  acceso: { token: string; locationId: string },
  tope = TOPE_POR_PASADA,
  ahora: () => number = Date.now,
): Promise<ResumenDeMiniaturas> {
  const hasta = ahora() + TIEMPO_DE_LA_PASADA_MS;
  const pendientes = await conOrganizacion(orgId, () => contactosPorPedir(tope));
  const { filas, resumen } = await pedirMiniaturas(acceso, pendientes, hasta, ahora);
  await conOrganizacion(orgId, () => guardarMiniaturas(filas));
  return resumen;
}

/**
 * Guarda lo pedido. Corre dentro de `conOrganizacion`. Lo ya guardado no se pisa: si dos pasadas pidieron el mismo
 * contacto a la vez, queda la primera, y cada contacto se guarda una sola vez.
 */
export async function guardarMiniaturas(filas: readonly FilaNueva[]): Promise<void> {
  if (filas.length === 0) return;
  await datos()
    .insertInto('miniaturas_del_contacto')
    .values(filas.map((f) => ({ ...f })) as never)
    .onConflict((oc) => oc.columns(['org_id', 'contacto_id']).doNothing())
    .execute();
}

/**
 * La miniatura de cada pieza: de los contactos de la pieza, la imagen más frecuente —el `videoUrl`, o el `photoUrl`
 * si no hay—; empate, la del contacto que entró más tarde al CRM. Sólo viaja una URL de los hosts de Facebook e
 * Instagram (`lib/negocio/urlExterna.ts`), con el tope de largo de la tabla. Sin ventana: la imagen de la pieza no
 * depende del período. Corre dentro de `conOrganizacion`.
 *
 * DE QUÉ PIEZA ES UN CONTACTO: primero por su ANUNCIO —el `adId` de la atribución, cruzado con `negocio.anuncios`—, y
 * sólo sin anuncio por su `utmContent`. Es la misma llave con la que la pantalla nombra las piezas (el nombre del
 * anuncio, `entregaDeLasPiezas` y el rendimiento). Los contactos que traen la imagen son justo los que entran por un
 * anuncio de Instagram (DM), y ésos llegan SIN UTMs: con el `utmContent` solo, 2 de las 3 imágenes de producción no
 * tenían pieza y la pantalla no mostraba ninguna (medido el 2026-10-15).
 */
export async function miniaturasDeLasPiezas(): Promise<Map<string, string>> {
  const pieza = sql<string>`coalesce(
    nullif(${llaveDelCreativo('a.nombre')}, ''),
    nullif(${llaveDelCreativo("c.atribucion_primera ->> 'utmContent'")}, ''))`;
  const imagen = sql<string>`coalesce(m.video_url, m.photo_url)`;
  const filas = await datos()
    .selectFrom('miniaturas_del_contacto as m')
    .innerJoin('contactos as c', (j) => j.onRef('c.org_id', '=', 'm.org_id').onRef('c.id', '=', 'm.contacto_id'))
    .leftJoin('anuncios as a', (j) =>
      j.onRef('a.org_id', '=', 'c.org_id').on(sql<boolean>`a.meta_anuncio_id = c.atribucion_primera ->> 'adId'`),
    )
    .select([pieza.as('pieza'), imagen.as('imagen')])
    .where(sql<boolean>`coalesce(m.video_url, m.photo_url) is not null`)
    .where(sql<boolean>`${pieza} is not null`)
    .groupBy([pieza, imagen])
    /* El orden decide cuál gana: la primera permitida de cada pieza. Sin él, la que gana es la que la base devuelva
       primero. */
    .orderBy(pieza)
    .orderBy(sql`count(*) desc`)
    .orderBy(sql`max(c.alta_en_el_crm) desc nulls last`)
    .orderBy(imagen)
    .execute();
  const elegidas = new Map<string, string>();
  for (const f of filas) {
    if (elegidas.has(f.pieza)) continue;
    if (enlaceDePublicacion(f.imagen, LARGO_MAXIMO_DE_MINIATURA) === null && !medioPermitido(f.imagen, LARGO_MAXIMO_DE_MINIATURA)) continue;
    elegidas.set(f.pieza, f.imagen);
  }
  return elegidas;
}
