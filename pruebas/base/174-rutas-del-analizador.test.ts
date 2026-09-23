// LAS RUTAS DE LOS ANALIZADORES, con el portero de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// Lo que solo se ve pasando por la ruta entera —portero, llave, validación, pipeline y respuesta—:
//
//   · una llamada de otra empresa es «no encontrada», en leer, analizar, reencaminar y borrar;
//   · sin llave de IA se rechaza ANTES de guardar nada y antes de llamar al modelo;
//   · una OB pegada en la fase HT se rechaza entera, sin dejar una fila esperando;
//   · una DONE no se reencamina, lo diga o no la pantalla;
//   · el detalle nunca trae la transcripción;
//   · ninguna respuesta devuelve una llave.
//
// La red está reemplazada (`pruebas/apoyo/analizador.ts`): ninguna prueba gasta.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { leerRespuesta, montar, pedirComo, sesionDe, type Escenario } from '../apoyo/closer.ts';
import { GET as lista } from '../../app/api/analizadores/llamadas/route.ts';
import { DELETE as borrar, GET as detalle, PATCH as reencaminar } from '../../app/api/analizadores/llamadas/[id]/route.ts';
import { POST as analizar } from '../../app/api/analizadores/llamadas/[id]/analizar/route.ts';
import { POST as ficha } from '../../app/api/analizadores/llamadas/[id]/ficha/route.ts';
import { POST as manual } from '../../app/api/analizadores/manual/route.ts';
import { POST as sincronizar } from '../../app/api/analizadores/sincronizar/route.ts';
import { GET as estado } from '../../app/api/analizadores/estado/route.ts';
import { TABLAS_DEL_ANALIZADOR, delModelo, instalarRedFalsa, quitarRedFalsa, red } from '../apoyo/analizador.ts';

let esc: Escenario;
let tokenDeBeta: string;
let credencialesPrevias: Record<string, unknown> | null = null;

const LLAVE_IA = 'sk-ant-de-prueba-174';
const LLAVE_TLDV = 'tldv-de-prueba-174';
/** La frase que no tiene que salir nunca por la API: si aparece en un detalle, se filtró el texto. */
const FRASE = 'el margen interno del trimestre';

async function limpiar(): Promise<void> {
  for (const t of TABLAS_DEL_ANALIZADOR) {
    await esc.admin.query(`delete from negocio.${t} where org_id = any($1)`, [[esc.org, esc.otraOrg]]);
  }
}

async function conLlaves(ia: string | null, tldv: string | null): Promise<void> {
  await esc.admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [esc.org]);
  await esc.admin.query(
    'insert into identidad.organizaciones_credenciales (org_id, ia_clave_cifrada, tldv_clave_cifrada) values ($1, $2, $3)',
    [esc.org, ia === null ? null : cifrar(ia), tldv === null ? null : cifrar(tldv)],
  );
}

before(async () => {
  esc = await montar('analizador-rutas');
  const b = await esc.admin.query(`select id from identidad.usuarios where email = 'bruno@beta.ejemplo'`);
  tokenDeBeta = await sesionDe(b.rows[0].id);
  const previa = await esc.admin.query('select * from identidad.organizaciones_credenciales where org_id = $1', [esc.org]);
  credencialesPrevias = previa.rows[0] ?? null;
  instalarRedFalsa();
});
beforeEach(async () => {
  await limpiar();
  red.reiniciar();
  await conLlaves(LLAVE_IA, LLAVE_TLDV);
});
after(async () => {
  await limpiar();
  await esc.admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [esc.org]);
  if (credencialesPrevias) {
    const columnas = Object.keys(credencialesPrevias);
    await esc.admin.query(
      `insert into identidad.organizaciones_credenciales (${columnas.join(', ')}) values (${columnas.map((_, i) => `$${i + 1}`).join(', ')})`,
      columnas.map((c) => credencialesPrevias![c]),
    );
  }
  quitarRedFalsa();
  await cerrarClientes();
  await cerrarTodo();
});

const params = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

async function unaManual(transcripcion = `[00:05] Closer: hola\n[00:09] Ana: ${FRASE}`) {
  red.analisis.push(() => delModelo('{"score": 7, "outcome": "NO_CERRADA"}'));
  const r = await manual(
    pedirComo('/api/analizadores/manual', esc.token, {
      metodo: 'POST',
      cuerpo: { tipo: 'HT', nombre: 'Ana', email: 'ana@prospecto.test', transcripcion },
    }),
  );
  return leerRespuesta<{ id: string; estado: string }>(r);
}

async function cuantasLlamadas(): Promise<number> {
  const r = await esc.admin.query('select count(*)::int as n from negocio.analizador_llamadas where org_id = $1', [esc.org]);
  return r.rows[0].n;
}

test('la manual se guarda, se analiza y queda DONE', async () => {
  const r = await unaManual();
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.estado, 'DONE');
  const l = await leerRespuesta<{ llamadas: { id: string }[]; cuenta: { analizadas: number } }>(
    await lista(pedirComo('/api/analizadores/llamadas?tipo=HT&filtro=analizadas', esc.token)),
  );
  assert.deepEqual(l.cuerpo.llamadas.map((x) => x.id), [r.cuerpo.id]);
  assert.equal(l.cuerpo.cuenta.analizadas, 1);
});

test('una llamada de otra empresa es «no encontrada» en las cuatro operaciones', async () => {
  const { cuerpo } = await unaManual();
  const id = cuerpo.id;
  const deBeta = (camino: string, metodo = 'GET', c?: unknown) => pedirComo(camino, tokenDeBeta, { metodo, cuerpo: c });
  assert.equal((await detalle(deBeta(`/api/analizadores/llamadas/${id}`), params(id))).status, 404);
  assert.equal((await reencaminar(deBeta(`/api/analizadores/llamadas/${id}`, 'PATCH', { tipo: 'OB' }), params(id))).status, 404);
  assert.equal((await borrar(deBeta(`/api/analizadores/llamadas/${id}`, 'DELETE'), params(id))).status, 404);
  // Beta no tiene llave de IA: para llegar a la llamada, se le da una. Tiene que decir 404 igual.
  await esc.admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [esc.otraOrg]);
  await esc.admin.query('insert into identidad.organizaciones_credenciales (org_id, ia_clave_cifrada) values ($1, $2)', [esc.otraOrg, cifrar('otra')]);
  try {
    assert.equal((await analizar(deBeta(`/api/analizadores/llamadas/${id}/analizar`, 'POST'), params(id))).status, 404);
  } finally {
    await esc.admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [esc.otraOrg]);
  }
  assert.equal(await cuantasLlamadas(), 1, 'la llamada de A tenía que seguir intacta');
});

test('sin llave de IA se rechaza ANTES de guardar y antes de llamar al modelo', async () => {
  /* La mutación que guarda primero y resuelve la llave después deja una PENDING que nadie puede
     analizar; la que llama al modelo primero gasta un rechazo por cada intento. */
  await conLlaves(null, LLAVE_TLDV);
  const r = await manual(
    pedirComo('/api/analizadores/manual', esc.token, {
      metodo: 'POST',
      cuerpo: { tipo: 'HT', nombre: 'Ana', email: 'ana@prospecto.test', transcripcion: 'Closer: hola' },
    }),
  );
  const c = await leerRespuesta<{ codigo: string }>(r);
  assert.deepEqual({ estado: c.estado, codigo: c.cuerpo.codigo }, { estado: 409, codigo: 'sin_llave_de_ia' });
  assert.equal(await cuantasLlamadas(), 0);
  assert.equal(red.llamadasAlAnalisis + red.llamadasAlClasificador, 0);
});

test('una OB pegada en la fase HT se rechaza entera, sin dejar una fila esperando', async () => {
  const r = await manual(
    pedirComo('/api/analizadores/manual', esc.token, {
      metodo: 'POST',
      cuerpo: { tipo: 'OB', nombre: 'Ana', email: 'ana@prospecto.test', transcripcion: 'Coach: bienvenida' },
    }),
  );
  const c = await leerRespuesta<{ codigo: string }>(r);
  assert.equal(c.cuerpo.codigo, 'analizador_no_disponible');
  assert.equal(await cuantasLlamadas(), 0);
});

test('la manual valida sus tres campos, y una transcripción larga se rechaza en vez de cortarse', async () => {
  const pedir = (cuerpo: unknown) => manual(pedirComo('/api/analizadores/manual', esc.token, { metodo: 'POST', cuerpo }));
  const base = { tipo: 'HT', nombre: 'Ana', email: 'ana@prospecto.test', transcripcion: 'Closer: hola' };
  for (const malo of [
    { ...base, nombre: '' },
    { ...base, nombre: 'x'.repeat(121) },
    { ...base, email: 'no-es-un-correo' },
    { ...base, transcripcion: '   ' },
    // El final de una llamada de venta es donde está el cierre: cortarla produce un informe de una
    // llamada que no terminó.
    { ...base, transcripcion: 'x'.repeat(200_001) },
  ]) {
    const c = await leerRespuesta<{ codigo: string }>(await pedir(malo));
    assert.equal(c.cuerpo.codigo, 'peticion_invalida', JSON.stringify(malo).slice(0, 80));
  }
  assert.equal(await cuantasLlamadas(), 0);
});

test('una DONE no se reencamina, aunque la petición se arme a mano', async () => {
  const { cuerpo } = await unaManual();
  const r = await reencaminar(
    pedirComo(`/api/analizadores/llamadas/${cuerpo.id}`, esc.token, { metodo: 'PATCH', cuerpo: { tipo: 'OB' } }),
    params(cuerpo.id),
  );
  const c = await leerRespuesta<{ codigo: string }>(r);
  assert.deepEqual({ estado: c.estado, codigo: c.cuerpo.codigo }, { estado: 409, codigo: 'llamada_ya_analizada' });
});

test('el detalle NO trae la transcripción', async () => {
  const { cuerpo } = await unaManual();
  const r = await detalle(pedirComo(`/api/analizadores/llamadas/${cuerpo.id}`, esc.token), params(cuerpo.id));
  assert.equal(r.status, 200);
  assert.ok(!(await r.text()).includes(FRASE), 'el detalle devolvió el texto de la transcripción');
});

test('la ficha se pide aparte, y sobre una HT analizada', async () => {
  const { cuerpo } = await unaManual();
  red.analisis.push(() => delModelo('{"summary": "vende pan"}'));
  const r = await leerRespuesta<{ estado: string }>(
    await ficha(pedirComo(`/api/analizadores/llamadas/${cuerpo.id}/ficha`, esc.token, { metodo: 'POST' }), params(cuerpo.id)),
  );
  assert.deepEqual({ estado: r.estado, ficha: r.cuerpo.estado }, { estado: 200, ficha: 'OK' });
});

test('sincronizar sin llave de tl;dv lo dice, y sin gastar', async () => {
  await conLlaves(LLAVE_IA, null);
  const c = await leerRespuesta<{ codigo: string }>(await sincronizar(pedirComo('/api/analizadores/sincronizar', esc.token, { metodo: 'POST' })));
  assert.equal(c.cuerpo.codigo, 'sin_llave_de_tldv');
  assert.equal(red.llamadasAlClasificador, 0);
});

test('sincronizar con la llave de tl;dv rechazada lo dice con su código', async () => {
  red.estadoDeTldv = 401;
  const c = await leerRespuesta<{ codigo: string }>(await sincronizar(pedirComo('/api/analizadores/sincronizar', esc.token, { metodo: 'POST' })));
  assert.equal(c.cuerpo.codigo, 'llave_de_tldv_rechazada');
});

test('el estado dice qué llaves hay, y ninguna respuesta devuelve una llave', async () => {
  const r = await estado(pedirComo('/api/analizadores/estado', esc.token));
  const texto = await r.clone().text();
  assert.ok(!texto.includes(LLAVE_IA) && !texto.includes(LLAVE_TLDV), 'el estado devolvió una llave');
  const c = (await r.json()) as { llaveDeIa: { cargada: boolean }; llaveDeTldv: { cargada: boolean }; tiposQueSeAnalizan: string[] };
  assert.deepEqual(
    { ia: c.llaveDeIa.cargada, tldv: c.llaveDeTldv.cargada, tipos: c.tiposQueSeAnalizan },
    { ia: true, tldv: true, tipos: ['HT'] },
  );
});

test('la lista rechaza una pestaña o un filtro que no existen, en vez de corregirlos', async () => {
  for (const q of ['tipo=OTRO', 'tipo=HT&filtro=todas', '']) {
    const c = await leerRespuesta<{ codigo: string }>(await lista(pedirComo(`/api/analizadores/llamadas?${q}`, esc.token)));
    assert.equal(c.cuerpo.codigo, 'peticion_invalida', q);
  }
});
