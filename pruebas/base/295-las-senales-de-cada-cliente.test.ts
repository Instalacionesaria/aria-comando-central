// LAS SEÑALES DE CADA CLIENTE: LO QUE SE LEE, SE ESCRIBE Y SE MUESTRA CON DOS CLIENTES. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C6 · D3)
//
// Una empresa con su principal, un segundo cliente activo y uno en pausa, cada uno con lo suyo. Lo puro lo mira la
// 294; acá, lo que necesita la base. Cada afirmación dice la mutación que la pone en rojo:
//
//   · el monitor, el recorrido, el formulario y el campo de UN cliente cuentan sólo lo suyo — mutaciones: sin el filtro
//     de cuenta en las citas o en las ventas del monitor, en el recorrido, o en el campo del formulario;
//   · `medirAcquisition` mide el monitor de los clientes ACTIVOS —mutación: también el que está en pausa— y lee el
//     conjunto con la anterior de Meta —mutación: con la de la pantalla, que un cliente sin Meta apaga—;
//   · los casos de un cliente traen su cliente, su tope y el fragmento de su agente —mutaciones: sin el filtro de
//     cuenta, la ventana sin el agente—, y la pasada de Conversation da una señal por cliente sin «detectó dos veces la
//     misma huella» —mutación: el patrón sin el cliente—; con un cliente atrasado, lo de los demás se publica y sólo lo
//     suyo queda sin medición, con su nombre en el plan —mutaciones: callar todo, el escritor sin la lista por cliente—;
//     y el plan trae el nombre del cliente de cada renglón —mutación: `ultimoPlan` sin `clientes`—;
//   · el escritor deja sin medición sólo lo del cliente que no se midió, también la del principal sin prefijo —
//     mutación: sin la del principal—; la fuga de dos clientes no choca —mutación: el id sin el cliente—, y la pieza de
//     nombre largo entra en la tabla —mutación: sin cortarla—;
//   · `medirConversion` mide a cada cliente activo con su cohorte, su campo y su anterior;
//   · la pantalla nombra cada entidad con su cliente y nunca con un uuid, tampoco en la evidencia — mutaciones:
//     `lectura.ts` sin quitar el cliente del id, sin el rótulo del formulario o del conjunto de un cliente;
//   · con los datos de un solo cliente y otro activo SIN datos (otra empresa): el otro con la lectura fallando no le
//     apaga el cambio de ruta al que tiene datos —mutación: la anterior de la pantalla, con la frescura de la empresa—;
//     el que tiene datos, atrasado, deja la regla entera sin medición aunque el otro esté al día —mutaciones: el freno
//     de la empresa a secas, en Conversion y en Conversation—, y el otro sin ningún sello no es un atrasado ni sale en
//     el plan —mutación: contar el «nunca»—.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { campana, medida as medidaDeAcquisition } from '../apoyo/medida-de-acquisition.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { calidadDeLaAtribucion } from '../../lib/negocio/calidadDeLaAtribucion.ts';
import { recorridoDelLead } from '../../lib/negocio/recorridoDelLead.ts';
import { embudoDelFormulario } from '../../lib/negocio/embudoDelFormulario.ts';
import { campoPorNombre } from '../../lib/negocio/camposDelCrm.ts';
import { CAMPO_DEL_FORMULARIO } from '../../lib/negocio/recorrido.ts';
import { idDeLaPiezaEnUnaSenal } from '../../lib/negocio/idDeLaPieza.ts';
import { casosDeUnCliente } from '../../lib/auditor/pantalla.ts';
import { ACQ, detectarEnAcquisition, medirAcquisition } from '../../lib/agentes/detectores/acquisition.ts';
import { CONV, detectarEnConversation, medirConversation } from '../../lib/agentes/detectores/conversation.ts';
import { CNV, detectarEnConversion, medirConversion } from '../../lib/agentes/detectores/conversion.ts';
import { DETECTOR_DE_CONVERSATION } from '../../lib/agentes/detectores/detector-de-conversation.ts';
import { correrLaPasada } from '../../lib/agentes/detectores/correr.ts';
import { reconciliarSenales } from '../../lib/agentes/senales/escritura.ts';
import { senalesDeLaPantalla, ultimoPlan } from '../../lib/agentes/senales/lectura.ts';
import { CATALOGO_DE_REGLAS, umbralVigente } from '../../lib/agentes/senales/umbrales.ts';
import type { Deteccion } from '../../lib/agentes/senales/tipos.ts';
import { textoDe as textoDeAcquisition } from '../../lib/agentes/plan/acquisition.ts';
import { textoDeConversation } from '../../lib/agentes/plan/conversation.ts';
import { textoDeConversion } from '../../lib/agentes/plan/conversion.ts';
import { diaEnZona } from '../../lib/negocio/tiempo.ts';

const SLUG = 'gamma-295';
/** La otra empresa: los datos de un solo cliente, y otro activo sin nada. */
const SLUG_DE_UNO = 'gamma-295-uno';
const ZONA = 'America/Lima';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const umbral = (codigo: string) => umbralVigente(CATALOGO_DE_REGLAS.find((r) => r.codigo === codigo)!, new Map());

let admin: Client;
let org: string;
/** El principal, el segundo cliente (activo) y uno en pausa, con sus nombres. */
let p: string;
let y: string;
let z: string;
let nombreDeP: string;
/** Los días cerrados de la ventana de 7 días, los de la pantalla. */
let ventana: { desde: string; hasta: string };

async function limpiar(slug = SLUG): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [slug]);
  if (!o) return;
  for (const t of [
    'senales', 'planes_de_accion', 'hallazgos', 'analisis_del_agente', 'resultados', 'citas', 'contactos', 'campos_del_crm',
    'carpetas_del_crm', 'metricas_de_anuncio', 'anuncios', 'gasto_de_la_cuenta', 'tareas_programadas', 'funnels_de_campana', 'campanas',
  ]) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Un contacto de un cliente, dado de alta hace `dias`, con su atribución y sus campos del CRM; `en`, su empresa. */
async function unContacto(
  cuenta: string,
  marca: string,
  dias: number,
  atribucion: Record<string, string> = {},
  campos: Record<string, string> = {},
  en = org,
): Promise<string> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera, campos_del_crm)
     values ($1, $2, $3, 'Contacto 295', 'setter', now() - make_interval(days => $4), $5::jsonb, $6::jsonb) returning id`,
    [en, cuenta, marca, dias, JSON.stringify(atribucion), JSON.stringify(campos)],
  );
  assert.ok(c);
  return c.id;
}

/** Una cita y una venta del contacto, hace tres días. */
async function citaYVenta(cuenta: string, contacto: string, marca: string, conVenta: boolean): Promise<void> {
  await admin.query(
    `insert into negocio.citas (org_id, cuenta_id, ghl_evento_id, contacto_id, inicio_el, estado_ghl, ghl_calendario_id)
     values ($1, $2, $3, $4, now() - interval '3 days', 'confirmed', 'cal295')`,
    [org, cuenta, `${marca}-cita`, contacto],
  );
  if (conVenta) {
    await admin.query(
      `insert into negocio.resultados (org_id, cuenta_id, contacto_id, rol, salida, creado_el) values ($1, $2, $3, 'closer', 'venta', now() - interval '3 days')`,
      [org, cuenta, contacto],
    );
  }
}

/** El sello de una tarea de un cliente, ahora, con su estado; `en`, su empresa. */
async function sello(cuenta: string, tarea: string, estado: string, en = org): Promise<void> {
  await admin.query(
    `insert into negocio.tareas_programadas (org_id, cuenta_id, tarea, ultima_corrida_el, ultimo_estado) values ($1, $2, $3, now(), $4)
       on conflict (org_id, cuenta_id, tarea) do update set ultima_corrida_el = now(), ultimo_estado = excluded.ultimo_estado`,
    [en, cuenta, tarea, estado],
  );
}

/** Un hallazgo abierto del auditor, detectado hace `minutos`; `en`, su empresa. */
async function hallazgos(
  cuenta: string,
  contacto: string,
  o: { agente: string; patron: string; minutos: number; fragmento?: string | null; cuantos?: number; en?: string },
): Promise<void> {
  const en = o.en ?? org;
  const a = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.analisis_del_agente (org_id, cuenta_id, contacto_id, agente, auditable, intervencion, nivel, resumen, disparo, mensajes_del_agente)
     values ($1, $2, $3, $4, true, false, 'amarillo', 'C295', 'manual', 3) returning id`,
    [en, cuenta, contacto, o.agente],
  );
  assert.ok(a);
  await admin.query(
    `insert into negocio.hallazgos (org_id, cuenta_id, contacto_id, analisis_id, agente, titulo, patron, correccion, evidencia_agente, severidad, categoria, fragmento_prompt, detectado_el)
     select $1, $2, $3, $4, $5, 'C295 ' || $6, $6, 'Una corrección.', 'Una línea del agente.', 'amarillo', 'comportamiento', $7, now() - make_interval(mins => $8)
       from generate_series(1, $9::int)`,
    [en, cuenta, contacto, a.id, o.agente, o.patron, o.fragmento ?? null, o.minutos, o.cuantos ?? 1],
  );
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  await limpiar(SLUG_DE_UNO);
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 295', $1, $2) returning id`,
    [SLUG, ZONA],
  );
  assert.ok(o);
  org = o.id;
  const principal = await unaFila<{ id: string; nombre: string }>(admin, `select id, nombre from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  const segunda = await unaFila<{ id: string }>(admin, `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Segunda 295', 'segunda-295') returning id`, [org]);
  const pausada = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, estado) values ($1, 'En pausa 295', 'pausa-295', 'pausada') returning id`,
    [org],
  );
  assert.ok(principal && segunda && pausada);
  p = principal.id;
  nombreDeP = principal.nombre;
  y = segunda.id;
  z = pausada.id;

  /* La pauta de P: su anuncio, en el conjunto `cj295p`, con métricas y serie que cuadran de hace 20 días a anteayer, y un
     contacto viejo de su campaña (la historia de contactos empieza antes de la anterior). Y trae contactos de campaña
     sin Meta conectado: la pantalla no compara ni publica costos, y lo que sólo lee Meta sí se mide. */
  await admin.query(
    `insert into negocio.anuncios (org_id, cuenta_id, meta_anuncio_id, meta_campana_id, meta_conjunto_id, nombre) values ($1, $2, 'a295p', '2950001', 'cj295p', 'a295p')`,
    [org, p],
  );
  await admin.query(
    `insert into negocio.metricas_de_anuncio (org_id, cuenta_id, meta_anuncio_id, fecha, gasto, impresiones)
     select $1, $2, 'a295p', current_date - d, 100, 1000 from generate_series(2, 20) d`,
    [org, p],
  );
  await admin.query(
    `insert into negocio.gasto_de_la_cuenta (org_id, cuenta_id, fecha, gasto, leido_el) select $1, $2, current_date - d, 100, now() from generate_series(2, 20) d`,
    [org, p],
  );
  await unContacto(p, 'k295-viejo', 40, { campaignId: '2950001' });

  /* Los contactos de la ventana: P, cuatro con anuncio (dos con cita, uno con venta, dos con el formulario); Y, cinco de
     su campaña sin anuncio (uno con cita y venta); Z, en pausa, uno de su campaña. */
  const deP: string[] = [];
  for (let i = 0; i < 4; i++) {
    deP.push(await unContacto(p, `k295p-${i}`, 3, { campaignId: '2950001', adId: 'a295p', utmTerm: 'cj295p' }, i < 2 ? { cf295p: 'Agendado' } : {}));
  }
  await citaYVenta(p, deP[0]!, 'k295p-0', true);
  await citaYVenta(p, deP[1]!, 'k295p-1', false);
  const deY: string[] = [];
  for (let i = 0; i < 5; i++) deY.push(await unContacto(y, `k295y-${i}`, 3, { campaignId: '2950002' }));
  await citaYVenta(y, deY[0]!, 'k295y-0', true);
  const deZ = await unContacto(z, 'k295z-0', 3, { campaignId: '2950003' });

  // El campo del formulario existe sólo en la subcuenta de P.
  await admin.query(`insert into negocio.carpetas_del_crm (org_id, cuenta_id, carpeta_id, nombre, visto_el) values ($1, $2, 'cp295', 'Prueba', now())`, [org, p]);
  await admin.query(
    `insert into negocio.campos_del_crm (org_id, cuenta_id, campo_id, nombre, carpeta_id, tipo, posicion, visto_el) values ($1, $2, 'cf295p', $3, 'cp295', 'SINGLE_OPTIONS', 1, now())`,
    [org, p, CAMPO_DEL_FORMULARIO],
  );

  /* Los hallazgos: el mismo patrón en P (con fragmento) y en Y (sin él), y en Y otro agente con el mismo código y su
     fragmento, más reciente. Los doscientos de P —el tope— son más recientes que los de Y: con el tope de la empresa, Y
     no se leía. Y uno de Z, en pausa. */
  await hallazgos(p, deP[0]!, { agente: 'chat_post_agenda', patron: 'p295_descuento', minutos: 20, fragmento: 'Si duda, ofrece 10 %.' });
  await hallazgos(p, deP[1]!, { agente: 'chat_post_agenda', patron: 'p295_masivo', minutos: 30, cuantos: 199 });
  await hallazgos(y, deY[0]!, { agente: 'chat_post_agenda', patron: 'p295_descuento', minutos: 120 });
  await hallazgos(y, deY[1]!, { agente: 'chat_pre_agenda', patron: 'p295_descuento', minutos: 60, fragmento: 'Otro fragmento.' });
  await hallazgos(z, deZ, { agente: 'chat_post_agenda', patron: 'p295_descuento', minutos: 60 });

  // Los sellos: todo al día, salvo los contactos de Y.
  for (const cuenta of [p, y]) {
    await sello(cuenta, 'auditoria', 'corrio');
    await sello(cuenta, 'citas', 'corrio');
  }
  await sello(p, 'contactos', 'corrio');
  await sello(y, 'contactos', 'fallo');

  const m = await conOrganizacion(org, () => medirAcquisition('7d', ZONA));
  ventana = m.embudos.ventana;
});

after(async () => {
  try {
    await limpiar();
    await limpiar(SLUG_DE_UNO);
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

// ─── Lo que se lee de un cliente ────────────────────────────────────────────

test('el monitor, el recorrido, el formulario y el campo de un cliente cuentan sólo lo suyo', async () => {
  const puntos = async (cuenta: string | null) =>
    Object.fromEntries((await conOrganizacion(org, () => calidadDeLaAtribucion(7, ventana, cuenta))).puntos.map((x) => [x.clave, [x.cuantos, x.sobre]]));
  const deP = await puntos(p);
  const deY = await puntos(y);
  assert.deepEqual([deP.leads_con_anuncio, deP.citas_con_anuncio, deP.ventas_con_anuncio], [[4, 4], [2, 2], [1, 1]], 'el monitor de P cuenta lo de otro');
  assert.deepEqual([deY.leads_con_anuncio, deY.citas_con_anuncio, deY.ventas_con_anuncio], [[0, 5], [0, 1], [0, 1]]);
  const empresa = await puntos(null);
  assert.deepEqual([empresa.leads_con_anuncio, empresa.citas_con_anuncio, empresa.ventas_con_anuncio], [[4, 10], [2, 3], [1, 2]]);

  const cohorte = async (cuenta: string | null) => (await conOrganizacion(org, () => recorridoDelLead(7, ventana, cuenta))).cohorte;
  assert.deepEqual([await cohorte(p), await cohorte(y), await cohorte(null)], [4, 5, 10]);

  const formulario = async (cuenta: string | null) => {
    const f = await conOrganizacion(org, () => embudoDelFormulario(7, ventana, cuenta));
    return [f.campoDelFormulario, f.cobertura.con, f.cobertura.sobre];
  };
  assert.deepEqual(await formulario(p), [CAMPO_DEL_FORMULARIO, 2, 4]);
  assert.deepEqual(await formulario(y), [null, 0, 0], 'el formulario de Y tomó el campo de otro cliente');
  assert.deepEqual(await formulario(null), [CAMPO_DEL_FORMULARIO, 2, 10]);
  assert.equal(await conOrganizacion(org, () => campoPorNombre(CAMPO_DEL_FORMULARIO, y)), null);
  assert.deepEqual(await conOrganizacion(org, () => campoPorNombre(CAMPO_DEL_FORMULARIO, p)), ['cf295p']);
});

test('Acquisition mide el monitor de los clientes activos y el conjunto con la anterior de Meta', async () => {
  const m = await conOrganizacion(org, () => medirAcquisition('7d', ZONA));
  // Las condiciones del caso: un cliente sin Meta deja la pantalla sin comparar, y Meta está entero.
  assert.equal(m.embudos.sinComparacion, 'faltan_dias');
  assert.equal(m.faltanDiasDeMeta, false);
  assert.ok(m.anteriorDeMeta !== null);
  assert.deepEqual([...m.atribucionPorCliente.keys()].sort(), [p, y].sort(), 'el monitor midió a un cliente en pausa');
  assert.ok(m.conjuntos?.has('cj295p'), 'el conjunto se leyó con la anterior que un cliente sin Meta apaga');
  assert.equal(m.clienteDelConjunto.get('cj295p'), p);
  assert.equal(m.principal, p);
  assert.ok(!detectarEnAcquisition(m, umbral).sinMedicion.includes(ACQ.cambioBruscoConjunto));
});

test('los casos de un cliente: los suyos, con su tope y con el fragmento de su agente', async () => {
  const deY = await conOrganizacion(org, () => casosDeUnCliente(y));
  assert.deepEqual(
    deY.map((c) => [c.cuentaId, c.agente, c.fragmentoPrompt]).sort(),
    [
      [y, 'chat_post_agenda', null],
      [y, 'chat_pre_agenda', 'Otro fragmento.'],
    ],
    'el fragmento de un agente es el de otro, o los casos son de otro cliente',
  );
  const deP = await conOrganizacion(org, () => casosDeUnCliente(p));
  assert.equal(deP.length, 200, 'el tope es de cada cliente');
  assert.ok(deP.every((c) => c.cuentaId === p));
  const medida = await conOrganizacion(org, () => medirConversation('7d', new Date()));
  assert.equal(medida.variosClientes, true);
  assert.ok(medida.casos.some((c) => c.cuentaId === y), 'los doscientos de P dejaron afuera a Y');
  assert.ok(!medida.casos.some((c) => c.cuentaId === z), 'se midió a un cliente en pausa');
});

// ─── Lo que se escribe ──────────────────────────────────────────────────────

const aLas12 = () => new Date(`${diaEnZona(new Date(), ZONA)}T17:00:00Z`);

async function correrConversation(): Promise<void> {
  await admin.query(`delete from negocio.planes_de_accion where org_id = $1`, [org]);
  const r = await correrLaPasada({ id: org, zonaHoraria: ZONA }, { ahora: aLas12(), detectores: [DETECTOR_DE_CONVERSATION] });
  assert.ok(r.tocaba);
  assert.deepEqual(r.departamentos.map((d) => [d.departamento, d.estado]), [['conversation', 'corrio']], 'la pasada de Conversation falló');
}

const deConversation = async () =>
  (
    await admin.query<{ entidad_id: string; estado: string; issue_source: string | null }>(
      `select entidad_id, estado, issue_source from negocio.senales where org_id = $1 and departamento = 'conversation' and ventana = '7d' order by entidad_id collate "C"`,
      [org],
    )
  ).rows.map((f) => [f.entidad_id, f.estado, f.issue_source]);

test('Conversation: una señal por cliente, agente y patrón; un cliente atrasado sólo deja sin medición lo suyo', async () => {
  await sello(y, 'auditoria', 'corrio');
  await correrConversation();
  const esperadas = [
    ['chat_post_agenda:p295_descuento', 'prompt_design'],
    ['chat_post_agenda:p295_masivo', 'agent_execution'],
    [`${y}:chat_post_agenda:p295_descuento`, 'agent_execution'],
    [`${y}:chat_pre_agenda:p295_descuento`, 'prompt_design'],
  ].sort((a, b) => (a[0]! < b[0]! ? -1 : 1));
  assert.deepEqual(await deConversation(), esperadas.map(([id, fuente]) => [id, 'abierta', fuente]));

  // La pantalla: el agente con su cliente, y nunca un uuid.
  const lista = await conOrganizacion(org, () => senalesDeLaPantalla('conversation', '7d', (d) => textoDeConversation(d)));
  assert.deepEqual(lista.map((s) => s.nombre).sort(), [`AppFlow (${nombreDeP})`, `AppFlow (${nombreDeP})`, 'AppFlow (Segunda 295)', 'LeadFlow (Segunda 295)'].sort());
  for (const s of lista) {
    // La evidencia lleva los ids de los hallazgos y de los contactos (AG-38); el cliente, por su nombre.
    assert.doesNotMatch(`${s.nombre} ${s.texto} ${(s.evidencia as { cliente: string }).cliente}`, UUID, `la señal ${s.entidad.id} muestra un uuid`);
    assert.ok(s.cliente === nombreDeP || s.cliente === 'Segunda 295');
    assert.equal((s.evidencia as { cliente: string }).cliente, s.cliente);
  }
  // El plan guarda el id del cliente de cada renglón, y la lectura lo trae con su nombre: con él, el renglón dice de cuál es.
  const plan = await conOrganizacion(org, () => ultimoPlan('conversation', '7d'));
  assert.deepEqual(plan?.clientes, { [p]: nombreDeP, [y]: 'Segunda 295' }, 'el plan no dice de qué cliente es cada renglón');

  // Y se atrasa: lo de P se publica, y lo de Y queda sin medición, con su nombre en el plan.
  await sello(y, 'auditoria', 'fallo');
  try {
    await correrConversation();
    assert.deepEqual(
      await deConversation(),
      esperadas.map(([id, fuente]) => [id, id!.startsWith(y) ? 'sin_medicion' : 'abierta', fuente]),
      'un cliente atrasado calló a los demás, o su señal se cerró sola',
    );
    const plan = await unaFila<{ plan: { sinMedicion: string[] } }>(
      admin,
      `select plan from negocio.planes_de_accion where org_id = $1 and departamento = 'conversation' and ventana = '7d'`,
      [org],
    );
    assert.deepEqual(plan!.plan.sinMedicion, ['en «Segunda 295», los patrones del auditor: la tarea del auditor no está al día']);
  } finally {
    await sello(y, 'auditoria', 'corrio');
  }
});

/** Una detección de prueba, con lo mínimo. */
const deteccion = (regla: string, tipo: Deteccion['entidad']['tipo'], id: string, evidencia: Record<string, unknown>): Deteccion => ({
  regla,
  entidad: { tipo, id },
  metrica: 'tasa_de_agenda',
  lineaBase: 0.5,
  valorActual: 0.2,
  cambioPct: null,
  muestra: 20,
  periodo: { desde: '2026-09-21', hasta: '2026-10-20' },
  datosDesde: null,
  gravedad: 'media',
  causasPosibles: [],
  revisionRecomendada: 'Revisa ese recorrido.',
  perdidaContactos: 16,
  destino: null,
  requiereValidacionEjecutiva: false,
  umbral: { valor: 0.15, provisional: true },
  evidencia: { ventana: '30d', ...evidencia },
});

test('el escritor deja sin medición sólo lo del cliente que no se midió, también lo del principal sin prefijo', async () => {
  const pasada = (detecciones: Deteccion[], deClientes: { regla: string; cuentaId: string }[]) =>
    conOrganizacion(org, () =>
      reconciliarSenales({ departamento: 'conversion', detector: 'conversion', ventana: '30d', detecciones, sinMedicion: [], sinMedicionDeClientes: deClientes }),
    );
  const familia = CNV.familiaQueNoAgenda;
  await pasada(
    [
      deteccion(familia, 'familia_de_entrada', 'landing', { familia: 'landing', cliente: p, contactos: 20, cohorte: 50 }),
      deteccion(familia, 'familia_de_entrada', `${y}:landing`, { familia: 'landing', cliente: y, contactos: 20, cohorte: 50 }),
      // Nacida con un solo cliente: no nombra a nadie, y es del principal.
      deteccion(CNV.cambioDeRuta, 'familia_de_entrada', 'widget', { familia: 'widget', ahora: { contactos: 10, cohorte: 50 }, antes: { contactos: 2, cohorte: 50 } }),
      deteccion(CNV.formularioSinDatos, 'funnel', `${y}:formulario`, { cliente: y, con: 1, sobre: 20 }),
    ],
    [],
  );
  // La pantalla: cada familia y el formulario con su cliente, sin uuid; la evidencia con el nombre.
  const lista = await conOrganizacion(org, () => senalesDeLaPantalla('conversion', '30d', textoDeConversion));
  assert.deepEqual(
    lista.map((s) => s.nombre).sort(),
    [`Landing con VSL (${nombreDeP})`, 'Landing con VSL (Segunda 295)', 'Widget de reserva', 'Formulario (Segunda 295)'].sort(),
  );
  for (const s of lista) assert.doesNotMatch(`${s.nombre} ${s.texto} ${JSON.stringify(s.evidencia)}`, UUID, s.entidad.id);
  assert.equal(lista.find((s) => s.entidad.id === `${y}:landing`)!.cliente, 'Segunda 295');

  // El conjunto de un cliente (Acquisition) no tiene nombre guardado: su id, con el nombre de su cliente.
  await conOrganizacion(org, () =>
    reconciliarSenales({
      departamento: 'acquisition',
      detector: 'acquisition',
      ventana: '7d',
      detecciones: [deteccion(ACQ.cambioBruscoConjunto, 'conjunto', 'cj295y', { conjunto: 'cj295y', cliente: y })],
      sinMedicion: [],
    }),
  );
  const conjuntos = await conOrganizacion(org, () => senalesDeLaPantalla('acquisition', '7d', textoDeAcquisition));
  assert.deepEqual(conjuntos.map((s) => s.nombre), ['Conjunto cj295y (Segunda 295)'], 'el conjunto de un cliente no dice de cuál es');

  // Ni Y ni el principal se midieron en las suyas: quedan sin medición; la de P, que sí se midió, se cierra sola.
  const r = await pasada([], [{ regla: familia, cuentaId: y }, { regla: CNV.cambioDeRuta, cuentaId: p }]);
  assert.equal(r.sinMedicion, 2);
  const estados = await admin.query<{ entidad_id: string; regla: string; estado: string }>(
    `select entidad_id, regla, estado from negocio.senales where org_id = $1 and departamento = 'conversion' order by entidad_id collate "C"`,
    [org],
  );
  assert.deepEqual(
    estados.rows.map((f) => [f.entidad_id, f.estado]),
    [
      ['landing', 'cerrada_sola'],
      ['widget', 'sin_medicion'],
      [`${y}:landing`, 'sin_medicion'],
      // El formulario de Y no está en la lista: se midió y no se detectó.
      [`${y}:formulario`, 'cerrada_sola'],
    ].sort((a, b) => (a[0]! < b[0]! ? -1 : 1)),
  );
});

test('la fuga de dos clientes no choca en la huella, y la pieza de nombre largo entra en la tabla', async () => {
  const m = medidaDeAcquisition({
    campanas: [campana('xp', 'profile'), campana('xl', 'leadform'), campana('yp', 'profile'), campana('yl', 'leadform')],
    actual: [['xl', { contactos: 100, agendados: 50 }], ['xp', { contactos: 100, agendados: 10 }], ['yl', { contactos: 100, agendados: 90 }], ['yp', { contactos: 100, agendados: 50 }]],
    previa: [],
    clienteDe: [['xl', p], ['xp', p], ['yl', y], ['yp', y]],
    principal: p,
  });
  const fugas = detectarEnAcquisition(m, umbral).detecciones.filter((d) => d.regla === ACQ.fugaEntreEtapas);
  assert.equal(fugas.length, 2);
  const r = await conOrganizacion(org, () => reconciliarSenales({ departamento: 'acquisition', detector: 'acquisition', ventana: '30d', detecciones: fugas, sinMedicion: [] }));
  assert.equal(r.nuevas, 2);

  const pieza = idDeLaPiezaEnUnaSenal(y, 'n'.repeat(190), p);
  const c = await conOrganizacion(org, () =>
    reconciliarSenales({
      departamento: 'creative',
      detector: 'creative',
      ventana: '30d',
      detecciones: [{ ...deteccion('CRE-CAIDA-DE-CTR', 'pieza', pieza, { creativo: 'n'.repeat(190), cliente: y }), muestra: 2000 }],
      sinMedicion: [],
    }),
  );
  assert.equal(c.nuevas, 1);
});

test('Conversion mide a cada cliente activo con su cohorte, su campo y su anterior', async () => {
  const m = await conOrganizacion(org, () => medirConversion('7d', ZONA));
  assert.deepEqual(m.porCliente?.map((c) => c.cuentaId).sort(), [p, y].sort(), 'se midió a un cliente en pausa, o a nadie por cliente');
  const de = (cuenta: string) => m.porCliente!.find((c) => c.cuentaId === cuenta)!;
  assert.deepEqual([de(p).recorrido.cohorte, de(y).recorrido.cohorte], [4, 5]);
  assert.deepEqual([de(p).formulario.campoDelFormulario, de(y).formulario.campoDelFormulario], [CAMPO_DEL_FORMULARIO, null]);
  // P tiene su anterior; Y, con la lectura de contactos fallando, no: y es el atrasado, y la regla se mide.
  assert.ok(de(p).anterior !== null);
  assert.equal(de(y).anterior, null);
  assert.equal(m.contactosAlDia, true);
  assert.deepEqual(m.atrasados, [{ id: y, nombre: 'Segunda 295' }]);
});

// ─── Los datos de un solo cliente, y otro activo sin nada ───────────────────

test('con los datos de un solo cliente y otro activo sin nada, el freno y la anterior son los del que tiene datos', async () => {
  /* Otra empresa: U, el principal, con contactos (uno viejo: su historia empieza antes de la anterior) y un hallazgo; V,
     activo, recién dado de alta, sin contactos ni hallazgos. Con un solo cliente con datos, los detectores no miden por
     cliente: lo de U se mide contra la empresa, que es él. */
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 295 de uno', $1, $2) returning id`,
    [SLUG_DE_UNO, ZONA],
  );
  assert.ok(o);
  const en = o.id;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [en]);
  const otra = await unaFila<{ id: string }>(admin, `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Sin datos 295', 'sin-datos-295') returning id`, [en]);
  assert.ok(principal && otra);
  const u = principal.id;
  const v = otra.id;
  await unContacto(u, 'k295u-viejo', 40, {}, {}, en);
  const deU: string[] = [];
  for (let i = 0; i < 3; i++) deU.push(await unContacto(u, `k295u-${i}`, 3, {}, {}, en));
  await hallazgos(u, deU[0]!, { agente: 'chat_post_agenda', patron: 'p295_uno', minutos: 30, en });
  const sellos = async (cuenta: string, estado: string) => {
    for (const tarea of ['contactos', 'citas', 'auditoria']) await sello(cuenta, tarea, estado, en);
  };
  const conversion = () => conOrganizacion(en, () => medirConversion('7d', ZONA));
  const conversation = () => conOrganizacion(en, () => medirConversation('7d', new Date()));

  /* V con el token revocado: sus lecturas fallan. La frescura de la empresa —el peor de los activos— dice «fallando»,
     y con ella la anterior de la pantalla no compara: el cambio de ruta de U quedaba sin medición todos los días. */
  await sellos(u, 'corrio');
  await sellos(v, 'fallo');
  let m = await conversion();
  assert.equal(m.porCliente, undefined);
  assert.equal(m.deUnCliente, u);
  assert.ok(m.anterior !== null, 'otro cliente sin contactos, con la lectura fallando, le apagó el cambio de ruta al que los tiene');
  assert.equal(m.contactosAlDia, true);
  assert.deepEqual(m.atrasados, [{ id: v, nombre: 'Sin datos 295' }]);
  let r = detectarEnConversion(m, umbral);
  assert.ok(!r.sinMedicion.includes(CNV.cambioDeRuta) && !r.sinMedicion.includes(CNV.familiaQueNoAgenda), r.sinMedicion.join(', '));
  assert.ok(r.sinMedicionDeClientes?.every((x) => x.cuentaId === v));
  let c = await conversation();
  assert.equal(c.auditorAlDia, true);
  assert.deepEqual(detectarEnConversation(c, umbral).sinMedicion, []);

  /* U atrasado y V al día: lo de U no se publica, y como es el único con datos, la regla entera queda sin medición —no
     sólo «lo de U»: un sello `saltada` o un cliente sin nada al día no hacen medible lo que U trajo tarde—. */
  await sellos(u, 'fallo');
  await sellos(v, 'corrio');
  m = await conversion();
  assert.equal(m.contactosAlDia, false, 'el principal atrasado publicó sus familias porque otro sin datos está al día');
  r = detectarEnConversion(m, umbral);
  assert.ok(r.sinMedicion.includes(CNV.familiaQueNoAgenda) && r.sinMedicion.includes(CNV.cambioDeRuta), r.sinMedicion.join(', '));
  assert.equal(r.sinMedicionDeClientes, undefined);
  assert.deepEqual([...r.detecciones, ...r.informativas].filter((d) => d.entidad.tipo === 'familia_de_entrada'), []);
  c = await conversation();
  assert.equal(c.auditorAlDia, false);
  assert.deepEqual(detectarEnConversation(c, umbral).sinMedicion, [CONV.patronAbierto], 'el principal atrasado publicó sus patrones');

  /* V sin ningún sello (el cron todavía no lo barrió) y U al día: V no es un atrasado, y el plan no lo nombra. */
  await sellos(u, 'corrio');
  await admin.query(`delete from negocio.tareas_programadas where org_id = $1 and cuenta_id = $2`, [en, v]);
  m = await conversion();
  assert.deepEqual(m.atrasados, [], 'un cliente sin ningún sello contó como atrasado');
  c = await conversation();
  assert.deepEqual(c.atrasados, []);
  await admin.query(`delete from negocio.planes_de_accion where org_id = $1`, [en]);
  const corrida = await correrLaPasada({ id: en, zonaHoraria: ZONA }, { ahora: aLas12(), detectores: [DETECTOR_DE_CONVERSATION] });
  assert.ok(corrida.tocaba);
  assert.deepEqual(corrida.departamentos.map((d) => [d.departamento, d.estado]), [['conversation', 'corrio']]);
  const plan = await unaFila<{ plan: { sinMedicion: string[] } }>(
    admin,
    `select plan from negocio.planes_de_accion where org_id = $1 and departamento = 'conversation' and ventana = '7d'`,
    [en],
  );
  assert.deepEqual(plan!.plan.sinMedicion, [], 'el plan nombró a un cliente que el cron todavía no barrió');
});
