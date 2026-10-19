// EL BARRIDO ES POR CLIENTE: QUÉ TAREA ES DE QUIÉN, Y QUE CADA PIEZA LO RESPETE. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Bloque C, Paso C4)
//
//   · las tareas se reparten SIN huecos ni repeticiones entre la plataforma, los clientes y la empresa, y las de la
//     empresa son exactamente las que miran la empresa entera — mutación: mover `senales` a las de un cliente;
//   · el bucle no sella por fuera de su unidad: todo sello de una tarea pasa por `sellarAca` (con la cuenta de la
//     unidad) — mutación: volver a `sellar(org.id, tarea, …)`;
//   · la ruta del cron resuelve las credenciales de CADA cliente con el cliente, nunca `'la_de_la_empresa'` —
//     mutación: resolver los clientes con la de la empresa;
//   · el prompt del agente (que es de la empresa) sólo se usa con el cliente principal, en el auditor y en la mejora —
//     mutación: leer el prompt siempre;
//   · las pasadas con presupuesto propio (miniaturas y activos) se acotan también al fin de la corrida.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { TAREAS, TAREAS_DEL_CLIENTE, TAREAS_DE_LA_PLATAFORMA } from '../../lib/negocio/barrido.ts';

const leer = (ruta: string) => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));

test('cada tarea es de la plataforma, de un cliente o de la empresa, y de una sola', () => {
  const deLaEmpresa = TAREAS.filter((t) => !TAREAS_DE_LA_PLATAFORMA.includes(t) && !TAREAS_DEL_CLIENTE.includes(t));
  assert.deepEqual(
    TAREAS_DEL_CLIENTE.filter((t) => TAREAS_DE_LA_PLATAFORMA.includes(t)),
    [],
    'una tarea es de la plataforma y de un cliente a la vez',
  );
  assert.deepEqual(
    [...TAREAS_DEL_CLIENTE].sort(),
    [...new Set(TAREAS_DEL_CLIENTE)].sort().filter((t) => (TAREAS as readonly string[]).includes(t)),
    'hay una tarea de cliente repetida o que no existe',
  );
  // Las de la empresa miran la empresa entera: los Analizadores (las llamadas de tl;dv), su reintento y los detectores.
  assert.deepEqual(deLaEmpresa, ['analizadores', 'reintentos', 'senales']);
});

test('el bucle sella cada tarea con su unidad, nunca por fuera', () => {
  const barrido = leer('lib/negocio/barrido.ts');
  const i = barrido.indexOf('export async function barrerTodo(');
  const cuerpo = barrido.slice(i, barrido.indexOf('\n}\n', i));
  assert.ok(cuerpo.length > 1000, 'no encontré `barrerTodo`');
  const sueltos = [...cuerpo.matchAll(/\bsellar\(([^,]+),/g)].map((m) => m[1]!.trim());
  // Uno solo: el de `sellarAca`, con la cuenta de la unidad.
  assert.deepEqual(sueltos, ['org.id'], 'el bucle sella una tarea sin pasar por su unidad');
  assert.match(cuerpo, /await sellar\(org\.id, cuentaId, tarea, estado, motivo, llamadas\)/);
  assert.ok((cuerpo.match(/\bsellarAca\(/g) ?? []).length >= 7, 'faltan sellos de la unidad');
  // Y el presupuesto se mira adentro del bucle de las unidades, no una vez por empresa.
  const bucle = cuerpo.slice(cuerpo.indexOf('of enOrden)'));
  assert.ok(bucle.length < cuerpo.length, 'no encontré el bucle de las unidades');
  assert.match(bucle, /if \(ahora\(\) - arranque > PRESUPUESTO_MS\)/);
});

test('la ruta del cron resuelve las credenciales de cada cliente con su cliente', () => {
  const ruta = leer('app/api/cron/route.ts');
  const i = ruta.indexOf('async function credencialesDeLosClientes(');
  const cuerpo = ruta.slice(i, ruta.indexOf('\n}\n', i));
  assert.match(cuerpo, /clientesParaBarrer\(db, orgId\)/);
  for (const r of ['resolverAccesoAGhl', 'resolverAccesoAlAuditor', 'resolverAccesoAMeta']) {
    assert.match(cuerpo, new RegExp(`${r}\\(db, orgId, cuenta\\)`), `${r} no se resuelve con el cliente`);
  }
  assert.doesNotMatch(cuerpo, /la_de_la_empresa/);
  const cuentas = leer('lib/administracion/cuentas.ts');
  const j = cuentas.indexOf('export async function clientesParaBarrer(');
  assert.match(cuentas.slice(j, cuentas.indexOf('\n}\n', j)), /\.where\('estado', '=', 'activa'\)/, 'se barren clientes en pausa');
});

test('el prompt del agente sólo con el cliente principal, en el auditor y en la mejora', () => {
  for (const ruta of ['lib/auditor/analisis.ts', 'lib/auditor/buscarMejora.ts']) {
    const fuente = leer(ruta);
    const lecturas = [...fuente.matchAll(/const prompt = ([^;]+);/g)].map((m) => m[1]!);
    assert.ok(lecturas.length > 0, `${ruta}: no encontré la lectura del prompt`);
    for (const l of lecturas) {
      assert.match(l, /^e\.esPorOmision \? await leerPromptDelAgente\(/, `${ruta}: el prompt de la empresa se usa con cualquier cliente`);
    }
  }
  const barrido = leer('lib/negocio/barrido.ts');
  assert.match(barrido, /auditar\(org, elAmbito\(\), esPorOmision,/);
  assert.match(barrido, /mejorar\(org, elAmbito\(\), esPorOmision,/);
});

test('las miniaturas y los activos se acotan al fin de la corrida', () => {
  const barrido = leer('lib/negocio/barrido.ts');
  assert.match(barrido, /releerContactos\(elAmbito\(\), conToken\(acceso\), arranque \+ FIN_PARA_LOS_ANALIZADORES_MS, ahora\)/);
  assert.match(barrido, /recolectarActivos\(elAmbito\(\), meta, ahora, arranque \+ FIN_PARA_LOS_ANALIZADORES_MS\)/);
  assert.match(leer('lib/negocio/miniaturaDelContacto.ts'), /const hasta = Math\.min\(ahora\(\) \+ TIEMPO_DE_LA_PASADA_MS, fin\)/);
  assert.match(leer('lib/negocio/recolectarActivos.ts'), /const hasta = Math\.min\(ahora\(\) \+ PRESUPUESTO_DE_ACTIVOS_MS, fin\)/);
});
