// ADR-0413 — Un usuario con un rol que exige segundo factor no obtiene sesión habilitada.
//
// El segundo factor basado en tiempo. Escrito a mano con `node:crypto`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ A MANO, Y CON QUÉ PARÁMETROS
//
// El `02` § 7 dice textualmente que el documento no trae *"la implementación del algoritmo de
// códigos"*. `EJECUCION` § 3 solo cierra *"basado en tiempo"*. El único parámetro escrito en los
// catorce documentos es **seis dígitos**, y ninguna biblioteca está nombrada en ninguno.
//
// Así que los parámetros son una decisión propia, y se eligen los del estándar de facto —los
// que usan Google Authenticator, 1Password, Authy y el resto— porque el requisito real es que
// el teléfono de la persona pueda leer el código:
//
//   · **6 dígitos** (lo único que la especificación fija)
//   · **período de 30 segundos**
//   · **HMAC-SHA1** — sí, SHA-1, y no es un descuido: es lo que dice RFC 6238 y lo que las
//     aplicaciones de autenticación implementan. Elegir SHA-256 "porque es mejor" produce
//     códigos que la aplicación del usuario **no genera**, y el síntoma es "el código nunca
//     funciona". La resistencia a colisiones de SHA-1 no es la propiedad que importa acá: lo
//     que importa es el HMAC con una clave de 20 bytes, que sigue siendo sólido.
//   · **tolerancia de ±1 ventana** (90 segundos de margen total), por la deriva de reloj del
//     teléfono. Más ventanas amplían la superficie de un código robado; menos hace que la
//     gente no pueda entrar.
//
// Sin dependencias: `.npmrc` tiene `ignore-scripts=true` y la lista de excepciones vacía, así
// que agregar una biblioteca es una decisión de otra clase. Son cuarenta líneas.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const DIGITOS = 6;
export const PERIODO_SEGUNDOS = 30;
/** Ventanas de tolerancia hacia atrás y hacia adelante. */
export const VENTANAS = 1;

const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Un secreto nuevo, en base32 sin relleno — el formato que leen las aplicaciones. */
export function secretoNuevo(): string {
  // 20 bytes es el largo que recomienda RFC 4226 para HMAC-SHA1.
  const crudo = randomBytes(20);
  let bits = 0;
  let valor = 0;
  let salida = '';
  for (const byte of crudo) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO_BASE32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO_BASE32[(valor << (5 - bits)) & 31];
  return salida;
}

function desdeBase32(texto: string): Buffer {
  const limpio = texto.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let valor = 0;
  for (const c of limpio) {
    const i = ALFABETO_BASE32.indexOf(c);
    if (i < 0) continue;
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** El código de una ventana concreta. RFC 6238 con truncamiento dinámico. */
function codigoDe(secreto: string, ventana: number): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(ventana));
  const mac = createHmac('sha1', desdeBase32(secreto)).update(contador).digest();
  // Truncamiento dinámico: los cuatro bits bajos del último byte dicen dónde empieza.
  const desplazamiento = (mac[mac.length - 1] ?? 0) & 0x0f;
  const binario =
    (((mac[desplazamiento] ?? 0) & 0x7f) << 24) |
    (((mac[desplazamiento + 1] ?? 0) & 0xff) << 16) |
    (((mac[desplazamiento + 2] ?? 0) & 0xff) << 8) |
    ((mac[desplazamiento + 3] ?? 0) & 0xff);
  return String(binario % 10 ** DIGITOS).padStart(DIGITOS, '0');
}

/** El código de ahora. Se usa en las pruebas y para el código de prueba del alta. */
export function codigoActual(secreto: string, ahoraMs = Date.now()): string {
  return codigoDe(secreto, Math.floor(ahoraMs / 1000 / PERIODO_SEGUNDOS));
}

/**
 * ¿Este código es válido para este secreto?
 *
 * La comparación es de **tiempo constante**. Un `===` sobre cadenas corta en el primer
 * carácter distinto, y con seis dígitos eso es un canal medible: se adivina un dígito por vez
 * en vez de un millón de combinaciones.
 */
export function codigoValido(secreto: string, codigo: string, ahoraMs = Date.now()): boolean {
  const limpio = codigo.replace(/\s/g, '');
  if (!/^\d+$/.test(limpio) || limpio.length !== DIGITOS) return false;

  const ventanaActual = Math.floor(ahoraMs / 1000 / PERIODO_SEGUNDOS);
  const dado = Buffer.from(limpio, 'utf8');

  // Se recorren TODAS las ventanas siempre, sin cortar en la primera que coincide: cortar
  // haría que un código de la ventana anterior tardara distinto que uno de la siguiente.
  let alguna = false;
  for (let d = -VENTANAS; d <= VENTANAS; d++) {
    const esperado = Buffer.from(codigoDe(secreto, ventanaActual + d), 'utf8');
    if (esperado.length === dado.length && timingSafeEqual(esperado, dado)) alguna = true;
  }
  return alguna;
}

/** Cuántos códigos de respaldo se generan, y de qué largo. */
export const RESPALDOS = 8;

/**
 * Códigos de respaldo, en claro. **Se muestran una vez y no se vuelven a mostrar.**
 *
 * Ni la cantidad ni el formato están en la especificación. Ocho es suficiente para no quedarse
 * sin ninguno y poco para que se puedan anotar. Se guardan **hasheados**, con el mismo hash
 * lento de las contraseñas: son secretos de baja entropía escritos por una persona, así que acá
 * sí corresponde el algoritmo caro — al contrario que el token de sesión.
 */
export function respaldosNuevos(): string[] {
  return Array.from({ length: RESPALDOS }, () =>
    randomBytes(5).toString('hex').toUpperCase().replace(/(.{5})/, '$1-'),
  );
}
