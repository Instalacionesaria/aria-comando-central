/* Lo que usa el tablero de Sales para escribir: la lista cerrada de frases y los formatos
 * (docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, SA-3). Vive aparte del panel, como en Conversion, para
 * que la prueba lea la lista sin el marcado alrededor. */

/* ── LA LISTA CERRADA DE FRASES (S15-02) ───────────────────────────────────
   Una frase nueva entra primero en el documento. Los rótulos con cifra —«{N} contactos asignados», «{N} sin
   venta»— no son frases de un hueco: son los desvíos de rótulo declarados en el mismo requisito. */
export const FRASE = {
  guion: '—',
  sinDato: 'Sin dato',
  sinAsistencia: 'Nadie marca la asistencia.',
  sinRegistros: 'Nadie registró en esta ventana.',
  reportado: 'reportado por el closer',
  bajoElPiso: 'Pocos intentos para una tasa.',
  sinMotivos: 'Sin motivos registrados.',
  fueraDelCatalogo: 'Fuera del catálogo',
  sinClosers: 'Sin closers configurados.',
  sinContactos: 'Sin contactos en este período',
  cargando: 'Cargando…',
  fallo: 'No se pudo leer. Reintenta.',
};

/** La frase de cada motivo por el que una cifra no tiene valor (`MotivoDeLaCifra` de `lecturaDeSales.ts`). */
export const FRASE_DEL_MOTIVO = {
  sin_asistencia: FRASE.sinAsistencia,
  sin_registros: FRASE.sinRegistros,
  bajo_el_piso: FRASE.bajoElPiso,
};

// ─── Los formatos. El guion es «no se sabe» o «bajo el piso», NUNCA un cero. ──

/** Lo único que multiplica por 100: todo viaja de 0 a 1 (S15-13). */
export const cien = (v) => Math.round(v * 100);

/** Un conteo entero, como lo escribe el prototipo: «1,240». */
export const miles = (n) => n.toLocaleString('es-PE');
/** Un monto reportado, con el signo del prototipo: «$55,200». */
export const plata = (n) => `$${Math.round(n).toLocaleString('es-PE')}`;
export const pf = (v) => `${cien(v)}%`;
export const o = (v, formato) => (v === null || v === undefined ? FRASE.guion : formato(v));
