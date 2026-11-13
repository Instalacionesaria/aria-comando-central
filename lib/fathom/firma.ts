// LOS SECRETOS DEL WEBHOOK DE FATHOM Y LA FIRMA ESPERADA.
//
// La firma es la de «Standard Webhooks»: HMAC-SHA256 de `id.timestamp.cuerpo` con el secreto decodificado de base64
// (lo que va después de `whsec_`), en base64. La cabecera `webhook-signature` trae una o varias, `v1,<base64>`,
// separadas por espacio.
//
// La COMPARACIÓN no está acá: la hace la ruta, con su `timingSafeEqual(` a la vista, porque
// `pruebas/codigo/30-portero.test.ts` exige esa llamada literal en cada ruta con secreto propio.
//
// El secreto vive en `FATHOM_SECRETO_WEBHOOK` (la 116 explica la excepción a ADR-0604). Admite varios separados por
// coma, para rotarlo sin cortar: se agrega el nuevo, se cambia en Fathom y se quita el viejo.

import { createHmac } from 'node:crypto';

const PREFIJO = 'whsec_';

/** El tiempo que puede separar el `webhook-timestamp` de ahora: el de la especificación, cinco minutos. */
export const TOLERANCIA_DE_LA_FIRMA_SEG = 300;

/**
 * Los secretos configurados, válidos. Lo que no empieza con `whsec_` se descarta: pegado sin el prefijo daría firmas
 * malas en silencio. Una lista vacía quiere decir «no configurado», y la ruta rechaza todo.
 */
export function secretosDeFathom(): string[] {
  const valor = process.env.FATHOM_SECRETO_WEBHOOK;
  if (!valor) return [];
  return valor
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.startsWith(PREFIJO) && s.length > PREFIJO.length);
}

/** La firma que habría mandado Fathom con ese secreto: el texto base64, como Buffer, listo para comparar. */
export function firmaEsperadaDeFathom(secreto: string, id: string, timestamp: string, cuerpoCrudo: string): Buffer {
  const clave = Buffer.from(secreto.slice(PREFIJO.length), 'base64');
  return Buffer.from(createHmac('sha256', clave).update(`${id}.${timestamp}.${cuerpoCrudo}`).digest('base64'));
}

/** Las firmas de la cabecera, sin su versión (`v1,`), como Buffer. */
export function firmasDeLaCabecera(cabecera: string): Buffer[] {
  return cabecera
    .split(' ')
    .filter(Boolean)
    .map((f) => {
      const coma = f.indexOf(',');
      return Buffer.from(coma >= 0 ? f.slice(coma + 1) : f);
    });
}

/** ¿El timestamp está dentro de la tolerancia? Un texto que no es número, no. */
export function timestampVigente(timestamp: string, ahoraSeg: number = Math.floor(Date.now() / 1000)): boolean {
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  return Math.abs(ahoraSeg - Number.parseInt(timestamp, 10)) <= TOLERANCIA_DE_LA_FIRMA_SEG;
}
