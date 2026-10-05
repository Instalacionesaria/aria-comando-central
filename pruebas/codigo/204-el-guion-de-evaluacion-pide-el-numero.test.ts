// EL GUION DE EVALUACIÓN NO CORRE SIN EL NÚMERO APROBADO, Y NO TIENE `fetch(`. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `scripts/evaluar-agentes.mjs` (AG4, `07`, AG-104) gasta la llave de ARIA. Cada tanda se corre con el OK
// del usuario en el chat, con el número de pedidos: el guion dice cuántos va a hacer y no corre sin
// `--confirmo` con ESE número. Con otro número se niega, para que un número cualquiera no destrabe la
// corrida.
//
// El guion se corre de verdad, como proceso, con la base de identidad apuntando a un anfitrión remoto que no
// existe: si una mutación lo dejara pasar, se frenaría en la guarda de la base local antes de leer ninguna
// llave. Esta prueba nunca puede gastar.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';

const GUION = join(RAIZ, 'scripts', 'evaluar-agentes.mjs');

/** Corre el guion con esos argumentos, sin `.env.local` y con la base de identidad remota. */
function correr(...argumentos: string[]): { salida: number | null; texto: string } {
  const r = spawnSync(process.execPath, [GUION, ...argumentos], {
    cwd: RAIZ,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      DATABASE_URL_IDENTIDAD: 'postgresql://alguien:clave@proyecto-de-prueba.supabase.co:5432/postgres',
      ARIA_SEMBRADO_FORZADO: '',
    },
  });
  return { salida: r.status, texto: `${r.stdout}${r.stderr}` };
}

test('sin `--confirmo`, dice cuántos pedidos va a hacer y no corre', () => {
  const r = correr('modelo');
  assert.equal(r.salida, 1);
  assert.match(r.texto, /Va a hacer 2 pedido\(s\) a Anthropic/);
  assert.match(r.texto, /No corre sin el OK\. Para correrla: --confirmo 2/);
});

test('con otro número se niega, y no llega a mirar la base', () => {
  for (const otro of ['3', '1', '0', 'dos']) {
    const r = correr('modelo', '--confirmo', otro);
    assert.equal(r.salida, 1, otro);
    assert.match(r.texto, new RegExp(`--confirmo ${otro} no es 2: no corre\\.`), otro);
    assert.doesNotMatch(r.texto, /se niega a correr contra/, `${otro}: pasó la confirmación`);
  }
});

test('con el número correcto pasa la confirmación y se frena en la guarda de la base local', () => {
  /* Es lo que asegura que la prueba de arriba mira algo: el número correcto SÍ destraba, y lo siguiente
     que hace el guion es negarse a leer la llave de una base que no es local. */
  const r = correr('modelo', '--confirmo', '2');
  assert.equal(r.salida, 1);
  assert.match(r.texto, /la evaluación de los agentes se niega a correr contra "proyecto-de-prueba\.supabase\.co"/);
});

test('una tanda que no existe no corre', () => {
  const r = correr('cerebro');
  assert.equal(r.salida, 2);
  assert.match(r.texto, /Tandas: modelo\./);
});

test('el guion sale por `pedirExterno`: ningún `fetch(`', () => {
  const codigo = sinComentarios(readFileSync(GUION, 'utf8'));
  assert.doesNotMatch(codigo, /\bfetch\s*\(/);
  assert.match(codigo, /pedirExterno\(/);
});
