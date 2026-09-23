// LAS MEDICIONES DE LOS ANALIZADORES: lo que un guion de consulta contra producción no puede hacer. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `scripts/medir-analizadores.sql` y `scripts/comparar-con-brain.sql` se corren a mano contra
// producción, y su salida termina en una consola, en un mensaje o en `docs/ANALIZADORES.md`, que es
// un repositorio PÚBLICO. Tres cosas que no fallan en ninguna corrida y hay que impedir de antemano:
//
//   · **que escriban.** `supabase.mjs leer` manda `read_only: true` y una escritura se rechaza; pero
//     el mismo archivo pasado con `correr` escribiría. El guion tiene que ser inofensivo por sí mismo;
//   · **que lean una llave.** Una columna cifrada o la tabla de llaves de Brain en la salida es una
//     credencial impresa;
//   · **que impriman datos de una persona.** Títulos, nombres, correos o el texto del análisis.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', '..');
const GUIONES = ['scripts/medir-analizadores.sql', 'scripts/comparar-con-brain.sql'] as const;

/** El SQL sin sus comentarios de línea: los encabezados explican qué NO hace, con esas mismas palabras. */
const sinComentarios = (ruta: string): string =>
  readFileSync(join(RAIZ, ruta), 'utf8')
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');

test('las mediciones no escriben nada', () => {
  for (const ruta of GUIONES) {
    const sql = sinComentarios(ruta);
    const escritura = sql.match(/\b(insert|update|delete|merge|truncate|drop|alter|create|grant|revoke|copy|call|do)\b/i);
    assert.equal(escritura, null, `${ruta} tiene «${escritura?.[0]}»`);
  }
});

test('las mediciones no leen ninguna llave', () => {
  for (const ruta of GUIONES) {
    const sql = sinComentarios(ruta);
    const llave = sql.match(/_cifrada\b|api_key|client_keys|aria_brain_analyzer_tldv|organizaciones_credenciales/i);
    assert.equal(llave, null, `${ruta} nombra «${llave?.[0]}»`);
  }
});

test('las mediciones no sacan datos de nadie: ni títulos, ni nombres, ni correos, ni el texto', () => {
  /* Los nombran las columnas que la salida podría llevar. Un `l.*` dentro de una subconsulta que no
     llega a la salida no cuenta: lo que se mira es que ninguno de estos nombres aparezca. */
  const PERSONALES = /\b(titulo|prospecto_nombre|prospecto_email|organizador_nombre|organizador_email|invitados|url_de_la_grabacion|meeting_url|invitees|motivo|error|resumen|summary|texto|segmentos|analisis_json|insight_json|ficha)\b/i;
  for (const ruta of GUIONES) {
    const sql = sinComentarios(ruta);
    const dato = sql.match(PERSONALES);
    assert.equal(dato, null, `${ruta} nombra la columna «${dato?.[0]}»`);
  }
});
