// EL CLOSER EN CADA CLIENTE: EL VÍNCULO CON EL CRM ES DE UNA SUBCUENTA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C5 · G2)
//
// Los usuarios de GoHighLevel son de cada subcuenta, y cada cliente de la empresa tiene la suya: el vínculo de un
// closer se guarda por (persona, cliente), y «mío» son sus PARES (cliente, usuario del CRM). Una empresa propia con dos
// clientes —el principal P y otro, Y— y el mismo id del CRM (`uP`) en las dos subcuentas, que es el caso del usuario de
// agencia: en P es de X, en Y es de Z. Cada afirmación dice la mutación que la pone en rojo:
//
//   · la clave es (organización, cliente, persona) y el usuario del CRM es único DENTRO de cada cliente — mutaciones:
//     la `097` sin cambiar la clave, el único de la `034` sin soltar;
//   · «mío» son los pares, en los cinco cortes (la fila, la Agenda, el cockpit, la cabecera y el Brief) — mutaciones:
//     el corte por el usuario del CRM solo, el alcance con un solo vínculo, cualquier sitio que vuelva al id suelto;
//   · la tabla de Sales pone cada cita en la fila de su par — mutaciones: agrupar o mapear por el usuario solo;
//   · con el foco en un cliente se publican sus vínculos y el alcance usa todos: quien trabaja en otro cliente tiene
//     su aviso y no ve lo de los demás; el cliente final, sólo los suyos — mutaciones: sin el cruce con las cuentas, el
//     alcance con los de la vista, sin el aviso propio;
//   · el tope cuenta personas, el usuario repetido se mide dentro del cliente y quitar saca de todos — mutaciones: el
//     conteo por filas, la comprobación de toda la empresa, el borrado sólo en el principal;
//   · la ruta guarda en el cliente pedido, sin cliente en el principal, y uno ajeno o dado de baja es 404 —
//     mutaciones: la ruta no pasa el cliente, no lo valida, acepta uno de baja, el escritor lo deja al puente;
//   · la ficha del lead dice el closer de SU par — mutación: buscar por el usuario del CRM solo.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { alcanceDe, alcanceDeQuienMira, closersDeLaEmpresa, type AlcanceDelCloser } from '../../lib/negocio/alcanceDelCloser.ts';
import { asignarCloser, quitarCloser } from '../../lib/negocio/closer.ts';
import { filasDeTerritorio } from '../../lib/negocio/fila.ts';
import { agendaDelCloser } from '../../lib/negocio/agenda.ts';
import { cockpitDelMes } from '../../lib/negocio/inicio.ts';
import { citasSinRegistrar } from '../../lib/agentes/cabecera.ts';
import { entradaDelBrief } from '../../lib/agentes/brief/entrada.ts';
import { cierrePorCloser } from '../../lib/negocio/cierrePorCloser.ts';
import { fichaDelLeadDelPortal } from '../../lib/negocio/fichaDelLeadDelPortal.ts';
import { GET as estadoDelCloser, PUT as designar } from '../../app/api/admin/closer/route.ts';

const SLUG = 'delta-288';
const ZONA = 'America/Lima';
const HORA = 3600_000;

let admin: Client;
let org: string;
let p: string;
let y: string;
/** Un cliente dado de baja: no se ofrece ni se acepta. */
let baja: string;
/** El principal de beta: un cliente de otra empresa. */
let deBeta: string;
let jefe: string;
let token: string;
let x: string;
let z: string;
let w: string;
let v: string;
/** Los contactos: c1 (P, uP), c2 (P, otro), c3 (Y, uY), c4 (Y, uP) y c5 (Y, sin asignar). */
const c: Record<'c1' | 'c2' | 'c3' | 'c4' | 'c5', string> = { c1: '', c2: '', c3: '', c4: '', c5: '' };
/** La cita pasada de cada contacto (c1 tiene una más). */
const pasada: Record<string, string> = {};

const deTodos = () => org;
const foco = (cuenta: string) => ({ orgId: org, todaLaOrganizacion: true, cuentas: [cuenta] }) as const;
const clienteFinal = (cuenta: string) => ({ orgId: org, todaLaOrganizacion: false, cuentas: [cuenta] }) as const;
const ids = (filas: { id: string }[]) => filas.map((f) => f.id).sort();
const de = (...claves: (keyof typeof c)[]) => claves.map((k) => c[k]).sort();

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['citas', 'contactos', 'closer_asignado']) await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  for (const t of ['sesiones', 'usuarios_secciones', 'usuarios_roles']) {
    await admin.query(`delete from identidad.${t} where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  }
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

async function persona(nombre: string, rol: string): Promise<string> {
  const u = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.usuarios (org_id, nombre, email, password_hash)
     values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [org, nombre, `${nombre.toLowerCase().replace(/ /g, '-')}@delta-288.ejemplo`],
  );
  assert.ok(u);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = $2 and org_id is null`,
    [u.id, rol],
  );
  return u.id;
}

/** Quien cierra: rol `usuario` con la pestaña Closer, como `personaQueCierra` de la 31. Así es candidata para la ruta. */
async function quienCierra(nombre: string): Promise<string> {
  const id = await persona(nombre, 'usuario');
  await admin.query(`insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, 'closer')`, [id]);
  return id;
}

async function contacto(cuenta: string, ghl: string, asignado: string | null): Promise<string> {
  const f = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, crm_asignado_a, etiquetas)
     values ($1, $2, $3, $4, 'closer', now() - interval '3 days', $5, array['cita_agendada']) returning id`,
    [org, cuenta, ghl, `Contacto 288 ${ghl}`, asignado],
  );
  assert.ok(f);
  return f.id;
}

async function cita(cuenta: string, contactoId: string, inicio: Date): Promise<string> {
  const f = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.citas (org_id, cuenta_id, ghl_evento_id, contacto_id, inicio_el, fin_el, estado_ghl, ghl_calendario_id, titulo)
     values ($1, $2, $3, $4, $5, $5::timestamptz + interval '30 minutes', 'confirmed', 'cal-288', 'Cita 288') returning id`,
    [org, cuenta, `ev-288-${contactoId}-${inicio.getTime()}`, contactoId, inicio],
  );
  assert.ok(f);
  return f.id;
}

/** El punto de partida: X vinculado en (P, uP) y en (Y, uY); Z en (Y, uP). Las fechas fijan el orden: X, después Z. */
async function vincularBase(): Promise<void> {
  await admin.query(`delete from negocio.closer_asignado where org_id = $1`, [org]);
  await conOrganizacion(deTodos(), async () => {
    assert.equal(await asignarCloser(x, 'uP', jefe, p), null);
    assert.equal(await asignarCloser(x, 'uY', jefe, y), null);
    assert.equal(await asignarCloser(z, 'uP', jefe, y), null);
  });
  await admin.query(
    `update negocio.closer_asignado set actualizado_el = now() - case
       when usuario_id = $2 and cuenta_id = $3 then interval '3 hours'
       when usuario_id = $2 then interval '2 hours'
       else interval '1 hour' end
     where org_id = $1`,
    [org, x, p],
  );
}

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Delta 288', $1, $2) returning id`,
    [SLUG, ZONA],
  );
  assert.ok(o);
  org = o.id;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  const segunda = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Segunda 288', 'segunda-288') returning id`,
    [org],
  );
  const dadaDeBaja = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, estado, baja_el) values ($1, 'De baja 288', 'baja-288', 'baja', now()) returning id`,
    [org],
  );
  const b = await unaFila<{ id: string }>(
    admin,
    `select c.id from identidad.cuentas c join identidad.organizaciones o on o.id = c.org_id where o.slug = 'beta' and c.es_por_omision`,
  );
  assert.ok(principal && segunda && dadaDeBaja && b, 'falta el sembrado');
  p = principal.id;
  y = segunda.id;
  baja = dadaDeBaja.id;
  deBeta = b.id;

  jefe = await persona('Jefe 288', 'administrador');
  token = await sesionDe(jefe);
  x = await quienCierra('Equis 288');
  z = await quienCierra('Zeta 288');
  w = await quienCierra('Doble 288');
  v = await quienCierra('Uve 288');

  c.c1 = await contacto(p, 'c288-1', 'uP');
  c.c2 = await contacto(p, 'c288-2', 'otro');
  c.c3 = await contacto(y, 'c288-3', 'uY');
  c.c4 = await contacto(y, 'c288-4', 'uP');
  c.c5 = await contacto(y, 'c288-5', null);
  for (const [k, cuenta] of [['c1', p], ['c2', p], ['c3', y], ['c4', y], ['c5', y]] as const) {
    pasada[k] = await cita(cuenta, c[k], new Date(Date.now() - 2 * HORA));
    await cita(cuenta, c[k], new Date(Date.now() + 24 * HORA));
  }
  /* Y una pasada más de c1: con el mismo `uP` en P y en Y, c1 y c4 tienen cifras distintas, y una tabla que los junte
     por el usuario del CRM solo le da a X o a Z las de otro. */
  await cita(p, c.c1, new Date(Date.now() - 3 * HORA));
  await vincularBase();
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('la clave es (organización, cliente, persona) y el usuario del CRM es único dentro de cada cliente', async () => {
  const pk = await unaFila<{ d: string }>(
    admin,
    `select pg_get_constraintdef(oid) as d from pg_constraint where conrelid = 'negocio.closer_asignado'::regclass and conname = 'closer_asignado_pkey'`,
  );
  assert.equal(pk?.d, 'PRIMARY KEY (org_id, cuenta_id, usuario_id)');
  const indices = (await admin.query(`select indexname from pg_indexes where schemaname = 'negocio' and tablename = 'closer_asignado'`)).rows.map(
    (f: { indexname: string }) => f.indexname,
  );
  assert.ok(!indices.includes('closer_por_usuario_del_crm'), 'sigue el único de la 034: un usuario del CRM por EMPRESA');
  assert.ok(indices.includes('closer_por_usuario_del_crm_en_el_cliente'));
  assert.ok(!indices.includes('closer_asignado_por_cuenta'), 'sigue el índice (org_id, cuenta_id), que la clave ya sirve');

  // El escenario mismo ya lo prueba: X tiene fila en dos clientes, y `uP` es de X en P y de Z en Y.
  assert.equal((await admin.query(`select 1 from negocio.closer_asignado where org_id = $1`, [org])).rowCount, 3);
  await assert.rejects(
    admin.query(`insert into negocio.closer_asignado (org_id, cuenta_id, usuario_id, crm_usuario_id) values ($1, $2, $3, 'uY')`, [org, y, w]),
    (e: { code?: string }) => e.code === '23505',
    'dos personas con el mismo usuario del CRM en el MISMO cliente',
  );
  await admin.query(`insert into negocio.closer_asignado (org_id, cuenta_id, usuario_id, crm_usuario_id) values ($1, $2, $3, 'uY')`, [org, p, w]);
  await vincularBase();
});

test('«mío» son los pares: las cinco consultas cortan igual', async () => {
  const r = await conOrganizacion(deTodos(), async () => {
    const { alcance } = await alcanceDeQuienMira(x);
    const deZ = (await alcanceDeQuienMira(z)).alcance;
    assert.equal(alcance.tipo, 'mio');
    const vinculos = (alcance as Extract<AlcanceDelCloser, { tipo: 'mio' }>).vinculos;
    const agenda = await agendaDelCloser('closer', ZONA, { dias: 7, alcance });
    return {
      alcance,
      filas: (await filasDeTerritorio('closer', { alcance, todas: true })).filas,
      deZ: (await filasDeTerritorio('closer', { alcance: deZ, todas: true })).filas,
      // De quién son las citas de la ventana (la pasada de hoy también puede caer adentro).
      agenda: [...new Set(agenda.dias.flatMap((d) => d.citas.map((k) => k.contactoId)))].sort(),
      cockpit: await cockpitDelMes(ZONA, 0, { tipo: 'persona', usuarioId: x, vinculos }),
      sinRegistrar: await citasSinRegistrar(alcance),
      brief4: await entradaDelBrief(pasada.c4!, alcance),
      brief3: await entradaDelBrief(pasada.c3!, alcance),
    };
  });
  assert.deepEqual(r.alcance, {
    tipo: 'mio',
    usuarioId: x,
    vinculos: [
      { cuentaId: p, crmUsuarioId: 'uP' },
      { cuentaId: y, crmUsuarioId: 'uY' },
    ],
  });
  assert.deepEqual(ids(r.filas), de('c1', 'c3'), 'la fila de X no son sus pares: el mismo id en otra subcuenta es de otro');
  assert.deepEqual(ids(r.deZ), de('c4'), 'Z se llevó un contacto de P con su mismo id del CRM');
  assert.deepEqual(r.agenda, de('c1', 'c3'), 'la Agenda de X no son sus pares');
  assert.equal(r.cockpit.conCitaAgendada.valor, 2, 'el cockpit de X no son sus pares');
  assert.equal(r.sinRegistrar, 3, 'la cabecera de X no son sus pares');
  assert.equal(r.brief4, null, 'el Brief le abre a X la cita de un contacto de Z');
  assert.notEqual(r.brief3, null, 'el Brief no le abre a X la cita de su contacto en el otro cliente');
});

test('la tabla de Sales pone cada cita en la fila de su par', async () => {
  const t = await conOrganizacion(deTodos(), () => cierrePorCloser(14));
  const fila = (u: string) => t.filas.find((f) => f.usuarioId === u)!;
  assert.deepEqual([fila(x).citas, fila(x).contactos], [3, 2], 'X suma citas de otro par');
  assert.equal(fila(z).citas, 1, 'Z suma citas de otro par');
  assert.equal(t.fueraDeLasFilas.sinAsignar.citas, 1);
  assert.equal(t.fueraDeLasFilas.deAlguienQueNoEsCloser.citas, 1, 'la cita de un usuario que no es closer cayó en una fila');
  assert.deepEqual(t.coberturaDeLaTabla, { con: 4, sobre: 6 });
});

test('con el foco en un cliente se publican sus vínculos y el alcance usa todos; el cliente final, sólo los suyos', async () => {
  const conFoco = await conOrganizacion(foco(p), async () => {
    const closers = await closersDeLaEmpresa();
    const deZ = alcanceDe(z, closers);
    return {
      closers,
      tabla: await cierrePorCloser(14),
      deZ,
      filasDeZ: (await filasDeTerritorio('closer', { alcance: deZ, todas: true })).filas,
      filasDeX: (await filasDeTerritorio('closer', { alcance: alcanceDe(x, closers), todas: true })).filas,
    };
  });
  // La designación es de la empresa: con el foco en P, los dos son closers.
  assert.deepEqual(conFoco.closers.map((k) => k.usuarioId), [x, z]);
  const k = (u: string) => conFoco.closers.find((f) => f.usuarioId === u)!;
  assert.deepEqual(k(x).vinculosALaVista, [{ cuentaId: p, crmUsuarioId: 'uP' }]);
  assert.deepEqual(k(z).vinculosALaVista, [], 'con el foco en P se publicó un vínculo de Y');
  assert.deepEqual(k(z).vinculos, [{ cuentaId: y, crmUsuarioId: 'uP' }]);
  const fila = (u: string) => conFoco.tabla.filas.find((f) => f.usuarioId === u)!;
  assert.equal(fila(z).citas, null, 'con el foco en P, Z tiene citas de cero en vez de no tener eje');
  assert.equal(fila(x).citas, 2);
  assert.match(fila(z).aviso ?? '', /vinculado en otro cliente/, 'quien trabaja en otro cliente sale como «sin vincular»');
  assert.doesNotMatch(fila(x).aviso ?? '', /otro cliente/);
  // El alcance usa TODOS sus vínculos: con el foco en P, Z no ve nada (sus contactos son de Y), no todo.
  assert.deepEqual(conFoco.deZ, { tipo: 'mio', usuarioId: z, vinculos: [{ cuentaId: y, crmUsuarioId: 'uP' }] });
  assert.deepEqual(conFoco.filasDeZ, [], 'con el foco en P, Z —vinculado sólo en Y— ve los leads de los demás');
  assert.deepEqual(ids(conFoco.filasDeX), de('c1'));

  const deY = await conOrganizacion(clienteFinal(y), () => closersDeLaEmpresa());
  assert.deepEqual(deY.map((f) => f.nombre), ['Closer 1', 'Closer 2']);
  assert.ok(deY.every((f) => f.vinculosALaVista.every((vin) => vin.cuentaId === y)), 'el cliente final de Y vio un vínculo de P');
  assert.deepEqual(deY.find((f) => f.usuarioId === x)!.vinculosALaVista, [{ cuentaId: y, crmUsuarioId: 'uY' }]);
});

test('el tope cuenta personas, no filas', async () => {
  await vincularBase();
  try {
    const r = await conOrganizacion(deTodos(), async () => ({
      enP: await asignarCloser(w, null, jefe, p),
      enY: await asignarCloser(w, 'uW', jefe, y),
      cuarta: await asignarCloser(v, null, jefe, p),
    }));
    assert.equal(r.enP, null, 'la tercera persona se rechazó');
    assert.equal(r.enY, null, 'vincular en otro cliente a quien ya es closer contó como un alta');
    assert.equal(r.cuarta, 'tope');
    assert.equal((await admin.query(`select 1 from negocio.closer_asignado where org_id = $1`, [org])).rowCount, 5);
  } finally {
    await vincularBase();
  }
});

test('el usuario del CRM repetido se mide dentro del cliente', async () => {
  try {
    const r = await conOrganizacion(deTodos(), async () => ({
      enY: await asignarCloser(w, 'uY', jefe, y),
      enP: await asignarCloser(w, 'uY', jefe, p),
    }));
    assert.equal(r.enY, 'crm_ya_vinculado');
    assert.equal(r.enP, null, 'el mismo id en otra subcuenta es otro usuario');
    const deW = (await admin.query(`select cuenta_id, crm_usuario_id from negocio.closer_asignado where org_id = $1 and usuario_id = $2`, [org, w])).rows;
    assert.deepEqual(deW, [{ cuenta_id: p, crm_usuario_id: 'uY' }], 'el vínculo no quedó en el cliente que se pidió');
  } finally {
    await vincularBase();
  }
});

test('quitar a una persona la saca de todos los clientes', async () => {
  try {
    await conOrganizacion(deTodos(), () => quitarCloser(x));
    assert.equal((await admin.query(`select 1 from negocio.closer_asignado where org_id = $1 and usuario_id = $2`, [org, x])).rowCount, 0);
    assert.equal((await admin.query(`select 1 from negocio.closer_asignado where org_id = $1 and usuario_id = $2`, [org, z])).rowCount, 1);
  } finally {
    await vincularBase();
  }
});

test('la ruta guarda en el cliente pedido; sin cliente, en el principal; uno ajeno o de baja es 404', async () => {
  const filasDe = async (u: string) =>
    (await admin.query(`select cuenta_id, crm_usuario_id from negocio.closer_asignado where org_id = $1 and usuario_id = $2 order by crm_usuario_id`, [org, u])).rows;
  const put = (cuerpo: unknown) => designar(pedirComo('/api/admin/closer', token, { metodo: 'PUT', cuerpo }));
  try {
    const enY = await put({ usuarioId: v, crmUsuarioId: 'uV', cuentaId: y });
    assert.equal(enY.status, 200, await enY.clone().text());
    assert.deepEqual(await filasDe(v), [{ cuenta_id: y, crm_usuario_id: 'uV' }], 'la ruta no guardó en el cliente pedido');

    const g = await leerRespuesta<{
      clientes: { id: string; esPorOmision: boolean }[];
      closers: { usuarioId: string; vinculos: { cuentaId: string; crmUsuarioId: string }[] }[];
    }>(await estadoDelCloser(pedirComo('/api/admin/closer', token)));
    assert.equal(g.estado, 200);
    assert.deepEqual(g.cuerpo.clientes.map((k) => k.id), [p, y], 'los clientes del selector: el principal primero, y ninguno de baja');
    assert.deepEqual(g.cuerpo.closers.find((k) => k.usuarioId === v)?.vinculos, [{ cuentaId: y, crmUsuarioId: 'uV' }]);

    const auditada = await unaFila<{ cuenta: string | null; objetivo: string | null }>(
      admin,
      `select detalle->>'cuenta' as cuenta, detalle->>'objetivo' as objetivo from identidad.auditoria_accesos
        where org_id = $1 and accion = 'closer_designado' order by creado_el desc, id desc limit 1`,
      [org],
    );
    assert.deepEqual(auditada, { cuenta: y, objetivo: v }, 'la auditoría no dice en qué cliente se vinculó');

    const sinCliente = await put({ usuarioId: v, crmUsuarioId: 'uV2' });
    assert.equal(sinCliente.status, 200);
    assert.deepEqual(
      await filasDe(v),
      [
        { cuenta_id: y, crm_usuario_id: 'uV' },
        { cuenta_id: p, crm_usuario_id: 'uV2' },
      ],
      'sin cliente no guardó en el principal',
    );

    for (const cuentaId of [deBeta, baja, 'no-es-uuid']) {
      const r = await put({ usuarioId: v, crmUsuarioId: 'uV3', cuentaId });
      assert.equal(r.status, 404, `un cliente ${cuentaId === baja ? 'dado de baja' : 'ajeno'} no es 404: ${await r.clone().text()}`);
    }
    assert.equal((await filasDe(v)).length, 2, 'un pedido rechazado escribió una fila');
  } finally {
    await vincularBase();
  }
});

test('la ficha del lead dice el closer de SU par', async () => {
  const fichas = await conOrganizacion(deTodos(), async () => ({
    c1: await fichaDelLeadDelPortal(c.c1),
    c2: await fichaDelLeadDelPortal(c.c2),
    c4: await fichaDelLeadDelPortal(c.c4),
  }));
  assert.deepEqual(fichas.c4?.closer, { estado: 'asignado', nombre: 'Zeta 288' }, 'la ficha resolvió el usuario del CRM en otra subcuenta');
  assert.deepEqual(fichas.c1?.closer, { estado: 'asignado', nombre: 'Equis 288' });
  assert.deepEqual(fichas.c2?.closer, { estado: 'no_configurado' });
});
