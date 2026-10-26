// El cliente de la API de Meta (Graph). SÓLO LECTURA.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE (`docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md`, CR-6)
//
// GoHighLevel no entrega el creativo de los anuncios del Business Manager (`docs/creative/14`, C14-16 a C14-22): la
// miniatura de cada anuncio sólo la da Meta, con un token propio que una persona del equipo carga en Ajustes
// (`resolverAccesoAMeta`). Este archivo es el único que habla con Meta.
//
// ── TRES REGLAS ────────────────────────────────────────────────────────────────
//
//   · **El token va en la cabecera `Authorization`, nunca en la URL.** Una URL termina en registros de la plataforma,
//     del proveedor y de cualquier intermediario; una cabecera no.
//   · **Sólo `GET`.** El token es de lectura (`ads_read`, `pages_read_engagement`, `pages_show_list`) y este cliente no
//     sabe pedir otra cosa: no hay forma de que una regresión cree, pause o gaste.
//   · **El error de Meta se traduce a un motivo cerrado** (`FallaDeMeta`). Su mensaje en inglés, que puede nombrar
//     ids de cuentas, nunca llega al navegador: lo que llega es el motivo y un texto nuestro.
// ═══════════════════════════════════════════════════════════════════════════════
import { pedirExterno, type Respuesta } from '../http/cliente.ts';
import { pruebaDelSecreto } from './app.ts';

/**
 * La versión de la API. Meta mantiene cada versión unos dos años y avisa antes de retirarla; cambiarla es cambiar
 * esta línea y volver a probar la conexión en Ajustes.
 */
export const VERSION_DE_GRAPH = 'v23.0';

const BASE = `https://graph.facebook.com/${VERSION_DE_GRAPH}`;

/** Cuánto se espera a Meta por pedido. Una lectura de anuncios contesta en uno o dos segundos. */
export const ESPERA_DE_META_MS = 20_000;

/**
 * Por qué Meta no contestó lo pedido, en categorías que llevan a una acción distinta.
 *
 *   · `token`         → el token venció, se revocó o no es válido: generarlo de nuevo y cargarlo.
 *   · `permiso`       → al token le falta un permiso o no tiene asignada la cuenta o la Página: revisar el usuario del
 *                       sistema en el Business Manager.
 *   · `no_existe`     → el objeto no existe o el token no lo puede ver (Meta no distingue las dos): casi siempre, una
 *                       cuenta publicitaria mal escrita.
 *   · `cupo`          → se pasó el límite de llamadas: se reintenta solo en la próxima pasada.
 *   · `sin_respuesta` → Meta no contestó a tiempo.
 *   · `otro`          → cualquier otro rechazo.
 */
export type FallaDeMeta = 'token' | 'permiso' | 'no_existe' | 'cupo' | 'sin_respuesta' | 'otro';

// Listas y no `Set`: una estructura mutable en el nivel del módulo se comparte entre peticiones (ADR-0703).
const CODIGOS_DE_TOKEN: readonly number[] = [102, 190, 463, 467];
const CODIGOS_DE_CUPO: readonly number[] = [4, 17, 32, 613, 80000, 80003, 80004, 80014];

/** Traduce un rechazo de Meta a su motivo. Pura: la prueba la ejerce con los códigos de la documentación de Meta. */
export function fallaDeMeta(r: Exclude<Respuesta<unknown>, { tipo: 'datos' }>): FallaDeMeta {
  if (r.tipo === 'sin_respuesta') return 'sin_respuesta';
  const n = r.numero;
  if (n !== undefined && CODIGOS_DE_TOKEN.includes(n)) return 'token';
  if (n === 10 || (n !== undefined && n >= 200 && n <= 299)) return 'permiso';
  if (n !== undefined && CODIGOS_DE_CUPO.includes(n)) return 'cupo';
  if (n === 100 || n === 803) return 'no_existe';
  if (r.estado === 401) return 'token';
  if (r.estado === 403) return 'permiso';
  if (r.estado === 429) return 'cupo';
  return 'otro';
}

/** Lo que se le dice a quien carga el token, por motivo. Textos nuestros, sin el mensaje de Meta. */
export const TEXTO_DE_FALLA_DE_META: Readonly<Record<FallaDeMeta, string>> = {
  /* Valen para las dos formas de conectar (Meta directo): «Conectar con Meta» —lo normal— y el token pegado a mano
     —el respaldo—. Por eso dicen primero qué hacer con el botón. */
  token:
    'Meta rechazó la conexión: se quitó la integración en el Business Manager, venció o no está completa. Vuelve a ' +
    'conectar Meta en Ajustes (o, si usas un token pegado a mano, genéralo de nuevo y cárgalo).',
  permiso:
    'La conexión con Meta no tiene permiso para esto. Vuelve a conectar Meta y marca la cuenta publicitaria al aceptar ' +
    '(con un token pegado a mano: que el usuario del sistema tenga asignada la cuenta y el permiso ads_read).',
  no_existe:
    'Meta no encuentra la cuenta publicitaria con esa conexión. Vuelve a conectar Meta y marca esa cuenta al aceptar ' +
    '(con un token pegado a mano: revisa el número act_… del Administrador de anuncios).',
  cupo: 'Meta limitó las llamadas por un rato. No hay que hacer nada: se reintenta solo.',
  sin_respuesta: 'Meta no contestó a tiempo. Prueba de nuevo en unos minutos.',
  otro: 'Meta rechazó el pedido por un motivo que no es el token ni los permisos. Prueba de nuevo; si sigue, avisa a desarrollo.',
};

/**
 * Un `GET` a Graph. `ruta` sin barra inicial (`me`, `act_123/ads`, o vacía para `?ids=`); `campos` va como el
 * parámetro `fields`. Los demás parámetros, en `parametros`. El token NO va en ninguno de los dos.
 */
export async function pedirAMeta<T>(
  ruta: string,
  token: string,
  parametros: Readonly<Record<string, string>> = {},
  opciones: {
    /**
     * `true` = el token es de NUESTRA app (una conexión `oauth`): va con su `appsecret_proof`, que es un hash y no un
     * secreto. Un token pegado de la app de otro negocio va sin ella, porque Meta la rechazaría.
     */
    conPrueba?: boolean;
    /** Recibe las cabeceras de la respuesta: el uso de la cuota de la cuenta y de la app viaja ahí. */
    alResponder?: (cabeceras: Headers) => void;
  } = {},
): Promise<Respuesta<T>> {
  const consulta = new URLSearchParams(parametros);
  if (consulta.has('access_token')) throw new Error('pedirAMeta: el token va en la cabecera, nunca en la URL');
  if (opciones.conPrueba) consulta.set('appsecret_proof', pruebaDelSecreto(token));
  const url = `${BASE}/${ruta}${consulta.size > 0 ? `?${consulta.toString()}` : ''}`;
  return pedirExterno<T>(url, {
    cabeceras: { authorization: `Bearer ${token}` },
    espera: ESPERA_DE_META_MS,
    alResponder: opciones.alResponder,
  });
}

/** La raíz de Graph con su versión, para quien arma una URL que no es un `GET` de datos (el canje de OAuth). */
export const RAIZ_DE_GRAPH = BASE;
