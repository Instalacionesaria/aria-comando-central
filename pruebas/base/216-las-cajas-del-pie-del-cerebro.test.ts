// LAS CAJAS DEL PIE DEL CEREBRO: UNA RUTA FINA POR SECCIÓN, POR EL MANEJADOR DE VERDAD. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `app/api/<carpeta>/cerebro/route.ts` (AG6; `docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-40 y AG-41), con la
// regla 31 de `docs/OTROS/estado actual/07-REGLAS-TRANSVERSALES.md`: una ruta nueva nace con su prueba de base.
//
//   · Cada sección con herramientas tiene su ruta; cada ruta declara la `PANTALLA` de su sección, pide en el
//     GET la capacidad de esa sección y en el POST y el DELETE `cerebro.usar`.
//   · El portero aplica el alcance: a quien no tiene la pestaña, `seccion_no_concedida`, también al preguntar.
//   · Preguntar desde el pie: el hilo queda con `origen: 'pie'` y su sección, el GET de esa caja lo lista y el
//     de otra no; el Inicio los lista todos.
//   · Lo que se le ofrece al modelo es lo de las pestañas que la persona ve, no lo de la sección de la caja
//     sola ni el catálogo entero; el estado de las integraciones, sólo a quien tiene `credenciales.ver`.
//   · Por qué el auditor no audita llega a su herramienta igual que a su pantalla.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { leerRespuesta, montar, pedirComo, sesionDe, type Escenario } from '../apoyo/closer.ts';
import { instalarModeloFalso, pideHerramienta, respuestaDelModelo, respuestaMinima, type ModeloFalso } from '../apoyo/cerebro.ts';
import { SECCIONES } from '../../lib/autorizacion/secciones.ts';
import { HERRAMIENTAS, herramientasPara } from '../../lib/agentes/executive/herramientas.ts';
import * as deSales from '../../app/api/sales/cerebro/route.ts';
import * as delCloser from '../../app/api/closer/cerebro/route.ts';
import * as deSetter from '../../app/api/setter/cerebro/route.ts';
import * as deConversation from '../../app/api/auditoria/cerebro/route.ts';
import * as delInicio from '../../app/api/executive/route.ts';
import { GET as auditoria } from '../../app/api/auditoria/route.ts';

/** La carpeta de la API de cada sección con caja al pie (AG-40). */
const CARPETAS: Record<string, string> = {
  acquisition: 'acquisition',
  creative: 'creative',
  conversion: 'conversion',
  conversation: 'auditoria',
  sales: 'sales',
  contacts: 'leads-portal',
  setter: 'setter',
  closer: 'closer',
  analizadores: 'analizadores',
  tools: 'tools',
  icp: 'fundaciones',
};

const NOMBRE_DE_PERSONA = 'Persona de la 216';
let esc: Escenario;
let modelo: ModeloFalso | null = null;

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.conversaciones_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.topes_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.preguntas_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query(`delete from negocio.uso_de_ia where org_id = $1 and agente = 'executive'`, [esc.org]);
  await esc.admin.query(`delete from negocio.incidentes where org_id = $1 and origen = 'executive'`, [esc.org]);
  await esc.admin.query('delete from identidad.usuarios where nombre = $1', [NOMBRE_DE_PERSONA]);
  await esc.admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [esc.org]);
}

async function conLlave(): Promise<void> {
  await esc.admin.query('insert into identidad.organizaciones_credenciales (org_id, ia_clave_cifrada) values ($1, $2)', [esc.org, cifrar('sk-de-prueba-216')]);
}

/** Una persona restringida de `alfa`, con el rol `usuario` y esas secciones concedidas. */
async function restringida(secciones: readonly string[]): Promise<string> {
  const r = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash)
       values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [esc.org, NOMBRE_DE_PERSONA, `cerebro-216-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
  );
  const id = r.rows[0]!.id;
  await esc.admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'usuario' and org_id is null`,
    [id],
  );
  for (const s of secciones) await esc.admin.query('insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, $2)', [id, s]);
  return sesionDe(id);
}

type Ruta = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response>; DELETE: (r: Request) => Promise<Response> };
const preguntarEn = (ruta: Ruta, camino: string, cuerpo: unknown, token = esc.token) => ruta.POST(pedirComo(camino, token, { metodo: 'POST', cuerpo }));
/** Los nombres de las herramientas que recibió el modelo en su primera llamada, sin `responder`. */
const ofrecidas = (m: ModeloFalso) =>
  ((m.cuerpos[0]!.tools as { name: string }[]) ?? [])
    .map((t) => t.name)
    .filter((n) => n !== 'responder')
    .sort();
const unaRespuesta = (conclusion: string) => [respuestaDelModelo([pideHerramienta('responder', respuestaMinima(conclusion))])];

before(async () => {
  esc = await montar('Cerebro216');
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

test('cada sección con herramientas tiene su caja, con su `PANTALLA` y sus capacidades', () => {
  const conHerramientas = new Set(HERRAMIENTAS.flatMap((h) => h.secciones));
  assert.deepEqual([...conHerramientas].filter((s) => !(s in CARPETAS)), [], 'una sección con herramientas no tiene caja al pie');
  for (const [seccion, carpeta] of Object.entries(CARPETAS)) {
    const archivo = join(RAIZ, `app/api/${carpeta}/cerebro/route.ts`);
    assert.ok(existsSync(archivo), `falta app/api/${carpeta}/cerebro/route.ts`);
    const fuente = sinComentarios(readFileSync(archivo, 'utf8'));
    assert.match(fuente, new RegExp(`export const PANTALLA = '${seccion}';`));
    const pide = (metodo: string) => new RegExp(`function ${metodo}\\(peticion: Request\\)[^]*?exigir\\(peticion, \\[([^\\]]*)\\], PANTALLA\\)`).exec(fuente)?.[1];
    const deLaSeccion = SECCIONES.find((s) => s.clave === seccion)!.capacidadRequerida;
    assert.deepEqual([pide('GET'), pide('POST'), pide('DELETE')], [`'${deLaSeccion}'`, "'cerebro.usar'", "'cerebro.usar'"], carpeta);
    // La caja es de esa sección: lo que pregunta lleva su `PANTALLA`, y lo que lista, también.
    assert.match(fuente, /laPregunta\(contexto, identidad, leida, PANTALLA\)/);
    assert.match(fuente, /loDelPanel\(contexto, PANTALLA, hilo\)/);
  }
});

test('sin la pestaña de la caja: `seccion_no_concedida`, al mirar y al preguntar; con ella, entra', async () => {
  await conLlave();
  modelo = instalarModeloFalso([]);
  const token = await restringida(['closer']);
  for (const r of [await deSales.GET(pedirComo('/api/sales/cerebro', token)), await preguntarEn(deSales, '/api/sales/cerebro', { pregunta: '¿Cómo va?' }, token)]) {
    assert.equal(r.status, 403);
    assert.equal(((await r.json()) as { codigo: string }).codigo, 'seccion_no_concedida');
  }
  assert.equal(modelo.cuerpos.length, 0);
  assert.equal((await delCloser.GET(pedirComo('/api/closer/cerebro', token))).status, 200);
});

test('desde el pie: el hilo es de la sección, lo lista su caja y no la de otra, y el Inicio los lista todos', async () => {
  await conLlave();
  modelo = instalarModeloFalso([...unaRespuesta('Desde Sales.'), ...unaRespuesta('Desde el Closer.')]);
  const enSales = await leerRespuesta<{ hiloId: string }>(await preguntarEn(deSales, '/api/sales/cerebro', { pregunta: '¿Cómo va el cierre?', periodo: '7d' }));
  assert.equal(enSales.estado, 200);
  const enCloser = await leerRespuesta<{ hiloId: string }>(await preguntarEn(delCloser, '/api/closer/cerebro', { pregunta: '¿Qué tengo hoy?' }));
  assert.equal(enCloser.estado, 200);

  const guardados = await esc.admin.query<{ id: string; origen: string; seccion: string | null; contexto: unknown }>(
    'select id, origen, seccion, contexto from negocio.conversaciones_del_executive where org_id = $1 order by creada_el',
    [esc.org],
  );
  assert.deepEqual(
    guardados.rows.map((h) => [h.id, h.origen, h.seccion]),
    [
      [enSales.cuerpo.hiloId, 'pie', 'sales'],
      [enCloser.cuerpo.hiloId, 'pie', 'closer'],
    ],
  );
  // La caja de Sales le dijo al modelo desde dónde y con qué período se pregunta.
  assert.match(JSON.stringify(modelo.cuerpos[0]), /caja del pie de «sales»/);

  const hilos = async (ruta: Ruta, camino: string) =>
    (await leerRespuesta<{ hilos: { id: string }[] }>(await ruta.GET(pedirComo(camino, esc.token)))).cuerpo.hilos.map((h) => h.id);
  assert.deepEqual(await hilos(deSales, '/api/sales/cerebro'), [enSales.cuerpo.hiloId]);
  assert.deepEqual(await hilos(delCloser, '/api/closer/cerebro'), [enCloser.cuerpo.hiloId]);
  assert.deepEqual((await hilos(delInicio, '/api/executive')).sort(), [enSales.cuerpo.hiloId, enCloser.cuerpo.hiloId].sort());

  // Se borra desde su caja, y un hilo inexistente da 404.
  assert.equal((await deSales.DELETE(pedirComo(`/api/sales/cerebro?hilo=${enSales.cuerpo.hiloId}`, esc.token, { metodo: 'DELETE' }))).status, 200);
  assert.equal((await deSales.DELETE(pedirComo(`/api/sales/cerebro?hilo=${enSales.cuerpo.hiloId}`, esc.token, { metodo: 'DELETE' }))).status, 404);
});

test('al modelo se le ofrece lo de las pestañas que se ven, y las integraciones sólo con `credenciales.ver`', async () => {
  await conLlave();
  // Una persona restringida a Closer y Sales, preguntando desde Sales: recibe las de las dos, no el catálogo.
  const token = await restringida(['closer', 'sales']);
  modelo = instalarModeloFalso(unaRespuesta('Con lo que ves.'));
  assert.equal((await preguntarEn(deSales, '/api/sales/cerebro', { pregunta: '¿Cómo vamos?' }, token)).status, 200);
  assert.deepEqual(ofrecidas(modelo), herramientasPara(['closer', 'sales']).map((h) => h.nombre).sort());
  assert.ok(!ofrecidas(modelo).includes('estado_de_integraciones'));
  // Las de la caja abierta van primero.
  assert.equal((modelo.cuerpos[0]!.tools as { name: string }[])[0]!.name, 'dinero_del_mes');
  modelo.quitar();

  // Quien administra tiene `credenciales.ver`: a él sí se le ofrece.
  modelo = instalarModeloFalso(unaRespuesta('Con todo.'));
  assert.equal((await preguntarEn(delCloser, '/api/closer/cerebro', { pregunta: '¿Está todo conectado?' })).status, 200);
  assert.ok(ofrecidas(modelo).includes('estado_de_integraciones'));
  assert.ok(ofrecidas(modelo).includes('embudos_de_acquisition'), 'quien administra ve Acquisition: también desde la caja del Closer');
});

test('el estado de las integraciones y por qué el auditor no audita llegan como dato, iguales a su pantalla', async () => {
  await conLlave();
  modelo = instalarModeloFalso([
    respuestaDelModelo([pideHerramienta('auditoria_de_agentes', {}), pideHerramienta('estado_de_integraciones', {})]),
    respuestaDelModelo([pideHerramienta('responder', respuestaMinima('El auditor no audita.'))]),
  ]);
  const r = await leerRespuesta<{ evidencia: { herramienta: string; datos: Record<string, any> }[] }>(
    await preguntarEn(deConversation, '/api/auditoria/cerebro', { pregunta: '¿Por qué no hay auditoría?' }),
  );
  assert.equal(r.estado, 200);
  const de = (nombre: string) => r.cuerpo.evidencia.find((e) => e.herramienta === nombre)!.datos;
  const p = await leerRespuesta<{ noAudita: string | null }>(await auditoria(pedirComo('/api/auditoria?periodo=30d', esc.token)));
  assert.equal(de('auditoria_de_agentes').noAudita, p.cuerpo.noAudita);
  assert.notEqual(p.cuerpo.noAudita, null, 'la empresa de la prueba no tiene el auditor listo: la comparación tiene que mirar un motivo');
  assert.deepEqual(de('estado_de_integraciones').integraciones.ia, { cargado: true, estado: 'activa' });
  assert.deepEqual(Object.keys(de('estado_de_integraciones').integraciones).sort(), ['crm', 'ia', 'meta', 'pagos', 'tldv']);
  assert.doesNotMatch(JSON.stringify(de('estado_de_integraciones')), /sk-de-prueba/);
});

test('una caja sólo lee, continúa y borra los hilos de su sección; el Inicio, todos', async () => {
  await conLlave();
  modelo = instalarModeloFalso(unaRespuesta('Desde Sales.'));
  const enSales = await leerRespuesta<{ hiloId: string }>(await preguntarEn(deSales, '/api/sales/cerebro', { pregunta: '¿Cómo va el cierre?' }));
  assert.equal(enSales.estado, 200);
  const hilo = enSales.cuerpo.hiloId;
  modelo.quitar();
  modelo = instalarModeloFalso([]);

  assert.equal((await delCloser.GET(pedirComo(`/api/closer/cerebro?hilo=${hilo}`, esc.token))).status, 404);
  assert.equal((await preguntarEn(delCloser, '/api/closer/cerebro', { pregunta: 'Sigo desde el Closer', hilo })).status, 404);
  assert.equal((await delCloser.DELETE(pedirComo(`/api/closer/cerebro?hilo=${hilo}`, esc.token, { metodo: 'DELETE' }))).status, 404);
  assert.equal(modelo.cuerpos.length, 0, 'se llamó al modelo para continuar un hilo de otra sección');

  assert.equal((await deSales.GET(pedirComo(`/api/sales/cerebro?hilo=${hilo}`, esc.token))).status, 200);
  assert.equal((await delInicio.GET(pedirComo(`/api/executive?hilo=${hilo}`, esc.token))).status, 200);
});

test('con `cerebro.usar` y sin la capacidad de la sección, su caja no pregunta', async () => {
  /* Un rol propio de la empresa con `tablero.ver` y `cerebro.usar`, sin `setter.ver`: no es restringido, así
     que el portero no mira el alcance, y el POST sólo pide `cerebro.usar`. La caja del Setter lo rechaza igual. */
  await conLlave();
  modelo = instalarModeloFalso([]);
  const rol = (
    await esc.admin.query<{ id: string }>(`insert into identidad.roles (clave, nombre, org_id) values ('mirador_216', 'Mirador 216', $1) returning id`, [esc.org])
  ).rows[0]!.id;
  try {
    for (const permiso of ['tablero.ver', 'cerebro.usar']) {
      await esc.admin.query('insert into identidad.roles_permisos (rol_id, permiso) values ($1, $2)', [rol, permiso]);
    }
    const r = await esc.admin.query<{ id: string }>(
      `insert into identidad.usuarios (org_id, nombre, email, password_hash)
         values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
      [esc.org, NOMBRE_DE_PERSONA, `cerebro-216-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
    );
    await esc.admin.query('insert into identidad.usuarios_roles (usuario_id, rol_id) values ($1, $2)', [r.rows[0]!.id, rol]);
    const token = await sesionDe(r.rows[0]!.id);
    const p = await leerRespuesta<{ codigo: string }>(await preguntarEn(deSetter, '/api/setter/cerebro', { pregunta: '¿Cómo va mi día?' }, token));
    assert.deepEqual([p.estado, p.cuerpo.codigo], [403, 'seccion_no_concedida']);
    assert.equal(modelo.cuerpos.length, 0);
    const hilos = await esc.admin.query('select 1 from negocio.conversaciones_del_executive where org_id = $1', [esc.org]);
    assert.equal(hilos.rowCount, 0, 'quedó un hilo del Setter que su caja nunca mostraría');
  } finally {
    await esc.admin.query('delete from identidad.usuarios where nombre = $1', [NOMBRE_DE_PERSONA]);
    await esc.admin.query('delete from identidad.roles_permisos where rol_id = $1', [rol]);
    await esc.admin.query('delete from identidad.roles where id = $1', [rol]);
  }
});
