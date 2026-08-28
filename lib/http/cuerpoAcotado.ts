// Leer el cuerpo de una petición SIN pasarse de un tope, abortando en el camino.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTE ARCHIVO EXISTE PORQUE HOY NO HAY NADA
//
// Comprobado con `grep`: **cero apariciones de `content-length`** en `app/`, `lib/`, `proxy.ts`,
// `next.config.mjs` y `pruebas/`. Contra un cuerpo enorme este repositorio no hace absolutamente
// nada a nivel global.
//
// Los topes que sí existen se aplican **DESPUÉS** de leer todo. `app/api/admin/credenciales/route.ts`
// tiene `TOPE = 4096` y parsea el cuerpo antes de comprobarlo: es un tope **por campo**, no por
// cuerpo, y copiarlo para una ruta pública daría un 413 que llega tarde — el cuerpo ya se leyó
// entero, ya se parseó, y ya se pagó la memoria.
//
// Y `vercel.json` no puede declarar `functions`: lo prohíbe una prueba
// (`pruebas/codigo/99-cron.test.ts`), así que el tope tampoco puede venir de la configuración.
//
// ═══════════════════════════════════════════════════════════════════════════════
// SE LEE DEL FLUJO Y SE ABORTA AL PASARSE — no se mide después
//
// La diferencia entre esto y «leer todo y después medir» es la que importa: con la segunda, un cuerpo
// de 100 MB se lee entero en memoria y RECIÉN entonces se rechaza. El rechazo llega, y el daño ya
// está hecho. Acá se acumula por trozos y se corta en el primero que pasa el tope.
//
// `content-length` se mira solo como atajo barato, nunca como la defensa: **lo escribe el cliente** y
// con `Transfer-Encoding: chunked` no viene. Una prueba manda un cuerpo grande sin esa cabecera
// justamente para que el atajo no pueda ser lo único.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * El tope, y sale de una medición.
 *
 * Los cuerpos reales del buzón de la plataforma anterior (1.192 filas, el 2026-08-28):
 *
 *   · contacto  11.123 bytes
 *   · cita      11.216 bytes
 *   · llamada   **29.936 bytes** ← casi el triple, por la transcripción completa
 *
 * 64 KiB deja más del doble de holgura sobre el máximo medido. El primer número que se propuso fue
 * 32 KiB y era **demasiado ajustado**: apenas un 9 % arriba de 29.936, así que una transcripción algo
 * más larga que las medidas se rechazaría — y el síntoma sería «algunas llamadas no entran», que es
 * de los peores porque parece intermitente.
 *
 * El rechazo es RUIDOSO —413 más una línea al registro— y la columna `bytes` de la cuarentena guarda
 * el tamaño de todo lo que entra, así que un tope mal puesto se descubre mirando la distribución en
 * vez de perdiendo avisos en silencio.
 */
export const TOPE_DEL_CUERPO = 64 * 1024;

/** Lo que puede pasar al leer un cuerpo acotado. */
export type CuerpoLeido =
  | { ok: true; texto: string; bytes: number }
  /** No vino ningún cuerpo. Distinto de un cuerpo vacío, y distinto de uno gigante. */
  | { ok: false; porque: 'sin_cuerpo' }
  | { ok: false; porque: 'demasiado_grande' };

/**
 * Leer el cuerpo hasta `tope` bytes, abortando en cuanto se pasa.
 *
 * @param tope Inyectable para poder probar el borde con números chicos, sin construir un cuerpo de
 *   64 KiB en cada caso. La ruta usa el valor por omisión.
 */
export async function leerCuerpoAcotado(
  peticion: Request,
  tope: number = TOPE_DEL_CUERPO,
): Promise<CuerpoLeido> {
  /* EL ATAJO, y solo eso. Si el cliente declara un tamaño imposible se corta sin leer un byte — es
     gratis y evita el trabajo. Pero NO se confía en él para nada más: lo escribe quien llama, y con
     `Transfer-Encoding: chunked` la cabecera no existe. */
  const declarado = Number(peticion.headers.get('content-length') ?? '');
  if (Number.isFinite(declarado) && declarado > tope) {
    return { ok: false, porque: 'demasiado_grande' };
  }

  const flujo = peticion.body;
  if (flujo === null) return { ok: false, porque: 'sin_cuerpo' };

  const lector = flujo.getReader();
  const trozos: Uint8Array[] = [];
  let acumulado = 0;

  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      if (value === undefined) continue;

      acumulado += value.byteLength;
      /* LA COMPROBACIÓN VA ANTES DE GUARDAR EL TROZO, y ese orden es la única diferencia entre esto y
         un tope que no acota nada. Moverla al final del bucle —o afuera— convierte esta función en
         «leer todo y después medir», que es exactamente lo que no se puede hacer en una ruta
         pública. Lo acumulado nunca pasa del tope más un trozo. */
      if (acumulado > tope) {
        // Se cancela el flujo: sin esto, el resto del cuerpo se sigue transfiriendo por nada.
        await lector.cancel().catch(() => undefined);
        return { ok: false, porque: 'demasiado_grande' };
      }
      trozos.push(value);
    }
  } finally {
    lector.releaseLock();
  }

  if (acumulado === 0) return { ok: false, porque: 'sin_cuerpo' };

  const todo = new Uint8Array(acumulado);
  let cursor = 0;
  for (const t of trozos) {
    todo.set(t, cursor);
    cursor += t.byteLength;
  }

  return { ok: true, texto: new TextDecoder().decode(todo), bytes: acumulado };
}
