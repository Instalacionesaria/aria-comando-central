// LA CAPA DE DATOS DE LOS ANALIZADORES. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// Las seis tablas de la `056` y `lib/analizadores/datos.ts`. Sus defectos no se ven en ninguna
// pantalla: se ven en la factura o en el informe de otra empresa.
//
//   · **Aislamiento.** Lo escrito por una empresa no lo lee otra, en ninguna de las seis tablas.
//   · **Un solo pago por reunión.** El candado, el único del descubrimiento y la lápida existen para
//     que una reunión no se clasifique ni se analice dos veces.
//   · **Nada a medias.** Un análisis y su DONE, un borrado y su lápida, una llamada y su
//     transcripción: van juntos o no va ninguno.
//   · **La forma.** Los CHECK de estado y la clave foránea con `set null (prospecto_id)`.
//
// Todo contra la base local, con las dos empresas del sembrado.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import {
  borrarLlamada,
  contarPorFiltro,
  crearLlamadaConTranscripcion,
  guardarFicha,
  leerDetalle,
  listarLlamadas,
  llamadasSinFicha,
  pendientesParaAnalizar,
  prospectoDeLaLlamada,
  reencaminar,
  reunionesConocidas,
  devolverAlEstado,
  leerParaAnalizar,
  terminarConAnalisis,
  terminarConVeto,
  tomarParaAnalizar,
  type LlamadaNueva,
} from '../../lib/analizadores/datos.ts';
import { parseTranscriptInput } from '../../lib/analizadores/nucleo/transcript.ts';

let esc: Escenario;

const TABLAS = [
  'analizador_lapidas',
  'analizador_fichas',
  'analizador_analisis',
  'analizador_transcripciones',
  'analizador_llamadas',
  'analizador_prospectos',
] as const;

async function limpiar(): Promise<void> {
  for (const t of TABLAS) {
    await esc.admin.query(`delete from negocio.${t} where org_id = any($1)`, [[esc.org, esc.otraOrg]]);
  }
}

before(async () => {
  esc = await montar('analizador-datos');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarClientes();
  await cerrarTodo();
});

/** La frase que tiene que NO salir nunca por la API: si aparece en un detalle, se filtró el texto. */
const FRASE_INTERNA = 'el presupuesto interno del trimestre es confidencial';
const TRANSCRIPCION = parseTranscriptInput(`[00:05] Closer: hola\n[00:09] Prospecto: ${FRASE_INTERNA}`);

function llamada(extra: Partial<LlamadaNueva> = {}): LlamadaNueva {
  return {
    tipo: 'HT',
    proveedor: 'TLDV',
    estado: 'PENDING',
    reunionExternaId: `mtg-${randomUUID()}`,
    titulo: 'Discovery',
    prospectoId: null,
    prospectoNombre: 'Rubén',
    prospectoEmail: 'ruben@ejemplo-panaderia.test',
    motivo: null,
    fechaDeLaReunion: '2026-09-18T15:02:00.000Z',
    duracionSeg: 2734,
    organizadorNombre: 'Valeria',
    organizadorEmail: 'valeria@ejemplo-agencia.test',
    urlDeLaGrabacion: 'https://tldv.io/app/meetings/x',
    invitados: [{ name: 'Rubén', email: 'ruben@ejemplo-panaderia.test' }],
    metaDelProveedor: { platform: 'google-meet' },
    ...extra,
  };
}

async function unaLlamada(org: string, extra: Partial<LlamadaNueva> = {}): Promise<string> {
  const id = await crearLlamadaConTranscripcion(org, llamada(extra), TRANSCRIPCION, true);
  assert.ok(id, 'no se creó la llamada');
  return id;
}

const USO = { input: 1000, output: 200, cacheWrite: 50, cacheRead: 3000 };
const MODELO = { tipo: 'HT' as const, modelo: 'claude-sonnet-5', uso: USO, costoUsd: null, versionDeRubrica: 'rubric.es.md@v8.1' };

async function unaAnalizada(org: string, extra: Partial<LlamadaNueva> = {}): Promise<string> {
  const id = await unaLlamada(org, extra);
  assert.ok(await tomarParaAnalizar(org, id, 'PENDING', 'HT'));
  await terminarConAnalisis(org, id, { ...MODELO, analisis: { score: 7 }, columnas: { score: 7, outcome: 'NO_CERRADA', scoreColor: 'VERDE' } });
  return id;
}

async function estadoDe(id: string): Promise<string | undefined> {
  const r = await esc.admin.query<{ estado: string }>('select estado from negocio.analizador_llamadas where id = $1', [id]);
  return r.rows[0]?.estado;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · AISLAMIENTO
// ═══════════════════════════════════════════════════════════════════════════════

test('lo que escribe una empresa no lo ve la otra, en NINGUNA de las seis tablas', async () => {
  /* Las seis, porque cada una tiene su propia política: la mutación que olvida `aplicar_aislamiento`
     en una sola —la de las fichas, por ejemplo— deja las otras cinco protegidas y esta en abierto. */
  const prospecto = await prospectoDeLaLlamada(esc.org, 'Rubén', 'ruben@aislamiento.test');
  const id = await unaAnalizada(esc.org, { prospectoId: prospecto });
  await guardarFicha(esc.org, id, { estado: 'FAILED', error: 'x' });
  const otra = await unaLlamada(esc.org);
  assert.ok(await borrarLlamada(esc.org, otra));

  const cuenta = (org: string) =>
    conOrganizacion(org, async () => {
      const r: Record<string, number> = {};
      for (const t of TABLAS) {
        const f = await datos().selectFrom(t).select((eb) => eb.fn.countAll<number>().as('n')).executeTakeFirstOrThrow();
        r[t] = Number(f.n);
      }
      return r;
    });

  const deA = await cuenta(esc.org);
  for (const t of TABLAS) assert.ok(deA[t]! >= 1, `la empresa A no ve sus propias filas de ${t}`);
  assert.deepEqual(await cuenta(esc.otraOrg), Object.fromEntries(TABLAS.map((t) => [t, 0])));

  // Y el detalle pedido desde la otra empresa es «no existe», no un 403 ni sus datos.
  assert.equal(await leerDetalle(esc.otraOrg, id), null);
  assert.equal(await tomarParaAnalizar(esc.otraOrg, id, 'PENDING', 'HT'), false);
  assert.equal(await borrarLlamada(esc.otraOrg, id), false);
  assert.ok(await leerDetalle(esc.org, id), 'la llamada tenía que seguir existiendo para A');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · UN SOLO PAGO POR REUNIÓN
// ═══════════════════════════════════════════════════════════════════════════════

test('la misma reunión externa dos veces deja UNA llamada', async () => {
  /* La carrera entre el cron y el botón de Sincronizar: los dos ven la reunión nueva a la vez. El
     único la frena, la segunda devuelve null, y el que pierde no paga el análisis. */
  const externa = `mtg-${randomUUID()}`;
  const primera = await crearLlamadaConTranscripcion(esc.org, llamada({ reunionExternaId: externa }), TRANSCRIPCION, true);
  const segunda = await crearLlamadaConTranscripcion(esc.org, llamada({ reunionExternaId: externa }), TRANSCRIPCION, true);
  assert.ok(primera);
  assert.equal(segunda, null);
  const r = await esc.admin.query('select 1 from negocio.analizador_llamadas where reunion_externa_id = $1', [externa]);
  assert.equal(r.rowCount, 1);
});

test('dos manuales sin identificador externo conviven', async () => {
  // Los nulos no chocan en el único: si chocaran, la segunda transcripción pegada a mano se perdería.
  const a = await crearLlamadaConTranscripcion(esc.org, llamada({ proveedor: 'MANUAL', reunionExternaId: null }), TRANSCRIPCION, false);
  const b = await crearLlamadaConTranscripcion(esc.org, llamada({ proveedor: 'MANUAL', reunionExternaId: null }), TRANSCRIPCION, false);
  assert.ok(a && b && a !== b);
});

test('lo borrado deja lápida, y el descarte la ve: no vuelve a entrar', async () => {
  const externa = `mtg-${randomUUID()}`;
  const id = await unaLlamada(esc.org, { reunionExternaId: externa });
  assert.ok(await borrarLlamada(esc.org, id));
  assert.equal(await estadoDe(id), undefined, 'la llamada tenía que irse');
  assert.deepEqual([...(await reunionesConocidas(esc.org, 'TLDV', [externa, 'mtg-nueva']))], [externa]);
  /* Y la transcripción se fue con ella, por la cascada: si quedara, la lápida protegería contra la
     reentrada pero el texto de una reunión borrada seguiría en la base. */
  const t = await esc.admin.query('select 1 from negocio.analizador_transcripciones where llamada_id = $1', [id]);
  assert.equal(t.rowCount, 0);
});

test('una manual borrada no deja lápida: no hay nada que descartar', async () => {
  const id = await unaLlamada(esc.org, { proveedor: 'MANUAL', reunionExternaId: null });
  const antes = await esc.admin.query('select count(*)::int as n from negocio.analizador_lapidas where org_id = $1', [esc.org]);
  assert.ok(await borrarLlamada(esc.org, id));
  const despues = await esc.admin.query('select count(*)::int as n from negocio.analizador_lapidas where org_id = $1', [esc.org]);
  assert.equal(despues.rows[0].n, antes.rows[0].n);
});

test('el candado: de dos tomas simultáneas, gana UNA', async () => {
  /* Cada toma abre su propia transacción, en su propia conexión: es la carrera real. La mutación que
     lee el estado y después escribe deja ganar a las dos, y se pagan dos análisis. */
  const id = await unaLlamada(esc.org);
  const tomas = await Promise.all([tomarParaAnalizar(esc.org, id, 'PENDING', 'HT'), tomarParaAnalizar(esc.org, id, 'PENDING', 'HT')]);
  assert.deepEqual(tomas.sort(), [false, true]);
  assert.equal(await estadoDe(id), 'ANALYZING');
});

test('la toma exige el estado que vio quien llama: una DONE no se toma por llegar tarde', async () => {
  /* El defecto que encontró la revisión: los drenados recorren una FOTO de las pendientes durante
     minutos. Si mientras tanto otra corrida dejó una DONE, al llegar su turno se volvía a tomar —la
     toma aceptaba DONE— y se pagaban otro análisis y otra ficha. La mutación que vuelve a aceptar
     cualquier estado tomable pone esta prueba en rojo en la segunda aserción. */
  const hecha = await unaAnalizada(esc.org);
  assert.equal(await tomarParaAnalizar(esc.org, hecha, 'PENDING', 'HT'), false, 'una DONE se tomó con una lista vieja');
  assert.equal(await estadoDe(hecha), 'DONE');
  assert.ok(await tomarParaAnalizar(esc.org, hecha, 'DONE', 'HT'), 'reanalizar una DONE tiene que poder pedirse');
});

test('la toma exige el TIPO que se leyó: una HT movida a OB en el medio no se analiza como HT', async () => {
  const id = await unaLlamada(esc.org);
  await esc.admin.query(`update negocio.analizador_llamadas set tipo = 'OB' where id = $1`, [id]);
  assert.equal(await tomarParaAnalizar(esc.org, id, 'PENDING', 'HT'), false);
  assert.equal(await estadoDe(id), 'PENDING');
});

test('una ANALYZING se retoma solo si está colgada', async () => {
  const colgada = await unaLlamada(esc.org);
  assert.ok(await tomarParaAnalizar(esc.org, colgada, 'PENDING', 'HT'));
  assert.equal(await tomarParaAnalizar(esc.org, colgada, 'ANALYZING', 'HT'), false, 'una ANALYZING reciente no se retoma');
  await esc.admin.query(`update negocio.analizador_llamadas set tomada_el = now() - interval '16 minutes' where id = $1`, [colgada]);
  assert.ok(await tomarParaAnalizar(esc.org, colgada, 'ANALYZING', 'HT'), 'pasados 15 minutos se retoma');
});

test('devolver al estado anterior conserva el error y el análisis de antes', async () => {
  /* Para cuando el análisis NO llegó a ocurrir —la llave dejó de servir, el servicio saturado—: la
     llamada vuelve tal como estaba. Con `error: null` al tomar, una FAILED reintentada con la llave
     rota perdía su error de antes. */
  const id = await unaLlamada(esc.org, { estado: 'FAILED' });
  await esc.admin.query(`update negocio.analizador_llamadas set error = 'el error de antes' where id = $1`, [id]);
  assert.ok(await tomarParaAnalizar(esc.org, id, 'FAILED', 'HT'));
  await devolverAlEstado(esc.org, id, 'FAILED');
  const r = await esc.admin.query('select estado, error, tomada_el from negocio.analizador_llamadas where id = $1', [id]);
  assert.deepEqual(r.rows[0], { estado: 'FAILED', error: 'el error de antes', tomada_el: null });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · NADA A MEDIAS
// ═══════════════════════════════════════════════════════════════════════════════

test('si guardar el análisis falla, la llamada NO queda DONE', async () => {
  /* Un puntaje fuera del CHECK hace fallar la escritura del análisis. Con las dos escrituras en
     pedidos separados —el origen— el DONE podía quedar sin informe; en la misma transacción, no. */
  const id = await unaLlamada(esc.org);
  assert.ok(await tomarParaAnalizar(esc.org, id, 'PENDING', 'HT'));
  await assert.rejects(
    terminarConAnalisis(esc.org, id, { ...MODELO, analisis: {}, columnas: { score: 11 } }),
  );
  assert.equal(await estadoDe(id), 'ANALYZING');
  const a = await esc.admin.query('select 1 from negocio.analizador_analisis where llamada_id = $1', [id]);
  assert.equal(a.rowCount, 0);
});

test('el veto deja NOT_MATCH, su motivo y lo que costó', async () => {
  const id = await unaLlamada(esc.org);
  assert.ok(await tomarParaAnalizar(esc.org, id, 'PENDING', 'HT'));
  await terminarConVeto(esc.org, id, { ...MODELO, motivo: 'es una sesión de coaching' });
  const r = await esc.admin.query(
    `select l.estado, l.motivo, l.error, a.coincide, a.analisis, a.tokens_lectura_cache
       from negocio.analizador_llamadas l join negocio.analizador_analisis a on a.llamada_id = l.id and a.org_id = l.org_id
      where l.id = $1`,
    [id],
  );
  assert.deepEqual(r.rows[0], {
    estado: 'NOT_MATCH', motivo: 'es una sesión de coaching', error: null, coincide: false, analisis: null, tokens_lectura_cache: 3000,
  });
});

test('analizar dos veces deja UNA fila con lo nuevo, y la ficha igual', async () => {
  const id = await unaAnalizada(esc.org);
  assert.ok(await tomarParaAnalizar(esc.org, id, 'DONE', 'HT'));
  await terminarConAnalisis(esc.org, id, { ...MODELO, analisis: { score: 3 }, columnas: { score: 3 } });
  const a = await esc.admin.query('select puntaje from negocio.analizador_analisis where llamada_id = $1', [id]);
  assert.deepEqual(a.rows, [{ puntaje: 3 }]);

  await guardarFicha(esc.org, id, { estado: 'FAILED', error: 'JSON roto' });
  await guardarFicha(esc.org, id, { ...MODELO, estado: 'OK', ficha: { summary: 'ok' }, columnas: { intent: 'ALTO', riskCount: 2 } });
  const f = await esc.admin.query('select estado, intencion, riesgos, error from negocio.analizador_fichas where llamada_id = $1', [id]);
  assert.deepEqual(f.rows, [{ estado: 'OK', intencion: 'ALTO', riesgos: 2, error: null }]);
  assert.equal(await estadoDe(id), 'DONE');
});

test('una ficha FAILED deja la llamada en DONE con su análisis intacto', async () => {
  const id = await unaAnalizada(esc.org);
  await guardarFicha(esc.org, id, { estado: 'FAILED', error: 'x'.repeat(900) });
  assert.equal(await estadoDe(id), 'DONE');
  const f = await esc.admin.query('select length(error) as largo from negocio.analizador_fichas where llamada_id = $1', [id]);
  assert.equal(f.rows[0].largo, 500, 'el error se recorta a 500');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LA FORMA
// ═══════════════════════════════════════════════════════════════════════════════

test('los CHECK rechazan un estado con errata y una OTRO que no es NOT_MATCH', async () => {
  /* Sin el CHECK, una errata en un `update` deja la llamada en un estado que ningún filtro de la
     lista muestra: desaparece de la pantalla sin que nada falle. */
  const id = await unaLlamada(esc.org);
  await assert.rejects(
    esc.admin.query(`update negocio.analizador_llamadas set estado = 'DONEE' where id = $1`, [id]),
    (e: { code?: string }) => e.code === '23514',
  );
  await assert.rejects(
    esc.admin.query(`update negocio.analizador_llamadas set tipo = 'OTRO', estado = 'PENDING' where id = $1`, [id]),
    (e: { code?: string }) => e.code === '23514',
  );
});

test('borrar un prospecto deja sus llamadas sin prospecto, y con su organización', async () => {
  /* Sin `(prospecto_id)` en el `set null`, PostgreSQL anula las DOS columnas de la clave compuesta, y
     `org_id` es `not null`: el borrado revienta con un mensaje que no menciona a los prospectos. */
  const prospecto = await prospectoDeLaLlamada(esc.org, 'Ana', 'ana@borrar-prospecto.test');
  const id = await unaLlamada(esc.org, { prospectoId: prospecto });
  await esc.admin.query('delete from negocio.analizador_prospectos where id = $1', [prospecto]);
  const r = await esc.admin.query('select org_id, prospecto_id from negocio.analizador_llamadas where id = $1', [id]);
  assert.deepEqual(r.rows[0], { org_id: esc.org, prospecto_id: null });
});

test('el prospecto se reconoce por correo, sin importar mayúsculas; sin correo, uno nuevo cada vez', async () => {
  const a = await prospectoDeLaLlamada(esc.org, 'Rubén', 'Ruben@Mayusculas.test');
  const b = await prospectoDeLaLlamada(esc.org, null, ' ruben@mayusculas.test ');
  assert.equal(a, b);
  const r = await esc.admin.query('select nombre, email from negocio.analizador_prospectos where id = $1', [a]);
  assert.deepEqual(r.rows[0], { nombre: 'Rubén', email: 'ruben@mayusculas.test' });
  const sin1 = await prospectoDeLaLlamada(esc.org, 'Rubén', null);
  const sin2 = await prospectoDeLaLlamada(esc.org, 'Rubén', null);
  assert.notEqual(sin1, sin2);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LO QUE SE LEE
// ═══════════════════════════════════════════════════════════════════════════════

test('las fichas faltantes se encuentran aunque haya muchas hechas antes', async () => {
  /* La que falta es la MÁS NUEVA, y el límite es 1: la mutación que quita el `NOT EXISTS` devuelve la
     más vieja, que ya tiene ficha, y la que falta no se genera nunca. */
  for (let i = 0; i < 3; i++) {
    const hecha = await unaAnalizada(esc.org);
    await guardarFicha(esc.org, hecha, { estado: 'FAILED', error: 'x' });
  }
  const falta = await unaAnalizada(esc.org);
  /* Recién analizada NO sale: la pantalla ya está pidiendo esa ficha, y la tarea que la generara en
     paralelo pagaría dos. La mutación que quita la espera la devuelve acá. */
  assert.ok(!(await llamadasSinFicha(esc.org, 50)).includes(falta), 'la tarea tomó una ficha que la pantalla está generando');
  await esc.admin.query(`update negocio.analizador_analisis set analizado_el = now() - interval '11 minutes' where org_id = $1`, [esc.org]);
  const ids = await llamadasSinFicha(esc.org, 50);
  assert.ok(ids.includes(falta));
  const conFicha = await esc.admin.query('select llamada_id from negocio.analizador_fichas where org_id = $1', [esc.org]);
  for (const f of conFicha.rows) assert.ok(!ids.includes(f.llamada_id), 'devolvió una que ya tenía ficha');
});

test('las pendientes salen en orden de llegada, y solo de los tipos pedidos', async () => {
  await limpiar();
  const ob = await unaLlamada(esc.org, { tipo: 'OB' });
  const ht1 = await unaLlamada(esc.org);
  const ht2 = await unaLlamada(esc.org);
  assert.deepEqual(await pendientesParaAnalizar(esc.org, ['HT'], 10), [ht1, ht2]);
  assert.deepEqual(await pendientesParaAnalizar(esc.org, ['HT', 'OB'], 10), [ob, ht1, ht2]);
  assert.deepEqual(await pendientesParaAnalizar(esc.org, [], 10), []);
});

test('las descartadas de cada pestaña son sus vetadas más TODAS las OTRO', async () => {
  await limpiar();
  const otro = await unaLlamada(esc.org, { tipo: 'OTRO', estado: 'NOT_MATCH', motivo: 'interna' });
  const vetadaHt = await unaLlamada(esc.org, { estado: 'NOT_MATCH', motivo: 'coaching' });
  const vetadaOb = await unaLlamada(esc.org, { tipo: 'OB', estado: 'NOT_MATCH', motivo: 'venta' });
  const pendiente = await unaLlamada(esc.org);

  const ids = async (tipo: 'HT' | 'OB', filtro: 'analizadas' | 'pendientes' | 'descartadas') =>
    (await listarLlamadas(esc.org, tipo, filtro)).map((f) => f.id).sort();
  assert.deepEqual(await ids('HT', 'descartadas'), [otro, vetadaHt].sort());
  assert.deepEqual(await ids('OB', 'descartadas'), [otro, vetadaOb].sort());
  assert.deepEqual(await ids('HT', 'pendientes'), [pendiente]);
  assert.deepEqual(await contarPorFiltro(esc.org, 'HT'), { analizadas: 0, pendientes: 1, descartadas: 2 });
});

test('el detalle NO trae la transcripción, de ningún tipo', async () => {
  /* Ni de una OTRO —reuniones internas del equipo— ni de una HT. La pantalla no la necesita: la
     evidencia viaja en el análisis con su cita. La mutación que agrega `t.texto` al `select` hace
     aparecer la frase acá. */
  for (const extra of [{}, { tipo: 'OTRO' as const, estado: 'NOT_MATCH' as const, motivo: 'interna' }]) {
    const id = await unaLlamada(esc.org, extra);
    const d = await leerDetalle(esc.org, id);
    assert.ok(d);
    assert.ok(!JSON.stringify(d).includes(FRASE_INTERNA), 'el detalle trae el texto de la transcripción');
    assert.equal(d.llamada.conMarcasDeTiempo, true);
  }
});

test('reencaminar: a HT/OB queda PENDING, a OTRO NOT_MATCH, y una DONE no se mueve', async () => {
  const otro = await unaLlamada(esc.org, { tipo: 'OTRO', estado: 'NOT_MATCH', motivo: 'interna' });
  assert.equal(await reencaminar(esc.org, otro, 'HT'), 'hecho');
  assert.equal(await estadoDe(otro), 'PENDING');
  assert.equal(await reencaminar(esc.org, otro, 'OTRO'), 'hecho');
  assert.equal(await estadoDe(otro), 'NOT_MATCH');

  /* Una HT analizada movida a OB quedaría PENDING con su informe de HT adentro, y la pestaña OB lo
     dibujaría como si fuera un onboarding. */
  const hecha = await unaAnalizada(esc.org);
  assert.equal(await reencaminar(esc.org, hecha, 'OB'), 'ya_analizada');
  assert.equal(await estadoDe(hecha), 'DONE');

  const enCurso = await unaLlamada(esc.org);
  assert.ok(await tomarParaAnalizar(esc.org, enCurso, 'PENDING', 'HT'));
  assert.equal(await reencaminar(esc.org, enCurso, 'OB'), 'en_curso');
  assert.equal(await reencaminar(esc.otraOrg, otro, 'OB'), 'no_encontrada');
});

test('reencaminar se lleva el informe viejo: una FAILED con análisis de HT no llega a OB con él', async () => {
  /* La secuencia que encontró la revisión: una HT en DONE se reanaliza, el reanálisis falla y queda
     FAILED con el primer informe adentro; como una FAILED sí se mueve, llegaba a OB con un informe y
     una ficha de venta. */
  const id = await unaAnalizada(esc.org);
  await guardarFicha(esc.org, id, { ...MODELO, estado: 'OK', ficha: { summary: 'x' }, columnas: {} });
  await esc.admin.query(`update negocio.analizador_llamadas set estado = 'FAILED', error = 'falló el reanálisis' where id = $1`, [id]);
  assert.equal(await reencaminar(esc.org, id, 'OB'), 'hecho');
  const a = await esc.admin.query('select 1 from negocio.analizador_analisis where llamada_id = $1', [id]);
  const f = await esc.admin.query('select 1 from negocio.analizador_fichas where llamada_id = $1', [id]);
  assert.equal(a.rowCount, 0, 'la OB quedó con el análisis de HT');
  assert.equal(f.rowCount, 0, 'la OB quedó con la ficha de HT');
});

test('una OTRO que pasa a HT recupera su prospecto por el correo', async () => {
  const p = await prospectoDeLaLlamada(esc.org, 'Rubén', 'ruben@recupera.test');
  const otro = await unaLlamada(esc.org, {
    tipo: 'OTRO', estado: 'NOT_MATCH', motivo: 'interna', prospectoId: null, prospectoEmail: 'ruben@recupera.test',
  });
  assert.equal(await reencaminar(esc.org, otro, 'HT'), 'hecho');
  const r = await esc.admin.query('select prospecto_id from negocio.analizador_llamadas where id = $1', [otro]);
  assert.equal(r.rows[0].prospecto_id, p);
});

test('una transcripción guardada sin segmentos se vuelve a partir, como en el origen', async () => {
  /* Mandar un `TRANSCRIPT:` vacío con el texto guardado al lado produce un análisis de nada, pagado. */
  const id = await unaLlamada(esc.org);
  await esc.admin.query(`update negocio.analizador_transcripciones set segmentos = '[]', texto = '[Ana]: hola' where llamada_id = $1`, [id]);
  const l = await leerParaAnalizar(esc.org, id);
  assert.equal(l?.transcripcion?.segments.length, 1);
  assert.equal(l?.transcripcion?.segments[0]?.text, 'hola');
});

test('el historial del prospecto ordena sus reuniones de la más vieja a la más nueva', async () => {
  const p = await prospectoDeLaLlamada(esc.org, 'Rubén', 'ruben@historial.test');
  const segunda = await unaLlamada(esc.org, { prospectoId: p, fechaDeLaReunion: '2026-09-20T10:00:00.000Z' });
  const primera = await unaLlamada(esc.org, { prospectoId: p, fechaDeLaReunion: '2026-09-01T10:00:00.000Z' });
  const d = await leerDetalle(esc.org, segunda);
  assert.deepEqual(d?.historial.map((h) => h.id), [primera, segunda]);
});
