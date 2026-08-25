// La píldora de situación, armada en UN solo lugar.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO ES UNA FUNCIÓN Y NO UN DICCIONARIO EN CADA PANTALLA
//
// El `02` lo pide como regla y explica el defecto que previene: la píldora del encabezado de la
// ficha tiene que ser **espejo exacto** —mismo texto y mismo color— que la de la fila que la abrió.
//
//   *"Si la fila dice una cosa y el encabezado otra, el usuario deja de confiar en las dos — y no
//   tiene forma de saber cuál es la correcta."*
//
// Y no es una preocupación teórica. En la implementación de referencia esto se concatenaba a mano
// en **seis puntos distintos** de la ficha, y el resultado medido fue que los datos de ejemplo
// producían `Seguimiento · Dudando` y el registro real `SEGUIMIENTO · DUDANDO` **para el mismo
// estado**. Dos formatos para un hecho.
//
// Así que acá se decide el texto, el color y el formato del dinero, y las dos pantallas importan
// esta función. `components/negocio/Fila.jsx` tenía su propio diccionario `SITUACION`; ahora lo lee
// de acá, que es lo que hace que el espejo sea cierto por construcción y no por coincidencia.
//
// ── CUATRO REGLAS QUE VAN JUNTAS ────────────────────────────────────────────
//
// **1 · La armamos nosotros, no el CRM.** El automatismo del CRM transporta los datos crudos —la
// salida y su campo— y no concatena nada. Si concatenara, habría dos formatos para el mismo estado.
//
// **2 · La píldora es la situación REAL.** Una condición temporal —vencido, estancado— es tinte de
// fila y microtexto, **jamás píldora**. `lib/negocio/fila.ts` ya lo respeta: `estancado` viaja
// aparte y se dibuja como borde y como texto chico.
//
// **3 · Sin subcategoría no se inventa una.** Queda solo la categoría. Rellenarla con un valor de
// reserva sería afirmar algo que nadie registró.
//
// **4 · Sin resultado no hay píldora.** Devuelve `null`, y la pantalla no dibuja nada. Es el `11`
// § 9 regla 1: un contacto sin resultado registrado no está «en ningún estado», está **sin medir**.
//
// ── DE DÓNDE SALE LA CATEGORÍA, Y POR QUÉ NO DE LA ETAPA ────────────────────
//
// El `02` dice que la categoría sale de la etapa. Acá sale del **último resultado registrado**, y
// es una desviación con motivo, que `lib/negocio/fila.ts` ya tenía escrito:
//
//   *"Sale del ÚLTIMO resultado registrado, no de la etapa: la etapa la mueve un automatismo del
//   CRM y hoy casi nadie la tiene. El resultado lo registra una persona con Avanzar, así que
//   cuando existe es un hecho, no una inferencia."*
//
// Medido: `contactos.etapa` es nula en los 239 contactos de producción, porque solo la escribe
// Avanzar. Armar la píldora sobre esa columna daría una píldora vacía para todos.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Situacion } from './fila.ts';

/** El texto y el color. La clase es una de las del prototipo (`.tagx.ag`, `.seg`, `.no`, `.nu`). */
export interface Pildora {
  texto: string;
  clase: 'ag' | 'seg' | 'no' | 'nu';
}

/**
 * La categoría y el color de cada salida.
 *
 * ── `NO LE INTERESA` Y NO `DESCALIFICADO` ───────────────────────────────────
 *
 * La implementación de referencia dejó esta divergencia anotada y sin resolver: el mismo estado se
 * llamaba de **tres formas** según dónde se lo mirara — `NO LE INTERESA` en la tarjeta de Avanzar,
 * `DESCALIFICADO` en los dos documentos de contrato del CRM, y `NO INTERESADO` en los datos de
 * ejemplo. Su comentario decía textualmente que había que elegir uno.
 *
 * Se eligió **`NO LE INTERESA`**, y el criterio es que es el nombre del botón que la persona
 * aprieta: la píldora que aparece después tiene que decir lo mismo que decía el control. Cambiarlo
 * es editar esta tabla y nada más.
 */
const CATEGORIA: Readonly<Record<Situacion, Pildora | null>> = {
  // Sin resultado no hay píldora. Ver la regla 4 del encabezado.
  sin_resultado: null,
  venta: { texto: 'VENTA', clase: 'ag' },
  acuerdo_sin_pago: { texto: 'ACORDÓ COMPRAR', clase: 'seg' },
  seguimiento: { texto: 'SEGUIMIENTO', clase: 'seg' },
  no_interesa: { texto: 'NO LE INTERESA', clase: 'no' },
  no_show: { texto: 'NO-SHOW', clase: 'no' },
  nurture: { texto: 'NURTURE', clase: 'nu' },
  agendo: { texto: 'AGENDADO', clase: 'ag' },
  venta_chica: { texto: 'VENTA CHICA', clase: 'ag' },
  no_califica: { texto: 'NO CALIFICA', clase: 'no' },
};

/**
 * El dinero, formateado en un solo lugar.
 *
 * `monto` llega como TEXTO, y no es un detalle: la columna es `numeric(12,2)` y el controlador de
 * PostgreSQL entrega los numéricos en texto para no perder precisión al pasar por un `double`. Un
 * `Number()` acá es seguro para mostrar —nadie vende 2^53— y necesario, porque `'5000.00'` sin
 * convertir se imprimiría con los dos decimales muertos.
 *
 * Devuelve `null` para lo que no sea un número, y eso importa: un monto ilegible **no se muestra**,
 * en vez de aparecer como `$NaN` en la píldora de un contacto real.
 */
function dinero(monto: string | null | undefined): string | null {
  if (monto === null || monto === undefined || monto.trim() === '') return null;
  const n = Number(monto);
  if (!Number.isFinite(n)) return null;
  return `$${new Intl.NumberFormat('es', { maximumFractionDigits: 2 }).format(n)}`;
}

/** Lo que hace falta para armar la píldora: el último resultado del contacto. */
export interface EntradaDePildora {
  situacion: Situacion;
  /** El campo del CRM que corresponde a esta salida: el nivel de interés, el motivo, la razón. */
  detalle?: string | null;
  /** Solo en una venta: cómo pagó. Es la subcategoría de `venta`, no el monto. */
  formaPago?: string | null;
  /** El dinero. En una venta acompaña a la forma de pago; en un acuerdo es lo único que hay. */
  monto?: string | null;
}

/**
 * `{ situacion: 'seguimiento', detalle: 'Muy interesado' }` → `SEGUIMIENTO · MUY INTERESADO`
 * `{ situacion: 'venta', formaPago: 'Contado', monto: '100' }` → `VENTA · CONTADO · $100`
 * `{ situacion: 'venta', monto: '5000' }` → `VENTA · $5000` (sin forma de pago conocida)
 * `{ situacion: 'nurture' }` → `NURTURE`
 * `{ situacion: 'sin_resultado' }` → `null`
 */
export function armarPildora(entrada: EntradaDePildora): Pildora | null {
  const base = CATEGORIA[entrada.situacion];
  if (!base) return null;

  const partes = [base.texto];

  // `venta` es la única salida con TRES piezas: categoría, forma de pago y monto.
  //
  // Y las dos últimas son opcionales POR SEPARADO, no juntas: un resultado puede tener la forma de
  // pago sin el monto o al revés, y se muestra lo que haya. En la referencia esta rama trataba al
  // monto como si fuera la subcategoría, así que la forma de pago se pedía como campo obligatorio
  // en el formulario de Venta **y después se tiraba**: el dato se capturaba y se perdía.
  if (entrada.situacion === 'venta') {
    const forma = entrada.formaPago?.trim();
    if (forma) partes.push(forma.toUpperCase());
    const plata = dinero(entrada.monto);
    if (plata) partes.push(plata);
    return { ...base, texto: partes.join(' · ') };
  }

  // `acuerdo_sin_pago` lleva el monto y NO la forma de pago: ahí la plata es una promesa, no un
  // pago, así que todavía no hay forma de pago que registrar.
  if (entrada.situacion === 'acuerdo_sin_pago') {
    const plata = dinero(entrada.monto);
    if (plata) partes.push(plata);
    return { ...base, texto: partes.join(' · ') };
  }

  // Todas las demás: categoría y, si existe, el campo que le corresponde. Nunca se inventa.
  const sub = entrada.detalle?.trim();
  return { ...base, texto: sub ? `${base.texto} · ${sub.toUpperCase()}` : base.texto };
}
