// Toda clase que un panel de Inteligencia dibuja tiene una regla que la alcanza. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// YA PASÓ, Y UNA DE LAS CLASES SIN REGLA NO ERA COSMÉTICA
//
// Cuando Creative estrenó su panel, **seis clases que dibujaba no las alcanzaba ninguna regla**
// —`.cs-nota`, `.cs-grave`, `.cs-vacio`, `.cs-fuera`, `.cs-barra` y `.cs-periodos`— porque las suyas
// colgaban de `:is(#v-conversation, #v-acquisition)`. El commit que trajo ese panel agregó sólo las
// de su tabla.
//
// Y una de las omitidas no era cosmética: `.csr-b{display:block;width:100%}` existe porque esa barra
// es un `span`, así que **la barra de cobertura de Creative no se dibujaba**. El defecto está escrito
// en el encabezado de `app/inteligencia-estetica.css` y se corrigió a mano.
//
// El 2026-09-21 volvió a estar a punto de pasar por quinta vez: al darle su panel a Sales, **65
// reglas del vocabulario de tablero y 106 de las tablas no alcanzaban a `#v-sales`**. Esta prueba es
// lo que lo convierte en un rojo en vez de en una pantalla que se ve rara.
//
// ── CÓMO SE MIDE, Y POR QUÉ ASÍ ─────────────────────────────────────────────
//
// Una clase está cubierta cuando existe al menos un selector que la nombra Y **o no menciona ninguna
// vista, o menciona la suya**. Un selector con `#v-creative` no cubre a `#v-sales` aunque nombre la
// misma clase: ése es exactamente el modo de fallar.
//
// No se comprueba que la regla sea la CORRECTA —eso no lo puede ver una prueba de texto— sino que
// exista alguna. Es la diferencia entre «se ve distinto» y «no se dibuja».
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';

/** Cada panel de Inteligencia con el `id` de la vista que lo monta. */
const PANELES: Readonly<Record<string, string>> = {
  'components/acquisition/PanelDeAcquisition.jsx': 'v-acquisition',
  'components/creative/PanelDeCreative.jsx': 'v-creative',
  'components/conversion/PanelDeConversion.jsx': 'v-conversion',
  'components/sales/PanelDeSales.jsx': 'v-sales',
  /* No es de Inteligencia, y entra igual: es la sexta pantalla que dibuja un panel nuevo, y el modo
     de fallar es el mismo —una clase sin regla que la alcance no se dibuja—. */
  'components/analizadores/PanelDeAnalizadores.jsx': 'v-analizadores',
  'components/analizadores/DetalleHt.jsx': 'v-analizadores',
  'components/analizadores/DetalleOb.jsx': 'v-analizadores',
};

const sinComentarios = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, '');

/** Todos los selectores de las hojas de `app/`, sin comentarios ni bloques de `@`. */
function selectores(): string[] {
  const dir = join(RAIZ, 'app');
  const salida: string[] = [];
  for (const nombre of readdirSync(dir).filter((n) => n.endsWith('.css'))) {
    const t = sinComentarios(readFileSync(join(dir, nombre), 'utf8'));
    for (const m of t.matchAll(/([^{}@]+)\{/g)) {
      const sel = m[1]!.split(/\s+/).filter(Boolean).join(' ');
      /* Los pasos de una animación (`from`, `to`, `40%`) no son selectores: cuentan como regla y
         nombrarían cualquier cosa. */
      if (sel && !/^(from|to|[\d.]+%)$/.test(sel)) salida.push(sel);
    }
  }
  return salida;
}

/**
 * Las clases que un panel escribe en `className`.
 *
 * **Se descartan los operandos de una comparación.** Un `punto.clave === 'utm_incompletas' ? 'a' :
 * 'b'` tiene tres literales y sólo dos son clases; sin este recorte, la prueba exige una regla para
 * un valor de datos y el arreglo sería inventar CSS muerto. Lo encontró la primera corrida.
 */
function clasesDe(fuente: string): string[] {
  const limpio = sinComentarios(fuente);
  const clases = new Set<string>();
  for (const m of limpio.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([^}]*)\})/g)) {
    if (m[1] !== undefined) {
      for (const c of m[1].split(/\s+/)) if (/^[a-zA-Z][\w-]*$/.test(c)) clases.add(c);
      continue;
    }
    const expr = (m[2] ?? '').replace(/[=!]==?\s*['"`][^'"`]*['"`]/g, '');
    for (const lit of expr.matchAll(/['"`]([^'"`]*)['"`]/g)) {
      for (const c of lit[1]!.split(/\s+/)) if (/^[a-zA-Z][\w-]*$/.test(c)) clases.add(c);
    }
  }
  return [...clases].sort();
}

/** ¿Hay algún selector que nombre la clase y alcance a esa vista? */
function alcanzada(clase: string, vista: string, sels: string[]): boolean {
  const nombra = new RegExp(`\\.${clase.replace(/[-]/g, '\\$&')}(?![\\w-])`);
  return sels.some((sel) => {
    if (!nombra.test(sel)) return false;
    const vistas = [...sel.matchAll(/#(v-[\w-]+)/g)].map((x) => x[1]);
    return vistas.length === 0 || vistas.includes(vista);
  });
}

test('los paneles de la lista existen: sin esto la prueba no mira nada', () => {
  /* La guarda que sostiene a la de abajo. Renombrar un panel —o mover su carpeta— haría que el
     recorrido no encuentre nada y la afirmación pasara en vacío, que es la forma en que una prueba
     de barrido deja de proteger sin fallar. */
  for (const panel of Object.keys(PANELES)) {
    assert.ok(existsSync(join(RAIZ, panel)), `${panel} no existe: actualizá la lista de esta prueba`);
  }
  assert.ok(selectores().length > 500, 'se leyeron muy pocos selectores: el recorrido de hojas falló');
});

test('toda clase que un panel de Inteligencia dibuja tiene una regla que alcanza a SU vista', () => {
  const sels = selectores();
  const huerfanas: string[] = [];

  for (const [panel, vista] of Object.entries(PANELES)) {
    const clases = clasesDe(readFileSync(join(RAIZ, panel), 'utf8'));
    assert.ok(clases.length > 10, `${panel}: se leyeron ${clases.length} clases, el extractor falló`);
    for (const c of clases) {
      if (!alcanzada(c, vista, sels)) huerfanas.push(`${panel} dibuja .${c} y nada la alcanza en #${vista}`);
    }
  }

  assert.deepEqual(
    huerfanas,
    [],
    'estas clases no las alcanza ninguna regla: casi siempre porque el selector nombra las otras ' +
      'vistas y no la suya. No se ve como un error — se ve como una pantalla mal maquetada.',
  );
});
