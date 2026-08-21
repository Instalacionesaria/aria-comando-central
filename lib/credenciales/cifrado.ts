// ADR-0601 — Nada cifrado se guarda sin autenticación.
// ADR-0602 — La clave maestra se valida al usarse, con un mensaje que dice qué hacer.
//
// El primitivo de cifrado. **Adelantado de la Etapa 6, y solo esto.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTÁ ACÁ Y NO EN LA ETAPA 6
//
// `EJECUCION` § 5 pone el segundo factor en el cierre de la Etapa 4 y el cifrado en el de la
// 6, y las dos cosas no se pueden separar: `identidad.usuarios_segundo_factor.secreto_cifrado`
// es `text not null`, y el `08` § 10 y el comentario de la migración 006 exigen cifrarlo **con
// la clave maestra**. No existe camino que escriba una fila de segundo factor en la Etapa 4 sin
// esto.
//
// `EJECUCION` § 6 dice que ese conflicto se pregunta, no se decide. Se preguntó, y la
// respuesta fue adelantar **el mínimo**: `claveMaestra()`, `cifrar` y `descifrar`, y nada más.
//
// Lo que sigue siendo Etapa 6: la función única `resolverCredenciales`, el enmascarado del
// `06` § 7, los cuatro estados de credencial, el refresco con candado del `08` § 9, y toda la
// tabla `organizaciones_credenciales`.
// ═══════════════════════════════════════════════════════════════════════════════

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * La clave maestra. 32 bytes, del entorno, **en base64 o en hexadecimal**.
 *
 * Aceptar los dos formatos no es indulgencia: el `06` § 4 dice que *"evita el error de
 * configuración más común, que es pegar la clave en el formato que no era"*.
 *
 * Se valida **al usarse** y no al importarse. Es la misma regla que `lib/datos/entorno.ts`:
 * validar en la carga del módulo haría que un despliegue sin la variable **tumbara el build**
 * en vez de fallar en la primera operación que la necesita.
 */
export function claveMaestra(): Buffer {
  const crudo = process.env.CLAVE_MAESTRA;
  if (!crudo) {
    throw new Error(
      'CLAVE_MAESTRA no está definida. Tiene que ser de 32 bytes en base64 o hexadecimal.',
    );
  }
  // Se prueban los dos formatos y se elige el que dé exactamente 32 bytes. `Buffer.from` no
  // lanza sobre entrada inválida —trunca en silencio— así que el largo es la única validación
  // que sirve.
  const candidatos = [
    Buffer.from(crudo, 'base64'),
    /^[0-9a-fA-F]+$/.test(crudo) ? Buffer.from(crudo, 'hex') : Buffer.alloc(0),
  ];
  const clave = candidatos.find((c) => c.length === 32);
  if (!clave) {
    throw new Error('CLAVE_MAESTRA tiene que ser de 32 bytes en base64 o hexadecimal');
  }
  return clave;
}

/** Doce bytes. El `06` § 3 los fija, y el largo se verifica al descifrar. */
const LARGO_NONCE = 12;

/**
 * Cifra un texto. Formato guardado: `<nonce>:<etiqueta>:<cifrado>`, los tres en base64.
 *
 * **AES-256-GCM, o sea cifrado AUTENTICADO**, y el `06` § 3 explica por qué no alcanza cifrar:
 *
 *   "Con un modo sin autenticación (CBC, CTR a secas), si alguien modifica el dato cifrado el
 *    descifrado DEVUELVE BASURA QUE PARECE UN TOKEN. Ese 'token' sale hacia el servicio
 *    externo, falla con un error de autenticación, y nadie entiende por qué. Con AEAD, el
 *    descifrado FALLA y el error dice la verdad."
 *
 * ── EL NONCE ES ALEATORIO EN CADA LLAMADA, SIN EXCEPCIONES ───────────────────
 *
 * El `06` § 3 lo llama *"el error más fácil de cometer… y el más caro"*:
 *
 *   "REUSAR UN NONCE CON LA MISMA CLAVE EN GCM ROMPE EL CIFRADO POR COMPLETO. No lo debilita:
 *    permite recuperar el texto en claro de los mensajes afectados."
 *
 * Y nombra la tentación exacta: *"parece razonable derivar el nonce del identificador de la
 * organización, para que sea 'determinista'"*. Hay una prueba que afirma que dos cifrados del
 * mismo texto dan resultados distintos.
 */
export function cifrar(textoPlano: string): string {
  const nonce = randomBytes(LARGO_NONCE);
  const cifrador = createCipheriv('aes-256-gcm', claveMaestra(), nonce);
  const cifrado = Buffer.concat([cifrador.update(textoPlano, 'utf8'), cifrador.final()]);
  const etiqueta = cifrador.getAuthTag();
  return [nonce, etiqueta, cifrado].map((b) => b.toString('base64')).join(':');
}

/**
 * Descifra. **Lanza** si el valor fue modificado o si la clave cambió.
 *
 * El mensaje dice qué hacer, y eso tampoco es cortesía. El `06` § 3:
 *
 *   "Cuando la clave maestra no coincide, el mensaje EXPLÍCITO ('volvé a cargar la credencial')
 *    es lo que convierte media hora de depuración en diez segundos. Y pasa seguido: cada vez
 *    que alguien corre el proyecto en otra máquina, o restaura una copia de la base en otro
 *    entorno, la clave maestra es otra y NINGUNA credencial se puede leer."
 *
 * **Nunca devuelve nulo ni cadena vacía**: *"un token vacío produce un error de autenticación
 * del servicio externo, tres capas más abajo, imposible de diagnosticar"*.
 */
export function descifrar(blob: string): string {
  const partes = blob.split(':');
  if (partes.length !== 3) {
    throw new Error('Formato de credencial inválido');
  }
  const [nonce, etiqueta, cifrado] = partes.map((p) => Buffer.from(p, 'base64'));
  if (!nonce || nonce.length !== LARGO_NONCE) {
    throw new Error('Nonce de largo inesperado');
  }
  if (!etiqueta || !cifrado) {
    throw new Error('Formato de credencial inválido');
  }
  try {
    const descifrador = createDecipheriv('aes-256-gcm', claveMaestra(), nonce);
    descifrador.setAuthTag(etiqueta);
    return Buffer.concat([descifrador.update(cifrado), descifrador.final()]).toString('utf8');
  } catch {
    throw new Error(
      'No se pudo descifrar: el valor fue modificado o la clave maestra cambió. ' +
        'Hay que volver a cargar la credencial desde el panel.',
    );
  }
}
