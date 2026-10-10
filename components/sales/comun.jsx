/* Lo que usa el tablero de Sales para escribir: la lista cerrada de frases y los formatos
 * (docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, SA-3). Vive aparte del panel, como en Conversion, para
 * que la prueba lea la lista sin el marcado alrededor. */

/* ── LA LISTA CERRADA DE FRASES (S15-02) ───────────────────────────────────
   Una frase nueva entra primero en el documento. Los rótulos con cifra —«{N} contactos asignados», «{N} llamadas
   sin cierre»— no son frases de un hueco: son rótulos. */
export const FRASE = {
  guion: '—',
  sinAsistencia: 'Nadie marca la asistencia.',
  sinRegistros: 'Nadie registró en esta ventana.',
  sinRegistrosDelMes: 'Nadie registró este mes.',
  sinCitas: 'Sin citas en esta ventana.',
  ventaSinMonto: 'Hay ventas sin monto.',
  reportado: 'reportado por el closer',
  bajoElPiso: 'Pocos intentos para una tasa.',
  sinLlamadas: 'Sin llamadas sin cierre en esta ventana.',
  sinObjecion: 'Sin objeción clasificada',
  pocosContactos: 'Pocos contactos para una mediana.',
  sinClosers: 'Sin closers configurados.',
  sinVinculo: 'Sin vínculo con el CRM.',
  sinContactos: 'Sin contactos en este período',
  cargando: 'Cargando…',
  fallo: 'No se pudo leer. Reintenta.',
};

/** La frase de cada motivo por el que una cifra no tiene valor (`MotivoDeLaCifra` de `lecturaDeSales.ts`). */
export const FRASE_DEL_MOTIVO = {
  sin_closers: FRASE.sinClosers,
  sin_vinculo: FRASE.sinVinculo,
  sin_citas: FRASE.sinCitas,
  sin_asistencia: FRASE.sinAsistencia,
  sin_registros: FRASE.sinRegistros,
  bajo_el_piso: FRASE.bajoElPiso,
  venta_sin_monto: FRASE.ventaSinMonto,
};

/* Las seis categorías con que el analizador clasifica una objeción (`lib/analizadores/categorias.ts:6`), en
   palabras: los motivos de no venta de la tarjeta (S15-19). Tres son los del prototipo. */
export const MOTIVO_DE_LA_CATEGORIA = {
  precio: 'Precio',
  momento: 'No es el momento',
  decisor: 'No es quien decide',
  confianza: 'No confía en el resultado',
  encaje: 'No es para su negocio',
  otra: 'Otra',
};

/* Los cinco eslabones de la cadena (`ESLABONES` de `lib/negocio/cadenaDeCierre.ts`), con un rótulo corto: la
   tarjeta de abajo es de cifras (S15-20). */
export const ESLABON = {
  cohorte: 'Entraron',
  con_cita: 'Agendaron',
  cerrable: 'Cita ocurrida',
  con_intento: 'Registrado',
  con_venta: 'Venta',
};

// ─── Los formatos. El guion es «no se sabe» o «bajo el piso», NUNCA un cero. ──

/** Lo único que multiplica por 100: todo viaja de 0 a 1 (S15-13). `d`, los decimales que se conservan. */
export const cien = (v, d = 0) => Math.round(v * 100 * 10 ** d) / 10 ** d;

/** Un conteo entero, como lo escribe el prototipo: «1,240». */
export const miles = (n) => n.toLocaleString('es-PE');
/** Un monto reportado, con el signo del prototipo: «$55,200». */
export const plata = (n) => `$${Math.round(n).toLocaleString('es-PE')}`;
export const pf = (v) => `${cien(v)}%`;
/** Con un decimal: la cancelación, que `tasaDeCancelacion` publica así y Conversation dibuja así. */
export const pf1 = (v) => `${cien(v, 1).toLocaleString('es-PE')}%`;
export const o = (v, formato) => (v === null || v === undefined ? FRASE.guion : formato(v));
/** Días, con su decimal: «2.3 d». */
export const dias = (d) => `${d.toLocaleString('es-PE')} d`;
