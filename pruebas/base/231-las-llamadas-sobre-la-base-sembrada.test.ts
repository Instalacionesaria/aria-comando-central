// LAS LLAMADAS DE VENTA Y DE ONBOARDING, CONTADAS SOBRE LA BASE SEMBRADA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/negocio/llamadasDeVenta.ts`, `llamadasDeOnboarding.ts` y `vinculoDeLlamadas.ts` (AG11 de los agentes;
// `fichas/F14` y `F15`), con valores exactos sobre `db/sembrado/casos-de-los-agentes.ts`:
//
//   · 28 de las 38 analizadas casan por correo; la cobertura de las objeciones viaja (22 de 30: «confianza»
//     no está clasificada); el puntaje por closer con su piso;
//   · las frases citables sólo para quien las puede ver;
//   · el vínculo por una sola cita a ±12 horas, y la ambigua cuando hay dos contactos citados;
//   · una categoría guardada para otro texto (otra huella) no cuenta;
//   · «crece» sólo con 10 llamadas o más en la ventana anterior, y con la mitad más de veces;
//   · onboarding: un cliente por estado, y los riesgos.
//
// No mira 7 días: las llamadas sembradas son «de hace N días a las 16:00», y la de hace 7 entra o no según la
// hora a la que corra la prueba. 30 días y «completo» no tienen borde sembrado.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { quitarEmpresasDeLosAgentes, sembrarCasosDeLosAgentes, type EmpresasDeLosAgentes } from '../../db/sembrado/casos-de-los-agentes.ts';
import { llamadasDeVenta } from '../../lib/negocio/llamadasDeVenta.ts';
import { llamadasDeOnboarding } from '../../lib/negocio/llamadasDeOnboarding.ts';
import { vinculosDe } from '../../lib/negocio/vinculoDeLlamadas.ts';

const PREFIJO = 'agentes-231-';
let admin: Client;
let e: EmpresasDeLosAgentes;

before(async () => {
  admin = await conectar('admin');
  e = await sembrarCasosDeLosAgentes(PREFIJO);
});
after(async () => {
  await quitarEmpresasDeLosAgentes(PREFIJO);
  await cerrarClientes();
  await cerrarTodo();
});

const TREINTA = { clave: '30d' as const, dias: 30 };
const COMPLETO = { clave: 'completo' as const, dias: 3650 };
const venta = (periodo: typeof TREINTA | typeof COMPLETO, conFrases = true) => conOrganizacion(e.conDatos, () => llamadasDeVenta(periodo, { conFrases }));

/** Una HT analizada a `dias` atrás, con esas objeciones; las de `clasificar`, con su categoría. */
async function unaAnalizada(dias: number, objeciones: string[], clasificar: Record<string, string> = {}, extra: { email?: string | null } = {}): Promise<string> {
  const r = await admin.query<{ id: string }>(
    `insert into negocio.analizador_llamadas (org_id, tipo, proveedor, estado, fecha_de_la_reunion, prospecto_email)
     values ($1, 'HT', 'MANUAL', 'DONE', now() - make_interval(days => $2), $3) returning id`,
    [e.conDatos, dias, extra.email ?? null],
  );
  const id = r.rows[0]!.id;
  await admin.query(
    `insert into negocio.analizador_analisis (org_id, llamada_id, tipo, coincide, analisis, modelo, version_de_rubrica, puntaje)
     values ($1, $2, 'HT', true, $3, 'claude-sonnet-5', 'rubric.es.md@v8.1', 5)`,
    [e.conDatos, id, JSON.stringify({ seller: { objections: objeciones.map((objection) => ({ objection })) } })],
  );
  for (const [indice, o] of objeciones.entries()) {
    if (!clasificar[o]) continue;
    await admin.query(
      `insert into negocio.objeciones_clasificadas (org_id, llamada_id, indice, huella, categoria, modelo) values ($1, $2, $3, md5($4), $5, 'claude-haiku-4-5-20251001')`,
      [e.conDatos, id, indice, o, clasificar[o]],
    );
  }
  return id;
}

test('30 días: 28 de 38 casan por correo, la cobertura de las objeciones viaja, y el puntaje por closer con su piso', async () => {
  const v = await venta(TREINTA);
  assert.deepEqual(v.llamadas, { llamadas: 38, porCorreo: 28, porCita: 0, sinVinculo: 10, ambiguas: 0 });
  // 12 «precio» y 10 «tiempo» clasificadas; las 8 «confianza», no.
  assert.deepEqual([v.objeciones.total, v.objeciones.clasificadas], [30, 22]);
  // Sin llamadas en la ventana anterior, «crece» no se dice.
  assert.deepEqual(v.objeciones.porCategoria, [
    { categoria: 'precio', ahora: 12, antes: 0, crece: null },
    { categoria: 'momento', ahora: 10, antes: 0, crece: null },
  ]);
  assert.deepEqual(v.closers, [
    { closer: 'Closer Uno', llamadas: 26, puntajePromedio: 4.9 },
    { closer: 'Closer Dos', llamadas: 12, puntajePromedio: 6.5 },
  ]);
  // «Completo» no tiene ventana anterior.
  const todo = await venta(COMPLETO);
  assert.deepEqual([todo.llamadasAntes, todo.objeciones.porCategoria[0]!.antes], [null, null]);
});

test('las frases citables, sólo para quien las puede ver: la frase, el minuto, el enlace y si se ganó', async () => {
  const v = await venta(TREINTA);
  assert.equal(v.frases!.length, 6, 'tres por categoría clasificada');
  assert.deepEqual(v.frases![0], { categoria: 'precio', frase: 'Me preocupa el precio.', minuto: 2, enlace: null, ganada: false });
  assert.equal((await venta(TREINTA, false)).frases, null);
});

test('el vínculo: por una sola cita a ±12 horas, y ambigua con dos contactos citados', async () => {
  const contactos = (await admin.query<{ id: string }>('select id from negocio.contactos where org_id = $1 order by id limit 2', [e.conDatos])).rows.map((f) => f.id);
  const unaCita = (contacto: string, dias: number, n: number) =>
    admin.query(`insert into negocio.citas (org_id, ghl_evento_id, contacto_id, inicio_el) values ($1, $2, $3, now() - make_interval(days => $4) + interval '3 hours')`, [
      e.conDatos,
      `${PREFIJO}vinculo-${n}`,
      contacto,
      dias,
    ]);
  // Lejos de todo lo sembrado: 200 y 300 días atrás.
  const porCita = await unaAnalizada(200, []);
  await unaCita(contactos[0]!, 200, 1);
  const ambigua = await unaAnalizada(300, []);
  await unaCita(contactos[0]!, 300, 2);
  await unaCita(contactos[1]!, 300, 3);
  const sinNada = await unaAnalizada(400, []);
  const v = await conOrganizacion(e.conDatos, () => vinculosDe([porCita, ambigua, sinNada]));
  assert.deepEqual(
    [v.get(porCita), v.get(ambigua), v.get(sinNada)].map((x) => [x!.por, x!.contactoId, x!.sinVinculo]),
    [['cita', contactos[0], null], [null, null, 'cita_ambigua'], [null, null, 'sin_correo_ni_cita']],
  );
  // Las tres, sin organizador, son un «closer» sin nombre debajo del piso: el conteo, sin promedio.
  assert.deepEqual((await venta(COMPLETO)).closers.find((c) => c.closer === null), { closer: null, llamadas: 3, puntajePromedio: null });
  await admin.query('delete from negocio.analizador_llamadas where id = any($1)', [[porCita, ambigua, sinNada]]);
  await admin.query('delete from negocio.citas where org_id = $1 and ghl_evento_id like $2', [e.conDatos, `${PREFIJO}vinculo-%`]);
});

test('una categoría guardada para otro texto no cuenta', async () => {
  // La primera «confianza» sembrada, con una fila de otra huella: como si la objeción hubiera cambiado.
  const c = (
    await admin.query<{ llamada_id: string; indice: number }>(
      `select l.id as llamada_id, (o.orden - 1)::int as indice
         from negocio.analizador_llamadas l join negocio.analizador_analisis a on a.org_id = l.org_id and a.llamada_id = l.id
        cross join lateral jsonb_array_elements(a.analisis->'seller'->'objections') with ordinality as o(e, orden)
        where l.org_id = $1 and o.e->>'objection' = 'confianza' limit 1`,
      [e.conDatos],
    )
  ).rows[0]!;
  await admin.query(
    `insert into negocio.objeciones_clasificadas (org_id, llamada_id, indice, huella, categoria, modelo) values ($1, $2, $3, md5('otro texto'), 'confianza', 'x')`,
    [e.conDatos, c.llamada_id, c.indice],
  );
  const v = await venta(TREINTA);
  assert.deepEqual([v.objeciones.clasificadas, v.objeciones.porCategoria.map((x) => x.categoria)], [22, ['precio', 'momento']]);
  await admin.query('delete from negocio.objeciones_clasificadas where org_id = $1 and llamada_id = $2 and indice = $3', [e.conDatos, c.llamada_id, c.indice]);
});

test('«crece» sólo con 10 llamadas o más en la ventana anterior, y con la mitad más de veces', async () => {
  // Diez analizadas entre 31 y 60 días atrás: 9 con «precio» y 4 con «tiempo».
  const sembradas: string[] = [];
  for (let i = 0; i < 10; i++) {
    const objeciones = [...(i < 9 ? ['precio'] : []), ...(i >= 6 ? ['tiempo'] : [])];
    sembradas.push(await unaAnalizada(40 + i, objeciones, { precio: 'precio', tiempo: 'momento' }));
  }
  const v = await venta(TREINTA);
  assert.equal(v.llamadasAntes, 10);
  assert.deepEqual(v.objeciones.porCategoria, [
    // 12 contra 9: no llega a la mitad más (13,5).
    { categoria: 'precio', ahora: 12, antes: 9, crece: false },
    // 10 contra 4: sí.
    { categoria: 'momento', ahora: 10, antes: 4, crece: true },
  ]);
  await admin.query('delete from negocio.analizador_llamadas where id = any($1)', [sembradas]);
  // Con 9 en la ventana anterior no hay piso: el conteo, sin «crece».
  const nueve: string[] = [];
  for (let i = 0; i < 9; i++) nueve.push(await unaAnalizada(40 + i, ['tiempo'], { tiempo: 'momento' }));
  assert.equal((await venta(TREINTA)).objeciones.porCategoria.find((x) => x.categoria === 'momento')!.crece, null);
  await admin.query('delete from negocio.analizador_llamadas where id = any($1)', [nueve]);
});

test('onboarding: un cliente por estado, los riesgos, y la meta se lista sin contarse', async () => {
  const o = await conOrganizacion(e.conDatos, () => llamadasDeOnboarding({ dias: 30 }));
  assert.deepEqual([o.clientes, o.estados, o.riesgos], [3, { 'EN RIESGO': 1, ATENCIÓN: 1, 'AL DÍA': 1 }, { conSenales: 1, bloqueados: 1, compromisoBajo: 0 }]);
  assert.deepEqual(
    o.lista.map((c) => [c.empresa, c.estado]),
    [['Clínica Sintética Norte', 'EN RIESGO'], ['Estudio Sintético Sur', 'ATENCIÓN'], [null, 'AL DÍA']],
  );
  // Los correos sembrados no son de ningún contacto: las tres sin vínculo, y lo dice.
  assert.deepEqual(o.llamadas, { llamadas: 3, porCorreo: 0, porCita: 0, sinVinculo: 3, ambiguas: 0 });
  assert.ok(o.lista.every((c) => c.meta === 'Conseguir sus primeros cinco clientes en tres meses.'));

  // Una llamada más vieja del cliente bloqueado, en la que estaba listo: cuenta su última, y sigue siendo uno.
  const r = await admin.query<{ id: string }>(
    `insert into negocio.analizador_llamadas (org_id, tipo, proveedor, estado, fecha_de_la_reunion, prospecto_email)
     select org_id, 'OB', 'MANUAL', 'DONE', fecha_de_la_reunion - interval '1 day', prospecto_email
       from negocio.analizador_llamadas where org_id = $1 and titulo = 'Onboarding 1' returning id`,
    [e.conDatos],
  );
  await admin.query(
    `insert into negocio.analizador_analisis (org_id, llamada_id, tipo, coincide, analisis, modelo, version_de_rubrica)
     values ($1, $2, 'OB', true, $3, 'claude-sonnet-5', 'onboarding.es.md@v1')`,
    [e.conDatos, r.rows[0]!.id, JSON.stringify({ company: 'Clínica Sintética Norte', readiness: 'LISTO', commitmentLevel: 'ALTO', riskFlags: [] })],
  );
  const otra = await conOrganizacion(e.conDatos, () => llamadasDeOnboarding({ dias: 30 }));
  assert.deepEqual([otra.llamadas.llamadas, otra.clientes, otra.estados['EN RIESGO']], [4, 3, 1]);
  await admin.query('delete from negocio.analizador_llamadas where id = $1', [r.rows[0]!.id]);
});
