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
// jsPDF dibuja, no maqueta: no entiende markdown ni HTML. Así que el texto se parte en bloques con
// forma —encabezado, viñeta, tabla, regla, párrafo— y cada uno se dibuja con su tipografía y su
// salto de página. Port verbatim del hub, que a su vez lo portó del original.

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
  encabezado?: string[];
  filas?: string[][];
}

function aBloques(texto: string): Bloque[] {
  const salida: Bloque[] = [];
  const lineas = String(texto).split('\n');
  let i = 0;
  while (i < lineas.length) {
    const linea = (lineas[i] as string).trim();
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

    if (!linea) {
      const ultimo = salida[salida.length - 1];
      if (salida.length && ultimo && ultimo.tipo !== 'aire') salida.push({ tipo: 'aire' });
    } else if (/^###\s+/.test(linea)) salida.push({ tipo: 'h3', texto: sinMarcasEnLinea(linea.replace(/^###\s+/, '')) });
    else if (/^##\s+/.test(linea)) salida.push({ tipo: 'h2', texto: sinMarcasEnLinea(linea.replace(/^##\s+/, '')) });
    else if (/^#\s+/.test(linea)) salida.push({ tipo: 'h1', texto: sinMarcasEnLinea(linea.replace(/^#\s+/, '')) });
    else if (/^(---+|\*\*\*+|___+)$/.test(linea)) salida.push({ tipo: 'regla' });
    else if (/^[-*·•]\s+/.test(linea)) salida.push({ tipo: 'vineta', texto: sinMarcasEnLinea(linea.replace(/^[-*·•]\s+/, '')) });
    else salida.push({ tipo: 'p', texto: sinMarcasEnLinea(linea) });
    i++;
  }
  return salida;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function dibujarTabla(doc: any, tabla: Bloque, margen: number, y: number, anchoMax: number, alturaPagina: number): number {
  const encabezado = tabla.encabezado || [];
  const filas = tabla.filas || [];
  const columnas = Math.max(encabezado.length, ...(filas.length ? filas.map((f) => f.length) : [0]), 1);
  const anchoCol = anchoMax / columnas;
  const relX = 5;
  const relY = 4;
  const cuerpo = 8.5;
  const alturaLinea = 10.5;

  const dibujarFila = (celdas: string[], negrita: boolean, fondo: boolean) => {
    doc.setFont('helvetica', negrita ? 'bold' : 'normal');
    doc.setFontSize(cuerpo);
    const partidas: string[][] = [];
    for (let c = 0; c < columnas; c += 1) {
      partidas.push(doc.splitTextToSize(String(celdas[c] || ''), anchoCol - relX * 2));
    }
    const alto = Math.max(1, ...partidas.map((p) => p.length)) * alturaLinea + relY * 2;
    if (y + alto > alturaPagina - margen) {
      doc.addPage();
      y = margen;
    }
    if (fondo) {
      doc.setFillColor(240, 237, 227);
      doc.rect(margen, y, anchoMax, alto, 'F');
    }
    doc.setDrawColor(170);
    doc.setTextColor(30);
    for (let c = 0; c < columnas; c += 1) {
      doc.rect(margen + c * anchoCol, y, anchoCol, alto);
      (partidas[c] as string[]).forEach((ln, li) => {
        doc.text(ln, margen + c * anchoCol + relX, y + relY + (li + 1) * alturaLinea - 3);
      });
    }
    y += alto;
  };

  if (encabezado.some((c) => c)) dibujarFila(encabezado, true, true);
  filas.forEach((f) => dibujarFila(f, false, false));
  return y + 8;
}

/**
 * Descarga el documento como `.pdf`.
 *
 * `jspdf` entra por `import()` dinámico: pesa ~350 KB y la mayoría de quienes abren la pantalla no
 * descargan nada.
 */
export async function descargarComoPdf(titulo: string, texto: string, organizacion: string): Promise<void> {
  const { jsPDF } = await import('jspdf');

  // Las fuentes estándar del PDF NO tienen emojis: sin esto salen como cuadraditos o basura. Los
  // acentos del español sí funcionan, y por eso el rango no los toca.
  const limpio = String(texto)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/[ \t]+\n/g, '\n');

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margen = 48;
  const anchoPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const anchoMax = anchoPagina - margen * 2;
  let y = margen;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.splitTextToSize(titulo, anchoMax).forEach((linea: string) => {
    doc.text(linea, margen, y);
    y += 20;
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(procedencia(organizacion), margen, y);
  y += 10;
  doc.setDrawColor(190);
  doc.line(margen, y, anchoPagina - margen, y);
  y += 18;
  doc.setTextColor(30);

  const alturaLinea = 14.5;
  const asegurar = (necesita: number) => {
    if (y + necesita > alturaPagina - margen) {
      doc.addPage();
      y = margen;
    }
  };
  const escribir = (t: string, tamano: number, estilo: 'normal' | 'bold', sangria: number, aire: number) => {
    doc.setFont('helvetica', estilo);
    doc.setFontSize(tamano);
    doc.splitTextToSize(t, anchoMax - sangria).forEach((ln: string) => {
      asegurar(alturaLinea);
      doc.text(ln, margen + sangria, y);
      y += tamano >= 12 ? tamano + 5 : alturaLinea;
    });
    if (aire) y += aire;
  };

  for (const b of aBloques(limpio)) {
    if (b.tipo === 'h1') { y += 6; escribir(b.texto || '', 14, 'bold', 0, 4); }
    else if (b.tipo === 'h2') { y += 5; escribir(b.texto || '', 12.5, 'bold', 0, 3); }
    else if (b.tipo === 'h3') escribir(b.texto || '', 11, 'bold', 0, 2);
    else if (b.tipo === 'regla') {
      asegurar(12);
      doc.setDrawColor(200);
      doc.line(margen, y - 4, anchoPagina - margen, y - 4);
      y += 8;
    } else if (b.tipo === 'vineta') escribir(`•  ${b.texto}`, 10.5, 'normal', 8, 0);
    else if (b.tipo === 'tabla') y = dibujarTabla(doc, b, margen, y, anchoMax, alturaPagina);
    else if (b.tipo === 'aire') y += 6;
    else escribir(b.texto || '', 10.5, 'normal', 0, 0);
  }

  doc.save(`${nombreDeArchivo(titulo)}.pdf`);
}
