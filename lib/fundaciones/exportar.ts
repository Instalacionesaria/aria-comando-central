// Port de `ARIA-brain/app-next/lib/legacy/export.ts` — descargar un entregable como Word o PDF.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO EXISTE, Y POR QUÉ NO ALCANZABA CON `.md`
//
// El port entregaba un solo botón: «Descargar .md». El hub entrega un menú con **Word y PDF**, y
// eso NO es un detalle de formato: un alumno le manda el entregable a su coach, a un cliente o a
// un socio, y nadie abre un `.md`. Llegó como reporte de Jorge —«antes había PDF y ahora no»— y
// tiene razón: la pantalla es un port de la suya, y una opción que estaba y desapareció es una
// función perdida, no una simplificación.
//
// ── LAS DOS DIFERENCIAS CON EL HUB, Y POR QUÉ ────────────────────────────────
//
// 1. **No se usa `marked`.** El hub convierte markdown a HTML con esa librería; este proyecto ya
//    tiene `aHtml` en `documento.ts`, que es la MISMA conversión y ya está probada
//    (`90-fundaciones.test.ts`). Traer una dependencia para repetir lo que ya hay sería, además,
//    dos renderizadores markdown en el mismo repo: el Word y la pantalla podrían divergir sin que
//    nada falle. El precio es que `aHtml` emite clases (`fd-h2`, `fd-lista`, …) en vez de
//    etiquetas semánticas, así que la hoja de abajo las estiliza por clase.
//
// 2. **`jspdf` sí se trae**, y se importa dinámicamente igual que en el hub: son ~350 KB que no
//    tienen por qué entrar al paquete principal de una pantalla que la mayoría abre sin descargar
//    nada.
//
// Lo que NO cambia es la entrada: los dos exportadores reciben lo que devuelve `aTextoPlano()`, el
// mismo texto que se copia al portapapeles. O sea que el `<veredicto>` **nunca** sale crudo a un
// Word ni a un PDF, por la misma regla que en pantalla y en el portapapeles.
// ═══════════════════════════════════════════════════════════════════════════════

import { aHtml } from './documento.ts';

/**
 * El nombre del archivo a partir del título de la herramienta.
 *
 * Conserva letras acentuadas y la eñe —los títulos son «Tu categoría única», «Tu página»— porque
 * un `Tu-categora-nica.pdf` es un archivo que nadie encuentra después. Verbatim del hub.
 */
export function nombreDeArchivo(titulo: string): string {
  return titulo
    .replace(/[^\wáéíóúñÁÉÍÓÚÑ() -]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function escapar(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** El pie de autoría, igual en los dos formatos. */
function procedencia(organizacion: string): string {
  const fecha = new Date().toLocaleDateString('es');
  return organizacion ? `${organizacion} · Generado con ARIA · ${fecha}` : `Generado con ARIA · ${fecha}`;
}

/**
 * Dispara la descarga de un blob. Un solo lugar, porque el orden importa: sin `appendChild` el
 * `click()` no hace nada en Firefox, y sin `revokeObjectURL` cada descarga filtra el blob entero.
 */
function bajar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * La hoja del Word. Estiliza las CLASES que emite `aHtml`, no etiquetas semánticas.
 *
 * En puntos (`pt`) y no en píxeles a propósito: Word maqueta para papel, y un `font-size: 14px`
 * se interpreta distinto según la versión. `Calibri` con respaldo `Arial` es lo que el hub usa.
 */
const HOJA_WORD = `
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
  .fd-h { font-weight: bold; margin: 10pt 0 5pt; }
  .fd-h1 { font-size: 16pt; } .fd-h2 { font-size: 13.5pt; } .fd-h3 { font-size: 12pt; }
  .fd-h4 { font-size: 11pt; }
  .fd-p { margin: 0 0 6pt; }
  .fd-aire { height: 6pt; }
  .fd-lista { margin: 4pt 0 8pt 18pt; }
  table { border-collapse: collapse; margin: 10pt 0; width: 100%; }
  th, td { border: 1pt solid #999; padding: 4pt 7pt; font-size: 10pt; text-align: left; vertical-align: top; }
  th { background: #efe7d3; }
`;

/**
 * Descarga el documento como `.doc`.
 *
 * Es HTML con extensión `.doc` y tipo `application/msword`, que es lo que hace el hub y lo que Word
 * abre sin chistar. El `\ufeff` del principio no es decorativo: sin esa marca de orden de bytes,
 * Word adivina la codificación y los acentos salen rotos.
 */
export function descargarComoDoc(titulo: string, texto: string, organizacion: string): void {
  const documento = `<html><head><meta charset="utf-8"><title>${escapar(titulo)}</title>
<style>${HOJA_WORD}</style></head>
<body>
<h1 style="font-size:18pt">${escapar(titulo)}</h1>
<p style="color:#666;font-size:9pt">${escapar(procedencia(organizacion))}</p>
<hr>${aHtml(texto)}</body></html>`;
  bajar(new Blob(['\ufeff', documento], { type: 'application/msword' }), `${nombreDeArchivo(titulo)}.doc`);
}

// ─── El PDF ────────────────────────────────────────────────────────────────────
//
// jsPDF dibuja, no maqueta: no entiende markdown ni HTML. El texto se parte en bloques con forma
// —encabezado, viñeta, tabla, regla, párrafo— y cada uno se dibuja con su tipografía, su sangría y
// su salto de página.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PRIMERA VERSIÓN ERA CORRECTA Y SE LEÍA MAL, QUE SON DOS COSAS DISTINTAS
//
// El port literal del hub generaba el documento entero y completo, en helvetica negra sobre blanco.
// Nada fallaba. Lo que pasaba es que un alumno le manda ese archivo a un cliente, y el archivo no
// dice de dónde salió ni se distingue de un volcado de texto.
//
// Se rehízo con portada, marca y foliado. Pero en el camino aparecieron CUATRO defectos que no eran
// de estilo, y conviene que queden nombrados porque ninguno rompía nada:
//
//   1 · **Las listas anidadas se aplanaban.** `aBloques` hacía `linea.trim()` ANTES de detectar la
//       viñeta, así que un sub-ítem sangrado quedaba al mismo nivel que su padre. En el «Perfil de
//       Cliente» eso ponía cuatro tipos de freelancer como si fueran hermanos de «Perfil laboral:».
//   2 · **Las listas numeradas se dibujaban como párrafos.** No había rama para `1.`, y la pantalla
//       SÍ la tiene (`aHtml`). O sea: el PDF y la pantalla mostraban el mismo documento distinto.
//   3 · **La viñeta no tenía sangría francesa.** Una viñeta de dos líneas volvía al margen en la
//       segunda, y se leía como un ítem nuevo.
//   4 · **La tabla se partía sin repetir el encabezado.** Se seguía leyendo columnas sin saber cuál
//       era cuál.
//
// Los cuatro son del tipo que no se reporta: el documento «sale», y solo alguien que compara contra
// la pantalla nota que dice otra cosa.
//
// ── POR QUÉ HAY UN SOLO LUGAR QUE CAMBIA DE PÁGINA ───────────────────────────
//
// `saltarPagina()`. Antes había tres `doc.addPage()` sueltos —uno en el flujo, dos dentro de la
// tabla— y con la cabecera corrida y el foliado eso significaría tres lugares donde acordarse de
// redibujarlas. El día que alguien agregue el cuarto, esa página sale sin encabezado y nadie lo ve
// hasta que imprime.
// ═══════════════════════════════════════════════════════════════════════════════

/** La paleta, en la forma que `jspdf` consume (tripletas 0-255). Son los tokens de `temas.css`. */
const TINTA = [17, 24, 38] as const;
const TENUE = [110, 124, 145] as const;
/** `--accent`. Sobre el fondo oscuro de la portada. Sobre blanco NO alcanza contraste: ver abajo. */
const ACENTO = [63, 242, 226] as const;
/**
 * `--accent-hondo`. El turquesa de la portada sobre blanco da ~1,4:1 — invisible.
 *
 * Por eso en el cuerpo el acento es DECORATIVO y nunca lleva texto: la barra de sección, la regla
 * del encabezado y la fila de cabecera de las tablas. El texto siempre va en `TINTA`.
 */
const ACENTO_HONDO = [35, 179, 168] as const;
const FONDO_PORTADA = [8, 13, 21] as const;
const BLANCO = [255, 255, 255] as const;

const MARGEN = 48;
/** Dónde empieza el contenido en las páginas del cuerpo: debajo de la cabecera corrida. */
const TECHO_CUERPO = 78;
const ALTURA_LINEA = 14.5;

/** Negritas, cursivas y `código` fuera: el PDF no los dibuja, y los asteriscos crudos se ven mal. */
function sinMarcasEnLinea(s: string): string {
  return String(s)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

interface Bloque {
  tipo: 'h1' | 'h2' | 'h3' | 'regla' | 'vineta' | 'tabla' | 'aire' | 'p';
  texto?: string;
  /** La viñeta o el número que va al margen. Sin él, `escribirConMarca` no sangra. */
  marca?: string;
  /** 0 para el nivel de arriba, 1 y 2 para los anidados. Sale de los espacios de la línea cruda. */
  nivel?: number;
  encabezado?: string[];
  filas?: string[][];
}

/**
 * Markdown → bloques.
 *
 * La línea se mide ANTES de recortarla: la sangría es información —dice el nivel de la lista— y
 * `trim()` la borra. Ése era el defecto 1 del encabezado.
 */
export function aBloques(texto: string): Bloque[] {
  const salida: Bloque[] = [];
  const lineas = String(texto).split('\n');
  let i = 0;

  const nivelDe = (cruda: string): number => {
    const sangria = /^[ \t]*/.exec(cruda)?.[0] ?? '';
    // Una tabulación cuenta como dos espacios, y dos espacios son un nivel. Tope en 2: más anidación
    // que ésa no se distingue en A4 y termina como un párrafo corrido contra el margen derecho.
    const espacios = sangria.replace(/\t/g, '  ').length;
    return Math.min(2, Math.floor(espacios / 2));
  };

  while (i < lineas.length) {
    const cruda = lineas[i] as string;
    const linea = cruda.trim();
    const siguiente = i + 1 < lineas.length ? (lineas[i + 1] as string).trim() : '';

    if (/^\|.*\|$/.test(linea) && /^\|[\s:\-|]+\|$/.test(siguiente)) {
      const celdas = (s: string) => s.replace(/^\||\|$/g, '').split('|').map(sinMarcasEnLinea);
      const encabezado = celdas(linea);
      i += 2;
      const filas: string[][] = [];
      while (i < lineas.length && /^\|.*\|$/.test((lineas[i] as string).trim())) {
        filas.push(celdas((lineas[i] as string).trim()));
        i++;
      }
      salida.push({ tipo: 'tabla', encabezado, filas });
      salida.push({ tipo: 'aire' });
      continue;
    }

    const numerada = /^(\d+)[.)]\s+(.*)$/.exec(linea);

    if (!linea) {
      const ultimo = salida[salida.length - 1];
      if (salida.length && ultimo && ultimo.tipo !== 'aire') salida.push({ tipo: 'aire' });
    } else if (/^###\s+/.test(linea)) {
      salida.push({ tipo: 'h3', texto: sinMarcasEnLinea(linea.replace(/^###\s+/, '')) });
    } else if (/^##\s+/.test(linea)) {
      salida.push({ tipo: 'h2', texto: sinMarcasEnLinea(linea.replace(/^##\s+/, '')) });
    } else if (/^#\s+/.test(linea)) {
      salida.push({ tipo: 'h1', texto: sinMarcasEnLinea(linea.replace(/^#\s+/, '')) });
    } else if (/^(---+|\*\*\*+|___+)$/.test(linea)) {
      salida.push({ tipo: 'regla' });
    } else if (/^[-*·•]\s+/.test(linea)) {
      salida.push({
        tipo: 'vineta',
        marca: '•',
        nivel: nivelDe(cruda),
        texto: sinMarcasEnLinea(linea.replace(/^[-*·•]\s+/, '')),
      });
    } else if (numerada && numerada[1] && numerada[2] !== undefined) {
      // La rama que faltaba, y que `aHtml` sí tenía. Sin ella el PDF contradecía a la pantalla.
      salida.push({
        tipo: 'vineta',
        marca: `${numerada[1]}.`,
        nivel: nivelDe(cruda),
        texto: sinMarcasEnLinea(numerada[2]),
      });
    } else {
      salida.push({ tipo: 'p', texto: sinMarcasEnLinea(linea) });
    }
    i++;
  }
  return salida;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** La portada: una página oscura entera, con la marca y el título. */
function dibujarPortada(doc: any, titulo: string, organizacion: string, ancho: number, alto: number): void {
  doc.setFillColor(...FONDO_PORTADA);
  doc.rect(0, 0, ancho, alto, 'F');

  // La marca, arriba. El punto es un círculo dibujado y no un carácter: las fuentes estándar del
  // PDF no tienen `◉`, y saldría como un cuadradito.
  doc.setFillColor(...ACENTO);
  doc.circle(MARGEN + 4, 74, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BLANCO);
  doc.text('ARIA', MARGEN + 15, 78);

  // El título, en el primer tercio y no centrado: una portada con el texto al medio se lee como una
  // diapositiva, y esto es la tapa de un documento.
  let y = alto * 0.38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(...BLANCO);
  doc.splitTextToSize(titulo, ancho - MARGEN * 2 - 40).forEach((linea: string) => {
    doc.text(linea, MARGEN, y);
    y += 36;
  });

  doc.setDrawColor(...ACENTO);
  doc.setLineWidth(2.5);
  doc.line(MARGEN, y + 4, MARGEN + 64, y + 4);
  doc.setLineWidth(1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TENUE);
  doc.text(procedencia(organizacion), MARGEN, y + 34);
}

/** La cabecera corrida de una página del cuerpo. */
function dibujarCabecera(doc: any, titulo: string, ancho: number): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TENUE);
  doc.text(`ARIA · ${titulo}`, MARGEN, 44);
  doc.setDrawColor(...ACENTO_HONDO);
  doc.line(MARGEN, 52, ancho - MARGEN, 52);
  doc.setTextColor(...TINTA);
}

/**
 * El foliado, al final y de una sola pasada.
 *
 * No se puede escribir «2 de 5» mientras se dibuja la página 2: el total no se sabe hasta que
 * terminó todo. Por eso se recorren las páginas al final. La portada se saltea a propósito — una
 * tapa numerada se ve como un error de imprenta.
 */
function foliar(doc: any, ancho: number, alto: number): void {
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TENUE);
    doc.text(`${p - 1} / ${total - 1}`, ancho - MARGEN, alto - 30, { align: 'right' });
  }
}

/**
 * Construye el documento. **Separado de la descarga a propósito.**
 *
 * `doc.save()` sólo existe en el navegador, así que un exportador que descargue y construya en la
 * misma función no se puede mirar sin abrir un navegador — y un PDF es justo lo que hay que MIRAR
 * para saber si está bien. Con esta división, `pruebas/` lo genera y lo revisa.
 */
export async function construirPdf(titulo: string, texto: string, organizacion: string): Promise<any> {
  const { jsPDF } = await import('jspdf');

  // Las fuentes estándar del PDF NO tienen emojis: sin esto salen como cuadraditos o basura. Los
  // acentos del español sí funcionan, y por eso el rango no los toca.
  const limpio = String(texto)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/[ \t]+\n/g, '\n');

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const anchoMax = ancho - MARGEN * 2;

  dibujarPortada(doc, titulo, organizacion, ancho, alto);
  doc.addPage();
  dibujarCabecera(doc, titulo, ancho);
  let y = TECHO_CUERPO;

  /** EL ÚNICO lugar que cambia de página. Ver el encabezado. */
  const saltarPagina = () => {
    doc.addPage();
    dibujarCabecera(doc, titulo, ancho);
    y = TECHO_CUERPO;
  };
  const asegurar = (necesita: number) => {
    if (y + necesita > alto - MARGEN) saltarPagina();
  };

  const escribir = (t: string, tamano: number, estilo: 'normal' | 'bold', sangria: number, aire: number) => {
    doc.setFont('helvetica', estilo);
    doc.setFontSize(tamano);
    doc.setTextColor(...TINTA);
    doc.splitTextToSize(t, anchoMax - sangria).forEach((ln: string) => {
      asegurar(ALTURA_LINEA);
      doc.text(ln, MARGEN + sangria, y);
      y += tamano >= 12 ? tamano + 5 : ALTURA_LINEA;
    });
    if (aire) y += aire;
  };

  /**
   * Un ítem de lista con sangría francesa: la marca al margen y TODAS las líneas del texto
   * alineadas entre sí. Era el defecto 3 — sin esto, la segunda línea de una viñeta vuelve al
   * margen y se lee como un ítem nuevo.
   */
  const escribirConMarca = (marca: string, t: string, nivel: number) => {
    const sangria = 10 + nivel * 16;
    const anchoMarca = 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...TINTA);
    const lineas: string[] = doc.splitTextToSize(t, anchoMax - sangria - anchoMarca);
    lineas.forEach((ln, i) => {
      asegurar(ALTURA_LINEA);
      if (i === 0) doc.text(marca, MARGEN + sangria, y);
      doc.text(ln, MARGEN + sangria + anchoMarca, y);
      y += ALTURA_LINEA;
    });
  };

  /** La barra de acento de una sección. Decorativa: el texto va aparte, en tinta. */
  const barraDeSeccion = (altura: number) => {
    doc.setFillColor(...ACENTO_HONDO);
    doc.rect(MARGEN - 12, y - altura + 3, 3, altura, 'F');
  };

  const dibujarTabla = (tabla: Bloque) => {
    const encabezado = tabla.encabezado || [];
    const filas = tabla.filas || [];
    const columnas = Math.max(encabezado.length, ...(filas.length ? filas.map((f) => f.length) : [0]), 1);
    const relX = 7;
    const relY = 4;
    const alturaCelda = 10.5;

    /* Las columnas se reparten POR CONTENIDO, no en partes iguales.
       ────────────────────────────────────────────────────────────────────────
       El hub las divide en partes iguales, y en la tabla real de «Situación actual vs deseada» eso
       da una primera columna medio vacía («Qué vende», «Escalabilidad») mientras las otras dos
       parten cada frase en tres líneas. La tabla ocupa el doble de alto del que necesita.

       El reparto es por la RAÍZ del largo del texto, no por el largo: proporcional a secas, una
       celda con un párrafo se comería la fila entera. Y con topes a los dos lados —ninguna baja del
       60 % ni pasa del 180 % de lo que le tocaría en partes iguales— porque sin el piso una columna
       de una palabra queda tan angosta que su encabezado se parte letra por letra. */
    const anchoParejo = anchoMax / columnas;
    const pesos = Array.from({ length: columnas }, (_, c) => {
      const largos = [encabezado[c] || '', ...filas.map((f) => f[c] || '')].map((t) => String(t).length);
      return Math.sqrt(Math.max(1, ...largos));
    });
    const sumaPesos = pesos.reduce((a, b) => a + b, 0);
    const crudos = pesos.map((peso) => (peso / sumaPesos) * anchoMax);
    const topados = crudos.map((w) => Math.min(anchoParejo * 1.8, Math.max(anchoParejo * 0.6, w)));
    // Los topes rompen la suma, así que se normaliza: la tabla tiene que medir `anchoMax` exacto o
    // el borde derecho no coincide con el de la regla del encabezado.
    const sumaTopados = topados.reduce((a, b) => a + b, 0);
    const anchos = topados.map((w) => (w / sumaTopados) * anchoMax);
    const izquierdaDe = (c: number) => MARGEN + anchos.slice(0, c).reduce((a, b) => a + b, 0);

    const dibujarFila = (celdas: string[], esCabecera: boolean) => {
      doc.setFont('helvetica', esCabecera ? 'bold' : 'normal');
      doc.setFontSize(8.5);
      const partidas: string[][] = [];
      for (let c = 0; c < columnas; c += 1) {
        partidas.push(doc.splitTextToSize(String(celdas[c] || ''), (anchos[c] as number) - relX * 2));
      }
      const altoFila = Math.max(1, ...partidas.map((p) => p.length)) * alturaCelda + relY * 2;
      if (y + altoFila > alto - MARGEN) {
        saltarPagina();
        // El defecto 4: la cabecera se REPITE en la página nueva. Sin esto se sigue leyendo
        // columnas sin saber cuál es cuál.
        if (!esCabecera && encabezado.some((c) => c)) dibujarFila(encabezado, true);
      }
      if (esCabecera) {
        // El acento al 100 % detrás de texto negro no pasa contraste, así que la cabecera va con un
        // velo del mismo turquesa: se lee como la misma familia y el texto queda legible.
        doc.setFillColor(226, 246, 244);
        doc.rect(MARGEN, y, anchoMax, altoFila, 'F');
      }
      doc.setDrawColor(205);
      doc.setTextColor(...TINTA);
      for (let c = 0; c < columnas; c += 1) {
        const x = izquierdaDe(c);
        doc.rect(x, y, anchos[c] as number, altoFila);
        (partidas[c] as string[]).forEach((ln, li) => {
          doc.text(ln, x + relX, y + relY + (li + 1) * alturaCelda - 3);
        });
      }
      y += altoFila;
    };

    if (encabezado.some((c) => c)) dibujarFila(encabezado, true);
    filas.forEach((f) => dibujarFila(f, false));
    y += 10;
  };

  for (const b of aBloques(limpio)) {
    if (b.tipo === 'h1') {
      y += 14;
      asegurar(30);
      barraDeSeccion(16);
      escribir(b.texto || '', 15, 'bold', 0, 6);
    } else if (b.tipo === 'h2') {
      y += 12;
      asegurar(28);
      barraDeSeccion(14);
      escribir(b.texto || '', 12.5, 'bold', 0, 5);
    } else if (b.tipo === 'h3') {
      y += 4;
      escribir(b.texto || '', 11, 'bold', 0, 3);
    } else if (b.tipo === 'regla') {
      asegurar(12);
      doc.setDrawColor(215);
      doc.line(MARGEN, y - 4, ancho - MARGEN, y - 4);
      y += 10;
    } else if (b.tipo === 'vineta') {
      escribirConMarca(b.marca || '•', b.texto || '', b.nivel || 0);
    } else if (b.tipo === 'tabla') {
      dibujarTabla(b);
    } else if (b.tipo === 'aire') {
      y += 7;
    } else {
      escribir(b.texto || '', 10.5, 'normal', 0, 0);
    }
  }

  foliar(doc, ancho, alto);
  return doc;
}

/**
 * Descarga el documento como `.pdf`.
 *
 * `jspdf` entra por `import()` dinámico dentro de `construirPdf`: pesa ~350 KB y la mayoría de
 * quienes abren la pantalla no descargan nada.
 */
export async function descargarComoPdf(titulo: string, texto: string, organizacion: string): Promise<void> {
  const doc = await construirPdf(titulo, texto, organizacion);
  doc.save(`${nombreDeArchivo(titulo)}.pdf`);
}
