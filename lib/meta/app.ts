// La app de Meta de ARIA: con ella se conectan todos («Conectar con Meta», Meta directo M2).
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ VIVE EN EL ENTORNO, Y POR QUÉ NO ES UNA CREDENCIAL DE UN INQUILINO
//
// El token de cada negocio conectado es de ese negocio y vive cifrado en `identidad.conexiones_de_meta`. La app es de
// ARIA y es UNA: su id, su secreto y la configuración de Facebook Login for Business (`config_id`, la que pide el token
// del usuario del sistema de la integración y `ads_read`) se cargan en el entorno del servidor, como la pimienta del
// aviso del CRM. Nunca con el prefijo `NEXT_PUBLIC_`: el diálogo de Meta se arma en el servidor y el navegador sólo
// recibe la URL.
//
// Cada variable se valida al usarse, sin respaldo (como `CLAVE_MAESTRA`): sin la app configurada, «Conectar con Meta»
// dice que falta, y nada más se rompe.
// ═══════════════════════════════════════════════════════════════════════════════
import { createHmac } from 'node:crypto';

export interface AppDeMeta {
  appId: string;
  secreto: string;
  configId: string;
}

/** Qué falta para usar la app de Meta, o `null` si está toda. Sin valores: sólo los nombres. */
export function faltaDeLaAppDeMeta(): string[] {
  return ['META_APP_ID', 'META_APP_SECRET', 'META_CONFIG_ID'].filter((v) => !process.env[v]?.trim());
}

/** La app de Meta de ARIA. Lanza si falta alguna de las tres variables: quien llama ya preguntó con `faltaDeLaAppDeMeta`. */
export function appDeMeta(): AppDeMeta {
  const faltan = faltaDeLaAppDeMeta();
  if (faltan.length > 0) throw new Error(`faltan las variables de la app de Meta: ${faltan.join(', ')}`);
  const appId = process.env.META_APP_ID!.trim();
  const configId = process.env.META_CONFIG_ID!.trim();
  if (!/^\d{5,30}$/.test(appId)) throw new Error('META_APP_ID no tiene forma de id de app de Meta (sólo dígitos)');
  if (!/^\d{5,30}$/.test(configId)) throw new Error('META_CONFIG_ID no tiene forma de id de configuración (sólo dígitos)');
  return { appId, secreto: process.env.META_APP_SECRET!.trim(), configId };
}

/**
 * El `appsecret_proof` de un token: HMAC-SHA256 del token con el secreto de la app, en hexadecimal. Meta lo exige a los
 * tokens de su app cuando la app tiene activado «Requerir el secreto de la app», y lo recomienda siempre: un token
 * robado sin el secreto no sirve. Sólo vale para tokens emitidos por NUESTRA app (los de conexiones `oauth`); un token
 * pegado a mano de la app de otro negocio con esta prueba sería rechazado.
 */
export function pruebaDelSecreto(token: string, secreto = appDeMeta().secreto): string {
  return createHmac('sha256', secreto).update(token).digest('hex');
}

/**
 * Adónde vuelve Meta después del diálogo. Tiene que estar, idéntica, en «Valid OAuth Redirect URIs» de la app, y es la
 * misma en el diálogo y en el canje (Meta compara las dos). Sale de `DOMINIO_ESPERADO` —el mismo dominio contra el que
 * `verificarOrigen` compara— y nunca del pedido: un `Host` falsificado no puede mandar el código a otro lado.
 */
export function urlDeRetorno(): string {
  const dominio = process.env.DOMINIO_ESPERADO?.trim();
  if (!dominio) throw new Error('falta DOMINIO_ESPERADO: sin él no hay adónde volver de Meta');
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(dominio);
  return `${local ? 'http' : 'https'}://${dominio}/meta/retorno`;
}
