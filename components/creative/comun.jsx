/* Lo que usa el tablero de Creative para escribir: la lista cerrada de frases, los rótulos y los formatos
 * (docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, CF-3). Vive aparte del panel, como en Conversation, para
 * que la prueba lea la lista sin el marcado alrededor. */

/* ── LA LISTA CERRADA DE FRASES (CF1-02) ───────────────────────────────────
   Una frase nueva entra primero en el documento. Los rótulos —«Entregando», «{N} piezas»— no son frases de un hueco:
   son rótulos. */
export const FRASE = {
  guion: '—',
  bajoElPiso: 'Pocos casos para una tasa.',
  sinReporte: 'GoHighLevel no lo reportó.',
  pocasImpresiones: 'Pocas impresiones para una tasa.',
  sinEntrega: 'Sin entrega en esta ventana.',
  sinFuente: 'GoHighLevel no lo entrega.',
  sinClasificacion: 'El CRM no tiene el campo del cuadrante.',
  sinMiniatura: 'Sin miniatura todavía.',
  sinGancho: 'Sin días suficientes para medir el gancho.',
  sinContactos: 'Sin contactos en este período',
  grupoVacio: 'Sin piezas en este grupo.',
  unica: 'Única de su etapa.',
  cargando: 'Cargando…',
  fallo: 'No se pudo leer. Reintenta.',
};

/** La frase de cada motivo por el que una cifra no tiene valor (`MotivoDeLaCifra` de `lecturaDeCreative.ts`). */
export const FRASE_DEL_MOTIVO = {
  sin_contactos: FRASE.sinContactos,
  sin_clasificacion: FRASE.sinClasificacion,
  sin_entrega: FRASE.sinEntrega,
  bajo_el_piso: FRASE.bajoElPiso,
  pocas_impresiones: FRASE.pocasImpresiones,
  sin_reporte: FRASE.sinReporte,
  sin_fuente: FRASE.sinFuente,
};

/** La frase de una cifra sin valor, o nada. */
export const motivo = (c) => (c.valor === null ? (FRASE_DEL_MOTIVO[c.motivo] ?? null) : null);

/* Los criterios de «Ordenar por» (CF1-07), en el orden del servidor (`CRITERIOS`), con la unidad del veredicto de la
   ficha, como el `CRIT` del prototipo. Retención no ordena: no tiene dato. */
export const CRITERIO = {
  calificados: { rotulo: 'Calificados', unidad: 'calif.' },
  agendas: { rotulo: 'Agendas', unidad: 'agendas' },
  hookRate: { rotulo: 'Hook rate', unidad: 'hook' },
  impresiones: { rotulo: 'Impresiones', unidad: 'impresiones' },
};

/** Las etapas del servidor (`CLAVES_DE_ETAPA`), con su etiqueta: la que va en lugar de formato y ángulo (CF1-02). */
export const ETAPA = {
  TOFU: 'TOFU',
  MOFU: 'MOFU',
  BOFU: 'BOFU',
  sin_etapa: 'Sin etapa',
};

/** «Entregando» / «Sin entrega», en lugar de «Activo» / «Pausado» (CF1-02). */
export const ESTADO = {
  entregando: 'Entregando',
  sin_entrega: 'Sin entrega',
};

/** Cómo dice el período el «{N} piezas · …» de la barra, como el `periodLabel` del prototipo. */
export const PERIODO_EN_LA_BARRA = {
  hoy: 'hoy',
  '7d': 'últimos 7 días',
  '30d': 'últimos 30 días',
  completo: 'histórico',
};

/** El rótulo del enlace según la red. La red la decide el servidor por el host, no el texto del link. */
export const VER_EN = { facebook: 'Ver en Facebook', instagram: 'Ver en Instagram' };

// ─── Los formatos. El guion es «no se sabe» o «bajo el piso», NUNCA un cero. ──

/** Lo único que multiplica por 100: todo viaja de 0 a 1 (CF1-15). */
export const cien = (v) => v * 100;

/** Un conteo entero, como lo escribe el prototipo: «1,240». */
export const miles = (n) => n.toLocaleString('es-PE');

/**
 * Una tasa, en porcentaje: entera desde el 10 %, con un decimal debajo. El CTR, el link CTR y la landing viven entre
 * 0,1 % y 3 %: enteros, 2,4 % y 2,1 % se leían iguales y una landing de 0,2 % se leía «0 %», que es un cero que nadie
 * midió.
 */
export const pf = (v) => {
  const p = cien(v);
  return `${p >= 10 || p === 0 ? Math.round(p) : (Math.round(p * 10) / 10).toLocaleString('es-PE')}%`;
};
export const o = (v, formato) => (v === null || v === undefined ? FRASE.guion : formato(v));

/** Un conteo corto, como el `fmtN` del prototipo: «41.2K» desde mil. En la tarjeta, seis cifras entran en 238 px. */
export const corto = (n) => {
  if (n < 1000) return miles(n);
  const k = n / 1000;
  return `${k >= 100 ? Math.round(k) : (Math.round(k * 10) / 10).toLocaleString('en-US')}K`;
};

/** Una frecuencia: veces por persona, con un decimal, como el prototipo. */
export const veces = (v) => v.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Un monto, en dólares enteros, como el `fmtMoney` del prototipo. */
export const plata = (v) => `$${Math.round(v).toLocaleString('es-PE')}`;

/** El valor de una cifra según su criterio: los conteos, enteros; el hook rate, en porcentaje. */
export const FORMATO_DEL_CRITERIO = {
  calificados: miles,
  agendas: miles,
  hookRate: pf,
  impresiones: corto,
};

/**
 * Un día del servidor (`aaaa-mm-dd`), corto y con el año cuando no es el de hoy: «5 oct» de otro año se leería como
 * el de éste. Se arma con las partes y no con `new Date`: un día sin hora se lee en UTC, y en Lima sería el anterior.
 */
export const fechaCorta = (iso) => {
  if (!iso) return null;
  const [a, m, d] = iso.split('-');
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const esteAno = String(new Date().getFullYear());
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ''}${a === esteAno ? '' : ` ${a}`}`;
};
