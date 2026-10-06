// EL BRIEF DEL CLOSER: LEER, GENERAR AL ABRIR, REGENERAR CON TOPE, Y SÓLO LAS CITAS PROPIAS. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `app/api/closer/brief/route.ts` y las marcas de `app/api/closer/mi-dia/route.ts` (AG12 de los agentes;
// `fichas/F13-CLOSER-Y-BRIEF.md`), con la regla 31: una ruta nueva nace con su prueba de base. Con el modelo
// falso:
//
//   · «mío» no sirve el Brief de la cita de otro closer, ni el de un contacto fuera del territorio (AG-F13-4);
//   · generar al abrir guarda el Brief validado, y abrir otra vez no vuelve a pedirlo; lo que viaja al modelo no
//     lleva el teléfono;
//   · si el formulario cambia, el GET dice que hay datos nuevos;
//   · regenerar a mano cuenta para el tope, y con el tope lleno se rechaza;
//   · bajo delegación no se genera y sin llave tampoco, y el GET lo dice;
//   · Mi Día marca la cita con su Brief listo y la del contacto sin formulario.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { leerRespuesta, limpiar as limpiarContactos, montar, pedirComo, sesionDe, unaCita, unContacto, type Escenario } from '../apoyo/closer.ts';
import { escribe, instalarModeloFalso, respuestaDelModelo, type ModeloFalso } from '../apoyo/cerebro.ts';
import { GET as leer, POST as generar } from '../../app/api/closer/brief/route.ts';
import { GET as miDia } from '../../app/api/closer/mi-dia/route.ts';

const MARCA = 'brief233';
const CARPETA = `${MARCA}-carpeta`;
const CAMPO = `${MARCA}-campo`;
const CRM_UNO = `${MARCA}-crm-uno`;
const NOMBRE_DE_PERSONA = 'Persona de la 233';
const TELEFONO = '51987650233';
let esc: Escenario;
let modelo: ModeloFalso | null = null;
let closer: string;
let citas: { suya: string; ajena: string; fuera: string; sinFormulario: string };
let contactoSuyo: string;
const sesionesPropias: string[] = [];

async function limpiar(): Promise<void> {
  await limpiarContactos(esc);
  await esc.admin.query('delete from negocio.campos_del_crm where org_id = $1 and campo_id = $2', [esc.org, CAMPO]);
  await esc.admin.query('delete from negocio.carpetas_del_crm where org_id = $1 and carpeta_id = $2', [esc.org, CARPETA]);
  await esc.admin.query('delete from negocio.closer_asignado where org_id = $1 and crm_usuario_id = $2', [esc.org, CRM_UNO]);
  await esc.admin.query('delete from negocio.topes_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.preguntas_del_executive where org_id = $1', [esc.org]);
  await esc.admin.query(`delete from negocio.uso_de_ia where org_id = $1 and agente = 'brief'`, [esc.org]);
  await esc.admin.query('delete from identidad.usuarios where nombre = $1', [NOMBRE_DE_PERSONA]);
  await esc.admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [esc.org]);
  for (const t of sesionesPropias.splice(0)) await esc.admin.query('delete from identidad.sesiones where token_hash = $1', [hashDeToken(t)]);
}

before(async () => {
  esc = await montar('Brief233');
  await limpiar();
});
beforeEach(async () => {
  modelo?.quitar();
  modelo = null;
  await limpiar();
  await sembrar();
});
after(async () => {
  modelo?.quitar();
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

async function sembrar(): Promise<void> {
  await esc.admin.query(`insert into negocio.carpetas_del_crm (org_id, carpeta_id, nombre, grupo) values ($1, $2, 'Formulario', 'calificacion')`, [esc.org, CARPETA]);
  await esc.admin.query(
    `insert into negocio.campos_del_crm (org_id, campo_id, nombre, carpeta_id, tipo, posicion) values ($1, $2, 'Facturación mensual', $3, 'TEXT', 1)`,
    [esc.org, CAMPO, CARPETA],
  );
  // Una persona con el rol `usuario`, la pestaña del Closer y su vínculo al CRM: ve «mío».
  const r = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash) values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [esc.org, NOMBRE_DE_PERSONA, `brief-233-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
  );
  const id = r.rows[0]!.id;
  await esc.admin.query(`insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'usuario' and org_id is null`, [id]);
  await esc.admin.query(`insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, 'closer')`, [id]);
  await esc.admin.query('insert into negocio.closer_asignado (org_id, usuario_id, crm_usuario_id) values ($1, $2, $3)', [esc.org, id, CRM_UNO]);
  closer = await sesionDe(id);
  sesionesPropias.push(closer);

  const hoy = new Date(Date.now() + 2 * 3600_000);
  const suyo = await unContacto(esc, { crmAsignadoA: CRM_UNO, telefono: TELEFONO, nombre: `${esc.marca} con formulario` });
  contactoSuyo = suyo.id;
  await esc.admin.query(`update negocio.contactos set campos_del_crm = $2 where id = $1`, [suyo.id, JSON.stringify({ [CAMPO]: 'Entre 10 y 20 mil dólares' })]);
  const ajeno = await unContacto(esc, { crmAsignadoA: `${MARCA}-crm-otro` });
  const fuera = await unContacto(esc, { crmAsignadoA: CRM_UNO, territorio: 'setter' });
  const sinFormulario = await unContacto(esc, { crmAsignadoA: CRM_UNO });
  citas = {
    suya: await unaCita(esc, suyo.id, { inicioEl: hoy }),
    ajena: await unaCita(esc, ajeno.id, { inicioEl: hoy }),
    fuera: await unaCita(esc, fuera.id, { inicioEl: hoy }),
    sinFormulario: await unaCita(esc, sinFormulario.id, { inicioEl: hoy }),
  };
}

const conLlave = () => esc.admin.query('insert into identidad.organizaciones_credenciales (org_id, ia_clave_cifrada) values ($1, $2)', [esc.org, cifrar('sk-de-prueba-233')]);
const elBrief = (cita: string, token = closer) => leer(pedirComo(`/api/closer/brief?cita=${cita}`, token));
const pedirBrief = (cuerpo: unknown, token = closer) => generar(pedirComo('/api/closer/brief', token, { metodo: 'POST', cuerpo }));

/** Lo que contesta el modelo: un dato bien citado y uno inventado, que se tiene que degradar. */
const UNA_RESPUESTA = () =>
  respuestaDelModelo([
    escribe(
      JSON.stringify({
        quienEs: [
          { etiqueta: 'Facturación', estado: 'DETECTADO', valor: 'Entre 10 y 20 mil', fuente: 'formulario:1', cita: 'Entre 10 y 20 mil dólares', confianza: 'ALTA' },
          { etiqueta: 'Equipo', estado: 'DETECTADO', valor: 'Cinco personas', fuente: 'formulario:1', cita: 'tiene cinco empleados', confianza: 'ALTA' },
        ],
        queDijo: [],
        objecionProbable: { etiqueta: 'Objeción', estado: 'NO_CONSTA', valor: null, fuente: null, cita: null, confianza: 'BAJA', sugerencia: null },
        preguntaParaAbrir: '¿Qué te llevó a agendar esta llamada?',
      }),
    ),
  ]);

test('«mío» no sirve el Brief de otro closer ni el de un contacto fuera del territorio; quien ve todo, sí', async () => {
  await conLlave();
  const suya = await leerRespuesta<{ brief: unknown; sinFormulario: boolean; noSePuede: string | null }>(await elBrief(citas.suya));
  assert.deepEqual([suya.estado, suya.cuerpo.brief, suya.cuerpo.sinFormulario, suya.cuerpo.noSePuede], [200, null, false, null]);
  assert.equal((await elBrief(citas.ajena)).status, 404);
  assert.equal((await elBrief(citas.fuera)).status, 404);
  assert.equal((await pedirBrief({ cita: citas.ajena })).status, 404);
  assert.equal((await elBrief(citas.ajena, esc.token)).status, 200, 'quien administra ve todo el territorio');
  assert.equal((await elBrief(randomUUID())).status, 404);
});

test('generar al abrir guarda el Brief validado, y abrirlo otra vez no lo vuelve a pedir', async () => {
  await conLlave();
  modelo = instalarModeloFalso([UNA_RESPUESTA()]);
  const r = await leerRespuesta<{ brief: { quienEs: { etiqueta: string; estado: string }[]; preguntaParaAbrir: string } }>(await pedirBrief({ cita: citas.suya }));
  assert.equal(r.estado, 200);
  // El dato con una cita que no está en el formulario se degradó.
  assert.deepEqual(r.cuerpo.brief.quienEs.map((d) => [d.etiqueta, d.estado]), [['Facturación', 'DETECTADO'], ['Equipo', 'AMBIGUO']]);
  // Al modelo no le llegó el teléfono, y sí el formulario con su clave.
  const enviado = JSON.stringify(modelo.cuerpos[0]);
  assert.ok(!enviado.includes(TELEFONO), 'el teléfono viajó al modelo');
  assert.match(enviado, /formulario:1/);
  // Abrirlo de nuevo: el guardado, sin otro pedido (el guion está vacío y lanzaría).
  const otra = await leerRespuesta<{ brief: unknown }>(await pedirBrief({ cita: citas.suya }));
  assert.equal(otra.estado, 200);
  const leido = await leerRespuesta<{ brief: { preguntaParaAbrir: string }; datosNuevos: boolean }>(await elBrief(citas.suya));
  assert.deepEqual([leido.cuerpo.brief.preguntaParaAbrir, leido.cuerpo.datosNuevos], ['¿Qué te llevó a agendar esta llamada?', false]);
  const uso = await esc.admin.query<{ n: string }>(`select count(*)::text as n from negocio.uso_de_ia where org_id = $1 and agente = 'brief'`, [esc.org]);
  assert.equal(uso.rows[0]!.n, '1');
  // Generar al abrir no cuenta para el tope.
  const preguntas = await esc.admin.query<{ n: string }>('select count(*)::text as n from negocio.preguntas_del_executive where org_id = $1', [esc.org]);
  assert.equal(preguntas.rows[0]!.n, '0');

  // El formulario cambió: hay datos nuevos.
  await esc.admin.query(`update negocio.contactos set campos_del_crm = $2 where id = $1`, [contactoSuyo, JSON.stringify({ [CAMPO]: 'Más de 50 mil dólares' })]);
  const nuevo = await leerRespuesta<{ datosNuevos: boolean }>(await elBrief(citas.suya));
  assert.equal(nuevo.cuerpo.datosNuevos, true);
});

test('regenerar a mano cuenta para el tope, y con el tope lleno se rechaza', async () => {
  await conLlave();
  modelo = instalarModeloFalso([UNA_RESPUESTA(), UNA_RESPUESTA()]);
  assert.equal((await pedirBrief({ cita: citas.suya })).status, 200);
  assert.equal((await pedirBrief({ cita: citas.suya, regenerar: true })).status, 200);
  const preguntas = await esc.admin.query<{ estado: string }>('select estado from negocio.preguntas_del_executive where org_id = $1', [esc.org]);
  assert.deepEqual(preguntas.rows.map((f) => f.estado), ['respondida']);
  await esc.admin.query('insert into negocio.topes_del_executive (org_id, por_persona, por_empresa) values ($1, 1, 300) on conflict (org_id) do update set por_persona = 1', [esc.org]);
  const lleno = await leerRespuesta<{ codigo: string }>(await pedirBrief({ cita: citas.suya, regenerar: true }));
  assert.deepEqual([lleno.estado, lleno.cuerpo.codigo], [429, 'tope_del_cerebro']);
  assert.equal(modelo.quedan(), 0);
});

test('bajo delegación no se genera, sin llave tampoco, y el GET lo dice', async () => {
  // Sin llave.
  const sin = await leerRespuesta<{ noSePuede: string | null }>(await elBrief(citas.suya));
  assert.equal(sin.cuerpo.noSePuede, 'sin_llave');
  const r = await leerRespuesta<{ codigo: string }>(await pedirBrief({ cita: citas.suya }));
  assert.deepEqual([r.estado, r.cuerpo.codigo], [409, 'sin_llave_de_ia']);

  // Bajo delegación: la fundadora de ARIA mirando `alfa`.
  await conLlave();
  const fundadora = (await esc.admin.query<{ id: string }>(`select id from identidad.usuarios where email = 'fundadora@principal.ejemplo'`)).rows[0]!.id;
  const token = randomBytes(32).toString('base64url');
  sesionesPropias.push(token);
  await conIdentidad(async (db) => {
    await db
      .insertInto('sesiones')
      .values({
        usuario_id: fundadora,
        token_hash: hashDeToken(token),
        estado: 'activa',
        org_activa: esc.org,
        expira_el: sql<Date>`now() + interval '7 days'`,
        expira_absoluto: sql<Date>`now() + interval '30 days'`,
      })
      .execute();
  });
  const delegada = await leerRespuesta<{ codigo: string }>(await pedirBrief({ cita: citas.suya }, token));
  assert.deepEqual([delegada.estado, delegada.cuerpo.codigo], [409, 'cerebro_bajo_delegacion']);
  const leido = await leerRespuesta<{ noSePuede: string | null }>(await elBrief(citas.suya, token));
  assert.deepEqual([leido.estado, leido.cuerpo.noSePuede], [200, 'bajo_delegacion']);
});

test('Mi Día marca la cita con su Brief listo y la del contacto sin formulario', async () => {
  await conLlave();
  modelo = instalarModeloFalso([UNA_RESPUESTA()]);
  await pedirBrief({ cita: citas.suya });
  const r = await leerRespuesta<{ briefs: Record<string, { listo: boolean; sinFormulario: boolean }> }>(await miDia(pedirComo('/api/closer/mi-dia', closer)));
  assert.equal(r.estado, 200);
  assert.deepEqual(r.cuerpo.briefs[citas.suya], { listo: true, sinFormulario: false });
  assert.deepEqual(r.cuerpo.briefs[citas.sinFormulario], { listo: false, sinFormulario: true });
  // La de otro closer no está en su agenda, así que tampoco su marca.
  assert.equal(r.cuerpo.briefs[citas.ajena], undefined);
});
