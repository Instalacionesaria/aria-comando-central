// LA RUTA DEL CEREBRO EN EL INICIO, POR EL MANEJADOR DE VERDAD. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `app/api/executive/route.ts` (AG5 de los agentes), con la regla 31 de
// `docs/OTROS/estado actual/07-REGLAS-TRANSVERSALES.md`: la ruta que baja la bandera `sinOperacionesTodavia`
// nace con su prueba de base.
//
//   · Quién entra: el GET con `tablero.ver`, el POST y el DELETE con `cerebro.usar`; una persona restringida
//     sin la pestaña recibe `seccion_no_concedida`, también al preguntar.
//   · Que preguntar funcione de punta a punta con el modelo falso: herramienta, respuesta, hilo, lista,
//     lectura del hilo y borrado.
//   · Que sin llave no se llame al modelo.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { leerRespuesta, montar, pedirComo, sesionDe, type Escenario } from '../apoyo/closer.ts';
import { instalarModeloFalso, pideHerramienta, respuestaDelModelo, respuestaMinima, type ModeloFalso } from '../apoyo/cerebro.ts';
import { DELETE as borrar, GET as mirar, PANTALLA, POST as preguntarAlCerebro } from '../../app/api/executive/route.ts';
import { SECCIONES } from '../../lib/autorizacion/secciones.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';

const NOMBRE_DE_PERSONA = 'Persona de la 206';
let esc: Escenario;
let modelo: ModeloFalso | null = null;

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.conversaciones_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.topes_del_executive where org_id = $1', [esc.org]);
  // El registro del tope no cae con los hilos (a propósito): se limpia aparte.
  await esc.admin.query('delete from negocio.preguntas_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query(`delete from negocio.uso_de_ia where org_id = $1 and agente = 'executive'`, [esc.org]);
  await esc.admin.query(`delete from negocio.incidentes where org_id = $1 and origen = 'executive'`, [esc.org]);
  await esc.admin.query('delete from identidad.usuarios where nombre = $1', [NOMBRE_DE_PERSONA]);
  await esc.admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [esc.org]);
}

async function conLlave(): Promise<void> {
  await esc.admin.query('insert into identidad.organizaciones_credenciales (org_id, ia_clave_cifrada) values ($1, $2)', [esc.org, cifrar('sk-de-prueba-206')]);
}

/** Una persona de `alfa` con un rol del catálogo y, si se pide, secciones concedidas. */
async function unaPersona(rol: string | null, secciones: readonly string[] = []): Promise<string> {
  const r = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash)
       values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [esc.org, NOMBRE_DE_PERSONA, `cerebro-206-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
  );
  const id = r.rows[0]!.id;
  if (rol) {
    await esc.admin.query(
      `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = $2 and org_id is null`,
      [id, rol],
    );
  }
  for (const s of secciones) await esc.admin.query('insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, $2)', [id, s]);
  return sesionDe(id);
}

const preguntar = (cuerpo: unknown, token = esc.token) => preguntarAlCerebro(pedirComo('/api/executive', token, { metodo: 'POST', cuerpo }));

before(async () => {
  esc = await montar('Cerebro206');
});
beforeEach(async () => {
  modelo?.quitar();
  modelo = null;
  await limpiar();
});
after(async () => {
  modelo?.quitar();
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

test('la sección `executive` bajó la bandera, y la ruta la declara', () => {
  const seccion = SECCIONES.find((s) => s.clave === PANTALLA);
  assert.ok(seccion);
  assert.equal(seccion.sinOperacionesTodavia, undefined, 'la bandera sigue puesta y la ruta existe');
  assert.equal(seccion.capacidadRequerida, 'tablero.ver');
});

test('el GET pide `tablero.ver`; el POST y el DELETE, `cerebro.usar`', () => {
  /* Por el código y no por una persona: los tres roles tienen las dos capacidades, así que nadie puede
     tener una sin la otra y una prueba por comportamiento no distinguiría cuál pide cada método. */
  const fuente = sinComentarios(readFileSync(join(RAIZ, 'app/api/executive/route.ts'), 'utf8'));
  const pide = (metodo: string) => new RegExp(`function ${metodo}\\(peticion: Request\\)[^]*?exigir\\(peticion, \\[([^\\]]*)\\], PANTALLA\\)`).exec(fuente)?.[1];
  assert.deepEqual([pide('GET'), pide('POST'), pide('DELETE')], ["'tablero.ver'", "'cerebro.usar'", "'cerebro.usar'"]);
});

test('el GET pide `tablero.ver`: sin él, 403', async () => {
  const sin = await unaPersona(null);
  assert.equal((await mirar(pedirComo('/api/executive', sin))).status, 403);
});

test('restringida y sin la pestaña del Inicio: `seccion_no_concedida`, al mirar y al preguntar', async () => {
  const token = await unaPersona('usuario', ['closer']);
  for (const r of [await mirar(pedirComo('/api/executive', token)), await preguntar({ pregunta: '¿Cómo va?' }, token)]) {
    assert.equal(r.status, 403);
    assert.equal(((await r.json()) as { codigo: string }).codigo, 'seccion_no_concedida');
  }
  // Con la pestaña concedida, entra.
  const conInicio = await unaPersona('usuario', ['executive']);
  assert.equal((await mirar(pedirComo('/api/executive', conInicio))).status, 200);
});

test('sin llave, el estado lo dice y preguntar no llama al modelo', async () => {
  modelo = instalarModeloFalso([]);
  const g = await leerRespuesta<{ estado: { tipo: string; puedeCargarla: boolean } }>(await mirar(pedirComo('/api/executive', esc.token)));
  assert.deepEqual(g.cuerpo.estado, { tipo: 'sin_llave', puedeCargarla: true });
  const p = await leerRespuesta<{ codigo: string }>(await preguntar({ pregunta: '¿Cómo va la semana?' }));
  assert.deepEqual([p.estado, p.cuerpo.codigo], [409, 'sin_llave_de_ia']);
  assert.equal(modelo.cuerpos.length, 0, 'se llamó al modelo sin llave');
});

test('preguntar de punta a punta: lee una herramienta, contesta, y el hilo queda, se lee y se borra', async () => {
  await conLlave();
  modelo = instalarModeloFalso([
    respuestaDelModelo([pideHerramienta('cadena_de_cierre', { periodo: '30d' })]),
    respuestaDelModelo([pideHerramienta('responder', respuestaMinima('Esta semana no hubo ventas registradas.'))]),
  ]);
  const p = await leerRespuesta<{ tipo: string; hiloId: string; respuesta: { conclusion: string }; evidencia: { id: string; herramienta: string }[] }>(
    await preguntar({ pregunta: '¿Cuántas ventas hicimos?', periodo: '30d' }),
  );
  assert.equal(p.estado, 200);
  assert.equal(p.cuerpo.tipo, 'respondida');
  assert.equal(p.cuerpo.respuesta.conclusion, 'Esta semana no hubo ventas registradas.');
  assert.deepEqual(p.cuerpo.evidencia.map((e) => [e.id, e.herramienta]), [['ev-1', 'cadena_de_cierre']]);
  assert.equal(modelo.quedan(), 0);

  const g = await leerRespuesta<{ estado: { tipo: string }; hilos: { id: string; titulo: string }[]; usado: { usadasPorPersona: number } }>(
    await mirar(pedirComo('/api/executive', esc.token)),
  );
  assert.equal(g.cuerpo.estado.tipo, 'listo');
  assert.deepEqual(g.cuerpo.hilos.map((h) => [h.id, h.titulo]), [[p.cuerpo.hiloId, '¿Cuántas ventas hicimos?']]);
  assert.equal(g.cuerpo.usado.usadasPorPersona, 1);

  const h = await leerRespuesta<{ mensajes: { rol: string; estado: string | null }[] }>(
    await mirar(pedirComo(`/api/executive?hilo=${p.cuerpo.hiloId}`, esc.token)),
  );
  assert.deepEqual(h.cuerpo.mensajes.map((m) => [m.rol, m.estado]), [['persona', 'respondida'], ['cerebro', null]]);

  const d = await borrar(pedirComo(`/api/executive?hilo=${p.cuerpo.hiloId}`, esc.token, { metodo: 'DELETE' }));
  assert.equal(d.status, 200);
  assert.equal((await borrar(pedirComo(`/api/executive?hilo=${p.cuerpo.hiloId}`, esc.token, { metodo: 'DELETE' }))).status, 404);
});

test('un período que no existe se rechaza antes de llamar al modelo', async () => {
  await conLlave();
  modelo = instalarModeloFalso([]);
  const p = await leerRespuesta<{ codigo: string }>(await preguntar({ pregunta: '¿Cómo va?', periodo: 'mes' }));
  assert.deepEqual([p.estado, p.cuerpo.codigo], [400, 'peticion_invalida']);
  assert.equal(modelo.cuerpos.length, 0);
});

test('quien sólo ve el Inicio no tiene qué leer: el estado lo dice y preguntar no llama al modelo', async () => {
  await conLlave();
  modelo = instalarModeloFalso([]);
  const token = await unaPersona('usuario', ['executive']);
  const g = await leerRespuesta<{ estado: { tipo: string } }>(await mirar(pedirComo('/api/executive', token)));
  assert.equal(g.cuerpo.estado.tipo, 'sin_datos');
  const p = await leerRespuesta<{ codigo: string }>(await preguntar({ pregunta: '¿Cómo va la semana?' }, token));
  assert.deepEqual([p.estado, p.cuerpo.codigo], [409, 'cerebro_sin_datos']);
  assert.equal(modelo.cuerpos.length, 0, 'se llamó al modelo sin nada que leer');
});
