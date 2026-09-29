// Qué URL externa puede dibujar Creative, y como qué. Puro: sin base, sin red, sin imports.
//
// ═══════════════════════════════════════════════════════════════════════════════
// DOS LISTAS, PORQUE SON DOS PELIGROS DISTINTOS
//
// La pantalla va a mostrar dos clases de URL que no vienen de nosotros (docs/creative/15, C15-03 y
// C15-06):
//
//   · PUBLICACIONES — el link de un post o de un reel, que la persona abre con un click en una
//     pestaña nueva. Lo pega alguien a mano (el link manual de la pieza) o lo da Meta. El peligro es
//     mandar a alguien a otro lado con un link que dice «Ver en Facebook». Por eso es una lista
//     CERRADA de hosts, comparados de forma exacta: `evilfacebook.com` y `facebook.com.evil.com` no
//     pasan, y tampoco `https://www.facebook.com@evil.com`, cuyo host verdadero es `evil.com`.
//   · MEDIOS — la miniatura y el archivo del video, que el navegador descarga solo, sin click, en un
//     `<img>` o un `<video>`. Los sirve el CDN de Meta con un host que cambia por región
//     (`scontent-ord5-1.xx.fbcdn.net`), así que acá la comparación es por SUFIJO, siempre con el
//     punto adelante: `.fbcdn.net` acepta `scontent.xx.fbcdn.net` y no `evilfbcdn.net`.
//
// Una no sirve por la otra. Un link de publicación en un `<img>` no dibuja nada; un medio del CDN como
// link manual sería una URL firmada que vence —una llave del archivo— pegada en la base.
//
// ── LO QUE SE EXIGE A LAS DOS ───────────────────────────────────────────────
//
// `https:` y nada más: `http:` viaja en claro y `javascript:` ejecuta. Sin usuario ni contraseña en la
// URL, que es el disfraz del host. Sin puerto: ningún servicio de Meta lo usa, y uno raro es otra
// cosa escuchando. Y un largo máximo, el mismo que la base (`063_el_enlace_de_la_pieza.sql`).
//
// El parseo es el de `urlDePagoValida` (`lib/negocio/enlacesRapidos.ts`): `new URL`, no una
// expresión regular. `new URL` ya baja el host a minúsculas y lo pasa a punycode, así que la
// comparación exacta es sobre lo mismo que va a resolver el navegador.
// ═══════════════════════════════════════════════════════════════════════════════

/** A qué red lleva una publicación. Decide el rótulo: «Ver en Facebook» o «Ver en Instagram». */
export type Red = 'facebook' | 'instagram';

/**
 * Los hosts de publicación, y a qué red corresponde cada uno.
 *
 * `fb.me` es el acortador de Meta: es el formato del link «Compartir vista previa» del Administrador
 * de anuncios, que es justo lo que alguien va a pegar. `business.facebook.com` es el mismo Facebook
 * visto desde el Business Manager. Agregar un host acá es una decisión (`C15-P07`), no una corrección.
 */
const HOSTS_DE_PUBLICACION: Readonly<Record<string, Red>> = {
  'facebook.com': 'facebook',
  'www.facebook.com': 'facebook',
  'm.facebook.com': 'facebook',
  'web.facebook.com': 'facebook',
  'business.facebook.com': 'facebook',
  'fb.watch': 'facebook',
  'fb.me': 'facebook',
  'instagram.com': 'instagram',
  'www.instagram.com': 'instagram',
};

/** Los sufijos del CDN de Meta, con el punto adelante. */
const SUFIJOS_DE_MEDIOS: readonly string[] = ['.fbcdn.net', '.cdninstagram.com'];

/** El mismo tope que el `check` de la migración 063. */
export const LARGO_MAXIMO_DE_URL = 500;

/** La URL parseada si cumple lo común a las dos listas, o `null`. */
function parsear(url: unknown): URL | null {
  if (typeof url !== 'string' || url.length === 0 || url.length > LARGO_MAXIMO_DE_URL) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (u.username !== '' || u.password !== '') return null;
  if (u.port !== '') return null;
  return u;
}

/**
 * Si la URL es un link de publicación de Facebook o Instagram: la URL normalizada y su red.
 *
 * Devuelve la forma normalizada (`href`) y no la que llegó, para que lo que se guarda y lo que se
 * dibuja sean lo mismo que el navegador va a abrir.
 */
export function enlaceDePublicacion(url: unknown): { url: string; red: Red } | null {
  const u = parsear(url);
  if (u === null) return null;
  const red = HOSTS_DE_PUBLICACION[u.hostname];
  return red === undefined ? null : { url: u.href, red };
}

/** Si la URL es un medio del CDN de Meta: una miniatura o el archivo de un video. */
export function medioPermitido(url: unknown): boolean {
  const u = parsear(url);
  if (u === null) return false;
  return SUFIJOS_DE_MEDIOS.some((s) => u.hostname.endsWith(s) && u.hostname.length > s.length);
}
