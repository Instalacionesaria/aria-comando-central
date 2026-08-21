// ADR-0506 — La contraseña temporal nunca queda registrada.
// ADR-0507 — El generador de temporales no tiene sesgo.
//
// La contraseña temporal. El algoritmo es del `05` § 3, **literal**.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL SESGO MODULAR, Y POR QUÉ ACÁ SE ESCRIBE EL DESCARTE A MANO
//
// El `05` § 3 escribe el algoritmo y el motivo:
//
//   "**Sin sesgo de módulo**: hay que descartar los bytes que caen en el resto incompleto del
//    rango. Un `byte % largoAlfabeto` sin ese descarte hace que los primeros caracteres del
//    alfabeto salgan más seguido, y eso reduce la entropía de TODAS las contraseñas temporales
//    del sistema."
//
//   funcion generarTemporal(largo = 14):
//       limite = 256 - (256 % ALFABETO.largo)
//       salida = ""
//       mientras salida.largo < largo:
//           para cada byte en bytesAleatorios(largo * 2):
//               si byte >= limite: continuar        # <-- el descarte
//               salida += ALFABETO[byte % ALFABETO.largo]
//               si salida.largo == largo: cortar
//       devolver salida
//
// **`randomInt` de `node:crypto` hace exactamente lo mismo** —muestreo con rechazo, internamente—
// y sería tres líneas menos. No se usa a propósito: el `05` es normativo y `EJECUCION` § 6 dice
// que *"si un documento describe algo, se usa ESE"*. Escrito así, un revisor puede diffear estas
// líneas contra el documento, que es el método de todo el proyecto.
//
// Si alguien lo "simplifica" a `randomInt`, el resultado sigue siendo correcto — pero si lo
// simplifica a `randomBytes(1)[0] % ALFABETO.length`, **el defecto es invisible**: la contraseña
// se ve perfectamente aleatoria y solo aparece contando cientos de miles de muestras. Por eso la
// prueba es estadística.
// ═══════════════════════════════════════════════════════════════════════════════

import { randomBytes } from 'node:crypto';

/**
 * El alfabeto: alfanumérico **sin `l`, `I`, `O`, `0` ni `1`**.
 *
 * Los cinco excluidos son los que nombra el `05` § 3, y el motivo que da es operativo, no
 * estético: *"porque estas contraseñas se dictan por teléfono o se copian a mano"*.
 *
 * Se consideró excluir también `5`/`S` y `2`/`Z`, que también se confunden — y se **descartó**:
 * el documento ya tomó esa decisión y nombró cinco. Cambiar la lista sin un motivo más fuerte
 * que "a mí me parecen confusos" es inventar sobre un documento normativo, y de paso movería la
 * entropía y el límite del descarte sin que nadie lo notara.
 *
 * Quedan 57 caracteres. Con 14, son ~81 bits.
 */
export const ALFABETO =
  'ABCDEFGHJKLMNPQRSTUVWXYZ' + 'abcdefghijkmnopqrstuvwxyz' + '23456789';

/** Catorce, del `05` § 3. */
export const LARGO = 14;

/**
 * El límite del descarte: el mayor múltiplo del alfabeto que cabe en un byte.
 *
 * Con 57 caracteres son 228. Los bytes de 228 a 255 se **descartan**: si se usaran,
 * `byte % 57` los mapearía a los primeros 28 caracteres, que saldrían un 20 % más seguido.
 */
export const LIMITE = 256 - (256 % ALFABETO.length);

/**
 * Una contraseña temporal de 14 caracteres.
 *
 * **No se registra en ningún lado.** El `05` § 3: *"se muestra una sola vez, en la respuesta del
 * alta. No se puede volver a consultar: para eso está el restablecimiento, que genera otra."* Y
 * *"no se registra en la auditoría. El email sí; la contraseña temporal nunca, ni ahí. Un
 * registro de auditoría con contraseñas temporales es una lista de credenciales válidas de
 * cuentas que todavía no las cambiaron."*
 */
export function contrasenaTemporal(largo = LARGO): string {
  let salida = '';
  while (salida.length < largo) {
    // `largo * 2` por vuelta: con un 11 % de descarte, una sola vuelta alcanza casi siempre. El
    // bucle exterior está para el caso en que no.
    for (const byte of randomBytes(largo * 2)) {
      if (byte >= LIMITE) continue; // ← el descarte
      salida += ALFABETO[byte % ALFABETO.length];
      if (salida.length === largo) break;
    }
  }
  return salida;
}
