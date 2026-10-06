// LAS SEÑALES DE CONVERSATION: LA PASADA TRADUCE LOS HALLAZGOS, Y LA PANTALLA LOS MUESTRA Y LOS DECIDE. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// AG13 de los agentes: el detector de Conversation en la pasada diaria, el GET de `app/api/auditoria/route.ts` con
// sus señales y las rutas gemelas `app/api/auditoria/senales` y `…/umbrales` (la regla 31: una ruta nueva nace
// con su prueba de base). Sobre hallazgos sembrados del auditor:
//
//   · la pasada guarda una señal por agente y patrón, con su `issue_source`, y no toca `negocio.hallazgos`;
//   · el GET las trae con el nombre del agente; la pestaña Auditoría no tiene período, así que con «hoy» son las
//     de 30 días;
//   · resolver una de Conversation por su ruta; la de otro departamento no existe para ella; se firman sólo las
//     reglas de Conversation.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { leerRespuesta, limpiar as limpiarContactos, montar, pedirComo, unContacto, type Escenario } from '../apoyo/closer.ts';
import { correrLaPasada } from '../../lib/agentes/detectores/correr.ts';
import { DETECTOR_DE_CONVERSATION } from '../../lib/agentes/detectores/detector-de-conversation.ts';
import { CONV } from '../../lib/agentes/detectores/conversation.ts';
import { reconciliarSenales } from '../../lib/agentes/senales/escritura.ts';
import { diaEnZona } from '../../lib/negocio/tiempo.ts';
import { GET as laPantalla } from '../../app/api/auditoria/route.ts';
import { POST as decidir } from '../../app/api/auditoria/senales/route.ts';
import { PUT as firmar } from '../../app/api/auditoria/umbrales/route.ts';

const ZONA = 'America/Lima';
let esc: Escenario;
let selloOriginal: { ultima_corrida_el: Date; ultimo_estado: string } | null = null;

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.senales where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.planes_de_accion where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.umbrales where org_id = $1', [esc.org]);
  await esc.admin.query(`delete from negocio.tareas_programadas where org_id = $1 and tarea = 'senales'`, [esc.org]);
  await esc.admin.query(`delete from negocio.hallazgos where org_id = $1 and titulo like 'C235 %'`, [esc.org]);
  await esc.admin.query(`delete from negocio.analisis_del_agente where org_id = $1 and resumen = 'C235'`, [esc.org]);
  await limpiarContactos(esc);
}

before(async () => {
  esc = await montar('Conv235');
  const r = await esc.admin.query(`select ultima_corrida_el, ultimo_estado from negocio.tareas_programadas where org_id = $1 and tarea = 'auditoria'`, [esc.org]);
  selloOriginal = r.rows[0] ?? null;
});
beforeEach(async () => {
  await limpiar();
  // La tarea del auditor, al día: sin esto la regla va a «sin medición».
  await esc.admin.query(
    `insert into negocio.tareas_programadas (org_id, tarea, ultima_corrida_el, ultimo_estado) values ($1, 'auditoria', now(), 'corrio')
       on conflict (org_id, tarea) do update set ultima_corrida_el = now(), ultimo_estado = 'corrio'`,
    [esc.org],
  );
});
after(async () => {
  await limpiar();
  if (selloOriginal) {
    await esc.admin.query(`update negocio.tareas_programadas set ultima_corrida_el = $2, ultimo_estado = $3 where org_id = $1 and tarea = 'auditoria'`, [
      esc.org,
      selloOriginal.ultima_corrida_el,
      selloOriginal.ultimo_estado,
    ]);
  } else {
    await esc.admin.query(`delete from negocio.tareas_programadas where org_id = $1 and tarea = 'auditoria'`, [esc.org]);
  }
  await cerrarTodo();
  await cerrarClientes();
});

/** Un hallazgo abierto del auditor, con su análisis y su contacto. */
async function unHallazgo(o: { agente: string; patron: string; severidad: string; categoria: string; fragmento?: string | null }): Promise<void> {
  const k = await unContacto(esc, { territorio: 'closer' });
  const a = await esc.admin.query<{ id: string }>(
    `insert into negocio.analisis_del_agente (org_id, contacto_id, agente, auditable, intervencion, motivo, nivel, resumen, disparo, mensajes_del_agente)
     values ($1, $2, $3, true, $4, $5, $6, 'C235', 'debounce', 6) returning id`,
    [esc.org, k.id, o.agente, o.severidad === 'rojo', o.severidad === 'rojo' ? 'Una frase concreta.' : null, o.severidad],
  );
  await esc.admin.query(
    `insert into negocio.hallazgos (org_id, contacto_id, analisis_id, agente, titulo, patron, correccion, evidencia_agente, severidad, categoria, fragmento_prompt)
     values ($1, $2, $3, $4, $5, $6, 'Agregar la sección de precios.', 'Una línea del agente.', $7, $8, $9)`,
    [esc.org, k.id, a.rows[0]!.id, o.agente, `C235 ${o.patron}`, o.patron, o.severidad, o.categoria, o.fragmento ?? null],
  );
}

const aLas12 = () => new Date(`${diaEnZona(new Date(), ZONA)}T17:00:00Z`);

async function sembrarYCorrer(): Promise<void> {
  await unHallazgo({ agente: 'chat_post_agenda', patron: 'c235_descuento', severidad: 'rojo', categoria: 'comportamiento', fragmento: 'Si duda, ofrece 10 %.' });
  await unHallazgo({ agente: 'chat_post_agenda', patron: 'c235_descuento', severidad: 'amarillo', categoria: 'comportamiento', fragmento: 'Si duda, ofrece 10 %.' });
  await unHallazgo({ agente: 'chat_pre_agenda', patron: 'c235_precio', severidad: 'amarillo', categoria: 'base_conocimiento' });
  const r = await correrLaPasada({ id: esc.org, zonaHoraria: ZONA }, { ahora: aLas12(), detectores: [DETECTOR_DE_CONVERSATION] });
  assert.ok(r.tocaba);
  assert.deepEqual(r.departamentos.map((d) => [d.departamento, d.estado]), [['conversation', 'corrio']]);
}

test('la pasada guarda una señal por agente y patrón, con su issue_source, y no toca los hallazgos', async () => {
  const antes = await esc.admin.query<{ n: string }>(`select count(*)::text as n, max(resuelto_el)::text as r from negocio.hallazgos where org_id = $1 and titulo like 'C235 %'`, [esc.org]);
  await sembrarYCorrer();
  const s = await esc.admin.query<{ ventana: string; entidad_id: string; gravedad: string; issue_source: string; valor_actual: string }>(
    `select ventana, entidad_id, gravedad, issue_source, valor_actual from negocio.senales
      where org_id = $1 and departamento = 'conversation' and entidad_id like '%c235%' order by ventana collate "C", entidad_id collate "C"`,
    [esc.org],
  );
  assert.deepEqual(
    s.rows.map((f) => [f.ventana, f.entidad_id, f.gravedad, f.issue_source, Number(f.valor_actual)]),
    [
      ['30d', 'chat_post_agenda:c235_descuento', 'alta', 'prompt_design', 2],
      ['30d', 'chat_pre_agenda:c235_precio', 'media', 'missing_data', 1],
      ['7d', 'chat_post_agenda:c235_descuento', 'alta', 'prompt_design', 2],
      ['7d', 'chat_pre_agenda:c235_precio', 'media', 'missing_data', 1],
    ],
  );
  const despues = await esc.admin.query<{ n: string }>(`select count(*)::text as n from negocio.hallazgos where org_id = $1 and titulo like 'C235 %' and resuelto_el is null`, [esc.org]);
  assert.equal(despues.rows[0]!.n, '3');
  assert.equal(antes.rows[0]!.n, '0');
});

test('el GET las trae con el nombre del agente; con «hoy», las de 30 días', async () => {
  await sembrarYCorrer();
  const r = await leerRespuesta<{
    senales: { ventana: string; lista: { regla: string; nombre: string; texto: string }[]; reglas: { codigo: string }[] };
    puedeConSenales: Record<string, boolean>;
  }>(await laPantalla(pedirComo('/api/auditoria?periodo=hoy', esc.token)));
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.senales.ventana, '30d');
  const nuestras = r.cuerpo.senales.lista.filter((x) => x.texto.includes('C235'));
  assert.deepEqual(nuestras.map((x) => x.nombre).sort(), ['AppFlow', 'LeadFlow']);
  assert.ok(
    nuestras.some((x) => x.texto === '«C235 c235_descuento»: 2 conversaciones abiertas, 1 en rojo; parece venir de cómo está escrito el prompt.'),
    nuestras.map((x) => x.texto).join('\n'),
  );
  assert.deepEqual(r.cuerpo.senales.reglas.map((x) => x.codigo), [CONV.patronAbierto]);
  assert.deepEqual(r.cuerpo.puedeConSenales, { resolver: true, validar: true, firmar: true });
  const siete = await leerRespuesta<{ senales: { ventana: string } }>(await laPantalla(pedirComo('/api/auditoria?periodo=7d', esc.token)));
  assert.equal(siete.cuerpo.senales.ventana, '7d');
});

test('resolver por su ruta; la de otro departamento no existe para ella; se firman sólo las reglas de Conversation', async () => {
  await sembrarYCorrer();
  const id = (await esc.admin.query<{ id: string }>(`select id from negocio.senales where org_id = $1 and departamento = 'conversation' and entidad_id like '%c235_precio' and ventana = '30d'`, [esc.org])).rows[0]!.id;
  const accion = (cuerpo: unknown) => decidir(pedirComo('/api/auditoria/senales', esc.token, { metodo: 'POST', cuerpo }));
  assert.equal((await accion({ id, accion: 'resolver', motivo: 'Cargamos los precios en la base del agente.' })).status, 200);
  const estado = await esc.admin.query<{ estado: string }>('select estado from negocio.senales where id = $1', [id]);
  assert.equal(estado.rows[0]!.estado, 'resuelta');

  // Una señal de Acquisition, por la ruta de Conversation.
  await conOrganizacion(esc.org, () =>
    reconciliarSenales({
      departamento: 'acquisition',
      detector: 'acquisition',
      ventana: '30d',
      detecciones: [
        {
          regla: 'ACQ-CPL-SOSTENIDO',
          entidad: { tipo: 'campana', id: 'c235' },
          metrica: 'x',
          lineaBase: 1,
          valorActual: 2,
          cambioPct: 1,
          muestra: 12,
          periodo: { desde: '2026-09-07', hasta: '2026-10-06' },
          datosDesde: null,
          gravedad: 'media',
          causasPosibles: [],
          revisionRecomendada: 'Revisa.',
          perdidaContactos: null,
          destino: null,
          requiereValidacionEjecutiva: false,
          umbral: { valor: 0.3, provisional: true },
          evidencia: {},
        },
      ],
      sinMedicion: [],
    }),
  );
  const ajena = (await esc.admin.query<{ id: string }>(`select id from negocio.senales where org_id = $1 and departamento = 'acquisition'`, [esc.org])).rows[0]!.id;
  assert.equal((await accion({ id: ajena, accion: 'descartar', motivo: 'x' })).status, 404);

  const firma = (cuerpo: unknown) => firmar(pedirComo('/api/auditoria/umbrales', esc.token, { metodo: 'PUT', cuerpo }));
  assert.equal((await firma({ regla: CONV.patronAbierto, valor: 2 })).status, 200);
  assert.equal((await firma({ regla: 'ACQ-CPL-SOSTENIDO', valor: 0.2 })).status, 400);
});
