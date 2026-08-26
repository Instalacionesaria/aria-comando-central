// Las zonas horarias que se ofrecen, y por qué son una lista y no un campo libre.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTO CIERRA, Y ESTABA EN PRODUCCIÓN
//
// `identidad.organizaciones.zona_horaria` es `not null default 'UTC'`, y **el formulario no ofrecía
// el campo**. Medido en producción antes de escribir esto:
//
//   ARIA     America/Lima
//   PRUEBA   UTC   ← nadie la configuró
//   Aivora   UTC   ← nadie la configuró
//
// Y las citas del calendario de GoHighLevel vienen con desfase `-05:00`. Para esas dos empresas,
// **toda cita posterior a las 19:00 se dibujaría el día siguiente** — y nada lo diría: la cita vino,
// no hay error, no hay registro. Es el defecto de la hora que el proyecto ya había cerrado con una
// sola definición, reintroducido por un valor por omisión.
//
// ── POR QUÉ UNA LISTA Y NO UN CAMPO DE TEXTO ───────────────────────────────
//
// Un texto libre acepta `Lima`, `GMT-5`, `America/lima` y `Perú`, y **ninguno de los cuatro
// funciona**: `Intl.DateTimeFormat` lanza con una zona que no conoce, y PostgreSQL con
// `timezone('Perú', now())` también. Con una lista, lo que se guarda es siempre un nombre válido.
//
// Son pocas a propósito: las de los países donde este sistema opera, más UTC. Agregar una es agregar
// un renglón — y el día que haga falta cualquiera, el catálogo del navegador
// (`Intl.supportedValuesOf('timeZone')`) tiene cientos, pero ofrecerlas todas convierte un campo de
// dos segundos en una búsqueda.
// ═══════════════════════════════════════════════════════════════════════════════

/** Las zonas ofrecidas, con el nombre que una persona reconoce. */
export const ZONAS = [
  { valor: 'America/Lima', nombre: 'Lima · Perú (GMT-5)' },
  { valor: 'America/Bogota', nombre: 'Bogotá · Colombia (GMT-5)' },
  { valor: 'America/Mexico_City', nombre: 'Ciudad de México (GMT-6)' },
  { valor: 'America/Santiago', nombre: 'Santiago · Chile' },
  { valor: 'America/Argentina/Buenos_Aires', nombre: 'Buenos Aires · Argentina (GMT-3)' },
  { valor: 'America/Sao_Paulo', nombre: 'São Paulo · Brasil (GMT-3)' },
  { valor: 'America/Guayaquil', nombre: 'Guayaquil · Ecuador (GMT-5)' },
  { valor: 'America/La_Paz', nombre: 'La Paz · Bolivia (GMT-4)' },
  { valor: 'America/Asuncion', nombre: 'Asunción · Paraguay' },
  { valor: 'America/Montevideo', nombre: 'Montevideo · Uruguay (GMT-3)' },
  { valor: 'America/Caracas', nombre: 'Caracas · Venezuela (GMT-4)' },
  { valor: 'America/Panama', nombre: 'Panamá (GMT-5)' },
  { valor: 'America/Costa_Rica', nombre: 'San José · Costa Rica (GMT-6)' },
  { valor: 'America/Guatemala', nombre: 'Guatemala (GMT-6)' },
  { valor: 'America/Santo_Domingo', nombre: 'Santo Domingo · Rep. Dominicana (GMT-4)' },
  { valor: 'America/New_York', nombre: 'Nueva York · EE.UU. este' },
  { valor: 'America/Chicago', nombre: 'Chicago · EE.UU. centro' },
  { valor: 'America/Denver', nombre: 'Denver · EE.UU. montaña' },
  { valor: 'America/Los_Angeles', nombre: 'Los Ángeles · EE.UU. oeste' },
  { valor: 'Europe/Madrid', nombre: 'Madrid · España' },
  { valor: 'UTC', nombre: 'UTC · tiempo universal (sin zona local)' },
] as const;

/**
 * ¿Es una zona que se puede guardar?
 *
 * Se valida contra el catálogo **y** contra el motor de fechas, en ese orden. Lo primero acota lo
 * que se ofrece; lo segundo es lo que garantiza que no explote al mostrarla, y hace falta porque el
 * catálogo lo escribe una persona y un error de tipeo acá se convertiría en una pantalla que lanza.
 */
export function esZonaValida(v: unknown): v is string {
  if (typeof v !== 'string' || v.trim() === '') return false;
  const z = v.trim();
  if (!ZONAS.some((x) => x.valor === z)) return false;
  try {
    new Intl.DateTimeFormat('es', { timeZone: z }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
