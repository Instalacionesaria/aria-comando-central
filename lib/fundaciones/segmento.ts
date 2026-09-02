// El nombre del segmento ganador, sacado del texto del paso 5 del Research.
//
// ═══════════════════════════════════════════════════════════════════════════════
// PARA QUÉ SIRVE ESTO
//
// Es el puente del Research al ICP: al continuar al paso 3, el nicho del avatar se llena con el
// segmento que el research eligió, en vez de dejar el campo en blanco para que alguien lo vuelva a
// escribir a mano —y lo escriba distinto de como lo nombró la investigación—.
//
// Puerto verbatim de `ARIA-brain/app-next/lib/legacy/segmentName.ts`. Se copia el ALGORITMO, no una
// idea parecida: allá esta función lleva meses corriendo contra las salidas reales del modelo, y su
// forma —sus dos pasadas y su lista de arranques conversacionales— es el resultado de esa medición.
// Reescribirlo «mejor» acá significa fallar en textos que allá funcionan, y el síntoma sería un
// nicho vacío o una frase suelta metida como nicho.
//
// ── QUÉ HACE, EN ORDEN ───────────────────────────────────────────────────────
//
//   1. Limpia cada línea de viñetas, numeración, almohadillas y asteriscos.
//   2. Busca la primera que diga «segmento …: <nombre>» y devuelve lo que sigue a los dos puntos.
//   3. Si no hay ninguna, devuelve la primera línea que parezca un título: ni muy corta ni muy
//      larga, que no termine en dos puntos y que no arranque como una frase de relleno del modelo
//      («Ahora que…», «Perfecto…», «Basado en…»).
//   4. Si tampoco hay, devuelve cadena vacía — y quien llama decide qué hacer con eso.
//
// Devolver vacío es parte del contrato: **es preferible no llenar el campo a llenarlo con una frase
// del preámbulo del modelo.** Un nicho equivocado se propaga a todo lo que hereda del ICP.
// ═══════════════════════════════════════════════════════════════════════════════

/** Los arranques que delatan una frase de transición del modelo y no un título. */
const CONVERSACIONAL =
  /^(ahora|perfecto|excelente|listo|bien[,.]|he |hemos|con (toda|todo|esto)|basado|basándo|analizando|análisis|voy a|vamos a|te presento|aquí (está|tienes)|después de|tras )/i;

/** El largo máximo. El del hub, y no se toca: es lo que entra en el campo del formulario. */
const TOPE = 140;

export function nombreDelSegmento(texto: string): string {
  const lineas = String(texto || '')
    .split('\n')
    .map((l) => l.replace(/^[#*>\-\d.)\s]+/, '').replace(/\*+/g, '').trim())
    .filter(Boolean);

  for (const l of lineas) {
    const m = l.match(/segmento[^:]{0,30}:\s*(.{4,140})/i);
    if (m && m[1]) return m[1].replace(/[.:]$/, '').trim().slice(0, TOPE);
  }

  for (const l of lineas) {
    if (!CONVERSACIONAL.test(l) && l.length >= 8 && l.length <= 110 && !/:$/.test(l)) {
      return l.slice(0, TOPE);
    }
  }

  return '';
}
