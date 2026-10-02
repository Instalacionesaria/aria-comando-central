// El saludo del Inicio: «Buenos días, Ana.» en la hora de la EMPRESA (`NE-29`).
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ LA HORA ES LA DE LA EMPRESA Y NO LA DEL NAVEGADOR
//
// `lib/negocio/tiempo.ts` lo dice para toda la aplicación: toda hora que una persona lee se cuenta en
// la zona de la ORGANIZACIÓN. El saludo es una hora que se lee, aunque no lleve números. Con la del
// navegador, quien abre la aplicación de viaje o con la máquina mal configurada leería «Buenas
// noches» a media mañana de su empresa, y no fallaría nada.
//
// Un archivo aparte de `tiempo.ts` porque esto no es una fecha: es un texto de interfaz, con su
// propia regla del nombre. La hora sí viene de allá (`horaDelDiaEnZona`), que es la definición única
// de «qué hora es en la empresa». Sin React y sin DOM, así se prueba con `node:test`
// (`pruebas/codigo/190-el-saludo-en-la-zona-de-la-empresa.test.ts`).
// ═══════════════════════════════════════════════════════════════════════════════

import { horaDelDiaEnZona } from './negocio/tiempo.ts';

/**
 * El nombre de pila: «Ana» de «Ana Pérez». Vacío si no hay nombre.
 *
 * La base guarda un solo `nombre` (`identidad.usuarios`), así que «María José Pérez» se saluda
 * «María»: sin otra columna no se distingue de «María Pérez». Parte por espacios igual que
 * `iniciales()` del menú, para que el avatar y el saludo coincidan en qué es «la primera palabra».
 */
export function nombreDePila(nombre: string | null | undefined): string {
  return String(nombre ?? '').trim().split(/\s+/)[0] ?? '';
}

/** Los cortes de `NE-29`: «Buenos días» hasta las 12, «Buenas tardes» hasta las 19, «Buenas noches» después. */
export function saludoDeLaHora(hora: number): 'Buenos días' | 'Buenas tardes' | 'Buenas noches' {
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * «Buenas tardes, Ana.», o «Buenas tardes.» sin nombre: nunca una coma colgando.
 *
 * `ahora` se recibe desde afuera, como en `haceCuanto`, para poder probar sin tocar el reloj; la
 * pantalla usa el valor por omisión, `new Date()`.
 */
export function saludo(nombre: string | null | undefined, zona: string, ahora: Date = new Date()): string {
  const base = saludoDeLaHora(horaDelDiaEnZona(ahora, zona));
  const pila = nombreDePila(nombre);
  return pila ? `${base}, ${pila}.` : `${base}.`;
}
