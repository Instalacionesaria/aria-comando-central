// EL COMENTARIO DE LA CABECERA, SERVIDO POR EL GET DE CADA PANTALLA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// AG15 de los agentes (`docs/OTROS/agentes/04-LA-REUNION-Y-LA-CABECERA.md`, AG-77 y AG-78): el GET de
// Acquisition y el de Conversation traen `comentario`, y por la prioridad:
//
//   · sin la lectura de los anuncios, lo que falta configurar; al día y sin nada más, nada;
//   · una señal crítica del departamento, con el texto que tiene en su tarjeta;
//   · sin señal grave, una regla de la Reunión de HOY de esa sección —no la de otra, ni la de ayer—;
//   · en Conversation, por qué el auditor no audita, que la ruta ya resolvía.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { leerRespuesta, montar, pedirComo, type Escenario } from '../apoyo/closer.ts';
import { reconciliarSenales } from '../../lib/agentes/senales/escritura.ts';
import type { Deteccion } from '../../lib/agentes/senales/tipos.ts';
import { FALTA_DEL_AUDITOR } from '../../lib/agentes/cabecera.ts';
import { GET as acquisition } from '../../app/api/acquisition/route.ts';
import { GET as auditoria } from '../../app/api/auditoria/route.ts';

let esc: Escenario;

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.senales where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.reuniones_del_dia where org_id = $1', [esc.org]);
  await esc.admin.query(`delete from negocio.tareas_programadas where org_id = $1 and tarea = 'anuncios'`, [esc.org]);
}

before(async () => {
  esc = await montar('Cabecera243');
});
beforeEach(limpiar);
after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

type Comentario = { texto: string; fuente: string } | null;
const deAcquisition = async (periodo = '7d') => {
  const r = await leerRespuesta<{ comentario: Comentario; senales: { lista: { texto: string; nombre: string | null }[] } }>(
    await acquisition(pedirComo(`/api/acquisition?periodo=${periodo}`, esc.token)),
  );
  assert.equal(r.estado, 200);
  return r.cuerpo;
};

async function lecturaAlDia(): Promise<void> {
  await esc.admin.query(
    `insert into negocio.tareas_programadas (org_id, tarea, ultima_corrida_el, ultimo_estado) values ($1, 'anuncios', now(), 'corrio')
     on conflict (org_id, tarea) do update set ultima_corrida_el = now(), ultimo_estado = 'corrio'`,
    [esc.org],
  );
}

const deteccion = (cambios: Partial<Deteccion> = {}): Deteccion => ({
  regla: 'ACQ-FUGA-ENTRE-ETAPAS',
  entidad: { tipo: 'par_de_etapas', id: 'profile:contactos>agendados' },
  metrica: 'tasa_de_paso',
  lineaBase: null,
  valorActual: 0,
  cambioPct: null,
  muestra: 19,
  periodo: { desde: '2026-09-29', hasta: '2026-10-05' },
  datosDesde: null,
  gravedad: 'critica',
  causasPosibles: [],
  revisionRecomendada: 'Revisa la etapa.',
  perdidaContactos: 19,
  destino: null,
  requiereValidacionEjecutiva: false,
  umbral: { valor: 0.1, provisional: true },
  evidencia: { de: 19, a: 0 },
  ...cambios,
});

async function reunionDeHoy(dias = 0): Promise<void> {
  const tema = (clave: string, seccion: string) => ({ clave, regla: clave, etiqueta: 'CADENA', seccion, origen: 'x', gravedad: 'alta', perdida: 4, texto: `La regla ${clave} de ${seccion}.`, evidencia: {} });
  await esc.admin.query(
    `insert into negocio.reuniones_del_dia (org_id, dia, temas)
     select $1, (now() at time zone o.zona_horaria)::date - $3::int, $2::jsonb from identidad.organizaciones o where o.id = $1`,
    [esc.org, JSON.stringify([tema('REU-CITAS-SIN-REGISTRAR', 'closer'), tema('ACQ-CONCENTRACION:campana:x', 'acquisition'), tema('REU-CAIDA-DE-ENTRADA', 'acquisition')]), dias],
  );
}

test('sin la lectura de los anuncios, lo que falta configurar; al día y sin nada más, nada', async () => {
  const sin = await deAcquisition();
  assert.equal(sin.comentario?.fuente, 'configurar');
  assert.match(sin.comentario!.texto, /^La lectura del costo de los anuncios nunca corrió sola en esta empresa/);
  await lecturaAlDia();
  assert.equal((await deAcquisition()).comentario, null, 'la regla del silencio');
});

test('una señal crítica habla con el texto de su tarjeta, y no depende del período elegido', async () => {
  await lecturaAlDia();
  await conOrganizacion(esc.org, () => reconciliarSenales({ departamento: 'acquisition', detector: 'acquisition', ventana: '7d', detecciones: [deteccion()], sinMedicion: [] }));
  const g = await deAcquisition();
  const [tarjeta] = g.senales.lista;
  assert.deepEqual(g.comentario, { texto: tarjeta!.nombre ? `${tarjeta!.nombre}: ${tarjeta!.texto}` : tarjeta!.texto, fuente: 'senal' });
  // Con «hoy» la tarjeta no tiene ventana, y el comentario sigue.
  assert.deepEqual((await deAcquisition('hoy')).comentario, g.comentario);
  // Una media no habla.
  await esc.admin.query('delete from negocio.senales where org_id = $1', [esc.org]);
  await conOrganizacion(esc.org, () => reconciliarSenales({ departamento: 'acquisition', detector: 'acquisition', ventana: '7d', detecciones: [deteccion({ gravedad: 'media' })], sinMedicion: [] }));
  assert.equal((await deAcquisition()).comentario, null);
});

test('sin señal grave, la regla de la Reunión de hoy de esa sección; la de ayer no', async () => {
  await lecturaAlDia();
  await reunionDeHoy(1);
  assert.equal((await deAcquisition()).comentario, null, 'habló la Reunión de ayer');
  await esc.admin.query('delete from negocio.reuniones_del_dia where org_id = $1', [esc.org]);
  await reunionDeHoy();
  // La de Closer no es de Acquisition, y la concentración es una señal, no una regla de la Reunión.
  assert.deepEqual((await deAcquisition()).comentario, { texto: 'La regla REU-CAIDA-DE-ENTRADA de acquisition.', fuente: 'regla' });
});

test('en Conversation, por qué el auditor no audita, que la ruta ya resolvía', async () => {
  const r = await leerRespuesta<{ comentario: Comentario; noAudita: keyof typeof FALTA_DEL_AUDITOR | null }>(
    await auditoria(pedirComo('/api/auditoria?periodo=30d', esc.token)),
  );
  assert.equal(r.estado, 200);
  assert.ok(r.cuerpo.noAudita, 'el escenario audita: la prueba no miraría lo que falta configurar');
  assert.deepEqual(r.cuerpo.comentario, { texto: FALTA_DEL_AUDITOR[r.cuerpo.noAudita], fuente: 'configurar' });
});
