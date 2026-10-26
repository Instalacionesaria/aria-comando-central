// El `signed_request` con que Meta firma sus avisos a la app (Meta directo, M6).
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ES Y POR QUÉ LA COMPARACIÓN QUEDA EN LA RUTA
//
// Cuando alguien quita la app de su negocio o pide que se borren sus datos, Meta hace un `POST` a la URL que la app
// declaró, con un formulario de un solo campo: `signed_request=<firma>.<datos>`. Las dos mitades van en base64 para URL
// sin relleno; la firma es el HMAC-SHA256 de la mitad de los datos —tal como viene, en texto— con el secreto de la app,
// y los datos son un JSON con `algorithm`, `issued_at` y `user_id` (el id en la app de quien lo pidió).
//
// Este archivo parte la solicitud y calcula la firma que DEBERÍA traer, pero no las compara: la comparación con
// `timingSafeEqual` la hace cada ruta, a la vista, como las otras rutas con secreto propio (la 30 exige que la ruta la
// llame). Así no hay una ruta que pueda olvidarse de comparar y usar los datos igual: lo único que devuelve esto son
// las dos firmas y los datos, y los datos no dicen si se verificaron.
// ═══════════════════════════════════════════════════════════════════════════════
import { createHmac } from 'node:crypto';

/** Lo que trae una solicitud firmada, sin verificar todavía. */
export interface SolicitudPartida {
  /** La firma que vino, en bytes. */
  recibida: Buffer;
  /** La que tendría que haber venido con nuestro secreto. */
  esperada: Buffer;
  /** El id en la app de quien lo pidió. */
  usuario: string;
  /** Cuándo la firmó Meta, en segundos. */
  emitida: number;
}

/** Cuánto puede medir el campo: una solicitud real tiene unos 200 caracteres. Uno enorme no se decodifica. */
const LARGO_MAXIMO = 4096;

/**
 * Parte una `signed_request` y calcula su firma esperada. `null` si no tiene la forma de una: dos mitades, un JSON con
 * `algorithm` HMAC-SHA256 y un `user_id` de dígitos. No compara: eso lo hace la ruta (ver arriba).
 */
export function partirSolicitudFirmada(valor: unknown, secreto: string): SolicitudPartida | null {
  if (typeof valor !== 'string' || valor.length === 0 || valor.length > LARGO_MAXIMO) return null;
  const partes = valor.split('.');
  if (partes.length !== 2) return null;
  const [firma, carga] = partes as [string, string];
  if (!/^[A-Za-z0-9_-]+$/.test(firma) || !/^[A-Za-z0-9_-]+$/.test(carga)) return null;
  let datos: unknown;
  try {
    datos = JSON.parse(Buffer.from(carga, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof datos !== 'object' || datos === null) return null;
  const { algorithm, user_id: usuario, issued_at: emitida } = datos as { algorithm?: unknown; user_id?: unknown; issued_at?: unknown };
  if (typeof algorithm !== 'string' || algorithm.toUpperCase() !== 'HMAC-SHA256') return null;
  const id = typeof usuario === 'number' ? String(usuario) : usuario;
  if (typeof id !== 'string' || !/^[0-9]{1,30}$/.test(id)) return null;
  return {
    recibida: Buffer.from(firma, 'base64url'),
    esperada: createHmac('sha256', secreto).update(carga).digest(),
    usuario: id,
    emitida: typeof emitida === 'number' ? emitida : 0,
  };
}
