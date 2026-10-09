/* Lo que comparten el tablero de Conversion y su cajón: los pasos, la lista cerrada de frases y los formatos
 * (docs/conversion/15, CV-4). Vive aparte para que `PanelDeConversion.jsx` y `CajonDelPaso.jsx` lo tomen de un
 * solo lugar sin importarse entre ellos. */

/* Los cinco pasos del prototipo (`STEPS`, `aios-command-center_1.html:3969`), con sus claves y en su orden: son
   las de `PASOS` de `lib/negocio/pasosDeConversion.ts`, que no se importa porque abre la base y arrastraría `pg`
   al navegador. `a` es la `j-sub` de la base y `aCorta` la que va detrás de una cifra. La de Landing es un desvío
   declarado: la familia `sin-pagina` nunca abre una página (CV15-02). */
export const PASOS = [
  { k: 'sesiones', t: 'Landing', a: 'llegan como contacto' },
  { k: 'vsl', t: 'VSL', a: 'le dan play' },
  { k: 'form', t: 'Formulario', a: 'empiezan a llenarlo', aCorta: 'lo empiezan' },
  { k: 'agenda', t: 'Agenda', a: 'reservan la cita' },
  { k: 'gracias', t: 'Gracias', a: 'confirman y salen', aCorta: 'la completan' },
];

/* Los rótulos de las dos métricas de cada tarjeta (`keyMetrics`, línea 4155). Los de Landing son los de
   CV15-12, y los de Agenda van en personas (CV15-02). */
export const METRICAS = {
  vistas: 'Vistas',
  porLaLanding: 'Por la landing',
  vistoPromedio: 'Visto promedio',
  llegaAlCta: 'Llegan al CTA',
  loCompletan: 'Lo completan',
  tiempoMedio: 'Tiempo medio',
  calificados: 'Calificados',
  confirmados: 'Confirmados',
  dePlay: 'Dan play al video',
  videoVisto: 'Video visto',
};

/* Los pasos que abren cajón (CV15-17): VSL y Gracias tendrían un cajón que sólo dice «Sin dato». */
export const CON_CAJON = new Set(['sesiones', 'form', 'agenda']);

/* Los pasos a los que apunta alguna regla del detector: los de `pasoDeLaSenal`. Sólo ahí se puede decir
   «sin observaciones» (CV15-16), y sólo sus cajones llevan «Observaciones». */
export const CON_REGLAS = new Set(['sesiones', 'form']);

/* ── LA LISTA CERRADA DE FRASES (CV15-02) ──────────────────────────────────
   Una frase nueva entra primero en el documento. `{corte}` y `{N}` se completan con el dato, con `poner`. */
export const FRASE = {
  guion: '—',
  sinDato: 'Sin dato',
  sinDatoDesde: 'Sin dato desde el {corte}.',
  hastaElCorte: 'hasta el {corte}',
  cruzaElCorte: 'Cruza el corte del {corte}.',
  deMeta: 'según Meta',
  sinComparacion: 'sin comparación',
  diaEnCurso: 'día en curso, sin comparación',
  vs7: 'vs 7 días previos',
  vs30: 'vs 30 días previos',
  sinHistoria: 'Sin historia para comparar.',
  faltanContactos: 'Faltan contactos por leer.',
  faltanDias: 'Faltan días de gasto.',
  faltaGasto: 'Falta gasto de algunas campañas.',
  sinDesglose: 'Sin desglose de Meta.',
  congeladas: 'Los agendados no comparan: hay citas congeladas.',
  sinAlta: '{N} contactos sin alta no entran.',
  sinContactos: 'Sin contactos en este período',
  alReservar: 'registrada al reservar',
  sinObservaciones: 'sin observaciones',
  pasadaDeLaManana: 'detectada en la pasada de la mañana',
  verEvidencia: 'Ver evidencia →',
  cargando: 'Cargando…',
  fallo: 'No se pudo leer. Reintenta.',
};

/** Completa los `{corte}` y `{N}` de una frase. */
export const poner = (frase, valores) => frase.replace(/\{(\w+)\}/g, (_, k) => String(valores[k] ?? ''));

// ─── Los formatos. El guion es «no se sabe» o «bajo el piso», NUNCA un cero. ──

/** Lo único que multiplica por 100: todo viaja de 0 a 1 (CV15-22). */
export const cien = (v) => Math.round(v * 100);

/* El `nf` del prototipo (línea 3939): de mil para arriba, en miles con una «K». */
export const nf = (n) =>
  n >= 1000
    ? `${n / 1000 >= 100 ? Math.round(n / 1000) : (n / 1000).toFixed(1).replace(/\.0$/, '')}K`
    : n.toLocaleString('es-PE');
/** Un conteo entero, sin abreviar: la caída «−N», la nota y las tablas de los cajones. */
export const miles = (n) => n.toLocaleString('es-PE');
export const pf = (v) => `${cien(v)}%`;
export const o = (v, formato) => (v === null || v === undefined ? FRASE.guion : formato(v));

/** `2026-08-31` → «31 ago». El año sólo si no es el corriente. */
export function fechaCorta(iso) {
  const [a, m, d] = iso.slice(0, 10).split('-');
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ''}${a === String(new Date().getFullYear()) ? '' : ` ${a}`}`;
}

/** La ventana de verdad, no la pedida: «7 días» termina en el último día cerrado (CV15-04). */
export function rangoDe(v) {
  return v.desde === v.hasta ? fechaCorta(v.desde) : `${fechaCorta(v.desde)} – ${fechaCorta(v.hasta)}`;
}

/**
 * La variación, como el `delta()` del prototipo (línea 4082): los conteos en %, las proporciones en puntos.
 * El color lo trae el servidor: una flecha neutra —la porción que entra por la landing— va sin color.
 *
 * `conAnterior`: la ventana compara. Entonces una cifra que no compara —una tasa bajo el piso, los agendados con
 * citas congeladas— dice «sin comparación» en su lugar (CV15-20), y no se queda sin nada al lado de las que sí
 * llevan flecha. Sólo lo piden las celdas de personas de la tira y las métricas de las tarjetas: donde la frase no
 * entra, lo dicen la tira y la nota. Una variación `null` es de una cifra que no compara nunca.
 */
export function Delta({ v, conAnterior = false }) {
  if (!v) return null;
  if (v.tipo === 'sin_comparacion') return conAnterior ? <span className="dlt flat">{FRASE.sinComparacion}</span> : null;
  if (v.tipo === 'igual') return <span className="dlt flat">=</span>;
  const clase = v.lectura === 'buena' ? 'dlt up' : v.lectura === 'mala' ? 'dlt down' : 'dlt';
  const sube = v.tipo === 'sube';
  const cifra = 'puntos' in v ? `${cien(v.puntos)} pts` : `${cien(v.porcentaje)}%`;
  return (
    <span className={clase}>
      {sube ? '▲' : '▼'} {sube ? '+' : '-'}
      {cifra}
    </span>
  );
}

/** Las señales de un paso, en el orden de la lista (por pérdida y gravedad). */
export function senalesDelPaso(senales, clave) {
  const ids = new Set(senales.porPaso?.[clave] ?? []);
  return senales.lista.filter((s) => ids.has(s.id));
}
