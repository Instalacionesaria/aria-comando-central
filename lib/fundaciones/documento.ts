// Cómo se lee un entregable en pantalla: el veredicto arriba, el documento abajo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ HAY UN RENDERIZADOR DE MARKDOWN A MANO Y NO UNA BIBLIOTECA
//
// Porque la cadena de dependencias de este proyecto se revisa (`ADR-0001` y la prueba
// `01-cadena-de-dependencias`: versiones exactas, sin guiones de instalación, archivo de bloqueo
// que coincide). Agregar un paquete para convertir siete tipos de línea es un costo permanente en
// la parte del sistema que más cuesta auditar, y lo que hace falta son encabezados, negritas,
// cursivas, listas y tablas. Es el mismo renderizador que ARIA-brain, portado.
//
// **El escape va PRIMERO y sin excepción.** El texto viene de un modelo de lenguaje y termina en un
// `dangerouslySetInnerHTML`: si el escape no fuera lo primero, un documento con `<script>` —que un
// prompt puede producir sin ninguna mala intención, hablando de una landing— se ejecutaría en la
// pantalla del alumno. Se escapa el texto entero y después se agregan las etiquetas propias, nunca
// al revés.
// ═══════════════════════════════════════════════════════════════════════════════

/** Un item del bloque de veredicto: un título y una conclusión de una o dos líneas. */
export interface ItemDeVeredicto {
  titulo: string;
  conclusion: string;
}

export interface DocumentoLeido {
  /** Los items del `<veredicto>`, si el entregable abre con uno. */
  veredicto: ItemDeVeredicto[];
  /** El documento sin el bloque de veredicto. */
  cuerpo: string;
}

const BLOQUE = /<veredicto>([\s\S]*?)<\/veredicto>/i;

/**
 * El bloque de contraste del ICP: `<icp-mirror><now>…</now><after>…</after></icp-mirror>`.
 *
 * La skill `icp/avatar` lo exige "con EXACTAMENTE esta sintaxis" en mitad del documento. A diferencia
 * del veredicto no se saca del cuerpo: se pinta EN SU LUGAR como dos columnas —"Dónde están hoy" y
 * "Dónde quieren estar"— que es lo que ARIA-brain hace en `OutputRenderer`. Sin esto el alumno ve
 * `<icp-mirror>` crudo en su cliente ideal, y como el resto sale bien, nadie lo reporta.
 */
const ESPEJO = /<icp-mirror>\s*<now>([\s\S]*?)<\/now>\s*<after>([\s\S]*?)<\/after>\s*<\/icp-mirror>/gi;
/** Etiquetas del espejo que quedaron sueltas (un modelo que abrió `<now>` y no cerró). Se quitan. */
const RESTOS_DEL_ESPEJO = /<\/?(icp-mirror|now|after)>/gi;
const HOY = 'Dónde están hoy';
const DESPUES = 'Dónde quieren estar';
const ITEM = /<item\s+titulo\s*=\s*"([^"]*)"\s*>([\s\S]*?)<\/item>/gi;

/**
 * Separa el veredicto del documento.
 *
 * El Mapa de Proceso abre con un bloque `<veredicto>` de cuatro items, por instrucción explícita de
 * su metodología. Sin este paso, el alumno ve etiquetas XML crudas en la primera línea de su
 * entregable — y como el resto del documento sale bien, nadie lo reporta como error: se asume que
 * "así sale".
 */
export function leerDocumento(texto: string): DocumentoLeido {
  const m = BLOQUE.exec(texto);
  if (!m || !m[1]) return { veredicto: [], cuerpo: texto };

  const items: ItemDeVeredicto[] = [];
  ITEM.lastIndex = 0;
  let item: RegExpExecArray | null;
  while ((item = ITEM.exec(m[1])) !== null) {
    const titulo = item[1] ? item[1].trim() : '';
    const conclusion = item[2] ? item[2].trim() : '';
    if (titulo || conclusion) items.push({ titulo, conclusion });
  }

  // Si el bloque estaba pero no tenía items legibles, se deja el texto intacto: quitar un bloque y
  // no mostrar nada en su lugar es perder contenido en silencio.
  if (items.length === 0) return { veredicto: [], cuerpo: texto };
  return { veredicto: items, cuerpo: texto.replace(BLOQUE, '').replace(/^\s+/, '') };
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Negritas y cursivas. Se aplica SOBRE texto ya escapado. */
function enLinea(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+?)\*/g, '<em>$1</em>');
}

function celdas(linea: string): string[] {
  return linea
    .split('|')
    .map((c) => c.trim())
    .filter((c, i, todas) => !(i === 0 && c === '') && !(i === todas.length - 1 && c === ''));
}

/**
 * Markdown → HTML. Encabezados, listas, tablas, negritas, cursivas.
 *
 * Devuelve HTML con clases propias (`fd-h2`, `fd-li`, …) en vez de etiquetas semánticas sueltas,
 * porque el reset de `aios.css` es `* { margin:0; padding:0 }` y un `<h2>` o un `<ul>` llegarían sin
 * ninguna separación. Las clases están en `app/fundaciones.css`.
 */
export function aHtml(texto: string): string {
  if (!texto) return '';
  // El espejo se separa ANTES de escapar, pero cada pedazo de texto del modelo —las dos columnas y
  // lo de afuera— entra a `bloqueAHtml`, que escapa primero. Lo único que se agrega sin escapar son
  // las dos etiquetas fijas de este archivo. La regla del encabezado sigue en pie.
  let html = '';
  let desde = 0;
  ESPEJO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ESPEJO.exec(texto)) !== null) {
    html += bloqueAHtml(sinRestos(texto.slice(desde, m.index)));
    html +=
      '<div class="fd-espejo">' +
      `<div><div class="fd-vt">${HOY}</div>${bloqueAHtml((m[1] ?? '').trim())}</div>` +
      `<div><div class="fd-vt">${DESPUES}</div>${bloqueAHtml((m[2] ?? '').trim())}</div>` +
      '</div>';
    desde = m.index + m[0].length;
  }
  html += bloqueAHtml(sinRestos(texto.slice(desde)));
  return html;
}

function sinRestos(texto: string): string {
  return texto.replace(RESTOS_DEL_ESPEJO, '');
}

/** El espejo como Markdown plano, para el portapapeles y los archivos. */
function aplanarEspejo(texto: string): string {
  ESPEJO.lastIndex = 0;
  return sinRestos(
    texto.replace(ESPEJO, (_, hoy: string, despues: string) =>
      `**${HOY}**\n${hoy.trim()}\n\n**${DESPUES}**\n${despues.trim()}`,
    ),
  );
}

function bloqueAHtml(texto: string): string {
  if (!texto) return '';
  const lineas = escapar(texto).split('\n');
  let html = '';
  let i = 0;
  let enLista = false;

  const cerrarLista = () => {
    if (enLista) {
      html += '</ul>';
      enLista = false;
    }
  };

  while (i < lineas.length) {
    const linea = lineas[i] === undefined ? '' : (lineas[i] as string);
    const siguiente = lineas[i + 1] === undefined ? '' : (lineas[i + 1] as string);

    // Tabla: una fila de encabezado seguida de la fila de guiones.
    if (/^\s*\|.*\|\s*$/.test(linea) && /^\s*\|?[\s:|-]+\|[\s:|-]+$/.test(siguiente)) {
      cerrarLista();
      html +=
        '<div class="fd-tabla"><table><thead><tr>' +
        celdas(linea)
          .map((c) => `<th>${enLinea(c)}</th>`)
          .join('') +
        '</tr></thead><tbody>';
      i += 2;
      while (i < lineas.length && /^\s*\|.*\|\s*$/.test(lineas[i] as string)) {
        html +=
          '<tr>' +
          celdas(lineas[i] as string)
            .map((c) => `<td>${enLinea(c)}</td>`)
            .join('') +
          '</tr>';
        i++;
      }
      html += '</tbody></table></div>';
      continue;
    }

    const encabezado = /^(#{1,4})\s+(.*)$/.exec(linea);
    if (encabezado && encabezado[1] && encabezado[2] !== undefined) {
      cerrarLista();
      const nivel = encabezado[1].length;
      html += `<div class="fd-h fd-h${nivel}">${enLinea(encabezado[2])}</div>`;
      i++;
      continue;
    }

    const item = /^\s*[-*·]\s+(.*)$/.exec(linea);
    if (item && item[1] !== undefined) {
      if (!enLista) {
        html += '<ul class="fd-lista">';
        enLista = true;
      }
      html += `<li>${enLinea(item[1])}</li>`;
      i++;
      continue;
    }

    const numerado = /^\s*(\d+)[.)]\s+(.*)$/.exec(linea);
    if (numerado && numerado[1] && numerado[2] !== undefined) {
      if (!enLista) {
        html += '<ul class="fd-lista fd-num">';
        enLista = true;
      }
      html += `<li><b>${numerado[1]}.</b> ${enLinea(numerado[2])}</li>`;
      i++;
      continue;
    }

    cerrarLista();
    if (linea.trim() === '') html += '<div class="fd-aire"></div>';
    else html += `<div class="fd-p">${enLinea(linea)}</div>`;
    i++;
  }

  cerrarLista();
  return html;
}

/**
 * El documento listo para copiar o descargar: el veredicto como lista, y el cuerpo.
 *
 * Ni el bloque `<veredicto>` ni el `<icp-mirror>` salen crudos al portapapeles. Es la misma regla que en pantalla, y por
 * el mismo motivo: quien pega esto en un documento para su coach no tiene por qué recibir etiquetas.
 */
export function aTextoPlano(texto: string): string {
  const { veredicto, cuerpo: crudo } = leerDocumento(texto);
  const cuerpo = aplanarEspejo(crudo);
  if (veredicto.length === 0) return cuerpo;
  const cabecera = veredicto.map((v) => `- **${v.titulo}:** ${v.conclusion}`).join('\n');
  return `## En una mirada\n${cabecera}\n\n${cuerpo}`;
}
