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
// Una llamada por contacto, una sola vez: la fila queda también cuando no hubo nada que guardar. Con el tope de 50 por
// pasada, los ~215 contactos con anuncio de la medición se completan en unas cinco pasadas de la tarea `contactos`
// (cada diez minutos), y después sólo los nuevos. Un 429 o una credencial rechazada cortan la pasada: insistir sólo
// gasta el cupo.
//
// Es el único escritor de la tabla (la prueba 253).
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { conOrganizacion, datos } from '../datos/contexto.ts';
import { atribucionDelContacto, contactoPorId } from '../ghl/cliente.ts';
import { llaveDelCreativo } from './creativo.ts';
import { enlaceDePublicacion, medioPermitido } from './urlExterna.ts';

/** Cuántos contactos se piden, como mucho, en cada pasada. */
export const TOPE_POR_PASADA = 50;

/** El largo máximo que guarda la tabla: el `check` de la `077`. */
const LARGO_MAXIMO = 2000;

/** Un texto que la tabla acepta como URL, o `null`. */
function url(valor: string | undefined): string | null {
  if (valor === undefined) return null;
  return valor.startsWith('https://') && valor.length <= LARGO_MAXIMO ? valor : null;
}

/** Lo que dejó una pasada. Viaja al resumen de la tarea `contactos`. */
export interface ResumenDeMiniaturas {
  pedidos: number;
  conImagen: number;
  sinDato: number;
  /** El CRM contestó 404: el contacto ya no está. */
  noEncontrados: number;
  /** Fallos que no se guardan: el contacto se vuelve a pedir en la pasada siguiente. */
  fallos: number;
  /** `true` si un 429 o una credencial rechazada cortaron la pasada antes del tope. */
  cortada: boolean;
}

/**
 * Los contactos que llegaron por un anuncio —con `adId` o `mediumId` en su primera atribución— y todavía no se
 * pidieron, de los más recientes a los más viejos. Corre dentro de `conOrganizacion`.
 */
export async function contactosPorPedir(tope = TOPE_POR_PASADA): Promise<{ id: string; ghlId: string }[]> {
  const filas = await datos()
    .selectFrom('contactos')
    .select(['id', 'ghl_contact_id'])
    .where(sql<boolean>`(contactos.atribucion_primera ? 'adId' or contactos.atribucion_primera ? 'mediumId')`)
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
): Promise<{ filas: FilaNueva[]; resumen: ResumenDeMiniaturas }> {
  const filas: FilaNueva[] = [];
  const resumen: ResumenDeMiniaturas = { pedidos: 0, conImagen: 0, sinDato: 0, noEncontrados: 0, fallos: 0, cortada: false };
  for (const p of pendientes) {
    resumen.pedidos += 1;
    const r = await contactoPorId(acceso, p.ghlId);
    if (r.tipo === 'fallo') {
      resumen.fallos += 1;
      if (r.fallo.tipo === 'demasiadas_peticiones' || r.fallo.tipo === 'no_autorizado') {
        resumen.cortada = true;
        break;
      }
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
): Promise<ResumenDeMiniaturas> {
  const pendientes = await conOrganizacion(orgId, () => contactosPorPedir(tope));
  const { filas, resumen } = await pedirMiniaturas(acceso, pendientes);
  await conOrganizacion(orgId, () => guardarMiniaturas(filas));
  return resumen;
}

/** Guarda lo pedido. Corre dentro de `conOrganizacion`. */
export async function guardarMiniaturas(filas: readonly FilaNueva[]): Promise<void> {
  if (filas.length === 0) return;
  await datos()
    .insertInto('miniaturas_del_contacto')
    .values(filas.map((f) => ({ ...f })) as never)
    .onConflict((oc) =>
      oc.columns(['org_id', 'contacto_id']).doUpdateSet((eb) => ({
        encontrado: eb.ref('excluded.encontrado'),
        video_url: eb.ref('excluded.video_url'),
        photo_url: eb.ref('excluded.photo_url'),
        post_id: eb.ref('excluded.post_id'),
        ig_sid: eb.ref('excluded.ig_sid'),
        leido_el: sql`now()`,
      })),
    )
    .execute();
}

/**
 * La miniatura de cada pieza: de los contactos de la pieza, la imagen más frecuente —el `videoUrl`, o el `photoUrl`
 * si no hay—; empate, la leída más tarde. Sólo viaja una URL de los hosts de Facebook e Instagram
 * (`lib/negocio/urlExterna.ts`). Sin ventana: la imagen de la pieza no depende del período. Corre dentro de
 * `conOrganizacion`.
 */
export async function miniaturasDeLasPiezas(): Promise<Map<string, string>> {
  const pieza = llaveDelCreativo("c.atribucion_primera ->> 'utmContent'");
  const imagen = sql<string>`coalesce(m.video_url, m.photo_url)`;
  const filas = await datos()
    .selectFrom('miniaturas_del_contacto as m')
    .innerJoin('contactos as c', (j) => j.onRef('c.org_id', '=', 'm.org_id').onRef('c.id', '=', 'm.contacto_id'))
    .select([pieza.as('pieza'), imagen.as('imagen')])
    .where(sql<boolean>`coalesce(m.video_url, m.photo_url) is not null`)
    .where(sql<boolean>`nullif(btrim(c.atribucion_primera ->> 'utmContent'), '') is not null`)
    .groupBy([pieza, imagen])
    /* El orden decide cuál gana: la primera permitida de cada pieza. Sin él, la que gana es la que la base devuelva
       primero. */
    .orderBy(pieza)
    .orderBy(sql`count(*) desc`)
    .orderBy(sql`max(m.leido_el) desc`)
    .orderBy(imagen)
    .execute();
  const elegidas = new Map<string, string>();
  for (const f of filas) {
    if (elegidas.has(f.pieza)) continue;
    if (enlaceDePublicacion(f.imagen) === null && !medioPermitido(f.imagen)) continue;
    elegidas.set(f.pieza, f.imagen);
  }
  return elegidas;
}
