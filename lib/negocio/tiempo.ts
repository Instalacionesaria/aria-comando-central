// LA hora y EL día, en la zona de la empresa. Una sola definición para toda la aplicación.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO EXISTE: UN DEFECTO YA PAGADO, DOS VECES
//
// El documento de la Agenda lo dice sin rodeos: *"la definición de «la hora de la cita» está en un
// solo lugar, compartida con el Pipeline. Cuando cada pantalla la calculaba por su cuenta, **dos
// vitrinas mostraban horas distintas para la misma cita**"*. Y en la implementación de referencia
// llegó a estar repartida en ocho archivos.
//
// En este repositorio ya iba por dos: `components/closer/MiDia.jsx` y `components/negocio/Ficha.jsx`
// tenían cada uno su `hora(iso, zona)`. Con la Agenda serían tres, y con el Pipeline cuatro. Se
// corta acá.
//
// ── LA REGLA, Y NO ADMITE EXCEPCIONES ──────────────────────────────────────
//
// **Toda fecha que una persona lee se formatea en la zona de la ORGANIZACIÓN, nunca en la del
// navegador.** Un closer que viaja no ve sus citas corridas, y dos personas del mismo equipo en
// husos distintos ven la misma hora para la misma cita.
//
// El instante se guarda en tiempo universal —`timestamptz`— y la zona se aplica solo al mostrarlo.
// Es lo contrario de guardar la hora local, que pierde la información de qué instante era.
//
// Isomorfo: sin base, sin React, sin DOM. Lo usan las pantallas y las respuestas del servidor.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * `18:30` — la hora de un instante en la zona de la empresa.
 *
 * En 24 horas y no en 12: una agenda con `2:00` sin decir si es de la tarde es una llamada perdida,
 * y el `am`/`pm` en español se lee peor que el reloj corrido.
 */
export function horaEnZona(instante: Date | string | null | undefined, zona: string): string {
  const d = aFecha(instante);
  if (d === null) return '—';
  try {
    return new Intl.DateTimeFormat('es', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: zona,
    }).format(d);
  } catch {
    // Una zona inválida no puede dejar la agenda sin horas. Se cae a la del entorno y se sigue: es
    // peor una fila muda que una hora que puede estar corrida, porque la fila muda no se puede ni
    // sospechar.
    return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  }
}

/**
 * `2026-08-26` — el DÍA calendario de un instante, en la zona de la empresa.
 *
 * No es un detalle: un mensaje o una cita de las 22:00 en Lima son las 03:00 del día siguiente en
 * tiempo universal. Sin la zona, el separador de día —o el encabezado de la agenda— diría un día
 * distinto del que ve quien estuvo ahí.
 *
 * Se arma con `formatToParts` y no con un `toLocaleDateString` de una configuración regional que dé
 * `YYYY-MM-DD` por casualidad: el formato de salida de una configuración regional no es un contrato.
 */
export function diaEnZona(instante: Date | string | null | undefined, zona: string): string {
  const d = aFecha(instante);
  if (d === null) return '';
  const partes = partesDelDia(d, zona);
  const de = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${de('year')}-${de('month')}-${de('day')}`;
}

function partesDelDia(d: Date, zona: string): Intl.DateTimeFormatPart[] {
  const opciones: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  try {
    return new Intl.DateTimeFormat('en-US', { ...opciones, timeZone: zona }).formatToParts(d);
  } catch {
    return new Intl.DateTimeFormat('en-US', { ...opciones, timeZone: 'UTC' }).formatToParts(d);
  }
}

/**
 * `HOY` / `AYER` / `MAÑANA` / `MIÉRCOLES 3 DE SEPTIEMBRE` — cómo se llama un día para una persona.
 *
 * Los tres primeros con palabras porque es como se habla, y el resto con el nombre del día además
 * de la fecha: en una agenda, «jueves» es lo que alguien busca, no «el 3».
 *
 * @param dia Un `YYYY-MM-DD` — el que devuelve `diaEnZona`.
 * @param hoy El día de hoy, en la MISMA zona. Se pasa en vez de calcularse para que quien llama no
 *   pueda mezclar dos zonas sin darse cuenta: el error más fácil de este archivo sería comparar un
 *   día de Lima contra un hoy de Madrid.
 */
export function etiquetaDeDia(dia: string, hoy: string): string {
  if (dia === hoy) return 'HOY';
  if (dia === sumarDias(hoy, -1)) return 'AYER';
  if (dia === sumarDias(hoy, 1)) return 'MAÑANA';

  // `T12:00Z` y no medianoche: a las 00:00 un desfase de pocas horas cae en el día anterior, y la
  // etiqueta diría un día menos que las citas que encabeza.
  const d = new Date(`${dia}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dia; // ilegible: se muestra cruda, no se inventa
  // ── EL AÑO VA, Y UNA PRUEBA ME OBLIGÓ A PONERLO ──────────────────────────
  //
  // La primera versión lo omitía: en una agenda de quince días el año es ruido. Pero esta misma
  // función encabeza los separadores del CHAT, donde una conversación puede cruzar años — y
  // «12 DE AGOSTO» sobre un mensaje de 2025 no es breve, es **falso**. La brevedad es una
  // preferencia; el año es información.
  //
  // Es el precio de tener una sola definición, y es el correcto: la alternativa era dos, que es
  // exactamente el defecto que este archivo vino a cerrar.
  return new Intl.DateTimeFormat('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(d)
    .toUpperCase();
}

/**
 * `HOY` / `MAÑANA` / `VIE 28` — el nombre corto de un día, para una tira de pocos días.
 *
 * ── POR QUÉ EXISTE, Y POR QUÉ NO ES UNA SEGUNDA DEFINICIÓN ─────────────────
 *
 * Se vio en el navegador: la tira de «Próximos días» de la Agenda son cuatro botones con un número
 * abajo, y `etiquetaDeDia` los llenaba con **«VIERNES, 28 DE AGOSTO DE 2026»**. El año es correcto y
 * ahí es ruido: los cuatro días están a tres días de hoy.
 *
 * Lo que hace que esto NO reabra el defecto que `etiquetaDeDia` cerró es la precondición, y hay que
 * decirla: **solo se puede usar para días acotados a una ventana corta alrededor de `hoy`**. Dentro
 * de esa ventana el año no puede ser ambiguo; fuera de ella sí, y por eso los separadores del chat
 * —que cruzan años— siguen usando la larga.
 *
 * Los tres casos con palabras se delegan: si mañana `etiquetaDeDia` cambiara «MAÑANA» por otra cosa,
 * las dos vitrinas cambiarían juntas. Lo único propio de acá es el formato del resto.
 */
/**
 * La FECHA de un día, siempre. Nunca «HOY» ni «MAÑANA».
 *
 * ── POR QUÉ HACE FALTA UNA CUARTA, Y NO ES UN CAPRICHO ─────────────────────
 *
 * `etiquetaDeDia` y `etiquetaCorta` dan la etiqueta RELATIVA cuando el día está cerca, que es lo
 * correcto donde encabezan una lista. Pero el encabezado de la Agenda muestra las dos cosas juntas
 * —el rótulo grande y la fecha debajo, como en cualquier calendario— y con las dos funciones que
 * había el resultado era **«HOY · HOY»**: dos veces lo mismo, y la fecha, que es el dato, en ningún
 * lado. Se vio en el navegador, no leyendo el código.
 *
 * En minúsculas, al revés que las otras dos: éstas encabezan secciones y van en versalitas; ésta va
 * como subtítulo al lado de un rótulo grande, y una fecha gritada ahí compite con él.
 */
export function fechaDelDia(dia: string): string {
  // `T12:00Z` por el mismo motivo que `etiquetaDeDia`: a medianoche un desfase de horas cae en el
  // día anterior, y el subtítulo diría un día menos que las citas que acompaña.
  const d = new Date(`${dia}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dia; // ilegible: se muestra cruda, no se inventa
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function etiquetaCorta(dia: string, hoy: string): string {
  const larga = etiquetaDeDia(dia, hoy);
  if (larga === 'HOY' || larga === 'AYER' || larga === 'MAÑANA') return larga;

  const d = new Date(`${dia}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dia; // ilegible: cruda, igual que la larga
  return new Intl.DateTimeFormat('es', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
    .format(d)
    .replace('.', '')
    .toUpperCase();
}

/** Suma días a un `YYYY-MM-DD` sin arrastrar la zona de quien lo corre. */
/**
 * `hace 3 min`, `en 2 h`, `ahora` — la distancia entre un instante y ahora, en palabras.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ESTABA DOS VECES, Y LAS DOS COPIAS NO HACÍAN LO MISMO
 *
 * `components/negocio/Fila.jsx` y `components/negocio/Ficha.jsx` tenían cada uno su `hace(iso)`, y
 * divergieron: la de la ficha maneja el FUTURO —dice `en 2 h`— y la de la fila no. Con un instante
 * futuro, la lista decía `hace -120 min` y la ficha `en 2 h`, **sobre el mismo dato**.
 *
 * Y no es un caso raro: la fila dibuja `ultimoEntranteEl`, que llega del CRM. Un contacto cuyo
 * teléfono tiene el reloj adelantado, o una subcuenta con la zona mal puesta, produce un instante
 * futuro sin que nada falle.
 *
 * Este archivo existe exactamente por esto —su encabezado nombra a `Ficha.jsx` como el ofensor
 * anterior con `hora(iso, zona)`— así que la tercera copia se corta acá.
 *
 * ── POR QUÉ NO USA `Intl.RelativeTimeFormat` ────────────────────────────
 *
 * Porque diría «hace 3 minutos» y estos textos van en chips de 11,5 px al lado del nombre: `min`,
 * `h` y `d` están medidos contra ese ancho, y el formateador no tiene una forma corta en español.
 *
 * ── Y NO LLEVA ZONA, a diferencia del resto de este archivo ────────────────
 *
 * Una DISTANCIA entre dos instantes es la misma en cualquier huso. La zona hace falta para decir
 * «qué hora es», no «cuánto pasó», y pedirla acá invitaría a pasarla por si acaso.
 *
 * @param ahora El instante de referencia. Se puede pasar para probarlo sin tocar el reloj.
 */
export function haceCuanto(
  instante: Date | string | null | undefined,
  ahora: number = Date.now(),
): string {
  const d = aFecha(instante);
  if (d === null) return '—';
  const ms = ahora - d.getTime();
  const futuro = ms < 0;
  const min = Math.round(Math.abs(ms) / 60000);
  const decir = (cantidad: number, unidad: string) =>
    futuro ? `en ${cantidad} ${unidad}` : `hace ${cantidad} ${unidad}`;
  if (min < 1) return 'ahora';
  if (min < 60) return decir(min, 'min');
  const h = Math.round(min / 60);
  if (h < 24) return decir(h, 'h');
  return decir(Math.round(h / 24), 'd');
}

export function sumarDias(dia: string, delta: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Un instante desde lo que sea. **Nulo cuando no se puede leer, nunca 1970.**
 *
 * Una fecha ilegible convertida en el instante cero se ordena antes que todo y aparecería arriba de
 * la agenda como «la cita más vieja». Ausente es más honesto que primera.
 */
function aFecha(v: Date | string | null | undefined): Date | null {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
