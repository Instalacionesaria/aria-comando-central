// EL PUNTAJE QUE QUEDA GUARDADO Y EL PERFIL DE CADA CLIENTE, ELEGIDO EN AJUSTES › CLIENTES. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C6 · D4, la `098`; y desde la `105`, ICP en cuadrantes · Q4)
//
// Desde el 2026-10-26 el ICP es el cuadrante del CRM (la 311 y la 313) y el puntaje de 0 a 100 no se muestra ni se
// elige: queda guardado en `contactos.score`, con lo que cada subcuenta ya tenía —su elegido de la `098`, o lo de
// siempre—. Lo que sigue siendo cierto, sobre una empresa propia con P (el principal, con la fila de
// `CAMPO_DEL_PUNTAJE` como la subcuenta de ARIA), Y (su «Puntaje | ICP» y otro numérico, «Score del cliente»), W
// (catálogo sin puntaje), Z (sin catálogo) y R (un catálogo chico para la ruta), más uno de baja y uno en pausa:
//
//   · sin nada elegido, cada subcuenta resuelve lo de antes, id por id: la unión de la constante y el primero por su
//     nombre, también con la constante renombrada y otro «Puntaje | ICP» al lado — mutaciones: sin el respaldo por
//     nombre, sin la constante, la cascada exclusiva;
//   · lo elegido en la `098` sigue mandando sobre el «Puntaje | ICP» de su subcuenta y no toca a P; en el principal
//     saca la constante — mutaciones: no excluir el nombre, anteponer la constante;
//   · uno por cliente: el índice — mutaciones: el índice sin `where` o sin `unique`;
//   · el refresco no pisa lo elegido, y una carpeta sin nombre ni grupo toma el suyo cuando el nombre llega tarde;
//   · la validación del puntaje que se guarda es la de la sincronización;
//   · el Perfil sin carpetas que se muestren lo dice sin culpar al contacto, y una carpeta del contrato sí se muestra;
//   · la ficha del portal saca del cuestionario el puntaje elegido;
//   · la ruta: muestra el campo del cuadrante y no lo elige —un cuerpo con «puntaje» es 400 y no toca nada—, elige
//     las carpetas, capacidades, 404, el principal y el pausado, y la auditoría.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';
import {
  GRUPOS_DEL_PERFIL,
  campoPorNombre,
  camposDelPuntaje,
  puntajeDeUnValor,
  refrescarCatalogoDeCampos,
} from '../../lib/negocio/camposDelCrm.ts';
import { sincronizarContactos } from '../../lib/negocio/sincronizar.ts';
import { perfilDeLaFicha } from '../../lib/negocio/ficha.ts';
import { fichaDelLeadDelPortal } from '../../lib/negocio/fichaDelLeadDelPortal.ts';
import { CAMPO_DEL_PUNTAJE, CLAVE_DEL_CUADRANTE, NOMBRE_DEL_PUNTAJE } from '../../lib/ghl/contrato.ts';
import { GET as verCampos, PUT as elegirCampos } from '../../app/api/admin/cuentas/[id]/campos/route.ts';
import { PATCH as vincular } from '../../app/api/admin/cuentas/[id]/vinculo/route.ts';

const SLUG = 'gamma-296';
/** Los ids de Y: V ordena ANTES que X por `campo_id`, así un orden que no excluya el nombre toma V y se ve. */
const V = 'a296v';
const X = 'b296x';
const Z = 'z296p';

let admin: Client;
let org: string;
let deBeta: string;
let p: string;
let y: string;
let w: string;
let z: string;
let r: string;
let deBaja: string;
let pausada: string;
let tokenAdmin: string;
let tokenMirada: string;
let tokenAria: string;
const fetchOriginal = globalThis.fetch;

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const foco = (cuenta: string) => ({ orgId: org, todaLaOrganizacion: true, cuentas: [cuenta] }) as const;
const ruta = (cuenta: string) => `/api/admin/cuentas/${cuenta}/campos`;

interface Catalogo {
  catalogo: { leido: boolean };
  cuadrante: { campoId: string | null; nombre: string | null; tipo: string | null; conValor: number; clasificados: number };
  carpetas: { carpetaId: string; grupo: string | null; elegida: boolean; campos: number }[];
  grupos: { clave: string; titulo: string }[];
  puedeEditar: boolean;
  codigo?: string;
  detalle?: string;
}

const ver = async (cuenta: string, token = tokenAdmin) => leerRespuesta<Catalogo>(await verCampos(pedirComo(ruta(cuenta), token), ctx(cuenta)));
const elegir = async (cuenta: string, cuerpo: unknown, token = tokenAdmin) =>
  leerRespuesta<Catalogo>(await elegirCampos(pedirComo(ruta(cuenta), token, { metodo: 'PUT', cuerpo }), ctx(cuenta)));

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['contactos', 'campos_del_crm', 'carpetas_del_crm', 'ingesta_pulso']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  await admin.query(`delete from identidad.usuarios_roles where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  await admin.query(`delete from identidad.roles where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

async function cliente(nombre: string, slug: string, estado = 'activa'): Promise<string> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, estado, baja_el)
     values ($1, $2, $3, $4, case when $4 = 'baja' then now() end) returning id`,
    [org, nombre, slug, estado],
  );
  assert.ok(c);
  return c.id;
}

async function persona(nombre: string, rolId: string): Promise<string> {
  const u = await unaFila<{ id: string }>(admin, `insert into identidad.usuarios (org_id, nombre) values ($1, $2) returning id`, [org, nombre]);
  assert.ok(u);
  await admin.query(`insert into identidad.usuarios_roles (usuario_id, rol_id) values ($1, $2)`, [u.id, rolId]);
  return u.id;
}

async function carpeta(cuenta: string, id: string, nombre: string | null, grupo: string | null): Promise<void> {
  await admin.query(
    `insert into negocio.carpetas_del_crm (org_id, cuenta_id, carpeta_id, nombre, grupo) values ($1, $2, $3, $4, $5)`,
    [org, cuenta, id, nombre, grupo],
  );
}

async function campo(cuenta: string, id: string, nombre: string, carpetaId: string, tipo: string): Promise<void> {
  await admin.query(
    `insert into negocio.campos_del_crm (org_id, cuenta_id, campo_id, nombre, carpeta_id, tipo, visto_el)
     values ($1, $2, $3, $4, $5, $6, now())`,
    [org, cuenta, id, nombre, carpetaId, tipo],
  );
}

/** Un contacto con sus campos ya guardados, como los deja la sincronización. `territorio` nulo = congelado. */
async function contacto(
  cuenta: string,
  ghl: string,
  campos: Record<string, string>,
  o: { score?: number | null; territorio?: string | null; pieza?: string } = {},
): Promise<string> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, campos_del_crm, score, atribucion_primera)
     values ($1, $2, $3, 'Contacto 296', $4, now(), $5::jsonb, $6, $7::jsonb) returning id`,
    [
      org,
      cuenta,
      ghl,
      o.territorio === undefined ? 'closer' : o.territorio,
      JSON.stringify(campos),
      o.score ?? null,
      JSON.stringify(o.pieza ? { utmContent: o.pieza } : {}),
    ],
  );
  assert.ok(c);
  return c.id;
}

const scoreDe = async (ghl: string) =>
  (await unaFila<{ score: number | null }>(admin, `select score from negocio.contactos where org_id = $1 and ghl_contact_id = $2`, [org, ghl]))
    ?.score;

/** GoHighLevel falso para la sincronización: estos contactos en `zona_closer`, nada más; lo demás responde vacío. */
async function sincronizar(cuenta: string, contactos: { id: string; campos: Record<string, unknown> }[]): Promise<void> {
  globalThis.fetch = (async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : String(entrada);
    const cuerpo = typeof opciones?.body === 'string' ? (JSON.parse(opciones.body) as { filters?: { value?: string }[] }) : {};
    if (url.includes('/contacts/search')) {
      const lista =
        cuerpo.filters?.[0]?.value === 'zona_closer'
          ? contactos.map((c) => ({
              id: c.id,
              contactName: `Contacto ${c.id}`,
              tags: ['zona_closer'],
              customFields: Object.entries(c.campos).map(([id, value]) => ({ id, value })),
            }))
          : [];
      return new Response(JSON.stringify({ contacts: lista, total: lista.length }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof globalThis.fetch;
  try {
    const s = await conOrganizacion(ambitoDeUnCliente(org, cuenta), () => sincronizarContactos({ token: 't296', locationId: `loc296-${cuenta}` }));
    assert.equal(s.tipo, 'listo');
  } finally {
    globalThis.fetch = fetchOriginal;
  }
}

/**
 * Lo que la `098` dejó elegido, puesto directo en la base: desde la `105` la ruta ya no elige el puntaje, pero lo elegido
 * antes sigue en `es_el_puntaje` y la sincronización lo usa para `score`.
 */
async function elegidoEnLaBase(cuenta: string, campoId: string): Promise<void> {
  await admin.query(`update negocio.campos_del_crm set es_el_puntaje = false where org_id = $1 and cuenta_id = $2`, [org, cuenta]);
  await admin.query(`update negocio.campos_del_crm set es_el_puntaje = true where org_id = $1 and cuenta_id = $2 and campo_id = $3`, [org, cuenta, campoId]);
}

/** Lo de antes de la `098`: la constante de ARIA y el primero por su nombre, en ese orden. */
const deAntes = async () => [...new Set([CAMPO_DEL_PUNTAJE, ...((await campoPorNombre(NOMBRE_DEL_PUNTAJE)) ?? [])])];

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 296', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  const b = await unaFila<{ cuenta: string }>(
    admin,
    `select c.id as cuenta from identidad.organizaciones o join identidad.cuentas c on c.org_id = o.id where o.slug = 'beta' limit 1`,
  );
  const aria = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email = 'fundadora@principal.ejemplo'`);
  assert.ok(o && b && aria, 'falta el sembrado');
  org = o.id;
  deBeta = b.cuenta;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  assert.ok(principal);
  p = principal.id;
  y = await cliente('Segunda 296', 'segunda-296');
  w = await cliente('Tercera 296', 'tercera-296');
  z = await cliente('Cuarta 296', 'cuarta-296');
  r = await cliente('Quinta 296', 'quinta-296');
  deBaja = await cliente('De baja 296', 'baja-296', 'baja');
  pausada = await cliente('Pausada 296', 'pausada-296', 'pausada');

  const deAdmin = await unaFila<{ id: string }>(admin, `select id from identidad.roles where clave = 'administrador' and org_id is null`);
  // Un rol propio que VE las credenciales y no las edita: ninguno de los del sistema es así.
  const mirada = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.roles (clave, nombre, org_id) values ('mirada_296', 'Mirada 296', $1) returning id`,
    [org],
  );
  assert.ok(deAdmin && mirada);
  await admin.query(`insert into identidad.roles_permisos (rol_id, permiso) values ($1, 'credenciales.ver')`, [mirada.id]);
  tokenAdmin = await sesionDe(await persona('Admin 296', deAdmin.id));
  tokenMirada = await sesionDe(await persona('Mirada 296', mirada.id));
  tokenAria = await sesionDe(aria.id);

  // P, como la subcuenta de ARIA: la constante con su nombre, otro numérico y un texto, en una carpeta del contrato.
  await carpeta(p, 'cp296p', 'Contact', 'calificacion');
  await campo(p, CAMPO_DEL_PUNTAJE, NOMBRE_DEL_PUNTAJE, 'cp296p', 'NUMERICAL');
  await campo(p, Z, 'Score propio', 'cp296p', 'NUMERICAL');
  await campo(p, 'txt296p', 'Notas', 'cp296p', 'TEXT');
  // Y, del mismo snapshot con otros ids, y una carpeta que NO se muestra.
  await carpeta(y, 'cp296y', 'Contact Y', null);
  await campo(y, V, NOMBRE_DEL_PUNTAJE, 'cp296y', 'NUMERICAL');
  await campo(y, X, 'Score del cliente', 'cp296y', 'NUMERICAL');
  await campo(y, 'txt296y', 'Respuesta', 'cp296y', 'TEXT');
  // W: un catálogo sin ningún puntaje.
  await carpeta(w, 'cp296w', 'Otra', null);
  await campo(w, 'txt296w', 'Algo', 'cp296w', 'TEXT');
  // R: el de la ruta.
  await carpeta(r, 'cp296r', 'Formulario R', null);
  await campo(r, 'r296n', 'Puntaje R', 'cp296r', 'NUMERICAL');
  await campo(r, 'r296t', 'Texto R', 'cp296r', 'TEXT');
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  try {
    if (tokenAria) await admin.query(`delete from identidad.sesiones where token_hash = $1`, [hashDeToken(tokenAria)]);
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('sin nada elegido, cada subcuenta resuelve lo de antes, id por id', async () => {
  for (const donde of [org, foco(p), foco(y), foco(w), foco(z)]) {
    const [ahora, antes] = await conOrganizacion(donde, async () => [await camposDelPuntaje(), await deAntes()]);
    assert.deepEqual(ahora, antes, 'sin nada elegido, la sincronización cambió de campos');
  }
  assert.deepEqual(await conOrganizacion(foco(z), () => camposDelPuntaje()), [CAMPO_DEL_PUNTAJE], 'sin catálogo va la constante sola');
  assert.deepEqual(await conOrganizacion(foco(y), () => camposDelPuntaje()), [CAMPO_DEL_PUNTAJE, V]);

  // La constante renombrada en GoHighLevel y otro «Puntaje | ICP» al lado, en la misma subcuenta: sigue la unión.
  await admin.query(`update negocio.campos_del_crm set nombre = 'Puntaje | ICP (viejo)' where org_id = $1 and campo_id = $2`, [org, CAMPO_DEL_PUNTAJE]);
  await campo(p, 'c296n', NOMBRE_DEL_PUNTAJE, 'cp296p', 'NUMERICAL');
  try {
    const [ahora, antes] = await conOrganizacion(foco(p), async () => [await camposDelPuntaje(), await deAntes()]);
    assert.deepEqual(ahora, antes);
    assert.deepEqual(ahora, [CAMPO_DEL_PUNTAJE, 'c296n']);
    await sincronizar(p, [
      { id: 'c296n-solo', campos: { c296n: 55 } },
      { id: 'c296n-los-dos', campos: { [CAMPO_DEL_PUNTAJE]: 50, c296n: 55 } },
    ]);
    assert.equal(await scoreDe('c296n-solo'), 55, 'un contacto con sólo el campo nuevo quedó sin puntaje: la unión se rompió');
    assert.equal(await scoreDe('c296n-los-dos'), 50, 'con los dos, la constante dejó de ir primero');
  } finally {
    await admin.query(`delete from negocio.contactos where org_id = $1 and ghl_contact_id like 'c296n-%'`, [org]);
    await admin.query(`delete from negocio.campos_del_crm where org_id = $1 and campo_id = 'c296n'`, [org]);
    await admin.query(`update negocio.campos_del_crm set nombre = $3 where org_id = $1 and campo_id = $2`, [org, CAMPO_DEL_PUNTAJE, NOMBRE_DEL_PUNTAJE]);
  }
});

test('el Perfil sin carpetas que se muestren lo dice sin culpar al contacto; una carpeta del contrato sí se muestra', async () => {
  const deY = await contacto(y, 'c296perfil-y', {});
  const deP = await contacto(p, 'c296perfil-p', {});
  const deZ = await contacto(z, 'c296perfil-z', {});
  const [fy, fp, fz] = await conOrganizacion(org, async () => [await perfilDeLaFicha(deY), await perfilDeLaFicha(deP), await perfilDeLaFicha(deZ)]);
  assert.match(fy.falta ?? '', /Ajustes › Clientes/, 'Y tiene catálogo y ninguna carpeta que se muestre, y el Perfil no lo dijo');
  assert.doesNotMatch(fy.falta ?? '', /formulario/, 'el Perfil culpó al contacto de una elección de la empresa');
  // P: su carpeta tiene el grupo del contrato y nadie la eligió (`grupo_elegido_el` nulo): se muestra.
  assert.match(fp.falta ?? '', /formulario/, 'una carpeta con el grupo del contrato contó como «ninguna se muestra»');
  assert.match(fz.falta ?? '', /catálogo/);
  await admin.query(`delete from negocio.contactos where org_id = $1 and ghl_contact_id like 'c296perfil-%'`, [org]);
});

test('lo elegido en la `098` gana sobre el «Puntaje | ICP» de su subcuenta y no toca a P', async () => {
  await contacto(p, 'c296p50', { [CAMPO_DEL_PUNTAJE]: '50' }, { score: 50 });
  await elegidoEnLaBase(y, X);

  await sincronizar(y, [
    { id: 'c296-los-dos', campos: { [V]: 40, [X]: 80 } },
    { id: 'c296-solo-v', campos: { [V]: 40 } },
  ]);
  assert.equal(await scoreDe('c296-los-dos'), 80, 'con un campo elegido, el «Puntaje | ICP» de Y siguió contando');
  assert.equal(await scoreDe('c296-solo-v'), null, 'el «Puntaje | ICP» de Y dio puntaje aunque Y eligió otro');
  assert.equal(await scoreDe('c296p50'), 50);
});

test('lo elegido en el principal saca la constante de ARIA', async () => {
  await elegidoEnLaBase(p, Z);
  try {
    await sincronizar(p, [
      { id: 'c296p-los-dos', campos: { [CAMPO_DEL_PUNTAJE]: 50, [Z]: 90 } },
      { id: 'c296p-solo-constante', campos: { [CAMPO_DEL_PUNTAJE]: 50 } },
    ]);
    assert.equal(await scoreDe('c296p-los-dos'), 90);
    assert.equal(await scoreDe('c296p-solo-constante'), null);
    assert.ok(!(await conOrganizacion(foco(p), () => camposDelPuntaje())).includes(CAMPO_DEL_PUNTAJE));
  } finally {
    await admin.query(`update negocio.campos_del_crm set es_el_puntaje = false where org_id = $1 and cuenta_id = $2`, [org, p]);
  }
});

test('uno por cliente: el índice', async () => {
  await assert.rejects(
    admin.query(`update negocio.campos_del_crm set es_el_puntaje = true where org_id = $1 and campo_id = $2`, [org, V]),
    (e: { code?: string }) => e.code === '23505',
    'dos campos elegidos en el mismo cliente',
  );
  const indice = await unaFila<{ unico: boolean; predicado: string | null; columnas: string[] }>(
    admin,
    `select i.indisunique as unico, pg_get_expr(i.indpred, i.indrelid) as predicado,
            array(select a.attname::text from unnest(i.indkey::int2[]) with ordinality k(n, o)
                    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.n order by k.o) as columnas
       from pg_index i where i.indexrelid = 'negocio.campos_del_crm_un_puntaje_por_cliente'::regclass`,
  );
  assert.deepEqual(indice, { unico: true, predicado: 'es_el_puntaje', columnas: ['org_id', 'cuenta_id'] });
});

test('el refresco no pisa lo elegido, y una carpeta sin nombre toma su grupo cuando el nombre llega tarde', async () => {
  // Una carpeta que el contrato mostraría por su nombre, escondida a mano; y dos sin nombre ni grupo, una elegida.
  await carpeta(y, 'cp296y-escondida', '📁 Score | ICP Nuevo', 'calificacion');
  assert.equal((await elegir(y, { carpetas: [{ carpetaId: 'cp296y-escondida', grupo: null }] })).estado, 200);
  await carpeta(y, 'tarde296', null, null);
  await carpeta(y, 'tarde296-elegida', null, null);
  await admin.query(`update negocio.carpetas_del_crm set grupo_elegido_el = now() where org_id = $1 and carpeta_id = 'tarde296-elegida'`, [org]);
  await admin.query(`update negocio.campos_del_crm set visto_el = now() - interval '2 days' where org_id = $1 and cuenta_id = $2`, [org, y]);

  const definicion = (id: string, nombre: string, carpetaId: string, dataType: string) => ({ id, name: nombre, parentId: carpetaId, dataType, position: 1, documentType: 'field' });
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const url = typeof entrada === 'string' ? entrada : String(entrada);
    const m = /\/customFields\/([^/?]+)$/.exec(url);
    if (m) return new Response(JSON.stringify({ customField: { name: '📁 Score | ICP Nuevo' } }), { status: 200 });
    if (/\/customFields$/.test(url)) {
      return new Response(
        JSON.stringify({
          customFields: [
            definicion(V, NOMBRE_DEL_PUNTAJE, 'cp296y', 'NUMERICAL'),
            definicion(X, 'Score del cliente', 'cp296y', 'NUMERICAL'),
            definicion('txt296y', 'Respuesta', 'cp296y', 'TEXT'),
            definicion('e296', 'Escondido', 'cp296y-escondida', 'TEXT'),
            definicion('t296', 'Tardío', 'tarde296', 'TEXT'),
            definicion('t296e', 'Tardío elegido', 'tarde296-elegida', 'TEXT'),
          ],
        }),
        { status: 200 },
      );
    }
    return new Response('{}', { status: 200 });
  }) as typeof globalThis.fetch;
  try {
    const leido = await conOrganizacion(ambitoDeUnCliente(org, y), () => refrescarCatalogoDeCampos({ token: 't296', locationId: 'loc296y' }));
    assert.equal(leido?.saltado, false);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
  const x = await unaFila<{ elegido: boolean; reciente: boolean }>(
    admin,
    `select es_el_puntaje as elegido, visto_el > now() - interval '1 hour' as reciente from negocio.campos_del_crm where org_id = $1 and campo_id = $2`,
    [org, X],
  );
  assert.deepEqual(x, { elegido: true, reciente: true }, 'el refresco borró el campo elegido, o no lo leyó');
  const grupos = Object.fromEntries(
    (await filas<{ carpeta_id: string; grupo: string | null }>(admin, `select carpeta_id, grupo from negocio.carpetas_del_crm where org_id = $1 and cuenta_id = $2`, [org, y])).map(
      (f) => [f.carpeta_id, f.grupo],
    ),
  );
  assert.equal(grupos['cp296y-escondida'], null, 'el refresco volvió a mostrar una carpeta escondida a mano');
  assert.equal(grupos['tarde296'], 'calificacion', 'la carpeta cuyo nombre llegó tarde no tomó su grupo');
  assert.equal(grupos['tarde296-elegida'], null, 'el nombre que llegó tarde pisó una elección');
});

test('la validación del puntaje que se guarda es la de la sincronización', async () => {
  const valores = ['50', '50.5', '140', '0', '100', '101', ' 50', '1e1', '007', '0050', '-5', 'Alto'];
  assert.deepEqual(valores.map((v) => puntajeDeUnValor(v)), [50, null, null, 0, 100, null, null, null, 7, null, null, null]);

  // Por la ruta de verdad: la sincronización (en Y, que eligió X), y lo que guardó.
  await sincronizar(y, valores.map((v, i) => ({ id: `c296valor-${i}`, campos: { [X]: v } })));
  const guardados = await filas<{ score: number | null; crudo: string }>(
    admin,
    `select score, campos_del_crm ->> $2 as crudo from negocio.contactos where org_id = $1 and ghl_contact_id like 'c296valor-%'`,
    [org, X],
  );
  assert.equal(guardados.length, valores.length);
  for (const g of guardados) assert.equal(g.score, puntajeDeUnValor(g.crudo), `«${g.crudo}» se guardó con otro puntaje`);
  await admin.query(`delete from negocio.contactos where org_id = $1 and ghl_contact_id like 'c296valor-%'`, [org]);
});

test('la ficha del portal saca del cuestionario el campo elegido, no el «Puntaje | ICP» de al lado', async () => {
  assert.equal((await elegir(y, { carpetas: [{ carpetaId: 'cp296y', grupo: 'calificacion' }] })).estado, 200);
  const id = await contacto(y, 'c296portal', { [X]: '80', [V]: '40', txt296y: 'Sí' });
  const f = await conOrganizacion(org, () => fichaDelLeadDelPortal(id));
  const etiquetas = (f?.cuestionario ?? []).map((c) => c.etiqueta).sort();
  assert.deepEqual(etiquetas, [NOMBRE_DEL_PUNTAJE, 'Respuesta'].sort(), 'el campo elegido apareció como una respuesta del cuestionario');
});

test('la ruta: muestra el cuadrante sin elegirlo, elige las carpetas quien edita, y sólo lo de ese cliente', async () => {
  // R: el campo del cuadrante en su catálogo, dos contactos clasificados y uno con un valor que no es de las cuatro.
  await admin.query(
    `insert into negocio.campos_del_crm (org_id, cuenta_id, campo_id, nombre, carpeta_id, tipo, clave, visto_el)
     values ($1, $2, 'r296c', 'Cuadrante de Clasificacion', 'cp296r', 'RADIO', $3, now())`,
    [org, r, CLAVE_DEL_CUADRANTE],
  );
  for (const [i, v] of [['1', 'Prioriza'], ['2', 'Valida'], ['3', 'Prioridad']] as const) await contacto(r, `c296r${i}`, { r296c: v });
  await admin.query(`update negocio.contactos set cuadrante = 'prioriza' where org_id = $1 and ghl_contact_id = 'c296r1'`, [org]);
  await admin.query(`update negocio.contactos set cuadrante = 'valida' where org_id = $1 and ghl_contact_id = 'c296r2'`, [org]);
  await contacto(r, 'c296r4', { r296t: 'x' });

  const visto = await ver(r, tokenMirada);
  assert.equal(visto.estado, 200);
  assert.equal(visto.cuerpo.puedeEditar, false, 'quien sólo ve recibe botones que van a dar 403');
  assert.deepEqual(
    visto.cuerpo.cuadrante,
    { campoId: 'r296c', nombre: 'Cuadrante de Clasificacion', tipo: 'RADIO', conValor: 3, clasificados: 2 },
    'el campo del cuadrante no es el de su clave, o sus conteos no son los del cliente',
  );
  assert.ok(!('puntaje' in visto.cuerpo) && !('opciones' in visto.cuerpo), 'la ruta volvió a ofrecer elegir el puntaje');
  assert.deepEqual(visto.cuerpo.carpetas, [{ carpetaId: 'cp296r', nombre: 'Formulario R', grupo: null, elegida: false, campos: 3 }]);
  assert.deepEqual(visto.cuerpo.grupos, GRUPOS_DEL_PERFIL);
  const check = await unaFila<{ def: string }>(admin, `select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'carpetas_del_crm_grupo'`);
  assert.deepEqual([...(check?.def.matchAll(/'([a-z]+)'/g) ?? [])].map((m) => m[1]).sort(), GRUPOS_DEL_PERFIL.map((g) => g.clave).sort());
  // W no tiene el campo: la pantalla lo dice con el campo nulo.
  assert.equal((await ver(w)).cuerpo.cuadrante.campoId, null);

  const sinPermiso = await elegir(r, { carpetas: [{ carpetaId: 'cp296r', grupo: 'detalles' }] }, tokenMirada);
  assert.deepEqual([sinPermiso.estado, sinPermiso.cuerpo.codigo], [403, 'sin_permiso'], 'quien sólo ve eligió una carpeta');

  for (const [cuerpo, porque] of [
    [{ puntaje: 'r296n' }, /ya no se elige/],
    [{ puntaje: null }, /ya no se elige/],
    [{ carpetas: [{ carpetaId: 'cp296y', grupo: null }] }, /no está en el catálogo/],
    [{}, /Nada se guardó/],
    [{ carpetas: [{ carpetaId: 'cp296r', grupo: 'otro' }] }, /grupo/],
  ] as const) {
    const m = await elegir(r, cuerpo);
    assert.deepEqual([m.estado, m.cuerpo.codigo], [400, 'peticion_invalida'], JSON.stringify(cuerpo));
    assert.match(m.cuerpo.detalle ?? '', porque);
  }
  // Un «puntaje» al lado de carpetas buenas tampoco guarda las carpetas: el cuerpo entero se rechaza.
  const auditoriaAntes = (await filas(admin, `select 1 from identidad.auditoria_accesos where org_id = $1`, [org])).length;
  const mezcla = await elegir(r, { puntaje: 'r296n', carpetas: [{ carpetaId: 'cp296r', grupo: 'detalles' }] });
  assert.deepEqual([mezcla.estado, mezcla.cuerpo.codigo], [400, 'peticion_invalida']);
  const quedo = await unaFila<{ elegidos: number; grupo: string | null }>(
    admin,
    `select (select count(*)::int from negocio.campos_del_crm where org_id = $1 and cuenta_id = $2 and es_el_puntaje) as elegidos,
            (select grupo from negocio.carpetas_del_crm where org_id = $1 and carpeta_id = 'cp296r') as grupo`,
    [org, r],
  );
  assert.deepEqual(quedo, { elegidos: 0, grupo: null }, 'un cuerpo con «puntaje» eligió algo');
  assert.equal((await filas(admin, `select 1 from identidad.auditoria_accesos where org_id = $1`, [org])).length, auditoriaAntes, 'se auditó una elección que dio 400');
  for (const id of [deBeta, deBaja, 'no-es-un-id']) {
    assert.equal((await ver(id)).estado, 404, `${id}: un cliente que la sesión no ve`);
    assert.equal((await elegir(id, { carpetas: [{ carpetaId: 'cp296r', grupo: null }] })).estado, 404);
  }
  assert.equal((await ver(pausada)).estado, 200, 'un cliente en pausa se sigue configurando');
  assert.equal((await ver(p)).estado, 200, 'el principal dio 409 como en la Conexión');

  const antes = (await filas(admin, `select 1 from identidad.auditoria_accesos where org_id = $1`, [org])).length;
  const c = await elegir(r, { carpetas: [{ carpetaId: 'cp296r', grupo: 'detalles' }] });
  assert.deepEqual([c.estado, c.cuerpo.puedeEditar], [200, true]);
  assert.deepEqual(c.cuerpo.carpetas[0], { carpetaId: 'cp296r', nombre: 'Formulario R', grupo: 'detalles', elegida: true, campos: 3 });
  assert.equal((await elegir(r, { carpetas: [{ carpetaId: 'cp296r', grupo: 'detalles' }] })).estado, 200);
  const auditadas = await filas<{ accion: string; detalle: Record<string, unknown> }>(
    admin,
    `select accion, detalle from identidad.auditoria_accesos where org_id = $1 order by id offset $2`,
    [org, antes],
  );
  assert.deepEqual(
    auditadas.map((f) => [f.accion, f.detalle]),
    [['carpeta_del_perfil_elegida', { cuenta: r, carpeta: 'cp296r', grupo: 'detalles', objetivo: r }]],
    'la auditoría no tiene cada cambio una vez —el que no cambió nada no cuenta—, o lleva el cuerpo',
  );

  // Al cambiar la subcuenta, la respuesta lo recuerda: lo elegido era de la anterior.
  const v = await leerRespuesta<{ aviso?: string }>(
    await vincular(pedirComo(`/api/admin/cuentas/${r}/vinculo`, tokenAria, { metodo: 'PATCH', cuerpo: { orgId: org, crmCuentaId: 'loc296r' } }), ctx(r)),
  );
  assert.equal(v.estado, 200);
  assert.match(v.cuerpo.aviso ?? '', /subcuenta anterior/, 'el vínculo nuevo no dijo nada de lo elegido para la anterior');
});
