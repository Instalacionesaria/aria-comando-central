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
/* `docs/leads-portal` entró el día que nació (2026-09-26): una carpeta nueva no trae deuda, así que
   auditarla desde el primer commit es gratis y evita que junte la que juntó Sales.
   `docs/OTROS/estado actual` entró el 2026-09-28, el día que se reescribió entera: es la carpeta que
   más cita al código —cada afirmación de la foto lleva su `archivo:línea`— y la que más rápido se
   pudre, porque describe el código de un día y el código sigue. Reescrita, tampoco trae deuda. */
/* Y un ARCHIVO suelto, `docs/creative/15-…`, que entró el día que nació (2026-09-29). La carpeta
   `docs/creative/` entera no puede entrar todavía: sus documentos citan `lib/aios/creative.js`, que se
   borró el 2026-09-19, como referencia histórica, y esas citas darían «el archivo no está». El 15 no
   arrastra ninguna, así que se audita solo. */
/* Y otro, `docs/OTROS/futuro/miniatura-y-video-de-meta.md` (2026-09-30): el plan de lo que falta
   de ese mismo 15, escrito para retomarlo mucho después. Es el documento que más tiempo va a pasar
   sin que nadie lo lea, y cada cita suya es un lugar del código que la etapa pendiente va a tocar:
   si una se corre, quien lo retome tiene que enterarse por la suite y no por abrir la línea
   equivocada. El resto de `futuro/` no entra: no se revisó. */
/* Y los dos del 2026-09-30 que devuelven Acquisition al front del prototipo: el `14` de la carpeta,
   que nace ese día y fija qué dato va en cada lugar de la maqueta, y el plan de lo que se dejó para
   los agentes de IA. El resto de `docs/acquisition/` no entra: cita `lib/aios/acquisition.js`, que
   se borró el 2026-09-16, como referencia histórica, igual que Creative. */
const AUDITADAS = [
  'docs/sales',
  'docs/leads-portal',
  'docs/OTROS/estado actual',
  'docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md',
  'docs/OTROS/futuro/miniatura-y-video-de-meta.md',
  // El plan de las ventanas en el día de la empresa (2026-10-07): diagnosticado y dejado para después.
  'docs/OTROS/futuro/el-dia-de-la-empresa.md',
  'docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md',
  'docs/OTROS/futuro/plan-y-senales-de-acquisition.md', 'docs/OTROS/nueva-estructura', 'docs/OTROS/futuro/permisos-por-herramienta.md', 'docs/OTROS/futuro/el-cerebro.md', 'docs/OTROS/agentes', 'docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md', 'docs/OTROS/futuro/lo-que-conversion-no-mide.md', // ver «LA NUEVA ESTRUCTURA», «LOS AGENTES» y «EL FRONT DE CONVERSION», al final
];
/** Dónde puede vivir un archivo citado. No se camina `node_modules` ni `.next`. */
const FUENTES = ['lib', 'app', 'components', 'pruebas', 'scripts', 'docs', 'db'];

/**
 * Una cita: `` `ruta.ts:12` `` o `` `ruta.ts:12-40` ``, siempre entre acentos graves.
 *
 * Los acentos graves no son decoración: sin ellos el patrón toma un `algo.ts:` suelto de una frase
 * corriente y la prueba empieza a opinar sobre la prosa.
 *
 * ── LAS DOS RUTAS QUE EL PATRÓN NO VEÍA ─────────────────────────────────────
 *
 * Hasta el 2026-09-28 el patrón no admitía corchetes ni espacios, y dos familias de citas pasaban
 * **sin que nadie las mirara y sin ningún aviso**: las rutas dinámicas de Next
 * (`app/api/leads-portal/[id]/route.ts:12`) y las que entran a `docs/OTROS/estado actual/`, que es la
 * única carpeta del repositorio con un espacio en el nombre. No eran casos raros: la reescritura de
 * esa carpeta encontró citas de las dos formas en las tres carpetas auditadas.
 *
 * El espacio se admite **sólo** entre `estado` y `actual/`. Abrirlo a cualquier espacio haría que un
 * fragmento de SQL o de prosa entre acentos graves que termine en `.md:3` pasara por una cita.
 */
const CITA =
  /`((?:[A-Za-z0-9_./[\]-]|(?<=estado) (?=actual\/))+\.(?:ts|tsx|js|jsx|mjs|css|sql|md)):(\d+)(?:-(\d+))?`/g;

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
  for (const doc of dir.endsWith('.md') ? [dir] : archivosDe(dir, (n) => n.endsWith('.md'))) {
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

test('el patrón ve las rutas con corchetes y las que pasan por «estado actual»', () => {
  /* Las dos familias que el patrón viejo salteaba en silencio (ver `CITA`). Si el patrón vuelve a
     perder una, las otras pruebas siguen verdes —auditan menos citas, no citas malas— y esto es lo
     único que se entera. */
  assert.ok(
    CITAS.some((c) => c.ruta.includes('[')),
    'ninguna cita con corchetes: el patrón dejó de ver las rutas dinámicas de Next',
  );
  assert.ok(
    CITAS.some((c) => c.ruta.includes('estado actual/')),
    'ninguna cita a «docs/OTROS/estado actual/»: el patrón dejó de admitir el espacio de esa carpeta',
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

/* ── LA NUEVA ESTRUCTURA (2026-10-01) ─────────────────────────────────────────
   `docs/OTROS/nueva-estructura/` entró el día que nació, con los dos planes de `futuro/` que salieron
   de ella: los permisos por herramienta y el cerebro. Dice qué se va a hacer, etapa por etapa, y cada
   etapa va a mover el código que cita, así que es la carpeta que más rápido se pudriría sin auditar.
   Las tres entradas van en la misma línea que la última de la lista, y esta nota al final del
   archivo, para no correr las líneas de esta prueba que otros documentos citan. */

/* ── LAS CITAS FIJADAS A UN COMMIT (2026-10-01) ───────────────────────────────
   La etapa 7 de la nueva estructura borra la maqueta del Executive —`lib/aios/executive.js` y ocho
   archivos más— y reescribe `components/views/ExecutiveView.jsx` entero. 244 citas de las carpetas
   auditadas apuntaban ahí. Esas citas no estaban mal: describen el código que había, y la foto de
   `estado actual` es justamente eso. Lo que no puede es seguir apuntando a la rama viva.

   Se escriben fijadas al último commit donde existen: `` `lib/aios/executive.js:17@c4cf2a8` ``. El
   patrón `CITA` no las toma —después de los dígitos no viene el acento grave—, así que esta prueba no
   las audita, y es a propósito: valen para ese commit, que es donde hay que leerlas
   (`git show c4cf2a8:lib/aios/executive.js`). Lo comprobó la etapa 6 borrando los nueve archivos con
   las citas fijadas, y la prueba quedó verde; dejando una sola sin fijar, en rojo. */

/* ── LOS AGENTES (2026-10-04) ─────────────────────────────────────────────────
   `docs/OTROS/agentes/` entró el día que nació, por lo mismo que la nueva estructura: es el plan de los
   agentes de IA, cada etapa va a mover el código que cita, y una carpeta nueva no trae deuda. La entrada
   va en la misma línea que la última de la lista, para no correr las líneas de esta prueba. */

/* ── EL FRONT DE CONVERSION (2026-10-08) ──────────────────────────────────────
   Los dos documentos que devuelven Conversion al front del prototipo entraron el día que nacieron: el `15`
   de la carpeta, que fija qué dato va en cada lugar de la maqueta, y el plan de lo que esa pantalla no mide.
   Las etapas CV-1 a CV-4 van a mover casi todo el código que el `15` cita, así que es el documento que más
   rápido se pudriría sin auditar. El resto de `docs/conversion/` no entra: cita `lib/aios/conversion.js`,
   que se borró el 2026-09-20, como referencia histórica, igual que Creative y Acquisition. Las dos entradas
   van en la misma línea que la última de la lista, para no correr las líneas de esta prueba. */
