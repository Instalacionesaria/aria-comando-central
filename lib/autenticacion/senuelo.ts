// ADR-0401 — El mensaje único va con el tiempo único.
//
// El señuelo: el hash contra el que se deriva cuando el correo no existe.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL MENSAJE ÚNICO NO ALCANZA. HAY QUE GASTAR EL MISMO TIEMPO.
//
// El `07` § 3 lo dice sin vueltas:
//
//   "Responder 'no existe' al instante y 'contraseña incorrecta' 100 ms después DICE
//    EXACTAMENTE LO QUE EL MENSAJE ÚNICO VENÍA A ESCONDER. Con un cronómetro se enumeran
//    cuentas igual."
//
// La línea que abre ese canal es la que parece obviamente correcta:
//
//     if (!usuario) return rechazo(...)      // ← acá se pierde todo
//
// Con el señuelo, los tres caminos —correo inexistente, cuenta inactiva, contraseña mal—
// derivan un hash y tardan lo mismo.
//
// ── DOS DETALLES QUE PARECEN LIMPIEZA Y NO LO SON ────────────────────────────
//
// 1. **Los mismos parámetros y el mismo largo de clave.** `verificar()` de
//    `lib/datos/hash.ts` deriva con `largo = esperado.length`, así que un señuelo con un
//    hash de 32 bytes en vez de 64 **cuesta menos** y el camino del correo inexistente
//    vuelve a ser el más rápido. Este valor tiene `N=16384, r=8, p=1` y 64 bytes, iguales
//    a los que produce `hashear()`.
//
// 2. **La comparación de largos va DESPUÉS de derivar**, y eso ya está así en
//    `lib/datos/hash.ts` con su comentario. El `02` § 4 lo marca como *"detalle que parece
//    limpieza y no lo es: si cortara antes, el camino del señuelo terminaría más rápido que
//    el de un hash real y el canal de tiempo se abriría por la puerta de al lado"*. Hay una
//    prueba que lo afirma leyendo el código fuente, porque la de tiempos es sensible al
//    ruido.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * El hash señuelo.
 *
 * Generado UNA vez con una contraseña aleatoria de 32 bytes que se descartó. **No es un
 * secreto**: es el hash de una contraseña que nadie conoce, y su único trabajo es costar
 * lo mismo que un hash real.
 *
 * Es una constante del código fuente y no una variable de entorno, por dos razones: el
 * `02` § 4 escribe *"salt fijo"*, y derivarlo en el arranque costaría ~100 ms en cada
 * arranque en frío de la función, para nada.
 */
export const SENUELO =
  'scrypt$16384$8$1$GN4U3lj/EzMH9gN+G0WMgw==$tJl27iDU11dCPcz49vWlh0EfABGPDOzXMAkl73xsVEi0KuqSSQUChWMV994OX9WXf0Y+HLS0Mfzg/Uv24zRolw==';
