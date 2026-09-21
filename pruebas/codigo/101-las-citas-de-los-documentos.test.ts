// Las citas `archivo:línea` de los documentos apuntan a algo. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// TRECE CITAS APUNTABAN MÁS ALLÁ DEL FINAL DE SU ARCHIVO, Y NADIE LO SABÍA
//
// Los documentos de un departamento se apoyan en citas al código —`inicio.ts:218-220`— y son lo que
// alguien abre para entender una pantalla antes de tocarla. Una cita rota no es un detalle de
// formato: manda a leer un archivo a una línea donde dice otra cosa, o donde no dice nada.
//
// **Y se rompen sin que nadie las toque.** La etapa 2 de Sales sacó `dineroDelMes` de `inicio.ts` y
// el archivo pasó de 268 a 177 líneas. Trece citas de `docs/sales/` quedaron apuntando al vacío en
// ese mismo commit, y tres commits después seguían ahí. Medido el 2026-09-21, antes de escribir esta
// prueba: **122 citas en rango, 13 fuera**.
//
// ── LO QUE ESTO ATRAPA Y LO QUE NO ──────────────────────────────────────────
//
// Atrapa la mitad cruda: la cita que se pasa del final del archivo. **No atrapa la que sigue dentro
// del rango y ya apunta a otra cosa** —`inicio.ts:147` sobrevivió a la extracción señalando una
// línea que hoy habla de otro tema— y no hay forma barata de atraparla: haría falta saber qué decía.
//
// Se hace igual porque la mitad que sí atrapa es la que aparece cuando un archivo **se acorta**, que
// es justo lo que pasa al extraer un módulo — o sea, la operación que este proyecto hace seguido.
//
// ── Y EL ALCANCE ES `docs/sales/` A PROPÓSITO ───────────────────────────────
//
// Las otras carpetas de `docs/` tienen sus propias citas y no se auditaron. Ampliar esto a todas sin
// medirlas antes pondría la suite en rojo por deuda ajena, y una prueba que nace roja se apaga. El
// día que se limpie otra carpeta se agrega acá, y este párrafo dice por qué faltaba.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', '..');
const AUDITADAS = ['docs/sales'];
/** Dónde puede vivir un archivo citado. No se camina `node_modules` ni `.next`. */
const FUENTES = ['lib', 'app', 'components', 'pruebas', 'scripts', 'docs', 'db'];

/**
 * Una cita: `` `ruta.ts:12` `` o `` `ruta.ts:12-40` ``, siempre entre acentos graves.
 *
 * Los acentos graves no son decoración: sin ellos el patrón toma un `algo.ts:` suelto de una frase
 * corriente y la prueba empieza a opinar sobre la prosa.
 */
const CITA = /`([A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|mjs|css|sql|md)):(\d+)(?:-(\d+))?`/g;

function archivosDe(dir: string, filtro?: (n: string) => boolean): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entrada.name}`;
    if (entrada.isDirectory()) salida.push(...archivosDe(rel, filtro));
    else if (!filtro || filtro(entrada.name)) salida.push(rel);
  }
  return salida;
}

/** Cuántas líneas tiene cada archivo del repositorio, por su ruta relativa con `/`. */
const LINEAS = new Map<string, number>();
for (const dir of FUENTES) {
  for (const rel of archivosDe(dir)) {
    LINEAS.set(rel, readFileSync(join(RAIZ, rel), 'utf8').split('\n').length);
  }
}

/**
 * A qué archivo apunta una cita.
 *
 * Se escriben desde donde le queda cómodo a quien redacta —`inicio.ts`, `lib/negocio/inicio.ts`—
 * así que se resuelven por SUFIJO. Y si el sufijo da más de un archivo se devuelve `'ambigua'` en
 * vez de elegir: elegir el primero validaría un archivo que no es el que el texto quiso nombrar, y
 * la prueba pasaría a garantizar algo falso.
 */
function resolver(ruta: string): { rel: string; lineas: number } | 'ambigua' | null {
  const propia = LINEAS.get(ruta);
  if (propia !== undefined) return { rel: ruta, lineas: propia };
  const hits = [...LINEAS.keys()].filter((k) => k.endsWith(`/${ruta}`));
  if (hits.length === 0) return null;
  if (hits.length > 1) return 'ambigua';
  return { rel: hits[0]!, lineas: LINEAS.get(hits[0]!)! };
}

interface Citada {
  documento: string;
  linea: number;
  texto: string;
  ruta: string;
  hasta: number;
}

const CITAS: Citada[] = [];
for (const dir of AUDITADAS) {
  for (const doc of archivosDe(dir, (n) => n.endsWith('.md'))) {
    for (const [i, l] of readFileSync(join(RAIZ, doc), 'utf8').split('\n').entries()) {
      for (const m of l.matchAll(CITA)) {
        CITAS.push({
          documento: doc,
          linea: i + 1,
          texto: m[0]!,
          ruta: m[1]!,
          hasta: Number(m[3] ?? m[2]),
        });
      }
    }
  }
}

const listar = (cs: Citada[]): string[] => cs.map((c) => `${c.documento}:${c.linea} → ${c.texto}`);

test('la prueba encuentra citas: sin esto, un patrón roto la deja verde sobre nada', () => {
  /* Es la afirmación que sostiene a las otras tres. Un `CITA` que deje de casar las vuelve las tres
     triviales, y el archivo entero pasaría a no proteger nada sin que nada fallara.
     *
     El piso son 100 y lo medido son 136: redondo y bajo, para que borrar un documento no lo rompa. */
  assert.ok(
    CITAS.length >= 100,
    `sólo se encontraron ${CITAS.length} citas en ${AUDITADAS.join(', ')}: el patrón dejó de casar`,
  );
});

test('cada archivo citado por los documentos existe', () => {
  assert.deepEqual(
    listar(CITAS.filter((c) => resolver(c.ruta) === null)),
    [],
    'un documento manda a leer un archivo que no está: se renombró o se borró y la cita quedó',
  );
});

test('ninguna cita apunta más allá del final de su archivo', () => {
  /* El caso que lo motivó: la etapa 2 de Sales extrajo `dineroDelMes` e `inicio.ts` pasó de 268 a
     177 líneas. Trece citas quedaron apuntando al vacío, en el commit de la extracción, y sobre esas
     trece se apoyaban los documentos que describen la pantalla que se estaba construyendo. */
  const fuera = CITAS.filter((c) => {
    const r = resolver(c.ruta);
    return r !== null && r !== 'ambigua' && c.hasta > r.lineas;
  });
  assert.deepEqual(
    fuera.map((c) => {
      const r = resolver(c.ruta) as { rel: string; lineas: number };
      return `${c.documento}:${c.linea} → ${c.texto} (${r.rel} tiene ${r.lineas} líneas)`;
    }),
    [],
    'hay citas que apuntan al vacío: casi siempre porque se extrajo un módulo y el archivo se acortó',
  );
});

test('ninguna cita es ambigua: dos archivos con el mismo nombre no se pueden distinguir', () => {
  /* Una cita a `esquema.ts` con dos `esquema.ts` en el repositorio no dice cuál. La prueba no
     adivina —elegir el primero validaría el archivo equivocado— así que exige más ruta.
     *
     Los basenames repetidos hoy son `route.ts`, `esquema.ts`, `vista.ts`, `organizaciones.ts` y
     varios `NN-NOMBRE.md` de las carpetas de departamento. **La mutación de esta prueba tiene que
     usar uno de ésos**: la primera versión probó con `contrato.ts`, que es único, así que resolvía
     bien y el mutante sobrevivía sin que la prueba tuviera ningún agujero. */
  assert.deepEqual(
    listar(CITAS.filter((c) => resolver(c.ruta) === 'ambigua')),
    [],
    'esta cita casa con más de un archivo: escribila con más ruta, como `lib/negocio/archivo.ts:12`',
  );
});
