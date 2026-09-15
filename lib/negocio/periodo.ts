// El vocabulario de períodos de Inteligencia: las CUATRO ventanas que se pueden pedir, y nada más.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES UNA LISTA CERRADA, Y ESO ES TODO EL ARCHIVO
//
// La tentación es leer `?dias=` como número y usarlo. Eso abre tres agujeros a la vez, y los tres se
// ven bien en pantalla:
//
//   · **`?dias=abc`** da `NaN`, `NaN` cae al valor por omisión, y la pantalla dibuja catorce días
//     mientras el botón encendido dice otra cosa.
//   · **`?dias=90`** se atiende como si existiera. No existe: nadie decidió que noventa días fuera
//     una ventana válida para estas cifras, y el sesgo de las citas congeladas crece con ella.
//   · **`?dias=-5`** produce `now() - interval '-5 days'`, o sea una ventana en el FUTURO. Cuenta
//     cero filas y la pantalla dice, con toda naturalidad, que no pasó nada.
//
// Ninguno falla. Los tres publican un número calculado sobre una ventana que nadie pidió. Por eso la
// clave es una palabra de una lista y no un número: lo que no está en la lista se RECHAZA.
//
// ── Y POR ESO VIVE ACÁ Y NO EN LA RUTA ───────────────────────────────────────
//
// La pantalla dibuja los cuatro botones y la ruta valida lo que llega. Con la lista escrita dos
// veces, agregar un período es tocar dos archivos, y el día que se toque uno solo el botón nuevo
// manda una clave que el servidor rechaza — o peor, el servidor acepta una que ningún botón produce.
//
// ── ESTE ARCHIVO NO IMPORTA NADA, Y ESO ES UNA RESTRICCIÓN DURA ──────────────
//
// Lo usan LOS DOS LADOS: la ruta lo usa para validar y el componente del navegador para dibujar los
// botones. `DIAS_DE_TODO` llegó a vivir en `indicadoresDeCitas.ts`, que parecía su lugar natural —
// está al lado de `DIAS_DE_LA_TASA`— y eso **rompió la construcción**: importarlo desde acá metía la
// capa de datos entera, y con ella el cliente de PostgreSQL, en el paquete del navegador.
//
// No fue un fallo sutil: `next build` lo rechazó con el rastro completo, de `pg` hasta
// `PanelDeConversation`. Dicho igual, porque el que agregue algo acá va a tener la misma tentación:
// **nada de lo que este archivo importe puede tocar la base.**
// ═══════════════════════════════════════════════════════════════════════════════

export type ClaveDePeriodo = 'hoy' | '7d' | '30d' | 'completo';

/**
 * La ventana del período «completo», en días.
 *
 * **Diez años y no un centinela `null`.** La alternativa era que `dias` aceptara `null` y que cada
 * consulta bifurcara su `where`: son nueve `where` en cuatro archivos, y el día que alguien agregue
 * el décimo se le olvida la rama del nulo — la cifra nueva sale calculada sobre catorce días
 * mientras la pantalla dice «completo», y las dos se ven bien por separado. Con un número grande hay
 * un solo camino y no hay rama que olvidar.
 *
 * Diez años es más que la vida del CRM de esta empresa —la fila más vieja es de 2026— así que la
 * ventana no recorta nada. Y lo que **sí** hace falta decir en pantalla no es la ventana pedida sino
 * la que hay: para eso viaja `desde`, y por eso «completo» no miente aunque el número sea 3650.
 */
export const DIAS_DE_TODO = 3650;

export interface Periodo {
  clave: ClaveDePeriodo;
  /** Lo que dice el botón. Corto: entra en un segmentado de cuatro en un teléfono. */
  etiqueta: string;
  /** Los días que se le pasan a cada módulo. Ver `DIAS_DE_TODO` para el caso de «completo». */
  dias: number;
  /**
   * Lo que el botón NO alcanza a decir, para el detalle al pasar o tocar.
   *
   * `null` cuando la etiqueta ya es exacta. La silencio es la regla: una aclaración que aparece
   * siempre se aprende a ignorar, y entonces la que importa tampoco se lee.
   */
  matiz: string | null;
}

/**
 * Las cuatro ventanas, en el orden en que se dibujan.
 *
 * ── «HOY» SON LAS ÚLTIMAS 24 HORAS, Y ESO SE DICE EN VEZ DE DISIMULARLO ─────
 *
 * El día calendario necesitaría una zona horaria, y elegirla mal es un defecto que este proyecto ya
 * conoce: la suite corre en `America/Lima`, `UTC` y `Asia/Tokyo` justamente porque una cifra que
 * cambia según dónde esté el servidor es indistinguible de una cifra correcta. Todas las ventanas de
 * este sistema son móviles (`now() - make_interval`), y ésta sigue la misma regla.
 *
 * Así que el botón dice «Hoy» —que es como se pide— y el matiz dice qué significa. La alternativa
 * honesta era rotularlo «24 h», y se descartó: nadie pregunta «¿cómo venimos en las últimas 24
 * horas?».
 */
export const PERIODOS: readonly Periodo[] = [
  { clave: 'hoy', etiqueta: 'Hoy', dias: 1, matiz: 'Las últimas 24 horas, no el día del calendario.' },
  { clave: '7d', etiqueta: '7 días', dias: 7, matiz: null },
  { clave: '30d', etiqueta: '30 días', dias: 30, matiz: null },
  {
    clave: 'completo',
    etiqueta: 'Completo',
    dias: DIAS_DE_TODO,
    /* Y acá el matiz NO es opcional: «completo» es la palabra que más fácil se lee como «toda la
       historia del negocio». La pantalla además muestra la fecha real de comienzo (`desde`), que es
       la que convierte esta advertencia en un hecho comprobable en vez de una precaución. */
    matiz: 'Todo lo que hay guardado, que puede ser mucho menos de lo que parece.',
  },
];

/**
 * Con qué período se abre la pantalla.
 *
 * **Treinta y no catorce**, aunque catorce sea lo que devolvían estas cifras hasta hoy: catorce no
 * está entre los cuatro botones, y un valor por omisión que ningún botón produce deja el segmentado
 * sin nada encendido. Entre los cuatro, treinta es el único que da volumen suficiente para que las
 * tasas con piso (`PISO_DE_UNA_TASA`) tengan denominador y no salgan todas en `null`.
 *
 * Lo que se paga es sabido y se declara solo: más allá de catorce días crece la proporción de citas
 * congeladas, y `tasaDeCancelacion` ya cuenta cuántas son y lo dice en su aviso.
 */
export const PERIODO_POR_OMISION: ClaveDePeriodo = '30d';

/**
 * Traduce lo que llegó por la URL. **`null` significa rechazar, no corregir.**
 *
 * Devolver el valor por omisión ante una clave desconocida sería el defecto que este archivo entero
 * existe para cerrar: pedir noventa días, recibir treinta, y no enterarse. Quien llama convierte este
 * `null` en un 400.
 *
 * La ausencia sí es un caso normal —la primera carga no manda nada— y ésa es la única que cae en el
 * valor por omisión.
 */
export function periodoDe(clave: string | null | undefined): Periodo | null {
  if (clave === null || clave === undefined || clave === '') {
    return PERIODOS.find((p) => p.clave === PERIODO_POR_OMISION) ?? null;
  }
  return PERIODOS.find((p) => p.clave === clave) ?? null;
}
