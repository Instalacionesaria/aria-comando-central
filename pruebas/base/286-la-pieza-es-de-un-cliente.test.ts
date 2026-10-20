// LA PIEZA DE CREATIVE ES (CLIENTE, NOMBRE): DOS CLIENTES, LA MISMA PIEZA DE NOMBRE, DOS PIEZAS. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C5 · G1, la `095`)
//
// Una empresa con su principal P y un segundo cliente Y, que tienen un anuncio con el MISMO nombre normalizado
// («hook 286») y números distintos y asimétricos: fundir las dos piezas cambia cada cifra. Cada afirmación dice la
// mutación que la pone en rojo:
//
//   · la calidad agrupa por (cliente, creativo), cuenta los anuncios de SU cliente y el puente cruza un contacto sólo
//     con un anuncio de su cliente — mutaciones: sin el cliente en el `select` y el `group by`, `anunciosPorNombre`
//     sin cliente, el `exists` del puente sin `a.cuenta_id = contactos.cuenta_id`;
//   · el rendimiento suma por pieza de un cliente, y su desglose también — mutaciones: `porPieza` con la llave del
//     nombre, el desglose sin `a.cuenta_id`;
//   · la fatiga arma la serie y sus mitades por cliente — mutaciones: `porDia` sin cliente, `ntile` partido sólo por
//     el creativo;
//   · la entrega de cada pieza tiene la etapa de la campaña de SU cliente — mutación: `etapas` por nombre;
//   · la pantalla tiene dos piezas, cada una con su cliente, su miniatura y su link — mutaciones: `idDeLaPieza` que
//     ignora el cliente, los activos y las miniaturas con la llave del nombre;
//   · el link manual es de la pieza en su cliente: la ruta valida el cliente contra los que ve la sesión, y sin
//     decirlo va al principal — mutaciones: `existeLaPieza` sin cliente, `borrarEnlace` sin cliente, no auditar el
//     cliente; y un pedido sin cliente sigue con el motivo de siempre;
//   · la clave de la `095` — mutación: volverla a (org_id, pieza);
//   · las señales de una pieza llevan su cliente: la del principal conserva su huella (el nombre), la de Y lleva su
//     cliente, la concentración se mide en cada cliente, la pantalla las nombra «nombre · cliente» y nunca con un
//     uuid, y la descartada no renace — mutaciones: la entidad por nombre, el cliente siempre adelante, la
//     concentración sobre todas, la pantalla que nombra con el id;
//   · el cerebro nunca lee un uuid, tampoco con el foco en Y — mutación: la `clave` de la pantalla tal cual.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { calidadDelCreativo } from '../../lib/negocio/calidadDelCreativo.ts';
import { rendimientoDelCreativo } from '../../lib/negocio/rendimientoDelCreativo.ts';
import { fatigaDelCreativo } from '../../lib/negocio/fatigaDelCreativo.ts';
import { entregaDeLasPiezas, lecturaDeCreative } from '../../lib/negocio/lecturaDeCreative.ts';
import { DELETE as sacarEnlace, PUT as cargarEnlace } from '../../app/api/creative/enlace/route.ts';
import { CRE, detectarEnCreative, medirCreative } from '../../lib/agentes/detectores/creative.ts';
import { cerrarSenal, reconciliarSenales } from '../../lib/agentes/senales/escritura.ts';
import { senalesDeLaPantalla } from '../../lib/agentes/senales/lectura.ts';
import { CATALOGO_DE_REGLAS, umbralVigente } from '../../lib/agentes/senales/umbrales.ts';
import { textoDeCreative } from '../../lib/agentes/plan/creative.ts';
import { HERRAMIENTAS_DE_CREATIVE } from '../../lib/agentes/executive/adaptadores/creative.ts';

const SLUG = 'gamma-286';
const SLUG_SENALES = 'gamma-286-senales';
const PIEZA = 'hook 286';
const CDN = 'https://scontent.xx.fbcdn.net/v/t45/y286.jpg';
const IMAGEN_DE_Y = 'https://www.facebook.com/ads/image/?d=y286';
const U1 = 'https://www.instagram.com/reel/286111/';
const U2 = 'https://www.facebook.com/reel/286222';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

let admin: Client;
let org: string;
let p: string;
let y: string;
let nombreP: string;
let token: string;
let cuentaAjena: string;
let orgSenales: string;
let ps: string;
let ys: string;
let nombrePs: string;
let quienSenales: string;

const TABLAS = [
  'senales', 'planes_de_accion', 'enlaces_de_pieza', 'activos_de_anuncio', 'miniaturas_del_contacto', 'metricas_de_anuncio',
  'anuncios', 'campanas', 'contactos', 'tareas_programadas',
];

async function limpiar(slug: string): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [slug]);
  if (!o) return;
  for (const t of TABLAS) await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Una empresa con su principal y un segundo cliente. */
async function empresa(slug: string, nombre: string, segunda: string): Promise<{ org: string; p: string; y: string; nombreP: string }> {
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ($1, $2, 'America/Lima') returning id`,
    [nombre, slug],
  );
  assert.ok(o);
  const principal = await unaFila<{ id: string; nombre: string }>(admin, `select id, nombre from identidad.cuentas where org_id = $1 and es_por_omision`, [o.id]);
  const otra = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug) values ($1, $2, $3) returning id`,
    [o.id, segunda, `${slug}-segunda`],
  );
  assert.ok(principal && otra);
  return { org: o.id, p: principal.id, y: otra.id, nombreP: principal.nombre };
}

/** Una persona de la empresa con un rol de sistema. */
async function persona(orgId: string, nombre: string, rol: string): Promise<string> {
  const u = await unaFila<{ id: string }>(admin, `insert into identidad.usuarios (org_id, nombre) values ($1, $2) returning id`, [orgId, nombre]);
  assert.ok(u);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = $2 and org_id is null`,
    [u.id, rol],
  );
  return u.id;
}

async function anuncio(orgId: string, cuenta: string, id: string, nombre: string, campana: string): Promise<void> {
  await admin.query(
    `insert into negocio.anuncios (org_id, cuenta_id, meta_anuncio_id, meta_campana_id, nombre) values ($1, $2, $3, $4, $5)`,
    [orgId, cuenta, id, campana, nombre],
  );
}

/** Días de métricas de un anuncio, de `desde` a `hasta` días atrás, con lo que diga `dia(hace)`. */
async function metricas(
  orgId: string,
  cuenta: string,
  id: string,
  desde: number,
  hasta: number,
  dia: (hace: number) => { impresiones: number; clics: number; gasto: number; acciones?: Record<string, number>; frecuencia?: number },
): Promise<void> {
  for (let hace = desde; hace >= hasta; hace -= 1) {
    const d = dia(hace);
    await admin.query(
      `insert into negocio.metricas_de_anuncio (org_id, cuenta_id, meta_anuncio_id, fecha, gasto, impresiones, clics, acciones, frecuencia)
       values ($1, $2, $3, current_date - $4::int, $5, $6, $7, $8::jsonb, $9)`,
      [orgId, cuenta, id, hace, d.gasto, d.impresiones, d.clics, d.acciones ? JSON.stringify(d.acciones) : null, d.frecuencia ?? null],
    );
  }
}

async function contacto(cuenta: string, ghl: string, atribucion: Record<string, string>, hace = 2): Promise<string> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, alta_en_el_crm, atribucion_primera)
     values ($1, $2, $3, $3, now() - make_interval(days => $5), $4::jsonb) returning id`,
    [org, cuenta, ghl, JSON.stringify(atribucion), hace],
  );
  assert.ok(c);
  return c.id;
}

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await limpiar(SLUG);
  await limpiar(SLUG_SENALES);
  ({ org, p, y, nombreP } = await empresa(SLUG, 'Gamma 286', 'Segunda 286'));
  token = await sesionDe(await persona(org, 'Admin 286', 'administrador'));
  const ajena = await unaFila<{ id: string }>(
    admin,
    `select c.id from identidad.cuentas c join identidad.organizaciones o on o.id = c.org_id where o.slug = 'beta' and c.es_por_omision`,
  );
  assert.ok(ajena, 'falta el sembrado: corré `npm run db:reset`');
  cuentaAjena = ajena.id;

  // Las campañas: P en TOFU, Y en BOFU.
  await admin.query(
    `insert into negocio.campanas (org_id, cuenta_id, meta_campana_id, nombre) values ($1, $2, 'c286p', 'P | TOFU | 286'), ($1, $3, 'c286y', 'Y | BOFU | 286')`,
    [org, p, y],
  );
  // «Hook 286» en los dos clientes, con espacios y mayúsculas distintas; «Solo P 286», sólo en P.
  await anuncio(org, p, '286p1', '  Hook 286 ', 'c286p');
  await anuncio(org, p, '286p2', 'Solo P 286', 'c286p');
  await anuncio(org, y, '286y1', 'Hook 286', 'c286y');
  // P: ocho días, de hace 12 a hace 5: 1000 impresiones, 20 clics los cuatro primeros y 10 los cuatro últimos.
  await metricas(org, p, '286p1', 12, 5, (hace) => ({ impresiones: 1000, clics: hace >= 9 ? 20 : 10, gasto: 100, acciones: { videoView: 300 } }));
  // Y: ocho días, de hace 8 a ayer: 3000 impresiones y 30 clics por día. Se cruzan con los de P de hace 8 a hace 5.
  await metricas(org, y, '286y1', 8, 1, () => ({ impresiones: 3000, clics: 30, gasto: 10, acciones: { videoView: 100 } }));

  /* Los contactos: 4 de P con la pieza; 3 de Y (uno entró por su anuncio) y 1 de Y con un nombre que sólo tiene P. Los
     dos clientes en TOFU para sus contactos —la etapa de la entrega es la de las campañas—: así, una calidad sin el
     cliente juntaría las dos piezas en una fila. */
  for (let i = 1; i <= 4; i += 1) await contacto(p, `p286-${i}`, { utmContent: 'Hook 286', campaign: 'P | TOFU | 286' });
  const delAnuncio = await contacto(y, 'y286-1', { utmContent: 'hook 286 ', campaign: 'Y | TOFU | 286', adId: '286y1' });
  for (let i = 2; i <= 3; i += 1) await contacto(y, `y286-${i}`, { utmContent: 'hook 286 ', campaign: 'Y | TOFU | 286' });
  await contacto(y, 'y286-4', { utmContent: 'Solo P 286', campaign: 'Y | TOFU | 286' });
  // La imagen de los contactos de Y, y la miniatura de Meta del anuncio de Y: las dos son de Y y de nadie más.
  await admin.query(
    `insert into negocio.miniaturas_del_contacto (org_id, cuenta_id, contacto_id, encontrado, video_url) values ($1, $2, $3, true, $4)`,
    [org, y, delAnuncio, IMAGEN_DE_Y],
  );
  await admin.query(
    `insert into negocio.activos_de_anuncio (org_id, cuenta_id, meta_anuncio_id, meta_creativo_id, miniatura_url, miniatura_caduca_el)
     values ($1, $2, '286y1', 'cr286', $3, now() + interval '1 day')`,
    [org, y, CDN],
  );

  // La empresa de las señales: tres piezas con el mismo nombre en cada cliente.
  ({ org: orgSenales, p: ps, y: ys, nombreP: nombrePs } = await empresa(SLUG_SENALES, 'Gamma 286 señales', 'Segunda 286 señales'));
  quienSenales = await persona(orgSenales, 'Quien decide 286', 'administrador');
  for (const [cuenta, gastos] of [
    [ps, { a: 100, b: 90, c: 90 }],
    [ys, { a: 20, b: 5, c: 5 }],
  ] as const) {
    for (const [pieza, gasto] of Object.entries(gastos)) {
      const id = `286s-${cuenta === ps ? 'p' : 'y'}-${pieza}`;
      await anuncio(orgSenales, cuenta, id, `${pieza.toUpperCase()} 286`, `c286s-${cuenta === ps ? 'p' : 'y'}`);
      // «a» cae a la mitad en los dos clientes: 30 clics por día los cuatro primeros, 15 los cuatro últimos. Y la de Y se
      // muestra cuatro veces por persona.
      await metricas(orgSenales, cuenta, id, 8, 1, (hace) => ({
        impresiones: 1000,
        clics: pieza === 'a' ? (hace >= 5 ? 30 : 15) : 10,
        gasto,
        frecuencia: cuenta === ys && pieza === 'a' ? 4 : undefined,
      }));
    }
  }
});

after(async () => {
  try {
    await limpiar(SLUG);
    await limpiar(SLUG_SENALES);
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

const deCuenta = (c: string | null | undefined) => (c === p ? 'P' : c === y ? 'Y' : String(c));

test('la calidad: cada cliente con su pieza, los anuncios de SU cliente y el puente con los suyos', async () => {
  const c = await conOrganizacion(org, () => calidadDelCreativo(30));
  const hook = c.filas.filter((f) => f.creativo === PIEZA).map((f) => [deCuenta(f.cuentaId), f.contactos, f.anunciosDeMeta, f.etapa]).sort();
  assert.deepEqual(hook, [['P', 4, 1, 'TOFU'], ['Y', 3, 1, 'TOFU']], 'las dos piezas «hook 286» se fundieron, o contaron los anuncios del otro cliente');
  const soloP = c.filas.find((f) => f.creativo === 'solo p 286');
  assert.deepEqual([deCuenta(soloP?.cuentaId), soloP?.anunciosDeMeta], ['Y', 0], 'el nombre que sólo tiene P no es un anuncio de Y');
  // El contacto de Y con el nombre de un anuncio de P no cruza: 7 de 8.
  assert.deepEqual(c.puente, { con: 7, sobre: 8, sinNombre: 0 });
});

test('el rendimiento: cada pieza suma sus anuncios y su desglose, no los del otro cliente', async () => {
  const r = await conOrganizacion(org, () => rendimientoDelCreativo(30));
  const hook = r.filas
    .filter((f) => f.creativo === PIEZA)
    .map((f) => [deCuenta(f.cuentaId), f.gasto, f.impresiones, f.hookRate.cantidad, f.anunciosDeLaPieza.map((a) => a.anuncioId)])
    .sort();
  assert.deepEqual(hook, [
    ['P', 800, 8000, 2400, ['286p1']],
    ['Y', 80, 24000, 800, ['286y1']],
  ]);

  /* Un anuncio con leads y sin gasto es del cliente de su ANUNCIO, aunque el contacto sea de otro: ahí está su gasto. Y
     uno que no está en la dimensión, del de sus contactos. */
  await anuncio(org, y, '286y2', 'Leads 286', 'c286y');
  const sueltos = [await contacto(p, 'p286-y2', { adId: '286y2' }), await contacto(y, 'y286-zz', { adId: '286zz' })];
  try {
    const conLeads = await conOrganizacion(org, () => rendimientoDelCreativo(30));
    const deLeads = (creativo: string) => conLeads.filas.filter((f) => f.creativo === creativo).map((f) => deCuenta(f.cuentaId));
    assert.deepEqual(deLeads('leads 286'), ['Y'], 'la pieza de un anuncio con leads quedó en el cliente del contacto');
    assert.deepEqual(deLeads('(anuncio sin nombre)'), ['Y'], 'un anuncio fuera de la dimensión no tomó el cliente de sus contactos');
  } finally {
    await admin.query(`delete from negocio.contactos where org_id = $1 and id = any($2::uuid[])`, [org, sueltos]);
    await admin.query(`delete from negocio.anuncios where org_id = $1 and meta_anuncio_id = '286y2'`, [org]);
  }
});

test('la fatiga: la serie y sus mitades son de la pieza de un cliente', async () => {
  const f = await conOrganizacion(org, () => fatigaDelCreativo(30));
  const hook = f.filas.filter((x) => x.creativo === PIEZA).map((x) => [deCuenta(x.cuentaId), x.dias, x.ctrTemprano, x.ctrTardio, x.caida]).sort();
  // P: 2 % y después 1 %. Y: 1 % siempre. Con las fechas de los dos juntas, las mitades de P se corrían.
  assert.deepEqual(hook, [['P', 8, 2, 1, 0.5], ['Y', 8, 1, 1, 0]]);
});

test('la entrega: la etapa de cada pieza es la de la campaña de su cliente', async () => {
  const e = await conOrganizacion(org, () => entregaDeLasPiezas(30));
  const hook = e.filter((x) => x.pieza === PIEZA).map((x) => [deCuenta(x.cuentaId), x.etapa, x.impresiones]).sort();
  assert.deepEqual(hook, [['P', 'TOFU', 8000], ['Y', 'BOFU', 24000]]);
});

test('la pantalla: dos piezas con el mismo nombre, cada una con su cliente, su miniatura y su link', async () => {
  /* Un contacto de P que entró por el anuncio de Y, con su imagen: la imagen es de la pieza de Y, el cliente del
     anuncio. Más viejo que el de Y, para que la imagen de Y siga ganando en su pieza. */
  const deOtro = await contacto(p, 'p286-en-y', { adId: '286y1' }, 3);
  await admin.query(
    `insert into negocio.miniaturas_del_contacto (org_id, cuenta_id, contacto_id, encontrado, video_url) values ($1, $2, $3, true, $4)`,
    [org, p, deOtro, 'https://www.facebook.com/ads/image/?d=p-en-y'],
  );
  let pantalla;
  try {
    ({ pantalla } = await conOrganizacion(org, () => lecturaDeCreative(30)));
  } finally {
    await admin.query(`delete from negocio.contactos where org_id = $1 and id = $2`, [org, deOtro]);
  }
  // El orden entre dos homónimos es por el id del cliente: acá, P primero.
  const hook = pantalla.piezas.filter((x) => x.nombre === PIEZA).sort((a, b) => deCuenta(a.cuentaId).localeCompare(deCuenta(b.cuentaId)));
  assert.deepEqual(hook.map((x) => [x.clave, deCuenta(x.cuentaId), x.cliente]), [
    [PIEZA, 'P', nombreP],
    [`${y}:${PIEZA}`, 'Y', 'Segunda 286'],
  ], 'la pieza del principal tiene que conservar su nombre como clave, y la de Y llevar su cliente');
  const [deP, deY] = hook as [(typeof hook)[number], (typeof hook)[number]];
  // La miniatura de Meta y la imagen de los contactos son de Y: P no tiene ninguna.
  assert.deepEqual([deP.miniatura, deP.enlace], [null, null], 'P se quedó con la imagen o el link de Y');
  assert.equal(deY.miniatura, CDN);
  assert.deepEqual(deY.enlace, { url: IMAGEN_DE_Y, red: 'facebook' });
  assert.deepEqual([deP.cifras.impresiones.valor, deY.cifras.impresiones.valor], [8000, 24000]);
  for (const g of Object.values(pantalla.criterios)) {
    const todas = [...g.funciona, ...g.noFunciona];
    assert.ok(todas.includes(PIEZA) && todas.includes(`${y}:${PIEZA}`), 'un criterio perdió una de las dos piezas');
    assert.deepEqual(g.promediosPorCliente?.map((c) => deCuenta(c.cuentaId)).sort(), ['P', 'Y'], 'con dos clientes, cada uno con sus promedios');
  }
});

test('el link manual: el de la pieza en su cliente, sin decirlo el del principal, y auditado con el cliente', async () => {
  const cargar = (cuerpo: unknown) => cargarEnlace(pedirComo('/api/creative/enlace', token, { metodo: 'PUT', cuerpo }));
  type Enlaces = { enlaces: { cuentaId: string; pieza: string; url: string }[] };
  const deY = await leerRespuesta<Enlaces>(await cargar({ cuentaId: y, pieza: PIEZA, url: U1 }));
  assert.equal(deY.estado, 200);
  assert.deepEqual(deY.cuerpo.enlaces.map((e) => [deCuenta(e.cuentaId), e.pieza, e.url]), [['Y', PIEZA, U1]]);

  // Sin el cliente, el principal: un navegador con el código de antes sigue cargando el de P.
  const deP = await leerRespuesta<Enlaces>(await cargar({ pieza: PIEZA, url: U2 }));
  assert.equal(deP.estado, 200);
  assert.deepEqual(deP.cuerpo.enlaces.map((e) => [deCuenta(e.cuentaId), e.url]).sort(), [['P', U2], ['Y', U1]]);
  const { pantalla } = await conOrganizacion(org, () => lecturaDeCreative(30));
  const enlaceDe = (clave: string) => pantalla.piezas.find((x) => x.clave === clave)?.enlace?.url;
  assert.deepEqual([enlaceDe(PIEZA), enlaceDe(`${y}:${PIEZA}`)], [U2, U1]);

  // Un nombre que sólo tiene P no es una pieza de Y, y lo dice con el cliente.
  const ajena = await leerRespuesta<{ detalle: string }>(await cargar({ cuentaId: y, pieza: 'solo p 286', url: U1 }));
  assert.deepEqual([ajena.estado, ajena.cuerpo.detalle], [404, 'Esa pieza no corresponde a ningún anuncio de ese cliente.']);
  // Sin el cliente, el motivo de siempre.
  const ninguna = await leerRespuesta<{ detalle: string }>(await cargar({ pieza: 'no existe 286', url: U1 }));
  assert.deepEqual([ninguna.estado, ninguna.cuerpo.detalle], [404, 'Esa pieza no corresponde a ningún anuncio de la empresa.']);
  // El cliente de otra empresa, o uno que no existe: 404, igual que una pieza que no existe.
  for (const cuentaId of [cuentaAjena, 'x']) {
    assert.equal((await cargar({ cuentaId, pieza: PIEZA, url: U1 })).status, 404, `${cuentaId} no es un cliente de esta empresa`);
  }

  // Sacar el de Y deja el de P.
  const baja = await sacarEnlace(
    pedirComo(`/api/creative/enlace?pieza=${encodeURIComponent(PIEZA)}&cuentaId=${encodeURIComponent(y)}`, token, { metodo: 'DELETE' }),
  );
  assert.equal(baja.status, 200);
  assert.deepEqual((await leerRespuesta<Enlaces>(baja)).cuerpo.enlaces.map((e) => [deCuenta(e.cuentaId), e.url]), [['P', U2]]);
  const quedan = await filas<{ cuenta: string }>(admin, `select cuenta_id as cuenta from negocio.enlaces_de_pieza where org_id = $1`, [org]);
  assert.deepEqual(quedan.map((f) => deCuenta(f.cuenta)), ['P'], 'el borrado se llevó el link del otro cliente');

  const auditadas = await filas<{ accion: string; cuenta: string | null }>(
    admin,
    `select accion, detalle->>'cuenta' as cuenta from identidad.auditoria_accesos
      where org_id = $1 and accion like 'enlace_de_pieza%' order by creado_el, id`,
    [org],
  );
  assert.deepEqual(auditadas.map((a) => [a.accion, deCuenta(a.cuenta)]), [
    ['enlace_de_pieza_cargado', 'Y'],
    ['enlace_de_pieza_cargado', 'P'],
    ['enlace_de_pieza_borrado', 'Y'],
  ]);
});

test('la clave de la 095: un link por (cliente, pieza)', async () => {
  const pk = await unaFila<{ d: string }>(
    admin,
    `select pg_get_constraintdef(oid) as d from pg_constraint where conrelid = 'negocio.enlaces_de_pieza'::regclass and conname = 'enlaces_de_pieza_pkey'`,
  );
  assert.equal(pk?.d, 'PRIMARY KEY (org_id, cuenta_id, pieza)');
  const insertar = (cuenta: string) =>
    admin.query(`insert into negocio.enlaces_de_pieza (org_id, cuenta_id, pieza, url) values ($1, $2, 'x 286', 'https://www.facebook.com/x286')`, [org, cuenta]);
  try {
    await insertar(p);
    await insertar(y);
    await assert.rejects(insertar(y), (e: { code?: string }) => e.code === '23505', 'dos links de la misma pieza del mismo cliente');
  } finally {
    await admin.query(`delete from negocio.enlaces_de_pieza where org_id = $1 and pieza = 'x 286'`, [org]);
  }
});

test('el cerebro nombra las piezas por su rótulo y nunca con un uuid, también con el foco en Y', async () => {
  const herramienta = (nombre: string) => HERRAMIENTAS_DE_CREATIVE.find((h) => h.nombre === nombre)!;
  const enCifras = (await conOrganizacion(org, () => herramienta('creative_en_cifras').ejecutar({ periodo: '30d' }, {} as never))) as {
    piezas: { clave: string; nombre?: string; cliente?: string }[];
  };
  assert.doesNotMatch(JSON.stringify(enCifras), UUID);
  const claves = enCifras.piezas.map((x) => x.clave);
  assert.ok(claves.includes(`${PIEZA} · ${nombreP}`) && claves.includes(`${PIEZA} · Segunda 286`), claves.join(' | '));
  const calidad = (await conOrganizacion(org, () => herramienta('calidad_de_piezas').ejecutar({ periodo: '30d' }, {} as never))) as {
    piezas: { filas: { creativo: string | null; cliente?: string }[] };
  };
  assert.doesNotMatch(JSON.stringify(calidad), UUID);
  assert.deepEqual(
    calidad.piezas.filas.filter((f) => f.creativo === PIEZA).map((f) => f.cliente).sort(),
    [nombreP, 'Segunda 286'].sort(),
    'con dos clientes, cada fila dice el suyo por su nombre',
  );
  // El cerebro de la caja de Sales con el foco en Y: la base no deja ver al principal, y la clave de Y lleva su id.
  const conFoco = await conOrganizacion({ orgId: org, todaLaOrganizacion: true, cuentas: [y] }, () =>
    herramienta('creative_en_cifras').ejecutar({ periodo: '30d' }, {} as never),
  );
  assert.doesNotMatch(JSON.stringify(conFoco), UUID);
  assert.ok((conFoco as { piezas: { clave: string }[] }).piezas.some((x) => x.clave === PIEZA), 'con el foco en Y, su pieza se llama por su nombre');
});

test('las señales de una pieza llevan su cliente: la huella del principal es la de siempre, y nunca se ve un uuid', async () => {
  const umbral = (codigo: string) => umbralVigente(CATALOGO_DE_REGLAS.find((r) => r.codigo === codigo)!, new Map());
  const pasada = async () => {
    const m = await conOrganizacion(orgSenales, () => medirCreative('30d'));
    const r = detectarEnCreative({ ...m, anunciosAlDia: true, gastoCuadra: true }, umbral);
    return conOrganizacion(orgSenales, () =>
      reconciliarSenales({ departamento: 'creative', detector: 'creative', ventana: '30d', detecciones: r.detecciones, sinMedicion: r.sinMedicion }),
    );
  };
  await pasada();
  const vivas = await filas<{ id: string; regla: string; entidad_id: string; cliente: string | null }>(
    admin,
    `select id, regla, entidad_id, evidencia->>'cliente' as cliente from negocio.senales
      where org_id = $1 and departamento = 'creative' and estado in ('abierta', 'vista') order by regla, entidad_id`,
    [orgSenales],
  );
  const deS = (c: string | null) => (c === ps ? 'P' : c === ys ? 'Y' : String(c));
  const enOrden = (l: string[][]) => l.map((x) => x.join(' | ')).sort();
  // P concentra el 35,7 % del gasto de P y Y el 66,7 % del de Y; juntas, ninguna llega al 35 %.
  assert.deepEqual(
    enOrden(vivas.map((s) => [s.regla, s.entidad_id, deS(s.cliente)])),
    enOrden([
      [CRE.caidaDeCtr, 'a 286', 'P'],
      [CRE.caidaDeCtr, `${ys}:a 286`, 'Y'],
      [CRE.concentracion, 'a 286', 'P'],
      [CRE.concentracion, `${ys}:a 286`, 'Y'],
    ]),
  );

  const lista = await conOrganizacion(orgSenales, () => senalesDeLaPantalla('creative', '30d', textoDeCreative));
  assert.deepEqual([...new Set(lista.map((s) => s.nombre))].sort(), [`a 286 · ${nombrePs}`, 'a 286 · Segunda 286 señales'].sort());
  assert.doesNotMatch(JSON.stringify(lista.map((s) => [s.nombre, s.texto])), UUID);
  assert.ok(
    lista.filter((s) => s.regla === CRE.concentracion).every((s) => s.texto.includes('del gasto de su cliente en la ventana')),
    'la frase de la concentración no dice que es del gasto de su cliente',
  );

  // La de P, descartada: en la pasada siguiente se vuelve a ver y no renace.
  const deP = vivas.find((s) => s.regla === CRE.caidaDeCtr && s.entidad_id === 'a 286')!;
  await conOrganizacion(orgSenales, () => cerrarSenal('creative', deP.id, 'descartada', 'Se revisó: es estacional.', quienSenales));
  const segunda = await pasada();
  assert.ok(segunda.vistasDeNuevo >= 1, 'la descartada no se reconoció en la pasada siguiente');
  const filasDeP = await filas<{ estado: string }>(
    admin,
    `select estado from negocio.senales where org_id = $1 and regla = $2 and entidad_id = 'a 286'`,
    [orgSenales, CRE.caidaDeCtr],
  );
  assert.deepEqual(filasDeP.map((f) => f.estado), ['descartada'], 'la descartada renació');
});

test('la frecuencia de un anuncio de Y se nombra con su cliente: «Anuncio (Cliente)»', async () => {
  const umbral = (codigo: string) => umbralVigente(CATALOGO_DE_REGLAS.find((r) => r.codigo === codigo)!, new Map());
  const m = await conOrganizacion(orgSenales, () => medirCreative('7d'));
  const r = detectarEnCreative({ ...m, anunciosAlDia: true, gastoCuadra: true }, umbral);
  await conOrganizacion(orgSenales, () =>
    reconciliarSenales({ departamento: 'creative', detector: 'creative', ventana: '7d', detecciones: r.detecciones, sinMedicion: r.sinMedicion }),
  );
  const lista = await conOrganizacion(orgSenales, () => senalesDeLaPantalla('creative', '7d', textoDeCreative));
  assert.deepEqual(
    lista.filter((s) => s.regla === CRE.frecuenciaAlta).map((s) => [s.entidad.id, s.nombre]),
    [['286s-y-a', 'A 286 (Segunda 286 señales)']],
  );
});
