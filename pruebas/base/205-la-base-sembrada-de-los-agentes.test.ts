// LA BASE SEMBRADA DE LOS AGENTES DA LAS CIFRAS DE `07`. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `db/sembrado/casos-de-los-agentes.ts` (AG4). Las preguntas aprobadas de `docs/OTROS/agentes/07-LA-EVALUACION.md`
// esperan cifras exactas —«0 de 46 citas pasadas tienen resultado», «precio, 9 contra 3»—, y esas cifras las
// dan las funciones de las pantallas sobre la empresa sintética. Si una columna nueva o un cambio en una
// función las mueve, esto lo dice antes de que una evaluación real gaste la llave en preguntas cuyas
// respuestas esperadas ya no son ciertas.
//
// Se mide con las MISMAS funciones que las pantallas (Acquisition, la cadena de cierre de Sales, la pantalla
// del técnico de Conversation), no con SQL propio: la evaluación compara contra lo que ve la persona.
//
// Siembra con su propio prefijo y lo quita al terminar: la `11` exige exactamente las empresas y las
// personas del sembrado de desarrollo.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import {
  CASOS,
  ZONA_DE_LOS_CASOS,
  quitarEmpresasDeLosAgentes,
  sembrarCasosDeLosAgentes,
  type EmpresasDeLosAgentes,
} from '../../db/sembrado/casos-de-los-agentes.ts';
import { embudosDeAcquisition } from '../../lib/negocio/embudosDeAcquisition.ts';
import { cadenaDeCierre } from '../../lib/negocio/cadenaDeCierre.ts';
import { laPantallaDelTecnico } from '../../lib/auditor/pantalla.ts';

const PREFIJO = 'agentes-205-';
let admin: Client;
let e: EmpresasDeLosAgentes;

before(async () => {
  admin = await conectar('admin');
  e = await sembrarCasosDeLosAgentes(PREFIJO);
});
after(async () => {
  await quitarEmpresasDeLosAgentes(PREFIJO);
  const quedan = await admin.query('select 1 from identidad.organizaciones where slug like $1', [`${PREFIJO}%`]);
  assert.equal(quedan.rowCount, 0, 'el sembrado de los agentes dejó empresas: la 11 se pondría roja');
  await cerrarClientes();
  await cerrarTodo();
});

const contar = async (sqlTexto: string, parametros: unknown[] = [e.conDatos]) =>
  Number((await admin.query<{ n: string }>(sqlTexto, parametros)).rows[0]!.n);

test('Acquisition, 30 días cerrados: 4.060 de inversión, la mitad de Webinar, y compara con la anterior', async () => {
  const r = await conOrganizacion(e.conDatos, () => embudosDeAcquisition({ clave: '30d', dias: 30 }, ZONA_DE_LOS_CASOS));
  assert.equal(r.sinComparacion, null, 'la ventana anterior tiene que ser comparable');
  assert.equal(r.sinCostos, null);
  assert.equal(r.total.inversion, 4060);
  // La anterior, de hace 31 a hace 60: 1.500 + 3.640 + 600 = 5.740. Bajó un 29 %.
  const variacion = r.total.variacionDeInversion as { tipo: string; porcentaje?: number };
  assert.equal(variacion.tipo, 'baja');
  assert.ok(Math.abs((variacion.porcentaje ?? 0) - 1680 / 5740) < 1e-9, `bajó ${variacion.porcentaje}`);
  assert.deepEqual(
    r.campanas.map((c) => [c.nombre, c.cifras.inversion]),
    [['Webinar - agenda', 2730], ['Clínicas - formulario', 1030], ['Remarketing - perfil', 300]],
  );
  assert.deepEqual(r.cobertura, { conCampana: 99, sobre: 119 });
  assert.deepEqual(
    r.total.etapas.map((x) => [x.etapa, x.valor]),
    [['contactos', 99], ['clics', 2088], ['agendados', 46]],
  );
});

test('Acquisition, 7 días cerrados: sin entrega, cero de inversión, y la entrada sigue llegando', async () => {
  const r = await conOrganizacion(e.conDatos, () => embudosDeAcquisition({ clave: '7d', dias: 7 }, ZONA_DE_LOS_CASOS));
  assert.equal(r.total.inversion, 0);
  assert.deepEqual(r.cobertura, { conCampana: 13, sobre: 26 });
  assert.equal(await contar(`select count(*) as n from negocio.metricas_de_anuncio where org_id = $1 and fecha >= (now() at time zone '${ZONA_DE_LOS_CASOS}')::date - ${CASOS.ultimoDiaConGasto - 1} and gasto is not null`), 0);
});

test('el gasto de los 60 días: 9.800, Webinar el 65 %, y Clínicas sube su costo por contacto un 40 %', async () => {
  const porCampana = await admin.query<{ campana: string; gasto: string }>(
    `select a.meta_campana_id as campana, sum(m.gasto) as gasto from negocio.metricas_de_anuncio m
       join negocio.anuncios a using (org_id, meta_anuncio_id) where m.org_id = $1 group by 1 order by 1`,
    [e.conDatos],
  );
  const gasto = Object.fromEntries(porCampana.rows.map((f) => [f.campana, Number(f.gasto)]));
  const [clinicas = 0, webinar = 0, remarketing = 0] = CASOS.campanas.map((c) => gasto[c.id] ?? 0);
  assert.deepEqual([clinicas, webinar, remarketing], [2530, 6370, 900]);
  assert.equal(webinar / (clinicas + webinar + remarketing), 0.65);

  // El costo por contacto de Clínicas en las dos ventanas de 14 días: 700 / 14 y 980 / 14.
  const ventana = (desde: number, hasta: number) =>
    contar(
      `select count(*) as n from negocio.contactos where org_id = $1 and atribucion_primera->>'campaignId' = $2
         and alta_en_el_crm >= (((now() at time zone $3)::date - $4::int)::timestamp at time zone $3)
         and alta_en_el_crm <  (((now() at time zone $3)::date - $5::int + 1)::timestamp at time zone $3)`,
      [e.conDatos, CASOS.campanas[0].id, ZONA_DE_LOS_CASOS, hasta, desde],
    );
  assert.deepEqual([await ventana(30, 43), await ventana(16, 29)], [14, 14]);
  assert.equal(980 / 14 / (700 / 14), 1.4);
});

test('los contactos: 120 en los últimos 30 días, 98 con campaña', async () => {
  const desde = `(((now() at time zone '${ZONA_DE_LOS_CASOS}')::date - 29)::timestamp at time zone '${ZONA_DE_LOS_CASOS}')`;
  assert.equal(await contar(`select count(*) as n from negocio.contactos where org_id = $1 and alta_en_el_crm >= ${desde}`), 120);
  assert.equal(
    await contar(`select count(*) as n from negocio.contactos where org_id = $1 and alta_en_el_crm >= ${desde} and atribucion_primera ? 'campaignId'`),
    98,
  );
});

test('Sales: 46 citas pasadas en la cohorte de 30 días, 3 con resultado y ninguna venta', async () => {
  const c = await conOrganizacion(e.conDatos, () => cadenaDeCierre(30));
  assert.equal(c.cohorte, 120);
  assert.deepEqual(
    c.eslabones.map((x) => [x.clave, x.contactos]),
    [['cohorte', 120], ['con_cita', 46], ['cerrable', 46], ['con_intento', 3], ['con_venta', 0]],
  );
  assert.match(c.aviso ?? '', /43 de 46/);
  assert.equal(await contar(`select count(*) as n from negocio.resultados where org_id = $1 and salida = 'venta'`), 0);
  // Treinta citas son del closer vinculado: es lo que «mío» le muestra a Closer Uno.
  assert.equal(await contar(`select count(*) as n from negocio.contactos where org_id = $1 and crm_asignado_a = 'crm-closer-uno'`), 30);
  assert.equal(await contar(`select count(*) as n from negocio.closer_asignado where org_id = $1 and crm_usuario_id is not null`), 1);
});

test('las llamadas de venta: 44, 38 analizadas, 28 vinculables por correo, y «precio» 9 contra 3', async () => {
  const estados = await admin.query<{ estado: string; n: string }>(
    `select estado, count(*) as n from negocio.analizador_llamadas where org_id = $1 and tipo <> 'OB' group by 1 order by 1`,
    [e.conDatos],
  );
  assert.deepEqual(
    Object.fromEntries(estados.rows.map((f) => [f.estado, Number(f.n)])),
    { DONE: 38, FAILED: 1, NOT_MATCH: 3, PENDING: 2 },
  );
  assert.equal(
    await contar(
      `select count(*) as n from negocio.analizador_llamadas l where l.org_id = $1
         and exists (select 1 from negocio.contactos c where c.org_id = l.org_id and c.email = l.prospecto_email)`,
    ),
    CASOS.llamadas.vinculables,
  );
  const precio = (desde: number, hasta: number) =>
    contar(
      `select count(*) as n from negocio.analizador_llamadas l join negocio.analizador_analisis a on a.org_id = l.org_id and a.llamada_id = l.id
        where l.org_id = $1 and a.analisis->'client'->'objections' ? 'precio'
          and l.fecha_de_la_reunion >= now() - make_interval(days => $3) and l.fecha_de_la_reunion < now() - make_interval(days => $2)`,
      [e.conDatos, desde, hasta],
    );
  assert.deepEqual([await precio(0, 14), await precio(14, 28)], [9, 3]);
  // Y la categoría de cada objeción (AG11): «precio» y «tiempo» clasificadas, «confianza» sin clasificar.
  const categorias = await admin.query<{ categoria: string; n: string }>(
    'select categoria, count(*) as n from negocio.objeciones_clasificadas where org_id = $1 group by 1 order by 1',
    [e.conDatos],
  );
  assert.deepEqual(
    categorias.rows.map((f) => [f.categoria, Number(f.n)]),
    [['momento', 10], ['precio', 12]],
  );
});

test('las llamadas de onboarding: tres analizadas, una por estado del cliente', async () => {
  const filas = await admin.query<{ readiness: string }>(
    `select a.analisis->>'readiness' as readiness from negocio.analizador_llamadas l
       join negocio.analizador_analisis a on a.org_id = l.org_id and a.llamada_id = l.id
      where l.org_id = $1 and l.tipo = 'OB' and l.estado = 'DONE' order by 1`,
    [e.conDatos],
  );
  assert.deepEqual(filas.rows.map((f) => f.readiness), ['BLOQUEADO', 'LISTO', 'PARCIAL']);
});

test('Conversation: por agente del CRM, un rojo y dos amarillos abiertos', async () => {
  const p = await conOrganizacion(e.conDatos, () => laPantallaDelTecnico(null));
  assert.deepEqual(
    p.tarjetas.map((t) => [t.agente, t.rojos, t.amarillos, t.hallazgosAbiertos]),
    [['chat_post_agenda', 1, 2, 3], ['chat_pre_agenda', 1, 2, 3]],
  );
});

test('el Espía guardó dos análisis, y la empresa vacía no tiene nada ni llave', async () => {
  assert.equal(await contar('select count(*) as n from negocio.analisis_del_espia where org_id = $1'), CASOS.analisisDelEspia);
  assert.equal(await contar('select count(*) as n from negocio.contactos where org_id = $1', [e.vacia]), 0);
  assert.equal(await contar('select count(*) as n from identidad.organizaciones_credenciales where org_id = $1', [e.vacia]), 0);
  assert.equal(await contar('select count(*) as n from identidad.usuarios where org_id = $1', [e.vacia]), 0);
});

test('sembrar dos veces deja lo mismo: cada corrida empieza quitando lo del prefijo', async () => {
  const antes = await contar(`select count(*) as n from identidad.organizaciones where slug like $1`, [`${PREFIJO}%`]);
  e = await sembrarCasosDeLosAgentes(PREFIJO);
  assert.equal(await contar(`select count(*) as n from identidad.organizaciones where slug like $1`, [`${PREFIJO}%`]), antes);
  const sembrados = CASOS.contactos.reduce((suma, t) => suma + t.cuantos, 0);
  assert.equal(await contar('select count(*) as n from negocio.contactos where org_id = $1'), sembrados);
});
