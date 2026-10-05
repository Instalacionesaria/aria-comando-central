// LAS RONDAS DE UNA PREGUNTA SÓLO AGREGAN; LA PREGUNTA SIGUIENTE ARRANCA REDUCIDA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// Lo que AG1 dejó anotado para AG5 (`lib/agentes/llamada.ts`, «preserved thinking»): `claude-sonnet-5-5`
// rechaza con un 400 un historial que cambió un turno anterior, porque invalida los bloques de pensamiento
// que siguen. Dentro de una pregunta:
//
//   · cada ronda manda las MISMAS instrucciones y las MISMAS herramientas;
//   · su lista de mensajes es la de la ronda anterior, tal cual, más el turno del modelo como llegó
//     —`thinking` y firma incluidos— y los resultados de las herramientas.
//
// La pregunta siguiente del mismo hilo arranca con los turnos anteriores reducidos a texto, sin pensamiento.
// Y un modelo que contesta con texto suelto recibe una ronda más con el formato de `responder` y las
// herramientas apagadas, sin dejar de ofrecerlas.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { leerRespuesta, montar, pedirComo, type Escenario } from '../apoyo/closer.ts';
import {
  escribe,
  instalarModeloFalso,
  pideHerramienta,
  piensa,
  respuestaDelModelo,
  respuestaMinima,
  type BloqueFalso,
  type ModeloFalso,
} from '../apoyo/cerebro.ts';
import { POST as preguntarAlCerebro } from '../../app/api/executive/route.ts';

let esc: Escenario;
let modelo: ModeloFalso | null = null;

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.conversaciones_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.topes_del_executive where org_id = $1', [esc.org]);
  // El registro del tope no cae con los hilos (a propósito): se limpia aparte.
  await esc.admin.query('delete from negocio.preguntas_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query(`delete from negocio.uso_de_ia where org_id = $1 and agente = 'executive'`, [esc.org]);
  await esc.admin.query(`delete from negocio.incidentes where org_id = $1 and origen = 'executive'`, [esc.org]);
  await esc.admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [esc.org]);
}

before(async () => {
  esc = await montar('Cerebro211');
});
beforeEach(async () => {
  modelo?.quitar();
  modelo = null;
  await limpiar();
  await esc.admin.query('insert into identidad.organizaciones_credenciales (org_id, ia_clave_cifrada) values ($1, $2)', [esc.org, cifrar('sk-de-prueba-211')]);
});
after(async () => {
  modelo?.quitar();
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

const preguntar = (cuerpo: unknown) => preguntarAlCerebro(pedirComo('/api/executive', esc.token, { metodo: 'POST', cuerpo }));
type Mensaje = { role: string; content: unknown };
const mensajesDe = (cuerpo: Record<string, unknown>) => cuerpo.messages as Mensaje[];

test('cada ronda repite instrucciones y herramientas, y sus mensajes son los anteriores más lo agregado', async () => {
  const ronda1: BloqueFalso[] = [piensa('Primero la cadena.'), pideHerramienta('cadena_de_cierre', { periodo: '30d' })];
  const ronda2: BloqueFalso[] = [piensa('Ahora el ciclo.'), pideHerramienta('ciclo_hasta_la_cita', { periodo: '30d' })];
  modelo = instalarModeloFalso([
    respuestaDelModelo(ronda1),
    respuestaDelModelo(ronda2),
    respuestaDelModelo([pideHerramienta('responder', respuestaMinima())]),
  ]);
  assert.equal((await preguntar({ pregunta: '¿Cómo va el cierre?' })).status, 200);
  const [c1, c2, c3] = modelo.cuerpos as [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>];

  for (const c of [c2, c3]) {
    assert.deepEqual(c.system, c1.system, 'las instrucciones cambiaron entre rondas');
    assert.deepEqual(c.tools, c1.tools, 'las herramientas cambiaron entre rondas');
  }

  // Ronda 2: lo de la 1, el turno del modelo TAL CUAL (con su pensamiento y su firma) y el resultado.
  const m1 = mensajesDe(c1);
  const m2 = mensajesDe(c2);
  assert.deepEqual(m2.slice(0, m1.length), m1);
  assert.deepEqual(m2[m1.length], { role: 'assistant', content: ronda1 });
  const resultado = m2[m1.length + 1]!;
  assert.equal(resultado.role, 'user');
  assert.deepEqual(
    (resultado.content as { type: string; tool_use_id: string }[]).map((b) => [b.type, b.tool_use_id]),
    [['tool_result', ronda1[1]!.id]],
  );
  assert.equal(m2.length, m1.length + 2);

  // Ronda 3: lo de la 2 sin tocar, más lo suyo.
  const m3 = mensajesDe(c3);
  assert.deepEqual(m3.slice(0, m2.length), m2);
  assert.deepEqual(m3[m2.length], { role: 'assistant', content: ronda2 });
});

test('la pregunta siguiente del hilo arranca con lo anterior reducido, sin pensamiento', async () => {
  modelo = instalarModeloFalso([
    respuestaDelModelo([piensa('Pienso.'), pideHerramienta('responder', respuestaMinima('No hubo ventas este mes.'))]),
    respuestaDelModelo([pideHerramienta('responder', respuestaMinima('La anterior tampoco.'))]),
  ]);
  const p = await leerRespuesta<{ hiloId: string }>(await preguntar({ pregunta: '¿Cuántas ventas hicimos?' }));
  assert.equal((await preguntar({ pregunta: '¿Y la semana anterior?', hilo: p.cuerpo.hiloId })).status, 200);
  assert.deepEqual(mensajesDe(modelo.cuerpos[1]!), [
    { role: 'user', content: '¿Cuántas ventas hicimos?' },
    { role: 'assistant', content: 'No hubo ventas este mes.' },
    { role: 'user', content: '¿Y la semana anterior?' },
  ]);
});

test('un texto suelto sin `responder` recibe una ronda con el formato y las herramientas apagadas, sin dejar de ofrecerlas', async () => {
  modelo = instalarModeloFalso([
    respuestaDelModelo([escribe('Creo que va bien.')]),
    respuestaDelModelo([escribe(JSON.stringify(respuestaMinima('Va bien, con lo que se puede medir.')))]),
  ]);
  const r = await leerRespuesta<{ respuesta: { conclusion: string } }>(await preguntar({ pregunta: '¿Cómo va?' }));
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.respuesta.conclusion, 'Va bien, con lo que se puede medir.');
  const [c1, c2] = modelo.cuerpos as [Record<string, unknown>, Record<string, unknown>];
  assert.deepEqual(c2.tools, c1.tools, 'la ronda del formato dejó de ofrecer las herramientas');
  assert.deepEqual(c2.tool_choice, { type: 'none' });
  assert.ok((c2.output_config as { format?: unknown } | undefined)?.format, 'la ronda del formato no pidió el formato');
});
