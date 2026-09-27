// Los tramos del puntaje ICP: dónde se corta el número del CRM, y cómo se llama cada pedazo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL CORTE ES UNA DECISIÓN, Y VIVE EN UN SOLO LUGAR
//
// El número lo calcula el CRM —«Puntaje | ICP», de 0 a 100— y se guarda tal cual en
// `contactos.score`. Lo que este archivo agrega es lo único que el CRM no dice: **dónde deja de ser
// alto**. Los cortes 75 y 50 son los de la maqueta (`SEG` en `lib/aios/leads-group.js`), y los
// adoptó el usuario el 2026-09-26 para Leads Portal (`docs/leads-portal/14-EL-PUNTAJE-DEL-CRM.md`,
// LP14-05). No son un corte validado: los datos proponen también un 60, donde la casa deja de
// rechazar por ICP. Por eso están acá con nombre y no escritos como `75` en cada consulta.
//
// La maqueta guardaba el tramo AL LADO del puntaje, a mano, y dos filas con el mismo 79 caían en
// tramos distintos. Acá el tramo no se guarda: se deriva, siempre con esta función o con estas dos
// constantes —la consulta de la cohorte las pasa como parámetros de SQL—. El día que exista un ICP
// propio (`docs/futuro/icp-interno-calculado.md`) cambia de dónde sale el número, no el corte.
//
// ── EL CERO NO ES «PUNTUÓ CERO» ─────────────────────────────────────────────
//
// 47 de los 471 puntajes valen exactamente 0, todos de altas entre el 21 de agosto y el 3 de
// septiembre, y el CRM no dice si calculó cero o si su proceso no corrió (`sincronizar.ts` lo guarda
// como 0 a propósito, para no decidir por él). La decisión del 2026-09-26 es contarlos como «Sin
// calificar», igual que al nulo. Pero el 0 **sigue siendo 0** en la columna y los dos motivos viajan
// separados (`motivoSinCalificar`): juntarlos acá escondería la diferencia que la sincronización
// cuidó.
//
// ── ESTE ARCHIVO NO IMPORTA NADA ────────────────────────────────────────────
//
// Por lo mismo que `periodo.ts`: lo usan el servidor, para contar, y el navegador, para dibujar las
// tarjetas y filtrar la rejilla. Un import que llegue a la capa de datos mete el cliente de
// PostgreSQL en el paquete del navegador, y `next build` lo rechaza —ya pasó una vez con
// `DIAS_DE_TODO`—.
// ═══════════════════════════════════════════════════════════════════════════════

export type ClaveDeTramo = 'sin_calificar' | 'alto' | 'medio' | 'bajo';

/** Desde acá el puntaje es «ICP alto», inclusive. */
export const UMBRAL_ALTO = 75;

/** Desde acá el puntaje es «ICP medio», inclusive; debajo, y sobre cero, es «ICP bajo». */
export const UMBRAL_MEDIO = 50;

export interface Tramo {
  clave: ClaveDeTramo;
  /** Lo mismo en la tarjeta, en el filtro, en el chip de la rejilla y en la ficha. */
  rotulo: string;
}

/**
 * Los cuatro tramos, **en el orden en que se dibujan las tarjetas**.
 *
 * «Sin calificar» primero y los otros de mayor a menor: es el orden de la maqueta, y se conserva
 * fijo porque ordenar por volumen haría que la pantalla cambiara de forma cada semana.
 *
 * ── «ICP ALTO» Y NO «CALIFICADO ALTO» ───────────────────────────────────────
 *
 * La maqueta decía «Calificado alto / Calificado medio / No calificado». Las dos palabras mienten:
 * «no calificado» es una etiqueta de DESCARTE del CRM (`ETIQUETAS_DE_DESCARTE`), y rotular así al
 * tramo bajo diría que 158 personas fueron descartadas; y «Calificado medio» nombraría calificadas a
 * 22 personas que la casa rechazó por ICP (las dos cifras, medidas el 2026-09-27). «ICP alto» dice
 * lo único que el tramo sabe: dónde cae el puntaje.
 */
export const TRAMOS: readonly Tramo[] = [
  { clave: 'sin_calificar', rotulo: 'Sin calificar' },
  { clave: 'alto', rotulo: 'ICP alto' },
  { clave: 'medio', rotulo: 'ICP medio' },
  { clave: 'bajo', rotulo: 'ICP bajo' },
];

/** La quinta tarjeta, la que suma a las otras cuatro. No es un tramo: no tiene clave de tramo. */
export const ROTULO_DE_TODOS = 'Todos';

/**
 * El tramo de un puntaje del CRM.
 *
 * El nulo y el 0 van a «Sin calificar» (ver el encabezado). La columna es `smallint` con un
 * `check between 0 and 100`, así que no llega nada fuera de rango; `undefined` se trata como el nulo
 * porque es lo que produce una fila a la que le falta la clave.
 *
 * **La consulta de la cohorte repite este `case` en SQL**, con `UMBRAL_ALTO` y `UMBRAL_MEDIO` como
 * parámetros. Si se cambia la forma del corte acá —no los números, la forma— hay que cambiarla allá,
 * y la prueba de la base compara las dos.
 */
export function tramoDelPuntaje(score: number | null | undefined): ClaveDeTramo {
  if (score === null || score === undefined || score === 0) return 'sin_calificar';
  if (score >= UMBRAL_ALTO) return 'alto';
  if (score >= UMBRAL_MEDIO) return 'medio';
  return 'bajo';
}

export type MotivoSinCalificar = 'sin_puntaje' | 'en_cero';

/**
 * Por qué un puntaje está en «Sin calificar», o `null` si no lo está.
 *
 * Son dos poblaciones distintas y la tarjeta muestra las dos: 122 a las que el CRM no les mandó el
 * campo y 47 que valen 0 (medido el 2026-09-27). Si aparece un 0 nuevo, es el guardián
 * `cerosRecientes` de la cohorte el que avisa; esta función sólo nombra el motivo.
 */
export function motivoSinCalificar(score: number | null | undefined): MotivoSinCalificar | null {
  if (score === null || score === undefined) return 'sin_puntaje';
  if (score === 0) return 'en_cero';
  return null;
}

/**
 * El rótulo de una clave de tramo.
 *
 * Con el tipo, toda clave está en `TRAMOS`. El `?? clave` es para la que llega sin tipo, desde el
 * JSON de la respuesta: se dibuja la clave cruda antes que un hueco, y así se nota.
 */
export function rotuloDelTramo(clave: ClaveDeTramo): string {
  return TRAMOS.find((t) => t.clave === clave)?.rotulo ?? clave;
}
