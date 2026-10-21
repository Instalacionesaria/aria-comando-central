// LOS AVISOS DICEN DE QUÉ CLIENTE Y QUÉ HACER. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C6 · D1)
//
// Con varios clientes, un cliente activo sin su conexión con GoHighLevel dejaba la agenda de la empresa diciendo
// «Todavía no se leyó el calendario» para siempre, y Acquisition decía «Faltan días de gasto.» sin decir de quién ni
// por qué. La decisión del usuario (2026-10-20): el aviso dice de qué cliente es y qué hacer. Los textos puros los mira
// la 291; acá, con la base. Cada afirmación dice la mutación que la pone en rojo:
//
//   · la agenda nombra al cliente con su sello `saltada` —el suyo, no el sin cuenta—, con el texto de su código —
//     mutaciones: no leer el sello, leer sólo el sin cuenta;
//   · sin sello, el texto de siempre, letra por letra — mutación: no contar como «no se leyó» al que no se sabe;
//   · otro activo sin leer: el texto de siempre con el aviso al final — mutación: sólo el aviso;
//   · un pulso posterior al sello lo saca de la lista — mutación: no comparar contra el pulso;
//   · con pulso y la conexión rota, la agenda vacía no dice «se leyó completo» — mutación: mirar sólo a los sin pulso;
//   · con citas, viaja `sinConexion`; con un solo cliente, nada cambia ni aparece la clave — mutación: nombrar siempre
//     al principal;
//   · el foco y el alcance: a un closer vinculado sólo en otro cliente no se le dice, con la agenda vacía y con sus
//     citas a la vista; al vinculado en ese cliente, sí — mutaciones: no filtrar por alcance, la agenda con citas sin
//     filtrar, callárselo a todo closer vinculado;
//   · la cabecera de Mi Día lo dice DESPUÉS de las citas sin registrar — mutación: ponerlo antes;
//   · la ficha dice lo del cliente del contacto — mutación: los clientes de la empresa;
//   · Leads lo dice arriba, y al cliente final sin Ajustes — mutación: el texto de la empresa al cliente final;
//   · Acquisition y Conversion nombran al cliente que deja el gasto incompleto, con su porqué, también cuando su serie
//     dejó de escribirse (el colector atrasado) y cuando la ventana que lo decide es la anterior —por un cliente que
//     pautó en ella sin serie, o por la cobertura de su gasto— — mutaciones: listar al que no se sabe por qué, sin la
//     serie atrasada, sin el que no está activo, la ventana actual siempre, la actual cuando decide la cobertura;
//   · el alta, la activación y las dos listas dicen qué closers no ven a un cliente, sólo a la empresa misma —
//     mutaciones: contar a los que ven todo, la plataforma recibe los nombres, `sinVincular` con un solo cliente; y el
//     cliente de la lista que los nombra no pierde su lista de chequeo (D5) — mutación: los closers sin la lista.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { TEXTO_DE_FALTA_GHL, TEXTO_DE_FALTA_GHL_DEL_CLIENTE, type FaltaParaGhl } from '../../lib/credenciales/resolver.ts';
import { LO_RESUELVE_LA_EMPRESA, MOTIVO_SIN_META_EN_GHL, avisoSinConexion, faltaDelGastoDe } from '../../lib/negocio/faltaDeLosClientes.ts';
import { agendaDelCloser, porQueNoHayCitasHoy, type Agenda } from '../../lib/negocio/agenda.ts';
import type { AlcanceDelCloser } from '../../lib/negocio/alcanceDelCloser.ts';
import { comentarioDelCloser } from '../../lib/agentes/cabecera.ts';
import { mensajesDeLaFicha } from '../../lib/negocio/ficha.ts';
import { lecturaDeAcquisition } from '../../lib/negocio/embudosDeAcquisition.ts';
import { lecturaDeConversion } from '../../lib/negocio/pasosDeConversion.ts';
import { asignarCloser } from '../../lib/negocio/closer.ts';
import { ejecutarHerramienta, herramientasPara } from '../../lib/agentes/executive/herramientas.ts';
import { SIN_DATOS_DE_LA_RUTA } from '../../lib/agentes/executive/adaptadores/comun.ts';
import { GET as leads } from '../../app/api/leads-portal/route.ts';
import { GET as listarClientes, POST as crearCliente } from '../../app/api/admin/cuentas/route.ts';
import { PATCH as editarCliente } from '../../app/api/admin/cuentas/[id]/route.ts';
import { GET as estadoDelCloser } from '../../app/api/admin/closer/route.ts';

const ZONA = 'America/Lima';
const PERIODO = { clave: '7d', dias: 7 } as const;
const HORA = 3600_000;
const GENERICO =
  'Todavía no se leyó el calendario de GoHighLevel. Puede haber citas agendadas: lo que falta es el barrido que las ' +
  'copia acá. Usá «Traer del calendario».';

let admin: Client;

/** Una empresa de la prueba: su principal, y los clientes que se le agregan. */
interface Empresa {
  slug: string;
  nombre: string;
  org: string;
  p: string;
  nombreP: string;
  y: string;
  z: string;
  w: string;
}
const nueva = (slug: string, nombre: string): Empresa => ({ slug, nombre, org: '', p: '', nombreP: '', y: '', z: '', w: '' });
/** G: la agenda, la ficha y Leads. P, Y (sin conexión) y Z. */
const g = nueva('gamma-290', 'Gamma 290');
/** U: un solo cliente, el principal. Lo que con uno tiene que ser lo de siempre. */
const u = nueva('gamma-290-uno', 'Gamma 290 uno');
/** A: el gasto. P con su Meta, Y pauta sin Meta, W en pausa. */
const a = nueva('gamma-290-gasto', 'Gamma 290 gasto');
/** B: el colector atrasado. P con su Meta; la serie de Y dejó de escribirse hace cuatro días. */
const b = nueva('gamma-290-atraso', 'Gamma 290 atraso');
/** S: el colector atrasado sin días faltantes: Y tuvo métricas hace tres semanas y nunca una serie. En UTC, para que el
    día de ayer esté cerrado a cualquier hora. */
const s = nueva('gamma-290-sin-serie', 'Gamma 290 sin serie');
/** K: los closers. */
const k = nueva('gamma-290-closers', 'Gamma 290 closers');
/** H: la ventana anterior decide. P con su Meta entera; la serie de Y, entera en la ventana actual y con un hueco en la
    anterior. */
const h = nueva('gamma-290-anterior', 'Gamma 290 anterior');
const TODAS = [g, u, a, b, s, k, h];

const foco = (e: Empresa, cuenta: string) => ({ orgId: e.org, todaLaOrganizacion: true, cuentas: [cuenta] }) as const;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const TODO: AlcanceDelCloser = { tipo: 'todo' };
const mio = (cuenta: string): AlcanceDelCloser => ({ tipo: 'mio', usuarioId: '00000000-0000-0000-0000-000000000290', vinculos: [{ cuentaId: cuenta, crmUsuarioId: 'u290' }] });

/** El aviso esperado de un cliente que no es el principal. */
const deY = (que: FaltaParaGhl, pantalla: 'calendario' | 'mensajes' | 'datos', final = false) =>
  avisoSinConexion([{ nombre: 'Segunda 290', esPorOmision: false, que }], pantalla, final)!;

async function limpiar(slug: string): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [slug]);
  if (!o) return;
  for (const t of [
    'senales', 'planes_de_accion', 'funnels_de_campana', 'metricas_de_anuncio', 'anuncios', 'gasto_de_la_cuenta', 'campanas',
    'mensajes', 'citas', 'contactos', 'ingesta_pulso', 'tareas_programadas', 'closer_asignado',
  ]) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  for (const t of ['sesiones', 'usuarios_secciones', 'usuarios_roles', 'usuarios_cuentas']) {
    await admin.query(`delete from identidad.${t} where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  }
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

async function crear(e: Empresa, otros: { y?: boolean; z?: boolean; w?: boolean } = {}, zona = ZONA): Promise<void> {
  await limpiar(e.slug);
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ($1, $2, $3) returning id`,
    [e.nombre, e.slug, zona],
  );
  assert.ok(o);
  e.org = o.id;
  const principal = await unaFila<{ id: string; nombre: string }>(admin, `select id, nombre from identidad.cuentas where org_id = $1 and es_por_omision`, [e.org]);
  assert.ok(principal);
  e.p = principal.id;
  e.nombreP = principal.nombre;
  const otro = async (nombre: string, slug: string, estado = 'activa') => {
    const f = await unaFila<{ id: string }>(
      admin,
      `insert into identidad.cuentas (org_id, nombre, slug, estado) values ($1, $2, $3, $4) returning id`,
      [e.org, nombre, `${slug}-${e.slug}`, estado],
    );
    assert.ok(f);
    return f.id;
  };
  if (otros.y) e.y = await otro('Segunda 290', 'segunda');
  if (otros.z) e.z = await otro('Tercera 290', 'tercera');
  if (otros.w) e.w = await otro('Pausada 290', 'pausada', 'pausada');
}

/** El sello de una tarea de un cliente, hace `minutos`. */
async function sello(e: Empresa, cuenta: string | null, tarea: string, estado: string, motivo: string | null, minutos: number): Promise<void> {
  await admin.query(
    `insert into negocio.tareas_programadas (org_id, cuenta_id, tarea, ultima_corrida_el, ultimo_estado, ultimo_motivo)
     values ($1, $2, $3, now() - make_interval(mins => $4), $5, $6)
     on conflict (org_id, cuenta_id, tarea) do update
       set ultima_corrida_el = excluded.ultima_corrida_el, ultimo_estado = excluded.ultimo_estado, ultimo_motivo = excluded.ultimo_motivo`,
    [e.org, cuenta, tarea, minutos, estado, motivo],
  );
}
const sinSellos = (e: Empresa, cuenta: string) =>
  admin.query(`delete from negocio.tareas_programadas where org_id = $1 and cuenta_id = $2`, [e.org, cuenta]);

/** El pulso de una traída de un cliente, hace `minutos`, con la vuelta terminada. */
async function pulso(e: Empresa, cuenta: string, clave: string, minutos: number): Promise<void> {
  await admin.query(
    `insert into negocio.ingesta_pulso (org_id, cuenta_id, clave, marca_el, ultima_corrida_el, atrasado)
     values ($1, $2, $3, now(), now() - make_interval(mins => $4), false)
     on conflict (org_id, cuenta_id, clave) do update set ultima_corrida_el = excluded.ultima_corrida_el, atrasado = false`,
    [e.org, cuenta, clave, minutos],
  );
}
const sinPulso = (e: Empresa, cuenta: string, clave: string) =>
  admin.query(`delete from negocio.ingesta_pulso where org_id = $1 and cuenta_id = $2 and clave = $3`, [e.org, cuenta, clave]);

async function contacto(e: Empresa, cuenta: string, ghl: string, territorio = 'closer', atribucion: Record<string, string> | null = null, haceDias = 3): Promise<string> {
  const f = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera)
     values ($1, $2, $3, $4, $5, now() - make_interval(days => $6), coalesce($7::jsonb, '{}'::jsonb)) returning id`,
    [e.org, cuenta, ghl, `Contacto ${ghl}`, territorio, haceDias, atribucion === null ? null : JSON.stringify(atribucion)],
  );
  assert.ok(f);
  return f.id;
}

async function cita(e: Empresa, cuenta: string, contactoId: string, inicio: Date): Promise<string> {
  const f = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.citas (org_id, cuenta_id, ghl_evento_id, contacto_id, inicio_el, fin_el, estado_ghl, ghl_calendario_id, titulo)
     values ($1, $2, $3, $4, $5, $5::timestamptz + interval '30 minutes', 'confirmed', 'cal-290', 'Cita 290') returning id`,
    [e.org, cuenta, `ev-290-${contactoId}-${inicio.getTime()}`, contactoId, inicio],
  );
  assert.ok(f);
  return f.id;
}

async function mensaje(e: Empresa, cuenta: string, contactoId: string, ghl: string): Promise<void> {
  await admin.query(
    `insert into negocio.mensajes (org_id, cuenta_id, contacto_id, ghl_mensaje_id, direccion, autor, cuerpo, enviado_el)
     values ($1, $2, $3, $4, 'entrante', 'contacto', 'Hola 290', now() - interval '1 hour')`,
    [e.org, cuenta, contactoId, ghl],
  );
}

/** Una persona con un rol de sistema; con cuentas, es un cliente final. */
async function persona(e: Empresa, nombre: string, rol: string, cuentas: string[] = [], secciones: string[] = []): Promise<string> {
  const f = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.usuarios (org_id, nombre, limitado_a_cuentas) values ($1, $2, $3) returning id`,
    [e.org, nombre, cuentas.length > 0],
  );
  assert.ok(f);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = $2 and org_id is null`,
    [f.id, rol],
  );
  for (const s of secciones) await admin.query(`insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, $2)`, [f.id, s]);
  for (const c of cuentas) {
    await admin.query(`insert into identidad.usuarios_cuentas (org_id, usuario_id, cuenta_id) values ($1, $2, $3)`, [e.org, f.id, c]);
  }
  return f.id;
}

/** Un anuncio con sus métricas y su serie, de hace 20 días a `hasta` días atrás, salvo los días de `hueco`; la serie,
    leída hace `leidaHaceDias`. */
async function pauta(e: Empresa, cuenta: string, anuncio: string, campana: string, hasta = 2, leidaHaceDias = 0, hueco: readonly number[] = []): Promise<void> {
  await admin.query(
    `insert into negocio.anuncios (org_id, cuenta_id, meta_anuncio_id, meta_campana_id, nombre) values ($1, $2, $3, $4, $3)`,
    [e.org, cuenta, anuncio, campana],
  );
  for (let atras = 20; atras >= hasta; atras--) {
    if (hueco.includes(atras)) continue;
    await admin.query(
      `insert into negocio.metricas_de_anuncio (org_id, cuenta_id, meta_anuncio_id, fecha, gasto, impresiones, acciones)
       values ($1, $2, $3, current_date - $4::int, 100, 1000, '{"landingPageView": 5, "linkClick": 3}'::jsonb)`,
      [e.org, cuenta, anuncio, atras],
    );
    await admin.query(
      `insert into negocio.gasto_de_la_cuenta (org_id, cuenta_id, fecha, gasto, leido_el)
       values ($1, $2, current_date - $3::int, 100, now() - make_interval(days => $4))`,
      [e.org, cuenta, atras, leidaHaceDias],
    );
  }
}

let tokenG: string;
let tokenClienteFinal: string;
let tokenU: string;
let tokenK: string;
let tokenAria: string;
const cG: Record<'p' | 'y' | 'y2', string> = { p: '', y: '', y2: '' };
const closers = { alfa: '', be: '', ce: '' };

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');

  // G: P y Z con el calendario leído; Y activo, sin pulso, con sus tareas del CRM saltadas por el token.
  await crear(g, { y: true, z: true });
  await pulso(g, g.p, 'citas', 5);
  await pulso(g, g.z, 'citas', 5);
  for (const t of ['contactos', 'citas', 'mensajes']) await sello(g, g.y, t, 'saltada', 'sin_token', 3);
  await sello(g, g.p, 'citas', 'corrio', null, 2);
  await sello(g, g.z, 'citas', 'corrio', null, 2);
  cG.p = await contacto(g, g.p, 'c290p');
  cG.y = await contacto(g, g.y, 'c290y');
  cG.y2 = await contacto(g, g.y, 'c290y2');
  await mensaje(g, g.p, cG.p, 'm290p');
  await mensaje(g, g.y, cG.y2, 'm290y2');
  tokenG = await sesionDe(await persona(g, 'Admin 290', 'administrador'));
  tokenClienteFinal = await sesionDe(await persona(g, 'Cliente final 290', 'usuario', [g.y], ['contacts']));

  // U: el principal solo, sin pulso y con su token saltado.
  await crear(u);
  for (const t of ['contactos', 'citas']) await sello(u, u.p, t, 'saltada', 'sin_token', 3);
  tokenU = await sesionDe(await persona(u, 'Admin 290 uno', 'administrador'));

  // A: P con su Meta entera y su historia de contactos; Y pauta sin Meta (contactos de campaña de hace tres días).
  await crear(a, { y: true, w: true });
  await pauta(a, a.p, 'a290p', '2900001');
  await contacto(a, a.p, 'a290p-1', 'setter', { campaignId: '2900001', campaign: 'Siempre' }, 40);
  for (let i = 0; i < 3; i++) await contacto(a, a.y, `a290y-${i}`, 'setter', { campaignId: '2900002', campaign: 'Lanzamiento' }, 3);

  // B: P con su Meta entera; la serie de Y llega hasta hace cinco días y se leyó por última vez hace cuatro.
  await crear(b, { y: true });
  await pauta(b, b.p, 'b290p', '2900101');
  await contacto(b, b.p, 'b290p-1', 'setter', { campaignId: '2900101', campaign: 'Siempre' }, 40);
  await pauta(b, b.y, 'b290y', '2900102', 5, 4);

  // S: P con su Meta entera hasta ayer; Y con métricas de hace tres semanas y ninguna serie.
  await crear(s, { y: true }, 'UTC');
  await pauta(s, s.p, 's290p', '2900301', 1);
  await contacto(s, s.p, 's290p-1', 'setter', { campaignId: '2900301', campaign: 'Siempre' }, 40);
  await admin.query(
    `insert into negocio.anuncios (org_id, cuenta_id, meta_anuncio_id, meta_campana_id, nombre) values ($1, $2, 's290y', '2900302', 's290y')`,
    [s.org, s.y],
  );
  await admin.query(
    `insert into negocio.metricas_de_anuncio (org_id, cuenta_id, meta_anuncio_id, fecha, gasto, impresiones, acciones)
     select $1, $2, 's290y', f::date, 50, 500, '{"landingPageView": 2}'::jsonb
       from generate_series(current_date - 21, current_date - 15, interval '1 day') f`,
    [s.org, s.y],
  );

  // K: los closers. Alfa sólo en P; Be designado sin vínculo (ve todo); Ce en P y en Y.
  await crear(k, { y: true });
  const jefe = await persona(k, 'Jefe 290', 'administrador');
  tokenK = await sesionDe(jefe);
  closers.alfa = await persona(k, 'Alfa 290', 'usuario', [], ['closer']);
  closers.be = await persona(k, 'Be 290', 'usuario', [], ['closer']);
  closers.ce = await persona(k, 'Ce 290', 'usuario', [], ['closer']);
  await conOrganizacion(k.org, async () => {
    assert.equal(await asignarCloser(closers.alfa, 'uA', jefe, k.p), null);
    assert.equal(await asignarCloser(closers.be, null, jefe, k.p), null);
    assert.equal(await asignarCloser(closers.ce, 'uC', jefe, k.p), null);
    assert.equal(await asignarCloser(closers.ce, 'uC2', jefe, k.y), null);
  });

  /* H: las dos series hasta anteayer, así que la ventana de «7 días» va de hace ocho a hace dos y la anterior, de hace
     quince a hace nueve. A Y le faltan los días 10 a 12: sólo la anterior queda sin su gasto entero. */
  await crear(h, { y: true });
  await pauta(h, h.p, 'h290p', '2900401');
  await pauta(h, h.y, 'h290y', '2900402', 2, 0, [10, 11, 12]);
  const aria = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email = 'fundadora@principal.ejemplo'`);
  assert.ok(aria, 'falta el sembrado');
  tokenAria = await sesionDe(aria.id);
});

after(async () => {
  try {
    await admin.query(
      `delete from identidad.sesiones where usuario_id = (select id from identidad.usuarios where email = 'fundadora@principal.ejemplo')
         and creada_el > now() - interval '1 hour' and cuenta_activa is null and org_activa is null`,
    );
    for (const e of TODAS) await limpiar(e.slug);
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

const agenda = (ambito: Parameters<typeof conOrganizacion>[0], alcance: AlcanceDelCloser = TODO): Promise<Agenda> =>
  conOrganizacion(ambito, () => agendaDelCloser('closer', ZONA, { alcance }));

test('la agenda nombra al cliente sin conexión con el texto de su código, y sin sello dice lo de siempre', async () => {
  const conY = await agenda(g.org);
  assert.equal(conY.falta, deY('sin_token', 'calendario'), 'la agenda no dice de qué cliente es lo que falta');
  assert.ok(conY.falta?.includes(TEXTO_DE_FALTA_GHL_DEL_CLIENTE.sin_token), 'no dice qué hacer');
  assert.ok(!('sinConexion' in conY), 'con la agenda vacía lo dice `falta`, no hace falta repetirlo');
  // Mi Día lo hereda: el cero de hoy, con el mismo texto.
  assert.equal(await conOrganizacion(g.org, () => porQueNoHayCitasHoy('closer', ZONA)), deY('sin_token', 'calendario'));

  // Sin ningún sello de Y no se sabe por qué no se leyó: lo de siempre, letra por letra.
  await sinSellos(g, g.y);
  try {
    assert.equal((await agenda(g.org)).falta, GENERICO, 'sin sello, el aviso dijo algo que no se sabe');
  } finally {
    for (const t of ['contactos', 'citas', 'mensajes']) await sello(g, g.y, t, 'saltada', 'sin_token', 3);
  }

  // Y sin conexión y Z sin leer: lo de siempre, con el aviso de Y al final.
  await sinPulso(g, g.z, 'citas');
  try {
    assert.equal((await agenda(g.org)).falta, `${GENERICO} ${deY('sin_token', 'calendario')}`, 'con otro cliente sin leer, se perdió uno de los dos');
  } finally {
    await pulso(g, g.z, 'citas', 5);
  }
});

test('un pulso posterior al sello saca al cliente del aviso; con pulso y la conexión rota, no dice «se leyó completo»', async () => {
  // Alguien cargó la conexión y trajo los mensajes después del sello: ya no se dice que falta. Sus citas siguen sin leer.
  await pulso(g, g.y, 'mensajes', 1);
  try {
    assert.equal((await agenda(g.org)).falta, GENERICO, 'el aviso siguió después de que la conexión se cargó');
  } finally {
    await sinPulso(g, g.y, 'mensajes');
  }

  // Un token revocado: el calendario de Y se leyó antes, y su sello más nuevo es `saltada`.
  await pulso(g, g.y, 'citas', 60);
  await sello(g, g.y, 'contactos', 'saltada', 'token_revocado', 1);
  try {
    const r = await agenda(g.org);
    assert.equal(r.falta, deY('token_revocado', 'calendario'), 'con el token revocado, la agenda vacía dijo que se leyó completa');
    // Un sello que no dice nada del acceso (sin tiempo) no lo tapa.
    await sello(g, g.y, 'mensajes', 'sin_tiempo', 'se agotó el presupuesto de la corrida', 0);
    assert.equal((await agenda(g.org)).falta, deY('token_revocado', 'calendario'), 'una corrida sin tiempo sacó al cliente del aviso');
  } finally {
    await sinPulso(g, g.y, 'citas');
    for (const t of ['contactos', 'citas', 'mensajes']) await sello(g, g.y, t, 'saltada', 'sin_token', 3);
  }
});

test('con citas viaja `sinConexion`; con un solo cliente no cambia nada', async () => {
  const ids = [await cita(g, g.p, cG.p, new Date(Date.now() + 24 * HORA))];
  /* Los contactos, del usuario del CRM de `mio`: sin él, el corte del alcance (`contactoDelCloser`) deja la cita afuera,
     la agenda del closer sale vacía y `sinConexion` ni se calcula. */
  await admin.query(`update negocio.contactos set crm_asignado_a = 'u290' where id = any($1::uuid[])`, [[cG.p, cG.y]]);
  try {
    const r = await agenda(g.org);
    assert.equal(r.total, 1);
    assert.equal(r.falta, null);
    assert.equal(r.sinConexion, deY('sin_token', 'calendario'), 'con citas a la vista, no se dice que faltan las de un cliente');
    // A un closer vinculado sólo en P no se le dice lo de Y: no lo ve ni lo arregla.
    const soloP = await agenda(g.org, mio(g.p));
    assert.equal(soloP.total, 1, 'el closer de P no ve su cita: lo que sigue no mediría nada');
    assert.ok(!('sinConexion' in soloP), 'el closer de otro cliente recibe el aviso de Y');
    // Vinculado en Y, sí: con una cita de Y a la vista, que las suyas no se están leyendo.
    ids.push(await cita(g, g.y, cG.y, new Date(Date.now() + 26 * HORA)));
    const soloY = await agenda(g.org, mio(g.y));
    assert.equal(soloY.total, 1, 'el closer de Y no ve su cita');
    assert.equal(soloY.sinConexion, deY('sin_token', 'calendario'), 'al closer de Y no se le dijo que faltan las citas de su cliente');
  } finally {
    await admin.query(`delete from negocio.citas where id = any($1::uuid[])`, [ids]);
    await admin.query(`update negocio.contactos set crm_asignado_a = null where id = any($1::uuid[])`, [[cG.p, cG.y]]);
  }

  // Un solo cliente, con su token saltado: el texto de siempre, sin nombrarlo, y sin la clave nueva.
  assert.equal((await agenda(u.org)).falta, GENERICO, 'con un solo cliente cambió el aviso');
  const cU = await contacto(u, u.p, 'c290u');
  await cita(u, u.p, cU, new Date(Date.now() + 24 * HORA));
  const conCita = await agenda(u.org);
  assert.equal(conCita.total, 1);
  assert.ok(!('sinConexion' in conCita), 'con un solo cliente apareció `sinConexion`');
});

test('el foco y el alcance: se dice sólo a quien le toca', async () => {
  assert.equal((await agenda(foco(g, g.y))).falta, deY('sin_token', 'calendario'), 'con el foco en Y no se lo nombra');
  const deP = await agenda(foco(g, g.p));
  assert.ok(!deP.falta?.includes('Segunda 290'), 'con el foco en P se nombró a Y');
  const soloP = await agenda(g.org, mio(g.p));
  assert.ok(!soloP.falta?.includes('Segunda 290'), 'a un closer vinculado sólo en P se le dijo lo de Y');
  assert.equal((await agenda(g.org, mio(g.y))).falta, deY('sin_token', 'calendario'), 'al closer de Y no se le dijo');
});

test('la cabecera de Mi Día lo dice, después de las citas sin registrar', async () => {
  const c = await conOrganizacion(g.org, () => comentarioDelCloser(TODO));
  assert.deepEqual(c, { texto: deY('sin_token', 'calendario'), fuente: 'configurar' }, 'la cabecera no dice de qué cliente es');
  assert.equal(await conOrganizacion(g.org, () => comentarioDelCloser(mio(g.p))), null, 'al closer de otro cliente se le dijo');

  // Una cita que ya ocurrió y nadie registró: eso se puede hacer ya, y va primero.
  const id = await cita(g, g.p, cG.p, new Date(Date.now() - 2 * HORA));
  try {
    const conRegla = await conOrganizacion(g.org, () => comentarioDelCloser(TODO));
    assert.equal(conRegla?.fuente, 'regla', 'el aviso de la conexión tapó las citas sin registrar');
  } finally {
    await admin.query(`delete from negocio.citas where id = $1`, [id]);
  }
  // Con un solo cliente, lo de siempre: nada.
  assert.equal(await conOrganizacion(u.org, () => comentarioDelCloser(TODO)), null);
});

test('la ficha dice lo del cliente del contacto', async () => {
  const vacia = await conOrganizacion(g.org, () => mensajesDeLaFicha(cG.y));
  assert.equal(vacia.filas.length, 0);
  assert.equal(vacia.falta, deY('sin_token', 'mensajes'), 'el chat vacío de un contacto de Y no dice por qué');
  const llena = await conOrganizacion(g.org, () => mensajesDeLaFicha(cG.y2));
  assert.equal(llena.filas.length, 1);
  assert.equal(llena.sinConexion, deY('sin_token', 'mensajes'), 'el chat lleno de Y no dice que lo nuevo no entra');
  const deP = await conOrganizacion(g.org, () => mensajesDeLaFicha(cG.p));
  assert.ok(!('sinConexion' in deP), 'la ficha de P recibió lo de Y');
});

test('Leads lo dice arriba, y al cliente final sin Ajustes', async () => {
  const pedir = async (token: string) =>
    (await leerRespuesta<{ conexion?: string; frescura: object }>(await leads(pedirComo('/api/leads-portal?periodo=30d', token)))).cuerpo;
  const empresa = await pedir(tokenG);
  assert.equal(empresa.conexion, deY('sin_token', 'datos'), 'Leads de la empresa no dice de qué cliente faltan los datos');
  assert.deepEqual(Object.keys(empresa.frescura).sort(), ['citas', 'contactos'], 'el aviso entró a `frescura`');

  const final = await pedir(tokenClienteFinal);
  assert.equal(final.conexion, deY('sin_token', 'datos', true), 'el cliente final no recibe su aviso');
  assert.ok(final.conexion?.endsWith(LO_RESUELVE_LA_EMPRESA));
  assert.doesNotMatch(final.conexion ?? '', /Ajustes/, 'al cliente final se lo mandó a Ajustes');

  // Con el foco: en Y, lo suyo; en P, nada.
  const enfocar = async (cuenta: string) => {
    const t = await sesionDe((await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where org_id = $1 and nombre = 'Admin 290'`, [g.org]))!.id);
    await admin.query(`update identidad.sesiones set cuenta_activa = $1 where token_hash = $2`, [cuenta, hashDeToken(t)]);
    return t;
  };
  assert.equal((await pedir(await enfocar(g.y))).conexion, deY('sin_token', 'datos'));
  assert.ok(!('conexion' in (await pedir(await enfocar(g.p)))), 'con el foco en P se dijo lo de Y');
  // Con un solo cliente, la clave no viaja.
  assert.ok(!('conexion' in (await pedir(tokenU))), 'con un solo cliente apareció `conexion`');
});

test('Acquisition nombra al cliente que deja el gasto incompleto, sólo cuando sabe por qué', async () => {
  const leer = () => conOrganizacion(a.org, () => lecturaDeAcquisition(PERIODO, ZONA));
  // Sin sellos no se sabe por qué: la nota de siempre.
  assert.deepEqual((await leer()).embudos.gasto, { deLaCuenta: null, motivo: 'dias_sin_leer' }, 'se nombró a un cliente sin saber por qué');

  // La pasada del gasto de Y corrió sin Meta vinculado en su GoHighLevel.
  await sello(a, a.y, 'anuncios', 'corrio', MOTIVO_SIN_META_EN_GHL, 30);
  const sinMeta = await leer();
  assert.equal(sinMeta.embudos.sinCostos, 'gasto_incompleto');
  assert.deepEqual(sinMeta.embudos.gasto.faltaPorCliente, [{ cliente: 'Segunda 290', falta: 'meta_sin_vincular' }]);

  // Su conexión no está lista: lo más nuevo de sus tareas del CRM es `saltada`.
  await sello(a, a.y, 'contactos', 'saltada', 'sin_subcuenta', 5);
  assert.deepEqual((await leer()).embudos.gasto.faltaPorCliente, [
    { cliente: 'Segunda 290', falta: 'sin_conexion', que: 'sin_subcuenta', detalle: TEXTO_DE_FALTA_GHL_DEL_CLIENTE.sin_subcuenta },
  ]);
  // El principal, con el texto de la empresa.
  await sello(a, a.p, 'contactos', 'saltada', 'token_vencido', 1);
  try {
    assert.deepEqual(await conOrganizacion(a.org, () => faltaDelGastoDe([a.p])), [
      { cliente: a.nombreP, falta: 'sin_conexion', que: 'token_vencido', detalle: TEXTO_DE_FALTA_GHL.token_vencido },
    ]);
  } finally {
    await sinSellos(a, a.p);
  }

  // Uno en pausa que pautó en la ventana: no se lee, y se dice.
  await contacto(a, a.w, 'a290w', 'setter', { campaignId: '2900003', campaign: 'Pausa' }, 3);
  try {
    assert.deepEqual(
      (await leer()).embudos.gasto.faltaPorCliente?.map((f) => [f.cliente, f.falta]),
      [
        ['Pausada 290', 'no_activo'],
        ['Segunda 290', 'sin_conexion'],
      ],
      'el cliente en pausa que frena los costos no se nombra',
    );
  } finally {
    await admin.query(`delete from negocio.contactos where org_id = $1 and cuenta_id = $2`, [a.org, a.w]);
  }

  // Con el foco en P, P está entero y nada se nombra.
  assert.deepEqual((await conOrganizacion(foco(a, a.p), () => lecturaDeAcquisition(PERIODO, ZONA))).embudos.gasto, { deLaCuenta: 700, motivo: null });

  // El cerebro: la misma lista, en `gasto`.
  const contexto = { zona: ZONA, usuarioId: '00000000-0000-0000-0000-000000000000', secciones: ['acquisition'], deLaRuta: SIN_DATOS_DE_LA_RUTA };
  const r = await conOrganizacion(a.org, () => ejecutarHerramienta('embudos_de_acquisition', { periodo: '7d' }, herramientasPara(['acquisition']), contexto));
  const datos = (r as { datos: { gasto: { faltaPorCliente?: { cliente: string; falta: string }[] } } }).datos;
  assert.deepEqual(datos.gasto.faltaPorCliente?.map((f) => f.falta), ['sin_conexion'], 'el cerebro no recibe de qué cliente falta el gasto');
  await sinSellos(a, a.y);
});

test('con un solo cliente, Acquisition no nombra a nadie aunque el sello lo sepa', async () => {
  await contacto(u, u.p, 'u290p-1', 'setter', { campaignId: '2900201', campaign: 'Única' }, 3);
  await sello(u, u.p, 'anuncios', 'corrio', MOTIVO_SIN_META_EN_GHL, 30);
  const r = await conOrganizacion(u.org, () => lecturaDeAcquisition(PERIODO, ZONA));
  assert.equal(r.embudos.sinCostos, 'gasto_incompleto');
  assert.ok(!('faltaPorCliente' in r.embudos.gasto), 'con un solo cliente la nota cambió');
});

test('la serie que dejó de escribirse: el colector atrasado también nombra al cliente', async () => {
  await sello(b, b.y, 'anuncios', 'corrio', MOTIVO_SIN_META_EN_GHL, 30);
  const r = await conOrganizacion(b.org, () => lecturaDeAcquisition(PERIODO, ZONA));
  assert.equal(r.embudos.gasto.motivo, 'colector_atrasado');
  assert.deepEqual(r.embudos.gasto.faltaPorCliente, [{ cliente: 'Segunda 290', falta: 'meta_sin_vincular' }], 'con la serie atrasada, la nota no dice de quién');
  // Conversion, con el mismo motivo.
  const v = (await conOrganizacion(b.org, () => lecturaDeConversion(PERIODO, ZONA))).pasos.cifras.vistas;
  assert.equal(v.motivo, 'colector_atrasado');
  assert.deepEqual(v.faltaPorCliente, [{ cliente: 'Segunda 290', falta: 'meta_sin_vincular' }]);

  /* Métricas viejas y ninguna serie: la empresa queda atrasada con la ventana entera —el gasto de la ventana no dice
     nada—, y la nota tiene que nombrarlo igual. */
  await sello(s, s.y, 'anuncios', 'corrio', MOTIVO_SIN_META_EN_GHL, 30);
  const sinSerie = await conOrganizacion(s.org, () => lecturaDeAcquisition(PERIODO, 'UTC'));
  assert.equal(sinSerie.embudos.gasto.motivo, 'colector_atrasado');
  assert.equal(sinSerie.embudos.sinCostos, 'gasto_incompleto');
  assert.deepEqual(sinSerie.embudos.gasto.faltaPorCliente, [{ cliente: 'Segunda 290', falta: 'meta_sin_vincular' }], 'con la ventana entera y la serie atrasada, la nota no dice de quién');
});

test('Conversion nombra al cliente de la ventana que decidió el motivo, la actual o la anterior', async () => {
  await sello(a, a.y, 'anuncios', 'corrio', MOTIVO_SIN_META_EN_GHL, 30);
  try {
    const actual = (await conOrganizacion(a.org, () => lecturaDeConversion(PERIODO, ZONA))).pasos.cifras.vistas;
    assert.equal(actual.motivo, 'dias_sin_leer');
    assert.deepEqual(actual.faltaPorCliente, [{ cliente: 'Segunda 290', falta: 'meta_sin_vincular' }]);

    // Los contactos de Y, en la ventana anterior: la actual está entera y la anterior no compara por Y.
    await admin.query(`update negocio.contactos set alta_en_el_crm = now() - interval '10 days' where org_id = $1 and cuenta_id = $2`, [a.org, a.y]);
    const anterior = (await conOrganizacion(a.org, () => lecturaDeConversion(PERIODO, ZONA))).pasos.cifras.vistas;
    assert.equal(anterior.motivo, 'dias_sin_leer');
    assert.deepEqual(anterior.faltaPorCliente, [{ cliente: 'Segunda 290', falta: 'meta_sin_vincular' }], 'con la anterior incompleta, no se dijo de quién');
  } finally {
    await admin.query(`update negocio.contactos set alta_en_el_crm = now() - interval '3 days' where org_id = $1 and cuenta_id = $2`, [a.org, a.y]);
    await sinSellos(a, a.y);
  }
  // Sin sellos, la clave no viaja.
  assert.ok(!('faltaPorCliente' in (await conOrganizacion(a.org, () => lecturaDeConversion(PERIODO, ZONA))).pasos.cifras.vistas));

  /* La cobertura de la anterior decide: la serie de Y, entera en la actual —el gasto de la ventana está— y con un hueco
     en la anterior. A Y se le pregunta por la anterior, que es donde le falta; por la actual no le falta nada. */
  await sello(h, h.y, 'anuncios', 'corrio', MOTIVO_SIN_META_EN_GHL, 30);
  assert.equal((await conOrganizacion(h.org, () => lecturaDeAcquisition(PERIODO, ZONA))).embudos.gasto.motivo, null, 'la ventana actual no está entera: no es el caso de la anterior');
  const porLaCuenta = (await conOrganizacion(h.org, () => lecturaDeConversion(PERIODO, ZONA))).pasos.cifras.vistas;
  assert.equal(porLaCuenta.motivo, 'dias_sin_leer');
  assert.deepEqual(porLaCuenta.faltaPorCliente, [{ cliente: 'Segunda 290', falta: 'meta_sin_vincular' }], 'con la anterior sin su gasto entero, se le preguntó por la actual');
});

test('el alta, la activación y las dos listas dicen qué closers no ven a un cliente', async () => {
  const alta = await leerRespuesta<{ id: string; closersSinVincular?: string[] }>(
    await crearCliente(pedirComo('/api/admin/cuentas', tokenK, { metodo: 'POST', cuerpo: { nombre: 'Nueva 290' } })),
  );
  assert.equal(alta.estado, 201);
  assert.deepEqual(alta.cuerpo.closersSinVincular?.sort(), ['Alfa 290', 'Ce 290'], 'el alta no dice quiénes no ven al cliente nuevo, o nombra a quien ve todo');

  // La plataforma operando sobre otra empresa no recibe los nombres de sus closers.
  const desdeAria = await leerRespuesta<{ id: string; closersSinVincular?: string[] }>(
    await crearCliente(pedirComo('/api/admin/cuentas', tokenAria, { metodo: 'POST', cuerpo: { nombre: 'Desde ARIA 290', orgId: k.org } })),
  );
  assert.equal(desdeAria.estado, 201);
  assert.ok(!('closersSinVincular' in desdeAria.cuerpo), 'la plataforma recibió los nombres de los closers de otra empresa');

  // Pausar no dice nada; activar, sí.
  const pausa = await leerRespuesta<object>(
    await editarCliente(pedirComo(`/api/admin/cuentas/${alta.cuerpo.id}`, tokenK, { metodo: 'PATCH', cuerpo: { estado: 'pausada' } }), ctx(alta.cuerpo.id)),
  );
  assert.ok(!('closersSinVincular' in pausa.cuerpo));
  const lista = await leerRespuesta<{ clientes: { id: string; closersSinVincular?: string[]; listaDeChequeo?: { pasos: unknown[] } }[] }>(
    await listarClientes(pedirComo('/api/admin/cuentas', tokenK)),
  );
  const de = (id: string) => lista.cuerpo.clientes.find((c) => c.id === id);
  assert.ok(!('closersSinVincular' in de(alta.cuerpo.id)!), 'un cliente en pausa se marcó');
  assert.deepEqual(de(k.y)?.closersSinVincular, ['Alfa 290'], 'la lista no dice quién no ve a Y');
  assert.ok(de(k.y)?.listaDeChequeo?.pasos.length, 'el cliente con closers sin vincular llegó sin su lista de chequeo');
  assert.ok(!('closersSinVincular' in de(k.p)!));
  const vuelta = await leerRespuesta<{ closersSinVincular?: string[] }>(
    await editarCliente(pedirComo(`/api/admin/cuentas/${alta.cuerpo.id}`, tokenK, { metodo: 'PATCH', cuerpo: { estado: 'activa' } }), ctx(alta.cuerpo.id)),
  );
  assert.deepEqual(vuelta.cuerpo.closersSinVincular?.sort(), ['Alfa 290', 'Ce 290'], 'la activación no dice quiénes no lo ven');

  // La pantalla del vínculo, por cliente; con un solo cliente, la clave no viaja.
  const vinculo = await leerRespuesta<{ clientes: { id: string; sinVincular?: string[] }[] }>(await estadoDelCloser(pedirComo('/api/admin/closer', tokenK)));
  assert.deepEqual(vinculo.cuerpo.clientes.find((c) => c.id === k.y)?.sinVincular, [closers.alfa]);
  assert.deepEqual(vinculo.cuerpo.clientes.find((c) => c.id === k.p)?.sinVincular, []);
  const deUno = await leerRespuesta<{ clientes: object[] }>(await estadoDelCloser(pedirComo('/api/admin/closer', tokenU)));
  assert.equal(deUno.cuerpo.clientes.length, 1);
  assert.ok(!('sinVincular' in deUno.cuerpo.clientes[0]!), 'con un solo cliente apareció `sinVincular`');
});
