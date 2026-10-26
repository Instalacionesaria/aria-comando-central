// Leer de Meta el creativo de cada anuncio: su tipo, su imagen, su miniatura y su post. SÓLO LECTURA.
//
// Dos pasos y no uno, a propósito:
//   1. los anuncios, por lotes de 50 (`?ids=…`): de cada uno, su cuenta y el id de su creativo;
//   2. los creativos, también por lotes: la imagen y la miniatura, con `thumbnail_width`/`thumbnail_height`.
// Pedir la miniatura dentro del anuncio (`creative{thumbnail_url}`) la trae de 64 px, que en una tarjeta se ve borrosa;
// el tamaño sólo se puede pedir sobre el creativo.
//
// ── UN LOTE CON UN ANUNCIO QUE NO EXISTE ────────────────────────────────────────
// Si un id de `?ids=` no existe (un anuncio borrado en Meta que sigue en nuestra tabla), Meta rechaza el LOTE ENTERO
// con el código 100. Ese lote se vuelve a pedir de a uno, y el que no existe queda marcado como tal: sin esto, un solo
// anuncio borrado dejaría sin miniatura a los otros 49 para siempre.
import { fallaDeMeta, pedirAMeta, type FallaDeMeta } from './graph.ts';

/** Cuántos ids por pedido. El tope de Meta para `?ids=` es 50. */
export const LOTE_DE_META = 50;

/** Lado de la miniatura que se pide, en píxeles: el de la tarjeta de Creative con margen para pantallas densas. */
export const LADO_DE_LA_MINIATURA = 640;

/** Lo que se lee de un anuncio y su creativo. Todo puede faltar: Meta omite las claves que no aplican. */
export interface CreativoDeMeta {
  /** La cuenta del anuncio, como la devuelve Meta: sólo dígitos, sin `act_`. */
  cuenta: string | null;
  creativo: string | null;
  tipo: string | null;
  imagen: string | null;
  miniatura: string | null;
  /** `effective_object_story_id`: `<página>_<post>`. */
  historia: string | null;
  instagram: string | null;
}

export type LecturaDeCreativos =
  | {
      tipo: 'leido';
      /** Por anuncio: lo leído, o `no_existe` si Meta no lo encuentra. Un anuncio que no entró (por tiempo) no está. */
      anuncios: Map<string, CreativoDeMeta | 'no_existe'>;
      llamadas: number;
      /** `true` = el tiempo no alcanzó para todos; los que faltan se leen en la próxima pasada. */
      incompleto: boolean;
    }
  | { tipo: 'falla'; motivo: FallaDeMeta; llamadas: number };

type FilaDeAnuncio = { account_id?: unknown; creative?: { id?: unknown } };
type FilaDeCreativo = {
  object_type?: unknown;
  image_url?: unknown;
  thumbnail_url?: unknown;
  effective_object_story_id?: unknown;
  instagram_permalink_url?: unknown;
};

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

const CAMPOS_DEL_ANUNCIO = 'account_id,creative{id}';
const CAMPOS_DEL_CREATIVO = 'object_type,image_url,thumbnail_url,effective_object_story_id,instagram_permalink_url';

/**
 * Pide un lote por `?ids=`; si Meta lo rechaza por un id que no existe, lo pide de a uno. Devuelve lo leído por id
 * (`null` = no existe), las llamadas hechas, o la falla que corta (token, permiso, cupo…).
 */
async function porLote<T>(
  token: string,
  ids: readonly string[],
  parametros: Readonly<Record<string, string>>,
  hasta: number,
  ahora: () => number,
  conPrueba = false,
): Promise<{ tipo: 'ok'; filas: Map<string, T | null>; llamadas: number; incompleto: boolean } | { tipo: 'falla'; motivo: FallaDeMeta; llamadas: number }> {
  const filas = new Map<string, T | null>();
  let llamadas = 0;
  for (let i = 0; i < ids.length; i += LOTE_DE_META) {
    if (ahora() >= hasta) return { tipo: 'ok', filas, llamadas, incompleto: true };
    const lote = ids.slice(i, i + LOTE_DE_META);
    const r = await pedirAMeta<Record<string, T>>('', token, { ids: lote.join(','), ...parametros }, { conPrueba });
    llamadas += 1;
    if (r.tipo === 'datos') {
      for (const id of lote) filas.set(id, (r.datos?.[id] as T | undefined) ?? null);
      continue;
    }
    const motivo = fallaDeMeta(r);
    if (motivo !== 'no_existe') return { tipo: 'falla', motivo, llamadas };
    // Un id del lote no existe: de a uno.
    for (const id of lote) {
      if (ahora() >= hasta) return { tipo: 'ok', filas, llamadas, incompleto: true };
      const uno = await pedirAMeta<T>(id, token, parametros, { conPrueba });
      llamadas += 1;
      if (uno.tipo === 'datos') {
        filas.set(id, uno.datos);
        continue;
      }
      const m = fallaDeMeta(uno);
      if (m !== 'no_existe') return { tipo: 'falla', motivo: m, llamadas };
      filas.set(id, null);
    }
  }
  return { tipo: 'ok', filas, llamadas, incompleto: false };
}

/** Lee el creativo de cada anuncio. `hasta` es el reloj límite de la pasada. */
export async function leerCreativos(
  token: string,
  anuncios: readonly string[],
  hasta: number,
  ahora: () => number = Date.now,
  // `true` = el token es de nuestra app («Conectar con Meta»): cada pedido va con su `appsecret_proof`.
  conPrueba = false,
): Promise<LecturaDeCreativos> {
  const paso1 = await porLote<FilaDeAnuncio>(token, anuncios, { fields: CAMPOS_DEL_ANUNCIO }, hasta, ahora, conPrueba);
  if (paso1.tipo === 'falla') return { tipo: 'falla', motivo: paso1.motivo, llamadas: paso1.llamadas };

  const creativoDe = new Map<string, string>();
  for (const [anuncio, fila] of paso1.filas) {
    const c = texto(fila?.creative?.id);
    if (c) creativoDe.set(anuncio, c);
  }
  const creativos = [...new Set(creativoDe.values())];
  const lado = String(LADO_DE_LA_MINIATURA);
  const paso2 = await porLote<FilaDeCreativo>(
    token,
    creativos,
    { fields: CAMPOS_DEL_CREATIVO, thumbnail_width: lado, thumbnail_height: lado },
    hasta,
    ahora,
    conPrueba,
  );
  const llamadas = paso1.llamadas + paso2.llamadas;
  if (paso2.tipo === 'falla') return { tipo: 'falla', motivo: paso2.motivo, llamadas };

  const salida = new Map<string, CreativoDeMeta | 'no_existe'>();
  for (const [anuncio, fila] of paso1.filas) {
    if (fila === null) {
      salida.set(anuncio, 'no_existe');
      continue;
    }
    const idCreativo = creativoDe.get(anuncio) ?? null;
    // Un creativo que no alcanzó a leerse por tiempo: el anuncio queda para la próxima pasada.
    if (idCreativo !== null && !paso2.filas.has(idCreativo)) continue;
    const c = idCreativo === null ? null : paso2.filas.get(idCreativo) ?? null;
    salida.set(anuncio, {
      cuenta: texto(fila.account_id),
      creativo: idCreativo,
      tipo: texto(c?.object_type),
      imagen: texto(c?.image_url),
      miniatura: texto(c?.thumbnail_url),
      historia: texto(c?.effective_object_story_id),
      instagram: texto(c?.instagram_permalink_url),
    });
  }
  return { tipo: 'leido', anuncios: salida, llamadas, incompleto: paso1.incompleto || paso2.incompleto };
}
