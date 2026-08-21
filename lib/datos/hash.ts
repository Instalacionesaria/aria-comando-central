// ADR-0003 — el sembrado necesita usuarios con credenciales completas.
//
// Hash de contraseñas. `scrypt` de la biblioteca estándar, cero dependencias.
//
// Fuente: 02-AUTENTICACION § 1. EJECUCION § 3 cerró la decisión: "el lento que
// trae la biblioteca estándar del entorno, con parámetros explícitos y guardados
// en el propio hash".
//
// La Etapa 0 lo necesita porque el criterio de cierre pide usuarios sembrados, y la
// restricción `usuarios_credenciales_completas` exige que email y hash vayan
// juntos. La verificación completa del login es Etapa 4; acá está el formato.

import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

// Calibrados para ~100 ms por hash. `128 · N · r` = 16 MB de memoria por hash, que
// entra en el límite por omisión de Node (32 MB). Subir N a 32768 NO entraría.
const N = 16384;
const R = 8;
const P = 1;
const LARGO_CLAVE = 64;
const LARGO_SAL = 16;
const ETIQUETA = 'scrypt';

// Los parámetros van DENTRO del string, junto a la sal y al hash. Es lo que permite
// subir el costo sin invalidar las contraseñas viejas: cada hash se verifica con los
// parámetros con los que nació, y los nuevos usan los actuales. Guardar solo el hash
// y tener el costo como constante del código significa que el día que quieras
// endurecerlo tenés que resetearle la contraseña a todo el mundo.
//
//   scrypt$16384$8$1$<sal en base64>$<hash en base64>

function derivar(textoPlano: string, sal: Buffer, n: number, r: number, p: number, largo: number): Buffer {
  // Normalización Unicode NFKC ANTES de derivar. Sin esto, la misma contraseña
  // tipeada en otro teclado o sistema operativo llega con otra composición de
  // caracteres y no coincide. El usuario jura que la escribió bien, y tiene razón.
  const normalizada = textoPlano.normalize('NFKC');
  // `maxmem` explícito: 128·N·r con holgura. Sin esto, un N alto lanza un error
  // opaco en vez de decir que se pasó del límite de memoria.
  return scryptSync(normalizada, sal, largo, { N: n, r, p, maxmem: 256 * 1024 * 1024 });
}

export function hashear(textoPlano: string): string {
  const sal = randomBytes(LARGO_SAL);
  const clave = derivar(textoPlano, sal, N, R, P, LARGO_CLAVE);
  return [ETIQUETA, N, R, P, sal.toString('base64'), clave.toString('base64')].join('$');
}

export function verificar(textoPlano: string, guardado: string): boolean {
  // Un hash con formato inválido devuelve "no coincide", NO una excepción. Un
  // registro corrupto no puede convertirse en un error 500, porque ese error revela
  // que ese usuario existe.
  try {
    const partes = guardado.split('$');
    if (partes.length !== 6) return false;
    const [etiqueta, nTexto, rTexto, pTexto, salB64, hashB64] = partes;
    if (etiqueta !== ETIQUETA) return false;

    const n = Number(nTexto);
    const r = Number(rTexto);
    const p = Number(pTexto);
    if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
    // Cotas de sanidad: un N absurdo desde un registro alterado sería una
    // denegación de servicio por agotamiento de memoria en la ruta del login.
    if (n < 2 || n > 1 << 20 || r < 1 || r > 32 || p < 1 || p > 16) return false;

    const sal = Buffer.from(salB64 ?? '', 'base64');
    const esperado = Buffer.from(hashB64 ?? '', 'base64');
    if (sal.length === 0 || esperado.length === 0) return false;

    const calculado = derivar(textoPlano, sal, n, r, p, esperado.length);

    // La comparación de largos va DESPUÉS de derivar. Si cortara antes, el camino
    // del señuelo del login terminaría más rápido que el de un hash real y el canal
    // de tiempo se abriría por la puerta de al lado (02 § 4).
    if (calculado.length !== esperado.length) return false;

    // Comparación en tiempo constante. Nunca el operador de igualdad: una
    // comparación que corta en el primer byte distinto filtra información por el
    // tiempo que tarda.
    return timingSafeEqual(calculado, esperado);
  } catch {
    return false;
  }
}
