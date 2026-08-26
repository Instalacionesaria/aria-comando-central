// Los compromisos que el VSL deja escritos y la Landing NO puede contradecir.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO EXISTE
//
// Puerto de `ARIA-brain/app-next/lib/vslCommitments.ts`, y su encabezado dice el defecto que lo
// originó: el VSL en formato pantalla compartida genera dos secciones con números concretos —los
// requisitos para aplicar y los cupos— y **la landing hablaba de lo mismo sin leer el VSL**. El
// alumno terminaba con un video que pide una cosa y una página que pide otra, sin que nada fallara.
//
// Por eso la landing recibe esas dos secciones como FUENTE DE VERDAD, extraídas del guion ya
// generado y no vueltas a inventar.
//
// La extracción es por encabezados de Markdown y es tolerante a propósito: el guion lo escribe un
// modelo, y el nivel del encabezado (`##` o `###`) y la redacción exacta del título varían entre
// generaciones. Buscar el título literal funcionaría hasta la primera vez que el modelo escriba
// "Requisitos para aplicar" en vez de "Pasos y requisitos para aplicar" — y ahí la landing volvería
// a inventar los suyos, en silencio.
// ═══════════════════════════════════════════════════════════════════════════════

export interface Compromisos {
  /** El contenido de "Pasos y requisitos para aplicar", o `null` si el guion no lo tiene. */
  requisitos: string | null;
  /** El contenido de "Cupos limitados" / escasez, o `null`. */
  escasez: string | null;
}

/** Encabezado ATX de Markdown, de uno a seis `#`, con cierre opcional. */
const ENCABEZADO = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;

/** Minúsculas, sin acentos y sin énfasis: el título viene de un modelo, no de una constante. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[*_`]/g, '')
    .trim();
}

/** A cuál de las dos secciones corresponde un título, o `null` si a ninguna. */
function clasificar(titulo: string): keyof Compromisos | null {
  const t = normalizar(titulo);
  if (t.includes('requisito')) return 'requisitos';
  if (t.includes('cupo')) return 'escasez';
  return null;
}

/**
 * Extrae las dos secciones del guion del VSL. Función pura.
 *
 * Cada sección va desde su encabezado hasta el siguiente encabezado de cualquier nivel, o hasta el
 * final. El contenido se conserva TAL CUAL, incluidos los `[COMPLETAR]`: si el guion no tenía la
 * cifra, la landing tampoco la va a tener, y eso es correcto — inventarla acá sería exactamente el
 * defecto que este archivo previene, con el número saliendo de otro lado.
 *
 * Un guion en formato cámara directa no tiene estas secciones y devuelve las dos en `null`. No es
 * un error: es que ese formato no las produce.
 */
export function extraerCompromisos(guion: string): Compromisos {
  const salida: Compromisos = { requisitos: null, escasez: null };
  if (!guion) return salida;

  let actual: keyof Compromisos | null = null;
  let acumulado: string[] = [];

  const volcar = () => {
    // Solo la PRIMERA aparición de cada sección. Un guion largo puede nombrar los requisitos otra
    // vez de pasada en el cierre, y esa mención de pasada no puede pisar la sección completa.
    if (actual && salida[actual] === null) {
      const texto = acumulado.join('\n').trim();
      salida[actual] = texto.length > 0 ? texto : null;
    }
    acumulado = [];
  };

  for (const linea of guion.split('\n')) {
    const encabezado = ENCABEZADO.exec(linea);
    if (encabezado) {
      volcar();
      actual = clasificar(encabezado[2] ?? '');
    } else if (actual) {
      acumulado.push(linea);
    }
  }
  volcar();

  return salida;
}

/**
 * El bloque de texto que entra al prompt de la Landing, o `null` si el guion no trae ninguna.
 *
 * `null` y no una cadena vacía: el `SKILL.md` de la landing tiene `{{^_vslCommitments}}` — una rama
 * entera para el caso "no hay compromisos del VSL" — y una cadena vacía es falsa igual, pero `null`
 * dice lo que pasó sin depender de cómo se evalúe el vacío.
 */
export function formatearCompromisos(c: Compromisos): string | null {
  const partes: string[] = [];
  if (c.requisitos) partes.push(`Pasos y requisitos para aplicar (del VSL):\n${c.requisitos}`);
  if (c.escasez) partes.push(`Cupos limitados / escasez (del VSL):\n${c.escasez}`);
  return partes.length > 0 ? partes.join('\n\n') : null;
}
